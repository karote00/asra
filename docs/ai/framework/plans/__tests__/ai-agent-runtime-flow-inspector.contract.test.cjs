/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-agent-runtime-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')

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

test('AI Agent Runtime Inspector and product authorities resolve', () => {
  assert.equal(data.target.id, 'ai-agent-runtime')
  assert.equal(data.target.title, 'AI Agent Runtime Flow Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/ai-agent-runtime-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/ai-agent-runtime-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(__dirname, '..', 'ai-agent-runtime-flow-inspector.html')
    )
  )
})

test('every owner step has exact execution and cleanup fields', () => {
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
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))

  assert.equal(laneIds.size, data.lanes.length, 'duplicate lane id')
  assert.equal(stepIds.size, data.steps.length, 'duplicate step id')
  assert.equal(data.steps.length, 17)

  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
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
    assert.match(
      item.conditions.join(' '),
      /Cleanup owner:/,
      `${item.id} lacks explicit cleanup owner statement`
    )
  })
})

test('every route, artifact, invariant, and acceptance contract resolves', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
  )
  assert.equal(
    new Set(data.invariants.map((item) => item.id)).size,
    data.invariants.length,
    'duplicate invariant id'
  )
  assert.equal(
    new Set(data.acceptanceContracts.map((item) => item.id)).size,
    data.acceptanceContracts.length,
    'duplicate acceptance id'
  )

  data.steps.forEach((item) => {
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
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    assert.equal(typeof artifact.channel, 'string', `${artifact.id} channel`)
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
      assert.ok(step(consumerId).inputs.includes(artifact.id))
    })
    if (!artifact.terminal) {
      assert.ok(artifact.consumerStepIds.length > 0, `${artifact.id} consumer`)
    }
  })

  data.invariants.forEach((invariant) => {
    invariant.stepIds.forEach((id) => assert.ok(stepIds.has(id), id))
    invariant.artifactIds.forEach((id) => assert.ok(artifactIds.has(id), id))
  })

  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  )
})

test('implementation boundaries stay inside the frozen Gate 4 allowlist', () => {
  const allowedBoundary =
    /^(packages\/ai-agent-runtime\/src|packages\/(factory|scene-tree|props-manager|system-context|selection|render|collaboration)\/src|apps\/asyra-design\/src\/(ai|constants\/feature-names\.ts|features\/ai-agent|init\/init-app\.ts|init\/foundation\/init-features\.ts|common-apis|providers|collaboration))/

  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.match(
        boundary,
        allowedBoundary,
        `${item.id} boundary outside Gate 4 allowlist: ${boundary}`
      )
    })
  })
})

test('all local specification anchors resolve', () => {
  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = anchorsIn(markdown)
  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.invariants.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.ok(reference.startsWith('#'), `external spec ref: ${reference}`)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })
})

test('Feature System and app adapters retain lifecycle and domain ownership', () => {
  const feature = contractText(step('route-natural-language-intent'))
  const context = contractText(step('collect-app-context'))
  const permission = contractText(step('evaluate-app-permissions'))
  const confirmation = contractText(step('preview-confirm-plan'))
  const transaction = contractText(step('run-plan-transaction'))
  const actions = contractText(step('execute-app-actions'))

  assert.equal(
    step('route-natural-language-intent').ownerPackage,
    'app-owned @asyra/feature-system Feature'
  )
  assert.match(feature, /priority\/exclusive.*execute\/session\/cancel/i)
  assert.match(feature, /no second command\/session queue/i)
  assert.match(context, /app-owned context/i)
  assert.match(permission, /app-owned permission policy/i)
  assert.match(confirmation, /app confirmation UI\/handler/i)
  assert.match(
    transaction,
    /runner is invoked exactly once for one accepted plan/i
  )
  assert.match(actions, /app common\/public APIs/i)
  assert.match(actions, /unregistered action or model-provided function/i)
})

test('runtime owns orchestration without app semantics or canonical state', () => {
  const registry = contractText(step('describe-action-registry'))
  const normalize = contractText(step('normalize-provider-result'))
  const validate = contractText(step('validate-complete-plan'))
  const canonical = contractText(step('mutate-canonical-state'))
  const audit = contractText(step('produce-redacted-audit'))

  assert.equal(
    step('describe-action-registry').ownerPackage,
    '@asyra/ai-agent-runtime action registry'
  )
  assert.equal(
    step('validate-complete-plan').ownerPackage,
    '@asyra/ai-agent-runtime'
  )
  assert.match(
    registry,
    /app ownership of names, schemas, permission meaning, and executors/i
  )
  assert.match(normalize, /untrusted output/i)
  assert.match(normalize, /finite, opt-in, provider-stage-only/i)
  assert.match(validate, /complete ordered plan validates before/i)
  assert.match(validate, /No valid prefix/i)
  assert.match(
    canonical,
    /same Scene Tree, Props Manager, System Context, or Selection owners/i
  )
  assert.match(canonical, /No model plan or audit value becomes canonical/i)
  assert.match(audit, /redacted recursively/i)
  assert.match(
    audit,
    /cannot alter plan, executor, transaction, or canonical state/i
  )
})

test('complete preflight precedes the first transaction and mutation steps', () => {
  const order = new Map(data.steps.map((item) => [item.id, item.order]))
  const preflight = [
    'normalize-provider-result',
    'validate-complete-plan',
    'evaluate-app-permissions',
    'preview-confirm-plan'
  ]

  preflight.forEach((id) => {
    assert.ok(order.get(id) < order.get('run-plan-transaction'), id)
    assert.ok(order.get(id) < order.get('execute-app-actions'), id)
    assert.ok(order.get(id) < order.get('mutate-canonical-state'), id)
  })

  const validationFailure = data.routes.find(
    (route) => route.id === 'fail-complete-validation'
  )
  const permissionDenial = data.routes.find(
    (route) => route.id === 'deny-complete-plan'
  )
  const confirmationCancel = data.routes.find(
    (route) => route.id === 'cancel-confirmation'
  )

  ;[validationFailure, permissionDenial, confirmationCancel].forEach(
    (route) => {
      assert.equal(route.to, 'cleanup-feature-invocation')
    }
  )
})

test('provider adapter is generic, replaceable, bounded, and secret-safe', () => {
  const compose = contractText(step('compose-ai-runtime'))
  const provider = contractText(step('request-provider-plan'))
  const normalize = contractText(step('normalize-provider-result'))

  assert.match(provider, /GenericHttpAiProvider/i)
  assert.match(provider, /platform or injected fetch/i)
  assert.match(provider, /browser-held server API key reads/i)
  assert.match(provider, /Deterministic fake providers replace this adapter/i)
  assert.match(normalize, /bounding provider-only retry/i)
  assert.match(compose, /never reads a browser-held server API key/i)
})

test('transaction, projection, collaboration, and cleanup routes preserve existing owners', () => {
  const transaction = contractText(step('settle-plan-transaction'))
  const projection = contractText(step('project-derived-output'))
  const collaboration = contractText(step('transport-optional-publication'))
  const cleanup = contractText(step('cleanup-feature-invocation'))

  assert.match(transaction, /one intended undo entry/i)
  assert.match(transaction, /roll back its complete rollbackable journal/i)
  assert.match(transaction, /same Factory publication path/i)
  assert.match(projection, /same canonical state-owner change route/i)
  assert.match(
    projection,
    /No AI-specific renderer, patch geometry, or fallback state/i
  )
  assert.match(collaboration, /unchanged transport-only route/i)
  assert.match(
    collaboration,
    /does not add dedupe, permission, conflict, ordering, persistence, or recovery policy/i
  )
  assert.match(
    cleanup,
    /Exactly one terminal executed, cancelled, unavailable, or failed result/i
  )
  assert.match(cleanup, /Feature System.*sole lifecycle owner/i)
  assert.match(cleanup, /borrowed app\/provider resources/i)
})

test('acceptance contracts cover every bounded Gate 4 product family', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /AI-disabled app startup creates no provider, runtime, Feature, listener, timer, network request, or secret read/i,
    /duplicate names reject without replacement.*unknown actions never execute/i,
    /complete plan before any executor call.*invalid later action rejects every earlier valid prefix/i,
    /Any denial rejects the complete plan before transaction execution/i,
    /one immutable complete preview.*accepted\/cancelled outcomes/i,
    /valid multi-action plan invokes one transaction runner.*executors in plan order/i,
    /rolls back all rollbackable writes.*no accepted canonical prefix/i,
    /retry is bounded and never repeats a transaction/i,
    /Abort, timeout, and disposal release request timers\/listeners\/attempt state/i,
    /Authorization, token, api-key, configured secret keys.*redacted/i,
    /do not share action definitions, provider calls, policy results, abort\/timeout state, retries, audit results, or disposal/i,
    /optional AI-originated shared mutations follow the ordinary Factory and Gate 2 publication route/i,
    /Formal tests and CI require no live endpoint or API key/i
  ].forEach((pattern) => assert.match(text, pattern))
})
