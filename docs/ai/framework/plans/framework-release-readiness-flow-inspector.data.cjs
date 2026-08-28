/* global module */

;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs'

  const lanes = [
    { id: 'source', title: 'Release Source Contract', order: 1 },
    { id: 'artifacts', title: 'Package Artifacts', order: 2 },
    { id: 'consumers', title: 'Clean Consumers and Templates', order: 3 },
    { id: 'evidence', title: 'Formal Evidence and Records', order: 4 },
    { id: 'decision', title: 'Release Readiness Decision', order: 5 }
  ]

  const steps = [
    {
      id: 'freeze-release-source',
      order: 1,
      laneId: 'source',
      title: 'Freeze the release source inventory',
      ownerPackage: 'Framework Release Gate 5 source contract',
      purpose:
        'Resolve the exact release package set, public entrypoints, completed prerequisite gates, supported environments, and unsupported Roadmap capabilities before any artifact is accepted.',
      inputs: [
        'Gate 5 product contract',
        'completed Gate 1 through Gate 4 contracts and retained Inspectors',
        'framework package manifests and public source entrypoints',
        'framework, app, and release workflow authorities'
      ],
      outputs: ['artifact:release-source-set', 'artifact:source-finding'],
      conditions: [
        'The source set is bound to one Git baseline and lists every intended release package exactly once.',
        'Every package name, root or documented subpath entrypoint, type entrypoint, dependency class, deprecation state, and supported environment has one current authority.',
        'Gate 1 through Gate 4 must be completed and archived with retained Inspector authority before READY is possible.',
        'Cleanup owner: freeze-release-source owns only detached inventory evidence and creates no package or product runtime resource.'
      ],
      bypasses: [
        'Any incomplete prerequisite gate, contradictory contract, active P0/P1/P2 finding, or release capability represented by a TODO produces artifact:source-finding.',
        'Auto-layout, unit-aware aggregation, and production 3D/HYBRID are explicitly excluded from the release source set.'
      ],
      allowedContributors: [
        'docs/ai/framework release authorities',
        'current package manifests and public entrypoints',
        'completed plan and Inspector contracts',
        'bounded manifest and import discovery'
      ],
      forbiddenContributors: [
        'historical audit output as current authority',
        'deleted code or stale generated output as source-of-truth',
        'Post-Release Roadmap capability',
        'implicit publication, tag, deployment, or release authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md',
        'docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs',
        'docs/ai/framework/plans/framework-release-readiness-flow-inspector.html',
        'docs/ai/framework/plans/__tests__/framework-release-readiness-flow-inspector.contract.test.cjs',
        'tools/flow-inspector/embed-viewer.cjs',
        'tools/flow-inspector/__tests__/viewer-entry.test.cjs',
        'scripts/framework-release-packages.js',
        'scripts/__tests__/framework-release-packages.test.mjs',
        'packages/*/package.json',
        'packages/*/src/index.ts',
        'docs/ai/framework/{API_SURFACES.md,ARCHITECTURE.md,CONSTRAINTS.md,PLANS.md}',
        'docs/ai/framework/packages/*.md',
        'docs/ai/workflows/package-release-validation.md'
      ],
      specRefs: [
        '#goal',
        '#audit-scope',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-release-source'
    },
    {
      id: 'build-package-artifacts',
      order: 2,
      laneId: 'artifacts',
      title: 'Build and pack release packages',
      ownerPackage: 'Gate 5 package artifact builder',
      purpose:
        'Build every frozen release package and create reviewable tarballs in an ignored project-local artifact area without mutating source manifests or publishing.',
      inputs: ['artifact:release-source-set'],
      outputs: ['artifact:packed-package-set', 'artifact:package-build-finding'],
      conditions: [
        'Every release package is built from the frozen baseline and packed exactly once with publishable internal dependency ranges.',
        'Tarball paths are project-local, ignored, deterministic by package name and version, and never committed.',
        'The builder invokes no registry publication, tag, deployment, release, or source-manifest restoration path.',
        'Cleanup owner: build-package-artifacts owns transient staging directories and tarballs; the release harness removes staging and may retain the ignored reviewable tarball set for evidence.'
      ],
      bypasses: [
        'A missing build output, workspace-only dependency in the packed manifest, or pack failure produces artifact:package-build-finding and blocks downstream consumer proof.',
        'Packages outside artifact:release-source-set are not packed by this gate.'
      ],
      allowedContributors: [
        'artifact:release-source-set',
        'canonical package build scripts',
        'Yarn workspace pack behavior',
        'project-local release artifact scripts'
      ],
      forbiddenContributors: [
        'monorepo aliases inside the packed consumer',
        'manual tarball repair',
        'registry publication or npm deprecate',
        'files outside the repository'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'scripts/release-package-artifacts.js',
        'scripts/release-readiness.js',
        'scripts/__tests__/release-package-artifacts.test.mjs',
        'scripts/__tests__/release-automation.test.mjs',
        'packages/*/package.json',
        'packages/*/tsconfig.json',
        'packages/*/src',
        'LICENSE'
      ],
      specRefs: [
        '#2-public-api-and-package-boundary',
        '#3-package-artifacts-and-metadata',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'build-package-artifacts'
    },
    {
      id: 'validate-package-artifacts',
      order: 3,
      laneId: 'artifacts',
      title: 'Validate tarball metadata and contents',
      ownerPackage: 'Gate 5 package artifact verifier',
      purpose:
        'Inspect each packed manifest, file inventory, public JavaScript and type entrypoint, dependency class, source map policy, license, and excluded repository-only content before installation.',
      inputs: ['artifact:packed-package-set'],
      outputs: [
        'artifact:validated-package-set',
        'artifact:package-validation-finding'
      ],
      conditions: [
        'Package names and versions are unique and match the frozen release source set.',
        'Every declared export, main, module, types, and files entry resolves inside its tarball.',
        'Packed manifests contain no workspace protocol, path dependency, undeclared internal dependency, secret, test result, repository-only source, or package-manager install state.',
        'Cleanup owner: validate-package-artifacts owns extracted inspection directories and removes them after producing detached validation evidence.'
      ],
      bypasses: [
        'Any metadata, content, type, import, dependency, license, or exclusion mismatch produces artifact:package-validation-finding with the first incorrect package as evidence owner.',
        'No clean consumer is started from an unvalidated tarball set.'
      ],
      allowedContributors: [
        'artifact:packed-package-set',
        'packed manifest and tar inventory',
        'documented public entrypoints',
        'bounded package import/dependency checks'
      ],
      forbiddenContributors: [
        'workspace source fallback',
        'repository node_modules resolution',
        'manual extraction repair',
        'documentation claims used as a substitute for tarball evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-package-artifacts.js',
        'scripts/release-readiness.js',
        'scripts/__tests__/release-package-artifacts.test.mjs',
        'packages/*/package.json',
        'packages/*/LICENSE',
        'packages/*/src/index.ts',
        'LICENSE',
        '.gitignore'
      ],
      specRefs: [
        '#2-public-api-and-package-boundary',
        '#3-package-artifacts-and-metadata',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-package-artifacts'
    },
    {
      id: 'verify-clean-consumer',
      order: 4,
      laneId: 'consumers',
      title: 'Install and exercise a clean consumer',
      ownerPackage: 'Gate 5 clean-consumer fixture',
      purpose:
        'Install only validated tarballs and documented external dependencies into an isolated project-local consumer, then compile and execute the supported public framework flows without workspace aliases or hoisting.',
      inputs: ['artifact:validated-package-set'],
      outputs: [
        'artifact:clean-consumer-evidence',
        'artifact:clean-consumer-finding'
      ],
      conditions: [
        'The durable fixture imports only documented package roots and subpaths and has no monorepo path mapping.',
        'Headless Core initialization, transaction plus undo/redo, save/load migration, Preset 2D initialization, and Group group/ungroup execute through public APIs.',
        'Opt-in two-peer Collaboration converges through public contracts and opt-in AI executes registered app actions through one app-owned Feature/transaction path.',
        'An AI-disabled consumer creates no AI runtime, provider, model, secret, timer, listener, or network side effect; a Collaboration-disabled consumer creates no provider, room, Awareness, timer, listener, or network side effect.',
        'Cleanup owner: verify-clean-consumer owns the isolated install, child processes, ports, and provider instances and removes or disposes all of them on success or failure.'
      ],
      bypasses: [
        'Any install, compile, import, initialization, runtime-flow, isolation, or inert-side-effect failure produces artifact:clean-consumer-finding.',
        'The fixture never falls back to workspace packages, repository node_modules, source imports, or manual package linking.'
      ],
      allowedContributors: [
        'artifact:validated-package-set',
        'fixtures/framework-release-consumer',
        'documented public @asyra package APIs',
        'documented supported runtime and package-manager versions'
      ],
      forbiddenContributors: [
        'TypeScript paths to repository packages',
        'workspace protocol or link/file dependency to package directories',
        'monorepo node_modules hoisting',
        'fixture-specific product fallback or patched runtime route'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'fixtures/framework-release-consumer',
        'scripts/release-readiness.js',
        'scripts/__tests__/release-clean-consumer.test.mjs',
        'package.json',
        'yarn.lock',
        'packages/*/package.json',
        'packages/*/src',
        'docs/ai/framework/golden-paths',
        'docs/ai/framework/packages'
      ],
      specRefs: [
        '#4-clean-consumer-verification',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'verify-clean-consumer'
    },
    {
      id: 'verify-generated-template',
      order: 5,
      laneId: 'consumers',
      title: 'Regenerate and verify the official app template',
      ownerPackage: 'Asyra Design release-template generator',
      purpose:
        'Regenerate create-app output only through the official release script and prove the generated consumer uses current public APIs for migration, Preset, Group, optional Collaboration, and optional AI.',
      inputs: ['artifact:release-source-set'],
      outputs: [
        'artifact:generated-template-evidence',
        'artifact:generated-template-finding'
      ],
      conditions: [
        'Generated output is traceable to Asyra Design source and the official release configuration.',
        'Template synchronization, install/build/test, startup smoke, and public-import boundary checks use formal scripts.',
        'Generated package versions resolve to the frozen release package versions and contain no workspace or package-internal dependency.',
        'Cleanup owner: verify-generated-template owns project-local comparison/build output and any smoke server or port and removes them on exit.'
      ],
      bypasses: [
        'Stale output, manual-only repair, deep import, workspace dependency, missing required example, or failed documented command produces artifact:generated-template-finding.',
        'Generated output never becomes the source authority for package or app behavior.'
      ],
      allowedContributors: [
        'artifact:release-source-set',
        'apps/asyra-design source and formal tests',
        'release-configs/asyra-design.json',
        'scripts/release-template.js and build-release-template.js'
      ],
      forbiddenContributors: [
        'manual implementation edits under create-app',
        'app-private framework access presented as public API',
        'Post-Release Roadmap capability',
        'manual post-generation repair'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design',
        'release-configs/asyra-design.json',
        'scripts/release-template.js',
        'scripts/build-release-template.js',
        'scripts/__tests__/release-automation.test.mjs',
        'create-app/asyra-design'
      ],
      specRefs: [
        '#5-generated-templates-and-examples',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'verify-generated-template'
    },
    {
      id: 'run-formal-release-gates',
      order: 6,
      laneId: 'evidence',
      title: 'Run the bounded formal release gates',
      ownerPackage: 'Root release-validation workflow',
      purpose:
        'Execute the exact package, root, dependency, Inspector, E2E, performance, synchronized visual, and bounded review gates against the validated artifacts and supported app flows.',
      inputs: [
        'artifact:validated-package-set',
        'artifact:clean-consumer-evidence',
        'artifact:generated-template-evidence'
      ],
      outputs: [
        'artifact:formal-gate-evidence',
        'artifact:formal-gate-finding'
      ],
      conditions: [
        'Affected package tests/builds, root tests/build, lint, dependency boundaries, and every release-flow Inspector test pass.',
        'Exact Asyra Design E2E covers startup, load, undo/redo, Group hierarchy, Collaboration, Render, AI action execution, cleanup, and instance isolation.',
        'Completed-plan performance budgets and synchronized visual cases pass with bounded evidence and no unresolved P0/P1/P2 review finding.',
        'Cleanup owner: run-formal-release-gates PID-tracks and disposes every server, browser, port, and test process it starts.'
      ],
      bypasses: [
        'Any required failed or unrun gate produces artifact:formal-gate-finding with the owning package, test, budget, or visual case.',
        'One downstream green gate never suppresses an upstream semantic, artifact, or clean-consumer failure.'
      ],
      allowedContributors: [
        'validated release artifacts and consumer/template evidence',
        'formal package/root/Inspector/E2E/performance/visual tests',
        'bounded primary and independent diff review'
      ],
      forbiddenContributors: [
        'manual screenshots as semantic authority',
        'untracked diagnostic output as the only oracle',
        'fallback product output or fixture-specific exception',
        'unbounded log output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-validate.js',
        'scripts/release-readiness.js',
        'scripts/__tests__',
        'packages/*/src/__tests__',
        'apps/asyra-design/__tests__',
        'apps/asyra-design/src/**/__tests__',
        'apps/asyra-design/e2e',
        'docs/ai/framework/plans/__tests__',
        'tools/flow-inspector/__tests__',
        'package.json',
        '.github/workflows'
      ],
      specRefs: [
        '#6-formal-quality-gates',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'run-formal-release-gates'
    },
    {
      id: 'synchronize-release-docs',
      order: 7,
      laneId: 'evidence',
      title: 'Synchronize public release documentation',
      ownerPackage: 'Framework and Asyra Design documentation owners',
      purpose:
        'Align public API, package, environment, migration, deprecation, license, attribution, security/contact, release-note, Golden Path, and generated-template documentation with validated behavior.',
      inputs: ['artifact:release-source-set'],
      outputs: [
        'artifact:release-docs-evidence',
        'artifact:release-docs-finding'
      ],
      conditions: [
        'Every public import and documented command resolves against the validated package or generated-template route.',
        'Supported Node, Yarn, TypeScript, React, browser, 2D, and CUSTOM ranges are explicit; unavailable 3D/HYBRID and Roadmap behavior remain unavailable.',
        'Deprecated and compatibility-only surfaces name their replacement and migration window without adding new runtime ownership.',
        'Cleanup owner: synchronize-release-docs owns only source documentation and detached link/command validation evidence.'
      ],
      bypasses: [
        'Contradictory, stale, unresolved, missing, or internal-only documentation produces artifact:release-docs-finding.',
        'Documentation cannot relabel a failed artifact or product flow as ready.'
      ],
      allowedContributors: [
        'artifact:release-source-set',
        'validated public API and environment evidence',
        'framework and Asyra Design current authority docs',
        'root and package release documentation'
      ],
      forbiddenContributors: [
        'historical audit as current behavior authority',
        'future profile or Roadmap capability as supported',
        'undocumented internal import',
        'release note used to waive a failed gate'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'README.md',
        'CHANGELOG.md',
        'RELEASE_NOTES.md',
        'LICENSE',
        'SECURITY.md',
        'packages/*/{README.md,CHANGELOG.md,package.json}',
        'docs/ai/framework',
        'docs/ai/apps/asyra-design',
        'docs/ai/workflows/package-release-validation.md',
        'apps/asyra-design/{README.md,CHANGELOG.md}'
      ],
      specRefs: [
        '#1-plan-and-contract-closure',
        '#7-release-records-and-handoff',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'synchronize-release-docs'
    },
    {
      id: 'verify-versioning-contract',
      order: 8,
      laneId: 'evidence',
      title: 'Verify versioning and release-record inputs',
      ownerPackage: 'Changesets and framework release-record owner',
      purpose:
        'Confirm one semantic-version candidate, aligned package versions and internal ranges, changelog inputs, and the separate actual-release-cut snapshot procedure without performing a release.',
      inputs: ['artifact:release-source-set'],
      outputs: [
        'artifact:versioning-evidence',
        'artifact:versioning-finding'
      ],
      conditions: [
        'Every published package has one intentional version and all packed internal ranges resolve to the matching tarball set.',
        'Changeset, changelog, migration/deprecation, and release-note inputs are internally consistent for review.',
        'The versioned framework decision snapshot remains an actual release-cut action and is not fabricated by readiness audit.',
        'Cleanup owner: verify-versioning-contract owns only detached version evidence and does not mutate registry, tags, or released decision snapshots.'
      ],
      bypasses: [
        'Version drift, missing release-note input, invalid internal range, or ambiguous snapshot ownership produces artifact:versioning-finding.',
        'No version, tag, registry record, or released snapshot is created merely to satisfy readiness.'
      ],
      allowedContributors: [
        'artifact:release-source-set',
        'package manifests and packed manifests',
        '.changeset configuration and pending entries',
        'framework decision-history rules'
      ],
      forbiddenContributors: [
        'registry publication',
        'tag creation',
        'released snapshot rewrite',
        'unapproved release-version decision'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        '.changeset',
        'package.json',
        'packages/*/package.json',
        'CHANGELOG.md',
        'RELEASE_NOTES.md',
        'docs/ai/framework/decisions/releases/README.md',
        'docs/ai/framework/decisions/releases/unreleased.md'
      ],
      specRefs: [
        '#3-package-artifacts-and-metadata',
        '#7-release-records-and-handoff',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'verify-versioning-contract'
    },
    {
      id: 'decide-release-readiness',
      order: 9,
      laneId: 'decision',
      title: 'Record READY or owner-specific BLOCKED',
      ownerPackage: 'Framework Release Gate 5 decision owner',
      purpose:
        'Consume only executable evidence and exact owner findings, then record a reproducible readiness decision without authorizing publication or release.',
      inputs: [
        'artifact:source-finding',
        'artifact:package-build-finding',
        'artifact:package-validation-finding',
        'artifact:clean-consumer-evidence',
        'artifact:clean-consumer-finding',
        'artifact:generated-template-evidence',
        'artifact:generated-template-finding',
        'artifact:formal-gate-evidence',
        'artifact:formal-gate-finding',
        'artifact:release-docs-evidence',
        'artifact:release-docs-finding',
        'artifact:versioning-evidence',
        'artifact:versioning-finding'
      ],
      outputs: ['artifact:ready-result', 'artifact:blocked-result'],
      conditions: [
        'READY requires package, clean-consumer, generated-template, formal-gate, documentation, and versioning evidence from the same frozen baseline with no P0/P1/P2 finding.',
        'BLOCKED lists every still-relevant exact owner, failed gate, concise error, and reproducible artifact or command evidence.',
        'A READY decision triggers plan closeout while retaining this Inspector as architecture authority.',
        'Cleanup owner: decide-release-readiness owns the concise decision record only; repository push/PR is separate, while merge, tag, registry publication, deployment, and formal release remain user-owned.'
      ],
      bypasses: [
        'Any source, package, consumer, template, formal-gate, documentation, or versioning finding forces artifact:blocked-result.',
        'READY cannot be inferred from workspace builds, generated output, documentation, or PR checks alone.'
      ],
      allowedContributors: [
        'current-baseline executable evidence artifacts',
        'exact owner findings',
        'bounded primary and independent review',
        'append-only decision history and completed plan record'
      ],
      forbiddenContributors: [
        'self-referential readiness matrix or closure packet',
        'waiver of P0/P1/P2 finding',
        'merge, tag, registry publication, deployment, or formal release',
        'historical evidence from another baseline as pass authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md',
        'docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md',
        'docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs',
        'docs/ai/framework/plans/framework-release-readiness-flow-inspector.html',
        'docs/ai/framework/decisions/releases/unreleased.md',
        'RELEASE_NOTES.md',
        'scripts/release-records.js',
        'scripts/__tests__/release-records.test.mjs'
      ],
      specRefs: [
        '#7-release-records-and-handoff',
        '#stop-and-failure-conditions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'decide-release-readiness'
    }
  ]

  const routes = [
    {
      id: 'source-to-package-build',
      from: 'freeze-release-source',
      to: 'build-package-artifacts',
      kind: 'artifact',
      predicate: 'The frozen source inventory has no blocking finding.',
      producedArtifacts: ['artifact:release-source-set']
    },
    {
      id: 'source-to-template',
      from: 'freeze-release-source',
      to: 'verify-generated-template',
      kind: 'artifact',
      predicate: 'The frozen source inventory identifies Asyra Design.',
      producedArtifacts: ['artifact:release-source-set']
    },
    {
      id: 'source-to-docs',
      from: 'freeze-release-source',
      to: 'synchronize-release-docs',
      kind: 'artifact',
      predicate: 'The supported and unsupported release surface is frozen.',
      producedArtifacts: ['artifact:release-source-set']
    },
    {
      id: 'source-to-versioning',
      from: 'freeze-release-source',
      to: 'verify-versioning-contract',
      kind: 'artifact',
      predicate: 'The release package set and current versions are known.',
      producedArtifacts: ['artifact:release-source-set']
    },
    {
      id: 'source-failure-to-decision',
      from: 'freeze-release-source',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'A prerequisite gate or source contract is incomplete.',
      producedArtifacts: ['artifact:source-finding']
    },
    {
      id: 'packed-set-to-validation',
      from: 'build-package-artifacts',
      to: 'validate-package-artifacts',
      kind: 'artifact',
      predicate: 'Every frozen package built and packed successfully.',
      producedArtifacts: ['artifact:packed-package-set']
    },
    {
      id: 'package-build-failure-to-decision',
      from: 'build-package-artifacts',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'A package build or pack operation failed.',
      producedArtifacts: ['artifact:package-build-finding']
    },
    {
      id: 'validated-set-to-consumer',
      from: 'validate-package-artifacts',
      to: 'verify-clean-consumer',
      kind: 'artifact',
      predicate: 'Every tarball passed metadata and content validation.',
      producedArtifacts: ['artifact:validated-package-set']
    },
    {
      id: 'validated-set-to-formal-gates',
      from: 'validate-package-artifacts',
      to: 'run-formal-release-gates',
      kind: 'artifact',
      predicate: 'Formal gates may consume the validated tarball set.',
      producedArtifacts: ['artifact:validated-package-set']
    },
    {
      id: 'package-validation-failure-to-decision',
      from: 'validate-package-artifacts',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'A tarball contract is invalid.',
      producedArtifacts: ['artifact:package-validation-finding']
    },
    {
      id: 'consumer-evidence-to-formal-gates',
      from: 'verify-clean-consumer',
      to: 'run-formal-release-gates',
      kind: 'artifact',
      predicate: 'The packed-only consumer passes.',
      producedArtifacts: ['artifact:clean-consumer-evidence']
    },
    {
      id: 'consumer-evidence-to-decision',
      from: 'verify-clean-consumer',
      to: 'decide-release-readiness',
      kind: 'evidence',
      predicate: 'The packed-only consumer evidence belongs to this baseline.',
      producedArtifacts: ['artifact:clean-consumer-evidence']
    },
    {
      id: 'consumer-failure-to-decision',
      from: 'verify-clean-consumer',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'Install, compile, import, runtime, or inertness proof failed.',
      producedArtifacts: ['artifact:clean-consumer-finding']
    },
    {
      id: 'template-evidence-to-formal-gates',
      from: 'verify-generated-template',
      to: 'run-formal-release-gates',
      kind: 'artifact',
      predicate: 'The generated template is synchronized and buildable.',
      producedArtifacts: ['artifact:generated-template-evidence']
    },
    {
      id: 'template-evidence-to-decision',
      from: 'verify-generated-template',
      to: 'decide-release-readiness',
      kind: 'evidence',
      predicate: 'The template evidence belongs to this baseline.',
      producedArtifacts: ['artifact:generated-template-evidence']
    },
    {
      id: 'template-failure-to-decision',
      from: 'verify-generated-template',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'Template synchronization or consumer commands failed.',
      producedArtifacts: ['artifact:generated-template-finding']
    },
    {
      id: 'formal-evidence-to-decision',
      from: 'run-formal-release-gates',
      to: 'decide-release-readiness',
      kind: 'evidence',
      predicate: 'Every required formal gate passed.',
      producedArtifacts: ['artifact:formal-gate-evidence']
    },
    {
      id: 'formal-failure-to-decision',
      from: 'run-formal-release-gates',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'A required formal gate or P0/P1/P2 review finding remains.',
      producedArtifacts: ['artifact:formal-gate-finding']
    },
    {
      id: 'docs-evidence-to-decision',
      from: 'synchronize-release-docs',
      to: 'decide-release-readiness',
      kind: 'evidence',
      predicate: 'Public docs match validated behavior and environments.',
      producedArtifacts: ['artifact:release-docs-evidence']
    },
    {
      id: 'docs-failure-to-decision',
      from: 'synchronize-release-docs',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'A public document is stale, contradictory, or unresolved.',
      producedArtifacts: ['artifact:release-docs-finding']
    },
    {
      id: 'versioning-evidence-to-decision',
      from: 'verify-versioning-contract',
      to: 'decide-release-readiness',
      kind: 'evidence',
      predicate: 'Version and release-record inputs are internally consistent.',
      producedArtifacts: ['artifact:versioning-evidence']
    },
    {
      id: 'versioning-failure-to-decision',
      from: 'verify-versioning-contract',
      to: 'decide-release-readiness',
      kind: 'failure',
      predicate: 'Version or release-record ownership is inconsistent.',
      producedArtifacts: ['artifact:versioning-finding']
    },
    {
      id: 'ready-terminal',
      from: 'decide-release-readiness',
      kind: 'terminal',
      predicate: 'Every required evidence artifact passes with no P0/P1/P2.',
      producedArtifacts: ['artifact:ready-result']
    },
    {
      id: 'blocked-terminal',
      from: 'decide-release-readiness',
      kind: 'terminal',
      predicate: 'At least one exact owner finding remains.',
      producedArtifacts: ['artifact:blocked-result']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:release-source-set',
      ownerStepId: 'freeze-release-source',
      channel: 'release source contract',
      consumerStepIds: [
        'build-package-artifacts',
        'verify-generated-template',
        'synchronize-release-docs',
        'verify-versioning-contract'
      ]
    },
    {
      id: 'artifact:source-finding',
      ownerStepId: 'freeze-release-source',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:packed-package-set',
      ownerStepId: 'build-package-artifacts',
      channel: 'ignored project-local tarballs',
      consumerStepIds: ['validate-package-artifacts']
    },
    {
      id: 'artifact:package-build-finding',
      ownerStepId: 'build-package-artifacts',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:validated-package-set',
      ownerStepId: 'validate-package-artifacts',
      channel: 'detached artifact validation',
      consumerStepIds: [
        'verify-clean-consumer',
        'run-formal-release-gates'
      ]
    },
    {
      id: 'artifact:package-validation-finding',
      ownerStepId: 'validate-package-artifacts',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:clean-consumer-evidence',
      ownerStepId: 'verify-clean-consumer',
      channel: 'packed-only consumer result',
      consumerStepIds: [
        'run-formal-release-gates',
        'decide-release-readiness'
      ]
    },
    {
      id: 'artifact:clean-consumer-finding',
      ownerStepId: 'verify-clean-consumer',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:generated-template-evidence',
      ownerStepId: 'verify-generated-template',
      channel: 'official generator result',
      consumerStepIds: [
        'run-formal-release-gates',
        'decide-release-readiness'
      ]
    },
    {
      id: 'artifact:generated-template-finding',
      ownerStepId: 'verify-generated-template',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:formal-gate-evidence',
      ownerStepId: 'run-formal-release-gates',
      channel: 'formal gate result',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:formal-gate-finding',
      ownerStepId: 'run-formal-release-gates',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:release-docs-evidence',
      ownerStepId: 'synchronize-release-docs',
      channel: 'documentation validation',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:release-docs-finding',
      ownerStepId: 'synchronize-release-docs',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:versioning-evidence',
      ownerStepId: 'verify-versioning-contract',
      channel: 'version contract validation',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:versioning-finding',
      ownerStepId: 'verify-versioning-contract',
      channel: 'owner finding',
      consumerStepIds: ['decide-release-readiness']
    },
    {
      id: 'artifact:ready-result',
      ownerStepId: 'decide-release-readiness',
      channel: 'terminal release-readiness decision',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:blocked-result',
      ownerStepId: 'decide-release-readiness',
      channel: 'terminal release-readiness decision',
      consumerStepIds: [],
      terminal: true
    }
  ]

  artifacts.forEach((artifact) => {
    if (!Object.hasOwn(artifact, 'terminal')) artifact.terminal = false
  })

  const invariants = [
    {
      id: 'artifact-owner-invariant',
      title: 'Every release artifact has exactly one owner',
      statement:
        'Source inventory, tarballs, validation, consumer, template, formal gates, docs, versioning, and the terminal decision are never jointly owned or recreated downstream.',
      stepIds: steps.map((step) => step.id),
      artifactIds: artifacts.map((artifact) => artifact.id),
      specRefs: ['#audit-scope', '#definition-of-done']
    },
    {
      id: 'packed-only-consumer-invariant',
      title: 'Consumer proof uses published artifacts alone',
      statement:
        'Clean-consumer compilation and runtime flows resolve only validated tarballs plus declared external dependencies, never workspace aliases, source paths, links, or hoisting.',
      stepIds: [
        'build-package-artifacts',
        'validate-package-artifacts',
        'verify-clean-consumer'
      ],
      artifactIds: [
        'artifact:packed-package-set',
        'artifact:validated-package-set',
        'artifact:clean-consumer-evidence'
      ],
      specRefs: [
        '#3-package-artifacts-and-metadata',
        '#4-clean-consumer-verification'
      ]
    },
    {
      id: 'optional-inertness-invariant',
      title: 'Optional runtimes are inert until activated',
      statement:
        'Collaboration and AI imports or omission create no provider, room, Awareness, model, secret, timer, listener, network, or lifecycle side effect.',
      stepIds: ['verify-clean-consumer', 'run-formal-release-gates'],
      artifactIds: [
        'artifact:clean-consumer-evidence',
        'artifact:formal-gate-evidence'
      ],
      specRefs: [
        '#2-public-api-and-package-boundary',
        '#4-clean-consumer-verification'
      ]
    },
    {
      id: 'publication-authority-invariant',
      title: 'Readiness is separate from release authority',
      statement:
        'READY may close Gate 5 and support a review PR but never authorizes merge, tag, registry publication, deployment, or formal release.',
      stepIds: ['verify-versioning-contract', 'decide-release-readiness'],
      artifactIds: [
        'artifact:versioning-evidence',
        'artifact:ready-result',
        'artifact:blocked-result'
      ],
      specRefs: ['#7-release-records-and-handoff', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'source-and-prerequisite-closure',
      title: 'Prerequisite gates and frozen public source',
      assertions: [
        'Gate 1 through Gate 4 are archived with retained Inspector authority and no contradictory active release blocker.',
        'The intended package names, exports, types, entrypoints, dependencies, deprecations, and supported environments form one frozen release source set.'
      ],
      stepIds: ['freeze-release-source'],
      specRefs: [
        '#1-plan-and-contract-closure',
        '#2-public-api-and-package-boundary'
      ]
    },
    {
      id: 'package-artifact-case',
      title: 'All-package tarball contract',
      assertions: [
        'Every frozen release package produces one reviewable project-local tarball whose declared metadata and entrypoints resolve.',
        'Tarballs contain required runtime/types/license files, exclude repository-only or secret files, and contain no workspace/path dependency.'
      ],
      stepIds: ['build-package-artifacts', 'validate-package-artifacts'],
      specRefs: ['#3-package-artifacts-and-metadata', '#definition-of-done']
    },
    {
      id: 'clean-consumer-case',
      title: 'Packed-only clean consumer',
      assertions: [
        'A clean isolated consumer installs only tarballs, compiles documented imports, and runs Core, Preset 2D, transaction undo/redo, migration, and Group group/ungroup flows.',
        'Opt-in Collaboration converges, opt-in AI executes registered actions through one app-owned lifecycle/transaction, and disabled optional runtimes create no provider/network/secret side effect.'
      ],
      stepIds: ['verify-clean-consumer'],
      specRefs: ['#4-clean-consumer-verification', '#definition-of-done']
    },
    {
      id: 'generated-template-case',
      title: 'Official generated consumer',
      assertions: [
        'The official generator produces a synchronized template with public migration, Preset, Group, optional Collaboration, and optional AI routes.',
        'The generated consumer passes its documented install/build/test/startup smoke path without manual repair or internal import.'
      ],
      stepIds: ['verify-generated-template'],
      specRefs: ['#5-generated-templates-and-examples', '#definition-of-done']
    },
    {
      id: 'formal-quality-case',
      title: 'Formal, performance, visual, and review gates',
      assertions: [
        'Package/root build and tests, lint, dependency boundaries, Inspectors, exact E2E, performance budgets, and synchronized visual review pass.',
        'Primary and independent bounded review report no unresolved P0/P1/P2 finding.'
      ],
      stepIds: ['run-formal-release-gates'],
      specRefs: ['#6-formal-quality-gates', '#definition-of-done']
    },
    {
      id: 'documentation-and-version-case',
      title: 'Public docs, environment, and version records',
      assertions: [
        'Public docs, support ranges, migration/deprecation, license/attribution, security/contact, and release notes match validated behavior.',
        'Versioning inputs are consistent while the versioned decision snapshot remains owned by the actual release cut.'
      ],
      stepIds: ['synchronize-release-docs', 'verify-versioning-contract'],
      specRefs: ['#7-release-records-and-handoff', '#definition-of-done']
    },
    {
      id: 'readiness-decision-case',
      title: 'Reproducible READY or exact BLOCKED',
      assertions: [
        'READY is emitted only from all required same-baseline evidence with no P0/P1/P2 finding; otherwise BLOCKED names exact owners and evidence.',
        'Closeout retains Inspector authority and does not authorize merge, tag, registry publication, deployment, or formal release.'
      ],
      stepIds: ['decide-release-readiness'],
      specRefs: ['#stop-and-failure-conditions', '#definition-of-done']
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'framework-release-readiness',
      kind: 'system',
      title: 'Framework Release Readiness Flow Inspector',
      subtitle:
        'Frozen release source through all-package tarballs, packed-only consumers, generated templates, formal evidence, public records, and a publication-neutral READY or owner-specific BLOCKED decision.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Framework Release Gate 5 product contract',
      inspectorOwner: 'Framework Release Readiness Flow Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/framework-release-readiness-and-closeout-plan.md',
        kind: 'authority'
      },
      {
        id: 'release-workflow',
        label: 'Release Workflow',
        href: '../../workflows/package-release-validation.md',
        kind: 'framework'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../../tools/flow-inspector/FLOW_INSPECTOR.md',
        kind: 'framework'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const freeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }

  freeze(data)
  if (typeof globalThis !== 'undefined') globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) module.exports = data
})()
