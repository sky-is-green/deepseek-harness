/**
 * Global search plugin, browser half — one `shell.overlay` entry binding
 * Ctrl/Cmd+Shift+F to the cross-session search dialog. The dialog rides the
 * runtime's request-local `sessions.search` RPC; titles join from the live
 * list snapshot and only listed sessions navigate.
 */
// Type-only: pulls the 'shell.overlay' SlotMap declaration (the key's owner)
// and the locale plugin's Context merge into this program.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { SearchDialog } from './SearchDialog.tsx'
import { en, zh, type SearchKey } from './locales.ts'
import type { SearchInjected } from './slots.ts'

export type { SearchHit, SearchInjected } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The global search dialog's copy. */
    search: SearchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'search'

/** Required services: slot + locale registration and the sessions faces. */
export const inject = ['locale', 'sessions', 'slots']

/**
 * Client plugin body: register the `search` dictionaries and the
 * shell-overlay entry whose inject face binds `sessions.search`, the list
 * snapshot join, and `open` to plain callbacks.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-search: dictionaries')

  ctx.inject(['sessions'], (scope: ClientContext) => {
    const sessions = scope.get('sessions') as ISessions

    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register({
        name: 'shell.overlay',
        id: 'global-search',
        order: 1,
        locale: NS,
        inject: (): SearchInjected => ({
          available: sessions.list.getSnapshot().ids.length > 0,
          searchSessions: async (query, signal) => {
            const result = await sessions.search(query, signal)
            if (!result.ok) throw new Error(`session.search failed: ${result.error.code}: ${result.error.message}`)
            const { byId } = sessions.list.getSnapshot()
            return {
              hits: result.value.items.map(item => ({
                sessionId: item.sessionId,
                title: byId[item.sessionId]?.displayTitle ?? item.sessionId,
                snippet: item.snippet,
                openable: item.sessionId in byId,
              })),
              hasMore: result.value.hasMore,
            }
          },
          openSession: (id) => { sessions.open(id) },
        }),
      }, SearchDialog))
  })
}
