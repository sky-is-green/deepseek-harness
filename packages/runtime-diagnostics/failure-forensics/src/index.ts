/**
 * Failure forensics plugin: registers the `failureForensics` projection unit
 * folding durable failure signals into bounded, fix-hinted entries.
 *
 * @module @deepseek-ai/dsh-failure-forensics
 */

import { Context } from '@deepseek-ai/cordis'
// Type-only: resolves the optional projection registry Context declaration.
import type {} from '@deepseek-ai/dsh-session-projection'
import {
  applyForensicEvent, EMPTY_FORENSICS_STATE, forensicsStateSchema, forensicsViewSchema,
} from './fold.ts'

/** Cordis plugin name. */
export const name = 'failure-forensics'

/** Service the unit registration waits on. */
export const inject = ['sessionProjections']

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The bounded fold state behind the client-visible `FailureForensicsView`. */
    failureForensics: import('./fold.ts').ForensicsState
  }
}

/**
 * Plugin body: register the projection unit. Registration rides the calling
 * fiber's effect wrapper, so unloading the plugin removes the key.
 * @param ctx - host context providing the sessionProjections registry.
 */
export function apply(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'failureForensics', import('./fold.ts').ForensicsState>({
      key: 'failureForensics',
      stateVersion: 1,
      stateSchema: forensicsStateSchema,
      init: () => EMPTY_FORENSICS_STATE,
      apply: applyForensicEvent,
      wire: { viewSchema: forensicsViewSchema, view: ({ entries }) => ({ entries }) },
    })
  })
}
