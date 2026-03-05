# Selection Concrete Class Removal Plan

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: `@asyra/selection` exposes only generic runtime primitives; concrete default selections are created by preset registration.
- Outcome Summary: Concrete selection classes were removed; preset now registers defaults with metadata-driven `BaseSelection` instances.
- Exit Criteria: Met

## Goal

Keep `@asyra/selection` generic by removing concrete default classes (`element`, `vectorPoint`, `vectorSegment`) and using registration-time definitions instead.

## Context

Current `@asyra/selection` still ships concrete classes for preset defaults.
This conflicts with framework direction where domain defaults belong to preset registration, not selection runtime package internals.

## Scope

In scope:
- remove concrete selection classes from `@asyra/selection`
- expose only generic selection runtime (`BaseSelection`, `SelectionManager`)
- construct default canvas selections in preset registration with explicit metadata
- update tests/docs/export maps accordingly

Out of scope:
- changing selection transaction payload semantics
- changing preset default channel/action values

## Success Criteria

- no concrete selection classes remain in `@asyra/selection`
- preset still registers default selections and behavior stays unchanged
- core/preset/app build and tests pass
