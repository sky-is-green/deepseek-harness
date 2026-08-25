# Agent Note: 取证阶段 = 对重放验证日志读取的纯折叠

Status: implemented

## Problem

X15 启动预设训练器：从会话日志中挖掘成功的工具使用轨迹、失败模式与未使用工具，并按预设分组。两个陷阱决定了设计。预设归属与结果事实是持久的但很分散——header 字段、`agent-preset/selected` 事件、`request/header.tools` 目录、跨四类事件的 call/result 配对——任何临时重新推导的消费者都会漂移。而直接读 JSONL 文件的朴素挖掘器会分叉 Gateway 已提供的访问路径，丢失会话查询接缝提供的重放验证与存储抽象。

## Decision

`@deepseek-ai/dsh-preset-trainer` 分为两面：

- **纯库**（`collectEvidence(snapshots)`）：把完整的 `SessionLogSnapshot` 折叠为按预设的证据——每工具的 ok/error/unsettled 计数与错误码直方图、successfulTraces（call→ok 配对）、失败模式（模型错误、重试、TOOL_TIMEOUT、合并错误码直方图）、unusedTools（最终 `request/header` 目录减去已调用）。归属复用 `resolveSessionPreset`；配对遵循 session-stats 的自有键 callId 纪律；分类与 failure-forensics 一致。确定性的输出排序让报告可对比。
- **运行器**（`mineEvidence(ctx)` + 轻量 `trainer:evidence` bin）：对挂载引擎所服务的任意 SQLite 存储做一次 `listSessions` 加每记录 `readSession`——即 Gateway 自己的重放验证读取路径——并写出 JSON。

构造上只读：无插件体、无写入、没有任何模型可见内容。

## Alternatives considered

- 在脚本中直接读持久化 JSONL：否决——分叉存储抽象并跳过重放验证；查询接缝的 `readSession` 已保证重建且验证过的日志。
- 以 Cordis 插件/命令按需产出证据：推迟——X16/X17 会把候选起草与基准评分作为任务；取证阶段刻意做成库加 bin，让后续阶段组合而非包装它。
- 把工具参数采样进报告：v1 否决——参数可能携带机密；聚合结果无需脱敏层即可回答训练问题。

## Consequences

整个语料在内存中折叠，对 studio 规模的存储足够，并在触及上限前记录了改用 `searchEvents` 分页的方向。给定相同日志与时间戳输入，报告是确定的——这正是使其成为后续晋升流程可对比产物的关键。`(none)` 预设 id 收容从未声明预设的会话，未归因流量会出现在报告中而不是静默消失。
