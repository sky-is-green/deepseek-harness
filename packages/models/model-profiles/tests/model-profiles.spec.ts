import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { localModelId } from '@deepseek-ai/dsh-models'
import {
  MODEL_PROFILES_SETTINGS_NAMESPACE,
  ModelProfiles,
  effectiveSampling,
  resolveLoadRequest,
} from '../src/index.ts'

/** A provider implementing only the three primitives, mirroring the settings suite's test double. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown>

  constructor(ctx: ConstructorParameters<typeof SettingsProvider>[0], options?: { doc?: Record<string, unknown> }) {
    super(ctx)
    this.doc = structuredClone(options?.doc ?? {})
  }

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

async function boot(doc?: Record<string, unknown>): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(MemorySettings, doc === undefined ? {} : { doc })
  await ctx.plugin(ModelProfiles)
  return ctx
}

describe('save and read back', () => {
  it('persists a profile into the settings document', async () => {
    const ctx = await boot()
    const service = ctx.modelProfiles
    await service.save(localModelId('qwen3-8b'), {
      sampling: { temperature: 0.3, topK: 40 },
      contextLength: 8192,
    })
    expect(service.profile('qwen3-8b')).toEqual({
      sampling: { temperature: 0.3, topK: 40 },
      contextLength: 8192,
    })
    const provider = ctx.get('settings') as MemorySettings
    expect(provider.doc['model-profiles']).toEqual({
      'qwen3-8b': { sampling: { temperature: 0.3, topK: 40 }, contextLength: 8192 },
    })
  })

  it('deep-merges a sampling patch over saved sibling fields', async () => {
    const ctx = await boot()
    const service = ctx.modelProfiles
    await service.save('qwen3-8b', { sampling: { temperature: 0.3 } })
    await service.save('qwen3-8b', { sampling: { topP: 0.9 }, systemPrompt: 'be brief' })
    expect(service.profile('qwen3-8b')).toEqual({
      sampling: { temperature: 0.3, topP: 0.9 },
      systemPrompt: 'be brief',
    })
  })

  it('removes the whole profile', async () => {
    const ctx = await boot({ 'model-profiles': { m1: { contextLength: 512 } } })
    const service = ctx.modelProfiles
    expect(service.profile('m1')).toBeDefined()
    await service.remove('m1')
    expect(service.profile('m1')).toBeUndefined()
  })

  it('all() returns a detached copy', async () => {
    const ctx = await boot({ 'model-profiles': { m1: { contextLength: 512 } } })
    const snapshot = ctx.modelProfiles.all()
    snapshot['m1'].contextLength = 999
    expect(ctx.modelProfiles.profile('m1')?.contextLength).toBe(512)
  })
})

describe('load-request resolution', () => {
  it('lets an explicit request context length win', async () => {
    const ctx = await boot({ 'model-profiles': { m1: { contextLength: 16384 } } })
    const request = { modelId: localModelId('m1'), contextLength: 2048 }
    expect(ctx.modelProfiles.applyToLoadRequest(request)).toEqual(request)
  })

  it('fills the context length from the profile when the request omits one', async () => {
    const ctx = await boot({ 'model-profiles': { m1: { contextLength: 16384 } } })
    expect(ctx.modelProfiles.applyToLoadRequest({ modelId: localModelId('m1') }))
      .toEqual({ modelId: localModelId('m1'), contextLength: 16384 })
  })

  it('leaves requests untouched without a profile', async () => {
    const request = { modelId: localModelId('unknown') }
    expect(resolveLoadRequest({}, request)).toBe(request)
  })

  it('exposes saved sampling params for consumers that send them per request', async () => {
    const ctx = await boot({ 'model-profiles': { m1: { sampling: { temperature: 0.7 } } } })
    expect(effectiveSampling(ctx.modelProfiles.all(), 'm1')).toEqual({ temperature: 0.7 })
    expect(effectiveSampling(ctx.modelProfiles.all(), 'other')).toBeUndefined()
  })
})

describe('validation', () => {
  it('rejects an out-of-range value before anything persists', async () => {
    const ctx = await boot()
    const provider = ctx.get('settings') as MemorySettings
    await expect(ctx.modelProfiles.save('m1', { sampling: { temperature: 5 } }))
      .rejects.toThrow(RangeError)
    expect(provider.doc['model-profiles']).toBeUndefined()
  })

  it('rejects the registration for a malformed stored section but keeps the service on its composition entry', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings, { doc: { [MODEL_PROFILES_SETTINGS_NAMESPACE]: { m1: { systemPrompt: 42 } } } })
    // The registration is refused (the section cannot be resolved), while the
    // service itself stays mounted serving its composition entry, per the
    // settings seam's documented externally-edited-document behavior.
    const outcome = await ctx.plugin(ModelProfiles).then(
      fiber => ({ ok: true as const, fiber }),
      (error: unknown) => ({ ok: false as const, message: error instanceof Error ? error.message : String(error) }),
    )
    expect(outcome.ok).toBe(true)
    expect(ctx.modelProfiles.all()).toEqual({})
    expect(ctx.settings.describe().map(d => String(d.ns))).not.toContain('model-profiles')
  })

  it.each([
    [{ contextLength: 128 }, /contextLength/],
    [{ sampling: { maxTokens: 0 } }, /maxTokens/],
    [{ sampling: { topP: 1.5 } }, /topP/],
    [{ sampling: { presencePenalty: 9 } }, /presencePenalty/],
  ])('rejects %j with a named-range error', async (patch, pattern) => {
    const ctx = await boot()
    await expect(ctx.modelProfiles.save('m1', patch as never)).rejects.toThrow(pattern)
  })
})

describe('lifecycle', () => {
  it('falls back to an empty map and fails loud on writes without a settings provider', async () => {
    const ctx = new Context()
    await ctx.plugin(ModelProfiles)
    expect(ctx.modelProfiles.all()).toEqual({})
    await expect(ctx.modelProfiles.save('m1', {})).rejects.toThrow(/no settings provider/)
  })

  it('releases its settings registration on disposal so the namespace can re-register', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings)
    const first = ctx.plugin(ModelProfiles)
    await first
    expect(ctx.modelProfiles.profile('m1')).toBeUndefined()
    await first.dispose()
    // HMR safety: the disposed fiber must have released the namespace so a
    // replacement instance mounts cleanly instead of failing duplicate-namespace.
    const second = ctx.plugin(ModelProfiles)
    await second
    await second.dispose()
  })

  it('keeps serving reads from the stored document across a service replacement', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings, { doc: { 'model-profiles': { m1: { contextLength: 4096 } } } })
    const first = ctx.plugin(ModelProfiles)
    await first
    await first.dispose()
    const second = ctx.plugin(ModelProfiles)
    await second
    expect(ctx.modelProfiles.profile('m1')?.contextLength).toBe(4096)
  })
})
