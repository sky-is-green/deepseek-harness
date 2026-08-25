/** `failure-forensics` namespace dictionaries (turn-tail failure detail copy). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'failure-forensics'

/** The failure-forensics dictionary key set (the source of truth for both locales). */
export type FailureForensicsKey =
  | 'detail.title'
  | 'detail.kind.model-error'
  | 'detail.kind.model-retry'
  | 'detail.kind.tool-timeout'
  | 'detail.kind.tool-error'
  | 'detail.kind.command-killed'
  | 'detail.kind.compaction'
  | 'detail.code'
  | 'detail.requestId'
  | 'detail.exit'
  | 'detail.fix'
  | 'detail.fix.timeout'
  | 'detail.fix.credentials'
  | 'detail.fix.rate-limit'
  | 'detail.fix.binary-missing'
  | 'detail.fix.signal'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The turn-tail failure detail copy. */
    'failure-forensics': FailureForensicsKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<FailureForensicsKey, string> = {
  'detail.title': '失败详情',
  'detail.kind.model-error': '模型错误',
  'detail.kind.model-retry': '模型重试',
  'detail.kind.tool-timeout': '工具超时',
  'detail.kind.tool-error': '工具错误',
  'detail.kind.command-killed': '命令被终止',
  'detail.kind.compaction': '压缩失败',
  'detail.code': '代码',
  'detail.requestId': '请求 ID',
  'detail.exit': '信号',
  'detail.fix': '建议',
  'detail.fix.timeout': '超时：调大对应工具的 timeoutMs，或缩小任务范围',
  'detail.fix.credentials': '凭据失效：检查对应的 API 密钥 / 登录状态',
  'detail.fix.rate-limit': '限流：降低并发或稍后重试',
  'detail.fix.binary-missing': '可执行文件缺失：安装依赖或修正 PATH',
  'detail.fix.signal': '进程被信号终止：检查内存限制或外部 kill',
}

/** English dictionary. */
export const en: Record<FailureForensicsKey, string> = {
  'detail.title': 'Failure detail',
  'detail.kind.model-error': 'Model error',
  'detail.kind.model-retry': 'Model retry',
  'detail.kind.tool-timeout': 'Tool timeout',
  'detail.kind.tool-error': 'Tool error',
  'detail.kind.command-killed': 'Command killed',
  'detail.kind.compaction': 'Compaction failed',
  'detail.code': 'Code',
  'detail.requestId': 'Request ID',
  'detail.exit': 'Signal',
  'detail.fix': 'Fix',
  'detail.fix.timeout': 'Timeout: raise the tool timeoutMs or narrow the task.',
  'detail.fix.credentials': 'Credentials rejected: check the API key / login state.',
  'detail.fix.rate-limit': 'Rate limited: reduce concurrency or retry later.',
  'detail.fix.binary-missing': 'Binary missing: install the dependency or fix PATH.',
  'detail.fix.signal': 'Process killed by a signal: check memory limits or external kills.',
}
