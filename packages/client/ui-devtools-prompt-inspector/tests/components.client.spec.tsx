// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PromptInspectorViewProps } from '../src/client/PromptInspectorView.tsx'
import { PromptInspectorView } from '../src/client/PromptInspectorView.tsx'
import type {
  InspectorHeaderRow, PromptInspectorSnapshot,
} from '../src/client/contract.ts'
import type { PromptInspectorKey } from '../src/client/locales.ts'
import { en } from '../src/client/locales.ts'

const t = ((
  key: PromptInspectorKey,
  params?: Record<string, string | number>,
): string => {
  const template = en[key]
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]))
}) as PromptInspectorViewProps['t']

function headerRow(seq: number, overrides: Partial<InspectorHeaderRow> = {}): InspectorHeaderRow {
  return {
    seq,
    time: 1_700_000_000_000 + seq,
    prompt: {
      config: { provider: 'test', model: 'model-a' },
      system: 'you are a test',
      tools: [{ name: 'read_file', description: 'Read a file.', parameters: {} }],
    },
    initial: seq === 1,
    systemChanged: false,
    toolsChanged: false,
    location: { kind: 'unresolved' },
    ...overrides,
  }
}

function snapshot(overrides: Partial<PromptInspectorSnapshot> = {}): PromptInspectorSnapshot {
  return {
    headers: [headerRow(2, { systemChanged: true }), headerRow(1)],
    contexts: [{
      seq: 3,
      time: 0,
      role: 'inject',
      label: 'dsh-hive',
      form: null,
      preview: 'curated block',
    }],
    ...overrides,
  }
}

function props(snapshotValue: PromptInspectorSnapshot): PromptInspectorViewProps {
  return {
    t,
    useSession: ((selector: (snapshot: ConversationSnapshot) => unknown) =>
      selector({
        views: {
          // Test stub: serves only the inspector target; the generic wire
          // signature is cast because no single value can satisfy every key.
          get: ((target: string) =>
            target === 'prompt-inspector' ? snapshotValue : undefined) as never,
        },
      } as unknown as ConversationSnapshot)) as PromptInspectorViewProps['useSession'],
    useProjection: ((key: string) => key === 'contextBreakdown'
      ? { systemTokens: 10, toolsTokens: 20, messageTokens: 30 }
      : undefined) as PromptInspectorViewProps['useProjection'],
  } as PromptInspectorViewProps
}

afterEach(cleanup)

describe('PromptInspectorView', () => {
  it('renders the composition figures, usage rows are absent without usage, and the context row', () => {
    render(createElement(PromptInspectorView, props(snapshot())))
    expect(screen.getByText('~10')).toBeTruthy()
    expect(screen.getByText('~20')).toBeTruthy()
    expect(screen.getByText('~30')).toBeTruthy()
    expect(screen.queryByText(en['tokens.usage.title'])).toBeFalsy()
    expect(screen.getByText('curated block')).toBeTruthy()
    expect(screen.getByText('dsh-hive')).toBeTruthy()
  })

  it('lists request headers newest first and expands one on click', () => {
    render(createElement(PromptInspectorView, props(snapshot())))
    const summaries = screen.getAllByRole('button')
    expect(summaries).toHaveLength(2)
    expect(summaries[0]?.textContent).toContain('#2')
    expect(summaries[1]?.textContent).toContain('#1')
    expect(screen.queryByText(en['requests.systemHeading'])).toBeFalsy()
    fireEvent.click(summaries[0] as Element)
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy()
    expect(screen.getAllByText(en['requests.systemHeading'])).toHaveLength(1)
    expect(screen.getByText('you are a test')).toBeTruthy()
    expect(screen.getByText('read_file')).toBeTruthy()
  })

  it('shows the empty-state copy when nothing is assembled yet', () => {
    render(createElement(PromptInspectorView, props({ headers: [], contexts: [] })))
    expect(screen.getByText(en['requests.empty'])).toBeTruthy()
    expect(screen.getByText(en['contexts.empty'])).toBeTruthy()
  })
})
