/* global module */

;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/framework-package-patch-release-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/framework-package-release-flow-inspector.data.cjs'

  const lanes = [
    { id: 'registry', title: 'Registry History', order: 1 },
    { id: 'versioning', title: 'Exceptional Version Materialization', order: 2 },
    { id: 'artifacts', title: 'Artifact and Merge Proof', order: 3 },
    { id: 'publication', title: 'Public Registry Release', order: 4 },
    { id: 'decision', title: 'Recovery and Final Decision', order: 5 }
  ]

  const steps = [
    {
      id: 'inventory-public-registry',
      order: 1,
      laneId: 'registry',
      title: 'Inventory the public registry',
      ownerPackage: 'Framework public-registry inventory owner',
      purpose:
        'Query the public npm registry for the fixed 19-package allowlist and record the 12 historical 0.2.5 records, seven missing 0.2.5 records, metadata, versions, and integrity without reusing a dated inventory.',
      inputs: [
        'frozen source commit',
        'scripts/framework-release-packages.js fixed allowlist',
        'public npm registry',
        'Node.js 24.x and Yarn 4.3.1 runtime evidence'
      ],
      outputs: ['artifact:registry-inventory', 'artifact:inventory-finding'],
      conditions: [
        'Every one of the fixed 19 package names is queried directly from the public npm registry in the current run.',
        'The record distinguishes available versions, missing versions, dependency metadata, dist integrity, and current npm identity/scope access.',
        'Cleanup owner: inventory-public-registry owns only detached registry responses and emits no package, tag, version, or publication mutation.'
      ],
      bypasses: [
        'An unavailable registry, unresolved identity query, or package result outside the fixed allowlist produces artifact:inventory-finding.',
        'Historical inventory dates are context only and never bypass a current registry query.'
      ],
      allowedContributors: [
        'public npm registry responses',
        'fixed 19-package release allowlist',
        'current package manifests',
        'credential-free identity and scope checks'
      ],
      forbiddenContributors: [
        'cached 2026-08-05 inventory as current evidence',
        'private registry or workspace resolution',
        'npm publish, deprecate, unpublish, or dist-tag mutation',
        'credential values in output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/framework-release-packages.js',
        'scripts/__tests__/framework-release-packages.test.mjs',
        'docs/ai/framework/plans/framework-package-patch-release-plan.md',
        'docs/ai/framework/plans/framework-package-release-flow-inspector.data.cjs',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#release-set',
        '#1-freeze-source-and-registry-state',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'inventory-public-registry'
    },
    {
      id: 'classify-historical-baseline',
      order: 2,
      laneId: 'registry',
      title: 'Classify historical 0.2.5 records',
      ownerPackage: 'Framework release-history classification owner',
      purpose:
        'Classify public 0.2.5 manifest differences as the expected source-generation difference preceding the current large change and establish 0.5.0, not reconstructed 0.2.5, as the next coherent public baseline.',
      inputs: ['artifact:registry-inventory', 'current 19 package manifests'],
      outputs: [
        'artifact:historical-baseline-classification',
        'artifact:historical-baseline-finding'
      ],
      conditions: [
        'The classification names the 12-present/seven-missing split and the concrete dependency-contract differences without treating old registry artifacts as current source.',
        'This owner must not publish, reconstruct, or overwrite any 0.2.5 package.',
        'Cleanup owner: classify-historical-baseline owns detached comparison evidence only and creates no registry or manifest mutation.'
      ],
      bypasses: [
        'An unexpected package outside the allowlist or an unclassified registry response produces artifact:historical-baseline-finding.',
        'Expected historical differences do not block the approved 0.5.0 large-change release.'
      ],
      allowedContributors: [
        'artifact:registry-inventory',
        'current fixed-allowlist manifests',
        'user-approved large-change version semantics'
      ],
      forbiddenContributors: [
        'publishing current source as historical 0.2.5',
        'rewriting immutable npm versions',
        'using historical artifacts as proof of current source reproducibility'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/plans/framework-package-patch-release-plan.md',
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/plans/framework-package-release-flow-inspector.data.cjs',
        'packages/*/package.json',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#status',
        '#release-set',
        '#1-freeze-source-and-registry-state'
      ],
      failureOwnerStepId: 'classify-historical-baseline'
    },
    {
      id: 'materialize-local-baseline',
      order: 3,
      laneId: 'versioning',
      title: 'Materialize the local 0.4.0 baseline',
      ownerPackage: 'Framework manifest version owner',
      purpose:
        'Materialize exactly 19 fixed-allowlist Framework manifests from 0.2.5 to local 0.4.0 as the intentional input baseline for one minor Changeset.',
      inputs: [
        'artifact:historical-baseline-classification',
        'fixed 19-package allowlist',
        'clean feature-branch manifests'
      ],
      outputs: ['artifact:local-0-4-0-baseline', 'artifact:baseline-finding'],
      conditions: [
        'Exactly 19 Framework package versions become 0.4.0 in one bounded operation.',
        'Root asyra, private @asyra/asyra-design, and create-asyra-design-app versions remain unchanged.',
        'The local 0.4.0 baseline must never be published.',
        'Cleanup owner: materialize-local-baseline owns only the 19 Framework manifest version edits and leaves no temporary artifact.'
      ],
      bypasses: [
        'Any missing package, unexpected version, excluded-owner change, or dirty unrelated file produces artifact:baseline-finding.',
        'No Changeset generation or registry operation begins from an incomplete local baseline.'
      ],
      allowedContributors: [
        'artifact:historical-baseline-classification',
        'scripts/framework-release-packages.js',
        'packages/*/package.json'
      ],
      forbiddenContributors: [
        'root package version',
        'private Asyra Design version',
        'create-app version or generated template',
        'npm publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/framework-release-packages.js',
        'scripts/__tests__/framework-release-packages.test.mjs',
        'packages/*/package.json'
      ],
      specRefs: [
        '#goal',
        '#2-materialize-the-exceptional-local-baseline',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'materialize-local-baseline'
    },
    {
      id: 'generate-synchronized-changeset',
      order: 4,
      laneId: 'versioning',
      title: 'Generate one synchronized minor Changeset',
      ownerPackage: 'Exceptional all-package Changeset generator',
      purpose:
        'Run node scripts/changeset-all-patch.js --type minor exactly once and produce one Changeset containing only the fixed 19 Framework packages at release type minor.',
      inputs: [
        'artifact:local-0-4-0-baseline',
        'fixed 19-package allowlist',
        'empty pending Changeset set'
      ],
      outputs: [
        'artifact:synchronized-minor-changeset',
        'artifact:changeset-finding'
      ],
      conditions: [
        'The generated Changeset contains exactly 19 unique entries and every entry is minor.',
        'The generator requires an explicit release type and remains exceptional; normal post-0.5.0 development uses ordinary scoped Changesets.',
        'yarn changeset status resolves the same 19-package 0.5.0 plan.',
        'Cleanup owner: generate-synchronized-changeset owns the single generated Changeset file and no package manifest version.'
      ],
      bypasses: [
        'A pre-existing pending Changeset, unsupported type, duplicate, missing, root, private, create-app, or other workspace entry produces artifact:changeset-finding.',
        'The script is not invoked a second time for this release.'
      ],
      allowedContributors: [
        'artifact:local-0-4-0-baseline',
        'scripts/framework-release-packages.js',
        'scripts/changeset-all-patch.js',
        'Changesets status command'
      ],
      forbiddenContributors: [
        'routine development versioning',
        'manual per-package Changesets for this exceptional alignment',
        'root, private app, create-app, or non-allowlist workspace',
        'automatic publish or Git tag creation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'scripts/changeset-all-patch.js',
        'scripts/framework-release-packages.js',
        'scripts/__tests__/changeset-all-patch.test.mjs',
        '.changeset/auto-minor.md',
        '.changeset/config.json'
      ],
      specRefs: [
        '#changeset-contract',
        '#3-generate-the-synchronized-minor-changeset',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'generate-synchronized-changeset'
    },
    {
      id: 'materialize-framework-version',
      order: 5,
      laneId: 'versioning',
      title: 'Materialize Framework 0.5.0',
      ownerPackage: 'Changesets version and release-record owner',
      purpose:
        'Run yarn changeset version so the 19 Framework packages advance from 0.4.0 to 0.5.0 with generated changelogs and synchronized internal version records.',
      inputs: ['artifact:synchronized-minor-changeset'],
      outputs: ['artifact:versioned-0-5-0-source', 'artifact:version-finding'],
      conditions: [
        'All and only the fixed 19 Framework package versions move from 0.4.0 to 0.5.0.',
        'Root asyra, private @asyra/asyra-design, and create-app remain at their pre-release versions.',
        'Gate 5 records derive the Framework candidate version from the fixed release set instead of forcing root or private owners to match.',
        'Cleanup owner: materialize-framework-version owns Changesets version output, package changelogs, and the test-first release-record adjustment.'
      ],
      bypasses: [
        'Any non-0.5.0 Framework result, excluded-owner version change, missing changelog, or stale Changeset produces artifact:version-finding.',
        'No create-app template is regenerated.'
      ],
      allowedContributors: [
        'artifact:synchronized-minor-changeset',
        'Changesets version command',
        'fixed Framework manifests and changelogs',
        'Gate 5 release-record tests'
      ],
      forbiddenContributors: [
        'root asyra version bump',
        'private Asyra Design version bump',
        'create-app version or template materialization',
        'manual changelog substitution'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/*/package.json',
        'packages/*/CHANGELOG.md',
        'scripts/release-records.js',
        'scripts/__tests__/release-records.test.mjs',
        '.changeset'
      ],
      specRefs: [
        '#4-materialize-050',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'materialize-framework-version'
    },
    {
      id: 'validate-framework-artifacts',
      order: 6,
      laneId: 'artifacts',
      title: 'Validate all Framework 0.5.0 artifacts',
      ownerPackage: 'Framework artifact and clean-consumer validators',
      purpose:
        'Build, pack, checksum, and validate exactly 19 local 0.5.0 artifacts, then exercise the accepted exact-version tarball consumer and required formal gates.',
      inputs: ['artifact:versioned-0-5-0-source'],
      outputs: [
        'artifact:validated-0-5-0-artifacts',
        'artifact:artifact-validation-finding'
      ],
      conditions: [
        'Every artifact has valid name, version, exports, types, license, contents, dependency range, checksum, and clean-install behavior.',
        'Package/root tests, lint, dependency checks, Inspectors, E2E, performance, visual, and disabled-side-effect gates pass under Node.js 24.',
        'No workspace, link, portal, source-directory install, or unpublished tarball is accepted as public-registry proof.',
        'Cleanup owner: validate-framework-artifacts owns project-local tarballs, consumers, child processes, and ports and removes or retains them only under the release evidence policy.'
      ],
      bypasses: [
        'Any artifact, test, install, runtime, performance, visual, or boundary failure produces artifact:artifact-validation-finding.',
        'No PR readiness claim is made from a partial artifact set.'
      ],
      allowedContributors: [
        'artifact:versioned-0-5-0-source',
        'canonical package builds',
        'release artifact and clean-consumer scripts',
        'formal repository gates'
      ],
      forbiddenContributors: [
        'manual tarball repair',
        'workspace/source fallback in consumer proof',
        'generated create-app template',
        'registry publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/release-package-artifacts.js',
        'scripts/release-readiness.js',
        'scripts/release-records.js',
        'scripts/__tests__/release-package-artifacts.test.mjs',
        'scripts/__tests__/release-clean-consumer.test.mjs',
        'scripts/__tests__/release-records.test.mjs',
        'fixtures/framework-release-consumer',
        'packages/*'
      ],
      specRefs: [
        '#5-validate-the-050-artifacts-before-publication',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-framework-artifacts'
    },
    {
      id: 'accept-merged-publication-source',
      order: 7,
      laneId: 'artifacts',
      title: 'Accept reviewed and merged publication source',
      ownerPackage: 'Framework version PR and main baseline owner',
      purpose:
        'Require a non-draft reviewed version PR, user-owned merge, and a clean latest main rebuild whose 19-package contents and candidate checksums match the reviewed source.',
      inputs: ['artifact:validated-0-5-0-artifacts'],
      outputs: [
        'artifact:merged-publication-source',
        'artifact:merged-source-finding'
      ],
      conditions: [
        'The PR diff contains only the authorized release contract, Inspector, generator, version, changelog, record, and direct release-test changes.',
        'CI, E2E, Framework readiness, and mergeability pass before the user merges.',
        'After the user merge, switch to main, run git pull --ff-only, and require local main to equal the latest remote main.',
        'Publication artifacts are rebuilt from clean latest main and compared with the reviewed candidate.',
        'Publication is not run from the feature branch even when its reviewed tree is byte-identical to main.',
        'Cleanup owner: accept-merged-publication-source owns no merge action; it owns only PR evidence and the clean post-merge source/artifact comparison.'
      ],
      bypasses: [
        'An unreviewed, draft, unmerged, failing, dirty, or checksum-divergent source produces artifact:merged-source-finding.',
        'The agent never merges the PR.'
      ],
      allowedContributors: [
        'artifact:validated-0-5-0-artifacts',
        'scoped release commits',
        'GitHub PR and CI evidence',
        'user-owned merge'
      ],
      forbiddenContributors: [
        'publication from a feature branch',
        'agent-owned merge',
        'unreviewed source change',
        'unrelated dirty-worktree content'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'current release branch',
        'GitHub version PR',
        'latest main after user merge',
        'tmp/framework-release-artifacts',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#6-review-and-merge-the-version-pr',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'accept-merged-publication-source'
    },
    {
      id: 'publish-framework-packages',
      order: 8,
      laneId: 'publication',
      title: 'Publish Framework 0.5.0 through Changesets',
      ownerPackage: 'Changesets multi-package publication owner',
      purpose:
        'After the irreversible checkpoint is accepted on clean latest main, assert that the unpublished selection is exactly the fixed 19-package allowlist and run yarn changeset publish once so Changesets publishes and tags successful packages.',
      inputs: [
        'artifact:merged-publication-source',
        'validated 19-package publication manifest',
        'npm identity and @asyra scope authorization'
      ],
      outputs: [
        'artifact:changesets-publication-result',
        'artifact:publication-finding'
      ],
      conditions: [
        'Workspace-only internal ranges are converted to the exact validated 0.5.0 publication ranges before Changesets runs.',
        'Restore development workspace ranges after publication on success or failure.',
        'The registry-diff selection is exactly the fixed 19-package allowlist before the first irreversible npm write.',
        'Changesets creates one Git tag for every successful package publication; no tag is created for a failed package.',
        'Keep successful package tags local and unpushed until all 19 public registry records verify.',
        'create-asyra-design-app, root asyra, and private @asyra/asyra-design are excluded.',
        'Cleanup owner: publish-framework-packages owns the transient publishable range conversion, restoration, and successful local release-tag state; npm owns immutable successful publications.'
      ],
      bypasses: [
        'Missing authorization, invalid npm identity/scope, unexpected publish selection, dirty source, or range mismatch produces artifact:publication-finding before publication.',
        'A Changesets partial failure records the successful and unpublished package subsets without overwriting any success.'
      ],
      allowedContributors: [
        'artifact:merged-publication-source',
        'validated publication manifest and checksums',
        'existing workspace-version owner',
        'Changesets publish command',
        'authorized npm identity'
      ],
      forbiddenContributors: [
        'manual npm publish loop',
        'remote tag push before complete registry verification',
        'unvalidated package or version',
        'create-app, root, or private app publication',
        'credential disclosure'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'scripts/workspace-versions.js',
        'scripts/bump-workspace-versions.js',
        'scripts/__tests__/workspace-automation.test.mjs',
        '.changeset/config.json',
        'packages/*/package.json',
        'yarn changeset publish'
      ],
      specRefs: [
        '#7-publish-the-synchronized-framework-050',
        '#partial-publication-policy',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'publish-framework-packages'
    },
    {
      id: 'verify-public-registry',
      order: 9,
      laneId: 'publication',
      title: 'Verify all public 0.5.0 records',
      ownerPackage: 'Framework public-registry verification owner',
      purpose:
        'Re-query the public npm registry after Changesets returns and verify all 19 Framework packages at 0.5.0, including metadata, dependency ranges, dist integrity, and installability.',
      inputs: ['artifact:changesets-publication-result'],
      outputs: [
        'artifact:public-0-5-0-registry-evidence',
        'artifact:registry-verification-finding'
      ],
      conditions: [
        'All 19 public name@0.5.0 records exist and match the approved publication identities and metadata.',
        'Registry dist integrity and dependency ranges are recorded for every package.',
        'The registry is queried directly without workspace, proxy cache, or local tarball substitution.',
        'After all 19 registry records pass, push the exact package tags and verify each remote tag resolves to the validated publication commit.',
        'Cleanup owner: verify-public-registry owns detached registry, installability, and remote-tag evidence and no registry mutation.'
      ],
      bypasses: [
        'A missing package, mismatched metadata, invalid integrity, or failed installation produces artifact:registry-verification-finding.',
        'A partial publication routes to recovery rather than being described as a complete registry baseline.'
      ],
      allowedContributors: [
        'artifact:changesets-publication-result',
        'public npm registry',
        'validated publication manifest',
        'clean install probes',
        'validated local package tags'
      ],
      forbiddenContributors: [
        'workspace or unpublished tarball proof',
        'registry overwrite',
        'mixed-version READY result',
        'remote tag push before complete registry verification',
        'cached pre-publication inventory'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'public npm registry',
        'git remote tag verification',
        'tmp/framework-release-evidence',
        'scripts/framework-release-packages.js',
        'fixtures/framework-release-consumer'
      ],
      specRefs: [
        '#7-publish-the-synchronized-framework-050',
        '#8-run-registry-only-consumer-proof',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'verify-public-registry'
    },
    {
      id: 'prove-registry-consumer-and-recover',
      order: 10,
      laneId: 'decision',
      title: 'Prove registry-only use or own recovery',
      ownerPackage: 'Registry-only consumer and partial-publication recovery owner',
      purpose:
        'On complete publication, run the full registry-only Framework consumer; on partial publication, preserve successful immutable versions and select same-version resume or complete-suite 0.5.0 to 0.5.1 recovery without a mixed final version.',
      inputs: [
        'artifact:changesets-publication-result',
        'artifact:publication-finding',
        'artifact:public-0-5-0-registry-evidence',
        'artifact:registry-verification-finding'
      ],
      outputs: [
        'artifact:registry-only-consumer-evidence',
        'artifact:partial-publication-recovery',
        'artifact:consumer-or-recovery-finding'
      ],
      conditions: [
        'The success route installs public name@0.5.0 only: no tarball, workspace, link, portal, source-directory install, or resolution.',
        'The success route passes install, typecheck, build, initialization, transaction, undo/redo, migration, Group, Collaboration, AI, and disabled-side-effect gates.',
        'The recovery route never overwrites a successful publication and resumes 0.5.0 only when the remaining artifacts are correct.',
        'A source or artifact defect after partial publication requires one complete all-package patch recovery from 0.5.0 to 0.5.1.',
        'Cleanup owner: prove-registry-consumer-and-recover owns isolated consumers, processes, ports, and the detached recovery decision; it owns no registry overwrite.'
      ],
      bypasses: [
        'A complete 0.5.0 registry set bypasses recovery and requires the registry-only consumer.',
        'A partial publication bypasses READY and requires an exact recovery artifact.',
        'Any consumer failure or recovery ambiguity produces artifact:consumer-or-recovery-finding.'
      ],
      allowedContributors: [
        'artifact:changesets-publication-result',
        'artifact:public-0-5-0-registry-evidence',
        'public npm registry',
        'registry-only consumer fixture',
        'partial-publication policy'
      ],
      forbiddenContributors: [
        'overwrite of an immutable successful version',
        'mixed final version',
        'workspace, link, portal, tarball, or resolution proof',
        'patching a defective published artifact in place'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'fixtures/framework-release-consumer',
        'scripts/release-readiness.js',
        'scripts/__tests__/release-clean-consumer.test.mjs',
        'scripts/changeset-all-patch.js',
        'docs/ai/framework/plans/framework-package-patch-release-plan.md',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#8-run-registry-only-consumer-proof',
        '#partial-publication-policy',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'prove-registry-consumer-and-recover'
    },
    {
      id: 'decide-release',
      order: 11,
      laneId: 'decision',
      title: 'Record the release and decide READY or BLOCKED',
      ownerPackage: 'Framework 0.5.0 release decision owner',
      purpose:
        'Assemble source, Inspector, inventory, version, artifact, PR, publication, registry, consumer, exclusion, and recovery records and emit the single current READY or BLOCKED decision.',
      inputs: [
        'artifact:registry-inventory',
        'artifact:inventory-finding',
        'artifact:historical-baseline-classification',
        'artifact:historical-baseline-finding',
        'artifact:local-0-4-0-baseline',
        'artifact:baseline-finding',
        'artifact:synchronized-minor-changeset',
        'artifact:changeset-finding',
        'artifact:versioned-0-5-0-source',
        'artifact:version-finding',
        'artifact:validated-0-5-0-artifacts',
        'artifact:artifact-validation-finding',
        'artifact:merged-publication-source',
        'artifact:merged-source-finding',
        'artifact:changesets-publication-result',
        'artifact:publication-finding',
        'artifact:public-0-5-0-registry-evidence',
        'artifact:registry-verification-finding',
        'artifact:registry-only-consumer-evidence',
        'artifact:partial-publication-recovery',
        'artifact:consumer-or-recovery-finding'
      ],
      outputs: ['artifact:release-ready', 'artifact:release-blocked'],
      conditions: [
        'READY requires one reviewed and merged source, all 19 public 0.5.0 records, registry-only consumer proof, exclusion proof, and no unresolved finding.',
        'BLOCKED names every still-relevant exact owner and recovery requirement.',
        'The report includes the source commit, Inspector, fixed allowlist, historical inventory, Changeset, versions, checksums, PR/CI state, registry results, consumer proof, exclusions, and blind spots.',
        'Closeout and the create-app release remain deferred until the user accepts the final decision.',
        'Cleanup owner: decide-release owns detached release records and the terminal decision only; it creates no merge, tag, publication, deployment, or closeout mutation.'
      ],
      bypasses: [
        'Any unresolved finding, partial publication, failed registry-only gate, or missing exclusion proof emits BLOCKED.',
        'READY never bypasses user acceptance of the final conclusion.'
      ],
      allowedContributors: [
        'all Inspector-owned evidence and findings',
        'reviewed Git and CI evidence',
        'public npm registry evidence',
        'formal release records'
      ],
      forbiddenContributors: [
        'unsupported readiness inference',
        'hidden failed gate',
        'automatic closeout',
        'automatic create-app release'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/plans/framework-package-patch-release-plan.md',
        'docs/ai/framework/plans/framework-package-release-flow-inspector.data.cjs',
        'docs/ai/framework/decisions/releases',
        'scripts/release-records.js',
        'scripts/__tests__/release-records.test.mjs',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#partial-publication-policy',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'decide-release'
    }
  ]

  const routes = [
    {
      id: 'inventory-to-classification',
      from: 'inventory-public-registry',
      to: 'classify-historical-baseline',
      kind: 'artifact',
      predicate: 'All fixed package names have current registry results.',
      producedArtifacts: ['artifact:registry-inventory']
    },
    {
      id: 'classification-to-baseline',
      from: 'classify-historical-baseline',
      to: 'materialize-local-baseline',
      kind: 'artifact',
      predicate: 'The historical split is classified as expected.',
      producedArtifacts: ['artifact:historical-baseline-classification']
    },
    {
      id: 'baseline-to-changeset',
      from: 'materialize-local-baseline',
      to: 'generate-synchronized-changeset',
      kind: 'artifact',
      predicate: 'Exactly 19 Framework packages are at local 0.4.0.',
      producedArtifacts: ['artifact:local-0-4-0-baseline']
    },
    {
      id: 'changeset-to-version',
      from: 'generate-synchronized-changeset',
      to: 'materialize-framework-version',
      kind: 'artifact',
      predicate: 'The single Changeset contains exactly 19 minor entries.',
      producedArtifacts: ['artifact:synchronized-minor-changeset']
    },
    {
      id: 'version-to-artifacts',
      from: 'materialize-framework-version',
      to: 'validate-framework-artifacts',
      kind: 'artifact',
      predicate: 'All and only the Framework packages are at 0.5.0.',
      producedArtifacts: ['artifact:versioned-0-5-0-source']
    },
    {
      id: 'artifacts-to-merge',
      from: 'validate-framework-artifacts',
      to: 'accept-merged-publication-source',
      kind: 'artifact',
      predicate: 'The complete 0.5.0 artifact and formal gate set passes.',
      producedArtifacts: ['artifact:validated-0-5-0-artifacts']
    },
    {
      id: 'merged-source-to-publication',
      from: 'accept-merged-publication-source',
      to: 'publish-framework-packages',
      kind: 'artifact',
      predicate: 'The reviewed PR is user-merged and clean main reproduces it.',
      producedArtifacts: ['artifact:merged-publication-source']
    },
    {
      id: 'publication-to-registry',
      from: 'publish-framework-packages',
      to: 'verify-public-registry',
      kind: 'artifact',
      predicate: 'Changesets returned a publication result.',
      producedArtifacts: ['artifact:changesets-publication-result']
    },
    {
      id: 'publication-result-to-consumer-or-recovery',
      from: 'publish-framework-packages',
      to: 'prove-registry-consumer-and-recover',
      kind: 'evidence',
      predicate: 'The exact successful and unsuccessful package subsets are known.',
      producedArtifacts: ['artifact:changesets-publication-result']
    },
    {
      id: 'publication-finding-to-recovery',
      from: 'publish-framework-packages',
      to: 'prove-registry-consumer-and-recover',
      kind: 'failure',
      predicate: 'Publication was blocked or partially failed.',
      producedArtifacts: ['artifact:publication-finding']
    },
    {
      id: 'registry-to-consumer',
      from: 'verify-public-registry',
      to: 'prove-registry-consumer-and-recover',
      kind: 'artifact',
      predicate: 'All 19 public 0.5.0 records are verified.',
      producedArtifacts: ['artifact:public-0-5-0-registry-evidence']
    },
    {
      id: 'registry-finding-to-recovery',
      from: 'verify-public-registry',
      to: 'prove-registry-consumer-and-recover',
      kind: 'failure',
      predicate: 'A public registry record is missing or invalid.',
      producedArtifacts: ['artifact:registry-verification-finding']
    },
    {
      id: 'consumer-evidence-to-decision',
      from: 'prove-registry-consumer-and-recover',
      to: 'decide-release',
      kind: 'evidence',
      predicate: 'The complete registry-only consumer passes.',
      producedArtifacts: ['artifact:registry-only-consumer-evidence']
    },
    {
      id: 'recovery-to-decision',
      from: 'prove-registry-consumer-and-recover',
      to: 'decide-release',
      kind: 'evidence',
      predicate: 'A partial-publication recovery requirement is exact.',
      producedArtifacts: ['artifact:partial-publication-recovery']
    },
    {
      id: 'consumer-or-recovery-finding-to-decision',
      from: 'prove-registry-consumer-and-recover',
      to: 'decide-release',
      kind: 'failure',
      predicate: 'Consumer proof or recovery classification is incomplete.',
      producedArtifacts: ['artifact:consumer-or-recovery-finding']
    },
    ...[
      ['inventory-public-registry', 'artifact:registry-inventory'],
      ['inventory-public-registry', 'artifact:inventory-finding'],
      [
        'classify-historical-baseline',
        'artifact:historical-baseline-classification'
      ],
      ['classify-historical-baseline', 'artifact:historical-baseline-finding'],
      ['materialize-local-baseline', 'artifact:local-0-4-0-baseline'],
      ['materialize-local-baseline', 'artifact:baseline-finding'],
      [
        'generate-synchronized-changeset',
        'artifact:synchronized-minor-changeset'
      ],
      ['generate-synchronized-changeset', 'artifact:changeset-finding'],
      ['materialize-framework-version', 'artifact:versioned-0-5-0-source'],
      ['materialize-framework-version', 'artifact:version-finding'],
      [
        'validate-framework-artifacts',
        'artifact:validated-0-5-0-artifacts'
      ],
      ['validate-framework-artifacts', 'artifact:artifact-validation-finding'],
      [
        'accept-merged-publication-source',
        'artifact:merged-publication-source'
      ],
      ['accept-merged-publication-source', 'artifact:merged-source-finding'],
      [
        'publish-framework-packages',
        'artifact:changesets-publication-result'
      ],
      ['publish-framework-packages', 'artifact:publication-finding'],
      [
        'verify-public-registry',
        'artifact:public-0-5-0-registry-evidence'
      ],
      ['verify-public-registry', 'artifact:registry-verification-finding']
    ].map(([from, artifactId]) => ({
      id: `${from}-${artifactId.replace('artifact:', '')}-to-decision`,
      from,
      to: 'decide-release',
      kind: artifactId.endsWith('finding') ? 'failure' : 'evidence',
      predicate: 'The final release record consumes this owner result.',
      producedArtifacts: [artifactId]
    })),
    {
      id: 'ready-terminal',
      from: 'decide-release',
      kind: 'terminal',
      predicate: 'Every required 0.5.0 release proof passes.',
      producedArtifacts: ['artifact:release-ready']
    },
    {
      id: 'blocked-terminal',
      from: 'decide-release',
      kind: 'terminal',
      predicate: 'At least one exact owner finding or recovery remains.',
      producedArtifacts: ['artifact:release-blocked']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:registry-inventory',
      ownerStepId: 'inventory-public-registry',
      channel: 'current public registry inventory',
      consumerStepIds: ['classify-historical-baseline', 'decide-release']
    },
    {
      id: 'artifact:inventory-finding',
      ownerStepId: 'inventory-public-registry',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:historical-baseline-classification',
      ownerStepId: 'classify-historical-baseline',
      channel: 'release-history classification',
      consumerStepIds: ['materialize-local-baseline', 'decide-release']
    },
    {
      id: 'artifact:historical-baseline-finding',
      ownerStepId: 'classify-historical-baseline',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:local-0-4-0-baseline',
      ownerStepId: 'materialize-local-baseline',
      channel: 'local manifest baseline',
      consumerStepIds: ['generate-synchronized-changeset', 'decide-release']
    },
    {
      id: 'artifact:baseline-finding',
      ownerStepId: 'materialize-local-baseline',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:synchronized-minor-changeset',
      ownerStepId: 'generate-synchronized-changeset',
      channel: 'Changesets release input',
      consumerStepIds: ['materialize-framework-version', 'decide-release']
    },
    {
      id: 'artifact:changeset-finding',
      ownerStepId: 'generate-synchronized-changeset',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:versioned-0-5-0-source',
      ownerStepId: 'materialize-framework-version',
      channel: 'versioned source and changelogs',
      consumerStepIds: ['validate-framework-artifacts', 'decide-release']
    },
    {
      id: 'artifact:version-finding',
      ownerStepId: 'materialize-framework-version',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:validated-0-5-0-artifacts',
      ownerStepId: 'validate-framework-artifacts',
      channel: 'validated local artifacts and formal gates',
      consumerStepIds: ['accept-merged-publication-source', 'decide-release']
    },
    {
      id: 'artifact:artifact-validation-finding',
      ownerStepId: 'validate-framework-artifacts',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:merged-publication-source',
      ownerStepId: 'accept-merged-publication-source',
      channel: 'reviewed merged clean-main source',
      consumerStepIds: ['publish-framework-packages', 'decide-release']
    },
    {
      id: 'artifact:merged-source-finding',
      ownerStepId: 'accept-merged-publication-source',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:changesets-publication-result',
      ownerStepId: 'publish-framework-packages',
      channel: 'Changesets publication result',
      consumerStepIds: [
        'verify-public-registry',
        'prove-registry-consumer-and-recover',
        'decide-release'
      ]
    },
    {
      id: 'artifact:publication-finding',
      ownerStepId: 'publish-framework-packages',
      channel: 'owner finding',
      consumerStepIds: ['prove-registry-consumer-and-recover', 'decide-release']
    },
    {
      id: 'artifact:public-0-5-0-registry-evidence',
      ownerStepId: 'verify-public-registry',
      channel: 'public registry verification',
      consumerStepIds: ['prove-registry-consumer-and-recover', 'decide-release']
    },
    {
      id: 'artifact:registry-verification-finding',
      ownerStepId: 'verify-public-registry',
      channel: 'owner finding',
      consumerStepIds: ['prove-registry-consumer-and-recover', 'decide-release']
    },
    {
      id: 'artifact:registry-only-consumer-evidence',
      ownerStepId: 'prove-registry-consumer-and-recover',
      channel: 'registry-only consumer result',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:partial-publication-recovery',
      ownerStepId: 'prove-registry-consumer-and-recover',
      channel: 'partial-publication recovery decision',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:consumer-or-recovery-finding',
      ownerStepId: 'prove-registry-consumer-and-recover',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:release-ready',
      ownerStepId: 'decide-release',
      channel: 'terminal release decision',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:release-blocked',
      ownerStepId: 'decide-release',
      channel: 'terminal release decision',
      consumerStepIds: [],
      terminal: true
    }
  ]

  artifacts.forEach((artifact) => {
    if (!Object.hasOwn(artifact, 'terminal')) artifact.terminal = false
  })

  const invariants = [
    {
      id: 'fixed-release-set-invariant',
      title: 'The release set is exactly 19 Framework packages',
      statement:
        'Version materialization, Changeset generation, artifacts, publication, verification, and consumer proof use the same fixed 19-package allowlist and exclude root, private app, and create-app.',
      stepIds: steps.map((step) => step.id),
      artifactIds: artifacts.map((artifact) => artifact.id),
      specRefs: ['#release-set', '#definition-of-done']
    },
    {
      id: 'historical-version-invariant',
      title: 'Historical 0.2.5 is evidence, not a publication target',
      statement:
        'The current run records old public 0.2.5 packages and their source-generation differences without reconstructing, overwriting, or publishing a missing 0.2.5 package.',
      stepIds: [
        'inventory-public-registry',
        'classify-historical-baseline'
      ],
      artifactIds: [
        'artifact:registry-inventory',
        'artifact:historical-baseline-classification'
      ],
      specRefs: ['#status', '#release-set']
    },
    {
      id: 'exceptional-changeset-invariant',
      title: 'All-package generation remains exceptional',
      statement:
        'The approved large realignment uses one explicit minor generation from local 0.4.0 to 0.5.0; ordinary later development uses scoped Changesets.',
      stepIds: [
        'materialize-local-baseline',
        'generate-synchronized-changeset',
        'materialize-framework-version'
      ],
      artifactIds: [
        'artifact:local-0-4-0-baseline',
        'artifact:synchronized-minor-changeset',
        'artifact:versioned-0-5-0-source'
      ],
      specRefs: ['#changeset-contract', '#definition-of-done']
    },
    {
      id: 'immutable-publication-invariant',
      title: 'Successful registry publications are immutable',
      statement:
        'A successful package version is never overwritten; correct remaining artifacts may resume at 0.5.0, while a defect advances the full suite to 0.5.1.',
      stepIds: [
        'publish-framework-packages',
        'verify-public-registry',
        'prove-registry-consumer-and-recover'
      ],
      artifactIds: [
        'artifact:changesets-publication-result',
        'artifact:partial-publication-recovery'
      ],
      specRefs: ['#partial-publication-policy']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'registry-history-case',
      title: 'Current registry inventory and historical classification',
      assertions: [
        'All 19 names are queried directly and the 12-present/seven-missing historical 0.2.5 split is recorded.',
        'Expected source-generation differences are retained as history without any 0.2.5 publication.'
      ],
      stepIds: [
        'inventory-public-registry',
        'classify-historical-baseline'
      ],
      specRefs: ['#1-freeze-source-and-registry-state']
    },
    {
      id: 'exceptional-version-case',
      title: 'Exact 0.4.0 to minor to 0.5.0 materialization',
      assertions: [
        'Exactly 19 Framework manifests become local 0.4.0 and no excluded owner changes.',
        'One explicit minor Changeset advances exactly those packages to 0.5.0 with changelogs.'
      ],
      stepIds: [
        'materialize-local-baseline',
        'generate-synchronized-changeset',
        'materialize-framework-version'
      ],
      specRefs: [
        '#2-materialize-the-exceptional-local-baseline',
        '#3-generate-the-synchronized-minor-changeset',
        '#4-materialize-050'
      ]
    },
    {
      id: 'artifact-and-merge-case',
      title: 'Validated artifacts and reviewed merge source',
      assertions: [
        'All 19 artifacts and formal gates pass under Node.js 24.',
        'The user-reviewed PR is merged and clean latest main reproduces the candidate before publication.'
      ],
      stepIds: [
        'validate-framework-artifacts',
        'accept-merged-publication-source'
      ],
      specRefs: [
        '#5-validate-the-050-artifacts-before-publication',
        '#6-review-and-merge-the-version-pr'
      ]
    },
    {
      id: 'publication-and-registry-case',
      title: 'Changesets publication and registry verification',
      assertions: [
        'One Changesets command publishes only the fixed 19-package 0.5.0 set without Git tags.',
        'Every public record, dependency range, integrity, and installation result is verified.'
      ],
      stepIds: ['publish-framework-packages', 'verify-public-registry'],
      specRefs: ['#7-publish-the-synchronized-framework-050']
    },
    {
      id: 'consumer-recovery-decision-case',
      title: 'Registry-only proof, exact recovery, and final decision',
      assertions: [
        'A complete publication passes every registry-only public flow without local substitution.',
        'A partial publication follows immutable same-version resume or full-suite 0.5.1 recovery and produces BLOCKED until complete.',
        'The final record emits only READY or BLOCKED and waits for user acceptance before closeout.'
      ],
      stepIds: [
        'prove-registry-consumer-and-recover',
        'decide-release'
      ],
      specRefs: [
        '#8-run-registry-only-consumer-proof',
        '#partial-publication-policy',
        '#definition-of-done'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'framework-package-release-0-5-0',
      kind: 'system',
      title: 'Framework Package 0.5.0 Release Inspector',
      subtitle:
        'Historical registry inventory through exceptional 0.4.0-to-0.5.0 versioning, reviewed artifacts, Changesets publication, registry-only proof, recovery, and one final decision.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Framework Package 0.5.0 Release Plan',
      inspectorOwner: 'Framework Package 0.5.0 Release Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Release Plan',
        href: './framework-package-patch-release-plan.md',
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
        href: '../FLOW_INSPECTOR.md',
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
