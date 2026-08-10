const routeIds = Object.freeze([
  'docs',
  'asyra-design',
  'releases',
  'roadmap',
  'landing-foundation',
  'atlas-foundation',
  'not-found',
  'content-failure',
  'unsupported-browser'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/asyra-website-platform-and-docs-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-website-platform-flow-inspector.data.cjs',
    contentManifestPath: 'docs/public/content-manifest.json',
    contentIndexPath: 'docs/public/generated/content-index.json',
    sourceMapPath: 'docs/public/generated/source-map.json',
    packageReferencePath: 'docs/public/generated/package-reference.json',
    visualHandoffPath:
      'docs/ai/framework/website/visual-reimagine/handoff.md',
    workspacePath: 'apps/asyra-framework-site'
  }),
  toolchain: Object.freeze({
    next: '16.3.0',
    react: '19.1.0',
    reactDom: '19.1.0',
    tailwindcss: '4.3.3',
    tailwindPostcss: '4.3.3',
    lucideReact: '1.31.0',
    typescript: '5.8.3',
    node: '24.x',
    yarn: '4.3.1'
  }),
  routeIds,
  steps: Object.freeze([
    step({
      id: 'freeze-platform-contract',
      order: 1,
      ownerPackage: 'Website Platform contract',
      purpose:
        'Freeze exact toolchain, workspace ownership, source authorities, route cases, shared boundaries, and deterministic gates before workspace implementation.',
      inputs: [
        'accepted public-content handoff',
        'accepted Material Blueprint / Instrument Sheet Revision 2 visual handoff',
        'repository Node, Yarn, React, TypeScript, workspace, and CI contracts'
      ],
      outputs: ['artifact:platform-contract'],
      conditions: [
        'The exact approved toolchain is compatible with the repository runtime without upgrading existing tools.',
        'All required routes and failure states are exact and unique.',
        'The platform may present but never rewrite canonical content, examples, package facts, Landing narrative, or Atlas runtime meaning.'
      ],
      bypasses: ['No workspace code may bypass platform readiness.'],
      allowedContributors: [
        'Website Platform plan',
        'accepted content, example, and visual handoffs',
        'project-owned manifests and workspace configuration'
      ],
      forbiddenContributors: [
        'unapproved dependency or hosted service',
        'hand-written release facts',
        'unverified public URL',
        'Landing or Atlas product implementation'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/asyra-website-platform-and-docs-plan.md',
        'docs/ai/framework/plans/asyra-website-platform-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-platform-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#technology-contract',
        '#required-routes',
        '#ownership-boundary',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-platform-contract'
    }),
    step({
      id: 'establish-site-foundation',
      order: 2,
      ownerPackage: '@asyra/asyra-framework-site foundation',
      purpose:
        'Create the strict Next.js workspace, metadata, Instrument Sheet Revision 2 tokens, semantic shell, and accessible navigation foundations.',
      inputs: ['artifact:platform-contract'],
      outputs: ['artifact:site-foundation'],
      conditions: [
        'The workspace participates in root build, lint, dependency, Turbo, and test contracts.',
        'The shell is server-first, keyboard ordered, localization resilient, reduced-motion safe, and usable without generated raster assets.',
        'Landing and Atlas receive placeholders and stable shared anatomy only, not their product-owned implementation.'
      ],
      bypasses: [
        'Client components are allowed only for browser interaction or browser APIs.'
      ],
      allowedContributors: [
        'artifact:platform-contract',
        'accepted visual handoff',
        'existing repository workspace conventions'
      ],
      forbiddenContributors: [
        'generated raster production assets',
        'external font, UI kit, analytics, or CMS',
        'Framework package-private source'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/package.json',
        'apps/asyra-framework-site/next.config.ts',
        'apps/asyra-framework-site/postcss.config.mjs',
        'apps/asyra-framework-site/tsconfig.json',
        'apps/asyra-framework-site/app/layout.tsx',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/app/page.tsx',
        'apps/asyra-framework-site/app/atlas/page.tsx',
        'apps/asyra-framework-site/components/site-*.tsx',
        'apps/asyra-framework-site/components/icons.tsx',
        'apps/asyra-framework-site/__tests__/foundation.test.mjs',
        'package.json',
        'yarn.lock',
        'turbo.json',
        'eslint.config.js',
        '.gitignore'
      ],
      specRefs: [
        '#technology-contract',
        '#shared-platform-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'establish-site-foundation'
    }),
    step({
      id: 'load-public-content',
      order: 3,
      ownerPackage: 'Website public-content adapter',
      purpose:
        'Load the accepted content, source map, and package reference with deterministic identity, digest, route, and drift validation.',
      inputs: [
        'artifact:platform-contract',
        'artifact:site-foundation',
        'docs/public content bundle'
      ],
      outputs: ['artifact:verified-site-content'],
      conditions: [
        'All forty-one public pages resolve exactly once with stable ids, routes, headings, and digests.',
        'Release and package facts derive from generated project-owned inputs and remain visibly provisional.',
        'Links to internal canonical sources are presented as source evidence rather than rewritten as public website routes.'
      ],
      bypasses: [
        'Content failure renders an explicit unavailable state and never fabricates fallback product copy.'
      ],
      allowedContributors: [
        'project-owned public content manifest and generated indexes',
        'cryptographic source and page digests'
      ],
      forbiddenContributors: [
        'ad hoc network fetch',
        'duplicated package version constant',
        'semantic rewrite by the presentation adapter'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/lib/content.mjs',
        'apps/asyra-framework-site/lib/content.d.ts',
        'apps/asyra-framework-site/lib/markdown.mjs',
        'apps/asyra-framework-site/lib/markdown.d.ts',
        'apps/asyra-framework-site/__tests__/content.test.mjs',
        'apps/asyra-framework-site/__tests__/markdown.test.mjs'
      ],
      specRefs: [
        '#documentation-experience',
        '#shared-platform-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'load-public-content'
    }),
    step({
      id: 'present-documentation',
      order: 4,
      ownerPackage: 'Website documentation experience',
      purpose:
        'Present all accepted documentation with stable anchors, three-region desktop reading, mobile navigation, local search, source evidence, and copy-as-Markdown.',
      inputs: [
        'artifact:site-foundation',
        'artifact:verified-site-content'
      ],
      outputs: ['artifact:documentation-experience'],
      conditions: [
        'The docs route renders without client JavaScript for basic reading.',
        'Search records map to stable page and heading ids.',
        'Mobile navigation is modal, focus-contained, Escape-closeable, and returns focus.',
        'Copy-as-Markdown uses the accepted page bytes and canonical source links.'
      ],
      bypasses: [
        'Interactive search and copy controls may enhance a complete server-rendered document.'
      ],
      allowedContributors: [
        'artifact:site-foundation',
        'artifact:verified-site-content',
        'local browser APIs for search and copy interaction'
      ],
      forbiddenContributors: [
        'hosted search',
        'client-only documentation body',
        'generated HTML injection',
        'hidden or unstable headings'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/docs/**',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/components/docs-*.tsx',
        'apps/asyra-framework-site/components/markdown-*.tsx',
        'apps/asyra-framework-site/components/search-*.tsx',
        'apps/asyra-framework-site/components/copy-markdown-button.tsx',
        'apps/asyra-framework-site/__tests__/docs.test.mjs'
      ],
      specRefs: [
        '#required-routes',
        '#documentation-experience',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'present-documentation'
    }),
    step({
      id: 'present-supporting-routes',
      order: 5,
      ownerPackage: 'Website supporting public routes',
      purpose:
        'Present Asyra Design, Releases, and Roadmap from accepted content and generated facts with exact current, App-owned, candidate, and roadmap boundaries.',
      inputs: [
        'artifact:site-foundation',
        'artifact:verified-site-content',
        'artifact:documentation-experience'
      ],
      outputs: ['artifact:supporting-routes'],
      conditions: [
        'Asyra Design remains a reference product rather than the Framework owner.',
        'Every external Asyra Design product entry uses the verified public alias with one non-empty fileId.',
        'Release inventory is manifest-derived and visibly provisional.',
        'Future non-visible runtime remains Roadmap and is not presented as a current Headless API.'
      ],
      bypasses: [
        'No canonical Asyra Design deployment URL is rendered until externally verified.'
      ],
      allowedContributors: [
        'artifact:verified-site-content',
        'accepted Asyra Design case study',
        'generated package inventory'
      ],
      forbiddenContributors: [
        'invented release notes, version, date, or support claim',
        'unverified app URL',
        'future capability presented as current'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/asyra-design/**',
        'apps/asyra-framework-site/app/releases/**',
        'apps/asyra-framework-site/app/roadmap/**',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/components/evidence-*.tsx',
        'apps/asyra-framework-site/components/status-*.tsx',
        'apps/asyra-framework-site/__tests__/routes.test.mjs'
      ],
      specRefs: [
        '#required-routes',
        '#shared-platform-contract',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'present-supporting-routes'
    }),
    step({
      id: 'expose-shared-foundations',
      order: 6,
      ownerPackage: 'Website shared Landing and Atlas foundations',
      purpose:
        'Expose stable navigation, metadata, focus, error, responsive, reduced-motion, and semantic visual primitives to downstream Landing and Runtime Atlas owners.',
      inputs: ['artifact:site-foundation', 'artifact:verified-site-content'],
      outputs: ['artifact:shared-product-foundations'],
      conditions: [
        'Downstream surfaces receive stable primitives without inherited product story or runtime behavior.',
        'Not-found, content-failure, and unsupported-browser cases are accessible and never fabricate output.',
        'Current synchronous static routes ship their accepted content in the initial readable document without a global loading.tsx streaming boundary.'
      ],
      bypasses: [
        'Landing and Atlas placeholder routes are temporary ownership markers only.',
        'A future asynchronous route owns a local Suspense and loading boundary instead of changing the global static-content contract.'
      ],
      allowedContributors: [
        'artifact:site-foundation',
        'accepted visual handoff',
        'shared semantic web contracts'
      ],
      forbiddenContributors: [
        'Landing narrative implementation',
        'Atlas executable cases or runtime state',
        'route-specific domain semantics in shared primitives',
        'global loading fallback that leaves accepted static content hidden until client JavaScript executes'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/app/layout.tsx',
        'apps/asyra-framework-site/app/error.tsx',
        'apps/asyra-framework-site/app/not-found.tsx',
        'apps/asyra-framework-site/app/robots.ts',
        'apps/asyra-framework-site/app/sitemap.ts',
        'apps/asyra-framework-site/app/globals.css',
        'apps/asyra-framework-site/components/foundation-*.tsx',
        'apps/asyra-framework-site/components/status-*.tsx',
        'apps/asyra-framework-site/__tests__/foundations.test.mjs'
      ],
      specRefs: [
        '#shared-platform-contract',
        '#quality-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'expose-shared-foundations'
    }),
    step({
      id: 'verify-platform',
      order: 7,
      ownerPackage: 'Website Platform verification',
      purpose:
        'Fail closed on toolchain drift, content drift, route gaps, inaccessible interaction, responsive failure, visual divergence, private imports, or production-build failure.',
      inputs: [
        'artifact:site-foundation',
        'artifact:verified-site-content',
        'artifact:documentation-experience',
        'artifact:supporting-routes',
        'artifact:shared-product-foundations'
      ],
      outputs: ['artifact:verified-platform'],
      conditions: [
        'Strict typecheck, lint, focused tests, root dependency validation, production build, and route smoke gates pass.',
        'Keyboard, focus, touch, responsive, reduced-motion, and synchronized visual cases pass.',
        'All forty-one content pages, generated facts, source links, headings, search records, and Markdown-copy bytes resolve exactly.'
      ],
      bypasses: [
        'Production deployment remains owned by Launch and Operations.'
      ],
      allowedContributors: [
        'deterministic project-owned tests',
        'production build artifacts',
        'synchronized browser evidence'
      ],
      forbiddenContributors: [
        'manual inspection as sole evidence',
        'missing-route allowlist',
        'deployment success used as correctness proof'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/**',
        'docs/ai/framework/plans/asyra-website-platform-and-docs-plan.md',
        'docs/ai/framework/plans/asyra-website-platform-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-platform-flow-inspector.contract.test.cjs'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-platform'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:platform-contract', 'freeze-platform-contract'],
      ['artifact:site-foundation', 'establish-site-foundation'],
      ['artifact:verified-site-content', 'load-public-content'],
      ['artifact:documentation-experience', 'present-documentation'],
      ['artifact:supporting-routes', 'present-supporting-routes'],
      ['artifact:shared-product-foundations', 'expose-shared-foundations'],
      ['artifact:verified-platform', 'verify-platform']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      ['freeze-platform-contract', 'establish-site-foundation', 'artifact:platform-contract'],
      ['freeze-platform-contract', 'load-public-content', 'artifact:platform-contract'],
      ['establish-site-foundation', 'load-public-content', 'artifact:site-foundation'],
      ['establish-site-foundation', 'present-documentation', 'artifact:site-foundation'],
      ['load-public-content', 'present-documentation', 'artifact:verified-site-content'],
      ['establish-site-foundation', 'present-supporting-routes', 'artifact:site-foundation'],
      ['load-public-content', 'present-supporting-routes', 'artifact:verified-site-content'],
      ['present-documentation', 'present-supporting-routes', 'artifact:documentation-experience'],
      ['establish-site-foundation', 'expose-shared-foundations', 'artifact:site-foundation'],
      ['load-public-content', 'expose-shared-foundations', 'artifact:verified-site-content'],
      ['present-documentation', 'verify-platform', 'artifact:documentation-experience'],
      ['present-supporting-routes', 'verify-platform', 'artifact:supporting-routes'],
      ['expose-shared-foundations', 'verify-platform', 'artifact:shared-product-foundations']
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `platform-route-${String(index + 1).padStart(2, '0')}`,
        from,
        to,
        producedArtifacts: Object.freeze([artifactId])
      })
    )
  ),
  invariants: Object.freeze([
    'A global non-engineer can read the site before opening technical depth.',
    'The platform never rewrites accepted content semantics or example behavior.',
    'Release facts come from manifests and remain candidate facts until public reconciliation.',
    'Landing narrative and Runtime Atlas execution remain downstream owner work.',
    'Generated visual boards are evidence and never production assets.',
    'No production deployment occurs in the Website Platform child.'
  ])
})
