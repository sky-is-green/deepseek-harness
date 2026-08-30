/**
 * Setup wizard — browser half.
 * @module @deepseek-ai/dsh-client-ui-setup-wizard/client
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'ui-setup-wizard-client'
export const inject = ['locale'] as const

/**
 * Register the wizard settings section.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const locale = (ctx as unknown as { locale?: { t: (k: string) => string } }).locale
    const title = locale?.t('setup.wizard.title') ?? 'Setup'
    const settings = (ctx as unknown as { settings: { register: (s: unknown) => void } }).settings
    try {
      settings.register({ id: 'setup', title, order: 5, render: () => ({}) })
    } catch {}
    return () => {}
  }, 'ui-setup-wizard settings section')
}

export * from './wizard.ts'
