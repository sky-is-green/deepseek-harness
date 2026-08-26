# Agent Note: 失败取证 = 投影折叠 + turn-tail 链式入口

Status: implemented

[English](2026-08-25-xray-failure-forensics-projection.md) | 中文

## Problem

X4 要求把模型崩溃与工具超时连同退出/信号标识、输出尾部和建议修复一起捕获，并以更丰富的错误呈现展示。失败事实今天已经是持久的——`turn/end` 的 error reason 携带 `LlmFailure`，`llm/retry` 携带重试轨迹，`tool/result` 携带结构化错误标识与 `isError`，shell 结果在其面向模型的文本中嵌入 `[exit code]` / `[killed by signal]` 标记——但没有东西把它们折叠成一个可查询的形状，聊天错误气泡也只显示消息字符串。为取证新增一条会话事件需要改动冻结的核心类型、同时更新两个 SDK 的期望输出快照，并重复记录日志已携带的信息。

## Decision

两个附加包：

- `@deepseek-ai/dsh-failure-forensics`（宿主侧，挂载于 dsh-base）注册 `failureForensics` 投影单元：对既有事件的纯折叠，最多产生 20 条（最旧者被逐出），每条含 kind、有界 message、机器码、经 `callId` 配对得到的工具名、输出尾部、从结果文本解析的 kill 信号，以及确定性的 `suggestedFix`（timeout / credentials / rate-limit / binary-missing / signal；无法判断时为 null 而非猜测）。普通非零命令退出刻意不捕获——那是日常流程而非取证。边界是 wire 形状的固定常量，不是配置。
- `@deepseek-ai/dsh-client-ui-devtools-failure-forensics`（web）向 `conversation.chat.turnTail` 链贡献一个入口，按最新优先渲染收尾轮次的条目，可展开字段与输出尾部。链式组合意味着对 ui-conversation 零编辑；当投影中没有该轮条目时组件渲染 null，普通轮次保持原有尾貌。

与开发工具视图页签不同，此行默认启用：它不新增界面元素，没有捕获到失败时不渲染任何内容。

## Alternatives considered

- 在失败时写入新的结构化会话事件：否决——核心 `SessionEventMap` 是 lane 的冻结参考，需要双 SDK 期望输出更新，且重复记录日志已包含的内容；投影保持单一事实来源并逐 seq 一致重放。
- 直接从子进程捕获渲染 stderr：否决——原始进程输出是非持久的 wire view 数据；持久产物是面向模型的结果文本，而这正是重放日志能提供的内容。
- 替换 `conversation.details.tool` 来丰富错误显示：否决——该席位要渲染全会话所有工具的输出；接管语义会分叉整个面板。

## Consequences

Hook 失败（`hook/result`）尚未折叠；加入它们意味着在同一对包中新增 entry kind 与文案。链选择器接受每一轮，因为选择器无法读取响应式投影数据，所以即使将渲染 null，组件也会在每轮挂载一次——这是当前 slot 契约下廉价的、经批准的成本。取证质量受限于持久信号质量：provider request id 仅在适配器上报时出现，stderr 只有通过 shell 工具已输出的面向模型的文本标记才能进入条目。
