/**
 * Browser agent-firehose plugin contributing one entry to the conversation
 * view slot plus the `agent-firehose` view target, without defining a service.
 * @module client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: resolves ctx.conversationEvents / ctx.conversationViews.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the 'conversation.view' SlotMap row (declared by the slot's
// owning package) must be in the program for the register call to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { AgentFirehoseView } from './AgentFirehoseView.tsx'
import { registerAgentFirehoseDefinition } from './definitions.ts'
import { agentFirehoseViewDefinition } from './firehose-builder.ts'
import { en, NS, zh } from './locales.ts'

/** Required services: the conversation slot and registries, and the locale service. */
export const inject = ['slots', 'conversationEvents', 'conversationViews', 'locale']

/**
 * Client plugin body: register the catch-all Definition, the snapshot
 * builder, and the conversation view tab. Every registration rides an effect
 * wrapper, so plugin unload removes all three.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-devtools-agent-firehose: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  registerAgentFirehoseDefinition(ctx)
  ctx.conversationViews.register(agentFirehoseViewDefinition)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'agent-firehose',
    order: 12,
    locale: NS,
    label: () => t('tab'),
  }, AgentFirehoseView))
}
