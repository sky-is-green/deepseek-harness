/** The MCP servers card: staged add/remove over the `mcp` settings namespace. */

import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { CardForm, type CardActions, type CardFieldState, type CardShell } from './card-form.ts'

/**
 * Namespace of the MCP capability. Spelled here rather than imported: a
 * client package must not depend on a Host package.
 */
export const MCP_NS = 'mcp'

/** Valid `serverName`, kept below the public tool-name budget. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** One MCP server entry as stored in settings. */
export interface McpServerConfig {
  /** Stable local namespace for this server's model-facing tool names. */
  serverName: string
  /** Transport discriminator. */
  transport: 'stdio' | 'streamable-http'
  /** Executable for stdio transport. */
  command?: string
  /** Arguments for stdio transport. */
  args?: string[]
  /** Working directory for stdio transport. */
  cwd?: string
  /** Extra env vars for stdio transport. */
  env?: Record<string, string>
  /** Endpoint URL for streamable-http transport. */
  url?: string
  /** Extra headers for streamable-http transport. */
  headers?: Record<string, string>
}

/** The `mcp` settings section this card edits. */
export interface McpSettings {
  /** Ordered list of configured MCP servers. */
  servers?: McpServerConfig[]
}

/** Draft for the new-server form. */
export interface McpDraft {
  /** New server's name. */
  serverName: string
  /** Chosen transport for the new entry. */
  transport: 'stdio' | 'streamable-http'
  /** Command for stdio. */
  command: string
  /** Space-separated args for stdio, staged as text then split on save. */
  argsText: string
  /** URL for http. */
  url: string
}

/** What the MCP card renders. */
export interface McpCardState extends CardShell {
  /** Effective or staged servers. */
  servers: readonly McpServerConfig[]
  /** The staged `servers` field as a text control (for invalid reporting). */
  serversField: CardFieldState
  /** Draft for the add-server form. */
  draft: McpDraft
  /** Whether the draft cannot be added as staged. */
  draftInvalid: boolean
  /** Human reason the draft is invalid, when one exists. */
  draftError: string | null
}

/** The registration-side face the MCP card's slot entry injects. */
export interface McpCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useMcpCard. */
    mcpCard: SnapshotStore<McpCardState>
  }
  /** Stage draft text for one new-server field. */
  editDraft: (field: keyof McpDraft, text: string) => void
  /** Stage the draft as a new server entry. */
  addServer: () => void
  /** Stage removal of one server by name. */
  removeServer: (serverName: string) => void
}

/**
 * Validate one server entry shape.
 * @param entry - candidate entry.
 * @returns error reason or null when valid.
 */
function validateEntry(entry: McpServerConfig): string | null {
  if (!SERVER_NAME_PATTERN.test(entry.serverName)) return 'badName'
  if (entry.transport !== 'stdio' && entry.transport !== 'streamable-http') return 'badTransport'
  if (entry.transport === 'stdio') {
    if (typeof entry.command !== 'string' || entry.command.trim() === '') return 'missingCommand'
  }
  if (entry.transport === 'streamable-http') {
    if (typeof entry.url !== 'string' || entry.url.trim() === '') return 'missingUrl'
  }
  return null
}

/**
 * Field spec for the `servers` array: JSON array staged as text.
 * @returns the spec.
 */
function serversField(): import('./card-form.ts').CardFieldSpec {
  return {
    field: 'servers',
    format: (value) => {
      if (value === undefined) return ''
      if (!Array.isArray(value)) return ''
      if (value.length === 0) return ''
      return JSON.stringify(value, null, 2)
    },
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        return undefined
      }
      if (!Array.isArray(parsed)) return undefined
      const seen = new Set<string>()
      for (const entry of parsed as McpServerConfig[]) {
        if (typeof entry !== 'object' || entry === null) return undefined
        const err = validateEntry(entry)
        if (err !== null) return undefined
        if (seen.has(entry.serverName)) return undefined
        seen.add(entry.serverName)
      }
      return { kind: 'set', value: parsed }
    },
  }
}

/** Bridges the `mcp` scope onto the MCP card's staged form. */
export class McpCardController {
  private readonly form: CardForm<McpSettings>
  private readonly store: SnapshotStore<McpCardState>
  private draft: McpDraft = { serverName: '', transport: 'stdio', command: '', argsText: '', url: '' }

  /** @param scope - the bound settings scope for the `mcp` namespace. */
  constructor(private readonly scope: SettingsScope<McpSettings>) {
    this.form = new CardForm(scope, [serversField()])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): McpCardState {
    const shell = this.form.shell()
    const serversFieldState = this.form.field('servers')
    let servers: readonly McpServerConfig[] = []
    if (!serversFieldState.invalid) {
      const text = serversFieldState.text.trim()
      if (text !== '') {
        try {
          const parsed = JSON.parse(text) as McpServerConfig[]
          if (Array.isArray(parsed)) servers = parsed
        } catch {
          servers = []
        }
      } else if (!serversFieldState.overridden && !shell.dirty) {
        // No staged override and no pending edit: show the effective value
        // so inherited servers remain visible before any edit. When a clear
        // is staged (dirty true, text ''), the empty list must win.
        const effective = this.scope.getSnapshot().value?.servers
        if (Array.isArray(effective)) servers = effective as readonly McpServerConfig[]
      }
    }
    const { invalid, error } = this.draftValidation(servers)
    return {
      ...shell,
      servers,
      serversField: serversFieldState,
      draft: { ...this.draft },
      draftInvalid: invalid,
      draftError: error,
    }
  }

  private draftValidation(servers: readonly McpServerConfig[]): { invalid: boolean; error: string | null } {
    const name = this.draft.serverName.trim()
    if (name === '') return { invalid: true, error: null }
    if (!SERVER_NAME_PATTERN.test(name)) return { invalid: true, error: 'badName' }
    if (servers.some(entry => entry.serverName === name)) return { invalid: true, error: 'duplicate' }
    if (this.draft.transport === 'stdio') {
      if (this.draft.command.trim() === '') return { invalid: true, error: 'missingCommand' }
    } else if (this.draft.transport === 'streamable-http') {
      if (this.draft.url.trim() === '') return { invalid: true, error: 'missingUrl' }
    }
    return { invalid: false, error: null }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): McpCardFace {
    const base = this.form.actions()
    return {
      hooks: { mcpCard: this.store },
      edit: base.edit,
      resetField: base.resetField,
      save: base.save,
      discard: () => {
        base.discard()
        this.store.set(this.projection())
      },
      editDraft: (field, text) => {
        this.draft = { ...this.draft, [field]: text }
        this.store.set(this.projection())
      },
      addServer: () => {
        const state = this.store.getSnapshot() as McpCardState
        const servers = state.servers
        const validation = this.draftValidation(servers)
        if (validation.invalid) {
          this.store.set(this.projection())
          return
        }
        let entry: McpServerConfig
        if (this.draft.transport === 'stdio') {
          entry = {
            serverName: this.draft.serverName.trim(),
            transport: 'stdio',
            command: this.draft.command.trim(),
            ...(this.draft.argsText.trim() === '' ? {} : { args: this.draft.argsText.trim().split(/\s+/).filter(Boolean) }),
          }
        } else {
          entry = {
            serverName: this.draft.serverName.trim(),
            transport: 'streamable-http',
            url: this.draft.url.trim(),
          }
        }
        const next = [...servers, entry]
        base.edit('servers', JSON.stringify(next, null, 2))
        this.draft = { serverName: '', transport: this.draft.transport, command: '', argsText: '', url: '' }
        this.store.set(this.projection())
      },
      removeServer: (serverName) => {
        const servers = (this.store.getSnapshot() as McpCardState).servers
        const next = servers.filter(entry => entry.serverName !== serverName)
        if (next.length === 0) base.edit('servers', '')
        else base.edit('servers', JSON.stringify(next, null, 2))
      },
    }
  }
}
