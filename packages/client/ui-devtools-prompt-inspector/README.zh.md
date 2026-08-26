# @deepseek-ai/dsh-client-ui-devtools-prompt-inspector

[English](README.md) | 中文

dsh Web 客户端的逐 step 组装请求检查器：一个会话视图页签，从持久日志回答"模型实际看到了什么？"。

## 它显示什么

- **请求头部** — 每条已记录的 `request/header` 事件一行,最新在前。每行标出 provider 模型、其 turn/step 位置、相对上一条头部的 `initial` / 系统变更 / tools 变更徽章,并展开到随请求发送的精确渲染系统提示文本与完整 tool schema 目录。
- **注入上下文** — 每条 producer 提供的上下文消息（带非用户来源的 `user/message`）,含其角色（`inject` / `recall`）、从持久来源读出的 producer 标签,以及有界的纯文本预览。
- **Token 构成** — token-meter 的 `contextBreakdown` projection（启发式的 系统/tools/消息 数字）,以及 provider 报告过用量时的累计 `tokenUsage` 分桶。

该页签注册进 `conversation.view`（id `prompt-inspector`）,一切读取都经过框架会话套件加 host 计算的 projection;它不定义服务,也不给会话日志或任何模型请求贡献内容。

## 启用它

web-app bundle 以禁用状态发布该行——这是 devtools 表面,不是生产界面。从任意更晚的 patch 层（profile 的 `cordis.patch.yml` 或 `--patch` 覆盖层）启用:定位该行 id 并替换为不带 `disabled` 的版本:

```yaml
- id: ui-devtools-prompt-inspector
  name: '@deepseek-ai/dsh-client-ui-devtools-prompt-inspector'
```

## 语义与限制

只有生效信封变化时才记录头部行,因此继承上一请求的 agent-loop step 归入承载它的头部行,而不是各得一行。section 级归因(系统文本的哪部分来自哪个 prompt section)不可用:持久日志只存渲染后的文本,检查器显示的正是所记录的内容。token 数字使用共享的固定密度估计器,按设计即近似值;估计器契约见 `@deepseek-ai/dsh-token-meter`。

## 扩展点

无。需要更多逐 step 数据的消费者应扩展持久事件集或 token-meter projections;本包保持为它们之上的只读视图。

## 模型体验

### 组装请求检查器视图

#### 模型看到什么

没有新东西。该页签渲染的正是先前请求已包含的内容——已记录的 `request/header` 事件、注入的上下文消息与 `token-meter` projections——作为只读浏览器视图;它不给任何未来模型请求贡献内容。

#### Token 影响

零。显示的所有数字要么在其事件产生处已计入,要么是仅为显示计算的估计器近似值。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- 没有新头部的 step 归入其承载头部；继承的信封没有逐 step 行。
- tool schema 差异比较序列化后的 JSON,所以仅键序变化也会标记为已变更。
