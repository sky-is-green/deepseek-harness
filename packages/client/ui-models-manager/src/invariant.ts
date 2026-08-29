/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-client-ui-models-manager/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-models-manager'

export const name = 'dsh-client-ui-models-manager-invariant'
export const inject = ['invariants']

/** No runtime invariant: browser settings surface owns no durable event stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
