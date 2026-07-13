# Principle: Data Authority and Flow

## Intent

Preserve one-way, deterministic data flow across the framework:
- input/UI action/command from any human, machine, automation, AI, device, or
  external source -> feature runtime -> mutation APIs -> state -> render/UI
- load/replay/remote state input -> migration/validation/conflict policy ->
  apply APIs -> state owners -> projections

## Why

- avoids hidden side effects and race-like behavior
- keeps undo/redo and load/save behavior predictable
- keeps render and UI layers replaceable

## Decisions Implied

- render and UI are state consumers, not data authorities
- state owners remain package-local (`scene-tree`, `props-manager`, `selection`, `system-context`)
- mutations happen through explicit API boundaries and transactions
- transactions guard the API-to-state mutation boundary; they do not create a
  parallel intent path
- state replay and synchronization reuse apply boundaries without introducing a
  second feature-decision runtime

## Anti-Patterns

- reading truth from render engine state for logic decisions
- direct deep mutations across package boundaries
- duplicating authoritative state in multiple runtime owners

## Design Check

Before merging:
1. Can the same intent or state-application input produce the same final state every time?
2. Is there one owner for each state surface?
3. Are outputs derived from state, not the reverse?
