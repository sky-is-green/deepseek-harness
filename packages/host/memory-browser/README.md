# `@deepseek-ai/dsh-host-memory-browser`

Memory browser endpoints — inspect, pin, delete, edit retained entries (X13, depends on X7).

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
