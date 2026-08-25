# @deepseek-ai/dsh-client-ui-models-manager

English | [中文](README.zh.md)

Web client plugin contributing the local-models settings section over the `ctx.models` seam (`dsh-models`): catalog cards with architecture/quantization/size metadata and live load-state badges, Load/Unload actions routed to `requestLoad`/`requestUnload`, running-download rows with determinate progress bars (indeterminate while the server reports no total) and cancellation, plus a small form that starts Hugging Face GGUF downloads. The section's read model is a bare snapshot store mirrored from the service's event stream (`models/catalog-updated`, `models/load-state`, `models/download-*`) through the slot hooks compartment — components never poll or touch ctx.

The section only mounts when a models Service Provider is present: the inject on `models` stays pending otherwise. Cancellation keeps its own handle map, so only downloads started from this client are cancellable; rows discovered via `downloads()` render without one.

## Composition

Registered as an ordered `settings.section` entry (`local-models`, order 11, beside the remote-provider models section); no SlotMap changes.

```yaml
- id: ui-models-manager
  name: '@deepseek-ai/dsh-client-ui-models-manager'
```

## Model Experience

None of its own: the section renders and drives the models seam; catalog entries and load states affect sessions exactly as the provider documents them.

#### KV Cache effect

None; the plugin never assembles or sends provider requests. Loading a model changes which local weights serve future requests — the provider owns those semantics.

## Known Limitations and Deferred Work

- **No provider ships yet** — until Lane A's local hosting provider (E4) mounts, every assembly renders without this section by design.
- **Cancellation is client-local** — downloads started elsewhere (another tab, the host CLI) cannot be cancelled here until the seam grows an id-addressed cancel.
- **Fit estimation deferred** — hardware-aware "needs X, you have Y" guidance lands with S2 once E2/E3 data flows through this seam.
