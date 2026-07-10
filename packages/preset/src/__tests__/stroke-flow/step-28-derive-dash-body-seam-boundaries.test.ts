import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildDashIntervalBodyProducts,
  deriveDashBodySeamBoundaryArtifacts,
  type DashIntervalBodyEndpointCapPolicy
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import * as constrainedDashedStrokePackets from '../../components/stroke-render/constrained-dashed-stroke-packets'

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
  limitations: string[]
}

interface InspectorRoute {
  id: string
  from: string
  to: string
  consumes: string[]
  produces: string[]
  cacheKeyInputs: string[]
  evidenceRequired: string[]
  limitations: string[]
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

const routeById = (data: InspectorData, routeId: string): InspectorRoute => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

const endpointCapPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'start',
  suppressStartCap: true,
  suppressEndCap: false,
  startCap: false,
  endCap: true,
  signature: 'start:start-flat:end-cap'
}

const bodyPolygon = [
  { x: 0, y: 0 },
  { x: 16, y: 0 },
  { x: 16, y: 8 },
  { x: 0, y: 8 }
]

const seamBoundary = {
  seamBoundaryId: 'seam:derive:terminal',
  intervalId: 'interval:derive:terminal',
  splitRangeId: 'split:derive:terminal',
  side: 'previous' as const,
  point: { x: 0, y: 0 },
  outerBodyBoundaryEndpoint: { x: 0, y: 0 },
  outerBodyBoundaryVertices: [
    { x: 0, y: 0 },
    { x: 16, y: 0 }
  ],
  bodySideOutlineSegment: [
    { x: 0, y: 0 },
    { x: 16, y: 0 }
  ] as [{ x: number; y: number }, { x: number; y: number }],
  bodySideTangent: { x: -1, y: 0 },
  selectedSide: 'left' as const,
  terminalRole: 'start' as const,
  endpointCapPolicySignature: endpointCapPolicy.signature,
  capSuppressed: true,
  sourceSegmentIndex: 4
}

describe('stroke flow step 28: derive-dash-body-seam-boundaries', () => {
  it('keeps derive-dash-body-seam-boundaries as the twenty-eighth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'derive-dash-body-seam-boundaries'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps[27]?.id).toBe('derive-dash-body-seam-boundaries')
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
  })

  it('declares the seam-boundary derivation surface as evidence-only', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'derive-dash-body-seam-boundaries'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry dash seam boundary derivation',
      allowedInputs: [
        'pre-legality dash interval body products',
        'dash body boundary evidence from build-dash-interval-body-products',
        'DashProductInterval provenance',
        'terminal role and endpoint cap policy'
      ],
      requiredOutputs: [
        'verified dash body seam boundary artifacts for join-owned and terminal-owned consumers'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
      ]
    })
    expect(step?.limitations.join(' ')).toContain('Must not emit visible geometry')
    expect(step?.limitations.join(' ')).toContain(
      'Must not read raw stroke parameters as semantic inputs'
    )
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible seam repair geometry',
        'source-vertex join footprint',
        'terminal ownership overlay interpreted as visible geometry',
        'endpoint cap geometry',
        'dash interval recomputation',
        'fresh offset point substitution'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'dash body seam boundary artifact id',
        'terminal point on the emitted body product boundary identity',
        'outer body boundary endpoint on the emitted body product boundary identity',
        'body-side outline segment on the emitted body product boundary identity',
        'exact body-program boundary reference when coordinates are not eagerly materialized',
        'proof that every seam endpoint identity is derived from the same emitted dash body product boundary'
      ])
    )
  })

  it('declares the only route that produces dash body seam boundary artifacts', () => {
    const data = loadInspectorData()
    const route = routeById(
      data,
      'constrained-dashed-products-derive-seam-boundaries'
    )

    expect(route).toMatchObject({
      from: 'build-dash-interval-body-products',
      to: 'derive-dash-body-seam-boundaries'
    })
    expect(route.consumes).toEqual(
      expect.arrayContaining([
        'stage:build-dash-interval-body-products',
        'artifact:constrained-dashed-interval-body-product'
      ])
    )
    expect(route.produces).toEqual(
      expect.arrayContaining([
        'stage:derive-dash-body-seam-boundaries',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'dash body product id',
        'boundary evidence id',
        'dash body seam boundary artifact id',
        'proof that seam endpoints are derived from the emitted dash body product boundary identity'
      ])
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'derive-dash-body-seam-boundaries',
      consumesArtifacts: ['artifact:constrained-dashed-interval-body-product'],
      producesArtifacts: ['artifact:dash-body-seam-boundary'],
      consumedBy: [
        'build-source-vertex-join-products',
        'build-terminal-body-products'
      ],
      mustNotRecomputeAfter: 'build-source-vertex-join-products'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'dash body seam boundary relocation',
        'fresh offset point substitution',
        'endpoint cap suppression reinterpretation',
        'dash interval provenance reinterpretation'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('consumes emitted dash body boundary evidence without re-deriving from raw source geometry', () => {
    const [bodyProduct] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-28',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: seamBoundary.intervalId,
          kind: 'visible',
          splitRangeId: seamBoundary.splitRangeId,
          seamBoundaryId: seamBoundary.seamBoundaryId,
          seamBoundary,
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(bodyProduct).toMatchObject({
      productId: 'step-28:interval:derive:terminal:body',
      materializationKind: 'body',
      visibleContributor: 'dash-interval-body',
      seamBoundaryId: seamBoundary.seamBoundaryId,
      intervalId: seamBoundary.intervalId,
      splitRangeId: seamBoundary.splitRangeId
    })
    expect(bodyProduct.seamBoundary).toEqual(seamBoundary)
    expect(bodyProduct.evidence.seamBoundary).toEqual(seamBoundary)
    const artifacts = deriveDashBodySeamBoundaryArtifacts([bodyProduct])

    expect(artifacts).toEqual([
      expect.objectContaining({
        seamBoundaryId: seamBoundary.seamBoundaryId,
        bodyProductId: bodyProduct.productId,
        intervalId: seamBoundary.intervalId,
        splitRangeId: seamBoundary.splitRangeId,
        terminalRole: 'start',
        endpointCapPolicySignature: endpointCapPolicy.signature,
        ownerStepId: 'derive-dash-body-seam-boundaries',
        emitted: false,
        outerBodyBoundaryEndpoint: bodyPolygon[0],
        bodySideOutlineSegment: [bodyPolygon[0], bodyPolygon[1]]
      })
    ])
    expect(JSON.stringify(artifacts)).not.toContain('source-vertex-join')
    expect(JSON.stringify(artifacts)).not.toContain('terminalBody')
  })

  it('rejects seam evidence that is not part of the emitted body boundary', () => {
    const [bodyProduct] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-28-invalid',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: seamBoundary.intervalId,
          kind: 'visible',
          splitRangeId: seamBoundary.splitRangeId,
          seamBoundaryId: seamBoundary.seamBoundaryId,
          seamBoundary: {
            ...seamBoundary,
            outerBodyBoundaryEndpoint: { x: 999, y: 999 }
          },
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(deriveDashBodySeamBoundaryArtifacts([bodyProduct])).toEqual([])
  })

  it('derives immutable non-visible seam references from exact Step 27 body programs', () => {
    const runtime = constrainedDashedStrokePackets as unknown as {
      buildDashIntervalBodyGeometryProgramBatch?: (input: {
        cachePrefix: string
        strokeIndex: number
        items: Record<string, unknown>[]
      }) => Map<string, Record<string, unknown>>
      deriveDashBodyProgramSeamBoundaryArtifacts?: (
        programs: ReadonlyMap<string, Record<string, unknown>>
      ) => Record<string, unknown>[]
    }
    expect(runtime.buildDashIntervalBodyGeometryProgramBatch).toBeTypeOf(
      'function'
    )
    expect(runtime.deriveDashBodyProgramSeamBoundaryArtifacts).toBeTypeOf(
      'function'
    )
    if (
      !runtime.buildDashIntervalBodyGeometryProgramBatch ||
      !runtime.deriveDashBodyProgramSeamBoundaryArtifacts
    ) {
      return
    }

    const programs = runtime.buildDashIntervalBodyGeometryProgramBatch({
      cachePrefix: 'step-28-program',
      strokeIndex: 1,
      items: [
        {
          intervalId: 'interval:exact-terminal',
          legalSideId: 'legal-side:inside',
          legalDomainId: 'legal-domain:face-1',
          path: { segments: [], closed: false, totalLength: 18 },
          interval: {
            startDistance: 2,
            endDistance: 14,
            wrapsSeam: false,
            domainPlanTerminalRole: 'start-end',
            domainPlanSplitRangeId: 'split:exact-terminal',
            domainPlanSplitRangeSourceSegmentIndex: 5,
            domainPlanSelectedSide: 1
          },
          endpointCapPolicy: {
            terminalRole: 'start-end',
            suppressStartCap: true,
            suppressEndCap: true,
            startCap: false,
            endCap: false,
            signature: 'start-end:start-flat:end-flat'
          },
          slicingContext: { segmentRanges: [] },
          selectedSide: 1
        }
      ]
    })
    const artifacts =
      runtime.deriveDashBodyProgramSeamBoundaryArtifacts(programs)

    expect(artifacts).toEqual([
      expect.objectContaining({
        seamBoundaryId:
          'step-28-program:1:interval:exact-terminal:body-program:seam:start',
        bodyProductId:
          'step-28-program:1:interval:exact-terminal:body-program',
        intervalId: 'interval:exact-terminal',
        splitRangeId: 'split:exact-terminal',
        rangeEndpoint: 'start',
        terminalRole: 'start-end',
        endpointCapPolicySignature: 'start-end:start-flat:end-flat',
        capSuppressed: true,
        sourceSegmentIndex: 5,
        geometryEncodingMode: 'exact-body-program-boundary-reference',
        ownerStepId: 'derive-dash-body-seam-boundaries',
        emitted: false
      }),
      expect.objectContaining({
        seamBoundaryId:
          'step-28-program:1:interval:exact-terminal:body-program:seam:end',
        rangeEndpoint: 'end',
        capSuppressed: true
      })
    ])
    expect(artifacts[0]).toHaveProperty('pointId')
    expect(artifacts[0]).toHaveProperty('outerBodyBoundaryEndpointId')
    expect(artifacts[0]).toHaveProperty('bodySideOutlineSegmentId')
    expect(artifacts[0]).toHaveProperty('bodySideTangentEvidenceId')
    expect(artifacts[0]).toHaveProperty('boundaryReference')
    expect(artifacts[0]).not.toHaveProperty('polygons')
    expect(artifacts[0]).not.toHaveProperty('paint')
  })

  it('creates exact seam references once before Step 29 join planning', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const startIndex = source.indexOf(
      'const dashBodyGeometryProgramsByIntervalId ='
    )
    const activeHandoff = source.slice(
      startIndex,
      source.indexOf('const sourceVertexRecords =', startIndex)
    )

    expect(activeHandoff).toContain(
      'const dashBodyProgramSeamBoundaryArtifactsByIntervalId ='
    )
    expect(activeHandoff).toContain(
      'deriveDashBodyProgramSeamBoundaryArtifacts('
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('derive-dash-body-seam-boundaries')
  })
})
