/** Package-owned invariant companion for the local model provider. @module @deepseek-ai/dsh-models-local/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-models-local'

/** Cordis companion plugin name. */
export const name = 'models-local-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: emissions ride the dsh-models grammar companion; process ownership adds no cross-event relation to check. */
const install: InvariantInstaller = () => {}

/**
 * Register the models-local invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
