/**
 * Per-model serving profiles (`ctx.modelProfiles`): saved sampling params, a
 * default system prompt, and a default serve-time context length keyed by
 * catalog model id. One settings namespace is the storage of record; reads
 * fall back to an empty composition entry when no settings provider is
 * mounted, while writes fail loud because they would otherwise be lost.
 * @module @deepseek-ai/dsh-model-profiles
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ModelLoadRequest } from '@deepseek-ai/dsh-models'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { resolveLoadRequest } from './resolve.ts'
import type { ModelProfile, ModelProfileMap, ModelProfilePatch } from './types.ts'

export type { ModelProfile, ModelProfileMap, ModelProfilePatch, ModelSamplingParams } from './types.ts'
export { effectiveSampling, resolveLoadRequest } from './resolve.ts'

/** Settings namespace carrying the per-model profile map. */
export const MODEL_PROFILES_SETTINGS_NAMESPACE = settingsNamespace('model-profiles')

/** Schema for one model's saved profile. Field presence is optional; ranges are the validate hook's job. */
export const MODEL_PROFILE_SCHEMA: z<ModelProfile> = z.object({
  sampling: z.object({
    temperature: z.number(),
    topP: z.number(),
    topK: z.number(),
    minP: z.number(),
    repeatPenalty: z.number(),
    presencePenalty: z.number(),
    frequencyPenalty: z.number(),
    maxTokens: z.number(),
  }),
  systemPrompt: z.string(),
  contextLength: z.number(),
})

/** Schema of the stored section: model id to profile. */
export const MODEL_PROFILES_SETTINGS_SCHEMA: z<ModelProfileMap> = z.dict(MODEL_PROFILE_SCHEMA)

/**
 * Reject a resolved profile map whose numbers are outside documented sanity
 * ranges. The schema alone cannot express per-field ranges here without
 * duplicating every bound into chainable calls this vendor build does not
 * expose; the hook runs at registration and on every write, so a bad value is
 * refused before anything persists.
 *
 * Ranges guard against typos and unit confusion, not policy: `temperature`
 * `[0, 2]`, `topP`/`minP` `(0, 1]` / `[0, 1]`, integer `topK >= 0` (0 disables),
 * `repeatPenalty` `[0, 4]`, presence/frequency penalties `[-2, 2]`, integer
 * `maxTokens >= 1`, integer `contextLength >= 256`.
 *
 * @param map - the resolved candidate section.
 * @throws RangeError naming the first offending field.
 */
export function validateModelProfileMap(map: ModelProfileMap): void {
  for (const [modelId, profile] of Object.entries(map)) {
    const where = `profile "${modelId}"`
    const s = profile.sampling ?? {}
    if (s.temperature !== undefined && (s.temperature < 0 || s.temperature > 2)) {
      throw new RangeError(`${where}.sampling.temperature must be within [0, 2], got ${s.temperature}`)
    }
    if (s.topP !== undefined && (s.topP <= 0 || s.topP > 1)) {
      throw new RangeError(`${where}.sampling.topP must be within (0, 1], got ${s.topP}`)
    }
    if (s.topK !== undefined && (!Number.isInteger(s.topK) || s.topK < 0)) {
      throw new RangeError(`${where}.sampling.topK must be a non-negative integer, got ${s.topK}`)
    }
    if (s.minP !== undefined && (s.minP < 0 || s.minP > 1)) {
      throw new RangeError(`${where}.sampling.minP must be within [0, 1], got ${s.minP}`)
    }
    if (s.repeatPenalty !== undefined && (s.repeatPenalty < 0 || s.repeatPenalty > 4)) {
      throw new RangeError(`${where}.sampling.repeatPenalty must be within [0, 4], got ${s.repeatPenalty}`)
    }
    if (s.presencePenalty !== undefined && (s.presencePenalty < -2 || s.presencePenalty > 2)) {
      throw new RangeError(`${where}.sampling.presencePenalty must be within [-2, 2], got ${s.presencePenalty}`)
    }
    if (s.frequencyPenalty !== undefined && (s.frequencyPenalty < -2 || s.frequencyPenalty > 2)) {
      throw new RangeError(`${where}.sampling.frequencyPenalty must be within [-2, 2], got ${s.frequencyPenalty}`)
    }
    if (s.maxTokens !== undefined && (!Number.isInteger(s.maxTokens) || s.maxTokens < 1)) {
      throw new RangeError(`${where}.sampling.maxTokens must be a positive integer, got ${s.maxTokens}`)
    }
    if (
      profile.contextLength !== undefined
      && (!Number.isInteger(profile.contextLength) || profile.contextLength < 256)
    ) {
      throw new RangeError(
        `${where}.contextLength must be an integer >= 256, got ${String(profile.contextLength)}`,
      )
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Saved per-model serving profiles. */
    modelProfiles: ModelProfiles
  }
}

/**
 * Owns the per-model profile section independently of any Host or transport.
 * Reads work with or without a settings provider (the composition entry, an
 * empty map by default); writes require one and fail loud otherwise, since a
 * silently dropped save would report success while losing the user's data.
 */
export class ModelProfiles extends Service {
  private source: () => ModelProfileMap

  constructor(ctx: Context) {
    super(ctx, 'modelProfiles')
    this.source = () => ({})
    installSettingsSection(ctx, MODEL_PROFILES_SETTINGS_NAMESPACE, MODEL_PROFILES_SETTINGS_SCHEMA, {}, {
      setSource: (current) => { this.source = current },
      // Every consumer reads through the source thunk, so no derived state needs re-judging on commit.
      onChange: () => {},
      validate: validateModelProfileMap,
    })
  }

  /**
   * Read one model's saved profile.
   * @param modelId - the catalog model id.
   * @returns the saved profile, or `undefined` when nothing is saved for it.
   */
  profile(modelId: string): ModelProfile | undefined {
    return this.source()[modelId]
  }

  /**
   * Snapshot every saved profile.
   * @returns a detached, mutable copy of the current map.
   */
  all(): ModelProfileMap {
    return structuredClone(this.source())
  }

  /**
   * Deep-merge a patch into one model's saved profile and persist it. Objects
   * merge field-wise, so a sampling patch keeps sibling fields the caller did
   * not send.
   * @param modelId - the catalog model id to save under.
   * @param patch - the sparse profile fields to merge in.
   * @returns fulfillment after the write persists.
   * @throws when no settings provider is mounted, or the merged profile fails validation.
   */
  async save(modelId: string, patch: ModelProfilePatch): Promise<void> {
    const settings = this.ctx.get('settings')
    if (!settings) {
      throw new Error(`cannot save a profile for "${modelId}": no settings provider is mounted`)
    }
    await settings.update(MODEL_PROFILES_SETTINGS_NAMESPACE, { [modelId]: patch })
  }

  /**
   * Remove one model's saved profile entirely.
   * @param modelId - the catalog model id to forget.
   * @returns fulfillment after the write persists.
   * @throws when no settings provider is mounted.
   */
  async remove(modelId: string): Promise<void> {
    const settings = this.ctx.get('settings')
    if (!settings) {
      throw new Error(`cannot remove the profile for "${modelId}": no settings provider is mounted`)
    }
    await settings.mutate(MODEL_PROFILES_SETTINGS_NAMESPACE, [{ op: 'unset', path: [modelId] }])
  }

  /**
   * Fold the saved profile for {@link request.modelId} under an explicit load
   * request. The request wins wherever it speaks; see {@link resolveLoadRequest}.
   * @param request - the load request as issued by the caller.
   * @returns the request to hand to the hosting runtime.
   */
  applyToLoadRequest(request: ModelLoadRequest): ModelLoadRequest {
    return resolveLoadRequest(this.source(), request)
  }
}

export default ModelProfiles
