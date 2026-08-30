#!/usr/bin/env node
/**
 * Verify live link-up — Node gate for engine + sidecar + Docker.
 * Exit 0 when linked, 1 with actionable fix.
 * Run: node scripts/verify-live-linkup.mjs
 */
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const VHDX = process.env.VHDX_PATH ?? 'E:\\dsh_storage.vhdx'
const MOUNT = '/mnt/dsh_storage'
const MODEL_GLOB = '/mnt/dsh_storage/models/DeepSeek-V4-Flash-0731-GGUF/*-00001-of-*.gguf'

function check(cmd, args, fix) {
  try {
    execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' })
    return [true, 'ok']
  } catch (e) {
    const err = e.stderr?.toString() ?? e.message
    return [false, `${fix} — ${err.slice(0, 120)}`]
  }
}

const checks = []

// VHDX
checks.push(['VHDX', existsSync(VHDX) ? [true, `ok (${VHDX})`] : [false, `VHDX not found (${VHDX}) — fix: create ${VHDX} or set VHDX_PATH`]])

// WSL mount (only if in WSL)
try {
  const mounts = execFileSync('wsl', ['-d', 'Ubuntu', '-e', 'mount'], { encoding: 'utf8' })
  checks.push(['Mount', mounts.includes(MOUNT) ? [true, `ok (${MOUNT})`] : [false, `not mounted (${MOUNT}) — fix: wsl --mount --vhd ${VHDX} --bare && mount /dev/sdX1 ${MOUNT}`]])
} catch {
  // On Windows host, wsl mount check is expected to fail in sandbox — report as not in WSL
  checks.push(['Mount', [false, `not in WSL — fix: wsl -d Ubuntu -e mount | grep ${MOUNT}`]])
}

// Shards (glob via wsl)
try {
  const out = execFileSync('wsl', ['-d', 'Ubuntu', '-e', 'bash', '-c', `ls ${MODEL_GLOB} 2>&1`], { encoding: 'utf8' })
  checks.push(['Shards', out.includes('00001-of-') ? [true, `ok (${out.trim().split('\n')[0]})`] : [false, `model not found (${MODEL_GLOB}) — fix: ensure 4 shards at /mnt/dsh_storage/models/DeepSeek-V4-Flash-0731-GGUF`]])
} catch (e) {
  checks.push(['Shards', [false, `model not found (${MODEL_GLOB}) — fix: ensure 4 shards — ${e.message.slice(0, 80)}`]])
}

// Docker health
try {
  execFileSync('curl', ['-f', 'http://127.0.0.1:8000/health'], { encoding: 'utf8', stdio: 'pipe' })
  checks.push(['Docker health', [true, 'ok (http://127.0.0.1:8000/health)']])
} catch {
  checks.push(['Docker health', [false, `docker health failed (http://127.0.0.1:8000/health) — fix: docker ps | grep dsh-compute-backend; docker logs dsh-compute-backend`]])
}

// Engine selector (pure, no import — workspace tsconfig paths need built lib)
const VALID_ENGINES = new Set(['windows-vulkan', 'linux-rocm-docker'])
const engineRaw = process.env.ENGINE ?? 'linux-rocm-docker'
if (VALID_ENGINES.has(engineRaw)) {
  checks.push(['Engine', [true, `ok (${engineRaw})`]])
} else {
  checks.push(['Engine', [false, `engine fail — unsupported "${engineRaw}" — fix: set ENGINE=windows-vulkan or linux-rocm-docker`]])
}

let okAll = true
for (const [name, [ok, msg]] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}: ${msg}`)
  if (!ok) okAll = false
}
if (okAll) {
  console.log('verify-live-linkup: LINKED — ready to launch')
  process.exit(0)
} else {
  console.log('verify-live-linkup: NOT LINKED — fix above, then re-run')
  process.exit(1)
}
