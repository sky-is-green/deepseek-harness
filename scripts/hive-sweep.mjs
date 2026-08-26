#!/usr/bin/env node
/**
 * HIVE-SWEEP — combined QUEEN+GUARD wake sequence.
 *
 * One command gives the full picture: worker beacons, claim coverage,
 * branch divergence, CI verdicts, proposal count, and anomaly flags.
 *
 * Usage:  node scripts/hive-sweep.mjs [--json]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const now = () => new Date().toISOString().slice(0, 19);
const git = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return null; }
};
const gh = (args) => {
  try { return execFileSync('gh', args, { encoding: 'utf8' }).trim(); } catch { return null; }
};

const report = { timestamp: now(), findings: [], warnings: [], info: [] };

// --- beacons ---
const claimsDir = join(process.cwd(), '.claims');
if (existsSync(claimsDir)) {
  const seen = new Map();
  for (const f of readdirSync(claimsDir).filter(n => n.endsWith('.json'))) {
    try {
      const raw = readFileSync(join(claimsDir, f), 'utf8').replace(/^\uFEFF/, '');
      const c = JSON.parse(raw);
      if (c.mode === 'AFK') continue; // mode file, not a claim
      const tid = c.task_id ?? f;
      if (seen.has(tid)) report.warnings.push(`duplicate Task_ID "${tid}": ${seen.get(tid)} vs ${f}`);
      seen.set(tid, c.worker ?? f);
      report.info.push(`claim ${c.task_id ?? f}: ${c.worker ?? '?'} — ${c.beacon ?? '(no beacon)'}`);
    } catch (e) {
      report.warnings.push(`malformed claim ${f}: ${e.message.slice(0, 60)}`);
    }
  }
} else {
  report.info.push('no .claims/ directory (no active workers)');
}

// --- branch state ---
const branch = git(['branch', '--show-current']);
report.info.push(`branch: ${branch}`);
const integration = process.env.HIVE_INTEGRATION || 'fork/hive-studio';
const ab = git(['rev-list', '--left-right', '--count', `${branch}...${integration}`]);
if (ab) {
  const [ahead, behind] = ab.split(/\s+/).map(Number);
  report.info.push(`divergence: ${ahead} ahead / ${behind} behind ${integration}`);
  if (behind > 0) report.findings.push(`${behind} commit(s) behind ${integration} — rebase needed`);
}
const staged = git(['diff', '--cached', '--name-only']);
const stagedCount = staged ? staged.split('\n').filter(Boolean).length : 0;
report.info.push(`staged files: ${stagedCount}`);
if (stagedCount > 0) report.info.push('staged: ' + staged.split('\n').join(', ').slice(0, 200));

// --- proposals ---
const propFile = join(process.cwd(), 'PROPOSALS.md');
if (existsSync(propFile)) {
  const content = readFileSync(propFile, 'utf8');
  const open = (content.match(/^### /gm) || []).length;
  report.info.push(`open proposals: ${open}`);
}

// --- research queue ---
const rq = join(process.cwd(), 'RESEARCH-QUEUE.md');
if (existsSync(rq)) {
  const pending = (readFileSync(rq, 'utf8').match(/^- \[ \] /gm) || []).length;
  if (pending > 0) report.findings.push(`${pending} deep-research question(s) queued`);
}

// --- CI ---
const ci = gh(['run', 'list', '--limit', '3']);
if (ci) {
  for (const line of ci.split('\n')) {
    if (line.includes('failure') || line.includes('cancelled'))
      report.findings.push('CI: ' + line.split('\t').slice(0, 3).join(' | ').slice(0, 120));
    else
      report.info.push('CI: ' + line.split('\t').slice(0, 3).join(' | ').slice(0, 100));
  }
}

// --- output ---
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n=== HIVE SWEEP ${report.timestamp} ===\n`);
  if (report.findings.length) {
    console.log('⚠ FINDINGS:');
    for (const f of report.findings) console.log(`  ⚠ ${f}`);
    console.log('');
  }
  console.log('STATUS:');
  for (const i of report.info) console.log(`  ${i}`);
  console.log('');
  if (report.warnings.length) {
    console.log('WARNINGS:');
    for (const w of report.warnings) console.log(`  ! ${w}`);
    console.log('');
  }
}
