# @deepseek-ai/dsh-hardware-probe

[English](README.md) | 中文

支撑 `ctx.models` 容量估算的主机算力检测：经 `nvidia-smi` 的 NVIDIA GPU（backend `cuda`，VRAM 字节数）、作为单一统一内存 Metal 设备的 Apple 芯片、经 `vulkaninfo --summary` 的 Vulkan 适配器，以及在没有其他结果时的 CPU 条目。每个检测缝都可注入，因此测试可离线运行，嵌入方也可替换自己的主机事实。

## Model Experience

### 硬件探测面

#### What the model sees

无：探测结果通过调用方服务于适配估算与 UI 卡片；不贡献提示词内容，也不注册工具。

#### Token effect

无直接影响；容量决策留在调用方。返回的 `HardwareSummary`（`devices[]` 与 `totalRamBytes`）用于调用方的适配估算，而非提示词。

#### KV Cache effect

无；探测器不持有任何请求状态。

## 约定

- **检测跳过而非失败。** 缺失或出错的检测器（`nvidia-smi`、`vulkaninfo`）不贡献任何内容，也绝不会让探测失败。检测信息缺失是常态——驱动、SDK 工具与平台各不相同。
- **系统 RAM 始终报告**（默认环境取 `os.totalmem()`）；容量估算器总能据此衡量。
- **纯 CPU 主机也有条目**：未检测到独立设备时，输出一个 `cpu` 设备，并在主机提供时携带 CPU 型号名。
- **Apple 芯片把统一内存报告为设备内存**，Metal 的内存数值等于总 RAM 是设计使然。
- **vulkaninfo 条目不带内存数值**——vulkaninfo 不报告 VRAM；NVIDIA 条目报告。
- 每条命令限时运行（各 5 秒），并使用 subprocess seam 清理后的父环境；本库无法路由经 `ctx.subprocess`，故直接导入共享清理定义。

## 模型体验

### 检测表面

#### 模型看到什么

什么都看不到：探测经调用方为容量估算与 UI 卡片提供信息；它不贡献提示内容，也不注册工具。

#### Token 影响

无直接影响；容量决策仍归消费方所有。

#### KV Cache 影响

无；探测不拥有任何请求状态。

## 已知限制与暂缓事项

- **尚无 AMD／Intel 独立显存读取**——Windows WMI 把适配器内存封顶在 4GB 以下，ROCm 没有稳定的 CLI；在可靠来源出现前，Vulkan 适配器不带 VRAM 报告。
- **尚无结果缓存**——每次调用都重新运行检测器；未来的本地 provider 应按进程缓存一次（`ModelsRuntime.hardware` 已声明结果进程内静态）。
