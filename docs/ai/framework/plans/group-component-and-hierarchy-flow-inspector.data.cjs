;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/group-component-and-hierarchy-behaviors-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Intent and Remote Policy', order: 1 },
    { id: 'preset', title: 'Official Preset Group Operations', order: 2 },
    { id: 'scene-tree', title: 'Canonical Hierarchy State', order: 3 },
    { id: 'factory', title: 'Transaction and Publication', order: 4 },
    { id: 'persistence', title: 'Save and Load', order: 5 },
    { id: 'projection', title: 'Render Projection', order: 6 }
  ]

  const steps = [
    {
      id: 'route-app-hierarchy-request',
      order: 1,
      laneId: 'app',
      title: 'Route an app-owned hierarchy request',
      ownerPackage: 'app feature or command',
      purpose:
        'Choose element ids and an operation without moving selection, shortcut, menu, hover, click, or presentation policy into Framework or Preset.',
      inputs: [
        'app-owned selected ids or command input',
        'requested group, ungroup, move, reorder, or subtree removal'
      ],
      outputs: [
        'artifact:preset-group-request',
        'artifact:generic-hierarchy-request'
      ],
      conditions: [
        'App code chooses ids and the requested product action.',
        'Group and ungroup requests use the official Preset adapter when that default is installed.',
        'Generic move and reorder requests use the public Preset Group geometry adapter, which delegates canonical mutation to Core and bypasses geometry normalization when no official Group boundary is involved.',
        'Subtree removal requests use the public ID-based Core hierarchy facade.'
      ],
      bypasses: [
        'Headless consumers may invoke the same public adapters without installing app UI.',
        'No Group UI, shortcut, menu, hover, click, selection, or post-operation selection behavior is required by this release gate.'
      ],
      allowedContributors: [
        'app feature or command input',
        'app common API boundary',
        'public Core and Preset APIs'
      ],
      forbiddenContributors: [
        'direct parentId or children mutation',
        'internal Group instance ownership in app code',
        'Render-derived hierarchy',
        'framework-owned selection or UI policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/src/types.d.ts',
        'packages/core/src/apis/scene-tree.ts',
        'packages/core/src/types/scene-tree.ts'
      ],
      specRefs: [
        '#render-and-app',
        '#public-input-and-output-contracts',
        '#unsupported-and-app-owned-behavior'
      ],
      failureOwnerStepId: 'route-app-hierarchy-request'
    },
    {
      id: 'apply-app-remote-hierarchy-policy',
      order: 2,
      laneId: 'app',
      title: 'Apply app-owned remote hierarchy policy',
      ownerPackage: 'app collaboration adapter',
      purpose:
        'Validate a received publication and decide permission, domain order, duplicate, and concurrent-conflict policy before canonical mutation.',
      inputs: ['artifact:remote-hierarchy-publication'],
      outputs: [
        'artifact:accepted-remote-hierarchy-request',
        'artifact:remote-hierarchy-rejection'
      ],
      conditions: [
        'The app validates every delivery before opening the remote mutation.',
        'The app or backend owns permission, domain ordering, duplicate handling, last-write-wins if any, and concurrent hierarchy conflict behavior.',
        'An accepted request enters one Factory remote transaction and the same Scene Tree validation/mutation boundary as local requests.'
      ],
      bypasses: [
        'A rejected, stale, unauthorized, duplicate, or conflicting publication produces no canonical mutation.',
        'Apps may choose to accept repeated publications; Collaboration never suppresses them.'
      ],
      allowedContributors: [
        'artifact:remote-hierarchy-publication',
        'app route and payload validation',
        'app/backend permission and conflict policy',
        'Factory remote transaction boundary'
      ],
      forbiddenContributors: [
        '@asyra/collaboration semantic policy',
        'Provider timestamp authority',
        'Render/UI repair state',
        'partial delivery apply before publication validation completes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'packages/factory/src/factory.ts'
      ],
      specRefs: [
        '#remote-hierarchy-apply',
        '#factory-and-collaboration-pipeline',
        '#unsupported-and-app-owned-behavior'
      ],
      failureOwnerStepId: 'apply-app-remote-hierarchy-policy'
    },
    {
      id: 'prepare-preset-group-operation',
      order: 1,
      laneId: 'preset',
      title: 'Prepare the official Group operation',
      ownerPackage: '@asyra/preset',
      purpose:
        'Translate an ID-driven group or ungroup request into one official Group creation/removal and 2D coordinate/bounds plan without becoming hierarchy authority.',
      inputs: ['artifact:preset-group-request'],
      outputs: ['artifact:preset-group-operation-plan'],
      conditions: [
        'CONTAINERS already owns the one official GROUP component and no second Group registration is created.',
        'The plan reads canonical sibling and computed geometry snapshots only to prepare the official operation.',
        'Group uses canonical sibling order and the first selected sibling slot; ungroup uses the existing Group slot.'
      ],
      bypasses: [
        'Generic reparent, reorder, and subtree removal do not require the Preset Group adapter.',
        'An app that replaced the official Group capability may omit these Preset adapters.'
      ],
      allowedContributors: [
        'artifact:preset-group-request',
        'public Core/Scene Tree read APIs',
        'official GROUP component identity',
        'basic translation-only 2D bounds math'
      ],
      forbiddenContributors: [
        'duplicate Group component registration',
        'app selection or naming policy',
        'auto-layout, resize/scaling, clipping, symbols, or constraints',
        'direct parentId or children writes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/components/group.ts',
        'packages/preset/src/defaults/modules/containers.ts',
        'packages/preset/src/index.ts',
        'packages/preset/src/__tests__'
      ],
      specRefs: [
        '#preset-group-operations',
        '#preset',
        '#group',
        '#ungroup'
      ],
      failureOwnerStepId: 'prepare-preset-group-operation'
    },
    {
      id: 'mutate-canonical-hierarchy',
      order: 1,
      laneId: 'scene-tree',
      title: 'Validate and mutate canonical hierarchy',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Validate the complete ID-based operation before the first write, then preserve identity while atomically changing parent membership, child order, or subtree lifecycle.',
      inputs: [
        'artifact:generic-hierarchy-request',
        'artifact:preset-group-operation-plan',
        'artifact:accepted-remote-hierarchy-request'
      ],
      outputs: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:canonical-hierarchy-rejection',
        'artifact:canonical-hierarchy-state'
      ],
      conditions: [
        'Input ids are non-empty, unique, existing, non-workspace siblings with one current parent.',
        'The target is an existing registered container and targetIndex is bounded against the final target list after moved ids are removed.',
        'Self-parenting, descendant cycles, duplicate membership, missing ids, mixed parents, workspace movement, invalid targets, and invalid indexes reject before mutation.',
        'Moved entities retain their exact instances and ids; no move is implemented as delete plus recreate.',
        'Subtree removal is deterministic and descendant-first, while restoration retains exact instances, parent ids, indexes, child order, props references, and Group data.',
        'A same-parent no-op returns success without a transaction event.'
      ],
      bypasses: [
        'A fully rejected request emits no hierarchy mutation, property change, publication, or projection.',
        'Ungrouping an empty Group performs no child move and proceeds only with deterministic Group removal.'
      ],
      allowedContributors: [
        'registered isContainer component metadata',
        'canonical Scene Tree element map',
        'canonical parentId and children values',
        'Factory-recordable exact before/after hierarchy evidence'
      ],
      forbiddenContributors: [
        'Preset or app hierarchy validation',
        'Render hierarchy state',
        'delete-and-recreate move simulation',
        'silent runtime repair',
        'fixture-specific exception'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/components/group.ts',
        'packages/scene-tree/src/components/workspace.ts',
        'packages/scene-tree/src/subscribes.ts',
        'packages/scene-tree/src/__tests__',
        'packages/utils/src/constants/scene-tree.ts',
        'packages/utils/src/types/scene-tree.ts',
        'packages/utils/src/sceneTree',
        'packages/reactive-events/src/scene-tree',
        'packages/reactive-events/src/types.ts',
        'packages/core/src/core.ts',
        'packages/core/src/apis/scene-tree.ts',
        'packages/core/src/types/scene-tree.ts',
        'packages/core/src/__tests__/scene-tree-api.test.ts'
      ],
      specRefs: [
        '#scene-tree-hierarchy-request',
        '#scene-tree',
        '#reparent-and-reorder',
        '#subtree-and-lifecycle'
      ],
      failureOwnerStepId: 'mutate-canonical-hierarchy'
    },
    {
      id: 'normalize-preset-group-geometry',
      order: 2,
      laneId: 'preset',
      title: 'Normalize explicit Group operations and expose pure bounds',
      ownerPackage: '@asyra/preset',
      purpose:
        'Apply coordinate conversion and operation-produced Group geometry only for explicit Group/Ungroup, identity-preserving reparent, or an official Group-targeted operation that requires it; expose direct-child bounds derivation as a pure read.',
      inputs: [
        'artifact:preset-group-operation-plan',
        'artifact:canonical-hierarchy-mutation',
        'explicit mutation target and operation kind',
        'registered canonical direct-child x, y, width, and height values'
      ],
      outputs: ['artifact:preset-group-geometry-mutation'],
      conditions: [
        'Group x and y are canonical container translation; width and height are operation-produced snapshots retained for document compatibility rather than live shape geometry.',
        'Grouping preserves child world positions by subtracting the new Group origin from direct-child coordinates.',
        'Ungrouping preserves child world positions by adding the removed Group origin in the target parent coordinate space.',
        'Explicit Group/Ungroup and identity-preserving reparent operations use one canonical rectangle union, deepest affected Group first when ancestors are part of that explicit operation.',
        'An official Group-targeted geometry operation normalizes only when that operation contract requires it.',
        'deriveGroupBounds is a pure read and never writes canonical data, creates History, publishes changes, or participates in persistence.',
        'All geometry writes remain in the same Factory transaction and use ordinary property/computed validation.'
      ],
      bypasses: [
        'An empty Group ungroup has no child coordinate writes.',
        'A descendant-only position or dimension mutation bypasses Group normalization and does not walk ancestors or rebase siblings.',
        'Selecting or hovering a Group uses read-only projection and never enters this canonical mutation path.',
        'Unregistered rotation, scale, or skew values cannot contribute until component registration, persistence, and Render share their canonical contract.',
        'Generic containers and app-replaced Group capabilities do not use official Group geometry normalization.'
      ],
      allowedContributors: [
        'artifact:preset-group-operation-plan',
        'artifact:canonical-hierarchy-mutation',
        'public Core property/computed APIs',
        'finite canonical translation, rectangle-union, and coordinate-rebasing math',
        'pure read-only direct-child bounds derivation'
      ],
      forbiddenContributors: [
        'Render bounds as canonical input',
        'auto-layout or descendant scaling',
        'unregistered transform values, clipping, symbol, or constraint policy',
        'recursive observer loop',
        'descendant-only mutation triggering ancestor Group writes',
        'selection or hover triggering canonical Group mutation',
        'visible-jump fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/components/group.ts',
        'packages/preset/src/defaults/modules/containers.ts',
        'packages/preset/src/__tests__',
        'packages/core/src/apis/scene-tree.ts',
        'packages/core/src/apis/create-apis.ts',
        'packages/core/src/types/scene-tree.ts',
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/scene-tree-api.test.ts',
        'packages/reactive-events/src/scene-tree/publish.ts'
      ],
      specRefs: [
        '#preset-group-operations',
        '#group',
        '#ungroup',
        '#preset'
      ],
      failureOwnerStepId: 'normalize-preset-group-geometry'
    },
    {
      id: 'project-preset-hierarchy-ui-context',
      order: 3,
      laneId: 'preset',
      title: 'Project canonical hierarchy into App UI context',
      ownerPackage: '@asyra/preset',
      purpose:
        'Project accepted canonical hierarchy lifecycle changes into flattenedElementIds and elementDataMap without validating, repairing, or owning hierarchy.',
      inputs: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:loaded-canonical-hierarchy'
      ],
      outputs: ['artifact:preset-hierarchy-ui-context'],
      conditions: [
        'ADD_ELEMENT, REMOVE_ELEMENT, MOVE_ELEMENTS, REMOVE_SUBTREE, and RESTORE_SUBTREE all refresh flattenedElementIds and elementDataMap from canonical Scene Tree state.',
        'Validated replace-style load refreshes both projections from the loaded canonical hierarchy.',
        'The published order, parent values, child values, additions, and removals exactly reflect canonical Scene Tree state after settlement.'
      ],
      bypasses: [
        'A rejected request or rejected load produces no final UI-context projection.',
        'Headless consumers may ignore the App-facing UI-context values without changing canonical hierarchy behavior.'
      ],
      allowedContributors: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:loaded-canonical-hierarchy',
        'canonical Scene Tree channel envelopes and read APIs',
        'Preset UI-context property subjects'
      ],
      forbiddenContributors: [
        'second canonical hierarchy',
        'Preset hierarchy validation or repair',
        'App or Render repair state',
        'selection, shortcut, menu, hover, click, or conflict policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/selection-subscriptions.test.ts'
      ],
      specRefs: [
        '#preset',
        '#subtree-and-lifecycle',
        '#product-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'project-preset-hierarchy-ui-context'
    },
    {
      id: 'settle-hierarchy-transaction',
      order: 1,
      laneId: 'factory',
      title: 'Settle one hierarchy transaction',
      ownerPackage: '@asyra/factory',
      purpose:
        'Commit one intended hierarchy request as one undo entry and one grouped shared publication, or roll back every recorded hierarchy/property write.',
      inputs: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:preset-group-geometry-mutation'
      ],
      outputs: [
        'artifact:committed-hierarchy-transaction',
        'artifact:rolled-back-hierarchy-transaction',
        'artifact:hierarchy-shared-publication'
      ],
      conditions: [
        'The outer transaction opens before the first canonical mutation and closes after all required hierarchy and Preset geometry writes.',
        'One group, ungroup, move, reorder, or subtree removal request creates at most one intended undo commit.',
        'Rollback restores exact identities, parent ids, indexes, child order, property state, and Group data without an undo entry.',
        'Undo and redo replay exact inverse/forward hierarchy evidence and publish their ordinary grouped inverse/forward changes.',
        'Remote origin is rollbackable, non-undoable, and cannot echo a new shared publication.'
      ],
      bypasses: [
        'A Scene Tree rejection or semantic no-op creates no history entry or shared publication.',
        'A local unshared operation may commit without a shared publication.'
      ],
      allowedContributors: [
        'Factory journal and transaction owner',
        'Scene Tree exact hierarchy inverse evidence',
        'Props/computed inverse evidence',
        'registered shared channel settlement'
      ],
      forbiddenContributors: [
        'Factory hierarchy validation',
        'Factory dedupe or conflict policy',
        'split undo commits for one request',
        'partial rollback acceptance'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/factory.ts',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/shared-delivery.ts',
        'packages/factory/src/__tests__/data-transact.test.ts',
        'packages/factory/src/__tests__/shared-publication.test.ts',
        'packages/factory/src/__tests__/factory-instance-replay.test.ts',
        'packages/core/src/__tests__/hierarchy-transaction.test.ts'
      ],
      specRefs: [
        '#factory-and-collaboration-pipeline',
        '#subtree-and-lifecycle',
        '#product-cases'
      ],
      failureOwnerStepId: 'settle-hierarchy-transaction'
    },
    {
      id: 'transport-hierarchy-publication',
      order: 2,
      laneId: 'factory',
      title: 'Transport hierarchy publication unchanged',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Forward the completed Factory publication once and in FIFO order without adding hierarchy semantics, dedupe, ordering, or conflict state.',
      inputs: ['artifact:hierarchy-shared-publication'],
      outputs: ['artifact:remote-hierarchy-publication'],
      conditions: [
        'Repeated and equal publications remain repeated app intent.',
        'One Factory publication remains one Provider send and one receiving app callback.',
        'Collaboration preserves transport order and retains no semantic history after settlement.'
      ],
      bypasses: [
        'A disconnected peer misses the publication and receives no framework replay.',
        'Collaboration-disabled apps create no transport resources.'
      ],
      allowedContributors: [
        'artifact:hierarchy-shared-publication',
        'Provider wire integrity and live FIFO transport',
        'detached publication cloning'
      ],
      forbiddenContributors: [
        'hierarchy operation registry',
        'dedupe',
        'timestamp or last-write-wins ordering',
        'conflict resolution or convergence registry',
        'semantic history'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/process.test.ts',
        'packages/collaboration/src/__tests__/action-publication.test.ts',
        'docs/ai/framework/plans/__tests__/network-collaboration-transport-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#remote-hierarchy-apply',
        '#factory-and-collaboration-pipeline',
        '#product-cases'
      ],
      failureOwnerStepId: 'transport-hierarchy-publication'
    },
    {
      id: 'validate-save-load-hierarchy',
      order: 1,
      laneId: 'persistence',
      title: 'Validate exact hierarchy save and load',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Serialize exact canonical hierarchy state and validate a complete untrusted hierarchy before replace-style load apply.',
      inputs: [
        'artifact:canonical-hierarchy-state',
        'untrusted Scene Tree load payload',
        'Core load orchestration'
      ],
      outputs: [
        'artifact:saved-hierarchy-snapshot',
        'artifact:loaded-canonical-hierarchy',
        'artifact:hierarchy-load-rejection'
      ],
      conditions: [
        'Save preserves one parent per non-workspace element, exact child order, nested Groups, props references, and Group data.',
        'Load validates ids, one-parent membership, exact parent/child agreement, registered containers, duplicate membership, missing parents/children, cycles, and workspace roots before apply.',
        'The owner-issued one-shot load artifact is instance-bound and replace-style apply leaves no prior hierarchy state.',
        'Invalid hierarchy follows the documented load rejection or normalization boundary and runtime mutation never silently repairs input.'
      ],
      bypasses: [
        'A nullish no-document input bypasses package apply through Core.',
        'A rejected load applies no canonical prefix and triggers no Render rebuild.'
      ],
      allowedContributors: [
        'untrusted load payload',
        'Scene Tree validator and owner-issued artifact',
        'Core ordered load orchestration',
        'registered component container metadata'
      ],
      forbiddenContributors: [
        'app schema history inside Scene Tree',
        'Render reconstruction of malformed hierarchy',
        'partial load apply',
        'shared hierarchy state across Scene Tree/Core instances'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/components/workspace.ts',
        'packages/scene-tree/src/__tests__',
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/load-validation.test.ts'
      ],
      specRefs: [
        '#subtree-and-lifecycle',
        '#scene-tree-hierarchy-request',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'validate-save-load-hierarchy'
    },
    {
      id: 'project-render-hierarchy',
      order: 1,
      laneId: 'projection',
      title: 'Project identity-safe hierarchy',
      ownerPackage: '@asyra/render',
      purpose:
        'Project committed canonical parent and sibling order while retaining the same element-to-engine ownership across reparent and reorder handoff.',
      inputs: [
        'artifact:committed-hierarchy-transaction',
        'artifact:loaded-canonical-hierarchy'
      ],
      outputs: ['artifact:identity-safe-render-hierarchy'],
      conditions: [
        'Render consumes canonical parent/index or complete load order and never invents hierarchy.',
        'Reparent and reorder reuse the existing element identity and abstract engine handle.',
        'Hierarchy bookkeeping commits only after append or set-child-index succeeds, preserving retry ownership on failure.',
        'Reload rebuilds parents before children and siblings in canonical order.'
      ],
      bypasses: [
        'A rejected or rolled-back operation produces no final hierarchy projection.',
        'Headless Core retains canonical hierarchy correctness without Render.'
      ],
      allowedContributors: [
        'committed Scene Tree projection envelopes',
        'complete canonical load snapshot',
        'engine-neutral append-child, remove-child, and set-child-index commands',
        'existing elementId projection ownership'
      ],
      forbiddenContributors: [
        'Render-owned canonical parent or child state',
        'delete-and-recreate visual handoff',
        'patch or fallback hierarchy',
        'app-specific visual exception',
        'concrete-engine identity policy'
      ],
      cacheDimensions: ['elementId'],
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/render.ts',
        'packages/render/src/layers/viewport/viewport-layer.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/types/render-object.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'packages/render/src/__tests__/render.test.ts',
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/selection-subscriptions.test.ts',
        'packages/render-engine/src/types.ts',
        'packages/render-engine/src/__tests__',
        'packages/render-engine-pixi/src/pixi-render-engine.ts',
        'packages/render-engine-pixi/src/__tests__'
      ],
      specRefs: [
        '#render-and-app',
        '#reparent-and-reorder',
        '#product-cases'
      ],
      failureOwnerStepId: 'project-render-hierarchy'
    }
  ]

  const routes = [
    {
      id: 'app-routes-group-request',
      from: 'route-app-hierarchy-request',
      to: 'prepare-preset-group-operation',
      kind: 'handoff',
      predicate: 'The app requests official Preset group or ungroup.',
      producedArtifacts: ['artifact:preset-group-request']
    },
    {
      id: 'app-routes-generic-request',
      from: 'route-app-hierarchy-request',
      to: 'mutate-canonical-hierarchy',
      kind: 'handoff',
      predicate: 'The app requests generic move, reorder, or subtree removal.',
      producedArtifacts: ['artifact:generic-hierarchy-request']
    },
    {
      id: 'preset-requests-hierarchy',
      from: 'prepare-preset-group-operation',
      to: 'mutate-canonical-hierarchy',
      kind: 'handoff',
      predicate: 'Preset has prepared the official Group operation plan.',
      producedArtifacts: ['artifact:preset-group-operation-plan']
    },
    {
      id: 'preset-operation-defines-geometry',
      from: 'prepare-preset-group-operation',
      to: 'normalize-preset-group-geometry',
      kind: 'handoff',
      predicate:
        'The same official Group operation plan defines the required coordinate and bounds normalization.',
      producedArtifacts: ['artifact:preset-group-operation-plan']
    },
    {
      id: 'remote-policy-accepted',
      from: 'apply-app-remote-hierarchy-policy',
      to: 'mutate-canonical-hierarchy',
      kind: 'handoff',
      predicate: 'App/backend policy accepts the remote hierarchy request.',
      producedArtifacts: ['artifact:accepted-remote-hierarchy-request']
    },
    {
      id: 'remote-policy-rejected',
      from: 'apply-app-remote-hierarchy-policy',
      kind: 'terminal',
      predicate: 'App/backend policy rejects the remote hierarchy request.',
      producedArtifacts: ['artifact:remote-hierarchy-rejection']
    },
    {
      id: 'canonical-hierarchy-rejected',
      from: 'mutate-canonical-hierarchy',
      kind: 'terminal',
      predicate: 'Complete Scene Tree validation rejects before mutation.',
      producedArtifacts: ['artifact:canonical-hierarchy-rejection']
    },
    {
      id: 'group-hierarchy-needs-geometry',
      from: 'mutate-canonical-hierarchy',
      to: 'normalize-preset-group-geometry',
      kind: 'handoff',
      predicate: 'The accepted mutation belongs to official Group or ungroup.',
      producedArtifacts: ['artifact:canonical-hierarchy-mutation']
    },
    {
      id: 'generic-hierarchy-ready-to-settle',
      from: 'mutate-canonical-hierarchy',
      to: 'settle-hierarchy-transaction',
      kind: 'handoff',
      predicate: 'The accepted generic mutation requires no Preset geometry.',
      producedArtifacts: ['artifact:canonical-hierarchy-mutation']
    },
    {
      id: 'canonical-state-available',
      from: 'mutate-canonical-hierarchy',
      to: 'validate-save-load-hierarchy',
      kind: 'observational',
      predicate: 'Canonical hierarchy is eligible for exact serialization.',
      producedArtifacts: ['artifact:canonical-hierarchy-state']
    },
    {
      id: 'canonical-hierarchy-projects-to-preset-ui-context',
      from: 'mutate-canonical-hierarchy',
      to: 'project-preset-hierarchy-ui-context',
      kind: 'projection',
      predicate:
        'An accepted canonical hierarchy lifecycle change is available to Preset UI-context subscribers.',
      producedArtifacts: ['artifact:canonical-hierarchy-mutation']
    },
    {
      id: 'preset-geometry-ready-to-settle',
      from: 'normalize-preset-group-geometry',
      to: 'settle-hierarchy-transaction',
      kind: 'handoff',
      predicate: 'Official Group coordinates and bounds are applied.',
      producedArtifacts: ['artifact:preset-group-geometry-mutation']
    },
    {
      id: 'hierarchy-transaction-rolled-back',
      from: 'settle-hierarchy-transaction',
      kind: 'terminal',
      predicate: 'Mutation, validation, or settlement failure rolls back.',
      producedArtifacts: ['artifact:rolled-back-hierarchy-transaction']
    },
    {
      id: 'hierarchy-transaction-committed',
      from: 'settle-hierarchy-transaction',
      to: 'project-render-hierarchy',
      kind: 'projection',
      predicate: 'The local or remote transaction commits canonical state.',
      producedArtifacts: ['artifact:committed-hierarchy-transaction']
    },
    {
      id: 'hierarchy-publication-ready',
      from: 'settle-hierarchy-transaction',
      to: 'transport-hierarchy-publication',
      kind: 'handoff',
      predicate: 'A local shared action, undo, redo, or compensation publishes.',
      producedArtifacts: ['artifact:hierarchy-shared-publication']
    },
    {
      id: 'hierarchy-publication-received',
      from: 'transport-hierarchy-publication',
      to: 'apply-app-remote-hierarchy-policy',
      kind: 'handoff',
      predicate: 'A currently connected peer receives the publication.',
      producedArtifacts: ['artifact:remote-hierarchy-publication']
    },
    {
      id: 'hierarchy-saved',
      from: 'validate-save-load-hierarchy',
      kind: 'terminal',
      predicate: 'Core serializes the exact validated canonical hierarchy.',
      producedArtifacts: ['artifact:saved-hierarchy-snapshot']
    },
    {
      id: 'hierarchy-load-rejected',
      from: 'validate-save-load-hierarchy',
      kind: 'terminal',
      predicate: 'Scene Tree validation rejects malformed hierarchy before apply.',
      producedArtifacts: ['artifact:hierarchy-load-rejection']
    },
    {
      id: 'hierarchy-loaded',
      from: 'validate-save-load-hierarchy',
      to: 'project-render-hierarchy',
      kind: 'projection',
      predicate: 'Owner-issued load validation applies one exact hierarchy.',
      producedArtifacts: ['artifact:loaded-canonical-hierarchy']
    },
    {
      id: 'loaded-hierarchy-projects-to-preset-ui-context',
      from: 'validate-save-load-hierarchy',
      to: 'project-preset-hierarchy-ui-context',
      kind: 'projection',
      predicate:
        'The validated replace-style load is available to Preset UI-context subscribers.',
      producedArtifacts: ['artifact:loaded-canonical-hierarchy']
    },
    {
      id: 'preset-hierarchy-ui-context-projected',
      from: 'project-preset-hierarchy-ui-context',
      kind: 'terminal',
      predicate:
        'The App-facing flattened id and element-data projections reflect canonical Scene Tree state.',
      producedArtifacts: ['artifact:preset-hierarchy-ui-context']
    },
    {
      id: 'render-hierarchy-projected',
      from: 'project-render-hierarchy',
      kind: 'terminal',
      predicate: 'The engine-neutral hierarchy handoff succeeds.',
      producedArtifacts: ['artifact:identity-safe-render-hierarchy']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:preset-group-request',
      title: 'App-owned official Group request',
      ownerStepId: 'route-app-hierarchy-request',
      channel: 'public API',
      consumerStepIds: ['prepare-preset-group-operation'],
      terminal: false
    },
    {
      id: 'artifact:generic-hierarchy-request',
      title: 'ID-based generic hierarchy request',
      ownerStepId: 'route-app-hierarchy-request',
      channel: 'public API',
      consumerStepIds: ['mutate-canonical-hierarchy'],
      terminal: false
    },
    {
      id: 'artifact:preset-group-operation-plan',
      title: 'Official Group operation and geometry plan',
      ownerStepId: 'prepare-preset-group-operation',
      channel: 'Preset/Core handoff',
      consumerStepIds: [
        'mutate-canonical-hierarchy',
        'normalize-preset-group-geometry'
      ],
      terminal: false
    },
    {
      id: 'artifact:accepted-remote-hierarchy-request',
      title: 'App-accepted remote hierarchy request',
      ownerStepId: 'apply-app-remote-hierarchy-policy',
      channel: 'app remote transaction',
      consumerStepIds: ['mutate-canonical-hierarchy'],
      terminal: false
    },
    {
      id: 'artifact:remote-hierarchy-rejection',
      title: 'App-owned remote rejection',
      ownerStepId: 'apply-app-remote-hierarchy-policy',
      channel: 'terminal policy result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canonical-hierarchy-mutation',
      title: 'Exact identity-preserving hierarchy mutation',
      ownerStepId: 'mutate-canonical-hierarchy',
      channel: 'canonical owner result',
      consumerStepIds: [
        'normalize-preset-group-geometry',
        'settle-hierarchy-transaction',
        'project-preset-hierarchy-ui-context'
      ],
      terminal: false
    },
    {
      id: 'artifact:canonical-hierarchy-rejection',
      title: 'Pre-mutation hierarchy rejection',
      ownerStepId: 'mutate-canonical-hierarchy',
      channel: 'terminal validation result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canonical-hierarchy-state',
      title: 'Canonical Scene Tree hierarchy state',
      ownerStepId: 'mutate-canonical-hierarchy',
      channel: 'state owner snapshot',
      consumerStepIds: ['validate-save-load-hierarchy'],
      terminal: false
    },
    {
      id: 'artifact:preset-group-geometry-mutation',
      title: 'World-position-preserving Group geometry mutation',
      ownerStepId: 'normalize-preset-group-geometry',
      channel: 'transaction journal',
      consumerStepIds: ['settle-hierarchy-transaction'],
      terminal: false
    },
    {
      id: 'artifact:committed-hierarchy-transaction',
      title: 'Committed local or remote hierarchy transaction',
      ownerStepId: 'settle-hierarchy-transaction',
      channel: 'transaction outcome',
      consumerStepIds: ['project-render-hierarchy'],
      terminal: false
    },
    {
      id: 'artifact:rolled-back-hierarchy-transaction',
      title: 'Fully restored failed hierarchy transaction',
      ownerStepId: 'settle-hierarchy-transaction',
      channel: 'terminal rollback outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:hierarchy-shared-publication',
      title: 'Grouped Factory hierarchy publication',
      ownerStepId: 'settle-hierarchy-transaction',
      channel: 'Factory SharedPublication',
      consumerStepIds: ['transport-hierarchy-publication'],
      terminal: false
    },
    {
      id: 'artifact:remote-hierarchy-publication',
      title: 'Uninterpreted inbound hierarchy publication',
      ownerStepId: 'transport-hierarchy-publication',
      channel: 'Collaboration callback',
      consumerStepIds: ['apply-app-remote-hierarchy-policy'],
      terminal: false
    },
    {
      id: 'artifact:saved-hierarchy-snapshot',
      title: 'Exact persisted hierarchy snapshot',
      ownerStepId: 'validate-save-load-hierarchy',
      channel: 'terminal save output',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:loaded-canonical-hierarchy',
      title: 'Validated and applied load hierarchy',
      ownerStepId: 'validate-save-load-hierarchy',
      channel: 'load-complete projection',
      consumerStepIds: [
        'project-render-hierarchy',
        'project-preset-hierarchy-ui-context'
      ],
      terminal: false
    },
    {
      id: 'artifact:hierarchy-load-rejection',
      title: 'Pre-apply hierarchy load rejection',
      ownerStepId: 'validate-save-load-hierarchy',
      channel: 'terminal load result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:preset-hierarchy-ui-context',
      title: 'App-facing canonical hierarchy UI-context projection',
      ownerStepId: 'project-preset-hierarchy-ui-context',
      channel: 'Preset UI-context property subjects',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:identity-safe-render-hierarchy',
      title: 'Identity-safe engine-neutral hierarchy',
      ownerStepId: 'project-render-hierarchy',
      channel: 'terminal projection result',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'scene-tree-is-sole-hierarchy-owner',
      title: 'Scene Tree is the only canonical hierarchy owner',
      stepIds: ['mutate-canonical-hierarchy', 'validate-save-load-hierarchy'],
      artifactIds: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:canonical-hierarchy-state',
        'artifact:loaded-canonical-hierarchy'
      ],
      specRefs: [
        '#scene-tree',
        '#scene-tree-hierarchy-request',
        '#subtree-and-lifecycle',
        '#definition-of-done'
      ],
      assertion:
        'Parent membership, child order, cycle prevention, subtree membership, runtime validation, and load validation are never recreated by Preset, Factory, Collaboration, App, or Render.'
    },
    {
      id: 'one-request-one-transaction',
      title: 'One hierarchy request has one atomic history boundary',
      stepIds: [
        'mutate-canonical-hierarchy',
        'normalize-preset-group-geometry',
        'settle-hierarchy-transaction'
      ],
      artifactIds: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:preset-group-geometry-mutation',
        'artifact:committed-hierarchy-transaction',
        'artifact:rolled-back-hierarchy-transaction'
      ],
      specRefs: [
        '#subtree-and-lifecycle',
        '#factory-and-collaboration-pipeline'
      ],
      assertion:
        'One request commits one undo unit or restores every rollbackable hierarchy/property write without partial state.'
    },
    {
      id: 'transport-remains-policy-free',
      title: 'Collaboration remains transport-only',
      stepIds: [
        'settle-hierarchy-transaction',
        'transport-hierarchy-publication',
        'apply-app-remote-hierarchy-policy'
      ],
      artifactIds: [
        'artifact:hierarchy-shared-publication',
        'artifact:remote-hierarchy-publication',
        'artifact:accepted-remote-hierarchy-request'
      ],
      specRefs: [
        '#factory-and-collaboration-pipeline',
        '#remote-hierarchy-apply'
      ],
      assertion:
        'Collaboration preserves repeated publications and FIFO delivery but owns no dedupe, LWW, timestamp ordering, conflict resolution, convergence registry, or semantic history.'
    },
    {
      id: 'preset-owns-only-official-group-default',
      title: 'Preset owns official Group adapters, coordinates, and bounds only',
      stepIds: [
        'prepare-preset-group-operation',
        'normalize-preset-group-geometry'
      ],
      artifactIds: [
        'artifact:preset-group-operation-plan',
        'artifact:preset-group-geometry-mutation'
      ],
      specRefs: ['#preset', '#preset-group-operations'],
      assertion:
        'CONTAINERS keeps one official GROUP registration while App owns ids and UI policy and Scene Tree owns hierarchy validation/mutation.'
    },
    {
      id: 'render-projects-existing-identity',
      title: 'Render projects canonical hierarchy without a second state',
      stepIds: ['project-render-hierarchy'],
      artifactIds: [
        'artifact:committed-hierarchy-transaction',
        'artifact:loaded-canonical-hierarchy',
        'artifact:identity-safe-render-hierarchy'
      ],
      specRefs: ['#render-and-app', '#reparent-and-reorder'],
      assertion:
        'Reparent and reorder keep the same element identity and engine ownership; no patch/fallback hierarchy or delete-and-recreate handoff exists.'
    },
    {
      id: 'preset-ui-context-projects-canonical-hierarchy',
      title: 'Preset UI context is a complete derived hierarchy projection',
      stepIds: ['project-preset-hierarchy-ui-context'],
      artifactIds: [
        'artifact:canonical-hierarchy-mutation',
        'artifact:loaded-canonical-hierarchy',
        'artifact:preset-hierarchy-ui-context'
      ],
      specRefs: [
        '#preset',
        '#subtree-and-lifecycle',
        '#definition-of-done'
      ],
      assertion:
        'Every accepted hierarchy lifecycle and load result refreshes flattenedElementIds and elementDataMap from canonical Scene Tree state without a second hierarchy or App/Render repair.'
    }
  ]

  const acceptanceContracts = [
    {
      id: 'group-and-ungroup-contract',
      title: 'Official Group and ungroup behavior',
      stepIds: [
        'route-app-hierarchy-request',
        'prepare-preset-group-operation',
        'mutate-canonical-hierarchy',
        'normalize-preset-group-geometry',
        'settle-hierarchy-transaction'
      ],
      specRefs: ['#group', '#ungroup', '#preset-group-operations'],
      assertions: [
        'Contiguous and non-contiguous siblings group in canonical sibling order at the first selected slot; nested Groups are allowed.',
        'Normal and empty Groups ungroup deterministically, preserve direct-child identities and world positions, and remove the official Group.',
        'A descendant-only geometry mutation changes only its explicit targets and bypasses ancestor Group writes, sibling rebasing, and Group-sized History or publication.',
        'Explicit Group/Ungroup and identity-preserving reparent preserve world positions through one Preset-owned rectangle-union and coordinate-conversion path.',
        'One official GROUP component remains installed and app selection/UI policy remains absent.'
      ]
    },
    {
      id: 'generic-move-validation-contract',
      title: 'Generic reparent, reorder, and rejection behavior',
      stepIds: [
        'route-app-hierarchy-request',
        'mutate-canonical-hierarchy',
        'settle-hierarchy-transaction'
      ],
      specRefs: [
        '#scene-tree-hierarchy-request',
        '#reparent-and-reorder',
        '#product-cases'
      ],
      assertions: [
        'Same-parent reorder and cross-parent reparent preserve identity and canonical relative order under the final-target-index contract.',
        'Missing ids, duplicate ids, mixed parents, invalid targets, invalid indexes, workspace movement, self-parenting, and descendant cycles reject before mutation.'
      ]
    },
    {
      id: 'subtree-replay-contract',
      title: 'Deterministic subtree removal, rollback, and replay',
      stepIds: ['mutate-canonical-hierarchy', 'settle-hierarchy-transaction'],
      specRefs: ['#subtree-and-lifecycle', '#product-cases'],
      assertions: [
        'Removing a non-empty container removes its complete subtree in deterministic descendant-first order.',
        'Rollback, undo, and redo restore exact instances, ids, parent ids, indexes, child order, properties, and Group data with no partial state.'
      ]
    },
    {
      id: 'transport-and-app-policy-contract',
      title: 'Publication grouping and app-owned remote policy',
      stepIds: [
        'settle-hierarchy-transaction',
        'transport-hierarchy-publication',
        'apply-app-remote-hierarchy-policy',
        'mutate-canonical-hierarchy'
      ],
      specRefs: [
        '#factory-and-collaboration-pipeline',
        '#remote-hierarchy-apply',
        '#product-cases'
      ],
      assertions: [
        'One local hierarchy action, undo, redo, or compensation stays one grouped Factory publication and one receiving app callback.',
        'Collaboration preserves duplicate delivery and FIFO order without dedupe, timestamp/LWW, conflict resolution, convergence policy, or semantic history.',
        'App/backend policy accepts or rejects duplicate and concurrent hierarchy requests before one remote transaction and canonical Scene Tree validation/mutation.'
      ]
    },
    {
      id: 'save-load-isolation-contract',
      title: 'Exact save/load and instance isolation',
      stepIds: ['validate-save-load-hierarchy', 'project-render-hierarchy'],
      specRefs: ['#subtree-and-lifecycle', '#definition-of-done'],
      assertions: [
        'Save/load preserves one parent, exact child order, nested Groups, Group data, and props references; malformed hierarchy is rejected or normalized only at the documented load boundary.',
        'Separate Scene Tree/Core instances do not share hierarchy state, load artifacts, observers, or projections, and teardown releases instance-owned state.'
      ]
    },
    {
      id: 'render-identity-contract',
      title: 'Identity-safe canonical Render handoff',
      stepIds: ['project-render-hierarchy'],
      specRefs: ['#render-and-app', '#product-cases'],
      assertions: [
        'Reparent and reorder perform the required abstract append/set-child-index handoff for the same element identity and engine handle without duplicate visuals, stale parents, or fallback hierarchy.'
      ]
    },
    {
      id: 'preset-ui-context-projection-contract',
      title: 'Complete canonical hierarchy projection for App UI context',
      stepIds: ['project-preset-hierarchy-ui-context'],
      specRefs: [
        '#preset',
        '#subtree-and-lifecycle',
        '#product-cases',
        '#definition-of-done'
      ],
      assertions: [
        'Accepted add, remove, move, subtree removal, subtree restoration, and load results refresh flattenedElementIds and elementDataMap from canonical Scene Tree state.',
        'Removed subtrees leave no stale ids, restored subtrees are complete, and moves expose exact canonical parent and child order without App or Render repair state.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'group-component-and-hierarchy',
      kind: 'system',
      title: 'Group Component and Hierarchy Inspector',
      subtitle:
        'ID-based app and Preset requests through canonical Scene Tree hierarchy mutation, one Factory transaction/publication, exact save/load, app-owned remote policy, complete Preset UI-context projection, and identity-safe Render projection.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Group Component and Hierarchy Behaviors Plan',
      inspectorOwner: 'Group Component and Hierarchy Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/group-component-and-hierarchy-behaviors-plan.md',
        kind: 'authority'
      },
      {
        id: 'gate-2-contract',
        label: 'Gate 2 Transport Contract',
        href: './completed/network-collaboration-transport-plan.md',
        kind: 'authority'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../FLOW_INSPECTOR.md',
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
  if (typeof globalThis !== 'undefined') globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) module.exports = data
})()
