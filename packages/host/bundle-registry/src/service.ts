/**
 * Host service face for the registry — thin Cordis wrapper over pure helpers.
 * @module @deepseek-ai/dsh-host-bundle-registry/service
 */
import type { Context } from '@deepseek-ai/cordis'
import { getBundleClosure, listProfiles, readProfileManifest } from './registry.ts'

export const name = 'bundleRegistry'
export const inject = [] as const

/**
 * Host plugin — registers the bundleRegistry service.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const registry = {
      listProfiles,
      readProfileManifest,
      getBundleClosure,
    }
    return ctx.provide(name, registry)
  }, 'bundle-registry service')
}
