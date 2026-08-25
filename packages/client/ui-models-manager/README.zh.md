# @deepseek-ai/dsh-client-ui-models-manager

[English](README.md) | 中文

Web 客户端插件，贡献"本地模型"设置区块，走 `ctx.models` 缝（`dsh-models`）：目录卡片带架构/量化/体积元数据与实时加载状态徽标，Load/Unload 动作路由到 `requestLoad`/`requestUnload`，进行中的下载行带确定型进度条（服务端未报告总量时为不定态）与取消操作，另有一个启动 Hugging Face GGUF 下载的小表单。区块的读模型是一个裸快照存储，由服务的 `models/catalog-updated`、`models/load-state`、`models/download-*` 事件流经槽位 hooks 舱镜像而来——组件从不轮询、也不接触 ctx。

仅当挂载了 models 服务提供者时本区块才出现：否则对 `models` 的注入保持挂起。取消逻辑持有自己的句柄映射，因此只有本客户端发起的下载可取消；经 `downloads()` 发现的行不提供取消。

## 组装

注册为有序的 `settings.section` 条目（`local-models`，order 11，与远程提供商模型区块并列）；不改 SlotMap。

```yaml
- id: ui-models-manager
  name: '@deepseek-ai/dsh-client-ui-models-manager'
```

## Model Experience

### 本地模型管理区

#### What the model sees

自身无：本区块只渲染并驱动模型缝；目录条目与加载状态对会话的影响以提供者文档为准。



#### Token effect

此区块本身为零。所服务模型的选择会影响 provider 文档中关于上下文上限的说明，但该 UI 不计入或不发送任何 token。

#### KV Cache 影响

无；本插件从不组装或发送提供商请求。加载模型会改变后续请求由哪些本地权重服务——这些语义由提供者负责。

## 已知限制与延期工作

- **尚无提供者发布**——在 Lane A 的本地托管提供者（E4）挂载之前，所有组装按设计都不渲染本区块。
- **取消仅限本客户端**——在其他标签页或宿主 CLI 发起的下载，需等缝隙长出按 id 取消的能力后才能在此取消。
- **容量预估延期**——硬件感知的"需要 X，剩余 Y"指引将在 S2、待 E2/E3 数据经此缝隙流动后落地。
