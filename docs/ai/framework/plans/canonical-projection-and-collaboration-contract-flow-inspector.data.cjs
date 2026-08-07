;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs'

  const lanes = [
    {
      id: 'intent-orchestration',
      title: 'Intent and Canonical Orchestration',
      order: 1
    },
    {
      id: 'canonical-owners',
      title: 'Canonical State Owners',
      order: 2
    },
    {
      id: 'transaction-projection',
      title: 'Transaction and Projection',
      order: 3
    },
    {
      id: 'collaboration-transport',
      title: 'Collaboration and Transport',
      order: 4
    },
    { id: 'durability', title: 'Local Durability', order: 5 }
  ]

  const steps = [
    {
      id: 'prepare-one-composition-request',
      order: 1,
      laneId: 'intent-orchestration',
      title: 'Prepare one composition request',
      ownerPackage: 'Asyra Design AI actions and common APIs',
      purpose:
        'Translate one accepted AI composition into one Group and one all-children plural Core request inside one outer Factory transaction.',
      inputs: [
        'validated AI composition descriptor',
        'Feature-owned AbortSignal',
        'one outer Factory transaction'
      ],
      outputs: [
        'artifact:local-composition-request',
        'artifact:progressive-stage-request'
      ],
      conditions: [
        'The App creates one Group and calls Core.createElementsInParent once with all accepted children.',
        'Canonical descriptor property overrides enter the prepared Props creation batch and never depend on a mixed computed/property write.',
        'The single-element convenience delegates to the same plural batch-of-one implementation.',
        'Group and children remain one intended action and one outer Factory transaction.',
        'The App obtains one active shared-delivery handle directly from Factory transaction execution; Core does not receive, store, or return that handle.',
        'The App batch-result and delivery-handle migration completes before Core deletes Core.createElementsInParentBatch; this is implementation dependency ordering, not a compatibility contract.',
        'Progressive visibility is downstream artifact delivery and never repeats the Core mutation.'
      ],
      bypasses: [
        'Clarification and no-change turns create no Group or canonical request.',
        'Abort before mutation emits no canonical request.',
        'A fatal canonical failure rolls back the complete outer action.'
      ],
      allowedContributors: [
        'registered Asyra Design AI actions',
        'Asyra Design common element APIs',
        '@asyra/core public plural element API',
        '@asyra/factory active shared-delivery handle'
      ],
      forbiddenContributors: [
        'fixed 256-item Core request loops',
        'Core.createElementsInParentBatch',
        'Factory delivery handles or timing results',
        'Core-carried shared-delivery handles',
        'provider-selected canonical IDs',
        'reduced drawing detail or AI-only canonical state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/common-apis/__tests__'
      ],
      specRefs: [
        '#target-architecture',
        '#core-creation-contract',
        '#step-local-formal-gates'
      ],
      failureOwnerStepId: 'prepare-one-composition-request'
    },
    {
      id: 'coordinate-canonical-owner-preparations',
      order: 2,
      laneId: 'intent-orchestration',
      title: 'Coordinate canonical owner preparations',
      ownerPackage: '@asyra/core',
      purpose:
        'Coordinate plural creation, plural canonical element-property updates, or remote canonical apply by obtaining every prepared owner mutation required by that request before authorizing the affected state owners to apply.',
      inputs: [
        'artifact:local-composition-request',
        'artifact:remote-canonical-request',
        'typed local canonical element-property batch',
        'artifact:prepared-property-mutation-batch',
        'artifact:prepared-element-mutation',
        'artifact:resolved-element-property-targets'
      ],
      outputs: [
        'artifact:property-preflight-request',
        'artifact:scene-preflight-request',
        'artifact:element-property-target-request',
        'artifact:canonical-apply-authorization'
      ],
      conditions: [
        'A local descriptor batch or one remote canonical request starts the matching lifecycle preflights.',
        'Core.updateElementProperties replaces complete canonical property field values for one or many elements and does not accept record set/remove operations.',
        'Core.patchElementProperties applies one typed record delta with ordered set and remove operations for one or many elements.',
        'A local element-property batch obtains one complete read-only set of resolved element property targets before Core requests Props preflight.',
        'A property-only request requires the complete resolved targets and prepared property mutation but no prepared Scene mutation.',
        'A cross-owner lifecycle request receives both the complete prepared property mutation and complete prepared Scene mutation before canonical apply authorization.',
        'A direct Scene removal retains Props, while the Core full lifecycle passes the Scene-issued orphan roots and complete retained root property IDs unchanged to the Props prepared exact orphan graph mutation without inspecting the property graph.',
        'Core.createElementsInParent returns only ordered canonical element IDs.',
        'For detached canonical creation, Core receives PreparedCanonicalElementInsertion.ownerRelations from Scene and passes them unchanged into the Props create-exact-property-graph operation.',
        'Remote exact element removal uses one origin-neutral canonical-data removal path; Collaboration consumes its Scene and Props batches once without a UsingActiveProperties API or local/remote mode.',
        'Core load completes every owner validate, then Scene.preflightLoadPropertyRelations against detached Props data before any owner apply; version and file-load-complete change only after every apply succeeds.',
        'All App legacy batch-result callers migrate before Core deletes the legacy creation surfaces.',
        'Canonical element-property APIs return only ordered affected element IDs.',
        'Core.applyCanonicalChanges accepts one ordered remote canonical request and invokes its typed owner facades inside one caller-owned Factory transaction.',
        'Core invokes every prepared owner mutation required by the request in canonical evidence order inside the caller-owned outer Factory transaction.',
        'Factory rollback provides cross-owner atomicity after an unexpected apply failure.',
        'All canonical callers migrate to the typed element-property APIs before the local computed semantic handoff; the transient vector preview remains an explicit local-only handoff dependency rather than being misclassified as a canonical caller.'
      ],
      bypasses: [
        'An empty local descriptor batch is inert.',
        'An empty canonical element-property batch is inert.',
        'Rejected element-to-property target resolution emits no Props request.',
        'Any rejected property or Scene preflight emits no canonical apply authorization.',
        'A failed owner apply returns to Factory rollback and does not fabricate a successful Core result.'
      ],
      allowedContributors: [
        'artifact:local-composition-request',
        'artifact:remote-canonical-request',
        'artifact:prepared-property-mutation-batch',
        'artifact:prepared-element-mutation',
        'artifact:resolved-element-property-targets',
        '@asyra/core public facade'
      ],
      forbiddenContributors: [
        'Core-owned property, relationship, Scene map, or hierarchy mutation',
        'Core.createElementsInParentBatch',
        'CanonicalElementBatchResult',
        'Factory delivery handles, progressive handles, or timing results',
        'package-private App access',
        'canonical caller use of Core.changeComputedData or Core.changeComputedDataPatch',
        'caller-managed per-field Props commit loops'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/preset/src/index.ts',
        'packages/preset/src/components/index.ts',
        'packages/preset/src/components/group.ts',
        'packages/preset/src/__tests__/group-operations.test.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts',
        'apps/asyra-design/src/common-apis/element/apis.ts',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts',
        'apps/asyra-design/src/common-apis/element/update-element-properties.ts',
        'apps/asyra-design/src/common-apis/element/__tests__',
        'apps/asyra-design/src/common-apis/fills.ts',
        'apps/asyra-design/src/common-apis/__tests__/fills.test.ts',
        'apps/asyra-design/src/common-apis/strokes.ts',
        'apps/asyra-design/src/common-apis/__tests__/strokes.test.ts',
        'apps/asyra-design/src/controllers/scene-tree.ts',
        'apps/asyra-design/src/properties/position.tsx',
        'apps/asyra-design/src/properties/dimension.tsx',
        'apps/asyra-design/src/properties/rotation.tsx',
        'apps/asyra-design/src/properties/fills/index.tsx',
        'apps/asyra-design/src/properties/strokes/index.tsx',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/e2e/properties.spec.ts',
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'apps/asyra-design/e2e/render-delta-performance.spec.ts',
        'apps/asyra-design/e2e/test-utils.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/subscribes.ts',
        'packages/scene-tree/src/index.ts',
        'packages/scene-tree/src/__tests__'
      ],
      specRefs: [
        '#target-architecture',
        '#core-creation-contract',
        '#canonical-element-property-update-contract',
        '#shared-element-property-relation-contract',
        '#props-manager-batch-contract',
        '#scene-tree-lifecycle-and-apply-contract'
      ],
      failureOwnerStepId: 'coordinate-canonical-owner-preparations'
    },
    {
      id: 'prepare-and-apply-property-batch',
      order: 1,
      laneId: 'canonical-owners',
      title: 'Prepare and apply one property batch',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Preflight and apply active property value replacements, record patches, property instances, relationship rebinds, registrations, and ordered property evidence as one owner batch.',
      inputs: [
        'artifact:property-preflight-request',
        'artifact:canonical-apply-authorization'
      ],
      outputs: [
        'artifact:prepared-property-mutation-batch',
        'artifact:canonical-property-batch-evidence'
      ],
      conditions: [
        'The complete batch validates schemas, IDs, values, Props-owned component registry, type, lifecycle validity, instances, and relationships before mutation.',
        'Props independently owns property and component identity, lifecycle, and the property-child graph; it does not infer element hierarchy or element-slot ownership.',
        'Props resolvePropertyAncestorIds is a read-only ordered self-and-ancestor closure over its property-child graph; it mutates no registry or evidence and knows no Scene hierarchy.',
        'One whole-batch preflight validates every property value replacement and record patch before one whole-batch apply.',
        'Props normalizes a relation-backed creation descriptor with a missing placeholder ID before detached materialization and generates its canonical ID, while every explicit non-empty child ID remains unchanged and an empty canonical ID remains invalid.',
        'A relation-backed property definition used by record set or remove explicitly declares array-or-record; this capability leaves generic array relation behavior unchanged.',
        'Props preparePropertyMutationBatch and applyPreparedPropertyMutationBatch are public owner capabilities with separate read-only preparation and owner-issued apply missions, so Core uses no package-private API.',
        'Apply materializes property instances, performs relationship rebind and registration where required, applies active values and record patches, and records ordered property evidence once.',
        'The public Props updateProperties property-only convenience composes those same capabilities and owns one ordered batch and one evidence emission without creating a second implementation.',
        'Props freezes the complete ordered event array and passes it through the required TransactionOwner updateTransactionBatch boundary exactly once with no scalar updateTransaction loop.',
        'A record set for a missing record materializes the typed child property instance only after complete preflight; record remove unlinks the exact relationship, removes an unowned child from the property registry, and records complete inverse evidence for Undo, Redo, and rollback.',
        'An existing shared child survives record remove when another canonical owner remains, while the removed owner relation and order remain restorable from inverse evidence.',
        'An inactive Props-owned tombstone is reactivated only when its exact ID, type, canonical data, and property instance identity match; this rule is origin-neutral.',
        'UPDATE_PROPERTY is property-source evidence and does not use one initiating element as the fanout authority for a shared component.',
        'ElementPropertyRelation identity is the ownerElementId and ownerPropertyName tuple, while one compatible componentId may serve many relation tuples.',
        'Prepared exact orphan property graph removal accepts only deduplicated orphan root IDs and complete retained root property IDs from a Core-coordinated Scene release, traverses the Props property-graph from orphan roots, stops at each retained Scene root, and removes a root or descendant only when no remaining canonical relation retains it.',
        'A later invalid property item leaves no property, instance, relationship, registry, or evidence prefix.',
        'A public single-item convenience delegates to updateProperties with the same batch-of-one owner path.'
      ],
      bypasses: [
        'An empty property request produces an empty valid prepared mutation and no property evidence.',
        'A rejected preflight returns no apply-ready prepared mutation.',
        'Within a Core-coordinated request, no property apply occurs before every required owner preparation succeeds.',
        'A direct property-ID-only updateProperties call composes and applies its own prepared Props mutation without a Scene mutation; canonical apply authorization is Core orchestration evidence, not an origin token or API parameter.'
      ],
      allowedContributors: [
        'artifact:property-preflight-request',
        'artifact:canonical-apply-authorization',
        'Props schemas and property component constructors',
        'Props relationship and registration owners',
        'Props property-graph child lifecycle owner',
        'required TransactionOwner updateTransactionBatch SPI'
      ],
      forbiddenContributors: [
        'Scene map mutation',
        'parent children or hierarchy-order mutation',
        'partial apply before complete preflight',
        'a second single-item canonical implementation',
        'origin-specific property behavior',
        'an exclusive element-owner assumption for one property component',
        'a duplicate canonical Scene element-to-root relation index',
        'generic owner kinds, reference-count APIs, shared-element DAG, permissions, leases, pinning, garbage collection, server persistence, server-owned lifecycle policy, or a universal relationship service',
        'caller-managed updatePropertyById plus commitPropertyChanges loops',
        'silent partial success after an invalid batch item'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src',
        'packages/props-manager/src/__tests__',
        'packages/utils/src/types/props-manager.ts',
        'packages/preset/src/props/components/fills-component.ts',
        'packages/preset/src/props/components/strokes-component.ts',
        'packages/preset/src/__tests__/children-map-property-component.test.ts'
      ],
      specRefs: [
        '#props-manager-batch-contract',
        '#canonical-element-property-update-contract',
        '#shared-element-property-relation-contract',
        '#step-local-formal-gates',
        '#pre-release-removal-policy'
      ],
      failureOwnerStepId: 'prepare-and-apply-property-batch'
    },
    {
      id: 'prepare-and-apply-scene-mutation',
      order: 2,
      laneId: 'canonical-owners',
      title: 'Prepare and apply one Scene mutation',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Resolve property targets, prepare lifecycle or raw element-data mutation evidence, and apply Scene mutations through one Scene-only map, raw-state, and hierarchy owner.',
      inputs: [
        'artifact:scene-preflight-request',
        'artifact:element-property-target-request',
        'artifact:canonical-apply-authorization',
        'owner-issued Scene load validation result',
        'detached Props validated data'
      ],
      outputs: [
        'artifact:prepared-element-mutation',
        'artifact:resolved-element-property-targets',
        'artifact:canonical-scene-batch-evidence'
      ],
      conditions: [
        'Read-only element-to-property target resolution validates the complete element batch, aliases, property IDs, and owner relations; it does not mutate Scene or Props.',
        'Scene independently owns element identity, element hierarchy, and element-slot-to-root relations; Props independently owns property and component identity, lifecycle, and the property-child graph.',
        'ElementPropertyRelation is many-to-one with identity defined by the ownerElementId and ownerPropertyName tuple; a compatible componentId may repeat across relation tuples.',
        'Scene owns one derived reverse relation index from componentId to ordered ElementPropertyRelation values and keeps it equivalent through load, insert, remove, restore, rollback, Undo, and Redo.',
        'The complete resolved targets group by propertyId: equivalent shared writes produce one mutation, while conflicting field or record writes atomically reject before Props preflight.',
        'PreparedCanonicalElementInsertion exposes the frozen owner relations already validated by Scene; Core passes them unchanged into the Props create-exact-property-graph operation instead of rebuilding Scene slot semantics.',
        'A prepared removal records released relations, retained relations, deduplicated orphan root property IDs, complete retained root property IDs from all prepared remaining element relations, and the exact relation-set read required to reject a stale relation set before mutation.',
        'Scene.prepareSubtreeRemoval accepts one root, derives the complete child-first post-order closure, emits one CHANGE_SUBTREE record, and delegates mutation to the same applyPreparedElementMutation owner.',
        'Scene.preflightLoadPropertyRelations uses an owner-issued load validation result to compare exact element property slots, component IDs, property types, and registration stability against detached Props validated data with no mutation or artifact consumption.',
        'Ordinary and canonical lifecycles use explicit typed prepared Scene mutations without caller-origin policy.',
        'UPDATE_ELEMENT_DATA is canonical raw Scene evidence for prepared typed name, visibility, and lock mutations.',
        'The complete prepared mutation validates Scene IDs, parent, index, order, map, hierarchy, and tombstone evidence before mutation.',
        'Apply owns Scene maps, raw element state, parent children, hierarchy order, and ordered Scene evidence only.',
        'Each apply emits one plural Scene event and one shared record per element in order for ADD_ELEMENTS and REMOVE_ELEMENTS; Factory publication slices may group those records but must not split one record or create another Scene mutation or history action.',
        'A later invalid Scene item leaves no map, parent-list, hierarchy-order, tombstone, or Scene evidence prefix.',
        'A public single-item convenience delegates to the same one-item prepared Scene mutation.'
      ],
      bypasses: [
        'A rejected element-to-property request returns no partial resolved target set and performs no mutation.',
        'An empty Scene request produces an empty valid prepared mutation and no Scene evidence.',
        'A rejected lifecycle preflight returns no apply-ready prepared mutation.',
        'No Scene apply occurs before canonical authorization.'
      ],
      allowedContributors: [
        'artifact:scene-preflight-request',
        'artifact:element-property-target-request',
        'artifact:canonical-apply-authorization',
        'Scene element map and parent membership owners',
        'Scene raw element-data mutation owner',
        'Scene element property relation resolver',
        'Scene detached load property-slot contract',
        'typed prepared lifecycle evidence'
      ],
      forbiddenContributors: [
        'property instance materialization',
        'relationship rebind or property registration',
        'Props mutation during element-to-property resolution',
        'Core-authored element property-slot or property-type load validation',
        'a second canonical element-to-root relation index in Props',
        'element relation cleanup through unconditional property deletion',
        'generic owner kinds, reference-count APIs, shared-element DAG, permissions, leases, pinning, garbage collection, server persistence, server-owned lifecycle policy, or a universal relationship service',
        'UsingActiveProperties APIs',
        'isLocal or isRemote mutation modes',
        'partial apply before complete preflight'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src',
        'packages/scene-tree/src/__tests__',
        'packages/utils/src/constants/scene-tree.ts',
        'packages/utils/src/types/scene-tree.ts',
        'packages/utils/src/types/props-manager.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/__tests__/props-manager.test.ts',
        'packages/core/src/apis/props.ts',
        'packages/core/src/types/props.ts',
        'packages/core/src/__tests__/restore-owner-facades.test.ts',
        'apps/asyra-design/src/collaboration/operations.ts',
        'packages/reactive-events/src/types.ts',
        'packages/reactive-events/src/scene-tree',
        'packages/reactive-events/src/__tests__',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/__tests__/data-transact.test.ts',
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/selection-subscriptions.test.ts'
      ],
      specRefs: [
        '#scene-tree-lifecycle-and-apply-contract',
        '#canonical-element-property-update-contract',
        '#canonical-and-local-projection-contracts',
        '#shared-element-property-relation-contract',
        '#step-local-formal-gates',
        '#pre-release-removal-policy'
      ],
      failureOwnerStepId: 'prepare-and-apply-scene-mutation'
    },
    {
      id: 'derive-local-computed-projection',
      order: 3,
      laneId: 'canonical-owners',
      title: 'Derive local computed projection',
      ownerPackage: '@asyra/scene-tree computed projection',
      purpose:
        'Derive local computed values from canonical property changes, Undo, Redo, load, or direct local animation updates and notify Render without creating shared evidence.',
      inputs: [
        'artifact:canonical-property-batch-evidence',
        'direct local computed update'
      ],
      outputs: ['artifact:local-computed-projection'],
      conditions: [
        'Local and remote UPDATE_PROPERTY evidence derives computed state locally before Render projection.',
        'Props expands each changed property ID through its ordered property ancestor closure; Scene maps only that closure through its own reverse relation index to all affected elements and emits one ordered local computed batch.',
        'Undo, Redo, and canonical load recompute through the same property-to-computed route.',
        'UPDATE_COMPUTED_DATA and UPDATE_COMPUTED_DATA_PATCH remain ordinary local reactive events.',
        'The explicit local computed batch API accepts no EVENT_OPTIONS, mutates no property component, and publishes no canonical evidence.',
        'The same semantic handoff migrates the transient vector preview to the mission-specific local computed API, registers the one Preset ordinary consumer, and deletes Core.changeComputedData, Core.changeComputedDataPatch, and the CHANGE_COMPUTED_DATA command events without a dual active route.',
        'A forced rollback cancel clears the transient vector caches and reprojects current canonical Props through the same local computed route before cleanup returns; commit-current interruption continues through the ordinary onEnd finalization path.',
        'Ordinary and AI element creation already route descriptor property overrides through prepared canonical Props mutations before this switch.',
        'A future animation tick may update computed state locally without touching a property component.',
        'The local producer switch and ordinary Preset consumer registration form one semantic handoff with no dual computed delivery.',
        'Asyra Design computed derived-state consumers normalize scalar, ordered batch, and patch events and perform each required continuation or icon synchronization exactly once per event.',
        'Preset declares its existing @asyra/reactive-events workspace package as a runtime dependency because the production consumer imports its subscriber directly.',
        'Computed projection creates no history, SharedDataChannel batch, Collaboration publication, or persistence snapshot.'
      ],
      bypasses: [
        'A semantic computed no-op emits no canonical failure.',
        'A direct local computed update bypasses property mutation but still reaches Render.',
        'No computed event is decoded or applied as remote canonical evidence.'
      ],
      allowedContributors: [
        'artifact:canonical-property-batch-evidence',
        'Props read-only property ancestor resolution',
        'Scene computed/property subscription',
        'ordinary local reactive event delivery',
        'direct local animation-to-computed input',
        '@asyra/core mission-specific local computed facade',
        'Asyra Design transient vector preview caller',
        'Pen Tool forced-rollback cancel cleanup',
        'Asyra Design computed derived-state consumers',
        '@asyra/preset local computed projection registration'
      ],
      forbiddenContributors: [
        'Factory transaction journal',
        'SharedDataChannel',
        'Collaboration publication',
        'client persistence',
        'app-level already-satisfied replay patches',
        'simultaneous shared and ordinary local computed Render delivery',
        'EVENT_OPTIONS on local computed mutation',
        'a changeComputedData compatibility alias or CHANGE_COMPUTED_DATA command event after the semantic handoff'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/subscribes.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/index.ts',
        'packages/scene-tree/src/components/computed.ts',
        'packages/scene-tree/src/components/element.ts',
        'packages/scene-tree/src/components/element-change-handler.ts',
        'packages/scene-tree/src/__tests__',
        'packages/core/src/apis/scene-tree.ts',
        'packages/core/src/apis/create-apis.ts',
        'packages/core/src/types/scene-tree.ts',
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/scene-tree-api.test.ts',
        'packages/core/src/__tests__/hierarchy-transaction.test.ts',
        'packages/utils/src/sceneTree/instanceTypes.ts',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts',
        'apps/asyra-design/src/common-apis/element/__tests__/vector-parent-creation.test.ts',
        'apps/asyra-design/src/common-apis/element/__tests__/transient-vector-preview.test.ts',
        'apps/asyra-design/src/features/pen-tool/feature.ts',
        'apps/asyra-design/src/features/pen-tool/__tests__/transient-preview-cancel.test.ts',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/features/pen-tool.md',
        'docs/ai/apps/asyra-design/bdd-features/pen-tool.feature',
        'docs/ai/apps/asyra-design/modules/state-contracts.md',
        'apps/asyra-design/src/init/derived-state/init-path-editing-continuation.ts',
        'apps/asyra-design/src/init/capabilities/init-vector-icon-data.ts',
        'apps/asyra-design/src/init/__tests__',
        'packages/reactive-events/src/scene-tree',
        'packages/reactive-events/src/__tests__',
        'packages/reactive-events/src/types.ts',
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/selection-subscriptions.test.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts',
        'packages/preset/package.json',
        'turbo.json',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/packages/scene-tree.md'
      ],
      specRefs: [
        '#canonical-and-local-projection-contracts',
        '#shared-element-property-relation-contract',
        '#target-architecture',
        '#step-local-formal-gates'
      ],
      failureOwnerStepId: 'derive-local-computed-projection'
    },
    {
      id: 'record-and-deliver-transaction-batch',
      order: 1,
      laneId: 'transaction-projection',
      title: 'Reuse action history and deliver one transaction batch',
      ownerPackage: '@asyra/factory',
      purpose:
        'Record property and structural source evidence once in the existing Factory transaction journal and Undo stack, then derive one separate minimal SharedPublication without creating a parallel local-history artifact.',
      inputs: [
        'artifact:canonical-property-batch-evidence',
        'artifact:canonical-scene-batch-evidence',
        'artifact:progressive-stage-request',
        'one Factory transaction identity'
      ],
      outputs: [
        'artifact:shared-publication',
        'artifact:local-persistence-trigger'
      ],
      conditions: [
        'Factory records canonical property and structural source evidence and must not record computed projection evidence.',
        'The reactive TransactionOwner contract exposes updateTransactionBatch as its only owner update SPI; the public scalar updateTransaction convenience delegates to batch-of-one.',
        'Each Props or Scene owner evidence batch is accepted exactly once as one whole immutable event array, while one outer Factory transaction groups those journal entries into one existing history action.',
        'Canonical ordered-ID evidence is carried inside each transaction event in that immutable event array; updateTransactionBatch accepts no parallel evidence parameter.',
        'Shared relation source evidence preserves canonical IDs through Undo, Redo, rollback, and each SharedPublication; Factory never reconstructs relation fanout from one initiating element.',
        'The existing Factory transaction journal and Undo stack remain the only local action-history owners.',
        'Factory creates no AI/bulk-specific forward/inverse artifact, parallel applied-result mirror, action-completion snapshot, or second history representation.',
        'Factory transaction execution exposes one active shared-delivery handle for the current outer transaction; Core never receives or transports it.',
        'SharedDataChannel requires appendBatch and observeBatch for every framework implementation.',
        'Public append and observe single-item conveniences delegate to the same batch-of-one path.',
        'The built-in channel deeply detaches and freezes one ordered batch at its owner boundary.',
        'One intended action uses one transaction semantic, the existing Factory journal, and one history action.',
        'Reactive observer evidence is released only after the transaction owner commits, as one ordered batch across all accepted owner evidence batches.',
        'Rollback or owner finalization failure discards the pending observer evidence and publishes no observer prefix.',
        'Factory derives an eligible staged canonical slice, committed remainder, or rollback compensation as one SharedPublication on the ordinary publication route.',
        'SharedPublication contains only transport identity, ordered slices, channel batches, and remote-apply deliveries; artifactId is opaque transport correlation and not a local History reference.',
        'Each staged publication receives stable transaction, publication, slice, and actual compensation identity from the existing journal.',
        'Acknowledged externally visible staged slices use the same journal evidence and recorded token for rollback compensation without republishing acknowledged records at commit.',
        'Shared-delivery bookkeeping records only the existing journal delivery outcome and never mirrors canonical payloads into another applied-result object.',
        'The production fast path performs no post-action save, equality comparison, finalize-save, full-document comparison, evidence clone, or recursive immutable-tree scan.',
        'A local committed action, Undo, or Redo may emit one shared publication and one persistence trigger; staged slices do not create another persistence trigger.',
        'A remote transaction applies through the ordinary canonical owners but creates no Undo, echo publication, or local persistence trigger.'
      ],
      bypasses: [
        'A no-change transaction emits no history action, publication, or persistence trigger.',
        'A rolled-back transaction emits no committed history or persistence trigger.',
        'Custom channels missing the required batch method shape fail registration without fallback or capability probing.',
        'Remote origin bypasses shared publication and client persistence.'
      ],
      allowedContributors: [
        'artifact:canonical-property-batch-evidence',
        'artifact:canonical-scene-batch-evidence',
        'Factory transaction journal and inverse owners',
        'required SharedDataChannel batch SPI',
        'Factory active shared-delivery handle',
        'artifact:progressive-stage-request'
      ],
      forbiddenContributors: [
        'UPDATE_COMPUTED_DATA or UPDATE_COMPUTED_DATA_PATCH evidence',
        'AI/bulk-specific forward/inverse artifacts',
        'parallel applied-result or action-completion snapshot objects',
        'History or rollback evidence inside SharedPublication',
        'post-action save, equality, finalize-save, or evidence clone passes',
        'batchAppendIsAtomic',
        'prototype identity or WeakSet capability checks',
        'single-item fallback loops',
        'a scalar TransactionOwner update SPI',
        'a parallel updateTransactionBatch evidence parameter',
        'a Core-carried shared-delivery handle',
        'atomic or progressive transaction mode or option',
        'transport framing, queueing, or peer receipts'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src',
        'packages/factory/src/__tests__',
        'packages/reactive-events/src/transaction-owner.ts',
        'packages/reactive-events/src/app/publish.ts',
        'packages/reactive-events/src/__tests__'
      ],
      specRefs: [
        '#shareddatachannel-contract',
        '#factory-ownership-contract',
        '#canonical-and-local-projection-contracts',
        '#shared-element-property-relation-contract',
        '#step-local-formal-gates'
      ],
      failureOwnerStepId: 'record-and-deliver-transaction-batch'
    },
    {
      id: 'project-render-state',
      order: 2,
      laneId: 'transaction-projection',
      title: 'Project canonical and computed Render/UI state',
      ownerPackage: '@asyra/render and @asyra/ui-context via @asyra/preset',
      purpose:
        'Project ordinary canonical owner batches and local computed changes through the ordinary engine-neutral Render and UI-context routes without consuming History evidence.',
      inputs: [
        'artifact:canonical-scene-batch-evidence',
        'artifact:local-computed-projection'
      ],
      outputs: ['artifact:render-projection', 'artifact:ui-context-projection'],
      conditions: [
        'Structural add, remove, move, and hierarchy evidence projects directly from the ordinary canonical Scene owner batch.',
        'Property-driven visual updates consume the local computed projection rather than shared raw property evidence.',
        'The same local computed projection updates Render and affected UI context exactly once through distinct Preset consumers without duplicating Render delivery.',
        'Local and remote state use the same ordinary Render strategy.',
        'Render and UI consume no History artifact, rollback evidence, inverse evidence, or SharedPublication payload.'
      ],
      bypasses: [
        'A canonical no-change produces no Render invalidation.',
        'Invisible or removed elements follow ordinary Render behavior.',
        'Diagnostics and timing evidence never enter product rendering.'
      ],
      allowedContributors: [
        'artifact:canonical-scene-batch-evidence',
        'artifact:local-computed-projection',
        '@asyra/preset ordinary observer wiring',
        '@asyra/render engine-neutral strategies',
        '@asyra/ui-context affected-entry projection'
      ],
      forbiddenContributors: [
        'Render-owned canonical state',
        'raw property evidence as a substitute for computed projection',
        'History artifacts, rollback evidence, or inverse evidence',
        'SharedPublication as a local projection source',
        'AI-only renderer or bitmap replacement',
        'diagnostic geometry or fixture-specific output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src',
        'packages/render/src/__tests__',
        'packages/preset/src',
        'packages/preset/src/__tests__'
      ],
      specRefs: [
        '#canonical-and-local-projection-contracts',
        '#target-architecture',
        '#integration-and-performance-gates'
      ],
      failureOwnerStepId: 'project-render-state'
    },
    {
      id: 'publish-shared-publication',
      order: 1,
      laneId: 'collaboration-transport',
      title: 'Publish one shared publication',
      ownerPackage: '@asyra/collaboration',
      purpose:
        'Preserve each Factory SharedPublication as one ordered transaction batch through one required outbound Provider call and one required async inbound callback.',
      inputs: [
        'artifact:shared-publication',
        'artifact:transport-received-publication'
      ],
      outputs: [
        'artifact:provider-publication-request',
        'artifact:inbound-publication-callback'
      ],
      conditions: [
        'SharedPublication is the transaction batch unit and retains canonical event order.',
        'Outbound delivery calls the required Provider.sendPublication path once per publication.',
        'Inbound delivery uses the required Provider.onPublication path with one exclusive async consumer.',
        'The inbound consumer promise remains pending until App canonical apply completes or fails.',
        'Collaboration consumes only Factory-owned SharedPublication artifacts and never derives a publication from generic staged status.',
        'Generic Collaboration owns no wire grouping, concurrency constant, queue watermark, codec, or retry mode.'
      ],
      bypasses: [
        'Disconnected mode produces no outbound send.',
        'A transport failure rejects the active publication without fabricating convergence.',
        'Awareness remains a separate ephemeral route.'
      ],
      allowedContributors: [
        'artifact:shared-publication',
        'artifact:transport-received-publication',
        'required Provider.sendPublication',
        'required Provider.onPublication',
        'Collaboration FIFO ordering'
      ],
      forbiddenContributors: [
        'sendPublications or onPublications',
        'onInboundPublicationLease',
        'maxConcurrentPublicationSends',
        'maxPublicationsPerSend',
        'runtime Provider capability branching'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src',
        'packages/collaboration/src/__tests__',
        'packages/collaboration/src/providers/memory'
      ],
      specRefs: [
        '#collaboration-provider-contract',
        '#pre-release-removal-policy',
        '#step-local-formal-gates'
      ],
      failureOwnerStepId: 'publish-shared-publication'
    },
    {
      id: 'transport-publication-bytes',
      order: 2,
      laneId: 'collaboration-transport',
      title: 'Transport publication bytes',
      ownerPackage: 'Asyra Design WebSocket Provider',
      purpose:
        'Accept publications into one bounded ordered Provider queue and transport versioned binary data through workers and an opaque relay without changing publication semantics.',
      inputs: [
        'artifact:provider-publication-request',
        'artifact:remote-apply-settlement'
      ],
      outputs: [
        'artifact:transport-received-publication',
        'artifact:transport-diagnostics'
      ],
      conditions: [
        'sendPublication resolves after bounded ordered queue acceptance, fixed queue position, and Provider delivery ownership.',
        'Permanent transport failure rejects sendPublication; server, wire, and peer receipts do not redefine that Promise.',
        'Publication data uses versioned binary frames and transferable buffers while control frames remain JSON.',
        'The server relays canonical payload bytes opaquely with bounded per-peer byte queues.',
        'server-accepted, wire-consumed, and peer-applied remain distinct diagnostic receipts and are not alternate sendPublication semantics.',
        'Wire-consumed credit may return after decode while the one App canonical consumer is still applying.',
        'Client and server use perMessageDeflate: false.'
      ],
      bypasses: [
        'Control-only messages bypass publication encoding.',
        'One indivisible oversized record may exceed the soft frame target without creating a product ceiling.',
        'Disconnect, invalid frame, or worker teardown reports ProviderFailure and does not fabricate delivery.'
      ],
      allowedContributors: [
        'artifact:provider-publication-request',
        'artifact:remote-apply-settlement',
        'existing compact binary codec',
        'platform Web Worker and transferable ArrayBuffer',
        'opaque WebSocket relay',
        'provider-owned byte queue and credits'
      ],
      forbiddenContributors: [
        'generic Collaboration concurrency or batch-size policy',
        'JSON pre-serialization of publication payloads',
        'server canonical payload decode or re-encode',
        'unbounded peer queues',
        'per-message compression',
        'receipts used as alternate Provider API modes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs'
      ],
      specRefs: [
        '#collaboration-provider-contract',
        '#profiling-contract',
        '#integration-and-performance-gates'
      ],
      failureOwnerStepId: 'transport-publication-bytes'
    },
    {
      id: 'apply-remote-publication',
      order: 3,
      laneId: 'collaboration-transport',
      title: 'Apply one remote publication',
      ownerPackage: 'Asyra Design Collaboration adapter',
      purpose:
        'Validate one inbound publication, open one remote Factory transaction, reuse the Core canonical owner flow, and settle the Provider consumer Promise without local-only side effects.',
      inputs: ['artifact:inbound-publication-callback'],
      outputs: [
        'artifact:remote-canonical-request',
        'artifact:remote-apply-settlement'
      ],
      conditions: [
        'One source publication owns exactly one remote Factory transaction and different publications are not merged.',
        'App policy validates the inbound publication before canonical mutation.',
        'The App submits one remote canonical request through Core and the same prepared Props and Scene mutations.',
        'The App calls exactly one Core.applyCanonicalChanges with one ordered CanonicalChange request for the accepted publication.',
        'A property-only remote follow-up derives computed state locally before Render.',
        'The Provider consumer promise resolves only after App canonical apply completes successfully.',
        'Actor B creates no Undo, echo publication, persistence capture, provider save, or IndexedDB write.'
      ],
      bypasses: [
        'Policy or canonical preflight failure occurs before mutation and rejects the consumer Promise.',
        'Terminal apply failure rolls back the remote transaction and settles failure without releasing fabricated success.',
        'Closed transport performs no remote transaction.'
      ],
      allowedContributors: [
        'artifact:inbound-publication-callback',
        'Asyra Design App policy',
        '@asyra/core public canonical facade',
        '@asyra/factory remote transaction boundary'
      ],
      forbiddenContributors: [
        'one remote transaction per canonical event',
        'merging different source publications',
        'remote Undo, echo, or client persistence',
        'remote UPDATE_COMPUTED_DATA payload',
        'whole-document peer regeneration'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-factory.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts'
      ],
      specRefs: [
        '#canonical-and-local-projection-contracts',
        '#collaboration-provider-contract',
        '#integration-and-performance-gates'
      ],
      failureOwnerStepId: 'apply-remote-publication'
    },
    {
      id: 'persist-local-commit',
      order: 1,
      laneId: 'durability',
      title: 'Persist eligible local commits',
      ownerPackage: '@asyra/core persistence coordinator',
      purpose:
        'Capture and serialize one detached snapshot for each eligible local action, Undo, and Redo while bypassing every remote transaction.',
      inputs: ['artifact:local-persistence-trigger'],
      outputs: ['artifact:persistence-status'],
      conditions: [
        'Local action, Undo, and Redo each capture one complete detached snapshot at commit.',
        'Snapshots and provider acknowledgements preserve FIFO order.',
        'One provider failure does not coalesce, drop, or block a later eligible snapshot.'
      ],
      bypasses: [
        'A remote transaction performs zero client capture, save hook, provider save, and IndexedDB write.',
        'Rollback and validation rejection save no snapshot.',
        'A missing provider reports persistence-skipped without capture.'
      ],
      allowedContributors: [
        'artifact:local-persistence-trigger',
        '@asyra/core persistence queue',
        '@asyra/persistence provider'
      ],
      forbiddenContributors: [
        'remote client persistence',
        'coalesced local snapshots',
        'live mutable provider data',
        'Collaboration or server checkpoint policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/persistence/src',
        'packages/persistence/src/providers/__tests__'
      ],
      specRefs: [
        '#factory-ownership-contract',
        '#integration-and-performance-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'persist-local-commit'
    }
  ]

  const routes = [
    {
      id: 'route-local-composition-to-core',
      from: 'prepare-one-composition-request',
      to: 'coordinate-canonical-owner-preparations',
      kind: 'request',
      predicate:
        'One accepted local composition is ready for canonical owners.',
      producedArtifacts: ['artifact:local-composition-request']
    },
    {
      id: 'route-progressive-stage-request-to-factory',
      from: 'prepare-one-composition-request',
      to: 'record-and-deliver-transaction-batch',
      kind: 'control',
      predicate:
        'The App requests the next prepared local visibility slice from the active Factory transaction.',
      producedArtifacts: ['artifact:progressive-stage-request']
    },
    {
      id: 'route-core-to-property-preflight',
      from: 'coordinate-canonical-owner-preparations',
      to: 'prepare-and-apply-property-batch',
      kind: 'preflight',
      predicate:
        'The selected lifecycle requires property source evidence or a prepared exact orphan property graph mutation.',
      producedArtifacts: ['artifact:property-preflight-request']
    },
    {
      id: 'route-core-to-scene-preflight',
      from: 'coordinate-canonical-owner-preparations',
      to: 'prepare-and-apply-scene-mutation',
      kind: 'preflight',
      predicate: 'The selected lifecycle requires Scene owner evidence.',
      producedArtifacts: ['artifact:scene-preflight-request']
    },
    {
      id: 'route-core-to-element-property-target-resolution',
      from: 'coordinate-canonical-owner-preparations',
      to: 'prepare-and-apply-scene-mutation',
      kind: 'resolution',
      predicate:
        'A typed local canonical element-property batch requires owner targets.',
      producedArtifacts: ['artifact:element-property-target-request']
    },
    {
      id: 'route-prepared-property-mutation-batch-to-core',
      from: 'prepare-and-apply-property-batch',
      to: 'coordinate-canonical-owner-preparations',
      kind: 'preparation',
      predicate: 'Whole-batch property preflight succeeded.',
      producedArtifacts: ['artifact:prepared-property-mutation-batch']
    },
    {
      id: 'route-prepared-element-mutation-to-core',
      from: 'prepare-and-apply-scene-mutation',
      to: 'coordinate-canonical-owner-preparations',
      kind: 'preparation',
      predicate:
        'Whole-batch Scene preflight succeeded, including any exact released, retained, orphan-root, and relation-set staleness evidence.',
      producedArtifacts: ['artifact:prepared-element-mutation']
    },
    {
      id: 'route-resolved-element-property-targets-to-core',
      from: 'prepare-and-apply-scene-mutation',
      to: 'coordinate-canonical-owner-preparations',
      kind: 'resolution',
      predicate:
        'The complete read-only resolved element-to-property targets grouped equivalent propertyId mutations and found no conflicting shared write.',
      producedArtifacts: ['artifact:resolved-element-property-targets']
    },
    {
      id: 'route-core-authorization-to-property',
      from: 'coordinate-canonical-owner-preparations',
      to: 'prepare-and-apply-property-batch',
      kind: 'apply',
      predicate:
        'Every preparation required by this request succeeded and property apply is required.',
      producedArtifacts: ['artifact:canonical-apply-authorization']
    },
    {
      id: 'route-core-authorization-to-scene',
      from: 'coordinate-canonical-owner-preparations',
      to: 'prepare-and-apply-scene-mutation',
      kind: 'apply',
      predicate:
        'Every preparation required by this request succeeded and a prepared Scene mutation exists.',
      producedArtifacts: ['artifact:canonical-apply-authorization']
    },
    {
      id: 'route-property-evidence-to-computed',
      from: 'prepare-and-apply-property-batch',
      to: 'derive-local-computed-projection',
      kind: 'projection',
      predicate:
        'Applied source-only property evidence provides changed property IDs that Props expands through its property ancestor closure before Scene maps the resulting roots through its reverse relation index.',
      producedArtifacts: ['artifact:canonical-property-batch-evidence']
    },
    {
      id: 'route-property-evidence-to-factory',
      from: 'prepare-and-apply-property-batch',
      to: 'record-and-deliver-transaction-batch',
      kind: 'journal',
      predicate:
        'Applied canonical property evidence belongs to the transaction.',
      producedArtifacts: ['artifact:canonical-property-batch-evidence']
    },
    {
      id: 'route-scene-evidence-to-factory',
      from: 'prepare-and-apply-scene-mutation',
      to: 'record-and-deliver-transaction-batch',
      kind: 'journal',
      predicate: 'Applied canonical Scene evidence belongs to the transaction.',
      producedArtifacts: ['artifact:canonical-scene-batch-evidence']
    },
    {
      id: 'route-computed-to-render',
      from: 'derive-local-computed-projection',
      to: 'project-render-state',
      kind: 'projection',
      predicate: 'A local computed value changed semantically.',
      producedArtifacts: ['artifact:local-computed-projection']
    },
    {
      id: 'route-scene-evidence-to-render',
      from: 'prepare-and-apply-scene-mutation',
      to: 'project-render-state',
      kind: 'projection',
      predicate:
        'Ordinary canonical Scene owner evidence is available for local structural projection.',
      producedArtifacts: ['artifact:canonical-scene-batch-evidence']
    },
    {
      id: 'route-render-terminal',
      from: 'project-render-state',
      kind: 'terminal',
      predicate: 'The ordinary Render projection reached its current state.',
      producedArtifacts: ['artifact:render-projection']
    },
    {
      id: 'route-ui-context-terminal',
      from: 'project-render-state',
      kind: 'terminal',
      predicate:
        'The affected UI-context projection reached its current local computed state.',
      producedArtifacts: ['artifact:ui-context-projection']
    },
    {
      id: 'route-factory-publication-to-collaboration',
      from: 'record-and-deliver-transaction-batch',
      to: 'publish-shared-publication',
      kind: 'publication',
      predicate:
        'Factory produced an eligible staged slice, committed remainder, Undo, Redo, or rollback compensation as one SharedPublication.',
      producedArtifacts: ['artifact:shared-publication']
    },
    {
      id: 'route-collaboration-to-provider',
      from: 'publish-shared-publication',
      to: 'transport-publication-bytes',
      kind: 'provider',
      predicate: 'Collaboration hands off the next ordered SharedPublication.',
      producedArtifacts: ['artifact:provider-publication-request']
    },
    {
      id: 'route-provider-to-collaboration',
      from: 'transport-publication-bytes',
      to: 'publish-shared-publication',
      kind: 'provider',
      predicate: 'The Provider decoded one ordered inbound SharedPublication.',
      producedArtifacts: ['artifact:transport-received-publication']
    },
    {
      id: 'route-collaboration-to-remote-app',
      from: 'publish-shared-publication',
      to: 'apply-remote-publication',
      kind: 'callback',
      predicate:
        'The required async inbound consumer receives one publication.',
      producedArtifacts: ['artifact:inbound-publication-callback']
    },
    {
      id: 'route-remote-app-to-core',
      from: 'apply-remote-publication',
      to: 'coordinate-canonical-owner-preparations',
      kind: 'request',
      predicate: 'App policy accepted one remote canonical request.',
      producedArtifacts: ['artifact:remote-canonical-request']
    },
    {
      id: 'route-remote-settlement-to-provider',
      from: 'apply-remote-publication',
      to: 'transport-publication-bytes',
      kind: 'settlement',
      predicate: 'App canonical apply completed successfully or failed.',
      producedArtifacts: ['artifact:remote-apply-settlement']
    },
    {
      id: 'route-transport-diagnostics-terminal',
      from: 'transport-publication-bytes',
      kind: 'terminal',
      predicate: 'Detached transport diagnostics are available for profiling.',
      producedArtifacts: ['artifact:transport-diagnostics']
    },
    {
      id: 'route-local-persistence-trigger',
      from: 'record-and-deliver-transaction-batch',
      to: 'persist-local-commit',
      kind: 'durability',
      predicate: 'A local action, Undo, or Redo committed.',
      producedArtifacts: ['artifact:local-persistence-trigger']
    },
    {
      id: 'route-persistence-terminal',
      from: 'persist-local-commit',
      kind: 'terminal',
      predicate: 'Persistence was acknowledged, skipped, or failed.',
      producedArtifacts: ['artifact:persistence-status']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:local-composition-request',
      ownerStepId: 'prepare-one-composition-request',
      channel: 'Asyra Design common API',
      consumerStepIds: ['coordinate-canonical-owner-preparations'],
      terminal: false
    },
    {
      id: 'artifact:progressive-stage-request',
      ownerStepId: 'prepare-one-composition-request',
      channel: 'Factory active shared-delivery handle',
      consumerStepIds: ['record-and-deliver-transaction-batch'],
      terminal: false
    },
    {
      id: 'artifact:property-preflight-request',
      ownerStepId: 'coordinate-canonical-owner-preparations',
      channel: '@asyra/core owner request',
      consumerStepIds: ['prepare-and-apply-property-batch'],
      terminal: false
    },
    {
      id: 'artifact:scene-preflight-request',
      ownerStepId: 'coordinate-canonical-owner-preparations',
      channel: '@asyra/core owner request',
      consumerStepIds: ['prepare-and-apply-scene-mutation'],
      terminal: false
    },
    {
      id: 'artifact:element-property-target-request',
      ownerStepId: 'coordinate-canonical-owner-preparations',
      channel: '@asyra/core read-only owner resolution request',
      consumerStepIds: ['prepare-and-apply-scene-mutation'],
      terminal: false
    },
    {
      id: 'artifact:prepared-property-mutation-batch',
      ownerStepId: 'prepare-and-apply-property-batch',
      channel:
        'Props Manager owner-issued prepared source mutation or exact orphan property graph mutation',
      consumerStepIds: ['coordinate-canonical-owner-preparations'],
      terminal: false
    },
    {
      id: 'artifact:prepared-element-mutation',
      ownerStepId: 'prepare-and-apply-scene-mutation',
      channel:
        'Scene Tree owner-issued prepared map, hierarchy, and element-property relation mutation',
      consumerStepIds: ['coordinate-canonical-owner-preparations'],
      terminal: false
    },
    {
      id: 'artifact:resolved-element-property-targets',
      ownerStepId: 'prepare-and-apply-scene-mutation',
      channel:
        '@asyra/scene-tree read-only grouped propertyId and many-to-one resolved ElementPropertyRelation targets',
      consumerStepIds: ['coordinate-canonical-owner-preparations'],
      terminal: false
    },
    {
      id: 'artifact:canonical-apply-authorization',
      ownerStepId: 'coordinate-canonical-owner-preparations',
      channel: '@asyra/core apply orchestration',
      consumerStepIds: [
        'prepare-and-apply-property-batch',
        'prepare-and-apply-scene-mutation'
      ],
      terminal: false
    },
    {
      id: 'artifact:canonical-property-batch-evidence',
      ownerStepId: 'prepare-and-apply-property-batch',
      channel: 'ordered Props canonical evidence',
      consumerStepIds: [
        'derive-local-computed-projection',
        'record-and-deliver-transaction-batch'
      ],
      terminal: false
    },
    {
      id: 'artifact:canonical-scene-batch-evidence',
      ownerStepId: 'prepare-and-apply-scene-mutation',
      channel: 'ordered Scene canonical evidence',
      consumerStepIds: [
        'record-and-deliver-transaction-batch',
        'project-render-state'
      ],
      terminal: false
    },
    {
      id: 'artifact:local-computed-projection',
      ownerStepId: 'derive-local-computed-projection',
      channel: 'ordinary local reactive event',
      consumerStepIds: ['project-render-state'],
      terminal: false
    },
    {
      id: 'artifact:shared-publication',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel:
        'Factory required batch shared channel with stable transaction, publication, slice, and compensation identity',
      consumerStepIds: ['publish-shared-publication'],
      terminal: false
    },
    {
      id: 'artifact:local-persistence-trigger',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'isolated local commit handoff',
      consumerStepIds: ['persist-local-commit'],
      terminal: false
    },
    {
      id: 'artifact:render-projection',
      ownerStepId: 'project-render-state',
      channel: 'ordinary engine-neutral Render output',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:ui-context-projection',
      ownerStepId: 'project-render-state',
      channel: 'ordinary affected-entry UI-context output',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:provider-publication-request',
      ownerStepId: 'publish-shared-publication',
      channel: 'required Provider.sendPublication call',
      consumerStepIds: ['transport-publication-bytes'],
      terminal: false
    },
    {
      id: 'artifact:transport-received-publication',
      ownerStepId: 'transport-publication-bytes',
      channel: 'required Provider.onPublication callback',
      consumerStepIds: ['publish-shared-publication'],
      terminal: false
    },
    {
      id: 'artifact:inbound-publication-callback',
      ownerStepId: 'publish-shared-publication',
      channel: 'exclusive async Collaboration consumer',
      consumerStepIds: ['apply-remote-publication'],
      terminal: false
    },
    {
      id: 'artifact:remote-canonical-request',
      ownerStepId: 'apply-remote-publication',
      channel: 'Asyra Design App policy and Core request',
      consumerStepIds: ['coordinate-canonical-owner-preparations'],
      terminal: false
    },
    {
      id: 'artifact:remote-apply-settlement',
      ownerStepId: 'apply-remote-publication',
      channel: 'App canonical apply completion',
      consumerStepIds: ['transport-publication-bytes'],
      terminal: false
    },
    {
      id: 'artifact:transport-diagnostics',
      ownerStepId: 'transport-publication-bytes',
      channel: 'detached provider and wire timing/status',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:persistence-status',
      ownerStepId: 'persist-local-commit',
      channel: 'Core persistence status',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'canonical-source-and-local-projection-are-disjoint',
      statement:
        'Property and structural evidence may enter Factory and Collaboration, while computed evidence reaches Render and UI context locally and has no shared, history, or persistence route.',
      stepIds: [
        'prepare-and-apply-property-batch',
        'derive-local-computed-projection',
        'record-and-deliver-transaction-batch',
        'project-render-state'
      ],
      artifactIds: [
        'artifact:canonical-property-batch-evidence',
        'artifact:canonical-scene-batch-evidence',
        'artifact:local-computed-projection',
        'artifact:ui-context-projection'
      ],
      specRefs: ['#canonical-and-local-projection-contracts']
    },
    {
      id: 'shared-element-property-relations-are-many-to-one',
      statement:
        'Props-owned property and component identity plus property-child graph remain separate from Scene-owned element hierarchy and element-slot-to-root relations. This separation is the stable extension seam for future shared props, shared components, and shared elements without pre-assigning product semantics: ElementPropertyRelation identity is the element-slot tuple rather than componentId, one compatible property component may serve many relations, source-only UPDATE_PROPERTY evidence fans out locally through the Scene reverse index, and only the final orphan relation authorizes exact graph removal.',
      stepIds: [
        'coordinate-canonical-owner-preparations',
        'prepare-and-apply-property-batch',
        'prepare-and-apply-scene-mutation',
        'derive-local-computed-projection',
        'record-and-deliver-transaction-batch'
      ],
      artifactIds: [
        'artifact:resolved-element-property-targets',
        'artifact:prepared-property-mutation-batch',
        'artifact:prepared-element-mutation',
        'artifact:canonical-property-batch-evidence',
        'artifact:canonical-scene-batch-evidence',
        'artifact:local-computed-projection',
        'artifact:shared-publication'
      ],
      specRefs: ['#shared-element-property-relation-contract']
    },
    {
      id: 'one-action-one-journal-one-history',
      statement:
        'One intended action retains one outer transaction, one existing Factory journal, and one intended history action; eligible staged, committed, and compensation publications use the same separate minimal SharedPublication route with stable identity.',
      stepIds: [
        'prepare-one-composition-request',
        'record-and-deliver-transaction-batch',
        'publish-shared-publication',
        'transport-publication-bytes'
      ],
      artifactIds: [
        'artifact:local-composition-request',
        'artifact:shared-publication'
      ],
      specRefs: ['#factory-ownership-contract', '#target-architecture']
    },
    {
      id: 'framework-ecosystem-has-one-batch-contract',
      statement:
        'Framework channels and collaboration publications use one required batch semantic; single conveniences are batch-of-one and custom implementations receive no compatibility probing.',
      stepIds: [
        'record-and-deliver-transaction-batch',
        'publish-shared-publication'
      ],
      artifactIds: [
        'artifact:canonical-property-batch-evidence',
        'artifact:canonical-scene-batch-evidence',
        'artifact:shared-publication'
      ],
      specRefs: [
        '#shareddatachannel-contract',
        '#collaboration-provider-contract'
      ]
    },
    {
      id: 'transport-is-bounded-and-not-canonical',
      statement:
        'Provider and server transport preserve publication identity and bounded bytes without owning canonical policy, history, persistence, or alternate Provider completion meanings.',
      stepIds: [
        'publish-shared-publication',
        'transport-publication-bytes',
        'apply-remote-publication'
      ],
      artifactIds: [
        'artifact:provider-publication-request',
        'artifact:transport-received-publication',
        'artifact:remote-apply-settlement'
      ],
      specRefs: ['#collaboration-provider-contract', '#profiling-contract']
    },
    {
      id: 'remote-apply-has-no-local-only-side-effects',
      statement:
        'One remote publication reuses canonical owners and local computed projection but creates no local Undo, echo publication, or client persistence.',
      stepIds: [
        'apply-remote-publication',
        'coordinate-canonical-owner-preparations',
        'derive-local-computed-projection',
        'persist-local-commit'
      ],
      artifactIds: [
        'artifact:remote-canonical-request',
        'artifact:local-computed-projection',
        'artifact:remote-apply-settlement'
      ],
      specRefs: [
        '#canonical-and-local-projection-contracts',
        '#factory-ownership-contract'
      ]
    }
  ]

  const acceptanceContracts = [
    {
      id: 'shared-relation-lifecycle',
      title: 'Shared relation lifecycle',
      assertions: [
        'Equivalent shared-property targets mutate one source, all active element relations project locally, a non-final relation release retains the component, final orphan cleanup removes the graph once, and Undo, Redo, rollback, SharedPublication, and remote apply preserve canonical IDs and tuples.'
      ],
      stepIds: [
        'coordinate-canonical-owner-preparations',
        'prepare-and-apply-property-batch',
        'prepare-and-apply-scene-mutation',
        'derive-local-computed-projection',
        'record-and-deliver-transaction-batch',
        'apply-remote-publication'
      ],
      specRefs: [
        '#shared-element-property-relation-contract',
        '#step-local-formal-gates'
      ]
    },
    {
      id: 'owner-batch-atomicity',
      title: 'Owner batch atomicity',
      assertions: [
        'Core obtains complete prepared Props and Scene mutations before apply; a later invalid item leaves no owner prefix and unexpected apply failure rolls back through Factory.'
      ],
      stepIds: [
        'coordinate-canonical-owner-preparations',
        'prepare-and-apply-property-batch',
        'prepare-and-apply-scene-mutation',
        'record-and-deliver-transaction-batch'
      ],
      specRefs: [
        '#props-manager-batch-contract',
        '#scene-tree-lifecycle-and-apply-contract',
        '#step-local-formal-gates'
      ]
    },
    {
      id: 'local-computed-render-parity',
      title: 'Local computed Render parity',
      assertions: [
        'Local, remote, Undo, Redo, load, and future animation computed updates reach ordinary Render locally without computed shared evidence.'
      ],
      stepIds: [
        'derive-local-computed-projection',
        'project-render-state',
        'apply-remote-publication'
      ],
      specRefs: [
        '#canonical-and-local-projection-contracts',
        '#integration-and-performance-gates'
      ]
    },
    {
      id: 'single-publication-provider-flow',
      title: 'Single publication Provider flow',
      assertions: [
        'Each Factory-authorized staged, committed, or compensation SharedPublication follows the same required Provider send/receive path with bounded binary transport and one remote transaction; Collaboration never derives publications from staged status.'
      ],
      stepIds: [
        'publish-shared-publication',
        'transport-publication-bytes',
        'apply-remote-publication'
      ],
      specRefs: [
        '#collaboration-provider-contract',
        '#integration-and-performance-gates'
      ]
    },
    {
      id: 'performance-plan-handoff',
      title: 'Performance plan handoff',
      assertions: [
        'The 16-item correctness case, high-detail creation and follow-ups, separated timing, one-action history, remote side-effect isolation, and later independent heavy gates retain full detail and identity.'
      ],
      stepIds: [
        'prepare-one-composition-request',
        'record-and-deliver-transaction-batch',
        'transport-publication-bytes',
        'apply-remote-publication',
        'persist-local-commit'
      ],
      specRefs: ['#integration-and-performance-gates', '#definition-of-done']
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'canonical-projection-and-collaboration-contract-realignment',
      kind: 'system',
      title: 'Canonical Projection and Collaboration Contract Inspector',
      subtitle:
        'One plural canonical request, separate Props and Scene owners, local-only computed projection, one existing Factory journal and Undo boundary, one minimal SharedPublication path, bounded bytes, and remote side-effect isolation.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner:
        'Asyra Design Pre-Release Canonical Projection and Collaboration Contract Realignment Plan',
      inspectorOwner:
        'Canonical projection and collaboration owner handoff flow'
    },
    links: [
      {
        id: 'realignment-plan',
        kind: 'authority',
        label: 'Canonical projection and collaboration contract',
        href: './completed/canonical-projection-and-collaboration-contract-realignment-plan.md'
      },
      {
        id: 'performance-plan',
        kind: 'completed-successor',
        label: 'Completed Asyra Design drawing performance plan',
        href: '../../apps/asyra-design/plans/completed/ai-conversational-drawing-performance-plan.md'
      },
      {
        id: 'transaction-inspector',
        kind: 'framework',
        label: 'Existing Factory transaction authority',
        href: './transaction-flow-inspector.html'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.values(value).forEach(deepFreeze)
    return Object.freeze(value)
  }

  deepFreeze(data)
  globalThis.FLOW_INSPECTOR_DATA = data

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
