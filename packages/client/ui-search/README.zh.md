# @deepseek-ai/dsh-client-ui-search

[English](README.md) | 中文

Web 客户端插件，贡献全局跨会话搜索对话框：`Ctrl/Cmd+Shift+F` 在整个应用框架层打开对话框，走运行时的请求局部 `sessions.search` RPC（`session.search`）。查询做防抖且每个请求携带自己的信号——更快的键入会中止并取代更慢的前序请求，符合会话搜索契约中"过期抑制由 UI 持有者负责"的约定。结果与实时列表快照连接得到展示标题；仅列表内的会话可导航（`sessions.open` 会对照列表校验），不在列表的命中渲染"未在列表"徽标。错误、空态、进行中与超上限状态内联展示；线上 `hasMore` 边界意味着"请细化关键词"（该面没有游标）。

## 组装

注册进既有的 `shell.overlay` 列表座席一次；不改 SlotMap。除每个 Web 组装都已挂载的运行时会话面外无其他依赖。

```yaml
- id: ui-search
  name: '@deepseek-ai/dsh-client-ui-search'
```

## Model Experience

### 全局会话搜索对话框

#### What the model sees

经宿主搜索授权边界（命中过滤为 `session.list` 可见的会话）对持久会话日志只读；不改变提示词、消息、schema、流或工具结果。



#### Token effect

零。搜索命中与标题来自已存储的会话；打开一条命中只是导航到产生时已计入 token 的历史。

#### KV Cache 影响

无；本插件从不组装或发送提供商请求。

## 已知限制与延期工作

- **未列出的命中是惰性的**——被 `session.list` 掩蔽（或在搜索与点击之间被逐出）的命中按设计不可打开；"先加载再打开"流程需要新的列表刷新缝。
- **无分页**——线面为带边界的单页；在缝隙长出游标之前，更深的结果集需要细化查询。
