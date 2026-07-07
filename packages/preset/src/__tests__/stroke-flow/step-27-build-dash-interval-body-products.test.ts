import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildDashIntervalBodyProducts,
  type DashIntervalBodyEndpointCapPolicy
} from '../../components/stroke-render/constrained-dashed-stroke-packets'

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
  produces: string[]
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

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const routeById = (data: InspectorData, routeId: string): InspectorRoute => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

const bodyPolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 8 },
  { x: 0, y: 8 }
]

const seamBoundary = {
  seamBoundaryId: 'seam:terminal',
  intervalId: 'interval:terminal-start',
  splitRangeId: 'split:terminal',
  side: 'previous' as const,
  point: { x: 0, y: 0 },
  outerBodyBoundaryEndpoint: { x: 0, y: 0 },
  outerBodyBoundaryVertices: [
    { x: 0, y: 0 },
    { x: 20, y: 0 }
  ],
  bodySideOutlineSegment: [
    { x: 0, y: 0 },
    { x: 20, y: 0 }
  ] as [{ x: number; y: number }, { x: number; y: number }],
  bodySideTangent: { x: -1, y: 0 },
  selectedSide: 'left' as const,
  terminalRole: 'start' as const,
  endpointCapPolicySignature: 'start:start-flat:end-cap',
  capSuppressed: true,
  sourceSegmentIndex: 7
}

const middlePolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'middle',
  suppressStartCap: false,
  suppressEndCap: false,
  startCap: true,
  endCap: true,
  signature: 'middle:start-cap:end-cap'
}

const joinOwnedStartPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'start',
  suppressStartCap: true,
  suppressEndCap: false,
  startCap: false,
  endCap: true,
  signature: 'start:start-flat:end-cap'
}

const expectBodyProductOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'finalFaces',
    'renderEntries',
    'strokeMaskPolygons',
    'fillClipPolygons',
    'fillExcludePolygons',
    'sourceVertexJoin',
    'source-vertex-join',
    'join-owned-terminal-body',
    'join-owned-terminal-body-bridge',
    'terminalOverhang',
    'resolvedJoin',
    'vertexAngle',
    'miterAngle',
    'angleSource'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

const pointKey = (point: { x: number; y: number }) =>
  `${Math.round(point.x * 1000) / 1000}:${Math.round(point.y * 1000) / 1000}`

const polygonEdges = (polygon: { x: number; y: number }[]) =>
  polygon.map(
    (point, index) => [point, polygon[(index + 1) % polygon.length]] as const
  )

const expectSeamBoundaryOnBodyProductBoundary = (
  product: ReturnType<typeof buildDashIntervalBodyProducts>[number]
) => {
  expect(product.seamBoundary).toBeDefined()
  if (!product.seamBoundary) {
    return
  }

  const boundaryPointKeys = new Set(
    product.polygons.flat().map((point) => pointKey(point))
  )
  expect(
    boundaryPointKeys.has(
      pointKey(product.seamBoundary.outerBodyBoundaryEndpoint)
    )
  ).toBe(true)

  const seamSegment = product.seamBoundary.bodySideOutlineSegment
  const hasMatchingBoundaryEdge = product.polygons.some((polygon) =>
    polygonEdges(polygon).some(([start, end]) => {
      const forward =
        pointKey(start) === pointKey(seamSegment[0]) &&
        pointKey(end) === pointKey(seamSegment[1])
      const reverse =
        pointKey(start) === pointKey(seamSegment[1]) &&
        pointKey(end) === pointKey(seamSegment[0])
      return forward || reverse
    })
  )
  expect(hasMatchingBoundaryEdge).toBe(true)
}

describe('stroke flow step 27: build-dash-interval-body-products', () => {
  it('keeps build-dash-interval-body-products as the current or verified twenty-seventh step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-dash-interval-body-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-dash-interval-body-products'
      ])
    }
  })

  it('declares the exact dashed interval body implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-dash-interval-body-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      allowedInputs: [
        'selected constrained dashed product family',
        'DashProductInterval records',
        'terminal role and cap policy'
      ],
      requiredOutputs: [
        'pre-legality dash interval body products',
        'verified dash body seam boundary artifacts for join-owned terminals'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'source-vertex join completion',
        'endpoint-side cap at join-owned terminal',
        'duplicate interval paint'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'seam boundary id',
        'outer body boundary endpoint on emitted dash body polygon',
        'body-side outline segment on emitted dash body polygon'
      ])
    )
  })

  it('declares dash body seam boundary as the Step 27 computation output', () => {
    const data = loadInspectorData()
    const route = routeById(data, 'constrained-dashed-interval-body-product')

    expect(route.produces).toEqual(
      expect.arrayContaining([
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(route.cacheKeyInputs).toEqual(
      expect.arrayContaining(['terminal role', 'endpoint cap policy'])
    )
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'verified seam boundary artifact derived from emitted dash body product polygon',
        'outer body boundary endpoint on dash body product polygon',
        'body-side outline segment on dash body product polygon'
      ])
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'build-dash-interval-body-products',
      consumesArtifacts: ['artifact:dash-product-interval'],
      producesArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ],
      consumedBy: [
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'apply-legality'
      ],
      mustNotRecomputeAfter: 'build-source-vertex-join-products'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'dash interval endpoint relocation',
        'dash body seam boundary relocation',
        'endpoint cap suppression reinterpretation',
        'bevel endpoint substitution'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('builds pre-legality body products from visible DashProductInterval records only', () => {
    const products = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-27',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:visible-1',
          kind: 'visible',
          splitRangeId: 'split:1',
          seamBoundaryId: 'seam:1',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:gap-1',
          kind: 'gap',
          splitRangeId: 'split:gap',
          seamBoundaryId: 'seam:gap',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      productId: 'step-27:interval:visible-1:body',
      productFamilyId: 'constrained-dashed',
      productMode: 'pre-legality-dash-interval-body',
      visibleContributor: 'dash-interval-body',
      geometryBasis: 'dash-interval-body',
      materializationKind: 'body',
      legalSideId: 'legal-side:outside',
      intervalId: 'interval:visible-1',
      splitRangeId: 'split:1',
      seamBoundaryId: 'seam:1',
      terminalRole: 'middle',
      endpointCapPolicy: middlePolicy,
      capContributors: [
        {
          side: 'start',
          contribution: 'body-side-cap',
          policySignature: middlePolicy.signature
        },
        {
          side: 'end',
          contribution: 'body-side-cap',
          policySignature: middlePolicy.signature
        }
      ],
      ownerStage: 'Stroke Geometry dashed interval body assembly'
    })
    expect(products[0].polygons).toEqual([bodyPolygon])
    expect(products[0].bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 8
    })
    expectBodyProductOnly(products)
  })

  it('suppresses endpoint-side cap ownership at join-owned terminals', () => {
    const products = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-27-terminal',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:terminal-start',
          kind: 'visible',
          splitRangeId: 'split:terminal',
          seamBoundaryId: 'seam:terminal',
          seamBoundary,
          terminalRole: 'start',
          endpointCapPolicy: joinOwnedStartPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      terminalRole: 'start',
      endpointCapPolicy: joinOwnedStartPolicy,
      capContributors: [
        {
          side: 'end',
          contribution: 'body-side-cap',
          policySignature: joinOwnedStartPolicy.signature
        }
      ]
    })
    expect(products[0].seamBoundary).toEqual(seamBoundary)
    expect(products[0].evidence.seamBoundary).toEqual(seamBoundary)
    expectSeamBoundaryOnBodyProductBoundary(products[0])
    expect(products[0].capContributors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          side: 'start'
        })
      ])
    )
    expectBodyProductOnly(products)
  })

  it('does not emit fallback products for empty body coverage or duplicate interval paint', () => {
    const products = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-27-dedupe',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:duplicate',
          kind: 'visible',
          splitRangeId: 'split:duplicate-a',
          seamBoundaryId: 'seam:duplicate-a',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:duplicate',
          kind: 'visible',
          splitRangeId: 'split:duplicate-b',
          seamBoundaryId: 'seam:duplicate-b',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:empty',
          kind: 'visible',
          splitRangeId: 'split:empty',
          seamBoundaryId: 'seam:empty',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          bodyPolygons: []
        }
      ]
    })

    expect(products.map((product) => product.intervalId)).toEqual([
      'interval:duplicate'
    ])
    expectBodyProductOnly(products)
  })

  it('keeps the dashed interval body helper free of join, terminal bridge, and render output ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const helperSource = extractBetween(
      source,
      'export const buildDashIntervalBodyProducts = (',
      'export const getConstrainedDashedVisibleIntervals = ('
    )

    for (const forbiddenToken of [
      'buildSourceVertexTerminalBodySeamBridgePolygons',
      'join-owned-terminal-body',
      'join-owned-terminal-body-bridge',
      "materializationKind: 'join'",
      'source-vertex-join',
      'strokeMaskPolygons',
      'fillClipPolygons',
      'fillExcludePolygons',
      'renderEntries',
      'finalFaces'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps outside doubled-center dash products out of explicit selected-side clipping', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const intervalLevelSource = extractBetween(
      source,
      'const buildDashedSourcePathIntervalLevelPolygons = (',
      'const buildDoubledCenterDashedIntervalProduct = ('
    )
    const outsideDoubledCenterRoute = extractBetween(
      intervalLevelSource,
      'const doubledCenterProduct = buildDoubledCenterDashedIntervalProduct(',
      'const shouldMaterializeAsSmoothContinuityIntervalProduct ='
    )

    expect(outsideDoubledCenterRoute).toContain(
      'buildDoubledCenterDashedIntervalProduct('
    )
    expect(outsideDoubledCenterRoute).toContain('entry.polygons')
    expect(outsideDoubledCenterRoute).not.toContain(
      'clipSourceDomainIntervalPolygonsToExplicitSelectedSide'
    )
    expect(outsideDoubledCenterRoute).not.toContain(
      'resolveOutsideDescriptorStrokePathSelectedSide'
    )
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-dash-interval-body-products')
  })
})
