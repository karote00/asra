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
import { shouldEmitFullStrokeDiagnostics } from './stroke-diagnostics-mode'
import {
  getGeometryBackend,
  getGeometryBackendCacheSignature,
  type CandidateRegion,
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
  fillPolygons?: Vec2[][]
  clipPolygons?: Vec2[][]
  fillClipPolygons?: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: {
    clipPolygons: Vec2[][]
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
  geometryFamily?: StrokeGeometryFamily | string
  resolutionStatus?: StrokeGeometryResolutionStatus | string
  runtimeStatus?: StrokeGeometryRuntimeStatus | string
  runtimeReason?: StrokeGeometryRuntimeReason | string
  sourceTopology?: StrokeGeometrySourceTopology | string
  topologyFamily?: PathTopologyModel['topologyFamily'] | string
  intervalTopology?: StrokeGeometryIntervalTopology | string
  strokePosition?: 'center' | 'inside' | 'outside'
  finalCoverageBuilderStatus?: 'product-final' | 'debug-raw'
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-arrangement'
    | 'local-side-arrangement'
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
    Partial<Pick<GeometryBackend, 'buildArrangement' | 'intersection'>>
}

export type StrokeGeometryFamily =
  | 'solid-center'
  | 'dashed-center'
  | 'constrained-solid'
  | 'constrained-dashed'

export type StrokeGeometryResolutionStatus =
  | 'native-center'
  | 'local-side-approximation'
  | 'exact-constrained'

export type StrokeGeometryRuntimeStatus =
  | 'candidate'
  | 'accepted'
  | 'blocked'
  | 'not-applicable'

export type StrokeGeometryRuntimeReason =
  | 'center-stroke'
  | 'constrained-solid-exact'
  | 'local-side-constrained-solid'
  | 'single-owner'
  | 'typed-owners'
  | 'missing-owner-metadata'
  | 'no-packets'
  | 'no-candidate-packets'
  | 'unsupported-open-topology'
  | 'unsupported-overlap-ownership'
  | 'unsupported-topology'

export type StrokeGeometrySourceTopology =
  | 'rectangle-equivalent'
  | 'broader-simple-closed'
  | 'sampled-simple-closed'
  | 'self-intersecting'
  | 'degenerate'
  | 'open'

export type StrokeGeometryIntervalTopology =
  | 'full-loop'
  | 'single-edge'
  | 'corner-spanning'
  | 'seam-wrapping'
  | 'multi-corner'
  | 'other'

export type StrokeGeometryOwnershipStatus = 'accepted' | 'blocked'

export interface SolidCenterStrokeGeometryDebugMeta {
  sourcePathId?: string
  ownerKey?: string
  networkId?: string
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
  startDistance?: number
  endDistance?: number
  wrapsSeam?: boolean
  physicalSpanRanges?: {
    spanId: string
    role: 'core' | 'start-cap' | 'end-cap'
    startDistance: number
    endDistance: number
    wrapsSeam: boolean
  }[]
  physicalVisibleLength?: number
  previousVisibleIntervalId?: string | null
  nextVisibleIntervalId?: string | null
  intervalTerminalRole?: 'none' | 'path-start' | 'path-end' | 'both'
  figmaLikeBoundaryDomainId?: string
  figmaLikeBoundaryPoints?: Vec2[]
  figmaLikeBoundaryStartDistance?: number
  figmaLikeBoundaryEndDistance?: number
  figmaLikeBoundaryTotalLength?: number
  figmaLikeSplitRangeId?: string
  figmaLikeSplitRangeStartDistance?: number
  figmaLikeSplitRangeEndDistance?: number
  figmaLikeTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  figmaLikeSplitRangeSourceSegmentIndex?: number
  figmaLikeSideAuthority?: 'implicit-fill-hole-domain'
  figmaLikeSelectedSide?: 1 | -1
  figmaLikeFilledSide?: 1 | -1
  figmaLikeUnfilledSide?: 1 | -1
  figmaLikeBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  figmaLikeSideResolutionStatus?: 'resolved' | 'blocked'
  figmaLikeSideResolutionReason?: string
  figmaLikeSplitRangeTerminals?: {
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
  }[]
  intervalStartCutKind?: 'vertex' | 'dash-boundary' | 'self-intersection'
  intervalEndCutKind?: 'vertex' | 'dash-boundary' | 'self-intersection'
  strokeIntersectionEligible?: boolean
  ribbonValidityStatus?:
    | 'simple-outline'
    | 'backend-offset'
    | 'fail-open-invalid-outline'
    | 'empty'
  dashPlacementMode?: 'arc-length-pattern'
  geometryFamily?: StrokeGeometryFamily
  resolutionStatus?: StrokeGeometryResolutionStatus
  runtimeStatus?: StrokeGeometryRuntimeStatus
  runtimeReason?: StrokeGeometryRuntimeReason
  sourceTopology?: StrokeGeometrySourceTopology
  topologyFamily?: PathTopologyModel['topologyFamily']
  intervalTopology?: StrokeGeometryIntervalTopology
  ownershipStatus?: StrokeGeometryOwnershipStatus
  ownerCount?: number
  strokePosition?: 'center' | 'inside' | 'outside'
  strokeWidth?: number
  strokeJoin?: 'miter' | 'bevel' | 'round'
  strokeCap?: 'butt' | 'square' | 'round' | 'none'
  strokeMiterLimit?: number
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
    | 'local-side-arrangement'
    | 'render-projection-merged'
    | 'render-projection-arrangement'
  visualOverlapSourceFaceIds?: string[]
  visualOverlapSourceGeometryIds?: string[]
  finalCoverageBuilderStatus?: 'product-final' | 'debug-raw'
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

const mapCenterTopologyToSourceTopology = (
  topology: PathTopologyModel
): StrokeGeometrySourceTopology => {
  if (topology.topologyFamily === 'open') {
    return 'open'
  }
  if (topology.topologyFamily === 'self-intersecting') {
    return 'self-intersecting'
  }
  if (topology.topologyFamily === 'degenerate') {
    return 'degenerate'
  }
  return 'sampled-simple-closed'
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
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
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
    Math.abs(ax * by - ay * bx) / scale <=
    RENDER_PROJECTION_COLLINEAR_TOLERANCE
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
  return microEdgeCount >= 5
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
      const previous = compacted[(index - 1 + compacted.length) % compacted.length]
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

const cleanRenderProjectionPolygons = (polygons: Vec2[][]) =>
  polygons
    .map(cleanRenderProjectionPolygon)
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
  const sourceTopology = mapCenterTopologyToSourceTopology(topology)

  return getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsSolidCenterStroke(stroke)) {
      return []
    }

    const shouldUseStrokePathDescriptor =
      options.preferStrokePathRenderDescriptor === true &&
      sourceTopology === 'self-intersecting' &&
      stroke.kind === 'solid'
    const rawPolygons = shouldUseStrokePathDescriptor
      ? [
          buildInflatedBoundsPolygon(
            topologyPoints,
            stroke.width * Math.max(2, Math.min(8, stroke.miterLimit || 4))
          )
        ].filter((polygon) => polygon.length >= 3)
      : sourceTopology === 'self-intersecting'
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
      sourceTopology === 'self-intersecting' && !shouldUseStrokePathDescriptor
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
          renderDescriptor:
            sourceTopology === 'self-intersecting'
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
            geometryFamily: 'solid-center',
            resolutionStatus: 'native-center',
            runtimeStatus: 'not-applicable',
            runtimeReason: 'center-stroke',
            visualOverlapCollapseStatus:
              sourceTopology === 'self-intersecting'
                ? 'exact-union'
                : undefined,
            sourceTopology,
            topologyFamily: topology.topologyFamily,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              geometryFamily: 'solid-center',
              resolutionStatus: 'native-center',
              runtimeStatus: 'not-applicable',
              runtimeReason: 'center-stroke',
              sourceTopology,
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
  fallbackPolygons: Vec2[][]
) => {
  const polygons = regions.flatMap((region) => region.polygons)
  return cleanRenderProjectionPolygons(
    polygons.length > 0 ? polygons : fallbackPolygons
  )
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

const toCoverageFaceRegion = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => ({
  polygons: face.polygons.map(normalizeCoveragePolygonWinding)
})

const getDashedCenterRenderGroupKey = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (face.geometryFamily !== 'dashed-center') {
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

const getConstrainedDashedProductRenderGroupKey = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  if (
    face.geometryFamily !== 'constrained-dashed' ||
    face.debugMeta?.finalCoverageBuilderStatus !== 'product-final'
  ) {
    return null
  }

  if (
    face.debugMeta?.sourceTopology === 'self-intersecting' &&
    face.debugMeta?.topologyFamily === 'open'
  ) {
    return null
  }

  const ownerKey = [
    face.debugMeta?.sourcePathId,
    face.debugMeta?.ownerKey,
    face.debugMeta?.networkId,
    face.debugMeta?.strokeId,
    face.debugMeta?.strokeIndex,
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

const getRenderIntersectionBackend = (
  options: SolidCenterStrokeRenderEntryOptions
) => {
  const providedBackend = options.exactBackend
  if (
    providedBackend?.capabilities.intersection === true &&
    typeof providedBackend.intersection === 'function'
  ) {
    return providedBackend as Pick<
      GeometryBackend,
      'capabilities' | 'intersection'
    >
  }

  try {
    const backend = getGeometryBackend()
    return backend.capabilities.intersection === true ? backend : null
  } catch {
    return null
  }
}

const buildRenderEntryFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => {
  const renderDescriptor = face.renderDescriptor as
    | SolidCenterStrokeRenderDescriptor
    | undefined
  const runtimeMeta: SolidCenterStrokeRuntimeMeta = {
    geometryFamily: face.geometryFamily ?? face.debugMeta?.geometryFamily,
    resolutionStatus: face.resolutionStatus ?? face.debugMeta?.resolutionStatus,
    runtimeStatus: face.runtimeStatus ?? face.debugMeta?.runtimeStatus,
    runtimeReason: face.debugMeta?.runtimeReason,
    sourceTopology: face.sourceTopology ?? face.debugMeta?.sourceTopology,
    topologyFamily: face.debugMeta?.topologyFamily,
    intervalTopology: face.debugMeta?.intervalTopology,
    strokePosition: face.debugMeta?.strokePosition,
    finalCoverageBuilderStatus: face.debugMeta?.finalCoverageBuilderStatus,
    visualOverlapCollapseStatus: face.debugMeta?.visualOverlapCollapseStatus,
    revisionSet: face.debugMeta?.revisionSet
  }

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
    polygons: filterOutsideSquareSplitTerminalRenderProjectionResidue(
      face.polygons,
      [face]
    ),
    fillPolygons: renderDescriptor?.fillPolygons,
    clipPolygons: renderDescriptor?.clipPolygons,
    fillClipPolygons: renderDescriptor?.fillClipPolygons,
    strokeMaskPolygons: renderDescriptor?.strokeMaskPolygons,
    strokePaths: renderDescriptor?.strokePaths,
    strokePathGroups: renderDescriptor?.strokePathGroups,
    strokePathStyle: renderDescriptor?.strokePathStyle,
    debugMeta: shouldEmitFullStrokeDiagnostics() ? face.debugMeta : undefined,
    runtimeMeta,
    revisionSet: runtimeMeta.revisionSet,
    preferSolidGraphics:
      face.geometryFamily === 'constrained-dashed' &&
      (face.debugMeta?.finalCoverageBuilderStatus === 'product-final' ||
        (face.debugMeta?.intervalTopology === 'full-loop' &&
          face.debugMeta?.strokePosition === 'inside'))
  }
}

type RenderProjectionCollapseStatus =
  | 'exact-union'
  | 'exact-arrangement'
  | 'local-side-arrangement'
  | 'render-projection-merged'
  | 'render-projection-arrangement'

const buildRenderProjectionArrangementCandidates = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): RenderProjectionCandidateRegion[] =>
  faces.flatMap((face) =>
    face.polygons.map((polygon, polygonIndex) => {
      const normalizedPolygon = normalizeCoveragePolygonWinding(polygon)
      const geometryPolygons = [normalizedPolygon]
      return {
        candidateId: `${face.faceId}:render-polygon:${polygonIndex}`,
        geometry: {
          polygons: geometryPolygons
        },
        geometryBounds: getBounds(geometryPolygons),
        geometrySignature:
          buildRenderProjectionPolygonSignature(normalizedPolygon),
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
        sourceContourIds: face.sourceContourIds,
        requiresBoundaryPreservingArrangement:
          face.debugMeta?.figmaLikeBoundaryRole === 'filled-face' ||
          face.debugMeta?.figmaLikeSplitRangeTerminals?.some(
            (terminal) => terminal.boundaryRole === 'filled-face'
          ) === true
      }
    })
  )

const getTerminalEndpoint = (
  boundaryPoints: Vec2[] | undefined,
  terminal: 'start' | 'end'
) => {
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
  }

  return terminal === 'start'
    ? boundaryPoints[0]
    : boundaryPoints[boundaryPoints.length - 1]
}

const collectOutsideSquareSplitTerminalResidueContexts = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.flatMap((face) => {
    const debugMeta = face.debugMeta
    if (
      face.geometryFamily !== 'constrained-dashed' ||
      debugMeta?.finalCoverageBuilderStatus !== 'product-final' ||
      debugMeta.strokePosition !== 'outside' ||
      typeof debugMeta.strokeWidth !== 'number' ||
      debugMeta.strokeWidth <= 0
    ) {
      return []
    }

    const strokeWidth = debugMeta.strokeWidth
    const terminalRecords =
      debugMeta.figmaLikeSplitRangeTerminals?.length
        ? debugMeta.figmaLikeSplitRangeTerminals
        : debugMeta.figmaLikeSplitRangeId &&
            debugMeta.figmaLikeTerminalRole &&
            debugMeta.figmaLikeTerminalRole !== 'middle'
          ? [
              {
                intervalId: debugMeta.intervalId ?? face.faceId,
                splitRangeId: debugMeta.figmaLikeSplitRangeId,
                splitRangeStartDistance:
                  debugMeta.figmaLikeSplitRangeStartDistance ?? 0,
                splitRangeEndDistance:
                  debugMeta.figmaLikeSplitRangeEndDistance ?? 0,
                terminalRole: debugMeta.figmaLikeTerminalRole,
                startDistance: debugMeta.startDistance ?? 0,
                endDistance: debugMeta.endDistance ?? 0,
                boundaryPoints: debugMeta.figmaLikeBoundaryPoints
              }
            ]
          : []

    return terminalRecords.flatMap((terminal) => {
      const boundaryPoints =
        terminal.boundaryPoints ?? debugMeta.figmaLikeBoundaryPoints
      return [
        ...(terminal.terminalRole === 'start' ||
	        terminal.terminalRole === 'start-end'
	          ? [
	              {
	                point: getTerminalEndpoint(boundaryPoints, 'start'),
	                strokeWidth
	              }
	            ]
          : []),
        ...(terminal.terminalRole === 'end' ||
	        terminal.terminalRole === 'start-end'
	          ? [
	              {
	                point: getTerminalEndpoint(boundaryPoints, 'end'),
	                strokeWidth
	              }
	            ]
          : [])
      ].flatMap((context) =>
        context.point ? [{ point: context.point, strokeWidth: context.strokeWidth }] : []
      )
    })
  })

const filterOutsideSquareSplitTerminalRenderProjectionResidue = (
  polygons: Vec2[][],
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) => {
  const contexts = collectOutsideSquareSplitTerminalResidueContexts(faces)
  if (polygons.length === 0 || contexts.length === 0) {
    return polygons
  }

  const polygonAreas = polygons.map(getPolygonCoverageArea)
  const touchesEndpoint = (polygon: Vec2[], point: Vec2, tolerance: number) =>
    polygon.some((polygonPoint) => getPointDistance(polygonPoint, point) <= tolerance)

  return polygons.filter((polygon, polygonIndex) => {
    const area = polygonAreas[polygonIndex] ?? 0
    return !contexts.some(({ point, strokeWidth }) => {
      const endpointTolerance = Math.max(0.75, strokeWidth * 0.12)
      if (!touchesEndpoint(polygon, point, endpointTolerance)) {
        return false
      }

      const maxEndpointArea = polygons.reduce((maxArea, candidate, candidateIndex) => {
        return touchesEndpoint(candidate, point, endpointTolerance)
          ? Math.max(maxArea, polygonAreas[candidateIndex] ?? 0)
          : maxArea
      }, 0)
      const fragmentAreaLimit = strokeWidth * strokeWidth * 0.75
      return (
        area <= fragmentAreaLimit &&
        maxEndpointArea > 0 &&
        area < maxEndpointArea * 0.65
      )
    })
  })
}

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
  options: { allowDirectUnion?: boolean; allowComponentUnion?: boolean } = {}
) => {
  const candidates = measureStrokeRenderEntryPhase(
    'render projection: candidates',
    () => buildRenderProjectionArrangementCandidates(faces)
  )

  if (candidates.length <= 1) {
    return filterOutsideSquareSplitTerminalRenderProjectionResidue(
      candidates.flatMap((candidate) => candidate.geometry.polygons),
      faces
    )
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
        return filterOutsideSquareSplitTerminalRenderProjectionResidue(
          polygons,
          faces
        )
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
        output.push(
          ...filterOutsideSquareSplitTerminalRenderProjectionResidue(
            candidates[componentIndex].geometry.polygons,
            faces
          )
        )
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
          ...filterOutsideSquareSplitTerminalRenderProjectionResidue(
            componentCandidates.flatMap(
              (candidate) => candidate.geometry.polygons
            ),
            faces
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
            output.push(
              ...filterOutsideSquareSplitTerminalRenderProjectionResidue(
                componentPolygons,
                faces
              )
            )
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
        ...filterOutsideSquareSplitTerminalRenderProjectionResidue(
          arrangedPolygons.length > 0
            ? arrangedPolygons
            : componentCandidates.flatMap((entry) => entry.geometry.polygons),
          faces
        )
      )
    })
  })

  emitStrokePipelineCounter('render-projection-final-union-skipped')
  return filterOutsideSquareSplitTerminalRenderProjectionResidue(
    cleanRenderProjectionPolygons(output),
    faces
  )
}

const buildCollapsedRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string,
  collapseStatus: RenderProjectionCollapseStatus
) => {
  const [primaryFace] = faces
  const backend = getRenderOverlapBackend(options)
  if (!primaryFace || faces.length < 2 || !backend) {
    return faces.map(buildRenderEntryFromFinalFace)
  }

  const fallbackPolygons = faces.flatMap((face) => face.polygons)
  const unionRegions = (() => {
    try {
      return backend.union(faces.map(toCoverageFaceRegion), 'nonzero')
    } catch {
      return []
    }
  })()
  const polygons = filterOutsideSquareSplitTerminalRenderProjectionResidue(
    flattenFacePolygons(unionRegions, fallbackPolygons),
    faces
  )
  const sourceGeometryIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceGeometryIds)
  )
  const intervalIds = getUniqueStrings(
    faces.flatMap((face) => face.intervalIds)
  )
  const sourceSpanIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceSpanIds)
  )
  const sourceContourIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceContourIds)
  )
  const legalDomainIds = getUniqueStrings(
    faces.flatMap((face) => face.legalDomainIds)
  )
  const figmaLikeSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.figmaLikeSplitRangeTerminals ?? []
  )
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      polygons,
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        intervalIds,
        sourceSpanIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapCollapseStatus: collapseStatus
      },
      debugMeta: shouldEmitFullStrokeDiagnostics()
        ? {
            ...primaryFace.debugMeta,
            intervalIds,
            sourceSpanIds,
            sourceContourIds,
            legalDomainIds,
            figmaLikeSplitRangeTerminals:
              figmaLikeSplitRangeTerminals.length > 0
                ? figmaLikeSplitRangeTerminals
                : undefined,
            visualOverlapCollapseStatus: collapseStatus,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          }
        : undefined
    }
  ]
}

const buildMergedRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  cacheKeyPrefix: string
) => {
  const [primaryFace] = faces
  if (!primaryFace || faces.length < 2) {
    return faces.map(buildRenderEntryFromFinalFace)
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
  const sourceContourIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceContourIds)
  )
  const legalDomainIds = getUniqueStrings(
    faces.flatMap((face) => face.legalDomainIds)
  )
  const figmaLikeSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.figmaLikeSplitRangeTerminals ?? []
  )
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)
  const polygons = filterOutsideSquareSplitTerminalRenderProjectionResidue(
    faces.flatMap((face) => face.polygons),
    faces
  )
  const shouldRenderAsSingleMask = faces.some(
    (face) =>
      face.geometryFamily === 'constrained-dashed' &&
      face.debugMeta?.strokePosition === 'inside' &&
      face.debugMeta?.finalCoverageBuilderStatus === 'product-final'
  )

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      polygons,
      ...(shouldRenderAsSingleMask ? { strokeMaskPolygons: polygons } : {}),
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        intervalIds,
        sourceSpanIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapCollapseStatus: 'render-projection-merged' as const
      },
      debugMeta: shouldEmitFullStrokeDiagnostics()
        ? {
            ...primaryFace.debugMeta,
            intervalIds,
            sourceSpanIds,
            sourceContourIds,
            legalDomainIds,
            figmaLikeSplitRangeTerminals:
              figmaLikeSplitRangeTerminals.length > 0
                ? figmaLikeSplitRangeTerminals
                : undefined,
            visualOverlapCollapseStatus: 'render-projection-merged' as const,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          }
        : undefined
    }
  ]
}

const buildRenderProjectionArrangementEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string,
  arrangementOptions: {
    allowDirectUnion?: boolean
    allowComponentUnion?: boolean
  } = {}
) => {
  const [primaryFace] = faces
  if (!primaryFace || faces.length < 2) {
    return faces.map(buildRenderEntryFromFinalFace)
  }

  const backend = getRenderArrangementBackend(options)
  if (!backend) {
    return faces.map(buildRenderEntryFromFinalFace)
  }

  const fallbackPolygons = faces.flatMap((face) => face.polygons)
  const polygons = (() => {
    try {
      const arrangedPolygons = buildRenderProjectionArrangementPolygons(
        faces,
        backend,
        arrangementOptions
      )
      return arrangedPolygons.length > 0 ? arrangedPolygons : fallbackPolygons
    } catch {
      return fallbackPolygons
    }
  })()
  const sourceGeometryIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceGeometryIds)
  )
  const intervalIds = getUniqueStrings(
    faces.flatMap((face) => face.intervalIds)
  )
  const sourceSpanIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceSpanIds)
  )
  const sourceContourIds = getUniqueStrings(
    faces.flatMap((face) => face.sourceContourIds)
  )
  const legalDomainIds = getUniqueStrings(
    faces.flatMap((face) => face.legalDomainIds)
  )
  const figmaLikeSplitRangeTerminals = faces.flatMap(
    (face) => face.debugMeta?.figmaLikeSplitRangeTerminals ?? []
  )
  const primaryEntry = buildRenderEntryFromFinalFace(primaryFace)
  const shouldRenderAsSingleMask = faces.some(
    (face) =>
      face.geometryFamily === 'constrained-dashed' &&
      face.debugMeta?.strokePosition === 'inside' &&
      face.debugMeta?.finalCoverageBuilderStatus === 'product-final'
  )

  return [
    {
      ...primaryEntry,
      cacheKey: `render:${cacheKeyPrefix}:${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`,
      polygons,
      ...(shouldRenderAsSingleMask ? { strokeMaskPolygons: polygons } : {}),
      runtimeMeta: {
        ...primaryEntry.runtimeMeta,
        intervalIds,
        sourceSpanIds,
        sourceContourIds,
        legalDomainIds,
        visualOverlapCollapseStatus: 'render-projection-arrangement' as const
      },
      debugMeta: shouldEmitFullStrokeDiagnostics()
        ? {
            ...primaryFace.debugMeta,
            intervalIds,
            sourceSpanIds,
            sourceContourIds,
            legalDomainIds,
            figmaLikeSplitRangeTerminals:
              figmaLikeSplitRangeTerminals.length > 0
                ? figmaLikeSplitRangeTerminals
                : undefined,
            visualOverlapCollapseStatus:
              'render-projection-arrangement' as const,
            visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
            visualOverlapSourceGeometryIds: sourceGeometryIds
          }
        : undefined
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

const facePolygonsHaveInteriorOverlap = (
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][],
  leftBounds = getBounds(leftPolygons),
  rightBounds = getBounds(rightPolygons),
  step = 6
) =>
  polygonListsHaveInteriorOverlap(
    leftPolygons,
    rightPolygons,
    leftBounds,
    rightBounds,
    step
  )

const hasConstrainedDashedProductRenderOverlap = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions
) => {
  const exactBackend = getRenderIntersectionBackend(options)
  const faceBounds = faces.map((face) => getBounds(face.polygons))
  for (let leftIndex = 0; leftIndex < faces.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < faces.length;
      rightIndex += 1
    ) {
      if (!doBoundsOverlap(faceBounds[leftIndex], faceBounds[rightIndex])) {
        continue
      }

      const exactOverlapArea = exactBackend
        ? getExactPolygonListsOverlapArea(
            faces[leftIndex].polygons,
            faces[rightIndex].polygons,
            exactBackend
          )
        : null
      if (exactOverlapArea !== null) {
        if (exactOverlapArea > EXACT_RENDER_OVERLAP_AREA_EPSILON) {
          return true
        }
        continue
      }

      if (
        facePolygonsHaveInteriorOverlap(
          faces[leftIndex].polygons,
          faces[rightIndex].polygons,
          faceBounds[leftIndex],
          faceBounds[rightIndex]
        )
      ) {
        return true
      }
    }
  }
  return false
}

const hasFilledFaceBoundaryRole = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
) =>
  faces.some(
    (face) =>
      face.debugMeta?.figmaLikeBoundaryRole === 'filled-face' ||
      face.debugMeta?.figmaLikeSplitRangeTerminals?.some(
        (terminal) => terminal.boundaryRole === 'filled-face'
      ) === true
  )

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

const buildConstrainedDashedProductRenderEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions
): ReturnType<typeof buildRenderEntryFromFinalFace>[] => {
  if (!hasConstrainedDashedProductRenderOverlap(faces, options)) {
    return buildMergedRenderEntry(
      faces,
      'constrained-dashed-product-render-merged'
    )
  }

  return buildRenderProjectionArrangementEntry(
    faces,
    options,
    'constrained-dashed-product-render-projection',
    {
      allowDirectUnion: faces.some(
        (face) => face.debugMeta?.strokePosition === 'inside'
      )
        ? false
        : !hasFilledFaceBoundaryRole(faces),
      allowComponentUnion: faces.some(
        (face) => face.debugMeta?.strokePosition === 'inside'
      )
        ? false
        : undefined
    }
  )
}

const buildProjectionPacketFromFinalFace = (
  face: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >
) => ({
  geometryId: getProjectedGeometryId(face),
  polygons: face.polygons,
  bounds: face.bounds,
  primaryOwner: face.ownerSet[0],
  ownerSet: face.ownerSet,
  intervalIds: face.intervalIds,
  sourceSpanIds: face.sourceSpanIds,
  sourceContourIds: face.sourceContourIds,
  legalDomainIds: face.legalDomainIds,
  ...(shouldEmitFullStrokeDiagnostics() ? { debugMeta: face.debugMeta } : {})
})

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
  const constrainedDashedGroups = new Map<
    string,
    StrokeFinalFace<
      SolidCenterStrokeGeometryDebugMeta,
      SolidCenterStrokePaintPacket
    >[]
  >()
  const constrainedDashedGroupSlots = new Map<string, number>()

  faces.forEach((face) => {
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

    const constrainedDashedGroupKey =
      getConstrainedDashedProductRenderGroupKey(face)
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

    output.push([buildRenderEntryFromFinalFace(face)])
  })

  dashedGroups.forEach((group, groupKey) => {
    const slot = dashedGroupSlots.get(groupKey)
    if (slot !== undefined) {
      output[slot] = buildDashedCenterCollapsedRenderEntry(group, options)
    }
  })
  constrainedDashedGroups.forEach((group, groupKey) => {
    const slot = constrainedDashedGroupSlots.get(groupKey)
    if (slot !== undefined) {
      output[slot] = buildConstrainedDashedProductRenderEntry(group, options)
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

export const toSolidCenterStrokeRenderEntriesFromFinalFaces = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions = {}
) => collapseDashedCenterRenderEntries(faces, options)

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
  ;(
    graphic as T & SolidCenterStrokeRuntimeGraphic
  ).__asyraSolidCenterStrokeExportPackets =
    buildSolidCenterStrokeExportPackets(packets)
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
  ;(
    graphic as T & SolidCenterStrokeRuntimeGraphic
  ).__asyraSolidCenterStrokeExportPackets =
    buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)
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
