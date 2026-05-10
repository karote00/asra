import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import type { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import { createStrokeIntervalPointSlicer } from './stroke-interval-frames'
import {
  buildConstrainedDashedLocalSideStrokePolygons,
  buildSelfIntersectingClosedConstrainedDashedLocalSidePolygons
} from './constrained-dashed-local-side-geometry'
import {
  buildRoundStrokeArcPoints,
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import { buildStrokeRuntimeRevisionSet } from './stroke-dirty-keys'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
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
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval
} from './source-span-graph'
import type { StrokeOwnerKey } from './stroke-final-face'

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
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
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

type VisibleDashedTopologyInterval = DashedTopologyInterval & {
  kind: 'visible'
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

const getVisibleConstrainedDashedIntervals = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'>,
  stroke: Pick<RenderableStroke, 'cap' | 'dashPattern' | 'dashOffset' | 'width'>
): VisibleDashedTopologyInterval[] => {
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
  sourceTopology === 'self-intersecting' ||
  forceLocalSideApproximation ||
  (sourceTopology === 'sampled-simple-closed' &&
    intervalTopology !== 'full-loop')
    ? 'local-side-approximation'
    : 'exact-constrained'

const getIntervalStrokeForSourceDirection = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): Pick<
  RenderableStroke,
  'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
> => {
  if (!closed) {
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

interface SourceSegmentIntervalSpanRange {
  range: SourceSegmentIntervalRange
  span: ConstrainedDashedPhysicalSpan
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

const exactSourcePathRibbonFrameCache = new Map<
  string,
  ExactSourcePathRibbonFrame
>()

interface SourcePathSlicingContext {
  segmentRanges: SourcePathSegmentRange[]
  segmentSamples: SourcePathSegmentSample[]
  exactRibbonFrame: ExactSourcePathRibbonFrame
  splitRangeCache: Map<string, SourceSegmentIntervalRange[]>
  pointSliceCache: Map<string, Vec2[]>
  ribbonPolygonCache: Map<string, Vec2[][] | null>
  segmentBoundaryCache: Map<number, Vec2[]>
  samplingTolerance: number
  samplingOptions: PathSliceSamplingOptions
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

const buildExactSourcePathRibbonFrame = (
  path: Pick<PathGeometry, 'segments'>,
  segmentRanges: SourcePathSegmentRange[],
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): ExactSourcePathRibbonFrame => ({
  segmentFrames: segmentRanges.map((range) => {
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
  })
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
    exactSourcePathRibbonFrameCache.delete(cacheKey)
    exactSourcePathRibbonFrameCache.set(cacheKey, cached)
    return cached
  }

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
    segmentSamples: segmentRanges.map((range) =>
      buildSourcePathSegmentSample(
        path,
        range,
        samplingTolerance,
        samplingOptions
      )
    ),
    exactRibbonFrame: getExactSourcePathRibbonFrame(
      path,
      segmentRanges,
      SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
      SOURCE_PATH_RIBBON_FRAME_SAMPLING
    ),
    splitRangeCache: new Map(),
    pointSliceCache: new Map(),
    ribbonPolygonCache: new Map(),
    segmentBoundaryCache: new Map(),
    samplingTolerance,
    samplingOptions
  }
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
  const sample = slicingContext.segmentSamples[range.segmentIndex]
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
  return segmentRanges.flatMap((segment) => {
    const start = Math.max(startDistance, segment.startDistance)
    const end = Math.min(endDistance, segment.endDistance)
    return end - start > EPSILON
      ? [
          {
            startDistance: start,
            endDistance: end,
            segmentIndex: segment.index
          }
        ]
      : []
  })
}

const splitVisibleIntervalBySourceSegments = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
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
  path: Pick<PathGeometry, 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
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

  return {
    stroke:
      rangeOwnsStartCap || rangeOwnsEndCap
        ? stroke
        : {
            ...stroke,
            cap: 'butt' as const
          },
    roundCapStart: rangeOwnsStartCap,
    roundCapEnd: rangeOwnsEndCap
  }
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

  const bulgeDirection = isStart ? { x: -tangent.x, y: -tangent.y } : tangent
  const midPoint = {
    x: center.x + bulgeDirection.x * radius,
    y: center.y + bulgeDirection.y * radius
  }
  const startAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x)
  const midAngle = Math.atan2(midPoint.y - center.y, midPoint.x - center.x)
  const endAngle = Math.atan2(
    offsetEndpoint.y - center.y,
    offsetEndpoint.x - center.x
  )
  const normalizeAngleDelta = (value: number) => {
    let result = value
    while (result < 0) {
      result += Math.PI * 2
    }
    while (result >= Math.PI * 2) {
      result -= Math.PI * 2
    }
    return result
  }
  let sweep = endAngle - startAngle
  while (sweep <= -Math.PI) {
    sweep += Math.PI * 2
  }
  while (sweep > Math.PI) {
    sweep -= Math.PI * 2
  }

  const positiveSweep = sweep < 0 ? sweep + Math.PI * 2 : sweep
  const midDelta = normalizeAngleDelta(midAngle - startAngle)
  const sweepViaMid =
    midDelta <= positiveSweep + EPSILON
      ? positiveSweep
      : positiveSweep - Math.PI * 2

  return buildRoundStrokeArcPoints(center, radius, startAngle, sweepViaMid, 3, {
    maxLength: 0.25
  }).map(normalizePoint)
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
  for (let index = 1; index < segmentFrame.frames.length; index += 1) {
    const previousDistance = segmentFrame.distances[index - 1]
    const nextDistance = segmentFrame.distances[index]
    if (clampedDistance > nextDistance + EPSILON) {
      continue
    }

    const amount =
      nextDistance - previousDistance > EPSILON
        ? (clampedDistance - previousDistance) /
          (nextDistance - previousDistance)
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

  return segmentFrame.frames[segmentFrame.frames.length - 1]
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
  for (let index = 1; index < segmentFrame.frames.length - 1; index += 1) {
    const distance = segmentFrame.distances[index]
    if (distance > start + EPSILON && distance < end - EPSILON) {
      frames.push(segmentFrame.frames[index])
    }
  }
  frames.push(endFrame)
  return dedupeRibbonFrames(frames)
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

const buildExactSourcePathRibbonPolygonsFromFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetBoundary = buildSourcePathRibbonOffsetBoundary(
    source,
    getConstrainedRibbonOffsetDistance(stroke)
  )
  if (offsetBoundary.length !== source.length) {
    return []
  }
  const rawPolygon: Vec2[] = [...source, ...offsetBoundary.slice().reverse()]

  const polygon = cleanPolygon(rawPolygon)
  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= EPSILON) {
    return []
  }

  return [polygon]
}

const buildExactSourcePathRibbonPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  renderRange: SourceSegmentIntervalRange,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  slicingContext: SourcePathSlicingContext
) => {
  const frames = sliceExactRibbonRangeFrames(path, renderRange, slicingContext)
  const polygons = buildExactSourcePathRibbonPolygonsFromFrames(frames, stroke)
  return polygons.length > 0 ? polygons : null
}

const buildExactSourcePathRibbonRoundCapPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  renderRange: SourceSegmentIntervalRange,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  slicingContext: SourcePathSlicingContext
) => {
  if (
    stroke.cap !== 'round' ||
    (roundCapStart !== true && roundCapEnd !== true)
  ) {
    return []
  }

  const frames = sliceExactRibbonRangeFrames(path, renderRange, slicingContext)
  if (frames.length < 2) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetBoundary = buildSourcePathRibbonOffsetBoundary(
    source,
    getConstrainedRibbonOffsetDistance(stroke)
  )
  if (offsetBoundary.length !== source.length) {
    return []
  }
  return [
    ...(roundCapStart === true
      ? [
          cleanPolygon(
            buildOneSidedRibbonRoundCap(
              source[0],
              offsetBoundary[0],
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
              offsetBoundary[offsetBoundary.length - 1],
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

const areSourceRangesAdjacent = (
  current: SourceSegmentIntervalRange,
  next: SourceSegmentIntervalRange,
  totalLength: number
) => {
  if (Math.abs(current.endDistance - next.startDistance) <= EPSILON) {
    return true
  }

  return (
    Math.abs(current.endDistance - totalLength) <= EPSILON &&
    next.startDistance <= EPSILON
  )
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

const getPathOrientation = (
  path: Pick<PathGeometry, 'segments' | 'closed'>
) => {
  const points = path.segments.map((segment) => segment.start)
  return points.length >= 3 && polygonArea(points) < 0 ? -1 : 1
}

const getOutsideOffsetDistance = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  strokeWidth: number
) => {
  const orientation = getPathOrientation(path)
  return orientation > 0 ? -strokeWidth : strokeWidth
}

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

const buildOutsideSourceVertexJoinPolygon = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit'>
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
  const offset = getOutsideOffsetDistance(path, stroke.width)
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

const buildOutsideSourceSegmentJoinPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  spanRanges: SourceSegmentIntervalSpanRange[],
  authoredStroke: Pick<RenderableStroke, 'position' | 'cap'>,
  intervalStroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
) => {
  if (
    authoredStroke.position !== 'outside' ||
    path.closed !== true ||
    path.segments.length < 2 ||
    spanRanges.length < 2
  ) {
    return []
  }

  const ranges = spanRanges
    .filter(({ span }) => span.role === 'core')
    .map(({ range }) => range)

  return ranges.flatMap((range, index) => {
    const next = ranges[index + 1]
    if (!next || !areSourceRangesAdjacent(range, next, path.totalLength)) {
      return []
    }

    return buildOutsideSourceVertexJoinPolygon(
      path,
      range.segmentIndex,
      next.segmentIndex,
      intervalStroke
    )
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
  slicingContext?: SourcePathSlicingContext
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
  const areaValidPolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
  if (!touchesSegmentStart && !touchesSegmentEnd) {
    return areaValidPolygons.filter((polygon) => isSimpleClosedPolygon(polygon))
  }
  const fallbackPolygons = areaValidPolygons.filter((polygon) =>
    isSimpleClosedPolygon(polygon)
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
  const previousBoundary = getBoundaryTail(
    getSourceSegmentBoundary(
      path,
      (range.segmentIndex - 1 + path.segments.length) % path.segments.length,
      slicingContext
    ),
    boundaryReach
  )
  const nextBoundary = getBoundaryHead(
    getSourceSegmentBoundary(
      path,
      (range.segmentIndex + 1) % path.segments.length,
      slicingContext
    ),
    boundaryReach
  )
  const currentBoundary = getSourceSegmentBoundary(
    path,
    range.segmentIndex,
    slicingContext
  )
  const currentHeadReference = getBoundaryHeadReferencePoint(
    currentBoundary,
    boundaryReach
  )
  const currentTailReference = getBoundaryTailReferencePoint(
    currentBoundary,
    boundaryReach
  )
  const previousBoundarySelectedSide = getSelectedSideTowardPoint(
    previousBoundary,
    currentHeadReference,
    selectedSide
  )
  const nextBoundarySelectedSide = getSelectedSideTowardPoint(
    nextBoundary,
    currentTailReference,
    selectedSide
  )
  const clippedPolygons = polygons.flatMap((polygon) => {
    let currentPolygon = polygon

    if (touchesSegmentStart) {
      currentPolygon = isPathStartTerminalRange
        ? clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            previousBoundary,
            previousBoundarySelectedSide
          )
        : segmentStartIsSharp
          ? clipPolygonToSelectedSideBoundary(
              currentPolygon,
              previousBoundary,
              previousBoundarySelectedSide
            )
          : clipPolygonToSelectedSideBoundaryIfCrossing(
              currentPolygon,
              previousBoundary,
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
            nextBoundary,
            nextBoundarySelectedSide
          )
        : clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            nextBoundary,
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
        currentBoundary
      )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    return currentPolygon.length >= 3 &&
      Math.abs(polygonArea(currentPolygon)) > EPSILON &&
      isSimpleClosedPolygon(currentPolygon)
      ? [currentPolygon]
      : []
  })

  if (
    isPathStartTerminalRange ||
    isPathEndTerminalRange ||
    shouldRequireClippedCapEndpoint
  ) {
    return clippedPolygons
  }

  if (clippedPolygons.length > 0) {
    const sourceEdge = sliceSourcePathRangePoints(
      path,
      range,
      physicalSpanRole,
      slicingContext
    )
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
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>
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
      const previousBoundary = canUseSourcePathSegments
        ? buildSourceSegmentBoundary(
            sourcePath.segments[
              (index - 1 + sourcePath.segments.length) %
                sourcePath.segments.length
            ]
          )
        : [previous, point]
      const nextBoundary = canUseSourcePathSegments
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

const segmentBoundsOverlapPolygon = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  polygon: Vec2[]
) => {
  const bounds = getPolygonBounds(polygon)
  return (
    Math.min(segmentStart.x, segmentEnd.x) <= bounds.maxX + EPSILON &&
    Math.max(segmentStart.x, segmentEnd.x) + EPSILON >= bounds.minX &&
    Math.min(segmentStart.y, segmentEnd.y) <= bounds.maxY + EPSILON &&
    Math.max(segmentStart.y, segmentEnd.y) + EPSILON >= bounds.minY
  )
}

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON * EPSILON) {
    return distanceBetween(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )

  return distanceBetween(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const pointPolylineDistance = (point: Vec2, polyline: Vec2[]) => {
  if (polyline.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  if (polyline.length === 1) {
    return distanceBetween(point, polyline[0])
  }

  return polyline.slice(0, -1).reduce((nearestDistance, start, index) => {
    const end = polyline[index + 1]
    return Math.min(nearestDistance, pointSegmentDistance(point, start, end))
  }, Number.POSITIVE_INFINITY)
}

const countSourceEdgeVertices = (polygons: Vec2[][], source: Vec2[]) =>
  polygons.reduce(
    (count, polygon) =>
      count +
      polygon.filter((point) => pointPolylineDistance(point, source) <= 0.5)
        .length,
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
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegment = pointSegmentDistance(point, start, end)
      if (distanceToSegment < nearestDistance) {
        nearestDistance = distanceToSegment
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
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegment = pointSegmentDistance(point, start, end)
      if (distanceToSegment < nearestDistance) {
        nearestDistance = distanceToSegment
        nearestCross = cross
      }
    }

    return selectedSide > 0 ? nearestCross < -EPSILON : nearestCross > EPSILON
  })
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

const getBoundaryHeadReferencePoint = (boundary: Vec2[], reach: number) => {
  const head = getBoundaryHead(boundary, reach)
  return head[head.length - 1] ?? boundary[0]
}

const getBoundaryTailReferencePoint = (boundary: Vec2[], reach: number) => {
  const tail = getBoundaryTail(boundary, reach)
  return tail[0] ?? boundary[boundary.length - 1]
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
  let nearestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    const distanceToSegment = pointSegmentDistance(point, start, end)
    if (distanceToSegment < nearestDistance) {
      nearestDistance = distanceToSegment
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
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  const sharpGuardVertices =
    topology.closed &&
    sourceTopology !== 'degenerate' &&
    (options.sourcePath ||
      (options.selectedSideGuardPoints &&
        options.selectedSideGuardPoints.length !== topologyPoints.length))
      ? buildSharpGuardVertices(
          topologyPoints,
          segmentRanges,
          options.selectedSideGuardPoints,
          options.sourcePath
        )
      : []
  const intervalPointSlicer = createStrokeIntervalPointSlicer(
    topologyPoints,
    topology.closed
  )
  const topologySourcePath = buildPolylineGeometryModelPath(
    topologyPoints,
    topology.closed
  )

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const visibleIntervals = getVisibleConstrainedDashedIntervals(
      topology,
      stroke
    )
    const sourceSpanGraph = buildSourceSpanGraph(topology, visibleIntervals)
    const intervalSignature = buildVisibleIntervalSignature(visibleIntervals)

    if (visibleIntervals.length === 0) {
      return []
    }

    const intervalStroke = getIntervalStrokeForSourceDirection(
      topologyPoints,
      topology.closed,
      stroke
    )
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
      const revisionKey = [
        classification.sourceTopology,
        classification.intervalTopology
      ].join(':')
      const existing = revisionSetByClassification.get(revisionKey)
      if (existing) {
        return existing
      }

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
        runtimeStatus: 'candidate',
        ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
        networkId: options.metadata?.networkId,
        strokeId: `stroke:${strokeIndex}`,
        intervalSignature,
        sourceTopology: classification.sourceTopology,
        intervalTopology: classification.intervalTopology
      })
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
        style: 'solid' as const
      }
      const polygons = topology.isSimpleClosed
        ? buildConstrainedDashedLocalSideStrokePolygons(
            topologyPoints,
            true,
            solidStroke,
            {
              assumeSimpleOpen: undefined,
              assumeSimpleClosed: true
            }
          )
        : buildSelfIntersectingClosedConstrainedDashedLocalSidePolygons(
            topologyPoints,
            solidStroke
          )

      if (polygons.length === 0) {
        return []
      }

      const geometryId = `${cachePrefix}:${strokeIndex}:${fullLoopInterval.intervalId}`
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
          options.metadata?.sourceSpanIds ??
          getSourceSpanIdsForInterval(sourceSpanGraph, fullLoopInterval),
        authoredVisibleIntervalIndex: fullLoopInterval.authoredIndex,
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
    }

    const sourcePath = options.sourcePath
    const sourcePathSlicingContext = sourcePath
      ? createSourcePathSlicingContext(sourcePath)
      : undefined
    const closedIntervalLegalityContext = buildClosedIntervalLegalityContext(
      topologyPoints,
      topology.closed,
      stroke
    )

    return visibleIntervals.flatMap((interval) => {
      const classification =
        sourcePath && sourceTopology === 'sampled-simple-closed'
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
            )

      if (!isSupportedConstrainedDashedInterval(classification, stroke)) {
        return []
      }

      const physicalSpans = getIntervalPhysicalSpans(topology, stroke, interval)
      const squareCapPhysicalStroke =
        stroke.cap === 'square'
          ? {
              ...intervalStroke,
              cap: 'butt' as const
            }
          : intervalStroke
      const intervalPolygons = sourcePath
        ? (() => {
            const spanRanges: SourceSegmentIntervalSpanRange[] =
              physicalSpans.flatMap((span) =>
                splitVisibleIntervalBySourceSegments(
                  sourcePath,
                  span,
                  sourcePathSlicingContext
                ).map((range) => ({ range, span }))
              )
            const useExactInsideSourcePath =
              stroke.position === 'inside' && sourcePath.closed === true
            const rangePolygons = spanRanges.flatMap(({ range, span }) => {
              const renderRange = buildOverlappedSourcePathRenderRange(
                sourcePath,
                range,
                span,
                stroke,
                sourcePathSlicingContext
              )
              const rangeCapOwnership = getSourcePathRangeRoundCapOwnership(
                sourcePath,
                range,
                interval,
                squareCapPhysicalStroke
              )
              if (useExactInsideSourcePath) {
                const exactSourcePathSlicingContext = sourcePathSlicingContext
                if (!exactSourcePathSlicingContext) {
                  return []
                }
                const bodyPolygons =
                  buildExactSourcePathRibbonPolygons(
                    sourcePath,
                    renderRange,
                    {
                      ...rangeCapOwnership.stroke,
                      cap: 'butt' as const
                    },
                    exactSourcePathSlicingContext
                  ) ?? []
                const capPolygons = buildExactSourcePathRibbonRoundCapPolygons(
                  sourcePath,
                  renderRange,
                  rangeCapOwnership.stroke,
                  rangeCapOwnership.roundCapStart,
                  rangeCapOwnership.roundCapEnd,
                  exactSourcePathSlicingContext
                )
                return [
                  ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                    bodyPolygons,
                    sourcePath,
                    range,
                    interval,
                    stroke.cap === 'round'
                      ? {
                          ...stroke,
                          cap: 'butt' as const
                        }
                      : stroke,
                    intervalStroke,
                    span.role,
                    sharpGuardVertices,
                    exactSourcePathSlicingContext
                  ),
                  ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                    capPolygons,
                    sourcePath,
                    range,
                    interval,
                    stroke,
                    intervalStroke,
                    span.role,
                    sharpGuardVertices,
                    exactSourcePathSlicingContext
                  )
                ]
              }
              const rangePolygons =
                buildSourcePathRibbonPolygons(
                  sourcePath,
                  renderRange,
                  span,
                  rangeCapOwnership.stroke,
                  rangeCapOwnership.roundCapStart,
                  rangeCapOwnership.roundCapEnd,
                  sourcePathSlicingContext
                ) ??
                buildConstrainedDashedLocalSideStrokePolygons(
                  sliceSourcePathRangePoints(
                    sourcePath,
                    renderRange,
                    span.role,
                    sourcePathSlicingContext
                  ),
                  false,
                  rangeCapOwnership.stroke,
                  {
                    assumeSimpleOpen: true,
                    assumeSimpleClosed: undefined,
                    assumeNormalizedOpen: true,
                    roundCapStart: rangeCapOwnership.roundCapStart,
                    roundCapEnd: rangeCapOwnership.roundCapEnd
                  }
                )
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
            })
            return [
              ...rangePolygons,
              ...buildOutsideSourceSegmentJoinPolygons(
                sourcePath,
                spanRanges,
                stroke,
                intervalStroke
              )
            ]
          })()
        : (() => {
            const spanPolygons = physicalSpans.flatMap((span) =>
              buildConstrainedDashedLocalSideStrokePolygons(
                intervalPointSlicer.slice(
                  span.startDistance,
                  span.endDistance,
                  span.wrapsSeam
                ),
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

            const spanRanges: SourceSegmentIntervalSpanRange[] =
              physicalSpans.flatMap((span) =>
                splitVisibleIntervalBySourceSegments(
                  topologySourcePath,
                  span
                ).map((range) => ({ range, span }))
              )
            return [
              ...spanPolygons,
              ...buildOutsideSourceSegmentJoinPolygons(
                topologySourcePath,
                spanRanges,
                stroke,
                intervalStroke
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
      const polygons = topology.isSimpleClosed
        ? applyClosedIntervalLegality(
            selectedSidePolygons,
            closedIntervalLegalityContext
          )
        : selectedSidePolygons

      if (polygons.length === 0) {
        return []
      }

      const geometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
      const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
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
          getSourceSpanIdsForInterval(sourceSpanGraph, interval),
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
  })
}
