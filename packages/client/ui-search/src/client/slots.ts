/**
 * The global search dialog's injected face: plain data and callbacks bound
 * to the apply closure's `sessions` service (runtime contract: the search
 * RPC is request-local; the list snapshot stays the metadata authority).
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** One joined search hit: the wire snippet plus list-snapshot metadata. */
export interface SearchHit {
  readonly sessionId: SessionId
  /** The listed session's display title, or the raw id when unlisted. */
  readonly title: string
  readonly snippet: string
  /** Whether the hit is in the live list and therefore navigable (`sessions.open`). */
  readonly openable: boolean
}

/** Injected business face of the shell-overlay search dialog. */
export interface SearchInjected {
  /** Whether any session exists to search within. */
  available: boolean
  /**
   * Run one cross-session search.
   * @param query - the trimmed query (1..500 chars per the wire schema).
   * @param signal - cancels the in-flight request when superseded or closed.
   * @returns joined hits in served order plus the wire `hasMore` bound note.
   */
  searchSessions(query: string, signal: AbortSignal): Promise<{ readonly hits: readonly SearchHit[]; readonly hasMore: boolean }>
  /**
   * Open one listed session.
   * @param sessionId - a hit whose `openable` was true.
   */
  openSession(sessionId: SessionId): void
}
