import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { SettingsTransfer, TransferFormatError } from '../src/index.ts'

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
    this.doc[String(ns)] = structuredClone(section)
    return Promise.resolve()
  }
}

const ACCENT_SCHEMA: z<{ accent: string }> = z.object({ accent: z.string() })
const ACCENT_NS = settingsNamespace('transfer-accent')

async function boot(doc?: Record<string, unknown>): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(MemorySettings, doc === undefined ? {} : { doc })
  ctx.settings.register(ACCENT_NS, ACCENT_SCHEMA)
  await ctx.plugin(SettingsTransfer)
  return ctx
}

async function makeUserRoot(presets: Array<{ id: string; content: string }>): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), 's9-')), '.agent-presets')
  await mkdir(root, { recursive: true })
  for (const p of presets) {
    const dir = join(root, p.id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'agent.cordis.yml'), p.content, 'utf8')
  }
  return root
}

describe('export', () => {
  it('captures only namespaces with a stored user section', async () => {
    const ctx = await boot({ 'transfer-accent': { accent: 'teal' } })
    expect(ctx.settingsTransfer.exportSettings()).toEqual({ 'transfer-accent': { accent: 'teal' } })
  })

  it('returns an empty map when nothing is stored', async () => {
    const ctx = await boot()
    expect(ctx.settingsTransfer.exportSettings()).toEqual({})
  })

  it('exports user-root presets and excludes system roots', async () => {
    const ctx = await boot()
    const user = await makeUserRoot([{ id: 'mine', content: 'plugins:\n  - tools\n' }])
    const system = join(await mkdtemp(join(tmpdir(), 's9-sys-')), 'presets')
    await mkdir(system, { recursive: true })
    const roots = [
      { path: system, trust: 'system' as const },
      { path: user, trust: 'user' as const },
    ]
    const presets = await ctx.settingsTransfer.exportUserPresets(roots)
    expect(presets).toHaveLength(1)
    expect(presets[0]?.id).toBe('mine')
    expect(Object.keys(presets[0]?.files ?? {})).toContain('agent.cordis.yml')
  })
})

describe('bundle round trip', () => {
  it('writes, reads back, and applies to the registered namespace', async () => {
    const ctx = await boot()
    const dir = await mkdtemp(join(tmpdir(), 's9-bundle-'))
    const file = join(dir, 'bundle.json')
    const transfer = ctx.settingsTransfer
    const bundle = await transfer.buildBundle()
    await transfer.writeBundle(bundle, file)
    const read = await transfer.readBundle(file)
    expect(read.formatVersion).toBe(1)

    const scope = ctx.settings.register(settingsNamespace('transfer-extra'), z.object({ flag: z.boolean() }))
    const report = await transfer.importBundle({
      formatVersion: 1,
      exportedAt: '2026-08-25T00:00:00.000Z',
      settings: { 'transfer-accent': { accent: 'red' }, 'never-registered': { x: 1 } },
      presets: [],
    })
    void scope
    expect(report.appliedNamespaces).toEqual(['transfer-accent'])
    expect(report.skippedNamespaces[0]?.ns).toBe('never-registered')
  })

  it('rejects future bundle versions and broken JSON with TransferFormatError', async () => {
    const ctx = await boot()
    const dir = await mkdtemp(join(tmpdir(), 's9-bad-'))
    const bad = join(dir, 'bad.json')
    await writeFile(bad, '{"formatVersion": 2, "settings": {}, "presets": []}', 'utf8')
    await expect(ctx.settingsTransfer.readBundle(bad)).rejects.toThrow(TransferFormatError)
    const worse = join(dir, 'worse.json')
    await writeFile(worse, '{not json', 'utf8')
    await expect(ctx.settingsTransfer.readBundle(worse)).rejects.toThrow(TransferFormatError)
  })
})

describe('import', () => {
  it('reports every namespace skipped when no provider is mounted', async () => {
    const ctx = new Context()
    await ctx.plugin(SettingsTransfer)
    const report = await ctx.settingsTransfer.importBundle({
      formatVersion: 1, exportedAt: 'x', settings: { a: {} }, presets: [],
    })
    expect(report.appliedNamespaces).toEqual([])
    expect(report.skippedNamespaces[0]?.reason).toMatch(/no settings provider/)
  })

  it('validates the applied section through the owner schema before persisting', async () => {
    const ctx = await boot()
    const provider = ctx.get('settings') as MemorySettings
    const report = await ctx.settingsTransfer.importBundle({
      formatVersion: 1, exportedAt: 'x',
      settings: { 'transfer-accent': { accent: 42 } },
      presets: [],
    })
    expect(report.appliedNamespaces).toEqual([])
    expect(provider.doc['transfer-accent']).toBeUndefined()
  })

  it('imports presets into the bound user root with skip/overwrite semantics', async () => {
    const ctx = await boot()
    const root = join(await mkdtemp(join(tmpdir(), 's9-import-')), '.agent-presets')
    await mkdir(root, { recursive: true })
    await mkdir(join(root, 'existing'), { recursive: true })
    ctx.settingsTransfer.bindPresetRoots([{ path: root, trust: 'user' }])

    const bundle = {
      formatVersion: 1 as const,
      exportedAt: 'x',
      settings: {},
      presets: [
        { id: 'fresh', files: { 'agent.cordis.yml': 'plugins: []\n' } },
        { id: 'existing', files: { 'agent.cordis.yml': 'plugins: []\n' } },
        { id: 'Bad_Id', files: { 'agent.cordis.yml': 'x\n' } },
        { id: 'escaper', files: { '../escape.yml': 'x\n' } },
      ],
    }
    const report = await ctx.settingsTransfer.importBundle(bundle)
    expect(report.writtenPresets).toEqual(['fresh'])
    expect(report.skippedPresets.map(s => s.id)).toEqual(['existing', 'Bad_Id', 'escaper'])
    expect(await readFile(join(root, 'fresh', 'agent.cordis.yml'), 'utf8')).toBe('plugins: []\n')

    const overwrite = await ctx.settingsTransfer.importBundle(bundle, { overwritePresets: true })
    expect(overwrite.writtenPresets).toEqual(['fresh', 'existing'])
    let escapeExists = false
    try {
      await readFile(join(root, 'escape.yml'), 'utf8')
      escapeExists = true
    } catch { /* absent is the expected outcome */ }
    expect(escapeExists).toBe(false)
  })

  it('skips the presets slice with a reason when no roots are bound', async () => {
    const ctx = await boot()
    const report = await ctx.settingsTransfer.importBundle({
      formatVersion: 1, exportedAt: 'x', settings: {},
      presets: [{ id: 'p', files: { 'agent.cordis.yml': 'x\n' } }],
    })
    expect(report.skippedPresets[0]?.id).toBe('*')
    expect(report.skippedPresets[0]?.reason).toMatch(/no preset roots/)
  })
})
