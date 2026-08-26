# Agent Note: studio 一键终止开关是对 `session.cancel` 的确认式扇出

Status: implemented

[English](2026-08-25-studio-command-kill-switch.md) | 中文

## Problem

失控的会话需要一键确认停止。手工逐个停止意味着分别访问每个活跃会话表面，而且部分停止看不出还有什么仍在运行。

## Decision

`packages/client/ui-kill-switch` 在 `ctx.commandUi` 上注册一个客户端命令贡献 `kill-switch`（popupSelect 类型）。它的唯一选项携带 `SelectOption.confirmation`；共享弹层 shell 的风险确认把执行挡在显式勾选之后，确认标签会标明活跃会话数。动作通过 `sessions.binding(id)` 把 `SessionFace.cancel()` 扇出到 live 列表快照里的每个 id，尽力而为——单个拒绝不会阻断其余——并通过发起会话的 composer 通知通道汇报 已接受/总数 的汇总。没有新会话事件、没有协议格式变化：取消复用运行时既有的 `session.cancel` / `subagent.interrupt` 路由。

## Alternatives considered

- **host 侧 `/kill` 命令**（`packages/interaction/command-kill` 草稿）：一条命令调用 `ctx.jobs.kill()`、`ctx.terminals.kill()` 和 `ctx.models.requestUnload()`。落败原因：jobs 属于 host 侧，terminals 没有客户端表面，model 卸载当时没有 provider seam，这些腿在浏览器里（开关真正所在处）都不可达，且该草稿从未完成其验证矩阵。

## Consequences

一次确认手势即可从任意 composer 停止所有活跃会话，汇总里能看到部分失败。jobs、terminals 与已加载模型要等各自的客户端 seam 落地后才会被停止；由于扇出是尽力而为，失败的取消表现为汇总数字减少，而不是阻断其余取消。
