/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-host-memory-browser/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-memory-browser'

export const name = 'dsh-host-memory-browser-invariant'
export const inject = ['invariants']

/** No runtime invariant: in-memory store, no durable stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
