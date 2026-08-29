/**
 * Memory browser — retained entries store.
 * Pure + in-memory, easy to test. Host service will wrap with webServer.
 * @module @deepseek-ai/dsh-host-memory-browser/memory
 */

export interface RetainedEntry {
  id: string
  content: string
  pinned: boolean
  createdAt: number
}

/** In-memory store for retained entries. */
export class MemoryStore {
  private readonly map = new Map<string, RetainedEntry>()

  /** Inspect one entry. */
  inspect(id: string): RetainedEntry | null {
    return this.map.get(id) ?? null
  }

  /** List all entries sorted by id. */
  list(): RetainedEntry[] {
    return [...this.map.values()].sort((a, b) => a.id.localeCompare(b.id))
  }

  /** Upsert (for tests/setup). */
  put(entry: RetainedEntry): void {
    this.map.set(entry.id, entry)
  }

  /** Pin/unpin. */
  pin(id: string, pinned: boolean): RetainedEntry | null {
    const e = this.map.get(id)
    if (!e) return null
    const next = { ...e, pinned }
    this.map.set(id, next)
    return next
  }

  /** Delete. Returns true if existed. */
  delete(id: string): boolean {
    return this.map.delete(id)
  }

  /**
   * Edit content.
   * @param id - entry id.
   * @param content - new content.
   * @returns updated entry or null if missing.
   */
  edit(id: string, content: string): RetainedEntry | null {
    const e = this.map.get(id)
    if (!e) return null
    if (content.trim().length === 0) return null
    const next = { ...e, content }
    this.map.set(id, next)
    return next
  }
}
