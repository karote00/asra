const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./render-engine-boundary-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../..')

const assertImplementationBoundary = (owner, implementationFile, label) => {
  assert.ok(
    owner.implementationBoundary.includes(implementationFile),
    `Missing ${label} implementation boundary: ${implementationFile}`
  )
  const concretePath = implementationFile.endsWith('/**')
    ? implementationFile.slice(0, -3)
    : implementationFile
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, concretePath)),
    `${label} implementation boundary does not resolve: ${implementationFile}`
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

test('completed boundary authority has a resolvable completed provider amendment', () => {
  const formerActiveSpecPath =
    'docs/ai/framework/plans/render-engine-boundary-plan.md'
  const productContract = data.links.find(
    (link) => link.id === 'product-contract'
  )

  assert.ok(productContract, 'Missing product-contract Inspector link')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/render-engine-boundary-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.equal(
    data.authority.completedAmendmentSpecPath,
    'docs/ai/framework/plans/completed/preset-composition-plan.md'
  )
  assert.ok(
    fs.existsSync(
      path.resolve(repoRoot, data.authority.completedAmendmentSpecPath)
    )
  )
  assert.ok(fs.existsSync(path.resolve(__dirname, productContract.href)))
  assert.equal(
    fs.existsSync(path.resolve(repoRoot, formerActiveSpecPath)),
    false
  )
})

test('Core accepts the preset 2D or app custom provider without owning runtime', () => {
  const selection = step('select-render-engine')
  const contract = [...selection.conditions, ...selection.bypasses].join(' ')

  assert.equal(selection.ownerPackage, '@asyra/core')
  assert.match(contract, /Preset profile 2D.*Pixi/i)
  assert.match(contract, /Preset profile CUSTOM supplies nothing/i)
  assert.match(contract, /app may bind its own provider through the same Core facade/i)
  assert.match(contract, /Profile choice never selects preset defaults/i)
  assert.match(contract, /does not construct or own the engine runtime resources/i)
  assert.ok(selection.implementationBoundary.includes('yarn.lock'))
})

test('render consumes only the abstract engine contract', () => {
  const adapter = step('orchestrate-render-adapter')
  const contract = [
    ...adapter.conditions,
    ...adapter.forbiddenContributors,
    ...adapter.implementationBoundary
  ].join(' ')

  assert.equal(adapter.ownerPackage, '@asyra/render')
  assert.match(contract, /@asyra\/render-engine/)
  assert.match(contract, /Pixi/i)
  assert.equal(adapter.cacheDimensions.length, 0)
  assert.ok(adapter.implementationBoundary.includes('yarn.lock'))
  assert.ok(adapter.implementationBoundary.includes('turbo.json'))
  assert.ok(
    adapter.implementationBoundary.includes('packages/render/src/types.ts')
  )
  assert.ok(
    adapter.implementationBoundary.includes('packages/render/src/renderer.ts')
  )
  assert.ok(
    adapter.implementationBoundary.includes(
      'packages/render/src/pixi-renderer.ts'
    )
  )
})

test('Core owns the default adapter and exact missing-provider headless route', () => {
  const startup = step('start-render-runtime')
  const contract = [
    ...startup.conditions,
    ...startup.bypasses,
    ...startup.allowedContributors,
    ...startup.forbiddenContributors
  ].join(' ')

  assert.match(contract, /Core owns and calls one default engine-neutral/i)
  assert.match(contract, /missing-provider.*headless/i)
  assert.match(contract, /Headless startup still orders data observers/i)
  assert.match(contract, /Direct Render and RenderAdapter consumers remain strict/i)
  assert.match(contract, /advanced app renderer replacement before startup/i)
  assert.match(contract, /concrete engine/i)
  assert.ok(
    startup.implementationBoundary.includes(
      'apps/asyra-design/src/render-app/index.tsx'
    )
  )
  assert.ok(
    startup.implementationBoundary.includes(
      'apps/asyra-design/src/render-app/__tests__/**'
    )
  )
  assert.ok(
    startup.implementationBoundary.includes('apps/asyra-design/package.json')
  )
  assert.ok(startup.implementationBoundary.includes('yarn.lock'))
})

test('architecture documentation sync stays with the matching owner steps', () => {
  const documentationByOwner = new Map([
    [
      'define-render-engine-contract',
      [
        'docs/ai/framework/FRAMEWORK_ESSENTIALS.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/RUNTIME_MATRICES.md',
        'docs/ai/framework/CONSTRAINTS.md',
        'docs/ai/framework/CODING_STANDARDS.md',
        'docs/ai/framework/WORKFLOW.md',
        'docs/ai/framework/rules/import-boundaries.md',
        'docs/ai/framework/packages/README.md',
        'docs/ai/framework/packages/render-engine.md',
        'docs/ai/framework/decisions/releases/unreleased.md'
      ]
    ],
    ['orchestrate-render-adapter', ['docs/ai/framework/packages/render.md']],
    [
      'execute-render-engine',
      ['docs/ai/framework/packages/render-engine-pixi.md']
    ],
    [
      'select-render-engine',
      [
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/golden-paths/README.md',
        'docs/ai/framework/golden-paths/replace-render-engine.md'
      ]
    ],
    [
      'start-render-runtime',
      [
        'docs/ai/framework/packages/core.md',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md'
      ]
    ]
  ])

  documentationByOwner.forEach((documentationFiles, ownerStepId) => {
    const owner = step(ownerStepId)
    documentationFiles.forEach((documentationFile) => {
      assert.ok(
        owner.implementationBoundary.includes(documentationFile),
        `Missing ${ownerStepId} documentation boundary: ${documentationFile}`
      )
    })
  })

  const architecture = fs.readFileSync(
    path.resolve(__dirname, '../ARCHITECTURE.md'),
    'utf8'
  )
  assert.match(architecture, /preset -->\|selects 2D provider\| pixi/)
  assert.doesNotMatch(architecture, /preset -->\|constructs default\| pixi/)
})

test('the abstract contract has its own package owner and shared artifact', () => {
  const contractOwner = step('define-render-engine-contract')
  const contractArtifact = data.artifacts.find(
    (item) => item.id === 'artifact:render-engine-contract'
  )

  assert.equal(contractOwner.ownerPackage, '@asyra/render-engine')
  assert.deepEqual(contractOwner.cacheDimensions, [])
  assert.ok(contractOwner.implementationBoundary.includes('yarn.lock'))
  assert.ok(contractOwner.implementationBoundary.includes('turbo.json'))
  assert.ok(contractArtifact)
  assert.equal(contractArtifact.ownerStepId, contractOwner.id)
  assert.deepEqual(contractArtifact.consumerStepIds, [
    'orchestrate-render-adapter',
    'execute-render-engine',
    'execute-custom-render-engine'
  ])
})

test('concrete execution owns Pixi resources without importing render', () => {
  const engine = step('execute-render-engine')
  const contract = [...engine.conditions, ...engine.forbiddenContributors].join(
    ' '
  )

  assert.equal(engine.ownerPackage, '@asyra/render-engine-pixi')
  assert.match(contract, /opaque handles/i)
  assert.match(contract, /must not import @asyra\/render/i)
  assert.ok(engine.implementationBoundary.includes('yarn.lock'))
  assert.ok(engine.implementationBoundary.includes('turbo.json'))
  assert.ok(
    engine.implementationBoundary.includes(
      'packages/render-engine-pixi/tsconfig.json'
    )
  )
  assert.ok(
    engine.implementationBoundary.includes(
      'packages/render-engine-pixi/vitest.config.ts'
    )
  )
})

test('custom engines use the same command and interaction routes', () => {
  const customSelection = route('use-custom-engine')
  const stateRoute = route('project-state-to-engine')
  const interactionRoute = route('return-normalized-interaction')

  assert.equal(customSelection.to, 'orchestrate-render-adapter')
  assert.equal(stateRoute.to, 'execute-render-engine')
  assert.equal(interactionRoute.to, 'bridge-render-interaction')
})

test('ready publication accepts rendered or exact headless success only', () => {
  const ready = step('publish-render-ready')
  const contract = [...ready.conditions, ...ready.bypasses].join(' ')

  assert.equal(ready.ownerPackage, '@asyra/core')
  assert.match(contract, /successful engine initialization or the Core-normalized exact missing-provider headless outcome/i)
  assert.match(contract, /provider callback, engine validation, initialization, capability/i)
  assert.match(contract, /does not publish/i)
})

test('interaction returns through render before feature execution', () => {
  const bridge = step('bridge-render-interaction')
  const contract = [...bridge.conditions, ...bridge.forbiddenContributors].join(
    ' '
  )

  assert.equal(bridge.ownerPackage, '@asyra/render')
  assert.match(contract, /opaque engine handle/i)
  assert.match(contract, /framework interaction target/i)
  assert.match(contract, /must not execute product features/i)
  ;[
    'yarn.lock',
    'packages/render/package.json',
    'packages/render/src/render.ts',
    'packages/render/src/interaction/**',
    'packages/render/src/handlers/**',
    'packages/render/src/layers/scene/render-layer.ts',
    'packages/render/src/registries/render-interaction-handler.ts',
    'packages/render/src/types/render-interaction.ts',
    'packages/render/src/__tests__/render-engine-package-boundary.test.ts'
  ].forEach((implementationFile) => {
    assertImplementationBoundary(
      bridge,
      implementationFile,
      'interaction'
    )
  })
  ;[
    'packages/render/src/layers/scene/element-interaction-handler.ts',
    'packages/render/src/types/interaction-handler.ts'
  ].forEach((retiredImplementationFile) => {
    assert.equal(
      bridge.implementationBoundary.includes(retiredImplementationFile),
      false,
      `Retired interaction boundary must be removed: ${retiredImplementationFile}`
    )
  })
})

test('cleanup is deterministic and owned resources cannot survive destroy', () => {
  const cleanup = step('destroy-render-runtime')
  const contract = [...cleanup.conditions, ...cleanup.bypasses].join(' ')

  assert.match(contract, /owned resources/i)
  assert.match(contract, /interaction subscriptions/i)
  assert.match(contract, /partial initialization/i)
  assert.ok(
    cleanup.implementationBoundary.includes('packages/render/src/renderer.ts')
  )
  assert.ok(
    cleanup.implementationBoundary.includes(
      'packages/render/src/types/render-object.ts'
    )
  )
  assert.ok(
    cleanup.implementationBoundary.includes(
      'apps/asyra-design/src/render-app/index.tsx'
    )
  )
  assert.ok(
    cleanup.implementationBoundary.includes(
      'apps/asyra-design/src/render-app/__tests__/**'
    )
  )
})

test('the contract does not expose production 3D or hybrid behavior', () => {
  const source = fs.readFileSync(__filename, 'utf8')
  const publicIdentifiers = [
    ...data.steps.flatMap((item) => [item.id, ...item.outputs]),
    ...data.routes.map((item) => item.id),
    ...data.artifacts.map((item) => item.id)
  ].join(' ')

  assert.doesNotMatch(publicIdentifiers, /3d|hybrid|render-mode/i)
  assert.match(source, /does not expose production 3D or hybrid behavior/)
})
