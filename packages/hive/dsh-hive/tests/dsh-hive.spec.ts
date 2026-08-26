import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, Inbox, type Agent, type PreStepDecision } from '@deepseek-ai/dsh-agent'
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
      req.on('data', (chunk: string) => { raw += chunk })
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
    return new Promise((resolve) => { this.server.close(() => { resolve() }) })
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
function header(id: SessionId, cwd: string): { version: number; id: SessionId; createdAt: number; cwd: string } {
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
): Promise<PreStepDecision> {
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
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
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
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
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
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
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
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
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
      SessionId('s1'),
      { meta: { cwd: '/workspace' } },
    )
    const agent = sessionAgent(session)
    openTurn(session)
    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'q' }],
      source: { kind: 'user' },
    })
    await fireStep(ctx, agent, proposed)
    expect(stub?.requests.some(r => r.path === '/v1/hive/curate')).toBe(true)

    session.append('assistant/message', {
      turn: 1, step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: 'The API allows 100 requests per minute.' }],
        source: { provider: 'hive-mock', model: 'test-model' },
      }),
    }, { surfaceOp: 'append' })

    // Let the fire-and-forget observe land.
    await new Promise(resolve => setTimeout(resolve, 50))
    const observe = stub?.requests.find(r => r.path === '/v1/hive/observe')
    expect(observe).toBeDefined()
    const body = observe?.body as { reply?: string }
    expect(body?.reply).toContain('100 requests per minute')
  })

  it('does not observe sessions it never curated', async () => {
    await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s2'), [], header(SessionId('s2'), '/other'))
    const reply = {
      turn: 1, step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: 'uncurated reply' }],
        source: { provider: 'hive-mock', model: 'test-model' },
      }),
    }
    session.append('assistant/message', reply, { surfaceOp: 'append' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(stub?.requests.some(r => r.path === '/v1/hive/observe')).toBe(false)
  })

  it('refreshes curation on up to maxCurationSteps of each turn, then resets next turn', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl(), maxCurationSteps: 2 })
    const session = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
    const agent = sessionAgent(session)
    const query = createUserMessage({
      content: [{ type: 'text', text: 'How does JWT auth work?' }],
      source: { kind: 'user' },
    })
    // Round 1: the fresh query.
    const first = await fireStep(ctx, agent, query)
    expect(first.kind).toBe('enter')
    if (first.kind !== 'enter') return
    const firstInjection = first.messages.find(message => pluginTexts([message]).includes('CURATED CONTEXT'))
    const firstSource = firstInjection?.source as { curation?: { round?: number; maxRounds?: number } }
    expect(firstSource.curation).toMatchObject({ round: 1, maxRounds: 2, pes: 80 })

    // Round 2: continuation step without fresh text reuses the turn's query.
    const continuation = createUserMessage({
      content: [{ type: 'text', text: 'tool continuation' }],
      source: { kind: 'plugin', plugin: 'dsh-hive-test' },
    })
    const before = stub?.requests.filter(r => r.path === '/v1/hive/curate').length ?? 0
    const second = await fireStep(ctx, agent, continuation, 1, 2)
    expect(second.kind).toBe('enter')
    if (second.kind !== 'enter') return
    expect(stub?.requests.filter(r => r.path === '/v1/hive/curate').length).toBe(before + 1)
    const secondInjection = second.messages.find(message => pluginTexts([message]).includes('CURATED CONTEXT'))
    const secondSource = secondInjection?.source as { curation?: { round?: number } }
    expect(secondSource.curation?.round).toBe(2)

    // Round 3 is beyond the gate: no further request lands.
    await fireStep(ctx, agent, continuation, 1, 3)
    expect(stub?.requests.filter(r => r.path === '/v1/hive/curate').length).toBe(before + 1)

    // A new turn resets the per-turn state and takes a fresh query.
    const nextTurn = createUserMessage({
      content: [{ type: 'text', text: 'Now explain OAuth.' }],
      source: { kind: 'user' },
    })
    await fireStep(ctx, agent, nextTurn, 2, 1)
    const bodies = stub?.requests
      .filter(r => r.path === '/v1/hive/curate')
      .map(r => (r.body as { query?: string }).query) ?? []
    expect(bodies.at(-1)).toBe('Now explain OAuth.')
  })

  it('registers the hiveCuration telemetry projection and folds its own injections', async () => {
    const registered: { key: string; definition: dshHive.CurationProjectionDefinition }[] = []
    const ctx = new Context()
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(SessionStore)
    ctx.provide('sessionProjections', {
      register: (definition: dshHive.CurationProjectionDefinition) => {
        registered.push({ key: definition.key, definition })
        return () => {}
      },
    })
    await ctx.plugin(dshHive, { sidecarUrl: baseUrl() })
    expect(registered).toHaveLength(1)
    const definition = registered[0]?.definition
    if (definition === undefined) throw new Error('hiveCuration projection was not registered')
    expect(definition.key).toBe('hiveCuration')

    let state = definition.init()
    const injectionEvent = (seq: number): Parameters<typeof definition.apply>[1] => ({
      seq,
      time: 0,
      type: 'user/message',
      data: createUserMessage({
        content: [{ type: 'text', text: 'CURATED CONTEXT' }],
        // Fixture fixture: the telemetry block is this plugin's own
        // merge-extensible producer metadata, beyond the declared variant.
        source: {
          kind: 'plugin',
          plugin: 'dsh-hive',
          form: 'snapshot',
          sections: [{ name: 'dsh-hive', text: 'CURATED CONTEXT' }],
          curation: {
            round: seq, maxRounds: 2, pes: 80 - seq, degradationLevel: 0,
            tokenCount: 900, mode: 'hive', turn: 1,
          },
        } as never,
      }),
    }) as never

    state = definition.apply(state, injectionEvent(5))
    state = definition.apply(state, injectionEvent(6))
    expect(state.entries.map(entry => entry.seq)).toEqual([5, 6])
    expect(state.entries[1]).toMatchObject({ round: 6, pes: 74, tokenCount: 900 })

    // Uninterested events keep the reference, and the window stays capped.
    const unchanged = definition.apply(state, { seq: 7, time: 0, type: 'step/start', data: {} } as never)
    expect(unchanged).toBe(state)
    for (let seq = 10; seq < 40; seq += 1) state = definition.apply(state, injectionEvent(seq))
    expect(state.entries).toHaveLength(dshHive.CURATION_WINDOW)

    // The wire view validates and projects the retained entries only.
    const view = definition.wire?.view(state)
    expect(view?.entries).toHaveLength(dshHive.CURATION_WINDOW)
  })

  it('maps conversation ids: workspace hashes cwd, session uses the id', () => {
    const a = Session.create(SessionId('s1'), [], header(SessionId('s1'), '/workspace'))
    const b = Session.create(SessionId('s2'), [], header(SessionId('s2'), '/workspace'))
    const c = Session.create(SessionId('s3'), [], header(SessionId('s3'), '/elsewhere'))
    expect(dshHive.conversationIdFor(a, 'workspace')).toBe(dshHive.conversationIdFor(b, 'workspace'))
    expect(dshHive.conversationIdFor(a, 'workspace')).not.toBe(dshHive.conversationIdFor(c, 'workspace'))
    expect(dshHive.conversationIdFor(a, 'session')).toBe('s1')
    expect(dshHive.hash16('x')).toMatch(/^[0-9a-f]{16}$/)
  })
})
