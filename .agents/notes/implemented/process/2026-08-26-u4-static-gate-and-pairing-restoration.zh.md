# Agent Note: U4 静态门禁与双语配对修复

Status: implemented

[English](2026-08-26-u4-static-gate-and-pairing-restoration.md) | 中文

## Problem

fork 上的 PR #2（`hive-studio` → `master`）在静态门禁家族全面飘红：翻译配对拒绝了十二份在册文档，所有 lane 手写的 note 缺少对应语言或配对记录；三份生成目录落后于已合并的 engine 包；子系统索引漏掉新的 `models.md` 页面；knip 指出未登记的二进制；生产站点构建与自身上一次的 twin 输出相撞；claims gate 拒绝合法的 hotspot 提交。

## Decision

- **配对语料恢复全绿（1040 对）。** 每个 lane 手写的 Agent Note 现在都带双侧 switcher 与 `.i18n.yaml` 记录；六份包 README 补齐中文对应版；四对漂移的文档（`ui-live-metrics`、`ui-models-manager`、`dsh-bench`、`dsh-hive`）重新对齐英文侧；五份生成目录的中文侧镜像其重新生成的表格、列表、链接、mermaid 围栏与粘贴的类型声明。
- **生成目录过期从源头修复。** `gen-config-catalog.ts` 会拒绝它无法解析的 `inject` 数组；`packages/models/models-local/src/index.ts` 现在按惯例声明普通数组 `static inject = ['subprocess']`（既有 37 个包均如此），而不是教生成器认识一次性的 `as const` 形态。`gen-module-graph.ts` 与 `gen-doc-graphs.ts` 各管各的文件，需分别运行。
- **站点构建可重复。** raw-Markdown twin 拒绝覆盖非自己认领的文件，因此上一次构建遗留的 `website/.dist` 会让下一次构建失败；`docs:build` 与 `docs:build:mpa` 现在在调用 VitePress 前先删除 `website/.dist`。VitePress 自身的 `emptyOutDir` 在本树上未生效。
- **claims gate 缺陷修复**（`scripts/check-claims.mjs`，本任务拥有）：hotspot alone-check 用 glob 匹配根锚定的 hotspot（`'/package.json'`），导致 hotspot 提交永远装不下自己的文件；成员判断现在与检测共用同一谓词。裸 `**` glob 因替换结果被重扫而退化为 `.[^/]*`；改为单趟 token 化。
- **外来树的处理：** 被弃置的 S8 `command-kill` 脚手架（从未注册、从未编译）被隔离出 `packages/`，让包级门禁只扫描真实存在的包；`gh` 加入 knip 的 `ignoreBinaries` 以支持运维采集脚本。

## Alternatives considered

- 教 `gen-config-catalog.ts` 解开 `as const` inject 数组 — 否决：只有一个包偏离了其余 37 个；生成器的报错信息本来就点名了这条惯例。
- 整篇重译生成目录 — 否决：配对契约要求对照被编辑一侧做最小修补；目录单元格是生成器拥有的字面量，只有说明性散文需要翻译。

## Consequences

fork 的静态门禁再次有了干净的本地基线；本地仅剩的红是已被记录的 `EPERM symlink` 宿主沙箱类别，归 CI 所有。目录再生成现在要求同一次变更内完成中文侧同步——这正是 freshness 门禁一贯的要求。被隔离脚手架的来源与内容清单记录在协调计划的 working notes 里，由其所有者取回或删除。
