;(function () {
  'use strict'

  const specPath = 'docs/ai/apps/asyra-design/specs/stroke-engine/SPEC.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'

  const lanes = [
    { id: 'app-state', title: 'App And Canonical State', order: 1 },
    { id: 'integration', title: 'Integration', order: 2 },
    { id: 'stroke-engine', title: 'Stroke Engine', order: 3 },
    { id: 'render-output', title: 'Render Output', order: 4 }
  ]

  const steps = [
    {
      id: 'capture-stroke-intent',
      order: 1,
      laneId: 'app-state',
      title: 'Capture stroke intent',
      ownerPackage: 'apps/asyra-design',
      purpose:
        'Translate create, vector-edit, or stroke-property interaction into one explicit canonical mutation intent.',
      inputs: [
        'pointer, keyboard, tool, or property interaction',
        'feature session state'
      ],
      outputs: ['artifact:user-intent'],
      conditions: ['The app accepts a supported vector or stroke interaction.'],
      bypasses: ['No canonical write or stroke product geometry occurs here.'],
      allowedContributors: ['@asyra/feature-system', 'app property controls'],
      forbiddenContributors: ['renderer state', 'stroke product geometry'],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/features/**',
        'apps/asyra-design/src/properties/**'
      ],
      specRefs: ['#package-ownership-and-boundaries'],
      failureOwnerStepId: 'capture-stroke-intent'
    },
    {
      id: 'commit-canonical-stroke-change',
      order: 2,
      laneId: 'app-state',
      title: 'Commit canonical stroke change',
      ownerPackage: '@asyra/factory',
      purpose:
        'Validate the requested mutation and commit one canonical model transaction through the existing app/framework flow.',
      inputs: [
        'artifact:user-intent',
        'canonical topology/property schemas',
        'current canonical model'
      ],
      outputs: ['artifact:committed-stroke-change'],
      conditions: [
        'The requested topology or stroke-property mutation is valid.'
      ],
      bypasses: [
        'An invalid mutation is rejected without a model write or event.'
      ],
      allowedContributors: [
        'apps/asyra-design common APIs',
        '@asyra/props-manager',
        '@asyra/scene-tree'
      ],
      forbiddenContributors: [
        'stroke product geometry',
        'renderer-local state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/common-apis/**',
        'packages/factory/src/**',
        'packages/props-manager/src/**',
        'packages/scene-tree/src/**'
      ],
      specRefs: ['#asyra-design-and-framework-state-packages'],
      failureOwnerStepId: 'commit-canonical-stroke-change'
    },
    {
      id: 'publish-committed-stroke-change',
      order: 3,
      laneId: 'app-state',
      title: 'Publish committed change',
      ownerPackage: '@asyra/reactive-events',
      purpose:
        'Publish the completed canonical change after the transaction succeeds.',
      inputs: ['artifact:committed-stroke-change'],
      outputs: ['artifact:committed-stroke-event'],
      conditions: ['The canonical transaction committed successfully.'],
      bypasses: ['An aborted or rejected transaction publishes nothing.'],
      allowedContributors: [
        'factory transaction result',
        'scene-tree committed delta'
      ],
      forbiddenContributors: [
        'uncommitted preview state',
        'stroke product geometry'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/reactive-events/src/**'],
      specRefs: ['#asyra-design-and-framework-state-packages'],
      failureOwnerStepId: 'publish-committed-stroke-change'
    },
    {
      id: 'update-stroke-render-mirror',
      order: 4,
      laneId: 'integration',
      title: 'Update stroke render mirror',
      ownerPackage: '@asyra/render',
      purpose:
        'Apply the committed change to the renderer-independent mirror and map one source-local public engine input per active stroke.',
      inputs: [
        'artifact:committed-stroke-event',
        'current canonical vector/stroke data'
      ],
      outputs: [
        'artifact:stroke-mirror-update',
        'artifact:stroke-engine-input'
      ],
      conditions: [
        'Active strokes preserve explicit anchor continuity, network and region order, ascending stroke order, and the accepted canonical revision.',
        'Removed strokes remain explicit in the mirror update for pixel clearing.'
      ],
      bypasses: [
        'Removed strokes and zero-stroke elements require clearing but no engine evaluation.',
        'The mirror never constructs stroke product geometry.'
      ],
      allowedContributors: [
        'committed canonical data',
        'canonical topology/property/order to source-local engine-input adapter'
      ],
      forbiddenContributors: [
        'cap/join/dash construction',
        'final faces',
        'renderer pixels'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/render/src/stroke/mirror/**'],
      specRefs: [
        '#public-interface',
        '#asyra-design-and-framework-state-packages'
      ],
      failureOwnerStepId: 'update-stroke-render-mirror'
    },
    {
      id: 'invoke-registered-stroke-engine',
      order: 5,
      laneId: 'integration',
      title: 'Invoke registered stroke engine',
      ownerPackage: '@asyra/preset',
      purpose:
        'Invoke the registered default engine once per active stroke without changing its canonical input.',
      inputs: ['artifact:stroke-engine-input', 'registered stroke engine'],
      outputs: ['artifact:stroke-engine-invocation'],
      conditions: [
        'A registered default engine is required for every active stroke input.',
        'Missing registration is a fail-fast integration contract failure owned by this step; it must not silently skip invocation or preserve prior output as current.'
      ],
      bypasses: ['No active stroke input means no engine invocation.'],
      allowedContributors: [
        'render-strategy registration',
        'authored stroke ordering'
      ],
      forbiddenContributors: [
        'input repair',
        'stroke geometry',
        'pixel projection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/integrations/stroke-engine/**'
      ],
      specRefs: ['#asyrapreset'],
      failureOwnerStepId: 'invoke-registered-stroke-engine'
    },
    {
      id: 'build-canonical-stroke-outcome',
      order: 6,
      laneId: 'stroke-engine',
      title: 'Build canonical stroke outcome',
      ownerPackage: '@asyra/stroke-engine',
      purpose:
        'Validate input and produce exactly one immutable product, empty, rejected, or failed stroke outcome.',
      inputs: ['artifact:stroke-engine-invocation'],
      outputs: ['artifact:stroke-outcome'],
      conditions: [
        'Accepted supported per-region topology produces one non-overlapping canonical product for the authored stroke.',
        'Valid non-product input produces a declared empty outcome.',
        'Invalid or unsupported authored input produces a declared rejected outcome.',
        'An internal engine or canonical product-geometry mechanic failure during otherwise valid evaluation produces a declared failed outcome.'
      ],
      bypasses: [
        'No product family or alignment may fall back to another behavior.'
      ],
      allowedContributors: [
        'replaceable geometry mechanics',
        'canonical topology and stroke input'
      ],
      forbiddenContributors: [
        'Pixi/Canvas/WebGL/WebGPU rendering APIs',
        'app state',
        'prior pixels'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/stroke-engine/src/**'],
      specRefs: [
        '#supported-behavior',
        '#public-interface',
        '#forbidden-fallbacks-and-errors'
      ],
      failureOwnerStepId: 'build-canonical-stroke-outcome'
    },
    {
      id: 'build-shared-channel-result',
      order: 7,
      laneId: 'stroke-engine',
      title: 'Build shared channel result',
      ownerPackage: '@asyra/stroke-engine',
      purpose:
        'Atomically project render, hit, and export outputs from the same completed outcome and return the immutable public result.',
      inputs: ['artifact:stroke-outcome'],
      outputs: [
        'artifact:stroke-engine-result',
        'artifact:stroke-render-output',
        'artifact:stroke-hit-output',
        'artifact:stroke-export-output'
      ],
      conditions: [
        'Product channels share one product id and product-face order; hit and export preserve each matching face winding rule.',
        'Render entries and export output preserve the completed product paint.',
        'Empty, rejected, and failed outcomes emit three explicit empty channel outputs.',
        'If tessellation or any channel projection fails, the public result becomes failed: engine-failure, all three channel outputs are empty, and no partial product output is published.'
      ],
      bypasses: ['Hit and export never depend on pixel or GPU output.'],
      allowedContributors: [
        'artifact:stroke-outcome',
        'source-space mesh tessellation'
      ],
      forbiddenContributors: [
        'renderer pixels',
        'renderer-local path stroke',
        'upstream geometry repair'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/stroke-engine/src/**'],
      specRefs: ['#shared-product-and-channel-parity', '#public-interface'],
      failureOwnerStepId: 'build-shared-channel-result'
    },
    {
      id: 'project-stroke-pixels',
      order: 8,
      laneId: 'render-output',
      title: 'Project stroke pixels',
      ownerPackage: '@asyra/render',
      purpose:
        'Draw completed render entries and clear stale or removed stroke pixels without reconstructing product geometry.',
      inputs: [
        'artifact:stroke-render-output',
        'artifact:stroke-mirror-update',
        'render target and projection context'
      ],
      outputs: ['artifact:visible-stroke-output'],
      conditions: [
        'Product entries are projected by ascending strokeOrder, back-to-front.',
        'An active stroke update requires both artifact:stroke-mirror-update and a completed artifact:stroke-render-output.',
        'A removed or zero-stroke update clears from artifact:stroke-mirror-update alone and does not wait for artifact:stroke-render-output.',
        'Empty, rejected, failed, and removed strokes clear prior visible output for the accepted update.'
      ],
      bypasses: [
        'Hit and export remain complete without this step.',
        'Non-product overlays remain outside the product-stroke contract.'
      ],
      allowedContributors: [
        'renderer resources',
        'projection transform',
        'antialiasing and pixel composition'
      ],
      forbiddenContributors: [
        'path reconstruction',
        'cap/join/dash creation',
        'hit/export authority'
      ],
      cacheDimensions: [],
      implementationBoundary: ['packages/render/src/stroke/projection/**'],
      specRefs: ['#asyrarender', '#shared-product-and-channel-parity'],
      failureOwnerStepId: 'project-stroke-pixels'
    }
  ]

  const routes = [
    {
      id: 'intent-to-commit',
      from: 'capture-stroke-intent',
      to: 'commit-canonical-stroke-change',
      kind: 'normal',
      predicate: 'a supported app intent requests a canonical mutation',
      producedArtifacts: ['artifact:user-intent']
    },
    {
      id: 'commit-to-event',
      from: 'commit-canonical-stroke-change',
      to: 'publish-committed-stroke-change',
      kind: 'normal',
      predicate: 'the canonical transaction commits',
      producedArtifacts: ['artifact:committed-stroke-change']
    },
    {
      id: 'event-to-mirror',
      from: 'publish-committed-stroke-change',
      to: 'update-stroke-render-mirror',
      kind: 'normal',
      predicate:
        'the committed event affects vector topology or stroke properties',
      producedArtifacts: ['artifact:committed-stroke-event']
    },
    {
      id: 'mirror-to-preset',
      from: 'update-stroke-render-mirror',
      to: 'invoke-registered-stroke-engine',
      kind: 'normal',
      predicate: 'the mirror update contains an active stroke input',
      producedArtifacts: ['artifact:stroke-engine-input']
    },
    {
      id: 'mirror-update-to-render',
      from: 'update-stroke-render-mirror',
      to: 'project-stroke-pixels',
      kind: 'normal',
      predicate:
        'the update contains active or removed stroke state required for projection or clearing',
      producedArtifacts: ['artifact:stroke-mirror-update']
    },
    {
      id: 'preset-to-engine',
      from: 'invoke-registered-stroke-engine',
      to: 'build-canonical-stroke-outcome',
      kind: 'normal',
      predicate:
        'the registered engine is invoked with the unchanged active input',
      producedArtifacts: ['artifact:stroke-engine-invocation']
    },
    {
      id: 'outcome-to-channels',
      from: 'build-canonical-stroke-outcome',
      to: 'build-shared-channel-result',
      kind: 'normal',
      predicate: 'one product, empty, rejected, or failed outcome is complete',
      producedArtifacts: ['artifact:stroke-outcome']
    },
    {
      id: 'render-output-to-pixels',
      from: 'build-shared-channel-result',
      to: 'project-stroke-pixels',
      kind: 'normal',
      predicate:
        'the completed result contains product or explicit empty render output',
      producedArtifacts: ['artifact:stroke-render-output']
    },
    {
      id: 'hit-output-terminal',
      from: 'build-shared-channel-result',
      kind: 'terminal',
      predicate: 'the completed hit output is available to hit consumers',
      producedArtifacts: ['artifact:stroke-hit-output']
    },
    {
      id: 'export-output-terminal',
      from: 'build-shared-channel-result',
      kind: 'terminal',
      predicate: 'the completed export output is available to export consumers',
      producedArtifacts: ['artifact:stroke-export-output']
    },
    {
      id: 'engine-result-terminal',
      from: 'build-shared-channel-result',
      kind: 'terminal',
      predicate: 'the immutable public result returns from engine evaluation',
      producedArtifacts: ['artifact:stroke-engine-result']
    },
    {
      id: 'visible-output-terminal',
      from: 'project-stroke-pixels',
      kind: 'terminal',
      predicate: 'pixel projection and stale-output clearing complete',
      producedArtifacts: ['artifact:visible-stroke-output']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:user-intent',
      ownerStepId: 'capture-stroke-intent',
      consumerStepIds: ['commit-canonical-stroke-change'],
      channel: 'app',
      terminal: false
    },
    {
      id: 'artifact:committed-stroke-change',
      ownerStepId: 'commit-canonical-stroke-change',
      consumerStepIds: ['publish-committed-stroke-change'],
      channel: 'canonical-state',
      terminal: false
    },
    {
      id: 'artifact:committed-stroke-event',
      ownerStepId: 'publish-committed-stroke-change',
      consumerStepIds: ['update-stroke-render-mirror'],
      channel: 'event',
      terminal: false
    },
    {
      id: 'artifact:stroke-mirror-update',
      ownerStepId: 'update-stroke-render-mirror',
      consumerStepIds: ['project-stroke-pixels'],
      channel: 'integration',
      terminal: false
    },
    {
      id: 'artifact:stroke-engine-input',
      ownerStepId: 'update-stroke-render-mirror',
      consumerStepIds: ['invoke-registered-stroke-engine'],
      channel: 'integration',
      terminal: false
    },
    {
      id: 'artifact:stroke-engine-invocation',
      ownerStepId: 'invoke-registered-stroke-engine',
      consumerStepIds: ['build-canonical-stroke-outcome'],
      channel: 'integration',
      terminal: false
    },
    {
      id: 'artifact:stroke-outcome',
      ownerStepId: 'build-canonical-stroke-outcome',
      consumerStepIds: ['build-shared-channel-result'],
      channel: 'product',
      terminal: false
    },
    {
      id: 'artifact:stroke-engine-result',
      ownerStepId: 'build-shared-channel-result',
      consumerStepIds: [],
      channel: 'public-result',
      terminal: true
    },
    {
      id: 'artifact:stroke-render-output',
      ownerStepId: 'build-shared-channel-result',
      consumerStepIds: ['project-stroke-pixels'],
      channel: 'render',
      terminal: false
    },
    {
      id: 'artifact:stroke-hit-output',
      ownerStepId: 'build-shared-channel-result',
      consumerStepIds: [],
      channel: 'hit',
      terminal: true
    },
    {
      id: 'artifact:stroke-export-output',
      ownerStepId: 'build-shared-channel-result',
      consumerStepIds: [],
      channel: 'export',
      terminal: true
    },
    {
      id: 'artifact:visible-stroke-output',
      ownerStepId: 'project-stroke-pixels',
      consumerStepIds: [],
      channel: 'pixels',
      terminal: true
    }
  ]

  const allStepIds = steps.map((step) => step.id)

  const invariants = [
    {
      id: 'canonical-state-before-render',
      statement:
        'Only committed canonical state may reach the render mirror and stroke engine.',
      stepIds: allStepIds.slice(0, 6),
      artifactIds: [
        'artifact:committed-stroke-change',
        'artifact:committed-stroke-event',
        'artifact:stroke-engine-input'
      ],
      specRefs: ['#asyra-design-and-framework-state-packages']
    },
    {
      id: 'single-product-owner',
      statement:
        '@asyra/stroke-engine is the only owner of stroke product geometry.',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result'
      ],
      artifactIds: ['artifact:stroke-outcome'],
      specRefs: ['#asyrastroke-engine']
    },
    {
      id: 'preset-is-wiring-only',
      statement:
        'Preset registers and invokes the engine without changing canonical input or product geometry.',
      stepIds: ['invoke-registered-stroke-engine'],
      artifactIds: ['artifact:stroke-engine-invocation'],
      specRefs: ['#asyrapreset']
    },
    {
      id: 'shared-product-channels',
      statement:
        'Render, hit, and export share one completed product and face order; hit and export preserve matching face winding rules.',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result'
      ],
      artifactIds: [
        'artifact:stroke-outcome',
        'artifact:stroke-render-output',
        'artifact:stroke-hit-output',
        'artifact:stroke-export-output'
      ],
      specRefs: ['#shared-product-and-channel-parity']
    },
    {
      id: 'single-stroke-single-composition',
      statement:
        'One authored stroke is Boolean-composed into non-overlapping material and painted once before channel projection.',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result'
      ],
      artifactIds: ['artifact:stroke-outcome'],
      specRefs: ['#supported-behavior', '#shared-product-and-channel-parity']
    },
    {
      id: 'render-is-pixel-projection-only',
      statement:
        'Render consumes completed entries and never reconstructs product stroke geometry.',
      stepIds: ['project-stroke-pixels'],
      artifactIds: [
        'artifact:stroke-render-output',
        'artifact:visible-stroke-output'
      ],
      specRefs: ['#asyrarender']
    },
    {
      id: 'non-product-clears-all-channels',
      statement:
        'Empty, rejected, and failed active results provide explicit empty channel outputs for stale-output clearing.',
      stepIds: ['build-shared-channel-result', 'project-stroke-pixels'],
      artifactIds: [
        'artifact:stroke-engine-result',
        'artifact:stroke-render-output',
        'artifact:stroke-hit-output',
        'artifact:stroke-export-output'
      ],
      specRefs: ['#shared-product-and-channel-parity']
    },
    {
      id: 'no-product-fallback',
      statement:
        'No step substitutes alignment, geometry, prior output, pixels, or renderer-local strokes for a missing product.',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result',
        'project-stroke-pixels'
      ],
      artifactIds: [
        'artifact:stroke-outcome',
        'artifact:visible-stroke-output'
      ],
      specRefs: ['#forbidden-fallbacks-and-errors']
    },
    {
      id: 'no-declared-cache',
      statement:
        'No current step owns a retained candidate; profiling and an equivalence test are required before one is declared.',
      stepIds: allStepIds,
      artifactIds: [],
      specRefs: ['#authority', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'supported-behavior',
      title: 'Supported stroke behavior',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result'
      ],
      specRefs: ['#supported-behavior'],
      assertions: [
        'explicit continuity, per-region winding, alignment-specific dash fitting, gradient sampling, and stroke order produce the declared product',
        'one authored stroke contains no overlapping or duplicate-alpha material',
        'empty, invalid, unsupported, and engine-failure forms produce their declared non-product result'
      ]
    },
    {
      id: 'public-interface',
      title: 'Public input and output',
      stepIds: [
        'update-stroke-render-mirror',
        'invoke-registered-stroke-engine',
        'build-canonical-stroke-outcome',
        'build-shared-channel-result'
      ],
      specRefs: ['#public-interface'],
      assertions: [
        'one immutable result is returned for each active stroke input',
        'public topology carries explicit network and region order, anchor continuity, directed loops, and per-face winding rules',
        'public DTOs contain no renderer object or mutable engine state'
      ]
    },
    {
      id: 'package-boundaries',
      title: 'Package ownership and boundaries',
      stepIds: allStepIds,
      specRefs: ['#package-ownership-and-boundaries'],
      assertions: [
        'every step has one owner and uses only declared contributors',
        'app, preset, and render never create stroke product geometry'
      ]
    },
    {
      id: 'channel-parity',
      title: 'Shared product channel parity',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result',
        'project-stroke-pixels'
      ],
      specRefs: ['#shared-product-and-channel-parity'],
      assertions: [
        'product ids and face ordering agree across all channels; hit/export winding and render/export paint match the product',
        'hit and export are independent of pixels and render tessellation'
      ]
    },
    {
      id: 'canonical-product-cases',
      title: 'Canonical formal and visual cases',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result',
        'project-stroke-pixels'
      ],
      specRefs: ['#canonical-product-cases'],
      assertions: [
        'every listed case has a source-space oracle and required downstream evidence'
      ]
    },
    {
      id: 'forbidden-fallbacks',
      title: 'Forbidden fallbacks and errors',
      stepIds: [
        'build-canonical-stroke-outcome',
        'build-shared-channel-result',
        'project-stroke-pixels'
      ],
      specRefs: ['#forbidden-fallbacks-and-errors'],
      assertions: [
        'invalid, unsupported, and internal failure paths publish no substitute or stale product'
      ]
    },
    {
      id: 'definition-of-done',
      title: 'Definition of Done',
      stepIds: allStepIds,
      specRefs: ['#definition-of-done'],
      assertions: [
        'all ten product, integration, visual, failure, profiling, build, and test gates pass'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'stroke-engine',
      kind: 'feature',
      title: 'Stroke Engine Inspector Flow',
      subtitle:
        'Thin ownership and handoff map for canonical stroke products and their render, hit, and export projections.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'SPEC.md',
      inspectorOwner: 'stroke-flow-inspector.data.js'
    },
    links: [
      {
        id: 'product-spec',
        label: 'Stroke Engine Product Contract',
        href: '../../specs/stroke-engine/SPEC.md',
        kind: 'authority'
      },
      {
        id: 'inspector-data',
        label: 'Inspector Data',
        href: './stroke-flow-inspector.data.js',
        kind: 'source'
      },
      {
        id: 'inspector-readiness-rule',
        label: 'Inspector Contract Readiness',
        href: '../../../../framework/rules/inspector-contract-readiness.md',
        kind: 'framework'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../../../../framework/plans/flow-inspector-dashboard-plan.md',
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
