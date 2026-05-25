import type { StrokeAttrs } from '@asyra/utils'
import type { GeometryBackend, PolygonRegion } from './geometry-backend'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildSolidCenterStrokeResolvedPackets,
  type SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import type { StrokeGeometrySourceTopology } from './solid-center-stroke-packets'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
import { buildStrokeRuntimeRevisionSet } from './stroke-dirty-keys'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from './path-topology-model'
import type { PathTopologyFillRule } from './path-topology-model'
import {
  buildPolylineGeometryModelPath,
  slicePathSegmentPoints,
  slicePathGeometryPoints,
  type PathGeometry,
  type PathSegment
} from './path-geometry'
import { buildClosedConstrainedStrokePolygonEntriesForSource } from './constrained-solid-stroke-geometry'
import { resolveOneSidedCandidateFlow } from './stroke-candidate-flow'
import { resolveSourceFamily } from './resolved-source-family'
import { resolveStrokeDomains } from './stroke-domain-plan'
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from './resolved-vector-geometry-model'
import {
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'

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

interface SelectedSideGuardPoint extends Vec2 {
  sharp?: boolean
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

interface ConstrainedSolidStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
    contourId?: string
    legalDomainId?: string | null
  }
  topology?: PathTopologyModel
  sourcePath?: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >
  implicitFillRegions?: PolygonRegion[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
  sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  exactBackend?: Pick<
    GeometryBackend,
    'capabilities' | 'union' | 'difference' | 'intersection' | 'offset'
  >
  fillRule?: PathTopologyFillRule
  candidateMode?: 'exact-arrangement' | 'direct-local-side-exact'
}

interface SourceSegmentRange {
  startDistance: number
  endDistance: number
  segmentIndex: number
}

interface ExactSolidCandidatePolygon {
  polygon: Vec2[]
  role: 'segment-body' | 'vertex-join'
  sourceSegmentIndex?: number
  sourceVertexIndex?: number
  sourceSpanIds: string[]
}

interface SourcePathVertexJoinCandidatePolygon {
  polygon: Vec2[]
  sourceVertexIndex: number
  sourceSpanIds?: string[]
}

interface OneSidedSegmentBodyCellPolygon {
  polygon: Vec2[]
  startDistance: number
  endDistance: number
  referencePoint: Vec2
  sourceReferencePoint: Vec2
}

type OneSidedOffsetDistanceResolver = (
  points: Vec2[],
  range: SourceSegmentRange
) => number

const EPSILON = 1e-6
const SMOOTH_SEAM_CORNER_TURN_ANGLE = Math.PI / 4

const measureConstrainedSolidPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const start = performance.now()
  try {
    return run()
  } finally {
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink?.(
      `constrained-solid:${phaseName}`,
      performance.now() - start
    )
  }
}

const supportsExactConstrainedSolidStroke = (
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
) =>
  stroke.style === 'solid' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const normalizePoint = (point: Vec2): Vec2 => ({
  x: Math.abs(point.x) <= EPSILON ? 0 : point.x,
  y: Math.abs(point.y) <= EPSILON ? 0 : point.y
})

const normalizeVector = (point: Vec2): Vec2 | null => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPSILON) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

const subtractPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const addPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x + right.x,
  y: left.y + right.y
})

const scalePoint = (point: Vec2, scale: number): Vec2 => ({
  x: point.x * scale,
  y: point.y * scale
})

const crossPoints = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const areSamePoint = (first: Vec2, second: Vec2) =>
  distanceBetween(first, second) <= EPSILON

const lineIntersection = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
): Vec2 | null => {
  const firstDelta = subtractPoint(firstEnd, firstStart)
  const secondDelta = subtractPoint(secondEnd, secondStart)
  const denominator = crossPoints(firstDelta, secondDelta)
  if (Math.abs(denominator) <= EPSILON) {
    return null
  }

  const startDelta = subtractPoint(secondStart, firstStart)
  const amount = crossPoints(startDelta, secondDelta) / denominator
  return normalizePoint({
    x: firstStart.x + firstDelta.x * amount,
    y: firstStart.y + firstDelta.y * amount
  })
}

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
  for (const point of polygon.map(normalizePoint)) {
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

const getSegmentSideOffsetDistance = (
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >
) => {
  return stroke.position === 'outside' ? stroke.width : -stroke.width
}

const getClosedContourSideOffsetDistance = (
  topologyPoints: Vec2[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >
) => {
  const area = polygonArea(topologyPoints)
  const interiorOffset = area >= 0 ? stroke.width : -stroke.width
  return stroke.position === 'inside' ? interiorOffset : -interiorOffset
}

const isPointInPolygonEvenOdd = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const getPointSegmentDistance = (
  point: Vec2,
  segmentStart: Vec2,
  segmentEnd: Vec2
) => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) {
    return distanceBetween(point, segmentStart)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
        lengthSquared
    )
  )
  return distanceBetween(point, {
    x: segmentStart.x + dx * t,
    y: segmentStart.y + dy * t
  })
}

const isPointOnPolygonBoundary = (point: Vec2, polygon: Vec2[]) =>
  polygon.some(
    (current, index) =>
      getPointSegmentDistance(
        point,
        current,
        polygon[(index + 1) % polygon.length]
      ) <= 0.25
  )

const polygonListContainsPointIncludingBoundary = (
  polygons: Vec2[][],
  point: Vec2
) =>
  polygons.some(
    (polygon) =>
      isPointOnPolygonBoundary(point, polygon) ||
      isPointInPolygonEvenOdd(point, polygon)
  )

const getPolylinePointAtRatio = (
  points: Vec2[],
  ratio: number
): Vec2 | null => {
  if (points.length === 0) {
    return null
  }
  if (points.length === 1) {
    return points[0]
  }

  const lengths: number[] = []
  let totalLength = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = distanceBetween(points[index], points[index + 1])
    lengths.push(length)
    totalLength += length
  }
  if (totalLength <= EPSILON) {
    return points[0]
  }

  let remaining = totalLength * ratio
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = lengths[index] ?? 0
    if (remaining <= length || index === points.length - 2) {
      const t = length > EPSILON ? remaining / length : 0
      const start = points[index]
      const end = points[index + 1]
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      }
    }
    remaining -= length
  }

  return points[points.length - 1]
}

const bodyPolygonsCoverSourceSegment = (
  bodyPolygons: Vec2[][],
  rawSegmentPoints: Vec2[]
) => {
  if (bodyPolygons.length === 0 || rawSegmentPoints.length < 2) {
    return false
  }

  return [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].every(
    (ratio) => {
      const point = getPolylinePointAtRatio(rawSegmentPoints, ratio)
      return point
        ? polygonListContainsPointIncludingBoundary(bodyPolygons, point)
        : true
    }
  )
}

const buildOneSidedSegmentBodyPolygonFromCells = (
  cells: OneSidedSegmentBodyCellPolygon[]
) => {
  if (cells.length === 0) {
    return null
  }

  const sourceBoundary = [
    cells[0].polygon[0],
    ...cells.map((cell) => cell.polygon[1])
  ]
  const offsetBoundary = [
    cells[cells.length - 1].polygon[2],
    ...[...cells].reverse().map((cell) => cell.polygon[3])
  ]
  const polygon = cleanPolygon([...sourceBoundary, ...offsetBoundary])

  return polygon.length >= 3 &&
    isSimpleClosedPolygon(polygon) &&
    Math.abs(polygonArea(polygon)) > EPSILON
    ? polygon
    : null
}

const buildCompactedOneSidedSegmentBodyCellPolygons = (
  cells: OneSidedSegmentBodyCellPolygon[]
) => {
  if (cells.length <= 1) {
    return cells.map((cell) => cell.polygon)
  }

  const compacted: Vec2[][] = []
  let run: OneSidedSegmentBodyCellPolygon[] = []

  const flushRun = () => {
    if (run.length === 0) {
      return
    }

    const compactedPolygon = buildOneSidedSegmentBodyPolygonFromCells(run)
    if (compactedPolygon) {
      compacted.push(compactedPolygon)
    } else {
      compacted.push(...run.map((cell) => cell.polygon))
    }
    run = []
  }

  cells.forEach((cell) => {
    const previous = run[run.length - 1]
    if (previous && cell.startDistance > previous.endDistance + EPSILON * 10) {
      flushRun()
    }
    run.push(cell)
  })
  flushRun()

  return compacted
}

const getWindingContribution = (point: Vec2, polygon: Vec2[]) => {
  let winding = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    if (current.y <= point.y) {
      if (
        next.y > point.y &&
        crossPoints(
          subtractPoint(next, current),
          subtractPoint(point, current)
        ) > EPSILON
      ) {
        winding += 1
      }
      continue
    }

    if (
      next.y <= point.y &&
      crossPoints(subtractPoint(next, current), subtractPoint(point, current)) <
        -EPSILON
    ) {
      winding -= 1
    }
  }

  return winding
}

const isPointInFillDomain = (
  point: Vec2,
  polygon: Vec2[],
  fillRule: PathTopologyFillRule
) =>
  fillRule === 'nonzero'
    ? getWindingContribution(point, polygon) !== 0
    : isPointInPolygonEvenOdd(point, polygon)

interface SourceSegmentFrame {
  point: Vec2
  tangent: Vec2
}

const getCubicLengthAtT = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= EPSILON) {
    return 0
  }
  if (t >= 1 - EPSILON) {
    return segment.length
  }
  return segment.curve.split(0, t).length()
}

const getCubicTAtLength = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= EPSILON) {
    return 0
  }
  if (targetLength >= segment.length - EPSILON) {
    return 1
  }

  let low = 0
  let high = 1
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2
    if (getCubicLengthAtT(segment, mid) < targetLength) {
      low = mid
    } else {
      high = mid
    }
  }
  return (low + high) / 2
}

const getSegmentFrameAtLocalLength = (
  segment: PathSegment | undefined,
  localLength: number
): SourceSegmentFrame | null => {
  if (!segment || segment.length <= EPSILON) {
    return null
  }

  if (segment.type === 'line') {
    const t = Math.max(0, Math.min(1, localLength / segment.length))
    const tangent = normalizeVector(subtractPoint(segment.end, segment.start))
    return tangent
      ? {
          point: {
            x: segment.start.x + (segment.end.x - segment.start.x) * t,
            y: segment.start.y + (segment.end.y - segment.start.y) * t
          },
          tangent
        }
      : null
  }

  const t = getCubicTAtLength(segment, localLength)
  const point = segment.curve.get(t) as Vec2
  const derivative = segment.curve.derivative(t) as Vec2
  const tangent =
    normalizeVector(derivative) ??
    normalizeVector(subtractPoint(segment.control1, segment.start)) ??
    normalizeVector(subtractPoint(segment.control2, segment.start)) ??
    normalizeVector(subtractPoint(segment.end, segment.start))

  return tangent
    ? {
        point: { x: point.x, y: point.y },
        tangent
      }
    : null
}

const getSourceSegmentProbeFrame = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  range: SourceSegmentRange,
  ratio: number
) => {
  const segment = sourcePath.segments[range.segmentIndex]
  const rangeLength = range.endDistance - range.startDistance
  return getSegmentFrameAtLocalLength(segment, rangeLength * ratio)
}

const getSegmentFrameOffsetPoint = (
  frame: SourceSegmentFrame | null,
  offsetDistance: number
) =>
  frame
    ? {
        x: frame.point.x - frame.tangent.y * offsetDistance,
        y: frame.point.y + frame.tangent.x * offsetDistance
      }
    : null

const chooseSourceSegmentSideOffsetDistance = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topologyPoints: Vec2[],
  fillRule: PathTopologyFillRule,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  range: SourceSegmentRange,
  fallbackOffsetDistance: number
) => {
  if (
    topologyPoints.length < 3 ||
    sourcePath.closed !== true ||
    (stroke.position !== 'inside' && stroke.position !== 'outside')
  ) {
    return fallbackOffsetDistance
  }

  const probeDistances = [
    Math.min(2, Math.max(0.5, stroke.width * 0.2)),
    Math.max(1, stroke.width * 0.5),
    Math.max(1.5, stroke.width * 0.85)
  ]
  const probeRatios = [0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85]
  let leftVotes = 0
  let rightVotes = 0

  for (const ratio of probeRatios) {
    const frame = getSourceSegmentProbeFrame(sourcePath, range, ratio)
    for (const probeDistance of probeDistances) {
      const leftProbe = getSegmentFrameOffsetPoint(frame, probeDistance)
      const rightProbe = getSegmentFrameOffsetPoint(frame, -probeDistance)
      if (!leftProbe || !rightProbe) {
        continue
      }

      const leftInside = isPointInFillDomain(
        leftProbe,
        topologyPoints,
        fillRule
      )
      const rightInside = isPointInFillDomain(
        rightProbe,
        topologyPoints,
        fillRule
      )

      if (leftInside === rightInside) {
        continue
      }

      if (stroke.position === 'inside') {
        if (leftInside) {
          leftVotes += 1
        } else {
          rightVotes += 1
        }
        continue
      }

      if (leftInside) {
        rightVotes += 1
      } else {
        leftVotes += 1
      }
    }
  }

  if (leftVotes === rightVotes) {
    return fallbackOffsetDistance
  }

  const fillDomainSideOffsetDistance =
    leftVotes > rightVotes ? stroke.width : -stroke.width

  return fillDomainSideOffsetDistance
}

const buildSelfIntersectingAuthoredSourceSpanOffsetDistances = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topologyPoints: Vec2[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  fillRule: PathTopologyFillRule,
  fallbackOffsetDistance: number
): number[] | null => {
  if (
    sourcePath.closed !== true ||
    sourcePath.segments.length < 2 ||
    topologyPoints.length < 3 ||
    isSimpleClosedPolygon(topologyPoints) ||
    (stroke.position !== 'inside' && stroke.position !== 'outside')
  ) {
    return null
  }

  const segmentRanges = getSourcePathSegmentRanges(sourcePath)

  return sourcePath.segments.map((_segment, segmentIndex) => {
    const range = segmentRanges[segmentIndex]
    return range
      ? chooseSourceSegmentSideOffsetDistance(
          sourcePath,
          topologyPoints,
          fillRule,
          stroke,
          range,
          fallbackOffsetDistance
        )
      : fallbackOffsetDistance
  })
}

const buildOneSidedOffsetDistanceBySourceSegment = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topologyPoints: Vec2[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  fillRule: PathTopologyFillRule
) => {
  const fallbackOffsetDistance = getClosedContourSideOffsetDistance(
    topologyPoints,
    stroke
  )

  const selfIntersectingAuthoredOffsets =
    buildSelfIntersectingAuthoredSourceSpanOffsetDistances(
      sourcePath,
      topologyPoints,
      stroke,
      fillRule,
      fallbackOffsetDistance
    )
  if (selfIntersectingAuthoredOffsets) {
    return selfIntersectingAuthoredOffsets
  }

  const segmentRanges = getSourcePathSegmentRanges(sourcePath)

  return sourcePath.segments.map((_segment, segmentIndex) => {
    const range = segmentRanges[segmentIndex]
    return range
      ? chooseSourceSegmentSideOffsetDistance(
          sourcePath,
          topologyPoints,
          fillRule,
          stroke,
          range,
          fallbackOffsetDistance
        )
      : fallbackOffsetDistance
  })
}

const buildOneSidedOffsetDistanceResolver = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topologyPoints: Vec2[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >
): OneSidedOffsetDistanceResolver | undefined => {
  return undefined
}

const getSolidStrokeForExactCandidate = <
  TStroke extends Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
>(
  stroke: TStroke
): TStroke => ({
  ...stroke,
  style: 'solid'
})

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

  return normalizePoint({
    x: point.x - direction.y * offset,
    y: point.y + direction.x * offset
  })
}

const getSampleTangent = (points: Vec2[], index: number): Vec2 | null => {
  const previous = points[index - 1]
  const current = points[index]
  const next = points[index + 1]

  if (previous && next) {
    return normalizeVector(subtractPoint(next, previous))
  }
  if (next) {
    return normalizeVector(subtractPoint(next, current))
  }
  if (previous) {
    return normalizeVector(subtractPoint(current, previous))
  }
  return null
}

const getOffsetPointForSample = (
  points: Vec2[],
  index: number,
  offsetDistance: number
): Vec2 | null => {
  const tangent = getSampleTangent(points, index)
  if (!tangent) {
    return null
  }
  const point = points[index]
  return normalizePoint({
    x: point.x - tangent.y * offsetDistance,
    y: point.y + tangent.x * offsetDistance
  })
}

const buildOneSidedSegmentBodyPolygon = (
  points: Vec2[],
  offsetDistance: number
) => {
  const sourcePoints = points.map(normalizePoint)
  if (sourcePoints.length < 2) {
    return null
  }

  const offsetPoints = sourcePoints.map((_, index) =>
    getOffsetPointForSample(sourcePoints, index, offsetDistance)
  )
  if (offsetPoints.some((point) => point === null)) {
    return null
  }

  const polygon = cleanPolygon([
    ...sourcePoints,
    ...(offsetPoints as Vec2[]).reverse()
  ])
  return polygon.length >= 3 &&
    isSimpleClosedPolygon(polygon) &&
    Math.abs(polygonArea(polygon)) > EPSILON
    ? polygon
    : null
}

const buildOneSidedSmoothJoinBodyPolygon = (
  previousBoundary: Vec2[],
  nextBoundary: Vec2[],
  offsetDistance: number
) => {
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return null
  }

  const sharedPreviousVertex = previousBoundary[previousBoundary.length - 1]
  const sharedNextVertex = nextBoundary[0]
  if (distanceBetween(sharedPreviousVertex, sharedNextVertex) > 0.75) {
    return null
  }

  const sourcePoints = [...previousBoundary, ...nextBoundary.slice(1)].map(
    normalizePoint
  )
  if (sourcePoints.length < 3) {
    return null
  }

  const offsetPoints = sourcePoints.map((_, index) =>
    getOffsetPointForSample(sourcePoints, index, offsetDistance)
  )
  if (offsetPoints.some((point) => point === null)) {
    return null
  }

  const polygon = cleanPolygon([
    ...sourcePoints,
    ...(offsetPoints as Vec2[]).reverse()
  ])
  return polygon.length >= 3 &&
    isSimpleClosedPolygon(polygon) &&
    Math.abs(polygonArea(polygon)) > EPSILON
    ? polygon
    : null
}

const buildOneSidedSegmentBodyCellPolygons = (
  points: Vec2[],
  offsetDistance: number,
  offsetDistanceResolver?: OneSidedOffsetDistanceResolver,
  range?: SourceSegmentRange
): OneSidedSegmentBodyCellPolygon[] => {
  const sourcePoints = points.map(normalizePoint)
  if (sourcePoints.length < 2) {
    return []
  }

  const chordLengths: number[] = []
  let totalChordLength = 0
  for (let index = 0; index < sourcePoints.length - 1; index += 1) {
    const length = distanceBetween(sourcePoints[index], sourcePoints[index + 1])
    chordLengths.push(length)
    totalChordLength += length
  }

  const rangeLength =
    range && range.endDistance > range.startDistance
      ? range.endDistance - range.startDistance
      : totalChordLength
  const distanceScale =
    totalChordLength > EPSILON ? rangeLength / totalChordLength : 1
  let cursorDistance = range?.startDistance ?? 0
  const cells: OneSidedSegmentBodyCellPolygon[] = []
  for (let index = 0; index < sourcePoints.length - 1; index += 1) {
    const sourceStart = sourcePoints[index]
    const sourceEnd = sourcePoints[index + 1]
    const chordLength = chordLengths[index] ?? 0
    const cellStartDistance = cursorDistance
    const cellEndDistance = cursorDistance + chordLength * distanceScale
    cursorDistance = cellEndDistance
    const cellOffsetDistance =
      offsetDistanceResolver && range
        ? offsetDistanceResolver([sourceStart, sourceEnd], range)
        : offsetDistance
    const offsetStart = getOffsetPointForSample(
      sourcePoints,
      index,
      cellOffsetDistance
    )
    const offsetEnd = getOffsetPointForSample(
      sourcePoints,
      index + 1,
      cellOffsetDistance
    )
    if (
      !sourceStart ||
      !sourceEnd ||
      !offsetStart ||
      !offsetEnd ||
      distanceBetween(sourceStart, sourceEnd) <= EPSILON
    ) {
      continue
    }

    const polygon = cleanPolygon([
      sourceStart,
      sourceEnd,
      offsetEnd,
      offsetStart
    ])
    if (
      polygon.length >= 3 &&
      isSimpleClosedPolygon(polygon) &&
      Math.abs(polygonArea(polygon)) > EPSILON
    ) {
      cells.push({
        polygon,
        startDistance: cellStartDistance,
        endDistance: cellEndDistance,
        referencePoint: normalizePoint({
          x: (sourceStart.x + sourceEnd.x + offsetEnd.x + offsetStart.x) / 4,
          y: (sourceStart.y + sourceEnd.y + offsetEnd.y + offsetStart.y) / 4
        }),
        sourceReferencePoint: normalizePoint({
          x: (sourceStart.x + sourceEnd.x) / 2,
          y: (sourceStart.y + sourceEnd.y) / 2
        })
      })
    }
  }

  return cells
}

const buildOneSidedSegmentBodyChunkPolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentRange,
  offsetDistance: number,
  maxChunkCount: number
): OneSidedSegmentBodyCellPolygon[] => {
  const rangeLength = range.endDistance - range.startDistance
  if (rangeLength <= EPSILON || maxChunkCount <= 0) {
    return []
  }

  const chunkCount = Math.max(
    1,
    Math.min(maxChunkCount, Math.ceil(rangeLength / 18))
  )
  const chunks: OneSidedSegmentBodyCellPolygon[] = []

  for (let index = 0; index < chunkCount; index += 1) {
    const startDistance =
      range.startDistance + (rangeLength * index) / chunkCount
    const endDistance =
      range.startDistance + (rangeLength * (index + 1)) / chunkCount
    const points = slicePathGeometryPoints(
      sourcePath,
      startDistance,
      endDistance,
      false
    )
    const polygon = buildOneSidedSegmentBodyPolygon(points, offsetDistance)
    if (!polygon) {
      continue
    }

    const sourceReferencePoints = slicePathGeometryPoints(
      sourcePath,
      startDistance,
      endDistance,
      false
    )
    const sourceReferencePoint =
      sourceReferencePoints.length > 0
        ? normalizePoint({
            x:
              sourceReferencePoints.reduce((sum, point) => sum + point.x, 0) /
              sourceReferencePoints.length,
            y:
              sourceReferencePoints.reduce((sum, point) => sum + point.y, 0) /
              sourceReferencePoints.length
          })
        : normalizePoint(polygon[0])

    chunks.push({
      polygon,
      startDistance,
      endDistance,
      referencePoint: normalizePoint({
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
      }),
      sourceReferencePoint
    })
  }

  return chunks
}

const getSegmentStartDirection = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector(subtractPoint(segment.end, segment.start))
  }

  return (
    normalizeVector(subtractPoint(segment.control1, segment.start)) ??
    normalizeVector(subtractPoint(segment.control2, segment.start)) ??
    normalizeVector(subtractPoint(segment.end, segment.start))
  )
}

const getSegmentEndDirection = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector(subtractPoint(segment.end, segment.start))
  }

  return (
    normalizeVector(subtractPoint(segment.end, segment.control2)) ??
    normalizeVector(subtractPoint(segment.end, segment.control1)) ??
    normalizeVector(subtractPoint(segment.end, segment.start))
  )
}

const getSourceJoinTurnAngle = (
  previousDirection: Vec2,
  nextDirection: Vec2
) => {
  const dot = Math.max(
    -1,
    Math.min(
      1,
      previousDirection.x * nextDirection.x +
        previousDirection.y * nextDirection.y
    )
  )
  return Math.acos(dot)
}

const isClosedSourcePathSeamJoin = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number
) =>
  sourcePath.closed === true &&
  previousSegmentIndex === sourcePath.segments.length - 1

const shouldRespectSmoothGuardAtSourceJoin = (
  guardPoint: SelectedSideGuardPoint | undefined,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  previousDirection: Vec2,
  nextDirection: Vec2
) => {
  if (guardPoint?.sharp !== false) {
    return false
  }

  if (!isClosedSourcePathSeamJoin(sourcePath, previousSegmentIndex)) {
    return true
  }

  return (
    getSourceJoinTurnAngle(previousDirection, nextDirection) <
    SMOOTH_SEAM_CORNER_TURN_ANGLE
  )
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

const getSourcePathSegmentRanges = (
  path: Pick<PathGeometry, 'segments'>
): SourceSegmentRange[] => {
  let cursor = 0
  return path.segments.map((segment, segmentIndex) => {
    const range = {
      startDistance: cursor,
      endDistance: cursor + segment.length,
      segmentIndex
    }
    cursor = range.endDistance
    return range
  })
}

const normalizeClosedSourcePathWithImplicitClosingSegment = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
): Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> => {
  if (path.closed !== true || path.segments.length < 2) {
    return path
  }

  const firstSegment = path.segments[0]
  const lastSegment = path.segments[path.segments.length - 1]
  if (!firstSegment || !lastSegment) {
    return path
  }

  const closingLength = distanceBetween(lastSegment.end, firstSegment.start)
  if (closingLength <= EPSILON) {
    return path
  }

  const closingSegment: PathSegment = {
    type: 'line',
    start: lastSegment.end,
    end: firstSegment.start,
    length: closingLength,
    startAnchorType: lastSegment.endAnchorType,
    endAnchorType: firstSegment.startAnchorType
  }

  return {
    ...path,
    segments: [...path.segments, closingSegment],
    totalLength: path.totalLength + closingLength
  }
}

const normalizeClosedGuardPoints = (points: SelectedSideGuardPoint[] = []) => {
  if (points.length < 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]
  return Math.hypot(first.x - last.x, first.y - last.y) <= EPSILON
    ? points.slice(0, -1)
    : points
}

const _isSharpGuardPoint = (
  guardPoints: SelectedSideGuardPoint[] | undefined,
  index: number
) => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length === 0) {
    return false
  }
  return (
    normalizedGuardPoints[index % normalizedGuardPoints.length]?.sharp === true
  )
}

const getGuardPointForSourceSegmentJoin = (
  guardPoints: SelectedSideGuardPoint[] | undefined,
  previousSegmentIndex: number,
  sourcePath: Pick<PathGeometry, 'segments'>,
  vertex: Vec2
) => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length !== sourcePath.segments.length) {
    return undefined
  }

  const guard =
    normalizedGuardPoints[
      (previousSegmentIndex + 1) % normalizedGuardPoints.length
    ]
  return guard && distanceBetween(guard, vertex) <= 0.75 ? guard : undefined
}

const buildSourceSegmentBoundary = (segment: PathSegment | undefined) =>
  segment ? slicePathSegmentPoints(segment, 0, segment.length) : []

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

const getVertexInfluenceReach = (
  currentSegment: PathSegment | undefined,
  adjacentSegment: PathSegment | undefined,
  sharedVertex: 'start' | 'end',
  strokeWidth: number
) => {
  if (!currentSegment || !adjacentSegment) {
    return Math.max(strokeWidth, 1)
  }

  const currentDirection =
    sharedVertex === 'start'
      ? getSegmentStartDirection(currentSegment)
      : getSegmentEndDirection(currentSegment)
  const adjacentDirection =
    sharedVertex === 'start'
      ? getSegmentEndDirection(adjacentSegment)
      : getSegmentStartDirection(adjacentSegment)

  if (!currentDirection || !adjacentDirection) {
    return Math.max(strokeWidth, 1)
  }

  const sine = Math.abs(
    currentDirection.x * adjacentDirection.y -
      currentDirection.y * adjacentDirection.x
  )
  const clampedSine = Math.max(sine, 0.15)

  return Math.min(strokeWidth / clampedSine, strokeWidth * 4)
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
        const intersection = lineIntersection(
          previous,
          current,
          segmentStart,
          segmentEnd
        )
        if (intersection) {
          output.push(intersection)
        }
      }
      output.push(current)
      continue
    }

    if (previousInside) {
      const intersection = lineIntersection(
        previous,
        current,
        segmentStart,
        segmentEnd
      )
      if (intersection) {
        output.push(intersection)
      }
    }
  }

  return cleanPolygon(output)
}

const chooseSideContainingReference = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  referencePoint: Vec2
): 1 | -1 => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const cross =
    dx * (referencePoint.y - segmentStart.y) -
    dy * (referencePoint.x - segmentStart.x)
  return cross >= 0 ? 1 : -1
}

const polygonCrossesBoundarySegment = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1
) => {
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
      return true
    }
  }

  return false
}

const clipPolygonToBoundarySelectedSideIfCrossing = (
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
      return polygon
    }

    const segmentStart = boundary[index]
    const segmentEnd = boundary[index + 1]
    if (
      !polygonCrossesBoundarySegment(
        currentPolygon,
        segmentStart,
        segmentEnd,
        selectedSide
      )
    ) {
      continue
    }

    const clipped = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      segmentStart,
      segmentEnd,
      selectedSide
    )
    if (
      clipped.length < 3 ||
      !isSimpleClosedPolygon(clipped) ||
      Math.abs(polygonArea(clipped)) <= EPSILON
    ) {
      return polygon
    }
    currentPolygon = clipped
  }

  return currentPolygon
}

const _clipPolygonToBoundaryContainingReferenceIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  referencePoint: Vec2
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      return polygon
    }

    const segmentStart = boundary[index]
    const segmentEnd = boundary[index + 1]
    const selectedSide = chooseSideContainingReference(
      segmentStart,
      segmentEnd,
      referencePoint
    )
    if (
      !polygonCrossesBoundarySegment(
        currentPolygon,
        segmentStart,
        segmentEnd,
        selectedSide
      )
    ) {
      continue
    }

    const clipped = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      segmentStart,
      segmentEnd,
      selectedSide
    )
    if (
      clipped.length < 3 ||
      !isSimpleClosedPolygon(clipped) ||
      Math.abs(polygonArea(clipped)) <= EPSILON
    ) {
      return polygon
    }
    currentPolygon = clipped
  }

  return currentPolygon
}

const sideFromOffsetDistance = (offsetDistance: number): 1 | -1 =>
  offsetDistance >= 0 ? 1 : -1

const clipSolidCellToAdjacentVertexBoundaries = (
  cell: OneSidedSegmentBodyCellPolygon,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentRange,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  oneSidedOffsetDistanceBySegment?: readonly number[]
) => {
  if (
    sourcePath.closed !== true ||
    sourcePath.segments.length < 2 ||
    stroke.position !== 'inside'
  ) {
    return cell.polygon
  }

  const endpointReach = Math.max(stroke.width * 1.1, 1)
  const currentSegment = sourcePath.segments[range.segmentIndex]
  const previousSegment =
    sourcePath.segments[
      (range.segmentIndex - 1 + sourcePath.segments.length) %
        sourcePath.segments.length
    ]
  const previousSegmentIndex =
    (range.segmentIndex - 1 + sourcePath.segments.length) %
    sourcePath.segments.length
  const nextSegment =
    sourcePath.segments[(range.segmentIndex + 1) % sourcePath.segments.length]
  const nextSegmentIndex = (range.segmentIndex + 1) % sourcePath.segments.length
  const startReach = Math.max(
    getVertexInfluenceReach(
      currentSegment,
      previousSegment,
      'start',
      stroke.width
    ),
    endpointReach
  )
  const endReach = Math.max(
    getVertexInfluenceReach(currentSegment, nextSegment, 'end', stroke.width),
    endpointReach
  )
  let polygon = cell.polygon

  if (cell.startDistance <= range.startDistance + startReach + EPSILON) {
    const previousSide = sideFromOffsetDistance(
      oneSidedOffsetDistanceBySegment?.[previousSegmentIndex] ??
        getSegmentSideOffsetDistance(stroke)
    )
    polygon = clipPolygonToBoundarySelectedSideIfCrossing(
      polygon,
      getBoundaryTail(buildSourceSegmentBoundary(previousSegment), startReach),
      previousSide
    )
  }

  if (cell.endDistance >= range.endDistance - endReach - EPSILON) {
    const nextSide = sideFromOffsetDistance(
      oneSidedOffsetDistanceBySegment?.[nextSegmentIndex] ??
        getSegmentSideOffsetDistance(stroke)
    )
    polygon = clipPolygonToBoundarySelectedSideIfCrossing(
      polygon,
      getBoundaryHead(buildSourceSegmentBoundary(nextSegment), endReach),
      nextSide
    )
  }

  return polygon
}

const clipSolidBodyPolygonToAdjacentVertexBoundaries = (
  polygon: Vec2[],
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentRange,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  oneSidedOffsetDistanceBySegment?: readonly number[]
) =>
  clipSolidCellToAdjacentVertexBoundaries(
    {
      polygon,
      startDistance: range.startDistance,
      endDistance: range.endDistance,
      referencePoint: normalizePoint({
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
      }),
      sourceReferencePoint: normalizePoint(polygon[0])
    },
    sourcePath,
    range,
    stroke,
    oneSidedOffsetDistanceBySegment
  )

const buildSourcePathSegmentCandidatePolygonsForRange = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentRange,
  authoredStroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width' | 'cap'
  >,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  topologyPoints: Vec2[],
  selectedSideGuardPoints?: SelectedSideGuardPoint[],
  options: {
    clipAdjacentBoundaries?: boolean
    splitOneSidedBodyIntoCells?: boolean
    maxOneSidedBodyCells?: number
    oneSidedBody?: boolean
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
    oneSidedOffsetDistanceResolver?: OneSidedOffsetDistanceResolver
  } = {}
): Vec2[][] => {
  if (range.endDistance - range.startDistance <= EPSILON) {
    return []
  }

  const rawSegmentPoints = slicePathGeometryPoints(
    sourcePath,
    range.startDistance,
    range.endDistance,
    false
  )
  if (
    options.oneSidedBody === true ||
    options.oneSidedOffsetDistance !== undefined
  ) {
    const offsetDistance =
      options.oneSidedOffsetDistanceBySegment?.[range.segmentIndex] ??
      options.oneSidedOffsetDistance ??
      getSegmentSideOffsetDistance(stroke)

    const fullBodyPolygon = buildOneSidedSegmentBodyPolygon(
      rawSegmentPoints,
      offsetDistance
    )
    const fullBodyPolygonIsUsable =
      fullBodyPolygon !== null &&
      fullBodyPolygon.length >= 3 &&
      isSimpleClosedPolygon(fullBodyPolygon) &&
      Math.abs(polygonArea(fullBodyPolygon)) > EPSILON
    const shouldUseSplitBody =
      options.splitOneSidedBodyIntoCells === true && !fullBodyPolygonIsUsable
    const chunkBodyPolygons =
      shouldUseSplitBody && options.maxOneSidedBodyCells !== undefined
        ? buildOneSidedSegmentBodyChunkPolygons(
            sourcePath,
            range,
            offsetDistance,
            options.maxOneSidedBodyCells
          ).map((cell) => cell.polygon)
        : []
    const buildCellBodyCells = () =>
      shouldUseSplitBody
        ? buildOneSidedSegmentBodyCellPolygons(
            rawSegmentPoints,
            offsetDistance,
            options.oneSidedOffsetDistanceResolver,
            range
          )
        : []
    const buildCellBodyPolygons = () =>
      buildCellBodyCells().map((cell) => cell.polygon)
    const cellBodyPolygons =
      shouldUseSplitBody && options.maxOneSidedBodyCells === undefined
        ? buildCellBodyPolygons()
        : []
    const rawBodyPolygons = fullBodyPolygonIsUsable
      ? [fullBodyPolygon]
      : chunkBodyPolygons.length > 0
        ? chunkBodyPolygons
        : cellBodyPolygons
    const clipBodyPolygons = (polygons: Vec2[][]) =>
      options.clipAdjacentBoundaries === true
        ? polygons.map((polygon) =>
            clipSolidBodyPolygonToAdjacentVertexBoundaries(
              polygon,
              sourcePath,
              range,
              stroke,
              options.oneSidedOffsetDistanceBySegment
            )
          )
        : polygons
    let bodyPolygons = clipBodyPolygons(rawBodyPolygons)
    if (
      !fullBodyPolygonIsUsable &&
      chunkBodyPolygons.length > 0 &&
      !bodyPolygonsCoverSourceSegment(bodyPolygons, rawSegmentPoints)
    ) {
      const fallbackCells = buildCellBodyCells().filter(
        (cell) =>
          !polygonListContainsPointIncludingBoundary(
            bodyPolygons,
            cell.sourceReferencePoint
          )
      )
      const compactedFallbackPolygons =
        buildCompactedOneSidedSegmentBodyCellPolygons(fallbackCells)
      const compactedBodyPolygons = [
        ...bodyPolygons,
        ...clipBodyPolygons(compactedFallbackPolygons)
      ]

      bodyPolygons = bodyPolygonsCoverSourceSegment(
        compactedBodyPolygons,
        rawSegmentPoints
      )
        ? compactedBodyPolygons
        : [
            ...bodyPolygons,
            ...clipBodyPolygons(fallbackCells.map((cell) => cell.polygon))
          ]
    }
    if (bodyPolygons.length === 0) {
      return []
    }

    return bodyPolygons.filter(
      (clippedPolygon) =>
        clippedPolygon.length >= 3 &&
        isSimpleClosedPolygon(clippedPolygon) &&
        Math.abs(polygonArea(clippedPolygon)) > EPSILON
    )
  }

  return []
}

const buildSourcePathSegmentCandidateRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  authoredStroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width' | 'cap'
  >,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  topologyPoints: Vec2[],
  selectedSideGuardPoints?: SelectedSideGuardPoint[],
  options: {
    clipAdjacentBoundaries?: boolean
    splitOneSidedBodyIntoCells?: boolean
    maxOneSidedBodyCells?: number
    oneSidedBody?: boolean
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
    oneSidedOffsetDistanceResolver?: OneSidedOffsetDistanceResolver
  } = {}
): ExactSolidCandidatePolygon[] =>
  getSourcePathSegmentRanges(sourcePath).flatMap((range) =>
    buildSourcePathSegmentCandidatePolygonsForRange(
      sourcePath,
      range,
      authoredStroke,
      stroke,
      topologyPoints,
      selectedSideGuardPoints,
      options
    )
      .filter((polygon) => polygon.length >= 3)
      .map((polygon, cellIndex) => ({
        polygon,
        role: 'segment-body' as const,
        sourceSegmentIndex: range.segmentIndex,
        sourceSpanIds: [
          `segment:${range.segmentIndex}`,
          `segment:${range.segmentIndex}:cell:${cellIndex}`
        ]
      }))
  )

const buildSourcePathVertexJoinCandidatePolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width' | 'join' | 'miterLimit'
  >,
  options: {
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
    selectedSideGuardPoints?: SelectedSideGuardPoint[]
  } = {}
): SourcePathVertexJoinCandidatePolygon[] => {
  if (!sourcePath.closed || sourcePath.segments.length < 2) {
    return []
  }

  const segmentRanges = getSourcePathSegmentRanges(sourcePath)

  return sourcePath.segments.flatMap((previousSegment, previousIndex) => {
    const nextIndex = (previousIndex + 1) % sourcePath.segments.length
    const nextSegment = sourcePath.segments[nextIndex]
    const previousRange = segmentRanges[previousIndex]
    const nextRange = segmentRanges[nextIndex]
    if (!nextSegment) {
      return []
    }
    if (!previousRange || !nextRange) {
      return []
    }

    const vertex = previousSegment.end
    const nextVertex = nextSegment.start
    if (distanceBetween(vertex, nextVertex) > 0.5) {
      return []
    }
    const guardPoint = getGuardPointForSourceSegmentJoin(
      options.selectedSideGuardPoints,
      previousIndex,
      sourcePath,
      vertex
    )

    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return []
    }
    if (
      stroke.position === 'outside' &&
      shouldRespectSmoothGuardAtSourceJoin(
        guardPoint,
        sourcePath,
        previousIndex,
        previousDirection,
        nextDirection
      )
    ) {
      return []
    }

    const previousOffset =
      options.oneSidedOffsetDistanceBySegment?.[previousIndex] ??
      options.oneSidedOffsetDistance ??
      getSegmentSideOffsetDistance(stroke)
    const nextOffset =
      options.oneSidedOffsetDistanceBySegment?.[nextIndex] ??
      options.oneSidedOffsetDistance ??
      getSegmentSideOffsetDistance(stroke)
    if (
      stroke.position !== 'outside' &&
      sideFromOffsetDistance(previousOffset) !==
        sideFromOffsetDistance(nextOffset)
    ) {
      return []
    }
    const previousStart = addPoint(vertex, scalePoint(previousDirection, -1))
    const nextEnd = addPoint(vertex, nextDirection)
    const previousOffsetStart = getOffsetPointOnLine(
      previousStart,
      previousStart,
      vertex,
      previousOffset
    )
    const previousOffsetEnd = getOffsetPointOnLine(
      vertex,
      previousStart,
      vertex,
      previousOffset
    )
    const nextOffsetStart = getOffsetPointOnLine(
      vertex,
      vertex,
      nextEnd,
      nextOffset
    )
    const nextOffsetEnd = getOffsetPointOnLine(
      nextEnd,
      vertex,
      nextEnd,
      nextOffset
    )
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
                previousOffset >=
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
        joinPoint &&
        distanceBetween(vertex, joinPoint) <=
          stroke.miterLimit *
            Math.max(Math.abs(previousOffset), Math.abs(nextOffset)) +
            EPSILON
      ) {
        polygon = [vertex, previousOffsetEnd, joinPoint, nextOffsetStart]
      }
    }

    const cleaned = cleanPolygon(polygon)
    const joinPolygon =
      cleaned.length >= 3 &&
      Math.abs(polygonArea(cleaned)) > EPSILON &&
      isSimpleClosedPolygon(cleaned)
        ? cleaned
        : null

    return joinPolygon
      ? [{ polygon: joinPolygon, sourceVertexIndex: previousIndex }]
      : []
  })
}

const buildSourcePathVertexJoinCandidateRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width' | 'join' | 'miterLimit'
  >,
  options: {
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
    selectedSideGuardPoints?: SelectedSideGuardPoint[]
  } = {}
): ExactSolidCandidatePolygon[] =>
  buildSourcePathVertexJoinCandidatePolygons(sourcePath, stroke, options).map(
    ({ polygon, sourceVertexIndex, sourceSpanIds }) => ({
      polygon,
      role: 'vertex-join' as const,
      sourceVertexIndex,
      sourceSpanIds: sourceSpanIds ?? [`vertex:${sourceVertexIndex}`]
    })
  )

const buildSourcePathSmoothJoinCandidateRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >,
  selectedSideGuardPoints: SelectedSideGuardPoint[] | undefined,
  options: {
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
  } = {}
): ExactSolidCandidatePolygon[] => {
  if (
    sourcePath.closed !== true ||
    sourcePath.segments.length < 2 ||
    stroke.position !== 'outside'
  ) {
    return []
  }

  return sourcePath.segments.flatMap((previousSegment, previousIndex) => {
    const nextIndex = (previousIndex + 1) % sourcePath.segments.length
    const nextSegment = sourcePath.segments[nextIndex]
    if (
      !nextSegment ||
      distanceBetween(previousSegment.end, nextSegment.start) > 0.5
    ) {
      return []
    }

    const guardPoint = getGuardPointForSourceSegmentJoin(
      selectedSideGuardPoints,
      previousIndex,
      sourcePath,
      previousSegment.end
    )
    if (guardPoint?.sharp !== false) {
      return []
    }
    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return []
    }
    if (
      !shouldRespectSmoothGuardAtSourceJoin(
        guardPoint,
        sourcePath,
        previousIndex,
        previousDirection,
        nextDirection
      )
    ) {
      return []
    }

    const previousOffset =
      options.oneSidedOffsetDistanceBySegment?.[previousIndex] ??
      options.oneSidedOffsetDistance ??
      getSegmentSideOffsetDistance(stroke)
    const nextOffset =
      options.oneSidedOffsetDistanceBySegment?.[nextIndex] ??
      options.oneSidedOffsetDistance ??
      getSegmentSideOffsetDistance(stroke)
    if (Math.abs(previousOffset - nextOffset) > EPSILON) {
      return []
    }

    const reach = Math.min(
      stroke.width * 1.5,
      previousSegment.length * 0.1,
      nextSegment.length * 0.1
    )
    if (reach <= EPSILON) {
      return []
    }

    const polygon = buildOneSidedSmoothJoinBodyPolygon(
      getBoundaryTail(buildSourceSegmentBoundary(previousSegment), reach),
      getBoundaryHead(buildSourceSegmentBoundary(nextSegment), reach),
      previousOffset
    )

    return polygon
      ? [
          {
            polygon,
            role: 'vertex-join' as const,
            sourceVertexIndex: previousIndex,
            sourceSpanIds: [
              `smooth-join:${previousIndex}`,
              `segment:${previousIndex}`,
              `segment:${nextIndex}`
            ]
          }
        ]
      : []
  })
}

export const buildExactArrangementCandidatePolygons = (
  topologyPoints: Vec2[],
  closed: boolean,
  stroke: ReturnType<typeof getRenderableStrokes>[number],
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  selectedSideGuardPoints?: SelectedSideGuardPoint[],
  fillRule: PathTopologyFillRule = 'evenodd'
): ExactSolidCandidatePolygon[] => {
  const candidateSourcePath =
    normalizeClosedSourcePathWithImplicitClosingSegment(
      sourcePath ?? buildPolylineGeometryModelPath(topologyPoints, closed)
    )

  if (!closed || candidateSourcePath.segments.length === 0) {
    return []
  }

  const authoredStroke = getSolidStrokeForExactCandidate({
    ...stroke,
    style: 'solid' as const
  })
  const exactCandidateStroke = authoredStroke
  const oneSidedOffsetDistanceBySegment =
    buildOneSidedOffsetDistanceBySourceSegment(
      candidateSourcePath,
      topologyPoints,
      authoredStroke,
      fillRule
    )
  const oneSidedOffsetDistanceResolver = buildOneSidedOffsetDistanceResolver(
    candidateSourcePath,
    topologyPoints,
    authoredStroke
  )
  const oneSidedOffsetDistance =
    oneSidedOffsetDistanceBySegment[0] ??
    getClosedContourSideOffsetDistance(topologyPoints, authoredStroke)
  const shouldSplitOneSidedBodyIntoCells =
    !isSimpleClosedPolygon(topologyPoints)
  const shouldClipAdjacentBoundaries = true
  const segmentCandidates = buildSourcePathSegmentCandidateRecords(
    candidateSourcePath,
    authoredStroke,
    exactCandidateStroke,
    topologyPoints,
    selectedSideGuardPoints,
    {
      clipAdjacentBoundaries: shouldClipAdjacentBoundaries,
      oneSidedBody: true,
      splitOneSidedBodyIntoCells: shouldSplitOneSidedBodyIntoCells,
      maxOneSidedBodyCells: shouldSplitOneSidedBodyIntoCells ? 11 : undefined,
      oneSidedOffsetDistance,
      oneSidedOffsetDistanceBySegment,
      oneSidedOffsetDistanceResolver
    }
  )
  const shouldEmitVertexJoinCandidates =
    !shouldSplitOneSidedBodyIntoCells || stroke.position === 'outside'
  const joinCandidates = shouldEmitVertexJoinCandidates
    ? buildSourcePathVertexJoinCandidateRecords(
        candidateSourcePath,
        exactCandidateStroke,
        {
          oneSidedOffsetDistance,
          oneSidedOffsetDistanceBySegment,
          selectedSideGuardPoints
        }
      )
    : []
  const smoothJoinCandidates =
    stroke.position === 'outside'
      ? buildSourcePathSmoothJoinCandidateRecords(
          candidateSourcePath,
          exactCandidateStroke,
          selectedSideGuardPoints,
          {
            oneSidedOffsetDistance,
            oneSidedOffsetDistanceBySegment
          }
        )
      : []

  return [...segmentCandidates, ...joinCandidates, ...smoothJoinCandidates]
}

const mapTopologyFamilyToSourceTopology = (
  topology: PathTopologyModel
): StrokeGeometrySourceTopology | undefined => {
  switch (topology.topologyFamily) {
    case 'open':
    case 'rectangle-equivalent':
    case 'broader-simple-closed':
    case 'sampled-simple-closed':
    case 'self-intersecting':
      return topology.topologyFamily
    default:
      return undefined
  }
}

const getConstrainedSolidResolutionStatus = (
  topology: PathTopologyModel
): 'exact-constrained' | 'local-side-approximation' =>
  topology.topologyFamily === 'self-intersecting'
    ? 'local-side-approximation'
    : 'exact-constrained'

const hasExactSolidMaskBackend = (
  backend: ConstrainedSolidStrokePacketOptions['exactBackend'] | undefined
): backend is NonNullable<
  ConstrainedSolidStrokePacketOptions['exactBackend']
> =>
  backend?.capabilities.union === true &&
  backend.capabilities.intersection === true &&
  backend.capabilities.difference === true

const hasRegionGeometry = (region: PolygonRegion) =>
  region.polygons.some(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )

const flattenRegionPolygons = (regions: PolygonRegion[]): Vec2[][] =>
  regions.flatMap((region) =>
    region.polygons.filter(
      (polygon) =>
        polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
    )
  )

const buildSolidMaskModelSourceSpanIds = (
  sourcePath: Pick<PathGeometry, 'segments'>
) => {
  const sourceSpanIds: string[] = []

  sourcePath.segments.forEach((segment, index) => {
    const nextSegment =
      sourcePath.segments[(index + 1) % sourcePath.segments.length]
    sourceSpanIds.push(`segment:${index}`)

    if (
      segment.endAnchorType === 'smooth' &&
      nextSegment?.startAnchorType === 'smooth'
    ) {
      sourceSpanIds.push(`smooth-join:${index}`)
      return
    }

    sourceSpanIds.push(`vertex:${index}`)
  })

  return sourceSpanIds
}

const getPreferredSolidMaskEvidenceDomain = (
  domains: ReturnType<typeof resolveStrokeDomains>['splitRangeDomains'],
  strokePosition: 'inside' | 'outside'
) => {
  const eligibleDomains = domains.filter(
    (domain) =>
      domain.sideResolutionStatus === 'resolved' &&
      domain.selectedSide !== undefined &&
      (domain.boundaryPoints?.length ?? 0) >= 2
  )

  const preferredDomains =
    strokePosition === 'inside'
      ? eligibleDomains.filter(
          (domain) => domain.boundaryRole === 'filled-face'
        )
      : eligibleDomains.filter((domain) => domain.boundaryRole === 'outer')
  const candidates =
    preferredDomains.length > 0 ? preferredDomains : eligibleDomains

  return [...candidates].sort(
    (left, right) =>
      (right.boundaryPoints?.length ?? 0) -
        (left.boundaryPoints?.length ?? 0) ||
      right.endDistance -
        right.startDistance -
        (left.endDistance - left.startDistance)
  )[0]
}

const SOURCE_CENTER_STROKE_SEGMENT_TOLERANCE = 0.75

const buildCenterStrokeSegmentBodyPolygonsForSourceSegment = (
  segment: PathSegment,
  halfWidth: number
) => {
  const sourcePoints = slicePathSegmentPoints(
    segment,
    0,
    segment.length,
    SOURCE_CENTER_STROKE_SEGMENT_TOLERANCE
  ).map(normalizePoint)
  if (sourcePoints.length < 2) {
    return []
  }

  const leftPoints = sourcePoints.map((_, index) =>
    getOffsetPointForSample(sourcePoints, index, halfWidth)
  )
  const rightPoints = sourcePoints.map((_, index) =>
    getOffsetPointForSample(sourcePoints, index, -halfWidth)
  )
  if (
    leftPoints.some((point) => point === null) ||
    rightPoints.some((point) => point === null)
  ) {
    return []
  }

  return sourcePoints.slice(0, -1).flatMap((_point, index) => {
    const leftStart = leftPoints[index]
    const leftEnd = leftPoints[index + 1]
    const rightStart = rightPoints[index]
    const rightEnd = rightPoints[index + 1]
    if (!leftStart || !leftEnd || !rightStart || !rightEnd) {
      return []
    }

    const polygon = cleanPolygon([leftStart, leftEnd, rightEnd, rightStart])
    return polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
      ? [polygon]
      : []
  })
}

const buildCenterStrokeSourceVertexJoinPolygon = (
  vertex: Vec2,
  previousDirection: Vec2,
  nextDirection: Vec2,
  offsetDistance: number,
  sweepSign: number,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'join' | 'miterLimit'
  >
) => {
  const previousStart = addPoint(vertex, scalePoint(previousDirection, -1))
  const nextEnd = addPoint(vertex, nextDirection)
  const previousOffsetStart = getOffsetPointOnLine(
    previousStart,
    previousStart,
    vertex,
    offsetDistance
  )
  const previousOffsetEnd = getOffsetPointOnLine(
    vertex,
    previousStart,
    vertex,
    offsetDistance
  )
  const nextOffsetStart = getOffsetPointOnLine(
    vertex,
    vertex,
    nextEnd,
    offsetDistance
  )
  const nextOffsetEnd = getOffsetPointOnLine(
    nextEnd,
    vertex,
    nextEnd,
    offsetDistance
  )
  if (
    !previousOffsetStart ||
    !previousOffsetEnd ||
    !nextOffsetStart ||
    !nextOffsetEnd
  ) {
    return null
  }

  let polygon =
    stroke.join === 'round'
      ? [
          vertex,
          ...buildJoinArcPoints(
            vertex,
            previousOffsetEnd,
            nextOffsetStart,
            sweepSign
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
      joinPoint &&
      distanceBetween(vertex, joinPoint) <=
        stroke.miterLimit * Math.abs(offsetDistance) + EPSILON
    ) {
      polygon = [vertex, previousOffsetEnd, joinPoint, nextOffsetStart]
    }
  }

  const cleaned = cleanPolygon(polygon)
  return cleaned.length >= 3 &&
    Math.abs(polygonArea(cleaned)) > EPSILON &&
    isSimpleClosedPolygon(cleaned)
    ? cleaned
    : null
}

const buildCenterStrokeSourceVertexJoinPolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  halfWidth: number,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'join' | 'miterLimit'
  >
) => {
  const path = normalizeClosedSourcePathWithImplicitClosingSegment(sourcePath)
  if (!path.closed || path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((previousSegment, previousIndex) => {
    const nextIndex = (previousIndex + 1) % path.segments.length
    const nextSegment = path.segments[nextIndex]
    if (
      !nextSegment ||
      distanceBetween(previousSegment.end, nextSegment.start) > 0.5
    ) {
      return []
    }

    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return []
    }

    const turn = crossPoints(previousDirection, nextDirection)
    const dot =
      previousDirection.x * nextDirection.x +
      previousDirection.y * nextDirection.y
    if (Math.abs(turn) <= EPSILON && dot > 0) {
      return []
    }

    const vertex = normalizePoint(previousSegment.end)
    const outerOffsetDistance = turn > 0 ? -halfWidth : halfWidth
    const polygon = buildCenterStrokeSourceVertexJoinPolygon(
      vertex,
      previousDirection,
      nextDirection,
      outerOffsetDistance,
      turn > 0 ? 1 : -1,
      stroke
    )
    return polygon ? [polygon] : []
  })
}

const buildSolidMaskModelSourceCenterStrokePolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'width' | 'join' | 'miterLimit'
  >
) => {
  const path = normalizeClosedSourcePathWithImplicitClosingSegment(sourcePath)
  const halfWidth = stroke.width
  const segmentPolygons = path.segments.flatMap((segment) => {
    return buildCenterStrokeSegmentBodyPolygonsForSourceSegment(
      segment,
      halfWidth
    )
  })
  const joinPolygons = buildCenterStrokeSourceVertexJoinPolygons(
    path,
    halfWidth,
    stroke
  )

  return [...segmentPolygons, ...joinPolygons]
}

interface SolidMaskModelPolygonResult {
  polygons: Vec2[][]
  maskApplication: 'render-fill-mask' | 'exact-boolean'
  visibleRender?: 'masked-source-stroke'
  coverageOracle?: 'exact-boolean' | 'render-mask'
  maskSide?: 'inside-fill' | 'outside-exterior'
  renderFillPolygons?: Vec2[][]
  renderClipPolygons?: Vec2[][]
  renderStrokeMaskPolygons?: Vec2[][]
  renderStrokePaths?: Vec2[][]
  renderStrokePathStyle?: {
    width: number
    cap: 'butt' | 'square' | 'round' | 'none'
    join: 'miter' | 'bevel' | 'round'
    miterLimit: number
  }
}

const closeSourcePathForStrokeRender = (
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>
): Vec2[][] => {
  const sampledPoints = sourcePath.sampledPoints.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
  )
  if (sampledPoints.length < 2) {
    return []
  }

  if (!sourcePath.closed) {
    return [sampledPoints.map((point) => ({ ...point }))]
  }

  const first = sampledPoints[0]
  const last = sampledPoints[sampledPoints.length - 1]
  const needsClosingPoint =
    Math.abs(first.x - last.x) > EPSILON || Math.abs(first.y - last.y) > EPSILON

  return [
    [
      ...sampledPoints.map((point) => ({ ...point })),
      ...(needsClosingPoint ? [{ ...first }] : [])
    ]
  ]
}

const buildOutsideExteriorRenderMaskPolygons = (
  strokePolygons: Vec2[][],
  fillMaskPolygons: Vec2[][],
  strokeWidth: number
): Vec2[][] => {
  const bounds = getBounds([...strokePolygons, ...fillMaskPolygons])
  const margin = Math.max(16, strokeWidth * 4)
  const outer = [
    { x: bounds.minX - margin, y: bounds.minY - margin },
    { x: bounds.maxX + margin, y: bounds.minY - margin },
    { x: bounds.maxX + margin, y: bounds.maxY + margin },
    { x: bounds.minX - margin, y: bounds.maxY + margin }
  ]
  const filledFaceCutouts = fillMaskPolygons.map((polygon) =>
    polygonArea(polygon) < 0 ? polygon : [...polygon].reverse()
  )

  return [outer, ...filledFaceCutouts]
}

const buildSolidMaskModelPolygons = ({
  topology,
  stroke,
  fillRegions,
  exactBackend,
  sourcePath
}: {
  topology: PathTopologyModel
  stroke: ReturnType<typeof getRenderableStrokes>[number]
  fillRegions: PolygonRegion[]
  exactBackend?: ConstrainedSolidStrokePacketOptions['exactBackend']
  sourcePath?: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >
}): SolidMaskModelPolygonResult | null => {
  const doubledCenterStroke = {
    ...stroke,
    style: 'solid' as const,
    position: 'center' as const,
    width: stroke.width * 2
  }
  const sourceCenterStrokePolygons = sourcePath
    ? buildSolidMaskModelSourceCenterStrokePolygons(sourcePath, stroke)
    : []
  const centerStrokePolygons =
    sourceCenterStrokePolygons.length > 0
      ? sourceCenterStrokePolygons
      : buildSolidCenterStrokePolygons(
          topology.normalizedPoints,
          topology.closed,
          doubledCenterStroke
        )
  if (centerStrokePolygons.length === 0) {
    return null
  }

  const fillMaskPolygons = flattenRegionPolygons(fillRegions)
  if (fillMaskPolygons.length === 0) {
    return null
  }

  const backend = hasExactSolidMaskBackend(exactBackend)
    ? exactBackend
    : undefined
  if (stroke.position === 'inside' && (!backend || fillRegions.length === 0)) {
    const renderStrokePaths = sourcePath
      ? closeSourcePathForStrokeRender(sourcePath)
      : []
    if (renderStrokePaths.length === 0) {
      return null
    }

    return {
      polygons: centerStrokePolygons,
      maskApplication: 'render-fill-mask',
      visibleRender: 'masked-source-stroke',
      coverageOracle: 'render-mask',
      maskSide: 'inside-fill',
      renderClipPolygons: fillMaskPolygons,
      renderStrokeMaskPolygons: centerStrokePolygons,
      renderStrokePaths,
      renderStrokePathStyle: {
        width: stroke.width * 2,
        cap: stroke.cap,
        join: stroke.join,
        miterLimit: stroke.miterLimit
      }
    }
  }
  if (!backend || fillRegions.length === 0) {
    return null
  }

  try {
    const strokeRegions = backend.union(
      centerStrokePolygons.map((polygon) => ({ polygons: [polygon] })),
      'nonzero'
    )
    const fillMaskRegions = backend.union(fillRegions, 'nonzero')
    if (
      strokeRegions.length === 0 ||
      fillMaskRegions.length === 0 ||
      !strokeRegions.some(hasRegionGeometry) ||
      !fillMaskRegions.some(hasRegionGeometry)
    ) {
      return null
    }

    if (stroke.position === 'inside') {
      const polygons = flattenRegionPolygons(strokeRegions)
      const renderStrokePaths = sourcePath
        ? closeSourcePathForStrokeRender(sourcePath)
        : []
      return polygons.length > 0
        ? {
            polygons,
            maskApplication: 'render-fill-mask',
            visibleRender: 'masked-source-stroke',
            coverageOracle: 'render-mask',
            maskSide: 'inside-fill',
            renderFillPolygons:
              renderStrokePaths.length > 0 ? undefined : polygons,
            renderClipPolygons: flattenRegionPolygons(fillMaskRegions),
            renderStrokeMaskPolygons:
              renderStrokePaths.length > 0 ? centerStrokePolygons : undefined,
            renderStrokePaths:
              renderStrokePaths.length > 0 ? renderStrokePaths : undefined,
            renderStrokePathStyle:
              renderStrokePaths.length > 0
                ? {
                    width: stroke.width * 2,
                    cap: stroke.cap,
                    join: stroke.join,
                    miterLimit: stroke.miterLimit
                  }
                : undefined
          }
        : null
    }

    const maskedRegions = backend.difference(
      strokeRegions,
      fillMaskRegions,
      'nonzero'
    )
    const normalizedRegions =
      maskedRegions.length > 0
        ? backend.union(maskedRegions, 'nonzero')
        : maskedRegions
    const polygons = flattenRegionPolygons(normalizedRegions)
    const renderStrokePaths = sourcePath
      ? closeSourcePathForStrokeRender(sourcePath)
      : []
    const renderClipPolygons =
      renderStrokePaths.length > 0
        ? buildOutsideExteriorRenderMaskPolygons(
            centerStrokePolygons,
            flattenRegionPolygons(fillMaskRegions),
            stroke.width
          )
        : undefined
    return polygons.length > 0
      ? {
          polygons,
          maskApplication: 'exact-boolean',
          visibleRender: 'masked-source-stroke',
          coverageOracle: 'exact-boolean',
          maskSide: 'outside-exterior',
          renderClipPolygons,
          renderStrokeMaskPolygons:
            renderStrokePaths.length > 0 ? centerStrokePolygons : undefined,
          renderStrokePaths:
            renderStrokePaths.length > 0 ? renderStrokePaths : undefined,
          renderStrokePathStyle:
            renderStrokePaths.length > 0
              ? {
                  width: stroke.width * 2,
                  cap: stroke.cap,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit
                }
              : undefined
        }
      : null
  } catch {
    return null
  }
}

const buildSelfIntersectingSolidMaskModelPackets = ({
  cachePrefix,
  stroke,
  strokeIndex,
  topology,
  sourcePath,
  options
}: {
  cachePrefix: string
  stroke: ReturnType<typeof getRenderableStrokes>[number]
  strokeIndex: number
  topology: PathTopologyModel
  sourcePath: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >
  options: ConstrainedSolidStrokePacketOptions
}): SolidCenterStrokeResolvedPacket[] => {
  if (
    topology.topologyFamily !== 'self-intersecting' ||
    !topology.closed ||
    (stroke.position !== 'inside' && stroke.position !== 'outside')
  ) {
    return []
  }

  const sourceFamily = measureConstrainedSolidPhase(
    'self-intersecting-source-family',
    () => resolveSourceFamily({ topology, stroke })
  )
  const strokeDomainPlan = measureConstrainedSolidPhase(
    'self-intersecting-stroke-domains',
    () =>
      resolveStrokeDomains({
        topology,
        sourceFamily,
        stroke,
        sourcePath,
        implicitFillRegions: options.implicitFillRegions,
        sharedSourceSplitRanges: options.sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
      })
  )

  if (
    strokeDomainPlan.supportState === 'blocked' ||
    strokeDomainPlan.sideAuthority !== 'implicit-fill-hole-domain' ||
    strokeDomainPlan.splitRangeDomains.length === 0
  ) {
    return []
  }

  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const ownerKey = options.metadata?.ownerKeyPrefix
    ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
    : undefined
  const strokeId = `stroke:${strokeIndex}`

  return measureConstrainedSolidPhase(
    'self-intersecting-solid-mask-model-packets',
    () => {
      const evidenceDomain = getPreferredSolidMaskEvidenceDomain(
        strokeDomainPlan.splitRangeDomains,
        stroke.position as 'inside' | 'outside'
      )
      if (!evidenceDomain) {
        return []
      }

      const solidMaskModelPolygons = buildSolidMaskModelPolygons({
        topology,
        stroke,
        fillRegions: options.implicitFillRegions ?? [],
        exactBackend: options.exactBackend,
        sourcePath
      })
      if (!solidMaskModelPolygons) {
        return []
      }
      const { polygons } = solidMaskModelPolygons

      const geometryId = `${cachePrefix}:${strokeIndex}:solid-mask`
      const evidenceLegalDomainIds = evidenceDomain.legalDomainIds ?? []
      const evidenceContourIds = evidenceDomain.contourIds ?? []
      const legalDomainIds =
        evidenceLegalDomainIds.length > 0
          ? evidenceLegalDomainIds
          : sourceFamily.legalDomainHints.legalDomainIds
      const contourIds =
        evidenceContourIds.length > 0
          ? evidenceContourIds
          : sourceFamily.legalDomainHints.contourIds
      const sourceSpanIds = buildSolidMaskModelSourceSpanIds(sourcePath)
      const revisionSet = buildStrokeRuntimeRevisionSet({
        points: topology.normalizedPoints,
        closed: topology.closed,
        stroke,
        geometryFamily: 'constrained-solid',
        resolutionStatus: 'exact-constrained',
        runtimeStatus: 'accepted',
        runtimeReason: 'constrained-solid-exact',
        ownerKey,
        networkId: options.metadata?.networkId,
        strokeId,
        sourceTopology: topology.topologyFamily,
        intervalSignature: `solid-mask:${stroke.position}`
      })

      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta: {
              sourcePathId: cachePrefix,
              ownerKey,
              networkId: options.metadata?.networkId,
              strokeId,
              strokeIndex,
              contourId,
              legalDomainId:
                legalDomainIds[0] ?? options.metadata?.legalDomainId ?? null,
              intervalId: `solid-mask:${stroke.position}`,
              sourceSpanIds,
              sourceContourIds: contourIds,
              legalDomainIds,
              startDistance: 0,
              endDistance: sourcePath.totalLength,
              wrapsSeam: true,
              figmaLikeBoundaryPoints: (
                evidenceDomain.boundaryPoints ?? []
              ).map((point) => ({ ...point })),
              figmaLikeBoundaryStartDistance:
                evidenceDomain.boundaryStartDistance,
              figmaLikeBoundaryEndDistance: evidenceDomain.boundaryEndDistance,
              figmaLikeBoundaryTotalLength: evidenceDomain.boundaryTotalLength,
              figmaLikeSideAuthority: 'implicit-fill-hole-domain',
              figmaLikeSelectedSide: evidenceDomain.selectedSide,
              figmaLikeFilledSide: evidenceDomain.filledSide,
              figmaLikeUnfilledSide: evidenceDomain.unfilledSide,
              figmaLikeBoundaryRole:
                stroke.position === 'inside' ? 'filled-face' : 'outer',
              figmaLikeSideResolutionStatus:
                evidenceDomain.sideResolutionStatus,
              geometryFamily: 'constrained-solid',
              resolutionStatus: 'exact-constrained',
              runtimeStatus: 'accepted',
              runtimeReason: 'constrained-solid-exact',
              sourceTopology: 'self-intersecting',
              topologyFamily: topology.topologyFamily,
              strokePosition: stroke.position,
              strokeWidth: stroke.width,
              strokeJoin: stroke.join,
              strokeCap: stroke.cap,
              strokeMiterLimit: stroke.miterLimit,
              solidMaskModelMaskApplication:
                solidMaskModelPolygons.maskApplication,
              solidMaskModelVisibleRender: solidMaskModelPolygons.visibleRender,
              solidMaskModelCoverageOracle:
                solidMaskModelPolygons.coverageOracle,
              solidMaskModelMaskSide: solidMaskModelPolygons.maskSide,
              solidMaskModelRenderFillPolygons:
                solidMaskModelPolygons.renderFillPolygons,
              solidMaskModelRenderClipPolygons:
                solidMaskModelPolygons.renderClipPolygons,
              solidMaskModelRenderStrokeMaskPolygons:
                solidMaskModelPolygons.renderStrokeMaskPolygons,
              solidMaskModelRenderStrokePaths:
                solidMaskModelPolygons.renderStrokePaths,
              solidMaskModelRenderStrokePathStyle:
                solidMaskModelPolygons.renderStrokePathStyle,
              visualOverlapCollapseStatus: 'exact-arrangement',
              revisionSet
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
    }
  )
}

const supportsDirectLocalSideExactTopology = (topology: PathTopologyModel) =>
  topology.topologyFamily === 'rectangle-equivalent' ||
  topology.topologyFamily === 'sampled-simple-closed'

const getDirectLocalSideSourceSpanIds = (
  entry: ReturnType<
    typeof buildClosedConstrainedStrokePolygonEntriesForSource
  >[number]
) => {
  if (entry.role === 'segment') {
    return [`segment:${entry.sourceSegmentIndex ?? entry.index}`]
  }

  const vertexIndex = entry.sourceVertexIndex ?? entry.index
  const spanIds = [`vertex:${vertexIndex}`]
  const previousSegmentIndex = entry.sourcePreviousSegmentIndex
  const nextSegmentIndex = entry.sourceNextSegmentIndex
  if (previousSegmentIndex !== undefined) {
    spanIds.push(`segment:${previousSegmentIndex}`)
  }
  if (nextSegmentIndex !== undefined) {
    spanIds.push(`segment:${nextSegmentIndex}`)
  }

  return spanIds
}

export const hasConstrainedSolidStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
      stroke.style === 'solid' &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      stroke.width > 0
  ) === true

export const buildConstrainedSolidStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedSolidStrokePacketOptions = {}
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
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const legalDomainId =
    options.metadata?.legalDomainId ?? primaryContour?.legalDomainId
  const sourceTopology = mapTopologyFamilyToSourceTopology(topology)

  if (!topology.closed) {
    const centerEquivalentStrokes = strokes?.map((stroke) => {
      const candidateFlow = resolveOneSidedCandidateFlow({
        closed: topology.closed,
        topologyFamily: topology.topologyFamily,
        stroke
      })
      if (
        stroke.visible !== false &&
        stroke.style === 'solid' &&
        candidateFlow.mode === 'center-equivalent'
      ) {
        return {
          ...stroke,
          position: 'center' as const
        }
      }

      return stroke
    })

    return buildSolidCenterStrokeResolvedPackets(
      cachePrefix,
      topologyPoints,
      false,
      centerEquivalentStrokes,
      options.metadata
        ? {
            metadata: {
              ownerKeyPrefix: options.metadata.ownerKeyPrefix,
              networkId: options.metadata.networkId
            },
            topology
          }
        : { topology }
    )
  }

  return getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsExactConstrainedSolidStroke(stroke)) {
      return []
    }

    if (
      topology.topologyFamily === 'self-intersecting' &&
      options.sourcePath &&
      ((options.sharedStrokeBoundaryDomains?.length ?? 0) > 0 ||
        (options.sharedSourceSplitRanges?.length ?? 0) > 0)
    ) {
      return buildSelfIntersectingSolidMaskModelPackets({
        cachePrefix,
        stroke,
        strokeIndex: index,
        topology,
        sourcePath: options.sourcePath,
        options
      })
    }

    const candidateMode = options.candidateMode ?? 'exact-arrangement'
    if (candidateMode === 'direct-local-side-exact') {
      if (!supportsDirectLocalSideExactTopology(topology)) {
        return []
      }

      const directLocalSideEntries =
        buildClosedConstrainedStrokePolygonEntriesForSource(
          topologyPoints,
          stroke
        )

      return directLocalSideEntries.map((entry, entryIndex) => {
        const geometryId = `${cachePrefix}:${index}:direct:${entry.role}:${entry.index}:${entryIndex}`
        const ownerKey = options.metadata?.ownerKeyPrefix
          ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
          : undefined

        return {
          geometry: {
            geometryId,
            polygons: [entry.polygon],
            bounds: getBounds([entry.polygon]),
            debugMeta: {
              sourcePathId: cachePrefix,
              ownerKey,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${index}`,
              strokeIndex: index,
              contourId,
              legalDomainId,
              strokePosition: stroke.position,
              geometryFamily: 'constrained-solid' as const,
              resolutionStatus: 'exact-constrained' as const,
              runtimeStatus: 'accepted' as const,
              runtimeReason: 'constrained-solid-exact' as const,
              visualOverlapCollapseStatus: 'exact-union' as const,
              sourceTopology,
              topologyFamily: topology.topologyFamily,
              strokeWidth: stroke.width,
              strokeJoin: stroke.join,
              strokeCap: stroke.cap,
              strokeMiterLimit: stroke.miterLimit,
              sourceSpanIds: getDirectLocalSideSourceSpanIds(entry),
              authoredVisibleIntervalIndex:
                entry.sourceSegmentIndex ??
                entry.sourceVertexIndex ??
                entry.index,
              revisionSet: buildStrokeRuntimeRevisionSet({
                points: topologyPoints,
                closed: topology.closed,
                stroke,
                geometryFamily: 'constrained-solid',
                resolutionStatus: 'exact-constrained',
                runtimeStatus: 'accepted',
                runtimeReason: 'constrained-solid-exact',
                ownerKey,
                networkId: options.metadata?.networkId,
                strokeId: `stroke:${index}`,
                sourceTopology: topology.topologyFamily,
                previewMode: 'exact'
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
      })
    }

    const exactArrangementCandidatePolygons =
      buildExactArrangementCandidatePolygons(
        topologyPoints,
        topology.closed,
        stroke,
        options.sourcePath,
        options.selectedSideGuardPoints,
        topology.fillRule
      )
    const polygons = exactArrangementCandidatePolygons.map(
      (candidate) => candidate.polygon
    )
    if (polygons.length === 0) {
      return []
    }

    const resolutionStatus = getConstrainedSolidResolutionStatus(topology)
    const runtimeStatus =
      resolutionStatus === 'exact-constrained' ? 'accepted' : 'candidate'
    const runtimeReason =
      resolutionStatus === 'exact-constrained'
        ? 'constrained-solid-exact'
        : 'local-side-constrained-solid'
    const shouldEmitArrangementCandidates =
      options.candidateMode === 'exact-arrangement'
    const candidateRecords = shouldEmitArrangementCandidates
      ? exactArrangementCandidatePolygons
      : []
    const candidatePolygons = shouldEmitArrangementCandidates
      ? exactArrangementCandidatePolygons.map((candidate) => [
          candidate.polygon
        ])
      : [polygons]

    return candidatePolygons.map((candidatePolygonGroup, candidateIndex) => {
      const candidateRecord = candidateRecords[candidateIndex]
      const geometryId =
        candidatePolygons.length === 1
          ? `${cachePrefix}:${index}`
          : `${cachePrefix}:${index}:candidate:${candidateIndex}`

      return {
        geometry: {
          geometryId,
          polygons: candidatePolygonGroup,
          bounds: getBounds(candidatePolygonGroup),
          debugMeta: {
            sourcePathId: cachePrefix,
            ownerKey: options.metadata?.ownerKeyPrefix
              ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
              : undefined,
            networkId: options.metadata?.networkId,
            strokeId: `stroke:${index}`,
            strokeIndex: index,
            contourId,
            legalDomainId,
            strokePosition: stroke.position,
            geometryFamily: 'constrained-solid',
            resolutionStatus,
            runtimeStatus,
            runtimeReason,
            sourceTopology,
            topologyFamily: topology.topologyFamily,
            strokeWidth: stroke.width,
            strokeJoin: stroke.join,
            strokeCap: stroke.cap,
            strokeMiterLimit: stroke.miterLimit,
            sourceSpanIds: candidateRecord?.sourceSpanIds,
            authoredVisibleIntervalIndex: candidateRecord?.sourceSegmentIndex,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              geometryFamily: 'constrained-solid',
              resolutionStatus,
              runtimeStatus,
              runtimeReason,
              ownerKey: options.metadata?.ownerKeyPrefix
                ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
                : undefined,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${index}`,
              sourceTopology: topology.topologyFamily
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
    })
  })
}
