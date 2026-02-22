# Framework App-Level Migration Plan

## Scope

Define how app-level users migrate document formats using framework hooks, across all core packages.

## Principle

- Framework owns validation/fallback during load.
- App owns versioned migration strategy and domain-specific transforms.
- Migration happens before package state application.

## Recommended Migration Flow

1. Read raw document
- app gets persisted/raw file payload

2. Run app migration pipeline (versioned)
- via `core.registerLoadHook(...)` chain
- each hook transforms one version step

3. Framework validation/fallback pipeline
- props/scene/system data validated by owning packages
- invalid values fallback/reject per framework rules

4. Apply runtime state
- only validated or fallback data is committed

5. Emit diagnostics (optional)
- app logs migration/validation warnings

## App Responsibilities

1. Version governance
- maintain document `version`
- bump version on breaking schema changes

2. Migration functions
- pure, deterministic, idempotent
- one-step migrations (`v1 -> v2`, `v2 -> v3`) preferred

3. Domain transforms
- layout model changes
- property key renames
- structural reshaping (split/merge fields)

## Framework Responsibilities

1. Hook orchestration
- execute load hooks in order

2. Validation/fallback safety
- package-level field/shape checks
- reject invalid runtime writes

3. Stable post-load state
- prevent corrupted runtime even with partially bad files

## Recommended Hook Contract

1. Pre-validate migration hook
- input: raw document
- output: migrated document

2. Optional analyze hook
- input: migrated + validation diagnostics
- output: logging/telemetry side effects only

## Non-goals (for this phase)

- no automatic migration inference in framework core
- no package-internal document version branching
- no UI-coupled migration logic
