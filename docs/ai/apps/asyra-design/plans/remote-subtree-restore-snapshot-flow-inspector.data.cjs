;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/completed/remote-subtree-restore-snapshot-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/remote-subtree-restore-snapshot-flow-inspector.data.cjs'

  const lanes = [
    { id: 'sender', title: 'Delete Evidence and Local Undo', order: 1 },
    { id: 'transport', title: 'Opaque Publication Transport', order: 2 },
    { id: 'app', title: 'App Classification and Policy', order: 3 },
    { id: 'owners', title: 'Canonical Owner Restore', order: 4 },
    { id: 'factory', title: 'Remote Transaction Settlement', order: 5 },
    { id: 'projection', title: 'Ordinary Canonical Projection', order: 6 }
  ]

  const steps = [
    {
      id: 'capture-scene-tree-delete-evidence',
      order: 1,
      laneId: 'sender',
      title: 'Capture Scene Tree delete evidence',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Capture one detached exact subtree snapshot at the original delete mutation before runtime state can change.',
      inputs: [
        'one validated canonical subtree removal request',
        'current canonical parent membership and child order',
        'current raw element and Group data'
      ],
      outputs: ['artifact:scene-tree-delete-evidence'],
      conditions: [
        'Evidence contains stable ids, exact parent ids, the root sibling index, descendant child order, raw element and Group data, and exact post-delete root-parent order evidence derivable from the mutation-time before image.',
        'Evidence covers exactly the affected subtree and its external root-parent stale-before boundary, never the whole document.',
        'The owner snapshot is detached before caller or runtime objects can mutate.'
      ],
      bypasses: [
        'A rejected, missing, workspace-root, or semantic no-op delete produces no evidence or canonical mutation.'
      ],
      allowedContributors: [
        'canonical Scene Tree element instances',
        'registered container metadata',
        'exact parent and children before images',
        'owner-local detached cloning'
      ],
      forbiddenContributors: [
        'Props component reconstruction',
        'Factory hierarchy interpretation',
        'Render or Layers hierarchy',
        'whole-document snapshot',
        'later undo-time state reads'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/scene-tree.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/__tests__'
      ],
      specRefs: [
        '#restore-snapshot',
        '#sender-behavior',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'capture-scene-tree-delete-evidence'
    },
    {
      id: 'capture-props-delete-evidence',
      order: 2,
      laneId: 'sender',
      title: 'Capture Props delete evidence',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Capture detached exact property-component data and owner relation evidence removed by the same subtree delete.',
      inputs: [
        'artifact:scene-tree-delete-evidence',
        'registered property component and relation definitions',
        'property-component mutation-time before images'
      ],
      outputs: ['artifact:props-delete-evidence'],
      conditions: [
        'Every affected property component keeps its stable id, registered type, exact persisted data, and exact owner relation.',
        'Evidence is captured during the original intended transaction and remains detached from later caller or runtime mutation.',
        'No create defaults or generated replacement ids enter the evidence.'
      ],
      bypasses: [
        'A subtree with no property components contributes an explicit empty owner section rather than fabricated defaults.'
      ],
      allowedContributors: [
        'canonical Props Manager component instances',
        'registered property definitions',
        'exact element/property relation input from the Scene Tree owner boundary',
        'owner-local detached cloning'
      ],
      forbiddenContributors: [
        'Scene Tree property-data validation',
        'Factory property interpretation',
        'App reconstruction from computed data',
        'Render or UI state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/props-manager.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/manager/subscribes.ts',
        'packages/props-manager/src/__tests__'
      ],
      specRefs: [
        '#restore-snapshot',
        '#sender-behavior',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'capture-props-delete-evidence'
    },
    {
      id: 'publish-local-restore-snapshot',
      order: 3,
      laneId: 'sender',
      title: 'Restore locally and publish one snapshot',
      ownerPackage: '@asyra/factory',
      purpose:
        'Complete ordinary local owner undo and group its exact inverse deliveries into one existing SharedPublication.',
      inputs: [
        'artifact:scene-tree-delete-evidence',
        'artifact:props-delete-evidence',
        'one committed local delete transaction and its inverse journal'
      ],
      outputs: ['artifact:local-restore-publication'],
      conditions: [
        'Canonical owners restore locally before the undo transaction settles.',
        'One intended transaction and one local undo produce one SharedPublication containing the exact inverse owner deliveries in replay order.',
        'Props ADD_PROPERTY deliveries and one typed Scene Tree CHANGE_SUBTREE delivery with RESTORE_SUBTREE remain ordinary Factory deliveries.',
        'Factory groups and detaches evidence but does not reconstruct evidence at undo time or interpret hierarchy/property meaning.'
      ],
      bypasses: [
        'A failed local undo rolls back locally and publishes no restore snapshot.',
        'An unshared local delete retains ordinary local undo behavior without a network publication.'
      ],
      allowedContributors: [
        'Factory transaction journal and inverse replay',
        'artifact:scene-tree-delete-evidence',
        'artifact:props-delete-evidence',
        'existing Factory SharedPublication boundary'
      ],
      forbiddenContributors: [
        'second publication envelope',
        'restore-specific Provider message',
        'feature-level create steps',
        'Factory hierarchy or property policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/shared-delivery.ts',
        'packages/factory/src/__tests__',
        'packages/core/src/__tests__/hierarchy-transaction.test.ts'
      ],
      specRefs: [
        '#restore-snapshot',
        '#sender-behavior',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'publish-local-restore-snapshot'
    },
    {
      id: 'transport-restore-publication',
      order: 1,
      laneId: 'transport',
      title: 'Transport the restore publication unchanged',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Forward one opaque completed SharedPublication unchanged through the existing FIFO Provider handoff.',
      inputs: ['artifact:local-restore-publication'],
      outputs: ['artifact:inbound-restore-publication'],
      conditions: [
        'The publication, delivery order, metadata, payloads, and repeated values remain unchanged.',
        'One Factory publication remains one Provider send and one receiving app callback.',
        'Collaboration retains no semantic publication history after settlement.'
      ],
      bypasses: [
        'A disconnected peer misses the live publication and receives no framework replay.',
        'Collaboration-disabled apps create no transport resources.'
      ],
      allowedContributors: [
        'artifact:local-restore-publication',
        'Provider wire integrity',
        'transport-safe detached cloning',
        'live FIFO delivery'
      ],
      forbiddenContributors: [
        'restore classifier',
        'tombstone store',
        'semantic history',
        'dedupe or LWW',
        'timestamp ordering',
        'conflict resolution or convergence registry'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/process.test.ts',
        'packages/collaboration/src/__tests__/action-publication.test.ts',
        'docs/ai/framework/plans/__tests__/network-collaboration-transport-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#ownership-contract',
        '#receiver-classification-and-routing',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'transport-restore-publication'
    },
    {
      id: 'expose-instance-safe-owner-facades',
      order: 1,
      laneId: 'app',
      title: 'Expose narrow instance-safe owner facades',
      ownerPackage: '@asyra/core',
      purpose:
        'Bind the app processor to the intended Scene Tree and Props owner instances; Core owns no restore policy and no snapshot semantic decisions.',
      inputs: [
        'Core-bound Scene Tree instance',
        'Core-bound Props Manager instance',
        'owner preflight and materialization contracts'
      ],
      outputs: ['artifact:instance-safe-owner-facades'],
      conditions: [
        'The facade delegates only to the injected owner instances.',
        'Core has no restore policy and no snapshot semantic ownership.',
        'Separate Core, Scene Tree, Props, and Factory compositions cannot cross-read, apply, or project one another’s restore state.',
        'This route does not restrict core.load and does not introduce core.append.'
      ],
      bypasses: [
        'Framework consumers that do not process remote subtree restores need not call the scoped restore facades.'
      ],
      allowedContributors: [
        'Core dependency injection',
        'public owner artifact types',
        'bounded Scene Tree and Props delegates'
      ],
      forbiddenContributors: [
        'Core restore policy',
        'Core snapshot semantic ownership',
        'whole-document load as subtree restore',
        'module-global owner substitution'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/apis/create-apis.ts',
        'packages/core/src/apis/scene-tree.ts',
        'packages/core/src/apis/props.ts',
        'packages/core/src/types',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__'
      ],
      specRefs: [
        '#ownership-contract',
        '#coreload-boundary',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'expose-instance-safe-owner-facades'
    },
    {
      id: 'classify-and-authorize-remote-restore',
      order: 2,
      laneId: 'app',
      title: 'Classify and authorize the complete restore',
      ownerPackage: 'Asyra Design collaboration adapter',
      purpose:
        'Validate the complete publication before the first canonical mutation, classify the typed restore, and apply app/backend permission, domain-order, duplicate, stale, and conflict policy.',
      inputs: [
        'artifact:inbound-restore-publication',
        'artifact:instance-safe-owner-facades',
        'app/backend permission and domain policy'
      ],
      outputs: [
        'artifact:accepted-restore-publication',
        'artifact:remote-restore-rejection'
      ],
      conditions: [
        'A restore publication contains exactly one typed Scene Tree CHANGE_SUBTREE delivery whose action is RESTORE_SUBTREE and only the matching owner deliveries allowed by the snapshot contract.',
        'The App validates the complete publication before the first canonical mutation.',
        'The App owns permission, domain ordering, duplicate, stale, and conflict accept/reject policy.',
        'Mixed or malformed restore input rejects the whole publication.'
      ],
      bypasses: [
        'Ordinary non-restore publications continue through the existing route with its current validation.',
        'A policy rejection produces no Scene Tree, Props, transaction, Render, or Layers mutation.'
      ],
      allowedContributors: [
        'artifact:inbound-restore-publication',
        'typed Scene Tree and Props payload guards',
        'artifact:instance-safe-owner-facades',
        'app/backend decision callback'
      ],
      forbiddenContributors: [
        'Collaboration semantic decisions',
        'partial apply',
        'The App does not repair, reorder, merge, or downgrade rejected restore input.',
        'feature-level create command',
        'Render or UI state authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#receiver-classification-and-routing',
        '#strict-stale-restore-policy',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'classify-and-authorize-remote-restore'
    },
    {
      id: 'preflight-scene-tree-restore',
      order: 1,
      laneId: 'owners',
      title: 'Preflight Scene Tree restore',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Validate the complete hierarchy snapshot and prepare exact tombstone reuse or known-data materialization without canonical mutation.',
      inputs: ['artifact:accepted-restore-publication'],
      outputs: ['artifact:prepared-scene-tree-restore'],
      conditions: [
        'Preflight rejects active id collision, duplicate id, incompatible tombstone, missing or invalid parent, invalid root index, stale post-delete root-parent order evidence, cycle, and inconsistent child order.',
        'Every entry has exact registered element data, parent membership, root index, and one coherent descendant hierarchy.',
        'A compatible tombstone is selected for reuse; otherwise the prepared restore selects exact known-data materialization with the same stable id.'
      ],
      bypasses: [
        'A failed preflight produces no canonical hierarchy mutation and blocks the complete publication.',
        'Tombstone absence is a materialization condition, not a rejection by itself.'
      ],
      allowedContributors: [
        'artifact:accepted-restore-publication',
        'canonical active and deleted Scene Tree maps',
        'registered component/container definitions',
        'detached hierarchy evidence'
      ],
      forbiddenContributors: [
        'Props data validation',
        'App hierarchy reconstruction',
        'Render or Layers hierarchy',
        'create defaults',
        'replacement ids'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/scene-tree.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/entity-data.ts',
        'packages/scene-tree/src/component-registry.ts',
        'packages/scene-tree/src/__tests__'
      ],
      specRefs: [
        '#canonical-restore',
        '#strict-stale-restore-policy',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'preflight-scene-tree-restore'
    },
    {
      id: 'preflight-props-restore',
      order: 2,
      laneId: 'owners',
      title: 'Preflight Props restore',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Validate the complete property-component snapshot and prepare exact tombstone reuse or known-data materialization without canonical mutation.',
      inputs: [
        'artifact:accepted-restore-publication',
        'artifact:prepared-scene-tree-restore'
      ],
      outputs: ['artifact:prepared-props-restore'],
      conditions: [
        'Preflight rejects invalid registration, malformed relation, duplicate id, active id collision, incompatible tombstone, and missing owner data.',
        'Every direct element/property relation and registered child-component relation resolves to exact snapshot or compatible current owner data.',
        'A compatible tombstone is selected for reuse; otherwise the prepared restore selects exact known-data materialization with the same component id and data.'
      ],
      bypasses: [
        'An explicitly property-free subtree produces a valid empty prepared Props restore.',
        'A failed preflight produces no canonical property mutation and blocks the complete publication.'
      ],
      allowedContributors: [
        'artifact:accepted-restore-publication',
        'artifact:prepared-scene-tree-restore',
        'canonical active and deleted Props maps',
        'registered property component and relation definitions'
      ],
      forbiddenContributors: [
        'Scene Tree property-data validation',
        'App component construction',
        'create defaults',
        'replacement ids',
        'Render or UI property state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/props-manager.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/manager/component-accessor.ts',
        'packages/props-manager/src/registries/property-component.ts',
        'packages/props-manager/src/registries/property-definition.ts',
        'packages/props-manager/src/__tests__'
      ],
      specRefs: [
        '#canonical-restore',
        '#strict-stale-restore-policy',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'preflight-props-restore'
    },
    {
      id: 'settle-remote-restore-transaction',
      order: 1,
      laneId: 'factory',
      title: 'Settle one remote restore transaction',
      ownerPackage: '@asyra/factory',
      purpose:
        'Open and settle one rollbackable, non-undoable, no-echo remote transaction around the accepted owner preparations; Factory does not interpret hierarchy or property meaning.',
      inputs: [
        'artifact:accepted-restore-publication',
        'artifact:prepared-scene-tree-restore',
        'artifact:prepared-props-restore',
        'artifact:props-restored-state',
        'artifact:scene-tree-restored-state'
      ],
      outputs: [
        'artifact:remote-restore-transaction-scope',
        'artifact:committed-remote-restore',
        'artifact:rolled-back-remote-restore'
      ],
      conditions: [
        'One accepted publication opens one remote transaction.',
        'The transaction is rollbackable, non-undoable, and no-echo regardless of delivery options.',
        'Exact publication replay order materializes Props before Scene Tree so element relations resolve without defaults.',
        'Any owner apply or settlement failure restores exact pre-publication Scene Tree and Props state.'
      ],
      bypasses: [
        'A rejected publication or failed preflight never opens the remote transaction.',
        'A successful remote restore creates no local undo entry and no outbound SharedPublication.'
      ],
      allowedContributors: [
        'Factory runRemoteTransaction boundary',
        'artifact:prepared-scene-tree-restore',
        'artifact:prepared-props-restore',
        'owner-recorded exact inverse journal entries'
      ],
      forbiddenContributors: [
        'Factory does not interpret hierarchy or property meaning.',
        'Factory stale or conflict policy',
        'partial rollback acceptance',
        'outbound remote echo'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/factory.ts',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/__tests__',
        'packages/core/src/__tests__/hierarchy-transaction.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts'
      ],
      specRefs: [
        '#canonical-restore',
        '#strict-stale-restore-policy',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'settle-remote-restore-transaction'
    },
    {
      id: 'materialize-props-restore',
      order: 3,
      laneId: 'owners',
      title: 'Materialize exact Props state',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Apply the prepared property restore in exact delivery order by reusing compatible tombstones or creating isolated runtime components from known data.',
      inputs: [
        'artifact:prepared-props-restore',
        'artifact:remote-restore-transaction-scope'
      ],
      outputs: ['artifact:props-restored-state'],
      conditions: [
        'Every component preserves its component id, exact data, and owner relation.',
        'Tombstone-present and tombstone-absent paths produce equivalent canonical Props state.',
        'Materialization applies no defaults and allocates no replacement ids.',
        'Materialized components retain the issuing Props Manager accessor for later child relation and value projection.'
      ],
      bypasses: [
        'An empty valid prepared Props restore performs no component mutation and still permits the Scene Tree owner step.',
        'An apply failure throws into Factory settlement and cannot be downgraded.'
      ],
      allowedContributors: [
        'artifact:prepared-props-restore',
        'artifact:remote-restore-transaction-scope',
        'canonical Props Manager add/relation path',
        'owner-recorded inverse evidence'
      ],
      forbiddenContributors: [
        'App-created property instances',
        'Scene Tree data repair',
        'create defaults',
        'replacement ids',
        'partial property apply acceptance'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src/components/base.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/manager/subscribes.ts',
        'packages/props-manager/src/factories/create-property.ts',
        'packages/props-manager/src/registries/declarative-property-type.ts',
        'packages/props-manager/src/__tests__'
      ],
      specRefs: [
        '#canonical-restore',
        '#product-cases',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'materialize-props-restore'
    },
    {
      id: 'materialize-scene-tree-restore',
      order: 4,
      laneId: 'owners',
      title: 'Materialize exact Scene Tree state',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Apply the prepared hierarchy restore by reusing compatible tombstones or creating isolated runtime elements from exact known data.',
      inputs: [
        'artifact:prepared-scene-tree-restore',
        'artifact:props-restored-state',
        'artifact:remote-restore-transaction-scope'
      ],
      outputs: ['artifact:scene-tree-restored-state'],
      conditions: [
        'Every element preserves its stable id, exact parent, root index, descendant child order, raw element data, and raw Group data.',
        'Parents materialize before descendants while the final canonical children arrays exactly match the snapshot.',
        'Tombstone-present and tombstone-absent paths produce equivalent canonical Scene Tree state.',
        'Materialization applies no defaults and allocates no replacement ids.'
      ],
      bypasses: [
        'An apply failure throws into Factory settlement and cannot leave an accepted partial hierarchy.',
        'An empty Group has no descendant materialization but keeps exact raw Group data and root placement.'
      ],
      allowedContributors: [
        'artifact:prepared-scene-tree-restore',
        'artifact:props-restored-state',
        'artifact:remote-restore-transaction-scope',
        'canonical Scene Tree hierarchy mutation path'
      ],
      forbiddenContributors: [
        'App hierarchy construction',
        'Render or Layers repair',
        'feature-level create operations',
        'create defaults',
        'replacement ids'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/entity-data.ts',
        'packages/scene-tree/src/props-manager-context.ts',
        'packages/scene-tree/src/create-dynamic-component.ts',
        'packages/scene-tree/src/create-dynamic-props.ts',
        'packages/scene-tree/src/components/element.ts',
        'packages/scene-tree/src/components/group.ts',
        'packages/scene-tree/src/components/computed.ts',
        'packages/scene-tree/src/components/props.ts',
        'packages/scene-tree/src/__tests__'
      ],
      specRefs: [
        '#canonical-restore',
        '#product-cases',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'materialize-scene-tree-restore'
    },
    {
      id: 'project-preset-group-state',
      order: 1,
      laneId: 'projection',
      title: 'Project ordinary Preset Group state',
      ownerPackage: '@asyra/preset',
      purpose:
        'Consume committed ordinary canonical updates for Group bounds and UI-context derivation with no restore-only state or fallback.',
      inputs: ['artifact:committed-remote-restore'],
      outputs: ['artifact:preset-canonical-projection'],
      conditions: [
        'Existing Scene Tree channel handling derives Group bounds and canonical UI-context values after commit.',
        'Projection consumes the same stable ids and data used by local undo.',
        'Official children-map components retain their issuing Props Manager accessor when projecting restored child values.'
      ],
      bypasses: [
        'A rolled-back or rejected restore produces no final projection.',
        'Headless consumers may omit Preset projection without changing canonical state.'
      ],
      allowedContributors: [
        'artifact:committed-remote-restore',
        'ordinary canonical Scene Tree and Props updates',
        'existing Preset Group and UI-context observers'
      ],
      forbiddenContributors: [
        'restore-only projection state or fallback',
        'Preset hierarchy reconstruction',
        'App stale repair',
        'Render-derived bounds authority'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/components/group.ts',
        'packages/preset/src/props/components/children-map-property-component.ts',
        'packages/preset/src/__tests__/children-map-property-component.test.ts',
        'packages/preset/src/__tests__/selection-subscriptions.test.ts',
        'packages/preset/src/__tests__/group-operations.test.ts'
      ],
      specRefs: [
        '#ownership-contract',
        '#product-cases',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'project-preset-group-state'
    },
    {
      id: 'project-render-identities',
      order: 2,
      laneId: 'projection',
      title: 'Project stable Render identities',
      ownerPackage: '@asyra/render',
      purpose:
        'Project the committed subtree through the ordinary Scene Tree projection with the same stable identities and hierarchy and no restore-only state or fallback.',
      inputs: [
        'artifact:committed-remote-restore',
        'artifact:preset-canonical-projection'
      ],
      outputs: ['artifact:rendered-restored-subtree'],
      conditions: [
        'Parents project before descendants and preserve exact sibling placement.',
        'The ordinary Scene Tree projection owns stable element-to-engine identity.'
      ],
      bypasses: [
        'A rolled-back or rejected restore leaves no restored Render node.',
        'Headless Core remains canonically correct without Render.'
      ],
      allowedContributors: [
        'artifact:committed-remote-restore',
        'artifact:preset-canonical-projection',
        'ordinary Scene Tree projection store',
        'engine-neutral hierarchy handoff'
      ],
      forbiddenContributors: [
        'restore-only Render state or fallback',
        'Render hierarchy reconstruction',
        'duplicate visual identities',
        'app-specific visual exception'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'packages/render/src/__tests__/render.test.ts'
      ],
      specRefs: [
        '#ownership-contract',
        '#product-cases',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'project-render-identities'
    },
    {
      id: 'project-layers-ui',
      order: 3,
      laneId: 'projection',
      title: 'Project the canonical Layers hierarchy',
      ownerPackage: 'Asyra Design Layers/UI',
      purpose:
        'Consume ordinary flattenedElementIds and elementDataMap projection so Layers displays the exact restored hierarchy with no restore-only state or fallback.',
      inputs: [
        'artifact:committed-remote-restore',
        'artifact:preset-canonical-projection'
      ],
      outputs: ['artifact:layers-restored-subtree'],
      conditions: [
        'Layers rows use the same stable ids, parent ids, and child order as canonical Scene Tree state.',
        'Normal and empty Groups use the existing canonical row projection.'
      ],
      bypasses: [
        'A rolled-back or rejected restore creates no Layers row.',
        'Collapsed state remains UI-local and does not alter canonical restore.'
      ],
      allowedContributors: [
        'artifact:preset-canonical-projection',
        'flattenedElementIds',
        'elementDataMap',
        'existing Layers row projection'
      ],
      forbiddenContributors: [
        'restore-only UI state or fallback',
        'DOM hierarchy as canonical input',
        'Render hierarchy repair',
        'saved or shared collapsed state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/contents/layer-hierarchy.ts',
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/providers',
        'apps/asyra-design/e2e/group-interaction.spec.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts'
      ],
      specRefs: [
        '#ownership-contract',
        '#product-cases',
        '#required-inspector-readiness'
      ],
      failureOwnerStepId: 'project-layers-ui'
    }
  ]

  const routes = [
    {
      id: 'scene-evidence-recorded',
      from: 'capture-scene-tree-delete-evidence',
      to: 'publish-local-restore-snapshot',
      kind: 'handoff',
      predicate:
        'The canonical subtree delete captures exact hierarchy evidence.',
      producedArtifacts: ['artifact:scene-tree-delete-evidence']
    },
    {
      id: 'scene-evidence-selects-props',
      from: 'capture-scene-tree-delete-evidence',
      to: 'capture-props-delete-evidence',
      kind: 'handoff',
      predicate:
        'The exact subtree identifies affected property owner relations.',
      producedArtifacts: ['artifact:scene-tree-delete-evidence']
    },
    {
      id: 'props-evidence-recorded',
      from: 'capture-props-delete-evidence',
      to: 'publish-local-restore-snapshot',
      kind: 'handoff',
      predicate: 'The same delete transaction captures exact Props evidence.',
      producedArtifacts: ['artifact:props-delete-evidence']
    },
    {
      id: 'local-undo-publication-ready',
      from: 'publish-local-restore-snapshot',
      to: 'transport-restore-publication',
      kind: 'handoff',
      predicate: 'Local canonical undo and publication settlement succeed.',
      producedArtifacts: ['artifact:local-restore-publication']
    },
    {
      id: 'restore-publication-received',
      from: 'transport-restore-publication',
      to: 'classify-and-authorize-remote-restore',
      kind: 'handoff',
      predicate: 'A currently connected peer receives one opaque publication.',
      producedArtifacts: ['artifact:inbound-restore-publication']
    },
    {
      id: 'core-facades-available-to-app',
      from: 'expose-instance-safe-owner-facades',
      to: 'classify-and-authorize-remote-restore',
      kind: 'resource',
      predicate: 'The app composition binds its intended owner instances.',
      producedArtifacts: ['artifact:instance-safe-owner-facades']
    },
    {
      id: 'remote-restore-rejected',
      from: 'classify-and-authorize-remote-restore',
      kind: 'terminal',
      predicate: 'Validation or app/backend policy rejects the publication.',
      producedArtifacts: ['artifact:remote-restore-rejection']
    },
    {
      id: 'accepted-restore-to-scene-preflight',
      from: 'classify-and-authorize-remote-restore',
      to: 'preflight-scene-tree-restore',
      kind: 'handoff',
      predicate: 'The App accepts one complete restore publication.',
      producedArtifacts: ['artifact:accepted-restore-publication']
    },
    {
      id: 'accepted-restore-to-props-preflight',
      from: 'classify-and-authorize-remote-restore',
      to: 'preflight-props-restore',
      kind: 'handoff',
      predicate: 'The Props owner validates the same accepted publication.',
      producedArtifacts: ['artifact:accepted-restore-publication']
    },
    {
      id: 'accepted-restore-to-settlement',
      from: 'classify-and-authorize-remote-restore',
      to: 'settle-remote-restore-transaction',
      kind: 'handoff',
      predicate:
        'Both owner preflights must succeed before Factory settles the accepted publication.',
      producedArtifacts: ['artifact:accepted-restore-publication']
    },
    {
      id: 'prepared-scene-restore-informs-props-relations',
      from: 'preflight-scene-tree-restore',
      to: 'preflight-props-restore',
      kind: 'handoff',
      predicate:
        'Scene Tree has validated exact element/property relation evidence.',
      producedArtifacts: ['artifact:prepared-scene-tree-restore']
    },
    {
      id: 'prepared-scene-restore-ready-to-settle',
      from: 'preflight-scene-tree-restore',
      to: 'settle-remote-restore-transaction',
      kind: 'handoff',
      predicate: 'Scene Tree preflight succeeds without mutation.',
      producedArtifacts: ['artifact:prepared-scene-tree-restore']
    },
    {
      id: 'prepared-scene-restore-ready-to-materialize',
      from: 'preflight-scene-tree-restore',
      to: 'materialize-scene-tree-restore',
      kind: 'handoff',
      predicate:
        'Scene Tree materialization consumes only its validated one-shot prepared restore.',
      producedArtifacts: ['artifact:prepared-scene-tree-restore']
    },
    {
      id: 'prepared-props-restore-ready-to-settle',
      from: 'preflight-props-restore',
      to: 'settle-remote-restore-transaction',
      kind: 'handoff',
      predicate: 'Props preflight succeeds without mutation.',
      producedArtifacts: ['artifact:prepared-props-restore']
    },
    {
      id: 'prepared-props-restore-ready-to-materialize',
      from: 'preflight-props-restore',
      to: 'materialize-props-restore',
      kind: 'handoff',
      predicate:
        'Props materialization consumes only its validated one-shot prepared restore.',
      producedArtifacts: ['artifact:prepared-props-restore']
    },
    {
      id: 'begin-owner-materialization',
      from: 'settle-remote-restore-transaction',
      to: 'materialize-props-restore',
      kind: 'handoff',
      predicate: 'Factory opens the accepted remote transaction.',
      producedArtifacts: ['artifact:remote-restore-transaction-scope']
    },
    {
      id: 'props-ready-for-scene-materialization',
      from: 'materialize-props-restore',
      to: 'materialize-scene-tree-restore',
      kind: 'handoff',
      predicate: 'Exact property components and relations are active.',
      producedArtifacts: ['artifact:props-restored-state']
    },
    {
      id: 'props-state-ready-to-settle',
      from: 'materialize-props-restore',
      to: 'settle-remote-restore-transaction',
      kind: 'handoff',
      predicate: 'Props owner apply completes inside the remote transaction.',
      producedArtifacts: ['artifact:props-restored-state']
    },
    {
      id: 'transaction-scope-reaches-scene',
      from: 'settle-remote-restore-transaction',
      to: 'materialize-scene-tree-restore',
      kind: 'resource',
      predicate:
        'Scene materialization remains inside the same remote transaction.',
      producedArtifacts: ['artifact:remote-restore-transaction-scope']
    },
    {
      id: 'scene-state-ready-to-settle',
      from: 'materialize-scene-tree-restore',
      to: 'settle-remote-restore-transaction',
      kind: 'handoff',
      predicate:
        'Scene Tree owner apply completes inside the remote transaction.',
      producedArtifacts: ['artifact:scene-tree-restored-state']
    },
    {
      id: 'remote-restore-rolled-back',
      from: 'settle-remote-restore-transaction',
      kind: 'terminal',
      predicate:
        'Any owner or settlement failure restores pre-publication state.',
      producedArtifacts: ['artifact:rolled-back-remote-restore']
    },
    {
      id: 'remote-restore-committed-to-preset',
      from: 'settle-remote-restore-transaction',
      to: 'project-preset-group-state',
      kind: 'projection',
      predicate: 'The complete remote transaction commits.',
      producedArtifacts: ['artifact:committed-remote-restore']
    },
    {
      id: 'remote-restore-committed-to-render',
      from: 'settle-remote-restore-transaction',
      to: 'project-render-identities',
      kind: 'projection',
      predicate: 'Ordinary committed canonical updates reach Render.',
      producedArtifacts: ['artifact:committed-remote-restore']
    },
    {
      id: 'remote-restore-committed-to-layers',
      from: 'settle-remote-restore-transaction',
      to: 'project-layers-ui',
      kind: 'projection',
      predicate: 'Ordinary committed canonical updates reach app projection.',
      producedArtifacts: ['artifact:committed-remote-restore']
    },
    {
      id: 'preset-projection-reaches-render',
      from: 'project-preset-group-state',
      to: 'project-render-identities',
      kind: 'projection',
      predicate: 'Existing Preset observers route canonical Group state.',
      producedArtifacts: ['artifact:preset-canonical-projection']
    },
    {
      id: 'preset-projection-reaches-layers',
      from: 'project-preset-group-state',
      to: 'project-layers-ui',
      kind: 'projection',
      predicate:
        'Existing UI-context observers publish canonical hierarchy data.',
      producedArtifacts: ['artifact:preset-canonical-projection']
    },
    {
      id: 'render-restored-subtree',
      from: 'project-render-identities',
      kind: 'terminal',
      predicate: 'The ordinary Render projection succeeds.',
      producedArtifacts: ['artifact:rendered-restored-subtree']
    },
    {
      id: 'layers-restored-subtree',
      from: 'project-layers-ui',
      kind: 'terminal',
      predicate: 'The ordinary Layers projection succeeds.',
      producedArtifacts: ['artifact:layers-restored-subtree']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:scene-tree-delete-evidence',
      ownerStepId: 'capture-scene-tree-delete-evidence',
      channel: 'Scene Tree transaction evidence',
      consumerStepIds: [
        'capture-props-delete-evidence',
        'publish-local-restore-snapshot'
      ],
      terminal: false
    },
    {
      id: 'artifact:props-delete-evidence',
      ownerStepId: 'capture-props-delete-evidence',
      channel: 'Props transaction evidence',
      consumerStepIds: ['publish-local-restore-snapshot'],
      terminal: false
    },
    {
      id: 'artifact:local-restore-publication',
      ownerStepId: 'publish-local-restore-snapshot',
      channel: 'Factory SharedPublication',
      consumerStepIds: ['transport-restore-publication'],
      terminal: false
    },
    {
      id: 'artifact:inbound-restore-publication',
      ownerStepId: 'transport-restore-publication',
      channel: 'Collaboration callback',
      consumerStepIds: ['classify-and-authorize-remote-restore'],
      terminal: false
    },
    {
      id: 'artifact:instance-safe-owner-facades',
      ownerStepId: 'expose-instance-safe-owner-facades',
      channel: 'Core public facade',
      consumerStepIds: ['classify-and-authorize-remote-restore'],
      terminal: false
    },
    {
      id: 'artifact:accepted-restore-publication',
      ownerStepId: 'classify-and-authorize-remote-restore',
      channel: 'app policy result',
      consumerStepIds: [
        'preflight-scene-tree-restore',
        'preflight-props-restore',
        'settle-remote-restore-transaction'
      ],
      terminal: false
    },
    {
      id: 'artifact:remote-restore-rejection',
      ownerStepId: 'classify-and-authorize-remote-restore',
      channel: 'terminal app policy result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:prepared-scene-tree-restore',
      ownerStepId: 'preflight-scene-tree-restore',
      channel: 'owner-issued one-shot preflight artifact',
      consumerStepIds: [
        'preflight-props-restore',
        'settle-remote-restore-transaction',
        'materialize-scene-tree-restore'
      ],
      terminal: false
    },
    {
      id: 'artifact:prepared-props-restore',
      ownerStepId: 'preflight-props-restore',
      channel: 'owner-issued one-shot preflight artifact',
      consumerStepIds: [
        'settle-remote-restore-transaction',
        'materialize-props-restore'
      ],
      terminal: false
    },
    {
      id: 'artifact:remote-restore-transaction-scope',
      ownerStepId: 'settle-remote-restore-transaction',
      channel: 'Factory remote transaction',
      consumerStepIds: [
        'materialize-props-restore',
        'materialize-scene-tree-restore'
      ],
      terminal: false
    },
    {
      id: 'artifact:props-restored-state',
      ownerStepId: 'materialize-props-restore',
      channel: 'canonical Props state',
      consumerStepIds: [
        'materialize-scene-tree-restore',
        'settle-remote-restore-transaction'
      ],
      terminal: false
    },
    {
      id: 'artifact:scene-tree-restored-state',
      ownerStepId: 'materialize-scene-tree-restore',
      channel: 'canonical Scene Tree state',
      consumerStepIds: ['settle-remote-restore-transaction'],
      terminal: false
    },
    {
      id: 'artifact:committed-remote-restore',
      ownerStepId: 'settle-remote-restore-transaction',
      channel: 'committed transaction outcome',
      consumerStepIds: [
        'project-preset-group-state',
        'project-render-identities',
        'project-layers-ui'
      ],
      terminal: false
    },
    {
      id: 'artifact:rolled-back-remote-restore',
      ownerStepId: 'settle-remote-restore-transaction',
      channel: 'terminal rollback outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:preset-canonical-projection',
      ownerStepId: 'project-preset-group-state',
      channel: 'ordinary Preset projection',
      consumerStepIds: ['project-render-identities', 'project-layers-ui'],
      terminal: false
    },
    {
      id: 'artifact:rendered-restored-subtree',
      ownerStepId: 'project-render-identities',
      channel: 'terminal Render projection',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:layers-restored-subtree',
      ownerStepId: 'project-layers-ui',
      channel: 'terminal Layers projection',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'owner-partitioned-snapshot',
      title: 'Delete evidence stays detached and owner-partitioned',
      stepIds: [
        'capture-scene-tree-delete-evidence',
        'capture-props-delete-evidence',
        'publish-local-restore-snapshot'
      ],
      artifactIds: [
        'artifact:scene-tree-delete-evidence',
        'artifact:props-delete-evidence',
        'artifact:local-restore-publication'
      ],
      specRefs: ['#restore-snapshot', '#sender-behavior'],
      assertion:
        'Snapshot evidence is captured at delete time, detached, scoped to one subtree, and carried only by ordinary grouped owner deliveries.'
    },
    {
      id: 'transport-remains-opaque',
      title: 'Collaboration remains transport-only',
      stepIds: [
        'publish-local-restore-snapshot',
        'transport-restore-publication',
        'classify-and-authorize-remote-restore'
      ],
      artifactIds: [
        'artifact:local-restore-publication',
        'artifact:inbound-restore-publication',
        'artifact:accepted-restore-publication'
      ],
      specRefs: ['#ownership-contract', '#receiver-classification-and-routing'],
      assertion:
        'Collaboration forwards the complete publication unchanged while all restore classification, stale, permission, and conflict policy remains app-owned.'
    },
    {
      id: 'canonical-owner-materialization',
      title: 'Canonical owners restore exact known data',
      stepIds: [
        'preflight-scene-tree-restore',
        'preflight-props-restore',
        'materialize-props-restore',
        'materialize-scene-tree-restore'
      ],
      artifactIds: [
        'artifact:prepared-scene-tree-restore',
        'artifact:prepared-props-restore',
        'artifact:props-restored-state',
        'artifact:scene-tree-restored-state'
      ],
      specRefs: ['#canonical-restore', '#strict-stale-restore-policy'],
      assertion:
        'Scene Tree and Props each validate and materialize only their exact owner data, reusing compatible tombstones or creating isolated instances with stable ids.'
    },
    {
      id: 'one-atomic-remote-transaction',
      title: 'One accepted restore settles atomically',
      stepIds: [
        'classify-and-authorize-remote-restore',
        'settle-remote-restore-transaction',
        'materialize-props-restore',
        'materialize-scene-tree-restore'
      ],
      artifactIds: [
        'artifact:accepted-restore-publication',
        'artifact:remote-restore-transaction-scope',
        'artifact:committed-remote-restore',
        'artifact:rolled-back-remote-restore'
      ],
      specRefs: ['#canonical-restore', '#strict-stale-restore-policy'],
      assertion:
        'The complete preflight passes before mutation and one rollbackable, non-undoable, no-echo Factory transaction commits all owner state or restores all of it.'
    },
    {
      id: 'ordinary-projection-only',
      title: 'Projection uses only ordinary canonical updates',
      stepIds: [
        'project-preset-group-state',
        'project-render-identities',
        'project-layers-ui'
      ],
      artifactIds: [
        'artifact:committed-remote-restore',
        'artifact:preset-canonical-projection',
        'artifact:rendered-restored-subtree',
        'artifact:layers-restored-subtree'
      ],
      specRefs: ['#ownership-contract', '#product-cases'],
      assertion:
        'Preset, Render, and Layers consume normal canonical state and never create restore-only fallback hierarchy, properties, geometry, or identity.'
    }
  ]

  const acceptanceContracts = [
    {
      id: 'sender-snapshot-contract',
      title: 'Detached exact sender evidence and grouping',
      stepIds: [
        'capture-scene-tree-delete-evidence',
        'capture-props-delete-evidence',
        'publish-local-restore-snapshot'
      ],
      specRefs: ['#restore-snapshot', '#sender-behavior', '#product-cases'],
      assertions: [
        'The original delete captures exact Scene Tree and Props evidence for exactly one subtree, detached from later caller and runtime mutation.',
        'One local undo produces one grouped publication containing exact Props ADD deliveries followed by the typed Scene Tree RESTORE_SUBTREE delivery.'
      ]
    },
    {
      id: 'transport-app-core-contract',
      title: 'Opaque transport, instance-safe facades, and strict app policy',
      stepIds: [
        'transport-restore-publication',
        'expose-instance-safe-owner-facades',
        'classify-and-authorize-remote-restore'
      ],
      specRefs: [
        '#ownership-contract',
        '#receiver-classification-and-routing',
        '#strict-stale-restore-policy',
        '#coreload-boundary'
      ],
      assertions: [
        'Collaboration remains transport-only; Core exposes only instance-safe owner facades; the App validates the complete publication and owns permission, domain ordering, duplicate, stale, and conflict policy.',
        'Two independent Core, Scene Tree, Props, and Factory compositions remain instance-isolated.'
      ]
    },
    {
      id: 'owner-materialization-contract',
      title: 'Equivalent tombstone reuse and known-data materialization',
      stepIds: [
        'preflight-scene-tree-restore',
        'preflight-props-restore',
        'materialize-props-restore',
        'materialize-scene-tree-restore'
      ],
      specRefs: [
        '#canonical-restore',
        '#strict-stale-restore-policy',
        '#product-cases'
      ],
      assertions: [
        'Tombstone-present and tombstone-absent restore are equivalent in ids, data, hierarchy, properties, save output, and projections.',
        'Normal and empty Group restore preserves stable ids, exact parent, root sibling index, descendant child order, raw Group data, property components, and relations without defaults or replacement ids.'
      ]
    },
    {
      id: 'atomicity-redo-contract',
      title: 'Atomic remote settlement, non-undo, no-echo, and redo',
      stepIds: [
        'settle-remote-restore-transaction',
        'materialize-props-restore',
        'materialize-scene-tree-restore'
      ],
      specRefs: [
        '#canonical-restore',
        '#strict-stale-restore-policy',
        '#product-cases'
      ],
      assertions: [
        'One local undo remains one grouped publication and one accepted remote restore remains one remote transaction that is non-undoable and emits no outbound echo; subsequent remote redo deletes the same exact subtree.',
        'Id collision, incompatible tombstone, stale parent, stale order, duplicate ids, missing owner data, invalid registration, malformed relation, cycle, inconsistent child order, and permission rejection leave no partial Scene Tree or Props state.'
      ]
    },
    {
      id: 'projection-save-contract',
      title: 'Exact save and ordinary canonical projection',
      stepIds: [
        'project-preset-group-state',
        'project-render-identities',
        'project-layers-ui'
      ],
      specRefs: ['#product-cases', '#definition-of-done'],
      assertions: [
        'Save after restore contains the exact canonical subtree; Render and Layers receive the same stable identities through ordinary canonical handoff.',
        'Preset Group bounds, Render identity, and Layers hierarchy add no restore-only state or fallback.'
      ]
    },
    {
      id: 'bounded-exclusions-contract',
      title: 'Bounded plan exclusions remain unchanged',
      stepIds: [
        'transport-restore-publication',
        'expose-instance-safe-owner-facades',
        'classify-and-authorize-remote-restore'
      ],
      specRefs: [
        '#unsupported-and-deferred',
        '#coreload-boundary',
        '#definition-of-done'
      ],
      assertions: [
        'Collaboration remains transport-only, core.load remains unrestricted, Group Context Menu does not start, and implementation closeout does not occur in this plan.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'remote-subtree-restore-snapshot',
      kind: 'system',
      title: 'Remote Subtree Restore Snapshot Inspector',
      subtitle:
        'Detached delete evidence through one Factory publication, opaque Collaboration transport, strict App policy, tombstone-optional canonical owner materialization, atomic remote settlement, and ordinary Preset/Render/Layers projection.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Remote Subtree Restore Snapshot Plan',
      inspectorOwner: 'Remote Subtree Restore Snapshot Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/remote-subtree-restore-snapshot-plan.md',
        kind: 'authority'
      },
      {
        id: 'gate-2-contract',
        label: 'Gate 2 Transport Contract',
        href: '../../../framework/plans/completed/network-collaboration-transport-plan.md',
        kind: 'authority'
      },
      {
        id: 'gate-3-inspector',
        label: 'Gate 3 Hierarchy Inspector',
        href: '../../../framework/plans/group-component-and-hierarchy-flow-inspector.html',
        kind: 'authority'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../../../framework/FLOW_INSPECTOR.md',
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
