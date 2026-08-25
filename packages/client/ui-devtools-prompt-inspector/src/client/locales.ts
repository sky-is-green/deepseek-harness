/** `prompt-inspector` namespace dictionaries (view tab label + inspector strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'prompt-inspector'

/** The prompt-inspector dictionary key set (the source of truth for both locales). */
export type PromptInspectorKey =
  | 'tab'
  | 'tokens.title'
  | 'tokens.empty'
  | 'tokens.system'
  | 'tokens.tools'
  | 'tokens.messages'
  | 'tokens.usage.title'
  | 'tokens.usage.input'
  | 'tokens.usage.output'
  | 'tokens.usage.cacheRead'
  | 'tokens.usage.cacheWrite'
  | 'requests.title'
  | 'requests.empty'
  | 'requests.step'
  | 'requests.badge.initial'
  | 'requests.badge.system'
  | 'requests.badge.tools'
  | 'requests.systemHeading'
  | 'requests.toolsHeading'
  | 'requests.toolsEmpty'
  | 'contexts.title'
  | 'contexts.empty'
  | 'contexts.role.inject'
  | 'contexts.role.recall'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The prompt-inspector view tab label and inspector strings. */
    'prompt-inspector': PromptInspectorKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PromptInspectorKey, string> = {
  'tab': 'Prompt 检查器',
  'tokens.title': '上下文组成',
  'tokens.empty': '暂无上下文组成数据。',
  'tokens.system': '系统提示',
  'tokens.tools': '工具',
  'tokens.messages': '对话',
  'tokens.usage.title': '累计用量',
  'tokens.usage.input': '输入',
  'tokens.usage.output': '输出',
  'tokens.usage.cacheRead': '缓存读',
  'tokens.usage.cacheWrite': '缓存写',
  'requests.title': '请求头',
  'requests.empty': '尚无记录的请求头。',
  'requests.step': 'Turn {turn} · Step {step}',
  'requests.badge.initial': '首个',
  'requests.badge.system': '系统已变更',
  'requests.badge.tools': '工具已变更',
  'requests.systemHeading': '系统提示',
  'requests.toolsHeading': '工具 Schema（{count}）',
  'requests.toolsEmpty': '此请求未携带工具。',
  'contexts.title': '注入的上下文',
  'contexts.empty': '此会话尚无生产者注入的上下文。',
  'contexts.role.inject': '注入',
  'contexts.role.recall': '跨会话召回',
}

/** English dictionary. */
export const en: Record<PromptInspectorKey, string> = {
  'tab': 'Prompt Inspector',
  'tokens.title': 'Context composition',
  'tokens.empty': 'No context composition reported yet.',
  'tokens.system': 'System',
  'tokens.tools': 'Tools',
  'tokens.messages': 'Messages',
  'tokens.usage.title': 'Cumulative usage',
  'tokens.usage.input': 'Input',
  'tokens.usage.output': 'Output',
  'tokens.usage.cacheRead': 'Cache read',
  'tokens.usage.cacheWrite': 'Cache write',
  'requests.title': 'Request headers',
  'requests.empty': 'No logged request headers yet.',
  'requests.step': 'Turn {turn} · Step {step}',
  'requests.badge.initial': 'Initial',
  'requests.badge.system': 'System changed',
  'requests.badge.tools': 'Tools changed',
  'requests.systemHeading': 'System prompt',
  'requests.toolsHeading': 'Tool schemas ({count})',
  'requests.toolsEmpty': 'This request carried no tools.',
  'contexts.title': 'Injected context',
  'contexts.empty': 'No producer-injected context in this session yet.',
  'contexts.role.inject': 'Inject',
  'contexts.role.recall': 'Recall',
}
