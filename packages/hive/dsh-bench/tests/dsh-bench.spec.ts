import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox, type Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import * as dshBench from '@deepseek-ai/dsh-bench'
import type { Config } from '@deepseek-ai/dsh-bench'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/** Scripted sidecar stub: records /v1/protocol/run launches and serves reports. */
class StubSidecar {
  readonly server: Server
  readonly requests: { path: string; body: unknown }[] = []
  reportReady = false
  report = {
    post_run_pes: { pes: 73.1, band: 'YELLOW' },
    protocol: [
      { id: 'P1', status: 'PASS' },
      { id: 'P2', status: 'FAIL' },
      { id: 'P3', status: 'SKIP' },
    ],
  }
  port = 0

  constructor() {
    this.server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => {
        let body: unknown = {}
        try { body = JSON.parse(raw) } catch { /* keep {} */ }
        this.requests.push({ path: req.url ?? '', body })
        const url = req.url ?? ''
        if (url === '/v1/protocol/run') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ run_dir: 'C:/runs/protocol_20260824_120000', pid: 4242 }))
          return
        }
        if (url.startsWith('/v1/report/')) {
          if (!this.reportReady) {
            res.writeHead(404).end()
            return
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(this.report))
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

async function mount(config: Config = {}) {
  const ctx = new Context()
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)
  const fiber = await ctx.plugin(dshBench, config)
  return { ctx, fiber }
}

function sessionAgent(session: Session, ctx: Context): Agent {
  return {
    id: SessionId('a1'), options: {}, session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'running', ctx, send: () => {}, followup: () => {}, steer: () => {},
    inject: () => { throw new Error('no') }, cancel() {},
    runMaintenance: task => task(new AbortController().signal), whenIdle: () => Promise.resolve(),
  }
}

async function runCommand(ctx: Context, agent: Agent, rawInput: string) {
  const execution = await ctx.commands.execute(
    agent, `/bench ${rawInput}`.trim(), [], new AbortController().signal,
  )
  return execution?.result
}

describe('dsh-bench command', () => {
  it('parses mode and max-convs from raw input', () => {
    expect(dshBench.parseBenchInput('live 12')).toEqual({ mode: 'live', maxConvs: 12 })
    expect(dshBench.parseBenchInput('mock')).toEqual({ mode: 'mock', maxConvs: 5 })
    expect(dshBench.parseBenchInput('')).toEqual({ mode: 'mock', maxConvs: 5 })
    expect(dshBench.parseBenchInput('12 live')).toEqual({ mode: 'live', maxConvs: 12 })
  })

  it('parses a collect run name', () => {
    const parsed = dshBench.parseBenchInput('protocol_20260824_120000')
    expect(parsed.collect).toBe('protocol_20260824_120000')
  })

  it('summarizes a report', () => {
    const text = dshBench.summarizeReport({
      post_run_pes: { pes: 73.1, band: 'YELLOW' },
      protocol: [
        { id: 'P1', status: 'PASS' },
        { id: 'P2', status: 'FAIL' },
        { id: 'P3', status: 'SKIP' },
      ],
    })
    expect(text).toContain('PES 73.1 (YELLOW)')
    expect(text).toContain('1 PASS / 1 FAIL / 1 SKIP')
  })

  it('launches a run and reports pending while the report is not ready', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s1'))
    const agent = sessionAgent(session, ctx)
    const result = await runCommand(ctx, agent, 'live 3')
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') return
    expect(result.text).toContain('protocol_20260824_120000')
    expect(result.text).toContain('pending')
    // The sidecar was asked with the right payload.
    const launch = stub?.requests.find(r => r.path === '/v1/protocol/run')
    expect(launch).toBeDefined()
    const body = launch?.body as { mode?: string; args?: { max_convs?: number; protocol?: boolean } }
    expect(body?.mode).toBe('live')
    expect(body?.args?.max_convs).toBe(3)
    expect(body?.args?.protocol).toBe(true)
    // A log-only bench/run event was recorded.
    expect(session.events.some(e => e.type === 'bench/run')).toBe(true)
  })

  it('summarizes the report once it is ready', async () => {
    stub!.reportReady = true
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s1'))
    const agent = sessionAgent(session, ctx)
    const result = await runCommand(ctx, agent, 'mock')
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') return
    expect(result.text).toContain('PES 73.1 (YELLOW)')
  })

  it('collects an existing run by name', async () => {
    stub!.reportReady = true
    const { ctx } = await mount({ sidecarUrl: baseUrl() })
    const session = Session.create(SessionId('s1'))
    const agent = sessionAgent(session, ctx)
    const result = await runCommand(ctx, agent, 'protocol_20260824_120000')
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') return
    expect(result.text).toContain('protocol_20260824_120000: PES 73.1')
    // No launch was made for a collect.
    expect(stub?.requests.some(r => r.path === '/v1/protocol/run')).toBe(false)
  })

  it('reports an unreachable sidecar as a command error', async () => {
    const { ctx } = await mount({ sidecarUrl: 'http://127.0.0.1:1', timeoutMs: 500 })
    const session = Session.create(SessionId('s1'))
    const agent = sessionAgent(session, ctx)
    const result = await runCommand(ctx, agent, 'mock')
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.text).toContain('unreachable')
  })

  it('registers nothing when disabled', async () => {
    const { ctx } = await mount({ sidecarUrl: baseUrl(), enabled: false })
    const session = Session.create(SessionId('s1'))
    const agent = sessionAgent(session, ctx)
    const result = await runCommand(ctx, agent, 'mock')
    expect(result).toBeUndefined()
  })
})
