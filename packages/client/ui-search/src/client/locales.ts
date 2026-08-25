/**
 * `search` namespace dictionaries: the global search dialog's copy.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'search.title': '搜索会话',
  'search.placeholder': '搜索所有会话…',
  'search.pending': '搜索中…',
  'search.empty': '没有匹配的会话',
  'search.error': '搜索失败：{message}',
  'search.notLoaded': '未在列表中',
  'search.hasMore': '结果超过上限，请细化关键词',
} satisfies Record<string, string>

/** The search namespace key union. */
export type SearchKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'search.title': 'Search sessions',
  'search.placeholder': 'Search all sessions…',
  'search.pending': 'Searching…',
  'search.empty': 'No matching sessions',
  'search.error': 'Search failed: {message}',
  'search.notLoaded': 'not in list',
  'search.hasMore': 'More than the result limit matched; refine the query',
} satisfies Record<SearchKey, string>
