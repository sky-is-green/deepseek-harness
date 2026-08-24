import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, Inbox, type Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import * as dshHive from '@deepseek-ai/dsh-hive'
import type { Config } from '@deepseek-ai/dsh-hive'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const SIGNAL = new AbortController().signal

/** A scripted sidecar stub: records curate/observe requests and replies. */
class StubSidecar {
  readonly server: Server
  readonly requests: { path: string; body: unknown }[] = []
  curateResponse = {
    conversation_id: 'conv', turn: 3, assembled_content: 'CURATED CONTEXT',
    token_count: 900, budget: 1000, mode: 'hive', timings: {}, pes: 80, degradation_level: 0,
  }
  failNext = false
  port = 0

  constructor() {
    this.server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => {
        let body: unknown = {}
        try { body = JSON.parse(raw) } catch { /* keep {} */ }
        this.requests.push({ path: req.url ?? '', body })
        if (this.failNext) {
          this.failNext = false
          res.writeHead(503).end()
          return
        }
        if (req.url === '/v1/hive/curate') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(this.curateResponse))
          return
        }
        if (req.url === '/v1/hive/observe') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, stored: true, turn: 1 }))
          return
        }
        res.writeHead(404).end()
      })
    })
  }

  async listen(): Promise<void> {
    await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve))
    this.port = (this.server.address() as AddressInfo).port
  }

  close(): Promise<void> {
    return new Promise(resolve => this.server.close(() => resolve()))
  }
}

let stub: StubSidecar | undefined

beforeEach(async () => {
  stub = new StubSidecar()
  await stub.listen()
})

afterEach(async () => {
  await stub?.close()
  stub = undefined
})

function baseUrl(): string {
  return `http://127.0.0.1:${stub?.port}`
}

/** A minimal valid session header (version/id/createdAt are required). */
function header(id: string, cwd: string): { version: number; id: string; createdAt: number; cwd: string } {
  return { version: 0, id, createdAt: 0, cwd }
}

async function mount(config: Config = {}) {
  const ctx = new Context()
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionStore)
  const fiber = await ctx.plugin(dshHive, config)
  return { ctx, fiber }
}

function sessionAgent(session: Session, id = 'agent'): Agent {
  return {
    id: SessionId(id),
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'running',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('dsh-hive must append directly to the open step') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

function openTurn(session: Session, turn = 1): void {
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: `turn ${turn}` }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

async function fireStep(
  ctx: Context,
  agent: Agent,
  proposed: ReturnType<typeof createUserMessage>,
  turn = 1,
  step = 1,
): Promise<Awaited<ReturnType<typeof agentEvents<typeof ctx>['waterfall']>> extends infer T ? T : never> {
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [proposed], turn, step, signal: SIGNAL },
    () => Promise.resolve({ kind: 'enter' as const, messages: [proposed] }),
  )
  return decision
}

function pluginTexts(messages: readonly { content: readonly { type: string; text?: string }[] }[]): string[] {
  return messages.flatMap(message => message.content
    .filter(block => block.type === 'text' && block.text !== undefined)
    .map(block => block.text ?? ''))
}

describe('dsh-hive curator', () => {
  it('folds the curated context after the claimed batch', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1').toString(), '/workspace'))
    const agent = sessionAgent(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'How does JWT auth work?' }],
      source: { kind: 'user' },
    })
    const decision = await fireStep(ctx, agent, proposed)
    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    const texts = pluginTexts(decision.messages)
    expect(texts).toContain('CURATED CONTEXT')
    // The curated message must sit after the claimed user message.
    const order = decision.messages.map(message => pluginTexts([message]).join(''))
    expect(order.indexOf('How does JWT auth work?')).toBeLessThan(order.indexOf('CURATED CONTEXT'))
    // The sidecar was asked for this conversation.
    expect(stub?.requests.some(r => r.path === '/v1/hive/curate')).toBe(true)
  })

  it('skips later steps of the same turn', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1').toString(), '/workspace'))
    const agent = sessionAgent(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'tool continuation' }],
      source: { kind: 'plugin', plugin: 'dsh-hive-test' },
    })
    const before = stub?.requests.length ?? 0
    const decision = await fireStep(ctx, agent, proposed, 1, 2)
    expect(decision.kind).toBe('enter')
    expect(stub?.requests.length).toBe(before)
  })

  it('passes through when the sidecar is down (mechanism attribution)', async () => {
    const { ctx } = await mount({ sidecarUrl: 'http://127.0.0.1:1', timeoutMs: 500 })
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1').toString(), '/workspace'))
    const agent = sessionAgent(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'q' }],
      source: { kind: 'user' },
    })
    const decision = await fireStep(ctx, agent, proposed)
    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(pluginTexts(decision.messages)).not.toContain('CURATED CONTEXT')
    expect(decision.messages).toHaveLength(1)
  })

  it('is a no-op when disabled', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl(), enabled: false })
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1').toString(), '/workspace'))
    const agent = sessionAgent(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'q' }],
      source: { kind: 'user' },
    })
    await fireStep(ctx, agent, proposed)
    expect(stub?.requests.length).toBe(0)
  })

  it('observes the assistant reply back to the sidecar', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    // Store-managed session so appends flow through ctx's session/event bus.
    const session = ctx.sessions.create(
      SessionId('s1'), [],
      { version: 0, id: SessionId('s1').toString(), createdAt: 0, cwd: '/workspace' },
    )
    const agent = sessionAgent(session)
    openTurn(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'q' }],
      source: { kind: 'user' },
    })
    await fireStep(ctx, agent, proposed)
    expect(stub?.requests.some(r => r.path === '/v1/hive/curate')).toBe(true)

    session.append('assistant/message', createUserMessage({
      content: [{ type: 'text', text: 'The API allows 100 requests per minute.' }],
      source: { kind: 'assistant' },
    }), { surfaceOp: 'append' })

    // Let the fire-and-forget observe land.
    await new Promise(resolve => setTimeout(resolve, 50))
    const observe = stub?.requests.find(r => r.path === '/v1/hive/observe')
    expect(observe).toBeDefined()
    const body = observe?.body as { reply?: string }
    expect(body?.reply).toContain('100 requests per minute')
  })

  it('does not observe sessions it never curated', async () => {
    await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s2'), [], header(SessionId('s2').toString(), '/other'))
    const reply = createUserMessage({
      content: [{ type: 'text', text: 'uncurated reply' }],
      source: { kind: 'assistant' },
    })
    session.append('assistant/message', reply, { surfaceOp: 'append' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(stub?.requests.some(r => r.path === '/v1/hive/observe')).toBe(false)
  })

  it('maps conversation ids: workspace hashes cwd, session uses the id', () => {
    const a = Session.create(SessionId('s1'), [], header(SessionId('s1').toString(), '/workspace'))
    const b = Session.create(SessionId('s2'), [], header(SessionId('s2').toString(), '/workspace'))
    const c = Session.create(SessionId('s3'), [], header(SessionId('s3').toString(), '/elsewhere'))
    expect(dshHive.conversationIdFor(a, 'workspace')).toBe(dshHive.conversationIdFor(b, 'workspace'))
    expect(dshHive.conversationIdFor(a, 'workspace')).not.toBe(dshHive.conversationIdFor(c, 'workspace'))
    expect(dshHive.conversationIdFor(a, 'session')).toBe('s1')
    expect(dshHive.hash16('x')).toMatch(/^[0-9a-f]{16}$/)
  })
})
