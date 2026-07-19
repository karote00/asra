# Constraints and Limitations

## Current Hard Constraints

1. Render engine coupling boundary

- Only `@asyra/render-engine-pixi` can import Pixi.
- `@asyra/render` and concrete engine packages must communicate only through
  `@asyra/render-engine`.

2. UI-context scope

- Convenience layer only.
- Consumers may bypass and aggregate on their own.

3. Transaction expectations

- Data-changing APIs should be transaction-bounded.
- Transactions group changes for undo/redo and shared delivery and automatically
  reverse recorded rollbackable mutations after failure, explicit rollback
  cancellation, or validation rejection.
- User-driven session interruption defaults to `commit-current`; `rollback` and
  `feature-defined` remain explicit policies for true discard behavior.
- Mutations explicitly marked `rollbackable: false`, runtime-only feature state,
  external processes, and remote clients are outside local rollback coverage.

4. Feature decision runtime

- Feature-system is primary runtime for execute/session flow.

5. Runtime owner guardrail

- `@asyra/feature-system` is the only runtime owner for execute/session/cancel flow.

## Current Functional Limitations

1. Auto-layout

- Not implemented yet.
- Unit conversion hooks are preparatory only.
- Auto-layout and its unit/UI aggregation family are post-release Roadmap work,
  not part of the first framework release gate sequence.
- See `plans/auto-layout-behavior-engine-plan.md`.

2. Engine portability

- The engine contract and adapter are replaceable, but Pixi is the only
  production concrete engine in this phase.
- No production 3D engine, Hybrid runtime, or render-mode selector is exposed.

3. Validation diagnostics

- Package validation is active, and core can emit cross-package load diagnostics via hook.
- Diagnostics are non-blocking and focused on load-time fallback/reject visibility.

4. Registry consistency

- Shared registry utility exists; some specialized registries may still require local behavior wrappers.

5. Package coverage depth

- Some package docs are evolving while framework contracts stabilize.
- Use package files in `docs/ai/framework/packages/*` as the active reference set.

6. Preset application requirement

- Default builtins are not implicitly registered by core.
- Consumers must explicitly apply `@asyra/preset` when default framework registrations are required.

7. Transaction atomicity boundary

- Local ACID-inspired failure atomicity, explicit cancel policies, and committed
  vs persisted acknowledgement are implemented.
- This is not a database transaction: isolation is Feature-operation
  serialization, not external/remote locking or serializable isolation.
- Persistence failure does not reverse runtime commit and has no built-in retry.
- See `plans/completed/transaction-atomicity-and-rollback-plan.md`.

8. Yjs network collaboration

- Current Yjs usage provides local shared-channel registration, buffered or
  immediate shared delivery, and observer wiring.
- A network provider, room/auth lifecycle, awareness/presence, remote canonical
  apply pipeline, offline/server persistence, dedupe/origin handling, and full
  collaboration conflict policy are not implemented yet.
- These capabilities are required by Framework Release Gate 2 but remain
  optional to activate at app runtime.
- See `plans/yjs-network-collaboration-plan.md` and
  `plans/collaborative-conflict-policies-plan.md`.

9. Group hierarchy operations

- Preset `CONTAINERS` currently installs the official Group component and
  hierarchy projection, while Scene Tree owns parent ids and child order.
- Atomic public group, ungroup, reparent/reorder, and subtree lifecycle behavior
  is not complete yet.
- These data/pipeline behaviors are required by Framework Release Gate 3; Group
  UI, selection policy, shortcuts, hover, and click behavior remain app-owned.
- See `plans/group-component-and-hierarchy-behaviors-plan.md`.

10. AI agent runtime

- No reusable AI action-planning runtime or production-capable provider adapter
  is implemented yet.
- The AI runtime is required by Framework Release Gate 4 but remains optional to
  install and activate; apps that omit it must create no model-provider,
  network, secret, or AI lifecycle side effect.
- App-owned registered actions and ordinary transaction/validation/state paths
  remain authoritative; model output is never canonical scene state.
- See `plans/ai-agent-runtime-plan.md`.

## Documentation Rule

- `docs/ai/framework/*` is the framework source-of-truth.
