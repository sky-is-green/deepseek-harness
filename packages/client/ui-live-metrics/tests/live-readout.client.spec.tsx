// @vitest-environment jsdom
/**
 * The live metrics dock readout: renders nothing without a projection value,
 * shows TTFT and throughput as they become available, marks the streaming
 * phase, and settles to provider-exact figures. Props are fed directly (the
 * sanctioned zero-machinery path); `t` mirrors the zh dictionary lookup.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LiveReadout, type LiveReadoutProps } from '../src/client/LiveReadout.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { LiveTurnMetricsView } from '@deepseek-ai/dsh-session-live-turn-metrics/client'

/** Plain translate stub mirroring the locale seat's interpolation contract. */
function t(key: string, params?: Record<string, string>): string {
  return Object.entries(params ?? {}).reduce(
    (line, [name, value]) => line.replaceAll(`{${name}}`, value),
    zh[key as keyof typeof zh],
  )
}

function props(view: LiveTurnMetricsView | undefined): LiveReadoutProps {
  const useProjection: LiveReadoutProps['useProjection'] = () => view
  return { useProjection, t }
}

describe('live metrics dock readout', () => {
  it('renders nothing while the projection serves no view', () => {
    const { container } = render(<LiveReadout {...props(undefined)} />)
    expect(container.textContent).toBe('')
  })

  it('shows the first-token latency alone before two timed points exist', () => {
    const view: LiveTurnMetricsView = { phase: 'streaming', turn: 3, ttftMs: 840 }
    const { container } = render(<LiveReadout {...props(view)} />)
    expect(container.textContent).toBe('首字 0.8 秒')
  })

  it('joins both figures while streaming and keeps the settled exact rate', () => {
    const streaming: LiveTurnMetricsView = { phase: 'streaming', turn: 1, ttftMs: 800, tokensPerSecond: 41.25 }
    expect(render(<LiveReadout {...props(streaming)} />).container.textContent)
      .toBe('首字 0.8 秒 · 41.3 tok/s')
    const settled: LiveTurnMetricsView = {
      phase: 'settled', turn: 1, ttftMs: 800, tokensPerSecond: 20, outputTokens: 60,
    }
    expect(render(<LiveReadout {...props(settled)} />).container.textContent)
      .toBe('首字 0.8 秒 · 20.0 tok/s')
  })

  it('announces the full reading through the accessible name when both figures exist', () => {
    const view: LiveTurnMetricsView = { phase: 'streaming', turn: 1, ttftMs: 1200, tokensPerSecond: 7.5 }
    const root = render(<LiveReadout {...props(view)} />).container.firstElementChild
    expect(root?.getAttribute('aria-label'))
      .toBe('实时生成：每秒 7.5 个 token，首字延迟 1.2 秒')
  })

  it('falls back to the visible label for the accessible name with one figure', () => {
    const view: LiveTurnMetricsView = { phase: 'settled', turn: 2 }
    const root = render(<LiveReadout {...props(view)} />).container.firstElementChild
    // No figures at all: nothing renders rather than an empty pill.
    expect(root).toBeNull()
    const ttftOnly = render(<LiveReadout {...props({ ...view, ttftMs: 300 })} />).container.firstElementChild
    expect(ttftOnly?.getAttribute('aria-label')).toBe(zh['readout.ttft'].replace('{ttft}', '0.3'))
  })

  it('the English dictionary covers the same keys with its own wording', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(en['readout.rate']).toContain('tok/s')
  })
})
