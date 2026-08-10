import assert from 'node:assert/strict'
import test from 'node:test'

import { createAtlasRuntime } from '../lib/runtime-atlas/runtime.mjs'

const runCase = async (caseId) => {
  const runtime = createAtlasRuntime(caseId)
  try {
    let state = runtime.snapshot()
    while (!state.terminal) {
      state = await runtime.advance()
    }
    return state
  } finally {
    await runtime.dispose()
  }
}

test('continuous pointer updates commit as one Undo unit and replay exactly', async () => {
  const result = await runCase('continuous-pointer-undo')
  assert.equal(result.complete, true)
  assert.deepEqual(
    result.evidence.map(({ actionId, status }) => [actionId, status]),
    [
      ['start', 'completed'],
      ['update-2', 'completed'],
      ['update-4', 'completed'],
      ['update-6', 'completed'],
      ['commit', 'completed'],
      ['undo', 'completed'],
      ['redo', 'completed']
    ]
  )
  assert.equal(result.evidence[4].output.undoDelta, 1)
  assert.equal(result.evidence[4].output.value, 6)
  assert.equal(result.evidence[5].output.value, 0)
  assert.equal(result.evidence[6].output.value, 6)
})

test('one canonical Feature change feeds four App-owned projections', async () => {
  const result = await runCase('canonical-projection-fanout')
  assert.equal(result.complete, true)
  const output = result.evidence.at(-1).output
  assert.deepEqual(output.canonical, {
    id: 'safety-review',
    label: 'Safety review',
    revision: 2,
    status: 'approved',
    bounds: { x: 72, y: 54, width: 168, height: 104 }
  })
  assert.deepEqual(output.projections.canvas, output.canonical.bounds)
  assert.deepEqual(output.projections.properties, {
    revision: 2,
    status: 'approved'
  })
  assert.deepEqual(output.projections.serialized, output.canonical)
  assert.equal(output.projections.hierarchy[1].id, output.canonical.id)
})

test('invalid session input rolls back the complete preview without history', async () => {
  const result = await runCase('invalid-input-rollback')
  assert.equal(result.complete, true)
  assert.deepEqual(
    result.evidence.map(({ status }) => status),
    ['completed', 'completed', 'rejected']
  )
  const rejection = result.evidence.at(-1).output
  assert.match(rejection.error, /rejects 9/i)
  assert.equal(rejection.value, 0)
  assert.equal(rejection.rollbackUndoDelta, 0)
})
