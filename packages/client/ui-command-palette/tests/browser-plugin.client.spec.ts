/**
 * ui-command-palette browser half on a real cordis Context with fake
 * commandUi/sessions faces: the plugin body registers the dictionaries and
 * the shell.overlay entry, whose inject face binds paletteEntries to the
 * current session and bare host executes to the remote — both fold up on
 * fiber disposal (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandPaletteEntry, CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import type { PaletteInjected } from '../src/client/slots.ts'

const sid = (k: string): SessionId => k as SessionId

async function bench(options: { current?: string; list?: readonly CommandPaletteEntry[] } = {}) {
  const ctx = new Context()
  const paletteEntries = options.list ?? [{ name: 'compact', description: 'd', kind: 'host' as const }]
  ctx.provide('commandUi', {
    paletteEntries: (_session: unknown, _signal: AbortSignal) => Promise.resolve(paletteEntries),
  } as unknown as CommandUiContract)
  const state = { current: options.current === undefined ? undefined : sid(options.current) }
  ctx.provide('sessions', {
    list: {
      getSnapshot: () => state,
      subscribe: () => () => {},
    },
  })
  const executeCalls: string[] = []
  ctx.provide('remote', {
    commands: {
      execute: async (_id: SessionId, line: string) => {
        executeCalls.push(line)
        return { ok: true, value: { result: { kind: 'success' } } }
      },
    },
    $on: () => () => {},
  })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root', children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, slots: ctx.slots, state, executeCalls, paletteEntries }
}

describe('apply (ui-command-palette)', () => {
  it('registers the shell.overlay entry and folds it up on disposal (HMR safety)', async () => {
    const { fiber, slots } = await bench({ current: 's1' })
    expect(slots.entries('shell.overlay').map(entry => entry.options.id)).toEqual(['command-palette'])
    await fiber.dispose()
    expect(slots.entries('shell.overlay')).toHaveLength(0)
  })

  it('the inject face reads the current session, lists its entries, and executes bare host commands remotely', async () => {
    const { slots, executeCalls } = await bench({ current: 's1' })
    const entry = slots.entries('shell.overlay')[0]!
    const injected = (entry.inject as unknown as () => PaletteInjected)()
    expect(injected.available).toBe(true)
    await expect(injected.entries()).resolves.toHaveLength(1)
    await injected.executeHost('compact')
    expect(executeCalls).toEqual(['/compact'])
  })

  it('without a current session the face reports unavailable and serves no entries', async () => {
    const { slots } = await bench({})
    const injected = (slots.entries('shell.overlay')[0]!.inject as unknown as () => {
      available: boolean
      entries(): Promise<readonly unknown[]>
    })()
    expect(injected.available).toBe(false)
    await expect(injected.entries()).resolves.toEqual([])
  })
})
