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
