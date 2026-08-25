/**
 * Frozen contract of the client command surface. Types only. The
 * CommandUiRuntime (`ctx.commandUi`) implements this face; business packages
 * consume `register` alone.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'

/** Copy for an option that must be acknowledged before onSelect can run. */
export interface SelectConfirmation {
  readonly title: string
  readonly description: string
  readonly acknowledgeLabel: string
  readonly cancelLabel: string
  readonly confirmLabel: string
}

/** One option row of a popupSelect shell. */
export interface SelectOption {
  readonly id: string
  readonly label: string
  readonly detail?: string
  readonly active?: boolean
  /** Optional in-page risk gate owned by the shared popup shell. */
  readonly confirmation?: SelectConfirmation
}

/**
 * Business registration for the popupSelect command kind. Data is
 * self-served: options/onSelect use the business package's own protocol.
 * The shell component is owned by ui-commands; business never sees it. Both
 * callbacks receive the ClientSessionContext captured at popup open.
 */
export type CommandUiSpec = {
  readonly kind: 'popupSelect'
  options(session: ClientSessionContext, signal: AbortSignal): Promise<readonly SelectOption[]>
  onSelect(option: SelectOption, session: ClientSessionContext): void | Promise<void>
}

/**
 * One client-owned command contribution: a slash-menu entry whose behavior
 * lives entirely on the client (no host descriptor). Merged with the host
 * catalog by name — a collision with a host command fails loud at candidate
 * synthesis, never shadows.
 */
export interface CommandContribution {
  /** Command name without the leading slash (unique across contributions). */
  readonly name: string
  /** Menu row description. */
  readonly description: string
  /** Capability filter, called with a fresh projection per candidate pass. */
  available(session: ClientSessionContext): boolean
  /** The command's UI behavior (this phase: popupSelect only). */
  readonly ui: CommandUiSpec
}

/**
 * A UI decoration hung on one HOST command: what its BARE invocation does on
 * this client. Not a second command — the host command keeps its catalog
 * row, its argument claim (space / argued enter), and its lifecycle logging;
 * the decoration replaces only the bare menu-pick/enter with a popup whose
 * onSelect typically submits a completed line back through command.execute.
 * A decoration never manufactures a row: a name with no host catalog entry
 * in the session's directory simply never reaches the decoration.
 */
export interface CommandDecoration {
  /** The HOST command name this decorates (without the leading slash). */
  readonly name: string
  /** Capability filter, called with a fresh projection per bare invocation. */
  available(session: ClientSessionContext): boolean
  /** The bare-invocation UI (this phase: popupSelect only). */
  readonly ui: CommandUiSpec
}

/**
 * One palette-surface command row: the session's available commands folded
 * into a form a palette-style surface can render and run without the slash
 * token machinery. Popup entries carry self-served option callbacks bound to
 * the queried session; host entries execute through the palette surface's
 * own `command.execute` submission (`/${name}`, bare).
 */
export interface CommandPaletteEntry {
  /** Command name without the leading slash. */
  readonly name: string
  /** Menu row description. */
  readonly description: string
  /** `host` runs as a bare detached execute; `popup` selects an option first. */
  readonly kind: 'host' | 'popup'
  /**
   * Host only: the command declares leading input, so a bare invocation
   * cannot run — the surface should render the row inert (argument claims
   * stay composer-owned).
   */
  readonly argsRequired?: boolean
  /** Popup only: fetch this command's option rows. */
  options?(signal: AbortSignal): Promise<readonly SelectOption[]>
  /** Popup only: run one picked option. */
  onSelect?(option: SelectOption): void | Promise<void>
}

/** The `ctx.commandUi` service face visible to business packages. */
export interface CommandUiContract {
  /**
   * Register one client command contribution; effect disposer. Duplicate
   * names throw at registration.
   */
  register(contribution: CommandContribution): () => void
  /**
   * Hang a bare-invocation decoration on one host command; effect disposer.
   * Duplicate names throw at registration.
   */
  decorate(decoration: CommandDecoration): () => void
  /** Resolve the per-session popup controller for one session scope (wiring/overlay layer). */
  popupFor(actx: ClientContext): unknown
  /**
   * The session's available commands as palette-surface rows: the host
   * catalog plus availability-filtered contributions, unranked (the caller
   * filters). A contribution colliding with a host name fails loud, matching
   * candidate synthesis. Addressed subagent sessions serve an empty roster,
   * mirroring the directory loader.
   * @param session - the queried session projection.
   * @param signal - cancellation for the underlying catalog pull.
   * @returns one row per available command.
   */
  paletteEntries(session: ClientSessionContext, signal: AbortSignal): Promise<readonly CommandPaletteEntry[]>
}
