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
      title: 'Own connected migration registry',
      ownerPackage: 'app or user composition',
      purpose:
        'Validate one connected batch of app-owned transitions and compile one conditional dispatcher without moving schema history into framework packages.',
      inputs: [
        'app-owned batch of { from, to, migrate } transitions',
        'opaque app document version ids',
        'pure app domain transforms'
      ],
      outputs: [
        'artifact:registered-migration-dispatcher',
        'artifact:empty-migration-batch',
        'artifact:migration-registration-failure',
        'artifact:app-migration-execution-failure'
      ],
      conditions: [
        'The complete batch is validated atomically before one dispatcher is registered through public core.registerLoadHook.',
        'One helper module installs at most one non-empty migration batch per Core instance; a second non-empty registration fails before adding another hook.',
        'An empty batch is always a no-op and does not claim the per-Core installation slot.',
        'The batch is a dense array whose every slot declares one complete transition.',
        'Version ids are opaque and may be non-contiguous; all transitions still form one connected linear chain with one head and one tail.',
        'Duplicate source or target, self-transition, branch, merge, disconnected component, or cycle fails registration before installing the dispatcher.',
        'At load time the dispatcher looks up only the current version, runs its matching transform, requires exactly the declared to version, and repeats with the returned document.',
        'Repeated lookup is one synchronous loop inside the dispatcher and never re-enters core.load.',
        'Every registered transform returns synchronously with a non-array document object and a string version; a Promise is an app-owned asynchronous-result failure and its eventual rejection is contained.',
        'A matched transform returning any other invalid shape is an invalid-step-result failure, distinct from initial missing-version eligibility.',
        'A thrown registered transform propagates the same error instance as an app-owned migration execution failure.',
        'A string version with no matching transition is a normal terminal pass-through, not an unsupported-version failure.'
      ],
      bypasses: [
        'An empty migration batch registers no dispatcher.',
        'An already-terminal, unknown, future, or otherwise unmatched string version invokes no transform and continues unchanged to Core normalization and package validation.',
        'Transitions before a document current version are not invoked.'
      ],
      allowedContributors: [
        'public core.registerLoadHook API',
        'app-owned per-Core WeakSet installation guard',
        'opaque app document-version ids',
        'pure app domain transforms'
      ],
      forbiddenContributors: [
        'package-internal app version branches',
        'UI parser or formatter authority',
        'automatic Core schema-history inference',
        'Core target-version or supported-version enforcement',
        'Core-owned app migration installation registry',
        'fixed-queue invocation of non-matching migration transforms'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/public/build/persistence-migration.md',
        'packages/core/src/__tests__/load-validation.test.ts',
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
      id: 'own-additional-load-hooks',
      order: 2,
      laneId: 'app',
      title: 'Own optional additional load hooks',
      ownerPackage: 'app or user composition',
      purpose:
        'Register optional non-migration app load hooks that are not migration authority and retain ownership of their synchronous thrown failures.',
      inputs: ['optional non-migration app load hooks'],
      outputs: [
        'artifact:registered-additional-load-hooks',
        'artifact:no-additional-load-hooks',
        'artifact:app-load-hook-throw'
      ],
      conditions: [
        'Additional hooks use the same public core.registerLoadHook surface and the app chooses their registration order.',
        'A synchronous throw propagates the same error instance and remains owned by the app hook contributor.',
        'A returned value still crosses the Core load-hook result boundary for VersionedLoadDocument validation.'
      ],
      bypasses: [
        'An app with no additional load hook produces a no-additional-hooks handoff.'
      ],
      allowedContributors: [
        'public core.registerLoadHook API',
        'app-owned non-migration load-hook callbacks'
      ],
      forbiddenContributors: [
        'a second migration authority',
        'package-validation bypass',
        'diagnostics that repair hook output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/core/README.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/ARCHITECTURE.md'
      ],
      specRefs: [
        '#version-and-hook-semantics',
        '#failure-and-atomicity-semantics'
      ],
      failureOwnerStepId: 'own-additional-load-hooks'
    },
    {
      id: 'orchestrate-load-hooks',
      order: 1,
      laneId: 'core',
      title: 'Orchestrate ordered app hooks',
      ownerPackage: '@asyra/core',
      purpose:
        'Invoke instance-local app hooks synchronously in registration order and admit only a versioned document result to validation.',
      inputs: [
        'artifact:raw-document',
        'artifact:registered-migration-dispatcher',
        'artifact:empty-migration-batch',
        'artifact:registered-additional-load-hooks',
        'artifact:no-additional-load-hooks'
      ],
      outputs: ['artifact:migrated-document', 'artifact:migration-failure'],
      conditions: [
        'The first hook receives unknown raw input; each later hook receives only the prior successful versioned result.',
        'The app migration registry is exposed to Core as one ordinary synchronous dispatcher hook; Core does not inspect its transition graph or target version.',
        'Core consumes exactly one app registration outcome: a registered dispatcher or an empty-batch no-dispatcher handoff.',
        'Core also consumes exactly one additional-hook outcome: registered additional hooks or a no-additional-hooks handoff.',
        'A dispatcher-thrown app migration failure propagates unchanged while failure ownership remains with own-versioned-migrations.',
        'A synchronous additional app-hook throw propagates unchanged while failure ownership remains with own-additional-load-hooks.',
        'An unmatched string version returned unchanged by the dispatcher remains a valid VersionedLoadDocument and continues to package validation.',
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
        'artifact:registered-migration-dispatcher',
        'artifact:empty-migration-batch',
        'artifact:registered-additional-load-hooks',
        'artifact:no-additional-load-hooks',
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
        'packages/utils/src/types/load-diagnostic.ts',
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
        'packages/utils/src/types/load-diagnostic.ts',
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
        'packages/utils/src/types/load-diagnostic.ts',
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
      predicate:
        'the app provides one valid non-empty connected linear migration chain',
      producedArtifacts: ['artifact:registered-migration-dispatcher']
    },
    {
      id: 'empty-app-migration-batch',
      from: 'own-versioned-migrations',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'the app provides an empty batch and registers no dispatcher',
      producedArtifacts: ['artifact:empty-migration-batch']
    },
    {
      id: 'migration-registration-failure',
      from: 'own-versioned-migrations',
      kind: 'terminal',
      predicate:
        'the batch is not a dense complete array, has a duplicate source/target, self-transition, branch, merge, disconnected component, or cycle, or is a second non-empty registration on the same Core instance',
      producedArtifacts: ['artifact:migration-registration-failure']
    },
    {
      id: 'app-migration-execution-failure',
      from: 'own-versioned-migrations',
      kind: 'terminal',
      predicate:
        'the dispatcher rejects missing-version eligibility or a matched app transform throws or returns an invalid or asynchronous result when Core invokes it',
      producedArtifacts: ['artifact:app-migration-execution-failure']
    },
    {
      id: 'register-additional-app-load-hooks',
      from: 'own-additional-load-hooks',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'the app registers one or more additional non-migration hooks',
      producedArtifacts: ['artifact:registered-additional-load-hooks']
    },
    {
      id: 'no-additional-app-load-hooks',
      from: 'own-additional-load-hooks',
      to: 'orchestrate-load-hooks',
      kind: 'normal',
      predicate: 'the app registers no additional load hook',
      producedArtifacts: ['artifact:no-additional-load-hooks']
    },
    {
      id: 'additional-app-load-hook-throw',
      from: 'own-additional-load-hooks',
      kind: 'terminal',
      predicate:
        'an additional app load hook makes a synchronous throw that Core propagates unchanged',
      producedArtifacts: ['artifact:app-load-hook-throw']
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
      predicate:
        'a hook result crossing the Core boundary is invalid or asynchronous',
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
      id: 'artifact:registered-migration-dispatcher',
      title: 'App-owned connected migration dispatcher',
      ownerStepId: 'own-versioned-migrations',
      channel: 'single core.registerLoadHook registration',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:empty-migration-batch',
      title: 'No app migration dispatcher registration',
      ownerStepId: 'own-versioned-migrations',
      channel: 'empty registration bypass',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:migration-registration-failure',
      title: 'Invalid app migration-chain registration',
      ownerStepId: 'own-versioned-migrations',
      channel: 'synchronous registration throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:app-migration-execution-failure',
      title: 'App-owned migration eligibility or transform failure',
      ownerStepId: 'own-versioned-migrations',
      channel: 'synchronous dispatcher throw',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:registered-additional-load-hooks',
      title: 'Optional additional app load-hook registrations',
      ownerStepId: 'own-additional-load-hooks',
      channel: 'core.registerLoadHook registrations',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:no-additional-load-hooks',
      title: 'No additional app load-hook registration',
      ownerStepId: 'own-additional-load-hooks',
      channel: 'empty additional-hook registration bypass',
      terminal: false,
      consumerStepIds: ['orchestrate-load-hooks']
    },
    {
      id: 'artifact:app-load-hook-throw',
      title: 'App-owned additional load-hook throw',
      ownerStepId: 'own-additional-load-hooks',
      channel: 'synchronous hook throw',
      terminal: true,
      consumerStepIds: []
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
        'artifact:registered-migration-dispatcher',
        'artifact:migrated-document'
      ],
      specRefs: ['#principle', '#version-and-hook-semantics']
    },
    {
      id: 'migration-precedes-validation-and-apply',
      statement:
        'The conditional migration dispatcher and complete Core hook chain succeed before any package validator, and every validator succeeds before canonical apply.',
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
      stepIds: [
        'own-versioned-migrations',
        'own-additional-load-hooks',
        'orchestrate-load-hooks'
      ],
      specRefs: ['#version-and-hook-semantics', '#product-cases'],
      assertions: [
        'Empty, missing-version, unmatched-version pass-through, non-contiguous connected chain, middle-chain start, invalid or repeated registration, per-Core isolation, thrown transform, invalid result, synchronous, and asynchronous cases have deterministic outcomes.'
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
    schema: { id: 'flow-inspector', version: 2 },
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
        href: '../../tools/flow-inspector/FLOW_INSPECTOR.md',
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
