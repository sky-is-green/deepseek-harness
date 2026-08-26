/** Package-owned invariant companion for the download engine. @module @deepseek-ai/dsh-model-downloads/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-model-downloads'

/** Cordis companion plugin name. */
export const name = 'model-downloads-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: stateless transfer engine over caller-provided URLs and paths — nothing retained to relate. */
const install: InvariantInstaller = () => {}

/**
 * Register the download-engine invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
