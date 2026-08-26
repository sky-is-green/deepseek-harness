import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { Session, SessionStore } from '@deepseek-ai/dsh-session'
import { CallId, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { RetryId } from '@deepseek-ai/dsh-llm-retry'
import { Context } from '@deepseek-ai/cordis'
import { resolveSessionPreset } from '@deepseek-ai/dsh-agent-presets'
import { collectEvidence } from '../src/evidence.ts'
import { mineEvidence } from '../src/mine.ts'
import { SqliteSessionQueryEngine } from '@deepseek-ai/dsh-session-query-sqlite'
import type { EvidenceReport } from '../src/types.ts'

function toolResult(seq: number, rawCallId: string, isError: boolean, code?: string) {
  const callId = CallId(rawCallId)
  return {
    seq,
    time: seq,
    type: 'tool/result' as const,
    data: {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId,
        content: [{ type: 'text', text: 'out' }],
        isError,
      }),
      ...(code === undefined ? {} : { error: { name: 'SomeError', code } }),
    },
    source: { kind: 'tool', callId },
  }
}

function buildSession(id: string, agentPreset: string | undefined) {
  return Session.create(SessionId(id), [], {
    version: 0,
    id: SessionId(id),
    createdAt: 0,
    cwd: '/w',
    ...(agentPreset === undefined ? {} : { agentPreset }),
  })
}

describe('preset trainer evidence pass', () => {
  it('groups by resolved preset and computes per-tool outcomes, unused tools, and failure modes', () => {
    const session = buildSession('s1', 'standard')
    // Catalog: read_file and bash are offered; only read_file is called.
    session.append('request/header', {
      reason: 'initial',
      header: {
        config: { provider: 'p', model: 'm' },
        tools: [
          { name: 'read_file', description: '', parameters: {} },
          { name: 'bash', description: '', parameters: {} },
          { name: 'web_search', description: '', parameters: {} },
        ],
      },
    })
    session.append('turn/start', { turn: 1 })
    session.append('tool/call', { turn: 1, step: 1, callId: CallId('ok1'), name: 'read_file', arguments: '{}' })
    const ok = toolResult(4, 'ok1', false)
    session.append(ok.type, ok.data, { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId: CallId('err1'), name: 'bash', arguments: '{}' })
    const err = toolResult(6, 'err1', true, 'TOOL_TIMEOUT')
    session.append(err.type, err.data, { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId: CallId('lost'), name: 'bash', arguments: '{}' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    const report = collectEvidence([{ session: session.header, events: [...session.events] }], 123)
    expect(report.generatedAt).toBe(123)
    expect(report.presets.map(p => p.preset)).toEqual(['standard'])
    const standard = report.presets[0]
    expect(standard?.sessions).toBe(1)
    expect(standard?.turns).toBe(1)
    expect(standard?.successfulTraces).toBe(1)
    expect(standard?.unusedTools).toEqual(['web_search'])
    expect(standard?.tools.read_file).toMatchObject({ ok: 1, errors: 0, unsettled: 0 })
    expect(standard?.tools.bash).toMatchObject({ errors: 1, unsettled: 1, byCode: { TOOL_TIMEOUT: 1 } })
    expect(standard?.failures.toolTimeouts).toBe(1)
  })

  it('attributes post-creation preset switches to the latest selected preset and folds failures', () => {
    const session = buildSession('s2', undefined)
    session.append('agent-preset/selected', { agentPreset: 'hive-curator' })
    session.append('turn/start', { turn: 1 })
    session.append('llm/retry', {
      retryId: RetryId('r'), turn: 1, step: 1, provider: 'p', mode: 'normal', policyKey: 'k',
      retry: 1, maxRetries: 3, delayMs: 10, failure: { message: 'rate limited', code: 'RATE_LIMIT' },
    })
    session.append('turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'X', status: 500 } } })

    const report = collectEvidence([{ session: session.header, events: [...session.events] }], 5)
    expect(resolveSessionPreset({ header: session.header, events: [...session.events] })).toBe('hive-curator')
    const hive = report.presets.find(p => p.preset === 'hive-curator')
    expect(hive).toBeTruthy()
    expect(hive?.failures).toMatchObject({
      modelErrors: 1, retries: 1, toolTimeouts: 0, byCode: { RATE_LIMIT: 1, X: 1 },
    })
  })

  it('mines a real SQLite query engine end-to-end through mineEvidence', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:', openAt: 'startup' })

    const persisted = ctx.sessions.create(SessionId('mine-1'), {
      meta: { cwd: '/w', agentPreset: 'local-first' },
    })
    persisted.append('turn/start', { turn: 1 })
    persisted.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'hi' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    persisted.append('tool/call', { turn: 1, step: 1, callId: CallId('c9'), name: 'tool-fs-search', arguments: '{}' })
    const ok = toolResult(4, 'c9', false)
    persisted.append(ok.type, ok.data, { surfaceOp: 'append' })

    const report: EvidenceReport = await mineEvidence(ctx)
    const entry = report.presets.find(p => p.preset === 'local-first')
    expect(entry).toBeTruthy()
    expect(entry?.sessions).toBeGreaterThanOrEqual(1)
    expect(entry?.successfulTraces).toBeGreaterThanOrEqual(1)
  })
})
