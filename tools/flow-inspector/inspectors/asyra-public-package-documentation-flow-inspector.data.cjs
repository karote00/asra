const packageNames = Object.freeze([
  '@asyra/ai-agent-runtime',
  '@asyra/collaboration',
  '@asyra/core',
  '@asyra/design-system',
  '@asyra/factory',
  '@asyra/feature-system',
  '@asyra/input-system',
  '@asyra/persistence',
  '@asyra/preset',
  '@asyra/props-manager',
  '@asyra/reactive-events',
  '@asyra/render',
  '@asyra/render-engine',
  '@asyra/render-engine-pixi',
  '@asyra/scene-tree',
  '@asyra/selection',
  '@asyra/system-context',
  '@asyra/ui-context',
  '@asyra/utils'
])

const packageGuideIds = Object.freeze(
  packageNames.map(
    (name) => `reference/packages/${name.slice('@asyra/'.length)}`
  )
)

const pageIds = Object.freeze([
  'overview',
  'start/create-design-app',
  'start/extend-with-ai',
  'start/preset-2d',
  'start/custom-composition',
  'learn/information-models',
  'learn/intent-and-features',
  'learn/canonical-state',
  'learn/transactions-and-durability',
  'learn/validation-load-migration',
  'learn/projection-registration-replacement',
  'learn/runtime-boundaries-roadmap',
  'build/custom-schema',
  'build/feature-session',
  'build/render-boundary',
  'build/hierarchy-groups',
  'build/persistence-migration',
  'build/collaboration',
  'build/ai-actions',
  'build/app-retrieval-action',
  ...packageGuideIds,
  'reference/support-release',
  'cases/asyra-design'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/completed/asyra-public-package-documentation-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/asyra-public-package-documentation-flow-inspector.data.cjs'
  }),
  packageNames,
  packageGuideIds,
  pageIds,
  steps: Object.freeze([
    step({
      id: 'resolve-documentation-inputs',
      order: 1,
      ownerPackage: 'public documentation input adapter',
      purpose:
        'Resolve packages, public entrypoints, runtime support, and approved canonical documentation authorities without handwritten release facts.',
      inputs: [
        'manifest-derived 19-package release inventory',
        'active Framework and Asyra Design contracts',
        'create-asyra-design-app manifest and template contract'
      ],
      outputs: ['artifact:approved-documentation-inputs'],
      conditions: [
        'Package versions and public entrypoints derive from manifests and declarations.',
        'Only active canonical authorities and source-mapped public guides enter public mapping.'
      ],
      bypasses: [
        'Final registry URLs remain provisional until the publication owner verifies them.'
      ],
      allowedContributors: [
        'scripts/release release inventory',
        'active docs/ai/framework and docs/ai/apps contracts',
        'create-app/asyra-design manifest and template'
      ],
      forbiddenContributors: [
        'handwritten package versions',
        'package-private source imports',
        'historical plans as current behavior authority',
        'secrets or private endpoints'
      ],
      implementationBoundary: [
        'scripts/docs/**',
        'docs/public/schema/**',
        'docs/public/generated/**'
      ],
      specRefs: ['#freshness-contract', '#executable-content-cases'],
      failureOwnerStepId: 'resolve-documentation-inputs'
    }),
    step({
      id: 'freeze-content-contract',
      order: 2,
      ownerPackage: 'docs/public content manifest',
      purpose:
        'Own the exact page inventory, metadata schema, canonical source mappings, and public indexing exclusions.',
      inputs: [
        'artifact:approved-documentation-inputs',
        'required page inventory'
      ],
      outputs: ['artifact:public-content-contract'],
      conditions: [
        'Exactly 41 stable page ids are declared once.',
        'Each page owns a Markdown path, section, title, sources, and relationships to packages.',
        'Public indexes exclude internal operations, secrets, obsolete contracts, and historical audits.'
      ],
      bypasses: [
        'A page may declare no package only when its semantic sources remain explicit.'
      ],
      allowedContributors: [
        'thin product contract',
        'approved documentation inputs'
      ],
      forbiddenContributors: [
        'website-owned page ids',
        'implicit source discovery',
        'README content'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-public-package-documentation-plan.md',
        'tools/flow-inspector/inspectors/asyra-public-package-documentation-flow-inspector.data.cjs',
        'tools/flow-inspector/inspectors/__tests__/asyra-public-package-documentation-flow-inspector.contract.test.cjs',
        'docs/public/content-manifest.json',
        'docs/public/schema/**',
        'scripts/docs/**'
      ],
      specRefs: [
        '#required-page-inventory',
        '#ai-readable-documentation-contract'
      ],
      failureOwnerStepId: 'freeze-content-contract'
    }),
    step({
      id: 'author-start-and-learn',
      order: 3,
      ownerPackage: 'docs/public Start and Learn',
      purpose:
        'Teach beginner entry, current composition, deterministic ownership, and the future runtime boundary.',
      inputs: [
        'artifact:public-content-contract',
        'artifact:approved-documentation-inputs'
      ],
      outputs: ['artifact:start-learn-content'],
      conditions: [
        'create-asyra-design-app and minimal Framework composition remain distinct beginner paths.',
        'Current browser/Core support and future Headless/Core Kernel direction are explicit.'
      ],
      bypasses: [
        'A conceptual page links to an advanced guide instead of duplicating its complete implementation flow.'
      ],
      allowedContributors: [
        'active semantic authorities',
        'approved public package entrypoints'
      ],
      forbiddenContributors: [
        'future runtime presented as current',
        'Framework-owned app domain knowledge'
      ],
      implementationBoundary: [
        'docs/public/index.md',
        'docs/public/start/**',
        'docs/public/learn/**'
      ],
      specRefs: [
        '#public-information-architecture',
        '#executable-content-cases'
      ],
      failureOwnerStepId: 'author-start-and-learn'
    }),
    step({
      id: 'author-build-guides',
      order: 4,
      ownerPackage: 'docs/public Build',
      purpose:
        'Teach eight real cross-package product flows through verified public boundaries.',
      inputs: [
        'artifact:public-content-contract',
        'artifact:approved-documentation-inputs'
      ],
      outputs: ['artifact:build-content'],
      conditions: [
        'Every guide states prerequisites, owners, public APIs, copyable code, call location, execution flow, observable result, validation, and forbidden shortcuts.',
        'Failure and disabled-system behavior remain explicit.'
      ],
      bypasses: [
        'One advanced guide may explain several package relationships when the ownership flow is shared.'
      ],
      allowedContributors: [
        'public package entrypoints',
        'active contracts',
        'formal package behavior tests'
      ],
      forbiddenContributors: [
        'private imports',
        'unverified or speculative code copies',
        'manual-only expected output'
      ],
      implementationBoundary: ['docs/public/build/**'],
      specRefs: [
        '#package-guide-contract',
        '#ai-readable-documentation-contract'
      ],
      failureOwnerStepId: 'author-build-guides'
    }),
    step({
      id: 'author-package-reference',
      order: 5,
      ownerPackage: 'docs/public Reference',
      purpose:
        'Own one complete guide per release package plus support and release boundaries.',
      inputs: [
        'artifact:public-content-contract',
        'artifact:approved-documentation-inputs'
      ],
      outputs: ['artifact:package-reference-content'],
      conditions: [
        'All 19 release packages have one guide with owner, non-owner, lifecycle, relationships, optionality, failure, and related advanced-guide links.',
        'Generated API facts resolve only approved public entrypoints and declarations.'
      ],
      bypasses: ['Package guides may share advanced composition guides.'],
      allowedContributors: [
        'package manifests',
        'public declarations',
        'active package contracts'
      ],
      forbiddenContributors: [
        'private source APIs',
        'independent version metadata',
        'artificial per-package samples'
      ],
      implementationBoundary: [
        'docs/public/reference/**',
        'docs/public/generated/package-reference.json',
        'scripts/docs/**'
      ],
      specRefs: ['#package-guide-contract', '#freshness-contract'],
      failureOwnerStepId: 'author-package-reference'
    }),
    step({
      id: 'author-design-case-study',
      order: 6,
      ownerPackage: 'docs/public Cases',
      purpose:
        'Explain Asyra Design as a source-linked reference product without promoting App behavior into Framework ownership.',
      inputs: [
        'artifact:public-content-contract',
        'active Asyra Design contracts'
      ],
      outputs: ['artifact:design-case-content'],
      conditions: [
        'Framework, Preset, App, and Backend ownership is explicit.',
        'AI-created content uses the same editable, reversible, collaborative, and persistent canonical routes.'
      ],
      bypasses: [
        'Optional Collaboration and AI remain absent when not composed.'
      ],
      allowedContributors: [
        'active Asyra Design source and contracts',
        'approved public package entrypoints'
      ],
      forbiddenContributors: [
        'App behavior claimed as Framework default',
        'private operational endpoints',
        'unapproved visual evidence'
      ],
      implementationBoundary: ['docs/public/cases/**'],
      specRefs: ['#asyra-design-case-study-content'],
      failureOwnerStepId: 'author-design-case-study'
    }),
    step({
      id: 'publish-documentation-indexes',
      order: 7,
      ownerPackage: 'public documentation generator',
      purpose:
        'Publish deterministic content, source, API, and AI-readable indexes for Markdown and website consumers.',
      inputs: [
        'artifact:start-learn-content',
        'artifact:build-content',
        'artifact:package-reference-content',
        'artifact:design-case-content'
      ],
      outputs: ['artifact:public-documentation-bundle'],
      conditions: [
        'Generated indexes are deterministic and source-mapped.',
        'Plain-text discovery contains only approved public content.'
      ],
      bypasses: [
        'Website consumers present this bundle but cannot rewrite its semantic claims.'
      ],
      allowedContributors: [
        'manifest-owned Markdown',
        'approved generated release and API facts'
      ],
      forbiddenContributors: [
        'site-owned content copies',
        'internal docs ingestion',
        'secret or private endpoint indexing'
      ],
      implementationBoundary: [
        'docs/public/generated/**',
        'docs/public/llms.txt',
        'scripts/docs/**',
        'package.json'
      ],
      specRefs: ['#ai-readable-documentation-contract', '#freshness-contract'],
      failureOwnerStepId: 'publish-documentation-indexes'
    }),
    step({
      id: 'verify-public-documentation',
      order: 8,
      ownerPackage: 'public documentation validation',
      purpose:
        'Fail closed on missing pages, source drift, broken links, stale facts, unsupported APIs, or forbidden indexing.',
      inputs: [
        'artifact:public-documentation-bundle',
        'artifact:approved-documentation-inputs'
      ],
      outputs: ['artifact:verified-public-documentation'],
      conditions: [
        'All content cases and documentation quality gates pass.',
        'README and website implementation remain unmodified siblings.'
      ],
      bypasses: [
        'Final public registry and deployment links wait for their external owners.'
      ],
      allowedContributors: ['deterministic project-owned documentation gates'],
      forbiddenContributors: [
        'manual spot-check as sole evidence',
        'link suppression',
        'stale-version allowlists'
      ],
      implementationBoundary: [
        'docs/public/**',
        'scripts/docs/**',
        'package.json'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-public-documentation'
    })
  ]),
  artifacts: Object.freeze(
    [
      [
        'artifact:approved-documentation-inputs',
        'resolve-documentation-inputs'
      ],
      ['artifact:public-content-contract', 'freeze-content-contract'],
      ['artifact:start-learn-content', 'author-start-and-learn'],
      ['artifact:build-content', 'author-build-guides'],
      ['artifact:package-reference-content', 'author-package-reference'],
      ['artifact:design-case-content', 'author-design-case-study'],
      ['artifact:public-documentation-bundle', 'publish-documentation-indexes'],
      ['artifact:verified-public-documentation', 'verify-public-documentation']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      [
        'resolve-documentation-inputs',
        'freeze-content-contract',
        'artifact:approved-documentation-inputs'
      ],
      [
        'freeze-content-contract',
        'author-start-and-learn',
        'artifact:public-content-contract'
      ],
      [
        'freeze-content-contract',
        'author-build-guides',
        'artifact:public-content-contract'
      ],
      [
        'freeze-content-contract',
        'author-package-reference',
        'artifact:public-content-contract'
      ],
      [
        'freeze-content-contract',
        'author-design-case-study',
        'artifact:public-content-contract'
      ],
      [
        'author-start-and-learn',
        'publish-documentation-indexes',
        'artifact:start-learn-content'
      ],
      [
        'author-build-guides',
        'publish-documentation-indexes',
        'artifact:build-content'
      ],
      [
        'author-package-reference',
        'publish-documentation-indexes',
        'artifact:package-reference-content'
      ],
      [
        'author-design-case-study',
        'publish-documentation-indexes',
        'artifact:design-case-content'
      ],
      [
        'publish-documentation-indexes',
        'verify-public-documentation',
        'artifact:public-documentation-bundle'
      ]
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `documentation-route-${index + 1}`,
        from,
        to,
        producedArtifacts: [artifactId]
      })
    )
  ),
  acceptanceContracts: Object.freeze([
    Object.freeze({
      id: 'complete-public-ia',
      stepIds: ['freeze-content-contract', 'verify-public-documentation'],
      assertions: [
        'Exactly 41 stable pages and 19 package guides exist.',
        'Start, Learn, Build, Reference, and Cases remain readable Markdown.'
      ]
    }),
    Object.freeze({
      id: 'current-and-future-runtime-boundary',
      stepIds: ['author-start-and-learn', 'author-build-guides'],
      assertions: [
        'Current browser/Core composition is documented as supported.',
        'Headless Core and Core Kernel remain explicit future roadmap work.'
      ]
    }),
    Object.freeze({
      id: 'deterministic-website-handoff',
      stepIds: ['publish-documentation-indexes', 'verify-public-documentation'],
      assertions: [
        'The website receives one deterministic source-mapped bundle without content forks.'
      ]
    })
  ]),
  invariants: Object.freeze([
    Object.freeze({
      id: 'canonical-sources-only',
      statement: 'Every public claim maps to active approved authority.'
    }),
    Object.freeze({
      id: 'framework-domain-neutrality',
      statement:
        'Framework mechanics remain distinct from Preset defaults and App domain knowledge.'
    }),
    Object.freeze({
      id: 'no-content-forks',
      statement:
        'Code guidance, release facts, and website content retain one source-mapped owner.'
    })
  ])
})
