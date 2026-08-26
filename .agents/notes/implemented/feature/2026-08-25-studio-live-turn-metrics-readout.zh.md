# Agent Note: 实时 tok/s 读数走 projection，而不是客户端事件 fold

Status: implemented

[English](2026-08-25-studio-live-turn-metrics-readout.md) | 中文

## Problem

客户端已结算的指标 fold（ui-conversation 里的 `deriveTurnMetrics`）只有在 `assistant/message` 之后才看得到 `timing`/`usage`；token 流式传输期间，客户端快照上没有任何东西携带 step 边界或首 token 时间，所以 composer 旁的实时读数若不发明新数据源就没有客户端数据可用。

## Decision

实时 tok/s + TTFT 读数（`packages/client/ui-live-metrics`)的数字来自一个新的 host 侧 projection 单元 `liveTurnMetrics`（`packages/session/live-turn-metrics`)，注册在 `ctx.sessionProjections` 上，而不是在浏览器里 fold 会话事件。host 计算的 projection（`useProjection` seat，经 `session/projection` 帧逐事件推送）是 composer 侧 UI 仅有的两条 sanctioned 实时通道之一；这条路复用 StatsLine 与 ContextMeter 已经消费的那个 seam，零共享包改动，并让 fold 由 registry 保持可重放、可缓存，而不是每个客户端各写一份。

## Alternatives considered

- 在浏览器里把会话事件 fold 进客户端 store — 否决：流式期间的客户端快照不携带 step 边界或首 token 时间，这个 fold 需要新的共享包表面。
- 把数字附加为 Conversation Node 的 location 数据 — 否决：location 数据按 turn/step 划界，在消息渲染器之外没有消费者 seat，而 composer 停靠读数不是消息渲染器。

## Consequences

- 流式吞吐是估计值（首 token → 最新 delta 时间内每个非空 token delta 计一个单位）；provider 精确数字在 `assistant/message` 处替换它。将来中途的 `usage` 样本可以细化它而不触碰消费者。
- 视图只跟踪一个 step（正在流式或最后结算）；历史留给已结算的 footer/StatsLine folds。
- 未装配该单元的组合体只是不提供这个键；读数什么都不渲染。
