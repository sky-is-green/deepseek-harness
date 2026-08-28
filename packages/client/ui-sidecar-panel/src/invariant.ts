/** Package-owned invariant companion. @module @deepseek-ai/dsh-ui-sidecar-panel/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-ui-sidecar-panel'

export const name = 'dsh-ui-sidecar-panel-invariant'
export const inject = ['invariants']

/** No runtime invariant yet: replace this reason with a real relation before shipping behavior. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
