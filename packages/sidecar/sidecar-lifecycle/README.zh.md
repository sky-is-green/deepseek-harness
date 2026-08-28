# `@deepseek-ai/dsh-sidecar-lifecycle`

[English](README.md) | 中文

Hive sidecar 的宿主生命周期（`harness` FastAPI 应用）。优先使用冻结二进制以免用户执行 `pip`，随后通过 `ctx.subprocess` 拉起并以 `GET /openapi.json` 探活，并 emit `sidecar/status`。

## 配置

| 字段 | 默认 | 含义 |
|---|---|---|
| `port` | `8765` | sidecar 监听端口 |
| `binaryPath` | — | 冻结二进制绝对路径；缺失时回落到 `python -m harness` |
| `pythonBin` | `python` | 回落模式的 Python 可执行文件 |
| `cwd` | — | `harness/` 可解析的工作目录 |
| `startupTimeoutMs` | `15000` | 健康探测超时 |
| `healthPollMs` | `250` | 轮询间隔 |
| `extraArgs` | `[]` | 额外启动参数 |

## 服务

`SidecarLifecycle extends Service` 位于 `ctx.sidecarLifecycle`：`status()` / `bootstrapReady()` / `start(signal?)` / `stop()` / `probeHealth(signal?)`。`resolveSidecarArgv(config)` 优先 `binaryPath` 且 `existsSync` 时使用；`scripts/bootstrap-sidecar.mjs` 报告 `frozen`/`module`/`missing`。

## Model Experience

- **Token cost:** 无。
- **KV-cache effect:** 无。

## 已知限制与暂缓事项

- 冻结二进制尚未随包发布；`scripts/bootstrap-sidecar.mjs --check` 报告 `missing`/`frozen`/`module` 模式，`module` 回落仍为开发路径。
- 暂不支持跨重启孤儿接管。
- 探活使用 `openapi.json`；`harness` 就绪不影响 `dsh-hive` 的软降级。
