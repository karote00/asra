export interface StrokeIntegrationCoverageCase {
  id: string
  title: string
  reviewSegmentId: StrokeIntegrationReviewSegmentId
  testFile: string
  artifactChannels: readonly string[]
  focusedGate: string
  stepRange: readonly [number, number]
  stepIds: readonly string[]
  routeIds: readonly string[]
  artifactIds: readonly string[]
  coExecutionGroups: readonly string[]
  specRuleRefs: readonly string[]
  positiveAssertions: readonly string[]
  forbiddenAssertions: readonly string[]
}

export type StrokeIntegrationReviewSegmentId =
  | 'source-mutation-ingress'
  | 'render-mirror-current-state-cache'
  | 'source-domain-planning'
  | 'product-family-coexecution'
  | 'legality-final-records-descriptors'
  | 'output-channels'

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

const focusedContract = (
  reviewSegmentId: StrokeIntegrationReviewSegmentId,
  artifactChannels: readonly string[]
) => {
  const testFile =
    `packages/preset/src/__tests__/stroke-flow-integration/${reviewSegmentId}.test.ts`
  return {
    reviewSegmentId,
    testFile,
    artifactChannels,
    focusedGate:
      `yarn workspace @asyra/preset vitest run ${testFile.replace(
        'packages/preset/',
        ''
      )} --reporter=dot`
  }
}

export const strokeIntegrationCoverageMap: readonly StrokeIntegrationCoverageCase[] =
  [
    {
      ...focusedContract('source-mutation-ingress', ['internal']),
      id: 'source-mutation-ingress-linear-handoff',
      title:
        'Feature, model commit, and data-channel handoff through the computed patch subscriber boundary',
      stepRange: [1, 12],
      stepIds: [
        'feature-session-intent',
        'path-editing-intent',
        'point-handle-drag-operation',
        'structural-vector-operation',
        'common-api-domain-adapter',
        'canonical-workspace-data',
        'validate-topology',
        'computed-patch-builder',
        'transaction-undo-boundary',
        'scene-tree-commit',
        'computed-patch-event',
        'downstream-subscriber-routing'
      ],
      routeIds: [
        'linear-feature-session-intent-to-path-editing-intent',
        'linear-path-editing-intent-to-point-handle-drag-operation',
        'linear-point-handle-drag-operation-to-structural-vector-operation',
        'linear-structural-vector-operation-to-common-api-domain-adapter',
        'linear-common-api-domain-adapter-to-canonical-workspace-data',
        'linear-canonical-workspace-data-to-validate-topology',
        'linear-validate-topology-to-computed-patch-builder',
        'linear-computed-patch-builder-to-transaction-undo-boundary',
        'linear-transaction-undo-boundary-to-scene-tree-commit',
        'linear-scene-tree-commit-to-computed-patch-event',
        'linear-computed-patch-event-to-downstream-subscriber-routing'
      ],
      artifactIds: [
        'artifact:user-intent',
        'artifact:canonical-workspace-data',
        'artifact:topology-validation-evidence',
        'artifact:computed-patch'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        spec('canonical-owner-stage-diagnosis')
      ],
      positiveAssertions: [
        'Each source-mutation stage emits the next declared stage input without hidden render ownership.',
        'The computed patch reaches downstream subscribers as one preserved artifact identity.'
      ],
      forbiddenAssertions: [
        'No stroke product geometry is created before normalized render data.',
        'No renderer-owned repair is allowed in feature, model, or data-channel handoff.'
      ]
    },
    {
      ...focusedContract('render-mirror-current-state-cache', ['internal']),
      id: 'render-mirror-current-state-linear-handoff',
      title:
        'Render mirror patch, current render data, dirty graph, cache, and render strategy handoff',
      stepRange: [13, 17],
      stepIds: [
        'render-mirror-patch-apply',
        'render-data-derivation',
        'dirty-revision-graph',
        'stage-product-cache',
        'render-strategy-entry'
      ],
      routeIds: [
        'linear-downstream-subscriber-routing-to-render-mirror-patch-apply',
        'linear-render-mirror-patch-apply-to-render-data-derivation',
        'linear-render-data-derivation-to-dirty-revision-graph',
        'linear-dirty-revision-graph-to-stage-product-cache',
        'linear-stage-product-cache-to-render-strategy-entry'
      ],
      artifactIds: [
        'artifact:current-render-data',
        'artifact:dirty-revision-graph',
        'artifact:stage-cache-reuse-evidence'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        spec('stroke-parameter-stage-cache-rule')
      ],
      positiveAssertions: [
        'Committed patch identity reaches current render data before dirty classification.',
        'Dirty and cache evidence reaches render strategy entry without creating product geometry.'
      ],
      forbiddenAssertions: [
        'Render mirror and cache stages must not repair product geometry.',
        'Cache reuse must not bypass current-state signature validation.'
      ]
    },
    {
      ...focusedContract('source-domain-planning', ['internal']),
      id: 'normalized-source-domain-dash-family-chain',
      title:
        'Normalized render data, stroke spec, shared geometry, source family, domain, dash, and product family handoff',
      stepRange: [18, 24],
      stepIds: [
        'normalize-render-data',
        'normalize-stroke-spec',
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family'
      ],
      routeIds: [
        'linear-render-strategy-entry-to-normalize-render-data',
        'linear-normalize-render-data-to-normalize-stroke-spec',
        'linear-normalize-stroke-spec-to-shared-geometry-model',
        'linear-shared-geometry-model-to-resolve-source-families',
        'linear-resolve-source-families-to-resolve-stroke-domains',
        'linear-resolve-stroke-domains-to-allocate-dash-intervals',
        'linear-allocate-dash-intervals-to-select-stroke-product-family',
        'open-dangling-outside-both-side-span'
      ],
      artifactIds: [
        'artifact:normalized-stroke-spec',
        'artifact:stroke-domain-plan',
        'artifact:dash-product-interval'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('supported-stroke-feature-surface'),
        spec('dash-allocation-and-caps')
      ],
      positiveAssertions: [
        'Normalized stroke parameters select center, constrained solid, or constrained dashed product family.',
        'Open outside both-side spans remain a domain route, not a renderer shortcut.'
      ],
      forbiddenAssertions: [
        'No join, cap, legality, final face, or render entry is emitted by source/domain planning.',
        'Dash interval allocation must not create visible product polygons.'
      ]
    },
    {
      ...focusedContract('render-mirror-current-state-cache', [
        'internal',
        'render-hit-export'
      ]),
      id: 'dirty-cache-bypass-and-source-drag-routes',
      title:
        'Paint-only, hidden output, verified descriptor cache hit, and source-drag dirty-classification bypasses',
      stepRange: [15, 35],
      stepIds: [
        'dirty-revision-graph',
        'stage-product-cache',
        'attach-paint-payload',
        'build-final-faces',
        'emit-render-hit-export-packets'
      ],
      routeIds: [
        'source-drag-dirty-classification',
        'paint-only-cache-retint',
        'hidden-output-cache-bypass',
        'verified-product-descriptor-cache-hit'
      ],
      artifactIds: [
        'dirty:source-drag',
        'dirty:source-topology',
        'dirty:paint-only',
        'dirty:visibility-hidden',
        'cache:paint-retint',
        'cache:verified-product-descriptor',
        'cache:final-face-input',
        'output:hidden-render-packets'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        spec('supported-stroke-feature-surface')
      ],
      positiveAssertions: [
        'Paint-only resumes at paint payload with geometry-affecting signatures unchanged.',
        'Hidden output resumes at packet emission with empty output channels.',
        'Verified descriptor cache hit resumes at final faces only when signatures match.',
        'Source drag dirties source/topology-dependent stages without dirtying paint or static stroke parameters.'
      ],
      forbiddenAssertions: [
        'Bypass routes must not re-enter product-family, dash, join, legality, or resolved-region stages.',
        'Cache reuse must not become render-only product repair.'
      ]
    },
    {
      ...focusedContract('source-domain-planning', [
        'internal',
        'render-hit-export'
      ]),
      id: 'product-family-selection-and-unsupported-terminal',
      title:
        'Product family decisions for center, constrained solid, constrained dashed, and unsupported terminal routes',
      stepRange: [24, 24],
      stepIds: ['select-stroke-product-family'],
      routeIds: [
        'select-center-product-family',
        'select-constrained-solid-product-family',
        'select-constrained-dashed-product-family',
        'select-product-family-unsupported'
      ],
      artifactIds: [
        'artifact:product-family-selection-evidence',
        'output:unsupported-product-family-packets'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('supported-stroke-feature-surface'),
        spec('unsupported-stroke-input-policy')
      ],
      positiveAssertions: [
        'Supported stroke style and position route to exactly one product family decision.',
        'Unsupported product selection terminates into fail-closed empty output packets without substitute geometry.'
      ],
      forbiddenAssertions: [
        'Product family selection must not emit polygons, joins, caps, descriptors, or render entries.',
        'Unsupported inputs must not be approximated by a fallback visible route.'
      ]
    },
    {
      ...focusedContract('product-family-coexecution', ['render-hit-export']),
      id: 'center-product-and-source-vertex-route-chain',
      title:
        'Center product routes, authored descriptors, canonical output, and center source-vertex joins',
      stepRange: [25, 35],
      stepIds: [
        'build-center-stroke-products',
        'build-source-vertex-join-products',
        'build-final-faces'
      ],
      routeIds: [
        'center-products-coexecute-source-vertex-join-products',
        'center-solid-authored-stroke-descriptor',
        'center-dashed-authored-stroke-descriptor',
        'center-products-canonical-output-else',
        'center-solid-canonical-source-vertex-join-footprint'
      ],
      artifactIds: ['artifact:finalFaces'],
      coExecutionGroups: ['coexec:center-product-units'],
      specRuleRefs: [
        spec('asyra-stroke-construction-baseline'),
        spec('asyra-join-resolution-baseline')
      ],
      positiveAssertions: [
        'Center routes preserve authored descriptor style or canonical final faces according to route predicates.',
        'Dispatched center source-vertex joins complete before final face join coverage is claimed.'
      ],
      forbiddenAssertions: [
        'Center product routes must not use constrained legality masks.',
        'Renderer strokePathStyle.join must not become the source-vertex join owner.'
      ]
    },
    {
      ...focusedContract('product-family-coexecution', ['internal']),
      id: 'constrained-solid-product-legality-chain',
      title:
        'Constrained solid doubled-center product, source-vertex join co-execution, smooth span bypass, and legality',
      stepRange: [26, 33],
      stepIds: [
        'build-constrained-solid-products',
        'build-source-vertex-join-products',
        'build-smooth-continuity-products',
        'apply-legality'
      ],
      routeIds: [
        'constrained-solid-products-coexecute-source-vertex-join-products',
        'constrained-solid-products-coexecute-smooth-continuity-products',
        'constrained-solid-doubled-center-mask',
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-same-owner-smooth-span-descriptor',
        'smooth-continuity-products-canonical-output-else'
      ],
      artifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:legalityEquivalentProductUnits'
      ],
      coExecutionGroups: [
        'coexec:constrained-solid-product-units',
        'coexec:source-vertex-join-product-units'
      ],
      specRuleRefs: [
        spec('asyra-stroke-construction-baseline'),
        spec('product-legality-and-descriptor-encoding'),
        spec('smooth-curvature-non-join-contract')
      ],
      positiveAssertions: [
        'Constrained solid bodies and canonical source-vertex joins exist before legality clipping.',
        'Same-owner smooth descriptor bypass is separated from sharp source-vertex ownership.'
      ],
      forbiddenAssertions: [
        'Legality masks may clip but must not invent joins, caps, or helper geometry.',
        'Smooth descriptor bypass must not cross authored sharp source-vertex boundaries.'
      ]
    },
    {
      ...focusedContract('product-family-coexecution', [
        'evidence',
        'internal',
        'render-hit-export'
      ]),
      id: 'constrained-dashed-product-coexecution-chain',
      title:
        'Constrained dashed interval body, seam-boundary artifact, source-vertex join, terminal and smooth ownership overlays, and descriptor strategy co-execution',
      stepRange: [27, 33],
      stepIds: [
        'build-dash-interval-body-products',
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality'
      ],
      routeIds: [
        'constrained-dashed-products-derive-seam-boundaries',
        'constrained-dashed-products-coexecute-source-vertex-join-products',
        'constrained-dashed-products-coexecute-terminal-body-products',
        'constrained-dashed-products-coexecute-smooth-continuity-products',
        'constrained-dashed-products-coexecute-descriptor-strategy',
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'constrained-dashed-smooth-continuity-product',
        'constrained-dashed-join-owned-terminal-body-product',
        'descriptor-strategy-canonical-output-else'
      ],
      artifactIds: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary',
        'artifact:source-vertex-join-miter-evidence',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:constrained-dashed-smooth-continuity-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-product-units',
        'artifact:descriptorStrategyRecords',
        'artifact:preLegalityProductUnits',
        'artifact:postLegalityProductUnits'
      ],
      coExecutionGroups: [
        'coexec:constrained-dashed-product-units',
        'coexec:source-vertex-join-product-units',
        'coexec:terminal-body-product-units',
        'coexec:smooth-continuity-product-units'
      ],
      specRuleRefs: [
        spec('dash-body-and-join-seam-contract'),
        spec('local-composition-caps-and-joins'),
        spec('smooth-curvature-non-join-contract'),
        spec('product-legality-and-descriptor-encoding')
      ],
      positiveAssertions: [
        'Dash interval bodies emit boundary evidence, Step 28 derives seam-boundary artifacts, and source-vertex joins consume those artifact identities.',
        'Terminal and smooth-continuity ownership overlays plus descriptor strategy records co-execute before legality without adding visible body geometry.',
        'Constrained dashed product units preserve source ownership through legality.'
      ],
      forbiddenAssertions: [
        'Endpoint caps, terminal overhangs, terminal/smooth duplicate body products, bridge products, duplicate interval paint, and descriptor replay must not complete authored sharp joins.',
        'Smooth high-curvature spans must not become source-vertex join products.'
      ]
    },
    {
      ...focusedContract('legality-final-records-descriptors', [
        'internal',
        'render',
        'render-hit-export'
      ]),
      id: 'legality-resolved-paint-final-descriptor-chain',
      title:
        'Legality, resolved regions, paint payload, final faces, and post-legality descriptor materialization',
      stepRange: [33, 37],
      stepIds: [
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors'
      ],
      routeIds: [
        'linear-apply-legality-to-build-resolved-stroke-regions',
        'legality-product-unit-clipping',
        'linear-build-resolved-stroke-regions-to-attach-paint-payload',
        'linear-attach-paint-payload-to-build-final-faces',
        'constrained-dashed-descriptor-materialization'
      ],
      artifactIds: [
        'artifact:postLegalityProductUnits',
        'artifact:finalFaces',
        'artifact:constrained-dashed-render-descriptor'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation')
      ],
      positiveAssertions: [
        'Legality clips declared product units before resolved packets and final faces.',
        'Paint payload attaches without mutating geometry or descriptor channel identity.',
        'Renderer-ready descriptor materialization consumes post-legality or legality-equivalent products only.'
      ],
      forbiddenAssertions: [
        'Descriptor evidence must not become visible product during final-face assembly.',
        'Pre-legality product units must not be materialized as renderer-ready descriptors without equivalence evidence.'
      ]
    },
    {
      ...focusedContract('output-channels', ['render', 'render-hit-export']),
      id: 'render-entry-descriptor-and-canonical-output-chain',
      title:
        'Descriptor-visible routes, canonical final-face render entries, and packet output decision',
      stepRange: [36, 39],
      stepIds: [
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries'
      ],
      routeIds: [
        'constrained-dashed-inside-mask-descriptor',
        'constrained-dashed-outside-source-domain-descriptor',
        'constrained-dashed-outside-aggregate-descriptor',
        'canonical-final-face-render-entry',
        'descriptor-output-versus-canonical-packet-output',
        'linear-emit-render-hit-export-packets-to-render-entries'
      ],
      artifactIds: [
        'artifact:finalFaces',
        'artifact:renderEntries',
        'artifact:same-paint-composite-state',
        'artifact:constrained-dashed-render-descriptor'
      ],
      coExecutionGroups: [],
      specRuleRefs: [
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation')
      ],
      positiveAssertions: [
        'Descriptor-visible routes keep strokePathGroups, clips, excludes, and evidence channels separated.',
        'Canonical final-face render entries consume only declared visible final-face polygons.',
        'Packet output decides descriptor versus canonical output without changing product ownership.'
      ],
      forbiddenAssertions: [
        'descriptorProductPolygons must not become visible masks when strokePathGroups own visible output.',
        'Source path replay must not own authored sharp source-vertex completion.'
      ]
    },
    {
      ...focusedContract('output-channels', ['hit-export']),
      id: 'render-hit-export-output-channel-chain',
      title: 'Render entry projection and hit/export sibling projection',
      stepRange: [38, 41],
      stepIds: [
        'emit-render-hit-export-packets',
        'render-entries',
        'renderer-projection',
        'hit-export'
      ],
      routeIds: [
        'linear-render-entries-to-renderer-projection',
        'render-projection-merge',
        'hit-export-channel-packet-projection'
      ],
      artifactIds: [
        'channel:hit-export',
        'artifact:hit-export-packets',
        'artifact:hitExportPackets'
      ],
      coExecutionGroups: ['product-output-channel-consumer'],
      specRuleRefs: [spec('output-channel-separation')],
      positiveAssertions: [
        'Renderer projection draws declared render entries only.',
        'Hit/export consumes final-face channel packets as a sibling of renderer projection.',
        'Post-runtime validation and optional diagnostics consume terminal evidence without becoming development graph steps.'
      ],
      forbiddenAssertions: [
        'Renderer pixels must not become hit/export source of truth.',
        'Diagnostic or helper geometry must not become visible product output.'
      ]
    }
  ]

export const requiredBypassOrClassificationRouteIds = [
  'source-drag-dirty-classification',
  'paint-only-cache-retint',
  'hidden-output-cache-bypass',
  'verified-product-descriptor-cache-hit'
] as const
