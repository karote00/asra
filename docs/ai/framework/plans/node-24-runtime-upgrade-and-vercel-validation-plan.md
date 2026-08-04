# Node.js 24 Runtime Upgrade and Vercel Validation Plan

## Status

Queued as the first post-Gate-5 release prerequisite.

No Framework package version may be bumped or published until this plan reaches
`READY`. If local, CI, or Vercel validation fails on Node.js 24, package
publication remains blocked and the failure returns to the first incorrect
runtime, dependency, build, test, or deployment owner.

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
