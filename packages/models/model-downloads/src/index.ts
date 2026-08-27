/**
 * Ranged-download engine for local model hosting: HEAD resolution, Range-
 * resume streaming fetch into a `.part` staging file, sha256 integrity
 * checking, and atomic rename into place. Knows nothing about model catalogs
 * or events — providers own those and call {@link fetchToFile} per job.
 * @module @deepseek-ai/dsh-model-downloads
 */

export { fetchToFile, partPathFor, type FetchToFileOptions } from './fetch-file.ts'
export { resolveRemoteFile } from './resolve.ts'
export type { DownloadProgress, FetchOutcome, RemoteFileInfo, RemoteFileRef } from './types.ts'
