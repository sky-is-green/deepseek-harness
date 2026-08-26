/**
 * The prompt-inspector conversation view: token composition strip, logged
 * request headers (expandable to system text and tool schemas), and
 * producer-injected context rows. A pure reader — every value arrives through
 * the framework session kit and the token-meter projections.
 * @module client/PromptInspectorView
 */

import { useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the `contextBreakdown` / `tokenUsage` projection key merges.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import type {
  InspectorHeaderRow, PromptInspectorSnapshot,
} from './contract.ts'
import type { NS } from './locales.ts'
import css from './PromptInspector.module.css'

/** Full props of the registered inspector view entry. */
export type PromptInspectorViewProps = ConvViewProps & PropsLocale<typeof NS>

/** Stable empty target until the view builder has assembled rows. */
const EMPTY_SNAPSHOT: PromptInspectorSnapshot = { headers: [], contexts: [] }

/** Approximate display figure; the estimator's fixed density is heuristic by design. */
function formatTokens(value: number): string {
  return `~${value.toLocaleString()}`
}

/** One expandable request-header row. */
function RequestRow(props: {
  readonly index: number
  readonly header: InspectorHeaderRow
  readonly expanded: boolean
  readonly onToggle: (seq: number) => void
  readonly t: PromptInspectorViewProps['t']
}) {
  const { index, header, expanded, onToggle, t } = props
  const badges = [
    ...(header.initial ? [t('requests.badge.initial')] : []),
    ...(header.systemChanged ? [t('requests.badge.system')] : []),
    ...(header.toolsChanged ? [t('requests.badge.tools')] : []),
  ]
  const step = header.location.kind === 'step'
    ? t('requests.step', { turn: header.location.turn.turn, step: header.location.step.step })
    : null
  return (
    <li className={css.request}>
      <button
        type="button"
        className={css.requestSummary}
        aria-expanded={expanded}
        onClick={() => { onToggle(header.seq) }}
      >
        <span className={css.requestIndex}>{`#${index}`}</span>
        <span className={css.requestModel}>{header.prompt.config.model}</span>
        {step !== null && <span className={css.requestStep}>{step}</span>}
        {badges.map(badge => (
          <span key={badge} className={css.badge}>{badge}</span>
        ))}
        <span className={css.toolCount}>{`${header.prompt.tools.length}`}</span>
      </button>
      {expanded && (
        <div className={css.requestDetail}>
          <h4 className={css.detailHeading}>{t('requests.systemHeading')}</h4>
          <pre className={css.systemText}>{header.prompt.system}</pre>
          <h4 className={css.detailHeading}>
            {t('requests.toolsHeading', { count: header.prompt.tools.length })}
          </h4>
          {header.prompt.tools.length === 0
            ? <p className={css.dimmed}>{t('requests.toolsEmpty')}</p>
            : (
              <ul className={css.tools}>
                {header.prompt.tools.map(tool => (
                  <li key={tool.name} className={css.tool}>
                    <code className={css.toolName}>{tool.name}</code>
                    <span className={css.toolDescription}>{tool.description}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </li>
  )
}

/**
 * Render the inspector tab body for the current session.
 * @param props - framework runtime share (`useSession`, `useProjection`) plus the locale seat.
 * @returns the inspector layout; empty-state copy where no data exists yet.
 */
export function PromptInspectorView(props: PromptInspectorViewProps) {
  const { useSession, useProjection, t } = props
  const snapshot = useSession(session =>
    session.views.get('prompt-inspector') ?? EMPTY_SNAPSHOT)
  const breakdown = useProjection('contextBreakdown')
  const usage = useProjection('tokenUsage')
  const [expandedSeqs, setExpandedSeqs] = useState<ReadonlySet<number>>(new Set())

  const toggle = (seq: number): void => {
    setExpandedSeqs((current) => {
      const next = new Set(current)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  const headersNewestFirst = [...snapshot.headers].reverse()
  const contextsNewestFirst = [...snapshot.contexts].reverse()
  const usageRows = usage === undefined ? [] : [
    { key: 'tokens.usage.input', value: usage.uncachedInputTokens },
    { key: 'tokens.usage.output', value: usage.outputTokens },
    { key: 'tokens.usage.cacheRead', value: usage.cacheReadTokens },
    { key: 'tokens.usage.cacheWrite', value: usage.cacheWriteTokens },
  ] as const

  return (
    <div className={css.root}>
      <section className={css.section} aria-label={t('tokens.title')}>
        <h3 className={css.heading}>{t('tokens.title')}</h3>
        {breakdown === undefined
          ? <p className={css.dimmed}>{t('tokens.empty')}</p>
          : (
            <dl className={css.figures}>
              <div className={`${css.figure} ${css.figureSystem}`}>
                <dt>{t('tokens.system')}</dt>
                <dd>{formatTokens(breakdown.systemTokens)}</dd>
              </div>
              <div className={`${css.figure} ${css.figureTools}`}>
                <dt>{t('tokens.tools')}</dt>
                <dd>{formatTokens(breakdown.toolsTokens)}</dd>
              </div>
              <div className={`${css.figure} ${css.figureMessages}`}>
                <dt>{t('tokens.messages')}</dt>
                <dd>{formatTokens(breakdown.messageTokens)}</dd>
              </div>
            </dl>
          )}
        {usageRows.length > 0 && (
          <dl className={css.figures}>
            <dt className={css.usageTitle}>{t('tokens.usage.title')}</dt>
            {usageRows.map(row => (
              <div key={row.key} className={css.figure}>
                <dt>{t(row.key)}</dt>
                <dd>{formatTokens(row.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={css.section} aria-label={t('contexts.title')}>
        <h3 className={css.heading}>{t('contexts.title')}</h3>
        {contextsNewestFirst.length === 0
          ? <p className={css.dimmed}>{t('contexts.empty')}</p>
          : (
            <ul className={css.contexts}>
              {contextsNewestFirst.map(context => (
                <li key={context.seq} className={css.contextRow}>
                  <span className={css.contextRole}>{t(`contexts.role.${context.role}`)}</span>
                  <span className={css.contextLabel}>{context.label ?? context.role}</span>
                  <span className={css.contextPreview}>{context.preview}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className={css.section} aria-label={t('requests.title')}>
        <h3 className={css.heading}>{t('requests.title')}</h3>
        {headersNewestFirst.length === 0
          ? <p className={css.dimmed}>{t('requests.empty')}</p>
          : (
            <ol className={css.requests}>
              {headersNewestFirst.map((header, index) => (
                <RequestRow
                  key={header.seq}
                  index={headersNewestFirst.length - index}
                  header={header}
                  expanded={expandedSeqs.has(header.seq)}
                  onToggle={toggle}
                  t={t}
                />
              ))}
            </ol>
          )}
      </section>
    </div>
  )
}
