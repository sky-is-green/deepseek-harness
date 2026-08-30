/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-host-resource-monitor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-resource-monitor'

export const name = 'dsh-host-resource-monitor-invariant'
export const inject = ['invariants']

/** No runtime invariant: stateless reclaim check, no durable stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
