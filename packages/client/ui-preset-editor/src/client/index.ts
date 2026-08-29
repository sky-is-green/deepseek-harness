/**
 * Preset/persona editor — client half.
 * @module @deepseek-ai/dsh-client-ui-preset-editor/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { applyPatch, draftSummary, validatePersona, validateSections } from './editor.ts'

export { applyPatch, draftSummary, validatePersona, validateSections }
export type { PersonaDraft, PresetPatch } from './editor.ts'

export const inject = ['locale'] as const

/**
 * Register the editor. Pure helpers for now; slot wiring deferred.
 * @param ctx - client context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    return () => {}
  }, 'ui-preset-editor: no-op effect')
}
