# @deepseek-ai/dsh-session-live-turn-metrics

[English](README.md) | 中文

函数插件，注册 `liveTurnMetrics` 投影单元：最近一个助手步骤的首字延迟（TTFT）与解码吞吐读数，从步骤边界、token 增量块与已装配消息中实时折叠，并经会话投影通道（`session/projection` 推送帧）下发，使输入框旁的渲染器在 token 流式到达期间持续更新。视图一次只跟踪一个步骤——当前正在流式的步骤，或最近一个装配了消息的步骤。参考消费者是 Web 客户端的输入框坞站读数（`dsh-client-ui-live-metrics`）；全日志口径的对应物是 `dsh-session-stats`。

## 折叠语义

- `step/start` 打开被跟踪步骤的边界；上一个已结算视图在新步骤首个 token 到达前保持可见，因此读数不会在步骤之间闪烁消失。
- 首个非空 token 增量记录 TTFT（`step/start` → 首 token）并开启解码区间；其后每个非空增量累加逐增量计数。流式期间吞吐为估计值：增量数除以首 token → 最新增量的时间（多数提供商大致按每 token 一块流式输出）。
- `assistant/message` 结算该步骤：当 usage 记录报告输出 token 时，吞吐变为精确值（输出 token 除以首 token → 消息时间）；否则流式估计冻结在最后一个增量。
- 经 `step/end` 关闭且无消息的步骤（取消、失败）丢弃其边界，并继续显示上一个已结算数字。
- 在存在两个时间点之前省略吞吐，因此首 token 永远不会除以零。

## 组装

```yaml
- id: live-turn-metrics
  name: '@deepseek-ai/dsh-session-live-turn-metrics'
```

注入 `sessionProjections`——即本插件的全部职责；在没有该注册表的组装中 fiber 保持挂起，不注册任何内容。

## Model Experience

无：本插件只对已落日志的会话事件计算面向客户端的读模型，不触碰提示词、消息、schema、流或工具结果。

#### KV Cache 影响

无；本插件从不组装或发送提供商请求。

## 已知限制与延期工作

- **流式吞吐是估计值**——仅在消息装配时报告 usage 的提供商会使流中数字停留在逐增量粒度；后续可用流中 `usage` 采样精化（token-meter 已将此类采样视为有效）。
- **只保留一步历史**——本单元仅保留最近的步骤；分步历史由已结算的回合页脚与 StatsLine 折叠承载。
