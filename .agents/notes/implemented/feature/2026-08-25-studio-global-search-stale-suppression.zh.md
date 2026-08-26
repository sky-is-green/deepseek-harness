# Agent Note: 全局搜索拥有过期抑制，因为契约如此规定

Status: implemented

[English](2026-08-25-studio-global-search-stale-suppression.md) | 中文

## Problem

session-search 契约刻意把 wire 表面定得很窄（单页、无 cursor、`hasMore` 表示"请细化"），并把过期抑制记载为每个 UI 所有者的义务。全局搜索表面因此需要自己的防抖、中止与抑制方案，还需要标题来源——wire 不携带标题。

## Decision

全局搜索对话框（`packages/client/ui-search`)原样消费既有的单发 `sessions.search` RPC——防抖、按请求的 AbortSignal、以及对已中止响应的抑制完全住在对话框里——并把命中标题对齐到 live 列表快照，而不是信任 wire 携带标题。侧栏浏览器已经在本地实现了相同的 seam 模式，全局表面复用它而不是另起炉灶：标题来自列表快照，因为"列表快照仍是元数据权威"；导航走 `sessions.open`,其列表校验顺带回答了未列出命中的问题。

## Alternatives considered

- 扩展 `sessions.search` 让它返回联接标题和 cursor 分页 — 否决：契约的窄表面是刻意的，分页是 seam 变更而非 UI 变更。
- 只信响应载荷并逐字渲染命中 — 否决：快速输入后的过期响应会打开错误或已删除的会话；按契约,抑制正是这个所有者的义务。

## Consequences

- 未列出的命中呈现为惰性而不打开；先加载再打开的流程需要新的列表刷新 seam，已延后。
- 20 条结果的 wire 上限呈现为"请细化查询"；cursor 分页是 seam 变更，不是 UI 变更。
