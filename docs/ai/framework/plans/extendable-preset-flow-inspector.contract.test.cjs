const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./extendable-preset-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')

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

test('active extendable-preset plan remains the resolvable product authority', () => {
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/extendable-preset-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/extendable-preset-flow-inspector.html'
      )
    )
  )
})

test('framework primitive owns deterministic target and extension resolution', () => {
  const owner = step('resolve-extension-contract')
  const contract = [
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.equal(owner.ownerPackage, '@asyra/utils')
  assert.match(contract, /stable target key/i)
  assert.match(contract, /owner metadata/i)
  assert.match(contract, /before.*default.*after.*append/i)
  assert.match(contract, /structured/i)
  assert.deepEqual(owner.cacheDimensions, [])
})

test('feature registration and cleanup remain owned by feature-system', () => {
  const owner = step('register-feature-capability')
  const contract = [
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.equal(owner.ownerPackage, '@asyra/feature-system')
  assert.match(contract, /execution handlers/i)
  assert.match(contract, /session handlers/i)
  assert.match(contract, /input.*subscriptions/i)
  assert.match(contract, /stale side effects/i)
  assert.ok(
    owner.implementationBoundary.includes(
      'packages/feature-system/src/core/feature.ts'
    )
  )
})

test('property registration and replacement remain owned by props-manager', () => {
  const owner = step('register-property-capability')
  const contract = [
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.equal(owner.ownerPackage, '@asyra/props-manager')
  assert.match(contract, /definition/i)
  assert.match(contract, /runtime/i)
  assert.match(contract, /schema/i)
  assert.match(contract, /active usage/i)
  assert.match(contract, /stale side effects/i)
})

test('preset owns defaults, hooks, ordering, and explicit application lifecycle', () => {
  const owner = step('apply-preset-targets')
  const contract = [
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.equal(owner.ownerPackage, '@asyra/preset')
  assert.match(contract, /applyPreset\(core\)/)
  assert.match(contract, /stable target/i)
  assert.match(contract, /explicit replace/i)
  assert.match(contract, /deterministic/i)
  assert.match(contract, /dispose/i)
  assert.match(contract, /property schema.*property runtime.*replace only/i)
  assert.match(
    contract,
    /feature registration.*before.*after.*append.*replace/i
  )
})

test('unsupported direct extension follows unregister then redefine fallback', () => {
  const fallback = route('fallback-unregister-then-redefine')
  const unregister = step('unregister-preset-target')
  const redefine = step('redefine-app-capability')

  assert.equal(fallback.from, unregister.id)
  assert.equal(fallback.to, redefine.id)
  assert.match(fallback.predicate, /direct extension.*not supported/i)
  assert.match(unregister.conditions.join(' '), /dispose/i)
  assert.match(
    unregister.conditions.join(' '),
    /cleanup failure.*remains applied.*retry/i
  )
  assert.equal(redefine.ownerPackage, 'app or user composition')
})

test('structured failure ownership covers required fail-fast cases', () => {
  const owner = step('resolve-extension-contract')
  const contract = owner.conditions.join(' ')

  assert.match(contract, /duplicate extension key/i)
  assert.match(contract, /missing target/i)
  assert.match(contract, /invalid strategy/i)
  assert.match(contract, /replace conflict/i)
  assert.match(contract, /fail fast/i)
  assert.match(contract, /stable error code/i)
})

test('core exposes facade routes without owning preset policy', () => {
  const owner = step('expose-core-registration-facade')
  const contract = [...owner.conditions, ...owner.forbiddenContributors].join(
    ' '
  )

  assert.equal(owner.ownerPackage, '@asyra/core')
  assert.match(contract, /public facade/i)
  assert.match(contract, /must not choose/i)
  assert.match(contract, /app-specific/i)
})

test('app startup only chooses extension or replacement policy', () => {
  const owner = step('compose-app-preset-customization')
  const contract = [...owner.conditions, ...owner.forbiddenContributors].join(
    ' '
  )

  assert.equal(owner.ownerPackage, '@asyra/asyra-design')
  assert.match(contract, /choose/i)
  assert.match(contract, /public/i)
  assert.match(contract, /framework internals/i)
})

test('Inspector names the bounded product cases and definition of done', () => {
  const caseIds = data.productCases.map((item) => item.id)
  const dodIds = data.definitionOfDone.map((item) => item.id)

  ;[
    'feature-extension',
    'property-extension',
    'explicit-replace',
    'structured-failures',
    'fallback-replacement',
    'lifecycle-cleanup',
    'startup-compatibility',
    'render-mode-non-inference'
  ].forEach((id) =>
    assert.ok(caseIds.includes(id), `Missing product case: ${id}`)
  )
  ;[
    'public-contracts',
    'deterministic-ordering',
    'cleanup',
    'compatibility',
    'package-boundaries',
    'full-validation'
  ].forEach((id) => assert.ok(dodIds.includes(id), `Missing DoD item: ${id}`))
})

test('scope excludes preset composition and render-mode products', () => {
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

test('all routes and artifacts resolve to declared owners and consumers', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

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
        `Unknown artifact consumer: ${consumerId}`
      )
    })
  })
})
