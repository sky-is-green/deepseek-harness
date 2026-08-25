# Agent Note: 硬件检测跳过看不见的部分，而不是失败

Status: implemented

[English](2026-08-25-engine-hardware-probe-skip-on-failure.md) | 中文

## Problem

容量估算（「需要 6.2 GB，你有 8 GB」）与模型管理卡片需要主机算力事实——GPU、VRAM、总 RAM——而机器横跨单 NVIDIA GPU 桌面机、仅 AMD／Vulkan 的主机与 Apple 笔记本。检测工具因平台差异极大（`nvidia-smi`、`vulkaninfo`、统一内存），工具缺失是常态而非错误。

## Decision

`@deepseek-ai/dsh-hardware-probe` 是构建在可注入 `ProbeEnvironment`（平台、架构、RAM、PATH 查找、限时命令执行器）之上的纯库。其语义：

- **失败即跳过**：缺失或崩溃的检测器不贡献设备；只有中止信号会让探测失败。信息缺失按缺失上报。
- **总 RAM 始终报告**，估算器永远有分母。
- **纯 CPU 主机得到一个 `cpu` 条目**（已知时带型号名）而非空列表，UI 因此不会渲染出「无设备」。
- **Apple 芯片 = 一个 Metal 设备，内存等于总 RAM**（统一内存）；**vulkaninfo 条目不带 VRAM**，因为 vulkaninfo 不报告它；**NVIDIA 条目带 VRAM**，解析自 CSV 并处理带引号的名称。
- 默认命令执行器使用 subprocess seam 的共享父环境清理——这个生成方无法路由经 `ctx.subprocess`（它是普通库），故按该包公布的逃生口直接导入 `scrubbedParentEnv`。

Python 参考实现以显式配置选择 backend（`backend: vulkan|rocm|cuda|cpu` 指向预置二进制），不做探测；本包补上 TS 侧自动容量估算所需的检测层。

## Alternatives considered

- **做一个 `ctx.hardware` 服务** — 否决：当前唯一消费方就是未来本地 provider 的 `ModelsRuntime.hardware()` 实现；只有一个内部调用者的公开服务正是包规则点名的 seam 反模式，因此该能力作为库闭包输入交付。
- **检测器损坏时响亮失败** — 否决：驱动更新或 SDK 工具缺失会让每次启动都为其余主机仍能提供的信息而失败；models seam 把未知硬件视为更保守的容量声明，而非错误。
- **Windows 上经 WMI／注册表读 AMD／Intel VRAM** — 暂缓：WMI 的 `AdapterRAM` 封顶 4GB（对每张现代独显都是错的），报告它比什么都不报更糟。

## Consequences

E4 的 provider 以一次缓存的 `probeHardware()` 实现 `hardware()`；S1/S2 渲染真实设备并保留诚实的缺口（在可靠来源出现前 Vulkan 显卡不显示 VRAM）。新检测器沿同一跳过式失败模式接入 `probe.ts`。
