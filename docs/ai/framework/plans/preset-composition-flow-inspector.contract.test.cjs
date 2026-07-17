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

test('public contract makes profile and defaults independent', () => {
  const publicContract = spec.slice(
    spec.indexOf('### Public identifiers and catalog'),
    spec.indexOf('### Application semantics')
  )

  ;['2D', '3D', 'HYBRID', 'CUSTOM'].forEach((id) =>
    assert.match(publicContract, new RegExp(`['\"]${id}['\"]`))
  )
  ;[
    'BASIC_SHAPES',
    'CONTAINERS',
    'VECTOR',
    'INPUT',
    'SELECTION',
    'VECTOR_EDITING',
    'VIEWPORT',
    'UI_CONTEXT'
  ].forEach((id) => assert.match(publicContract, new RegExp(`\\b${id}\\b`)))

  assert.match(publicContract, /interface ApplyPresetOptions/)
  assert.match(publicContract, /profile\?: PresetProfile/)
  assert.match(publicContract, /defaults\?: readonly PresetDefaultId\[\]/)
  assert.match(publicContract, /interface PresetApplyResult/)
  assert.match(publicContract, /presetEngineId: string \| null/)
  assert.match(publicContract, /selectedDefaults: readonly PresetDefaultId\[\]/)
  assert.match(publicContract, /appliedDefaults: readonly PresetDefaultId\[\]/)
  assert.match(publicContract, /profile entry never\s+lists or selects defaults/i)
  assert.match(publicContract, /not dynamic-import paths/i)
})

test('removed unreleased composition APIs are not compatibility contracts', () => {
  assert.match(
    spec,
    /removed `renderEngineFactory`[\s\S]*engine bootstrap[\s\S]*capability-bundle[\s\S]*dependency-overload[\s\S]*`PresetApplication`/i
  )
  assert.match(spec, /not compatibility contracts/i)

  const result = contractText(step('publish-preset-result'))
  const request = contractText(step('request-preset'))
  assert.match(request, /never supplies installers, callbacks, engine ids/i)
  assert.match(request, /capability bundle or arbitrary installer input/i)
  assert.match(result, /No public disposer, application handle/i)
  assert.match(result, /PresetApplication or public dispose method/i)
})

test('preset resolves all strict input before mutation', () => {
  const owner = step('resolve-preset-request')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /before mutation/i)
  assert.match(contract, /Profile and defaults are independent axes/i)
  assert.match(contract, /Omitted defaults select every available default/i)
  assert.match(contract, /canonicalized in catalog order/i)
  assert.match(contract, /public dependencies are expanded deterministically/i)
  assert.match(contract, /Unknown option keys/i)
  assert.match(contract, /duplicates, closed composition, duplicate apply/i)
  assert.match(contract, /3D and HYBRID are known unavailable profiles/i)
  assert.match(contract, /import no engine package/i)
  assert.match(contract, /profile-based default filtering/i)
  assert.match(contract, /dynamic import from a catalog engine id/i)
  assert.deepEqual(owner.cacheDimensions, [])
})

test('preset installs only the selected public default dependency closure', () => {
  const owner = step('install-preset-defaults')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /eight-module public dependency closure/i)
  assert.match(contract, /canonical order/i)
  assert.match(contract, /Private property, event, channel, projection, observer/i)
  assert.match(contract, /deduplicated/i)
  assert.match(contract, /Unselected public modules install no product-visible/i)
  assert.match(contract, /caller-provided installer or disposer/i)
  assert.match(contract, /app-domain FeatureSystem behavior/i)
})

test('profile provider policy is independent and uses Core only', () => {
  const owner = step('select-profile-provider')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /independently from installed defaults/i)
  assert.match(contract, /2D requests the statically imported Pixi provider/i)
  assert.match(contract, /CUSTOM requests no provider/i)
  assert.match(contract, /engine ids remain diagnostics/i)
  assert.match(contract, /CUSTOM bypasses provider binding without bypassing default installation/i)
  assert.match(contract, /custom app engine passed through preset/i)
  assert.match(contract, /profile-derived default selection/i)
})

test('Core accepts one provider without constructing an engine', () => {
  const owner = step('accept-core-provider')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /without constructing an engine/i)
  assert.match(contract, /zero-argument RenderEngine creator unrelated to @asyra\/factory/i)
  assert.match(contract, /duplicate or post-start provider fails/i)
  assert.match(contract, /exposes provider presence/i)
  assert.match(contract, /concrete engine construction/i)
  assert.match(contract, /@asyra\/factory runtime or types/i)
})

test('Render keeps direct provider initialization strict', () => {
  const storage = contractText(step('accept-render-provider'))
  const runtime = contractText(step('initialize-render-runtime'))

  assert.match(storage, /instance-locally/i)
  assert.match(storage, /without invoking it/i)
  assert.match(storage, /invoked only by Render initialization/i)
  assert.match(storage, /@asyra\/render-engine-pixi import/i)

  assert.match(runtime, /direct Render strict/i)
  assert.match(runtime, /stable missing-provider error/i)
  assert.match(runtime, /Only Core may treat the exact missing-provider outcome as headless/i)
  assert.match(runtime, /Provider callback, invalid engine, initialization, and capability failures/i)
  assert.match(runtime, /generic error swallowing/i)
})

test('result is detached, frozen, and is not a lifecycle handle', () => {
  const owner = step('publish-preset-result')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /deeply frozen result/i)
  assert.match(contract, /profile, presetEngineId, selectedDefaults, and appliedDefaults only/i)
  assert.match(contract, /detached and canonical/i)
  assert.match(contract, /No public disposer, application handle/i)
  assert.match(contract, /not Core runtime readiness/i)
})

test('Core owns default renderer, exact headless normalization, and teardown', () => {
  const owner = step('start-core-runtime')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /owns an engine-neutral RenderAdapter unless/i)
  assert.match(contract, /first start closes composition/i)
  assert.match(contract, /missing-provider outcome.*accepted as headless/i)
  assert.match(contract, /no canvas or input surface/i)
  assert.match(contract, /observers, load, features, and ready/i)
  assert.match(contract, /Provider callback, engine initialization, capability.*failures stop/i)
  assert.match(contract, /destroyRenderer delegates resource teardown/i)
  assert.match(contract, /never reopens composition/i)
  assert.match(contract, /Headless bypasses canvas append and input setup only/i)
})

test('cleanup is reverse, internal, and retryable', () => {
  const owner = step('rollback-preset-apply')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /exact reverse acquisition order/i)
  assert.match(contract, /Completed cleanup is never repeated/i)
  assert.match(contract, /pending cleanup retries before the next apply/i)
  assert.match(contract, /CLEANUP_FAILED/i)
  assert.match(contract, /public PresetApplication\.dispose/i)
  assert.equal(route('apply-failure-cleanup').to, 'rollback-preset-apply')
  assert.equal(route('provider-failure-cleanup').to, 'rollback-preset-apply')
})

test('Inspector names bounded product cases and definition of done', () => {
  const caseIds = new Set(data.productCases.map((item) => item.id))
  const dodIds = new Set(data.definitionOfDone.map((item) => item.id))

  ;[
    'omitted-options',
    'custom-all-defaults',
    'empty-defaults',
    'profile-default-independence',
    'dependency-expansion',
    'unavailable-profiles',
    'strict-validation',
    'partial-failure-cleanup',
    'cleanup-retry',
    'core-default-renderer',
    'headless-core-start',
    'strict-render-failure',
    'asyra-design-compatibility'
  ].forEach((id) => assert.ok(caseIds.has(id), `Missing product case: ${id}`))

  ;[
    'public-contract',
    'module-selection',
    'failure-cleanup',
    'core-render-ownership',
    'boundary-safety',
    'full-validation'
  ].forEach((id) => assert.ok(dodIds.has(id), `Missing DoD item: ${id}`))
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

  assert.ok(Object.isFrozen(data))
  assert.ok(Object.isFrozen(data.steps))
  assert.ok(Object.isFrozen(data.steps[0]))
})
