;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/headless-core-runtime-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/headless-core-runtime-flow-inspector.data.cjs'
  const lanes = [
    { id: 'input', title: 'Input Runtime', order: 1 },
    { id: 'core', title: 'Core Runtime', order: 2 },
    { id: 'app', title: 'App Compatibility', order: 3 },
    { id: 'release', title: 'Release Acceptance', order: 4 }
  ]
  const steps = [
    {
      id: 'construct-input-system',
      order: 1,
      laneId: 'input',
      title: 'Construct environment-neutral input state',
      ownerPackage: '@asyra/input-system',
      purpose:
        'Create registry, callbacks, timers, key state, and pointer state without reading browser globals or attaching listeners.',
      inputs: ['InputSystem constructor request', 'package-owned key map'],
      outputs: ['artifact:inert-input-system'],
      conditions: [
        'Construction is synchronous and side-effect-free outside the instance.',
        'Import and construction succeed when window and document do not exist.',
        'The default package singleton obeys the same inert construction contract.'
      ],
      bypasses: [
        'No browser host is required for programmatic Feature actions.'
      ],
      allowedContributors: [
        '@asyra/input-system instance state',
        '@asyra/utils environment-neutral input types'
      ],
      forbiddenContributors: [
        'window or document lookup',
        'constructor addEventListener calls',
        'DOM shim, jsdom fallback, or swallowed ReferenceError'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/index.ts',
        'packages/input-system/src/__tests__/**'
      ],
      specRefs: ['#environment-neutral-input-system'],
      failureOwnerStepId: 'construct-input-system',
      cleanupOwnerStepId: 'construct-input-system'
    },
    {
      id: 'attach-browser-host',
      order: 2,
      laneId: 'input',
      title: 'Attach exact browser input host',
      ownerPackage: '@asyra/input-system',
      purpose:
        'Explicitly bind keyboard ownership to one Window and pointer/wheel ownership to one selected target with symmetric cleanup.',
      inputs: [
        'artifact:inert-input-system',
        'app-supplied Window',
        'optional Window or HTMLElement pointer target'
      ],
      outputs: ['artifact:attached-browser-input'],
      conditions: [
        'Repeated identical attachment is idempotent.',
        'Target or document switching removes exact old listeners before attaching new listeners.',
        'switchWatchedElement derives and attaches the element owner Window.',
        'detachBrowserHost and dispose remove every owned browser listener.',
        'reset preserves the active browser attachment while clearing transient state.'
      ],
      bypasses: ['Headless startup never calls this step.'],
      allowedContributors: [
        'explicit app/Core browser activation',
        'InputSystem-owned listener callbacks and targets'
      ],
      forbiddenContributors: [
        'module-global target ownership for a custom InputSystem',
        'duplicate listeners',
        'orphan keyboard, pointer, or wheel listener after detach/dispose'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/__tests__/**',
        'packages/core/src/apis/input-system.ts',
        'packages/core/src/__tests__/**'
      ],
      specRefs: ['#environment-neutral-input-system'],
      failureOwnerStepId: 'attach-browser-host',
      cleanupOwnerStepId: 'attach-browser-host'
    },
    {
      id: 'compose-headless-core',
      order: 1,
      laneId: 'core',
      title: 'Compose fresh headless Core owners',
      ownerPackage: '@asyra/core/headless',
      purpose:
        'Create a public Core composition with fresh canonical and System Context owners while leaving optional visual/browser dependencies inert.',
      inputs: [
        'createHeadlessCore request',
        'public package constructors',
        'no Preset or app domain input'
      ],
      outputs: ['artifact:headless-core-composition'],
      conditions: [
        'The public subpath imports in Node without browser globals.',
        'Every call creates fresh Factory, Props, Scene Tree, Selection, System Context, Input, Render, and observer owners.',
        'System property APIs use the composed System Context owner.',
        'The composition installs no Preset, app domain, provider, or UI default.',
        'Process-wide definition registries are not represented as multi-tenant isolation.'
      ],
      bypasses: ['Apps may continue using the default @asyra/core singleton.'],
      allowedContributors: [
        '@asyra/core composition factory',
        'public constructors from declared Core dependencies'
      ],
      forbiddenContributors: [
        'default Core singleton reuse',
        'automatic Preset application',
        'DOM, render-engine, or app-domain construction'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/package.json',
        'packages/core/src/core.ts',
        'packages/core/src/default-core.ts',
        'packages/core/src/headless.ts',
        'packages/core/src/apis/create-apis.ts',
        'packages/core/src/apis/system-properties.ts',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/**',
        'packages/system-context/src/index.ts',
        'packages/system-context/src/__tests__/**'
      ],
      specRefs: ['#public-headless-composition'],
      failureOwnerStepId: 'compose-headless-core',
      cleanupOwnerStepId: 'start-headless-core'
    },
    {
      id: 'start-headless-core',
      order: 2,
      laneId: 'core',
      title: 'Start explicit headless runtime',
      ownerPackage: '@asyra/core',
      purpose:
        'Close and validate composition, bypass visual/browser activation, then complete data, Feature, collaboration, and readiness phases.',
      inputs: [
        'artifact:headless-core-composition',
        'optional load source or collaboration checkpoint',
        'registered non-visual Features and actions'
      ],
      outputs: ['artifact:active-headless-runtime'],
      conditions: [
        'startHeadless accepts no DOM or render options.',
        'Composition closes permanently before runtime effects.',
        'Configured provider or advanced renderer fails as a startup-mode conflict.',
        'Renderer init, canvas append, and browser input attachment are bypassed.',
        'Observers, load, Feature System without input binding, collaboration activation, and readiness still complete in order.',
        'Repeated or cross-mode startup fails and never activates a second runtime.'
      ],
      bypasses: [
        'No missing-provider exception is needed because explicit headless startup never initializes Render.'
      ],
      allowedContributors: [
        'Core composition and registration validation',
        'Core-owned canonical dependencies',
        'optional app collaboration and load providers',
        '@asyra/feature-system with System Context only'
      ],
      forbiddenContributors: [
        'renderer initialization',
        'InputSystem browser host',
        'UI activation',
        'provider-error fallback or environment shim'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/types/**',
        'packages/core/src/__tests__/**'
      ],
      specRefs: ['#explicit-startup-modes', '#supported-headless-behavior'],
      failureOwnerStepId: 'start-headless-core',
      cleanupOwnerStepId: 'start-headless-core'
    },
    {
      id: 'start-visual-core',
      order: 3,
      laneId: 'core',
      title: 'Preserve visual Core startup',
      ownerPackage: '@asyra/core',
      purpose:
        'Keep the existing renderer, canvas, composed Input System, data, Feature, collaboration, and readiness lifecycle.',
      inputs: [
        'visual Core composition',
        'HTMLElement container',
        'RenderOptions'
      ],
      outputs: ['artifact:active-visual-runtime'],
      conditions: [
        'Core initializes the configured/default renderer before later runtime phases.',
        'A returned canvas is appended and activates the exact composed InputSystem.',
        'Existing missing-provider normalization remains compatible.',
        'Real provider, engine, capability, and advanced renderer failures remain strict.',
        'Visual startup uses the same one-attempt startup ownership.'
      ],
      bypasses: [
        'The retained missing-provider compatibility route has no canvas/input but is not the documented explicit headless entry.'
      ],
      allowedContributors: [
        '@asyra/core visual startup',
        '@asyra/render abstract runtime',
        'artifact:inert-input-system through explicit activation'
      ],
      forbiddenContributors: [
        'default InputSystem singleton when a custom instance is composed',
        'generic renderer error swallowing',
        'Preset or Design System semantic changes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/apis/input-system.ts',
        'packages/core/src/__tests__/**',
        'packages/input-system/src/**'
      ],
      specRefs: ['#explicit-startup-modes', '#compatibility-contract'],
      failureOwnerStepId: 'start-visual-core',
      cleanupOwnerStepId: 'start-visual-core'
    },
    {
      id: 'verify-visual-compatibility',
      order: 1,
      laneId: 'app',
      title: 'Verify Asyra Design compatibility',
      ownerPackage: '@asyra/asyra-design',
      purpose:
        'Prove the canonical product keeps startup, canvas, keyboard, pointer, wheel, persistence, transaction, and rendering behavior.',
      inputs: ['artifact:active-visual-runtime', 'existing app Preset startup'],
      outputs: ['artifact:visual-compatibility-evidence'],
      conditions: [
        'Existing app startup code requires no semantic workaround.',
        'Formal app tests and applicable E2E/visual gates pass.',
        'Observed visual failure returns to its canonical owner and is never patched in app output.'
      ],
      bypasses: [
        'No app code change is required when existing contracts pass.'
      ],
      allowedContributors: [
        'existing Asyra Design startup/input tests',
        'existing synchronized visual review workflow'
      ],
      forbiddenContributors: [
        'app-specific input fallback',
        'Design System mutation',
        'visual fixture exception'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/init/**',
        'apps/asyra-design/src/**/__tests__/**',
        'apps/asyra-design/e2e/**',
        'create-app/asyra-design/template/**'
      ],
      specRefs: ['#compatibility-contract'],
      failureOwnerStepId: 'verify-visual-compatibility',
      cleanupOwnerStepId: 'verify-visual-compatibility'
    },
    {
      id: 'publish-headless-contract',
      order: 1,
      laneId: 'release',
      title: 'Publish truthful source contracts',
      ownerPackage: 'Framework documentation and release metadata',
      purpose:
        'Synchronize public and canonical documentation plus scoped Changesets with the exact verified runtime boundary.',
      inputs: [
        'accepted Input and Core implementation',
        'public exports and formal product cases'
      ],
      outputs: ['artifact:synchronized-headless-contract'],
      conditions: [
        'Docs distinguish no activation from no npm package dependency.',
        'Docs preserve app-domain, Preset, UI, Render, Input, and Core ownership.',
        'Ordinary scoped patch Changesets include every changed public Framework package.',
        'The website umbrella makes this child a foundation prerequisite.'
      ],
      bypasses: [
        'No README-only rewrite substitutes for API and runtime contracts.'
      ],
      allowedContributors: [
        'canonical Framework architecture/API/routing/runtime/support docs',
        'affected package README files',
        'Framework unreleased decisions and scoped Changesets'
      ],
      forbiddenContributors: [
        'claim of fully absent Render/UI npm dependencies',
        'built-in AI, BIM, physical-rule, or app-domain claim',
        'manual package version edit'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/ARCHITECTURE.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/REQUEST_ROUTING.md',
        'docs/ai/framework/RUNTIME_MATRICES.md',
        'docs/ai/framework/RELEASE_SUPPORT.md',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/packages/input-system.md',
        'docs/ai/framework/decisions/releases/unreleased.md',
        'packages/core/README.md',
        'packages/input-system/README.md',
        '.changeset/**'
      ],
      specRefs: ['#product-contract', '#validation-gates'],
      failureOwnerStepId: 'publish-headless-contract',
      cleanupOwnerStepId: 'publish-headless-contract'
    },
    {
      id: 'accept-headless-runtime',
      order: 2,
      laneId: 'release',
      title: 'Accept headless runtime after direct test',
      ownerPackage: 'product owner and release integration',
      purpose:
        'Accept the green child candidate only after the product owner personally exercises the architecture and explicitly approves merge.',
      inputs: [
        'artifact:active-headless-runtime',
        'artifact:visual-compatibility-evidence',
        'artifact:synchronized-headless-contract',
        'green child PR CI',
        'reproducible manual-test steps'
      ],
      outputs: ['artifact:accepted-headless-runtime'],
      conditions: [
        'All formal local and PR gates are green.',
        'The product owner runs the supplied direct tests.',
        'The product owner explicitly approves merge after testing.',
        'Only then may the child merge to codex/asyra-public-release-program.'
      ],
      bypasses: [
        'There is no automated or agent-owned bypass for direct acceptance.'
      ],
      allowedContributors: [
        'reviewed child commit and CI evidence',
        'product-owner direct observation and decision'
      ],
      forbiddenContributors: [
        'automatic merge after CI',
        'agent inference of user acceptance',
        'website work that assumes an unmerged contract'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/framework/plans/headless-core-runtime-plan.md',
        'child PR targeting codex/asyra-public-release-program'
      ],
      specRefs: ['#status-and-authority', '#definition-of-done'],
      failureOwnerStepId: 'accept-headless-runtime',
      cleanupOwnerStepId: 'accept-headless-runtime'
    }
  ]
  const routes = [
    {
      id: 'input-to-browser',
      from: 'construct-input-system',
      to: 'attach-browser-host',
      predicate: 'A browser app explicitly activates input.',
      producedArtifacts: ['artifact:inert-input-system']
    },
    {
      id: 'input-to-headless',
      from: 'construct-input-system',
      to: 'compose-headless-core',
      predicate: 'A Node or browser app requests headless composition.',
      producedArtifacts: ['artifact:inert-input-system']
    },
    {
      id: 'compose-to-headless-start',
      from: 'compose-headless-core',
      to: 'start-headless-core',
      predicate: 'The app selects explicit headless startup.',
      producedArtifacts: ['artifact:headless-core-composition']
    },
    {
      id: 'browser-to-visual-start',
      from: 'attach-browser-host',
      to: 'start-visual-core',
      predicate: 'Core visual startup receives a rendered canvas target.',
      producedArtifacts: ['artifact:attached-browser-input']
    },
    {
      id: 'visual-to-app-proof',
      from: 'start-visual-core',
      to: 'verify-visual-compatibility',
      predicate: 'The visual runtime is exercised through Asyra Design.',
      producedArtifacts: ['artifact:active-visual-runtime']
    },
    {
      id: 'headless-to-contract',
      from: 'start-headless-core',
      to: 'publish-headless-contract',
      predicate: 'Runtime behavior and public exports pass focused gates.',
      producedArtifacts: ['artifact:active-headless-runtime']
    },
    {
      id: 'contract-to-acceptance',
      from: 'publish-headless-contract',
      to: 'accept-headless-runtime',
      predicate: 'Docs, Changesets, local gates, and child PR CI are complete.',
      producedArtifacts: ['artifact:synchronized-headless-contract']
    },
    {
      id: 'visual-proof-to-acceptance',
      from: 'verify-visual-compatibility',
      to: 'accept-headless-runtime',
      predicate: 'Visual compatibility evidence is complete.',
      producedArtifacts: ['artifact:visual-compatibility-evidence']
    }
  ]
  const artifacts = [
    {
      id: 'artifact:inert-input-system',
      ownerStepId: 'construct-input-system',
      consumerStepIds: ['attach-browser-host', 'compose-headless-core']
    },
    {
      id: 'artifact:attached-browser-input',
      ownerStepId: 'attach-browser-host',
      consumerStepIds: ['start-visual-core']
    },
    {
      id: 'artifact:headless-core-composition',
      ownerStepId: 'compose-headless-core',
      consumerStepIds: ['start-headless-core']
    },
    {
      id: 'artifact:active-headless-runtime',
      ownerStepId: 'start-headless-core',
      consumerStepIds: ['publish-headless-contract', 'accept-headless-runtime']
    },
    {
      id: 'artifact:active-visual-runtime',
      ownerStepId: 'start-visual-core',
      consumerStepIds: ['verify-visual-compatibility']
    },
    {
      id: 'artifact:visual-compatibility-evidence',
      ownerStepId: 'verify-visual-compatibility',
      consumerStepIds: ['accept-headless-runtime']
    },
    {
      id: 'artifact:synchronized-headless-contract',
      ownerStepId: 'publish-headless-contract',
      consumerStepIds: ['accept-headless-runtime']
    },
    {
      id: 'artifact:accepted-headless-runtime',
      ownerStepId: 'accept-headless-runtime',
      consumerStepIds: []
    }
  ]
  const invariants = [
    'InputSystem import and construction never require browser globals.',
    'Browser listeners exist only after explicit activation and have symmetric instance-owned cleanup.',
    'Explicit headless startup never initializes Render or attaches InputSystem.',
    'Core canonical, transaction, persistence, and Feature ownership does not depend on visual activation.',
    'The visual/default Core path and Asyra Design remain compatible.',
    'A green pull request cannot bypass product-owner direct testing and explicit approval.'
  ]
  const productCases = [
    {
      id: 'node-imports',
      summary: 'Public imports succeed without DOM globals.'
    },
    {
      id: 'inert-input-construction',
      summary: 'Input construction attaches zero listeners.'
    },
    {
      id: 'explicit-browser-attachment',
      summary: 'Host and pointer target receive exact listeners once.'
    },
    {
      id: 'browser-switch-cleanup',
      summary: 'Switch and dispose remove exact prior listeners.'
    },
    {
      id: 'fresh-headless-composition',
      summary: 'Factory creates fresh canonical and System Context owners.'
    },
    {
      id: 'headless-information-model',
      summary:
        'Node runtime completes model, transaction, persistence, and Feature cases.'
    },
    {
      id: 'startup-conflicts',
      summary: 'Visual configuration and repeated startup fail explicitly.'
    },
    {
      id: 'visual-compatibility',
      summary: 'Core visual path and Asyra Design remain unchanged.'
    }
  ]
  const definitionOfDone = [
    {
      id: 'dom-safe-public-imports',
      summary: 'Input/Core/headless imports are Node-safe.'
    },
    {
      id: 'exact-input-lifecycle',
      summary: 'Browser activation and cleanup are instance-owned and tested.'
    },
    {
      id: 'explicit-headless-runtime',
      summary:
        'Headless startup and supported model operations are formally proven.'
    },
    {
      id: 'visual-compatibility',
      summary: 'Visual Core and Asyra Design gates pass.'
    },
    {
      id: 'truthful-contracts',
      summary: 'Docs and Changesets match the exact verified boundary.'
    },
    {
      id: 'owner-acceptance',
      summary: 'Product owner personally tests and explicitly approves merge.'
    }
  ]
  const data = {
    schema: 'flow-inspector.v1',
    target: {
      id: 'headless-core-runtime',
      title: 'Headless Core Runtime Flow',
      summary:
        'Environment-neutral Input construction, explicit browser activation, first-class headless Core composition, and preserved visual runtime.'
    },
    authority: {
      specPath,
      inspectorPath,
      rulePaths: [
        'docs/ai/framework/rules/bounded-task-scope-and-closure.md',
        'docs/ai/framework/rules/bugfix-test-first.md',
        'docs/ai/framework/rules/no-patch-fixes.md',
        'docs/ai/framework/rules/inspector-contract-readiness.md',
        'docs/ai/framework/rules/inspector-step-execution.md'
      ]
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product contract',
        href: './headless-core-runtime-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: './__tests__/headless-core-runtime-flow-inspector.contract.test.cjs'
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
