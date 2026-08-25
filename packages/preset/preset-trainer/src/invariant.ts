/** Package-owned invariant companion. @module @deepseek-ai/dsh-preset-trainer/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-preset-trainer'

/** Cordis companion plugin name. */
export const name = 'dsh-preset-trainer-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package is a read-only library over logs other
 * packages already validate — pure folds plus a runner that reads through
 * the replay-validated `readSession` path of the query engine.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
