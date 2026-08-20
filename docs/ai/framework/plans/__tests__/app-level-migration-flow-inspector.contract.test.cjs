const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../app-level-migration-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const contractText = (owner) =>
  [
    owner.purpose,
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors,
    ...owner.implementationBoundary
  ].join(' ')

test('dedicated migration Inspector and product authority resolve', () => {
  assert.equal(data.target.title, 'App-level Migration Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/app-level-migration-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(__dirname, '../app-level-migration-flow-inspector.html')
    )
  )
  assert.ok(
    step('receive-raw-document').implementationBoundary.includes(
      'packages/persistence/src/providers/index.ts'
    )
  )
})

test('every step has exact execution fields and all routes and artifacts resolve', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))
  const requiredFields = [
    'id',
    'order',
    'laneId',
    'title',
    'ownerPackage',
    'purpose',
    'inputs',
    'outputs',
    'conditions',
    'bypasses',
    'allowedContributors',
    'forbiddenContributors',
    'cacheDimensions',
    'implementationBoundary',
    'specRefs',
    'failureOwnerStepId'
  ]

  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [])
    item.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((id) => assert.ok(artifactIds.has(id), `${item.id} input ${id}`))
    item.outputs.forEach((id) =>
      assert.ok(artifactIds.has(id), `${item.id} output ${id}`)
    )
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    route.producedArtifacts.forEach((id) => {
      const artifact = data.artifacts.find((item) => item.id === id)
      assert.ok(artifact, `${route.id} artifact ${id}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner ${id}`)
      if (route.to)
        assert.ok(
          artifact.consumerStepIds.includes(route.to),
          `${route.id} consumer ${id}`
        )
    })
  })

  data.artifacts.forEach((artifact) => {
    const owner = step(artifact.ownerStepId)
    assert.ok(
      owner.outputs.includes(artifact.id),
      `${artifact.id} owner output`
    )
    artifact.consumerStepIds.forEach((id) =>
      assert.ok(
        step(id).inputs.includes(artifact.id),
        `${artifact.id} consumer ${id}`
      )
    )
    if (!artifact.terminal)
      assert.ok(
        artifact.consumerStepIds.length > 0,
        `${artifact.id} consumer required`
      )
  })
})

test('each package validator owns an explicit terminal failure route and artifact', () => {
  ;[
    ['validate-props-data', 'artifact:props-validation-failure'],
    ['validate-scene-data', 'artifact:scene-validation-failure'],
    ['validate-system-data', 'artifact:system-validation-failure']
  ].forEach(([stepId, artifactId]) => {
    const owner = step(stepId)
    assert.ok(owner.outputs.includes(artifactId), `${stepId} failure output`)

    const failureRoute = data.routes.find(
      (route) =>
        route.from === stepId &&
        route.kind === 'terminal' &&
        route.producedArtifacts.includes(artifactId)
    )
    assert.ok(failureRoute, `${stepId} terminal failure route`)
    assert.equal(failureRoute.to, undefined)
    assert.match(failureRoute.predicate, /validator throws/i)

    const artifact = data.artifacts.find((item) => item.id === artifactId)
    assert.ok(artifact, `${artifactId} resolves`)
    assert.equal(artifact.ownerStepId, stepId)
    assert.equal(artifact.terminal, true)
    assert.deepEqual(artifact.consumerStepIds, [])
  })
})

test('package validators share only the domain-neutral diagnostic contract', () => {
  ;[
    'validate-props-data',
    'validate-scene-data',
    'validate-system-data'
  ].forEach((stepId) => {
    assert.ok(
      step(stepId).implementationBoundary.includes(
        'packages/utils/src/types/load-diagnostic.ts'
      ),
      `${stepId} must consume the shared diagnostic contract`
    )
  })
})

test('viewer preserves frozen data and exposes steps, routes, and artifacts', () => {
  const viewer = fs.readFileSync(
    path.resolve(__dirname, '../app-level-migration-flow-inspector.html'),
    'utf8'
  )

  assert.match(viewer, /\[\.\.\.data\.lanes\]\s*\.sort/)
  assert.match(viewer, /data\.steps/)
  assert.match(viewer, /data\.routes/)
  assert.match(viewer, /data\.artifacts/)
  assert.match(viewer, />Routes</)
  assert.match(viewer, />Artifacts</)
})

test('raw direct and provider loads share one pre-validation migration route', () => {
  const inputStep = step('receive-raw-document')
  const input = contractText(inputStep)
  const migrationStep = step('orchestrate-load-hooks')
  const migration = contractText(migrationStep)
  assert.match(input, /direct core\.load.*persistence-provider/i)
  assert.match(
    input,
    /raw document.*first load hook before Core normalization/i
  )
  assert.match(input, /provider results remain unknown raw input/i)
  assert.match(migration, /first hook receives unknown raw input/i)
  assert.match(migration, /VersionedLoadDocument/i)
  assert.match(migration, /package fields remain.*package validation/i)
  assert.match(migration, /registration order/i)
  assert.match(migration, /Promise result.*unsupported asynchronous/i)
  assert.match(migration, /contains an eventual Promise rejection/i)
  assert.match(migration, /empty chain.*no app semantic transform/i)
  assert.match(migration, /isolated per Core instance/i)
  assert.match(migration, /snapshot.*start of each load/i)
  assert.match(migration, /registered during a hook.*next load/i)
  assert.match(input, /non-nullish direct/i)
  assert.match(input, /non-nullish direct.*non-nullish provider/i)
  assert.match(input, /direct.*null.*undefined.*no migration/i)
  assert.match(input, /provider.*null.*undefined.*no migration/i)
  const providerInput = data.routes.find(
    (route) => route.id === 'provider-load-input'
  )
  const directNoDocument = data.routes.find(
    (route) => route.id === 'direct-no-document'
  )
  const providerNoDocument = data.routes.find(
    (route) => route.id === 'provider-no-document'
  )
  assert.ok(directNoDocument)
  assert.ok(providerNoDocument)
  assert.ok(providerInput)
  assert.match(providerInput.predicate, /non-nullish/i)
  assert.match(providerNoDocument.predicate, /null or undefined/i)
  assert.equal(directNoDocument.kind, 'terminal')
  assert.equal(providerNoDocument.kind, 'terminal')
  assert.deepEqual(directNoDocument.producedArtifacts, [
    'artifact:no-document'
  ])
  assert.deepEqual(providerNoDocument.producedArtifacts, [
    'artifact:no-document'
  ])
  assert.ok(
    inputStep.implementationBoundary.includes(
      'docs/ai/framework/API_SURFACES.md'
    )
  )
  assert.ok(
    migrationStep.implementationBoundary.includes(
      'packages/core/src/types/index.ts'
    )
  )
})

test('app owns one connected registry and conditional version dispatch', () => {
  const ownerStep = step('own-versioned-migrations')
  const owner = contractText(ownerStep)
  assert.match(owner, /one connected linear chain.*one head and one tail/i)
  assert.match(owner, /Version ids are opaque.*non-contiguous/i)
  assert.match(owner, /Duplicate source or target.*cycle fails registration/i)
  assert.match(owner, /looks up only the current version/i)
  assert.match(owner, /loop inside the dispatcher.*never re-enters core\.load/i)
  assert.match(owner, /dense array.*every slot/i)
  assert.match(owner, /at most one non-empty migration batch per Core instance/i)
  assert.match(owner, /second non-empty registration fails.*another hook/i)
  assert.match(owner, /empty batch.*no-op.*does not claim/i)
  assert.match(owner, /app-owned per-Core WeakSet installation guard/i)
  assert.match(owner, /Core-owned app migration installation registry/i)
  assert.match(owner, /transform returns synchronously.*non-array document/i)
  assert.match(owner, /Promise.*app-owned asynchronous-result failure/i)
  assert.match(owner, /eventual rejection is contained/i)
  assert.match(owner, /invalid-step-result failure.*initial missing-version/i)
  assert.match(owner, /no matching transition.*normal terminal pass-through/i)
  assert.match(owner, /Transitions before.*current version are not invoked/i)
  assert.match(owner, /package-internal app version branches/i)
  assert.match(owner, /automatic Core schema-history inference/i)
  assert.match(owner, /fixed-queue invocation.*non-matching/i)

  const registrationRoute = data.routes.find(
    (route) => route.id === 'register-app-migrations'
  )
  assert.ok(registrationRoute)
  assert.match(registrationRoute.predicate, /non-empty.*connected linear/i)
  assert.deepEqual(registrationRoute.producedArtifacts, [
    'artifact:registered-migration-dispatcher'
  ])

  const emptyBatchRoute = data.routes.find(
    (route) => route.id === 'empty-app-migration-batch'
  )
  assert.ok(emptyBatchRoute)
  assert.equal(emptyBatchRoute.to, 'orchestrate-load-hooks')
  assert.match(emptyBatchRoute.predicate, /empty batch.*no dispatcher/i)
  assert.deepEqual(emptyBatchRoute.producedArtifacts, [
    'artifact:empty-migration-batch'
  ])
  assert.ok(
    step('orchestrate-load-hooks').inputs.includes(
      'artifact:empty-migration-batch'
    )
  )

  const registrationFailure = data.routes.find(
    (route) => route.id === 'migration-registration-failure'
  )
  assert.ok(registrationFailure)
  assert.equal(registrationFailure.kind, 'terminal')
  assert.match(
    registrationFailure.predicate,
    /disconnected component.*cycle.*second non-empty registration/i
  )
  assert.deepEqual(registrationFailure.producedArtifacts, [
    'artifact:migration-registration-failure'
  ])

  const executionFailure = data.routes.find(
    (route) => route.id === 'app-migration-execution-failure'
  )
  assert.ok(executionFailure)
  assert.equal(executionFailure.kind, 'terminal')
  assert.match(
    executionFailure.predicate,
    /missing-version eligibility.*transform throws.*invalid.*asynchronous/i
  )
  assert.deepEqual(executionFailure.producedArtifacts, [
    'artifact:app-migration-execution-failure'
  ])
  const executionFailureArtifact = data.artifacts.find(
    (artifact) =>
      artifact.id === 'artifact:app-migration-execution-failure'
  )
  assert.ok(executionFailureArtifact)
  assert.equal(executionFailureArtifact.ownerStepId, 'own-versioned-migrations')
  assert.equal(executionFailureArtifact.terminal, true)

  const additionalHooks = step('own-additional-load-hooks')
  const additionalHookContract = contractText(additionalHooks)
  assert.match(additionalHookContract, /optional non-migration app load hooks/i)
  assert.match(additionalHookContract, /throw.*same error instance/i)
  assert.match(additionalHookContract, /not migration authority/i)
  ;[
    'artifact:registered-additional-load-hooks',
    'artifact:no-additional-load-hooks'
  ].forEach((artifactId) => {
    assert.ok(step('orchestrate-load-hooks').inputs.includes(artifactId))
  })

  const additionalHookFailure = data.routes.find(
    (route) => route.id === 'additional-app-load-hook-throw'
  )
  assert.ok(additionalHookFailure)
  assert.equal(additionalHookFailure.kind, 'terminal')
  assert.match(additionalHookFailure.predicate, /synchronous throw.*unchanged/i)
  assert.deepEqual(additionalHookFailure.producedArtifacts, [
    'artifact:app-load-hook-throw'
  ])
  const additionalHookFailureArtifact = data.artifacts.find(
    (artifact) => artifact.id === 'artifact:app-load-hook-throw'
  )
  assert.ok(additionalHookFailureArtifact)
  assert.equal(
    additionalHookFailureArtifact.ownerStepId,
    'own-additional-load-hooks'
  )
  assert.equal(additionalHookFailureArtifact.terminal, true)

  const coreFailureRoute = data.routes.find(
    (route) => route.id === 'migration-failure-terminal'
  )
  assert.ok(coreFailureRoute)
  assert.match(coreFailureRoute.predicate, /crossing the Core boundary/i)
  assert.doesNotMatch(coreFailureRoute.predicate, /transform/i)
  assert.ok(
    ownerStep.implementationBoundary.includes(
      'packages/core/src/__tests__/load-validation.test.ts'
    )
  )

  const migrationRule = fs.readFileSync(
    path.resolve(
      repoRoot,
      'docs/ai/framework/rules/load-validation-and-migration.md'
    ),
    'utf8'
  )
  assert.match(migrationRule, /one connected linear chain/i)
  assert.match(migrationRule, /no matching transition.*terminates migration/is)
  assert.match(migrationRule, /Promise.*app-owned asynchronous-result failure/is)
  assert.match(migrationRule, /eventual\s+rejection is contained/i)
  assert.match(migrationRule, /invalid-step-result failure/i)
  assert.doesNotMatch(migrationRule, /unsupported versions are app-policy failures/i)

  ;[
    'docs/ai/framework/API_SURFACES.md',
    'docs/ai/framework/ARCHITECTURE.md',
    'docs/ai/framework/CONSTRAINTS.md',
    'docs/ai/framework/packages/core.md',
    'packages/core/README.md'
  ].forEach((relativePath) => {
    const crossDocumentContract = fs.readFileSync(
      path.resolve(repoRoot, relativePath),
      'utf8'
    )
    assert.match(
      crossDocumentContract,
      /connected (?:linear )?(?:migration |transition )?(?:chain|batch|registry)/i,
      relativePath
    )
    assert.match(
      crossDocumentContract,
      /(?:unmatched|no matching).*version.*(?:pass|continue)/is,
      relativePath
    )
  })
})

test('all package validators finish before canonical apply', () => {
  const apply = step('apply-canonical-state')
  assert.deepEqual(apply.inputs, [
    'artifact:migrated-document',
    'artifact:validated-props',
    'artifact:validated-scene',
    'artifact:validated-system'
  ])
  assert.match(contractText(apply), /only after every validator succeeds/i)
  assert.match(
    contractText(apply),
    /Migration or validator failure bypasses every apply call/i
  )
})

test('validated package artifacts are owner-issued, instance-bound, and one-shot', () => {
  ;[
    ['validate-props-data', 'artifact:validated-props'],
    ['validate-scene-data', 'artifact:validated-scene'],
    ['validate-system-data', 'artifact:validated-system']
  ].forEach(([stepId, artifactId]) => {
    const ownerContract = contractText(step(stepId))
    assert.match(ownerContract, /owner-issued/i)
    assert.match(ownerContract, /instance-bound/i)
    assert.match(ownerContract, /one-shot/i)
    assert.match(ownerContract, /fabricated.*foreign.*reused/i)

    const artifact = data.artifacts.find((item) => item.id === artifactId)
    assert.ok(artifact, `${artifactId} resolves`)
    assert.match(artifact.channel, /owner-issued.*instance-bound/i)
  })

  const apply = contractText(step('apply-canonical-state'))
  assert.match(apply, /complete owner-issued artifacts/i)
  assert.match(apply, /does not rerun package validators/i)
  assert.match(apply, /plain.*records/i)
})

test('diagnostics are detached observational output only', () => {
  const diagnostics = contractText(step('observe-load-diagnostics'))
  assert.match(
    diagnostics,
    /detached diagnostics.*detached post-apply load evidence/i
  )
  assert.match(diagnostics, /applied managed-system serialization/i)
  assert.match(
    diagnostics,
    /evidence.*not.*canonical state artifact.*state owner/i
  )
  assert.match(
    diagnostics,
    /evidence.*assembled only when diagnostics and an observer exist/i
  )
  assert.match(diagnostics, /evidence assembly failure.*contained/i)
  assert.doesNotMatch(diagnostics, /detached applied snapshot/i)
  assert.match(diagnostics, /Thrown hooks are contained independently/i)
  assert.match(diagnostics, /canonical package state references/i)
  assert.match(diagnostics, /diagnostics-based canonical state repair/i)
  const applyContext = data.artifacts.find(
    (artifact) => artifact.id === 'artifact:successful-apply-context'
  )
  assert.ok(applyContext)
  assert.match(applyContext.title, /post-apply diagnostics assembly context/i)

  const apiSurfaces = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/framework/API_SURFACES.md'),
    'utf8'
  )
  assert.match(apiSurfaces, /detached post-apply\s+load evidence/i)
  assert.match(apiSurfaces, /applied managed-system serialization/i)
  assert.match(
    apiSurfaces,
    /not a\s+canonical state artifact or state owner/i
  )
  assert.doesNotMatch(apiSurfaces, /applied-data snapshot/i)

  const publicTypeSurface = fs.readFileSync(
    path.resolve(
      repoRoot,
      'packages/core/src/types/load-validation.ts'
    ),
    'utf8'
  )
  assert.match(publicTypeSurface, /applied managed-system serialization/i)
  assert.match(
    publicTypeSurface,
    /not a canonical state artifact or state owner/i
  )
})

test('product contract names every required migration case and bounded DoD', () => {
  const spec = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  ;[
    /empty hook chain/i,
    /missing[- ]version/i,
    /no matching transition.*terminal/i,
    /non-contiguous `v1 -> v3 -> v8`/i,
    /disconnected.*cycle/i,
    /thrown transform/i,
    /invalid or asynchronous transform results/i,
    /direct.*provider/i,
    /validation failure/i,
    /Diagnostics receive detached/i,
    /instance[- ]local/i
  ].forEach((pattern) => assert.match(spec, pattern))
  assert.match(spec, /Release-Gate Definition of Done/)
})

test('Golden Path names only the canonical state carried by the load envelope', () => {
  const goldenPath = fs.readFileSync(
    path.resolve(
      repoRoot,
      'docs/ai/framework/golden-paths/load-save-migration.md'
    ),
    'utf8'
  )

  assert.doesNotMatch(goldenPath, /load .*selection state/i)
  assert.match(
    goldenPath,
    /apply.*version.*scene-tree.*props.*system context/is
  )
  assert.match(
    goldenPath,
    /apply migrated\/validated state.*observe optional load diagnostics.*save in latest schema/is
  )
  assert.match(goldenPath, /applied managed-system serialization/i)
  assert.match(
    goldenPath,
    /not a canonical state artifact\s+or state owner/i
  )
  assert.match(
    goldenPath,
    /diagnostics.*mutation.*throw.*assembly failure.*successful load/is
  )
  assert.match(goldenPath, /complete batch.*one connected linear chain/is)
  assert.match(goldenPath, /stop normally when no transition matches/i)
  assert.match(goldenPath, /fixed queue instead of conditional lookup/i)
  assert.doesNotMatch(goldenPath, /reject missing\/unsupported app versions/i)
})
