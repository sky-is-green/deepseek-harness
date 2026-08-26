import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type {
  ConversationEventInput, ConversationNodeDefinition, ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import { ConversationNodeAssembler } from '@deepseek-ai/dsh-client-runtime/client'
import { registerInspectorDefinitions } from '../src/client/definitions.ts'
import type { PromptInspectorSnapshot } from '../src/client/contract.ts'
import { promptInspectorViewDefinition } from '../src/client/inspector-builder.ts'

const DEFINITIONS: ConversationNodeDefinition[] = []
const registrationContext = {
  conversationEvents: {
    register: (definition: ConversationNodeDefinition) => {
      DEFINITIONS.push(definition)
      return () => {}
    },
  },
} as unknown as Context

registerInspectorDefinitions(registrationContext)

class TestEventDefinitions {
  entries(): readonly ConversationNodeDefinition[] {
    return DEFINITIONS
  }

  fallbackEntry(): undefined {
    return undefined
  }
}

class TestViewDefinitions {
  entries(): readonly ConversationViewDefinition[] {
    return [promptInspectorViewDefinition]
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
      time: 1_700_000_000_000 + seq,
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

function snapshot(value: ConversationNodeAssembler): PromptInspectorSnapshot {
  const current = value.snapshot('prompt-inspector') as PromptInspectorSnapshot | undefined
  if (current === undefined) throw new Error('prompt-inspector view was not registered')
  return current
}

function headerEvent(seq: number, model: string, system: string, tools?: unknown[]) {
  return at(seq, 'request/header', {
    reason: 'initial',
    header: { config: { provider: 'test', model }, system, ...(tools === undefined ? {} : { tools }) },
  })
}

function userMessage(seq: number, text: string, source: unknown) {
  return at(seq, 'user/message', {
    id: `m${seq}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source,
  })
}

const TOOL_A = [{ name: 'read_file', description: 'Read a file.', parameters: { type: 'object' } }]

describe('Prompt inspector conversation Definitions', () => {
  it('assembles headers in log order with diff flags against the previous envelope', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      at(2, 'step/start', { turn: 1, step: 1 }),
      headerEvent(3, 'model-a', 'system one'),
      headerEvent(4, 'model-a', 'system one', TOOL_A),
      headerEvent(5, 'model-b', 'system two', TOOL_A),
      at(6, 'step/end', { turn: 1, step: 1 }),
      at(7, 'turn/end', { turn: 1 }),
    ])
    const { headers } = snapshot(value)
    expect(headers.map(row => row.seq)).toEqual([3, 4, 5])
    expect(headers[0]).toMatchObject({ initial: true, systemChanged: false, toolsChanged: false })
    expect(headers[1]).toMatchObject({ initial: false, systemChanged: false, toolsChanged: true })
    expect(headers[2]).toMatchObject({ initial: false, systemChanged: true, toolsChanged: false })
    expect(headers.every(row => row.location.kind === 'step')).toBe(true)
  })

  it('rows producer context and excludes user, model, and tool sources', () => {
    const value = assembler([
      userMessage(1, 'hello', { kind: 'user' }),
      userMessage(2, 'curated block', { kind: 'plugin', plugin: 'dsh-hive', form: 'catalog' }),
      userMessage(3, 'recalled material', {
        kind: 'session-reference',
        references: [{ label: 'Earlier work' }],
      }),
      userMessage(4, 'assistant echo', { kind: 'model', provider: 'p', model: 'm' }),
      userMessage(5, 'tool result', { kind: 'tool', callId: 'c1' }),
    ])
    const { contexts } = snapshot(value)
    expect(contexts.map(row => row.seq)).toEqual([2, 3])
    expect(contexts[0]).toMatchObject({
      role: 'inject',
      label: 'dsh-hive',
      form: 'catalog',
      preview: 'curated block',
    })
    expect(contexts[1]).toMatchObject({
      role: 'recall',
      label: 'Earlier work',
      form: null,
      preview: 'recalled material',
    })
  })

  it('bounds context previews to the display limit', () => {
    const long = 'x'.repeat(500)
    const value = assembler([
      userMessage(1, long, { kind: 'plugin', plugin: 'dsh-hive' }),
    ])
    const { contexts } = snapshot(value)
    expect(contexts[0]?.preview.length).toBeLessThanOrEqual(201)
    expect(contexts[0]?.preview.endsWith('…')).toBe(true)
  })

  it('replays identically through append upserts after a replace', () => {
    const events = [
      headerEvent(1, 'model-a', 'system'),
      userMessage(2, 'curated block', { kind: 'plugin', plugin: 'dsh-hive' }),
    ]
    const replaced = assembler(events)
    const appended = assembler([])
    appended.replaceWindow([], false)
    appended.flush()
    for (const event of events) appended.append(event)
    appended.flush()
    expect(snapshot(appended)).toEqual(snapshot(replaced))
  })
})
