/**
 * ModelsManager: the local-models settings section. Cards render the
 * `ctx.models` catalog with live load-state badges and Load/Unload actions;
 * running downloads show determinate progress bars (indeterminate while the
 * server reports no total) with cancel; a small form starts Hugging Face
 * GGUF downloads. All state rides the hooks-bound read model mirrored from
 * the service's event stream.
 */
import { useEffect, useState } from 'react'
import type { LocalModelId, ModelKind, ModelLoadState } from '@deepseek-ai/dsh-models'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ModelsManager.module.css'

/** The read-model slice the section renders (structural twin of the store state). */
export interface ModelsSnapshot {
  loaded: boolean
  entries: readonly {
    id: LocalModelId
    name: string
    kind: ModelKind
    sizeBytes: number
    architecture?: string
    quantization?: string
  }[]
  states: Readonly<Record<string, ModelLoadState>>
  downloads: readonly {
    id: string
    request: { name: string }
    bytesReceived: number
    bytesTotal: number | null
  }[]
}

export interface ModelsManagerProps {
  /** Roster snapshot bound by the renderer as useModels. */
  useModels: <S>(selector: (state: ModelsSnapshot) => S) => S
  load: () => void
  requestLoad: (modelId: LocalModelId) => void
  requestUnload: (modelId: LocalModelId) => void
  startDownload: (repo: string, file: string, name: string, kind: ModelKind) => void
  cancelDownload: (downloadId: string) => void
  t: TranslateNS<'models.manager'>
}

/** GB with one decimal — catalog sizes are byte counts. */
function sizeOf(bytes: number): string {
  return `${(Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10).toFixed(1)} GB`
}

/** The state badge's copy key per load state. */
function badgeKey(state: ModelLoadState): 'manager.loaded' | 'manager.loading' | 'manager.unloading' | 'manager.failed' | null {
  switch (state.status) {
    case 'loaded': return 'manager.loaded'
    case 'loading': return 'manager.loading'
    case 'unloading': return 'manager.unloading'
    case 'failed': return 'manager.failed'
    default: return null
  }
}

export function ModelsManager({ useModels, load, requestLoad, requestUnload, startDownload, cancelDownload, t }: ModelsManagerProps) {
  const state = useModels(snapshot => snapshot)
  const [repo, setRepo] = useState('')
  const [file, setFile] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ModelKind>('llm')

  // One initial pull; event subscriptions keep the store fresh afterwards.
  useEffect(() => { load() }, [load])

  const submitDownload = (): void => {
    if (repo.trim() === '' || file.trim() === '') return
    startDownload(repo.trim(), file.trim(), name.trim() === '' ? file.trim() : name.trim(), kind)
    setRepo('')
    setFile('')
    setName('')
  }

  return (
    <section className={css.root} aria-label={t('manager.title')}>
      <h3 className={css.heading}>{t('manager.title')}</h3>
      {!state.loaded && <p className={css.status}>{t('manager.pending')}</p>}
      {state.loaded && state.entries.length === 0 && <p className={css.status}>{t('manager.empty')}</p>}
      <ul className={css.cards}>
        {state.entries.map((entry) => {
          const loadState = state.states[entry.id]
          const badge = loadState !== undefined ? badgeKey(loadState) : null
          return (
            <li key={entry.id} className={css.card}>
              <div className={css.cardHead}>
                <span className={css.name}>{entry.name}</span>
                {badge !== null && (
                  <span className={`${css.badge}${loadState?.status === 'loaded' ? ` ${css.loadedBadge}` : ''}`}>
                    {t(badge)}
                  </span>
                )}
              </div>
              <p className={css.meta}>
                {[entry.architecture, entry.quantization, sizeOf(entry.sizeBytes)].filter(part => part !== undefined).join(' · ')}
              </p>
              {loadState?.status === 'failed' && <p className={css.fail}>{loadState.message}</p>}
              {(loadState?.status === 'loading' || loadState?.status === 'unloading') && (
                <span className={css.bar} aria-hidden>
                  <span className={css.fill} data-indeterminate />
                </span>
              )}
              <div className={css.actions}>
                {(loadState === undefined || loadState.status === 'unloaded' || loadState.status === 'failed') && (
                  <button type="button" className={css.button} onClick={() => { requestLoad(entry.id) }}>
                    {t('manager.load')}
                  </button>
                )}
                {loadState?.status === 'loaded' && (
                  <button type="button" className={css.button} onClick={() => { requestUnload(entry.id) }}>
                    {t('manager.unload')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {state.downloads.length > 0 && (
        <>
          <h4 className={css.subHeading}>{t('manager.downloads')}</h4>
          <ul className={css.downloads}>
            {state.downloads.map((row) => {
              const percent = row.bytesTotal !== null && row.bytesTotal > 0
                ? Math.min(100, Math.round(row.bytesReceived / row.bytesTotal * 100))
                : null
              return (
                <li key={row.id} className={css.download}>
                  <span className={css.dlName}>{row.request.name}</span>
                  <span className={css.bar}>
                    <span
                      className={css.fill}
                      style={percent !== null ? { width: `${percent}%` } : { width: '40%' }}
                      data-indeterminate={percent === null ? true : undefined}
                    />
                  </span>
                  <button type="button" className={css.button} onClick={() => { cancelDownload(row.id) }}>
                    {t('manager.cancel')}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <form
        className={css.form}
        onSubmit={(e) => { e.preventDefault(); submitDownload() }}
      >
        <input className={css.input} value={repo} onChange={(e) => { setRepo(e.target.value) }} placeholder={t('manager.form.repo')} aria-label={t('manager.form.repo')} />
        <input className={css.input} value={file} onChange={(e) => { setFile(e.target.value) }} placeholder={t('manager.form.file')} aria-label={t('manager.form.file')} />
        <input className={css.input} value={name} onChange={(e) => { setName(e.target.value) }} placeholder={t('manager.form.name')} aria-label={t('manager.form.name')} />
        <select className={css.input} value={kind} onChange={(e) => { setKind(e.target.value as ModelKind) }} aria-label={t('manager.form.kind')}>
          <option value="llm">{t('manager.kind.llm')}</option>
          <option value="embedding">{t('manager.kind.embedding')}</option>
        </select>
        <button type="submit" className={css.button}>{t('manager.download')}</button>
      </form>
    </section>
  )
}
