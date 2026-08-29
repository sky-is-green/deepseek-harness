/**
 * Host embeddings service — registers POST /v1/embeddings on webServer.
 * @module @deepseek-ai/dsh-host-embeddings/service
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { handleEmbeddingsRequest } from './embeddings.ts'

export const name = 'embeddings'
export const inject = ['webServer'] as const

/** Body limit for embeddings requests (1 MiB). */
const MAX_BODY_BYTES = 1_048_576

/**
 * Register the embeddings route.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  const webServer = (ctx as unknown as { webServer: WebServer }).webServer

  ctx.effect(() => {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/v1/embeddings',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'method not allowed', type: 'invalid_request_error' } }))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of req) {
          size += (chunk as Buffer).length
          if (size > MAX_BODY_BYTES) {
            res.writeHead(413, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: { message: 'payload too large', type: 'invalid_request_error' } }))
            return
          }
          chunks.push(chunk as Buffer)
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        let body: unknown
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'invalid JSON', type: 'invalid_request_error' } }))
          return
        }
        const result = handleEmbeddingsRequest(body)
        if (!result.ok) {
          res.writeHead(result.status, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: result.error, type: 'invalid_request_error' } }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result.response))
      },
    })
    return dispose
  }, 'embeddings /v1/embeddings route')
}
