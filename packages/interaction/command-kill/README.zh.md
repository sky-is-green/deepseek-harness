# @deepseek-ai/dsh-command-kill

[English](README.md) | 中文

一键停止所有智能体、作业、终端和已加载模型服务器的 `/kill` 斜杠命令。

## 用法

```
/kill
```

不接受参数。

## 停止的目标

| 目标 | 服务 | 动作 |
|------|------|------|
| 智能体 | `ctx.agents` | `agent.cancel({ kind: 'user' })` |
| 作业 | `ctx.jobs` | `ctx.jobs.kill(id, agent, 'kill command')` |
| 终端 | `ctx.terminals` | `ctx.terminals.kill(agent, id, 'kill command')` |
| 已加载模型 | `ctx.models` | `ctx.models.requestUnload(modelId)` |

## 行为

- 遍历所有活跃智能体并取消每一个
- 对每个智能体，列出并杀掉其拥有的作业
- 对每个智能体，列出并关闭其终端会话
- 卸载所有处于 `loaded` 或 `loading` 状态的模型
- 汇报所有已停止内容的摘要
- 按目标汇报遇到的任何错误

## 注册

在 `cordis.yml` 中加载插件：

```yaml
plugins:
  - '@deepseek-ai/dsh-command-kill'
```

该命令会出现在命令面板（Ctrl/Cmd+K）中，也可通过输入 `/kill` 调用。

## 已知限制

- 作业按智能体分组；没有全局作业列表。命令会为每个已知智能体杀掉其作业。
- 处于 `failed` 状态的模型不会被卸载（它们已停止）。
- 命令发出停止请求后立即汇报，不等待智能体/作业/终端/模型完全沉降。
- 需要组合 `ctx.jobs`、`ctx.terminals`、`ctx.agents` 和 `ctx.models` 服务。