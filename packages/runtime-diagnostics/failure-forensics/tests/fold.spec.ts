import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import {
  applyForensicEvent, EMPTY_FORENSICS_STATE, FAILURE_WINDOW,
  forensicsStateSchema, forensicsViewSchema, suggestFix,
} from '../src/fold.ts'
import type { ForensicsState } from '../src/fold.ts'

function at(seq: number, type: string, data: unknown): SessionEvent {
  return { seq, time: 1_700_000_000_000 + seq, type, data } as unknown as SessionEvent
}

describe('failure forensics fold', () => {
  it('captures a model error closing a turn with code and fix hint absent', () => {
    const state = applyForensicEvent(EMPTY_FORENSICS_STATE, at(9, 'turn/end', {
      turn: 2,
      reason: { kind: 'error', error: { message: 'provider exploded', code: 'PROVIDER', status: 500 } },
    }))
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]).toMatchObject({
      kind: 'model-error',
      turn: 2,
      message: 'provider exploded',
      code: 'PROVIDER',
      suggestedFix: null,
    })
  })

  it('captures provider retries with the failure payload', () => {
    const state = applyForensicEvent(EMPTY_FORENSICS_STATE, at(11, 'llm/retry', {
      retryId: 'x',
      turn: 1,
      step: 1,
      provider: 'deepseek',
      mode: 'normal',
      policyKey: 'default',
      retry: 2,
      maxRetries: 3,
      delayMs: 800,
      failure: { message: 'rate limited', code: 'RATE_LIMIT' },
    }))
    expect(state.entries[0]).toMatchObject({
      kind: 'model-retry',
      code: 'RATE_LIMIT',
      suggestedFix: 'rate-limit',
    })
  })

  it('pairs tool calls with their results and captures timeouts with output tail', () => {
    let state: ForensicsState = applyForensicEvent(EMPTY_FORENSICS_STATE, at(5, 'tool/call', {
      turn: 1,
      step: 1,
      callId: 'c1',
      name: 'bash',
      arguments: '{}',
    }))
    expect(state.pendingCalls.c1).toEqual({ name: 'bash' })
    state = applyForensicEvent(state, at(6, 'tool/result', {
      turn: 1,
      step: 1,
      message: {
        id: 'r2',
        role: 'user',
        content: [{
          type: 'tool-result',
          toolCallId: 'c1',
          content: [{ type: 'text', text: 'partial\n[stderr]\nboom\n[timed out after 5000ms]' }],
        }],
        source: { kind: 'tool', callId: 'c1' },
      },
      error: { name: 'ToolTimeoutError', code: 'TOOL_TIMEOUT' },
    }))
    expect(state.pendingCalls).toEqual({})
    expect(state.entries[0]).toMatchObject({
      kind: 'tool-timeout',
      tool: 'bash',
      code: 'TOOL_TIMEOUT',
      suggestedFix: 'timeout',
    })
    expect(state.entries[0]?.outputTail).toContain('[timed out after 5000ms]')
  })

  it('captures isError tool results and signal-killed commands, but not plain non-zero exits', () => {
    let state: ForensicsState = EMPTY_FORENSICS_STATE
    state = applyForensicEvent(state, at(30, 'tool/result', {
      turn: 1,
      step: 1,
      message: {
        id: 'r3',
        role: 'user',
        content: [{ type: 'tool-result', toolCallId: 'cx', content: [{ type: 'text', text: 'first line\nmore' }], isError: true }],
        source: { kind: 'tool', callId: 'cx' },
      },
    }))
    state = applyForensicEvent(state, at(31, 'tool/result', {
      turn: 1,
      step: 1,
      message: {
        id: 'r4',
        role: 'user',
        content: [{ type: 'tool-result', toolCallId: 'cy', content: [{ type: 'text', text: 'out\n[killed by signal: SIGKILL]\n[exit code: 137]' }] }],
        source: { kind: 'tool', callId: 'cy' },
      },
    }))
    state = applyForensicEvent(state, at(32, 'tool/result', {
      turn: 1,
      step: 1,
      message: {
        id: 'r5',
        role: 'user',
        content: [{ type: 'tool-result', toolCallId: 'cz', content: [{ type: 'text', text: 'diff\n[exit code: 1]' }] }],
        source: { kind: 'tool', callId: 'cz' },
      },
    }))
    expect(state.entries.map(entry => entry.kind)).toEqual(['tool-error', 'command-killed'])
    expect(state.entries[0]?.message).toBe('first line')
    expect(state.entries[1]?.exit).toBe('SIGKILL')
  })

  it('captures failed compaction attempts with a null turn for standalone runs', () => {
    const state = applyForensicEvent(EMPTY_FORENSICS_STATE, at(40, 'compaction/end', {
      compactionId: 'cp1',
      turn: null,
      error: 'compaction provider unavailable',
    }))
    expect(state.entries[0]).toMatchObject({ kind: 'compaction', turn: null, code: null })
  })

  it('evicts the oldest entry beyond the window and caps pending calls', () => {
    let state: ForensicsState = EMPTY_FORENSICS_STATE
    for (let index = 0; index < FAILURE_WINDOW + 5; index++) {
      state = applyForensicEvent(state, at(100 + index, 'turn/end', {
        turn: index,
        reason: { kind: 'error', error: { message: `m${index}`, code: 'X' } },
      }))
    }
    expect(state.entries).toHaveLength(FAILURE_WINDOW)
    expect(state.entries[0]?.message).toBe('m5')

    let crowded: ForensicsState = EMPTY_FORENSICS_STATE
    for (let index = 0; index < 70; index++) {
      crowded = applyForensicEvent(crowded, at(1000 + index, 'tool/call', {
        turn: 1,
        step: 1,
        callId: `c${index}`,
        name: 'bash',
        arguments: '{}',
      }))
    }
    expect(Object.keys(crowded.pendingCalls)).toHaveLength(64)
    expect(Object.keys(crowded.pendingCalls)[0]).toBe('c6')
  })

  it('returns the same state reference for uninterested events', () => {
    const state = applyForensicEvent(EMPTY_FORENSICS_STATE, at(2, 'step/start', { turn: 1, step: 1 }))
    expect(state).toBe(EMPTY_FORENSICS_STATE)
  })

  it('validates state and view through the wire schemas', () => {
    let state: ForensicsState = applyForensicEvent(EMPTY_FORENSICS_STATE, at(5, 'tool/call', {
      turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}',
    }))
    state = applyForensicEvent(state, at(6, 'tool/result', {
      turn: 1, step: 1,
      message: {
        id: 'r1',
        role: 'user',
        content: [{ type: 'tool-result', toolCallId: 'c1', content: [{ type: 'text', text: 'nope' }], isError: true }],
        source: { kind: 'tool', callId: 'c1' },
      },
    }))
    expect(forensicsStateSchema.parse(state)).toBeTruthy()
    const view = forensicsViewSchema.parse({ entries: state.entries })
    expect(view.entries).toHaveLength(1)
    expect(() => forensicsStateSchema.parse({ entries: [{ bogus: true }] })).toThrow()
  })

  it('maps suggestFix codes deterministically', () => {
    expect(suggestFix('model-error', 'AUTH')).toBe('credentials')
    expect(suggestFix('model-error', '429')).toBe('rate-limit')
    expect(suggestFix('tool-error', 'ENOENT')).toBe('binary-missing')
    expect(suggestFix('compaction', null)).toBeNull()
  })
})
