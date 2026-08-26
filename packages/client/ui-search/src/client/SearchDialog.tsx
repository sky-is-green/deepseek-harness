/**
 * SearchDialog: the global cross-session search over the runtime's one-shot
 * `sessions.search` RPC, mounted once into the frame-wide `shell.overlay`
 * seat and opened with Ctrl/Cmd+Shift+F. Queries are debounced and each
 * request carries its own signal, so a faster keystroke supersedes the
 * slower predecessor (stale suppression is this surface's own duty per the
 * session-search contract). Results join the live list snapshot for titles;
 * only listed sessions navigate (`sessions.open` validates against the list).
 */
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SearchHit, SearchInjected } from './slots.ts'
import css from './SearchDialog.module.css'

export interface SearchDialogProps {
  /** Whether any session exists to search within (framework-injected). */
  available: boolean
  searchSessions: SearchInjected['searchSessions']
  openSession: (sessionId: SessionId) => void
  t: TranslateNS<'search'>
}

/** Keystroke debounce before the RPC fires. */
const DEBOUNCE_MS = 250

export function SearchDialog({ available, searchSessions, openSession, t }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(previous => !previous)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [])

  if (!available) return null
  return (
    <Modal open={open} onClose={() => { setOpen(false) }} title={t('search.title')} headless>
      <SearchWindow searchSessions={searchSessions} openSession={openSession} t={t} onClose={() => { setOpen(false) }} />
    </Modal>
  )
}

function SearchWindow({
  searchSessions, openSession, t, onClose,
}: {
  searchSessions: SearchDialogProps['searchSessions']
  openSession: SearchDialogProps['openSession']
  t: SearchDialogProps['t']
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<readonly SearchHit[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  // Debounced supersession: every keystroke cancels the prior request's
  // signal; only the latest response may write state.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === '') {
      setHits(null)
      setHasMore(false)
      setError(null)
      setPending(false)
      return
    }
    const controller = new AbortController()
    setPending(true)
    setError(null)
    const timer = setTimeout(() => {
      searchSessions(trimmed, controller.signal)
        .then(({ hits: results, hasMore: more }) => {
          setHits(results)
          setHasMore(more)
          setPending(false)
        })
        .catch((cause: unknown) => {
          // Superseded requests must not overwrite the winner's results.
          if (controller.signal.aborted) return
          setPending(false)
          setError(cause instanceof Error ? cause.message : String(cause))
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, searchSessions, t])

  const runHit = (hit: SearchHit): void => {
    if (!hit.openable) return
    openSession(hit.sessionId)
    onClose()
  }

  return (
    <div className={css.root}>
      <input
        ref={inputRef}
        className={css.search}
        value={query}
        placeholder={t('search.placeholder')}
        onChange={(e) => { setQuery(e.target.value) }}
        aria-label={t('search.title')}
      />
      <ul className={css.rows} role="listbox" aria-label={t('search.title')}>
        {(hits ?? []).map(hit => (
          <li key={hit.sessionId}>
            <button
              type="button"
              role="option"
              aria-selected="false"
              className={`${css.row}${hit.openable ? '' : ` ${css.inert}`}`}
              onClick={() => { runHit(hit) }}
            >
              <span className={css.hitTitle}>{hit.title}</span>
              {!hit.openable && <span className={css.badge}>{t('search.notLoaded')}</span>}
              <span className={css.snippet}>{hit.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
      {error !== null && <p className={css.status}>{t('search.error', { message: error })}</p>}
      {error === null && pending && query.trim() !== '' && <p className={css.status}>{t('search.pending')}</p>}
      {error === null && !pending && hits !== null && hits.length === 0 && (
        <p className={css.status}>{t('search.empty')}</p>
      )}
      {hasMore && <p className={css.status}>{t('search.hasMore')}</p>}
    </div>
  )
}
