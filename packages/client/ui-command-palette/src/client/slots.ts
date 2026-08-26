/**
 * The command palette's injected face: plain data and callbacks bound to the
 * apply closure's `commandUi`, `sessions`, and `remote` services. Components
 * never see ctx (packages/client/AGENTS.md ctx discipline).
 */
import type { CommandPaletteEntry } from '@deepseek-ai/dsh-client-ui-commands/client'

/** Injected business face of the shell-overlay palette. */
export interface PaletteInjected {
  /** Whether a current session exists (the palette needs one to list commands). */
  available: boolean
  /**
   * Fetch the session's available palette entries once per open.
   * @returns the unranked entry roster; empty when no session is current.
   */
  entries(): Promise<readonly CommandPaletteEntry[]>
  /**
   * Execute one bare host command against the current session (detached
   * semantics: handler failures render as durable flow nodes; only
   * admission/transport failures reject).
   * @param name - command name without the leading slash.
   */
  executeHost(name: string): Promise<void>
}
