/**
 * Package-owned invariant companion.
 * @module @deepseek-ai/dsh-client-ui-preset-editor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-preset-editor'

export const name = 'dsh-client-ui-preset-editor-invariant'
export const inject = ['invariants']

/** No runtime invariant: browser editor, no durable stream. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
