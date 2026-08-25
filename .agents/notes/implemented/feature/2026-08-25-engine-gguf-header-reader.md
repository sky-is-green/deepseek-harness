# Agent Note: The GGUF reader parses headers only and keeps Node I/O off the main entry

Status: implemented

English | [中文](2026-08-25-engine-gguf-header-reader.zh.md)

## Problem

Fit estimators (S2), the download manager (E3), and the model manager cards (S1) all need GGUF facts — architecture, quantization, context length, chat template — before any model loads. Reading them naively means loading multi-GB weight files into memory or pulling a heavy runtime dependency for what is a few kilobytes of header.

## Decision

`@deepseek-ai/dsh-gguf-metadata` ships a dependency-free header parser. Two choices are worth revisiting-proof:

- **Header-only streaming parse.** The parser walks the key-value section once over a `GgufByteSource` cursor, materializing only captured fields and skipping array payloads by arithmetic; every read is bounded against fixed spec-derived caps so hostile or corrupt headers fail loud. Tensor-list contents stay unread by design.
- **Browser-safe main entry, node subpath for files.** `.` exposes bytes-in/metadata-out with zero Node builtins so client-side consumers share the exact parser; `./node` adds positioned file reads over a sliding window. Subpath defaults point at the tsc-emitted tree (`lib/types/node.js`) per the workspace constraints' recognized extra-entry pattern.

Unsupported container versions (v1), unknown value tags, nested arrays, oversized counts, and truncation all reject with `GgufError`; absence of a field stays observable in `GgufMetadata`.

## Alternatives considered

- **Reuse a npm GGUF parser** — none maintained covered v2/v3 header-only reads with skipping semantics; hand-rolling here deletes no owned code and the format section parsed is ~200 lines.
- **One entry with dynamic `node:fs` import** — rejected: it forces bundlers to stub builtins and lets an accidental server-only import leak into the client graph.
- **Return the raw key-value map** — rejected: vocab arrays make naive retention unbounded, and no consumer needs more than the six surfaced fields today.

## Consequences

E3 can verify completed downloads cheaply and S2/S1 get fit-estimate inputs without runtime dependencies. New upstream `LLAMA_FTYPE_*` members extend the label table; unknown values already degrade to the documented `ftype-N` rendering rather than failing.
