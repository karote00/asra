const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./extendable-preset-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')

const assertImplementationBoundary = (owner, implementationFile, label) => {
  assert.ok(
    owner.implementationBoundary.includes(implementationFile),
    `Missing ${label} boundary: ${implementationFile}`
  )
  const concretePath = implementationFile.endsWith('/**')
    ? implementationFile.slice(0, -3)
    : implementationFile
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, concretePath)),
    `${label} boundary does not resolve: ${implementationFile}`
  )
}

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const route = (id) => {
  const value = data.routes.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector route: ${id}`)
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

test('completed extendable-preset plan remains the resolvable product authority', () => {
  const formerActiveSpecPath =
    'docs/ai/framework/plans/extendable-preset-plan.md'
  const productContract = data.links.find(
    (link) => link.id === 'product-contract'
  )

  assert.ok(productContract, 'Missing product-contract Inspector link')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/extendable-preset-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(__dirname, productContract.href)))
  assert.equal(
    fs.existsSync(path.resolve(repoRoot, formerActiveSpecPath)),
    false
  )
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/extendable-preset-flow-inspector.html'
      )
    )
  )
})

test('app startup owns only ordinary public composition and migration choice', () => {
  const owner = step('compose-app-startup')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, 'app or user composition')
  assert.match(contract, /applyPreset\(core\)/)
  assert.match(contract, /core\.defineFeature/i)
  assert.match(contract, /remove.*define.*register.*unregister/i)
  assert.match(contract, /migration/i)
  assert.match(contract, /public/i)
  assert.match(contract, /preset-specific app extension objects/i)
})

test('shared primitive owns adjacency, deterministic traversal, and structured contract', () => {
  const owner = step('maintain-registration-graph')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/utils')
  assert.match(contract, /nodesByRef/i)
  assert.match(contract, /outgoingRelationsBySource/i)
  assert.match(contract, /incomingRelationsByTarget/i)
  assert.match(contract, /sorted/i)
  assert.match(contract, /queue/i)
  assert.match(contract, /visited set/i)
  assert.match(contract, /RegistrationRelationError/i)
  assert.match(contract, /retryable/i)
  assert.match(contract, /pending source.*pending target.*before mutation/i)
  assert.match(
    contract,
    /retry.*current adjacency.*same name.*different target.*preserved/i
  )
  assert.match(contract, /before, after, and append/i)
  assert.doesNotMatch(
    contract,
    /replace strategy|explicit replace|replace conflict/i
  )
  assert.deepEqual(owner.cacheDimensions, [])
})

test('component owner preserves registrations while mutating exact property slots', () => {
  const owner = step('mutate-component-property-relations')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/scene-tree')
  assert.match(contract, /automatic detach relation/i)
  assert.match(contract, /complete next definition\/class/i)
  assert.match(contract, /pending source or target cleanup.*before mutation/i)
  assert.match(contract, /Component-local maps/i)
  assert.match(contract, /active instance/i)
  assert.match(contract, /never unregisters either registration node/i)
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/core/src/define-component.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/props-manager/src/registries/property-definition.ts'
    )
  )
  ;[
    'packages/scene-tree/src/components/**',
    'packages/scene-tree/src/component-registry.ts',
    'packages/scene-tree/src/create-dynamic-component.ts',
    'packages/scene-tree/src/create-dynamic-props.ts'
  ].forEach((implementationFile) => {
    assertImplementationBoundary(
      owner,
      implementationFile,
      'component relation'
    )
  })
  ;[
    'packages/scene-tree/src/component/**',
    'packages/scene-tree/src/element/**',
    'packages/scene-tree/src/registries/**'
  ].forEach((retiredImplementationFile) => {
    assert.equal(
      owner.implementationBoundary.includes(retiredImplementationFile),
      false,
      `Retired component relation boundary must be removed: ${retiredImplementationFile}`
    )
  })
})

test('property owner rebuilds child relations without unknown CUSTOM fallback', () => {
  const owner = step('mutate-property-child-relations')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/props-manager')
  assert.match(contract, /retains its declarative definition/i)
  assert.match(contract, /childType.*detach relation/i)
  assert.match(contract, /pending source or target cleanup/i)
  assert.match(contract, /no stale subscription/i)
  assert.match(contract, /replay-retained/i)
  assert.match(contract, /CUSTOM/i)
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/core/src/define-property-component.ts'
    )
  )
  ;[
    'packages/props-manager/src/components/**',
    'packages/props-manager/src/index.ts'
  ].forEach((implementationFile) => {
    assertImplementationBoundary(
      owner,
      implementationFile,
      'property child relation'
    )
  })
  assert.equal(
    owner.implementationBoundary.includes(
      'packages/props-manager/src/types/**'
    ),
    false,
    'Retired property child relation types directory must be removed'
  )
})

test('Core closes composition permanently before renderer effects', () => {
  const owner = step('coordinate-composition-state')
  const contract = contractText(owner)
  const closeRoute = route('close-before-start-effects')

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /permanently at method entry/i)
  assert.match(contract, /renderer initialization later fails/i)
  assert.match(contract, /before renderer side effects/i)
  assert.match(contract, /public facade/i)
  assert.match(contract, /injected Factory.*shared channels.*observers/i)
  assert.match(contract, /same observer name.*different Core/i)
  assert.match(
    contract,
    /default Core.*standalone observer helpers.*share.*default observer registry/i
  )
  assert.match(closeRoute.predicate, /before renderer effects/i)
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/core/src/data-channel-observer.ts'
    )
  )
})

test('graph-aware unregister detaches structural sources and recursively cleans hard sources', () => {
  const owner = step('unregister-registration-capability')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /Structural detach preserves component/i)
  assert.match(contract, /Only unregister-source dependents.*recursively/i)
  assert.match(contract, /replay-retained/i)
  assert.match(contract, /cannot clean.*twice/i)
  assert.match(contract, /retryable/i)
  assert.equal(
    route('detach-component-source').to,
    'mutate-component-property-relations'
  )
  assert.equal(
    route('cleanup-hard-dependent').to,
    'own-opaque-registration-lifecycle'
  )
})

test('preset owns explicit default installation and graph-backed failed-apply cleanup', () => {
  const owner = step('install-preset-defaults')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(
    contract,
    /Importing preset modules does not register components/i
  )
  assert.match(
    contract,
    /applyPreset\(core\).*explicit deterministic installation/i
  )
  assert.match(contract, /@asyra\/preset\/default-preset/i)
  assert.match(contract, /same canonical graph/i)
  assert.match(contract, /not cleaned a second time/i)
  assert.match(
    contract,
    /events.*selections.*subscriptions.*observers.*layers/i
  )
  assert.match(contract, /retry.*pending.*completed.*not.*run again/i)
  assert.match(contract, /graph preflight.*before accepted preset mutation/i)
  assert.match(contract, /supplied Core.*shared channels.*observers/i)
  assert.match(contract, /next apply.*retry.*pending rollback cleanup/i)
  assert.match(contract, /preset-specific feature-registration target/i)
  assert.ok(owner.implementationBoundary.includes('packages/core/src/core.ts'))
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/utils/src/registry/registration-graph.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'docs/ai/framework/decisions/releases/unreleased.md'
    )
  )
  ;[
    'packages/preset/src/catalog.ts',
    'packages/preset/src/cleanup-reporter.ts',
    'packages/preset/src/composition/**',
    'packages/preset/src/constants.ts',
    'packages/preset/src/defaults/**',
    'packages/preset/src/registration.ts',
    'packages/preset/src/system-property-keys.ts',
    'packages/preset/src/ui/**',
    'packages/preset/src/vector/**'
  ].forEach((implementationFile) => {
    assertImplementationBoundary(
      owner,
      implementationFile,
      'preset installation'
    )
  })
  ;[
    'packages/preset/src/render-strategies/**',
    'packages/preset/src/ui-properties/**'
  ].forEach((retiredImplementationFile) => {
    assert.equal(
      owner.implementationBoundary.includes(retiredImplementationFile),
      false,
      `Retired preset installation boundary must be removed: ${retiredImplementationFile}`
    )
  })
})

test('public docs describe relation composition without the retired preset extension surface', () => {
  const docPaths = [
    'docs/ai/framework/API_SURFACES.md',
    'docs/ai/framework/packages/core.md',
    'docs/ai/framework/packages/preset.md',
    'docs/ai/framework/golden-paths/extend-preset-capability.md',
    'docs/ai/apps/asyra-design/ARCHITECTURE.md',
    'docs/ai/apps/asyra-design/modules/init-and-startup.md'
  ]
  const docs = docPaths
    .map((docPath) => fs.readFileSync(path.resolve(repoRoot, docPath), 'utf8'))
    .join('\n')

  assert.match(docs, /removeComponentPropertyRelation/)
  assert.match(docs, /defineComponentPropertyRelation/)
  assert.match(docs, /unregisterPropertyType/)
  assert.match(docs, /unregister.*define/i)
  assert.doesNotMatch(
    docs,
    /PRESET_EXTENSION_TARGETS|PresetExtension|unregisterTarget\(/
  )
})

test('opaque owners keep declarations local and dispose all owned runtime resources', () => {
  const owner = step('own-opaque-registration-lifecycle')
  const contract = contractText(owner)

  assert.match(owner.ownerPackage, /feature-system.*render.*ui-context/i)
  assert.match(contract, /registration\.relations/i)
  assert.match(contract, /queued and pending handlers/i)
  assert.match(contract, /managed source subscription/i)
  assert.match(contract, /unregister-source/i)
  assert.match(
    contract,
    /inline component render strategy.*render-strategy node.*unregister-source/i
  )
  assert.match(contract, /separately registered render strategy.*independent/i)
  assert.match(contract, /no declared relation is not analyzed/i)
  assert.ok(owner.implementationBoundary.includes('packages/core/src/core.ts'))
})

test('migration remains app-provided and precedes validation without CUSTOM fallback', () => {
  const owner = step('migrate-validate-load')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /migrate.*before.*validation/i)
  assert.match(contract, /diagnostic.*skipped.*CUSTOM/i)
  assert.match(contract, /never performs or invents a data migration/i)
  ;[
    'packages/core/src/types/load-migration.ts',
    'packages/core/src/types/load-validation.ts'
  ].forEach((implementationFile) => {
    assertImplementationBoundary(
      owner,
      implementationFile,
      'migration/load validation'
    )
  })
  assert.equal(
    owner.implementationBoundary.includes('packages/core/src/load-hooks.ts'),
    false,
    'Retired Core load-hooks boundary must be removed'
  )
})

test('Inspector names bounded product cases and definition of done', () => {
  const caseIds = data.productCases.map((item) => item.id)
  const dodIds = data.definitionOfDone.map((item) => item.id)

  ;[
    'direct-feature-definition',
    'explicit-preset-installation',
    'component-relation-removal',
    'relation-definition',
    'property-capability-unregister',
    'recursive-policy',
    'property-child-rebuild',
    'structured-failures',
    'lifecycle-cleanup',
    'migration-before-validation',
    'startup-compatibility',
    'render-mode-non-inference'
  ].forEach((id) =>
    assert.ok(caseIds.includes(id), `Missing product case: ${id}`)
  )
  ;[
    'public-contracts',
    'deterministic-graph',
    'composition-closure',
    'cleanup',
    'migration-load',
    'package-boundaries',
    'full-validation',
    'independent-review'
  ].forEach((id) => assert.ok(dodIds.includes(id), `Missing DoD item: ${id}`))
})

test('scope excludes generic composition and render-mode products', () => {
  const publicIdentifiers = [
    ...data.steps.flatMap((item) => [item.id, ...item.outputs]),
    ...data.routes.map((item) => item.id),
    ...data.artifacts.map((item) => item.id)
  ].join(' ')
  const contract = [
    ...data.invariants,
    ...data.steps.flatMap((item) => item.forbiddenContributors)
  ].join(' ')

  assert.doesNotMatch(
    publicIdentifiers,
    /generic-preset-composition|3d|hybrid|render-mode/i
  )
  assert.match(contract, /Generic Preset Composition/i)
  assert.match(contract, /render-engine capability/i)
})

test('every step has exact execution fields and all routes/artifacts resolve', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  data.steps.forEach((item) => {
    assert.ok(item.ownerPackage, `Missing owner: ${item.id}`)
    assert.ok(item.inputs.length > 0, `Missing inputs: ${item.id}`)
    assert.ok(item.outputs.length > 0, `Missing outputs: ${item.id}`)
    assert.ok(item.conditions.length > 0, `Missing conditions: ${item.id}`)
    assert.ok(item.bypasses.length > 0, `Missing bypasses: ${item.id}`)
    assert.ok(
      item.allowedContributors.length > 0,
      `Missing allowed contributors: ${item.id}`
    )
    assert.ok(
      item.forbiddenContributors.length > 0,
      `Missing forbidden contributors: ${item.id}`
    )
    assert.ok(
      item.implementationBoundary.length > 0,
      `Missing implementation boundary: ${item.id}`
    )
    assert.ok(
      stepIds.has(item.failureOwnerStepId),
      `Unknown failure owner: ${item.id}`
    )
  })

  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.from}`)
    if (item.to) {
      assert.ok(stepIds.has(item.to), `Unknown route destination: ${item.to}`)
    }
    item.producedArtifacts.forEach((artifactId) => {
      assert.ok(
        artifactIds.has(artifactId),
        `Unknown route artifact: ${artifactId}`
      )
    })
  })

  data.artifacts.forEach((item) => {
    assert.ok(
      stepIds.has(item.ownerStepId),
      `Unknown artifact owner: ${item.id}`
    )
    item.consumerStepIds.forEach((consumerId) => {
      assert.ok(
        stepIds.has(consumerId),
        `Unknown artifact consumer: ${item.id} -> ${consumerId}`
      )
    })
  })
})
