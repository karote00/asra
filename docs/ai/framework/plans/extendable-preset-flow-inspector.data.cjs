;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/extendable-preset-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/extendable-preset-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Composition', order: 1 },
    { id: 'preset', title: 'Preset Defaults', order: 2 },
    { id: 'core', title: 'Core Facade', order: 3 },
    { id: 'feature', title: 'Feature Runtime', order: 4 },
    { id: 'property', title: 'Property Runtime', order: 5 },
    { id: 'registry', title: 'Registry Primitive', order: 6 }
  ]

  const steps = [
    {
      id: 'compose-app-preset-customization',
      order: 1,
      laneId: 'app',
      title: 'Choose preset customization',
      ownerPackage: '@asyra/asyra-design',
      purpose:
        'Choose whether app-owned behavior extends a supported preset target or replaces it through the documented fallback without taking framework ownership.',
      inputs: [
        'app startup intent',
        'queryable preset target metadata',
        'app-owned feature or property implementation'
      ],
      outputs: ['artifact:app-customization-request'],
      conditions: [
        'The app chooses extend, explicit replace, or unregister then redefine through public @asyra/preset and @asyra/core surfaces.',
        'The compatibility startup path may keep calling applyPreset(core) with no customization.',
        'App-owned ordering intent is explicit in the extension strategy and extension array order.'
      ],
      bypasses: [
        'When no app customization is requested, startup follows the unchanged applyPreset(core) compatibility route.'
      ],
      allowedContributors: [
        'apps/asyra-design startup composition',
        '@asyra/preset public target constants and types',
        '@asyra/core public registration facade'
      ],
      forbiddenContributors: [
        'framework internals or preset implementation-local imports',
        'app-specific policy inside framework packages',
        'Generic Preset Composition layers',
        'render-engine capability derived product mode'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/**',
        'apps/asyra-design/package.json',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md',
        'docs/ai/decisions/releases/unreleased.md'
      ],
      specRefs: ['#public-contract', '#product-cases', '#definition-of-done'],
      failureOwnerStepId: 'compose-app-preset-customization'
    },
    {
      id: 'apply-preset-targets',
      order: 1,
      laneId: 'preset',
      title: 'Apply preset extension targets',
      ownerPackage: '@asyra/preset',
      purpose:
        'Own optional defaults, stable feature/property target metadata, fixed target ordering, extension hooks, and the lifetime of one preset application.',
      inputs: [
        'applyPreset(core) or its compatible options overload',
        'artifact:app-customization-request',
        'artifact:extension-contract',
        'preset-owned default feature/property target manifest'
      ],
      outputs: [
        'artifact:preset-application',
        'artifact:feature-registration-request',
        'artifact:property-registration-request'
      ],
      conditions: [
        'Each preset extension target has a stable target key, stable name, capability kind, supported strategies, and queryable owner metadata naming @asyra/preset.',
        'The fixed preset target manifest applies property definition targets, property runtime targets, and the feature registration hook in documented deterministic order.',
        'A direct explicit replace is resolved by the extension contract and is not sent through ordinary duplicate registration.',
        'applyPreset(core), the existing explicit dependency overload, and the custom renderEngineFactory overload remain compatible.',
        'One returned preset application owns successful target cleanup handles and can dispose them in reverse application order.',
        'Preset selects defaults and exposes hooks but does not become feature-system, props-manager, app-domain, or render-engine runtime owner.'
      ],
      bypasses: [
        'A target default is bypassed only by one valid explicit replace.',
        'A target with no direct extension strategy uses the formal unregister then redefine route.',
        'No extensions preserves existing applyPreset(core) startup behavior.'
      ],
      allowedContributors: [
        '@asyra/utils extension registry primitive',
        '@asyra/core public preset-install facade',
        'preset-owned default property schemas and constructors',
        'app-owned extension installers with cleanup handles'
      ],
      forbiddenContributors: [
        'feature runtime semantics',
        'property schema model redesign',
        'Generic Preset Composition',
        'app-specific policy',
        '3D, Hybrid, multi-engine, or render-mode selection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/index.ts',
        'packages/preset/src/preset.ts',
        'packages/preset/src/types.ts',
        'packages/preset/src/extension-targets.ts',
        'packages/preset/src/props/**',
        'packages/preset/src/__tests__/**',
        'packages/preset/package.json',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/golden-paths/extend-preset-capability.md'
      ],
      specRefs: [
        '#target-behavior',
        '#public-contract',
        '#package-ownership',
        '#product-cases'
      ],
      failureOwnerStepId: 'apply-preset-targets'
    },
    {
      id: 'unregister-preset-target',
      order: 2,
      laneId: 'preset',
      title: 'Unregister preset target',
      ownerPackage: '@asyra/preset',
      purpose:
        'Provide the deterministic first half of fallback replacement and dispose every resource owned by the applied target before removing it.',
      inputs: [
        'artifact:preset-application',
        'stable target key',
        'artifact:target-cleanup-capability'
      ],
      outputs: ['artifact:target-unregister-result'],
      conditions: [
        'The target must exist in this preset application and must currently be applied.',
        'Unregister validates active usage through the owning runtime and fails before partial cleanup when replacement is unsafe.',
        'Successful unregister invokes owned dispose handles in reverse application order and reports a structured success result.',
        'A cleanup failure is reported by stable structured error code and never masquerades as successful removal.'
      ],
      bypasses: [
        'A missing or already-unregistered target fails fast and does not run a redefine callback.',
        'A supported direct extension stays on the ordinary preset extension route.'
      ],
      allowedContributors: [
        'preset application lifetime',
        '@asyra/feature-system feature disposer',
        '@asyra/props-manager registration disposer',
        'extension-owned cleanup handle'
      ],
      forbiddenContributors: [
        'duplicate-registration tolerance',
        'fallback state that leaves the default active',
        'silent cleanup failure',
        'unrelated preset target disposal'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/extension-targets.ts',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**'
      ],
      specRefs: ['#public-contract', '#product-cases'],
      failureOwnerStepId: 'unregister-preset-target'
    },
    {
      id: 'expose-core-registration-facade',
      order: 1,
      laneId: 'core',
      title: 'Expose registration facade',
      ownerPackage: '@asyra/core',
      purpose:
        'Expose curated public feature/property define, query, and unregister operations needed by preset installers and app replacements.',
      inputs: [
        'artifact:feature-registration-request',
        'artifact:property-registration-request',
        'stable feature name or property type'
      ],
      outputs: [
        'artifact:feature-runtime-registration',
        'artifact:property-runtime-registration',
        'artifact:target-cleanup-capability'
      ],
      conditions: [
        'The public facade delegates feature lifecycle to @asyra/feature-system and property lifecycle to the Core-injected @asyra/props-manager runtime.',
        'Facade methods preserve registry duplicate failures and structured unregister outcomes.',
        'Apps and preset extensions need no deep import or package-internal access.'
      ],
      bypasses: [
        'Core does not apply preset targets when a consumer skips @asyra/preset.'
      ],
      allowedContributors: [
        '@asyra/feature-system public APIs',
        '@asyra/props-manager public APIs',
        'Core-injected package instances'
      ],
      forbiddenContributors: [
        'Core must not choose extension or replacement policy',
        'preset target manifests',
        'app-specific feature or property policy',
        'package-internal deep imports'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/define-property-component.ts',
        'packages/core/src/__tests__/**',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md'
      ],
      specRefs: ['#package-ownership', '#public-contract'],
      failureOwnerStepId: 'expose-core-registration-facade'
    },
    {
      id: 'register-feature-capability',
      order: 1,
      laneId: 'feature',
      title: 'Register feature capability',
      ownerPackage: '@asyra/feature-system',
      purpose:
        'Register one feature through existing execution/session semantics and own complete feature unregistration cleanup.',
      inputs: ['artifact:feature-runtime-registration'],
      outputs: [
        'artifact:registered-feature',
        'artifact:feature-cleanup-result'
      ],
      conditions: [
        'Feature registration keeps existing priority, exclusive, execution, and session semantics unchanged.',
        'Unregister removes registry entries, pending registrations, execution handlers, session handlers, input subscriptions, and reactive event subscriptions owned by the feature.',
        'Unregister rejects active usage before partial removal and successful replacement leaves no stale side effects.',
        'Multiple features sharing one trigger keep the shared transport subscription until its final participant is removed.'
      ],
      bypasses: [
        'A missing feature returns the documented missing result without touching unrelated handlers.',
        'An active feature session prevents synchronous unregister until the session is ended or cancelled through existing runtime semantics.'
      ],
      allowedContributors: [
        'FeatureRegistry',
        'ExecutionRegistry',
        'SessionManager',
        '@asyra/input-system public listener cleanup',
        '@asyra/reactive-events subscription cleanup'
      ],
      forbiddenContributors: [
        'new feature execution semantics',
        'app-domain feature policy',
        'silent handler retention',
        'stale side effects after unregister'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/feature-system/src/core/feature.ts',
        'packages/feature-system/src/core/feature-registry.ts',
        'packages/feature-system/src/core/execution-registry.ts',
        'packages/feature-system/src/core/session-manager.ts',
        'packages/feature-system/src/types/**',
        'packages/feature-system/__tests__/**',
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/__tests__/**',
        'docs/ai/framework/packages/feature-system.md',
        'docs/ai/framework/packages/input-system.md'
      ],
      specRefs: ['#scope', '#public-contract', '#product-cases'],
      failureOwnerStepId: 'register-feature-capability'
    },
    {
      id: 'register-property-capability',
      order: 1,
      laneId: 'property',
      title: 'Register property capability',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Register property definition/schema and runtime constructor surfaces without changing the property schema model, then own safe unregistration.',
      inputs: ['artifact:property-runtime-registration'],
      outputs: [
        'artifact:registered-property',
        'artifact:property-cleanup-result'
      ],
      conditions: [
        'Property definition, schema registration, and runtime constructor registration remain separate existing registry responsibilities.',
        'Unified replacement cleanup rejects active usage of the property type before removing schema or runtime registration.',
        'Successful unregister removes the owned schema and constructor registrations and leaves no stale side effects.',
        'Runtime valid-write/invalid-reject and load invalid-fallback semantics remain unchanged.'
      ],
      bypasses: [
        'A missing property registration returns the documented missing result.',
        'An active property instance prevents unregister so a replacement cannot reinterpret live scene data.'
      ],
      allowedContributors: [
        'property definition registry',
        'property schema registry',
        'property component registry',
        'Core-injected PropsManager active instance query'
      ],
      forbiddenContributors: [
        'property schema model redesign',
        'app migration policy',
        'active-instance reinterpretation',
        'stale side effects after unregister'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src/index.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/registries/property-component.ts',
        'packages/props-manager/src/registries/property-schema.ts',
        'packages/props-manager/src/registries/property-definition.ts',
        'packages/props-manager/src/types/**',
        'packages/props-manager/src/__tests__/**',
        'docs/ai/framework/packages/props-manager.md'
      ],
      specRefs: ['#scope', '#public-contract', '#product-cases'],
      failureOwnerStepId: 'register-property-capability'
    },
    {
      id: 'resolve-extension-contract',
      order: 1,
      laneId: 'registry',
      title: 'Resolve extension contract',
      ownerPackage: '@asyra/utils',
      purpose:
        'Provide the framework-neutral target registry, deterministic strategy resolver, lifecycle journal, metadata query, and structured result/error primitives.',
      inputs: [
        'stable target key and name',
        'queryable owner metadata',
        'supported strategy list',
        'ordered extension registrations'
      ],
      outputs: [
        'artifact:extension-contract',
        'artifact:resolved-extension-order',
        'artifact:extension-operation-result'
      ],
      conditions: [
        'Supported strategies are exactly before, after, append, and replace.',
        'Resolution order is before extensions, then the default or one explicit replacement, then after extensions, then append extensions; input array order is preserved within each explicit bucket.',
        'Duplicate extension key, missing target, invalid strategy, unsupported strategy, and replace conflict fail fast with a stable error code and structured result/error payload.',
        'Explicit replace bypasses the default installer and is never treated as an ordinary duplicate registration.',
        'Apply failure disposes already-created lifecycle resources in reverse order before reporting failure.',
        'Target and extension metadata are returned as detached query results so callers cannot mutate registry authority.'
      ],
      bypasses: [
        'A target that does not list a direct strategy rejects it without running any installer.',
        'A target may be unregistered through its owning application before an app redefines the capability through public runtime APIs.'
      ],
      allowedContributors: [
        'MapRegistry',
        'plain TypeScript metadata and discriminated result types',
        'cleanup callbacks owned by successful installers'
      ],
      forbiddenContributors: [
        '@asyra/preset defaults',
        'feature runtime semantics',
        'property schema semantics',
        'Generic Preset Composition',
        'render-engine capability inspection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/registry/extension-registry.ts',
        'packages/utils/src/registry/index.ts',
        'packages/utils/src/index.ts',
        'packages/utils/src/registry/__tests__/extension-registry.test.ts',
        'docs/ai/framework/CODING_STANDARDS.md',
        'docs/ai/framework/packages/utils.md',
        'docs/ai/framework/rules/extension-patterns.md'
      ],
      specRefs: ['#public-contract', '#product-cases'],
      failureOwnerStepId: 'resolve-extension-contract'
    },
    {
      id: 'redefine-app-capability',
      order: 2,
      laneId: 'app',
      title: 'Redefine app capability',
      ownerPackage: 'app or user composition',
      purpose:
        'Complete fallback replacement only after deterministic target cleanup by registering the custom implementation through public Core APIs.',
      inputs: [
        'artifact:target-unregister-result',
        'app-owned custom feature or property implementation'
      ],
      outputs: ['artifact:app-owned-replacement'],
      conditions: [
        'Redefine starts only after a successful unregister result for the intended stable target key.',
        'The custom implementation uses public feature/property registration APIs and becomes app-owned.',
        'Registration failure remains visible and never restores a hidden preset fallback.'
      ],
      bypasses: [
        'A failed unregister blocks redefine.',
        'A supported direct extension does not enter this fallback step.'
      ],
      allowedContributors: [
        '@asyra/core public facade',
        'app-owned feature/property implementation'
      ],
      forbiddenContributors: [
        'preset internals',
        'framework package deep imports',
        'duplicate-registration tolerance',
        'automatic default restoration'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'consumer-owned code outside this repository',
        'apps/asyra-design/src/init/**',
        'apps/asyra-design/src/features/**'
      ],
      specRefs: ['#target-behavior', '#public-contract'],
      failureOwnerStepId: 'redefine-app-capability'
    }
  ]

  const routes = [
    {
      id: 'declare-preset-extensions',
      from: 'compose-app-preset-customization',
      to: 'apply-preset-targets',
      kind: 'conditional',
      predicate: 'the app supplies ordered public preset extensions',
      producedArtifacts: ['artifact:app-customization-request']
    },
    {
      id: 'use-compatibility-preset',
      from: 'compose-app-preset-customization',
      to: 'apply-preset-targets',
      kind: 'normal',
      predicate: 'the app calls applyPreset(core) without customization',
      producedArtifacts: ['artifact:app-customization-request']
    },
    {
      id: 'provide-extension-contract',
      from: 'resolve-extension-contract',
      to: 'apply-preset-targets',
      kind: 'normal',
      predicate: 'preset constructs one application-scoped target registry',
      producedArtifacts: [
        'artifact:extension-contract',
        'artifact:resolved-extension-order',
        'artifact:extension-operation-result'
      ]
    },
    {
      id: 'forward-feature-registration',
      from: 'apply-preset-targets',
      to: 'expose-core-registration-facade',
      kind: 'conditional',
      predicate: 'a feature target installer runs',
      producedArtifacts: ['artifact:feature-registration-request']
    },
    {
      id: 'forward-property-registration',
      from: 'apply-preset-targets',
      to: 'expose-core-registration-facade',
      kind: 'normal',
      predicate: 'a property definition or runtime target installer runs',
      producedArtifacts: ['artifact:property-registration-request']
    },
    {
      id: 'delegate-feature-runtime',
      from: 'expose-core-registration-facade',
      to: 'register-feature-capability',
      kind: 'conditional',
      predicate: 'Core receives a feature define or unregister request',
      producedArtifacts: [
        'artifact:feature-runtime-registration',
        'artifact:target-cleanup-capability'
      ]
    },
    {
      id: 'delegate-property-runtime',
      from: 'expose-core-registration-facade',
      to: 'register-property-capability',
      kind: 'normal',
      predicate:
        'Core receives a property define, schema, or unregister request',
      producedArtifacts: [
        'artifact:property-runtime-registration',
        'artifact:target-cleanup-capability'
      ]
    },
    {
      id: 'publish-preset-application',
      from: 'apply-preset-targets',
      kind: 'terminal',
      predicate: 'all resolved installers complete successfully',
      producedArtifacts: ['artifact:preset-application']
    },
    {
      id: 'request-target-unregister',
      from: 'apply-preset-targets',
      to: 'unregister-preset-target',
      kind: 'conditional',
      predicate:
        'the app invokes fallback replacement on the returned application',
      producedArtifacts: [
        'artifact:preset-application',
        'artifact:target-cleanup-capability'
      ]
    },
    {
      id: 'fallback-unregister-then-redefine',
      from: 'unregister-preset-target',
      to: 'redefine-app-capability',
      kind: 'conditional',
      predicate:
        'direct extension is not supported and target unregister succeeds',
      producedArtifacts: ['artifact:target-unregister-result']
    },
    {
      id: 'feature-registration-terminal',
      from: 'register-feature-capability',
      kind: 'terminal',
      predicate: 'feature registration or cleanup completes',
      producedArtifacts: [
        'artifact:registered-feature',
        'artifact:feature-cleanup-result'
      ]
    },
    {
      id: 'property-registration-terminal',
      from: 'register-property-capability',
      kind: 'terminal',
      predicate: 'property registration or cleanup completes',
      producedArtifacts: [
        'artifact:registered-property',
        'artifact:property-cleanup-result'
      ]
    },
    {
      id: 'app-replacement-terminal',
      from: 'redefine-app-capability',
      kind: 'terminal',
      predicate: 'the app-owned replacement registers successfully',
      producedArtifacts: ['artifact:app-owned-replacement']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:app-customization-request',
      ownerStepId: 'compose-app-preset-customization',
      consumerStepIds: ['apply-preset-targets']
    },
    {
      id: 'artifact:extension-contract',
      ownerStepId: 'resolve-extension-contract',
      consumerStepIds: ['apply-preset-targets']
    },
    {
      id: 'artifact:resolved-extension-order',
      ownerStepId: 'resolve-extension-contract',
      consumerStepIds: ['apply-preset-targets']
    },
    {
      id: 'artifact:extension-operation-result',
      ownerStepId: 'resolve-extension-contract',
      consumerStepIds: ['apply-preset-targets']
    },
    {
      id: 'artifact:preset-application',
      ownerStepId: 'apply-preset-targets',
      consumerStepIds: ['unregister-preset-target']
    },
    {
      id: 'artifact:feature-registration-request',
      ownerStepId: 'apply-preset-targets',
      consumerStepIds: ['expose-core-registration-facade']
    },
    {
      id: 'artifact:property-registration-request',
      ownerStepId: 'apply-preset-targets',
      consumerStepIds: ['expose-core-registration-facade']
    },
    {
      id: 'artifact:feature-runtime-registration',
      ownerStepId: 'expose-core-registration-facade',
      consumerStepIds: ['register-feature-capability']
    },
    {
      id: 'artifact:property-runtime-registration',
      ownerStepId: 'expose-core-registration-facade',
      consumerStepIds: ['register-property-capability']
    },
    {
      id: 'artifact:target-cleanup-capability',
      ownerStepId: 'expose-core-registration-facade',
      consumerStepIds: ['apply-preset-targets', 'unregister-preset-target']
    },
    {
      id: 'artifact:registered-feature',
      ownerStepId: 'register-feature-capability',
      consumerStepIds: []
    },
    {
      id: 'artifact:feature-cleanup-result',
      ownerStepId: 'register-feature-capability',
      consumerStepIds: ['unregister-preset-target']
    },
    {
      id: 'artifact:registered-property',
      ownerStepId: 'register-property-capability',
      consumerStepIds: []
    },
    {
      id: 'artifact:property-cleanup-result',
      ownerStepId: 'register-property-capability',
      consumerStepIds: ['unregister-preset-target']
    },
    {
      id: 'artifact:target-unregister-result',
      ownerStepId: 'unregister-preset-target',
      consumerStepIds: ['redefine-app-capability']
    },
    {
      id: 'artifact:app-owned-replacement',
      ownerStepId: 'redefine-app-capability',
      consumerStepIds: []
    }
  ]

  const invariants = [
    'Framework packages provide deterministic registry/runtime primitives; preset owns optional defaults and extension hooks; the app only chooses extend or replace policy.',
    'Duplicate registrations, missing targets, invalid or unsupported strategies, and replacement conflicts remain visible structured failures.',
    'Unregister and replacement dispose owned observers, handlers, subscriptions, and lifecycle resources before the target is removed.',
    'The fallback is exactly unregister default then redefine custom implementation; no fallback state or duplicate tolerance may hide owner errors.',
    'Existing feature execution/session semantics and property schema validation/fallback semantics do not change.',
    'Generic Preset Composition, 3D/Hybrid profiles, multi-engine composition, and product mode inferred from render-engine capability remain outside this contract.'
  ]

  const productCases = [
    {
      id: 'feature-extension',
      summary:
        'An app registers a feature through a public preset extension target and existing feature runtime semantics execute it.'
    },
    {
      id: 'property-extension',
      summary:
        'An app registers property definition/schema or runtime behavior through a public preset target without preset internals.'
    },
    {
      id: 'explicit-replace',
      summary:
        'One explicit replace bypasses the default and does not trigger ordinary duplicate registration.'
    },
    {
      id: 'structured-failures',
      summary:
        'Duplicate key, missing target, invalid or unsupported strategy, and replace conflict fail fast with stable structured errors.'
    },
    {
      id: 'fallback-replacement',
      summary:
        'A target without direct extension support is unregistered and only then redefined by the app.'
    },
    {
      id: 'lifecycle-cleanup',
      summary:
        'Feature/property unregister and preset disposal remove owned observers, handlers, subscriptions, and stale effects.'
    },
    {
      id: 'startup-compatibility',
      summary:
        'Preset target order is deterministic and existing applyPreset(core) plus engine/dependency overloads remain compatible.'
    },
    {
      id: 'render-mode-non-inference',
      summary:
        'No extension or replacement path derives product mode from render-engine capabilities.'
    }
  ]

  const definitionOfDone = [
    {
      id: 'public-contracts',
      summary:
        'Stable public target keys, names, owner metadata, extension types, results, errors, query APIs, and fallback APIs are documented and tested.'
    },
    {
      id: 'deterministic-ordering',
      summary:
        'before/default-or-replace/after/append ordering and fixed preset target order are deterministic under formal tests.'
    },
    {
      id: 'cleanup',
      summary:
        'Unregister, replace, apply rollback, and application disposal release every owned resource without stale effects.'
    },
    {
      id: 'compatibility',
      summary:
        'Existing applyPreset(core), explicit dependency bundle, custom engine factory, and framework-facing APIs remain compatible.'
    },
    {
      id: 'package-boundaries',
      summary:
        'Framework/preset/app ownership and monorepo import boundaries pass formal validation with no deep imports.'
    },
    {
      id: 'full-validation',
      summary:
        'Affected package tests, Inspector test, Asyra Design tests, root test:local, lint:ci, react:build, and dependency boundary gates pass.'
    }
  ]

  const data = {
    schema: 'asyra.flow-inspector.v1',
    target: {
      id: 'extendable-preset',
      title: 'Extendable Preset Flow',
      summary:
        'Deterministic feature/property preset extension, explicit replacement, and unregister-then-redefine fallback.'
    },
    authority: {
      specPath,
      inspectorPath,
      rulePaths: [
        'docs/ai/framework/rules/inspector-contract-readiness.md',
        'docs/ai/framework/rules/inspector-step-execution.md',
        'docs/ai/framework/rules/extension-patterns.md'
      ]
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product contract',
        href: './extendable-preset-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: './extendable-preset-flow-inspector.contract.test.cjs'
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
