# Define Selection Contract Plan

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: `defineSelection` is the primary declaration API; `registerSelection` remains compatibility alias.
- Outcome Summary: Preset defaults and core typing/contracts were moved to define-first selection declarations.
- Exit Criteria: Met

## Goal

Make `defineSelection` the primary framework API for declaring selection channels, while keeping existing `registerSelection` as compatibility.

## Context

Selection runtime is now channel/action metadata-driven and concrete canvas channels are preset-owned.
The API surface should reflect this by using a declarative `defineSelection` contract, consistent with `defineComponent` / `defineFeature`.

## Scope

In scope:
- add `core.defineSelection(...)` as primary declaration API
- keep `core.registerSelection(...)` as compatibility alias
- migrate preset default selection registration to `defineSelection`
- update preset/core typing contracts accordingly

Out of scope:
- removal of compatibility alias in this phase
- changing selection runtime behavior

## Implementation Slices

1. API surface
- add `defineSelection` to core extension/preset-install API tier types
- keep `registerSelection` available in core for compatibility

2. Preset migration
- use `defineSelection` in preset default selection registration
- keep behavior unchanged

3. Docs + decision sync
- update API surfaces/docs wording for define-first direction
- log decision in unreleased history

## Success Criteria

- preset registers default selections with `defineSelection`
- `registerSelection` still works for existing callers
- no behavior regression in selection flow
