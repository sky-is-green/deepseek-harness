#!/usr/bin/env node
/**
 * Headless bench regression gate — exits 1 on PES regression vs baseline.
 * Usage: node scripts/check-pes-baseline.mjs [--baseline path] [--threshold N] [--report path-or-url]
 *   --baseline  path to baseline.json (default: packages/hive/dsh-bench/baseline.json)
 *   --threshold allowed PES drop (default: 0)
 *   --report    path to a report JSON file (if omitted, reads stdin when piped)
 * For sidecar live runs the report is fetched by dsh-bench; this script is the CI gate that
 * consumes a materialized report.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseArgs(argv) {
  const out = { baseline: 'packages/hive/dsh-bench/baseline.json', threshold: 0, report: undefined }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--baseline' && argv[i + 1]) out.baseline = argv[++i]
    else if (a === '--threshold' && argv[i + 1]) out.threshold = Number(argv[++i])
    else if (a === '--report' && argv[i + 1]) out.report = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log('Usage: check-pes-baseline.mjs [--baseline path] [--threshold N] [--report path]')
      process.exit(0)
    }
  }
  return out
}

function loadJson(path) {
  const raw = readFileSync(resolve(path), 'utf8')
  return JSON.parse(raw)
}

function pesOf(report) {
  return report?.post_run_pes?.pes
}

function evaluate(report, baseline, threshold) {
  const actual = pesOf(report)
  const delta = actual === undefined ? 0 : actual - baseline.pes
  const regression = actual !== undefined && delta < -threshold
  const text =
    actual === undefined
      ? `PES n/a vs baseline ${baseline.pes} — gate skipped`
      : regression
        ? `PES ${actual} vs baseline ${baseline.pes} (Δ ${delta.toFixed(2)} < -${threshold}): REGRESSION`
        : `PES ${actual} vs baseline ${baseline.pes} (Δ ${delta.toFixed(2)}): ok`
  return { regression, delta, actual: actual ?? NaN, baseline: baseline.pes, threshold, text }
}

const { baseline: baselinePath, threshold, report: reportPath } = parseArgs(process.argv)
const baseline = loadJson(baselinePath)
let report
if (reportPath) {
  report = loadJson(reportPath)
} else {
  // Try stdin if piped; otherwise error with usage.
  const stdin = readFileSync(0, 'utf8').trim()
  if (!stdin) {
    console.error('No report provided. Use --report <path> or pipe report JSON to stdin.')
    console.error('Usage: node scripts/check-pes-baseline.mjs --report runs/protocol_.../report.json')
    process.exit(2)
  }
  report = JSON.parse(stdin)
}
const decision = evaluate(report, baseline, threshold)
console.log(decision.text)
process.exit(decision.regression ? 1 : 0)
