Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Framework Release Gates

Complete and close these plans in order before the first public Asyra Framework
release. A release gate may begin implementation only after its product contract
and matching Inspector owner flow satisfy
`docs/ai/framework/rules/inspector-contract-readiness.md`.

2. Yjs network collaboration and conflict-policy foundation

- Ship optional-at-runtime, provider-replaceable CRDT collaboration as part of
  the framework release: instance/provider ownership, room/auth boundary,
  remote canonical apply, origin/dedupe, awareness, persistence interfaces,
  reconnect/convergence, local-only undo, and deterministic framework conflict
  handling.
- Apps that do not need collaboration remain free to omit provider/runtime
  activation.
- References:
  - `docs/ai/framework/plans/yjs-network-collaboration-plan.md`
  - `docs/ai/framework/plans/collaborative-conflict-policies-plan.md`

3. Group component and hierarchy behaviors

- Complete canonical Scene Tree group, ungroup, reparent/reorder, subtree,
  validation, replay, collaboration, load/save, and Render projection behavior.
- Preset `CONTAINERS` provides the official Group component and basic
  ID-driven operations; selection choice, shortcuts, hover/click behavior, and
  UI presentation remain app-owned.
- Reference:
  `docs/ai/framework/plans/group-component-and-hierarchy-behaviors-plan.md`

4. AI agent runtime

- Ship an optional reusable package for natural-language planning, structured
  action validation, permission/confirmation policy, transaction-bounded
  execution, provider replacement, safe secret boundaries, and app-owned domain
  actions.
- AI activation remains opt-in and model output never becomes canonical scene
  state or bypasses Feature System, ordinary app/Core APIs, validation,
  undo/redo, persistence, collaboration, or Render derivation.
- Reference: `docs/ai/framework/plans/ai-agent-runtime-plan.md`

5. Framework Release Readiness Audit and Closeout

- Freeze and audit the supported public surface, package artifacts, dependency
  boundaries, clean-consumer installation, generated templates, release
  documentation, and full formal gate matrix without publishing automatically.
- Reference:
  `docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md`

## Repository-Wide Maintenance Plans

1. Project-wide documentation contract audit

- Re-scan current framework, app, package, workflow, skill, plan, Inspector,
  README, routing, and source-coverage documents by contract class.
- The first pass is report-only. Owner-bounded repairs begin only after the
  user reviews the findings and explicitly authorizes repair mode.
- Reference:
  `docs/ai/framework/plans/project-wide-documentation-contract-audit-plan.md`

2. Project-wide duplicate contract and ownership consolidation

- Find repeated declarations, predicates, validation decisions,
  transformations, and misplaced responsibilities across framework packages,
  Preset, apps, servers, tests, and shared infrastructure.
- Classify semantic duplicates separately from intentional boundary-local
  repetition, then execute owner-bounded consolidation only after the canonical
  contract, dependency direction, compatibility impact, and required tests are
  explicit.
- Reference:
  `docs/ai/framework/plans/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`

3. Project-wide code readability analysis and refactor

- Scan filenames, type structures, control flow, naming, and module
  responsibilities across framework packages, Preset, apps, servers, tests,
  and shared infrastructure.
- Analyze each candidate's semantics and owner before editing, then execute
  clear owner-bounded refactors without treating line count, automated
  complexity, or extraction volume as readability authorities.
- Reference:
  `docs/ai/framework/plans/project-wide-code-readability-analysis-and-refactor-plan.md`

## Post-Release Roadmap

1. Official 2D/3D/hybrid preset profiles

- Publish a render-mode profile only after its concrete engine and canonical
  feature/property/schema/render/input default modules exist and pass the engine
  boundary contract.
- `3d` requires a supported 3D engine; `hybrid` additionally requires an
  explicit multi-engine composition and interaction contract.
- Do not expose empty, placeholder, or capability-incomplete profiles.
- Reference: `docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md`

2. Auto-layout behavior engine (lowest-priority roadmap family)

- Advanced optional Preset behavior for design tools; it is not a first-release
  framework requirement.
- Reference: `docs/ai/framework/plans/auto-layout-behavior-engine-plan.md`

3. Unit-aware property model (auto-layout-oriented)

- Support value+unit semantics in schema/aggregates.
- Keep auto-layout implementation out of this phase.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

4. UI aggregate helpers (lowest priority, auto-layout-related)

- Mixed values and mixed units (`MIX`) helpers.
- App-level registration remains first-class.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`
