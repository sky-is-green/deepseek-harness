/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-client-ui-setup-wizard/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-setup-wizard'

export const name = 'dsh-client-ui-setup-wizard-invariant'
export const inject = ['invariants']

/** No runtime invariant: wizard is pure UI, no durable stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
