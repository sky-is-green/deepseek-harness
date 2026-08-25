/**
 * Browser prompt-inspector plugin contributing one entry to the conversation
 * view slot plus the `prompt-inspector` view target, without defining a service.
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
import { registerInspectorDefinitions } from './definitions.ts'
import { PromptInspectorView } from './PromptInspectorView.tsx'
import { en, NS, zh } from './locales.ts'
import { promptInspectorViewDefinition } from './inspector-builder.ts'

/** Required services: the conversation slot and registries, and the locale service. */
export const inject = ['slots', 'conversationEvents', 'conversationViews', 'locale']

/**
 * Client plugin body: register the inspector Definitions, the snapshot
 * builder, and the conversation view tab. Every registration rides an effect
 * wrapper, so plugin unload removes all three.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-devtools-prompt-inspector: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  registerInspectorDefinitions(ctx)
  ctx.conversationViews.register(promptInspectorViewDefinition)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'prompt-inspector',
    order: 11,
    locale: NS,
    label: () => t('tab'),
  }, PromptInspectorView))
}
