const caseIds = Object.freeze([
  'global-desktop-first-layer',
  'global-mobile-first-layer',
  'working-product-entry',
  'framework-learning-entry',
  'custom-product-entry',
  'deterministic-path',
  'ownership-explorer',
  'optional-composition',
  'app-domain-possibilities',
  'future-machine-facing-roadmap',
  'asyra-design-reference',
  'release-policy-evidence',
  'reduced-motion-equivalence',
  'no-client-basic-narrative'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/asyra-website-landing-page-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
    platformInspectorPath:
      'docs/ai/framework/plans/asyra-website-platform-flow-inspector.data.cjs',
    contentManifestPath: 'docs/public/content-manifest.json',
    contentIndexPath: 'docs/public/generated/content-index.json',
    packageReferencePath: 'docs/public/generated/package-reference.json',
    visualHandoffPath:
      'docs/ai/framework/website/visual-reimagine/handoff.md',
    workspacePath: 'apps/asyra-framework-site'
  }),
  verifiedFacts: Object.freeze({
    designApp: Object.freeze({
      href: 'https://asra.vercel.app/?fileId=asyra-framework-demo',
      title: 'Asyra Design',
      verifiedAt: '2026-08-11',
      evidence:
        'The stable public alias returned Asyra Design for the explicit asyra-framework-demo document identity.'
    })
  }),
  caseIds,
  steps: Object.freeze([
    step({
      id: 'freeze-landing-contract',
      order: 1,
      ownerPackage: 'Website Landing contract',
      purpose:
        'Freeze the global-audience narrative, exact product cases, accepted evidence, verified external fact, owner boundaries, and Landing gates before UI implementation.',
      inputs: [
        'artifact:verified-platform',
        'accepted public-content handoff',
        'accepted Cosmic Atlas Revision 2 visual handoff',
        'verified public Asyra Design alias'
      ],
      outputs: ['artifact:landing-contract'],
      conditions: [
        'The first layer explains outcome, creator ownership, and predictable action in plain international English before Framework mechanics.',
        'The fourteen product cases are exact and cover desktop, mobile, entry paths, ownership, current/future boundaries, evidence, reduced motion, and no-client reading.',
        'Every release, support, URL, and product-capability claim resolves to accepted content, generated facts, or recorded external verification.'
      ],
      bypasses: ['No Landing code may bypass contract readiness.'],
      allowedContributors: [
        'Landing plan and Inspector',
        'artifact:verified-platform',
        'accepted public content and visual handoffs',
        'recorded public deployment evidence'
      ],
      forbiddenContributors: [
        'unverified URL or hand-written package version',
        'Framework capability inferred from a possible app domain',
        'Runtime Atlas output or duplicated executable case',
        'unapproved dependency, hosted service, or generated raster asset'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/asyra-website-landing-page-plan.md',
        'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-landing-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#bounded-task-contract',
        '#verified-external-fact',
        '#executable-product-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-landing-contract'
    }),
    step({
      id: 'present-global-narrative',
      order: 2,
      ownerPackage: 'Website Landing global narrative',
      purpose:
        'Present the outcome-led hero, creator-owned domain panorama, Describe-Act-Verify story, app-owned possibilities, and explicit future boundary as semantic code-native content.',
      inputs: [
        'artifact:landing-contract',
        'artifact:verified-platform',
        'accepted public information-model and runtime-boundary content'
      ],
      outputs: ['artifact:global-landing-narrative'],
      conditions: [
        'The H1 and lead are understandable without package or API knowledge.',
        'Desktop and mobile retain the same narrative and beginner actions in logical DOM order.',
        'Design, whiteboard, BIM, VR, industrial simulation, and knowledge products are labelled App-owned possibilities rather than built-ins.',
        'Machine-facing information products are visibly Roadmap and never current Headless/Core Kernel support.',
        'The panorama uses HTML, CSS, and SVG only and has an equivalent structured text explanation.'
      ],
      bypasses: [
        'Decorative line reveal may be absent; the complete narrative and semantic marks remain visible.'
      ],
      allowedContributors: [
        'artifact:landing-contract',
        'artifact:verified-platform',
        'accepted public content and Cosmic Atlas Revision 2 semantics',
        'repository-owned semantic HTML, CSS, and SVG'
      ],
      forbiddenContributors: [
        'generated raster or external media',
        'canvas, WebGL, autoplay loop, parallax, or scroll hijacking',
        'technical density before the first plain-language promise and beginner actions',
        'domain possibility presented as a package or turnkey feature'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/app/styles/landing.css',
        'apps/asyra-framework-site/components/landing-hero.tsx',
        'apps/asyra-framework-site/components/landing-possibility-field.tsx',
        'apps/asyra-framework-site/components/landing-story.tsx',
        'apps/asyra-framework-site/__tests__/landing-narrative.test.mjs'
      ],
      specRefs: [
        '#required-narrative',
        '#content-accuracy-contract',
        '#interaction-and-motion-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'present-global-narrative'
    }),
    step({
      id: 'explain-ownership-composition',
      order: 3,
      ownerPackage: 'Website Landing ownership explanation',
      purpose:
        'Explain Framework, Preset, App, optional composition, replaceable edges, and the deterministic intent-to-outcome route without simulating Runtime Atlas execution.',
      inputs: [
        'artifact:landing-contract',
        'artifact:global-landing-narrative',
        'accepted ownership, transaction, projection, and Preset contracts'
      ],
      outputs: ['artifact:landing-ownership-experience'],
      conditions: [
        'Framework, Preset, and App ownership remains visible before any interactive detail selection.',
        'The explorer is keyboard, touch, focus, and screen-reader operable with one selected owner at a time.',
        'The technical route is Intent to Feature to API to Factory transaction to canonical owners to projection to accepted result.',
        'Preset and Provider are optional dashed composition; projection is a consumer rather than a canonical owner.',
        'The Atlas entry states that executable proof belongs to Runtime Atlas and never fabricates a run result.'
      ],
      bypasses: [
        'Without client JavaScript, the static ownership summary and complete technical route remain readable.',
        'Reduced motion replaces route reveal with the same immediate semantic state.'
      ],
      allowedContributors: [
        'artifact:landing-contract',
        'artifact:global-landing-narrative',
        'accepted public ownership and transaction content',
        'bounded browser state for owner-detail selection only'
      ],
      forbiddenContributors: [
        'Framework package runtime imported into Landing',
        'fake transaction result, event ledger, timing, or canonical evidence',
        'Preset or Provider shown as mandatory',
        'React state presented as canonical product state'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/app/styles/landing.css',
        'apps/asyra-framework-site/components/landing-ownership-explorer.tsx',
        'apps/asyra-framework-site/components/landing-topology.tsx',
        'apps/asyra-framework-site/__tests__/landing-ownership.test.mjs'
      ],
      specRefs: [
        '#required-narrative',
        '#interaction-and-motion-contract',
        '#content-accuracy-contract',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'explain-ownership-composition'
    }),
    step({
      id: 'connect-entry-evidence',
      order: 4,
      ownerPackage: 'Website Landing entries and evidence',
      purpose:
        'Connect the three starting paths, Runtime Atlas entry, verified Asyra Design reference, generated release facts, repository, security, license, release, and contribution-policy evidence.',
      inputs: [
        'artifact:landing-contract',
        'artifact:global-landing-narrative',
        'artifact:landing-ownership-experience',
        'artifact:verified-site-content',
        'verified public Asyra Design alias'
      ],
      outputs: ['artifact:complete-landing'],
      conditions: [
        'create-asyra-design-app is the working-product beginner path.',
        'Documentation and Runtime Atlas are Framework-learning paths and custom composition remains a distinct experienced path.',
        'Candidate family and package count derive from the content bundle and publication is never implied.',
        'Asyra Design is labelled a reference product, links only to the verified public alias with one non-empty fileId, and never becomes Framework authority.',
        'Documentation, repository, security, license, release, roadmap, and contribution-policy destinations are present and exact.'
      ],
      bypasses: [
        'If the public App alias is no longer anonymously available, the Landing build fails its link contract instead of substituting a Preview URL.'
      ],
      allowedContributors: [
        'artifact:verified-site-content',
        'project-owned repository and policy files',
        'recorded verified public link facts',
        'ordinary internal and external links'
      ],
      forbiddenContributors: [
        'protected deployment URL',
        'unpublished package version or registry claim',
        'public issues or contribution invitation',
        'Asyra Design product behavior copied into the Framework narrative'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/app/styles/landing.css',
        'apps/asyra-framework-site/components/landing-entry-evidence.tsx',
        'apps/asyra-framework-site/lib/landing-facts.mjs',
        'apps/asyra-framework-site/lib/landing-facts.d.ts',
        'apps/asyra-framework-site/__tests__/landing-entry.test.mjs'
      ],
      specRefs: [
        '#verified-external-fact',
        '#required-narrative',
        '#content-accuracy-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'connect-entry-evidence'
    }),
    step({
      id: 'verify-landing',
      order: 5,
      ownerPackage: 'Website Landing verification',
      purpose:
        'Fail closed on narrative drift, missing entry/evidence, inaccessible interaction, responsive or reduced-motion failure, visual divergence, link error, performance regression, or production-build failure.',
      inputs: [
        'artifact:global-landing-narrative',
        'artifact:landing-ownership-experience',
        'artifact:complete-landing'
      ],
      outputs: ['artifact:verified-landing'],
      conditions: [
        'Inspector, semantic tests, strict typecheck, lint, dependency checks, production build, route smoke, and root integration gates pass.',
        'Desktop, 390px, 320px, keyboard, touch, 200 percent zoom, reduced-motion, no-overflow, and synchronized live visual cases pass.',
        'The fourteen exact product cases remain evidence-backed and no current/future or Framework/App boundary drifts.'
      ],
      bypasses: [
        'Production deployment remains owned by Launch and Operations.',
        'Runtime Atlas execution remains owned by the Atlas child.'
      ],
      allowedContributors: [
        'deterministic project-owned tests',
        'production build and route artifacts',
        'synchronized browser evidence',
        'bounded public-link verification'
      ],
      forbiddenContributors: [
        'manual inspection as sole evidence',
        'deployment success used as product correctness proof',
        'missing-case allowlist',
        'fake Atlas evidence'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/**',
        'docs/ai/framework/plans/asyra-website-landing-page-plan.md',
        'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-landing-flow-inspector.contract.test.cjs'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-landing'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:landing-contract', 'freeze-landing-contract'],
      ['artifact:global-landing-narrative', 'present-global-narrative'],
      ['artifact:landing-ownership-experience', 'explain-ownership-composition'],
      ['artifact:complete-landing', 'connect-entry-evidence'],
      ['artifact:verified-landing', 'verify-landing']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      ['freeze-landing-contract', 'present-global-narrative', 'artifact:landing-contract'],
      ['present-global-narrative', 'explain-ownership-composition', 'artifact:global-landing-narrative'],
      ['freeze-landing-contract', 'connect-entry-evidence', 'artifact:landing-contract'],
      ['present-global-narrative', 'connect-entry-evidence', 'artifact:global-landing-narrative'],
      ['explain-ownership-composition', 'connect-entry-evidence', 'artifact:landing-ownership-experience'],
      ['present-global-narrative', 'verify-landing', 'artifact:global-landing-narrative'],
      ['explain-ownership-composition', 'verify-landing', 'artifact:landing-ownership-experience'],
      ['connect-entry-evidence', 'verify-landing', 'artifact:complete-landing']
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `landing-route-${String(index + 1).padStart(2, '0')}`,
        from,
        to,
        producedArtifacts: Object.freeze([artifactId])
      })
    )
  ),
  invariants: Object.freeze([
    'A worldwide non-engineer understands possibility, creator ownership, and predictable action before technical depth.',
    'create-asyra-design-app, Framework learning, and custom composition remain complementary entry paths.',
    'Possible app domains never become built-in Framework claims.',
    'Future machine-facing products remain Roadmap until a public Headless/Core Kernel contract exists.',
    'Landing never executes or fabricates Runtime Atlas evidence.',
    'Generated visual boards remain evidence and never production assets.',
    'No production deployment occurs in the Landing child.'
  ])
})
