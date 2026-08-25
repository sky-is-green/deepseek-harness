/**
 * GGUF catalog scanning for the local provider: one directory level of
 * `.gguf` weights mapped to seam catalog entries through the header reader.
 * A corrupt weights file fails the scan loud — silent catalog holes are how
 * "why can't I load my model" bugs are born.
 * @module
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readGgufMetadataFromFile } from '@deepseek-ai/dsh-gguf-metadata/node'
import { localModelId } from '@deepseek-ai/dsh-models'
import type { ModelCatalogEntry } from '@deepseek-ai/dsh-models'

/**
 * Scan one directory for GGUF weights and read each header.
 * @param modelsDir - absolute directory to scan (non-recursive).
 * @returns one catalog entry per `.gguf` file, ordered by file name.
 */
export async function scanCatalog(modelsDir: string): Promise<ModelCatalogEntry[]> {
  const names = (await readdir(modelsDir)).filter(name => name.toLowerCase().endsWith('.gguf')).sort()
  const entries: ModelCatalogEntry[] = []
  for (const name of names) {
    const path = join(modelsDir, name)
    const [meta, info] = await Promise.all([readGgufMetadataFromFile(path), stat(path)])
    entries.push({
      id: localModelId(name),
      name: meta.name ?? name.replace(/\.gguf$/i, ''),
      kind: 'llm',
      format: 'gguf',
      path,
      sizeBytes: info.size,
      ...meta.architecture !== undefined && { architecture: meta.architecture },
      ...meta.quantization !== undefined && { quantization: meta.quantization },
      ...meta.contextLength !== undefined && { contextLength: meta.contextLength },
    })
  }
  return entries
}
