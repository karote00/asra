Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Active Pre-Release Blocker

Canonical Projection and Collaboration Contract Realignment

- Replace duplicated shared computed evidence, optional batch/provider modes,
  Core delivery leaks, Scene Tree mutation variants, and Factory coordination
  surface with one pre-release canonical architecture.
- This cross-cutting plan is the current contract authority and blocks both
  Framework Release Gate 5 and the paused Asyra Design Conversational AI
  Drawing Performance plan.
- Production implementation is authorized and advances only through the active
  Inspector owner flow after contract readiness.
- Reference:
  `docs/ai/framework/plans/canonical-projection-and-collaboration-contract-realignment-plan.md`
- Inspector:
  `docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs`

## Framework Release Gates

Complete and close these plans in order before the first public Asyra Framework
release. A release gate may begin implementation only after its product contract
and matching Inspector owner flow satisfy
`docs/ai/framework/rules/inspector-contract-readiness.md`.

5. Framework Release Readiness Audit and Closeout

- Freeze and audit the supported public surface, package artifacts, dependency
  boundaries, clean-consumer installation, generated templates, release
  documentation, and full formal gate matrix without publishing automatically.
- Reference:
  `docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md`

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
