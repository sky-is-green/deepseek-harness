/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-models-engine-selector/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-models-engine-selector'

export const name = 'dsh-models-engine-selector-invariant'
export const inject = ['invariants']

/** No runtime invariant: pure Config validation, no durable event stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
