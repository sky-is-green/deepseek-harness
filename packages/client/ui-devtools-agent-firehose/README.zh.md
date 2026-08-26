# @deepseek-ai/dsh-client-ui-devtools-agent-firehose

[English](README.md) | 中文

dsh Web 客户端的会话事件实时流水：一个会话视图页签，按到达顺序显示已加载窗口内每条已提交事件，并附带每轮的 step 与 tool 跨度瀑布。

## 它显示什么

- **每轮时间线** — 保留窗口内每个轮一条泳道。step 跨度（`T{turn}.S{step}`）由成对的 `step/start` / `step/end` 行渲染；tool 跨度由 step 内成对的 `tool/call` / `tool/result` 行渲染；失败的 tool 调用（error 结果）标红。仍在运行的轮渲染为开放泳道。
- **近期事件** — 最近 400 条已提交事件的滚动表（seq、时间、类型、有界载荷摘要），最新在前。每条事件都被一个全量捕获 Definition 捕获，与哪些业务 Definition 同时匹配无关；未知的可扩展类型退化为 JSON 头部而不是丢弃该行。

流式 chunk 行以动画帧节奏发布，token 洪峰不会冲击渲染循环；其余事件立即发布。

## 启用它

web-app bundle 以禁用状态发布该行——这是 devtools 表面，不是生产界面。从任意更晚的 patch 层启用：定位该行 id 并替换为不带 `disabled` 的版本：

```yaml
- id: ui-devtools-agent-firehose
  name: '@deepseek-ai/dsh-client-ui-devtools-agent-firehose'
```

## 语义与限制

窗口上限为 400 行：新事件到达时旧事件离开快照，闭合行已离开窗口的跨度渲染为开放或消失（result 已离开的调用保持 pending）。瀑布跨度只从保留窗口推导，起始行已老化的轮不显示轮级边界。全量捕获 Definition 在已加载窗口内为每条事件 seq 创建一个 context——对默认禁用的 devtool 可以接受，不是产品表面的范式。

## 扩展点

无。需要更多逐事件数据的消费者应扩展持久事件集；本包保持为它之上的只读视图。

## 模型体验

### 事件流水与瀑布视图

#### 模型看到什么

什么都不看到。该页签是对已提交持久会话事件（`step/start`、`step/end`、`tool/call`、`tool/result` 及全量捕获尾部）的只读浏览器投影；它不组装任何请求内容，也不向任何会话添加消息。

#### Token 影响

零。渲染、开窗与瀑布推导消费的都是其事件产生处已计入的 token。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- 400 行上限之上没有虚拟化；更大的窗口需要 trajectory 视图的虚拟化机制。
- subagent 调用树扁平渲染（每次调用一个跨度），与聊天台账一致。
