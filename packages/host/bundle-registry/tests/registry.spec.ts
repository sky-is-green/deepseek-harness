import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getBundleClosure, listProfiles, readProfileManifest } from '../src/registry.ts'

describe('bundle-registry read face', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bundle-registry-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('lists profiles sorted', () => {
    mkdirSync(join(root, 'beta'))
    mkdirSync(join(root, 'alpha'))
    expect(listProfiles(root)).toEqual(['alpha', 'beta'])
  })

  it('returns empty for missing root', () => {
    expect(listProfiles(join(root, 'missing'))).toEqual([])
  })

  it('reads manifest', () => {
    const dir = join(root, 'my-profile')
    mkdirSync(dir)
    writeFileSync(join(dir, 'cordis.yml'), 'id: my-profile\nplugins:\n  - id: tool-bash\n  - id: tool-fs\n')
    const m = readProfileManifest(dir)
    expect(m?.id).toBe('my-profile')
    expect(m?.plugins).toHaveLength(2)
  })

  it('returns null when no cordis.yml', () => {
    const dir = join(root, 'empty')
    mkdirSync(dir)
    expect(readProfileManifest(dir)).toBeNull()
  })

  it('closure dedupes plugin ids in order', () => {
    const a = join(root, 'a')
    const b = join(root, 'b')
    mkdirSync(a); mkdirSync(b)
    writeFileSync(join(a, 'cordis.yml'), 'plugins:\n  - id: tool-bash\n  - id: tool-fs\n')
    writeFileSync(join(b, 'cordis.yml'), 'plugins:\n  - id: tool-fs\n  - id: tool-web\n')
    const closure = getBundleClosure(root, ['a', 'b'])
    expect(closure.pluginIds).toEqual(['tool-bash', 'tool-fs', 'tool-web'])
    expect(closure.profileIds).toEqual(['a', 'b'])
  })

  it('closure over all profiles when no ids', () => {
    const a = join(root, 'a')
    mkdirSync(a)
    writeFileSync(join(a, 'cordis.yml'), 'plugins:\n  - id: x\n')
    const closure = getBundleClosure(root)
    expect(closure.pluginIds).toContain('x')
  })

  it('ignores missing manifests', () => {
    mkdirSync(join(root, 'empty'))
    const closure = getBundleClosure(root, ['empty'])
    expect(closure.pluginIds).toEqual([])
    expect(closure.profileIds).toEqual([])
  })
})
