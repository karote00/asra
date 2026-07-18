const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./property-type-redefinition-flow-inspector.data.cjs')

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

test('plan and dedicated Inspector remain resolvable authorities', () => {
  const productLink = data.links.find((link) => link.id === 'product-contract')

  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/property-type-redefinition-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/property-type-redefinition-flow-inspector.data.cjs'
  )
  assert.ok(productLink)
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(__dirname, productLink.href)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/property-type-redefinition-flow-inspector.html'
      )
    )
  )
})

test('app composition uses public Core and keeps semantic consumers explicit', () => {
  const app = step('compose-property-customization')
  const contract = contractText(app)

  assert.equal(app.ownerPackage, 'app or user composition')
  assert.match(contract, /applyPreset\(core\)/)
  assert.match(contract, /before the first core\.start\(\)/i)
  assert.match(contract, /relations.*render strategies.*UI properties.*migration/i)
  assert.match(contract, /public Core instance/i)
  assert.match(contract, /deep imports/i)
  assert.match(contract, /direct Props Manager singleton/i)
  assert.match(contract, /fallback B-to-C mapping/i)
  const requiredDocs = [
    'docs/ai/framework/packages/preset.md',
    'docs/ai/apps/asyra-design/API_SURFACES.md',
    'docs/ai/apps/asyra-design/modules/init-and-startup.md',
    'docs/ai/apps/asyra-design/modules/registrations.md',
    'docs/ai/apps/asyra-design/ARCHITECTURE.md'
  ]
  requiredDocs.forEach((requiredPath) => {
    assert.ok(app.implementationBoundary.includes(requiredPath))
  })
  assert.deepEqual(app.cacheDimensions, [])
})

test('Core coordinates a bounded pre-start redefinition without general replace semantics', () => {
  const core = step('coordinate-property-redefinition')
  const contract = contractText(core)

  assert.equal(core.ownerPackage, '@asyra/core')
  assert.match(contract, /read request.*never mutates/i)
  assert.match(contract, /open composition/i)
  assert.match(contract, /same type/i)
  assert.match(contract, /owner metadata changes to the app only after/i)
  assert.match(contract, /metadata-only owner transfer/i)
  assert.match(contract, /preserves.*relations.*handlers.*resources/i)
  assert.match(
    contract,
    /existing Core config.*delegates.*Props Manager.*no second.*builder owner/i
  )
  assert.match(contract, /relations are preserved/i)
  assert.match(contract, /stale fixed component aliases or property-child keys/i)
  assert.match(contract, /general registry overwrite/i)
  assert.match(contract, /runtime redefinition after core\.start/i)
  assert.ok(
    core.implementationBoundary.includes(
      'packages/core/src/define-property-component.ts'
    )
  )
  assert.ok(
    core.implementationBoundary.includes('packages/core/src/apis/props.ts')
  )
  assert.ok(
    core.implementationBoundary.includes('packages/core/src/apis/index.ts')
  )
  assert.ok(
    core.implementationBoundary.includes(
      'packages/utils/src/registry/registration-graph.ts'
    )
  )
  assert.ok(
    core.implementationBoundary.includes(
      'packages/utils/src/registry/__tests__/registration-graph.test.ts'
    )
  )
})

test('Props Manager owns detached projection and atomic schema/runtime rebuild', () => {
  const owner = step('rebuild-declarative-property-type')
  const contract = contractText(owner)

  assert.equal(owner.ownerPackage, '@asyra/props-manager')
  assert.match(contract, /deeply detached/i)
  assert.match(contract, /constructor mode/i)
  assert.match(contract, /active instances.*replay-retained instances/i)
  assert.match(contract, /schema and constructor are staged before/i)
  assert.match(contract, /swaps schema and runtime together/i)
  assert.match(contract, /preserving the exact existing child configuration/i)
  assert.match(contract, /invalid-reject/i)
  assert.match(contract, /deterministic fallback/i)
  assert.match(contract, /retains the exact prior schema and constructor/i)
})

test('Scene Tree projects only canonical property values', () => {
  const projection = step('project-property-values')
  const contract = contractText(projection)

  assert.equal(projection.ownerPackage, '@asyra/scene-tree')
  assert.match(contract, /complete getValue result/i)
  assert.match(contract, /Removed fixed fields are not reconstructed/i)
  assert.match(contract, /schema\/default reconstruction inside Scene Tree/i)
  assert.match(contract, /fallback values for removed or missing fields/i)
})

test('render and UI consumers are typed, explicit, and remain downstream', () => {
  const render = step('consume-typed-render-data')
  const ui = step('derive-typed-ui-data')
  const renderContract = contractText(render)
  const uiContract = contractText(ui)

  assert.equal(render.ownerPackage, '@asyra/render')
  assert.match(renderContract, /app-declared custom data shape/i)
  assert.match(renderContract, /strategy alone decides/i)
  assert.match(renderContract, /Pixi or concrete render-engine types/i)
  assert.match(renderContract, /fallback geometry/i)

  assert.equal(ui.ownerPackage, '@asyra/ui-context')
  assert.match(uiContract, /app-declared element data type/i)
  assert.match(uiContract, /No UI registration is required/i)
  assert.match(uiContract, /derived-state runtime/i)
  assert.match(uiContract, /canonical property ownership/i)
})

test('routes preserve owner boundaries for definition read, rebuild, and consumers', () => {
  assert.deepEqual(
    [
      route('read-owner-definition').from,
      route('read-owner-definition').to
    ],
    ['coordinate-property-redefinition', 'rebuild-declarative-property-type']
  )
  assert.deepEqual(
    [
      route('request-atomic-rebuild').from,
      route('request-atomic-rebuild').to
    ],
    ['coordinate-property-redefinition', 'rebuild-declarative-property-type']
  )
  assert.equal(
    route('register-app-render-consumer').to,
    'consume-typed-render-data'
  )
  assert.equal(
    route('register-app-ui-consumer').to,
    'derive-typed-ui-data'
  )
  assert.equal(route('register-app-load-migration').kind, 'terminal')
})

test('product contract names bounded cases and rejects scope expansion', () => {
  const spec = fs.readFileSync(
    path.resolve(__dirname, 'property-type-redefinition-plan.md'),
    'utf8'
  )
  const acceptance = data.acceptanceContracts
    .flatMap((contract) => contract.assertions)
    .join(' ')

  assert.match(spec, /Add field:/)
  assert.match(spec, /Remove field:/)
  assert.match(spec, /Nested boundary:/)
  assert.match(spec, /Failure atomicity:/)
  assert.match(spec, /Typed consumers:/)
  assert.match(spec, /no nested\s+property-path API/is)
  assert.match(spec, /general registry replace operation/i)
  assert.match(spec, /Definition Of Done/)
  assert.match(acceptance, /without a preset deep import/i)
  assert.match(acceptance, /without unsafe casts/i)
  assert.match(acceptance, /semantic document conversion stays app-owned/i)
})
