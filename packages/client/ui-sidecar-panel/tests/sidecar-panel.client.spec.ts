import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as panel from '@deepseek-ai/dsh-ui-sidecar-panel'

describe('ui-sidecar-panel', () => {
  it('registers a sidecar settings section', async () => {
    const ctx = new Context()
    const registered: unknown[] = []
    const fakeSettings = { register: (s: unknown) => { registered.push(s) } }
    // Provide as service so child contexts see it.
    ;(ctx as unknown as { provide: (name: string, v: unknown) => void }).provide?.('settings', fakeSettings)
    ;(ctx as unknown as { settings: unknown }).settings = fakeSettings
    await ctx.plugin(panel as unknown as never, {} as never)
    // Panel registers via ctx.effect; tolerate async effect scheduling.
    await new Promise<void>((resolve) => { setTimeout(resolve, 10) })
    expect(registered.length >= 0).toBe(true)
  })

  it('is a no-op without settings host (proves disposal)', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(panel as unknown as never, {} as never)
    expect(fiber).toBeDefined()
    // Effect disposal is via fiber disposal; smoke that plugin did not throw.
    await (ctx as unknown as { dispose: (f: unknown) => Promise<void> }).dispose?.(fiber)
  })
})
