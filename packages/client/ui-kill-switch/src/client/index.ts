/**
 * Kill switch plugin, browser half — one client command contribution,
 * `kill-switch`, whose single option carries the shared shell's risk
 * confirmation; confirming fans a `session.cancel` out to every session in
 * the live list and reports the accepted/total tally through the opening
 * session's composer notice channel. Queued messages are kept by design
 * (cancel semantics belong to the runtime); jobs, terminals, and loaded
 * models have no browser-reachable face yet and are out of scope.
 */
// Type-only: pulls the locale plugin's Context merge and the conversation
// notice face into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandContribution, CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import { en, zh, type KillSwitchKey } from './locales.ts'

export type { KillSwitchKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The kill switch command's copy. */
    'kill-switch': KillSwitchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'kill-switch'

/** Required services: command registration, locale, sessions faces. */
export const inject = ['commandUi', 'locale', 'sessions']

/**
 * Client plugin body: register the dictionaries and the `kill-switch`
 * contribution. The option's confirmation gate is what makes the action
 * deliberate: settlement only runs after the user acknowledges the risk.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-kill-switch: dictionaries')
  const t = ctx.locale.bind(NS)

  const contribution: CommandContribution = {
    name: 'kill-switch',
    description: t('switch.description'),
    available: () => true,
    ui: {
      kind: 'popupSelect',
      options: () => {
        const total = (ctx.get('sessions') as ISessions).list.getSnapshot().ids.length
        const option = {
          id: 'stop-all',
          label: t('switch.option'),
          confirmation: {
            title: t('switch.confirmTitle'),
            description: t('switch.confirmDescription'),
            acknowledgeLabel: t('switch.acknowledge'),
            cancelLabel: t('switch.cancelLabel'),
            confirmLabel: total > 0 ? `${t('switch.confirmLabel')} (${total})` : t('switch.confirmLabel'),
          },
        }
        return Promise.resolve([option] as const)
      },
      onSelect: async (_option, session) => {
        const sessions = ctx.get('sessions') as ISessions
        const ids = sessions.list.getSnapshot().ids
        let accepted = 0
        // Best-effort fan-out: one busy/rejecting session never stops the rest.
        for (const id of ids) {
          const bound = sessions.binding(id)
          if (bound === undefined) continue
          const result = await bound.session.cancel()
          if (result.ok) accepted += 1
        }
        // Feedback rides the opening session's composer notice channel.
        const actx = sessions.scope(session.sessionId)
        if (actx !== undefined) {
          const conversation = actx.get('conversation')
          conversation?.input.for(actx).notify('info', t('switch.result', { accepted, total: ids.length }))
        }
      },
    },
  }

  ctx.inject(['commandUi'], (scope: ClientContext) => {
    const commandUi = scope.get('commandUi') as CommandUiContract
    scope.effect(() => commandUi.register(contribution), 'ui-kill-switch: command')
  })
}
