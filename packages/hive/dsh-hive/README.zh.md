# dsh-hive

[English](README.md) | 中文

**HiveBench Studio 策展器**：在 agent 的每个步骤通过 hive sidecar 组装有界、按相关性排序的上下文。

每个步骤，插件向 sidecar（`POST /v1/hive/curate`）请求该步骤查询的策展上下文，并将其折叠进请求，成为一条带来源归属的 `plugin` 消息（dsh 对 system-prompt 内容的约定——只有一段前置上下文，绝不出现第二条 system 消息）。由 shell 自身的模型路由生成回复；插件在回复完成后回报给 sidecar（`POST /v1/hive/observe`），供 store 与 comb 在后续轮次摄取。

失败是软性的：sidecar 宕机或超时该步骤直接以未策展形态通过——禁用本插件即复现普通 harness（机制归因）。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `sidecarUrl` | `http://127.0.0.1:8765` | hive sidecar 来源 |
| `conversationKey` | `workspace` | 每个 workspace 一个 hive store（跨会话稳定）或每个会话一个 |
| `timeoutMs` | `10000` | 单次请求超时 |
| `enabled` | `true` | 总开关（关闭 == 普通 harness） |
| `maxCurationSteps` | `1` | 每轮最多刷新策展的 step 数；第 2 轮起复用本轮原始 query，每轮注入新的 snapshot 并取代上一个 |


## 策展遥测

每次成功轮次都会把非模型可见的质量指标附加到注入的持久 source 上 —— `source.curation = { round, maxRounds, turn, pes, degradationLevel, tokenCount, mode }`。provider 载荷永远不会看到它们；数值随日志留存，重放可重建。插件同时注册 `hiveCuration` 投影（保留最近 16 轮），devtools 表面可通过普通投影通道读取 pes / degradation 的轨迹。

## 事件

持久化 `user/message` 条目携带 `source.kind === 'plugin'`、`source.plugin === 'dsh-hive'`、`form: 'snapshot'`——即模型读到的策展上下文，与注入内容完全一致。伴随不变式（`@deepseek-ai/dsh-hive/invariant`）在加载与追加时校验其结构。

## 用法

```yaml
- id: dsh-hive
  name: '@deepseek-ai/dsh-hive'
  config:
    sidecarUrl: http://127.0.0.1:8765
    conversationKey: workspace
```
