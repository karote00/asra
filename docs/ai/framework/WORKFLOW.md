# Framework Workflow

This is the default execution workflow for AI work on Asyra framework code.

## Phase 0: Load Context (Required)

Read in order:

1. `docs/ai/framework/FRAMEWORK_ESSENTIALS.md`
2. `docs/ai/framework/CODING_STANDARDS.md`
3. `docs/ai/framework/ARCHITECTURE.md`
4. `docs/ai/framework/API_SURFACES.md`
5. relevant principles in `docs/ai/framework/design-principles/`
6. `docs/ai/framework/REQUEST_ROUTING.md`
7. `docs/ai/framework/RUNTIME_MATRICES.md`
8. relevant package docs in `docs/ai/framework/packages/`
9. relevant rules in `docs/ai/framework/rules/`

Optional retrieval accelerator:
- `npx context-rag ai "<request summary>" --top-k 8`
- Context-rag scope should exclude `docs/ai/project/*`.
- Use retrieved results as navigation hints, then confirm against source-of-truth docs.

## Phase 1: Scope and Ownership

Goal: avoid mixed ownership and hidden coupling.

Actions:

- classify the request as framework, app-level, or cross-cutting
- define owner per concern (core, feature-system, props-manager, render, app)
- state what must stay unchanged
- identify compatibility expectations (breaking vs non-breaking)
- identify generated-output boundaries (`create-app/*`) and keep source-of-truth edits outside generated folders

Checklist:

- [ ] ownership boundaries are explicit
- [ ] no app business logic leaks into framework packages
- [ ] cross-package imports use `@asyra/package-name`
- [ ] no manual edits are introduced in `create-app/*` unless explicitly generated/synced

## Phase 2: Design Before Code

Goal: lock data flow and extension points first.

Actions:

- write/update a short plan (runtime flow + touched packages)
- define transaction boundaries (`start/update/end`) for state mutations
- define extension surface changes (register APIs, schemas, hooks, adapters)
- define deprecation impact if replacing old behavior

Checklist:

- [ ] single runtime owner for decision/session flow is preserved
- [ ] state change path is deterministic
- [ ] no Pixi dependency leaks outside `@asyra/render`
- [ ] migration/deprecation story is clear when behavior changes

## Phase 3: Implement in Thin Slices

Goal: keep progress reversible and observable.

Actions:

- apply small, reviewable changes per package
- keep public API stable unless explicitly refactoring it
- update exports/imports and compile after each slice
- stop and report when unexpected unrelated changes appear

Self-correction loop:

1. inspect failure
2. read affected source
3. adjust minimally
4. rerun build/test for touched scope

## Phase 4: Verification Matrix

Run only what matches change scope, but do not skip required checks.

Package-level change:

- `yarn workspace @asyra/<package> build` (or the package-specific build script)
- `yarn workspace @asyra/<package> test:local` (if tests exist)

Cross-package framework change:

- build/test all affected packages
- `yarn lint:ci`

Quality gates:

- [ ] builds pass for affected packages
- [ ] tests pass for affected packages
- [ ] lint passes (if cross-cutting)
- [ ] no known regression left undocumented

## Phase 5: Documentation Sync

Update framework docs as part of delivery, not as optional follow-up.

Minimum updates:

- architecture changes -> `docs/ai/framework/ARCHITECTURE.md`
- request intent coverage changes -> `docs/ai/framework/REQUEST_ROUTING.md`
- owner/flow changes -> `docs/ai/framework/RUNTIME_MATRICES.md`
- rationale changes -> `docs/ai/framework/design-principles/*`
- package behavior/structure changes -> relevant file in `docs/ai/framework/packages/`
- rule changes -> `docs/ai/framework/rules/`
- follow-up work -> `docs/ai/framework/PLANS.md`
- completed plan records -> `docs/ai/framework/plans/completed/*`
- decision rationale (pre-release) -> `docs/ai/framework/decisions/releases/unreleased.md`
- decision snapshot at release -> `docs/ai/framework/decisions/releases/vX.Y.Z.md`
- cross-cutting rationale (framework + app impact) -> `docs/ai/decisions/releases/unreleased.md`

Checklist:

- [ ] source-of-truth docs reflect implementation
- [ ] deprecated paths are marked with current status
- [ ] future tasks are captured with clear trigger/exit criteria

## Phase 6: Handoff Format

Final report should include:

1. what changed
2. why this approach
3. validations run + results
4. remaining risks/open questions
5. next recommended step (if any)
