;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/property-type-redefinition-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/property-type-redefinition-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app', title: 'App Composition', order: 1 },
    { id: 'core', title: 'Core Coordination', order: 2 },
    { id: 'property', title: 'Property Runtime', order: 3 },
    { id: 'projection', title: 'Typed Projections', order: 4 }
  ]

  const steps = [
    {
      id: 'compose-property-customization',
      order: 1,
      laneId: 'app',
      title: 'Compose property customization',
      ownerPackage: 'app or user composition',
      purpose:
        'Inspect or redefine one declarative property type and explicitly adapt every app-owned semantic consumer before startup.',
      inputs: [
        'optional applyPreset(core) result',
        'app-owned field semantics and local custom-field types',
        'artifact:property-definition-view',
        'artifact:property-redefinition-result'
      ],
      outputs: [
        'artifact:property-definition-request',
        'artifact:app-render-strategy-registration',
        'artifact:app-ui-property-registration',
        'artifact:app-load-migration'
      ],
      conditions: [
        'Use only the public Core instance after optional preset application and before the first core.start().',
        'The app updater supplies one complete next fixed-field definition and does not claim that removed B and added C are semantically equivalent.',
        'Affected relations, render strategies, UI properties, commands, and migration are adapted explicitly through their existing APIs or app code.',
        'A semantic B-to-C document transform is registered as an app load migration before package validation.'
      ],
      bypasses: [
        'An app that accepts the preset definition performs no redefinition or consumer replacement.',
        'A custom field with no UI meaning requires no UI-context registration.',
        'A read-only definition request produces no schema, runtime, relation, render, UI, or migration mutation.'
      ],
      allowedContributors: [
        '@asyra/core public facade',
        '@asyra/preset public applyPreset entrypoint',
        'app-owned render strategy, UI property, command, and migration definitions'
      ],
      forbiddenContributors: [
        'preset or framework deep imports',
        'direct Props Manager singleton or registry mutation',
        'Pixi or concrete render-engine data',
        'automatic consumer rewriting or fallback B-to-C mapping'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/golden-paths/extend-preset-capability.md',
        'docs/ai/framework/API_SURFACES.md',
        'packages/preset/src/__tests__/**',
        'packages/core/src/__tests__/**'
      ],
      specRefs: [
        '#product-contract',
        '#app-consumer-flow',
        '#product-cases'
      ],
      failureOwnerStepId: 'compose-property-customization'
    },
    {
      id: 'coordinate-property-redefinition',
      order: 1,
      laneId: 'core',
      title: 'Coordinate property redefinition',
      ownerPackage: '@asyra/core',
      purpose:
        'Expose the app-facing read/redefine facade, enforce composition state, coordinate the atomic owner call, and preserve graph relations.',
      inputs: [
        'artifact:property-definition-request',
        'artifact:current-property-definition',
        'artifact:committed-property-definition',
        'Core composition lock and RegistrationGraph'
      ],
      outputs: [
        'artifact:definition-read-request',
        'artifact:property-definition-view',
        'artifact:definition-rebuild-request',
        'artifact:property-redefinition-result'
      ],
      conditions: [
        'A read request returns a detached definition and never mutates graph or registries.',
        'A redefine request requires open composition, no pending cleanup, one existing property identity, and the same type in the updater result.',
        'Graph owner metadata changes to the app only after Props Manager reports an atomic committed definition.',
        'Core uses a RegistrationGraph metadata-only owner transfer that preserves node identity, relations, handlers, and resources; RegistrationGraph does not decide when app ownership applies.',
        'The existing Core config definition entry delegates config runtime construction to the Props Manager builder so there is no second config builder owner.',
        'Incoming and outgoing relations are preserved; final startup validation rejects stale fixed component aliases or property-child keys.',
        'The Core type facade supports app-declared id-first property fields without an unsafe cast.'
      ],
      bypasses: [
        'getPropertyTypeDefinition bypasses updater execution, rebuild, owner transfer, and relation validation changes.',
        'A missing type returns undefined only for the getter; redefine fails through the stable property registration error contract.',
        'Dynamic property aliases follow their explicit dynamic-key policy rather than fixed-field closure validation.'
      ],
      allowedContributors: [
        '@asyra/props-manager definition owner API',
        '@asyra/props-manager config-mode constructor builder',
        'Core RegistrationGraph and permanent composition lock',
        'RegistrationGraph metadata-only owner transfer primitive',
        'existing component/property relation metadata'
      ],
      forbiddenContributors: [
        'partial direct writes to schema or constructor registries',
        'a second config-mode constructor builder in Core',
        'unregister and re-register as an owner transfer mechanism',
        'general registry overwrite or duplicate tolerance',
        'semantic inspection of render, UI, feature, or migration functions',
        'runtime redefinition after core.start()'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/define-property-component.ts',
        'packages/core/src/apis/props.ts',
        'packages/core/src/apis/index.ts',
        'packages/core/src/index.ts',
        'packages/core/src/types/**',
        'packages/core/src/__tests__/**',
        'packages/utils/src/registry/registration-graph.ts',
        'packages/utils/src/registry/__tests__/registration-graph.test.ts',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/API_SURFACES.md'
      ],
      specRefs: [
        '#public-api',
        '#composition-and-atomicity',
        '#ownership-and-boundaries'
      ],
      failureOwnerStepId: 'coordinate-property-redefinition'
    },
    {
      id: 'rebuild-declarative-property-type',
      order: 1,
      laneId: 'property',
      title: 'Rebuild declarative property type',
      ownerPackage: '@asyra/props-manager',
      purpose:
        'Project one normalized config-mode definition, validate the complete next definition, and atomically swap schema and runtime.',
      inputs: [
        'artifact:definition-read-request',
        'artifact:definition-rebuild-request',
        'registered property schema and config-mode runtime definition',
        'active and replay-retained property usage'
      ],
      outputs: [
        'artifact:current-property-definition',
        'artifact:committed-property-definition',
        'artifact:canonical-property-values'
      ],
      conditions: [
        'The read projection normalizes every fixed key into one kind, default, validator, persist, project, and unit contract.',
        'Returned definitions are deeply detached from registry state.',
        'Redefinition rejects constructor mode, active instances, replay-retained instances, duplicate/reserved keys, invalid defaults, and schema/runtime drift.',
        'The complete next schema and constructor are staged before either registry changes.',
        'Commit swaps schema and runtime together while preserving the exact existing child configuration.',
        'Runtime writes remain valid-write or invalid-reject; load remains valid-write or deterministic fallback.'
      ],
      bypasses: [
        'A read-only request projects the current definition without staging or registry mutation.',
        'Fields with project false do not enter getValue output.',
        'Fields with persist false do not enter saved property data.',
        'Any updater, validation, staging, or commit failure retains the exact prior schema and constructor.'
      ],
      allowedContributors: [
        'property schema registry',
        'config-mode property component definition registry',
        'PropsManager active and replay-retained usage query',
        'Base property validation and config-mode constructor builder'
      ],
      forbiddenContributors: [
        'constructor-mode behavior introspection',
        'app document migration policy',
        'component or child relation mutation',
        'render/UI fallback values or semantic field mapping'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/props-manager/src/registries/**',
        'packages/props-manager/src/manager/props-manager.ts',
        'packages/props-manager/src/components/base.ts',
        'packages/props-manager/src/index.ts',
        'packages/props-manager/src/__tests__/**',
        'docs/ai/framework/packages/props-manager.md'
      ],
      specRefs: [
        '#definition-model',
        '#composition-and-atomicity',
        '#product-cases'
      ],
      failureOwnerStepId: 'rebuild-declarative-property-type'
    },
    {
      id: 'project-property-values',
      order: 2,
      laneId: 'property',
      title: 'Project canonical property values',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Merge the canonical property getValue result into computed element data without interpreting app field semantics.',
      inputs: [
        'artifact:canonical-property-values',
        'registered component-property relation and aliases'
      ],
      outputs: ['artifact:computed-element-data'],
      conditions: [
        'Computed setup and property subscriptions consume only the complete getValue result.',
        'Normal Core changeComputedData and owner-aware property commits refresh the same canonical projection.',
        'Removed fixed fields are not reconstructed in computed data.'
      ],
      bypasses: [
        'A property field omitted from getValue because project is false produces no computed field.',
        'A component without the property relation receives no value from that property type.'
      ],
      allowedContributors: [
        'artifact:canonical-property-values',
        '@asyra/scene-tree Computed property subscriptions',
        'registered component-property relations'
      ],
      forbiddenContributors: [
        'schema/default reconstruction inside Scene Tree',
        'render strategy or UI compute functions',
        'fallback values for removed or missing fields'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src/components/computed.ts',
        'packages/scene-tree/src/create-dynamic-props.ts',
        'packages/scene-tree/src/__tests__/**',
        'docs/ai/framework/packages/scene-tree.md'
      ],
      specRefs: [
        '#app-consumer-flow',
        '#ownership-and-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'project-property-values'
    },
    {
      id: 'consume-typed-render-data',
      order: 1,
      laneId: 'projection',
      title: 'Consume typed render data',
      ownerPackage: '@asyra/render',
      purpose:
        'Deliver app-declared computed fields to an engine-neutral render strategy without unsafe casts or semantic inference.',
      inputs: [
        'artifact:computed-element-data',
        'artifact:app-render-strategy-registration'
      ],
      outputs: ['artifact:typed-render-consumption'],
      conditions: [
        'EngineNeutralRenderStrategy accepts an app-declared custom data shape while retaining required RenderElementData fields.',
        'The registered strategy alone decides how C affects engine-neutral drawing.'
      ],
      bypasses: [
        'If the app keeps the existing strategy, the framework does not infer whether it understands the redefined fields.',
        'A field unused by render requires no render strategy change.'
      ],
      allowedContributors: [
        'artifact:computed-element-data',
        'app-registered engine-neutral render strategy',
        '@asyra/render graphics abstractions'
      ],
      forbiddenContributors: [
        'Pixi or concrete render-engine types',
        'property registry reads from the render callback',
        'automatic B-to-C draw behavior',
        'fallback geometry for an unadapted strategy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/types/render-strategy.ts',
        'packages/render/src/types.ts',
        'packages/render/src/index.ts',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md'
      ],
      specRefs: [
        '#app-consumer-flow',
        '#ownership-and-boundaries',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'consume-typed-render-data'
    },
    {
      id: 'derive-typed-ui-data',
      order: 2,
      laneId: 'projection',
      title: 'Derive typed UI data',
      ownerPackage: '@asyra/ui-context',
      purpose:
        'Let an optional app UI property compute from app-declared custom element fields without becoming model authority.',
      inputs: [
        'artifact:computed-element-data',
        'artifact:app-ui-property-registration'
      ],
      outputs: ['artifact:derived-ui-value'],
      conditions: [
        'PropertyComputeContext exposes the app-declared element data type to the app compute callback.',
        'The app registration explicitly owns aggregate, mixed, empty, and selection behavior for C.'
      ],
      bypasses: [
        'No UI registration is required when C has no UI meaning.',
        'Apps may bypass ui-context and derive their own UI state from framework subscriptions.'
      ],
      allowedContributors: [
        'artifact:computed-element-data',
        'app-defined UI property registration',
        '@asyra/ui-context derived-state runtime'
      ],
      forbiddenContributors: [
        'canonical property ownership',
        'automatic UI controls, formatter, or B-to-C mapping',
        'render or render-engine state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ui-context/src/property-registry.ts',
        'packages/ui-context/src/ui-context.ts',
        'packages/ui-context/src/index.ts',
        'packages/ui-context/src/__tests__/**',
        'docs/ai/framework/packages/ui-context.md'
      ],
      specRefs: [
        '#app-consumer-flow',
        '#ownership-and-boundaries',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'derive-typed-ui-data'
    }
  ]

  const routes = [
    {
      id: 'request-property-definition',
      from: 'compose-property-customization',
      to: 'coordinate-property-redefinition',
      kind: 'composition',
      predicate:
        'The app requests either a read-only definition view or a pre-start redefinition.',
      producedArtifacts: ['artifact:property-definition-request']
    },
    {
      id: 'read-owner-definition',
      from: 'coordinate-property-redefinition',
      to: 'rebuild-declarative-property-type',
      kind: 'composition',
      predicate:
        'Core has resolved the property identity and requests the owner-normalized definition.',
      producedArtifacts: ['artifact:definition-read-request']
    },
    {
      id: 'return-current-definition',
      from: 'rebuild-declarative-property-type',
      to: 'coordinate-property-redefinition',
      kind: 'data',
      predicate: 'Props Manager can project a complete config-mode definition.',
      producedArtifacts: ['artifact:current-property-definition']
    },
    {
      id: 'return-definition-view',
      from: 'coordinate-property-redefinition',
      to: 'compose-property-customization',
      kind: 'data',
      predicate:
        'The app requested getPropertyTypeDefinition or Core is supplying the updater input.',
      producedArtifacts: ['artifact:property-definition-view']
    },
    {
      id: 'request-atomic-rebuild',
      from: 'coordinate-property-redefinition',
      to: 'rebuild-declarative-property-type',
      kind: 'composition',
      predicate:
        'The synchronous updater returned a same-identity complete next definition during open composition.',
      producedArtifacts: ['artifact:definition-rebuild-request']
    },
    {
      id: 'return-committed-definition',
      from: 'rebuild-declarative-property-type',
      to: 'coordinate-property-redefinition',
      kind: 'data',
      predicate:
        'Schema and config-mode runtime committed atomically with preserved child configuration.',
      producedArtifacts: ['artifact:committed-property-definition']
    },
    {
      id: 'return-redefinition-result',
      from: 'coordinate-property-redefinition',
      to: 'compose-property-customization',
      kind: 'data',
      predicate:
        'Core updated app owner metadata after the owner commit and detached the result.',
      producedArtifacts: ['artifact:property-redefinition-result']
    },
    {
      id: 'register-app-render-consumer',
      from: 'compose-property-customization',
      to: 'consume-typed-render-data',
      kind: 'composition',
      predicate: 'The redefined field changes a shape render strategy.',
      producedArtifacts: ['artifact:app-render-strategy-registration']
    },
    {
      id: 'register-app-ui-consumer',
      from: 'compose-property-customization',
      to: 'derive-typed-ui-data',
      kind: 'composition',
      predicate: 'The redefined field has app UI or aggregate meaning.',
      producedArtifacts: ['artifact:app-ui-property-registration']
    },
    {
      id: 'register-app-load-migration',
      from: 'compose-property-customization',
      kind: 'terminal',
      predicate:
        'Persisted app documents require a semantic old-field to new-field conversion before validation.',
      producedArtifacts: ['artifact:app-load-migration']
    },
    {
      id: 'project-canonical-values',
      from: 'rebuild-declarative-property-type',
      to: 'project-property-values',
      kind: 'runtime',
      predicate:
        'A post-start property instance initializes or changes through the redefined canonical runtime.',
      producedArtifacts: ['artifact:canonical-property-values']
    },
    {
      id: 'deliver-render-data',
      from: 'project-property-values',
      to: 'consume-typed-render-data',
      kind: 'data',
      predicate: 'The element type has a registered render strategy.',
      producedArtifacts: ['artifact:computed-element-data']
    },
    {
      id: 'deliver-ui-compute-data',
      from: 'project-property-values',
      to: 'derive-typed-ui-data',
      kind: 'data',
      predicate: 'A registered UI property recomputes from the affected elements.',
      producedArtifacts: ['artifact:computed-element-data']
    },
    {
      id: 'publish-typed-render-consumption',
      from: 'consume-typed-render-data',
      kind: 'terminal',
      predicate:
        'The app render strategy consumes its declared custom field and emits engine-neutral drawing operations.',
      producedArtifacts: ['artifact:typed-render-consumption']
    },
    {
      id: 'publish-derived-ui-value',
      from: 'derive-typed-ui-data',
      kind: 'terminal',
      predicate:
        'The optional UI property publishes the app-owned derived value.',
      producedArtifacts: ['artifact:derived-ui-value']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:property-definition-request',
      title: 'Property definition read or redefine request',
      ownerStepId: 'compose-property-customization',
      channel: 'Core public facade call',
      terminal: false,
      consumerStepIds: ['coordinate-property-redefinition']
    },
    {
      id: 'artifact:app-render-strategy-registration',
      title: 'App-owned render strategy registration',
      ownerStepId: 'compose-property-customization',
      channel: 'Core render strategy facade',
      terminal: false,
      consumerStepIds: ['consume-typed-render-data']
    },
    {
      id: 'artifact:app-ui-property-registration',
      title: 'App-owned UI property registration',
      ownerStepId: 'compose-property-customization',
      channel: 'Core UI property facade',
      terminal: false,
      consumerStepIds: ['derive-typed-ui-data']
    },
    {
      id: 'artifact:app-load-migration',
      title: 'App-owned document migration',
      ownerStepId: 'compose-property-customization',
      channel: 'Core load hook pipeline',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:definition-read-request',
      title: 'Owner definition read request',
      ownerStepId: 'coordinate-property-redefinition',
      channel: 'Core to Props Manager owner call',
      terminal: false,
      consumerStepIds: ['rebuild-declarative-property-type']
    },
    {
      id: 'artifact:property-definition-view',
      title: 'Detached app-facing property definition',
      ownerStepId: 'coordinate-property-redefinition',
      channel: 'Core getter or updater callback',
      terminal: false,
      consumerStepIds: ['compose-property-customization']
    },
    {
      id: 'artifact:definition-rebuild-request',
      title: 'Validated atomic rebuild request',
      ownerStepId: 'coordinate-property-redefinition',
      channel: 'Core to Props Manager owner call',
      terminal: false,
      consumerStepIds: ['rebuild-declarative-property-type']
    },
    {
      id: 'artifact:property-redefinition-result',
      title: 'Detached committed redefinition result',
      ownerStepId: 'coordinate-property-redefinition',
      channel: 'Core public facade return',
      terminal: false,
      consumerStepIds: ['compose-property-customization']
    },
    {
      id: 'artifact:current-property-definition',
      title: 'Normalized current property definition',
      ownerStepId: 'rebuild-declarative-property-type',
      channel: 'Props Manager definition owner response',
      terminal: false,
      consumerStepIds: ['coordinate-property-redefinition']
    },
    {
      id: 'artifact:committed-property-definition',
      title: 'Atomically committed property definition',
      ownerStepId: 'rebuild-declarative-property-type',
      channel: 'Props Manager definition owner response',
      terminal: false,
      consumerStepIds: ['coordinate-property-redefinition']
    },
    {
      id: 'artifact:canonical-property-values',
      title: 'Canonical projected property values',
      ownerStepId: 'rebuild-declarative-property-type',
      channel: 'Property component getValue and change subscription',
      terminal: false,
      consumerStepIds: ['project-property-values']
    },
    {
      id: 'artifact:computed-element-data',
      title: 'Computed element data with app custom fields',
      ownerStepId: 'project-property-values',
      channel: 'Scene Tree computed state and projection channels',
      terminal: false,
      consumerStepIds: ['consume-typed-render-data', 'derive-typed-ui-data']
    },
    {
      id: 'artifact:typed-render-consumption',
      title: 'Typed engine-neutral render callback consumption',
      ownerStepId: 'consume-typed-render-data',
      channel: 'registered render strategy callback',
      terminal: true,
      consumerStepIds: []
    },
    {
      id: 'artifact:derived-ui-value',
      title: 'Optional app-owned derived UI value',
      ownerStepId: 'derive-typed-ui-data',
      channel: 'ui-context observable',
      terminal: true,
      consumerStepIds: []
    }
  ]

  const invariants = [
    {
      id: 'redefinition-is-atomic-and-pre-start',
      statement:
        'A config-mode property definition changes schema and runtime together only during open composition; every failure preserves the exact old definition and relations.',
      stepIds: [
        'coordinate-property-redefinition',
        'rebuild-declarative-property-type'
      ],
      artifactIds: [
        'artifact:definition-rebuild-request',
        'artifact:committed-property-definition'
      ],
      specRefs: ['#composition-and-atomicity', '#product-cases']
    },
    {
      id: 'semantic-consumers-remain-explicit',
      statement:
        'The framework never infers semantic equivalence or rewrites relations, render, UI, commands, or migration after an app field redefinition.',
      stepIds: [
        'compose-property-customization',
        'coordinate-property-redefinition',
        'consume-typed-render-data',
        'derive-typed-ui-data'
      ],
      artifactIds: [
        'artifact:app-render-strategy-registration',
        'artifact:app-ui-property-registration',
        'artifact:app-load-migration'
      ],
      specRefs: ['#product-contract', '#app-consumer-flow']
    },
    {
      id: 'canonical-data-authority-is-preserved',
      statement:
        'Props Manager owns property validation and values, Scene Tree owns computed projection, and render/UI consume derived typed data without becoming authority.',
      stepIds: [
        'rebuild-declarative-property-type',
        'project-property-values',
        'consume-typed-render-data',
        'derive-typed-ui-data'
      ],
      artifactIds: [
        'artifact:canonical-property-values',
        'artifact:computed-element-data'
      ],
      specRefs: ['#app-consumer-flow', '#ownership-and-boundaries']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'app-can-redefine-preset-fields',
      title: 'App can redefine preset fields',
      stepIds: [
        'compose-property-customization',
        'coordinate-property-redefinition',
        'rebuild-declarative-property-type'
      ],
      specRefs: ['#public-api', '#product-cases'],
      assertions: [
        'An app can inspect and atomically add, remove, or replace config-mode fixed fields through its Core instance before startup without a preset deep import.'
      ]
    },
    {
      id: 'app-consumers-remain-typed-and-explicit',
      title: 'App consumers remain typed and explicit',
      stepIds: [
        'compose-property-customization',
        'project-property-values',
        'consume-typed-render-data',
        'derive-typed-ui-data'
      ],
      specRefs: ['#app-consumer-flow', '#definition-of-done'],
      assertions: [
        'App-declared fields reach property updates, render strategies, and optional UI compute callbacks without unsafe casts, while their semantic behavior remains app-owned.'
      ]
    },
    {
      id: 'failure-and-load-boundaries-remain-safe',
      title: 'Failure and load boundaries remain safe',
      stepIds: [
        'compose-property-customization',
        'coordinate-property-redefinition',
        'rebuild-declarative-property-type'
      ],
      specRefs: ['#composition-and-atomicity', '#product-cases'],
      assertions: [
        'Failed redefinition preserves the old definition, runtime invalid writes reject, load fallback remains deterministic, and semantic document conversion stays app-owned.'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'property-type-redefinition',
      kind: 'system',
      title: 'Property Type Redefinition Inspector',
      subtitle:
        'Pre-start app composition from detached definition through atomic property rebuild and explicit typed render/UI consumers.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Declarative Property Type Redefinition product contract',
      inspectorOwner: 'Property Type Redefinition Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './property-type-redefinition-plan.md',
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
