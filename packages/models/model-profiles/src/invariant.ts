/** Package-owned invariant companion. @module @deepseek-ai/dsh-model-profiles/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-model-profiles'

export const name = 'dsh-model-profiles-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: the service owns no events and no state beyond its
 * settings namespace, and resolution is total pure functions over a map the
 * registered schema plus range validation admit at write time.
 */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
