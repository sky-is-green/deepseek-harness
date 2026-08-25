/**
 * ui-search browser half on a real cordis Context with a fake sessions
 * face: the plugin body registers the dictionaries and the shell.overlay
 * entry, whose inject face joins search hits with the list snapshot and
 * routes navigation to `sessions.open`; everything folds up on fiber
 * disposal (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { SearchInjected } from '../src/client/slots.ts'
import { apply, inject } from '../src/client/index.ts'

async function bench(listState: {
  ids: SessionId[]
  byId: Record<string, { displayTitle: string }>
  current?: SessionId
}) {
  const ctx = new Context()
  const open = vi.fn()
  const search = vi.fn(async () => ({
    ok: true as const,
    value: {
      items: [
        { sessionId: 's1' as never, snippet: 'listed hit' },
        { sessionId: 'ghost' as never, snippet: 'unlisted hit' },
      ],
      hasMore: true,
    },
  }))
  const state = { ...listState }
  ctx.provide('sessions', {
    open,
    search,
    list: { getSnapshot: () => state, subscribe: () => () => {} },
  } as never)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root', children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
  } as never, (() => null) as never)
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { slots: ctx.slots, locale, open, search, fiber }
}

describe('ui-search apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['locale', 'sessions', 'slots'])
  })

  it('registers the shell.overlay entry and folds it up on disposal (HMR safety)', async () => {
    const b = await bench({ ids: ['s1' as never], byId: {} })
    expect(b.slots.entries('shell.overlay').map(entry => entry.options.id)).toContain('global-search')
    expect(b.slots.entries('shell.overlay').find(entry => entry.options.id === 'global-search')?.locale).toBe('search')
    // Copy rides the standard locale seat.
    expect(b.locale.bind('search')('search.title')).toBe('搜索会话')
    await b.fiber.dispose()
    expect(b.slots.entries('shell.overlay').find(entry => entry.options.id === 'global-search')).toBeUndefined()
  })

  it('the inject face joins titles from the list snapshot and marks unlisted hits inert', async () => {
    const b = await bench({ ids: ['s1' as never], byId: { s1: { displayTitle: '修复登录' } }, current: 's1' as never })
    const face = b.slots.entries('shell.overlay')
      .find(entry => entry.options.id === 'global-search')!.inject as unknown as () => SearchInjected
    const injected = face()
    expect(injected.available).toBe(true)
    await expect(injected.searchSessions('q', new AbortController().signal)).resolves.toEqual({
      hits: [
        { sessionId: 's1', title: '修复登录', snippet: 'listed hit', openable: true },
        { sessionId: 'ghost', title: 'ghost', snippet: 'unlisted hit', openable: false },
      ],
      hasMore: true,
    })
    expect(b.search).toHaveBeenCalledWith('q', expect.any(AbortSignal))
    injected.openSession('s1' as never)
    expect(b.open).toHaveBeenCalledWith('s1')
  })

  it('reports unavailable when no session exists', async () => {
    const b = await bench({ ids: [], byId: {} })
    const face = b.slots.entries('shell.overlay')
      .find(entry => entry.options.id === 'global-search')!.inject as unknown as () => SearchInjected
    expect(face().available).toBe(false)
  })

  it('a failed search RPC rejects with the transport code', async () => {
    const ctx = new Context()
    ctx.provide('sessions', {
      open: vi.fn(),
      search: vi.fn(async () => ({ ok: false as const, error: { code: 'internal', message: 'not mounted' } })),
      list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} },
    } as never)
    await ctx.plugin(SlotRegistry).await()
    ctx.slots.register({
      name: 'root', children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
    } as never, (() => null) as never)
    ctx.provide('locale', new LocaleRuntime(ctx))
    await ctx.plugin({ inject: [...inject], apply }).await()
    const face = (ctx.get('slots') as SlotRegistry).entries('shell.overlay')
      .find(entry => entry.options.id === 'global-search')!.inject as unknown as () => SearchInjected
    await expect(face().searchSessions('q', new AbortController().signal)).rejects.toThrow(/internal/)
  })
})
