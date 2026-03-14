# Plan: Render Delta Update Pipeline

## Goal

Use data-channel commit deltas directly in the render pipeline so render strategies
operate on cached element snapshots that are patched incrementally, avoiding full
rehydration of computed data on every change.

## Context

Current render updates re-fetch `element.save()` + `element.getAllComputedData()`
for every computed-data update. This full snapshot rebuild is costly during dense
vector edits and defeats the benefit of having precise change payloads in the
data channel. The render pipeline should apply deltas to a cached snapshot and
only recompute heavy geometry when relevant keys change.

## Scope

In scope:
- render-side element data caching and delta patch application
- render-store update path changes
- render strategy invalidation based on changed keys
- vector render strategy cache usage for topology/fill-driven recompute

Out of scope:
- changing scene-tree mutation semantics
- changing data channel schemas
- altering feature behavior or input-system flows

## Target Behavior

1. Render updates apply only the committed change payload (delta).
2. Render strategy receives a complete cached snapshot updated by deltas.
3. Heavy vector fill recompute runs only when topology/fill keys change.
4. Dragging points no longer rehydrates full computed data every frame.

## Implementation Slices

1. Render element cache
- Add `RenderElementData` cache per element id in render scene-tree store.
- Initialize on add/create and on first use.

2. Delta patching
- Apply data-channel deltas to cached snapshot (`cached[key] = after`).
- Avoid re-reading full computed data on update.

3. Strategy invalidation rules
- Track which keys changed and only recompute heavy work when needed.
- For vectors, treat `points`, `segments`, `networks`, `fills`, `strokeStyle`
  as heavy invalidators.

4. Vector render cache integration
- Keep flattened-segment/face caches per element and recompute only on invalidators.
- Preserve even-odd correctness and closed-path handling.

5. Validation + regression checks
- Add tests for render-store delta patching.
- Add tests for vector render strategy heavy recompute triggers.

## Risks

1. Cache drift if any change path bypasses delta updates.
2. Partial updates may miss dependent keys (e.g., `points` implies `networks`).
3. Incorrect invalidation may cause stale visuals.

## Success Criteria

- Dragging dense vectors avoids full computed-data rehydrate on every frame.
- Render output remains correct after load/undo/redo.
- No regression in non-vector render updates.
