/**
 * Browser failure-forensics plugin: one turn-tail chain entry rendering the
 * `failureForensics` projection entries for a closing turn.
 * @module client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: resolves ctx.conversationEvents for the registry type.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the 'conversation.chat.turnTail' SlotMap row must be in the
// program for the register call to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { FailureDetail } from './FailureDetail.tsx'
import { en, NS, zh } from './locales.ts'
import { selectTurnForensics } from './turn-forensics.ts'

/** Required services: the slot registry and the locale service. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the turn-tail entry.
 * The registration rides the slot service's effect wrapper, so plugin unload
 * removes it.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-devtools-failure-forensics: dictionaries')
  ctx.slots.inject(
    'conversation.chat.turnTail',
    () => ctx.slots.register({
      name: 'conversation.chat.turnTail',
      locale: NS,
      select: selectTurnForensics,
    }, FailureDetail),
  )
}
