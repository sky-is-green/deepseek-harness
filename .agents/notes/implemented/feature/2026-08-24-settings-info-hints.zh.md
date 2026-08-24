# Agent Note: Settings explanations ride the shared InfoHint tooltip

Status: implemented

[English](2026-08-24-settings-info-hints.md) | 中文

## 问题

设置控件对自身解释的呈现并不一致。插件卡片的每个输入框下方都渲染常驻的提示段落——对于用户很少再次调整的设置，这是视觉噪音；而「模型」编辑器的 API 密钥、API 地址、显示名称与协议字段则完全没有解释。同一设置面板中的两个界面遵循两种不同约定，且任何一种都没有覆盖全部字段。

## 决策

`ui-primitives` 提供 `InfoHint`：包裹在共享 `Tooltip` 中的问号图标，其 label 同时作为图标的可访问名称，因此辅助技术无需任何悬停交互即可朗读解释。

- 插件卡片的 `ValueField` 与 `SecretField` 将既有的 `hint` 通过 `InfoHint` 渲染在标签旁，不再使用常驻文本；草稿无效时仍保留内联错误段落。
- `ProviderEditor` 与 `CustomProviderCard` 通过新增的 locale 键（`keyInputHint`、`baseUrlHint`、`customDisplayNameHint`、`customApiHint`，中英双语）为 API 密钥、API 地址、自定义显示名称与自定义协议字段挂载 `InfoHint`。
- 「通用」分区的各行保留其可见描述文字：行级文案是该行身份的一部分，而非噪音。

## 曾考虑的替代方案

- **在所有位置保留可见提示段落。** 落选：对一次设置后很少再动的值而言，常驻文本是噪音，且模型编辑器仍将缺乏解释。
- **原生 `title` 属性提示。** 落选：无样式、延迟不一致、键盘焦点不可靠，也没有视口感知的定位——这些是共享 `Tooltip` 已经解决的问题。

## 后果

每张设置表单都以同一种机制在悬停或键盘聚焦时给出解释；新增字段直接采用 `InfoHint`，而不再自行发明提示渲染。`Tooltip` 仍是唯一的气泡实现。

## 验证

`ui-primitives`（新增 `info-hint.client.spec.tsx`）、`ui-settings-plugins`（重写的字段规格）与 `ui-settings-models` 的聚焦 vitest 套件共同通过（821 个测试）；三个包的 scoped `tsc -b` 与源码 oxlint 均无告警。
