/**
 * Pure profile-resolution functions over a {@link ModelProfileMap}. Total over
 * every input: an unknown model id behaves exactly like an empty profile.
 * @module
 */

import type { ModelLoadRequest } from '@deepseek-ai/dsh-models'
import type { ModelProfileMap, ModelSamplingParams } from './types.ts'

/**
 * Read one model's saved sampling overrides.
 * @param map - the resolved profile map.
 * @param modelId - the catalog model id.
 * @returns the saved sampling params, or `undefined` when none are saved.
 */
export function effectiveSampling(
  map: ModelProfileMap,
  modelId: string,
): ModelSamplingParams | undefined {
  return map[modelId]?.sampling
}

/**
 * Fold one model's saved profile under an explicit load request. The caller's
 * request is authoritative wherever it speaks: a request-supplied
 * `contextLength` always wins, and the profile fills only what the request
 * left unset (explicit over implicit at the boundary).
 * @param map - the resolved profile map.
 * @param request - the load request as issued by the caller.
 * @returns the request to hand to the hosting runtime; identical to the input
 * when no profile or no fillable field exists.
 */
export function resolveLoadRequest(
  map: ModelProfileMap,
  request: ModelLoadRequest,
): ModelLoadRequest {
  const profile = map[request.modelId]
  if (request.contextLength !== undefined || profile?.contextLength === undefined) {
    return request
  }
  return { ...request, contextLength: profile.contextLength }
}
