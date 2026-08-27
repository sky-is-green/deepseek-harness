/**
 * Wire coverage for the inbound OpenAI endpoint over a real webserver
 * instance and real upstream HTTP stubs: envelope shapes, verbatim proxying,
 * SSE passthrough, target resolution, capability degradation, auth, and
 * client-disconnect propagation.
 */

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { localModelId, ModelsRuntime } from '@deepseek-ai/dsh-models'
import type {
  HardwareSummary,
  LocalModelId,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
  ModelLoadState,
} from '@deepseek-ai/dsh-models'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import OpenAiEndpoint from '../src/index.ts'

const disposals: Array<() => Promise<void>> = []

afterEach(async () => {
  while (disposals.length > 0) {
    const dispose = disposals.pop()
    if (dispose !== undefined) await dispose()
  }
})

interface StubOptions {
  readonly entries: readonly ModelCatalogEntry[]
  /** Ids reporting `loaded`; independent of endpoints so capability gaps are testable. */
  readonly loaded?: readonly string[]
  /** Per-id upstream port backing `serveEndpoint`. */
  readonly ports?: ReadonlyMap<string, number>
}

class StubRuntime extends ModelsRuntime {
  constructor(ctx: Context, private readonly options: StubOptions) {
    super(ctx)
  }

  async listModels(): Promise<readonly ModelCatalogEntry[]> {
    return this.options.entries
  }

  async hardware(): Promise<HardwareSummary> {
    return { devices: [], totalRamBytes: 1 }
  }

  loadState(modelId: LocalModelId): ModelLoadState {
    return this.options.loaded?.includes(String(modelId)) === true ? { status: 'loaded' } : { status: 'unloaded' }
  }

  async requestLoad(): Promise<void> {}

  async requestUnload(): Promise<void> {}

  startDownload(_request: ModelDownloadRequest): Promise<ModelDownloadHandle> {
    return Promise.reject(new Error('unused'))
  }

  downloads(): readonly ModelDownloadSnapshot[] {
    return []
  }

  serveEndpoint(modelId: LocalModelId): string | undefined {
    const port = this.options.ports?.get(String(modelId))
    return port === undefined ? undefined : `http://127.0.0.1:${String(port)}`
  }
}

class NoCapabilityRuntime extends ModelsRuntime {
  constructor(ctx: Context, private readonly options: StubOptions) {
    super(ctx)
  }

  async listModels(): Promise<readonly ModelCatalogEntry[]> {
    return this.options.entries
  }

  async hardware(): Promise<HardwareSummary> {
    return { devices: [], totalRamBytes: 1 }
  }

  loadState(modelId: LocalModelId): ModelLoadState {
    return this.options.loaded?.includes(String(modelId)) === true ? { status: 'loaded' } : { status: 'unloaded' }
  }

  async requestLoad(): Promise<void> {}

  async requestUnload(): Promise<void> {}

  startDownload(_request: ModelDownloadRequest): Promise<ModelDownloadHandle> {
    return Promise.reject(new Error('unused'))
  }

  downloads(): readonly ModelDownloadSnapshot[] {
    return []
  }
}

function entry(id: string, name: string, kind: 'llm' | 'embedding' = 'llm'): ModelCatalogEntry {
  return { id: localModelId(id), name, kind, format: 'gguf', path: `/models/${id}`, sizeBytes: 1 }
}

interface UpstreamCapture {
  path: string | undefined
  body: string
  aborted: boolean
}

/** One stub llama-server: echoes the request body, or drips three SSE frames. */
function startUpstream(mode: 'echo' | 'sse'): Promise<{ port: number; capture: UpstreamCapture; close(): Promise<void> }> {
  return new Promise((resolve) => {
    const capture: UpstreamCapture = { path: undefined, body: '', aborted: false }
    const server = createServer((req, res) => {
      capture.path = req.url
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      req.on('end', () => {
        capture.body = Buffer.concat(chunks).toString('utf8')
        if (mode === 'echo') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(capture.body)
          return
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        let index = 0
        const timer = setInterval(() => {
          if (index >= 3 || capture.aborted) {
            clearInterval(timer)
            res.end()
            return
          }
          res.write(`data: {"i":${index}}\n\n`)
          index += 1
        }, 15)
        res.on('close', () => {
          clearInterval(timer)
          if (!res.writableEnded) {
            capture.aborted = true
            res.destroy()
          }
        })
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        port,
        capture,
        close: () => new Promise((done) => {
          server.close(() => {
            done()
          })
        }),
      })
    })
  })
}

interface MountOptions {
  readonly entries: readonly ModelCatalogEntry[]
  readonly loaded?: readonly string[]
  readonly ports?: Record<string, number>
  readonly bearerToken?: string
  capability?: boolean
}

async function mount(options: MountOptions): Promise<string> {
  const ctx = new Context()
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const runtimeOptions: StubOptions = {
    entries: options.entries,
    ...(options.loaded !== undefined && { loaded: options.loaded }),
    ...(options.ports !== undefined && { ports: new Map(Object.entries(options.ports)) }),
  }
  await ctx.plugin(options.capability === false ? NoCapabilityRuntime : StubRuntime, runtimeOptions)
  await ctx.plugin(OpenAiEndpoint, {
    enabled: true,
    ...(options.bearerToken !== undefined && { bearerToken: options.bearerToken }),
  })
  disposals.push(() => ctx.fiber.dispose())
  return `http://127.0.0.1:${String(ctx.webServer.port)}`
}

describe('inbound OpenAI endpoint', () => {
  it('lists the catalog as an OpenAI model list', async () => {
    const base = await mount({ entries: [entry('a.gguf', 'Alpha'), entry('b.gguf', 'Beta', 'embedding')] })
    const response = await fetch(`${base}/v1/models`)
    expect(response.status).toBe(200)
    const body = await response.json() as { object: string; data: Array<{ id: string; object: string; created: number; owned_by: string }> }
    expect(body.object).toBe('list')
    expect(body.data).toEqual([
      { id: 'a.gguf', object: 'model', created: 0, owned_by: 'studio' },
      { id: 'b.gguf', object: 'model', created: 0, owned_by: 'studio' },
    ])
  })

  it('proxies chat verbatim to the single loaded model and passes the reply back byte-equal', async () => {
    const upstream = await startUpstream('echo')
    const base = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
      ports: { 'one.gguf': upstream.port },
    })
    const sent = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: sent,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.text()).toBe(sent)
    expect(upstream.capture.path).toBe('/v1/chat/completions')
    expect(upstream.capture.body).toBe(sent)
    await upstream.close()
  })

  it('passes SSE streams through in order with the event-stream content type', async () => {
    const upstream = await startUpstream('sse')
    const base = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
      ports: { 'one.gguf': upstream.port },
    })
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"stream":true}',
    })
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(await response.text()).toBe('data: {"i":0}\n\ndata: {"i":1}\n\ndata: {"i":2}\n\n')
    await upstream.close()
  }, 15_000)

  it('routes an explicit model field by id or display name and 404s unknown names', async () => {
    const upstream = await startUpstream('echo')
    const base = await mount({
      entries: [entry('x.gguf', 'Xena'), entry('y.gguf', 'Yuri')],
      loaded: ['x.gguf', 'y.gguf'],
      ports: { 'x.gguf': upstream.port, 'y.gguf': upstream.port },
    })
    const post = (model: string): Promise<Response> => fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model }),
    })
    const byId = await post('y.gguf')
    expect(byId.status).toBe(200)
    const byName = await post('Xena')
    expect(byName.status).toBe(200)
    const missing = await post('nope')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { type: 'invalid_request_error' } })
    await upstream.close()
  })

  it('answers explicit envelopes when zero or multiple llms are loaded', async () => {
    const noneBase = await mount({ entries: [entry('idle.gguf', 'Idle')] })
    const none = await fetch(`${noneBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(none.status).toBe(503)
    expect(await none.json()).toMatchObject({ error: { type: 'service_unavailable' } })

    const upstream = await startUpstream('echo')
    const bothBase = await mount({
      entries: [entry('p.gguf', 'P'), entry('q.gguf', 'Q')],
      loaded: ['p.gguf', 'q.gguf'],
      ports: { 'p.gguf': upstream.port, 'q.gguf': upstream.port },
    })
    const both = await fetch(`${bothBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(both.status).toBe(400)
    const body = await both.json() as { error: { message: string } }
    expect(body.error.message).toContain('p.gguf')
    expect(body.error.message).toContain('q.gguf')
    await upstream.close()
  })

  it('degrades to 503 when the provider lacks the serve-endpoint capability or reports none', async () => {
    const noCapabilityBase = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
      capability: false,
    })
    const noCapability = await fetch(`${noCapabilityBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(noCapability.status).toBe(503)

    const noPortBase = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
    })
    const noPort = await fetch(`${noPortBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(noPort.status).toBe(503)
  })

  it('enforces the configured bearer token exactly', async () => {
    const upstream = await startUpstream('echo')
    const base = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
      ports: { 'one.gguf': upstream.port },
      bearerToken: 'sekrit',
    })
    const headers = (authorization?: string): HeadersInit => ({
      'content-type': 'application/json',
      ...(authorization !== undefined && { authorization }),
    })
    const post = (authorization?: string): Promise<Response> => fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: headers(authorization),
      body: '{}',
    })
    expect((await post()).status).toBe(401)
    expect((await post('Bearer wrong')).status).toBe(401)
    expect((await fetch(`${base}/v1/models`)).status).toBe(401)
    const good = await post('Bearer sekrit')
    expect(good.status).toBe(200)
    await upstream.close()
  })

  it('propagates client disconnects as upstream aborts mid-stream', async () => {
    const upstream = await startUpstream('sse')
    const base = await mount({
      entries: [entry('one.gguf', 'One')],
      loaded: ['one.gguf'],
      ports: { 'one.gguf': upstream.port },
    })
    const controller = new AbortController()
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"stream":true}',
      signal: controller.signal,
    })
    const reader = response.body?.getReader()
    await reader?.read()
    controller.abort()
    for (let tick = 0; tick < 60 && !upstream.capture.aborted; tick += 1) {
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    expect(upstream.capture.aborted).toBe(true)
    await upstream.close()
  }, 15_000)

  it('rejects non-POST chat requests and malformed bodies', async () => {
    const base = await mount({ entries: [entry('one.gguf', 'One')] })
    const get = await fetch(`${base}/v1/chat/completions`)
    expect(get.status).toBe(405)
    const bad = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    expect(bad.status).toBe(400)
  })
})
