/** Package-owned invariant companion for the GGUF metadata reader. @module @deepseek-ai/dsh-gguf-metadata/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gguf-metadata'

/** Cordis companion plugin name. */
export const name = 'gguf-metadata-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: stateless pure parser over caller-provided bytes — no services, events, or retained state to relate. */
const install: InvariantInstaller = () => {}

/**
 * Register the GGUF metadata invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
