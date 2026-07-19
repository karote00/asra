;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/app-level-migration-flow-inspector.data.cjs'

  const lanes = [
    { id: 'input', title: 'Load Input', order: 1 },
    { id: 'app', title: 'App Migration Policy', order: 2 },
    { id: 'core', title: 'Core Orchestration', order: 3 },
    { id: 'packages', title: 'Package State Owners', order: 4 },
    { id: 'diagnostics', title: 'Observation', order: 5 }
  ]

  const steps = [
    {
      id: 'receive-raw-document',
      order: 1,
      laneId: 'input',
      title: 'Receive raw document',
      ownerPackage: '@asyra/core',
      purpose:
        'Unify direct core.load and persistence-provider input without normalizing away app-owned version evidence.',
      inputs: [
        'direct core.load(rawDocument)',
        'resolved IPersistenceProvider.load() document'
      ],
      outputs: ['artifact:raw-document', 'artifact:no-document'],
      conditions: [
        'A non-nullish direct document or non-nullish provider document enters the same Core pipeline.',
        'Direct load and provider results remain unknown raw input until app hooks or Core normalization establish the next contract.',
        'The raw document reaches the first load hook before Core normalization.'
      ],
      bypasses: [
        'A direct null or undefined input invokes no migration, validation, apply, file-load event, or diagnostics.',
        'A provider returning null or undefined invokes no migration, validation, apply, file-load event, or diagnostics.'
      ],
      allowedContributors: [
        '@asyra/core load and startup lifecycle',
        '@asyra/persistence provider contract'
      ],
      forbiddenContributors: [
        'provider-specific migration ordering',
        'UI parser or formatter normalization',
        'canonical package state writes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/persistence/src/persistence.ts',
        'packages/persistence/src/providers/index.ts',
        'docs/ai/framework/API_SURFACES.md'
      ],
      specRefs: ['#version-and-hook-semantics', '#product-cases'],
      failureOwnerStepId: 'receive-raw-document'
    },
    {
      id: 'own-versioned-migrations',
      order: 1,
      laneId: 'app',
      title: 'Own versioned migration chain',
      ownerPackage: 'app or user composition',
      purpose:
        'Declare supported document versions and pure one-step domain transforms without moving schema history into framework packages.',
      inputs: [
        'app current document version',
        'app supported version sequence',
        'app-owned vN -> vN+1 transforms'
      ],
      outputs: ['artifact:registered-migration-hooks'],
      conditions: [
        'Hooks are registered in declared version-step order before load.',
        'Missing and unsupported versions fail through the app-owned policy.',
        'Already-current and already-reached versions bypass semantic rewriting.',
        'Every successful transform returns exactly its declared next version.'
      ],
      bypasses: [
        'An app with no schema history may register no load hook.',
        'An already-current document invokes hooks only as version-policy no-ops.'
      ],
      allowedContributors: [
        'public core.registerLoadHook API',
        'app document-version constants',
        'pure app domain transforms'
      ],
      forbiddenContributors: [
        'package-internal app version branches',
        'UI parser or formatter authority',
        'automatic Core schema-history inference',
        'runtime fallback that hides unsupported versions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/examples/app-owned-versioned-load-migration.mjs',
        'docs/examples/app-owned-versioned-load-migration.test.cjs',
        'docs/examples/app-owned-versioned-load-migration.type-test.ts',
        'docs/ai/framework/golden-paths/load-save-migration.md',
        'docs/ai/framework/rules/load-validation-and-migration.md'
      ],
      specRefs: [
        '#principle',
        '#version-and-hook-semantics',
        '#app-responsibilities'
      ],
      failureOwnerStepId: 'own-versioned-migrations'
    },
    {
      id: 'orchestrate-load-hooks',
      order: 1,
      laneId: 'core',
      title: 'Orchestrate ordered app hooks',
      ownerPackage: '@asyra/core',
      purpose:
        'Invoke instance-local app hooks synchronously in registration order and admit only a versioned document result to validation.',
      inputs: ['artifact:raw-document', 'artifact:registered-migration-hooks'],
      outputs: ['artifact:migrated-document', 'artifact:migration-failure'],
      conditions: [
        'The first hook receives unknown raw input; each later hook receives only the prior successful versioned result.',
        'Every hook result satisfies public VersionedLoadDocument: a non-array object with a string version; package fields remain subject to package validation after the complete chain.',
        'A Promise result fails as unsupported asynchronous hook semantics.',
        'Core contains an eventual Promise rejection behind the single synchronous unsupported-async failure.',
        'The empty chain passes raw input to Core normalization without inventing migration.',
        'Registrations and ordering are isolated per Core instance.',
        'Core takes a registration snapshot at the start of each load; a hook registered during a hook is eligible only on the next load.'
      ],
      bypasses: [
        'No hook is invoked when no document exists.',
        'An empty chain performs no app semantic transform.'
      ],
      allowedContributors: [
        'artifact:registered-migration-hooks',
        'Core instance-local hook registry',
        'Core load-hook result guard'
      ],
      forbiddenContributors: [
        'package validation before the chain completes',
        'partial canonical state writes',
        'shared module-level migration registrations',
        'live-array iteration that extends the in-flight chain',
        'a second migration state owner'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/types/load-migration.ts',
        'packages/core/src/types/index.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/persistence/src/hooks/index.ts',
        'packages/core/README.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/CONSTRAINTS.md'
      ],
      specRefs: [
        '#framework-responsibilities',
        '#version-and-hook-semantics',
        '#failure-and-atomicity-semantics'
      ],
      failureOwnerStepId: 'orchestrate-load-hooks'
    },
    {
      id: 'validate-props-data',
      order: 1,
      laneId: 'packages',
      title: 'Validate property data',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Validate migrated property components and produce deterministic load fallback data without app-version interpretation.',
      inputs: ['artifact:migrated-document'],
      outputs: [
        'artifact:validated-props',
        'artifact:props-diagnostics',
        'artifact:props-validation-failure'
      ],
      conditions: [
        'Schema-valid values are retained and invalid values use registered load fallback semantics.',
        'A validator that throws terminates at this owner without producing validated data.',
        'The validated result is an owner-issued, instance-bound, one-shot apply artifact; fabricated, foreign, or reused artifacts fail before mutation.'
      ],
      bypasses: [
        'An absent or invalid props map normalizes to the safe empty map.'
      ],
      allowedContributors: [
        '@asyra/props-manager property schemas',
        'registered property defaults and validators'
      ],
      forbiddenContributors: [
        'app document version history',
        'UI parsers',
        'canonical state application before all validators finish',
        'plain unvalidated records as apply inputs'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/__tests__/**',
        'docs/ai/framework/packages/props-manager.md'
      ],
      specRefs: ['#framework-responsibilities', '#product-cases'],
      failureOwnerStepId: 'validate-props-data'
    },
    {
      id: 'validate-scene-data',
      order: 2,
      laneId: 'packages',
      title: 'Validate scene data',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Validate migrated scene structure and return safe canonical input without app-version interpretation.',
      inputs: ['artifact:migrated-document'],
      outputs: [
        'artifact:validated-scene',
        'artifact:scene-diagnostics',
        'artifact:scene-validation-failure'
      ],
      conditions: [
        'Malformed elements are rejected or normalized by Scene Tree.',
        'A validator that throws terminates at this owner without producing validated data.',
        'The validated result is an owner-issued, instance-bound, one-shot apply artifact; fabricated, foreign, or reused artifacts fail before mutation.'
      ],
      bypasses: [
        'An absent or invalid scene map normalizes to safe empty scene data.'
      ],
      allowedContributors: ['@asyra/scene-tree load validator'],
      forbiddenContributors: [
        'app document version history',
        'render or UI state',
        'canonical state application before all validators finish',
        'plain unvalidated records as apply inputs'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/**',
        'packages/scene-tree/src/__tests__/**',
        'docs/ai/framework/packages/scene-tree.md'
      ],
      specRefs: ['#framework-responsibilities', '#product-cases'],
      failureOwnerStepId: 'validate-scene-data'
    },
    {
      id: 'validate-system-data',
      order: 3,
      laneId: 'packages',
      title: 'Validate managed system data',
      ownerPackage: '@asyra/system-context',
      purpose:
        'Validate persisted managed properties separately from applying them, preserving registered safe values for invalid input.',
      inputs: ['artifact:migrated-document'],
      outputs: [
        'artifact:validated-system',
        'artifact:system-diagnostics',
        'artifact:system-validation-failure'
      ],
      conditions: [
        'Only registered non-runtime values passing their validators enter the validated result.',
        'A validator that throws terminates at this owner without producing validated data.',
        'The validated result is an owner-issued, instance-bound, one-shot apply artifact; fabricated, foreign, or reused artifacts fail before mutation.'
      ],
      bypasses: [
        'Absent systemContext data produces an empty validated map and no mutation.'
      ],
      allowedContributors: [
        '@asyra/system-context managed-property registrations and validators'
      ],
      forbiddenContributors: [
        'app document version history',
        'diagnostics-driven repair',
        'state application inside validation orchestration',
        'plain unvalidated records as apply inputs'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/system-context/src/states/managed-property-state.ts',
        'packages/system-context/src/apis/managed-property-state.ts',
        'packages/system-context/src/types/managed-property-state.ts',
        'packages/system-context/src/system-context.ts',
        'packages/system-context/src/__tests__/system-context.test.ts',
        'docs/ai/framework/packages/system-context.md'
      ],
      specRefs: [
        '#framework-responsibilities',
        '#failure-and-atomicity-semantics'
      ],
      failureOwnerStepId: 'validate-system-data'
    },
    {
      id: 'apply-canonical-state',
      order: 2,
      laneId: 'core',
      title: 'Apply canonical state',
      ownerPackage: '@asyra/core',
      purpose:
        'Apply the migrated version and all validated package results only after every validator succeeds.',
      inputs: [
        'artifact:migrated-document',
        'artifact:validated-props',
        'artifact:validated-scene',
        'artifact:validated-system'
      ],
      outputs: ['artifact:successful-apply-context'],
      conditions: [
        'Version and package state apply only after all validation results exist.',
        'Core returns the complete owner-issued artifacts to their package owners.',
        'Each package consumes its one-shot artifact and does not rerun package validators.',
        'fileLoadComplete publishes only after canonical apply completes.'
      ],
      bypasses: [
        'Migration or validator failure bypasses every apply call and the completion event.'
      ],
      allowedContributors: [
        'validated package artifacts',
        'Core package load facades',
        'fileLoadComplete event'
      ],
      forbiddenContributors: [
        'raw or partially migrated package data',
        'plain unvalidated records or foreign validated artifacts',
        'diagnostics hooks',
        'runtime fallback migration path'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/core/README.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/RUNTIME_MATRICES.md'
      ],
      specRefs: [
        '#recommended-migration-flow',
        '#failure-and-atomicity-semantics',
        '#product-cases'
      ],
      failureOwnerStepId: 'apply-canonical-state'
    },
    {
      id: 'observe-load-diagnostics',
      order: 1,
      laneId: 'diagnostics',
      title: 'Observe load diagnostics',
      ownerPackage: '@asyra/core',
      purpose:
        'Deliver detached post-apply validation observations without allowing mutation or failure to affect load.',
      inputs: [
        'artifact:successful-apply-context',
        'artifact:props-diagnostics',
        'artifact:scene-diagnostics',
        'artifact:system-diagnostics'
      ],
      outputs: ['artifact:load-outcome'],
      conditions: [
        'Each hook receives detached diagnostics and detached post-apply load evidence assembled from the normalized version, validated package apply inputs, and applied managed-system serialization.',
        'The evidence is not a canonical state artifact and cannot become a state owner.',
        'Evidence is assembled only when diagnostics and an observer exist.',
        'Evidence assembly failure is contained, skips diagnostics emission, and preserves the successful load outcome.',
        'Thrown hooks are contained independently and later hooks still run.'
      ],
      bypasses: [
        'No diagnostics means evidence is not assembled, diagnostics hooks are not invoked, and load remains successful.',
        'No registered diagnostics hook means evidence is not assembled and changes no migration, validation, apply, or load outcome.'
      ],
      allowedContributors: [
        'Core instance-local diagnostics registry',
        'detached validation diagnostics',
        'detached post-apply load evidence'
      ],
      forbiddenContributors: [
        'canonical package state references',
        'migration or validation decisions',
        'diagnostics-based canonical state repair'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/types/load-validation.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'apps/asyra-design/src/init/diagnostics/init-load-diagnostics.ts',
        'packages/core/README.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/CONSTRAINTS.md'
      ],
      specRefs: [
        '#failure-and-atomicity-semantics',
        '#recommended-hook-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'observe-load-diagnostics'
    }
  ]

  const routes = [
    {
      id: 'direct-load-input',
      from: 'receive-raw-document',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'core.load receives a non-nullish raw document',
      producedArtifacts: ['artifact:raw-document']
    },
    {
      id: 'provider-load-input',
      from: 'receive-raw-document',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'the persistence provider resolves a non-nullish document',
      producedArtifacts: ['artifact:raw-document']
    },
    {
      id: 'direct-no-document',
      from: 'receive-raw-document',
      kind: 'terminal',
      predicate: 'core.load receives null or undefined',
      producedArtifacts: ['artifact:no-document']
    },
    {
      id: 'provider-no-document',
      from: 'receive-raw-document',
      kind: 'terminal',
      predicate: 'the provider resolves null or undefined',
      producedArtifacts: ['artifact:no-document']
    },
    {
      id: 'register-app-migrations',
      from: 'own-versioned-migrations',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'the app registers zero or more ordered hooks',
      producedArtifacts: ['artifact:registered-migration-hooks']
    },
    {
      id: 'migration-to-props-validation',
      from: 'orchestrate-load-hooks',
      to: 'validate-props-data',
      kind: 'normal',
      predicate: 'all hooks complete with valid synchronous results',
      producedArtifacts: ['artifact:migrated-document']
    },
    {
      id: 'migration-to-scene-validation',
      from: 'orchestrate-load-hooks',
      to: 'validate-scene-data',
      kind: 'normal',
      predicate: 'all hooks complete with valid synchronous results',
      producedArtifacts: ['artifact:migrated-document']
    },
    {
      id: 'migration-to-system-validation',
      from: 'orchestrate-load-hooks',
      to: 'validate-system-data',
      kind: 'normal',
      predicate: 'all hooks complete with valid synchronous results',
      producedArtifacts: ['artifact:migrated-document']
    },
    {
      id: 'migration-failure-terminal',
      from: 'orchestrate-load-hooks',
      kind: 'terminal',
      predicate: 'a hook throws or returns an invalid or asynchronous result',
      producedArtifacts: ['artifact:migration-failure']
    },
    {
      id: 'validated-props-to-apply',
      from: 'validate-props-data',
      to: 'apply-canonical-state',
      kind: 'normal',
      predicate: 'property validation completes',
      producedArtifacts: ['artifact:validated-props']
    },
    {
      id: 'props-validation-failure-terminal',
      from: 'validate-props-data',
      kind: 'terminal',
      predicate: 'a property validator throws',
      producedArtifacts: ['artifact:props-validation-failure']
    },
    {
      id: 'validated-scene-to-apply',
      from: 'validate-scene-data',
      to: 'apply-canonical-state',
      kind: 'normal',
      predicate: 'scene validation completes',
      producedArtifacts: ['artifact:validated-scene']
    },
    {
      id: 'scene-validation-failure-terminal',
      from: 'validate-scene-data',
      kind: 'terminal',
      predicate: 'a scene validator throws',
      producedArtifacts: ['artifact:scene-validation-failure']
    },
    {
      id: 'validated-system-to-apply',
      from: 'validate-system-data',
      to: 'apply-canonical-state',
      kind: 'normal',
      predicate: 'system validation completes',
      producedArtifacts: ['artifact:validated-system']
    },
    {
      id: 'system-validation-failure-terminal',
      from: 'validate-system-data',
      kind: 'terminal',
      predicate: 'a managed-property validator throws',
      producedArtifacts: ['artifact:system-validation-failure']
    },
    {
      id: 'props-diagnostics',
      from: 'validate-props-data',
      to: 'observe-load-diagnostics',
      kind: 'conditional',
      predicate: 'property validation reports warnings',
      producedArtifacts: ['artifact:props-diagnostics']
    },
    {
      id: 'scene-diagnostics',
      from: 'validate-scene-data',
      to: 'observe-load-diagnostics',
      kind: 'conditional',
      predicate: 'scene validation reports warnings',
      producedArtifacts: ['artifact:scene-diagnostics']
    },
    {
      id: 'system-diagnostics',
      from: 'validate-system-data',
      to: 'observe-load-diagnostics',
      kind: 'conditional',
      predicate: 'system validation reports warnings',
      producedArtifacts: ['artifact:system-diagnostics']
    },
    {
      id: 'apply-to-diagnostics',
      from: 'apply-canonical-state',
      to: 'observe-load-diagnostics',
      kind: 'normal',
      predicate: 'all validated state applies and fileLoadComplete publishes',
      producedArtifacts: ['artifact:successful-apply-context']
    },
    {
      id: 'load-outcome-terminal',
      from: 'observe-load-diagnostics',
      kind: 'terminal',
      predicate: 'diagnostics complete, are absent, or fail observationally',
      producedArtifacts: ['artifact:load-outcome']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:raw-document',
      title: 'Unnormalized raw load document',
      ownerStepId: 'receive-raw-document',
      channel: 'Core shared load entry',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:no-document',
      title: 'No load document outcome',
      ownerStepId: 'receive-raw-document',
      channel: 'Core direct or startup bypass',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:registered-migration-hooks',
      title: 'App-owned ordered migration registrations',
      ownerStepId: 'own-versioned-migrations',
      channel: 'core.registerLoadHook',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:migrated-document',
      title: 'Complete versioned post-hook document',
      ownerStepId: 'orchestrate-load-hooks',
      channel: 'Core validation handoff',
      terminal: false,
      consumerStepIds: [
        'validate-props-data',
        'validate-scene-data',
        'validate-system-data',
        'apply-canonical-state'
      ]
    },
    {
      id: 'artifact:migration-failure',
      title: 'Pre-validation migration failure',
      ownerStepId: 'orchestrate-load-hooks',
      channel: 'synchronous throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:validated-props',
      title: 'Validated property load data',
      ownerStepId: 'validate-props-data',
      channel: 'Props Manager owner-issued instance-bound apply artifact',
      terminal: false,
      consumerStepIds: ['apply-canonical-state']
    },
    {
      id: 'artifact:props-diagnostics',
      title: 'Property validation diagnostics',
      ownerStepId: 'validate-props-data',
      channel: 'Core diagnostics collection',
      terminal: false,
      consumerStepIds: ['observe-load-diagnostics']
    },
    {
      id: 'artifact:props-validation-failure',
      title: 'Property validation execution failure',
      ownerStepId: 'validate-props-data',
      channel: 'synchronous throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:validated-scene',
      title: 'Validated scene load data',
      ownerStepId: 'validate-scene-data',
      channel: 'Scene Tree owner-issued instance-bound apply artifact',
      terminal: false,
      consumerStepIds: ['apply-canonical-state']
    },
    {
      id: 'artifact:scene-diagnostics',
      title: 'Scene validation diagnostics',
      ownerStepId: 'validate-scene-data',
      channel: 'Core diagnostics collection',
      terminal: false,
      consumerStepIds: ['observe-load-diagnostics']
    },
    {
      id: 'artifact:scene-validation-failure',
      title: 'Scene validation execution failure',
      ownerStepId: 'validate-scene-data',
      channel: 'synchronous throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:validated-system',
      title: 'Validated managed system data',
      ownerStepId: 'validate-system-data',
      channel: 'System Context owner-issued instance-bound apply artifact',
      terminal: false,
      consumerStepIds: ['apply-canonical-state']
    },
    {
      id: 'artifact:system-diagnostics',
      title: 'Managed system validation diagnostics',
      ownerStepId: 'validate-system-data',
      channel: 'Core diagnostics collection',
      terminal: false,
      consumerStepIds: ['observe-load-diagnostics']
    },
    {
      id: 'artifact:system-validation-failure',
      title: 'Managed system validation execution failure',
      ownerStepId: 'validate-system-data',
      channel: 'synchronous throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:successful-apply-context',
      title: 'Post-apply diagnostics assembly context',
      ownerStepId: 'apply-canonical-state',
      channel: 'Core post-apply diagnostics handoff',
      terminal: false,
      consumerStepIds: ['observe-load-diagnostics']
    },
    {
      id: 'artifact:load-outcome',
      title: 'Successful load outcome independent of diagnostics',
      ownerStepId: 'observe-load-diagnostics',
      channel: 'Core load return or startup continuation',
      terminal: true,
      consumerStepIds: []
    }
  ]

  const invariants = [
    {
      id: 'app-owns-version-history',
      statement:
        'The app owns version eligibility and transforms; framework packages contain no app schema history.',
      stepIds: ['own-versioned-migrations', 'orchestrate-load-hooks'],
      artifactIds: [
        'artifact:registered-migration-hooks',
        'artifact:migrated-document'
      ],
      specRefs: ['#principle', '#version-and-hook-semantics']
    },
    {
      id: 'migration-precedes-validation-and-apply',
      statement:
        'The complete ordered hook chain succeeds before any package validator, and every validator succeeds before canonical apply.',
      stepIds: [
        'orchestrate-load-hooks',
        'validate-props-data',
        'validate-scene-data',
        'validate-system-data',
        'apply-canonical-state'
      ],
      artifactIds: [
        'artifact:migrated-document',
        'artifact:successful-apply-context'
      ],
      specRefs: [
        '#recommended-migration-flow',
        '#failure-and-atomicity-semantics'
      ]
    },
    {
      id: 'diagnostics-are-observational',
      statement:
        'Diagnostics receive only detached post-apply validated-input evidence plus applied managed-system serialization; the evidence is not a canonical state artifact or state owner and cannot change load state or outcome.',
      stepIds: ['apply-canonical-state', 'observe-load-diagnostics'],
      artifactIds: [
        'artifact:successful-apply-context',
        'artifact:load-outcome'
      ],
      specRefs: ['#failure-and-atomicity-semantics']
    },
    {
      id: 'load-routes-have-parity',
      statement:
        'Direct and provider inputs enter the same instance-local hook, validation, apply, and diagnostics pipeline.',
      stepIds: [
        'receive-raw-document',
        'orchestrate-load-hooks',
        'apply-canonical-state'
      ],
      artifactIds: ['artifact:raw-document'],
      specRefs: ['#version-and-hook-semantics', '#product-cases']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'version-chain',
      title: 'Version-step semantics',
      stepIds: ['own-versioned-migrations', 'orchestrate-load-hooks'],
      specRefs: ['#version-and-hook-semantics', '#product-cases'],
      assertions: [
        'Empty, current, missing, unsupported, v1 -> v2 -> v3, thrown, invalid, synchronous, and asynchronous cases have deterministic outcomes.'
      ]
    },
    {
      id: 'validation-atomicity',
      title: 'Validation and apply atomicity',
      stepIds: [
        'orchestrate-load-hooks',
        'validate-props-data',
        'validate-scene-data',
        'validate-system-data',
        'apply-canonical-state'
      ],
      specRefs: [
        '#failure-and-atomicity-semantics',
        '#release-gate-definition-of-done'
      ],
      assertions: [
        'Migration or validation failure applies no canonical prefix, while migrated invalid package data still uses package fallback.'
      ]
    },
    {
      id: 'route-parity-isolation',
      title: 'Route parity and instance isolation',
      stepIds: [
        'receive-raw-document',
        'orchestrate-load-hooks',
        'observe-load-diagnostics'
      ],
      specRefs: ['#product-cases'],
      assertions: [
        'Direct and provider load have identical ordering, Core registrations are isolated, and diagnostics failure does not change success.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'app-level-migration',
      kind: 'system',
      title: 'App-level Migration Inspector',
      subtitle:
        'Raw document through app-owned version transforms, package validation, canonical apply, and observational diagnostics.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Framework App-Level Migration product contract',
      inspectorOwner: 'App-level Migration Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './completed/props-manager-app-level-migration-plan.md',
        kind: 'authority'
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
    if (!value || typeof value !== 'object' || Object.isFrozen(value))
      return value
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }
  freeze(data)
  if (typeof globalThis !== 'undefined') globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) module.exports = data
})()
