/**
 * The turn-tail failure detail row: renders the `failureForensics` entries
 * for the closing turn — kind badge, bounded message, code/request-id/exit
 * fields, output tail, and the deterministic suggested fix. Renders nothing
 * when the projection has no entries for this turn.
 * @module client/FailureDetail
 */

import { useState } from 'react'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the `failureForensics` projection key merge.
import type {} from '@deepseek-ai/dsh-failure-forensics/client'
import type { FailureEntry } from '@deepseek-ai/dsh-failure-forensics/client'
import type { FailureForensicsKey, NS } from './locales.ts'
import css from './FailureDetail.module.css'

/** Full props of the registered turn-tail entry: runtime share (useProjection), chain match, locale seat. */
export type FailureDetailProps =
  & PropsRuntime<'conversation.chat.turnTail'>
  & { matched: { readonly turn: number } }
  & PropsLocale<typeof NS>
  & Pick<TurnTailOwnerProps, 'turn'>

function entryTitle(entry: FailureEntry, t: FailureDetailProps['t']): string {
  return t(`detail.kind.${entry.kind}`)
}

/**
 * Render one turn's forensic entries; null when none apply so an ordinary
 * turn's tail stays exactly as the shipped view drew it.
 * @param props - framework runtime share, chain match, owner turn, and locale seat.
 * @returns the failure detail row, or null without matching entries.
 */
export function FailureDetail({ useProjection, matched, t }: FailureDetailProps) {
  const view = useProjection('failureForensics')
  const entries = (view?.entries ?? []).filter(entry => entry.turn === matched.turn).reverse()
  const [openCodes, setOpenCodes] = useState<ReadonlySet<number>>(new Set())

  if (entries.length === 0) return null

  const toggle = (seq: number): void => {
    setOpenCodes((current) => {
      const next = new Set(current)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  return (
    <div className={css.root} role="group" aria-label={t('detail.title')}>
      {entries.map((entry) => {
        const open = openCodes.has(entry.seq)
        const fixKey = entry.suggestedFix === null
          ? null
          : `detail.fix.${entry.suggestedFix}` as FailureForensicsKey
        return (
          <div key={entry.seq} className={css.entry}>
            <button
              type="button"
              className={css.head}
              aria-expanded={open}
              onClick={() => { toggle(entry.seq) }}
            >
              <span className={css.badge}>{entryTitle(entry, t)}</span>
              <span className={css.message}>{entry.message}</span>
              {entry.code !== null && <code className={css.code}>{entry.code}</code>}
              {entry.tool !== undefined && <span className={css.tool}>{entry.tool}</span>}
            </button>
            {open && (
              <dl className={css.fields}>
                {entry.code !== null && (
                  <>
                    <dt>{t('detail.code')}</dt>
                    <dd><code>{entry.code}</code></dd>
                  </>
                )}
                {entry.requestId !== undefined && (
                  <>
                    <dt>{t('detail.requestId')}</dt>
                    <dd><code>{entry.requestId}</code></dd>
                  </>
                )}
                {entry.exit !== undefined && (
                  <>
                    <dt>{t('detail.exit')}</dt>
                    <dd>{entry.exit}</dd>
                  </>
                )}
                {fixKey !== null && (
                  <>
                    <dt>{t('detail.fix')}</dt>
                    <dd className={css.fix}>{t(fixKey)}</dd>
                  </>
                )}
                {entry.outputTail !== undefined && (
                  <pre className={css.output}>{entry.outputTail}</pre>
                )}
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}
