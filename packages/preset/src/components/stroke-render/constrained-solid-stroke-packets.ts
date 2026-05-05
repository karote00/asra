import type { StrokeAttrs } from '@asyra/utils'
import type { GeometryBackend, PolygonRegion } from './geometry-backend'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildSolidCenterStrokeResolvedPackets,
  type SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import type { StrokeGeometrySourceTopology } from './solid-center-stroke-packets'
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
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  exactBackend?: Pick<
    GeometryBackend,
    'capabilities' | 'union' | 'difference' | 'intersection' | 'offset'
  >
  fillRule?: PathTopologyFillRule
  candidateMode?: 'exact-arrangement'
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

const distanceBetween = (a: Vec2, b: Vec2) =>
  Math.hypot(b.x - a.x, b.y - a.y)

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
  if (!isSimpleClosedPolygon(topologyPoints)) {
    return getSegmentSideOffsetDistance(stroke)
  }

  const area = polygonArea(topologyPoints)
  const outsideOffset = area >= 0 ? stroke.width : -stroke.width
  return stroke.position === 'outside' ? outsideOffset : -outsideOffset
}

const buildOneSidedOffsetDistanceBySourceSegment = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topologyPoints: Vec2[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width'
  >
) => {
  const fallbackOffsetDistance = getClosedContourSideOffsetDistance(
    topologyPoints,
    stroke
  )
  return sourcePath.segments.map(() => fallbackOffsetDistance)
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

const getSampleTangent = (
  points: Vec2[],
  index: number
): Vec2 | null => {
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

const isSharpGuardPoint = (
  guardPoints: SelectedSideGuardPoint[] | undefined,
  index: number
) => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length === 0) {
    return false
  }
  return normalizedGuardPoints[index % normalizedGuardPoints.length]?.sharp ===
    true
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

const clipPolygonToBoundaryContainingReferenceIfCrossing = (
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
    getVertexInfluenceReach(currentSegment, previousSegment, 'start', stroke.width),
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

    const bodyPolygons =
      options.splitOneSidedBodyIntoCells === true
        ? buildOneSidedSegmentBodyCellPolygons(
            rawSegmentPoints,
            offsetDistance,
            options.oneSidedOffsetDistanceResolver,
            range
          ).map((cell) =>
            clipSolidCellToAdjacentVertexBoundaries(
              cell,
              sourcePath,
              range,
              stroke,
              options.oneSidedOffsetDistanceBySegment
            )
          )
        : [
            buildOneSidedSegmentBodyPolygon(rawSegmentPoints, offsetDistance)
          ].filter((polygon): polygon is Vec2[] => polygon !== null)
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

    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
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
          stroke.miterLimit * Math.max(Math.abs(previousOffset), Math.abs(nextOffset)) +
            EPSILON
      ) {
        polygon = [vertex, previousOffsetEnd, joinPoint, nextOffsetStart]
      }
    }

    const cleaned = cleanPolygon(polygon)
    return cleaned.length >= 3 &&
      Math.abs(polygonArea(cleaned)) > EPSILON &&
      isSimpleClosedPolygon(cleaned)
      ? [{ polygon: cleaned, sourceVertexIndex: previousIndex }]
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
  } = {}
): ExactSolidCandidatePolygon[] =>
  buildSourcePathVertexJoinCandidatePolygons(
    sourcePath,
    stroke,
    options
  ).map(({ polygon, sourceVertexIndex }) => ({
    polygon,
    role: 'vertex-join' as const,
    sourceVertexIndex,
    sourceSpanIds: [`vertex:${sourceVertexIndex}`]
  }))

const buildExactArrangementCandidatePolygons = (
  topologyPoints: Vec2[],
  closed: boolean,
  stroke: ReturnType<typeof getRenderableStrokes>[number],
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
): ExactSolidCandidatePolygon[] => {
  const candidateSourcePath =
    sourcePath ?? buildPolylineGeometryModelPath(topologyPoints, closed)

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
      authoredStroke
    )
  const oneSidedOffsetDistanceResolver = buildOneSidedOffsetDistanceResolver(
    candidateSourcePath,
    topologyPoints,
    authoredStroke
  )
  const oneSidedOffsetDistance =
    oneSidedOffsetDistanceBySegment[0] ??
    getClosedContourSideOffsetDistance(topologyPoints, authoredStroke)
  const segmentCandidates = buildSourcePathSegmentCandidateRecords(
    candidateSourcePath,
    authoredStroke,
    exactCandidateStroke,
    topologyPoints,
    selectedSideGuardPoints,
    {
      clipAdjacentBoundaries: true,
      oneSidedBody: true,
      splitOneSidedBodyIntoCells: false,
      oneSidedOffsetDistance,
      oneSidedOffsetDistanceBySegment,
      oneSidedOffsetDistanceResolver
    }
  )
  const joinCandidates = buildSourcePathVertexJoinCandidateRecords(
    candidateSourcePath,
    exactCandidateStroke,
    { oneSidedOffsetDistance, oneSidedOffsetDistanceBySegment }
  )

  return [...segmentCandidates, ...joinCandidates]
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
  _topology: PathTopologyModel
): 'exact-constrained' => 'exact-constrained'

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
      if (
        stroke.visible !== false &&
        stroke.style === 'solid' &&
        (stroke.position === 'inside' || stroke.position === 'outside')
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

    const candidateMode = options.candidateMode ?? 'exact-arrangement'
    if (candidateMode !== 'exact-arrangement') {
      return []
    }

    const exactArrangementCandidatePolygons =
      buildExactArrangementCandidatePolygons(
        topologyPoints,
        topology.closed,
        stroke,
        options.sourcePath,
        options.selectedSideGuardPoints
      )
    const polygons = exactArrangementCandidatePolygons.map(
      (candidate) => candidate.polygon
    )
    if (polygons.length === 0) {
      return []
    }

    const resolutionStatus = getConstrainedSolidResolutionStatus(topology)
    const runtimeReason = 'constrained-solid-exact'
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
            runtimeStatus: 'accepted',
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
              runtimeStatus: 'accepted',
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
