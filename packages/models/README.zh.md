# models

[English](README.md) | 中文

HiveBench Studio 的本地模型托管：模型目录与生命周期 seam（`ctx.models`），以及其提供方与 UI 所依赖的 GGUF 元数据读取器。

| 包 | 负责 |
|---|---|
| [`models`](./models/README.zh.md) | 托管 seam（`ctx.models`）的 Service Definition：目录、硬件摘要、加载／卸载请求、下载句柄及其类型化事件 |

Provider 在 llama.cpp 风格的运行时之上实现该 seam；消费方（模型管理卡片、容量估算器、入站端点）读取同一套类型化表面。
