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

test('two explicitly composed actors converge while Awareness stays separate', async () => {
  const result = await runCase('collaboration-two-actors')
  assert.equal(result.complete, true)
  const publication = result.evidence[1].output
  assert.deepEqual(publication, {
    actorA: 7,
    actorB: 7,
    remoteApplyCount: 1
  })
  const presence = result.evidence[2].output
  assert.equal(presence.actorBPresence.tool, 'select')
  assert.equal(typeof presence.actorBPresence.heartbeatAt, 'number')
  assert.equal(presence.canonicalValue, 7)
  assert.deepEqual(result.evidence.at(-1).output, {
    actorBPresenceTool: 'select',
    actorBValue: 7,
    durability: 'not-composed',
    remoteApplyCount: 1
  })
})

test('AI executes one prepared registered action through App-owned policy', async () => {
  const result = await runCase('ai-registered-action')
  assert.equal(result.complete, true)
  const execution = result.evidence[1].output
  assert.deepEqual(execution, {
    batchId: 'atlas-ai-batch',
    providerRequests: 1,
    status: 'executed',
    transactions: { commits: 1, rollbacks: 0 },
    visible: false
  })
  assert.deepEqual(result.evidence.at(-1).output, {
    batchId: 'atlas-ai-batch',
    network: 'not-used',
    providerRequests: 1,
    status: 'executed',
    transactions: { commits: 1, rollbacks: 0 },
    visible: false
  })
})

test('machine retrieval is read-only and only Feature API mutates', async () => {
  const result = await runCase('machine-retrieval-action')
  assert.equal(result.complete, true)
  const retrieval = result.evidence[1].output
  assert.equal(retrieval.canonicalUnchanged, true)
  assert.deepEqual(retrieval.matches, [
    { id: 'record-b', label: 'Safety review', status: 'open' }
  ])
  const action = result.evidence.at(-1).output
  assert.equal(action.matchedId, 'record-b')
  assert.equal(action.canonical['record-b'].status, 'approved')
  assert.equal(action.canonical['record-a'].status, 'open')
  assert.equal(action.headlessSupport, 'roadmap')
})
