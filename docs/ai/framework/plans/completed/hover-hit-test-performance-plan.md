# Hover Hit-Test Performance Plan

## Status

Completed on February 22, 2026 (archived branch-backfill reference).

## Goal
Define when and how to scale hover hit-testing beyond the current O(N) bounds scan.

## Trigger Conditions
Use these thresholds to decide when to implement spatial indexing:

- Element count consistently above 10k.
- Measured hover hit-test cost exceeds 1–2 ms per `input.mouse.move` on target hardware.
- User-visible pointer lag or dropped frames during hover/selection.

## Baseline (Current)
- Per-mouse-move hit-test iterates all elements and checks bounds.
- Draw-order is resolved in memory by scene-tree traversal order.

## Proposed Plan
1. Add lightweight instrumentation
- Measure average and p95 hit-test duration per frame.
- Log metrics only in dev builds or behind a debug flag.

2. Introduce a spatial index
- Maintain a grid index keyed by element bounds.
- Index buckets by workspace coordinates; size tuned to typical element size.
- Update buckets on element move/resize.

3. Update hit-test flow
- Convert client to workspace position.
- Query buckets for candidate ids.
- Apply z-order filtering on candidates only.
- Keep existing fallback for empty index state.

4. Add throttling option
- If mouse moves faster than render tick, skip intermediate hit-tests.
- Optional: coalesce events to latest position per frame.

5. Validate
- Compare hit-test results to baseline for correctness.
- Ensure hover/selection behavior unchanged.

## Notes
- This should stay render-agnostic.
- Prefer scene-tree or a dedicated hover index in core, not app-level.
- Keep container traversal rules aligned with selection behavior.
