# Agent Note: MCP 服务管理卡片

Status: implemented

[English](2026-08-27-studio-mcp-server-card.md) | 中文

## Problem

Host `mcp-client` 为配置驱动、列表值，每台服务器在 `cordis.yml` 中单独加载一次且需要重启 Host。用户在产品内没有可视化的 MCP 服务清单，也无法在不手工编辑文件的情况下增删服务。早期方案曾提出独立设置页叠加 Host 探活 `mcp/testConnectivity`，整体为 E 级工作量。

## Decision

在现有 `ui-settings-plugins` 卡片框架内新增单一 `mcp` 命名空间卡片（`packages/client/ui-settings-plugins`）：

- **单一暂存字段 `servers: McpServerConfig[]`，以 JSON 序列化。** 由 `CardForm` 负责带修订号的写入（`scope.set('servers', next)` / 为空时 `unset`），并发编辑以 `saveFailed` 形式暴露，无需新增 wire RPC。校验涵盖 JSON 结构、`serverName` 正则（`^[A-Za-z0-9_-]{1,32}$`）、按传输类型必需的 `command`/`url` 及重名，均在保存前拦截。
- **控制器在本地暂存增删。** `McpCardController` 为新增表单维护 draft（`serverName`、`transport`、`command`、`argsText`、`url`），对照当前已暂存列表校验，通过编辑单一 JSON 字段完成添加与删除。Draft 变更通过同一 `SnapshotStore` 发布，与渲染器读取保持同步，无需第二条订阅。
- **UI 为普通 `settings.plugin.item` 卡片（`McpCard`）。** 展示有效或已暂存的列表并附重启提示，每行可移除；新增表单在 `stdio`（`command` + 以空格分隔的 `args`）与 `streamable-http`（`url`）间切换。当 `mcp` 命名空间未服务时卡片不渲染（`available === false`），与其他插件卡片一致。

本次仅涉及客户端；在线探活留给 `X19`。

## Alternatives considered

- **独立 MCP 设置页。** 可展示更丰富的健康状态与在线探活，但需要新增设置分区、Host 探活 RPC 与第二条写入路径。拒绝：令 `S12` 保持在卡片框架内，探活延至 `X19`。
- **每个服务一个字段（如 `server.<name>`）。** 能实现按字段的 dirty 跟踪，但把有序列表打散为稀疏键值映射，且改名时需处理键迁移。拒绝：单一数组字段保持顺序与原子写入的简洁性。
- **无暂存直接落盘。** 每敲一字符即写入会产生大量持久化写入并丢失“保存前预览”的契约。拒绝：复用 `CardForm` 的暂存机制。

## Consequences

- 用户可在 设置 > 插件 中管理 MCP 服务，编辑会经过校验与带修订号的写入，重启 Host 后生效（卡片内有提示）。当 Host 侧将 `mcp.servers` 接入 `mcp-client` 后无需客户端额外改动。
- 新增传输类型只需扩展 `McpServerConfig` 联合类型、draft 表单与 JSON 校验，保存路径不变。
- 遗留：在线探活与按服务启用/停用仍由 `X19` 完成。
