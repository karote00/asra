# Plan: Vector Geometry Consistency Helper

## Goal

Introduce a geometry helper that keeps vector topology and curve control relationships consistent during all vector edits.

## Context

Vector editing uses the `points + segments + networks` topology contract. Today, point edits and topology edits are handled across multiple mutation paths, which makes it easy to miss related updates such as:
- moving curve handles when an anchor point moves
- repairing segment/network relationships when points are inserted or removed
- maintaining handle mode/type invariants after edits

The goal is to centralize these invariant updates behind a single, deterministic helper so app features and render logic remain simpler and consistent.

## Scope

In scope:
- define a geometry consistency layer that updates dependent point/segment/network relationships for every vector mutation
- ensure anchor translation updates connected `inHandle`/`outHandle` positions in the same transaction
- ensure add/remove/split/connect operations update segment links and network membership deterministically
- ensure handle edits respect handle-mode constraints and point type rules
- keep all mutations routed through `elementApis` (no direct feature-layer mutation)

Out of scope:
- persistence schema changes
- new UI or tool behavior changes not required for geometry consistency
- render-layer refactors unrelated to vector topology

## Target Behavior

1. Anchor movement
- updating an anchor position translates its attached handles by the same delta
- handle updates are transaction-bounded with the anchor change
- handle translations do not change handle mode or point type

2. Handle movement
- updating `inHandle` or `outHandle` moves only that handle unless mode requires coupled behavior
- handle mode rules are enforced (`mirror-angle`, `mirror-angle-length`, `none`)
- handle updates preserve selection target (`anchor` vs `inHandle` vs `outHandle`)

3. Handle mode changes
- switching to `none` removes existing handle nodes deterministically
- switching to mirror modes creates/updates both handles as required
- handle mode changes never mutate anchor position

4. Point insertion
- inserting a point updates segment endpoints and network ownership consistently
- insertion preserves subpath continuity and closed/open status
- split-point insertion respects original segment geometry (line vs cubic)

5. Point deletion
- deleting a point updates/removes adjacent segments as needed
- network/subpath membership is repaired deterministically
- deleting the last point of a subpath removes that subpath cleanly
- deleting the last point of a network removes the network entry

6. Segment edits
- splitting a segment creates a new anchor with valid handle defaults
- removing a segment updates adjacency and subpath start/end pointers

7. Subpath and network edits
- connecting endpoints updates network closed status and segment continuity
- toggling closed/open state updates network metadata without duplicating segments
- start-new-subpath state is preserved across append/remove operations

8. Computed geometry synchronization
- bounds and derived geometry are recomputed from updated topology in the same transaction
- render-layer and hit-testing queries never observe partial topology writes

9. Selection/hover safety
- if a selected/hovered point or segment is deleted, selection/hover state is cleared deterministically
- selection stays on the editing vector when path-editing mode is active

10. Deterministic updates
- a single user action produces a single undo unit
- mutations never leave transient topology states visible to render/UI

## Proposed Direction

1. Geometry consistency helper (app-owned)
- provide utilities for:
  - `translateAnchorAndHandles(...)`
  - `updateHandleWithMode(...)`
  - `setHandleModeAndRepair(...)`
  - `insertPointAndRepairTopology(...)`
  - `splitSegmentAndRepairTopology(...)`
  - `removePointAndRepairTopology(...)`
  - `connectEndpointsAndRepair(...)`
- keep helpers pure where possible; only apply mutations in `elementApis`

2. Mutation boundaries
- route point and handle updates through `elementApis` so transactions stay grouped
- ensure selection/path-editing cleanup happens after topology repair, not before

3. Validation and fallback
- if a topology repair fails (invalid segment references), fail fast with explicit error
- avoid silent partial writes

## Implementation Slices

1. Define invariants and helpers
- document the exact topology invariants for points, segments, and networks
- implement pure geometry helper functions that compute required changes

2. Update point movement paths
- use helper to compute handle translations during anchor moves
- ensure `updateVectorAnchorPointPosition` applies handle updates in the same transaction

3. Update handle paths
- apply handle-mode rules in `updateVectorAnchorPointHandlePosition` and `setVectorAnchorPointHandleMode`
- ensure selection target and handle mode remain consistent

4. Update insert/remove paths
- apply insert/remove helpers in `appendVectorAnchorPoint`, `splitVectorSegmentAtWorkspacePos`, and `removeVectorAnchorPoint`
- validate network/subpath consistency after mutation

5. Verification
- add focused unit tests around helper outputs (if app test harness exists)
- manual verification: move anchor with handles, drag handle in each mode, insert point mid-segment, delete interior point on open/closed subpath, connect endpoints

## Success Criteria

- anchor moves always translate connected handles
- handle edits follow handle-mode rules consistently
- segment/network relationships remain valid after insert/delete operations
- undo groups the full geometry update as a single unit
- no regressions in pen/path editing behavior

## Risks

1. Invariant drift
- if helper logic diverges from render or selection expectations, behavior may appear inconsistent

2. Performance impact
- additional topology repair steps could add overhead on large vectors

3. Contract creep
- helper scope must stay tight to avoid becoming a second geometry engine
