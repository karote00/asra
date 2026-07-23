;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/canvas-pipeline-debugger-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Development Runtime', order: 1 },
    { id: 'core', title: 'Core Diagnostic Facade', order: 2 },
    { id: 'render', title: 'Canonical Render Pipeline', order: 3 },
    { id: 'debugger', title: 'Diagnostic Projection', order: 4 }
  ]

  const steps = [
    {
      id: 'bootstrap-dev-debugger',
      order: 1,
      laneId: 'app',
      title: 'Bootstrap DEV debugger',
      ownerPackage: '@asyra/asyra-design',
      purpose:
        'Dynamically load the optional Core facade in development and expose one disabled runtime console handle.',
      inputs: ['Asyra Design DEV environment', 'explicit app-owned Core instance'],
      outputs: ['artifact:dev-session-request'],
      conditions: [
        'Only import the optional debugger subpath when import.meta.env.DEV is true.',
        'Expose the handle independently from __AsyraE2E__ and dispose it during HMR replacement.'
      ],
      bypasses: [
        'Production builds bypass the import, session creation, console handle, trace, and overlay completely.'
      ],
      allowedContributors: [
        '@asyra/core/canvas-pipeline-debugger public API',
        'Asyra Design DEV bootstrap',
        'the app-owned Core instance'
      ],
      forbiddenContributors: [
        '__AsyraE2E__',
        '@asyra/render/canvas-pipeline-debugger direct app import',
        'Pixi or concrete-engine imports',
        'production environment detection inside framework packages'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/diagnostics/**',
        'apps/asyra-design/src/types.d.ts',
        'apps/asyra-design/src/init/__tests__/**',
        'apps/asyra-design/package.json',
        'apps/asyra-design/tsconfig.json',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md'
      ],
      specRefs: [
        '#product-contract',
        '#package-ownership-and-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'bootstrap-dev-debugger'
    },
    {
      id: 'control-debug-session',
      order: 1,
      laneId: 'core',
      title: 'Control debugger session',
      ownerPackage: '@asyra/core/canvas-pipeline-debugger',
      purpose:
        'Validate the public options, bind one explicit Core and Render instance, and route lifecycle and layer registration through the Core facade.',
      inputs: [
        'artifact:dev-session-request',
        'artifact:debugger-read-model',
        'artifact:debug-overlay-fault',
        'explicit createCanvasPipelineDebugger(core, options) request'
      ],
      outputs: [
        'artifact:debug-session-binding',
        'artifact:debug-session-fault'
      ],
      conditions: [
        'At most one non-disposed debugger session may own a Render instance.',
        'Registration and unregistration use core.registerRenderLayer and core.unregisterRenderLayer.',
        'Disable preserves read data while dispose clears data and releases the active-session slot.',
        'An overlay fault is recorded through the trace projector before session cleanup begins.'
      ],
      bypasses: [
        'A disabled session has no Render observer and no registered overlay.',
        'A hidden overlay keeps trace observation active but has no registered debugger layer.'
      ],
      allowedContributors: [
        'Core public render-layer facade',
        'Core-owned Render instance',
        '@asyra/render/canvas-pipeline-debugger factory'
      ],
      forbiddenContributors: [
        'default Core singleton substitution for the passed instance',
        'app access to Core deps or Render internals',
        'document, undo, persistence, collaboration, or product-state writes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/package.json',
        'packages/core/tsconfig.json',
        'packages/core/src/canvas-pipeline-debugger/**',
        'packages/core/src/types/render.ts',
        'packages/core/src/__tests__/**',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md'
      ],
      specRefs: [
        '#public-contract',
        '#package-ownership-and-boundaries',
        '#runtime-and-cleanup-lifecycle'
      ],
      failureOwnerStepId: 'control-debug-session'
    },
    {
      id: 'observe-render-pipeline',
      order: 1,
      laneId: 'render',
      title: 'Observe canonical pipeline',
      ownerPackage: '@asyra/render',
      purpose:
        'Emit instance-bound, detached evidence at canonical element, viewport, layer, frame, and pre-engine handoff boundaries.',
      inputs: [
        'artifact:debug-session-binding',
        'canonical Render element and viewport input',
        'registered Render layers',
        'engine-neutral command before engine.execute'
      ],
      outputs: ['artifact:pipeline-evidence'],
      conditions: [
        'Layer registries and observers belong to one Render instance.',
        'Evidence is normalized before the engine call and contains no opaque handle or result.',
        'Focused detail is derived only from values already owned by the canonical Render pipeline.'
      ],
      bypasses: [
        'With no enabled observer, return before allocating diagnostic payload.',
        'A layer whose shouldUpdate returns false emits a bypassed outcome and no update result.',
        'Debugger-owned overlay commands are excluded from product pipeline evidence.'
      ],
      allowedContributors: [
        '@asyra/render canonical adapter and RenderObjectRuntime',
        '@asyra/render-engine command types',
        'per-instance Render layer registry'
      ],
      forbiddenContributors: [
        '@asyra/render-engine-pixi',
        'Pixi objects or concrete-engine branches',
        'engine queries, hit tests, results, or native handles',
        'Scene Tree or Props Manager fallback reads',
        'debug geometry used as canonical output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/package.json',
        'packages/render/src/render.ts',
        'packages/render/src/types/render-object.ts',
        'packages/render/src/types/render-layer.ts',
        'packages/render/src/registries/render-layer.ts',
        'packages/render/src/diagnostics/**',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: [
        '#supported-runtime-behavior',
        '#package-ownership-and-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'observe-render-pipeline'
    },
    {
      id: 'project-debug-trace',
      order: 1,
      laneId: 'debugger',
      title: 'Project bounded debug trace',
      ownerPackage: '@asyra/render/canvas-pipeline-debugger',
      purpose:
        'Convert observed evidence into the deterministic bounded trace, immutable snapshot, and focused expected-geometry model.',
      inputs: [
        'artifact:debug-session-binding',
        'artifact:pipeline-evidence',
        'artifact:debug-session-fault'
      ],
      outputs: ['artifact:debugger-read-model', 'artifact:debug-overlay-model'],
      conditions: [
        'Sequence is session-monotonic and capacity drops the oldest entry while incrementing dropped count.',
        'Focused ids are stable-deduplicated and unknown ids remain not-observed.',
        'Snapshots and returned traces are detached from mutable Render state.',
        'Snapshot fault retains the latest observation or overlay projection failure and clears on re-enable.'
      ],
      bypasses: [
        'A disabled session consumes no evidence and does not advance sequence.',
        'A hidden overlay still produces the read model but no overlay update is requested.'
      ],
      allowedContributors: [
        'artifact:pipeline-evidence',
        'session focus and capacity options',
        'engine-neutral Render math and drawing abstractions'
      ],
      forbiddenContributors: [
        'wall-clock time or random ids',
        'document-state reconstruction',
        'engine result or hit-test evidence',
        'fallback bounds or transforms'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/package.json',
        'packages/render/src/canvas-pipeline-debugger/**',
        'packages/render/src/__tests__/canvas-pipeline-debugger.test.ts',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: ['#public-contract', '#product-cases', '#definition-of-done'],
      failureOwnerStepId: 'project-debug-trace'
    },
    {
      id: 'manage-debug-overlay',
      order: 2,
      laneId: 'debugger',
      title: 'Manage optional overlay',
      ownerPackage: '@asyra/render/canvas-pipeline-debugger',
      purpose:
        'Create, update, unregister, and destroy a non-interactive expected-geometry Render layer from the projected overlay model.',
      inputs: [
        'artifact:debug-session-binding',
        'artifact:debug-overlay-model'
      ],
      outputs: [
        'artifact:debug-overlay-surface',
        'artifact:debug-overlay-fault'
      ],
      conditions: [
        'The runtime read model owns frame, layer outcome, handoff count, and dropped-count HUD data for console inspection.',
        'Focused geometry is drawn only when observed canonical bounds and transforms are available.',
        'The Render overlay uses existing graphics primitives and never adds engine text or DOM/Pixi fallback UI.',
        'Disable, hide, HMR, and dispose unregister and destroy all debugger-owned Render objects.',
        'An overlay projection fault reports through the Core session callback without fallback output.'
      ],
      bypasses: [
        'Disabled or hidden sessions have no registered debugger layer.',
        'Not-observed focused ids produce a HUD status only and no geometry.'
      ],
      allowedContributors: [
        'artifact:debug-overlay-model',
        'engine-neutral RenderContainer and RenderGraphics',
        'Core-supplied layer registration callbacks'
      ],
      forbiddenContributors: [
        'interaction-target registration',
        'Pixi imports or native objects',
        'DOM overlay or new engine text primitive',
        'debug output consumed by canonical render strategies',
        'fallback geometry for missing evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/canvas-pipeline-debugger/**',
        'packages/render/src/__tests__/canvas-pipeline-debugger.test.ts',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: [
        '#supported-runtime-behavior',
        '#runtime-and-cleanup-lifecycle',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'manage-debug-overlay'
    }
  ]

  const routes = [
    {
      id: 'request-dev-session',
      from: 'bootstrap-dev-debugger',
      to: 'control-debug-session',
      kind: 'runtime',
      predicate: 'DEV bootstrap requests a disabled debugger for its explicit Core.',
      producedArtifacts: ['artifact:dev-session-request']
    },
    {
      id: 'bind-render-observer',
      from: 'control-debug-session',
      to: 'observe-render-pipeline',
      kind: 'runtime',
      predicate: 'The session is enabled and not disposed.',
      producedArtifacts: ['artifact:debug-session-binding']
    },
    {
      id: 'bind-trace-projector',
      from: 'control-debug-session',
      to: 'project-debug-trace',
      kind: 'runtime',
      predicate: 'The session owns validated capacity and focus state.',
      producedArtifacts: ['artifact:debug-session-binding']
    },
    {
      id: 'bind-overlay-lifecycle',
      from: 'control-debug-session',
      to: 'manage-debug-overlay',
      kind: 'runtime',
      predicate:
        'The enabled session supplies Core layer registration callbacks and visible overlay state.',
      producedArtifacts: ['artifact:debug-session-binding']
    },
    {
      id: 'emit-pipeline-evidence',
      from: 'observe-render-pipeline',
      to: 'project-debug-trace',
      kind: 'data',
      predicate: 'An enabled observer reaches a declared canonical boundary.',
      producedArtifacts: ['artifact:pipeline-evidence']
    },
    {
      id: 'return-debugger-read-model',
      from: 'project-debug-trace',
      to: 'control-debug-session',
      kind: 'data',
      predicate: 'The app requests getSnapshot or getTrace.',
      producedArtifacts: ['artifact:debugger-read-model']
    },
    {
      id: 'project-overlay',
      from: 'project-debug-trace',
      to: 'manage-debug-overlay',
      kind: 'data',
      predicate: 'The enabled session has overlay visibility set to true.',
      producedArtifacts: ['artifact:debug-overlay-model']
    },
    {
      id: 'report-overlay-fault',
      from: 'manage-debug-overlay',
      to: 'control-debug-session',
      kind: 'runtime',
      predicate:
        'Overlay projection or diagnostic graphics update fails while the session is active.',
      producedArtifacts: ['artifact:debug-overlay-fault']
    },
    {
      id: 'project-overlay-fault',
      from: 'control-debug-session',
      to: 'project-debug-trace',
      kind: 'data',
      predicate:
        'Core records the overlay fault in the debugger read model before scheduling cleanup.',
      producedArtifacts: ['artifact:debug-session-fault']
    },
    {
      id: 'publish-overlay-surface',
      from: 'manage-debug-overlay',
      kind: 'terminal',
      predicate: 'The debugger layer is registered through Core and remains diagnostic-only.',
      producedArtifacts: ['artifact:debug-overlay-surface']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:dev-session-request',
      title: 'DEV session request',
      ownerStepId: 'bootstrap-dev-debugger',
      channel: 'direct optional-subpath call',
      terminal: false,
      consumerStepIds: ['control-debug-session']
    },
    {
      id: 'artifact:debug-session-binding',
      title: 'Validated instance-bound session',
      ownerStepId: 'control-debug-session',
      channel: 'Core diagnostic facade',
      terminal: false,
      consumerStepIds: [
        'observe-render-pipeline',
        'project-debug-trace',
        'manage-debug-overlay'
      ]
    },
    {
      id: 'artifact:pipeline-evidence',
      title: 'Detached pipeline evidence',
      ownerStepId: 'observe-render-pipeline',
      channel: 'instance-bound diagnostic observer',
      terminal: false,
      consumerStepIds: ['project-debug-trace']
    },
    {
      id: 'artifact:debugger-read-model',
      title: 'Bounded trace and immutable snapshot',
      ownerStepId: 'project-debug-trace',
      channel: 'debugger handle read API',
      terminal: false,
      consumerStepIds: ['control-debug-session']
    },
    {
      id: 'artifact:debug-overlay-model',
      title: 'Expected diagnostic overlay model',
      ownerStepId: 'project-debug-trace',
      channel: 'debugger-owned projection',
      terminal: false,
      consumerStepIds: ['manage-debug-overlay']
    },
    {
      id: 'artifact:debug-overlay-fault',
      title: 'Overlay diagnostic fault signal',
      ownerStepId: 'manage-debug-overlay',
      channel: 'Core session fault callback',
      terminal: false,
      consumerStepIds: ['control-debug-session']
    },
    {
      id: 'artifact:debug-session-fault',
      title: 'Contained debugger session fault',
      ownerStepId: 'control-debug-session',
      channel: 'Render debugger adapter fault report',
      terminal: false,
      consumerStepIds: ['project-debug-trace']
    },
    {
      id: 'artifact:debug-overlay-surface',
      title: 'Non-interactive diagnostic surface',
      ownerStepId: 'manage-debug-overlay',
      channel: 'Core-registered Render layer',
      terminal: true,
      consumerStepIds: []
    }
  ]

  const invariants = [
    {
      id: 'diagnostics-are-not-authority',
      statement:
        'No canonical product, persistence, interaction, export, or engine-selection path consumes debugger data.',
      stepIds: [
        'control-debug-session',
        'observe-render-pipeline',
        'project-debug-trace',
        'manage-debug-overlay'
      ],
      artifactIds: [
        'artifact:pipeline-evidence',
        'artifact:debugger-read-model',
        'artifact:debug-overlay-model'
      ],
      specRefs: ['#product-contract', '#package-ownership-and-boundaries']
    },
    {
      id: 'engine-neutral-stop-boundary',
      statement:
        'Observation stops at normalized pre-engine handoff data and never includes hit tests, handles, results, pixels, or Pixi.',
      stepIds: ['observe-render-pipeline', 'project-debug-trace'],
      artifactIds: ['artifact:pipeline-evidence'],
      specRefs: ['#supported-runtime-behavior']
    },
    {
      id: 'deterministic-session-lifecycle',
      statement:
        'Session ordering, capacity, instance isolation, enable, disable, hide, HMR, and disposal are deterministic and fully cleaned up.',
      stepIds: [
        'bootstrap-dev-debugger',
        'control-debug-session',
        'manage-debug-overlay'
      ],
      artifactIds: [
        'artifact:debug-session-binding',
        'artifact:debug-overlay-surface'
      ],
      specRefs: ['#runtime-and-cleanup-lifecycle', '#product-cases']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'runtime-developer-surface',
      title: 'Runtime developer surface',
      stepIds: [
        'bootstrap-dev-debugger',
        'control-debug-session',
        'project-debug-trace',
        'manage-debug-overlay'
      ],
      specRefs: ['#public-contract', '#product-cases'],
      assertions: [
        'A DEV app developer can enable, focus, inspect, disable, and dispose the debugger through the Core optional facade.'
      ]
    },
    {
      id: 'canonical-render-remains-independent',
      title: 'Canonical render independence',
      stepIds: [
        'observe-render-pipeline',
        'project-debug-trace',
        'manage-debug-overlay'
      ],
      specRefs: ['#product-contract', '#runtime-and-cleanup-lifecycle'],
      assertions: [
        'Disabled, hidden, faulted, and disposed debugger states cannot change canonical render input or output.'
      ]
    },
    {
      id: 'production-exclusion',
      title: 'Production exclusion',
      stepIds: ['bootstrap-dev-debugger'],
      specRefs: ['#product-cases', '#definition-of-done'],
      assertions: [
        'Asyra Design production wiring contains no optional debugger implementation or overlay chunk.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'canvas-pipeline-debugger',
      kind: 'system',
      title: 'Canvas Pipeline Debugger Inspector',
      subtitle:
        'DEV runtime observation from Core session control through canonical Render evidence and diagnostic-only projection.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Canvas Pipeline Debugger product contract',
      inspectorOwner: 'Canvas Pipeline Debugger Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/canvas-pipeline-debugger-plan.md',
        kind: 'framework'
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

  if (typeof globalThis !== 'undefined') {
    globalThis.FLOW_INSPECTOR_DATA = data
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
