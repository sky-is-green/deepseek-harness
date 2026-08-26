/**
 * Function plugin registering the `liveTurnMetrics` projection unit: the most
 * recent assistant step's live time-to-first-token and decode-throughput
 * readout folded from step boundaries, token-delta chunks, and assembled
 * messages, served through the session-projection seam so a composer-beside
 * renderer updates while tokens stream.
 *
 * @module @deepseek-ai/dsh-session-live-turn-metrics
 */

import type { Context } from '@deepseek-ai/cordis'
import { liveTurnMetricsProjectionDefinition } from './projection.ts'

export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'live-turn-metrics'
/** The projection registry is the plugin's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

/**
 * Register the `liveTurnMetrics` unit; the registration is an effect on this
 * plugin's fiber, so unloading removes the key.
 * @param ctx - registrant context carrying the projection registry.
 */
export function apply(ctx: Context): void {
  ctx.sessionProjections.register(liveTurnMetricsProjectionDefinition)
}
