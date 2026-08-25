# Agent Note: 包脚手架生成 cookbook 宿主骨架

Status: implemented

## Problem

X12 要求生成器输出 cookbook 包骨架。手工新增宿主包意味着复制邻居包并调整六个清单不变量（`constraints` 强制精确的 `files` 列表、顶层与 exports 的 `types` 拼写、release 成员字段、peer/dev 镜像），而本次会话的每个新包都在首次运行时踩中其中至少一道门。

## Decision

`scripts/scaffold-package.ts`（根脚本 `scaffold-package`）将 cookbook 第 1 节的宿主包骨架生成到 `packages/<group>/<pkg>/`：内置全部 constraints 不变量的清单、带 cookbook 引用的 tsconfig（`--config` 时含 cosmokit/cordis/schemastery，另加 invariants）、经 `--kind` 选择的插件或服务版 `src/index.ts`、有理由为空的 invariant 伴随件，以及带必需 Model Experience / Known Limitations 章节的 README 存根。它拒绝已存在目录与非法 kebab-case，并打印无法安全生成的手动步骤：聚合引用行、未覆盖组的 base-paths 条目（见 xray-2026-08-25 笔记）、TODO 填写与各门命令。

证明义务是实时运行的：先生成到一次性目录、注册进聚合，三道门（constraints、逐包 `tsc -b`、范围 oxlint）在任何人手改动前即退出 0——开发期间已验证，随后删除。

## Alternatives considered

- 同时生成客户端插件骨架：推迟——客户端契约（dsh.client 清单、模块图 external、静态与动态面）在 packages/client/AGENTS.md 下有自己的清单；并入同一模板会在只有一个消费者时让表面翻倍。
- 自动写入聚合/tsconfig 注册：否决——这些文件是热点锁；生成器写入会绕过看板强制的单提交协议。
- 用 vitest 断言模板输出：否决——scripts 不在覆盖平面内；实门证明比金文件相等更强，后者只会镜像模板。

## Consequences

清单不变量的知识现在归模板所有，漂移表现为新生成包的门失败，而不是口口相传的"复制邻居"知识。生成器对手动步骤刻意保持提示——静默注册曾是备选方案，但热点必须保持人工提交。
