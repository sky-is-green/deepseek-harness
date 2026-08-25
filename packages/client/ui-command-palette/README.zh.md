# @deepseek-ai/dsh-client-ui-command-palette

[English](README.md) | 中文

Web 客户端插件，贡献全局命令面板：`Ctrl/Cmd+K` 在整个应用框架层打开面板，经 `ctx.commandUi.paletteEntries` 列出当前会话的可用命令（宿主目录加上按可用性过滤的客户端贡献与裸调用装饰）。输入即本地过滤；回车或点击执行——宿主命令以裸参数分离执行（走 `command.execute`，处理器结果渲染为持久流节点），popup 命令在面板内解析选项列表并经自身 `onSelect` 提交所选行。带前置参数的宿主命令渲染为惰性行：参数认领仍归输入框所有。没有当前会话时快捷键保持惰性，不挂载任何内容。

## 组装

注册进既有的 `shell.overlay` 列表座席一次；不改 SlotMap。依赖 `ctx.commandUi`（ui-commands）及其 `paletteEntries` 面。

```yaml
- id: ui-command-palette
  name: '@deepseek-ai/dsh-client-ui-command-palette'
```

## Model Experience

对命令面只读；执行走既有 `command.execute` 准入路径并保留其持久生命周期日志。除被执行命令本身的效果外，不改变提示词、消息、schema、流或工具结果。

#### KV Cache 影响

自身无影响；被执行的宿主命令对会话的影响与键入 `/名称` 完全一致。

## 已知限制与延期工作

- **选项确认未设门**——携带 `confirmation` 的 popup 选项会跳过共享外壳的确认步骤；待实际贡献使用该门时再接入。
- **子串过滤**——本地过滤为子串匹配；若面板名单增长，可换用斜杠菜单的边界感知模糊排序。
