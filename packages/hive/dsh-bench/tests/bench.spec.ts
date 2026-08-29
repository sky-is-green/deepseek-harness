import { describe, expect, it } from 'vitest'
import { parseBenchInput, summarizeReport } from '../src/index.ts'

describe('dsh-bench bench helpers', () => {
  it('parseBenchInput handles live/mock/maxConvs and collect', () => {
    expect(parseBenchInput('protocol_123')).toEqual({ mode: 'mock', maxConvs: 5, collect: 'protocol_123' })
    expect(parseBenchInput('live 10')).toEqual({ mode: 'live', maxConvs: 10 })
    expect(parseBenchInput('mock 3')).toEqual({ mode: 'mock', maxConvs: 3 })
    expect(parseBenchInput('')).toEqual({ mode: 'mock', maxConvs: 5 })
  })

  it('summarizeReport formats PES and protocol counts', () => {
    const line = summarizeReport({
      post_run_pes: { pes: 88, band: 'green' },
      protocol: [{ status: 'PASS' }, { status: 'FAIL' }, { status: 'SKIP' }],
    })
    expect(line).toBe('PES 88 (green) | protocol: 1 PASS / 1 FAIL / 1 SKIP')
    expect(summarizeReport({ protocol: [] })).toContain('PES n/a')
  })
})
