/**
 * Command palette plugin, browser half — one `shell.overlay` entry binding
 * Ctrl/Cmd+K to a palette over the session's `commandUi` palette entries.
 * Host commands run as bare detached executes; popup entries resolve their
 * option list inside the palette. No current session, no palette (the
 * hotkey stays inert).
 */
// Type-only: pulls the 'shell.overlay' SlotMap declaration (the key's owner)
// and the locale plugin's Context merge into this program.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.remote merge for bare host executes.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { CommandPalette } from './CommandPalette.tsx'
import { en, zh, type CommandPaletteKey } from './locales.ts'
import type { PaletteInjected } from './slots.ts'

export type { PaletteInjected } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The global command palette's copy. */
    'command-palette': CommandPaletteKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'command-palette'

/** Required services: slot + locale registration and the palette's data faces. */
export const inject = ['commandUi', 'locale', 'sessions', 'slots']

/**
 * Client plugin body: register the dictionaries and the shell-overlay
 * palette entry whose inject face binds `commandUi`, `sessions`, and the
 * remote command execute to plain callbacks.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-command-palette: dictionaries')

  ctx.inject(['commandUi', 'sessions'], (scope: ClientContext) => {
    const commandUi = scope.get('commandUi') as CommandUiContract
    const sessions = scope.get('sessions') as ISessions

    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register({
        name: 'shell.overlay',
        id: 'command-palette',
        order: 0,
        locale: NS,
        inject: (): PaletteInjected => ({
          available: sessions.list.getSnapshot().current !== undefined,
          entries: async () => {
            const id = sessions.list.getSnapshot().current
            if (id === undefined) return []
            // ClientSessionContext is the stable-identity projection; the id is its whole content.
            return commandUi.paletteEntries({ sessionId: id }, new AbortController().signal)
          },
          executeHost: async (name) => {
            const id = sessions.list.getSnapshot().current
            if (id === undefined) throw new Error('command palette: no current session')
            const result = await ctx.remote.commands.execute(id, `/${name}`, [])
            if (!result.ok) throw new Error(`command.execute failed: ${result.error.code}: ${result.error.message}`)
            if (result.value === undefined) throw new Error(`unknown or malformed command: /${name}`)
          },
        }),
      }, CommandPalette))
  })
}
