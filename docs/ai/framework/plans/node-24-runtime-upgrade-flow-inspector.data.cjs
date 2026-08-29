/* global module */

;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.data.cjs'

  const lanes = [
    { id: 'contract', title: 'Runtime Contract', order: 1 },
    { id: 'repository', title: 'Repository Compatibility', order: 2 },
    { id: 'automation', title: 'Automation and Generated Output', order: 3 },
    { id: 'application', title: 'Application Runtime Evidence', order: 4 },
    { id: 'deployment', title: 'Vercel Deployment Runtime', order: 5 },
    { id: 'support', title: 'Support and Decision', order: 6 }
  ]

  const steps = [
    {
      id: 'freeze-runtime-source',
      order: 1,
      laneId: 'contract',
      title: 'Freeze the Node.js 24 runtime source',
      ownerPackage: 'Repository root runtime contract',
      purpose:
        'Select the available Node.js 24 LTS baseline, preserve Yarn 4.3.1, and make the root manifest plus formal runtime assertions the one repository-wide supported-runtime source.',
      inputs: [
        'Node.js 24 migration product contract',
        'local Node, Corepack, Yarn, OS, and architecture evidence',
        'official Node.js LTS support evidence',
        'linked Asyra Design Vercel project identity and current runtime metadata'
      ],
      outputs: ['artifact:runtime-contract', 'artifact:runtime-source-finding'],
      conditions: [
        'The selected local runtime is one available Node.js 24.x LTS patch and the portable contract is the Node.js 24.x major line.',
        'Corepack is recorded and the repository package-manager contract remains Yarn 4.3.1.',
        'Formal assertions require Node.js 24 before any downstream canonical declaration is changed.',
        'Cleanup owner: freeze-runtime-source owns no server, browser, port, deployment, or project-external installation.'
      ],
      bypasses: [
        'A missing local Node.js 24 runtime, an installation that would write outside the project, a required Yarn/toolchain change, or contradictory support evidence produces artifact:runtime-source-finding.',
        'A Node.js version outside major 24 cannot produce artifact:runtime-contract.'
      ],
      allowedContributors: [
        'Node.js official LTS support records',
        'repository root package.json',
        'formal runtime contract tests',
        'read-only local and linked-project metadata'
      ],
      forbiddenContributors: [
        'new version manager, package, dependency, binary, or development tool',
        'Yarn version other than 4.3.1',
        'package version bump, Changeset, tag, publication, or release',
        'browser-only evidence used as local Node evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'scripts/__tests__/node-runtime-contract.test.mjs',
        'docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md',
        'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.data.cjs',
        'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.html',
        'docs/ai/framework/plans/__tests__/node-24-runtime-upgrade-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#goal',
        '#bounded-task-contract',
        '#required-inspector',
        '#1-freeze-nodejs-24-baseline',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-runtime-source'
    },
    {
      id: 'validate-manifest-compatibility',
      order: 2,
      laneId: 'repository',
      title: 'Validate workspace and package manifests',
      ownerPackage: 'Workspace manifest runtime contract',
      purpose:
        'Require the root-selected Node.js 24.x contract in all 19 Framework packages, Asyra Design, the packed-only consumer fixture, and every supported manifest consumer without changing package versions or dependencies.',
      inputs: ['artifact:runtime-contract'],
      outputs: [
        'artifact:manifest-compatibility',
        'artifact:manifest-compatibility-finding'
      ],
      conditions: [
        'All 19 public Framework manifests declare exactly Node.js 24.x.',
        'Asyra Design declares Node.js 24.x at the Vercel project root package and the durable clean-consumer fixture declares the same major.',
        'Package names, versions, dependency ranges, packageManager fields, and Yarn 4.3.1 remain otherwise unchanged.',
        'Cleanup owner: validate-manifest-compatibility owns no generated output, install directory, tarball, server, browser, or port.'
      ],
      bypasses: [
        'A manifest outside the supported set is not rewritten merely because it contains similar syntax.',
        'Any missing or contradictory supported manifest produces artifact:manifest-compatibility-finding and blocks artifact, app, CI, and deployment proof.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'root, Framework package, Asyra Design, and clean-consumer manifests',
        'formal manifest compatibility assertions'
      ],
      forbiddenContributors: [
        'package version changes',
        'dependency or package-manager changes',
        'manual edits to create-app generated output',
        'unrelated workspace metadata cleanup'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/*/package.json',
        'apps/asyra-design/package.json',
        'fixtures/framework-release-consumer/package.json',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: [
        '#bounded-task-contract',
        '#2-strengthen-runtime-tests-first',
        '#3-update-canonical-runtime-owners',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-manifest-compatibility'
    },
    {
      id: 'validate-package-release-scripts',
      order: 3,
      laneId: 'repository',
      title: 'Validate package and release scripts',
      ownerPackage: 'Framework release runtime validation',
      purpose:
        'Make package packing, packed metadata validation, clean-consumer execution, and generated-template readiness accept only Node.js 24.x while retaining the existing diagnostic and publication boundaries.',
      inputs: ['artifact:runtime-contract', 'artifact:manifest-compatibility'],
      outputs: [
        'artifact:release-runtime-contract',
        'artifact:release-runtime-finding'
      ],
      conditions: [
        'Package artifact validation requires Node.js 24.x metadata for every one of the 19 tarballs.',
        'Clean-consumer and generated-template readiness reject a non-24 execution runtime unless the existing diagnostic-only override is explicitly selected.',
        'Focused release runtime tests name Node.js 24.x without changing candidate package versions or granting publication; public release-record support assertions remain owned by synchronize-runtime-support.',
        'Cleanup owner: validate-package-release-scripts retains the existing release harness ownership for project-local tarballs, isolated consumers, evidence, child processes, and cleanup.'
      ],
      bypasses: [
        'The existing unsupported-runtime override remains diagnostic-only and cannot produce READY.',
        'Any artifact, consumer, script, or release-record mismatch produces artifact:release-runtime-finding at this owner.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'release package, clean-consumer, and template-readiness scripts',
        'focused release automation tests'
      ],
      forbiddenContributors: [
        'workspace source fallback inside packed consumers',
        'allowed-failure Node.js 24 route',
        'package version bump, publication, tag, or formal release',
        'product behavior change or dependency upgrade'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-package-artifacts.js',
        'scripts/release-readiness.js',
        'scripts/release-template-readiness.js',
        'scripts/__tests__/release-automation.test.mjs',
        'scripts/__tests__/release-package-artifacts.test.mjs',
        'scripts/__tests__/release-clean-consumer.test.mjs',
        'scripts/__tests__/release-template-readiness.test.mjs',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: [
        '#2-strengthen-runtime-tests-first',
        '#3-update-canonical-runtime-owners',
        '#4-validate-locally-on-nodejs-24',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-package-release-scripts'
    },
    {
      id: 'validate-generated-template',
      order: 4,
      laneId: 'automation',
      title: 'Validate the generated template contract',
      ownerPackage: 'Official Asyra Design template generator',
      purpose:
        'Make the official generator produce the Node.js 24.x template contract, regenerate committed create-app output only through that generator, and prove the packed-only generated consumer under Node.js 24.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract'
      ],
      outputs: [
        'artifact:generated-template-contract',
        'artifact:generated-template-finding'
      ],
      conditions: [
        'scripts/release-template.js is the sole owner that writes the generated package engine and synchronizes the template README from the app source.',
        'Generated package.json and README require Node.js 24.x and Yarn 4.3.1 and contain no workspace-only path.',
        'Template synchronization, packed-artifact install, build, tests, startup smoke, and cleanup use the formal generator/readiness commands.',
        'Cleanup owner: validate-generated-template owns generator comparison output, isolated template consumers, child processes, smoke ports, and their removal.'
      ],
      bypasses: [
        'Manual implementation edits under create-app/asyra-design/template are forbidden; mismatches return to the generator owner.',
        'Any generator, parity, packed install, build, test, startup, or cleanup failure produces artifact:generated-template-finding.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract',
        'apps/asyra-design source template inputs',
        'official release-template generator and readiness harness'
      ],
      forbiddenContributors: [
        'manual generated-output repair',
        'workspace alias or node_modules fallback',
        'dependency, Yarn, or package version change',
        'generated output used as source authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-template.js',
        'scripts/release-template-readiness.js',
        'scripts/__tests__/release-automation.test.mjs',
        'scripts/__tests__/release-template-readiness.test.mjs',
        'apps/asyra-design/README.md',
        'create-app/asyra-design/template/package.json',
        'create-app/asyra-design/template/README.md',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: [
        '#2-strengthen-runtime-tests-first',
        '#3-update-canonical-runtime-owners',
        '#4-validate-locally-on-nodejs-24',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-generated-template'
    },
    {
      id: 'validate-ci-runtime',
      order: 5,
      laneId: 'automation',
      title: 'Validate the CI Node.js runtime',
      ownerPackage: 'GitHub Actions runtime configuration',
      purpose:
        'Run the complete validation, release-readiness, E2E, collaboration, performance, and deploy-preparation jobs on the selected Node.js 24 line without a Node.js 20 fallback or allowed failure.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract'
      ],
      outputs: ['artifact:ci-runtime-contract', 'artifact:ci-runtime-finding'],
      conditions: [
        'Every actions/setup-node owner in main and E2E workflows selects Node.js 24.',
        'CI preserves Yarn 4.3.1 and the existing build, tests, lint, dependency, artifact, consumer, template, E2E, collaboration, and performance gates.',
        'Required checks must pass from the pushed feature branch before READY.',
        'Cleanup owner: GitHub Actions owns hosted runners and job cleanup; repository workflows introduce no persistent project resource.'
      ],
      bypasses: [
        'Node.js 20 green plus Node.js 24 allowed failure is forbidden.',
        'Any workflow mismatch or failed required check produces artifact:ci-runtime-finding and blocks deployment readiness.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract',
        'GitHub Actions workflows and formal workflow assertions'
      ],
      forbiddenContributors: [
        'continue-on-error for Node.js 24 compatibility',
        'Node.js 20 fallback matrix',
        'dependency or Yarn upgrade',
        'merge, release, tag, or publication authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        '.github/workflows/main.yml',
        '.github/workflows/e2e.yml',
        'scripts/__tests__/workspace-automation.test.mjs',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: [
        '#3-update-canonical-runtime-owners',
        '#5-validate-ci-on-nodejs-24',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-ci-runtime'
    },
    {
      id: 'validate-asyra-design-runtime',
      order: 6,
      laneId: 'application',
      title: 'Validate Asyra Design locally',
      ownerPackage: 'Asyra Design local runtime validation',
      purpose:
        'Prove the complete workspace and Asyra Design build, Node server paths, browser flows, collaboration, performance budgets, and visual gates on Node.js 24 without treating browser execution as Node execution.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract',
        'artifact:ci-runtime-contract'
      ],
      outputs: [
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence',
        'artifact:asyra-design-runtime-finding'
      ],
      conditions: [
        'Immutable install, Turbo graph, dependency boundaries, full workspace build/tests/lint, Inspector tests, tarballs, clean consumer, generated template, and Asyra Design production build execute under local Node.js 24.',
        'Asyra Design ordinary E2E, collaboration E2E, performance gates, and current formal visual gates produce separate browser-runtime evidence.',
        'Browser pass does not waive a local build, server, package, artifact, or template failure.',
        'Cleanup owner: validate-asyra-design-runtime PID-tracks and removes every agent-started server, browser, child process, temporary project-local artifact, and extra port.'
      ],
      bypasses: [
        'A product behavior regression, runtime failure, leaked process, or unresolved P0/P1/P2 finding produces artifact:asyra-design-runtime-finding.',
        'A browser-only pass never produces artifact:local-node-evidence.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract',
        'artifact:ci-runtime-contract',
        'formal root, package, app, E2E, performance, visual, and Inspector gates'
      ],
      forbiddenContributors: [
        'manual screenshot as a substitute for a formal gate',
        'browser runtime used as Node build or server evidence',
        'fixture-specific exception, fallback output, or skipped gate',
        'product behavior or dependency change'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'turbo.json',
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'apps/asyra-design/playwright*.config.ts',
        'scripts/run-e2e.sh',
        'scripts/release-package-artifacts.js',
        'scripts/release-readiness.js',
        'scripts/release-template-readiness.js',
        'tools/flow-inspector/__tests__/viewer-entry.test.cjs'
      ],
      specRefs: ['#4-validate-locally-on-nodejs-24', '#definition-of-done'],
      failureOwnerStepId: 'validate-asyra-design-runtime'
    },
    {
      id: 'validate-vercel-runtime',
      order: 7,
      laneId: 'deployment',
      title: 'Validate Vercel build and function runtime',
      ownerPackage: 'Linked Asyra Design Vercel project',
      purpose:
        'Set the existing project build/runtime to Node.js 24.x, create a feature-branch preview, and separately prove the build runtime, deployed frontend, and every project-owned Vercel function or middleware route.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:ci-runtime-contract',
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence'
      ],
      outputs: [
        'artifact:vercel-build-evidence',
        'artifact:vercel-function-evidence',
        'artifact:vercel-frontend-evidence',
        'artifact:vercel-runtime-finding'
      ],
      conditions: [
        'The existing linked Asyra Design project setting is Node.js 24.x and apps/asyra-design/package.json independently selects the same major.',
        'The preview build log reports the actual Node.js 24.x patch used by the Vercel build runtime.',
        'The deployed frontend passes smoke verification independently from build success.',
        'Every project-owned Vercel function or middleware route is exercised; when none exists, artifact:vercel-function-evidence explicitly records not-applicable rather than borrowing frontend evidence.',
        'Required environment variable names remain configured for Preview without exposing values.',
        'Cleanup owner: Vercel owns preview build/function processes; validate-vercel-runtime owns only preview inspection and does not create a production deployment.'
      ],
      bypasses: [
        'Vercel rejection of Node.js 24.x, a Node 20 build, missing required environment configuration, or a failed frontend/function path produces artifact:vercel-runtime-finding.',
        'Production deployment is forbidden and cannot replace preview evidence.'
      ],
      allowedContributors: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:ci-runtime-contract',
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence',
        'apps/asyra-design/package.json',
        'vercel.json',
        'linked Vercel Project Settings, preview build logs, deployment metadata, and smoke responses'
      ],
      forbiddenContributors: [
        'production deployment',
        'browser pass used as Vercel build or function runtime evidence',
        'secret values in logs, source, artifacts, comments, or reports',
        'new Vercel project or unrelated deployment configuration'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'vercel.json',
        '.vercel/project.json read-only linked-project metadata',
        'existing linked Asyra Design Vercel Project Settings',
        'existing linked Asyra Design Vercel preview deployments',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: [
        '#1-freeze-nodejs-24-baseline',
        '#3-update-canonical-runtime-owners',
        '#6-validate-vercel',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-vercel-runtime'
    },
    {
      id: 'synchronize-runtime-support',
      order: 8,
      laneId: 'support',
      title: 'Synchronize runtime support documentation',
      ownerPackage: 'Framework and Asyra Design support documentation',
      purpose:
        'Replace current Node.js 20 support claims with Node.js 24.x only after local, CI, package, generated-template, app, and Vercel evidence all agree, while leaving historical point-in-time evidence intact.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract',
        'artifact:ci-runtime-contract',
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence',
        'artifact:vercel-build-evidence',
        'artifact:vercel-function-evidence',
        'artifact:vercel-frontend-evidence'
      ],
      outputs: [
        'artifact:runtime-support-contract',
        'artifact:runtime-support-finding'
      ],
      conditions: [
        'Current public support records, root/app/template/package READMEs, release validation workflow, changelog, and release notes consistently name Node.js 24.x and Yarn 4.3.1.',
        'Generated README changes originate in apps/asyra-design/README.md and the official generator.',
        'Historical completed-plan evidence remains a point-in-time Node.js 20 record unless it asserts current support.',
        'Cleanup owner: synchronize-runtime-support owns documentation changes only and creates no runtime process, artifact, deployment, or publication.'
      ],
      bypasses: [
        'Documentation cannot relabel a failed runtime owner or missing Vercel evidence as supported.',
        'Any contradiction in current support records produces artifact:runtime-support-finding.'
      ],
      allowedContributors: [
        'all successful runtime evidence artifacts',
        'current framework, package, app, template, release, and workflow support records',
        'docs-contract synchronization checks'
      ],
      forbiddenContributors: [
        'historical evidence rewritten as if it ran on Node.js 24',
        'future support promise without executable evidence',
        'generated README edited by hand',
        'version bump, Changeset, publication, tag, or release record'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'README.md',
        'CHANGELOG.md',
        'RELEASE_NOTES.md',
        'packages/*/README.md',
        'apps/asyra-design/README.md',
        'create-app/asyra-design/template/README.md',
        'docs/ai/framework/RELEASE_SUPPORT.md',
        'docs/ai/workflows/package-release-validation.md',
        'scripts/release-records.js',
        'scripts/__tests__/release-records.test.mjs',
        'scripts/__tests__/node-runtime-contract.test.mjs'
      ],
      specRefs: ['#7-synchronize-support-records', '#definition-of-done'],
      failureOwnerStepId: 'synchronize-runtime-support'
    },
    {
      id: 'decide-node-24-readiness',
      order: 9,
      laneId: 'support',
      title: 'Decide READY or owner-specific BLOCKED',
      ownerPackage: 'Node.js 24 migration readiness decision',
      purpose:
        'Emit READY only from same-branch local, CI, package, template, Asyra Design, and Vercel preview evidence with no unresolved P0/P1/P2 finding; otherwise preserve an exact owner-specific BLOCKED result.',
      inputs: [
        'artifact:runtime-contract',
        'artifact:manifest-compatibility',
        'artifact:release-runtime-contract',
        'artifact:generated-template-contract',
        'artifact:ci-runtime-contract',
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence',
        'artifact:vercel-build-evidence',
        'artifact:vercel-function-evidence',
        'artifact:vercel-frontend-evidence',
        'artifact:runtime-support-contract',
        'artifact:runtime-source-finding',
        'artifact:manifest-compatibility-finding',
        'artifact:release-runtime-finding',
        'artifact:generated-template-finding',
        'artifact:ci-runtime-finding',
        'artifact:asyra-design-runtime-finding',
        'artifact:vercel-runtime-finding',
        'artifact:runtime-support-finding'
      ],
      outputs: ['artifact:node-24-ready', 'artifact:node-24-blocked'],
      conditions: [
        'READY requires every non-finding evidence artifact from the same reviewed feature branch and no unresolved P0/P1/P2 finding.',
        'READY records the commit SHA, PR URL, Node/Corepack/Yarn versions, local and CI gates, Vercel preview URL, and Node.js 24 build evidence.',
        'Successful closeout updates the Framework plans index, archives the completed plan, retains this Inspector as authority, and appends decision history.',
        'Cleanup owner: decide-node-24-readiness owns only durable plan/index/decision records and no deployment, package, registry, tag, merge, or release resource.'
      ],
      bypasses: [
        'Any required finding or missing evidence emits artifact:node-24-blocked with the first incorrect canonical owner and reproducible evidence.',
        'BLOCKED forbids package version bump, publish, tag, production deployment, merge, and formal release.'
      ],
      allowedContributors: [
        'all declared evidence and finding artifacts',
        'feature-branch commit and ready-for-review pull-request metadata',
        'required-check results and Vercel preview evidence',
        'Framework plans index and decision history'
      ],
      forbiddenContributors: [
        'partial green subset relabeled READY',
        'browser-only or frontend-only evidence for build/server/function runtime',
        'package version bump, Changeset, registry publication, tag, merge, production deployment, or formal release',
        'unresolved P0/P1/P2 finding'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md',
        'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.data.cjs',
        'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.html',
        'docs/ai/framework/plans/__tests__/node-24-runtime-upgrade-flow-inspector.contract.test.cjs',
        'docs/ai/framework/decisions/releases/unreleased.md',
        'docs/ai/decisions/releases/unreleased.md'
      ],
      specRefs: [
        '#status',
        '#bounded-task-contract',
        '#7-synchronize-support-records',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'decide-node-24-readiness'
    }
  ]

  const routes = [
    {
      id: 'runtime-contract-to-manifests',
      from: 'freeze-runtime-source',
      to: 'validate-manifest-compatibility',
      kind: 'runtime contract',
      predicate: 'Node.js 24.x and Yarn 4.3.1 baseline is resolved',
      producedArtifacts: ['artifact:runtime-contract']
    },
    {
      id: 'manifests-to-release',
      from: 'validate-manifest-compatibility',
      to: 'validate-package-release-scripts',
      kind: 'manifest compatibility',
      predicate: 'all supported manifests declare the runtime contract',
      producedArtifacts: ['artifact:manifest-compatibility']
    },
    {
      id: 'release-to-template',
      from: 'validate-package-release-scripts',
      to: 'validate-generated-template',
      kind: 'release runtime contract',
      predicate: 'package and consumer runtime enforcement is exact',
      producedArtifacts: ['artifact:release-runtime-contract']
    },
    {
      id: 'template-to-ci',
      from: 'validate-generated-template',
      to: 'validate-ci-runtime',
      kind: 'generated consumer contract',
      predicate: 'official generator and output require Node.js 24.x',
      producedArtifacts: ['artifact:generated-template-contract']
    },
    {
      id: 'ci-to-local',
      from: 'validate-ci-runtime',
      to: 'validate-asyra-design-runtime',
      kind: 'CI runtime contract',
      predicate: 'workflows select Node.js 24 without fallback',
      producedArtifacts: ['artifact:ci-runtime-contract']
    },
    {
      id: 'local-node-to-vercel',
      from: 'validate-asyra-design-runtime',
      to: 'validate-vercel-runtime',
      kind: 'local Node evidence',
      predicate:
        'local build, server, package, artifact, and template gates pass',
      producedArtifacts: ['artifact:local-node-evidence']
    },
    {
      id: 'browser-to-vercel',
      from: 'validate-asyra-design-runtime',
      to: 'validate-vercel-runtime',
      kind: 'browser evidence',
      predicate:
        'Asyra Design browser, collaboration, performance, and visual gates pass',
      producedArtifacts: ['artifact:browser-runtime-evidence']
    },
    {
      id: 'vercel-build-to-support',
      from: 'validate-vercel-runtime',
      to: 'synchronize-runtime-support',
      kind: 'Vercel build evidence',
      predicate: 'preview build log identifies Node.js 24.x',
      producedArtifacts: ['artifact:vercel-build-evidence']
    },
    {
      id: 'vercel-function-to-support',
      from: 'validate-vercel-runtime',
      to: 'synchronize-runtime-support',
      kind: 'Vercel function evidence',
      predicate:
        'all project-owned functions or middleware pass, or absence is explicit',
      producedArtifacts: ['artifact:vercel-function-evidence']
    },
    {
      id: 'vercel-frontend-to-support',
      from: 'validate-vercel-runtime',
      to: 'synchronize-runtime-support',
      kind: 'Vercel frontend evidence',
      predicate: 'deployed preview frontend smoke passes',
      producedArtifacts: ['artifact:vercel-frontend-evidence']
    },
    {
      id: 'support-to-decision',
      from: 'synchronize-runtime-support',
      to: 'decide-node-24-readiness',
      kind: 'support contract',
      predicate:
        'current support records match all successful runtime evidence',
      producedArtifacts: ['artifact:runtime-support-contract']
    }
  ]

  const evidenceArtifacts = [
    [
      'artifact:runtime-contract',
      'freeze-runtime-source',
      [
        'validate-manifest-compatibility',
        'validate-package-release-scripts',
        'validate-generated-template',
        'validate-ci-runtime',
        'validate-asyra-design-runtime',
        'validate-vercel-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:manifest-compatibility',
      'validate-manifest-compatibility',
      [
        'validate-package-release-scripts',
        'validate-generated-template',
        'validate-asyra-design-runtime',
        'validate-vercel-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:release-runtime-contract',
      'validate-package-release-scripts',
      [
        'validate-generated-template',
        'validate-ci-runtime',
        'validate-asyra-design-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:generated-template-contract',
      'validate-generated-template',
      [
        'validate-ci-runtime',
        'validate-asyra-design-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:ci-runtime-contract',
      'validate-ci-runtime',
      [
        'validate-asyra-design-runtime',
        'validate-vercel-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:local-node-evidence',
      'validate-asyra-design-runtime',
      [
        'validate-vercel-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:browser-runtime-evidence',
      'validate-asyra-design-runtime',
      [
        'validate-vercel-runtime',
        'synchronize-runtime-support',
        'decide-node-24-readiness'
      ]
    ],
    [
      'artifact:vercel-build-evidence',
      'validate-vercel-runtime',
      ['synchronize-runtime-support', 'decide-node-24-readiness']
    ],
    [
      'artifact:vercel-function-evidence',
      'validate-vercel-runtime',
      ['synchronize-runtime-support', 'decide-node-24-readiness']
    ],
    [
      'artifact:vercel-frontend-evidence',
      'validate-vercel-runtime',
      ['synchronize-runtime-support', 'decide-node-24-readiness']
    ],
    [
      'artifact:runtime-support-contract',
      'synchronize-runtime-support',
      ['decide-node-24-readiness']
    ]
  ]

  const findingArtifacts = [
    ['artifact:runtime-source-finding', 'freeze-runtime-source'],
    [
      'artifact:manifest-compatibility-finding',
      'validate-manifest-compatibility'
    ],
    ['artifact:release-runtime-finding', 'validate-package-release-scripts'],
    ['artifact:generated-template-finding', 'validate-generated-template'],
    ['artifact:ci-runtime-finding', 'validate-ci-runtime'],
    ['artifact:asyra-design-runtime-finding', 'validate-asyra-design-runtime'],
    ['artifact:vercel-runtime-finding', 'validate-vercel-runtime'],
    ['artifact:runtime-support-finding', 'synchronize-runtime-support']
  ]

  evidenceArtifacts.forEach(([id, ownerStepId, consumerStepIds]) => {
    consumerStepIds.forEach((consumerStepId) => {
      const routeExists = routes.some(
        (route) =>
          route.from === ownerStepId &&
          route.to === consumerStepId &&
          route.producedArtifacts.includes(id)
      )
      if (routeExists) return
      routes.push({
        id: `${ownerStepId}-to-${consumerStepId}-${id.slice('artifact:'.length)}`,
        from: ownerStepId,
        to: consumerStepId,
        kind: 'validated evidence handoff',
        predicate:
          'consumer reads the completed owner artifact without rederiving it',
        producedArtifacts: [id]
      })
    })
  })

  findingArtifacts.forEach(([id, ownerStepId]) => {
    routes.push({
      id: `${ownerStepId}-finding-to-decision`,
      from: ownerStepId,
      to: 'decide-node-24-readiness',
      kind: 'owner finding',
      predicate: 'owner cannot produce its required Node.js 24 evidence',
      producedArtifacts: [id]
    })
  })

  const artifacts = [
    ...evidenceArtifacts.map(([id, ownerStepId, consumerStepIds]) => ({
      id,
      ownerStepId,
      channel: 'validated runtime evidence',
      consumerStepIds,
      terminal: false
    })),
    ...findingArtifacts.map(([id, ownerStepId]) => ({
      id,
      ownerStepId,
      channel: 'owner-specific blocking finding',
      consumerStepIds: ['decide-node-24-readiness'],
      terminal: false
    })),
    {
      id: 'artifact:node-24-ready',
      ownerStepId: 'decide-node-24-readiness',
      channel: 'terminal runtime readiness decision',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:node-24-blocked',
      ownerStepId: 'decide-node-24-readiness',
      channel: 'terminal runtime readiness decision',
      consumerStepIds: [],
      terminal: true
    }
  ]

  routes.push(
    {
      id: 'ready-decision',
      from: 'decide-node-24-readiness',
      kind: 'terminal',
      predicate: 'all required evidence exists and no P0/P1/P2 finding remains',
      producedArtifacts: ['artifact:node-24-ready']
    },
    {
      id: 'blocked-decision',
      from: 'decide-node-24-readiness',
      kind: 'terminal',
      predicate: 'required evidence is missing or an owner finding remains',
      producedArtifacts: ['artifact:node-24-blocked']
    }
  )

  const invariants = [
    {
      id: 'single-runtime-major',
      title: 'Node.js 24.x is the sole supported major',
      statement:
        'Root, package, app, consumer, generator, CI, Vercel, validation, and current support owners must converge on Node.js 24.x while Yarn remains 4.3.1.',
      stepIds: steps.map((step) => step.id),
      artifactIds: evidenceArtifacts.map(([id]) => id),
      specRefs: ['#goal', '#definition-of-done']
    },
    {
      id: 'runtime-surface-separation',
      title: 'Runtime surfaces are not interchangeable',
      statement:
        'Local Node execution, browser runtime, Vercel build runtime, and Vercel function runtime have separate evidence; a browser or frontend pass cannot waive build, server, or function failure.',
      stepIds: [
        'validate-asyra-design-runtime',
        'validate-vercel-runtime',
        'decide-node-24-readiness'
      ],
      artifactIds: [
        'artifact:local-node-evidence',
        'artifact:browser-runtime-evidence',
        'artifact:vercel-build-evidence',
        'artifact:vercel-function-evidence',
        'artifact:vercel-frontend-evidence'
      ],
      specRefs: ['#required-inspector', '#6-validate-vercel']
    },
    {
      id: 'generated-source-authority',
      title: 'Generated output has one source owner',
      statement:
        'The official release-template generator and app template source own generated runtime output; create-app files are never manually repaired.',
      stepIds: ['validate-generated-template'],
      artifactIds: ['artifact:generated-template-contract'],
      specRefs: ['#3-update-canonical-runtime-owners']
    },
    {
      id: 'release-boundary',
      title: 'Runtime READY is not release authority',
      statement:
        'READY may produce scoped commits, a feature-branch PR, and a preview deployment, but never authorizes package version bump, publication, tag, merge, production deployment, or formal release.',
      stepIds: ['decide-node-24-readiness'],
      artifactIds: ['artifact:node-24-ready', 'artifact:node-24-blocked'],
      specRefs: ['#bounded-task-contract', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'runtime-source-case',
      title: 'Node.js 24 source and test-first contract',
      assertions: [
        'The available local Node.js 24 LTS patch, Corepack, Yarn 4.3.1, OS, architecture, project identity, and existing Vercel runtime are recorded.',
        'Formal assertions require Node.js 24 before canonical declarations change.'
      ],
      stepIds: ['freeze-runtime-source'],
      specRefs: [
        '#1-freeze-nodejs-24-baseline',
        '#2-strengthen-runtime-tests-first'
      ]
    },
    {
      id: 'manifest-and-release-case',
      title: 'Workspace, package, artifact, and consumer contract',
      assertions: [
        'Root, 19 Framework packages, Asyra Design, and the durable consumer fixture require Node.js 24.x without version or dependency changes.',
        'Package artifacts and packed-only clean consumers enforce the same runtime.'
      ],
      stepIds: [
        'validate-manifest-compatibility',
        'validate-package-release-scripts'
      ],
      specRefs: [
        '#3-update-canonical-runtime-owners',
        '#4-validate-locally-on-nodejs-24'
      ]
    },
    {
      id: 'template-case',
      title: 'Official generated consumer',
      assertions: [
        'The official generator writes Node.js 24.x and Yarn 4.3.1.',
        'Regenerated output passes parity, packed-only install, build, tests, startup smoke, and cleanup.'
      ],
      stepIds: ['validate-generated-template'],
      specRefs: [
        '#3-update-canonical-runtime-owners',
        '#4-validate-locally-on-nodejs-24'
      ]
    },
    {
      id: 'ci-case',
      title: 'Node.js 24 CI without fallback',
      assertions: [
        'Validation, release-readiness, E2E, collaboration, and deploy-preparation jobs select Node.js 24.',
        'Required checks retain the complete formal gates and do not allow Node.js 24 failure.'
      ],
      stepIds: ['validate-ci-runtime'],
      specRefs: ['#5-validate-ci-on-nodejs-24']
    },
    {
      id: 'local-and-browser-case',
      title: 'Complete local and browser validation',
      assertions: [
        'Immutable install, graph, dependencies, full build/tests/lint, Inspectors, artifacts, consumers, template, and app production build pass on local Node.js 24.',
        'Ordinary/collaboration E2E, performance, and visual gates pass as separate browser evidence with all processes and ports cleaned.'
      ],
      stepIds: ['validate-asyra-design-runtime'],
      specRefs: ['#4-validate-locally-on-nodejs-24']
    },
    {
      id: 'vercel-case',
      title: 'Real Node.js 24 Vercel preview',
      assertions: [
        'The existing project setting and project-root package select Node.js 24.x and a real preview build log identifies Node.js 24.',
        'Frontend smoke and every function/middleware route pass independently; absence of functions is explicit and required environment values remain secret.'
      ],
      stepIds: ['validate-vercel-runtime'],
      specRefs: ['#6-validate-vercel']
    },
    {
      id: 'support-and-decision-case',
      title: 'Consistent support and reproducible decision',
      assertions: [
        'Current support records name Node.js 24.x only after all required evidence passes.',
        'READY records reproducible local, CI, PR, and Vercel evidence; otherwise BLOCKED names the first incorrect owner and forbids release work.'
      ],
      stepIds: ['synchronize-runtime-support', 'decide-node-24-readiness'],
      specRefs: ['#7-synchronize-support-records', '#definition-of-done']
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'node-24-runtime-upgrade',
      kind: 'system',
      title: 'Node.js 24 Runtime Upgrade Flow Inspector',
      subtitle:
        'One Node.js 24.x contract across repository manifests, release automation, generated consumers, CI, local and browser gates, Vercel build/functions, support records, and the final READY or owner-specific BLOCKED decision.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Node.js 24 runtime upgrade product contract',
      inspectorOwner: 'Node.js 24 Runtime Upgrade Flow Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/node-24-runtime-upgrade-and-vercel-validation-plan.md',
        kind: 'authority'
      },
      {
        id: 'release-support',
        label: 'Release Support',
        href: '../RELEASE_SUPPORT.md',
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
