/* global module */

;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/create-asyra-design-app-release-flow-inspector.data.cjs'

  const lanes = [
    { id: 'source', title: 'Source and Versions', order: 1 },
    { id: 'generation', title: 'Generated Template', order: 2 },
    { id: 'consumer', title: 'Real User Path', order: 3 },
    { id: 'publication', title: 'CLI Publication', order: 4 },
    { id: 'decision', title: 'Release Decision', order: 5 }
  ]

  const steps = [
    {
      id: 'decide-release-versions',
      order: 1,
      laneId: 'source',
      title: 'Decide release versions',
      ownerPackage: 'Create-app release version decision owner',
      purpose:
        'Record the registry-verified Framework dependency versions, keep the private root workspace unchanged and unpublished, and explicitly select the canonical app and create-asyra-design-app CLI at the same release version.',
      inputs: [
        'user version instructions',
        'public manifest-derived Framework registry records',
        'root, app, and CLI manifests'
      ],
      outputs: [
        'artifact:release-version-scope',
        'artifact:version-decision-finding'
      ],
      conditions: [
        'Framework dependencies required by the canonical app are the exact registry-verified versions selected per package.',
        'The private root workspace asyra remains unchanged and unpublished throughout this CLI plan; apps/asyra-design and the CLI are explicitly selected at the same release version.',
        'The shared App and CLI target is explicitly selected by the user, but the CLI manifest remains unchanged until materialize-cli-version receives artifact:verified-template.',
        'CLI publication remains blocked until the user explicitly confirms every release identity version required by the release plan.',
        'Cleanup owner: decide-release-versions owns only the release version decision record and manifest edits explicitly selected by the user.'
      ],
      bypasses: [
        'The selected App version may be materialized before generation so the generated template inherits it; the CLI manifest remains deferred until template verification.',
        'An unspecified release identity version always blocks publish-cli and produces artifact:version-decision-finding.'
      ],
      allowedContributors: [
        'explicit user version decisions',
        'public npm registry metadata',
        'root, app, CLI, and Framework manifests'
      ],
      forbiddenContributors: [
        'inferred root or Framework package version bumps',
        'CLI version materialization before generated-template verification',
        'Framework package version mutation',
        'Changeset generation without explicit scope',
        'npm publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'apps/asyra-design/package.json',
        'create-app/asyra-design/package.json',
        'packages/*/package.json',
        'docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md',
        'docs/ai/framework/plans/create-asyra-design-app-release-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/create-asyra-design-app-release-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#status',
        '#prerequisites',
        '#1-record-user-specified-versions'
      ],
      failureOwnerStepId: 'decide-release-versions'
    },
    {
      id: 'own-canonical-app-source',
      order: 2,
      laneId: 'source',
      title: 'Own the canonical app source',
      ownerPackage: 'Asyra Design canonical app source owner',
      purpose:
        'Prepare apps/asyra-design as the only product source for the generated application, including public Framework dependency declarations, executable scripts, user documentation, and runtime-safe defaults.',
      inputs: ['artifact:release-version-scope', 'apps/asyra-design'],
      outputs: [
        'artifact:canonical-app-source',
        'artifact:canonical-source-finding'
      ],
      conditions: [
        'Every direct @asyra Framework dependency used by the app is declared at its exact registry-verified manifest version.',
        'The canonical app exposes the required typecheck, build, formal-test, and startup routes.',
        'User-facing setup documents server-only AI configuration without placing provider prompt, secret, or model configuration in browser code.',
        'Cleanup owner: own-canonical-app-source owns only canonical app source and active app documentation changes.'
      ],
      bypasses: [
        'Missing runtime configuration, executable validation route, or required user documentation produces artifact:canonical-source-finding.',
        'Generated output never bypasses a canonical app source defect.'
      ],
      allowedContributors: [
        'apps/asyra-design source and tests',
        'active Asyra Design documentation',
        'public manifest-derived Framework package contracts'
      ],
      forbiddenContributors: [
        'create-app/asyra-design/template hand edits',
        'secrets or real provider credentials',
        'archived, completed, or historical document rewrites',
        'unpublished Framework artifacts'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/README.md',
        'apps/asyra-design/.env.example',
        'apps/asyra-design/src',
        'apps/asyra-design/tests',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design'
      ],
      specRefs: [
        '#ownership-contract',
        '#1-record-user-specified-versions',
        '#2-generate-the-template'
      ],
      failureOwnerStepId: 'own-canonical-app-source'
    },
    {
      id: 'transform-generated-template',
      order: 3,
      laneId: 'generation',
      title: 'Transform the generated template',
      ownerPackage: 'Official create-app template generator',
      purpose:
        'Run the official release:app --prod=asyra-design transformation from canonical app source and deterministically exclude repository-only or runtime artifacts.',
      inputs: ['artifact:canonical-app-source', 'official generator configuration'],
      outputs: [
        'artifact:generated-template',
        'artifact:generator-finding'
      ],
      conditions: [
        'The generator rewrites @asyra workspace dependencies to the current registry-verified public manifest versions and sets the approved Node.js and Yarn contracts.',
        'The generator copies the canonical apps/asyra-design README and environment example, applying only the deterministic standalone link rewrite required by the generated project location.',
        'The generator adds required generated-project files such as license and ignore rules.',
        'Repository-only runtime artifacts, reports, caches, coverage, local state, and secrets are deterministically excluded.',
        'The generated template is never hand-edited; every correction returns to the canonical app, generator, or release configuration owner.',
        'Cleanup owner: transform-generated-template owns complete replacement of create-app/asyra-design/template and generator-owned temporary directories.'
      ],
      bypasses: [
        'Any manual template-only repair produces artifact:generator-finding.',
        'A dirty canonical source directory never permits cache, build, report, or local runtime artifacts into output.'
      ],
      allowedContributors: [
        'artifact:canonical-app-source',
        'scripts/release-template.js',
        'release-configs/asyra-design.json',
        'project-owned license and configuration templates'
      ],
      forbiddenContributors: [
        'manual edits under generated template',
        'workspace, link, portal, file, or tarball dependency proof',
        'local secrets and provider credentials',
        'repository-only runtime artifacts'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-template.js',
        'scripts/__tests__/release-automation.test.mjs',
        'release-configs/asyra-design.json',
        'create-app/asyra-design/template'
      ],
      specRefs: ['#ownership-contract', '#2-generate-the-template'],
      failureOwnerStepId: 'transform-generated-template'
    },
    {
      id: 'verify-template-identity',
      order: 4,
      laneId: 'generation',
      title: 'Verify generated identity and dependencies',
      ownerPackage: 'Generated template contract validator',
      purpose:
        'Verify that generated identity matches canonical source, every Framework dependency is an exact registry-verified public manifest version, required public files are present, and no forbidden dependency or repository state remains.',
      inputs: ['artifact:generated-template'],
      outputs: [
        'artifact:verified-template',
        'artifact:template-contract-finding'
      ],
      conditions: [
        'Generated project version equals the unchanged or explicitly selected canonical app version.',
        'Every required @asyra dependency equals its exact registry-verified manifest version and no workspace, link, portal, file, tarball, resolution, or monorepo alias remains.',
        'Package metadata, README, license, Node.js 24 contract, Yarn 4.3.1 contract, scripts, and environment examples are complete.',
        'Packed public content excludes caches, build output, reports, local state, governance-only records, and secrets.',
        'Cleanup owner: verify-template-identity owns detached inspection evidence only and never edits generated output.'
      ],
      bypasses: [
        'Any missing public file, incorrect identity, dependency leakage, or repository-only file produces artifact:template-contract-finding.',
        'A passing synchronization check does not bypass packed-content inspection.'
      ],
      allowedContributors: [
        'artifact:generated-template',
        'template synchronization validator',
        'packed-file inventory',
        'public package manifests'
      ],
      forbiddenContributors: [
        'manual generated output repair',
        'ignored local files treated as automatically excluded from npm',
        'unpublished dependency substitutions',
        'secret values'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-template-readiness.js',
        'scripts/__tests__/release-template-readiness.test.mjs',
        'scripts/__tests__/release-automation.test.mjs',
        'create-app/asyra-design/template',
        'tmp/create-app-release-evidence'
      ],
      specRefs: [
        '#2-generate-the-template',
        '#4-verify-synchronization-and-cli-artifact'
      ],
      failureOwnerStepId: 'verify-template-identity'
    },
    {
      id: 'materialize-cli-version',
      order: 5,
      laneId: 'generation',
      title: 'Materialize the CLI version',
      ownerPackage: 'create-asyra-design-app manual version owner',
      purpose:
        'After template verification, manually materialize create-app/asyra-design at the explicitly selected target so apps/asyra-design and the CLI use the same release version while the generated template continues to inherit the App version.',
      inputs: [
        'artifact:release-version-scope',
        'artifact:verified-template',
        'apps/asyra-design/package.json',
        'create-app/asyra-design/package.json'
      ],
      outputs: [
        'artifact:versioned-cli-source',
        'artifact:cli-version-finding'
      ],
      conditions: [
        'The manually selected CLI target is exactly create-asyra-design-app at the same version declared by apps/asyra-design.',
        'The CLI manifest is changed only after artifact:verified-template exists and before the final CLI artifact is packed.',
        'No Changeset release entry owns the CLI version; the current Framework Changeset remains limited to packages/*.',
        'The generated template must inherit the App version through the official generator and is never versioned independently.',
        'Root asyra and Framework package versions remain unchanged.',
        'Cleanup owner: materialize-cli-version owns only the explicitly selected create-app/asyra-design package version and its version record.'
      ],
      bypasses: [
        'A missing verified template or unresolved CLI target produces artifact:cli-version-finding.',
        'An App/CLI version mismatch or any CLI, root, private app, or generated-template Changeset entry produces artifact:cli-version-finding.'
      ],
      allowedContributors: [
        'artifact:release-version-scope',
        'artifact:verified-template',
        'explicit user shared App and CLI version selection',
        'apps/asyra-design/package.json',
        'create-app/asyra-design/package.json'
      ],
      forbiddenContributors: [
        'Changeset release entries',
        'root or Framework package version edits',
        'independent generated-template version edits',
        'Framework package version mutation',
        'npm publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'create-app/asyra-design/package.json',
        'docs/ai/framework/rules/release-version-topology.md',
        'docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md',
        'docs/ai/framework/plans/create-asyra-design-app-release-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/create-asyra-design-app-release-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#3-materialize-the-cli-version',
        '#4-verify-synchronization-and-cli-artifact'
      ],
      failureOwnerStepId: 'materialize-cli-version'
    },
    {
      id: 'pack-cli-artifact',
      order: 6,
      laneId: 'generation',
      title: 'Pack the CLI artifact',
      ownerPackage: 'create-asyra-design-app package owner',
      purpose:
        'Pack the CLI package and validate its selected version, metadata, executable binary, bundled template, documentation, license, file inventory, and checksum.',
      inputs: [
        'artifact:versioned-cli-source',
        'create-app/asyra-design CLI source'
      ],
      outputs: [
        'artifact:validated-cli-tarball',
        'artifact:cli-artifact-finding'
      ],
      conditions: [
        'The tarball contains only the documented CLI files and verified bundled template.',
        'The executable supports a deterministic package-manager selection for automated clean invocation while preserving the interactive default.',
        'Target-directory validation cannot escape the caller-selected parent through an absolute path or traversal.',
        'The exact tarball version, sha512 or sha256 checksum, size, and file list are recorded.',
        'Cleanup owner: pack-cli-artifact owns project-local tarballs and evidence and removes them after downstream proof.'
      ],
      bypasses: [
        'Missing metadata, invalid binary, unsafe target path, unexpected public file, or oversized unexplained artifact produces artifact:cli-artifact-finding.',
        'Packing a CLI never authorizes publishing it.'
      ],
      allowedContributors: [
        'artifact:versioned-cli-source',
        'create-app/asyra-design/package.json',
        'create-app/asyra-design/bin',
        'create-app/asyra-design/README.md',
        'create-app/asyra-design/LICENSE'
      ],
      forbiddenContributors: [
        'Framework package publication',
        'npm publish',
        'project-external temporary files',
        'unreviewed generated template edits'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'create-app/asyra-design/package.json',
        'create-app/asyra-design/bin/index.js',
        'create-app/asyra-design/README.md',
        'create-app/asyra-design/LICENSE',
        'create-app/asyra-design/__tests__',
        'tmp/create-app-release-evidence'
      ],
      specRefs: ['#4-verify-synchronization-and-cli-artifact'],
      failureOwnerStepId: 'pack-cli-artifact'
    },
    {
      id: 'invoke-packed-cli',
      order: 7,
      laneId: 'consumer',
      title: 'Invoke the packed CLI',
      ownerPackage: 'Packed CLI clean invocation owner',
      purpose:
        'Invoke the exact packed CLI artifact from a project-local isolated directory and prove it creates a complete project without reading monorepo source or hoisted dependencies.',
      inputs: ['artifact:validated-cli-tarball'],
      outputs: [
        'artifact:generated-clean-project',
        'artifact:cli-invocation-finding'
      ],
      conditions: [
        'The invocation uses the packed CLI tarball and an explicit deterministic package-manager option.',
        'The generated path remains inside the project-local isolated test root.',
        'Generated identity, files, scripts, and dependency declarations match the verified template.',
        'Cleanup owner: invoke-packed-cli owns the isolated generated project until all consumer and visual proofs complete.'
      ],
      bypasses: [
        'A CLI copy performed without executing the packaged binary produces artifact:cli-invocation-finding.',
        'A project generated outside the repository or through the monorepo workspace is invalid evidence.'
      ],
      allowedContributors: [
        'artifact:validated-cli-tarball',
        'Node.js 24 runtime',
        'existing Yarn 4.3.1 runtime',
        'project-local isolated directory'
      ],
      forbiddenContributors: [
        'direct template copy as CLI proof',
        'global unpublished CLI source',
        'project-external writes',
        'workspace install'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'create-app/asyra-design/bin/index.js',
        'create-app/asyra-design/__tests__',
        'tmp/create-app-release-evidence/generated-app'
      ],
      specRefs: [
        '#4-verify-synchronization-and-cli-artifact',
        '#5-run-the-real-user-installation-path'
      ],
      failureOwnerStepId: 'invoke-packed-cli'
    },
    {
      id: 'install-generated-app-from-registry',
      order: 8,
      laneId: 'consumer',
      title: 'Install from the public registry',
      ownerPackage: 'Generated-app registry-only install owner',
      purpose:
        'Install the generated project exactly as a public user so every @asyra dependency resolves to its selected exact name@version from the public npm registry.',
      inputs: ['artifact:generated-clean-project', 'public npm registry'],
      outputs: [
        'artifact:registry-installed-project',
        'artifact:registry-install-finding'
      ],
      conditions: [
        'The generated manifest and lock resolve every required @asyra package at its selected public manifest version.',
        'No workspace, link, portal, file, tarball, resolutions, local registry override, source-directory install, or hoisted monorepo dependency contributes.',
        'Installed Framework package metadata, integrity, and non-symlinked package locations are recorded.',
        'Cleanup owner: install-generated-app-from-registry owns generated install state and registry evidence until behavior proof completes.'
      ],
      bypasses: [
        'Any unavailable or incorrectly resolved Framework package produces artifact:registry-install-finding.',
        'A locally packed Framework package can never substitute for public npm registry proof.'
      ],
      allowedContributors: [
        'artifact:generated-clean-project',
        'public npm registry',
        'generated package manifest and lockfile',
        'clean package-manager cache behavior'
      ],
      forbiddenContributors: [
        'workspace dependencies',
        'link, portal, file, tarball, or resolutions',
        'local registry',
        'monorepo node_modules'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-template-readiness.js',
        'scripts/__tests__/release-template-readiness.test.mjs',
        'tmp/create-app-release-evidence/generated-app'
      ],
      specRefs: ['#5-run-the-real-user-installation-path'],
      failureOwnerStepId: 'install-generated-app-from-registry'
    },
    {
      id: 'prove-generated-app-behavior',
      order: 9,
      laneId: 'consumer',
      title: 'Prove generated-app behavior',
      ownerPackage: 'Generated Asyra Design validation owner',
      purpose:
        'Run typecheck, production build, all formal tests, startup, documented initialization, and live product interactions against the registry-installed generated app.',
      inputs: ['artifact:registry-installed-project'],
      outputs: [
        'artifact:generated-app-behavior-proof',
        'artifact:generated-app-behavior-finding'
      ],
      conditions: [
        'Typecheck, build, all formal tests, startup, Core/Preset initialization, and documented flows succeed under Node.js 24.',
        'Live browser proof creates several elements, drags them, changes multiple property inputs, and verifies undo and redo.',
        'Relevant maintained E2E scenarios run against the same live app state and visual screenshots are inspected before completion.',
        'Disabled Collaboration and AI produce no provider, network, secret, model, or other disabled side effects.',
        'Cleanup owner: prove-generated-app-behavior owns server PIDs, ports, screenshots, reports, and generated runtime state and cleans them after evidence review.'
      ],
      bypasses: [
        'A test result without startup and live interaction proof produces artifact:generated-app-behavior-finding.',
        'A screenshot without formal behavior assertions or a formal test without screenshot inspection is incomplete evidence.'
      ],
      allowedContributors: [
        'artifact:registry-installed-project',
        'generated app formal tests and E2E',
        'real browser interaction',
        'project-local screenshots and bounded logs'
      ],
      forbiddenContributors: [
        'canonical monorepo app substituted for generated app',
        'mock-only rendering as visual proof',
        'enabled external Collaboration or AI provider calls',
        'untracked server processes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tmp/create-app-release-evidence/generated-app',
        'tmp/create-app-release-evidence/screenshots',
        'apps/asyra-design/e2e',
        'apps/asyra-design/playwright.config.ts'
      ],
      specRefs: ['#5-run-the-real-user-installation-path'],
      failureOwnerStepId: 'prove-generated-app-behavior'
    },
    {
      id: 'publish-cli',
      order: 10,
      laneId: 'publication',
      title: 'Publish the CLI',
      ownerPackage: 'create-asyra-design-app npm publication owner',
      purpose:
        'Rebuild and revalidate the exact candidate from a clean source commit on main or a non-main feature branch, then publish only create-asyra-design-app at the explicitly selected CLI version.',
      inputs: [
        'artifact:generated-app-behavior-proof',
        'artifact:release-version-scope',
        'clean exact source commit evidence',
        'explicit publish authorization'
      ],
      outputs: [
        'artifact:cli-publication-result',
        'artifact:cli-publication-finding'
      ],
      conditions: [
        'The release source is a clean exact source commit and matches the validated candidate checksum and content.',
        'Publication may run from main or a non-main feature branch without making PR merge a prerequisite or a side effect.',
        'Root remains unchanged; private app and create-app template identity are verified; and selected CLI target is explicit before publication.',
        'Before the first npm publish, the exact manifest and checksum are presented and explicit authorization is received.',
        'Only create-asyra-design-app is published; no Framework, root, private app, or other package is published.',
        'Cleanup owner: publish-cli owns the one irreversible CLI registry operation and its exact registry response.'
      ],
      bypasses: [
        'A dirty or unidentified source, changed checksum, unspecified CLI version, or absent authorization produces artifact:cli-publication-finding.',
        'Candidate validation never implies publication authorization.'
      ],
      allowedContributors: [
        'artifact:generated-app-behavior-proof',
        'artifact:release-version-scope',
        'clean main or feature-branch source commit',
        'explicit user authorization'
      ],
      forbiddenContributors: [
        'Framework, root, private app, or unrelated package publication',
        'automatic authorization inference',
        'unvalidated artifact'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'create-app/asyra-design',
        'docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md',
        'tmp/create-app-release-evidence'
      ],
      specRefs: [
        '#6-freeze-the-create-app-publication-source',
        '#7-publish-create-asyra-design-app'
      ],
      failureOwnerStepId: 'publish-cli'
    },
    {
      id: 'smoke-public-cli',
      order: 11,
      laneId: 'publication',
      title: 'Prove the public CLI',
      ownerPackage: 'Public create-app command verification owner',
      purpose:
        'Invoke the exact published CLI version through npx and independently repeat the complete registry-only generated-app behavior matrix without a reduced post-publication smoke path.',
      inputs: ['artifact:cli-publication-result', 'public npm registry'],
      outputs: [
        'artifact:public-cli-smoke-proof',
        'artifact:public-cli-smoke-finding'
      ],
      conditions: [
        'The npx command names the exact published create-asyra-design-app version and resolves that version from the public registry.',
        'Generated identity and Framework dependency declarations match the reviewed candidate.',
        'Registry-only install, typecheck, production build, all formal tests, maintained E2E, startup, and documented initialization pass independently.',
        'The same functional matrix as prove-generated-app-behavior creates elements, drags them, changes property inputs, verifies undo/redo, exercises relevant Collaboration and AI behavior, checks disabled side effects, and inspects visual evidence.',
        'Cleanup owner: smoke-public-cli owns and removes its independent project-local smoke directory after recording evidence.'
      ],
      bypasses: [
        'A local CLI tarball cannot stand in for post-publication npm create proof.',
        'A reduced install/build/startup smoke cannot replace the complete post-publication generated-app behavior matrix.',
        'Registry propagation delay produces artifact:public-cli-smoke-finding and no duplicate publication.'
      ],
      allowedContributors: [
        'artifact:cli-publication-result',
        'published npm CLI package',
        'public npm registry',
        'project-local clean smoke directory'
      ],
      forbiddenContributors: [
        'local CLI source or tarball',
        'workspace or local Framework packages',
        'duplicate publish attempt',
        'project-external test directories'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'create-app/asyra-design/README.md',
        'tmp/create-app-release-evidence/public-smoke'
      ],
      specRefs: ['#8-verify-public-cli-behavior'],
      failureOwnerStepId: 'smoke-public-cli'
    },
    {
      id: 'record-release-decision',
      order: 12,
      laneId: 'decision',
      title: 'Record the release decision',
      ownerPackage: 'Create-app release record and decision owner',
      purpose:
        'Collect every success artifact and owner finding, verify exclusions, record remaining blind spots, and emit the single final READY or BLOCKED decision for user acceptance.',
      inputs: [
        'artifact:public-cli-smoke-proof',
        'artifact:version-decision-finding',
        'artifact:canonical-source-finding',
        'artifact:generator-finding',
        'artifact:template-contract-finding',
        'artifact:cli-version-finding',
        'artifact:cli-artifact-finding',
        'artifact:cli-invocation-finding',
        'artifact:registry-install-finding',
        'artifact:generated-app-behavior-finding',
        'artifact:cli-publication-finding',
        'artifact:public-cli-smoke-finding'
      ],
      outputs: ['artifact:release-ready', 'artifact:release-blocked'],
      conditions: [
        'READY requires every owner success route, no unresolved P0/P1/P2 finding, and complete publication and public-smoke evidence.',
        'BLOCKED names the first failed owner, exact evidence, recovery owner, and remaining blind spots.',
        'Root/private/create-app identity, generated-only, registry-only, publication scope, and no-secret exclusions are explicitly verified.',
        'The final record emits only READY or BLOCKED and waits for user acceptance before plan closeout.',
        'Cleanup owner: record-release-decision owns the durable release record and final decision; it never performs source, registry, merge, tag, or closeout mutations.'
      ],
      bypasses: [
        'A validated pre-publication candidate can request review but cannot emit READY before publication and public smoke.',
        'No skipped, conditional, or unavailable required owner is silently treated as passing.'
      ],
      allowedContributors: [
        'declared Inspector artifacts',
        'reviewed PR and CI evidence',
        'public registry evidence',
        'remaining blind-spot record'
      ],
      forbiddenContributors: [
        'undeclared ad hoc evidence',
        'hidden manual template repair',
        'inferred user acceptance',
        'automatic plan closeout'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md',
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/plans/create-asyra-design-app-release-flow-inspector.data.cjs'
      ],
      specRefs: ['#stop-conditions', '#definition-of-done'],
      failureOwnerStepId: 'record-release-decision'
    }
  ]

  const successArtifacts = [
    ['artifact:release-version-scope', 'decide-release-versions', 'own-canonical-app-source'],
    ['artifact:canonical-app-source', 'own-canonical-app-source', 'transform-generated-template'],
    ['artifact:generated-template', 'transform-generated-template', 'verify-template-identity'],
    ['artifact:verified-template', 'verify-template-identity', 'materialize-cli-version'],
    ['artifact:versioned-cli-source', 'materialize-cli-version', 'pack-cli-artifact'],
    ['artifact:validated-cli-tarball', 'pack-cli-artifact', 'invoke-packed-cli'],
    ['artifact:generated-clean-project', 'invoke-packed-cli', 'install-generated-app-from-registry'],
    ['artifact:registry-installed-project', 'install-generated-app-from-registry', 'prove-generated-app-behavior'],
    ['artifact:generated-app-behavior-proof', 'prove-generated-app-behavior', 'publish-cli'],
    ['artifact:cli-publication-result', 'publish-cli', 'smoke-public-cli'],
    ['artifact:public-cli-smoke-proof', 'smoke-public-cli', 'record-release-decision']
  ]

  const findingArtifacts = [
    ['artifact:version-decision-finding', 'decide-release-versions'],
    ['artifact:canonical-source-finding', 'own-canonical-app-source'],
    ['artifact:generator-finding', 'transform-generated-template'],
    ['artifact:template-contract-finding', 'verify-template-identity'],
    ['artifact:cli-version-finding', 'materialize-cli-version'],
    ['artifact:cli-artifact-finding', 'pack-cli-artifact'],
    ['artifact:cli-invocation-finding', 'invoke-packed-cli'],
    ['artifact:registry-install-finding', 'install-generated-app-from-registry'],
    ['artifact:generated-app-behavior-finding', 'prove-generated-app-behavior'],
    ['artifact:cli-publication-finding', 'publish-cli'],
    ['artifact:public-cli-smoke-finding', 'smoke-public-cli']
  ]

  const artifacts = [
    ...successArtifacts.map(([id, ownerStepId, consumerStepId]) => ({
      id,
      ownerStepId,
      channel: 'owner success',
      consumerStepIds: [consumerStepId],
      terminal: false
    })),
    ...findingArtifacts.map(([id, ownerStepId]) => ({
      id,
      ownerStepId,
      channel: 'owner finding',
      consumerStepIds: ['record-release-decision'],
      terminal: false
    })),
    {
      id: 'artifact:release-ready',
      ownerStepId: 'record-release-decision',
      channel: 'terminal release decision',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:release-blocked',
      ownerStepId: 'record-release-decision',
      channel: 'terminal release decision',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const routes = [
    ...successArtifacts.map(([artifactId, from, to], index) => ({
      id: `success-${index + 1}`,
      from,
      to,
      producedArtifacts: [artifactId]
    })),
    ...findingArtifacts.map(([artifactId, from], index) => ({
      id: `finding-${index + 1}`,
      from,
      to: 'record-release-decision',
      producedArtifacts: [artifactId]
    })),
    {
      id: 'terminal-ready',
      from: 'record-release-decision',
      to: null,
      producedArtifacts: ['artifact:release-ready']
    },
    {
      id: 'terminal-blocked',
      from: 'record-release-decision',
      to: null,
      producedArtifacts: ['artifact:release-blocked']
    }
  ]

  const invariants = [
    {
      id: 'generated-only-invariant',
      title: 'Template corrections stay at canonical owners',
      statement:
        'create-app/asyra-design/template is replaced only by the official generator; all product, transformation, metadata, and cleanup corrections are made at their canonical owners.',
      stepIds: [
        'own-canonical-app-source',
        'transform-generated-template',
        'verify-template-identity'
      ],
      artifactIds: [
        'artifact:canonical-app-source',
        'artifact:generated-template',
        'artifact:verified-template'
      ],
      specRefs: ['#ownership-contract', '#2-generate-the-template']
    },
    {
      id: 'registry-only-invariant',
      title: 'Generated Framework dependencies use the public registry',
      statement:
        'The clean generated app installs exact public Framework versions with no workspace, local path, tarball, registry substitution, or monorepo dependency contribution.',
      stepIds: [
        'verify-template-identity',
        'install-generated-app-from-registry',
        'prove-generated-app-behavior'
      ],
      artifactIds: [
        'artifact:verified-template',
        'artifact:registry-installed-project',
        'artifact:generated-app-behavior-proof'
      ],
      specRefs: ['#5-run-the-real-user-installation-path']
    },
    {
      id: 'publication-authorization-invariant',
      title: 'Publication is isolated after validation and authorization',
      statement:
        'CLI publication may occur from a clean exact source commit on main or a feature branch after exact artifact comparison, explicit version selection, and explicit publish authorization; publication never authorizes merge.',
      stepIds: ['publish-cli', 'smoke-public-cli', 'record-release-decision'],
      artifactIds: [
        'artifact:cli-publication-result',
        'artifact:public-cli-smoke-proof',
        'artifact:release-ready'
      ],
      specRefs: [
        '#6-freeze-the-create-app-publication-source',
        '#7-publish-create-asyra-design-app',
        '#8-verify-public-cli-behavior'
      ]
    }
  ]

  const acceptanceContracts = [
    {
      id: 'candidate-source-generation-case',
      title: 'Canonical source produces a clean public template',
      assertions: [
        'Canonical app dependencies target the exact registry-verified public manifest versions.',
        'The official generator produces complete user-facing content and excludes repository-only state without manual output edits.'
      ],
      stepIds: [
        'decide-release-versions',
        'own-canonical-app-source',
        'transform-generated-template',
        'verify-template-identity'
      ],
      specRefs: [
        '#1-record-user-specified-versions',
        '#2-generate-the-template'
      ]
    },
    {
      id: 'packed-cli-consumer-case',
      title: 'Packed CLI creates a registry-only working app',
      assertions: [
        'The exact reviewed CLI tarball creates the project through its real executable.',
        'Framework packages install from the public registry and all build, test, startup, interaction, visual, and disabled-side-effect gates pass.'
      ],
      stepIds: [
        'materialize-cli-version',
        'pack-cli-artifact',
        'invoke-packed-cli',
        'install-generated-app-from-registry',
        'prove-generated-app-behavior'
      ],
      specRefs: [
        '#3-materialize-the-cli-version',
        '#4-verify-synchronization-and-cli-artifact',
        '#5-run-the-real-user-installation-path'
      ]
    },
    {
      id: 'publication-decision-case',
      title: 'Validated CLI publication and independent public smoke',
      assertions: [
        'The validated candidate is reproduced from a clean exact source commit on main or a feature branch and publication waits for explicit authorization.',
        'The exact published npx command independently passes the complete generated-app behavior matrix before the single final READY or BLOCKED decision.'
      ],
      stepIds: [
        'publish-cli',
        'smoke-public-cli',
        'record-release-decision'
      ],
      specRefs: [
        '#6-freeze-the-create-app-publication-source',
        '#7-publish-create-asyra-design-app',
        '#8-verify-public-cli-behavior',
        '#definition-of-done'
      ]
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'create-asyra-design-app-release',
      kind: 'system',
      title: 'create-asyra-design-app Release Inspector',
      subtitle:
        'Canonical app source through generated template, packed CLI, registry-only user proof, authorized publication, public smoke, and one release decision.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'create-asyra-design-app Formal Release Plan',
      inspectorOwner: 'create-asyra-design-app Release Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Release Plan',
        href: './completed/create-asyra-design-app-release-plan.md',
        kind: 'authority'
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
