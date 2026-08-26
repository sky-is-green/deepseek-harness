/**
 * LiveReadout: one composer-dock line showing the most recent assistant
 * step's live decode throughput and time-to-first-token, fed by the
 * host-computed `liveTurnMetrics` projection through the standard seat.
 * Renders nothing until a view exists; figures appear as they become
 * available and settle to provider-exact values on message assembly.
 */
import { memo } from 'react'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LiveTurnMetricsView } from '@deepseek-ai/dsh-session-live-turn-metrics/client'
import css from './LiveReadout.module.css'

export interface LiveReadoutProps {
  useProjection: UseProjection
  /** The owning dock's locale seat, passed down as a plain prop. */
  t: PropsLocale<'live-metrics'>['t']
}

/** One decimal, stable for typical rates; trailing zeros kept for rhythm. */
function rateOf(tokensPerSecond: number): string {
  return (Math.round(tokensPerSecond * 10) / 10).toFixed(1)
}

/** Seconds with one decimal — sub-100 ms TTFT reads as 0.1s rather than 0s. */
function secondsOf(ms: number): string {
  return (Math.round(ms / 100) / 10).toFixed(1)
}

export const LiveReadout = memo(function LiveReadout({ useProjection, t }: LiveReadoutProps) {
  const view = useProjection('liveTurnMetrics')
  if (view === undefined || view === null) return null
  return <LiveReadoutView view={view} t={t} />
})

/** Split so the projection subscription stays on `LiveReadout` across re-renders. */
function LiveReadoutView({ view, t }: { view: LiveTurnMetricsView; t: LiveReadoutProps['t'] }) {
  const rate = view.tokensPerSecond !== undefined ? t('readout.rate', { rate: rateOf(view.tokensPerSecond) }) : null
  const ttft = view.ttftMs !== undefined ? t('readout.ttft', { ttft: secondsOf(view.ttftMs) }) : null
  if (rate === null && ttft === null) return null
  const label = [ttft, rate].filter(part => part !== null).join(' · ')
  const aria = view.tokensPerSecond !== undefined && view.ttftMs !== undefined
    ? t('readout.aria', { rate: rateOf(view.tokensPerSecond), ttft: secondsOf(view.ttftMs) })
    : label
  return (
    <span className={`${css.root}${view.phase === 'streaming' ? ` ${css.streaming}` : ''}`} aria-label={aria}>
      {label}
    </span>
  )
}
