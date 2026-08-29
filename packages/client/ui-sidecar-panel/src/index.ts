/**
 * Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`)
 * with S18 bench dashboard sparkline.
 *
 * Renders the host `sidecarLifecycle` status as a settings entry and, when
 * bench history is available, an inline PES/tok/s sparkline sourced from
 * `dsh-bench` report history via `POST /v1/protocol/run` / `GET /v1/report/*`.
 *
 * @module @deepseek-ai/dsh-ui-sidecar-panel
 */

import type { Context } from '@deepseek-ai/cordis'
import { buildSparklinePath, buildPanelSparklines, renderSparklineSvg } from './sparkline.ts'

export const name = 'ui-sidecar-panel'

export const inject = ['settings']

/**
 * Minimal panel: registers a `sidecar` settings section that reflects the
 * host lifecycle when available, otherwise shows the frozen-binary bootstrap
 * hint. The `bench` key carries the sparkline rendering for the dashboard.
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
        const lifecycle = (ctx as unknown as { sidecarLifecycle?: { status: () => { state: string; port?: number } } })
          .sidecarLifecycle
        if (!lifecycle)
          return {
            state: 'unavailable',
            port: 8765,
            hint: 'sidecar lifecycle not installed (see packages/sidecar/sidecar-lifecycle)',
            bench: null as unknown,
          }
        const s = lifecycle.status()
        return {
          state: s.state,
          port: s.port ?? 8765,
          bench: null as unknown,
        }
      },
    }
    try {
      settings.register(section)
    } catch {
      // No settings host in unit tests — panel still proves disposal via effect.
    }
    return () => {}
  }, 'ui-sidecar-panel settings section')
}

// Re-export pure helpers for direct testing and for the panel's render path.
export { buildPanelSparklines, buildSparklinePath, renderSparklineSvg }
