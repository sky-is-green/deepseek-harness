/** MCP card: staged add/remove over the `mcp` namespace. */

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { McpCard } from '../src/client/McpCard.tsx'
import type { McpCardProps } from '../src/client/McpCard.tsx'
import { McpCardController, type McpSettings } from '../src/client/mcp-card-controller.ts'
import type { CardShell } from '../src/client/card-form.ts'
import type { McpCardState, McpDraft, McpServerConfig } from '../src/client/mcp-card-controller.ts'
import { en } from '../src/client/locales.ts'

function acceptMcpWrites(host: ReturnType<typeof stubSettingsScope<McpSettings>>) {
  host.set.mockImplementation((field: string, value: unknown) => {
    const current = host.scope.getSnapshot().value as McpSettings | undefined
    const user = host.scope.getSnapshot().user as Record<string, unknown> | undefined
    const nextValue = { ...(current ?? {}), [field]: value } as McpSettings
    const nextUser = { ...(user ?? {}), [field]: value }
    host.publish({ value: nextValue, user: nextUser })
    return Promise.resolve()
  })
  host.unset.mockImplementation((field: string) => {
    const current = host.scope.getSnapshot().value as McpSettings | undefined
    const user = host.scope.getSnapshot().user as Record<string, unknown> | undefined
    const { [field]: _removed, ...kept } = (user ?? {}) as Record<string, unknown>
    const nextUser = kept as Record<string, unknown>
    const base = host.scope.getSnapshot().base as unknown as Record<string, unknown> | undefined
    const nextValue = { ...(current ?? {}), [field]: base?.[field] } as McpSettings
    if (nextValue.servers === undefined) delete (nextValue as unknown as Record<string, unknown>).servers
    host.publish({ value: nextValue, user: nextUser })
    return Promise.resolve()
  })
}

describe('McpCardController', () => {
  it('stays unavailable while the namespace is not served', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'unavailable' })
    expect(controller.inject().hooks.mcpCard.getSnapshot()).toMatchObject({ available: false, writable: false })
  })

  it('shows no servers when none are configured', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    expect(controller.inject().hooks.mcpCard.getSnapshot()).toMatchObject({ available: true, servers: [], draftInvalid: true })
  })

  it('projects servers from the settings value', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      value: { servers: [{ serverName: 'a', transport: 'stdio', command: 'npx' }] },
      base: {},
      user: { servers: [{ serverName: 'a', transport: 'stdio', command: 'npx' }] },
    })
    const snapshot = controller.inject().hooks.mcpCard.getSnapshot()
    expect(snapshot.servers).toEqual([{ serverName: 'a', transport: 'stdio', command: 'npx' }])
    expect(snapshot.serversField.overridden).toBe(true)
  })

  it('stages an added stdio server and clears the draft', async () => {
    const host = stubSettingsScope<McpSettings>()
    acceptMcpWrites(host)
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 'my-server')
    face.editDraft('transport', 'stdio')
    face.editDraft('command', 'npx')
    face.editDraft('argsText', '-y @modelcontextprotocol/server-filesystem /tmp')
    expect(face.hooks.mcpCard.getSnapshot().draftInvalid).toBe(false)

    face.addServer()
    const afterAdd = face.hooks.mcpCard.getSnapshot()
    expect(afterAdd.servers).toEqual([{
      serverName: 'my-server',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    }])
    expect(afterAdd.draft.serverName).toBe('')
    expect(afterAdd.serversField.text).toContain('my-server')
    expect(afterAdd.dirty).toBe(true)

    face.save()
    await vi.waitFor(() => { expect(host.set).toHaveBeenCalled() })
    expect(host.set).toHaveBeenCalledWith('servers', expect.arrayContaining([expect.objectContaining({ serverName: 'my-server' })]))
  })

  it('stages an added http server', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 'web')
    face.editDraft('transport', 'streamable-http')
    face.editDraft('url', 'http://localhost:3000/mcp')
    face.addServer()

    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([
      { serverName: 'web', transport: 'streamable-http', url: 'http://localhost:3000/mcp' },
    ])
  })

  it('refuses to add a server with a bad name', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 'bad name!')
    face.editDraft('command', 'npx')
    face.addServer()

    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([])
    expect(face.hooks.mcpCard.getSnapshot().draftError).toBe('badName')
  })

  it('refuses to add a duplicate name', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      value: { servers: [{ serverName: 'dup', transport: 'stdio', command: 'npx' }] },
      base: {},
      user: { servers: [{ serverName: 'dup', transport: 'stdio', command: 'npx' }] },
    })
    const face = controller.inject()

    face.editDraft('serverName', 'dup')
    face.editDraft('command', 'node')
    expect(face.hooks.mcpCard.getSnapshot().draftError).toBe('duplicate')
    face.addServer()
    expect(face.hooks.mcpCard.getSnapshot().servers).toHaveLength(1)
  })

  it('refuses to add a stdio server without a command', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 's')
    // transport defaults to stdio, command empty
    expect(face.hooks.mcpCard.getSnapshot().draftError).toBe('missingCommand')
    face.addServer()
    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([])
  })

  it('refuses to add an http server without a url', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 's')
    face.editDraft('transport', 'streamable-http')
    expect(face.hooks.mcpCard.getSnapshot().draftError).toBe('missingUrl')
    face.addServer()
    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([])
  })

  it('stages removal and clears the field when the last server leaves', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      value: { servers: [{ serverName: 'a', transport: 'stdio', command: 'npx' }] },
      base: {},
      user: { servers: [{ serverName: 'a', transport: 'stdio', command: 'npx' }] },
    })
    const face = controller.inject()
    face.removeServer('a')
    const snapshot = face.hooks.mcpCard.getSnapshot()
    expect(snapshot.servers).toEqual([])
    expect(snapshot.serversField.text).toBe('')
    expect(snapshot.dirty).toBe(true)
  })

  it('stages removal when multiple servers remain', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      value: {
        servers: [
          { serverName: 'a', transport: 'stdio', command: 'npx' },
          { serverName: 'b', transport: 'streamable-http', url: 'http://example.test/mcp' },
        ],
      },
      base: {},
      user: {},
    })
    const face = controller.inject()
    face.removeServer('a')
    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([
      { serverName: 'b', transport: 'streamable-http', url: 'http://example.test/mcp' },
    ])
  })

  it('discards staged servers and keeps the draft cleared on save', async () => {
    const host = stubSettingsScope<McpSettings>()
    acceptMcpWrites(host)
    const controller = new McpCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.editDraft('serverName', 's')
    face.editDraft('command', 'npx')
    face.addServer()
    expect(face.hooks.mcpCard.getSnapshot().dirty).toBe(true)

    face.discard()
    expect(face.hooks.mcpCard.getSnapshot().servers).toEqual([])
    expect(face.hooks.mcpCard.getSnapshot().dirty).toBe(false)

    // Add again and save
    face.editDraft('serverName', 's2')
    face.editDraft('command', 'node')
    face.addServer()
    face.save()
    await vi.waitFor(() => { expect(host.set).toHaveBeenCalled() })
    expect(face.hooks.mcpCard.getSnapshot().dirty).toBe(false)
  })

  it('reports an invalid stored server list', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    // Directly stage invalid JSON via the form's edit (duplicate names)
    host.publish({
      status: 'ready',
      writable: true,
      value: { servers: [{ serverName: 'a', transport: 'stdio', command: 'npx' }] as never },
      base: {},
      user: {},
    })
    const face = controller.inject()
    // Stage invalid by editing servers field to duplicate JSON
    face.edit('servers', JSON.stringify([
      { serverName: 'dup', transport: 'stdio', command: 'npx' },
      { serverName: 'dup', transport: 'stdio', command: 'node' },
    ], null, 2))
    const snapshot = face.hooks.mcpCard.getSnapshot()
    expect(snapshot.serversField.invalid).toBe(true)
    expect(snapshot.invalid).toBe(true)
  })

  it('shows effective servers when no staged override exists', () => {
    const host = stubSettingsScope<McpSettings>()
    const controller = new McpCardController(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      value: { servers: [{ serverName: 'inherited', transport: 'stdio', command: 'npx' }] },
      base: {},
      user: {},
    })
    expect(controller.inject().hooks.mcpCard.getSnapshot().servers).toEqual([
      { serverName: 'inherited', transport: 'stdio', command: 'npx' },
    ])
  })
})

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const settled: CardShell = {
  available: true,
  writable: true,
  dirty: false,
  invalid: false,
  saving: false,
  failed: false,
}

function renderMcp(state: Partial<McpCardState> = {}, actions: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const draft: McpDraft = { serverName: '', transport: 'stdio', command: '', argsText: '', url: '' }
  const servers: readonly McpServerConfig[] = []
  const store = createSnapshotStore<McpCardState>({
    ...settled,
    servers,
    serversField: { text: '', overridden: false, invalid: false },
    draft,
    draftInvalid: true,
    draftError: null,
    ...state,
  })
  const base = {
    edit: vi.fn(),
    resetField: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    editDraft: vi.fn(),
    addServer: vi.fn(),
    removeServer: vi.fn(),
    ...actions,
  }
  const props = { t, useMcpCard: bindSnapshotSelector(store), ...base } as unknown as McpCardProps
  render(<McpCard {...props} />)
  // Expand the card: PluginCard is collapsed by default. When unavailable it renders nothing.
  const header = screen.queryByRole('button', { name: new RegExp(en.mcpTitle) })
  if (header !== null) fireEvent.click(header)
  return { ...base, store }
}

describe('McpCard', () => {
  it('renders nothing while its namespace is unavailable', () => {
    renderMcp({ available: false } as Partial<McpCardState>)
    expect(screen.queryByText(en.mcpTitle)).toBeNull()
  })

  it('shows the empty state when no servers are configured', () => {
    renderMcp()
    expect(screen.getByText(en.mcpEmpty)).toBeTruthy()
  })

  it('lists servers and offers removal', () => {
    const removeServer = vi.fn()
    renderMcp({
      servers: [{ serverName: 'a', transport: 'stdio', command: 'npx', args: ['-y', 'pkg'] }],
      serversField: { text: JSON.stringify([{ serverName: 'a', transport: 'stdio', command: 'npx' }]), overridden: true, invalid: false },
    }, { removeServer })
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getAllByText('stdio').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: `${en.mcpRemove}: a` }))
    expect(removeServer).toHaveBeenCalledWith('a')
  })

  it('stages draft edits and adds a server', () => {
    const editDraft = vi.fn()
    const addServer = vi.fn()
    renderMcp({ draftInvalid: false }, { editDraft, addServer })
    fireEvent.change(screen.getByLabelText(en.mcpServerName), { target: { value: 'my-srv' } })
    expect(editDraft).toHaveBeenCalledWith('serverName', 'my-srv')
    fireEvent.click(screen.getByRole('button', { name: en.mcpAdd }))
    expect(addServer).toHaveBeenCalledOnce()
  })

  it('disables the add button while the draft is invalid and shows the error', () => {
    renderMcp({ draftInvalid: true, draftError: 'badName' })
    expect(screen.getByRole('button', { name: en.mcpAdd })).toHaveProperty('disabled', true)
    expect(screen.getByText(en.mcpBadName)).toBeTruthy()
  })

  it('shows the invalid banner when the stored list is invalid', () => {
    renderMcp({ serversField: { text: 'bad', overridden: false, invalid: true }, invalid: true } as Partial<McpCardState>)
    expect(screen.getByText(en.mcpInvalid)).toBeTruthy()
  })

  it('disables inputs when the document is read-only', () => {
    renderMcp({ writable: false } as Partial<McpCardState>)
    expect(screen.getByLabelText(en.mcpServerName)).toHaveProperty('disabled', true)
  })
})
