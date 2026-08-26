/** Package-owned invariant companion for the inbound OpenAI endpoint. @module @deepseek-ai/dsh-host-openai-endpoint/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-openai-endpoint'

/** Cordis companion plugin name. */
export const name = 'openai-endpoint-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: handlers re-read authoritative services per request; no cross-event grammar or durable relation to assert. */
const install: InvariantInstaller = () => {}

/**
 * Register the inbound OpenAI endpoint invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
