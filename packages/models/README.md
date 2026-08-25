# models

English | [中文](README.zh.md)

Local model hosting for HiveBench Studio: the model catalog and lifecycle seam (`ctx.models`) plus the GGUF metadata reader its providers and UI build on.

| Package | Owns |
|---|---|
| [`models`](./models/README.md) | Service Definition for the hosting seam (`ctx.models`): catalog, hardware summary, load/unload requests, download handles, and their typed events |
| [`gguf-metadata`](./gguf-metadata/README.md) | Dependency-free GGUF header reader: architecture, quantization, context length, chat template |
| [hardware-probe](./hardware-probe/README.md) | Host compute detection for fit estimates: NVIDIA/Apple/Vulkan devices plus system RAM |

Providers implement the seam over llama.cpp-style runtimes; consumers (model manager cards, fit estimators, the inbound endpoint) read the same typed surface.
