/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-ui-sidecar-panel/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-ui-sidecar-panel'

export const name = 'dsh-ui-sidecar-panel-invariant'
export const inject = ['invariants']

/** No runtime invariant: browser-surface host half owns no durable event stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
