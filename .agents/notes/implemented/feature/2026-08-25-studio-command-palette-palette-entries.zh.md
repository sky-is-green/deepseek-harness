# Agent Note: 命令面板走 `paletteEntries` fold，而不是第二个 registry

Status: implemented

[English](2026-08-25-studio-command-palette-palette-entries.md) | 中文

## Problem

命令契约没有公开的列举表面：候选合成（目录合并、可用性过滤、碰撞检测）是 slash 来源的私有逻辑，只建立在公开表面上的面板永远看不到客户端贡献；在面板里重建这套合成，等于复制响亮碰撞规则所守护的那份逻辑。

## Decision

全局 Ctrl/Cmd+K 面板（`packages/client/ui-command-palette`）通过既有 `CommandUiContract` 上一个新的只读方法 `paletteEntries(session, signal)` 列出命令：它把 host 目录、按可用性过滤的贡献、以及裸调用装饰 fold 成自包含的行（绑定 `options`/`onSelect` 的 `host` / `popup`）。面板执行 host 命令时通过 `command.execute` 提交 `/${name}`，popup 行则在自己的两段式 UI 里运行。在 `ui-commands` 里只 fold 一次，让 slash 菜单和面板共用一份名册，让装饰在两个表面都是裸调用替换，并把共享包改动限制为一个附加方法及其 fold。

## Alternatives considered

- 只用公开表面在面板内重建候选合成 — 否决：它复制响亮碰撞规则所守护的逻辑，而且没有新的契约方法仍然看不到客户端贡献。
- 给面板自己的 registry，两个表面各自注册 — 出于同样的漂移原因否决：两份名册招致共享 fold 要消除的那种分叉。

## Consequences

- 携带 `leadingInput` 的 host 行呈现为惰性（`argsRequired`）——参数认领仍归 composer 所有；从面板执行会绕过认领机制的准入路径。
- popup 选项暂时不经共享 shell 的 `confirmation` 门（目前没有已发布的贡献使用它）；等有贡献使用时再把风险门接进面板。
- 本地过滤是子串匹配而非 slash 菜单的模糊排序；名册变大时可换入。
