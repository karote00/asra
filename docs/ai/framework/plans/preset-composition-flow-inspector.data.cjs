;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/preset-composition-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/preset-composition-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Startup', order: 1 },
    { id: 'preset', title: 'Preset Coordinator', order: 2 },
    { id: 'render', title: 'Render Provider', order: 3 },
    { id: 'core', title: 'Core Runtime Start', order: 4 }
  ]

  const steps = [
    {
      id: 'request-preset-composition',
      order: 1,
      laneId: 'app',
      title: 'Request preset composition',
      ownerPackage: 'app or user composition',
      purpose:
        'Select optional preset composition inputs, receive the completed preset result, then retain app customization and runtime-start ownership.',
      inputs: [
        'app startup intent',
        'public @asyra/core instance',
        'public @asyra/preset applyPreset facade',
        'optional typed ApplyPresetOptions'
      ],
      outputs: [
        'artifact:requested-composition',
        'artifact:app-customization-sequence'
      ],
      conditions: [
        'The app calls applyPreset(core, composition?) and waits for a completed PresetApplication result.',
        'Only after applyPreset returns may the app remove/define relations, unregister/register complete implementations, and register app migration.',
        'The app calls core.start() after its independent customization phase.',
        'The no-customization compatibility route performs zero Core customization operations after applyPreset.'
      ],
      bypasses: [
        'Omitted composition selects the preset-owned default Pixi bootstrap and no optional bundles.',
        'An app may skip @asyra/preset and own all startup registrations through public Core APIs.'
      ],
      allowedContributors: [
        'app startup code',
        '@asyra/preset public types and facade',
        '@asyra/core public registration and migration facades'
      ],
      forbiddenContributors: [
        'preset-specific app extension object, callback, target, or apply-back flow',
        'preset/framework deep imports',
        'product mode inferred from engine capabilities',
        '2D, 3D, Hybrid, or multi-engine profile selection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'docs/ai/apps/asyra-design/APP_ESSENTIALS.md',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md',
        'docs/ai/apps/asyra-design/modules/registrations.md'
      ],
      specRefs: ['#goal', '#supported-behavior', '#app-customization'],
      failureOwnerStepId: 'request-preset-composition',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'apply-app-customization',
      order: 2,
      laneId: 'app',
      title: 'Apply app-owned customization',
      ownerPackage: 'app or user composition',
      purpose:
        'Perform optional product customization through ordinary Core APIs after preset composition has completed.',
      inputs: [
        'artifact:preset-composition-success',
        'artifact:app-customization-sequence',
        'public @asyra/core registration facade'
      ],
      outputs: ['artifact:customized-registration-state'],
      conditions: [
        'Structural changes use remove old relation then define new relation.',
        'Complete implementation changes use unregister owner registration then ordinary define/register.',
        'App-owned migration is registered before core.start().'
      ],
      bypasses: [
        'The compatibility app route performs no customization and preserves the preset registration state.'
      ],
      allowedContributors: [
        'public Core remove/define/register/unregister APIs',
        'app-owned registration definitions',
        'app-owned migration functions'
      ],
      forbiddenContributors: [
        'public/shared replace semantics',
        'duplicate registration tolerance',
        'preset executing app operations',
        'app-specific policy in preset or framework packages'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'docs/ai/framework/golden-paths/extend-preset-capability.md',
        'docs/ai/framework/golden-paths/preset-composition.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md'
      ],
      specRefs: ['#app-customization', '#architecture-flow', '#product-cases'],
      failureOwnerStepId: 'apply-app-customization',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'resolve-preset-composition',
      order: 1,
      laneId: 'preset',
      title: 'Resolve and validate composition',
      ownerPackage: '@asyra/preset',
      purpose:
        'Resolve compatibility defaults and validate the complete engine and bundle selection before any composition mutation.',
      inputs: [
        'artifact:requested-composition',
        'CorePresetDependencies or Core.getPresetDependencies()',
        'preset-owned default Pixi bootstrap identity and factory'
      ],
      outputs: ['artifact:validated-composition'],
      conditions: [
        'Omitted input resolves the stable preset-owned Pixi bootstrap identity.',
        'Legacy renderEngineFactory remains compatible and maps to one stable compatibility diagnostic identity.',
        'A new engine bootstrap requires a non-empty stable id and a factory unless it selects the preset-owned default identity.',
        'Supplying legacy and new engine inputs together fails INVALID_COMPOSITION before mutation.',
        'Bundle ids and engine targets are unique; duplicate targets fail before mutation.',
        'Each bundle dependency is selected and appears earlier; missing dependency and ordering conflict have distinct stable errors.',
        'Invalid or no-op bundle definitions fail before installation.'
      ],
      bypasses: [
        'No capabilityBundles means the bundle layer is valid and empty.',
        'Explicit dependencies bypass Core.getPresetDependencies() without bypassing validation.'
      ],
      allowedContributors: [
        '@asyra/render-engine RenderEngineFactory type',
        '@asyra/render-engine-pixi public default factory',
        'public bundle metadata supplied by package authors'
      ],
      forbiddenContributors: [
        'engine capability introspection',
        'automatic engine fallback',
        'bundle registry conflict reimplementation',
        'app customization operations or arbitrary callbacks'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/index.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#public-typed-contract',
        '#structured-failures',
        '#product-cases'
      ],
      failureOwnerStepId: 'resolve-preset-composition',
      cleanupOwnerStepId: 'resolve-preset-composition'
    },
    {
      id: 'install-shared-preset-defaults',
      order: 2,
      laneId: 'preset',
      title: 'Install shared preset defaults',
      ownerPackage: '@asyra/preset',
      purpose:
        'Install engine-independent preset registration and runtime-wiring groups exactly once in a stable declared order.',
      inputs: [
        'artifact:validated-composition',
        'public CorePresetInstallAPIs',
        'preset-owned registration and wiring installers'
      ],
      outputs: [
        'artifact:shared-default-groups',
        'artifact:preset-owned-cleanup-handles'
      ],
      conditions: [
        'Shared group order is explicit, stable, and reported in the completed result.',
        'Every registration uses ordinary Core duplicate/conflict semantics; preset does not skip duplicates.',
        'Each runtime wiring installer registers an owned cleanup handle.',
        'The compatibility path installs the same observable defaults as before Generic Preset Composition.'
      ],
      bypasses: [
        'No shared group is conditionally omitted by engine identity, capability, or product mode.'
      ],
      allowedContributors: [
        'preset-owned component/property/event/selection/render/UI installers',
        'public CorePresetInstallAPIs',
        'completed Extendable Preset registration graph contract'
      ],
      forbiddenContributors: [
        'app-domain feature policy',
        'duplicate registration fallback',
        'concrete engine resources',
        '2D, 3D, Hybrid, or profile-specific defaults'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/preset.ts',
        'packages/preset/src/components/**',
        'packages/preset/src/props/**',
        'packages/preset/src/events/**',
        'packages/preset/src/selection/**',
        'packages/preset/src/subscriptions/**',
        'packages/preset/src/render-layers/**',
        'packages/preset/src/ui/**',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#shared-preset-defaults',
        '#architecture-flow',
        '#product-cases'
      ],
      failureOwnerStepId: 'install-shared-preset-defaults',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'accept-concrete-engine-provider',
      order: 1,
      laneId: 'render',
      title: 'Accept concrete-engine provider',
      ownerPackage: '@asyra/render',
      purpose:
        'Accept the exact validated engine factory for the target Render instance and expose reversible pre-runtime provider cleanup without constructing engine resources.',
      inputs: [
        'artifact:validated-composition engine bootstrap',
        'target Render instance from PresetDependencies'
      ],
      outputs: ['artifact:engine-provider-selection'],
      conditions: [
        'Render accepts exactly one validated provider and remains concrete-engine-neutral.',
        'Provider configuration does not construct an engine or publish runtime readiness.',
        'Cleanup restores the prior pre-runtime provider state or clears the selected provider when no prior provider exists.',
        'A stale cleanup handle cannot erase a later provider selection.',
        'Each Render instance owns its provider state independently.',
        'The preset caller boundary maps provider rejection to structured composition failure without moving provider semantics into preset.'
      ],
      bypasses: [
        'The default and explicit engine paths use the same provider-acceptance contract.',
        'No engine destroy is required before runtime construction; concrete engine cleanup remains the selected engine package owner after construction.'
      ],
      allowedContributors: [
        '@asyra/render-engine public factory contract',
        '@asyra/preset validated bootstrap selection',
        'Render instance-local provider state'
      ],
      forbiddenContributors: [
        '@asyra/render-engine-pixi imports in @asyra/render',
        'concrete SDK inspection',
        'module-global provider state',
        'automatic Pixi fallback for custom Render instances'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/types.ts',
        'packages/render/src/index.ts',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#concrete-engine-bootstrap',
        '#architecture-flow',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'accept-concrete-engine-provider',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'install-capability-bundles',
      order: 3,
      laneId: 'preset',
      title: 'Install selected capability bundles',
      ownerPackage: '@asyra/preset',
      purpose:
        'Invoke explicitly selected package-owned bundles in caller-declared order and retain their outputs and cleanup handles without owning bundle semantics.',
      inputs: [
        'artifact:validated-composition bundle sequence',
        'artifact:engine-provider-selection',
        'artifact:shared-default-groups',
        'public CorePresetInstallAPIs and PresetDependencies'
      ],
      outputs: ['artifact:bundle-installations'],
      conditions: [
        'Bundles run only after shared defaults and concrete-engine provider selection.',
        'Caller-declared order is preserved; preset performs no inferred topological reorder.',
        'Every installation returns explicit outputs and one package-owned disposer.',
        'Preset records detached diagnostics and never treats outputs as registry authority.',
        'A bundle failure stops later bundles and routes all acquired cleanup handles to reverse-order disposal.'
      ],
      bypasses: [
        'An empty selected bundle list produces an empty installation artifact without a no-op bundle.'
      ],
      allowedContributors: [
        'selected package-owned bundle installer',
        'public preset bundle context',
        'preset ordering and cleanup coordinator'
      ],
      forbiddenContributors: [
        'app-specific feature policy inside preset',
        'bundle inferred from engine capabilities',
        'fallback or no-op bundle that reports success',
        'public/shared registry replace semantics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#optional-capability-bundles',
        '#public-typed-contract',
        '#structured-failures'
      ],
      failureOwnerStepId: 'install-capability-bundles',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'publish-composition-result',
      order: 4,
      laneId: 'preset',
      title: 'Publish completed composition result',
      ownerPackage: '@asyra/preset',
      purpose:
        'Publish one detached, instance-local success result only after every selected layer has completed.',
      inputs: [
        'artifact:validated-composition',
        'artifact:shared-default-groups',
        'artifact:engine-provider-selection',
        'artifact:bundle-installations'
      ],
      outputs: [
        'artifact:preset-composition-success',
        'artifact:preset-application'
      ],
      conditions: [
        'Success contains engine identity, shared groups, bundle identities, and exact deterministic layer order.',
        'Arrays and owner metadata are detached from caller-owned mutable inputs.',
        'PresetApplication result and cleanup state are local to the supplied Core/application lifetime.',
        'Success means preset composition completed; it does not mean Core runtime-ready.',
        'No success object is published on validation, layer, or cleanup failure.'
      ],
      bypasses: [
        'No bypass may publish success before all requested layers complete.'
      ],
      allowedContributors: [
        'completed preset-owned layer artifacts',
        'detached public diagnostics',
        'PresetApplication lifetime owner'
      ],
      forbiddenContributors: [
        'shared module-global result state',
        '2D, 3D, Hybrid, or app-domain mode fields',
        'engine capability equals product capability inference',
        'Core ready publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/index.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#public-typed-contract',
        '#structured-failures',
        '#product-cases'
      ],
      failureOwnerStepId: 'publish-composition-result',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'dispose-preset-composition',
      order: 5,
      laneId: 'preset',
      title: 'Dispose or roll back composition',
      ownerPackage: '@asyra/preset',
      purpose:
        'Coordinate reverse-order cleanup for apply failure or explicit application disposal while preserving package-local cleanup ownership and retry state.',
      inputs: [
        'artifact:preset-owned-cleanup-handles',
        'artifact:engine-provider-selection when acquired',
        'artifact:bundle-installations completed before failure',
        'explicit PresetApplication.dispose request or failed layer cause'
      ],
      outputs: ['artifact:composition-cleanup-result'],
      conditions: [
        'Cleanup runs acquired handles in exact reverse installation order.',
        'Package-owned bundle disposers and Render provider cleanup retain their own resource semantics.',
        'Completed cleanup handles are not invoked again; only pending keys retry.',
        'Cleanup failure throws CLEANUP_FAILED with completed and pending keys plus the original apply failure where present.',
        'The next apply on the same Core retries pending rollback cleanup before installing new defaults.',
        'No stale observer, handler, subscription, layer, registration, provider, or engine resource remains after successful cleanup.'
      ],
      bypasses: [
        'A layer not yet installed contributes no cleanup handle.',
        'A preset registration already removed through ordinary Core APIs is skipped without duplicate cleanup.'
      ],
      allowedContributors: [
        'completed package-owned cleanup handles',
        'completed Extendable Preset graph-aware disposal',
        'Render instance-local provider cleanup handle'
      ],
      forbiddenContributors: [
        'best-effort success with pending cleanup',
        're-running completed cleanup',
        'module-global cleanup state shared by Core instances',
        'fallback engine or no-op replacement bundle'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#structured-failures',
        '#architecture-flow',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'dispose-preset-composition',
      cleanupOwnerStepId: 'dispose-preset-composition'
    },
    {
      id: 'close-and-start-core-runtime',
      order: 1,
      laneId: 'core',
      title: 'Close composition and start Core',
      ownerPackage: '@asyra/core',
      purpose:
        'Permanently close registration composition and own renderer initialization, runtime startup, and ready publication.',
      inputs: [
        'artifact:preset-composition-success',
        'artifact:customized-registration-state',
        'core.start container and RenderOptions'
      ],
      outputs: ['artifact:core-runtime-start-result'],
      conditions: [
        'The first core.start() closes registration composition permanently at method entry.',
        'Declared relations validate before renderer side effects.',
        'Renderer and concrete engine initialize before observers, load, features, and ready publication.',
        'Preset composition success is not consulted as a substitute for Core startup checks.'
      ],
      bypasses: [
        'No preset-specific bypass may publish Core ready.',
        'Apps that skip preset still use the same Core startup contract.'
      ],
      allowedContributors: [
        '@asyra/core lifecycle coordinator',
        '@asyra/render engine-neutral adapter',
        'completed registration graph contract'
      ],
      forbiddenContributors: [
        'preset publishing runtime-ready',
        'reopening registration composition after failed start',
        'concrete engine selection in Core',
        'product-mode inference'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/core-start-render.test.ts',
        'packages/core/src/__tests__/composition-coordinator.test.ts',
        'docs/ai/framework/packages/core.md'
      ],
      specRefs: ['#runtime-start', '#architecture-flow', '#definition-of-done'],
      failureOwnerStepId: 'close-and-start-core-runtime',
      cleanupOwnerStepId: 'close-and-start-core-runtime'
    }
  ]

  const routes = [
    {
      id: 'request-composition',
      from: 'request-preset-composition',
      to: 'resolve-preset-composition',
      kind: 'startup',
      predicate: 'the app calls applyPreset(core, composition?)',
      producedArtifacts: ['artifact:requested-composition']
    },
    {
      id: 'install-validated-shared-defaults',
      from: 'resolve-preset-composition',
      to: 'install-shared-preset-defaults',
      kind: 'success',
      predicate: 'all engine and bundle inputs validate before mutation',
      producedArtifacts: ['artifact:validated-composition']
    },
    {
      id: 'configure-selected-engine',
      from: 'install-shared-preset-defaults',
      to: 'accept-concrete-engine-provider',
      kind: 'success',
      predicate: 'all shared preset groups install successfully',
      producedArtifacts: [
        'artifact:shared-default-groups',
        'artifact:preset-owned-cleanup-handles'
      ]
    },
    {
      id: 'install-explicit-bundles',
      from: 'accept-concrete-engine-provider',
      to: 'install-capability-bundles',
      kind: 'success',
      predicate:
        'Render accepts the selected provider and returns its cleanup handle',
      producedArtifacts: ['artifact:engine-provider-selection']
    },
    {
      id: 'publish-after-all-layers',
      from: 'install-capability-bundles',
      to: 'publish-composition-result',
      kind: 'success',
      predicate: 'every explicitly selected bundle installation completes',
      producedArtifacts: ['artifact:bundle-installations']
    },
    {
      id: 'return-before-app-customization',
      from: 'publish-composition-result',
      to: 'apply-app-customization',
      kind: 'handoff',
      predicate:
        'PresetApplication with completed instance-local result returns to the app',
      producedArtifacts: [
        'artifact:preset-composition-success',
        'artifact:preset-application'
      ]
    },
    {
      id: 'start-after-app-customization',
      from: 'apply-app-customization',
      to: 'close-and-start-core-runtime',
      kind: 'startup',
      predicate:
        'the app completes ordinary Core customization and migration registration',
      producedArtifacts: ['artifact:customized-registration-state']
    },
    {
      id: 'shared-default-failure-cleanup',
      from: 'install-shared-preset-defaults',
      to: 'dispose-preset-composition',
      kind: 'failure',
      predicate:
        'a shared default group fails after any owned resource is acquired',
      producedArtifacts: ['artifact:preset-owned-cleanup-handles']
    },
    {
      id: 'engine-provider-failure-cleanup',
      from: 'accept-concrete-engine-provider',
      to: 'dispose-preset-composition',
      kind: 'failure',
      predicate:
        'provider acceptance fails after shared defaults were installed',
      producedArtifacts: ['artifact:preset-owned-cleanup-handles']
    },
    {
      id: 'bundle-failure-cleanup',
      from: 'install-capability-bundles',
      to: 'dispose-preset-composition',
      kind: 'failure',
      predicate:
        'a selected bundle fails after earlier layers or bundles installed',
      producedArtifacts: [
        'artifact:preset-owned-cleanup-handles',
        'artifact:engine-provider-selection',
        'artifact:bundle-installations'
      ]
    },
    {
      id: 'explicit-application-disposal',
      from: 'publish-composition-result',
      to: 'dispose-preset-composition',
      kind: 'cleanup',
      predicate: 'the app calls PresetApplication.dispose()',
      producedArtifacts: ['artifact:preset-application']
    },
    {
      id: 'cleanup-terminal',
      from: 'dispose-preset-composition',
      to: undefined,
      kind: 'terminal',
      predicate:
        'cleanup succeeds or reports deterministic pending retry state',
      producedArtifacts: ['artifact:composition-cleanup-result']
    },
    {
      id: 'runtime-start-terminal',
      from: 'close-and-start-core-runtime',
      to: undefined,
      kind: 'terminal',
      predicate: 'Core owns startup success/failure and ready publication',
      producedArtifacts: ['artifact:core-runtime-start-result']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:requested-composition',
      ownerStepId: 'request-preset-composition',
      consumerStepIds: ['resolve-preset-composition']
    },
    {
      id: 'artifact:app-customization-sequence',
      ownerStepId: 'request-preset-composition',
      consumerStepIds: ['apply-app-customization']
    },
    {
      id: 'artifact:validated-composition',
      ownerStepId: 'resolve-preset-composition',
      consumerStepIds: [
        'install-shared-preset-defaults',
        'accept-concrete-engine-provider',
        'install-capability-bundles',
        'publish-composition-result'
      ]
    },
    {
      id: 'artifact:shared-default-groups',
      ownerStepId: 'install-shared-preset-defaults',
      consumerStepIds: [
        'accept-concrete-engine-provider',
        'install-capability-bundles',
        'publish-composition-result'
      ]
    },
    {
      id: 'artifact:preset-owned-cleanup-handles',
      ownerStepId: 'install-shared-preset-defaults',
      consumerStepIds: ['dispose-preset-composition']
    },
    {
      id: 'artifact:engine-provider-selection',
      ownerStepId: 'accept-concrete-engine-provider',
      consumerStepIds: [
        'install-capability-bundles',
        'publish-composition-result',
        'dispose-preset-composition'
      ]
    },
    {
      id: 'artifact:bundle-installations',
      ownerStepId: 'install-capability-bundles',
      consumerStepIds: [
        'publish-composition-result',
        'dispose-preset-composition'
      ]
    },
    {
      id: 'artifact:preset-composition-success',
      ownerStepId: 'publish-composition-result',
      consumerStepIds: [
        'apply-app-customization',
        'close-and-start-core-runtime'
      ]
    },
    {
      id: 'artifact:preset-application',
      ownerStepId: 'publish-composition-result',
      consumerStepIds: ['dispose-preset-composition']
    },
    {
      id: 'artifact:customized-registration-state',
      ownerStepId: 'apply-app-customization',
      consumerStepIds: ['close-and-start-core-runtime']
    },
    {
      id: 'artifact:composition-cleanup-result',
      ownerStepId: 'dispose-preset-composition',
      consumerStepIds: []
    },
    {
      id: 'artifact:core-runtime-start-result',
      ownerStepId: 'close-and-start-core-runtime',
      consumerStepIds: []
    }
  ]

  const invariants = [
    'Preset composition order is shared defaults, concrete-engine bootstrap, explicitly selected bundles, completed result.',
    'App customization starts only after applyPreset returns and uses ordinary Core APIs.',
    'Core.start owns permanent registration closure, runtime startup, and ready publication.',
    'No public/shared replace semantics, duplicate tolerance, or semantic-equivalence inference exists.',
    'Failure publishes no success and reverse-cleans every acquired owned resource with retryable pending state.',
    'Composition results, bundle selections, cleanup state, and diagnostics are instance-local.',
    'Diagnostics never infer 2D, 3D, Hybrid, app-domain mode, or product capability from engine capability.',
    'Render and concrete engines communicate only through @asyra/render-engine; only @asyra/render-engine-pixi imports Pixi.'
  ]

  const productCases = [
    {
      id: 'omitted-default-compatibility',
      summary:
        'Omitted composition preserves the default Pixi-backed applyPreset behavior.'
    },
    {
      id: 'explicit-default-equivalence',
      summary:
        'Explicit default engine composition produces equivalent registration and runtime wiring.'
    },
    {
      id: 'shared-defaults-exactly-once',
      summary: 'Shared groups apply exactly once in deterministic order.'
    },
    {
      id: 'bundle-order',
      summary:
        'Selected package-owned bundles install in caller-declared order with outputs and cleanup.'
    },
    {
      id: 'post-return-app-customization',
      summary:
        'App customization uses ordinary Core APIs only after applyPreset returns.'
    },
    {
      id: 'no-app-extension-surface',
      summary:
        'No preset-specific app extension callback, object, target, or replace flow is public.'
    },
    {
      id: 'duplicate-target',
      summary: 'Duplicate engine or bundle targets fail before mutation.'
    },
    {
      id: 'unknown-engine',
      summary: 'Unknown engine bootstrap fails with a stable structured error.'
    },
    {
      id: 'missing-bundle',
      summary: 'Missing selected bundle dependency fails before installation.'
    },
    {
      id: 'ordering-conflict',
      summary:
        'A dependency selected after its consumer fails without inferred reorder.'
    },
    {
      id: 'partial-failure-cleanup',
      summary:
        'Layer failure publishes no success and reverse-cleans acquired resources.'
    },
    {
      id: 'cleanup-retry',
      summary:
        'Cleanup retry runs only pending handles and leaves no stale resources.'
    },
    {
      id: 'instance-isolation',
      summary:
        'Separate Core/PresetApplication instances share no result, diagnostics, bundle, or cleanup state.'
    },
    {
      id: 'core-start-ownership',
      summary:
        'Core.start remains permanent composition closure and runtime-ready owner.'
    },
    {
      id: 'render-mode-non-goal',
      summary:
        'No 2D, 3D, Hybrid, multi-engine, or app-domain mode is exposed or inferred.'
    },
    {
      id: 'asyra-design-compatibility',
      summary:
        'Asyra Design default startup and public package imports remain compatible.'
    }
  ]

  const definitionOfDone = [
    {
      id: 'public-contract',
      summary:
        'Typed input/result/error/bundle contracts are documented and formally tested.'
    },
    {
      id: 'deterministic-order',
      summary:
        'Shared, engine, bundle, and result ordering is deterministic and observable.'
    },
    {
      id: 'compatibility',
      summary:
        'Default applyPreset and Asyra Design startup behavior remain compatible.'
    },
    {
      id: 'failure-cleanup',
      summary:
        'Validation, partial failure, reverse cleanup, and retry state leave no stale resources.'
    },
    {
      id: 'instance-isolation',
      summary: 'Composition diagnostics and lifecycle state are instance-local.'
    },
    {
      id: 'ownership-boundaries',
      summary:
        'Framework, preset, Render, engine, bundle, Core, and app ownership plus import boundaries remain exact.'
    },
    {
      id: 'non-goals',
      summary:
        'No 2D, 3D, Hybrid, multi-engine, product-mode, or app-policy scope is introduced.'
    },
    {
      id: 'full-validation',
      summary:
        'Affected package/app/Inspector tests plus root test, lint, build, dependency, diff, and live startup gates pass.'
    },
    {
      id: 'independent-review',
      summary:
        'Self-review and read-only sub-agent review have no unresolved concrete finding.'
    }
  ]

  const data = {
    schema: 'asyra.flow-inspector.v1',
    target: {
      id: 'generic-preset-composition',
      title: 'Generic Preset Composition Flow',
      summary:
        'Deterministic preset startup composition through shared defaults, one concrete-engine bootstrap, optional package-owned bundles, and an instance-local completed result.'
    },
    authority: {
      specPath,
      inspectorPath,
      rulePaths: [
        'docs/ai/framework/rules/inspector-contract-readiness.md',
        'docs/ai/framework/rules/inspector-step-execution.md',
        'docs/ai/framework/rules/extension-patterns.md',
        'docs/ai/framework/rules/import-boundaries.md',
        'docs/ai/framework/plans/completed/extendable-preset-plan.md',
        'docs/ai/framework/plans/completed/render-engine-boundary-plan.md'
      ]
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product contract',
        href: './preset-composition-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: './preset-composition-flow-inspector.contract.test.cjs'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    productCases,
    definitionOfDone
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.FLOW_INSPECTOR_DATA = data
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
