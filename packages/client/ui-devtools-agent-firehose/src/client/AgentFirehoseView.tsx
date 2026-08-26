/**
 * The agent-firehose conversation view: a per-turn waterfall of step and tool
 * spans above a rolling table of the most recent committed events. A pure
 * reader over the `agent-firehose` target snapshot.
 * @module client/AgentFirehoseView
 */

import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  AgentFirehoseSnapshot, FirehoseTurnWaterfall,
} from './contract.ts'
import { FIREHOSE_WINDOW } from './contract.ts'
import type { NS } from './locales.ts'
import css from './AgentFirehose.module.css'

/** Full props of the registered firehose view entry. */
export type AgentFirehoseViewProps = ConvViewProps & PropsLocale<typeof NS>

/** Stable empty target until the view builder has assembled rows. */
const EMPTY_SNAPSHOT: AgentFirehoseSnapshot = { rows: [], turns: [] }

function clockTime(time: number): string {
  return new Date(time).toLocaleTimeString()
}

function durationMs(startTime: number, endTime: number): string {
  const ms = Math.max(0, endTime - startTime)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** One turn's waterfall lane; spans are placed proportionally inside the turn span. */
function TurnLane(props: {
  readonly waterfall: FirehoseTurnWaterfall
  readonly t: AgentFirehoseViewProps['t']
}) {
  const { waterfall, t } = props
  const first = waterfall.spans[0]
  const start = waterfall.startTime ?? first?.startTime
  if (start === undefined) return null
  const end = waterfall.endTime ?? Math.max(...waterfall.spans.map(span => span.endTime ?? span.startTime))
  const total = Math.max(1, end - start)
  const label = waterfall.turn === null ? '—' : t('waterfall.turn', { turn: waterfall.turn })
  return (
    <div className={css.lane}>
      <span className={css.laneLabel}>{label}</span>
      <div className={css.laneTrack}>
        {waterfall.spans.map((span, index) => {
          const offset = ((span.startTime - start) / total) * 100
          const width = Math.max(0.5, (((span.endTime ?? end) - span.startTime) / total) * 100)
          return (
            <div
              key={`${span.kind}-${index}`}
              className={span.failed
                ? `${css.span} ${css.spanFailed}`
                : span.kind === 'step' ? `${css.span} ${css.spanStep}` : css.span}
              style={{ marginInlineStart: `${offset}%`, width: `${width}%` }}
              title={`${span.label} · ${durationMs(span.startTime, span.endTime ?? end)}`}
            >
              <span className={css.spanLabel}>{span.label}</span>
            </div>
          )
        })}
        {waterfall.endTime === null && waterfall.spans.length > 0 && (
          <span className={css.running}>{t('waterfall.running')}</span>
        )}
      </div>
    </div>
  )
}

/**
 * Render the firehose tab body for the current session.
 * @param props - framework runtime share (`useSession`) plus the locale seat.
 * @returns the waterfall and rolling event table; empty-state copy when bare.
 */
export function AgentFirehoseView(props: AgentFirehoseViewProps) {
  const { useSession, t } = props
  const snapshot = useSession(session =>
    session.views.get('agent-firehose') ?? EMPTY_SNAPSHOT)
  const rowsNewestFirst = [...snapshot.rows].reverse()

  return (
    <div className={css.root}>
      <section className={css.section} aria-label={t('waterfall.title')}>
        <h3 className={css.heading}>{t('waterfall.title')}</h3>
        {snapshot.turns.length === 0
          ? <p className={css.dimmed}>{t('waterfall.empty')}</p>
          : snapshot.turns.map(waterfall => (
            <TurnLane key={waterfall.turn ?? 'null'} waterfall={waterfall} t={t} />
          ))}
      </section>

      <section className={css.section} aria-label={t('events.title')}>
        <div className={css.tableHead}>
          <h3 className={css.heading}>{t('events.title')}</h3>
          {rowsNewestFirst.length >= FIREHOSE_WINDOW && (
            <span className={css.windowNote}>
              {t('events.window', { count: FIREHOSE_WINDOW })}
            </span>
          )}
        </div>
        {rowsNewestFirst.length === 0
          ? <p className={css.dimmed}>{t('events.empty')}</p>
          : (
            <table className={css.table}>
              <thead>
                <tr>
                  <th scope="col">{t('events.col.seq')}</th>
                  <th scope="col">{t('events.col.time')}</th>
                  <th scope="col">{t('events.col.type')}</th>
                  <th scope="col">{t('events.col.summary')}</th>
                </tr>
              </thead>
              <tbody>
                {rowsNewestFirst.map(row => (
                  <tr key={row.seq}>
                    <td className={css.seq}>{row.seq}</td>
                    <td className={css.time}>{clockTime(row.time)}</td>
                    <td className={css.type}>{row.type}</td>
                    <td className={css.summary}>{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </div>
  )
}
