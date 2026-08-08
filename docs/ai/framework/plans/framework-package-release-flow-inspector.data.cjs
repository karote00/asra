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
        'Query the public npm registry for the fixed 19-package allowlist and record current present or missing records, metadata, versions, and integrity without reusing a dated inventory.',
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
      title: 'Classify historical registry records',
      ownerPackage: 'Framework release-history classification owner',
      purpose:
        'Classify historical public manifest differences without treating an old registry version as the source or target for the current release.',
      inputs: ['artifact:registry-inventory', 'current 19 package manifests'],
      outputs: [
        'artifact:historical-baseline-classification',
        'artifact:historical-baseline-finding'
      ],
      conditions: [
        'The classification names each present or missing registry record and concrete dependency-contract difference without treating old artifacts as current source.',
        'This owner must not publish, reconstruct, or overwrite any historical package version.',
        'Cleanup owner: classify-historical-baseline owns detached comparison evidence only and creates no registry or manifest mutation.'
      ],
      bypasses: [
        'An unexpected package outside the allowlist or an unclassified registry response produces artifact:historical-baseline-finding.',
        'Expected historical differences do not override the manifest-derived current release plan.'
      ],
      allowedContributors: [
        'artifact:registry-inventory',
        'current fixed-allowlist manifests',
        'user-approved large-change version semantics'
      ],
      forbiddenContributors: [
        'publishing current source as an old registry version',
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
      id: 'resolve-version-topology',
      order: 3,
      laneId: 'versioning',
      title: 'Resolve manifest version topology',
      ownerPackage: 'Framework release version topology owner',
      purpose:
        'Read the fixed-allowlist manifests, establish their shared release family, and preserve the independently owned root, private app, CLI, and generated-template versions without duplicating any numeric version in the release contract.',
      inputs: [
        'artifact:historical-baseline-classification',
        'fixed 19-package allowlist',
        'clean feature-branch manifests'
      ],
      outputs: ['artifact:version-topology', 'artifact:baseline-finding'],
      conditions: [
        'Exactly 19 Framework manifest versions resolve to one release family and remain the only inputs to Framework Changesets.',
        'Root asyra, private @asyra/asyra-design, and create-asyra-design-app versions remain unchanged.',
        'Documentation and validators derive package versions from manifests instead of storing a numeric baseline, target, or recovery constant.',
        'Cleanup owner: resolve-version-topology owns detached topology evidence only and creates no manifest or registry mutation.'
      ],
      bypasses: [
        'Any missing package, invalid semantic version, mixed release family, excluded-owner mutation, or dirty unrelated file produces artifact:baseline-finding.',
        'No Changeset review or registry operation begins from unresolved topology.'
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
        '#2-resolve-the-changeset-release-scope',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'resolve-version-topology'
    },
    {
      id: 'review-scoped-changesets',
      order: 4,
      laneId: 'versioning',
      title: 'Review the scoped Changeset plan',
      ownerPackage: 'Framework Changeset scope owner',
      purpose:
        'Review ordinary scoped Changesets and yarn changeset status so only changed fixed-allowlist Framework packages receive the authorized release type and every target version remains tool-derived.',
      inputs: [
        'artifact:version-topology',
        'fixed 19-package allowlist',
        'pending Changesets before canonical version materialization'
      ],
      outputs: [
        'artifact:reviewed-changeset-plan',
        'artifact:changeset-finding'
      ],
      conditions: [
        'Every selected entry is unique, belongs to the fixed Framework allowlist, and uses patch during normal development.',
        'A major or minor family change and any exceptional all-package generator invocation require explicit user authorization.',
        'yarn changeset status is the target-version authority; no release document or validator duplicates its numbers.',
        'Cleanup owner: review-scoped-changesets owns the reviewed Changeset plan and no package manifest version.'
      ],
      bypasses: [
        'An unsupported type, duplicate, missing, root, private, create-app, generated-template, or other workspace entry produces artifact:changeset-finding.',
        'A consumed Changeset is validated through the materialized manifest diff rather than required to remain pending.'
      ],
      allowedContributors: [
        'artifact:version-topology',
        'scripts/framework-release-packages.js',
        'Changesets status command'
      ],
      forbiddenContributors: [
        'unapproved major or minor family change',
        'exceptional all-package generation used as routine versioning',
        'root, private app, create-app, or non-allowlist workspace',
        'automatic publish or Git tag creation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'package.json',
        'scripts/framework-release-packages.js',
        'scripts/__tests__/changeset-all-patch.test.mjs',
        '.changeset',
        '.changeset/config.json'
      ],
      specRefs: [
        '#changeset-contract',
        '#2-resolve-the-changeset-release-scope',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'review-scoped-changesets'
    },
    {
      id: 'materialize-framework-version',
      order: 5,
      laneId: 'versioning',
      title: 'Materialize the reviewed Framework versions',
      ownerPackage: 'Changesets version and release-record owner',
      purpose:
        'Run yarn changeset version once so the reviewed Framework selection advances to tool-derived manifest versions with generated changelogs and synchronized internal version records.',
      inputs: ['artifact:reviewed-changeset-plan'],
      outputs: ['artifact:versioned-framework-source', 'artifact:version-finding'],
      conditions: [
        'All and only the reviewed fixed-allowlist package versions change to the values produced by Changesets.',
        'Root asyra, private @asyra/asyra-design, and create-app remain at their pre-release versions.',
        'Gate 5 records derive the Framework candidate version from the fixed release set instead of forcing root or private owners to match.',
        'Cleanup owner: materialize-framework-version owns Changesets version output, package changelogs, and the test-first release-record adjustment.'
      ],
      bypasses: [
        'Any result that differs from Changesets status, changes an excluded owner, omits a required changelog, or retains stale pending state produces artifact:version-finding.',
        'No create-app template is regenerated.'
      ],
      allowedContributors: [
        'artifact:reviewed-changeset-plan',
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
        '#3-materialize-framework-versions',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'materialize-framework-version'
    },
    {
      id: 'validate-framework-artifacts',
      order: 6,
      laneId: 'artifacts',
      title: 'Validate the Framework artifacts',
      ownerPackage: 'Framework artifact and clean-consumer validators',
      purpose:
        'Build, pack, checksum, and validate the complete fixed-allowlist artifact set at its manifest versions, then exercise the accepted exact-version tarball consumer and required formal gates.',
      inputs: ['artifact:versioned-framework-source'],
      outputs: [
        'artifact:validated-framework-artifacts',
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
        'artifact:versioned-framework-source',
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
        'scripts/__tests__/workspace-automation.test.mjs',
        '.github/workflows/main.yml',
        'fixtures/framework-release-consumer',
        'packages/*'
      ],
      specRefs: [
        '#4-validate-framework-artifacts-before-publication',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-framework-artifacts'
    },
    {
      id: 'accept-publication-source',
      order: 7,
      laneId: 'artifacts',
      title: 'Accept the exact publication source',
      ownerPackage: 'Framework publication source owner',
      purpose:
        'Require a clean exact source commit on main or a non-main feature branch whose 19-package contents and candidate checksums reproduce the validated artifacts before publication.',
      inputs: ['artifact:validated-framework-artifacts'],
      outputs: [
        'artifact:publication-source',
        'artifact:source-finding'
      ],
      conditions: [
        'The PR diff contains only the authorized release contract, Inspector, generator, version, changelog, record, and direct release-test changes.',
        'CI, E2E, Framework readiness, and the scoped release gates pass for the selected source commit.',
        'Publication may run from main or a non-main feature branch; the exact branch and commit are recorded without making merge a prerequisite.',
        'Publication artifacts are rebuilt from the clean exact source commit and compared with the validated candidate.',
        'Cleanup owner: accept-publication-source owns no merge action; it owns only source, PR, gate, and artifact-comparison evidence.'
      ],
      bypasses: [
        'A failing, dirty, unidentified, or checksum-divergent source produces artifact:source-finding.',
        'The agent never merges the PR.'
      ],
      allowedContributors: [
        'artifact:validated-framework-artifacts',
        'scoped release commits',
        'GitHub PR and CI evidence',
        'clean main or feature-branch source commit'
      ],
      forbiddenContributors: [
        'agent-owned merge',
        'uncommitted source change',
        'unrelated dirty-worktree content'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'current release branch',
        'GitHub version PR',
        'selected exact publication source commit',
        'tmp/framework-release-artifacts',
        'tmp/framework-release-evidence'
      ],
      specRefs: [
        '#5-freeze-the-publication-source',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'accept-publication-source'
    },
    {
      id: 'publish-framework-packages',
      order: 8,
      laneId: 'publication',
      title: 'Publish the reviewed Framework selection through Changesets',
      ownerPackage: 'Changesets multi-package publication owner',
      purpose:
        'After the irreversible checkpoint is accepted for the clean exact source commit, assert that the unpublished selection is exactly the fixed 19-package allowlist and run yarn changeset publish once so Changesets publishes and tags successful packages.',
      inputs: [
        'artifact:publication-source',
        'validated 19-package publication manifest',
        'npm identity and @asyra scope authorization'
      ],
      outputs: [
        'artifact:changesets-publication-result',
        'artifact:publication-finding'
      ],
      conditions: [
        'Workspace-only internal ranges are converted to each exact validated manifest version before Changesets runs.',
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
        'artifact:publication-source',
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
        '#6-publish-the-manifest-derived-framework-selection',
        '#partial-publication-policy',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'publish-framework-packages'
    },
    {
      id: 'verify-public-registry',
      order: 9,
      laneId: 'publication',
      title: 'Verify every expected public registry record',
      ownerPackage: 'Framework public-registry verification owner',
      purpose:
        'Re-query the public npm registry after Changesets returns and verify every expected Framework name@version record, including metadata, dependency ranges, dist integrity, and installability.',
      inputs: ['artifact:changesets-publication-result'],
      outputs: [
        'artifact:public-registry-evidence',
        'artifact:registry-verification-finding'
      ],
      conditions: [
        'Every expected public name@version record exists and matches the approved publication identity and metadata.',
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
        '#6-publish-the-manifest-derived-framework-selection',
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
        'On complete publication, run the full registry-only Framework consumer; on partial publication, preserve successful immutable versions and select same-version resume or one complete-suite patch recovery without a mixed final version.',
      inputs: [
        'artifact:changesets-publication-result',
        'artifact:publication-finding',
        'artifact:public-registry-evidence',
        'artifact:registry-verification-finding'
      ],
      outputs: [
        'artifact:registry-only-consumer-evidence',
        'artifact:partial-publication-recovery',
        'artifact:consumer-or-recovery-finding'
      ],
      conditions: [
        'The success route installs only the exact public name@version set from release evidence: no tarball, workspace, link, portal, source-directory install, or resolution.',
        'The success route passes install, typecheck, build, initialization, transaction, undo/redo, migration, Group, Collaboration, AI, and disabled-side-effect gates.',
        'The recovery route never overwrites a successful publication and resumes the same target versions only when the remaining artifacts are correct.',
        'A source or artifact defect after partial publication requires one complete all-package patch Changeset whose target versions are derived by Changesets.',
        'Cleanup owner: prove-registry-consumer-and-recover owns isolated consumers, processes, ports, and the detached recovery decision; it owns no registry overwrite.'
      ],
      bypasses: [
        'A complete expected registry set bypasses recovery and requires the registry-only consumer.',
        'A partial publication bypasses READY and requires an exact recovery artifact.',
        'Any consumer failure or recovery ambiguity produces artifact:consumer-or-recovery-finding.'
      ],
      allowedContributors: [
        'artifact:changesets-publication-result',
        'artifact:public-registry-evidence',
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
      ownerPackage: 'Framework release decision owner',
      purpose:
        'Assemble source, Inspector, inventory, version, artifact, PR, publication, registry, consumer, exclusion, and recovery records and emit the single current READY or BLOCKED decision.',
      inputs: [
        'artifact:registry-inventory',
        'artifact:inventory-finding',
        'artifact:historical-baseline-classification',
        'artifact:historical-baseline-finding',
        'artifact:version-topology',
        'artifact:baseline-finding',
        'artifact:reviewed-changeset-plan',
        'artifact:changeset-finding',
        'artifact:versioned-framework-source',
        'artifact:version-finding',
        'artifact:validated-framework-artifacts',
        'artifact:artifact-validation-finding',
        'artifact:publication-source',
        'artifact:source-finding',
        'artifact:changesets-publication-result',
        'artifact:publication-finding',
        'artifact:public-registry-evidence',
        'artifact:registry-verification-finding',
        'artifact:registry-only-consumer-evidence',
        'artifact:partial-publication-recovery',
        'artifact:consumer-or-recovery-finding'
      ],
      outputs: ['artifact:release-ready', 'artifact:release-blocked'],
      conditions: [
        'READY requires one clean exact publication source, every expected public name@version record, registry-only consumer proof, exclusion proof, and no unresolved finding.',
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
      to: 'resolve-version-topology',
      kind: 'artifact',
      predicate: 'The historical split is classified as expected.',
      producedArtifacts: ['artifact:historical-baseline-classification']
    },
    {
      id: 'topology-to-changeset-review',
      from: 'resolve-version-topology',
      to: 'review-scoped-changesets',
      kind: 'artifact',
      predicate: 'All fixed-allowlist manifests resolve to one release family.',
      producedArtifacts: ['artifact:version-topology']
    },
    {
      id: 'changeset-review-to-version',
      from: 'review-scoped-changesets',
      to: 'materialize-framework-version',
      kind: 'artifact',
      predicate: 'The scoped Changeset plan contains only authorized Framework entries and release types.',
      producedArtifacts: ['artifact:reviewed-changeset-plan']
    },
    {
      id: 'version-to-artifacts',
      from: 'materialize-framework-version',
      to: 'validate-framework-artifacts',
      kind: 'artifact',
      predicate: 'The materialized manifest diff matches the reviewed Changesets plan.',
      producedArtifacts: ['artifact:versioned-framework-source']
    },
    {
      id: 'artifacts-to-publication-source',
      from: 'validate-framework-artifacts',
      to: 'accept-publication-source',
      kind: 'artifact',
      predicate: 'The complete candidate artifact and formal gate set passes.',
      producedArtifacts: ['artifact:validated-framework-artifacts']
    },
    {
      id: 'source-to-publication',
      from: 'accept-publication-source',
      to: 'publish-framework-packages',
      kind: 'artifact',
      predicate: 'The clean exact source commit reproduces the validated candidate.',
      producedArtifacts: ['artifact:publication-source']
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
      predicate: 'Every expected public name@version record is verified.',
      producedArtifacts: ['artifact:public-registry-evidence']
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
      ['resolve-version-topology', 'artifact:version-topology'],
      ['resolve-version-topology', 'artifact:baseline-finding'],
      [
        'review-scoped-changesets',
        'artifact:reviewed-changeset-plan'
      ],
      ['review-scoped-changesets', 'artifact:changeset-finding'],
      ['materialize-framework-version', 'artifact:versioned-framework-source'],
      ['materialize-framework-version', 'artifact:version-finding'],
      [
        'validate-framework-artifacts',
        'artifact:validated-framework-artifacts'
      ],
      ['validate-framework-artifacts', 'artifact:artifact-validation-finding'],
      [
        'accept-publication-source',
        'artifact:publication-source'
      ],
      ['accept-publication-source', 'artifact:source-finding'],
      [
        'publish-framework-packages',
        'artifact:changesets-publication-result'
      ],
      ['publish-framework-packages', 'artifact:publication-finding'],
      [
        'verify-public-registry',
        'artifact:public-registry-evidence'
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
      predicate: 'Every required manifest-derived release proof passes.',
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
      consumerStepIds: ['resolve-version-topology', 'decide-release']
    },
    {
      id: 'artifact:historical-baseline-finding',
      ownerStepId: 'classify-historical-baseline',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:version-topology',
      ownerStepId: 'resolve-version-topology',
      channel: 'local manifest baseline',
      consumerStepIds: ['review-scoped-changesets', 'decide-release']
    },
    {
      id: 'artifact:baseline-finding',
      ownerStepId: 'resolve-version-topology',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:reviewed-changeset-plan',
      ownerStepId: 'review-scoped-changesets',
      channel: 'Changesets release input',
      consumerStepIds: ['materialize-framework-version', 'decide-release']
    },
    {
      id: 'artifact:changeset-finding',
      ownerStepId: 'review-scoped-changesets',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:versioned-framework-source',
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
      id: 'artifact:validated-framework-artifacts',
      ownerStepId: 'validate-framework-artifacts',
      channel: 'validated local artifacts and formal gates',
      consumerStepIds: ['accept-publication-source', 'decide-release']
    },
    {
      id: 'artifact:artifact-validation-finding',
      ownerStepId: 'validate-framework-artifacts',
      channel: 'owner finding',
      consumerStepIds: ['decide-release']
    },
    {
      id: 'artifact:publication-source',
      ownerStepId: 'accept-publication-source',
      channel: 'clean exact publication source',
      consumerStepIds: ['publish-framework-packages', 'decide-release']
    },
    {
      id: 'artifact:source-finding',
      ownerStepId: 'accept-publication-source',
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
      id: 'artifact:public-registry-evidence',
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
      title: 'Historical registry state is evidence, not a publication target',
      statement:
        'The current run records old public package versions and their source-generation differences without reconstructing, overwriting, or publishing a missing historical version from newer source.',
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
        'Normal development uses scoped patch Changesets; an all-package generator or family change requires explicit user authorization and still derives its target versions through Changesets.',
      stepIds: [
        'resolve-version-topology',
        'review-scoped-changesets',
        'materialize-framework-version'
      ],
      artifactIds: [
        'artifact:version-topology',
        'artifact:reviewed-changeset-plan',
        'artifact:versioned-framework-source'
      ],
      specRefs: ['#changeset-contract', '#definition-of-done']
    },
    {
      id: 'immutable-publication-invariant',
      title: 'Successful registry publications are immutable',
      statement:
        'A successful package version is never overwritten; correct remaining artifacts may resume at the same reviewed versions, while a defect advances the full suite through one new all-package patch Changeset.',
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
        'All fixed-allowlist names are queried directly and current present or missing registry records are captured.',
        'Expected source-generation differences are retained as history without publishing any old version from newer source.'
      ],
      stepIds: [
        'inventory-public-registry',
        'classify-historical-baseline'
      ],
      specRefs: ['#1-freeze-source-and-registry-state']
    },
    {
      id: 'version-materialization-case',
      title: 'Manifest-derived version topology and Changesets materialization',
      assertions: [
        'All fixed-allowlist manifests resolve to one release family and excluded owners remain independently versioned.',
        'The reviewed scoped Changeset plan alone determines changed packages, release types, target versions, and changelogs.'
      ],
      stepIds: [
        'resolve-version-topology',
        'review-scoped-changesets',
        'materialize-framework-version'
      ],
      specRefs: [
        '#2-resolve-the-changeset-release-scope',
        '#2-resolve-the-changeset-release-scope',
        '#3-materialize-framework-versions'
      ]
    },
    {
      id: 'artifact-and-source-case',
      title: 'Validated artifacts and exact publication source',
      assertions: [
        'All 19 artifacts and formal gates pass under Node.js 24.',
        'A clean exact source commit on main or a feature branch reproduces the candidate before publication.'
      ],
      stepIds: [
        'validate-framework-artifacts',
        'accept-publication-source'
      ],
      specRefs: [
        '#4-validate-framework-artifacts-before-publication',
        '#5-freeze-the-publication-source'
      ]
    },
    {
      id: 'publication-and-registry-case',
      title: 'Changesets publication and registry verification',
      assertions: [
        'One Changesets command publishes only the reviewed unpublished fixed-allowlist selection and owns successful package tags.',
        'Every public record, dependency range, integrity, and installation result is verified.'
      ],
      stepIds: ['publish-framework-packages', 'verify-public-registry'],
      specRefs: ['#6-publish-the-manifest-derived-framework-selection']
    },
    {
      id: 'consumer-recovery-decision-case',
      title: 'Registry-only proof, exact recovery, and final decision',
      assertions: [
        'A complete publication passes every registry-only public flow without local substitution.',
        'A partial publication follows immutable same-version resume or one complete all-package patch recovery and produces BLOCKED until complete.',
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
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'framework-package-release',
      kind: 'system',
      title: 'Framework Package Release Inspector',
      subtitle:
        'Current registry inventory through manifest-derived Changesets versioning, reviewed artifacts, authorized publication, registry-only proof, recovery, and one final decision.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Framework Package Patch Release Plan',
      inspectorOwner: 'Framework Package Release Inspector data'
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
