Never record completed plans here.

# App Plans

## Current Status

- Ordered proposed next implementation plans:
  1. `plans/ai-conversational-drawing-performance-plan.md`
- Current active plan:
  `plans/ai-conversational-drawing-plan.md`.
- The active plan adds an explicit `ai=mock` Asyra Design conversation,
  deterministic delayed provider fixtures, operational progress, bounded
  drawing/update actions, app-owned partial outcomes and confirmation UI,
  incremental follow-up targeting, and current-history Message Bar Undo/Redo.
- Its architecture authority is
  `plans/ai-conversational-drawing-flow-inspector.data.cjs`.
- Its first queued successor is profiling-first performance remediation for
  local canonical creation, progressive collaboration, Render projection, and
  E2E measurement. The successor does not close or weaken the active plan; its
  architecture authority is
  `plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`.
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
