/** Package-owned invariant companion. @module @deepseek-ai/dsh-sidecar-lifecycle/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-sidecar-lifecycle'

export const name = 'dsh-sidecar-lifecycle-invariant'
export const inject = ['invariants']

/**
 * No session event yet; the companion reserves the package name and proves
 * disposal via the HMR test, matching the pattern in
 * `packages/models/models-local/src/invariant.ts:1`.
 */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
