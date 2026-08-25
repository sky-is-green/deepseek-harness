/**
 * `models.manager` namespace dictionaries: the local-models settings
 * section's copy.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'manager.nav': '本地模型',
  'manager.title': '本地模型',
  'manager.pending': '目录加载中…',
  'manager.empty': '没有本地模型。从下方下载一个 GGUF 模型开始。',
  'manager.downloads': '进行中的下载',
  'manager.download': '下载',
  'manager.cancel': '取消',
  'manager.load': '加载',
  'manager.unload': '卸载',
  'manager.loading': '加载中…',
  'manager.unloading': '卸载中…',
  'manager.loaded': '已加载',
  'manager.failed': '失败',
  'manager.form.repo': 'Hugging Face 仓库（如 Qwen/Qwen3-0.6B-GGUF）',
  'manager.form.file': '模型文件（如 Qwen3-0.6B-Q4_K_M.gguf）',
  'manager.form.name': '显示名称',
  'manager.form.kind': '类型',
  'manager.kind.llm': '对话模型',
  'manager.kind.embedding': '向量模型',
  'manager.error': '操作失败：{message}',
} satisfies Record<string, string>

/** The models-manager namespace key union. */
export type ModelsManagerKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'manager.nav': 'Local models',
  'manager.title': 'Local models',
  'manager.pending': 'Loading catalog…',
  'manager.empty': 'No local models yet. Download a GGUF model below to start.',
  'manager.downloads': 'Active downloads',
  'manager.download': 'Download',
  'manager.cancel': 'Cancel',
  'manager.load': 'Load',
  'manager.unload': 'Unload',
  'manager.loading': 'Loading…',
  'manager.unloading': 'Unloading…',
  'manager.loaded': 'Loaded',
  'manager.failed': 'Failed',
  'manager.form.repo': 'Hugging Face repo (e.g. Qwen/Qwen3-0.6B-GGUF)',
  'manager.form.file': 'Model file (e.g. Qwen3-0.6B-Q4_K_M.gguf)',
  'manager.form.name': 'Display name',
  'manager.form.kind': 'Kind',
  'manager.kind.llm': 'Chat model',
  'manager.kind.embedding': 'Embedding model',
  'manager.error': 'Operation failed: {message}',
} satisfies Record<ModelsManagerKey, string>
