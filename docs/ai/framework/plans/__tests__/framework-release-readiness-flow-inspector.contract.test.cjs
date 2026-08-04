/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../framework-release-readiness-flow-inspector.data.cjs')
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

test('Gate 5 Inspector and product authorities resolve', () => {
  assert.equal(data.target.id, 'framework-release-readiness')
  assert.equal(
    data.target.title,
    'Framework Release Readiness Flow Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'framework-release-readiness-flow-inspector.html'
      )
    )
  )
})

test('every Gate 5 owner step has exact execution and cleanup fields', () => {
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
    assert.match(
      item.conditions.join(' '),
      /Cleanup owner:/,
      `${item.id} lacks cleanup owner`
    )
  })
})

test('every Gate 5 route and artifact resolves to one owner', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
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

test('all Gate 5 specification anchors resolve', () => {
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

test('Inspector assigns each required Gate 5 owner exactly once', () => {
  assert.equal(
    step('freeze-release-source').ownerPackage,
    'Framework Release Gate 5 source contract'
  )
  assert.equal(
    step('build-package-artifacts').ownerPackage,
    'Gate 5 package artifact builder'
  )
  assert.equal(
    step('validate-package-artifacts').ownerPackage,
    'Gate 5 package artifact verifier'
  )
  assert.equal(
    step('verify-clean-consumer').ownerPackage,
    'Gate 5 clean-consumer fixture'
  )
  assert.equal(
    step('verify-generated-template').ownerPackage,
    'Asyra Design release-template generator'
  )
  assert.equal(
    step('run-formal-release-gates').ownerPackage,
    'Root release-validation workflow'
  )
  assert.equal(
    step('synchronize-release-docs').ownerPackage,
    'Framework and Asyra Design documentation owners'
  )
  assert.equal(
    step('verify-versioning-contract').ownerPackage,
    'Changesets and framework release-record owner'
  )
  assert.equal(
    step('decide-release-readiness').ownerPackage,
    'Framework Release Gate 5 decision owner'
  )
  assert.ok(
    step('freeze-release-source').implementationBoundary.includes(
      'scripts/framework-release-packages.js'
    )
  )
  assert.ok(
    step('freeze-release-source').implementationBoundary.includes(
      'scripts/__tests__/framework-release-packages.test.mjs'
    )
  )
})

test('package and consumer steps forbid workspace-only proof', () => {
  const build = contractText(step('build-package-artifacts'))
  const validate = contractText(step('validate-package-artifacts'))
  const consumer = contractText(step('verify-clean-consumer'))

  assert.match(build, /publishable internal dependency ranges/i)
  assert.match(build, /no registry publication/i)
  assert.match(validate, /no workspace protocol, path dependency/i)
  assert.match(validate, /repository node_modules resolution/i)
  assert.match(consumer, /install only validated tarballs/i)
  assert.match(consumer, /no monorepo path mapping/i)
  assert.match(consumer, /never falls back to workspace packages/i)
})

test('consumer contract covers public Core, Preset, Group, Collaboration, and AI flows', () => {
  const consumer = contractText(step('verify-clean-consumer'))

  assert.match(consumer, /Headless Core initialization/i)
  assert.match(consumer, /transaction plus undo\/redo/i)
  assert.match(consumer, /save\/load migration/i)
  assert.match(consumer, /Preset 2D initialization/i)
  assert.match(consumer, /Group group\/ungroup/i)
  assert.match(consumer, /two-peer Collaboration converges/i)
  assert.match(consumer, /opt-in AI executes registered app actions/i)
  assert.match(consumer, /AI-disabled consumer creates no AI runtime/i)
  assert.match(
    consumer,
    /Collaboration-disabled consumer creates no provider, room, Awareness/i
  )
})

test('template, docs, and versioning cannot wrap an upstream failure', () => {
  const template = contractText(step('verify-generated-template'))
  const docs = contractText(step('synchronize-release-docs'))
  const versioning = contractText(step('verify-versioning-contract'))

  assert.match(template, /manual implementation edits under create-app/i)
  assert.match(template, /never becomes the source authority/i)
  assert.match(docs, /cannot relabel a failed artifact or product flow as ready/i)
  assert.match(docs, /unavailable 3D\/HYBRID/i)
  assert.match(versioning, /actual release-cut action/i)
  assert.match(versioning, /No version, tag, registry record/i)
})

test('READY requires all evidence and preserves release authority boundary', () => {
  const gates = contractText(step('run-formal-release-gates'))
  const decision = contractText(step('decide-release-readiness'))

  assert.match(gates, /performance budgets and synchronized visual cases pass/i)
  assert.match(gates, /no unresolved P0\/P1\/P2 review finding/i)
  assert.match(decision, /READY requires package, clean-consumer/i)
  assert.match(decision, /BLOCKED lists every still-relevant exact owner/i)
  assert.match(decision, /retaining this Inspector as architecture authority/i)
  assert.match(
    decision,
    /merge, tag, registry publication, deployment, and formal release remain user-owned/i
  )
})

test('acceptance contracts cover every Gate 5 owner step', () => {
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  )
})
