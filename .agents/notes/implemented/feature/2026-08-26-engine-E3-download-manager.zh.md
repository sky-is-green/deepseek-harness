# Agent Note: 下载经由 ctx.models 背后的可续传分程抓取引擎落地

Status: implemented

[English](2026-08-26-engine-E3-download-manager.md) | 中文

## 问题

E4 的本地 provider 对 `startDownload` 响亮拒绝：本地优先的 studio 需要 Hugging Face GGUF 获取能力——跨重启续传、对照 hub 公告摘要做完整性校验、为模型管理卡片（S1）与容量适配估算（S2）提供实时进度——并且不引入第三方传输依赖，也不让网络策略泄漏进 provider。

## 决策

- **新引擎包 `@deepseek-ai/dsh-model-downloads`。** `resolveRemoteFile(baseUrl, ref)` 以 HEAD 探测、跟随重定向，捕获最终 URL、声明大小以及 LFS 风格 sha256 etag 作为强校验预期。`fetchToFile({ baseUrl, ref, destinationPath, signal, onProgress })` 流式写入 `<destinationPath>.part`：暂存已存在时携带 Range 请求；服务器忽略 Range（一次干净重试）与 `416`（就位已完成但未改名的暂存文件；尺寸不符则响亮拒绝）均有明确处理；sha256 在落位后校验，不符即删除已落位文件；在每个 await 边界上的中止都映射为 `{ result: 'cancelled' }` 并保留暂存供下次续传。
- **节奏所有权刻意拆分。** 引擎逐 chunk 发出进度样本；节流属于消费者。`models-local` 新增 `downloadProgressMs`（默认 250ms）外加收尾 tick，保证 UI 总量精确结算。
- **Provider 受理同步且响亮**（`models-local` 的 `DownloadJobs`）：仅接受 huggingface 来源直到其他来源配得上自己的 provider；仅接受 `.gguf` 目标因为目录只扫描该后缀；目标文件已存在或已有在途任务指向它时在任何句柄创建之前拒绝。完成后重扫目录并在任务以 `completed` 结算之前发出 `models/catalog-updated`；拆卸先取消在途下载并等待结算，再卸载模型。
- **Hub 位置是配置**，`hubBaseUrl`（默认 `https://huggingface.co`），测试借助进程内 fixture 离线运行而不是 stub 内部。

## 曾考虑的替代方案

- **npm 传输库**——没有一个同时具备分程续传、摘要校验、`.part` 暂存语义与零依赖；引擎约 150 行且完全自有。
- **先校验再改名**——被「先落位再校验」否决：毒化目录的保证相同（不符即删）、失败面更简单，416 就位路径也自然成立。
- **引擎侧限流进度事件**——否决：两个消费者（卡片、取证）想要不同节奏；配置旋钮把策略留在 provider。

## 后果

S1 无需额外管线即可从 `models/download-*` 事件渲染真实下载进度；S2 从受理快照读取 `bytesTotal`。镜像站、凭据门控仓库与多文件分片集仍是在同一 seam 后的未竟工作（已记录为限制）。
