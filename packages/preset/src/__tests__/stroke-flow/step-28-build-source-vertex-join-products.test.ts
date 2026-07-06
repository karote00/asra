import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildSourceVertexJoinProducts,
  type SourceVertexJoinProductInput
} from '../../components/stroke-render/source-vertex-join-footprint'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
  evidenceRequired: string[]
}

interface InspectorRoute {
  id: string
  consumes: string[]
  cacheKeyInputs: string[]
  evidenceRequired: string[]
  specRuleRefs: string[]
  computationContract?: {
    computedAt: string
    consumesArtifacts: string[]
    producesArtifacts: string[]
    consumedBy: string[]
    mustNotRecomputeAfter: string
    forbiddenLateComputation: string[]
  }
}

interface InspectorData {
  steps: InspectorStep[]
  conditionalRoutes: InspectorRoute[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const sourceVertexJoinSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts'
)
const constrainedDashedSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const extractFrom = (source: string, start: string): string => {
  const startIndex = source.indexOf(start)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  return source.slice(startIndex)
}

const routeById = (data: InspectorData, routeId: string): InspectorRoute => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

const sharpMiterProduct: SourceVertexJoinProductInput = {
  productId: 'join:sharp-miter',
  productFamilyId: 'constrained-dashed',
  sourceVertexId: 'source-vertex:acute',
  joinOwnership: 'source-vertex',
  vertex: { x: 0, y: 0 },
  previousPoint: { x: -10, y: 100 },
  nextPoint: { x: 10, y: 100 },
  strokeWidth: 20,
  side: 'left',
  authoredJoin: 'miter',
  miterAngle: 30,
  ownerId: 'owner:join:acute',
  angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS',
  incidentSeamBoundaries: [
    {
      seamBoundaryId: 'seam:previous',
      intervalId: 'interval:previous',
      splitRangeId: 'split:previous',
      side: 'previous',
      point: { x: -2, y: 20 },
      outerBodyBoundaryEndpoint: { x: -2, y: 20 },
      outerBodyBoundaryVertices: [
        { x: -2, y: 20 },
        { x: -4, y: 16 }
      ],
      bodySideOutlineSegment: [
        { x: -2, y: 20 },
        { x: -4, y: 16 }
      ],
      bodySideTangent: { x: -0.1, y: 0.995 },
      selectedSide: 'left',
      terminalRole: 'end',
      endpointCapPolicySignature: 'end:start-cap:end-flat',
      capSuppressed: true,
      sourceSegmentIndex: 3
    },
    {
      seamBoundaryId: 'seam:next',
      intervalId: 'interval:next',
      splitRangeId: 'split:next',
      side: 'next',
      point: { x: 2, y: 20 },
      outerBodyBoundaryEndpoint: { x: 2, y: 20 },
      outerBodyBoundaryVertices: [
        { x: 2, y: 20 },
        { x: 4, y: 16 }
      ],
      bodySideOutlineSegment: [
        { x: 2, y: 20 },
        { x: 4, y: 16 }
      ],
      bodySideTangent: { x: 0.1, y: 0.995 },
      selectedSide: 'left',
      terminalRole: 'start',
      endpointCapPolicySignature: 'start:start-flat:end-cap',
      capSuppressed: true,
      sourceSegmentIndex: 4
    }
  ]
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const dot = (
  first: { x: number; y: number },
  second: { x: number; y: number }
) => first.x * second.x + first.y * second.y

const subtract = (
  first: { x: number; y: number },
  second: { x: number; y: number }
) => ({
  x: first.x - second.x,
  y: first.y - second.y
})

const normalize = (vector: { x: number; y: number }) => {
  const length = Math.hypot(vector.x, vector.y)
  return length > 0
    ? {
        x: vector.x / length,
        y: vector.y / length
      }
    : null
}

const getIncidentSeamDeficit = (
  product: ReturnType<typeof buildSourceVertexJoinProducts>[number],
  seamBoundary: NonNullable<
    SourceVertexJoinProductInput['incidentSeamBoundaries']
  >[number]
) => {
  const tangent =
    seamBoundary.side === 'previous'
      ? normalize(subtract(sharpMiterProduct.previousPoint, sharpMiterProduct.vertex))
      : normalize(subtract(sharpMiterProduct.nextPoint, sharpMiterProduct.vertex))
  expect(tangent).not.toBeNull()
  const seamExtent = distance(sharpMiterProduct.vertex, seamBoundary.point)
  const points = product.polygons.flat()
  const maxJoinReach = Math.max(
    0,
    ...points.map((point) => dot(subtract(point, sharpMiterProduct.vertex), tangent!))
  )
  return seamExtent - maxJoinReach
}

const productEdgeConnects = (
  product: ReturnType<typeof buildSourceVertexJoinProducts>[number],
  firstEndpoint: { x: number; y: number },
  secondEndpoint: { x: number; y: number },
  tolerance = 0.001
) =>
  product.polygons.some((polygon) =>
    polygon.some((point, index) => {
      const nextPoint = polygon[(index + 1) % polygon.length]
      if (!nextPoint) {
        return false
      }
      const forward =
        distance(point, firstEndpoint) <= tolerance &&
        distance(nextPoint, secondEndpoint) <= tolerance
      const reverse =
        distance(point, secondEndpoint) <= tolerance &&
        distance(nextPoint, firstEndpoint) <= tolerance
      return forward || reverse
    })
  )

const expectSourceVertexJoinProductOnly = (record: unknown) => {
  const text = JSON.stringify(record, (key, value) =>
    key === 'seamEvidence' ? undefined : value
  )
  for (const forbiddenField of [
    'endpointCap',
    'capContributors',
    'terminalBody',
    'terminalOverhang',
    'join-owned-terminal-body',
    'sourcePathReplay',
    'aggregate-source-path',
    'strokePathStyle',
    'renderEntries',
    'finalFaces',
    'strokeMaskPolygons',
    'fillClipPolygons',
    'diagnosticGeometry'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 28: build-source-vertex-join-products', () => {
  it('keeps build-source-vertex-join-products as the current or verified twenty-eighth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-source-vertex-join-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-source-vertex-join-products'
      ])
    }
  })

  it('declares the exact source-vertex join implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-source-vertex-join-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      allowedInputs: [
        'authored source vertex or split terminal',
        'previous/next source-domain tangents',
        'authored join and miter angle',
        'Step 27 verified incident dash body seam boundaries when dashed'
      ],
      requiredOutputs: [
        'pre-legality source-vertex join products with join resolution metadata'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'endpoint cap at authored vertex',
        'terminal body overhang',
        'aggregate source-path replay',
        'visible dash/join seam gap',
        'diagnostic/helper visible geometry'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'incident dash body seam boundary ids',
        'incident outer body boundary endpoint ids',
        'proof that every consumed seam boundary endpoint id is emitted by the Step 27 dash body product polygon boundary'
      ])
    )
  })

  it('declares Step 28 as the only join resolver that consumes dash seam boundaries', () => {
    const data = loadInspectorData()
    const route = routeById(
      data,
      'constrained-dashed-source-vertex-join-product'
    )

    expect(route.consumes).toEqual(
      expect.arrayContaining([
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(route.cacheKeyInputs).toContain(
      'dash body seam boundary signature'
    )
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'incident dash body seam boundary ids',
        'incident outer body boundary endpoint ids',
        'bevel and bevel-by-miter-angle cut-off edge endpoint ids from incident dash body outer boundaries',
        'proof that every consumed seam boundary endpoint id is emitted by the Step 27 dash body product polygon boundary',
        'proof that dash and join visible triangles share the same Step 27 seam endpoint identities'
      ])
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'build-source-vertex-join-products',
      consumesArtifacts: [
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      producesArtifacts: [
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      consumedBy: ['apply-legality', 'build-final-faces', 'render-entries'],
      mustNotRecomputeAfter: 'apply-legality'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'vertexAngle from visible product footprint',
        'bevel cut-off endpoint relocation',
        'incident dash seam boundary reinterpretation',
        'renderer join ownership'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('builds pre-legality miter-family join products from source-domain tangents and seam evidence', () => {
    const products = buildSourceVertexJoinProducts({
      joins: [sharpMiterProduct]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      productId: 'join:sharp-miter',
      productFamilyId: 'constrained-dashed',
      productMode: 'pre-legality-source-vertex-join',
      sourceVertexId: 'source-vertex:acute',
      ownerId: 'owner:join:acute',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      authoredJoin: 'miter',
      resolvedJoin: 'bevel-by-miter-angle',
      miterAngle: 30,
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS',
      seamEvidence: {
        seamCoveragePolicy: 'shared-step-27-endpoint-identity',
        incidentSeamBoundaries: sharpMiterProduct.incidentSeamBoundaries
      }
    })
    expect(products[0].vertexAngle).toBeLessThanOrEqual(30)
    expect(products[0].angleComparison).toMatchObject({
      operator: '<=',
      result: true
    })
    expect(products[0].polygon.length).toBe(4)
    expect(products[0].polygons).toEqual([products[0].polygon])
    for (const seamBoundary of sharpMiterProduct.incidentSeamBoundaries ?? []) {
      expect(
        products[0].polygon.some(
          (point) =>
            distance(point, seamBoundary.outerBodyBoundaryEndpoint) <= 0.001
        ),
        `${seamBoundary.seamBoundaryId} Step 27 seam endpoint must be part of the visible join polygon`
      ).toBe(true)
    }
    expectSourceVertexJoinProductOnly(products)
  })

  it('keeps width, join type, miter angle, and dashed seam evidence as join-product inputs only', () => {
    const narrow = buildSourceVertexJoinProducts({
      joins: [sharpMiterProduct]
    })[0]
    const wide = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:wide',
          strokeWidth: sharpMiterProduct.strokeWidth * 2
        }
      ]
    })[0]
    const resolvedMiter = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:resolved-miter',
          miterAngle: 5
        }
      ]
    })[0]

    expect(wide.seamEvidence).toMatchObject(narrow.seamEvidence)
    const noSeamNarrow = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:no-seam-narrow',
          incidentSeamBoundaries: []
        }
      ]
    })[0]
    const noSeamWide = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:no-seam-wide',
          strokeWidth: sharpMiterProduct.strokeWidth * 2,
          incidentSeamBoundaries: []
        }
      ]
    })[0]
    expect(
      distance(noSeamWide.previousOffsetEndpoint, sharpMiterProduct.vertex)
    ).toBeGreaterThan(
      distance(noSeamNarrow.previousOffsetEndpoint, sharpMiterProduct.vertex)
    )
    expect(resolvedMiter).toMatchObject({
      authoredJoin: 'miter',
      resolvedJoin: 'miter',
      miterAngle: 5,
      angleComparison: {
        operator: '>',
        result: true
      }
    })
    expect(narrow.seamEvidence).toMatchObject({
      seamCoveragePolicy: 'shared-step-27-endpoint-identity',
      incidentSeamBoundaries: sharpMiterProduct.incidentSeamBoundaries
    })
    const serialized = JSON.stringify([narrow, wide, resolvedMiter])
    for (const forbiddenField of [
      '"dash"',
      '"gap"',
      'style',
      'fill',
      'color',
      'opacity',
      'paintKey',
      'strokePathStyle',
      'renderer'
    ]) {
      expect(serialized).not.toContain(forbiddenField)
    }
  })

  it('does not let renderer or backend miterLimit collapse source-domain miter resolution', () => {
    const [semanticMiter] = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:miter-limit-poisoned',
          miterAngle: 5,
          miterLimit: 1
        } as SourceVertexJoinProductInput
      ]
    })

    expect(semanticMiter).toMatchObject({
      authoredJoin: 'miter',
      resolvedJoin: 'miter',
      miterAngle: 5,
      angleComparison: {
        operator: '>',
        result: true,
        epsilon: 0.000001
      }
    })
    expect(JSON.stringify(semanticMiter)).not.toContain('miterLimit')
  })

  it('does not apply miterLimit or terminal extent collapse after source-domain miter resolution', () => {
    const sourceVertexJoinSource = readFileSync(
      sourceVertexJoinSourcePath,
      'utf8'
    )
    const constrainedDashedSource = readFileSync(
      constrainedDashedSourcePath,
      'utf8'
    )

    expect(sourceVertexJoinSource).not.toContain('resolveMiterLimit')
    expect(constrainedDashedSource).not.toContain(
      'SOURCE_VERTEX_MITER_LIMIT_FALLBACK_RATIO_TOLERANCE'
    )
    expect(constrainedDashedSource).not.toContain(
      'isSourceVertexMiterWithinLimit'
    )
    expect(constrainedDashedSource).not.toContain(
      'isSourceVertexPlanMiterWithinLimit'
    )
    expect(constrainedDashedSource).not.toContain(
      'isSourceVertexMiterWithinTerminalExtents(joinPoint, plan)'
    )
  })

  it('preserves authored bevel and round as distinct source-vertex join products', () => {
    const bevel = {
      ...sharpMiterProduct,
      productId: 'join:bevel',
      authoredJoin: 'bevel' as const,
      ownerId: 'owner:join:bevel'
    }
    const round = {
      ...sharpMiterProduct,
      productId: 'join:round',
      authoredJoin: 'round' as const,
      ownerId: 'owner:join:round'
    }

    const products = buildSourceVertexJoinProducts({
      joins: [bevel, round]
    })

    expect(products.map((product) => product.resolvedJoin)).toEqual([
      'bevel',
      'round'
    ])
    expect(products[0]).toMatchObject({
      authoredJoin: 'bevel',
      resolvedJoin: 'bevel',
      visibleContributor: 'source-vertex-join'
    })
    expect(products[0].polygon.length).toBe(4)
    expect(products[1]).toMatchObject({
      authoredJoin: 'round',
      resolvedJoin: 'round',
      visibleContributor: 'source-vertex-join'
    })
    expect(products[1].polygon.length).toBeGreaterThan(3)
    expect(
      products[1].polygon.some(
        (point) => distance(point, sharpMiterProduct.vertex) <= 0.001
      ),
      `round source-vertex join must use Step 27 seam endpoints instead of closing through the authored source vertex: ${JSON.stringify(
        products[1].polygon,
        null,
        2
      )}`
    ).toBe(false)
    for (const seamBoundary of sharpMiterProduct.incidentSeamBoundaries ?? []) {
      expect(
        products[1].polygon.some(
          (point) =>
            distance(point, seamBoundary.outerBodyBoundaryEndpoint) <= 0.001
        ),
        `${seamBoundary.seamBoundaryId} Step 27 outer boundary endpoint must be part of the round join polygon`
      ).toBe(true)
    }
    expectSourceVertexJoinProductOnly(products)
  })

  it('places bevel cut-off on incident dash body outer endpoints instead of an inward selected-side chord', () => {
    const previousOuterEndpoint = { x: -12, y: 20 }
    const nextOuterEndpoint = { x: 12, y: 20 }
    const previousInwardEndpoint = { x: -2, y: 20 }
    const nextInwardEndpoint = { x: 2, y: 20 }
    const product = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:bevel-outer-endpoints',
          authoredJoin: 'bevel',
          incidentSeamBoundaries: [
            {
              ...sharpMiterProduct.incidentSeamBoundaries![0],
              outerBodyBoundaryEndpoint: previousOuterEndpoint,
              outerBodyBoundaryVertices: [
                previousOuterEndpoint,
                previousInwardEndpoint
              ],
              bodySideOutlineSegment: [
                previousOuterEndpoint,
                previousInwardEndpoint
              ]
            },
            {
              ...sharpMiterProduct.incidentSeamBoundaries![1],
              outerBodyBoundaryEndpoint: nextOuterEndpoint,
              outerBodyBoundaryVertices: [
                nextOuterEndpoint,
                nextInwardEndpoint
              ],
              bodySideOutlineSegment: [
                nextOuterEndpoint,
                nextInwardEndpoint
              ]
            }
          ]
        }
      ]
    })[0]

    expect(product).toMatchObject({
      authoredJoin: 'bevel',
      resolvedJoin: 'bevel',
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint'
    })
    expect(
      productEdgeConnects(product, previousOuterEndpoint, nextOuterEndpoint),
      `bevel cut-off must directly connect incident dash body outer boundary endpoints, not inward selected-side endpoints: ${JSON.stringify(
        {
          expectedChord: [previousOuterEndpoint, nextOuterEndpoint],
          forbiddenInwardChord: [previousInwardEndpoint, nextInwardEndpoint],
          polygons: product.polygons,
          seamEvidence: product.seamEvidence
        },
        null,
        2
      )}`
    ).toBe(true)
    expect(
      productEdgeConnects(product, previousInwardEndpoint, nextInwardEndpoint),
      'bevel cut-off must not shrink to the inward selected-side chord'
    ).toBe(false)
  })

  it('bypasses tangent-continuous high-curvature smooth spans instead of emitting join output', () => {
    const products = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:smooth',
          joinOwnership: 'smooth-continuity',
          highCurvatureSmooth: true
        }
      ]
    })

    expect(products).toEqual([])
  })

  it('keeps the source-vertex join product helper free of cap, terminal, replay, and renderer ownership', () => {
    const source = readFileSync(sourceVertexJoinSourcePath, 'utf8')
    const helperSource = extractFrom(
      source,
      'export const buildSourceVertexJoinProducts = ('
    )

    for (const forbiddenToken of [
      'endpointCap',
      'capContributors',
      'terminalBody',
      'terminalOverhang',
      'join-owned-terminal-body',
      'sourcePathReplay',
      'strokePathStyle',
      'renderEntries',
      'finalFaces',
      'strokeMaskPolygons',
      'fillClipPolygons',
      'diagnosticGeometry'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps constrained dashed direct outside source-vertex joins on the canonical join footprint route', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const directJoinRouteSource = extractFrom(
      source,
      'const canUseDirectOutsideSourceVertexJoinRecord = ('
    ).slice(
      0,
      source.indexOf(
        'const exactSourceVertexBoundaryJoinPlans =',
        source.indexOf('const canUseDirectOutsideSourceVertexJoinRecord = (')
      ) - source.indexOf('const canUseDirectOutsideSourceVertexJoinRecord = (')
    )

    expect(directJoinRouteSource).toContain('buildSourceVertexJoinFootprint')
    expect(directJoinRouteSource).not.toContain("stroke.join !== 'round'")
    expect(directJoinRouteSource).not.toContain(
      'buildJoinOwnedDashTerminalPolygons(plan, stroke)'
    )
    expect(directJoinRouteSource).not.toContain(
      '...miterSideClosurePolygons'
    )
    expect(directJoinRouteSource).not.toContain(
      '...visibleProtectedContinuityZonePolygons'
    )
    expect(directJoinRouteSource).not.toContain(
      'buildSourceVertexTerminalBodySeamBridgePolygons'
    )
  })

  it('does not preserve raw outside round source-vertex sectors after seam-footprint materialization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const startToken = 'const materializeSourceVertexBoundaryJoinRecord = ('
    const startIndex = source.indexOf(startToken)
    expect(startIndex).toBeGreaterThanOrEqual(0)
    const endIndex = source.indexOf(
      'const formatJoinPlanPointSignature =',
      startIndex
    )
    expect(endIndex).toBeGreaterThan(startIndex)
    const materializerSource = source.slice(startIndex, endIndex)

    expect(materializerSource).toContain(
      'canonicalSourceVertexSeamFootprintPolygons'
    )
    expect(materializerSource).not.toContain(
      'shouldPreserveRoundSourceVertexJoinSector'
    )
    expect(materializerSource).not.toContain(
      'preservedRoundSourceVertexJoinSectorPolygons'
    )
    expect(materializerSource).not.toContain(
      'selectedCandidate.polygons.map(cleanPolygon)'
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-source-vertex-join-products')
  })

})
