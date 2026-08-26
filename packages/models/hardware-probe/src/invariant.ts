/** Package-owned invariant companion for the hardware probe. @module @deepseek-ai/dsh-hardware-probe/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-hardware-probe'

/** Cordis companion plugin name. */
export const name = 'hardware-probe-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: stateless detection over injected host seams returns a fresh value per call — no services or events to relate. */
const install: InvariantInstaller = () => {}

/**
 * Register the hardware probe invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
