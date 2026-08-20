const directionIds = Object.freeze([
  'topology-observatory',
  'material-blueprint',
  'signal-ledger'
])

const viewStateIds = Object.freeze([
  'landing-desktop',
  'landing-mobile',
  'docs-desktop',
  'docs-mobile-navigation',
  'docs-mobile-reading',
  'atlas-default',
  'atlas-active-flow',
  'atlas-failure',
  'asyra-design-case-study',
  'release-roadmap-boundary',
  'motion-intent',
  'motion-transaction',
  'motion-projection',
  'motion-reduced'
])

const conceptPaths = Object.freeze([
  'docs/ai/framework/website/visual-reimagine/direction-topology-observatory.png',
  'docs/ai/framework/website/visual-reimagine/direction-material-blueprint.png',
  'docs/ai/framework/website/visual-reimagine/direction-signal-ledger.png',
  'docs/ai/framework/website/visual-reimagine/selected-landing-responsive.png',
  'docs/ai/framework/website/visual-reimagine/selected-docs-responsive.png',
  'docs/ai/framework/website/visual-reimagine/selected-atlas-states.png',
  'docs/ai/framework/website/visual-reimagine/selected-case-roadmap.png',
  'docs/ai/framework/website/visual-reimagine/selected-motion-storyboard.png'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/completed/asyra-website-visual-reimagine-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-website-visual-reimagine-flow-inspector.data.cjs',
    manifestPath:
      'docs/ai/framework/website/visual-reimagine/concept-manifest.json',
    handoffPath: 'docs/ai/framework/website/visual-reimagine/handoff.md'
  }),
  directionIds,
  viewStateIds,
  conceptPaths,
  steps: Object.freeze([
    step({
      id: 'freeze-visual-brief',
      order: 1,
      ownerPackage: 'Asyra visual-experience contract',
      purpose:
        'Freeze product meaning, exact view states, semantic visual roles, accessibility constraints, asset policy, and autonomous acceptance before image generation.',
      inputs: [
        'accepted Asyra product and ownership definition',
        'accepted public documentation and executable-example handoffs',
        'Visual Reimagine plan requirements'
      ],
      outputs: ['artifact:visual-brief'],
      conditions: [
        'Three direction ids and all fourteen view-state ids are exact and unique.',
        'Current runtime, optional composition, app-owned domains, and future work remain visually distinct.',
        'A global non-engineer can understand the first narrative layer before technical progressive disclosure.',
        'No external asset, font, dependency, or website implementation is authorized.'
      ],
      bypasses: [
        'The intermediate user checkpoint is bypassed only by the later explicit program instruction; final integrated-goal acceptance remains.'
      ],
      allowedContributors: [
        'umbrella website product definition',
        'accepted public content and example evidence',
        'active Framework ownership contracts'
      ],
      forbiddenContributors: [
        'generic documentation templates',
        'future runtime presented as current',
        'unapproved assets, fonts, services, or dependencies'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-website-visual-reimagine-plan.md',
        'docs/ai/framework/plans/asyra-website-visual-reimagine-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-visual-reimagine-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#required-reimagine-set',
        '#visual-language-contract',
        '#autonomous-inspection-and-final-acceptance'
      ],
      failureOwnerStepId: 'freeze-visual-brief'
    }),
    step({
      id: 'generate-concept-directions',
      order: 2,
      ownerPackage: 'image-first concept generation',
      purpose:
        'Generate three coherent, original full-page directions from the frozen brief without turning generated text or diagrams into semantic authority.',
      inputs: ['artifact:visual-brief'],
      outputs: ['artifact:concept-directions'],
      conditions: [
        'Every direction is a useful-scale PNG inspected after generation.',
        'Directions differ in spatial, material, typography, and density strategy while preserving shared semantic roles.'
      ],
      bypasses: [
        'A failed or illegible generation is discarded and regenerated from the same frozen brief.'
      ],
      allowedContributors: [
        'project-owned visual brief',
        'built-in image generation',
        'agent full-scale image inspection'
      ],
      forbiddenContributors: [
        'external licensed media',
        'generated words as verified product copy',
        'website source code or production assets'
      ],
      implementationBoundary: [
        'docs/ai/framework/website/visual-reimagine/direction-*.png',
        'docs/ai/framework/website/visual-reimagine/concept-manifest.json'
      ],
      specRefs: ['#required-reimagine-set', '#ownership-boundary'],
      failureOwnerStepId: 'generate-concept-directions'
    }),
    step({
      id: 'select-and-refine-direction',
      order: 3,
      ownerPackage: 'visual direction selection',
      purpose:
        'Inspect the three directions and refine one into the complete responsive, documentation, Atlas, case-study, roadmap, and motion board set.',
      inputs: ['artifact:visual-brief', 'artifact:concept-directions'],
      outputs: ['artifact:selected-visual-boards'],
      conditions: [
        'All fourteen required view states resolve to one or more selected boards.',
        'Landing begins with plain international English and concrete outcomes before package or transaction language.',
        'Long-form reading, focus visibility, touch targets, failure state, and reduced-motion equivalence are visible or annotated.',
        'The selected language can be translated with repository-owned CSS, SVG, and runtime primitives.'
      ],
      bypasses: [
        'Composite boards are allowed only when every mapped state remains legible at useful inspection scale.'
      ],
      allowedContributors: [
        'artifact:visual-brief',
        'artifact:concept-directions',
        'bounded full-scale inspection findings'
      ],
      forbiddenContributors: [
        'aesthetic preference that breaks semantic roles',
        'single-desktop-only direction',
        'animation with no reduced-motion state'
      ],
      implementationBoundary: [
        'docs/ai/framework/website/visual-reimagine/selected-*.png',
        'docs/ai/framework/website/visual-reimagine/concept-manifest.json'
      ],
      specRefs: [
        '#implementation-handoff',
        '#motion-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'select-and-refine-direction'
    }),
    step({
      id: 'annotate-visual-handoff',
      order: 4,
      ownerPackage: 'visual implementation handoff',
      purpose:
        'Convert inspected visual evidence into exact responsive, color, type, spacing, state, interaction, motion, accessibility, and per-view implementation rules.',
      inputs: ['artifact:visual-brief', 'artifact:selected-visual-boards'],
      outputs: ['artifact:annotated-visual-handoff'],
      conditions: [
        'The handoff defines semantic tokens without authoring website components.',
        'The handoff defines progressive disclosure and localization-resilient layout for a worldwide technical and non-technical audience.',
        'Every selected board and view state has an annotation and implementation boundary.',
        'Generated imagery remains evidence rather than a production dependency.'
      ],
      bypasses: [
        'Exact marketing copy and runtime data remain owned by their downstream content or runtime owners.'
      ],
      allowedContributors: [
        'artifact:selected-visual-boards',
        'formal inspection results',
        'project-owned platform constraints'
      ],
      forbiddenContributors: [
        'new product claims',
        'component implementation',
        'hard dependency on generated raster imagery'
      ],
      implementationBoundary: [
        'docs/ai/framework/website/visual-reimagine/handoff.md',
        'docs/ai/framework/website/visual-reimagine/concept-manifest.json'
      ],
      specRefs: ['#implementation-handoff', '#definition-of-done'],
      failureOwnerStepId: 'annotate-visual-handoff'
    }),
    step({
      id: 'verify-visual-handoff',
      order: 5,
      ownerPackage: 'Visual Reimagine verification',
      purpose:
        'Fail closed on missing, undersized, uninspected, semantically ambiguous, inaccessible, or implementation-dependent concept evidence.',
      inputs: [
        'artifact:concept-directions',
        'artifact:selected-visual-boards',
        'artifact:annotated-visual-handoff'
      ],
      outputs: ['artifact:verified-visual-handoff'],
      conditions: [
        'The manifest, eight PNG boards, handoff, Inspector, and contract cases agree exactly.',
        'Every image is inspected and every required state, semantic role, accessibility requirement, and motion equivalent resolves.',
        'No site source, package behavior, or external asset was introduced.'
      ],
      bypasses: [
        'Final user acceptance occurs only after the integrated goal is complete.'
      ],
      allowedContributors: ['deterministic project-owned visual handoff gates'],
      forbiddenContributors: [
        'thumbnail-only review',
        'missing-state allowlists',
        'manual acceptance as the sole evidence'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-website-visual-reimagine-plan.md',
        'docs/ai/framework/plans/asyra-website-visual-reimagine-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-visual-reimagine-flow-inspector.contract.test.cjs',
        'docs/ai/framework/website/visual-reimagine/**'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-visual-handoff'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:visual-brief', 'freeze-visual-brief'],
      ['artifact:concept-directions', 'generate-concept-directions'],
      ['artifact:selected-visual-boards', 'select-and-refine-direction'],
      ['artifact:annotated-visual-handoff', 'annotate-visual-handoff'],
      ['artifact:verified-visual-handoff', 'verify-visual-handoff']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      [
        'freeze-visual-brief',
        'generate-concept-directions',
        'artifact:visual-brief'
      ],
      [
        'freeze-visual-brief',
        'select-and-refine-direction',
        'artifact:visual-brief'
      ],
      [
        'generate-concept-directions',
        'select-and-refine-direction',
        'artifact:concept-directions'
      ],
      [
        'select-and-refine-direction',
        'annotate-visual-handoff',
        'artifact:selected-visual-boards'
      ],
      [
        'generate-concept-directions',
        'verify-visual-handoff',
        'artifact:concept-directions'
      ],
      [
        'select-and-refine-direction',
        'verify-visual-handoff',
        'artifact:selected-visual-boards'
      ],
      [
        'annotate-visual-handoff',
        'verify-visual-handoff',
        'artifact:annotated-visual-handoff'
      ]
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `visual-route-${index + 1}`,
        from,
        to,
        producedArtifacts: [artifactId]
      })
    )
  ),
  acceptanceContracts: Object.freeze([
    Object.freeze({
      id: 'complete-responsive-surface-set',
      stepIds: ['select-and-refine-direction', 'verify-visual-handoff'],
      assertions: [
        'All fourteen required view states are mapped exactly once or to an explicit shared board.',
        'Desktop, mobile, reading, navigation, active, failure, case, roadmap, and motion states are present.'
      ]
    }),
    Object.freeze({
      id: 'semantic-runtime-language',
      stepIds: ['freeze-visual-brief', 'annotate-visual-handoff'],
      assertions: [
        'Nodes, edges, brackets, layers, route styles, and colors keep one semantic meaning.',
        'Current, optional, app-owned, and future boundaries cannot be confused.'
      ]
    }),
    Object.freeze({
      id: 'accessible-implementable-motion',
      stepIds: ['select-and-refine-direction', 'annotate-visual-handoff'],
      assertions: [
        'Keyboard focus, contrast, touch targets, long-form reading, and reduced motion are first-class.',
        'Implementation requires no external asset, font, service, dependency, or generated raster at runtime.'
      ]
    }),
    Object.freeze({
      id: 'global-progressive-understanding',
      stepIds: [
        'freeze-visual-brief',
        'select-and-refine-direction',
        'annotate-visual-handoff'
      ],
      assertions: [
        'A non-engineer can understand what Asyra enables before encountering runtime vocabulary.',
        'Plain international English, localization-resilient layout, and progressive technical depth serve a worldwide audience.'
      ]
    })
  ]),
  invariants: Object.freeze([
    Object.freeze({
      id: 'image-is-evidence',
      statement:
        'Generated concept images are inspected design evidence, never product semantics or mandatory production assets.'
    }),
    Object.freeze({
      id: 'one-semantic-visual-language',
      statement:
        'Every downstream surface consumes the same owner, route, transaction, layer, state, and color semantics.'
    }),
    Object.freeze({
      id: 'final-acceptance-only',
      statement:
        'No intermediate manual checkpoint pauses work; the user accepts the integrated experience after the full goal completes.'
    }),
    Object.freeze({
      id: 'revision-two-is-active',
      statement:
        'Cosmic Atlas Revision 2 is the active dark direction for the whole public website, while its generated raster remains design evidence rather than a production asset.'
    })
  ])
})
