/**
 * HiveBench Studio curator (dsh-hive).
 *
 * On every agent step the plugin asks the hive sidecar to assemble the
 * bounded, relevance-ranked context for the step's query, then folds that
 * context into the request as a source-attributed user message (dsh
 * expresses "system prompt" content as user messages with plugin sources â€”
 * the same mechanism agent-instructions and time-context use). The shell's
 * own model routing generates; the plugin observes the finished reply back
 * to the sidecar so the store and comb ingest it.
 *
 * Failure is soft by design: when the sidecar is down or times out, the
 * step passes through uncurated (mechanism attribution â€” disabling the
 * plugin must reproduce the plain harness).
 *
 * @module @deepseek-ai/dsh-hive
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { SidecarClient } from './sidecar.ts'

/** Cordis plugin name used by loader diagnostics and profile composition. */
export const name = 'dsh-hive'

/** The agent registry that owns pre-step processing. */
export const inject = ['agents']

/** Default sidecar origin (the harness binds 127.0.0.1:8765 locally). */
export const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:8765'

/**
 * Curator configuration. Invalid values fail plugin load.
 */
export interface Config {
  /** Sidecar origin, e.g. `http://127.0.0.1:8765`. */
  sidecarUrl?: string
  /** What a conversation maps to: one hive store per workspace (stable
   * across sessions) or one per dsh session. */
  conversationKey?: 'workspace' | 'session'
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Optional access token when the sidecar runs with HARNESS_TOKEN set
   * (sent as the `x-hive-token` header). */
  sidecarToken?: string
  /** Master switch (mechanism attribution: off == plain harness). */
  enabled?: boolean
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  sidecarUrl: z.string().default(DEFAULT_SIDECAR_URL),
  conversationKey: z.union([z.const('workspace'), z.const('session')]).default('workspace'),
  timeoutMs: z.number().default(10_000),
  sidecarToken: z.string().default(''),
  enabled: z.boolean().default(true),
})

/** The curated context the sidecar returned for one turn. */
export interface CurateResult {
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

/** FNV-1a 64-bit truncated to a stable 16-hex conversation id. */
export function hash16(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0') + hash.toString(16).slice(0, 8)
}

/** Resolve the conversation id for a session under the configured key. */
export function conversationIdFor(session: Session, key: Config['conversationKey']): string {
  if (key === 'session') return session.id
  const cwd = session.header.cwd ?? process.cwd()
  return hash16(cwd)
}

/** Extract the last plain user text from a claimed message batch. */
export function lastUserText(messages: readonly UserMessage[]): string {
  for (const message of [...messages].reverse()) {
    if (message.source.kind === 'plugin') continue
    for (const block of [...message.content].reverse()) {
      if (block.type === 'text' && block.text.trim().length > 0) return block.text
    }
  }
  return ''
}

/** Extract reply text from an assistant/message session event. */
export function assistantReplyText(content: readonly { type: string; text?: string }[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      parts.push(block.text)
    }
  }
  return parts.join('\n')
}

/** Extract the reply text from an assistant/message event, tolerating both
 * the firehose shape (data = the message) and the typed wrapper shape
 * (data.message = the message). */
export function eventReplyText(event: { data: unknown }): string {
  const data = event.data as Record<string, unknown>
  const direct = data['content']
  if (Array.isArray(direct)) {
    return assistantReplyText(direct as readonly { type: string; text?: string }[])
  }
  const wrapped = data['message']
  if (wrapped !== undefined && typeof wrapped === 'object' && wrapped !== null
    && Array.isArray((wrapped as Record<string, unknown>)['content'])) {
    return assistantReplyText(
      (wrapped as Record<string, unknown>)['content'] as readonly { type: string; text?: string }[],
    )
  }
  return ''
}

/**
 * Register the pre-step curator and reply observer for the lifetime of `ctx`.
 * @param ctx - plugin context; listeners are disposed with it.
 * @param config - sidecar wiring and conversation mapping.
 */
export function apply(ctx: Context, config: Config): void {
  const args = [config.sidecarUrl ?? DEFAULT_SIDECAR_URL, config.timeoutMs ?? 10_000, fetch, config.sidecarToken || undefined] as const
  const client = new SidecarClient(...args)
  const curatedSessions = new Set<string>()

  ctx.on('agent/pre-step', async (
    { agent, messages, step, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (!config.enabled || decision.kind === 'reject' || signal.aborted) return decision
    if (step !== 1) return decision
    const query = lastUserText(messages)
    if (!query) return decision
    const conversationId = conversationIdFor(agent.session, config.conversationKey)
    const curated = await client.curate(conversationId, query, signal)
    if (curated === undefined) return decision
    if (!curated.assembled_content) return decision
    curatedSessions.add(agent.session.id)
    const text = curated.assembled_content
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      source: {
        kind: 'plugin',
        plugin: name,
        form: 'snapshot',
        sections: [{ name, text }],
      },
    })
    // Fold the curated context after the claimed batch: the direct prompt
    // precedes it and the driver-appended runtime context follows it.
    const lastClaimedIndex = decision.messages.findLastIndex(
      message => messages.includes(message),
    )
    return {
      kind: 'enter',
      messages: decision.messages.toSpliced(lastClaimedIndex + 1, 0, message),
    }
  }, { prepend: true })

  ctx.on('session/event', (session, event) => {
    if (!config.enabled) return
    if (event.type !== 'assistant/message') return
    if (!curatedSessions.has(session.id)) return
    const reply = eventReplyText(event)
    if (!reply) return
    const conversationId = conversationIdFor(session, config.conversationKey)
    void client.observe(conversationId, reply)
  })
}
