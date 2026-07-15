;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/render-engine-boundary-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/render-engine-boundary-flow-inspector.data.cjs'

  const lanes = [
    { id: 'composition', title: 'Composition', order: 1 },
    { id: 'core', title: 'Core Lifecycle', order: 2 },
    { id: 'render', title: 'Render Adapter', order: 3 },
    { id: 'engine', title: 'Engine Implementation', order: 4 },
    { id: 'feature', title: 'Feature Decision', order: 5 }
  ]

  const steps = [
    {
      id: 'select-render-engine',
      order: 1,
      laneId: 'composition',
      title: 'Select render engine provider',
      ownerPackage: '@asyra/preset',
      purpose:
        'Install the Pixi engine factory by default or forward an explicit custom engine factory through the same startup boundary.',
      inputs: [
        'applyPreset(core) startup request',
        'optional custom engine factory implementing @asyra/render-engine'
      ],
      outputs: ['artifact:engine-provider-selection'],
      conditions: [
        'The compatibility applyPreset(core) path selects a fresh @asyra/render-engine-pixi engine factory for the target Render instance.',
        'An explicit custom engine factory replaces the Pixi default before Core startup without changing a non-render package.',
        'Preset selects and injects the provider but does not own the engine runtime or its resources.'
      ],
      bypasses: [
        'A direct Render class consumer may skip preset and inject an engine instance through the direct custom-engine route.'
      ],
      allowedContributors: [
        '@asyra/render-engine-pixi public factory',
        'explicit user-supplied RenderEngine factory',
        '@asyra/core render-engine injection facade'
      ],
      forbiddenContributors: [
        'production 3D or Hybrid engine selection',
        'render mode selection',
        'app-domain feature bundles',
        'engine singleton fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'packages/preset/package.json',
        'packages/preset/src/preset.ts',
        'packages/preset/src/types.ts',
        'packages/preset/src/__tests__/**',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/golden-paths/README.md',
        'docs/ai/framework/golden-paths/replace-render-engine.md'
      ],
      specRefs: [
        '#target-package-architecture',
        '#engine-injection',
        '#product-cases'
      ],
      failureOwnerStepId: 'select-render-engine'
    },
    {
      id: 'provide-custom-render-engine',
      order: 2,
      laneId: 'composition',
      title: 'Provide direct custom engine',
      ownerPackage: 'app or user composition',
      purpose:
        'Allow a direct Render consumer to inject one contract-compatible engine instance without preset or Pixi fallback.',
      inputs: ['user-owned RenderEngine instance'],
      outputs: ['artifact:direct-engine-provider'],
      conditions: [
        'The instance implements only the @asyra/render-engine public contract needed by current formal product cases.',
        'The consumer owns choosing the instance; the Render adapter owns using it for exactly that Render instance.'
      ],
      bypasses: [
        'The route is bypassed when preset supplies the default or explicit custom factory.'
      ],
      allowedContributors: [
        'user-owned RenderEngine implementation',
        '@asyra/render-engine public types',
        'Render constructor injection'
      ],
      forbiddenContributors: [
        '@asyra/render internals imported by the custom engine',
        'silent default Pixi singleton',
        'production 3D or Hybrid placeholder'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/types/renderer.ts',
        'packages/render/src/__tests__/**',
        'consumer-owned code outside this repository'
      ],
      specRefs: ['#engine-injection', '#scope', '#definition-of-done'],
      failureOwnerStepId: 'provide-custom-render-engine'
    },
    {
      id: 'start-render-runtime',
      order: 1,
      laneId: 'core',
      title: 'Start render runtime',
      ownerPackage: '@asyra/core',
      purpose:
        'Forward the framework surface container and render options to the configured Render adapter before loading state and publishing readiness.',
      inputs: ['Core.start(container, renderOptions) request'],
      outputs: ['artifact:render-start-request'],
      conditions: [
        'Core calls the configured framework renderer once and keeps persistence, feature initialization, and ready publication ordered after render initialization.',
        'Core remains unaware of Pixi resources and concrete engine methods.',
        'The app bootstrap configures only the engine-neutral @asyra/render framework render adapter before Core startup.'
      ],
      bypasses: [
        'A missing configured adapter or engine fails startup before data observers, features, or ready publication.'
      ],
      allowedContributors: [
        '@asyra/render framework-facing renderer contract',
        'app bootstrap configuration of the framework render adapter',
        'HTMLElement surface container',
        'engine-neutral RenderOptions'
      ],
      forbiddenContributors: [
        'pixi.js types or runtime',
        'app bootstrap concrete engine imports or Pixi-named adapter usage',
        'concrete engine capability introspection',
        'false ready fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/**',
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/render-app/index.tsx',
        'apps/asyra-design/src/render-app/__tests__/**',
        'docs/ai/framework/packages/core.md',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md'
      ],
      specRefs: ['#state-to-render-surface', '#engine-injection'],
      failureOwnerStepId: 'start-render-runtime'
    },
    {
      id: 'orchestrate-render-adapter',
      order: 1,
      laneId: 'render',
      title: 'Orchestrate render adapter',
      ownerPackage: '@asyra/render',
      purpose:
        'Own framework state synchronization, layer and strategy orchestration, opaque handle mapping, viewport behavior, and engine-neutral command dispatch.',
      inputs: [
        'artifact:render-engine-contract',
        'artifact:engine-provider-selection',
        'artifact:direct-engine-provider',
        'artifact:render-start-request',
        'artifact:pixi-engine-result',
        'artifact:custom-engine-result',
        'authoritative SceneTree, props, selection, system, load, replay, undo, redo, and local shared-projection changes'
      ],
      outputs: [
        'artifact:engine-command-stream',
        'artifact:render-target-handle-map',
        'artifact:render-adapter-init-outcome'
      ],
      conditions: [
        'Exactly one provider route supplies one engine instance per Render instance.',
        '@asyra/render imports @asyra/render-engine only and emits engine-neutral lifecycle, object, resource, draw, viewport, resize, flush, and destroy operations.',
        'State projection, registered layer ordering, render strategies, batching decisions, and framework target id to opaque handle mapping remain owned here.',
        'Load, undo, redo, persistence replay, and local shared projection enter through the same authoritative state synchronization route as ordinary committed state.',
        'Required capabilities are checked through contract identifiers and unsupported behavior fails without Pixi or custom-engine introspection.',
        'A successful concrete result is normalized before Core observes adapter initialization success.'
      ],
      bypasses: [
        'A layer whose shouldUpdate predicate is false emits no draw operations for that frame.',
        'A non-dirty frame does not flush a surface.',
        'A failed engine initialization produces a failed adapter outcome and no ready state.'
      ],
      allowedContributors: [
        '@asyra/render-engine contracts',
        'framework render layer and strategy registries',
        'render state stores and normalized state deltas',
        'opaque engine handles and normalized engine results'
      ],
      forbiddenContributors: [
        'Pixi imports, Pixi resource types, or Pixi-specific branches',
        '@asyra/render-engine-pixi imports',
        'authoritative scene, props, selection, or app-domain state',
        'fallback product output',
        '3D or Hybrid mode branches'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'turbo.json',
        'packages/render/package.json',
        'packages/render/src/index.ts',
        'packages/render/src/render.ts',
        'packages/render/src/renderer.ts',
        'packages/render/src/pixi-renderer.ts',
        'packages/render/src/types.ts',
        'packages/render/src/types/**',
        'packages/render/src/registries/**',
        'packages/render/src/stores/**',
        'packages/render/src/layers/**',
        'packages/render/src/strategies/**',
        'packages/render/src/fills/**',
        'packages/render/src/projections/**',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: [
        '#package-ownership',
        '#state-to-render-surface',
        '#abstract-engine-contract',
        '#capability-behavior'
      ],
      failureOwnerStepId: 'orchestrate-render-adapter'
    },
    {
      id: 'define-render-engine-contract',
      order: 1,
      laneId: 'engine',
      title: 'Define abstract engine contract',
      ownerPackage: '@asyra/render-engine',
      purpose:
        'Own the engine-independent lifecycle, command, handle, resource, result, event, capability, error, and contract-test types consumed by adapters and concrete engines.',
      inputs: [
        'current Pixi-backed product cases',
        'framework adapter and concrete engine handoff requirements'
      ],
      outputs: ['artifact:render-engine-contract'],
      conditions: [
        'The contract covers only initialize, resize, create, update, remove, draw, viewport, flush, interaction, capability, and destroy behavior required by current formal cases.',
        'Object and resource handles are opaque outside the implementing engine.',
        'Unsupported capabilities fail through an explicit contract error.',
        'The package exposes engine-independent contract-test utilities and no default runtime singleton.'
      ],
      bypasses: [
        'No concrete engine or Render adapter may bypass the contract with implementation-specific methods.'
      ],
      allowedContributors: [
        'plain TypeScript types and errors',
        'engine-independent fake and contract-test adapter',
        'current formal render product cases'
      ],
      forbiddenContributors: [
        'pixi.js, Three.js, DOM, or another engine SDK',
        'framework state subscriptions',
        'render layers or Feature behavior',
        'default engine singleton',
        'speculative 3D or Hybrid capability identifiers'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'turbo.json',
        'packages/render-engine/package.json',
        'packages/render-engine/tsconfig.json',
        'packages/render-engine/vitest.config.ts',
        'packages/render-engine/src/**',
        'docs/ai/framework/FRAMEWORK_ESSENTIALS.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/RUNTIME_MATRICES.md',
        'docs/ai/framework/CONSTRAINTS.md',
        'docs/ai/framework/CODING_STANDARDS.md',
        'docs/ai/framework/WORKFLOW.md',
        'docs/ai/framework/rules/import-boundaries.md',
        'docs/ai/framework/packages/README.md',
        'docs/ai/framework/packages/render-engine.md',
        'docs/ai/framework/decisions/releases/unreleased.md'
      ],
      specRefs: [
        '#package-ownership',
        '#abstract-engine-contract',
        '#capability-behavior'
      ],
      failureOwnerStepId: 'define-render-engine-contract'
    },
    {
      id: 'execute-render-engine',
      order: 2,
      laneId: 'engine',
      title: 'Execute Pixi engine contract',
      ownerPackage: '@asyra/render-engine-pixi',
      purpose:
        'Translate abstract commands into Pixi surface, graphics, resources, hit tests, events, and deterministic cleanup behind opaque handles.',
      inputs: [
        'artifact:render-engine-contract',
        'artifact:engine-command-stream',
        'artifact:adapter-destroy-command'
      ],
      outputs: [
        'artifact:pixi-engine-result',
        'artifact:pixi-interaction-event',
        'artifact:pixi-surface-output',
        'artifact:pixi-cleanup-result'
      ],
      conditions: [
        'The default engine executes only @asyra/render-engine commands and returns opaque handles, normalized results, and normalized interaction events.',
        'All Pixi Application, Container, Graphics, Mesh, texture, ticker, event, resource, hit-test, and cleanup behavior is owned here.',
        '@asyra/render-engine-pixi must not import @asyra/render or call product features.',
        'Destroy releases every owned Pixi resource after complete or partial initialization and returns a deterministic cleanup result.'
      ],
      bypasses: [
        'This step is bypassed when the selected provider is a custom engine.',
        'Unsupported capabilities fail explicitly and do not emit fallback surface output.',
        'A failed or partial initialization emits no successful surface or ready result.'
      ],
      allowedContributors: [
        'pixi.js',
        '@asyra/render-engine contracts',
        'Pixi-specific unit and contract-adapter tests'
      ],
      forbiddenContributors: [
        '@asyra/render imports',
        'framework state subscriptions',
        'render layer orchestration',
        'app-domain geometry or feature decisions',
        'custom-engine type introspection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'turbo.json',
        'packages/render-engine-pixi/package.json',
        'packages/render-engine-pixi/tsconfig.json',
        'packages/render-engine-pixi/vitest.config.ts',
        'packages/render-engine-pixi/src/**',
        'docs/ai/framework/packages/render-engine-pixi.md'
      ],
      specRefs: [
        '#package-ownership',
        '#state-to-render-surface',
        '#surface-interaction-to-feature',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'execute-render-engine'
    },
    {
      id: 'execute-custom-render-engine',
      order: 3,
      laneId: 'engine',
      title: 'Execute custom engine contract',
      ownerPackage: 'user RenderEngine implementation',
      purpose:
        'Execute the same abstract lifecycle, command, event, capability, and cleanup contract without changes in framework state owners.',
      inputs: [
        'artifact:render-engine-contract',
        'artifact:engine-command-stream',
        'artifact:adapter-destroy-command'
      ],
      outputs: [
        'artifact:custom-engine-result',
        'artifact:custom-interaction-event',
        'artifact:custom-surface-output',
        'artifact:custom-cleanup-result'
      ],
      conditions: [
        'The custom engine consumes the same @asyra/render-engine command stream and returns the same result and event shapes as the Pixi adapter.',
        'Each custom engine instance owns only its own opaque handles and resources.',
        'Destroy releases all engine-owned resources after complete or partial initialization.'
      ],
      bypasses: [
        'This step is bypassed when preset selects the default Pixi engine.',
        'Unsupported capabilities fail through the contract error and never fall back to Pixi.'
      ],
      allowedContributors: [
        '@asyra/render-engine public contract',
        'user-owned engine SDK',
        'engine-independent contract-test adapter'
      ],
      forbiddenContributors: [
        '@asyra/render internals',
        '@asyra/render-engine-pixi internals',
        'non-render framework package changes',
        'feature execution'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render-engine/src/testing/**',
        'packages/render/src/__tests__/**',
        'consumer-owned code outside this repository'
      ],
      specRefs: [
        '#abstract-engine-contract',
        '#engine-injection',
        '#product-cases'
      ],
      failureOwnerStepId: 'execute-custom-render-engine'
    },
    {
      id: 'bridge-render-interaction',
      order: 2,
      laneId: 'render',
      title: 'Bridge render interaction',
      ownerPackage: '@asyra/render',
      purpose:
        'Map a normalized engine event and opaque handle to a framework interaction target before publishing the existing render interaction event.',
      inputs: [
        'artifact:render-target-handle-map',
        'artifact:pixi-interaction-event',
        'artifact:custom-interaction-event'
      ],
      outputs: ['artifact:framework-render-interaction'],
      conditions: [
        'The selected engine returns an abstract event with an opaque engine handle before this step maps it to the framework interaction target.',
        'Pointer positions, capture, target ordering, and handler dispatch stay engine-neutral.',
        'The bridge publishes through the existing render interaction boundary and must not execute product features.'
      ],
      bypasses: [
        'An event without a mapped eligible target produces no framework target event.',
        'A captured pointer keeps its declared target until release or cancellation.'
      ],
      allowedContributors: [
        '@asyra/render-engine normalized interaction event',
        'opaque handle map owned by @asyra/render',
        'render interaction target and handler registries'
      ],
      forbiddenContributors: [
        'Pixi FederatedPointerEvent',
        'concrete engine target inspection',
        'direct feature calls',
        'authoritative selection mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'yarn.lock',
        'packages/render/package.json',
        'packages/render/src/render.ts',
        'packages/render/src/interaction/**',
        'packages/render/src/handlers/**',
        'packages/render/src/layers/scene/element-interaction-handler.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/registries/interaction-*.ts',
        'packages/render/src/registries/render-interaction-handler.ts',
        'packages/render/src/types/interaction-handler.ts',
        'packages/render/src/types/render-interaction.ts',
        'packages/render/src/__tests__/interaction-*.test.ts',
        'packages/render/src/__tests__/render-engine-package-boundary.test.ts'
      ],
      specRefs: ['#surface-interaction-to-feature', '#product-cases'],
      failureOwnerStepId: 'bridge-render-interaction'
    },
    {
      id: 'publish-render-ready',
      order: 2,
      laneId: 'core',
      title: 'Publish render ready',
      ownerPackage: '@asyra/core',
      purpose:
        'Publish framework readiness only after successful adapter and engine initialization plus the existing ordered Core startup phases.',
      inputs: ['artifact:render-adapter-init-outcome'],
      outputs: ['artifact:render-ready'],
      conditions: [
        'A successful engine initialization and normalized adapter outcome are required before data observers, persistence load, features, and render-ready publication complete.',
        'Core observes an engine-neutral outcome and never inspects Pixi or custom engine resources.'
      ],
      bypasses: [
        'Any adapter or engine initialization failure rejects Core.start and does not publish render ready.'
      ],
      allowedContributors: [
        '@asyra/render initialization outcome',
        'existing Core startup phase ordering',
        '@asyra/reactive-events ready notification'
      ],
      forbiddenContributors: [
        'concrete engine instance',
        'fallback ready state',
        'partial initialization success'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/**'
      ],
      specRefs: ['#state-to-render-surface', '#product-cases'],
      failureOwnerStepId: 'start-render-runtime'
    },
    {
      id: 'execute-product-feature',
      order: 1,
      laneId: 'feature',
      title: 'Execute product feature',
      ownerPackage: '@asyra/feature-system',
      purpose:
        'Consume the existing framework interaction event and keep product decisions in Feature rather than the concrete engine.',
      inputs: ['artifact:framework-render-interaction'],
      outputs: ['artifact:feature-intent'],
      conditions: [
        'Feature execution follows Input or render interaction -> Feature -> API -> State -> Render/UI.',
        'The resulting state change re-enters the ordinary authoritative state projection route.'
      ],
      bypasses: [
        'A render interaction with no registered product handler produces no feature intent.'
      ],
      allowedContributors: [
        'registered feature definitions',
        'framework render interaction event',
        'app/common APIs'
      ],
      forbiddenContributors: [
        'Pixi event objects',
        'engine-owned feature callbacks',
        'render-owned authoritative state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/feature-system/src/**',
        'apps/asyra-design/src/features/**'
      ],
      specRefs: ['#surface-interaction-to-feature'],
      failureOwnerStepId: 'execute-product-feature'
    },
    {
      id: 'destroy-render-runtime',
      order: 3,
      laneId: 'render',
      title: 'Destroy render runtime',
      ownerPackage: '@asyra/render',
      purpose:
        'Detach adapter-owned subscriptions and request deterministic cleanup from exactly the selected engine instance.',
      inputs: ['app or Core teardown request', 'active Render instance'],
      outputs: [
        'artifact:adapter-destroy-command',
        'artifact:adapter-cleanup-result'
      ],
      conditions: [
        'The adapter detaches interaction subscriptions, stops frame orchestration, clears opaque handle mappings, and calls destroy on the selected engine exactly once.',
        'The selected engine must release all owned resources and return a cleanup result before the Render instance is reusable.',
        'Cleanup is safe after successful, failed, or partial initialization.'
      ],
      bypasses: [
        'Destroy before engine creation still clears adapter-owned state and returns a deterministic no-resource cleanup result.'
      ],
      allowedContributors: [
        '@asyra/render-engine destroy contract',
        'adapter-owned frame and interaction disposers',
        'active engine instance reference'
      ],
      forbiddenContributors: [
        'global engine singleton cleanup',
        'another Render instance resources',
        'silent retained interaction subscriptions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/interaction/**',
        'packages/render/src/__tests__/render*.test.ts'
      ],
      specRefs: ['#abstract-engine-contract', '#engine-injection'],
      failureOwnerStepId: 'destroy-render-runtime'
    }
  ]

  const routes = [
    {
      id: 'use-default-engine',
      from: 'select-render-engine',
      to: 'orchestrate-render-adapter',
      kind: 'normal',
      predicate: 'applyPreset(core) uses its compatibility default',
      producedArtifacts: ['artifact:engine-provider-selection']
    },
    {
      id: 'use-custom-engine',
      from: 'select-render-engine',
      to: 'orchestrate-render-adapter',
      kind: 'conditional',
      predicate: 'preset receives an explicit custom engine factory',
      producedArtifacts: ['artifact:engine-provider-selection']
    },
    {
      id: 'inject-direct-engine',
      from: 'provide-custom-render-engine',
      to: 'orchestrate-render-adapter',
      kind: 'conditional',
      predicate: 'a direct Render consumer supplies an engine instance',
      producedArtifacts: ['artifact:direct-engine-provider']
    },
    {
      id: 'start-render-adapter',
      from: 'start-render-runtime',
      to: 'orchestrate-render-adapter',
      kind: 'normal',
      predicate:
        'Core.start has a configured Render adapter and engine provider',
      producedArtifacts: ['artifact:render-start-request']
    },
    {
      id: 'contract-to-render-adapter',
      from: 'define-render-engine-contract',
      to: 'orchestrate-render-adapter',
      kind: 'normal',
      predicate: 'the framework render adapter is compiled or instantiated',
      producedArtifacts: ['artifact:render-engine-contract']
    },
    {
      id: 'contract-to-pixi-engine',
      from: 'define-render-engine-contract',
      to: 'execute-render-engine',
      kind: 'normal',
      predicate: 'the default Pixi engine implements the abstract contract',
      producedArtifacts: ['artifact:render-engine-contract']
    },
    {
      id: 'contract-to-custom-engine',
      from: 'define-render-engine-contract',
      to: 'execute-custom-render-engine',
      kind: 'normal',
      predicate: 'a custom engine implements the abstract contract',
      producedArtifacts: ['artifact:render-engine-contract']
    },
    {
      id: 'project-state-to-engine',
      from: 'orchestrate-render-adapter',
      to: 'execute-render-engine',
      kind: 'conditional',
      predicate: 'the selected provider is @asyra/render-engine-pixi',
      producedArtifacts: ['artifact:engine-command-stream']
    },
    {
      id: 'project-state-to-custom-engine',
      from: 'orchestrate-render-adapter',
      to: 'execute-custom-render-engine',
      kind: 'conditional',
      predicate: 'the selected provider is a custom RenderEngine',
      producedArtifacts: ['artifact:engine-command-stream']
    },
    {
      id: 'return-pixi-engine-result',
      from: 'execute-render-engine',
      to: 'orchestrate-render-adapter',
      kind: 'normal',
      predicate: 'Pixi executes an abstract command',
      producedArtifacts: ['artifact:pixi-engine-result']
    },
    {
      id: 'return-custom-engine-result',
      from: 'execute-custom-render-engine',
      to: 'orchestrate-render-adapter',
      kind: 'normal',
      predicate: 'the custom engine executes an abstract command',
      producedArtifacts: ['artifact:custom-engine-result']
    },
    {
      id: 'publish-adapter-initialization',
      from: 'orchestrate-render-adapter',
      to: 'publish-render-ready',
      kind: 'normal',
      predicate: 'the selected engine initializes successfully',
      producedArtifacts: ['artifact:render-adapter-init-outcome']
    },
    {
      id: 'map-engine-target',
      from: 'orchestrate-render-adapter',
      to: 'bridge-render-interaction',
      kind: 'normal',
      predicate:
        'the adapter registers or updates an interaction target handle',
      producedArtifacts: ['artifact:render-target-handle-map']
    },
    {
      id: 'return-normalized-interaction',
      from: 'execute-render-engine',
      to: 'bridge-render-interaction',
      kind: 'conditional',
      predicate: 'Pixi receives an eligible surface event',
      producedArtifacts: ['artifact:pixi-interaction-event']
    },
    {
      id: 'return-custom-normalized-interaction',
      from: 'execute-custom-render-engine',
      to: 'bridge-render-interaction',
      kind: 'conditional',
      predicate: 'the custom engine receives an eligible surface event',
      producedArtifacts: ['artifact:custom-interaction-event']
    },
    {
      id: 'publish-framework-render-interaction',
      from: 'bridge-render-interaction',
      to: 'execute-product-feature',
      kind: 'normal',
      predicate:
        'a mapped target has an eligible registered interaction handler',
      producedArtifacts: ['artifact:framework-render-interaction']
    },
    {
      id: 'render-ready-terminal',
      from: 'publish-render-ready',
      kind: 'terminal',
      predicate:
        'Core completes its ordered startup after render initialization',
      producedArtifacts: ['artifact:render-ready']
    },
    {
      id: 'feature-intent-terminal',
      from: 'execute-product-feature',
      kind: 'terminal',
      predicate:
        'Feature forwards product intent to its API and authoritative state owner',
      producedArtifacts: ['artifact:feature-intent']
    },
    {
      id: 'pixi-surface-terminal',
      from: 'execute-render-engine',
      kind: 'terminal',
      predicate: 'Pixi flushes a successful selected-engine frame',
      producedArtifacts: ['artifact:pixi-surface-output']
    },
    {
      id: 'custom-surface-terminal',
      from: 'execute-custom-render-engine',
      kind: 'terminal',
      predicate: 'the custom engine flushes a successful selected-engine frame',
      producedArtifacts: ['artifact:custom-surface-output']
    },
    {
      id: 'request-pixi-destroy',
      from: 'destroy-render-runtime',
      to: 'execute-render-engine',
      kind: 'conditional',
      predicate: 'the active selected engine is Pixi',
      producedArtifacts: ['artifact:adapter-destroy-command']
    },
    {
      id: 'request-custom-destroy',
      from: 'destroy-render-runtime',
      to: 'execute-custom-render-engine',
      kind: 'conditional',
      predicate: 'the active selected engine is custom',
      producedArtifacts: ['artifact:adapter-destroy-command']
    },
    {
      id: 'adapter-cleanup-terminal',
      from: 'destroy-render-runtime',
      kind: 'terminal',
      predicate:
        'adapter-owned frame, target, and interaction state is cleared',
      producedArtifacts: ['artifact:adapter-cleanup-result']
    },
    {
      id: 'pixi-cleanup-terminal',
      from: 'execute-render-engine',
      kind: 'terminal',
      predicate: 'Pixi-owned resources are released after destroy',
      producedArtifacts: ['artifact:pixi-cleanup-result']
    },
    {
      id: 'custom-cleanup-terminal',
      from: 'execute-custom-render-engine',
      kind: 'terminal',
      predicate: 'custom-engine-owned resources are released after destroy',
      producedArtifacts: ['artifact:custom-cleanup-result']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:engine-provider-selection',
      ownerStepId: 'select-render-engine',
      consumerStepIds: ['orchestrate-render-adapter'],
      channel: 'startup-composition',
      terminal: false
    },
    {
      id: 'artifact:direct-engine-provider',
      ownerStepId: 'provide-custom-render-engine',
      consumerStepIds: ['orchestrate-render-adapter'],
      channel: 'constructor-injection',
      terminal: false
    },
    {
      id: 'artifact:render-start-request',
      ownerStepId: 'start-render-runtime',
      consumerStepIds: ['orchestrate-render-adapter'],
      channel: 'core-lifecycle',
      terminal: false
    },
    {
      id: 'artifact:render-engine-contract',
      ownerStepId: 'define-render-engine-contract',
      consumerStepIds: [
        'orchestrate-render-adapter',
        'execute-render-engine',
        'execute-custom-render-engine'
      ],
      channel: 'package contract',
      terminal: false
    },
    {
      id: 'artifact:engine-command-stream',
      ownerStepId: 'orchestrate-render-adapter',
      consumerStepIds: [
        'execute-render-engine',
        'execute-custom-render-engine'
      ],
      channel: '@asyra/render-engine',
      terminal: false
    },
    {
      id: 'artifact:render-target-handle-map',
      ownerStepId: 'orchestrate-render-adapter',
      consumerStepIds: ['bridge-render-interaction'],
      channel: 'render-adapter-internal',
      terminal: false
    },
    {
      id: 'artifact:render-adapter-init-outcome',
      ownerStepId: 'orchestrate-render-adapter',
      consumerStepIds: ['publish-render-ready'],
      channel: 'framework-renderer',
      terminal: false
    },
    {
      id: 'artifact:pixi-engine-result',
      ownerStepId: 'execute-render-engine',
      consumerStepIds: ['orchestrate-render-adapter'],
      channel: '@asyra/render-engine',
      terminal: false
    },
    {
      id: 'artifact:custom-engine-result',
      ownerStepId: 'execute-custom-render-engine',
      consumerStepIds: ['orchestrate-render-adapter'],
      channel: '@asyra/render-engine',
      terminal: false
    },
    {
      id: 'artifact:pixi-interaction-event',
      ownerStepId: 'execute-render-engine',
      consumerStepIds: ['bridge-render-interaction'],
      channel: '@asyra/render-engine interaction',
      terminal: false
    },
    {
      id: 'artifact:custom-interaction-event',
      ownerStepId: 'execute-custom-render-engine',
      consumerStepIds: ['bridge-render-interaction'],
      channel: '@asyra/render-engine interaction',
      terminal: false
    },
    {
      id: 'artifact:framework-render-interaction',
      ownerStepId: 'bridge-render-interaction',
      consumerStepIds: ['execute-product-feature'],
      channel: 'render interaction bridge',
      terminal: false
    },
    {
      id: 'artifact:render-ready',
      ownerStepId: 'publish-render-ready',
      consumerStepIds: [],
      channel: 'framework lifecycle',
      terminal: true
    },
    {
      id: 'artifact:feature-intent',
      ownerStepId: 'execute-product-feature',
      consumerStepIds: [],
      channel: 'feature runtime',
      terminal: true
    },
    {
      id: 'artifact:pixi-surface-output',
      ownerStepId: 'execute-render-engine',
      consumerStepIds: [],
      channel: 'render surface',
      terminal: true
    },
    {
      id: 'artifact:custom-surface-output',
      ownerStepId: 'execute-custom-render-engine',
      consumerStepIds: [],
      channel: 'render surface',
      terminal: true
    },
    {
      id: 'artifact:adapter-destroy-command',
      ownerStepId: 'destroy-render-runtime',
      consumerStepIds: [
        'execute-render-engine',
        'execute-custom-render-engine'
      ],
      channel: '@asyra/render-engine lifecycle',
      terminal: false
    },
    {
      id: 'artifact:adapter-cleanup-result',
      ownerStepId: 'destroy-render-runtime',
      consumerStepIds: [],
      channel: 'render-adapter lifecycle',
      terminal: true
    },
    {
      id: 'artifact:pixi-cleanup-result',
      ownerStepId: 'execute-render-engine',
      consumerStepIds: [],
      channel: '@asyra/render-engine lifecycle',
      terminal: true
    },
    {
      id: 'artifact:custom-cleanup-result',
      ownerStepId: 'execute-custom-render-engine',
      consumerStepIds: [],
      channel: '@asyra/render-engine lifecycle',
      terminal: true
    }
  ]

  const allStepIds = steps.map((step) => step.id)
  const invariants = [
    {
      id: 'adapter-concrete-engine-separation',
      statement:
        '@asyra/render and @asyra/render-engine-pixi never import one another; both meet only through @asyra/render-engine.',
      stepIds: ['orchestrate-render-adapter', 'execute-render-engine'],
      artifactIds: [
        'artifact:engine-command-stream',
        'artifact:pixi-engine-result'
      ],
      specRefs: ['#target-package-architecture', '#definition-of-done']
    },
    {
      id: 'one-engine-per-render-instance',
      statement:
        'Each Render instance uses exactly its selected engine instance and never silently falls back to another singleton.',
      stepIds: [
        'select-render-engine',
        'provide-custom-render-engine',
        'orchestrate-render-adapter'
      ],
      artifactIds: [
        'artifact:engine-provider-selection',
        'artifact:direct-engine-provider'
      ],
      specRefs: ['#engine-injection', '#product-cases']
    },
    {
      id: 'interaction-preserves-feature-ownership',
      statement:
        'Concrete surface events return through normalized engine and render interaction boundaries before any product feature executes.',
      stepIds: [
        'execute-render-engine',
        'execute-custom-render-engine',
        'bridge-render-interaction',
        'execute-product-feature'
      ],
      artifactIds: [
        'artifact:pixi-interaction-event',
        'artifact:custom-interaction-event',
        'artifact:framework-render-interaction'
      ],
      specRefs: ['#surface-interaction-to-feature']
    },
    {
      id: 'engine-failure-is-not-ready',
      statement:
        'Engine failure or unsupported capability cleanup never produces a successful adapter outcome or render-ready event.',
      stepIds: [
        'orchestrate-render-adapter',
        'execute-render-engine',
        'execute-custom-render-engine',
        'publish-render-ready',
        'destroy-render-runtime'
      ],
      artifactIds: [
        'artifact:render-adapter-init-outcome',
        'artifact:render-ready',
        'artifact:adapter-cleanup-result'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'default-pixi-compatibility',
      title: 'Default Pixi compatibility',
      stepIds: [
        'select-render-engine',
        'start-render-runtime',
        'orchestrate-render-adapter',
        'execute-render-engine',
        'publish-render-ready'
      ],
      specRefs: ['#product-cases'],
      assertions: [
        'applyPreset(core) starts the same Pixi-backed Asyra Design surface without app-level concrete engine import'
      ]
    },
    {
      id: 'custom-engine-replaceability',
      title: 'Custom engine replaceability',
      stepIds: [
        'select-render-engine',
        'provide-custom-render-engine',
        'orchestrate-render-adapter',
        'execute-custom-render-engine',
        'destroy-render-runtime'
      ],
      specRefs: ['#product-cases', '#definition-of-done'],
      assertions: [
        'the engine-independent contract adapter proves lifecycle, commands, events, capability failure, cleanup, and instance isolation'
      ]
    },
    {
      id: 'existing-state-and-interaction-paths',
      title: 'Existing state and interaction paths',
      stepIds: allStepIds,
      specRefs: ['#product-cases'],
      assertions: [
        'create, update, remove, layers, viewport, hit testing, interaction, undo, redo, load, persistence replay, and local shared projection use the normal boundary'
      ]
    },
    {
      id: 'bounded-two-dimensional-scope',
      title: 'Bounded Pixi 2D scope',
      stepIds: allStepIds,
      specRefs: ['#scope', '#definition-of-done'],
      assertions: [
        'no production three-dimensional engine, multi-engine runtime, Hybrid behavior, or render mode selector is introduced'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'render-engine-boundary',
      kind: 'system',
      title: 'Render-Engine Boundary Inspector Flow',
      subtitle:
        'Owner and handoff map for engine selection, framework render orchestration, concrete execution, interaction, readiness, and cleanup.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'render-engine-boundary-plan.md',
      inspectorOwner: 'render-engine-boundary-flow-inspector.data.cjs'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Render-Engine Boundary Plan',
        href: './render-engine-boundary-plan.md',
        kind: 'authority'
      },
      {
        id: 'inspector-data',
        label: 'Inspector Data',
        href: './render-engine-boundary-flow-inspector.data.cjs',
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
