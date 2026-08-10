import assert from 'node:assert/strict'
import test from 'node:test'

import { ATLAS_CASE_IDS, ATLAS_CASES } from '../lib/runtime-atlas/case-definitions.mjs'
import {
  AtlasRuntimeUnavailableError,
  createAtlasRuntime,
  createAtlasRuntimeHarness
} from '../lib/runtime-atlas/runtime.mjs'

test('Atlas exposes six exact plain-language case contracts', () => {
  assert.deepEqual(ATLAS_CASE_IDS, [
    'continuous-pointer-undo',
    'canonical-projection-fanout',
    'invalid-input-rollback',
    'collaboration-two-actors',
    'ai-registered-action',
    'machine-retrieval-action'
  ])
  ATLAS_CASES.forEach((definition) => {
    assert.ok(definition.plainLanguage.length > 40, definition.id)
    assert.ok(definition.expected.length > 40, definition.id)
    assert.ok(definition.actions.length >= 3, definition.id)
    assert.ok(definition.exampleIds.length > 0, definition.id)
    assert.ok(Object.isFrozen(definition), definition.id)
  })
})

test('harness advances in exact order with detached monotonic evidence', async () => {
  const calls = []
  const harness = createAtlasRuntimeHarness({
    caseId: 'canonical-projection-fanout',
    createExecutor: () => ({
      advance: (actionId, input) => {
        calls.push(actionId)
        input.mutated = true
        return { output: { actionId } }
      }
    })
  })

  const first = await harness.advance()
  const second = await harness.advance()
  const third = await harness.advance()

  assert.deepEqual(calls, ['register', 'approve', 'project'])
  assert.equal(first.sequence, 1)
  assert.equal(second.sequence, 2)
  assert.equal(third.sequence, 3)
  assert.equal(third.complete, true)
  assert.equal(third.terminal, true)
  assert.deepEqual(
    third.evidence.map(({ sequence }) => sequence),
    [1, 2, 3]
  )
  assert.equal(third.evidence[0].input.mutated, undefined)
})

test('unexpected executor failure is terminal visible evidence, not fallback output', async () => {
  const harness = createAtlasRuntimeHarness({
    caseId: 'invalid-input-rollback',
    createExecutor: () => ({
      advance: () => {
        throw new TypeError('owner failed')
      }
    })
  })

  const failed = await harness.advance()
  assert.equal(failed.terminal, true)
  assert.equal(failed.complete, false)
  assert.equal(failed.evidence[0].status, 'failed')
  assert.deepEqual(failed.evidence[0].failure, {
    message: 'owner failed',
    name: 'TypeError'
  })
  assert.equal('output' in failed.evidence[0], false)
})

test('dispose is idempotent and blocks later advancement', async () => {
  let disposeCount = 0
  const harness = createAtlasRuntimeHarness({
    caseId: 'machine-retrieval-action',
    createExecutor: () => ({
      advance: () => ({ output: {} }),
      dispose: () => {
        disposeCount += 1
      }
    })
  })

  await harness.dispose()
  await harness.dispose()
  assert.equal(disposeCount, 1)
  await assert.rejects(harness.advance(), /disposed/i)
})

test('production runtime fails closed when an optional case executor is not installed', () => {
  assert.throws(
    () => createAtlasRuntime('collaboration-two-actors'),
    AtlasRuntimeUnavailableError
  )
})
