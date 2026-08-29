/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-client-ui-plugin-browser/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-plugin-browser'

export const name = 'dsh-client-ui-plugin-browser-invariant'
export const inject = ['invariants']

/** No runtime invariant: browser view over host bundle data, no durable stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
