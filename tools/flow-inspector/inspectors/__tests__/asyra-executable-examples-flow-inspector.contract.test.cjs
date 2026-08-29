const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-executable-examples-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')

test('retired executable-example contract is explicitly superseded', () => {
  assert.equal(data.status, 'SUPERSEDED')
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.specPath)))
  assert.ok(
    fs.existsSync(path.join(repoRoot, data.authority.documentationPlanPath))
  )
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.websitePlanPath)))
})

test('all eleven retired subjects resolve maintained advanced guides', () => {
  const entries = Object.entries(data.guideMappings)
  assert.equal(entries.length, 11)
  for (const [retiredId, guideIds] of entries) {
    assert.ok(retiredId.length > 0)
    assert.ok(guideIds.length > 0, retiredId)
    for (const guideId of guideIds) {
      const guidePath = path.join(repoRoot, 'docs/public', `${guideId}.md`)
      assert.ok(fs.existsSync(guidePath), `${retiredId}:${guideId}`)
      const guide = fs.readFileSync(guidePath, 'utf8')
      for (const heading of [
        '## Where this runs',
        '## Implementation',
        '## Flow',
        '## Expected result'
      ]) {
        assert.match(guide, new RegExp(heading), `${retiredId}:${guideId}`)
      }
    }
  }
})

test('supersession retains learning and verification ownership without public runner output', () => {
  assert.equal(data.currentOwners.learning, 'docs/public')
  assert.equal(
    data.currentOwners.interactiveRuntime,
    'apps/asyra-framework-site/app/atlas'
  )
  assert.match(
    data.retainedContracts.join(' '),
    /copyable code.*call location.*owner flow.*expected result.*failure/is
  )
  assert.match(
    data.retainedContracts.join(' '),
    /package and app behavior.*formal tests/i
  )
  assert.doesNotMatch(JSON.stringify(data.currentOwners), /docs\/examples/)
})
