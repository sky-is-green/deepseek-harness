# Agent Note: 无新事件类型的 Hive 多轮策展与遥测

Status: implemented

## Problem

X10 要求配置化的多 step 策展，并把 sidecar 响应侧的质量分数（`pes`、`degradation_level`）以非模型可见遥测暴露。策展器此前只在 step 1 触发，并把这些分数全部丢弃。显而易见的载体——新增会话事件——会触碰冻结的核心 `SessionEventMap`、迫使双 SDK 同步更新期望输出，并重复记录注入本身已经持久表达的数据。

## Decision

两处改动都在 `@deepseek-ai/dsh-hive` 内（wire 契约不变）：

- **多轮门控**：`maxCurationSteps`（默认 1 = 历史行为）允许一轮的第 2..N 个 step 重新策展。第 1 轮使用声明批次中的新 query；后续轮次复用本轮原始 query，让 sidecar 能随着被观察流量演化而刷新装配。每轮注入新的 `form: 'snapshot'` 消息——该上下文形态的语义就是后到的快照取代先前的快照，因此多轮无需新语义。每会话状态追踪 `{turn, query, rounds}`，新轮次重置。
- **遥测**：每次成功轮次把 `source.curation = { round, maxRounds, turn, pes, degradationLevel, tokenCount, mode }` 写到注入的持久 source 上。消息 source 是生产者自有、可合并扩展的元数据，永远不会进入 provider 载荷——因此这些数值按构造即是持久、可重放且非模型可见——无需新事件类型。同一插件注册 `hiveCuration` 投影单元（有界 16 条）折叠这些 source，为 devtools 表面提供经普通投影通道的 pes/degradation 轨迹。invariant 伴随插件校验该块的形状，畸形生产者会响亮失败。

## Alternatives considered

- 新增 `ignorable` 会话事件记录策展结果：否决——核心 SessionEventMap 对 lane 冻结，需要两个 SDK 在同一 PR 更新快照，且重复了注入 source 可承载的内容。
- `ctx.sessionTelemetry` ops 记录：否决——该接缝的出站词汇表由协调器独占（`agent-error`、`shutdown`），其 backend 输出到进程外；每轮质量应位于它所描述的持久产物旁，供重放与客户端同样读取。
- 经由请求中未用的 `config` 字段做 sidecar 驱动的多轮：推迟——插件侧循环无需改动线路，且与今日冻结契约兼容；若 Python 侧未来实现原生多轮，`CurateRequest.config` 是预留席位。

## Consequences

首轮之后的每一轮各花费一次 sidecar 往返，并向日志追加一条快照消息（被取代的前身保留至压缩为止）——README 的 Model Experience 权衡已记录。投影只折叠本插件自己的注入；外来生产者写入 `source.plugin === 'dsh-hive'` 也会被折叠，而 invariant 的形状检查使其成为创作错误而非静默输入。
