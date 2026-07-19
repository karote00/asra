# Framework App-Level Migration Plan

## Status

Framework Release Gate 1: queued for formalization audit and closeout.

This gate must not invent replacement runtime behavior merely to create work.
Core already exposes ordered `registerLoadHook(...)` execution before package
validation for both persistence load and `core.load(...)`. The task first audits
that implementation, its formal tests, examples, and public documentation
against this product contract. If the contract is already satisfied, the
correct outcome is documentation/test completion and plan closeout.

Before implementation or closeout work begins, add or update the matching
Inspector owner flow for raw input, ordered app migration, package validation,
canonical apply, diagnostics, and failure ownership.

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

## Required Formalization

- Define how an app identifies the document version before the first hook and
  how each successful hook advances exactly one declared version step.
- Preserve registration order deterministically and run the same hook chain for
  persistence-provider load and direct `core.load(...)`.
- Define empty-chain, already-current, missing-version, unsupported-version,
  thrown-hook, invalid-result, and asynchronous-hook behavior explicitly.
- A migration failure must stop before package validation or canonical state
  apply and must not expose a partially migrated runtime document.
- Package validation remains mandatory after migration; an app hook cannot
  declare invalid package data safe or bypass fallback/reject semantics.
- Provide one reusable app-owned `vN -> vN+1` migration example or template
  without embedding app schema history in framework packages.
- Keep optional diagnostics observational and unable to change the migration,
  validation, or apply outcome.

Exact version-envelope and error/result types remain pending until the matching
Inspector maps the existing Core implementation and public compatibility cost.
Do not add a second migration pipeline when the current ordered hook surface can
satisfy the contract.

## Product Cases

- no persisted document: startup does not invoke migration;
- already-current document: canonical validation and apply proceed without a
  semantic rewrite;
- `v1 -> v2 -> v3`: hooks run once in registration/version order and validation
  observes only the complete `v3` result;
- direct `core.load(...)` and provider-backed load use identical ordering;
- thrown hook, unsupported version, or invalid hook result applies no canonical
  prefix and surfaces one deterministic failure;
- migrated but package-invalid data still follows package fallback/reject rules;
- separate Core instances do not share app migration registrations.

## Release-Gate Definition of Done

- the Inspector defines one owner for every migration, validation, apply, and
  diagnostic step and all routes/artifacts resolve;
- existing Core behavior is either formally proven or corrected without a
  parallel legacy path;
- version-step, ordering, failure atomicity, validation, direct-load,
  provider-load, diagnostics, and instance-isolation cases pass;
- public API, Core/package docs, Golden Path, reusable example/template, and
  release decision history agree;
- the completed plan is archived and Release Gate 2 may begin.

## Non-goals (for this phase)

- no automatic migration inference in framework core
- no package-internal document version branching
- no UI-coupled migration logic
