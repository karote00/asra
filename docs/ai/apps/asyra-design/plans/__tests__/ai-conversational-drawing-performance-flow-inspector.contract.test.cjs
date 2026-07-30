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
  const artifacts = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )

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
      assert.ok(
        stepIds.has(consumerId),
        `${artifact.id} consumer ${consumerId}`
      )
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
    /navigation.*App readiness.*collaboration readiness.*Conversational AI readiness.*reference attachment.*runtime evidence.*history baselines.*harness spans/i
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

test('production conversational AI uses one ActionBatch contract without compatibility modes', () => {
  const providerOwner = step('preload-file-scoped-server-response')
  const runtimeOwner = step('resolve-server-prepared-action-batch')
  const providerText = contractText(providerOwner)
  const runtimeText = contractText(runtimeOwner)
  const activeText = (owner) =>
    [
      owner.purpose,
      ...owner.inputs,
      ...owner.outputs,
      ...owner.conditions,
      ...owner.bypasses,
      ...owner.allowedContributors
    ].join(' ')
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(providerText, /response inbox adapter.*required fileId/i)
  assert.match(providerText, /requestActionBatch\(\).*AiActionBatch.*batchId/i)
  assert.match(runtimeText, /resolveAiActionBatch\(\).*AiActionBatch.*batchId/i)
  assert.match(
    runtimeText,
    /ResolvedAiActionBatch.*PermissionReadyAiActionBatch.*AiActionBatchPreview/i
  )
  assert.doesNotMatch(
    `${activeText(providerOwner)}\n${activeText(runtimeOwner)}`,
    /\bMock\b|\bfake\b|local-compat/i
  )
  assert.doesNotMatch(
    `${activeText(providerOwner)}\n${activeText(runtimeOwner)}`,
    /\brequestPlan\b|\bresolvePlan\b|\bplanId\b|plan API alias|compatibility alias/i
  )
  ;[
    'apps/asyra-design/package.json',
    'apps/asyra-design/src/index.tsx',
    'apps/asyra-design/src/init/index.ts',
    'apps/asyra-design/src/init/init-app.ts',
    'apps/asyra-design/src/init/__tests__/init-app.test.ts',
    'apps/asyra-design/src/ai/startup.ts',
    'apps/asyra-design/src/ai/server-action-batch-provider.ts',
    'apps/asyra-design/src/ai/server-response-inbox.ts',
    'apps/asyra-design/src/ai/mode.ts',
    'apps/asyra-design/src/ai/mock-provider.ts',
    'apps/asyra-design/src/ai/mock-backend-response-store.ts',
    'apps/asyra-design/src/ai/fixtures',
    'apps/asyra-design/src/ai/app-prompt.ts',
    'apps/asyra-design/src/ai/context.ts',
    'apps/asyra-design/src/ai/__tests__',
    'apps/asyra-design/src/startup.ts',
    'apps/asyra-design/src/toolbar/index.tsx',
    'apps/asyra-design/src/toolbar/__tests__/ai-control.test.tsx',
    'apps/asyra-design/src/app/ai-conversation-panel.tsx',
    'apps/asyra-design/src/app/__tests__/ai-conversation-panel.test.tsx',
    'apps/asyra-design/test-data/ai-drawing',
    'apps/asyra-design/e2e/server-response-inbox.ts',
    'apps/asyra-design/e2e/test-utils.ts',
    'apps/asyra-design/e2e/conversational-ai.spec.ts',
    'apps/asyra-design/e2e/conversational-ai-mock.spec.ts',
    'apps/asyra-design/e2e/mock-backend-response-store.ts'
  ].forEach((boundary) =>
    assert.ok(providerOwner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    providerText,
    /legacy mode.*paths named in this implementation boundary.*deletion or relocation sources only.*no production import.*generated bundle artifact/i
  )
  assert.match(
    providerText,
    /deterministic preparation.*seed.*fixture.*test or manual harness.*never.*production bundle/i
  )
  assert.match(
    providerText,
    /no artificial delay.*phrase.*fixture fallback.*failure simulation/i
  )
  assert.match(
    plan,
    /Server-prepared AiActionBatch Contract[\s\S]*requestActionBatch\(input, \{ signal \}\)[\s\S]*AiActionBatch.*batchId[\s\S]*resolveAiActionBatch\(batch, \{ signal \}\)[\s\S]*ResolvedAiActionBatch[\s\S]*PermissionReadyAiActionBatch[\s\S]*AiActionBatchPreview/i
  )
  assert.match(
    plan,
    /former action-plan API[\s\S]*planId[\s\S]*plan aliases[\s\S]*compatibility overloads.*deleted/i
  )
  assert.match(
    feature,
    /Scenario: Runtime resolves one server-prepared AiActionBatch[\s\S]*requestActionBatch\(\).*AiActionBatch.*batchId[\s\S]*resolveAiActionBatch\(\)/i
  )
})

test('file-scoped server response is prepared before request timing', () => {
  const owner = step('preload-file-scoped-server-response')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /required fileId.*versioned server response.*response inbox.*IndexedDB/i
  )
  assert.match(text, /before.*App.*Agent.*readiness.*before.*stable.*baseline/i)
  assert.match(text, /16.*320.*1,280.*7,075.*exact/i)
  assert.match(
    text,
    /request-time.*IndexedDB.*import.*fetch.*JSON.*SVG.*parse.*tokenize.*transform.*materializ/i
  )
  assert.match(
    text,
    /separate.*canonical document persistence.*zero.*read.*write/i
  )
  assert.match(
    text,
    /test or manual harness.*prepares.*versioned server response.*before.*App navigation/i
  )
  assert.match(
    text,
    /full-detail output.*every item, point, role, order, bounds, transform, and style/i
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/src/ai/server-action-batch-provider.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/src/ai/server-response-inbox.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/startup.ts')
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/e2e/server-response-inbox.ts'
    )
  )
  const actionBatch = data.artifacts.find(
    ({ id }) => id === 'artifact:server-prepared-action-batch'
  )
  assert.equal(actionBatch?.ownerStepId, 'preload-file-scoped-server-response')
  assert.deepEqual(actionBatch?.consumerStepIds, [
    'resolve-server-prepared-action-batch'
  ])
  ;[
    'artifact:response-inbox-bootstrap-timing',
    'artifact:provider-response-handoff-timing'
  ].forEach((artifactId) => {
    const artifact = data.artifacts.find(({ id }) => id === artifactId)
    assert.equal(artifact?.ownerStepId, 'preload-file-scoped-server-response')
    assert.deepEqual(artifact?.consumerStepIds, [
      'evaluate-endpoint-performance',
      'evaluate-performance-and-equivalence'
    ])
  })
  const actionBatchRoute = data.routes.find(
    ({ id }) => id === 'route-server-prepared-action-batch-to-runtime'
  )
  assert.equal(actionBatchRoute?.from, 'preload-file-scoped-server-response')
  assert.equal(actionBatchRoute?.to, 'resolve-server-prepared-action-batch')
  assert.deepEqual(actionBatchRoute?.producedArtifacts, [
    'artifact:server-prepared-action-batch'
  ])
  ;[
    'route-response-inbox-bootstrap-timing-to-endpoint-proof',
    'route-response-inbox-bootstrap-timing-to-final-proof',
    'route-provider-response-handoff-timing-to-endpoint-proof',
    'route-provider-response-handoff-timing-to-final-proof'
  ].forEach((routeId) => {
    const route = data.routes.find(({ id }) => id === routeId)
    assert.equal(route?.from, 'preload-file-scoped-server-response')
  })
  assert.equal(
    data.artifacts.some(
      ({ id }) => id === 'artifact:provider-materialization-timing'
    ),
    false
  )
  assert.match(
    plan,
    /File-scoped Server Response Inbox Contract[\s\S]*test\/manual harness.*validate and normalize[\s\S]*bounded summary.*compact composition geometry[\s\S]*IndexedDB response inbox adapter[\s\S]*App and Agent readiness[\s\S]*At request time.*requestActionBatch\(\)[\s\S]*no artificial delay/i
  )
  assert.match(
    feature,
    /Scenario: Required fileId preloads one server response inbox record before App readiness[\s\S]*compacts one exact model response.*outside the production bundle[\s\S]*IndexedDB response inbox adapter[\s\S]*canonical document.*empty[\s\S]*request-time response inbox access/i
  )
})

test('Runtime resolves one server-prepared ActionBatch without client model validation', () => {
  const owner = step('resolve-server-prepared-action-batch')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /requestActionBatch\(\).*only public provider.*resolveAiActionBatch\(\).*only Runtime resolution.*no public or internal plan API/i
  )
  assert.match(
    text,
    /AiActionBatch carries.*batchId.*empty-batch rule.*duplicate action ids.*unknown actions.*does not traverse.*item.*path.*point.*geometry/i
  )
  assert.match(
    text,
    /server-prepared action arguments.*not recursively cloned.*permission and execution.*same.*arguments identity/i
  )
  assert.match(
    text,
    /action definition.*inputSchema.*server action-batch construction.*no client.*schema.*parse.*prepare/i
  )
  assert.match(
    text,
    /server-prepared.*bounded redaction-ready summary.*compact.*coordinate/i
  )
  assert.match(
    text,
    /permission and execution.*exact same.*arguments identity/i
  )
  assert.match(
    text,
    /bounded redaction-ready summary.*AiActionBatchPreview.*only that summary.*never complete item, path, point.*geometry/i
  )
  assert.match(
    text,
    /noncanonical.*nonshared.*shared props.*components.*elements.*Factory.*CRDT/i
  )
  assert.match(
    text,
    /large-payload, validation, delivery, progressive, loading, or collaboration flags/i
  )
  assert.match(
    text,
    /server validates.*normalize.*item.*path.*point.*compact.*before App readiness.*front.?end.*materializ.*progressive slice/i
  )
  ;[
    'packages/ai-agent-runtime/src',
    'packages/ai-agent-runtime/src/__tests__',
    'apps/asyra-design/src/ai/actions.ts',
    'apps/asyra-design/src/ai/prepared-composition.ts',
    'apps/asyra-design/src/ai/confirmation.ts',
    'apps/asyra-design/src/ai/__tests__',
    'create-app/asyra-design/template/src/ai',
    'docs/ai/framework/packages/ai-agent-runtime.md',
    'docs/ai/framework/golden-paths/compose-ai-agent-runtime.md',
    'docs/examples/ai-agent-runtime.mjs'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    plan,
    /Server-prepared AiActionBatch Contract[\s\S]*requestActionBatch\(input, \{ signal \}\)[\s\S]*AiActionBatch.*batchId[\s\S]*resolveAiActionBatch\(batch, \{ signal \}\)[\s\S]*ResolvedAiActionBatch[\s\S]*PermissionReadyAiActionBatch[\s\S]*AiActionBatchPreview/i
  )
  assert.match(
    plan,
    /small control envelope[\s\S]*batchId[\s\S]*empty batch[\s\S]*duplicate ids[\s\S]*unknown actions[\s\S]*never traverses item, path, point, style, bounds[\s\S]*geometry/i
  )
  assert.match(
    plan,
    /backend-facing `inputSchema`[\s\S]*no client-side action[\s\S]*schema.*parse.*prepare[\s\S]*compact coordinate artifact[\s\S]*materializes only the next[\s\S]*progressive slice/i
  )
  assert.match(
    plan,
    /action-definition contract receives no large-payload, validation,[\s\S]*delivery, progressive, loading, or collaboration mode/i
  )
  assert.match(
    feature,
    /Scenario: Runtime resolves one server-prepared AiActionBatch without client model validation[\s\S]*requestActionBatch\(\)[\s\S]*resolveAiActionBatch\(\)[\s\S]*control envelope[\s\S]*inputSchema[\s\S]*same action arguments identity[\s\S]*bounded summaries.*without items, paths, points, or complete geometry[\s\S]*local, noncanonical, and nonshared/i
  )
  assert.match(
    feature,
    /test or manual harness.*validates, normalizes[\s\S]*outside the production bundle[\s\S]*before App navigation[\s\S]*resident before App readiness/i
  )
  assert.match(feature, /server-prepared action.*compact coordinate artifact/i)
  assert.match(
    feature,
    /front end should perform no item, path, or point validation or compact encoding/i
  )
  assert.match(feature, /materializing only the next progressive slice/i)
  assert.match(
    plan,
    /221\.695 percent[\s\S]*renderer PID.*201\.901[\s\S]*0\/17/i
  )
  assert.match(
    plan,
    /superseded fixed 650-millisecond artificial delay[\s\S]*Runtime then synchronously calls the registered action schema/i
  )
})

test('render projection owns demand-driven frames without an idle Pixi bypass', () => {
  const owner = step('project-visible-canonical-slices')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(text, /Pixi Application ticker.*must not.*render.*dirty gate/i)
  assert.match(
    text,
    /settled zero-element.*no scheduled frame.*no engine flush.*bounded performance evidence/i
  )
  assert.match(
    text,
    /pan.*zoom.*canonical.*computed.*system property.*schedule.*one frame.*animation/i
  )
  ;[
    'packages/core/src/core.ts',
    'packages/core/src/__tests__',
    'packages/render-engine/src',
    'packages/render-engine/src/__tests__',
    'packages/render-engine-pixi/src',
    'packages/render-engine-pixi/src/__tests__'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    plan,
    /Demand-driven render frame ownership[\s\S]*before the receiver\s+endpoint/i
  )
  assert.match(
    feature,
    /Scenario: Settled canvas schedules only demanded frames[\s\S]*zero elements[\s\S]*Pixi Application ticker[\s\S]*pan, zoom, canonical, computed, or system property[\s\S]*animation/i
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
    /Demand-driven render frame ownership[\s\S]*receiver provider and worker handoff[\s\S]*canonical Props, Scene Tree, and Core[\s\S]*Factory transaction and pub\/sub[\s\S]*remote apply[\s\S]*relay[\s\S]*codec[\s\S]*Visible canonical and UI projection/i
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
    /latest completed phase.*currently active started phase.*capture time.*Actor A.*Actor B.*canonical element count.*safety-signal sample time.*heartbeat age.*co-temporal/i
  )
  assert.match(
    text,
    /two stable cumulative CPU-time samples.*250-millisecond interval CPU.*200 percent.*hard stop.*decayed ps.*diagnostic/i
  )
  assert.match(
    text,
    /production build commands.*separate setup.*outside.*runtime guard.*product timing.*artifact attestation.*before.*Playwright/i
  )
  assert.match(
    text,
    /periodic.*phase-boundary.*one serialized.*OS sample.*no overlapping.*out-of-order/i
  )
  assert.match(text, /375-millisecond.*sample gap.*fail.*closed/i)
  assert.match(
    text,
    /single-Actor attribution invocation.*fresh browser process group.*required fileId URL.*Collaboration session.*WebSocket server.*no Actor B/i
  )
  assert.match(
    text,
    /one request-wide cumulative OS process CPU-time boundary.*exact wall time.*per-role.*ordered browser-monotonic.*inner owner attribution/i
  )
  assert.match(
    text,
    /phase-boundary sample.*same.*200-percent safety evaluation.*exact PID set equality.*observed process identity change.*attribution invalid/i
  )
  assert.match(
    text,
    /bootstrap.*before.*ready.*safety-only.*fresh stable pair.*local-request.*cumulative average/i
  )
  assert.match(
    text,
    /Response inbox seed, read, structured clone, and handoff.*external backend and transport-adapter timing.*recorded separately.*excluded from frontend product execution/i
  )
  assert.match(
    text,
    /prompt fill.*locator resolution.*actionability.*outside.*product boundary/i
  )
  assert.match(
    text,
    /App-owned request acceptance or dispatch.*starts local-request/i
  )
  assert.match(
    text,
    /no Playwright locator.*polling.*measured window.*App-owned O\(1\).*completion.*ends product timing.*UI.*after/i
  )
  assert.match(
    text,
    /each renderer PID.*250-millisecond.*CPU delta.*page-target CDP.*TaskDuration.*ScriptDuration.*LayoutDuration.*RecalcStyleDuration.*visible worker target.*residual renderer/i
  )
  assert.match(
    text,
    /required proof kind.*entire guarded invocation.*no later heartbeat can switch.*endpoint.*local-attribution/i
  )
  assert.match(
    text,
    /two-Actor 16-item.*operation.*Actor B.*complete.*10-second idle.*collaboration-attribution.*CDP.*threadTicks.*TaskDuration.*not.*complete Actor CPU/i
  )
  assert.match(
    text,
    /observed process identity change.*250-millisecond.*invalid.*unobserved sub-interval helper.*never.*sole owner-attribution/i
  )
  assert.match(
    text,
    /production performance profile.*O\(1\).*Render projection.*Factory publication.*history.*uncapped/i
  )
  assert.match(
    text,
    /ordinary Playwright.*excludes.*guard environment variables.*CPU sample.*hard timeout.*SIGINT.*SIGTERM.*SIGHUP.*fixed registered process groups/i
  )
  assert.match(
    text,
    /fixed.*test-harness.*client-browser.*app-server.*websocket-server.*one production preview.*one WebSocket server.*HMR.*absent.*200 percent.*separate.*role/i
  )
  assert.match(
    text,
    /endpoint complete heartbeat.*both Actors.*exactly complete.*local-attribution.*Actor A only.*no Actor B report.*never invents/i
  )
  assert.match(
    text,
    /CPU.*heartbeat.*terminate.*Playwright.*headless browser.*App server.*collaboration server/i
  )
  assert.match(
    text,
    /250[- ]milliseconds?.*interval CPU.*single.*above 200 percent.*immediately.*architecture attempt.*invalid/i
  )
  assert.match(text, /guard.*ready heartbeat.*before.*7,076-element request/i)
  assert.match(
    text,
    /both Actor contexts.*Actor A.*navigation.*collaboration ready.*before.*Actor B.*navigation.*collaboration ready.*before.*guard-ready heartbeat.*harness.*outside.*product timing/i
  )
  assert.match(
    text,
    /last completed phase.*Actor A.*Actor B.*element counts.*owner timing/i
  )
  assert.match(
    text,
    /precedes the first completed canonical Group.*does not claim which owner was active.*single-Actor 16-item cat-prefix[\s\S]*reduced-motion[\s\S]*single-Actor 1,280-item cat-prefix[\s\S]*two-Actor 1,280-item.*only when[\s\S]*selects exactly one next owner route/i
  )
  assert.match(text, /at most five.*same focused failure.*three/i)
  assert.match(
    feature,
    /Scenario: Each endpoint proves high-detail effectiveness without overwhelming the host[\s\S]*one 7076-element creation with no follow-up[\s\S]*warm-up, or repeat[\s\S]*Actor A[\s\S]*Actor B[\s\S]*CPU[\s\S]*above 200 percent[\s\S]*invalid architecture attempt[\s\S]*five/i
  )
  assert.match(
    feature,
    /uncapped Render projection element counts[\s\S]*production performance profile[\s\S]*O\(1\).*Factory publication/i
  )
  assert.match(
    feature,
    /fixed tracked roles.*test-harness.*client-browser.*app-server.*websocket-server[\s\S]*one production preview.*one WebSocket server[\s\S]*HMR.*absent[\s\S]*250-millisecond interval CPU[\s\S]*200 percent[\s\S]*separate role CPU/i
  )
  assert.match(
    feature,
    /periodic and phase-boundary sampling[\s\S]*one serialized OS sample queue[\s\S]*375 milliseconds[\s\S]*fail closed/i
  )
  assert.match(
    feature,
    /both Actor contexts[\s\S]*Actor A.*collaboration-ready[\s\S]*before Actor B.*navigation[\s\S]*Actor B.*collaboration-ready[\s\S]*before the ready heartbeat[\s\S]*outside.*product execution timing/i
  )
  assert.match(
    feature,
    /latest completed phase[\s\S]*currently active started phase[\s\S]*safety sample.*heartbeat age[\s\S]*request-wide cumulative process CPU-time boundary[\s\S]*ordered browser-monotonic owner spans[\s\S]*observed process identity change[\s\S]*attribution invalid[\s\S]*unobserved sub-interval helper[\s\S]*sole owner-attribution signal[\s\S]*precedes the first completed canonical Group[\s\S]*fresh browser invocation.*required fileId URL.*Collaboration session.*WebSocket server[\s\S]*single-Actor 16-item cat-prefix[\s\S]*reduced-motion[\s\S]*single-Actor 1280-item cat-prefix[\s\S]*two-Actor 1280-item.*only when[\s\S]*exactly one server-response boundary, Runtime, loading, local canonical, or receiver owner/i
  )
  assert.match(
    feature,
    /two-Actor 16-item[\s\S]*request[\s\S]*Actor B[\s\S]*canonical[\s\S]*Render[\s\S]*complete[\s\S]*idle for exactly 10 seconds[\s\S]*threadTicks[\s\S]*TaskDuration[\s\S]*main-thread task occupancy[\s\S]*complete Actor CPU[\s\S]*collaboration-attribution[\s\S]*accepted endpoint baseline/i
  )
  assert.match(
    feature,
    /production build commands.*separate setup[\s\S]*outside.*runtime guard[\s\S]*App runtime starts[\s\S]*App-owned request acceptance or dispatch.*operation timing/i
  )
  assert.match(
    feature,
    /response inbox adapter seed, read, structured clone, and handoff[\s\S]*external backend and transport timing[\s\S]*recorded separately[\s\S]*excluded from frontend product execution/i
  )
  assert.match(
    feature,
    /prompt fill, locator resolution, and actionability[\s\S]*outside.*product boundary/i
  )
  assert.match(
    feature,
    /App-owned request acceptance or dispatch[\s\S]*local-request[\s\S]*no Playwright locator, visibility, count, text, or attribute polling[\s\S]*O\(1\).*completion signal[\s\S]*UI assertions.*after/i
  )
  assert.match(
    feature,
    /each renderer PID[\s\S]*250-millisecond CPU delta[\s\S]*page-target CDP[\s\S]*visible worker targets[\s\S]*residual renderer/i
  )
  assert.match(
    plan,
    /178\s+percent[\s\S]*zero elements[\s\S]*zero publications/i
  )
  assert.match(
    plan,
    /210\.5[- ]percent[\s\S]*client-browser.*206 percent[\s\S]*one canonical element[\s\S]*empty document Workspace[\s\S]*not[\s\S]*AI\s+Group/i
  )
  assert.match(
    plan,
    /CPU sample[\s\S]*not a co-temporal snapshot[\s\S]*latest completed phase[\s\S]*prepare-composition-slices[\s\S]*does not yet exclude Group,\s+Core, publication, remote apply, or Render ownership/i
  )
  assert.match(
    plan,
    /both Actor contexts[\s\S]*Actor A[\s\S]*before Actor B navigation[\s\S]*guard-ready\s+heartbeat/i
  )
  assert.match(
    plan,
    /creation timing[\s\S]*excludes all staged harness bootstrap/i
  )
  assert.match(
    plan,
    /always-on 16-item[\s\S]*12,919 points[\s\S]*17\/17[\s\S]*2\.076 seconds[\s\S]*98\.829 percent[\s\S]*207\.7 percent[\s\S]*5\/17[\s\S]*decayed.*not.*250-millisecond/i
  )
  assert.match(
    plan,
    /234\.791 percent[\s\S]*renderer-or-worker[\s\S]*218\.873 percent[\s\S]*valid safety stop[\s\S]*invalid for product-owner selection[\s\S]*Playwright[\s\S]*Browser process/i
  )
  assert.match(
    plan,
    /bootstrap[\s\S]*safety-only[\s\S]*fresh stable pair[\s\S]*local-request[\s\S]*exact PID-set equality/i
  )
  assert.match(
    plan,
    /production build commands[\s\S]*separate\s+setup[\s\S]*outside.*runtime guard[\s\S]*(?:artifact attestation|attests.*artifact).*before.*Playwright[\s\S]*product\s+operation timing.*Actor A request submission/i
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
  const attributionRoutes = data.routes.filter(({ id }) =>
    id.startsWith('route-attribution-to-')
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
  assert.deepEqual(
    attributionRoutes.map(({ to }) => to).sort(),
    [
      'admit-receiver-publication-frames',
      'preload-file-scoped-server-response',
      'resolve-server-prepared-action-batch',
      'stage-local-interactive-composition',
      'yield-ai-loading-paint'
    ].sort()
  )
  attributionRoutes.forEach((route) =>
    assert.deepEqual(route.producedArtifacts, [
      'artifact:precanonical-owner-attribution'
    ])
  )
  assert.doesNotMatch(successRoute?.predicate ?? '', /resource.stop/i)
  assert.doesNotMatch(stopRoute?.predicate ?? '', /effective|success/i)
  assert.ok(
    attributionRoutes.every(({ predicate }) =>
      /CPU-time|reduced-motion|two-Actor control/i.test(predicate)
    )
  )

  const acceptedBaseline = data.artifacts.find(
    ({ id }) => id === 'artifact:accepted-endpoint-baseline'
  )
  assert.equal(acceptedBaseline?.ownerStepId, 'evaluate-endpoint-performance')
  assert.deepEqual(acceptedBaseline?.consumerStepIds, [
    'evaluate-endpoint-performance'
  ])
  assert.equal(acceptedBaseline?.terminal, false)
  const ownerAttribution = data.artifacts.find(
    ({ id }) => id === 'artifact:precanonical-owner-attribution'
  )
  assert.equal(ownerAttribution?.ownerStepId, 'evaluate-endpoint-performance')
  assert.deepEqual([...(ownerAttribution?.consumerStepIds ?? [])].sort(), [
    'admit-receiver-publication-frames',
    'preload-file-scoped-server-response',
    'resolve-server-prepared-action-batch',
    'stage-local-interactive-composition',
    'yield-ai-loading-paint'
  ])
  assert.equal(ownerAttribution?.terminal, false)
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
  assert.match(text, /exactly one.*async.*consumer.*settlement/i)
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
  assert.match(text, /point.*element-count.*budget/i)
  assert.match(text, /element-count budget capped at 64 per work unit/i)
  assert.match(
    text,
    /multiple deterministic plural Core batches.*one outer App transaction.*one intended history action/i
  )
  assert.match(
    text,
    /successful.*batch.*ordinary.*projection.*progress.*later browser task.*AbortSignal/i
  )
  assert.match(text, /CSS.*transform.*opacity.*compositor/i)
  assert.match(text, /atomic.*one all-children.*progressive.*multiple.*plural/i)
  assert.match(
    text,
    /production.*formal Conversational AI provider.*without an ai query.*progressive/i
  )
  assert.match(text, /clear.*success.*failure.*cancel.*rollback/i)
  assert.match(
    text,
    /App-owned document interaction lock.*before.*outer App transaction.*pan.*zoom.*block.*document mutation/i
  )
  assert.match(
    text,
    /viewport navigation.*ordinary Feature execution.*no canonical mutation.*history.*AI action.*transaction evidence/i
  )
  assert.doesNotMatch(text, /navigation.*never joins the AI transaction/i)
  assert.match(text, /release.*success.*failure.*cancel.*teardown/i)
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
      'apps/asyra-design/e2e/conversational-ai.spec.ts'
    )
  )
  assert.match(
    proofText,
    /one fresh single Actor.*Collaboration.*required fileId URL.*one 7,112-element.*one terminal exact canonical summary/i
  )
  assert.match(proofText, /connected DOM.*non-zero/i)
  assert.match(
    proofText,
    /longest canonical work unit.*cooperative yield count/i
  )
  assert.match(
    proofText,
    /Contents.*second Actor.*peer relay.*remote apply.*CRDT.*excluded.*client-to-server Collaboration transport.*server CPU.*separately.*No request-time response inbox access.*document IndexedDB.*repeated measured run/i
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'apply-canonical-property-scene-batch' &&
        route.producedArtifacts.includes('artifact:composition-batch-sequence')
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
    /production Asyra Design entry always uses the single formal[\s\S]*server-backed provider[\s\S]*no `ai` query.*activates, disables, or swaps[\s\S]*Ordinary startup selects progressive delivery/i
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
  assert.match(feature, /at most 64 elements per ordinary work unit/i)
  assert.match(plan, /64-element work-unit cap[\s\S]*2,048[\s\S]*8,192/i)
  assert.match(
    feature,
    /Scenario: Drawing progress keeps navigation responsive while edits stay locked[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*one Undo/i
  )
  assert.match(
    feature,
    /Scenario: Production App exposes one formal server-backed AI route without URL activation[\s\S]*ordinary production entry[\s\S]*progressive delivery/i
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
    /App-owned demo document session.*always start Collaboration.*without.*persistence provider.*capture.*save.*IndexedDB/i
  )
  assert.match(text, /load.*canonical empty document/i)
  assert.match(
    text,
    /required fileId URL.*document session identity.*always.*Collaboration.*fileId.*selects.*document.*never.*toggle/i
  )
  assert.match(
    text,
    /one connected Actor.*single-Actor.*second Actor.*same document session.*two-Actor.*CRDT/i
  )
  ;[
    'apps/asyra-design/src/render-app/collaboration-mode.ts',
    'apps/asyra-design/src/collaboration/lifecycle.ts',
    'apps/asyra-design/src/render-app/__tests__/collaboration-mode.test.ts',
    'apps/asyra-design/playwright.config.ts',
    'apps/asyra-design/__tests__/playwright-config.test.mjs',
    'scripts/dev-all-plan.js',
    'scripts/dev-all.js',
    'scripts/__tests__/workspace-automation.test.mjs'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    text,
    /root dev:all.*ordinary Playwright.*reference WebSocket server.*before.*App document connection/i
  )
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
    /Demo Client Persistence Bypass[\s\S]*required `fileId` URL[\s\S]*document session[\s\S]*always starts Collaboration[\s\S]*One connected Actor[\s\S]*single-Actor[\s\S]*second Actor[\s\S]*two-Actor CRDT[\s\S]*zero client persistence/i
  )
  assert.match(
    feature,
    /Scenario: Demo documents load empty without client persistence[\s\S]*required fileId URL[\s\S]*Collaboration[\s\S]*single-Actor[\s\S]*Actor B[\s\S]*IndexedDB/i
  )
  assert.match(
    feature,
    /Scenario: Required fileId selects the document without toggling Collaboration[\s\S]*required fileId URL[\s\S]*one Actor[\s\S]*single-Actor[\s\S]*second Actor[\s\S]*same fileId[\s\S]*CRDT/i
  )
  assert.match(
    feature,
    /root dev:all.*ordinary Playwright.*reference WebSocket server.*App/i
  )
})
