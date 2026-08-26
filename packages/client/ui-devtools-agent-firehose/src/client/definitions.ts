/**
 * The catch-all firehose Definition: one context per committed event seq, so
 * every durable event in the loaded window reaches the `agent-firehose` view
 * target regardless of which business Definitions also matched it. Streaming
 * chunk rows publish at animation cadence so a token flood cannot thrash the
 * render loop.
 * @module client/definitions
 */

import type { Context } from '@deepseek-ai/cordis'
import type {
  ConversationMatch, ConversationNodeContext, ConversationNodeDefinition,
  ConversationPublication,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  FirehoseConversationViewNode, FirehoseEventRow,
} from './contract.ts'
import { eventSummary } from './event-summary.ts'

function firehoseNode(
  context: ConversationNodeContext,
  row: FirehoseEventRow,
): FirehoseConversationViewNode {
  return {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: 'agent-firehose',
    anchorSeq: row.seq,
    location: row.location,
    data: { kind: 'event', row },
  }
}

/** Chunk floods ride the frame budget; every other event publishes immediately. */
function publicationFor(match: ConversationMatch): ConversationPublication {
  return match.event.type === 'assistant/chunk' ? 'animation-frame' : 'immediate'
}

const agentFirehoseEventDefinition: ConversationNodeDefinition<FirehoseEventRow> = {
  kind: 'agent-firehose-event',
  target: 'agent-firehose',
  match: event => ({ id: String(event.seq), role: 'start' as const }),
  publication: publicationFor,
  start: (_context, match) => {
    const callId = callIdOf(match.event)
    const step = stepOf(match.event)
    return {
      seq: match.event.seq,
      time: match.event.time,
      type: match.event.type,
      summary: eventSummary(match.event),
      ...(callId === undefined ? {} : { callId }),
      ...(step === undefined ? {} : { step }),
      location: match.location,
    }
  },
  update: context => context.state,
  buildViewNode: context => context.state === undefined
    ? null
    : firehoseNode(context, context.state),
}

/** The opening/closing step identity of a step boundary event, when present. */
function stepOf(event: ConversationMatch['event']): { turn: number; step: number } | undefined {
  if (event.type !== 'step/start' && event.type !== 'step/end') return undefined
  return { turn: event.data.turn, step: event.data.step }
}

/** The correlation id pairing one tool/call with its tool/result, when present. */
function callIdOf(event: ConversationMatch['event']): string | undefined {
  if (event.type === 'tool/call') return event.data.callId
  if (event.type === 'tool/result') {
    return event.data.message.content[0].toolCallId
  }
  return undefined
}

/**
 * Register the catch-all firehose Definition on the conversation registry.
 * @param ctx - Plugin context receiving the Definition.
 */
export function registerAgentFirehoseDefinition(ctx: Context): void {
  ctx.conversationEvents.register(agentFirehoseEventDefinition)
}
