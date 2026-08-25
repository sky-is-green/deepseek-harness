/**
 * Agent-firehose snapshot vocabulary: the bounded rolling window of recent
 * session events plus the per-turn waterfall spans derived from them.
 * @module client/contract
 */

import type {
  ConversationLocation, ConversationViewNode,
} from '@deepseek-ai/dsh-client-runtime/client'

/** One committed session event rendered as a firehose row. */
export interface FirehoseEventRow {
  /** Sequence of the committed event. */
  readonly seq: number
  /** Unix epoch ms of the event. */
  readonly time: number
  /** Durable event type name. */
  readonly type: string
  /** Bounded one-line summary of the payload. */
  readonly summary: string
  /**
   * Tool-call correlation id for `tool/call` and `tool/result` rows; absent
   * on every other event type.
   */
  readonly callId?: string
  /** The opening/closing step identity on `step/start` and `step/end` rows. */
  readonly step?: { readonly turn: number; readonly step: number }
  /** Turn/step location the event was logged under; unresolved outside boundaries. */
  readonly location: ConversationLocation
}

/** One paired span in the waterfall, derived from two firehose rows. */
export interface FirehoseSpan {
  /** Span kind: one agent-loop step, or one tool call inside a step. */
  readonly kind: 'step' | 'tool'
  /** Step label (`T{turn}.S{step}`) or tool name for tool spans. */
  readonly label: string
  /** Turn the span belongs to; null when unresolvable from locations. */
  readonly turn: number | null
  /** Inclusive start time (epoch ms). */
  readonly startTime: number
  /** End time when the closing event has arrived; open spans render as running. */
  readonly endTime: number | null
  /** True when the span's closing event carries a failure (tool error result). */
  readonly failed: boolean
}

/** Per-turn waterfall assembled from paired boundary and call/result rows. */
export interface FirehoseTurnWaterfall {
  /** Turn number; null for events outside any turn. */
  readonly turn: number | null
  /** Turn start time (epoch ms); null when the opening row left the window. */
  readonly startTime: number | null
  /** Turn end time; null while the turn is running or its end left the window. */
  readonly endTime: number | null
  /** Step and tool spans inside the turn, in start order. */
  readonly spans: readonly FirehoseSpan[]
}

/** Assembled data consumed by the agent-firehose view. */
export interface AgentFirehoseSnapshot {
  /**
   * The most recent events in log order, capped at {@link FIREHOSE_WINDOW}
   * rows; older rows leave the window as new events arrive.
   */
  readonly rows: readonly FirehoseEventRow[]
  /** Waterfalls for the turns represented in the retained window. */
  readonly turns: readonly FirehoseTurnWaterfall[]
}

/** Contribution envelope produced by the firehose Definition. */
export type FirehoseContribution = { readonly kind: 'event'; readonly row: FirehoseEventRow }

/** Target envelope consumed by the firehose snapshot builder. */
export interface FirehoseConversationViewNode extends ConversationViewNode {
  readonly target: 'agent-firehose'
  readonly anchorSeq: number
  readonly location: ConversationLocation
  readonly data: FirehoseContribution
}

/** Rolling-window cap on retained firehose rows. */
export const FIREHOSE_WINDOW = 400

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationViewSnapshotMap {
    /** Independently assembled data consumed by the agent-firehose view. */
    'agent-firehose': AgentFirehoseSnapshot
  }
}
