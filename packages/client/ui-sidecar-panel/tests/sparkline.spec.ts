import { describe, expect, it } from 'vitest'
import { buildPanelSparklines, buildSparklinePath, renderSparklineSvg } from '../src/sparkline.ts'

describe('ui-sidecar-panel sparkline', () => {
  it('buildSparklinePath delegates correctly', () => {
    expect(buildSparklinePath([], 10, 10)).toBe('')
    expect(buildSparklinePath([1], 10, 10)).toContain('M0')
  })

  it('renderSparklineSvg wraps path in svg', () => {
    const svg = renderSparklineSvg([0, 10], { width: 20, height: 10, stroke: 'red' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('<path')
    expect(svg).toContain('stroke="red"')
    expect(renderSparklineSvg([], { width: 10, height: 10 })).toContain('no data')
  })

  it('buildPanelSparklines filters empty series', () => {
    expect(buildPanelSparklines([], [])).toEqual([])
    expect(buildPanelSparklines([1, 2], [])).toEqual([{ label: 'PES', values: [1, 2] }])
    expect(buildPanelSparklines([1], [2])).toHaveLength(2)
  })

  it('panel integration: PES/tok/s sparkline path generation', () => {
    const pes = [70, 75, 80]
    const toks = [10, 12, 11]
    const pesPath = buildSparklinePath(pes, 120, 32)
    const tokPath = buildSparklinePath(toks, 120, 32)
    expect(pesPath).not.toBe(tokPath)
    expect(pesPath).toMatch(/^M/)
    expect(tokPath).toMatch(/^M/)
  })
})
