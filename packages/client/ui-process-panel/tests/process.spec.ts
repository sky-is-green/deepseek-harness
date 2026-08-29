import { describe, it, expect, vi } from 'vitest'
import { canKill, filterProcesses, formatResources, killProcess } from '../src/client/process.ts'

describe('process panel', () => {
  it('formats resources', () => {
    expect(formatResources(12.345, 512.6)).toBe('12.3% CPU · 513 MB')
  })
  it('canKill running only', () => {
    expect(canKill({ id: 'a', command: 'x', pid: 1, cpu: 0, memMb: 0, status: 'running' })).toBe(true)
    expect(canKill({ id: 'a', command: 'x', pid: 1, cpu: 0, memMb: 0, status: 'exited' })).toBe(false)
  })
  it('killProcess calls killer', async () => {
    const killer = vi.fn().mockResolvedValue(true)
    const e = { id: 'a', command: 'x', pid: 123, cpu: 0, memMb: 0, status: 'running' as const }
    const r = await killProcess(e, killer)
    expect(killer).toHaveBeenCalledWith(123)
    expect(r.status).toBe('killed')
  })
  it('killProcess no-op when not running', async () => {
    const killer = vi.fn()
    const e = { id: 'a', command: 'x', pid: 1, cpu: 0, memMb: 0, status: 'exited' as const }
    const r = await killProcess(e, killer)
    expect(killer).not.toHaveBeenCalled()
    expect(r.status).toBe('exited')
  })
  it('filters', () => {
    const list = [
      { id: 'a', command: 'llama-server', pid: 1, cpu: 0, memMb: 0, status: 'running' as const },
      { id: 'b', command: 'bash', pid: 2, cpu: 0, memMb: 0, status: 'running' as const },
    ]
    expect(filterProcesses(list, 'llama')).toHaveLength(1)
    expect(filterProcesses(list, '')).toHaveLength(2)
  })
})
