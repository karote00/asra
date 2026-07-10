import type { StrokeAttrs } from '@asyra/utils'
import type { RenderFillStyle } from '@asyra/core'
import {
  buildStrokeRuntimeRevisionSet,
  updateStrokeRuntimeRevisionSetFromMetadata,
  type StrokeRevisionSet
} from './stroke-dirty-keys'
import {
  buildSolidCenterStrokePolygons,
  supportsSolidCenterStroke
} from './solid-center-stroke-geometry'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from './path-topology-model'
import {
  buildStrokeFinalFacesFromResolvedPackets,
  type StrokeFinalFace,
  type StrokeOwnerKey
} from './stroke-final-face'
import {
  collapseStrokeFinalFaceVisualOverlaps,
  type StrokeVisualOverlapCollapseOptions
} from './stroke-candidate-arrangement'
import { classifyArrangementFacesByLegalDomain } from './arrangement-face-classifier'
import { shouldEmitFullStrokeDiagnostics } from './stroke-diagnostics-mode'
import {
  getGeometryBackend,
  getGeometryBackendCacheSignature,
  type ArrangementFace,
  type CandidateRegion,
  type FillRule,
  type GeometryBackend,
  type PolygonRegion
} from './geometry-backend'
import {
  mergeConstrainedDashedProductEvidenceEnvelopes,
  type ConstrainedDashedProductEvidenceEnvelope
} from './stroke-product-evidence'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface SolidCenterStrokeGeometryPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
  renderDescriptor?: SolidCenterStrokeRenderDescriptor
}

export interface SolidCenterStrokeRenderDescriptor {
  descriptorProductPolygons?: Vec2[][]
  fillPolygons?: Vec2[][]
  clipPolygons?: Vec2[][]
  fillClipPolygons?: Vec2[][]
  fillExcludePolygons?: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: {
    clipPolygons?: Vec2[][]
    strokePaths: Vec2[][]
    strokePathStyle?: {
      width: number
      cap: 'butt' | 'square' | 'round'
      join: 'miter' | 'bevel' | 'round'
      miterAngle: number
      miterLimit: number
      closed?: boolean
    }
  }[]
  strokePathStyle?: {
    width: number
    cap: 'butt' | 'square' | 'round'
    join: 'miter' | 'bevel' | 'round'
    miterAngle: number
    miterLimit: number
    closed?: boolean
  }
}

export interface SolidCenterStrokeRuntimeMeta {
  ownerStage?: 'Product Output render-entry materialization'
  productMode?: string
  productSignature?: string
  routeId?: string
  visibleContributor?: 'visible strokePathGroups'
  geometryBasis?: 'declared route product contract'
  domainMode?: string
  topologyFamily?: PathTopologyModel['topologyFamily'] | string
  strokePosition?: 'center' | 'inside' | 'outside'
  intervalIds?: string[]
  sourceSpanIds?: string[]
  sourceNetworkIds?: string[]
  sourceContourIds?: string[]
  legalDomainIds?: string[]
  ownerSet?: StrokeOwnerKey[]
  ownerStepIds?: string[]
  terminalRoles?: ('start' | 'end' | 'start-end' | 'middle')[]
  seamBoundaryIds?: string[]
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-mask'
    | 'exact-arrangement'
    | 'render-projection-merged'
    | 'render-projection-arrangement'
  revisionSet?: StrokeRevisionSet
}

export interface SolidCenterStrokePaintPacket {
  geometryId: string
  kind?: 'solid' | 'gradient'
  color: number
  alpha: number
  gradientStyle?: RenderFillStyle | null
  paintKey?: string
}

export interface SolidCenterStrokeOutputProductIdentity {
  primaryOwner?: StrokeOwnerKey
  ownerSet: StrokeOwnerKey[]
  ownerStepIds: string[]
  intervalIds: string[]
  terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
  seamBoundaryIds: string[]
  sourceSpanIds: string[]
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  productEvidenceEnvelope?: ConstrainedDashedProductEvidenceEnvelope
}

export interface SolidCenterStrokeHitTestPacket
  extends SolidCenterStrokeOutputProductIdentity {
  channel: 'hit-test'
  visibility: 'hit-export'
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeExportPacket
  extends SolidCenterStrokeOutputProductIdentity {
  channel: 'export'
  visibility: 'hit-export'
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

type SolidCenterStrokeVisibleRenderDescriptor = Omit<
  SolidCenterStrokeRenderDescriptor,
  'descriptorProductPolygons'
>

export interface SolidCenterStrokeRenderStrokePayload {
  kind?: string
  color: number
  alpha: number
  gradientStyle?: RenderFillStyle | null
  paintKey: string
}

export interface SolidCenterStrokeVisibleRenderPacket
  extends SolidCenterStrokeOutputProductIdentity {
  channel: 'render'
  visibility: 'visible'
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  stroke: SolidCenterStrokeRenderStrokePayload
  descriptorRouteMode: 'canonical-product' | 'descriptor-visible-route'
  renderDescriptor?: SolidCenterStrokeVisibleRenderDescriptor
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export type SolidCenterStrokeChannelHitTestPacket =
  SolidCenterStrokeHitTestPacket & {
    channel: 'hit-test'
    visibility: 'hit-export'
    equivalenceReason:
      | 'same-final-face-product'
      | 'descriptor-evidence-projection'
  }

export type SolidCenterStrokeChannelExportPacket =
  SolidCenterStrokeExportPacket & {
    channel: 'export'
    visibility: 'hit-export'
    equivalenceReason:
      | 'same-final-face-product'
      | 'descriptor-evidence-projection'
  }

export interface SolidCenterStrokeDiagnosticPacket {
  channel: 'diagnostic'
  visibility: 'non-visible'
  diagnosticKind: 'descriptor-evidence'
  geometryId: string
  sourceProductOwner?: StrokeOwnerKey
  descriptorRouteMode: 'canonical-product' | 'descriptor-visible-route'
  evidenceChannel: Pick<
    SolidCenterStrokeRenderDescriptor,
    'descriptorProductPolygons' | 'fillClipPolygons' | 'fillExcludePolygons'
  >
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeProductOutputPackets {
  renderPackets: SolidCenterStrokeVisibleRenderPacket[]
  hitTestPackets: SolidCenterStrokeChannelHitTestPacket[]
  exportPackets: SolidCenterStrokeChannelExportPacket[]
  diagnosticPackets: SolidCenterStrokeDiagnosticPacket[]
}

export interface SolidCenterStrokeProductOutputOptions {
  includeDiagnostics?: boolean
}

export interface SolidCenterStrokePacketRenderEntry {
  channel: 'render-entry'
  visibility: 'visible'
  cacheKey: string
  stroke: SolidCenterStrokeRenderStrokePayload
  polygons: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: NonNullable<SolidCenterStrokeRenderDescriptor['strokePaths']>
  strokePathGroups?: NonNullable<
    SolidCenterStrokeRenderDescriptor['strokePathGroups']
  >
  strokePathStyle?: SolidCenterStrokeRenderDescriptor['strokePathStyle']
  fillPolygons?: Vec2[][]
  clipPolygons?: Vec2[][]
  fillClipPolygons?: Vec2[][]
  fillExcludePolygons?: Vec2[][]
  evidenceChannel: {
    descriptorProductPolygonsVisible: false
    reason:
      | 'descriptor-evidence-only'
      | 'canonical-visible-product'
      | 'descriptor-visible-route'
  }
  productIdentity: SolidCenterStrokeOutputProductIdentity
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeResolvedPacket {
  geometry: SolidCenterStrokeGeometryPacket
  paint: SolidCenterStrokePaintPacket
}

interface SolidCenterStrokeRenderEntryOptions {
  exactBackend?: Pick<GeometryBackend, 'capabilities' | 'union'> &
    Partial<Pick<GeometryBackend, 'buildArrangement' | 'intersection'>> &
    Partial<Pick<GeometryBackend, 'difference'>>
  legalDomains?: StrokeVisualOverlapCollapseOptions['legalDomains']
}

type RenderProjectionArrangementBackend = Pick<
  GeometryBackend,
  'capabilities' | 'buildArrangement' | 'union'
> &
  Partial<Pick<GeometryBackend, 'intersection'>>

export interface SolidCenterStrokeGeometryDebugMeta {
  ownerStepId?: string
  sourceOwnerStepId?: string
  sourceProductId?: string
  ownerStepIds?: string[]
  productEvidenceEnvelope?: ConstrainedDashedProductEvidenceEnvelope
  sourcePathId?: string
  ownerKey?: string
  networkId?: string
  sourceNetworkIds?: string[]
  strokeId?: string
  strokeIndex?: number
  contourId?: string
  legalDomainId?: string | null
  intervalId?: string
  sourceSpanIds?: string[]
  ownerSet?: StrokeOwnerKey[]
  intervalIds?: string[]
  terminalRoles?: ('start' | 'end' | 'start-end' | 'middle')[]
  seamBoundaryIds?: string[]
  sourceContourIds?: string[]
  legalDomainIds?: string[]
  authoredVisibleIntervalIndex?: number
  productSourceSegmentIndexes?: number[]
  materializedStartDistance?: number
  materializedEndDistance?: number
  materializedWrapsSeam?: boolean
  materializationDistanceSpace?: 'source-domain' | 'boundary-domain'
  sourceDomainExplicitSideProduct?: boolean
  selectedSideProductOwnsOutsideDomain?: boolean
  rawProductArea?: number
  selectedSideProductArea?: number
  processedProductArea?: number
  cleanedProductArea?: number
  boundaryClippedProductArea?: number
  finalProductArea?: number
  legalDomainClipSourcePathPresent?: boolean
  legalDomainClipSourcePathClosed?: boolean
  implicitFillRegionCount?: number
  boundarySideClippedProductArea?: number
  startDistance?: number
  endDistance?: number
  wrapsSeam?: boolean
  physicalSpanRanges?: {
    spanId: string
    role: 'core'
    startDistance: number
    endDistance: number
    wrapsSeam: boolean
  }[]
  materializedBoundaryRanges?: {
    startDistance: number
    endDistance: number
    segmentIndex: number
  }[]
  materializedOffsetFrameSpan?: {
    frameCount: number
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    startOffsetDistance: number
    endX: number
    endY: number
    endOffsetX: number
    endOffsetY: number
    endOffsetDistance: number
  }
  physicalVisibleLength?: number
  previousVisibleIntervalId?: string | null
  nextVisibleIntervalId?: string | null
  intervalTerminalRole?: 'none' | 'path-start' | 'path-end' | 'both'
  constrainedDashedJoinDiagnostics?: {
    terminalRecordCount: number
    sourceVertexRecordCount: number
    terminalPairJoinPlanCount: number
    sourceVertexJoinPlanCount: number
    joinPlanCount: number
    joinRecordCount?: number
    joinPacketCount?: number
  }
  domainPlanBoundaryDomainId?: string
  domainPlanBoundaryPoints?: Vec2[]
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanBoundaryTotalLength?: number
  domainPlanSplitRangeId?: string
  domainPlanSplitRangeAliasIds?: string[]
  domainPlanSplitRangeStartDistance?: number
  domainPlanSplitRangeEndDistance?: number
  domainPlanSplitRangeSourceStartDistance?: number
  domainPlanSplitRangeSourceEndDistance?: number
  domainPlanTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  domainPlanSplitRangeSourceSegmentIndex?: number
  domainPlanSideAuthority?: 'implicit-fill-hole-domain'
  domainPlanSelectedSide?: 1 | -1
  domainPlanMaterializedSelectedSide?: 1 | -1
  domainPlanFilledSide?: 1 | -1
  domainPlanUnfilledSide?: 1 | -1
  domainPlanBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  domainPlanDomainMode?: string
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanSideResolutionReason?: string
  domainPlanSplitRangeTerminals?: {
    intervalId: string
    boundaryDomainId?: string
    boundaryPoints?: Vec2[]
    boundaryStartDistance?: number
    boundaryEndDistance?: number
    boundaryTotalLength?: number
    splitRangeId: string
    splitRangeStartDistance: number
    splitRangeEndDistance: number
    terminalRole: 'start' | 'end' | 'start-end' | 'middle'
    startDistance: number
    endDistance: number
    sourceSegmentIndex?: number
    selectedSide?: 1 | -1
    materializedSelectedSide?: 1 | -1
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
    domainMode?: string
  }[]
  dashProductIntervals?: {
    intervalId: string
    splitRangeId?: string
    splitRangeAliasIds?: string[]
    terminalRole?: 'start' | 'end' | 'start-end' | 'middle'
    startDistance?: number
    endDistance?: number
    effectiveStartDistance?: number
    effectiveEndDistance?: number
    capReachDistance?: number
    boundaryDomainId?: string
    boundaryPoints?: Vec2[]
    boundaryStartDistance?: number
    boundaryEndDistance?: number
    boundaryTotalLength?: number
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
    selectedSide?: 1 | -1
    materializedSelectedSide?: 1 | -1
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    sourceSegmentIndex?: number
    sourceStartDistance?: number
    sourceEndDistance?: number
    endpointCapPolicySignature?: string
    joinOwnershipSignature?: string
    smoothContinuityGroupId?: string
    materializationDistanceSpace?: 'source-domain' | 'boundary-domain'
  }[]
  dashEndpointCapPolicySignatures?: string[]
  dashEndpointCapPolicyTerminalRoles?: (
    | 'middle'
    | 'start'
    | 'end'
    | 'start-end'
  )[]
  joinOwnershipSignatures?: string[]
  smoothContinuityGroupIds?: string[]
  domainPlanBoundaryRoles?: ('outer' | 'hole' | 'filled-face' | 'ambiguous')[]
  domainPlanSplitRangeIds?: string[]
  domainPlanSelectedSides?: (1 | -1)[]
  domainPlanSourceSegmentIndexes?: number[]
  intervalStartCutKind?: 'vertex' | 'dash-boundary' | 'self-intersection'
  intervalEndCutKind?: 'vertex' | 'dash-boundary' | 'self-intersection'
  strokeIntersectionEligible?: boolean
  ribbonValidityStatus?:
    | 'simple-outline'
    | 'backend-offset'
    | 'fail-open-invalid-outline'
    | 'empty'
  dashPlacementMode?: 'arc-length-pattern'
  productMode?: string
  productSignature?: string
  routeId?: string
  domainMode?: string
  topologyFamily?: PathTopologyModel['topologyFamily']
  ownerCount?: number
  strokePosition?: 'center' | 'inside' | 'outside'
  strokeWidth?: number
  strokeJoin?: 'miter' | 'bevel' | 'round'
  strokeCap?: 'butt' | 'square' | 'round'
  ownerStage?:
    | 'Stroke Geometry dash interval body assembly'
    | 'Stroke Geometry source-vertex join assembly'
    | 'Stroke Geometry terminal body assembly'
    | 'Stroke Geometry smooth-continuity product assembly'
  authoredJoin?: 'miter' | 'bevel' | 'round'
  resolvedJoin?:
    | 'miter'
    | 'bevel-by-miter-angle'
    | 'bevel'
    | 'round'
    | 'degenerate-bevel'
  vertexAngle?: number
  miterAngle?: number
  angleSource?:
    | 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
    | 'CONTOUR_VISIT_INCIDENT_TANGENTS'
  angleComparison?: {
    operator: '<=' | '>'
    result: boolean
    epsilon: number
  }
  strokeMiterLimit?: number
  visibleContributor?:
    | 'dash-interval-body'
    | 'source-vertex-join'
    | 'terminal-interval-body'
    | 'smooth-continuity-dash-body'
    | 'same-owner-smooth-span-descriptor'
  geometryBasis?:
    | 'canonical-join-footprint'
    | 'dash-body'
    | 'dash-interval-body'
    | 'terminal-dash-interval-body'
    | 'single-continuous-smooth-footprint'
    | 'declared-smooth-span-descriptor'
  joinStyle?: 'miter' | 'bevel' | 'round'
  joinResolution?:
    | 'miter'
    | 'bevel-by-miter-angle'
    | 'bevel'
    | 'round'
    | 'degenerate-bevel'
  continuityEvidence?: {
    used: boolean
    source: 'seam-bridge' | 'suppressed-butt-endpoint'
    emitted: boolean
  }
  protectedContinuityZone?: {
    emitted: boolean
    owner: 'source-vertex-join'
    source: 'suppressed-butt-endpoint'
    geometryBasis: 'canonical-join-footprint'
  }
  seamEvidence?: {
    seamCoveragePolicy: 'shared-seam-boundary-artifact-endpoint-identity'
    incidentSeamBoundaries: {
      seamBoundaryId: string
      intervalId: string
      splitRangeId?: string
      splitRangeAliasIds?: string[]
      side: 'previous' | 'next'
      point: Vec2
      outerBodyBoundaryEndpoint: Vec2
      outerBodyBoundaryVertices: Vec2[]
      bodySideOutlineSegment: [Vec2, Vec2]
      bodySideTangent: Vec2
      selectedSide: 'left' | 'right'
      terminalRole: 'middle' | 'start' | 'end' | 'start-end'
      endpointCapPolicySignature: string
      capSuppressed: boolean
      sourceSegmentIndex?: number
    }[]
  }
  dashBodySeamBoundaries?: {
    seamBoundaryId: string
    intervalId: string
    splitRangeId?: string
    splitRangeAliasIds?: string[]
    side: 'previous' | 'next'
    point: Vec2
    pointId?: string
    outerBodyBoundaryEndpoint: Vec2
    outerBodyBoundaryEndpointId?: string
    outerBodyBoundaryVertices: Vec2[]
    bodySideOutlineSegment: [Vec2, Vec2]
    bodySideOutlineSegmentId?: string
    bodySideTangent: Vec2
    selectedSide: 'left' | 'right'
    terminalRole: 'middle' | 'start' | 'end' | 'start-end'
    endpointCapPolicySignature: string
    capSuppressed: boolean
    sourceSegmentIndex?: number
  }[]
  dashEndpointCapPolicySignature?: string
  dashEndpointCapPolicyTerminalRole?: 'middle' | 'start' | 'end' | 'start-end'
  materializedEndpointCaps?: {
    rangeStartDistance: number
    rangeEndDistance: number
    policySignature: string
    startCap: boolean
    endCap: boolean
    suppressStartCap: boolean
    suppressEndCap: boolean
    materializedStrokeCap?: 'butt' | 'square' | 'round'
    roundCapStart?: boolean
    roundCapEnd?: boolean
    squareCapStart?: boolean
    squareCapEnd?: boolean
  }[]
  joinOwnershipSignature?: string
  joinOwnershipRecords?: {
    kind: 'source-vertex' | 'boundary-terminal-pair'
    ownerId?: string
    materializationKind?:
      | 'join'
      | 'smooth-continuity-product'
      | 'smooth-continuity-bridge'
      | 'join-owned-terminal-body-bridge'
    area: number
    bounds: Bounds
    intervalIds?: string[]
    selectedSide?: 1 | -1
    domainKey?: string
    vertex?: Vec2
    previousContourPoint?: Vec2
    nextContourPoint?: Vec2
    previousSourceTangent?: Vec2
    nextSourceTangent?: Vec2
    previousDashBodyPoint?: Vec2
    nextDashBodyPoint?: Vec2
    stageBounds?: Record<string, Bounds | undefined>
    preLegalityProductUnits?: {
      artifactId: string
      productId: string
      productMode: 'pre-legality-source-vertex-join'
      ownerStage: 'Stroke Geometry source-vertex join assembly'
      routeId: 'constrained-dashed-source-vertex-join-product'
      visibleContributor: 'source-vertex-join'
      geometryBasis: 'canonical-join-footprint'
      polygons: Vec2[][]
      seamEvidence?: SolidCenterStrokeGeometryDebugMeta['seamEvidence']
      dashBodySeamBoundaries?: SolidCenterStrokeGeometryDebugMeta['dashBodySeamBoundaries']
      legalDomainIds?: string[]
      contourIds?: string[]
    }[]
  }[]
  smoothContinuityGroupId?: string
  solidMaskModelMaskApplication?: 'render-fill-mask' | 'exact-boolean'
  solidMaskModelVisibleRender?: 'masked-source-stroke'
  solidMaskModelCoverageOracle?: 'exact-boolean' | 'render-mask'
  solidMaskModelMaskSide?: 'inside-fill' | 'outside-exterior'
  solidMaskModelInsideMaskMode?: 'face-occupancy-inside-fill'
  solidMaskModelVisibleMaskMode?: 'inside-fill-source-stroke-clip'
  solidMaskModelJoinGeometrySource?: 'authored-doubled-source-stroke'
  solidMaskModelInternalCornerJoinMode?: 'stroke-join-aware-face-corner'
  solidMaskModelJoinEligibilityMode?: 'internal-face-only'
  solidMaskModelAdjacencyProbe?: string[]
  solidMaskModelFaceOwnershipTrace?: {
    sourceSegmentIndex?: number
    sourceStartDistance?: number
    sourceEndDistance?: number
    start: Vec2
    end: Vec2
    startNodeDegree: number
    endNodeDegree: number
    faceId: string
    oppositeFaceId?: string | null
    adjacencySide: 'left' | 'right'
    oppositeFaceLegal: boolean
    faceJoinEligibility: 'join-reactive' | 'mask-only'
    maskMode: 'face-occupancy-inside-fill'
  }[]
  arrangementStatus?: 'exact'
  arrangementFaceId?: string
  arrangementCandidateIds?: string[]
  arrangementLegalState?: {
    insideFillDomain: boolean
    outsideFillDomain: boolean
  }
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-mask'
    | 'exact-arrangement'
    | 'render-projection-merged'
    | 'render-projection-arrangement'
  visualOverlapSourceFaceIds?: string[]
  visualOverlapSourceGeometryIds?: string[]
  intervalSweepSpanCount?: number
  terminalCapCount?: number
  paintBounds?: Bounds
  revisionSet?: StrokeRevisionSet
}

export interface SolidCenterStrokeRuntimeGraphic {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
}

interface SolidCenterStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
  topology?: PathTopologyModel
  preferStrokePathRenderDescriptor?: boolean
}

const getBounds = (polygons: Vec2[][]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return { minX, minY, maxX, maxY }
}

const translateRenderProjectionPolygons = (polygons: Vec2[][], offset: Vec2) =>
  polygons.map((polygon) =>
    polygon.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y
    }))
  )

const unionCoveragePolygons = (polygons: Vec2[][]) => {
  if (polygons.length <= 1) {
    return polygons
  }
  const projectionBounds = getBounds(polygons)
  const projectionOrigin = {
    x: Number.isFinite(projectionBounds.minX) ? projectionBounds.minX : 0,
    y: Number.isFinite(projectionBounds.minY) ? projectionBounds.minY : 0
  }
  const sourcePolygons = translateRenderProjectionPolygons(polygons, {
    x: -projectionOrigin.x,
    y: -projectionOrigin.y
  })
  const unionInputPolygons = cleanRenderProjectionPolygons(sourcePolygons)
  const restoreProjectionOrigin = (outputPolygons: Vec2[][]) =>
    translateRenderProjectionPolygons(outputPolygons, projectionOrigin)
  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.union) {
      return restoreProjectionOrigin(
        mergeSharedEdgeCoveragePolygons(unionInputPolygons)
      )
    }
    const unioned = flattenFacePolygons(
      backend.union(
        [
          {
            polygons: unionInputPolygons.map(normalizeCoveragePolygonWinding)
          }
        ],
        'nonzero'
      ),
      unionInputPolygons
    )
    return restoreProjectionOrigin(
      mergeSharedEdgeCoveragePolygons(
        unioned.length > 0 ? unioned : unionInputPolygons
      )
    )
  } catch {
    return restoreProjectionOrigin(
      mergeSharedEdgeCoveragePolygons(unionInputPolygons)
    )
  }
}

const buildSelfIntersectingSolidCenterStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Parameters<typeof buildSolidCenterStrokePolygons>[2]
) => {
  if (!closed || points.length < 2) {
    return buildSolidCenterStrokePolygons(points, closed, stroke)
  }

  const [firstPoint] = points
  const lastPoint = points[points.length - 1]
  const openStrokePath =
    Math.abs(firstPoint.x - lastPoint.x) < 1e-6 &&
    Math.abs(firstPoint.y - lastPoint.y) < 1e-6
      ? points
      : [...points, firstPoint]

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.offset) {
      const backendPolygons = backend
        .offset(openStrokePath, stroke.width / 2, {
          width: stroke.width,
          join: stroke.join,
          cap: 'butt',
          closed: false,
          miterLimit: stroke.miterLimit,
          fillRule: 'nonzero'
        })
        .flatMap((region) => region.polygons)
      if (backendPolygons.length > 0) {
        return backendPolygons
      }
    }
  } catch {
    // Use the canonical local center-product polygon builder below; this remains Step 25 product output, not an alternate product route.
  }

  return buildSolidCenterStrokePolygons(openStrokePath, false, {
    ...stroke,
    cap: 'butt'
  })
}

const buildClosedStrokePath = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return points
  }

  const [firstPoint] = points
  const lastPoint = points[points.length - 1]
  return Math.abs(firstPoint.x - lastPoint.x) < 1e-6 &&
    Math.abs(firstPoint.y - lastPoint.y) < 1e-6
    ? points
    : [...points, firstPoint]
}

const buildInflatedBoundsPolygon = (points: Vec2[], padding: number) => {
  if (points.length === 0) {
    return []
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return []
  }

  return [
    { x: minX - padding, y: minY - padding },
    { x: maxX + padding, y: minY - padding },
    { x: maxX + padding, y: maxY + padding },
    { x: minX - padding, y: maxY + padding }
  ]
}

const doBoundsOverlap = (left: Bounds, right: Bounds) =>
  left.minX < right.maxX &&
  right.minX < left.maxX &&
  left.minY < right.maxY &&
  right.minY < left.maxY

const doBoundsTouchOrOverlap = (
  left: Bounds,
  right: Bounds,
  tolerance: number
) =>
  left.minX <= right.maxX + tolerance &&
  right.minX <= left.maxX + tolerance &&
  left.minY <= right.maxY + tolerance &&
  right.minY <= left.maxY + tolerance

const distanceBetweenPoints = (left: Vec2, right: Vec2) =>
  Math.hypot(right.x - left.x, right.y - left.y)

const distancePointToSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 0) {
    return distanceBetweenPoints(point, start)
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return distanceBetweenPoints(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const distanceSegmentToSegment = (
  leftStart: Vec2,
  leftEnd: Vec2,
  rightStart: Vec2,
  rightEnd: Vec2
) =>
  Math.min(
    distancePointToSegment(leftStart, rightStart, rightEnd),
    distancePointToSegment(leftEnd, rightStart, rightEnd),
    distancePointToSegment(rightStart, leftStart, leftEnd),
    distancePointToSegment(rightEnd, leftStart, leftEnd)
  )

export const hasSolidCenterStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  getRenderableStrokes(strokes).some(
    (stroke) =>
      stroke.style === 'solid' &&
      stroke.position === 'center' &&
      stroke.width > 0
  ) === true

const normalizePacketPolygons = (polygons: Vec2[][]) => {
  const normalized = polygons.filter((polygon) => polygon.length >= 3)
  return normalized.length === polygons.length ? polygons : normalized
}

const RENDER_PROJECTION_MICRO_EDGE_TOLERANCE = 0.03
const RENDER_PROJECTION_COLLINEAR_TOLERANCE = 0.0075
const RENDER_PROJECTION_AREA_DELTA_TOLERANCE = 0.001
const RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE = 1e-6
const RENDER_PROJECTION_CONCAVE_NOTCH_TOLERANCE = 0.2
const RENDER_PROJECTION_LEGAL_SIDE_BOUNDARY_TOLERANCE = 1e-6
const RENDER_PROJECTION_SEAM_COVERAGE_TOLERANCE = 1e-3

const getPointDistance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const getRenderProjectionSignedPolygonArea = (polygon: Vec2[]) =>
  polygon.reduce((total, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return total + point.x * next.y - next.x * point.y
  }, 0) / 2

const getRenderProjectionPointToSegmentDistance = (
  point: Vec2,
  start: Vec2,
  end: Vec2
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= Number.EPSILON) {
    return getPointDistance(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return getPointDistance(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const getRenderProjectionTriangleTurn = (
  previous: Vec2,
  point: Vec2,
  next: Vec2
) =>
  (point.x - previous.x) * (next.y - point.y) -
  (point.y - previous.y) * (next.x - point.x)

const isNearRenderProjectionCollinearPoint = (
  previous: Vec2,
  point: Vec2,
  next: Vec2
) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  const scale = Math.max(Math.hypot(ax, ay) + Math.hypot(bx, by), 1)
  return (
    Math.abs(ax * by - ay * bx) / scale <= RENDER_PROJECTION_COLLINEAR_TOLERANCE
  )
}

const shouldCleanRenderProjectionPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 40) {
    return false
  }

  let microEdgeCount = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const next = polygon[(index + 1) % polygon.length]
    if (getPointDistance(polygon[index], next) < 0.03) {
      microEdgeCount += 1
    }
  }
  return microEdgeCount > 0
}

const cleanRenderProjectionPolygon = (polygon: Vec2[]) => {
  if (!shouldCleanRenderProjectionPolygon(polygon)) {
    return polygon
  }

  const originalArea = Math.abs(getRenderProjectionSignedPolygonArea(polygon))
  let cleaned = polygon
  for (let pass = 0; pass < 4; pass += 1) {
    const compacted: Vec2[] = []
    for (const point of cleaned) {
      const previous = compacted[compacted.length - 1]
      if (
        !previous ||
        getPointDistance(previous, point) >
          RENDER_PROJECTION_MICRO_EDGE_TOLERANCE
      ) {
        compacted.push(point)
      }
    }

    if (
      compacted.length > 2 &&
      getPointDistance(compacted[0], compacted[compacted.length - 1]) <=
        RENDER_PROJECTION_MICRO_EDGE_TOLERANCE
    ) {
      compacted.pop()
    }
    if (compacted.length < 3) {
      break
    }

    const simplified = compacted.filter((point, index) => {
      const previous =
        compacted[(index - 1 + compacted.length) % compacted.length]
      const next = compacted[(index + 1) % compacted.length]
      return (
        getPointDistance(previous, point) >
          RENDER_PROJECTION_MICRO_EDGE_TOLERANCE &&
        getPointDistance(point, next) >
          RENDER_PROJECTION_MICRO_EDGE_TOLERANCE &&
        !isNearRenderProjectionCollinearPoint(previous, point, next)
      )
    })
    if (simplified.length < 3 || simplified.length === cleaned.length) {
      cleaned = simplified.length >= 3 ? simplified : cleaned
      break
    }
    cleaned = simplified
  }

  const cleanedArea = Math.abs(getRenderProjectionSignedPolygonArea(cleaned))
  if (
    cleaned.length < 3 ||
    originalArea <= 0 ||
    Math.abs(cleanedArea - originalArea) / originalArea >
      RENDER_PROJECTION_AREA_DELTA_TOLERANCE
  ) {
    return polygon
  }

  return cleaned
}

const pruneRenderProjectionMicroEdges = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return polygon
  }

  let cleaned = polygon
  for (let pass = 0; pass < 120 && cleaned.length >= 4; pass += 1) {
    const removeIndex = cleaned.findIndex((point, index) => {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]
      const next = cleaned[(index + 1) % cleaned.length]
      return (
        getPointDistance(previous, point) <=
          RENDER_PROJECTION_MICRO_EDGE_TOLERANCE ||
        getPointDistance(point, next) <= RENDER_PROJECTION_MICRO_EDGE_TOLERANCE
      )
    })
    if (removeIndex < 0) {
      break
    }

    const compacted = cleaned.filter((_, index) => index !== removeIndex)
    if (
      compacted.length < 3 ||
      Math.abs(getRenderProjectionSignedPolygonArea(compacted)) <= 1e-6
    ) {
      break
    }
    cleaned = compacted
  }

  return cleaned
}

const removeRenderProjectionSmallConcaveNotches = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return polygon
  }

  const originalArea = Math.abs(getRenderProjectionSignedPolygonArea(polygon))
  if (originalArea <= 1e-6) {
    return polygon
  }

  let cleaned = polygon
  const maxTriangleArea =
    RENDER_PROJECTION_CONCAVE_NOTCH_TOLERANCE *
    RENDER_PROJECTION_CONCAVE_NOTCH_TOLERANCE
  for (let pass = 0; pass < 80 && cleaned.length >= 4; pass += 1) {
    let removeIndex = -1
    for (let index = 0; index < cleaned.length; index += 1) {
      const previousPrevious =
        cleaned[(index - 2 + cleaned.length) % cleaned.length]
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]
      const point = cleaned[index]
      const next = cleaned[(index + 1) % cleaned.length]
      const nextNext = cleaned[(index + 2) % cleaned.length]
      const turn = getRenderProjectionTriangleTurn(previous, point, next)
      const previousTurn = getRenderProjectionTriangleTurn(
        previousPrevious,
        previous,
        point
      )
      const nextTurn = getRenderProjectionTriangleTurn(point, next, nextNext)
      if (
        Math.abs(turn) <= Number.EPSILON ||
        Math.abs(previousTurn) <= Number.EPSILON ||
        Math.abs(nextTurn) <= Number.EPSILON ||
        Math.sign(previousTurn) !== Math.sign(nextTurn) ||
        Math.sign(turn) === Math.sign(previousTurn)
      ) {
        continue
      }

      const notchDepth = getRenderProjectionPointToSegmentDistance(
        point,
        previous,
        next
      )
      const triangleArea = Math.abs(turn) / 2
      if (
        notchDepth <= RENDER_PROJECTION_CONCAVE_NOTCH_TOLERANCE &&
        triangleArea <= maxTriangleArea
      ) {
        removeIndex = index
        break
      }
    }

    if (removeIndex < 0) {
      break
    }

    const compacted = cleaned.filter((_, index) => index !== removeIndex)
    if (
      compacted.length < 3 ||
      Math.abs(getRenderProjectionSignedPolygonArea(compacted)) <= 1e-6
    ) {
      break
    }
    cleaned = compacted
  }

  const cleanedArea = Math.abs(getRenderProjectionSignedPolygonArea(cleaned))
  return Math.abs(cleanedArea - originalArea) / originalArea <=
    RENDER_PROJECTION_AREA_DELTA_TOLERANCE
    ? cleaned
    : polygon
}

const cleanRenderProjectionPolygons = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) =>
      removeRenderProjectionSmallConcaveNotches(
        pruneRenderProjectionMicroEdges(cleanRenderProjectionPolygon(polygon))
      )
    )
    .filter((polygon) => polygon.length >= 3)

const normalizedResolvedPacketCache = new WeakMap<
  SolidCenterStrokeResolvedPacket[],
  SolidCenterStrokeResolvedPacket[]
>()
const finalFaceCache = new WeakMap<
  SolidCenterStrokeResolvedPacket[],
  StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
>()
const hitPacketCache = new WeakMap<
  StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  SolidCenterStrokeHitTestPacket[]
>()
const exportPacketCache = new WeakMap<
  StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  SolidCenterStrokeExportPacket[]
>()

export const normalizeResolvedStrokePacketGeometry = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeResolvedPacket[] => {
  const cached = normalizedResolvedPacketCache.get(packets)
  if (cached) {
    return cached
  }

  const normalizedPackets = packets.map((packet) => {
    const polygons = normalizePacketPolygons(packet.geometry.polygons)
    if (polygons === packet.geometry.polygons) {
      return packet
    }

    return {
      ...packet,
      geometry: {
        ...packet.geometry,
        polygons,
        bounds: getBounds(polygons)
      }
    }
  })
  normalizedResolvedPacketCache.set(packets, normalizedPackets)
  return normalizedPackets
}

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const getRenderProjectionDistanceToPolygonCoverage = (
  point: Vec2,
  polygon: Vec2[]
) => {
  if (polygon.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (isPointInsidePolygon(point, polygon)) {
    return 0
  }

  return Math.min(
    ...polygon.map((vertex, index) =>
      getRenderProjectionPointToSegmentDistance(
        point,
        vertex,
        polygon[(index + 1) % polygon.length] ?? vertex
      )
    )
  )
}

const getRenderProjectionDistanceToPolygonListCoverage = (
  point: Vec2,
  polygons: Vec2[][]
) =>
  polygons.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(
        ...polygons.map((polygon) =>
          getRenderProjectionDistanceToPolygonCoverage(point, polygon)
        )
      )

const normalizeRenderProjectionVector = (vector: Vec2) => {
  const length = Math.hypot(vector.x, vector.y)
  return length > Number.EPSILON
    ? {
        x: vector.x / length,
        y: vector.y / length
      }
    : null
}

const getRenderProjectionSeamCoverageSamples = (
  boundary: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['seamEvidence']
  >['incidentSeamBoundaries'][number],
  strokeWidth = 0
) => {
  const seamRatios = [0, 0.25, 0.5, 0.75, 0.9, 0.98, 1]
  const seamEdgeSamples = seamRatios.map((ratio) => ({
    x:
      boundary.point.x +
      (boundary.outerBodyBoundaryEndpoint.x - boundary.point.x) * ratio,
    y:
      boundary.point.y +
      (boundary.outerBodyBoundaryEndpoint.y - boundary.point.y) * ratio
  }))
  const bodySideTangent = normalizeRenderProjectionVector(
    boundary.bodySideTangent
  )
  const effectiveStrokeWidth =
    strokeWidth > 0
      ? strokeWidth
      : distanceBetweenPoints(
          boundary.point,
          boundary.outerBodyBoundaryEndpoint
        )
  if (!bodySideTangent || effectiveStrokeWidth <= 0) {
    return seamEdgeSamples
  }

  const tangentDistances = [
    Math.max(0.05, effectiveStrokeWidth * 0.005),
    Math.max(0.15, effectiveStrokeWidth * 0.015),
    Math.max(0.5, effectiveStrokeWidth * 0.1),
    Math.max(1, effectiveStrokeWidth * 0.25)
  ]
  const bodySideSamples = seamRatios.flatMap((ratio) =>
    tangentDistances.map((tangentDistance) => ({
      x:
        boundary.point.x +
        (boundary.outerBodyBoundaryEndpoint.x - boundary.point.x) * ratio +
        bodySideTangent.x * tangentDistance,
      y:
        boundary.point.y +
        (boundary.outerBodyBoundaryEndpoint.y - boundary.point.y) * ratio +
        bodySideTangent.y * tangentDistance
    }))
  )
  return [...seamEdgeSamples, ...bodySideSamples]
}

const getRenderProjectionSourceVertexSeamBoundaryRecords = (
  entries: { debugMeta?: SolidCenterStrokeGeometryDebugMeta }[]
) =>
  entries.flatMap((entry) =>
    (
      entry.debugMeta?.seamEvidence?.incidentSeamBoundaries?.filter(
        (boundary) => boundary.seamBoundaryId.startsWith('source-vertex-seam:')
      ) ?? []
    ).map((boundary) => ({
      boundary,
      strokeWidth: entry.debugMeta?.strokeWidth ?? 0
    }))
  )

const canonicalizeRenderProjectionSourceVertexSeamPoints = (
  polygons: Vec2[][],
  entries: { debugMeta?: SolidCenterStrokeGeometryDebugMeta }[]
) => {
  const hasProtectedEndpointSourceVertexJoin = entries.some(
    (entry) => entry.debugMeta?.visibleContributor === 'source-vertex-join'
  )
  if (!hasProtectedEndpointSourceVertexJoin) {
    return polygons
  }

  const protectedPoints = new Map<string, Vec2>()
  getRenderProjectionSourceVertexSeamBoundaryRecords(entries).forEach(
    ({ boundary }) => {
      ;[
        boundary.point,
        boundary.outerBodyBoundaryEndpoint,
        ...boundary.bodySideOutlineSegment,
        ...boundary.outerBodyBoundaryVertices
      ].forEach((point) => {
        protectedPoints.set(getRenderProjectionSharedEdgePointKey(point), point)
      })
    }
  )
  entries.forEach((entry) => {
    entry.debugMeta?.joinOwnershipRecords?.forEach((record) => {
      if (record.kind !== 'source-vertex' || !record.vertex) {
        return
      }
      protectedPoints.set(
        getRenderProjectionSharedEdgePointKey(record.vertex),
        record.vertex
      )
    })
  })
  if (protectedPoints.size === 0 || polygons.length === 0) {
    return polygons
  }

  return polygons.map((polygon) =>
    polygon.map((point) => {
      const protectedPoint = protectedPoints.get(
        getRenderProjectionSharedEdgePointKey(point)
      )
      return protectedPoint ?? point
    })
  )
}

interface RenderProjectionLegalSideContext {
  legalDomains?: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >
  strokePosition?: SolidCenterStrokeGeometryDebugMeta['strokePosition']
}

const getRenderProjectionLegalPolygons = (
  legalDomains: RenderProjectionLegalSideContext['legalDomains']
) =>
  legalDomains?.flatMap((domain) =>
    domain.regions.flatMap((region) => region.polygons)
  ) ?? []

const isRenderProjectionSampleOnLegalSide = (
  sample: Vec2,
  context: RenderProjectionLegalSideContext
) => {
  if (
    context.strokePosition !== 'inside' &&
    context.strokePosition !== 'outside'
  ) {
    return true
  }

  const legalPolygons = getRenderProjectionLegalPolygons(context.legalDomains)
  if (legalPolygons.length === 0) {
    return true
  }

  const insideLegalDomain = legalPolygons.some((legalPolygon) =>
    isPointInsidePolygon(sample, legalPolygon)
  )
  const onBoundary =
    getRenderProjectionDistanceToLegalDomainBoundary(sample, legalPolygons) <=
    RENDER_PROJECTION_LEGAL_SIDE_BOUNDARY_TOLERANCE
  return context.strokePosition === 'inside'
    ? insideLegalDomain || onBoundary
    : !insideLegalDomain || onBoundary
}

const renderProjectionPreservesSourceVertexSeamCoverage = (
  sourcePolygons: Vec2[][],
  projectedPolygons: Vec2[][],
  entries: { debugMeta?: SolidCenterStrokeGeometryDebugMeta }[],
  legalSideContext: RenderProjectionLegalSideContext = {}
) => {
  const sourceVertexSeamBoundaryRecords =
    getRenderProjectionSourceVertexSeamBoundaryRecords(entries)
  if (sourceVertexSeamBoundaryRecords.length === 0) {
    return true
  }

  return sourceVertexSeamBoundaryRecords.every((record) =>
    getRenderProjectionSeamCoverageSamples(
      record.boundary,
      record.strokeWidth
    ).every((sample) => {
      if (!isRenderProjectionSampleOnLegalSide(sample, legalSideContext)) {
        return true
      }
      const sourceDistance = getRenderProjectionDistanceToPolygonListCoverage(
        sample,
        sourcePolygons
      )
      if (sourceDistance > RENDER_PROJECTION_SEAM_COVERAGE_TOLERANCE) {
        return true
      }

      return (
        getRenderProjectionDistanceToPolygonListCoverage(
          sample,
          projectedPolygons
        ) <= RENDER_PROJECTION_SEAM_COVERAGE_TOLERANCE
      )
    })
  )
}

export const buildSolidCenterStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: SolidCenterStrokePacketOptions = {}
): SolidCenterStrokeResolvedPacket[] => {
  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const isSelfIntersectingCenterProduct =
    topology.topologyFamily === 'self-intersecting'

  return getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsSolidCenterStroke(stroke)) {
      return []
    }

    const shouldUseStrokePathDescriptor =
      options.preferStrokePathRenderDescriptor === true &&
      isSelfIntersectingCenterProduct &&
      stroke.kind === 'solid'
    const rawPolygons = shouldUseStrokePathDescriptor
      ? [
          buildInflatedBoundsPolygon(
            topologyPoints,
            stroke.width * Math.max(2, Math.min(8, stroke.miterLimit || 4))
          )
        ].filter((polygon) => polygon.length >= 3)
      : isSelfIntersectingCenterProduct
        ? buildSelfIntersectingSolidCenterStrokePolygons(
            topologyPoints,
            topology.closed,
            stroke
          )
        : buildSolidCenterStrokePolygons(
            topologyPoints,
            topology.closed,
            stroke
          )
    const polygons = shouldUseStrokePathDescriptor
      ? rawPolygons
      : unionCoveragePolygons(rawPolygons)
    if (polygons.length === 0) {
      return []
    }

    const geometryId = `${cachePrefix}:${index}`
    return [
      {
        geometry: {
          geometryId,
          polygons,
          bounds: getBounds(polygons),
          renderDescriptor: isSelfIntersectingCenterProduct
            ? {
                strokePaths: [buildClosedStrokePath(topologyPoints, closed)],
                strokePathStyle: {
                  width: stroke.width,
                  cap: 'butt',
                  join: stroke.join,
                  miterAngle: stroke.miterAngle,
                  miterLimit: stroke.miterLimit,
                  closed: false
                }
              }
            : undefined,
          debugMeta: {
            sourcePathId: cachePrefix,
            ownerKey: options.metadata?.ownerKeyPrefix
              ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
              : undefined,
            networkId: options.metadata?.networkId,
            strokeId: `stroke:${index}`,
            strokeIndex: index,
            strokePosition: 'center',
            strokeWidth: stroke.width,
            strokeJoin: stroke.join,
            strokeCap: stroke.cap,
            strokeMiterLimit: stroke.miterLimit,
            authoredJoin: stroke.join,
            miterAngle: stroke.miterAngle,
            productMode: 'center-product',
            productSignature: 'center-product:solid',
            domainMode: 'center-product',
            visualOverlapCollapseStatus: isSelfIntersectingCenterProduct
              ? 'exact-union'
              : undefined,
            topologyFamily: topology.topologyFamily,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              productMode: 'center-product',
              domainMode: 'center-product',
              strokeProductSignature: 'center-product:solid',
              endpointCapPolicySignature: [
                'center-product',
                stroke.cap,
                stroke.width
              ].join(':'),
              joinOwnershipSignature: [
                'center-product',
                stroke.join,
                stroke.miterLimit
              ].join(':'),
              smoothContinuitySignature: 'center-product:solid',
              productMaterializationSignature: 'center-product:solid',
              ownerKey: options.metadata?.ownerKeyPrefix
                ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
                : undefined,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${index}`
            })
          }
        },
        paint: {
          geometryId,
          kind: stroke.kind,
          color: stroke.color,
          alpha: stroke.alpha,
          gradientStyle: stroke.gradientStyle,
          paintKey: stroke.paintKey
        }
      }
    ]
  })
}

export const attachStrokePacketDebugMeta = (
  packets: SolidCenterStrokeResolvedPacket[],
  debugMeta: Partial<SolidCenterStrokeGeometryDebugMeta>
): SolidCenterStrokeResolvedPacket[] => {
  const hasRuntimeDebugMeta = Object.keys(debugMeta).length > 0
  return packets.map((packet) => ({
    geometry: (() => {
      const mergedDebugMeta = {
        ...packet.geometry.debugMeta,
        ...debugMeta
      }

      return {
        ...packet.geometry,
        debugMeta: {
          ...mergedDebugMeta,
          revisionSet: !hasRuntimeDebugMeta
            ? packet.geometry.debugMeta?.revisionSet
            : updateStrokeRuntimeRevisionSetFromMetadata(
                packet.geometry.debugMeta?.revisionSet,
                mergedDebugMeta
              )
        }
      }
    })(),
    paint: packet.paint
  }))
}

export const buildSolidCenterStrokeFinalFaces = (
  packets: SolidCenterStrokeResolvedPacket[]
): StrokeFinalFace<
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokePaintPacket
>[] => {
  const cached = finalFaceCache.get(packets)
  if (cached) {
    return cached
  }

  const faces = buildStrokeFinalFacesFromResolvedPackets<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket,
    SolidCenterStrokeResolvedPacket
  >(normalizeResolvedStrokePacketGeometry(packets))
  finalFaceCache.set(packets, faces)
  return faces
}

const getProjectedGeometryId = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  face.sourceGeometryIds.length === 1 ? face.sourceGeometryIds[0] : face.faceId

const getUniqueStrings = (values: string[]) => [...new Set(values)]

const getUniqueStrokeOwners = (owners: StrokeOwnerKey[]) => {
  const ownersByIdentity = new Map<string, StrokeOwnerKey>()
  owners.forEach((owner) => {
    const identity = [
      owner.ownerKey,
      owner.sourcePathId,
      owner.networkId,
      owner.strokeId,
      owner.strokeIndex,
      owner.contourId,
      owner.intervalId
    ].join('|')
    if (!ownersByIdentity.has(identity)) {
      ownersByIdentity.set(identity, owner)
    }
  })
  return [...ownersByIdentity.values()]
}

const getMergedFinalFaceRuntimeIdentity = (
  faces: readonly {
    ownerSet: StrokeOwnerKey[]
    ownerStepIds: string[]
    terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
    seamBoundaryIds: string[]
  }[]
) => ({
  ownerSet: getUniqueStrokeOwners(faces.flatMap((face) => face.ownerSet)),
  ownerStepIds: getUniqueStrings(faces.flatMap((face) => face.ownerStepIds)),
  terminalRoles: getUniqueStrings(
    faces.flatMap((face) => face.terminalRoles)
  ) as NonNullable<SolidCenterStrokeRuntimeMeta['terminalRoles']>,
  seamBoundaryIds: getUniqueStrings(
    faces.flatMap((face) => face.seamBoundaryIds)
  )
})

const getMergedConstrainedDashedProductEvidenceEnvelope = (
  envelopes: readonly ConstrainedDashedProductEvidenceEnvelope[]
) => {
  const uniqueEnvelopes = Array.from(new Set(envelopes))
  return uniqueEnvelopes.length === 0
    ? undefined
    : uniqueEnvelopes.length === 1
      ? uniqueEnvelopes[0]
      : mergeConstrainedDashedProductEvidenceEnvelopes(uniqueEnvelopes)
}

const flatMapUniqueArrayReferences = <T>(
  arrays: readonly (readonly T[] | undefined)[]
): T[] => {
  const seen = new Set<readonly T[]>()
  const values: T[] = []
  for (const array of arrays) {
    if (!array || seen.has(array)) {
      continue
    }
    seen.add(array)
    values.push(...array)
  }
  return values
}

const getMergedFinalFaceOutputProductIdentity = (
  faces: readonly {
    ownerSet: StrokeOwnerKey[]
    ownerStepIds: string[]
    intervalIds: string[]
    terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
    seamBoundaryIds: string[]
    sourceSpanIds: string[]
    sourceNetworkIds: string[]
    sourceContourIds: string[]
    legalDomainIds: string[]
    productEvidenceEnvelope?: ConstrainedDashedProductEvidenceEnvelope
  }[]
): SolidCenterStrokeOutputProductIdentity => {
  const runtimeIdentity = getMergedFinalFaceRuntimeIdentity(faces)
  const productEvidenceEnvelopes = faces.flatMap((face) =>
    face.productEvidenceEnvelope ? [face.productEvidenceEnvelope] : []
  )
  const productEvidenceEnvelope =
    getMergedConstrainedDashedProductEvidenceEnvelope(
      productEvidenceEnvelopes
    )
  return {
    primaryOwner: runtimeIdentity.ownerSet[0],
    ...runtimeIdentity,
    intervalIds: getUniqueStrings(faces.flatMap((face) => face.intervalIds)),
    sourceSpanIds: getUniqueStrings(
      faces.flatMap((face) => face.sourceSpanIds)
    ),
    sourceNetworkIds: getUniqueStrings(
      faces.flatMap((face) => face.sourceNetworkIds)
    ),
    sourceContourIds: getUniqueStrings(
      faces.flatMap((face) => face.sourceContourIds)
    ),
    legalDomainIds: getUniqueStrings(
      faces.flatMap((face) => face.legalDomainIds)
    ),
    ...(productEvidenceEnvelope ? { productEvidenceEnvelope } : {})
  }
}

const getMergedDebugIntervalIds = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  getUniqueStrings(
    faces.flatMap((face) =>
      [
        ...face.intervalIds,
        ...(face.debugMeta?.intervalIds ?? []),
        ...(face.debugMeta?.dashProductIntervals?.map(
          (interval) => interval.intervalId
        ) ?? []),
        face.debugMeta?.intervalId
      ].filter((intervalId): intervalId is string => intervalId !== undefined)
    )
  )

type DashProductIntervalDebugRecord = NonNullable<
  SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
>[number]
type PhysicalSpanRangeDebugRecord = NonNullable<
  SolidCenterStrokeGeometryDebugMeta['physicalSpanRanges']
>[number]

const isTerminalDashProductRole = (
  role: SolidCenterStrokeGeometryDebugMeta['domainPlanTerminalRole']
) => role === 'start' || role === 'end' || role === 'start-end'

const hasTerminalDashProductIdentity = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined
) =>
  debugMeta !== undefined &&
  (isTerminalDashProductRole(debugMeta.domainPlanTerminalRole) ||
    debugMeta.dashProductIntervals?.some((interval) =>
      isTerminalDashProductRole(interval.terminalRole)
    ) === true ||
    debugMeta.domainPlanSplitRangeTerminals?.some((terminal) =>
      isTerminalDashProductRole(terminal.terminalRole)
    ) === true)

const getRenderDebugMetaTerminalDashProductInterval = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined,
  defaultIntervalIds: readonly string[] = []
): DashProductIntervalDebugRecord | undefined => {
  if (!debugMeta) {
    return undefined
  }

  const intervalId =
    debugMeta.intervalId ?? debugMeta.intervalIds?.[0] ?? defaultIntervalIds[0]
  if (
    !intervalId ||
    !isTerminalDashProductRole(debugMeta.domainPlanTerminalRole)
  ) {
    return undefined
  }

  return {
    intervalId,
    splitRangeId: debugMeta.domainPlanSplitRangeId,
    splitRangeAliasIds: debugMeta.domainPlanSplitRangeAliasIds,
    terminalRole: debugMeta.domainPlanTerminalRole,
    startDistance: debugMeta.domainPlanSplitRangeStartDistance,
    endDistance: debugMeta.domainPlanSplitRangeEndDistance,
    boundaryDomainId: debugMeta.domainPlanBoundaryDomainId,
    boundaryPoints: debugMeta.domainPlanBoundaryPoints,
    boundaryStartDistance: debugMeta.domainPlanBoundaryStartDistance,
    boundaryEndDistance: debugMeta.domainPlanBoundaryEndDistance,
    boundaryTotalLength: debugMeta.domainPlanBoundaryTotalLength,
    boundaryRole: debugMeta.domainPlanBoundaryRole,
    selectedSide: debugMeta.domainPlanSelectedSide,
    materializedSelectedSide: debugMeta.domainPlanMaterializedSelectedSide,
    filledSide: debugMeta.domainPlanFilledSide,
    unfilledSide: debugMeta.domainPlanUnfilledSide,
    sourceSegmentIndex: debugMeta.domainPlanSplitRangeSourceSegmentIndex,
    sourceStartDistance: debugMeta.domainPlanSplitRangeSourceStartDistance,
    sourceEndDistance: debugMeta.domainPlanSplitRangeSourceEndDistance,
    endpointCapPolicySignature: debugMeta.dashEndpointCapPolicySignature,
    joinOwnershipSignature: debugMeta.joinOwnershipSignature,
    smoothContinuityGroupId: debugMeta.smoothContinuityGroupId,
    materializationDistanceSpace: debugMeta.materializationDistanceSpace
  }
}

const getRenderDebugMetaDashProductIntervals = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined,
  defaultIntervalIds: readonly string[] = []
): DashProductIntervalDebugRecord[] => {
  if (!debugMeta) {
    return []
  }

  const intervals = [...(debugMeta.dashProductIntervals ?? [])]
  const terminalInterval = getRenderDebugMetaTerminalDashProductInterval(
    debugMeta,
    defaultIntervalIds
  )
  if (terminalInterval) {
    intervals.push(terminalInterval)
  }

  return intervals
}

const formatDashProductIntervalKeyNumber = (value: number | undefined) =>
  value === undefined ? 'none' : value.toFixed(6)

const getDashProductIntervalRenderArrayKey = (
  interval: DashProductIntervalDebugRecord
) => {
  if (
    interval.sourceSegmentIndex !== undefined &&
    interval.sourceStartDistance !== undefined &&
    interval.sourceEndDistance !== undefined
  ) {
    const sourceStartDistance = Math.min(
      interval.sourceStartDistance,
      interval.sourceEndDistance
    )
    const sourceEndDistance = Math.max(
      interval.sourceStartDistance,
      interval.sourceEndDistance
    )
    return [
      'source-range',
      `interval:${interval.intervalId}`,
      interval.terminalRole ?? 'terminal-role',
      `split:${interval.splitRangeId ?? interval.splitRangeAliasIds?.join(',') ?? 'no-split-range'}`,
      `segment:${interval.sourceSegmentIndex}`,
      formatDashProductIntervalKeyNumber(sourceStartDistance),
      formatDashProductIntervalKeyNumber(sourceEndDistance),
      `side:${interval.materializedSelectedSide ?? interval.selectedSide ?? 'side'}`
    ].join('|')
  }

  return [
    'interval-id',
    interval.intervalId,
    interval.terminalRole ?? 'terminal-role',
    `split:${interval.splitRangeId ?? interval.splitRangeAliasIds?.join(',') ?? 'no-split-range'}`,
    `segment:${interval.sourceSegmentIndex ?? 'no-source-segment'}`,
    `side:${interval.materializedSelectedSide ?? interval.selectedSide ?? 'side'}`
  ].join('|')
}

const getUniqueDashProductIntervalsForRenderArray = (
  intervals: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
  >
) => {
  const intervalByKey = new Map<string, DashProductIntervalDebugRecord>()
  intervals.forEach((interval) => {
    const key = getDashProductIntervalRenderArrayKey(interval)
    if (!intervalByKey.has(key)) {
      intervalByKey.set(key, interval)
    }
  })
  return Array.from(intervalByKey.values())
}

const getProjectedDashProductIntervals = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined,
  defaultIntervalIds: readonly string[],
  overrideIntervals:
    | SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
    | undefined
) => {
  if (overrideIntervals) {
    return overrideIntervals.length > 0
      ? getUniqueDashProductIntervalsForRenderArray(overrideIntervals)
      : undefined
  }

  const sourceIntervals = debugMeta?.dashProductIntervals
  const terminalInterval = getRenderDebugMetaTerminalDashProductInterval(
    debugMeta,
    defaultIntervalIds
  )
  if (!terminalInterval) {
    return sourceIntervals
  }

  const terminalKey = getDashProductIntervalRenderArrayKey(terminalInterval)
  if (
    sourceIntervals?.some(
      (interval) =>
        getDashProductIntervalRenderArrayKey(interval) === terminalKey
    )
  ) {
    return sourceIntervals
  }

  return getUniqueDashProductIntervalsForRenderArray([
    ...(sourceIntervals ?? []),
    terminalInterval
  ])
}

const getPhysicalSpanRangeKey = (span: PhysicalSpanRangeDebugRecord) =>
  [
    span.spanId,
    span.role,
    formatDashProductIntervalKeyNumber(span.startDistance),
    formatDashProductIntervalKeyNumber(span.endDistance),
    span.wrapsSeam ? 'wrap' : 'nowrap'
  ].join('|')

const getUniquePhysicalSpanRangesForRenderArray = (
  spans: NonNullable<SolidCenterStrokeGeometryDebugMeta['physicalSpanRanges']>
) => {
  const spanByKey = new Map<string, PhysicalSpanRangeDebugRecord>()
  spans.forEach((span) => {
    const key = getPhysicalSpanRangeKey(span)
    if (!spanByKey.has(key)) {
      spanByKey.set(key, span)
    }
  })
  return Array.from(spanByKey.values())
}

const getUniqueJoinOwnershipRecords = (
  records: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['joinOwnershipRecords']
  >
) => {
  const seen = new Set<string>()
  const uniqueRecords: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['joinOwnershipRecords']
  > = []

  records.forEach((record) => {
    const key = JSON.stringify({
      kind: record.kind,
      materializationKind: record.materializationKind,
      intervalIds: record.intervalIds ?? [],
      selectedSide: record.selectedSide,
      domainKey: record.domainKey,
      vertex: record.vertex,
      previousContourPoint: record.previousContourPoint,
      nextContourPoint: record.nextContourPoint
    })
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    uniqueRecords.push({
      ...record,
      intervalIds: record.intervalIds ? [...record.intervalIds] : undefined,
      bounds: { ...record.bounds },
      vertex: record.vertex ? { ...record.vertex } : undefined,
      previousContourPoint: record.previousContourPoint
        ? { ...record.previousContourPoint }
        : undefined,
      nextContourPoint: record.nextContourPoint
        ? { ...record.nextContourPoint }
        : undefined,
      stageBounds: record.stageBounds ? { ...record.stageBounds } : undefined,
      previousDashBodyPoint: record.previousDashBodyPoint
        ? { ...record.previousDashBodyPoint }
        : undefined,
      nextDashBodyPoint: record.nextDashBodyPoint
        ? { ...record.nextDashBodyPoint }
        : undefined
    })
  })

  return uniqueRecords
}

const flattenFacePolygons = (
  regions: PolygonRegion[],
  sourcePolygons: Vec2[][]
) => {
  const polygons = regions.flatMap((region) => region.polygons)
  return cleanRenderProjectionPolygons(
    polygons.length > 0 ? polygons : sourcePolygons
  )
}

const intersectDescriptorPolygons = (
  subjectPolygons: Vec2[][],
  clipPolygons: Vec2[][]
) => {
  if (subjectPolygons.length === 0 || clipPolygons.length === 0) {
    return subjectPolygons
  }

  const backend = getGeometryBackend()
  if (
    backend.capabilities.intersection !== true ||
    typeof backend.intersection !== 'function'
  ) {
    return []
  }

  return flattenFacePolygons(
    backend.intersection(
      [
        {
          polygons: subjectPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      [
        {
          polygons: clipPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      'nonzero'
    ),
    []
  )
}

const differenceDescriptorPolygons = (
  subjectPolygons: Vec2[][],
  excludedPolygons: Vec2[][]
) => {
  if (subjectPolygons.length === 0 || excludedPolygons.length === 0) {
    return subjectPolygons
  }

  const backend = getGeometryBackend()
  if (
    backend.capabilities.difference !== true ||
    typeof backend.difference !== 'function'
  ) {
    return []
  }

  return flattenFacePolygons(
    backend.difference(
      [
        {
          polygons: subjectPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      [
        {
          polygons: excludedPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      'nonzero'
    ),
    []
  )
}

const unionDescriptorPolygons = (polygons: Vec2[][]) => {
  if (polygons.length <= 1) {
    return polygons
  }

  const backend = getGeometryBackend()
  if (
    backend.capabilities.union !== true ||
    typeof backend.union !== 'function'
  ) {
    return polygons
  }

  try {
    const unionPolygons = flattenFacePolygons(
      backend.union(
        polygons.map((polygon) => ({
          polygons: [normalizeCoveragePolygonWinding(polygon)]
        })),
        'nonzero'
      ),
      polygons
    )
    return unionPolygons.length > 0 ? unionPolygons : polygons
  } catch {
    return polygons
  }
}

const buildStrokePathDescriptorPolygons = (
  strokePaths: Vec2[][] | undefined,
  style: SolidCenterStrokeRenderDescriptor['strokePathStyle'] | undefined
) =>
  style
    ? (strokePaths ?? []).flatMap((strokePath) =>
        buildSolidCenterStrokePolygons(strokePath, style.closed ?? false, {
          style: 'solid',
          position: 'center',
          width: style.width,
          cap: style.cap,
          join: style.join,
          miterAngle: style.miterAngle,
          miterLimit: style.miterLimit
        })
      )
    : []

const materializeRenderDescriptorProductPolygons = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined,
  carrierPolygons: Vec2[][]
) => {
  if (!descriptor) {
    return carrierPolygons
  }

  const hasDescriptorProductPolygons =
    descriptor.descriptorProductPolygons !== undefined &&
    descriptor.descriptorProductPolygons.length > 0
  const descriptorProductPolygonsAreExactClip =
    hasDescriptorProductPolygons &&
    descriptor.clipPolygons === descriptor.descriptorProductPolygons

  if (descriptorProductPolygonsAreExactClip) {
    let productPolygons = [
      ...(descriptor.fillPolygons ?? []),
      ...(descriptor.strokeMaskPolygons ?? []),
      ...(descriptor.descriptorProductPolygons ?? [])
    ]

    if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
      productPolygons = intersectDescriptorPolygons(
        productPolygons,
        descriptor.fillClipPolygons
      )
    }

    if (
      descriptor.fillExcludePolygons &&
      descriptor.fillExcludePolygons.length > 0
    ) {
      productPolygons = differenceDescriptorPolygons(
        productPolygons,
        descriptor.fillExcludePolygons
      )
    }

    return cleanRenderProjectionPolygons(
      unionDescriptorPolygons(productPolygons)
    )
  }

  const groupPolygons =
    descriptor.strokePathGroups?.flatMap((group) => {
      const polygons = buildStrokePathDescriptorPolygons(
        group.strokePaths,
        group.strokePathStyle ?? descriptor.strokePathStyle
      )
      return group.clipPolygons && group.clipPolygons.length > 0
        ? intersectDescriptorPolygons(polygons, group.clipPolygons)
        : polygons
    }) ?? []
  const descriptorProductClipsStrokePathGroups =
    hasDescriptorProductPolygons && groupPolygons.length > 0

  let flatProductPolygons = hasDescriptorProductPolygons
    ? descriptorProductClipsStrokePathGroups
      ? [
          ...(descriptor.fillPolygons ?? []),
          ...(descriptor.strokeMaskPolygons ?? []),
          ...buildStrokePathDescriptorPolygons(
            descriptor.strokePaths,
            descriptor.strokePathStyle
          )
        ]
      : (descriptor.descriptorProductPolygons ?? [])
    : [
        ...(descriptor.fillPolygons ?? []),
        ...(descriptor.strokeMaskPolygons ?? []),
        ...buildStrokePathDescriptorPolygons(
          descriptor.strokePaths,
          descriptor.strokePathStyle
        )
      ]

  if (
    flatProductPolygons.length > 0 &&
    descriptor.clipPolygons &&
    descriptor.clipPolygons.length > 0
  ) {
    flatProductPolygons = intersectDescriptorPolygons(
      flatProductPolygons,
      descriptor.clipPolygons
    )
  }

  let productPolygons = [...flatProductPolygons, ...groupPolygons]

  if (descriptorProductClipsStrokePathGroups) {
    productPolygons = intersectDescriptorPolygons(
      productPolygons,
      descriptor.descriptorProductPolygons ?? []
    )
  }

  if (productPolygons.length === 0) {
    productPolygons =
      descriptor.clipPolygons && descriptor.clipPolygons.length > 0
        ? intersectDescriptorPolygons(carrierPolygons, descriptor.clipPolygons)
        : carrierPolygons
  }

  if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
    productPolygons = intersectDescriptorPolygons(
      productPolygons,
      descriptor.fillClipPolygons
    )
  }

  if (
    descriptor.fillExcludePolygons &&
    descriptor.fillExcludePolygons.length > 0
  ) {
    productPolygons = differenceDescriptorPolygons(
      productPolygons,
      descriptor.fillExcludePolygons
    )
  }

  return cleanRenderProjectionPolygons(unionDescriptorPolygons(productPolygons))
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const measureStrokeRenderEntryPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraVectorRenderDetailPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderDetailPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const RENDER_PROJECTION_ARRANGEMENT_CACHE_LIMIT = 2048
const renderProjectionArrangementCache = new Map<string, Vec2[][]>()

interface RenderProjectionCandidateRegion extends CandidateRegion {
  geometryBounds: Bounds
  geometrySignature: string
  sourceNetworkIds?: string[]
}

const buildRenderProjectionPolygonSignature = (polygon: Vec2[]) =>
  polygon
    .map(
      (point) => `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`
    )
    .join(';')

const buildRenderProjectionRegionSignature = (polygons: Vec2[][]) =>
  polygons.map(buildRenderProjectionPolygonSignature).join('||')

const buildRenderProjectionArrangementCacheKey = (
  candidates: RenderProjectionCandidateRegion[],
  backend: Pick<GeometryBackend, 'capabilities' | 'buildArrangement' | 'union'>
) =>
  [
    getGeometryBackendCacheSignature(backend as GeometryBackend),
    ...candidates.map(
      (candidate) =>
        `${candidate.strokePosition}:${candidate.legalDomainId ?? 'no-legal-domain'}:${candidate.geometrySignature}`
    )
  ].join('::')

const isRenderProjectionArrangementFaceLegalForCandidate = (
  candidate: CandidateRegion,
  legalState: ArrangementFace['legalState']
) => {
  if (candidate.renderProjectionSplitter === true) {
    return false
  }

  switch (candidate.strokePosition) {
    case 'inside':
      return legalState.insideFillDomain
    case 'outside':
      return legalState.outsideFillDomain
    case 'center':
      return true
  }
}

const getCachedRenderProjectionArrangement = (
  cacheKey: string
): Vec2[][] | null => {
  const cached = renderProjectionArrangementCache.get(cacheKey)
  if (!cached) {
    emitStrokePipelineCounter('render-projection-arrangement-cache-miss')
    return null
  }

  renderProjectionArrangementCache.delete(cacheKey)
  renderProjectionArrangementCache.set(cacheKey, cached)
  emitStrokePipelineCounter('render-projection-arrangement-cache-hit')
  return cached
}

const setCachedRenderProjectionArrangement = (
  cacheKey: string,
  polygons: Vec2[][]
) => {
  if (
    renderProjectionArrangementCache.size >=
    RENDER_PROJECTION_ARRANGEMENT_CACHE_LIMIT
  ) {
    const oldestKey = renderProjectionArrangementCache.keys().next().value
    if (oldestKey) {
      renderProjectionArrangementCache.delete(oldestKey)
    }
  }
  renderProjectionArrangementCache.set(cacheKey, polygons)
}

const getSignedPolygonArea = (polygon: Vec2[]) => {
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    area += current.x * next.y - next.x * current.y
  }

  return area / 2
}

const getPolygonCoverageArea = (polygon: Vec2[]) =>
  Math.abs(getSignedPolygonArea(polygon))

const getPolygonListCoverageArea = (polygons: Vec2[][]) =>
  polygons.reduce((area, polygon) => area + getPolygonCoverageArea(polygon), 0)

const normalizeCoveragePolygonWinding = (polygon: Vec2[]) =>
  getSignedPolygonArea(polygon) < 0 ? [...polygon].reverse() : polygon

interface RenderProjectionSharedEdge {
  startKey: string
  endKey: string
  start: Vec2
  end: Vec2
}

const RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE = 0.05
const RENDER_PROJECTION_SHARED_EDGE_KEY_TOLERANCE = 0.1
const RENDER_PROJECTION_SHARED_EDGE_OUTPUT_TOLERANCE = 0.001
const RENDER_PROJECTION_SHARED_EDGE_AREA_TOLERANCE = 0.01

function getRenderProjectionSharedEdgePointKey(point: Vec2) {
  const scale = 1 / RENDER_PROJECTION_SHARED_EDGE_KEY_TOLERANCE
  return `${Math.round(point.x * scale)}:${Math.round(point.y * scale)}`
}

function snapRenderProjectionSharedEdgePoint(point: Vec2): Vec2 {
  const scale = 1 / RENDER_PROJECTION_SHARED_EDGE_OUTPUT_TOLERANCE
  return {
    x: Math.round(point.x * scale) / scale,
    y: Math.round(point.y * scale) / scale
  }
}

function getRenderProjectionSharedEdgeUndirectedKey(
  startKey: string,
  endKey: string
) {
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`
}

function buildRenderProjectionCanonicalPointMap(polygons: Vec2[][]) {
  const pointStats = new Map<string, { x: number; y: number; count: number }>()
  polygons.forEach((polygon) => {
    polygon.forEach((point) => {
      const key = getRenderProjectionSharedEdgePointKey(point)
      const stats = pointStats.get(key) ?? { x: 0, y: 0, count: 0 }
      stats.x += point.x
      stats.y += point.y
      stats.count += 1
      pointStats.set(key, stats)
    })
  })

  const points = new Map<string, Vec2>()
  pointStats.forEach((stats, key) => {
    points.set(key, {
      x: stats.x / stats.count,
      y: stats.y / stats.count
    })
  })
  return points
}

function getCanonicalRenderProjectionPoint(
  canonicalPoints: Map<string, Vec2>,
  key: string,
  point: Vec2
) {
  return canonicalPoints.get(key) ?? point
}

function getRenderProjectionSegmentRatio(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= Number.EPSILON) {
    return null
  }
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
}

function isRenderProjectionPointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
  const ratio = getRenderProjectionSegmentRatio(point, start, end)
  return (
    ratio !== null &&
    ratio > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE &&
    ratio < 1 - RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE &&
    distancePointToSegment(point, start, end) <=
      RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
  )
}

function appendRenderProjectionSharedSubEdges(
  edges: RenderProjectionSharedEdge[],
  canonicalPoints: Map<string, Vec2>,
  startKey: string,
  endKey: string,
  start: Vec2,
  end: Vec2,
  extraSplitPoints: { key: string; point: Vec2; ratio: number }[] = []
) {
  const splitPoints = [
    { key: startKey, point: start, ratio: 0 },
    { key: endKey, point: end, ratio: 1 },
    ...extraSplitPoints
  ]
  canonicalPoints.forEach((point, key) => {
    if (
      key === startKey ||
      key === endKey ||
      !isRenderProjectionPointOnSegment(point, start, end)
    ) {
      return
    }
    const ratio = getRenderProjectionSegmentRatio(point, start, end)
    if (ratio !== null) {
      splitPoints.push({ key, point, ratio })
    }
  })

  splitPoints
    .sort((left, right) => left.ratio - right.ratio)
    .forEach((splitPoint, index, sortedPoints) => {
      const next = sortedPoints[index + 1]
      if (
        !next ||
        splitPoint.key === next.key ||
        distanceBetweenPoints(splitPoint.point, next.point) <=
          RENDER_PROJECTION_SHARED_EDGE_OUTPUT_TOLERANCE
      ) {
        return
      }
      edges.push({
        startKey: splitPoint.key,
        endKey: next.key,
        start: splitPoint.point,
        end: next.point
      })
    })
}

function removeRenderProjectionSharedInteriorEdges(
  edges: RenderProjectionSharedEdge[]
) {
  const edgesByUndirectedKey = new Map<string, RenderProjectionSharedEdge[]>()
  edges.forEach((edge) => {
    const key = getRenderProjectionSharedEdgeUndirectedKey(
      edge.startKey,
      edge.endKey
    )
    const list = edgesByUndirectedKey.get(key) ?? []
    list.push(edge)
    edgesByUndirectedKey.set(key, list)
  })

  let removedSharedEdge = false
  const boundaryEdges: RenderProjectionSharedEdge[] = []
  edgesByUndirectedKey.forEach((bucket) => {
    const remaining = [...bucket]
    for (let leftIndex = 0; leftIndex < remaining.length; leftIndex += 1) {
      const rightIndex = remaining.findIndex(
        (_, candidateIndex) => candidateIndex !== leftIndex
      )
      if (rightIndex < 0) {
        continue
      }

      remaining.splice(Math.max(leftIndex, rightIndex), 1)
      remaining.splice(Math.min(leftIndex, rightIndex), 1)
      leftIndex = -1
      removedSharedEdge = true
    }
    boundaryEdges.push(...remaining)
  })

  return removedSharedEdge ? boundaryEdges : null
}

function traceRenderProjectionSharedEdgeLoops(
  edges: RenderProjectionSharedEdge[]
) {
  const unused = new Set(edges.map((_, index) => index))
  const loops: Vec2[][] = []

  const takeNextEdgeIndex = (startKey: string) => {
    const directedCandidate = [...unused].find(
      (edgeIndex) => edges[edgeIndex].startKey === startKey
    )
    if (directedCandidate !== undefined) {
      return directedCandidate
    }
    return [...unused].find((edgeIndex) => edges[edgeIndex].endKey === startKey)
  }

  const orientEdgeFromKey = (
    edge: RenderProjectionSharedEdge,
    startKey: string
  ) =>
    edge.startKey === startKey
      ? edge
      : {
          startKey: edge.endKey,
          endKey: edge.startKey,
          start: edge.end,
          end: edge.start
        }

  while (unused.size > 0) {
    const firstIndex = unused.values().next().value as number | undefined
    if (firstIndex === undefined) {
      break
    }

    const firstEdge = edges[firstIndex]
    unused.delete(firstIndex)
    const loop = [firstEdge.start, firstEdge.end]
    const startKey = firstEdge.startKey
    let currentKey = firstEdge.endKey

    for (let guard = 0; guard <= edges.length; guard += 1) {
      if (currentKey === startKey) {
        loop.pop()
        const cleanedLoop = cleanRenderProjectionPolygon(loop)
        if (cleanedLoop.length < 3) {
          return null
        }
        loops.push(normalizeCoveragePolygonWinding(cleanedLoop))
        break
      }

      const nextIndex = takeNextEdgeIndex(currentKey)
      if (nextIndex === undefined) {
        return null
      }
      const nextEdge = orientEdgeFromKey(edges[nextIndex], currentKey)
      unused.delete(nextIndex)
      loop.push(nextEdge.end)
      currentKey = nextEdge.endKey

      if (guard === edges.length) {
        return null
      }
    }
  }

  return loops
}

function getRenderProjectionCollinearSegmentOverlapLength(
  leftStart: Vec2,
  leftEnd: Vec2,
  rightStart: Vec2,
  rightEnd: Vec2
) {
  const axis = {
    x: leftEnd.x - leftStart.x,
    y: leftEnd.y - leftStart.y
  }
  const axisLength = Math.hypot(axis.x, axis.y)
  const rightAxis = {
    x: rightEnd.x - rightStart.x,
    y: rightEnd.y - rightStart.y
  }
  const rightAxisLength = Math.hypot(rightAxis.x, rightAxis.y)
  if (axisLength <= Number.EPSILON || rightAxisLength <= Number.EPSILON) {
    return 0
  }

  const parallelDistance =
    Math.abs(axis.x * rightAxis.y - axis.y * rightAxis.x) /
    Math.max(axisLength, rightAxisLength)
  if (parallelDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE) {
    return 0
  }

  const rightStartLineDistance =
    Math.abs(
      axis.x * (rightStart.y - leftStart.y) -
        axis.y * (rightStart.x - leftStart.x)
    ) / axisLength
  const rightEndLineDistance =
    Math.abs(
      axis.x * (rightEnd.y - leftStart.y) - axis.y * (rightEnd.x - leftStart.x)
    ) / axisLength
  if (
    rightStartLineDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE ||
    rightEndLineDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
  ) {
    return 0
  }

  const normalizedAxis = {
    x: axis.x / axisLength,
    y: axis.y / axisLength
  }
  const rightRange = [rightStart, rightEnd]
    .map(
      (point) =>
        (point.x - leftStart.x) * normalizedAxis.x +
        (point.y - leftStart.y) * normalizedAxis.y
    )
    .sort((left, right) => left - right)
  return Math.max(
    0,
    Math.min(axisLength, rightRange[1]) - Math.max(0, rightRange[0])
  )
}

function getRenderProjectionCollinearOverlapSplitPoints(
  leftStart: Vec2,
  leftEnd: Vec2,
  rightStart: Vec2,
  rightEnd: Vec2
) {
  const axis = {
    x: leftEnd.x - leftStart.x,
    y: leftEnd.y - leftStart.y
  }
  const axisLength = Math.hypot(axis.x, axis.y)
  const rightAxis = {
    x: rightEnd.x - rightStart.x,
    y: rightEnd.y - rightStart.y
  }
  const rightAxisLength = Math.hypot(rightAxis.x, rightAxis.y)
  if (axisLength <= Number.EPSILON || rightAxisLength <= Number.EPSILON) {
    return []
  }

  const parallelDistance =
    Math.abs(axis.x * rightAxis.y - axis.y * rightAxis.x) /
    Math.max(axisLength, rightAxisLength)
  if (parallelDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE) {
    return []
  }

  const rightStartLineDistance =
    Math.abs(
      axis.x * (rightStart.y - leftStart.y) -
        axis.y * (rightStart.x - leftStart.x)
    ) / axisLength
  const rightEndLineDistance =
    Math.abs(
      axis.x * (rightEnd.y - leftStart.y) - axis.y * (rightEnd.x - leftStart.x)
    ) / axisLength
  if (
    rightStartLineDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE ||
    rightEndLineDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
  ) {
    return []
  }

  const normalizedAxis = {
    x: axis.x / axisLength,
    y: axis.y / axisLength
  }
  const rightRange = [rightStart, rightEnd]
    .map(
      (point) =>
        (point.x - leftStart.x) * normalizedAxis.x +
        (point.y - leftStart.y) * normalizedAxis.y
    )
    .sort((left, right) => left - right)
  const overlapStart = Math.max(0, rightRange[0])
  const overlapEnd = Math.min(axisLength, rightRange[1])
  if (
    overlapEnd - overlapStart <=
    RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
  ) {
    return []
  }

  return [overlapStart, overlapEnd].map((distanceAlongEdge) => {
    const point = snapRenderProjectionSharedEdgePoint({
      x: leftStart.x + normalizedAxis.x * distanceAlongEdge,
      y: leftStart.y + normalizedAxis.y * distanceAlongEdge
    })
    return {
      key: getRenderProjectionSharedEdgePointKey(point),
      point,
      ratio: distanceAlongEdge / axisLength
    }
  })
}

function getRenderProjectionSharedBoundaryLength(
  leftPolygon: Vec2[],
  rightPolygon: Vec2[]
) {
  let sharedLength = 0
  leftPolygon.forEach((leftPoint, leftIndex) => {
    const leftNext = leftPolygon[(leftIndex + 1) % leftPolygon.length]
    rightPolygon.forEach((rightPoint, rightIndex) => {
      const rightNext = rightPolygon[(rightIndex + 1) % rightPolygon.length]
      sharedLength += getRenderProjectionCollinearSegmentOverlapLength(
        leftPoint,
        leftNext,
        rightPoint,
        rightNext
      )
    })
  })
  return sharedLength
}

interface RenderProjectionSharedEdgeOverlap {
  leftEdgeIndex: number
  rightEdgeIndex: number
  start: Vec2
  end: Vec2
  leftStartRatio: number
  leftEndRatio: number
  rightStartRatio: number
  rightEndRatio: number
  length: number
}

const getRenderProjectionSharedEdgeOverlap = (
  leftPolygon: Vec2[],
  rightPolygon: Vec2[]
): RenderProjectionSharedEdgeOverlap | null => {
  let best: RenderProjectionSharedEdgeOverlap | null = null

  leftPolygon.forEach((leftStart, leftEdgeIndex) => {
    const leftEnd = leftPolygon[(leftEdgeIndex + 1) % leftPolygon.length]
    const axis = {
      x: leftEnd.x - leftStart.x,
      y: leftEnd.y - leftStart.y
    }
    const axisLength = Math.hypot(axis.x, axis.y)
    if (axisLength <= Number.EPSILON) {
      return
    }
    const normalizedAxis = {
      x: axis.x / axisLength,
      y: axis.y / axisLength
    }

    rightPolygon.forEach((rightStart, rightEdgeIndex) => {
      const rightEnd = rightPolygon[(rightEdgeIndex + 1) % rightPolygon.length]
      const rightAxis = {
        x: rightEnd.x - rightStart.x,
        y: rightEnd.y - rightStart.y
      }
      const rightAxisLength = Math.hypot(rightAxis.x, rightAxis.y)
      if (rightAxisLength <= Number.EPSILON) {
        return
      }
      const parallelDistance =
        Math.abs(axis.x * rightAxis.y - axis.y * rightAxis.x) /
        Math.max(axisLength, rightAxisLength)
      if (parallelDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE) {
        return
      }

      const rightStartLineDistance =
        Math.abs(
          axis.x * (rightStart.y - leftStart.y) -
            axis.y * (rightStart.x - leftStart.x)
        ) / axisLength
      const rightEndLineDistance =
        Math.abs(
          axis.x * (rightEnd.y - leftStart.y) -
            axis.y * (rightEnd.x - leftStart.x)
        ) / axisLength
      if (
        rightStartLineDistance >
          RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE ||
        rightEndLineDistance > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
      ) {
        return
      }

      const rightRange = [rightStart, rightEnd]
        .map(
          (point) =>
            (point.x - leftStart.x) * normalizedAxis.x +
            (point.y - leftStart.y) * normalizedAxis.y
        )
        .sort((left, right) => left - right)
      const overlapStart = Math.max(0, rightRange[0])
      const overlapEnd = Math.min(axisLength, rightRange[1])
      const length = overlapEnd - overlapStart
      if (length <= RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE) {
        return
      }

      const start = snapRenderProjectionSharedEdgePoint({
        x: leftStart.x + normalizedAxis.x * overlapStart,
        y: leftStart.y + normalizedAxis.y * overlapStart
      })
      const end = snapRenderProjectionSharedEdgePoint({
        x: leftStart.x + normalizedAxis.x * overlapEnd,
        y: leftStart.y + normalizedAxis.y * overlapEnd
      })
      const rightStartRatio = getRenderProjectionSegmentRatio(
        start,
        rightStart,
        rightEnd
      )
      const rightEndRatio = getRenderProjectionSegmentRatio(
        end,
        rightStart,
        rightEnd
      )
      if (rightStartRatio === null || rightEndRatio === null) {
        return
      }

      if (!best || length > best.length) {
        best = {
          leftEdgeIndex,
          rightEdgeIndex,
          start,
          end,
          leftStartRatio: overlapStart / axisLength,
          leftEndRatio: overlapEnd / axisLength,
          rightStartRatio,
          rightEndRatio,
          length
        }
      }
    })
  })

  return best
}

const pointsAreWithinRenderProjectionTolerance = (left: Vec2, right: Vec2) =>
  distanceBetweenPoints(left, right) <=
  RENDER_PROJECTION_SHARED_EDGE_KEY_TOLERANCE

const cleanRenderProjectionSplicedLoop = (loop: Vec2[]) =>
  normalizeCoveragePolygonWinding(
    cleanRenderProjectionPolygon(
      loop.filter(
        (point, index) =>
          index === 0 ||
          !pointsAreWithinRenderProjectionTolerance(point, loop[index - 1])
      )
    )
  )

const buildRenderProjectionBoundaryRemainder = (
  polygon: Vec2[],
  edgeIndex: number,
  removeStart: Vec2,
  removeEnd: Vec2
) => {
  const remainder: Vec2[] = [removeEnd]
  for (
    let cursor = (edgeIndex + 1) % polygon.length;
    cursor !== edgeIndex;
    cursor = (cursor + 1) % polygon.length
  ) {
    const point = polygon[cursor]
    if (!pointsAreWithinRenderProjectionTolerance(point, removeEnd)) {
      remainder.push(point)
    }
  }
  if (
    !pointsAreWithinRenderProjectionTolerance(
      remainder[remainder.length - 1],
      removeStart
    )
  ) {
    remainder.push(removeStart)
  }
  return remainder
}

const tryMergeRenderProjectionSharedEdgePolygonPair = (
  leftPolygon: Vec2[],
  rightPolygon: Vec2[]
) => {
  const overlap = getRenderProjectionSharedEdgeOverlap(
    leftPolygon,
    rightPolygon
  )
  if (!overlap) {
    return null
  }

  const leftRemoveStart = overlap.start
  const leftRemoveEnd = overlap.end
  const rightRemoveStart =
    overlap.rightStartRatio <= overlap.rightEndRatio
      ? overlap.start
      : overlap.end
  const rightRemoveEnd =
    overlap.rightStartRatio <= overlap.rightEndRatio
      ? overlap.end
      : overlap.start

  const leftRemainder = buildRenderProjectionBoundaryRemainder(
    leftPolygon,
    overlap.leftEdgeIndex,
    leftRemoveStart,
    leftRemoveEnd
  )
  const rightRemainder = buildRenderProjectionBoundaryRemainder(
    rightPolygon,
    overlap.rightEdgeIndex,
    rightRemoveStart,
    rightRemoveEnd
  )
  const sourceArea =
    getPolygonCoverageArea(leftPolygon) + getPolygonCoverageArea(rightPolygon)
  if (sourceArea <= Number.EPSILON) {
    return null
  }

  return (
    [rightRemainder, [...rightRemainder].reverse()]
      .flatMap((orientedRightRemainder) => {
        if (
          !pointsAreWithinRenderProjectionTolerance(
            leftRemainder[leftRemainder.length - 1],
            orientedRightRemainder[0]
          ) ||
          !pointsAreWithinRenderProjectionTolerance(
            orientedRightRemainder[orientedRightRemainder.length - 1],
            leftRemainder[0]
          )
        ) {
          return []
        }

        const merged = cleanRenderProjectionSplicedLoop([
          ...leftRemainder,
          ...orientedRightRemainder.slice(1)
        ])
        if (merged.length < 3) {
          return []
        }

        const mergedArea = getPolygonCoverageArea(merged)
        const areaDelta = Math.abs(sourceArea - mergedArea) / sourceArea
        return areaDelta <= RENDER_PROJECTION_SHARED_EDGE_AREA_TOLERANCE
          ? [{ merged, areaDelta }]
          : []
      })
      .sort((left, right) => left.areaDelta - right.areaDelta)[0]?.merged ??
    null
  )
}

const mergeRenderProjectionSharedEdgePolygonPairs = (polygons: Vec2[][]) => {
  let output = polygons
  for (const _polygon of polygons) {
    let mergedPair = false
    for (let leftIndex = 0; leftIndex < output.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < output.length;
        rightIndex += 1
      ) {
        const merged = tryMergeRenderProjectionSharedEdgePolygonPair(
          output[leftIndex],
          output[rightIndex]
        )
        if (!merged) {
          continue
        }
        output = output.filter(
          (_, index) => index !== leftIndex && index !== rightIndex
        )
        output.push(merged)
        mergedPair = true
        break
      }
      if (mergedPair) {
        break
      }
    }
    if (!mergedPair) {
      break
    }
  }
  return output
}

function findRenderProjectionSharedEdgeComponentIndexes(polygons: Vec2[][]) {
  const parent = polygons.map((_, index) => index)
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]))
  const unite = (leftIndex: number, rightIndex: number) => {
    const leftRoot = find(leftIndex)
    const rightRoot = find(rightIndex)
    if (leftRoot !== rightRoot) {
      const firstRoot = Math.min(leftRoot, rightRoot)
      const secondRoot = Math.max(leftRoot, rightRoot)
      parent[secondRoot] = firstRoot
    }
  }

  for (let leftIndex = 0; leftIndex < polygons.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < polygons.length;
      rightIndex += 1
    ) {
      if (
        getRenderProjectionSharedBoundaryLength(
          polygons[leftIndex],
          polygons[rightIndex]
        ) > RENDER_PROJECTION_SHARED_EDGE_MATCH_TOLERANCE
      ) {
        unite(leftIndex, rightIndex)
      }
    }
  }

  const components = new Map<number, number[]>()
  polygons.forEach((_, index) => {
    const root = find(index)
    const component = components.get(root) ?? []
    component.push(index)
    components.set(root, component)
  })
  return [...components.values()]
}

function mergeSharedEdgeCoveragePolygonComponent(
  sourcePolygons: Vec2[][],
  options: {
    allowSharedEdgeLoopMerge?: boolean
    allowSharedEdgePairSplice?: boolean
  } = {}
) {
  if (sourcePolygons.length <= 1) {
    return sourcePolygons
  }

  const canonicalPoints = buildRenderProjectionCanonicalPointMap(sourcePolygons)
  const sourceEdges: (RenderProjectionSharedEdge & {
    polygonIndex: number
  })[] = []
  sourcePolygons.forEach((polygon, polygonIndex) => {
    polygon.forEach((point, index) => {
      const next = polygon[(index + 1) % polygon.length]
      const startKey = getRenderProjectionSharedEdgePointKey(point)
      const endKey = getRenderProjectionSharedEdgePointKey(next)
      if (startKey === endKey) {
        return
      }
      const start = getCanonicalRenderProjectionPoint(
        canonicalPoints,
        startKey,
        point
      )
      const end = getCanonicalRenderProjectionPoint(
        canonicalPoints,
        endKey,
        next
      )
      if (
        distanceBetweenPoints(start, end) <=
        RENDER_PROJECTION_SHARED_EDGE_OUTPUT_TOLERANCE
      ) {
        return
      }
      sourceEdges.push({
        polygonIndex,
        startKey,
        endKey,
        start,
        end
      })
    })
  })

  const edges: RenderProjectionSharedEdge[] = []
  sourceEdges.forEach((sourceEdge, sourceEdgeIndex) => {
    const overlapSplitPoints = sourceEdges.flatMap((candidateEdge, index) =>
      index === sourceEdgeIndex ||
      candidateEdge.polygonIndex === sourceEdge.polygonIndex
        ? []
        : getRenderProjectionCollinearOverlapSplitPoints(
            sourceEdge.start,
            sourceEdge.end,
            candidateEdge.start,
            candidateEdge.end
          )
    )
    appendRenderProjectionSharedSubEdges(
      edges,
      canonicalPoints,
      sourceEdge.startKey,
      sourceEdge.endKey,
      sourceEdge.start,
      sourceEdge.end,
      overlapSplitPoints
    )
  })

  const boundaryEdges = removeRenderProjectionSharedInteriorEdges(edges)
  if (
    !boundaryEdges ||
    boundaryEdges.length === edges.length ||
    options.allowSharedEdgeLoopMerge === false
  ) {
    if (options.allowSharedEdgePairSplice === false) {
      return sourcePolygons
    }
    const pairMergedPolygons =
      mergeRenderProjectionSharedEdgePolygonPairs(sourcePolygons)
    return pairMergedPolygons.length < sourcePolygons.length
      ? pairMergedPolygons
      : sourcePolygons
  }

  const mergedPolygons = traceRenderProjectionSharedEdgeLoops(boundaryEdges)
  if (!mergedPolygons || mergedPolygons.length >= sourcePolygons.length) {
    if (options.allowSharedEdgePairSplice === false) {
      return sourcePolygons
    }
    const pairMergedPolygons =
      mergeRenderProjectionSharedEdgePolygonPairs(sourcePolygons)
    return pairMergedPolygons.length < sourcePolygons.length
      ? pairMergedPolygons
      : sourcePolygons
  }

  const sourceArea = getPolygonListCoverageArea(sourcePolygons)
  const mergedArea = getPolygonListCoverageArea(mergedPolygons)
  if (
    sourceArea <= Number.EPSILON ||
    Math.abs(sourceArea - mergedArea) / sourceArea >
      RENDER_PROJECTION_SHARED_EDGE_AREA_TOLERANCE
  ) {
    return sourcePolygons
  }

  return mergedPolygons
}

function mergeSharedEdgeCoveragePolygons(
  polygons: Vec2[][],
  options: {
    allowSharedEdgeLoopMerge?: boolean
    allowSharedEdgePairSplice?: boolean
  } = {}
) {
  const sourcePolygons = polygons
    .map((polygon) =>
      normalizeCoveragePolygonWinding(
        polygon.filter(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        )
      )
    )
    .filter((polygon) => polygon.length >= 3)
  if (sourcePolygons.length <= 1) {
    return sourcePolygons
  }

  const mergedPolygons = findRenderProjectionSharedEdgeComponentIndexes(
    sourcePolygons
  ).flatMap((componentIndexes) => {
    if (componentIndexes.length <= 1) {
      return componentIndexes.map((index) => sourcePolygons[index])
    }
    const componentPolygons = componentIndexes.map(
      (index) => sourcePolygons[index]
    )
    return mergeSharedEdgeCoveragePolygonComponent(componentPolygons, options)
  })

  return mergedPolygons.length < sourcePolygons.length
    ? mergedPolygons
    : polygons
}

const clipRenderProjectionUnionToArrangementCoverage = (
  unionPolygons: Vec2[][],
  arrangementPolygons: Vec2[][],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'intersection'>>,
  options: {
    allowSharedEdgeLoopMerge?: boolean
    allowSharedEdgePairSplice?: boolean
    mergeSharedEdges?: boolean
  } = {}
) => {
  if (
    unionPolygons.length === 0 ||
    arrangementPolygons.length === 0 ||
    backend.capabilities.intersection !== true ||
    typeof backend.intersection !== 'function'
  ) {
    return unionPolygons
  }

  const clipped = flattenFacePolygons(
    backend.intersection(
      [
        {
          polygons: unionPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      [
        {
          polygons: arrangementPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      'nonzero'
    ),
    []
  )

  if (clipped.length === 0) {
    return unionPolygons
  }

  return options.mergeSharedEdges === false
    ? cleanRenderProjectionPolygons(clipped)
    : mergeSharedEdgeCoveragePolygons(clipped, options)
}

const getRenderProjectionExactUnionArea = (
  polygons: Vec2[][],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'union'>>,
  fillRule: FillRule
) => {
  if (
    polygons.length === 0 ||
    backend.capabilities.union !== true ||
    typeof backend.union !== 'function'
  ) {
    return null
  }

  try {
    return backend
      .union(
        [
          {
            polygons: polygons.map(normalizeCoveragePolygonWinding)
          }
        ],
        fillRule
      )
      .reduce(
        (total, region) => total + getPolygonListCoverageArea(region.polygons),
        0
      )
  } catch {
    return null
  }
}

const areRenderProjectionCoveragesEquivalent = (
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'intersection' | 'union'>>,
  fillRule: FillRule
) => {
  if (
    leftPolygons.length === 0 ||
    rightPolygons.length === 0 ||
    backend.capabilities.union !== true ||
    backend.capabilities.intersection !== true ||
    typeof backend.union !== 'function' ||
    typeof backend.intersection !== 'function'
  ) {
    return true
  }

  const leftArea = getRenderProjectionExactUnionArea(
    leftPolygons,
    backend,
    fillRule
  )
  const rightArea = getRenderProjectionExactUnionArea(
    rightPolygons,
    backend,
    fillRule
  )
  if (leftArea === null || rightArea === null) {
    return true
  }

  try {
    const intersectionArea = backend
      .intersection(
        [
          {
            polygons: leftPolygons.map(normalizeCoveragePolygonWinding)
          }
        ],
        [
          {
            polygons: rightPolygons.map(normalizeCoveragePolygonWinding)
          }
        ],
        fillRule
      )
      .reduce(
        (total, region) => total + getPolygonListCoverageArea(region.polygons),
        0
      )
    const tolerance = Math.max(
      0.01,
      Math.max(leftArea, rightArea) * RENDER_PROJECTION_AREA_DELTA_TOLERANCE
    )
    return (
      Math.abs(leftArea - intersectionArea) <= tolerance &&
      Math.abs(rightArea - intersectionArea) <= tolerance
    )
  } catch {
    return true
  }
}

const getRenderProjectionLegalDomainViolationArea = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  strokePosition: SolidCenterStrokeGeometryDebugMeta['strokePosition'],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'difference' | 'intersection' | 'union'>>,
  fillRule: FillRule,
  proofOptions: {
    preserveInsideWinding?: boolean
    reuseSingleLegalRegion?: boolean
  } = {}
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    (strokePosition !== 'inside' && strokePosition !== 'outside') ||
    backend.capabilities.union !== true ||
    typeof backend.union !== 'function'
  ) {
    return 0
  }

  const legalDomainRegions = legalDomains.flatMap((domain) => domain.regions)
  if (legalDomainRegions.length === 0) {
    return 0
  }

  try {
    const legalRegions =
      strokePosition === 'outside'
        ? legalDomainRegions
        : proofOptions.reuseSingleLegalRegion === true &&
            legalDomainRegions.length === 1
          ? legalDomainRegions
          : backend.union(legalDomainRegions, fillRule)
    if (legalRegions.length === 0) {
      return 0
    }
    const subjectRegions = [
      {
        polygons:
          strokePosition === 'outside'
            ? polygons
            : proofOptions.preserveInsideWinding === true
              ? polygons
              : polygons.map(normalizeCoveragePolygonWinding)
      }
    ]
    if (
      strokePosition === 'outside' &&
      backend.capabilities.intersection === true &&
      typeof backend.intersection === 'function'
    ) {
      return backend
        .intersection(subjectRegions, legalRegions, fillRule)
        .reduce(
          (total, region) =>
            total + getPolygonListCoverageArea(region.polygons),
          0
        )
    }
    if (
      strokePosition === 'inside' &&
      backend.capabilities.difference === true &&
      typeof backend.difference === 'function'
    ) {
      return backend
        .difference(subjectRegions, legalRegions, fillRule)
        .reduce(
          (total, region) =>
            total + getPolygonListCoverageArea(region.polygons),
          0
        )
    }
  } catch {
    return 0
  }

  return 0
}

const getRenderProjectionLegalSideSamplePoints = (polygon: Vec2[]) => [
  ...polygon,
  ...polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? point
    return {
      x: (point.x + next.x) / 2,
      y: (point.y + next.y) / 2
    }
  })
]

const getRenderProjectionDistanceToPolygonBoundary = (
  point: Vec2,
  polygon: Vec2[]
) =>
  Math.min(
    ...polygon.map((vertex, index) =>
      distancePointToSegment(
        point,
        vertex,
        polygon[(index + 1) % polygon.length] ?? vertex
      )
    )
  )

const getRenderProjectionDistanceToLegalDomainBoundary = (
  point: Vec2,
  legalPolygons: Vec2[][]
) =>
  Math.min(
    ...legalPolygons.map((polygon) =>
      getRenderProjectionDistanceToPolygonBoundary(point, polygon)
    )
  )

const hasRenderProjectionLegalSideSampleViolation = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  strokePosition: SolidCenterStrokeGeometryDebugMeta['strokePosition']
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    (strokePosition !== 'inside' && strokePosition !== 'outside')
  ) {
    return false
  }

  const legalPolygons = legalDomains.flatMap((domain) =>
    domain.regions.flatMap((region) => region.polygons)
  )
  if (legalPolygons.length === 0) {
    return false
  }

  return polygons.some((polygon) =>
    getRenderProjectionLegalSideSamplePoints(polygon).some((sample) => {
      const insideLegalDomain = legalPolygons.some((legalPolygon) =>
        isPointInsidePolygon(sample, legalPolygon)
      )
      const onBoundary =
        getRenderProjectionDistanceToLegalDomainBoundary(
          sample,
          legalPolygons
        ) <= RENDER_PROJECTION_LEGAL_SIDE_BOUNDARY_TOLERANCE
      return strokePosition === 'inside'
        ? !insideLegalDomain && !onBoundary
        : insideLegalDomain && !onBoundary
    })
  )
}

const filterRenderProjectionPolygonsToLegalSide = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  strokePosition: SolidCenterStrokeGeometryDebugMeta['strokePosition']
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    (strokePosition !== 'inside' && strokePosition !== 'outside')
  ) {
    return polygons
  }

  const legalPolygons = legalDomains.flatMap((domain) =>
    domain.regions.flatMap((region) => region.polygons)
  )
  if (legalPolygons.length === 0) {
    return polygons
  }

  return polygons.filter((polygon) =>
    getRenderProjectionLegalSideSamplePoints(polygon).some((sample) => {
      const insideLegalDomain = legalPolygons.some((legalPolygon) =>
        isPointInsidePolygon(sample, legalPolygon)
      )
      const onBoundary =
        getRenderProjectionDistanceToLegalDomainBoundary(
          sample,
          legalPolygons
        ) <= RENDER_PROJECTION_LEGAL_SIDE_BOUNDARY_TOLERANCE
      return strokePosition === 'inside'
        ? insideLegalDomain || onBoundary
        : !insideLegalDomain || onBoundary
    })
  )
}

const filterRenderProjectionPolygonsFullyToLegalSide = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  strokePosition: SolidCenterStrokeGeometryDebugMeta['strokePosition']
) =>
  polygons.filter(
    (polygon) =>
      !hasRenderProjectionLegalSideSampleViolation(
        [polygon],
        legalDomains,
        strokePosition
      )
  )

const getRenderProjectionOutsideLegalResidueArea = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'intersection'>>
) => {
  if (
    polygons.length === 0 ||
    legalRegions.length === 0 ||
    backend.capabilities.intersection !== true ||
    typeof backend.intersection !== 'function'
  ) {
    return 0
  }

  return backend
    .intersection([{ polygons }], legalRegions, 'nonzero')
    .reduce(
      (total, region) => total + getPolygonListCoverageArea(region.polygons),
      0
    )
}

const subtractRenderProjectionOutsideLegalResidue = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'difference' | 'intersection'>>,
  _fillRule: FillRule
) => {
  if (
    polygons.length === 0 ||
    legalRegions.length === 0 ||
    backend.capabilities.difference !== true ||
    backend.capabilities.intersection !== true ||
    typeof backend.difference !== 'function' ||
    typeof backend.intersection !== 'function'
  ) {
    return polygons
  }

  let currentPolygons = polygons
  for (let pass = 0; pass < 3; pass += 1) {
    const residueArea = getRenderProjectionOutsideLegalResidueArea(
      currentPolygons,
      legalRegions,
      backend
    )
    if (residueArea <= RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE) {
      return currentPolygons
    }

    currentPolygons = backend
      .difference([{ polygons: currentPolygons }], legalRegions, 'nonzero')
      .flatMap((region) => region.polygons)
    if (currentPolygons.length === 0) {
      return []
    }
  }

  return currentPolygons
}

const clipRenderProjectionPolygonsToOutsideLegalDomains = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'difference' | 'intersection'>>
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    backend.capabilities.difference !== true ||
    typeof backend.difference !== 'function'
  ) {
    return polygons
  }

  const legalDomainRegions = legalDomains.flatMap((domain) =>
    domain.regions.map((region) => ({
      polygons: region.polygons.map(normalizeCoveragePolygonWinding)
    }))
  )
  if (legalDomainRegions.length === 0) {
    return polygons
  }

  const hasExactResidueViolation =
    getRenderProjectionOutsideLegalResidueArea(
      polygons,
      legalDomainRegions,
      backend
    ) > RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE
  const hasSampleViolation = hasRenderProjectionLegalSideSampleViolation(
    polygons,
    legalDomains,
    'outside'
  )
  if (!hasExactResidueViolation && !hasSampleViolation) {
    return polygons
  }

  const fillRule = 'nonzero'
  const difference = backend.difference
  const clippedPolygons = difference(
    [{ polygons: polygons.map(normalizeCoveragePolygonWinding) }],
    legalDomainRegions,
    fillRule
  ).flatMap((region) => region.polygons)
  const perPolygonClippedPolygons =
    clippedPolygons.length === 0 ||
    hasRenderProjectionLegalSideSampleViolation(
      clippedPolygons,
      legalDomains,
      'outside'
    )
      ? polygons.flatMap((polygon) =>
          difference(
            [{ polygons: [normalizeCoveragePolygonWinding(polygon)] }],
            legalDomainRegions,
            fillRule
          ).flatMap((region) => region.polygons)
        )
      : []
  const exactClippedPolygons =
    clippedPolygons.length > 0 &&
    !hasRenderProjectionLegalSideSampleViolation(
      clippedPolygons,
      legalDomains,
      'outside'
    )
      ? clippedPolygons
      : perPolygonClippedPolygons.length > 0
        ? perPolygonClippedPolygons
        : clippedPolygons
  const residueRemovedPolygons = subtractRenderProjectionOutsideLegalResidue(
    exactClippedPolygons,
    legalDomainRegions,
    backend,
    fillRule
  )
  return hasRenderProjectionLegalSideSampleViolation(
    residueRemovedPolygons,
    legalDomains,
    'outside'
  )
    ? filterRenderProjectionPolygonsToLegalSide(
        residueRemovedPolygons,
        legalDomains,
        'outside'
      )
    : residueRemovedPolygons
}

const clipRenderProjectionPolygonsToLegalDomains = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  strokePosition: SolidCenterStrokeGeometryDebugMeta['strokePosition'],
  defaultFillRule: FillRule,
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'difference' | 'intersection' | 'union'>>
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    (strokePosition !== 'inside' && strokePosition !== 'outside')
  ) {
    return polygons
  }

  const legalDomainRegions = legalDomains.flatMap((domain) => domain.regions)
  if (legalDomainRegions.length === 0) {
    return polygons
  }

  const fillRule =
    strokePosition === 'outside'
      ? 'nonzero'
      : (legalDomains[0]?.fillRule ?? defaultFillRule)
  const subjectRegions = [
    {
      polygons:
        strokePosition === 'outside'
          ? polygons
          : polygons.map(normalizeCoveragePolygonWinding)
    }
  ]

  if (
    strokePosition === 'outside' &&
    backend.capabilities.difference === true &&
    typeof backend.difference === 'function'
  ) {
    return clipRenderProjectionPolygonsToOutsideLegalDomains(
      polygons,
      legalDomains,
      backend
    )
  }

  if (
    backend.capabilities.union !== true ||
    typeof backend.union !== 'function'
  ) {
    return polygons
  }

  const legalRegions = backend.union(legalDomainRegions, fillRule)
  if (legalRegions.length === 0) {
    return polygons
  }
  if (
    strokePosition === 'inside' &&
    backend.capabilities.intersection === true &&
    typeof backend.intersection === 'function'
  ) {
    return filterRenderProjectionPolygonsFullyToLegalSide(
      mergeSharedEdgeCoveragePolygons(
        flattenFacePolygons(
          backend.intersection(subjectRegions, legalRegions, fillRule),
          []
        ),
        { allowSharedEdgeLoopMerge: false }
      ),
      legalDomains,
      strokePosition
    )
  }

  return polygons
}

const isDashedCenterProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  face.debugMeta?.productMode === 'center-product' &&
  face.debugMeta?.productSignature === 'center-product:dashed'

const isConstrainedDashedProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  const productSignature = face.debugMeta?.productSignature ?? ''
  return (
    productSignature.startsWith('constrained-dashed:') &&
    (face.debugMeta?.strokePosition === 'inside' ||
      face.debugMeta?.strokePosition === 'outside' ||
      productSignature.includes('closed-constrained-domain'))
  )
}
const shouldMaterializeConstrainedDashedRenderDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.strokePosition === 'outside' &&
  !hasConstrainedDashedOutsideStrokePathRenderDescriptor(face)

const hasConstrainedDashedOutsideStrokePathRenderDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  const descriptor = face.renderDescriptor as
    | SolidCenterStrokeRenderDescriptor
    | undefined
  return (
    isConstrainedDashedProductFace(face) &&
    face.debugMeta?.strokePosition === 'outside' &&
    descriptor !== undefined &&
    (descriptor.strokePathGroups?.length ?? 0) > 0
  )
}

const isConstrainedDashedSourceVertexJoinProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.routeId === 'constrained-dashed-source-vertex-join-product' &&
  face.debugMeta.visibleContributor === 'source-vertex-join' &&
  face.debugMeta.geometryBasis === 'canonical-join-footprint'

const isConstrainedDashedJoinOwnedTerminalBodyProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  const debugMeta = face.debugMeta
  const joinOwnershipSignatures = [
    debugMeta?.joinOwnershipSignature,
    ...(debugMeta?.joinOwnershipSignatures ?? [])
  ]
  const productSignature = debugMeta?.productSignature ?? ''
  return (
    isConstrainedDashedProductFace(face) &&
    debugMeta?.visibleContributor === 'terminal-interval-body' &&
    (debugMeta.routeId ===
      'constrained-dashed-join-owned-terminal-body-product' ||
      joinOwnershipSignatures.includes('join-owned-terminal-body') ||
      productSignature.includes(':join-owned-terminal-body:') ||
      productSignature.includes('join-owned-terminal-body-owner-stage'))
  )
}

const isConstrainedDashedTerminalBodyProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.visibleContributor === 'terminal-interval-body' &&
  face.debugMeta?.geometryBasis === 'terminal-dash-interval-body'

const hasVisibleStrokePathDescriptorRoute = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined
) =>
  (descriptor?.strokePathGroups?.length ?? 0) > 0 ||
  (descriptor?.strokePaths?.length ?? 0) > 0

const shouldUseStoredConstrainedDashedProductPolygons = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (!isConstrainedDashedProductFace(face)) {
    return false
  }

  const joinOwnershipSignatures = [
    face.debugMeta?.joinOwnershipSignature,
    ...(face.debugMeta?.joinOwnershipSignatures ?? [])
  ]
  return (
    face.debugMeta?.ownerStage ===
      'Stroke Geometry smooth-continuity product assembly' ||
    isConstrainedDashedSourceVertexJoinProductFace(face) ||
    face.debugMeta?.productSignature?.includes(
      ':outside-aggregate-descriptor:'
    ) === true ||
    (joinOwnershipSignatures.includes('join-owned-terminal-body') &&
      face.renderDescriptor === undefined)
  )
}

const shouldPreserveConstrainedDashedRenderEntryDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.strokePosition === 'outside' &&
  face.renderDescriptor !== undefined &&
  !shouldUseStoredConstrainedDashedProductPolygons(face)

const getConstrainedDashedRenderEntryCarrierPolygons = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined,
  carrierPolygons: Vec2[][]
) =>
  hasVisibleStrokePathDescriptorRoute(descriptor)
    ? carrierPolygons
    : descriptor?.descriptorProductPolygons &&
        descriptor.descriptorProductPolygons.length > 0
      ? descriptor.descriptorProductPolygons
      : descriptor?.strokeMaskPolygons &&
          descriptor.strokeMaskPolygons.length > 0
        ? descriptor.strokeMaskPolygons
        : carrierPolygons

const shouldMaterializeDashedCenterRenderDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => isDashedCenterProductFace(face) && face.renderDescriptor !== undefined

const shouldMaterializeConstrainedDashedRenderEntryDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.strokePosition === 'outside' &&
  face.renderDescriptor !== undefined &&
  !hasConstrainedDashedOutsideStrokePathRenderDescriptor(face) &&
  !shouldUseStoredConstrainedDashedProductPolygons(face)

const isConstrainedSolidRenderMaskProductFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  face.debugMeta?.productSignature?.startsWith('constrained-solid:') === true &&
  face.debugMeta.solidMaskModelCoverageOracle === 'render-mask'

const getRenderProductPolygonsFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedSolidRenderMaskProductFace(face)
    ? face.polygons
    : shouldMaterializeDashedCenterRenderDescriptor(face)
      ? materializeRenderDescriptorProductPolygons(
          face.renderDescriptor as
            | SolidCenterStrokeRenderDescriptor
            | undefined,
          face.polygons
        )
      : shouldUseStoredConstrainedDashedProductPolygons(face)
        ? face.polygons
        : hasConstrainedDashedOutsideStrokePathRenderDescriptor(face)
          ? materializeRenderDescriptorProductPolygons(
              face.renderDescriptor as
                | SolidCenterStrokeRenderDescriptor
                | undefined,
              face.polygons
            )
          : shouldMaterializeConstrainedDashedRenderDescriptor(face)
            ? materializeRenderDescriptorProductPolygons(
                face.renderDescriptor as
                  | SolidCenterStrokeRenderDescriptor
                  | undefined,
                face.polygons
              )
            : isConstrainedDashedProductFace(face)
              ? face.polygons
              : face.polygons

const getRenderEntryProductPolygonsFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  shouldMaterializeDashedCenterRenderDescriptor(face)
    ? face.polygons
    : getRenderProductPolygonsFromFinalFace(face)

const shouldMaterializeProjectedConstrainedDashedDescriptor = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.renderDescriptor !== undefined &&
  !hasConstrainedDashedOutsideStrokePathRenderDescriptor(face) &&
  !shouldUseStoredConstrainedDashedProductPolygons(face)

const getProjectedProductPolygonsFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  shouldMaterializeProjectedConstrainedDashedDescriptor(face)
    ? materializeRenderDescriptorProductPolygons(
        face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined,
        face.polygons
      )
    : getRenderProductPolygonsFromFinalFace(face)

const canUseConstrainedDashedDescriptorRenderEntries = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.some(isConstrainedDashedProductFace) &&
  faces
    .filter(isConstrainedDashedProductFace)
    .every((face) => face.renderDescriptor !== undefined)

const canUsePureConstrainedDashedDescriptorRenderEntries = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.length > 0 &&
  faces.every((face) => {
    const descriptor = face.renderDescriptor as
      | SolidCenterStrokeRenderDescriptor
      | undefined
    return (
      isConstrainedDashedProductFace(face) &&
      descriptor !== undefined &&
      (hasVisibleStrokePathDescriptorRoute(descriptor) ||
        (descriptor.strokeMaskPolygons?.length ?? 0) > 0)
    )
  })

const emitConstrainedDashedRenderDescriptorRouteCounters = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => {
  const constrainedDashedFaces = faces.filter(isConstrainedDashedProductFace)
  if (constrainedDashedFaces.length === 0) {
    return
  }

  const descriptorFaces = constrainedDashedFaces.filter(
    (face) => face.renderDescriptor !== undefined
  )
  const visibleDescriptorRouteFaces = descriptorFaces.filter((face) =>
    hasVisibleStrokePathDescriptorRoute(
      face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
    )
  )
  const strokeMaskDescriptorFaces = descriptorFaces.filter((face) => {
    const descriptor = face.renderDescriptor as
      | SolidCenterStrokeRenderDescriptor
      | undefined
    return (descriptor?.strokeMaskPolygons?.length ?? 0) > 0
  })

  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-face-count',
    constrainedDashedFaces.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-descriptor-face-count',
    descriptorFaces.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-visible-descriptor-route-face-count',
    visibleDescriptorRouteFaces.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-stroke-mask-descriptor-face-count',
    strokeMaskDescriptorFaces.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-non-descriptor-face-count',
    constrainedDashedFaces.length - descriptorFaces.length
  )
}

const toCoverageFaceRegion = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >,
  options: { preserveWinding?: boolean } = {}
) => {
  const polygons = getRenderProductPolygonsFromFinalFace(face)
  return {
    polygons:
      options.preserveWinding === true
        ? polygons
        : polygons.map(normalizeCoveragePolygonWinding)
  }
}

const getDashedCenterRenderGroupKey = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (!isDashedCenterProductFace(face)) {
    return null
  }

  const ownerKey = [
    face.debugMeta?.sourcePathId,
    face.debugMeta?.ownerKey,
    face.debugMeta?.networkId,
    face.debugMeta?.strokeId,
    face.debugMeta?.strokeIndex
  ].join(':')

  return `${face.paintKey}|${ownerKey}`
}

const getConstrainedDashedRenderGroupKey = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (!isConstrainedDashedProductFace(face)) {
    return null
  }

  const ownerKeys = getUniqueStrings(
    face.ownerSet.flatMap((owner) => (owner.ownerKey ? [owner.ownerKey] : []))
  ).join(',')
  const strokeIds = getUniqueStrings(
    face.ownerSet.flatMap((owner) => (owner.strokeId ? [owner.strokeId] : []))
  ).join(',')
  const ownerKey = [
    face.debugMeta?.sourcePathId,
    face.debugMeta?.networkId,
    ownerKeys,
    strokeIds,
    face.debugMeta?.strokePosition
  ].join(':')

  return `${face.paintKey}|${ownerKey}`
}

const getRenderOverlapBackend = (
  options: SolidCenterStrokeRenderEntryOptions
) => {
  try {
    const backend = options.exactBackend ?? getGeometryBackend()
    return backend.capabilities.union === true ? backend : null
  } catch {
    return null
  }
}

const getRenderArrangementBackend = (
  options: SolidCenterStrokeRenderEntryOptions
) => {
  const providedBackend = options.exactBackend
  if (
    providedBackend?.capabilities.buildArrangement === true &&
    typeof providedBackend.buildArrangement === 'function'
  ) {
    return providedBackend as Pick<
      GeometryBackend,
      'capabilities' | 'buildArrangement' | 'union'
    >
  }

  try {
    const backend = getGeometryBackend()
    return backend.capabilities.buildArrangement === true ? backend : null
  } catch {
    return null
  }
}

const buildRenderProjectionLegalDomainSplitterCandidates = (
  legalDomains: SolidCenterStrokeRenderEntryOptions['legalDomains']
): RenderProjectionCandidateRegion[] =>
  (legalDomains ?? []).flatMap((domain, domainIndex) =>
    domain.regions.flatMap((region, regionIndex) =>
      region.polygons.map((polygon, polygonIndex) => {
        const polygons = [normalizeCoveragePolygonWinding(polygon)]
        return {
          candidateId: `legal-domain-splitter:${domain.legalDomainId ?? domainIndex}:${regionIndex}:${polygonIndex}`,
          geometry: { polygons },
          geometryBounds: getBounds(polygons),
          geometrySignature: buildRenderProjectionRegionSignature(polygons),
          visualPacketKey: `legal-domain-splitter:${domain.legalDomainId ?? domainIndex}`,
          strokePosition: 'center',
          legalDomainId: domain.legalDomainId ?? null,
          sourceSpanIds: [],
          sourceContourIds: [],
          renderProjectionSplitter: true
        }
      })
    )
  )
type ProductContractDebugMetaOverrides = Pick<
  SolidCenterStrokeGeometryDebugMeta,
  | 'ownerStepIds'
  | 'intervalIds'
  | 'terminalRoles'
  | 'seamBoundaryIds'
  | 'sourceSpanIds'
  | 'sourceNetworkIds'
  | 'sourceContourIds'
  | 'legalDomainIds'
  | 'domainPlanSplitRangeTerminals'
  | 'dashProductIntervals'
  | 'dashBodySeamBoundaries'
  | 'dashEndpointCapPolicySignatures'
  | 'dashEndpointCapPolicyTerminalRoles'
  | 'joinOwnershipRecords'
  | 'joinOwnershipSignatures'
  | 'smoothContinuityGroupIds'
  | 'domainPlanBoundaryRoles'
  | 'domainPlanSplitRangeIds'
  | 'domainPlanSelectedSides'
  | 'domainPlanSourceSegmentIndexes'
  | 'visualOverlapCollapseStatus'
  | 'visualOverlapSourceFaceIds'
  | 'visualOverlapSourceGeometryIds'
  | 'seamEvidence'
  | 'protectedContinuityZone'
  | 'physicalSpanRanges'
  | 'productEvidenceEnvelope'
>

const buildProductContractDebugMetaFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >,
  overrides: Partial<ProductContractDebugMetaOverrides> = {}
) => {
  const debugMeta = face.debugMeta
  if (!debugMeta?.productMode || !debugMeta.productSignature) {
    return undefined
  }

  const ownerStepIds = overrides.ownerStepIds ?? face.ownerStepIds
  const intervalIds = overrides.intervalIds ?? face.intervalIds
  const terminalRoles = overrides.terminalRoles ?? face.terminalRoles
  const seamBoundaryIds = overrides.seamBoundaryIds ?? face.seamBoundaryIds
  const sourceSpanIds = overrides.sourceSpanIds ?? face.sourceSpanIds
  const sourceNetworkIds = overrides.sourceNetworkIds ?? face.sourceNetworkIds
  const sourceContourIds = overrides.sourceContourIds ?? face.sourceContourIds
  const legalDomainIds = overrides.legalDomainIds ?? face.legalDomainIds

  return {
    ownerStepIds: [...ownerStepIds],
    terminalRoles: [...terminalRoles],
    seamBoundaryIds: [...seamBoundaryIds],
    productMode: debugMeta.productMode,
    productSignature: debugMeta.productSignature,
    routeId: debugMeta.routeId,
    domainMode: debugMeta.domainMode,
    sourcePathId: debugMeta.sourcePathId,
    ownerKey: debugMeta.ownerKey,
    networkId: debugMeta.networkId,
    strokeId: debugMeta.strokeId,
    strokeIndex: debugMeta.strokeIndex,
    intervalId: intervalIds[0] ?? debugMeta.intervalId,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    strokePosition: debugMeta.strokePosition,
    strokeWidth: debugMeta.strokeWidth,
    strokeJoin: debugMeta.strokeJoin,
    strokeCap: debugMeta.strokeCap,
    ownerStage: debugMeta.ownerStage,
    authoredJoin: debugMeta.authoredJoin,
    resolvedJoin: debugMeta.resolvedJoin,
    vertexAngle: debugMeta.vertexAngle,
    miterAngle: debugMeta.miterAngle,
    angleSource: debugMeta.angleSource,
    angleComparison: debugMeta.angleComparison,
    strokeMiterLimit: debugMeta.strokeMiterLimit,
    visibleContributor: debugMeta.visibleContributor,
    geometryBasis: debugMeta.geometryBasis,
    joinStyle: debugMeta.joinStyle,
    joinResolution: debugMeta.joinResolution,
    continuityEvidence: debugMeta.continuityEvidence,
    protectedContinuityZone: debugMeta.protectedContinuityZone,
    seamEvidence: overrides.seamEvidence ?? debugMeta.seamEvidence,
    dashBodySeamBoundaries:
      overrides.dashBodySeamBoundaries ?? debugMeta.dashBodySeamBoundaries,
    domainPlanBoundaryDomainId: debugMeta.domainPlanBoundaryDomainId,
    domainPlanSplitRangeId: debugMeta.domainPlanSplitRangeId,
    domainPlanSplitRangeStartDistance:
      debugMeta.domainPlanSplitRangeStartDistance,
    domainPlanSplitRangeEndDistance: debugMeta.domainPlanSplitRangeEndDistance,
    domainPlanSplitRangeSourceStartDistance:
      debugMeta.domainPlanSplitRangeSourceStartDistance,
    domainPlanSplitRangeSourceEndDistance:
      debugMeta.domainPlanSplitRangeSourceEndDistance,
    domainPlanTerminalRole: debugMeta.domainPlanTerminalRole,
    domainPlanSplitRangeSourceSegmentIndex:
      debugMeta.domainPlanSplitRangeSourceSegmentIndex,
    domainPlanSideAuthority: debugMeta.domainPlanSideAuthority,
    domainPlanSelectedSide: debugMeta.domainPlanSelectedSide,
    domainPlanFilledSide: debugMeta.domainPlanFilledSide,
    domainPlanUnfilledSide: debugMeta.domainPlanUnfilledSide,
    domainPlanBoundaryRole: debugMeta.domainPlanBoundaryRole,
    domainPlanDomainMode: debugMeta.domainPlanDomainMode,
    domainPlanSideResolutionStatus: debugMeta.domainPlanSideResolutionStatus,
    domainPlanSideResolutionReason: debugMeta.domainPlanSideResolutionReason,
    domainPlanBoundaryStartDistance: debugMeta.domainPlanBoundaryStartDistance,
    domainPlanBoundaryEndDistance: debugMeta.domainPlanBoundaryEndDistance,
    domainPlanBoundaryTotalLength: debugMeta.domainPlanBoundaryTotalLength,
    materializedStartDistance: debugMeta.materializedStartDistance,
    materializedEndDistance: debugMeta.materializedEndDistance,
    materializedWrapsSeam: debugMeta.materializedWrapsSeam,
    materializationDistanceSpace: debugMeta.materializationDistanceSpace,
    sourceDomainExplicitSideProduct: debugMeta.sourceDomainExplicitSideProduct,
    selectedSideProductOwnsOutsideDomain:
      debugMeta.selectedSideProductOwnsOutsideDomain,
    physicalSpanRanges:
      overrides.physicalSpanRanges ?? debugMeta.physicalSpanRanges,
    physicalVisibleLength: debugMeta.physicalVisibleLength,
    domainPlanSplitRangeTerminals:
      overrides.domainPlanSplitRangeTerminals ??
      debugMeta.domainPlanSplitRangeTerminals,
    dashProductIntervals: getProjectedDashProductIntervals(
      debugMeta,
      intervalIds,
      overrides.dashProductIntervals
    ),
    dashEndpointCapPolicySignature: debugMeta.dashEndpointCapPolicySignature,
    dashEndpointCapPolicyTerminalRole:
      debugMeta.dashEndpointCapPolicyTerminalRole,
    dashEndpointCapPolicySignatures:
      overrides.dashEndpointCapPolicySignatures ??
      debugMeta.dashEndpointCapPolicySignatures,
    dashEndpointCapPolicyTerminalRoles:
      overrides.dashEndpointCapPolicyTerminalRoles ??
      debugMeta.dashEndpointCapPolicyTerminalRoles,
    joinOwnershipSignature: debugMeta.joinOwnershipSignature,
    joinOwnershipRecords:
      overrides.joinOwnershipRecords ?? debugMeta.joinOwnershipRecords,
    joinOwnershipSignatures:
      overrides.joinOwnershipSignatures ?? debugMeta.joinOwnershipSignatures,
    smoothContinuityGroupId: debugMeta.smoothContinuityGroupId,
    smoothContinuityGroupIds:
      overrides.smoothContinuityGroupIds ?? debugMeta.smoothContinuityGroupIds,
    productEvidenceEnvelope:
      overrides.productEvidenceEnvelope ??
      face.productEvidenceEnvelope ??
      debugMeta.productEvidenceEnvelope,
    domainPlanBoundaryRoles:
      overrides.domainPlanBoundaryRoles ?? debugMeta.domainPlanBoundaryRoles,
    domainPlanSplitRangeIds:
      overrides.domainPlanSplitRangeIds ?? debugMeta.domainPlanSplitRangeIds,
    domainPlanSelectedSides:
      overrides.domainPlanSelectedSides ?? debugMeta.domainPlanSelectedSides,
    domainPlanSourceSegmentIndexes:
      overrides.domainPlanSourceSegmentIndexes ??
      debugMeta.domainPlanSourceSegmentIndexes,
    visualOverlapCollapseStatus:
      overrides.visualOverlapCollapseStatus ??
      debugMeta.visualOverlapCollapseStatus,
    visualOverlapSourceFaceIds: overrides.visualOverlapSourceFaceIds,
    visualOverlapSourceGeometryIds: overrides.visualOverlapSourceGeometryIds,
    revisionSet: debugMeta.revisionSet
  } satisfies SolidCenterStrokeGeometryDebugMeta
}

const getFullDiagnosticsRenderDebugMeta = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined,
  defaultIntervalIds: readonly string[] = []
) => {
  if (!debugMeta) {
    return undefined
  }
  const intervals = getRenderDebugMetaDashProductIntervals(
    debugMeta,
    defaultIntervalIds
  )

  return {
    ...debugMeta,
    ...(intervals.length > 0
      ? {
          dashProductIntervals:
            getUniqueDashProductIntervalsForRenderArray(intervals)
        }
      : {})
  } satisfies SolidCenterStrokeGeometryDebugMeta
}

const buildRenderEntryFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >,
  options: SolidCenterStrokeRenderEntryOptions = {}
) =>
  measureStrokeRenderEntryPhase('render entries: build final face', () => {
    const sourceRenderDescriptor = face.renderDescriptor as
      | SolidCenterStrokeRenderDescriptor
      | undefined
    const shouldMaterializeConstrainedDashedDescriptor =
      shouldMaterializeConstrainedDashedRenderEntryDescriptor(face)
    const shouldUseStoredConstrainedDashedProduct =
      shouldUseStoredConstrainedDashedProductPolygons(face)
    const shouldUseConstrainedDashedOutsideProduct =
      hasConstrainedDashedOutsideStrokePathRenderDescriptor(face)
    const shouldPreserveConstrainedDashedDescriptor =
      shouldPreserveConstrainedDashedRenderEntryDescriptor(face)
    const renderDescriptor = shouldMaterializeConstrainedDashedDescriptor
      ? shouldPreserveConstrainedDashedDescriptor
        ? sourceRenderDescriptor
        : undefined
      : shouldUseStoredConstrainedDashedProduct ||
          (shouldUseConstrainedDashedOutsideProduct &&
            !shouldPreserveConstrainedDashedDescriptor)
        ? undefined
        : sourceRenderDescriptor
    const constrainedDashedRenderEntryStrokeMaskPolygons =
      shouldMaterializeConstrainedDashedDescriptor &&
      !shouldPreserveConstrainedDashedDescriptor
        ? materializeRenderDescriptorProductPolygons(
            sourceRenderDescriptor,
            face.polygons
          )
        : undefined
    const productPolygons = measureStrokeRenderEntryPhase(
      'render entries: product polygons',
      () =>
        shouldPreserveConstrainedDashedDescriptor
          ? getConstrainedDashedRenderEntryCarrierPolygons(
              sourceRenderDescriptor,
              face.polygons
            )
          : getRenderEntryProductPolygonsFromFinalFace(face)
    )
    const hasVisibleRenderDescriptorPath =
      (renderDescriptor?.strokePathGroups?.length ?? 0) > 0 ||
      (renderDescriptor?.strokePaths?.length ?? 0) > 0
    const canonicalProductPolygons =
      isConstrainedDashedProductFace(face) &&
      !hasVisibleRenderDescriptorPath &&
      !isConstrainedDashedSourceVertexJoinProductFace(face) &&
      !isConstrainedDashedJoinOwnedTerminalBodyProductFace(face) &&
      productPolygons.length > 1
        ? cleanRenderProjectionPolygons(unionCoveragePolygons(productPolygons))
        : productPolygons
    const renderEntryStrokePosition = face.debugMeta?.strokePosition
    const shouldClipRenderEntryProductPolygons =
      !isConstrainedDashedProductFace(face) &&
      !hasVisibleRenderDescriptorPath &&
      (renderEntryStrokePosition === 'inside' ||
        renderEntryStrokePosition === 'outside') &&
      (options.legalDomains?.length ?? 0) > 0
    const renderEntryProductPolygons = shouldClipRenderEntryProductPolygons
      ? clipRenderProjectionPolygonsToLegalDomains(
          canonicalProductPolygons,
          options.legalDomains ?? [],
          renderEntryStrokePosition,
          'nonzero',
          options.exactBackend ?? getGeometryBackend()
        )
      : canonicalProductPolygons
    const runtimeMeta: SolidCenterStrokeRuntimeMeta = {
      productMode: face.debugMeta?.productMode,
      productSignature: face.debugMeta?.productSignature,
      domainMode: face.debugMeta?.domainMode,
      topologyFamily: face.debugMeta?.topologyFamily,
      strokePosition: face.debugMeta?.strokePosition,
      ownerSet: [...face.ownerSet],
      ownerStepIds: [...face.ownerStepIds],
      intervalIds: [...face.intervalIds],
      terminalRoles: [...face.terminalRoles],
      seamBoundaryIds: [...face.seamBoundaryIds],
      sourceSpanIds: [...face.sourceSpanIds],
      sourceNetworkIds: [...face.sourceNetworkIds],
      sourceContourIds: [...face.sourceContourIds],
      legalDomainIds: [...face.legalDomainIds],
      visualOverlapCollapseStatus: face.debugMeta?.visualOverlapCollapseStatus,
      revisionSet: face.debugMeta?.revisionSet
    }

    const productContractDebugMeta = measureStrokeRenderEntryPhase(
      'render entries: product contract meta',
      () => buildProductContractDebugMetaFromFinalFace(face)
    )
    const fullDiagnosticsDebugMeta = shouldEmitFullStrokeDiagnostics()
      ? getFullDiagnosticsRenderDebugMeta(face.debugMeta, face.intervalIds)
      : undefined

    return {
      cacheKey: getProjectedGeometryId(face),
      productIdentity: getMergedFinalFaceOutputProductIdentity([face]),
      stroke: {
        kind: face.paint.kind,
        color: face.paint.color,
        alpha: face.paint.alpha,
        gradientStyle: face.paint.gradientStyle ?? null,
        paintKey:
          face.paint.paintKey ?? `solid:${face.paint.color}:${face.paint.alpha}`
      },
      polygons: renderEntryProductPolygons,
      fillPolygons: renderDescriptor?.fillPolygons,
      clipPolygons: renderDescriptor?.clipPolygons,
      fillClipPolygons: renderDescriptor?.fillClipPolygons,
      fillExcludePolygons: renderDescriptor?.fillExcludePolygons,
      strokeMaskPolygons:
        constrainedDashedRenderEntryStrokeMaskPolygons ??
        renderDescriptor?.strokeMaskPolygons,
      strokePaths: renderDescriptor?.strokePaths,
      strokePathGroups: renderDescriptor?.strokePathGroups,
      strokePathStyle: renderDescriptor?.strokePathStyle,
      debugMeta: fullDiagnosticsDebugMeta ?? productContractDebugMeta,
      runtimeMeta,
      revisionSet: runtimeMeta.revisionSet,
      preferSolidGraphics: isConstrainedDashedProductFace(face)
    }
  })

const getVisibleProductPolygonsFromRenderEntry = (
  entry: ReturnType<typeof buildRenderEntryFromFinalFace>
) =>
  materializeRenderDescriptorProductPolygons(
    entry as SolidCenterStrokeRenderDescriptor,
    entry.polygons
  )

type SolidCenterStrokeComputedRenderEntry = ReturnType<
  typeof buildRenderEntryFromFinalFace
>

const getRenderEntryPaintSignature = (
  entry: SolidCenterStrokeComputedRenderEntry
) =>
  [
    entry.stroke.kind ?? '',
    entry.stroke.color,
    entry.stroke.alpha,
    entry.stroke.paintKey ?? ''
  ].join('|')

const canCompositePolygonRenderEntry = (
  entry: SolidCenterStrokeComputedRenderEntry
) =>
  entry.polygons.length > 0 &&
  (entry.fillPolygons?.length ?? 0) === 0 &&
  (entry.clipPolygons?.length ?? 0) === 0 &&
  (entry.fillClipPolygons?.length ?? 0) === 0 &&
  (entry.fillExcludePolygons?.length ?? 0) === 0 &&
  (entry.strokeMaskPolygons?.length ?? 0) === 0 &&
  (entry.strokePaths?.length ?? 0) === 0 &&
  (entry.strokePathGroups?.length ?? 0) === 0

const selectPrimaryRenderMetadataEntry = (
  entries: SolidCenterStrokeComputedRenderEntry[]
) =>
  entries.find(
    (entry) => entry.debugMeta?.visibleContributor === 'source-vertex-join'
  ) ?? entries[0]

const buildSingleSamePaintPolygonRenderEntry = (
  entry: SolidCenterStrokeComputedRenderEntry,
  polygons: Vec2[][],
  cacheKeyPrefix: string,
  collapseStatus: RenderProjectionCollapseStatus
): SolidCenterStrokeComputedRenderEntry[] => [
  {
    ...entry,
    cacheKey: `render:${cacheKeyPrefix}:${entry.cacheKey}`,
    polygons,
    fillPolygons: undefined,
    clipPolygons: undefined,
    fillClipPolygons: undefined,
    fillExcludePolygons: undefined,
    strokeMaskPolygons: undefined,
    strokePaths: undefined,
    strokePathGroups: undefined,
    runtimeMeta: {
      ...entry.runtimeMeta,
      visualOverlapCollapseStatus: collapseStatus
    },
    debugMeta: entry.debugMeta
      ? {
          ...entry.debugMeta,
          visualOverlapCollapseStatus: collapseStatus,
          visualOverlapSourceFaceIds:
            entry.debugMeta.visualOverlapSourceFaceIds?.length
              ? entry.debugMeta.visualOverlapSourceFaceIds
              : [entry.cacheKey]
        }
      : entry.debugMeta
  }
]

const clipSamePaintInsideCompositeToLegalDomains = (
  polygons: Vec2[][],
  legalDomains: NonNullable<
    SolidCenterStrokeRenderEntryOptions['legalDomains']
  >,
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'intersection' | 'union'>>,
  fillRule: FillRule
) => {
  if (
    polygons.length === 0 ||
    legalDomains.length === 0 ||
    backend.capabilities.intersection !== true ||
    typeof backend.intersection !== 'function'
  ) {
    return null
  }
  const legalDomainRegions = legalDomains.flatMap((domain) => domain.regions)
  if (legalDomainRegions.length === 0) {
    return null
  }
  const legalRegions =
    legalDomainRegions.length === 1
      ? legalDomainRegions
      : backend.capabilities.union === true && typeof backend.union === 'function'
        ? backend.union(legalDomainRegions, fillRule)
        : []
  if (legalRegions.length === 0) {
    return null
  }

  return backend
    .intersection([{ polygons }], legalRegions, fillRule)
    .flatMap((region) => region.polygons)
}

const mergeSamePaintPolygonRenderEntries = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  cacheKeyPrefix: string,
  collapseStatus: RenderProjectionCollapseStatus,
  options: SolidCenterStrokeRenderEntryOptions
): SolidCenterStrokeComputedRenderEntry[] => {
  const primaryEntry = selectPrimaryRenderMetadataEntry(entries)
  if (!primaryEntry) {
    return entries
  }

  const sourcePolygons = measureStrokeRenderEntryPhase(
    'render entries: same-paint source polygons',
    () => entries.flatMap(getVisibleProductPolygonsFromRenderEntry)
  )
  if (entries.length < 2 && sourcePolygons.length < 2) {
    return entries
  }
  const primaryStrokePosition =
    primaryEntry.debugMeta?.strokePosition ??
    primaryEntry.runtimeMeta.strokePosition
  const hasOutsideLegalDomain =
    primaryStrokePosition === 'outside' ||
    entries.some(
      (entry) =>
        entry.debugMeta?.strokePosition === 'outside' ||
        entry.runtimeMeta.strokePosition === 'outside'
    )
  const preservesPostLegalityInsideWinding =
    primaryStrokePosition === 'inside' &&
    entries.every(
      (entry) => (entry.runtimeMeta.legalDomainIds?.length ?? 0) > 0
    )
  let postLegalityCompositePolygons: Vec2[][] | null = null
  try {
    const backend = options.exactBackend ?? getGeometryBackend()
    if (
      backend.capabilities.union === true &&
      typeof backend.union === 'function'
    ) {
      const compositePolygons = flattenFacePolygons(
        backend.union(
          [
            {
              polygons: preservesPostLegalityInsideWinding
                ? sourcePolygons
                : sourcePolygons.map(normalizeCoveragePolygonWinding)
            }
          ],
          'nonzero'
        ),
        sourcePolygons
      )
      const canUseExactInsideLegalProof =
        primaryStrokePosition === 'inside' &&
        (options.legalDomains?.length ?? 0) > 0 &&
        backend.capabilities.difference === true &&
        typeof backend.difference === 'function'
      const insideLegalFillRule =
        options.legalDomains?.[0]?.fillRule ?? 'nonzero'
      let provedCompositePolygons = compositePolygons
      let exactInsideLegalViolationArea = canUseExactInsideLegalProof
        ? measureStrokeRenderEntryPhase(
            'render entries: same-paint exact legal proof',
            () =>
              getRenderProjectionLegalDomainViolationArea(
                compositePolygons,
                options.legalDomains ?? [],
                'inside',
                backend,
                insideLegalFillRule,
                {
                  preserveInsideWinding:
                    preservesPostLegalityInsideWinding,
                  reuseSingleLegalRegion: true
                }
              )
          )
        : null
      if (
        exactInsideLegalViolationArea !== null &&
        exactInsideLegalViolationArea >
          RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE
      ) {
        const clippedCompositePolygons = measureStrokeRenderEntryPhase(
          'render entries: same-paint exact legal splitter clip',
          () =>
            clipSamePaintInsideCompositeToLegalDomains(
              compositePolygons,
              options.legalDomains ?? [],
              backend,
              insideLegalFillRule
            )
        )
        if (clippedCompositePolygons?.length) {
          const clippedViolationArea = measureStrokeRenderEntryPhase(
            'render entries: same-paint exact legal splitter proof',
            () =>
              getRenderProjectionLegalDomainViolationArea(
                clippedCompositePolygons,
                options.legalDomains ?? [],
                'inside',
                backend,
                insideLegalFillRule,
                {
                  preserveInsideWinding: true,
                  reuseSingleLegalRegion: true
                }
              )
          )
          if (
            clippedViolationArea <=
            RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE
          ) {
            provedCompositePolygons = clippedCompositePolygons
            exactInsideLegalViolationArea = clippedViolationArea
          }
        }
      }
      const compositeKeepsLegalSide =
        (options.legalDomains?.length ?? 0) === 0 ||
        (exactInsideLegalViolationArea !== null
          ? exactInsideLegalViolationArea <=
            RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE
          : !hasRenderProjectionLegalSideSampleViolation(
              compositePolygons,
              options.legalDomains ?? [],
              primaryStrokePosition
            ))
      const compositePreservesSeamCoverage =
        renderProjectionPreservesSourceVertexSeamCoverage(
          sourcePolygons,
          provedCompositePolygons,
          entries
        )
      if (
        provedCompositePolygons.length > 0 &&
        compositeKeepsLegalSide &&
        compositePreservesSeamCoverage
      ) {
        emitStrokePipelineCounter(
          'render-entry-post-legality-composite-proof-hit'
        )
        postLegalityCompositePolygons = provedCompositePolygons
      } else if (provedCompositePolygons.length === 0) {
        emitStrokePipelineCounter(
          'render-entry-post-legality-composite-empty'
        )
      } else if (!compositeKeepsLegalSide) {
        emitStrokePipelineCounter(
          'render-entry-post-legality-composite-legal-side-rejected'
        )
      } else {
        emitStrokePipelineCounter(
          'render-entry-post-legality-composite-seam-rejected'
        )
      }
    } else {
      emitStrokePipelineCounter(
        'render-entry-post-legality-composite-backend-unavailable'
      )
    }
  } catch {
    emitStrokePipelineCounter('render-entry-post-legality-composite-error')
    // Continue through the fully proved composite route below.
  }
  if (entries.length === 1 && postLegalityCompositePolygons) {
    return buildSingleSamePaintPolygonRenderEntry(
      primaryEntry,
      postLegalityCompositePolygons,
      cacheKeyPrefix,
      collapseStatus
    )
  }
  const unionedPolygons =
    postLegalityCompositePolygons ??
    measureStrokeRenderEntryPhase(
      'render entries: same-paint first union',
      () => cleanRenderProjectionPolygons(unionCoveragePolygons(sourcePolygons))
    )
  const unionedPolygonsKeepLegalSide =
    postLegalityCompositePolygons !== null ||
    !hasOutsideLegalDomain ||
    !hasRenderProjectionLegalSideSampleViolation(
      unionedPolygons,
      options.legalDomains ?? [],
      'outside'
    )
  const unionPreservesSeamCoverage =
    postLegalityCompositePolygons !== null ||
    measureStrokeRenderEntryPhase(
      'render entries: same-paint seam proof',
      () =>
        renderProjectionPreservesSourceVertexSeamCoverage(
          sourcePolygons,
          unionedPolygons,
          entries
        )
    )
  const polygons =
    unionPreservesSeamCoverage && unionedPolygonsKeepLegalSide
      ? unionedPolygons
      : sourcePolygons.map(normalizeCoveragePolygonWinding)
  const legalPolygons =
    postLegalityCompositePolygons ??
    measureStrokeRenderEntryPhase(
      'render entries: same-paint first legal clip',
      () =>
        (options.legalDomains?.length ?? 0) > 0
          ? hasOutsideLegalDomain
            ? clipRenderProjectionPolygonsToOutsideLegalDomains(
                polygons,
                options.legalDomains ?? [],
                options.exactBackend ?? getGeometryBackend()
              )
            : clipRenderProjectionPolygonsToLegalDomains(
                polygons,
                options.legalDomains ?? [],
                primaryStrokePosition,
                'nonzero',
                options.exactBackend ?? getGeometryBackend()
              )
          : polygons
    )
  const finalLegalPolygons =
    hasOutsideLegalDomain &&
    hasRenderProjectionLegalSideSampleViolation(
      legalPolygons,
      options.legalDomains ?? [],
      'outside'
    )
      ? filterRenderProjectionPolygonsFullyToLegalSide(
          legalPolygons,
          options.legalDomains ?? [],
          'outside'
        )
      : legalPolygons
  const proofPreservedLegalPolygons =
    finalLegalPolygons.length === 0 &&
    hasOutsideLegalDomain &&
    !hasRenderProjectionLegalSideSampleViolation(
      polygons,
      options.legalDomains ?? [],
      'outside'
    )
      ? polygons
      : finalLegalPolygons
  if (proofPreservedLegalPolygons.length === 0) {
    return []
  }
  const sameEntryCompositePolygons =
    postLegalityCompositePolygons ??
    measureStrokeRenderEntryPhase(
      'render entries: same-paint composite union',
      () => {
    try {
      const backend = options.exactBackend ?? getGeometryBackend()
      if (
        backend.capabilities.union === true &&
        typeof backend.union === 'function'
      ) {
        return flattenFacePolygons(
          backend.union(
            [
              {
                polygons: preservesPostLegalityInsideWinding
                  ? proofPreservedLegalPolygons
                  : proofPreservedLegalPolygons.map(
                      normalizeCoveragePolygonWinding
                    )
              }
            ],
            'nonzero'
          ),
          proofPreservedLegalPolygons
        )
      }
    } catch {
      // Fall through to boundary-aware polygon loop merge below.
    }

    return cleanRenderProjectionPolygons(
      mergeSharedEdgeCoveragePolygons(proofPreservedLegalPolygons, {
        allowSharedEdgeLoopMerge: true
      })
    )
      }
    )
  const sameEntryCompositeLegalPolygons =
    postLegalityCompositePolygons ??
    measureStrokeRenderEntryPhase(
      'render entries: same-paint composite legal clip',
      () =>
        hasOutsideLegalDomain && (options.legalDomains?.length ?? 0) > 0
          ? clipRenderProjectionPolygonsToOutsideLegalDomains(
              sameEntryCompositePolygons,
              options.legalDomains ?? [],
              options.exactBackend ?? getGeometryBackend()
            )
          : sameEntryCompositePolygons
    )
  const sameEntryCompositePreservesLegalSide =
    postLegalityCompositePolygons !== null ||
    !hasOutsideLegalDomain ||
    !hasRenderProjectionLegalSideSampleViolation(
      sameEntryCompositeLegalPolygons,
      options.legalDomains ?? [],
      'outside'
    )
  const renderPolygons =
    sameEntryCompositePreservesLegalSide &&
    sameEntryCompositeLegalPolygons.length > 0
      ? sameEntryCompositeLegalPolygons
      : proofPreservedLegalPolygons
  if (entries.length === 1) {
    return buildSingleSamePaintPolygonRenderEntry(
      primaryEntry,
      renderPolygons,
      cacheKeyPrefix,
      collapseStatus
    )
  }
  const intervalIds = getUniqueStrings(
    entries.flatMap((entry) => [
      ...(entry.runtimeMeta.intervalIds ?? []),
      ...(entry.debugMeta?.intervalIds ?? []),
      ...(entry.debugMeta?.intervalId ? [entry.debugMeta.intervalId] : []),
      ...(entry.debugMeta?.dashProductIntervals?.map(
        (interval) => interval.intervalId
      ) ?? [])
    ])
  )
  const ownerSet = getUniqueStrokeOwners(
    entries.flatMap((entry) => entry.runtimeMeta.ownerSet ?? [])
  )
  const ownerStepIds = getUniqueStrings(
    entries.flatMap((entry) => entry.runtimeMeta.ownerStepIds ?? [])
  )
  const terminalRoles = getUniqueStrings(
    entries.flatMap((entry) => entry.runtimeMeta.terminalRoles ?? [])
  ) as NonNullable<SolidCenterStrokeRuntimeMeta['terminalRoles']>
  const seamBoundaryIds = getUniqueStrings(
    entries.flatMap((entry) => entry.runtimeMeta.seamBoundaryIds ?? [])
  )
  const sourceSpanIds = getUniqueStrings(
    entries.flatMap((entry) => [
      ...(entry.runtimeMeta.sourceSpanIds ?? []),
      ...(entry.debugMeta?.sourceSpanIds ?? [])
    ])
  )
  const sourceNetworkIds = getUniqueStrings(
    entries.flatMap((entry) => [
      ...(entry.runtimeMeta.sourceNetworkIds ?? []),
      ...(entry.debugMeta?.sourceNetworkIds ?? [])
    ])
  )
  const sourceContourIds = getUniqueStrings(
    entries.flatMap((entry) => [
      ...(entry.runtimeMeta.sourceContourIds ?? []),
      ...(entry.debugMeta?.sourceContourIds ?? [])
    ])
  )
  const legalDomainIds = getUniqueStrings(
    entries.flatMap((entry) => [
      ...(entry.runtimeMeta.legalDomainIds ?? []),
      ...(entry.debugMeta?.legalDomainIds ?? [])
    ])
  )
  const domainPlanSplitRangeTerminals = entries.flatMap(
    (entry) => entry.debugMeta?.domainPlanSplitRangeTerminals ?? []
  )
  const dashProductIntervals = getUniqueDashProductIntervalsForRenderArray(
    flatMapUniqueArrayReferences(
      entries.map((entry) =>
        getRenderDebugMetaDashProductIntervals(
          entry.debugMeta,
          entry.runtimeMeta.intervalIds ?? []
        )
      )
    )
  )
  const dashEndpointCapPolicySignatures = getUniqueStrings(
    flatMapUniqueArrayReferences(
      entries.map(
      (entry) => entry.debugMeta?.dashEndpointCapPolicySignatures ?? []
      )
    )
  )
  const dashEndpointCapPolicyTerminalRoles = getUniqueStrings(
    flatMapUniqueArrayReferences(
      entries.map(
      (entry) => entry.debugMeta?.dashEndpointCapPolicyTerminalRoles ?? []
      )
    )
  ) as NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
  >
  const joinOwnershipRecords = getUniqueJoinOwnershipRecords(
    flatMapUniqueArrayReferences(
      entries.map((entry) => entry.debugMeta?.joinOwnershipRecords)
    )
  )
  const joinOwnershipSignatures = getUniqueStrings(
    flatMapUniqueArrayReferences(
      entries.map((entry) => entry.debugMeta?.joinOwnershipSignatures)
    )
  )
  const smoothContinuityGroupIds = getUniqueStrings(
    flatMapUniqueArrayReferences(
      entries.map((entry) => entry.debugMeta?.smoothContinuityGroupIds)
    )
  )
  const physicalSpanRanges = getUniquePhysicalSpanRangesForRenderArray(
    flatMapUniqueArrayReferences(
      entries.map((entry) => entry.debugMeta?.physicalSpanRanges)
    )
  )
  const productEvidenceEnvelope =
    getMergedConstrainedDashedProductEvidenceEnvelope(
      entries.flatMap((entry) => {
        const envelope =
          entry.productIdentity.productEvidenceEnvelope ??
          entry.debugMeta?.productEvidenceEnvelope
        return envelope ? [envelope] : []
      })
    )
  const visualOverlapSourceFaceIds = getUniqueStrings(
    entries.flatMap((entry) =>
      entry.debugMeta?.visualOverlapSourceFaceIds?.length
        ? entry.debugMeta.visualOverlapSourceFaceIds
        : [entry.cacheKey]
    )
  )
  const visualOverlapSourceGeometryIds = getUniqueStrings(
    entries.flatMap(
      (entry) => entry.debugMeta?.visualOverlapSourceGeometryIds ?? []
    )
  )
  const mergedMeta = {
    ownerStepIds,
    intervalIds,
    terminalRoles,
    seamBoundaryIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals:
      domainPlanSplitRangeTerminals.length > 0
        ? domainPlanSplitRangeTerminals
        : undefined,
    dashProductIntervals:
      dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
    dashEndpointCapPolicySignatures:
      dashEndpointCapPolicySignatures.length > 0
        ? dashEndpointCapPolicySignatures
        : undefined,
    dashEndpointCapPolicyTerminalRoles:
      dashEndpointCapPolicyTerminalRoles.length > 0
        ? dashEndpointCapPolicyTerminalRoles
        : undefined,
    joinOwnershipRecords:
      joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
    joinOwnershipSignatures:
      joinOwnershipSignatures.length > 0 ? joinOwnershipSignatures : undefined,
    smoothContinuityGroupIds:
      smoothContinuityGroupIds.length > 0
        ? smoothContinuityGroupIds
        : undefined,
    physicalSpanRanges:
      physicalSpanRanges.length > 0 ? physicalSpanRanges : undefined,
    productEvidenceEnvelope,
    visualOverlapCollapseStatus: collapseStatus,
    visualOverlapSourceFaceIds,
    visualOverlapSourceGeometryIds
  }

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${entries.map((entry) => entry.cacheKey).join('|')}`,
      productIdentity: {
        primaryOwner: ownerSet[0],
        ownerSet,
        ownerStepIds,
        intervalIds,
        terminalRoles,
        seamBoundaryIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        ...(productEvidenceEnvelope ? { productEvidenceEnvelope } : {})
      },
      polygons: renderPolygons,
      fillPolygons: undefined,
      clipPolygons: undefined,
      fillClipPolygons: undefined,
      fillExcludePolygons: undefined,
      strokeMaskPolygons: undefined,
      strokePaths: undefined,
      strokePathGroups: undefined,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        ownerSet,
        ownerStepIds,
        intervalIds,
        terminalRoles,
        seamBoundaryIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapCollapseStatus: collapseStatus
      },
      debugMeta: primaryEntry.debugMeta
        ? {
            ...primaryEntry.debugMeta,
            ...mergedMeta
          }
        : primaryEntry.debugMeta
    }
  ]
}

const findSamePaintOverlappingPolygonRenderEntryGroupIndexes = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  options: SolidCenterStrokeRenderEntryOptions
) => {
  const broadPhaseEntryCount = entries.filter(
    canCompositePolygonRenderEntry
  ).length
  emitStrokePipelineCounter('render-entry-overlap-broad-phase-call-count')
  emitStrokePipelineCounter(
    'render-entry-overlap-broad-phase-entry-count',
    broadPhaseEntryCount
  )
  if (entries.length < 2) {
    emitStrokePipelineCounter(
      'render-entry-overlap-broad-phase-pair-check-count',
      0
    )
    return entries.map((_, index) => [index])
  }

  const parent = entries.map((_, index) => index)
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]))
  const unite = (leftIndex: number, rightIndex: number) => {
    const leftRoot = find(leftIndex)
    const rightRoot = find(rightIndex)
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot
    }
  }
  const exactBackend: Pick<GeometryBackend, 'capabilities' | 'intersection'> =
    options.exactBackend?.intersection !== undefined
      ? {
          capabilities: options.exactBackend.capabilities,
          intersection: options.exactBackend.intersection
        }
      : getGeometryBackend()
  const renderPolygons = entries.map(getVisibleProductPolygonsFromRenderEntry)
  const renderBounds = renderPolygons.map(getBounds)
  const entryIndexesByPaint = new Map<string, number[]>()
  entries.forEach((entry, index) => {
    if (!canCompositePolygonRenderEntry(entry)) {
      return
    }
    const paintSignature = getRenderEntryPaintSignature(entry)
    const indexes = entryIndexesByPaint.get(paintSignature) ?? []
    indexes.push(index)
    entryIndexesByPaint.set(paintSignature, indexes)
  })
  let broadPhasePairCheckCount = 0

  for (const indexes of entryIndexesByPaint.values()) {
    const sortedIndexes = [...indexes].sort(
      (leftIndex, rightIndex) =>
        renderBounds[leftIndex].minX - renderBounds[rightIndex].minX ||
        leftIndex - rightIndex
    )
    let activeIndexes: number[] = []

    for (const rightIndex of sortedIndexes) {
      const rightBounds = renderBounds[rightIndex]
      activeIndexes = activeIndexes.filter(
        (leftIndex) =>
          renderBounds[leftIndex].maxX +
            RENDER_PROJECTION_MICRO_EDGE_TOLERANCE >=
          rightBounds.minX
      )

      for (const leftIndex of activeIndexes) {
        broadPhasePairCheckCount += 1
        if (
          !doBoundsTouchOrOverlap(
            renderBounds[leftIndex],
            rightBounds,
            RENDER_PROJECTION_MICRO_EDGE_TOLERANCE
          )
        ) {
          continue
        }

        const hasBoundaryContact = polygonListsHaveBoundaryContact(
          renderPolygons[leftIndex],
          renderPolygons[rightIndex],
          renderBounds[leftIndex],
          rightBounds
        )
        if (hasBoundaryContact) {
          unite(leftIndex, rightIndex)
          continue
        }

        const exactOverlapArea = getExactPolygonListsOverlapArea(
          renderPolygons[leftIndex],
          renderPolygons[rightIndex],
          exactBackend
        )
        const hasOverlap =
          exactOverlapArea !== null
            ? exactOverlapArea > EXACT_RENDER_OVERLAP_AREA_EPSILON
            : polygonListsHaveInteriorOverlap(
                renderPolygons[leftIndex],
                renderPolygons[rightIndex],
                renderBounds[leftIndex],
                rightBounds
              )
        if (hasOverlap) {
          unite(leftIndex, rightIndex)
        }
      }

      activeIndexes.push(rightIndex)
    }
  }

  emitStrokePipelineCounter(
    'render-entry-overlap-broad-phase-pair-check-count',
    broadPhasePairCheckCount
  )

  const groupedEntryIndexes = new Map<number, number[]>()
  entries.forEach((_, index) => {
    const root = find(index)
    const group = groupedEntryIndexes.get(root) ?? []
    group.push(index)
    groupedEntryIndexes.set(root, group)
  })

  return Array.from(groupedEntryIndexes.values())
}

const getRenderEntryGroupByIndexes = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  indexes: number[]
) =>
  indexes.flatMap((index) => {
    const entry = entries[index]
    return entry ? [entry] : []
  })

const collapseSamePaintOverlappingPolygonRenderEntries = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string
) =>
  findSamePaintOverlappingPolygonRenderEntryGroupIndexes(
    entries,
    options
  ).flatMap((indexes) => {
    const group = getRenderEntryGroupByIndexes(entries, indexes)
    return group.length > 1
      ? mergeSamePaintPolygonRenderEntries(
          group,
          cacheKeyPrefix,
          'render-projection-merged',
          options
        )
      : group
  })

type RenderProjectionCollapseStatus =
  | 'exact-union'
  | 'exact-mask'
  | 'exact-arrangement'
  | 'render-projection-merged'
  | 'render-projection-arrangement'

const buildRenderProjectionArrangementCandidates = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: {
    candidateGranularity?: 'face' | 'polygon'
    preserveWinding?: boolean
  } = {}
): RenderProjectionCandidateRegion[] =>
  faces.flatMap((face) => {
    const productPolygons = getRenderProductPolygonsFromFinalFace(face)
    const arrangementPolygons =
      options.preserveWinding === true
        ? productPolygons
        : productPolygons.map(normalizeCoveragePolygonWinding)
    const buildCandidate = (
      geometryPolygons: Vec2[][],
      candidateId: string
    ): RenderProjectionCandidateRegion => ({
      candidateId,
      geometry: {
        polygons: geometryPolygons
      },
      geometryBounds: getBounds(geometryPolygons),
      geometrySignature: buildRenderProjectionRegionSignature(geometryPolygons),
      visualPacketKey: face.visualPacketKey,
      strokePosition:
        face.debugMeta?.strokePosition === 'inside' ||
        face.debugMeta?.strokePosition === 'outside'
          ? face.debugMeta.strokePosition
          : 'center',
      sourcePathId: face.debugMeta?.sourcePathId,
      networkId: face.debugMeta?.networkId,
      strokeId: face.debugMeta?.strokeId,
      strokeIndex: face.debugMeta?.strokeIndex,
      ownerKey: face.debugMeta?.ownerKey,
      intervalId: face.intervalIds[0] ?? face.debugMeta?.intervalId,
      contourId: face.sourceContourIds[0],
      legalDomainId: face.legalDomainIds[0] ?? null,
      paintKey: face.paintKey,
      strokeSpecKey: face.strokeSpecKey,
      sourceSpanIds: face.sourceSpanIds,
      sourceNetworkIds: face.sourceNetworkIds,
      sourceContourIds: face.sourceContourIds,
      requiresBoundaryPreservingArrangement:
        face.debugMeta?.domainPlanBoundaryRole === 'filled-face' ||
        face.debugMeta?.domainPlanSplitRangeTerminals?.some(
          (terminal) => terminal.boundaryRole === 'filled-face'
        ) === true
    })

    if (options.candidateGranularity === 'face') {
      return {
        ...buildCandidate(arrangementPolygons, `${face.faceId}:render-face`)
      }
    }

    return arrangementPolygons.map((polygon, polygonIndex) =>
      buildCandidate([polygon], `${face.faceId}:render-polygon:${polygonIndex}`)
    )
  })

const findRenderProjectionComponentIndexes = (bounds: Bounds[]) => {
  const parents = bounds.map((_, index) => index)
  const ranks = bounds.map(() => 0)

  const findRoot = (index: number): number => {
    const parent = parents[index]
    if (parent === index) {
      return index
    }

    const root = findRoot(parent)
    parents[index] = root
    return root
  }

  const union = (leftIndex: number, rightIndex: number) => {
    const leftRoot = findRoot(leftIndex)
    const rightRoot = findRoot(rightIndex)
    if (leftRoot === rightRoot) {
      return
    }

    const leftRank = ranks[leftRoot]
    const rightRank = ranks[rightRoot]
    if (leftRank < rightRank) {
      parents[leftRoot] = rightRoot
      return
    }

    if (leftRank > rightRank) {
      parents[rightRoot] = leftRoot
      return
    }

    parents[rightRoot] = leftRoot
    ranks[leftRoot] += 1
  }

  const sortedIndexes = bounds
    .map((_, index) => index)
    .sort(
      (leftIndex, rightIndex) =>
        bounds[leftIndex].minX - bounds[rightIndex].minX
    )
  const activeIndexes: number[] = []

  sortedIndexes.forEach((currentIndex) => {
    const currentBounds = bounds[currentIndex]

    for (let index = activeIndexes.length - 1; index >= 0; index -= 1) {
      const activeIndex = activeIndexes[index]
      const activeBounds = bounds[activeIndex]
      if (activeBounds.maxX <= currentBounds.minX) {
        activeIndexes.splice(index, 1)
        continue
      }

      if (doBoundsOverlap(currentBounds, activeBounds)) {
        union(currentIndex, activeIndex)
      }
    }

    activeIndexes.push(currentIndex)
  })

  const groupsByRoot = new Map<number, number[]>()
  bounds.forEach((_, index) => {
    const root = findRoot(index)
    const group = groupsByRoot.get(root) ?? []
    group.push(index)
    groupsByRoot.set(root, group)
  })

  return [...groupsByRoot.values()]
}

const buildRenderProjectionArrangementPolygons = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  backend: Pick<
    GeometryBackend,
    'capabilities' | 'buildArrangement' | 'union'
  > &
    Partial<Pick<GeometryBackend, 'intersection'>>,
  options: {
    allowDirectUnion?: boolean
    allowComponentUnion?: boolean
    candidateGranularity?: 'face' | 'polygon'
    finalUnion?: boolean
    legalDomains?: SolidCenterStrokeRenderEntryOptions['legalDomains']
    preserveWinding?: boolean
  } = {}
) => {
  const candidates = measureStrokeRenderEntryPhase(
    'render projection: candidates',
    () =>
      buildRenderProjectionArrangementCandidates(faces, {
        candidateGranularity: options.candidateGranularity,
        preserveWinding: options.preserveWinding
      })
  )
  const legalDomainSplitterCandidates =
    options.legalDomains && options.legalDomains.length > 0
      ? buildRenderProjectionLegalDomainSplitterCandidates(options.legalDomains)
      : []

  if (candidates.length <= 1 && legalDomainSplitterCandidates.length === 0) {
    return candidates.flatMap((candidate) => candidate.geometry.polygons)
  }

  if (
    options.allowDirectUnion !== false &&
    legalDomainSplitterCandidates.length === 0 &&
    backend.capabilities.union === true
  ) {
    try {
      const polygons = measureStrokeRenderEntryPhase(
        'render projection: direct union',
        () =>
          flattenFacePolygons(
            backend.union(
              candidates.map((candidate) => ({
                polygons: candidate.geometry.polygons
              })),
              'nonzero'
            ),
            []
          )
      )

      if (polygons.length > 0) {
        return polygons
      }
    } catch {
      // Fall through to the arrangement path below.
    }
  }

  const bounds = measureStrokeRenderEntryPhase(
    'render projection: bounds',
    () => candidates.map((candidate) => candidate.geometryBounds)
  )
  const output: Vec2[][] = []

  measureStrokeRenderEntryPhase('render projection: components', () => {
    findRenderProjectionComponentIndexes(bounds).forEach((componentIndexes) => {
      const componentCandidates = componentIndexes.map(
        (index) => candidates[index]
      )
      const componentBounds = componentIndexes.map((index) => bounds[index])
      const componentLegalDomainSplitterCandidates =
        legalDomainSplitterCandidates
      if (
        componentIndexes.length === 1 &&
        componentLegalDomainSplitterCandidates.length === 0
      ) {
        output.push(...componentCandidates[0].geometry.polygons)
        return
      }
      if (
        componentLegalDomainSplitterCandidates.length === 0 &&
        !candidateRegionsHaveInteriorOverlap(
          componentCandidates,
          componentBounds,
          backend.capabilities.intersection === true &&
            typeof backend.intersection === 'function'
            ? (backend as Pick<
                GeometryBackend,
                'capabilities' | 'intersection'
              >)
            : null
        )
      ) {
        emitStrokePipelineCounter('render-projection-component-disjoint')
        output.push(
          ...componentCandidates.flatMap(
            (candidate) => candidate.geometry.polygons
          )
        )
        return
      }

      const componentRequiresBoundaryPreservingArrangement =
        componentCandidates.some(
          (candidate) =>
            candidate.requiresBoundaryPreservingArrangement === true
        )
      if (
        options.allowComponentUnion !== false &&
        componentLegalDomainSplitterCandidates.length === 0 &&
        (options.allowDirectUnion !== false ||
          !componentRequiresBoundaryPreservingArrangement) &&
        backend.capabilities.union === true
      ) {
        try {
          const componentPolygons = measureStrokeRenderEntryPhase(
            'render projection: component direct union',
            () =>
              flattenFacePolygons(
                backend.union(
                  componentCandidates.map((candidate) => ({
                    polygons: candidate.geometry.polygons
                  })),
                  'nonzero'
                ),
                []
              )
          )

          if (componentPolygons.length > 0) {
            emitStrokePipelineCounter(
              'render-projection-component-direct-union'
            )
            output.push(...componentPolygons)
            return
          }
        } catch {
          // Fall through to the arrangement path for this component.
        }
      }

      const arrangementCacheKey = buildRenderProjectionArrangementCacheKey(
        [...componentCandidates, ...componentLegalDomainSplitterCandidates],
        backend
      )
      const arrangedPolygons =
        getCachedRenderProjectionArrangement(arrangementCacheKey) ??
        (() =>
          measureStrokeRenderEntryPhase(
            'render projection: arrangement',
            () => {
              const arrangementCandidates = [
                ...componentCandidates,
                ...componentLegalDomainSplitterCandidates
              ]
              const arrangementFaces =
                options.legalDomains && options.legalDomains.length > 0
                  ? classifyArrangementFacesByLegalDomain(
                      backend.buildArrangement(arrangementCandidates),
                      options.legalDomains
                    )
                  : backend.buildArrangement(arrangementCandidates)
              const polygons = arrangementFaces
                .filter(
                  (face) =>
                    normalizePacketPolygons(face.geometry.polygons).length >
                      0 &&
                    face.claimedBy.some((candidate) =>
                      isRenderProjectionArrangementFaceLegalForCandidate(
                        candidate,
                        face.legalState
                      )
                    )
                )
                .flatMap((face) => face.geometry.polygons)
              setCachedRenderProjectionArrangement(
                arrangementCacheKey,
                polygons
              )
              return polygons
            }
          ))()

      output.push(
        ...(arrangedPolygons.length > 0
          ? arrangedPolygons
          : componentCandidates.flatMap((entry) => entry.geometry.polygons))
      )
    })
  })

  if (
    options.finalUnion === true &&
    output.length > 1 &&
    backend.capabilities.union === true
  ) {
    try {
      const unionPolygons = flattenFacePolygons(
        backend.union(
          output.map((polygon) => ({
            polygons: [polygon]
          })),
          'nonzero'
        ),
        output
      )

      const finalUnionPolygons = clipRenderProjectionUnionToArrangementCoverage(
        unionPolygons,
        output,
        backend
      )

      if (finalUnionPolygons.length > 0) {
        emitStrokePipelineCounter('render-projection-final-union')
        return cleanRenderProjectionPolygons(finalUnionPolygons)
      }
    } catch {
      // The arrangement output remains the product geometry when union cannot be clipped.
    }
  }

  emitStrokePipelineCounter('render-projection-final-union-skipped')
  return cleanRenderProjectionPolygons(output)
}

const selectPrimaryRenderMetadataFace = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.find(
    (face) => face.debugMeta?.visibleContributor === 'source-vertex-join'
  ) ??
  faces.find(
    (face) =>
      face.debugMeta?.productSignature?.includes(
        ':join-owned:source-vertex:'
      ) === true
  ) ??
  faces.find(
    (face) =>
      face.debugMeta?.joinOwnershipSignature?.startsWith(
        'source-vertex-boundary-join:'
      ) === true
  ) ??
  faces.find(
    (face) =>
      face.debugMeta?.joinOwnershipRecords?.some(
        (record) =>
          record.kind === 'source-vertex' &&
          record.materializationKind === 'join'
      ) === true
  ) ??
  faces[0]

const buildCollapsedRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string,
  collapseStatus: RenderProjectionCollapseStatus,
  fillRule: FillRule = 'nonzero',
  renderOptions: {
    collapseSingleFace?: boolean
    finalUnion?: boolean
    preserveWinding?: boolean
    projection?: 'union' | 'arrangement' | 'shared-edge'
    clipToSourceCoverage?: boolean
    clipToDescriptorExclusions?: boolean
    clipToLegalDomains?: boolean
    allowSharedEdgeLoopMerge?: boolean
    preserveProductPolygons?: boolean
    preservePostLegalEndpointCanonicalization?: boolean
    reclipToLegalDomainsAfterSourceCoverage?: boolean
    requirePostLegalCoverageEquivalence?: boolean
    allowPostLegalCoverageReduction?: boolean
  } = {}
) => {
  const primaryFace = selectPrimaryRenderMetadataFace(faces)
  const backend =
    renderOptions.projection === 'arrangement'
      ? getRenderArrangementBackend(options)
      : getRenderOverlapBackend(options)
  if (
    !primaryFace ||
    (!renderOptions.collapseSingleFace && faces.length < 2) ||
    !backend
  ) {
    return faces.map((face) => buildRenderEntryFromFinalFace(face, options))
  }
  const renderProjectionStrokePosition =
    primaryFace.debugMeta?.strokePosition ??
    faces.find(
      (face) =>
        face.debugMeta?.strokePosition === 'inside' ||
        face.debugMeta?.strokePosition === 'outside' ||
        face.debugMeta?.strokePosition === 'center'
    )?.debugMeta?.strokePosition

  const rawSourcePolygons = measureStrokeRenderEntryPhase(
    'render projection: source polygons',
    () => faces.flatMap(getRenderProductPolygonsFromFinalFace)
  )
  const canonicalSourcePolygons =
    renderOptions.preservePostLegalEndpointCanonicalization === false
      ? rawSourcePolygons
      : canonicalizeRenderProjectionSourceVertexSeamPoints(
          rawSourcePolygons,
          faces
        )
  const sourcePolygons =
    renderOptions.preservePostLegalEndpointCanonicalization === false ||
    (renderOptions.clipToLegalDomains === true &&
      hasRenderProjectionLegalSideSampleViolation(
        canonicalSourcePolygons,
        options.legalDomains ?? [],
        renderProjectionStrokePosition
      ))
      ? rawSourcePolygons
      : canonicalSourcePolygons
  const shouldPreserveProductPolygons =
    renderOptions.preserveProductPolygons === true
  const rawPolygons = shouldPreserveProductPolygons
    ? sourcePolygons.map(normalizeCoveragePolygonWinding)
    : flattenFacePolygons(
        (() => {
          try {
            if (renderOptions.projection === 'shared-edge') {
              return [
                {
                  polygons: mergeSharedEdgeCoveragePolygons(sourcePolygons, {
                    allowSharedEdgeLoopMerge: true
                  })
                }
              ]
            }

            if (renderOptions.projection === 'arrangement') {
              const arrangementBackend =
                backend as RenderProjectionArrangementBackend
              const arrangementPolygons =
                buildRenderProjectionArrangementPolygons(
                  faces,
                  arrangementBackend,
                  {
                    allowDirectUnion: false,
                    allowComponentUnion: false,
                    finalUnion: renderOptions.finalUnion,
                    legalDomains: options.legalDomains,
                    preserveWinding: renderOptions.preserveWinding
                  }
                )
              return [
                {
                  polygons:
                    renderOptions.clipToSourceCoverage === true
                      ? clipRenderProjectionUnionToArrangementCoverage(
                          arrangementPolygons,
                          sourcePolygons,
                          arrangementBackend
                        )
                      : arrangementPolygons
                }
              ]
            }

            const unionPolygons = measureStrokeRenderEntryPhase(
              'render projection: union',
              () =>
                mergeSharedEdgeCoveragePolygons(
                  flattenFacePolygons(
                    backend.union(
                      faces.map((face) =>
                        toCoverageFaceRegion(face, renderOptions)
                      ),
                      fillRule
                    ),
                    sourcePolygons
                  )
                )
            )
            return [
              {
                polygons:
                  renderOptions.clipToSourceCoverage === true
                    ? clipRenderProjectionUnionToArrangementCoverage(
                        unionPolygons,
                        sourcePolygons,
                        backend
                      )
                    : unionPolygons
              }
            ]
          } catch {
            return []
          }
        })(),
        sourcePolygons
      )
  const projectedPolygons = rawPolygons
  const descriptorExcludePolygons =
    !shouldPreserveProductPolygons &&
    renderOptions.clipToDescriptorExclusions === true
      ? faces.flatMap(
          (face) =>
            (
              face.renderDescriptor as
                | SolidCenterStrokeRenderDescriptor
                | undefined
            )?.fillExcludePolygons ?? []
        )
      : []
  const polygons =
    descriptorExcludePolygons.length > 0
      ? cleanRenderProjectionPolygons(
          measureStrokeRenderEntryPhase(
            'render projection: descriptor exclusion',
            () =>
              differenceDescriptorPolygons(
                projectedPolygons,
                descriptorExcludePolygons
              )
          )
        )
      : projectedPolygons
  const legallyClippedPolygons = measureStrokeRenderEntryPhase(
    'render projection: initial legal clip',
    () =>
      !shouldPreserveProductPolygons && renderOptions.clipToLegalDomains === true
        ? (() => {
            try {
              return clipRenderProjectionPolygonsToLegalDomains(
                polygons,
                options.legalDomains ?? [],
                renderProjectionStrokePosition,
                fillRule,
                options.exactBackend ?? getGeometryBackend()
              )
            } catch {
              return polygons
            }
          })()
        : polygons
  )
  const sourceCoveredPolygons = measureStrokeRenderEntryPhase(
    'render projection: source coverage clip',
    () =>
      !shouldPreserveProductPolygons &&
      renderOptions.clipToSourceCoverage === true &&
      backend
        ? clipRenderProjectionUnionToArrangementCoverage(
            legallyClippedPolygons,
            sourcePolygons,
            backend,
            {
              allowSharedEdgeLoopMerge:
                renderOptions.allowSharedEdgeLoopMerge ?? false
            }
          )
        : legallyClippedPolygons
  )
  const sourceCoveredLegalViolationArea = measureStrokeRenderEntryPhase(
    'render projection: source coverage legal-area proof',
    () =>
      !shouldPreserveProductPolygons &&
      renderOptions.reclipToLegalDomainsAfterSourceCoverage === true
        ? getRenderProjectionLegalDomainViolationArea(
            sourceCoveredPolygons,
            options.legalDomains ?? [],
            renderProjectionStrokePosition,
            backend,
            fillRule
          )
        : 0
  )
  const sourceCoveredHasLegalAreaViolation =
    !shouldPreserveProductPolygons &&
    renderOptions.reclipToLegalDomainsAfterSourceCoverage === true &&
    sourceCoveredLegalViolationArea >
      RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE
  const sourceCoveredHasLegalSideSampleViolation =
    !shouldPreserveProductPolygons &&
    renderOptions.reclipToLegalDomainsAfterSourceCoverage === true &&
    hasRenderProjectionLegalSideSampleViolation(
      sourceCoveredPolygons,
      options.legalDomains ?? [],
      renderProjectionStrokePosition
    )
  const legalSideFilteredSourceCoveredPolygons =
    sourceCoveredHasLegalSideSampleViolation &&
    !sourceCoveredHasLegalAreaViolation
      ? filterRenderProjectionPolygonsFullyToLegalSide(
          sourceCoveredPolygons,
          options.legalDomains ?? [],
          renderProjectionStrokePosition
        )
      : sourceCoveredPolygons
  const reclippedSourceCoveredPolygons =
    sourceCoveredHasLegalAreaViolation ||
    sourceCoveredHasLegalSideSampleViolation
      ? (() => {
          try {
            const clippedPolygons = clipRenderProjectionPolygonsToLegalDomains(
              sourceCoveredPolygons,
              options.legalDomains ?? [],
              renderProjectionStrokePosition,
              fillRule,
              options.exactBackend ?? getGeometryBackend()
            )
            return renderProjectionPreservesSourceVertexSeamCoverage(
              sourcePolygons,
              clippedPolygons,
              faces,
              {
                legalDomains: options.legalDomains,
                strokePosition: renderProjectionStrokePosition
              }
            )
              ? clippedPolygons
              : legalSideFilteredSourceCoveredPolygons
          } catch {
            return legalSideFilteredSourceCoveredPolygons
          }
        })()
      : legalSideFilteredSourceCoveredPolygons
  const hasPostLegalCoverageMismatch = measureStrokeRenderEntryPhase(
    'render projection: post-legal coverage proof',
    () =>
      renderOptions.requirePostLegalCoverageEquivalence === true &&
      !areRenderProjectionCoveragesEquivalent(
        reclippedSourceCoveredPolygons,
        legallyClippedPolygons,
        backend,
        fillRule
      )
  )
  const hasPostLegalWrongSideViolation =
    renderOptions.requirePostLegalCoverageEquivalence === true &&
    (getRenderProjectionLegalDomainViolationArea(
      reclippedSourceCoveredPolygons,
      options.legalDomains ?? [],
      renderProjectionStrokePosition,
      backend,
      fillRule
    ) > RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE ||
      hasRenderProjectionLegalSideSampleViolation(
        reclippedSourceCoveredPolygons,
        options.legalDomains ?? [],
        renderProjectionStrokePosition
      ))
  const hasPostLegalCoverageViolation =
    hasPostLegalWrongSideViolation ||
    (hasPostLegalCoverageMismatch &&
      renderOptions.allowPostLegalCoverageReduction !== true)
  const conservativeSourceCoveredPolygons = hasPostLegalCoverageViolation
    ? !shouldPreserveProductPolygons &&
      renderOptions.clipToSourceCoverage === true &&
      backend
      ? clipRenderProjectionUnionToArrangementCoverage(
          legallyClippedPolygons,
          sourcePolygons,
          backend,
          { allowSharedEdgeLoopMerge: false, mergeSharedEdges: false }
        )
      : legallyClippedPolygons
    : sourceCoveredPolygons
  const visiblePolygons = hasPostLegalWrongSideViolation
    ? reclippedSourceCoveredPolygons
    : hasPostLegalCoverageViolation
      ? conservativeSourceCoveredPolygons
      : reclippedSourceCoveredPolygons
  const finalVisiblePolygons = measureStrokeRenderEntryPhase(
    'render projection: final legal clip',
    () =>
      !shouldPreserveProductPolygons &&
      renderOptions.clipToLegalDomains === true &&
      (options.legalDomains?.length ?? 0) > 0
        ? clipRenderProjectionPolygonsToLegalDomains(
            visiblePolygons,
            options.legalDomains ?? [],
            renderProjectionStrokePosition,
            fillRule,
            options.exactBackend ?? getGeometryBackend()
          )
        : visiblePolygons
  )
  const endpointCanonicalCandidate =
    renderOptions.preservePostLegalEndpointCanonicalization === false
      ? finalVisiblePolygons
      : canonicalizeRenderProjectionSourceVertexSeamPoints(
          finalVisiblePolygons,
          faces
        )
  const endpointCanonicalHasLegalViolation =
    !shouldPreserveProductPolygons &&
    renderOptions.clipToLegalDomains === true &&
    (options.legalDomains?.length ?? 0) > 0 &&
    (getRenderProjectionLegalDomainViolationArea(
      endpointCanonicalCandidate,
      options.legalDomains ?? [],
      renderProjectionStrokePosition,
      backend,
      fillRule
    ) > RENDER_PROJECTION_LEGAL_VIOLATION_AREA_TOLERANCE ||
      hasRenderProjectionLegalSideSampleViolation(
        endpointCanonicalCandidate,
        options.legalDomains ?? [],
        renderProjectionStrokePosition
      ))
  const endpointCanonicalVisiblePolygons = endpointCanonicalHasLegalViolation
    ? finalVisiblePolygons
    : endpointCanonicalCandidate
  const renderEntryHasOutsideLegalDomain =
    renderProjectionStrokePosition === 'outside' ||
    faces.some((face) => face.debugMeta?.strokePosition === 'outside')
  let renderEntryVisiblePolygons =
    !shouldPreserveProductPolygons &&
    renderOptions.clipToLegalDomains === true &&
    (options.legalDomains?.length ?? 0) > 0
      ? (() => {
          if (renderEntryHasOutsideLegalDomain) {
            return clipRenderProjectionPolygonsToOutsideLegalDomains(
              endpointCanonicalVisiblePolygons,
              options.legalDomains ?? [],
              options.exactBackend ?? getGeometryBackend()
            )
          }
          const clippedPolygons = clipRenderProjectionPolygonsToLegalDomains(
            endpointCanonicalVisiblePolygons,
            options.legalDomains ?? [],
            renderProjectionStrokePosition,
            fillRule,
            options.exactBackend ?? getGeometryBackend()
          )
          return clippedPolygons.length > 0
            ? clippedPolygons
            : endpointCanonicalVisiblePolygons
        })()
      : endpointCanonicalVisiblePolygons
  if (
    !shouldPreserveProductPolygons &&
    renderOptions.clipToLegalDomains === true &&
    renderEntryHasOutsideLegalDomain &&
    hasRenderProjectionLegalSideSampleViolation(
      renderEntryVisiblePolygons,
      options.legalDomains ?? [],
      'outside'
    )
  ) {
    const legalSidePolygons = filterRenderProjectionPolygonsFullyToLegalSide(
      renderEntryVisiblePolygons,
      options.legalDomains ?? [],
      'outside'
    )
    renderEntryVisiblePolygons = legalSidePolygons
  }
  if (renderEntryVisiblePolygons.length === 0) {
    return []
  }
  const sourceGeometryIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceGeometryIds)
  )
  const mergedProductIdentity = getMergedFinalFaceRuntimeIdentity(faces)
  const outputProductIdentity = getMergedFinalFaceOutputProductIdentity(faces)
  const intervalIds = getMergedDebugIntervalIds(faces)
  const sourceSpanIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceSpanIds)
  )
  const sourceNetworkIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceNetworkIds)
  )
  const sourceContourIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceContourIds)
  )
  const legalDomainIds = getUniqueStrings(
    faces.flatMap((face) => face.legalDomainIds)
  )
  const domainPlanSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.domainPlanSplitRangeTerminals ?? []
  )
  const dashProductIntervals = getUniqueDashProductIntervalsForRenderArray(
    faces.flatMap((face) =>
      getRenderDebugMetaDashProductIntervals(face.debugMeta, face.intervalIds)
    )
  )
  const dashEndpointCapPolicySignatures = getUniqueStrings(
    faces.flatMap(
      (face) => face.debugMeta?.dashEndpointCapPolicySignatures ?? []
    )
  )
  const dashEndpointCapPolicyTerminalRoles = getUniqueStrings(
    faces.flatMap(
      (face) => face.debugMeta?.dashEndpointCapPolicyTerminalRoles ?? []
    )
  ) as NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
  >
  const joinOwnershipRecords = getUniqueJoinOwnershipRecords(
    faces.flatMap((face) => face.debugMeta?.joinOwnershipRecords ?? [])
  )
  const joinOwnershipSignatures = getUniqueStrings(
    faces.flatMap((face) => face.debugMeta?.joinOwnershipSignatures ?? [])
  )
  const smoothContinuityGroupIds = getUniqueStrings(
    faces.flatMap((face) => face.debugMeta?.smoothContinuityGroupIds ?? [])
  )
  const physicalSpanRanges = getUniquePhysicalSpanRangesForRenderArray(
    faces.flatMap((face) => face.debugMeta?.physicalSpanRanges ?? [])
  )
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace, options)

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      productIdentity: outputProductIdentity,
      polygons: renderEntryVisiblePolygons,
      fillPolygons: undefined,
      clipPolygons: undefined,
      fillClipPolygons: undefined,
      fillExcludePolygons: undefined,
      strokeMaskPolygons: undefined,
      strokePaths: undefined,
      strokePathGroups: undefined,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        ...mergedProductIdentity,
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapCollapseStatus: collapseStatus
      },
      debugMeta: shouldEmitFullStrokeDiagnostics()
        ? {
            ...primaryFace.debugMeta,
            ownerStepIds: mergedProductIdentity.ownerStepIds,
            intervalIds,
            terminalRoles: mergedProductIdentity.terminalRoles,
            seamBoundaryIds: mergedProductIdentity.seamBoundaryIds,
            sourceSpanIds,
            sourceNetworkIds,
            sourceContourIds,
            legalDomainIds,
            domainPlanSplitRangeTerminals:
              domainPlanSplitRangeTerminals.length > 0
                ? domainPlanSplitRangeTerminals
                : undefined,
            dashProductIntervals:
              dashProductIntervals.length > 0
                ? dashProductIntervals
                : undefined,
            dashEndpointCapPolicySignatures:
              dashEndpointCapPolicySignatures.length > 0
                ? dashEndpointCapPolicySignatures
                : undefined,
            dashEndpointCapPolicyTerminalRoles:
              dashEndpointCapPolicyTerminalRoles.length > 0
                ? dashEndpointCapPolicyTerminalRoles
                : undefined,
            joinOwnershipRecords:
              joinOwnershipRecords.length > 0
                ? joinOwnershipRecords
                : undefined,
            joinOwnershipSignatures:
              joinOwnershipSignatures.length > 0
                ? joinOwnershipSignatures
                : undefined,
            smoothContinuityGroupIds:
              smoothContinuityGroupIds.length > 0
                ? smoothContinuityGroupIds
                : undefined,
            physicalSpanRanges:
              physicalSpanRanges.length > 0 ? physicalSpanRanges : undefined,
            productEvidenceEnvelope:
              outputProductIdentity.productEvidenceEnvelope,
            visualOverlapCollapseStatus: collapseStatus,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          }
        : buildProductContractDebugMetaFromFinalFace(primaryFace, {
            ownerStepIds: mergedProductIdentity.ownerStepIds,
            intervalIds,
            terminalRoles: mergedProductIdentity.terminalRoles,
            seamBoundaryIds: mergedProductIdentity.seamBoundaryIds,
            sourceSpanIds,
            sourceNetworkIds,
            sourceContourIds,
            legalDomainIds,
            domainPlanSplitRangeTerminals:
              domainPlanSplitRangeTerminals.length > 0
                ? domainPlanSplitRangeTerminals
                : undefined,
            dashProductIntervals:
              dashProductIntervals.length > 0
                ? dashProductIntervals
                : undefined,
            dashEndpointCapPolicySignatures:
              dashEndpointCapPolicySignatures.length > 0
                ? dashEndpointCapPolicySignatures
                : undefined,
            dashEndpointCapPolicyTerminalRoles:
              dashEndpointCapPolicyTerminalRoles.length > 0
                ? dashEndpointCapPolicyTerminalRoles
                : undefined,
            joinOwnershipRecords:
              joinOwnershipRecords.length > 0
                ? joinOwnershipRecords
                : undefined,
            joinOwnershipSignatures:
              joinOwnershipSignatures.length > 0
                ? joinOwnershipSignatures
                : undefined,
            smoothContinuityGroupIds:
              smoothContinuityGroupIds.length > 0
                ? smoothContinuityGroupIds
                : undefined,
            physicalSpanRanges:
              physicalSpanRanges.length > 0 ? physicalSpanRanges : undefined,
            productEvidenceEnvelope:
              outputProductIdentity.productEvidenceEnvelope,
            visualOverlapCollapseStatus: collapseStatus,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          })
    }
  ]
}

function polygonListContainsPoint(polygons: Vec2[][], point: Vec2) {
  return polygons.some((polygon) => isPointInsidePolygon(point, polygon))
}

function polygonListsHaveInteriorOverlap(
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][],
  leftBounds = getBounds(leftPolygons),
  rightBounds = getBounds(rightPolygons),
  step = 6
) {
  if (!doBoundsOverlap(leftBounds, rightBounds)) {
    return false
  }

  if (
    leftPolygons.some((polygon) =>
      polygon.some((point) => polygonListContainsPoint(rightPolygons, point))
    ) ||
    rightPolygons.some((polygon) =>
      polygon.some((point) => polygonListContainsPoint(leftPolygons, point))
    )
  ) {
    return true
  }

  const minX = Math.max(leftBounds.minX, rightBounds.minX)
  const minY = Math.max(leftBounds.minY, rightBounds.minY)
  const maxX = Math.min(leftBounds.maxX, rightBounds.maxX)
  const maxY = Math.min(leftBounds.maxY, rightBounds.maxY)
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const point = { x, y }
      if (
        polygonListContainsPoint(leftPolygons, point) &&
        polygonListContainsPoint(rightPolygons, point)
      ) {
        return true
      }
    }
  }

  return false
}

function polygonListsHaveBoundaryContact(
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][],
  leftBounds = getBounds(leftPolygons),
  rightBounds = getBounds(rightPolygons),
  tolerance = RENDER_PROJECTION_MICRO_EDGE_TOLERANCE
) {
  if (!doBoundsTouchOrOverlap(leftBounds, rightBounds, tolerance)) {
    return false
  }

  return leftPolygons.some((leftPolygon) =>
    leftPolygon.some((leftPoint, leftIndex) => {
      const leftNext =
        leftPolygon[(leftIndex + 1) % leftPolygon.length] ?? leftPoint
      return rightPolygons.some((rightPolygon) =>
        rightPolygon.some((rightPoint, rightIndex) => {
          const rightNext =
            rightPolygon[(rightIndex + 1) % rightPolygon.length] ?? rightPoint
          return (
            distanceSegmentToSegment(
              leftPoint,
              leftNext,
              rightPoint,
              rightNext
            ) <= tolerance
          )
        })
      )
    })
  )
}

const EXACT_RENDER_OVERLAP_AREA_EPSILON = 1e-7

const getExactPolygonListsOverlapArea = (
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][],
  backend: Pick<GeometryBackend, 'capabilities' | 'intersection'>
) => {
  if (backend.capabilities.intersection !== true) {
    return null
  }

  try {
    const intersections = backend.intersection(
      [
        {
          polygons: leftPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      [
        {
          polygons: rightPolygons.map(normalizeCoveragePolygonWinding)
        }
      ],
      'nonzero'
    )

    return intersections.reduce(
      (area, region) => area + getPolygonListCoverageArea(region.polygons),
      0
    )
  } catch {
    return null
  }
}

function candidateRegionsHaveInteriorOverlap(
  candidates: CandidateRegion[],
  bounds = candidates.map((candidate) =>
    getBounds(candidate.geometry.polygons)
  ),
  backend?: Pick<GeometryBackend, 'capabilities' | 'intersection'> | null
) {
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      if (!doBoundsOverlap(bounds[leftIndex], bounds[rightIndex])) {
        continue
      }

      const exactOverlapArea = backend
        ? getExactPolygonListsOverlapArea(
            candidates[leftIndex].geometry.polygons,
            candidates[rightIndex].geometry.polygons,
            backend
          )
        : null
      if (exactOverlapArea !== null) {
        if (exactOverlapArea > EXACT_RENDER_OVERLAP_AREA_EPSILON) {
          return true
        }
        continue
      }

      if (
        polygonListsHaveInteriorOverlap(
          candidates[leftIndex].geometry.polygons,
          candidates[rightIndex].geometry.polygons,
          bounds[leftIndex],
          bounds[rightIndex]
        )
      ) {
        return true
      }
    }
  }

  return false
}

const buildDashedCenterCollapsedRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions
) =>
  buildCollapsedRenderEntry(
    faces,
    options,
    'dashed-center-union',
    'exact-union'
  )

const getFinalFaceGroupByIndexes = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  indexes: number[]
) =>
  indexes.flatMap((index) => {
    const face = faces[index]
    return face ? [face] : []
  })

const buildInsideConstrainedDashedMaskedDescriptorRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  entries: SolidCenterStrokeComputedRenderEntry[],
  groupKey: string,
  hasLegalDomains: boolean
): SolidCenterStrokeComputedRenderEntry[] | null => {
  if (!hasLegalDomains || entries.length < 2) {
    return null
  }

  const descriptorEntries = entries.filter(
    (entry) =>
      (entry.strokePathGroups?.length ?? 0) > 0 ||
      (entry.strokePaths?.length ?? 0) > 0
  )
  const canonicalEntries = entries.filter(canCompositePolygonRenderEntry)
  if (
    descriptorEntries.length !== 1 ||
    canonicalEntries.length === 0 ||
    descriptorEntries.length + canonicalEntries.length !== entries.length
  ) {
    return null
  }

  const descriptorEntry = descriptorEntries[0]
  if (
    !descriptorEntry.fillClipPolygons?.length ||
    descriptorEntry.clipPolygons?.length ||
    descriptorEntry.fillExcludePolygons?.length ||
    descriptorEntry.fillPolygons?.length ||
    entries.some(
      (entry) =>
        (entry.debugMeta?.strokePosition ??
          entry.runtimeMeta.strokePosition) !== 'inside'
    ) ||
    entries.some(
      (entry) =>
        getRenderEntryPaintSignature(entry) !==
        getRenderEntryPaintSignature(descriptorEntry)
    )
  ) {
    return null
  }

  const descriptorEntryIndex = entries.indexOf(descriptorEntry)
  const descriptorFace = faces[descriptorEntryIndex]
  if (!descriptorFace) {
    return null
  }

  const productIdentity = getMergedFinalFaceOutputProductIdentity(faces)
  const runtimeIdentity = getMergedFinalFaceRuntimeIdentity(faces)
  const productContractDebugMeta = buildProductContractDebugMetaFromFinalFace(
    descriptorFace,
    {
      ownerStepIds: productIdentity.ownerStepIds,
      intervalIds: productIdentity.intervalIds,
      terminalRoles: productIdentity.terminalRoles,
      seamBoundaryIds: productIdentity.seamBoundaryIds,
      sourceSpanIds: productIdentity.sourceSpanIds,
      sourceNetworkIds: productIdentity.sourceNetworkIds,
      sourceContourIds: productIdentity.sourceContourIds,
      legalDomainIds: productIdentity.legalDomainIds,
      domainPlanSplitRangeTerminals: flatMapUniqueArrayReferences(
        faces.map((face) => face.debugMeta?.domainPlanSplitRangeTerminals)
      ),
      dashProductIntervals: getUniqueDashProductIntervalsForRenderArray(
        flatMapUniqueArrayReferences(
          faces.map((face) =>
            getRenderDebugMetaDashProductIntervals(
              face.debugMeta,
              face.intervalIds
            )
          )
        )
      ),
      dashBodySeamBoundaries: flatMapUniqueArrayReferences(
        faces.map((face) => face.debugMeta?.dashBodySeamBoundaries)
      ),
      dashEndpointCapPolicySignatures: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map(
            (face) => face.debugMeta?.dashEndpointCapPolicySignatures
          )
        )
      ),
      dashEndpointCapPolicyTerminalRoles: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map(
            (face) => face.debugMeta?.dashEndpointCapPolicyTerminalRoles
          )
        )
      ) as NonNullable<
        SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
      >,
      joinOwnershipRecords: getUniqueJoinOwnershipRecords(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.joinOwnershipRecords)
        )
      ),
      joinOwnershipSignatures: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.joinOwnershipSignatures)
        )
      ),
      smoothContinuityGroupIds: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.smoothContinuityGroupIds)
        )
      ),
      domainPlanBoundaryRoles: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.domainPlanBoundaryRoles)
        )
      ) as NonNullable<
        SolidCenterStrokeGeometryDebugMeta['domainPlanBoundaryRoles']
      >,
      domainPlanSplitRangeIds: getUniqueStrings(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.domainPlanSplitRangeIds)
        )
      ),
      domainPlanSelectedSides: Array.from(
        new Set(
          flatMapUniqueArrayReferences(
            faces.map((face) => face.debugMeta?.domainPlanSelectedSides)
          )
        )
      ),
      domainPlanSourceSegmentIndexes: Array.from(
        new Set(
          flatMapUniqueArrayReferences(
            faces.map(
              (face) => face.debugMeta?.domainPlanSourceSegmentIndexes
            )
          )
        )
      ),
      physicalSpanRanges: getUniquePhysicalSpanRangesForRenderArray(
        flatMapUniqueArrayReferences(
          faces.map((face) => face.debugMeta?.physicalSpanRanges)
        )
      ),
      productEvidenceEnvelope: productIdentity.productEvidenceEnvelope
    }
  )
  const visibleCanonicalMaskPolygons = canonicalEntries.flatMap(
    (entry) => entry.polygons
  )
  const strokeMaskPolygons = [
    ...(descriptorEntry.strokeMaskPolygons ?? []),
    ...visibleCanonicalMaskPolygons
  ]
  if (strokeMaskPolygons.length === 0) {
    return null
  }

  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-inside-masked-descriptor-composite'
  )
  return [
    {
      ...descriptorEntry,
      cacheKey: `render:constrained-dashed-inside-masked-descriptor:${groupKey}:${faces
        .map((face) => face.faceId)
        .join('|')}`,
      productIdentity,
      polygons: faces.flatMap((face) => face.polygons),
      strokeMaskPolygons,
      runtimeMeta: {
        ...descriptorEntry.runtimeMeta,
        ...runtimeIdentity,
        ownerStage: 'Product Output render-entry materialization',
        routeId: 'constrained-dashed-inside-mask-descriptor',
        visibleContributor: 'visible strokePathGroups',
        geometryBasis: 'declared route product contract',
        intervalIds: productIdentity.intervalIds,
        sourceSpanIds: productIdentity.sourceSpanIds,
        sourceNetworkIds: productIdentity.sourceNetworkIds,
        sourceContourIds: productIdentity.sourceContourIds,
        legalDomainIds: productIdentity.legalDomainIds,
        visualOverlapCollapseStatus: 'render-projection-merged'
      },
      debugMeta: {
        ...productContractDebugMeta,
        ownerStepIds: productIdentity.ownerStepIds,
        intervalIds: productIdentity.intervalIds,
        terminalRoles: productIdentity.terminalRoles,
        seamBoundaryIds: productIdentity.seamBoundaryIds,
        sourceSpanIds: productIdentity.sourceSpanIds,
        sourceNetworkIds: productIdentity.sourceNetworkIds,
        sourceContourIds: productIdentity.sourceContourIds,
        legalDomainIds: productIdentity.legalDomainIds,
        productEvidenceEnvelope: productIdentity.productEvidenceEnvelope,
        visualOverlapCollapseStatus: 'render-projection-merged',
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: getUniqueStrings(
          faces.flatMap((face) => face.sourceGeometryIds)
        )
      },
      preferSolidGraphics: false
    }
  ]
}

const collapseConstrainedDashedFinalFaceRenderEntries = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions,
  groupKey: string
) => {
  const entries = measureStrokeRenderEntryPhase(
    'render entries: constrained dashed face projection',
    () => faces.map((face) => buildRenderEntryFromFinalFace(face, options))
  )
  const entryByFace = new Map(
    faces.flatMap((face, index) => {
      const entry = entries[index]
      return entry ? [[face, entry] as const] : []
    })
  )
  const getEntriesForFaces = (selectedFaces: typeof faces) =>
    selectedFaces.flatMap((face) => {
      const entry = entryByFace.get(face)
      return entry ? [entry] : []
    })
  const isSmoothContinuityFace = (
    face: StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >
  ) =>
    face.debugMeta?.visibleContributor === 'smooth-continuity-dash-body' ||
    face.debugMeta?.ownerStage ===
      'Stroke Geometry smooth-continuity product assembly' ||
    face.debugMeta?.smoothContinuityGroupId !== undefined ||
    (face.debugMeta?.smoothContinuityGroupIds?.length ?? 0) > 0

  const visibleDescriptorEntries = entries.filter(
    (entry) =>
      (entry.strokePathGroups?.length ?? 0) > 0 ||
      (entry.strokePaths?.length ?? 0) > 0
  )
  const canonicalEntries = entries.filter(canCompositePolygonRenderEntry)
  const insideMaskedDescriptorEntries =
    buildInsideConstrainedDashedMaskedDescriptorRenderEntry(
      faces,
      entries,
      groupKey,
      (options.legalDomains?.length ?? 0) > 0
    )
  if (insideMaskedDescriptorEntries) {
    return insideMaskedDescriptorEntries
  }
  const shouldBatchInsideCanonicalEntries =
    (options.legalDomains?.length ?? 0) > 0 &&
    visibleDescriptorEntries.length > 0 &&
    canonicalEntries.length > 1 &&
    visibleDescriptorEntries.length + canonicalEntries.length ===
      entries.length &&
    entries.every(
      (entry) =>
        (entry.debugMeta?.strokePosition ??
          entry.runtimeMeta.strokePosition) === 'inside'
    ) &&
    entries.every(
      (entry) =>
        getRenderEntryPaintSignature(entry) ===
        getRenderEntryPaintSignature(entries[0] as typeof entry)
    )
  if (shouldBatchInsideCanonicalEntries) {
    const mergedCanonicalEntries = measureStrokeRenderEntryPhase(
      'render entries: constrained dashed canonical batch',
      () =>
        mergeSamePaintPolygonRenderEntries(
          canonicalEntries,
          `constrained-dashed-inside-canonical-batch:${groupKey}`,
          'render-projection-merged',
          options
        )
    )
    if (mergedCanonicalEntries.length === 1) {
      const firstCanonicalEntry = canonicalEntries[0]
      return entries.flatMap((entry) =>
        entry === firstCanonicalEntry
          ? mergedCanonicalEntries
          : canCompositePolygonRenderEntry(entry)
            ? []
            : [entry]
      )
    }
  }

  const overlappingGroupIndexes = measureStrokeRenderEntryPhase(
    'render entries: constrained dashed overlap groups',
    () => findSamePaintOverlappingPolygonRenderEntryGroupIndexes(entries, options)
  )

  return measureStrokeRenderEntryPhase(
    'render entries: constrained dashed group materialization',
    () => overlappingGroupIndexes.flatMap((indexes) => {
    const faceGroup = getFinalFaceGroupByIndexes(faces, indexes)
    const entryGroup = getRenderEntryGroupByIndexes(entries, indexes)
    const hasSourceVertexJoinFace = faceGroup.some(
      isConstrainedDashedSourceVertexJoinProductFace
    )
    const smoothContinuityFaces = faceGroup.filter(isSmoothContinuityFace)
    const nonSmoothContinuityFaces = faceGroup.filter(
      (face) => !isSmoothContinuityFace(face)
    )
    const terminalBodyFaces = faceGroup.filter(
      isConstrainedDashedTerminalBodyProductFace
    )
    const nonTerminalNonSmoothContinuityFaces = nonSmoothContinuityFaces.filter(
      (face) => !isConstrainedDashedTerminalBodyProductFace(face)
    )
    const hasSmoothContinuityFace = smoothContinuityFaces.length > 0
    const hasLegalDomains = (options.legalDomains?.length ?? 0) > 0
    const hasTerminalIdentityFace = faceGroup.some((face) =>
      hasTerminalDashProductIdentity(face.debugMeta)
    )

    if (hasSourceVertexJoinFace && hasLegalDomains) {
      return mergeSamePaintPolygonRenderEntries(
        entryGroup,
        `constrained-dashed-source-vertex-join:${groupKey}:${indexes.join(',')}:post-legality`,
        'render-projection-merged',
        options
      )
    }

    if (hasSmoothContinuityFace && hasLegalDomains) {
      const nonSmoothEntries =
        nonTerminalNonSmoothContinuityFaces.length > 0
          ? buildCollapsedRenderEntry(
              nonTerminalNonSmoothContinuityFaces,
              options,
              `constrained-dashed-same-paint:${groupKey}:${indexes.join(',')}:non-smooth`,
              'render-projection-merged',
              'nonzero',
              {
                collapseSingleFace: true,
                clipToLegalDomains: true,
                clipToSourceCoverage: true,
                finalUnion: false,
                allowSharedEdgeLoopMerge: true,
                projection: 'union',
                preservePostLegalEndpointCanonicalization: true,
                reclipToLegalDomainsAfterSourceCoverage: hasLegalDomains,
                requirePostLegalCoverageEquivalence: hasLegalDomains,
                allowPostLegalCoverageReduction: hasLegalDomains
              }
            )
          : []
      const terminalBodyEntries = getEntriesForFaces(terminalBodyFaces)
      const nonSmoothCompositeEntries =
        nonSmoothEntries.length > 0 && terminalBodyEntries.length > 0
          ? mergeSamePaintPolygonRenderEntries(
              [...nonSmoothEntries, ...terminalBodyEntries],
              `constrained-dashed-same-paint:${groupKey}:${indexes.join(',')}:non-smooth-terminal`,
              'render-projection-merged',
              options
            )
          : [...nonSmoothEntries, ...terminalBodyEntries]
      const smoothEntries =
        smoothContinuityFaces.length > 1
          ? buildCollapsedRenderEntry(
              smoothContinuityFaces,
              options,
              `constrained-dashed-same-paint:${groupKey}:${indexes.join(',')}:smooth`,
              'render-projection-merged',
              'nonzero',
              {
                finalUnion: false,
                allowSharedEdgeLoopMerge: true,
                projection: 'shared-edge',
                preservePostLegalEndpointCanonicalization: true
              }
            )
          : getEntriesForFaces(smoothContinuityFaces)

      return [...nonSmoothCompositeEntries, ...smoothEntries]
    }

    if (hasSourceVertexJoinFace && faceGroup.length > 1) {
      return mergeSamePaintPolygonRenderEntries(
        entryGroup,
        `constrained-dashed-source-vertex-join:${groupKey}:${indexes.join(',')}`,
        'render-projection-merged',
        options
      )
    }

    if (entryGroup.length > 1 && hasLegalDomains && !hasSmoothContinuityFace) {
      if (hasTerminalIdentityFace) {
        return mergeSamePaintPolygonRenderEntries(
          entryGroup,
          `constrained-dashed-same-paint:${groupKey}:${indexes.join(',')}:post-legality-terminal`,
          'render-projection-merged',
          options
        )
      }
      return buildCollapsedRenderEntry(
        faceGroup,
        options,
        `constrained-dashed-same-paint:${groupKey}:${indexes.join(',')}`,
        'render-projection-merged',
        'nonzero',
        {
          clipToLegalDomains: true,
          clipToSourceCoverage: true,
          finalUnion: false,
          allowSharedEdgeLoopMerge: true,
          reclipToLegalDomainsAfterSourceCoverage: true,
          requirePostLegalCoverageEquivalence: true,
          allowPostLegalCoverageReduction: true
        }
      )
    }

    if (entryGroup.length > 1) {
      return mergeSamePaintPolygonRenderEntries(
        entryGroup,
        `constrained-dashed-same-paint:${groupKey}`,
        'render-projection-merged',
        options
      )
    }

    return entryGroup
    })
  )
}

const getRenderDescriptorStrokePathGroups = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined
): NonNullable<SolidCenterStrokeRenderDescriptor['strokePathGroups']> => {
  if (!descriptor) {
    return []
  }

  const groups = descriptor.strokePathGroups ?? []
  const rootGroup =
    descriptor.strokePaths && descriptor.strokePaths.length > 0
      ? [
          {
            strokePaths: descriptor.strokePaths,
            strokePathStyle: descriptor.strokePathStyle
          }
        ]
      : []

  return [...rootGroup, ...groups]
}

const canBuildDashedCenterDescriptorRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.length > 0 &&
  faces.every((face) => {
    const descriptor = face.renderDescriptor as
      | SolidCenterStrokeRenderDescriptor
      | undefined
    return (
      isDashedCenterProductFace(face) &&
      face.paint.alpha >= 1 - 1e-6 &&
      getRenderDescriptorStrokePathGroups(descriptor).length > 0 &&
      !descriptor?.clipPolygons?.length &&
      !descriptor?.fillClipPolygons?.length &&
      !descriptor?.fillPolygons?.length &&
      !descriptor?.strokeMaskPolygons?.length
    )
  })

const buildDashedCenterDescriptorRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => {
  const [primaryFace] = faces
  if (!primaryFace) {
    return []
  }

  const sourceGeometryIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceGeometryIds)
  )
  const mergedProductIdentity = getMergedFinalFaceRuntimeIdentity(faces)
  const outputProductIdentity = getMergedFinalFaceOutputProductIdentity(faces)
  const intervalIds = getUniqueStrings(
    faces.flatMap((face) => face.intervalIds)
  )
  const sourceSpanIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceSpanIds)
  )
  const sourceNetworkIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceNetworkIds)
  )
  const sourceContourIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceContourIds)
  )
  const legalDomainIds = getUniqueStrings(
    faces.flatMap((face) => face.legalDomainIds)
  )
  const domainPlanSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.domainPlanSplitRangeTerminals ?? []
  )
  const dashProductIntervals = getUniqueDashProductIntervalsForRenderArray(
    faces.flatMap((face) =>
      getRenderDebugMetaDashProductIntervals(face.debugMeta, face.intervalIds)
    )
  )
  const dashEndpointCapPolicySignatures = getUniqueStrings(
    faces.flatMap(
      (face) => face.debugMeta?.dashEndpointCapPolicySignatures ?? []
    )
  )
  const dashEndpointCapPolicyTerminalRoles = getUniqueStrings(
    faces.flatMap(
      (face) => face.debugMeta?.dashEndpointCapPolicyTerminalRoles ?? []
    )
  ) as NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
  >
  const joinOwnershipRecords = getUniqueJoinOwnershipRecords(
    faces.flatMap((face) => face.debugMeta?.joinOwnershipRecords ?? [])
  )
  const joinOwnershipSignatures = getUniqueStrings(
    faces.flatMap((face) => face.debugMeta?.joinOwnershipSignatures ?? [])
  )
  const smoothContinuityGroupIds = getUniqueStrings(
    faces.flatMap((face) => face.debugMeta?.smoothContinuityGroupIds ?? [])
  )
  const physicalSpanRanges = getUniquePhysicalSpanRangesForRenderArray(
    faces.flatMap((face) => face.debugMeta?.physicalSpanRanges ?? [])
  )
  const strokePathGroups = faces.flatMap((face) =>
    getRenderDescriptorStrokePathGroups(
      face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
    )
  )
  const debugMeta = shouldEmitFullStrokeDiagnostics()
    ? {
        ...primaryFace.debugMeta,
        ownerStepIds: mergedProductIdentity.ownerStepIds,
        intervalIds,
        terminalRoles: mergedProductIdentity.terminalRoles,
        seamBoundaryIds: mergedProductIdentity.seamBoundaryIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        domainPlanSplitRangeTerminals:
          domainPlanSplitRangeTerminals.length > 0
            ? domainPlanSplitRangeTerminals
            : undefined,
        dashProductIntervals:
          dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
        dashEndpointCapPolicySignatures:
          dashEndpointCapPolicySignatures.length > 0
            ? dashEndpointCapPolicySignatures
            : undefined,
        dashEndpointCapPolicyTerminalRoles:
          dashEndpointCapPolicyTerminalRoles.length > 0
            ? dashEndpointCapPolicyTerminalRoles
            : undefined,
        joinOwnershipRecords:
          joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
        joinOwnershipSignatures:
          joinOwnershipSignatures.length > 0
            ? joinOwnershipSignatures
            : undefined,
        smoothContinuityGroupIds:
          smoothContinuityGroupIds.length > 0
            ? smoothContinuityGroupIds
            : undefined,
        physicalSpanRanges:
          physicalSpanRanges.length > 0 ? physicalSpanRanges : undefined,
        productEvidenceEnvelope: outputProductIdentity.productEvidenceEnvelope,
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: sourceGeometryIds
      }
    : buildProductContractDebugMetaFromFinalFace(primaryFace, {
        ownerStepIds: mergedProductIdentity.ownerStepIds,
        intervalIds,
        terminalRoles: mergedProductIdentity.terminalRoles,
        seamBoundaryIds: mergedProductIdentity.seamBoundaryIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        domainPlanSplitRangeTerminals:
          domainPlanSplitRangeTerminals.length > 0
            ? domainPlanSplitRangeTerminals
            : undefined,
        dashProductIntervals:
          dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
        dashEndpointCapPolicySignatures:
          dashEndpointCapPolicySignatures.length > 0
            ? dashEndpointCapPolicySignatures
            : undefined,
        dashEndpointCapPolicyTerminalRoles:
          dashEndpointCapPolicyTerminalRoles.length > 0
            ? dashEndpointCapPolicyTerminalRoles
            : undefined,
        joinOwnershipRecords:
          joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
        joinOwnershipSignatures:
          joinOwnershipSignatures.length > 0
            ? joinOwnershipSignatures
            : undefined,
        smoothContinuityGroupIds:
          smoothContinuityGroupIds.length > 0
            ? smoothContinuityGroupIds
            : undefined,
        physicalSpanRanges:
          physicalSpanRanges.length > 0 ? physicalSpanRanges : undefined,
        productEvidenceEnvelope: outputProductIdentity.productEvidenceEnvelope,
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: sourceGeometryIds
      })

  return [
    {
      cacheKey: `render:dashed-center-descriptor:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      productIdentity: outputProductIdentity,
      stroke: {
        kind: primaryFace.paint.kind,
        color: primaryFace.paint.color,
        alpha: primaryFace.paint.alpha,
        gradientStyle: primaryFace.paint.gradientStyle ?? null,
        paintKey:
          primaryFace.paint.paintKey ??
          `solid:${primaryFace.paint.color}:${primaryFace.paint.alpha}`
      },
      polygons: faces.flatMap((face) => face.polygons),
      fillPolygons: undefined,
      clipPolygons: undefined,
      fillClipPolygons: undefined,
      fillExcludePolygons: undefined,
      strokeMaskPolygons: undefined,
      strokePathGroups,
      strokePaths: undefined,
      preferSolidGraphics: false,
      strokePathStyle: (
        primaryFace.renderDescriptor as
          | SolidCenterStrokeRenderDescriptor
          | undefined
      )?.strokePathStyle,
      runtimeMeta: {
        productMode: primaryFace.debugMeta?.productMode,
        productSignature: primaryFace.debugMeta?.productSignature,
        domainMode: primaryFace.debugMeta?.domainMode,
        topologyFamily: primaryFace.debugMeta?.topologyFamily,
        strokePosition: primaryFace.debugMeta?.strokePosition,
        visualOverlapCollapseStatus:
          primaryFace.debugMeta?.visualOverlapCollapseStatus,
        revisionSet: primaryFace.debugMeta?.revisionSet,
        ...mergedProductIdentity,
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds
      },
      revisionSet: primaryFace.debugMeta?.revisionSet,
      debugMeta
    }
  ]
}

const buildProjectionPacketFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  const productContractDebugMeta =
    buildProductContractDebugMetaFromFinalFace(face)
  const debugMeta = shouldEmitFullStrokeDiagnostics()
    ? face.debugMeta
    : productContractDebugMeta
  const polygons = getProjectedProductPolygonsFromFinalFace(face)
  const bounds = polygons === face.polygons ? face.bounds : getBounds(polygons)

  return {
    geometryId: getProjectedGeometryId(face),
    polygons,
    bounds,
    primaryOwner: face.ownerSet[0],
    ownerSet: face.ownerSet,
    ownerStepIds: face.ownerStepIds,
    intervalIds: face.intervalIds,
    terminalRoles: face.terminalRoles,
    seamBoundaryIds: face.seamBoundaryIds,
    sourceSpanIds: face.sourceSpanIds,
    sourceNetworkIds: face.sourceNetworkIds,
    sourceContourIds: face.sourceContourIds,
    legalDomainIds: face.legalDomainIds,
    ...(face.productEvidenceEnvelope
      ? { productEvidenceEnvelope: face.productEvidenceEnvelope }
      : {}),
    ...(debugMeta ? { debugMeta } : {})
  }
}

const buildProjectedPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => faces.map(buildProjectionPacketFromFinalFace)

const buildProjectedHitTestPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): SolidCenterStrokeHitTestPacket[] =>
  buildProjectedPacketsFromFinalFaces(faces).map((packet) => ({
    ...packet,
    channel: 'hit-test',
    visibility: 'hit-export'
  }))

const buildProjectedExportPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): SolidCenterStrokeExportPacket[] =>
  buildProjectedPacketsFromFinalFaces(faces).map((packet) => ({
    ...packet,
    channel: 'export',
    visibility: 'hit-export'
  }))

const collapseDashedCenterRenderEntries = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions
) => {
  const output: ReturnType<typeof buildRenderEntryFromFinalFace>[][] = []
  const dashedGroups = new Map<
    string,
    StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >[]
  >()
  const dashedGroupSlots = new Map<string, number>()
  const constrainedDashedGroups = new Map<
    string,
    StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >[]
  >()
  const constrainedDashedGroupSlots = new Map<string, number>()

  faces.forEach((face) => {
    const constrainedDashedGroupKey = getConstrainedDashedRenderGroupKey(face)
    if (constrainedDashedGroupKey) {
      const group = constrainedDashedGroups.get(constrainedDashedGroupKey) ?? []
      group.push(face)
      constrainedDashedGroups.set(constrainedDashedGroupKey, group)

      if (!constrainedDashedGroupSlots.has(constrainedDashedGroupKey)) {
        constrainedDashedGroupSlots.set(
          constrainedDashedGroupKey,
          output.length
        )
        output.push([])
      }
      return
    }

    const dashedCenterGroupKey = getDashedCenterRenderGroupKey(face)
    if (dashedCenterGroupKey) {
      const group = dashedGroups.get(dashedCenterGroupKey) ?? []
      group.push(face)
      dashedGroups.set(dashedCenterGroupKey, group)

      if (!dashedGroupSlots.has(dashedCenterGroupKey)) {
        dashedGroupSlots.set(dashedCenterGroupKey, output.length)
        output.push([])
      }
      return
    }

    output.push([buildRenderEntryFromFinalFace(face, options)])
  })

  const constrainedDashedGroupSizes = Array.from(
    constrainedDashedGroups.values(),
    (group) => group.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-face-count',
    constrainedDashedGroupSizes.reduce((count, size) => count + size, 0)
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-group-count',
    constrainedDashedGroupSizes.length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-singleton-group-count',
    constrainedDashedGroupSizes.filter((size) => size === 1).length
  )
  emitStrokePipelineCounter(
    'render-entry-constrained-dashed-max-group-size',
    Math.max(0, ...constrainedDashedGroupSizes)
  )

  dashedGroups.forEach((group, groupKey) => {
    const slot = dashedGroupSlots.get(groupKey)
    if (slot !== undefined) {
      output[slot] = canBuildDashedCenterDescriptorRenderEntry(group)
        ? buildDashedCenterDescriptorRenderEntry(group)
        : buildDashedCenterCollapsedRenderEntry(group, options)
    }
  })
  constrainedDashedGroups.forEach((group, groupKey) => {
    const slot = constrainedDashedGroupSlots.get(groupKey)
    if (slot !== undefined) {
      output[slot] = collapseConstrainedDashedFinalFaceRenderEntries(
        group,
        options,
        groupKey
      )
    }
  })
  return output.flat()
}

export const buildSolidCenterStrokeResolvedPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): SolidCenterStrokeResolvedPacket[] =>
  faces.map((face) => {
    const geometryId = getProjectedGeometryId(face)
    const debugMeta = {
      ...face.debugMeta,
      ownerSet: face.ownerSet,
      intervalIds: face.intervalIds,
      sourceSpanIds: face.sourceSpanIds,
      sourceNetworkIds: face.sourceNetworkIds,
      sourceContourIds: face.sourceContourIds,
      legalDomainIds: face.legalDomainIds
    }

    return {
      geometry: {
        geometryId,
        polygons: face.polygons,
        bounds: face.bounds,
        debugMeta,
        renderDescriptor: face.renderDescriptor as
          | SolidCenterStrokeRenderDescriptor
          | undefined
      },
      paint: {
        ...face.paint,
        geometryId
      }
    }
  })

export const buildSolidCenterStrokeHitTestPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): SolidCenterStrokeHitTestPacket[] => {
  if (shouldEmitFullStrokeDiagnostics()) {
    return buildProjectedHitTestPacketsFromFinalFaces(faces)
  }
  const cached = hitPacketCache.get(faces)
  if (cached) {
    return cached
  }

  const packets = buildProjectedHitTestPacketsFromFinalFaces(faces)
  hitPacketCache.set(faces, packets)
  return packets
}

export const buildSolidCenterStrokeHitTestPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeHitTestPacket[] =>
  buildSolidCenterStrokeHitTestPacketsFromFinalFaces(
    buildSolidCenterStrokeFinalFaces(packets)
  )

export const buildSolidCenterStrokeExportPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): SolidCenterStrokeExportPacket[] => {
  if (shouldEmitFullStrokeDiagnostics()) {
    return buildProjectedExportPacketsFromFinalFaces(faces)
  }
  const cached = exportPacketCache.get(faces)
  if (cached) {
    return cached
  }

  const packets = buildProjectedExportPacketsFromFinalFaces(faces)
  exportPacketCache.set(faces, packets)
  return packets
}

export const buildSolidCenterStrokeExportPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeExportPacket[] =>
  buildSolidCenterStrokeExportPacketsFromFinalFaces(
    buildSolidCenterStrokeFinalFaces(packets)
  )

const pickVisibleRenderDescriptor = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined
): SolidCenterStrokeVisibleRenderDescriptor | undefined => {
  if (!descriptor) {
    return undefined
  }

  const visibleDescriptor: SolidCenterStrokeVisibleRenderDescriptor = {}
  if (descriptor.fillPolygons) {
    visibleDescriptor.fillPolygons = descriptor.fillPolygons
  }
  if (descriptor.clipPolygons) {
    visibleDescriptor.clipPolygons = descriptor.clipPolygons
  }
  if (descriptor.fillClipPolygons) {
    visibleDescriptor.fillClipPolygons = descriptor.fillClipPolygons
  }
  if (descriptor.fillExcludePolygons) {
    visibleDescriptor.fillExcludePolygons = descriptor.fillExcludePolygons
  }
  if (descriptor.strokeMaskPolygons) {
    visibleDescriptor.strokeMaskPolygons = descriptor.strokeMaskPolygons
  }
  if (descriptor.strokePaths) {
    visibleDescriptor.strokePaths = descriptor.strokePaths
  }
  if (descriptor.strokePathGroups) {
    visibleDescriptor.strokePathGroups = descriptor.strokePathGroups
  }
  if (descriptor.strokePathStyle) {
    visibleDescriptor.strokePathStyle = descriptor.strokePathStyle
  }

  return Object.keys(visibleDescriptor).length > 0
    ? visibleDescriptor
    : undefined
}

const getDescriptorRouteMode = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
): SolidCenterStrokeVisibleRenderPacket['descriptorRouteMode'] =>
  pickVisibleRenderDescriptor(
    face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
  )
    ? 'descriptor-visible-route'
    : 'canonical-product'

const getHitExportEquivalenceReason = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
): SolidCenterStrokeChannelHitTestPacket['equivalenceReason'] =>
  face.renderDescriptor
    ? 'descriptor-evidence-projection'
    : 'same-final-face-product'

const buildVisibleRenderPacketFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
): SolidCenterStrokeVisibleRenderPacket => {
  const polygons = face.polygons
  const debugMeta = buildProductContractDebugMetaFromFinalFace(face)
  const renderDescriptor = pickVisibleRenderDescriptor(
    face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
  )
  return {
    channel: 'render',
    visibility: 'visible',
    geometryId: getProjectedGeometryId(face),
    polygons,
    bounds: face.bounds,
    stroke: {
      kind: face.paint.kind,
      color: face.paint.color,
      alpha: face.paint.alpha,
      gradientStyle: face.paint.gradientStyle ?? null,
      paintKey:
        face.paint.paintKey ?? `solid:${face.paint.color}:${face.paint.alpha}`
    },
    primaryOwner: face.ownerSet[0],
    ownerSet: face.ownerSet,
    ownerStepIds: face.ownerStepIds,
    intervalIds: face.intervalIds,
    terminalRoles: face.terminalRoles,
    seamBoundaryIds: face.seamBoundaryIds,
    sourceSpanIds: face.sourceSpanIds,
    sourceNetworkIds: face.sourceNetworkIds,
    sourceContourIds: face.sourceContourIds,
    legalDomainIds: face.legalDomainIds,
    ...(face.productEvidenceEnvelope
      ? { productEvidenceEnvelope: face.productEvidenceEnvelope }
      : {}),
    descriptorRouteMode: getDescriptorRouteMode(face),
    ...(renderDescriptor ? { renderDescriptor } : {}),
    ...(debugMeta ? { debugMeta } : {})
  }
}

const buildDiagnosticPacketFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
): SolidCenterStrokeDiagnosticPacket | null => {
  const descriptor = face.renderDescriptor as
    | SolidCenterStrokeRenderDescriptor
    | undefined
  if (
    !descriptor ||
    (!descriptor.descriptorProductPolygons &&
      !descriptor.fillClipPolygons &&
      !descriptor.fillExcludePolygons)
  ) {
    return null
  }

  const evidenceChannel: SolidCenterStrokeDiagnosticPacket['evidenceChannel'] =
    {}
  if (descriptor.descriptorProductPolygons) {
    evidenceChannel.descriptorProductPolygons =
      descriptor.descriptorProductPolygons
  }
  if (descriptor.fillClipPolygons) {
    evidenceChannel.fillClipPolygons = descriptor.fillClipPolygons
  }
  if (descriptor.fillExcludePolygons) {
    evidenceChannel.fillExcludePolygons = descriptor.fillExcludePolygons
  }

  const debugMeta = buildProductContractDebugMetaFromFinalFace(face)
  return {
    channel: 'diagnostic',
    visibility: 'non-visible',
    diagnosticKind: 'descriptor-evidence',
    geometryId: getProjectedGeometryId(face),
    sourceProductOwner: face.ownerSet[0],
    descriptorRouteMode: getDescriptorRouteMode(face),
    evidenceChannel,
    ...(debugMeta ? { debugMeta } : {})
  }
}

export const emitSolidCenterStrokeProductOutputPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeProductOutputOptions = {}
): SolidCenterStrokeProductOutputPackets => ({
  renderPackets: faces.map(buildVisibleRenderPacketFromFinalFace),
  hitTestPackets: buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces).map(
    (packet, index) => ({
      ...packet,
      channel: 'hit-test',
      visibility: 'hit-export',
      equivalenceReason: getHitExportEquivalenceReason(faces[index])
    })
  ),
  exportPackets: buildSolidCenterStrokeExportPacketsFromFinalFaces(faces).map(
    (packet, index) => ({
      ...packet,
      channel: 'export',
      visibility: 'hit-export',
      equivalenceReason: getHitExportEquivalenceReason(faces[index])
    })
  ),
  diagnosticPackets: options.includeDiagnostics
    ? faces.flatMap((face) => {
        const packet = buildDiagnosticPacketFromFinalFace(face)
        return packet ? [packet] : []
      })
    : []
})

const hasVisibleDescriptorPathRoute = (
  descriptor: SolidCenterStrokeVisibleRenderDescriptor | undefined
) =>
  (descriptor?.strokePathGroups?.length ?? 0) > 0 ||
  (descriptor?.strokePaths?.length ?? 0) > 0

const getRenderEntryEvidenceReason = (
  packet: SolidCenterStrokeVisibleRenderPacket
): SolidCenterStrokePacketRenderEntry['evidenceChannel']['reason'] =>
  packet.descriptorRouteMode === 'canonical-product'
    ? 'canonical-visible-product'
    : hasVisibleDescriptorPathRoute(packet.renderDescriptor)
      ? 'descriptor-visible-route'
      : 'descriptor-evidence-only'

const buildRenderEntryFromVisibleRenderPacket = (
  packet: SolidCenterStrokeVisibleRenderPacket
): SolidCenterStrokePacketRenderEntry => {
  const descriptor = packet.renderDescriptor
  const hasVisibleDescriptorRoute = hasVisibleDescriptorPathRoute(descriptor)
  const strokeMaskPolygons =
    packet.descriptorRouteMode === 'canonical-product'
      ? packet.polygons
      : hasVisibleDescriptorRoute
        ? undefined
        : descriptor?.strokeMaskPolygons

  return {
    channel: 'render-entry',
    visibility: 'visible',
    cacheKey: packet.geometryId,
    stroke: packet.stroke,
    polygons: packet.polygons,
    ...(strokeMaskPolygons ? { strokeMaskPolygons } : {}),
    ...(descriptor?.strokePaths ? { strokePaths: descriptor.strokePaths } : {}),
    ...(descriptor?.strokePathGroups
      ? { strokePathGroups: descriptor.strokePathGroups }
      : {}),
    ...(descriptor?.strokePathStyle
      ? { strokePathStyle: descriptor.strokePathStyle }
      : {}),
    ...(descriptor?.fillPolygons
      ? { fillPolygons: descriptor.fillPolygons }
      : {}),
    ...(descriptor?.clipPolygons
      ? { clipPolygons: descriptor.clipPolygons }
      : {}),
    ...(descriptor?.fillClipPolygons
      ? { fillClipPolygons: descriptor.fillClipPolygons }
      : {}),
    ...(descriptor?.fillExcludePolygons
      ? { fillExcludePolygons: descriptor.fillExcludePolygons }
      : {}),
    evidenceChannel: {
      descriptorProductPolygonsVisible: false,
      reason: getRenderEntryEvidenceReason(packet)
    },
    productIdentity: {
      primaryOwner: packet.primaryOwner,
      ownerSet: [...packet.ownerSet],
      ownerStepIds: [...packet.ownerStepIds],
      intervalIds: [...packet.intervalIds],
      terminalRoles: [...packet.terminalRoles],
      seamBoundaryIds: [...packet.seamBoundaryIds],
      sourceSpanIds: [...packet.sourceSpanIds],
      sourceNetworkIds: [...packet.sourceNetworkIds],
      sourceContourIds: [...packet.sourceContourIds],
      legalDomainIds: [...packet.legalDomainIds],
      ...(packet.productEvidenceEnvelope
        ? { productEvidenceEnvelope: packet.productEvidenceEnvelope }
        : {})
    },
    ...(packet.debugMeta ? { debugMeta: packet.debugMeta } : {})
  }
}

export const buildSolidCenterStrokeRenderEntriesFromRenderPackets = (
  packets: readonly SolidCenterStrokeVisibleRenderPacket[]
): SolidCenterStrokePacketRenderEntry[] =>
  packets.map(buildRenderEntryFromVisibleRenderPacket)

const defineLazySolidCenterStrokeExportPackets = <T extends object>(
  graphic: T,
  getPackets: () => SolidCenterStrokeExportPacket[]
) => {
  let cachedPackets: SolidCenterStrokeExportPacket[] | null = null

  Object.defineProperty(graphic, '__asyraSolidCenterStrokeExportPackets', {
    configurable: true,
    enumerable: false,
    get: () => {
      cachedPackets ??= getPackets()
      return cachedPackets
    },
    set: (packets: SolidCenterStrokeExportPacket[] | undefined) => {
      cachedPackets = packets ?? []
    }
  })
}

export const toSolidCenterStrokeRenderEntriesFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions = {}
) => {
  emitConstrainedDashedRenderDescriptorRouteCounters(faces)
  const hasRenderEntryLegalDomains = (options.legalDomains?.length ?? 0) > 0
  const hasConstrainedDashedSourceVertexJoinFace = faces.some(
    isConstrainedDashedSourceVertexJoinProductFace
  )
  const shouldUsePureConstrainedDashedDescriptorEntries =
    canUsePureConstrainedDashedDescriptorRenderEntries(faces) &&
    !(hasRenderEntryLegalDomains && hasConstrainedDashedSourceVertexJoinFace)
  if (shouldUsePureConstrainedDashedDescriptorEntries) {
    emitStrokePipelineCounter(
      'render-entry-constrained-dashed-descriptor-route-hit'
    )
    return measureStrokeRenderEntryPhase(
      'render entries: constrained dashed descriptor route',
      () =>
        collapseSamePaintOverlappingPolygonRenderEntries(
          faces.map((face) => buildRenderEntryFromFinalFace(face, options)),
          options,
          'constrained-dashed-descriptor-route'
        )
    )
  }

  const hasConstrainedDashedProductFace = faces.some(
    isConstrainedDashedProductFace
  )
  const shouldUseConstrainedDashedDescriptorEntries =
    canUseConstrainedDashedDescriptorRenderEntries(faces)
  const shouldReuseArrangedConstrainedDashedFaces =
    hasConstrainedDashedProductFace &&
    faces.some(
      (face) =>
        isConstrainedDashedProductFace(face) &&
        face.debugMeta?.visualOverlapCollapseStatus !== undefined
    )
  const shouldPreserveTerminalIdentityBeforeRenderEntryCollapse =
    hasConstrainedDashedProductFace &&
    faces.some(
      (face) =>
        isConstrainedDashedProductFace(face) &&
        hasTerminalDashProductIdentity(face.debugMeta)
    )
  const renderFaces =
    (hasConstrainedDashedProductFace &&
      (shouldReuseArrangedConstrainedDashedFaces ||
        shouldPreserveTerminalIdentityBeforeRenderEntryCollapse)) ||
    shouldUseConstrainedDashedDescriptorEntries
      ? faces
      : measureStrokeRenderEntryPhase(
          'render entries: final face overlap collapse',
          () =>
            collapseStrokeFinalFaceVisualOverlaps(faces, {
              backend: options.exactBackend ?? getGeometryBackend(),
              legalDomains: options.legalDomains
            })
        )

  return measureStrokeRenderEntryPhase(
    'render entries: dashed/constrained collapse',
    () => collapseDashedCenterRenderEntries(renderFaces, options)
  )
}

export const toSolidCenterStrokeRenderEntries = (
  packets: SolidCenterStrokeResolvedPacket[],
  options: SolidCenterStrokeRenderEntryOptions = {}
) =>
  toSolidCenterStrokeRenderEntriesFromFinalFaces(
    buildSolidCenterStrokeFinalFaces(packets),
    options
  )

export const applySolidCenterStrokeExportPackets = <T extends object>(
  graphic: T,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  defineLazySolidCenterStrokeExportPackets(graphic, () =>
    buildSolidCenterStrokeExportPackets(packets)
  )
}

export const applySolidCenterStrokeExportPacketsFromFinalFaces = <
  T extends object
>(
  graphic: T,
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => {
  defineLazySolidCenterStrokeExportPackets(graphic, () =>
    buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)
  )
}

const createSolidCenterStrokeHitAreaFromPacketGetter = (
  getHitPackets: () => SolidCenterStrokeHitTestPacket[]
) => ({
  contains: (x: number, y: number) =>
    getHitPackets().some((packet) => {
      if (
        x < packet.bounds.minX ||
        x > packet.bounds.maxX ||
        y < packet.bounds.minY ||
        y > packet.bounds.maxY
      ) {
        return false
      }

      return packet.polygons.some((polygon) =>
        isPointInsidePolygon({ x, y }, polygon)
      )
    })
})

export const createSolidCenterStrokeHitAreaFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => {
  if (faces.length === 0) {
    return null
  }
  let cachedHitPackets: SolidCenterStrokeHitTestPacket[] | null = null
  return createSolidCenterStrokeHitAreaFromPacketGetter(() => {
    cachedHitPackets ??=
      buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces)
    return cachedHitPackets
  })
}

export const createSolidCenterStrokeHitArea = (
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  if (packets.length === 0) {
    return null
  }
  let cachedHitPackets: SolidCenterStrokeHitTestPacket[] | null = null
  const getHitPackets = () => {
    cachedHitPackets ??= buildSolidCenterStrokeHitTestPackets(packets)
    return cachedHitPackets
  }

  return createSolidCenterStrokeHitAreaFromPacketGetter(getHitPackets)
}

export interface AttachStrokePaintPayloadInput {
  geometryPackets: SolidCenterStrokeGeometryPacket[]
  paint: Omit<SolidCenterStrokePaintPacket, 'geometryId'>
}

export const attachStrokePaintPayload = (
  input: AttachStrokePaintPayloadInput
): SolidCenterStrokeResolvedPacket[] =>
  input.geometryPackets.map((geometry) => ({
    geometry,
    paint: {
      ...input.paint,
      geometryId: geometry.geometryId
    }
  }))
