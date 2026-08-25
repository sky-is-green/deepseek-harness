/**
 * `command-palette` namespace dictionaries: the global palette's copy.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'palette.title': '命令面板',
  'palette.placeholder': '搜索命令…',
  'palette.empty': '没有匹配的命令',
  'palette.loadError': '命令列表加载失败：{message}',
  'palette.optionLoadError': '选项加载失败：{message}',
  'palette.executeError': '执行失败：{message}',
  'palette.hint': '回车执行 · Esc 关闭',
} satisfies Record<string, string>

/** The command-palette namespace key union. */
export type CommandPaletteKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'palette.title': 'Command palette',
  'palette.placeholder': 'Search commands…',
  'palette.empty': 'No matching commands',
  'palette.loadError': 'Command list failed to load: {message}',
  'palette.optionLoadError': 'Options failed to load: {message}',
  'palette.executeError': 'Execution failed: {message}',
  'palette.hint': 'Enter to run · Esc to close',
} satisfies Record<CommandPaletteKey, string>
