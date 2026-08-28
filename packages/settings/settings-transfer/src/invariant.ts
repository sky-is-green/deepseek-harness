/** Package-owned invariant companion. @module @deepseek-ai/dsh-settings-transfer/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-settings-transfer'

export const name = 'dsh-settings-transfer-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: the service owns no events and no state; export/import are total
 * transforms over the mounted settings provider and preset roots, and every write is
 * re-validated by its registered owner before persisting.
 */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
