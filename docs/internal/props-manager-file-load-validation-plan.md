# Framework File Load Validation Plan

## Scope

Framework-wide load validation pipeline (not package-specific):
- validate loaded document data before it becomes runtime state
- keep deterministic fallback behavior
- avoid UI-driven correctness rules

Packages in scope:
- `@asyra/core` (orchestration/load hooks)
- `@asyra/props-manager` (property field validation)
- `@asyra/scene-tree` (entity shape/required fields)
- `@asyra/system-context` (managed state defaults/guards)

## Goal

When loading a file, framework guarantees:
- valid data is loaded
- invalid data is contained (fallback or reject)
- runtime stays stable without app/UI hacks

## Load Pipeline (Target)

1. Raw data loaded in `core`
- source: persistence provider or `core.load(...)`

2. Pre-load migration hooks (app/framework)
- transform legacy versions to current schema shape

3. Package-level validation + fallback
- `props-manager`: field-level schema validation
- `scene-tree`: entity-level structure checks
- `system-context`: managed property type/shape checks

4. State application
- only validated/fallback data enters runtime stores

5. Optional diagnostics report
- collect warnings for app telemetry/debug

## Validation Rules

1. Runtime write rule:
- valid -> write
- invalid -> reject

2. Load rule:
- valid -> write loaded value
- invalid + default exists -> fallback to default
- invalid + no default -> keep initialized safe value

3. No implicit UI dependency:
- parser/formatter in UI is UX-only, never correctness authority

## Extension Points

1. Schema register (per domain)
- field type + validate + default

2. Load diagnostics hook
- non-blocking issues list for observability

3. Package-specific validators
- core coordinates; each package validates its owned data

## Non-goals (for this phase)

- no auto-layout conversion logic yet
- no heavy normalization pipeline beyond validate/fallback
- no hidden cross-domain migration inside package internals
