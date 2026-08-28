# `@deepseek-ai/dsh-ui-sidecar-panel`

[English](README.md) | 中文

客户端 sidecar 生命周期面板（X11 对应 `dsh-sidecar-lifecycle`）。将 `sidecarLifecycle` 状态以 `settings` 区段呈现，并在宿主服务缺失时提示 bootstrap。

## 配置

无。以 client 插件安装；宿主存在时读取 `ctx.sidecarLifecycle.status()`。

## 扩展点

- `settings` 区段 `sidecar`（`order: 40`）—— 展示 `{state, port}` 与 unavailable 提示。

## Model Experience

- **Token cost:** 无。
- **KV-cache effect:** 无。

## 已知限制与暂缓事项

- 仅展示；启停按钮待宿主 `webserver` 动作后补充。
- 暂无日志尾。
