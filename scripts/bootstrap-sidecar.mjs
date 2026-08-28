#!/usr/bin/env node
/**
 * Frozen-binary bootstrap for the Hive sidecar.
 * Prefers a PyInstaller binary at `native/sidecar` or `$SIDECAR_BINARY`, falling
 * back to `python -m harness` so users never run `pip` at runtime. Exits 1
 * only when neither the binary nor a `harness` module directory is found.
 * Usage: node scripts/bootstrap-sidecar.mjs [--check] [--json]
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const binary = process.env.SIDECAR_BINARY ?? 'native/sidecar'
const absBinary = resolve(binary)
// Probe sibling checkouts: primary `../hive-memory`, worktree `../../../hive-memory`, plus in-tree fallback.
const candidates = [
  resolve('hive-memory/harness'),
  resolve('../hive-memory/harness'),
  resolve('../../hive-memory/harness'),
  resolve('../../../hive-memory/harness'),
  resolve('C:/Users/penis/Documents/hive-memory/harness'),
].filter((p, i, a) => a.indexOf(p) === i)
const moduleDir = candidates.find(p => existsSync(p)) ?? resolve('hive-memory/harness')

const hasBinary = existsSync(absBinary)
const hasModule = candidates.some(p => existsSync(p)) || existsSync(resolve(moduleDir, 'harness/__init__.py')) || existsSync(resolve(moduleDir, 'app.py')) || existsSync(moduleDir)

const json = process.argv.includes('--json')
const check = process.argv.includes('--check')

const result = {
  binary: absBinary,
  hasBinary,
  moduleDir,
  hasModule,
  // frozen binary wins; module fallback is the dev-time path
  mode: hasBinary ? 'frozen' : hasModule ? 'module' : 'missing',
  argv: hasBinary ? [absBinary] : ['python', '-m', 'harness'],
}

if (json) console.log(JSON.stringify(result, null, 2))
else {
  if (result.mode === 'frozen') console.log(`sidecar: frozen binary at ${absBinary}`)
  else if (result.mode === 'module') console.log(`sidecar: module fallback via ${result.argv.join(' ')} (cwd ${moduleDir})`)
  else console.log(`sidecar: missing — neither ${absBinary} nor ${moduleDir} found; run pip install per python/README.md or provide $SIDECAR_BINARY`)
}

if (check && result.mode === 'missing') process.exit(1)
