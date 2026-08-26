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
import { z as zod } from 'zod'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { MessageSource, UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { SidecarClient } from './sidecar.ts'

/** The projection definition this plugin registers for its telemetry. */
export type CurationProjectionDefinition = ProjectionDefinition<'hiveCuration', CurationState>

/** Cordis plugin name used by loader diagnostics and profile composition. */
export const name = 'dsh-hive'

/** The agent registry that owns pre-step processing. */
export const inject = ['agents']

/** Default sidecar origin (the harness binds 127.0.0.1:8765 locally). */
export const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:8765'

// Type-only: resolves the optional projection registry Context declaration and
// merges this plugin's telemetry key into both projection tables.
import type {} from '@deepseek-ai/dsh-session-projection'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The bounded telemetry fold behind the `hiveCuration` view. */
    hiveCuration: CurationState
  }

  interface SessionProjectionMap {
    /** Per-round curation quality metrics (`pes`, degradation) for devtools surfaces. */
    hiveCuration: { entries: readonly CurationEntry[] }
  }
}

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
  /**
   * Refresh curation on up to this many steps of each turn (default 1 = the
   * historical step-1-only behavior). Round 2+ reuses the turn's original
   * query; each round injects a fresh `snapshot` whose later snapshot
   * supersedes the earlier one.
   */
  maxCurationSteps?: number
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  sidecarUrl: z.string().default(DEFAULT_SIDECAR_URL),
  conversationKey: z.union([z.const('workspace'), z.const('session')]).default('workspace'),
  timeoutMs: z.number().default(10_000),
  sidecarToken: z.string().default(''),
  enabled: z.boolean().default(true),
  maxCurationSteps: z.number().step(1).min(1).default(1),
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

/**
 * Non-model-visible quality metrics carried on one injection's durable
 * source. The sidecar's response-side scores ride the message metadata, so
 * replay and devtools surfaces can read them without a new event type; the
 * provider payload never sees them.
 */
export interface CurationTelemetry {
  /** 1-based curation round within the turn (1 = the step-1 assembly). */
  round: number
  /** How many rounds this turn allows at most. */
  maxRounds: number
  /** Sidecar-reported prompt-envelope score for this assembly. */
  pes: number
  /** Sidecar-reported degradation level for this assembly. */
  degradationLevel: number
  /** Sidecar-reported token count of `assembled_content`. */
  tokenCount: number
  /** Sidecar-reported curation mode. */
  mode: string
}

/** Hard cap on retained telemetry entries in the `hiveCuration` projection. */
export const CURATION_WINDOW = 16

/** One projected curation round with its durable position. */
export interface CurationEntry extends CurationTelemetry {
  /** Sequence of the injection's durable `user/message`. */
  seq: number
  /** Turn the injection belongs to. */
  turn: number
}

/** The fold state behind the `hiveCuration` projection key. */
export interface CurationState {
  readonly entries: readonly CurationEntry[]
}

/**
 * Fold one committed event onto the curation telemetry state: captures the
 * metrics this plugin attached to its own snapshot injections, bounded to the
 * most recent {@link CURATION_WINDOW} rounds. Any other event returns the
 * same reference so the registry's change gate stays quiet.
 * @param state - preceding fold state.
 * @param event - next committed session event.
 * @returns the next bounded curation state, or the same reference when the event carries no curation metrics.
 */
export function applyCurationEvent(state: CurationState, event: SessionEvent): CurationState {
  if (event.type !== 'user/message') return state
  const source = event.data.source as Record<string, unknown>
  if (source.kind !== 'plugin' || source.plugin !== name) return state
  const raw = source.curation as Record<string, unknown> | undefined
  if (raw === undefined) return state
  const entry: CurationEntry = {
    seq: event.seq,
    turn: Number(raw.turn),
    round: Number(raw.round),
    maxRounds: Number(raw.maxRounds),
    pes: Number(raw.pes),
    degradationLevel: Number(raw.degradationLevel),
    tokenCount: Number(raw.tokenCount),
    mode: String(raw.mode),
  }
  const entries = [...state.entries, entry].slice(-CURATION_WINDOW)
  return { entries }
}

/** Schemastery-free zod schema of {@link CurationState} for the projection registry. */
export const curationStateSchema = zod.object({
  entries: zod.array(zod.object({
    seq: zod.number().int().nonnegative(),
    turn: zod.number().int().nonnegative(),
    round: zod.number().int().min(1),
    maxRounds: zod.number().int().min(1),
    pes: zod.number(),
    degradationLevel: zod.number(),
    tokenCount: zod.number().nonnegative(),
    mode: zod.string(),
  }).strict()),
}).strict()

/** The wire view schema validating the client-visible value. */
export const curationViewSchema = curationStateSchema

/**
 * FNV-1a 64-bit truncated to a stable 16-hex conversation id.
 * @param input - stable source text (typically a working directory).
 * @returns 16 lowercase hex characters.
 */
export function hash16(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0') + hash.toString(16).slice(0, 8)
}

/**
 * Resolve the conversation id for a session under the configured key.
 * @param session - session being curated.
 * @param key - conversation scoping choice from the plugin config.
 * @returns the stable conversation id handed to the sidecar.
 */
export function conversationIdFor(session: Session, key: Config['conversationKey']): string {
  if (key === 'session') return session.id
  const cwd = session.header.cwd ?? process.cwd()
  return hash16(cwd)
}

/**
 * Extract the last plain user text from a claimed message batch.
 * @param messages - claimed user message batch, newest last.
 * @returns the newest non-empty plain text block, or the empty string.
 */
export function lastUserText(messages: readonly UserMessage[]): string {
  for (const message of [...messages].reverse()) {
    if (message.source.kind === 'plugin') continue
    for (const block of [...message.content].reverse()) {
      if (block.type === 'text' && block.text.trim().length > 0) return block.text
    }
  }
  return ''
}

/**
 * Extract reply text from an assistant/message session event.
 * @param content - assistant message content blocks.
 * @returns all text blocks joined with newlines, or the empty string.
 */
export function assistantReplyText(content: readonly { type: string; text?: string }[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      parts.push(block.text)
    }
  }
  return parts.join('\n')
}

/**
 * Extract the reply text from an assistant/message event, tolerating both
 * the firehose shape (data = the message) and the typed wrapper shape
 * (data.message = the message).
 * @param event - committed session event carrying an assistant reply.
 * @returns all text blocks joined with newlines, or the empty string.
 */
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
  /** Per-session curation state: the turn currently curated, its original query, and how many rounds ran. */
  const curationBySession = new Map<string, { turn: number; query: string; rounds: number }>()

  // Telemetry registration is an optional child: compositions without the
  // registry keep the curator's injection-only shape.
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'hiveCuration', CurationState>({
      key: 'hiveCuration',
      stateVersion: 1,
      stateSchema: curationStateSchema,
      init: () => ({ entries: [] }),
      apply: applyCurationEvent,
      wire: {
        viewSchema: curationViewSchema,
        view: state => ({ entries: state.entries }),
      },
    })
  })

  ctx.on('agent/pre-step', async (
    { agent, messages, turn, step, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (!config.enabled || decision.kind === 'reject' || signal.aborted) return decision
    if (step > (config.maxCurationSteps ?? 1)) return decision
    const maxRounds = config.maxCurationSteps ?? 1
    let state = curationBySession.get(agent.session.id)
    if (state === undefined || state.turn !== turn) {
      state = { turn, query: '', rounds: 0 }
    }
    // Round 1 prices the claimed batch's fresh query; later rounds reuse the
    // turn's original query so the sidecar can refresh the assembly as the
    // conversation evolves through observed tool traffic and replies.
    const freshQuery = lastUserText(messages)
    const query = freshQuery !== '' ? freshQuery : state.query
    if (query === '') return decision
    const conversationId = conversationIdFor(agent.session, config.conversationKey)
    const curated = await client.curate(conversationId, query, signal)
    if (curated === undefined) return decision
    if (!curated.assembled_content) return decision
    state = { turn, query, rounds: state.rounds + 1 }
    curationBySession.set(agent.session.id, state)
    const text = curated.assembled_content
    const telemetry: CurationTelemetry = {
      round: state.rounds,
      maxRounds,
      pes: curated.pes,
      degradationLevel: curated.degradation_level,
      tokenCount: curated.token_count,
      mode: curated.mode,
    }
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      // The producer-metadata record is merge-extensible by contract (client
      // provenance reads unknown producers generically); the telemetry block
      // is this plugin's own addition and never reaches a provider payload.
      source: {
        kind: 'plugin',
        plugin: name,
        form: 'snapshot',
        sections: [{ name, text }],
        curation: { ...telemetry, turn },
      } as MessageSource,
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
    if (!curationBySession.has(session.id)) return
    const reply = eventReplyText(event)
    if (!reply) return
    const conversationId = conversationIdFor(session, config.conversationKey)
    void client.observe(conversationId, reply)
  })
}
