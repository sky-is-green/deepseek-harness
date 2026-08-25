# @deepseek-ai/dsh-models

[English](README.md) | 中文

模型托管 seam（`ctx.models`）是 HiveBench Studio 的本地优先模型能力：一个抽象 `ModelsRuntime` 公开本机权重的目录快照（`listModels`）、支撑容量估算的主机硬件摘要（`hardware`）、逐模型的加载状态读取与迁移（`loadState` / `requestLoad` / `requestUnload`），以及带句柄与类型化进度事件的下载作业（`startDownload` / `downloads`）。运行时选择、启动参数、采样默认值与端点暴露留在 Service Provider 与消费方；seam 本身保持运行时无关。

## 约定

- **状态只在提交点发布。** 每次加载／卸载／下载迁移都在 Provider 接受迁移之后才发出事件，绝不提前。消费方用每条 `models/catalog-updated` 载荷整体替换目录视图，而不是自行 diff。
- **加载状态遵循受检语法**：`unloaded → loading → loaded → unloading → unloaded`，`failed` 可从 `loading`/`unloading` 到达，并可经重试或清除恢复。某个模型的第一个被观察状态可以是任意状态，因为 Provider 会收养在挂载前已加载的模型。不变式伴生插件跨所有 Provider 强制该语法与下载生命周期（`start → progress* → settle`，恰好一次）。
- **`requestLoad` 在终态结算**——模型报告 `loaded` 时 resolve；失败或中止时 reject，两种情况下状态事件都会发布。被中止的加载经 `unloading` 走到 `unloaded`。
- **下载基于句柄**：`startDownload` resolve 为一个活动句柄，携带终态 promise 与幂等的 `cancel()`；进度只通过 `models/download-progress` 到达；每个作业恰好结算一次，结果为 completed（附新目录条目）、cancelled 或 failed。
- **标识符有品牌**：`LocalModelId` 与 `DownloadId` 跨包边界不透明；Provider 经 `localModelId()` / `modelDownloadId()` 生成。
- 服务自身的 dispose 会卸载所有已加载模型、取消运行中的下载并等待结算。

## 模型体验

### 托管表面

#### 模型看到什么

什么都不直接看到：托管位于 Consumer 背后的基础设施。请求经由指向 Provider 运行时的 `ctx.llm` 适配器抵达托管权重，服务中一切面向模型的部分都由适配器负责。

#### Token 影响

无直接影响；seam 不贡献任何提示内容，也不注册任何工具 schema。

#### KV Cache 影响

无；请求前缀组合仍归提示组装器和为已加载模型提供服务的适配器所有。

## 已知限制与暂缓事项

- **尚无原生 provider**——本 seam 先交付契约、其不变式伴生插件与 stub 驱动的测试；llama.cpp 生命周期 provider（经 `ctx.subprocess` 的 spawn/health/adopt/stop）与 Hugging Face 下载管理器作为独立 provider 包随后落地。
- **采样与 profile 词汇不入 seam**——已保存的采样参数、系统提示词与逐模型默认值是叠在本 seam 之上的 profile 层关注点，不是加载请求上的字段。
