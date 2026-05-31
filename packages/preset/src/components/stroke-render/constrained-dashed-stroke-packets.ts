import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import {
  allocateStrokeIntervalsForDomainPlan,
  type allocateDashedCenterStrokeIntervals
} from './dashed-center-stroke-intervals'
import { createStrokeIntervalPointSlicer } from './stroke-interval-frames'
import { buildConstrainedDashedLocalSideStrokePolygons } from './constrained-dashed-local-side-geometry'
import { buildExactArrangementCandidatePolygons } from './constrained-solid-stroke-packets'
import {
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import type { SolidCenterStrokeRenderEntry } from './solid-center-stroke-render'
import {
  buildStrokeRuntimeRevisionSet,
  updateStrokeRuntimeRevisionSetFromMetadata
} from './stroke-dirty-keys'
import { getGeometryBackend, type PolygonRegion } from './geometry-backend'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
  isPointInsideTopologyPolygon,
  type PathTopologyModel,
  type PathTopologyFamily
} from './path-topology-model'
import {
  buildPolylineGeometryModelPath,
  samplePathSegmentFramesByLengthStep,
  slicePathSegmentPoints,
  slicePathGeometryPoints,
  type PathSegment,
  type PathGeometry,
  type PathSampleFrame,
  type PathSliceSamplingOptions
} from './path-geometry'
import { resolveSourceFamily } from './resolved-source-family'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval,
  resolveSourceSpanProvenanceAvailability
} from './source-span-graph'
import type { StrokeOwnerKey } from './stroke-final-face'
import {
  resolveStrokeDomains,
  type StrokeDomainPlan
} from './stroke-domain-plan'
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from './resolved-vector-geometry-model'

interface Vec2 {
  x: number
  y: number
}

interface SelectedSideGuardPoint extends Vec2 {
  sharp?: boolean
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ConstrainedDashedStrokeOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
    contourId?: string
    sourceContourIds?: string[]
    legalDomainId?: string | null
    legalDomainIds?: string[]
    sourceSpanIds?: string[]
    ownerSet?: StrokeOwnerKey[]
  }
  topology?: PathTopologyModel
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
    Partial<Pick<PathGeometry, 'sampledPoints'>>
  implicitFillRegions?: PolygonRegion[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
  sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  omitDiagnosticMetadata?: boolean
  visualOnly?: boolean
  enableProductVisualCompiler?: boolean
  clipInsideToFillDomain?: boolean
  constrainedDashedVisualMode?: 'product-final' | 'debug-raw'
}

export type ConstrainedDashedSourceTopology =
  | 'rectangle-equivalent'
  | 'broader-simple-closed'
  | 'sampled-simple-closed'
  | 'self-intersecting'
  | 'degenerate'
  | 'open'

export type ConstrainedDashedIntervalTopology =
  | 'full-loop'
  | 'single-edge'
  | 'corner-spanning'
  | 'seam-wrapping'
  | 'multi-corner'
  | 'other'

export interface ConstrainedDashedIntervalDescriptor {
  startDistance: number
  endDistance: number
  totalLength: number
  wrapsSeam: boolean
}

export interface ConstrainedDashedIntervalClassification {
  sourceTopology: ConstrainedDashedSourceTopology
  intervalTopology: ConstrainedDashedIntervalTopology
  acceptsFullLoopRoundJoin: boolean
  acceptsSingleEdgeRoundCap: boolean
  acceptsCornerSpanningJoin: boolean
}

export type ConstrainedDashedOwnershipStatus = 'accepted' | 'blocked'

export type ConstrainedDashedOwnershipReason =
  | 'single-owner'
  | 'typed-owners'
  | 'missing-owner-metadata'
  | 'no-packets'

export interface ConstrainedDashedOwnershipClassification {
  status: ConstrainedDashedOwnershipStatus
  reason: ConstrainedDashedOwnershipReason
  ownerKeys: string[]
  packetCount: number
}

export type ConstrainedDashedRuntimeStatus = 'accepted' | 'blocked'

export type ConstrainedDashedRuntimeReason =
  | 'single-owner'
  | 'typed-owners'
  | 'no-candidate-packets'
  | 'unsupported-open-topology'
  | 'unsupported-overlap-ownership'
  | 'unsupported-topology'
  | ConstrainedDashedOwnershipReason

export interface ConstrainedDashedRuntimeStatusInput {
  points: Vec2[]
  closed: boolean
  topology?: PathTopologyModel
  candidatePackets: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>[]
  blockedReason?: Exclude<ConstrainedDashedRuntimeReason, 'single-owner'>
}

export interface ConstrainedDashedRuntimeStatusClassification {
  status: ConstrainedDashedRuntimeStatus
  reason: ConstrainedDashedRuntimeReason
  sourceTopology: ConstrainedDashedSourceTopology
  ownership: ConstrainedDashedOwnershipClassification
}

const EPSILON = 1e-6
const SOURCE_PATH_DASH_SLICE_TOLERANCE = 0.25
const SOURCE_PATH_DASH_SLICE_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 16,
  maxCubicSamples: 256,
  useRangeLengthForSampleCount: true
}
const SOURCE_PATH_RIBBON_FRAME_TOLERANCE = 0.25
const SOURCE_PATH_RIBBON_FRAME_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 24,
  maxCubicSamples: 384,
  useRangeLengthForSampleCount: true
}
const SOURCE_PATH_DASH_SEGMENT_OVERLAP_FACTOR = 0.04
const SOURCE_PATH_DASH_SEGMENT_OVERLAP_MAX = 0.6
const SOURCE_PATH_RIBBON_FRAME_CACHE_LIMIT = 32

type DashedTopologyInterval = ReturnType<
  typeof allocateDashedIntervalsForTopology
>[number]

export type VisibleDashedTopologyInterval = DashedTopologyInterval & {
  kind: 'visible'
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
}

const buildBoundaryDomainPathForInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeBoundaryPoints' | 'figmaLikeBoundaryTotalLength'
  >
): PathGeometry | null => {
  const points = interval.figmaLikeBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  const path = buildPolylineGeometryModelPath(points, false)
  if (path.totalLength <= EPSILON) {
    return null
  }

  if (
    interval.figmaLikeBoundaryTotalLength !== undefined &&
    Math.abs(path.totalLength - interval.figmaLikeBoundaryTotalLength) >
      Math.max(1, interval.figmaLikeBoundaryTotalLength * 0.05)
  ) {
    return null
  }

  return path
}

const normalizeLoopDistance = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

const getVisibleIntervalLength = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) =>
  interval.wrapsSeam
    ? totalLength - interval.startDistance + interval.endDistance
    : interval.endDistance - interval.startDistance

type ConstrainedDashedPhysicalSpanRole = 'core' | 'start-cap' | 'end-cap'

interface ConstrainedDashedPhysicalSpan {
  spanId: string
  role: ConstrainedDashedPhysicalSpanRole
  startDistance: number
  endDistance: number
  wrapsSeam: boolean
  intervalLength: number
}

const splitLoopRangeIntoPhysicalSpans = (
  spanIdPrefix: string,
  role: ConstrainedDashedPhysicalSpanRole,
  rawStartDistance: number,
  rawEndDistance: number,
  totalLength: number
): ConstrainedDashedPhysicalSpan[] => {
  const intervalLength = rawEndDistance - rawStartDistance
  if (intervalLength <= EPSILON || totalLength <= EPSILON) {
    return []
  }

  if (intervalLength >= totalLength - EPSILON) {
    return [
      {
        spanId: `${spanIdPrefix}:${role}:0`,
        role,
        startDistance: 0,
        endDistance: totalLength,
        wrapsSeam: false,
        intervalLength: totalLength
      }
    ]
  }

  const startDistance = normalizeLoopDistance(rawStartDistance, totalLength)
  const endDistance = startDistance + intervalLength

  if (endDistance <= totalLength + EPSILON) {
    return [
      {
        spanId: `${spanIdPrefix}:${role}:0`,
        role,
        startDistance,
        endDistance: Math.min(endDistance, totalLength),
        wrapsSeam: false,
        intervalLength: Math.min(endDistance, totalLength) - startDistance
      }
    ].filter((span) => span.intervalLength > EPSILON)
  }

  return [
    {
      spanId: `${spanIdPrefix}:${role}:0`,
      role,
      startDistance,
      endDistance: totalLength,
      wrapsSeam: false,
      intervalLength: totalLength - startDistance
    },
    {
      spanId: `${spanIdPrefix}:${role}:1`,
      role,
      startDistance: 0,
      endDistance: endDistance - totalLength,
      wrapsSeam: false,
      intervalLength: endDistance - totalLength
    }
  ].filter((span) => span.intervalLength > EPSILON)
}

const splitIntervalCoreIntoPhysicalSpans = (
  spanIdPrefix: string,
  interval: VisibleDashedTopologyInterval,
  totalLength: number
): ConstrainedDashedPhysicalSpan[] =>
  interval.wrapsSeam
    ? [
        ...splitLoopRangeIntoPhysicalSpans(
          spanIdPrefix,
          'core',
          interval.startDistance,
          totalLength,
          totalLength
        ),
        ...splitLoopRangeIntoPhysicalSpans(
          spanIdPrefix,
          'core',
          0,
          interval.endDistance,
          totalLength
        )
      ]
    : splitLoopRangeIntoPhysicalSpans(
        spanIdPrefix,
        'core',
        interval.startDistance,
        interval.endDistance,
        totalLength
      )

const buildClosedSquareCapPhysicalSpans = (
  interval: VisibleDashedTopologyInterval,
  totalLength: number,
  capLength: number
): ConstrainedDashedPhysicalSpan[] => {
  const visibleLength = getVisibleIntervalLength(interval, totalLength)
  const effectiveLength = visibleLength + capLength * 2
  if (effectiveLength >= totalLength - EPSILON) {
    return splitLoopRangeIntoPhysicalSpans(
      interval.intervalId,
      'core',
      0,
      totalLength,
      totalLength
    )
  }

  if (capLength <= EPSILON) {
    return splitIntervalCoreIntoPhysicalSpans(
      interval.intervalId,
      interval,
      totalLength
    )
  }

  return splitLoopRangeIntoPhysicalSpans(
    interval.intervalId,
    'core',
    interval.startDistance - capLength,
    interval.startDistance - capLength + effectiveLength,
    totalLength
  )
}

const buildOpenSquareCapPhysicalSpans = (
  interval: VisibleDashedTopologyInterval,
  totalLength: number,
  capLength: number
): ConstrainedDashedPhysicalSpan[] => {
  if (capLength <= EPSILON || totalLength <= EPSILON) {
    return splitIntervalCoreIntoPhysicalSpans(
      interval.intervalId,
      interval,
      totalLength
    )
  }

  const startDistance = Math.max(0, interval.startDistance - capLength)
  const endDistance = Math.min(totalLength, interval.endDistance + capLength)
  if (endDistance <= startDistance + EPSILON) {
    return []
  }

  return [
    {
      spanId: `${interval.intervalId}:core:0`,
      role: 'core',
      startDistance,
      endDistance,
      wrapsSeam: false,
      intervalLength: endDistance - startDistance
    }
  ]
}

const getIntervalPhysicalSpans = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'>,
  stroke: Pick<RenderableStroke, 'cap' | 'width'>,
  interval: VisibleDashedTopologyInterval
): ConstrainedDashedPhysicalSpan[] => {
  if (stroke.cap === 'square' && topology.closed && stroke.width > EPSILON) {
    return buildClosedSquareCapPhysicalSpans(
      interval,
      topology.totalLength,
      stroke.width / 2
    )
  }

  if (
    stroke.cap === 'square' &&
    !topology.closed &&
    stroke.width > EPSILON &&
    (interval.figmaLikeSplitRangeId !== undefined ||
      interval.figmaLikeBoundaryDomainId !== undefined)
  ) {
    return buildOpenSquareCapPhysicalSpans(
      interval,
      topology.totalLength,
      stroke.width / 2
    )
  }

  const intervalLength = getVisibleIntervalLength(
    interval,
    topology.totalLength
  )
  if (intervalLength <= EPSILON) {
    return []
  }

  return [
    {
      spanId: interval.intervalId,
      role: 'core',
      startDistance: interval.startDistance,
      endDistance: interval.endDistance,
      wrapsSeam: interval.wrapsSeam,
      intervalLength
    }
  ]
}

export const getConstrainedDashedVisibleIntervals = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'> &
    Partial<Pick<PathTopologyModel, 'topologyFamily'>>,
  stroke: Pick<
    RenderableStroke,
    'cap' | 'dashPattern' | 'dashOffset' | 'width'
  >,
  sourcePath?:
    | (Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
        Partial<Pick<PathGeometry, 'sampledPoints'>>)
    | undefined,
  strokeDomainPlan?: Pick<
    StrokeDomainPlan,
    | 'planId'
    | 'intervalDomainKind'
    | 'totalLength'
    | 'closed'
    | 'splitRangeDomains'
    | 'legalBoundaryDomains'
    | 'sideResolutionContext'
  >
): VisibleDashedTopologyInterval[] => {
  if (
    strokeDomainPlan?.intervalDomainKind === 'figma-like-split-range' &&
    strokeDomainPlan.splitRangeDomains.length > 0
  ) {
    let visibleIntervalIndex = 0
    return allocateStrokeIntervalsForDomainPlan({
      domainPlan: strokeDomainPlan,
      dashPattern: stroke.dashPattern,
      dashOffset: stroke.dashOffset
    }).flatMap((allocation) => {
      const visibleIntervals = allocation.intervals.filter(
        (interval): interval is VisibleDashedTopologyInterval =>
          interval.kind === 'visible'
      )

      return visibleIntervals.map((interval) => {
        const intervalId = `interval:${visibleIntervalIndex}`
        visibleIntervalIndex += 1
        const resolvedInterval = {
          ...interval,
          intervalId,
          previousVisibleIntervalId: null,
          nextVisibleIntervalId: null
        }
        return resolvedInterval
      })
    })
  }

  if (stroke.cap === 'square' && !topology.closed && stroke.width > EPSILON) {
    const squareCapGrowth = stroke.width
    const intervalAllocationDashPattern = stroke.dashPattern.map(
      (entry, index) =>
        index % 2 === 0
          ? Math.max(EPSILON, entry + squareCapGrowth)
          : Math.max(EPSILON, entry - squareCapGrowth)
    )
    return allocateDashedIntervalsForTopology(
      topology,
      intervalAllocationDashPattern,
      stroke.dashOffset + stroke.width / 2
    ).filter(
      (interval): interval is VisibleDashedTopologyInterval =>
        interval.kind === 'visible'
    )
  }

  const authoredIntervals = allocateDashedIntervalsForTopology(
    topology,
    stroke.dashPattern,
    stroke.dashOffset
  ).filter(
    (interval): interval is VisibleDashedTopologyInterval =>
      interval.kind === 'visible'
  )

  return authoredIntervals
}

const buildVisibleIntervalSignature = (
  intervals: ReturnType<typeof allocateDashedCenterStrokeIntervals>
) =>
  intervals
    .map((interval) =>
      [
        interval.kind,
        interval.intervalId,
        interval.authoredIndex,
        interval.startDistance.toFixed(6),
        interval.endDistance.toFixed(6),
        interval.wrapsSeam ? 'wrap' : 'nowrap',
        interval.previousVisibleIntervalId ?? 'none',
        interval.nextVisibleIntervalId ?? 'none'
      ].join(':')
    )
    .join('|')

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

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

const clampPolygonPointsToBounds = (
  polygons: Vec2[][],
  bounds: Bounds
): Vec2[][] =>
  polygons.map((polygon) =>
    polygon.map((point) => ({
      x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y))
    }))
  )

export const supportsConstrainedDashedStroke = (
  stroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  _closed: boolean
) =>
  stroke.style === 'dashed' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  stroke.dashPattern.length > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const hasPositiveRawDashPattern = (stroke: StrokeAttrs) => {
  const sourcePattern = Array.isArray(stroke.dashPattern)
    ? stroke.dashPattern
    : []

  return sourcePattern.some((entry) => Number.isFinite(entry) && entry > 0)
}

export const hasConstrainedDashedStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
      stroke.style === 'dashed' &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      stroke.width > 0 &&
      hasPositiveRawDashPattern(stroke)
  ) === true

const isFullLoopVisibleInterval = (
  startDistance: number,
  endDistance: number,
  totalLength: number,
  wrapsSeam: boolean
) =>
  !wrapsSeam &&
  Math.abs(startDistance) <= EPSILON &&
  Math.abs(endDistance - totalLength) <= EPSILON

const getClosedSegmentRanges = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return []
  }

  const segments = []
  let cursor = 0

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    const startDistance = cursor
    const endDistance = cursor + length
    cursor = endDistance
    segments.push({
      index,
      startDistance,
      endDistance
    })
  }

  return segments
}

const findClosedSegmentIndexForDistance = (
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  distance: number
) =>
  segmentRanges.findIndex(
    (segment) =>
      distance > segment.startDistance + EPSILON &&
      distance < segment.endDistance - EPSILON
  )

const isDistanceWithinClosedSegmentRange = (
  segment: ReturnType<typeof getClosedSegmentRanges>[number],
  distance: number
) =>
  distance >= segment.startDistance - EPSILON &&
  distance <= segment.endDistance + EPSILON

const _isSingleEdgeVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  return segmentRanges.some(
    (segment) =>
      isDistanceWithinClosedSegmentRange(segment, startDistance) &&
      isDistanceWithinClosedSegmentRange(segment, endDistance)
  )
}

const getCanonicalClosedLoopPoints = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) <= EPSILON &&
    Math.abs(first.y - last.y) <= EPSILON
  ) {
    return points.slice(0, -1)
  }

  return points
}

const isOrthogonalRectLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    return (
      closed &&
      loopPoints.length === 4 &&
      loopPoints.every((point, index) => {
        const next = loopPoints[(index + 1) % loopPoints.length]
        return (
          Math.abs(point.x - next.x) <= EPSILON ||
          Math.abs(point.y - next.y) <= EPSILON
        )
      })
    )
  })()

const isSingleObliqueQuadrilateralLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    if (!closed || loopPoints.length !== 4) {
      return false
    }

    let horizontalEdges = 0
    let verticalEdges = 0
    let obliqueEdges = 0

    loopPoints.forEach((point, index) => {
      const next = loopPoints[(index + 1) % loopPoints.length]
      const dx = Math.abs(point.x - next.x)
      const dy = Math.abs(point.y - next.y)

      if (dx <= EPSILON && dy <= EPSILON) {
        return
      }

      if (dy <= EPSILON) {
        horizontalEdges += 1
        return
      }

      if (dx <= EPSILON) {
        verticalEdges += 1
        return
      }

      obliqueEdges += 1
    })

    return horizontalEdges === 2 && verticalEdges === 1 && obliqueEdges === 1
  })()

const _isSingleCornerSpanningVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  if (wrapsSeam) {
    return false
  }

  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    endDistance
  )

  return (
    startSegmentIndex >= 0 &&
    endSegmentIndex >= 0 &&
    endSegmentIndex === startSegmentIndex + 1
  )
}

const isSmoothSampledClosedLoop = (points: Vec2[], closed: boolean) => {
  const loopPoints = getCanonicalClosedLoopPoints(points, closed)
  if (!closed || loopPoints.length < 12) {
    return false
  }

  return loopPoints.every((point, index) => {
    const previous =
      loopPoints[(index - 1 + loopPoints.length) % loopPoints.length]
    const next = loopPoints[(index + 1) % loopPoints.length]
    const incoming = normalizeVector({
      x: point.x - previous.x,
      y: point.y - previous.y
    })
    const outgoing = normalizeVector({
      x: next.x - point.x,
      y: next.y - point.y
    })

    if (!incoming || !outgoing) {
      return false
    }

    const dot = Math.max(
      -1,
      Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
    )
    return Math.acos(dot) <= Math.PI / 4
  })
}

export const classifyConstrainedDashedSource = (
  points: Vec2[],
  closed: boolean,
  topology?: PathTopologyModel
): ConstrainedDashedSourceTopology => {
  if (topology) {
    return mapPathTopologyFamilyToConstrainedDashedSource(
      topology.topologyFamily
    )
  }

  if (!closed) {
    return 'open'
  }

  if (isOrthogonalRectLoop(points, closed)) {
    return 'rectangle-equivalent'
  }

  if (isSingleObliqueQuadrilateralLoop(points, closed)) {
    return 'broader-simple-closed'
  }

  return 'sampled-simple-closed'
}

const mapPathTopologyFamilyToConstrainedDashedSource = (
  topologyFamily: PathTopologyFamily
): ConstrainedDashedSourceTopology => {
  return topologyFamily
}

const classifyConstrainedDashedIntervalTopology = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor
): ConstrainedDashedIntervalTopology =>
  classifyConstrainedDashedIntervalTopologyFromRanges(
    points,
    closed,
    interval,
    getClosedSegmentRanges(points, closed)
  )

const classifyConstrainedDashedIntervalTopologyFromRanges = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
): ConstrainedDashedIntervalTopology => {
  if (
    isFullLoopVisibleInterval(
      interval.startDistance,
      interval.endDistance,
      interval.totalLength,
      interval.wrapsSeam
    )
  ) {
    return 'full-loop'
  }

  if (interval.wrapsSeam) {
    return 'seam-wrapping'
  }

  if (
    segmentRanges.length > 0 &&
    segmentRanges.some(
      (segment) =>
        isDistanceWithinClosedSegmentRange(segment, interval.startDistance) &&
        isDistanceWithinClosedSegmentRange(segment, interval.endDistance)
    )
  ) {
    return 'single-edge'
  }

  if (
    !interval.wrapsSeam &&
    (() => {
      const startSegmentIndex = findClosedSegmentIndexForDistance(
        segmentRanges,
        interval.startDistance
      )
      const endSegmentIndex = findClosedSegmentIndexForDistance(
        segmentRanges,
        interval.endDistance
      )

      return (
        startSegmentIndex >= 0 &&
        endSegmentIndex >= 0 &&
        endSegmentIndex === startSegmentIndex + 1
      )
    })()
  ) {
    return 'corner-spanning'
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    interval.startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    interval.endDistance
  )

  if (
    startSegmentIndex >= 0 &&
    endSegmentIndex >= 0 &&
    endSegmentIndex > startSegmentIndex + 1
  ) {
    return 'multi-corner'
  }

  return 'other'
}

const acceptsFullLoopRoundJoin = (
  sourceTopology: ConstrainedDashedSourceTopology,
  points: Vec2[],
  closed: boolean,
  stroke: Pick<RenderableStroke, 'join'>
) => {
  if (stroke.join !== 'round') {
    return false
  }

  if (
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed' ||
    sourceTopology === 'self-intersecting'
  ) {
    return true
  }

  if (sourceTopology === 'sampled-simple-closed') {
    return isSmoothSampledClosedLoop(points, closed)
  }

  return false
}

const acceptsSingleEdgeRoundCap = (
  sourceTopology: ConstrainedDashedSourceTopology,
  stroke: Pick<RenderableStroke, 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return false
  }

  return (
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed'
  )
}

const acceptsCornerSpanningJoin = (
  sourceTopology: ConstrainedDashedSourceTopology,
  stroke: Pick<RenderableStroke, 'join'>
) => {
  const acceptsBevelFamily = stroke.join === 'bevel' || stroke.join === 'round'
  const acceptsMiterFamily = stroke.join === 'miter'
  const supportedSource =
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed'

  return supportedSource && (acceptsBevelFamily || acceptsMiterFamily)
}

export const classifyConstrainedDashedInterval = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  stroke: Pick<RenderableStroke, 'position' | 'join' | 'cap'>,
  options: ConstrainedDashedStrokeOptions = {}
): ConstrainedDashedIntervalClassification => {
  const sourceTopology = classifyConstrainedDashedSource(
    points,
    closed,
    options.topology
  )
  const intervalTopology = classifyConstrainedDashedIntervalTopology(
    points,
    closed,
    interval
  )

  return {
    sourceTopology,
    intervalTopology,
    acceptsFullLoopRoundJoin:
      intervalTopology === 'full-loop' &&
      acceptsFullLoopRoundJoin(sourceTopology, points, closed, stroke),
    acceptsSingleEdgeRoundCap:
      intervalTopology === 'single-edge' &&
      acceptsSingleEdgeRoundCap(sourceTopology, stroke),
    acceptsCornerSpanningJoin:
      intervalTopology === 'corner-spanning' &&
      acceptsCornerSpanningJoin(sourceTopology, stroke)
  }
}

const classifyConstrainedDashedIntervalWithContext = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  stroke: Pick<RenderableStroke, 'position' | 'join' | 'cap'>,
  sourceTopology: ConstrainedDashedSourceTopology,
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
): ConstrainedDashedIntervalClassification => {
  const intervalTopology =
    sourceTopology === 'open'
      ? 'other'
      : classifyConstrainedDashedIntervalTopologyFromRanges(
          points,
          closed,
          interval,
          segmentRanges
        )

  return {
    sourceTopology,
    intervalTopology,
    acceptsFullLoopRoundJoin:
      intervalTopology === 'full-loop' &&
      acceptsFullLoopRoundJoin(sourceTopology, points, closed, stroke),
    acceptsSingleEdgeRoundCap:
      intervalTopology === 'single-edge' &&
      acceptsSingleEdgeRoundCap(sourceTopology, stroke),
    acceptsCornerSpanningJoin:
      intervalTopology === 'corner-spanning' &&
      acceptsCornerSpanningJoin(sourceTopology, stroke)
  }
}

const classifySourcePathSampledSimpleDashedInterval = (
  sourceTopology: ConstrainedDashedSourceTopology
): ConstrainedDashedIntervalClassification => ({
  sourceTopology,
  intervalTopology: 'other',
  acceptsFullLoopRoundJoin: false,
  acceptsSingleEdgeRoundCap: false,
  acceptsCornerSpanningJoin: false
})

const getConstrainedDashedPacketOwnerKey = (
  packet: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>
) => packet.geometry.debugMeta?.ownerKey ?? null

export const classifyConstrainedDashedOwnership = (
  packets: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>[]
): ConstrainedDashedOwnershipClassification => {
  if (packets.length === 0) {
    return {
      status: 'blocked',
      reason: 'no-packets',
      ownerKeys: [],
      packetCount: 0
    }
  }

  const parsedOwnerKeys = packets.map(getConstrainedDashedPacketOwnerKey)
  const ownerKeys = parsedOwnerKeys.filter(
    (ownerKey): ownerKey is string => ownerKey !== null
  )

  if (ownerKeys.length !== packets.length) {
    return {
      status: 'blocked',
      reason: 'missing-owner-metadata',
      ownerKeys,
      packetCount: packets.length
    }
  }

  const uniqueOwnerKeys = [...new Set(ownerKeys)]

  return {
    status: 'accepted',
    reason: uniqueOwnerKeys.length === 1 ? 'single-owner' : 'typed-owners',
    ownerKeys: uniqueOwnerKeys,
    packetCount: packets.length
  }
}

export const classifyConstrainedDashedRuntimeStatus = ({
  points,
  closed,
  topology,
  candidatePackets,
  blockedReason
}: ConstrainedDashedRuntimeStatusInput): ConstrainedDashedRuntimeStatusClassification => {
  const sourceTopology = classifyConstrainedDashedSource(
    points,
    closed,
    topology
  )
  const ownership = classifyConstrainedDashedOwnership(candidatePackets)

  if (ownership.status === 'accepted') {
    return {
      status: 'accepted',
      reason: ownership.reason,
      sourceTopology,
      ownership
    }
  }

  if (sourceTopology === 'open') {
    return {
      status: 'blocked',
      reason: blockedReason ?? 'no-candidate-packets',
      sourceTopology,
      ownership
    }
  }

  if (
    sourceTopology === 'self-intersecting' ||
    sourceTopology === 'degenerate'
  ) {
    return {
      status: 'blocked',
      reason: blockedReason ?? 'unsupported-topology',
      sourceTopology,
      ownership
    }
  }

  return {
    status: 'blocked',
    reason: blockedReason ?? ownership.reason,
    sourceTopology,
    ownership
  }
}

const normalizeVector = (point: Vec2) => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPSILON) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

const isSupportedConstrainedDashedInterval = (
  classification: ConstrainedDashedIntervalClassification,
  stroke: RenderableStroke
) => {
  if (classification.sourceTopology === 'open') {
    return true
  }

  if (classification.sourceTopology === 'degenerate') {
    return false
  }

  if (classification.sourceTopology === 'self-intersecting') {
    return true
  }

  if (classification.sourceTopology === 'sampled-simple-closed') {
    return classification.intervalTopology !== 'full-loop'
  }

  if (classification.intervalTopology === 'single-edge') {
    return stroke.cap === 'round'
      ? classification.acceptsSingleEdgeRoundCap
      : classification.sourceTopology === 'rectangle-equivalent' ||
          classification.sourceTopology === 'broader-simple-closed'
  }

  if (classification.intervalTopology === 'corner-spanning') {
    return classification.acceptsCornerSpanningJoin
  }

  return (
    classification.sourceTopology === 'rectangle-equivalent' ||
    classification.sourceTopology === 'broader-simple-closed' ||
    classification.sourceTopology === 'self-intersecting'
  )
}

const getConstrainedDashedResolutionStatus = (
  sourceTopology: ConstrainedDashedSourceTopology,
  intervalTopology?: ConstrainedDashedIntervalTopology,
  forceLocalSideApproximation = false
): Exclude<
  SolidCenterStrokeGeometryDebugMeta['resolutionStatus'],
  undefined
> =>
  forceLocalSideApproximation ||
  (sourceTopology === 'sampled-simple-closed' &&
    intervalTopology !== 'full-loop')
    ? 'local-side-approximation'
    : 'exact-constrained'

const getIntervalStrokeForSourceDirection = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke,
  topologyFamily?: PathTopologyFamily
): Pick<
  RenderableStroke,
  'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
> => {
  if (!closed || topologyFamily === 'self-intersecting') {
    return {
      ...stroke,
      style: 'solid'
    }
  }

  const loopArea = polygonArea(getCanonicalClosedLoopPoints(points, closed))
  const position =
    loopArea >= 0
      ? stroke.position
      : stroke.position === 'inside'
        ? 'outside'
        : 'inside'

  return {
    ...stroke,
    style: 'solid',
    position
  }
}

const normalizePoint = (point: Vec2): Vec2 => ({
  x: Math.abs(point.x) <= EPSILON ? 0 : point.x,
  y: Math.abs(point.y) <= EPSILON ? 0 : point.y
})

interface ClipEdge {
  start: Vec2
  end: Vec2
  dx: number
  dy: number
}

interface ClosedIntervalLegalityContext {
  orientation: number
  clipEdges: ClipEdge[]
}

const buildClipEdges = (boundary: Vec2[]): ClipEdge[] =>
  boundary.map((start, index) => {
    const end = boundary[(index + 1) % boundary.length]
    return {
      start,
      end,
      dx: end.x - start.x,
      dy: end.y - start.y
    }
  })

const isInsideHalfPlane = (
  point: Vec2,
  edge: ClipEdge,
  orientation: number
) => {
  const cross =
    edge.dx * (point.y - edge.start.y) - edge.dy * (point.x - edge.start.x)
  return orientation > 0 ? cross >= -EPSILON : cross <= EPSILON
}

const lineIntersection = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2
): Vec2 => {
  const x1 = segmentStart.x
  const y1 = segmentStart.y
  const x2 = segmentEnd.x
  const y2 = segmentEnd.y
  const x3 = edgeStart.x
  const y3 = edgeStart.y
  const x4 = edgeEnd.x
  const y4 = edgeEnd.y

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denominator) <= EPSILON) {
    return normalizePoint(segmentEnd)
  }

  const determinant1 = x1 * y2 - y1 * x2
  const determinant2 = x3 * y4 - y3 * x4

  return normalizePoint({
    x: (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator,
    y: (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator
  })
}

const clipPolygonToClosedLegalDomain = (
  polygon: Vec2[],
  boundary: ClipEdge[],
  orientation: number
) => {
  let output = polygon.map(normalizePoint)

  for (const edge of boundary) {
    const input = output
    output = []
    if (input.length === 0) {
      break
    }

    input.forEach((current, currentIndex) => {
      const previous = input[(currentIndex - 1 + input.length) % input.length]
      const currentInside = isInsideHalfPlane(current, edge, orientation)
      const previousInside = isInsideHalfPlane(previous, edge, orientation)

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, edge.start, edge.end))
        }
        output.push(current)
        return
      }

      if (previousInside) {
        output.push(lineIntersection(previous, current, edge.start, edge.end))
      }
    })
  }

  return output
}

const applyClosedIntervalLegality = (
  polygons: Vec2[][],
  context: ClosedIntervalLegalityContext | null
) => {
  if (!context) {
    return polygons
  }
  if (context.clipEdges.length === 0) {
    return []
  }

  return polygons
    .map((polygon) =>
      clipPolygonToClosedLegalDomain(
        polygon,
        context.clipEdges,
        context.orientation
      )
    )
    .filter((polygon) => polygon.length >= 3)
}

const buildClosedIntervalLegalityContext = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): ClosedIntervalLegalityContext | null => {
  if (!closed || stroke.position !== 'inside') {
    return null
  }

  const boundary = getCanonicalClosedLoopPoints(points, closed)
  const orientationArea = polygonArea(boundary)
  if (boundary.length < 3 || Math.abs(orientationArea) <= EPSILON) {
    return {
      orientation: 1,
      clipEdges: []
    }
  }

  return {
    orientation: orientationArea > 0 ? 1 : -1,
    clipEdges: buildClipEdges(boundary)
  }
}

const normalizeDistanceOnLoop = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

interface SourcePathSegmentRange {
  index: number
  startDistance: number
  endDistance: number
}

interface SourceSegmentIntervalRange {
  startDistance: number
  endDistance: number
  segmentIndex: number
}

interface DashedSourcePathIntervalSweepRange {
  range: SourceSegmentIntervalRange
  span: ConstrainedDashedPhysicalSpan
  renderRange: SourceSegmentIntervalRange
  capOwnership: ReturnType<typeof getSourcePathRangeRoundCapOwnership>
}

interface DashedSourcePathIntervalSweep {
  ranges: DashedSourcePathIntervalSweepRange[]
}

interface SourcePathSegmentSample {
  points: Vec2[]
  cumulativeDistances: number[]
  polylineLength: number
}

interface ExactSourcePathRibbonSegmentFrame {
  segmentIndex: number
  segmentLength: number
  frames: PathSampleFrame[]
  distances: number[]
}

interface ExactSourcePathRibbonFrame {
  segmentFrames: ExactSourcePathRibbonSegmentFrame[]
}

interface OffsetPathSampleFrame extends PathSampleFrame {
  offsetPoint: Vec2
}

interface ExactSourcePathOffsetRibbonSegmentFrame {
  segmentIndex: number
  segmentLength: number
  frames: OffsetPathSampleFrame[]
  distances: number[]
}

interface ExactSourcePathOffsetRibbonFrame {
  segmentFrames: ExactSourcePathOffsetRibbonSegmentFrame[]
}

const exactSourcePathRibbonFrameCache = new Map<
  string,
  ExactSourcePathRibbonFrame
>()
const exactSourcePathRibbonSegmentFrameCache = new Map<
  string,
  ExactSourcePathRibbonSegmentFrame
>()

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

const measureStrokePipelinePhase = <T>(phaseName: string, run: () => T): T => {
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
interface SourcePathSlicingContext {
  segmentRanges: SourcePathSegmentRange[]
  segmentSamples: Map<number, SourcePathSegmentSample>
  exactRibbonFrame: ExactSourcePathRibbonFrame
  offsetRibbonFrames: Map<string, ExactSourcePathOffsetRibbonFrame>
  splitRangeCache: Map<string, SourceSegmentIntervalRange[]>
  pointSliceCache: Map<string, Vec2[]>
  ribbonPolygonCache: Map<string, Vec2[][] | null>
  segmentBoundaryCache: Map<number, Vec2[]>
  segmentBoundaryClipCache: Map<string, SourceSegmentBoundaryClipData>
  samplingTolerance: number
  samplingOptions: PathSliceSamplingOptions
}

interface SourceSegmentBoundaryClipData {
  boundary: Vec2[]
  head: Vec2[]
  tail: Vec2[]
  headReference: Vec2 | undefined
  tailReference: Vec2 | undefined
}

const getSourcePathSegmentRanges = (path: Pick<PathGeometry, 'segments'>) => {
  let cursor = 0
  return path.segments.map((segment, index) => {
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const formatSourcePathRangeKeyDistance = (distance: number) =>
  distance.toFixed(6)

const buildSourcePathSplitCacheKey = (
  startDistance: number,
  endDistance: number,
  wrapsSeam = false
) =>
  `${wrapsSeam ? 'wrap' : 'range'}:${formatSourcePathRangeKeyDistance(
    startDistance
  )}:${formatSourcePathRangeKeyDistance(endDistance)}`

const buildSourcePathSliceCacheKey = (
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole
) =>
  `${range.segmentIndex}:${role}:${formatSourcePathRangeKeyDistance(
    range.startDistance
  )}:${formatSourcePathRangeKeyDistance(range.endDistance)}`

const buildSourcePathSegmentSample = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): SourcePathSegmentSample => {
  const segment = path.segments[range.index]
  const points = segment
    ? slicePathGeometryPoints(
        {
          segments: [segment],
          closed: false,
          totalLength: segment.length
        },
        0,
        segment.length,
        false,
        samplingTolerance,
        samplingOptions
      )
    : []
  const normalizedPoints =
    points.length >= 2 ? points : segment ? [segment.start, segment.end] : []
  const cumulativeDistances = [0]
  for (let index = 1; index < normalizedPoints.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[cumulativeDistances.length - 1] +
        distanceBetween(normalizedPoints[index - 1], normalizedPoints[index])
    )
  }

  return {
    points: normalizedPoints,
    cumulativeDistances,
    polylineLength: cumulativeDistances[cumulativeDistances.length - 1] ?? 0
  }
}

const formatRibbonFrameKeyPoint = (point: Vec2) =>
  `${point.x.toFixed(4)},${point.y.toFixed(4)}`

const buildExactSourcePathRibbonSegmentFrameCacheKey = (
  segment: PathGeometry['segments'][number],
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) =>
  [
    samplingTolerance.toFixed(4),
    samplingOptions.minCubicSamples ?? 'default-min',
    samplingOptions.maxCubicSamples ?? 'default-max',
    samplingOptions.useRangeLengthForSampleCount === true ? 'range' : 'curve',
    segment.type === 'line'
      ? [
          'line',
          formatRibbonFrameKeyPoint(segment.start),
          formatRibbonFrameKeyPoint(segment.end),
          segment.length.toFixed(4),
          segment.startAnchorType ?? 'none',
          segment.endAnchorType ?? 'none'
        ].join(':')
      : [
          'cubic',
          formatRibbonFrameKeyPoint(segment.start),
          formatRibbonFrameKeyPoint(segment.control1),
          formatRibbonFrameKeyPoint(segment.control2),
          formatRibbonFrameKeyPoint(segment.end),
          segment.length.toFixed(4),
          segment.startAnchorType ?? 'none',
          segment.endAnchorType ?? 'none'
        ].join(':')
  ].join('|')

const buildExactSourcePathRibbonFrameCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) =>
  [
    path.closed ? 'closed' : 'open',
    path.totalLength.toFixed(4),
    samplingTolerance.toFixed(4),
    samplingOptions.minCubicSamples ?? 'default-min',
    samplingOptions.maxCubicSamples ?? 'default-max',
    samplingOptions.useRangeLengthForSampleCount === true ? 'range' : 'curve',
    ...path.segments.map((segment) =>
      segment.type === 'line'
        ? [
            'line',
            formatRibbonFrameKeyPoint(segment.start),
            formatRibbonFrameKeyPoint(segment.end),
            segment.length.toFixed(4),
            segment.startAnchorType ?? 'none',
            segment.endAnchorType ?? 'none'
          ].join(':')
        : [
            'cubic',
            formatRibbonFrameKeyPoint(segment.start),
            formatRibbonFrameKeyPoint(segment.control1),
            formatRibbonFrameKeyPoint(segment.control2),
            formatRibbonFrameKeyPoint(segment.end),
            segment.length.toFixed(4),
            segment.startAnchorType ?? 'none',
            segment.endAnchorType ?? 'none'
          ].join(':')
    )
  ].join('|')

const buildExactSourcePathRibbonSegmentFrame = (
  path: Pick<PathGeometry, 'segments'>,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): ExactSourcePathRibbonSegmentFrame => {
  const segment = path.segments[range.index]
  const frames = segment
    ? samplePathSegmentFramesByLengthStep(
        segment,
        0,
        segment.length,
        samplingTolerance,
        samplingOptions
      )
    : []
  const cumulativeDistances = [0]
  for (let index = 1; index < frames.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[cumulativeDistances.length - 1] +
        distanceBetween(frames[index - 1].point, frames[index].point)
    )
  }
  const polylineLength =
    cumulativeDistances[cumulativeDistances.length - 1] ?? 0
  const scale =
    segment && polylineLength > EPSILON ? segment.length / polylineLength : 1
  const lastIndex = Math.max(1, frames.length - 1)
  return {
    segmentIndex: range.index,
    segmentLength: segment?.length ?? 0,
    frames,
    distances:
      polylineLength > EPSILON
        ? cumulativeDistances.map((distance) => distance * scale)
        : frames.map((_, index) =>
            segment ? (segment.length * index) / lastIndex : 0
          )
  }
}

const getExactSourcePathRibbonSegmentFrame = (
  path: Pick<PathGeometry, 'segments'>,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) => {
  const segment = path.segments[range.index]
  if (!segment) {
    return buildExactSourcePathRibbonSegmentFrame(
      path,
      range,
      samplingTolerance,
      samplingOptions
    )
  }

  const cacheKey = buildExactSourcePathRibbonSegmentFrameCacheKey(
    segment,
    samplingTolerance,
    samplingOptions
  )
  const cached = exactSourcePathRibbonSegmentFrameCache.get(cacheKey)
  if (cached) {
    emitStrokePipelineCounter('source-path-ribbon-segment-frame-cache-hit')
    exactSourcePathRibbonSegmentFrameCache.delete(cacheKey)
    exactSourcePathRibbonSegmentFrameCache.set(cacheKey, cached)
    return {
      ...cached,
      segmentIndex: range.index
    }
  }

  emitStrokePipelineCounter('source-path-ribbon-segment-frame-cache-miss')
  const frame = buildExactSourcePathRibbonSegmentFrame(
    path,
    range,
    samplingTolerance,
    samplingOptions
  )
  exactSourcePathRibbonSegmentFrameCache.set(cacheKey, frame)
  if (
    exactSourcePathRibbonSegmentFrameCache.size >
    SOURCE_PATH_RIBBON_FRAME_CACHE_LIMIT * 8
  ) {
    const [oldestKey] = exactSourcePathRibbonSegmentFrameCache.keys()
    if (oldestKey) {
      exactSourcePathRibbonSegmentFrameCache.delete(oldestKey)
    }
  }
  return frame
}

const buildExactSourcePathRibbonFrame = (
  path: Pick<PathGeometry, 'segments'>,
  segmentRanges: SourcePathSegmentRange[],
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): ExactSourcePathRibbonFrame => ({
  segmentFrames: segmentRanges.map((range) =>
    getExactSourcePathRibbonSegmentFrame(
      path,
      range,
      samplingTolerance,
      samplingOptions
    )
  )
})

const getExactSourcePathRibbonFrame = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  segmentRanges: SourcePathSegmentRange[],
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) => {
  const cacheKey = buildExactSourcePathRibbonFrameCacheKey(
    path,
    samplingTolerance,
    samplingOptions
  )
  const cached = exactSourcePathRibbonFrameCache.get(cacheKey)
  if (cached) {
    emitStrokePipelineCounter('source-path-ribbon-frame-cache-hit')
    exactSourcePathRibbonFrameCache.delete(cacheKey)
    exactSourcePathRibbonFrameCache.set(cacheKey, cached)
    return cached
  }

  emitStrokePipelineCounter('source-path-ribbon-frame-cache-miss')
  const frame = buildExactSourcePathRibbonFrame(
    path,
    segmentRanges,
    samplingTolerance,
    samplingOptions
  )
  exactSourcePathRibbonFrameCache.set(cacheKey, frame)
  if (
    exactSourcePathRibbonFrameCache.size > SOURCE_PATH_RIBBON_FRAME_CACHE_LIMIT
  ) {
    const [oldestKey] = exactSourcePathRibbonFrameCache.keys()
    if (oldestKey) {
      exactSourcePathRibbonFrameCache.delete(oldestKey)
    }
  }
  return frame
}

const createSourcePathSlicingContext = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  samplingTolerance = SOURCE_PATH_DASH_SLICE_TOLERANCE,
  samplingOptions = SOURCE_PATH_DASH_SLICE_SAMPLING
): SourcePathSlicingContext => {
  const segmentRanges = getSourcePathSegmentRanges(path)
  return {
    segmentRanges,
    segmentSamples: new Map(),
    exactRibbonFrame: getExactSourcePathRibbonFrame(
      path,
      segmentRanges,
      SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
      SOURCE_PATH_RIBBON_FRAME_SAMPLING
    ),
    offsetRibbonFrames: new Map(),
    splitRangeCache: new Map(),
    pointSliceCache: new Map(),
    ribbonPolygonCache: new Map(),
    segmentBoundaryCache: new Map(),
    segmentBoundaryClipCache: new Map(),
    samplingTolerance,
    samplingOptions
  }
}

const getSourcePathSegmentSample = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourcePathSegmentRange,
  slicingContext: SourcePathSlicingContext
) => {
  const cached = slicingContext.segmentSamples.get(range.index)
  if (cached) {
    return cached
  }

  const sample = buildSourcePathSegmentSample(
    path,
    range,
    slicingContext.samplingTolerance,
    slicingContext.samplingOptions
  )
  slicingContext.segmentSamples.set(range.index, sample)
  return sample
}

const interpolateSourcePathSamplePoint = (
  sample: SourcePathSegmentSample,
  distance: number
): Vec2 | null => {
  if (sample.points.length === 0) {
    return null
  }
  if (sample.points.length === 1 || sample.polylineLength <= EPSILON) {
    return sample.points[0]
  }

  const clampedDistance = Math.max(0, Math.min(sample.polylineLength, distance))
  for (let index = 1; index < sample.points.length; index += 1) {
    const previousDistance = sample.cumulativeDistances[index - 1]
    const nextDistance = sample.cumulativeDistances[index]
    if (clampedDistance > nextDistance + EPSILON) {
      continue
    }

    const segmentLength = nextDistance - previousDistance
    const t =
      segmentLength > EPSILON
        ? (clampedDistance - previousDistance) / segmentLength
        : 0
    const previous = sample.points[index - 1]
    const next = sample.points[index]
    return normalizePoint({
      x: previous.x + (next.x - previous.x) * t,
      y: previous.y + (next.y - previous.y) * t
    })
  }

  return sample.points[sample.points.length - 1]
}

const dedupeSourcePathSlicePoints = (points: Vec2[]) => {
  if (points.length <= 1) {
    return points
  }

  const result = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    if (distanceBetween(result[result.length - 1], points[index]) > EPSILON) {
      result.push(points[index])
    }
  }
  return result
}

const sliceSourcePathSegmentSamplePoints = (
  sample: SourcePathSegmentSample,
  segmentLength: number,
  localStartDistance: number,
  localEndDistance: number
) => {
  if (sample.points.length < 2 || sample.polylineLength <= EPSILON) {
    return []
  }

  const scale =
    segmentLength > EPSILON ? sample.polylineLength / segmentLength : 1
  const startDistance = Math.max(0, localStartDistance * scale)
  const endDistance = Math.min(sample.polylineLength, localEndDistance * scale)
  if (endDistance - startDistance <= EPSILON) {
    return []
  }

  const startPoint = interpolateSourcePathSamplePoint(sample, startDistance)
  const endPoint = interpolateSourcePathSamplePoint(sample, endDistance)
  if (!startPoint || !endPoint) {
    return []
  }

  const points = [startPoint]
  for (let index = 1; index < sample.points.length - 1; index += 1) {
    const distance = sample.cumulativeDistances[index]
    if (
      distance > startDistance + EPSILON &&
      distance < endDistance - EPSILON
    ) {
      points.push(sample.points[index])
    }
  }
  points.push(endPoint)

  return dedupeSourcePathSlicePoints(points)
}

const sliceSourcePathSegmentRangePoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext
) => {
  const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
  const sample = segmentRange
    ? getSourcePathSegmentSample(path, segmentRange, slicingContext)
    : undefined
  if (segmentRange && sample) {
    const points = sliceSourcePathSegmentSamplePoints(
      sample,
      segmentRange.endDistance - segmentRange.startDistance,
      range.startDistance - segmentRange.startDistance,
      range.endDistance - segmentRange.startDistance
    )
    if (points.length >= 2) {
      return points
    }
  }

  return slicePathGeometryPoints(
    path,
    range.startDistance,
    range.endDistance,
    false,
    slicingContext.samplingTolerance,
    slicingContext.samplingOptions
  )
}

const lowerBoundSourcePathSegmentEnd = (
  segmentRanges: readonly SourcePathSegmentRange[],
  distance: number
) => {
  let low = 0
  let high = segmentRanges.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (segmentRanges[middle].endDistance <= distance) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

const splitSourcePathRangeBySegmentBoundaries = (
  path: Pick<PathGeometry, 'segments'>,
  startDistance: number,
  endDistance: number,
  slicingContext?: SourcePathSlicingContext
) => {
  if (endDistance - startDistance <= EPSILON) {
    return []
  }

  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const ranges: SourceSegmentIntervalRange[] = []
  for (
    let index = lowerBoundSourcePathSegmentEnd(
      segmentRanges,
      startDistance + EPSILON
    );
    index < segmentRanges.length;
    index += 1
  ) {
    const segment = segmentRanges[index]
    if (segment.startDistance >= endDistance - EPSILON) {
      break
    }
    const start = Math.max(startDistance, segment.startDistance)
    const end = Math.min(endDistance, segment.endDistance)
    if (end - start > EPSILON) {
      ranges.push({
        startDistance: start,
        endDistance: end,
        segmentIndex: segment.index
      })
    }
  }
  return ranges
}

const splitVisibleIntervalBySourceSegments = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeSideResolutionStatus'
  >,
  slicingContext?: SourcePathSlicingContext
) => {
  if (path.segments.length === 0 || path.totalLength <= EPSILON) {
    return []
  }

  const cacheKey = slicingContext
    ? buildSourcePathSplitCacheKey(
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
    : null
  const cached = cacheKey
    ? slicingContext?.splitRangeCache.get(cacheKey)
    : undefined
  if (cached) {
    return cached
  }

  if (interval.wrapsSeam) {
    const ranges = [
      ...splitSourcePathRangeBySegmentBoundaries(
        path,
        interval.startDistance,
        path.totalLength,
        slicingContext
      ),
      ...splitSourcePathRangeBySegmentBoundaries(
        path,
        0,
        interval.endDistance,
        slicingContext
      )
    ]
    if (cacheKey) {
      slicingContext?.splitRangeCache.set(cacheKey, ranges)
    }
    return ranges
  }

  const ranges = splitSourcePathRangeBySegmentBoundaries(
    path,
    interval.startDistance,
    interval.endDistance,
    slicingContext
  )
  if (cacheKey) {
    slicingContext?.splitRangeCache.set(cacheKey, ranges)
  }
  return ranges
}

const buildContinuousSourcePathIntervalRange = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  span: Pick<ConstrainedDashedPhysicalSpan, 'startDistance' | 'endDistance'>,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentIntervalRange[] => {
  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  if (
    segmentRanges.length === 0 ||
    span.endDistance - span.startDistance <= EPSILON
  ) {
    return []
  }

  const segmentIndex = Math.min(
    segmentRanges.length - 1,
    Math.max(
      0,
      lowerBoundSourcePathSegmentEnd(
        segmentRanges,
        span.startDistance + EPSILON
      )
    )
  )

  return [
    {
      startDistance: Math.max(0, span.startDistance),
      endDistance: Math.min(path.totalLength, span.endDistance),
      segmentIndex
    }
  ].filter((range) => range.endDistance - range.startDistance > EPSILON)
}

const sliceSourcePathRangePoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole,
  slicingContext?: SourcePathSlicingContext
) => {
  if (!slicingContext) {
    return slicePathGeometryPoints(
      path,
      range.startDistance,
      range.endDistance,
      false
    )
  }

  const cacheKey = buildSourcePathSliceCacheKey(range, role)
  const cached = slicingContext.pointSliceCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const points = sliceSourcePathSegmentRangePoints(path, range, slicingContext)
  slicingContext.pointSliceCache.set(cacheKey, points)
  return points
}

const SOURCE_PATH_SMOOTH_BOUNDARY_DOT_MIN = Math.cos(Math.PI / 36)

const getSourceSegmentStartTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  const derivative = segment.curve.derivative(0) as Vec2
  return (
    normalizeVector(derivative) ??
    normalizeVector({
      x: segment.control1.x - segment.start.x,
      y: segment.control1.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const getSourceSegmentEndTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  const derivative = segment.curve.derivative(1) as Vec2
  return (
    normalizeVector(derivative) ??
    normalizeVector({
      x: segment.end.x - segment.control2.x,
      y: segment.end.y - segment.control2.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const isSourceBoundarySmooth = (
  path: Pick<PathGeometry, 'segments'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  const previous = path.segments[previousSegmentIndex]
  const next = path.segments[nextSegmentIndex]
  if (!previous || !next) {
    return false
  }

  if (previous.endAnchorType === 'sharp' || next.startAnchorType === 'sharp') {
    return false
  }

  const previousTangent = getSourceSegmentEndTangent(previous)
  const nextTangent = getSourceSegmentStartTangent(next)
  if (!previousTangent || !nextTangent) {
    return false
  }

  return (
    previousTangent.x * nextTangent.x + previousTangent.y * nextTangent.y >=
    SOURCE_PATH_SMOOTH_BOUNDARY_DOT_MIN
  )
}

const canOverlapAcrossSourceRangeStart = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  range: SourceSegmentIntervalRange,
  segmentRanges: SourcePathSegmentRange[]
) => {
  const segmentRange = segmentRanges[range.segmentIndex]
  if (
    !segmentRange ||
    Math.abs(range.startDistance - segmentRange.startDistance) > EPSILON
  ) {
    return true
  }

  const previousSegmentIndex =
    range.segmentIndex > 0
      ? range.segmentIndex - 1
      : path.closed
        ? path.segments.length - 1
        : null
  return previousSegmentIndex === null
    ? false
    : isSourceBoundarySmooth(path, previousSegmentIndex, range.segmentIndex)
}

const canOverlapAcrossSourceRangeEnd = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  range: SourceSegmentIntervalRange,
  segmentRanges: SourcePathSegmentRange[]
) => {
  const segmentRange = segmentRanges[range.segmentIndex]
  if (
    !segmentRange ||
    Math.abs(range.endDistance - segmentRange.endDistance) > EPSILON
  ) {
    return true
  }

  const nextSegmentIndex =
    range.segmentIndex < path.segments.length - 1
      ? range.segmentIndex + 1
      : path.closed
        ? 0
        : null
  return nextSegmentIndex === null
    ? false
    : isSourceBoundarySmooth(path, range.segmentIndex, nextSegmentIndex)
}

const buildOverlappedSourcePathRenderRange = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  span: ConstrainedDashedPhysicalSpan,
  stroke: Pick<RenderableStroke, 'width'>,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentIntervalRange => {
  const overlap = Math.min(
    SOURCE_PATH_DASH_SEGMENT_OVERLAP_MAX,
    Math.max(0, stroke.width * SOURCE_PATH_DASH_SEGMENT_OVERLAP_FACTOR)
  )
  if (overlap <= EPSILON) {
    return range
  }

  const startsAfterSpanStart =
    range.startDistance > span.startDistance + EPSILON
  const endsBeforeSpanEnd = range.endDistance < span.endDistance - EPSILON
  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const startDistance = startsAfterSpanStart
    ? canOverlapAcrossSourceRangeStart(path, range, segmentRanges)
      ? Math.max(0, range.startDistance - overlap)
      : range.startDistance
    : range.startDistance
  const endDistance = endsBeforeSpanEnd
    ? canOverlapAcrossSourceRangeEnd(path, range, segmentRanges)
      ? Math.min(path.totalLength, range.endDistance + overlap)
      : range.endDistance
    : range.endDistance

  return startDistance !== range.startDistance ||
    endDistance !== range.endDistance
    ? {
        ...range,
        startDistance,
        endDistance
      }
    : range
}

const isSourcePathRangeAtVisibleIntervalStart = (
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'wrapsSeam'
  >,
  totalLength: number
) =>
  areLoopDistancesEqual(
    range.startDistance,
    interval.startDistance,
    totalLength
  )

const isSourcePathRangeAtVisibleIntervalEnd = (
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => areLoopDistancesEqual(range.endDistance, interval.endDistance, totalLength)

const getSourcePathRangeRoundCapOwnership = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeBoundaryPoints'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  segmentRanges: SourcePathSegmentRange[]
) => {
  if (stroke.cap !== 'round') {
    return {
      stroke,
      roundCapStart: undefined,
      roundCapEnd: undefined
    }
  }

  const rangeOwnsStartCap = isSourcePathRangeAtVisibleIntervalStart(
    range,
    interval,
    path.totalLength
  )
  const rangeOwnsEndCap = isSourcePathRangeAtVisibleIntervalEnd(
    range,
    interval,
    path.totalLength
  )
  const roundCapStart = rangeOwnsStartCap
  const roundCapEnd = rangeOwnsEndCap

  return {
    stroke:
      roundCapStart || roundCapEnd
        ? stroke
        : {
            ...stroke,
            cap: 'butt' as const
          },
    roundCapStart,
    roundCapEnd
  }
}

const buildDashedSourcePathIntervalSweep = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeBoundaryPoints'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  squareCapPhysicalStroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext?: SourcePathSlicingContext,
  options: { preserveDomainContinuity?: boolean } = {}
): DashedSourcePathIntervalSweep => {
  emitStrokePipelineCounter('interval-sweep-count')
  const ranges: DashedSourcePathIntervalSweepRange[] = []

  physicalSpans.forEach((span) => {
    const sourceRanges =
      options.preserveDomainContinuity === true
        ? buildContinuousSourcePathIntervalRange(path, span, slicingContext)
        : splitVisibleIntervalBySourceSegments(path, span, slicingContext)
    sourceRanges.forEach((range) => {
      const segmentRanges =
        slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
      const renderRange = buildOverlappedSourcePathRenderRange(
        path,
        range,
        span,
        stroke,
        slicingContext
      )
      ranges.push({
        range,
        span,
        renderRange,
        capOwnership: getSourcePathRangeRoundCapOwnership(
          path,
          range,
          interval,
          squareCapPhysicalStroke,
          segmentRanges
        )
      })
    })
  })

  return { ranges }
}

const countTerminalCapsInIntervalSweep = (
  intervalSweep: DashedSourcePathIntervalSweep
) =>
  intervalSweep.ranges.reduce(
    (count, { capOwnership }) =>
      count +
      (capOwnership.roundCapStart === true ? 1 : 0) +
      (capOwnership.roundCapEnd === true ? 1 : 0),
    0
  )

const EMPTY_STROKE_PACKET_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0
}

const getSourcePathRibbonCacheKey = (
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) =>
  [
    range.segmentIndex,
    role,
    formatSourcePathRangeKeyDistance(range.startDistance),
    formatSourcePathRangeKeyDistance(range.endDistance),
    stroke.position,
    stroke.width.toFixed(6),
    stroke.join,
    stroke.miterLimit.toFixed(6),
    stroke.cap,
    roundCapStart === true ? 'rs' : 'ns',
    roundCapEnd === true ? 're' : 'ne'
  ].join(':')

const getConstrainedRibbonOffsetDistance = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => (stroke.position === 'inside' ? stroke.width : -stroke.width)

const getOffsetVectorForSegment = (
  from: Vec2,
  to: Vec2,
  offset: number
): Vec2 | null => {
  const direction = normalizeVector({
    x: to.x - from.x,
    y: to.y - from.y
  })
  if (!direction) {
    return null
  }

  return {
    x: -direction.y * offset,
    y: direction.x * offset
  }
}

const buildSourcePathRibbonOffsetBoundary = (
  source: Vec2[],
  offset: number
) => {
  if (source.length < 2) {
    return []
  }

  const offsetBoundary: Vec2[] = []

  for (let index = 0; index < source.length; index += 1) {
    const point = source[index]
    const previous = index > 0 ? source[index - 1] : null
    const next = index < source.length - 1 ? source[index + 1] : null
    const previousOffset = previous
      ? getOffsetVectorForSegment(previous, point, offset)
      : null
    const nextOffset = next
      ? getOffsetVectorForSegment(point, next, offset)
      : null
    const offsetVector =
      previousOffset && nextOffset
        ? normalizeVector({
            x: previousOffset.x + nextOffset.x,
            y: previousOffset.y + nextOffset.y
          })
        : previousOffset
          ? normalizeVector(previousOffset)
          : nextOffset
            ? normalizeVector(nextOffset)
            : null

    if (!offsetVector) {
      return []
    }

    offsetBoundary.push(
      normalizePoint({
        x: point.x + offsetVector.x * Math.abs(offset),
        y: point.y + offsetVector.y * Math.abs(offset)
      })
    )
  }

  return offsetBoundary
}

const ROUND_CAP_VISUAL_MAX_LENGTH = 0.35
const roundCapUnitSemicircleCache = new Map<
  number,
  { cos: number; sin: number }[]
>()

const getRoundCapUnitSemicircle = (segmentCount: number) => {
  const cached = roundCapUnitSemicircleCache.get(segmentCount)
  if (cached) {
    return cached
  }

  const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const angle = (Math.PI * index) / segmentCount
    return {
      cos: Math.cos(angle),
      sin: Math.sin(angle)
    }
  })
  roundCapUnitSemicircleCache.set(segmentCount, points)
  return points
}

const buildOneSidedRibbonRoundCap = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean
) => {
  const center = {
    x: (endpoint.x + offsetEndpoint.x) / 2,
    y: (endpoint.y + offsetEndpoint.y) / 2
  }
  const radius = distanceBetween(endpoint, offsetEndpoint) / 2
  if (radius <= EPSILON) {
    return []
  }

  const side = normalizeVector({
    x: endpoint.x - center.x,
    y: endpoint.y - center.y
  })
  const bulgeDirection = normalizeVector(
    isStart ? { x: -tangent.x, y: -tangent.y } : tangent
  )
  if (!side || !bulgeDirection) {
    return []
  }

  const segmentCount = Math.max(
    3,
    Math.ceil((Math.PI * radius) / ROUND_CAP_VISUAL_MAX_LENGTH)
  )
  return getRoundCapUnitSemicircle(segmentCount).map(({ cos, sin }) =>
    normalizePoint({
      x: center.x + radius * (side.x * cos + bulgeDirection.x * sin),
      y: center.y + radius * (side.y * cos + bulgeDirection.y * sin)
    })
  )
}

const getOneSidedRibbonRoundCapFrame = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean
) => {
  const sideX = endpoint.x - offsetEndpoint.x
  const sideY = endpoint.y - offsetEndpoint.y
  const diameter = Math.hypot(sideX, sideY)
  const radius = diameter / 2
  if (diameter <= EPSILON || radius <= EPSILON) {
    return null
  }

  const tangentLengthSquared = tangent.x * tangent.x + tangent.y * tangent.y
  if (tangentLengthSquared <= EPSILON * EPSILON) {
    return null
  }
  const tangentScale =
    Math.abs(tangentLengthSquared - 1) <= EPSILON
      ? 1
      : 1 / Math.sqrt(tangentLengthSquared)
  const bulgeSign = isStart ? -1 : 1
  const bulgeDirection = {
    x: tangent.x * tangentScale * bulgeSign,
    y: tangent.y * tangentScale * bulgeSign
  }

  const segmentCount = Math.max(
    3,
    Math.ceil((Math.PI * radius) / ROUND_CAP_VISUAL_MAX_LENGTH)
  )

  return {
    center: {
      x: (endpoint.x + offsetEndpoint.x) / 2,
      y: (endpoint.y + offsetEndpoint.y) / 2
    },
    radius,
    side: {
      x: sideX / diameter,
      y: sideY / diameter
    },
    bulgeDirection,
    unitSemicircle: getRoundCapUnitSemicircle(segmentCount)
  }
}

const appendOneSidedRibbonRoundCap = (
  output: Vec2[],
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  options?: {
    reverse?: boolean
    skipFirst?: boolean
  }
) => {
  const frame = getOneSidedRibbonRoundCapFrame(
    endpoint,
    offsetEndpoint,
    tangent,
    isStart
  )
  if (!frame) {
    return
  }

  const appendAt = (index: number) => {
    const { cos, sin } = frame.unitSemicircle[index]
    const x =
      frame.center.x +
      frame.radius * (frame.side.x * cos + frame.bulgeDirection.x * sin)
    const y =
      frame.center.y +
      frame.radius * (frame.side.y * cos + frame.bulgeDirection.y * sin)
    output.push(
      normalizePoint({
        x,
        y
      })
    )
  }

  if (options?.reverse === true) {
    const endIndex = options.skipFirst === true ? 0 : -1
    for (
      let index = frame.unitSemicircle.length - 1;
      index > endIndex;
      index -= 1
    ) {
      appendAt(index)
    }
    return
  }

  const startIndex = options?.skipFirst === true ? 1 : 0
  for (
    let index = startIndex;
    index < frame.unitSemicircle.length;
    index += 1
  ) {
    appendAt(index)
  }
}

const dedupeRibbonFrames = (frames: PathSampleFrame[]) => {
  if (frames.length <= 1) {
    return frames
  }

  const output = [frames[0]]
  for (let index = 1; index < frames.length; index += 1) {
    if (
      distanceBetween(output[output.length - 1].point, frames[index].point) >
      EPSILON
    ) {
      output.push(frames[index])
    }
  }
  return output
}

const lowerBoundDistance = (distances: number[], target: number) => {
  let low = 0
  let high = distances.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (distances[mid] < target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

const getOffsetRibbonFrameCacheKey = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => [stroke.position, stroke.width.toFixed(6)].join(':')

const buildOffsetRibbonFrame = (
  exactFrame: ExactSourcePathRibbonFrame,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): ExactSourcePathOffsetRibbonFrame => {
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  return {
    segmentFrames: exactFrame.segmentFrames.map((segmentFrame) => ({
      segmentIndex: segmentFrame.segmentIndex,
      segmentLength: segmentFrame.segmentLength,
      distances: segmentFrame.distances,
      frames: segmentFrame.frames.map((frame) => {
        const tangent = normalizeVector(frame.tangent) ?? frame.tangent
        const point = normalizePoint(frame.point)
        return {
          point,
          tangent,
          offsetPoint: normalizePoint({
            x: point.x - tangent.y * offset,
            y: point.y + tangent.x * offset
          })
        }
      })
    }))
  }
}

const getOffsetRibbonFrame = (
  slicingContext: SourcePathSlicingContext,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const cacheKey = getOffsetRibbonFrameCacheKey(stroke)
  const cached = slicingContext.offsetRibbonFrames.get(cacheKey)
  if (cached) {
    return cached
  }

  const frame = buildOffsetRibbonFrame(slicingContext.exactRibbonFrame, stroke)
  slicingContext.offsetRibbonFrames.set(cacheKey, frame)
  return frame
}

const interpolateRibbonSegmentFrameAtDistance = (
  segmentFrame: ExactSourcePathRibbonSegmentFrame,
  distance: number
): PathSampleFrame | null => {
  if (segmentFrame.frames.length === 0) {
    return null
  }
  if (
    segmentFrame.frames.length === 1 ||
    segmentFrame.segmentLength <= EPSILON
  ) {
    return segmentFrame.frames[0]
  }

  const clampedDistance = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, distance)
  )
  const index = Math.max(
    1,
    Math.min(
      segmentFrame.frames.length - 1,
      lowerBoundDistance(segmentFrame.distances, clampedDistance)
    )
  )
  const previousDistance = segmentFrame.distances[index - 1]
  const nextDistance = segmentFrame.distances[index]
  const amount =
    nextDistance - previousDistance > EPSILON
      ? (clampedDistance - previousDistance) / (nextDistance - previousDistance)
      : 0
  const previous = segmentFrame.frames[index - 1]
  const next = segmentFrame.frames[index]
  const tangent =
    normalizeVector({
      x: previous.tangent.x + (next.tangent.x - previous.tangent.x) * amount,
      y: previous.tangent.y + (next.tangent.y - previous.tangent.y) * amount
    }) ?? previous.tangent
  return {
    point: normalizePoint({
      x: previous.point.x + (next.point.x - previous.point.x) * amount,
      y: previous.point.y + (next.point.y - previous.point.y) * amount
    }),
    tangent
  }
}

const interpolateOffsetRibbonSegmentFrameAtDistance = (
  segmentFrame: ExactSourcePathOffsetRibbonSegmentFrame,
  distance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): OffsetPathSampleFrame | null => {
  if (segmentFrame.frames.length === 0) {
    return null
  }
  if (
    segmentFrame.frames.length === 1 ||
    segmentFrame.segmentLength <= EPSILON
  ) {
    return segmentFrame.frames[0]
  }

  const clampedDistance = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, distance)
  )
  const index = Math.max(
    1,
    Math.min(
      segmentFrame.frames.length - 1,
      lowerBoundDistance(segmentFrame.distances, clampedDistance)
    )
  )
  const previousDistance = segmentFrame.distances[index - 1]
  const nextDistance = segmentFrame.distances[index]
  const amount =
    nextDistance - previousDistance > EPSILON
      ? (clampedDistance - previousDistance) / (nextDistance - previousDistance)
      : 0
  const previous = segmentFrame.frames[index - 1]
  const next = segmentFrame.frames[index]
  const tangent =
    normalizeVector({
      x: previous.tangent.x + (next.tangent.x - previous.tangent.x) * amount,
      y: previous.tangent.y + (next.tangent.y - previous.tangent.y) * amount
    }) ?? previous.tangent
  const point = normalizePoint({
    x: previous.point.x + (next.point.x - previous.point.x) * amount,
    y: previous.point.y + (next.point.y - previous.point.y) * amount
  })
  const offset = getConstrainedRibbonOffsetDistance(stroke)

  return {
    point,
    tangent,
    offsetPoint: normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  }
}

const dedupeOffsetRibbonFrames = (frames: OffsetPathSampleFrame[]) => {
  if (frames.length <= 1) {
    return frames
  }

  const output = [frames[0]]
  for (let index = 1; index < frames.length; index += 1) {
    if (
      distanceBetween(output[output.length - 1].point, frames[index].point) >
      EPSILON
    ) {
      output.push(frames[index])
    }
  }
  return output
}

const sliceExactRibbonSegmentFrames = (
  segmentFrame: ExactSourcePathRibbonSegmentFrame,
  localStartDistance: number,
  localEndDistance: number
) => {
  if (localEndDistance - localStartDistance <= EPSILON) {
    return []
  }

  const start = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localStartDistance)
  )
  const end = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localEndDistance)
  )
  if (end - start <= EPSILON) {
    return []
  }

  const startFrame = interpolateRibbonSegmentFrameAtDistance(
    segmentFrame,
    start
  )
  const endFrame = interpolateRibbonSegmentFrameAtDistance(segmentFrame, end)
  if (!startFrame || !endFrame) {
    return []
  }

  const frames = [startFrame]
  const firstInteriorIndex = Math.max(
    1,
    lowerBoundDistance(segmentFrame.distances, start + EPSILON)
  )
  const lastInteriorIndex = Math.min(
    segmentFrame.frames.length - 1,
    lowerBoundDistance(segmentFrame.distances, end - EPSILON)
  )
  for (let index = firstInteriorIndex; index < lastInteriorIndex; index += 1) {
    const distance = segmentFrame.distances[index]
    if (distance > start + EPSILON && distance < end - EPSILON) {
      frames.push(segmentFrame.frames[index])
    }
  }
  frames.push(endFrame)
  return dedupeRibbonFrames(frames)
}

const sliceExactOffsetRibbonSegmentFrames = (
  segmentFrame: ExactSourcePathOffsetRibbonSegmentFrame,
  localStartDistance: number,
  localEndDistance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  if (localEndDistance - localStartDistance <= EPSILON) {
    return []
  }

  const start = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localStartDistance)
  )
  const end = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localEndDistance)
  )
  if (end - start <= EPSILON) {
    return []
  }

  const startFrame = interpolateOffsetRibbonSegmentFrameAtDistance(
    segmentFrame,
    start,
    stroke
  )
  const endFrame = interpolateOffsetRibbonSegmentFrameAtDistance(
    segmentFrame,
    end,
    stroke
  )
  if (!startFrame || !endFrame) {
    return []
  }

  const frames = [startFrame]
  const firstInteriorIndex = Math.max(
    1,
    lowerBoundDistance(segmentFrame.distances, start + EPSILON)
  )
  const lastInteriorIndex = Math.min(
    segmentFrame.frames.length - 1,
    lowerBoundDistance(segmentFrame.distances, end - EPSILON)
  )
  for (let index = firstInteriorIndex; index < lastInteriorIndex; index += 1) {
    const distance = segmentFrame.distances[index]
    if (distance > start + EPSILON && distance < end - EPSILON) {
      frames.push(segmentFrame.frames[index])
    }
  }
  frames.push(endFrame)
  return dedupeOffsetRibbonFrames(frames)
}

const sliceExactRibbonRangeFrames = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext
) => {
  const segmentRanges = slicingContext.segmentRanges
  const baseRange = segmentRanges[range.segmentIndex]
  const ranges =
    baseRange &&
    range.startDistance >= baseRange.startDistance - EPSILON &&
    range.endDistance <= baseRange.endDistance + EPSILON
      ? [range]
      : splitSourcePathRangeBySegmentBoundaries(
          path,
          range.startDistance,
          range.endDistance,
          slicingContext
        )
  const frames: PathSampleFrame[] = []

  ranges.forEach((segmentRange) => {
    const currentBaseRange = segmentRanges[segmentRange.segmentIndex]
    const segmentFrame =
      slicingContext.exactRibbonFrame.segmentFrames[segmentRange.segmentIndex]
    if (!currentBaseRange || !segmentFrame) {
      return
    }
    const segmentFrames = sliceExactRibbonSegmentFrames(
      segmentFrame,
      segmentRange.startDistance - currentBaseRange.startDistance,
      segmentRange.endDistance - currentBaseRange.startDistance
    )
    if (segmentFrames.length === 0) {
      return
    }
    const previous = frames[frames.length - 1]
    if (
      previous &&
      distanceBetween(previous.point, segmentFrames[0].point) <= EPSILON
    ) {
      frames.push(...segmentFrames.slice(1))
      return
    }
    frames.push(...segmentFrames)
  })

  return dedupeRibbonFrames(frames)
}

const sliceExactOffsetRibbonRangeFrames = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext,
  offsetRibbonFrame: ExactSourcePathOffsetRibbonFrame,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const segmentRanges = slicingContext.segmentRanges
  const baseRange = segmentRanges[range.segmentIndex]
  const ranges =
    baseRange &&
    range.startDistance >= baseRange.startDistance - EPSILON &&
    range.endDistance <= baseRange.endDistance + EPSILON
      ? [range]
      : splitSourcePathRangeBySegmentBoundaries(
          path,
          range.startDistance,
          range.endDistance,
          slicingContext
        )
  const frames: OffsetPathSampleFrame[] = []

  ranges.forEach((segmentRange) => {
    const currentBaseRange = segmentRanges[segmentRange.segmentIndex]
    const segmentFrame =
      offsetRibbonFrame.segmentFrames[segmentRange.segmentIndex]
    if (!currentBaseRange || !segmentFrame) {
      return
    }
    const segmentFrames = sliceExactOffsetRibbonSegmentFrames(
      segmentFrame,
      segmentRange.startDistance - currentBaseRange.startDistance,
      segmentRange.endDistance - currentBaseRange.startDistance,
      stroke
    )
    if (segmentFrames.length === 0) {
      return
    }
    const previous = frames[frames.length - 1]
    if (
      previous &&
      distanceBetween(previous.point, segmentFrames[0].point) <= EPSILON
    ) {
      frames.push(...segmentFrames.slice(1))
      return
    }
    frames.push(...segmentFrames)
  })

  return dedupeOffsetRibbonFrames(frames)
}

const buildExactSourcePathRibbonGeometryFromFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = frames.map((frame, index) => {
    const tangent = normalizeVector(frame.tangent)
    if (!tangent) {
      return null
    }
    const point = source[index]
    return normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  })
  if (
    offsetBoundary.length !== source.length ||
    offsetBoundary.some((point) => point === null)
  ) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }
  const offsetPoints = offsetBoundary as Vec2[]

  const rawPolygon: Vec2[] = [...source, ...offsetPoints.slice().reverse()]
  const bodyPolygon = cleanPolygon(rawPolygon)
  const bodyPolygons =
    bodyPolygon.length >= 3 && Math.abs(polygonArea(bodyPolygon)) > EPSILON
      ? [bodyPolygon]
      : []

  if (
    stroke.cap !== 'round' ||
    (roundCapStart !== true && roundCapEnd !== true)
  ) {
    return {
      bodyPolygons,
      capPolygons: []
    }
  }

  const capPolygons = [
    ...(roundCapStart === true
      ? [
          cleanPolygon(
            buildOneSidedRibbonRoundCap(
              source[0],
              offsetPoints[0],
              frames[0].tangent,
              true
            )
          )
        ]
      : []),
    ...(roundCapEnd === true
      ? [
          cleanPolygon(
            buildOneSidedRibbonRoundCap(
              source[source.length - 1],
              offsetPoints[offsetPoints.length - 1],
              frames[frames.length - 1].tangent,
              false
            )
          )
        ]
      : [])
  ].filter(
    (capPolygon) =>
      capPolygon.length >= 3 && Math.abs(polygonArea(capPolygon)) > EPSILON
  )

  return {
    bodyPolygons,
    capPolygons
  }
}

const cleanMergedRibbonPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 2) {
    return polygon
  }

  const deduped: Vec2[] = []
  for (const point of polygon) {
    const previous = deduped[deduped.length - 1]
    if (
      !previous ||
      (previous.x - point.x) * (previous.x - point.x) +
        (previous.y - point.y) * (previous.y - point.y) >
        EPSILON * EPSILON
    ) {
      deduped.push(point)
    }
  }

  if (
    deduped.length > 2 &&
    (deduped[0].x - deduped[deduped.length - 1].x) *
      (deduped[0].x - deduped[deduped.length - 1].x) +
      (deduped[0].y - deduped[deduped.length - 1].y) *
        (deduped[0].y - deduped[deduped.length - 1].y) <=
      EPSILON * EPSILON
  ) {
    deduped.pop()
  }

  return deduped
}

const buildMergedExactSourcePathRibbonPolygonsFromFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = frames.map((frame, index) => {
    const tangent = normalizeVector(frame.tangent)
    if (!tangent) {
      return null
    }
    const point = source[index]
    return normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  })
  if (
    offsetBoundary.length !== source.length ||
    offsetBoundary.some((point) => point === null)
  ) {
    return []
  }

  const offsetPoints = offsetBoundary as Vec2[]
  const rawPolygon: Vec2[] = [...source]
  const hasRoundCap =
    stroke.cap === 'round' && (roundCapStart === true || roundCapEnd === true)

  if (hasRoundCap) {
    if (roundCapEnd === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[source.length - 1],
        offsetPoints[offsetPoints.length - 1],
        frames[frames.length - 1].tangent,
        false,
        { skipFirst: true }
      )
    } else {
      rawPolygon.push(offsetPoints[offsetPoints.length - 1])
    }

    rawPolygon.push(...offsetPoints.slice(0, -1).reverse())

    if (roundCapStart === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[0],
        offsetPoints[0],
        frames[0].tangent,
        true,
        { reverse: true, skipFirst: true }
      )
    }
  } else {
    rawPolygon.push(...offsetPoints.slice().reverse())
  }

  const polygon = cleanMergedRibbonPolygon(rawPolygon)
  return polygon.length >= 3 ? [polygon] : []
}

const buildExactSourcePathRibbonGeometryFromOffsetFrames = (
  frames: OffsetPathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetPoints = frames.map((frame) => normalizePoint(frame.offsetPoint))
  const bodyPolygon = cleanMergedRibbonPolygon([
    ...source,
    ...offsetPoints.slice().reverse()
  ])
  const bodyPolygons =
    bodyPolygon.length >= 3 && Math.abs(polygonArea(bodyPolygon)) > EPSILON
      ? [bodyPolygon]
      : []

  if (
    stroke.cap !== 'round' ||
    (roundCapStart !== true && roundCapEnd !== true)
  ) {
    return {
      bodyPolygons,
      capPolygons: []
    }
  }

  const firstFrame = frames[0]
  const lastFrame = frames[frames.length - 1]
  const capPolygons = [
    ...(roundCapStart === true
      ? [
          cleanMergedRibbonPolygon(
            buildOneSidedRibbonRoundCap(
              normalizePoint(firstFrame.point),
              normalizePoint(firstFrame.offsetPoint),
              firstFrame.tangent,
              true
            )
          )
        ]
      : []),
    ...(roundCapEnd === true
      ? [
          cleanMergedRibbonPolygon(
            buildOneSidedRibbonRoundCap(
              normalizePoint(lastFrame.point),
              normalizePoint(lastFrame.offsetPoint),
              lastFrame.tangent,
              false
            )
          )
        ]
      : [])
  ].filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )

  return {
    bodyPolygons,
    capPolygons
  }
}

const buildMergedExactSourcePathRibbonPolygonsFromOffsetFrames = (
  frames: OffsetPathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetPoints = frames.map((frame) => normalizePoint(frame.offsetPoint))
  const rawPolygon: Vec2[] = [...source]
  const hasRoundCap =
    stroke.cap === 'round' && (roundCapStart === true || roundCapEnd === true)

  if (hasRoundCap) {
    if (roundCapEnd === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[source.length - 1],
        offsetPoints[offsetPoints.length - 1],
        frames[frames.length - 1].tangent,
        false,
        { skipFirst: true }
      )
    } else {
      rawPolygon.push(offsetPoints[offsetPoints.length - 1])
    }

    rawPolygon.push(...offsetPoints.slice(0, -1).reverse())

    if (roundCapStart === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[0],
        offsetPoints[0],
        frames[0].tangent,
        true,
        { reverse: true, skipFirst: true }
      )
    }
  } else {
    rawPolygon.push(...offsetPoints.slice().reverse())
  }

  const polygon = cleanMergedRibbonPolygon(rawPolygon)
  return polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
    ? [polygon]
    : []
}

const buildSourcePathRibbonPolygonFast = (
  source: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    roundCapStart?: boolean
    roundCapEnd?: boolean
  }
) => {
  if (source.length < 2 || stroke.width <= EPSILON) {
    return null
  }

  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = buildSourcePathRibbonOffsetBoundary(source, offset)
  if (offsetBoundary.length !== source.length) {
    return null
  }

  const rawPolygon: Vec2[] = [...source.map(normalizePoint)]
  const hasRoundCap =
    stroke.cap === 'round' &&
    (options.roundCapStart === true || options.roundCapEnd === true)

  if (hasRoundCap) {
    const startDirection = normalizeVector({
      x: source[1].x - source[0].x,
      y: source[1].y - source[0].y
    })
    const endDirection = normalizeVector({
      x: source[source.length - 1].x - source[source.length - 2].x,
      y: source[source.length - 1].y - source[source.length - 2].y
    })
    if (!startDirection || !endDirection) {
      return null
    }

    if (options.roundCapEnd === true) {
      rawPolygon.push(
        ...buildOneSidedRibbonRoundCap(
          source[source.length - 1],
          offsetBoundary[offsetBoundary.length - 1],
          endDirection,
          false
        ).slice(1)
      )
    } else {
      rawPolygon.push(offsetBoundary[offsetBoundary.length - 1])
    }
    rawPolygon.push(...offsetBoundary.slice(0, -1).reverse())
    if (options.roundCapStart === true) {
      rawPolygon.push(
        ...buildOneSidedRibbonRoundCap(
          source[0],
          offsetBoundary[0],
          startDirection,
          true
        )
          .reverse()
          .slice(1)
      )
    }
  } else {
    rawPolygon.push(...offsetBoundary.reverse())
  }

  const polygon = cleanPolygon(rawPolygon)
  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= EPSILON) {
    return null
  }

  return [polygon]
}

const buildSourcePathRibbonPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  renderRange: SourceSegmentIntervalRange,
  span: ConstrainedDashedPhysicalSpan,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  slicingContext?: SourcePathSlicingContext
) => {
  const cacheKey = slicingContext
    ? getSourcePathRibbonCacheKey(
        renderRange,
        span.role,
        stroke,
        roundCapStart,
        roundCapEnd
      )
    : null
  const cached = cacheKey
    ? slicingContext?.ribbonPolygonCache.get(cacheKey)
    : undefined
  if (cached !== undefined) {
    return cached
  }

  const source = sliceSourcePathRangePoints(
    path,
    renderRange,
    span.role,
    slicingContext
  )
  const fastPolygons = buildSourcePathRibbonPolygonFast(source, stroke, {
    roundCapStart,
    roundCapEnd
  })
  if (cacheKey) {
    slicingContext?.ribbonPolygonCache.set(cacheKey, fastPolygons)
  }
  return fastPolygons
}

const addPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x + right.x,
  y: left.y + right.y
})

const subtractPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const crossPoints = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const getSourceVertexJoinOffsetDistance = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => getConstrainedRibbonOffsetDistance(stroke)

const getOffsetPointOnLine = (
  point: Vec2,
  lineStart: Vec2,
  lineEnd: Vec2,
  offset: number
) => {
  const direction = normalizeVector({
    x: lineEnd.x - lineStart.x,
    y: lineEnd.y - lineStart.y
  })
  if (!direction) {
    return null
  }

  return addPoint(point, {
    x: -direction.y * offset,
    y: direction.x * offset
  })
}

const buildJoinArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) => {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle

  if (sweepSign >= 0) {
    while (sweep < 0) {
      sweep += Math.PI * 2
    }
  } else {
    while (sweep > 0) {
      sweep -= Math.PI * 2
    }
  }

  const segmentCount = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
  const radius = distanceBetween(center, start)
  const points: Vec2[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = startAngle + (sweep * index) / segmentCount
    points.push(
      normalizePoint({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
    )
  }

  return points
}

const buildSourceVertexJoinPolygonForOffset = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>,
  offset: number
) => {
  const previousBoundary = buildSourceSegmentBoundary(
    path.segments[previousSegmentIndex]
  )
  const nextBoundary = buildSourceSegmentBoundary(
    path.segments[nextSegmentIndex]
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return []
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (distanceBetween(vertex, nextVertex) > 0.5) {
    return []
  }

  const previousStart = previousBoundary[previousBoundary.length - 2]
  const nextEnd = nextBoundary[1]
  const previousOffsetStart = getOffsetPointOnLine(
    previousStart,
    previousStart,
    vertex,
    offset
  )
  const previousOffsetEnd = getOffsetPointOnLine(
    vertex,
    previousStart,
    vertex,
    offset
  )
  const nextOffsetStart = getOffsetPointOnLine(vertex, vertex, nextEnd, offset)
  const nextOffsetEnd = getOffsetPointOnLine(nextEnd, vertex, nextEnd, offset)
  if (
    !previousOffsetStart ||
    !previousOffsetEnd ||
    !nextOffsetStart ||
    !nextOffsetEnd
  ) {
    return []
  }

  let polygon =
    stroke.join === 'round'
      ? [
          vertex,
          ...buildJoinArcPoints(
            vertex,
            previousOffsetEnd,
            nextOffsetStart,
            crossPoints(
              subtractPoint(vertex, previousStart),
              subtractPoint(nextEnd, vertex)
            ) *
              offset >=
              0
              ? -1
              : 1
          )
        ]
      : [vertex, previousOffsetEnd, nextOffsetStart]

  if (stroke.join === 'miter') {
    const joinPoint = lineIntersection(
      previousOffsetStart,
      previousOffsetEnd,
      nextOffsetStart,
      nextOffsetEnd
    )
    if (
      distanceBetween(vertex, joinPoint) <=
      stroke.miterLimit * Math.abs(offset) + EPSILON
    ) {
      polygon = [vertex, previousOffsetEnd, joinPoint, nextOffsetStart]
    }
  }

  const cleaned = cleanPolygon(polygon)
  return cleaned.length >= 3 &&
    Math.abs(polygonArea(cleaned)) > EPSILON &&
    isSimpleClosedPolygon(cleaned)
    ? [cleaned]
    : []
}

const getPolygonsReferencePointDistance = (
  polygons: Vec2[][],
  referencePoints: Vec2[]
) => {
  if (polygons.length === 0 || referencePoints.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  const polygonPoints = polygons.flat()
  return referencePoints.reduce((totalDistance, referencePoint) => {
    const minimumDistance = polygonPoints.reduce(
      (currentMinimum, polygonPoint) =>
        Math.min(currentMinimum, distanceBetween(referencePoint, polygonPoint)),
      Number.POSITIVE_INFINITY
    )
    return totalDistance + minimumDistance
  }, 0)
}

const getRadialBoundaryPoint = (vertex: Vec2, point: Vec2, radius: number) => {
  const direction = normalizeVector(subtractPoint(point, vertex))
  return direction
    ? normalizePoint({
        x: vertex.x + direction.x * radius,
        y: vertex.y + direction.y * radius
      })
    : null
}

const buildBoundaryTerminalSourceVertexJoinPolygon = (
  vertex: Vec2,
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord,
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit'>,
  referencePoints: Vec2[]
) => {
  const radius = Math.abs(stroke.width)
  if (radius <= EPSILON) {
    return []
  }

  const previousPoint = getRadialBoundaryPoint(
    vertex,
    previousTerminal.neighbor,
    radius
  )
  const nextPoint = getRadialBoundaryPoint(
    vertex,
    nextTerminal.neighbor,
    radius
  )
  if (!previousPoint || !nextPoint) {
    return []
  }

  const buildCleanedPolygon = (polygon: Vec2[]) => {
    const cleaned = cleanPolygon(polygon)
    return cleaned.length >= 3 &&
      Math.abs(polygonArea(cleaned)) > EPSILON &&
      isSimpleClosedPolygon(cleaned)
      ? cleaned
      : null
  }

  if (stroke.join === 'round') {
    const candidates = [-1, 1]
      .map((sweepSign) =>
        buildCleanedPolygon([
          vertex,
          ...buildJoinArcPoints(vertex, previousPoint, nextPoint, sweepSign)
        ])
      )
      .filter((polygon): polygon is Vec2[] => polygon !== null)
    const [selected] = candidates.sort(
      (left, right) =>
        Math.abs(polygonArea(right)) - Math.abs(polygonArea(left))
    )
    return selected ? [selected] : []
  }

  if (stroke.join === 'miter') {
    const previousDirection = normalizeVector(
      subtractPoint(previousPoint, vertex)
    )
    const nextDirection = normalizeVector(subtractPoint(nextPoint, vertex))
    if (previousDirection && nextDirection) {
      const bisector = normalizeVector({
        x: previousDirection.x + nextDirection.x,
        y: previousDirection.y + nextDirection.y
      })
      if (bisector) {
        const dot = Math.max(
          -1,
          Math.min(
            1,
            previousDirection.x * nextDirection.x +
              previousDirection.y * nextDirection.y
          )
        )
        const halfAngle = Math.acos(dot) / 2
        const miterLength =
          Math.sin(halfAngle) <= EPSILON
            ? radius
            : Math.min(radius / Math.sin(halfAngle), stroke.miterLimit * radius)
        const miterPoint = normalizePoint({
          x: vertex.x + bisector.x * miterLength,
          y: vertex.y + bisector.y * miterLength
        })
        const miterPolygon = buildCleanedPolygon([
          vertex,
          previousPoint,
          miterPoint,
          nextPoint
        ])
        if (miterPolygon) {
          return [miterPolygon]
        }
      }
    }
  }

  const bevelPolygon = buildCleanedPolygon([vertex, previousPoint, nextPoint])
  return bevelPolygon ? [bevelPolygon] : []
}

const buildSourceVertexJoinPolygon = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    referencePoints?: Vec2[]
  } = {}
) => {
  const primaryOffset = getSourceVertexJoinOffsetDistance(stroke)
  const primaryPolygons = buildSourceVertexJoinPolygonForOffset(
    path,
    previousSegmentIndex,
    nextSegmentIndex,
    stroke,
    primaryOffset
  )
  const referencePoints = options.referencePoints ?? []
  if (referencePoints.length === 0 || Math.abs(primaryOffset) <= EPSILON) {
    return primaryPolygons
  }

  const oppositePolygons = buildSourceVertexJoinPolygonForOffset(
    path,
    previousSegmentIndex,
    nextSegmentIndex,
    stroke,
    -primaryOffset
  )
  return getPolygonsReferencePointDistance(oppositePolygons, referencePoints) <
    getPolygonsReferencePointDistance(primaryPolygons, referencePoints)
    ? oppositePolygons
    : primaryPolygons
}

const doPhysicalSpansCrossSourceVertex = (
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  sourceVertexDistance: number,
  totalLength: number
) => {
  const crossesInterior = physicalSpans.some(
    (span) =>
      isDistanceInsideInterval(sourceVertexDistance, span, totalLength) &&
      getLoopDistanceDelta(
        sourceVertexDistance,
        span.startDistance,
        totalLength
      ) > EPSILON &&
      getLoopDistanceDelta(
        sourceVertexDistance,
        span.endDistance,
        totalLength
      ) > EPSILON
  )
  if (crossesInterior) {
    return true
  }

  if (!areLoopDistancesEqual(sourceVertexDistance, 0, totalLength)) {
    return false
  }

  const hasTailSpan = physicalSpans.some((span) =>
    areLoopDistancesEqual(span.endDistance, totalLength, totalLength)
  )
  const hasHeadSpan = physicalSpans.some((span) =>
    areLoopDistancesEqual(span.startDistance, 0, totalLength)
  )
  return hasTailSpan && hasHeadSpan
}

const buildSourcePathIntervalJoinPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    excludedVertexIndexes?: Set<number>
  } = {}
) => {
  if (
    (stroke.position !== 'outside' && stroke.position !== 'inside') ||
    path.closed !== true ||
    path.segments.length < 2 ||
    physicalSpans.length === 0
  ) {
    return []
  }

  const segmentRanges = getSourcePathSegmentRanges(path)
  return path.segments.flatMap((_segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    if (options.excludedVertexIndexes?.has(nextSegmentIndex)) {
      return []
    }
    if (isSourceBoundarySmooth(path, previousSegmentIndex, nextSegmentIndex)) {
      return []
    }

    const sourceVertexDistance =
      segmentRanges[nextSegmentIndex]?.startDistance ?? 0
    if (
      !doPhysicalSpansCrossSourceVertex(
        physicalSpans,
        sourceVertexDistance,
        path.totalLength
      )
    ) {
      return []
    }

    return buildSourceVertexJoinPolygon(
      path,
      previousSegmentIndex,
      nextSegmentIndex,
      stroke
    )
  })
}

const getBoundaryDomainTerminalPoint = (
  interval: VisibleDashedTopologyInterval,
  terminal: 'start' | 'end',
  sampleDistance = 0
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
  }

  const getSampledNeighbor = () => {
    if (sampleDistance <= EPSILON) {
      return terminal === 'start'
        ? boundaryPoints[1]
        : boundaryPoints[boundaryPoints.length - 2]
    }

    let traversed = 0
    if (terminal === 'start') {
      for (let index = 1; index < boundaryPoints.length; index += 1) {
        const previous = boundaryPoints[index - 1]
        const current = boundaryPoints[index]
        const segmentLength = distanceBetween(previous, current)
        if (traversed + segmentLength >= sampleDistance) {
          const ratio =
            segmentLength <= EPSILON
              ? 0
              : (sampleDistance - traversed) / segmentLength
          return normalizePoint({
            x: previous.x + (current.x - previous.x) * ratio,
            y: previous.y + (current.y - previous.y) * ratio
          })
        }
        traversed += segmentLength
      }
      return boundaryPoints[boundaryPoints.length - 1]
    }

    for (let index = boundaryPoints.length - 2; index >= 0; index -= 1) {
      const previous = boundaryPoints[index + 1]
      const current = boundaryPoints[index]
      const segmentLength = distanceBetween(previous, current)
      if (traversed + segmentLength >= sampleDistance) {
        const ratio =
          segmentLength <= EPSILON
            ? 0
            : (sampleDistance - traversed) / segmentLength
        return normalizePoint({
          x: previous.x + (current.x - previous.x) * ratio,
          y: previous.y + (current.y - previous.y) * ratio
        })
      }
      traversed += segmentLength
    }
    return boundaryPoints[0]
  }

  if (terminal === 'start') {
    return {
      endpoint: boundaryPoints[0],
      neighbor: getSampledNeighbor()
    }
  }

  return {
    endpoint: boundaryPoints[boundaryPoints.length - 1],
    neighbor: getSampledNeighbor()
  }
}

const getBoundaryDomainTerminalKey = (point: Vec2) =>
  `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`

const SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE = 0.75
const SOURCE_VERTEX_JOIN_MIN_TURN_ANGLE = Math.PI / 24

const getBoundaryDomainFaceKey = (boundaryDomainId: string | undefined) =>
  boundaryDomainId?.match(/^face:[^:]+/)?.[0]

interface SourceVertexBoundaryTerminalRecord {
  interval: VisibleDashedTopologyInterval
  terminal: 'start' | 'end'
  endpoint: Vec2
  neighbor: Vec2
  sourceSegmentIndex: number
  domainKey: string | undefined
}

interface SourceVertexBoundaryJoinRecord {
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
  intervals: [VisibleDashedTopologyInterval, VisibleDashedTopologyInterval]
  polygons: Vec2[][]
}

interface SmoothSourceVertexContinuityRecord {
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
}

interface SmoothSourceVertexContinuityIntervalReplacement {
  insertIndex: number
  replacedIntervalIds: Set<string>
  interval: VisibleDashedTopologyInterval
}

const getSourceVertexTurnAngle = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  const previousBoundary = buildSourceSegmentBoundary(
    path.segments[previousSegmentIndex]
  )
  const nextBoundary = buildSourceSegmentBoundary(
    path.segments[nextSegmentIndex]
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return null
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (
    distanceBetween(vertex, nextVertex) > SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE
  ) {
    return null
  }

  const incoming = normalizeVector(
    subtractPoint(vertex, previousBoundary[previousBoundary.length - 2])
  )
  const outgoing = normalizeVector(subtractPoint(nextBoundary[1], nextVertex))
  if (!incoming || !outgoing) {
    return null
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  return Math.acos(dot)
}

const getSourceVertexRecords = (
  path: Pick<PathGeometry, 'segments' | 'closed'>
) => {
  if (path.closed !== true || path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    const nextSegment = path.segments[nextSegmentIndex]
    if (!segment || !nextSegment) {
      return []
    }

    const turnAngle = getSourceVertexTurnAngle(
      path,
      previousSegmentIndex,
      nextSegmentIndex
    )
    if (turnAngle === null || turnAngle < SOURCE_VERTEX_JOIN_MIN_TURN_ANGLE) {
      return []
    }

    return [
      {
        vertexIndex: nextSegmentIndex,
        previousSegmentIndex,
        nextSegmentIndex,
        vertex: normalizePoint(segment.end)
      }
    ]
  })
}

const getSmoothSourceVertexContinuityRecords = (
  path: Pick<PathGeometry, 'segments' | 'closed'>
): SmoothSourceVertexContinuityRecord[] => {
  if (path.closed !== true || path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    const nextSegment = path.segments[nextSegmentIndex]
    if (!segment || !nextSegment) {
      return []
    }

    if (
      !isSourceBoundarySmooth(path, previousSegmentIndex, nextSegmentIndex) ||
      distanceBetween(segment.end, nextSegment.start) >
        SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE
    ) {
      return []
    }

    return [
      {
        vertexIndex: nextSegmentIndex,
        previousSegmentIndex,
        nextSegmentIndex,
        vertex: normalizePoint(segment.end)
      }
    ]
  })
}

const getBoundaryDomainJoinDomainKey = (
  interval: VisibleDashedTopologyInterval
) =>
  getBoundaryDomainFaceKey(interval.figmaLikeBoundaryDomainId) ??
  interval.figmaLikeBoundaryDomainId

const collectSourceVertexBoundaryTerminalRecords = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  terminalSampleDistance = 0
) => {
  const records: SourceVertexBoundaryTerminalRecord[] = []
  const pushTerminal = (
    interval: VisibleDashedTopologyInterval,
    terminal: 'start' | 'end'
  ) => {
    if (
      interval.figmaLikeBoundaryRole !== 'outer' ||
      interval.figmaLikeSelectedSide !== -1 ||
      interval.figmaLikeSideResolutionStatus === 'blocked' ||
      interval.figmaLikeSplitRangeSourceSegmentIndex === undefined
    ) {
      return
    }

    const terminalPoint = getBoundaryDomainTerminalPoint(
      interval,
      terminal,
      terminalSampleDistance
    )
    if (!terminalPoint) {
      return
    }

    records.push({
      interval,
      terminal,
      endpoint: terminalPoint.endpoint,
      neighbor: terminalPoint.neighbor,
      sourceSegmentIndex: interval.figmaLikeSplitRangeSourceSegmentIndex,
      domainKey: getBoundaryDomainJoinDomainKey(interval)
    })
  }

  visibleIntervals.forEach((interval) => {
    if (
      interval.figmaLikeTerminalRole === 'start' ||
      interval.figmaLikeTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'start')
    }
    if (
      interval.figmaLikeTerminalRole === 'end' ||
      interval.figmaLikeTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'end')
    }
  })

  return records
}

const getSmoothContinuityContourRestoreMaxEdgeLength = (strokeWidth: number) =>
  Math.max(1.5, strokeWidth * 0.3)

const sliceIntervalBoundaryVisiblePath = (
  interval: VisibleDashedTopologyInterval
) => {
  const boundaryDomainPath = buildBoundaryDomainPathForInterval(interval)
  if (!boundaryDomainPath) {
    return []
  }

  return cleanBoundaryPath(
    slicePathGeometryPoints(
      boundaryDomainPath,
      interval.startDistance,
      interval.endDistance,
      interval.wrapsSeam,
      SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
      SOURCE_PATH_RIBBON_FRAME_SAMPLING
    )
  )
}

const getBoundaryPathLength = (points: Vec2[]) =>
  points.reduce(
    (total, point, index) =>
      index === 0 ? 0 : total + distanceBetween(points[index - 1], point),
    0
  )

const isSameOutsideSmoothContinuityCoverage = (
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord
) => {
  const previousInterval = previousTerminal.interval
  const nextInterval = nextTerminal.interval
  return (
    previousInterval.intervalId !== nextInterval.intervalId &&
    previousTerminal.domainKey !== undefined &&
    previousTerminal.domainKey === nextTerminal.domainKey &&
    previousInterval.figmaLikeBoundaryRole === 'outer' &&
    nextInterval.figmaLikeBoundaryRole === 'outer' &&
    previousInterval.figmaLikeSelectedSide === -1 &&
    nextInterval.figmaLikeSelectedSide === -1 &&
    previousInterval.figmaLikeFilledSide === nextInterval.figmaLikeFilledSide &&
    previousInterval.figmaLikeUnfilledSide ===
      nextInterval.figmaLikeUnfilledSide &&
    previousInterval.figmaLikeSideResolutionStatus !== 'blocked' &&
    nextInterval.figmaLikeSideResolutionStatus !== 'blocked'
  )
}

const buildOutsideSmoothSourceVertexContinuityInterval = (
  sourceVertex: SmoothSourceVertexContinuityRecord,
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord,
  insertIndex: number,
  endpointTolerance: number
): SmoothSourceVertexContinuityIntervalReplacement | null => {
  if (!isSameOutsideSmoothContinuityCoverage(previousTerminal, nextTerminal)) {
    return null
  }

  const previousPath = sliceIntervalBoundaryVisiblePath(
    previousTerminal.interval
  )
  const nextPath = sliceIntervalBoundaryVisiblePath(nextTerminal.interval)
  if (previousPath.length < 2 || nextPath.length < 2) {
    return null
  }

  const buildContinuousPathCandidate = (
    leftPath: Vec2[],
    rightPath: Vec2[]
  ) => {
    const leftStartsAtVertex =
      distanceBetween(leftPath[0], sourceVertex.vertex) <=
      distanceBetween(leftPath[leftPath.length - 1], sourceVertex.vertex)
    const rightStartsAtVertex =
      distanceBetween(rightPath[0], sourceVertex.vertex) <=
      distanceBetween(rightPath[rightPath.length - 1], sourceVertex.vertex)
    const left = leftStartsAtVertex ? [...leftPath].reverse() : leftPath
    const right = rightStartsAtVertex ? rightPath : [...rightPath].reverse()
    const endpointError = Math.max(
      distanceBetween(left[left.length - 1], sourceVertex.vertex),
      distanceBetween(right[0], sourceVertex.vertex)
    )

    return {
      points: cleanBoundaryPath([...left, ...right.slice(1)]),
      flippedSegmentCount:
        (leftStartsAtVertex ? 1 : 0) + (rightStartsAtVertex ? 0 : 1),
      endpointError
    }
  }
  const continuityCandidate = [
    buildContinuousPathCandidate(previousPath, nextPath),
    buildContinuousPathCandidate(nextPath, previousPath)
  ]
    .filter((candidate) => candidate.endpointError <= endpointTolerance)
    .sort(
      (left, right) =>
        left.flippedSegmentCount - right.flippedSegmentCount ||
        right.points.length - left.points.length
    )[0]

  if (!continuityCandidate) {
    return null
  }

  const boundaryPoints = continuityCandidate.points
  if (boundaryPoints.length < 3) {
    return null
  }

  const boundaryTotalLength = getBoundaryPathLength(boundaryPoints)
  if (boundaryTotalLength <= EPSILON) {
    return null
  }

  const previousInterval = previousTerminal.interval
  const nextInterval = nextTerminal.interval
  const intervalId = [
    'interval',
    'smooth-source-continuity',
    sourceVertex.vertexIndex,
    previousInterval.intervalId.replace(/[^a-zA-Z0-9_-]/g, '-'),
    nextInterval.intervalId.replace(/[^a-zA-Z0-9_-]/g, '-')
  ].join(':')

  return {
    insertIndex,
    replacedIntervalIds: new Set([
      previousInterval.intervalId,
      nextInterval.intervalId
    ]),
    interval: {
      ...previousInterval,
      intervalId,
      authoredIndex: Math.min(
        previousInterval.authoredIndex,
        nextInterval.authoredIndex
      ),
      startDistance: 0,
      endDistance: boundaryTotalLength,
      intervalLength: boundaryTotalLength,
      wrapsSeam: false,
      previousVisibleIntervalId: null,
      nextVisibleIntervalId: null,
      figmaLikeBoundaryPoints: boundaryPoints,
      figmaLikeBoundaryStartDistance: 0,
      figmaLikeBoundaryEndDistance: boundaryTotalLength,
      figmaLikeBoundaryTotalLength: boundaryTotalLength,
      figmaLikeSplitRangeId: undefined,
      figmaLikeSplitRangeStartDistance: undefined,
      figmaLikeSplitRangeEndDistance: undefined,
      figmaLikeTerminalRole: undefined,
      figmaLikeSplitRangeSourceSegmentIndex: undefined,
      figmaLikeBoundaryRole: 'outer',
      figmaLikeSelectedSide: -1,
      figmaLikeSideResolutionStatus:
        previousInterval.figmaLikeSideResolutionStatus ??
        nextInterval.figmaLikeSideResolutionStatus,
      figmaLikeSideResolutionReason:
        previousInterval.figmaLikeSideResolutionReason ??
        nextInterval.figmaLikeSideResolutionReason
    }
  }
}

const buildOutsideSmoothSourceVertexContinuityIntervalReplacements = (
  sourcePath:
    | Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
    | null
    | undefined,
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): SmoothSourceVertexContinuityIntervalReplacement[] => {
  if (stroke.position !== 'outside' || !sourcePath) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const terminalRecords = collectSourceVertexBoundaryTerminalRecords(
    visibleIntervals,
    Math.max(stroke.width, SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE)
  )
  if (terminalRecords.length === 0) {
    return []
  }

  const intervalIndexById = new Map(
    visibleIntervals.map((interval, index) => [interval.intervalId, index])
  )
  const usedIntervalIds = new Set<string>()
  const replacements: SmoothSourceVertexContinuityIntervalReplacement[] = []

  getSmoothSourceVertexContinuityRecords(sourcePath).forEach((sourceVertex) => {
    const previousTerminals = terminalRecords.filter(
      (record) =>
        !usedIntervalIds.has(record.interval.intervalId) &&
        record.sourceSegmentIndex === sourceVertex.previousSegmentIndex &&
        record.domainKey !== undefined &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    const nextTerminals = terminalRecords.filter(
      (record) =>
        !usedIntervalIds.has(record.interval.intervalId) &&
        record.sourceSegmentIndex === sourceVertex.nextSegmentIndex &&
        record.domainKey !== undefined &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )

    for (const previousTerminal of previousTerminals) {
      const previousIndex =
        intervalIndexById.get(previousTerminal.interval.intervalId) ??
        Number.MAX_SAFE_INTEGER
      for (const nextTerminal of nextTerminals) {
        const nextIndex =
          intervalIndexById.get(nextTerminal.interval.intervalId) ??
          Number.MAX_SAFE_INTEGER
        const replacement = buildOutsideSmoothSourceVertexContinuityInterval(
          sourceVertex,
          previousTerminal,
          nextTerminal,
          Math.min(previousIndex, nextIndex),
          endpointTolerance
        )
        if (!replacement) {
          continue
        }

        replacement.replacedIntervalIds.forEach((intervalId) => {
          usedIntervalIds.add(intervalId)
        })
        replacements.push(replacement)
        return
      }
    }
  })

  return replacements
}

const replaceOutsideSmoothSourceVertexContinuityIntervals = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  sourcePath:
    | Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
    | null
    | undefined,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const replacements =
    buildOutsideSmoothSourceVertexContinuityIntervalReplacements(
      sourcePath,
      visibleIntervals,
      stroke
    )
  if (replacements.length === 0) {
    return visibleIntervals
  }

  const removedIntervalIds = new Set(
    replacements.flatMap((replacement) => [...replacement.replacedIntervalIds])
  )
  const replacementsByInsertIndex = new Map<
    number,
    SmoothSourceVertexContinuityIntervalReplacement[]
  >()
  replacements.forEach((replacement) => {
    const indexReplacements =
      replacementsByInsertIndex.get(replacement.insertIndex) ?? []
    indexReplacements.push(replacement)
    replacementsByInsertIndex.set(replacement.insertIndex, indexReplacements)
  })

  const rewritten: VisibleDashedTopologyInterval[] = []
  visibleIntervals.forEach((interval, index) => {
    replacementsByInsertIndex.get(index)?.forEach((replacement) => {
      rewritten.push(replacement.interval)
    })
    if (!removedIntervalIds.has(interval.intervalId)) {
      rewritten.push(interval)
    }
  })

  return rewritten
}

const buildOutsideSourceVertexBoundaryJoinRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>
): SourceVertexBoundaryJoinRecord[] => {
  if (stroke.position !== 'outside' || !sourcePath) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const terminalRecords =
    collectSourceVertexBoundaryTerminalRecords(visibleIntervals)
  if (terminalRecords.length === 0) {
    return []
  }

  return getSourceVertexRecords(sourcePath).flatMap((sourceVertex) => {
    const previousTerminal = terminalRecords.find(
      (record) =>
        record.sourceSegmentIndex === sourceVertex.previousSegmentIndex &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    const nextTerminal = terminalRecords.find(
      (record) =>
        record.sourceSegmentIndex === sourceVertex.nextSegmentIndex &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    if (!previousTerminal || !nextTerminal) {
      return []
    }

    const referenceDistance = Math.max(
      SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
      stroke.width * 2.5
    )
    const referencePoints = [
      ...(previousTerminal.interval.figmaLikeBoundaryPoints ?? []),
      ...(nextTerminal.interval.figmaLikeBoundaryPoints ?? [])
    ].filter(
      (point) =>
        distanceBetween(point, sourceVertex.vertex) >
          SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE &&
        distanceBetween(point, sourceVertex.vertex) <= referenceDistance
    )

    const sourcePathPolygons = buildSourceVertexJoinPolygon(
      sourcePath,
      sourceVertex.previousSegmentIndex,
      sourceVertex.nextSegmentIndex,
      stroke,
      { referencePoints }
    )
    const boundaryTerminalPolygons =
      buildBoundaryTerminalSourceVertexJoinPolygon(
        sourceVertex.vertex,
        previousTerminal,
        nextTerminal,
        stroke,
        referencePoints
      )
    const polygons = [...sourcePathPolygons, ...boundaryTerminalPolygons]
    if (polygons.length === 0) {
      return []
    }

    return [
      {
        ...sourceVertex,
        intervals: [previousTerminal.interval, nextTerminal.interval],
        polygons
      }
    ]
  })
}

const clipSourceSegmentRangePolygonsToAdjacentBoundaries = (
  polygons: Vec2[][],
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'position' | 'dashPattern' | 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  physicalSpanRole: ConstrainedDashedPhysicalSpanRole = 'core',
  sharpGuardVertices: SharpGuardVertex[] = [],
  slicingContext?: SourcePathSlicingContext,
  options?: {
    assumeConstructedSimple?: boolean
    skipSourceEdgeFallback?: boolean
    sourceEdge?: Vec2[]
  }
) => {
  if (
    polygons.length === 0 ||
    path.closed !== true ||
    path.segments.length < 2 ||
    authoredStroke.position !== 'inside'
  ) {
    return polygons
  }

  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const segmentRange = segmentRanges[range.segmentIndex]
  if (!segmentRange) {
    return polygons
  }
  const endpointClipReach = Math.max(
    intervalStroke.width * (authoredStroke.cap === 'square' ? 1.5 : 0.55),
    EPSILON
  )
  const touchesSegmentStart =
    range.startDistance <=
    segmentRange.startDistance + endpointClipReach + EPSILON
  const touchesSegmentEnd =
    range.endDistance >= segmentRange.endDistance - endpointClipReach - EPSILON
  const assumeConstructedSimple = options?.assumeConstructedSimple === true
  const isValidPolygon = (polygon: Vec2[]) =>
    polygon.length >= 3 &&
    Math.abs(polygonArea(polygon)) > EPSILON &&
    (assumeConstructedSimple || isSimpleClosedPolygon(polygon))

  const areaValidPolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
  if (!touchesSegmentStart && !touchesSegmentEnd) {
    return areaValidPolygons.filter((polygon) => isValidPolygon(polygon))
  }
  const fallbackPolygons = areaValidPolygons.filter((polygon) =>
    isValidPolygon(polygon)
  )

  const selectedSide = intervalStroke.position === 'inside' ? 1 : -1
  const segmentStartIsSharp = sharpGuardVertices.some((guard) =>
    areLoopDistancesEqual(
      segmentRange.startDistance,
      guard.distance,
      path.totalLength
    )
  )
  const segmentEndIsSharp = sharpGuardVertices.some((guard) =>
    areLoopDistancesEqual(
      segmentRange.endDistance,
      guard.distance,
      path.totalLength
    )
  )
  const boundaryReach = Math.max(
    intervalStroke.width * 2,
    authoredStroke.dashPattern[0] ?? intervalStroke.width
  )
  const isPathStartTerminalRange =
    !interval.wrapsSeam &&
    interval.startDistance <= EPSILON &&
    range.startDistance <= EPSILON
  const isPathEndTerminalRange =
    !interval.wrapsSeam &&
    interval.endDistance >= path.totalLength - EPSILON &&
    range.endDistance >= path.totalLength - EPSILON
  const squareCapReach =
    authoredStroke.cap === 'square'
      ? Math.max(intervalStroke.width / 2, EPSILON)
      : 0
  const roundCapReach =
    authoredStroke.cap === 'round'
      ? Math.max(intervalStroke.width / 2, EPSILON)
      : 0
  const isSquareCapWrappedEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    interval.wrapsSeam &&
    (range.startDistance >= interval.startDistance - squareCapReach - EPSILON ||
      range.endDistance <= interval.endDistance + squareCapReach + EPSILON)
  const isSquareCapIntervalEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    !interval.wrapsSeam &&
    (Math.abs(range.startDistance - interval.startDistance) <=
      squareCapReach + EPSILON ||
      Math.abs(range.endDistance - interval.endDistance) <=
        squareCapReach + EPSILON)
  const isSquareCapSegmentBoundaryEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    ((touchesSegmentStart &&
      (areLoopDistancesEqual(
        interval.startDistance,
        segmentRange.startDistance,
        path.totalLength
      ) ||
        areLoopDistancesEqual(
          interval.endDistance,
          segmentRange.startDistance,
          path.totalLength
        ))) ||
      (touchesSegmentEnd &&
        (areLoopDistancesEqual(
          interval.startDistance,
          segmentRange.endDistance,
          path.totalLength
        ) ||
          areLoopDistancesEqual(
            interval.endDistance,
            segmentRange.endDistance,
            path.totalLength
          ))))
  const isRoundCapWrappedEndpointRange =
    authoredStroke.cap === 'round' &&
    interval.wrapsSeam &&
    (areLoopDistancesEqual(
      range.startDistance,
      interval.startDistance,
      path.totalLength
    ) ||
      areLoopDistancesEqual(
        range.endDistance,
        interval.endDistance,
        path.totalLength
      ) ||
      range.startDistance >= interval.startDistance - roundCapReach - EPSILON ||
      range.endDistance <= interval.endDistance + roundCapReach + EPSILON)
  const isRoundCapIntervalEndpointRange =
    authoredStroke.cap === 'round' &&
    !interval.wrapsSeam &&
    (Math.abs(range.startDistance - interval.startDistance) <=
      roundCapReach + EPSILON ||
      Math.abs(range.endDistance - interval.endDistance) <=
        roundCapReach + EPSILON)
  const isRoundCapSegmentBoundaryEndpointRange =
    authoredStroke.cap === 'round' &&
    ((touchesSegmentStart &&
      (areLoopDistancesEqual(
        interval.startDistance,
        segmentRange.startDistance,
        path.totalLength
      ) ||
        areLoopDistancesEqual(
          interval.endDistance,
          segmentRange.startDistance,
          path.totalLength
        ))) ||
      (touchesSegmentEnd &&
        (areLoopDistancesEqual(
          interval.startDistance,
          segmentRange.endDistance,
          path.totalLength
        ) ||
          areLoopDistancesEqual(
            interval.endDistance,
            segmentRange.endDistance,
            path.totalLength
          ))))
  const shouldRequireClippedSquareCapEndpoint =
    isSquareCapWrappedEndpointRange ||
    isSquareCapIntervalEndpointRange ||
    isSquareCapSegmentBoundaryEndpointRange
  const shouldRequireClippedRoundCapEndpoint =
    isRoundCapWrappedEndpointRange ||
    isRoundCapIntervalEndpointRange ||
    isRoundCapSegmentBoundaryEndpointRange
  const shouldRequireClippedCapEndpoint =
    shouldRequireClippedSquareCapEndpoint ||
    shouldRequireClippedRoundCapEndpoint
  let previousBoundaryData: SourceSegmentBoundaryClipData | null = null
  let nextBoundaryData: SourceSegmentBoundaryClipData | null = null
  let currentBoundaryData: SourceSegmentBoundaryClipData | null = null
  let previousBoundarySelectedSide: 1 | -1 | null = null
  let nextBoundarySelectedSide: 1 | -1 | null = null
  const getPreviousBoundaryData = () => {
    previousBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      (range.segmentIndex - 1 + path.segments.length) % path.segments.length,
      boundaryReach,
      slicingContext
    )
    return previousBoundaryData
  }
  const getNextBoundaryData = () => {
    nextBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      (range.segmentIndex + 1) % path.segments.length,
      boundaryReach,
      slicingContext
    )
    return nextBoundaryData
  }
  const getCurrentBoundaryData = () => {
    currentBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      range.segmentIndex,
      boundaryReach,
      slicingContext
    )
    return currentBoundaryData
  }
  const getPreviousBoundary = () => getPreviousBoundaryData().tail
  const getNextBoundary = () => getNextBoundaryData().head
  const getCurrentBoundary = () => getCurrentBoundaryData().boundary
  const getCurrentHeadBoundary = () => getCurrentBoundaryData().head
  const getCurrentTailBoundary = () => getCurrentBoundaryData().tail
  const getCurrentDominantClipBoundary = () => {
    if (touchesSegmentStart && !touchesSegmentEnd) {
      return getCurrentHeadBoundary()
    }
    if (touchesSegmentEnd && !touchesSegmentStart) {
      return getCurrentTailBoundary()
    }
    return getCurrentBoundary()
  }
  const getCurrentHeadReference = () => getCurrentBoundaryData().headReference
  const getCurrentTailReference = () => getCurrentBoundaryData().tailReference
  const getPreviousBoundarySelectedSide = () => {
    previousBoundarySelectedSide ??= getSelectedSideTowardPoint(
      getPreviousBoundary(),
      getCurrentHeadReference(),
      selectedSide
    )
    return previousBoundarySelectedSide
  }
  const getNextBoundarySelectedSide = () => {
    nextBoundarySelectedSide ??= getSelectedSideTowardPoint(
      getNextBoundary(),
      getCurrentTailReference(),
      selectedSide
    )
    return nextBoundarySelectedSide
  }
  const clippedPolygons = polygons.flatMap((polygon) => {
    let currentPolygon = polygon

    if (touchesSegmentStart) {
      currentPolygon = isPathStartTerminalRange
        ? clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            getPreviousBoundary(),
            getPreviousBoundarySelectedSide()
          )
        : segmentStartIsSharp
          ? clipPolygonToSelectedSideBoundary(
              currentPolygon,
              getPreviousBoundary(),
              getPreviousBoundarySelectedSide()
            )
          : clipPolygonToSelectedSideBoundaryIfCrossing(
              currentPolygon,
              getPreviousBoundary(),
              selectedSide
            )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    if (touchesSegmentEnd) {
      currentPolygon = segmentEndIsSharp
        ? clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getNextBoundary(),
            getNextBoundarySelectedSide()
          )
        : clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            getNextBoundary(),
            selectedSide
          )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    if (
      (touchesSegmentStart &&
        !isPathStartTerminalRange &&
        !segmentStartIsSharp) ||
      (touchesSegmentEnd && !segmentEndIsSharp)
    ) {
      currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
        currentPolygon,
        getCurrentDominantClipBoundary()
      )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    return isValidPolygon(currentPolygon) ? [currentPolygon] : []
  })

  if (
    isPathStartTerminalRange ||
    isPathEndTerminalRange ||
    shouldRequireClippedCapEndpoint
  ) {
    return clippedPolygons
  }

  if (clippedPolygons.length > 0) {
    if (options?.skipSourceEdgeFallback === true) {
      return clippedPolygons
    }

    const sourceEdge =
      options?.sourceEdge ??
      sliceSourcePathRangePoints(path, range, physicalSpanRole, slicingContext)
    const fallbackSourceEdgeCount = countSourceEdgeVertices(
      fallbackPolygons,
      sourceEdge
    )
    const clippedSourceEdgeCount = countSourceEdgeVertices(
      clippedPolygons,
      sourceEdge
    )
    if (
      fallbackSourceEdgeCount >= 3 &&
      clippedSourceEdgeCount < Math.min(3, fallbackSourceEdgeCount)
    ) {
      return fallbackPolygons
    }

    return clippedPolygons
  }

  return fallbackPolygons
}

const shouldClipSourceSegmentRangeForInsideBoundary = (
  range: SourceSegmentIntervalRange,
  segmentRange: SourcePathSegmentRange | undefined,
  path: Pick<PathGeometry, 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'width'>,
  sharpGuardVertices: SharpGuardVertex[]
) => {
  if (!segmentRange) {
    return true
  }

  const endpointClipReach = Math.max(
    intervalStroke.width * (authoredStroke.cap === 'square' ? 1.5 : 0.55),
    EPSILON
  )
  return (
    (range.startDistance <=
      segmentRange.startDistance + endpointClipReach + EPSILON &&
      shouldClipSourceSegmentBoundaryForInsideRange(
        segmentRange.startDistance,
        path.totalLength,
        interval,
        authoredStroke,
        intervalStroke,
        sharpGuardVertices
      )) ||
    (range.endDistance >=
      segmentRange.endDistance - endpointClipReach - EPSILON &&
      shouldClipSourceSegmentBoundaryForInsideRange(
        segmentRange.endDistance,
        path.totalLength,
        interval,
        authoredStroke,
        intervalStroke,
        sharpGuardVertices
      ))
  )
}

const getLoopDistanceDelta = (
  left: number,
  right: number,
  totalLength: number
) => {
  if (totalLength <= EPSILON) {
    return Math.abs(left - right)
  }

  const delta = Math.abs(
    normalizeDistanceOnLoop(left, totalLength) -
      normalizeDistanceOnLoop(right, totalLength)
  )
  return Math.min(delta, totalLength - delta)
}

const shouldClipSourceSegmentBoundaryForInsideRange = (
  boundaryDistance: number,
  totalLength: number,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'width'>,
  sharpGuardVertices: SharpGuardVertex[]
) => {
  if (
    boundaryDistance <= EPSILON ||
    boundaryDistance >= totalLength - EPSILON ||
    sharpGuardVertices.some((guard) =>
      areLoopDistancesEqual(boundaryDistance, guard.distance, totalLength)
    ) ||
    areLoopDistancesEqual(
      boundaryDistance,
      interval.startDistance,
      totalLength
    ) ||
    areLoopDistancesEqual(boundaryDistance, interval.endDistance, totalLength)
  ) {
    return true
  }

  const capReach =
    authoredStroke.cap === 'butt'
      ? 0
      : Math.max(intervalStroke.width / 2, EPSILON)
  if (capReach <= EPSILON) {
    return false
  }

  return (
    getLoopDistanceDelta(
      boundaryDistance,
      interval.startDistance,
      totalLength
    ) <=
      capReach + EPSILON ||
    getLoopDistanceDelta(boundaryDistance, interval.endDistance, totalLength) <=
      capReach + EPSILON
  )
}

const appendDashedSourcePathFinalCoverageRangePolygons = (
  output: Vec2[][],
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topology: Pick<
    PathTopologyModel,
    'normalizedPoints' | 'fillRule' | 'topologyFamily'
  >,
  sweepRange: DashedSourcePathIntervalSweepRange,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeBoundaryPoints'
  >,
  authoredStroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  sharpGuardVertices: SharpGuardVertex[],
  slicingContext: SourcePathSlicingContext,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined,
  clipInsideToFillDomain: boolean,
  implicitFillRegions: PolygonRegion[] = []
) => {
  const { range, span, renderRange, capOwnership } = sweepRange
  const authoredConstrainedPosition =
    authoredStroke.position === 'inside' ||
    authoredStroke.position === 'outside'
      ? authoredStroke.position
      : null
  const shouldResolveSelfIntersectingLegalSide =
    strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain' &&
    authoredConstrainedPosition !== null
  const resolvedIntervalStroke = shouldResolveSelfIntersectingLegalSide
    ? interval.figmaLikeSideResolutionStatus === 'resolved' &&
      interval.figmaLikeSelectedSide !== undefined
      ? {
          position:
            interval.figmaLikeSelectedSide > 0
              ? ('inside' as const)
              : ('outside' as const),
          width: intervalStroke.width
        }
      : null
    : intervalStroke
  if (!resolvedIntervalStroke) {
    return
  }

  const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
  const shouldClipInsideBoundary =
    topology.topologyFamily === 'self-intersecting'
      ? false
      : authoredStroke.position === 'inside' && path.closed === true
        ? false
        : shouldClipSourceSegmentRangeForInsideBoundary(
            range,
            segmentRange,
            path,
            interval,
            authoredStroke,
            resolvedIntervalStroke,
            sharpGuardVertices
          )
  const appendRangeForOffsetRibbonFrame = (
    currentOffsetRibbonFrame: ExactSourcePathOffsetRibbonFrame,
    currentIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
    shouldApplySourceBoundaryClip: boolean
  ) => {
    const buildRangePolygons = (
      candidateOffsetRibbonFrame: ExactSourcePathOffsetRibbonFrame,
      candidateIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
      candidateRenderRange: SourceSegmentIntervalRange
    ) => {
      const exactFrames = measureStrokePipelinePhase(
        'stroke product visual compiler: range slice',
        () =>
          sliceExactOffsetRibbonRangeFrames(
            path,
            candidateRenderRange,
            slicingContext,
            candidateOffsetRibbonFrame,
            candidateIntervalStroke
          )
      )
      if (exactFrames.length < 2) {
        return []
      }

      const rangePolygons = measureStrokePipelinePhase(
        'stroke product visual compiler: polygon build',
        () => {
          const resolvedCapStroke = {
            ...capOwnership.stroke,
            position: candidateIntervalStroke.position
          }
          if (
            resolvedCapStroke.cap === 'round' &&
            (capOwnership.roundCapStart === true ||
              capOwnership.roundCapEnd === true)
          ) {
            return buildMergedExactSourcePathRibbonPolygonsFromOffsetFrames(
              exactFrames,
              resolvedCapStroke,
              capOwnership.roundCapStart,
              capOwnership.roundCapEnd
            )
          }
          const { bodyPolygons, capPolygons } =
            buildExactSourcePathRibbonGeometryFromOffsetFrames(
              exactFrames,
              resolvedCapStroke,
              capOwnership.roundCapStart,
              capOwnership.roundCapEnd
            )
          return [...bodyPolygons, ...capPolygons]
        }
      )

      if (!shouldApplySourceBoundaryClip) {
        return rangePolygons
      }

      return measureStrokePipelinePhase(
        'stroke product visual compiler: inside clip',
        () =>
          clipSourceSegmentRangePolygonsToAdjacentBoundaries(
            rangePolygons,
            path,
            range,
            interval,
            authoredStroke,
            candidateIntervalStroke,
            span.role,
            sharpGuardVertices,
            slicingContext,
            {
              assumeConstructedSimple: true,
              skipSourceEdgeFallback: true,
              sourceEdge: exactFrames.map((frame) => frame.point)
            }
          )
      )
    }

    const rangePolygons = buildRangePolygons(
      currentOffsetRibbonFrame,
      currentIntervalStroke,
      renderRange
    )
    let finalRangePolygons = rangePolygons
    if (
      shouldResolveSelfIntersectingLegalSide &&
      authoredStroke.position === 'outside' &&
      clipInsideToFillDomain &&
      interval.figmaLikeBoundaryRole !== 'hole' &&
      implicitFillRegions.length > 0
    ) {
      finalRangePolygons = clipSourcePathPolygonsToEvenOddLegalDomain(
        finalRangePolygons,
        path,
        { position: authoredStroke.position },
        implicitFillRegions,
        {
          fragmentStitchRadius: 0,
          fragmentPruneArea:
            authoredStroke.position === 'outside'
              ? Math.max(
                  1,
                  currentIntervalStroke.width *
                    currentIntervalStroke.width *
                    0.1
                )
              : 0,
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001,
          restoreSubjectBoundaryPolygons: rangePolygons,
          restoreSubjectBoundaryMaxEdgeLength:
            currentIntervalStroke.position === 'outside'
              ? getSmoothContinuityContourRestoreMaxEdgeLength(
                  currentIntervalStroke.width
                )
              : Math.max(8, currentIntervalStroke.width * 1.2),
          restoreSubjectBoundarySnapTolerance: Math.max(
            1,
            currentIntervalStroke.width * 0.2
          )
        }
      )
    }

    output.push(...finalRangePolygons)
  }

  if (shouldResolveSelfIntersectingLegalSide) {
    appendRangeForOffsetRibbonFrame(
      getOffsetRibbonFrame(slicingContext, resolvedIntervalStroke),
      resolvedIntervalStroke,
      false
    )
    return
  }

  appendRangeForOffsetRibbonFrame(
    getOffsetRibbonFrame(slicingContext, resolvedIntervalStroke),
    resolvedIntervalStroke,
    shouldClipInsideBoundary
  )
}

const buildDashedSourcePathFinalCoveragePolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topology: Pick<
    PathTopologyModel,
    | 'totalLength'
    | 'closed'
    | 'topologyFamily'
    | 'normalizedPoints'
    | 'fillRule'
  >,
  intervalSweep: DashedSourcePathIntervalSweep,
  interval: VisibleDashedTopologyInterval,
  authoredStroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  sharpGuardVertices: SharpGuardVertex[],
  slicingContext: SourcePathSlicingContext,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined,
  clipInsideToFillDomain: boolean,
  implicitFillRegions: PolygonRegion[] = []
) => {
  emitStrokePipelineCounter('final-coverage-builder-hit')
  const polygons: Vec2[][] = []

  for (const {
    range,
    span,
    renderRange,
    capOwnership
  } of intervalSweep.ranges) {
    appendDashedSourcePathFinalCoverageRangePolygons(
      polygons,
      path,
      topology,
      {
        range,
        span,
        renderRange,
        capOwnership
      },
      interval,
      authoredStroke,
      intervalStroke,
      sharpGuardVertices,
      slicingContext,
      strokeDomainPlan,
      clipInsideToFillDomain,
      implicitFillRegions
    )
  }

  const normalizedPolygons =
    topology.topologyFamily === 'self-intersecting'
      ? normalizeConstrainedDashedProductVisualPolygons(polygons)
      : polygons
  const shouldClipToImplicitFillDomain =
    clipInsideToFillDomain &&
    (topology.topologyFamily !== 'self-intersecting' ||
      (strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain' &&
        authoredStroke.position === 'outside'))

  if (!shouldClipToImplicitFillDomain) {
    return normalizedPolygons
  }

  const clippedPolygons = clipSourcePathPolygonsToEvenOddLegalDomain(
    normalizedPolygons,
    path,
    authoredStroke,
    implicitFillRegions
  )

  if (
    authoredStroke.position !== 'outside' ||
    clippedPolygons.length === 0 ||
    implicitFillRegions.length === 0
  ) {
    return clippedPolygons
  }

  return clipSourcePathPolygonsToEvenOddLegalDomain(
    clippedPolygons,
    path,
    authoredStroke,
    [],
    {
      fragmentStitchRadius: 0,
      fragmentPruneArea: Math.max(
        1,
        authoredStroke.width * authoredStroke.width * 0.1
      )
    }
  )
}

const isConstrainedDashedProductVisualCompilerEnabled = (
  options: ConstrainedDashedStrokeOptions
) => options.enableProductVisualCompiler === true

export const buildConstrainedDashedStrokeProductVisualEntries = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedDashedStrokeOptions = {}
): SolidCenterStrokeRenderEntry[] | null => {
  if (!isConstrainedDashedProductVisualCompilerEnabled(options)) {
    return null
  }

  const sourcePath = options.sourcePath
  if (!sourcePath?.closed || !closed) {
    return null
  }

  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const sourceTopology = classifyConstrainedDashedSource(
    topologyPoints,
    topology.closed,
    topology
  )
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  const sharpGuardVertices =
    topology.closed && sourceTopology !== 'degenerate'
      ? buildSharpGuardVertices(
          topologyPoints,
          segmentRanges,
          options.selectedSideGuardPoints,
          sourcePath,
          false
        )
      : []
  const slicingContext = createSourcePathSlicingContext(sourcePath)
  const ownerPrefix =
    options.metadata?.ownerKeyPrefix ?? 'anonymous-constrained-dashed-source'
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const renderableStrokes = getRenderableStrokes(strokes)
  const entries: SolidCenterStrokeRenderEntry[] = []

  for (
    let strokeIndex = 0;
    strokeIndex < renderableStrokes.length;
    strokeIndex += 1
  ) {
    const stroke = renderableStrokes[strokeIndex]
    if (
      !supportsConstrainedDashedStroke(stroke, topology.closed) ||
      (stroke.position !== 'inside' && stroke.position !== 'outside')
    ) {
      return null
    }

    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath,
      implicitFillRegions: options.implicitFillRegions,
      sharedSourceSplitRanges: options.sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
    })
    const allocatedVisibleIntervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      strokeDomainPlan
    )
    const visibleIntervals =
      replaceOutsideSmoothSourceVertexContinuityIntervals(
        allocatedVisibleIntervals,
        sourcePath,
        {
          position: stroke.position,
          width: stroke.width
        }
      )
    if (visibleIntervals.length === 0) {
      continue
    }

    const intervalStroke = getIntervalStrokeForSourceDirection(
      topologyPoints,
      topology.closed,
      stroke,
      topology.topologyFamily
    )
    const squareCapPhysicalStroke =
      stroke.cap === 'square'
        ? {
            ...stroke,
            ...intervalStroke,
            cap: 'butt' as const
          }
        : {
            ...stroke,
            ...intervalStroke,
            cap: stroke.cap
          }
    const sourceVertexBoundaryJoinRecords =
      buildOutsideSourceVertexBoundaryJoinRecords(
        sourcePath,
        visibleIntervals,
        {
          position: intervalStroke.position,
          width: intervalStroke.width,
          join: stroke.join,
          miterLimit: stroke.miterLimit
        }
      )
    const sourceVertexBoundaryJoinVertexIndexes = new Set(
      sourceVertexBoundaryJoinRecords.map(
        (joinRecord) => joinRecord.vertexIndex
      )
    )
    const intervalProductPolygons = visibleIntervals.flatMap((interval) => {
      const physicalSpans = getIntervalPhysicalSpans(topology, stroke, interval)
      const intervalSweep = buildDashedSourcePathIntervalSweep(
        sourcePath,
        physicalSpans,
        interval,
        stroke,
        squareCapPhysicalStroke,
        slicingContext
      )
      const finalCoveragePolygons = buildDashedSourcePathFinalCoveragePolygons(
        sourcePath,
        topology,
        intervalSweep,
        interval,
        stroke,
        intervalStroke,
        sharpGuardVertices,
        slicingContext,
        strokeDomainPlan,
        options.clipInsideToFillDomain === true,
        options.implicitFillRegions ?? []
      )
      const sourceVertexJoinPolygons =
        sourceVertexBoundaryJoinVertexIndexes.size > 0
          ? []
          : buildSourcePathIntervalJoinPolygons(sourcePath, physicalSpans, {
              position: intervalStroke.position,
              width: intervalStroke.width,
              join: stroke.join,
              miterLimit: stroke.miterLimit
            })
      const constrainedSourceVertexJoinPolygons =
        stroke.position === 'inside' &&
        options.clipInsideToFillDomain === true &&
        sourceVertexJoinPolygons.length > 0
          ? clipSourcePathPolygonsToEvenOddLegalDomain(
              sourceVertexJoinPolygons,
              sourcePath,
              stroke,
              options.implicitFillRegions ?? [],
              {
                fragmentPruneArea: EPSILON * 10,
                cleanupMicroEdgeTolerance: 0.001,
                cleanupCollinearTolerance: 0.0001
              }
            )
          : sourceVertexJoinPolygons

      return [...finalCoveragePolygons, ...constrainedSourceVertexJoinPolygons]
    })
    const sourceVertexBoundaryJoinPolygons =
      sourceVertexBoundaryJoinRecords.flatMap((joinRecord) =>
        options.clipInsideToFillDomain === true &&
        options.implicitFillRegions &&
        options.implicitFillRegions.length > 0
          ? clipSourcePathPolygonsToEvenOddLegalDomain(
              joinRecord.polygons,
              sourcePath,
              { position: stroke.position },
              options.implicitFillRegions,
              {
                fragmentStitchRadius: 0,
                fragmentPruneArea: Math.max(
                  1,
                  intervalStroke.width * intervalStroke.width * 0.1
                )
              }
            )
          : joinRecord.polygons
      )
    const polygons = normalizeConstrainedDashedProductVisualPolygons([
      ...intervalProductPolygons,
      ...sourceVertexBoundaryJoinPolygons
    ])
    const clipPolygons = getInsideSourcePathEvenOddLegalClipPolygons(
      sourcePath,
      stroke,
      options.implicitFillRegions ?? []
    )
    const fillPolygons = polygons
    if (polygons.length === 0) {
      continue
    }

    const geometryId = `${cachePrefix}:${strokeIndex}:product-visual`
    const classification = {
      sourceTopology,
      intervalTopology: 'other',
      acceptsFullLoopRoundJoin: true,
      acceptsSingleEdgeRoundCap: true,
      acceptsCornerSpanningJoin: true
    } satisfies ConstrainedDashedIntervalClassification
    const revisionSet = buildStrokeRuntimeRevisionSet({
      points: topologyPoints,
      closed: topology.closed,
      stroke,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: getConstrainedDashedResolutionStatus(
        classification.sourceTopology,
        classification.intervalTopology,
        !topology.closed && !topology.isSimpleOpen
      ),
      runtimeStatus: 'accepted',
      ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
      networkId: options.metadata?.networkId,
      strokeId: `stroke:${strokeIndex}`,
      intervalSignature: '',
      sourceTopology: classification.sourceTopology,
      intervalTopology: classification.intervalTopology
    })
    const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
      sourcePathId: cachePrefix,
      ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
      networkId: options.metadata?.networkId,
      strokeId: `stroke:${strokeIndex}`,
      strokeIndex,
      contourId,
      intervalId: 'product-visual',
      strokePosition: stroke.position,
      ownerSet: options.metadata?.ownerSet,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: getConstrainedDashedResolutionStatus(
        classification.sourceTopology,
        classification.intervalTopology,
        !topology.closed && !topology.isSimpleOpen
      ),
      runtimeStatus: 'accepted',
      sourceTopology: classification.sourceTopology,
      topologyFamily: topology.topologyFamily,
      intervalTopology: classification.intervalTopology,
      finalCoverageBuilderStatus: 'product-final',
      terminalCapCount:
        stroke.cap === 'round' ? visibleIntervals.length * 2 : undefined,
      revisionSet
    }

    entries.push({
      cacheKey: geometryId,
      stroke: {
        kind: stroke.kind,
        color: stroke.color,
        alpha: stroke.alpha,
        gradientStyle: stroke.gradientStyle,
        paintKey: stroke.paintKey
      },
      polygons,
      fillPolygons: fillPolygons.length > 0 ? fillPolygons : undefined,
      clipPolygons,
      debugMeta,
      revisionSet
    })
  }

  return entries
}

const isDistanceInsideInterval = (
  distance: number,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => {
  const loopDistance = normalizeDistanceOnLoop(distance, totalLength)
  const start = normalizeDistanceOnLoop(interval.startDistance, totalLength)
  const end = normalizeDistanceOnLoop(interval.endDistance, totalLength)

  if (interval.wrapsSeam) {
    return loopDistance >= start - EPSILON || loopDistance <= end + EPSILON
  }

  return loopDistance >= start - EPSILON && loopDistance <= end + EPSILON
}

const areLoopDistancesEqual = (
  left: number,
  right: number,
  totalLength: number
) => {
  if (totalLength <= EPSILON) {
    return Math.abs(left - right) <= EPSILON
  }

  const delta = Math.abs(
    normalizeDistanceOnLoop(left, totalLength) -
      normalizeDistanceOnLoop(right, totalLength)
  )
  return Math.min(delta, totalLength - delta) <= EPSILON
}

const isIntervalStartAtGuard = (
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance'
  >,
  guard: Pick<SharpGuardVertex, 'distance'>,
  totalLength: number
) => areLoopDistancesEqual(interval.startDistance, guard.distance, totalLength)

const isIntervalEndAtGuard = (
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'endDistance'
  >,
  guard: Pick<SharpGuardVertex, 'distance'>,
  totalLength: number
) => areLoopDistancesEqual(interval.endDistance, guard.distance, totalLength)

const isSharpGuardVertex = (points: Vec2[], index: number) => {
  const candidate = points[index] as SelectedSideGuardPoint
  if (candidate.sharp === false) {
    return false
  }

  const previous = points[(index - 1 + points.length) % points.length]
  const point = points[index]
  const next = points[(index + 1) % points.length]
  const incoming = normalizeVector({
    x: point.x - previous.x,
    y: point.y - previous.y
  })
  const outgoing = normalizeVector({
    x: next.x - point.x,
    y: next.y - point.y
  })

  if (!incoming || !outgoing) {
    return false
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  return Math.acos(dot) >= Math.PI / 4
}

interface SharpGuardVertex {
  distance: number
  previousSegmentStart: Vec2
  previousSegmentEnd: Vec2
  nextSegmentStart: Vec2
  nextSegmentEnd: Vec2
  previousBoundary: Vec2[]
  nextBoundary: Vec2[]
}

const normalizeClosedGuardPoints = (points: Vec2[]) => {
  if (
    points.length > 1 &&
    distanceBetween(points[0], points[points.length - 1]) <= EPSILON
  ) {
    return points.slice(0, -1)
  }

  return points
}

const findNearestSegmentRange = (
  point: Vec2,
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
) => {
  let nearestIndex = -1
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  topologyPoints.forEach((candidate, index) => {
    const distanceSquared =
      (candidate.x - point.x) * (candidate.x - point.x) +
      (candidate.y - point.y) * (candidate.y - point.y)
    if (distanceSquared < nearestDistanceSquared) {
      nearestIndex = index
      nearestDistanceSquared = distanceSquared
    }
  })

  return nearestIndex >= 0 ? segmentRanges[nearestIndex] : undefined
}

const buildSourceSegmentBoundary = (segment: PathSegment | undefined) =>
  segment ? slicePathSegmentPoints(segment, 0, segment.length) : []

const getSourceSegmentBoundary = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  segmentIndex: number,
  slicingContext?: SourcePathSlicingContext
) => {
  const segment = path.segments[segmentIndex]
  if (!segment) {
    return []
  }

  if (!slicingContext) {
    return buildSourceSegmentBoundary(segment)
  }

  const cached = slicingContext.segmentBoundaryCache.get(segmentIndex)
  if (cached) {
    return cached
  }

  const range = slicingContext.segmentRanges[segmentIndex]
  const boundary = range
    ? sliceSourcePathSegmentRangePoints(
        path,
        {
          startDistance: range.startDistance,
          endDistance: range.endDistance,
          segmentIndex
        },
        slicingContext
      )
    : buildSourceSegmentBoundary(segment)
  slicingContext.segmentBoundaryCache.set(segmentIndex, boundary)
  return boundary
}

const buildSharpGuardVertices = (
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  guardPoints: SelectedSideGuardPoint[] = topologyPoints,
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>,
  includeSourcePathBoundaryGeometry = true
): SharpGuardVertex[] => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length < 3) {
    return []
  }

  const canUseSourcePathSegments =
    sourcePath?.closed === true &&
    sourcePath.segments.length === normalizedGuardPoints.length
  const canUseDirectGuardRange =
    normalizedGuardPoints.length === segmentRanges.length
  const sourcePathSegmentRanges = canUseSourcePathSegments
    ? getSourcePathSegmentRanges(sourcePath)
    : []

  const vertices: SharpGuardVertex[] = []

  for (let index = 0; index < normalizedGuardPoints.length; index += 1) {
    if (isSharpGuardVertex(normalizedGuardPoints, index)) {
      const point = normalizedGuardPoints[index]
      const segment = canUseSourcePathSegments
        ? sourcePathSegmentRanges[index]
        : canUseDirectGuardRange
          ? segmentRanges[index]
          : findNearestSegmentRange(point, topologyPoints, segmentRanges)
      if (!segment) {
        continue
      }
      const previous =
        normalizedGuardPoints[
          (index - 1 + normalizedGuardPoints.length) %
            normalizedGuardPoints.length
        ]
      const next =
        normalizedGuardPoints[(index + 1) % normalizedGuardPoints.length]
      const previousBoundary =
        canUseSourcePathSegments && includeSourcePathBoundaryGeometry
          ? buildSourceSegmentBoundary(
              sourcePath.segments[
                (index - 1 + sourcePath.segments.length) %
                  sourcePath.segments.length
              ]
            )
          : [previous, point]
      const nextBoundary =
        canUseSourcePathSegments && includeSourcePathBoundaryGeometry
          ? buildSourceSegmentBoundary(sourcePath.segments[index])
          : [point, next]
      vertices.push({
        distance: segment.startDistance,
        previousSegmentStart: previous,
        previousSegmentEnd: point,
        nextSegmentStart: point,
        nextSegmentEnd: next,
        previousBoundary,
        nextBoundary
      })
    }
  }

  return vertices
}

const getIntervalGuardVertices = (
  sharpGuardVertices: SharpGuardVertex[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => {
  if (
    sharpGuardVertices.length === 0 ||
    segmentRanges.length === 0 ||
    totalLength <= EPSILON
  ) {
    return []
  }

  const selectedVertices: SharpGuardVertex[] = []

  for (const vertex of sharpGuardVertices) {
    if (isDistanceInsideInterval(vertex.distance, interval, totalLength)) {
      selectedVertices.push(vertex)
    }
  }

  return selectedVertices
}

const clipPolygonToSelectedSideOfSegment = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1
) => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const isInside = (point: Vec2) => {
    const cross =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    return selectedSide > 0 ? cross >= -EPSILON : cross <= EPSILON
  }
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous =
      polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside) {
      if (!previousInside) {
        output.push(
          lineIntersection(previous, current, segmentStart, segmentEnd)
        )
      }
      output.push(current)
      continue
    }

    if (previousInside) {
      output.push(lineIntersection(previous, current, segmentStart, segmentEnd))
    }
  }

  return cleanPolygon(output)
}

const areSamePoint = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y) <= EPSILON

const isCollinearPoint = (previous: Vec2, point: Vec2, next: Vec2) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  return Math.abs(ax * by - ay * bx) <= EPSILON
}

const cleanPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 2) {
    return polygon
  }

  const deduped: Vec2[] = []
  for (const point of polygon) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push(point)
    }
  }

  if (
    deduped.length > 2 &&
    areSamePoint(deduped[0], deduped[deduped.length - 1])
  ) {
    deduped.pop()
  }

  if (deduped.length < 4) {
    return deduped
  }

  const cleaned: Vec2[] = []
  for (let index = 0; index < deduped.length; index += 1) {
    const previous = deduped[(index - 1 + deduped.length) % deduped.length]
    const point = deduped[index]
    const next = deduped[(index + 1) % deduped.length]
    if (!isCollinearPoint(previous, point, next)) {
      cleaned.push(point)
    }
  }

  return cleaned.length >= 3 ? cleaned : deduped
}

const cleanBoundaryPath = (points: Vec2[]) => {
  if (points.length < 2) {
    return points
  }

  const deduped: Vec2[] = []
  for (const point of points) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push(point)
    }
  }

  return deduped
}

const CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE = 0.03
const CLIPPED_PRODUCT_COLLINEAR_TOLERANCE = 0.0075

interface ClippedProductCleanupOptions {
  cleanupMicroEdgeTolerance?: number
  cleanupCollinearTolerance?: number
  restoreSubjectBoundaryMaxEdgeLength?: number
  restoreSubjectBoundarySnapTolerance?: number
  restoreSubjectBoundaryPolygons?: Vec2[][]
  restoreSubjectBoundaryPaths?: Vec2[][]
}

const isNearCollinearPoint = (
  previous: Vec2,
  point: Vec2,
  next: Vec2,
  tolerance: number
) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  const cross = Math.abs(ax * by - ay * bx)
  const scale = Math.max(Math.hypot(ax, ay) + Math.hypot(bx, by), 1)
  return cross / scale <= tolerance
}

const cleanClippedProductPolygon = (
  polygon: Vec2[],
  options: ClippedProductCleanupOptions = {}
) => {
  const microEdgeTolerance =
    options.cleanupMicroEdgeTolerance ?? CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE
  const collinearTolerance =
    options.cleanupCollinearTolerance ?? CLIPPED_PRODUCT_COLLINEAR_TOLERANCE
  let cleaned = cleanPolygon(polygon)
  if (cleaned.length < 4) {
    return cleaned
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const deduped: Vec2[] = []
    for (const point of cleaned) {
      const previous = deduped[deduped.length - 1]
      if (
        !previous ||
        Math.hypot(previous.x - point.x, previous.y - point.y) >
          microEdgeTolerance
      ) {
        deduped.push(point)
      }
    }

    if (
      deduped.length > 2 &&
      Math.hypot(
        deduped[0].x - deduped[deduped.length - 1].x,
        deduped[0].y - deduped[deduped.length - 1].y
      ) <= microEdgeTolerance
    ) {
      deduped.pop()
    }

    if (deduped.length < 4) {
      cleaned = deduped
      break
    }

    const simplified: Vec2[] = []
    for (let index = 0; index < deduped.length; index += 1) {
      const previous = deduped[(index - 1 + deduped.length) % deduped.length]
      const point = deduped[index]
      const next = deduped[(index + 1) % deduped.length]
      if (
        Math.hypot(previous.x - point.x, previous.y - point.y) <=
          microEdgeTolerance ||
        Math.hypot(point.x - next.x, point.y - next.y) <= microEdgeTolerance ||
        isNearCollinearPoint(previous, point, next, collinearTolerance)
      ) {
        continue
      }
      simplified.push(point)
    }

    if (
      simplified.length === cleaned.length ||
      simplified.length < 3 ||
      Math.abs(polygonArea(simplified)) <= EPSILON
    ) {
      cleaned = simplified.length >= 3 ? simplified : cleaned
      break
    }

    cleaned = simplified
  }

  for (let pass = 0; pass < 80 && cleaned.length >= 4; pass += 1) {
    let removeIndex = -1
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]
      const point = cleaned[index]
      const next = cleaned[(index + 1) % cleaned.length]
      if (
        Math.hypot(previous.x - point.x, previous.y - point.y) <=
          microEdgeTolerance ||
        Math.hypot(point.x - next.x, point.y - next.y) <= microEdgeTolerance ||
        isNearCollinearPoint(previous, point, next, collinearTolerance)
      ) {
        removeIndex = index
        continue
      }
    }
    if (removeIndex < 0) {
      break
    }
    const compacted = cleaned.filter((_, index) => index !== removeIndex)
    if (compacted.length < 3 || Math.abs(polygonArea(compacted)) <= EPSILON) {
      break
    }
    cleaned = compacted
  }

  return cleanPolygon(cleaned)
}

type SourcePathWithOptionalSamples = Pick<
  PathGeometry,
  'segments' | 'closed' | 'totalLength'
> &
  Partial<Pick<PathGeometry, 'sampledPoints'>>

const hasPolygonGeometry = (polygon: Vec2[]) =>
  polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON

const normalizeCoveragePolygonWinding = (polygon: Vec2[]) =>
  polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon

const normalizeCoveragePolygonsWinding = (polygons: Vec2[][]) =>
  polygons.map(normalizeCoveragePolygonWinding)

const toCoveragePolygonRegions = (polygons: Vec2[][]) =>
  normalizeCoveragePolygonsWinding(polygons).map((polygon) => ({
    polygons: [polygon]
  }))

const cleanClippedProductPolygons = (
  polygons: Vec2[][],
  options: ClippedProductCleanupOptions = {}
) =>
  polygons
    .map((polygon) => cleanClippedProductPolygon(polygon, options))
    .filter(hasPolygonGeometry)

interface ProductBoundaryProjection {
  polygon: Vec2[]
  edgeIndex: number
  point: Vec2
  distance: number
  t: number
}

interface ProductBoundaryPathProjection {
  path: Vec2[]
  segmentIndex: number
  point: Vec2
  distance: number
  t: number
}

const findNearestProductBoundaryProjection = (
  point: Vec2,
  polygon: Vec2[]
): ProductBoundaryProjection | null => {
  if (polygon.length < 2) {
    return null
  }

  let nearest: ProductBoundaryProjection | null = null
  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const start = polygon[edgeIndex]
    const end = polygon[(edgeIndex + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t =
      lengthSquared > EPSILON
        ? Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared
            )
          )
        : 0
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    }
    const projectedDistance = distanceBetween(point, projected)
    if (!nearest || projectedDistance < nearest.distance) {
      nearest = {
        polygon,
        edgeIndex,
        point: normalizePoint(projected),
        distance: projectedDistance,
        t
      }
    }
  }

  return nearest
}

const findNearestProductBoundaryPathProjection = (
  point: Vec2,
  path: Vec2[]
): ProductBoundaryPathProjection | null => {
  if (path.length < 2) {
    return null
  }

  let nearest: ProductBoundaryPathProjection | null = null
  for (
    let segmentIndex = 0;
    segmentIndex < path.length - 1;
    segmentIndex += 1
  ) {
    const start = path[segmentIndex]
    const end = path[segmentIndex + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t =
      lengthSquared > EPSILON
        ? Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared
            )
          )
        : 0
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    }
    const projectedDistance = distanceBetween(point, projected)
    if (!nearest || projectedDistance < nearest.distance) {
      nearest = {
        path,
        segmentIndex,
        point: normalizePoint(projected),
        distance: projectedDistance,
        t
      }
    }
  }

  return nearest
}

const pushDistinctBoundaryPoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (!previous || distanceBetween(previous, point) > EPSILON) {
    points.push(point)
  }
}

const buildProductBoundaryPath = (
  start: ProductBoundaryProjection,
  end: ProductBoundaryProjection,
  direction: 1 | -1
) => {
  const polygon = start.polygon
  const pointCount = polygon.length
  if (pointCount < 2 || end.polygon !== polygon) {
    return []
  }

  const points: Vec2[] = []
  pushDistinctBoundaryPoint(points, start.point)

  if (direction === 1) {
    let edgeIndex = start.edgeIndex
    for (let step = 0; step <= pointCount; step += 1) {
      if (edgeIndex === end.edgeIndex) {
        pushDistinctBoundaryPoint(points, end.point)
        break
      }
      pushDistinctBoundaryPoint(points, polygon[(edgeIndex + 1) % pointCount])
      edgeIndex = (edgeIndex + 1) % pointCount
    }
  } else {
    let edgeIndex = start.edgeIndex
    for (let step = 0; step <= pointCount; step += 1) {
      if (edgeIndex === end.edgeIndex) {
        pushDistinctBoundaryPoint(points, end.point)
        break
      }
      pushDistinctBoundaryPoint(points, polygon[edgeIndex])
      edgeIndex = (edgeIndex - 1 + pointCount) % pointCount
    }
  }

  return points.length >= 2 ? points : []
}

const buildProductBoundaryOpenPath = (
  start: ProductBoundaryPathProjection,
  end: ProductBoundaryPathProjection
) => {
  const path = start.path
  if (path.length < 2 || end.path !== path) {
    return []
  }

  const points: Vec2[] = []
  if (start.segmentIndex <= end.segmentIndex) {
    pushDistinctBoundaryPoint(points, start.point)
    for (
      let index = start.segmentIndex + 1;
      index <= end.segmentIndex;
      index += 1
    ) {
      pushDistinctBoundaryPoint(points, path[index])
    }
    pushDistinctBoundaryPoint(points, end.point)
  } else {
    pushDistinctBoundaryPoint(points, start.point)
    for (let index = start.segmentIndex; index > end.segmentIndex; index -= 1) {
      pushDistinctBoundaryPoint(points, path[index])
    }
    pushDistinctBoundaryPoint(points, end.point)
  }

  return points.length >= 2 ? points : []
}

const getPolylineLength = (points: Vec2[]) =>
  points.reduce((total, point, index) => {
    if (index === 0) {
      return 0
    }
    return total + distanceBetween(points[index - 1], point)
  }, 0)

const getPolylineMaxEdgeLength = (points: Vec2[]) =>
  points.reduce((maxLength, point, index) => {
    if (index === 0) {
      return maxLength
    }
    return Math.max(maxLength, distanceBetween(points[index - 1], point))
  }, 0)

const chooseRestoredProductBoundaryPath = (
  start: Vec2,
  end: Vec2,
  subjectPolygons: Vec2[][],
  subjectPaths: Vec2[][],
  maxEdgeLength: number,
  snapTolerance: number
) => {
  const directLength = distanceBetween(start, end)
  const isUsableRestoredPath = (path: Vec2[]) => {
    if (path.length < 3) {
      return false
    }
    const length = getPolylineLength(path)
    const maxSegmentLength = getPolylineMaxEdgeLength(path)
    return (
      length > directLength + EPSILON &&
      length <= Math.max(directLength * 4, directLength + maxEdgeLength * 4) &&
      maxSegmentLength <= Math.max(maxEdgeLength, directLength * 0.75)
    )
  }
  const toCandidate = (path: Vec2[]) =>
    isUsableRestoredPath(path)
      ? [
          {
            path,
            length: getPolylineLength(path),
            maxSegmentLength: getPolylineMaxEdgeLength(path)
          }
        ]
      : []

  const polygonCandidates = subjectPolygons.flatMap((polygon) => {
    const startProjection = findNearestProductBoundaryProjection(start, polygon)
    const endProjection = findNearestProductBoundaryProjection(end, polygon)
    if (
      !startProjection ||
      !endProjection ||
      startProjection.distance > snapTolerance ||
      endProjection.distance > snapTolerance
    ) {
      return []
    }

    return ([1, -1] as const).flatMap((direction) => {
      const path = buildProductBoundaryPath(
        startProjection,
        endProjection,
        direction
      )
      if (path.length < 3) {
        return []
      }
      return toCandidate(path)
    })
  })
  const pathCandidates = subjectPaths.flatMap((path) => {
    const startProjection = findNearestProductBoundaryPathProjection(
      start,
      path
    )
    const endProjection = findNearestProductBoundaryPathProjection(end, path)
    if (
      !startProjection ||
      !endProjection ||
      startProjection.distance > snapTolerance ||
      endProjection.distance > snapTolerance
    ) {
      return []
    }

    return toCandidate(
      buildProductBoundaryOpenPath(startProjection, endProjection)
    )
  })
  const candidates = [...polygonCandidates, ...pathCandidates]

  return (
    candidates.sort(
      (left, right) =>
        left.length - right.length ||
        left.maxSegmentLength - right.maxSegmentLength
    )[0]?.path ?? null
  )
}

const restoreClippedProductLongBoundaryEdges = (
  polygons: Vec2[][],
  subjectPolygons: Vec2[][],
  options: ClippedProductCleanupOptions = {}
) => {
  const maxEdgeLength = options.restoreSubjectBoundaryMaxEdgeLength
  if (
    !maxEdgeLength ||
    maxEdgeLength <= EPSILON ||
    subjectPolygons.length === 0
  ) {
    return polygons
  }

  const snapTolerance = Math.max(
    options.restoreSubjectBoundarySnapTolerance ?? 0.75,
    0.1
  )

  return polygons.map((polygon) => {
    if (polygon.length < 3) {
      return polygon
    }
    const restored: Vec2[] = []
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      pushDistinctBoundaryPoint(restored, start)
      if (distanceBetween(start, end) <= maxEdgeLength) {
        continue
      }
      const restoredPath = chooseRestoredProductBoundaryPath(
        start,
        end,
        subjectPolygons,
        options.restoreSubjectBoundaryPaths ?? [],
        maxEdgeLength,
        snapTolerance
      )
      if (!restoredPath) {
        continue
      }
      restoredPath.slice(1, -1).forEach((point) => {
        pushDistinctBoundaryPoint(restored, point)
      })
    }

    return restored.length >= 3 ? restored : polygon
  })
}

const getClippedProductMicroEdgeCount = (polygons: Vec2[][]) =>
  polygons.reduce((total, polygon) => {
    let microEdgeCount = 0
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index]
      const next = polygon[(index + 1) % polygon.length]
      if (
        Math.hypot(point.x - next.x, point.y - next.y) <
        CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE
      ) {
        microEdgeCount += 1
      }
    }
    return total + microEdgeCount
  }, 0)

const getCoveragePolygonsFromRegions = (regions: { polygons: Vec2[][] }[]) =>
  regions
    .flatMap((region) => region.polygons)
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)

const projectPointToSegment = (point: Vec2, start: Vec2, end: Vec2): Vec2 => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) {
    return { ...start }
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return {
    x: start.x + dx * t,
    y: start.y + dy * t
  }
}

const projectPointToNearestPolygonBoundary = (
  point: Vec2,
  polygons: Vec2[][]
) => {
  let nearestPoint: Vec2 | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  polygons.forEach((polygon) => {
    for (let index = 0; index < polygon.length; index += 1) {
      const projected = projectPointToSegment(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      )
      const distanceSquared =
        (projected.x - point.x) * (projected.x - point.x) +
        (projected.y - point.y) * (projected.y - point.y)
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared
        nearestPoint = projected
      }
    }
  })
  return nearestPoint
}

const isPointInLegalPolygons = (point: Vec2, legalPolygons: Vec2[][]) =>
  legalPolygons.some(
    (legalPolygon) =>
      isPointInsideTopologyPolygon(point, legalPolygon) ||
      pointSegmentDistanceSquaredToPolygon(point, legalPolygon) <= 0.25
  )

const clampInsideClipPointToLegalBoundary = (
  point: Vec2,
  legalPolygons: Vec2[][]
) =>
  isPointInLegalPolygons(point, legalPolygons)
    ? point
    : (projectPointToNearestPolygonBoundary(point, legalPolygons) ?? point)

const clampInsideClipPolygonToLegalBoundary = (
  polygon: Vec2[],
  legalPolygons: Vec2[][]
) =>
  polygon.map((point) =>
    clampInsideClipPointToLegalBoundary(point, legalPolygons)
  )

const densifyInsideClipPolygonEdgesToLegalBoundary = (
  polygon: Vec2[],
  legalPolygons: Vec2[][],
  maxStep = 0.25
) => {
  if (polygon.length < 2) {
    return polygon
  }

  const densified: Vec2[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    densified.push(start)
    const length = distanceBetween(start, end)
    const steps = Math.max(1, Math.ceil(length / maxStep))
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      densified.push(
        clampInsideClipPointToLegalBoundary(
          {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          },
          legalPolygons
        )
      )
    }
  }
  return densified
}

const getSourcePathEvenOddLegalPoints = (
  path: SourcePathWithOptionalSamples
) => {
  const slicedLegalBoundary = cleanPolygon(
    slicePathGeometryPoints(path, 0, path.totalLength, false, 0.1, {
      minCubicSamples: 64,
      maxCubicSamples: 512,
      useRangeLengthForSampleCount: false
    })
  )

  if (slicedLegalBoundary.length >= 3) {
    return slicedLegalBoundary
  }

  if (path.sampledPoints && path.sampledPoints.length >= 3) {
    return cleanPolygon(path.sampledPoints)
  }

  return slicedLegalBoundary
}

const clipSourcePathPolygonsToEvenOddLegalDomain = (
  polygons: Vec2[][],
  path: SourcePathWithOptionalSamples,
  stroke: Pick<RenderableStroke, 'position'>,
  implicitFillRegions: PolygonRegion[] = [],
  options: {
    fragmentStitchRadius?: number
    fragmentPruneArea?: number
  } & ClippedProductCleanupOptions = {}
) => {
  if (
    (stroke.position !== 'inside' && stroke.position !== 'outside') ||
    (!path.closed && implicitFillRegions.length === 0) ||
    polygons.length === 0
  ) {
    return polygons
  }

  const subjectPolygons = polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length === 0) {
    return []
  }
  const subjectBoundaryPolygons = (
    options.restoreSubjectBoundaryPolygons ?? subjectPolygons
  )
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
  const subjectBoundaryPaths = (options.restoreSubjectBoundaryPaths ?? [])
    .map(cleanBoundaryPath)
    .filter((path) => path.length >= 2)
  const shouldNormalizeClipResidue =
    (options.fragmentStitchRadius ?? 0) > EPSILON ||
    (options.fragmentPruneArea ?? 0) > EPSILON
  const restoreClipResultPolygons = (clipPolygons: Vec2[][]) =>
    restoreClippedProductLongBoundaryEdges(
      clipPolygons,
      subjectBoundaryPolygons,
      {
        ...options,
        restoreSubjectBoundaryPaths: subjectBoundaryPaths
      }
    )
  const normalizeClipResultPolygons = (clipPolygons: Vec2[][]) => {
    const restored = restoreClipResultPolygons(clipPolygons)
    return shouldNormalizeClipResidue
      ? cleanClippedProductPolygons(restored, options)
      : restored.map(cleanPolygon).filter(hasPolygonGeometry)
  }

  const legalPoints =
    implicitFillRegions.length === 0
      ? getSourcePathEvenOddLegalPoints(path)
      : []
  const legalRegions =
    implicitFillRegions.length > 0
      ? implicitFillRegions
      : legalPoints.length >= 3 && Math.abs(polygonArea(legalPoints)) > EPSILON
        ? [{ polygons: [normalizeCoveragePolygonWinding(legalPoints)] }]
        : []
  if (legalRegions.length === 0) {
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (
      !backend.capabilities.intersection ||
      (stroke.position === 'outside' && !backend.capabilities.difference)
    ) {
      return implicitFillRegions.length > 0 ? [] : subjectPolygons
    }

    const normalizedLegalRegions =
      implicitFillRegions.length > 0
        ? backend.union(legalRegions, 'nonzero')
        : legalRegions
    const legalClipRegions =
      normalizedLegalRegions.length > 0 ? normalizedLegalRegions : legalRegions
    const normalizedSubjectPolygons = subjectPolygons
    if (normalizedSubjectPolygons.length === 0) {
      return []
    }

    if (stroke.position === 'inside') {
      const directClippedPolygons = getCoveragePolygonsFromRegions(
        backend.intersection(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          'nonzero'
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      if (directClippedPolygons.length <= 1) {
        return directClippedPolygons.length > 0
          ? directClippedPolygons
          : subjectPolygons
      }

      const unionedClippedPolygons = getCoveragePolygonsFromRegions(
        backend.union(
          toCoveragePolygonRegions(directClippedPolygons),
          'nonzero'
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      return unionedClippedPolygons.length > 0
        ? unionedClippedPolygons
        : directClippedPolygons
    }

    const clipOperation = backend.difference.bind(backend)
    const finalizeClipResultPolygons = (
      clipPolygons: Vec2[][],
      fillRule: 'evenodd' | 'nonzero'
    ) => {
      const normalized = normalizeClipResultPolygons(clipPolygons)
      if (!shouldNormalizeClipResidue || normalized.length === 0) {
        return normalized
      }

      const legallyClipped = getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalized),
          legalClipRegions,
          fillRule
        )
      )

      if (stroke.position === 'inside') {
        const legalPolygons = getCoveragePolygonsFromRegions(legalClipRegions)
        const insideClamped =
          legalPolygons.length > 0
            ? legallyClipped.map((polygon) =>
                densifyInsideClipPolygonEdgesToLegalBoundary(
                  clampInsideClipPolygonToLegalBoundary(polygon, legalPolygons),
                  legalPolygons
                )
              )
            : legallyClipped
        const reclippedInside = getCoveragePolygonsFromRegions(
          backend.intersection(
            toCoveragePolygonRegions(insideClamped.filter(hasPolygonGeometry)),
            legalClipRegions,
            fillRule
          )
        )
        return reclippedInside.map(cleanPolygon).filter(hasPolygonGeometry)
      }

      const outsideCleaned = cleanClippedProductPolygons(
        restoreClipResultPolygons(legallyClipped),
        options
      )
      if (outsideCleaned.length === 0) {
        return []
      }
      return restoreClipResultPolygons(
        getCoveragePolygonsFromRegions(
          backend.difference(
            toCoveragePolygonRegions(outsideCleaned),
            legalClipRegions,
            fillRule
          )
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)
    }
    const directClippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          'nonzero'
        )
      ),
      'nonzero'
    )
    if (directClippedPolygons.length > 0) {
      if (!shouldNormalizeClipResidue) {
        return directClippedPolygons
      }

      const prunedDirectPolygons = pruneSmallClippedProductFragments(
        directClippedPolygons,
        options.fragmentPruneArea ?? 0
      )

      const stitchedDirectPolygons = stitchClippedProductFragments(
        prunedDirectPolygons,
        options.fragmentStitchRadius ?? 0
      )
      if (
        stitchedDirectPolygons.length === 1 ||
        prunedDirectPolygons.length === 1
      ) {
        return finalizeClipResultPolygons(stitchedDirectPolygons, 'nonzero')
      }

      if (directClippedPolygons.length <= 1) {
        return directClippedPolygons
      }

      const unionedDirectPolygons = finalizeClipResultPolygons(
        getCoveragePolygonsFromRegions(
          backend.union(
            toCoveragePolygonRegions(prunedDirectPolygons),
            'nonzero'
          )
        ),
        'nonzero'
      )
      const prunedUnionedDirectPolygons = pruneSmallClippedProductFragments(
        unionedDirectPolygons,
        options.fragmentPruneArea ?? 0
      )
      if (prunedUnionedDirectPolygons.length === 1) {
        return finalizeClipResultPolygons(
          prunedUnionedDirectPolygons,
          'nonzero'
        )
      }

      const stitchedUnionedDirectPolygons = stitchClippedProductFragments(
        prunedUnionedDirectPolygons,
        options.fragmentStitchRadius ?? 0
      )
      return finalizeClipResultPolygons(
        stitchedUnionedDirectPolygons.length > 0
          ? stitchedUnionedDirectPolygons
          : prunedUnionedDirectPolygons,
        'nonzero'
      )
    }

    const clippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          'nonzero'
        )
      ),
      'nonzero'
    )
    if (clippedPolygons.length <= 1) {
      return clippedPolygons
    }
    if (!shouldNormalizeClipResidue) {
      return clippedPolygons
    }

    const prunedClippedPolygons = pruneSmallClippedProductFragments(
      clippedPolygons,
      options.fragmentPruneArea ?? 0
    )

    const stitchedClippedPolygons = stitchClippedProductFragments(
      prunedClippedPolygons,
      options.fragmentStitchRadius ?? 0
    )
    if (
      stitchedClippedPolygons.length === 1 ||
      prunedClippedPolygons.length === 1
    ) {
      return finalizeClipResultPolygons(stitchedClippedPolygons, 'nonzero')
    }

    const unionedClippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        backend.union(
          toCoveragePolygonRegions(prunedClippedPolygons),
          'nonzero'
        )
      ),
      'nonzero'
    )
    const prunedUnionedClippedPolygons = pruneSmallClippedProductFragments(
      unionedClippedPolygons,
      options.fragmentPruneArea ?? 0
    )
    if (prunedUnionedClippedPolygons.length === 1) {
      return finalizeClipResultPolygons(prunedUnionedClippedPolygons, 'nonzero')
    }

    const stitchedUnionedClippedPolygons = stitchClippedProductFragments(
      prunedUnionedClippedPolygons,
      options.fragmentStitchRadius ?? 0
    )
    return finalizeClipResultPolygons(
      stitchedUnionedClippedPolygons.length > 0
        ? stitchedUnionedClippedPolygons
        : prunedUnionedClippedPolygons,
      'nonzero'
    )
  } catch {
    return []
  }
}

const getInsideSourcePathEvenOddLegalClipPolygons = (
  path: SourcePathWithOptionalSamples,
  stroke: Pick<RenderableStroke, 'position'>,
  implicitFillRegions: PolygonRegion[] = []
) => {
  if (stroke.position !== 'inside' || !path.closed) {
    return undefined
  }

  if (implicitFillRegions.length > 0) {
    try {
      const backend = getGeometryBackend()
      const clipPolygons = getCoveragePolygonsFromRegions(
        backend.capabilities.union
          ? backend.union(implicitFillRegions, 'nonzero')
          : implicitFillRegions
      )
      return clipPolygons.length > 0 ? clipPolygons : undefined
    } catch {
      return undefined
    }
  }

  const legalPoints = getSourcePathEvenOddLegalPoints(path)
  if (legalPoints.length < 3 || Math.abs(polygonArea(legalPoints)) <= EPSILON) {
    return undefined
  }

  const clipPolygons = getCoveragePolygonsFromRegions([
    { polygons: [legalPoints] }
  ])

  return clipPolygons.length > 0 ? clipPolygons : undefined
}

const normalizeConstrainedDashedProductVisualPolygons = (
  polygons: Vec2[][],
  options: { cleanClipResidue?: boolean } = {}
) => {
  const normalizePolygons = options.cleanClipResidue
    ? cleanClippedProductPolygons
    : (inputPolygons: Vec2[][]) =>
        inputPolygons.map(cleanPolygon).filter(hasPolygonGeometry)
  const subjectPolygons = normalizePolygons(polygons)
  if (subjectPolygons.length <= 1) {
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.union) {
      return subjectPolygons
    }

    const normalizedPolygons = getCoveragePolygonsFromRegions(
      backend.union(toCoveragePolygonRegions(subjectPolygons), 'nonzero')
    )
    return normalizedPolygons.length > 0
      ? normalizePolygons(normalizedPolygons)
      : subjectPolygons
  } catch {
    return subjectPolygons
  }
}

const stitchClippedProductFragments = (polygons: Vec2[][], radius: number) => {
  const subjectPolygons =
    radius > EPSILON
      ? cleanClippedProductPolygons(polygons)
      : polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length === 0 || radius <= EPSILON) {
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.offset || !backend.capabilities.union) {
      return subjectPolygons
    }

    const stitchOptions = {
      width: radius * 2,
      join: 'round' as const,
      cap: 'round' as const,
      closed: true,
      miterLimit: 2,
      fillRule: 'nonzero' as const
    }
    const expanded = backend.offset(subjectPolygons, radius, stitchOptions)
    const mergedExpanded = backend.union(expanded, 'nonzero')
    const contracted = backend.offset(
      getCoveragePolygonsFromRegions(mergedExpanded),
      -radius,
      stitchOptions
    )
    const stitched = cleanClippedProductPolygons(
      getCoveragePolygonsFromRegions(backend.union(contracted, 'nonzero'))
    )
    const subjectArea = subjectPolygons.reduce(
      (total, polygon) => total + Math.abs(polygonArea(polygon)),
      0
    )
    const stitchedArea = stitched.reduce(
      (total, polygon) => total + Math.abs(polygonArea(polygon)),
      0
    )
    const closesNarrowResidue =
      stitchedArea > subjectArea + EPSILON &&
      stitchedArea <= subjectArea + Math.PI * radius * radius * 4

    return stitched.length > 0 &&
      (stitched.length < subjectPolygons.length ||
        getClippedProductMicroEdgeCount(stitched) <
          getClippedProductMicroEdgeCount(subjectPolygons) ||
        closesNarrowResidue)
      ? stitched
      : subjectPolygons
  } catch {
    return subjectPolygons
  }
}

const pruneSmallClippedProductFragments = (
  polygons: Vec2[][],
  minArea: number
) => {
  const subjectPolygons =
    minArea > EPSILON
      ? cleanClippedProductPolygons(polygons)
      : polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length <= 1 || minArea <= EPSILON) {
    return subjectPolygons
  }

  const polygonAreas = subjectPolygons.map((polygon) =>
    Math.abs(polygonArea(polygon))
  )
  const maxArea = Math.max(...polygonAreas)
  if (maxArea <= EPSILON) {
    return subjectPolygons
  }

  const filtered = subjectPolygons.filter((_, index) => {
    const area = polygonAreas[index]
    return area >= minArea || area / maxArea >= 0.12
  })

  return filtered.length > 0 ? filtered : subjectPolygons
}

const getPolygonBounds = (polygon: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

const getPolylineBounds = (polyline: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of polyline) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

const polylineBoundsCache = new WeakMap<Vec2[], Bounds>()

const getCachedPolylineBounds = (polyline: Vec2[]) => {
  const cached = polylineBoundsCache.get(polyline)
  if (cached) {
    return cached
  }

  const bounds = getPolylineBounds(polyline)
  polylineBoundsCache.set(polyline, bounds)
  return bounds
}

const boundsOverlapBounds = (first: Bounds, second: Bounds) =>
  first.minX <= second.maxX + EPSILON &&
  first.maxX + EPSILON >= second.minX &&
  first.minY <= second.maxY + EPSILON &&
  first.maxY + EPSILON >= second.minY

const segmentBoundsOverlapPolygon = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  polygon: Vec2[]
) => {
  const bounds = getPolygonBounds(polygon)
  return boundsOverlapBounds(
    {
      minX: Math.min(segmentStart.x, segmentEnd.x),
      minY: Math.min(segmentStart.y, segmentEnd.y),
      maxX: Math.max(segmentStart.x, segmentEnd.x),
      maxY: Math.max(segmentStart.y, segmentEnd.y)
    },
    bounds
  )
}

const segmentBoundsOverlapBounds = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  bounds: Bounds
) =>
  Math.min(segmentStart.x, segmentEnd.x) <= bounds.maxX + EPSILON &&
  Math.max(segmentStart.x, segmentEnd.x) + EPSILON >= bounds.minX &&
  Math.min(segmentStart.y, segmentEnd.y) <= bounds.maxY + EPSILON &&
  Math.max(segmentStart.y, segmentEnd.y) + EPSILON >= bounds.minY

const segmentBoundsOverlapSegment = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
) =>
  Math.min(firstStart.x, firstEnd.x) <=
    Math.max(secondStart.x, secondEnd.x) + EPSILON &&
  Math.max(firstStart.x, firstEnd.x) + EPSILON >=
    Math.min(secondStart.x, secondEnd.x) &&
  Math.min(firstStart.y, firstEnd.y) <=
    Math.max(secondStart.y, secondEnd.y) + EPSILON &&
  Math.max(firstStart.y, firstEnd.y) + EPSILON >=
    Math.min(secondStart.y, secondEnd.y)

const pointSegmentDistanceSquared = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON * EPSILON) {
    const fallbackDx = point.x - start.x
    const fallbackDy = point.y - start.y
    return fallbackDx * fallbackDx + fallbackDy * fallbackDy
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )

  const projectedX = start.x + dx * t
  const projectedY = start.y + dy * t
  const projectedDx = point.x - projectedX
  const projectedDy = point.y - projectedY
  return projectedDx * projectedDx + projectedDy * projectedDy
}

const pointSegmentDistanceSquaredToPolygon = (point: Vec2, polygon: Vec2[]) =>
  polygon.reduce((minimumDistanceSquared, currentPoint, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length]
    return Math.min(
      minimumDistanceSquared,
      pointSegmentDistanceSquared(point, currentPoint, nextPoint)
    )
  }, Number.POSITIVE_INFINITY)

const isPointNearPolyline = (
  point: Vec2,
  polyline: Vec2[],
  maxDistance: number
) => {
  if (polyline.length === 0) {
    return false
  }

  const maxDistanceSquared = maxDistance * maxDistance
  if (polyline.length === 1) {
    const dx = point.x - polyline[0].x
    const dy = point.y - polyline[0].y
    return dx * dx + dy * dy <= maxDistanceSquared
  }

  for (let index = 0; index < polyline.length - 1; index += 1) {
    if (
      pointSegmentDistanceSquared(
        point,
        polyline[index],
        polyline[index + 1]
      ) <= maxDistanceSquared
    ) {
      return true
    }
  }
  return false
}

const countSourceEdgeVertices = (polygons: Vec2[][], source: Vec2[]) =>
  polygons.reduce(
    (count, polygon) =>
      count +
      polygon.filter((point) => isPointNearPolyline(point, source, 0.5)).length,
    0
  )

interface SegmentIntersectionHit {
  point: Vec2
  polygonEdgeIndex: number
  polygonT: number
  boundaryEdgeIndex: number
  boundaryT: number
  polygonPosition: number
  boundaryPosition: number
}

const segmentIntersectionWithParams = (
  polygonStart: Vec2,
  polygonEnd: Vec2,
  boundaryStart: Vec2,
  boundaryEnd: Vec2
) => {
  const rx = polygonEnd.x - polygonStart.x
  const ry = polygonEnd.y - polygonStart.y
  const sx = boundaryEnd.x - boundaryStart.x
  const sy = boundaryEnd.y - boundaryStart.y
  const denominator = rx * sy - ry * sx
  if (Math.abs(denominator) <= EPSILON) {
    return null
  }

  const qpx = boundaryStart.x - polygonStart.x
  const qpy = boundaryStart.y - polygonStart.y
  const t = (qpx * sy - qpy * sx) / denominator
  const u = (qpx * ry - qpy * rx) / denominator
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null
  }

  const clampedT = Math.max(0, Math.min(1, t))
  const clampedU = Math.max(0, Math.min(1, u))
  return {
    point: normalizePoint({
      x: polygonStart.x + rx * clampedT,
      y: polygonStart.y + ry * clampedT
    }),
    polygonT: clampedT,
    boundaryT: clampedU
  }
}

const getPolylineClipIntersections = (
  polygon: Vec2[],
  boundary: Vec2[]
): SegmentIntersectionHit[] => {
  const hits: SegmentIntersectionHit[] = []
  const polygonBounds = getPolygonBounds(polygon)
  for (
    let polygonEdgeIndex = 0;
    polygonEdgeIndex < polygon.length;
    polygonEdgeIndex += 1
  ) {
    const polygonStart = polygon[polygonEdgeIndex]
    const polygonEnd = polygon[(polygonEdgeIndex + 1) % polygon.length]
    for (
      let boundaryEdgeIndex = 0;
      boundaryEdgeIndex < boundary.length - 1;
      boundaryEdgeIndex += 1
    ) {
      const boundaryStart = boundary[boundaryEdgeIndex]
      const boundaryEnd = boundary[boundaryEdgeIndex + 1]
      if (
        !segmentBoundsOverlapBounds(boundaryStart, boundaryEnd, polygonBounds)
      ) {
        continue
      }
      if (
        !segmentBoundsOverlapSegment(
          polygonStart,
          polygonEnd,
          boundaryStart,
          boundaryEnd
        )
      ) {
        continue
      }
      const hit = segmentIntersectionWithParams(
        polygonStart,
        polygonEnd,
        boundaryStart,
        boundaryEnd
      )
      if (!hit) {
        continue
      }
      if (
        hits.some(
          (existing) => distanceBetween(existing.point, hit.point) <= EPSILON
        )
      ) {
        continue
      }
      hits.push({
        point: hit.point,
        polygonEdgeIndex,
        polygonT: hit.polygonT,
        boundaryEdgeIndex,
        boundaryT: hit.boundaryT,
        polygonPosition: polygonEdgeIndex + hit.polygonT,
        boundaryPosition: boundaryEdgeIndex + hit.boundaryT
      })
    }
  }

  return hits
}

const pushDedupePoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (!previous || distanceBetween(previous, point) > EPSILON) {
    points.push(point)
  }
}

const getPolygonPathBetweenHits = (
  polygon: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
) => {
  const result: Vec2[] = []
  pushDedupePoint(result, from.point)

  let vertexIndex = (from.polygonEdgeIndex + 1) % polygon.length
  while (vertexIndex !== (to.polygonEdgeIndex + 1) % polygon.length) {
    pushDedupePoint(result, polygon[vertexIndex])
    vertexIndex = (vertexIndex + 1) % polygon.length
  }

  pushDedupePoint(result, to.point)
  return result
}

const getBoundaryPathBetweenHits = (
  boundary: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
): Vec2[] => {
  if (from.boundaryPosition <= to.boundaryPosition) {
    const result: Vec2[] = []
    pushDedupePoint(result, from.point)
    for (
      let vertexIndex = from.boundaryEdgeIndex + 1;
      vertexIndex <= to.boundaryEdgeIndex;
      vertexIndex += 1
    ) {
      pushDedupePoint(result, boundary[vertexIndex])
    }
    pushDedupePoint(result, to.point)
    return result
  }

  return getBoundaryPathBetweenHits(boundary, to, from).reverse()
}

const getSelectedSideViolationScore = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  let score = 0
  for (const point of polygon) {
    let nearestCross = 0
    let nearestDistanceSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegmentSquared = pointSegmentDistanceSquared(
        point,
        start,
        end
      )
      if (distanceToSegmentSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceToSegmentSquared
        nearestCross = cross
      }
    }
    const violation = selectedSide > 0 ? -nearestCross : nearestCross
    if (violation > EPSILON) {
      score += violation
    }
  }
  return score
}

const isFullyOnRejectedSideOfBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return false
  }

  return polygon.every((point) => {
    let nearestCross = 0
    let nearestDistanceSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegmentSquared = pointSegmentDistanceSquared(
        point,
        start,
        end
      )
      if (distanceToSegmentSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceToSegmentSquared
        nearestCross = cross
      }
    }

    return selectedSide > 0 ? nearestCross < -EPSILON : nearestCross > EPSILON
  })
}

const isFullyOnSelectedSideOfBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return true
  }

  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y

    for (const point of polygon) {
      const cross = dx * (point.y - start.y) - dy * (point.x - start.x)
      if (selectedSide > 0 ? cross < -EPSILON : cross > EPSILON) {
        return false
      }
    }
  }

  return true
}

const clipPolygonToSelectedSidePolylineIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return null
  }

  const hits = getPolylineClipIntersections(polygon, boundary).sort(
    (left, right) => left.boundaryPosition - right.boundaryPosition
  )
  if (hits.length < 2) {
    return null
  }

  const first = hits[0]
  const last = hits[hits.length - 1]
  const candidates = [
    cleanPolygon([
      ...getPolygonPathBetweenHits(polygon, first, last),
      ...getBoundaryPathBetweenHits(boundary, last, first).slice(1)
    ]),
    cleanPolygon([
      ...getPolygonPathBetweenHits(polygon, last, first),
      ...getBoundaryPathBetweenHits(boundary, first, last).slice(1)
    ])
  ].filter((candidate) => candidate.length >= 3)

  if (candidates.length === 0) {
    return null
  }

  return candidates.sort((left, right) => {
    const scoreDelta =
      getSelectedSideViolationScore(left, boundary, selectedSide) -
      getSelectedSideViolationScore(right, boundary, selectedSide)
    if (Math.abs(scoreDelta) > EPSILON) {
      return scoreDelta
    }
    return Math.abs(polygonArea(left)) - Math.abs(polygonArea(right))
  })[0]
}

const getBoundaryHead = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[0]]
  let length = 0
  for (let index = 1; index < boundary.length; index += 1) {
    const previous = boundary[index - 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPSILON) {
      break
    }
  }
  return result
}

const getBoundaryTail = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[boundary.length - 1]]
  let length = 0
  for (let index = boundary.length - 2; index >= 0; index -= 1) {
    const previous = boundary[index + 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPSILON) {
      break
    }
  }
  return result.reverse()
}

const getSourceSegmentBoundaryClipData = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  segmentIndex: number,
  reach: number,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentBoundaryClipData => {
  const boundary = getSourceSegmentBoundary(path, segmentIndex, slicingContext)
  if (!slicingContext) {
    const head = getBoundaryHead(boundary, reach)
    const tail = getBoundaryTail(boundary, reach)
    return {
      boundary,
      head,
      tail,
      headReference: head[head.length - 1] ?? boundary[0],
      tailReference: tail[0] ?? boundary[boundary.length - 1]
    }
  }

  const cacheKey = `${segmentIndex}:${reach.toFixed(6)}`
  const cached = slicingContext.segmentBoundaryClipCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const head = getBoundaryHead(boundary, reach)
  const tail = getBoundaryTail(boundary, reach)
  const data = {
    boundary,
    head,
    tail,
    headReference: head[head.length - 1] ?? boundary[0],
    tailReference: tail[0] ?? boundary[boundary.length - 1]
  }
  slicingContext.segmentBoundaryClipCache.set(cacheKey, data)
  return data
}

const getSelectedSideTowardPoint = (
  boundary: Vec2[],
  point: Vec2 | undefined,
  fallback: 1 | -1
): 1 | -1 => {
  if (!point || boundary.length < 2) {
    return fallback
  }

  let nearestCross = 0
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    const distanceToSegmentSquared = pointSegmentDistanceSquared(
      point,
      start,
      end
    )
    if (distanceToSegmentSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceToSegmentSquared
      nearestCross = cross
    }
  }

  if (Math.abs(nearestCross) <= EPSILON) {
    return fallback
  }
  return nearestCross > 0 ? 1 : -1
}

const clipPolygonToSelectedSideIfCrossing = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1,
  activationStart = segmentStart,
  activationEnd = segmentEnd
) => {
  if (
    polygon.length < 3 ||
    !segmentBoundsOverlapPolygon(activationStart, activationEnd, polygon)
  ) {
    return polygon
  }

  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  let hasInside = false
  let hasOutside = false

  for (const point of polygon) {
    const cross =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    const inside = selectedSide > 0 ? cross >= -EPSILON : cross <= EPSILON
    hasInside ||= inside
    hasOutside ||= !inside
    if (hasInside && hasOutside) {
      return clipPolygonToSelectedSideOfSegment(
        polygon,
        segmentStart,
        segmentEnd,
        selectedSide
      )
    }
  }

  return polygon
}

const clipPolygonToSelectedSideBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)) {
    return polygon
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }
  return currentPolygon
}

const clipPolygonToSelectedSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (
    !boundsOverlapBounds(
      getPolygonBounds(polygon),
      getCachedPolylineBounds(boundary)
    )
  ) {
    return polygon
  }
  if (isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)) {
    return polygon
  }

  const polylineClipped = clipPolygonToSelectedSidePolylineIfCrossing(
    polygon,
    boundary,
    selectedSide
  )
  if (polylineClipped) {
    return polylineClipped
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideIfCrossing(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }
  return currentPolygon
}

const clipPolygonToDominantSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[]
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (
    !boundsOverlapBounds(
      getPolygonBounds(polygon),
      getCachedPolylineBounds(boundary)
    )
  ) {
    return polygon
  }

  const positiveSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    1
  )
  const negativeSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    -1
  )
  const dominantSide: 1 | -1 =
    positiveSideViolationScore <= negativeSideViolationScore ? 1 : -1

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    dominantSide
  )
  if (clipped.length < 3 || isSimpleClosedPolygon(clipped)) {
    return clipped
  }

  const strictClipped = clipPolygonToSelectedSideBoundary(
    polygon,
    boundary,
    dominantSide
  )
  return strictClipped.length >= 3 &&
    (isSimpleClosedPolygon(strictClipped) ||
      Math.abs(polygonArea(strictClipped)) < Math.abs(polygonArea(clipped)))
    ? strictClipped
    : clipped
}

const _clipPolygonToSelectedSideBoundaryOrDropRejected = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    selectedSide
  )
  if (
    clipped.length >= 3 &&
    getSelectedSideViolationScore(clipped, boundary, selectedSide) <= EPSILON
  ) {
    return clipped
  }

  const strictClipped = clipPolygonToSelectedSideBoundary(
    clipped,
    boundary,
    selectedSide
  )
  if (
    strictClipped.length >= 3 &&
    getSelectedSideViolationScore(strictClipped, boundary, selectedSide) <=
      EPSILON
  ) {
    return strictClipped
  }

  return isFullyOnRejectedSideOfBoundary(clipped, boundary, selectedSide)
    ? []
    : clipped
}

const applyClosedIntervalSelectedSideGuards = (
  polygons: Vec2[][],
  closed: boolean,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  sharpGuardVertices: SharpGuardVertex[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  totalLength: number,
  authoredStroke: Pick<RenderableStroke, 'position' | 'dashPattern' | 'join'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  if (
    !closed ||
    polygons.length === 0 ||
    authoredStroke.position !== 'inside' ||
    sharpGuardVertices.length === 0
  ) {
    return polygons
  }

  const guardVertices = getIntervalGuardVertices(
    sharpGuardVertices,
    segmentRanges,
    interval,
    totalLength
  )

  const selectedSide = intervalStroke.position === 'inside' ? 1 : -1
  const crossingGuardReach = Math.max(
    intervalStroke.width * 2,
    authoredStroke.dashPattern[0] ?? intervalStroke.width
  )
  const clippedPolygons: Vec2[][] = []

  for (const polygon of polygons) {
    let currentPolygon = polygon

    if (guardVertices.length > 0) {
      for (const guard of guardVertices) {
        if (currentPolygon.length < 3) {
          break
        }

        const startsAtGuard = isIntervalStartAtGuard(
          interval,
          guard,
          totalLength
        )
        const endsAtGuard = isIntervalEndAtGuard(interval, guard, totalLength)
        const spansAcrossGuard = !startsAtGuard && !endsAtGuard

        if (startsAtGuard || spansAcrossGuard) {
          currentPolygon = clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getBoundaryTail(guard.previousBoundary, crossingGuardReach),
            selectedSide
          )
        }
        if (currentPolygon.length < 3) {
          break
        }
        if (endsAtGuard || spansAcrossGuard) {
          currentPolygon = clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getBoundaryHead(guard.nextBoundary, crossingGuardReach),
            selectedSide
          )
        }
        if (currentPolygon.length < 3) {
          break
        }
      }
    }

    for (const guard of sharpGuardVertices) {
      if (currentPolygon.length < 3) {
        break
      }

      if (guardVertices.includes(guard)) {
        continue
      }

      const startsAtGuard = isIntervalStartAtGuard(interval, guard, totalLength)
      const endsAtGuard = isIntervalEndAtGuard(interval, guard, totalLength)

      if (!endsAtGuard) {
        currentPolygon = clipPolygonToSelectedSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryTail(guard.previousBoundary, crossingGuardReach),
          selectedSide
        )
      }
      if (currentPolygon.length < 3) {
        break
      }
      if (!startsAtGuard) {
        currentPolygon = clipPolygonToSelectedSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryHead(guard.nextBoundary, crossingGuardReach),
          selectedSide
        )
      }
    }

    if (currentPolygon.length >= 3) {
      clippedPolygons.push(currentPolygon)
    }
  }

  return clippedPolygons
}

export const buildConstrainedDashedStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedDashedStrokeOptions = {}
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
  const totalLength = topology.totalLength
  const ownerPrefix =
    options.metadata?.ownerKeyPrefix ?? 'anonymous-constrained-dashed-source'
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const legalDomainId =
    options.metadata?.legalDomainId ?? primaryContour?.legalDomainId
  const sourceTopology = classifyConstrainedDashedSource(
    topologyPoints,
    topology.closed,
    topology
  )
  const constrainedDashedVisualMode =
    options.constrainedDashedVisualMode ??
    (options.visualOnly ? 'product-final' : 'debug-raw')
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  const sourcePaintBounds = getBounds([topologyPoints])
  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const sourcePath = options.sourcePath

    const sharpGuardVertices =
      topology.closed &&
      sourceTopology !== 'degenerate' &&
      (sourcePath ||
        (options.selectedSideGuardPoints &&
          options.selectedSideGuardPoints.length !== topologyPoints.length))
        ? buildSharpGuardVertices(
            topologyPoints,
            segmentRanges,
            options.selectedSideGuardPoints,
            sourcePath,
            !sourcePath
          )
        : []
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath,
      implicitFillRegions: options.implicitFillRegions,
      sharedSourceSplitRanges: options.sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
    })
    const allocatedVisibleIntervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      strokeDomainPlan
    )
    const visibleIntervals =
      replaceOutsideSmoothSourceVertexContinuityIntervals(
        allocatedVisibleIntervals,
        sourcePath,
        {
          position: stroke.position,
          width: stroke.width
        }
      )
    const sourceSpanProvenance =
      resolveSourceSpanProvenanceAvailability(options)
    const sourceSpanGraph = sourceSpanProvenance.available
      ? buildSourceSpanGraph(topology, visibleIntervals)
      : null
    const intervalSignature = sourceSpanProvenance.available
      ? buildVisibleIntervalSignature(visibleIntervals)
      : ''

    if (visibleIntervals.length === 0) {
      return []
    }

    const intervalStroke = getIntervalStrokeForSourceDirection(
      topologyPoints,
      topology.closed,
      stroke,
      topology.topologyFamily
    )
    const baseRevisionSet = options.visualOnly
      ? undefined
      : buildStrokeRuntimeRevisionSet({
          points: topologyPoints,
          closed: topology.closed,
          stroke,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: 'candidate',
          runtimeStatus: 'candidate',
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          intervalSignature,
          sourceTopology,
          intervalTopology: 'base'
        })
    const revisionSetByClassification = new Map<
      string,
      SolidCenterStrokeGeometryDebugMeta['revisionSet']
    >()
    const getRevisionSet = (
      classification: Pick<
        ConstrainedDashedIntervalClassification,
        'sourceTopology' | 'intervalTopology'
      >
    ) => {
      if (!baseRevisionSet) {
        return undefined
      }
      const revisionKey = [
        classification.sourceTopology,
        classification.intervalTopology
      ].join(':')
      const existing = revisionSetByClassification.get(revisionKey)
      if (existing) {
        return existing
      }

      const revisionSet = updateStrokeRuntimeRevisionSetFromMetadata(
        baseRevisionSet,
        {
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'candidate',
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          sourceTopology: classification.sourceTopology,
          intervalTopology: classification.intervalTopology,
          closed: topology.closed
        }
      )
      revisionSetByClassification.set(revisionKey, revisionSet)
      return revisionSet
    }

    const [fullLoopInterval] =
      visibleIntervals.length === 1 ? visibleIntervals : []

    if (
      topology.closed &&
      fullLoopInterval &&
      isFullLoopVisibleInterval(
        fullLoopInterval.startDistance,
        fullLoopInterval.endDistance,
        totalLength,
        fullLoopInterval.wrapsSeam
      )
    ) {
      const classification = classifyConstrainedDashedIntervalWithContext(
        topologyPoints,
        topology.closed,
        {
          startDistance: fullLoopInterval.startDistance,
          endDistance: fullLoopInterval.endDistance,
          totalLength,
          wrapsSeam: fullLoopInterval.wrapsSeam
        },
        stroke,
        sourceTopology,
        segmentRanges
      )

      const solidStroke = {
        ...stroke,
        style: 'solid' as const,
        cap: 'butt' as const
      }
      const candidatePolygons = buildExactArrangementCandidatePolygons(
        topologyPoints,
        true,
        solidStroke,
        sourcePath,
        options.selectedSideGuardPoints,
        topology.fillRule
      )
      const candidateFacePolygons = candidatePolygons.map(
        (candidate) => candidate.polygon
      )
      const polygons =
        stroke.position === 'inside'
          ? clampPolygonPointsToBounds(
              candidateFacePolygons,
              getBounds([topologyPoints])
            )
          : candidateFacePolygons

      if (polygons.length === 0) {
        return []
      }

      const intervalSourceSpanIds =
        options.metadata?.sourceSpanIds ??
        (sourceSpanGraph
          ? getSourceSpanIdsForInterval(sourceSpanGraph, fullLoopInterval)
          : [])

      return polygons.map((polygon, candidateIndex) => {
        const candidateRecord = candidatePolygons[candidateIndex]
        const geometryId = `${cachePrefix}:${strokeIndex}:${fullLoopInterval.intervalId}:candidate:${candidateIndex}`
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          contourId,
          legalDomainId,
          intervalId: fullLoopInterval.intervalId,
          strokePosition: stroke.position,
          ownerSet: options.metadata?.ownerSet,
          sourceContourIds: options.metadata?.sourceContourIds,
          legalDomainIds: options.metadata?.legalDomainIds,
          sourceSpanIds:
            candidateRecord?.sourceSpanIds ?? intervalSourceSpanIds,
          authoredVisibleIntervalIndex:
            candidateRecord?.sourceSegmentIndex ??
            candidateRecord?.sourceVertexIndex ??
            fullLoopInterval.authoredIndex,
          startDistance: fullLoopInterval.startDistance,
          endDistance: fullLoopInterval.endDistance,
          wrapsSeam: fullLoopInterval.wrapsSeam,
          previousVisibleIntervalId: fullLoopInterval.previousVisibleIntervalId,
          nextVisibleIntervalId: fullLoopInterval.nextVisibleIntervalId,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'candidate',
          sourceTopology: classification.sourceTopology,
          topologyFamily: topology.topologyFamily,
          intervalTopology: classification.intervalTopology,
          paintBounds: sourcePaintBounds,
          revisionSet: getRevisionSet(classification)
        }

        return {
          geometry: {
            geometryId,
            polygons: [polygon],
            bounds: getBounds([polygon]),
            debugMeta
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
      })
    }

    const sourcePathSlicingContext = sourcePath
      ? createSourcePathSlicingContext(sourcePath)
      : undefined
    const sourcePathSampledSimpleClassification =
      !options.visualOnly &&
      sourcePath &&
      sourceTopology === 'sampled-simple-closed'
        ? classifySourcePathSampledSimpleDashedInterval(sourceTopology)
        : null
    const usesExactInsideSourcePathStroke =
      sourcePath && stroke.position === 'inside' && sourcePath.closed === true
    const closedIntervalLegalityContext = usesExactInsideSourcePathStroke
      ? null
      : buildClosedIntervalLegalityContext(
          topologyPoints,
          topology.closed,
          stroke
        )
    const intervalPointSlicer = sourcePath
      ? null
      : createStrokeIntervalPointSlicer(topologyPoints, topology.closed)
    const canSkipInteriorSourcePathBoundaryClipping =
      options.visualOnly === true
    const canUseProductFinalIntervalClassification =
      constrainedDashedVisualMode === 'product-final' &&
      sourcePath &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      sourcePath.closed === true &&
      sourceTopology === 'self-intersecting'
    const productFinalIntervalClassification: ConstrainedDashedIntervalClassification | null =
      canUseProductFinalIntervalClassification
        ? {
            sourceTopology,
            intervalTopology: 'other',
            acceptsFullLoopRoundJoin: true,
            acceptsSingleEdgeRoundCap: true,
            acceptsCornerSpanningJoin: true
          }
        : null
    const sourceVertexBoundaryJoinRecords =
      productFinalIntervalClassification !== null &&
      sourcePath &&
      options.visualOnly !== true
        ? buildOutsideSourceVertexBoundaryJoinRecords(
            sourcePath,
            visibleIntervals,
            {
              position: intervalStroke.position,
              width: intervalStroke.width,
              join: stroke.join,
              miterLimit: stroke.miterLimit
            }
          )
        : []
    const sourceVertexBoundaryJoinVertexIndexes = new Set(
      sourceVertexBoundaryJoinRecords.map(
        (joinRecord) => joinRecord.vertexIndex
      )
    )
    const visibleIntervalById = new Map(
      visibleIntervals.map((interval) => [interval.intervalId, interval])
    )
    const visibleIntervalIndexById = new Map(
      visibleIntervals.map((interval, index) => [interval.intervalId, index])
    )
    const intervalHasStartTerminal = (
      interval: VisibleDashedTopologyInterval
    ) =>
      interval.figmaLikeTerminalRole === 'start' ||
      interval.figmaLikeTerminalRole === 'start-end'
    const intervalHasEndTerminal = (interval: VisibleDashedTopologyInterval) =>
      interval.figmaLikeTerminalRole === 'end' ||
      interval.figmaLikeTerminalRole === 'start-end'

    const getBoundaryTerminalGroupKey = (
      interval: VisibleDashedTopologyInterval,
      terminal: 'start' | 'end'
    ) => {
      const terminalPoint = getBoundaryDomainTerminalPoint(interval, terminal)
      if (!terminalPoint || interval.figmaLikeSelectedSide === undefined) {
        return null
      }

      return [
        interval.figmaLikeSelectedSide,
        interval.figmaLikeBoundaryRole ?? 'unknown',
        getBoundaryDomainTerminalKey(terminalPoint.endpoint)
      ].join('|')
    }

    const coincidentBoundaryTerminalIntervals = new Map<
      string,
      VisibleDashedTopologyInterval[]
    >()
    const pushCoincidentBoundaryTerminalInterval = (
      interval: VisibleDashedTopologyInterval,
      terminal: 'start' | 'end'
    ) => {
      const key = getBoundaryTerminalGroupKey(interval, terminal)
      if (!key) {
        return
      }
      const group = coincidentBoundaryTerminalIntervals.get(key) ?? []
      group.push(interval)
      coincidentBoundaryTerminalIntervals.set(key, group)
    }

    visibleIntervals.forEach((interval) => {
      if (intervalHasStartTerminal(interval)) {
        pushCoincidentBoundaryTerminalInterval(interval, 'start')
      }
      if (intervalHasEndTerminal(interval)) {
        pushCoincidentBoundaryTerminalInterval(interval, 'end')
      }
    })

    const buildFigmaLikeSplitRangeTerminalRecords = (
      interval: VisibleDashedTopologyInterval
    ) => {
      const terminals: NonNullable<
        SolidCenterStrokeGeometryDebugMeta['figmaLikeSplitRangeTerminals']
      > = []
      const seenTerminalKeys = new Set<string>()
      const pushTerminal = (terminal: VisibleDashedTopologyInterval) => {
        if (
          !terminal.figmaLikeSplitRangeId ||
          terminal.figmaLikeSplitRangeStartDistance === undefined ||
          terminal.figmaLikeSplitRangeEndDistance === undefined ||
          !terminal.figmaLikeTerminalRole
        ) {
          return
        }
        const key = [
          terminal.intervalId,
          terminal.figmaLikeSplitRangeId,
          terminal.figmaLikeTerminalRole,
          terminal.startDistance,
          terminal.endDistance
        ].join('|')
        if (seenTerminalKeys.has(key)) {
          return
        }
        seenTerminalKeys.add(key)
        terminals.push({
          intervalId: terminal.intervalId,
          boundaryDomainId: terminal.figmaLikeBoundaryDomainId,
          boundaryPoints: terminal.figmaLikeBoundaryPoints
            ? terminal.figmaLikeBoundaryPoints.map((point) => ({ ...point }))
            : undefined,
          boundaryStartDistance: terminal.figmaLikeBoundaryStartDistance,
          boundaryEndDistance: terminal.figmaLikeBoundaryEndDistance,
          boundaryTotalLength: terminal.figmaLikeBoundaryTotalLength,
          splitRangeId: terminal.figmaLikeSplitRangeId,
          splitRangeStartDistance: terminal.figmaLikeSplitRangeStartDistance,
          splitRangeEndDistance: terminal.figmaLikeSplitRangeEndDistance,
          terminalRole: terminal.figmaLikeTerminalRole,
          startDistance: terminal.startDistance,
          endDistance: terminal.endDistance,
          sourceSegmentIndex: terminal.figmaLikeSplitRangeSourceSegmentIndex,
          selectedSide: terminal.figmaLikeSelectedSide,
          filledSide: terminal.figmaLikeFilledSide,
          unfilledSide: terminal.figmaLikeUnfilledSide,
          boundaryRole: terminal.figmaLikeBoundaryRole
        })
      }

      pushTerminal(interval)

      if (intervalHasStartTerminal(interval)) {
        const key = getBoundaryTerminalGroupKey(interval, 'start')
        if (key) {
          coincidentBoundaryTerminalIntervals
            .get(key)
            ?.forEach((terminal) => pushTerminal(terminal))
        }
      }

      if (intervalHasEndTerminal(interval)) {
        const key = getBoundaryTerminalGroupKey(interval, 'end')
        if (key) {
          coincidentBoundaryTerminalIntervals
            .get(key)
            ?.forEach((terminal) => pushTerminal(terminal))
        }
      }

      const intervalIndex = visibleIntervalIndexById.get(interval.intervalId)
      const previousInterval =
        interval.previousVisibleIntervalId &&
        visibleIntervalById.get(interval.previousVisibleIntervalId)
          ? visibleIntervalById.get(interval.previousVisibleIntervalId)
          : intervalIndex !== undefined && intervalIndex > 0
            ? visibleIntervals[intervalIndex - 1]
            : undefined
      if (
        previousInterval &&
        intervalHasStartTerminal(interval) &&
        intervalHasEndTerminal(previousInterval) &&
        areLoopDistancesEqual(
          previousInterval.endDistance,
          interval.startDistance,
          totalLength
        )
      ) {
        pushTerminal(previousInterval)
      }

      const nextInterval =
        interval.nextVisibleIntervalId &&
        visibleIntervalById.get(interval.nextVisibleIntervalId)
          ? visibleIntervalById.get(interval.nextVisibleIntervalId)
          : intervalIndex !== undefined &&
              intervalIndex < visibleIntervals.length - 1
            ? visibleIntervals[intervalIndex + 1]
            : undefined
      if (
        nextInterval &&
        intervalHasEndTerminal(interval) &&
        intervalHasStartTerminal(nextInterval) &&
        areLoopDistancesEqual(
          nextInterval.startDistance,
          interval.endDistance,
          totalLength
        )
      ) {
        pushTerminal(nextInterval)
      }

      return terminals.length > 0 ? terminals : undefined
    }

    const intervalPackets = visibleIntervals.flatMap((interval) => {
      const boundaryDomainPath = buildBoundaryDomainPathForInterval(interval)
      const boundaryDomainClassification: ConstrainedDashedIntervalClassification | null =
        boundaryDomainPath
          ? {
              sourceTopology: 'self-intersecting',
              intervalTopology: 'other',
              acceptsFullLoopRoundJoin: false,
              acceptsSingleEdgeRoundCap: false,
              acceptsCornerSpanningJoin: false
            }
          : null
      const classification = options.visualOnly
        ? null
        : (boundaryDomainClassification ??
          productFinalIntervalClassification ??
          sourcePathSampledSimpleClassification ??
          (sourcePath && sourceTopology === 'sampled-simple-closed'
            ? classifySourcePathSampledSimpleDashedInterval(sourceTopology)
            : classifyConstrainedDashedIntervalWithContext(
                topologyPoints,
                topology.closed,
                {
                  startDistance: interval.startDistance,
                  endDistance: interval.endDistance,
                  totalLength,
                  wrapsSeam: interval.wrapsSeam
                },
                stroke,
                sourceTopology,
                segmentRanges
              )))

      if (
        classification &&
        !isSupportedConstrainedDashedInterval(classification, stroke)
      ) {
        return []
      }

      const effectiveSourcePath = boundaryDomainPath ?? sourcePath
      const effectiveSourcePathSlicingContext = boundaryDomainPath
        ? createSourcePathSlicingContext(boundaryDomainPath)
        : sourcePathSlicingContext
      const effectiveTopologyForInterval = boundaryDomainPath
        ? {
            ...topology,
            totalLength: boundaryDomainPath.totalLength,
            closed: boundaryDomainPath.closed
          }
        : topology
      const physicalSpans = getIntervalPhysicalSpans(
        effectiveTopologyForInterval,
        stroke,
        interval
      )
      const squareCapPhysicalStroke =
        stroke.cap === 'square'
          ? {
              ...intervalStroke,
              cap: 'butt' as const
            }
          : intervalStroke
      let finalCoverageBuilderStatus:
        | SolidCenterStrokeGeometryDebugMeta['finalCoverageBuilderStatus']
        | undefined
      let intervalSweepSpanCount: number | undefined
      let terminalCapCount: number | undefined
      const shouldCollectIntervalSweepMetadata =
        options.omitDiagnosticMetadata !== true
      const intervalPolygons = sourcePath
        ? (() => {
            if (!effectiveSourcePath || !effectiveSourcePathSlicingContext) {
              return []
            }
            const resolvedEffectiveSourcePath = effectiveSourcePath
            const resolvedEffectiveSourcePathSlicingContext =
              effectiveSourcePathSlicingContext
            const useProductFinalSourcePath =
              constrainedDashedVisualMode === 'product-final' &&
              (stroke.position === 'inside' || stroke.position === 'outside') &&
              resolvedEffectiveSourcePathSlicingContext
            const intervalSweep = buildDashedSourcePathIntervalSweep(
              resolvedEffectiveSourcePath,
              physicalSpans,
              interval,
              stroke,
              squareCapPhysicalStroke,
              resolvedEffectiveSourcePathSlicingContext,
              { preserveDomainContinuity: boundaryDomainPath !== null }
            )
            intervalSweepSpanCount = shouldCollectIntervalSweepMetadata
              ? intervalSweep.ranges.length
              : undefined
            terminalCapCount =
              squareCapPhysicalStroke.cap === 'round'
                ? 2
                : shouldCollectIntervalSweepMetadata
                  ? countTerminalCapsInIntervalSweep(intervalSweep)
                  : undefined
            if (terminalCapCount !== undefined && terminalCapCount > 0) {
              emitStrokePipelineCounter(
                'terminal-cap-build-count',
                terminalCapCount
              )
            }
            if (useProductFinalSourcePath) {
              finalCoverageBuilderStatus = 'product-final'
              const productFinalPolygons =
                buildDashedSourcePathFinalCoveragePolygons(
                  resolvedEffectiveSourcePath,
                  effectiveTopologyForInterval,
                  intervalSweep,
                  interval,
                  stroke,
                  intervalStroke,
                  sharpGuardVertices,
                  resolvedEffectiveSourcePathSlicingContext,
                  strokeDomainPlan,
                  options.clipInsideToFillDomain === true,
                  options.implicitFillRegions ?? []
                )
              if (
                productFinalPolygons.length > 0 ||
                !boundaryDomainPath ||
                interval.figmaLikeSideResolutionStatus !== 'resolved' ||
                interval.figmaLikeSelectedSide === undefined
              ) {
                return productFinalPolygons
              }

              const resolvedBoundaryIntervalStroke = {
                position:
                  interval.figmaLikeSelectedSide > 0
                    ? ('inside' as const)
                    : ('outside' as const),
                width: intervalStroke.width
              }
              return intervalSweep.ranges.flatMap(
                ({ renderRange, span, capOwnership }) =>
                  buildConstrainedDashedLocalSideStrokePolygons(
                    sliceSourcePathRangePoints(
                      resolvedEffectiveSourcePath,
                      renderRange,
                      span.role,
                      resolvedEffectiveSourcePathSlicingContext
                    ),
                    false,
                    {
                      ...capOwnership.stroke,
                      position: resolvedBoundaryIntervalStroke.position,
                      width: resolvedBoundaryIntervalStroke.width
                    },
                    {
                      assumeSimpleOpen: true,
                      assumeSimpleClosed: undefined,
                      assumeNormalizedOpen: true,
                      roundCapStart: capOwnership.roundCapStart,
                      roundCapEnd: capOwnership.roundCapEnd
                    }
                  )
              )
            }
            finalCoverageBuilderStatus = 'debug-raw'

            const useExactInsideSourcePath =
              stroke.position === 'inside' && sourcePath.closed === true
            const rangePolygons = intervalSweep.ranges.flatMap(
              ({ range, span, renderRange, capOwnership }) => {
                if (useExactInsideSourcePath) {
                  const exactSourcePathSlicingContext = sourcePathSlicingContext
                  if (!exactSourcePathSlicingContext) {
                    return []
                  }
                  const exactFrames = sliceExactRibbonRangeFrames(
                    sourcePath,
                    renderRange,
                    exactSourcePathSlicingContext
                  )
                  const sourceEdge = exactFrames.map((frame) => frame.point)
                  const exactIntervalStrokes = [intervalStroke]

                  const exactPolygons = exactIntervalStrokes.flatMap(
                    (currentIntervalStroke) => {
                      const currentCapStroke = {
                        ...capOwnership.stroke,
                        position: currentIntervalStroke.position
                      }
                      const shouldClipInsideBoundary =
                        shouldClipSourceSegmentRangeForInsideBoundary(
                          range,
                          exactSourcePathSlicingContext.segmentRanges[
                            range.segmentIndex
                          ],
                          sourcePath,
                          interval,
                          stroke,
                          currentIntervalStroke,
                          sharpGuardVertices
                        )
                      if (
                        canSkipInteriorSourcePathBoundaryClipping &&
                        !shouldClipInsideBoundary
                      ) {
                        return buildMergedExactSourcePathRibbonPolygonsFromFrames(
                          exactFrames,
                          currentCapStroke,
                          capOwnership.roundCapStart,
                          capOwnership.roundCapEnd
                        )
                      }
                      if (
                        currentCapStroke.cap === 'round' &&
                        (capOwnership.roundCapStart === true ||
                          capOwnership.roundCapEnd === true)
                      ) {
                        const mergedPolygons =
                          buildMergedExactSourcePathRibbonPolygonsFromFrames(
                            exactFrames,
                            currentCapStroke,
                            capOwnership.roundCapStart,
                            capOwnership.roundCapEnd
                          )
                        return clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                          mergedPolygons,
                          sourcePath,
                          range,
                          interval,
                          stroke,
                          currentIntervalStroke,
                          span.role,
                          sharpGuardVertices,
                          exactSourcePathSlicingContext,
                          {
                            assumeConstructedSimple: true,
                            skipSourceEdgeFallback: options.visualOnly === true,
                            sourceEdge
                          }
                        )
                      }
                      const { bodyPolygons, capPolygons } =
                        buildExactSourcePathRibbonGeometryFromFrames(
                          exactFrames,
                          currentCapStroke,
                          capOwnership.roundCapStart,
                          capOwnership.roundCapEnd
                        )
                      return [
                        ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                          bodyPolygons,
                          sourcePath,
                          range,
                          interval,
                          currentCapStroke.cap === 'round'
                            ? {
                                ...stroke,
                                cap: 'butt' as const
                              }
                            : stroke,
                          currentIntervalStroke,
                          span.role,
                          sharpGuardVertices,
                          exactSourcePathSlicingContext,
                          {
                            assumeConstructedSimple: true,
                            skipSourceEdgeFallback: options.visualOnly === true,
                            sourceEdge
                          }
                        ),
                        ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                          capPolygons,
                          sourcePath,
                          range,
                          interval,
                          stroke,
                          currentIntervalStroke,
                          span.role,
                          sharpGuardVertices,
                          exactSourcePathSlicingContext,
                          {
                            assumeConstructedSimple: true,
                            skipSourceEdgeFallback: options.visualOnly === true,
                            sourceEdge
                          }
                        )
                      ]
                    }
                  )

                  return exactPolygons
                }
                const sourcePathRibbonPolygons = buildSourcePathRibbonPolygons(
                  sourcePath,
                  renderRange,
                  span,
                  capOwnership.stroke,
                  capOwnership.roundCapStart,
                  capOwnership.roundCapEnd,
                  sourcePathSlicingContext
                )
                const rangePolygons =
                  sourcePathRibbonPolygons ??
                  (() => {
                    emitStrokePipelineCounter(
                      'generic-local-side-builder-fallback-count'
                    )
                    return buildConstrainedDashedLocalSideStrokePolygons(
                      sliceSourcePathRangePoints(
                        sourcePath,
                        renderRange,
                        span.role,
                        sourcePathSlicingContext
                      ),
                      false,
                      capOwnership.stroke,
                      {
                        assumeSimpleOpen: true,
                        assumeSimpleClosed: undefined,
                        assumeNormalizedOpen: true,
                        roundCapStart: capOwnership.roundCapStart,
                        roundCapEnd: capOwnership.roundCapEnd
                      }
                    )
                  })()
                return clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                  rangePolygons,
                  sourcePath,
                  range,
                  interval,
                  stroke,
                  intervalStroke,
                  span.role,
                  sharpGuardVertices,
                  sourcePathSlicingContext
                )
              }
            )
            return rangePolygons
          })()
        : (() => {
            const spanPolygons = physicalSpans.flatMap((span) =>
              buildConstrainedDashedLocalSideStrokePolygons(
                (
                  intervalPointSlicer ??
                  createStrokeIntervalPointSlicer(
                    topologyPoints,
                    topology.closed
                  )
                ).slice(span.startDistance, span.endDistance, span.wrapsSeam),
                false,
                squareCapPhysicalStroke,
                {
                  assumeSimpleOpen:
                    !topology.closed ||
                    topology.isSimpleClosed ||
                    topology.topologyFamily === 'self-intersecting'
                      ? true
                      : undefined,
                  assumeSimpleClosed: topology.closed
                    ? topology.isSimpleClosed
                    : undefined,
                  assumeNormalizedOpen: true
                }
              )
            )
            if (
              stroke.cap !== 'square' ||
              !topology.closed ||
              stroke.width <= EPSILON
            ) {
              return spanPolygons
            }

            if (stroke.position !== 'outside') {
              return spanPolygons
            }

            const fallbackSourcePath = buildPolylineGeometryModelPath(
              topologyPoints,
              topology.closed
            )
            return [
              ...spanPolygons,
              ...buildSourcePathIntervalJoinPolygons(
                fallbackSourcePath,
                physicalSpans,
                {
                  position: intervalStroke.position,
                  width: intervalStroke.width,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit
                }
              )
            ]
          })()
      const selectedSidePolygons = sourcePath
        ? intervalPolygons
        : applyClosedIntervalSelectedSideGuards(
            intervalPolygons,
            topology.closed,
            interval,
            sharpGuardVertices,
            segmentRanges,
            totalLength,
            stroke,
            intervalStroke
          )
      const usesExactInsideSourcePath =
        sourcePath && stroke.position === 'inside' && sourcePath.closed === true
      let polygons =
        topology.isSimpleClosed && !usesExactInsideSourcePath
          ? applyClosedIntervalLegality(
              selectedSidePolygons,
              closedIntervalLegalityContext
            )
          : selectedSidePolygons
      if (sourcePath && stroke.position === 'inside') {
        polygons = [
          ...polygons,
          ...buildSourcePathIntervalJoinPolygons(sourcePath, physicalSpans, {
            position: intervalStroke.position,
            width: intervalStroke.width,
            join: stroke.join,
            miterLimit: stroke.miterLimit
          })
        ]
      }
      if (
        sourcePath &&
        stroke.position === 'inside' &&
        options.clipInsideToFillDomain === true &&
        polygons.length > 0
      ) {
        polygons = clipSourcePathPolygonsToEvenOddLegalDomain(
          polygons,
          sourcePath,
          stroke,
          options.implicitFillRegions ?? [],
          {
            fragmentPruneArea: EPSILON * 10,
            cleanupMicroEdgeTolerance: 0.001,
            cleanupCollinearTolerance: 0.0001
          }
        )
      }
      if (sourcePath && stroke.position === 'outside') {
        const sourceVertexJoinPath = boundaryDomainPath ?? sourcePath
        const intervalSourceVertexJoinPolygons =
          sourceVertexBoundaryJoinVertexIndexes.size > 0
            ? []
            : buildSourcePathIntervalJoinPolygons(
                sourceVertexJoinPath,
                physicalSpans,
                {
                  position: intervalStroke.position,
                  width: intervalStroke.width,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit
                }
              )
        polygons = [...polygons, ...intervalSourceVertexJoinPolygons]
      }

      if (polygons.length === 0) {
        return []
      }

      const geometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
      const figmaLikeSplitRangeTerminals =
        buildFigmaLikeSplitRangeTerminalRecords(interval)
      if (options.visualOnly) {
        return [
          {
            geometry: {
              geometryId,
              polygons,
              bounds: EMPTY_STROKE_PACKET_BOUNDS
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
      }

      if (!classification) {
        return []
      }

      const resolutionStatus = getConstrainedDashedResolutionStatus(
        classification.sourceTopology,
        classification.intervalTopology,
        !topology.closed && !topology.isSimpleOpen
      )
      const debugMeta: SolidCenterStrokeGeometryDebugMeta =
        options.omitDiagnosticMetadata
          ? {
              sourcePathId: cachePrefix,
              ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${strokeIndex}`,
              strokeIndex,
              contourId,
              intervalId: interval.intervalId,
              strokePosition: stroke.position,
              ownerSet: options.metadata?.ownerSet,
              geometryFamily: 'constrained-dashed',
              resolutionStatus,
              runtimeStatus: 'candidate',
              sourceTopology: classification.sourceTopology,
              topologyFamily: topology.topologyFamily,
              intervalTopology: classification.intervalTopology,
              finalCoverageBuilderStatus,
              intervalSweepSpanCount,
              terminalCapCount,
              figmaLikeBoundaryDomainId: interval.figmaLikeBoundaryDomainId,
              figmaLikeBoundaryPoints: interval.figmaLikeBoundaryPoints
                ? interval.figmaLikeBoundaryPoints.map((point) => ({
                    ...point
                  }))
                : undefined,
              figmaLikeBoundaryStartDistance:
                interval.figmaLikeBoundaryStartDistance,
              figmaLikeBoundaryEndDistance:
                interval.figmaLikeBoundaryEndDistance,
              figmaLikeBoundaryTotalLength:
                interval.figmaLikeBoundaryTotalLength,
              figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
              figmaLikeSplitRangeStartDistance:
                interval.figmaLikeSplitRangeStartDistance,
              figmaLikeSplitRangeEndDistance:
                interval.figmaLikeSplitRangeEndDistance,
              figmaLikeTerminalRole: interval.figmaLikeTerminalRole,
              figmaLikeSplitRangeSourceSegmentIndex:
                interval.figmaLikeSplitRangeSourceSegmentIndex,
              figmaLikeSideAuthority: interval.figmaLikeSideAuthority,
              figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
              figmaLikeFilledSide: interval.figmaLikeFilledSide,
              figmaLikeUnfilledSide: interval.figmaLikeUnfilledSide,
              figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
              figmaLikeSideResolutionStatus:
                interval.figmaLikeSideResolutionStatus,
              figmaLikeSideResolutionReason:
                interval.figmaLikeSideResolutionReason,
              figmaLikeSplitRangeTerminals,
              paintBounds: sourcePaintBounds,
              revisionSet: getRevisionSet(classification)
            }
          : {
              sourcePathId: cachePrefix,
              ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${strokeIndex}`,
              strokeIndex,
              contourId,
              legalDomainId,
              intervalId: interval.intervalId,
              strokePosition: stroke.position,
              ownerSet: options.metadata?.ownerSet,
              sourceContourIds: options.metadata?.sourceContourIds,
              legalDomainIds: options.metadata?.legalDomainIds,
              sourceSpanIds:
                options.metadata?.sourceSpanIds ??
                (sourceSpanGraph
                  ? getSourceSpanIdsForInterval(sourceSpanGraph, interval)
                  : []),
              authoredVisibleIntervalIndex: interval.authoredIndex,
              startDistance: interval.startDistance,
              endDistance: interval.endDistance,
              wrapsSeam: interval.wrapsSeam,
              physicalSpanRanges: physicalSpans.map((span) => ({
                spanId: span.spanId,
                role: span.role,
                startDistance: span.startDistance,
                endDistance: span.endDistance,
                wrapsSeam: span.wrapsSeam
              })),
              physicalVisibleLength: physicalSpans.reduce(
                (total, span) => total + span.intervalLength,
                0
              ),
              previousVisibleIntervalId: interval.previousVisibleIntervalId,
              nextVisibleIntervalId: interval.nextVisibleIntervalId,
              figmaLikeBoundaryDomainId: interval.figmaLikeBoundaryDomainId,
              figmaLikeBoundaryPoints: interval.figmaLikeBoundaryPoints
                ? interval.figmaLikeBoundaryPoints.map((point) => ({
                    ...point
                  }))
                : undefined,
              figmaLikeBoundaryStartDistance:
                interval.figmaLikeBoundaryStartDistance,
              figmaLikeBoundaryEndDistance:
                interval.figmaLikeBoundaryEndDistance,
              figmaLikeBoundaryTotalLength:
                interval.figmaLikeBoundaryTotalLength,
              figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
              figmaLikeSplitRangeStartDistance:
                interval.figmaLikeSplitRangeStartDistance,
              figmaLikeSplitRangeEndDistance:
                interval.figmaLikeSplitRangeEndDistance,
              figmaLikeTerminalRole: interval.figmaLikeTerminalRole,
              figmaLikeSplitRangeSourceSegmentIndex:
                interval.figmaLikeSplitRangeSourceSegmentIndex,
              figmaLikeSideAuthority: interval.figmaLikeSideAuthority,
              figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
              figmaLikeFilledSide: interval.figmaLikeFilledSide,
              figmaLikeUnfilledSide: interval.figmaLikeUnfilledSide,
              figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
              figmaLikeSideResolutionStatus:
                interval.figmaLikeSideResolutionStatus,
              figmaLikeSideResolutionReason:
                interval.figmaLikeSideResolutionReason,
              figmaLikeSplitRangeTerminals,
              geometryFamily: 'constrained-dashed',
              resolutionStatus,
              runtimeStatus: 'candidate',
              sourceTopology: classification.sourceTopology,
              topologyFamily: topology.topologyFamily,
              intervalTopology: classification.intervalTopology,
              finalCoverageBuilderStatus,
              intervalSweepSpanCount,
              terminalCapCount,
              paintBounds: sourcePaintBounds,
              revisionSet: getRevisionSet(classification)
            }

      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta
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
    const sourceVertexJoinPackets =
      constrainedDashedVisualMode === 'product-final' &&
      options.visualOnly !== true &&
      productFinalIntervalClassification !== null &&
      sourcePath
        ? sourceVertexBoundaryJoinRecords.flatMap((joinRecord, joinIndex) => {
            const [previousInterval, nextInterval] = joinRecord.intervals
            const clippedPolygons =
              options.clipInsideToFillDomain === true &&
              options.implicitFillRegions &&
              options.implicitFillRegions.length > 0
                ? clipSourcePathPolygonsToEvenOddLegalDomain(
                    joinRecord.polygons,
                    sourcePath,
                    { position: stroke.position },
                    options.implicitFillRegions,
                    {
                      fragmentStitchRadius: 0,
                      fragmentPruneArea: Math.max(
                        1,
                        intervalStroke.width * intervalStroke.width * 0.1
                      )
                    }
                  )
                : joinRecord.polygons
            const polygons = normalizeConstrainedDashedProductVisualPolygons(
              clippedPolygons,
              { cleanClipResidue: true }
            )
            if (polygons.length === 0) {
              return []
            }

            const intervalIds = joinRecord.intervals.map(
              (interval) => interval.intervalId
            )
            const sourceSpanIds = [
              ...new Set(
                joinRecord.intervals.flatMap((interval) =>
                  sourceSpanGraph
                    ? getSourceSpanIdsForInterval(sourceSpanGraph, interval)
                    : []
                )
              )
            ]
            const geometryId = `${cachePrefix}:${strokeIndex}:source-vertex-join:${joinRecord.vertexIndex}:${joinIndex}`
            const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
              sourcePathId: cachePrefix,
              ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${strokeIndex}`,
              strokeIndex,
              contourId,
              legalDomainId,
              intervalId: previousInterval.intervalId,
              intervalIds,
              strokePosition: stroke.position,
              strokeWidth: intervalStroke.width,
              strokeJoin: stroke.join,
              strokeCap: stroke.cap,
              strokeMiterLimit: stroke.miterLimit,
              ownerSet: options.metadata?.ownerSet,
              sourceContourIds: options.metadata?.sourceContourIds,
              legalDomainIds: options.metadata?.legalDomainIds,
              sourceSpanIds,
              authoredVisibleIntervalIndex: previousInterval.authoredIndex,
              startDistance: previousInterval.startDistance,
              endDistance: nextInterval.endDistance,
              wrapsSeam: previousInterval.wrapsSeam || nextInterval.wrapsSeam,
              previousVisibleIntervalId:
                previousInterval.previousVisibleIntervalId,
              nextVisibleIntervalId: nextInterval.nextVisibleIntervalId,
              figmaLikeBoundaryDomainId:
                previousInterval.figmaLikeBoundaryDomainId,
              figmaLikeBoundaryPoints:
                previousInterval.figmaLikeBoundaryPoints?.map((point) => ({
                  ...point
                })),
              figmaLikeBoundaryStartDistance:
                previousInterval.figmaLikeBoundaryStartDistance,
              figmaLikeBoundaryEndDistance:
                nextInterval.figmaLikeBoundaryEndDistance,
              figmaLikeBoundaryTotalLength:
                previousInterval.figmaLikeBoundaryTotalLength,
              figmaLikeSplitRangeId: previousInterval.figmaLikeSplitRangeId,
              figmaLikeSplitRangeStartDistance:
                previousInterval.figmaLikeSplitRangeStartDistance,
              figmaLikeSplitRangeEndDistance:
                nextInterval.figmaLikeSplitRangeEndDistance,
              figmaLikeTerminalRole: 'middle',
              figmaLikeSplitRangeSourceSegmentIndex:
                previousInterval.figmaLikeSplitRangeSourceSegmentIndex,
              figmaLikeSideAuthority: previousInterval.figmaLikeSideAuthority,
              figmaLikeSelectedSide: previousInterval.figmaLikeSelectedSide,
              figmaLikeFilledSide: previousInterval.figmaLikeFilledSide,
              figmaLikeUnfilledSide: previousInterval.figmaLikeUnfilledSide,
              figmaLikeBoundaryRole: previousInterval.figmaLikeBoundaryRole,
              figmaLikeSideResolutionStatus:
                previousInterval.figmaLikeSideResolutionStatus,
              figmaLikeSideResolutionReason:
                previousInterval.figmaLikeSideResolutionReason,
              figmaLikeSplitRangeTerminals: [
                ...(buildFigmaLikeSplitRangeTerminalRecords(previousInterval) ??
                  []),
                ...(buildFigmaLikeSplitRangeTerminalRecords(nextInterval) ?? [])
              ],
              geometryFamily: 'constrained-dashed',
              resolutionStatus: getConstrainedDashedResolutionStatus(
                productFinalIntervalClassification.sourceTopology,
                productFinalIntervalClassification.intervalTopology
              ),
              runtimeStatus: 'candidate',
              sourceTopology: productFinalIntervalClassification.sourceTopology,
              topologyFamily: topology.topologyFamily,
              intervalTopology:
                productFinalIntervalClassification.intervalTopology,
              finalCoverageBuilderStatus: 'product-final',
              intervalSweepSpanCount: 0,
              terminalCapCount: 0,
              paintBounds: sourcePaintBounds,
              revisionSet: getRevisionSet(productFinalIntervalClassification)
            }

            return {
              geometry: {
                geometryId,
                polygons,
                bounds: getBounds(polygons),
                debugMeta
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
          })
        : []

    return [...intervalPackets, ...sourceVertexJoinPackets]
  })
}
