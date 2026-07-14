# Principle: Extensible Runtime Guarantees

## Intent

Asyra apps are assembled from framework runtime contracts, preset defaults, and app-owned feature behavior.

Preset packages provide working defaults, not hidden ownership. App authors should be able to extend or replace behavior through explicit framework contracts without patching framework internals or inheriting unrelated preset assumptions.

## Guarantees

1. Feature Isolation Guarantee
- Features define user-facing behavior through `defineFeature(...)`, explicit triggers, priority, exclusivity, and execution/session lifecycles.
- Feature handlers call app/common APIs or core facade APIs for mutation and query work.
- A feature should be testable as a bounded behavior unit without requiring direct knowledge of unrelated package internals.

2. Transaction Grouping Guarantee
- One intended user action should map to one intended undo commit.
- Data-changing paths must be grouped behind transaction boundaries.
- Cross-store mutations must be coordinated through API boundaries that preserve scene-tree, props-manager, selection, and render consistency.
- The current local runtime includes grouping, undo/redo replay, automatic
  failed-transaction rollback, synchronous commit validation, explicit cancel
  policies, shared-delivery timing, and separate persistence acknowledgement.
- This is an application-level guarantee, not database serializability or a
  distributed transaction contract. See
  `../plans/completed/transaction-atomicity-and-rollback-plan.md`.

3. Schema Safety Guarantee
- Runtime invalid writes are rejected before they corrupt active state.
- Load-time invalid values fall back deterministically through package validation.
- App-level migrations may transform document versions, but framework packages remain the validation and fallback safety boundary.

4. Preset Replaceability Guarantee
- Presets provide default capabilities that help products start quickly.
- Preset behavior must stay optional, movable, and replaceable by app or product owners.
- If a preset capability does not expose a direct extension hook, the deterministic fallback path is explicit replacement through unregister/redefine or an approved override flow.

5. Render Boundary Guarantee
- Render output is derived from framework state and system state.
- Render layers and interaction targets are registered extension points, not hidden data owners.
- Engine-specific primitives stay inside `@asyra/render`; app and preset behavior consume render capabilities through core-facing abstractions where available.

## Why

Asyra should support multiple products assembled from the same core and preset foundation. Product authors need strong defaults, but they also need room to define domain-specific tools, shortcuts, events, schemas, render layers, and workflows.

These guarantees keep extension work local:
- app authors reason about feature behavior, not unrelated runtime internals
- preset authors provide defaults without locking users into them
- framework maintainers preserve deterministic data flow, validation, and engine boundaries

## Decisions Implied

- App-specific workflows belong in app features and app/common APIs.
- Framework packages expose primitives, validation, orchestration, and registration surfaces.
- Preset packages own default wiring only when that wiring is optional and replaceable.
- New extension work should prefer registration, metadata, and explicit override policies over implicit branching.

## Anti-Patterns

- feature handlers mutating package internals directly
- app behavior depending on preset implementation details instead of stable APIs
- one user action creating multiple unintended undo commits
- preset defaults that cannot be disabled, replaced, or safely overridden
- render state becoming the source of truth for domain logic

## Design Check

Before merging:

1. Can the behavior be added or replaced through a documented extension surface?
2. Does the feature stay bounded to its own triggers, lifecycle, and API calls?
3. Is the intended undo/redo grouping explicit?
4. Are runtime invalid values rejected and load invalid values handled by fallback?
5. Does render remain an output/interaction bridge rather than the data authority?
