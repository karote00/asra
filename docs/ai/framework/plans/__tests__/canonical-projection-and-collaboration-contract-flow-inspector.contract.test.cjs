const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../canonical-projection-and-collaboration-contract-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')
const featurePath = path.resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
)

const requiredStepFields = [
  'id',
  'order',
  'laneId',
  'title',
  'ownerPackage',
  'purpose',
  'inputs',
  'outputs',
  'conditions',
  'bypasses',
  'allowedContributors',
  'forbiddenContributors',
  'cacheDimensions',
  'implementationBoundary',
  'specRefs',
  'failureOwnerStepId'
]

const requiredStepIds = [
  'prepare-one-composition-request',
  'coordinate-canonical-owner-plans',
  'prepare-and-apply-property-batch',
  'prepare-and-apply-scene-plan',
  'derive-local-computed-projection',
  'record-canonical-transaction-artifact',
  'project-render-state',
  'publish-shared-publication',
  'transport-publication-bytes',
  'apply-remote-publication',
  'persist-local-commit'
]

const requiredImplementationOrder = [
  'project-render-state',
  'prepare-and-apply-property-batch',
  'prepare-and-apply-scene-plan',
  'coordinate-canonical-owner-plans',
  'derive-local-computed-projection',
  'record-canonical-transaction-artifact',
  'prepare-one-composition-request',
  'publish-shared-publication',
  'transport-publication-bytes',
  'apply-remote-publication',
  'persist-local-commit'
]

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const contractText = (owner, { includeForbidden = true } = {}) =>
  [
    owner.purpose,
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.allowedContributors,
    ...(includeForbidden ? owner.forbiddenContributors : []),
    ...owner.implementationBoundary
  ].join(' ')

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const read = (filePath) => fs.readFileSync(filePath, 'utf8')
const plan = () => read(path.resolve(repoRoot, data.authority.specPath))
const feature = () => read(featurePath)

test('realignment Inspector and current planning authorities resolve', () => {
  assert.equal(
    data.target.id,
    'canonical-projection-and-collaboration-contract-realignment'
  )
  assert.equal(
    data.target.title,
    'Canonical Projection and Collaboration Contract Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/canonical-projection-and-collaboration-contract-realignment-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'canonical-projection-and-collaboration-contract-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))

  const frameworkPlans = read(
    path.resolve(repoRoot, 'docs/ai/framework/PLANS.md')
  )
  const appPlans = read(
    path.resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md')
  )
  const performancePlan = read(
    path.resolve(
      repoRoot,
      'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
    )
  )

  assert.match(
    frameworkPlans,
    /Active Pre-Release Blocker[\s\S]*canonical-projection-and-collaboration-contract-realignment-plan\.md/
  )
  assert.match(
    appPlans,
    /Current cross-cutting contract authority:[\s\S]*canonical-projection-and-collaboration-contract-realignment-plan\.md/
  )
  assert.match(performancePlan, /Paused Level 3 app performance refactor/)
  assert.match(
    performancePlan,
    /Paused architecture artifacts retained as evidence only/
  )
})

test('Inspector exposes eleven exact single-owner runtime steps', () => {
  assert.deepEqual(
    new Set(data.steps.map((item) => item.id)),
    new Set(requiredStepIds)
  )

  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)

  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredStepFields)
    assert.ok(laneIds.has(item.laneId), `${item.id} lane`)
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
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
      assert.ok(item[field].length > 0, `${item.id} empty ${field}`)
    })
  })

  const runtimeSection = plan().match(
    /### Runtime owner segments\n([\s\S]*?)\n### Non-runtime closure segments/
  )
  assert.ok(runtimeSection, 'Missing runtime owner segment section')
  const implementationIds = [
    ...runtimeSection[1].matchAll(/^\d+\.\s+`([^`]+)`/gm)
  ].map((match) => match[1])
  assert.deepEqual(implementationIds, requiredImplementationOrder)
  assert.deepEqual(new Set(implementationIds), new Set(requiredStepIds))

  const computedBoundary = step(
    'derive-local-computed-projection'
  ).implementationBoundary
  ;[
    'packages/scene-tree/src/sceneTree.ts',
    'packages/scene-tree/src/components/element.ts',
    'packages/scene-tree/src/components/element-change-handler.ts',
    'packages/preset/src/subscriptions/data-channel.ts',
    'packages/preset/src/__tests__/selection-subscriptions.test.ts',
    'packages/preset/package.json',
    'docs/ai/framework/packages/scene-tree.md'
  ].forEach((filePath) => assert.ok(computedBoundary.includes(filePath)))

  assert.match(
    plan(),
    /project-render-state[\s\S]{0,360}without\s+registering[\s\S]{0,240}no second active consumer/i
  )
  assert.match(
    contractText(step('derive-local-computed-projection')),
    /producer switch.*consumer registration.*one semantic handoff.*no dual computed delivery/i
  )
  assert.match(
    contractText(step('derive-local-computed-projection')),
    /Preset declares.*@asyra\/reactive-events.*runtime dependency.*production consumer/i
  )
  assert.match(
    contractText(step('prepare-and-apply-scene-plan')),
    /UPDATE_ELEMENT_DATA.*canonical.*raw/i
  )
  assert.doesNotMatch(
    contractText(step('derive-local-computed-projection'), {
      includeForbidden: false
    }),
    /UPDATE_ELEMENT_DATA/
  )
  assert.match(
    contractText(step('derive-local-computed-projection')),
    /local computed.*accepts no EVENT_OPTIONS/i
  )
})

test('Inspector paths, anchors, routes, and artifacts resolve', () => {
  const anchors = new Set(
    plan()
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifacts = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )

  assert.equal(artifacts.size, data.artifacts.length)
  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.invariants.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.match(reference, /^#[a-z0-9-]+$/)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })

  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      const resolvedBoundary = path.resolve(repoRoot, boundary)
      const plannedFileParentExists =
        path.extname(boundary) !== '' &&
        fs.existsSync(path.dirname(resolvedBoundary))
      assert.ok(
        fs.existsSync(resolvedBoundary) || plannedFileParentExists,
        `${item.id} missing implementation root ${boundary}`
      )
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(
      step(artifact.ownerStepId).outputs.includes(artifact.id),
      `${artifact.id} owner output`
    )
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} consumer`)
      assert.ok(
        step(consumerId).inputs.includes(artifact.id),
        `${artifact.id} consumer input`
      )
      assert.ok(
        data.routes.some(
          (route) =>
            route.from === artifact.ownerStepId &&
            route.to === consumerId &&
            route.producedArtifacts.includes(artifact.id)
        ),
        `${artifact.id} missing ${artifact.ownerStepId} -> ${consumerId} route`
      )
    })
  })

  data.steps.forEach((consumer) => {
    consumer.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((artifactId) => {
        const artifact = artifacts.get(artifactId)
        assert.ok(artifact, `${consumer.id} unregistered input ${artifactId}`)
        assert.ok(
          artifact.consumerStepIds.includes(consumer.id),
          `${consumer.id} missing from ${artifactId} consumers`
        )
      })
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
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
})

test('Core coordinates plural creation and canonical property requests without API leakage', () => {
  const app = contractText(step('prepare-one-composition-request'))
  const activeApp = contractText(step('prepare-one-composition-request'), {
    includeForbidden: false
  })
  const core = contractText(step('coordinate-canonical-owner-plans'))
  const activeCore = contractText(step('coordinate-canonical-owner-plans'), {
    includeForbidden: false
  })

  assert.match(app, /one Group.*one all-children.*createElementsInParent/i)
  assert.match(app, /single.*batch-of-one/i)
  assert.match(app, /one outer Factory transaction/i)
  assert.doesNotMatch(activeApp, /fixed 256-item/i)

  assert.match(core, /property.*plan.*Scene.*plan.*before.*apply/i)
  assert.match(core, /ordered.*element IDs/i)
  assert.match(
    core,
    /updateElementProperties.*replaces complete canonical property field values/i
  )
  assert.match(
    core,
    /patchElementProperties.*typed record.*set.*remove/i
  )
  assert.match(core, /element.*property target plan.*Props/i)
  assert.match(
    core,
    /property-only.*target plan.*property batch plan.*no Scene mutation plan/i
  )
  assert.match(core, /changeComputedData.*deleted/i)
  assert.match(core, /Factory rollback.*cross-owner/i)
  assert.doesNotMatch(activeCore, /both owner plans|two owner plans/i)
  assert.doesNotMatch(activeCore, /createElementsInParentBatch/)
  assert.doesNotMatch(activeCore, /CanonicalElementBatchResult/)
  assert.doesNotMatch(activeCore, /delivery handle|timing result/i)
})

test('Props and Scene Tree retain separate batch missions', () => {
  const props = contractText(step('prepare-and-apply-property-batch'))
  const scene = contractText(step('prepare-and-apply-scene-plan'))
  const activeScene = contractText(step('prepare-and-apply-scene-plan'), {
    includeForbidden: false
  })

  assert.match(
    props,
    /schema.*property instances.*relationship rebind.*registration/i
  )
  assert.match(props, /later invalid.*no.*prefix/i)
  assert.match(props, /property value.*record patch/i)
  assert.match(props, /whole-batch preflight.*whole-batch apply/i)
  assert.match(
    props,
    /preparePropertyMutationBatch.*applyPropertyMutationBatch.*public owner capabilities/i
  )
  assert.match(
    props,
    /missing record.*materializes.*child property instance.*remove.*unlink.*inverse evidence/i
  )
  assert.match(props, /single.*batch-of-one/i)
  assert.ok(
    step('prepare-and-apply-property-batch').forbiddenContributors.includes(
      'Scene map mutation'
    )
  )

  assert.match(scene, /Scene map.*parent.*hierarchy order.*Scene evidence/i)
  assert.match(
    scene,
    /read-only.*element.*property.*target.*owner relation/i
  )
  assert.match(scene, /does not mutate.*Props/i)
  assert.match(scene, /lifecycle.*plan/i)
  assert.match(scene, /later invalid.*no.*prefix/i)
  assert.doesNotMatch(
    activeScene,
    /property instance|relationship rebind|registerMany|UsingActiveProperties/
  )
})

test('computed data is a local-only Render projection', () => {
  const computedStep = step('derive-local-computed-projection')
  const computed = contractText(computedStep)
  const factory = contractText(step('record-canonical-transaction-artifact'))
  const computedArtifact = data.artifacts.find(
    (artifact) => artifact.id === 'artifact:local-computed-projection'
  )

  assert.match(computed, /UPDATE_COMPUTED_DATA/)
  assert.match(computed, /property.*local.*computed.*Render/i)
  assert.match(computed, /animation.*local/i)
  assert.match(computed, /accepts no EVENT_OPTIONS/i)
  assert.match(computed, /changeComputedData.*deleted/i)
  assert.match(
    computed,
    /no.*history.*SharedDataChannel.*Collaboration.*persistence/i
  )
  assert.deepEqual(computedArtifact.consumerStepIds, ['project-render-state'])
  assert.doesNotMatch(
    step('record-canonical-transaction-artifact').inputs.join(' '),
    /local-computed-projection/
  )
  assert.match(factory, /computed.*forbidden|must not.*computed/i)
})

test('Factory owns one batch SPI, transaction semantic, and artifact', () => {
  const factory = contractText(step('record-canonical-transaction-artifact'))
  const activeFactory = contractText(
    step('record-canonical-transaction-artifact'),
    { includeForbidden: false }
  )

  assert.match(factory, /appendBatch.*observeBatch/i)
  assert.match(factory, /required/i)
  assert.match(factory, /single.*batch-of-one/i)
  assert.match(factory, /one.*transaction.*one.*history action/i)
  assert.match(factory, /immutable.*artifact/i)
  assert.match(factory, /staged.*status.*does not alter.*transaction/i)
  assert.match(
    factory,
    /eligible staged canonical slice.*SharedPublication.*ordinary publication route/i
  )
  assert.match(
    factory,
    /stable transaction.*publication.*slice.*inverse-compensation identity/i
  )
  assert.match(factory, /without republishing acknowledged records at commit/i)
  assert.match(factory, /remote.*no Undo.*echo.*persistence/i)
  assert.match(
    data.routes.find(
      (route) => route.id === 'route-factory-publication-to-collaboration'
    ).predicate,
    /staged slice.*committed remainder.*rollback compensation.*SharedPublication/i
  )
  assert.match(
    data.artifacts.find(
      (artifact) => artifact.id === 'artifact:shared-publication'
    ).channel,
    /transaction.*publication.*slice.*compensation identity/i
  )
  assert.doesNotMatch(
    activeFactory,
    /batchAppendIsAtomic|prototype identity|capability probe|fallback loop/i
  )
  assert.doesNotMatch(
    activeFactory,
    /transaction.*(?:atomic|progressive).*(?:mode|option)/i
  )
})

test('Collaboration and Provider expose one publication flow', () => {
  const collaboration = contractText(step('publish-shared-publication'))
  const activeCollaboration = contractText(step('publish-shared-publication'), {
    includeForbidden: false
  })
  const transport = contractText(step('transport-publication-bytes'))

  assert.match(collaboration, /SharedPublication.*transaction batch/i)
  assert.match(collaboration, /sendPublication.*onPublication/i)
  assert.match(collaboration, /canonical.*order/i)
  assert.match(
    collaboration,
    /only Factory-owned SharedPublication.*never derives.*staged status/i
  )
  assert.doesNotMatch(
    activeCollaboration,
    /sendPublications|onPublications|onInboundPublicationLease|maxConcurrentPublicationSends|maxPublicationsPerSend/
  )

  assert.match(transport, /bounded.*ordered queue.*delivery ownership/i)
  assert.match(transport, /versioned binary/i)
  assert.match(transport, /control.*JSON/i)
  assert.match(transport, /server-accepted.*wire-consumed.*peer-applied/i)
  assert.match(transport, /diagnostic.*not.*sendPublication/i)
  assert.match(transport, /perMessageDeflate.*false/i)
})

test('remote publication reuses canonical owners without local side effects', () => {
  const remote = contractText(step('apply-remote-publication'))
  const persistence = contractText(step('persist-local-commit'))

  assert.match(
    remote,
    /one source publication.*one remote Factory transaction/i
  )
  assert.match(remote, /App canonical apply.*consumer promise/i)
  assert.match(remote, /property-only.*computed state locally/i)
  assert.match(remote, /no Undo.*echo.*persistence/i)
  assert.match(persistence, /local action.*Undo.*Redo/i)
  assert.match(persistence, /remote.*zero.*capture.*save.*IndexedDB/i)
})

test('BDD covers the active architecture and retained performance gates', () => {
  const text = feature()

  ;[
    /Scenario: Computed data remains a local Render projection/,
    /Scenario: Canonical element property replacement uses the update path/,
    /Scenario: Canonical element property record delta uses the patch path/,
    /Scenario: Raw element data and computed projection use distinct evidence/,
    /Scenario: SharedDataChannel has one required batch contract/,
    /Scenario: Custom shared channels own their implementation correctness/,
    /Scenario: Core exposes one plural element creation path/,
    /Scenario: Props and Scene Tree apply separate owner plans/,
    /Scenario: Factory keeps one transaction semantic/,
    /Scenario: Collaboration Provider has one publication path/,
    /Scenario: Remote property follow-ups derive computed state locally/,
    /Scenario: Fast Mock AI CRDT correctness stays bounded/,
    /Scenario: Maximum detail remains editable and meets its budget/
  ].forEach((pattern) => assert.match(text, pattern))

  assert.doesNotMatch(text, /Scenario: Contents can scroll/)
  assert.match(
    text,
    /Factory should derive each eligible staged slice.*same "SharedPublication" route/i
  )
  assert.match(
    text,
    /Collaboration should consume only Factory-owned "SharedPublication".*instead of inferring publications from staged status/i
  )
  assert.match(text, /16 items/)
  assert.match(text, /7112-element balanced correctness gate.*change-aware/i)
  assert.match(text, /7076-element two-window full recording.*manual opt-in/i)
})

test('scope and pre-release removal stay bounded', () => {
  const text = plan()

  assert.match(text, /Excluded scope[\s\S]{0,240}Contents panel/i)
  assert.match(text, /No package or tool installation is authorized/i)
  assert.match(text, /Excluded scope[\s\S]{0,320}Live AI provider/i)
  assert.match(text, /Excluded scope[\s\S]{0,400}production backend DB/i)
  assert.match(text, /There is no released legacy surface to preserve/i)
  assert.match(text, /focused gate fails three implementation attempts/i)
  assert.ok(data.steps.every((item) => item.cacheDimensions.length === 0))
})
