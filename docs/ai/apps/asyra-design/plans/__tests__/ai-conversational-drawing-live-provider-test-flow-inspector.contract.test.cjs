const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-live-provider-test-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

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
  'authorize-live-provider-test-run',
  'accept-explicit-live-test-intent',
  'request-live-provider-candidate',
  'validate-and-orchestrate-live-candidate',
  'execute-registered-live-app-actions',
  'evaluate-redacted-live-provider-evidence'
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

test('live-provider Inspector authorities and second-successor routing resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Conversational AI Live Provider Formal Test Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '../ai-conversational-drawing-live-provider-test-flow-inspector.html'
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
    /Current active plan:\s+`plans\/ai-conversational-drawing-plan\.md`/
  )
  assert.match(
    plansIndex,
    /Ordered proposed next implementation plans:\s*\n\s*1\.\s+`plans\/ai-conversational-drawing-performance-plan\.md`\s*\n\s*2\.\s+`plans\/ai-conversational-drawing-live-provider-test-plan\.md`/
  )
})

test('live-provider Inspector exposes six exact single-owner steps', () => {
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

test('live-provider Inspector paths and specification anchors resolve', () => {
  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = new Set(
    markdown
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
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing implementation root ${boundary}`
      )
    })
  })
})

test('live-provider routes and artifacts form one exact owner graph', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactById = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )
  assert.equal(artifactById.size, data.artifacts.length)

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    const owner = step(artifact.ownerStepId)
    assert.ok(
      owner.outputs.includes(artifact.id),
      `${artifact.id} owner output`
    )
    assert.equal(artifact.terminal, artifact.consumerStepIds.length === 0)
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} consumer`)
      assert.ok(
        step(consumerId).inputs.includes(artifact.id),
        `${artifact.id} consumer input`
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

test('credential request, storage, and spend boundaries are exact', () => {
  const authorization = contractText(step('authorize-live-provider-test-run'))
  const proxy = contractText(step('request-live-provider-candidate'))
  const proof = contractText(step('evaluate-redacted-live-provider-evidence'))

  assert.match(authorization, /human provider account owner/i)
  assert.match(authorization, /dedicated project-scoped test key/i)
  assert.match(authorization, /API-key value is never an artifact/i)
  assert.match(authorization, /at most eight vendor requests/i)
  assert.match(authorization, /five live-provider minutes/i)
  assert.match(authorization, /USD 2\.00/i)
  assert.match(authorization, /45 seconds per request/i)

  assert.match(proxy, /server-only ASYRA_DESIGN_LIVE_AI_TEST_API_KEY secret/)
  assert.match(proxy, /browser.*sends no vendor key or authorization value/i)
  assert.match(proxy, /loopback.*only the test App origin/i)
  assert.match(proxy, /Raw vendor bodies.*stable redacted failures/i)
  assert.match(proof, /leaked secret.*cannot produce formal proof/i)
})

test('explicit live activation cannot affect disabled or Mock authority', () => {
  const plan = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const intent = contractText(step('accept-explicit-live-test-intent'))
  const proof = contractText(step('evaluate-redacted-live-provider-evidence'))

  assert.match(plan, /exact server-side opt-in `ASYRA_DESIGN_LIVE_AI_TEST=1`/)
  assert.match(plan, /exactly one `ai=live-test` URL value/)
  assert.match(plan, /query value alone is insufficient/i)
  assert.match(
    plan,
    /explicitly requests a live run but the key[\s\S]*fails before browser launch/
  )
  assert.match(intent, /Exact ai=mock remains isolated.*network-free.*keyless/i)
  assert.match(intent, /silent Mock fallback presented as live evidence/i)
  assert.match(proof, /cannot accept Mock fallback as live success/i)
})

test('live candidate remains untrusted and preserves App owners', () => {
  const proxy = contractText(step('request-live-provider-candidate'))
  const runtime = contractText(step('validate-and-orchestrate-live-candidate'))
  const app = contractText(step('execute-registered-live-app-actions'))

  assert.match(proxy, /detached and untrusted/i)
  assert.match(
    proxy,
    /grants no validation.*permission.*transaction.*mutation/i
  )
  assert.match(
    runtime,
    /complete candidate normalizes and passes every registered action schema/i
  )
  assert.match(runtime, /before permission, confirmation, transaction/i)
  assert.match(runtime, /retry after transaction entry is forbidden/i)
  assert.match(runtime, /never provider bodies.*chain-of-thought/i)
  assert.match(
    app,
    /revalidates each canonical id immediately before mutation/i
  )
  assert.match(
    app,
    /budgets never become an App item.*point.*composition acceptance ceiling/i
  )
  assert.match(app, /exactly one intended Undo action/i)
  assert.match(app, /recoverable per-object failure.*partial evidence/i)
  assert.match(app, /fatal consistency failure.*rolls back/i)
  assert.match(app, /never regenerate the complete composition/i)
})

test('formal live evidence stays opt-in and Mock remains exact authority', () => {
  const plan = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const proof = contractText(step('evaluate-redacted-live-provider-evidence'))

  assert.match(plan, /formal, explicitly opt-in acceptance suite/i)
  assert.match(plan, /not part of ordinary CI/i)
  assert.match(plan, /do not assert exact prose/i)
  assert.match(plan, /deterministic Mock\/VTracer suite remains authoritative/i)
  assert.match(proof, /Mock and VTracer suites remain deterministic merge-CI/i)
  assert.match(proof, /same live App state/i)
  assert.match(
    proof,
    /reports, screenshots, videos, and traces remain ignored/i
  )
})

test('live-provider BDD registers credentialed success and failure cases', () => {
  const feature = fs.readFileSync(
    path.resolve(
      repoRoot,
      'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-live-provider-test.feature'
    ),
    'utf8'
  )

  assert.match(
    feature,
    /Scenario: Default and Mock test commands never require a live API key/
  )
  assert.match(
    feature,
    /Scenario: An explicit live run fails before launch when the key is missing/
  )
  assert.match(
    feature,
    /Scenario: A dedicated key stays inside the proxy process/
  )
  assert.match(
    feature,
    /Scenario: A live model interprets the committed cat reference safely/
  )
  assert.match(
    feature,
    /Scenario: A live follow-up changes only revalidated existing whiskers/
  )
  assert.match(
    feature,
    /Scenario: Credential and provider failures are stable and redacted/
  )
  assert.match(
    feature,
    /deterministic Mock and VTracer tests should remain merge-CI/i
  )
})
