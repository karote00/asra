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

const packageReadmePaths = Object.freeze(
  packageNames.map(
    (name) => `packages/${name.slice('@asyra/'.length)}/README.md`
  )
)

const readmePaths = Object.freeze([
  'README.md',
  ...packageReadmePaths,
  'apps/asyra-design/README.md',
  'create-app/asyra-design/README.md',
  'create-app/asyra-design/template/README.md'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/completed/asyra-public-readme-and-entrypoint-alignment-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/asyra-public-readme-and-entrypoint-alignment-flow-inspector.data.cjs',
    generatedReadmeSource: 'apps/asyra-design/README.md',
    generatedReadmeOutput: 'create-app/asyra-design/template/README.md'
  }),
  packageNames,
  packageReadmePaths,
  readmePaths,
  steps: Object.freeze([
    step({
      id: 'resolve-readme-inputs',
      order: 1,
      ownerPackage: 'public README input adapter',
      purpose:
        'Resolve the release packages, public guides, public entrypoints, support facts, and generated-app owner without handwritten release metadata.',
      inputs: [
        'manifest-derived 19-package release inventory',
        'accepted 41-page public documentation bundle',
        'root, Asyra Design, create-app, support, security, and license authorities'
      ],
      outputs: ['artifact:approved-readme-inputs'],
      conditions: [
        'Package versions and entrypoints derive from manifests and declarations.',
        'Documentation destinations resolve accepted stable ids.'
      ],
      bypasses: [
        'Website and deployment URLs remain absent until their public owners verify them.'
      ],
      allowedContributors: [
        'Framework release inventory',
        'docs/public content and generated indexes',
        'active Framework and Asyra Design contracts'
      ],
      forbiddenContributors: [
        'handwritten versions',
        'package-private APIs',
        'historical plans as current authority',
        'unverified website or deployment URLs'
      ],
      implementationBoundary: ['scripts/docs/**'],
      specRefs: ['#required-shared-contract', '#coordination-contract'],
      failureOwnerStepId: 'resolve-readme-inputs'
    }),
    step({
      id: 'freeze-readme-contract',
      order: 2,
      ownerPackage: 'public README contract',
      purpose:
        'Own the exact 23-surface inventory, owner mapping, required sections, link policy, generated route, negative cases, and contribution-policy invariant.',
      inputs: [
        'artifact:approved-readme-inputs',
        'surface-specific content contract'
      ],
      outputs: ['artifact:public-readme-contract'],
      conditions: [
        'Exactly 23 README surfaces and 19 release package READMEs are declared once.',
        'Every surface has one canonical owner and required content contract.',
        'External issues and contributions remain closed across every public surface.'
      ],
      bypasses: [
        'A concise package README delegates implementation detail to its complete public guide.'
      ],
      allowedContributors: [
        'thin README product contract',
        'approved README inputs'
      ],
      forbiddenContributors: [
        'website-owned product claims',
        'manual generated-template edits',
        'complete guide duplication'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-public-readme-and-entrypoint-alignment-plan.md',
        'tools/flow-inspector/inspectors/asyra-public-readme-and-entrypoint-alignment-flow-inspector.data.cjs',
        'tools/flow-inspector/inspectors/__tests__/asyra-public-readme-and-entrypoint-alignment-flow-inspector.contract.test.cjs'
      ],
      specRefs: ['#owned-surfaces', '#executable-readme-cases'],
      failureOwnerStepId: 'freeze-readme-contract'
    }),
    step({
      id: 'author-root-readme',
      order: 3,
      ownerPackage: 'repository root README',
      purpose:
        'Present the release positioning, entry paths, current and future boundary, navigation, and mandatory support and contribution policy.',
      inputs: ['artifact:public-readme-contract'],
      outputs: ['artifact:root-readme'],
      conditions: [
        'The Framework, Preset, App, and app-domain owners remain distinct.',
        'Current browser/Core support and future Headless/Core Kernel direction are explicit.',
        'The repository accepts no external issues or contributions.'
      ],
      bypasses: [
        'Unverified website and deployment URLs are not published as final links.'
      ],
      allowedContributors: [
        'approved product definition',
        'public documentation destinations',
        'release, security, and license authorities'
      ],
      forbiddenContributors: [
        'future runtime presented as current',
        'turnkey BIM, VR, simulation, or AI-domain capability claims',
        'external issue or pull-request invitation'
      ],
      implementationBoundary: ['README.md'],
      specRefs: ['#surface-specific-content', '#required-shared-contract'],
      failureOwnerStepId: 'author-root-readme'
    }),
    step({
      id: 'author-package-readmes',
      order: 4,
      ownerPackage: 'Framework package README owners',
      purpose:
        'Give every release package a concise owner/non-owner statement, install and import path, lifecycle summary, and links to its complete guide and release support.',
      inputs: [
        'artifact:public-readme-contract',
        'artifact:approved-readme-inputs'
      ],
      outputs: ['artifact:package-readmes'],
      conditions: [
        'All 19 package READMEs resolve their manifest-derived facts and public guide.',
        'Each package points to its complete maintained guide and release support.'
      ],
      bypasses: [
        'Packages meaningful only in composition explain that role in their complete guide.'
      ],
      allowedContributors: [
        'package manifests and public declarations',
        'accepted package guides'
      ],
      forbiddenContributors: [
        'private subpath imports',
        'independent version facts',
        'artificial package-only samples'
      ],
      implementationBoundary: ['packages/*/README.md', 'scripts/docs/**'],
      specRefs: ['#framework-packages', '#quality-gates'],
      failureOwnerStepId: 'author-package-readmes'
    }),
    step({
      id: 'author-design-readme-sources',
      order: 5,
      ownerPackage: 'Asyra Design public README sources',
      purpose:
        'Present Asyra Design as the beginner-ready reference product, distinguish local editing from complete services, and route direct or AI-assisted extension into public Framework docs.',
      inputs: ['artifact:public-readme-contract'],
      outputs: ['artifact:design-readme-sources'],
      conditions: [
        'Repository development and generated standalone setup remain distinct.',
        'Framework, Preset, App, and Backend ownership is explicit.',
        'The generated README canonical source contains first run, bounded extension, verification, optional services, and Framework next steps.'
      ],
      bypasses: [
        'Unavailable backend services preserve documented local editing but are not described as complete collaboration or durability.'
      ],
      allowedContributors: [
        'active Asyra Design contracts',
        'accepted Asyra Design case study',
        'public Framework documentation'
      ],
      forbiddenContributors: [
        'App behavior claimed as Framework behavior',
        'browser-visible provider secrets',
        'manual generated output edits'
      ],
      implementationBoundary: [
        'apps/asyra-design/README.md'
      ],
      specRefs: ['#asyra-design', '#generated-app-contract'],
      failureOwnerStepId: 'author-design-readme-sources'
    }),
    step({
      id: 'author-cli-readme',
      order: 6,
      ownerPackage: 'create-asyra-design-app CLI README',
      purpose:
        'Make the exact public create command, generated-product expectations, service choices, verification, and next Framework steps clear to beginner and AI-assisted users.',
      inputs: ['artifact:public-readme-contract'],
      outputs: ['artifact:cli-readme'],
      conditions: [
        'The CLI is the working-product beginner entrance.',
        'Commands and package-manager behavior match the CLI contract.',
        'Generated output ownership and contribution policy remain explicit.'
      ],
      bypasses: [
        'Registry publication does not need to be repeated when the current public command is already verified.'
      ],
      allowedContributors: [
        'create-app manifest, binary, tests, and verified public command',
        'canonical generated-app contract'
      ],
      forbiddenContributors: [
        'unverified flags or package managers',
        'template-only behavior',
        'external contribution invitation'
      ],
      implementationBoundary: ['create-app/asyra-design/README.md'],
      specRefs: ['#cli-and-generated-app', '#quality-gates'],
      failureOwnerStepId: 'author-cli-readme'
    }),
    step({
      id: 'transform-generated-readme',
      order: 7,
      ownerPackage: 'official create-app template generator',
      purpose:
        'Regenerate the standalone README from the canonical Asyra Design README without a generated-output repair.',
      inputs: [
        'artifact:design-readme-sources',
        'artifact:cli-readme',
        'release-configs/asyra-design.json'
      ],
      outputs: ['artifact:generated-readme'],
      conditions: [
        'The official release:app route produces the generated README.',
        'The generated README applies only the deterministic license link rewrite required by its standalone location.'
      ],
      bypasses: [
        'A stale generated README returns to the canonical source or generator owner.'
      ],
      allowedContributors: [
        'apps/asyra-design/README.md',
        'release-configs/asyra-design.json',
        'scripts/release-template.js'
      ],
      forbiddenContributors: [
        'handwritten create-app/asyra-design/template/README.md changes',
        'template-only patches'
      ],
      implementationBoundary: ['create-app/asyra-design/template'],
      specRefs: ['#generated-app-contract'],
      failureOwnerStepId: 'transform-generated-readme'
    }),
    step({
      id: 'verify-public-readmes',
      order: 8,
      ownerPackage: 'public README validation',
      purpose:
        'Fail closed on missing surfaces, contract drift, broken links, unsupported APIs, stale generated output, or contribution-policy conflicts.',
      inputs: [
        'artifact:root-readme',
        'artifact:package-readmes',
        'artifact:design-readme-sources',
        'artifact:cli-readme',
        'artifact:generated-readme',
        'artifact:approved-readme-inputs'
      ],
      outputs: ['artifact:verified-public-readmes'],
      conditions: [
        'All executable README cases and quality gates pass.',
        'Every link resolves and every public API reference belongs to an approved public entrypoint.',
        'The public-documentation source map deterministically acknowledges reviewed README source revisions without changing public page semantics.'
      ],
      bypasses: [
        'Website and deployment URLs remain deferred until verified by their owners.'
      ],
      allowedContributors: ['deterministic project-owned README gates'],
      forbiddenContributors: [
        'manual spot-check as sole evidence',
        'broken-link allowlists',
        'stale-version allowlists'
      ],
      implementationBoundary: [
        'README.md',
        'packages/*/README.md',
        'apps/asyra-design/README.md',
        'create-app/asyra-design/README.md',
        'create-app/asyra-design/template/README.md',
        'docs/public/generated/source-map.json',
        'scripts/docs/**',
        'package.json'
      ],
      specRefs: ['#quality-gates', '#definition-of-done'],
      failureOwnerStepId: 'verify-public-readmes'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:approved-readme-inputs', 'resolve-readme-inputs'],
      ['artifact:public-readme-contract', 'freeze-readme-contract'],
      ['artifact:root-readme', 'author-root-readme'],
      ['artifact:package-readmes', 'author-package-readmes'],
      ['artifact:design-readme-sources', 'author-design-readme-sources'],
      ['artifact:cli-readme', 'author-cli-readme'],
      ['artifact:generated-readme', 'transform-generated-readme'],
      ['artifact:verified-public-readmes', 'verify-public-readmes']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      ['resolve-readme-inputs', 'freeze-readme-contract', 'artifact:approved-readme-inputs'],
      ['freeze-readme-contract', 'author-root-readme', 'artifact:public-readme-contract'],
      ['freeze-readme-contract', 'author-package-readmes', 'artifact:public-readme-contract'],
      ['freeze-readme-contract', 'author-design-readme-sources', 'artifact:public-readme-contract'],
      ['freeze-readme-contract', 'author-cli-readme', 'artifact:public-readme-contract'],
      ['author-design-readme-sources', 'transform-generated-readme', 'artifact:design-readme-sources'],
      ['author-cli-readme', 'transform-generated-readme', 'artifact:cli-readme'],
      ['author-root-readme', 'verify-public-readmes', 'artifact:root-readme'],
      ['author-package-readmes', 'verify-public-readmes', 'artifact:package-readmes'],
      ['author-design-readme-sources', 'verify-public-readmes', 'artifact:design-readme-sources'],
      ['author-cli-readme', 'verify-public-readmes', 'artifact:cli-readme'],
      ['transform-generated-readme', 'verify-public-readmes', 'artifact:generated-readme']
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `readme-route-${index + 1}`,
        from,
        to,
        producedArtifacts: [artifactId]
      })
    )
  ),
  acceptanceContracts: Object.freeze([
    Object.freeze({
      id: 'complete-readme-inventory',
      stepIds: ['freeze-readme-contract', 'verify-public-readmes'],
      assertions: [
        'Exactly 23 public README surfaces and all 19 package owners are present.',
        'Every surface is concise and links to its complete guide or next step.'
      ]
    }),
    Object.freeze({
      id: 'beginner-and-framework-entries',
      stepIds: ['author-root-readme', 'author-design-readme-sources', 'author-cli-readme'],
      assertions: [
        'create-asyra-design-app is the beginner working-product entrance.',
        'Public documentation and Runtime Atlas remain the independent Framework-learning entrance.'
      ]
    }),
    Object.freeze({
      id: 'generated-and-policy-invariants',
      stepIds: ['transform-generated-readme', 'verify-public-readmes'],
      assertions: [
        'Generated README output differs from its canonical source only by the deterministic standalone license link rewrite.',
        'No public surface invites external issues or contributions.'
      ]
    })
  ]),
  invariants: Object.freeze([
    Object.freeze({
      id: 'canonical-owners-only',
      statement:
        'Every README claim derives from its artifact owner and approved public authorities.'
    }),
    Object.freeze({
      id: 'current-future-boundary',
      statement:
        'Current browser/Core support never becomes an unsupported Headless/Core Kernel claim.'
    }),
    Object.freeze({
      id: 'generated-output-only-through-generator',
      statement:
        'The standalone README reaches generated output only through the official release route.'
    })
  ])
})
