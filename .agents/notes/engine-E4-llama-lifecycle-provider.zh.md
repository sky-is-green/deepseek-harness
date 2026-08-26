# Agent Note: 本地 provider 拒绝不属于自己的能力——下载留给 E3

Status: implemented

[English](engine-E4-llama-lifecycle-provider.md) | 中文

## Problem

E4 要给 `ctx.models` 一个真正的 provider 让 S1 停止 mock，但 seam 同时要求一个下载表面，而那分明是另一个任务（E3：断点续传、完整性校验、HF 协议）。假装会下载的 stub 会毒害用户；具体类又不能留抽象方法不实现。

## Decision

`@deepseek-ai/dsh-models-local` 实现生命周期切片并响亮拒绝其余：

- **生命周期**：GGUF 目录扫描 → 目录；加载经 `ctx.subprocess` 生成 `[serverBinary, ...extraArgs, -m path, --port <free>, -c ctx]`，在有限预算内轮询 `/health`，在每个迁移点提交 seam 受检语法；卸载终止进程树并走到 `unloaded`；dispose 尽力卸载全部。
- **拒绝响亮且具体**：下载拒绝时点名 E3；第二个并发加载拒绝而不是静默驱逐；损坏权重让目录扫描失败，模型绝不会静默消失。
- **没有 llama.cpp 也可测**：`extraArgs` 是一等配置字段（真实部署本来就需要包装脚本／额外旗标），测试因此能跑一个 30 行的 Node 假服务器顶替 `llama-server`。

## Alternatives considered

- **provider 内置最小 HF 下载** — 否决：续传＋完整性＋磁盘位置策略正是 E3 的注册范围，在这里复制残缺版会分叉下载词汇。
- **新加载请求静默驱逐已加载模型** — 否决：把资源决策藏进请求处理会破坏提交点状态语法；驱逐策略值得将来拥有自己的表面。
- **目录扫描逐文件跳过损坏条目** — 否决：UI 里可见却不可加载的模型，比一个点名文件的扫描错误更糟。

## Consequences

S1 可以挂载本 provider 对任意 llama.cpp 构建驱动真实加载／卸载；E10（视觉路由）只需扩展 argv 构建。seam 剩下的缺口是下载，已作为 E3 登记、其阻塞项均已完成。
