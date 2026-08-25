// @vitest-environment jsdom
/**
 * The global search dialog: opens on Ctrl/Cmd+Shift+F, debounces queries
 * with per-request cancellation (a faster keystroke supersedes the slower
 * one and an aborted response never writes), joins titles, navigates listed
 * hits only, and surfaces error/empty/hasMore states. Props are fed
 * directly; `t` mirrors the zh lookup.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SearchDialog } from '../src/client/SearchDialog.tsx'
import type { SearchDialogProps } from '../src/client/SearchDialog.tsx'
import { zh } from '../src/client/locales.ts'
import type { SearchHit } from '../src/client/slots.ts'

afterEach(cleanup)

function t(key: string, params?: Record<string, unknown>): string {
  return Object.entries(params ?? {}).reduce(
    (line, [name, value]) => line.replaceAll(`{${name}}`, String(value)),
    zh[key as keyof typeof zh],
  )
}

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  sessionId: 's1' as never,
  title: '修复登录',
  snippet: '…登录页的 token 刷新…',
  openable: true,
  ...over,
})

function props(overrides: Partial<SearchDialogProps> = {}): SearchDialogProps {
  return {
    available: true,
    searchSessions: async () => ({ hits: [hit()], hasMore: false }),
    openSession: vi.fn(),
    t,
    ...overrides,
  }
}

async function open(view = render(<SearchDialog {...props()} />)) {
  fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
  await screen.findByPlaceholderText(zh['search.placeholder'])
  return view
}

describe('global search dialog', () => {
  it('stays closed until Ctrl/Cmd+Shift+F and mounts nothing without sessions', () => {
    const view = render(<SearchDialog {...props({ available: false })} />)
    expect(view.container.textContent).toBe('')
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    expect(view.container.textContent).toBe('')
  })

  it('debounces keystrokes into one request per settle', async () => {
    const searchSessions = vi.fn(async () => ({ hits: [], hasMore: false }))
    render(<SearchDialog {...props({ searchSessions })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const input = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: '登' } })
    fireEvent.change(input, { target: { value: '登录' } })
    expect(searchSessions).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      if (searchSessions.mock.calls.length !== 1) throw new Error('not settled yet')
      expect(searchSessions).toHaveBeenCalledExactlyOnceWith('登录', expect.any(AbortSignal))
    }, { timeout: 2000, interval: 50 })
  })

  it('renders joined hits, navigates a listed hit on click, and closes', async () => {
    const openSession = vi.fn()
    const view = await open(render(<SearchDialog {...props({ openSession })} />))
    const input = screen.getByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: '登录' } })
    const row = await screen.findByRole('option', { name: /修复登录/ })
    fireEvent.click(row)
    expect(openSession).toHaveBeenCalledWith('s1')
    await waitFor(() =>{  expect(screen.queryByText('/')).toBeNull() })
    expect(view.baseElement.textContent).not.toContain('修复登录')
  })

  it('marks unlisted hits inert: clicking navigates nothing', async () => {
    const openSession = vi.fn()
    render(<SearchDialog {...props({
      openSession,
      searchSessions: async () => ({ hits: [hit({ sessionId: 'ghost' as never, title: 'ghost', openable: false })], hasMore: false }),
    })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const input = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: 'x' } })
    const row = await screen.findByRole('option', { name: /ghost/ })
    fireEvent.click(row)
    expect(openSession).not.toHaveBeenCalled()
    expect(screen.getByText(zh['search.notLoaded'])).toBeTruthy()
  })

  it('an aborted superseded response never overwrites the latest results', async () => {
    // Two settles >DEBOUNCE apart, so BOTH requests fly: the first hangs
    // until its own signal aborts (supersession), the second resolves.
    const searchSessions = vi.fn()
      .mockImplementationOnce((_q: string, signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () =>{  reject(new Error('aborted')) })
        }))
      .mockImplementationOnce(async () => ({ hits: [hit({ title: '最新' })], hasMore: false }))
    render(<SearchDialog {...props({ searchSessions: searchSessions as never })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const input = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: 'a' } })
    await new Promise((resolve) => { setTimeout(resolve, 350) })
    fireEvent.change(input, { target: { value: 'ab' } })
    await screen.findByText(/最新/)
    expect(screen.queryByText(t('search.error', { message: 'aborted' }))).toBeNull()
  }, 5000)

  it('surfaces transport failures inline and the empty state otherwise', async () => {
    const failing = render(<SearchDialog {...props({
      searchSessions: async () => { throw new Error('rpc lost') },
    })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const input = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: 'x' } })
    await waitFor(() =>{  expect(failing.baseElement.textContent).toContain('rpc lost') })
    cleanup()
    render(<SearchDialog {...props({
      searchSessions: async () => ({ hits: [], hasMore: false }),
    })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const emptyInput = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(emptyInput, { target: { value: '没有' } })
    await screen.findByText(zh['search.empty'])
  })

  it('notes when the result bound was reached', async () => {
    render(<SearchDialog {...props({ searchSessions: async () => ({ hits: [hit()], hasMore: true }) })} />)
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })
    const input = await screen.findByPlaceholderText(zh['search.placeholder'])
    fireEvent.change(input, { target: { value: 'many' } })
    await screen.findByText(zh['search.hasMore'])
  })
})
