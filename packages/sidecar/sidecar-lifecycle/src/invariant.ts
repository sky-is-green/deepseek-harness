/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-sidecar-lifecycle/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-sidecar-lifecycle'

export const name = 'dsh-sidecar-lifecycle-invariant'
export const inject = ['invariants']

/** No runtime invariant: lifecycle is process-local, no durable event stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
