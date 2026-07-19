const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./yjs-network-collaboration-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../..')

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

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const anchorsIn = (markdown) =>
  new Set(
    markdown
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )

test('dedicated Yjs Inspector and product authorities resolve', () => {
  assert.equal(data.target.title, 'Yjs Network Collaboration Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/yjs-network-collaboration-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/yjs-network-collaboration-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        'yjs-network-collaboration-flow-inspector.html'
      )
    )
  )
  assert.notEqual(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/transaction-flow-inspector.data.cjs'
  )
})

test('every step has exact execution fields and every route and artifact resolves', () => {
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))
  const requiredFields = [
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

  assert.equal(laneIds.size, data.lanes.length, 'duplicate lane id')
  assert.equal(stepIds.size, data.steps.length, 'duplicate step id')
  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
  )

  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
    assert.ok(laneIds.has(item.laneId), `${item.id} lane`)
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
    item.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((id) => assert.ok(artifactIds.has(id), `${item.id} input ${id}`))
    item.outputs.forEach((id) =>
      assert.ok(artifactIds.has(id), `${item.id} output ${id}`)
    )
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    assert.ok(route.kind, `${route.id} kind`)
    assert.ok(route.predicate, `${route.id} predicate`)
    route.producedArtifacts.forEach((id) => {
      const artifact = data.artifacts.find((item) => item.id === id)
      assert.ok(artifact, `${route.id} artifact ${id}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner ${id}`)
      if (route.to) {
        assert.ok(
          artifact.consumerStepIds.includes(route.to),
          `${route.id} consumer ${id}`
        )
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    const owner = step(artifact.ownerStepId)
    assert.ok(owner.outputs.includes(artifact.id), `${artifact.id} owner output`)
    artifact.consumerStepIds.forEach((id) => {
      assert.ok(stepIds.has(id), `${artifact.id} unknown consumer ${id}`)
      assert.ok(step(id).inputs.includes(artifact.id), `${artifact.id} input ${id}`)
    })
    if (!artifact.terminal) {
      assert.ok(artifact.consumerStepIds.length > 0, `${artifact.id} consumer`)
    }
  })

  data.invariants.forEach((invariant) => {
    invariant.stepIds.forEach((id) => assert.ok(stepIds.has(id), id))
    invariant.artifactIds.forEach((id) => assert.ok(artifactIds.has(id), id))
  })
  data.acceptanceContracts.forEach((contract) => {
    contract.stepIds.forEach((id) => assert.ok(stepIds.has(id), id))
  })
})

test('every implementation boundary resolves to an existing project target', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      const wildcardIndex = boundary.search(/[?*[{]/)
      const target = (
        wildcardIndex === -1 ? boundary : boundary.slice(0, wildcardIndex)
      ).replace(/\/$/, '')
      assert.ok(
        target && fs.existsSync(path.resolve(repoRoot, target)),
        `${item.id} missing implementation boundary ${boundary}`
      )
    })
  })
})

test('all local and external specification anchors resolve', () => {
  const defaultSpec = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const defaultAnchors = anchorsIn(defaultSpec)
  const externalCache = new Map()
  const refs = [
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.invariants.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ]

  refs.forEach((ref) => {
    if (ref.startsWith('#')) {
      assert.ok(defaultAnchors.has(ref.slice(1)), `Missing spec anchor ${ref}`)
      return
    }
    const [relativePath, anchor] = ref.split('#')
    const absolutePath = path.resolve(__dirname, relativePath)
    assert.ok(fs.existsSync(absolutePath), `Missing spec file ${relativePath}`)
    const anchors =
      externalCache.get(absolutePath) ??
      anchorsIn(fs.readFileSync(absolutePath, 'utf8'))
    externalCache.set(absolutePath, anchors)
    assert.ok(anchors.has(anchor), `Missing spec anchor ${ref}`)
  })
})

test('opt-in composition owns the disabled and provider-less cases', () => {
  const compose = contractText(step('compose-collaboration-opt-in'))
  const instance = contractText(step('own-collaboration-instance'))

  assert.match(compose, /explicit import.*instance creation activates/i)
  assert.match(compose, /no Y\.Doc.*provider.*room.*awareness.*network/i)
  assert.match(compose, /authentication.*authorization.*room access/i)
  assert.match(instance, /exactly one Y\.Doc.*provider.*Factory-backed shared registry/i)
  assert.match(instance, /provider-less.*offline/i)
  assert.match(instance, /Borrowed resources.*not destroyed/i)
  assert.match(instance, /Separate instances remain isolated/i)
  assert.ok(
    step('compose-collaboration-opt-in').implementationBoundary.includes(
      'packages/collaboration/src/__tests__/collaboration-disabled.test.ts'
    )
  )
  assert.ok(
    step('compose-collaboration-opt-in').implementationBoundary.includes(
      'docs/ai/framework/packages/collaboration.md'
    ),
    'public collaboration composition requires a package contract'
  )
})

test('local timeline preserves Factory transaction ownership and formal compensation', () => {
  const local = contractText(step('publish-local-committed-change'))
  const envelope = contractText(step('create-shared-operation-envelope'))

  assert.match(local, /Intent -> Feature -> API -> local transaction -> state owner -> commit/i)
  assert.match(local, /local channels that do not require a Y\.Doc/i)
  assert.match(local, /Rollback before transaction-end flush.*no shared operation/i)
  assert.match(local, /Remote-origin.*excluded from.*network publication/i)
  assert.match(envelope, /operation.*transaction.*document.*actor.*protocol.*schema.*origin.*channel.*event.*payload/i)
  assert.match(envelope, /compensation envelope names the exact operation/i)
  assert.match(envelope, /canonical apply handler/i)
  assert.ok(
    data.routes.some(
      (route) =>
        route.id === 'local-shared-compensation' &&
        route.kind === 'compensation'
    )
  )
})

test('provider boundary is replaceable and acknowledgement states are separate', () => {
  const provider = contractText(step('transport-provider-update'))
  const persistence = contractText(step('persist-sync-and-acknowledge'))

  assert.match(provider, /Connect.*disconnect.*reconnect/i)
  assert.match(provider, /state-vector exchange/i)
  assert.match(provider, /hard-coded WebSocket.*P2P.*hosted provider authority/i)
  assert.match(provider, /never grants authority from awareness/i)
  assert.match(provider, /Remote-origin Y\.Doc updates are never sent back/i)
  assert.match(persistence, /stores binary document updates only and never awareness/i)
  assert.match(persistence, /only the missing update diff/i)
  assert.match(
    persistence,
    /Runtime committed.*locally persisted.*network sent\/converged.*durably acknowledged.*distinct/i
  )
  assert.match(persistence, /failure never reverses.*committed canonical/i)
  assert.ok(
    step('persist-sync-and-acknowledge').implementationBoundary.includes(
      'packages/collaboration/src/providers/memory-provider.ts'
    ),
    'reconnect persistence step must include its state-vector provider adapter'
  )
})

test('inbound pipeline orders decode, dedupe, validation, policy, transaction, and canonical owner', () => {
  const decode = step('decode-inbound-update')
  const validation = contractText(step('validate-origin-dedupe-protocol'))
  const policy = contractText(step('decide-permission-conflict'))
  const transaction = contractText(step('run-remote-apply-transaction'))
  const owner = contractText(step('apply-canonical-state-owner'))

  assert.match(contractText(decode), /does not mutate canonical package state/i)
  assert.match(validation, /identity collision/i)
  assert.match(validation, /repeated identical operation id.*without mutation/i)
  assert.match(validation, /locally published operation.*outcome registry/i)
  assert.match(validation, /unsupported versions\/routes.*malformed payloads/i)
  assert.match(policy, /Permission runs before conflict/i)
  assert.match(policy, /Framework invariant policies cannot be replaced/i)
  assert.match(policy, /repair is revalidated/i)
  assert.match(transaction, /one intended remote transaction boundary/i)
  assert.match(transaction, /excluded from ordinary local-user undo/i)
  assert.match(transaction, /suppresses echo/i)
  assert.match(owner, /one canonical Scene Tree, Props, Selection, or System owner/i)
  assert.match(owner, /Y\.Doc, provider, awareness, Render, or UI state authority/i)

  const orderedRouteIds = [
    'decode-operation',
    'validate-remote-operation',
    'policy-accepted-or-repaired',
    'request-canonical-apply',
    'canonical-state-applied'
  ]
  orderedRouteIds.forEach((id) =>
    assert.ok(data.routes.some((route) => route.id === id), id)
  )
  assert.ok(
    step('run-remote-apply-transaction').implementationBoundary.includes(
      'packages/utils/src/types/transaction.ts'
    ),
    'remote transaction origin type owner must be in the implementation boundary'
  )
  assert.ok(
    step('validate-origin-dedupe-protocol').implementationBoundary.includes(
      'packages/collaboration/src/collaboration-instance.ts'
    ),
    'local publication must register its outcome before an own-operation replay'
  )
})

test('awareness is a separate ephemeral observational route', () => {
  const awareness = contractText(step('own-awareness-state'))
  const projection = contractText(step('project-awareness-state'))

  assert.match(awareness, /removed on disconnect.*leave.*timeout/i)
  assert.match(awareness, /cannot authorize.*does not enter document undo\/redo/i)
  assert.match(awareness, /Core save\/load payload/i)
  assert.match(awareness, /collaboration Y\.Doc operation array/i)
  assert.match(projection, /without feeding it into document state.*authorization.*save\/load.*undo/i)
  assert.ok(
    step('own-awareness-state').implementationBoundary.includes(
      'packages/collaboration/src/collaboration-instance.ts'
    ),
    'awareness owner must bind the collaboration instance identity and lifecycle'
  )
  assert.ok(
    data.routes.every((route) => {
      if (!route.id.includes('awareness')) return true
      return !['run-remote-apply-transaction', 'apply-canonical-state-owner'].includes(
        route.to
      )
    })
  )
})

test('acceptance contracts cover the bounded release-gate product cases', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Disabled.*no-provider.*connect.*disconnect.*reconnect/i,
    /two-client convergence.*duplicate.*delayed.*reordered.*replayed/i,
    /invalid protocol\/schema\/route\/payload/i,
    /Unauthorized.*unsupported.*remote apply failure.*echo prevention/i,
    /local-user-only undo.*pre-flush rollback.*immediate compensation/i,
    /framework invariant.*app-domain extension/i,
    /disconnect\/timeout cleanup.*save\/load.*undo exclusion/i,
    /independent instances.*intentional shared wiring.*one-instance disposal/i
  ].forEach((pattern) => assert.match(text, pattern))
})
