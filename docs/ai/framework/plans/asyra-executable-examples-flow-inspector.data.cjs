;(function () {
  'use strict'

  const specPath =
    'docs/ai/framework/plans/asyra-executable-examples-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/asyra-executable-examples-flow-inspector.data.cjs'

  const exampleIds = [
    'headless-core-information-model',
    'preset-2d-minimal',
    'preset-selective-defaults',
    'custom-component-schema',
    'feature-session-undo',
    'app-versioned-load-migration',
    'custom-render-boundary',
    'collaboration-two-memory-actors',
    'ai-registered-action',
    'headless-retrieval-action',
    'generated-design-app-extension'
  ]

  const lanes = [
    { id: 'release', title: 'Release Authority', order: 1 },
    { id: 'examples', title: 'Executable Examples', order: 2 },
    { id: 'validation', title: 'Consumer Validation', order: 3 },
    { id: 'handoff', title: 'Documentation and Site Handoff', order: 4 }
  ]

  const steps = [
    {
      id: 'resolve-release-inputs',
      order: 1,
      laneId: 'release',
      title: 'Resolve verified public package inputs',
      ownerPackage: 'framework release inventory',
      purpose:
        'Provide the exact public package names, versions, artifacts, and supported environments used by maintained examples.',
      inputs: ['verified framework release inventory'],
      outputs: ['artifact:approved-package-inputs'],
      conditions: [
        'Package names and versions come from the verified release inventory rather than example-owned literals.',
        'Only package roots or explicitly exported public subpaths are approved.'
      ],
      bypasses: [
        'Examples that require no package from a release artifact still declare their runtime prerequisites.'
      ],
      allowedContributors: [
        'verified release inventory',
        'public package export maps',
        'supported runtime declarations'
      ],
      forbiddenContributors: [
        'workspace aliases',
        'package source paths',
        'unpublished artifacts',
        'example-owned version literals'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/ai/releases/**',
        'scripts/release/**',
        'package.json',
        'packages/*/package.json'
      ],
      specRefs: [
        '#ownership-boundary',
        '#example-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'resolve-release-inputs'
    },
    {
      id: 'author-framework-examples',
      order: 1,
      laneId: 'examples',
      title: 'Author public Framework examples',
      ownerPackage: 'docs/examples',
      purpose:
        'Own examples 1 through 10 as small, deterministic public-API compositions with meaningful runtime assertions.',
      inputs: [
        'artifact:approved-package-inputs',
        'public package contracts',
        'required example suite cases 1 through 10'
      ],
      outputs: ['artifact:framework-example-sources'],
      conditions: [
        'Every source declares a stable example id, objective, public package map, environment, run command, extractable region, and expected result.',
        'Headless examples have no Render, UI, or browser dependency.',
        'Optional systems remain explicitly composed and inert when omitted.',
        'Failure examples assert no partial canonical state or unintended transaction commit.'
      ],
      bypasses: [
        'A browser-dependent example separates runtime mechanics from presentation when the public contract permits headless validation.'
      ],
      allowedContributors: [
        'public package roots',
        'explicitly exported public subpaths',
        'deterministic app-owned adapters declared by the example'
      ],
      forbiddenContributors: [
        'workspace-private imports',
        'relative cross-package imports',
        'fixture-specific product branches',
        'fake or fallback runtime output',
        'domain behavior claimed as Framework behavior'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/examples/**',
        'packages/*/src/__tests__/*documentation-example*',
        'packages/*/package.json'
      ],
      specRefs: [
        '#required-example-suite',
        '#example-contract',
        '#quality-gates'
      ],
      failureOwnerStepId: 'author-framework-examples'
    },
    {
      id: 'author-generated-app-extension',
      order: 2,
      laneId: 'examples',
      title: 'Author generated Asyra Design extension',
      ownerPackage: '@asyra/asyra-design',
      purpose:
        'Own one bounded, non-production extension example that starts from the generated app and composes Framework capabilities through supported boundaries.',
      inputs: [
        'artifact:approved-package-inputs',
        'generated Asyra Design app public extension boundaries',
        'required example suite case 11'
      ],
      outputs: ['artifact:generated-app-extension-source'],
      conditions: [
        'The example is maintained in the Asyra Design app and does not change production behavior.',
        'The example identifies which behavior is Framework-owned, preset-provided, and app-owned.'
      ],
      bypasses: [
        'The example is excluded from production bundles unless an app developer explicitly imports it.'
      ],
      allowedContributors: [
        'Asyra Design generated app extension surface',
        'public Framework package roots',
        'app-owned domain code'
      ],
      forbiddenContributors: [
        'template dist edits',
        'Asyra Design production bootstrap changes',
        'private Framework source imports',
        'Framework-owned domain assumptions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/examples/**',
        'apps/asyra-design/src/__tests__/*example*',
        'apps/asyra-design/package.json',
        'apps/asyra-design/tsconfig.json'
      ],
      specRefs: [
        '#required-example-suite',
        '#ownership-boundary',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'author-generated-app-extension'
    },
    {
      id: 'verify-public-consumers',
      order: 1,
      laneId: 'validation',
      title: 'Verify public consumer execution',
      ownerPackage: 'example consumer validation',
      purpose:
        'Execute maintained sources against approved artifacts and prove their result contracts without workspace-private resolution.',
      inputs: [
        'artifact:approved-package-inputs',
        'artifact:framework-example-sources',
        'artifact:generated-app-extension-source'
      ],
      outputs: ['artifact:verified-examples'],
      conditions: [
        'All 11 stable example ids execute through public APIs and assert their declared result contracts.',
        'Local artifact and final registry-only clean-consumer results agree.',
        'Expected failures leave no partial canonical state or unintended commit.'
      ],
      bypasses: [
        'Registry-only execution waits for the final publication checkpoint, while the same source first runs against approved local artifacts.',
        'Browser presentation may use its declared browser gate while the separable runtime contract runs headlessly.'
      ],
      allowedContributors: [
        'approved packed or registry artifacts',
        'example-owned assertions',
        'project-owned clean-consumer harness'
      ],
      forbiddenContributors: [
        'workspace symlinks',
        'source aliases',
        'manual-only expected output',
        'site-owned code copies'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/examples/**',
        'scripts/ci/**',
        'scripts/release/**',
        'packages/*/src/__tests__/*documentation-example*',
        'apps/asyra-design/src/__tests__/*example*'
      ],
      specRefs: [
        '#example-contract',
        '#implementation-stages',
        '#quality-gates'
      ],
      failureOwnerStepId: 'verify-public-consumers'
    },
    {
      id: 'publish-example-inventory',
      order: 1,
      laneId: 'handoff',
      title: 'Publish deterministic example inventory',
      ownerPackage: 'docs/examples',
      purpose:
        'Publish the single tested inventory consumed by documentation and the website without copying example source.',
      inputs: [
        'artifact:approved-package-inputs',
        'artifact:verified-examples'
      ],
      outputs: ['artifact:public-example-inventory'],
      conditions: [
        'Inventory order and stable ids are deterministic.',
        'Each entry contains title, source file, public packages, environment, run command, extraction regions, and result contract.',
        'Extracted snippets are byte-identical to tested source regions.'
      ],
      bypasses: [
        'Documentation and website consumers may link instead of embed, but may not fork the tested source.'
      ],
      allowedContributors: [
        'artifact:verified-examples',
        'artifact:approved-package-inputs',
        'deterministic extraction tooling'
      ],
      forbiddenContributors: [
        'hand-copied website snippets',
        'untested documentation variants',
        'independent version metadata',
        'consumer-owned stable ids'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'docs/examples/**',
        'scripts/docs/**',
        'package.json'
      ],
      specRefs: [
        '#website-handoff',
        '#quality-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'publish-example-inventory'
    }
  ]

  const routes = [
    {
      id: 'supply-framework-inputs',
      from: 'resolve-release-inputs',
      to: 'author-framework-examples',
      kind: 'data',
      predicate: 'The release inventory verifies the required public packages.',
      producedArtifacts: ['artifact:approved-package-inputs']
    },
    {
      id: 'supply-app-extension-inputs',
      from: 'resolve-release-inputs',
      to: 'author-generated-app-extension',
      kind: 'data',
      predicate: 'The generated app and required public packages are available.',
      producedArtifacts: ['artifact:approved-package-inputs']
    },
    {
      id: 'validate-framework-examples',
      from: 'author-framework-examples',
      to: 'verify-public-consumers',
      kind: 'runtime',
      predicate: 'Examples 1 through 10 declare complete result contracts.',
      producedArtifacts: ['artifact:framework-example-sources']
    },
    {
      id: 'validate-generated-app-extension',
      from: 'author-generated-app-extension',
      to: 'verify-public-consumers',
      kind: 'runtime',
      predicate: 'The bounded extension source is excluded from production bootstrap.',
      producedArtifacts: ['artifact:generated-app-extension-source']
    },
    {
      id: 'publish-verified-suite',
      from: 'verify-public-consumers',
      to: 'publish-example-inventory',
      kind: 'data',
      predicate: 'All required example ids pass their applicable local artifact gates.',
      producedArtifacts: ['artifact:verified-examples']
    },
    {
      id: 'consume-public-example-inventory',
      from: 'publish-example-inventory',
      kind: 'terminal',
      predicate: 'Documentation or the website requests tested example metadata or source regions.',
      producedArtifacts: ['artifact:public-example-inventory']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:approved-package-inputs',
      title: 'Approved public package inputs',
      ownerStepId: 'resolve-release-inputs',
      channel: 'verified release inventory',
      terminal: false,
      consumerStepIds: [
        'author-framework-examples',
        'author-generated-app-extension',
        'verify-public-consumers',
        'publish-example-inventory'
      ]
    },
    {
      id: 'artifact:framework-example-sources',
      title: 'Framework example sources and result contracts',
      ownerStepId: 'author-framework-examples',
      channel: 'maintained docs/examples source',
      terminal: false,
      consumerStepIds: ['verify-public-consumers']
    },
    {
      id: 'artifact:generated-app-extension-source',
      title: 'Generated app bounded extension source',
      ownerStepId: 'author-generated-app-extension',
      channel: 'Asyra Design example source',
      terminal: false,
      consumerStepIds: ['verify-public-consumers']
    },
    {
      id: 'artifact:verified-examples',
      title: 'Verified 11-example suite',
      ownerStepId: 'verify-public-consumers',
      channel: 'formal example gates',
      terminal: false,
      consumerStepIds: ['publish-example-inventory']
    },
    {
      id: 'artifact:public-example-inventory',
      title: 'Deterministic public example inventory',
      ownerStepId: 'publish-example-inventory',
      channel: 'docs and website data contract',
      terminal: true,
      consumerStepIds: []
    }
  ]

  const invariants = [
    {
      id: 'public-artifacts-only',
      statement:
        'Every maintained example executes through approved public artifacts without private imports, workspace aliases, or fabricated output.',
      stepIds: [
        'resolve-release-inputs',
        'author-framework-examples',
        'author-generated-app-extension',
        'verify-public-consumers'
      ],
      artifactIds: [
        'artifact:approved-package-inputs',
        'artifact:verified-examples'
      ],
      specRefs: ['#ownership-boundary', '#quality-gates']
    },
    {
      id: 'framework-remains-domain-neutral',
      statement:
        'Examples distinguish Framework mechanics, optional Preset defaults, and app-owned domain knowledge without promoting app behavior into Framework ownership.',
      stepIds: [
        'author-framework-examples',
        'author-generated-app-extension'
      ],
      artifactIds: [
        'artifact:framework-example-sources',
        'artifact:generated-app-extension-source'
      ],
      specRefs: ['#required-example-suite', '#definition-of-done']
    },
    {
      id: 'one-tested-source-of-truth',
      statement:
        'Documentation and website consumers use the deterministic inventory and tested source regions instead of maintaining divergent copies.',
      stepIds: ['verify-public-consumers', 'publish-example-inventory'],
      artifactIds: [
        'artifact:verified-examples',
        'artifact:public-example-inventory'
      ],
      specRefs: ['#website-handoff', '#quality-gates']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'required-example-suite',
      title: 'Required executable example suite',
      stepIds: [
        'author-framework-examples',
        'author-generated-app-extension',
        'verify-public-consumers'
      ],
      specRefs: ['#required-example-suite', '#definition-of-done'],
      assertions: exampleIds.map(
        (id) => `The maintained and verified suite contains ${id}.`
      )
    },
    {
      id: 'headless-and-optional-boundaries',
      title: 'Headless and optional boundaries',
      stepIds: ['author-framework-examples', 'verify-public-consumers'],
      specRefs: ['#required-example-suite', '#quality-gates'],
      assertions: [
        'Headless Core and retrieval examples execute without Render, UI, or browser dependencies.',
        'Preset, rendering, Collaboration, and AI capabilities appear only when explicitly composed.'
      ]
    },
    {
      id: 'website-handoff-contract',
      title: 'Website handoff contract',
      stepIds: ['publish-example-inventory'],
      specRefs: ['#website-handoff', '#definition-of-done'],
      assertions: [
        'The site receives stable metadata and byte-identical tested source regions through one deterministic inventory.'
      ]
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'asyra-executable-examples',
      kind: 'system',
      title: 'Asyra Executable Examples Inspector',
      subtitle:
        'Public release inputs through maintained examples, clean-consumer verification, and deterministic docs/site handoff.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Executable Examples product contract',
      inspectorOwner: 'Asyra Executable Examples Inspector data'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Product Contract',
        href: './asyra-executable-examples-plan.md',
        kind: 'framework'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: '../FLOW_INSPECTOR.md',
        kind: 'framework'
      }
    ],
    exampleIds,
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const freeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }

  freeze(data)

  if (typeof globalThis !== 'undefined') {
    globalThis.FLOW_INSPECTOR_DATA = data
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
