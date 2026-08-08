/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../create-asyra-design-app-release-flow-inspector.data.cjs')
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

test('create-app release Inspector authority and exact owners resolve', () => {
  assert.equal(data.target.id, 'create-asyra-design-app-release')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/create-asyra-design-app-release-plan.md'
  )
  assert.equal(data.steps.length, 12)
  assert.deepEqual(
    data.steps.map((item) => item.id),
    [
      'decide-release-versions',
      'own-canonical-app-source',
      'transform-generated-template',
      'verify-template-identity',
      'materialize-cli-version',
      'pack-cli-artifact',
      'invoke-packed-cli',
      'install-generated-app-from-registry',
      'prove-generated-app-behavior',
      'publish-cli',
      'smoke-public-cli',
      'record-release-decision'
    ]
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
})

test('every owner has exact execution fields, cleanup ownership, and no cache', () => {
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

  assert.equal(laneIds.size, data.lanes.length)
  assert.equal(stepIds.size, data.steps.length)

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

test('routes and artifacts resolve to one owner and declared consumers', () => {
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
      assert.equal(artifact.ownerStepId, route.from)
      if (route.to) assert.ok(artifact.consumerStepIds.includes(route.to))
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
      assert.ok(step(consumerId).inputs.includes(artifact.id))
    })
    if (!artifact.terminal) assert.ok(artifact.consumerStepIds.length > 0)
  })
})

test('all Inspector specification anchors resolve', () => {
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

test('CLI version materialization is user-selected, manual, and precedes packing', () => {
  const decision = contractText(step('decide-release-versions'))
  const materialize = contractText(step('materialize-cli-version'))
  const pack = step('pack-cli-artifact')
  const publication = contractText(step('publish-cli'))

  assert.match(decision, /registry-verified Framework dependency versions/i)
  assert.match(decision, /CLI target.*selected by the user/i)
  assert.match(decision, /root.*unchanged/i)
  assert.match(decision, /publication.*blocked/i)
  assert.match(materialize, /manual/i)
  assert.match(materialize, /selected CLI target/i)
  assert.match(materialize, /Changeset/i)
  assert.match(materialize, /root.*unchanged/i)
  assert.ok(pack.inputs.includes('artifact:versioned-cli-source'))
  assert.match(publication, /explicit.*CLI version/i)
  assert.match(publication, /clean.*source commit/i)
  assert.match(publication, /feature branch/i)
  assert.doesNotMatch(publication, /clean latest main/i)
  assert.doesNotMatch(publication, /reviewed.*merged/i)
  assert.match(publication, /authorization/i)
  assert.doesNotMatch(JSON.stringify(data), /0\.\d+\.(?:\d+|n)/u)
})

test('template is generated-only and registry proof rejects local substitutions', () => {
  const source = contractText(step('own-canonical-app-source'))
  const transform = contractText(step('transform-generated-template'))
  const identity = contractText(step('verify-template-identity'))
  const install = contractText(step('install-generated-app-from-registry'))

  assert.match(source, /apps\/asyra-design/i)
  assert.match(transform, /never.*hand-edit/i)
  assert.match(transform, /repository-only.*runtime artifacts/i)
  assert.match(identity, /manifest version/i)
  assert.match(identity, /license/i)
  assert.match(
    install,
    /no workspace.*link.*portal.*file.*tarball.*resolutions/i
  )
  assert.match(install, /public npm registry/i)
})

test('behavior proof covers tests, build, startup, interactions, and disabled side effects', () => {
  const behavior = contractText(step('prove-generated-app-behavior'))

  assert.match(behavior, /typecheck.*build.*formal tests.*startup/i)
  assert.match(behavior, /create.*drag.*property.*undo.*redo/i)
  assert.match(behavior, /Collaboration.*AI.*disabled.*side effects/i)
  assert.match(behavior, /screenshot/i)
})

test('publication and public smoke are isolated irreversible checkpoints', () => {
  const publication = contractText(step('publish-cli'))
  const smoke = contractText(step('smoke-public-cli'))
  const decision = contractText(step('record-release-decision'))

  assert.match(publication, /only create-asyra-design-app/i)
  assert.match(publication, /first npm publish.*explicit authorization/i)
  assert.match(smoke, /published.*npm create|npm create.*published/i)
  assert.match(decision, /READY.*BLOCKED/i)
  assert.match(decision, /user acceptance/i)
})
