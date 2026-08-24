/**
 * Replicates scripts/build-exe-for-python-sdk.ts post-deploy fixups for the
 * node-mode carrier (Windows has no pkg exe target, and the node carrier is
 * the only path we need): restore legacy-hoist omissions, then materialize
 * every symlink into real files so the payload is self-contained.
 */
import { cp, lstat, mkdir, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const staging = resolve(root, 'python/sdk-runtime/src/deepseek_harness_runtime/runtime/node')
const sourceNodeModules = resolve(root, 'python/sdk-runtime/node_modules')

async function findSymlink(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) return path
    if (metadata.isDirectory()) {
      const nested = await findSymlink(path)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

async function copyWithoutNested(source, destination) {
  const nestedNodeModules = join(source, 'node_modules')
  await rm(destination, { recursive: true, force: true })
  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, {
    recursive: true,
    dereference: true,
    filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
  })
}

// 1. restore direct deps the legacy hoister omitted
const manifestPath = join(staging, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const restored = []
for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
  const destination = join(staging, 'node_modules', dependency)
  if (existsSync(destination)) continue
  const source = join(sourceNodeModules, dependency)
  if (!existsSync(source)) {
    throw new Error(`missing in both places: ${dependency}`)
  }
  await copyWithoutNested(source, destination)
  restored.push(dependency)
}
if (restored.length) console.log('restored:', restored.join(', '))

// 2. materialize remaining symlinks (drop .bin dirs entirely)
const nodeModules = join(staging, 'node_modules')
let guard = 0
let remaining = await findSymlink(nodeModules)
while (remaining !== undefined) {
  if (++guard > 5000) throw new Error('symlink materialization did not converge')
  const segments = remaining.slice(nodeModules.length + 1).split(sep)
  const binIndex = segments.lastIndexOf('.bin')
  if (binIndex >= 0) {
    await rm(join(nodeModules, ...segments.slice(0, binIndex + 1)),
             { recursive: true, force: true })
  } else {
    const source = await realpath(remaining)
    await copyWithoutNested(source, remaining)
  }
  remaining = await findSymlink(nodeModules)
}
console.log('node carrier ready:', staging)
