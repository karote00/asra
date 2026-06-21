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
      cap: 'butt' | 'square' | 'round' | 'none'
      join: 'miter' | 'bevel' | 'round'
      miterLimit: number
      closed?: boolean
    }
  }[]
  strokePathStyle?: {
    width: number
    cap: 'butt' | 'square' | 'round' | 'none'
    join: 'miter' | 'bevel' | 'round'
    miterLimit: number
    closed?: boolean
  }
}

export interface SolidCenterStrokeRuntimeMeta {
  productMode?: string
  productSignature?: string
  domainMode?: string
  topologyFamily?: PathTopologyModel['topologyFamily'] | string
  strokePosition?: 'center' | 'inside' | 'outside'
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-arrangement'
    | 'domain-plan-selected-side-arrangement'
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

export interface SolidCenterStrokeResolvedPacket {
  geometry: SolidCenterStrokeGeometryPacket
  paint: SolidCenterStrokePaintPacket
}

interface SolidCenterStrokeRenderEntryOptions {
  collapseDashedCenterVisualOverlaps?: boolean
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
  rawProductArea?: number
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
  domainPlanBoundaryDomainId?: string
  domainPlanBoundaryPoints?: Vec2[]
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanBoundaryTotalLength?: number
  domainPlanSplitRangeId?: string
  domainPlanSplitRangeStartDistance?: number
  domainPlanSplitRangeEndDistance?: number
  domainPlanTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  domainPlanSplitRangeSourceSegmentIndex?: number
  domainPlanSideAuthority?: 'implicit-fill-hole-domain'
  domainPlanSelectedSide?: 1 | -1
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
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
    domainMode?: string
  }[]
  dashProductIntervals?: {
    intervalId: string
    splitRangeId?: string
    terminalRole?: 'start' | 'end' | 'start-end' | 'middle'
    startDistance?: number
    endDistance?: number
    effectiveStartDistance?: number
    effectiveEndDistance?: number
    capReachDistance?: number
    boundaryDomainId?: string
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
    selectedSide?: 1 | -1
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    sourceSegmentIndex?: number
    endpointCapPolicySignature?: string
    joinOwnershipSignature?: string
    smoothContinuityGroupId?: string
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
  domainMode?: string
  topologyFamily?: PathTopologyModel['topologyFamily']
  ownerCount?: number
  strokePosition?: 'center' | 'inside' | 'outside'
  strokeWidth?: number
  strokeJoin?: 'miter' | 'bevel' | 'round'
  strokeCap?: 'butt' | 'square' | 'round' | 'none'
  strokeMiterLimit?: number
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
    materializedStrokeCap?: 'butt' | 'square' | 'round' | 'none'
    roundCapStart?: boolean
    roundCapEnd?: boolean
    squareCapStart?: boolean
    squareCapEnd?: boolean
  }[]
  joinOwnershipSignature?: string
  joinOwnershipRecords?: {
    kind: 'source-vertex' | 'boundary-terminal-pair'
    area: number
    bounds: Bounds
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
    | 'exact-arrangement'
    | 'domain-plan-selected-side-arrangement'
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

const getSignedArea = (polygon: Vec2[]) => {
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const normalizeCoverageWinding = (polygon: Vec2[]) =>
  getSignedArea(polygon) < 0 ? [...polygon].reverse() : polygon

const unionCoveragePolygons = (polygons: Vec2[][]) => {
  if (polygons.length <= 1) {
    return polygons
  }
  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.union) {
      return polygons
    }
    const unioned = backend
      .union(
        polygons.map((polygon) => ({
          polygons: [normalizeCoverageWinding(polygon)]
        })),
        'nonzero'
      )
      .flatMap((region) => region.polygons)
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
    // Fall back to the local polygon builder below.
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

const getPointDistance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const getRenderProjectionSignedPolygonArea = (polygon: Vec2[]) =>
  polygon.reduce((total, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return total + point.x * next.y - next.x * point.y
  }, 0) / 2

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

const cleanRenderProjectionPolygons = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) =>
      pruneRenderProjectionMicroEdges(cleanRenderProjectionPolygon(polygon))
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
    const polygons =
      isSelfIntersectingCenterProduct && !shouldUseStrokePathDescriptor
        ? unionCoveragePolygons(rawPolygons)
        : rawPolygons
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
      excludedPolygons.map((polygon) => ({
        polygons: [normalizeCoveragePolygonWinding(polygon)]
      })),
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
          cap: style.cap === 'none' ? 'butt' : style.cap,
          join: style.join,
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

  const hasProductDomainClip =
    (descriptor.clipPolygons && descriptor.clipPolygons.length > 0) ||
    (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0)

  const hasDescriptorProductPolygons =
    descriptor.descriptorProductPolygons !== undefined &&
    descriptor.descriptorProductPolygons.length > 0

  const groupPolygons = hasDescriptorProductPolygons
    ? []
    : (descriptor.strokePathGroups?.flatMap((group) => {
        const polygons = buildStrokePathDescriptorPolygons(
          group.strokePaths,
          group.strokePathStyle ?? descriptor.strokePathStyle
        )
        return !hasProductDomainClip &&
          group.clipPolygons &&
          group.clipPolygons.length > 0
          ? intersectDescriptorPolygons(polygons, group.clipPolygons)
          : polygons
      }) ?? [])

  let flatProductPolygons = hasDescriptorProductPolygons
    ? (descriptor.descriptorProductPolygons ?? [])
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
}

const buildRenderProjectionPolygonSignature = (polygon: Vec2[]) =>
  polygon
    .map(
      (point) => `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`
    )
    .join(';')

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
  face.debugMeta?.strokePosition === 'outside'

const shouldUseStoredConstrainedDashedProductPolygons = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) =>
  isConstrainedDashedProductFace(face) &&
  face.debugMeta?.productSignature?.includes(
    ':outside-aggregate-descriptor:'
  ) === true

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
  face.renderDescriptor !== undefined &&
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
        : shouldMaterializeConstrainedDashedRenderDescriptor(face)
          ? materializeRenderDescriptorProductPolygons(
              face.renderDescriptor as
                | SolidCenterStrokeRenderDescriptor
                | undefined,
              face.polygons
            )
          : face.polygons

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
  | 'dashEndpointCapPolicySignatures'
  | 'dashEndpointCapPolicyTerminalRoles'
  | 'joinOwnershipSignatures'
  | 'smoothContinuityGroupIds'
  | 'domainPlanBoundaryRoles'
  | 'domainPlanSplitRangeIds'
  | 'domainPlanSelectedSides'
  | 'domainPlanSourceSegmentIndexes'
  | 'visualOverlapCollapseStatus'
  | 'visualOverlapSourceFaceIds'
  | 'visualOverlapSourceGeometryIds'
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
    strokeMiterLimit: debugMeta.strokeMiterLimit,
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
    dashProductIntervals:
      overrides.dashProductIntervals ?? debugMeta.dashProductIntervals,
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
    const renderDescriptor = shouldMaterializeConstrainedDashedDescriptor
      ? undefined
      : sourceRenderDescriptor
    const constrainedDashedRenderEntryStrokeMaskPolygons =
      shouldMaterializeConstrainedDashedDescriptor
        ? materializeRenderDescriptorProductPolygons(
            sourceRenderDescriptor,
            face.polygons
          )
        : undefined
    const productPolygons = measureStrokeRenderEntryPhase(
      'render entries: product polygons',
      () => getRenderProductPolygonsFromFinalFace(face)
    )
    const runtimeMeta: SolidCenterStrokeRuntimeMeta = {
      productMode: face.debugMeta?.productMode,
      productSignature: face.debugMeta?.productSignature,
      domainMode: face.debugMeta?.domainMode,
      topologyFamily: face.debugMeta?.topologyFamily,
      strokePosition: face.debugMeta?.strokePosition,
      visualOverlapCollapseStatus: face.debugMeta?.visualOverlapCollapseStatus,
      revisionSet: face.debugMeta?.revisionSet
    }

    const productContractDebugMeta = measureStrokeRenderEntryPhase(
      'render entries: product contract meta',
      () => buildProductContractDebugMetaFromFinalFace(face)
    )

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
      debugMeta: shouldEmitFullStrokeDiagnostics()
        ? face.debugMeta
        : productContractDebugMeta,
      runtimeMeta,
      revisionSet: runtimeMeta.revisionSet,
      preferSolidGraphics: isConstrainedDashedProductFace(face)
    }
  })

type RenderProjectionCollapseStatus =
  | 'exact-union'
  | 'exact-arrangement'
  | 'domain-plan-selected-side-arrangement'
  | 'render-projection-merged'
  | 'render-projection-arrangement'

const buildRenderProjectionArrangementCandidates = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: { preserveWinding?: boolean } = {}
): RenderProjectionCandidateRegion[] =>
  faces.flatMap((face) =>
    getRenderProductPolygonsFromFinalFace(face).map((polygon, polygonIndex) => {
      const arrangementPolygon =
        options.preserveWinding === true
          ? polygon
          : normalizeCoveragePolygonWinding(polygon)
      const geometryPolygons = [arrangementPolygon]
      return {
        candidateId: `${face.faceId}:render-polygon:${polygonIndex}`,
        geometry: {
          polygons: geometryPolygons
        },
        geometryBounds: getBounds(geometryPolygons),
        geometrySignature:
          buildRenderProjectionPolygonSignature(arrangementPolygon),
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
      }
    })
  )

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
    finalUnion?: boolean
    preserveWinding?: boolean
  } = {}
) => {
  const candidates = measureStrokeRenderEntryPhase(
    'render projection: candidates',
    () =>
      buildRenderProjectionArrangementCandidates(faces, {
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
  const [primaryFace] = faces
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
          return [
            {
              polygons: buildRenderProjectionArrangementPolygons(
                faces,
                arrangementBackend,
                {
                  allowDirectUnion: false,
                  allowComponentUnion: false,
                  finalUnion: renderOptions.finalUnion,
                  preserveWinding: renderOptions.preserveWinding
                }
              )
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
                rawPolygons,
                descriptorExcludePolygons
              )
          )
        )
      : rawPolygons
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
  const domainPlanSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.domainPlanSplitRangeTerminals ?? []
  )
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
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

const getConstrainedDashedOutsideRenderGroupKey = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (
    !isConstrainedDashedProductFace(face) ||
    face.debugMeta?.strokePosition !== 'outside'
  ) {
    return null
  }

  const meta = face.debugMeta
  return [
    face.paint.kind ?? 'solid',
    face.paint.paintKey ?? '',
    face.paint.color,
    face.paint.alpha,
    meta?.networkId ?? '',
    meta?.strokeId ?? '',
    meta?.strokeIndex ?? '',
    meta?.strokePosition ?? '',
    meta?.strokeWidth ?? '',
    meta?.strokeJoin ?? '',
    meta?.strokeCap ?? '',
    meta?.strokeMiterLimit ?? '',
    meta?.domainPlanDomainMode ?? meta?.domainMode ?? '',
    (meta?.legalDomainIds ?? []).join(',')
  ].join('|')
}

const shouldCollapseConstrainedDashedOutsideRenderGroup = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => faces.length >= 2

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

  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)
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
      ...primaryEntry,
      cacheKey: `render:dashed-center-descriptor:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      polygons: faces.flatMap((face) => face.polygons),
      strokePathGroups,
      strokePaths: undefined,
      strokePathStyle: primaryEntry.strokePathStyle,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds
      },
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
  const shouldKeepExactBooleanProductPolygons =
    face.debugMeta?.solidMaskModelCoverageOracle === 'exact-boolean' ||
    isConstrainedSolidRenderMaskProductFace(face)
  const polygons = shouldKeepExactBooleanProductPolygons
    ? face.polygons
    : materializeRenderDescriptorProductPolygons(
        face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined,
        face.polygons
      )
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
  if (options.collapseDashedCenterVisualOverlaps === false) {
    return faces.map(buildRenderEntryFromFinalFace)
  }

  const output: ReturnType<typeof buildRenderEntryFromFinalFace>[][] = []
  const dashedGroups = new Map<
    string,
    StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >[]
  >()
  const dashedGroupSlots = new Map<string, number>()
  const constrainedDashedOutsideGroups = new Map<
    string,
    StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >[]
  >()
  const constrainedDashedOutsideGroupSlots = new Map<string, number>()

  faces.forEach((face) => {
    const constrainedDashedOutsideGroupKey =
      getConstrainedDashedOutsideRenderGroupKey(face)
    if (constrainedDashedOutsideGroupKey) {
      const group =
        constrainedDashedOutsideGroups.get(constrainedDashedOutsideGroupKey) ??
        []
      group.push(face)
      constrainedDashedOutsideGroups.set(
        constrainedDashedOutsideGroupKey,
        group
      )

      if (
        !constrainedDashedOutsideGroupSlots.has(
          constrainedDashedOutsideGroupKey
        )
      ) {
        constrainedDashedOutsideGroupSlots.set(
          constrainedDashedOutsideGroupKey,
          output.length
        )
        output.push([])
      }
      return
    }

    if (isConstrainedDashedProductFace(face)) {
      output.push([buildRenderEntryFromFinalFace(face)])
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
  constrainedDashedOutsideGroups.forEach((group, groupKey) => {
    const slot = constrainedDashedOutsideGroupSlots.get(groupKey)
    if (slot !== undefined) {
      output[slot] = shouldCollapseConstrainedDashedOutsideRenderGroup(group)
        ? buildCollapsedRenderEntry(
            group,
            options,
            'constrained-dashed-product-projection',
            'exact-union',
            'nonzero',
            {
              clipToDescriptorExclusions: true
            }
          )
        : group.map(buildRenderEntryFromFinalFace)
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
  const hasConstrainedDashedProductFace = faces.some(
    isConstrainedDashedProductFace
  )
  const shouldCollapseConstrainedDashedRenderFaces =
    hasConstrainedDashedProductFace &&
    faces.every(
      (face) =>
        !isConstrainedDashedProductFace(face) ||
        face.debugMeta?.strokePosition === 'outside'
    )
  const renderFaces =
    hasConstrainedDashedProductFace &&
    !shouldCollapseConstrainedDashedRenderFaces
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
