# Framework App-Level Migration Plan

## Completion

- Status: completed on July 19, 2026; Framework Release Gate 1 is closed.
- Final decision: retain the single Core load pipeline and app-owned schema
  history. Core owns synchronous hook orchestration, package validation/fallback
  coordination, canonical apply, and observational diagnostics only.
- Outcome: the existing ordered hook pipeline was retained; formal gaps in raw
  input parity, hook result/failure semantics, owner-issued validation artifacts,
  instance isolation, and diagnostics containment were closed without adding a
  second migration state owner or framework-owned app version branches.
- Exit criteria: the dedicated Inspector, reusable typed example, focused and
  root tests, dependency validation, lint, production build, and two independent
  final reviews passed with no P0/P1/P2 findings.
- Canonical record:
  `docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md`.
- Next gate: Framework Release Gate 2 may begin its readiness/Inspector segment;
  this closeout does not start collaboration implementation.

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

The Inspector audit formalizes a public `VersionedLoadDocument` hook output
(`{ version: string }` plus app-owned fields) and the synchronous
`registerLoadHook(...)` surface. `CoreRawData` remains the normalized/save
envelope after the hook chain; Core does not add a second migration pipeline or
framework-owned app version registry.

## Version And Hook Semantics

- Direct `core.load(...)` accepts raw `unknown`; a persistence provider resolves
  raw `unknown` or `null`. The first `LoadHook` also accepts `unknown`, while
  every successful hook result must satisfy `VersionedLoadDocument`. Package
  fields remain subject to Core normalization and package validation after the
  complete chain.
- Direct and provider entries use the same nullish no-document sentinel:
  `null` or `undefined` invokes no migration, validation, apply, completion
  event, or diagnostics. Every other falsy value remains raw document evidence.
- `Core` passes the unnormalized raw document to the first registered load hook.
  This preserves app ownership of missing, unsupported, and legacy version
  decisions. Core normalization begins only after the complete hook chain.
- Hooks execute synchronously in registration order. A hook must return a
  non-array document object with a string `version`. Returning a Promise is an
  unsupported asynchronous hook result; returning any other invalid result is
  also a Core orchestration failure. Both stop before package validation.
- Core snapshots the instance-local registration chain at the start of each
  load. A hook registered during a running hook becomes eligible on the next
  load and cannot extend the in-flight document chain.
- The empty hook chain passes the raw payload directly to Core normalization and
  package validation. It does not invent an app migration policy.
- An already-current document is a semantic no-op in the app-owned version
  chain, then continues through package validation and canonical apply.
- Apps declare supported versions and one-step transforms. The reusable example
  registers `v1 -> v2` before `v2 -> v3`, bypasses steps already reached, rejects
  a missing version, and rejects versions outside the app-declared chain.
- Each app hook owns its transform and version advancement. Core owns only
  registration-order invocation and result-shape enforcement; package
  validators do not inspect app version history.
- `core.load(...)` remains synchronous. Provider I/O may be asynchronous, but
  once a provider returns a document it enters the same synchronous hook,
  validation, and apply pipeline as direct load.

## Failure And Atomicity Semantics

- A thrown app hook error propagates unchanged and stops the chain. A Core-owned
  invalid or asynchronous result throws one stable load-hook execution error
  identifying the hook index and failure code. Core contains an eventual
  rejected asynchronous result behind that single synchronous failure.
- Migration failure invokes no package validator, applies no version or package
  state, emits no file-load-complete event, and invokes no diagnostics hook.
- All package validation/fallback results are obtained before canonical state
  apply begins. A validation failure, including a thrown validator, applies no
  version or package state.
- Each package returns an owner-issued, instance-bound, one-shot validated-load
  artifact. Canonical apply returns the complete artifact to that same owner;
  fabricated, foreign-instance, reused, or plain-data inputs fail before
  mutation, and apply does not rerun package validators.
- Package validation cannot be bypassed by a hook result and still owns
  deterministic fallback/reject behavior for migrated data.
- Diagnostics receive detached observations after successful apply. Mutating a
  diagnostic payload or throwing from a diagnostics hook cannot change state,
  later diagnostic observations, or the successful load outcome.
- Diagnostics evidence is assembled only when diagnostics and an observer
  exist. Evidence assembly failure skips emission and cannot change the already
  successful canonical apply, completion event, or load outcome.
- Load-hook and diagnostics registrations are Core-instance local.

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
- fabricated, foreign-instance, or reused validated artifacts cannot bypass a
  package validator or mutate canonical state;
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
