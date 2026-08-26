# @deepseek-ai/dsh-failure-forensics

[English](README.md) | 中文

失败取证 projection（`ctx.sessionProjections` 键 `failureForensics`）：把持久失败信号 fold 成有界的条目列表,每条携带失败身份与确定性的建议修复提示,供 devtools 表面渲染。

## 它 fold 什么

每个输入都是已提交的会话事件;这里不向日志写任何东西,也不触碰模型请求。

| 信号 | 事件 | 条目类型 |
|---|---|---|
| 关闭 turn 的模型失败 | `turn/end` 原因 `error` | `model-error` |
| Provider 重试 | `llm/retry` | `model-retry` |
| 工具超时 | `tool/result` 且 `error.code === 'TOOL_TIMEOUT'` | `tool-timeout` |
| 结构化工具错误 | `tool/result` 带 `error` 或 `isError` 块 | `tool-error` |
| 被信号杀死的命令 | 结果文本中的 `[killed by signal: …]` 标记 | `command-killed` |
| 失败的 compaction 尝试 | `compaction/end` 带 `error` | `compaction` |

工具名来自把每条 `tool/call` 身份与其按 `toolCallId` 索引的 result 配对;普通的非零命令退出刻意不捕获——那是日常工流,不是取证。

建议修复按 类型/错误码 确定性映射：`timeout`、`credentials`（AUTH/UNAUTHORIZED）、`rate-limit`（RATE_LIMIT/429）、`binary-missing`（ENOENT）、`signal`。其余一切不带提示,而不做猜测。

## 边界

wire 形状的固定协议常量,不是可调项：保留 20 条（最旧的先逐出）,消息上限 200 字符,输出尾部 400 字符,64 个开放 tool-call 身份。状态是纯 JSON,像其他单元一样经 projection 缓存检查点。

## 挂载

随 `dsh-base` 发布;注册是 `sessionProjections` 上的一个 effect,把这个插件组合移除即移除该键,客户端读到的是能力缺席。Web 客户端更丰富的 turn 尾部行在 `@deepseek-ai/dsh-client-ui-devtools-failure-forensics`。

## 扩展点

无。新信号通过扩展拥有条目形状的同包 fold switch 加入。

## 模型体验

### 失败信号投影

#### 模型看到什么

什么都不看到。`failureForensics` projection 是 host 侧对已提交会话事件（`turn/end`、`llm/retry`、`tool/result`、`compaction/end`）的只读 fold;它的条目只为 devtools 渲染而存在,绝不进入 prompt 组装。

#### Token 影响

零。fold 消费的事件,其 token 已在产生处计入;有界的条目列表提供给客户端而不是 provider。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **Hook-result 信号尚未 fold** —— 在 fold-switch 条目能引用它之前,需要先有一个 `hook/result` 的持久信号所有者。
