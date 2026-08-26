import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type {
  ConversationEventInput, ConversationNodeDefinition, ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import { ConversationNodeAssembler } from '@deepseek-ai/dsh-client-runtime/client'
import type { AgentFirehoseSnapshot } from '../src/client/contract.ts'
import { FIREHOSE_WINDOW } from '../src/client/contract.ts'
import { registerAgentFirehoseDefinition } from '../src/client/definitions.ts'
import { eventSummary } from '../src/client/event-summary.ts'
import { agentFirehoseViewDefinition } from '../src/client/firehose-builder.ts'

const DEFINITIONS: ConversationNodeDefinition[] = []
const registrationContext = {
  conversationEvents: {
    register: (definition: ConversationNodeDefinition) => {
      DEFINITIONS.push(definition)
      return () => {}
    },
  },
} as unknown as Context

registerAgentFirehoseDefinition(registrationContext)

class TestEventDefinitions {
  entries(): readonly ConversationNodeDefinition[] {
    return [...DEFINITIONS]
  }

  fallbackEntry(): undefined {
    return undefined
  }
}

class TestViewDefinitions {
  entries(): readonly ConversationViewDefinition[] {
    return [agentFirehoseViewDefinition]
  }
}

function at(
  seq: number,
  type: string,
  data: unknown,
  extra: Record<string, unknown> = {},
): ConversationEventInput {
  return {
    event: {
      seq,
      time: 1_700_000_000_000 + seq * 100,
      type,
      data,
      ...extra,
    } as unknown as ConversationEventInput['event'],
    view: undefined,
  }
}

function assembler(events: readonly ConversationEventInput[]): ConversationNodeAssembler {
  const value = new ConversationNodeAssembler(
    new TestEventDefinitions(),
    new TestViewDefinitions(),
  )
  value.replaceWindow(events, false)
  value.flush()
  return value
}

function snapshot(value: ConversationNodeAssembler): AgentFirehoseSnapshot {
  const current = value.snapshot('agent-firehose') as AgentFirehoseSnapshot | undefined
  if (current === undefined) throw new Error('agent-firehose view was not registered')
  return current
}

const TOOL_RESULT_OK = {
  id: 'r1',
  role: 'user',
  content: [{ type: 'tool-result', toolCallId: 'c1', content: [{ type: 'text', text: 'done' }] }],
  source: { kind: 'tool', callId: 'c1' },
}

function turnEvents(): ConversationEventInput[] {
  return [
    at(1, 'turn/start', { turn: 1 }),
    at(2, 'step/start', { turn: 1, step: 1 }),
    at(3, 'tool/call', { turn: 1, step: 1, callId: 'c1', name: 'read_file', arguments: '{"p":"a"}' }),
    at(4, 'tool/result', { turn: 1, step: 1, message: TOOL_RESULT_OK }),
    at(5, 'assistant/message', {
      turn: 1,
      step: 1,
      message: { id: 'a1', role: 'assistant', content: [], source: { kind: 'model' } },
      usage: { inputTokens: 10, outputTokens: 5 },
    }),
    at(6, 'step/end', { turn: 1, step: 1 }),
    at(7, 'turn/end', { turn: 1, reason: { kind: 'stop' } }),
  ]
}

describe('Agent firehose conversation Definition', () => {
  it('captures every committed event with bounded summaries and tool correlation ids', () => {
    const { rows } = snapshot(assembler(turnEvents()))
    expect(rows.map(row => row.seq)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(rows.find(row => row.type === 'tool/call')).toMatchObject({
      callId: 'c1',
      summary: 'read_file({"p":"a"})',
    })
    expect(rows.find(row => row.type === 'tool/result')).toMatchObject({ callId: 'c1' })
    const assistant = rows.find(row => row.type === 'assistant/message')
    expect(assistant?.summary).toContain('in 10')
  })

  it('derives per-turn waterfalls with step and tool spans, failing spans marked', () => {
    const events = [
      at(1, 'turn/start', { turn: 1 }),
      at(2, 'step/start', { turn: 1, step: 1 }),
      at(3, 'tool/call', { turn: 1, step: 1, callId: 'c1', name: 'read_file', arguments: '{}' }),
      at(4, 'tool/call', { turn: 1, step: 1, callId: 'c9', name: 'bash', arguments: '{}' }),
      at(5, 'tool/result', { turn: 1, step: 1, message: TOOL_RESULT_OK }),
      at(6, 'tool/result', {
        turn: 1,
        step: 1,
        message: {
          id: 'r2',
          role: 'user',
          content: [{
            type: 'tool-result',
            toolCallId: 'c9',
            content: [{ type: 'text', text: 'boom' }],
            isError: true,
          }],
          source: { kind: 'tool', callId: 'c9' },
        },
        error: { name: 'ToolTimeoutError', code: 'TOOL_TIMEOUT' },
      }),
      at(7, 'assistant/message', {
        turn: 1,
        step: 1,
        message: { id: 'a1', role: 'assistant', content: [], source: { kind: 'model' } },
      }),
      at(8, 'step/end', { turn: 1, step: 1 }),
      at(9, 'turn/end', { turn: 1, reason: { kind: 'stop' } }),
    ]
    const { turns } = snapshot(assembler(events))
    expect(turns).toHaveLength(1)
    const waterfall = turns[0]
    expect(waterfall?.turn).toBe(1)
    expect(waterfall?.startTime).toBe(1_700_000_000_100)
    expect(waterfall?.endTime).toBe(1_700_000_000_900)
    expect(waterfall?.spans.map(span => `${span.kind}:${span.label}`))
      .toEqual(['step:T1.S1', 'tool:read_file', 'tool:bash'])
    const failed = waterfall?.spans.filter(span => span.failed) ?? []
    expect(failed.map(span => span.label)).toEqual(['bash'])
    const step = waterfall?.spans.find(span => span.kind === 'step')
    expect(step?.startTime).toBe(1_700_000_000_200)
    expect(step?.endTime).toBe(1_700_000_000_800)
  })

  it('keeps only the most recent window of rows as the log grows', () => {
    const flood: ConversationEventInput[] = Array.from(
      { length: FIREHOSE_WINDOW + 50 },
      (_, index) => at(index + 1, 'user/message', {
        id: `m${index}`,
        role: 'user',
        content: [],
        source: { kind: 'user' },
      }),
    )
    const { rows } = snapshot(assembler(flood))
    expect(rows).toHaveLength(FIREHOSE_WINDOW)
    expect(rows[0]?.seq).toBe(51)
    expect(rows.at(-1)?.seq).toBe(FIREHOSE_WINDOW + 50)
  })

  it('summarizes unknown event types as a JSON head instead of dropping them', () => {
    expect(eventSummary({
      seq: 1,
      time: 0,
      type: 'future/thing',
      data: { alpha: 'beta', pad: 'x'.repeat(500) },
    } as never)).toMatch(/^\{"alpha":"beta"/)
    expect(eventSummary({
      seq: 1,
      time: 0,
      type: 'future/thing',
      data: { pad: 'x'.repeat(500) },
    } as never).length).toBeLessThanOrEqual(121)
  })

  it('replays identically through append upserts after a replace', () => {
    const events = turnEvents()
    const replaced = assembler(events)
    const appended = assembler([])
    for (const event of events) appended.append(event)
    appended.flush()
    expect(snapshot(appended)).toEqual(snapshot(replaced))
  })
})
