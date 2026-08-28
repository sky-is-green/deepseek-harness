/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-kill-switch`.
 * @module @deepseek-ai/dsh-client-ui-kill-switch/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-kill-switch'

/** Cordis companion plugin name. */
export const name = 'client-ui-kill-switch-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a single command contribution whose action fans out
 * to the runtime's per-session `session.cancel` RPC (its acceptance and
 * quiescence semantics are owned and tested by dsh-client-runtime and the
 * Host apiproxy) behind the shared popup shell's confirmation gate — it
 * emits no cordis events and owns no cross-plugin mutable state; disposal is
 * proven by the HMR-safety spec.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
