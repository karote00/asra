/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../node-24-runtime-upgrade-flow-inspector.data.cjs')
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

test('Node.js 24 Inspector authorities and entry resolve', () => {
  assert.equal(data.target.id, 'node-24-runtime-upgrade')
  assert.equal(data.target.title, 'Node.js 24 Runtime Upgrade Flow Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/node-24-runtime-upgrade-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'node-24-runtime-upgrade-flow-inspector.html'
      )
    )
  )
})

test('Node.js 24 Inspector defines exactly nine complete owner steps', () => {
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

  assert.equal(stepIds.size, data.steps.length)
  assert.equal(data.steps.length, 9)

  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredFields)
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
    assert.match(item.conditions.join(' '), /Cleanup owner:/)
  })
})

test('Node.js 24 Inspector assigns every required owner once', () => {
  assert.equal(
    step('freeze-runtime-source').ownerPackage,
    'Repository root runtime contract'
  )
  assert.equal(
    step('validate-manifest-compatibility').ownerPackage,
    'Workspace manifest runtime contract'
  )
  assert.equal(
    step('validate-package-release-scripts').ownerPackage,
    'Framework release runtime validation'
  )
  assert.equal(
    step('validate-generated-template').ownerPackage,
    'Official Design App template generator'
  )
  assert.equal(
    step('validate-ci-runtime').ownerPackage,
    'GitHub Actions runtime configuration'
  )
  assert.equal(
    step('validate-asyra-design-runtime').ownerPackage,
    'Design App local runtime validation'
  )
  assert.equal(
    step('validate-vercel-runtime').ownerPackage,
    'Linked Design App Vercel project'
  )
  assert.equal(
    step('synchronize-runtime-support').ownerPackage,
    'Framework and Design App support documentation'
  )
  assert.equal(
    step('decide-node-24-readiness').ownerPackage,
    'Node.js 24 migration readiness decision'
  )
})

test('routes and artifacts retain one valid owner and declared consumers', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length)
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length
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
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
      assert.ok(step(consumerId).inputs.includes(artifact.id))
    })
    if (!artifact.terminal) {
      assert.ok(artifact.consumerStepIds.length > 0, `${artifact.id} consumer`)
    }
  })
})

test('all Node.js 24 specification anchors resolve', () => {
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

test('runtime surfaces remain distinct and Vercel owns build plus function proof', () => {
  const local = contractText(step('validate-asyra-design-runtime'))
  const vercel = contractText(step('validate-vercel-runtime'))
  const decision = contractText(step('decide-node-24-readiness'))

  assert.match(local, /Browser pass does not waive a local build, server/i)
  assert.match(local, /browser-only pass never produces artifact:local-node/i)
  assert.match(vercel, /preview build log reports the actual Node\.js 24/i)
  assert.match(vercel, /Every project-owned Vercel function or middleware/i)
  assert.match(vercel, /explicitly records not-applicable/i)
  assert.match(vercel, /without exposing values/i)
  assert.match(
    decision,
    /browser-only or frontend-only evidence for build\/server\/function runtime/i
  )
})

test('implementation boundaries preserve generator, CI, Vercel, and closeout owners', () => {
  assert.ok(
    step('freeze-runtime-source').implementationBoundary.includes(
      'scripts/__tests__/node-runtime-contract.test.mjs'
    )
  )
  assert.ok(
    step('validate-manifest-compatibility').implementationBoundary.includes(
      'packages/*/package.json'
    )
  )
  assert.ok(
    step('validate-generated-template').implementationBoundary.includes(
      'scripts/release-template.js'
    )
  )
  assert.equal(
    step('validate-package-release-scripts').implementationBoundary.includes(
      'scripts/release-records.js'
    ),
    false
  )
  assert.ok(
    step('validate-ci-runtime').implementationBoundary.includes(
      '.github/workflows/main.yml'
    )
  )
  assert.ok(
    step('validate-vercel-runtime').implementationBoundary.includes(
      'existing linked Design App Vercel Project Settings'
    )
  )
  assert.ok(
    step('decide-node-24-readiness').implementationBoundary.includes(
      'docs/ai/framework/PLANS.md'
    )
  )
  assert.ok(
    step('synchronize-runtime-support').implementationBoundary.includes(
      'scripts/release-records.js'
    )
  )
})

test('READY requires all owner evidence and preserves release boundaries', () => {
  const decision = contractText(step('decide-node-24-readiness'))

  assert.match(decision, /READY requires every non-finding evidence artifact/i)
  assert.match(decision, /no unresolved P0\/P1\/P2 finding/i)
  assert.match(decision, /BLOCKED with the first incorrect canonical owner/i)
  assert.match(
    decision,
    /package version bump, Changeset, registry publication, tag, merge, production deployment, or formal release/i
  )
})

test('acceptance contracts cover every Node.js 24 owner step', () => {
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  )
})
