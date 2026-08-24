/** Package-owned durable dsh-bench invariants. @module @deepseek-ai/dsh-bench/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-bench'

/** Cordis companion plugin name. */
export const name = 'dsh-bench-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Validate one durable bench/run record. */
function validateBenchRun(event: SessionEvent, fail: InvariantFailure): void {
  if (event.type !== 'bench/run') return
  const data = event.data
  if (data.mode !== 'live' && data.mode !== 'mock') {
    fail(`bench/run mode must be live or mock, got ${JSON.stringify(data.mode)}`)
  }
  if (typeof data.runDir !== 'string' || data.runDir.length === 0) {
    fail('bench/run carries no runDir')
  }
  if (data.ok === true && typeof data.pid !== 'number') {
    fail('bench/run ok=true without a pid')
  }
}

/** Validate all package-owned records already present in one session. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const event of session.events) validateBenchRun(event, fail)
}

/** Install validation for loaded and newly appended bench records. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [_session, event] = args as [Session, SessionEvent]
    if (event.type === 'bench/run') validateBenchRun(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register the dsh-bench invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
