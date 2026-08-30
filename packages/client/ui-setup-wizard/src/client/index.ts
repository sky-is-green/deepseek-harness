/**
 * Setup wizard — browser half. Links engine-selector, VHDX, health, tier, and leak into one card.
 * @module @deepseek-ai/dsh-client-ui-setup-wizard/client
 */
import type { Context } from '@deepseek-ai/cordis'
import { buildHealthSnapshot, buildWizardStatus, DEFAULT_STATE } from './wizard.ts'

export const name = 'ui-setup-wizard-client'
export const inject = [] as const

/**
 * Register the wizard settings section with unified linked status.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const settings = (ctx as unknown as { settings: { register: (s: unknown) => void } }).settings
    const title = 'Setup'
    try {
      settings.register({
        id: 'setup',
        title,
        order: 5,
        render: () => {
          const health = buildHealthSnapshot({ state: 'running', port: 8765 }, { state: 'stopped', port: 8000, vhdxMounted: false, dockerRunning: false })
          return buildWizardStatus(DEFAULT_STATE, health, 32_768, false)
        },
      })
    } catch {}
    return () => {}
  }, 'ui-setup-wizard settings section')
}

export * from './wizard.ts'
