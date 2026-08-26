/**
 * Port allocation for spawned local servers: probe-loop over the configured
 * range using immediate bind-and-close, which is the portable check the
 * subprocess seam does not own.
 * @module
 */

import { createServer } from 'node:net'

/**
 * Find the first free TCP port starting at `base`, trying `attempts` consecutive values.
 * @param base - first port to try.
 * @param attempts - how many consecutive ports to probe (default 10).
 * @returns a free port, or `null` when the whole range is occupied.
 */
export async function findFreePort(base: number, attempts = 10): Promise<number | null> {
  for (let candidate = base; candidate < base + attempts; candidate += 1) {
    if (await isPortFree(candidate)) return candidate
  }
  return null
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', function () {
      resolve(false)
    })
    probe.once('listening', function () {
      probe.close(function () {
        resolve(true)
      })
    })
    probe.listen(port, '127.0.0.1')
  })
}
