Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Active Pre-Release Blockers

None.

No active App persistence blocker remains. The completed
socket-authoritative document-session record is:

- App semantic authority:
  `../apps/asyra-design/specs/socket-authoritative-document-session.md`.
- Completed implementation plan:
  `../apps/asyra-design/plans/completed/socket-authoritative-document-persistence-plan.md`.
- Retained Inspector:
  `../apps/asyra-design/plans/socket-authoritative-document-persistence-flow-inspector.data.cjs`.

## Framework Release Gates

None.

Framework Release Gate 5 closed with a pre-publication artifact `READY` result
on 2026-08-05. Merge, Node.js 24 migration, registry publication, create-app
release, deployment, and the formal release remain separately owned work.

## Release and Distribution Sequence

Complete these plans in order unless a plan explicitly allows read-only
research to proceed without mutating the repository or an external system.

The Node.js 24 runtime prerequisite completed with local, CI, and Vercel
Preview `READY` evidence on 2026-08-05. The retained records are:

- Completed plan:
  `docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md`.
- Retained Inspector:
  `docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.data.cjs`.

1. Local exact-version package installation research

- Determine the exact proof boundary of local tarballs and whether a local
  registry is justified for registry-style `name@version` resolution.
- Research only; no tool installation or implementation is authorized.
- Reference:
  `docs/ai/framework/plans/local-versioned-package-install-research-plan.md`

2. Framework package patch release

- First publish the seven never-published Framework packages once at `0.2.5`,
  then prove all 19 packages share the public `0.2.5` baseline.
- Use the canonical all-package Changeset generator and patch-only version
  policy until the release path is stable.
- Keep root `asyra` and private `@asyra/asyra-design` unchanged.
- Reference:
  `docs/ai/framework/plans/framework-package-patch-release-plan.md`

3. Formal `create-asyra-design-app` release

- Begin only after the Framework patch set is publicly installable.
- Apply user-specified Asyra/Asyra Design versions, regenerate through the
  official script, prove the real registry-backed user path, and publish the
  CLI only with separate authorization.
- Reference:
  `docs/ai/framework/plans/create-asyra-design-app-release-plan.md`

4. Asyra Framework marketing and documentation website

- Build the public Next.js/Tailwind documentation experience after public
  package and create-app contracts are stable.
- Include the landing page, developer docs/tutorials, examples, and the
  verified Asyra Design case study and deployment link.
- Reference:
  `docs/ai/framework/plans/asyra-framework-website-plan.md`

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
