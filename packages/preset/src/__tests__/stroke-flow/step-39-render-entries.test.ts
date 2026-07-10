import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import {
  createGeometryBackendCapabilities,
  type ArrangementFace,
  type CandidateRegion,
  type PolygonRegion
} from '../../components/stroke-render/geometry-backend'

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
  crossStepArtifactLifecycleMatrix: Record<
    string,
    {
      artifactClassId: string
      computedAt: string
      preserveThrough: string[]
      consumedBy: string[]
      mustNotRecomputeAfter: string
      mayDropOnlyWhen: string[]
      dropEvidenceRequired: string[]
      downstreamAuthority: boolean
    }
  >
  wholeFlowReviewContract: {
    completionLedger: {
      segmentId: string
      status: string
      closureState: string
      contractStatus: string
      familyDataflowStatus: string
      runtimeStatus: string
      runtimeBlockers?: {
        stepId: string
        oracle: string
        missingRecordCount?: number
        status: string
      }[]
      runtimeEvidence?: {
        stepId: string
        oracle: string
        status: string
      }[]
    }[]
  }
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
const solidCenterSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts'
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

type RenderPacketInput = Parameters<
  typeof buildSolidCenterStrokeRenderEntriesFromRenderPackets
>[0][number]

type FinalFaceInput = Parameters<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[0][number]

type RenderEntryWithRuntimeOwnership = ReturnType<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[number] & {
  productIdentity?: {
    ownerStepIds: string[]
    intervalIds: string[]
    terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
    seamBoundaryIds: string[]
    sourceSpanIds: string[]
    sourceNetworkIds: string[]
    sourceContourIds: string[]
    legalDomainIds: string[]
    productEvidenceEnvelope?: typeof productEvidenceEnvelope
  }
  runtimeMeta?: {
    ownerStepIds?: string[]
    intervalIds?: string[]
    terminalRoles?: ('start' | 'end' | 'start-end' | 'middle')[]
    seamBoundaryIds?: string[]
    sourceSpanIds?: string[]
    sourceNetworkIds?: string[]
    sourceContourIds?: string[]
    legalDomainIds?: string[]
  }
}

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const evidencePolygon = [
  { x: 100, y: 100 },
  { x: 120, y: 100 },
  { x: 120, y: 120 },
  { x: 100, y: 120 }
]

const strokePathGroups = [
  {
    strokePaths: [[{ x: 0, y: 0 }]],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4,
      closed: false
    }
  }
]

const productEvidenceEnvelope = {
  bodyProductIds: ['body:render-entry'],
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
}

const descriptorVisiblePacket = {
  channel: 'render' as const,
  visibility: 'visible' as const,
  geometryId: 'geometry:descriptor',
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  stroke: {
    color: 0x777777,
    alpha: 0.75,
    gradientStyle: null,
    paintKey: 'paint:descriptor'
  },
  primaryOwner: {
    ownerKey: 'owner:descriptor',
    strokeId: 'stroke:descriptor'
  },
  ownerSet: [
    {
      ownerKey: 'owner:descriptor',
      strokeId: 'stroke:descriptor'
    }
  ],
  ownerStepIds: ['build-smooth-continuity-products'],
  intervalIds: ['interval:descriptor'],
  terminalRoles: ['middle'],
  seamBoundaryIds: ['seam:descriptor'],
  sourceSpanIds: ['span:descriptor'],
  sourceNetworkIds: ['network:descriptor'],
  sourceContourIds: ['contour:descriptor'],
  legalDomainIds: ['legal:descriptor'],
  productEvidenceEnvelope,
  descriptorRouteMode: 'descriptor-visible-route' as const,
  renderDescriptor: {
    strokePathGroups,
    strokeMaskPolygons: [evidencePolygon],
    fillClipPolygons: [evidencePolygon],
    fillExcludePolygons: [evidencePolygon],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4,
      closed: false
    }
  },
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'descriptor-visible-route',
    visibleContributor: 'declared visible strokePathGroups',
    productEvidenceEnvelope
  }
} satisfies RenderPacketInput

const canonicalPacket = {
  channel: 'render' as const,
  visibility: 'visible' as const,
  geometryId: 'geometry:canonical',
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  stroke: {
    color: 0x333333,
    alpha: 1,
    gradientStyle: null,
    paintKey: 'paint:canonical'
  },
  primaryOwner: {
    ownerKey: 'owner:canonical',
    strokeId: 'stroke:canonical'
  },
  ownerSet: [
    {
      ownerKey: 'owner:canonical',
      strokeId: 'stroke:canonical'
    }
  ],
  ownerStepIds: ['build-center-stroke-products'],
  intervalIds: ['interval:canonical'],
  terminalRoles: ['start-end'],
  seamBoundaryIds: [],
  sourceSpanIds: ['span:canonical'],
  sourceNetworkIds: ['network:canonical'],
  sourceContourIds: ['contour:canonical'],
  legalDomainIds: [],
  descriptorRouteMode: 'canonical-product' as const,
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'canonical-final-face'
  }
} satisfies RenderPacketInput

const ownershipFinalFace = {
  faceId: 'face:ownership',
  sourceGeometryIds: ['geometry:ownership'],
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  visualPacketKey: 'visual:ownership',
  paintKey: 'paint:ownership',
  strokeSpecKey: 'stroke-spec:ownership',
  ownerSet: [
    {
      ownerKey: 'owner:ownership',
      strokeId: 'stroke:ownership',
      intervalId: 'interval:ownership'
    }
  ],
  ownerStepIds: ['build-source-vertex-join-products'],
  intervalIds: ['interval:ownership'],
  terminalRoles: ['middle'],
  seamBoundaryIds: ['seam:ownership'],
  sourceSpanIds: ['source-span:ownership'],
  sourceNetworkIds: ['network:ownership'],
  sourceContourIds: ['contour:ownership'],
  legalDomainIds: ['legal-domain:ownership'],
  productEvidenceEnvelope,
  productMode: 'post-legality-product',
  productSignature: 'canonical-final-face',
  domainMode: 'center',
  topologyFamily: 'open',
  paint: {
    geometryId: 'geometry:ownership',
    color: 0x4488cc,
    alpha: 1,
    gradientStyle: null,
    paintKey: 'paint:ownership'
  },
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'canonical-final-face',
    domainMode: 'center',
    topologyFamily: 'open',
    strokePosition: 'center',
    productEvidenceEnvelope,
    revisionSet: {
      geometryRevision: 1,
      paintRevision: 1,
      dashAndGapRevision: 1,
      topologyRevision: 1,
      strokeSemanticsRevision: 1
    }
  }
} satisfies FinalFaceInput

const outsideDescriptorFinalFace = {
  ...ownershipFinalFace,
  faceId: 'face:outside-descriptor',
  sourceGeometryIds: ['geometry:outside-descriptor'],
  visualPacketKey: 'visual:outside-descriptor',
  paintKey: 'paint:outside-descriptor',
  strokeSpecKey: 'stroke-spec:outside-descriptor',
  ownerSet: [
    {
      ownerKey: 'owner:outside-descriptor',
      strokeId: 'stroke:outside-descriptor',
      intervalId: 'interval:outside-descriptor'
    }
  ],
  intervalIds: ['interval:outside-descriptor'],
  sourceSpanIds: ['source-span:outside-descriptor'],
  sourceNetworkIds: ['network:outside-descriptor'],
  sourceContourIds: ['contour:outside-descriptor'],
  legalDomainIds: ['legal-domain:outside-descriptor'],
  productSignature: 'constrained-dashed-outside-descriptor',
  domainMode: 'outside',
  topologyFamily: 'self-intersecting',
  renderDescriptor: {
    strokePathGroups,
    descriptorProductPolygons: [evidencePolygon],
    clipPolygons: [evidencePolygon],
    fillExcludePolygons: [evidencePolygon],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'bevel' as const,
      miterAngle: 28,
      miterLimit: 4,
      closed: false
    }
  },
  debugMeta: {
    ...ownershipFinalFace.debugMeta,
    productSignature: 'constrained-dashed-outside-descriptor',
    domainMode: 'outside',
    topologyFamily: 'self-intersecting',
    strokePosition: 'outside' as const,
    strokeWidth: 10,
    strokeJoin: 'bevel' as const,
    strokeCap: 'butt' as const,
    visibleContributor: 'dash-interval-body',
    routeId: 'render-entries'
  }
} satisfies FinalFaceInput

const overlapProbePolygon = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 30, y: 30 },
  { x: 10, y: 30 }
]

const adjacentVisiblePolygon = [
  { x: 20, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 20 },
  { x: 20, y: 20 }
]

const mergedAdjacentVisiblePolygon = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 20 },
  { x: 0, y: 20 }
]

const mergedOverlapProbePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 10 },
  { x: 30, y: 10 },
  { x: 30, y: 30 },
  { x: 10, y: 30 },
  { x: 10, y: 20 },
  { x: 0, y: 20 }
]

const disjointLegalDomainPolygon = [
  { x: 100, y: 100 },
  { x: 120, y: 100 },
  { x: 120, y: 120 },
  { x: 100, y: 120 }
]

const outsideArrangementFace = (
  faceId: string,
  polygons: (typeof visiblePolygon)[],
  claimedBy: CandidateRegion[]
): ArrangementFace => ({
  faceId,
  geometry: { polygons },
  claimedBy,
  legalState: {
    insideFillDomain: false,
    outsideFillDomain: true
  }
})

const regionsContainEvidencePolygon = (regions: readonly PolygonRegion[]) =>
  regions.some((region) =>
    region.polygons.some(
      (polygon) => polygon[0]?.x === 100 && polygon[0]?.y === 100
    )
  )

const outsidePolygonFace = (faceId: string, polygon: typeof visiblePolygon) =>
  ({
    ...ownershipFinalFace,
    faceId,
    sourceGeometryIds: [`geometry:${faceId}`],
    polygons: [polygon],
    bounds: {
      minX: Math.min(...polygon.map((point) => point.x)),
      minY: Math.min(...polygon.map((point) => point.y)),
      maxX: Math.max(...polygon.map((point) => point.x)),
      maxY: Math.max(...polygon.map((point) => point.y))
    },
    visualPacketKey: `visual:${faceId}`,
    ownerSet: [
      {
        ownerKey: `owner:${faceId}`,
        strokeId: 'stroke:outside-overlap',
        intervalId: `interval:${faceId}`
      }
    ],
    intervalIds: [`interval:${faceId}`],
    productSignature: `constrained-dashed:outside:${faceId}`,
    domainMode: 'outside',
    topologyFamily: 'self-intersecting',
    debugMeta: {
      ...ownershipFinalFace.debugMeta,
      productSignature: `constrained-dashed:outside:${faceId}`,
      domainMode: 'outside',
      topologyFamily: 'self-intersecting',
      strokePosition: 'outside' as const,
      strokeWidth: 10,
      strokeJoin: 'bevel' as const,
      strokeCap: 'butt' as const,
      visibleContributor: 'dash-interval-body'
    }
  }) satisfies FinalFaceInput

const outsideDescriptorFace = (
  faceId: string,
  polygon: typeof visiblePolygon
) =>
  ({
    ...outsidePolygonFace(faceId, polygon),
    renderDescriptor: {
      descriptorProductPolygons: [polygon],
      clipPolygons: [polygon],
      strokePathGroups: [
        {
          strokePaths: [
            [
              { x: polygon[0].x, y: polygon[0].y + 10 },
              { x: polygon[1].x, y: polygon[1].y + 10 }
            ]
          ],
          strokePathStyle: {
            width: 10,
            cap: 'butt' as const,
            join: 'bevel' as const,
            miterAngle: 28,
            miterLimit: 4,
            closed: false
          }
        }
      ]
    }
  }) satisfies FinalFaceInput

describe('stroke flow step 39: render-entries', () => {
  it('keeps render-entries as the thirty-ninth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'render-entries')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual(['render-entries'])
    }
  })

  it('declares the exact render-entry implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'render-entries')

    expect(step).toMatchObject({
      ownerStage: 'Product Output render-entry materialization',
      allowedInputs: [
        'visible render packets',
        'renderDescriptor strokePathGroups, strokePaths, strokeMaskPolygons, descriptorProductPolygons, fillClipPolygons, fillExcludePolygons, and product metadata',
        'final-face product identity set with body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal-domain, and source-span ids',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'final-face preserved dash-body seam-boundary artifact for coverage-equivalence proof only'
      ],
      requiredOutputs: [
        'renderer-ready strokePathGroups or strokePaths for descriptor-visible routes',
        'renderer-ready strokeMaskPolygons only for visible polygon or cap-mask routes',
        'fillClip/fillExclude constraints and descriptor evidence carried separately',
        'render-entry product identity set preserving every consumed body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal-domain, and source-span id',
        'unchanged ConstrainedDashedProductEvidenceEnvelope on render-entry evidence metadata'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'descriptorProductPolygons evidence-only reason when strokePathGroups exist',
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap',
        'terminal half-dash and seam-boundary identity parity between consumed final faces and emitted render entries'
      ])
    )
  })

  it('declares render entries as the final stage for visible overlap and alpha decisions', () => {
    const data = loadInspectorData()
    const route = routeById(data, 'canonical-final-face-render-entry')

    expect(route.cacheKeyInputs).toContain('same-paint overlap signature')
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap'
      ])
    )
    expect(route.limitations.join(' ')).toContain(
      'Same-paint overlap must be resolved as a single-composite render entry or carry equivalent alpha-safe evidence before renderer projection.'
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'render-entries',
      consumesArtifacts: ['artifact:finalFaces'],
      producesArtifacts: ['artifact:renderEntries'],
      consumedBy: ['renderer-projection'],
      mustNotRecomputeAfter: 'renderer-projection'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'join shape decision',
        'cap shape decision',
        'same-paint alpha decision without render-entry evidence',
        'descriptor evidence promotion'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('requires final-face identity parity while keeping broader runtime gates separate', () => {
    const data = loadInspectorData()
    const lifecycle =
      data.crossStepArtifactLifecycleMatrix['artifact:renderEntries']
    const outputLedger = data.wholeFlowReviewContract.completionLedger.find(
      (entry) => entry.segmentId === 'output-channels'
    )

    expect(lifecycle).toMatchObject({
      artifactClassId: 'required-product-artifact',
      computedAt: 'render-entries',
      mustNotRecomputeAfter: 'renderer-projection',
      downstreamAuthority: true
    })
    expect(lifecycle.dropEvidenceRequired).toEqual(
      expect.arrayContaining([
        'render-entry id',
        'consumed final-face id',
        'owner / interval / terminal / seam / legal-domain / source-span parity evidence'
      ])
    )
    expect(outputLedger).toMatchObject({
      status: 'implementation-ready',
      closureState: 'implementation-ready',
      contractStatus: 'contract-closed',
      familyDataflowStatus: 'family-dataflow-closed',
      runtimeStatus: 'pending-runtime-gates'
    })
    expect(outputLedger?.runtimeEvidence).toEqual([])
    expect(outputLedger?.runtimeBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepId: 'render-entries',
          oracle: 'constrained-dashed-batched-body-output-channel-gate',
          status: 'pending-runtime-repair'
        })
      ])
    )
  })

  it('keeps strokePathGroups as the visible descriptor route without promoting evidence to strokeMaskPolygons', () => {
    const [entry] = buildSolidCenterStrokeRenderEntriesFromRenderPackets([
      descriptorVisiblePacket
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        channel: 'render-entry',
        visibility: 'visible',
        cacheKey: 'geometry:descriptor',
        polygons: [visiblePolygon],
        stroke: descriptorVisiblePacket.stroke,
        strokePathGroups,
        fillClipPolygons: [evidencePolygon],
        fillExcludePolygons: [evidencePolygon],
        strokePathStyle: {
          width: 10,
          cap: 'butt',
          join: 'miter',
          miterLimit: 4,
          closed: false
        },
        evidenceChannel: {
          descriptorProductPolygonsVisible: false,
          reason: 'descriptor-visible-route'
        },
        productIdentity: expect.objectContaining({
          primaryOwner: descriptorVisiblePacket.primaryOwner,
          ownerSet: descriptorVisiblePacket.ownerSet,
          ownerStepIds: ['build-smooth-continuity-products'],
          intervalIds: ['interval:descriptor'],
          terminalRoles: ['middle'],
          seamBoundaryIds: ['seam:descriptor'],
          sourceSpanIds: ['span:descriptor'],
          sourceNetworkIds: ['network:descriptor'],
          sourceContourIds: ['contour:descriptor'],
          legalDomainIds: ['legal:descriptor'],
          productEvidenceEnvelope
        })
      })
    )
    expect(entry?.strokeMaskPolygons).toBeUndefined()
    expect(entry?.productIdentity.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
  })

  it('uses strokeMaskPolygons only for canonical visible polygon routes', () => {
    const [entry] = buildSolidCenterStrokeRenderEntriesFromRenderPackets([
      canonicalPacket
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        channel: 'render-entry',
        visibility: 'visible',
        cacheKey: 'geometry:canonical',
        strokeMaskPolygons: [visiblePolygon],
        evidenceChannel: {
          descriptorProductPolygonsVisible: false,
          reason: 'canonical-visible-product'
        },
        productIdentity: expect.objectContaining({
          primaryOwner: canonicalPacket.primaryOwner,
          ownerSet: canonicalPacket.ownerSet,
          ownerStepIds: ['build-center-stroke-products'],
          intervalIds: ['interval:canonical'],
          terminalRoles: ['start-end'],
          seamBoundaryIds: [],
          sourceSpanIds: ['span:canonical'],
          sourceNetworkIds: ['network:canonical'],
          sourceContourIds: ['contour:canonical'],
          legalDomainIds: []
        })
      })
    )
    expect(entry).not.toHaveProperty('strokePathGroups')
    expect(entry).not.toHaveProperty('strokePaths')
  })

  it('carries final-face ownership metadata into render-entry runtime metadata', () => {
    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      ownershipFinalFace
    ]) as RenderEntryWithRuntimeOwnership[]

    expect(entry?.runtimeMeta).toMatchObject({
      ownerStepIds: ['build-source-vertex-join-products'],
      intervalIds: ['interval:ownership'],
      terminalRoles: ['middle'],
      seamBoundaryIds: ['seam:ownership'],
      sourceSpanIds: ['source-span:ownership'],
      sourceNetworkIds: ['network:ownership'],
      sourceContourIds: ['contour:ownership'],
      legalDomainIds: ['legal-domain:ownership']
    })
    expect(entry?.productIdentity?.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
    expect(entry?.productIdentity).toMatchObject({
      ownerStepIds: ['build-source-vertex-join-products'],
      intervalIds: ['interval:ownership'],
      terminalRoles: ['middle'],
      seamBoundaryIds: ['seam:ownership'],
      sourceSpanIds: ['source-span:ownership'],
      sourceNetworkIds: ['network:ownership'],
      sourceContourIds: ['contour:ownership'],
      legalDomainIds: ['legal-domain:ownership'],
      productEvidenceEnvelope
    })
    expect(entry?.debugMeta?.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
  })

  it('merges every constrained-dashed evidence envelope when same-paint final faces collapse', () => {
    const createEvidenceEnvelope = (
      suffix: string,
      terminalRole: 'start' | 'end'
    ) => ({
      bodyProductIds: [`body:${suffix}`],
      terminalOwnershipOverlays: [
        {
          overlayId: `terminal-overlay:${suffix}`,
          bodyProductId: `body:${suffix}`,
          intervalId: `interval:${suffix}`,
          terminalRole,
          endpointCapPolicySignature: `cap-policy:${suffix}`,
          seamBoundaryIds: [`seam:${suffix}`],
          joinOwnershipSignatures: [`join-owner:${suffix}`],
          ownerStepId: 'build-terminal-body-products' as const,
          zeroVisibleContribution: true as const
        }
      ],
      smoothContinuityOwnershipOverlays: []
    })
    const firstEnvelope = createEvidenceEnvelope('merge-a', 'start')
    const secondEnvelope = createEvidenceEnvelope('merge-b', 'end')
    const firstFace = {
      ...outsidePolygonFace('evidence-envelope-merge-a', visiblePolygon),
      productEvidenceEnvelope: firstEnvelope,
      debugMeta: {
        ...outsidePolygonFace('evidence-envelope-merge-a', visiblePolygon)
          .debugMeta,
        productEvidenceEnvelope: firstEnvelope
      }
    } satisfies FinalFaceInput
    const secondFace = {
      ...outsidePolygonFace(
        'evidence-envelope-merge-b',
        adjacentVisiblePolygon
      ),
      ownerSet: firstFace.ownerSet,
      productEvidenceEnvelope: secondEnvelope,
      debugMeta: {
        ...outsidePolygonFace(
          'evidence-envelope-merge-b',
          adjacentVisiblePolygon
        ).debugMeta,
        productEvidenceEnvelope: secondEnvelope
      }
    } satisfies FinalFaceInput
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (): PolygonRegion[] => [
        { polygons: [mergedAdjacentVisiblePolygon] }
      ],
      intersection: (): PolygonRegion[] => []
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [firstFace, secondFace],
      { exactBackend }
    ) as RenderEntryWithRuntimeOwnership[]
    const [entry] = entries

    const expectedEnvelope = {
      bodyProductIds: ['body:merge-a', 'body:merge-b'],
      terminalOwnershipOverlays: [
        ...firstEnvelope.terminalOwnershipOverlays,
        ...secondEnvelope.terminalOwnershipOverlays
      ],
      smoothContinuityOwnershipOverlays: []
    }
    expect(entries).toHaveLength(1)
    expect(entry?.productIdentity?.productEvidenceEnvelope).toEqual(
      expectedEnvelope
    )
    expect(entry?.debugMeta?.productEvidenceEnvelope).toEqual(expectedEnvelope)
  })

  it('preserves one shared constrained-dashed evidence envelope by identity when same-paint final faces collapse', () => {
    const sharedEnvelope = {
      bodyProductIds: ['body:shared-envelope'],
      terminalOwnershipOverlays: [],
      smoothContinuityOwnershipOverlays: []
    }
    const firstFace = {
      ...outsidePolygonFace('shared-envelope-a', visiblePolygon),
      productEvidenceEnvelope: sharedEnvelope,
      debugMeta: {
        ...outsidePolygonFace('shared-envelope-a', visiblePolygon).debugMeta,
        productEvidenceEnvelope: sharedEnvelope
      }
    } satisfies FinalFaceInput
    const secondFace = {
      ...outsidePolygonFace('shared-envelope-b', adjacentVisiblePolygon),
      ownerSet: firstFace.ownerSet,
      productEvidenceEnvelope: sharedEnvelope,
      debugMeta: {
        ...outsidePolygonFace('shared-envelope-b', adjacentVisiblePolygon)
          .debugMeta,
        productEvidenceEnvelope: sharedEnvelope
      }
    } satisfies FinalFaceInput
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (): PolygonRegion[] => [
        { polygons: [mergedAdjacentVisiblePolygon] }
      ],
      intersection: (): PolygonRegion[] => []
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [firstFace, secondFace],
      { exactBackend }
    ) as RenderEntryWithRuntimeOwnership[]

    expect(entries).toHaveLength(1)
    expect(entries[0]?.productIdentity?.productEvidenceEnvelope).toBe(
      sharedEnvelope
    )
    expect(entries[0]?.debugMeta?.productEvidenceEnvelope).toBe(sharedEnvelope)
  })

  it('uses a bounded broad phase before testing many disjoint same-paint render entries', () => {
    const faceCount = 128
    const sharedOwnerSet = outsidePolygonFace(
      'broad-phase-owner',
      visiblePolygon
    ).ownerSet
    const faces = Array.from({ length: faceCount }, (_, index) => {
      const minX = index * 40
      const face = outsidePolygonFace(`broad-phase-${index}`, [
        { x: minX, y: 0 },
        { x: minX + 20, y: 0 },
        { x: minX + 20, y: 20 },
        { x: minX, y: 20 }
      ])
      return {
        ...face,
        ownerSet: sharedOwnerSet,
        productSignature: `constrained-dashed:inside:broad-phase-${index}`,
        domainMode: 'inside',
        debugMeta: {
          ...face.debugMeta,
          productSignature: `constrained-dashed:inside:broad-phase-${index}`,
          domainMode: 'inside',
          strokePosition: 'inside' as const
        }
      }
    })
    const counters: Record<string, number> = {}
    const globalRecord = globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value?: number
      ) => void
    }
    const previousCounterSink = globalRecord.__asyraStrokePipelineCounterSink
    globalRecord.__asyraStrokePipelineCounterSink = (
      counterName,
      value = 1
    ) => {
      counters[counterName] = (counters[counterName] ?? 0) + value
    }

    try {
      const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(faces, {
        exactBackend: {
          capabilities: createGeometryBackendCapabilities(true),
          intersection: () => {
            throw new Error('disjoint broad-phase entries must not intersect')
          }
        }
      })

      expect(entries).toHaveLength(faceCount)
      expect(
        counters['render-entry-overlap-broad-phase-entry-count'] ?? -1
      ).toBe(faceCount)
      expect(
        counters['render-entry-overlap-broad-phase-pair-check-count'] ?? -1
      ).toBeLessThanOrEqual(faceCount)
    } finally {
      globalRecord.__asyraStrokePipelineCounterSink = previousCounterSink
    }
  })

  it('projects finalized single-face dash interval evidence without rebuilding it', () => {
    const dashProductIntervals = [
      {
        intervalId: 'interval:finalized-single-face',
        terminalRole: 'middle' as const,
        splitRangeId: 'split-range:finalized-single-face',
        sourceSegmentIndex: 2,
        sourceStartDistance: 12,
        sourceEndDistance: 20
      }
    ]
    const finalizedEvidenceFace = {
      ...ownershipFinalFace,
      faceId: 'face:finalized-single-face-evidence',
      intervalIds: ['interval:finalized-single-face'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:finalized-single-face',
        intervalIds: ['interval:finalized-single-face'],
        dashProductIntervals
      }
    } satisfies FinalFaceInput

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      finalizedEvidenceFace
    ])

    expect(entry?.debugMeta?.dashProductIntervals).toBe(dashProductIntervals)
    expect(entry?.debugMeta?.dashProductIntervals).toEqual([
      expect.objectContaining({
        intervalId: 'interval:finalized-single-face',
        splitRangeId: 'split-range:finalized-single-face',
        sourceSegmentIndex: 2,
        sourceStartDistance: 12,
        sourceEndDistance: 20
      })
    ])
  })

  it('preserves post-legality inside constrained dashed final faces without per-face legal reclip', () => {
    let intersectionCalls = 0
    const insideFinalFace = {
      ...ownershipFinalFace,
      faceId: 'face:inside-post-legality',
      sourceGeometryIds: ['geometry:inside-post-legality'],
      visualPacketKey: 'visual:inside-post-legality',
      ownerStepIds: ['build-dash-interval-body-products'],
      intervalIds: ['interval:inside-post-legality'],
      legalDomainIds: ['legal-domain:inside-post-legality'],
      productSignature: 'constrained-dashed:inside:dash-body',
      domainMode: 'inside',
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productMode: 'post-legality-product',
        productSignature: 'constrained-dashed:inside:dash-body',
        domainMode: 'inside',
        strokePosition: 'inside' as const,
        visibleContributor: 'dash-interval-body' as const,
        routeId: 'constrained-dashed-dash-interval-body-product'
      }
    } satisfies FinalFaceInput
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => regions,
      intersection: (subject: PolygonRegion[]): PolygonRegion[] => {
        intersectionCalls += 1
        return subject
      },
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] =>
        candidates.map((candidate, index) =>
          outsideArrangementFace(
            `arrangement:inside-post-legality:${index}`,
            candidate.geometry.polygons,
            [candidate]
          )
        )
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [insideFinalFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:inside-post-legality',
            fillRule: 'nonzero',
            regions: [{ polygons: [visiblePolygon] }]
          }
        ]
      }
    )

    expect(intersectionCalls).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.polygons).toEqual([visiblePolygon])
    expect(entries[0]?.runtimeMeta).toMatchObject({
      intervalIds: ['interval:inside-post-legality'],
      legalDomainIds: ['legal-domain:inside-post-legality']
    })
  })

  it('projects inside constrained solid descriptor paths without reclipping evidence polygons', () => {
    let intersectionCalls = 0
    const insideDescriptorFace = {
      ...ownershipFinalFace,
      faceId: 'face:inside-solid-descriptor',
      sourceGeometryIds: ['geometry:inside-solid-descriptor'],
      visualPacketKey: 'visual:inside-solid-descriptor',
      ownerStepIds: ['build-constrained-solid-products'],
      intervalIds: ['solid-mask:inside'],
      legalDomainIds: ['legal-domain:inside-solid-descriptor'],
      productMode: 'closed-constrained-domain',
      productSignature: 'constrained-solid:inside:mask-model',
      domainMode: 'closed-constrained-domain',
      topologyFamily: 'self-intersecting',
      renderDescriptor: {
        strokePathGroups,
        descriptorProductPolygons: [evidencePolygon],
        fillClipPolygons: [visiblePolygon]
      },
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productMode: 'closed-constrained-domain',
        productSignature: 'constrained-solid:inside:mask-model',
        domainMode: 'closed-constrained-domain',
        topologyFamily: 'self-intersecting',
        strokePosition: 'inside' as const,
        routeId: 'constrained-solid-same-owner-smooth-span-descriptor',
        solidMaskModelMaskApplication: 'render-fill-mask' as const,
        solidMaskModelVisibleRender: 'masked-source-stroke' as const
      }
    } satisfies FinalFaceInput
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => regions,
      intersection: (subject: PolygonRegion[]): PolygonRegion[] => {
        intersectionCalls += 1
        return subject
      }
    }

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [insideDescriptorFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:inside-solid-descriptor',
            fillRule: 'nonzero',
            regions: [{ polygons: [visiblePolygon] }]
          }
        ]
      }
    )

    expect(intersectionCalls).toBe(0)
    expect(entry).toMatchObject({
      polygons: [visiblePolygon],
      strokePathGroups,
      fillClipPolygons: [visiblePolygon]
    })
    expect(entry?.strokeMaskPolygons).toBeUndefined()
  })

  it('keeps visible constrained dashed descriptor carrier polygons out of canonical union', () => {
    const carrierPolygons = [visiblePolygon, adjacentVisiblePolygon]
    const insideDescriptorFace = {
      ...outsideDescriptorFinalFace,
      faceId: 'face:inside-visible-descriptor-carrier',
      polygons: carrierPolygons,
      productSignature: 'constrained-dashed:inside:aggregate-descriptor',
      domainMode: 'inside',
      renderDescriptor: {
        ...outsideDescriptorFinalFace.renderDescriptor,
        fillClipPolygons: [evidencePolygon],
        fillExcludePolygons: undefined
      },
      debugMeta: {
        ...outsideDescriptorFinalFace.debugMeta,
        productSignature: 'constrained-dashed:inside:aggregate-descriptor',
        domainMode: 'inside',
        strokePosition: 'inside' as const
      }
    } satisfies FinalFaceInput

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      insideDescriptorFace
    ])

    expect(entry?.strokePathGroups).toBe(strokePathGroups)
    expect(entry?.polygons).toBe(carrierPolygons)
    expect(entry?.fillClipPolygons).toEqual([evidencePolygon])
    expect(entry?.strokeMaskPolygons).toBeUndefined()
  })

  it('preserves merged dashed-center owner, terminal, and seam identity', () => {
    const firstFace = {
      ...ownershipFinalFace,
      faceId: 'face:dashed-center:start',
      sourceGeometryIds: ['geometry:dashed-center:start'],
      visualPacketKey: 'visual:dashed-center:start',
      ownerStepIds: ['build-dash-interval-body-products'],
      intervalIds: ['interval:dashed-center:start'],
      terminalRoles: ['start'],
      seamBoundaryIds: ['seam:dashed-center:start'],
      renderDescriptor: { strokePathGroups },
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productMode: 'center-product',
        productSignature: 'center-product:dashed'
      }
    } satisfies FinalFaceInput
    const secondFace = {
      ...firstFace,
      faceId: 'face:dashed-center:end',
      sourceGeometryIds: ['geometry:dashed-center:end'],
      visualPacketKey: 'visual:dashed-center:end',
      intervalIds: ['interval:dashed-center:end'],
      terminalRoles: ['end'],
      seamBoundaryIds: ['seam:dashed-center:end']
    } satisfies FinalFaceInput

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      firstFace,
      secondFace
    ]) as RenderEntryWithRuntimeOwnership[]

    expect(entries).toHaveLength(1)
    expect(entries[0].runtimeMeta).toMatchObject({
      ownerStepIds: ['build-dash-interval-body-products'],
      terminalRoles: ['start', 'end'],
      seamBoundaryIds: ['seam:dashed-center:start', 'seam:dashed-center:end']
    })
    expect(entries[0].productIdentity).toMatchObject({
      ownerStepIds: ['build-dash-interval-body-products'],
      intervalIds: [
        'interval:dashed-center:start',
        'interval:dashed-center:end'
      ],
      terminalRoles: ['start', 'end'],
      seamBoundaryIds: ['seam:dashed-center:start', 'seam:dashed-center:end']
    })
  })

  it('keeps constrained outside dashed descriptor strokePathGroups visible without polygon collapse', () => {
    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      outsideDescriptorFinalFace
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        strokePathGroups,
        fillExcludePolygons: [evidencePolygon]
      })
    )
    expect(entry?.polygons).toEqual([visiblePolygon])
    expect(entry?.strokeMaskPolygons).toBeUndefined()
    expect(entry?.runtimeMeta).toMatchObject({
      intervalIds: ['interval:outside-descriptor'],
      sourceSpanIds: ['source-span:outside-descriptor'],
      sourceNetworkIds: ['network:outside-descriptor'],
      sourceContourIds: ['contour:outside-descriptor'],
      legalDomainIds: ['legal-domain:outside-descriptor']
    })
  })

  it('bypasses constrained dashed descriptor overlap collapse when strokePathGroups own visible output', () => {
    let intersectionCalls = 0
    let unionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        unionCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsideDescriptorFace('outside-descriptor-a', visiblePolygon),
        outsideDescriptorFace('outside-descriptor-b', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(intersectionCalls).toBe(0)
    expect(unionCalls).toBe(0)
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.polygons)).toEqual([
      [visiblePolygon],
      [overlapProbePolygon]
    ])
    expect(entries.every((entry) => entry.strokePathGroups?.length === 1)).toBe(
      true
    )
    expect(
      entries.every((entry) => entry.strokeMaskPolygons === undefined)
    ).toBe(true)
  })

  it('keeps constrained dashed descriptor faces out of mixed polygon collapse groups', () => {
    let intersectionCalls = 0
    let unionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        unionCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsideDescriptorFace('outside-descriptor-mixed', visiblePolygon),
        outsidePolygonFace('outside-polygon-mixed', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(intersectionCalls).toBe(0)
    expect(unionCalls).toBe(0)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        polygons: [visiblePolygon],
        strokePathGroups: expect.any(Array),
        strokeMaskPolygons: undefined
      })
    )
    expect(entries[1]).toEqual(
      expect.objectContaining({
        polygons: [overlapProbePolygon],
        strokePathGroups: undefined
      })
    )
  })

  it('batches same-paint inside canonical products beside a visible descriptor without pairwise overlap tests', () => {
    const containedPolygon = [
      { x: 5, y: 5 },
      { x: 5, y: 15 },
      { x: 15, y: 15 },
      { x: 15, y: 5 }
    ]
    const insideDescriptorFace = {
      ...outsideDescriptorFinalFace,
      faceId: 'face:inside-batched-descriptor',
      paintKey: ownershipFinalFace.paintKey,
      paint: ownershipFinalFace.paint,
      ownerSet: ownershipFinalFace.ownerSet,
      productSignature: 'constrained-dashed:inside:aggregate-descriptor',
      domainMode: 'inside',
      renderDescriptor: {
        ...outsideDescriptorFinalFace.renderDescriptor,
        clipPolygons: undefined,
        fillClipPolygons: [visiblePolygon],
        fillExcludePolygons: undefined
      },
      debugMeta: {
        ...outsideDescriptorFinalFace.debugMeta,
        productSignature: 'constrained-dashed:inside:aggregate-descriptor',
        domainMode: 'inside',
        strokePosition: 'inside' as const
      }
    } satisfies FinalFaceInput
    const outerCanonicalFace = {
      ...outsidePolygonFace('inside-batched-outer', visiblePolygon),
      ownerSet: ownershipFinalFace.ownerSet,
      intervalIds: ['interval:inside-batched-outer'],
      productSignature: 'constrained-dashed:inside:source-vertex-join',
      domainMode: 'inside',
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:inside-batched-outer',
        intervalIds: ['interval:inside-batched-outer'],
        productSignature: 'constrained-dashed:inside:source-vertex-join',
        domainMode: 'inside',
        strokePosition: 'inside' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const,
        joinOwnershipRecords: [
          {
            kind: 'source-vertex' as const,
            materializationKind: 'join' as const,
            area: 400,
            bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
            intervalIds: ['interval:inside-batched-outer'],
            selectedSide: 1 as const,
            domainKey: 'source-vertex:inside-batched'
          }
        ],
        joinOwnershipSignatures: ['source-vertex:inside-batched']
      }
    } satisfies FinalFaceInput
    const innerCanonicalFace = {
      ...outsidePolygonFace('inside-batched-terminal', containedPolygon),
      ownerSet: outerCanonicalFace.ownerSet,
      intervalIds: ['interval:inside-batched-terminal'],
      productSignature: 'constrained-dashed:inside:terminal-body',
      domainMode: 'inside',
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:inside-batched-terminal',
        intervalIds: ['interval:inside-batched-terminal'],
        productSignature: 'constrained-dashed:inside:terminal-body',
        domainMode: 'inside',
        strokePosition: 'inside' as const,
        routeId: 'constrained-dashed-join-owned-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const,
        geometryBasis: 'terminal-dash-interval-body' as const
      }
    } satisfies FinalFaceInput
    let intersectionCalls = 0
    let unionCalls = 0
    let differenceCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: (): PolygonRegion[] => {
        intersectionCalls += 1
        return [{ polygons: [containedPolygon] }]
      },
      union: (regions: PolygonRegion[]): PolygonRegion[] => {
        unionCalls += 1
        return regions
      },
      difference: (): PolygonRegion[] => {
        differenceCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [insideDescriptorFace, outerCanonicalFace, innerCanonicalFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:inside-batched',
            fillRule: 'nonzero',
            regions: [{ polygons: [visiblePolygon] }]
          }
        ]
      }
    ) as RenderEntryWithRuntimeOwnership[]

    expect(intersectionCalls).toBe(0)
    expect(unionCalls).toBe(0)
    expect(differenceCalls).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        strokePathGroups: expect.any(Array),
        strokeMaskPolygons: [visiblePolygon, containedPolygon],
        fillClipPolygons: [visiblePolygon],
        runtimeMeta: expect.objectContaining({
          ownerStage: 'Product Output render-entry materialization',
          routeId: 'constrained-dashed-inside-mask-descriptor',
          visibleContributor: 'visible strokePathGroups',
          geometryBasis: 'declared route product contract'
        })
      })
    )
    expect(entries[0]?.strokeMaskPolygons).not.toContain(evidencePolygon)
    expect(entries[0]?.productIdentity?.intervalIds).toEqual(
      expect.arrayContaining([
        'interval:outside-descriptor',
        'interval:inside-batched-outer',
        'interval:inside-batched-terminal'
      ])
    )
    expect(entries[0]?.debugMeta?.joinOwnershipRecords).toEqual([
      expect.objectContaining({
        kind: 'source-vertex',
        materializationKind: 'join',
        intervalIds: ['interval:inside-batched-outer'],
        domainKey: 'source-vertex:inside-batched'
      })
    ])
    expect(entries[0]?.debugMeta?.joinOwnershipSignatures).toContain(
      'source-vertex:inside-batched'
    )
  })

  it('re-proves an exact inside composite after legal-domain splitter clipping', () => {
    const containedPolygon = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 }
    ]
    const illegalCompositePolygon = [
      { x: 0, y: 0 },
      { x: 21, y: 0 },
      { x: 21, y: 20 },
      { x: 0, y: 20 }
    ]
    const wrongSideResidue = [
      { x: 20, y: 0 },
      { x: 21, y: 0 },
      { x: 21, y: 20 },
      { x: 20, y: 20 }
    ]
    const buildInsideFace = (
      faceId: string,
      intervalId: string,
      polygons: typeof visiblePolygon[]
    ) =>
      ({
        ...ownershipFinalFace,
        faceId,
        sourceGeometryIds: [`geometry:${faceId}`],
        polygons,
        visualPacketKey: 'visual:inside-exact-composite',
        intervalIds: [intervalId],
        legalDomainIds: ['legal-domain:inside-exact-composite'],
        productSignature: 'constrained-dashed:inside:canonical',
        domainMode: 'inside',
        debugMeta: {
          ...ownershipFinalFace.debugMeta,
          intervalId,
          intervalIds: [intervalId],
          legalDomainIds: ['legal-domain:inside-exact-composite'],
          productSignature: 'constrained-dashed:inside:canonical',
          domainMode: 'inside',
          strokePosition: 'inside' as const,
          routeId: 'constrained-dashed-source-vertex-join-product',
          visibleContributor: 'source-vertex-join' as const,
          geometryBasis: 'canonical-join-footprint' as const
        }
      }) satisfies FinalFaceInput
    let unionCalls = 0
    let intersectionCalls = 0
    let differenceCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (): PolygonRegion[] => {
        unionCalls += 1
        return [{ polygons: [illegalCompositePolygon] }]
      },
      intersection: (): PolygonRegion[] => {
        intersectionCalls += 1
        return [{ polygons: [visiblePolygon] }]
      },
      difference: (): PolygonRegion[] => {
        differenceCalls += 1
        return differenceCalls === 1
          ? [{ polygons: [wrongSideResidue] }]
          : []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        buildInsideFace(
          'face:inside-exact-composite:outer',
          'interval:inside-exact-composite:outer',
          [visiblePolygon]
        ),
        buildInsideFace(
          'face:inside-exact-composite:inner',
          'interval:inside-exact-composite:inner',
          [containedPolygon]
        )
      ],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:inside-exact-composite',
            fillRule: 'nonzero',
            regions: [{ polygons: [visiblePolygon] }]
          }
        ]
      }
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]?.polygons).toEqual([visiblePolygon])
    expect(unionCalls).toBe(1)
    expect(intersectionCalls).toBeGreaterThanOrEqual(1)
    expect(differenceCalls).toBe(2)
  })

  it('keeps source-vertex join render entries on post-legality final-face polygons instead of descriptor evidence', () => {
    const sourceVertexJoinFinalFace = {
      ...ownershipFinalFace,
      faceId: 'face:source-vertex-join',
      sourceGeometryIds: ['geometry:source-vertex-join'],
      polygons: [visiblePolygon],
      visualPacketKey: 'visual:source-vertex-join',
      paintKey: 'paint:source-vertex-join',
      strokeSpecKey: 'stroke-spec:source-vertex-join',
      intervalIds: ['interval:source-vertex-join'],
      sourceSpanIds: ['source-span:source-vertex-join'],
      sourceNetworkIds: ['network:source-vertex-join'],
      sourceContourIds: ['contour:source-vertex-join'],
      legalDomainIds: ['legal-domain:source-vertex-join'],
      productSignature: 'constrained-dashed:outside:source-vertex-join',
      domainMode: 'outside',
      topologyFamily: 'self-intersecting',
      renderDescriptor: {
        descriptorProductPolygons: [evidencePolygon],
        clipPolygons: [evidencePolygon]
      },
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const
      }
    } satisfies FinalFaceInput

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      sourceVertexJoinFinalFace
    ])

    expect(entry?.polygons).toEqual([visiblePolygon])
    expect(entry?.strokeMaskPolygons).toBeUndefined()
    expect(entry?.clipPolygons).toBeUndefined()
    expect(entry?.debugMeta).toEqual(
      expect.objectContaining({
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join',
        geometryBasis: 'canonical-join-footprint'
      })
    )
  })

  it('keeps source-vertex join same-paint render-entry collapse from recomputing product polygons', () => {
    const sourceVertexJoinFinalFace = {
      ...outsidePolygonFace('source-vertex-join-collapse', visiblePolygon),
      renderDescriptor: {
        descriptorProductPolygons: [evidencePolygon],
        clipPolygons: [evidencePolygon]
      },
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const,
        visualOverlapCollapseStatus: 'exact-arrangement' as const
      }
    } satisfies FinalFaceInput

    let unionCalls = 0
    let intersectionCalls = 0
    let arrangementCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => {
        unionCalls += 1
        return regions
      },
      intersection: (subject: PolygonRegion[]): PolygonRegion[] => {
        intersectionCalls += 1
        return intersectionCalls === 1
          ? [{ polygons: [overlapProbePolygon] }]
          : subject
      },
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] => {
        arrangementCalls += 1
        return candidates.map((candidate, index) =>
          outsideArrangementFace(
            `arrangement:source-vertex-join-collapse:${index}`,
            candidate.geometry.polygons,
            [candidate]
          )
        )
      }
    }
    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        sourceVertexJoinFinalFace,
        {
          ...outsidePolygonFace('source-vertex-neighbor', overlapProbePolygon),
          ownerSet: sourceVertexJoinFinalFace.ownerSet,
          debugMeta: {
            ...sourceVertexJoinFinalFace.debugMeta,
            productSignature:
              'constrained-dashed:outside:join-owned-terminal-body',
            ownerStage: 'Stroke Geometry terminal body assembly',
            routeId: 'constrained-dashed-join-owned-terminal-body-product',
            visibleContributor: 'terminal-interval-body',
            geometryBasis: 'terminal-dash-interval-body',
            joinOwnershipSignature: 'join-owned-terminal-body',
            visualOverlapCollapseStatus: 'exact-arrangement' as const
          }
        }
      ],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:disjoint-source-vertex',
            fillRule: 'nonzero',
            regions: [{ polygons: [disjointLegalDomainPolygon] }]
          }
        ]
      }
    )

    expect(entries).toHaveLength(1)
    expect(unionCalls).toBe(1)
    expect(intersectionCalls).toBe(1)
    expect(arrangementCalls).toBe(0)
    expect(entries[0]?.polygons).toEqual(
      expect.arrayContaining([visiblePolygon, overlapProbePolygon])
    )
    expect(entries[0]?.strokeMaskPolygons).toBeUndefined()
    expect(entries[0]?.debugMeta).toEqual(
      expect.objectContaining({
        visibleContributor: 'source-vertex-join',
        visualOverlapCollapseStatus: 'render-projection-merged'
      })
    )
  })

  it('composites overlapping post-legality source-vertex products without rebuilding an arrangement', () => {
    const sourceVertexJoinFinalFace = {
      ...outsidePolygonFace('post-legality-source-vertex', visiblePolygon),
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const
      }
    } satisfies FinalFaceInput
    const adjacentBodyFinalFace = {
      ...outsidePolygonFace('post-legality-adjacent-body', overlapProbePolygon),
      ownerSet: sourceVertexJoinFinalFace.ownerSet,
      ownerStepIds: ['build-dash-interval-body-products'],
      intervalIds: ['interval:post-legality-adjacent-body'],
      sourceSpanIds: ['span:post-legality-adjacent-body'],
      debugMeta: {
        ...sourceVertexJoinFinalFace.debugMeta,
        ownerStepIds: ['build-dash-interval-body-products'],
        intervalIds: ['interval:post-legality-adjacent-body'],
        sourceSpanIds: ['span:post-legality-adjacent-body'],
        productSignature: 'constrained-dashed:outside:dash-body',
        ownerStage: 'Stroke Geometry dash interval body assembly',
        routeId: 'constrained-dashed-dash-interval-body-product',
        visibleContributor: 'dash-interval-body' as const,
        geometryBasis: 'dash-interval-body' as const
      }
    } satisfies FinalFaceInput

    let arrangementCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => regions,
      intersection: (): PolygonRegion[] => [
        { polygons: [overlapProbePolygon] }
      ],
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] => {
        arrangementCalls += 1
        return candidates.map((candidate, index) =>
          outsideArrangementFace(
            `arrangement:post-legality-source-vertex:${index}`,
            candidate.geometry.polygons,
            [candidate]
          )
        )
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [sourceVertexJoinFinalFace, adjacentBodyFinalFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:post-legality-source-vertex',
            fillRule: 'nonzero',
            regions: [{ polygons: [disjointLegalDomainPolygon] }]
          }
        ]
      }
    )

    expect(arrangementCalls).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.polygons).toEqual(
      expect.arrayContaining([visiblePolygon, overlapProbePolygon])
    )
    expect(entries[0]?.productIdentity?.ownerStepIds).toEqual(
      expect.arrayContaining([
        'build-source-vertex-join-products',
        'build-dash-interval-body-products'
      ])
    )
    expect(entries[0]?.productIdentity?.sourceSpanIds).toEqual(
      expect.arrayContaining([
        'source-span:ownership',
        'span:post-legality-adjacent-body'
      ])
    )
  })

  it('groups exact shared-boundary products without an interior-overlap intersection', () => {
    const sourceVertexJoinFinalFace = {
      ...outsidePolygonFace('shared-boundary-source-vertex', visiblePolygon),
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const
      }
    } satisfies FinalFaceInput
    const adjacentBodyFinalFace = {
      ...outsidePolygonFace(
        'shared-boundary-adjacent-body',
        adjacentVisiblePolygon
      ),
      ownerSet: sourceVertexJoinFinalFace.ownerSet,
      debugMeta: {
        ...sourceVertexJoinFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:dash-body',
        ownerStage: 'Stroke Geometry dash interval body assembly',
        routeId: 'constrained-dashed-dash-interval-body-product',
        visibleContributor: 'dash-interval-body' as const,
        geometryBasis: 'dash-interval-body' as const
      }
    } satisfies FinalFaceInput

    let intersectionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (): PolygonRegion[] => [
        { polygons: [mergedAdjacentVisiblePolygon] }
      ],
      intersection: (): PolygonRegion[] => {
        intersectionCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [sourceVertexJoinFinalFace, adjacentBodyFinalFace],
      { exactBackend }
    )

    expect(intersectionCalls).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.polygons).toEqual([mergedAdjacentVisiblePolygon])
  })

  it('preserves terminal half-dash identity when same-interval records merge into one render entry', () => {
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => regions,
      intersection: (): PolygonRegion[] => [
        { polygons: [overlapProbePolygon] }
      ],
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] =>
        candidates.map((candidate, index) =>
          outsideArrangementFace(
            `arrangement:terminal-identity:${index}`,
            candidate.geometry.polygons,
            [candidate]
          )
        )
    }
    const terminalStartFace = {
      ...outsidePolygonFace('terminal-identity-start', visiblePolygon),
      ownerStepIds: ['build-terminal-body-products'],
      intervalIds: ['interval:shared-terminal'],
      terminalRoles: ['start'],
      seamBoundaryIds: ['seam:terminal-start'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:shared-terminal',
        intervalIds: ['interval:shared-terminal'],
        domainPlanTerminalRole: 'start' as const,
        domainPlanSplitRangeId: 'split-range:start',
        domainPlanSplitRangeSourceSegmentIndex: 4,
        dashProductIntervals: [
          {
            intervalId: 'interval:shared-terminal',
            terminalRole: 'start' as const,
            splitRangeId: 'split-range:start',
            sourceSegmentIndex: 4
          }
        ],
        productSignature: 'constrained-dashed:outside:terminal-body',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput
    const terminalEndFace = {
      ...outsidePolygonFace('terminal-identity-end', overlapProbePolygon),
      ownerSet: terminalStartFace.ownerSet,
      ownerStepIds: ['build-terminal-body-products'],
      intervalIds: ['interval:shared-terminal'],
      terminalRoles: ['end'],
      seamBoundaryIds: ['seam:terminal-end'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:shared-terminal',
        intervalIds: ['interval:shared-terminal'],
        domainPlanTerminalRole: 'end' as const,
        domainPlanSplitRangeId: 'split-range:end',
        domainPlanSplitRangeSourceSegmentIndex: 5,
        dashProductIntervals: [
          {
            intervalId: 'interval:shared-terminal',
            terminalRole: 'end' as const,
            splitRangeId: 'split-range:end',
            sourceSegmentIndex: 5
          }
        ],
        productSignature: 'constrained-dashed:outside:terminal-body',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [terminalStartFace, terminalEndFace],
      { exactBackend }
    )

    expect(entry?.debugMeta?.dashProductIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intervalId: 'interval:shared-terminal',
          terminalRole: 'start',
          splitRangeId: 'split-range:start',
          sourceSegmentIndex: 4
        }),
        expect.objectContaining({
          intervalId: 'interval:shared-terminal',
          terminalRole: 'end',
          splitRangeId: 'split-range:end',
          sourceSegmentIndex: 5
        })
      ])
    )
    expect(
      entry?.debugMeta?.dashProductIntervals?.filter(
        (interval) => interval.intervalId === 'interval:shared-terminal'
      )
    ).toHaveLength(2)
    expect(
      (entry as RenderEntryWithRuntimeOwnership).runtimeMeta
    ).toMatchObject({
      ownerStepIds: ['build-terminal-body-products'],
      terminalRoles: ['start', 'end'],
      seamBoundaryIds: ['seam:terminal-start', 'seam:terminal-end']
    })
  })

  it('preserves closed constrained-domain terminal identity even when strokePosition metadata is absent', () => {
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => regions,
      intersection: (): PolygonRegion[] => [{ polygons: [overlapProbePolygon] }]
    }
    const terminalFace = {
      ...outsidePolygonFace('closed-domain-terminal', visiblePolygon),
      intervalIds: ['interval:closed-domain-terminal'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:closed-domain-terminal',
        intervalIds: ['interval:closed-domain-terminal'],
        domainPlanTerminalRole: 'start' as const,
        domainPlanSplitRangeId:
          'closed-constrained-source-coverage-domain:source-segment-span:1:0',
        domainPlanSplitRangeSourceSegmentIndex: 1,
        dashProductIntervals: [
          {
            intervalId: 'interval:closed-domain-terminal',
            terminalRole: 'start' as const,
            splitRangeId:
              'closed-constrained-source-coverage-domain:source-segment-span:1:0',
            sourceSegmentIndex: 1
          }
        ],
        productSignature:
          'constrained-dashed:closed-constrained-domain:interval:closed-domain-terminal',
        routeId: 'constrained-dashed-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput
    const neighborFace = {
      ...outsidePolygonFace('closed-domain-neighbor', overlapProbePolygon),
      ownerSet: terminalFace.ownerSet,
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature:
          'constrained-dashed:closed-constrained-domain:interval:neighbor',
        routeId: 'constrained-dashed-smooth-continuity-product',
        visibleContributor: 'smooth-continuity-dash-body' as const
      }
    } satisfies FinalFaceInput

    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [neighborFace, terminalFace],
      { exactBackend }
    )

    expect(entry?.debugMeta?.dashProductIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intervalId: 'interval:closed-domain-terminal',
          terminalRole: 'start',
          splitRangeId:
            'closed-constrained-source-coverage-domain:source-segment-span:1:0',
          sourceSegmentIndex: 1
        })
      ])
    )
  })

  it('preserves route-owned terminal identity instead of legal-collapsing terminal-only final faces to empty', () => {
    let unionCalls = 0
    let differenceCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (): PolygonRegion[] => {
        unionCalls += 1
        return [{ polygons: [mergedOverlapProbePolygon] }]
      },
      intersection: (): PolygonRegion[] => [
        { polygons: [overlapProbePolygon] }
      ],
      difference: (subject: PolygonRegion[]): PolygonRegion[] => {
        differenceCalls += 1
        return subject
      }
    }
    const terminalStartFace = {
      ...outsidePolygonFace('route-owned-terminal-start', visiblePolygon),
      intervalIds: ['interval:route-owned-terminal-start'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:route-owned-terminal-start',
        intervalIds: ['interval:route-owned-terminal-start'],
        domainPlanTerminalRole: 'start' as const,
        domainPlanSplitRangeId: 'split-range:route-owned-start',
        domainPlanSplitRangeSourceSegmentIndex: 1,
        dashProductIntervals: [
          {
            intervalId: 'interval:route-owned-terminal-start',
            terminalRole: 'start' as const,
            splitRangeId: 'split-range:route-owned-start',
            sourceSegmentIndex: 1
          }
        ],
        productSignature:
          'constrained-dashed:closed-constrained-domain:interval:route-owned-terminal-start',
        strokePosition: 'outside' as const,
        routeId: 'constrained-dashed-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput
    const terminalEndFace = {
      ...outsidePolygonFace('route-owned-terminal-end', overlapProbePolygon),
      ownerSet: terminalStartFace.ownerSet,
      intervalIds: ['interval:route-owned-terminal-end'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:route-owned-terminal-end',
        intervalIds: ['interval:route-owned-terminal-end'],
        domainPlanTerminalRole: 'end' as const,
        domainPlanSplitRangeId: 'split-range:route-owned-end',
        domainPlanSplitRangeSourceSegmentIndex: 2,
        dashProductIntervals: [
          {
            intervalId: 'interval:route-owned-terminal-end',
            terminalRole: 'end' as const,
            splitRangeId: 'split-range:route-owned-end',
            sourceSegmentIndex: 2
          }
        ],
        productSignature:
          'constrained-dashed:closed-constrained-domain:interval:route-owned-terminal-end',
        strokePosition: 'outside' as const,
        routeId: 'constrained-dashed-join-owned-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [terminalStartFace, terminalEndFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:terminal-only-drop-probe',
            fillRule: 'nonzero',
            regions: [{ polygons: [disjointLegalDomainPolygon] }]
          }
        ]
      }
    )
    const intervals = entries.flatMap(
      (entry) => entry.debugMeta?.dashProductIntervals ?? []
    )

    expect(unionCalls).toBe(1)
    expect(differenceCalls).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.debugMeta?.visualOverlapCollapseStatus).toBe(
      'render-projection-merged'
    )
    expect(
      (entries[0] as RenderEntryWithRuntimeOwnership | undefined)?.runtimeMeta
        .intervalIds
    ).toEqual(
      expect.arrayContaining([
        'interval:route-owned-terminal-start',
        'interval:route-owned-terminal-end'
      ])
    )
    expect(intervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intervalId: 'interval:route-owned-terminal-start',
          terminalRole: 'start',
          splitRangeId: 'split-range:route-owned-start',
          sourceSegmentIndex: 1
        }),
        expect.objectContaining({
          intervalId: 'interval:route-owned-terminal-end',
          terminalRole: 'end',
          splitRangeId: 'split-range:route-owned-end',
          sourceSegmentIndex: 2
        })
      ])
    )
  })

  it('collapses legal source-vertex join and terminal dash faces before renderer projection', () => {
    let unionCalls = 0
    let intersectionCalls = 0
    let differenceCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => {
        unionCalls += 1
        return regions.some((region) => region.polygons.length > 1)
          ? [{ polygons: [mergedAdjacentVisiblePolygon] }]
          : regions
      },
      intersection: (
        subject: PolygonRegion[],
        clip: PolygonRegion[] = []
      ): PolygonRegion[] => {
        intersectionCalls += 1
        return regionsContainEvidencePolygon(clip) ? [] : subject
      },
      difference: (subject: PolygonRegion[]): PolygonRegion[] => {
        differenceCalls += 1
        return subject
      },
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] => [
        outsideArrangementFace(
          'arrangement:source-vertex-join-terminal',
          [mergedAdjacentVisiblePolygon],
          candidates
        )
      ]
    }
    const sourceVertexJoinFinalFace = {
      ...outsidePolygonFace(
        'source-vertex-join-legal-collapse',
        visiblePolygon
      ),
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature: 'constrained-dashed:outside:source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const
      }
    } satisfies FinalFaceInput
    const terminalDashFinalFace = {
      ...outsidePolygonFace(
        'terminal-dash-legal-collapse',
        adjacentVisiblePolygon
      ),
      ownerSet: sourceVertexJoinFinalFace.ownerSet,
      intervalIds: ['interval:terminal-legal-collapse'],
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        intervalId: 'interval:terminal-legal-collapse',
        intervalIds: ['interval:terminal-legal-collapse'],
        domainPlanTerminalRole: 'end' as const,
        domainPlanSplitRangeId: 'split-range:terminal-legal-collapse',
        domainPlanSplitRangeSourceSegmentIndex: 7,
        dashProductIntervals: [
          {
            intervalId: 'interval:terminal-legal-collapse',
            terminalRole: 'end' as const,
            splitRangeId: 'split-range:terminal-legal-collapse',
            sourceSegmentIndex: 7
          }
        ],
        productSignature: 'constrained-dashed:outside:terminal-body',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-terminal-body-product',
        visibleContributor: 'terminal-interval-body' as const
      }
    } satisfies FinalFaceInput

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [sourceVertexJoinFinalFace, terminalDashFinalFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:outside',
            fillRule: 'nonzero',
            regions: [{ polygons: [evidencePolygon] }]
          }
        ]
      }
    )

    expect(entries).toHaveLength(1)
    expect(unionCalls + intersectionCalls + differenceCalls).toBeGreaterThan(0)
    expect(entries[0]?.polygons).toHaveLength(1)
    for (const expectedCorner of mergedAdjacentVisiblePolygon) {
      expect(entries[0]?.polygons[0]).toContainEqual(expectedCorner)
    }
    expect(entries[0]?.strokeMaskPolygons).toBeUndefined()
    expect(entries[0]?.debugMeta).toEqual(
      expect.objectContaining({
        visibleContributor: 'source-vertex-join',
        visualOverlapCollapseStatus: 'render-projection-merged'
      })
    )
    expect(entries[0]?.debugMeta?.dashProductIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intervalId: 'interval:terminal-legal-collapse',
          terminalRole: 'end',
          splitRangeId: 'split-range:terminal-legal-collapse',
          sourceSegmentIndex: 7
        })
      ])
    )
  })

  it('collapses pre-arranged source-vertex join polygons inside a single final face', () => {
    let unionCalls = 0
    let intersectionCalls = 0
    let differenceCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      union: (regions: PolygonRegion[]): PolygonRegion[] => {
        unionCalls += 1
        return regions.some((region) => region.polygons.length > 1)
          ? [{ polygons: [mergedAdjacentVisiblePolygon] }]
          : regions
      },
      intersection: (
        subject: PolygonRegion[],
        clip: PolygonRegion[] = []
      ): PolygonRegion[] => {
        intersectionCalls += 1
        return regionsContainEvidencePolygon(clip) ? [] : subject
      },
      difference: (subject: PolygonRegion[]): PolygonRegion[] => {
        differenceCalls += 1
        return subject
      },
      buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] => [
        outsideArrangementFace(
          'arrangement:pre-arranged-source-vertex-join',
          [mergedAdjacentVisiblePolygon],
          candidates
        )
      ]
    }
    const sourceVertexJoinFinalFace = {
      ...outsidePolygonFace('source-vertex-join-pre-arranged', visiblePolygon),
      polygons: [visiblePolygon, adjacentVisiblePolygon],
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 40,
        maxY: 20
      },
      debugMeta: {
        ...ownershipFinalFace.debugMeta,
        productSignature:
          'constrained-dashed:outside:pre-arranged-source-vertex-join',
        domainMode: 'outside',
        topologyFamily: 'self-intersecting',
        strokePosition: 'outside' as const,
        strokeWidth: 10,
        strokeJoin: 'miter' as const,
        strokeCap: 'butt' as const,
        routeId: 'constrained-dashed-source-vertex-join-product',
        visibleContributor: 'source-vertex-join' as const,
        geometryBasis: 'canonical-join-footprint' as const,
        visualOverlapCollapseStatus: 'render-projection-merged' as const
      }
    } satisfies FinalFaceInput

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [sourceVertexJoinFinalFace],
      {
        exactBackend,
        legalDomains: [
          {
            legalDomainId: 'legal-domain:outside',
            fillRule: 'nonzero',
            regions: [{ polygons: [evidencePolygon] }]
          }
        ]
      }
    )

    expect(entries).toHaveLength(1)
    expect(unionCalls + intersectionCalls + differenceCalls).toBeGreaterThan(0)
    expect(unionCalls).toBe(1)
    expect(intersectionCalls).toBe(0)
    expect(differenceCalls).toBe(0)
    expect(entries[0]?.polygons).toHaveLength(1)
    for (const expectedCorner of mergedAdjacentVisiblePolygon) {
      expect(entries[0]?.polygons[0]).toContainEqual(expectedCorner)
    }
    expect(entries[0]?.strokeMaskPolygons).toBeUndefined()
    expect(entries[0]?.debugMeta).toEqual(
      expect.objectContaining({
        visibleContributor: 'source-vertex-join',
        visualOverlapCollapseStatus: 'render-projection-merged'
      })
    )
    expect(entries[0]?.productIdentity).toEqual(
      expect.objectContaining({
        ownerStepIds: sourceVertexJoinFinalFace.ownerStepIds,
        intervalIds: sourceVertexJoinFinalFace.intervalIds,
        seamBoundaryIds: sourceVertexJoinFinalFace.seamBoundaryIds,
        sourceSpanIds: sourceVertexJoinFinalFace.sourceSpanIds,
        legalDomainIds: sourceVertexJoinFinalFace.legalDomainIds
      })
    )
  })

  it('trusts exact outside dashed overlap decisions without approximate fallback collapse', () => {
    let intersectionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        throw new Error('unexpected outside dashed union')
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsidePolygonFace('outside-a', visiblePolygon),
        outsidePolygonFace('outside-b', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(entries).toHaveLength(2)
    expect(intersectionCalls).toBe(0)
    expect(entries.map((entry) => entry.cacheKey)).toEqual([
      'geometry:outside-a',
      'geometry:outside-b'
    ])
  })

  it('keeps render-entry materialization free of geometry construction or renderer projection', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const buildSolidCenterStrokeRenderEntriesFromRenderPackets = ('
    )
    const helperEnd = source.indexOf(
      'const defineLazySolidCenterStrokeExportPackets',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'buildSourceVertexJoin',
      'endpoint cap repair',
      'renderSolidCenterStrokeEntries',
      'descriptor.descriptorProductPolygons',
      'strokeMaskPolygons: descriptorProductPolygons',
      'strokePathStyle.join'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('preserves source-vertex join owner metadata when render entries merge overlap groups', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')

    expect(source).toContain('const selectPrimaryRenderMetadataFace = (')
    expect(source).toContain(
      "face.debugMeta?.visibleContributor === 'source-vertex-join'"
    )
    expect(source).toContain('selectPrimaryRenderMetadataFace(faces)')
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('render-entries')
  })
})
