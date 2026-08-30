/**
 * Engine selector seam — adds `engine` Config to choose host backend.
 * Windows Vulkan is the quick default; Linux ROCm+Docker+VHDX is the large-model tier.
 * Every misconfiguration or unavailable backend fails loud with an actionable fix, never silently falls back.
 * @module @deepseek-ai/dsh-models-engine-selector
 */

export type { EngineKind, Config, EngineFailureReason } from './selector.ts'
export { DEFAULT_ENGINE, resolveEngine, describeEngineFailure, isLinuxEngine } from './selector.ts'
export { name, inject, apply } from './invariant.ts'
