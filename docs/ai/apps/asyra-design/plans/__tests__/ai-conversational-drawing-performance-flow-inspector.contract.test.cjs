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
  assert.match(
    text,
    /background headless Chrome for Testing.*never steals.*desktop focus.*no CPU quota.*worker-count limit.*memory ceiling/i
  )
  assert.match(text, /workers: 1.*concurrent test cases.*never limits/i)
  assert.match(
    text,
    /maximum-detail-only rotating DevTools diagnostic.*fixed-capacity.*source locations.*approximation error/i
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
    'apps/asyra-design/src/ai/app-prompt.ts',
    'apps/asyra-design/src/ai/context.ts',
    'apps/asyra-design/src/ai/__tests__',
    'apps/asyra-design/src/startup.ts',
    'apps/asyra-design/src/toolbar/index.tsx',
    'apps/asyra-design/src/toolbar/__tests__/ai-control.test.tsx',
    'apps/asyra-design/src/app/ai-conversation-panel.tsx',
    'apps/asyra-design/src/app/__tests__/ai-conversation-panel.test.tsx',
    'apps/asyra-design/test-data/ai-drawing',
    'apps/asyra-design/e2e/prepared-server-response-artifacts.mjs',
    'apps/asyra-design/e2e/prepare-server-response-preview.mjs',
    'apps/asyra-design/e2e/server-response-inbox.ts',
    'apps/asyra-design/__tests__/prepared-server-response-artifacts.test.mjs',
    'apps/asyra-design/e2e/test-utils.ts',
    'apps/asyra-design/e2e/conversational-ai.spec.ts'
  ].forEach((boundary) =>
    assert.ok(providerOwner.implementationBoundary.includes(boundary), boundary)
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
    /former alternate action-preparation API[\s\S]*scheduling-oriented[\s\S]*identifiers[\s\S]*compatibility overloads.*deleted/i
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
    /compressed.*server response.*preview overlay.*before.*runtime guard.*Playwright.*payload/i
  )
  assert.match(
    text,
    /seed page.*fetch.*decompress.*IndexedDB.*bounded.*timing/i
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
  ;[
    'apps/asyra-design/src/ai/mode.ts',
    'apps/asyra-design/src/ai/mock-provider.ts',
    'apps/asyra-design/src/ai/mock-backend-response-store.ts',
    'apps/asyra-design/src/ai/fixtures',
    'apps/asyra-design/e2e/conversational-ai-mock.spec.ts',
    'apps/asyra-design/e2e/mock-backend-response-store.ts'
  ].forEach((staleBoundary) =>
    assert.ok(
      !owner.implementationBoundary.includes(staleBoundary),
      staleBoundary
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
    /File-scoped Server Response Inbox Contract[\s\S]*test\/manual harness[\s\S]*validat[\s\S]*normaliz[\s\S]*bounded summary[\s\S]*PreparedDrawingArtifact[\s\S]*IndexedDB response inbox[\s\S]*App and Agent readiness[\s\S]*At request time.*requestActionBatch\(\)[\s\S]*no artificial delay/i
  )
  assert.match(
    feature,
    /Scenario: Required fileId preloads one server response inbox record before App readiness[\s\S]*builds one PreparedDrawingArtifact.*outside the production bundle[\s\S]*IndexedDB response inbox adapter[\s\S]*canonical document.*empty[\s\S]*request-time response inbox access/i
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
    /server-prepared.*bounded redaction-ready summary.*PreparedDrawingArtifact/i
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
    /server validates.*normalize.*item.*path.*point.*PreparedDrawingArtifact.*Group descriptor.*child descriptor slices.*before App readiness.*front.?end.*submits.*createElementsInParent/i
  )
  assert.match(
    text,
    /production App.*one required.*server-backed.*runtime.*startup.*never nullable or optional/i
  )
  assert.match(
    text,
    /create-app template output parity.*deferred.*separate follow-up.*not an implementation boundary/i
  )
  assert.doesNotMatch(
    text,
    /providerEnabled|optional AI runtime|nullable runtime|product delivery-mode switch/i
  )
  ;[
    'packages/ai-agent-runtime/src',
    'packages/ai-agent-runtime/src/__tests__',
    'apps/asyra-design/package.json',
    'apps/asyra-design/src/index.tsx',
    'apps/asyra-design/src/startup.ts',
    'apps/asyra-design/src/features/ai-agent/index.ts',
    'apps/asyra-design/src/features/ai-agent/__tests__/index.test.ts',
    'apps/asyra-design/src/init/init-app.ts',
    'apps/asyra-design/src/init/__tests__/init-app.test.ts',
    'apps/asyra-design/src/init/foundation/init-features.ts',
    'apps/asyra-design/src/init/foundation/__tests__/init-features.test.ts',
    'apps/asyra-design/src/ai/actions.ts',
    'apps/asyra-design/src/ai/runtime-input.ts',
    'apps/asyra-design/src/ai/startup.ts',
    'apps/asyra-design/src/ai/conversation.ts',
    'apps/asyra-design/src/ai/presentation.ts',
    'apps/asyra-design/src/ai/confirmation.ts',
    'apps/asyra-design/src/ai/__tests__',
    'apps/asyra-design/src/app/index.tsx',
    'apps/asyra-design/src/app/__tests__',
    'apps/asyra-design/src/toolbar/index.tsx',
    'apps/asyra-design/src/toolbar/__tests__/ai-control.test.tsx',
    'docs/ai/framework/packages/ai-agent-runtime.md',
    'docs/ai/framework/golden-paths/compose-ai-agent-runtime.md',
    'docs/examples/ai-agent-runtime.mjs'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.equal(
    owner.implementationBoundary.some((boundary) =>
      boundary.startsWith('create-app/asyra-design/template')
    ),
    false
  )
  ;[
    'apps/asyra-design/src/ai/composition.ts',
    'apps/asyra-design/src/ai/prepared-composition.ts',
    'create-app/asyra-design/template/src/ai/composition.ts',
    'create-app/asyra-design/template/e2e/conversational-ai-mock.spec.ts',
    'create-app/asyra-design/template/e2e/collaboration-ai-agent-video.spec.ts'
  ].forEach((staleBoundary) =>
    assert.ok(
      !owner.implementationBoundary.includes(staleBoundary),
      staleBoundary
    )
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
    /backend-facing `inputSchema`[\s\S]*no client-side action[\s\S]*schema.*parse.*prepare[\s\S]*PreparedDrawingArtifact[\s\S]*submits each already-prepared[\s\S]*cooperative slice/i
  )
  assert.match(
    plan,
    /action-definition contract receives no large-payload, validation,[\s\S]*delivery, scheduling, loading, or collaboration control/i
  )
  assert.match(
    feature,
    /Scenario: Runtime resolves one server-prepared AiActionBatch without client model validation[\s\S]*requestActionBatch\(\)[\s\S]*resolveAiActionBatch\(\)[\s\S]*control envelope[\s\S]*inputSchema[\s\S]*same action arguments identity[\s\S]*bounded summaries.*without items, paths, points, or complete geometry[\s\S]*local, noncanonical, and nonshared/i
  )
  assert.match(
    feature,
    /test or manual harness.*validates, normalizes[\s\S]*outside the production bundle[\s\S]*before App navigation[\s\S]*resident before App readiness/i
  )
  assert.match(feature, /server-prepared action.*PreparedDrawingArtifact/i)
  assert.match(
    feature,
    /front end should perform no item, path, or point validation or drawing-artifact encoding/i
  )
  assert.match(
    feature,
    /submitting only the next prepared progressive descriptor slice/i
  )
  assert.match(plan, /converted 252\.599-millisecond interval report/i)
  assert.match(plan, /221\.695 percent aggregate CPU/i)
  assert.match(plan, /201\.901 percent to one renderer PID/i)
  assert.match(
    plan,
    /converted percentages are invalid formal CPU peak and stop\s+evidence/i
  )
  assert.match(plan, /At the stop Actor A remained\s+at 0\/17/i)
  assert.match(
    plan,
    /superseded fixed 650-millisecond artificial delay[\s\S]*Runtime then synchronously calls the registered action schema/i
  )
})

test('latest guarded source evidence requires prepared descriptors before high detail', () => {
  const runtimeOwner = step('resolve-server-prepared-action-batch')
  const stageOwner = step('stage-local-interactive-composition')
  const proofOwner = step('evaluate-endpoint-performance')
  const runtimeText = contractText(runtimeOwner)
  const stageText = contractText(stageOwner)
  const proofText = contractText(proofOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /16-item[\s\S]*12,919 points[\s\S]*eight prepared slices[\s\S]*Runtime pre-execute[\s\S]*less\s+than\s+1 millisecond/i
  )
  assert.match(
    runtimeText,
    /Group descriptor.*child descriptor slices.*complete source creation data/i
  )
  assert.match(
    stageText,
    /existing.*Core\.createElementsInParent.*Group.*paint opportunity.*before.*child batch/i
  )
  assert.match(proofText, /guarded 16-item.*must pass.*before.*7,076-element/i)
  assert.match(
    feature,
    /Scenario: Guarded prepared-descriptor source proof precedes high-detail execution[\s\S]*12919 points[\s\S]*eight prepared slices[\s\S]*Runtime pre-execute[\s\S]*less than 1 millisecond[\s\S]*Group[\s\S]*paint opportunity[\s\S]*children[\s\S]*guarded 7076/i
  )
})

test('nonvisual system state and workspace identity queries avoid full Canvas work', () => {
  const canonicalOwner = step('apply-canonical-property-scene-batch')
  const projectionOwner = step('project-visible-canonical-slices')
  const canonicalText = contractText(canonicalOwner)
  const projectionText = contractText(projectionOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    projectionText,
    /render-affecting system property.*schedule.*Canvas.*nonvisual system property.*no Canvas invalidation/i
  )
  assert.match(
    canonicalText,
    /workspace id query.*constant-time.*never.*save.*serialize.*Scene Tree/i
  )
  assert.match(
    plan,
    /System Property and Workspace Query Boundary[\s\S]*render-affecting[\s\S]*nonvisual[\s\S]*Canvas invalidation[\s\S]*workspace id[\s\S]*constant-time[\s\S]*Scene Tree.*save/i
  )
  assert.match(
    feature,
    /Scenario: Nonvisual system state and workspace identity queries stay bounded[\s\S]*nonvisual system property[\s\S]*no Canvas invalidation[\s\S]*workspace id[\s\S]*Scene Tree.*save/i
  )
})

test('Factory reuses existing action history and exposes only the minimal wire artifact', () => {
  const factoryOwner = step('record-and-deliver-transaction-batch')
  const canonicalOwner = step('apply-canonical-property-scene-batch')
  const projectionOwner = step('project-visible-canonical-slices')
  const codecOwner = step('encode-publication-frames')
  const receiverOwner = step('admit-receiver-publication-frames')
  const remoteOwner = step('apply-remote-publication-batches')
  const factoryText = contractText(factoryOwner)
  const canonicalText = contractText(canonicalOwner)
  const projectionText = contractText(projectionOwner)
  const codecText = contractText(codecOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )
  const localOwnerBatch = data.artifacts.find(
    ({ id }) => id === 'artifact:local-canonical-owner-batch'
  )
  const wireArtifact = data.artifacts.find(
    ({ id }) => id === 'artifact:transport-publication-batch'
  )

  assert.equal(
    data.artifacts.some(
      ({ id }) => id === 'artifact:factory-mutation-batch-artifact'
    ),
    false
  )
  assert.equal(
    localOwnerBatch?.ownerStepId,
    'apply-canonical-property-scene-batch'
  )
  assert.deepEqual(localOwnerBatch?.consumerStepIds, [
    'project-visible-canonical-slices',
    'evaluate-performance-and-equivalence'
  ])
  assert.equal(
    wireArtifact?.ownerStepId,
    'record-and-deliver-transaction-batch'
  )
  assert.deepEqual(wireArtifact?.consumerStepIds, ['encode-publication-frames'])
  assert.equal(
    data.artifacts.some(
      ({ id }) => id === 'artifact:shared-publication-batches'
    ),
    false
  )
  assert.match(
    factoryText,
    /existing Factory transaction journal.*Undo stack.*minimal transport wire artifact.*without creating a parallel AI\/bulk history model/i
  )
  assert.match(
    factoryText,
    /no AI\/bulk-specific forward\/inverse artifact.*parallel applied-result mirror.*action-completion snapshot/i
  )
  assert.match(
    factoryText,
    /no post-action save.*isEqual.*finalize-save.*full-document comparison.*evidence clone/i
  )
  assert.match(
    factoryText,
    /canonical owner issues.*frozen Props-then-Scene outer container.*checks only frozen transaction structural roots.*exact outer identity.*never traverses nested geometry.*external shallow-frozen batches remain isolated/i
  )
  assert.match(
    `${canonicalText} ${projectionText}`,
    /local-canonical-owner-batch.*ordinary local and remote canonical owner batches.*without History evidence/i
  )
  assert.match(
    `${factoryText} ${codecText}`,
    /one remote-apply payload.*ordered ids.*publication metadata.*no inverseEvents.*history.*alias/i
  )
  assert.match(
    factoryText,
    /SharedPublication.*publicationId.*artifactId.*transactionId.*origin.*mode.*ordered slices.*channel batches.*remote-apply deliveries/i
  )
  assert.match(
    factoryText,
    /sliceId.*orderedIds.*batchId.*channel.*deliveryId.*eventName.*payload.*compensatesDeliveryId/i
  )
  assert.match(
    factoryText,
    /changes atomically.*never contains parallel old and new publication shapes.*compatibility conversion.*optional legacy aliases/i
  )
  assert.match(
    contractText(remoteOwner),
    /source slices.*batches.*delivery order.*batch-to-slice membership.*one linear pass.*without rescanning slices or merging publications/i
  )
  assert.match(
    plan,
    /Factory Existing History and Transport Wire Contract[\s\S]*existing transaction journal[\s\S]*no\s+`FactoryMutationBatchArtifact`[\s\S]*post-action `save`[\s\S]*one remote-apply payload[\s\S]*inverseEvents[\s\S]*History[\s\S]*alias/i
  )
  assert.match(
    feature,
    /Scenario: Factory reuses existing action history and emits only a minimal wire artifact[\s\S]*only local action-history owners[\s\S]*post-action save[\s\S]*inverseEvents[\s\S]*History[\s\S]*atomically[\s\S]*compatibility conversion/i
  )
  ;[
    'packages/factory/src/mutation-batch.ts',
    'packages/factory/src/shared-delivery.ts',
    'packages/factory/src/shared-data-channel.ts',
    'packages/scene-tree/src/sceneTree.ts',
    'packages/scene-tree/src/__tests__/sceneTree.test.ts',
    'packages/collaboration/src/cloning.ts',
    'packages/collaboration/src/providers/memory/hub.ts',
    'packages/collaboration/src/providers/memory/provider.ts',
    'apps/asyra-design/src/collaboration/factory-adapter.ts',
    'apps/asyra-design/src/collaboration/protocol.ts',
    'apps/asyra-design/src/collaboration/operations.ts',
    'create-app/asyra-design/template/src/collaboration'
  ].forEach((boundary) =>
    assert.ok(factoryOwner.implementationBoundary.includes(boundary), boundary)
  )
  ;[
    'apps/asyra-design/src/collaboration/protocol.ts',
    'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
    'apps/asyra-design/src/collaboration/collaboration-transport-worker.ts'
  ].forEach((boundary) =>
    assert.ok(codecOwner.implementationBoundary.includes(boundary), boundary)
  )
  assert.ok(
    receiverOwner.implementationBoundary.includes(
      'apps/asyra-design/src/collaboration/websocket-provider.ts'
    )
  )
  ;[
    'apps/asyra-design/src/collaboration/factory-adapter.ts',
    'apps/asyra-design/src/collaboration/operations.ts'
  ].forEach((boundary) =>
    assert.ok(remoteOwner.implementationBoundary.includes(boundary), boundary)
  )
})

test('codec refactor and guarded 16-item proof precede receiver, remote, relay, and 7076', () => {
  const wireOrder = new Map(
    data.steps
      .filter(({ laneId }) => laneId === 'wire-transport')
      .map(({ id, order }) => [id, order])
  )
  const proofText = contractText(step('evaluate-endpoint-performance'))
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.equal(wireOrder.get('encode-publication-frames'), 1)
  assert.equal(wireOrder.get('admit-receiver-publication-frames'), 2)
  assert.equal(wireOrder.get('apply-remote-publication-batches'), 3)
  assert.equal(wireOrder.get('relay-frames-with-backpressure'), 4)
  assert.match(proofText, /guarded 16-item.*before.*guarded 7,076-element/i)
  assert.match(
    plan,
    /encode-publication-frames[\s\S]*guarded 16-item[\s\S]*admit-receiver-publication-frames[\s\S]*apply-remote-publication-batches[\s\S]*relay-frames-with-backpressure[\s\S]*guarded 7,076/i
  )
  assert.match(
    feature,
    /Scenario: Wire owners advance from codec through guarded small proof[\s\S]*encode[\s\S]*guarded 16-item[\s\S]*receiver[\s\S]*remote apply[\s\S]*relay[\s\S]*guarded 7076/i
  )
})

test('production contract identifiers avoid governance and test-source vocabulary', () => {
  const productionIdentifiers = [
    data.target.id,
    ...data.steps.flatMap(({ id, title, outputs }) => [id, title, ...outputs]),
    ...data.routes.map(({ id }) => id),
    ...data.artifacts.flatMap(({ id, channel }) => [id, channel])
  ].join(' ')
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.doesNotMatch(
    productionIdentifiers,
    /\bplan(?:s|ned|ning)?\b|\bmock\b|\bfake\b|\bsimulat(?:e|ed|ion|or)\b/i
  )
  assert.match(
    plan,
    /production identifiers[\s\S]*action batch[\s\S]*drawing artifact[\s\S]*canonical batch[\s\S]*wire artifact[\s\S]*never[\s\S]*plan[\s\S]*Mock[\s\S]*fake[\s\S]*simulated/i
  )
  assert.match(
    feature,
    /production identifiers.*action batch.*drawing artifact.*canonical batch.*wire artifact.*not.*plan.*Mock.*fake.*simulated/i
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
    /pan.*zoom.*canonical.*computed.*render-affecting system property.*schedule.*Canvas.*nonvisual system property.*no Canvas invalidation/i
  )
  assert.match(
    text,
    /every Group expanded.*virtualizes.*canonical id order.*only mounted rows.*ancestor path.*collapsed Group.*complete visibility projection/i
  )
  ;[
    'packages/core/src/core.ts',
    'packages/core/src/__tests__',
    'packages/render-engine/src',
    'packages/render-engine/src/__tests__',
    'packages/render-engine-pixi/src',
    'packages/render-engine-pixi/src/__tests__',
    'apps/asyra-design/src/contents/layer-hierarchy.ts',
    'apps/asyra-design/src/contents/__tests__/layer-hierarchy.test.ts',
    'apps/asyra-design/src/contents/contents-panel.tsx',
    'apps/asyra-design/src/contents/__tests__/contents-panel.test.tsx',
    'create-app/asyra-design/template/src/contents/layer-hierarchy.ts',
    'create-app/asyra-design/template/src/contents/__tests__/layer-hierarchy.test.ts',
    'create-app/asyra-design/template/src/contents/contents-panel.tsx',
    'create-app/asyra-design/template/src/contents/__tests__/contents-panel.test.tsx'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    plan,
    /Demand-driven render frame ownership[\s\S]*before the receiver\s+endpoint/i
  )
  assert.match(
    feature,
    /Scenario: Settled canvas schedules only demanded frames[\s\S]*zero elements[\s\S]*Pixi Application ticker[\s\S]*pan, zoom, canonical, computed, or render-affecting system property[\s\S]*animation/i
  )
})

test('each ranked endpoint closes through the guarded proof schedule', () => {
  const owner = step('evaluate-endpoint-performance')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /Demand-driven render frame ownership[\s\S]*Canonical Props, Scene Tree, and Core source mutation[\s\S]*Factory existing action history and transport wire delivery[\s\S]*Codec encode and decode ownership[\s\S]*Receiver provider and worker handoff[\s\S]*Remote apply and main-thread organization[\s\S]*Relay and byte backpressure[\s\S]*Visible canonical and UI projection/i
  )
  assert.match(
    plan,
    /complete endpoint refactor[\s\S]*one guarded 7,000-plus production/i
  )
  assert.match(
    plan,
    /One design hypothesis receives at most five materially revised architecture\s+attempts/i
  )
  assert.match(
    text,
    /guarded 16-item.*after each completed endpoint refactor.*exactly one production two-Actor 7,076-element.*named local-source, relay, and final checkpoints/i
  )
  assert.match(
    text,
    /latest completed phase.*currently active started phase.*capture time.*Actor A.*Actor B.*canonical element count.*safety-signal sample time.*heartbeat age.*co-temporal/i
  )
  assert.match(
    text,
    /bounded operating-system ps snapshot.*PID, PPID, PGID.*without supplying formal CPU percentages.*Darwin top.*exact PIDs.*long-lived unreported guard-process anchor.*two bounded pid,cpu tables.*initialization table is ignored.*second current percent-CPU table.*exact still-live test-owned identities.*anchor plus untracked system PIDs are ignored.*1,000 milliseconds.*not a measurement window.*never.*CPU-percentage formula.*raw same-snapshot.*500 percent.*7,076-element.*250 percent.*16-item.*1,280-item.*aggregate.*500 percent.*7,076-element.*400 percent.*16-item.*1,280-item/i
  )
  assert.match(
    text,
    /subtracting cumulative process CPU time.*dividing by wall time.*normalizing to polling cadence.*averaging snapshots.*converted percentage.*formal CPU peak.*stop decision/i
  )
  assert.doesNotMatch(
    text,
    /establish(?:es)? the 250-millisecond interval CPU signal|complete client-browser interval above 250 percent|aggregate frontend, backend, and harness interval above 400 percent/i
  )
  assert.doesNotMatch(
    feature,
    /complete client-browser interval above 250 percent|aggregate frontend, backend, and harness interval above 400 percent|each renderer PID should retain its own 250-millisecond CPU delta/i
  )
  assert.match(
    text,
    /production build commands.*separate setup.*outside.*runtime guard.*product timing.*artifact attestation.*before.*Playwright/i
  )
  assert.match(
    text,
    /production artifact attestation.*separate.*response overlay attestation.*before.*Playwright/i
  )
  assert.match(
    text,
    /preview overlay.*production dist.*server response.*production deployment/i
  )
  assert.match(
    text,
    /periodic.*phase-boundary.*one serialized.*OS sample.*no overlapping.*out-of-order/i
  )
  assert.match(
    text,
    /7,000-millisecond gap.*successfully completed raw observations.*two adjacent serialized requests.*3,000-millisecond command deadlines.*fail.*closed.*never constructs.*average.*changes.*raw percent-CPU/i
  )
  assert.match(
    text,
    /single-Actor attribution invocation.*fresh client-a-browser process group.*required fileId URL.*Collaboration session.*WebSocket server.*no Actor B or client-b-browser/i
  )
  assert.match(
    text,
    /request-wide cumulative OS process CPU-time milliseconds.*non-percentage diagnostic.*never converts.*CPU percent.*ordered browser-monotonic.*inner owner attribution/i
  )
  assert.match(
    text,
    /phase-boundary sample.*active proof-class raw same-snapshot frontend evaluation.*500 percent.*7,076-element.*250 percent.*16-item and 1,280-item.*aggregate safety evaluation.*500 percent.*7,076-element.*400 percent.*16-item and 1,280-item.*exact PID set equality.*observed process identity change.*attribution invalid/i
  )
  assert.match(
    text,
    /valid terminal complete heartbeat.*product proof window is closed.*Chrome teardown process-identity changes cannot create a resource stop or invalidate the accepted proof.*process-group termination.*confirmed/i
  )
  assert.match(
    text,
    /bootstrap before ready.*safety-only.*complete raw system snapshot.*local-request.*maximum raw frontend system value/i
  )
  assert.match(
    text,
    /in-page interaction evidence.*event-driven observation.*fixed bounded frame handoff.*never.*recursive requestAnimationFrame polling loop.*second per-frame workload/i
  )
  assert.match(
    text,
    /Playwright progress observation.*one O\(1\) scalar sample.*each Actor.*five seconds[\s\S]*1,000-millisecond current raw operating-system sampler.*ten-second heartbeat.*twenty-second progress.*unchanged/i
  )
  assert.match(
    text,
    /phase-boundary HTTP handoff.*7,000-millisecond client deadline.*one serialized 3,000-millisecond current-CPU sample.*own 3,000-millisecond sample.*heartbeat and resource-status.*3,000 milliseconds.*never extends product execution.*300-second CRDT flow/i
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
    /maximum raw frontend system value.*product window.*no Playwright locator.*polling.*App-owned O\(1\).*completion.*ends product timing.*UI.*after/i
  )
  assert.match(
    text,
    /each renderer PID.*raw same-snapshot system percent.*page-target CDP.*TaskDuration.*ScriptDuration.*LayoutDuration.*RecalcStyleDuration.*visible worker target.*residual renderer/i
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
    /observed process identity change before an accepted terminal heartbeat.*attribution invalid.*raw OS CPU.*never.*sole owner-attribution/i
  )
  assert.match(
    text,
    /production performance profile.*O\(1\).*Render projection.*Factory publication.*history.*uncapped/i
  )
  assert.match(
    text,
    /ordinary Playwright.*excludes.*guard environment variables.*raw system snapshot.*hard timeout.*SIGINT.*SIGTERM.*SIGHUP.*fixed registered process groups/i
  )
  assert.match(
    text,
    /fixed.*test-harness.*client-a-browser.*client-b-browser.*app-server.*websocket-server.*single-Actor.*omits.*client-b-browser.*one production preview.*one WebSocket server.*HMR.*absent/i
  )
  assert.match(
    text,
    /Actor A and Actor B.*separate highest complete raw frontend snapshots.*backend and harness CPU enter neither Actor peak.*aggregate stop evaluation.*proof-class violation report/i
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
    /single raw operating-system snapshot.*complete Actor A or complete Actor B browser sum.*per-Actor proof-class limit.*500 percent.*7,076-element.*250 percent.*16-item and 1,280-item.*aggregate both-Actor frontend\/backend\/harness.*500 percent.*7,076-element.*400 percent.*16-item and 1,280-item.*immediately.*architecture attempt invalid/i
  )
  assert.match(text, /guard.*ready heartbeat.*before.*7,076-element request/i)
  assert.match(
    text,
    /Actor A and Actor B.*independently launched Chromium process groups.*Actor A.*navigation.*Collaboration readiness.*two fresh raw samples.*before Actor B is launched.*Actor B.*navigation.*Collaboration readiness.*both Actors.*two fresh settled samples.*before.*guard-ready heartbeat.*harness.*outside.*product timing/i
  )
  assert.match(
    text,
    /Bootstrap settled status.*read-only authenticated guard view.*latest raw operating-system sample.*requested Actor browser role.*observation-gap ceiling.*80-percent idle baseline.*never excludes startup CPU.*fixed sleep/i
  )
  assert.match(
    text,
    /last completed phase.*Actor A.*Actor B.*element counts.*owner timing/i
  )
  assert.match(
    text,
    /precedes the first completed canonical Group.*does not claim which owner was active.*single-Actor 16-item cat-prefix[\s\S]*reduced-motion[\s\S]*single-Actor 1,280-item cat-prefix[\s\S]*two-Actor 1,280-item.*only when[\s\S]*selects exactly one next owner route/i
  )
  assert.match(
    text,
    /two-Actor 1,280-item.*resource stop[\s\S]*one two-Actor 320-item fallback[\s\S]*same 250-percent frontend and 400-percent aggregate guards[\s\S]*page-target operation window/i
  )
  assert.match(
    text,
    /one design hypothesis.*at most five.*same focused failure three times.*resource stop.*time ceiling.*bounded root-cause analysis.*new owner iteration.*does not stop the overall task/i
  )
  assert.match(
    text,
    /300-second product-flow deadline.*360-second guarded Playwright ceiling.*terminates the current benchmark action.*never terminates the implementation task.*first blocker.*root-cause analysis.*new iteration.*before any downstream owner/i
  )
  assert.match(
    text,
    /failed or timed-out endpoint.*bounded final diagnostics.*Actor A.*Actor B.*top 24 phases.*guard failure report.*next owner/i
  )
  assert.match(
    text,
    /pre-stall owner snapshot.*two consecutive five-second.*Actor B.*top 24.*guard emergency report.*before termination.*does not change.*progress-stale/i
  )
  assert.match(
    text,
    /accepted request-ready.*creation-start heartbeat.*no dual-page sample.*dispatch.*first dual-Actor scalar sample.*five-second heartbeat/i
  )
  assert.match(
    text,
    /initial history baseline.*before request-ready.*loading at zero.*event-first.*first visible canonical element.*bounded frame handoff.*pan and zoom.*blocked input.*turn remains active/i
  )
  assert.match(
    text,
    /Independent loading-time interaction proofs.*pan after first visible.*zoom after 25-percent.*rectangle shortcut and button lock after 50 percent.*Delete plus Undo lock after 75 percent.*mutation-driven.*bounded frame.*no fixed delay/i
  )
  assert.match(
    text,
    /hard CRDT product-flow deadline.*300 seconds.*Playwright ceiling.*360 seconds.*cannot preempt/i
  )
  assert.match(
    text,
    /maximum-detail 27,471-element 295,794-point gate.*300 seconds.*250-percent single-Actor frontend.*400-percent aggregate current-CPU limits/i
  )
  assert.match(
    feature,
    /Scenario: Each named endpoint checkpoint proves high-detail effectiveness without overwhelming the host[\s\S]*explicit product-owner approval.*7076-element creation[\s\S]*warm-up, or repeat[\s\S]*Actor A[\s\S]*Actor B[\s\S]*7076-element high-performance case.*500-percent[\s\S]*16-item and 1280-item.*250 percent[\s\S]*raw same-snapshot aggregate.*500 percent.*7076[\s\S]*400 percent.*16-item and 1280-item[\s\S]*invalid architecture attempt[\s\S]*stop the current benchmark action without stopping the implementation task[\s\S]*root cause[\s\S]*new iteration[\s\S]*five materially revised architecture attempts[\s\S]*rather than stopping the task/i
  )
  assert.match(
    text,
    /exact guarded 7,076-element creation-only endpoint.*high-performance test.*500-percent raw same-snapshot limit for each independently launched complete Actor browser process group.*500-percent raw same-snapshot aggregate.*16-item and 1,280-item.*250-percent per-Actor frontend.*400-percent aggregate/i
  )
  assert.match(
    feature,
    /Scenario: Revised high-performance threshold requires a corrected local-source proof[\s\S]*251\.7 percent[\s\S]*259\.0 percent[\s\S]*500-percent frontend and aggregate limits[\s\S]*not be accepted as a limit violation or completed endpoint proof[\s\S]*250-percent frontend limit[\s\S]*400-percent aggregate hard safety limit[\s\S]*before remote apply advances/i
  )
  assert.match(
    feature,
    /uncapped Render projection element counts[\s\S]*production performance profile[\s\S]*O\(1\).*Factory publication/i
  )
  assert.match(
    feature,
    /fixed two-Actor tracked roles.*test-harness.*client-a-browser.*client-b-browser.*app-server.*websocket-server[\s\S]*independently launched Chromium process groups[\s\S]*one production preview.*one WebSocket server[\s\S]*HMR.*absent[\s\S]*bounded operating-system ps snapshot[\s\S]*Darwin top[\s\S]*unreported guard-process anchor[\s\S]*second current raw percent-CPU table.*exact still-live test-owned identities[\s\S]*1,000-millisecond polling cadence[\s\S]*never become a measurement window[\s\S]*7076-element high-performance case.*500-percent[\s\S]*16-item and 1280-item.*250 percent per Actor[\s\S]*aggregate.*500 percent.*7076[\s\S]*400 percent.*16-item and 1280-item[\s\S]*separate role CPU/i
  )
  assert.match(
    feature,
    /CRDT product flow.*Actor A request.*Actor B convergence.*300-second deadline[\s\S]*Playwright test.*360-second ceiling.*cannot preempt/i
  )
  assert.match(
    feature,
    /periodic and phase-boundary sampling[\s\S]*one serialized OS sample queue[\s\S]*3,000 milliseconds[\s\S]*fail closed/i
  )
  assert.match(
    feature,
    /Actor A.*collaboration-ready.*two fresh raw settled samples.*before.*Actor B browser is launched[\s\S]*Actor B.*collaboration-ready.*both Actors.*two fresh raw settled samples.*before the ready heartbeat[\s\S]*fixed sleep/i
  )
  assert.match(
    feature,
    /latest completed phase[\s\S]*currently active started phase[\s\S]*safety sample.*heartbeat age[\s\S]*request-wide cumulative process CPU-time boundary.*direct non-percentage milliseconds[\s\S]*ordered browser-monotonic owner spans[\s\S]*observed process identity change[\s\S]*attribution invalid[\s\S]*raw operating-system CPU.*never.*sole owner-attribution signal[\s\S]*precedes the first completed canonical Group[\s\S]*fresh browser invocation.*required fileId URL.*Collaboration session.*WebSocket server[\s\S]*single-Actor 16-item cat-prefix[\s\S]*reduced-motion[\s\S]*single-Actor 1280-item cat-prefix[\s\S]*two-Actor 1280-item.*only when[\s\S]*exactly one server-response boundary, Runtime, loading, local canonical, or receiver owner/i
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
    /each renderer PID[\s\S]*raw same-snapshot system percent-CPU value[\s\S]*page-target CDP[\s\S]*visible worker targets[\s\S]*residual renderer/i
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
    /210\.5-percent CPU sample and the retained Actor\s+counts were therefore not a co-temporal snapshot/i
  )
  assert.match(
    plan,
    /latest completed phase was\s+`ai-app:prepare-composition-slices`/i
  )
  assert.match(
    plan,
    /does not exclude\s+Group, Core, publication, remote apply, or Render ownership/i
  )
  assert.match(
    plan,
    /Actor A[\s\S]*two fresh raw settled samples[\s\S]*before[\s\S]*Actor B browser\s+is launched[\s\S]*guard-ready\s+heartbeat/i
  )
  assert.match(
    plan,
    /creation timing[\s\S]*excludes all staged harness bootstrap/i
  )
  assert.match(
    plan,
    /always-on 16-item guard correction[\s\S]*12,919 points[\s\S]*17\/17 canonical[\s\S]*2\.076 seconds[\s\S]*98\.829 percent average core use/i
  )
  assert.match(
    plan,
    /decayed raw system value was evaluated against the then-active\s+200-percent\s+aggregate threshold/i
  )
  assert.match(
    plan,
    /historical\s+safety evidence only: it is below the current 250-percent frontend and\s+400-percent aggregate limits/i
  )
  assert.match(
    plan,
    /historical\s+251\.287-millisecond converted interval report at 234\.791 percent aggregate CPU/i
  )
  assert.match(
    plan,
    /converted browser contribution was 218\.873 percent for the coarse\s+`renderer-or-worker` bucket[\s\S]*converted percentages are invalid formal CPU peak and stop evidence/i
  )
  assert.match(
    plan,
    /invalid for product-owner selection[\s\S]*Playwright[\s\S]*Browser process/i
  )
  assert.match(
    plan,
    /bootstrap[\s\S]*safety-only[\s\S]*complete raw system snapshot[\s\S]*local-request[\s\S]*exact PID-set equality/i
  )
  assert.match(
    plan,
    /raw CPU contract correction checkpoint[\s\S]*converted 397\.203-percent frontend[\s\S]*401\.175-percent aggregate[\s\S]*raw system\s+values were 199\.4 percent[\s\S]*209\.2 percent[\s\S]*neither user-defined limit was crossed[\s\S]*explicit product-owner approval/i
  )
  assert.match(
    text,
    /converted 397\.203-percent frontend.*401\.175-percent aggregate.*invalid evidence.*raw same-snapshot frontend and aggregate values were 199\.4 and 209\.2 percent.*no accepted baseline or architecture-attempt count.*cannot select a CRDT owner/i
  )
  assert.match(
    feature,
    /Scenario: Converted CPU-time percentages cannot consume a high-detail proof[\s\S]*raw same-snapshot frontend value of 199\.4 percent[\s\S]*raw same-snapshot aggregate value of 209\.2 percent[\s\S]*converted 397\.203-percent frontend value and 401\.175-percent aggregate value.*rejected[\s\S]*no accepted baseline, architecture-attempt count, or next-owner selection[\s\S]*explicit product-owner approval/i
  )
  assert.match(
    plan,
    /Production build commands are now a separate\s+setup outside the runtime guard and all product timing/i
  )
  assert.match(
    plan,
    /runtime pipeline\s+attests the already-built endpoint artifact before Playwright starts/i
  )
  assert.match(
    plan,
    /product operation timing began only\s+at Actor A request submission/i
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
  assert.equal(successRoute?.to, 'evaluate-performance-and-equivalence')
  const endpointProofArtifact = data.artifacts.find(
    ({ id }) => id === 'artifact:endpoint-performance-proof'
  )
  assert.deepEqual(endpointProofArtifact?.consumerStepIds, [
    'evaluate-performance-and-equivalence'
  ])
  assert.equal(endpointProofArtifact?.terminal, false)
  assert.ok(
    data.steps
      .find(({ id }) => id === 'evaluate-performance-and-equivalence')
      ?.inputs.includes('artifact:endpoint-performance-proof')
  )
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
    'apps/asyra-design/e2e/prepared-server-response-artifacts.mjs',
    'apps/asyra-design/e2e/prepare-server-response-preview.mjs',
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
    /receiver-handoff timing.*starts only after.*decoded candidate.*closes after.*publication-delivery.*excludes.*codec.*queue/i
  )
  assert.match(
    text,
    /frame-consumed credit.*only when.*leaves the retained byte window.*App handoff.*independently.*App policy.*canonical apply succeeds/i
  )
  assert.match(
    text,
    /Slow App apply.*fill but cannot overrun.*retained byte window.*no fabricated wire credit.*handoff releases.*before.*App apply begins/i
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
  assert.match(
    codecText,
    /Prepared compact-binary metadata and delivery segments.*directly.*final frame allocation.*without.*intermediate full-publication payload copy/i
  )
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
  const contentsOwner = step('project-scrollable-contents-window')
  const proofOwner = step('evaluate-endpoint-performance')
  const text = contractText(owner)
  const contentsText = contractText(contentsOwner)
  const proofText = contractText(proofOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )
  assert.equal(
    data.steps.some(({ id }) => id === 'evaluate-local-interactive-drawing'),
    false
  )

  assert.match(
    text,
    /server-prepared Group and child descriptors.*exact bounds[\s\S]*runtime-only.*loading.*DOM.*paint opportunity.*before.*canonical mutation/i
  )
  assert.match(text, /point.*element-count.*budget/i)
  assert.match(
    text,
    /element-count budget capped at 32 elements per work unit/i
  )
  assert.match(
    text,
    /multiple deterministic progressive plural Core child batches.*one outer App transaction.*one intended history action/i
  )
  assert.match(
    text,
    /successful canonical slice.*ordinary.*projection.*progress.*browser paint opportunity.*AbortSignal/i
  )
  assert.match(text, /CSS.*transform.*opacity.*compositor/i)
  assert.match(
    text,
    /single.*progressive.*multiple deterministic progressive plural Core child batches/i
  )
  assert.match(
    text,
    /production.*formal.*provider.*without an ai or delivery query.*progressive/i
  )
  assert.match(
    text,
    /Contents.*fixed.*mounted.*production App.*detached performance profile.*never configures.*App/i
  )
  assert.match(
    contentsText,
    /production App mounts.*ordinary Contents projection.*left sidebar.*without.*performance-profile.*URL-selected bypass/i
  )
  assert.ok(
    contentsOwner.implementationBoundary.includes(
      'apps/asyra-design/src/app/index.tsx'
    )
  )
  assert.ok(
    contentsOwner.implementationBoundary.includes(
      'apps/asyra-design/src/app/__tests__/App.test.tsx'
    )
  )
  assert.doesNotMatch(text, /aiDelivery|atomic measurement opt-in|Atomic mode/i)
  assert.doesNotMatch(
    text,
    /App-owned delivery mode|resolved atomic or progressive delivery mode/i
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
    'one timeout scheduled independently for every prepared range'
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
  ;[
    'apps/asyra-design/src/app/index.tsx',
    'apps/asyra-design/src/app/__tests__'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/e2e/conversational-ai.spec.ts'
    )
  )
  assert.match(
    proofText,
    /one production two-Actor 7,076-element.*Actor A.*exact-bounds loading.*pan and zoom.*one terminal exact canonical summary/i
  )
  assert.match(proofText, /connected exact-bounds loading/i)
  assert.match(
    proofText,
    /longest canonical work unit.*cooperative yield count/i
  )
  assert.match(
    proofText,
    /explicitly approved local-source, relay, or final checkpoint.*only high-detail invocation for the checkpoint.*no warm-up, repeat, or additional single-Actor/i
  )
  assert.match(proofText, /separately attributed WebSocket-server CPU/i)
  assert.match(
    proofText,
    /Contents and production persistence are outside.*unguarded.*7,000-plus run/i
  )
  assert.match(
    proofText,
    /performance profile.*detached evidence.*no configuration.*aiPerformance=profile.*never.*product route/i
  )
  assert.doesNotMatch(proofText, /default progressive mode/i)
  ;[
    'snapshot contentsMode or deliveryMode configuration',
    'aiDelivery, aiPerformanceContents, ai=mock, or another product-mode query'
  ].forEach((contributor) =>
    assert.ok(proofOwner.forbiddenContributors.includes(contributor))
  )
  ;[
    'apps/asyra-design/src/index.tsx',
    'apps/asyra-design/__tests__/playwright-config.test.mjs',
    'apps/asyra-design/playwright.config.ts'
  ].forEach((boundary) =>
    assert.ok(proofOwner.implementationBoundary.includes(boundary), boundary)
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
        route.to === 'evaluate-endpoint-performance' &&
        route.producedArtifacts.includes('artifact:app-bulk-timing')
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'evaluate-endpoint-performance' &&
        route.producedArtifacts.includes(
          'artifact:local-drawing-progress-state'
        )
    )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:local-interactive-drawing-proof' &&
        artifact.ownerStepId === 'evaluate-endpoint-performance' &&
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
    /Cooperative Progressive Composition[\s\S]*point[\s\S]*element-count[\s\S]*browser paint opportunity[\s\S]*one outer transaction[\s\S]*one intended Undo/i
  )
  assert.match(
    plan,
    /Document Interaction Lock[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*success[\s\S]*failure[\s\S]*cancellation[\s\S]*teardown/i
  )
  assert.match(
    plan,
    /active production[\s\S]*entry always starts the single server-backed Runtime and formal provider[\s\S]*without an `ai` or delivery query[\s\S]*fixed cooperative progressive[\s\S]*plural-batch composition/i
  )
  assert.doesNotMatch(
    plan,
    /aiDelivery|Balanced atomic creation|Atomic mode submits|exact atomic or progressive delivery selection/i
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
    /Scenario: Local progressive composition becomes visible in cooperative batches[\s\S]*point and element-count[\s\S]*browser paint opportunity[\s\S]*one outer transaction[\s\S]*one Undo/i
  )
  assert.match(feature, /at most 32 elements per ordinary work unit/i)
  assert.match(plan, /32-element work-unit cap[\s\S]*fixed 2,048-point budget/i)
  assert.match(
    feature,
    /Scenario: Drawing progress keeps navigation responsive while edits stay locked[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*one Undo/i
  )
  assert.match(
    feature,
    /Scenario: Production App exposes one formal server-backed Agent route[\s\S]*ordinary production entry starts with one required fileId[\s\S]*single cooperative progressive plural-batch route[\s\S]*should mount its ordinary Contents projection[\s\S]*detached performance profile should not configure the App/i
  )
  assert.doesNotMatch(
    feature,
    /aiDelivery|URL resolves exact "aiDelivery=progressive"|atomic delivery mode/i
  )
})

test('relay profiling batches diagnostic evidence without changing raw CPU safety', () => {
  const owner = step('evaluate-endpoint-performance')
  const text = contractText(owner)

  assert.match(
    text,
    /relay profiling.*once per eight.*same-type records.*sampleCount.*exact counts.*maxima.*raw CPU safety/i
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/collaboration-server.ts'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-design/__tests__/collaboration-server.test.mjs'
    )
  )
})

test('local source endpoint keeps canonical records while removing repeated single-record work', () => {
  const stageOwner = step('stage-local-interactive-composition')
  const canonicalOwner = step('apply-canonical-property-scene-batch')
  const factoryOwner = step('record-and-deliver-transaction-batch')
  const projectionOwner = step('project-visible-canonical-slices')
  const proofOwner = step('evaluate-endpoint-performance')
  const stageText = contractText(stageOwner)
  const canonicalText = contractText(canonicalOwner)
  const factoryText = contractText(factoryOwner)
  const projectionText = contractText(projectionOwner)
  const proofText = contractText(proofOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /16 vectors.*12,919 points[\s\S]*26,030[\s\S]*property records[\s\S]*7,075 vectors.*156,373 points[\s\S]*397,674[\s\S]*property records/i
  )
  assert.match(
    stageText,
    /server-prepared Group and child descriptors.*no intermediate point-object graph.*no repeated vector validation, bounds, or normalization/i
  )
  assert.match(
    stageText,
    /every successful canonical slice.*browser paint opportunity.*fixed point budget.*32 elements/i
  )
  assert.match(
    canonicalText,
    /individually addressable property records.*stable ids.*shared props.*shared components/i
  )
  assert.match(
    canonicalText,
    /one owner-indexed relationship traversal.*child-first order.*forward and reverse relation indexes.*owner ranges/i
  )
  assert.match(
    canonicalText,
    /batch materialization.*no per-record structured clone.*save.*isEqual/i
  )
  assert.match(
    canonicalText,
    /validated action owner data.*direct shallow field handoff.*no geometry-data clone/i
  )
  assert.match(
    canonicalText,
    /manager-owned relationship index.*affected-owner batch.*no per-edge subscriptions/i
  )
  assert.match(
    canonicalText,
    /local Computed projection.*owner-issued geometry data.*does not rebuild complete Render topology.*repeated property-instance reads.*never shared/i
  )
  assert.match(
    canonicalText,
    /one local creation request.*Props-then-Scene evidence.*one updateTransactionBatch call.*separate Factory handoffs is forbidden/i
  )
  assert.match(
    factoryText,
    /existing Factory journal.*inverter contracts.*no bulk-specific compensation record/i
  )
  assert.match(
    `${factoryText} ${projectionText}`,
    /ordinary canonical owner batch.*transport wire artifact.*does not split local projection into single-entry changes/i
  )
  assert.match(
    proofText,
    /complete local source pipeline.*one guarded 7,076-element proof.*not after each internal owner/i
  )
  assert.match(
    proofText,
    /retained counter ring rollover.*exact accumulated loading-frame total/i
  )
  assert.match(
    proofText,
    /exact canonical work-unit phase count.*exact Actor A local-sent publication count.*bounded retained phase and counter sample lengths.*never exact totals/i
  )
  assert.match(
    proofText,
    /required provider.*Runtime.*execution.*Group.*plural-batch phase presence.*O\(1\) per-name phase-count query.*exact after retained phase-ring rollover.*bounded phase timeline.*timing evidence.*never.*permanent occurrence evidence/i
  )
  assert.match(
    feature,
    /Scenario: Local source pipeline preserves shared records without per-record runtime work[\s\S]*stable property records and IDs[\s\S]*no per-edge subscription[\s\S]*local Computed[\s\S]*one local canonical batch/i
  )
  assert.match(
    feature,
    /100 Vector items[\s\S]*100 independently addressable Vector element data records[\s\S]*not merge.*one giant Vector data record/i
  )
})

test('canonical lifecycle uses one origin-neutral prepared mutation route', () => {
  const owner = step('apply-canonical-property-scene-batch')
  const activeText = [
    owner.id,
    owner.title,
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

  assert.match(
    activeText,
    /one origin-neutral canonical lifecycle.*ordinary descriptors.*detached canonical data.*retained property evidence/i
  )
  assert.doesNotMatch(activeText, /UsingActiveProperties/)
  assert.doesNotMatch(activeText, /\bplan(?:s|ned|ning)?\b|Plan\b/)
  assert.match(
    plan,
    /one origin-neutral canonical lifecycle[\s\S]*ordinary descriptors[\s\S]*detached canonical data[\s\S]*retained property evidence/i
  )
  assert.doesNotMatch(
    plan.match(
      /### Bulk Mutation Contract\n([\s\S]*?)\n### Factory Existing History and Transport Wire Contract/
    )?.[1] ?? '',
    /UsingActiveProperties|\bplan(?:s|ned|ning)?\b|Plan\b/
  )
  assert.match(
    feature,
    /Scenario: Canonical lifecycle selects evidence without origin-specific APIs[\s\S]*ordinary descriptors[\s\S]*detached canonical data[\s\S]*retained property evidence[\s\S]*one origin-neutral/i
  )
})

test('Core returns ordered ids while Factory records transaction evidence directly', () => {
  const canonicalOwner = step('apply-canonical-property-scene-batch')
  const factoryOwner = step('record-and-deliver-transaction-batch')
  const activeCanonicalText = [
    canonicalOwner.purpose,
    ...canonicalOwner.inputs,
    ...canonicalOwner.outputs,
    ...canonicalOwner.conditions,
    ...canonicalOwner.bypasses,
    ...canonicalOwner.allowedContributors
  ].join(' ')
  const activeFactoryText = [
    factoryOwner.purpose,
    ...factoryOwner.inputs,
    ...factoryOwner.outputs,
    ...factoryOwner.conditions,
    ...factoryOwner.bypasses,
    ...factoryOwner.allowedContributors
  ].join(' ')

  assert.match(
    activeCanonicalText,
    /Core\.createElementsInParent.*returns only ordered canonical element IDs/i
  )
  assert.match(
    activeFactoryText,
    /Factory transaction owner records.*ordinary ordered reversible Props and Scene owner changes directly/i
  )
  assert.deepEqual(
    factoryOwner.implementationBoundary.filter((entry) =>
      entry.startsWith('packages/reactive-events/')
    ),
    [
      'packages/reactive-events/src/app/events.ts',
      'packages/reactive-events/src/app/publish.ts',
      'packages/reactive-events/src/scene-tree/events.ts',
      'packages/reactive-events/src/scene-tree/publish.ts',
      'packages/reactive-events/src/scene-tree/subscribes.ts',
      'packages/reactive-events/src/transaction-owner.ts',
      'packages/reactive-events/src/types.ts',
      'packages/reactive-events/src/__tests__/scene-tree-publish.test.ts',
      'packages/reactive-events/src/__tests__/transaction-batch.test.ts',
      'packages/reactive-events/src/__tests__/transaction-boundary.test.ts'
    ]
  )
  assert.ok(
    factoryOwner.implementationBoundary.includes(
      'docs/ai/framework/packages/factory.md'
    )
  )
  assert.ok(
    factoryOwner.implementationBoundary.includes(
      'docs/ai/framework/packages/reactive-events.md'
    )
  )
  assert.match(
    read('docs/ai/framework/packages/factory.md'),
    /bulk action uses this same journal[\s\S]*does not create an AI-specific or bulk-specific forward\/inverse history\s+artifact/i
  )
  assert.match(
    read('docs/ai/framework/packages/factory.md'),
    /does not copy canonical payloads into a parallel applied-result object/i
  )
  assert.match(
    read('docs/ai/framework/packages/reactive-events.md'),
    /batch-only transaction owner[\s\S]*computed[\s\S]*observer-only/i
  )
  assert.doesNotMatch(
    `${activeCanonicalText}\n${activeFactoryText}`,
    /CanonicalElementBatchResult|canonical-element-batch-result|delivery handle/i
  )
  assert.equal(
    data.routes.some(({ id }) => id === 'route-canonical-result-to-factory'),
    false
  )
  assert.equal(
    data.artifacts.some(
      ({ id }) => id === 'artifact:canonical-element-batch-result'
    ),
    false
  )
})

test('demo documents load empty without client persistence', () => {
  const owner = step('load-empty-demo-document')
  const localProofOwner = step('evaluate-endpoint-performance')
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
  assert.match(
    text,
    /resetData.*fresh.*empty document.*Core\.load.*zero.*IndexedDB.*localStorage.*URL.*reload/i
  )
  ;[
    'apps/asyra-design/package.json',
    'apps/asyra-design/src/config/empty-document.ts',
    'apps/asyra-design/src/controllers/app.ts',
    'apps/asyra-design/src/controllers/__tests__/app.test.ts',
    'apps/asyra-design/src/contexts/data-change.tsx',
    'apps/asyra-design/src/contexts/__tests__/data-change.test.tsx',
    'apps/asyra-design/src/document-persistence.ts',
    'apps/asyra-design/src/render-app/index.tsx',
    'apps/asyra-design/src/render-app/collaboration-mode.ts',
    'apps/asyra-design/src/collaboration/lifecycle.ts',
    'apps/asyra-design/src/render-app/__tests__/collaboration-mode.test.ts',
    'apps/asyra-design/src/render-app/__tests__/document-persistence.test.ts',
    'apps/asyra-design/src/render-app/__tests__/render-app-strict-mode.test.tsx',
    'apps/asyra-design/playwright.config.ts',
    'apps/asyra-design/__tests__/playwright-config.test.mjs',
    'create-app/asyra-design/template/package.json',
    'create-app/asyra-design/template/src/config/empty-document.ts',
    'create-app/asyra-design/template/src/controllers/app.ts',
    'create-app/asyra-design/template/src/controllers/__tests__/app.test.ts',
    'create-app/asyra-design/template/src/contexts/data-change.tsx',
    'create-app/asyra-design/template/src/contexts/__tests__/data-change.test.tsx',
    'create-app/asyra-design/template/src/document-persistence.ts',
    'create-app/asyra-design/template/src/render-app/index.tsx',
    'create-app/asyra-design/template/src/render-app/__tests__/document-persistence.test.ts',
    'create-app/asyra-design/template/src/render-app/__tests__/render-app-strict-mode.test.tsx',
    'scripts/dev-all-plan.js',
    'scripts/dev-all.js',
    'scripts/__tests__/workspace-automation.test.mjs'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
  assert.match(
    text,
    /root dev:all.*only workspace package watchers.*App dev server.*explicit collaboration:server.*collaboration Playwright.*separately owns.*reference WebSocket server.*before.*App document connection/i
  )
  assert.doesNotMatch(text, /ordinary non-collaboration.*FILE.*unchanged/i)
  assert.ok(
    !localProofOwner.inputs.includes('artifact:empty-memory-demo-document')
  )
  assert.ok(
    !data.routes.some(
      (route) =>
        route.from === 'load-empty-demo-document' &&
        route.to === 'evaluate-endpoint-performance'
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
    /Scenario: Reset loads a fresh empty demo document without client persistence[\s\S]*resetData[\s\S]*Core\.load[\s\S]*IndexedDB[\s\S]*localStorage[\s\S]*URL[\s\S]*reload[\s\S]*local reset/i
  )
  assert.match(
    feature,
    /Scenario: Required fileId selects the document without toggling Collaboration[\s\S]*required fileId URL[\s\S]*one Actor[\s\S]*single-Actor[\s\S]*second Actor[\s\S]*same fileId[\s\S]*CRDT/i
  )
  assert.match(
    feature,
    /root dev:all[\s\S]*only frontend workspace processes[\s\S]*App dev server[\s\S]*explicit collaboration:server[\s\S]*collaboration Playwright[\s\S]*separately[\s\S]*reference WebSocket server[\s\S]*App/i
  )
})
