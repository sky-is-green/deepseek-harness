# X11 Sidecar 生命周期 + 冻结二进制 Bootstrap

## 摘要

`X11` 负责 Hive sidecar（`harness` FastAPI）的生命周期，使终端用户无需执行 `pip`。宿主 `SidecarLifecycle` 基于 `ctx.subprocess` 拉起并以 `GET /openapi.json` 探活，`resolveSidecarArgv` 与 `scripts/bootstrap-sidecar.mjs` 优先冻结二进制（`native/sidecar` 或 `$SIDECAR_BINARY`，报告 `frozen`/`module`/`missing`），emit `sidecar/status`，并保证 teardown。客户端 `ui-sidecar-panel` 以 `settings` 区段（`order: 40`）展示状态。

## 契约

- `packages/sidecar/sidecar-lifecycle/src/index.ts:1` — `SidecarLifecycle extends Service` 位于 `ctx.sidecarLifecycle`（`status()`/`bootstrapReady()`/`start(signal?)`/`stop()`/`probeHealth()`），`Config`（`port`、`binaryPath?`、`pythonBin`、`cwd?`、`startupTimeoutMs`、`healthPollMs`、`extraArgs`），`resolveSidecarArgv`，`sidecar/status` 事件。单进程、并发 `start` 响亮拒绝、`stop` 幂等、带 deadline 轮询 `openapi.json`。
- `scripts/bootstrap-sidecar.mjs:1` — `node scripts/bootstrap-sidecar.mjs [--check] [--json]` 探测 `native/sidecar` 与同级 `hive-memory/harness` 多候选，打印 `frozen`/`module`/`missing` 及 `argv`，`--check` 时 `missing` 退出 1。
- `packages/client/ui-sidecar-panel/src/index.ts:1` — `ui-sidecar-panel` 注册 `settings` 区段 `sidecar`（`title: Sidecar`、`order: 40`）。

## 验证

- `packages/sidecar/sidecar-lifecycle/tests/sidecar-lifecycle.spec.ts:1` — 5 用例；`packages/client/ui-sidecar-panel/tests/sidecar-panel.spec.ts:1` — 2 用例；共 7 绿。
- `tsc -b` / `oxlint` 0；`node scripts/bootstrap-sidecar.mjs --json` → `module`，`--check` exit 0。

## 暂缓

- 冻结二进制产物（`native/sidecar`）尚未发布；`bootstrap-sidecar` 仍以 `module` 回落为开发路径。
- 暂不支持跨重启孤儿接管；面板暂为只读状态，无启停按钮/日志尾。
