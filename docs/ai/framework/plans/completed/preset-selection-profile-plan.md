# Preset Selection Profile Plan

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: Concrete canvas selection channels/actions are preset-owned profile exports.
- Outcome Summary: Preset now defines and exports `SelectionChannels` / `SelectionActions`; core selection runtime remains generic.
- Exit Criteria: Met

## Goal

Define concrete canvas selection channels in `@asyra/preset` while keeping selection runtime generic in `@asyra/selection`.

## Context

Selection runtime is framework-level and reusable, but concrete channels like:
- element
- vector point
- vector segment

are canvas-domain defaults. We want these defaults to be explicitly owned by preset without introducing a new package.

## Scope

In scope:
- define preset-owned concrete selection channel profile/constants
- update preset selection registration and observer wiring to consume the profile
- expose preset selection profile so apps can use stable channel contracts
- keep current behavior fully compatible

Out of scope:
- introducing a new package
- removing existing `core.selectElements` / `core.selectVectorPoints` / `core.selectVectorSegments` APIs
- full deprecation rollout for legacy selection API names

## Target Ownership Model

1. `@asyra/selection`
- generic selection state/runtime and manager

2. `@asyra/core`
- selection transaction publishing APIs

3. `@asyra/preset`
- concrete canvas selection profile (channel ids + default registration/wiring)

## Implementation Slices

1. Preset profile foundation
- add `preset` selection channel constants/types in `packages/preset/src/selection/channels.ts`
- consume in `register-default-selections.ts` and data-channel observer wiring

2. App usage path (compatibility-safe)
- export preset selection profile from `@asyra/preset`
- allow app code to use preset profile constants instead of hardcoded channel strings/enums

3. Core generalization (follow-up)
- add optional channel-based core selection API (`selectByChannel`) while keeping compatibility wrappers
- keep wrappers mapped to preset channel profile by default

4. Deprecation and docs
- mark wrapper APIs as compatibility aliases only after app migration readiness
- update docs and runtime matrices with final ownership wording

## Success Criteria

- concrete canvas selection channels are declared in preset, not scattered
- preset default selection behavior remains unchanged
- selection runtime remains domain-agnostic
- no breaking changes to existing app behavior

## Risks

1. Mixed source-of-truth during migration
- mitigate by keeping preset profile as canonical channel contract

2. Partial migration confusion
- mitigate with compatibility wrappers and explicit docs
