;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/completed/extendable-preset-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/extendable-preset-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Composition', order: 1 },
    { id: 'preset', title: 'Preset Defaults', order: 2 },
    { id: 'core', title: 'Core Coordinator', order: 3 },
    { id: 'component', title: 'Component Relations', order: 4 },
    { id: 'property', title: 'Property Relations', order: 5 },
    { id: 'runtime', title: 'Opaque Runtime Owners', order: 6 },
    { id: 'registry', title: 'Registration Graph', order: 7 }
  ]

  const steps = [
    {
      id: 'compose-app-startup',
      order: 1,
      laneId: 'app',
      title: 'Compose app startup',
      ownerPackage: 'app or user composition',
      purpose:
        'Select preset defaults, then customize registrations through ordinary public Core remove, define, register, and unregister APIs before the first start.',
      inputs: [
        'app startup intent',
        'public @asyra/preset applyPreset facade',
        'public @asyra/core registration facade',
        'optional app-owned load migration'
      ],
      outputs: ['artifact:app-composition'],
      conditions: [
        'The normal route is applyPreset(core), Core remove/unregister/define/register calls, optional app migration registration, then core.start().',
        'A new app feature uses core.defineFeature directly and never requires a preset-specific feature target.',
        'The app explicitly changes render or UI registrations when structural property relation changes require different product behavior.',
        'The no-customization route remains applyPreset(core) followed by normal startup.'
      ],
      bypasses: [
        'When no customization is requested, no relation mutation or unregister operation is issued.',
        'An app may skip @asyra/preset and define all registrations through public Core APIs.'
      ],
      allowedContributors: [
        'app startup code',
        '@asyra/preset public facade',
        '@asyra/core public facade',
        'app-owned migration functions'
      ],
      forbiddenContributors: [
        'preset implementation-local or framework deep imports',
        'app-specific policy inside framework packages',
        'preset-specific app extension objects',
        'semantic equivalence inference',
        'render-engine capability derived product mode'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/**',
        'docs/ai/apps/asyra-design/APP_ESSENTIALS.md',
        'docs/ai/apps/asyra-design/ARCHITECTURE.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md',
        'docs/ai/apps/asyra-design/modules/init-and-startup.md',
        'docs/ai/apps/asyra-design/modules/registrations.md'
      ],
      specRefs: ['#startup-composition', '#app-composition', '#product-cases'],
      failureOwnerStepId: 'compose-app-startup'
    },
    {
      id: 'install-preset-defaults',
      order: 1,
      laneId: 'preset',
      title: 'Install explicit preset defaults',
      ownerPackage: '@asyra/preset',
      purpose:
        'Install selected exported property, component, render, and UI defaults through the supplied Core registration graph.',
      inputs: [
        'applyPreset(core, options?) current profile/default contract',
        'exported preset definitions',
        'artifact:registration-graph-contract'
      ],
      outputs: [
        'artifact:preset-default-registration-state',
        'artifact:preset-registration-declarations'
      ],
      conditions: [
        'Importing preset modules does not register components; applyPreset(core) performs explicit deterministic installation.',
        'Preset defaults use stable @asyra/preset/default-preset owner metadata without requiring app input.',
        'Component properties and property children produce structural detach relations automatically.',
        'Feature, render, UI, and custom-constructor dependencies are declared only on their local registration definitions.',
        'applyPreset(core, options?) uses the current profile/default contract and installs only preset-owned catalog modules.',
        'Successful preset application is permanent for that open Core composition and exposes no public lifecycle handle.',
        'Preset registration installation and later app Core customization use the same canonical graph.',
        'Failed apply rollback owns acquired events, selections, shared channels, system subscriptions, data-channel observers, render layers, and graph registrations.',
        'Failed-apply cleanup retry reports pending resources; completed cleanup does not run again.',
        'Validation and graph preflight complete before accepted preset mutation so a closed composition leaves active wiring intact.',
        'The supplied Core facade owns shared channels and data-channel observers; preset does not bypass it through default singletons.',
        'After apply rollback cleanup fails, the next apply on that Core will retry pending rollback cleanup before installing defaults.'
      ],
      bypasses: [
        'An app that skips the preset receives no preset registrations or side effects.',
        'An already-unregistered node is not cleaned a second time during recursive graph cleanup.',
        'Shared channels supplied before applyPreset remain app-owned and survive failed-apply rollback.'
      ],
      allowedContributors: [
        '@asyra/core public registration facade',
        'preset-owned exported definitions',
        'preset-owned failed-apply cleanup handles',
        'package-owned unregister and subscription disposer APIs'
      ],
      forbiddenContributors: [
        'app-specific customization policy',
        'preset import-time component registration',
        'module-global one-shot flags that bypass a later Core lifetime',
        'preset-specific feature-registration target',
        'Generic Preset Composition',
        '2D, 3D, Hybrid, or multi-engine product selection'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/composition-coordinator.test.ts',
        'packages/utils/src/registry/registration-graph.ts',
        'packages/preset/src/catalog.ts',
        'packages/preset/src/cleanup-reporter.ts',
        'packages/preset/src/composition/**',
        'packages/preset/src/constants.ts',
        'packages/preset/src/defaults/**',
        'packages/preset/src/index.ts',
        'packages/preset/src/preset.ts',
        'packages/preset/src/registration.ts',
        'packages/preset/src/system-property-keys.ts',
        'packages/preset/src/types.ts',
        'packages/preset/src/components/**',
        'packages/preset/src/props/**',
        'packages/preset/src/render-layers/**',
        'packages/preset/src/events/**',
        'packages/preset/src/selection/**',
        'packages/preset/src/subscriptions/**',
        'packages/preset/src/ui/**',
        'packages/preset/src/vector/**',
        'packages/preset/src/__tests__/**',
        'packages/selection/src/selection-manager.ts',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/CODING_STANDARDS.md',
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/design-principles/extensible-runtime-guarantees.md',
        'docs/ai/framework/decisions/releases/unreleased.md',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/golden-paths/extend-preset-capability.md',
        'docs/ai/framework/plans/completed/preset-composition-plan.md',
        'docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md'
      ],
      specRefs: [
        '#asyrapreset-explicit-defaults',
        '#product-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'install-preset-defaults'
    },
    {
      id: 'coordinate-composition-state',
      order: 1,
      laneId: 'core',
      title: 'Coordinate startup composition state',
      ownerPackage: '@asyra/core',
      purpose:
        'Expose curated owner APIs, coordinate one registration graph, validate declared relations, and permanently close composition when start begins.',
      inputs: [
        'artifact:app-composition',
        'artifact:registration-graph-contract',
        'Core injected runtime owners',
        'core.start input'
      ],
      outputs: [
        'artifact:core-registration-facade',
        'artifact:composition-closed',
        'artifact:dangling-validation-result'
      ],
      conditions: [
        'The public facade exposes component, feature, property, render strategy, and UI property owner APIs without choosing app policy.',
        'The first core.start() closes relation mutation and unregisterPropertyType permanently at method entry, even if renderer initialization later fails.',
        'Dangling relation validation runs after closure and before renderer side effects.',
        'Every closed or dangling failure uses RegistrationRelationError with a stable structured code.',
        'Standalone helpers retain default-Core compatibility while preset always uses the supplied Core instance.',
        'Each Core injected Factory owns shared channels and data-channel observers for that Core.',
        'The same observer name may exist on a different Core because observer registries are instance-owned.',
        'The default Core and standalone observer helpers share one explicitly injected default observer registry; custom Core instances receive distinct registries.'
      ],
      bypasses: [
        'Core consumers that never call applyPreset can still register their own definitions before start.',
        'Low-level property schema/runtime cleanup remains separate from graph-aware unregisterPropertyType.',
        'Default-Core standalone observer helpers continue to use the default Factory compatibility instance.'
      ],
      allowedContributors: [
        '@asyra/utils registration graph',
        'Core-injected scene-tree, props-manager, render, and ui-context owners',
        'Core-injected Factory shared-channel and observer owner',
        '@asyra/feature-system public APIs'
      ],
      forbiddenContributors: [
        'preset manifests in Core',
        'app-specific policy',
        'reopening composition after failed start',
        'renderer side effects before dangling validation',
        'package-internal deep imports'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/index.ts',
        'packages/core/src/data-channel-observer.ts',
        'packages/core/src/define-property-component.ts',
        'packages/core/src/__tests__/**',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md'
      ],
      specRefs: [
        '#core-app-facing-apis',
        '#asyra-core-composition-coordinator',
        '#structured-operation-contract'
      ],
      failureOwnerStepId: 'coordinate-composition-state'
    },
    {
      id: 'mutate-component-property-relations',
      order: 1,
      laneId: 'component',
      title: 'Mutate component property relations',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Retain declarative component definitions and atomically remove or define exact property slots while preserving the component registration.',
      inputs: [
        'component type',
        'property definition or property slot name',
        'artifact:core-registration-facade'
      ],
      outputs: [
        'artifact:component-relation-result',
        'artifact:rebuilt-component-registration'
      ],
      conditions: [
        'defineComponent records one automatic detach relation for every declared property slot.',
        'Removal preserves component identity, counters, unrelated slots, render ownership, and registered property capabilities.',
        'Definition validates the component, property runtime, duplicate slot, and pending source or target cleanup before mutation.',
        'The complete next definition/class is built before component and element-property indexes change.',
        'Component-local maps and reverse indexes preserve exact definitions when property names are reused.',
        'Any active instance of the component rejects mutation before partial work.'
      ],
      bypasses: [
        'Removing a relation never unregisters either registration node.',
        'Unrelated component relations and resources are not rebuilt or removed.'
      ],
      allowedContributors: [
        'scene-tree component registry',
        '@asyra/props-manager element-property ownership registry',
        'Core defineComponent composition adapter',
        'Core-owned relation coordinator',
        'public property runtime query'
      ],
      forbiddenContributors: [
        'global property-name definition authority',
        'active-instance reinterpretation',
        'render or UI policy inference',
        'duplicate-registration tolerance'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/components/**',
        'packages/scene-tree/src/component-registry.ts',
        'packages/scene-tree/src/create-dynamic-component.ts',
        'packages/scene-tree/src/create-dynamic-props.ts',
        'packages/scene-tree/src/__tests__/**',
        'packages/props-manager/src/registries/property-definition.ts',
        'packages/props-manager/src/__tests__/property-definition-registry.test.ts',
        'packages/core/src/define-component.ts',
        'packages/core/src/__tests__/**',
        'docs/ai/framework/packages/scene-tree.md'
      ],
      specRefs: [
        '#asyra-scene-tree-component-relation-owner',
        '#product-cases'
      ],
      failureOwnerStepId: 'mutate-component-property-relations'
    },
    {
      id: 'mutate-property-child-relations',
      order: 1,
      laneId: 'property',
      title: 'Mutate property child relations',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Retain config definitions and rebuild property runtimes when child relations are removed or defined, without stale subscriptions.',
      inputs: [
        'parent property type',
        'child relation definition or key',
        'artifact:core-registration-facade'
      ],
      outputs: [
        'artifact:property-child-relation-result',
        'artifact:rebuilt-property-runtime'
      ],
      conditions: [
        'Config-mode property registration retains its declarative definition and records childType as an automatic detach relation.',
        'Defining one child relation rejects pending source or target cleanup; removal rejects a pending source but remains available to detach from a pending target before building the next constructor.',
        'Rebuilt runtime owns exactly the next child subscriptions and leaves no stale subscription from a removed child.',
        'Constructor-mode hard dependencies must be explicit local registration.relations using unregister-source.',
        'Active or replay-retained instances reject mutation before partial work.',
        'Unknown property types are diagnosed and skipped during post-migration load validation rather than constructed as CUSTOM.'
      ],
      bypasses: [
        'Removing a child relation preserves parent and child registration nodes.',
        'Aggregate and child property types remain independent nodes unless an explicit relation states otherwise.'
      ],
      allowedContributors: [
        'property component registry',
        'property definition/schema registries',
        'PropsManager active and replay-retained instance query',
        'Core-owned relation coordinator'
      ],
      forbiddenContributors: [
        'property schema model redesign',
        'implicit CUSTOM fallback for unknown types',
        'app migration policy',
        'undeclared constructor dependency inference'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src/components/**',
        'packages/props-manager/src/registries/**',
        'packages/props-manager/src/factories/**',
        'packages/props-manager/src/manager/**',
        'packages/props-manager/src/index.ts',
        'packages/props-manager/src/__tests__/**',
        'packages/core/src/define-property-component.ts',
        'packages/core/src/__tests__/define-property-component.test.ts',
        'docs/ai/framework/packages/props-manager.md'
      ],
      specRefs: [
        '#asyra-props-manager-property-relation-owner',
        '#product-cases'
      ],
      failureOwnerStepId: 'mutate-property-child-relations'
    },
    {
      id: 'own-opaque-registration-lifecycle',
      order: 1,
      laneId: 'runtime',
      title: 'Own opaque registration lifecycle',
      ownerPackage:
        '@asyra/feature-system, @asyra/render, and @asyra/ui-context',
      purpose:
        'Keep opaque dependency declarations and complete lifecycle cleanup with the registry that owns each feature, render strategy, or UI property.',
      inputs: [
        'feature/render/UI registration definition',
        'optional local registration.relations',
        'graph cleanup request'
      ],
      outputs: [
        'artifact:opaque-registration-node',
        'artifact:opaque-cleanup-result'
      ],
      conditions: [
        'Feature execution priority, exclusivity, and session semantics remain unchanged.',
        'Feature unregister removes queued and pending handlers, sessions, input listeners, and reactive subscriptions without stale side effects.',
        'Render strategy unregister removes only the named strategy and its owned relation declarations.',
        'An inline component render strategy creates a distinct render-strategy node with an unregister-source relation to its component owner.',
        'UI property unregister disposes its managed source subscription and removes registry/filter metadata.',
        'Hard opaque dependencies use unregister-source and recursively clean the source owner.'
      ],
      bypasses: [
        'Opaque code with no declared relation is not analyzed by the graph.',
        'A shared transport subscription remains until its last registered participant is removed.',
        'A separately registered render strategy remains independent when the same-key component is unregistered.'
      ],
      allowedContributors: [
        'feature-system registration lifecycle',
        'render strategy registry',
        'Core component-definition compatibility adapter',
        'ui-context PropertyRegistry',
        'registration graph owner handlers'
      ],
      forbiddenContributors: [
        'new feature runtime semantics',
        'render-engine capability inspection',
        'automatic UI or render behavior derivation',
        'stale lifecycle resources'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/composition-coordinator.test.ts',
        'packages/utils/src/registry/registration-graph.ts',
        'packages/feature-system/src/**',
        'packages/feature-system/__tests__/**',
        'packages/render/src/registries/**',
        'packages/render/src/__tests__/**',
        'packages/ui-context/src/**',
        'packages/ui-context/src/__tests__/**',
        'docs/ai/framework/packages/feature-system.md',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/packages/ui-context.md'
      ],
      specRefs: ['#registration-identity-and-owner-metadata', '#product-cases'],
      failureOwnerStepId: 'own-opaque-registration-lifecycle'
    },
    {
      id: 'maintain-registration-graph',
      order: 1,
      laneId: 'registry',
      title: 'Maintain shared registration graph',
      ownerPackage: '@asyra/utils',
      purpose:
        'Own stable node metadata, adjacency indexes, deterministic queries/traversal, structured errors, and retryable cleanup state without owning package definitions.',
      inputs: [
        'registration ref and owner metadata',
        'package-local owner handlers',
        'registration relation declarations',
        'composition state query'
      ],
      outputs: [
        'artifact:registration-graph-contract',
        'artifact:relation-operation-result',
        'artifact:unregister-operation-result'
      ],
      conditions: [
        'nodesByRef, outgoingRelationsBySource, and incomingRelationsByTarget are indexed by stable deterministic identity.',
        'Queries return detached owner and relation metadata sorted by stable keys.',
        'Define rejects a missing or pending source, missing or pending target, or duplicate relation before mutation.',
        'Remove rejects a missing or pending source or missing relation before mutation.',
        'Unregister preflights composition and owner handlers, processes sorted incoming relations, removes outgoing relations, cleans owned resources in reverse order, then removes each queued node.',
        'detach rebuilds and preserves the source; unregister-source queues and recursively removes the source with a visited set.',
        'Successful results list root, removed relations, detached sources, recursively unregistered sources, removed owned registrations, and cleanup status.',
        'Cleanup failure keeps retryable state; completed cleanup is not repeated and conflicting registration remains blocked.',
        'On retry, pending relations reconcile with current adjacency; a removed edge is complete and a relation with the same name but a different target is preserved.',
        'All invalid, missing, conflict, closed, cleanup, and dangling states throw RegistrationRelationError with a stable RegistrationContractErrorCode.',
        'ExtensionRegistry, if retained for package authors, accepts only additive before, after, and append ordering.'
      ],
      bypasses: [
        'The graph stores package-local locators/handlers but package registries remain definition source-of-truth.',
        'Outgoing relation removal does not imply that an outgoing target is owned or should be unregistered.',
        'Arbitrary code dependencies are ignored unless declared by their owner definition.'
      ],
      allowedContributors: [
        'Map-based adjacency indexes',
        'plain TypeScript identity, owner, relation, result, and error contracts',
        'package-local preflight, detach, and cleanup handlers'
      ],
      forbiddenContributors: [
        'preset defaults or app policy',
        'one large cross-package definition metadata object',
        'implicit dependency analysis',
        'duplicate registration tolerance',
        'hidden fallback state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/registry/registration-graph.ts',
        'packages/utils/src/registry/extension-registry.ts',
        'packages/utils/src/registry/index.ts',
        'packages/utils/src/index.ts',
        'packages/utils/src/registry/__tests__/**',
        'docs/ai/framework/packages/utils.md',
        'docs/ai/framework/rules/extension-patterns.md'
      ],
      specRefs: [
        '#asyra-utils-shared-registration-graph',
        '#structured-operation-contract',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'maintain-registration-graph'
    },
    {
      id: 'unregister-registration-capability',
      order: 2,
      laneId: 'core',
      title: 'Unregister a complete capability',
      ownerPackage: '@asyra/core',
      purpose:
        'Coordinate graph traversal with package owner handlers so unregisterPropertyType and direct owner unregister calls remove exactly the intended capability and resources.',
      inputs: [
        'root RegistrationRef',
        'artifact:registration-graph-contract',
        'owner preflight/detach/cleanup handlers'
      ],
      outputs: ['artifact:unregister-operation-result'],
      conditions: [
        'Graph-aware property unregister removes property metadata/schema/runtime and all formal relations for the property type.',
        'Structural detach preserves component and parent-property source registrations.',
        'Only unregister-source dependents are recursively queued and cleaned.',
        'Active component, active property, or replay-retained property usage fails before partial mutation.',
        'Direct Core unregister and recursive graph cleanup share completion state and cannot clean the same owned resource twice.',
        'Cleanup failure remains retryable and blocks conflicting registration until pending cleanup completes.'
      ],
      bypasses: [
        'Low-level unregisterPropertyRegistration(type, scope) removes only schema/runtime scope and does not claim graph-wide capability cleanup.',
        'An unrelated aggregate or child property node is preserved unless reached by an explicit hard relation.'
      ],
      allowedContributors: [
        '@asyra/utils registration graph',
        'Core-injected package owner handlers',
        '@asyra/feature-system public unregister',
        'preset application cleanup journal'
      ],
      forbiddenContributors: [
        'automatic semantic migration',
        'fallback CUSTOM construction',
        'partial success reported as complete',
        'unrelated node cleanup'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/**',
        'packages/preset/src/preset.ts',
        'packages/preset/src/__tests__/**',
        'packages/props-manager/src/**',
        'packages/scene-tree/src/**'
      ],
      specRefs: [
        '#operation-semantics',
        '#asyra-core-composition-coordinator',
        '#product-cases'
      ],
      failureOwnerStepId: 'unregister-registration-capability'
    },
    {
      id: 'migrate-validate-load',
      order: 3,
      laneId: 'core',
      title: 'Migrate, validate, and load persisted data',
      ownerPackage: '@asyra/core',
      purpose:
        'Run app-owned migration before canonical validation and safely skip data for registration types that remain unknown.',
      inputs: [
        'persisted payload',
        'app-owned load migration hooks',
        'closed registration graph'
      ],
      outputs: ['artifact:validated-load-result'],
      conditions: [
        'Load hooks migrate the payload before scene and property validation.',
        'Post-migration validation accepts data using registered types.',
        'An unknown property type emits a stable diagnostic and is skipped instead of being constructed as CUSTOM.',
        'Registration composition never performs or invents a data migration.'
      ],
      bypasses: [
        'A new document with no persisted data does not invoke migration.',
        'Known valid property types follow unchanged runtime validation semantics.'
      ],
      allowedContributors: [
        'Core load hook pipeline',
        'app-owned migration hook',
        'scene-tree and props-manager load validators'
      ],
      forbiddenContributors: [
        'automatic registration migration',
        'unknown-type CUSTOM fallback',
        'validation before migration',
        'app-specific migration logic inside framework packages'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/load-diagnostic.ts',
        'packages/core/src/core.ts',
        'packages/core/src/types/load-migration.ts',
        'packages/core/src/types/load-validation.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/props-manager/src/factories/create-property.ts',
        'packages/props-manager/src/manager/props-manager.ts',
        'docs/ai/framework/rules/load-validation-and-migration.md'
      ],
      specRefs: [
        '#startup-composition',
        '#asyra-props-manager-property-relation-owner',
        '#product-cases'
      ],
      failureOwnerStepId: 'migrate-validate-load'
    }
  ]

  const routes = [
    {
      id: 'apply-defaults-before-customization',
      from: 'compose-app-startup',
      to: 'install-preset-defaults',
      kind: 'normal',
      predicate: 'the app selects preset defaults',
      producedArtifacts: ['artifact:app-composition']
    },
    {
      id: 'publish-graph-contract',
      from: 'maintain-registration-graph',
      to: 'coordinate-composition-state',
      kind: 'normal',
      predicate: 'Core constructs its composition coordinator',
      producedArtifacts: ['artifact:registration-graph-contract']
    },
    {
      id: 'install-through-core',
      from: 'install-preset-defaults',
      to: 'coordinate-composition-state',
      kind: 'normal',
      predicate:
        'applyPreset installs exported definitions on the supplied Core',
      producedArtifacts: [
        'artifact:preset-default-registration-state',
        'artifact:preset-registration-declarations'
      ]
    },
    {
      id: 'mutate-component-relations',
      from: 'coordinate-composition-state',
      to: 'mutate-component-property-relations',
      kind: 'conditional',
      predicate:
        'the app removes or defines a component property relation before start',
      producedArtifacts: ['artifact:core-registration-facade']
    },
    {
      id: 'mutate-property-relations',
      from: 'coordinate-composition-state',
      to: 'mutate-property-child-relations',
      kind: 'conditional',
      predicate:
        'the app removes or defines a property child relation before start',
      producedArtifacts: ['artifact:core-registration-facade']
    },
    {
      id: 'register-opaque-runtime',
      from: 'coordinate-composition-state',
      to: 'own-opaque-registration-lifecycle',
      kind: 'conditional',
      predicate:
        'feature, render strategy, or UI property is registered or unregistered',
      producedArtifacts: ['artifact:core-registration-facade']
    },
    {
      id: 'request-complete-unregister',
      from: 'coordinate-composition-state',
      to: 'unregister-registration-capability',
      kind: 'conditional',
      predicate: 'the app requests graph-aware unregister before start',
      producedArtifacts: ['artifact:core-registration-facade']
    },
    {
      id: 'detach-component-source',
      from: 'unregister-registration-capability',
      to: 'mutate-component-property-relations',
      kind: 'conditional',
      predicate: 'an incoming component relation uses detach',
      producedArtifacts: ['artifact:unregister-operation-result']
    },
    {
      id: 'detach-property-source',
      from: 'unregister-registration-capability',
      to: 'mutate-property-child-relations',
      kind: 'conditional',
      predicate: 'an incoming property-child relation uses detach',
      producedArtifacts: ['artifact:unregister-operation-result']
    },
    {
      id: 'cleanup-hard-dependent',
      from: 'unregister-registration-capability',
      to: 'own-opaque-registration-lifecycle',
      kind: 'conditional',
      predicate: 'an incoming opaque relation uses unregister-source',
      producedArtifacts: ['artifact:unregister-operation-result']
    },
    {
      id: 'close-before-start-effects',
      from: 'coordinate-composition-state',
      kind: 'terminal',
      predicate:
        'start closes composition and dangling validation succeeds before renderer effects',
      producedArtifacts: [
        'artifact:composition-closed',
        'artifact:dangling-validation-result'
      ]
    },
    {
      id: 'load-after-migration',
      from: 'coordinate-composition-state',
      to: 'migrate-validate-load',
      kind: 'conditional',
      predicate: 'startup receives persisted data after composition closes',
      producedArtifacts: ['artifact:composition-closed']
    },
    {
      id: 'load-terminal',
      from: 'migrate-validate-load',
      kind: 'terminal',
      predicate: 'migration, validation, and load complete',
      producedArtifacts: ['artifact:validated-load-result']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:app-composition',
      ownerStepId: 'compose-app-startup',
      consumerStepIds: [
        'install-preset-defaults',
        'coordinate-composition-state'
      ]
    },
    {
      id: 'artifact:preset-default-registration-state',
      ownerStepId: 'install-preset-defaults',
      consumerStepIds: ['unregister-registration-capability']
    },
    {
      id: 'artifact:preset-registration-declarations',
      ownerStepId: 'install-preset-defaults',
      consumerStepIds: ['coordinate-composition-state']
    },
    {
      id: 'artifact:core-registration-facade',
      ownerStepId: 'coordinate-composition-state',
      consumerStepIds: [
        'mutate-component-property-relations',
        'mutate-property-child-relations',
        'own-opaque-registration-lifecycle',
        'unregister-registration-capability'
      ]
    },
    {
      id: 'artifact:composition-closed',
      ownerStepId: 'coordinate-composition-state',
      consumerStepIds: ['migrate-validate-load']
    },
    {
      id: 'artifact:dangling-validation-result',
      ownerStepId: 'coordinate-composition-state',
      consumerStepIds: []
    },
    {
      id: 'artifact:component-relation-result',
      ownerStepId: 'mutate-component-property-relations',
      consumerStepIds: ['maintain-registration-graph']
    },
    {
      id: 'artifact:rebuilt-component-registration',
      ownerStepId: 'mutate-component-property-relations',
      consumerStepIds: ['coordinate-composition-state']
    },
    {
      id: 'artifact:property-child-relation-result',
      ownerStepId: 'mutate-property-child-relations',
      consumerStepIds: ['maintain-registration-graph']
    },
    {
      id: 'artifact:rebuilt-property-runtime',
      ownerStepId: 'mutate-property-child-relations',
      consumerStepIds: ['coordinate-composition-state']
    },
    {
      id: 'artifact:opaque-registration-node',
      ownerStepId: 'own-opaque-registration-lifecycle',
      consumerStepIds: ['maintain-registration-graph']
    },
    {
      id: 'artifact:opaque-cleanup-result',
      ownerStepId: 'own-opaque-registration-lifecycle',
      consumerStepIds: ['unregister-registration-capability']
    },
    {
      id: 'artifact:registration-graph-contract',
      ownerStepId: 'maintain-registration-graph',
      consumerStepIds: [
        'install-preset-defaults',
        'coordinate-composition-state',
        'unregister-registration-capability'
      ]
    },
    {
      id: 'artifact:relation-operation-result',
      ownerStepId: 'maintain-registration-graph',
      consumerStepIds: ['coordinate-composition-state']
    },
    {
      id: 'artifact:unregister-operation-result',
      ownerStepId: 'unregister-registration-capability',
      consumerStepIds: [
        'mutate-component-property-relations',
        'mutate-property-child-relations',
        'own-opaque-registration-lifecycle',
        'install-preset-defaults'
      ]
    },
    {
      id: 'artifact:validated-load-result',
      ownerStepId: 'migrate-validate-load',
      consumerStepIds: []
    }
  ]

  const invariants = [
    'Framework owns registration/runtime primitives; preset owns optional defaults and declarations; the app owns only composition choice and migration.',
    'Remove deletes one formal relation, define adds one relation or registration, and unregister removes a node plus its formal relations and owned resources.',
    'No app-facing or shared registry operation claims semantic equivalence between old and new capabilities.',
    'Only declared dependencies participate in graph traversal; arbitrary code is never analyzed.',
    'All composition mutations occur before the first Core.start, whose entry permanently closes composition.',
    'Migration precedes validation and load, while registration composition never performs data migration.',
    'Generic Preset Composition, render profiles, multi-engine composition, and product mode inferred from render-engine capability remain outside this contract.'
  ]

  const productCases = [
    {
      id: 'direct-feature-definition',
      summary:
        'An app adds a feature with core.defineFeature and no preset-specific extension route.'
    },
    {
      id: 'explicit-preset-installation',
      summary:
        'Preset import has no component side effect and applyPreset(core) installs exported defaults deterministically.'
    },
    {
      id: 'component-relation-removal',
      summary:
        'Removing Rectangle/Oval fills slots preserves components and the Fills capability while new instances omit fills.'
    },
    {
      id: 'relation-definition',
      summary:
        'Defining a new property slot produces new instances from exactly the updated relation set.'
    },
    {
      id: 'property-capability-unregister',
      summary:
        'Graph-aware Fills unregister removes Fills relations and owned registrations while detached components remain.'
    },
    {
      id: 'recursive-policy',
      summary:
        'Structural relations detach and hard opaque relations recursively unregister their source owners.'
    },
    {
      id: 'property-child-rebuild',
      summary:
        'Property-child relation removal/definition rebuilds config runtime without stale child subscriptions.'
    },
    {
      id: 'structured-failures',
      summary:
        'Missing, duplicate, dangling, closed, active-use, and cleanup failures use stable structured errors and retry state.'
    },
    {
      id: 'lifecycle-cleanup',
      summary:
        'Feature/render/UI/property/component cleanup removes only owned resources and leaves no stale side effects.'
    },
    {
      id: 'migration-before-validation',
      summary:
        'App migration runs before validation; unknown unregistered property types are diagnosed and skipped.'
    },
    {
      id: 'startup-compatibility',
      summary:
        'Existing applyPreset(core), Asyra Design startup, engine boundary, and public framework APIs remain compatible.'
    },
    {
      id: 'render-mode-non-inference',
      summary:
        'No registration relation or unregister path derives product mode from render-engine capabilities.'
    }
  ]

  const definitionOfDone = [
    {
      id: 'public-contracts',
      summary:
        'Public relation/unregister APIs, stable owner metadata, structured results/errors, and compatibility APIs are documented and tested.'
    },
    {
      id: 'deterministic-graph',
      summary:
        'Adjacency queries, relation mutation, recursive traversal, and cleanup order are deterministic.'
    },
    {
      id: 'composition-closure',
      summary:
        'First start permanently closes composition and validates dangling relations before renderer side effects.'
    },
    {
      id: 'cleanup',
      summary:
        'Graph unregister, owner cleanup retry, and failed preset apply rollback leave no stale resources or duplicate cleanup.'
    },
    {
      id: 'migration-load',
      summary:
        'Migration-before-validation and unknown-property diagnostics are proven without an implicit CUSTOM fallback.'
    },
    {
      id: 'package-boundaries',
      summary:
        'Framework, preset, and app ownership plus monorepo import boundaries pass validation with no deep imports.'
    },
    {
      id: 'full-validation',
      summary:
        'Affected package/app/Inspector tests and root test, lint, build, dependency, and diff gates pass.'
    },
    {
      id: 'independent-review',
      summary:
        'Self-review and read-only sub-agent review have no unresolved concrete finding.'
    }
  ]

  const data = {
    schema: 'flow-inspector.v1',
    target: {
      id: 'extendable-preset',
      title: 'Extendable Preset Relation and Unregister Flow',
      summary:
        'Deterministic startup composition through explicit relation removal/definition and graph-aware registration cleanup.'
    },
    authority: {
      specPath,
      inspectorPath,
      rulePaths: [
        'docs/ai/framework/rules/inspector-contract-readiness.md',
        'docs/ai/framework/rules/inspector-step-execution.md',
        'docs/ai/framework/rules/extension-patterns.md',
        'docs/ai/framework/rules/load-validation-and-migration.md'
      ]
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product contract',
        href: './completed/extendable-preset-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: './__tests__/extendable-preset-flow-inspector.contract.test.cjs'
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
