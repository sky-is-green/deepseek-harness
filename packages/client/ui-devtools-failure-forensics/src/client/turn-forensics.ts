/**
 * Selection and presentation helpers for the turn-tail failure row: which
 * forensic entries belong to one closing turn, keyed purely off the owner
 * share so the chain's decline path stays a pure function.
 * @module client/turn-forensics
 */

import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FailureEntry, FailureForensicsView } from '@deepseek-ai/dsh-failure-forensics/client'

/** The selector result handed to the failure-detail component. */
export interface TurnForensicsMatched {
  /** The closing turn number. */
  readonly turn: number
}

/**
 * Chain selector: accept every turn; the component renders nothing when the
 * projection carries no entries for it. Declining here instead would re-run
 * per render with no access to reactive data — the projection read belongs
 * behind the hook boundary, not in the selector.
 * @param owner - the engine-owned closing turn identity.
 * @returns the matched turn for the component.
 */
export function selectTurnForensics(owner: TurnTailOwnerProps): TurnForensicsMatched {
  return { turn: owner.turn.turn }
}

/**
 * Pick this turn's entries, newest first. Retry entries precede their
 * terminal model error in capture order, so reversing surfaces the outcome
 * first.
 * @param view - the current `failureForensics` projection value, if any.
 * @param turn - the closing turn number.
 * @returns this turn's entries, newest first.
 */
export function entriesForTurn(
  view: FailureForensicsView | undefined,
  turn: number,
): readonly FailureEntry[] {
  const entries = view?.entries.filter(entry => entry.turn === turn) ?? []
  return [...entries].reverse()
}
