/**
 * Host bundle registry read face.
 * Profile manifests + bundle closure — read-only, no side effects.
 * @module @deepseek-ai/dsh-host-bundle-registry
 */

export { getBundleClosure, listProfiles, readProfileManifest } from './registry.ts'
export type { BundleClosure, ProfileManifest } from './registry.ts'
export { name, inject, apply } from './service.ts'
