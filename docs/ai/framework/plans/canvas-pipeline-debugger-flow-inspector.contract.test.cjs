const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./canvas-pipeline-debugger-flow-inspector.data.cjs')

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

const artifact = (id) => {
  const value = data.artifacts.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector artifact: ${id}`)
  return value
}

test('product contract and dedicated Inspector remain resolvable authorities', () => {
  const repoRoot = path.resolve(__dirname, '../../../..')
  const productLink = data.links.find((link) => link.id === 'product-contract')

  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/canvas-pipeline-debugger-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.data.cjs'
  )
  assert.ok(productLink)
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(__dirname, productLink.href)))
})

test('app DEV bootstrap is separate from E2E and production bypasses import', () => {
  const bootstrap = step('bootstrap-dev-debugger')
  const contract = [
    ...bootstrap.conditions,
    ...bootstrap.bypasses,
    ...bootstrap.forbiddenContributors
  ].join(' ')

  assert.equal(bootstrap.ownerPackage, '@asyra/asyra-design')
  assert.match(contract, /import\.meta\.env\.DEV/)
  assert.match(contract, /Production builds bypass/i)
  assert.match(contract, /__AsyraE2E__/)
  assert.match(contract, /direct app import/i)
  assert.ok(
    bootstrap.implementationBoundary.includes('apps/asyra-design/tsconfig.json')
  )
})

test('Core optional facade owns lifecycle and layer registration route', () => {
  const session = step('control-debug-session')
  const contract = [
    ...session.conditions,
    ...session.bypasses,
    ...session.allowedContributors,
    ...session.forbiddenContributors
  ].join(' ')

  assert.equal(session.ownerPackage, '@asyra/core/canvas-pipeline-debugger')
  assert.match(contract, /core\.registerRenderLayer/)
  assert.match(contract, /core\.unregisterRenderLayer/)
  assert.match(contract, /one non-disposed debugger session/i)
  assert.match(contract, /no Render observer and no registered overlay/i)
  assert.match(contract, /default Core singleton substitution/i)
  assert.ok(session.implementationBoundary.includes('packages/core/tsconfig.json'))
})

test('Render observation stops at engine-neutral pre-handoff evidence', () => {
  const observer = step('observe-render-pipeline')
  const contract = [
    ...observer.conditions,
    ...observer.bypasses,
    ...observer.allowedContributors,
    ...observer.forbiddenContributors
  ].join(' ')

  assert.equal(observer.ownerPackage, '@asyra/render')
  assert.match(contract, /one Render instance/i)
  assert.match(contract, /before the engine call/i)
  assert.match(contract, /no opaque handle or result/i)
  assert.match(contract, /no enabled observer.*before allocating/i)
  assert.match(contract, /hit tests/i)
  assert.match(contract, /Scene Tree or Props Manager fallback/i)
  assert.match(contract, /debugger-owned overlay commands are excluded/i)
})

test('trace projection is bounded, deterministic, and never fabricates geometry', () => {
  const projection = step('project-debug-trace')
  const contract = [
    ...projection.conditions,
    ...projection.bypasses,
    ...projection.forbiddenContributors
  ].join(' ')

  assert.match(contract, /drops the oldest entry/i)
  assert.match(contract, /Focused ids are stable-deduplicated/i)
  assert.match(contract, /unknown ids remain not-observed/i)
  assert.match(contract, /wall-clock time or random ids/i)
  assert.match(contract, /fallback bounds or transforms/i)
  assert.deepEqual(projection.cacheDimensions, [])
})

test('overlay remains non-interactive and cleanup is debugger-owned', () => {
  const overlay = step('manage-debug-overlay')
  const contract = [
    ...overlay.conditions,
    ...overlay.bypasses,
    ...overlay.allowedContributors,
    ...overlay.forbiddenContributors
  ].join(' ')

  assert.match(contract, /runtime read model owns frame, layer outcome/i)
  assert.match(contract, /unregister and destroy all debugger-owned/i)
  assert.match(contract, /Not-observed.*no geometry/i)
  assert.match(contract, /interaction-target registration/i)
  assert.match(contract, /DOM overlay or new engine text primitive/i)
  assert.match(contract, /Core-supplied layer registration callbacks/i)
  assert.match(contract, /debug output consumed by canonical render strategies/i)
})

test('overlay faults enter the session read model before cleanup', () => {
  const spec = fs.readFileSync(
    path.resolve(__dirname, 'canvas-pipeline-debugger-plan.md'),
    'utf8'
  )
  const session = step('control-debug-session')
  const projection = step('project-debug-trace')
  const overlay = step('manage-debug-overlay')
  const reportFault = route('report-overlay-fault')
  const projectFault = route('project-overlay-fault')
  const overlayFault = artifact('artifact:debug-overlay-fault')
  const sessionFault = artifact('artifact:debug-session-fault')

  assert.match(
    spec,
    /snapshot\.fault.*observation.*overlay projection failure/is
  )
  assert.match(session.conditions.join(' '), /fault.*before.*cleanup/i)
  assert.match(projection.conditions.join(' '), /snapshot fault.*overlay/i)
  assert.match(overlay.conditions.join(' '), /overlay projection fault.*Core/i)
  assert.deepEqual(
    [reportFault.from, reportFault.to],
    ['manage-debug-overlay', 'control-debug-session']
  )
  assert.deepEqual(
    [projectFault.from, projectFault.to],
    ['control-debug-session', 'project-debug-trace']
  )
  assert.deepEqual(reportFault.producedArtifacts, [
    'artifact:debug-overlay-fault'
  ])
  assert.deepEqual(projectFault.producedArtifacts, [
    'artifact:debug-session-fault'
  ])
  assert.equal(overlayFault.ownerStepId, 'manage-debug-overlay')
  assert.deepEqual(overlayFault.consumerStepIds, ['control-debug-session'])
  assert.equal(sessionFault.ownerStepId, 'control-debug-session')
  assert.deepEqual(sessionFault.consumerStepIds, ['project-debug-trace'])
})

test('Inspector names bounded product cases and definition of done', () => {
  const spec = fs.readFileSync(
    path.resolve(__dirname, 'canvas-pipeline-debugger-plan.md'),
    'utf8'
  )
  const acceptance = data.acceptanceContracts
    .flatMap((contract) => contract.assertions)
    .join(' ')

  assert.match(spec, /Disabled baseline/)
  assert.match(spec, /Capacity boundary/)
  assert.match(spec, /Fault containment/)
  assert.match(spec, /Production bypass/)
  assert.match(spec, /Definition Of Done/)
  assert.match(acceptance, /DEV app developer can enable/i)
  assert.match(acceptance, /production wiring contains no optional debugger/i)
})
