import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import type { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import { createStrokeIntervalPointSlicer } from './stroke-interval-frames'
import { buildConstrainedSolidStrokePolygons } from './constrained-solid-stroke-geometry'
import { polygonArea } from './solid-stroke-geometry-core'
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

export interface ConstrainedDashedStrokeOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
    contourId?: string
    legalDomainId?: string | null
  }
  topology?: PathTopologyModel
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
  forceLocalSideApproximation = false
): Exclude<SolidCenterStrokeGeometryDebugMeta['resolutionStatus'], undefined> =>
  sourceTopology === 'self-intersecting' || forceLocalSideApproximation
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
  const intervalPointSlicer = createStrokeIntervalPointSlicer(
    topologyPoints,
    topology.closed
  )

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const visibleIntervals = allocateDashedIntervalsForTopology(
      topology,
      stroke.dashPattern,
      stroke.dashOffset
    ).filter((interval) => interval.kind === 'visible')
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
        authoredVisibleIntervalIndex: fullLoopInterval.authoredIndex,
        startDistance: fullLoopInterval.startDistance,
        endDistance: fullLoopInterval.endDistance,
        wrapsSeam: fullLoopInterval.wrapsSeam,
        previousVisibleIntervalId: fullLoopInterval.previousVisibleIntervalId,
        nextVisibleIntervalId: fullLoopInterval.nextVisibleIntervalId,
        geometryFamily: 'constrained-dashed',
        resolutionStatus: getConstrainedDashedResolutionStatus(
          classification.sourceTopology,
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

      const intervalPoints = intervalPointSlicer.slice(
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
      const intervalPolygons = buildConstrainedSolidStrokePolygons(
        intervalPoints,
        false,
        intervalStroke,
        {
          assumeSimpleOpen:
            stroke.cap !== 'square' &&
            (!topology.closed ||
              topology.isSimpleClosed ||
              topology.topologyFamily === 'self-intersecting')
              ? true
              : undefined,
          assumeSimpleClosed: topology.closed
            ? topology.isSimpleClosed
            : undefined,
          assumeNormalizedOpen: true
        }
      )
      const polygons = topology.isSimpleClosed
        ? applyClosedIntervalLegality(
            intervalPolygons,
            topologyPoints,
            topology.closed,
            stroke
          )
        : intervalPolygons

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
        authoredVisibleIntervalIndex: interval.authoredIndex,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        wrapsSeam: interval.wrapsSeam,
        previousVisibleIntervalId: interval.previousVisibleIntervalId,
        nextVisibleIntervalId: interval.nextVisibleIntervalId,
        geometryFamily: 'constrained-dashed',
        resolutionStatus: getConstrainedDashedResolutionStatus(
          classification.sourceTopology,
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
