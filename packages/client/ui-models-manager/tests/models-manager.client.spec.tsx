// @vitest-environment jsdom
/**
 * The models-manager section: renders the mirrored catalog with load-state
 * badges and Load/Unload routing, download rows with determinate and
 * indeterminate progress, the download form's required-field guard, and
 * error surfacing. Props are fed directly; the store is driven through its
 * sanctioned actions.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModelsManager, type ModelsSnapshot } from '../src/client/ModelsManager.tsx'
import { createModelsManagerStore, type ModelsManagerActions } from '../src/store.ts'
import type { ModelsManagerStore } from '../src/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

function t(key: string, params?: Record<string, unknown>): string {
  return Object.entries(params ?? {}).reduce(
    (line, [name, value]) => line.replaceAll(`{${name}}`, String(value)),
    zh[key as keyof typeof zh],
  )
}

const entry = {
  id: 'm1' as never,
  name: 'Qwen3 0.6B',
  kind: 'llm' as const,
  format: 'gguf' as const,
  path: '/models/qwen3.gguf',
  sizeBytes: 4 * 1024 * 1024 * 1024,
  architecture: 'qwen3',
  quantization: 'Q4_K_M',
}

/** Seed a store + wire the component to it through a subscribing hook (the hooks-bound shape). */
function bench(seed?: (store: ModelsManagerStore & ModelsManagerActions) => void) {
  const store = createModelsManagerStore()
  seed?.(store)
  const requestLoad = vi.fn()
  const requestUnload = vi.fn()
  const startDownload = vi.fn()
  const cancelDownload = vi.fn()
  const load = vi.fn()
  function useModels<S>(selector: (state: ModelsSnapshot) => S): S {
    return selector(useSyncExternalStore(cb => store.subscribe(cb), () => store.getSnapshot()))
  }
  const view = render(<ModelsManager
    useModels={useModels}
    load={load}
    requestLoad={requestLoad}
    requestUnload={requestUnload}
    startDownload={startDownload}
    cancelDownload={cancelDownload}
    t={t}
  />)
  return { view, store, requestLoad, requestUnload, startDownload, cancelDownload, load }
}

describe('models manager section', () => {
  it('shows the pending row before the first catalog pull and pulls on mount', () => {
    const { load } = bench()
    expect(screen.getByText(zh['manager.pending'])).toBeTruthy()
    expect(load).toHaveBeenCalledExactlyOnceWith()
  })

  it('renders catalog cards with metadata and routes Load/Unload by state', async () => {
    const { store, requestLoad, requestUnload } = await Promise.resolve(bench((store) => {
      store.replaceCatalog([entry], {})
      store.setLoadState(entry.id, { status: 'unloaded' })
    }))
    expect(screen.getByText('Qwen3 0.6B')).toBeTruthy()
    expect(screen.getByText(/qwen3 · Q4_K_M · 4\.0 GB/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.load'] }))
    expect(requestLoad).toHaveBeenCalledWith('m1')
    // State flips to loaded via the mirrored event: the button becomes Unload.
    store.setLoadState(entry.id, { status: 'loaded' })
    await waitFor(() =>{  expect(screen.getByRole('button', { name: zh['manager.unload'] })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: zh['manager.unload'] }))
    expect(requestUnload).toHaveBeenCalledWith('m1')
  })

  it('a failed load state shows its message and offers retry', () => {
    bench((store) => {
      store.replaceCatalog([entry], {})
      store.setLoadState(entry.id, { status: 'failed', message: 'llama.cpp exited' })
    })
    expect(screen.getByText('llama.cpp exited')).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['manager.load'] })).toBeTruthy()
  })

  it('a loading state shows an indeterminate activity bar beside the busy label', () => {
    const { view } = bench((store) => {
      store.replaceCatalog([entry], {})
      store.setLoadState(entry.id, { status: 'loading' })
    })
    const fill = view.container.querySelector('[class*="bar"] [class*="fill"]') as HTMLElement
    expect(fill).toBeTruthy()
    expect(fill.dataset.indeterminate).toBeDefined()
    // The badge itself carries the state copy; no second busy label.
    expect(screen.getAllByText(zh['manager.loading']).length).toBe(1)
  })

  it('renders a determinate bar while totals exist and an indeterminate one without', async () => {
    const { view, store } = bench((store) => {
      store.upsertDownload({
        id: 'd1' as never,
        request: { source: { kind: 'huggingface', repo: 'org/repo', file: 'm.gguf' }, name: 'm.gguf', kind: 'llm' },
        destinationPath: '/models/m.gguf',
        bytesReceived: 250,
        bytesTotal: 1000,
      })
    })
    const fill = view.container.querySelector('[class*="fill"]') as HTMLElement
    expect(fill.style.width).toBe('25%')
    // A total-less update flips the same row to indeterminate.
    store.updateProgress('d1' as never, 300, null)
    await waitFor(() =>{  expect((view.container.querySelector('[class*="fill"]') as HTMLElement).dataset.indeterminate).toBeDefined() })
  })

  it('cancel routes to the injected face; settled downloads drop their row', async () => {
    const { store, cancelDownload } = bench((store) => {
      store.upsertDownload({
        id: 'd1' as never,
        request: { source: { kind: 'huggingface', repo: 'org/repo', file: 'm.gguf' }, name: 'm.gguf', kind: 'llm' },
        destinationPath: '/models/m.gguf',
        bytesReceived: 0,
        bytesTotal: null,
      })
    })
    fireEvent.click(screen.getByRole('button', { name: zh['manager.cancel'] }))
    expect(cancelDownload).toHaveBeenCalledWith('d1')
    store.settleDownload('d1' as never)
    await waitFor(() =>{  expect(screen.queryByRole('button', { name: zh['manager.cancel'] })).toBeNull() })
  })

  it('the download form requires repo and file and submits trimmed values', async () => {
    const { store, startDownload } = bench((store) => { store.replaceCatalog([entry], {}) })
    const submit = () => fireEvent.click(screen.getByRole('button', { name: zh['manager.download'] }))
    submit()
    expect(startDownload).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText(zh['manager.form.repo']), { target: { value: ' Qwen/Qwen3-GGUF ' } })
    submit()
    expect(startDownload).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText(zh['manager.form.file']), { target: { value: ' q4.gguf ' } })
    fireEvent.change(screen.getByPlaceholderText(zh['manager.form.name']), { target: { value: ' Qwen3 小杯 ' } })
    fireEvent.change(screen.getByLabelText(zh['manager.form.kind']), { target: { value: 'embedding' } })
    submit()
    expect(startDownload).toHaveBeenCalledWith('Qwen/Qwen3-GGUF', 'q4.gguf', 'Qwen3 小杯', 'embedding')
    void store
  })

  it('the empty roster shows the empty sentence once loaded', () => {
    bench((store) => { store.replaceCatalog([], {}) })
    expect(screen.getByText(zh['manager.empty'])).toBeTruthy()
  })
})
