/**
 * Plugin browser — client half.
 * Discover/installable view over bundle registry closure.
 * @module @deepseek-ai/dsh-client-ui-plugin-browser/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { closureToEntries, filterPlugins, groupPlugins } from './browser.ts'

export { closureToEntries, filterPlugins, groupPlugins }
export type { BrowserState, PluginEntry } from './browser.ts'

export const inject = ['locale'] as const

/**
 * Register the browser. For now the view is pure helpers;
 * full slot wiring arrives when the host bundleRegistry is available.
 * @param ctx - client context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    return () => {}
  }, 'ui-plugin-browser: no-op effect')
}
