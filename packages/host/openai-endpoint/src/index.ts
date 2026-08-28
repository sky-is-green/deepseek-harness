/**
 * @deepseek-ai/dsh-host-openai-endpoint — inbound OpenAI-compatible serving.
 * Registers `/v1/models` and `/v1/chat/completions` as exact routes on the
 * studio web server and proxies them to the spawned llama-server process that
 * backs the requested (or the single loaded) model, so external OpenAI
 * clients — IDEs, agents, scripts — can use locally hosted models by pointing
 * their base URL at the studio. LM Studio parity: other apps point at your
 * studio. Requests and responses are forwarded verbatim, including SSE
 * streams; this package never parses generation payloads.
 * @module @deepseek-ai/dsh-host-openai-endpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { LocalModelId, ModelServeEndpoints } from '@deepseek-ai/dsh-models'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'

/** Largest accepted request body; larger requests answer 413 before any upstream work. */
const MAX_BODY_BYTES = 32 * 1024 * 1024

/** Plugin configuration: route enablement and optional bearer-token auth. */
export interface Config {
  /** When false the plugin registers nothing (default true). */
  enabled?: boolean
  /** Required `Authorization: Bearer` token for `/v1/*`; absent means open access on the loopback server. */
  bearerToken?: string
}

/** One resolved chat target: either a catalog model id or an immediate rejection envelope. */
type ChatTarget =
  | { readonly id: LocalModelId }
  | { readonly status: number; readonly message: string; readonly errorType: string }

/**
 * Inbound serving plugin. Mount after both the web server and a models
 * provider; activation registers the two routes and teardown releases them.
 * Upstream discovery uses the optional {@link ModelServeEndpoints} provider
 * capability detected structurally, so providers without spawned servers
 * degrade to explicit 503 envelopes instead of breaking mount.
 */
export class OpenAiEndpoint extends Service {
  static inject = ['webServer', 'models']

  static Config: z<Config> = z.object({
    enabled: z.boolean().default(true),
    bearerToken: z.string(),
  })

  private readonly config: Config

  constructor(ctx: Context, config: Config) {
    super(ctx, 'openAiEndpoint')
    this.config = config
  }

  [Service.init](): Promise<void> {
    if (this.config.enabled === false) return Promise.resolve()
    const server: WebServer = this.ctx.webServer
    const disposers = [
      server.register({
        kind: 'exact',
        path: '/v1/models',
        handler: (req, res) => { void this.handleList(req, res) },
      }),
      server.register({
        kind: 'exact',
        path: '/v1/chat/completions',
        handler: (req, res) => { void this.handleChat(req, res) },
      }),
    ]
    this.ctx.effect(() => () => {
      for (const dispose of disposers) dispose()
    }, 'openai-endpoint routes')
    return Promise.resolve()
  }

  /** OpenAI `GET /v1/models`: the full local catalog in list-envelope form. */
  private async handleList(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.authorized(req)) {
      deny(res)
      return
    }
    if (req.method !== 'GET') {
      sendError(res, 405, 'Method not allowed', 'invalid_request_error')
      return
    }
    const entries = await this.ctx.models.listModels()
    const body = JSON.stringify({
      object: 'list',
      data: entries.map(entry => ({
        id: entry.id,
        object: 'model',
        created: 0,
        owned_by: 'studio',
      })),
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
  }

  /** OpenAI `POST /v1/chat/completions`: resolve the target, then proxy verbatim; client aborts propagate upstream. */
  private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.authorized(req)) {
      deny(res)
      return
    }
    if (req.method !== 'POST') {
      sendError(res, 405, 'Method not allowed', 'invalid_request_error')
      return
    }

    let raw: string
    try {
      raw = await readBody(req)
    } catch {
      sendError(res, 413, 'Request body too large', 'invalid_request_error')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      sendError(res, 400, 'Request body is not valid JSON', 'invalid_request_error')
      return
    }
    const requested = typeof parsed === 'object' && parsed !== null && 'model' in parsed
      ? parsed.model
      : undefined

    const target = await this.resolveTarget(requested)
    if ('errorType' in target) {
      sendError(res, target.status, target.message, target.errorType)
      return
    }
    const endpoint = this.serveEndpointFor(target.id)
    if (endpoint === undefined) {
      sendError(res, 503, `Model '${String(target.id)}' is not loaded`, 'service_unavailable')
      return
    }

    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    let upstream: Response
    try {
      upstream = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw,
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : String(error)
      sendError(res, 502, `Upstream model server failed: ${message}`, 'api_error')
      return
    }

    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' })
    if (upstream.body !== null) {
      try {
        await pipeline(Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream), res)
      } catch {
        // Headers are already sent; mid-stream death (client abort or upstream
        // reset) owns no envelope — destroying the socket ends both sides.
        res.destroy()
        return
      }
      return
    }
    res.end()
  }

  /**
   * Pick the chat target: an explicit non-empty `model` field matches catalog
   * ids or display names; otherwise exactly one loaded llm must exist.
   */
  private async resolveTarget(requested: unknown): Promise<ChatTarget> {
    if (typeof requested === 'string' && requested.length > 0) {
      const entry = (await this.ctx.models.listModels())
        .find(candidate => candidate.id === requested || candidate.name === requested)
      if (entry === undefined) {
        return { status: 404, message: `Model '${requested}' not found`, errorType: 'invalid_request_error' }
      }
      return { id: entry.id }
    }
    const loaded = (await this.ctx.models.listModels())
      .filter(entry => entry.kind === 'llm' && this.ctx.models.loadState(entry.id).status === 'loaded')
    const [single] = loaded
    if (single === undefined) {
      return {
        status: 503,
        message: 'No model is currently loaded; load one in the studio first',
        errorType: 'service_unavailable',
      }
    }
    if (loaded.length > 1) {
      return {
        status: 400,
        message: `Multiple models are loaded (${loaded.map(entry => String(entry.id)).join(', ')}); specify "model"`,
        errorType: 'invalid_request_error',
      }
    }
    return { id: single.id }
  }

  /** Structural capability probe: providers without spawned servers simply have no endpoint. */
  private serveEndpointFor(modelId: LocalModelId): string | undefined {
    const candidate = this.ctx.models as Partial<ModelServeEndpoints>
    return typeof candidate.serveEndpoint === 'function' ? candidate.serveEndpoint(modelId) : undefined
  }

  /** Bearer gate: open when no token is configured, exact match otherwise. */
  private authorized(req: IncomingMessage): boolean {
    if (this.config.bearerToken === undefined) return true
    return req.headers.authorization === `Bearer ${this.config.bearerToken}`
  }
}

/** Answer an OpenAI-style single-request auth failure. */
function deny(res: ServerResponse): void {
  sendError(res, 401, 'Invalid or missing bearer token', 'authentication_error')
}

/** Write one OpenAI-style error envelope unless the socket is already gone. */
function sendError(res: ServerResponse, status: number, message: string, errorType: string): void {
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message, type: errorType } }))
}

/** Collect the full request body as utf8 text, rejecting past {@link MAX_BODY_BYTES}. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

export default OpenAiEndpoint
