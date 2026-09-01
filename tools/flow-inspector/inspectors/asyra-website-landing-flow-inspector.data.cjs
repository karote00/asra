const caseIds = Object.freeze([
  'desktop-editorial-composition',
  'mobile-single-column-reflow',
  'result-first-hero',
  'unlimited-domain-examples',
  'grow-without-rebuild',
  'shared-human-ai-action-path',
  'one-source-across-views',
  'poc-to-product-continuity',
  'canonical-runtime-flow-explainer',
  'connected-site-actions',
  'responsive-transparent-raster-assets',
  'perceptually-sharp-raster-rendering',
  'navigation-only-project-footer',
  'no-client-reduced-motion-reading',
  'machine-readable-discovery',
  'product-first-hero-thesis',
  'asyra-design-product-proof',
  'feature-code-runtime-bridge',
  'change-ownership-map',
  'audience-readiness-paths',
  'domain-owned-closing'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/website-product-and-technical-evidence-plan.md',
    retainedLandingSpecPath:
      'docs/ai/framework/plans/completed/asyra-website-landing-page-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/asyra-website-landing-flow-inspector.data.cjs',
    workspacePath: 'apps/asyra-framework-site',
    visualReferencePath:
      'docs/ai/framework/website/asyra-landing-v04-approved.png'
  }),
  caseIds,
  steps: Object.freeze([
    step({
      id: 'freeze-result-first-contract',
      order: 1,
      ownerPackage: 'Website Landing contract',
      purpose:
        'Freeze the product-first evidence architecture over the retained V04 composition and Cosmic Atlas visual language, while preserving the supplied illustrations and retiring unsupported public claims.',
      inputs: [
        'user-approved V04 Landing reference',
        'product-owner copy and identity corrections',
        'product-owner adaptive grid, alpha-shadow, and asset-specific directional shadow decision',
        'product-owner local-only artwork decision',
        'product-owner PoC-to-product continuity decision',
        'product-owner four-panel recurring-character storyboard decision',
        'product-owner canonical runtime flow explainer decision',
        'product-owner-approved person storyboard preview',
        'product-owner shared horizontal page geometry decision',
        'current Framework product truth',
        'existing Website environment setup'
      ],
      outputs: ['artifact:result-first-contract'],
      conditions: [
        'The approved V04 image is the visual authority for the retained composition; the product-owner-approved V09 closing concept is the explicit closing exception.',
        'Visible Change and Impact Preview contribute no public UI, copy, JavaScript, or selected illustration.',
        'All existing committed and uncommitted website UI, CSS, tests, and assets are replaced while environment setup is retained.',
        'Every public hyperlink resolves to its approved in-page or Website Platform supporting route destination.',
        'Every selected illustration uses the shared adaptive CSS engineering grid plus an asset-specific alpha-derived drop shadow with directional contact and cast vectors, without code-drawing internal diagram topology.',
        'Source artwork, historical design experiments, and unselected derivative history are Git-ignored local-only inputs excluded from default CI; the eighteen selected public derivatives are the committed public derivatives and production deployment assets.',
        'The generated public documentation inventory is published at /llms.txt; supporting human-facing routes remain owned by the Website Platform and do not contribute to this Landing route.',
        'The PoC keeps the same implementation on the product path through explicit engineering review instead of becoming a disposable prototype that must be rebuilt.',
        'The PoC comparison uses eight border-free direct raster crops from the product-owner-approved person storyboard preview, preserving the same recurring domain expert and engineer instead of redrawing the scenes.',
        'A semantic HTML and CSS Framework value comparison follows the PoC story and contrasts repeated product behavior with one Feature used by every product surface.',
        'Header, Hero, domain copy, PoC, proofs, Closing, and Footer share one minimum page width, one 1720px maximum content width, and one responsive inline padding, while every visible Domain Rail row remains full bleed below 1720px and adopts the shared inline padding at and above 1720px.',
        'The footer contains project navigation only and does not repeat year, license, open-source, or company metadata.',
        'The primary thesis is “Build product features, not infrastructure.” while “Build the tool your world needs.” remains a supporting product promise.',
        'Asyra Design is first-class product proof with a real product frame, a concise caption, and a clear path to the live product.',
        'One real Feature code sample and its runtime path explain the same bounded idea from product intent through canonical ownership and projections.',
        'The change ownership map distinguishes App-owned product decisions from Framework-owned infrastructure without implying that every product needs every optional subsystem.',
        'Readiness paths explicitly serve a domain expert, technical evaluator, and product builder without splitting the page into disconnected funnels.',
        'The domain-owned closing returns agency to the reader instead of ending on infrastructure terminology.',
        'Website product evidence owns its crop, density, alt text, size budget, and reading context; it does not automatically reuse README media.'
      ],
      bypasses: [
        'No removed Website implementation may contribute UI, CSS, illustration, route, or copy.'
      ],
      allowedContributors: [
        'Landing plan and Inspector',
        'approved V04 reference',
        'product-owner-approved V09 closing concept',
        'product-owner adaptive grid, alpha-shadow, and asset-specific directional shadow decision',
        'product-owner local-only artwork decision',
        'product-owner PoC-to-product continuity decision',
        'product-owner four-panel recurring-character storyboard decision',
        'product-owner canonical runtime flow explainer decision',
        'product-owner-approved person storyboard preview',
        'product-owner shared horizontal page geometry decision',
        'product-owner corrections including the retired change-impact sections',
        'current Framework product truth'
      ],
      forbiddenContributors: [
        'removed Website implementation',
        'unverified product capability',
        'new dependency',
        'unapproved external production asset'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-website-landing-page-plan.md',
        'docs/ai/framework/plans/website-product-and-technical-evidence-plan.md',
        'tools/flow-inspector/inspectors/asyra-website-landing-flow-inspector.data.cjs',
        'tools/flow-inspector/inspectors/__tests__/asyra-website-landing-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#visual-authority',
        '#product-cases',
        '#content-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'freeze-result-first-contract'
    }),
    step({
      id: 'render-result-first-page',
      order: 2,
      ownerPackage: 'Website Landing page',
      purpose:
        'Render one semantic result-first page with the approved copy, modern system sans typography, six supplied true-alpha Photoroom illustrations, and one adaptive CSS grid-and-shadow stage.',
      inputs: ['artifact:result-first-contract'],
      outputs: ['artifact:result-first-page'],
      conditions: [
        'The hero reports the product outcome before implementation detail.',
        'Any field is shown as an open-ended possibility, not a catalog of built-in apps.',
        'Human and AI intent follow the same governed action path, independent of whether the request came from a person or AI.',
        'A semantic PoC-to-product storyboard pairs eight border-free direct raster crops from the product-owner-approved person storyboard preview with accessible HTML labels.',
        'Two ordered Traditional and Asyra flows align as two four-stage desktop rows; below 960px the complete Traditional sequence precedes the complete Asyra sequence, with the same recurring domain expert and engineer carrying both flows; the implementation must not redraw the approved people or scenes.',
        'At 680px and below, each storyboard panel is scaled against the median rendered proof illustration width and remains within 0.9 to 1.1 times that width so the comic and surrounding proof sections keep one visual scale.',
        'Every storyboard crop contains no authored edge border and is presented inside one uniform 2px CSS frame.',
        'The same bounded Feature continues from domain validation through engineer review, hardening, and product delivery.',
        'The storyboard states that a PoC is not production-ready without engineering review, tests, security, and performance hardening.',
        'The Landing Framework value comparison shows one product request becoming separate maintenance edits across the product screen, AI action, saved work, undo/redo, and synchronized users; Asyra keeps the request inside its owning Feature as one bounded change.',
        'The comparison leads with the bounded change-cost result and does not require readers to understand API, transaction, state-application, canonical-owner, projection, or integration terminology.',
        'The comparison remains readable without connector geometry or color, uses two comparable columns at 1440px and 820px, and reads the complete traditional story before the complete Asyra story at 390px and 320px.',
        'Header, Hero, domain copy, PoC, proofs, Closing, and Footer resolve through one shared horizontal page geometry contract, while the continuous Domain Rail and both split mobile rows touch the viewport edges below 1720px and align with the shared padded content edges at and above 1720px.',
        'Every section preserves the approved title, reference line breaks, exact proof image, and V04 vertical rhythm.',
        'Each active complex visual uses a hash-locked product-owner-supplied Photoroom true-alpha master and three source-bounded lossless responsive WebP derivatives.',
        'Every selected derivative contains both transparent and opaque pixels, never exceeds its native master width, and preserves the supplied subject pixels through premultiplied-alpha resizing.',
        'The 2400px Domain Rail master is never artificially enlarged and may use a minimum 1.1 source pixels per rendered CSS pixel at the widest review size; the other illustrations remain at least 2x at their supported review sizes.',
        'Every illustration container uses the same CSS stage contract: clamp-scaled minor and major grid lines, intersection nodes, a stage-aware fade mask, and alpha-derived drop-shadow depth.',
        'Contact and cast shadows follow a per-illustration lower-right perspective vector matched to the supplied top-left lighting and apparent elevation; dark stages add a restrained blue ambient reflection without recoloring source pixels.',
        'The CSS grid and drop shadow are decoration only and never recreate, replace, or modify internal diagram topology, labels, connectors, or signal colors.',
        'The closing-grid-v07-desktop raster and all prior V04 through V12 raster sources remain preserved but are never selected.',
        'V09 through V14 Grow experiments remain preserved but unselected.',
        'Every desktop and mobile complex visual passes the edge-contrast sharpness oracle after fresh high-resolution rendering.',
        'Every supplied master preserves its object count, topology, connector, signal color, and label intent; CSS owns only the shared background grid and alpha-derived shadow.',
        'Exact labels and simple domain icons are deterministically raster-composited into one authored continuous domain rail after generation so model text cannot drift.',
        'The domain rail preserves reference card proportions, both edge assemblies, continuous tracks, exact in-card labels, and reference bottom clearance without repeating a crop that already contains rail or background pixels.',
        'Rejected V07 desktop experiment assets, closing-core-v07, closing-core-v08, and closing-core-v12 remain preserved but are never selected.',
        'The rejected V08 Grow remains preserved but is never selected; the retired Visible Change assets also remain preserved but are never selected.',
        'Rejected V09 Grow remains preserved but is never selected because it flattened the approved asymmetric layers into one smooth trough.',
        'Rejected V10 Grow remains preserved but is never selected because its procedurally redrawn material frequency does not match the adjacent V06 modules.',
        'V11 through V14 Grow restoration and single-pipe experiments remain preserved but are never selected.',
        'The supplied Hero preserves raised blue fasteners; the supplied Domain Rail preserves exact ten domain icons and labels; the supplied One Source preserves top-inset labels and relief depth.',
        'The supplied transparent closing master preserves a centered protected domain core, one continuous blue infrastructure loop, four symmetric directional bridges, and a complete gunmetal frame; the shared CSS stage supplies the surrounding engineering grid.',
        'No unreviewed generative topology drift, relabeling, recoloring, or substitute visual may contribute.',
        'Display and body typography use a modern system sans stack with no legacy display serif or external font dependency.',
        'Display headings use weight 500 or below with line height at least 1.0, and multiline proof and closing headings use at least 1.04.',
        'CTA hover and focus are brighter than the default red.',
        'The same complete narrative remains in DOM order at desktop, mobile, and without JavaScript.',
        'The Hero leads with “Build product features, not infrastructure.” and keeps “Build the tool your world needs.” in a supporting role.',
        'A landing-owned derivative of the canonical 7,076-element Asyra Design frame provides authentic current product evidence with a reproducible hash-locked export.',
        'The maintained public review-actions Feature excerpt is paired with one person-or-AI to Feature, transaction, canonical-owner, and projection path.',
        'Framework, Preset, App, and external-service responsibilities are presented as distinct ownership layers.',
        'Readiness actions distinguish product builders, Framework composers, and technical evaluators while current support remains separate from roadmap direction.'
      ],
      bypasses: [
        'If an image does not load, semantic headings and descriptive alt text preserve the complete reading.',
        'If visual connectors are unavailable, the storyboard ordered lists preserve the complete PoC-to-product sequence.'
      ],
      allowedContributors: [
        'artifact:result-first-contract',
        'approved V04 composition and topology',
        'immutable product-owner-supplied Photoroom true-alpha masters',
        'supplied closing concept preserved through three transparent responsive widths',
        'preserved rejected V07 desktop raster refinements',
        'reviewed V08 desktop raster corrections',
        'preserved rejected V09 through V14 Grow experiments',
        'preserved in-image labels and simple domain icons',
        'semantic React server components',
        'project-owned source-bounded lossless true-alpha responsive assets',
        'modern system sans typography',
        'generated public documentation inventory',
        'semantic HTML and CSS PoC-to-product storyboard',
        'semantic HTML and CSS Framework value comparison',
        'eight border-free direct raster crops from the product-owner-approved person storyboard preview',
        'CSS responsive layout',
        'shared adaptive CSS grid and asset-specific alpha-derived directional drop shadows'
      ],
      forbiddenContributors: [
        'removed Website implementation',
        'active V04 or V05 crop pixels',
        'active V09 through V14 Grow experiments',
        'simple V04 pixel enlargement',
        'newly drawn active Grow material or geometry',
        'repeated card crops that contain rail or background pixels',
        'unreviewed generative topology drift',
        'invented or merged Grow connector geometry',
        'code-drawn SVG substitutes for the six supplied mechanical illustrations',
        'CSS-drawn internal topology for the six supplied mechanical illustrations',
        'raster section-background grid plates',
        'canvas or WebGL',
        'icon-library diagram substitutes',
        'redrawn storyboard people or scenes',
        'claim that a PoC is production-ready without engineering review',
        'Framework runtime package import'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/app/styles/tokens.css',
        'apps/asyra-framework-site/components/framework-value-story.tsx',
        'apps/asyra-framework-site/app/layout.tsx',
        'apps/asyra-framework-site/app/error.tsx',
        'apps/asyra-framework-site/app/not-found.tsx',
        'apps/asyra-framework-site/app/robots.ts',
        'apps/asyra-framework-site/app/sitemap.ts',
        'apps/asyra-framework-site/artwork/v06',
        'apps/asyra-framework-site/artwork/v07',
        'apps/asyra-framework-site/artwork/v08',
        'apps/asyra-framework-site/artwork/v09',
        'apps/asyra-framework-site/artwork/v07-desktop',
        'apps/asyra-framework-site/artwork/v08-desktop',
        'apps/asyra-framework-site/artwork/v09-desktop',
        'apps/asyra-framework-site/artwork/v10-desktop',
        'apps/asyra-framework-site/artwork/v11-desktop',
        'apps/asyra-framework-site/artwork/v12-desktop',
        'apps/asyra-framework-site/artwork/v13-desktop',
        'apps/asyra-framework-site/artwork/v14-desktop',
        'apps/asyra-framework-site/artwork/v12-transparent',
        'apps/asyra-framework-site/artwork/photoroom',
        'apps/asyra-framework-site/public/illustrations',
        'apps/asyra-framework-site/public/product-evidence',
        'apps/asyra-framework-site/public/llms.txt',
        'docs/public/llms.txt',
        'scripts/docs/public-documentation.mjs',
        'apps/asyra-framework-site/scripts/build-v06-assets.py',
        'apps/asyra-framework-site/scripts/build-closing-v07-superres.py',
        'apps/asyra-framework-site/scripts/build-closing-v08-geometric.py',
        'apps/asyra-framework-site/scripts/build-closing-v09-concept.py',
        'apps/asyra-framework-site/scripts/build-v07-desktop-assets.py',
        'apps/asyra-framework-site/scripts/build-v08-desktop-assets.py',
        'apps/asyra-framework-site/scripts/build-v09-grow-desktop.py',
        'apps/asyra-framework-site/scripts/build-v10-grow-desktop.py',
        'apps/asyra-framework-site/scripts/build-v11-grow-desktop.py',
        'apps/asyra-framework-site/scripts/build-v12-grow-connector-preview.py',
        'apps/asyra-framework-site/scripts/build-v13-grow-connector-preview.py',
        'apps/asyra-framework-site/scripts/build-v14-grow-connector-preview.py',
        'apps/asyra-framework-site/scripts/build-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/verify-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/build-photoroom-assets.py',
        'apps/asyra-framework-site/scripts/build-poc-storyboard-crops.py',
        'apps/asyra-framework-site/scripts/build-product-evidence.py'
      ],
      specRefs: [
        '#visual-authority',
        '#content-contract',
        '#ownership-boundary'
      ],
      failureOwnerStepId: 'render-result-first-page'
    }),
    step({
      id: 'verify-result-first-page',
      order: 3,
      ownerPackage: 'Website Landing verification',
      purpose:
        'Fail closed on structural drift, stale content, opaque assets, broken links, overflow, visual divergence, or build failure.',
      inputs: ['artifact:result-first-page'],
      outputs: ['artifact:verified-result-first-page'],
      conditions: [
        'Inspector, semantic regression, typecheck, lint, production build, and route smoke pass.',
        'Synchronized full-page and section-level 1440px, 864px, 820px, 390px, and 320px production screenshots are inspected.',
        'Desktop and mobile edge-contrast sharpness oracles and computed display typography constraints pass.',
        'Default, hover, and focus CTA states are captured and inspected.',
        'Default CI validates committed public derivatives without local artwork and never requires the Git-ignored artwork directory.',
        'When artwork is available on an authoring workstation, ASYRA_LOCAL_ARTWORK_TESTS=1 verifies immutable-master hashes and local build-source contracts before changed derivatives are accepted.',
        'Every selected derivative must pass true-alpha, source-bounded width, checkerboard, and actual-section-background verification before deployment.',
        'The adaptive CSS grid and alpha-derived drop shadow are asserted from computed styles and inspected at 2048px, 1440px, 864px, 820px, 390px, and 320px.',
        'Six distinct computed shadow vectors are asserted at 2048px, 1440px, 864px, 820px, 390px, and 320px; section crops confirm the contact, cast, and dark-stage ambient layers remain visible without clipping.',
        'The supplied Hero, Domain Rail, Grow, Same Path, One Source, and Closing derivatives are inspected at 1440px and 2048px with section crops before deployment.',
        'The PoC-to-product storyboard is inspected at 1440px, 820px, 390px, and 320px for path continuity, readable role labels, balanced density, and natural DOM order; at every width below 960px all four Traditional stages precede all four Asyra stages.',
        'The Landing Framework value comparison is inspected at 1440px, 820px, 390px, and 320px for immediate define-once comprehension, directly comparable desktop and tablet columns, complete small-screen story order, readable type, and freedom from horizontal overflow.',
        'At 680px, 520px, 390px, and 320px, computed geometry proves each storyboard panel is scaled against the median rendered proof illustration width and remains within 0.9 to 1.1 times that width.',
        'Computed geometry proves one 1720px maximum content width and the same constrained content edges for Header, Hero, domain copy, PoC, proofs, Closing, and Footer at 3840px, 2560px, 1920px, 1720px, 1719px, 1440px, 864px, 820px, 800px, 680px, 520px, 390px, and 320px, while every visible Domain Rail row remains full bleed below 1720px and aligns with the shared padded content edges at and above 1720px.',
        'All eight border-free storyboard crops are inspected inside one uniform 2px CSS frame contract without doubled authored edges.',
        'No-client and reduced-motion modes preserve the complete reading and actions.',
        'The retired change-impact sections remain absent at every breakpoint and without JavaScript.',
        'The public /llms.txt response exactly matches the generated public documentation inventory while supporting human-facing routes remain independently owned by the Website Platform.'
      ],
      bypasses: [
        'Production deployment occurs only after every Landing gate passes.'
      ],
      allowedContributors: [
        'formal tests',
        'production build',
        'same-state production screenshots',
        'manual visual comparison after formal oracles'
      ],
      forbiddenContributors: [
        'development-server-only evidence',
        'one overview screenshot as sole evidence',
        'claiming visual completion without inspecting output'
      ],
      implementationBoundary: [
        '.gitignore',
        'apps/asyra-framework-site/package.json',
        'apps/asyra-framework-site/__tests__/editorial-landing.test.mjs',
        'apps/asyra-framework-site/__tests__/e2e/editorial-landing-visual.spec.ts',
        'apps/asyra-framework-site/scripts/route-smoke.mjs',
        'apps/asyra-framework-site/scripts/production-smoke.mjs',
        'apps/asyra-framework-site/public/llms.txt',
        'docs/public/llms.txt',
        'apps/asyra-framework-site/scripts/build-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/verify-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/build-photoroom-assets.py',
        'apps/asyra-framework-site/scripts/build-poc-storyboard-crops.py'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-result-first-page'
    })
  ]),
  artifacts: Object.freeze([
    Object.freeze({
      id: 'artifact:result-first-contract',
      ownerStepId: 'freeze-result-first-contract'
    }),
    Object.freeze({
      id: 'artifact:result-first-page',
      ownerStepId: 'render-result-first-page'
    }),
    Object.freeze({
      id: 'artifact:verified-result-first-page',
      ownerStepId: 'verify-result-first-page'
    })
  ]),
  routes: Object.freeze([
    Object.freeze({
      id: 'contract-to-page',
      from: 'freeze-result-first-contract',
      to: 'render-result-first-page',
      producedArtifacts: ['artifact:result-first-contract']
    }),
    Object.freeze({
      id: 'page-to-verification',
      from: 'render-result-first-page',
      to: 'verify-result-first-page',
      producedArtifacts: ['artifact:result-first-page']
    })
  ]),
  invariants: Object.freeze([
    'Any field may define the product while Asyra never decides its domain.',
    'Human and AI intent follow the same governed action path.',
    'A PoC keeps the same implementation on the product path through engineering review and hardening.',
    'New product intent and existing-state application remain distinct routes that settle through the same canonical owners before projections update.',
    'Every constrained Landing section shares one horizontal page geometry contract while the Domain Rail remains full bleed below 1720px and adopts the shared inline padding at and above 1720px.',
    'Complex diagrams use the six immutable supplied Photoroom true-alpha masters with one shared CSS grid-and-shadow stage, while prior and rejected experiments remain preserved but unselected.',
    'The footer contains project navigation only and makes no year, license, open-source, or company identity claim.',
    'All links remain keyboard-focusable and resolve to in-page or Website Platform destinations.',
    'Visible Change and Impact Preview remain absent from the public narrative.',
    'Production deployment occurs only after every Landing gate passes.'
  ])
})
