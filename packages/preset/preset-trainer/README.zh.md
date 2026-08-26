# @deepseek-ai/dsh-preset-trainer

[English](README.md) | 中文

Preset trainer 证据 pass（X15）：把持久会话日志挖掘成按 agent preset 分组的报告——成功的工具使用轨迹、失败模式与未使用工具——作为后续 trainer 阶段起草组合变更的证据基础。

## 它计算什么

对每个会话,按其解析出的 agent preset 分组（`resolveSessionPreset`：最后一条 `agent-preset/selected` 事件,回退到头部字段；两者皆无时为 `(none)`）：

- **逐工具结果** — 调用数、ok 数、错误数（含错误码直方图）,以及 turn 结束前 result 始终未落地的未结算调用。
- **`successfulTraces`** — 调用→ok 结果对,值得据以训练的轨迹。
- **失败模式** — 模型错误（`turn/end` 原因 `error`）、provider 重试（`llm/retry`,含错误码直方图）、结构化工具超时（`TOOL_TIMEOUT`）,以及合并的错误码直方图。
- **未使用工具** — 出现在会话最终组装目录（`request/header.tools`）中却从未被调用的名字。

## 用法

库表面（后续 trainer 阶段消费的形态）：

```ts
import { collectEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = collectEvidence(snapshots)
```

对任意 SQLite session-query 存储的无头 CLI：

```sh
node --import tsx packages/preset/preset-trainer/src/bin.ts \
  --db /path/to/session-query.db --out evidence.json
```

或对已挂载引擎编程调用：

```ts
import { mineEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = await mineEvidence(ctx) // ctx carries `sessionQuery`
```

## 模型体验

### 会话日志证据挖掘

#### 模型看到什么

什么都不看到。trainer 通过 `collectEvidence` 把已提交的会话日志只读 fold 成聚合证据报告,由 `trainer:evidence` bin 呈现;报告是面向人的组合工作产物,绝不进入 prompt 组装。

#### Token 影响

零。挖掘出的数字描述的是各自会话内已计入的 token,挖掘本身不增加任何 token。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- 报告是聚合值;参数载荷刻意不采样(可能携带秘密)。带脱敏的轨迹级证据等到有消费者需要时再做。
- 整个语料在内存中 fold;很大的存储应改为经 `searchEvents` 分页,而不是整日志 `readSession` 快照。
