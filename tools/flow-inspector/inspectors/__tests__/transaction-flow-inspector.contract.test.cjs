const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../transaction-flow-inspector.data.cjs')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

test('completed product contract remains the resolvable Inspector authority', () => {
  const repoRoot = path.resolve(__dirname, '../../../..')
  const productContract = data.links.find(
    (link) => link.id === 'product-contract'
  )

  assert.ok(productContract, 'Missing product-contract Inspector link')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/transaction-atomicity-and-rollback-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', productContract.href)))
})

test('nested rollback is owned by the outer boundary and finalized once', () => {
  const boundary = step('coordinate-transaction-boundary')
  const contract = [...boundary.conditions, ...boundary.bypasses].join(' ')

  assert.match(contract, /nested rollback request latches rollback/i)
  assert.match(contract, /complete outer transaction/i)
  assert.match(contract, /isolated per resolved TransactionOwner/i)
  assert.match(contract, /depth zero is a no-op/i)
  assert.equal(boundary.failureOwnerStepId, boundary.id)
})

test('feature interruption commits current state while failures roll back', () => {
  const decision = step('decide-feature-outcome')
  const contract = [...decision.conditions, ...decision.bypasses].join(' ')

  assert.match(contract, /error or timeout always requests rollback/i)
  assert.match(contract, /propagates failure/i)
  assert.match(contract, /public transaction wrapper/i)
  assert.match(contract, /throw or rejection requests rollback/i)
  assert.match(contract, /legacy handler-only fifth argument/i)
  assert.match(contract, /commit-current as its default cancel policy/i)
  assert.match(contract, /user-driven interruption/i)
  assert.match(contract, /finalizes the current preview/i)
  assert.match(contract, /one undoable commit/i)
  assert.match(contract, /rollback participant wins/i)
  assert.match(contract, /all public SessionManager instances/i)
  assert.match(contract, /one active session runtime/i)
  assert.match(contract, /cancels the previously active session/i)
  assert.match(contract, /explicit sharedDelivery immediate/i)
  assert.match(
    contract,
    /batchPublications false before its first mutation/i
  )
  assert.match(contract, /same transaction outcome and one undo commit/i)
  assert.match(contract, /Undo\/Redo shortcut.*current AI Message Bar/i)
  assert.match(contract, /default progressive mode/i)
  assert.match(contract, /await the complete History replay/i)
  assert.match(contract, /explicit atomic option/i)
  assert.match(contract, /exclusive shortcut interaction queue/i)
  assert.match(contract, /AI Message Bar pending guard/i)
  assert.match(contract, /canonical completion event/i)
  ;[
    'apps/asyra-design/src/features/**',
    'apps/asyra-design/src/common-apis/history.ts',
    'apps/asyra-design/src/common-apis/__tests__/history.test.ts',
    'apps/asyra-design/src/app/ai-history-message-bar.tsx',
    'apps/asyra-design/src/app/__tests__/ai-history-message-bar.test.tsx',
    'apps/asyra-design/src/properties/fills/use-fill-interactions.ts',
    'apps/asyra-design/src/properties/fills/use-gradient-interactions.ts',
    'apps/asyra-design/src/properties/strokes/use-stroke-interactions.ts',
    'apps/asyra-design/e2e/element-creation.spec.ts',
    'apps/asyra-design/e2e/gradient-fill-handles.spec.ts',
    'apps/asyra-design/e2e/properties.spec.ts',
    'apps/asyra-design/e2e/undo-redo.spec.ts',
    'docs/ai/apps/asyra-design/API_SURFACES.md',
    'docs/ai/apps/asyra-design/features/undo-redo.md',
    'docs/ai/apps/asyra-design/prd/undo-redo.md',
    'docs/ai/apps/asyra-design/features/move-elements.md',
    'docs/ai/apps/asyra-design/features/pen-tool.md',
    'docs/ai/apps/asyra-design/prd/properties-panel.md',
    'docs/ai/apps/asyra-design/rules/ui-data-flow.md'
  ].forEach((file) => {
    assert.ok(decision.implementationBoundary.includes(file), file)
  })
})

test('asynchronous validators fail without leaking rejected promises', () => {
  const validation = step('validate-requested-commit')
  const contract = validation.conditions.join(' ')

  assert.match(contract, /asynchronous validator results are rejected/i)
  assert.match(contract, /rejection is observed/i)
})

test('rollback is distinct from undo history effects', () => {
  const finalize = step('finalize-transaction-state')
  const contract = [...finalize.conditions, ...finalize.bypasses].join(' ')

  assert.match(contract, /replays inverses in reverse order/i)
  assert.match(contract, /without undo, redo, or user-action-completed/i)
  assert.match(contract, /source history stack only on outer commit/i)
  assert.match(contract, /without a replay journal/i)
  assert.match(contract, /source replay in the opposite direction/i)
  assert.match(contract, /mixed replay journal/i)
  assert.match(contract, /complete source replay/i)
  assert.match(contract, /new action mutation after nested undo or redo/i)
  assert.match(contract, /reverses that action journal before restoring/i)
  assert.match(contract, /restoration plan for each replay output/i)
  assert.match(contract, /before canonical state-owner apply/i)
  assert.match(contract, /acknowledged semantic apply/i)
  assert.match(contract, /successful no-op/i)
  assert.match(contract, /pre-apply failure retains no plan/i)
  assert.match(contract, /after the write but before change callbacks/i)
  assert.match(contract, /pre-write failures and no-change writes/i)
  assert.match(contract, /output inverter must itself produce at least one/i)
  assert.match(contract, /symbol values and nested undefined/i)
  assert.match(contract, /visible before local shared settlement/i)
  assert.match(contract, /restores that provisional transition/i)
  assert.match(contract, /element-owned keys to Element data/i)
  assert.match(contract, /computed-only keys to Computed data/i)
  assert.match(
    contract,
    /internal initialization, parentId, children, and computed setter side effects/i
  )
  assert.match(contract, /sole reversible journal and shared-projection owner/i)
  assert.match(contract, /non-null event object with a string event type/i)
  assert.match(contract, /attempts the remaining journal inverses/i)
  assert.match(contract, /rollback-failed/i)
})

test('framework cooperative rendering batches canonical replay before bounded progressive paint', () => {
  const finalize = step('finalize-transaction-state')
  const contract = [
    ...finalize.inputs,
    ...finalize.conditions,
    ...finalize.allowedContributors,
    ...finalize.forbiddenContributors
  ].join(' ')

  assert.match(contract, /defaults to progressive/i)
  assert.match(contract, /explicit atomic opt-out/i)
  assert.match(contract, /complete one full canonical mutation and projection/i)
  assert.match(contract, /progressive Undo or Redo/i)
  assert.match(contract, /same canonical replay/i)
  assert.match(contract, /recorded progressive slice boundaries/i)
  assert.match(contract, /already-delivered immediate owner-batch boundaries/i)
  assert.match(contract, /recorded order/i)
  assert.match(contract, /plural Scene owner apply/i)
  assert.match(contract, /at most 32/i)
  assert.match(
    contract,
    /immediate source boundaries remain ordered.*bounded publication windows/i
  )
  assert.match(contract, /publication windows.*512 distinct work items/i)
  assert.match(contract, /render slices.*1,024 distinct work items/i)
  assert.match(contract, /delivery identity is the fallback/i)
  assert.match(
    contract,
    /actual shared-delivery slice order as History delivery metadata/i
  )
  assert.match(contract, /Undo reverses and Redo restores/i)
  assert.match(
    contract,
    /transaction-end slices delivered after earlier immediate mutations/i
  )
  assert.match(contract, /without creating another History entry/i)
  assert.match(contract, /host\/paint yield occurs after each render slice/i)
  assert.match(contract, /one History transition/i)
  assert.match(contract, /one outer transaction/i)
  assert.match(
    contract,
    /DataTransact-owned animation frame, timer, or browser scheduler/i
  )
  assert.match(contract, /app-local duplicate cooperative render scheduler/i)
  assert.match(
    contract,
    /AI-, fixture-, or item-count-specific replay history/i
  )
  assert.ok(
    finalize.implementationBoundary.includes(
      'packages/reactive-events/src/app/publish.ts'
    )
  )
  assert.ok(
    finalize.implementationBoundary.includes(
      'packages/reactive-events/src/cooperative-render.ts'
    )
  )
  assert.ok(
    finalize.implementationBoundary.includes(
      'apps/asyra-design/e2e/collaboration-ai-agent-video.spec.ts'
    )
  )
})

test('setter-backed replay acknowledgement stays at the canonical owner boundary', () => {
  const finalize = step('finalize-transaction-state')

  ;[
    'packages/utils/src/setter.ts',
    'packages/scene-tree/src/components/computed.ts',
    'packages/scene-tree/src/components/element.ts',
    'packages/props-manager/src/components/base.ts'
  ].forEach((file) => {
    assert.ok(finalize.implementationBoundary.includes(file), file)
  })
})

test('every history-eligible custom mutation is reversible', () => {
  const journal = step('record-reversible-journal')
  const contract = [...journal.conditions, ...journal.bypasses].join(' ')

  assert.match(contract, /eligible for rollback or ordinary undo history/i)
  assert.match(contract, /both rollbackable false and undoable false/i)
  assert.match(contract, /rollbackable false alone/i)
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

test('selection canonical state is visible before commit validation', () => {
  const journal = step('record-reversible-journal')
  const contract = journal.conditions.join(' ')

  assert.match(contract, /canonical state before commit validation/i)
  assert.match(contract, /shared channel remains a projection boundary/i)
  assert.ok(
    journal.implementationBoundary.includes(
      'packages/core/src/apis/element-selection.ts'
    )
  )
})

test('selection replay is owned by the injected runtime instance', () => {
  const finalize = step('finalize-transaction-state')
  const contract = finalize.conditions.join(' ')

  assert.match(contract, /instance-local replay handler/i)
  assert.match(contract, /registration-driven selection eventName/i)
  assert.match(contract, /explicit selection inverter/i)
  assert.match(contract, /injected SelectionManager/i)
  assert.match(contract, /does not require preset/i)
  assert.match(contract, /observer-only replay publication/i)
  assert.match(contract, /global synchronous state owner/i)
  assert.ok(
    finalize.implementationBoundary.includes(
      'packages/core/src/apis/element-selection.ts'
    )
  )
})

test('shared delivery timing is independent from undo eligibility', () => {
  const journal = step('record-reversible-journal')
  const contract = journal.conditions.join(' ')

  assert.match(contract, /sharedDelivery defaults to transaction-end/i)
  assert.match(contract, /undoable false does not imply immediate/i)
  assert.match(contract, /explicit immediate opt-in/i)
  assert.match(contract, /transient batching preserves effective rollbackable/i)
  assert.match(contract, /batches only consecutive compatible changes/i)
  assert.match(contract, /flushes a pending batch before any ordinary/i)
  assert.match(contract, /journal order matches canonical mutation order/i)
  assert.match(contract, /local shared-delivery payloads are deeply detached/i)
  assert.match(contract, /caller-owned mutation cannot rewrite/i)
})

test('replace-latest History staging is explicit, bundle-based, and local-only', () => {
  const journal = step('record-reversible-journal')
  const finalize = step('finalize-transaction-state')
  const journalContract = journal.conditions.join(' ')
  const finalizeContract = finalize.conditions.join(' ')

  assert.match(journalContract, /ordinary mutations preserve every/i)
  assert.match(journalContract, /explicitly opt into/i)
  assert.match(journalContract, /gesture-keyed replace-latest History stage/i)
  assert.match(
    journalContract,
    /complete owner-issued History candidate bundles/i
  )
  assert.match(journalContract, /first complete before bundle/i)
  assert.match(journalContract, /latest complete after bundle reference/i)
  assert.match(
    journalContract,
    /does not perform a per-element pending-History merge/i
  )
  assert.match(journalContract, /never enters canonical payloads/i)
  assert.match(journalContract, /collaboration wire data/i)
  assert.match(finalizeContract, /ordinary state-owner-backed History/i)
  assert.match(finalizeContract, /Commit-current interruption finalizes/i)
  assert.match(finalizeContract, /rollback discards staged History/i)
  assert.ok(
    journal.implementationBoundary.includes(
      'packages/utils/src/types/change.ts'
    )
  )
  assert.ok(
    journal.implementationBoundary.includes(
      'packages/reactive-events/src/app/events.ts'
    )
  )
  assert.ok(
    journal.implementationBoundary.includes('packages/props-manager/src/**')
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

test('shared append failure restores the transaction before commit effects', () => {
  const shared = step('settle-local-shared-projection')
  const contract = [...shared.conditions, ...shared.bypasses].join(' ')

  assert.match(contract, /append failure before application requests rollback/i)
  assert.match(
    contract,
    /leaves no final undo history or user-action-completed/i
  )
  assert.match(contract, /partially delivered transaction-end changes/i)
})

test('persistence failure never owns runtime rollback', () => {
  const persistence = step('acknowledge-persistence')
  const contract = [
    persistence.purpose,
    ...persistence.conditions,
    ...persistence.bypasses
  ].join(' ')

  assert.match(contract, /queue in order/i)
  assert.match(
    contract,
    /captures its configured provider and CoreRawData snapshot/i
  )
  assert.match(contract, /deeply detached from live mutable references/i)
  assert.match(contract, /commit-capture handoff.*before.*reentrant.*observer/i)
  assert.match(contract, /remote.*does not request persistence/i)
  assert.match(contract, /do not request persistence/i)
  assert.match(contract, /never rolls back committed runtime state/i)
  assert.ok(
    persistence.implementationBoundary.includes('packages/factory/src/**')
  )
  assert.equal(persistence.failureOwnerStepId, persistence.id)
})
