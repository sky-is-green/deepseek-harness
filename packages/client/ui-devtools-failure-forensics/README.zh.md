# @deepseek-ai/dsh-client-ui-devtools-failure-forensics

[English](README.md) | 中文

聊天视图中更丰富的失败细节：每个收尾轮一条 turn 尾部链条条目，渲染该轮的 `failureForensics` projection 条目——类型徽章、有界消息、机器码、provider 请求 id、kill 信号、有界输出尾部，以及确定性的建议修复。

## 行为

挂在 `conversation.chat.turnTail` 链条 slot 上，因此与其他尾部贡献者并列组合，不触碰 ui-conversation 内部。selector 接受每个轮（它读不到响应式 projection 数据）；当 projection 在该轮没有条目时组件渲染 null，所以普通轮保持与已发布完全一致的尾部。条目按最新在前渲染，每条可展开查看其字段。

projection 背后的 fold 由 `dsh-base`（`@deepseek-ai/dsh-failure-forensics`）挂载；把任一插件组合移除，都会干净地移除它在表面中的那一半。

在 web-app 名册中默认启用：与 devtools 视图页签不同，它不添加界面元素，没有捕获到的失败时什么都不渲染。

## 模型体验

### Turn 尾部失败细节

#### 模型看到什么

什么都不看到。该行渲染 host 侧针对已关闭轮的 `failureForensics` projection；它不给任何会话或未来请求贡献内容。

#### Token 影响

零。条目描述的失败,其 token 已在发生处计入。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- Hook 失败（`hook/result`）尚未 fold；加入它们意味着在同一对包里新增条目类型与文案。
- selector 接受每个轮，所以即使将渲染 null 组件也会每轮挂载一次；链条契约目前没有更便宜的响应式 seat。
