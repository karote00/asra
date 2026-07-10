import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildDashIntervalBodyProducts,
  buildTerminalBodyProducts,
  deriveDashBodySeamBoundaryArtifacts,
  type DashIntervalBodyEndpointCapPolicy
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import * as constrainedDashedStrokePackets from '../../components/stroke-render/constrained-dashed-stroke-packets'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  limitations: string[]
  forbiddenContributors: string[]
  evidenceRequired: string[]
}

interface InspectorRoute {
  id: string
  consumes: string[]
  produces: string[]
  cacheKeyInputs: string[]
  limitations: string[]
  visibleContributor: string
  geometryBasis: string
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

  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  const loaded = require(inspectorPath) as InspectorData
  cachedInspectorData = loaded
  return loaded
}

const routeById = (data: InspectorData, routeId: string) => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

const extractBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const bodyPolygon = [
  { x: 0, y: 0 },
  { x: 16, y: 0 },
  { x: 16, y: 8 },
  { x: 0, y: 8 }
]

const terminalPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'start',
  suppressStartCap: true,
  suppressEndCap: false,
  startCap: false,
  endCap: true,
  signature: 'start:start-flat:end-cap'
}

const middlePolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'middle',
  suppressStartCap: false,
  suppressEndCap: false,
  startCap: true,
  endCap: true,
  signature: 'middle:start-cap:end-cap'
}

const buildBodyHandoff = ({
  intervalId = 'interval:start',
  terminalRole = 'start',
  endpointCapPolicy = terminalPolicy
}: {
  intervalId?: string
  terminalRole?: 'middle' | 'start' | 'end' | 'start-end'
  endpointCapPolicy?: DashIntervalBodyEndpointCapPolicy
} = {}) => {
  const seamBoundaryId = `seam:${intervalId}`
  const [bodyProduct] = buildDashIntervalBodyProducts({
    productFamilyId: 'constrained-dashed',
    cachePrefix: 'step-27',
    legalSideId: 'legal-side:outside',
    intervals: [
      {
        intervalId,
        kind: 'visible',
        splitRangeId: `split:${intervalId}`,
        seamBoundaryId,
        terminalRole,
        endpointCapPolicy,
        bodyPolygons: [bodyPolygon],
        seamBoundary: {
          seamBoundaryId,
          intervalId,
          splitRangeId: `split:${intervalId}`,
          side: terminalRole === 'end' ? 'next' : 'previous',
          point: bodyPolygon[0],
          outerBodyBoundaryEndpoint: bodyPolygon[0],
          outerBodyBoundaryVertices: [bodyPolygon[0], bodyPolygon[1]],
          bodySideOutlineSegment: [bodyPolygon[0], bodyPolygon[1]],
          bodySideTangent: { x: 1, y: 0 },
          selectedSide: 'left',
          terminalRole,
          endpointCapPolicySignature: endpointCapPolicy.signature,
          capSuppressed:
            terminalRole === 'end'
              ? endpointCapPolicy.suppressEndCap
              : endpointCapPolicy.suppressStartCap
        }
      }
    ]
  })
  const [seamBoundary] = deriveDashBodySeamBoundaryArtifacts([bodyProduct])

  expect(bodyProduct).toBeDefined()
  expect(seamBoundary).toBeDefined()
  return { bodyProduct, seamBoundary }
}

describe('stroke flow step 30: build-terminal-body-products', () => {
  it('declares Step 30 as a non-visible ownership binding stage', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-terminal-body-products'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps[29]?.id).toBe('build-terminal-body-products')
    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      allowedInputs: [
        'terminal dash interval body product',
        'ConstrainedDashedProductEvidenceEnvelope bodyProductIds',
        'verified terminal dash body seam boundary artifact',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature'
      ],
      requiredOutputs: [
        'non-visible terminal body ownership overlay records with body product and seam boundary provenance',
        'ConstrainedDashedProductEvidenceEnvelope with terminal ownership overlay appended by overlayId'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ]
    })
    expect(step?.limitations.join(' ')).toContain(
      'Must not emit polygons, stroke paths, paint'
    )
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible body polygons',
        'visible stroke paths',
        'paint payload'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'dash body product id',
        'dash body seam boundary artifact id',
        'proof that the overlay contributes zero visible geometry'
      ])
    )
  })

  it('declares Step 27 body and Step 28 seam artifacts as its only geometry handoff', () => {
    const route = routeById(
      loadInspectorData(),
      'constrained-dashed-join-owned-terminal-body-product'
    )

    expect(route.consumes).toEqual(
      expect.arrayContaining([
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(route.produces).not.toContain('artifact:preLegalityProductUnits')
    expect(route.visibleContributor).toBe(
      'none-non-visible-ownership-overlay'
    )
    expect(route.geometryBasis).toBe('terminal-body-ownership-overlay')
    expect(route.cacheKeyInputs).toEqual(
      expect.arrayContaining([
        'dash body product id',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature',
        'dash body seam boundary signature'
      ])
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'build-terminal-body-products',
      consumesArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ],
      producesArtifacts: [
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      mustNotRecomputeAfter: 'apply-legality'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'body geometry materialization',
        'dash/join seam closure',
        'terminal seam boundary relocation'
      ])
    )
  })

  it('binds terminal ownership to a Step 27 body without copying visible geometry', () => {
    const { bodyProduct, seamBoundary } = buildBodyHandoff()
    const overlays = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-30',
      bindings: [
        {
          bodyProduct,
          seamBoundary,
          joinOwnershipSignature: 'source-vertex:join-owned'
        }
      ]
    } as never)

    expect(overlays).toHaveLength(1)
    expect(overlays[0]).toMatchObject({
      overlayId: 'step-30:interval:start:terminal-ownership',
      productFamilyId: 'constrained-dashed',
      recordKind: 'terminal-body-ownership-overlay',
      channel: 'evidence',
      visibleContributor: 'none-non-visible-ownership-overlay',
      geometryBasis: 'terminal-body-ownership-overlay',
      bodyProductId: bodyProduct.productId,
      legalSideId: bodyProduct.legalSideId,
      intervalId: bodyProduct.intervalId,
      splitRangeId: bodyProduct.splitRangeId,
      seamBoundaryId: seamBoundary.seamBoundaryId,
      terminalRole: 'start',
      endpointCapPolicy: terminalPolicy,
      joinOwnershipSignature: 'source-vertex:join-owned',
      ownerStepId: 'build-terminal-body-products',
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      evidence: {
        bodyProductOwnerStepId: 'build-dash-interval-body-products',
        seamBoundaryOwnerStepId: 'derive-dash-body-seam-boundaries',
        zeroVisibleContribution: true
      }
    })

    for (const forbiddenField of [
      'productId',
      'polygons',
      'bounds',
      'strokePaths',
      'paint',
      'capContributors'
    ]) {
      expect(overlays[0]).not.toHaveProperty(forbiddenField)
    }
    expect(overlays[0]).not.toBe(bodyProduct)
  })

  it('rejects middle bodies, invalid seams, empty ownership, duplicate bodies, and other families', () => {
    const terminal = buildBodyHandoff()
    const middle = buildBodyHandoff({
      intervalId: 'interval:middle',
      terminalRole: 'middle',
      endpointCapPolicy: middlePolicy
    })
    const invalidSeam = {
      ...terminal.seamBoundary,
      bodyProductId: 'body:other'
    }

    const overlays = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-30-filter',
      bindings: [
        {
          ...terminal,
          joinOwnershipSignature: 'source-vertex:join-owned'
        },
        {
          ...terminal,
          joinOwnershipSignature: 'source-vertex:join-owned'
        },
        {
          ...middle,
          joinOwnershipSignature: 'smooth'
        },
        {
          bodyProduct: terminal.bodyProduct,
          seamBoundary: invalidSeam,
          joinOwnershipSignature: 'source-vertex:join-owned'
        },
        {
          ...terminal,
          joinOwnershipSignature: ''
        }
      ]
    } as never)

    expect(overlays).toHaveLength(1)
    expect(
      buildTerminalBodyProducts({
        productFamilyId: 'center',
        cachePrefix: 'step-30-other-family',
        bindings: [
          {
            ...terminal,
            joinOwnershipSignature: 'source-vertex:join-owned'
          }
        ]
      } as never)
    ).toEqual([])
  })

  it('binds exact body programs to verified Step 28 seam references without geometry', () => {
    const runtime = constrainedDashedStrokePackets as unknown as {
      buildDashIntervalBodyGeometryProgramBatch?: (input: {
        cachePrefix: string
        strokeIndex: number
        items: Record<string, unknown>[]
      }) => Map<string, Record<string, unknown>>
      deriveDashBodyProgramSeamBoundaryArtifacts?: (
        programs: ReadonlyMap<string, Record<string, unknown>>
      ) => Record<string, unknown>[]
      buildTerminalBodyProgramOwnershipOverlays?: (input: {
        programsByIntervalId: ReadonlyMap<string, Record<string, unknown>>
        seamArtifactsByIntervalId: ReadonlyMap<
          string,
          Record<string, unknown>[]
        >
      }) => Record<string, unknown>[]
      appendTerminalBodyProgramOwnershipEvidence?: (input: {
        programsByIntervalId: ReadonlyMap<string, Record<string, unknown>>
        overlays: readonly Record<string, unknown>[]
      }) => Map<string, Record<string, unknown>>
    }
    expect(runtime.buildTerminalBodyProgramOwnershipOverlays).toBeTypeOf(
      'function'
    )
    expect(runtime.appendTerminalBodyProgramOwnershipEvidence).toBeTypeOf(
      'function'
    )
    if (
      !runtime.buildDashIntervalBodyGeometryProgramBatch ||
      !runtime.deriveDashBodyProgramSeamBoundaryArtifacts ||
      !runtime.buildTerminalBodyProgramOwnershipOverlays ||
      !runtime.appendTerminalBodyProgramOwnershipEvidence
    ) {
      return
    }

    const programs = runtime.buildDashIntervalBodyGeometryProgramBatch({
      cachePrefix: 'step-30-program',
      strokeIndex: 2,
      items: [
        {
          intervalId: 'interval:exact-terminal',
          strokePosition: 'inside',
          productDomainMode: 'closed-constrained-domain',
          legalSideId: 'legal-side:inside',
          path: { segments: [], closed: false, totalLength: 16 },
          interval: {
            startDistance: 0,
            endDistance: 16,
            wrapsSeam: false,
            domainPlanTerminalRole: 'start-end',
            domainPlanSplitRangeId: 'split:exact-terminal'
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
          authoredStrokeWidth: 8,
          materializationStyle: {
            width: 16,
            cap: 'round',
            join: 'miter',
            miterAngle: 30,
            miterLimit: 2,
            closed: false
          }
        }
      ]
    })
    const seamArtifacts =
      runtime.deriveDashBodyProgramSeamBoundaryArtifacts(programs)
    const seamArtifactsByIntervalId = new Map([
      ['interval:exact-terminal', seamArtifacts]
    ])
    const overlays = runtime.buildTerminalBodyProgramOwnershipOverlays({
      programsByIntervalId: programs,
      seamArtifactsByIntervalId
    })

    expect(overlays).toEqual([
      expect.objectContaining({
        overlayId:
          'step-30-program:2:interval:exact-terminal:body-program:terminal-ownership',
        bodyProductId:
          'step-30-program:2:interval:exact-terminal:body-program',
        intervalId: 'interval:exact-terminal',
        splitRangeId: 'split:exact-terminal',
        terminalRole: 'start-end',
        endpointCapPolicySignature: 'start-end:start-flat:end-flat',
        seamBoundaryIds: [
          'step-30-program:2:interval:exact-terminal:body-program:seam:start',
          'step-30-program:2:interval:exact-terminal:body-program:seam:end'
        ],
        channel: 'evidence',
        visibleContributor: 'none-non-visible-ownership-overlay',
        ownerStepId: 'build-terminal-body-products',
        zeroVisibleContribution: true,
        evidence: expect.objectContaining({
          zeroVisibleContribution: true
        })
      })
    ])
    for (const forbiddenField of [
      'polygons',
      'bounds',
      'strokePaths',
      'paint',
      'capContributors'
    ]) {
      expect(overlays[0]).not.toHaveProperty(forbiddenField)
    }

    const initialProgram = programs.get('interval:exact-terminal')
    const programsWithTerminalEvidence =
      runtime.appendTerminalBodyProgramOwnershipEvidence({
        programsByIntervalId: programs,
        overlays
      })
    const updatedProgram = programsWithTerminalEvidence.get(
      'interval:exact-terminal'
    )

    expect(initialProgram?.productEvidenceEnvelope).toMatchObject({
      terminalOwnershipOverlays: []
    })
    expect(updatedProgram).not.toBe(initialProgram)
    expect(updatedProgram?.productEvidenceEnvelope).toMatchObject({
      bodyProductIds: [
        'step-30-program:2:interval:exact-terminal:body-program'
      ],
      terminalOwnershipOverlays: [
        expect.objectContaining({
          overlayId:
            'step-30-program:2:interval:exact-terminal:body-program:terminal-ownership',
          bodyProductId:
            'step-30-program:2:interval:exact-terminal:body-program',
          ownerStepId: 'build-terminal-body-products',
          zeroVisibleContribution: true
        })
      ],
      smoothContinuityOwnershipOverlays: []
    })
    const appendedTerminalOverlay = (
      updatedProgram?.productEvidenceEnvelope as {
        terminalOwnershipOverlays?: Record<string, unknown>[]
      }
    )?.terminalOwnershipOverlays?.[0]
    for (const forbiddenEnvelopeField of [
      'endpointCapPolicy',
      'seamBoundaries',
      'ownerStage',
      'evidence',
      'path',
      'polygons'
    ]) {
      expect(appendedTerminalOverlay).not.toHaveProperty(
        forbiddenEnvelopeField
      )
    }

    const appendedTwice = runtime.appendTerminalBodyProgramOwnershipEvidence({
      programsByIntervalId: programsWithTerminalEvidence,
      overlays
    })
    expect(
      (
        appendedTwice.get('interval:exact-terminal')
          ?.productEvidenceEnvelope as {
          terminalOwnershipOverlays?: unknown[]
        }
      ).terminalOwnershipOverlays
    ).toHaveLength(1)
  })

  it('keeps the active runtime route overlay-only without terminal body packet materialization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const activeFamilySetup = extractBetween(
      source,
      'const dashBodyProgramSeamBoundaryArtifactsByIntervalId =',
      'const buildCoexecutedSourceVertexProductPackets = ('
    )
    const activeCoexecutionRoute = extractBetween(
      source,
      'const buildCoexecutedSourceVertexProductPackets = (',
      'const insideAggregateDescriptorIntervals ='
    )

    expect(activeFamilySetup).toContain('const terminalOwnershipOverlays =')
    expect(activeFamilySetup).toContain(
      'buildTerminalBodyProgramOwnershipOverlays('
    )
    expect(activeFamilySetup).toContain(
      'const dashBodyGeometryProgramsWithTerminalOwnershipByIntervalId ='
    )
    expect(activeFamilySetup).toContain(
      'appendTerminalBodyProgramOwnershipEvidence('
    )
    expect(activeFamilySetup).not.toContain(
      'buildConstrainedBoundaryTerminalPairJoinPlans('
    )
    expect(activeCoexecutionRoute).not.toContain(
      'const terminalOwnershipOverlays ='
    )
    expect(activeCoexecutionRoute.includes('terminalBodyPackets')).toBe(false)
    expect(
      activeCoexecutionRoute.includes('buildJoinOwnedTerminalBodyPacket(')
    ).toBe(false)
  })

  it('keeps boundary-terminal ownership out of the Step 29 join-plan collection', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const activeJoinPlanSetup = extractBetween(
      source,
      'const sourceVertexBoundaryTerminalRecords =',
      'const baseJoinDiagnostics ='
    )

    expect(activeJoinPlanSetup).not.toContain(
      'const terminalPairBoundaryJoinPlans ='
    )
    expect(activeJoinPlanSetup).not.toContain(
      '...terminalPairBoundaryJoinPlans'
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-terminal-body-products')
  })
})
