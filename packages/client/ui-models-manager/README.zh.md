# @deepseek-ai/dsh-client-ui-models-manager

[English](README.md) | 中文

Web 客户端插件，贡献"本地模型"设置区块，走 `ctx.models` 缝（`dsh-models`）：目录卡片带架构/量化/体积元数据、实时加载状态徽标与硬件感知的容量预估（"需要 4.0 GB · 你有 8.0 GB · 可加载/显存/内存不足"，取 `hardware()` 中最大显存设备或系统内存与文件体积对比），Load/Unload 动作路由到 `requestLoad`/`requestUnload`，进行中的下载行带确定型进度条（总量已知时显示预估）与取消操作，另有一个启动 Hugging Face GGUF 下载的小表单。区块的读模型是一个裸快照存储，由服务的 `models/catalog-updated`、`models/load-state`、`models/download-*` 事件及一次 `hardware()` 探测经槽位 hooks 舱镜像而来——组件从不轮询、也不接触 ctx。

仅当挂载了 models 服务提供者时本区块才出现：否则对 `models` 的注入保持挂起。探针未就绪前显示"硬件未知"；取消逻辑持有自己的句柄映射，因此只有本客户端发起的下载可取消；经 `downloads()` 发现的行不提供取消。

## 组装

注册为有序的 `settings.section` 条目（`local-models`，order 11，与远程提供商模型区块并列）；不改 SlotMap。

```yaml
- id: ui-models-manager
  name: '@deepseek-ai/dsh-client-ui-models-manager'
```

## Model Experience

### 本地模型管理区

#### What the model sees

自身无任何内容：本区块渲染并驱动模型缝，因此目录条目、加载状态（`loadState`）与下载进度都是对提供者状态的镜像。Load/unload/download 动作改变未来请求由哪些本地权重服务，但此处不添加任何请求内容。

#### Token effect

此区块本身为零。所服务模型的选择会影响 provider 文档中关于上下文上限的说明，但该 UI 不计入或不发送任何 token。

#### KV Cache 影响

无；本插件从不组装或发送提供商请求。加载模型会改变后续请求由哪些本地权重服务——这些语义由提供者负责。

## 已知限制与延期工作

- **尚无提供者发布**——在 Lane A 的本地托管提供者（E4）挂载之前，所有组装按设计都不渲染本区块。
- **取消仅限本客户端**——在其他标签页或宿主 CLI 发起的下载，需等缝隙长出按 id 取消的能力后才能在此取消。
- **容量预估仅对比文件体积**——将 `sizeBytes`/`bytesTotal` 与最大显存设备（或系统内存）对比，不计 KV 缓存/上下文长度开销；相等体积判为可加载，未知硬件显示"硬件未知"。
