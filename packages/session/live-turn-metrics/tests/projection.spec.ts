/**
 * The `liveTurnMetrics` projection unit: mounting the plugin beside the
 * projection registry serves the most recent step's live readout folded from
 * token-delta chunks and assembled messages; compositions without the
 * registry are unaffected; unmounting the plugin removes the key (HMR
 * safety). Wall-time math runs against the exported definition directly,
 * where event times are controlled.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as LiveTurnMetricsPlugin from '@deepseek-ai/dsh-session-live-turn-metrics'
import { liveTurnMetricsProjectionDefinition } from '@deepseek-ai/dsh-session-live-turn-metrics/src/projection.ts'
import type { LiveTurnMetricsView } from '@deepseek-ai/dsh-session-live-turn-metrics/types'

async function harness(withPlugin: boolean): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  if (withPlugin) await ctx.plugin(LiveTurnMetricsPlugin)
  return { ctx, session: ctx.sessions.create(SessionId('live')) }
}

describe('liveTurnMetrics projection unit (registry drive)', () => {
  it('serves no view on the empty log', async () => {
    const { ctx, session } = await harness(true)
    expect(ctx.sessionProjections.snapshot(session).values.liveTurnMetrics).toBeNull()
  })

  it('notifies the change feed with the causing seq while tokens stream', async () => {
    const { ctx, session } = await harness(true)
    const changes: { key: string; value: unknown; seq: number }[] = []
    ctx.sessionProjections.onChanged((_session, key, value, seq) => {
      changes.push({ key, value, seq })
    })
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'a' } })
    expect(changes.every(change => change.key === 'liveTurnMetrics')).toBe(true)
    expect(changes.at(-1)?.value).toMatchObject({ phase: 'streaming', turn: 1 })
    expect(ctx.sessionProjections.snapshot(session).values.liveTurnMetrics)
      .toMatchObject({ phase: 'streaming' })
  })

  it('has no liveTurnMetrics key without the plugin, and drops it when the plugin unloads (HMR safety)', async () => {
    const { ctx, session } = await harness(false)
    expect('liveTurnMetrics' in ctx.sessionProjections.snapshot(session).values).toBe(false)
    const fiber = await ctx.plugin(LiveTurnMetricsPlugin)
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'a' } })
    expect(ctx.sessionProjections.snapshot(session).values.liveTurnMetrics)
      .toMatchObject({ phase: 'streaming' })
    await fiber.dispose()
    expect('liveTurnMetrics' in ctx.sessionProjections.snapshot(session).values).toBe(false)
  })
})

/** Build one synthetic committed event with a controlled timestamp. */
function at(time: number, type: string, data: unknown): SessionEvent {
  return { type, seq: time, time, data } as unknown as SessionEvent
}

/** Fold a synthetic event list through the definition and view the result. */
function view(events: readonly SessionEvent[]): LiveTurnMetricsView | null {
  const state = events.reduce<Parameters<typeof liveTurnMetricsProjectionDefinition.apply>[0]>(
    (folded, event) => liveTurnMetricsProjectionDefinition.apply(folded, event),
    liveTurnMetricsProjectionDefinition.init(),
  )
  return liveTurnMetricsProjectionDefinition.wire.view(state)
}

const message = (text = 'answer'): Record<string, unknown> =>
  ({
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text }],
      source: { kind: 'model', provider: 'mock', model: 'mock' },
    }),
  })

const delta = (time: number, text: string): SessionEvent =>
  at(time, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text } })

describe('liveTurnMetrics wall-time fold (controlled timestamps)', () => {
  it('streams an estimate that settles to provider-exact figures when usage is reported', () => {
    // Two deltas over a 2 s decode span: estimate 1 delta / 2 s = 0.5 tok/s
    // mid-stream; settle replaces it with 60 tokens / 3 s = 20 tok/s.
    const streaming = view([
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_800, 'a'),
      delta(3_800, 'b'),
    ])
    expect(streaming).toEqual({ phase: 'streaming', turn: 1, ttftMs: 800, tokensPerSecond: 0.5 })
    expect(view([
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_800, 'a'),
      at(4_800, 'assistant/message', { ...message(), usage: { inputTokens: 10, outputTokens: 60 } }),
      at(4_900, 'step/end', { turn: 1, step: 1 }),
    ])).toEqual({ phase: 'settled', turn: 1, ttftMs: 800, tokensPerSecond: 20, outputTokens: 60 })
  })

  it('omits throughput until two timed points exist and before the first token', () => {
    expect(view([at(1_000, 'step/start', { turn: 1, step: 1 })])).toBeNull()
    expect(view([
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_500, 'first'),
    ])).toEqual({ phase: 'streaming', turn: 1, ttftMs: 500 })
  })

  it('freezes the stream estimate when the message carries no usable usage record', () => {
    expect(view([
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_800, 'a'),
      delta(3_800, 'b'),
      at(9_999, 'assistant/message', message()),
      at(10_000, 'step/end', { turn: 1, step: 1 }),
    ])).toEqual({ phase: 'settled', turn: 1, ttftMs: 800, tokensPerSecond: 0.5 })
  })

  it('keeps the previous settled view across a cancelled or failed step', () => {
    const events = [
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_800, 'a'),
      delta(3_800, 'b'),
      at(4_000, 'assistant/message', { ...message(), usage: { outputTokens: 60 } }),
      at(4_100, 'step/end', { turn: 1, step: 1 }),
    ]
    // One continuing fold, so the identity of the published view is observable.
    const folded = events.reduce<Parameters<typeof liveTurnMetricsProjectionDefinition.apply>[0]>(
      (state, event) => liveTurnMetricsProjectionDefinition.apply(state, event),
      liveTurnMetricsProjectionDefinition.init(),
    )
    expect(liveTurnMetricsProjectionDefinition.wire.view(folded)).toMatchObject({ phase: 'settled' })
    // Next step starts but dies before any token: boundaries drop, the view
    // object itself stays published untouched.
    const afterStart = liveTurnMetricsProjectionDefinition.apply(folded, at(5_000, 'step/start', { turn: 1, step: 2 }))
    const afterEnd = liveTurnMetricsProjectionDefinition.apply(afterStart, at(6_000, 'step/end', { turn: 1, step: 2 }))
    expect(afterEnd.open).toBeNull()
    expect(liveTurnMetricsProjectionDefinition.wire.view(afterEnd)).toBe(folded.view)
  })

  it('ignores non-token chunks and chunks outside the open step', () => {
    expect(view([
      at(500, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'stray' } }),
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      at(1_100, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'block-start', index: 0, blockType: 'text' } }),
      at(1_200, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '' } }),
      at(1_300, 'assistant/chunk', { turn: 2, step: 9, chunk: { type: 'text-delta', index: 0, text: 'other' } }),
      at(2_300, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'first' } }),
    ])).toEqual({ phase: 'streaming', turn: 1, ttftMs: 1_300 })
  })

  it('clamps negative clock skew and folds nothing for unrelated events', () => {
    const state = liveTurnMetricsProjectionDefinition.init()
    expect(liveTurnMetricsProjectionDefinition.apply(state, at(1, 'user/message', { content: [] }))).toBe(state)
    expect(view([
      at(2_000, 'step/start', { turn: 1, step: 1 }),
      delta(1_500, 'skewed'),
      at(2_600, 'assistant/message', { ...message(), usage: { outputTokens: -5 } }),
    ])).toEqual({ phase: 'settled', turn: 1, ttftMs: 0 })
  })
})
