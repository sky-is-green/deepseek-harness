# @deepseek-ai/dsh-model-downloads

English | [中文](README.zh.md)

The ranged-download engine behind `ctx.models`: `resolveRemoteFile` probes a Hugging Face-compatible hub with HEAD (redirects followed, size and LFS-style sha256 etag captured), and `fetchToFile` streams the file into a `.part` sibling with Range resume, verifies integrity, then renames it into place. The package knows nothing about model catalogs or events; providers own those.

## Contract

- **Staging and placement**: bytes land in `<destinationPath>.part`; the final file appears only by atomic rename after verification. The destination's directory must exist; an existing final file is overwritten.
- **Resume**: when staging exists, a single `Range: bytes=<size>-` request continues it (the staged prefix is hashed too). A server that answers `200` instead forces one clean restart; `416` finalizes a complete-but-unrenamed part when size and digest agree and refuses a wrong-size part loud.
- **Integrity**: the hub-advertised sha256 (or an explicit `expectedSha256`) is checked after streaming; a mismatch deletes the placed file — known-wrong bytes are never left to resume onto.
- **Cancellation resolves, failures throw**: aborts at any stage settle `{ result: 'cancelled' }` and preserve staging; HTTP, filesystem, and integrity failures reject with the offending status or digest.
- **Progress cadence belongs to the caller**: the engine emits per-chunk samples plus one terminal sample; consumers throttle.

## Model Experience

### Download surface

#### What the model sees

Nothing directly: `fetchToFile` moves weight files into `<destinationPath>.part` only. Everything model-visible starts later, when a loaded server serves the completed file.

#### Token effect

No direct effect; downloads move weight files only and are invisible to the model until load.

#### KV Cache effect

None at this layer; weight movement precedes any KV cache.

## Known Limitations and Deferred Work

- **One hub, anonymous** — requests address a caller-provided base URL without credentials or mirror fallback policy; auth belongs to a seam no consumer exercises yet.
- **Single-stream transfers** — no parallel chunk fan-out for very large files over high-latency links.
- **No proxy/TLS customization** — transport uses ambient Node fetch defaults.
