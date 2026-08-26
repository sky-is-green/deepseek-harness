/**
 * Remote file resolution against a Hugging Face-compatible hub: one HEAD
 * probe per fetch returns the final redirect URL plus any strong integrity
 * expectation before bytes start moving.
 * @module
 */

import type { RemoteFileInfo, RemoteFileRef } from './types.ts'

const SHA256_HEX = /^[0-9a-f]{64}$/

function encodeSegments(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/')
}

/**
 * Probe one remote file with HEAD, following redirects.
 * @param baseUrl - hub root URL; trailing slashes are normalized away.
 * @param ref - repository and file to resolve.
 * @returns the final URL, reported length, and sha256 expectation when served.
 * @throws when the hub answers with a non-2xx status; no probe retry exists — callers decide policy.
 */
export async function resolveRemoteFile(baseUrl: string, ref: RemoteFileRef): Promise<RemoteFileInfo> {
  const url = `${baseUrl.replace(/\/+$/, '')}/${encodeSegments(ref.repo)}/resolve/main/${encodeSegments(ref.file)}`
  const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`model-downloads: resolving ${ref.repo}/${ref.file} failed with HTTP ${response.status}`)
  }
  const etag = (response.headers.get('etag') ?? '').replaceAll('"', '').trim()
  const lengthHeader = response.headers.get('content-length')
  return {
    url: response.url,
    totalBytes: lengthHeader !== null && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null,
    expectedSha256: SHA256_HEX.test(etag) ? etag.toLowerCase() : null,
  }
}
