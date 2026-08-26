# @deepseek-ai/dsh-preset-trainer

[English](README.md) | 中文

面向 agent preset 的训练器 pass：证据 pass 把持久会话日志挖掘成每 preset 的工具成功、失败模式与未用工具报告（供后续阶段起草组合变更时对照的证据基座）；评估 pass 用一次基线运行对候选组合打分。

## 计算内容

对每个会话，按解析出的 agent preset 分组（`resolveSessionPreset`：取最后一条 `agent-preset/selected` 事件，回退到头字段；两者皆缺时为 `(none)`）：

- **逐工具结果**——调用数、成功数、错误数（含错误码直方图），以及回合结束前结果未落地的未决调用。
- **`successfulTraces`**——调用到成功结果的配对，值得训练的轨迹。
- **失败模式**——模型错误（`turn/end` 原因 `error`）、带错误码直方图的提供方重试（`llm/retry`）、结构化工具超时（`TOOL_TIMEOUT`），以及合并的错误码直方图。
- **未用工具**——出现在会话最终装配目录（`request/header.tools`）中但从未被调用的名字。

## 用法

库接口（后续训练阶段消费的面貌）：

```ts
import { collectEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = collectEvidence(snapshots)
```

对任意 SQLite 会话查询存储的无头 CLI：

```sh
node --import tsx packages/preset/preset-trainer/src/bin.ts \
  --db /path/to/session-query.db --out evidence.json
```

或对挂载了引擎的上下文编程调用：

```ts
import { mineEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = await mineEvidence(ctx) // ctx 携带 `sessionQuery`
```

## 对候选与基线做评估

一个 `EvalRun` 是在某个 preset 标签下执行完的一份任务列表：`{ label, generatedAt, pes?, tasks }`，每个任务带稳定 id 与终局 `passed` 判定，`pes` 对应 sidecar 的运行级 `post_run_pes.pes`。比较核心把两次运行变成一个判定：

```ts
import { compareRuns, summarizeEvalRun } from '@deepseek-ai/dsh-preset-trainer'

const comparison = compareRuns(baselineRun, candidateRun, { maxPesDrop: 0.05 })
comparison.ok // 任一阈值被突破、或候选漏跑任务时为 false
comparison.reasons // 具体原因：哪些任务翻转、PES 移动了多少
```

判定规则全部显式：候选必须执行每一条基线任务；净新增失败（回归减去收益）不超过 `allowNewFailures`（默认 0）；PES 跌幅不超过 `maxPesDrop`。候选多出的任务只报告、不惩罚。同一份运行内重复的任务 id 直接抛出——那是损坏的产物，不是可比较的数据。

## 模型体验

### 会话日志证据挖掘

#### 模型看到什么

什么都不看到。训练器以只读方式把已提交的会话日志经 `collectEvidence` 折叠成聚合证据报告，由 `trainer:evidence` bin 输出；报告是面向人的产物，用于组合工作，绝不进入提示词装配。

#### Token 影响

零。挖掘出的数字描述的是各自会话内已被计数的 token，挖掘本身不新增任何 token。

#### KV Cache 影响

无；本包既不装配也不发送任何提供方请求。

## 已知限制与暂缓事项

- 报告都是聚合值；刻意不采样参数载荷（可能携带秘密）。带脱敏的轨迹级证据等到有消费者需要再做。
- 整个语料在内存中折叠；超大存储应改为经 `searchEvents` 分页而不是整日志 `readSession` 快照。
- **评估执行尚未接线**——`compareRuns` 只对递给它的运行打分；这里不会启动无头会话，也不会发出 `ctx.jobs` 任务。活的执行器端口与任务生产者作为本核心之后的 keyed-e2e 后续落地。
