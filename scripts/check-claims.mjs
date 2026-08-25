#!/usr/bin/env node
/**
 * Claims gate — coordination protocol v2, Rules 2 & 3 (MULTI_AGENT_PLAN.md).
 *
 * Every staged file must be covered by a registered worker claim under
 * `.claims/<Task_ID>.json`:
 *
 *   {
 *     "task_id": "S1",
 *     "worker": "studio @ ../hivebench-studio-lane",
 *     "target_files": ["packages/client/ui-models-manager/**"]
 *   }
 *
 * `target_files` entries are exact paths or glob patterns (`*` within a
 * segment, `**` across segments); a trailing `/` covers the whole directory.
 *
 * Hotspot files (registry in MULTI_AGENT_PLAN.md) additionally enforce the
 * single-commit rule: staging a hotspot allows ONLY files under that same
 * hotspot, and the commit's claim must cover it.
 *
 * `vendor/**` is rejected outright — vendored framework changes go upstream
 * through the sync procedure.
 *
 * Exempt from claims: this gate's own registry (`.claims/**`),
 * `MULTI_AGENT_PLAN.md`, and `.gitignore`.
 *
 * Emergency bypass: CLAIMS_GATE=skip (reserved for the human operator;
 * note the reason in the plan doc's working notes).
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const EXEMPT = ['.claims/', 'MULTI_AGENT_PLAN.md', '.gitignore', '.agents/notes/'];

// Hotspot registry mirror (keep in sync with MULTI_AGENT_PLAN.md §3).
const HOTSPOTS = [
  'pnpm-lock.yaml',
  '/package.json',
  '/tsconfig.host.json',
  '/tsconfig.client.json',
  'packages/bundle/web-app/',
  'docs/tool-catalog.md',
  'docs/config-catalog.md',
  'docs/event-producer-consumer.md',
  'docs/module-graph.md',
];

function fail(messages) {
  for (const m of messages) console.error(`x ${m}`);
  console.error(
    '\nclaims gate: register .claims/<Task_ID>.json (task_id, worker, ' +
      'target_files) covering every staged path, then re-add and commit.' +
      '\n           Human/emergency bypass: CLAIMS_GATE=skip git commit ...'
  );
  process.exit(1);
}

function globToRegExp(pattern) {
  // Two-pass star handling needs a placeholder: converting `**` to `.*`
  // first would let the single-`*` pass re-match the star inside that
  // replacement (`.*` -> `.[^/]*`), breaking every bare-`**` glob.
  const DOUBLE_STAR_TOKEN = '\u0000';
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, `${DOUBLE_STAR_TOKEN}(?:.*/)?`)
    .replace(/\*\*/g, DOUBLE_STAR_TOKEN)
    .replace(/\*/g, '[^/]*')
    .replaceAll(DOUBLE_STAR_TOKEN, '.*');
  return new RegExp(`^${escaped}$`);
}

function covers(patterns, path) {
  return patterns.some((p) => {
    if (p === path) return true;
    const dirPattern = p.endsWith('/') ? p + '**' : p;
    return globToRegExp(dirPattern).test(path);
  });
}

function hotspotOf(path) {
  const hit = HOTSPOTS.find((h) =>
    h.startsWith('/') ? path === h.slice(1) || path.startsWith(h) : covers([h], path)
  );
  return hit ?? null;
}

if (process.env.CLAIMS_GATE === 'skip') {
  console.log('claims gate: skipped via CLAIMS_GATE=skip');
  process.exit(0);
}

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

if (staged.length === 0) process.exit(0);

const exempted = staged.filter((f) => EXEMPT.some((e) => f === e || f.startsWith(e)));
const checked = staged.filter((f) => !exempted.includes(f));

if (checked.length === 0) process.exit(0);

const vendored = checked.filter((f) => f === 'vendor' || f.startsWith('vendor/'));
if (vendored.length > 0) {
  fail([
    'vendor/** changes are forbidden here:',
    ...vendored.map((f) => `  ${f}`),
    'Vendored framework edits go upstream through the sync procedure.',
  ]);
}

const claimsDir = join(process.cwd(), '.claims');
const claims = [];
if (existsSync(claimsDir)) {
  for (const name of readdirSync(claimsDir)) {
    if (!name.endsWith('.json')) continue;
    try {
      // PowerShell 5.1's `-Encoding utf8` emits a BOM; tolerate it.
      const raw = JSON.parse(
        readFileSync(join(claimsDir, name), 'utf8').replace(/^\uFEFF/, '')
      );
      claims.push({ file: name, patterns: raw.target_files ?? [] });
    } catch {
      fail([`Malformed claim file .claims/${name}: invalid JSON.`]);
    }
  }
}

const unclaimed = checked.filter((f) => !claims.some((c) => covers(c.patterns, f)));
if (unclaimed.length > 0) {
  fail([
    'staged files not covered by any claim in .claims/:',
    ...unclaimed.map((f) => `  ${f}`),
    claims.length > 0
      ? 'open claims: ' + claims.map((c) => c.file).join(', ')
      : 'no claims are currently registered.',
    ...(claims.length === 0
      ? ['Create one, e.g. .claims/S1.json:', '{"task_id":"S1","worker":"you","target_files":["packages/client/ui-models-manager/**"]}']
      : []),
  ]);
}

// Single-commit rule: a staged hotspot excludes everything else.
const hotspotSets = new Set(checked.map(hotspotOf).filter(Boolean));
if (hotspotSets.size > 1) {
  fail([
    'multiple hotspots staged in one commit:',
    ...[...hotspotSets].map((h) => `  ${h}`),
    'Split the commit - one hotspot per commit, nothing bundled.',
  ]);
}
if (hotspotSets.size === 1) {
  const [hotspot] = hotspotSets;
  const outside = checked.filter((f) => !covers([hotspot], f));
  if (outside.length > 0) {
    fail([
      `hotspot "${hotspot}" must be committed ALONE.`,
      'bundled non-hotspot files detected:',
      ...outside.map((f) => `  ${f}`),
    ]);
  }
}

console.log(
  `claims gate: ${checked.length} staged file(s) covered by ${claims.length} claim(s)` +
    (exempted.length ? ` (+${exempted.length} exempt)` : '')
);
