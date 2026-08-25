/**
 * CommandPalette: the global Ctrl+K palette over `ctx.commandUi` palette
 * entries, mounted once into the frame-wide `shell.overlay` seat. Two
 * stages — command rows, then an option list for popup entries — with type
 * -to-filter, arrow navigation, and Enter/click execution. Host entries run
 * as bare detached executes; handler outcomes render as durable flow nodes,
 * so only admission/transport failures surface here.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CommandPaletteEntry, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { PaletteInjected } from './slots.ts'
import css from './CommandPalette.module.css'

export interface CommandPaletteProps {
  /** The current session's palette face (framework-injected at registration). */
  available: boolean
  entries: PaletteInjected['entries']
  executeHost: PaletteInjected['executeHost']
  t: TranslateNS<'command-palette'>
}

/** Case-insensitive substring filter over name + description, order-stable. */
function matches(entry: CommandPaletteEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q)
}

/** Stage 2 state: the popup entry whose options are showing; null is the commands stage. */
interface OptionsStage {
  readonly entry: CommandPaletteEntry
  readonly options: readonly SelectOption[]
}

/** One visible row: either a command entry or a popup option of one entry. */
type Row =
  | { readonly kind: 'command'; readonly entry: CommandPaletteEntry }
  | { readonly kind: 'option'; readonly entry: CommandPaletteEntry; readonly option: SelectOption }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function CommandPalette({ available, entries, executeHost, t }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  // Ctrl/Cmd+K toggles; the listener lives while mounted (shell.overlay is
  // always mounted), matching the house style of component-scoped hotkeys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(previous => !previous)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [])

  if (!available) return null
  return (
    <Modal open={open} onClose={() => { setOpen(false) }} title={t('palette.title')} headless>
      <PaletteWindow entries={entries} executeHost={executeHost} t={t} onClose={() => { setOpen(false) }} />
    </Modal>
  )
}

function PaletteWindow({
  entries, executeHost, t, onClose,
}: {
  entries: PaletteInjected['entries']
  executeHost: PaletteInjected['executeHost']
  t: CommandPaletteProps['t']
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [roster, setRoster] = useState<readonly CommandPaletteEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optionsStage, setOptionsStage] = useState<OptionsStage | null>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // One fetch per open; the roster stays unranked and the query filters locally.
  useEffect(() => {
    let cancelled = false
    entries().then(
      (loaded) => { if (!cancelled) setRoster(loaded) },
      (cause: unknown) => { if (!cancelled) setError(t('palette.loadError', { message: errorMessage(cause) })) },
    )
    inputRef.current?.focus()
    return () => { cancelled = true }
  }, [entries, t])

  const rows = useMemo<readonly Row[]>(() => {
    if (optionsStage !== null) {
      return optionsStage.options.map(option => ({ kind: 'option' as const, entry: optionsStage.entry, option }))
    }
    return (roster ?? []).filter(entry => matches(entry, query)).map(entry => ({ kind: 'command' as const, entry }))
  }, [optionsStage, roster, query])
  useEffect(() => { if (active >= rows.length) setActive(0) }, [rows.length, active])

  const openOptions = (entry: CommandPaletteEntry): void => {
    setBusy(true)
    entry.options?.(new AbortController().signal).then(
      (options) => {
        setBusy(false)
        setError(null)
        setOptionsStage({ entry, options })
        setActive(0)
        setQuery('')
      },
      (cause: unknown) => {
        setBusy(false)
        setError(t('palette.optionLoadError', { message: `${entry.name}: ${errorMessage(cause)}` }))
      },
    )
  }

  const runRow = (row: Row | undefined): void => {
    if (row === undefined || busy) return
    if (row.kind === 'command') {
      if (row.entry.kind === 'popup') { openOptions(row.entry); return }
      // LeadingInput host rows stay composer-owned (the claim machinery is
      // the only admission path for arguments); the palette renders them inert.
      if (row.entry.argsRequired === true) return
      // Host bare execute: handler outcomes render as durable flow nodes, so
      // only an admission/transport rejection surfaces — keep the palette
      // open with the reason instead of closing over a failed run.
      setBusy(true)
      executeHost(row.entry.name).then(onClose, (cause: unknown) => {
        setBusy(false)
        setError(t('palette.executeError', { message: errorMessage(cause) }))
      })
      return
    }
    setBusy(true)
    Promise.resolve(row.entry.onSelect?.(row.option)).then(onClose, (cause: unknown) => {
      setBusy(false)
      setError(t('palette.executeError', { message: errorMessage(cause) }))
    })
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runRow(rows[active])
    } else if (e.key === 'Backspace' && query === '' && optionsStage !== null) {
      e.preventDefault()
      setOptionsStage(null)
      setError(null)
    }
  }

  const rowLabel = (row: Row): string =>
    row.kind === 'command' ? `/${row.entry.name}` : `/${row.entry.name} ${row.option.label}`
  const rowDetail = (row: Row): string =>
    row.kind === 'command' ? row.entry.description : row.option.detail ?? ''

  return (
    <div className={css.root} onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        className={css.search}
        value={query}
        placeholder={t('palette.placeholder')}
        onChange={(e) => { setQuery(e.target.value); setActive(0) }}
        aria-label={t('palette.title')}
      />
      <ul className={css.rows} role="listbox" aria-label={t('palette.title')}>
        {rows.map((row, index) => (
          <li key={row.kind === 'command' ? row.entry.name : `${row.entry.name}/${row.option.id}`}>
            <button
              type="button"
              role="option"
              aria-selected={index === active}
              className={`${css.row}${index === active ? ` ${css.active}` : ''}${row.kind === 'command' && row.entry.argsRequired === true ? ` ${css.args}` : ''}`}
              onMouseMove={() => { setActive(index) }}
              onClick={() => { runRow(row) }}
            >
              <span className={css.name}>{rowLabel(row)}</span>
              <span className={css.detail}>{rowDetail(row)}</span>
            </button>
          </li>
        ))}
      </ul>
      {(rows.length === 0 || error !== null) && (
        <p className={`${css.empty}${error !== null ? ` ${css.error}` : ''}`}>
          {error ?? t('palette.empty')}
        </p>
      )}
      <p className={css.hint}>{t('palette.hint')}</p>
    </div>
  )
}
