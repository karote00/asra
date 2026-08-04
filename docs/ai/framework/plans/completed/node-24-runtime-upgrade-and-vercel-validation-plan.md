# Node.js 24 Runtime Upgrade and Vercel Validation Plan

## Status

Completed with a reproducible local, CI, and Vercel Preview `READY` decision
on 2026-08-05.

Node.js 24.x is now the single current runtime contract for the repository,
Framework packages, Asyra Design, release automation, CI, generated template,
public support records, and the existing Vercel project. Yarn remains 4.3.1.
This result does not authorize merge, package version changes, Changesets,
registry or create-app publication, tag, production deployment, or a formal
release.

## Completion Record

- Baseline: local Node.js `v24.13.0`, Corepack `0.29.3`, Yarn `4.3.1`, and
  Darwin arm64. No runtime manager, dependency, package manager, or
  development tool was installed or upgraded.
- Runtime contract: root, all 19 Framework packages, Asyra Design, the durable
  clean-consumer fixture, release validators, CI, the official template
  generator, generated output, and current public support records require
  Node.js `24.x`. Package versions remain `0.2.5`.
- Test-first evidence: the formal runtime contract failed against the previous
  Node.js 20 declarations before canonical owners changed, then passed after
  migration. The public-support oracle likewise failed before the support
  records changed and passed after synchronization.
- Local evidence: immutable install, Turbo graph, 21 dependency boundaries,
  clean 20-target workspace build, full tests, lint, 69 Inspector/viewer
  contracts, fresh 19-package artifacts, packed-only clean consumer, and the
  12-package generated-template consumer passed on Node.js 24.
- App evidence: the isolated render-performance gate passed 5 cases; ordinary
  E2E passed 135 cases with 3 contract-scoped skips; collaboration E2E passed
  10 cases with 2 explicit opt-in skips; the unavailable-service visual case
  passed. Agent inspection of the live-app dense-vector, transformed-vector,
  Group source/peer, reconnect, and status-toast screenshots found no visual
  regression. All agent-started processes and ports were cleaned.
- CI evidence: pull request
  [`#107`](https://github.com/karote00/asyra/pull/107) at migration commit
  `e24c021b2f93ba200c728761d400d0ac0a87379d` passed validation and release
  readiness in run
  [`30942427036`](https://github.com/karote00/asyra/actions/runs/30942427036)
  and ordinary/collaboration E2E in run
  [`30942427298`](https://github.com/karote00/asyra/actions/runs/30942427298).
- Vercel evidence: existing project `prj_rMVZ3Pq4G3cb0dPDZmDpYfZNAElJ` now
  selects Node.js `24.x` for builds and Serverless Functions. Preview
  [`HUktFsbih`](https://vercel.com/karote00s-projects/asyra/HUktFsbihYsvXbZ5mqMwd5DYomD8)
  built the reviewed branch and commit with Node.js `24.x`, completed all 20
  workspace build targets, and is available at the stable
  [feature-branch Preview](https://asyra-git-codex-node-24-runtime-upgrade-karote00s-projects.vercel.app).
- Preview smoke: the deployed frontend loaded with the required `fileId`,
  remained locally editable while its separately owned collaboration service
  was unavailable, and created and rendered a selected rectangle with matching
  Layers and Properties state. Deployment resources contain 18 static assets
  and no Vercel Function or Middleware, so function-path smoke is explicitly
  not applicable. The app declares no required Vercel environment variable;
  the optional collaboration endpoint retains its documented same-origin
  fallback, and the project has no custom environment variables to migrate.
- Review result: no unresolved P0/P1/P2 finding remains. Final decision:
  `READY` for the Node.js 24 runtime prerequisite only.

## Goal

Replace the repository's supported Node.js 20.x runtime contract with Node.js
24.x and prove that the complete Asyra workspace, Asyra Design, release
automation, CI, and a Vercel preview deployment operate correctly on Node.js
24.

Node.js 24 is an LTS line. Vercel currently supports `24.x` for builds and Node
functions and allows `engines.node` to select that major:

- https://nodejs.org/en/about/previous-releases
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions

## Current State

- Root and all 19 Framework package manifests declare Node.js `20.x`.
- Release artifact, clean-consumer, generated-template, documentation, and CI
  contracts explicitly enforce Node.js 20.x.
- The official template generator writes Node.js `20.x`.
- The linked Asyra Design Vercel project currently records Node.js `20.x`.
- The repository package manager remains Yarn 4.3.1. This plan does not
  authorize a Yarn upgrade.

## Bounded Task Contract

- Objective: make Node.js 24.x the single supported local, CI, package,
  generated-app, and Vercel runtime, with reproducible local and preview
  deployment evidence.
- Authorized mutation scope: runtime declarations, Node-version assertions,
  CI setup, release validation, template generation rules, directly affected
  support docs, and Vercel project/runtime configuration.
- Required gates: immutable install, full workspace build and tests, lint,
  dependency validation, Inspector tests, release artifact/consumer/template
  gates, Asyra Design E2E and performance gates, and a real Vercel preview
  deployment plus smoke verification.
- Exclusions: package version bumps, Changeset generation, npm publication,
  create-app publication, product behavior changes, unrelated dependency
  upgrades, production deployment, tag, and formal release.
- Stop conditions: any Node.js 24-only failure, dependency requiring an
  unapproved upgrade, Vercel build/runtime mismatch, product regression, or
  unresolved P0/P1/P2 finding.

## Required Inspector

Before implementation, create a Node.js 24 migration Inspector with one owner
for each of these steps:

1. runtime source-of-truth;
2. workspace and package manifest compatibility;
3. package/release scripts;
4. generated template contract;
5. CI runtime;
6. Asyra Design local runtime;
7. Vercel build and function runtime;
8. support documentation;
9. final `READY` or owner-specific `BLOCKED` decision.

The Inspector must distinguish local Node execution, browser runtime, Vercel
build runtime, and Vercel function runtime. A browser-only pass cannot waive a
server/build failure.

## Execution Plan

### 1. Freeze Node.js 24 baseline

- Select the current supported Node.js `24.x` LTS runtime available locally and
  on Vercel.
- Record `node --version`, Corepack version, Yarn version, OS, architecture,
  Vercel project id, and current Vercel runtime setting.
- Do not install a new version manager or dependency without separate approval.

### 2. Strengthen runtime tests first

- Change formal runtime assertions to expect Node.js 24 before changing runtime
  declarations.
- Prove the assertions fail against the existing Node.js 20 contract.
- Cover root, 19 Framework packages, Asyra Design, generator output, release
  artifacts, clean consumers, CI, and Vercel configuration.

### 3. Update canonical runtime owners

- Update root and Framework package `engines.node`.
- Update CI Node setup and every supported-runtime check.
- Update release artifact, clean-consumer, and template validation.
- Update the official template generator; never hand-edit generated output.
- Update Asyra Design and public support documentation.
- Preserve Yarn 4.3.1 unless a proven Node.js 24 incompatibility requires a
  separately approved package-manager change.

### 4. Validate locally on Node.js 24

- Install dependencies immutably.
- Run Turbo graph validation and dependency boundaries.
- Clean-build the complete workspace and Asyra Design production output.
- Run all root/package tests, lint, Inspector tests, app E2E, collaboration E2E,
  performance budgets, and synchronized visual gates required by current
  contracts.
- Build and exercise package tarballs, clean consumers, and the generated
  template under Node.js 24.
- Track and clean every server, browser, process, and port.

### 5. Validate CI on Node.js 24

- Require the same build, test, lint, dependency, artifact, consumer, E2E, and
  performance gates in CI.
- Do not accept a matrix where Node.js 20 is green and Node.js 24 is allowed to
  fail.

### 6. Validate Vercel

- Set the existing Asyra Design Vercel project build/runtime to `24.x`.
- Create a preview deployment from the reviewed feature branch.
- Verify the deployment build log reports Node.js 24.x.
- Smoke the deployed frontend and every Vercel function or middleware path
  owned by the project.
- Confirm required environment variables remain configured without printing
  secrets.
- Production deployment remains outside this plan.

### 7. Synchronize support records

- Replace Node.js 20 support claims with Node.js 24 only after all local, CI,
  package, generated-template, and Vercel gates pass.
- Record exact failed owners if the result is `BLOCKED`.

## Definition of Done

- Node.js 24.x is the only current supported runtime in canonical manifests,
  validation scripts, CI, generated output rules, and public docs.
- Local immutable install, complete builds/tests/lint/dependency gates,
  artifact consumers, app E2E/performance/visual gates, and CI pass on Node.js
  24.
- A real Vercel preview builds and runs on Node.js 24.x.
- No package version was bumped or published.
- The plan records reproducible `READY`, or `BLOCKED` with exact owner and
  evidence.
