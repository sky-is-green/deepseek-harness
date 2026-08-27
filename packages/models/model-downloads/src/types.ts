/**
 * Vocabulary for the ranged-download engine behind `ctx.models` providers.
 * Types only — runtime code lives in `resolve.ts` and `fetch-file.ts`.
 * @module
 */

/** Source reference of one downloadable file on a Hugging Face-compatible hub. */
export interface RemoteFileRef {
  /** Repository id (`owner/name`). */
  readonly repo: string
  /** Path of the file inside the repository. */
  readonly file: string
}

/** Server-declared facts about one remote file, learned from a HEAD probe. */
export interface RemoteFileInfo {
  /** Final URL after redirect following; the URL GET requests must use. */
  readonly url: string
  /** Server-reported size in bytes, or `null` when undeclared. */
  readonly totalBytes: number | null
  /** Strong integrity expectation (LFS-style sha256 etag), or `null` when absent. */
  readonly expectedSha256: string | null
}

/** One progress sample for a running transfer. */
export interface DownloadProgress {
  /** Cumulative received byte count. */
  readonly bytesReceived: number
  /** Server-reported total, or `null` when unknown. */
  readonly bytesTotal: number | null
}

/** Terminal result of one {@link fetchToFile} call; failures reject instead. */
export type FetchOutcome =
  | { readonly result: 'completed'; readonly bytesReceived: number }
  | { readonly result: 'cancelled' }
