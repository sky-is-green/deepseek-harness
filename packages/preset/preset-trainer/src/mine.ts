/**
 * Runner that feeds the evidence fold from the session-query seam: read-only
 * over whatever store the mounted engine serves. No plugin body — callers
 * (the bin, tests, later trainer stages) compose the engine themselves.
 * @module mine
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { EvidenceReport } from './types.ts'
import { collectEvidence } from './evidence.ts'

/**
 * Mine every session the context's `sessionQuery` engine can see.
 *
 * Reads are one `listSessions` pass plus a `readSession` per record — the
 * same replay-validated path the Gateway serves — so the report is a pure
 * function of the durable logs.
 * @param ctx - context carrying a `sessionQuery` service.
 * @returns the per-preset evidence report.
 */
export async function mineEvidence(ctx: Context): Promise<EvidenceReport> {
  const engine = ctx.sessionQuery
  const records = await engine.listSessions()
  const snapshots: SessionLogSnapshot[] = []
  for (const record of records) {
    snapshots.push(await engine.readSession(record.header.id))
  }
  return collectEvidence(snapshots)
}
