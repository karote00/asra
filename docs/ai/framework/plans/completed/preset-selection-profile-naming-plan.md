# Preset Selection Profile Naming Plan

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: Preset selection profile exports use concise names without `Preset*` prefixes.
- Outcome Summary: `SelectionChannels` / `SelectionActions` (+ related types) replaced prefixed names across preset, app usage, tests, and docs.
- Exit Criteria: Met

## Goal

Use clean, domain-neutral export names for preset selection profile constants without `Preset*` prefixes.

## Context

Selection profile constants are consumed from `@asyra/preset` directly.
Prefixing with `Preset` adds noise without improving ownership clarity at the call site.

## Scope

In scope:
- rename selection profile exports to:
  - `SelectionChannels`
  - `SelectionActions`
  - `SelectionChannel`
  - `SelectionAction`
  - `SelectionChannelList`
- update preset internals, tests, app usage, and framework docs

Out of scope:
- event naming cleanup (`PresetEventNames`, etc.) in this phase
- behavior/runtime flow changes

## Success Criteria

- no `PresetSelection*` exports remain
- preset/app compile and tests pass
- docs reflect new export names
