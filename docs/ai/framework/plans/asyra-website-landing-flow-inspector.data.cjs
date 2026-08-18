const caseIds = Object.freeze([
  'desktop-editorial-composition',
  'mobile-single-column-reflow',
  'result-first-hero',
  'unlimited-domain-examples',
  'grow-without-rebuild',
  'shared-human-ai-action-path',
  'one-source-across-views',
  'clickable-placeholder-actions',
  'responsive-transparent-raster-assets',
  'perceptually-sharp-raster-rendering',
  'open-source-2026-footer',
  'no-client-reduced-motion-reading'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath: 'docs/ai/framework/plans/asyra-website-landing-page-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
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
        'Freeze V04 as the authority for the retained composition, accept the six supplied transparent Photoroom illustrations with one adaptive CSS grid-and-shadow stage, and retire Visible Change and Impact Preview from the public narrative.',
      inputs: [
        'user-approved V04 Landing reference',
        'product-owner copy and identity corrections',
        'product-owner adaptive grid, alpha-shadow, and asset-specific directional shadow decision',
        'product-owner local-only artwork decision',
        'current Framework product truth',
        'existing Website environment setup'
      ],
      outputs: ['artifact:result-first-contract'],
      conditions: [
        'The approved V04 image is the visual authority for the retained composition; the product-owner-approved V09 closing concept is the explicit closing exception.',
        'Visible Change and Impact Preview contribute no public UI, copy, JavaScript, or selected illustration.',
        'All existing committed and uncommitted website UI, CSS, tests, and assets are replaced while environment setup is retained.',
        'Every public hyperlink remains clickable even when its destination is a placeholder.',
        'Every selected illustration uses the shared adaptive CSS engineering grid plus an asset-specific alpha-derived drop shadow with directional contact and cast vectors, without code-drawing internal diagram topology.',
        'Source artwork, historical design experiments, and unselected derivative history are Git-ignored local-only inputs excluded from default CI; the eighteen selected public derivatives are the committed public derivatives and production deployment assets.',
        'The footer identifies 2026 open source work and contains no company identity.'
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
        'product-owner corrections including the retired change-impact sections',
        'current Framework product truth'
      ],
      forbiddenContributors: [
        'removed Website implementation',
        'unverified product capability',
        'new dependency',
        'external production asset'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/asyra-website-landing-page-plan.md',
        'docs/ai/framework/plans/asyra-website-landing-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-landing-flow-inspector.contract.test.cjs'
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
        'People and AI use the same action path for a feature built once.',
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
        'The same complete narrative remains in DOM order at desktop, mobile, and without JavaScript.'
      ],
      bypasses: [
        'If an image does not load, semantic headings and descriptive alt text preserve the complete reading.'
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
        'code-drawn SVG complex diagrams',
        'CSS-drawn internal diagram topology',
        'raster section-background grid plates',
        'canvas or WebGL',
        'icon-library diagram substitutes',
        'Framework runtime package import'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/globals.css',
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
        'apps/asyra-framework-site/scripts/build-photoroom-assets.py'
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
        'No-client and reduced-motion modes preserve the complete reading and actions.',
        'The retired change-impact sections remain absent at every breakpoint and without JavaScript.'
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
        'apps/asyra-framework-site/scripts/build-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/verify-transparent-v12-assets.py',
        'apps/asyra-framework-site/scripts/build-photoroom-assets.py'
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
    'A feature built once gives people and AI the same action path.',
    'Complex diagrams use the six immutable supplied Photoroom true-alpha masters with one shared CSS grid-and-shadow stage, while prior and rejected experiments remain preserved but unselected.',
    'The footer says 2026 open source and makes no company identity claim.',
    'All links remain keyboard-focusable and clickable while placeholder destinations are allowed.',
    'Visible Change and Impact Preview remain absent from the public narrative.',
    'Production deployment occurs only after every Landing gate passes.'
  ])
})
