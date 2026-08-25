/** `agent-firehose` namespace dictionaries (view tab label + firehose strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'agent-firehose'

/** The agent-firehose dictionary key set (the source of truth for both locales). */
export type AgentFirehoseKey =
  | 'tab'
  | 'waterfall.title'
  | 'waterfall.empty'
  | 'waterfall.turn'
  | 'waterfall.running'
  | 'waterfall.failed'
  | 'events.title'
  | 'events.empty'
  | 'events.window'
  | 'events.col.seq'
  | 'events.col.type'
  | 'events.col.summary'
  | 'events.col.time'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The agent-firehose view tab label and firehose strings. */
    'agent-firehose': AgentFirehoseKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<AgentFirehoseKey, string> = {
  'tab': '事件流水',
  'waterfall.title': '每轮时间线',
  'waterfall.empty': '窗口内暂无完整的轮次。',
  'waterfall.turn': 'Turn {turn}',
  'waterfall.running': '进行中',
  'waterfall.failed': '失败',
  'events.title': '最近事件',
  'events.empty': '尚无事件。',
  'events.window': '显示最近 {count} 条',
  'events.col.seq': 'Seq',
  'events.col.type': '类型',
  'events.col.summary': '摘要',
  'events.col.time': '时间',
}

/** English dictionary. */
export const en: Record<AgentFirehoseKey, string> = {
  'tab': 'Event Firehose',
  'waterfall.title': 'Per-turn timeline',
  'waterfall.empty': 'No completed turns in the window yet.',
  'waterfall.turn': 'Turn {turn}',
  'waterfall.running': 'running',
  'waterfall.failed': 'failed',
  'events.title': 'Recent events',
  'events.empty': 'No events yet.',
  'events.window': 'Showing last {count} events',
  'events.col.seq': 'Seq',
  'events.col.type': 'Type',
  'events.col.summary': 'Summary',
  'events.col.time': 'Time',
}
