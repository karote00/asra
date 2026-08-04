# Framework Release Readiness Audit and Closeout Plan

## Status

Completed with a reproducible pre-publication artifact `READY` decision on
2026-08-05.

This gate audited the first Framework release candidate from formal
project-local packed artifacts. It did not prove that a package version exists
on the public npm registry and does not authorize merge, tag, registry
publication, deployment, or a formal release. Those remain separate,
explicitly authorized operations.

The retained release-readiness Inspector assigns one owner to every source,
package artifact, generated template, clean-consumer, test, documentation,
versioning, and release-decision step. It remains the architecture authority
without creating another product or package authority.

## Bounded Task Contract

- Objective: prove the documented first-release Framework scope from formal
  package artifacts through clean consumers, generated templates, public flows,
  formal gates, records, and one publication-neutral readiness decision.
- Authorized mutation scope: the Gate 5 Inspector and tests; public package
  metadata, entrypoints, declarations, and directly required canonical fixes;
  project-local release scripts and fixtures; generated templates; formal tests
  and CI; release documentation, records, and closeout files.
- Required validation: package/root tests and builds, lint, dependency
  boundaries, all release Inspectors, packed artifact and clean-consumer gates,
  generated-template install/build/test/startup, Asyra Design E2E,
  completed-plan performance contracts, synchronized visual review, release
  records, and bounded review with no unresolved P0/P1/P2 finding.
- Exclusions: merge, tag, registry publication, deployment, formal release,
  Auto-layout, unit-aware aggregation, production 3D/HYBRID, unrelated
  refactors, new dependencies, and runtime/toolchain upgrades.
- Stop conditions: any package/consumer/template/formal gate failure, contract
  contradiction, unresolved P0/P1/P2 finding, unsafe Git transition, or need to
  expand the frozen mutation scope.

## Completion Record

- Frozen source: feature branch `codex/framework-release-gate-5` was created
  from fetched `origin/main` commit `9aced9d08`; the protected local `main`
  remained unmodified.
- Package evidence: the official Node.js 20 CI built all 20 workspace targets
  and packed and validated the exact 19 public `0.2.5` Framework packages.
  Every tarball passed manifest, export, declaration, import, content, license,
  dependency, and repository-only-file checks.
- Consumer evidence: the packed-only clean consumer reported
  `Clean consumer READY: 19 packages, 4 phases` after install, typecheck,
  production build, and public Core/Preset/Collaboration/AI flow tests without
  monorepo aliases or hoisting.
- Template evidence: the official generator and packed-only verifier reported
  `Generated template READY: 12 packages, 4 phases` after install, build, full
  local tests, and startup smoke. This evidence used project-local tarballs; it
  did not claim that every `0.2.5` package was available from the public
  registry.
- Formal evidence: root/workspace tests, 20 builds, lint, 21 dependency
  boundaries, 307 Inspector contracts, 135 ordinary E2E cases, one status-toast
  case, 10 collaboration E2E cases, render-delta performance budgets, and the
  synchronized dense-vector and Group visual cases passed. Test-owned servers,
  browsers, ports, and process groups were cleaned.
- Records evidence: release records froze the 19-package `0.2.5` candidate,
  supported environments, migration/deprecation notes, license, security
  contacts, and the boundary between artifact readiness and publication.
- Review result: bounded primary review plus independent executable artifact,
  consumer, template, dependency, Inspector, and CI validators found no
  unresolved P0/P1/P2 finding.
- Reproduction: PR
  [`#106`](https://github.com/karote00/asyra/pull/106), validation run
  [`30931590391`](https://github.com/karote00/asyra/actions/runs/30931590391),
  and E2E run
  [`30931590414`](https://github.com/karote00/asyra/actions/runs/30931590414)
  retain the supported-environment commands and results.
- Final decision: `READY` for pre-publication package-artifact readiness. This
  does not grant merge, tag, public-registry availability, registry
  publication, deployment, create-app release, or formal release authority.

## Goal

Prove that the documented first-release framework scope can be built, packed,
installed, imported, initialized, exercised, and understood by a consumer from
formal packed package artifacts alone.

The target release includes:

- deterministic local feature, transaction, validation, persistence, render,
  preset, and extension contracts already marked complete;
- the closed app-level migration contract;
- optional-at-runtime network collaboration transport foundation;
- the official Preset Group component and basic hierarchy operations;
- the optional AI agent runtime and its first production-capable replaceable
  provider adapter;
- the supported `2D` and `CUSTOM` profile behavior.

Auto-layout, unit-aware aggregation, and production `3D`/`HYBRID` remain
explicit post-release Roadmap work and must not appear as available release
capabilities.

## Audit Scope

### 1. Plan and contract closure

- Every preceding release gate is archived under `plans/completed/*` with its
  final Inspector authority and decision entry.
- `docs/ai/framework/PLANS.md`, constraints, architecture, package docs, API
  surfaces, Golden Paths, examples, and release decisions describe the same
  supported and unsupported behavior.
- No active plan, TODO, placeholder, unavailable profile, or known P0/P1/P2
  contract finding is misrepresented as completed capability.

### 2. Public API and package boundary

- Freeze the intended public package names, root/subpath exports, types,
  runtime entrypoints, peer dependencies, and compatibility/deprecation state.
- Audit framework, preset, reference app, examples, tests, and generated
  templates for forbidden deep imports or package-internal dependencies.
- Remove pre-release legacy product branches instead of publishing competing
  behavior; keep only documented load migration, diagnostics, or released
  deprecation paths.
- Confirm optional collaboration and concrete-engine packages do not introduce
  mandatory runtime side effects for consumers that omit them.
- Confirm optional AI packages/adapters do not introduce mandatory model,
  network, secret, or provider side effects for consumers that omit them.

### 3. Package artifacts and metadata

- Validate each published package's name, version, license, files, entrypoints,
  exports, type declarations, source maps when intended, dependency classes,
  and package-manager compatibility.
- Pack every release package into a reviewable project-local artifact area and
  verify that required files are present and repository-only/test/secret files
  are absent.
- Confirm internal package dependency versions resolve from packed artifacts
  and do not depend on workspace-only paths or undeclared hoisting.

### 4. Clean-consumer verification

- Install only the packed artifacts into a clean project-local consumer fixture
  using the documented supported Node, package-manager, TypeScript, React, and
  browser/runtime ranges.
- Compile public imports and documented subpath imports without monorepo path
  aliases.
- Run a minimal headless Core flow and a minimal Preset `2D` flow.
- Exercise save/load migration, one transaction with undo/redo, Group
  group/ungroup hierarchy, and opt-in two-peer collaboration/convergence through
  public APIs only.
- Exercise one opt-in AI plan through registered app actions, validation,
  confirmation/permission, an app-owned Feature System lifecycle, one undo
  commit, and the shared path when collaboration is enabled.
- Prove that an app which does not activate collaboration performs no provider,
  room, awareness, or network startup.
- Prove that an app which does not activate AI performs no model-provider,
  secret, AI network, or AI runtime startup.

The durable consumer fixture belongs in the repository if it becomes a formal
release test. Transient packed artifacts must remain in an ignored project-local
path and must not be committed.

### 5. Generated templates and examples

- Regenerate `create-app/*` only through the official release/template script.
- Verify generated consumers contain the current public imports, migration
  example, preset composition, Group operation route, and optional
  collaboration/AI setup without app-internal framework access.
- Run the generated template's documented install, build, test, and startup
  smoke path.

### 6. Formal quality gates

- affected package tests and builds;
- root tests and production build;
- lint and dependency-boundary validation;
- Inspector contract tests for every release flow;
- exact app E2E for startup, load, undo/redo, hierarchy, collaboration, Render,
  AI action execution, cleanup, and instance isolation;
- performance budgets owned by completed plans;
- synchronized visual review for supported rendered product cases;
- primary and independent review with no unresolved P0/P1/P2 finding.

### 7. Release records and handoff

- Produce a bounded readiness result listing passed gates and exact blockers;
  do not create self-referential readiness matrices or closure packets beyond
  the Inspector and executable evidence required by project rules.
- Confirm semantic version, changelog/release notes, migration/deprecation notes,
  license/attribution, security/contact information, and supported-environment
  documentation.
- Prepare the versioned framework decision snapshot according to
  `docs/ai/framework/decisions/releases/README.md` at the actual release cut.
- Keep repository commit/push/PR preparation separate from tag and registry
  publication authority.

## Stop and Failure Conditions

The framework is not release-ready when any of the following remains:

- a preceding release gate is incomplete or its Inspector/product contract
  conflicts with implementation;
- packed artifacts cannot build and run outside the monorepo;
- public docs require an internal/deep import or an undeclared dependency;
- generated templates are stale or require manual post-generation repair;
- optional collaboration activation changes non-collaborative runtime behavior;
- optional AI activation changes non-AI runtime behavior or leaks provider
  configuration/secrets;
- Group hierarchy can orphan, duplicate, cycle, partially apply, diverge across
  peers, or leave stale Render ownership;
- a pre-release legacy/fallback product route remains reachable;
- a required gate fails or any P0/P1/P2 review finding is unresolved.

Failures stay owned by their first incorrect package, contract, artifact, or
release step. The audit must not approve downstream documentation or packaging
work around an upstream product failure.

## Definition of Done

- every Inspector route and release artifact resolves to one current owner;
- all release package tarballs pass metadata, content, type, import, and clean
  consumer verification;
- the generated app/template and Asyra Design exercise the supported public
  routes without framework-internal imports;
- formal quality, collaboration, hierarchy, cleanup, performance, and visual
  gates pass with no unresolved P0/P1/P2 finding;
- supported/unsupported capability statements and release records are exact;
- the audit records either `READY` with reproducible evidence or `BLOCKED` with
  exact owner failures;
- after a `READY` result, this plan is closed and the user may separately
  authorize version commit, push, merge, tag, and publication operations.
