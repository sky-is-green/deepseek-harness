/**
 * Pure fold turning durable failure signals into bounded forensic entries.
 *
 * Signals folded today: model failures closing a turn (`turn/end` error
 * reason), provider retries (`llm/retry`), tool timeouts and structured tool
 * errors (`tool/result` with `error` or an `isError` block), signal-killed
 * command results (parsed from the model-facing `[killed by signal: …]`
 * marker), and failed compaction attempts (`compaction/end` with `error`).
 * Plain non-zero command exits are deliberately not captured — they are
 * everyday workflow, not forensics.
 *
 * @module fold
 */

import { z } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
// Type-only: the `llm/retry` SessionEventMap merge.
import type {} from '@deepseek-ai/dsh-llm-retry'
// Type-only: the `compaction/*` SessionEventMap merges.
import type {} from '@deepseek-ai/dsh-compaction'
import type {
  FailureEntry, FailureEntryKind, FailureForensicsView,
} from './types.ts'

/** Hard cap on retained entries; the oldest leave first. Fixed protocol bound of this projection's wire shape. */
export const FAILURE_WINDOW = 20

/** Hard cap on one entry's message length. */
const MESSAGE_MAX_CHARS = 200

/** Hard cap on one tool entry's output tail. */
const OUTPUT_TAIL_CHARS = 400

/** Hard cap on pending tool calls tracked while their result has not arrived. */
const PENDING_CALLS_CAP = 64

const ELLIPSIS = '…'

/** The fold's persisted state: retained entries plus open tool-call identities. */
export interface ForensicsState {
  readonly entries: readonly FailureEntry[]
  /** Open `tool/call` identities awaiting their result, keyed by callId. */
  readonly pendingCalls: Readonly<Record<string, { readonly name: string }>>
}

/** The full persisted entry shape — every projected field of one failure. */
const entrySchema = z.object({
  kind: z.enum([
    'model-error', 'model-retry', 'tool-timeout', 'tool-error', 'command-killed', 'compaction',
  ]),
  seq: z.number().int().nonnegative(),
  time: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative().nullable(),
  message: z.string(),
  code: z.string().nullable(),
  suggestedFix: z.string().nullable(),
  tool: z.string().optional(),
  exit: z.string().optional(),
  outputTail: z.string().optional(),
  requestId: z.string().optional(),
}).strict()

/** The state schema — the one definition of the persisted shape.
 *
 * Cast: exactOptionalPropertyTypes makes zod's emitted `prop?: T | undefined`
 * wider than the entry interface's `prop?: T`; the parse output satisfies the
 * interface because absent keys stay absent (permission-presets precedent).
 */
export const forensicsStateSchema = z.object({
  entries: z.array(entrySchema),
  pendingCalls: z.record(z.string(), z.object({ name: z.string() }).strict()),
}).strict() as unknown as z.ZodType<ForensicsState>

/** The view schema validating the value that leaves the host. */
export const forensicsViewSchema: z.ZodType<FailureForensicsView> = z.object({
  entries: z.array(entrySchema),
}).strict() as unknown as z.ZodType<FailureForensicsView>

/** The empty fold state every projection unit starts and resets to. */
export const EMPTY_FORENSICS_STATE: ForensicsState = { entries: [], pendingCalls: {} }

/**
 * Deterministic first-response hint for a captured failure.
 * @param kind - which durable signal was captured.
 * @param code - machine code carried by the signal, when any.
 * @returns a short actionable hint, or null when no mapping applies.
 */
export function suggestFix(kind: FailureEntryKind, code: string | null): string | null {
  if (kind === 'tool-timeout') return 'timeout'
  if (kind === 'command-killed') return 'signal'
  switch (code) {
    case 'TOOL_TIMEOUT':
      return 'timeout'
    case 'AUTH':
    case 'UNAUTHORIZED':
      return 'credentials'
    case 'RATE_LIMIT':
    case '429':
      return 'rate-limit'
    case 'ENOENT':
      return 'binary-missing'
    default:
      return null
  }
}

/**
 * Fold one committed event onto the forensic state. Returns the same
 * reference for uninterested events so the registry's change gate stays quiet;
 * allocates only when a capture, call pairing, or eviction actually happens.
 * @param state - the preceding fold state.
 * @param event - the next committed session event.
 * @returns the next state (same reference when nothing changed).
 */
export function applyForensicEvent(state: ForensicsState, event: SessionEvent): ForensicsState {
  switch (event.type) {
    case 'tool/call':
      return trackCall(state, event)
    case 'tool/result':
      return settleResult(state, event)
    case 'turn/end': {
      const reason = event.data.reason
      if (reason.kind !== 'error') return state
      const failure = reason.error
      return pushEntry(state, {
        kind: 'model-error',
        seq: event.seq,
        time: event.time,
        turn: event.data.turn,
        message: head(failure.message, MESSAGE_MAX_CHARS),
        code: 'code' in failure ? failure.code : null,
        ...('requestId' in failure ? { requestId: failure.requestId } : {}),
      })
    }
    case 'llm/retry': {
      const failure = event.data.failure
      return pushEntry(state, {
        kind: 'model-retry',
        seq: event.seq,
        time: event.time,
        turn: event.data.turn,
        message: head(failure.message, MESSAGE_MAX_CHARS),
        code: 'code' in failure ? failure.code : null,
        ...('requestId' in failure ? { requestId: failure.requestId } : {}),
      })
    }
    case 'compaction/end': {
      if (event.data.error === undefined) return state
      return pushEntry(state, {
        kind: 'compaction',
        seq: event.seq,
        time: event.time,
        turn: event.data.turn,
        message: head(event.data.error, MESSAGE_MAX_CHARS),
        code: null,
      })
    }
    default:
      return state
  }
}

function trackCall(state: ForensicsState, event: SessionEvent<'tool/call'>): ForensicsState {
  let pendingCalls = state.pendingCalls
  if (!(event.data.callId in pendingCalls)) {
    if (Object.keys(pendingCalls).length >= PENDING_CALLS_CAP) {
      const oldest = Object.keys(pendingCalls)[0]
      if (oldest !== undefined) {
        const { [oldest]: _dropped, ...rest } = pendingCalls
        pendingCalls = rest
      }
    }
    pendingCalls = { ...pendingCalls, [event.data.callId]: { name: event.data.name } }
  }
  return pendingCalls === state.pendingCalls ? state : { ...state, pendingCalls }
}

function settleResult(state: ForensicsState, event: SessionEvent<'tool/result'>): ForensicsState {
  const block = event.data.message.content[0]
  const text = block.content.filter(part => part.type === 'text').map(part => part.text).join('')
  const callId = block.toolCallId
  const toolName = state.pendingCalls[callId]?.name

  // Drop the settled identity first: every return path below closes the call.
  let pendingCalls = state.pendingCalls
  if (callId in pendingCalls) {
    const { [callId]: _settled, ...rest } = pendingCalls
    pendingCalls = rest
  }

  const base = {
    seq: event.seq,
    time: event.time,
    turn: event.data.turn,
    ...(toolName === undefined ? {} : { tool: toolName }),
  }

  const errorCode = event.data.error?.code
  if (errorCode === 'TOOL_TIMEOUT') {
    return pushEntry(
      { ...state, pendingCalls },
      {
        ...base,
        kind: 'tool-timeout',
        message: head(`Tool "${toolName}" timed out`, MESSAGE_MAX_CHARS),
        code: 'TOOL_TIMEOUT',
        ...(text === '' ? {} : { outputTail: tail(text, OUTPUT_TAIL_CHARS) }),
      },
    )
  }
  if (block.isError === true || event.data.error !== undefined) {
    const first = firstLine(text)
    return pushEntry(
      { ...state, pendingCalls },
      {
        ...base,
        kind: 'tool-error',
        message: head(first === '' ? `Tool "${toolName}" failed` : first, MESSAGE_MAX_CHARS),
        code: errorCode ?? null,
        ...(text === '' ? {} : { outputTail: tail(text, OUTPUT_TAIL_CHARS) }),
      },
    )
  }
  const killed = /killed by signal:\s*([^\]\s]+)/.exec(text)
  if (killed !== null) {
    const signal = killed[1]
    return pushEntry(
      { ...state, pendingCalls },
      {
        ...base,
        kind: 'command-killed',
        message: head(`Command killed by signal ${signal ?? ''}`, MESSAGE_MAX_CHARS),
        code: null,
        ...(signal === undefined ? {} : { exit: signal }),
        outputTail: tail(text, OUTPUT_TAIL_CHARS),
      },
    )
  }
  return pendingCalls === state.pendingCalls ? state : { ...state, pendingCalls }
}

function pushEntry(state: ForensicsState, raw: Omit<FailureEntry, 'suggestedFix'> & { code: string | null }): ForensicsState {
  const entry: FailureEntry = { ...raw, suggestedFix: suggestFix(raw.kind, raw.code) }
  const entries = [...state.entries, entry].slice(-FAILURE_WINDOW)
  return { ...state, entries }
}

function firstLine(value: string): string {
  const line = value.split('\n', 1)[0] ?? ''
  return line.length > 0 ? line : value.trim()
}

function head(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}${ELLIPSIS}`
}

function tail(value: string, max: number): string {
  return value.length <= max ? value : `${ELLIPSIS}${value.slice(-max)}`
}
