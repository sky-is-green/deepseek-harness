/**
 * Plugin browser — discover/installable view over bundle closure.
 * Pure helpers, no cordis.
 * @module @deepseek-ai/dsh-client-ui-plugin-browser/client/browser
 */

export interface PluginEntry {
  id: string
  name?: string
  description?: string
  installed: boolean
}

export interface BrowserState {
  filter: string
  plugins: PluginEntry[]
}

/**
 * Filter installable plugins.
 * @param plugins - all plugins.
 * @param filter - search text.
 * @param onlyInstallable - if true, hide installed.
 * @returns filtered list.
 */
export function filterPlugins(
  plugins: PluginEntry[],
  filter: string,
  onlyInstallable = false,
): PluginEntry[] {
  let list = plugins
  if (onlyInstallable) list = list.filter(p => !p.installed)
  if (filter.trim().length === 0) return list
  const q = filter.toLowerCase()
  return list.filter(p => p.id.toLowerCase().includes(q) || (p.name?.toLowerCase().includes(q) ?? false))
}

/**
 * Group plugins into installed vs installable.
 * @param plugins - all plugins.
 * @returns grouped.
 */
export function groupPlugins(plugins: PluginEntry[]): { installed: PluginEntry[]; installable: PluginEntry[] } {
  return {
    installed: plugins.filter(p => p.installed),
    installable: plugins.filter(p => !p.installed),
  }
}

/**
 * Build PluginEntry list from a bundle closure.
 * @param closure - bundle closure with pluginIds.
 * @param installedIds - set of installed plugin ids.
 * @returns entries.
 */
export function closureToEntries(
  closure: { pluginIds: string[] },
  installedIds: Set<string>,
): PluginEntry[] {
  return closure.pluginIds.map(id => ({
    id,
    installed: installedIds.has(id),
  }))
}
