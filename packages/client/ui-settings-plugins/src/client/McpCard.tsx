/** The MCP plugin's card: add/remove servers whose restart picks them up. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from './PluginCard.tsx'
import type { McpCardFace } from './mcp-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './McpCard.module.css'

/** Props the renderer binds for the MCP card. */
export type McpCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<McpCardFace>

/**
 * Render the MCP card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function McpCard(props: McpCardProps) {
  const { t } = props
  const state = props.useMcpCard(snapshot => snapshot)
  const disabled = !state.writable

  const detailFor = (server: { transport: string; command?: string; url?: string; args?: string[] }): string => {
    if (server.transport === 'stdio') return [server.command, ...(server.args ?? [])].join(' ').trim()
    return server.url ?? ''
  }

  const draftErrorLabel = (code: string | null): string | null => {
    if (code === 'badName') return t('mcpBadName')
    if (code === 'duplicate') return t('mcpDuplicate')
    if (code === 'missingCommand') return t('mcpMissingCommand')
    if (code === 'missingUrl') return t('mcpMissingUrl')
    return null
  }

  return (
    <PluginCard
      t={t}
      titleKey="mcpTitle"
      descriptionKey="mcpDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      {state.serversField.invalid ? <p className={css.invalid} role="status">{t('mcpInvalid')}</p> : null}
      {state.servers.length === 0
        ? <p className={css.empty}>{t('mcpEmpty')}</p>
        : (
          <ul className={css.list}>
            {state.servers.map(server => (
              <li key={server.serverName} className={css.row}>
                <span className={css.name}>{server.serverName}</span>
                <span className={css.transport}>{server.transport}</span>
                <span className={css.detail} title={detailFor(server)}>{detailFor(server)}</span>
                <button
                  type="button"
                  className={css.remove}
                  disabled={disabled}
                  onClick={() => { props.removeServer(server.serverName) }}
                  aria-label={`${t('mcpRemove')}: ${server.serverName}`}
                >
                  {t('mcpRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      <div className={css.addSection}>
        <p className={css.addTitle}>{t('mcpAddTitle')}</p>
        <div className={css.formRow}>
          <label className={css.label} htmlFor="plugin-config-mcp-serverName">{t('mcpServerName')}</label>
          <input
            id="plugin-config-mcp-serverName"
            className={css.input}
            type="text"
            value={state.draft.serverName}
            placeholder={t('mcpServerNamePlaceholder')}
            disabled={disabled}
            onChange={(event) => { props.editDraft('serverName', event.target.value) }}
          />
        </div>
        <div className={css.formRow}>
          <label className={css.label} htmlFor="plugin-config-mcp-transport">{t('mcpTransport')}</label>
          <select
            id="plugin-config-mcp-transport"
            className={css.select}
            value={state.draft.transport}
            disabled={disabled}
            onChange={(event) => { props.editDraft('transport', event.target.value) }}
          >
            <option value="stdio">{t('mcpTransportStdio')}</option>
            <option value="streamable-http">{t('mcpTransportHttp')}</option>
          </select>
        </div>
        {state.draft.transport === 'stdio'
          ? (
            <>
              <div className={css.formRow}>
                <label className={css.label} htmlFor="plugin-config-mcp-command">{t('mcpCommand')}</label>
                <input
                  id="plugin-config-mcp-command"
                  className={css.input}
                  type="text"
                  value={state.draft.command}
                  placeholder={t('mcpCommandPlaceholder')}
                  disabled={disabled}
                  onChange={(event) => { props.editDraft('command', event.target.value) }}
                />
              </div>
              <div className={css.formRow}>
                <label className={css.label} htmlFor="plugin-config-mcp-args">{t('mcpArgs')}</label>
                <input
                  id="plugin-config-mcp-args"
                  className={css.input}
                  type="text"
                  value={state.draft.argsText}
                  placeholder={t('mcpArgsPlaceholder')}
                  disabled={disabled}
                  onChange={(event) => { props.editDraft('argsText', event.target.value) }}
                />
                <p className={css.hint}>{t('mcpArgsHint')}</p>
              </div>
            </>
          )
          : (
            <div className={css.formRow}>
              <label className={css.label} htmlFor="plugin-config-mcp-url">{t('mcpUrl')}</label>
              <input
                id="plugin-config-mcp-url"
                className={css.input}
                type="text"
                value={state.draft.url}
                placeholder={t('mcpUrlPlaceholder')}
                disabled={disabled}
                onChange={(event) => { props.editDraft('url', event.target.value) }}
              />
            </div>
          )}
        {state.draftError !== null ? <p className={css.invalid} role="status">{draftErrorLabel(state.draftError)}</p> : null}
        <button
          type="button"
          className={css.addButton}
          disabled={disabled || state.draftInvalid}
          onClick={() => { props.addServer() }}
        >
          {t('mcpAdd')}
        </button>
        <p className={css.restartHint}>{t('mcpRestartHint')}</p>
      </div>
    </PluginCard>
  )
}
