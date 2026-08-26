#!/usr/bin/env node
/**
 * Pre-install stubber (HIVE-OPS class D fix): workspace packages declare `bin`
 * targets inside their build-output directory (typically lib/bin.js). On a
 * clean CI checkout those files do not exist yet, so pnpm install fails to
 * link workspace bins (ENOENT) for any consumer - breaking install-dependent
 * gates before the real build ever runs.
 *
 * Creates an empty placeholder at every missing bin target so linking succeeds;
 * the real build overwrites placeholders later. No-ops on machines with built
 * trees. Run immediately before `pnpm install`.
 *
 * Self-test: node scripts/stub-missing-bins.mjs --selftest
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'lib', '.venv', '.venv-ci', 'vendor']);
const ROOTS = ['.', 'packages', 'apps', 'python'];

function* manifests(dir, depth = 0) {
  if (depth > 4) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory() || SKIP.has(e.name)) continue;
    yield* manifests(join(dir, e.name), depth + 1);
  }
  if (existsSync(join(dir, 'package.json'))) yield join(dir, 'package.json');
}

function collectMissingBins(dir) {
  const missing = [];
  let yielded = 0;
  for (const manifestPath of manifests(dir)) {
    yielded++;
    let pkg;
    try { pkg = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { console.error('parse err', manifestPath, e.message); continue; }
    if (!pkg.bin || typeof pkg.bin !== 'object') continue;
    const pkgDir = manifestPath.slice(0, -'package.json'.length);
    for (const target of Object.values(pkg.bin)) {
      const abs = join(pkgDir, target);
      if (!existsSync(abs)) missing.push({ abs, pkgDir, target });
    }
  }
  return missing;
}

function createStubs(missing) {
  for (const { abs } of missing) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, '// pre-install stub - overwritten by build\n');
    console.log(`stubbed: ${abs}`);
  }
  return missing.length;
}

if (process.argv.includes('--selftest')) {
  const t = join(process.cwd(), `.selftest-${Date.now()}`);
  mkdirSync(join(t, 'packages', 'demo'), { recursive: true });
  writeFileSync(
    join(t, 'packages', 'demo', 'package.json'),
    JSON.stringify({ name: 'demo', bin: { demo: 'lib/bin.js' } })
  );
  const missing = collectMissingBins(t);
  if (missing.length !== 1) { console.error('x selftest FAIL: expected 1 missing bin'); process.exit(1); }
  createStubs(missing);
  if (!existsSync(missing[0].abs)) { console.error('x selftest FAIL: stub not written'); process.exit(1); }
  rmSync(t, { recursive: true, force: true });
  console.log('claims gate selftest: OK (stub-missing-bins)');
  process.exit(0);
}

// Main: scan ROOTS relative to cwd.
let total = 0;
const seen = new Set();
for (const root of ROOTS) {
  for (const m of collectMissingBins(root)) {
    if (seen.has(m.abs)) continue;
    seen.add(m.abs);
    mkdirSync(dirname(m.abs), { recursive: true });
    writeFileSync(m.abs, '// pre-install stub - overwritten by build\n');
    console.log(`stubbed: ${m.abs}`);
    total++;
  }
}
console.log(`stub-missing-bins: ${total} placeholder(s) created`);
