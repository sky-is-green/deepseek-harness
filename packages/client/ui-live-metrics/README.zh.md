# @deepseek-ai/dsh-client-ui-live-metrics

[English](README.md) | 中文

Web 客户端插件，贡献一个 `conversation.composer.dock` 条目：输入框旁的实时解码吞吐与首字延迟读数，经标准 `useProjection` 座席读取宿主计算的 `liveTurnMetrics` 投影（`dsh-session-live-turn-metrics`）。读数随首个 token 的延迟出现，在存在两个时间点后补充吞吐数字，标记流式阶段，并在消息装配后保留提供商精确的结算数字。投影没有视图时不渲染任何内容；未装配该投影单元的组装零成本。

## 组装

注册进既有的 `conversation.composer.dock` 列表座席（排在自带统计行之后）；不改 SlotMap。宿主组装需包含 `liveTurnMetrics` 投影单元。

```yaml
- id: ui-live-metrics
  name: '@deepseek-ai/dsh-client-ui-live-metrics'
```

## Model Experience

只读展示已落日志、宿主侧折叠的会话事件；从不改变提示词、消息、schema、流或工具结果。

#### KV Cache 影响

无；本插件从不组装或发送提供商请求。

## 已知限制与延期工作

- **流式期间为估计粒度**——流中吞吐继承投影的逐增量估计；见投影包的已知限制。
