;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/input-system-environment-neutrality-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/input-system-environment-neutrality-flow-inspector.data.cjs'
  const lanes = [
    { id: 'input', title: 'Input Runtime', order: 1 },
    { id: 'integration', title: 'Visual Integration', order: 2 },
    { id: 'release', title: 'Release Acceptance', order: 3 }
  ]
  const steps = [
    {
      id: 'construct-input-system',
      order: 1,
      laneId: 'input',
      title: 'Construct environment-neutral input state',
      ownerPackage: '@asyra/input-system',
      purpose:
        'Initialize instance-owned input state without reading browser globals or attaching browser listeners.',
      inputs: ['InputSystem construction request', 'package-owned key map'],
      outputs: ['artifact:inert-input-system'],
      conditions: [
        'Import and construction succeed when window and document do not exist.',
        'Construction registers zero keyboard, pointer, or wheel listeners.',
        'The default package singleton obeys the same inert contract.'
      ],
      bypasses: [
        'A consumer that does not activate a browser host keeps the instance inert.'
      ],
      allowedContributors: [
        '@asyra/input-system instance state',
        '@asyra/utils environment-neutral input types'
      ],
      forbiddenContributors: [
        'window or document lookup',
        'constructor addEventListener calls',
        'DOM shim, swallowed ReferenceError, or fake browser fallback'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/index.ts',
        'packages/input-system/src/__tests__/node-import.test.ts',
        'packages/core/src/__tests__/node-import.test.ts'
      ],
      specRefs: ['#environment-neutral-construction'],
      failureOwnerStepId: 'construct-input-system',
      cleanupOwnerStepId: 'construct-input-system'
    },
    {
      id: 'attach-browser-host',
      order: 2,
      laneId: 'input',
      title: 'Own one browser host and pointer target',
      ownerPackage: '@asyra/input-system',
      purpose:
        'Explicitly bind keyboard ownership to one Window and pointer/wheel ownership to one selected target with symmetric cleanup.',
      inputs: [
        'artifact:inert-input-system',
        'consumer-supplied Window',
        'optional Window or HTMLElement pointer target'
      ],
      outputs: ['artifact:attached-browser-input'],
      conditions: [
        'Repeated identical attachment is idempotent.',
        'Target or document switching removes exact old listeners before attaching new listeners.',
        'switchWatchedElement derives the owner Window from the element.',
        'detachBrowserHost and dispose remove every owned browser listener.',
        'reset preserves the active attachment while clearing transient state.'
      ],
      bypasses: [
        'Programmatic consumers may remain inert without claiming a Headless Core runtime.'
      ],
      allowedContributors: [
        'explicit consumer or existing Core watched-element activation',
        'InputSystem-owned listener callbacks and targets'
      ],
      forbiddenContributors: [
        'implicit constructor activation',
        'duplicate listeners',
        'orphan keyboard, pointer, or wheel listeners'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/src/input-system.ts',
        'packages/input-system/src/__tests__/input-system.test.ts'
      ],
      specRefs: ['#explicit-browser-listener-lifecycle'],
      failureOwnerStepId: 'attach-browser-host',
      cleanupOwnerStepId: 'attach-browser-host'
    },
    {
      id: 'preserve-visual-integration',
      order: 1,
      laneId: 'integration',
      title: 'Preserve existing visual input activation',
      ownerPackage: '@asyra/core',
      purpose:
        'Keep Core setupInputSystem on the typed watched-element event route so the default Input System activates against the rendered canvas.',
      inputs: [
        'artifact:attached-browser-input',
        'existing Core canvas startup',
        'existing Input System event subscriber'
      ],
      outputs: ['artifact:visual-input-compatibility'],
      conditions: [
        'Core emits the existing watched-element event instead of directly calling Input System.',
        'The default subscriber transfers input ownership to the canvas and its owner Window.',
        'Asyra Design keyboard, pointer, wheel, canvas, and Feature paths remain behaviorally compatible.'
      ],
      bypasses: [
        'No public Headless Core or Core Kernel behavior is introduced or proven here.'
      ],
      allowedContributors: [
        '@asyra/core input facade',
        '@asyra/reactive-events watched-element event',
        '@asyra/input-system default subscriber',
        'Asyra Design compatibility tests'
      ],
      forbiddenContributors: [
        'direct cross-package Core-to-Input owner call',
        'Feature, transaction, Render, Preset, or Design System redesign',
        'new Headless Core entrypoint'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/apis/input-system.ts',
        'packages/input-system/src/subscribe.ts',
        'apps/asyra-design/** direct compatibility tests only'
      ],
      specRefs: ['#existing-visual-integration'],
      failureOwnerStepId: 'preserve-visual-integration',
      cleanupOwnerStepId: 'attach-browser-host'
    },
    {
      id: 'accept-input-release-child',
      order: 1,
      laneId: 'release',
      title: 'Accept the Input System release child',
      ownerPackage: 'release integration + product owner',
      purpose:
        'Publish truthful Input lifecycle contracts, pass automated gates, then require direct product-owner browser testing before merge.',
      inputs: [
        'artifact:visual-input-compatibility',
        'synchronized docs and scoped Changeset',
        'green child PR CI'
      ],
      outputs: ['artifact:accepted-input-release-child'],
      conditions: [
        'Docs distinguish Node-safe import from future Headless/Core Kernel support.',
        'The future plan cites the retained architecture research report.',
        'The product owner personally exercises keyboard, pointer, wheel, and canvas behavior and explicitly approves merge.'
      ],
      bypasses: ['There is no automated or agent-owned manual-test bypass.'],
      allowedContributors: [
        'package and canonical docs',
        'ordinary scoped Changeset',
        'focused tests, builds, lint, PR CI, and product-owner evidence'
      ],
      forbiddenContributors: [
        'automatic merge after CI',
        'claiming current public Headless Core support',
        'unrelated website, package, or domain changes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/input-system/README.md',
        'docs/ai/framework/packages/input-system.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/RELEASE_SUPPORT.md',
        'docs/ai/framework/plans/** direct program/future contracts',
        'docs/ai/framework/research/headless-core-and-core-kernel-architecture-research.md',
        'docs/ai/framework/decisions/releases/unreleased.md',
        '.changeset/** scoped entry'
      ],
      specRefs: ['#validation-gates', '#definition-of-done'],
      failureOwnerStepId: 'accept-input-release-child',
      cleanupOwnerStepId: 'attach-browser-host'
    }
  ]
  const routes = [
    {
      id: 'construct-to-attach',
      from: 'construct-input-system',
      to: 'attach-browser-host',
      predicate: 'A browser consumer explicitly activates input.',
      producedArtifacts: ['artifact:inert-input-system']
    },
    {
      id: 'attach-to-visual',
      from: 'attach-browser-host',
      to: 'preserve-visual-integration',
      predicate: 'Core startup supplies the rendered canvas through its existing event route.',
      producedArtifacts: ['artifact:attached-browser-input']
    },
    {
      id: 'visual-to-acceptance',
      from: 'preserve-visual-integration',
      to: 'accept-input-release-child',
      predicate: 'Compatibility evidence and synchronized contracts are ready.',
      producedArtifacts: ['artifact:visual-input-compatibility']
    }
  ]
  const artifacts = [
    {
      id: 'artifact:inert-input-system',
      ownerStepId: 'construct-input-system',
      consumerStepIds: ['attach-browser-host']
    },
    {
      id: 'artifact:attached-browser-input',
      ownerStepId: 'attach-browser-host',
      consumerStepIds: ['preserve-visual-integration']
    },
    {
      id: 'artifact:visual-input-compatibility',
      ownerStepId: 'preserve-visual-integration',
      consumerStepIds: ['accept-input-release-child']
    },
    {
      id: 'artifact:accepted-input-release-child',
      ownerStepId: 'accept-input-release-child',
      consumerStepIds: []
    }
  ]
  const invariants = [
    'Input System import and construction never require browser globals.',
    'Browser listeners exist only after explicit activation and have symmetric instance-owned cleanup.',
    'Core keeps its existing reactive watched-element route.',
    'Node-safe import is not represented as a public Headless Core or Core Kernel.',
    'A green PR cannot bypass product-owner direct testing and approval.'
  ]
  const productCases = [
    { id: 'node-imports', summary: 'Input System and Core import without DOM globals.' },
    { id: 'inert-construction', summary: 'Input construction attaches zero listeners.' },
    { id: 'exact-attachment', summary: 'Host and pointer targets receive exact listeners once.' },
    { id: 'switch-cleanup', summary: 'Target/document switches and dispose remove exact prior listeners.' },
    { id: 'visual-compatibility', summary: 'Core and Asyra Design retain the existing visual input route.' }
  ]
  const definitionOfDone = [
    { id: 'dom-safe-imports', summary: 'Input and Core public imports are DOM-neutral.' },
    { id: 'exact-lifecycle', summary: 'Browser activation and cleanup are explicit and tested.' },
    { id: 'truthful-contracts', summary: 'Docs and Changeset match current behavior and future boundaries.' },
    { id: 'owner-acceptance', summary: 'The product owner directly tests and approves merge.' }
  ]
  const data = {
    schema: 'flow-inspector.v1',
    target: {
      id: 'input-system-environment-neutrality',
      title: 'Input System Environment Neutrality Flow',
      summary:
        'DOM-neutral construction, explicit browser listener ownership, preserved Core event integration, and owner-gated release acceptance.'
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
        href: './input-system-environment-neutrality-plan.md'
      },
      {
        id: 'contract-test',
        label: 'Contract test',
        href: './__tests__/input-system-environment-neutrality-flow-inspector.contract.test.cjs'
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
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }
  freeze(data)
  if (typeof globalThis !== 'undefined') globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) module.exports = data
})()
