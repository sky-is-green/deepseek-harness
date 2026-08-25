/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-models-manager`.
 * @module @deepseek-ai/dsh-client-ui-models-manager/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-models-manager'

/** Cordis companion plugin name. */
export const name = 'client-ui-models-manager-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a settings-section registration that mirrors the
 * `ctx.models` event stream into a local read-model — the load-state
 * transition grammar is owned and enforced by the dsh-models invariant
 * companion, and this surface only renders it; disposal is proven by the
 * HMR-safety spec.
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
