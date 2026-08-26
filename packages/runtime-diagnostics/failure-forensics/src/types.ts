/**
 * Client-safe failure-forensics vocabulary: one bounded entry per captured
 * failure signal, plus the suggested-fix string the fold derives from it.
 * @module types
 */

/** The durable signal a forensic entry was folded from. */
export type FailureEntryKind =
  | 'model-error'
  | 'model-retry'
  | 'tool-timeout'
  | 'tool-error'
  | 'command-killed'
  | 'compaction'

/**
 * One captured failure. Every field is projected from durable events only,
 * so replaying a log rebuilds identical entries.
 */
export interface FailureEntry {
  /** Which durable signal produced this entry. */
  readonly kind: FailureEntryKind
  /** Sequence of the event that closed the entry. */
  readonly seq: number
  /** Unix epoch ms of the closing event. */
  readonly time: number
  /** Turn the failure belongs to; null for turn-less compaction attempts. */
  readonly turn: number | null
  /** Human-readable failure message, bounded. */
  readonly message: string
  /** Machine code when the signal carries one (provider status code, error code). */
  readonly code: string | null
  /** Tool name for tool-derived entries; absent otherwise. */
  readonly tool?: string
  /** Exit code or signal text for killed command entries; absent otherwise. */
  readonly exit?: string
  /** Bounded tail of the model-facing output text for tool-derived entries. */
  readonly outputTail?: string
  /** Provider request id for model-derived entries, when reported. */
  readonly requestId?: string
  /** Deterministic first-response hint for this failure kind; null when none applies. */
  readonly suggestedFix: string | null
}

/** The client-visible projection value: the most recent failures, oldest first. */
export interface FailureForensicsView {
  /** Bounded list of captured failures in capture order (oldest first). */
  readonly entries: readonly FailureEntry[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * Most recent durable failures with deterministic fix hints; a devtools
     * surface over signals other packages already logged.
     */
    failureForensics: FailureForensicsView
  }
}
