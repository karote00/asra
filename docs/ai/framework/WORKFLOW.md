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
- Follow global retrieval/search policy: `docs/ai/workflows/README.md` -> "Shared Retrieval and Search Policy (Global)".

## Phase 1: Scope and Ownership

Goal: avoid mixed ownership and hidden coupling.

Actions:

- freeze the bounded task contract from
  `rules/bounded-task-scope-and-closure.md`: objective, authorized mutation
  scope, unchanged behavior, fixed discovery methods for audits/reviews,
  required gates, exclusions, and stop conditions
- classify the request as framework, app-level, or cross-cutting
- classify ownership bucket for each concern:
  - user customization
  - preset default setting
  - framework runtime owner
- define owner per concern (core, feature-system, props-manager, render, app)
- state what must stay unchanged
- identify compatibility expectations (breaking vs non-breaking)
- before introducing identifiers, resolve their owner, neutral naming, and
  persisted/wire compatibility and run `yarn lint:naming` as the baseline per
  `rules/naming-and-persisted-identities.md`
- identify whether old behavior is released compatibility or pre-release legacy; pre-release legacy must follow `rules/pre-release-legacy-removal.md`
- for bug fixes, verify whether existing formal tests detect the reported failure; if not, add or strengthen the failing regression test first per `rules/bugfix-test-first.md`
- identify whether the proposed fix is a patch output/fallback path; patch fixes are forbidden by `rules/no-patch-fixes.md`
- identify generated-output boundaries (`create-app/<app>/template`) and keep
  template source-of-truth edits outside generated folders; CLI-owned files
  above the template remain directly maintained

Checklist:

- [ ] the bounded task contract is fixed before the first edit
- [ ] specialized rules have passed their applicability check and do not
      independently expand mutation scope
- [ ] bug fixes have a formal failing test/oracle before implementation
- [ ] ownership boundaries are explicit
- [ ] preset usage is justified as default initialization (not runtime/domain ownership)
- [ ] change improves quick-start functionality without blocking user override paths
- [ ] no app business logic leaks into framework packages
- [ ] cross-package imports use `@asyra/package-name`
- [ ] no manual edits are introduced in `create-app/<app>/template` unless
      explicitly generated/synced
- [ ] no patch geometry/state/routing/fallback is used to hide an incorrect upstream contract

## Phase 2: Design Before Code

Goal: lock data flow and extension points first.

Actions:

- write/update a short plan (runtime flow + touched packages)
- define transaction boundaries (`runTransaction` for finite work, or
  `start/update/end` for long-lived sessions) for state mutations
- define rollbackability, inverse ownership, validation, and cancel policy for
  every affected transaction path; when durability exists, define its
  acknowledgement owner and whether it is intentionally separate from
  transaction settlement
- define extension surface changes (register APIs, schemas, hooks, adapters)
- define deprecation impact if replacing old behavior
- for new feature contracts, run `golden-paths/feature-acceptance-checklist.md`
- for recurring execution or shared derived data, follow
  `rules/computation-ownership-and-reuse.md`: trace actual caller work and define
  its producer, semantic dependencies, valid lifetime, consumers, and expected
  work counts before wiring the first relevant implementation slice

Checklist:

- [ ] single runtime owner for decision/session flow is preserved
- [ ] state change path is deterministic
- [ ] affected recurring work has explicit recomputation/reuse boundaries and
      permanent tests planned for those boundaries, not only output correctness
- [ ] no Pixi dependency leaks outside `@asyra/render-engine-pixi`
- [ ] render orchestration and concrete engines depend only on
      `@asyra/render-engine`, never on one another
- [ ] preset binds only the official `2D` provider through Core, and profile
      `CUSTOM` keeps app-owned provider selection explicit
- [ ] migration/deprecation story is clear when behavior changes
- [ ] pre-release legacy branches are removed or isolated to load migration/diagnostics
- [ ] the first incorrect semantic owner step is fixed before downstream output is changed

## Phase 3: Implement in Thin Slices

Goal: keep progress reversible and observable.

Actions:

- apply small, reviewable changes per package
- keep public API stable unless explicitly refactoring it
- update exports/imports and compile after each slice
- run `yarn lint:naming` after the first identifier-bearing slice, before wiring
  downstream consumers, and again at the completed owner/stage boundary
- stop and report when unexpected unrelated changes appear
- after the first edit, do not add new repository-wide discovery methods or
  candidate classes; inspect only the current diff, direct consumers, defined
  cases, and frozen gates

Self-correction loop:

1. inspect failure
2. verify whether existing formal tests detect the failure
3. if no formal test fails, add or strengthen the official regression test/oracle and confirm it fails
4. read affected source
5. identify the first canonical semantic step where the behavior becomes wrong
6. adjust minimally at that owner step
7. rerun build/test for touched scope

## Phase 4: Verification Matrix

Run only what matches change scope, but do not skip required checks.

Package-level change:

- `yarn workspace @asyra/<package> build` (or the package-specific build script)
- `yarn workspace @asyra/<package> test:local` (if tests exist)

Cross-package framework change:

- build/test all affected packages
- `yarn lint:ci`

Quality gates:

- [ ] bug fixes include a formal regression test/oracle that would fail on the old behavior
- [ ] builds pass for affected packages
- [ ] tests pass for affected packages
- [ ] affected recurring-work and data-reuse paths pass the work-count,
      equivalence, and invalidation gates in
      `rules/computation-ownership-and-reuse.md`, including caller-lifetime
      coverage where a helper-only test could miss repetition
- [ ] lint passes (if cross-cutting)
- [ ] no known regression left undocumented
- [ ] visual/product fixes are validated through the normal pipeline, not through patch output
- [ ] visual closure follows `rules/visual-review-microscope.md` when screenshots, zoom, viewport, or pixel evidence are involved
- [ ] final review did not reopen discovery or expand the frozen mutation scope

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
