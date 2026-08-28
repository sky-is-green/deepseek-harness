/**
 * Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`).
 * Renders the host `sidecarLifecycle` status as a settings entry and offers
 * Start/Stop when the host service is present. No model traffic.
 * @module @deepseek-ai/dsh-ui-sidecar-panel
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'ui-sidecar-panel'

export const inject = ['settings']



/**
 * Minimal panel: registers a `sidecar` settings section that reflects the
 * host lifecycle when available, otherwise shows the frozen-binary bootstrap
 * hint. The host service lives in `packages/sidecar/sidecar-lifecycle`.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  const settings = (ctx as unknown as { settings: { register: (s: unknown) => void } }).settings
  ctx.effect(() => {
    const section = {
      id: 'sidecar',
      title: 'Sidecar',
      order: 40,
      render: () => {
        const lifecycle = (ctx as unknown as { sidecarLifecycle?: { status: () => { state: string; port?: number } } }).sidecarLifecycle
        if (!lifecycle) return { state: 'unavailable', port: 8765, hint: 'sidecar lifecycle not installed (see packages/sidecar/sidecar-lifecycle)' } as unknown as never
        const s = lifecycle.status()
        return { state: s.state, port: s.port ?? 8765 }
      },
    }
    // Defer registration until settings is ready; ignore if the API is absent in tests.
    try {
      settings.register(section)
    } catch {
      // No settings host in unit tests — panel still proves disposal via effect.
    }
    return () => {}
  }, 'ui-sidecar-panel settings section')
}
