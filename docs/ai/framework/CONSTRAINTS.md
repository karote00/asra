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
- Diagnostics are non-blocking and focused on load-time fallback/reject
  visibility. They receive detached post-apply validation/apply-input evidence,
  including applied managed-system serialization; the evidence is not a
  canonical state artifact or state owner. Mutation or throw cannot repair,
  replace, or fail canonical load state. Evidence assembly is lazy and
  contained: no diagnostics or no observer performs no assembly, and assembly
  failure skips emission without changing load success.

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

8. Network collaboration transport

- Local Factory channels remain delivery/projection channels with no retained
  collaboration history.
- `@asyra/collaboration` provides explicit instance-owned publication handoff,
  replaceable Provider lifecycle/acknowledgement, inbound app callback delivery,
  and Awareness.
- Construction does not connect; apps call `start()` explicitly. Apps that omit
  the package create no collaboration resources or side effects.
- App/backend code owns route/payload validation, remote transactions,
  canonical apply, authentication, room access, persistence, recovery,
  ordering, permission, and domain conflict semantics. Awareness and Provider
  state are not canonical or authorization authorities.
- Collaboration owns no Y.Doc, semantic operation history, state-vector replay,
  dedupe, timestamp/LWW, TTL, permission, or conflict policy.
- Framework Release Gate 2 remains active until user-directed closeout even
  when implementation and validation are ready.
- See `plans/network-collaboration-transport-plan.md`.

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

11. App-level migration hooks

- Core load and `registerLoadHook` are synchronous after provider I/O resolves.
- Promise-returning hooks are unsupported and fail before validation/apply;
  Core contains their eventual rejection behind the synchronous
  `ASYNC_UNSUPPORTED` failure. Asynchronous preparation belongs in the
  persistence provider or another app-owned pre-load input boundary.
- Direct and provider load results remain raw `unknown` input until app hook
  logic narrows version eligibility; every successful hook still returns a
  `VersionedLoadDocument`. Package fields are not trusted until the complete
  chain reaches package-owner validation.
- Core snapshots instance-local load hooks before execution; a registration
  created inside a hook is deferred to the next load.
- Package validation results are owner-issued, instance-bound, one-shot
  artifacts. Canonical apply accepts no plain/foreign/reused result and never
  reruns package validators.
- Apps own one connected linear migration chain, its domain transforms, and its
  conditional dispatcher. Version ids may be non-contiguous, but registration
  must reject an incomplete or sparse batch, disconnected component, branch,
  merge, duplicate source/target, self-transition, or cycle before installing
  the dispatcher. A document with no matching version passes through unchanged;
  Framework packages do not contain app schema history or enforce an app
  target-version policy.
- One app helper module cannot split one migration history across repeated
  non-empty registrations on the same Core instance. Empty batches do not claim
  the app-owned installation slot, and separate Core instances remain isolated.

## Documentation Rule

- `docs/ai/framework/*` is the framework source-of-truth.
