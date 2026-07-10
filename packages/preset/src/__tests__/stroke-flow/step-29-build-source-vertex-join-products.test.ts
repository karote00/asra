import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildSourceVertexBevelPolygonWithoutIncidentBoundaries,
  buildSourceVertexJoinFootprint,
  buildSourceVertexJoinProducts,
  buildSourceVertexRoundPolygonWithoutIncidentBoundaries,
  type SourceVertexJoinProductInput
} from '../../components/stroke-render/source-vertex-join-footprint'
import {
  buildRoundStrokeArcPointsBetween,
  getRoundStrokeArcSampleMidpointBetween
} from '../../components/stroke-render/solid-stroke-geometry-core'

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
      sourceSegmentIndex: 3,
      bodyProductId: 'body:previous',
      ownerStepId: 'derive-dash-body-seam-boundaries',
      emitted: false
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
      sourceSegmentIndex: 4,
      bodyProductId: 'body:next',
      ownerStepId: 'derive-dash-body-seam-boundaries',
      emitted: false
    }
  ]
}

const metadataFreeBevelCases = [
  {
    label: 'acute-left',
    previousPoint: { x: -20, y: 0 },
    nextPoint: { x: 6, y: 18 },
    side: 'left' as const,
    offsetDistance: 2
  },
  {
    label: 'right-angle-right',
    previousPoint: { x: -10, y: 0 },
    nextPoint: { x: 0, y: 14 },
    side: 'right' as const,
    offsetDistance: 4
  },
  {
    label: 'obtuse-left',
    previousPoint: { x: -15, y: -2 },
    nextPoint: { x: -9, y: 13 },
    side: 'left' as const,
    offsetDistance: 7.5
  },
  {
    label: 'zero-offset-right',
    previousPoint: { x: -12, y: 1 },
    nextPoint: { x: 11, y: -3 },
    side: 'right' as const,
    offsetDistance: 0
  },
  {
    label: 'negative-offset-normalization',
    previousPoint: { x: -18, y: -6 },
    nextPoint: { x: 14, y: 2 },
    side: 'left' as const,
    offsetDistance: -5.25
  },
  {
    label: 'degenerate-previous',
    previousPoint: { x: 1.25, y: -2.5 },
    nextPoint: { x: 10, y: 8 },
    side: 'left' as const,
    offsetDistance: 6
  },
  {
    label: 'degenerate-next',
    previousPoint: { x: -10, y: 7 },
    nextPoint: { x: 1.25, y: -2.5 },
    side: 'right' as const,
    offsetDistance: 3
  }
]

const metadataFreeRoundVertex = { x: 1.25, y: -2.5 }
const buildMetadataFreeRoundCase = (
  label: string,
  incomingAngleDegrees: number,
  turnAngleDegrees: number,
  side: 'left' | 'right',
  offsetDistance: number
) => {
  const incomingAngle = (incomingAngleDegrees * Math.PI) / 180
  const outgoingAngle =
    ((incomingAngleDegrees + turnAngleDegrees) * Math.PI) / 180
  return {
    label,
    previousPoint: {
      x: metadataFreeRoundVertex.x - Math.cos(incomingAngle) * 17,
      y: metadataFreeRoundVertex.y - Math.sin(incomingAngle) * 17
    },
    nextPoint: {
      x: metadataFreeRoundVertex.x + Math.cos(outgoingAngle) * 23,
      y: metadataFreeRoundVertex.y + Math.sin(outgoingAngle) * 23
    },
    side,
    offsetDistance
  }
}

const metadataFreeRoundCases = [
  buildMetadataFreeRoundCase(
    'shallow-positive-sweep',
    17,
    0.05,
    'right',
    0.125
  ),
  buildMetadataFreeRoundCase(
    'shallow-negative-sweep',
    -33,
    -0.05,
    'left',
    0.25
  ),
  buildMetadataFreeRoundCase('acute-positive-sweep', 11, 35, 'right', 2),
  buildMetadataFreeRoundCase('acute-negative-sweep', 121, -35, 'left', 3),
  buildMetadataFreeRoundCase('right-positive-sweep', -71, 90, 'right', 4),
  buildMetadataFreeRoundCase('right-negative-sweep', 53, -90, 'left', 5),
  buildMetadataFreeRoundCase('obtuse-positive-sweep', 29, 145, 'right', 12),
  buildMetadataFreeRoundCase('obtuse-negative-sweep', -97, -145, 'left', 18),
  buildMetadataFreeRoundCase(
    'near-opposite-positive-sweep',
    -13,
    179.999,
    'right',
    64
  ),
  buildMetadataFreeRoundCase(
    'near-opposite-negative-sweep',
    83,
    -179.999,
    'left',
    32
  ),
  buildMetadataFreeRoundCase('non-outer-left-side', 7, 72, 'left', 7.5),
  buildMetadataFreeRoundCase('non-outer-right-side', 7, -72, 'right', 9.25),
  buildMetadataFreeRoundCase('zero-offset', 0, 90, 'right', 0),
  buildMetadataFreeRoundCase(
    'negative-offset-normalization',
    0,
    -90,
    'left',
    -5.25
  ),
  buildMetadataFreeRoundCase('collinear-incidents', 37, 0, 'right', 6),
  buildMetadataFreeRoundCase('exact-opposite-positive', 17, 180, 'right', 8),
  buildMetadataFreeRoundCase('exact-opposite-negative', 17, -180, 'left', 8),
  {
    label: 'degenerate-previous',
    previousPoint: metadataFreeRoundVertex,
    nextPoint: { x: 10, y: 8 },
    side: 'left' as const,
    offsetDistance: 6
  },
  {
    label: 'degenerate-next',
    previousPoint: { x: -10, y: 7 },
    nextPoint: metadataFreeRoundVertex,
    side: 'right' as const,
    offsetDistance: 3
  }
]

const pointOnCircle = (
  center: { x: number; y: number },
  radius: number,
  angleDegrees: number
) => {
  const angle = (angleDegrees * Math.PI) / 180
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  }
}

const roundArcFingerprintCases = [
  {
    label: 'positive-quarter',
    center: { x: 0, y: 0 },
    radius: 4,
    startAngle: 0,
    endAngle: 90,
    sweepSign: 1,
    minSegments: 2,
    options: undefined,
    pointCount: 10,
    hash: '8818001648bca5ddf6576b8be8180ebded442d501214194ad5187cbc0dc6a5f4'
  },
  {
    label: 'negative-quarter',
    center: { x: 0, y: 0 },
    radius: 4,
    startAngle: 0,
    endAngle: -90,
    sweepSign: -1,
    minSegments: 2,
    options: undefined,
    pointCount: 10,
    hash: 'afbb1aa1c000e2c9450df0e0407f73768082d17c6a485915386b13dd454763ab'
  },
  {
    label: 'exact-opposite-negative',
    center: { x: 1.25, y: -2.5 },
    radius: 8,
    startAngle: 17,
    endAngle: 197,
    sweepSign: -1,
    minSegments: 2,
    options: undefined,
    pointCount: 35,
    hash: '7cdfb188b8d69b4137999851025ed90cc35d43bc33f5878605297104b037f7ad'
  },
  {
    label: 'near-opposite-positive',
    center: { x: 1.25, y: -2.5 },
    radius: 64,
    startAngle: -13,
    endAngle: 166.999,
    sweepSign: 1,
    minSegments: 2,
    options: undefined,
    pointCount: 270,
    hash: 'e703f36bac9e90c9d10c52deaf509aef8cda7d08de24df7e67238362d9798bcb'
  },
  {
    label: 'tiny-radius-shallow',
    center: { x: 100000.125, y: -99999.875 },
    radius: 0.001,
    startAngle: 37,
    endAngle: 37.05,
    sweepSign: 1,
    minSegments: 2,
    options: undefined,
    pointCount: 3,
    hash: 'ec0da34f0b098672ee4289e36433a2c78d5f021cff47294c8fc0d2138694a9a7'
  },
  {
    label: 'cap-sampling',
    center: { x: 3, y: -7 },
    radius: 5,
    startAngle: 90,
    endAngle: 270,
    sweepSign: 1,
    minSegments: 2,
    options: { maxLength: 0.25 },
    pointCount: 64,
    hash: '194dd9742605a3d3238537f963b8f7588793e0ee6b095d9379e5636f2862bec0'
  }
]

const fingerprintRoundArc = (points: { x: number; y: number }[]) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        points.map(({ x, y }) => [Number(x.toFixed(12)), Number(y.toFixed(12))])
      )
    )
    .digest('hex')

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

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

describe('stroke flow step 29: build-source-vertex-join-products', () => {
  it('keeps build-source-vertex-join-products as the twenty-ninth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-source-vertex-join-products'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps[28]?.id).toBe('build-source-vertex-join-products')
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
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
        'verified incident dash body seam boundary artifacts when dashed'
      ],
      requiredOutputs: [
        'pre-legality source-vertex join products with join resolution metadata',
        'reference-stable canonical join polygon sets with one per-plan and per-polygon-set summary record'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
        'packages/preset/src/components/stroke-render/solid-stroke-geometry-core.ts',
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
        'proof that every consumed seam boundary endpoint id belongs to the owning dash body product boundary identity',
        'point-exact differential parity between the full authored-style solver and each metadata-free no-incident-boundary bevel or round primitive',
        'fixed existing round-arc output fingerprints for positive, negative, near-opposite, tiny-radius, and cap-sampling cases',
        'point-exact identity between the shared sampled midpoint and the same index of the materialized arc'
      ])
    )
  })

  it.each(metadataFreeBevelCases)(
    'matches the full authored-bevel solver point-for-point for $label',
    ({ previousPoint, nextPoint, offsetDistance, side }) => {
      const vertex = { x: 1.25, y: -2.5 }
      const fullFootprint = buildSourceVertexJoinFootprint({
        vertex,
        previousPoint,
        nextPoint,
        strokeWidth: Math.max(1, offsetDistance * 2),
        offsetDistance,
        side,
        authoredJoin: 'bevel',
        miterAngle: 45,
        ownerId: 'owner:metadata-free-bevel-parity',
        angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
      })

      expect(
        buildSourceVertexBevelPolygonWithoutIncidentBoundaries({
          vertex,
          previousPoint,
          nextPoint,
          offsetDistance,
          side
        })
      ).toEqual(fullFootprint.polygon)
    }
  )

  it.each(metadataFreeRoundCases)(
    'matches the full authored-round solver point-for-point for $label',
    ({ previousPoint, nextPoint, offsetDistance, side }) => {
      const fullFootprint = buildSourceVertexJoinFootprint({
        vertex: metadataFreeRoundVertex,
        previousPoint,
        nextPoint,
        strokeWidth: Math.max(1, Math.abs(offsetDistance) * 2),
        offsetDistance,
        side,
        authoredJoin: 'round',
        miterAngle: 45,
        ownerId: 'owner:metadata-free-round-parity',
        angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
      })

      expect(
        buildSourceVertexRoundPolygonWithoutIncidentBoundaries({
          vertex: metadataFreeRoundVertex,
          previousPoint,
          nextPoint,
          offsetDistance,
          side
        })
      ).toEqual(fullFootprint.polygon)
    }
  )

  it('keeps the authored-round polygon primitive independent from seam and metadata owners', () => {
    const source = readFileSync(sourceVertexJoinSourcePath, 'utf8')
    const primitiveStart = source.indexOf(
      'export const buildSourceVertexRoundPolygonWithoutIncidentBoundaries ='
    )
    const primitiveEnd = source.indexOf(
      'export const buildSourceVertexJoinFootprint =',
      primitiveStart
    )

    expect(primitiveStart).toBeGreaterThanOrEqual(0)
    expect(primitiveEnd).toBeGreaterThan(primitiveStart)
    const primitiveSource = source.slice(primitiveStart, primitiveEnd)
    expect(primitiveSource).not.toContain('incidentSeamBoundaries')
    expect(primitiveSource).not.toContain('ownerId')
    expect(primitiveSource).not.toContain('miterAngle')
    expect(primitiveSource).not.toContain('angleComparison')
    expect(primitiveSource).not.toContain('buildSourceVertexJoinFootprint')
  })

  it.each(roundArcFingerprintCases)(
    'preserves the shared core round-arc output fingerprint for $label',
    ({
      center,
      radius,
      startAngle,
      endAngle,
      sweepSign,
      minSegments,
      options,
      pointCount,
      hash
    }) => {
      const points = buildRoundStrokeArcPointsBetween(
        center,
        pointOnCircle(center, radius, startAngle),
        pointOnCircle(center, radius, endAngle),
        sweepSign,
        minSegments,
        options
      )

      expect(points).toHaveLength(pointCount)
      expect(fingerprintRoundArc(points)).toBe(hash)
    }
  )

  it.each(roundArcFingerprintCases)(
    'returns the actual materialized sample midpoint for $label',
    ({
      center,
      radius,
      startAngle,
      endAngle,
      sweepSign,
      minSegments,
      options
    }) => {
      const start = pointOnCircle(center, radius, startAngle)
      const end = pointOnCircle(center, radius, endAngle)
      const points = buildRoundStrokeArcPointsBetween(
        center,
        start,
        end,
        sweepSign,
        minSegments,
        options
      )

      expect(
        getRoundStrokeArcSampleMidpointBetween(
          center,
          start,
          end,
          sweepSign,
          minSegments,
          options
        )
      ).toEqual(points[Math.floor(points.length / 2)])
    }
  )

  it('declares Step 29 as the only join resolver that consumes dash seam boundary artifacts', () => {
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
    expect(route.cacheKeyInputs).toContain('dash body seam boundary signature')
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'incident dash body seam boundary ids',
        'incident outer body boundary endpoint ids',
        'bevel and bevel-by-miter-angle cut-off edge endpoint ids from incident dash body outer boundaries',
        'proof that every consumed seam boundary endpoint id is emitted by the owning dash body product boundary identity',
        'proof that dash and join visible triangles share the same seam endpoint identities'
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
      ownerStepId: 'build-source-vertex-join-products',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      authoredJoin: 'miter',
      resolvedJoin: 'bevel-by-miter-angle',
      miterAngle: 30,
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS',
      seamEvidence: {
        seamCoveragePolicy: 'shared-seam-boundary-artifact-endpoint-identity',
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
        `${seamBoundary.seamBoundaryId} seam-boundary artifact endpoint must be part of the visible join polygon`
      ).toBe(true)
    }
    expectSourceVertexJoinProductOnly(products)
  })

  it('rejects dashed seam evidence that was not verified by Step 28', () => {
    const unverifiedSeams = sharpMiterProduct.incidentSeamBoundaries?.map(
      ({
        bodyProductId: _bodyProductId,
        ownerStepId: _ownerStepId,
        emitted: _emitted,
        ...boundary
      }) => boundary
    )

    expect(
      buildSourceVertexJoinProducts({
        joins: [
          {
            ...sharpMiterProduct,
            productId: 'join:unverified-seams',
            incidentSeamBoundaries: unverifiedSeams
          } as unknown as SourceVertexJoinProductInput
        ]
      })
    ).toEqual([])
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
          productFamilyId: 'constrained-solid',
          incidentSeamBoundaries: []
        }
      ]
    })[0]
    const noSeamWide = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:no-seam-wide',
          productFamilyId: 'constrained-solid',
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
      seamCoveragePolicy: 'shared-seam-boundary-artifact-endpoint-identity',
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
      `round source-vertex join must use seam-boundary artifact endpoints instead of closing through the authored source vertex: ${JSON.stringify(
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
        `${seamBoundary.seamBoundaryId} seam-boundary artifact outer endpoint must be part of the round join polygon`
      ).toBe(true)
    }
    expectSourceVertexJoinProductOnly(products)
  })

  it('places bevel cut-off on incident dash body outer endpoints instead of an inward selected-side chord', () => {
    const previousOuterEndpoint = { x: -12, y: 20 }
    const nextOuterEndpoint = { x: 12, y: 20 }
    const previousInwardEndpoint = { x: -2, y: 20 }
    const nextInwardEndpoint = { x: 2, y: 20 }
    const seamBoundaries = sharpMiterProduct.incidentSeamBoundaries ?? []
    expect(seamBoundaries).toHaveLength(2)
    const product = buildSourceVertexJoinProducts({
      joins: [
        {
          ...sharpMiterProduct,
          productId: 'join:bevel-outer-endpoints',
          authoredJoin: 'bevel',
          incidentSeamBoundaries: [
            {
              ...seamBoundaries[0],
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
              ...seamBoundaries[1],
              outerBodyBoundaryEndpoint: nextOuterEndpoint,
              outerBodyBoundaryVertices: [
                nextOuterEndpoint,
                nextInwardEndpoint
              ],
              bodySideOutlineSegment: [nextOuterEndpoint, nextInwardEndpoint]
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

  it('preserves seam-boundary artifact edges inside the canonical join footprint without visible seam strips', () => {
    const seamPoint = { x: -3, y: 8 }
    const outerEndpoint = { x: -13, y: 8 }
    const bodyInnerEndpoint = { x: -3, y: 28 }
    const bodyOuterEndpoint = { x: -13, y: 28 }

    for (const authoredJoin of ['miter', 'bevel', 'round'] as const) {
      const product = buildSourceVertexJoinProducts({
        joins: [
          {
            ...sharpMiterProduct,
            productId: `join:${authoredJoin}:shared-seam-edge`,
            authoredJoin,
            miterAngle: authoredJoin === 'miter' ? 5 : 30,
            incidentSeamBoundaries: [
              {
                ...(sharpMiterProduct.incidentSeamBoundaries ?? [])[0],
                seamBoundaryId: `seam:${authoredJoin}:previous`,
                point: seamPoint,
                outerBodyBoundaryEndpoint: outerEndpoint,
                outerBodyBoundaryVertices: [seamPoint, outerEndpoint],
                bodySideOutlineSegment: [outerEndpoint, bodyOuterEndpoint],
                bodySideTangent: { x: 0, y: 1 }
              },
              {
                ...(sharpMiterProduct.incidentSeamBoundaries ?? [])[1],
                seamBoundaryId: `seam:${authoredJoin}:next`
              }
            ]
          }
        ]
      })[0]

      expect(
        productEdgeConnects(product, seamPoint, outerEndpoint),
        `${authoredJoin} canonical join footprint must keep the seam-boundary artifact edge`
      ).toBe(true)
      expect(
        productEdgeConnects(product, outerEndpoint, bodyOuterEndpoint),
        `${authoredJoin} must not add a visible seam strip outside the canonical join footprint`
      ).toBe(false)
      expect(
        productEdgeConnects(product, bodyOuterEndpoint, bodyInnerEndpoint),
        `${authoredJoin} must not materialize a separate seam strip body edge`
      ).toBe(false)
      expect(
        productEdgeConnects(product, bodyInnerEndpoint, seamPoint),
        `${authoredJoin} must not close a standalone seam strip back to the seam point`
      ).toBe(false)
    }
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
    expect(directJoinRouteSource).not.toContain('...miterSideClosurePolygons')
    expect(directJoinRouteSource).not.toContain(
      '...visibleProtectedContinuityZonePolygons'
    )
    expect(directJoinRouteSource).not.toContain(
      'buildSourceVertexTerminalBodySeamBridgePolygons'
    )
  })

  it('consumes the canonical join footprint without post-owner polygon cleanup', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'const buildJoinOwnedDashTerminalPolygons = ('
    )
    const helperEnd = source.indexOf(
      'const buildSourceVertexTerminalBodyOwnershipExclusionPolygons = (',
      helperStart
    )

    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    expect(helperSource).toContain('buildSourceVertexJoinFootprint({')
    expect(helperSource).toContain('inputAlreadyClean: true')
    expect(helperSource).not.toContain('cleanClipResidue: true')
  })

  it('builds the join materialization cache key from local owner artifacts without geometry rederivation', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const keyStart = source.indexOf(
      'const getSourceVertexBoundaryJoinPlanMaterializationKey = ('
    )
    const keyEnd = source.indexOf(
      'const materializeSourceVertexBoundaryJoinRecords = (',
      keyStart
    )

    expect(keyStart).toBeGreaterThanOrEqual(0)
    expect(keyEnd).toBeGreaterThan(keyStart)
    const keySource = source.slice(keyStart, keyEnd)

    for (const ownerInput of [
      'plan.previousContourPoint',
      'plan.nextContourPoint',
      'seamBoundarySignature(plan.previousSeamBoundary)',
      'seamBoundarySignature(plan.nextSeamBoundary)',
      'plan.selectedSide',
      'stroke.position',
      'stroke.width',
      'stroke.join',
      'getStrokeMiterAngleForResolution(stroke)'
    ]) {
      expect(keySource).toContain(ownerInput)
    }
    expect(keySource).not.toContain('formatJoinPlanPathSignature')
    expect(keySource).not.toContain(
      'getSourceVertexBoundaryJoinEffectiveSignature'
    )
  })

  it('materializes join records only for sharp source-vertex plans', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const startIndex = source.indexOf(
      'const sourceVertexJoinPlans = plans.filter('
    )
    const endIndex = source.indexOf(
      'const sourceVertexBoundaryJoinRecords =',
      startIndex
    )
    expect(startIndex).toBeGreaterThanOrEqual(0)
    expect(endIndex).toBeGreaterThan(startIndex)
    const joinRecordMaterialization = source.slice(startIndex, endIndex)

    expect(joinRecordMaterialization).toContain(
      'const sourceVertexJoinPlans = plans.filter('
    )
    expect(joinRecordMaterialization).toContain("plan.kind === 'source-vertex'")
    expect(joinRecordMaterialization).toContain(
      'const directOutsideSourceVertexJoinRecords = sourceVertexJoinPlans'
    )
    expect(joinRecordMaterialization).toContain(
      '.filter(canUseDirectOutsideSourceVertexJoinRecord)'
    )
    expect(joinRecordMaterialization).toContain('sourceVertexJoinPlans.filter(')
    expect(joinRecordMaterialization).not.toContain(
      'materializeSourceVertexBoundaryJoinRecords(\n                  plans,'
    )
  })

  it('keeps smooth-inferred plans out of Step 29 visible join assembly', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const planningStart = source.indexOf(
      'const sourceVertexBoundaryJoinPlans ='
    )
    const planningEnd = source.indexOf(
      'const terminalOwnershipOverlays =',
      planningStart
    )
    const materializerStart = source.indexOf(
      'const materializeSourceVertexBoundaryJoinRecord = ('
    )
    const materializerEnd = source.indexOf(
      'const formatJoinPlanPointSignature =',
      materializerStart
    )

    expect(planningStart).toBeGreaterThanOrEqual(0)
    expect(planningEnd).toBeGreaterThan(planningStart)
    expect(materializerStart).toBeGreaterThanOrEqual(0)
    expect(materializerEnd).toBeGreaterThan(materializerStart)

    const planningSource = source.slice(planningStart, planningEnd)
    const materializerSource = source.slice(materializerStart, materializerEnd)

    expect(planningSource).toContain('() => sourceVertexJoinPlans')
    expect(planningSource).not.toContain(
      '...sourceVertexSmoothInferredJoinPlans'
    )
    expect(materializerSource).not.toContain('buildSmoothContinuityProducts')
    expect(materializerSource).not.toContain(
      "materializationKind: 'smooth-continuity-product'"
    )
  })

  it('keeps constrained dashed source-vertex miter geometry out of local packet-builder rebuild paths', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')

    expect(source).toContain('buildSourceVertexJoinFootprint')
    const forbiddenLocalMiterOwners = [
      'const buildSourceVertexCanonicalMiterFootprint =',
      'const buildSourceVertexMiterEndpointBoundaryPoints =',
      'const getSourceVertexMiterJoinPointForSide =',
      'const collectSourceVertexMiterTerminalEndpointBoundaryPoints =',
      'sourceVertexMiterCanonicalFootprintPolygons',
      'buildCanonicalMiterFootprintPolygons([',
      'shouldPreserveCanonicalSourceVertexMiterDescriptor'
    ]
    const violations = forbiddenLocalMiterOwners.filter((token) =>
      source.includes(token)
    )

    expect(violations).toEqual([])
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

  it('allows raw join reuse only for reference-identical final source artifacts', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const productAssemblyStart = source.indexOf(
      'const initialJoinSourcePackets = ['
    )
    const productAssemblyEnd = source.indexOf(
      'const ownershipResolvedJoinProductPackets =',
      productAssemblyStart
    )
    const productAssemblySource = source.slice(
      productAssemblyStart,
      productAssemblyEnd
    )

    expect(productAssemblyStart).toBeGreaterThanOrEqual(0)
    expect(productAssemblyEnd).toBeGreaterThan(productAssemblyStart)
    expect(productAssemblySource).toContain(
      'const hasIdenticalJoinSourceArtifacts = ('
    )
    expect(productAssemblySource).toMatch(
      /initialPacket\.geometry\.polygons\s*===\s*finalPacket\.geometry\.polygons/
    )
    expect(productAssemblySource).toMatch(
      /initialPacket\.geometry\.debugMeta\s*===\s*finalPacket\.geometry\.debugMeta/
    )
    expect(productAssemblySource).toContain('!hasStrokePipelineTraceSink()')
    expect(productAssemblySource).not.toContain(
      'JSON.stringify(refinedUncoveredJoinPlans)'
    )
    expect(productAssemblySource).not.toContain('buildIndexedCoverageSignature')
  })

  it('reuses the same-source slicing context while planning source-vertex joins', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const plannerStart = source.indexOf(
      'const buildConstrainedBoundarySourceVertexJoinPlans = ('
    )
    const plannerEnd = source.indexOf(
      'const buildBoundaryTerminalJoinPath = (',
      plannerStart
    )
    const invocationStart = source.indexOf(
      "'constrained dashed packets: source vertex join plans'"
    )
    const invocationEnd = source.indexOf(
      'const sourceVertexSmoothInferredJoinPlans =',
      invocationStart
    )

    expect(plannerStart).toBeGreaterThanOrEqual(0)
    expect(plannerEnd).toBeGreaterThan(plannerStart)
    expect(invocationStart).toBeGreaterThanOrEqual(0)
    expect(invocationEnd).toBeGreaterThan(invocationStart)

    const plannerSource = source.slice(plannerStart, plannerEnd)
    const invocationSource = source.slice(invocationStart, invocationEnd)
    expect(plannerSource).toContain(
      'sourcePathSlicingContext?: SourcePathSlicingContext'
    )
    expect(plannerSource).toMatch(
      /options\.sourcePathSlicingContext\s*\?\?\s*createSourcePathSlicingContext\(/
    )
    expect(invocationSource).toContain(
      'sourcePathSlicingContext: sourcePathSlicingContext'
    )
  })

  it('selects non-competing interval pairs before materializing join artifacts', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const plannerStart = source.indexOf(
      'const buildConstrainedBoundarySourceVertexJoinPlans = ('
    )
    const plannerEnd = source.indexOf(
      'const buildBoundaryTerminalJoinPath = (',
      plannerStart
    )

    expect(plannerStart).toBeGreaterThanOrEqual(0)
    expect(plannerEnd).toBeGreaterThan(plannerStart)
    const plannerSource = source.slice(plannerStart, plannerEnd)
    const selectionIndex = plannerSource.indexOf(
      'const selectedCandidatePairs = candidatePairs'
    )
    const materializationIndex = plannerSource.indexOf(
      'const joinPlanCandidates = selectedCandidatePairs.flatMap('
    )

    expect(selectionIndex).toBeGreaterThanOrEqual(0)
    expect(materializationIndex).toBeGreaterThan(selectionIndex)
    expect(plannerSource.slice(materializationIndex)).not.toContain(
      'usedPreviousIntervals'
    )
  })

  it('consumes Step 28 exact seam identities during planning and does not refine them from downstream product polygons', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const plannerStart = source.indexOf(
      'const buildConstrainedBoundarySourceVertexJoinPlans = ('
    )
    const plannerEnd = source.indexOf(
      'const buildBoundaryTerminalJoinPath = (',
      plannerStart
    )
    const invocationStart = source.indexOf(
      "'constrained dashed packets: source vertex join plans'"
    )
    const invocationEnd = source.indexOf(
      'const sourceVertexSmoothInferredJoinPlans =',
      invocationStart
    )
    const packetStart = source.indexOf(
      'const materializedRecordWithSeamBoundaries ='
    )
    const packetEnd = source.indexOf(
      'const incidentSeamBoundaries =',
      packetStart
    )

    expect(plannerStart).toBeGreaterThanOrEqual(0)
    expect(plannerEnd).toBeGreaterThan(plannerStart)
    expect(invocationStart).toBeGreaterThanOrEqual(0)
    expect(invocationEnd).toBeGreaterThan(invocationStart)
    expect(packetStart).toBeGreaterThanOrEqual(0)
    expect(packetEnd).toBeGreaterThan(packetStart)

    const plannerSource = source.slice(plannerStart, plannerEnd)
    const invocationSource = source.slice(invocationStart, invocationEnd)
    const packetSource = source.slice(packetStart, packetEnd)
    expect(plannerSource).toContain(
      'seamBoundaryArtifactsByIntervalId?: ReadonlyMap<'
    )
    expect(plannerSource).toContain(
      'withExactDashBodyProgramSeamBoundaryIdentity('
    )
    expect(invocationSource).toContain('seamBoundaryArtifactsByIntervalId:')
    expect(invocationSource).toContain(
      'dashBodyProgramSeamBoundaryArtifactsByIntervalId'
    )
    expect(packetSource).not.toContain(
      'refineSourceVertexJoinIncidentSeamBoundaryFromProductPolygons('
    )
  })

  it('resolves terminal endpoints from the shared source-segment sample artifact', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const resolverStart = source.indexOf(
      'const getSourceDomainTerminalEndpointForJoin = ('
    )
    const resolverEnd = source.indexOf(
      'const getSourceVertexLocalContourReferencePoint = (',
      resolverStart
    )

    expect(resolverStart).toBeGreaterThanOrEqual(0)
    expect(resolverEnd).toBeGreaterThan(resolverStart)
    const resolverSource = source.slice(resolverStart, resolverEnd)

    expect(resolverSource).toContain('getSourcePathSegmentSample(')
    expect(resolverSource).not.toContain('getSourcePathPointAtDistanceForJoin(')
    expect(resolverSource).not.toContain('slicePathGeometryFrames(')
  })

  it('reuses only the reference-identical inside-legal join artifact before descriptor output', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const descriptorStart = source.indexOf(
      'const buildSourceVertexJoinProductDescriptor = () => {'
    )
    const descriptorEnd = source.indexOf(
      'const sourceVertexJoinProductDescriptor =',
      descriptorStart
    )

    expect(descriptorStart).toBeGreaterThanOrEqual(0)
    expect(descriptorEnd).toBeGreaterThan(descriptorStart)
    const descriptorSource = source.slice(descriptorStart, descriptorEnd)

    expect(descriptorSource).toContain(
      'const canReuseInsideLegalRecordPolygons ='
    )
    expect(descriptorSource).toMatch(
      /canonicalJoinDescriptorPolygons\s*===\s*insideLegalRecordPolygons/
    )
    expect(descriptorSource).toMatch(
      /canReuseInsideLegalRecordPolygons\s*\?\s*canonicalJoinDescriptorPolygons\s*:\s*clipSourceVertexJoinPolygonsToInsideLegalDomain/
    )
  })

  it('keeps pre-legality evidence separate while reusing the owner legal join polygons', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const packetStart = source.indexOf(
      'const preLegalityRecordProductPolygons ='
    )
    const packetEnd = source.indexOf(
      'const debugMeta: SolidCenterStrokeGeometryDebugMeta =',
      packetStart
    )

    expect(packetStart).toBeGreaterThanOrEqual(0)
    expect(packetEnd).toBeGreaterThan(packetStart)
    const packetSource = source.slice(packetStart, packetEnd)

    expect(packetSource).toContain('const preLegalityRecordProductPolygons =')
    expect(packetSource).toContain(
      'const canReuseInsideLegalRecordPolygonsFromOwner ='
    )
    expect(packetSource).toMatch(
      /canReuseInsideLegalRecordPolygonsFromOwner\s*\?\s*record\.polygons/
    )
    expect(packetSource).toMatch(
      /preLegalitySourceVertexProductPolygons\s*=\s*[\s\S]*preLegalityRecordProductPolygons/
    )
  })

  it('preserves canonical join polygon identity through descriptor exclusion indexes without renormalization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const handoffStart = source.indexOf('const rawJoinProductPackets =')
    const handoffEnd = source.indexOf(
      'const sourceVertexJoinOwnershipEnvelopePolygonsByIntervalId =',
      handoffStart
    )

    expect(handoffStart).toBeGreaterThanOrEqual(0)
    expect(handoffEnd).toBeGreaterThan(handoffStart)
    const handoffSource = source.slice(handoffStart, handoffEnd)
    const insideExclusionStart = handoffSource.indexOf(
      'const insideJoinProductDescriptorExclusionPolygons ='
    )
    const insideExclusionEnd = handoffSource.indexOf(
      'const insideJoinProductDescriptorExclusionRegions =',
      insideExclusionStart
    )
    const intervalIndexStart = handoffSource.indexOf(
      'const sourceVertexJoinDescriptorPolygonsByIntervalId ='
    )

    expect(insideExclusionStart).toBeGreaterThanOrEqual(0)
    expect(insideExclusionEnd).toBeGreaterThan(insideExclusionStart)
    expect(intervalIndexStart).toBeGreaterThan(insideExclusionEnd)
    expect(
      handoffSource.slice(insideExclusionStart, insideExclusionEnd)
    ).not.toContain('normalizeConstrainedDashedProductPolygons(')
    expect(handoffSource.slice(intervalIndexStart)).not.toContain(
      'normalizeConstrainedDashedProductPolygons(polygons'
    )
  })

  it('reuses one owner summary for plan bounds, packet bounds, and join angle resolution', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const recordStart = source.indexOf(
      'const materializeSourceVertexBoundaryJoinRecords = ('
    )
    const recordEnd = source.indexOf(
      'const clipSourceSegmentRangePolygonsToAdjacentBoundaries = (',
      recordStart
    )
    const packetStart = source.indexOf(
      'const sourceVertexJoinPackets = sourceVertexBoundaryJoinRecords.length > 0'
    )
    const packetEnd = source.indexOf(
      'return {\n        sourceVertexJoinPackets,',
      packetStart
    )

    expect(recordStart).toBeGreaterThanOrEqual(0)
    expect(recordEnd).toBeGreaterThan(recordStart)
    expect(packetStart).toBeGreaterThanOrEqual(0)
    expect(packetEnd).toBeGreaterThan(packetStart)
    const recordSource = source.slice(recordStart, recordEnd)
    const packetSource = source.slice(packetStart, packetEnd)

    expect(recordSource).toContain('planLegalClipBoundsByPlan')
    expect(packetSource).toContain('getJoinPacketPolygonBounds')
    expect(packetSource).toContain('const finalProductBounds =')
    expect(source).toContain(
      'joinAngleResolution: SourceVertexJoinAngleResolution'
    )
    expect(packetSource).toContain(
      'const joinAngleResolution = record.joinAngleResolution'
    )
    expect(
      packetSource.match(/bounds: finalProductBounds/g) ?? []
    ).toHaveLength(2)
    expect(packetSource).not.toMatch(
      /preLegalityRecordProductPolygons\s*\.map\(cleanPolygon\)/
    )
    expect(
      packetSource.match(/resolveMiterAngleJoin\(\s*record,\s*stroke\s*\)/g) ??
        []
    ).toHaveLength(0)
    expect(packetSource).not.toContain(
      'resolveSourceVertexVisibleJoinResolution(record, stroke)'
    )
    expect(packetSource).not.toContain('buildSourceVertexJoinFootprint({')
  })

  it('does not consume Step 30 terminal-body products while materializing Step 29 joins', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const packetAssemblyStart = source.indexOf(
      'const sourceVertexJoinPackets = sourceVertexBoundaryJoinRecords.length > 0'
    )
    const packetAssemblyEnd = source.indexOf(
      'return {\n        sourceVertexJoinPackets,',
      packetAssemblyStart
    )

    expect(packetAssemblyStart).toBeGreaterThanOrEqual(0)
    expect(packetAssemblyEnd).toBeGreaterThan(packetAssemblyStart)
    const packetAssemblySource = source.slice(
      packetAssemblyStart,
      packetAssemblyEnd
    )

    expect(packetAssemblySource).not.toContain(
      'joinOwnedTerminalBodyProductPolygons'
    )
    expect(packetAssemblySource).not.toContain(
      'sourceVertexTerminalBodyContributionEnvelopePolygons'
    )
    expect(packetAssemblySource).not.toContain(
      'shouldUseInsideBoundaryTerminalBodyAsJoinProduct'
    )
    expect(packetAssemblySource).toContain('indexedCoveredProductPolygons')
  })

  it('consumes the upstream legal side without evaluating an opposite-side repair candidate', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const materializerStart = source.indexOf(
      'const materializeSourceVertexBoundaryJoinRecord = ('
    )
    const materializerEnd = source.indexOf(
      'const formatJoinPlanPointSignature =',
      materializerStart
    )

    expect(materializerStart).toBeGreaterThanOrEqual(0)
    expect(materializerEnd).toBeGreaterThan(materializerStart)
    const materializerSource = source.slice(materializerStart, materializerEnd)

    expect(materializerSource).toContain(
      'const candidateSelectedSides = [plan.selectedSide]'
    )
    expect(materializerSource).not.toContain(
      '(plan.selectedSide === 1 ? -1 : 1) as 1 | -1'
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-source-vertex-join-products')
  })
})
