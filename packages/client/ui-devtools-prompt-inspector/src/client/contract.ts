/**
 * Prompt-inspector snapshot vocabulary: the assembled-request rows and
 * producer-context rows the `prompt-inspector` view target serves.
 * @module client/contract
 */

import type {
  ConversationLocation, ConversationPromptSnapshot, ConversationViewNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ContextRole, KnownContextForm } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * One logged `request/header` rendered as an inspector row.
 *
 * The durable log records a header only when the effective envelope changes,
 * so agent-loop steps that inherit the previous header carry no row of their
 * own; each row is the complete model-visible request in force from its seq
 * until the next row.
 */
export interface InspectorHeaderRow {
  /** Sequence of the `request/header` event. */
  readonly seq: number
  /** Unix epoch ms of the event. */
  readonly time: number
  /** Complete request envelope in force from this row onward. */
  readonly prompt: ConversationPromptSnapshot
  /** True for the session's first header (nothing to differ from). */
  readonly initial: boolean
  /** True when this header's system text differs from the previous header's. */
  readonly systemChanged: boolean
  /** True when this header's tool catalog differs from the previous header's. */
  readonly toolsChanged: boolean
  /** Turn/step location the header was logged under; unresolved outside a step. */
  readonly location: ConversationLocation
}

/** One producer-supplied context message (`user/message` with a non-user source). */
export interface InspectorContextRow {
  /** Sequence of the `user/message` event. */
  readonly seq: number
  /** Unix epoch ms of the event. */
  readonly time: number
  /** Model-facing role the source plays (`inject` or `recall`). */
  readonly role: ContextRole
  /** Producer name read off the durable source; null when it carries none. */
  readonly label: string | null
  /** Producer-declared presentation form; null when absent or unknown to this UI. */
  readonly form: KnownContextForm | null
  /** Bounded plain-text preview of the message content. */
  readonly preview: string
}

/** Assembled data consumed by the prompt-inspector view. */
export interface PromptInspectorSnapshot {
  /** Request-header rows in log order. */
  readonly headers: readonly InspectorHeaderRow[]
  /** Producer-context rows in log order. */
  readonly contexts: readonly InspectorContextRow[]
}

/** One independently assembled contribution to the inspector snapshot. */
export type InspectorContribution =
  | { readonly kind: 'header'; readonly header: InspectorHeaderRow }
  | { readonly kind: 'context'; readonly context: InspectorContextRow }

/** Target envelope consumed by the inspector snapshot builder. */
export interface InspectorConversationViewNode extends ConversationViewNode {
  readonly target: 'prompt-inspector'
  readonly anchorSeq: number
  readonly location: ConversationLocation
  readonly data: InspectorContribution
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationViewSnapshotMap {
    /** Independently assembled data consumed by the prompt-inspector view. */
    'prompt-inspector': PromptInspectorSnapshot
  }
}
