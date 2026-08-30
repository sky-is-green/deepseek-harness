import { describe, it, expect } from 'vitest'
import { closureToEntries, filterPlugins, groupPlugins } from '../src/client/browser.ts'

describe('plugin browser', () => {
  const plugins = [
    { id: 'tool-bash', installed: true },
    { id: 'tool-fs', installed: false },
    { id: 'tool-web', name: 'Web', installed: false },
  ]
  it('filters by id', () => {
    expect(filterPlugins(plugins, 'bash')).toHaveLength(1)
  })
  it('filters by name', () => {
    expect(filterPlugins(plugins, 'web')).toHaveLength(1)
  })
  it('onlyInstallable hides installed', () => {
    expect(filterPlugins(plugins, '', true).every(p => !p.installed)).toBe(true)
  })
  it('empty filter returns all', () => {
    expect(filterPlugins(plugins, '')).toHaveLength(3)
  })
  it('groups', () => {
    const g = groupPlugins(plugins)
    expect(g.installed).toHaveLength(1)
    expect(g.installable).toHaveLength(2)
  })
  it('closureToEntries maps', () => {
    const e = closureToEntries({ pluginIds: ['a', 'b'] }, new Set(['a']))
    expect(e[0]!.installed).toBe(true)
    expect(e[1]!.installed).toBe(false)
  })
})
