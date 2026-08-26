/**
 * Shared test fixture: an in-process Hugging Face-compatible hub serving fixed
 * payloads through HEAD + ranged GETs.
 *
 * Special files unless overridden:
 * - files named `slow*` stall after the first byte so tests can cancel mid-stream;
 * - `bad.gguf` advertises a wrong sha256 so integrity verification fails;
 * - repositories under `org/missing` answer 404.
 */

import { createHash } from 'node:crypto'
import http from 'node:http'

/**
 * Create the hub server (not yet listening).
 * @param {Buffer} payload - the default bytes every file resolves to.
 * @param {{ etag?: string, advertiseRanges?: boolean, payloads?: Record<string, Buffer> }} [options] - etag overrides the advertised digest for every file, advertiseRanges=false omits the header, payloads maps file names to size-specific bytes.
 * @returns {{ server: import('node:http').Server, state: { lastRange: string | null, ignoreRange: boolean, respond416: boolean } }} the server plus mutable request state for assertions.
 */
export function createHubServer(payload, options = {}) {
  const payloads = { ...options.payloads }
  const shaFor = file => {
    if (file === 'bad.gguf' && payloads['bad.gguf'] === undefined) {
      return createHash('sha256').update(Buffer.from('corrupt')).digest('hex')
    }
    return createHash('sha256').update(payloads[file] ?? payload).digest('hex')
  }
  const state = { lastRange: null, ignoreRange: false, respond416: false }

  /**
   * @param {string | undefined} file - requested file name.
   * @returns {Buffer} the bytes served for that file.
   */
  const bodyFor = file => (file !== undefined && payloads[file]) || payload

  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname.includes('/missing/')) {
      response.writeHead(404)
      response.end()
      return
    }
    const file = pathname.split('/').at(-1) ?? ''
    const body = bodyFor(file)
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'content-length': String(body.length),
        ...(options.advertiseRanges === false ? {} : { 'accept-ranges': 'bytes' }),
        ...(options.etag !== undefined ? { etag: options.etag } : { etag: shaFor(file) }),
      })
      response.end()
      return
    }
    const range = request.headers.range ?? null
    state.lastRange = range
    if (state.respond416 === true && range !== null) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` })
      response.end()
      return
    }
    const effectiveRange = state.ignoreRange === true ? null : range
    if (effectiveRange === null) {
      response.writeHead(200, { 'content-length': String(body.length) })
      if (file.startsWith('slow')) {
        response.write(body.subarray(0, 1))
        return
      }
      response.end(body)
      return
    }
    const start = Number(/bytes=(\d+)-/.exec(effectiveRange)?.[1] ?? 0)
    const slice = body.subarray(start)
    response.writeHead(206, {
      'content-length': String(slice.length),
      'content-range': `bytes ${start}-${body.length - 1}/${body.length}`,
    })
    response.end(slice)
  })
  // Windows loopback + worker-thread pools stall ~200ms per segment without
  // this; fixtures own transport tuning so specs stay about behavior.
  server.on('connection', socket => socket.setNoDelay(true))
  return { server, state }
}
