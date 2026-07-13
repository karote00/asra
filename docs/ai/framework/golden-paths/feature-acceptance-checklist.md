# Golden Path: Feature Acceptance Checklist

Use this checklist before merging any new framework/app feature contract.
Goal: keep Asyra modular, deterministic, and reusable across canvas domains (design, whiteboard, BIM, simulation, signaling).

## Scope Declaration

- [ ] Feature purpose is clear in one sentence.
- [ ] Owner is explicit:
  - user customization
  - preset default behavior
  - framework runtime owner
- [ ] Placement is explicit:
  - `@asyra/<package>` for runtime contract
  - `@asyra/preset` for optional default wiring
  - `apps/<app>` for app-specific domain behavior
- [ ] If core changes are proposed, at least 2-domain reuse is documented.

## Brick Contract (LEGO Model)

- [ ] New behavior is added through registration/extension, not hardcoded branching.
- [ ] Public contract is explicit:
  - API surface (`core.xxx` or package export)
  - input/event contract
  - schema/persistence contract
- [ ] Preset remains optional; feature still works for custom app wiring.
- [ ] Non-engineer composition path is preserved (can use preset behavior without core edits).
- [ ] Engineer escape hatch is preserved (can import sub-packages and customize flow).

## Runtime and Data Guarantees

- [ ] Runtime flow remains deterministic: Any Intent -> Feature -> API -> Transaction -> State Owner -> Projections.
- [ ] Mutations are transaction-bounded and grouped by intended user action.
- [ ] Undo/redo semantics are defined:
  - grouping boundary
  - cancel behavior
  - custom transaction strategy if needed
- [ ] Failure behavior states whether the current implementation can roll back,
  preflight-prevents partial mutation, or intentionally defers rollback support.
- [ ] Validation semantics are explicit:
  - runtime invalid write -> reject
  - load invalid data -> fallback
- [ ] Save/load and migration impact is documented when persisted schema changes.

## Collaboration (CRDT) Guarantees

- [ ] Shared vs local mutation behavior is explicit (`options.shared` or equivalent).
- [ ] Conflict policy and deterministic merge expectations are documented.
- [ ] Offline/reconnect behavior expectations are documented.
- [ ] Presence/selection sync impact is documented (if applicable).
- [ ] No hidden coupling between CRDT transport and domain behavior logic.

## Input and Interaction Guarantees

- [ ] Shortcut/key-combo behavior is defined and conflict-checked.
- [ ] Feature priority/exclusive/session semantics are documented.
- [ ] Cancel paths leave runtime/state valid.
- [ ] Tool-switch interactions are defined for active sessions.
- [ ] Shortcut customization/override path is documented.

## Scene-Tree and Domain Modeling

- [ ] New element type(s) are schema-defined, not special-cased in core logic.
- [ ] Scene-tree manipulation rules are explicit:
  - parent/child constraints
  - ordering/index behavior
  - computed data updates
- [ ] Domain-specific element behavior is app/preset-owned unless truly framework-generic.
- [ ] Render/UI remains downstream consumer; no render package becomes data authority.

## UI and Renderer Independence

- [ ] No renderer-engine-specific imports leak outside render boundary packages.
- [ ] Contract is renderer-agnostic and UI-framework-agnostic.
- [ ] UI-context changes are derived-state only, not runtime ownership changes.
- [ ] Equivalent behavior is testable without UI runtime.

## Quality Gates (Required)

- [ ] Affected package builds pass.
- [ ] Affected package tests pass (or new tests added for behavior contract).
- [ ] Cross-cutting change runs `yarn lint:ci`.
- [ ] Regression tests cover combined behaviors when applicable:
  - CRDT + undo/redo
  - shortcuts + session lifecycle
  - scene-tree mutation + validation/load

## Delivery Requirements

- [ ] Docs are updated in the same change (API/rules/architecture/package docs as needed).
- [ ] Any deprecation has replacement path + status.
- [ ] Risk notes are captured for known edge cases.
- [ ] North-star impact is measured or estimated:
  - time from empty project to usable canvas tool

## Fast Reject Conditions

Reject or redesign if any are true:

- [ ] Requires direct edits in many core files for domain behavior that should be registration-based.
- [ ] Couples domain logic to a specific UI/renderer implementation.
- [ ] Breaks deterministic ordering or transaction boundaries.
- [ ] Introduces CRDT/shared-state behavior without explicit conflict/undo policy.
- [ ] Removes the ability for users to override preset behavior.
