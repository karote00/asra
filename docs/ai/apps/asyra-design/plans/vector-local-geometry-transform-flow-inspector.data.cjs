;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-flow-inspector.data.cjs'

  const lanes = [
    { id: 'load', title: 'Load Migration', order: 1 },
    { id: 'canonical', title: 'Canonical Geometry and Transform', order: 2 },
    { id: 'hierarchy', title: 'Hierarchy Preservation', order: 3 },
    { id: 'projection', title: 'Render Projection', order: 4 },
    { id: 'interaction', title: 'Editing Interaction', order: 5 },
    { id: 'settlement', title: 'Action Settlement', order: 6 }
  ]

  const steps = [
    {
      id: 'migrate-workspace-points-to-local',
      order: 1,
      laneId: 'load',
      title: 'Migrate legacy workspace points once',
      ownerPackage: 'Asyra Design app migration',
      purpose:
        'Convert one valid legacy document from workspace-owned Vector points to stable Vector-local points before package validation and canonical apply.',
      inputs: [
        'raw app document with the legacy Asyra Design version',
        'canonical Scene Tree element/parent/property ids in the raw document',
        'canonical Props component records in the raw document'
      ],
      outputs: [
        'artifact:migrated-local-vector-document',
        'artifact:vector-migration-failure'
      ],
      conditions: [
        'The app registers one connected version transition through the public Core load-hook boundary.',
        'Each legacy Vector resolves one effective point offset from its position and official Group ancestor positions in raw canonical data.',
        'Every referenced point/control record is converted exactly once, ids/topology/style/hierarchy are preserved, pointCoordinateSpace becomes local, and the app document version advances.',
        'New-version documents bypass conversion and enter package validation unchanged.',
        'The complete migration is a pure detached transform and applies no canonical prefix.'
      ],
      bypasses: [
        'A document at the new version invokes no workspace-to-local transform.',
        'A document with no Vector elements advances through the same version step without fabricating geometry.'
      ],
      allowedContributors: [
        'public core.registerLoadHook API',
        'Asyra Design connected migration registry',
        'raw Scene Tree and Props document data',
        'app document version constants'
      ],
      forbiddenContributors: [
        '@asyra/preset or Render migration policy',
        'live Render handles or viewport state',
        'partial canonical state writes',
        'workspace-coordinate runtime fallback after migration'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/config',
        'apps/asyra-design/src/init',
        'apps/asyra-design/src/render-app/__tests__',
        'apps/asyra-design/samples/crdt-7076',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md',
        'docs/ai/apps/asyra-design/modules/state-contracts.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#load-migration',
        '#slice-2-app-owned-load-migration-and-creation-contract',
        '#invalid-cases'
      ],
      failureOwnerStepId: 'migrate-workspace-points-to-local'
    },
    {
      id: 'author-local-vector-geometry',
      order: 1,
      laneId: 'canonical',
      title: 'Author stable local Vector geometry',
      ownerPackage: 'Asyra Design Vector common API',
      purpose:
        'Create and edit canonical Vector topology in one stable element-local coordinate space without whole-map rebasing.',
      inputs: [
        'validated create/import Vector topology intent',
        'validated local point/handle edit intent',
        'artifact:local-vector-edit-intent',
        'current canonical local topology',
        'current authored element transform values'
      ],
      outputs: [
        'artifact:canonical-local-vector-geometry-delta',
        'artifact:local-vector-geometry-no-op',
        'artifact:local-vector-geometry-failure'
      ],
      conditions: [
        'Creation converts app-boundary workspace positions to local points once and writes pointCoordinateSpace local.',
        'Point/handle edits change only intended records plus constant-size bounds/transform values needed to preserve the current affine result.',
        'Local coordinates and local bounds may be negative or non-zero and are never normalized by rewriting every point.',
        'Topology references and non-finite values are validated before canonical mutation.',
        'Segments and networks retain canonical ids and membership unless the requested geometry operation changes them.'
      ],
      bypasses: [
        'An equal point/handle edit produces a no-op artifact and no mutation.',
        'Whole-element transform intents bypass this owner and enter apply-vector-element-transform.'
      ],
      allowedContributors: [
        'Asyra Design element/vector common APIs',
        'canonical Vector topology helpers',
        'public Core property patch APIs',
        'engine-neutral Render coordinate conversion queries'
      ],
      forbiddenContributors: [
        'feature-owned topology mutation',
        'UI-owned coordinate conversion',
        'Render or Pixi canonical state',
        'bounds-triggered whole-point normalization'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis/element',
        'apps/asyra-design/src/common-apis/strokes.ts',
        'apps/asyra-design/src/common-apis/fills.ts',
        'apps/asyra-design/src/ai',
        'packages/core/src/types',
        'packages/preset/src/components',
        'packages/preset/src/props',
        'docs/ai/apps/asyra-design/modules/common-apis.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#canonical-coordinate-spaces',
        '#geometry-editing',
        '#slice-3-local-geometry-mutation-owner'
      ],
      failureOwnerStepId: 'author-local-vector-geometry'
    },
    {
      id: 'apply-vector-element-transform',
      order: 2,
      laneId: 'canonical',
      title: 'Apply whole-element transform only',
      ownerPackage: 'Asyra Design element common API',
      purpose:
        'Turn move, dimension, rotation, scale, and skew intent into a bounded element-transform mutation with no Vector point/control patch.',
      inputs: [
        'validated whole-element transform intent',
        'current authored transform values',
        'current derived local geometry bounds',
        'current outer feature transaction options'
      ],
      outputs: [
        'artifact:canonical-vector-transform-delta',
        'artifact:vector-transform-no-op',
        'artifact:vector-transform-failure'
      ],
      conditions: [
        'Translation, dimension, rotation, scale, and skew update only element transform values.',
        'Mutation and shared payload size are independent of Vector point count.',
        'Mixed ordinary/Vector batches preflight and commit through one existing common-API transaction boundary.',
        'One synchronous move update remains one immediate shared publication inside the outer move session.',
        'No point/control record appears in a transform-only patch or inverse.'
      ],
      bypasses: [
        'An equal transform produces a no-op artifact and no publication.',
        'Direct point/handle editing bypasses this owner and enters author-local-vector-geometry.'
      ],
      allowedContributors: [
        'move-elements feature transform targets',
        'Asyra Design element common API',
        'public Core plural property update/patch APIs',
        'current transaction mutation options'
      ],
      forbiddenContributors: [
        'Vector point/control patch builders',
        'transient Render-only canonical transform',
        'feature-owned direct Core or Props mutation',
        'point-count-dependent publication evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/features/move-elements',
        'apps/asyra-design/src/common-apis/element',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/features/__tests__',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/rules/ui-data-flow.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#element-transform',
        '#transactions-persistence-and-collaboration',
        '#slice-4-whole-element-transform-and-hierarchy'
      ],
      failureOwnerStepId: 'apply-vector-element-transform'
    },
    {
      id: 'preserve-vector-hierarchy-transform',
      order: 1,
      laneId: 'hierarchy',
      title: 'Preserve world result across hierarchy changes',
      ownerPackage: '@asyra/preset Group geometry adapter',
      purpose:
        'Preserve the Vector world result during Group, ungroup, move/reorder, reparent, and Group normalization by updating hierarchy/transform values only.',
      inputs: [
        'accepted canonical hierarchy move result',
        'source and target parent transforms',
        'current Vector element transform',
        'official Group bounds normalization request'
      ],
      outputs: [
        'artifact:hierarchy-preserving-transform-delta',
        'artifact:hierarchy-transform-failure'
      ],
      conditions: [
        'Scene Tree owns final parent membership/order/cycle validation before Preset coordinate projection.',
        'Preset computes the target parent-local transform that preserves the pre-move world result.',
        'Affected Group bounds normalize deepest-first in the same intended transaction.',
        'Vector points, controls, segments, and networks remain unchanged.'
      ],
      bypasses: [
        'A same-parent reorder with no coordinate change emits no transform delta.',
        'A hierarchy request rejected by Scene Tree produces no Preset geometry mutation.'
      ],
      allowedContributors: [
        '@asyra/scene-tree accepted hierarchy result',
        '@asyra/preset official Group coordinate/bounds adapter',
        'engine-neutral parent transform queries',
        'public Core property update APIs'
      ],
      forbiddenContributors: [
        'app-owned Group origin arithmetic',
        'Vector point translation during reparent',
        'Render ancestry mutation outside the committed hierarchy route',
        'Collaboration-owned hierarchy policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/components/group.ts',
        'packages/preset/src/__tests__',
        'apps/asyra-design/src/common-apis/hierarchy.ts',
        'apps/asyra-design/src/common-apis/__tests__',
        'apps/asyra-design/src/features/layer-hierarchy-move',
        'apps/asyra-design/e2e/group-hierarchy.spec.ts',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#hierarchy',
        '#valid-cases',
        '#slice-4-whole-element-transform-and-hierarchy'
      ],
      failureOwnerStepId: 'preserve-vector-hierarchy-transform'
    },
    {
      id: 'project-local-vector-render',
      order: 1,
      laneId: 'projection',
      title: 'Project local geometry through one transform',
      ownerPackage: '@asyra/render with @asyra/preset Vector strategy',
      purpose:
        'Draw local Vector geometry once per geometry/style change and apply transform-only deltas directly through the engine-neutral Render boundary.',
      inputs: [
        'artifact:canonical-local-vector-geometry-delta',
        'artifact:canonical-vector-transform-delta',
        'artifact:hierarchy-preserving-transform-delta',
        'complete derived Vector render snapshot',
        'registered generic strategy transform capability'
      ],
      outputs: [
        'artifact:transformed-vector-render-result',
        'artifact:vector-render-projection-failure'
      ],
      conditions: [
        'Preset draws from pointCoordinateSpace local and never reconstructs workspace-owned points.',
        'The Render registry exposes a generic transform-only property capability rather than a Vector-specific store branch.',
        'Translation, dimension/scale, rotation, and skew deltas update the existing Render object transform without executing Vector geometry strategy.',
        'Geometry/style changes still execute the ordinary complete-snapshot strategy route.',
        'The engine-neutral Render object world transform and concrete Pixi transform remain equivalent.',
        'Fill, stroke, gradient, authored local bounds, and local hit geometry share the same transform.'
      ],
      bypasses: [
        'A transform-only delta bypasses geometry/style rebuild but not the ordinary committed Render projection.',
        'A missing/invalid Render projection fails closed and does not emit fallback graphics.'
      ],
      allowedContributors: [
        '@asyra/render derived snapshot and strategy registry',
        '@asyra/preset Vector strategy and style helpers',
        '@asyra/render-engine transform contract',
        '@asyra/render-engine-pixi concrete transform application'
      ],
      forbiddenContributors: [
        'Pixi imports outside @asyra/render-engine-pixi',
        'Vector-specific delta classification in Preset subscription routing',
        'Render-owned canonical geometry or transform',
        'diagnostic, cached, or fallback geometry as visible product output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src',
        'packages/render-engine/src',
        'packages/render-engine-pixi/src',
        'packages/preset/src/components',
        'packages/preset/src/__tests__',
        'apps/asyra-design/e2e/render-delta-performance.spec.ts',
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/packages/render-engine.md',
        'docs/ai/framework/packages/render-engine-pixi.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#rendering-and-caching',
        '#slice-5-render-engine-hit-and-overlay-projection',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'project-local-vector-render'
    },
    {
      id: 'project-vector-editing-interaction',
      order: 1,
      laneId: 'interaction',
      title: 'Project local geometry into editing interaction',
      ownerPackage: 'Asyra Design/Preset Vector interaction projection',
      purpose:
        'Use the current Render transform for point/segment hit intent, Vector hover, selection bounds, path-edit overlays, and inverse-transformed point/handle edits.',
      inputs: [
        'artifact:transformed-vector-render-result',
        'client or workspace pointer position',
        'current selection/path-edit state',
        'current canonical local topology'
      ],
      outputs: [
        'artifact:local-vector-edit-intent',
        'artifact:vector-editing-overlay-result',
        'artifact:vector-interaction-no-hit',
        'artifact:vector-interaction-failure'
      ],
      conditions: [
        'One engine-neutral element transform maps local geometry to workspace/client projection and inverse-maps edit intent to local coordinates.',
        'Selection, hover, gradient/stroke geometry, hit testing, and path-edit overlays agree on the same transformed result.',
        'Synthetic handles remain derived presentation and never become canonical points.',
        'The local edit intent contains only the target point/segment identity and resolved local position required by author-local-vector-geometry.'
      ],
      bypasses: [
        'A pointer outside transformed fill/stroke/edit geometry produces no-hit and no canonical mutation.',
        'A missing current Render identity produces the established no-result/failure outcome without raw coordinate fallback.'
      ],
      allowedContributors: [
        'Asyra Design Vector common APIs',
        '@asyra/preset selection/path-edit/gradient overlay projection',
        '@asyra/render engine-neutral local/workspace conversion',
        'canonical Selection/System Context state'
      ],
      forbiddenContributors: [
        'UI-owned coordinate arithmetic',
        'workspace-coordinate canonical point copies',
        'Awareness or collaboration presence',
        'overlay geometry used as canonical edit input'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis/element',
        'apps/asyra-design/src/common-apis/fills.ts',
        'apps/asyra-design/src/common-apis/strokes.ts',
        'packages/preset/src/render-layers',
        'packages/preset/src/__tests__',
        'packages/render/src',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/modules/state-contracts.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#geometry-editing',
        '#valid-cases',
        '#slice-5-render-engine-hit-and-overlay-projection'
      ],
      failureOwnerStepId: 'project-vector-editing-interaction'
    },
    {
      id: 'settle-vector-action',
      order: 1,
      laneId: 'settlement',
      title: 'Settle transaction, publication, and persistence',
      ownerPackage: '@asyra/factory and Core persistence',
      purpose:
        'Settle ordinary Vector geometry/transform actions through the existing transaction journal, Undo/Redo, shared publication, remote apply, and persistence routes.',
      inputs: [
        'artifact:canonical-local-vector-geometry-delta',
        'artifact:canonical-vector-transform-delta',
        'artifact:hierarchy-preserving-transform-delta',
        'outer feature or finite common-API transaction boundary',
        'ordinary mutation options'
      ],
      outputs: [
        'artifact:settled-vector-action',
        'artifact:rolled-back-vector-action',
        'artifact:vector-persistence-outcome'
      ],
      conditions: [
        'One intended gesture creates one intended Undo commit.',
        'One synchronous immediate update emits at most one ordered shared publication and is not republished at transaction end.',
        'Transform-only forward/inverse/publication evidence contains no point/control records and remains point-count independent.',
        'Accepted remote apply uses one remote Factory transaction, creates no local Undo, persistence, or echo publication.',
        'Persistence observes the committed detached canonical snapshot and does not redefine runtime success.'
      ],
      bypasses: [
        'A semantic no-op creates no journal, publication, or persistence work.',
        'Rollback reverses the complete action and produces no ordinary Undo entry.'
      ],
      allowedContributors: [
        '@asyra/factory transaction journal and shared channels',
        '@asyra/core persistence queue',
        'existing app collaboration remote-apply adapter',
        'canonical Props/Scene Tree mutation evidence'
      ],
      forbiddenContributors: [
        'Vector-specific parallel history',
        'Awareness transport for canonical transform',
        'Render/cache evidence in persistence',
        'point records in transform-only evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/features/__tests__',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/framework/rules/data-flow-and-transactions.md',
        'docs/ai/apps/asyra-design/modules/collaboration-reference.md',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#transactions-persistence-and-collaboration',
        '#valid-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'settle-vector-action'
    }
  ]

  const routes = [
    {
      id: 'legacy-document-to-migration',
      from: 'migrate-workspace-points-to-local',
      kind: 'terminal',
      predicate:
        'A valid legacy-version document is converted completely before the existing Core validation/apply route.',
      producedArtifacts: ['artifact:migrated-local-vector-document']
    },
    {
      id: 'migration-failure-terminal',
      from: 'migrate-workspace-points-to-local',
      kind: 'terminal',
      predicate:
        'Malformed legacy Vector data fails before canonical apply and produces no migrated prefix.',
      producedArtifacts: ['artifact:vector-migration-failure']
    },
    {
      id: 'local-geometry-to-render',
      from: 'author-local-vector-geometry',
      to: 'project-local-vector-render',
      kind: 'geometry',
      predicate:
        'A committed local geometry delta updates the complete derived Render snapshot.',
      producedArtifacts: ['artifact:canonical-local-vector-geometry-delta']
    },
    {
      id: 'local-geometry-to-settlement',
      from: 'author-local-vector-geometry',
      to: 'settle-vector-action',
      kind: 'canonical',
      predicate:
        'A non-empty local geometry mutation enters the ordinary transaction journal.',
      producedArtifacts: ['artifact:canonical-local-vector-geometry-delta']
    },
    {
      id: 'local-geometry-no-op-terminal',
      from: 'author-local-vector-geometry',
      kind: 'terminal',
      predicate:
        'An equal local point or handle edit terminates without canonical mutation.',
      producedArtifacts: ['artifact:local-vector-geometry-no-op']
    },
    {
      id: 'local-geometry-failure-terminal',
      from: 'author-local-vector-geometry',
      kind: 'terminal',
      predicate:
        'Invalid topology, identity, or finite-coordinate input fails before canonical mutation.',
      producedArtifacts: ['artifact:local-vector-geometry-failure']
    },
    {
      id: 'transform-to-render',
      from: 'apply-vector-element-transform',
      to: 'project-local-vector-render',
      kind: 'transform',
      predicate:
        'A committed transform delta uses the generic direct Render transform route.',
      producedArtifacts: ['artifact:canonical-vector-transform-delta']
    },
    {
      id: 'transform-to-settlement',
      from: 'apply-vector-element-transform',
      to: 'settle-vector-action',
      kind: 'canonical',
      predicate:
        'A non-empty transform mutation enters the ordinary transaction journal.',
      producedArtifacts: ['artifact:canonical-vector-transform-delta']
    },
    {
      id: 'transform-no-op-terminal',
      from: 'apply-vector-element-transform',
      kind: 'terminal',
      predicate:
        'An equal whole-element transform terminates without canonical mutation.',
      producedArtifacts: ['artifact:vector-transform-no-op']
    },
    {
      id: 'transform-failure-terminal',
      from: 'apply-vector-element-transform',
      kind: 'terminal',
      predicate:
        'Invalid transform input fails before canonical mutation.',
      producedArtifacts: ['artifact:vector-transform-failure']
    },
    {
      id: 'hierarchy-to-render',
      from: 'preserve-vector-hierarchy-transform',
      to: 'project-local-vector-render',
      kind: 'hierarchy',
      predicate:
        'An accepted hierarchy transform projects through the committed hierarchy and direct transform routes.',
      producedArtifacts: ['artifact:hierarchy-preserving-transform-delta']
    },
    {
      id: 'hierarchy-to-settlement',
      from: 'preserve-vector-hierarchy-transform',
      to: 'settle-vector-action',
      kind: 'canonical',
      predicate:
        'A non-empty hierarchy-preserving transform joins the existing intended transaction.',
      producedArtifacts: ['artifact:hierarchy-preserving-transform-delta']
    },
    {
      id: 'hierarchy-failure-terminal',
      from: 'preserve-vector-hierarchy-transform',
      kind: 'terminal',
      predicate:
        'Invalid hierarchy input fails before point-free hierarchy mutation begins.',
      producedArtifacts: ['artifact:hierarchy-transform-failure']
    },
    {
      id: 'render-to-interaction',
      from: 'project-local-vector-render',
      to: 'project-vector-editing-interaction',
      kind: 'projection',
      predicate:
        'The current transformed Render identity is available to hit, overlay, and inverse-coordinate queries.',
      producedArtifacts: ['artifact:transformed-vector-render-result']
    },
    {
      id: 'render-failure-terminal',
      from: 'project-local-vector-render',
      kind: 'terminal',
      predicate:
        'Missing or malformed local geometry fails closed without fallback projection.',
      producedArtifacts: ['artifact:vector-render-projection-failure']
    },
    {
      id: 'editing-intent-to-geometry',
      from: 'project-vector-editing-interaction',
      to: 'author-local-vector-geometry',
      kind: 'interaction',
      predicate:
        'A valid inverse-transformed point/handle intent enters the local geometry owner.',
      producedArtifacts: ['artifact:local-vector-edit-intent']
    },
    {
      id: 'editing-overlay-terminal',
      from: 'project-vector-editing-interaction',
      kind: 'terminal',
      predicate:
        'Current selection/path-edit state projects through the transformed local geometry.',
      producedArtifacts: ['artifact:vector-editing-overlay-result']
    },
    {
      id: 'interaction-no-hit-terminal',
      from: 'project-vector-editing-interaction',
      kind: 'terminal',
      predicate:
        'A pointer outside transformed local geometry terminates with no editable hit.',
      producedArtifacts: ['artifact:vector-interaction-no-hit']
    },
    {
      id: 'interaction-failure-terminal',
      from: 'project-vector-editing-interaction',
      kind: 'terminal',
      predicate:
        'A singular inverse or invalid interaction input fails closed without geometry mutation.',
      producedArtifacts: ['artifact:vector-interaction-failure']
    },
    {
      id: 'settlement-terminal',
      from: 'settle-vector-action',
      kind: 'terminal',
      predicate:
        'The ordinary transaction commits, publishes as configured, and queues persistence.',
      producedArtifacts: [
        'artifact:settled-vector-action',
        'artifact:vector-persistence-outcome'
      ]
    },
    {
      id: 'rollback-terminal',
      from: 'settle-vector-action',
      kind: 'terminal',
      predicate:
        'Validation, handler, timeout, or explicit rollback reverses the complete rollbackable action.',
      producedArtifacts: ['artifact:rolled-back-vector-action']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:migrated-local-vector-document',
      title: 'Complete new-version local-Vector document',
      ownerStepId: 'migrate-workspace-points-to-local',
      channel: 'Core app load-hook result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-migration-failure',
      title: 'Atomic app migration failure',
      ownerStepId: 'migrate-workspace-points-to-local',
      channel: 'thrown app migration error',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canonical-local-vector-geometry-delta',
      title: 'Canonical local Vector geometry delta',
      ownerStepId: 'author-local-vector-geometry',
      channel: 'Props/Scene Tree committed property patch',
      consumerStepIds: ['project-local-vector-render', 'settle-vector-action'],
      terminal: false
    },
    {
      id: 'artifact:local-vector-geometry-no-op',
      title: 'Local geometry no-op',
      ownerStepId: 'author-local-vector-geometry',
      channel: 'common-API return',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:local-vector-geometry-failure',
      title: 'Local geometry validation failure',
      ownerStepId: 'author-local-vector-geometry',
      channel: 'common-API throw/failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:canonical-vector-transform-delta',
      title: 'Point-free canonical Vector transform delta',
      ownerStepId: 'apply-vector-element-transform',
      channel: 'Props/Scene Tree committed scalar or batch delta',
      consumerStepIds: ['project-local-vector-render', 'settle-vector-action'],
      terminal: false
    },
    {
      id: 'artifact:vector-transform-no-op',
      title: 'Vector transform no-op',
      ownerStepId: 'apply-vector-element-transform',
      channel: 'common-API return',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-transform-failure',
      title: 'Vector transform validation failure',
      ownerStepId: 'apply-vector-element-transform',
      channel: 'common-API throw/failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:hierarchy-preserving-transform-delta',
      title: 'Hierarchy-preserving transform delta',
      ownerStepId: 'preserve-vector-hierarchy-transform',
      channel: 'Preset coordinated canonical property delta',
      consumerStepIds: ['project-local-vector-render', 'settle-vector-action'],
      terminal: false
    },
    {
      id: 'artifact:hierarchy-transform-failure',
      title: 'Hierarchy transform failure',
      ownerStepId: 'preserve-vector-hierarchy-transform',
      channel: 'Preset/Scene Tree failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:transformed-vector-render-result',
      title: 'Transformed local Vector Render result',
      ownerStepId: 'project-local-vector-render',
      channel: 'engine-neutral Render object and commands',
      consumerStepIds: ['project-vector-editing-interaction'],
      terminal: false
    },
    {
      id: 'artifact:vector-render-projection-failure',
      title: 'Fail-closed Vector projection failure',
      ownerStepId: 'project-local-vector-render',
      channel: 'Render projection outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:local-vector-edit-intent',
      title: 'Inverse-transformed local point/handle intent',
      ownerStepId: 'project-vector-editing-interaction',
      channel: 'app common-API input',
      consumerStepIds: ['author-local-vector-geometry'],
      terminal: false
    },
    {
      id: 'artifact:vector-editing-overlay-result',
      title: 'Transformed Vector selection/path-edit overlay',
      ownerStepId: 'project-vector-editing-interaction',
      channel: 'overlay Render commands',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-interaction-no-hit',
      title: 'No transformed Vector interaction target',
      ownerStepId: 'project-vector-editing-interaction',
      channel: 'query no-result',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-interaction-failure',
      title: 'Vector coordinate/projection failure',
      ownerStepId: 'project-vector-editing-interaction',
      channel: 'query failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:settled-vector-action',
      title: 'Committed Vector action outcome',
      ownerStepId: 'settle-vector-action',
      channel: 'Factory transaction outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:rolled-back-vector-action',
      title: 'Rolled-back Vector action outcome',
      ownerStepId: 'settle-vector-action',
      channel: 'Factory rollback outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-persistence-outcome',
      title: 'Independent Vector action persistence outcome',
      ownerStepId: 'settle-vector-action',
      channel: 'Core persistence queue',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'local-geometry-is-canonical',
      statement:
        'Every production Vector point/control is canonical local geometry; no runtime workspace-point owner or fallback remains.',
      stepIds: [
        'migrate-workspace-points-to-local',
        'author-local-vector-geometry',
        'project-local-vector-render',
        'project-vector-editing-interaction'
      ],
      artifactIds: [
        'artifact:migrated-local-vector-document',
        'artifact:canonical-local-vector-geometry-delta',
        'artifact:transformed-vector-render-result'
      ],
      specRefs: ['#canonical-coordinate-spaces', '#load-migration']
    },
    {
      id: 'transform-never-mutates-points',
      statement:
        'Whole-element and hierarchy transforms never patch, clone, or rebase Vector point/control records.',
      stepIds: [
        'apply-vector-element-transform',
        'preserve-vector-hierarchy-transform',
        'settle-vector-action'
      ],
      artifactIds: [
        'artifact:canonical-vector-transform-delta',
        'artifact:hierarchy-preserving-transform-delta',
        'artifact:settled-vector-action'
      ],
      specRefs: ['#element-transform', '#hierarchy']
    },
    {
      id: 'one-transform-one-projection',
      statement:
        'Render, hit, selection, gradient/stroke, and path editing consume one current affine transform over the same local geometry.',
      stepIds: [
        'project-local-vector-render',
        'project-vector-editing-interaction'
      ],
      artifactIds: [
        'artifact:transformed-vector-render-result',
        'artifact:vector-editing-overlay-result'
      ],
      specRefs: ['#rendering-and-caching', '#geometry-editing']
    },
    {
      id: 'action-semantics-stay-ordinary',
      statement:
        'Vector actions use the existing Factory/Core transaction, publication, remote-apply, and persistence owners without parallel history.',
      stepIds: ['apply-vector-element-transform', 'settle-vector-action'],
      artifactIds: [
        'artifact:canonical-vector-transform-delta',
        'artifact:settled-vector-action',
        'artifact:vector-persistence-outcome'
      ],
      specRefs: ['#transactions-persistence-and-collaboration']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'dense-vector-transform-cost',
      title: 'Dense Vector transform cost is point-count independent',
      assertions: [
        'A 7,000+ point Vector move/resize/rotate/scale/skew produces zero point record patches.',
        'The first 50 elements from the checked-in crdt-7076 cat-face fixture preserve the same point-free transform contract for real dense Vectors.',
        'A transform-only update executes zero Vector geometry strategies.',
        'The canonical transform write count is bounded independently of Vector point count.'
      ],
      stepIds: [
        'apply-vector-element-transform',
        'project-local-vector-render',
        'settle-vector-action'
      ],
      specRefs: ['#valid-cases', '#definition-of-done']
    },
    {
      id: 'transformed-editing-parity',
      title: 'Transformed editing parity',
      assertions: [
        'Point and handle hit after transform or Group nesting agrees with the visible transformed overlay.',
        'Dragging a transformed point or handle updates only the intended local records.',
        'Forward and inverse transforms round-trip the edited local coordinate within the accepted tolerance.'
      ],
      stepIds: [
        'author-local-vector-geometry',
        'project-local-vector-render',
        'project-vector-editing-interaction'
      ],
      specRefs: ['#valid-cases', '#definition-of-done']
    },
    {
      id: 'migration-atomicity',
      title: 'Migration atomicity and exact preservation',
      assertions: [
        'A valid legacy document converts once with identity, style, hierarchy, and topology parity.',
        'Malformed legacy Vector data fails before canonical apply without a partially migrated prefix.',
        'The new document version has no runtime workspace-coordinate fallback.'
      ],
      stepIds: ['migrate-workspace-points-to-local'],
      specRefs: ['#load-migration', '#definition-of-done']
    },
    {
      id: 'hierarchy-history-collaboration-parity',
      title: 'Hierarchy, history, and collaboration parity',
      assertions: [
        'Group and reparent preserve the Vector world-space result without patching point or handle records.',
        'Undo and Redo restore the complete transform as one intended action.',
        'Immediate publication, accepted remote apply, and persistence preserve existing owners while transform evidence remains point-free.'
      ],
      stepIds: [
        'apply-vector-element-transform',
        'preserve-vector-hierarchy-transform',
        'settle-vector-action'
      ],
      specRefs: [
        '#hierarchy',
        '#transactions-persistence-and-collaboration',
        '#definition-of-done'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'vector-local-geometry-transform',
      kind: 'feature',
      title: 'Asyra Design Vector Local Geometry Transform Inspector',
      subtitle:
        'Stable local Vector geometry through transform-only element, hierarchy, Render, interaction, and settlement routes.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design product contract',
      inspectorOwner: 'Asyra Design Vector transform architecture'
    },
    links: [
      {
        id: 'product-contract',
        kind: 'authority',
        label: 'Active plan and product contract',
        href: './vector-local-geometry-transform-plan.md'
      },
      {
        id: 'render-delta-inspector',
        kind: 'retained-inspector',
        label: 'Retained Render Delta Update Inspector',
        href: '../../../framework/plans/render-delta-update-flow-inspector.data.cjs'
      },
      {
        id: 'migration-inspector',
        kind: 'retained-inspector',
        label: 'Retained App-level Migration Inspector',
        href: '../../../framework/plans/app-level-migration-flow-inspector.data.cjs'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  Object.freeze(data.schema)
  Object.freeze(data.target)
  Object.freeze(data.authority)
  data.links.forEach(Object.freeze)
  data.lanes.forEach(Object.freeze)
  data.steps.forEach((step) => {
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'cacheDimensions',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) => Object.freeze(step[field]))
    Object.freeze(step)
  })
  data.routes.forEach((route) => {
    Object.freeze(route.producedArtifacts)
    Object.freeze(route)
  })
  data.artifacts.forEach((artifact) => {
    Object.freeze(artifact.consumerStepIds)
    Object.freeze(artifact)
  })
  data.invariants.forEach((invariant) => {
    Object.freeze(invariant.stepIds)
    Object.freeze(invariant.artifactIds)
    Object.freeze(invariant.specRefs)
    Object.freeze(invariant)
  })
  data.acceptanceContracts.forEach((contract) => {
    Object.freeze(contract.assertions)
    Object.freeze(contract.stepIds)
    Object.freeze(contract.specRefs)
    Object.freeze(contract)
  })
  Object.freeze(data.links)
  Object.freeze(data.lanes)
  Object.freeze(data.steps)
  Object.freeze(data.routes)
  Object.freeze(data.artifacts)
  Object.freeze(data.invariants)
  Object.freeze(data.acceptanceContracts)
  Object.freeze(data)

  globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
