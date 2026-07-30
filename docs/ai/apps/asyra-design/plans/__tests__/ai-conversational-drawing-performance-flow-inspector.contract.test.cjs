const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-performance-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

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

const read = (relativePath) =>
  fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8')

test('performance Inspector authorities resolve and stay immutable', () => {
  const plan = read(data.authority.specPath)

  assert.equal(
    data.target.id,
    'asyra-design-ai-conversational-drawing-performance'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
  assert.doesNotMatch(
    plan,
    /docs\/ai\/framework\/plans\/completed\/canonical-projection-and-collaboration-contract-realignment-plan\.md/
  )
})

test('endpoint routes and artifacts resolve through exact owners', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifacts = new Map(data.artifacts.map((artifact) => [artifact.id, artifact]))

  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifacts.size, data.artifacts.length)

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} source`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} target`)
    route.producedArtifacts.forEach((artifactId) => {
      const artifact = artifacts.get(artifactId)
      assert.ok(artifact, `${route.id} artifact ${artifactId}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner`)
      if (route.to) {
        assert.ok(
          artifact.consumerStepIds.includes(route.to),
          `${route.id} consumer`
        )
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), `${artifact.id} owner`)
    assert.equal(
      artifact.terminal,
      artifact.consumerStepIds.length === 0,
      `${artifact.id} terminal`
    )
    artifact.consumerStepIds.forEach((consumerId) =>
      assert.ok(stepIds.has(consumerId), `${artifact.id} consumer ${consumerId}`)
    )
  })
})

test('formal performance evidence uses production detached queries and named harness spans', () => {
  const owner = step('evaluate-performance-and-equivalence')
  const text = contractText(owner)

  assert.match(
    text,
    /production performance profile.*detached canonical.*history.*Factory transaction-status.*commit.*publication/i
  )
  assert.match(text, /dev-only window\.__Core__.*cannot satisfy/i)
  assert.match(
    text,
    /navigation.*App readiness.*collaboration readiness.*Mock AI.*reference attachment.*runtime evidence.*history baselines.*harness spans/i
  )
  assert.doesNotMatch(text, /persistence baseline/i)
  ;[
    'apps/asyra-design/e2e',
    'apps/asyra-design/playwright.collaboration.config.ts',
    'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
    'apps/asyra-design/src/init/__tests__'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
})

test('performance plan and BDD retain the production evidence boundary', () => {
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /Production evidence uses the dedicated AI drawing performance profile[\s\S]*dev-only `window\.__Core__`[\s\S]*cannot satisfy a release gate/i
  )
  assert.match(
    feature,
    /Scenario: Production performance evidence remains detached from dev-only globals[\s\S]*production performance profile[\s\S]*window\.__Core__[\s\S]*harness spans/i
  )
})

test('each ranked endpoint closes through one guarded high-detail proof', () => {
  const owner = step('evaluate-endpoint-performance')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /receiver provider and worker handoff[\s\S]*canonical Props, Scene Tree, and Core[\s\S]*Factory transaction and pub\/sub[\s\S]*remote apply[\s\S]*relay[\s\S]*codec[\s\S]*Render and UI/i
  )
  assert.match(
    plan,
    /complete endpoint refactor[\s\S]*one guarded 7,000-plus[\s\S]*at most five architecture attempts/i
  )
  assert.match(
    text,
    /exactly one production two-Actor 7,076-element.*immediately after.*endpoint/i
  )
  assert.match(
    text,
    /phase.*Actor A.*Actor B.*canonical element count.*test-owned process-tree CPU/i
  )
  assert.match(
    text,
    /production performance profile.*O\(1\).*Render projection.*Factory publication.*history.*uncapped/i
  )
  assert.match(
    text,
    /ordinary Playwright.*excludes.*guard environment variables.*CPU sample.*hard timeout.*SIGINT.*SIGTERM.*SIGHUP.*tracked process group/i
  )
  assert.match(
    text,
    /complete heartbeat.*both Actors.*exactly complete.*late over-projection/i
  )
  assert.match(
    text,
    /CPU.*heartbeat.*terminate.*Playwright.*headless browser.*App server.*collaboration server/i
  )
  assert.match(
    text,
    /250[- ]milliseconds?.*single.*above 150 percent.*immediately.*architecture attempt.*invalid/i
  )
  assert.match(
    text,
    /guard.*ready heartbeat.*before.*7,076-element request/i
  )
  assert.match(
    text,
    /last completed phase.*Actor A.*Actor B.*element counts.*owner timing/i
  )
  assert.match(
    text,
    /at most five.*same focused failure.*three/i
  )
  assert.match(
    feature,
    /Scenario: Each endpoint proves high-detail effectiveness without overwhelming the host[\s\S]*one 7076-element creation with no follow-up[\s\S]*warm-up, or repeat[\s\S]*Actor A[\s\S]*Actor B[\s\S]*CPU[\s\S]*above 150 percent[\s\S]*invalid architecture attempt[\s\S]*five/i
  )
  assert.match(
    feature,
    /uncapped Render projection element counts[\s\S]*production performance profile[\s\S]*O\(1\).*Factory publication/i
  )
  assert.match(
    plan,
    /Render\.getProjectedElementCount\(\)[\s\S]*O\(1\)[\s\S]*read-only[\s\S]*RenderLayer map/i
  )
  assert.match(
    feature,
    /exact ordinary viewport RenderLayer size.*computed mirror.*capped fixture count/i
  )
  assert.match(
    plan,
    /Factory\.getUndoHistoryDepth\(\)[\s\S]*read-only[\s\S]*private storage/i
  )
  const successRoute = data.routes.find(
    ({ id }) => id === 'route-endpoint-performance-proof'
  )
  const baselineRoute = data.routes.find(
    ({ id }) => id === 'route-accepted-endpoint-baseline'
  )
  const stopRoute = data.routes.find(
    ({ id }) => id === 'route-resource-guard-stop-proof'
  )
  assert.deepEqual(successRoute?.producedArtifacts, [
    'artifact:endpoint-performance-proof'
  ])
  assert.deepEqual(baselineRoute?.producedArtifacts, [
    'artifact:accepted-endpoint-baseline'
  ])
  assert.equal(baselineRoute?.to, 'evaluate-endpoint-performance')
  assert.deepEqual(stopRoute?.producedArtifacts, [
    'artifact:resource-guard-stop-proof'
  ])
  assert.doesNotMatch(successRoute?.predicate ?? '', /resource.stop/i)
  assert.doesNotMatch(stopRoute?.predicate ?? '', /effective|success/i)

  const acceptedBaseline = data.artifacts.find(
    ({ id }) => id === 'artifact:accepted-endpoint-baseline'
  )
  assert.equal(acceptedBaseline?.ownerStepId, 'evaluate-endpoint-performance')
  assert.deepEqual(acceptedBaseline?.consumerStepIds, [
    'evaluate-endpoint-performance'
  ])
  assert.equal(acceptedBaseline?.terminal, false)
  assert.match(
    text,
    /first receiver endpoint.*retained.*940\/7,076.*11\/35.*no additional.*seed/i
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/e2e/performance-resource-guard.mjs'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/playwright.endpoint-performance.config.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/__tests__/performance-resource-guard.test.mjs'
    )
  )
  ;[
    'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
    'apps/asyra-design/src/init/__tests__/ai-drawing-performance-profile.test.ts',
    'apps/asyra-design/src/init/init-app.ts',
    'apps/asyra-design/src/init/__tests__/init-app.test.ts',
    'apps/asyra-design/playwright.config.ts',
    'packages/render/src/render.ts',
    'packages/render/src/layers/viewport/viewport-layer.ts',
    'packages/render/src/__tests__/render.test.ts',
    'packages/render/src/__tests__/viewport-layer.test.ts',
    'packages/factory/src/data-transact.ts',
    'packages/factory/src/factory.ts',
    'packages/factory/src/__tests__/history-depth.test.ts',
    'docs/ai/framework/API_SURFACES.md',
    'docs/ai/framework/packages/factory.md',
    'docs/ai/framework/packages/render.md'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.ok(
    !owner.implementationBoundary.some(
      (file) =>
        file.includes('collaboration-ai-agent-video') ||
        file.endsWith('/e2e/test-utils.ts')
    )
  )
})

test('receiver handoff has one worker isolation boundary and no legacy clone mode', () => {
  const owner = step('admit-receiver-publication-frames')
  const codecOwner = step('encode-publication-frames')
  const text = contractText(owner)
  const codecText = contractText(codecOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /worker-to-main structured clone.*only inbound object isolation boundary/i
  )
  assert.match(
    text,
    /exactly one.*async.*consumer.*settlement/i
  )
  assert.match(
    text,
    /Dedicated Worker owns.*WebSocket.*data plane.*frame-consumed.*directly/i
  )
  assert.match(
    plan,
    /Dedicated Worker owns the browser WebSocket[\s\S]*main[- ]thread[\s\S]*never receives inbound publication bytes[\s\S]*never sends `?frame-consumed`?/i
  )
  assert.match(
    codecText,
    /Worker encodes.*writes.*directly.*Worker-owned WebSocket/i
  )
  assert.doesNotMatch(codecText, /returns a transferable ArrayBuffer/i)
  assert.doesNotMatch(
    text,
    /Provider keeps.*outbound publication frame.*sends the next frame/i
  )
  assert.match(
    feature,
    /Dedicated Worker should own the browser WebSocket data plane[\s\S]*main thread should never receive publication bytes or send "frame-consumed"/i
  )
  assert.doesNotMatch(plan, /provider deeply freezes/i)
  assert.doesNotMatch(plan, /preserves legacy provider cloning/i)
  assert.doesNotMatch(plan, /InboundPublicationLease/)
})

test('local progressive drawing paints exact bounds before cooperative canonical batches', () => {
  const owner = step('stage-local-interactive-composition')
  const proofOwner = step('evaluate-local-interactive-drawing')
  const text = contractText(owner)
  const proofText = contractText(proofOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /validated.*bounds.*runtime-only.*loading.*DOM.*paint opportunity.*before.*canonical mutation/i
  )
  assert.match(
    text,
    /point.*element-count.*budget/i
  )
  assert.match(
    text,
    /element-count budget capped at 64 per work unit/i
  )
  assert.match(
    text,
    /multiple deterministic plural Core batches.*one outer App transaction.*one intended history action/i
  )
  assert.match(
    text,
    /successful.*batch.*ordinary.*projection.*progress.*later browser task.*AbortSignal/i
  )
  assert.match(text, /CSS.*transform.*opacity.*compositor/i)
  assert.match(
    text,
    /atomic.*one all-children.*progressive.*multiple.*plural/i
  )
  assert.match(
    text,
    /production.*Mock AI.*without.*ai.*query.*progressive.*explicit.*atomic/i
  )
  assert.match(
    text,
    /clear.*success.*failure.*cancel.*rollback/i
  )
  assert.match(
    text,
    /App-owned document interaction lock.*before.*outer App transaction.*pan.*zoom.*block.*document mutation/i
  )
  assert.match(
    text,
    /viewport navigation.*ordinary Feature execution.*no canonical mutation.*history.*AI action.*transaction evidence/i
  )
  assert.doesNotMatch(
    text,
    /navigation.*never joins the AI transaction/i
  )
  assert.match(
    text,
    /release.*success.*failure.*cancel.*teardown/i
  )
  assert.ok(
    owner.forbiddenContributors.includes(
      'AI-only renderer or canonical loading placeholder'
    )
  )
  assert.ok(
    owner.forbiddenContributors.includes(
      'loading, progress, or slice-policy parameters in Core, Props Manager, or Scene Tree'
    )
  )
  ;[
    'Canvas or Render-owned loading overlay',
    'JavaScript per-frame loading animation',
    'microtask-only progressive yield',
    'one timeout scheduled independently for every planned range'
  ].forEach((contributor) =>
    assert.ok(owner.forbiddenContributors.includes(contributor), contributor)
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/constants')
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/render-app')
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/src/app/ai-conversation-panel.tsx'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'docs/ai/apps/asyra-design/API_SURFACES.md'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/package.json')
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/index.tsx')
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/e2e/conversational-ai-mock.spec.ts'
    )
  )
  assert.match(
    proofText,
    /one fresh single Actor.*one empty canonical document.*one 7,112-element.*one terminal exact canonical summary/i
  )
  assert.match(
    proofText,
    /connected DOM.*non-zero/i
  )
  assert.match(
    proofText,
    /longest canonical work unit.*cooperative yield count/i
  )
  assert.match(
    proofText,
    /Contents.*collaboration.*second Actor.*CRDT.*excluded.*No IndexedDB.*repeated measured run/i
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'apply-canonical-property-scene-batch' &&
        route.producedArtifacts.includes(
          'artifact:composition-batch-sequence'
        )
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'evaluate-local-interactive-drawing' &&
        route.producedArtifacts.includes('artifact:app-bulk-timing')
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'evaluate-local-interactive-drawing' &&
        route.producedArtifacts.includes(
          'artifact:local-drawing-progress-state'
        )
    )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:local-interactive-drawing-proof' &&
        artifact.ownerStepId === 'evaluate-local-interactive-drawing' &&
        artifact.terminal
      )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:local-drawing-progress-state' &&
        /DOM compositor overlay/i.test(artifact.channel)
    )
  )

  assert.match(
    plan,
    /Current Local Interactive Drawing Closure[\s\S]*single Actor[\s\S]*Contents[\s\S]*CRDT[\s\S]*IndexedDB/i
  )
  assert.match(
    plan,
    /Exact-Bounds Loading Frame[\s\S]*DOM[\s\S]*CSS[\s\S]*paint opportunity[\s\S]*before canonical mutation/i
  )
  assert.match(
    plan,
    /Cooperative Progressive Composition[\s\S]*point[\s\S]*element-count[\s\S]*later browser task[\s\S]*one outer transaction[\s\S]*one intended Undo/i
  )
  assert.match(
    plan,
    /Document Interaction Lock[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*success[\s\S]*failure[\s\S]*cancellation[\s\S]*teardown/i
  )
  assert.match(
    plan,
    /production Asyra Design entry.*Mock AI.*without[\s\S]*`ai` query[\s\S]*defaults to progressive[\s\S]*explicit[\s\S]*`aiDelivery=atomic`.*atomic/i
  )
  assert.match(
    feature,
    /Scenario: Exact-bounds loading state precedes local drawing[\s\S]*runtime-only[\s\S]*DOM[\s\S]*compositor/i
  )
  assert.match(
    feature,
    /connected App DOM overlay.*before any canonical element[\s\S]*ordinary Vector/i
  )
  assert.match(
    feature,
    /Scenario: Local progressive composition becomes visible in cooperative batches[\s\S]*point and element-count[\s\S]*later browser task[\s\S]*one outer transaction[\s\S]*one Undo/i
  )
  assert.match(
    feature,
    /at most 64 elements per ordinary work unit/i
  )
  assert.match(
    plan,
    /64-element work-unit cap[\s\S]*2,048[\s\S]*8,192/i
  )
  assert.match(
    feature,
    /Scenario: Drawing progress keeps navigation responsive while edits stay locked[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*one Undo/i
  )
  assert.match(
    feature,
    /Scenario: Production App exposes Mock AI without URL activation[\s\S]*ordinary production entry[\s\S]*without an "ai" query[\s\S]*progressive[\s\S]*explicit "aiDelivery=atomic"[\s\S]*atomic/i
  )
})

test('demo documents load empty without client persistence', () => {
  const owner = step('load-empty-demo-document')
  const localProofOwner = step('evaluate-local-interactive-drawing')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /ordinary local.*collaboration.*without.*persistence provider.*capture.*save.*IndexedDB/i
  )
  assert.match(text, /load.*canonical empty document/i)
  assert.doesNotMatch(text, /ordinary non-collaboration.*FILE.*unchanged/i)
  assert.ok(
    !localProofOwner.inputs.includes('artifact:empty-memory-demo-document')
  )
  assert.ok(
    !data.routes.some(
      (route) =>
        route.from === 'load-empty-demo-document' &&
        route.to === 'evaluate-local-interactive-drawing'
    )
  )
  assert.doesNotMatch(
    JSON.stringify(data),
    /bypass-collaboration-client-persistence|artifact:collaboration-client-persistence-bypass/
  )
  assert.doesNotMatch(JSON.stringify(data), /persist-local-commit-snapshots/)
  assert.doesNotMatch(
    JSON.stringify(data),
    /artifact:(?:local-commit-snapshot-trigger|committed-persistence-snapshots|persistence-timing)/
  )
  assert.match(
    plan,
    /Demo Client Persistence Bypass[\s\S]*ordinary local[\s\S]*collaboration[\s\S]*zero client persistence/i
  )
  assert.match(
    feature,
    /Scenario: Demo documents load empty without client persistence[\s\S]*ordinary local[\s\S]*collaboration[\s\S]*IndexedDB/i
  )
})
