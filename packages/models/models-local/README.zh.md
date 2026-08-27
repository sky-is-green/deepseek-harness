# @deepseek-ai/dsh-models-local

[English](README.md) | 中文

`ctx.models` 的本地 llama.cpp provider：目录就是一个 `.gguf` 权重目录，经 GGUF 头部读取器读出；`hardware()` 提供 `dsh-hardware-probe` 的一次性缓存探测；加载／卸载经 `ctx.subprocess` 驱动被生成的 `llama-server`，配合有界 `/health` 轮询与空闲端口分配；下载经 `dsh-model-downloads` 流式写入权重目录，支持 Range 续传与 sha256 完整性校验。

## 约定

- **加载语法即 seam 的语法**，挂载时由 `dsh-models` 不变式伴生插件强制：`unloaded → loading → loaded → unloading → unloaded`，`failed` 可重试恢复。
- **一次加载一个生成进程**：argv 为 `[serverBinary, ...extraArgs, -m <path>, --port <free>, -c <context>]`；端口从 `basePort` 向上探测；第二个并发加载响亮拒绝而不是静默驱逐。
- **健康预算**：每 `healthPollMs` 轮询 `/health` 直到 `loadTimeoutMs`，超时终止整棵进程树并把状态提交为带原因的 `failed`；中止信号经中止路径走 `unloading → unloaded` 语义并以 `aborted` 拒绝。
- **下载落在 `modelsDir`**，沿用来源文件名：经同名 `.part` 暂存并支持 Range 续传，hub 提供 sha256 时按其校验，校验通过才原子改名就位。目标文件已存在时在创建任何句柄之前响亮拒绝；完成后重扫目录并在任务以 `completed` 结算之前发出 `models/catalog-updated`。取消保留部分 `.part` 供下次续传。
- **目录扫描响亮失败**遇到损坏的 `.gguf`——静默空洞正是「为什么我的模型加载不了」类 bug 的起点。删掉坏文件或修好它。
- dispose 先取消所有在途下载并等待结算，再尽力卸载全部；卡死的孩子随 subprocess 服务自身的拆卸升级消亡。

## 模型体验

### 本地托管表面

#### 模型看到什么

什么都不直接看到：请求经指向所服务端口的 `ctx.llm` 适配器路由抵达（`api: openai-completions`，见本地生成路由决策），服务中一切面向模型的部分都由适配器负责。

#### Token 影响

无直接影响；上下文长度只流入被生成服务器的启动旗标。

#### KV Cache 影响

本层没有；每个已加载服务器拥有自己的 KV Cache，并随卸载时的进程一起消亡。

## 已知限制与暂缓事项

- **单一下载端点、无鉴权**——下载只寻址单一 `hubBaseUrl`（默认 huggingface.co）且匿名；镜像站与凭据门控仓库需要尚无消费者行使的鉴权 seam。
- **仅单文件下载**——分片 GGUF（`-00001-of-00003.gguf`）会作为互不相关的目录条目下载；未实现分片拼接。
- **单模型并发**——同一时间只有一个生成中的服务器；多模型驻留等待空闲驱逐策略（E4 后续），而不是把驱逐藏进静默卸载里。
