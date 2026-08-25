/** Package-owned model-hosting event-grammar invariants. @module @deepseek-ai/dsh-models/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { DownloadId, ModelDownloadOutcome, ModelLoadStatus } from './types.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-models'

/** Cordis companion plugin name. */
export const name = 'models-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Committed load-status transitions. Any status may be the first observed one
 * for a model; every later emission must follow this table and change the
 * status.
 */
const LEGAL_LOAD_TRANSITIONS: Readonly<Record<ModelLoadStatus, readonly ModelLoadStatus[]>> = {
  unloaded: ['loading'],
  loading: ['loaded', 'failed', 'unloading'],
  loaded: ['unloading'],
  unloading: ['unloaded', 'failed'],
  failed: ['unloaded', 'loading'],
}

/** Require byte counters on a snapshot or progress payload to be well-formed. */
function validateByteCounts(
  label: string,
  bytesReceived: number,
  bytesTotal: number | null,
  fail: InvariantFailure,
): void {
  if (!Number.isSafeInteger(bytesReceived) || bytesReceived < 0) {
    fail(`${label} bytesReceived must be a non-negative safe integer, got ${bytesReceived}`)
  }
  if (bytesTotal !== null && (!Number.isSafeInteger(bytesTotal) || bytesTotal <= 0)) {
    fail(`${label} bytesTotal must be null or a positive safe integer, got ${bytesTotal}`)
  }
  if (bytesTotal !== null && bytesReceived > bytesTotal) {
    fail(`${label} received ${bytesReceived} bytes beyond reported total ${bytesTotal}`)
  }
}

/** Require a settled outcome to carry the fields its result promises. */
function validateOutcome(outcome: ModelDownloadOutcome, fail: InvariantFailure): void {
  switch (outcome.result) {
    case 'completed':
      if (outcome.entry.path.length === 0) fail('completed download produced an entry with an empty path')
      break
    case 'cancelled':
      break
    case 'failed':
      if (outcome.message.length === 0) fail('failed download settled without an error message')
      break
    default:
      fail(`unknown download outcome ${JSON.stringify(outcome)}`)
  }
}

/** Track download jobs and load-state transitions across all providers. */
const install: InvariantInstaller = (ctx, fail) => {
  const startedDownloads = new Set<string>()
  const settledDownloads = new Set<string>()
  const lastProgress = new Map<string, number>()
  const loadStates = new Map<string, ModelLoadStatus>()

  ctx.on('models/download-started', ({ download }) => {
    if (startedDownloads.has(download.id)) fail(`download ${download.id} started twice`)
    if (settledDownloads.has(download.id)) fail(`download ${download.id} restarted after settling`)
    validateByteCounts(`download ${download.id} snapshot`, download.bytesReceived, download.bytesTotal, fail)
    startedDownloads.add(download.id)
    lastProgress.set(download.id, download.bytesReceived)
  }, { global: true })

  ctx.on('models/download-progress', ({ downloadId, bytesReceived, bytesTotal }) => {
    if (!startedDownloads.has(downloadId)) fail(`progress for unknown download ${downloadId}`)
    if (settledDownloads.has(downloadId)) fail(`progress for settled download ${downloadId}`)
    validateByteCounts(`download ${downloadId} progress`, bytesReceived, bytesTotal, fail)
    const previous = lastProgress.get(downloadId)
    if (previous !== undefined && bytesReceived < previous) {
      fail(`download ${downloadId} progress moved backwards: ${previous} → ${bytesReceived}`)
    }
    lastProgress.set(downloadId, bytesReceived)
  }, { global: true })

  ctx.on('models/download-settled', ({ downloadId, outcome }: { downloadId: DownloadId; outcome: ModelDownloadOutcome }) => {
    if (!startedDownloads.has(downloadId)) fail(`settle for unknown download ${downloadId}`)
    if (settledDownloads.has(downloadId)) fail(`download ${downloadId} settled twice`)
    validateOutcome(outcome, fail)
    settledDownloads.add(downloadId)
    lastProgress.delete(downloadId)
  }, { global: true })

  ctx.on('models/load-state', ({ modelId, state }: { modelId: string; state: { status: ModelLoadStatus } }) => {
    const previous = loadStates.get(modelId)
    if (previous === undefined) {
      // First sight seeds the baseline: providers may adopt models whose load
      // predates this mount, so any status is a legal starting point.
      loadStates.set(modelId, state.status)
      return
    }
    if (previous === state.status) {
      fail(`model ${modelId} re-emitted status "${previous}" without changing`)
    }
    if (!LEGAL_LOAD_TRANSITIONS[previous].includes(state.status)) {
      fail(`illegal load transition for model ${modelId}: ${previous} → ${state.status}`)
    }
    loadStates.set(modelId, state.status)
  }, { global: true })
}

/**
 * Register the models invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
