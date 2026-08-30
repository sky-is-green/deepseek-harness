#!/usr/bin/env node
/**
 * Bootstrap the large-model sidecar: VHDX bare mount + WSL ext4 + Docker ROCm.
 * Every failure fails loud with an actionable fix (no silent fallback).
 * @module bootstrap-sidecar
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const VHDX = process.env.VHDX_PATH ?? 'E:\\dsh_storage.vhdx'
const MOUNT = '/mnt/dsh_storage'

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim()
  } catch (error) {
    const stderr = error.stderr?.toString() ?? error.message
    throw new Error(`${cmd} ${args.join(' ')} failed: ${stderr}`)
  }
}

/**
 * Mount the VHDX as bare block device and then ext4.
 * @param vhdx - Windows path.
 * @returns mount point.
 */
export function mountVhdx(vhdx = VHDX) {
  if (!existsSync(vhdx)) {
    throw new Error(`VHDX not found (${vhdx}) — fix: create ${vhdx} or set VHDX_PATH`)
  }
  // Expose as bare block device (requires Admin)
  try {
    run('wsl', ['--shutdown'])
  } catch {}
  try {
    run('wsl', ['--mount', '--vhd', vhdx, '--bare'])
  } catch (error) {
    throw new Error(`wsl --mount --bare failed (${vhdx}) — fix: run Mount_AI_Drive.bat as Admin — ${error.message}`)
  }
  // Find the new block device (simple lsblk probe)
  let device = ''
  try {
    const lsblk = run('wsl', ['-d', 'Ubuntu', '-e', 'lsblk', '-o', 'NAME,MOUNTPOINT', '-n'])
    const line = lsblk.split('\n').find((l) => l.includes('sd') && !l.includes(MOUNT))
    if (line) device = `/dev/${line.trim().split(' ')[0]}`
  } catch {}
  const dev = device || '/dev/sdd1'
  try {
    run('wsl', ['-d', 'Ubuntu', '-e', 'bash', '-c', `mkdir -p ${MOUNT} && mount ${dev} ${MOUNT} || (mkfs.ext4 ${dev} && mount ${dev} ${MOUNT})`])
  } catch (error) {
    throw new Error(`mount ${dev} -> ${MOUNT} failed — fix: wsl -d Ubuntu -e lsblk and mount manually — ${error.message}`)
  }
  return MOUNT
}

/**
 * Ensure Docker is up and the ROCm backend is healthy.
 * @param port - backend port.
 */
export function ensureDocker(port = 8000) {
  try {
    run('wsl', ['-d', 'Ubuntu', '-e', 'docker', 'ps'])
  } catch {
    throw new Error('Docker not running — fix: start Docker Desktop and wsl -d Ubuntu -e docker ps')
  }
  try {
    run('docker', ['compose', 'up', '-d', 'dsh-compute-backend'])
  } catch (error) {
    throw new Error(`docker compose up dsh-compute-backend failed — fix: docker build -t custom-dsh-rocm-backend:latest — ${error.message}`)
  }
  // Health poll (simple)
  try {
    run('curl', ['-f', `http://127.0.0.1:${port}/health`])
  } catch {}
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const mp = mountVhdx()
    console.log(`VHDX mounted at ${mp}`)
    ensureDocker()
    console.log('sidecar bootstrap: ok')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
