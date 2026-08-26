/**
 * Bounded one-line summary of any committed session event, for firehose rows.
 * Switches on the known event vocabulary and falls through unknown
 * (merge-extensible) types to a JSON head, so a foreign or newer log still
 * renders instead of dropping the row.
 * @module client/event-summary
 */

import type { ConversationMatch } from '@deepseek-ai/dsh-client-runtime/client'
import type { EpochHeader } from '@deepseek-ai/dsh-session/types'

/** Hard bound on one rendered summary, in UTF-16 code units. */
export const SUMMARY_MAX_CHARS = 120

const ELLIPSIS = '…'

type Event = ConversationMatch['event']

/**
 * Project one committed event onto a single bounded summary line.
 * @param event - the exact durable event.
 * @returns the one-line payload summary; empty for envelope-only events.
 */
export function eventSummary(event: Event): string {
  const value = switchSummary(event)
  return value.length <= SUMMARY_MAX_CHARS ? value : `${value.slice(0, SUMMARY_MAX_CHARS)}${ELLIPSIS}`
}

function switchSummary(event: Event): string {
  switch (event.type) {
    case 'turn/start':
      return `turn ${event.data.turn}`
    case 'turn/end':
      return `turn ${event.data.turn} · ${endReason(event.data.reason)}`
    case 'step/start':
      return `T${event.data.turn}.S${event.data.step}`
    case 'step/end':
      return `T${event.data.turn}.S${event.data.step}`
    case 'user/message': {
      const kind: unknown = event.data.source.kind
      return `source ${typeof kind === 'string' ? kind : 'user'}`
    }
    case 'assistant/message': {
      const usage = event.data.usage
      return usage === undefined
        ? 'no usage'
        : `in ${usage.inputTokens} · out ${usage.outputTokens}`
    }
    case 'assistant/chunk': {
      const chunk = event.data.chunk
      if (chunk.type === 'text-delta') return `Δ "${head(chunk.text, 40)}"`
      if (chunk.type === 'finish') return `finish ${chunk.reason.kind}`
      return chunk.type
    }
    case 'request/header':
      return `${event.data.reason === 'initial' ? 'hdr·init' : `hdr·${event.data.reason}`} ${modelLabel(event.data.header)}`
    case 'tool/call':
      return `${event.data.name}(${head(event.data.arguments, 60)})`
    case 'tool/result': {
      if (event.data.error !== undefined) return `error ${event.data.error.code}`
      const block = event.data.message.content[0]
      return block.isError === true ? 'isError' : 'ok'
    }
    default:
      // Merge-extensible event map: an unknown or newer event degrades to a
      // JSON-head summary instead of disappearing from the ledger.
      return head(JSON.stringify(event.data), SUMMARY_MAX_CHARS)
  }
}

/** Render one turn-end reason; error reasons carry a bounded failure message. */
function endReason(reason: { kind: string; error?: { message: string } }): string {
  return reason.kind === 'error' && reason.error !== undefined
    ? `error: ${head(reason.error.message, 60)}`
    : reason.kind
}

/** The model id of a request envelope, or an empty placeholder before any request. */
function modelLabel(header: EpochHeader | undefined): string {
  return header?.config.model ?? ''
}

function head(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}${ELLIPSIS}`
}
