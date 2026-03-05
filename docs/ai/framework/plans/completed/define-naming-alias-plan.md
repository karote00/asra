# Define Naming Alias Plan (UI/System Properties)

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: `defineUIProperty` / `defineSystemProperty` are primary declaration names with register aliases retained for compatibility.
- Outcome Summary: Preset property registration and core contracts were migrated to define-first naming.
- Exit Criteria: Met

## Goal

Adopt `define*` naming as the primary declaration API for UI/system managed properties while preserving `register*` compatibility.

## Context

Current preset and core contracts use `registerUIProperty` / `registerSystemProperty`.
Framework naming direction is `define*` for declaration contracts and `register*` for runtime wiring/hooks.

## Scope

In scope:
- add `defineUIProperty` and `defineSystemProperty` aliases in core APIs
- migrate preset default property setup to define names
- keep `registerUIProperty` / `registerSystemProperty` compatibility aliases

Out of scope:
- hard removal of register names in this phase
- broader rename of observer/hook registration APIs

## Implementation Slices

1. Core alias surface
- expose `defineUIProperty` and `defineSystemProperty` from core API creators
- keep existing register names mapped to same implementation

2. Preset migration
- switch preset property registration code to define names
- keep runtime behavior unchanged

3. Contract updates
- update core preset-install API type keys to define-first
- sync docs and decision history

## Success Criteria

- preset code uses define names for UI/system property declarations
- existing register-based callers continue to work
- tests/build pass without behavior changes
