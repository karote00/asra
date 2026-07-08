export type StrokeGeometryOracleDimension =
  | 'center'
  | 'inside'
  | 'outside'
  | 'solid'
  | 'dashed'
  | 'butt-cap'
  | 'round-cap'
  | 'square-cap'
  | 'authored-miter'
  | 'authored-bevel'
  | 'authored-round'
  | 'resolved-miter'
  | 'resolved-bevel'
  | 'resolved-round'
  | 'resolved-bevel-by-miter-angle'
  | 'resolved-degenerate-bevel'
  | 'ordinary-sharp-vertex'
  | 'high-acute-vertex'
  | 'smooth-high-curvature-anchor'
  | 'dash-join-seam'
  | 'dash-terminal'
  | 'legal-side-clipping'
  | 'pre-legality-product'
  | 'post-legality-product'
  | 'descriptor-evidence-channel'
  | 'visible-render-channel'
  | 'hit-export-channel'
  | 'diagnostics-channel'
  | 'hidden-output-not-geometry'
  | 'paint-only-not-geometry'
  | 'cache-hit-not-geometry'

export type StrokeGeometryOracleCaseKind =
  | 'positive-contract'
  | 'edge-condition'
  | 'forbidden-contributor'
  | 'channel-separation'
  | 'degenerate-contract'

export type StrokeGeometryOracleCoverageStrategy =
  | 'pairwise-baseline'
  | 'spec-critical-higher-order'

export type StrokeGeometryOracleStrokeParameter =
  | 'position:center'
  | 'position:inside'
  | 'position:outside'
  | 'style:solid'
  | 'style:dashed'
  | 'cap:butt'
  | 'cap:round'
  | 'cap:square'
  | 'join:authored-miter'
  | 'join:authored-bevel'
  | 'join:authored-round'
  | 'join:resolved-miter'
  | 'join:resolved-bevel'
  | 'join:resolved-round'
  | 'join:resolved-bevel-by-miter-angle'
  | 'join:resolved-degenerate-bevel'
  | 'dash:dash-gap'
  | 'dash:short-span-collapse'
  | 'dash:terminal-half-dash'
  | 'path:open'
  | 'path:closed'
  | 'path:self-intersecting'
  | 'path:dangling-branch'
  | 'paint:solid'
  | 'paint:gradient'
  | 'paint:hidden'
  | 'paint:paint-only'
  | 'channel:descriptor'
  | 'channel:render'
  | 'channel:hit-export'
  | 'channel:diagnostics'
  | 'cache:verified-descriptor-hit'
  | 'legality:pre'
  | 'legality:post'
  | 'miter:threshold-provenance'
  | 'seam:dash-join-continuity'
  | 'smooth:high-curvature-non-join'

export type StrokeGeometryOracleGeometryScenario =
  | 'straight-segment'
  | 'convex-closed-polygon'
  | 'concave-closed-polygon'
  | 'ordinary-acute-vertex'
  | 'high-acute-vertex'
  | 'obtuse-vertex'
  | 'near-collinear-vertex'
  | 'zero-length-degenerate'
  | 'smooth-cubic-high-curvature'
  | 'closed-self-intersecting'
  | 'open-dangling-self-intersecting'
  | 'tiny-sliver-domain'
  | 'short-dash-collapse'
  | 'non-geometry-state-change'

export type StrokeGeometryOracleProductFamily =
  | 'stroke-normalization'
  | 'center-solid-product'
  | 'center-dashed-product'
  | 'constrained-solid-product'
  | 'constrained-dashed-product'
  | 'dash-interval-body-product'
  | 'source-vertex-join-product'
  | 'terminal-body-product'
  | 'smooth-continuity-product'
  | 'descriptor-product'
  | 'final-face-product'
  | 'render-entry-product'
  | 'hit-export-product'
  | 'diagnostic-evidence'
  | 'non-geometry-bypass'

export type StrokeGeometryOracleOwnerStage =
  | 'Stroke Geometry'
  | 'Stroke Geometry center product assembly'
  | 'Stroke Geometry constrained solid product assembly'
  | 'Stroke Geometry dashed interval body assembly'
  | 'Stroke Geometry source-vertex join assembly'
  | 'Stroke Geometry terminal body assembly'
  | 'Stroke Geometry smooth-continuity product assembly'
  | 'Stroke Geometry descriptor strategy selection'
  | 'Stroke Geometry legality clipping'
  | 'Stroke Geometry final face assembly'
  | 'Product Output descriptor materialization'
  | 'Product Output render-entry materialization'
  | 'Product Output renderer projection'
  | 'Product Output hit/export projection'
  | 'Diagnostics runtime evidence channels'
  | 'Stage Product Cache'

export type StrokeGeometryOracleGeometryAssertion =
  | 'artifact-shape'
  | 'owner-stage-metadata'
  | 'local-join-envelope'
  | 'theoretical-miter-apex'
  | 'miter-threshold-provenance'
  | 'dash-join-seam-continuity'
  | 'cap-terminal-ownership'
  | 'smooth-continuity-non-join'
  | 'descriptor-channel-separation'
  | 'render-channel-declaration'
  | 'hit-export-sibling-channel'
  | 'diagnostics-non-visible'
  | 'hidden-output-non-geometry'
  | 'paint-only-non-geometry'
  | 'cache-hit-non-geometry'
  | 'legal-side-wrong-side-rejection'
  | 'degenerate-local-output'
  | 'forbidden-contributor-absence'

export interface StrokeGeometryOracleCoverageCase {
  id: string
  title: string
  caseKind: StrokeGeometryOracleCaseKind
  coverageStrategy: StrokeGeometryOracleCoverageStrategy
  strokeParameters: readonly StrokeGeometryOracleStrokeParameter[]
  geometryScenario: readonly StrokeGeometryOracleGeometryScenario[]
  productFamily: readonly StrokeGeometryOracleProductFamily[]
  ownerStages: readonly StrokeGeometryOracleOwnerStage[]
  stepIds: readonly string[]
  inspectorStepRefs: readonly string[]
  routeIds: readonly string[]
  artifactIds: readonly string[]
  requiredArtifacts: readonly string[]
  specRuleRefs: readonly string[]
  dimensions: readonly StrokeGeometryOracleDimension[]
  requiredGeometryAssertions: readonly StrokeGeometryOracleGeometryAssertion[]
  testFiles: readonly string[]
  testNames: readonly string[]
  positiveAssertions: readonly string[]
  forbiddenContributors: readonly string[]
}

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

const oracle = (fileName: string) =>
  `packages/preset/src/__tests__/stroke-geometry-oracles/${fileName}`

export const requiredStrokeGeometryOracleDimensions: readonly StrokeGeometryOracleDimension[] =
  [
    'center',
    'inside',
    'outside',
    'solid',
    'dashed',
    'butt-cap',
    'round-cap',
    'square-cap',
    'authored-miter',
    'authored-bevel',
    'authored-round',
    'resolved-miter',
    'resolved-bevel',
    'resolved-round',
    'resolved-bevel-by-miter-angle',
    'resolved-degenerate-bevel',
    'ordinary-sharp-vertex',
    'high-acute-vertex',
    'smooth-high-curvature-anchor',
    'dash-join-seam',
    'dash-terminal',
    'legal-side-clipping',
    'pre-legality-product',
    'post-legality-product',
    'descriptor-evidence-channel',
    'visible-render-channel',
    'hit-export-channel',
    'diagnostics-channel',
    'hidden-output-not-geometry',
    'paint-only-not-geometry',
    'cache-hit-not-geometry'
  ]

export const requiredStrokeGeometryOracleCaseKinds: readonly StrokeGeometryOracleCaseKind[] =
  [
    'positive-contract',
    'edge-condition',
    'forbidden-contributor',
    'channel-separation',
    'degenerate-contract'
  ]

export const requiredStrokeGeometryOracleStrokeParameters: readonly StrokeGeometryOracleStrokeParameter[] =
  [
    'position:center',
    'position:inside',
    'position:outside',
    'style:solid',
    'style:dashed',
    'cap:butt',
    'cap:round',
    'cap:square',
    'join:authored-miter',
    'join:authored-bevel',
    'join:authored-round',
    'join:resolved-miter',
    'join:resolved-bevel',
    'join:resolved-round',
    'join:resolved-bevel-by-miter-angle',
    'join:resolved-degenerate-bevel',
    'dash:dash-gap',
    'dash:short-span-collapse',
    'dash:terminal-half-dash',
    'path:open',
    'path:closed',
    'path:self-intersecting',
    'path:dangling-branch',
    'paint:solid',
    'paint:gradient',
    'paint:hidden',
    'paint:paint-only',
    'channel:descriptor',
    'channel:render',
    'channel:hit-export',
    'channel:diagnostics',
    'cache:verified-descriptor-hit',
    'legality:pre',
    'legality:post',
    'miter:threshold-provenance',
    'seam:dash-join-continuity',
    'smooth:high-curvature-non-join'
  ]

export const requiredStrokeGeometryOracleGeometryScenarios: readonly StrokeGeometryOracleGeometryScenario[] =
  [
    'straight-segment',
    'convex-closed-polygon',
    'concave-closed-polygon',
    'ordinary-acute-vertex',
    'high-acute-vertex',
    'obtuse-vertex',
    'near-collinear-vertex',
    'zero-length-degenerate',
    'smooth-cubic-high-curvature',
    'closed-self-intersecting',
    'open-dangling-self-intersecting',
    'tiny-sliver-domain',
    'short-dash-collapse',
    'non-geometry-state-change'
  ]

export const requiredStrokeGeometryOracleProductFamilies: readonly StrokeGeometryOracleProductFamily[] =
  [
    'stroke-normalization',
    'center-solid-product',
    'center-dashed-product',
    'constrained-solid-product',
    'constrained-dashed-product',
    'dash-interval-body-product',
    'source-vertex-join-product',
    'terminal-body-product',
    'smooth-continuity-product',
    'descriptor-product',
    'final-face-product',
    'render-entry-product',
    'hit-export-product',
    'diagnostic-evidence',
    'non-geometry-bypass'
  ]

export const strokeGeometryOracleCoverageMap: readonly StrokeGeometryOracleCoverageCase[] =
  [
    {
      id: 'stroke-parameter-normalization-matrix',
      title:
        'Renderable stroke normalization covers authored stroke parameters before product geometry resolution',
      caseKind: 'positive-contract',
      coverageStrategy: 'pairwise-baseline',
      strokeParameters: [
        'position:center',
        'position:inside',
        'position:outside',
        'style:solid',
        'style:dashed',
        'cap:butt',
        'cap:round',
        'cap:square',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'dash:dash-gap',
        'paint:solid',
        'paint:gradient',
        'paint:hidden'
      ],
      geometryScenario: [
        'straight-segment',
        'convex-closed-polygon',
        'non-geometry-state-change'
      ],
      productFamily: ['stroke-normalization', 'non-geometry-bypass'],
      ownerStages: ['Stroke Geometry'],
      stepIds: ['normalize-stroke-spec'],
      inspectorStepRefs: ['normalize-stroke-spec'],
      routeIds: ['linear-normalize-render-data-to-normalize-stroke-spec'],
      artifactIds: ['stage:normalize-stroke-spec'],
      requiredArtifacts: ['stage:normalize-stroke-spec'],
      specRuleRefs: [
        spec('supported-stroke-feature-surface'),
        spec('reference-calibrated-stroke-parameter-contract'),
        spec('stroke-parameter-normalization-contract')
      ],
      dimensions: [
        'center',
        'inside',
        'outside',
        'solid',
        'dashed',
        'butt-cap',
        'round-cap',
        'square-cap',
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'hidden-output-not-geometry',
        'paint-only-not-geometry',
        'diagnostics-channel'
      ],
      requiredGeometryAssertions: [
        'owner-stage-metadata',
        'hidden-output-non-geometry',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('stroke-parameter-matrix-oracle.test.ts')],
      testNames: [
        'normalizes every authored stroke style parameter into a renderable stroke without resolving product geometry',
        'normalizes solid and gradient stroke paint without changing style geometry parameters',
        'rejects non-renderable stroke parameters with diagnostics instead of fallback geometry'
      ],
      positiveAssertions: [
        'Renderable stroke fields are normalized before any product polygon, descriptor, or resolved join is emitted.',
        'Paint normalization preserves geometry-affecting parameters and hidden/invalid strokes emit diagnostics only.'
      ],
      forbiddenContributors: [
        'fallback geometry',
        'product polygons during normalization',
        'descriptor output during normalization'
      ]
    },
    {
      id: 'center-product-family-baseline',
      title:
        'Center solid and dashed products emit declared product artifacts without downstream geometry repair',
      caseKind: 'positive-contract',
      coverageStrategy: 'pairwise-baseline',
      strokeParameters: [
        'position:center',
        'style:solid',
        'style:dashed',
        'cap:butt',
        'cap:round',
        'cap:square',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'dash:dash-gap',
        'dash:short-span-collapse',
        'dash:terminal-half-dash',
        'path:open',
        'path:closed',
        'paint:solid'
      ],
      geometryScenario: [
        'straight-segment',
        'convex-closed-polygon',
        'short-dash-collapse'
      ],
      productFamily: ['center-solid-product', 'center-dashed-product'],
      ownerStages: ['Stroke Geometry center product assembly'],
      stepIds: ['build-center-stroke-products'],
      inspectorStepRefs: ['build-center-stroke-products'],
      routeIds: [
        'center-solid-authored-stroke-descriptor',
        'center-dashed-authored-stroke-descriptor',
        'center-products-canonical-output-else'
      ],
      artifactIds: [
        'stage:build-center-stroke-products',
        'artifact:preLegalityProductUnits'
      ],
      requiredArtifacts: [
        'stage:build-center-stroke-products',
        'artifact:preLegalityProductUnits'
      ],
      specRuleRefs: [
        spec('asyra-stroke-construction-baseline'),
        spec('product-legality-and-descriptor-encoding')
      ],
      dimensions: [
        'center',
        'solid',
        'dashed',
        'butt-cap',
        'round-cap',
        'square-cap',
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'dash-terminal',
        'pre-legality-product'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'cap-terminal-ownership',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('stroke-geometry-oracle-matrix.test.ts')],
      testNames: [
        'asserts center solid and dashed products produce declared artifacts without descriptor or channel repair'
      ],
      positiveAssertions: [
        'Center products emit declared product packets from center product assembly before output channels consume them.'
      ],
      forbiddenContributors: [
        'descriptor evidence as center product',
        'renderer channel repair',
        'diagnostic geometry as center product'
      ]
    },
    {
      id: 'center-slice-render-output-acceptance',
      title:
        'Center solid and dashed open and closed products preserve ownership through final face, render entry, hit/export, and renderer projection channels',
      caseKind: 'positive-contract',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'position:center',
        'style:solid',
        'style:dashed',
        'cap:butt',
        'cap:round',
        'cap:square',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'dash:dash-gap',
        'path:open',
        'path:closed',
        'paint:solid',
        'channel:render',
        'channel:hit-export'
      ],
      geometryScenario: ['straight-segment', 'convex-closed-polygon'],
      productFamily: [
        'center-solid-product',
        'center-dashed-product',
        'final-face-product',
        'render-entry-product',
        'hit-export-product'
      ],
      ownerStages: [
        'Stroke Geometry center product assembly',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization',
        'Product Output hit/export projection',
        'Product Output renderer projection'
      ],
      stepIds: [
        'build-center-stroke-products',
        'build-final-faces',
        'emit-render-hit-export-packets',
        'render-entries',
        'renderer-projection',
        'hit-export'
      ],
      inspectorStepRefs: [
        'build-center-stroke-products',
        'build-final-faces',
        'emit-render-hit-export-packets',
        'render-entries',
        'renderer-projection',
        'hit-export'
      ],
      routeIds: [
        'canonical-final-face-render-entry',
        'descriptor-output-versus-canonical-packet-output',
        'hit-export-channel-packet-projection',
        'render-projection-merge'
      ],
      artifactIds: [
        'artifact:finalFaces',
        'artifact:renderEntries',
        'artifact:hitExportPackets',
        'stage:renderer-projection'
      ],
      requiredArtifacts: [
        'artifact:finalFaces',
        'artifact:renderEntries',
        'artifact:hitExportPackets',
        'stage:renderer-projection'
      ],
      specRuleRefs: [
        spec('supported-stroke-feature-surface'),
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation'),
        spec('computation-ownership-and-timing-contract')
      ],
      dimensions: [
        'center',
        'solid',
        'dashed',
        'butt-cap',
        'round-cap',
        'square-cap',
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'visible-render-channel',
        'hit-export-channel'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'render-channel-declaration',
        'hit-export-sibling-channel',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('center-slice-acceptance.test.ts')],
      testNames: [
        'accepts center solid and dashed open and closed products through final face, render entry, and renderer projection channels'
      ],
      positiveAssertions: [
        'Center solid and dashed products keep center ownership from product packets through final faces, render entries, renderer projection, and hit/export sibling packets.',
        'Renderer projection consumes declared render entries and does not mutate stroke metadata.'
      ],
      forbiddenContributors: [
        'inside/outside legal mask',
        'diagnostic/helper visible geometry',
        'renderer-local join repair',
        'renderer-local cap repair',
        'legacy dash parameter fields'
      ]
    },
    {
      id: 'constrained-solid-doubled-center-product',
      title:
        'Constrained solid products use doubled authored center product before legality clipping',
      caseKind: 'positive-contract',
      coverageStrategy: 'pairwise-baseline',
      strokeParameters: [
        'position:inside',
        'position:outside',
        'style:solid',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'path:closed',
        'legality:pre',
        'legality:post'
      ],
      geometryScenario: [
        'convex-closed-polygon',
        'closed-self-intersecting',
        'concave-closed-polygon',
        'tiny-sliver-domain'
      ],
      productFamily: ['constrained-solid-product'],
      ownerStages: [
        'Stroke Geometry constrained solid product assembly',
        'Stroke Geometry legality clipping'
      ],
      stepIds: ['build-constrained-solid-products', 'apply-legality'],
      inspectorStepRefs: ['build-constrained-solid-products', 'apply-legality'],
      routeIds: [
        'constrained-solid-doubled-center-mask',
        'legality-product-unit-clipping'
      ],
      artifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:postLegalityProductUnits',
        'artifact:legalityEquivalentProductUnits'
      ],
      requiredArtifacts: [
        'artifact:preLegalityProductUnits',
        'artifact:postLegalityProductUnits'
      ],
      specRuleRefs: [
        spec('asyra-stroke-construction-baseline'),
        spec('product-legality-and-descriptor-encoding')
      ],
      dimensions: [
        'inside',
        'outside',
        'solid',
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'pre-legality-product',
        'post-legality-product'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'local-join-envelope',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('constrained-product-family-oracle.test.ts')],
      testNames: [
        'builds constrained solid products from doubled authored center stroke before legality clipping'
      ],
      positiveAssertions: [
        'The product unit declares doubled authored center stroke as the geometry basis before legality clipping.'
      ],
      forbiddenContributors: [
        'strokePathGroups',
        'descriptorProductPolygons',
        'strokeMaskPolygons'
      ]
    },
    {
      id: 'legality-clipping-independent-wrong-side-oracle',
      title:
        'Legality clipping rejects inside, outside, and self-intersection wrong-side product leaks with independent source-domain samples',
      caseKind: 'forbidden-contributor',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'position:inside',
        'position:outside',
        'style:dashed',
        'path:closed',
        'path:self-intersecting',
        'legality:pre',
        'legality:post',
        'channel:render'
      ],
      geometryScenario: [
        'convex-closed-polygon',
        'concave-closed-polygon',
        'closed-self-intersecting'
      ],
      productFamily: [
        'constrained-dashed-product',
        'final-face-product',
        'render-entry-product'
      ],
      ownerStages: [
        'Stroke Geometry legality clipping',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization'
      ],
      stepIds: ['apply-legality', 'build-final-faces', 'render-entries'],
      inspectorStepRefs: [
        'apply-legality',
        'build-final-faces',
        'render-entries'
      ],
      routeIds: [
        'legality-product-unit-clipping',
        'canonical-final-face-render-entry'
      ],
      artifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:postLegalityProductUnits',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      requiredArtifacts: [
        'artifact:postLegalityProductUnits',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      specRuleRefs: [
        spec('domain-mode-and-legal-side-resolution'),
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation')
      ],
      dimensions: [
        'inside',
        'outside',
        'dashed',
        'legal-side-clipping',
        'post-legality-product',
        'visible-render-channel'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'legal-side-wrong-side-rejection',
        'render-channel-declaration',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('legality-clipping-runtime-oracle.test.ts')],
      testNames: [
        'rejects synthetic inside, outside, and self-intersection wrong-side leak polygons with an independent source-domain sampler',
        'clips constrained inside/outside dashed products against legal domains without wrong-side product samples'
      ],
      positiveAssertions: [
        'Every emitted post-legality product polygon sample remains on the declared inside or outside legal side, including closed self-intersection cases.',
        'The negative sampler fails synthetic wrong-side leak polygons without consulting clipped-product metadata.'
      ],
      forbiddenContributors: [
        'inside-domain leak',
        'outside-domain leak',
        'self-intersection wrong-side leak',
        'diagnostic/helper geometry as visible product'
      ]
    },
    {
      id: 'constrained-dashed-product-owner-classes',
      title:
        'Constrained dashed product units keep dash body, terminal body, smooth continuity, and source-vertex ownership separate',
      caseKind: 'positive-contract',
      coverageStrategy: 'pairwise-baseline',
      strokeParameters: [
        'position:outside',
        'style:dashed',
        'cap:butt',
        'dash:dash-gap',
        'dash:terminal-half-dash',
        'path:closed',
        'path:dangling-branch',
        'legality:pre',
        'smooth:high-curvature-non-join'
      ],
      geometryScenario: [
        'straight-segment',
        'closed-self-intersecting',
        'open-dangling-self-intersecting',
        'short-dash-collapse',
        'smooth-cubic-high-curvature'
      ],
      productFamily: [
        'constrained-dashed-product',
        'dash-interval-body-product',
        'terminal-body-product',
        'smooth-continuity-product'
      ],
      ownerStages: [
        'Stroke Geometry dashed interval body assembly',
        'Stroke Geometry terminal body assembly',
        'Stroke Geometry smooth-continuity product assembly'
      ],
      stepIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      routeIds: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'constrained-dashed-join-owned-terminal-body-product',
        'constrained-dashed-smooth-continuity-product'
      ],
      artifactIds: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-smooth-continuity-product',
        'artifact:constrained-dashed-product-units'
      ],
      requiredArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-smooth-continuity-product'
      ],
      specRuleRefs: [
        spec('dash-body-and-join-seam-contract'),
        spec('cap-and-terminal-terminology'),
        spec('smooth-curvature-non-join-contract')
      ],
      dimensions: [
        'outside',
        'dashed',
        'dash-terminal',
        'pre-legality-product',
        'smooth-high-curvature-anchor'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'smooth-continuity-non-join',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('constrained-product-family-oracle.test.ts')],
      testNames: [
        'keeps dash bodies, terminal bodies, and smooth-continuity products in separate owner classes'
      ],
      positiveAssertions: [
        'Each constrained dashed product class preserves its own visibleContributor and ownerStage.'
      ],
      forbiddenContributors: [
        'bridge',
        'source-vertex-join ownership on dash body or smooth continuity products'
      ]
    },
    {
      id: 'constrained-dashed-collapse-provenance',
      title:
        'Constrained inside dashed tiny-domain collapse remains dashed interval product provenance',
      caseKind: 'edge-condition',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'position:inside',
        'style:dashed',
        'cap:round',
        'dash:dash-gap',
        'dash:short-span-collapse',
        'path:closed',
        'legality:pre'
      ],
      geometryScenario: ['tiny-sliver-domain', 'short-dash-collapse'],
      productFamily: [
        'constrained-dashed-product',
        'dash-interval-body-product'
      ],
      ownerStages: ['Stroke Geometry dashed interval body assembly'],
      stepIds: ['allocate-dash-intervals', 'build-dash-interval-body-products'],
      inspectorStepRefs: [
        'allocate-dash-intervals',
        'build-dash-interval-body-products'
      ],
      routeIds: ['constrained-dashed-interval-body-product'],
      artifactIds: [
        'artifact:dash-product-interval',
        'artifact:constrained-dashed-interval-body-product'
      ],
      requiredArtifacts: [
        'artifact:dash-product-interval',
        'artifact:constrained-dashed-interval-body-product'
      ],
      specRuleRefs: [
        spec('inside-dashed-tiny-domain-collapse'),
        spec('dash-body-and-join-seam-contract')
      ],
      dimensions: ['inside', 'dashed', 'dash-terminal', 'pre-legality-product'],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'cap-terminal-ownership',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('constrained-product-family-oracle.test.ts')],
      testNames: [
        'keeps collapsed constrained dashed spans as dashed interval provenance instead of solid substitute output'
      ],
      positiveAssertions: [
        'Collapsed constrained spans keep DashProductInterval split-range, source-distance, terminal-role, domain-mode, legal-side, and product owner metadata.'
      ],
      forbiddenContributors: [
        'solid substitute output',
        'generic canonical geometry',
        'downstream gap redistribution'
      ]
    },
    {
      id: 'outside-dashed-legal-compressed-overlap',
      title:
        'Outside dashed legal compressed overlap preserves provenance and single-composite render output',
      caseKind: 'edge-condition',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'position:outside',
        'style:dashed',
        'dash:dash-gap',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'path:closed',
        'channel:render',
        'legality:post'
      ],
      geometryScenario: ['ordinary-acute-vertex', 'closed-self-intersecting'],
      productFamily: [
        'constrained-dashed-product',
        'final-face-product',
        'render-entry-product'
      ],
      ownerStages: [
        'Stroke Geometry dashed interval body assembly',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization',
        'Product Output renderer projection'
      ],
      stepIds: [
        'build-dash-interval-body-products',
        'build-final-faces',
        'render-entries',
        'renderer-projection'
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-final-faces',
        'render-entries',
        'renderer-projection'
      ],
      routeIds: [
        'constrained-dashed-interval-body-product',
        'canonical-final-face-render-entry',
        'render-projection-merge'
      ],
      artifactIds: [
        'artifact:constrained-dashed-product-units',
        'artifact:finalFaces',
        'artifact:renderEntries',
        'stage:renderer-projection'
      ],
      requiredArtifacts: [
        'artifact:constrained-dashed-product-units',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      specRuleRefs: [
        spec('outside-dashed-legal-compressed-overlap'),
        spec('output-channel-separation')
      ],
      dimensions: [
        'outside',
        'dashed',
        'post-legality-product',
        'visible-render-channel'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'owner-stage-metadata',
        'render-channel-declaration',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('ordinary-sharp-runtime-oracle.test.ts')],
      testNames: [
        'keeps ordinary sharp outside dashed render entries on canonical survivor ownership'
      ],
      positiveAssertions: [
        'Outside dashed render entries preserve valid DashProductInterval ownership and same-paint overlap is emitted as a single-composite render decision before renderer projection.'
      ],
      forbiddenContributors: [
        'helper closure as visible overlap contributor',
        'source-path replay as compressed-overlap contributor',
        'repeated-alpha same-paint overdraw'
      ]
    },
    {
      id: 'source-vertex-join-resolution-matrix',
      title:
        'Source-vertex join products resolve authored join semantics from source-domain angle evidence',
      caseKind: 'edge-condition',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'join:resolved-miter',
        'join:resolved-bevel',
        'join:resolved-round',
        'join:resolved-bevel-by-miter-angle',
        'miter:threshold-provenance',
        'seam:dash-join-continuity'
      ],
      geometryScenario: [
        'ordinary-acute-vertex',
        'high-acute-vertex',
        'obtuse-vertex',
        'near-collinear-vertex'
      ],
      productFamily: ['source-vertex-join-product'],
      ownerStages: ['Stroke Geometry source-vertex join assembly'],
      stepIds: ['build-source-vertex-join-products'],
      inspectorStepRefs: ['build-source-vertex-join-products'],
      routeIds: [
        'center-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-dashed-source-vertex-join-product'
      ],
      artifactIds: ['artifact:constrained-dashed-source-vertex-join-product'],
      requiredArtifacts: [
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      specRuleRefs: [
        spec('asyra-join-resolution-baseline'),
        spec('source-domain-angle-evidence'),
        spec('miter-terminology-and-descriptor-adapter-fields')
      ],
      dimensions: [
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'resolved-miter',
        'resolved-bevel',
        'resolved-round',
        'resolved-bevel-by-miter-angle',
        'ordinary-sharp-vertex',
        'high-acute-vertex'
      ],
      requiredGeometryAssertions: [
        'local-join-envelope',
        'theoretical-miter-apex',
        'miter-threshold-provenance',
        'dash-join-seam-continuity',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [
        oracle('join-dash-product-oracle.test.ts'),
        oracle('ordinary-sharp-runtime-oracle.test.ts'),
        oracle('reported-vector-34-runtime-oracle.test.ts'),
        oracle('stroke-parameter-matrix-oracle.test.ts'),
        oracle('stroke-geometry-oracle-matrix.test.ts')
      ],
      testNames: [
        'resolves miter-angle equality and epsilon-band cases to bevel-by-miter-angle only from source-domain evidence',
        'keeps a resolved outside dashed miter apex at the theoretical source-domain offset intersection',
        'keeps a reference outside dashed bevel chord on the incident dash outer endpoints',
        'keeps constrained outside dashed miter, bevel, and round source-vertex footprints distinct in runtime product artifacts',
        'distinguishes miter, bevel, and round footprints on ordinary acute joins while keeping seam endpoints on the canonical footprint',
        'asserts ordinary acute, high acute, obtuse, near-collinear, and degenerate join envelopes through shared oracle helpers',
        'keeps join footprints distinct when join is the changed parameter'
      ],
      positiveAssertions: [
        'Authored miter preserves miter provenance even when it resolves to bevel-by-miter-angle.',
        'Exact equality and epsilon-band comparisons resolve to bevel-by-miter-angle using source-domain evidence.',
        'Resolved miter preserves the theoretical source-domain offset-line apex instead of capping it with a local probe window.',
        'Authored bevel connects the incident dash body outer boundary endpoints instead of shrinking to an interior chord.',
        'Ordinary sharp joins keep miter, bevel, and round footprints distinct.'
      ],
      forbiddenContributors: [
        'masked visible polygon angle',
        'authored bevel collapse for bevel-by-miter-angle',
        'renderer stroke join ownership'
      ]
    },
    {
      id: 'dash-body-source-vertex-seam',
      title:
        'Dash interval body products and source-vertex join products share explicit seam boundaries',
      caseKind: 'edge-condition',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'style:dashed',
        'dash:dash-gap',
        'dash:terminal-half-dash',
        'cap:butt',
        'seam:dash-join-continuity'
      ],
      geometryScenario: [
        'ordinary-acute-vertex',
        'high-acute-vertex',
        'short-dash-collapse'
      ],
      productFamily: [
        'dash-interval-body-product',
        'source-vertex-join-product',
        'final-face-product',
        'render-entry-product'
      ],
      ownerStages: [
        'Stroke Geometry dashed interval body assembly',
        'Stroke Geometry source-vertex join assembly',
        'Stroke Geometry legality clipping',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization'
      ],
      stepIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'apply-legality',
        'build-final-faces',
        'render-entries'
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'apply-legality',
        'build-final-faces',
        'render-entries'
      ],
      routeIds: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'legality-product-unit-clipping',
        'canonical-final-face-render-entry'
      ],
      artifactIds: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:legalityEquivalentProductUnits',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      requiredArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:legalityEquivalentProductUnits',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      specRuleRefs: [
        spec('dash-body-and-join-seam-contract'),
        spec('computation-ownership-and-timing-contract'),
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation'),
        spec('local-composition-caps-and-joins')
      ],
      dimensions: [
        'dashed',
        'dash-join-seam',
        'pre-legality-product',
        'post-legality-product',
        'visible-render-channel'
      ],
      requiredGeometryAssertions: [
        'dash-join-seam-continuity',
        'owner-stage-metadata',
        'legal-side-wrong-side-rejection',
        'render-channel-declaration',
        'forbidden-contributor-absence'
      ],
      testFiles: [
        oracle('join-dash-product-oracle.test.ts'),
        oracle('ordinary-sharp-runtime-oracle.test.ts'),
        oracle('reported-vector-34-runtime-oracle.test.ts')
      ],
      testNames: [
        'keeps dash bodies and source-vertex joins seam-compatible without duplicate interval paint',
        'keeps outside dashed source-space artifacts independent of viewport zoom',
        'rejects outside dashed dash-body strips, wrong-side fill coverage, and undersized source-vertex seam endpoints',
        'connects reported sharp source-vertex joins to incident dash bodies without seam gaps',
        'rejects repeated-alpha same-paint overdraw on reported outside dashed render entries',
        'rejects internal shared-boundary render polygons on reported outside dashed render entries'
      ],
      positiveAssertions: [
        'Source-vertex join products share the same Step 27 seam endpoint identities as incident dash body seams; visible source-space seam gap is zero.',
        'Source-vertex join products and final faces share the full Step 27 terminal-to-outer-endpoint seam edge, not only the outer endpoint.',
        'Step 27 terminal seam evidence preserves the full inner-to-outer stroke-width edge before Step 28 source-vertex join consumption.',
        'Step 38 render entries either preserve the seam edge or declare a single-paint render-projection merge that keeps seam endpoint/midpoint coverage provenance without repeated-alpha overdraw.',
        'Step 38 same-paint render entries with shared or near-shared source-space boundaries are merged before renderer projection to prevent high-zoom antialias seams.',
        'Step 38 same-paint render entries do not carry internally shared-boundary polygons into renderer projection; touching products are fused into canonical projection polygons while disjoint dash products remain separate.',
        'Outside dashed dash interval products keep continuous source-span cross-section coverage through packets, final faces, and render entries.',
        'Step 27 seam artifacts, Step 28 source-vertex joins, Step 32 resolved packets, Step 35 final faces, and Step 38 render entries keep identical source-space product signatures across viewport zoom states.'
      ],
      forbiddenContributors: [
        'duplicate interval paint',
        'endpoint cap seam repair',
        'terminal bridge seam repair',
        'repeated-alpha same-paint overdraw',
        'parallel strip dash body fragments',
        'filled-domain wrong-side outside coverage'
      ]
    },
    {
      id: 'cap-terminal-dash-policy',
      title:
        'Dash terminal and cap products stay terminal-owned and cannot become join repair',
      caseKind: 'forbidden-contributor',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'style:dashed',
        'cap:butt',
        'cap:round',
        'cap:square',
        'dash:terminal-half-dash',
        'seam:dash-join-continuity'
      ],
      geometryScenario: [
        'straight-segment',
        'ordinary-acute-vertex',
        'short-dash-collapse'
      ],
      productFamily: [
        'dash-interval-body-product',
        'terminal-body-product',
        'source-vertex-join-product'
      ],
      ownerStages: [
        'Stroke Geometry dashed interval body assembly',
        'Stroke Geometry terminal body assembly',
        'Stroke Geometry source-vertex join assembly'
      ],
      stepIds: [
        'build-dash-interval-body-products',
        'build-terminal-body-products',
        'build-source-vertex-join-products'
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-terminal-body-products',
        'build-source-vertex-join-products'
      ],
      routeIds: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-join-owned-terminal-body-product',
        'constrained-dashed-source-vertex-join-product'
      ],
      artifactIds: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      requiredArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      specRuleRefs: [
        spec('cap-and-terminal-terminology'),
        spec('dash-body-and-join-seam-contract'),
        spec('ownership-arbitration-and-same-paint-union')
      ],
      dimensions: [
        'butt-cap',
        'round-cap',
        'square-cap',
        'dash-terminal',
        'dash-join-seam',
        'pre-legality-product'
      ],
      requiredGeometryAssertions: [
        'cap-terminal-ownership',
        'dash-join-seam-continuity',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('cap-terminal-channel-oracle.test.ts')],
      testNames: [
        'declares cap ownership on dash and terminal products without turning caps into join repair'
      ],
      positiveAssertions: [
        'Cap contributors appear only as body-side cap evidence for dash or terminal body products.',
        'Source-vertex join seam evidence may record cap suppression without becoming a cap primitive.'
      ],
      forbiddenContributors: [
        'source-vertex cap primitive',
        'join-owned terminal bridge',
        'cap repair at authored sharp vertex'
      ]
    },
    {
      id: 'smooth-continuity-non-join',
      title:
        'Smooth high-curvature spans stay smooth-continuity products instead of source-vertex joins',
      caseKind: 'forbidden-contributor',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'style:dashed',
        'join:authored-round',
        'path:closed',
        'smooth:high-curvature-non-join'
      ],
      geometryScenario: ['smooth-cubic-high-curvature'],
      productFamily: ['smooth-continuity-product'],
      ownerStages: ['Stroke Geometry smooth-continuity product assembly'],
      stepIds: [
        'build-source-vertex-join-products',
        'build-smooth-continuity-products'
      ],
      inspectorStepRefs: [
        'build-source-vertex-join-products',
        'build-smooth-continuity-products'
      ],
      routeIds: [
        'constrained-dashed-smooth-continuity-product',
        'smooth-continuity-products-canonical-output-else'
      ],
      artifactIds: ['artifact:constrained-dashed-smooth-continuity-product'],
      requiredArtifacts: [
        'artifact:constrained-dashed-smooth-continuity-product'
      ],
      specRuleRefs: [spec('smooth-curvature-non-join-contract')],
      dimensions: [
        'dashed',
        'smooth-high-curvature-anchor',
        'pre-legality-product'
      ],
      requiredGeometryAssertions: [
        'smooth-continuity-non-join',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [
        oracle('join-dash-product-oracle.test.ts'),
        oracle('reported-vector-34-runtime-oracle.test.ts')
      ],
      testNames: [
        'routes high-curvature smooth continuity away from source-vertex join products',
        'keeps smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output'
      ],
      positiveAssertions: [
        'High-curvature tangent-continuous spans emit smooth products or smooth descriptors, not sharp joins.'
      ],
      forbiddenContributors: [
        'source-vertex join ownership for smooth anchors',
        'fragmented smooth-continuity strips'
      ]
    },
    {
      id: 'descriptor-final-face-channel-separation',
      title:
        'Descriptor materialization, final faces, render entries, hit/export, and diagnostics stay channel-separated',
      caseKind: 'channel-separation',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'channel:descriptor',
        'channel:render',
        'channel:hit-export',
        'channel:diagnostics',
        'legality:post'
      ],
      geometryScenario: ['straight-segment', 'non-geometry-state-change'],
      productFamily: [
        'descriptor-product',
        'final-face-product',
        'render-entry-product',
        'hit-export-product',
        'diagnostic-evidence'
      ],
      ownerStages: [
        'Stroke Geometry final face assembly',
        'Product Output descriptor materialization',
        'Product Output render-entry materialization',
        'Product Output hit/export projection',
        'Diagnostics runtime evidence channels'
      ],
      stepIds: [
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export',
        'runtime-diagnostics'
      ],
      inspectorStepRefs: [
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export',
        'runtime-diagnostics'
      ],
      routeIds: [
        'constrained-dashed-descriptor-materialization',
        'canonical-final-face-render-entry',
        'descriptor-output-versus-canonical-packet-output',
        'hit-export-channel-packet-projection',
        'renderer-projection-diagnostics-snapshot',
        'diagnostics-channel-aggregation'
      ],
      artifactIds: [
        'artifact:finalFaces',
        'artifact:renderEntries',
        'artifact:hit-export-packets',
        'artifact:diagnosticSnapshots',
        'channel:hit-export',
        'channel:diagnostics'
      ],
      requiredArtifacts: [
        'artifact:finalFaces',
        'artifact:renderEntries',
        'artifact:hit-export-packets',
        'artifact:diagnosticSnapshots'
      ],
      specRuleRefs: [
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation'),
        spec('descriptor-channel-cache-and-drag-contracts')
      ],
      dimensions: [
        'post-legality-product',
        'descriptor-evidence-channel',
        'visible-render-channel',
        'hit-export-channel',
        'diagnostics-channel'
      ],
      requiredGeometryAssertions: [
        'descriptor-channel-separation',
        'render-channel-declaration',
        'hit-export-sibling-channel',
        'diagnostics-non-visible',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [
        oracle('join-dash-product-oracle.test.ts'),
        oracle('reported-vector-34-runtime-oracle.test.ts'),
        oracle('cap-terminal-channel-oracle.test.ts')
      ],
      testNames: [
        'keeps terminal bodies and descriptor evidence from becoming join or visible-render repair',
        'preserves runtime metadata and prevents renderer descriptor replay from owning sharp join shape',
        'keeps descriptor evidence and final-face channels separated from visible product ownership'
      ],
      positiveAssertions: [
        'Visible descriptor channels are separate from descriptor evidence channels.',
        'Final face metadata stays the source for render, hit/export, and diagnostics sibling channels.'
      ],
      forbiddenContributors: [
        'descriptor evidence promoted to visible product',
        'diagnostic geometry as product source',
        'hit/export dependency on renderer raster output'
      ]
    },
    {
      id: 'degenerate-local-join',
      title:
        'Degenerate local joins remain source-vertex-owned non-renderer products with explicit metadata',
      caseKind: 'degenerate-contract',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'join:authored-miter',
        'join:resolved-degenerate-bevel',
        'miter:threshold-provenance'
      ],
      geometryScenario: ['zero-length-degenerate', 'near-collinear-vertex'],
      productFamily: ['source-vertex-join-product'],
      ownerStages: ['Stroke Geometry source-vertex join assembly'],
      stepIds: ['build-source-vertex-join-products'],
      inspectorStepRefs: ['build-source-vertex-join-products'],
      routeIds: ['constrained-dashed-source-vertex-join-product'],
      artifactIds: ['artifact:constrained-dashed-source-vertex-join-product'],
      requiredArtifacts: [
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      specRuleRefs: [
        spec('asyra-join-resolution-baseline'),
        spec('source-domain-angle-evidence')
      ],
      dimensions: [
        'authored-miter',
        'resolved-degenerate-bevel',
        'ordinary-sharp-vertex',
        'pre-legality-product'
      ],
      requiredGeometryAssertions: [
        'degenerate-local-output',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('cap-terminal-channel-oracle.test.ts')],
      testNames: ['keeps degenerate joins local and non-renderer-owned'],
      positiveAssertions: [
        'Degenerate joins emit source-vertex metadata and no visible polygon when source tangents are invalid.'
      ],
      forbiddenContributors: [
        'renderer fallback join',
        'endpoint cap fallback',
        'bridge fallback'
      ]
    },
    {
      id: 'reported-vector-34-runtime-product-boundary',
      title:
        'Reported vector-34 runtime path preserves canonical product metadata across packets, faces, and render entries',
      caseKind: 'edge-condition',
      coverageStrategy: 'spec-critical-higher-order',
      strokeParameters: [
        'position:outside',
        'style:dashed',
        'cap:butt',
        'join:authored-miter',
        'join:authored-bevel',
        'join:authored-round',
        'join:resolved-miter',
        'join:resolved-bevel',
        'join:resolved-round',
        'dash:dash-gap',
        'path:closed',
        'path:self-intersecting',
        'seam:dash-join-continuity',
        'smooth:high-curvature-non-join',
        'channel:render',
        'channel:hit-export'
      ],
      geometryScenario: [
        'high-acute-vertex',
        'closed-self-intersecting',
        'smooth-cubic-high-curvature'
      ],
      productFamily: [
        'constrained-dashed-product',
        'source-vertex-join-product',
        'dash-interval-body-product',
        'smooth-continuity-product',
        'final-face-product',
        'render-entry-product',
        'hit-export-product'
      ],
      ownerStages: [
        'Stroke Geometry dashed interval body assembly',
        'Stroke Geometry source-vertex join assembly',
        'Stroke Geometry smooth-continuity product assembly',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization',
        'Product Output hit/export projection'
      ],
      stepIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-smooth-continuity-products',
        'build-final-faces',
        'render-entries'
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-smooth-continuity-products',
        'build-final-faces',
        'render-entries'
      ],
      routeIds: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'constrained-dashed-smooth-continuity-product',
        'canonical-final-face-render-entry',
        'render-projection-merge'
      ],
      artifactIds: [
        'artifact:constrained-dashed-product-units',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      requiredArtifacts: [
        'artifact:constrained-dashed-product-units',
        'artifact:finalFaces',
        'artifact:renderEntries'
      ],
      specRuleRefs: [
        spec('dash-body-and-join-seam-contract'),
        spec('local-composition-caps-and-joins'),
        spec('output-channel-separation')
      ],
      dimensions: [
        'outside',
        'dashed',
        'authored-miter',
        'authored-bevel',
        'authored-round',
        'resolved-miter',
        'resolved-bevel',
        'resolved-round',
        'high-acute-vertex',
        'smooth-high-curvature-anchor',
        'dash-join-seam',
        'visible-render-channel',
        'hit-export-channel'
      ],
      requiredGeometryAssertions: [
        'artifact-shape',
        'local-join-envelope',
        'dash-join-seam-continuity',
        'smooth-continuity-non-join',
        'descriptor-channel-separation',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [oracle('reported-vector-34-runtime-oracle.test.ts')],
      testNames: [
        'keeps constrained outside dashed miter, bevel, and round source-vertex footprints distinct in runtime product artifacts',
        'keeps outside dashed source-span and anchor coverage under microscope probes',
        'connects reported sharp source-vertex joins to incident dash bodies without seam gaps',
        'rejects repeated-alpha same-paint overdraw on reported outside dashed render entries',
        'rejects internal shared-boundary render polygons on reported outside dashed render entries',
        'rejects internal shared-boundary render polygons after sequential reported outside dashed join changes',
        'keeps smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output',
        'preserves runtime metadata and prevents renderer descriptor replay from owning sharp join shape'
      ],
      positiveAssertions: [
        'Runtime packets, final faces, and render entries preserve canonical source-vertex join metadata.',
        'Reported vector-34 source-vertex joins consume Step 27 terminal seam edges whose inner-to-outer distance remains the authored stroke width.',
        'Step 38 render-entry materialization keeps shared Step 27 seam coverage visible either as a preserved seam edge or as a declared single-paint render-projection merge with seam coverage provenance.',
        'Reported vector-34 outside dashed render entries do not create repeated-alpha same-paint overdraw across miter, bevel, or round joins.',
        'Reported vector-34 outside dashed render entries do not leave same-paint shared-boundary products split into separate renderer projections.',
        'Reported vector-34 outside dashed render entries do not leave shared-boundary polygons inside the same renderer projection entry.',
        'Reported vector-34 sequential join changes do not leave stale app-route shared-boundary polygons inside render entries.',
        'Every scenario-provided outside dashed anchor and dash span remains source-space continuous under microscope probes across miter, bevel, and round joins.'
      ],
      forbiddenContributors: [
        'source path replay',
        'renderer descriptor replay across authored sharp joins',
        'repeated-alpha same-paint overdraw',
        'fragmented smooth output',
        'comb-like strip gaps',
        'smooth anchor microscope cracks'
      ]
    },
    {
      id: 'bypass-cache-geometry-applicability',
      title:
        'Hidden output, paint-only retint, and verified cache-hit routes are recorded as non-geometry oracle dimensions',
      caseKind: 'channel-separation',
      coverageStrategy: 'pairwise-baseline',
      strokeParameters: [
        'paint:hidden',
        'paint:paint-only',
        'cache:verified-descriptor-hit',
        'channel:render',
        'channel:hit-export',
        'channel:diagnostics',
        'legality:post'
      ],
      geometryScenario: ['non-geometry-state-change'],
      productFamily: ['non-geometry-bypass', 'descriptor-product'],
      ownerStages: [
        'Stage Product Cache',
        'Stroke Geometry final face assembly',
        'Product Output render-entry materialization'
      ],
      stepIds: [
        'stage-product-cache',
        'attach-paint-payload',
        'build-final-faces',
        'emit-render-hit-export-packets'
      ],
      inspectorStepRefs: [
        'stage-product-cache',
        'attach-paint-payload',
        'build-final-faces',
        'emit-render-hit-export-packets'
      ],
      routeIds: [
        'paint-only-cache-retint',
        'hidden-output-cache-bypass',
        'verified-product-descriptor-cache-hit'
      ],
      artifactIds: [
        'dirty:paint-only',
        'dirty:visibility-hidden',
        'cache:paint-retint',
        'cache:verified-product-descriptor',
        'output:hidden-render-packets'
      ],
      requiredArtifacts: [
        'cache:paint-retint',
        'cache:verified-product-descriptor',
        'output:hidden-render-packets'
      ],
      specRuleRefs: [
        spec('descriptor-channel-cache-and-drag-contracts'),
        spec('stroke-parameter-stage-cache-rule')
      ],
      dimensions: [
        'paint-only-not-geometry',
        'hidden-output-not-geometry',
        'cache-hit-not-geometry',
        'post-legality-product'
      ],
      requiredGeometryAssertions: [
        'hidden-output-non-geometry',
        'paint-only-non-geometry',
        'cache-hit-non-geometry',
        'owner-stage-metadata',
        'forbidden-contributor-absence'
      ],
      testFiles: [
        'packages/preset/src/__tests__/stroke-flow-integration/bypass-cache-routes.test.ts'
      ],
      testNames: [
        'routes paint-only changes to paint retint without re-entering geometry stages',
        'routes hidden output to empty packet channels without visible geometry',
        'routes verified descriptor cache hits from final faces through normal output channels'
      ],
      positiveAssertions: [
        'Bypass/cache routes are integration coverage, not product geometry owners.'
      ],
      forbiddenContributors: [
        'geometry rebuild during paint-only retint',
        'visible geometry during hidden output',
        'render-only cache repair'
      ]
    }
  ]
