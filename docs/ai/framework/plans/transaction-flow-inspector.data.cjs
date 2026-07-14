;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/transaction-atomicity-and-rollback-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/transaction-flow-inspector.data.cjs'

  const lanes = [
    { id: 'boundary', title: 'Boundary', order: 1 },
    { id: 'feature', title: 'Feature Decision', order: 2 },
    { id: 'factory', title: 'Factory State', order: 3 },
    { id: 'durability', title: 'Durability', order: 4 }
  ]

  const steps = [
    {
      id: 'coordinate-transaction-boundary',
      order: 1,
      laneId: 'boundary',
      title: 'Coordinate transaction boundary',
      ownerPackage: '@asyra/reactive-events',
      purpose:
        'Own outer transaction depth, nested rollback-only latching, and deterministic boundary closure.',
      inputs: [
        'user, machine, command, or API transaction request',
        'current boundary depth and rollback-only state'
      ],
      outputs: ['artifact:transaction-boundary'],
      conditions: [
        'Only the outer start and outer close publish lifecycle boundaries.',
        'Boundary depth and rollback-only state are isolated per resolved TransactionOwner.',
        'Any nested rollback request latches rollback for the complete outer transaction.',
        'A consumer-owned Factory replay temporarily routes boundary updates to that Factory without replacing the default owner.'
      ],
      bypasses: [
        'An end or rollback request at depth zero is a no-op and publishes no phantom boundary.'
      ],
      allowedContributors: [
        'public transaction API',
        '@asyra/feature-system',
        '@asyra/utils transaction type contracts',
        '@asyra/core transaction facade',
        'app transaction API facades',
        'app finite synchronous mutation call sites',
        'cross-app transaction boundary structure tests',
        'instance-scoped synchronous transaction-owner override'
      ],
      forbiddenContributors: [
        'state-owner mutation logic',
        'undo history',
        'persistence provider'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/reactive-events/src/**',
        'packages/utils/src/types/transaction.ts',
        'packages/utils/src/types/change.ts',
        'packages/utils/src/constants/constants.ts',
        'packages/core/src/index.ts',
        'apps/asyra-design/src/common-apis/transaction.ts',
        'apps/asyra-design/src/common-apis/strokes.ts',
        'apps/asyra-design/src/common-apis/element/index.ts',
        'apps/asyra-design/src/common-apis/element/change-computed-data.ts',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts',
        'apps/asyra-design/src/properties/vector-point.tsx',
        'apps/asyra-design/src/properties/fills/use-fill-interactions.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      specRefs: [
        '#public-transaction-contracts',
        '#atomicity',
        '#error-and-timeout-propagation'
      ],
      failureOwnerStepId: 'coordinate-transaction-boundary'
    },
    {
      id: 'record-reversible-journal',
      order: 2,
      laneId: 'factory',
      title: 'Record reversible journal',
      ownerPackage: '@asyra/factory',
      purpose:
        'Record ordered rollbackable and undoable mutation metadata with local shared-delivery state.',
      inputs: [
        'artifact:transaction-boundary',
        'state-owner mutation event',
        'mutation options and registered inverter'
      ],
      outputs: ['artifact:active-transaction-journal'],
      conditions: [
        'Rollbackable recording is independent from normal undo history eligibility.',
        'Canonical journal events and local shared-delivery payloads are deeply detached snapshots captured at mutation time; later caller-owned mutation cannot rewrite a pending flush or immediate rollback compensation.',
        'Every custom mutation eligible for rollback or ordinary undo history has a registered inverse contract.',
        'Reversible scene-tree add and remove journal entries record the actual parent id and child index required to restore graph ownership and order.',
        'A selection state-owner mutation applies canonical state before commit validation; the shared channel remains a projection boundary rather than the delayed owner of canonical selection.',
        'sharedDelivery defaults to transaction-end independently of undo eligibility; undoable false does not imply immediate delivery, which requires an explicit immediate opt-in.',
        'Scene-tree transient batching preserves effective rollbackable, shared, and sharedDelivery semantics, batches only consecutive compatible changes, and flushes a pending batch before any ordinary or incompatible change so journal order matches canonical mutation order.'
      ],
      bypasses: [
        'A mutation explicitly marked both rollbackable false and undoable false is counted as an intentionally irreversible effect; rollbackable false alone does not allow an irreversible event into undo history.'
      ],
      allowedContributors: [
        '@asyra/scene-tree',
        '@asyra/props-manager',
        '@asyra/selection',
        'registered custom state owners'
      ],
      forbiddenContributors: [
        'feature-local cursor state',
        'persistence acknowledgement',
        'Yjs network policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/**',
        'packages/core/src/apis/element-selection.ts',
        'packages/core/src/__tests__/element-selection-api.test.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/__tests__/**',
        'packages/utils/src/types/scene-tree.ts',
        'docs/ai/framework/packages/scene-tree.md',
        'docs/ai/framework/plans/transaction-atomicity-and-rollback-plan.md'
      ],
      specRefs: ['#rollbackable-vs-undoable', '#ownership'],
      failureOwnerStepId: 'record-reversible-journal'
    },
    {
      id: 'decide-feature-outcome',
      order: 3,
      laneId: 'feature',
      title: 'Decide feature outcome',
      ownerPackage: '@asyra/feature-system',
      purpose:
        'Serialize feature operations and translate normal completion, cancel, error, or timeout into one transaction outcome request.',
      inputs: [
        'artifact:transaction-boundary',
        'feature definition and cancel policy',
        'session or execution handler result',
        'interrupting input action emitted during an active pointer session'
      ],
      outputs: ['artifact:transaction-outcome-request'],
      conditions: [
        'Normal completion requests commit.',
        'Handler error or timeout always requests rollback and propagates failure.',
        'Every public transaction wrapper requests commit only after synchronous or asynchronous success; throw or rejection requests rollback and rethrows the original failure.',
        'The public SessionManager registerSession boundary accepts the legacy handler-only fifth argument with rollback as its default cancel policy, while the additive six-argument form accepts an explicit policy.',
        'Timeout aborts the session signal before rollback; async handlers must reject post-abort writes after await boundaries.',
        'Any rollback participant wins over commit-current participants.',
        'All public SessionManager instances using the default transaction owner share one interaction queue and one active session runtime; a registered session start cancels the previously active session before opening its transaction boundary.',
        'Keyboard and machine actions remain deliverable while pointer input is active.',
        'An interactive preview that must reach Render/UI before outer completion uses an explicit sharedDelivery immediate option.'
      ],
      bypasses: [
        'An empty or non-participating action requests discard without history.'
      ],
      allowedContributors: [
        'feature priority and exclusivity',
        'session onCancel cleanup',
        'interaction queue',
        '@asyra/input-system per-input-type key classification',
        'app-owned feature and interaction definitions',
        'app interaction product tests'
      ],
      forbiddenContributors: [
        'direct state restoration',
        'undo stack mutation',
        'persistence save'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/feature-system/src/**',
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/__tests__/input-system.test.ts',
        'apps/asyra-design/src/features/**',
        'apps/asyra-design/src/properties/fills/use-fill-interactions.ts',
        'apps/asyra-design/src/properties/fills/use-gradient-interactions.ts',
        'apps/asyra-design/src/properties/strokes/use-stroke-interactions.ts',
        'apps/asyra-design/e2e/element-creation.spec.ts',
        'apps/asyra-design/e2e/gradient-fill-handles.spec.ts',
        'apps/asyra-design/e2e/properties.spec.ts',
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/feature-system.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/features/pen-tool.md',
        'docs/ai/apps/asyra-design/prd/properties-panel.md',
        'docs/ai/apps/asyra-design/rules/ui-data-flow.md'
      ],
      specRefs: [
        '#cancel-policy',
        '#error-and-timeout-propagation',
        '#isolation'
      ],
      failureOwnerStepId: 'decide-feature-outcome'
    },
    {
      id: 'validate-requested-commit',
      order: 4,
      laneId: 'factory',
      title: 'Validate requested commit',
      ownerPackage: '@asyra/factory',
      purpose:
        'Run registered synchronous state-owner and cross-store validators before ordinary commit effects.',
      inputs: [
        'artifact:active-transaction-journal',
        'artifact:transaction-outcome-request',
        'registered transaction validators'
      ],
      outputs: ['artifact:commit-validation'],
      conditions: [
        'Validators run in registration order only for a requested non-empty commit.',
        'A thrown or invalid result changes the requested outcome to rollback.',
        'Asynchronous validator results are rejected as a validation failure, and any returned promise rejection is observed so it cannot leak as an unhandled rejection.'
      ],
      bypasses: [
        'Rollback and empty outcomes bypass commit validation without being treated as valid commits.'
      ],
      allowedContributors: ['registered state-owner validators'],
      forbiddenContributors: [
        'asynchronous validation',
        'feature business logic',
        'renderer state'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/factory/src/**'],
      specRefs: ['#consistency', '#ownership'],
      failureOwnerStepId: 'validate-requested-commit'
    },
    {
      id: 'finalize-transaction-state',
      order: 5,
      laneId: 'factory',
      title: 'Finalize transaction state',
      ownerPackage: '@asyra/factory',
      purpose:
        'Commit eligible history or reverse replay rollbackable journal entries with lifecycle-specific stack effects.',
      inputs: [
        'artifact:active-transaction-journal',
        'artifact:transaction-outcome-request',
        'artifact:commit-validation',
        'synchronous state-owner apply acknowledgement',
        'transaction replay restoration mode'
      ],
      outputs: ['artifact:canonical-transaction-outcome'],
      conditions: [
        'Commit records one undo entry from undoable journal entries.',
        'Rollback replays inverses in reverse order without undo, redo, or user-action-completed effects.',
        'Undo and redo use the same replay primitive with their own history effects.',
        'Undo and redo inside an existing command boundary retain their replay journal until the outer close.',
        'Nested replay moves its source history stack only on outer commit; outer rollback leaves the original undo or redo source available.',
        'A successful nested replay followed by outer rollback restores runtime through the complete source replay in the opposite direction even without a replay journal or with a mixed replay journal, and restoration does not record a second journal.',
        'A new action mutation after nested undo or redo is journaled, marks the outer boundary rollback-only, and fails immediately; outer rollback reverses that action journal before restoring the nested replay source so runtime and history both return to their pre-boundary state.',
        'Before canonical state-owner apply, nested replay derives a restoration plan for each replay output and validates that output has an inverse contract; the plan is retained only after an acknowledged semantic apply or an explicit applied-then-failed acknowledgement, while a successful no-op or pre-apply failure retains no plan. Outer rollback executes retained output plans in reverse apply order, add/remove replay swaps inverse metadata, every custom inverter must produce at least one output, and every custom inverter output inverter must itself produce at least one reversible output before the primary replay output is applied.',
        'Transaction journal cloning preserves the declared DataTypes contract, including symbol values and nested undefined values, without JSON coercion.',
        'Setter-backed state owners inject replay acknowledgement at the first successful semantic assignment, after the write but before change callbacks or listeners; pre-write failures and no-change writes are not acknowledged as applied.',
        'Selection canonical replay uses a Factory instance-local replay handler bound to the injected SelectionManager and does not require preset installation; every registration-driven selection eventName receives that owner and an explicit selection inverter before its first mutation, while observer-only replay publication preserves ordinary event observation without invoking a global synchronous state owner.',
        'The eligible history transition is visible before local shared settlement; a settlement failure restores that provisional transition before rollback completes.',
        'Rollback and undo restoration reuse deleted state-owner instances instead of constructing replacement defaults.',
        'A scene-tree inverse add resolves its recorded parent id and child index through the owning Scene Tree before restoration.',
        'Scene-tree replay routes standalone element-owned keys to Element data and computed-only keys to Computed data before returning its synchronous semantic apply acknowledgement; add/remove graph mutations collapse their internal initialization, parentId, children, and computed setter side effects so the explicit add/remove event is the sole reversible journal and shared-projection owner for that graph operation.',
        'Every custom inverter output is a non-null event object with a string event type; an invalid output is aggregated as that journal entry rollback failure while replay still attempts the remaining journal inverses.',
        'A state-owner apply failure is synchronously aggregated as rollback-failed.',
        'Failed undo or redo restores its source history entry, resets replay status, and closes any boundary it opened.'
      ],
      bypasses: [
        'An empty journal finalizes as discarded.',
        'Rollback failure attempts remaining inverses and finalizes as rollback-failed.'
      ],
      allowedContributors: [
        'registered inverse generators',
        'factory-owned undo and redo stacks',
        '@asyra/reactive-events synchronous typed apply route and replay context',
        '@asyra/scene-tree canonical restoration owner',
        '@asyra/props-manager canonical restoration owner',
        'Factory instance-local selection restoration owner'
      ],
      forbiddenContributors: [
        'public undo invocation as rollback implementation',
        'feature cleanup',
        'persistence save'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/**',
        'packages/core/src/apis/element-selection.ts',
        'packages/core/src/apis/index.ts',
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/element-selection-api.test.ts',
        'packages/reactive-events/src/event-bus.ts',
        'packages/reactive-events/src/transaction-owner.ts',
        'packages/reactive-events/src/transaction-replay.ts',
        'packages/reactive-events/src/scene-tree/events.ts',
        'packages/reactive-events/src/index.ts',
        'packages/reactive-events/src/__tests__/event-bus.test.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/subscribes.ts',
        'packages/scene-tree/src/components/computed.ts',
        'packages/scene-tree/src/components/element.ts',
        'packages/scene-tree/src/__tests__/**',
        'packages/props-manager/src/components/base.ts',
        'packages/props-manager/src/manager/subscribes.ts',
        'packages/props-manager/src/__tests__/**',
        'packages/utils/src/setter.ts',
        'packages/utils/src/__tests__/setter.test.ts',
        'packages/preset/src/subscriptions/data-channel.ts',
        'apps/asyra-design/e2e/delete-element.spec.ts',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/packages/scene-tree.md',
        'docs/ai/framework/plans/transaction-atomicity-and-rollback-plan.md',
        'docs/ai/framework/rules/data-flow-and-transactions.md'
      ],
      specRefs: [
        '#reuse-the-existing-inverse-replay-engine',
        '#rollback',
        '#undo'
      ],
      failureOwnerStepId: 'finalize-transaction-state'
    },
    {
      id: 'settle-local-shared-projection',
      order: 6,
      laneId: 'factory',
      title: 'Settle local shared projection',
      ownerPackage: '@asyra/factory',
      purpose:
        'Flush committed transaction-end changes, discard rolled-back pending changes, or compensate immediate local projections exactly once.',
      inputs: [
        'artifact:active-transaction-journal',
        'artifact:canonical-transaction-outcome',
        'registered local shared channels'
      ],
      outputs: ['artifact:transaction-result'],
      conditions: [
        'Committed transaction-end shared changes flush in journal order.',
        'A registered transaction-end channel append failure before application requests rollback, restores the provisional history transition, leaves no final undo history or user-action-completed effect, and propagates the delivery failure after restoration.',
        'Partially delivered transaction-end changes are compensated in reverse order when a later append fails before application.',
        'Rolled-back immediate local delivery publishes one compensating inverse.',
        'An applied Yjs append remains delivered when a synchronous observer throws, and registered observers are isolated from one another.',
        'Instance-local status observer failures cannot alter the canonical transaction result or block downstream observers.'
      ],
      bypasses: [
        'Rollback discards undelivered transaction-end changes.',
        'No Yjs network provider, presence, remote origin, or deduplication policy is defined here.'
      ],
      allowedContributors: [
        'factory shared-channel registry',
        'instance-local status observers'
      ],
      forbiddenContributors: [
        'Yjs network provider',
        'remote conflict policy',
        'persistence provider'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/factory/src/**'],
      specRefs: ['#shared-delivery-during-rollback', '#non-goals'],
      failureOwnerStepId: 'settle-local-shared-projection'
    },
    {
      id: 'acknowledge-persistence',
      order: 7,
      laneId: 'durability',
      title: 'Acknowledge persistence',
      ownerPackage: '@asyra/core',
      purpose:
        'Serialize persistence requests for committed action, undo, and redo results and report durable acknowledgement separately.',
      inputs: [
        'artifact:transaction-result',
        'configured persistence provider'
      ],
      outputs: ['artifact:persistence-status'],
      conditions: [
        'Committed action, undo, and redo results enter the persistence queue in order.',
        'Each committed result captures its configured provider and CoreRawData snapshot before entering the queue; the snapshot is deeply detached from live mutable references, and queued work performs provider I/O without re-reading live runtime state.',
        'Provider success reports persisted and provider failure reports persistence-failed.'
      ],
      bypasses: [
        'Missing provider reports persistence-skipped.',
        'Discarded, rolled-back, and rollback-failed results do not request persistence.',
        'Persistence failure never rolls back committed runtime state.'
      ],
      allowedContributors: ['injected factory instance', 'persistence provider'],
      forbiddenContributors: [
        'global transaction-end subscription',
        'runtime rollback',
        'parallel save calls'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/core/src/**'],
      specRefs: ['#durability', '#commit-and-persist'],
      failureOwnerStepId: 'acknowledge-persistence'
    }
  ]

  const routes = [
    {
      id: 'boundary-to-journal',
      from: 'coordinate-transaction-boundary',
      to: 'record-reversible-journal',
      kind: 'normal',
      predicate: 'an outer transaction is active and a state owner mutates',
      producedArtifacts: ['artifact:transaction-boundary']
    },
    {
      id: 'boundary-to-feature-decision',
      from: 'coordinate-transaction-boundary',
      to: 'decide-feature-outcome',
      kind: 'normal',
      predicate: 'the transaction is owned by a feature execution or session',
      producedArtifacts: ['artifact:transaction-boundary']
    },
    {
      id: 'journal-to-validation',
      from: 'record-reversible-journal',
      to: 'validate-requested-commit',
      kind: 'normal',
      predicate: 'the requested outcome is a non-empty commit',
      producedArtifacts: ['artifact:active-transaction-journal']
    },
    {
      id: 'journal-to-finalize',
      from: 'record-reversible-journal',
      to: 'finalize-transaction-state',
      kind: 'normal',
      predicate: 'the outer boundary closes with any outcome',
      producedArtifacts: ['artifact:active-transaction-journal']
    },
    {
      id: 'journal-to-shared',
      from: 'record-reversible-journal',
      to: 'settle-local-shared-projection',
      kind: 'normal',
      predicate: 'finalization requires shared flush, discard, or compensation',
      producedArtifacts: ['artifact:active-transaction-journal']
    },
    {
      id: 'decision-to-validation',
      from: 'decide-feature-outcome',
      to: 'validate-requested-commit',
      kind: 'normal',
      predicate: 'feature completion requests commit',
      producedArtifacts: ['artifact:transaction-outcome-request']
    },
    {
      id: 'decision-to-finalize',
      from: 'decide-feature-outcome',
      to: 'finalize-transaction-state',
      kind: 'bypass',
      predicate: 'rollback, discard, or validated commit is ready to finalize',
      producedArtifacts: ['artifact:transaction-outcome-request']
    },
    {
      id: 'validation-to-finalize',
      from: 'validate-requested-commit',
      to: 'finalize-transaction-state',
      kind: 'normal',
      predicate: 'validation accepts commit or converts failure to rollback',
      producedArtifacts: ['artifact:commit-validation']
    },
    {
      id: 'finalize-to-shared',
      from: 'finalize-transaction-state',
      to: 'settle-local-shared-projection',
      kind: 'normal',
      predicate: 'canonical commit, rollback, discard, or failure outcome exists',
      producedArtifacts: ['artifact:canonical-transaction-outcome']
    },
    {
      id: 'shared-to-persistence',
      from: 'settle-local-shared-projection',
      to: 'acknowledge-persistence',
      kind: 'normal',
      predicate: 'a finalized transaction result is available',
      producedArtifacts: ['artifact:transaction-result']
    },
    {
      id: 'persistence-status-terminal',
      from: 'acknowledge-persistence',
      kind: 'terminal',
      predicate: 'persistence is acknowledged, skipped, failed, or bypassed',
      producedArtifacts: ['artifact:persistence-status']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:transaction-boundary',
      ownerStepId: 'coordinate-transaction-boundary',
      consumerStepIds: [
        'record-reversible-journal',
        'decide-feature-outcome'
      ],
      channel: 'transaction-lifecycle',
      terminal: false
    },
    {
      id: 'artifact:active-transaction-journal',
      ownerStepId: 'record-reversible-journal',
      consumerStepIds: [
        'validate-requested-commit',
        'finalize-transaction-state',
        'settle-local-shared-projection'
      ],
      channel: 'factory-internal',
      terminal: false
    },
    {
      id: 'artifact:transaction-outcome-request',
      ownerStepId: 'decide-feature-outcome',
      consumerStepIds: [
        'validate-requested-commit',
        'finalize-transaction-state'
      ],
      channel: 'transaction-lifecycle',
      terminal: false
    },
    {
      id: 'artifact:commit-validation',
      ownerStepId: 'validate-requested-commit',
      consumerStepIds: ['finalize-transaction-state'],
      channel: 'factory-internal',
      terminal: false
    },
    {
      id: 'artifact:canonical-transaction-outcome',
      ownerStepId: 'finalize-transaction-state',
      consumerStepIds: ['settle-local-shared-projection'],
      channel: 'factory-internal',
      terminal: false
    },
    {
      id: 'artifact:transaction-result',
      ownerStepId: 'settle-local-shared-projection',
      consumerStepIds: ['acknowledge-persistence'],
      channel: 'instance-status',
      terminal: false
    },
    {
      id: 'artifact:persistence-status',
      ownerStepId: 'acknowledge-persistence',
      consumerStepIds: [],
      channel: 'instance-status',
      terminal: true
    }
  ]

  const allStepIds = steps.map((step) => step.id)
  const invariants = [
    {
      id: 'rollback-restores-recorded-state',
      statement:
        'A failed uncommitted action restores every successfully reversible rollbackable mutation in reverse order without history effects.',
      stepIds: [
        'record-reversible-journal',
        'finalize-transaction-state'
      ],
      artifactIds: [
        'artifact:active-transaction-journal',
        'artifact:canonical-transaction-outcome'
      ],
      specRefs: ['#atomicity', '#rollback']
    },
    {
      id: 'commit-effects-after-validation',
      statement:
        'Undo history, transaction-end shared delivery, completion, and persistence are not committed before validation succeeds.',
      stepIds: [
        'validate-requested-commit',
        'finalize-transaction-state',
        'settle-local-shared-projection',
        'acknowledge-persistence'
      ],
      artifactIds: [
        'artifact:commit-validation',
        'artifact:transaction-result'
      ],
      specRefs: ['#consistency', '#durability']
    },
    {
      id: 'instance-local-status',
      statement:
        'Factory and Core instance status never crosses into another custom runtime instance.',
      stepIds: [
        'settle-local-shared-projection',
        'acknowledge-persistence'
      ],
      artifactIds: [
        'artifact:transaction-result',
        'artifact:persistence-status'
      ],
      specRefs: ['#ownership']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'supported-transaction-outcomes',
      title: 'Supported transaction outcomes',
      stepIds: allStepIds,
      specRefs: ['#product-cases-and-failure-behavior'],
      assertions: [
        'normal, no-op, nested rollback, cancel, handler failure, timeout, validation failure, rollback failure, undo, redo, and persistence failure have explicit routes'
      ]
    },
    {
      id: 'local-acid-contract',
      title: 'Local ACID-inspired contract',
      stepIds: allStepIds,
      specRefs: ['#acid-interpretation-for-asyra'],
      assertions: [
        'atomicity, registered consistency, interaction isolation, and persistence acknowledgement remain distinct owner responsibilities'
      ]
    },
    {
      id: 'definition-of-done',
      title: 'Definition of Done',
      stepIds: allStepIds,
      specRefs: ['#success-criteria'],
      assertions: [
        'formal package, integration, lint, and build gates prove the implementation without Yjs networking'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'transaction-atomicity',
      kind: 'system',
      title: 'Transaction Atomicity Inspector Flow',
      subtitle:
        'Owner and handoff map for local commit, rollback, shared projection, and persistence acknowledgement.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'transaction-atomicity-and-rollback-plan.md',
      inspectorOwner: 'transaction-flow-inspector.data.cjs'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Transaction Atomicity Contract',
        href: './transaction-atomicity-and-rollback-plan.md',
        kind: 'authority'
      },
      {
        id: 'inspector-data',
        label: 'Inspector Data',
        href: './transaction-flow-inspector.data.cjs',
        kind: 'source'
      },
      {
        id: 'inspector-readiness-rule',
        label: 'Inspector Contract Readiness',
        href: '../rules/inspector-contract-readiness.md',
        kind: 'framework'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: './flow-inspector-dashboard-plan.md',
        kind: 'framework'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const freeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }

  freeze(data)

  if (typeof globalThis !== 'undefined') {
    globalThis.FLOW_INSPECTOR_DATA = data
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
