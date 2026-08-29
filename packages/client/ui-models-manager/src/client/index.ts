/**
 * Model manager v2 — client half.
 * One-click resume download + modelsDir picker (LM Studio default + fallback).
 * @module @deepseek-ai/dsh-client-ui-models-manager/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { FALLBACK_MODELS_DIR, lmStudioDefaultDir, pickerHint, resolveModelsDir } from './models-dir.ts'
import { createMemoryWriter, fetchToFileWithResume } from './fetch-resume.ts'

export { FALLBACK_MODELS_DIR, lmStudioDefaultDir, pickerHint, resolveModelsDir }
export { createMemoryWriter, fetchToFileWithResume }

/**
 * Required injections — locale for picker copy.
 */
export const inject = ['locale'] as const

/**
 * Register the manager. For now the panel is a settings affordance;
 * full cordis panel wiring arrives when the host models service ships.
 * @param ctx - client context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    // No slot registration yet — ships as a pure helper library.
    // The settings-models package will import and render the picker when ready.
    // Prove disposal via effect.
    return () => {}
  }, 'ui-models-manager: no-op effect')
}
