const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../stroke-flow-inspector.data.js')
const specSource = fs.readFileSync(
  path.resolve(__dirname, '../../../specs/stroke-engine/SPEC.md'),
  'utf8'
)

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

test('Step 5 fails fast when an active stroke has no registered engine', () => {
  const invocation = step('invoke-registered-stroke-engine')
  const contract = [...invocation.conditions, ...invocation.bypasses].join(' ')

  assert.match(
    contract,
    /registered default engine is required for every active stroke/i
  )
  assert.match(
    contract,
    /missing registration.*fail-fast integration contract failure/i
  )
  assert.match(contract, /must not.*preserve prior output/i)
  assert.equal(invocation.failureOwnerStepId, invocation.id)
})

test('Step 6 preserves region union and rejected-versus-failed outcomes', () => {
  const outcome = step('build-canonical-stroke-outcome')
  const contract = [...outcome.conditions, ...outcome.bypasses].join(' ')

  assert.match(specSource, /Boolean union of all resolved region material/i)
  assert.match(contract, /invalid or unsupported authored input.*rejected/i)
  assert.match(
    contract,
    /internal engine or canonical product-geometry mechanic failure.*otherwise valid evaluation.*failed/i
  )
})

test('Committed-state invariant reaches the stroke-engine owner step', () => {
  const invariant = data.invariants.find(
    (item) => item.id === 'canonical-state-before-render'
  )

  assert.ok(invariant)
  assert.ok(invariant.stepIds.includes('build-canonical-stroke-outcome'))
})

test('Step 7 fails all channels atomically when channel construction fails', () => {
  const channels = step('build-shared-channel-result')
  const contract = [
    channels.purpose,
    ...channels.conditions,
    ...channels.bypasses
  ].join(' ')

  assert.match(contract, /tessellation or any channel projection fails/i)
  assert.match(contract, /failed: engine-failure/i)
  assert.match(contract, /all three channel outputs are empty/i)
  assert.match(contract, /no partial product output/i)
  assert.equal(channels.failureOwnerStepId, channels.id)

  const supportedBehavior = data.acceptanceContracts.find(
    (contractItem) => contractItem.id === 'supported-behavior'
  )
  assert.ok(supportedBehavior.stepIds.includes(channels.id))
})

test('Step 8 declares route-specific inputs for active and removed strokes', () => {
  const projection = step('project-stroke-pixels')
  const contract = [...projection.conditions, ...projection.bypasses].join(' ')

  assert.ok(projection.inputs.includes('artifact:stroke-mirror-update'))
  assert.ok(projection.inputs.includes('artifact:stroke-render-output'))
  assert.match(
    contract,
    /active stroke update requires both.*stroke-mirror-update.*stroke-render-output/i
  )
  assert.match(
    contract,
    /removed or zero-stroke update.*stroke-mirror-update alone.*does not wait for (?:artifact:)?stroke-render-output/i
  )
  assert.equal(projection.failureOwnerStepId, projection.id)
})
