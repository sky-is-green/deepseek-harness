/**
 * ui-kill-switch browser half on a real cordis Context with fake
 * commandUi/sessions faces: the plugin body registers the `kill-switch`
 * contribution, its option carries the risk confirmation with the live
 * session count, and confirming fans `session.cancel` out to every listed
 * id via the session bindings, reporting the tally through the opening
 * session's composer notice. Registration folds up on fiber disposal (HMR
 * safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { CommandContribution } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { zh } from '../src/client/locales.ts'

async function bench(listIds: string[]) {
  const ctx = new Context()
  const registered: CommandContribution[] = []
  ctx.provide('commandUi', {
    register(contribution: CommandContribution) {
      registered.push(contribution)
      return () => {
        const at = registered.indexOf(contribution)
        if (at !== -1) registered.splice(at, 1)
      }
    },
  })
  const state = { ids: listIds.map(id => id as SessionId), byId: {} }
  // Per-session cancel stubs: a session whose map value is `false` rejects.
  const accepts = new Map<string, boolean>(listIds.map(id => [id, true]))
  const cancelled: string[] = []
  const sessionFaces = new Map(listIds.map(id => [id, {
    cancel: async () => {
      if (!(accepts.get(id) ?? true)) return { ok: false as const, error: { code: 'agent-busy', message: 'busy' } }
      cancelled.push(id)
      return { ok: true as const, value: { accepted: true } }
    },
  }]))
  const notices: Array<{ level: string; text: string }> = []
  const notify = vi.fn((level: string, text: string) => { notices.push({ level, text }) })
  const conversationFace = { input: { for: () => ({ notify }) } }
  ctx.provide('sessions', {
    list: { getSnapshot: () => state, subscribe: () => () => {} },
    binding: (id: SessionId) => {
      const face = sessionFaces.get(id)
      return face === undefined ? undefined : { session: face }
    },
    scope: (_id: SessionId) => ({
      get: (name: string) => (name === 'conversation' ? conversationFace : undefined),
    }),
  })
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const session = { sessionId: 's1' } as ClientSessionContext
  return { registered, cancelled, accepts, notices, session, fiber, cancelledCount: () => cancelled.length }
}

function registered0(b: Awaited<ReturnType<typeof bench>>): CommandContribution {
  return b.registered[0]!
}

describe('ui-kill-switch apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['commandUi', 'locale', 'sessions'])
  })

  it('registers the kill-switch command and folds it up on disposal (HMR safety)', async () => {
    const b = await bench(['s1'])
    expect(registered0(b).name).toBe('kill-switch')
    await b.fiber.dispose()
    expect(b.registered).toHaveLength(0)
  })

  it('the single option gates settlement behind a confirmation naming the live count', async () => {
    const b = await bench(['s1', 's2', 's3'])
    const contribution = registered0(b)
    expect(contribution.available(b.session)).toBe(true)
    const options = await contribution.ui.options(b.session, new AbortController().signal)
    expect(options).toHaveLength(1)
    expect(options[0]!.label).toBe(zh['switch.option'])
    expect(options[0]!.confirmation?.confirmLabel).toContain('(3)')
    // Nothing has been cancelled by merely listing options.
    expect(b.cancelled).toEqual([])
  })

  it('confirming fans session.cancel out to every listed session and notifies the tally', async () => {
    const b = await bench(['s1', 's2'])
    const contribution = registered0(b)
    const [option] = await contribution.ui.options(b.session, new AbortController().signal)
    await contribution.ui.onSelect(option!, b.session)
    expect(b.cancelled.sort()).toEqual(['s1', 's2'])
    expect(b.notices).toHaveLength(1)
    expect(b.notices[0]).toMatchObject({ level: 'info' })
    expect(b.notices[0]!.text).toContain('2/2')
  })

  it('one failing cancel never stops the fan-out; the tally reports what accepted', async () => {
    const b = await bench(['s1', 's2', 's3'])
    b.accepts.set('s2', false)
    const contribution = registered0(b)
    const [option] = await contribution.ui.options(b.session, new AbortController().signal)
    await contribution.ui.onSelect(option!, b.session)
    expect(b.cancelled.length).toBe(2)
    expect(b.notices[0]!.text).toContain('2/3')
  })
})
