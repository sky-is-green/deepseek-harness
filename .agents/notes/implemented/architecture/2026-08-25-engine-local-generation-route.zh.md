# Agent Note: 本地生成经 pi-ai provider profile 路由，不写直接适配器

Status: implemented

[English](2026-08-25-engine-local-generation-route.md) | 中文

## Problem

HiveBench Studio 从本地运行时（首先是 llama.cpp）服务模型。Agent 循环需要像对待其他 provider 一样向这些服务器发请求，而 Lane A 必须在两种形态间抉择：通过配置把现有 pi-ai 适配器指向 `http://127.0.0.1:<port>/v1`，或者编写一个直接讲 llama.cpp 协议的专用本地生成适配器。

## Decision

**Profile 胜出。** 一个手工声明的 provider profile 就是完整的本地路由：

```yaml
providers:
  local:
    api: openai-completions
    baseURL: http://127.0.0.1:8080/v1
    models:
      - id: qwen3-4b-instruct
        name: Qwen3 4B
        contextWindow: 32768
```

来自随附测试的证据：手工声明的 OpenAI 兼容路由可以解析、列举，并经 `ctx.llm` 对真实 localhost HTTP 服务器完成端到端流式请求（`packages/llm/llm-pi-ai/tests/catalog.spec.ts` 的无鉴权路由与 headers 鉴权用例；`sdk-options.spec.ts` 对完整描述的本地模型的分发；`adapter.spec.ts` 对 localhost mock 的流式轮次）。模型发现会以 bearer auth 询问 `GET /v1/models`——正是 llama.cpp 服务器暴露的列表端点——因此模型清单既可以手填也可以自动发现。

一个刻意姿态对无密钥服务器很重要：不命名凭据会把路由解析为已配置但无密钥，而 pi-ai 的 OpenAI 兼容实现随后要求 API key 或 `Authorization` 头之一，响亮失败而不是让 harness 发明占位符（llm-pi-ai README 记录了这一点）。不带 `--api-key` 启动的 llama.cpp 接受任意 bearer 值，所以可用的形态就是一行：`headers: { Authorization: "Bearer local" }`。studio 启动器也可以生成并传递 token，走同一个头。

采样词汇在存在之处今天即可流通（`temperature`、输出上限）；不支持的分项如 stop sequences 以 `UNSUPPORTED_OPTION` 响亮失败而非被静默丢弃。

## Alternatives considered

- **在 `ctx.llm` 上写直接的 llama.cpp 适配器** — 否决：E7 点名的每项需求（自定义 baseURL、OpenAI 兼容协议、显式模型清单、可选鉴权）都能用 profile 表达，适配器只会为零能力增益复制分发、流式、重试与署名机制。
- **为无密钥路由自动注入占位 Authorization 头** — 目前否决：harness 刻意拒绝发明凭据（有文档有测试），静默添加鉴权会让校验 token 的代理感到意外。仅当这行头被证明是反复出现的入门障碍时再重审。
- **绕开 `ctx.llm` 用 sidecar 原生生成** — 否决：模型可见输出必须经循环进入会话日志；并行的生成路径会分叉署名、回放与工具调用管道。

## Consequences

E2–E6 面向配置构建而非新传输代码：未来的 `ctx.models` provider 启动 llama-server，生成请求经一个挂载的 profile 抵达它，其 `baseURL` 指向所启动的端口。会重开直接适配器问题的条件是具体的：某个 compat 开关无法表达的 llama.cpp 特性（每请求 grammar／JSON-schema 约束、logit bias）变成产品关键，或出现超出 `/v1/models` 的发现／列举需求。
