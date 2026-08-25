# Studio S17: load/unload failures always reach the card; activity is an indeterminate bar

- **Date:** 2026-08-25
- **Domain/Task:** studio / S17
- **Status:** implemented

## Interfaces & hooks

- `ui-models-manager` inject face unchanged in shape; behavior changed: `requestLoad`/`requestUnload` rejections are no longer swallowed — each rejection is mirrored into the read model as `{ status: 'failed', message }` for that model id, exactly the shape the service's own failed event uses. The card therefore always shows a badge + reason on failure, whether the provider reported it or the call never reached it.
- Component: while `loading`/`unloading`, the card renders an animated indeterminate progress bar (reuses the download bar styles); the redundant separate busy label was removed — the state badge already carries the copy.

## Models

No seam changes and no new events. A determinate load-progress bar would require a new `models/load-progress` typed event from providers (engine/E4 follow-up); documented as a known limitation rather than fabricated client-side.

## Verification

12/12 package tests (new: indeterminate activity bar during loading; rejected load mirrored to failed state with message), scoped oxlint clean, per-package `tsc -b` clean, README pair re-recorded.
