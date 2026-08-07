;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/completed/vector-local-geometry-transform-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-flow-inspector.data.cjs'

  const lanes = [
    { id: 'canonical', title: 'Existing Canonical Transform', order: 1 },
    { id: 'projection', title: 'Retained Render Geometry', order: 2 },
    { id: 'interaction', title: 'Visible Interaction', order: 3 },
    { id: 'settlement', title: 'Existing Action Settlement', order: 4 }
  ]

  const steps = [
    {
      id: 'apply-vector-element-transform',
      order: 1,
      laneId: 'canonical',
      title: 'Apply bounded existing element values',
      ownerPackage: 'Design App element common API',
      purpose:
        'Apply a whole-element Vector transform through existing scalar/dimension values with no point or handle record mutation.',
      inputs: [
        'validated existing position, dimension, rotation, scale, skew, or hierarchy intent',
        'current canonical element values',
        'current outer feature transaction options'
      ],
      outputs: [
        'artifact:canonical-vector-transform-delta',
        'artifact:vector-transform-no-op',
        'artifact:vector-transform-failure'
      ],
      conditions: [
        'A whole-element transform writes only the existing constant-size element values required by the action.',
        'No point or handle record is set, replaced, removed, cloned, or rebased by the transform.',
        'Mutation and shared payload size remain independent of Vector point count.',
        'Mixed selections and hierarchy actions retain their existing transaction and ordering contracts.'
      ],
      bypasses: [
        'An equal transform produces no mutation or publication.',
        'Point, handle, topology, and style edits stay on their existing geometry-edit routes.'
      ],
      allowedContributors: [
        'move-elements and existing transform feature intent',
        'Design App element common API',
        'public Core plural property update APIs',
        'existing transaction mutation options'
      ],
      forbiddenContributors: [
        'Vector point or handle patch builders',
        'document migration or versioning',
        'feature-owned direct Props mutation',
        'Render cache used as canonical input'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/features/move-elements',
        'apps/asyra-design/src/common-apis/element',
        'apps/asyra-design/src/features/__tests__',
        'apps/asyra-design/src/common-apis/element/__tests__',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/plans/completed/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#whole-element-transform',
        '#slice-2-remove-the-rejected-databusiness-logic-path',
        '#valid-cases'
      ],
      failureOwnerStepId: 'apply-vector-element-transform'
    },
    {
      id: 'retain-vector-render-geometry',
      order: 1,
      laneId: 'projection',
      title: 'Retain engine-local geometry across transform deltas',
      ownerPackage: '@asyra/render with @asyra/preset Vector strategy',
      purpose:
        'Build engine-local Vector draw geometry from the existing complete render snapshot on a miss, then update transform-only deltas without executing the Vector geometry strategy.',
      inputs: [
        'artifact:canonical-vector-transform-delta',
        'existing complete canonical Vector render snapshot',
        'existing Render element identity and lifecycle',
        'registered generic transform-only property capability'
      ],
      outputs: [
        'artifact:transformed-vector-render-result',
        'artifact:vector-render-projection-failure'
      ],
      conditions: [
        'Preset accepts the existing persisted coordinate-space value and does not require a new canonical local marker.',
        'A geometry/style miss derives engine-local draw geometry without writing canonical or app state.',
        'The generic transform-only property capability updates the existing Render object without executing Vector geometry strategy.',
        'Point, handle, topology, fill, or stroke changes invalidate the matching retained projection and rebuild from one complete snapshot.',
        'Removal, reload, projection failure, and renderer teardown release retained geometry.',
        'Delta-updated and fresh projections of the same persisted geometry plus current element values are equivalent.'
      ],
      bypasses: [
        'A transform-only delta bypasses geometry strategy execution but not the ordinary committed Render projection.',
        'A geometry/style cache miss runs the ordinary complete-snapshot strategy once.'
      ],
      allowedContributors: [
        '@asyra/render complete snapshot mirror, strategy registry, and Render-object lifecycle',
        '@asyra/preset Vector strategy and style helpers',
        '@asyra/render-engine transform contract',
        '@asyra/render-engine-pixi concrete display-object application'
      ],
      forbiddenContributors: [
        'Pixi imports outside @asyra/render-engine-pixi',
        'Vector-specific delta classification in Preset subscription routing',
        'migration, persisted cache fields, or app-owned duplicate geometry',
        'diagnostic, fallback, or fixture-specific visible geometry'
      ],
      cacheDimensions: [
        'element identity',
        'geometry/topology/style snapshot identity or revision',
        'renderer instance lifecycle'
      ],
      implementationBoundary: [
        'packages/render/src',
        'packages/render-engine/src',
        'packages/render-engine-pixi/src',
        'packages/preset/src/components',
        'packages/preset/src/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/playwright.config.ts',
        'apps/asyra-design/__tests__/playwright-config.test.mjs',
        'apps/asyra-design/samples/crdt-7076',
        'apps/asyra-design/src/config',
        'apps/asyra-design/e2e/crdt-7076-render.spec.ts',
        'apps/asyra-design/e2e/render-delta-performance.spec.ts',
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/packages/render-engine.md',
        'docs/ai/framework/packages/render-engine-pixi.md',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/apps/asyra-design/plans/completed/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#render-geometry-projection-and-cache',
        '#cache-contract',
        '#slice-3-render-retained-geometry-and-direct-transform-route'
      ],
      failureOwnerStepId: 'retain-vector-render-geometry'
    },
    {
      id: 'project-vector-interaction',
      order: 1,
      laneId: 'interaction',
      title: 'Keep visible and interactive projection aligned',
      ownerPackage:
        '@asyra/render, @asyra/preset, and the existing Design App Vector interaction adapter',
      purpose:
        'Project hit geometry, bounds, selection, stroke/fill, and path-edit overlays from the same current Render result without redefining canonical Vector data.',
      inputs: [
        'artifact:transformed-vector-render-result',
        'current selection and path-edit state',
        'existing canonical Vector edit data'
      ],
      outputs: [
        'artifact:vector-interaction-result',
        'artifact:vector-interaction-failure'
      ],
      conditions: [
        'Visible geometry, hit results, bounds, selection, and path-edit overlays agree after transform.',
        'A later geometry/style rebuild remains aligned with the current element transform.',
        'Existing point and handle editing inputs remain workspace-valued; Render forward projection supplies visible reads and inverse projection supplies the existing stored-coordinate writes.',
        'A geometry-bounds change adjusts existing element transform values so edited and unchanged points retain their intended visible positions.',
        'Undo and Redo refresh the selected Vector point compatibility mirror only after the already-demanded Render frame completes its frame-aligned geometry projection.',
        'Render-derived geometry is never used as canonical edit data.'
      ],
      bypasses: [
        'A pointer outside current visible geometry produces the existing no-hit result.',
        'No active selection or path-edit state emits no overlay.'
      ],
      allowedContributors: [
        '@asyra/render engine-neutral element projection',
        '@asyra/preset selection and path-edit render layers',
        'Design App existing Vector common-API coordinate adapter',
        'existing canonical Selection and System Context state'
      ],
      forbiddenContributors: [
        'UI-owned duplicate Vector geometry',
        'Render cache written to Props, Undo, or collaboration',
        'fixture-specific hit or overlay output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src',
        'packages/preset/src/render-layers',
        'packages/preset/src/__tests__',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts',
        'apps/asyra-design/src/common-apis/element/__tests__/vector-parent-creation.test.ts',
        'apps/asyra-design/src/init/derived-state/init-selection-compatibility.ts',
        'apps/asyra-design/src/init/__tests__/init-selection-compatibility.test.ts',
        'apps/asyra-design/src/features/pen-tool',
        'apps/asyra-design/e2e/properties.spec.ts',
        'apps/asyra-design/e2e/pen-tool.spec.ts',
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'docs/ai/apps/asyra-design/plans/completed/vector-local-geometry-transform-plan.md'
      ],
      specRefs: [
        '#engine-boundary',
        '#geometry-editing',
        '#slice-4-interaction-staged-history-settlement-e2e-and-visual-closure'
      ],
      failureOwnerStepId: 'project-vector-interaction'
    },
    {
      id: 'settle-vector-action',
      order: 1,
      laneId: 'settlement',
      title: 'Settle through existing action owners',
      ownerPackage:
        'Design App move-elements feature with @asyra/factory and Core persistence',
      purpose:
        'Settle the point-free canvas drag through opt-in first-before/latest-after History staging, ordinary rollback, publication, remote apply, and persistence without storing Render cache state.',
      inputs: [
        'artifact:canonical-vector-transform-delta',
        'outer feature or finite common-API transaction boundary',
        'explicit gesture-keyed replace-latest History option',
        'complete owner-issued History candidate bundle'
      ],
      outputs: [
        'artifact:settled-vector-action',
        'artifact:rolled-back-vector-action',
        'artifact:vector-persistence-outcome'
      ],
      conditions: [
        'A completed or commit-current interrupted canvas drag creates exactly one Undo commit from the first complete owner-issued before bundle and latest complete owner-issued after bundle.',
        'Each canonical pointer sample remains immediately available to computed data, Render, and collaboration while Factory replaces only the latest staged History bundle reference.',
        'Ordinary mutations without the explicit staging option retain append-only History semantics.',
        'Staged History control metadata is local-only and never enters canonical payloads, collaboration wire data, persistence, or replay payloads.',
        'Child-only drag finalization contains only the explicit moved targets and does not invoke ancestor Group normalization, rebase siblings, or append Group property changes.',
        'Explicit Group/Ungroup or identity-preserving reparent remains owned by its separate hierarchy operation and transaction contract.',
        'Transform forward, rollback, publication, and persistence evidence contains no point or handle records.',
        'Accepted remote apply creates no local Undo, persistence echo, or publication echo.',
        'Persistence stores the ordinary unchanged-schema canonical snapshot and never stores Render cache state.'
      ],
      bypasses: [
        'A semantic no-op creates no journal, publication, or persistence work.',
        'Rollback reverses the complete rollbackable action.'
      ],
      allowedContributors: [
        'Design App move-elements feature mutation options',
        '@asyra/factory transaction journal and shared channels',
        '@asyra/core persistence queue',
        'existing collaboration remote-apply adapter',
        'canonical Props and Scene Tree mutation evidence'
      ],
      forbiddenContributors: [
        'per-element pending-History merge on each pointer sample',
        'implicit coalescing for ordinary transactions',
        'Vector-specific parallel history',
        'document migration or version transition',
        'Render geometry or cache evidence in persistence',
        'point or handle records in transform-only evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/features/move-elements',
        'apps/asyra-design/src/features/__tests__',
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'packages/utils/src/types/change.ts',
        'packages/reactive-events/src/app/events.ts',
        'packages/factory/src',
        'packages/factory/src/__tests__',
        'packages/props-manager/src',
        'packages/props-manager/src/__tests__',
        'docs/ai/framework/rules/data-flow-and-transactions.md',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/plans/transaction-flow-inspector.data.cjs',
        'docs/ai/apps/asyra-design/modules/collaboration-reference.md',
        'docs/ai/apps/asyra-design/features/move-elements.md',
        'docs/ai/apps/asyra-design/plans/completed/vector-local-geometry-transform-plan.md'
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
      id: 'transform-to-render',
      from: 'apply-vector-element-transform',
      to: 'retain-vector-render-geometry',
      kind: 'transform',
      predicate:
        'A committed existing-value transform delta enters the generic direct Render property route.',
      producedArtifacts: ['artifact:canonical-vector-transform-delta']
    },
    {
      id: 'transform-to-settlement',
      from: 'apply-vector-element-transform',
      to: 'settle-vector-action',
      kind: 'canonical',
      predicate:
        'A non-empty canvas drag delta enters the existing rollback journal and the explicit replace-latest History stage.',
      producedArtifacts: ['artifact:canonical-vector-transform-delta']
    },
    {
      id: 'transform-no-op-terminal',
      from: 'apply-vector-element-transform',
      kind: 'terminal',
      predicate: 'An equal transform ends without canonical mutation.',
      producedArtifacts: ['artifact:vector-transform-no-op']
    },
    {
      id: 'transform-failure-terminal',
      from: 'apply-vector-element-transform',
      kind: 'terminal',
      predicate: 'Invalid transform input fails before canonical mutation.',
      producedArtifacts: ['artifact:vector-transform-failure']
    },
    {
      id: 'render-to-interaction',
      from: 'retain-vector-render-geometry',
      to: 'project-vector-interaction',
      kind: 'projection',
      predicate:
        'The current retained or freshly rebuilt Render result supplies visible and interactive projection.',
      producedArtifacts: ['artifact:transformed-vector-render-result']
    },
    {
      id: 'render-failure-terminal',
      from: 'retain-vector-render-geometry',
      kind: 'terminal',
      predicate:
        'Invalid projection fails closed and releases the affected Render geometry.',
      producedArtifacts: ['artifact:vector-render-projection-failure']
    },
    {
      id: 'interaction-result-terminal',
      from: 'project-vector-interaction',
      kind: 'terminal',
      predicate:
        'Visible geometry, hit, bounds, selection, and path-edit output agree.',
      producedArtifacts: ['artifact:vector-interaction-result']
    },
    {
      id: 'interaction-failure-terminal',
      from: 'project-vector-interaction',
      kind: 'terminal',
      predicate:
        'Invalid interaction projection fails without canonical mutation.',
      producedArtifacts: ['artifact:vector-interaction-failure']
    },
    {
      id: 'settlement-terminal',
      from: 'settle-vector-action',
      kind: 'terminal',
      predicate:
        'The existing transaction commits, publishes as configured, and queues persistence.',
      producedArtifacts: [
        'artifact:settled-vector-action',
        'artifact:vector-persistence-outcome'
      ]
    },
    {
      id: 'rollback-terminal',
      from: 'settle-vector-action',
      kind: 'terminal',
      predicate: 'Rollback reverses the complete rollbackable action.',
      producedArtifacts: ['artifact:rolled-back-vector-action']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:canonical-vector-transform-delta',
      title: 'Point-free existing-value Vector transform delta',
      ownerStepId: 'apply-vector-element-transform',
      channel: 'Props/Scene Tree committed scalar or batch delta',
      consumerStepIds: ['retain-vector-render-geometry', 'settle-vector-action'],
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
      channel: 'common-API failure',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:transformed-vector-render-result',
      title: 'Retained or freshly rebuilt Vector Render result',
      ownerStepId: 'retain-vector-render-geometry',
      channel: 'engine-neutral Render object and commands',
      consumerStepIds: ['project-vector-interaction'],
      terminal: false
    },
    {
      id: 'artifact:vector-render-projection-failure',
      title: 'Fail-closed Vector projection failure',
      ownerStepId: 'retain-vector-render-geometry',
      channel: 'Render projection outcome',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-interaction-result',
      title: 'Aligned Vector visible and interactive result',
      ownerStepId: 'project-vector-interaction',
      channel: 'Render and overlay commands',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:vector-interaction-failure',
      title: 'Vector interaction projection failure',
      ownerStepId: 'project-vector-interaction',
      channel: 'query or overlay failure',
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
      title: 'Existing-schema persistence outcome',
      ownerStepId: 'settle-vector-action',
      channel: 'Core persistence queue',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'persisted-data-remains-unchanged',
      statement:
        'This task adds no document migration, version, canonical local marker, persisted cache, or geometry value rewrite.',
      stepIds: [
        'apply-vector-element-transform',
        'retain-vector-render-geometry',
        'settle-vector-action'
      ],
      artifactIds: [
        'artifact:canonical-vector-transform-delta',
        'artifact:transformed-vector-render-result',
        'artifact:vector-persistence-outcome'
      ],
      specRefs: [
        '#persisted-vector-data-stays-unchanged',
        '#explicit-exclusions'
      ]
    },
    {
      id: 'transform-never-mutates-points',
      statement:
        'Whole-element transforms never patch, clone, or rebase Vector point or handle records.',
      stepIds: ['apply-vector-element-transform', 'settle-vector-action'],
      artifactIds: [
        'artifact:canonical-vector-transform-delta',
        'artifact:settled-vector-action'
      ],
      specRefs: ['#whole-element-transform', '#definition-of-done']
    },
    {
      id: 'render-cache-is-derived',
      statement:
        'Retained engine-local geometry is Render-owned derived projection with exact invalidation and a complete-snapshot miss path.',
      stepIds: ['retain-vector-render-geometry'],
      artifactIds: ['artifact:transformed-vector-render-result'],
      specRefs: ['#render-geometry-projection-and-cache', '#cache-contract']
    },
    {
      id: 'visible-interaction-parity',
      statement:
        'Visible geometry, hit, bounds, selection, and path-edit overlays consume the same current Render result.',
      stepIds: ['retain-vector-render-geometry', 'project-vector-interaction'],
      artifactIds: [
        'artifact:transformed-vector-render-result',
        'artifact:vector-interaction-result'
      ],
      specRefs: ['#engine-boundary', '#geometry-editing']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'dense-vector-transform-cost',
      title: 'Dense Vector transform cost is point-count independent',
      assertions: [
        'A 7,001-point Vector transform produces zero point or handle record patches.',
        'The complete checked-in crdt-7076 fixture loads unchanged, renders all Vectors, and its densest Vector preserves the same point-free transform contract.',
        'A transform-only update executes zero Vector geometry strategies.',
        'Canonical write and publication size stay bounded independently of point count.'
      ],
      stepIds: [
        'apply-vector-element-transform',
        'retain-vector-render-geometry',
        'settle-vector-action'
      ],
      specRefs: ['#valid-cases', '#definition-of-done']
    },
    {
      id: 'cache-miss-equivalence',
      title: 'Retained delta and fresh projection are equivalent',
      assertions: [
        'Transform-only deltas reuse the existing Render geometry.',
        'Geometry or style changes invalidate and rebuild exactly once from the complete snapshot.',
        'Delta-updated and fresh results have equivalent draw operations, bounds, hit results, overlays, and visible output.'
      ],
      stepIds: ['retain-vector-render-geometry', 'project-vector-interaction'],
      specRefs: ['#cache-contract', '#definition-of-done']
    },
    {
      id: 'existing-data-and-settlement-parity',
      title: 'Existing data and action settlement remain authoritative',
      assertions: [
        'Existing documents and the crdt-7076 sample require no migration or value rewrite.',
        'One completed or commit-current canvas drag creates one Undo action from complete first-before and latest-after bundles.',
        'A child-only Vector drag does not add ancestor Group normalization, sibling rebasing, or Group-sized publication.',
        'Undo, Redo, persistence, publication, and accepted remote apply keep their existing owners.',
        'No Render cache state enters canonical action evidence.'
      ],
      stepIds: ['apply-vector-element-transform', 'settle-vector-action'],
      specRefs: [
        '#persisted-vector-data-stays-unchanged',
        '#transactions-persistence-and-collaboration',
        '#definition-of-done'
      ]
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'vector-render-geometry-cache-transform',
      kind: 'feature',
      title: 'Design App Vector Render Geometry Cache Inspector',
      subtitle:
        'Unchanged persisted Vector data through bounded transform, retained Render geometry, interaction, and settlement routes.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Design App product contract',
      inspectorOwner: 'Render-owned Vector geometry projection architecture'
    },
    links: [
      {
        id: 'product-contract',
        kind: 'authority',
        label: 'Completed plan and product contract',
        href: './completed/vector-local-geometry-transform-plan.md'
      },
      {
        id: 'render-delta-inspector',
        kind: 'retained-inspector',
        label: 'Retained Render Delta Update Inspector',
        href: '../../../framework/plans/render-delta-update-flow-inspector.data.cjs'
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
