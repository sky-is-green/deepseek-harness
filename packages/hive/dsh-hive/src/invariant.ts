/** Package-owned durable dsh-hive invariants. @module @deepseek-ai/dsh-hive/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-hive'
const SOURCE_NAME = 'dsh-hive'

/** Cordis companion plugin name. */
export const name = 'dsh-hive-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Validate one durable dsh-hive context injection. */
function validateInjection(
  history: readonly SessionEvent[],
  event: SessionEvent,
  fail: InvariantFailure,
): void {
  const message = event.type === 'user/message' ? event.data : undefined
  if (message === undefined) return
  if (message.source.kind !== 'plugin') return
  if (message.source.plugin !== SOURCE_NAME) return
  if (message.source.form !== 'snapshot') {
    fail(`dsh-hive injection uses form ${JSON.stringify(message.source.form)}, expected "snapshot"`)
  }
  if (!Array.isArray(message.source.sections) || message.source.sections.length === 0) {
    fail('dsh-hive injection carries no sections')
    return
  }
  for (const section of message.source.sections as { name?: string; text?: string }[]) {
    if (section.name !== SOURCE_NAME || typeof section.text !== 'string') {
      fail('dsh-hive injection section is malformed')
    }
  }
  const text = message.content.find(block => block.type === 'text')
  if (text === undefined || typeof text.text !== 'string' || text.text.length === 0) {
    fail('dsh-hive injection carries no text content')
  }
  // The curated context must enter after its query: an injection at index 0
  // with no preceding user message would mean the query was never claimed.
  const hasPrecedingUser = history.some(previous => previous.type === 'user/message')
  if (!hasPrecedingUser) {
    fail('dsh-hive injection precedes any user message')
  }
}

/** Validate all package-owned injections already present in one session. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const [index, event] of session.events.entries()) {
    if (event.type !== 'user/message'
      || event.data.source.kind !== 'plugin'
      || event.data.source.plugin !== SOURCE_NAME) continue
    validateInjection(session.events.slice(0, index), event, fail)
  }
}

/** Install validation for loaded and newly appended context injections. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [session, event] = args as [Session, SessionEvent]
    if (event.type !== 'user/message'
      || event.data.source.kind !== 'plugin'
      || event.data.source.plugin !== SOURCE_NAME) return
    validateInjection(session.events, event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register the dsh-hive invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
