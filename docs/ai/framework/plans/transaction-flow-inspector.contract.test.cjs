const assert = require('node:assert/strict')
const test = require('node:test')

const data = require('./transaction-flow-inspector.data.cjs')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

test('nested rollback is owned by the outer boundary and finalized once', () => {
  const boundary = step('coordinate-transaction-boundary')
  const contract = [...boundary.conditions, ...boundary.bypasses].join(' ')

  assert.match(contract, /nested rollback request latches rollback/i)
  assert.match(contract, /complete outer transaction/i)
  assert.match(contract, /isolated per resolved TransactionOwner/i)
  assert.match(contract, /depth zero is a no-op/i)
  assert.equal(boundary.failureOwnerStepId, boundary.id)
})

test('feature failures cannot silently continue to commit', () => {
  const decision = step('decide-feature-outcome')
  const contract = [...decision.conditions, ...decision.bypasses].join(' ')

  assert.match(contract, /error or timeout always requests rollback/i)
  assert.match(contract, /propagates failure/i)
  assert.match(contract, /rollback participant wins/i)
})

test('rollback is distinct from undo history effects', () => {
  const finalize = step('finalize-transaction-state')
  const contract = [...finalize.conditions, ...finalize.bypasses].join(' ')

  assert.match(contract, /replays inverses in reverse order/i)
  assert.match(contract, /without undo, redo, or user-action-completed/i)
  assert.match(contract, /source history stack only on outer commit/i)
  assert.match(contract, /rollback-failed/i)
})

test('scene-tree add/remove journal owns hierarchy restoration metadata', () => {
  const journal = step('record-reversible-journal')
  const contract = journal.conditions.join(' ')

  assert.match(contract, /actual parent id and child index/i)
  assert.ok(
    journal.implementationBoundary.includes(
      'packages/scene-tree/src/sceneTree.ts'
    )
  )
  assert.ok(
    journal.implementationBoundary.includes(
      'packages/utils/src/types/scene-tree.ts'
    )
  )
})

test('scene-tree inverse add resolves recorded hierarchy metadata', () => {
  const finalize = step('finalize-transaction-state')
  const contract = finalize.conditions.join(' ')

  assert.match(contract, /recorded parent id and child index/i)
  assert.ok(
    finalize.implementationBoundary.includes(
      'packages/reactive-events/src/scene-tree/events.ts'
    )
  )
})

test('shared settlement excludes Yjs network architecture', () => {
  const shared = step('settle-local-shared-projection')
  const contract = [...shared.conditions, ...shared.bypasses].join(' ')

  assert.match(contract, /compensating inverse/i)
  assert.match(contract, /discards undelivered transaction-end changes/i)
  assert.match(contract, /applied Yjs append remains delivered/i)
  assert.match(contract, /status observer failures cannot alter/i)
  assert.match(contract, /No Yjs network provider/i)
})

test('persistence failure never owns runtime rollback', () => {
  const persistence = step('acknowledge-persistence')
  const contract = [
    persistence.purpose,
    ...persistence.conditions,
    ...persistence.bypasses
  ].join(' ')

  assert.match(contract, /queue in order/i)
  assert.match(contract, /captures its configured provider and CoreRawData snapshot/i)
  assert.match(contract, /do not request persistence/i)
  assert.match(contract, /never rolls back committed runtime state/i)
  assert.equal(persistence.failureOwnerStepId, persistence.id)
})
