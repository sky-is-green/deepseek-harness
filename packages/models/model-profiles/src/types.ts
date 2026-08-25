/**
 * Vocabulary for per-model serving profiles (`ctx.modelProfiles`). Types only
 * — runtime code lives in `index.ts` and `resolve.ts`.
 * @module
 */

/** Saved sampling overrides for one model. Absent fields inherit the backend's own default. */
export interface ModelSamplingParams {
  readonly temperature?: number
  readonly topP?: number
  readonly topK?: number
  readonly minP?: number
  readonly repeatPenalty?: number
  readonly presencePenalty?: number
  readonly frequencyPenalty?: number
  /** Generation ceiling applied when a request carries no limit of its own. */
  readonly maxTokens?: number
}

/** One model's saved profile: sampling overrides plus serve-time defaults. */
export interface ModelProfile {
  readonly sampling?: ModelSamplingParams
  /** Default system prompt used when a request supplies none. */
  readonly systemPrompt?: string
  /** Serve-time context length applied at load when the request omits one. */
  readonly contextLength?: number
}

/**
 * Stored section shape: catalog model id (the string form of a branded
 * `LocalModelId`) to its profile.
 */
export type ModelProfileMap = Record<string, ModelProfile>

/**
 * A sparse profile patch for {@link ModelProfiles.save}. Present fields merge
 * into the saved profile (objects deep-merge); absent fields keep their saved
 * value.
 */
export type ModelProfilePatch = ModelProfile
