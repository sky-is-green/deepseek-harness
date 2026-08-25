// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { AgentFirehoseView, type AgentFirehoseViewProps } from '../src/client/AgentFirehoseView.tsx'
import type {
  AgentFirehoseSnapshot, FirehoseEventRow,
} from '../src/client/contract.ts'
import type { AgentFirehoseKey } from '../src/client/locales.ts'
import { en } from '../src/client/locales.ts'

const t = ((
  key: AgentFirehoseKey,
  params?: Record<string, string | number>,
): string => {
  const template = en[key]
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]))
}) as AgentFirehoseViewProps['t']

function row(seq: number, overrides: Partial<FirehoseEventRow> = {}): FirehoseEventRow {
  return {
    seq,
    time: 1_700_000_000_000 + seq * 100,
    type: 'user/message',
    summary: 'source user',
    location: { kind: 'unresolved' },
    ...overrides,
  }
}

const UNRESOLVED: FirehoseEventRow['location'] = { kind: 'unresolved' }

function snapshot(): AgentFirehoseSnapshot {
  return {
    rows: [
      row(3, { type: 'turn/end', summary: 'turn 1 · stop', location: UNRESOLVED }),
      row(2, { type: 'tool/call', summary: 'read_file({})', callId: 'c1', location: UNRESOLVED }),
      row(1, { type: 'step/start', summary: 'T1.S1', step: { turn: 1, step: 1 }, location: UNRESOLVED }),
    ],
    turns: [{
      turn: 1,
      startTime: 1_700_000_000_100,
      endTime: 1_700_000_000_300,
      spans: [
        { kind: 'step', label: 'T1.S1', turn: 1, startTime: 1_700_000_000_100, endTime: 1_700_000_000_300, failed: false },
        { kind: 'tool', label: 'read_file', turn: 1, startTime: 1_700_000_000_200, endTime: 1_700_000_000_250, failed: false },
      ],
    }],
  }
}

function props(snapshotValue: AgentFirehoseSnapshot): AgentFirehoseViewProps {
  return {
    t,
    useSession: ((selector: (snapshot: ConversationSnapshot) => unknown) =>
      selector({
        views: {
          // Test stub: serves only the firehose target; the generic wire
          // signature is cast because no single value can satisfy every key.
          get: ((target: string) =>
            target === 'agent-firehose' ? snapshotValue : undefined) as never,
        },
      } as unknown as ConversationSnapshot)) as AgentFirehoseViewProps['useSession'],
  } as AgentFirehoseViewProps
}

afterEach(cleanup)

describe('AgentFirehoseView', () => {
  it('renders the waterfall lane and the event table newest first', () => {
    render(createElement(AgentFirehoseView, props(snapshot())))
    expect(screen.getByText(en['waterfall.turn'].replace('{turn}', '1'))).toBeTruthy()
    expect(screen.getByTitle(/read_file/)).toBeTruthy()
    const table = screen.getByRole('table')
    expect(table).toBeTruthy()
    expect(table.textContent).toContain('turn/end')
    expect(table.textContent).toContain('step/start')
    const rows = table.querySelectorAll('tbody tr')
    expect(rows[0]?.textContent).toContain('3')
    expect(rows[2]?.textContent).toContain('1')
  })

  it('shows empty-state copy when nothing is assembled yet', () => {
    render(createElement(AgentFirehoseView, props({ rows: [], turns: [] })))
    expect(screen.getByText(en['events.empty'])).toBeTruthy()
    expect(screen.getByText(en['waterfall.empty'])).toBeTruthy()
  })
})
