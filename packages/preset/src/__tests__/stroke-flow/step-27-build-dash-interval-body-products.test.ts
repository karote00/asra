import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import * as constrainedDashedStrokePackets from '../../components/stroke-render/constrained-dashed-stroke-packets'
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

const expectBoundaryEvidenceOnBodyProductBoundary = (
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
  it('keeps build-dash-interval-body-products as the twenty-seventh runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-dash-interval-body-products'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps[26]?.id).toBe('build-dash-interval-body-products')
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
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
        'pre-legality dash interval body products encoded as canonical polygons or exact body geometry programs',
        'dash body boundary evidence required by seam-boundary derivation',
        'self-contained body materialization spec and initial ConstrainedDashedProductEvidenceEnvelope bodyProductIds'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
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
        'emitted dash body product boundary id',
        'candidate outer body boundary endpoint on emitted dash body product boundary',
        'candidate body-side outline segment on emitted dash body product boundary'
      ])
    )
  })

  it('declares dash body products as Step 27 output and leaves seam artifacts to Step 28', () => {
    const data = loadInspectorData()
    const route = routeById(data, 'constrained-dashed-interval-body-product')

    expect(route.produces).toEqual(
      expect.arrayContaining([
        'artifact:constrained-dashed-interval-body-product'
      ])
    )
    expect(route.produces).not.toContain('artifact:dash-body-seam-boundary')
    expect(route.cacheKeyInputs).toEqual(
      expect.arrayContaining(['terminal role', 'endpoint cap policy'])
    )
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'emitted dash body product boundary id',
        'candidate outer body boundary endpoint on emitted dash body product boundary',
        'candidate body-side outline segment on emitted dash body product boundary'
      ])
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'build-dash-interval-body-products',
      consumesArtifacts: ['artifact:dash-product-interval'],
      producesArtifacts: ['artifact:constrained-dashed-interval-body-product'],
      consumedBy: [
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'apply-legality'
      ],
      mustNotRecomputeAfter: 'derive-dash-body-seam-boundaries'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'dash interval endpoint relocation',
        'endpoint cap suppression reinterpretation',
        'bevel endpoint substitution'
      ])
    )
    expect(route.computationContract?.forbiddenLateComputation).not.toContain(
      'dash body seam boundary relocation'
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
      ownerStepId: 'build-dash-interval-body-products',
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
    expectBoundaryEvidenceOnBodyProductBoundary(products[0])
    expect(products[0].capContributors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          side: 'start'
        })
      ])
    )
    expectBodyProductOnly(products)
  })

  it('encodes every terminal body as an exact program with locked join-owned endpoints', () => {
    const buildProgram = (
      constrainedDashedStrokePackets as unknown as {
        buildDashIntervalBodyProductId?: (
          cachePrefix: string,
          strokeIndex: number,
          intervalId: string
        ) => string
        buildDashIntervalBodyGeometryProgram?: (input: {
          bodyProductId: string
          intervalId: string
          strokePosition: 'inside'
          productDomainMode: 'closed-constrained-domain'
          path: { segments: unknown[]; closed: boolean; totalLength: number }
          interval: {
            startDistance: number
            endDistance: number
            wrapsSeam: boolean
            domainPlanTerminalRole: 'start'
            domainPlanSplitRangeSourceSegmentIndex: number
          }
          endpointCapPolicy: DashIntervalBodyEndpointCapPolicy
          slicingContext: {
            segmentRanges: {
              index: number
              startDistance: number
              endDistance: number
            }[]
          }
          legalSideId: string
          legalDomainId: string
          authoredStrokeWidth: number
          materializationStyle: {
            width: number
            cap: 'round'
            join: 'miter'
            miterAngle: number
            miterLimit: number
            closed: false
          }
        }) => Record<string, unknown>
      }
    )
    const buildProductId = buildProgram.buildDashIntervalBodyProductId
    const buildGeometryProgram =
      buildProgram.buildDashIntervalBodyGeometryProgram

    expect(buildProductId).toBeTypeOf('function')
    expect(buildGeometryProgram).toBeTypeOf('function')
    if (!buildProductId || !buildGeometryProgram) {
      return
    }

    const bodyProductId = buildProductId(
      'runtime-path',
      2,
      'interval:terminal-start'
    )
    expect(bodyProductId).toBe(
      'runtime-path:2:interval:terminal-start:body-program'
    )
    const sourceLineSegment = {
      type: 'line' as const,
      start: { x: 0, y: 0 },
      end: { x: 12, y: 0 },
      length: 12,
      startAnchorType: 'smooth' as const,
      endAnchorType: 'smooth' as const
    }
    const program = buildGeometryProgram({
      bodyProductId,
      intervalId: 'interval:terminal-start',
      strokePosition: 'inside',
      productDomainMode: 'closed-constrained-domain',
      path: {
        segments: [sourceLineSegment],
        closed: false,
        totalLength: 12
      },
      interval: {
        startDistance: 0,
        endDistance: 12,
        wrapsSeam: false,
        domainPlanTerminalRole: 'start',
        domainPlanSplitRangeSourceSegmentIndex: 0
      },
      endpointCapPolicy: joinOwnedStartPolicy,
      slicingContext: {
        segmentRanges: [{ index: 0, startDistance: 0, endDistance: 12 }]
      },
      legalSideId: 'legal-side:inside',
      legalDomainId: 'legal-domain:face-1',
      authoredStrokeWidth: 8,
      materializationStyle: {
        width: 16,
        cap: 'round',
        join: 'miter',
        miterAngle: 30,
        miterLimit: 2,
        closed: false
      }
    })

    expect(program).toMatchObject({
      bodyProductId,
      intervalId: 'interval:terminal-start',
      strokePosition: 'inside',
      productDomainMode: 'closed-constrained-domain',
      geometryEncodingMode: 'exact-body-geometry-program',
      terminalRole: 'start',
      endpointLocks: { start: true, end: false },
      slicingContext: {
        segmentRanges: [{ index: 0, startDistance: 0, endDistance: 12 }]
      },
      legalSideId: 'legal-side:inside',
      legalDomainId: 'legal-domain:face-1',
      authoredStrokeWidth: 8,
      materializationStyle: {
        width: 16,
        cap: 'round',
        join: 'miter',
        miterAngle: 30,
        miterLimit: 2,
        closed: false
      },
      interval: expect.objectContaining({
        domainPlanSplitRangeSourceSegmentIndex: 0
      }),
      rawCurveEvidence: {
        coveredSourceSegments: [
          {
            sourceSegmentIndex: 0,
            segmentType: 'line',
            startAnchorType: 'smooth',
            endAnchorType: 'smooth',
            startTangent: { x: 1, y: 0 },
            endTangent: { x: 1, y: 0 }
          }
        ]
      },
      productEvidenceEnvelope: {
        bodyProductIds: [bodyProductId],
        terminalOwnershipOverlays: [],
        smoothContinuityOwnershipOverlays: []
      },
      ownerStepId: 'build-dash-interval-body-products',
      ownerStage: 'Stroke Geometry dashed interval body assembly'
    })
    expect(program).not.toHaveProperty('suppressProductGeometry')
    expect(program).not.toHaveProperty('polygons')
    expect(program).not.toHaveProperty('paint')
  })

  it('makes endpoint cap policy mandatory on every completed body program', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const programContractSource = extractBetween(
      source,
      'export interface DashIntervalBodyGeometryProgram {',
      'export const buildDashIntervalBodyProductId = ('
    )
    const programBuilderSource = extractBetween(
      source,
      'export const buildDashIntervalBodyGeometryProgram = (',
      'export interface DashIntervalBodyGeometryProgramBatchItem'
    )

    expect(programContractSource).toContain(
      'endpointCapPolicy: DashEndpointCapPolicy'
    )
    expect(programContractSource).not.toContain(
      'endpointCapPolicy?: DashEndpointCapPolicy'
    )
    expect(programBuilderSource).toContain(
      'const endpointCapPolicy = input.endpointCapPolicy'
    )
    expect(programBuilderSource).toContain(
      'terminalRole: endpointCapPolicy.terminalRole'
    )
    expect(programBuilderSource).toContain(
      'start: endpointCapPolicy.suppressStartCap'
    )
    expect(programBuilderSource).toContain(
      'end: endpointCapPolicy.suppressEndCap'
    )
    expect(programBuilderSource).not.toContain('endpointCapPolicy?.')
  })

  it('preserves complete interval and legal-domain provenance on the exact body program', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const programContractSource = extractBetween(
      source,
      'export interface DashIntervalBodyGeometryProgram {',
      'export const buildDashIntervalBodyProductId = ('
    )
    const batchBuilderSource = extractBetween(
      source,
      'export const buildDashIntervalBodyGeometryProgramBatch = (',
      'export interface ExactDashBodyProgramSeamBoundaryArtifact'
    )
    const activeProgramMapSource = extractBetween(
      source,
      'const dashBodyGeometryProgramsByIntervalId =',
      'const shouldBuildSourceVertexBoundaryJoinProducts ='
    )

    expect(programContractSource).toContain('intervalId: string')
    expect(programContractSource).toContain(
      "strokePosition: 'inside' | 'outside'"
    )
    expect(programContractSource).toContain(
      'productDomainMode: StrokeDomainMode'
    )
    for (const field of [
      'domainPlanSplitRangeAliasIds',
      'domainPlanSideAuthority',
      'domainPlanFilledSide',
      'domainPlanUnfilledSide',
      'domainPlanBoundaryRole',
      'domainPlanSideResolutionStatus',
      'domainPlanSideResolutionReason'
    ]) {
      expect(programContractSource).toContain(field)
      expect(activeProgramMapSource).toMatch(
        new RegExp(`${field}:\\s*interval\\.${field}`)
      )
    }
    expect(batchBuilderSource).toMatch(
      /buildDashIntervalBodyGeometryProgram\(\{[\s\S]*?intervalId,[\s\S]*?bodyProductId:/
    )
    expect(activeProgramMapSource).toContain(
      'strokePosition: constrainedStrokePosition'
    )
    expect(activeProgramMapSource).toContain('productDomainMode,')
    expect(activeProgramMapSource).toContain(
      'const selectedSide = canUseSourceDomainProgram'
    )
    expect(activeProgramMapSource).toContain(
      'getBoundaryDomainMaterializedSelectedSide(interval)'
    )
  })

  it('builds one owner-indexed exact body program batch before downstream product owners run', () => {
    const buildProgramBatch = (
      constrainedDashedStrokePackets as unknown as {
        buildDashIntervalBodyGeometryProgramBatch?: (input: {
          cachePrefix: string
          strokeIndex: number
          items: {
            intervalId: string
            strokePosition: 'inside'
            productDomainMode: 'closed-constrained-domain'
            path: { segments: never[]; closed: boolean; totalLength: number }
            interval: {
              startDistance: number
              endDistance: number
              wrapsSeam: boolean
              domainPlanTerminalRole: 'middle'
            }
            endpointCapPolicy: DashIntervalBodyEndpointCapPolicy
            slicingContext: { segmentRanges: never[] }
            legalSideId: string
            legalDomainId: string
            authoredStrokeWidth: number
            materializationStyle: {
              width: number
              cap: 'butt'
              join: 'bevel'
              miterAngle: number
              miterLimit: number
              closed: false
            }
          }[]
        }) => Map<string, Record<string, unknown>>
      }
    ).buildDashIntervalBodyGeometryProgramBatch

    expect(buildProgramBatch).toBeTypeOf('function')
    if (!buildProgramBatch) {
      return
    }

    const programs = buildProgramBatch({
      cachePrefix: 'runtime-batch',
      strokeIndex: 3,
      items: [
        {
          intervalId: 'interval:body-1',
          strokePosition: 'inside',
          productDomainMode: 'closed-constrained-domain',
          path: { segments: [], closed: false, totalLength: 18 },
          interval: {
            startDistance: 2,
            endDistance: 14,
            wrapsSeam: false,
            domainPlanTerminalRole: 'middle'
          },
          endpointCapPolicy: middlePolicy,
          slicingContext: { segmentRanges: [] },
          legalSideId: 'legal-side:inside',
          legalDomainId: 'legal-domain:face-1',
          authoredStrokeWidth: 6,
          materializationStyle: {
            width: 12,
            cap: 'butt',
            join: 'bevel',
            miterAngle: 45,
            miterLimit: 1.5,
            closed: false
          }
        },
        {
          intervalId: 'interval:body-1',
          strokePosition: 'inside',
          productDomainMode: 'closed-constrained-domain',
          path: { segments: [], closed: false, totalLength: 18 },
          interval: {
            startDistance: 2,
            endDistance: 14,
            wrapsSeam: false,
            domainPlanTerminalRole: 'middle'
          },
          endpointCapPolicy: middlePolicy,
          slicingContext: { segmentRanges: [] },
          legalSideId: 'legal-side:inside',
          legalDomainId: 'legal-domain:face-1',
          authoredStrokeWidth: 6,
          materializationStyle: {
            width: 12,
            cap: 'butt',
            join: 'bevel',
            miterAngle: 45,
            miterLimit: 1.5,
            closed: false
          }
        }
      ]
    })

    expect([...programs.keys()]).toEqual(['interval:body-1'])
    expect(programs.get('interval:body-1')).toMatchObject({
      bodyProductId: 'runtime-batch:3:interval:body-1:body-program',
      intervalId: 'interval:body-1',
      strokePosition: 'inside',
      productDomainMode: 'closed-constrained-domain',
      geometryEncodingMode: 'exact-body-geometry-program',
      authoredStrokeWidth: 6,
      materializationStyle: expect.objectContaining({ width: 12 }),
      productEvidenceEnvelope: {
        bodyProductIds: [
          'runtime-batch:3:interval:body-1:body-program'
        ],
        terminalOwnershipOverlays: [],
        smoothContinuityOwnershipOverlays: []
      },
      ownerStepId: 'build-dash-interval-body-products'
    })
  })

  it('creates the active Step 27 body-program batch before Step 29 join planning', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const activeFamilyRuntime = extractBetween(
      source,
      'const insideAggregateDescriptorCandidateIntervals =',
      'const insideAggregateDescriptorPacket ='
    )

    expect(activeFamilyRuntime).toContain(
      'const dashBodyGeometryProgramsByIntervalId ='
    )
    expect(activeFamilyRuntime.indexOf('dashBodyGeometryProgramsByIntervalId')).toBeLessThan(
      activeFamilyRuntime.indexOf('const sourceVertexBoundaryTerminalRecords =')
    )
    const bodyProgramBatch = extractBetween(
      activeFamilyRuntime,
      'const dashBodyGeometryProgramsByIntervalId =',
      'const shouldBuildSourceVertexBoundaryJoinProducts ='
    )
    expect(bodyProgramBatch).toContain(
      'domainPlanSplitRangeSourceSegmentIndex:'
    )
    expect(bodyProgramBatch).toContain(
      'authoredStrokeWidth: stroke.width'
    )
    expect(bodyProgramBatch).toContain('materializationStyle:')
    expect(bodyProgramBatch).toContain(
      'const canUseSourceDomainProgram ='
    )
    expect(bodyProgramBatch).toContain(
      'resolveSourceDomainIntervalForMaterializationWithSourceGeometry('
    )
    expect(bodyProgramBatch).not.toContain(
      'projectPointToSourceSegmentDistance('
    )
  })

  it('preserves the Step 27 bodyProductId on active single-body packet materialization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const intervalMaterialization = extractBetween(
      source,
      'const materializedIntervalPackets =',
      'const packetAssembly ='
    )

    expect(intervalMaterialization).toContain(
      'dashBodyGeometryProgramsWithSmoothContinuityByIntervalId.get('
    )
    expect(intervalMaterialization).toContain('interval.intervalId')
    expect(intervalMaterialization).toContain(
      'const geometryId = bodyProgram.bodyProductId'
    )
    expect(intervalMaterialization).toContain(
      'productEvidenceEnvelope: bodyProgram.productEvidenceEnvelope'
    )
  })

  it('hands completed terminal body programs to aggregate descriptor materialization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const insideAggregateAssembly = extractBetween(
      source,
      'const insideAggregateDescriptorPacket =',
      'const outsideAggregateDescriptorPackets ='
    )
    const descriptorItemAssembly = extractBetween(
      insideAggregateAssembly,
      'const descriptorItems:',
      'if (!descriptorItemsReady) {'
    )

    expect(descriptorItemAssembly).toContain(
      'dashBodyGeometryProgramsWithSmoothContinuityByIntervalId.get('
    )
    expect(descriptorItemAssembly).not.toContain(
      'buildDashIntervalBodyGeometryProgram('
    )
    expect(descriptorItemAssembly).not.toContain('suppressProductGeometry')
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
