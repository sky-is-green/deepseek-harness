/**
 * Process manager — pure helpers for spawned servers/shells.
 * @module @deepseek-ai/dsh-client-ui-process-panel/client/process
 */

export interface ProcessEntry {
  id: string
  command: string
  pid: number
  cpu: number
  memMb: number
  status: 'running' | 'exited' | 'killed'
}

/**
 * Format CPU and RAM for display.
 * @param cpu - cpu percent.
 * @param memMb - memory MB.
 * @returns formatted string.
 */
export function formatResources(cpu: number, memMb: number): string {
  return `${cpu.toFixed(1)}% CPU · ${memMb.toFixed(0)} MB`
}

/**
 * Whether a process can be killed.
 * @param entry - process entry.
 * @returns true if running.
 */
export function canKill(entry: ProcessEntry): boolean {
  return entry.status === 'running'
}

/**
 * Kill a process via provided killer.
 * @param entry - process entry.
 * @param killer - async kill function.
 * @returns new entry with killed status or error.
 */
export async function killProcess(
  entry: ProcessEntry,
  killer: (pid: number) => Promise<boolean>,
): Promise<ProcessEntry> {
  if (!canKill(entry)) return entry
  const ok = await killer(entry.pid)
  return ok ? { ...entry, status: 'killed' } : entry
}

/**
 * Filter processes by search.
 * @param list - all processes.
 * @param query - search text.
 * @returns filtered.
 */
export function filterProcesses(list: ProcessEntry[], query: string): ProcessEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter(p => p.command.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
}
