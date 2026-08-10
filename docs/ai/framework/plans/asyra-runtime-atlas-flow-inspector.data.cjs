const caseIds = Object.freeze([
  'continuous-pointer-undo',
  'canonical-projection-fanout',
  'invalid-input-rollback',
  'collaboration-two-actors',
  'ai-registered-action',
  'machine-retrieval-action'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath: 'docs/ai/framework/plans/asyra-runtime-atlas-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-runtime-atlas-flow-inspector.data.cjs',
    exampleInventoryPath: 'docs/examples/inventory.json',
    contentIndexPath: 'docs/public/generated/content-index.json',
    visualHandoffPath:
      'docs/ai/framework/website/visual-reimagine/handoff.md',
    selectedVisualPath:
      'docs/ai/framework/website/visual-reimagine/selected-atlas-states.png',
    landingInspectorPath:
      'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
    workspacePath: 'apps/asyra-framework-site'
  }),
  caseIds,
  exampleMappings: Object.freeze({
    'continuous-pointer-undo': Object.freeze(['feature-session-undo']),
    'canonical-projection-fanout': Object.freeze([
      'core-information-model',
      'custom-component-schema'
    ]),
    'invalid-input-rollback': Object.freeze(['feature-session-undo']),
    'collaboration-two-actors': Object.freeze([
      'collaboration-two-memory-actors'
    ]),
    'ai-registered-action': Object.freeze(['ai-registered-action']),
    'machine-retrieval-action': Object.freeze(['app-retrieval-action'])
  }),
  steps: Object.freeze([
    step({
      id: 'freeze-atlas-contract',
      order: 1,
      ownerPackage: 'Runtime Atlas product contract',
      purpose:
        'Freeze the worldwide plain-language experience, six exact cases, public runtime boundary, observation schema, owner disclosures, and Atlas gates before runtime or UI implementation.',
      inputs: [
        'artifact:verified-landing',
        'accepted public content and executable-example inventories',
        'accepted Runtime Atlas visual handoff',
        'current public Framework owner contracts'
      ],
      outputs: ['artifact:atlas-contract'],
      conditions: [
        'A non-engineer can understand intent, owner, and verified outcome before package details.',
        'The six case ids and maintained example mappings are exact.',
        'The runtime is an isolated browser composition and never a Headless Core/Core Kernel claim.',
        'Every displayed value is either declared contract metadata or detached executing-runtime evidence.'
      ],
      bypasses: ['No runtime or Atlas UI code may bypass contract readiness.'],
      allowedContributors: [
        'Atlas plan and Inspector',
        'accepted inventories and visual handoff',
        'current public package contracts'
      ],
      forbiddenContributors: [
        'package-private source',
        'fake runtime evidence or predicted success',
        'possible App domain presented as Framework output',
        'future server or Headless lifecycle claim'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/asyra-runtime-atlas-plan.md',
        'docs/ai/framework/plans/asyra-runtime-atlas-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-runtime-atlas-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#bounded-task-contract',
        '#supported-product-contract',
        '#public-runtime-and-observation-contract',
        '#executable-product-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-atlas-contract'
    }),
    step({
      id: 'compose-browser-runtime-harness',
      order: 2,
      ownerPackage: 'Runtime Atlas browser harness',
      purpose:
        'Own the resettable worker protocol, fresh-run lifecycle, ordered stepping, replay, disposal, and detached evidence transport without becoming a canonical owner.',
      inputs: ['artifact:atlas-contract', 'public Framework package roots'],
      outputs: ['artifact:atlas-runtime-harness'],
      conditions: [
        'Each reset or case change terminates the prior worker and creates a fresh runtime.',
        'Run ids and evidence sequences are monotonic inside one fresh run.',
        'Pause stops automatic UI advancement without changing worker state.',
        'Unexpected failure terminates visibly and never substitutes output.'
      ],
      bypasses: [
        'Reduced motion removes automatic timing but preserves manual stepping and complete evidence.'
      ],
      allowedContributors: [
        'artifact:atlas-contract',
        'Web Worker platform APIs',
        'detached structured-clone-safe evidence'
      ],
      forbiddenContributors: [
        'server execution',
        'shared worker state across cases',
        'React state as canonical evidence',
        'fallback success response'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/lib/runtime-atlas/case-definitions.mjs',
        'apps/asyra-framework-site/lib/runtime-atlas/case-definitions.d.ts',
        'apps/asyra-framework-site/lib/runtime-atlas/runtime.mjs',
        'apps/asyra-framework-site/lib/runtime-atlas/runtime.d.ts',
        'apps/asyra-framework-site/workers/runtime-atlas.worker.ts',
        'apps/asyra-framework-site/__tests__/runtime-atlas-harness.test.mjs'
      ],
      specRefs: [
        '#supported-product-contract',
        '#public-runtime-and-observation-contract',
        '#interaction-contract'
      ],
      failureOwnerStepId: 'compose-browser-runtime-harness'
    }),
    step({
      id: 'execute-canonical-runtime-cases',
      order: 3,
      ownerPackage: 'Runtime Atlas canonical cases',
      purpose:
        'Execute continuous-session, canonical projection, and rollback cases through public Feature, Factory, Core, and System Context paths.',
      inputs: ['artifact:atlas-contract', 'artifact:atlas-runtime-harness'],
      outputs: ['artifact:canonical-runtime-evidence'],
      conditions: [
        'Three pointer updates settle as exactly one new Undo unit.',
        'One Feature API mutation returns canonical state for App-owned projection.',
        'Rejected input rolls back completely and adds no Undo entry.'
      ],
      bypasses: ['Render and UI remain optional consumers, never state owners.'],
      allowedContributors: [
        '@asyra/core',
        '@asyra/factory',
        '@asyra/feature-system',
        '@asyra/reactive-events',
        '@asyra/system-context'
      ],
      forbiddenContributors: [
        'package-private import',
        'pixel-derived success',
        'second transaction or canonical owner',
        'hard-coded successful output'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/package.json',
        'apps/asyra-framework-site/lib/runtime-atlas/runtime.mjs',
        'apps/asyra-framework-site/__tests__/runtime-atlas-canonical.test.mjs'
      ],
      specRefs: [
        '#continuous-pointer-and-one-undo-unit',
        '#canonical-projection-fan-out',
        '#invalid-input-rollback'
      ],
      failureOwnerStepId: 'execute-canonical-runtime-cases'
    }),
    step({
      id: 'execute-optional-composition-cases',
      order: 4,
      ownerPackage: 'Runtime Atlas optional composition cases',
      purpose:
        'Execute Collaboration, AI, and machine-retrieval cases through public optional packages and app-owned policy/action boundaries.',
      inputs: ['artifact:atlas-contract', 'artifact:atlas-runtime-harness'],
      outputs: ['artifact:optional-runtime-evidence'],
      conditions: [
        'Two explicitly started browser actors converge one publication while Awareness remains ephemeral.',
        'The prepared AI action executes through registered App policy and one transaction runner.',
        'Retrieval is read-only and mutation occurs only through the registered Feature API.'
      ],
      bypasses: [
        'Disabled optional systems remain absent and no provider network or credential is used.'
      ],
      allowedContributors: [
        '@asyra/collaboration',
        '@asyra/factory',
        '@asyra/ai-agent-runtime',
        '@asyra/core',
        'app-owned in-memory policy and adapters'
      ],
      forbiddenContributors: [
        'durability, auth, conflict, or vendor-model claim',
        'AI direct canonical mutation',
        'Awareness as canonical state',
        'retrieval side effect'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/package.json',
        'apps/asyra-framework-site/lib/runtime-atlas/runtime.mjs',
        'apps/asyra-framework-site/__tests__/runtime-atlas-composition.test.mjs'
      ],
      specRefs: [
        '#two-browser-actors',
        '#registered-ai-action',
        '#machine-retrieval-and-registered-action'
      ],
      failureOwnerStepId: 'execute-optional-composition-cases'
    }),
    step({
      id: 'present-atlas-experience',
      order: 5,
      ownerPackage: 'Runtime Atlas presentation',
      purpose:
        'Present plain-language case choice, replay controls, ownership route, live evidence, App-owned projections, comparison, failure, and Roadmap boundary accessibly across viewports.',
      inputs: [
        'artifact:atlas-contract',
        'artifact:atlas-runtime-harness',
        'artifact:canonical-runtime-evidence',
        'artifact:optional-runtime-evidence',
        'artifact:verified-platform'
      ],
      outputs: ['artifact:atlas-experience'],
      conditions: [
        'Plain-language purpose and expected outcome precede technical evidence.',
        'Run, Pause, Step, Replay, Reset, case selection, and completed-run comparison are keyboard and touch operable.',
        'Canvas, hierarchy, properties, serialization, search, and presence are visibly App-owned projections.',
        'Default, active, success, rejection, unexpected failure, reduced-motion, mobile, and wide states are distinguishable.'
      ],
      bypasses: [
        'Without worker support the route explains the requirement and reports the runtime unavailable; it never fabricates a run.',
        'Reduced motion uses immediate state changes and manual stepping.'
      ],
      allowedContributors: [
        'Atlas worker evidence',
        'accepted site foundations and Material Blueprint visual tokens',
        'semantic HTML, CSS, Canvas, and accessible controls'
      ],
      forbiddenContributors: [
        'presentation-generated canonical result',
        'autoplay without pause',
        'hover-only meaning',
        'Framework ownership assigned to App projections'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/atlas/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/components/runtime-atlas.tsx',
        'apps/asyra-framework-site/components/runtime-atlas-projection.tsx',
        'apps/asyra-framework-site/__tests__/runtime-atlas-presentation.test.mjs',
        'apps/asyra-framework-site/__tests__/e2e/runtime-atlas-visual.spec.ts'
      ],
      specRefs: [
        '#interaction-contract',
        '#supported-product-contract',
        '#public-runtime-and-observation-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'present-atlas-experience'
    }),
    step({
      id: 'verify-runtime-atlas',
      order: 6,
      ownerPackage: 'Runtime Atlas verification',
      purpose:
        'Fail closed on contract, runtime, reset isolation, public-boundary, accessibility, responsive, performance, visual, route, or production-build drift.',
      inputs: [
        'artifact:canonical-runtime-evidence',
        'artifact:optional-runtime-evidence',
        'artifact:atlas-experience'
      ],
      outputs: ['artifact:verified-runtime-atlas'],
      conditions: [
        'All six cases execute from fresh runtimes and match their exact expected results.',
        'Inspector, focused tests, public import checks, strict typecheck, lint, build, route smoke, accessibility, performance, and synchronized visual gates pass.',
        'Desktop, 390px, 320px, keyboard, touch, 200 percent zoom, reduced motion, no overflow, rejection, and reset isolation pass.'
      ],
      bypasses: [
        'Production deployment remains owned by Launch and Operations.',
        'Framework package publication remains outside this program child.'
      ],
      allowedContributors: [
        'deterministic project-owned tests',
        'production browser bundle',
        'synchronized live browser evidence',
        'bounded performance measurements'
      ],
      forbiddenContributors: [
        'manual inspection as sole evidence',
        'Node-only execution used as browser proof',
        'missing-case allowlist',
        'deployment success used as runtime correctness'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/**',
        'docs/ai/framework/plans/asyra-runtime-atlas-plan.md',
        'docs/ai/framework/plans/asyra-runtime-atlas-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-runtime-atlas-flow-inspector.contract.test.cjs'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-runtime-atlas'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:atlas-contract', 'freeze-atlas-contract'],
      ['artifact:atlas-runtime-harness', 'compose-browser-runtime-harness'],
      ['artifact:canonical-runtime-evidence', 'execute-canonical-runtime-cases'],
      ['artifact:optional-runtime-evidence', 'execute-optional-composition-cases'],
      ['artifact:atlas-experience', 'present-atlas-experience'],
      ['artifact:verified-runtime-atlas', 'verify-runtime-atlas']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      ['freeze-atlas-contract', 'compose-browser-runtime-harness', 'artifact:atlas-contract'],
      ['freeze-atlas-contract', 'execute-canonical-runtime-cases', 'artifact:atlas-contract'],
      ['compose-browser-runtime-harness', 'execute-canonical-runtime-cases', 'artifact:atlas-runtime-harness'],
      ['freeze-atlas-contract', 'execute-optional-composition-cases', 'artifact:atlas-contract'],
      ['compose-browser-runtime-harness', 'execute-optional-composition-cases', 'artifact:atlas-runtime-harness'],
      ['compose-browser-runtime-harness', 'present-atlas-experience', 'artifact:atlas-runtime-harness'],
      ['execute-canonical-runtime-cases', 'present-atlas-experience', 'artifact:canonical-runtime-evidence'],
      ['execute-optional-composition-cases', 'present-atlas-experience', 'artifact:optional-runtime-evidence'],
      ['execute-canonical-runtime-cases', 'verify-runtime-atlas', 'artifact:canonical-runtime-evidence'],
      ['execute-optional-composition-cases', 'verify-runtime-atlas', 'artifact:optional-runtime-evidence'],
      ['present-atlas-experience', 'verify-runtime-atlas', 'artifact:atlas-experience']
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `atlas-route-${String(index + 1).padStart(2, '0')}`,
        from,
        to,
        producedArtifacts: Object.freeze([artifactId])
      })
    )
  ),
  invariants: Object.freeze([
    'A worldwide non-engineer understands intent, owner, and verified outcome before technical depth.',
    'All runtime output originates in a fresh executing browser runtime.',
    'Framework, Preset, App, optional Provider, and projection ownership remain explicit.',
    'Canvas, hierarchy, properties, serialization, retrieval, and Awareness views never become canonical owners.',
    'Possible App domains never become built-in Framework capabilities.',
    'Future machine-facing Headless Core/Core Kernel work remains Roadmap.',
    'Production deployment remains outside the Atlas child.'
  ])
})
