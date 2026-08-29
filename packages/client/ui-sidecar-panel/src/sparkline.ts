/**
 * Sparkline helpers for the S18 bench dashboard (pure, framework-free).
 * `ui-sidecar-panel` owns the presentation mapping; `dsh-bench` owns the data shape.
 * @module @deepseek-ai/dsh-ui-sidecar-panel/sparkline
 */

/**
 * Normalize a numeric series into SVG path `d` (re-export of the canonical helper).
 * Kept here so the panel does not depend on the host `dsh-bench` runtime.
 * @param values - numeric series.
 * @param width - SVG width.
 * @param height - SVG height.
 * @returns SVG path.
 */
export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  if (values.length === 1) {
    const y = height / 2
    return `M0,${y.toFixed(2)} L${width.toFixed(2)},${y.toFixed(2)}`
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / span) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ')
}

/**
 * Render a minimal inline SVG sparkline element as a string.
 * @param values - numeric series.
 * @param opts - width, height, stroke.
 * @returns SVG markup.
 */
export function renderSparklineSvg(
  values: number[],
  opts: { width?: number; height?: number; stroke?: string } = {},
): string {
  const width = opts.width ?? 120
  const height = opts.height ?? 32
  const stroke = opts.stroke ?? 'currentColor'
  const d = buildSparklinePath(values, width, height)
  if (d === '') return `<svg width="${width}" height="${height}" role="img" aria-label="no data"></svg>`
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="sparkline"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

/**
 * One rendered sparkline datum for the panel's settings render.
 * @param label - series label (PES or tok/s).
 * @param values - numeric series.
 */
export interface SparklineDatum {
  label: string
  values: number[]
}

/**
 * Build panel sparkline data from bench history points.
 * @param pesSeries - PES values in timestamp order.
 * @param tokSeries - tok/s values in timestamp order.
 * @returns two datum entries, omitting empty series.
 */
export function buildPanelSparklines(pesSeries: number[], tokSeries: number[]): SparklineDatum[] {
  const out: SparklineDatum[] = []
  if (pesSeries.length > 0) out.push({ label: 'PES', values: pesSeries })
  if (tokSeries.length > 0) out.push({ label: 'tok/s', values: tokSeries })
  return out
}
