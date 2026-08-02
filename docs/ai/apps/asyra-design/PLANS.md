Never record completed plans here.

# App Plans

## Current Status

- Highest-priority active app plan:
  `plans/vector-local-geometry-transform-plan.md`.
- Active architecture authority:
  `plans/vector-local-geometry-transform-flow-inspector.data.cjs`.
- The accepted contract preserves existing persisted Vector values, derives
  engine-local geometry only inside Render, and routes whole-element
  move/dimension/rotation/scale/skew through fixed-size element updates without
  point-record mutation or geometry-strategy rebuild.
- Completed canonical record for the accepted App-level CRDT, persistence,
  property-projection, and request-time Agent flow:
  `plans/completed/ai-conversational-drawing-performance-plan.md`.
- Retained architecture authority for the completed app-level CRDT closure:
  `plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`
- The previously deferred Vector issue was accepted and activated on
  2026-08-03 through the plan above.
- The framework canonical projection and collaboration prerequisite completed
  on 2026-07-29. Its canonical record is
  `../../framework/plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md`.
- The retained performance Inspector records the only production
  server-prepared `AiActionBatch` route. Obsolete provider-mode plans,
  Inspectors, and BDD records have been removed.
- Group Interaction MVP and Layer Tree Reparent/Reorder completed on
  2026-07-24. Remote Subtree Restore Snapshot, Group Context Menu, and the
  documentation-only durable collaboration cancellation closeout completed on
  2026-07-25. Their canonical records are:
  1. `plans/completed/group-interaction-mvp-plan.md`
  2. `plans/completed/layer-tree-reparent-reorder-plan.md`
  3. `plans/completed/remote-subtree-restore-snapshot-plan.md`
  4. `plans/completed/group-context-menu-plan.md`
  5. `plans/completed/durable-collaboration-server-and-continuous-sync-plan.md`
- The durable collaboration backend itself was not implemented. The completed
  record closes only the product-owner cancellation and documentation
  correction; it must not be treated as a durable server capability.
- Deferred profiling candidate, neither active nor queued:
  `plans/vector-gradient-move-120fps-plan.md`.
- Stroke semantics are owned by
  `docs/ai/apps/asyra-design/specs/stroke-engine/SPEC.md`.
- Stroke step, route, artifact, invariant, and acceptance contracts are owned
  by
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`.
- This file is routing-only. Do not record or derive product semantics,
  implementation progress, test results, or completion evidence here.
- Do not consult `plans/completed/**` for the active task.
