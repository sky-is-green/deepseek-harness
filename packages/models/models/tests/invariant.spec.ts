import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { localModelId, modelDownloadId } from '@deepseek-ai/dsh-models'
import type { ModelCatalogEntry, ModelDownloadSnapshot } from '@deepseek-ai/dsh-models'
import * as ModelsInvariantCompanion from '@deepseek-ai/dsh-models/invariant'
import InvariantRegistry, { InvariantError } from '@deepseek-ai/dsh-invariants'

const ENTRY: ModelCatalogEntry = {
  id: localModelId('m1'),
  name: 'M1',
  kind: 'llm',
  format: 'gguf',
  path: '/models/m1.gguf',
  sizeBytes: 1,
}

const MODEL = ENTRY.id

function download(id: string): ModelDownloadSnapshot {
  return {
    id: modelDownloadId(id),
    request: { source: { kind: 'huggingface', repo: 'r/f', file: 'm.gguf' }, name: 'm', kind: 'llm' },
    destinationPath: '/models/m.gguf',
    bytesReceived: 0,
    bytesTotal: null,
  }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(ModelsInvariantCompanion)
  return ctx
}

describe('models event-grammar invariants', () => {
  it('accepts a canonical download and load lifecycle', async () => {
    const ctx = await setup()
    const handle = download('d1')
    expect(() => { ctx.emit('models/download-started', { download: handle }) }).not.toThrow()
    expect(() => { ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: 5, bytesTotal: 10 }) }).not.toThrow()
    expect(() => { ctx.emit('models/download-settled', { downloadId: handle.id, outcome: { result: 'completed', entry: ENTRY } }) }).not.toThrow()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loading' } }) }).not.toThrow()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loaded' } }) }).not.toThrow()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'unloading' } }) }).not.toThrow()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'unloaded' } }) }).not.toThrow()
  })

  it('rejects progress for an unknown download', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('models/download-progress', { downloadId: modelDownloadId('ghost'), bytesReceived: 1, bytesTotal: null }) })
      .toThrow(expect.objectContaining<Partial<InvariantError>>({
        code: 'INVARIANT',
        packageName: '@deepseek-ai/dsh-models',
      }))
  })

  it('rejects progress after settlement and double settlement', async () => {
    const ctx = await setup()
    const handle = download('d2')
    ctx.emit('models/download-started', { download: handle })
    ctx.emit('models/download-settled', { downloadId: handle.id, outcome: { result: 'cancelled' } })
    expect(() => { ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: 1, bytesTotal: null }) }).toThrow(InvariantError)
    expect(() => { ctx.emit('models/download-settled', { downloadId: handle.id, outcome: { result: 'cancelled' } }) }).toThrow(InvariantError)
  })

  it('rejects non-monotonic and out-of-range byte counts', async () => {
    const ctx = await setup()
    const handle = download('d3')
    ctx.emit('models/download-started', { download: handle })
    expect(() => { ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: -1, bytesTotal: null }) }).toThrow(InvariantError)
    expect(() => { ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: 20, bytesTotal: 10 }) }).toThrow(InvariantError)
    ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: 5, bytesTotal: 10 })
    expect(() => { ctx.emit('models/download-progress', { downloadId: handle.id, bytesReceived: 4, bytesTotal: 10 }) }).toThrow(InvariantError)
  })

  it('rejects an illegal load transition and an unchanged re-emission', async () => {
    const ctx = await setup()
    ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loading' } })
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'unloaded' } }) }).toThrow(/illegal load transition/)
    ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loaded' } })
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loaded' } }) }).toThrow(/without changing/)
  })

  it('accepts any first-sight status (provider adoption) but enforces the grammar afterwards', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loaded' } }) }).not.toThrow()
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'loading' } }) }).toThrow(/illegal load transition/)
    expect(() => { ctx.emit('models/load-state', { modelId: MODEL, state: { status: 'unloading' } }) }).not.toThrow()
  })

  it('rejects a failed settle without a message', async () => {
    const ctx = await setup()
    const handle = download('d4')
    ctx.emit('models/download-started', { download: handle })
    expect(() => { ctx.emit('models/download-settled', { downloadId: handle.id, outcome: { result: 'failed', message: '' } }) })
      .toThrow(/without an error message/)
  })
})
