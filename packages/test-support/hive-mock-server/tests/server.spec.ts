import { describe, expect, it } from 'vitest'
import { SidecarClient } from '@deepseek-ai/dsh-hive/src/sidecar.ts'
import { startHiveMockServer } from '../src/index.ts'

describe('hive mock server', () => {
  it('serves curate/observe round-trips that byte-match SidecarClient shapes', async () => {
    const mock = await startHiveMockServer()
    try {
      const client = new SidecarClient(mock.url, 2_000)

      const curated = await client.curate('conv-1', 'what did we decide?', new AbortController().signal)
      // First turn on a fresh conversation: empty assembly is the correct store state.
      expect(curated).toMatchObject({
        conversation_id: 'conv-1',
        turn: 1,
        assembled_content: '',
        budget: 2048,
        mode: 'mock',
        pes: 1,
        degradation_level: 0,
      })

      const stored = await client.observe('conv-1', 'We decided authentication uses JWTs.')
      expect(stored).toBe(true)

      const second = await client.curate('conv-1', 'and then?', new AbortController().signal)
      expect(second?.turn).toBe(3)
      expect(second?.assembled_content).toBe('We decided authentication uses JWTs.')

      const record = mock.requests.find(r => r.path === '/v1/hive/curate')
      expect(record?.body).toMatchObject({ query: 'what did we decide?', conversation_id: 'conv-1' })
    } finally {
      await mock.close()
    }
  })

  it('rejects requests missing the configured x-hive-token', async () => {
    const mock = await startHiveMockServer({ token: 'sekrit' })
    try {
      const unauthenticated = new SidecarClient(mock.url, 2_000)
      expect(await unauthenticated.curate('c', 'q', new AbortController().signal)).toBeUndefined()

      const authenticated = new SidecarClient(mock.url, 2_000, fetch, 'sekrit')
      expect(await authenticated.observe('c', 'hello')).toBe(true)
    } finally {
      await mock.close()
    }
  })

  it('consumes scripted behaviors FIFO before falling back to defaults', async () => {
    const mock = await startHiveMockServer({
      script: ['server_error', 'observe_notstored'],
    })
    try {
      const client = new SidecarClient(mock.url, 2_000)
      // Scripted 500: the client's breaker swallows it, resolves undefined,
      // and puts THIS client into cooldown — its next call below never
      // reaches the mock.
      expect(await client.curate('c', 'q', new AbortController().signal)).toBeUndefined()
      // Cooldown short-circuit: false without any wire request (the script's
      // second entry is still queued).
      expect(await client.observe('c', 'a reply')).toBe(false)
      // Fresh client, breaker clear: consumes 'observe_notstored' -> false.
      const second = new SidecarClient(mock.url, 2_000)
      expect(await second.observe('c', 'a reply')).toBe(false)
      // Script exhausted: defaults return.
      const recovered = new SidecarClient(mock.url, 2_000)
      expect(await recovered.observe('c', 'another reply')).toBe(true)
    } finally {
      await mock.close()
    }
  })

  it('answers protocol runs and 404s unknown endpoints', async () => {
    const mock = await startHiveMockServer()
    try {
      const first = await fetch(`${mock.url}/v1/protocol/run`, { method: 'POST' })
      expect(first.status).toBe(200)
      expect(await first.json()).toMatchObject({ run_dir: 'runs/mock_protocol_0001', pid: null })

      const missing = await fetch(`${mock.url}/v1/nope`, { method: 'POST' })
      expect(missing.status).toBe(404)
    } finally {
      await mock.close()
    }
  })
})
