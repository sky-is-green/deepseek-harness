/**
 * Scriptable HTTP stub of the Hive sidecar wire contract (Seam A): the
 * `POST /v1/hive/curate`, `POST /v1/hive/observe`, and
 * `POST /v1/protocol/run` endpoints that `@deepseek-ai/dsh-hive`'s
 * SidecarClient and `dsh-bench` consume.
 *
 * Response bodies byte-match the Python sidecar's shapes so sidecar-consuming
 * lanes develop and test without Python running. Each conversation gets a
 * deterministic turn counter and an in-memory store: an observe'd reply is
 * returned verbatim by the next curate, which is the minimal behavior the
 * real store guarantees.
 *
 * @module @deepseek-ai/dsh-hive-mock-server
 */

import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/** Scriptable per-request behaviors; consumed FIFO before the default success path. */
export const HIVE_MOCK_BEHAVIORS = [
  'curate_ok',
  'curate_error',
  'curate_stall',
  'observe_stored',
  'observe_notstored',
  'protocol_ok',
  'protocol_error',
  'unauthorized',
  'server_error',
] as const

/** One scripted mock behavior name. */
export type HiveMockBehavior = typeof HIVE_MOCK_BEHAVIORS[number]

/** Wire shape of `POST /v1/hive/curate` (byte-matches dsh-hive's CurateResponse). */
export interface MockCurateResponse {
  conversation_id: string
  turn: number
  assembled_content: string
  token_count: number
  budget: number
  mode: string
  error?: string | null
  timings: Record<string, number>
  pes: number
  degradation_level: number
}

/** Wire shape of `POST /v1/hive/observe` (byte-matches dsh-hive's ObserveResponse). */
export interface MockObserveResponse {
  ok: boolean
  stored: boolean
  turn: number
}

/** Wire shape of `POST /v1/protocol/run`. */
export interface MockProtocolRunResponse {
  run_dir: string
  pid: number | null
}

/** One captured request at the mock boundary. */
export interface HiveMockRequestRecord {
  /** One-based accepted request number across all endpoints. */
  readonly attempt: number
  readonly path: string
  readonly headers: Record<string, string | string[] | undefined>
  readonly body: unknown
}

/** Configuration for one mock server instance. */
export interface HiveMockServerOptions {
  /** Loopback host by default. */
  readonly host?: string
  /** TCP port; zero (default) requests an OS-assigned port. */
  readonly port?: number
  /** When set, requests must carry this exact `x-hive-token` header or get 401. */
  readonly token?: string
  /** Behaviors consumed FIFO, one per accepted request; exhausted script falls through to defaults. */
  readonly script?: readonly HiveMockBehavior[]
}

/** A running mock server handle. */
export interface HiveMockServer {
  readonly port: number
  readonly url: string
  /** Captured requests in acceptance order. */
  readonly requests: readonly HiveMockRequestRecord[]
  /** Per-conversation state: turn counters and stored reply chunks. */
  readonly conversations: ReadonlyMap<string, { turn: number; chunks: string[] }>
  close(): Promise<void>
}

/** Read and JSON-parse a request body; rejects on malformed JSON. */
function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk as Buffer))
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    request.on('error', reject)
  })
}

/** Send one JSON response and remember stalled sockets for shutdown. */
function respondJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

/**
 * Start a hive sidecar stub.
 * @param options - host/port/token/script configuration.
 * @returns a handle with the bound port, captured requests, and `close()`.
 */
export function startHiveMockServer(
  options: HiveMockServerOptions = {},
): Promise<HiveMockServer> {
  const host = options.host ?? '127.0.0.1'
  const script = [...(options.script ?? [])]
  const requests: HiveMockRequestRecord[] = []
  const conversations = new Map<string, { turn: number; chunks: string[] }>()
  const stalls = new Set<ServerResponse>()
  let attempt = 0
  let protocolRuns = 0

  const server: Server = createServer((request, response) => {
    void (async () => {
      attempt += 1
      let body: unknown = {}
      try {
        body = await readBody(request)
      } catch {
        respondJson(response, 400, { detail: 'malformed JSON body' })
        return
      }
      requests.push({ attempt, path: request.url ?? '', headers: request.headers, body })

      // Token guard mirrors the sidecar's HARNESS_TOKEN behavior.
      if (options.token !== undefined && request.headers['x-hive-token'] !== options.token) {
        respondJson(response, 401, { detail: 'invalid or missing x-hive-token' })
        return
      }

      const behavior = script.shift()
      if (behavior === 'server_error') {
        respondJson(response, 500, { detail: 'scripted server_error' })
        return
      }
      if (behavior === 'unauthorized') {
        respondJson(response, 401, { detail: 'scripted unauthorized' })
        return
      }

      const path = request.url ?? ''
      const parsedBody = (body ?? {}) as Record<string, unknown>
      const conversationId = typeof parsedBody.conversation_id === 'string'
        ? parsedBody.conversation_id : 'mock-conv'

      if (path === '/v1/hive/curate') {
        if (behavior === 'curate_stall') {
          // Hold the socket open until close(); tests assert client timeouts.
          stalls.add(response)
          return
        }
        if (behavior === 'curate_error') {
          respondJson(response, 500, { detail: 'scripted curate failure' })
          return
        }
        const state = conversations.get(conversationId) ?? { turn: 0, chunks: [] }
        state.turn += 1
        conversations.set(conversationId, state)
        const assembled = state.chunks.join('\n')
        const payload: MockCurateResponse = {
          conversation_id: conversationId,
          turn: state.turn,
          assembled_content: assembled,
          token_count: assembled === '' ? 0 : Math.ceil(assembled.length / 4),
          budget: 2048,
          mode: 'mock',
          error: null,
          timings: { assemble_ms: 1 },
          pes: 1,
          degradation_level: 0,
        }
        respondJson(response, 200, payload)
        return
      }

      if (path === '/v1/hive/observe') {
        const reply = typeof parsedBody.reply === 'string' ? parsedBody.reply : ''
        const state = conversations.get(conversationId) ?? { turn: 0, chunks: [] }
        state.turn += 1
        const stored = behavior === 'observe_notstored' ? false : reply.trim() !== ''
        if (stored) state.chunks.push(reply)
        conversations.set(conversationId, state)
        const payload: MockObserveResponse = { ok: true, stored, turn: state.turn }
        respondJson(response, 200, payload)
        return
      }

      if (path === '/v1/protocol/run') {
        if (behavior === 'protocol_error') {
          respondJson(response, 500, { detail: 'scripted protocol failure' })
          return
        }
        protocolRuns += 1
        const payload: MockProtocolRunResponse = {
          run_dir: `runs/mock_protocol_${String(protocolRuns).padStart(4, '0')}`,
          pid: null,
        }
        respondJson(response, 200, payload)
        return
      }

      respondJson(response, 404, { detail: `no such endpoint: ${path}` })
    })().catch(() => {
      if (!response.headersSent) respondJson(response, 500, { detail: 'mock handler crash' })
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, host, () => {
      const address = server.address() as AddressInfo
      resolve({
        port: address.port,
        url: `http://${host}:${address.port}`,
        requests,
        conversations,
        close: () => new Promise<void>((resolveClose, rejectClose) => {
          for (const stalled of stalls) {
            stalled.destroy()
            stalls.delete(stalled)
          }
          server.close((error) => {
            if (error) rejectClose(error)
            else resolveClose()
          })
        }),
      })
    })
  })
}
