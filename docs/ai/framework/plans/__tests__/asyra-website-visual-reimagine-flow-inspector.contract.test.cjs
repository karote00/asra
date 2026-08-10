const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-visual-reimagine-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const visualRoot = path.join(
  repoRoot,
  'docs/ai/framework/website/visual-reimagine'
)
const manifest = JSON.parse(
  fs.readFileSync(path.join(visualRoot, 'concept-manifest.json'), 'utf8')
)
const handoff = fs.readFileSync(path.join(visualRoot, 'handoff.md'), 'utf8')

const inspectPng = (filePath) => {
  const content = fs.readFileSync(filePath)
  assert.equal(
    content.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${filePath} must be a PNG`
  )
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
    sha256: crypto.createHash('sha256').update(content).digest('hex')
  }
}

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Visual Reimagine Inspector step: ${id}`)
  return value
}

test('visual authority freezes three directions and the exact view-state set', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.inspectorPath)))
  assert.deepEqual(data.directionIds, [
    'topology-observatory',
    'material-blueprint',
    'signal-ledger'
  ])
  assert.equal(data.viewStateIds.length, 14)
  assert.equal(new Set(data.viewStateIds).size, 14)
  assert.equal(data.conceptPaths.length, 8)
  assert.equal(new Set(data.conceptPaths).size, 8)
})

test('visual brief preserves product, asset, and acceptance boundaries', () => {
  const source = JSON.stringify([step('freeze-visual-brief'), data.invariants])
  assert.match(
    source,
    /Current runtime, optional composition, app-owned domains, and future work/i
  )
  assert.match(source, /No external asset, font, dependency/i)
  assert.match(source, /generic documentation templates/i)
  assert.match(source, /global non-engineer/i)
  assert.match(source, /final integrated-goal acceptance/i)
})

test('concept generation keeps images as inspected evidence', () => {
  const source = JSON.stringify(step('generate-concept-directions'))
  assert.match(source, /three coherent, original full-page directions/i)
  assert.match(source, /useful-scale PNG inspected/i)
  assert.match(source, /generated words as verified product copy/i)
  assert.match(source, /website source code or production assets/i)
})

test('selection owns responsive, Atlas, failure, and reduced-motion states', () => {
  const source = JSON.stringify([
    step('select-and-refine-direction'),
    data.acceptanceContracts
  ])
  assert.match(source, /All fourteen required view states/i)
  assert.match(
    source,
    /Long-form reading, focus visibility, touch targets, failure state/i
  )
  assert.match(source, /reduced-motion equivalence/i)
  assert.match(source, /plain international English/i)
  assert.match(
    source,
    /Desktop, mobile, reading, navigation, active, failure, case, roadmap, and motion/i
  )
})

test('handoff owns semantic tokens without becoming website implementation', () => {
  const source = JSON.stringify(step('annotate-visual-handoff'))
  assert.match(source, /semantic tokens without authoring website components/i)
  assert.match(source, /Generated imagery remains evidence/i)
  assert.match(source, /worldwide technical and non-technical audience/i)
  assert.match(source, /component implementation/i)
  assert.match(source, /new product claims/i)
})

test('verification fails closed on incomplete or implementation-dependent evidence', () => {
  const source = JSON.stringify(step('verify-visual-handoff'))
  assert.match(source, /manifest, eight PNG boards, handoff, Inspector/i)
  assert.match(source, /Every image is inspected/i)
  assert.match(source, /thumbnail-only review/i)
  assert.match(source, /No site source, package behavior, or external asset/i)
})

test('manifest verifies all eight inspected full-scale PNG boards', () => {
  assert.equal(manifest.selectedDirectionId, 'material-blueprint')
  assert.deepEqual(
    manifest.directions.map(({ id }) => id),
    data.directionIds
  )
  assert.equal(manifest.selectedBoards.length, 5)

  const artifacts = [...manifest.directions, ...manifest.selectedBoards]
  assert.equal(artifacts.length, 8)
  assert.deepEqual(
    artifacts.map(({ path: artifactPath }) => artifactPath).sort(),
    data.conceptPaths.map((artifactPath) => path.basename(artifactPath)).sort()
  )

  artifacts.forEach((artifact) => {
    assert.equal(artifact.width, 1536, artifact.path)
    assert.equal(artifact.height, 1024, artifact.path)
    assert.equal(artifact.inspection.fullScale, true, artifact.path)
    assert.match(artifact.inspection.result, /^pass/, artifact.path)

    const filePath = path.join(visualRoot, artifact.path)
    assert.ok(fs.existsSync(filePath), artifact.path)
    assert.deepEqual(
      inspectPng(filePath),
      {
        width: artifact.width,
        height: artifact.height,
        sha256: artifact.sha256
      },
      artifact.path
    )
  })
})

test('selected boards cover the exact fourteen view states', () => {
  const selectedBoardIds = new Set(
    manifest.selectedBoards.map(({ id }) => id)
  )
  assert.equal(selectedBoardIds.size, manifest.selectedBoards.length)
  assert.deepEqual(
    Object.keys(manifest.viewStateCoverage).sort(),
    [...data.viewStateIds].sort()
  )
  Object.entries(manifest.viewStateCoverage).forEach(
    ([viewStateId, boardId]) => {
      assert.ok(selectedBoardIds.has(boardId), `${viewStateId}: ${boardId}`)
    }
  )
})

test('handoff resolves global, semantic, interaction, motion, and asset rules', () => {
  const requiredSections = [
    '## Global Audience And Progressive Disclosure',
    '## Responsive Composition',
    '## Typography',
    '## Color, Surface, And Contrast Tokens',
    '## Semantic Shape Language',
    '## Interaction State Contract',
    '## Motion And Interruption Contract',
    '## Accessibility And Localization',
    '## Per-View Implementation Annotations',
    '## Implementation Boundaries'
  ]
  requiredSections.forEach((section) => assert.match(handoff, new RegExp(section)))

  assert.match(handoff, /worldwide non-engineer/i)
  assert.match(handoff, /35% text expansion/i)
  assert.match(handoff, /44×44px/i)
  assert.match(handoff, /Factory is the transaction owner/i)
  assert.match(handoff, /Scene and Props are canonical owners/i)
  assert.match(handoff, /prefers-reduced-motion: reduce/i)
  assert.match(
    handoff,
    /Content, order, focus, status, result, and\s+evidence remain identical/i
  )
  assert.match(
    handoff,
    /Do not import, crop, trace, or ship\s+the generated rasters/i
  )
  assert.match(handoff, /authoritative production copy is\n+`WHY IT MATTERS`/i)
  assert.match(
    handoff,
    /Instrument Sheet Revision 2 is the active\s+implementation direction/i
  )
})

test('global comprehension and the selected revision-two implementation stay explicit', () => {
  const source = JSON.stringify([data.acceptanceContracts, data.invariants])
  assert.match(source, /non-engineer can understand what Asyra enables/i)
  assert.match(source, /localization-resilient layout/i)
  assert.match(source, /Instrument Sheet Revision 2/i)
  assert.match(source, /whole public website/i)
  assert.match(source, /generated raster remains design evidence/i)
})

test('routes, artifacts, failure owners, and cache boundaries resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )
  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactOwners.size, data.artifacts.length)

  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0)
    assert.ok(item.specRefs.length > 0)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), route.id)
    assert.ok(stepIds.has(route.to), route.id)
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from, route.id)
    })
  })
})
