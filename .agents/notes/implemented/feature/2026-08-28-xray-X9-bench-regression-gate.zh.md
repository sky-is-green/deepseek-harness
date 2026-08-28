# X9 基准回归门禁 — PES 对比已提交基线

## 摘要

`X9` 是 `dsh-bench` 协议运行器（`X8`）之上的 headless CI 门禁：PES 相对 `baseline.json` 的回归以非零退出。既有 `/bench` 命令仍发起 `POST /v1/protocol/run` 并汇总 `GET /v1/report/<run>`；门禁为其上的纯比较，供 CI 批量校验。

## 契约

- `packages/hive/dsh-bench/src/gate.ts:1` — `evaluateGate(report, baseline, threshold)` / `exitCodeFor(decision)` / `pesOf(report)`。阈值 0 = 任何下降即失败；缺失 `post_run_pes.pes` 时跳过门禁（不算回归）。
- `packages/hive/dsh-bench/baseline.json:1` — 桩基线 `{pes: 73.1}`（来自 `tests/dsh-bench.spec.ts` 桩报告；live P1–P11 PES 确立后替换）。
- `scripts/check-pes-baseline.mjs:1` — `node scripts/check-pes-baseline.mjs --report <report.json> [--baseline packages/hive/dsh-bench/baseline.json] [--threshold 0]` —— 读取 JSON、调用 `evaluateGate`、打印标题、回归时退出 `1` 否则 `0`。

## 变更的接口

- `packages/hive/dsh-bench/src/index.ts:42` — 从 `./gate` 重导出 `PesBaseline`、`GateDecision`、`evaluateGate`、`exitCodeFor`、`pesOf`。
- `packages/hive/dsh-bench/README.md:47` / `README.zh.md:47` — 回归门禁章节与基线说明。

## 验证

- `packages/hive/dsh-bench/tests/bench-gate.spec.ts:1` —— 9 用例：提取 PES、等于/高于基线通过、任意下降失败（阈值 0）、阈值容忍（0.5）、恰好阈值边界、缺失 PES 跳过、退出码。与 `dsh-bench.spec.ts`（8 用例）共 17 绿。
- 手动：`echo '{"post_run_pes":{"pes":72}}' | node scripts/check-pes-baseline.mjs` → `REGRESSION` exit 1；`74` → `ok` exit 0；缺失 PES → `gate skipped` exit 0。
- 预期按包 `tsc -b` / `oxlint` / `build` 绿。

## 暂缓

- Live 基线 PES（当前为桩）。sidecar 就绪后在 CI 中接 `bench:gate` 任务。
- 可选 `/bench` 失败开关（当前门禁为外部脚本/库，非斜杠命令开关）。
