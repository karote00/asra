const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-performance-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')
const planPath = path.resolve(repoRoot, data.authority.specPath)
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
  'project-scrollable-contents-window',
  'record-and-deliver-transaction-batch',
  'apply-canonical-property-scene-batch',
  'prepare-one-composition-bulk-request',
  'project-visible-canonical-slices',
  'encode-publication-frames',
  'relay-frames-with-backpressure',
  'apply-remote-publication-batches',
  'persist-local-commit-snapshots',
  'evaluate-performance-and-equivalence'
]

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

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

const plan = () => fs.readFileSync(planPath, 'utf8')
const feature = () => fs.readFileSync(featurePath, 'utf8')

test('performance Inspector authorities and active-plan routing resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Conversational AI Drawing Performance Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(planPath))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '../ai-conversational-drawing-performance-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))

  const plansIndex = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md'),
    'utf8'
  )
  assert.match(
    plansIndex,
    /Current active plan:\s+`plans\/ai-conversational-drawing-performance-plan\.md`/
  )
})

test('performance Inspector exposes ten exact single-owner product steps', () => {
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
})

test('performance Inspector paths and specification anchors resolve', () => {
  const anchors = new Set(
    plan()
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )

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
})

test('routes and artifacts form one exact owner graph', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactById = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )
  assert.equal(artifactById.size, data.artifacts.length)

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
        const artifact = artifactById.get(artifactId)
        assert.ok(artifact, `${consumer.id} unregistered input ${artifactId}`)
        assert.ok(
          artifact.consumerStepIds.includes(consumer.id),
          `${consumer.id} missing from ${artifactId} consumers`
        )
        assert.ok(
          data.routes.some(
            (route) =>
              route.from === artifact.ownerStepId &&
              route.to === consumer.id &&
              route.producedArtifacts.includes(artifactId)
          ),
          `${consumer.id} missing routed input ${artifactId}`
        )
      })
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    route.producedArtifacts.forEach((artifactId) => {
      const artifact = artifactById.get(artifactId)
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

test('one composition bulk request owns canonical batch creation', () => {
  const appStep = step('prepare-one-composition-bulk-request')
  const app = contractText(appStep)
  const canonical = contractText(step('apply-canonical-property-scene-batch'))
  const text = plan()

  assert.match(app, /Group.*one.*all-children.*Core bulk request/i)
  assert.match(app, /createElementsInParentBatch/)
  assert.match(app, /CanonicalElementBatchResult/)
  assert.match(app, /single-item.*batch-of-one/i)
  assert.match(app, /2,048 points.*8,192 points/i)
  assert.match(app, /slice.*does not.*canonical mutation/i)
  assert.doesNotMatch(app, /256-item transient maximum/i)
  assert.ok(
    appStep.implementationBoundary.every(
      (boundary) => !boundary.startsWith('packages/core/')
    )
  )

  assert.match(
    canonical,
    /schema.*ID.*relationship.*preflight.*instance.*registerMany/i
  )
  assert.match(canonical, /later.*invalid.*no.*prefix/i)
  assert.match(canonical, /one parent children replacement/i)
  assert.match(canonical, /one ordered batch evidence handoff/i)
  assert.match(
    canonical,
    /instance construction.*relationship wiring.*observer binding.*Scene evidence entries.*may iterate N/i
  )
  assert.match(canonical, /profiling.*material bottleneck/i)
  assert.match(text, /createElementsInParentBatch/)
  assert.match(text, /CanonicalElementBatchResult/)
})

test('Factory owns one immutable batch artifact and one history boundary', () => {
  const factory = contractText(step('record-and-deliver-transaction-batch'))
  const text = plan()

  assert.match(factory, /FactoryMutationBatchArtifact/)
  assert.match(factory, /SharedDeliveryBatch/)
  assert.match(factory, /SharedPublication\.batches/)
  assert.match(factory, /appendBatch.*observeBatch/i)
  assert.match(factory, /deeply detached.*frozen once/i)
  assert.match(factory, /one intended.*Undo/i)
  assert.match(factory, /Undo.*Redo.*complete action/i)
  assert.match(factory, /progressive.*no new canonical writes/i)
  assert.match(factory, /compensation.*same artifact/i)
  assert.match(factory, /observer mutation.*cannot.*consumer/i)

  assert.match(text, /one outer App transaction/i)
  assert.match(text, /Group and children.*transaction/i)
  assert.match(text, /one Undo action/i)
})

test('projection and Contents preserve visible progressive correctness', () => {
  const projectionStep = step('project-visible-canonical-slices')
  const projection = contractText(projectionStep)
  const contents = contractText(step('project-scrollable-contents-window'))

  assert.match(projection, /ordinary Vector/i)
  assert.match(projection, /atomic.*one.*projection/i)
  assert.match(projection, /progressive.*each.*slice.*projection/i)
  assert.match(projection, /one invalidation.*frame flush.*slice/i)
  assert.match(projection, /7,076.*editable elements/i)
  assert.match(projection, /affected entries.*hierarchy order/i)
  assert.match(projection, /no Render-engine bulk command/i)
  assert.match(projection, /Core.*batch observer.*Preset/i)
  ;[
    'packages/core/src/data-channel-observer.ts',
    'packages/core/src/__tests__/core-start-render.test.ts'
  ].forEach((boundary) => {
    assert.ok(projectionStep.implementationBoundary.includes(boundary))
  })
  ;[
    'apps/asyra-design/src',
    'apps/asyra-design/src/contexts',
    'apps/asyra-design/src/providers',
    'apps/asyra-design/src/init'
  ].forEach((boundary) => {
    assert.ok(!projectionStep.implementationBoundary.includes(boundary))
  })

  assert.match(contents, /actual inner scroll element/i)
  assert.match(contents, /viewport.*overscan/i)
  assert.match(contents, /last canonical element/i)
  assert.match(contents, /100\+ row/i)
  assert.match(contents, /collapse.*selection/i)
})

test('publication data is binary and relay backpressure stays byte-bounded', () => {
  const encodeStep = step('encode-publication-frames')
  const relayStep = step('relay-frames-with-backpressure')
  const encode = contractText(encodeStep)
  const relay = contractText(relayStep)

  assert.match(encode, /control frame.*JSON/i)
  assert.match(encode, /shared publication data.*versioned binary/i)
  assert.match(encode, /existing codec.*Web Worker/i)
  assert.match(encode, /transferable ArrayBuffer/i)
  assert.match(encode, /1 MiB.*soft/i)
  assert.match(encode, /one indivisible.*record.*exceed/i)
  assert.match(encode, /invalid.*truncated.*reject/i)
  assert.ok(encodeStep.inputs.includes('artifact:relayed-publication-frames'))
  assert.ok(encodeStep.inputs.includes('artifact:server-accepted-receipts'))
  assert.ok(encodeStep.inputs.includes('artifact:source-frame-admitted-credit'))
  assert.ok(encodeStep.outputs.includes('artifact:decoded-publication-batches'))
  assert.ok(encodeStep.outputs.includes('artifact:frame-consumed-credit'))
  assert.match(encode, /receiver worker.*one decoded publication.*App/i)
  assert.ok(
    encodeStep.implementationBoundary.includes(
      'apps/asyra-design/src/collaboration/publication-codec-worker.ts'
    )
  )

  assert.match(relay, /opaque.*payload.*no decode.*re-encode/i)
  assert.match(
    relay,
    /header.*version.*request.*publication.*chunk.*control metadata/i
  )
  assert.match(relay, /2 MiB.*high watermark/i)
  assert.match(relay, /512 KiB.*low watermark/i)
  assert.match(relay, /one oversized frame/i)
  assert.match(relay, /socket\.send callback/i)
  assert.match(relay, /frame-consumed/i)
  assert.match(
    relay,
    /one outbound publication frame.*source-frame-admitted.*next frame/i
  )
  assert.match(relay, /control.*fast path.*socket.*pause/i)
  assert.match(relay, /server-accepted.*does not.*peer.*applied/i)
  assert.match(relay, /perMessageDeflate.*false/i)
  assert.ok(relayStep.inputs.includes('artifact:frame-consumed-credit'))
  assert.ok(relayStep.inputs.includes('artifact:peer-applied-receipts'))
  assert.ok(relayStep.outputs.includes('artifact:source-frame-admitted-credit'))
  assert.ok(relayStep.outputs.includes('artifact:server-accepted-receipts'))
  assert.ok(
    data.routes.some(
      (route) =>
        route.id === 'route-source-frame-admitted-to-codec-provider' &&
        route.from === 'relay-frames-with-backpressure' &&
        route.to === 'encode-publication-frames' &&
        route.producedArtifacts.includes(
          'artifact:source-frame-admitted-credit'
        )
    )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:source-frame-admitted-credit' &&
        artifact.ownerStepId === 'relay-frames-with-backpressure' &&
        artifact.consumerStepIds.includes('encode-publication-frames')
    )
  )
  assert.match(
    plan(),
    /source-frame-admitted[\s\S]{0,240}one\s+outbound\s+publication\s+frame/i
  )
  assert.match(
    feature(),
    /source-frame-admitted[\s\S]{0,240}next publication frame/i
  )
  assert.ok(!relayStep.implementationBoundary.includes('apps/asyra-design/e2e'))
})

test('remote apply has one publication transaction and no client durability', () => {
  const remoteStep = step('apply-remote-publication-batches')
  const remote = contractText(remoteStep)
  const persistenceStep = step('persist-local-commit-snapshots')
  const persistence = contractText(persistenceStep)
  const text = plan()

  assert.match(
    remote,
    /one source publication.*one remote Factory transaction/i
  )
  assert.match(remote, /different publications.*not merged/i)
  assert.match(remote, /batch observer.*once/i)
  assert.match(remote, /no Undo.*no echo/i)
  assert.match(remote, /no.*capture.*save.*IndexedDB/i)
  assert.match(remote, /app policy.*canonical preflight.*App\/Core/i)
  assert.deepEqual(remoteStep.inputs, ['artifact:decoded-publication-batches'])
  assert.ok(remoteStep.outputs.includes('artifact:peer-applied-receipts'))
  assert.match(remote, /peer-applied.*after.*canonical apply/i)
  assert.ok(
    remoteStep.implementationBoundary.every(
      (boundary) =>
        !boundary.startsWith('packages/core/') &&
        !boundary.startsWith('packages/factory/')
    )
  )

  assert.match(persistence, /local action.*undo.*redo.*one.*complete snapshot/i)
  assert.match(persistence, /FIFO/i)
  assert.match(persistence, /remote.*zero.*client persistence/i)
  assert.ok(
    persistenceStep.implementationBoundary.every(
      (boundary) => !boundary.startsWith('packages/factory/')
    )
  )
  assert.match(
    text,
    /future[\s\S]{0,120}socket server[\s\S]{0,120}backend[\s\S]{0,120}outside this plan/i
  )
})

test('measurement and release budgets stay exact', () => {
  const proof = contractText(step('evaluate-performance-and-equivalence'))
  const text = plan()

  assert.match(text, /Contents present[\s\S]{0,80}7\.026 seconds/i)
  assert.match(text, /Contents omitted[\s\S]{0,80}7\.074[\s\S]{0,10}seconds/i)
  assert.match(text, /Actor A.*18\.194 seconds/i)
  assert.match(text, /Actor B.*1\.275 seconds/i)
  assert.match(text, /5,548\/7,076/)
  assert.match(text, /4\.99 MB/)
  assert.match(text, /9\.46 seconds/)
  assert.match(text, /remote apply[\s\S]{0,80}5\.894 seconds/i)
  assert.match(text, /inbound dispatch[\s\S]{0,80}1\.979 seconds/i)
  assert.match(text, /Render[\s\S]{0,80}0\.682 seconds/i)
  assert.match(text, /compression.*3,500\/7,076/i)

  assert.match(text, /Balanced atomic creation:[\s\S]*at most 12 seconds/)
  assert.match(text, /Balanced progressive creation:[\s\S]*at most 20 seconds/)
  assert.match(text, /first visible canonical batch within 2 seconds/)
  assert.match(text, /canonical convergence within 30 seconds/)
  assert.match(text, /whole dedicated E2E command[\s\S]*at most 180\s+seconds/)
  assert.match(text, /Maximum detail:[\s\S]*at most 60 seconds/)
  assert.match(
    proof,
    /product execution.*artifact.*encode.*server queue\/drain/i
  )
  assert.match(
    proof,
    /worker decode.*remote apply.*Render.*UI.*harness overhead/i
  )
})

test('heavy correctness, performance, and visual gates remain isolated', () => {
  const proof = contractText(step('evaluate-performance-and-equivalence'))
  const text = plan()

  assert.match(
    text,
    /default fast Mock AI CRDT correctness fixture has 16 items/i
  )
  assert.match(text, /7,112-element balanced correctness.*change-aware/i)
  assert.match(
    text,
    /high-detail performance and CRDT suites remain independent[\s\S]*opt-in/i
  )
  assert.match(
    text,
    /7,076-element two-window full recording remains manual opt-in/i
  )
  assert.match(proof, /one warm-up.*three measured runs/i)
  assert.match(proof, /27,471.*295,794/i)
  assert.match(proof, /same measured live App state/i)
  assert.match(proof, /complete.*uncropped.*Styles.*IDs.*hierarchy/i)
  assert.match(proof, /generated.*never committed/i)
})

test('BDD registers every new architecture and negative product case', () => {
  const text = feature()

  ;[
    /Scenario: One composition uses one canonical bulk request/,
    /Scenario: Factory emits one immutable transaction artifact/,
    /Scenario: Progressive slices remain visible without new canonical writes/,
    /Scenario: Contents can scroll to the final canonical element/,
    /Scenario: Binary publication relay applies byte backpressure/,
    /Scenario: Remote publication apply does not create local side effects/,
    /Scenario: Local persistence captures each committed state exactly once/,
    /Scenario: Fast Mock AI CRDT correctness stays bounded/,
    /Scenario: Maximum detail remains editable and meets its budget/
  ].forEach((pattern) => assert.match(text, pattern))

  assert.match(text, /16 items/)
  assert.match(
    text,
    /receiver worker should release one decoded publication at a time/i
  )
  assert.match(
    text,
    /remote apply should emit "peer-applied" only after canonical apply/i
  )
  assert.match(text, /7112-element balanced correctness gate.*change-aware/i)
  assert.match(text, /7076-element two-window full recording.*manual opt-in/i)
  assert.match(
    text,
    /generated screenshots, recordings, profiles, traces, and thumbnail media should remain ignored/i
  )
})

test('scope, WIP disposition, and stop conditions stay bounded', () => {
  const text = plan()

  assert.match(text, /preserve.*committed.*WIP.*owner step/i)
  assert.match(text, /remove.*failed.*compression/i)
  assert.match(text, /no third-party package/i)
  assert.match(text, /Live AI provider.*outside/i)
  assert.match(text, /backend DB.*outside/i)
  assert.match(text, /no Render-engine bulk command/i)
  assert.match(text, /same focused gate fails three times/i)
  assert.match(text, /peer queue.*bounded/i)
  assert.ok(data.steps.every((item) => item.cacheDimensions.length === 0))
})
