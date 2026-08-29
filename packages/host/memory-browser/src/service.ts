/**
 * Host memory browser service — registers /v1/memory/* routes.
 * @module @deepseek-ai/dsh-host-memory-browser/service
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { MemoryStore } from './memory.ts'

export const name = 'memoryBrowser'
export const inject = ['webServer'] as const

const MAX_BODY = 1_048_576

/** Single in-process store — the service owns it. */
const store = new MemoryStore()

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new Error('payload too large')
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

/**
 * Register memory browser routes.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  const webServer = (ctx as unknown as { webServer: WebServer }).webServer

  ctx.effect(() => {
    const disposers: Array<() => void> = []

    // GET /v1/memory/:id — inspect
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: '/v1/memory/inspect',
        handler: (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url ?? '/', 'http://x')
          const id = url.searchParams.get('id') ?? ''
          if (!id) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'missing id' }))
            return
          }
          const entry = store.inspect(id)
          if (!entry) {
            res.writeHead(404, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'not found' }))
            return
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(entry))
        },
      }),
    )

    // POST /v1/memory/pin — pin/unpin {id, pinned}
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: '/v1/memory/pin',
        handler: async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.writeHead(405).end()
            return
          }
          try {
            const body = (await readJson(req)) as { id?: string; pinned?: boolean }
            if (!body.id || typeof body.pinned !== 'boolean') {
              res.writeHead(400, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: 'id and pinned required' }))
              return
            }
            const updated = store.pin(body.id, body.pinned)
            if (!updated) {
              res.writeHead(404, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: 'not found' }))
              return
            }
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify(updated))
          } catch {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid JSON' }))
          }
        },
      }),
    )

    // DELETE /v1/memory/:id
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: '/v1/memory/delete',
        handler: (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'DELETE') {
            res.writeHead(405).end()
            return
          }
          const url = new URL(req.url ?? '/', 'http://x')
          const id = url.searchParams.get('id') ?? ''
          if (!id) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'missing id' }))
            return
          }
          const ok = store.delete(id)
          if (!ok) {
            res.writeHead(404, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'not found' }))
            return
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        },
      }),
    )

    // PATCH /v1/memory/edit — {id, content}
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: '/v1/memory/edit',
        handler: async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'PATCH' && req.method !== 'POST') {
            res.writeHead(405).end()
            return
          }
          try {
            const body = (await readJson(req)) as { id?: string; content?: string }
            if (!body.id || typeof body.content !== 'string') {
              res.writeHead(400, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: 'id and content required' }))
              return
            }
            const updated = store.edit(body.id, body.content)
            if (!updated) {
              res.writeHead(404, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: 'not found or empty' }))
              return
            }
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify(updated))
          } catch {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid JSON' }))
          }
        },
      }),
    )

    return () => {
      for (const d of disposers) d()
    }
  }, 'memory-browser routes')
}

export { MemoryStore }
