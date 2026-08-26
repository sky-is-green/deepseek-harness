// @vitest-environment jsdom
/**
 * The palette window: opens on Ctrl/Cmd+K, filters the roster by query,
 * executes a host entry through the injected face, drills into a popup
 * entry's option list, and surfaces load failures inline. Props are fed
 * directly (the sanctioned zero-machinery path); `t` mirrors the zh lookup.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CommandPalette } from '../src/client/CommandPalette.tsx'
import type { CommandPaletteProps } from '../src/client/CommandPalette.tsx'
import type { PaletteInjected } from '../src/client/slots.ts'
import type { CommandPaletteEntry } from '@deepseek-ai/dsh-client-ui-commands/client'
import { zh } from '../src/client/locales.ts'

function t(key: string, params?: Record<string, unknown>): string {
  return Object.entries(params ?? {}).reduce(
    (line, [name, value]) => line.replaceAll(`{${name}}`, String(value)),
    zh[key as keyof typeof zh],
  )
}

const hostEntry: CommandPaletteEntry = { name: 'compact', description: '压缩上下文', kind: 'host' }

afterEach(cleanup)
const popupEntry: CommandPaletteEntry = {
  name: 'model',
  description: '选择模型',
  kind: 'popup',
  options: async () => [
    { id: 'a', label: '模型 A', detail: 'DeepSeek' },
    { id: 'b', label: '模型 B' },
  ],
  onSelect: async () => {},
}

function face(overrides: Partial<PaletteInjected> = {}): PaletteInjected {
  return {
    available: true,
    entries: async () => [hostEntry, popupEntry],
    executeHost: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function props(overrides: Partial<CommandPaletteProps> = {}): CommandPaletteProps {
  return { available: true, entries: () => face().entries(), executeHost: name => face().executeHost(name), t, ...overrides }
}

async function openPalette(propsOverrides: Partial<CommandPaletteProps> = {}) {
  const view = render(<CommandPalette {...props(propsOverrides)} />)
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
  await screen.findByPlaceholderText(zh['palette.placeholder'])
  return view
}

describe('command palette', () => {
  it('stays closed until Ctrl/Cmd+K and renders nothing without a session', () => {
    const view = render(<CommandPalette {...props({ available: false })} />)
    expect(view.baseElement.textContent).toBe('')
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(view.baseElement.textContent).toBe('')
  })

  it('lists entries once opened and filters by name or description substring', async () => {
    const { baseElement } = await openPalette()
    expect(baseElement.textContent).toContain('/compact')
    expect(baseElement.textContent).toContain('/model')
    fireEvent.change(screen.getByPlaceholderText(zh['palette.placeholder']), { target: { value: '压缩' } })
    expect(baseElement.textContent).toContain('/compact')
    expect(baseElement.textContent).not.toContain('/model')
    fireEvent.change(screen.getByPlaceholderText(zh['palette.placeholder']), { target: { value: '没有这个词' } })
    await waitFor(() =>{  expect(screen.getByText(zh['palette.empty'])).toBeTruthy() })
  })

  it('executes the active host entry with Enter and closes', async () => {
    const executeHost = vi.fn().mockResolvedValue(undefined)
    render(<CommandPalette {...props({ executeHost })} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await screen.findByPlaceholderText(zh['palette.placeholder'])
    // Roster order is stable; Enter runs row 0 (the host entry).
    fireEvent.keyDown(screen.getByPlaceholderText(zh['palette.placeholder']), { key: 'Enter' })
    await waitFor(() =>{  expect(executeHost).toHaveBeenCalledWith('compact') })
    await waitFor(() =>{  expect(screen.queryByText('/compact')).toBeNull() })
  })

  it('keeps the palette open with the failure reason when a host execute rejects', async () => {
    const executeHost = vi.fn().mockRejectedValue(new Error('transport down'))
    render(<CommandPalette {...props({ executeHost })} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await screen.findByPlaceholderText(zh['palette.placeholder'])
    fireEvent.keyDown(screen.getByPlaceholderText(zh['palette.placeholder']), { key: 'Enter' })
    await waitFor(() =>{  expect(screen.getByText(t('palette.executeError', { message: 'transport down' }))).toBeTruthy() })
    expect(screen.getByText('/compact')).toBeTruthy()
  })

  it('drills into a popup entry and runs the picked option', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined)
    const entry: CommandPaletteEntry = { ...popupEntry, onSelect }
    render(<CommandPalette {...props({ entries: async () => [entry] })} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await screen.findByPlaceholderText(zh['palette.placeholder'])
    // Row 0 is the only command; Enter opens its option stage.
    fireEvent.keyDown(screen.getByPlaceholderText(zh['palette.placeholder']), { key: 'Enter' })
    await waitFor(() =>{  expect(screen.getByText('/model 模型 A')).toBeTruthy() })
    fireEvent.click(screen.getByRole('option', { name: '/model 模型 B' }))
    await waitFor(() =>{  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' })) })
  })

  it('shows an inline error when a popup option list fails to load', async () => {
    const entry: CommandPaletteEntry = {
      ...popupEntry,
      options: async () => { throw new Error('rpc lost') },
    }
    render(<CommandPalette {...props({ entries: async () => [entry] })} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await screen.findByPlaceholderText(zh['palette.placeholder'])
    fireEvent.keyDown(screen.getByPlaceholderText(zh['palette.placeholder']), { key: 'Enter' })
    await waitFor(() =>{  expect(screen.getByText(t('palette.optionLoadError', { message: 'model: rpc lost' }))).toBeTruthy() })
  })

  it('shows an inline error when the roster fails to load', async () => {
    render(<CommandPalette {...props({ entries: async () => { throw new Error('offline') } })} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() =>{  expect(screen.getByText(t('palette.loadError', { message: 'offline' }))).toBeTruthy() })
  })

  it('navigates rows with arrow keys before executing', async () => {
    const executeHost = vi.fn().mockResolvedValue(undefined)
    const input = await openPalette({ executeHost }).then(view => view)
    const search = input.getByPlaceholderText(zh['palette.placeholder'])
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() =>{  expect(executeHost).toHaveBeenCalledWith('compact') })
  })
})
