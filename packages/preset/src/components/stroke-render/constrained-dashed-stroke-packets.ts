import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import type { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import { createStrokeIntervalPointSlicer } from './stroke-interval-frames'
import { buildConstrainedSolidStrokePolygons } from './constrained-solid-stroke-geometry'
import {
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
  slicePathSegmentPoints,
  slicePathGeometryPoints,
  type PathSegment,
  type PathGeometry
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

const getIntervalAllocationDashPattern = (
  stroke: Pick<RenderableStroke, 'cap' | 'dashPattern' | 'width'>
) => {
  if (stroke.cap !== 'square' || stroke.width <= EPSILON) {
    return stroke.dashPattern
  }

  const squareCapGrowth = stroke.width
  return stroke.dashPattern.map((entry, index) =>
    index % 2 === 0
      ? Math.max(EPSILON, entry + squareCapGrowth)
      : Math.max(EPSILON, entry - squareCapGrowth)
  )
}

const getIntervalAllocationDashOffset = (
  stroke: Pick<RenderableStroke, 'cap' | 'dashOffset' | 'width'>
) => {
  if (stroke.cap !== 'square' || stroke.width <= EPSILON) {
    return stroke.dashOffset
  }

  return stroke.dashOffset + stroke.width / 2
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

const isSingleEdgeVisibleInterval = (
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

const isSingleCornerSpanningVisibleInterval = (
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
): Exclude<SolidCenterStrokeGeometryDebugMeta['resolutionStatus'], undefined> =>
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
    edge.dx * (point.y - edge.start.y) -
    edge.dy * (point.x - edge.start.x)
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
      const previousInside = isInsideHalfPlane(
        previous,
        edge,
        orientation
      )

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
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
) => {
  if (!closed || stroke.position !== 'inside') {
    return polygons
  }

  const boundary = getCanonicalClosedLoopPoints(points, closed)
  const orientationArea = polygonArea(boundary)
  if (boundary.length < 3 || Math.abs(orientationArea) <= EPSILON) {
    return []
  }

  const orientation = orientationArea > 0 ? 1 : -1
  const clipEdges = buildClipEdges(boundary)
  return polygons
    .map((polygon) =>
      clipPolygonToClosedLegalDomain(polygon, clipEdges, orientation)
    )
    .filter((polygon) => polygon.length >= 3)
}

const normalizeDistanceOnLoop = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

const getSourcePathSegmentRanges = (
  path: Pick<PathGeometry, 'segments'>
) => {
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

const splitSourcePathRangeBySegmentBoundaries = (
  path: Pick<PathGeometry, 'segments'>,
  startDistance: number,
  endDistance: number
) => {
  if (endDistance - startDistance <= EPSILON) {
    return []
  }

  return getSourcePathSegmentRanges(path).flatMap((segment) => {
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
  >
) => {
  if (path.segments.length === 0 || path.totalLength <= EPSILON) {
    return []
  }

  if (interval.wrapsSeam) {
    return [
      ...splitSourcePathRangeBySegmentBoundaries(
        path,
        interval.startDistance,
        path.totalLength
      ),
      ...splitSourcePathRangeBySegmentBoundaries(path, 0, interval.endDistance)
    ]
  }

  return splitSourcePathRangeBySegmentBoundaries(
    path,
    interval.startDistance,
    interval.endDistance
  )
}

type SourceSegmentIntervalRange = {
  startDistance: number
  endDistance: number
  segmentIndex: number
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
  const nextBoundary = buildSourceSegmentBoundary(path.segments[nextSegmentIndex])
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
  ranges: SourceSegmentIntervalRange[],
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
    ranges.length < 2
  ) {
    return []
  }

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
  authoredStroke: Pick<RenderableStroke, 'position' | 'dashPattern' | 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  sharpGuardVertices: SharpGuardVertex[] = []
) => {
  if (
    polygons.length === 0 ||
    path.closed !== true ||
    path.segments.length < 2 ||
    authoredStroke.position !== 'inside'
  ) {
    return polygons
  }

  const segmentRanges = getSourcePathSegmentRanges(path)
  const segmentRange = segmentRanges[range.segmentIndex]
  if (!segmentRange) {
    return polygons
  }

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
  const endpointClipReach = Math.max(
    intervalStroke.width * (authoredStroke.cap === 'square' ? 1.5 : 0.55),
    EPSILON
  )
  const touchesSegmentStart =
    range.startDistance <= segmentRange.startDistance + endpointClipReach + EPSILON
  const touchesSegmentEnd =
    range.endDistance >= segmentRange.endDistance - endpointClipReach - EPSILON
  const previousSegment =
    path.segments[
      (range.segmentIndex - 1 + path.segments.length) % path.segments.length
    ]
  const nextSegment =
    path.segments[(range.segmentIndex + 1) % path.segments.length]
  const previousBoundary = getBoundaryTail(
    buildSourceSegmentBoundary(previousSegment),
    boundaryReach
  )
  const nextBoundary = getBoundaryHead(
    buildSourceSegmentBoundary(nextSegment),
    boundaryReach
  )
  const currentBoundary = buildSourceSegmentBoundary(
    path.segments[range.segmentIndex]
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
      currentPolygon =
        segmentStartIsSharp
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
      currentPolygon =
        segmentEndIsSharp
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
      (touchesSegmentStart && !segmentStartIsSharp) ||
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

    return currentPolygon.length >= 3 && isSimpleClosedPolygon(currentPolygon)
      ? [currentPolygon]
      : []
  })

  const fallbackPolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && isSimpleClosedPolygon(polygon)
  )
  if (clippedPolygons.length > 0) {
    const sourceEdge = slicePathGeometryPoints(
      path,
      range.startDistance,
      range.endDistance,
      false
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
      const next = normalizedGuardPoints[(index + 1) % normalizedGuardPoints.length]
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
    const cross = dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    return selectedSide > 0 ? cross >= -EPSILON : cross <= EPSILON
  }
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous = polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside) {
      if (!previousInside) {
        output.push(lineIntersection(previous, current, segmentStart, segmentEnd))
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

  if (deduped.length > 2 && areSamePoint(deduped[0], deduped[deduped.length - 1])) {
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
  if (
    t < -EPSILON ||
    t > 1 + EPSILON ||
    u < -EPSILON ||
    u > 1 + EPSILON
  ) {
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
  for (let polygonEdgeIndex = 0; polygonEdgeIndex < polygon.length; polygonEdgeIndex += 1) {
    const polygonStart = polygon[polygonEdgeIndex]
    const polygonEnd = polygon[(polygonEdgeIndex + 1) % polygon.length]
    for (let boundaryEdgeIndex = 0; boundaryEdgeIndex < boundary.length - 1; boundaryEdgeIndex += 1) {
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

    return selectedSide > 0
      ? nearestCross < -EPSILON
      : nearestCross > EPSILON
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
    const cross = dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
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

const clipPolygonToSelectedSideBoundaryOrDropRejected = (
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

      const startsAtGuard = isIntervalStartAtGuard(
        interval,
        guard,
        totalLength
      )
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

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const intervalAllocationDashPattern =
      getIntervalAllocationDashPattern(stroke)
    const intervalAllocationDashOffset = getIntervalAllocationDashOffset(stroke)
    const visibleIntervals = allocateDashedIntervalsForTopology(
      topology,
      intervalAllocationDashPattern,
      intervalAllocationDashOffset
    ).filter((interval) => interval.kind === 'visible')
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

      const polygons = buildConstrainedSolidStrokePolygons(
        topologyPoints,
        true,
        {
          ...stroke,
          style: 'solid'
        },
        {
          assumeSimpleOpen: undefined,
          assumeSimpleClosed: topology.isSimpleClosed
        }
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

    return visibleIntervals.flatMap((interval) => {
      const classification = classifyConstrainedDashedIntervalWithContext(
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

      const sourcePath = options.sourcePath
      const intervalPolygons = sourcePath
        ? (() => {
            const sourceRanges = splitVisibleIntervalBySourceSegments(
              sourcePath,
              interval
            )
            const rangePolygons = sourceRanges.flatMap((range) => {
              const rawIntervalPoints = slicePathGeometryPoints(
                sourcePath,
                range.startDistance,
                range.endDistance,
                false
              )
              const rangePolygons = buildConstrainedSolidStrokePolygons(
                rawIntervalPoints,
                false,
                stroke.cap === 'square'
                  ? {
                      ...intervalStroke,
                      cap: 'butt'
                    }
                  : intervalStroke,
                {
                  assumeSimpleOpen: true,
                  assumeSimpleClosed: undefined,
                  assumeNormalizedOpen: true
                }
              )
              return clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                rangePolygons,
                sourcePath,
                range,
                stroke,
                intervalStroke,
                sharpGuardVertices
              )
            })
            return [
              ...rangePolygons,
              ...buildOutsideSourceSegmentJoinPolygons(
                sourcePath,
                sourceRanges,
                stroke,
                intervalStroke
              )
            ]
          })()
        : buildConstrainedSolidStrokePolygons(
            intervalPointSlicer.slice(
              interval.startDistance,
              interval.endDistance,
              interval.wrapsSeam
            ),
            false,
            stroke.cap === 'square'
              ? {
                  ...intervalStroke,
                  cap: 'butt'
                }
              : intervalStroke,
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
            topologyPoints,
            topology.closed,
            stroke
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
