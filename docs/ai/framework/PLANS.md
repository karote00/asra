Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Active Pre-Release Blockers

None.

The Input System environment-neutrality prerequisite completed on 2026-08-10.
Its retained plan and Inspector are:

- `docs/ai/framework/plans/completed/input-system-environment-neutrality-plan.md`
- `tools/flow-inspector/inspectors/input-system-environment-neutrality-flow-inspector.data.cjs`

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
  `tools/flow-inspector/inspectors/node-24-runtime-upgrade-flow-inspector.data.cjs`.

1. Integrated public release candidate

- Completed on 2026-08-10 with all nine child workstreams, production website
  verification, and integration PR CI accepted.
- Completed plan:
  `docs/ai/framework/plans/completed/asyra-framework-website-plan.md`

2. Framework package publication

- Begin only after the integrated pre-publication Release Candidate is
  accepted.
- Record the historical partial public inventory without reconstructing or
  publishing an old package version from the current source.
- Let the reviewed Changeset plan and fixed-allowlist manifests own every
  selected Framework target version; active plans and validators must not
  duplicate numeric package versions.
- Freeze a clean exact source commit on `main` or the release feature branch,
  rebuild the accepted artifacts from that commit, and revalidate the
  publication manifest. Merge is not a publication prerequisite.
- Publish the manifest-derived Framework selection through one canonical
  Changesets publication operation after explicit authorization.
- Treat the all-package generator as exceptional. Normal development must add
  ordinary scoped patch Changesets as changes are made.
- Keep root `asyra`, private `@asyra/asyra-design`, CLI packages, and generated
  templates outside Framework Changesets.
- Reference:
  `docs/ai/framework/plans/framework-package-patch-release-plan.md`

3. Applicable CLI/generated-app publication and root alignment

- If the integrated candidate changes the public CLI artifact or generated
  app, freeze a new bounded CLI release execution through the retained
  create-app Inspector before publication. A completed historical execution is
  evidence, not automatic authority for a new release.
- Obtain explicit CLI version and publication authorization before any registry
  write, then repeat the complete public-command generated-app proof.
- Begin root `asyra` family alignment only after the applicable Framework
  packages and corresponding create-app CLI are publicly verified.
- Manually align root `asyra` to `a.b.0`; never place root in a Changeset.
- Root versioning, CLI publication, tags, and pushes retain their own explicit
  authorization boundaries.
- Reference: `docs/ai/framework/rules/release-version-topology.md`

4. Public fact reconciliation and website launch

- Replace only generated/provisional package versions, commands, support facts,
  and verified URLs after their public owners resolve.
- Repeat registry-only examples, generated-app onboarding, public links,
  search, release inventory, affected visual cases, and final Preview gates.
- Obtain separate website production-deployment authorization, deploy the exact
  final candidate, and verify production.
- Close the overall release train only when every child workstream and every
  applicable external release owner is complete.

## Post-Release Roadmap

1. Headless Core and Core Kernel (unscheduled)

- Research a truthful non-visible runtime, optional adapter boundary, and
  runtime-owner model before adding any public API or support claim.
- The future task must distinguish Node-safe import, one process-scoped
  non-visible runtime, dependency-neutral kernel composition, and multi-runtime
  isolation rather than treating all four as “headless.”
- Future plan:
  `docs/ai/framework/plans/headless-core-and-core-kernel-future-plan.md`.
- Research index:
  `docs/ai/framework/research/headless-core-and-core-kernel-architecture-research.md`.

2. Official 2D/3D/hybrid preset profiles

- Publish a render-mode profile only after its concrete engine and canonical
  feature/property/schema/render/input default modules exist and pass the engine
  boundary contract.
- `3d` requires a supported 3D engine; `hybrid` additionally requires an
  explicit multi-engine composition and interaction contract.
- Do not expose empty, placeholder, or capability-incomplete profiles.
- Reference: `docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md`

3. Auto-layout behavior engine (lowest-priority roadmap family)

- Advanced optional Preset behavior for design tools; it is not a first-release
  framework requirement.
- Reference: `docs/ai/framework/plans/auto-layout-behavior-engine-plan.md`

4. Unit-aware property model (auto-layout-oriented)

- Support value+unit semantics in schema/aggregates.
- Keep auto-layout implementation out of this phase.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

5. UI aggregate helpers (lowest priority, auto-layout-related)

- Mixed values and mixed units (`MIX`) helpers.
- App-level registration remains first-class.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`
