const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./preset-composition-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')
const spec = fs.readFileSync(
  path.resolve(repoRoot, data.authority.specPath),
  'utf8'
)

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

test('active plan and direct-open Inspector are the resolvable authorities', () => {
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/preset-composition-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/preset-composition-flow-inspector.html'
      )
    )
  )
  data.links.forEach((link) => {
    assert.ok(fs.existsSync(path.resolve(__dirname, link.href)))
  })
})

test('product authority stops preset composition before app customization and Core start', () => {
  assert.match(
    spec,
    /shared preset defaults[\s\S]*concrete-engine bootstrap[\s\S]*optional capability bundles[\s\S]*completed composition result/i
  )
  assert.match(
    spec,
    /applyPreset\(core, composition\?\)[\s\S]*app remove\/define\/unregister\/register[\s\S]*app register migration[\s\S]*core\.start\(\)/i
  )
  assert.match(spec, /Preset never executes app customization/i)
  assert.match(
    spec,
    /Preset success means startup composition completed, not runtime-ready/i
  )
  assert.doesNotMatch(
    spec,
    /optional capability bundles\s*->\s*app customizations/i
  )
})

test('public typed contract names engine, bundle, result, and cleanup ownership explicitly', () => {
  const publicContract = spec.slice(
    spec.indexOf('## Public Typed Contract'),
    spec.indexOf('## Ownership and Composition Layers')
  )

  assert.match(publicContract, /interface PresetEngineBootstrap/)
  assert.match(publicContract, /id: string/)
  assert.match(publicContract, /factory\?: RenderEngineFactory/)
  assert.match(publicContract, /interface PresetCapabilityBundle/)
  assert.match(publicContract, /owner: RegistrationOwnerMetadata/)
  assert.match(publicContract, /requires: readonly string\[\]/)
  assert.match(publicContract, /outputs: readonly string\[\]/)
  assert.match(publicContract, /dispose\(\): void/)
  assert.match(publicContract, /interface PresetCompositionSuccess/)
  assert.match(publicContract, /state: 'completed'/)
  assert.match(publicContract, /readonly result: PresetCompositionSuccess/)
  assert.doesNotMatch(
    publicContract,
    /PresetExtension|extensions:|extension target|replace strategy/i
  )
})

test('structured composition errors cover every required stable failure class', () => {
  ;[
    'INVALID_COMPOSITION',
    'DUPLICATE_TARGET',
    'UNKNOWN_ENGINE_BOOTSTRAP',
    'MISSING_CAPABILITY_BUNDLE',
    'ORDERING_CONFLICT',
    'LAYER_INSTALL_FAILED',
    'CLEANUP_FAILED'
  ].forEach((code) => assert.match(spec, new RegExp(`\\b${code}\\b`)))

  assert.match(spec, /failed layer/i)
  assert.match(spec, /pending cleanup keys/i)
  assert.match(spec, /never publishes `PresetCompositionSuccess`/i)
})

test('preset validates complete engine and bundle selection before mutation', () => {
  const owner = step('resolve-preset-composition')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /before any composition mutation/i)
  assert.match(contract, /stable.*Pixi bootstrap identity/i)
  assert.match(contract, /legacy renderEngineFactory/i)
  assert.match(contract, /legacy and new engine inputs together/i)
  assert.match(contract, /duplicate targets fail before mutation/i)
  assert.match(contract, /missing dependency.*ordering conflict/i)
  assert.match(contract, /no-op bundle definitions fail before installation/i)
  assert.deepEqual(owner.cacheDimensions, [])
})

test('shared defaults apply exactly once without copying registry conflict semantics', () => {
  const owner = step('install-shared-preset-defaults')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /exactly once/i)
  assert.match(contract, /stable.*order/i)
  assert.match(contract, /ordinary Core duplicate\/conflict semantics/i)
  assert.match(contract, /compatibility path.*same observable defaults/i)
  assert.match(contract, /No shared group.*engine identity.*product mode/i)
})

test('Render owns reversible instance-local provider acceptance without concrete imports', () => {
  const owner = step('accept-concrete-engine-provider')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/render')
  assert.match(contract, /reversible pre-runtime provider cleanup/i)
  assert.match(contract, /does not construct an engine/i)
  assert.match(contract, /restore.*prior.*provider.*clear.*no prior provider/i)
  assert.match(contract, /stale cleanup handle cannot erase a later provider/i)
  assert.match(contract, /Each Render instance.*independently/i)
  assert.match(
    contract,
    /preset caller boundary maps provider rejection to structured composition failure/i
  )
  assert.ok(
    owner.implementationBoundary.includes('packages/preset/src/preset.ts')
  )
  assert.ok(
    owner.implementationBoundary.includes('packages/preset/src/__tests__/**')
  )
  assert.match(
    contract,
    /@asyra\/render-engine-pixi imports in @asyra\/render/i
  )
})

test('preset coordinates explicit bundle order while packages own outputs and cleanup', () => {
  const owner = step('install-capability-bundles')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /caller-declared order is preserved/i)
  assert.match(contract, /no inferred topological reorder/i)
  assert.match(contract, /explicit outputs.*package-owned disposer/i)
  assert.match(contract, /never treats outputs as registry authority/i)
  assert.match(contract, /empty.*without a no-op bundle/i)
  assert.match(contract, /bundle inferred from engine capabilities/i)
})

test('success publication is instance-local and cannot declare Core ready or product mode', () => {
  const owner = step('publish-composition-result')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /only after every selected layer has completed/i)
  assert.match(contract, /detached from caller-owned mutable inputs/i)
  assert.match(contract, /local to the supplied Core\/application lifetime/i)
  assert.match(contract, /does not mean Core runtime-ready/i)
  assert.match(contract, /No success object.*failure/i)
  assert.match(contract, /2D, 3D, Hybrid, or app-domain mode fields/i)
})

test('cleanup reverses only acquired resources and preserves deterministic retry state', () => {
  const owner = step('dispose-preset-composition')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /exact reverse installation order/i)
  assert.match(contract, /Completed cleanup handles are not invoked again/i)
  assert.match(contract, /CLEANUP_FAILED/i)
  assert.match(
    contract,
    /next apply.*same Core.*retries pending rollback cleanup/i
  )
  assert.match(
    contract,
    /observer.*handler.*subscription.*layer.*registration.*provider.*engine resource/i
  )
  assert.equal(route('bundle-failure-cleanup').to, 'dispose-preset-composition')
})

test('app customization and Core runtime start remain independent owner steps', () => {
  const app = contractText(step('apply-app-customization'))
  const core = contractText(step('close-and-start-core-runtime'))

  assert.match(app, /remove old relation then define new relation/i)
  assert.match(
    app,
    /unregister owner registration then ordinary define\/register/i
  )
  assert.match(app, /after preset composition has completed/i)
  assert.match(app, /preset executing app operations/i)

  assert.match(core, /permanently.*method entry/i)
  assert.match(core, /before renderer side effects/i)
  assert.match(core, /before observers, load, features, and ready publication/i)
  assert.match(core, /preset publishing runtime-ready/i)
})

test('Inspector names bounded product cases and definition of done', () => {
  const caseIds = new Set(data.productCases.map((item) => item.id))
  const dodIds = new Set(data.definitionOfDone.map((item) => item.id))

  ;[
    'omitted-default-compatibility',
    'explicit-default-equivalence',
    'shared-defaults-exactly-once',
    'bundle-order',
    'post-return-app-customization',
    'no-app-extension-surface',
    'duplicate-target',
    'unknown-engine',
    'missing-bundle',
    'ordering-conflict',
    'partial-failure-cleanup',
    'cleanup-retry',
    'instance-isolation',
    'core-start-ownership',
    'render-mode-non-goal',
    'asyra-design-compatibility'
  ].forEach((id) => assert.ok(caseIds.has(id), `Missing product case: ${id}`))
  ;[
    'public-contract',
    'deterministic-order',
    'compatibility',
    'failure-cleanup',
    'instance-isolation',
    'ownership-boundaries',
    'non-goals',
    'full-validation',
    'independent-review'
  ].forEach((id) => assert.ok(dodIds.has(id), `Missing DoD item: ${id}`))
})

test('public flow exposes no render-mode profile or preset app-extension artifact', () => {
  const publicIdentifiers = [
    ...data.steps.flatMap((item) => [item.id, ...item.outputs]),
    ...data.routes.flatMap((item) => [item.id, ...item.producedArtifacts]),
    ...data.artifacts.map((item) => item.id)
  ].join(' ')

  assert.doesNotMatch(
    publicIdentifiers,
    /(^|[-:])(2d|3d|hybrid|profile|preset-extension|extension-target)([-:]|$)/i
  )

  const forbidden = data.steps
    .flatMap((item) => item.forbiddenContributors)
    .join(' ')
  assert.match(forbidden, /2D, 3D, Hybrid/i)
  assert.match(forbidden, /preset-specific app extension/i)
  assert.match(forbidden, /public\/shared replace semantics/i)
})

test('every owner step is exact and all routes and artifacts resolve', () => {
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  data.steps.forEach((item) => {
    assert.ok(laneIds.has(item.laneId), `Unknown lane: ${item.id}`)
    assert.ok(item.ownerPackage, `Missing owner: ${item.id}`)
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) => {
      assert.ok(item[field].length > 0, `Missing ${field}: ${item.id}`)
    })
    assert.ok(
      stepIds.has(item.failureOwnerStepId),
      `Unknown failure owner: ${item.id}`
    )
    assert.ok(
      stepIds.has(item.cleanupOwnerStepId),
      `Unknown cleanup owner: ${item.id}`
    )
  })

  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.from}`)
    if (item.to) {
      assert.ok(stepIds.has(item.to), `Unknown route destination: ${item.to}`)
    }
    assert.ok(item.predicate, `Missing route predicate: ${item.id}`)
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
