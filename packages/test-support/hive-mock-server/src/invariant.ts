/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-hive-mock-server`.
 * @module @deepseek-ai/dsh-hive-mock-server/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-hive-mock-server'

/** Cordis companion plugin name. */
export const name = 'hive-mock-server-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this standalone test stub owns no Cordis event stream
 * or shared data; its wire behavior is exercised through direct HTTP tests
 * byte-matching the `dsh-hive` SidecarClient shapes.
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
