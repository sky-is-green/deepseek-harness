/**
 * Live metrics plugin, browser half — one composer-dock entry reading the
 * host-computed `liveTurnMetrics` projection through the standard
 * `useProjection` seat, so the readout updates while tokens stream and keeps
 * the provider-exact settled figures afterwards. Renders nothing until the
 * projection serves a view.
 */
// Type-only: the composer.dock SlotMap declaration and the locale Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-session-live-turn-metrics/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { LiveReadout } from './LiveReadout.tsx'
import { en, zh, type LiveMetricsKey } from './locales.ts'

export type { LiveMetricsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The live metrics dock readout's copy. */
    'live-metrics': LiveMetricsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'live-metrics'

/** Required services: the slot registry and locale. */
export const inject = ['locale', 'slots']

/**
 * Client plugin body: register the `live-metrics` dictionaries and the
 * composer-dock readout entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-live-metrics: dictionaries')

  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'live-metrics', order: 1, locale: NS },
      LiveReadout,
    ))
}
