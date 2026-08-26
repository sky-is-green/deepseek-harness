# Agent Note: 模型管理器镜像事件流而不是轮询

Status: implemented

[English](2026-08-25-studio-models-manager-event-mirror.md) | 中文

## Problem

下载进度是 provider 拥有的逐 chunk 高频状态；轮询 `downloads()` 会滞后并放大 wire 噪声，而把动作拒绝当作错误处理又会复制 `load-state failed` 迁移已经发布的失败事实。UI 需要一条 sanctioned 通道来消费 registrant 私有的 observable，使自己保持为服务语法的纯投影。

## Decision

本地模型设置区维护一个包私有的快照 store，只由 `ctx.models` 事件流（`catalog-updated`、`load-state`、`download-started/progress/settled`）加一次初始拉取喂给,经 slot hooks compartment 以绑定的 selector hook 交给组件。加载/卸载/下载动作以 fire-and-forget 进入服务;失败只通过镜像的 `failed` 事件浮现,不通过动作拒绝。hooks compartment 是 registrant 私有 observable 的 sanctioned 通道,只镜像让 UI 与 dsh-models invariant companion 已在强制的语法保持一致。

## Alternatives considered

- 按间隔轮询 `downloads()`/`listModels()` — 否决：对逐 chunk 进度滞后,并且对事件流本已推送的状态放大 wire 噪声。
- 在事件之外再通过 promise 拒绝呈现动作失败 — 否决：它复制 `failed` 迁移已发布的失败事实,给同一结果制造两个事实来源。

## Consequences

- 在 Service Provider 挂载之前该设置区按设计缺席——`models` 的 inject 保持 pending,符合 seam provider（E4）未落地时的响亮缺席规则。
- 取消只对本客户端发起的下载有效：表面经 `startDownload` 句柄取消,所以插件保留按下载 id 索引的句柄映射；按 id 寻址的取消会是 seam 增加。
