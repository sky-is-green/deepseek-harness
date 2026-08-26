/**
 * Download job management for the local provider: acceptance validation
 * against the weights directory, one engine transfer per accepted job,
 * lifecycle reporting through caller-bound callbacks, and cancel/dispose
 * semantics matching the seam's download contract.
 * @module
 */

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { modelDownloadId } from '@deepseek-ai/dsh-models'
import type {
  DownloadId,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadOutcome,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
} from '@deepseek-ai/dsh-models'
import { fetchToFile } from '@deepseek-ai/dsh-model-downloads'

/** Construction dependencies for {@link DownloadJobs}. */
export interface DownloadJobsOptions {
  /** Directory completed weights land in; also the collision-check root. */
  readonly modelsDir: string
  /** Root of the Hugging Face-compatible hub serving resolve URLs. */
  readonly hubBaseUrl: string
  /** Minimum interval between progress reports per job in milliseconds. */
  readonly progressIntervalMs: number
  /** Reads the finished file into its seam catalog entry. */
  buildEntry(path: string, displayName?: string): Promise<ModelCatalogEntry>
  /** Republishes the catalog after a completed entry lands on disk. */
  refreshCatalog(): Promise<void>
  /** Job accepted; carries the initial zero-progress snapshot. */
  onStarted(snapshot: ModelDownloadSnapshot): void
  /** Cumulative bytes arrived for a running job. */
  onProgress(downloadId: DownloadId, bytesReceived: number, bytesTotal: number | null): void
  /** Terminal outcome, emitted exactly once per job. */
  onSettled(downloadId: DownloadId, outcome: ModelDownloadOutcome): void
}

interface RunningJob {
  snapshot: ModelDownloadSnapshot
  controller: AbortController
  done: Promise<ModelDownloadOutcome>
}

/**
 * Owns every running download of one provider. Acceptance is synchronous so
 * invalid requests reject before any handle or network traffic exists.
 */
export class DownloadJobs {
  private sequence = 0
  private readonly running = new Map<DownloadId, RunningJob>()

  constructor(private readonly options: DownloadJobsOptions) {}

  /**
   * Validate and start one download job.
   * @param request - source, display name, and kind for the resulting entry.
   * @returns the live handle whose `done` settles exactly once.
   * @throws loud on unsupported source kinds, non-GGUF targets, an existing
   * destination file, or a duplicate in-flight destination.
   */
  async start(request: ModelDownloadRequest): Promise<ModelDownloadHandle> {
    // Merge-extensible union: new source kinds arrive alongside the provider
    // that serves them; until then refusal stays loud.
    const kind: string = request.source.kind
    if (kind !== 'huggingface') {
      throw new Error(`models-local: no provider for download source kind "${kind}"`)
    }
    const { file } = request.source
    if (!file.toLowerCase().endsWith('.gguf')) {
      throw new Error(`models-local: refusing download of "${file}"; the catalog scans .gguf weights only`)
    }
    const fileName = basename(file)
    const destinationPath = join(this.options.modelsDir, fileName)
    if (existsSync(destinationPath)) {
      throw new Error(`models-local: refusing to overwrite ${fileName}; remove it first`)
    }
    for (const job of this.running.values()) {
      if (job.snapshot.destinationPath === destinationPath) {
        throw new Error(`models-local: ${fileName} is already downloading`)
      }
    }

    try {
      return await Promise.resolve(this.launch(request))
    } catch (error) {
      // Acceptance failures reject so callers awaiting a handle never see a
      // synchronous throw cross the seam.
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Validate one request and hand it to a fresh transfer.
   * @param request - source, display name, and kind for the resulting entry.
   * @returns the live handle whose `done` settles exactly once.
   * @throws loud on unsupported source kinds, non-GGUF targets, an existing
   * destination file, or a duplicate in-flight destination.
   */
  private launch(request: ModelDownloadRequest): ModelDownloadHandle {
    const id = modelDownloadId(`dl-${++this.sequence}`)
    const fileName = basename(request.source.file)
    const snapshot: ModelDownloadSnapshot = {
      id,
      request,
      destinationPath: join(this.options.modelsDir, fileName),
      bytesReceived: 0,
      bytesTotal: null,
    }
    const controller = new AbortController()
    let settled = false
    const settle = (outcome: ModelDownloadOutcome): void => {
      if (settled) return
      settled = true
      this.running.delete(id)
      this.options.onSettled(id, outcome)
    }

    const done = this.runJob(request, id, snapshot, controller.signal, settle)
    const job: RunningJob = { snapshot, controller, done }
    this.running.set(id, job)

    return {
      id,
      done,
      cancel: () => {
        controller.abort()
      },
    }
  }

  /**
   * Drive one transfer to its terminal outcome, reporting acceptance,
   * throttled progress, and settlement through the bound callbacks.
   * @param request - the accepted request; carries repo/file/name.
   * @param id - the job's identifier.
   * @param snapshot - the accepted snapshot, mutated in place as bytes arrive.
   * @param signal - the job's cancellation signal.
   * @param settle - single-shot settlement reporter.
   * @returns the terminal outcome.
   */
  private async runJob(
    request: ModelDownloadRequest,
    id: DownloadId,
    snapshot: ModelDownloadSnapshot,
    signal: AbortSignal,
    settle: (outcome: ModelDownloadOutcome) => void,
  ): Promise<ModelDownloadOutcome> {
    this.options.onStarted(snapshot)
    let lastReportedAt = 0
    let sizeBytes: number
    try {
      const outcome = await fetchToFile({
        baseUrl: this.options.hubBaseUrl,
        ref: request.source,
        destinationPath: snapshot.destinationPath,
        signal,
        onProgress: (sample) => {
          const now = Date.now()
          if (lastReportedAt !== 0 && now - lastReportedAt < this.options.progressIntervalMs) return
          lastReportedAt = now
          Object.assign(snapshot, { bytesReceived: sample.bytesReceived, bytesTotal: sample.bytesTotal })
          this.options.onProgress(id, sample.bytesReceived, sample.bytesTotal)
        },
      })
      if (outcome.result === 'cancelled') {
        settle({ result: 'cancelled' })
        return { result: 'cancelled' }
      }
      sizeBytes = outcome.bytesReceived
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      settle({ result: 'failed', message })
      return { result: 'failed', message }
    }
    // Terminal progress lands even when the throttle swallowed trailing ticks.
    this.reportProgress(snapshot, id, sizeBytes)
    try {
      const entry = await this.options.buildEntry(snapshot.destinationPath, request.name)
      await this.options.refreshCatalog()
      settle({ result: 'completed', entry })
      return { result: 'completed', entry }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      settle({ result: 'failed', message: `downloaded but the catalog entry failed: ${message}` })
      return { result: 'failed', message }
    }
  }

  /**
   * Publish one progress tick for a job, updating its live snapshot first.
   * @param snapshot - the running job's snapshot.
   * @param id - the job's identifier.
   * @param bytesReceived - cumulative received byte count to publish.
   */
  private reportProgress(snapshot: ModelDownloadSnapshot, id: DownloadId, bytesReceived: number): void {
    Object.assign(snapshot, { bytesReceived })
    this.options.onProgress(id, bytesReceived, snapshot.bytesTotal)
  }

  /**
   * Snapshot the jobs that have not settled.
   * @returns one snapshot per running download, in acceptance order; the
   * objects reflect live progress.
   */
  snapshots(): readonly ModelDownloadSnapshot[] {
    return [...this.running.values()].map(job => job.snapshot)
  }

  /**
   * Cancel everything and await settlement — the disposal path.
   * @returns resolves once every job has settled.
   */
  async dispose(): Promise<void> {
    const jobs = [...this.running.values()]
    for (const job of jobs) job.controller.abort()
    await Promise.all(jobs.map(job => job.done))
  }
}
