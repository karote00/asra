;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/preset-composition-plan.md'
  const inspectorPath =
    'tools/flow-inspector/inspectors/preset-composition-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Composition', order: 1 },
    { id: 'preset', title: 'Preset Defaults', order: 2 },
    { id: 'core', title: 'Core Lifecycle', order: 3 },
    { id: 'render', title: 'Render Runtime', order: 4 }
  ]

  const steps = [
    {
      id: 'request-preset',
      order: 1,
      laneId: 'app',
      title: 'Request preset profile and defaults',
      ownerPackage: 'app or user composition',
      purpose:
        'Supply independent profile and defaults choices, then retain app customization and Core-start ownership.',
      inputs: [
        'public @asyra/core instance',
        'public @asyra/preset applyPreset facade',
        'optional strict ApplyPresetOptions'
      ],
      outputs: ['artifact:preset-request'],
      conditions: [
        'The app calls applyPreset(core, options?) while Core composition is open.',
        'Omitted options mean profile 2D plus every available default.',
        'The app never supplies installers, callbacks, engine ids, dependency overrides, or cleanup owners.'
      ],
      bypasses: [
        'An app may skip preset and compose through public Core APIs.'
      ],
      allowedContributors: [
        '@asyra/preset public identifiers and catalog',
        'app startup code'
      ],
      forbiddenContributors: [
        'capability bundle or arbitrary installer input',
        'legacy renderEngineFactory or identified engine bootstrap input',
        'preset-specific app extension object or callback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/**',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md'
      ],
      specRefs: ['#product-contract', '#ownership-and-flow'],
      failureOwnerStepId: 'request-preset',
      cleanupOwnerStepId: 'rollback-preset-apply'
    },
    {
      id: 'resolve-preset-request',
      order: 1,
      laneId: 'preset',
      title: 'Resolve strict profile and defaults request',
      ownerPackage: '@asyra/preset',
      purpose:
        'Snapshot strict options and validate profile, defaults, public dependencies, Core state, duplicate apply, and provider conflict before mutation.',
      inputs: [
        'artifact:preset-request',
        'deeply frozen PresetCatalog',
        'Core composition/provider state'
      ],
      outputs: ['artifact:resolved-preset-request'],
      conditions: [
        'Profile and defaults are independent axes.',
        'Omitted defaults select every available default for 2D and CUSTOM alike.',
        'Explicit defaults are canonicalized in catalog order and public dependencies are expanded deterministically.',
        'Unknown option keys, unknown or unavailable ids, duplicates, closed composition, duplicate apply, and 2D provider conflict fail before mutation.',
        '3D and HYBRID are known unavailable profiles and import no engine package.'
      ],
      bypasses: [
        'defaults: [] produces an empty selected/applied default list without bypassing profile validation.'
      ],
      allowedContributors: [
        'preset-owned profile/default constants and descriptors',
        'public Core composition/provider queries'
      ],
      forbiddenContributors: [
        'engine capability inference',
        'profile-based default filtering',
        'caller-declared install order',
        'dynamic import from a catalog engine id'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/constants.ts',
        'packages/preset/src/catalog.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: [
        '#public-identifiers-and-catalog',
        '#application-semantics',
        '#failures-and-cleanup'
      ],
      failureOwnerStepId: 'resolve-preset-request',
      cleanupOwnerStepId: 'resolve-preset-request'
    },
    {
      id: 'install-preset-defaults',
      order: 2,
      laneId: 'preset',
      title: 'Install selected official defaults',
      ownerPackage: '@asyra/preset',
      purpose:
        'Install the resolved eight-module public dependency closure in canonical order while acquiring private prerequisites exactly once.',
      inputs: [
        'artifact:resolved-preset-request applied defaults',
        'public CorePresetInstallAPIs',
        'preset-private module and prerequisite installers'
      ],
      outputs: [
        'artifact:installed-default-modules',
        'artifact:preset-cleanup-handles'
      ],
      conditions: [
        'Only the eight catalog modules are app-selectable.',
        'Private property, event, channel, projection, observer, and subscription prerequisites are deduplicated and omitted from public diagnostics.',
        'Every acquired runtime or registration resource has preset-owned reverse cleanup.',
        'Unselected public modules install no product-visible registrations or state.'
      ],
      bypasses: [
        'An empty applied-default list performs no default installation.'
      ],
      allowedContributors: [
        'preset-owned component/property/event/selection/render/UI installers',
        'public CorePresetInstallAPIs',
        'SystemContext-owned managed-property lifecycle through Core'
      ],
      forbiddenContributors: [
        'app-domain FeatureSystem behavior',
        'caller-provided installer or disposer',
        'concrete engine resources',
        'duplicate-registration fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/preset.ts',
        'packages/preset/src/defaults/**',
        'packages/preset/src/components/**',
        'packages/preset/src/props/**',
        'packages/preset/src/events/**',
        'packages/preset/src/selection/**',
        'packages/preset/src/subscriptions/**',
        'packages/preset/src/render-layers/**',
        'packages/preset/src/ui/**',
        'packages/preset/src/__tests__/**',
        'packages/core/src/apis/system-properties.ts',
        'packages/core/src/types/system-properties.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/**',
        'packages/system-context/src/**'
      ],
      specRefs: ['#official-default-modules', '#failures-and-cleanup'],
      failureOwnerStepId: 'install-preset-defaults',
      cleanupOwnerStepId: 'rollback-preset-apply'
    },
    {
      id: 'select-profile-provider',
      order: 3,
      laneId: 'preset',
      title: 'Select preset-owned profile provider',
      ownerPackage: '@asyra/preset',
      purpose:
        'Produce only the provider request owned by the selected available profile, independently from installed defaults.',
      inputs: ['artifact:resolved-preset-request profile'],
      outputs: ['artifact:profile-provider-request'],
      conditions: [
        '2D requests the statically imported Pixi provider through the Core facade.',
        'CUSTOM requests no provider and reports a null presetEngineId.',
        'Catalog engine ids remain diagnostics and are never executed as import paths.'
      ],
      bypasses: [
        'CUSTOM bypasses provider binding without bypassing default installation.'
      ],
      allowedContributors: [
        '@asyra/render-engine-pixi public create function',
        'public Core setRenderEngineProvider facade'
      ],
      forbiddenContributors: [
        'custom app engine passed through preset',
        '3D or Hybrid placeholder provider',
        'profile-derived default selection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/package.json',
        'packages/preset/src/preset.ts',
        'packages/preset/src/catalog.ts',
        'packages/preset/src/composition/profile-provider.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: ['#application-semantics', '#ownership-and-flow'],
      failureOwnerStepId: 'select-profile-provider',
      cleanupOwnerStepId: 'rollback-preset-apply'
    },
    {
      id: 'accept-core-provider',
      order: 1,
      laneId: 'core',
      title: 'Accept one Core render-engine provider',
      ownerPackage: '@asyra/core',
      purpose:
        'Validate one pre-start provider callback and forward it to the Core-bound Render instance without constructing an engine.',
      inputs: [
        'artifact:profile-provider-request or artifact:app-provider-request',
        'open Core composition state'
      ],
      outputs: ['artifact:accepted-core-provider'],
      conditions: [
        'The provider is a zero-argument RenderEngine creator unrelated to @asyra/factory.',
        'A duplicate or post-start provider fails before replacing the accepted provider.',
        'Core exposes provider presence for preset preflight.'
      ],
      bypasses: [
        'A missing provider is allowed and remains absent until Core startup.'
      ],
      allowedContributors: [
        '@asyra/render-engine abstract RenderEngineProvider type',
        'public preset or app composition call'
      ],
      forbiddenContributors: [
        'concrete engine construction',
        'concrete capability inspection',
        '@asyra/factory runtime or types'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/package.json',
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/**',
        'docs/ai/framework/packages/core.md'
      ],
      specRefs: ['#core-render-provider-and-startup'],
      failureOwnerStepId: 'accept-core-provider',
      cleanupOwnerStepId: 'accept-render-provider'
    },
    {
      id: 'accept-render-provider',
      order: 1,
      laneId: 'render',
      title: 'Store provider on the target Render instance',
      ownerPackage: '@asyra/render',
      purpose:
        'Store the accepted provider instance-locally and return reversible pre-runtime cleanup without invoking it.',
      inputs: ['artifact:accepted-core-provider'],
      outputs: ['artifact:stored-render-provider'],
      conditions: [
        'Provider storage is instance-local and concrete-engine-neutral.',
        'The provider is invoked only by Render initialization.',
        'Cleanup clears the exact pre-runtime provider and cannot mutate initialized runtime resources.'
      ],
      bypasses: [
        'No accepted provider leaves Render provider state empty.'
      ],
      allowedContributors: [
        '@asyra/render-engine public provider type',
        'target Render instance'
      ],
      forbiddenContributors: [
        '@asyra/render-engine-pixi import',
        'module-global provider state',
        'automatic Pixi fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/index.ts',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: ['#core-render-provider-and-startup'],
      failureOwnerStepId: 'accept-render-provider',
      cleanupOwnerStepId: 'accept-render-provider'
    },
    {
      id: 'publish-preset-result',
      order: 4,
      laneId: 'preset',
      title: 'Publish frozen preset result',
      ownerPackage: '@asyra/preset',
      purpose:
        'Return one deeply frozen result after defaults and optional preset provider binding complete.',
      inputs: [
        'artifact:resolved-preset-request',
        'artifact:installed-default-modules',
        'artifact:stored-render-provider when 2D'
      ],
      outputs: ['artifact:preset-apply-result'],
      conditions: [
        'Result reports profile, presetEngineId, selectedDefaults, and appliedDefaults only.',
        'Result arrays are detached and canonical.',
        'No public disposer, application handle, install order, or private prerequisite is exposed.',
        'Success means preset apply completed, not Core runtime readiness.'
      ],
      bypasses: [
        'No failed validation, install, provider, or cleanup path publishes a result.'
      ],
      allowedContributors: [
        'completed preset-owned artifacts',
        'deeply frozen public diagnostics'
      ],
      forbiddenContributors: [
        'PresetApplication or public dispose method',
        'actual custom app provider identity',
        'Core ready publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/types.ts',
        'packages/preset/src/composition/result.ts',
        'packages/preset/src/preset.ts',
        'packages/preset/src/index.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: ['#application-semantics', '#failures-and-cleanup'],
      failureOwnerStepId: 'publish-preset-result',
      cleanupOwnerStepId: 'rollback-preset-apply'
    },
    {
      id: 'complete-app-composition',
      order: 2,
      laneId: 'app',
      title: 'Complete app customization and custom provider',
      ownerPackage: 'app or user composition',
      purpose:
        'Customize ordinary Core registrations and optionally bind one custom provider after CUSTOM preset apply and before start.',
      inputs: [
        'artifact:preset-apply-result',
        'public Core registration/provider APIs'
      ],
      outputs: [
        'artifact:completed-app-composition',
        'artifact:app-provider-request'
      ],
      conditions: [
        'Registration customization uses ordinary remove/unregister/define/register APIs.',
        'A custom provider is bound only through Core and never through preset.',
        'All composition completes before core.start().'
      ],
      bypasses: [
        'The default Asyra Design route performs no registration customization or custom provider binding.'
      ],
      allowedContributors: [
        'public Core APIs',
        'app-owned registrations and provider'
      ],
      forbiddenContributors: [
        'preset executing app callbacks',
        'provider binding after start',
        'public replace semantics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/**',
        'docs/ai/framework/golden-paths/preset-composition.md',
        'docs/ai/framework/golden-paths/replace-render-engine.md'
      ],
      specRefs: ['#ownership-and-flow'],
      failureOwnerStepId: 'complete-app-composition',
      cleanupOwnerStepId: 'complete-app-composition'
    },
    {
      id: 'start-core-runtime',
      order: 2,
      laneId: 'core',
      title: 'Close composition and start Core',
      ownerPackage: '@asyra/core',
      purpose:
        'Own the default RenderAdapter, permanent composition closure, relation validation, runtime ordering, headless acceptance, readiness, and renderer teardown facade.',
      inputs: [
        'artifact:completed-app-composition',
        'core.start container and RenderOptions',
        'artifact:render-init-outcome'
      ],
      outputs: ['artifact:core-start-outcome'],
      conditions: [
        'Core owns an engine-neutral RenderAdapter unless an advanced custom renderer was set before start.',
        'The first start closes composition and validates relations before renderer side effects.',
        'A missing-provider outcome from RenderAdapter is accepted as headless with no canvas or input surface.',
        'Headless startup still initializes observers, load, features, and ready in normal order.',
        'Provider callback, engine initialization, capability, and custom-renderer failures stop before later phases and ready.',
        'destroyRenderer delegates resource teardown and never reopens composition.'
      ],
      bypasses: [
        'Headless bypasses canvas append and input setup only.',
        'An advanced custom renderer owns its own surface behavior.'
      ],
      allowedContributors: [
        '@asyra/render public IRenderer/RenderAdapter contracts',
        'Core lifecycle coordinator',
        'validated registration graph'
      ],
      forbiddenContributors: [
        'concrete engine import or capability inspection',
        'swallowing real provider or engine failures',
        'preset publishing ready'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/core-start-render.test.ts',
        'packages/core/src/__tests__/composition-coordinator.test.ts',
        'apps/asyra-design/src/render-app/index.tsx',
        'apps/asyra-design/src/render-app/__tests__/**',
        'docs/ai/framework/packages/core.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md'
      ],
      specRefs: ['#core-render-provider-and-startup', '#ownership-and-flow'],
      failureOwnerStepId: 'start-core-runtime',
      cleanupOwnerStepId: 'start-core-runtime'
    },
    {
      id: 'initialize-render-runtime',
      order: 2,
      laneId: 'render',
      title: 'Initialize provider or report provider absence',
      ownerPackage: '@asyra/render',
      purpose:
        'Keep direct Render strict while producing an exact missing-provider failure that only Core may normalize to headless startup.',
      inputs: [
        'artifact:stored-render-provider when configured',
        'Core-owned or advanced RenderAdapter init request'
      ],
      outputs: ['artifact:render-init-outcome'],
      conditions: [
        'Configured provider is invoked during init and its engine is validated and initialized normally.',
        'No provider throws one stable missing-provider error from direct Render/RenderAdapter use.',
        'Provider callback, invalid engine, initialization, and capability failures retain distinct real failure causes.'
      ],
      bypasses: [
        'Only Core may treat the exact missing-provider outcome as headless.',
        'No provider absence constructs a surface, runtime, or frame loop.'
      ],
      allowedContributors: [
        '@asyra/render-engine abstract contracts',
        'Render instance-local provider state'
      ],
      forbiddenContributors: [
        'Pixi fallback',
        'generic error swallowing',
        'ready publication'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/renderer.ts',
        'packages/render/src/types/**',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: ['#core-render-provider-and-startup'],
      failureOwnerStepId: 'initialize-render-runtime',
      cleanupOwnerStepId: 'initialize-render-runtime'
    },
    {
      id: 'rollback-preset-apply',
      order: 5,
      laneId: 'preset',
      title: 'Rollback failed preset apply',
      ownerPackage: '@asyra/preset',
      purpose:
        'Reverse only acquired preset resources and preserve deterministic internal retry state without a public application handle.',
      inputs: [
        'artifact:preset-cleanup-handles',
        'artifact:stored-render-provider when acquired',
        'failed apply cause'
      ],
      outputs: ['artifact:preset-cleanup-outcome'],
      conditions: [
        'Cleanup runs in exact reverse acquisition order.',
        'Completed cleanup is never repeated; pending cleanup retries before the next apply.',
        'CLEANUP_FAILED reports completed/pending keys and original cause.',
        'Successful cleanup leaves no stale registration, event, channel, observer, subscription, layer, or provider.'
      ],
      bypasses: [
        'Validation failure before mutation has no cleanup.',
        'Unacquired resources contribute no cleanup handle.'
      ],
      allowedContributors: [
        'preset-owned cleanup handles',
        'Render provider cleanup returned through Core'
      ],
      forbiddenContributors: [
        'public PresetApplication.dispose',
        'best-effort success with pending cleanup',
        'cleanup shared across Core instances'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/composition/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: ['#failures-and-cleanup'],
      failureOwnerStepId: 'rollback-preset-apply',
      cleanupOwnerStepId: 'rollback-preset-apply'
    }
  ]

  const routes = [
    {
      id: 'submit-preset-request',
      from: 'request-preset',
      to: 'resolve-preset-request',
      kind: 'startup',
      predicate: 'app calls applyPreset while composition is open',
      producedArtifacts: ['artifact:preset-request']
    },
    {
      id: 'install-resolved-defaults',
      from: 'resolve-preset-request',
      to: 'install-preset-defaults',
      kind: 'success',
      predicate: 'complete request validates before mutation',
      producedArtifacts: ['artifact:resolved-preset-request']
    },
    {
      id: 'select-provider-after-defaults',
      from: 'install-preset-defaults',
      to: 'select-profile-provider',
      kind: 'success',
      predicate: 'all selected defaults and private prerequisites install',
      producedArtifacts: [
        'artifact:installed-default-modules',
        'artifact:preset-cleanup-handles'
      ]
    },
    {
      id: 'bind-2d-provider',
      from: 'select-profile-provider',
      to: 'accept-core-provider',
      kind: 'conditional',
      predicate: 'profile is 2D',
      producedArtifacts: ['artifact:profile-provider-request']
    },
    {
      id: 'forward-provider-to-render',
      from: 'accept-core-provider',
      to: 'accept-render-provider',
      kind: 'success',
      predicate: 'provider is valid, unique, and pre-start',
      producedArtifacts: ['artifact:accepted-core-provider']
    },
    {
      id: 'publish-result-with-provider',
      from: 'accept-render-provider',
      to: 'publish-preset-result',
      kind: 'success',
      predicate: '2D provider is stored without construction',
      producedArtifacts: ['artifact:stored-render-provider']
    },
    {
      id: 'publish-custom-result',
      from: 'select-profile-provider',
      to: 'publish-preset-result',
      kind: 'bypass',
      predicate: 'profile is CUSTOM and requests no preset provider',
      producedArtifacts: []
    },
    {
      id: 'return-result-to-app',
      from: 'publish-preset-result',
      to: 'complete-app-composition',
      kind: 'success',
      predicate: 'preset result is deeply frozen',
      producedArtifacts: ['artifact:preset-apply-result']
    },
    {
      id: 'bind-custom-provider',
      from: 'complete-app-composition',
      to: 'accept-core-provider',
      kind: 'conditional',
      predicate: 'CUSTOM app supplies a provider before start',
      producedArtifacts: ['artifact:app-provider-request']
    },
    {
      id: 'start-completed-core',
      from: 'complete-app-composition',
      to: 'start-core-runtime',
      kind: 'startup',
      predicate: 'app calls core.start after composition',
      producedArtifacts: ['artifact:completed-app-composition']
    },
    {
      id: 'initialize-core-renderer',
      from: 'start-core-runtime',
      to: 'initialize-render-runtime',
      kind: 'startup',
      predicate: 'relations validate and Core initializes its renderer',
      producedArtifacts: []
    },
    {
      id: 'return-render-outcome',
      from: 'initialize-render-runtime',
      to: 'start-core-runtime',
      kind: 'result',
      predicate: 'Render returns success, exact provider absence, or real failure',
      producedArtifacts: ['artifact:render-init-outcome']
    },
    {
      id: 'apply-failure-cleanup',
      from: 'install-preset-defaults',
      to: 'rollback-preset-apply',
      kind: 'failure',
      predicate: 'default installation fails after acquiring resources',
      producedArtifacts: ['artifact:preset-cleanup-handles']
    },
    {
      id: 'provider-failure-cleanup',
      from: 'select-profile-provider',
      to: 'rollback-preset-apply',
      kind: 'failure',
      predicate: 'profile provider binding fails after defaults installed',
      producedArtifacts: ['artifact:preset-cleanup-handles']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:preset-request',
      ownerStepId: 'request-preset',
      consumerStepIds: ['resolve-preset-request']
    },
    {
      id: 'artifact:resolved-preset-request',
      ownerStepId: 'resolve-preset-request',
      consumerStepIds: [
        'install-preset-defaults',
        'select-profile-provider',
        'publish-preset-result'
      ]
    },
    {
      id: 'artifact:installed-default-modules',
      ownerStepId: 'install-preset-defaults',
      consumerStepIds: ['publish-preset-result']
    },
    {
      id: 'artifact:preset-cleanup-handles',
      ownerStepId: 'install-preset-defaults',
      consumerStepIds: ['rollback-preset-apply']
    },
    {
      id: 'artifact:profile-provider-request',
      ownerStepId: 'select-profile-provider',
      consumerStepIds: ['accept-core-provider']
    },
    {
      id: 'artifact:app-provider-request',
      ownerStepId: 'complete-app-composition',
      consumerStepIds: ['accept-core-provider']
    },
    {
      id: 'artifact:accepted-core-provider',
      ownerStepId: 'accept-core-provider',
      consumerStepIds: ['accept-render-provider']
    },
    {
      id: 'artifact:stored-render-provider',
      ownerStepId: 'accept-render-provider',
      consumerStepIds: [
        'publish-preset-result',
        'initialize-render-runtime',
        'rollback-preset-apply'
      ]
    },
    {
      id: 'artifact:preset-apply-result',
      ownerStepId: 'publish-preset-result',
      consumerStepIds: ['complete-app-composition']
    },
    {
      id: 'artifact:completed-app-composition',
      ownerStepId: 'complete-app-composition',
      consumerStepIds: ['start-core-runtime']
    },
    {
      id: 'artifact:render-init-outcome',
      ownerStepId: 'initialize-render-runtime',
      consumerStepIds: ['start-core-runtime']
    },
    {
      id: 'artifact:core-start-outcome',
      ownerStepId: 'start-core-runtime',
      consumerStepIds: []
    },
    {
      id: 'artifact:preset-cleanup-outcome',
      ownerStepId: 'rollback-preset-apply',
      consumerStepIds: []
    }
  ]

  const invariants = [
    'Profile provider policy and defaults selection are independent.',
    'Only preset-owned catalog modules are app-selectable.',
    'No concrete engine is constructed before Core start.',
    'Missing provider is headless only at Core startup; real engine failures remain errors.',
    'The first Core start closes composition permanently.',
    'Preset never executes app customization or publishes runtime readiness.'
  ]

  const productCases = [
    { id: 'omitted-options', summary: '2D plus all eight defaults.' },
    {
      id: 'custom-all-defaults',
      summary: 'CUSTOM plus omitted defaults installs all defaults and no provider.'
    },
    { id: 'empty-defaults', summary: 'Empty defaults install no modules.' },
    {
      id: 'profile-default-independence',
      summary: '2D and CUSTOM resolve identical explicit defaults.'
    },
    {
      id: 'dependency-expansion',
      summary: 'Vector editing and UI context expand only declared public dependencies.'
    },
    {
      id: 'unavailable-profiles',
      summary: '3D and HYBRID fail before mutation and import no runtime.'
    },
    {
      id: 'strict-validation',
      summary: 'Unknown/duplicate/legacy/closed/duplicate-apply inputs fail before accepted mutation.'
    },
    {
      id: 'partial-failure-cleanup',
      summary: 'Partial apply reverses exact acquired resources.'
    },
    {
      id: 'cleanup-retry',
      summary: 'Only pending cleanup retries before the next apply.'
    },
    {
      id: 'core-default-renderer',
      summary: 'Core starts without app setRenderer.'
    },
    {
      id: 'headless-core-start',
      summary: 'Missing provider produces no surface but completes Core startup.'
    },
    {
      id: 'strict-render-failure',
      summary: 'Direct Render and real provider/engine failures remain strict.'
    },
    {
      id: 'asyra-design-compatibility',
      summary: 'Default app startup and visible behavior remain unchanged.'
    }
  ]

  const definitionOfDone = [
    {
      id: 'public-contract',
      summary: 'Profile/default/catalog/result/provider APIs are formally tested.'
    },
    {
      id: 'module-selection',
      summary: 'Eight modules and public dependencies are deterministic and selectable.'
    },
    {
      id: 'failure-cleanup',
      summary: 'Validation, rollback, and cleanup retry leave no stale resources.'
    },
    {
      id: 'core-render-ownership',
      summary: 'Core owns default renderer, headless normalization, and teardown facade.'
    },
    {
      id: 'boundary-safety',
      summary: 'Render stays abstract and only preset imports the default concrete engine.'
    },
    {
      id: 'full-validation',
      summary: 'Package/app/Inspector/root/build/lint/dependency/diff/live/visual gates pass.'
    }
  ]

  const data = {
    schema: 'flow-inspector.v1',
    target: {
      id: 'preset-profile-selectable-defaults',
      title: 'Preset Profile and Selectable Defaults Flow',
      summary:
        'Independent engine profile and official default module composition before Core-owned renderer startup.'
    },
    authority: {
      specPath,
      inspectorPath,
      rulePaths: [
        'docs/ai/framework/rules/inspector-contract-readiness.md',
        'docs/ai/framework/rules/inspector-step-execution.md',
        'docs/ai/framework/rules/pre-release-legacy-removal.md',
        'docs/ai/framework/plans/completed/extendable-preset-plan.md',
        'docs/ai/framework/plans/completed/render-engine-boundary-plan.md'
      ]
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product contract',
        href: '../../../docs/ai/framework/plans/completed/preset-composition-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: '../inspectors/__tests__/preset-composition-flow-inspector.contract.test.cjs'
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
