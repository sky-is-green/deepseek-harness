# Agent Note: 入站 OpenAI 服务通过可选能力代理到提供方派生的服务器

Status: implemented

[English](2026-08-26-engine-E5-openai-endpoint.md) | 中文

## 问题

任务 E5(LM Studio 对等)需要外部 OpenAI 客户端消费本地托管模型。models 接缝刻意把端点暴露排除在自身词汇之外("端点暴露属于 Service Provider"),因此服务插件无法得知已加载模型的 llama-server 监听在哪里 —— 而这是每个入站请求都需要的事实。

## 决策

- **可选能力接口,结构化探测。** `dsh-models` 新增 `ModelServeEndpoints`(`serveEndpoint(modelId): string | undefined`),纯类型增量;不加抽象方法,对既有消费方(S1 渲染逻辑)无破坏。`models-local` 通过记录每个派生进程端口(从分配到回收)实现它,使能力存在与进程生命周期严格同步。
- **代理,而非重新实现。** `@deepseek-ai/dsh-host-openai-endpoint` 在既有 webserver 载体上挂载两个精确路由并原样转发请求体 —— 包括经背压管道的 SSE 帧 —— 因为 llama-server 本就流利地说 OpenAI 方言;解析生成负载只会制造第二处偏离线上格式的地方。
- **退化是显式的。** 缺少能力的提供方、或目标模型没有存活服务器时,返回 OpenAI 风格 503 信封;解析失败用带类型错误串的 400/404/503。路由决策能诚实回答的问题,绝不抛进 webserver 的逐请求守卫。

## 备选方案

- **在 `ModelLoadState` 上扩展端点字段** —— 拒绝:这会改动 S1 已消费的落地接缝类型,让每次状态发射都携带只有服务型消费方才需要的连接事实。
- **配置声明静态上游 URL** —— 拒绝:服务与加载状态解耦后,`/v1/models` 会宣传服务器已死的模型,chat 会打向已关闭的端口。
- **插件自建独立 HTTP 服务器** —— 拒绝:Studio 已拥有一个监听生命周期(`webserver`),复制绑定/卸载/认证管线会把安全姿态分裂到两个套接字上。

## 后果

E6(embeddings)沿同一路由表扩展即可,无需另起传输。外部客户端现在以 `http://<webserver>/v1` 访问已加载模型;认证是一个共享 bearer token,直到部署需要身份体系。客户端断开的中止传播有真实套接字测试断言,SSE 透传不会悄悄退化为缓冲式代理。
