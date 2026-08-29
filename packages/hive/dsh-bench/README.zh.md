# dsh-bench

[English](README.md) | 中文

**HiveBench Studio 基准界面**：通过 hive sidecar 发起 P1–P11 协议运行并汇总其报告，全程无需离开 agent。

## 命令

- `/bench [live|mock] [max-convs]` — 通过 sidecar（`POST /v1/protocol/run`，后台进程）发起一次协议运行，并在报告就绪后汇总（`PES 73.1 (YELLOW) | protocol: 6 PASS / 3 FAIL / 2 SKIP`）。运行进行中时报告 `launched (pid N); report pending`。
- `/bench <run-name>` — 收集一次既有运行（例如 `/bench protocol_20260824_120000`）：仅获取并汇总其报告，不发起新运行。

每次发起都会记录为仅入日志的 `bench/run` 会话事件（绝不对模型可见）。伴随不变式（`@deepseek-ai/dsh-bench/invariant`）校验这些记录。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `sidecarUrl` | `http://127.0.0.1:8765` | hive sidecar 来源 |
| `timeoutMs` | `15000` | 单次请求超时 |
| `enabled` | `true` | 总开关（关闭 == 无 `/bench` 命令） |

## 用法

```yaml
- id: dsh-bench
  name: '@deepseek-ai/dsh-bench'
  config:
    sidecarUrl: http://127.0.0.1:8765
```

## Model Experience

### 协议基准运行器

#### What the model sees

无直接内容。`/bench` 在 hive sidecar 内启动协议运行，由其自身的 agent 桥驱动那些对话；本包仅将启动结果记录为只入日志的 `bench/run` 事件，从不组装请求内容。

#### Token effect

协议对话在其自身会话内消耗 token 并在那里入账；本命令自身不新增任何消耗。

#### KV Cache effect

无；本包既不组装也不发送 provider 请求。

## 回归门禁

已提交基线 `baseline.json`（`{pes: 73.1}` 来自桩报告；live PES 确立后替换）。纯函数 `evaluateGate(report, baseline, threshold)` / `exitCodeFor(decision)` 比较 `report.post_run_pes.pes` 与 `baseline.pes`（阈值 0 = 任何下降即失败）。headless CI 门禁为 `node scripts/check-pes-baseline.mjs --report <report.json> [--baseline packages/hive/dsh-bench/baseline.json] [--threshold 0]` —— 回归时退出 `1`，否则 `0`（PES 缺失时跳过）。

## 已知限制与暂缓事项

- **报告收集是拉取式** —— 仍在执行中的运行报告为 pending；重新运行 `/bench <run-name>` 以收集已完成的报告。
- **基线为桩 PES**，待 live P1–P11 确立真实 PES 后更新。
