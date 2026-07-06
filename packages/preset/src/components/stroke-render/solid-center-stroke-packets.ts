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
import { shouldEmitFullStrokeDiagnostics } from './stroke-diagnostics-mode'
import {
  getGeometryBackend,
  getGeometryBackendCacheSignature,
  type CandidateRegion,
  type FillRule,
  type GeometryBackend,
  type PolygonRegion
} from './geometry-backend'

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
  productMode?: string
  productSignature?: string
  routeId?: string
  domainMode?: string
  topologyFamily?: PathTopologyModel['topologyFamily'] | string
  strokePosition?: 'center' | 'inside' | 'outside'
  intervalIds?: string[]
  sourceSpanIds?: string[]
  sourceNetworkIds?: string[]
  sourceContourIds?: string[]
  legalDomainIds?: string[]
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

export interface SolidCenterStrokeHitTestPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  primaryOwner?: StrokeOwnerKey
  ownerSet: StrokeOwnerKey[]
  intervalIds: string[]
  sourceSpanIds: string[]
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeExportPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  primaryOwner?: StrokeOwnerKey
  ownerSet: StrokeOwnerKey[]
  intervalIds: string[]
  sourceSpanIds: string[]
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
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

export interface SolidCenterStrokeVisibleRenderPacket {
  channel: 'render'
  visibility: 'visible'
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  stroke: SolidCenterStrokeRenderStrokePayload
  primaryOwner?: StrokeOwnerKey
  ownerSet: StrokeOwnerKey[]
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
    seamCoveragePolicy: 'shared-step-27-endpoint-identity'
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
    previousDashBodyPoint?: Vec2
    nextDashBodyPoint?: Vec2
    stageBounds?: Record<string, Bounds | undefined>
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

const unionCoveragePolygons = (polygons: Vec2[][]) => {
  if (polygons.length <= 1) {
    return polygons
  }
  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.union) {
      return polygons
    }
    const unioned = flattenFacePolygons(
      backend.union(
        polygons.map((polygon) => ({
          polygons: [normalizeCoveragePolygonWinding(polygon)]
        })),
        'nonzero'
      ),
      polygons
    )
    return unioned.length > 0 ? unioned : polygons
  } catch {
    return polygons
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
    // Use the canonical local center-product polygon builder below; this remains Step 25 product output, not fallback semantics.
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
const RENDER_PROJECTION_CONCAVE_NOTCH_TOLERANCE = 0.2

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
      interval.terminalRole ?? 'terminal-role',
      `segment:${interval.sourceSegmentIndex}`,
      formatDashProductIntervalKeyNumber(sourceStartDistance),
      formatDashProductIntervalKeyNumber(sourceEndDistance),
      `side:${interval.materializedSelectedSide ?? interval.selectedSide ?? 'side'}`
    ].join('|')
  }

  return ['interval-id', interval.intervalId].join('|')
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

const getBoundsScopedPolygons = (
  subjectPolygons: Vec2[][],
  candidatePolygons: Vec2[][],
  padding = 0
) => {
  if (subjectPolygons.length === 0 || candidatePolygons.length === 0) {
    return []
  }

  const subjectBounds = getBounds(subjectPolygons)
  const paddedSubjectBounds = {
    minX: subjectBounds.minX - padding,
    minY: subjectBounds.minY - padding,
    maxX: subjectBounds.maxX + padding,
    maxY: subjectBounds.maxY + padding
  }
  return candidatePolygons.filter((polygon) =>
    doBoundsOverlap(paddedSubjectBounds, getBounds([polygon]))
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

const removeRenderProjectionExcludedResiduePolygons = (
  polygons: Vec2[][],
  excludedPolygons: Vec2[][]
) => {
  if (polygons.length === 0 || excludedPolygons.length === 0) {
    return polygons
  }

  const backend = getGeometryBackend()
  if (
    backend.capabilities.intersection !== true ||
    typeof backend.intersection !== 'function'
  ) {
    return polygons
  }

  const excludedPolygonBounds = excludedPolygons.map((polygon) =>
    getBounds([polygon])
  )
  return polygons.filter((polygon) => {
    const polygonArea = getPolygonListCoverageArea([polygon])
    if (polygonArea <= EXACT_RENDER_OVERLAP_AREA_EPSILON) {
      return false
    }
    const polygonBounds = getBounds([polygon])
    const scopedExcludedPolygons = excludedPolygons.filter(
      (_excludedPolygon, index) =>
        doBoundsOverlap(polygonBounds, excludedPolygonBounds[index])
    )
    if (scopedExcludedPolygons.length === 0) {
      return true
    }

    const excludedOverlapArea = getExactPolygonListsOverlapArea(
      [polygon],
      scopedExcludedPolygons,
      backend
    )
    return (
      excludedOverlapArea === null ||
      polygonArea - excludedOverlapArea > EXACT_RENDER_OVERLAP_AREA_EPSILON
    )
  })
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

    if (
      descriptor.fillClipPolygons &&
      descriptor.fillClipPolygons.length > 0
    ) {
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
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink
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
    ...candidates.map((candidate) => candidate.geometrySignature)
  ].join('::')

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

const clipRenderProjectionUnionToArrangementCoverage = (
  unionPolygons: Vec2[][],
  arrangementPolygons: Vec2[][],
  backend: Pick<GeometryBackend, 'capabilities'> &
    Partial<Pick<GeometryBackend, 'intersection'>>
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

  return clipped.length > 0 ? clipped : unionPolygons
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
) =>
  face.debugMeta?.productSignature?.startsWith('constrained-dashed:') ===
    true &&
  (face.debugMeta.strokePosition === 'inside' ||
    face.debugMeta.strokePosition === 'outside')
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
    face.ownerSet.flatMap((owner) =>
      owner.ownerKey ? [owner.ownerKey] : []
    )
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
type ProductContractDebugMetaOverrides = Pick<
  SolidCenterStrokeGeometryDebugMeta,
  | 'intervalIds'
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

  const intervalIds = overrides.intervalIds ?? face.intervalIds
  const sourceSpanIds = overrides.sourceSpanIds ?? face.sourceSpanIds
  const sourceNetworkIds = overrides.sourceNetworkIds ?? face.sourceNetworkIds
  const sourceContourIds = overrides.sourceContourIds ?? face.sourceContourIds
  const legalDomainIds = overrides.legalDomainIds ?? face.legalDomainIds

  return {
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
    seamEvidence: debugMeta.seamEvidence,
    dashBodySeamBoundaries: debugMeta.dashBodySeamBoundaries,
    domainPlanBoundaryDomainId: debugMeta.domainPlanBoundaryDomainId,
    domainPlanSplitRangeId: debugMeta.domainPlanSplitRangeId,
    domainPlanSplitRangeStartDistance:
      debugMeta.domainPlanSplitRangeStartDistance,
    domainPlanSplitRangeEndDistance: debugMeta.domainPlanSplitRangeEndDistance,
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
    domainPlanSplitRangeTerminals:
      overrides.domainPlanSplitRangeTerminals ??
      debugMeta.domainPlanSplitRangeTerminals,
    dashProductIntervals: overrides.dashProductIntervals
      ? getUniqueDashProductIntervalsForRenderArray(
          overrides.dashProductIntervals
        )
      : debugMeta.dashProductIntervals
        ? getUniqueDashProductIntervalsForRenderArray(
            debugMeta.dashProductIntervals
          )
        : undefined,
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
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined
) => {
  if (!debugMeta) {
    return undefined
  }
  if (!debugMeta.dashProductIntervals) {
    return debugMeta
  }

  return {
    ...debugMeta,
    dashProductIntervals: getUniqueDashProductIntervalsForRenderArray(
      debugMeta.dashProductIntervals
    )
  } satisfies SolidCenterStrokeGeometryDebugMeta
}

const buildRenderEntryFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
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
    const runtimeMeta: SolidCenterStrokeRuntimeMeta = {
      productMode: face.debugMeta?.productMode,
      productSignature: face.debugMeta?.productSignature,
      domainMode: face.debugMeta?.domainMode,
      topologyFamily: face.debugMeta?.topologyFamily,
      strokePosition: face.debugMeta?.strokePosition,
      intervalIds: [...face.intervalIds],
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
      ? getFullDiagnosticsRenderDebugMeta(face.debugMeta)
      : undefined

    return {
      cacheKey: getProjectedGeometryId(face),
      stroke: {
        kind: face.paint.kind,
        color: face.paint.color,
        alpha: face.paint.alpha,
        gradientStyle: face.paint.gradientStyle ?? null,
        paintKey:
          face.paint.paintKey ?? `solid:${face.paint.color}:${face.paint.alpha}`
      },
      polygons: productPolygons,
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

const isBevelFamilySourceVertexJoinRenderEntry = (
  entry: SolidCenterStrokeComputedRenderEntry
) =>
  entry.debugMeta?.visibleContributor === 'source-vertex-join' &&
  (entry.debugMeta.resolvedJoin === 'bevel' ||
    entry.debugMeta.resolvedJoin === 'bevel-by-miter-angle')

const canCompositePolygonRenderEntry = (
  entry: SolidCenterStrokeComputedRenderEntry
) =>
  entry.polygons.length > 0 &&
  !isBevelFamilySourceVertexJoinRenderEntry(entry) &&
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

const mergeSamePaintPolygonRenderEntries = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  cacheKeyPrefix: string,
  collapseStatus: RenderProjectionCollapseStatus
): SolidCenterStrokeComputedRenderEntry[] => {
  const primaryEntry = selectPrimaryRenderMetadataEntry(entries)
  if (!primaryEntry || entries.length < 2) {
    return entries
  }

  const polygons = cleanRenderProjectionPolygons(
    unionCoveragePolygons(entries.flatMap(getVisibleProductPolygonsFromRenderEntry))
  )
  if (polygons.length === 0) {
    return []
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
    entries.flatMap((entry) => entry.debugMeta?.dashProductIntervals ?? [])
  )
  const dashEndpointCapPolicySignatures = getUniqueStrings(
    entries.flatMap(
      (entry) => entry.debugMeta?.dashEndpointCapPolicySignatures ?? []
    )
  )
  const dashEndpointCapPolicyTerminalRoles = getUniqueStrings(
    entries.flatMap(
      (entry) => entry.debugMeta?.dashEndpointCapPolicyTerminalRoles ?? []
    )
  ) as NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
  >
  const joinOwnershipRecords = getUniqueJoinOwnershipRecords(
    entries.flatMap((entry) => entry.debugMeta?.joinOwnershipRecords ?? [])
  )
  const joinOwnershipSignatures = getUniqueStrings(
    entries.flatMap((entry) => entry.debugMeta?.joinOwnershipSignatures ?? [])
  )
  const smoothContinuityGroupIds = getUniqueStrings(
    entries.flatMap((entry) => entry.debugMeta?.smoothContinuityGroupIds ?? [])
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
    intervalIds,
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
    visualOverlapCollapseStatus: collapseStatus,
    visualOverlapSourceFaceIds,
    visualOverlapSourceGeometryIds
  }

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${entries.map((entry) => entry.cacheKey).join('|')}`,
      polygons,
      fillPolygons: undefined,
      clipPolygons: undefined,
      fillClipPolygons: undefined,
      fillExcludePolygons: undefined,
      strokeMaskPolygons: undefined,
      strokePaths: undefined,
      strokePathGroups: undefined,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        intervalIds,
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

const collapseSamePaintOverlappingPolygonRenderEntries = (
  entries: SolidCenterStrokeComputedRenderEntry[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string
) => {
  if (entries.length < 2) {
    return entries
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

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    const leftEntry = entries[leftIndex]
    if (!leftEntry || !canCompositePolygonRenderEntry(leftEntry)) {
      continue
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < entries.length;
      rightIndex += 1
    ) {
      const rightEntry = entries[rightIndex]
      if (
        !rightEntry ||
        !canCompositePolygonRenderEntry(rightEntry) ||
        getRenderEntryPaintSignature(leftEntry) !==
          getRenderEntryPaintSignature(rightEntry) ||
        !doBoundsOverlap(renderBounds[leftIndex], renderBounds[rightIndex])
      ) {
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
              renderBounds[rightIndex]
            )
      if (hasOverlap) {
        unite(leftIndex, rightIndex)
      }
    }
  }

  const groupedEntries = new Map<number, SolidCenterStrokeComputedRenderEntry[]>()
  entries.forEach((entry, index) => {
    const root = find(index)
    const group = groupedEntries.get(root) ?? []
    group.push(entry)
    groupedEntries.set(root, group)
  })

  return Array.from(groupedEntries.values()).flatMap((group) =>
    group.length > 1
      ? mergeSamePaintPolygonRenderEntries(
          group,
          cacheKeyPrefix,
          'render-projection-merged'
        )
      : group
  )
}

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

  if (candidates.length <= 1) {
    return candidates.flatMap((candidate) => candidate.geometry.polygons)
  }

  if (
    options.allowDirectUnion !== false &&
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
      if (componentIndexes.length === 1) {
        const [componentIndex] = componentIndexes
        output.push(...candidates[componentIndex].geometry.polygons)
        return
      }

      const componentCandidates = componentIndexes.map(
        (index) => candidates[index]
      )
      const componentBounds = componentIndexes.map((index) => bounds[index])
      if (
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
        componentCandidates,
        backend
      )
      const arrangedPolygons =
        getCachedRenderProjectionArrangement(arrangementCacheKey) ??
        (() =>
          measureStrokeRenderEntryPhase(
            'render projection: arrangement',
            () => {
              const polygons = backend
                .buildArrangement(componentCandidates)
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
    projection?: 'union' | 'arrangement'
    clipToSourceCoverage?: boolean
    clipToDescriptorExclusions?: boolean
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
    return faces.map(buildRenderEntryFromFinalFace)
  }

  const sourcePolygons = measureStrokeRenderEntryPhase(
    'render projection: source polygons',
    () => faces.flatMap(getRenderProductPolygonsFromFinalFace)
  )
  const rawPolygons = flattenFacePolygons(
    (() => {
      try {
        if (renderOptions.projection === 'arrangement') {
          const arrangementBackend =
            backend as RenderProjectionArrangementBackend
          const arrangementPolygons = buildRenderProjectionArrangementPolygons(
            faces,
            arrangementBackend,
            {
              allowDirectUnion: false,
              allowComponentUnion: false,
              finalUnion: renderOptions.finalUnion,
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
            flattenFacePolygons(
              backend.union(
                faces.map((face) => toCoverageFaceRegion(face, renderOptions)),
                fillRule
              ),
              sourcePolygons
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
  const visiblePolygons = polygons
  const sourceGeometryIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceGeometryIds)
  )
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
    faces.flatMap((face) => face.debugMeta?.dashProductIntervals ?? [])
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
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      polygons: visiblePolygons,
      fillPolygons: undefined,
      clipPolygons: undefined,
      fillClipPolygons: undefined,
      fillExcludePolygons: undefined,
      strokeMaskPolygons: undefined,
      strokePaths: undefined,
      strokePathGroups: undefined,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
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
            intervalIds,
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
            visualOverlapCollapseStatus: collapseStatus,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          }
        : buildProductContractDebugMetaFromFinalFace(primaryFace, {
            intervalIds,
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
  const strokePathGroups = faces.flatMap((face) =>
    getRenderDescriptorStrokePathGroups(
      face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
    )
  )
  const debugMeta = shouldEmitFullStrokeDiagnostics()
    ? {
        ...primaryFace.debugMeta,
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: sourceGeometryIds
      }
    : buildProductContractDebugMetaFromFinalFace(primaryFace, {
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: sourceGeometryIds
      })

  return [
    {
      cacheKey: `render:dashed-center-descriptor:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
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
    intervalIds: face.intervalIds,
    sourceSpanIds: face.sourceSpanIds,
    sourceNetworkIds: face.sourceNetworkIds,
    sourceContourIds: face.sourceContourIds,
    legalDomainIds: face.legalDomainIds,
    ...(debugMeta ? { debugMeta } : {})
  }
}

const buildProjectedPacketsFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => faces.map(buildProjectionPacketFromFinalFace)

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
        constrainedDashedGroupSlots.set(constrainedDashedGroupKey, output.length)
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

    output.push([buildRenderEntryFromFinalFace(face)])
  })

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
      output[slot] = collapseSamePaintOverlappingPolygonRenderEntries(
        group.map(buildRenderEntryFromFinalFace),
        options,
        `constrained-dashed-same-paint:${groupKey}`
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
    return buildProjectedPacketsFromFinalFaces(faces)
  }
  const cached = hitPacketCache.get(faces)
  if (cached) {
    return cached
  }

  const packets = buildProjectedPacketsFromFinalFaces(faces)
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
    return buildProjectedPacketsFromFinalFaces(faces)
  }
  const cached = exportPacketCache.get(faces)
  if (cached) {
    return cached
  }

  const packets = buildProjectedPacketsFromFinalFaces(faces)
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
  face.renderDescriptor ? 'descriptor-visible-route' : 'canonical-product'

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
  const polygons = getRenderProductPolygonsFromFinalFace(face)
  const debugMeta = buildProductContractDebugMetaFromFinalFace(face)
  const renderDescriptor = pickVisibleRenderDescriptor(
    face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
  )
  return {
    channel: 'render',
    visibility: 'visible',
    geometryId: getProjectedGeometryId(face),
    polygons,
    bounds: polygons === face.polygons ? face.bounds : getBounds(polygons),
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
  >[]
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
  diagnosticPackets: faces.flatMap((face) => {
    const packet = buildDiagnosticPacketFromFinalFace(face)
    return packet ? [packet] : []
  })
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
  const shouldUsePureConstrainedDashedDescriptorEntries =
    canUsePureConstrainedDashedDescriptorRenderEntries(faces)
  if (shouldUsePureConstrainedDashedDescriptorEntries) {
    emitStrokePipelineCounter(
      'render-entry-constrained-dashed-descriptor-route-hit'
    )
    return measureStrokeRenderEntryPhase(
      'render entries: constrained dashed descriptor route',
      () =>
        collapseSamePaintOverlappingPolygonRenderEntries(
          faces.map(buildRenderEntryFromFinalFace),
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
  const renderFaces =
    (hasConstrainedDashedProductFace &&
      shouldReuseArrangedConstrainedDashedFaces) ||
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
