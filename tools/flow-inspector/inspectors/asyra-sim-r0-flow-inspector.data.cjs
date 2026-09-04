;(function () {
  'use strict'
  const data = {
    schema: {
      id: 'flow-inspector',
      version: 2
    },
    target: {
      id: 'asyra-sim-r0',
      kind: 'app',
      title: 'Asyra Sim R0',
      subtitle: 'CUSTOM spatial engine and trustworthy local experiments'
    },
    authority: {
      specPath: 'docs/ai/apps/asyra-sim/specs/robot-workcell-v0.md',
      inspectorPath:
        'tools/flow-inspector/inspectors/asyra-sim-r0-flow-inspector.data.cjs',
      semanticOwner: 'Asyra Sim',
      inspectorOwner: 'Asyra Sim'
    },
    links: [
      {
        label: 'R0 contract',
        href: '../../../docs/ai/apps/asyra-sim/specs/robot-workcell-v0.md'
      },
      {
        label: 'CUSTOM engine',
        href: '../../../docs/ai/apps/asyra-sim/specs/custom-engine-v0.md'
      },
      {
        label: 'Release gates',
        href: '../../../docs/ai/apps/asyra-sim/release/FIRST_RELEASE.md'
      }
    ],
    lanes: [
      {
        id: 'compose',
        title: 'Composition',
        order: 1
      },
      {
        id: 'domain',
        title: 'Canonical domain',
        order: 2
      },
      {
        id: 'edit',
        title: 'Editing',
        order: 3
      },
      {
        id: 'project',
        title: 'Spatial projection',
        order: 4
      },
      {
        id: 'engine',
        title: 'CUSTOM engine',
        order: 5
      },
      {
        id: 'surface',
        title: 'Core surface facade',
        order: 6
      },
      {
        id: 'snapshot',
        title: 'Experiment and preflight',
        order: 7
      },
      {
        id: 'method',
        title: 'Numerical method',
        order: 8
      },
      {
        id: 'run',
        title: 'Execution',
        order: 9
      },
      {
        id: 'storage',
        title: 'Persistence and comparison',
        order: 10
      },
      {
        id: 'ui',
        title: 'Workbench and delivery',
        order: 11
      },
      {
        id: 'asset',
        title: 'Restricted visual assets',
        order: 12
      }
    ],
    steps: [
      {
        id: 'quiesce',
        order: 0,
        laneId: 'compose',
        title: 'Stop and drain Feature runtime work',
        ownerPackage: '@asyra/feature-system',
        purpose: 'Prevent old project work from crossing a runtime reset',
        inputs: [
          'explicit Core lifecycle termination',
          'current context snapshot'
        ],
        outputs: ['artifact:feature-quiescence'],
        conditions: [
          'Close admission and detach Feature transport bindings before awaiting active work.',
          'Reject queued work, abort tasks/sessions, and await real handler settlement, including timed-out handlers.',
          'Force provisional session rollback; remain closed on cleanup failure or until explicit successor initialization.'
        ],
        bypasses: [
          'Ordinary load, cancel, unregister and destroy do not invoke full reset.'
        ],
        allowedContributors: [
          'Feature interaction queue, session and task owners',
          'ordinary transaction rollback boundary'
        ],
        forbiddenContributors: [
          'App-owned history',
          'canonical state clearing',
          'renderer resource cleanup',
          'automatic restart after timeout'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'packages/feature-system/src/core/**',
          'packages/feature-system/src/index.ts',
          'packages/feature-system/__tests__/**'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'quiesce'
      },
      {
        id: 'reset-factory',
        order: 0.5,
        laneId: 'compose',
        title: 'Release Factory runtime state',
        ownerPackage: '@asyra/factory',
        purpose:
          'Release transaction, history and owned delivery resources after quiescence',
        inputs: ['artifact:feature-quiescence', 'Core lifecycle reset request'],
        outputs: ['artifact:factory-reset'],
        conditions: [
          'Reject before mutation while any transaction, replay or delivery settlement is active.',
          'Clear Factory-owned runtime history, registrations, observers and pending delivery without replacing canonical state.',
          'Keep the default transaction-owner bridge; isolate other Factory instances; report cleanup failure.'
        ],
        bypasses: [
          'Ordinary load, replay, transaction completion and destroy do not request full reset.'
        ],
        allowedContributors: ['Factory transaction and shared-channel owners'],
        forbiddenContributors: [
          'App history management',
          'canonical model replacement',
          'Feature cancellation policy'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'packages/factory/src/factory.ts',
          'packages/factory/src/data-transact.ts',
          'packages/factory/src/shared-data-channel.ts',
          'packages/factory/src/__tests__/**'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'reset-factory'
      },
      {
        id: 'reset-scene',
        order: 0.6,
        laneId: 'compose',
        title: 'Release Scene Tree runtime state',
        ownerPackage: '@asyra/scene-tree',
        purpose:
          'Retire canonical scene instances and their computed lifecycle',
        inputs: ['artifact:factory-reset', 'Core lifecycle reset request'],
        outputs: ['artifact:scene-reset'],
        conditions: [
          'Clear live/deleted elements, hierarchy, changes and relations without canonical replay.',
          'Invalidate old prepared artifacts and attempt every computed cleanup hook.',
          'Keep component definitions, Props and other Scene Tree instances separate; report cleanup failure.'
        ],
        bypasses: [
          'Ordinary canonical load and legacy dispose/reset do not use this full lifecycle boundary.'
        ],
        allowedContributors: [
          'Scene-owned element, relation and computed lifecycle'
        ],
        forbiddenContributors: [
          'Props disposal',
          'App state clearing',
          'history manipulation',
          'renderer internals'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'packages/scene-tree/src/sceneTree.ts',
          'packages/scene-tree/src/__tests__/**'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'reset-scene'
      },
      {
        id: 'reset-props',
        order: 0.7,
        laneId: 'compose',
        title: 'Release Props Manager runtime state',
        ownerPackage: '@asyra/props-manager',
        purpose:
          'Retire canonical property instances and old prepared artifacts',
        inputs: ['artifact:scene-reset', 'Core lifecycle reset request'],
        outputs: ['artifact:props-reset'],
        conditions: [
          'Reject active canonical batch reset before mutation.',
          'Attempt every component cleanup and clear instances, changes, batches, relationships and prepared artifacts.',
          'Keep schema/constructor definitions, Scene and other Props Managers separate; report cleanup failure.'
        ],
        bypasses: [
          'Ordinary load and legacy dispose/reset retain their existing scope.'
        ],
        allowedContributors: [
          'Props Manager component, relation and validation-artifact owners'
        ],
        forbiddenContributors: [
          'Scene cleanup',
          'type unregistration',
          'App history or renderer state'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'packages/props-manager/src/manager/props-manager.ts',
          'packages/props-manager/src/__tests__/**'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'reset-props'
      },
      {
        id: 'compose',
        order: 1,
        laneId: 'compose',
        title: 'Create the CUSTOM runtime',
        ownerPackage: '@asyra/asyra-sim composition',
        purpose: 'Create the CUSTOM runtime',
        inputs: [
          'trusted pre-start modules',
          'validated startup configuration'
        ],
        outputs: ['artifact:runtime'],
        conditions: [
          'Composition is open; explicitly select CUSTOM defaults and bind the provider through Core.',
          'One runtime owns one surface; startup must succeed before UI reports ready.'
        ],
        bypasses: ['No runtime construction during catalog inspection.'],
        allowedContributors: [
          'Core public facade',
          'trusted local method catalog'
        ],
        forbiddenContributors: [
          'Preset 3D/HYBRID enablement',
          'Core dependency internals',
          'network defaults'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/init/custom-renderer.ts',
          'apps/asyra-sim/src/init/bootstrap.ts',
          'apps/asyra-sim/src/init/__tests__/custom-renderer.test.ts',
          'apps/asyra-sim/src/init/__tests__/bootstrap.test.ts',
          'apps/asyra-sim/src/init/__tests__/app-environment.test.ts',
          'apps/asyra-sim/app-environment.mjs',
          'apps/asyra-sim/app-environment.d.mts',
          'apps/asyra-sim/.env',
          'apps/asyra-sim/.env.example',
          'apps/asyra-sim/.gitignore',
          'apps/asyra-sim/package.json',
          'apps/asyra-sim/tsconfig.json',
          'apps/asyra-sim/vitest.config.ts',
          'apps/asyra-sim/vite.config.ts',
          'apps/asyra-sim/index.html',
          'yarn.lock',
          'turbo.json'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'compose'
      },
      {
        id: 'domain',
        order: 2,
        laneId: 'domain',
        title: 'Validate workcells and compute poses',
        ownerPackage: '@asyra/asyra-sim domain',
        purpose: 'Validate workcells and compute poses',
        inputs: [
          'canonical scene membership',
          'property definitions',
          'explicit trajectory and units'
        ],
        outputs: ['artifact:domain'],
        conditions: [
          'Finite, supported dimensions and units; parent membership comes from Scene Tree.',
          'Interpolate unwrapped joints and compute poses once for renderer and methods.'
        ],
        bypasses: [
          'Static poses bypass trajectory interpolation; empty motion input is invalid.'
        ],
        allowedContributors: ['pure domain geometry and schemas'],
        forbiddenContributors: [
          'Three.js',
          'worker state',
          'second editable hierarchy'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/domain/**',
          'apps/asyra-sim/samples/**'
        ],
        specRefs: [
          '#1-supported-workcell',
          '#3-coordinates-units-and-support-envelope',
          '#4-trajectories-and-motion-semantics'
        ],
        failureOwnerStepId: 'domain'
      },
      {
        id: 'edit',
        order: 3,
        laneId: 'edit',
        title: 'Accept user intent atomically',
        ownerPackage: '@asyra/asyra-sim editing',
        purpose: 'Accept user intent atomically',
        inputs: [
          'artifact:runtime',
          'artifact:domain',
          'validated edit intent'
        ],
        outputs: ['artifact:committed-model'],
        conditions: [
          'Feature -> common API -> Core canonical state under one transaction.',
          'Reject invalid edits; explicit rollback cancellation produces no partial scene.'
        ],
        bypasses: [
          'Load and Undo/Redo use canonical apply instead of new product intent.'
        ],
        allowedContributors: ['Feature System', 'Core scene/property facades'],
        forbiddenContributors: [
          'direct SDK mutation',
          'standalone undo stack',
          'input-layer business rules'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/features/edit*',
          'apps/asyra-sim/src/features/__tests__/**',
          'apps/asyra-sim/src/common-apis/**',
          'apps/asyra-sim/src/constants/**',
          'apps/asyra-sim/src/init/properties*',
          'apps/asyra-sim/src/init/components*'
        ],
        specRefs: [
          '#10-import-persistence-and-field-feedback',
          '#11-interaction-cancellation-and-resources'
        ],
        failureOwnerStepId: 'edit'
      },
      {
        id: 'project',
        order: 4,
        laneId: 'project',
        title: 'Project committed and playback poses',
        ownerPackage: '@asyra/asyra-sim projection',
        purpose: 'Project committed and playback poses',
        inputs: [
          'artifact:committed-model',
          'artifact:domain',
          'artifact:result',
          'transient camera and playback time'
        ],
        outputs: ['artifact:spatial-projection'],
        conditions: [
          'Use shared domain poses; replay and camera never overwrite canonical geometry.',
          'Register through Core; findings are projections of accepted evidence.'
        ],
        bypasses: [
          'No result is required for ordinary editing; no analysis runs during preview.'
        ],
        allowedContributors: [
          'engine-neutral spatial descriptors',
          'public RenderContainer and RenderMesh'
        ],
        forbiddenContributors: [
          'Three.js SDK',
          'collision re-derivation',
          'renderer runtime extraction'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/render-app/**',
          'apps/asyra-sim/src/render-layers/**'
        ],
        specRefs: [
          '#2-visual-and-analysis-geometry',
          '#8-results-are-not-a-single-green-check'
        ],
        failureOwnerStepId: 'project'
      },
      {
        id: 'engine',
        order: 5,
        laneId: 'engine',
        title: 'Render and pick the spatial projection',
        ownerPackage: 'Asyra Sim CUSTOM engine',
        purpose: 'Render and pick the spatial projection',
        inputs: [
          'artifact:spatial-projection',
          'RenderEngine commands and surface options',
          'artifact:surface-size-request'
        ],
        outputs: ['artifact:visual-output'],
        conditions: [
          'Validate versioned spatial descriptors and own all SDK objects.',
          'Flush only on demand; ray picking returns visual handles, never formal collision evidence.',
          'Keep the engine independent of workcell and canonical runtime modules.'
        ],
        bypasses: [
          'Ordinary screen-space containers and graphics use the 2D bridge; no spatial interpretation is inferred.'
        ],
        allowedContributors: [
          'Three.js',
          'public @asyra/render-engine contract'
        ],
        forbiddenContributors: [
          'Core and Render imports',
          'workcell domain imports',
          'solver inputs',
          'Preset modifications'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/engine/three-engine.ts',
          'apps/asyra-sim/src/engine/spatial-contract.ts',
          'apps/asyra-sim/src/engine/graphics.ts',
          'apps/asyra-sim/src/engine/__tests__/**'
        ],
        specRefs: [
          '#2-visual-and-analysis-geometry',
          '#11-interaction-cancellation-and-resources'
        ],
        failureOwnerStepId: 'engine'
      },
      {
        id: 'surface',
        order: 6,
        laneId: 'surface',
        title: 'Forward a validated surface size',
        ownerPackage: '@asyra/core',
        purpose: 'Forward a validated surface size',
        inputs: ['artifact:runtime', 'measured positive CSS width and height'],
        outputs: ['artifact:surface-size-request'],
        conditions: [
          'Validate finite positive dimensions before invoking the active IRenderer resize method.',
          'Forward without changing canonical state, camera semantics, provider selection, or composition locks.'
        ],
        bypasses: [
          'An App may defer a zero-size hidden surface; zero is not a valid facade request.'
        ],
        allowedContributors: ['Core-owned or advanced IRenderer interface'],
        forbiddenContributors: [
          'Three.js',
          'App domain state',
          'alternate render runtime',
          'Preset 3D/HYBRID enablement'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'packages/core/src/core.ts',
          'packages/core/src/index.ts',
          'packages/core/src/__tests__/core-start-render.test.ts'
        ],
        specRefs: ['#11-interaction-cancellation-and-resources'],
        failureOwnerStepId: 'surface'
      },
      {
        id: 'snapshot',
        order: 7,
        laneId: 'snapshot',
        title: 'Freeze and validate one run',
        ownerPackage: '@asyra/asyra-sim experiments',
        purpose: 'Freeze and validate one run',
        inputs: [
          'artifact:committed-model',
          'artifact:domain',
          'installed method descriptors',
          'scope, rules, budget and acknowledgements'
        ],
        outputs: ['artifact:snapshot'],
        conditions: [
          'Freeze detached complete inputs and source identities.',
          'Reject unsupported data before allocating a worker; separate resource warnings from validity.',
          'No valid pairs is not a pass.'
        ],
        bypasses: [
          'Historical result viewing does not require an installed method.'
        ],
        allowedContributors: [
          'method input schemas',
          'pure scope and pair policies'
        ],
        forbiddenContributors: [
          'camera and pixels',
          'silent exclusions',
          'mutable canonical references'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/analysis/preflight*',
          'apps/asyra-sim/src/analysis/snapshot*',
          'apps/asyra-sim/src/analysis/contracts*',
          'apps/asyra-sim/src/analysis/__tests__/**',
          'apps/asyra-sim/src/extensions/**'
        ],
        specRefs: [
          '#5-analysis-scope-and-pair-policy',
          '#6-preflight',
          '#9-comparable-and-traceable-experiments'
        ],
        failureOwnerStepId: 'snapshot'
      },
      {
        id: 'method',
        order: 8,
        laneId: 'method',
        title: 'Compute bounded continuous evidence',
        ownerPackage: '@asyra/asyra-sim geometry method',
        purpose: 'Compute bounded continuous evidence',
        inputs: [
          'artifact:snapshot',
          'artifact:domain',
          'abort signal and execution budget'
        ],
        outputs: ['artifact:method-evidence'],
        conditions: [
          'Use only validated detached inputs and shared kinematics.',
          'Bound the full requested interval or mark unresolved; retain numerical uncertainty.',
          'Distance bounds and contact witnesses are distinct from user verdicts.'
        ],
        bypasses: [
          'Static input uses static queries; sampled preview cannot produce formal clearance.'
        ],
        allowedContributors: [
          'pure analytical geometry',
          'bounded interval subdivision'
        ],
        forbiddenContributors: [
          'Three.js',
          'display FPS',
          'runtime canonical state',
          'silent method fallback'
        ],
        cacheDimensions: [],
        implementationBoundary: ['apps/asyra-sim/src/analysis/methods/**'],
        specRefs: [
          '#7-methods-and-completeness',
          '#8-results-are-not-a-single-green-check'
        ],
        failureOwnerStepId: 'method'
      },
      {
        id: 'run',
        order: 9,
        laneId: 'run',
        title: 'Own worker lifecycle and validate results',
        ownerPackage: '@asyra/asyra-sim runner',
        purpose: 'Own worker lifecycle and validate results',
        inputs: [
          'artifact:snapshot',
          'artifact:method-evidence',
          'Feature-owned abort signal'
        ],
        outputs: ['artifact:result'],
        conditions: [
          'One detached Feature task at a time; no transaction spans worker execution.',
          'Validate source identity, evidence, pair/time coverage, and terminal state.',
          'Abort, terminate after grace, and discard late messages from an old run.'
        ],
        bypasses: ['Malformed evidence fails; no UI repair into success.'],
        allowedContributors: [
          'owned Web Worker',
          'versioned method protocol',
          'result validation'
        ],
        forbiddenContributors: [
          'canonical scene writes during solve',
          'unbounded concurrency',
          'Promise-only forced cancellation'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/analysis/runner*',
          'apps/asyra-sim/src/analysis/worker*',
          'apps/asyra-sim/src/analysis/result*',
          'apps/asyra-sim/src/analysis/__tests__/**',
          'apps/asyra-sim/src/features/analysis*'
        ],
        specRefs: [
          '#8-results-are-not-a-single-green-check',
          '#11-interaction-cancellation-and-resources'
        ],
        failureOwnerStepId: 'run'
      },
      {
        id: 'storage',
        order: 10,
        laneId: 'storage',
        title: 'Retain and export immutable experiments',
        ownerPackage: '@asyra/asyra-sim storage',
        purpose: 'Retain and export immutable experiments',
        inputs: [
          'artifact:committed-model',
          'artifact:result',
          'validated import or explicit save/compare intent',
          'artifact:visual-asset'
        ],
        outputs: ['artifact:retained-data'],
        conditions: [
          'Preview imports before Feature acceptance; failed import leaves no partial state.',
          'Save acknowledgement is independent of runtime commit; historical evidence stays immutable.',
          'UI, export, comparison and replay consume the same result; incompatible comparisons are disclosed.'
        ],
        bypasses: [
          'Missing methods allow historical reading, not automatic reruns.'
        ],
        allowedContributors: [
          'local IndexedDB and portable bundles',
          'safe CSV/JSON/HTML serializers'
        ],
        forbiddenContributors: [
          'remote upload',
          'rewriting old evidence',
          'silent units or version guesses'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/storage/**',
          'apps/asyra-sim/src/features/storage*'
        ],
        specRefs: [
          '#9-comparable-and-traceable-experiments',
          '#10-import-persistence-and-field-feedback'
        ],
        failureOwnerStepId: 'storage'
      },
      {
        id: 'ui',
        order: 11,
        laneId: 'ui',
        title: 'Expose the full ordinary user journey',
        ownerPackage: '@asyra/asyra-sim workbench',
        purpose: 'Expose the full ordinary user journey',
        inputs: [
          'artifact:runtime',
          'artifact:committed-model',
          'artifact:visual-output',
          'artifact:result',
          'artifact:retained-data',
          'artifact:visual-asset'
        ],
        outputs: ['artifact:user-workbench'],
        conditions: [
          'Dispatch intent through Features; UI is never canonical model or solver authority.',
          'Expose assumptions, unknowns, saving failures, comparison differences, and method versions.',
          'Use local assets; release readiness remains governed by FIRST_RELEASE gates.'
        ],
        bypasses: [
          'Startup failure displays an actionable error, not a fake workcell.'
        ],
        allowedContributors: [
          'ordinary UI controls',
          'versioned local distribution'
        ],
        forbiddenContributors: [
          'fixture-specific success paths',
          'equipment commands',
          'automatic publishing'
        ],
        cacheDimensions: [],
        implementationBoundary: [
          'apps/asyra-sim/src/ui/**',
          'apps/asyra-sim/src/main*',
          'apps/asyra-sim/e2e/**',
          'apps/asyra-sim/playwright.config.ts',
          'apps/asyra-sim/scripts/**',
          'apps/asyra-sim/README.md'
        ],
        specRefs: ['#12-representative-product-cases-and-definition-of-done'],
        failureOwnerStepId: 'ui'
      },
      {
        id: 'asset',
        order: 12,
        laneId: 'asset',
        title: 'Decode a restricted visual reference',
        ownerPackage: '@asyra/asyra-sim asset adapter',
        purpose: 'Decode a restricted visual reference',
        inputs: [
          'locally selected GLB bytes within the published resource profile'
        ],
        outputs: ['artifact:visual-asset'],
        conditions: [
          'Validate the complete supported GLB profile before returning detached geometry and source identity.',
          'Never fetch, execute file content, create colliders, or mutate a document.'
        ],
        bypasses: [
          'Decoding needs no Core or renderer instance; unsupported files remain explicit errors.'
        ],
        allowedContributors: [
          'Three.js math types inside the decoder',
          'bounded byte and schema validation',
          'Web Crypto source digest'
        ],
        forbiddenContributors: [
          'Core and canonical state',
          'network loaders',
          'solver inputs',
          'implicit analysis geometry'
        ],
        cacheDimensions: [],
        implementationBoundary: ['apps/asyra-sim/src/engine/glb/**'],
        specRefs: [
          '#2-visual-and-analysis-geometry',
          '#10-import-persistence-and-field-feedback'
        ],
        failureOwnerStepId: 'asset'
      }
    ],
    routes: [
      {
        id: 'feature-quiescence-to-factory',
        from: 'quiesce',
        to: 'reset-factory',
        kind: 'normal',
        predicate:
          'Feature work has actually settled; this alone does not complete App reset.',
        producedArtifacts: ['artifact:feature-quiescence']
      },
      {
        id: 'factory-reset-to-scene',
        from: 'reset-factory',
        to: 'reset-scene',
        kind: 'normal',
        predicate:
          'Factory reset has completed; other runtime owners must still finish before reconstruction.',
        producedArtifacts: ['artifact:factory-reset']
      },
      {
        id: 'scene-reset-to-props',
        from: 'reset-scene',
        to: 'reset-props',
        kind: 'normal',
        predicate:
          'Scene reset has completed; other owners and fresh Core composition are still required.',
        producedArtifacts: ['artifact:scene-reset']
      },
      {
        id: 'props-reset-terminal',
        from: 'reset-props',
        kind: 'terminal',
        predicate:
          'Props state is retired; remaining owner cleanup and fresh Core composition are still required.',
        producedArtifacts: ['artifact:props-reset']
      },
      {
        id: 'runtime-to-edit',
        from: 'compose',
        to: 'edit',
        kind: 'normal',
        predicate:
          'The owner has produced the validated runtime artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:runtime']
      },
      {
        id: 'runtime-to-ui',
        from: 'compose',
        to: 'ui',
        kind: 'normal',
        predicate:
          'The owner has produced the validated runtime artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:runtime']
      },
      {
        id: 'domain-to-edit',
        from: 'domain',
        to: 'edit',
        kind: 'normal',
        predicate:
          'The owner has produced the validated domain artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:domain']
      },
      {
        id: 'domain-to-project',
        from: 'domain',
        to: 'project',
        kind: 'normal',
        predicate:
          'The owner has produced the validated domain artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:domain']
      },
      {
        id: 'domain-to-snapshot',
        from: 'domain',
        to: 'snapshot',
        kind: 'normal',
        predicate:
          'The owner has produced the validated domain artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:domain']
      },
      {
        id: 'domain-to-method',
        from: 'domain',
        to: 'method',
        kind: 'normal',
        predicate:
          'The owner has produced the validated domain artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:domain']
      },
      {
        id: 'committed-model-to-project',
        from: 'edit',
        to: 'project',
        kind: 'normal',
        predicate:
          'The owner has produced the validated committed-model artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:committed-model']
      },
      {
        id: 'committed-model-to-snapshot',
        from: 'edit',
        to: 'snapshot',
        kind: 'normal',
        predicate:
          'The owner has produced the validated committed-model artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:committed-model']
      },
      {
        id: 'committed-model-to-storage',
        from: 'edit',
        to: 'storage',
        kind: 'normal',
        predicate:
          'The owner has produced the validated committed-model artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:committed-model']
      },
      {
        id: 'committed-model-to-ui',
        from: 'edit',
        to: 'ui',
        kind: 'normal',
        predicate:
          'The owner has produced the validated committed-model artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:committed-model']
      },
      {
        id: 'spatial-projection-to-engine',
        from: 'project',
        to: 'engine',
        kind: 'normal',
        predicate:
          'The owner has produced the validated spatial-projection artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:spatial-projection']
      },
      {
        id: 'visual-output-to-ui',
        from: 'engine',
        to: 'ui',
        kind: 'normal',
        predicate:
          'The owner has produced the validated visual-output artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:visual-output']
      },
      {
        id: 'snapshot-to-method',
        from: 'snapshot',
        to: 'method',
        kind: 'normal',
        predicate:
          'The owner has produced the validated snapshot artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:snapshot']
      },
      {
        id: 'snapshot-to-run',
        from: 'snapshot',
        to: 'run',
        kind: 'normal',
        predicate:
          'The owner has produced the validated snapshot artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:snapshot']
      },
      {
        id: 'method-evidence-to-run',
        from: 'method',
        to: 'run',
        kind: 'normal',
        predicate:
          'The owner has produced the validated method-evidence artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:method-evidence']
      },
      {
        id: 'result-to-project',
        from: 'run',
        to: 'project',
        kind: 'normal',
        predicate:
          'The owner has produced the validated result artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:result']
      },
      {
        id: 'result-to-storage',
        from: 'run',
        to: 'storage',
        kind: 'normal',
        predicate:
          'The owner has produced the validated result artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:result']
      },
      {
        id: 'result-to-ui',
        from: 'run',
        to: 'ui',
        kind: 'normal',
        predicate:
          'The owner has produced the validated result artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:result']
      },
      {
        id: 'retained-data-to-ui',
        from: 'storage',
        to: 'ui',
        kind: 'normal',
        predicate:
          'The owner has produced the validated retained-data artifact required by the selected consumer route.',
        producedArtifacts: ['artifact:retained-data']
      },
      {
        id: 'user-workbench-terminal',
        from: 'ui',
        kind: 'terminal',
        predicate:
          'The requested bounded output is available; this does not imply release acceptance.',
        producedArtifacts: ['artifact:user-workbench']
      },
      {
        id: 'runtime-to-surface',
        from: 'compose',
        to: 'surface',
        kind: 'normal',
        predicate: 'A composed runtime receives an App surface resize request.',
        producedArtifacts: ['artifact:runtime']
      },
      {
        id: 'surface-to-engine',
        from: 'surface',
        to: 'engine',
        kind: 'normal',
        predicate:
          'The validated size is forwarded through the active renderer to its engine.',
        producedArtifacts: ['artifact:surface-size-request']
      },
      {
        id: 'visual-asset-to-preview',
        from: 'asset',
        to: 'ui',
        kind: 'normal',
        predicate:
          'Validated visual data is available for preview before acceptance.',
        producedArtifacts: ['artifact:visual-asset']
      },
      {
        id: 'visual-asset-to-storage',
        from: 'asset',
        to: 'storage',
        kind: 'normal',
        predicate:
          'The user explicitly accepts the decoded asset for local retention.',
        producedArtifacts: ['artifact:visual-asset']
      }
    ],
    artifacts: [
      {
        id: 'artifact:feature-quiescence',
        ownerStepId: 'quiesce',
        channel: 'awaited lifecycle completion',
        consumerStepIds: ['reset-factory'],
        terminal: false
      },
      {
        id: 'artifact:factory-reset',
        ownerStepId: 'reset-factory',
        channel: 'synchronous lifecycle completion',
        consumerStepIds: ['reset-scene'],
        terminal: false
      },
      {
        id: 'artifact:scene-reset',
        ownerStepId: 'reset-scene',
        channel: 'synchronous lifecycle completion',
        consumerStepIds: ['reset-props'],
        terminal: false
      },
      {
        id: 'artifact:props-reset',
        ownerStepId: 'reset-props',
        channel: 'synchronous lifecycle completion',
        consumerStepIds: [],
        terminal: true
      },
      {
        id: 'artifact:visual-asset',
        ownerStepId: 'asset',
        channel: 'detached handoff',
        consumerStepIds: ['ui', 'storage'],
        terminal: false
      },
      {
        id: 'artifact:runtime',
        ownerStepId: 'compose',
        channel: 'detached handoff',
        consumerStepIds: ['edit', 'ui', 'surface'],
        terminal: false
      },
      {
        id: 'artifact:domain',
        ownerStepId: 'domain',
        channel: 'detached handoff',
        consumerStepIds: ['edit', 'project', 'snapshot', 'method'],
        terminal: false
      },
      {
        id: 'artifact:committed-model',
        ownerStepId: 'edit',
        channel: 'detached handoff',
        consumerStepIds: ['project', 'snapshot', 'storage', 'ui'],
        terminal: false
      },
      {
        id: 'artifact:spatial-projection',
        ownerStepId: 'project',
        channel: 'detached handoff',
        consumerStepIds: ['engine'],
        terminal: false
      },
      {
        id: 'artifact:visual-output',
        ownerStepId: 'engine',
        channel: 'detached handoff',
        consumerStepIds: ['ui'],
        terminal: false
      },
      {
        id: 'artifact:snapshot',
        ownerStepId: 'snapshot',
        channel: 'detached handoff',
        consumerStepIds: ['method', 'run'],
        terminal: false
      },
      {
        id: 'artifact:method-evidence',
        ownerStepId: 'method',
        channel: 'detached handoff',
        consumerStepIds: ['run'],
        terminal: false
      },
      {
        id: 'artifact:result',
        ownerStepId: 'run',
        channel: 'detached handoff',
        consumerStepIds: ['project', 'storage', 'ui'],
        terminal: false
      },
      {
        id: 'artifact:retained-data',
        ownerStepId: 'storage',
        channel: 'detached handoff',
        consumerStepIds: ['ui'],
        terminal: false
      },
      {
        id: 'artifact:user-workbench',
        ownerStepId: 'ui',
        channel: 'detached handoff',
        consumerStepIds: [],
        terminal: true
      },
      {
        id: 'artifact:surface-size-request',
        ownerStepId: 'surface',
        channel: 'IRenderer size command',
        consumerStepIds: ['engine'],
        terminal: false
      }
    ],
    invariants: [
      {
        id: 'one-canonical-model',
        statement:
          'Scene Tree and Props remain authoritative; derived spatial poses and results do not become a second editable model.',
        stepIds: ['domain', 'edit', 'project', 'engine'],
        artifactIds: [
          'artifact:domain',
          'artifact:committed-model',
          'artifact:spatial-projection'
        ],
        specRefs: ['#3-coordinates-units-and-support-envelope']
      },
      {
        id: 'unknown-not-clear',
        statement:
          'Unresolved, cancelled, unsupported or invalid evidence never becomes clear.',
        stepIds: ['snapshot', 'method', 'run', 'storage', 'ui'],
        artifactIds: [
          'artifact:snapshot',
          'artifact:method-evidence',
          'artifact:result'
        ],
        specRefs: ['#8-results-are-not-a-single-green-check']
      }
    ],
    acceptanceContracts: [
      {
        id: 'full-user-journey',
        title: 'Complete ordinary user journey',
        stepIds: [
          'quiesce',
          'reset-factory',
          'reset-scene',
          'reset-props',
          'compose',
          'domain',
          'edit',
          'project',
          'engine',
          'snapshot',
          'method',
          'run',
          'storage',
          'ui',
          'surface',
          'asset'
        ],
        specRefs: ['#12-representative-product-cases-and-definition-of-done'],
        assertions: [
          'Ordinary UI/import workflows and all FIRST_RELEASE gates are required; a CUSTOM engine proof is not R0 completion.'
        ]
      }
    ]
  }
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  globalThis.FLOW_INSPECTOR_DATA = freeze(data)
  if (typeof module !== 'undefined') module.exports = data
})()
