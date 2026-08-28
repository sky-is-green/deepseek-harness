# Agent Note: U4 CI 验证 — 目录、JSDoc、README 与配对

Status: implemented

[English](2026-08-28-U4-ci-verification.md) | 中文

## 问题

Round 3（E3 `dsh-model-downloads` + E4 `models-local` + E5 `openai-endpoint`）已落在 `hive-studio@28a69fa192`，但 `doc-sync` 仍红：`gen-config-catalog` 因 `host/openai-endpoint` 的 `inject as const` 拒绝，`gen-doc-graphs`/`gen-module-graph` 对新包过期，`verify-export-jsdoc` 标记两处未文档化导出，`verify-package-readme-model-experience` 判定两新包为非结构化，`verify-translation-pairing` 对 12 个配对过期（新 E3 笔记缺失、docs 与 README 不同步）。`pnpm-lock.yaml` 也需在 provider 合并后单独提交。

## 决策

- **热点 lockfile** `67da63c822` 单独提交。
- **生成目录** `b81acca998`/`b306103f42`/`4fbae7b13a` — 分别单独提交 `gen-config-catalog` + `gen-doc-graphs`（8 份）+ `gen-module-graph` 的热点 en 文件；zh 对侧（`config-catalog.zh.md`、`module-graph.zh.md`）从 en 重建并做 locale 链接修正，随后 `verify-translation-pairing --write` 重新记录。
- **JSDoc** `89f1ea4b29` — `model-downloads/src/fetch-file.ts:18` `partPathFor` 补充 `@param`/`@returns`，`FetchToFileOptions` 补充接口 JSDoc，`models-local/src/index.ts:198` `serveEndpoint` 补充 `@param modelId`/`@returns`。
- **README** — `host/openai-endpoint` 增加结构化 `### OpenAI serving surface` 条目（含 `` `POST /v1/chat/completions` `` 与 `` `pipeline()` `` 具象）；`model-downloads` `### Download surface` 改为 `No direct effect;` 句式并加入 `` `fetchToFile` `` 行内代码以满足结构化条目字面量规则。同步更新 zh 镜像。
- **翻译配对** — 新建 `.agents/notes/implemented/feature/2026-08-26-engine-E3-download-manager.i18n.yaml` 并通过 `--write --all` 重录 11 个配对。

## 后果

`verify-config-catalog`、`verify-doc-graphs`、`verify-module-graph`、`verify-export-jsdoc`、`verify-package-readme-model-experience`、`verify-translation-pairing` 全部通过（`1045 pairs consistent`）。无新增运行时行为；本次为 Round 4 的门禁卫生。`examples/acp-demo`/`jsonrpc-demo` 的 `ENOENT` bin 警告仍在——`pnpm run build` 生成 `lib/bin.js` 后即消失，非 U4 门禁。

## 验证

- `pnpm vitest run packages/models/model-downloads packages/models/models-local packages/host/openai-endpoint` — 36 通过。
- `pnpm exec tsc -b packages/host/openai-endpoint packages/models/model-downloads packages/models/models-local` — clean。
- `pnpm exec oxlint` — 触及文件 0 错误。
