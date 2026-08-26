# Agent Note: Settings explanations ride the shared InfoHint tooltip

Status: implemented

English | [中文](2026-08-24-settings-info-hints.zh.md)

## Problem

Settings controls carried their explanations inconsistently. Plugin-card fields rendered a permanent hint paragraph under every input, which is noise on cards users rarely revisit, while the Models editor's API key, base URL, display name, and protocol fields had no explanation at all. Two surfaces in one settings panel taught two different conventions, and neither covered everything.

## Decision

`ui-primitives` ships `InfoHint`: the question glyph wrapped in the shared `Tooltip`, whose label doubles as the glyph's accessible name so assistive technology announces the explanation without any interaction.

- Plugin card `ValueField` and `SecretField` render their existing `hint` through `InfoHint` beside the label instead of as permanent text; an invalid draft keeps its inline error paragraph.
- `ProviderEditor` and `CustomProviderCard` attach `InfoHint` to the API key, base URL, custom display name, and custom protocol fields through new locale keys (`keyInputHint`, `baseUrlHint`, `customDisplayNameHint`, `customApiHint`, English and Chinese).
- General-section rows keep their visible description lines: row-level copy is part of the row's identity there, not clutter.

## Alternatives considered

- **Keep visible hint paragraphs everywhere.** Lost: permanent text is noise for values users set once, and it would still leave the Models editor unexplained.
- **Native `title` attribute tooltips.** Lost: unstyled, inconsistent delay, not reliably keyboard-focusable, and no viewport-aware positioning — all problems the shared `Tooltip` already solves.

## Consequences

Every settings form explains itself on hover or keyboard focus with one mechanism, and new fields adopt `InfoHint` rather than inventing hint rendering. The `Tooltip` remains the only bubble implementation.

## Verification

Focused vitest suites for `ui-primitives` (new `info-hint.client.spec.tsx`), `ui-settings-plugins` (rewritten field specs), and `ui-settings-models` pass together (821 tests); scoped `tsc -b` over the three packages and oxlint over their sources are clean.
