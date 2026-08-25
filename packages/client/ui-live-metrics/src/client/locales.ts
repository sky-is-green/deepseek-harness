/**
 * `live-metrics` namespace dictionaries: the composer dock readout's copy.
 * The visible line joins its available parts (`readout.ttft`, `readout.rate`)
 * so each locale owns the wording while figures drop independently.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'readout.ttft': '首字 {ttft} 秒',
  'readout.rate': '{rate} tok/s',
  'readout.aria': '实时生成：每秒 {rate} 个 token，首字延迟 {ttft} 秒',
} satisfies Record<string, string>

/** The live-metrics namespace key union. */
export type LiveMetricsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'readout.ttft': 'TTFT {ttft}s',
  'readout.rate': '{rate} tok/s',
  'readout.aria': 'Live generation at {rate} tokens per second, time to first token {ttft}s',
} satisfies Record<LiveMetricsKey, string>
