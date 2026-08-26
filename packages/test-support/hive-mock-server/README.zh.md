# @deepseek-ai/dsh-hive-mock-server

[English](README.md) | 中文

面向测试与离线开发的 Hive sidecar wire 契约可编程 HTTP stub。它提供 sidecar 消费者使用的三个端点——`POST /v1/hive/curate`、`POST /v1/hive/observe`、`POST /v1/protocol/run`——响应体与 `@deepseek-ai/dsh-hive` 的 `CurateResponse` / `ObserveResponse` 类型以及 Python sidecar 的 live 形状逐字节匹配。

## 模型体验

### Sidecar wire stub

#### 模型看到什么

什么都不看到。stub 在 `POST /v1/hive/curate`、`POST /v1/hive/observe` 与 `POST /v1/protocol/run` 上提供固定的 HTTP 响应;它从不与 LLM 通信,存在的意义是让消费 sidecar 的工作（UI 表面、curator 变更、bench 工具）在 Python sidecar 不运行的情况下完成测试。

#### Token 影响

零。响应是静态或脚本化的 fixture,没有任何形式的 token 计量。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- stub 把全部状态保存在内存中;没有持久化,也没有 comb。
- 尚无 SSE 流式端点（`/v1/hive/stream`）——流式消费者仍需 Python sidecar 或手写假件（登记于 MULTI-OX-PROJECT-PLAN.md 的 X1 行）。
