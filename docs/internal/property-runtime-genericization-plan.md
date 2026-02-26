# Property Runtime Genericization Plan

## Context

Even after schema registration is in place, `@asyra/props-manager` still uses concrete property component classes (`position`, `dimension`, `anchor-point`, `anchor-points`, `custom`) for runtime behavior.

This is intentional today because schemas currently define validation shape, while classes still own behavior details:
- load/save behavior
- `getValue()` / `getUnit()` contract
- runtime set/update semantics
- specialized logic (for example anchor point upsert/link flows)

## Goal

Move toward a schema-first, registration-driven property runtime where concrete classes are optional implementation details, not required defaults.

End-state:
- `props-manager` operates on registered runtime handlers/models, not hardcoded builtin classes.
- preset/app can choose between generic schema runtime and custom behavior adapters.
- builtin behavior lives in `@asyra/preset`, not implicitly in kernel packages.

## Scope

In scope:
- define a generic property runtime model/API in `props-manager`
- support value/unit serialization without class-specific hardcoding
- provide extension hooks for special behaviors (anchor-point family first)
- migrate preset defaults to new runtime registration surface

Out of scope:
- redesigning transaction semantics
- changing CRDT model
- removing schema validation

## Direct Plan (Final State Only)

This plan intentionally skips phased coexistence and backward-compatibility scaffolding.
We implement the final architecture directly.

### 1) Runtime Contract Extraction

- Introduce explicit runtime interfaces for property behavior.
- Include `load` behavior contract.
- Include `save` behavior contract.
- Include read value/unit view contracts.
- Include optional custom set/update hooks.
- Add registration API for runtime handlers (separate from schema registration).

Exit criteria:
- `createProperty(...)` can instantiate via runtime handler registry without direct builtin class map.

### 2) Generic Runtime as Kernel Default

- Implement a generic schema-driven runtime handler for scalar/unit properties (`position`, `dimension`).
- Implement generic handling for custom bag-like properties (`custom`).

Exit criteria:
- kernel runtime no longer depends on concrete builtin property classes.

### 3) Specialized Adapters as Registrations

- Extract anchor point identity/linking into dedicated adapters/plugins.
- Extract anchor points upsert/conversion behavior into dedicated adapters/plugins.
- Register adapters through runtime registry (preset-owned defaults).

Exit criteria:
- anchor behaviors are plugin registrations, not mandatory kernel classes.

### 4) Preset-Owned Defaults

- Move all default runtime registrations to `@asyra/preset`.
- Ensure kernel startup has no implicit builtin runtime payload.

Exit criteria:
- core + props-manager work with an empty runtime registry (deterministic rejection path for unregistered types).
- preset apply restores current default behavior.

## Risks

1. Hidden behavior coupling between existing class methods and scene/props flows.
2. Anchor-point migration complexity (ID/link semantics).

## Mitigation

- add focused behavior tests for runtime contract and anchor workflows
- validate save/load via current schema/runtime contract only (no legacy coexistence path)

## Success Criteria

- property runtime is registration-driven and schema-first
- concrete builtin classes are optional adapters, not kernel requirements
- preset owns default runtime registrations
