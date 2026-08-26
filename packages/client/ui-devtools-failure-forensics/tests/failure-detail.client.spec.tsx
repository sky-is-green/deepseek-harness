// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  FailureEntry, FailureForensicsView,
} from '@deepseek-ai/dsh-failure-forensics/client'
import { FailureDetail } from '../src/client/FailureDetail.tsx'
import type { FailureDetailProps } from '../src/client/FailureDetail.tsx'
import type { FailureForensicsKey } from '../src/client/locales.ts'
import { en } from '../src/client/locales.ts'

const t = ((key: FailureForensicsKey): string => en[key]) as FailureDetailProps['t']

function entry(overrides: Partial<FailureEntry>): FailureEntry {
  return {
    kind: 'tool-timeout',
    seq: 10,
    time: 0,
    turn: 1,
    message: 'Tool "bash" timed out',
    code: 'TOOL_TIMEOUT',
    suggestedFix: 'timeout',
    tool: 'bash',
    outputTail: '…[timed out after 5000ms]',
    ...overrides,
  }
}

function props(view: FailureForensicsView | undefined, turn = 1): FailureDetailProps {
  const projections: Record<string, unknown> =
    view === undefined ? {} : { failureForensics: view }
  return {
    t,
    matched: { turn },
    turn: { kind: 'turn', turn: { turn }, start: {}, end: undefined },
    useProjection: ((key: string) => projections[key]) as FailureDetailProps['useProjection'],
  } as unknown as FailureDetailProps
}

afterEach(cleanup)

describe('FailureDetail', () => {
  it('renders nothing for a turn without forensic entries', () => {
    const { container } = render(createElement(FailureDetail, props(undefined)))
    expect(container.firstChild).toBeNull()
    const otherTurn = render(
      createElement(FailureDetail, props({ entries: [entry({})] }, 7)),
    )
    expect(otherTurn.container.firstChild).toBeNull()
  })

  it('shows the newest entry first and expands fields, fix hint, and output tail', () => {
    render(createElement(FailureDetail, props({
      entries: [
        entry({}),
        entry({
          seq: 12,
          kind: 'model-error',
          message: 'provider exploded',
          code: 'PROVIDER',
          suggestedFix: null,
          requestId: 'req-9',
        }),
      ],
    })))
    const heads = screen.getAllByRole('button')
    expect(heads[0]?.textContent).toContain(en['detail.kind.model-error'])
    expect(heads[1]?.textContent).toContain(en['detail.kind.tool-timeout'])
    expect(screen.queryByText(en['detail.fix.timeout'])).toBeNull()
    fireEvent.click(heads[0] as Element)
    expect(screen.getByText('req-9')).toBeTruthy()
    expect(screen.queryByText(en['detail.fix.timeout'])).toBeNull()
    fireEvent.click(heads[1] as Element)
    expect(screen.getByText(en['detail.fix.timeout'])).toBeTruthy()
    expect(screen.getAllByText(/timed out after 5000ms/).length).toBeGreaterThan(0)
  })
})
