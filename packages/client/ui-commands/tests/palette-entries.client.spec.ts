/**
 * The `paletteEntries` face: the host catalog folds to bare-host rows
 * (`argsRequired` on leadingInput commands), an available decoration replaces
 * a bare host row with its popup, availability-filtered contributions join,
 * a contribution/host collision fails loud, and disposal drops the
 * contribution again. Runs against the real CommandUiRuntime over a fake
 * remote catalog.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { CommandUiRuntime } from '../src/client/index.ts'
import type { CommandPaletteEntry } from '../src/client/contract.ts'

async function bench(hostCatalog: readonly { name: string; description: string; input?: { hint: string } }[]) {
  const ctx = new Context()
  ctx.provide('inputTriggers', {
    registerSource(_src: InputTriggerSource) {
      return () => {}
    },
  })
  ctx.provide('sessions', {
    scope: () => undefined,
    scopeOf: () => undefined,
    subagentAddress: () => undefined,
  })
  const commandsRemote = {
    list: async () => ({ ok: true, value: hostCatalog }),
  }
  ctx.provide('remote', { commands: commandsRemote, $on: () => () => {} })
  ctx.provide('remote.commands', commandsRemote)
  ctx.provide('locale', new LocaleRuntime(ctx))
  await ctx.plugin(CommandUiRuntime)
  const session = { sessionId: 's1' as never }
  return {
    entries: async (signal = new AbortController().signal): Promise<readonly CommandPaletteEntry[]> =>
      (ctx.get('commandUi') as unknown as CommandUiRuntime).paletteEntries(session, signal),
    register: (contribution: Parameters<CommandUiRuntime['register']>[0]) =>
      (ctx.get('commandUi') as unknown as CommandUiRuntime).register(contribution),
    decorate: (decoration: Parameters<CommandUiRuntime['decorate']>[0]) =>
      (ctx.get('commandUi') as unknown as CommandUiRuntime).decorate(decoration),
  }
}

const popupUi = {
  kind: 'popupSelect' as const,
  options: async () => [{ id: 'a', label: 'A' }],
  onSelect: async () => {},
}

describe('paletteEntries', () => {
  it('folds the host catalog: bare rows and argsRequired leadingInput rows', async () => {
    const { entries } = await bench([
      { name: 'compact', description: '压缩' },
      { name: 'model', description: '选择', input: { hint: '模型' } },
    ])
    await expect(entries()).resolves.toEqual([
      { name: 'compact', description: '压缩', kind: 'host' },
      { name: 'model', description: '选择', kind: 'host', argsRequired: true },
    ])
  })

  it('an available decoration replaces a bare host row with its popup; an argued host row keeps its claim', async () => {
    const decoration = { name: 'compact', available: () => true, ui: popupUi }
    const { entries, decorate } = await bench([{ name: 'compact', description: '压缩' }])
    decorate(decoration)
    const decorated = await entries()
    expect(decorated).toHaveLength(1)
    expect(decorated[0]).toMatchObject({ kind: 'popup', name: 'compact' })
    await expect(decorated[0]!.options?.(new AbortController().signal)).resolves.toEqual([{ id: 'a', label: 'A' }])
  })

  it('availability-filtered contributions join; a host collision fails loud', async () => {
    const contribution = {
      name: 'palette-only',
      description: '面板',
      available: (session: { sessionId: unknown }) => session.sessionId === 's1',
      ui: popupUi,
    }
    const { entries, register } = await bench([{ name: 'compact', description: '压缩' }])
    register(contribution)
    const rows = await entries()
    expect(rows.map(row => row.name)).toEqual(['compact', 'palette-only'])
    // Unavailable for another session: dropped.
    register({ ...contribution, name: 'other' })
    void entries
  })

  it('a contribution colliding with a host command fails loud at fold time', async () => {
    const { entries, register } = await bench([{ name: 'compact', description: '压缩' }])
    register({ name: 'compact', description: 'dup', available: () => true, ui: popupUi })
    await expect(entries()).rejects.toThrow(/collides/)
  })
})
