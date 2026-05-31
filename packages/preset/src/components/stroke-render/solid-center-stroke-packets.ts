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
    }
  }[]
  strokePathStyle?: {
    width: number
    cap: 'butt' | 'square' | 'round' | 'none'
    join: 'miter' | 'bevel' | 'round'
    miterLimit: number
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
    Partial<Pick<GeometryBackend, 'buildArrangement'>>
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

    const polygons = buildSolidCenterStrokePolygons(
      topologyPoints,
      topology.closed,
      stroke
    )
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
): SolidCenterStrokeResolvedPacket[] =>
  packets.map((packet) => ({
    geometry: (() => {
      const mergedDebugMeta = {
        ...packet.geometry.debugMeta,
        ...debugMeta
      }

      return {
        ...packet.geometry,
        debugMeta: {
          ...mergedDebugMeta,
          revisionSet:
            Object.keys(debugMeta).length === 0
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
  return polygons.length > 0 ? polygons : fallbackPolygons
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
    polygons: face.polygons,
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
  | 'render-projection-arrangement'

const buildRenderProjectionArrangementCandidates = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[]
): CandidateRegion[] =>
  faces.flatMap((face) =>
    face.polygons.map((polygon, polygonIndex) => ({
      candidateId: `${face.faceId}:render-polygon:${polygonIndex}`,
      geometry: {
        polygons: [normalizeCoveragePolygonWinding(polygon)]
      },
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
      sourceContourIds: face.sourceContourIds
    }))
  )

const buildRenderProjectionArrangementPolygons = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  backend: Pick<GeometryBackend, 'capabilities' | 'buildArrangement' | 'union'>
) => {
  const candidates = buildRenderProjectionArrangementCandidates(faces)
  const bounds = candidates.map((candidate) =>
    getBounds(candidate.geometry.polygons)
  )
  const visited = new Set<number>()
  const output: Vec2[][] = []

  candidates.forEach((candidate, startIndex) => {
    if (visited.has(startIndex)) {
      return
    }

    const stack = [startIndex]
    const componentIndexes: number[] = []
    visited.add(startIndex)

    while (stack.length > 0) {
      const currentIndex = stack.pop()
      if (currentIndex === undefined) {
        continue
      }
      componentIndexes.push(currentIndex)

      bounds.forEach((candidateBounds, nextIndex) => {
        if (
          visited.has(nextIndex) ||
          !doBoundsOverlap(bounds[currentIndex], candidateBounds)
        ) {
          return
        }
        visited.add(nextIndex)
        stack.push(nextIndex)
      })
    }

    if (componentIndexes.length === 1) {
      output.push(...candidate.geometry.polygons)
      return
    }

    const componentCandidates = componentIndexes.map(
      (index) => candidates[index]
    )
    const arrangedPolygons = backend
      .buildArrangement(componentCandidates)
      .flatMap((face) => face.geometry.polygons)

    output.push(
      ...(arrangedPolygons.length > 0
        ? arrangedPolygons
        : componentCandidates.flatMap((entry) => entry.geometry.polygons))
    )
  })

  if (output.length <= 1 || backend.capabilities.union !== true) {
    return output
  }

  try {
    return flattenFacePolygons(
      backend.union(
        output.map((polygon) => ({
          polygons: [normalizeCoveragePolygonWinding(polygon)]
        })),
        'nonzero'
      ),
      output
    )
  } catch {
    return output
  }
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
  const polygons = flattenFacePolygons(unionRegions, fallbackPolygons)
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

const buildRenderProjectionArrangementEntry = (
  faces: StrokeFinalFace<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket
  >[],
  options: SolidCenterStrokeRenderEntryOptions,
  cacheKeyPrefix: string
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
        backend
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
  return buildRenderProjectionArrangementEntry(
    faces,
    options,
    'constrained-dashed-product-render-projection'
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
