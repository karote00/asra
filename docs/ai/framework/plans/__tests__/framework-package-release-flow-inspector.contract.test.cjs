/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../framework-package-release-flow-inspector.data.cjs')
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

test('Framework package release Inspector authorities resolve', () => {
  assert.equal(data.target.id, 'framework-package-release-0-5-0')
  assert.equal(data.target.title, 'Framework Package 0.5.0 Release Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/framework-package-patch-release-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/framework-package-release-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'framework-package-release-flow-inspector.html'
      )
    )
  )
})

test('every release owner has exact execution fields and no cache', () => {
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
  assert.equal(data.steps.length, 11)

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

test('every release route and artifact resolves to exactly one owner', () => {
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

test('all release specification anchors resolve', () => {
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

test('Inspector preserves the historical 0.2.5 boundary without publishing it', () => {
  const inventory = contractText(step('inventory-public-registry'))
  const classification = contractText(step('classify-historical-baseline'))

  assert.match(inventory, /12 historical.*seven missing/i)
  assert.match(inventory, /public npm registry/i)
  assert.match(classification, /expected source-generation difference/i)
  assert.match(classification, /must not publish.*0\.2\.5/i)
})

test('Inspector owns the exact 0.4.0 to minor to 0.5.0 path', () => {
  const baseline = contractText(step('materialize-local-baseline'))
  const generator = contractText(step('generate-synchronized-changeset'))
  const version = contractText(step('materialize-framework-version'))

  assert.match(baseline, /exactly 19.*0\.4\.0/i)
  assert.match(baseline, /never be published/i)
  assert.match(generator, /--type minor/i)
  assert.match(generator, /exactly once/i)
  assert.match(generator, /ordinary scoped Changesets/i)
  assert.match(version, /0\.4\.0.*0\.5\.0/i)
  assert.match(version, /root.*private.*create-app/i)
  assert.ok(
    step('generate-synchronized-changeset').implementationBoundary.includes(
      'package.json'
    )
  )
})

test('Framework artifact validation owns CI scope and excludes create-app template proof', () => {
  const validationStep = step('validate-framework-artifacts')
  const validation = contractText(validationStep)

  assert.match(validation, /generated create-app template/i)
  assert.ok(validationStep.forbiddenContributors.includes(
    'generated create-app template'
  ))
  assert.ok(
    validationStep.implementationBoundary.includes(
      '.github/workflows/main.yml'
    )
  )
  assert.ok(
    validationStep.implementationBoundary.includes(
      'scripts/__tests__/workspace-automation.test.mjs'
    )
  )
})

test('Inspector restricts Changesets publication to the fixed 19-package set', () => {
  const publicationSource = contractText(step('accept-publication-source'))
  const publication = contractText(step('publish-framework-packages'))
  const verification = contractText(step('verify-public-registry'))

  assert.match(publicationSource, /clean.*source commit/i)
  assert.match(publicationSource, /feature branch.*publication/i)
  assert.doesNotMatch(publicationSource, /not.*feature branch/i)
  assert.doesNotMatch(publicationSource, /unmerged.*source/i)
  assert.match(publication, /yarn changeset publish/i)
  assert.match(publication, /successful.*package.*Git tag/i)
  assert.doesNotMatch(publication, /--no-git-tag/i)
  assert.match(publication, /exactly the fixed 19-package allowlist/i)
  assert.match(publication, /restore.*workspace ranges/i)
  assert.match(publication, /create-asyra-design-app.*root.*private/i)
  assert.match(verification, /all 19.*0\.5\.0/i)
  assert.match(verification, /dist integrity/i)
  assert.match(verification, /push.*tag/i)
})

test('registry-only proof and partial recovery cannot create a mixed final version', () => {
  const recovery = contractText(step('prove-registry-consumer-and-recover'))

  assert.match(recovery, /no tarball.*workspace.*link.*portal.*resolution/i)
  assert.match(recovery, /0\.5\.0.*0\.5\.1/i)
  assert.match(recovery, /never overwrite/i)
  assert.match(recovery, /mixed final version/i)
})

test('acceptance contracts cover every release owner step', () => {
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  )
})
