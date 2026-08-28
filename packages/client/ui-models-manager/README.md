# @deepseek-ai/dsh-client-ui-models-manager

English | [中文](README.zh.md)

Web client plugin contributing the local-models settings section over the `ctx.models` seam (`dsh-models`): catalog cards with architecture/quantization/size metadata, live load-state badges, and hardware-aware fit estimation ("Needs 4.0 GB · You have 8.0 GB · Fits/Too large") derived from `hardware()` (largest VRAM-bearing device or system RAM) vs file size, Load/Unload actions routed to `requestLoad`/`requestUnload`, running-download rows with determinate progress bars (indeterminate while the server reports no total), fitted needs when `bytesTotal` is known, and cancellation, plus a small form that starts Hugging Face GGUF downloads. The section's read model is a bare snapshot store mirrored from the service's event stream (`models/catalog-updated`, `models/load-state`, `models/download-*`, `hardware()` once) through the slot hooks compartment — components never poll or touch ctx.

The section only mounts when a models Service Provider is present: the inject on `models` stays pending otherwise. Hardware renders "Hardware unknown" until the probe resolves; cancellation keeps its own handle map, so only downloads started from this client are cancellable; rows discovered via `downloads()` render without one.

## Composition

Registered as an ordered `settings.section` entry (`local-models`, order 11, beside the remote-provider models section); no SlotMap changes.

```yaml
- id: ui-models-manager
  name: '@deepseek-ai/dsh-client-ui-models-manager'
```

## Model Experience

### Local-models manager section

#### What the model sees

Nothing of its own: the section renders and drives the models seam, so catalog entries, load states (`loadState`), and download progress mirror provider state. Load/unload/download actions change which local weights serve future requests without adding request content here.

#### Token effect

Zero from this section. The served-model choice influences what the hosting provider documents for context limits, but no tokens are counted or sent by this UI.

#### KV Cache effect

None; the plugin never assembles or sends provider requests. Loading a model changes which local weights serve future requests — the provider owns those semantics.

## Known Limitations and Deferred Work

- **No provider ships yet** — until Lane A's local hosting provider (E4) mounts, every assembly renders without this section by design.
- **Cancellation is client-local** — downloads started elsewhere (another tab, the host CLI) cannot be cancelled here until the seam grows an id-addressed cancel.
- **Fit estimator is file-size only** — it compares `sizeBytes`/`bytesTotal` to the largest VRAM-bearing device (or system RAM) with no KV-cache / context-length overhead; equal sizes report Fits, and unknown hardware reports "Hardware unknown".
