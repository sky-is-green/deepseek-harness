# Agent Note: 模型托管 seam（`ctx.models`）负责目录、加载语法与下载生命周期

Status: implemented

[English](2026-08-25-engine-models-hosting-seam.md) | 中文

## Problem

HiveBench Studio 需要本地优先的模型托管，但 harness 中没有任何相关词汇：既没有本机权重的目录，也无法观察加载／卸载迁移，更没有下载原语。Lane B 的模型管理卡片需要立刻可用的类型来编码，而未来的 provider（llama.cpp 生命周期、Hugging Face 下载）与消费方（容量估算器、入站 OpenAI 兼容端点）都需要同一个 seam 来实现或读取。若现在不定下刻意的契约，每个表面都会发明自己的模型词汇。

## Decision

`@deepseek-ai/dsh-models`（packages/models/models）交付 Service Definition：抽象 `ModelsRuntime` 注册为 `ctx.models`，带五个类型化事件（`models/catalog-updated`、`models/load-state`、`models/download-started`、`models/download-progress`、`models/download-settled`）与品牌化标识符（`LocalModelId`、`DownloadId`）。Provider 子类化并实现；本地 llama.cpp provider 与下载管理器作为独立的 Wave 2 包落在同一 seam 之后。

契约要点：

- 状态只在提交点发布；`models/catalog-updated` 携带完整的新快照，消费方整体替换而非自行 diff。
- 加载状态遵循受检语法（`unloaded → loading → loaded → unloading → unloaded`，`failed` 可从 loading/unloading 到达并可经重试恢复）；某个模型的第一个被观察状态可以是任意状态，因为 Provider 会收养挂载前已加载的模型。
- `requestLoad` 在终态结算（`loaded` 时 resolve，失败／中止时 reject），中间状态经事件流出；下载基于句柄且恰好结算一次。
- 本包的不变式伴生插件经全局观察事件流，跨所有 Provider 强制迁移语法与下载生命周期。

采样参数、系统提示词与逐模型默认值被刻意排除：它们是叠在 seam 之上的 profile 层关注点（Wave 2 E9），不是加载请求上的字段。

## Alternatives considered

- **把托管并入 `ctx.llm` 适配器** — 否决：`ctx.llm` 是流式请求 seam，仍是聊天服务的提供方正统；托管是拥有自身生命周期的长驻资源域，耦合两者会迫使每个适配器实现目录／下载机制。
- **仅轮询 API（无事件）** — 否决：UI 卡片需要实时进度与状态变化；轮询会把 Provider 推向临时拼凑的回调注册表，等于在没有类型化声明合并契约的情况下重造事件。
- **仅回调／句柄进度（无广播）** — 否决：从第一天起就有多个消费方（卡片、容量估算器、devtools firehose），句柄级订阅会迫使每个 Provider 自建扇出层。
- **`requestLoad` 返回富对象** — 否决，改为 promise 加事件：返回对象会诱使消费方持有过时的状态快照，而不是经 `loadState`／事件读取已提交状态（「提交点发布」）。

## Consequences

Lane B 可以立刻针对这些类型以 mock 服务构建 S1（模型管理卡片）。Provider 欠下所记录的语义——包括 dispose 时卸载全部并取消下载——而挂载了不变式伴生插件的组装会在运行时拒绝语法违规。线路级服务表面（E5）与嵌入（E6）刻意留在 seam 之外；它们消费已加载模型，而非定义托管。

已知缺口记录在 MULTI_AGENT_PLAN 看板：尚无原生 provider，在 E3/E4 落地前该 seam 由 stub 驱动的测试证明。
