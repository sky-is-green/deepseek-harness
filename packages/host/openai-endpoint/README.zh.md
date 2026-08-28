# @deepseek-ai/dsh-host-openai-endpoint

[English](README.md) | 中文

入站 OpenAI 兼容服务插件(默认导出 `OpenAiEndpoint`,配置 `{enabled?, bearerToken?}`):在 [`dsh-host-webserver`](../webserver/README.zh.md) 上注册两个精确路由 —— `GET /v1/models` 与 `POST /v1/chat/completions` —— 并把它们代理到 `ctx.models` 提供方为目标模型拉起的 llama-server 进程,外部 OpenAI 客户端(IDE、代理、脚本)只需把 base URL 指向 Studio 即可使用本地托管模型。请求与响应原样转发,包括 SSE 流;本包从不解析生成负载。挂载顺序须在 web server 与 models 提供方之后;`enabled: false` 时不注册任何路由,卸载时释放两个路由。

`GET /v1/models` 以 OpenAI 列表信封返回完整本地目录(`id`、`object: 'model'`、`created: 0`、`owned_by: 'studio'`)。对话请求中非空的 `"model"` 字段按目录 id 或显示名匹配;缺省时必须恰好有一个已加载的 llm —— 零个返回 503 信封,多个返回 400 并列出名称,未知名称返回 404。上游发现依赖可选的 `ModelServeEndpoints` 提供方能力(结构化探测 `serveEndpoint(modelId)`),不派生服务进程的提供方会退化为显式 503 信封而非挂载失败。上游回复的状态码与内容类型原样透传,响应体经背压管道流式转发,客户端断开会中途中止上游请求。配置 `bearerToken` 后,所有 `/v1/*` 请求需携带 `Authorization: Bearer <token>`,否则返回 401 信封。超过 32 MiB 的请求体在进行任何上游工作前返回 413;非法 JSON 返回 400。

## Model Experience

### OpenAI 服务面

#### What the model sees

代理的 `POST /v1/chat/completions` 负载原样到达已加载的 `llama-server`,包括解析目录 id 或显示名的 `model` 字段;`GET /v1/models` 以 `owned_by: 'studio'` 条目暴露本地目录。本插件不注册任何提示词或工具 schema。

#### Token effect

本层不做提示词组装;响应体经 `pipeline()` 以 32 MiB 上限流式转发,请求 token 数由上游服务器决定。

#### KV Cache effect

本层无;每个派生的 `llama-server` 拥有各自的 KV 缓存,随进程在卸载时销毁。

## Known Limitations and Deferred Work

- **只有两个路由,并非全部接口** —— 仅 `/v1/models` 与 `/v1/chat/completions`;embeddings(`/v1/embeddings`)随任务 E6 落地,其余 completions 接口等有消费方再排期。
- **Bearer 认证,无身份体系** —— 一个共享令牌守护该接口面;每客户端密钥、速率限制与用量统计属于部署侧工作,v1 刻意不做。
- **单上游假设** —— 每次请求在分发时刻解析到唯一一个模型的服务器;没有排队、负载均衡或多模型扇出。
