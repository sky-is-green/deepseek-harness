/**
 * Package-owned invariant companion for @deepseek-ai/dsh-command-kill.
 * @module @deepseek-ai/dsh-command-kill/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-command-kill'

/** Cordis companion plugin name. */
export const name = 'command-kill-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin contributes one `/kill` command that fans
 * out to the agents, jobs, terminals, and models services and owns no event
 * stream or cross-plugin mutable state; each fanned-out service keeps its own
 * invariant companion.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))








