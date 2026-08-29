/**
 * Package-owned durable dsh-bench invariants.
 * @module @deepseek-ai/dsh-bench/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-bench'

/** Cordis companion plugin name. */
export const name = 'dsh-bench-invariant'

/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Validate one durable bench/run record.
 * @param event - session event.
 * @param fail - call to report a violation.
 */
function validateBenchRun(
  event: { type: string; data: unknown },
  fail: (msg: string) => void,
): void {
  if (event.type !== 'bench/run') return
  const data = event.data as { mode?: unknown; runDir?: unknown; pid?: unknown; ok?: unknown }
  if (data.mode !== 'live' && data.mode !== 'mock')
    fail(`bench/run mode must be live or mock, got ${JSON.stringify(data.mode)}`)
  if (typeof data.runDir !== 'string' || data.runDir.length === 0) fail('bench/run carries no runDir')
  if (data.ok === true && typeof data.pid !== 'number') fail('bench/run ok=true without a pid')
}

/**
 * Validate all package-owned records already present in one session.
 * @param session - session to inspect.
 * @param fail - violation reporter.
 */
function validateSession(
  session: { events: Array<{ type: string; data: unknown }> },
  fail: (msg: string) => void,
): void {
  for (const event of session.events) validateBenchRun(event, fail)
}

/** Install validation for loaded and newly appended bench records. */
const install: InvariantInstaller = Object.assign(
  (ctx: Context, fail: (msg: string) => void) => {
    const holder = ctx as unknown as { sessions?: { list: () => Array<{ events: Array<{ type: string; data: unknown }> }> } }
    const sessions = holder.sessions
    if (sessions === undefined) return
    for (const session of sessions.list()) validateSession(session, fail)
    ;(ctx as unknown as { on: (ev: string, fn: (...args: unknown[]) => void, opts: unknown) => void }).on(
      'session/created',
      (session) => {
        validateSession(session as never, fail)
      },
      { global: true },
    )
    ;(ctx as unknown as { on: (ev: string, fn: (...args: unknown[]) => void, opts: unknown) => void }).on(
      'internal/dispatch',
      (_mode: unknown, eventName: unknown, args: unknown) => {
        if (eventName !== 'session/event') return
        const [_session, event] = args as [unknown, { type: string; data: unknown }]
        if ((event as { type: string }).type === 'bench/run') validateBenchRun(event, fail)
      },
      { global: true },
    )
  },
  { inject: ['sessions'] },
)

/**
 * Register the dsh-bench invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
