# Agent Note: 模型卡片与下载的预加载容量预估

Status: implemented

[English](2026-08-28-studio-S2-fit-estimator.md) | 中文

## 问题

本地模型流程（S1 目录卡片 + Hugging Face 下载）只展示 `sizeBytes` 与架构信息，缺乏硬件上下文：用户可能先下载 16 GB 再通过 `requestLoad` 才在 `failed` 时得知机器只有 8 GB。预估需把 E2 的探针结果（`HardwareSummary`：带 `memoryBytes` 的设备 + `totalRamBytes`）与 E8 的 `sizeBytes`、E3 的 `bytesTotal` 结合，不在 provider 复制策略、避免轮询、也不加入依赖隐藏架构参数的 KV 缓存计算。

## 决策

- **纯预估器 `src/fit.ts`。** `estimateFit(sizeBytes, hardware)` 取设备中最大的 `memoryBytes`（Metal 统一内存、CUDA 显存等），无显存设备时回落到 `totalRamBytes`；硬件未知或不可用时返回 `null`。仅比较文件体积（`needs <= available`）—— KV 开销被省略，因为文件体积占主导且编目中缺少隐藏尺寸。标签复用卡片的一位小数 GB 格式化（`4.0 GB`）、`fits`/`tooLarge` 文案与供调用方绘制比例尺的 `ratio`。
- **读模型扩展。** `ModelsManagerState.hardware: HardwareSummary | null` 与 `setHardware`，`store.ts` 以 `null` 起始，仅通过新动作变更。
- **在 `client/index.ts` 单次拉取 `hardware()`。** 挂载时与 `listModels()` 并行拉取；`connection/reset` 与手动 `load()` 会重新探针。探针失败保持 `null`（显示“硬件未知”），测试中的桩提供者不会阻塞。
- **UI。** `ModelsManager.tsx` 在每张卡片的元信息行下渲染 `estimateFit(entry.sizeBytes, hardware)` 为 `需要 X · 你有 Y · 可加载/显存/内存不足`（探针到达前显示“硬件未知”）。下载行在 `bytesTotal !== null` 时显示同行。警告使用 `fitWarn`（主色、半粗）；该行为纯派生数据，不新增订阅。

## 备选方案

- **加入 KV 缓存开销（`contextLength * bytesPerToken`）。** 已拒绝：开销依赖 `GgufMetadata` 未携带的隐藏尺寸/层数，错误预估比仅按文件体积并明示限制更差。
- **预留余量阈值（如可用空间的 90%）。** 已拒绝：文件体积已低估常驻集，任意余量仍对部分模型错误且对用户不直观；相等体积判为可加载。

## 后果

- **S2 完成。** 卡片在任何加载前即回答"需要 6.2 GB，你有 8 GB"；下载行在 HEAD 总量已知时即回答。
- **无服务变更。** UI 从不在 `ctx.models` 写入策略；provider 仍是 `load-state` 的事实来源。
- **限制已记录。** README 已知限制描述了仅按文件体积的规则与"硬件未知"状态。
