---
description: "Memory browser endpoints - inspect, pin, delete, edit retained entries"
kind: "package-reference"
---

# `@deepseek-ai/dsh-host-memory-browser`

## Summary

Memory browser endpoints — inspect, pin, delete, edit retained entries (X13, depends on X7).

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Endpoints

- `GET /v1/memory/inspect?id=<id>` — inspect one
- `POST /v1/memory/pin` `{id, pinned: boolean}` — pin/unpin
- `DELETE /v1/memory/delete?id=<id>` — delete
- `PATCH /v1/memory/edit` `{id, content: string}` — edit

In-memory `MemoryStore` — pure helpers `inspect`, `pin`, `delete`, `edit`, `list`.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- In-memory only — no persistence beyond process; X7's durable store will be wired when available
- No auth

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
