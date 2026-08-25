# Agent Note: fork 新增包组需要在 base paths 中显式映射

Status: implemented

## Problem

Vitest 通过 `tsconfig.base.json` 的 `paths`（vite-tsconfig-paths 挂载该文件）解析裸工作区说明符，未映射的包会回退到 package-exports 解析——即构建产物 `lib/`。fork 新增的 `packages/hive` 与 `packages/runtime-diagnostics` 组没有条目，因此导入 `@deepseek-ai/dsh-hive` 的测试在“改了源码但没重新构建”时会静默执行过期的构建产物：测试对着旧代码通过，随后又在一次无关的全量构建后“神秘地”改变行为。通配符 `"@deepseek-ai/dsh-*"` 帮不上忙：其替换按顺序尝试，目录列表里缺失的组得不到匹配；而把组加进通配符在实践中也无法完成解析（只有逐包显式条目有效，与 `api`、`typert` 的既有做法一致）。

## Decision

在 `tsconfig.base.json` 中为两个新组的每个包补上显式 source 映射，遵循 `api`/`typert` 先例：

- `@deepseek-ai/dsh-hive` → `packages/hive/dsh-hive/src`
- `@deepseek-ai/dsh-bench` → `packages/hive/dsh-bench/src`
- `@deepseek-ai/dsh-failure-forensics` → `packages/runtime-diagnostics/failure-forensics/src`

今后的规则：新增包若其所属组不在 `"@deepseek-ai/dsh-*"` 通配符内，必须在同一个 PR 里补显式 `paths` 条目（裸名加上测试或静态门会导入的子路径）。证明义务只有一条命令：把该包的 `lib/` 藏起来再跑它的测试套件，必须仅靠源码通过。

## Alternatives considered

- 扩展 `"@deepseek-ai/dsh-*"` 通配符纳入新组：尝试过；解析仍然落到 `lib/`，这样的数据只是记录了工具链并不提供的覆盖。
- 让 vitest 经自定义 resolver/alias 优先取 `src/index.ts`：否决——这会分叉仓库唯一的解析门面，使静态门与测试运行时背离。

## Consequences

这些包的测试与静态门从此总是执行源码，过期的 `lib/` 无法再掩盖或伪造行为；`lib/` 只对刻意消费构建产物的 Loader/运行时消费者保持意义。在未覆盖组内新增的下一个包仍可能再次踩中此坑——在上面的显式条目规则被生成器接管之前，它就是防线。
