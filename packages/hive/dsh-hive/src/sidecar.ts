/**
 * Hive sidecar HTTP client (Seam A of HARNESS-SPEC Â§3.3).
 *
 * The sidecar is a local-first FastAPI service on 127.0.0.1:8765. This client
 * talks to the two endpoints the dsh-hive flow needs:
 *
 * - `POST /v1/hive/curate` â€” assemble the bounded, relevance-ranked context
 *   for one turn (the caller's own shell generates; the sidecar never sees
 *   the response).
 * - `POST /v1/hive/observe` â€” feed a finished reply back so the store (and
 *   comb) ingest it for later turns.
 *
 * Failures are soft: the plugin's job is curation, and a down sidecar must
 * degrade to a plain (uncurated) agent, not break the loop. A simple circuit
 * breaker avoids hammering a dead server.
 */

import type { CurateResult } from './index.ts'

/** Response shape of the sidecar's POST /v1/hive/curate (app.py Â§Seam A). */
export interface CurateResponse {
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

/** Response shape of the sidecar's POST /v1/hive/observe. */
export interface ObserveResponse {
  ok: boolean
  stored: boolean
  turn: number
}

/** Millisecond cooldown after a failed request before retrying the sidecar. */
const BREAKER_COOLDOWN_MS = 5_000

/**
 * Minimal fetch-based sidecar client with a soft circuit breaker.
 * @param baseUrl - sidecar origin, e.g. `http://127.0.0.1:8765`.
 * @param timeoutMs - per-request timeout.
 * @param fetchImpl - injectable fetch for tests.
 */
export class SidecarClient {
  private lastFailure = 0

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly token?: string,
  ) {}

  /** True when the sidecar is not in the failure cooldown window. */
  get healthy(): boolean {
    return Date.now() - this.lastFailure > BREAKER_COOLDOWN_MS
  }

  private async request(path: string, body: object, signal: AbortSignal): Promise<unknown> {
    // Combine the caller's abort signal with our own timeout.
    const controller = new AbortController()
    const onOuterAbort = (): void => { controller.abort(signal.reason) }
    const timer = setTimeout(() => { controller.abort(new Error('sidecar request timed out')) }, this.timeoutMs)
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (this.token) headers['x-hive-token'] = this.token
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`sidecar ${path} -> HTTP ${response.status}`)
      }
      return await response.json()
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onOuterAbort)
    }
  }

  private track<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((error: unknown) => {
      this.lastFailure = Date.now()
      throw error
    })
  }

  /**
   * Assemble context for one turn. Resolves undefined on failure or when
   * the sidecar is in cooldown (the caller passes the step through uncurated).
   * @param conversationId - stable conversation id for the sidecar store.
   * @param query - the user query this turn should be curated against.
   * @param signal - abort signal forwarded to the HTTP request.
   * @returns the curated context blocks, or undefined when unavailable.
   */
  async curate(
    conversationId: string,
    query: string,
    signal: AbortSignal,
  ): Promise<CurateResult | undefined> {
    if (!this.healthy) return undefined
    try {
      const data = await this.track(() => this.request(
        '/v1/hive/curate',
        { query, conversation_id: conversationId },
        signal,
      ))
      return data as CurateResult
    } catch (error: unknown) {
      if (signal.aborted) return undefined
      void error
      return undefined
    }
  }

  /**
   * Feed a finished reply back to the store. Failures are ignored.
   * @param conversationId - stable conversation id for the sidecar store.
   * @param reply - assistant reply text from the finished turn.
   * @returns whether the sidecar accepted and stored the observation.
   */
  async observe(conversationId: string, reply: string): Promise<boolean> {
    if (!this.healthy) return false
    try {
      const data = await this.track(() => this.request(
        '/v1/hive/observe',
        { conversation_id: conversationId, reply },
        new AbortController().signal,
      ))
      const parsed = data as ObserveResponse
      return parsed.ok && parsed.stored
    } catch {
      return false
    }
  }
}
