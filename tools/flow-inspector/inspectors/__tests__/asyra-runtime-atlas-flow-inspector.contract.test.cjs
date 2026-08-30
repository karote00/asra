const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-runtime-atlas-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Runtime Atlas Inspector step: ${id}`)
  return value
}

test('Runtime Atlas authority resolves documentation, current Landing contract, and workspace', () => {
  Object.values(data.authority).forEach((filePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, filePath)), filePath)
  })
  assert.equal('exampleInventoryPath' in data.authority, false)
  assert.equal('visualHandoffPath' in data.authority, false)
  assert.match(data.authority.landingContractPath, /landing-page-plan\.md$/)
})

test('Runtime Atlas owns six exact, unique cases mapped to advanced guides', () => {
  assert.deepEqual(data.caseIds, [
    'continuous-pointer-undo',
    'canonical-projection-fanout',
    'invalid-input-rollback',
    'collaboration-two-actors',
    'ai-registered-action',
    'machine-retrieval-action'
  ])
  assert.equal(new Set(data.caseIds).size, 6)

  const contentIndex = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, data.authority.contentIndexPath),
      'utf8'
    )
  )
  const guideIds = new Set(contentIndex.pages.map(({ id }) => id))
  data.caseIds.forEach((caseId) => {
    const mappings = data.guideMappings[caseId]
    assert.ok(mappings.length > 0, caseId)
    mappings.forEach((guideId) => assert.ok(guideIds.has(guideId)))
  })
})

test('contract freezes global comprehension, current browser support, and evidence origin', () => {
  const source = JSON.stringify(step('freeze-atlas-contract'))
  assert.match(source, /non-engineer can understand intent, owner/i)
  assert.match(source, /six case ids and advanced-guide mappings/i)
  assert.match(source, /isolated browser composition/i)
  assert.match(source, /detached executing-runtime evidence/i)
  assert.match(source, /package-private source/i)
  assert.match(source, /future server or Headless lifecycle claim/i)
})

test('browser harness owns reset isolation, stepping, replay, and visible failure', () => {
  const source = JSON.stringify(step('compose-browser-runtime-harness'))
  assert.match(source, /terminates the prior worker/i)
  assert.match(source, /Run ids and evidence sequences are monotonic/i)
  assert.match(source, /Pause stops automatic UI advancement/i)
  assert.match(source, /Unexpected failure terminates visibly/i)
  assert.match(source, /shared worker state across cases/i)
  assert.match(source, /React state as canonical evidence/i)
})

test('canonical cases preserve transaction, projection, and rollback owners', () => {
  const canonical = step('execute-canonical-runtime-cases')
  const source = JSON.stringify(canonical)
  assert.match(source, /Three pointer updates settle as exactly one new Undo unit/i)
  assert.match(source, /One Feature API mutation returns canonical state/i)
  assert.match(source, /Rejected input rolls back completely/i)
  assert.match(source, /@asyra\/feature-system/i)
  assert.match(source, /pixel-derived success/i)
  assert.ok(
    canonical.implementationBoundary.includes(
      'apps/asyra-framework-site/package.json'
    )
  )
  assert.ok(canonical.implementationBoundary.includes('yarn.lock'))
  assert.ok(
    canonical.implementationBoundary.includes(
      'apps/asyra-framework-site/__tests__/runtime-atlas-harness.test.mjs'
    )
  )
})

test('optional cases preserve Collaboration, AI, and retrieval boundaries', () => {
  const optional = step('execute-optional-composition-cases')
  const source = JSON.stringify(optional)
  assert.match(source, /Two explicitly started browser actors converge/i)
  assert.match(source, /prepared AI action executes through registered App policy/i)
  assert.match(source, /Retrieval is read-only/i)
  assert.match(source, /AI direct canonical mutation/i)
  assert.match(source, /Awareness as canonical state/i)
  assert.ok(
    optional.implementationBoundary.includes(
      'apps/asyra-framework-site/package.json'
    )
  )
  assert.ok(optional.implementationBoundary.includes('yarn.lock'))
  assert.ok(
    optional.implementationBoundary.includes(
      'apps/asyra-framework-site/lib/runtime-atlas/case-definitions.mjs'
    )
  )
  assert.ok(
    optional.implementationBoundary.includes(
      'apps/asyra-framework-site/__tests__/runtime-atlas-harness.test.mjs'
    )
  )
})

test('presentation keeps plain language first and projections App-owned', () => {
  const source = JSON.stringify(step('present-atlas-experience'))
  assert.match(source, /Plain-language purpose and expected outcome precede/i)
  assert.match(source, /Run, Pause, Step, Replay, Reset/i)
  assert.match(source, /Canvas, hierarchy, properties, serialization, search, and presence are visibly App-owned/i)
  assert.match(source, /reduced-motion, mobile, and wide states/i)
  assert.match(source, /presentation-generated canonical result/i)
  assert.match(source, /warm paper, near-black, signal red/i)
  assert.doesNotMatch(source, /Cosmic Atlas/i)
})

test('verification requires six fresh browser cases and synchronized product evidence', () => {
  const source = JSON.stringify(step('verify-runtime-atlas'))
  assert.match(source, /All six cases execute from fresh runtimes/i)
  assert.match(source, /strict typecheck, lint, build, route smoke/i)
  assert.match(source, /320px/i)
  assert.match(source, /200 percent zoom/i)
  assert.match(source, /reset isolation/i)
  assert.match(source, /Node-only execution used as browser proof/i)
})

test('Runtime Atlas routes, artifacts, failure owners, and cache boundaries resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )

  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactOwners.size, data.artifacts.length)
  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0, item.id)
    assert.ok(item.specRefs.length > 0, item.id)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), route.id)
    assert.ok(stepIds.has(route.to), route.id)
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from, route.id)
    })
  })
})

test('Runtime Atlas invariants preserve audience, evidence, ownership, Roadmap, and deployment boundaries', () => {
  const source = JSON.stringify(data.invariants)
  assert.match(source, /worldwide non-engineer/i)
  assert.match(source, /fresh executing browser runtime/i)
  assert.match(source, /optional Provider/i)
  assert.match(source, /never become canonical owners/i)
  assert.match(source, /never become built-in Framework capabilities/i)
  assert.match(source, /remains Roadmap/i)
  assert.match(source, /Production deployment remains outside/i)
})
