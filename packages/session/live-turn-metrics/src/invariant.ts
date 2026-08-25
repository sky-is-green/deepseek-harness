/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-session-live-turn-metrics`.
 * @module @deepseek-ai/dsh-session-live-turn-metrics/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-session-live-turn-metrics'

/** Cordis companion plugin name. */
export const name = 'live-turn-metrics-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package owns a single pure projection fold whose
 * wire payload is schema-validated by the projection registry at every
 * snapshot and change-feed emission, and the event relations the fold relies
 * on (`step/start` carrying step coordinates, `assistant/message` closing the
 * step it belongs to, usage records riding the assembled message) are owned
 * and runtime-checked by dsh-agent-loop and the session surface, not here.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
