/**
 * Process manager panel — client half.
 * @module @deepseek-ai/dsh-client-ui-process-panel/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { canKill, filterProcesses, formatResources, killProcess } from './process.ts'

export { canKill, filterProcesses, formatResources, killProcess }
export type { ProcessEntry } from './process.ts'

export const inject = ['locale'] as const

/**
 * Register the panel. Pure helpers for now.
 * @param ctx - client context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    return () => {}
  }, 'ui-process-panel: no-op effect')
}
