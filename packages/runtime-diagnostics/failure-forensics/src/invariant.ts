/** Package-owned invariant companion. @module @deepseek-ai/dsh-failure-forensics/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-failure-forensics'

/** Cordis companion plugin name. */
export const name = 'failure-forensics-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the fold is a pure function over events the session
 * core already validates at append time, its bounds are structural constants
 * of the wire shape, and the registry schema-validates every view it serves.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
