# Agent Note: Prompt 检查器作为第二个会话视图目标

Status: implemented

[English](2026-08-25-xray-prompt-inspector-view-target.md) | 中文

## Problem

X2 要求一个逐步装配请求的检查器，但持久日志仅在请求封套变化时记录 `request/header`，且没有任何 UI 表面同时展示这些请求头、随附的工具目录，以及生产者注入的上下文消息。轨迹视图已在内部消费请求头，但其快照类型与构建器是该包的私有实现，而跨包导入其他插件的符号是被禁止的。

## Decision

`@deepseek-ai/dsh-client-ui-devtools-prompt-inspector` 注册了第二个 `ConversationViewSnapshotMap` 目标 `prompt-inspector`，由它自己的两个会话 Definition 供数：一个对应每条已记录的 `request/header`，一个对应每条生产者提供的 `user/message`（排除 `user`、`model`、`tool` 来源——它们已有各自的转录呈现）。差异徽章（首个 / 系统变更 / 工具变更）由目标快照构建器相对前一行推导，保证重放是日志顺序的纯函数。视图页签渲染这些行，外加 token-meter 的 `contextBreakdown` 与 `tokenUsage` 投影；它不定义服务、不写日志、不新增任何模型可见内容。web-app bundle 以 disabled 状态插入该 roster 行——检查器是开发者工具表面，需在更晚的补丁层替换该行（去掉 `disabled`）来启用。

向 `ConversationViewSnapshotMap` 添加第二个成员也暴露了一个潜在的类型成本：只服务单个键、返回具体值的测试桩不再能通过泛型 `views.get` 线签名的类型检查。两个受影响的测试桩显式转换了其单键 getter；未来的视图目标应预期同样的一行适配。

## Alternatives considered

- 让新页签复用轨迹目标的输出：否决——这会通过非 slot 导入耦合两个插件，并在 ui-trajectory 重组时破裂。
- 宿主侧 tokens-per-source 投影单元：推迟——压缩下精确的按来源归因需要按来源的影子价格记账，而有界投影状态无法表达；组成级分解足以回答检查器当前的问题。
- 在客户端复制 token 估算器以获得按来源数字：否决——固定密度启发式在 `@deepseek-ai/dsh-token-meter` 中只有一个家，浏览器副本会漂移。

## Consequences

继承未变封套的 step 归入其承载请求头的行，而不是各自成行；README 将此记录为已知限制。段落级归因（哪个提示段产生了系统文本的哪部分）从持久日志不可得，因此检查器展示的正是被记录的内容。将 hive sidecar 漂移门表面从裸的 `packages/hive/scripts` 迁入 `packages/hive/dsh-hive`，修复了早期放置方式造成的干净树宿主构建失败：tsdown 的根工作区 glob 会把任何没有自身配置的 `packages/*/*` 目录当作包处理，并在其上解析入口失败。
