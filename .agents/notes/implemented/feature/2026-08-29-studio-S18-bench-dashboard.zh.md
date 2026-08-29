# Agent Note: 基准仪表盘 PES/tok/s 迷你趋势线

Status: implemented

[English](2026-08-29-studio-S18-bench-dashboard.md) | 中文

## Problem

`POST /v1/protocol/run` 与 `GET /v1/report/*` 仅能通过 `/bench` 命令输出或服务端 HTML 视图访问。运维需横向观察多次协议运行的 PES 与 tok/s 趋势，而既有 `bench_gate.py` 仅做单报告基线比对。仪表盘需在既有 `ui-sidecar-panel` 设置面内以 sparkline 呈现 PES/tok/s，离线可用（sidecar 不可用则空序列而非报错），历史纯函数且截断，不新增会话事件。

## Decision

- **`dsh-bench/src/history.ts`（新增）。** `BenchHistoryPoint`、`pesOfReport`/`tokPerSecOfReport` 兼容多形状、`toHistoryPoint`、`normalizeHistory`（按 timestamp 排序、上限 30）、`buildSparklinePath`（Y 翻转、单点居中）、`fetchBenchHistory`（顺序拉取、AbortController、失败跳过）。
- **`dsh-bench/src/index.ts`（扩展）。** 透出历史面，保留 `/bench` 启动/摘要路径，Config 改为普通解析。
- **`ui-sidecar-panel/src/sparkline.ts`（新增）+ `src/index.ts`（扩展）。** 纯函数路径与 SVG 渲染，设置面 `sidecar` 保留生命周期渲染。
- **`harness/bench_gate.py`（扩展）。** `extract_tok_per_sec`、`append_history`、`load_history`，上限 30。

## Alternatives considered

- **新增 `bench/history` 会话事件持久化。** 拒绝：历史为派生遥测，非模型可见。
- **localStorage。** 拒绝：需跨浏览器与 Python 可检。
- **图表库。** 拒绝：单路径无需引入。

## Consequences

- **S18 完成。** 面板可得 PES/tok/s 趋势；基准面可顺序拉取历史；Python 可追加/加载截断历史。
- **无热点修改。** 独立 `tsc -b <pkg>` 为门禁。
- **离线安全。** 不可用时空序列渲染。
