import type { StrokeAttrs } from '@asyra/utils'
import type { GeometryBackend, PolygonRegion } from './geometry-backend'
import { getRenderableStrokes } from './renderable-stroke'
import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
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
import { resolveSourceFamily } from './resolved-source-family'
import { resolveStrokeDomains } from './stroke-domain-plan'
import { shouldEmitFullStrokeDiagnostics } from './stroke-diagnostics-mode'
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from './resolved-vector-geometry-model'
import type {
  EvenOddBoundaryContour,
  EvenOddLegalFaceBoundary,
  EvenOddLegalFaceBoundaryEdge
} from './self-intersecting-legal-domain'
import {
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'
import {
  buildSourceVertexJoinFootprint,
  type SourceVertexJoinFootprint
} from './source-vertex-join-footprint'

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
  implicitLegalFaceBoundaries?: EvenOddLegalFaceBoundary[]
  implicitUnfilledFaceBoundaries?: EvenOddLegalFaceBoundary[]
  implicitLegalBoundaryContours?: EvenOddBoundaryContour[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
  sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  exactBackend?: Pick<
    GeometryBackend,
    'capabilities' | 'union' | 'difference' | 'intersection' | 'offset'
  >
  fillRule?: PathTopologyFillRule
  candidateMode?: 'exact-arrangement'
  preferRenderMaskProductFinal?: boolean
}

export interface ConstrainedSolidDoubledCenterProductUnit {
  productId: string
  productFamilyId: 'constrained-solid'
  productMode: 'pre-legality-constrained-solid-doubled-center'
  geometryBasis: 'doubled-authored-center-stroke'
  polygons: Vec2[][]
  bounds: Bounds
  legalSideId: string
  strokePosition: 'inside' | 'outside'
  sourceStrokeWidth: number
  doubledCenterStrokeWidth: number
  ownerStage: 'Stroke Geometry constrained solid product assembly'
  debugMeta: {
    sourcePathId: string
    ownerKey?: string
    networkId?: string
    strokeId: string
    strokeIndex: number
    productFamilyId: 'constrained-solid'
    productMode: 'pre-legality-constrained-solid-doubled-center'
    geometryBasis: 'doubled-authored-center-stroke'
    legalSideId: string
    strokePosition: 'inside' | 'outside'
  }
}

export interface BuildConstrainedSolidDoubledCenterProductUnitsInput {
  cachePrefix: string
  points: Vec2[]
  closed: boolean
  strokes: StrokeAttrs[] | undefined
  productFamilyId: 'constrained-solid'
  legalSideId: string
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
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
  joinFootprint?: SourceVertexJoinFootprint
}

interface SourcePathVertexJoinCandidatePolygon {
  polygon: Vec2[]
  sourceVertexIndex: number
  sourceSpanIds?: string[]
  joinFootprint?: SourceVertexJoinFootprint
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

const cleanPolylinePoints = (points: Vec2[]) => {
  const deduped: Vec2[] = []
  for (const point of points.map(normalizePoint)) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push(point)
    }
  }

  return deduped
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

const getPolygonCentroid = (polygon: Vec2[]) => {
  const area = polygonArea(polygon)
  if (Math.abs(area) <= EPSILON) {
    return {
      x:
        polygon.reduce((sum, point) => sum + point.x, 0) /
        Math.max(1, polygon.length),
      y:
        polygon.reduce((sum, point) => sum + point.y, 0) /
        Math.max(1, polygon.length)
    }
  }

  let x = 0
  let y = 0
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const cross = point.x * next.y - next.x * point.y
    x += (point.x + next.x) * cross
    y += (point.y + next.y) * cross
  })

  return {
    x: x / (6 * area),
    y: y / (6 * area)
  }
}

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
  defaultOffsetDistance: number
) => {
  if (
    topologyPoints.length < 3 ||
    sourcePath.closed !== true ||
    (stroke.position !== 'inside' && stroke.position !== 'outside')
  ) {
    return defaultOffsetDistance
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
    return defaultOffsetDistance
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
  defaultOffsetDistance: number
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
          defaultOffsetDistance
        )
      : defaultOffsetDistance
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
  const defaultOffsetDistance = getClosedContourSideOffsetDistance(
    topologyPoints,
    stroke
  )

  const selfIntersectingAuthoredOffsets =
    buildSelfIntersectingAuthoredSourceSpanOffsetDistances(
      sourcePath,
      topologyPoints,
      stroke,
      fillRule,
      defaultOffsetDistance
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
          defaultOffsetDistance
        )
      : defaultOffsetDistance
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

const buildOneSidedSmoothJoinBodyPolygonWithOffsets = (
  previousBoundary: Vec2[],
  nextBoundary: Vec2[],
  previousOffsetDistance: number,
  nextOffsetDistance: number
) => {
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return null
  }

  const sharedPreviousVertex = previousBoundary[previousBoundary.length - 1]
  const sharedNextVertex = nextBoundary[0]
  if (distanceBetween(sharedPreviousVertex, sharedNextVertex) > 0.75) {
    return null
  }

  if (Math.abs(previousOffsetDistance - nextOffsetDistance) <= EPSILON) {
    return buildOneSidedSmoothJoinBodyPolygon(
      previousBoundary,
      nextBoundary,
      previousOffsetDistance
    )
  }

  const previousSourcePoints = previousBoundary.map(normalizePoint)
  const nextSourcePoints = nextBoundary.map(normalizePoint)
  const sourcePoints = [...previousSourcePoints, ...nextSourcePoints.slice(1)]
  if (sourcePoints.length < 3) {
    return null
  }

  const previousOffsetPoints = previousSourcePoints.map((_, index) =>
    getOffsetPointForSample(previousSourcePoints, index, previousOffsetDistance)
  )
  const nextOffsetPoints = nextSourcePoints.map((_, index) =>
    getOffsetPointForSample(nextSourcePoints, index, nextOffsetDistance)
  )
  if (
    previousOffsetPoints.some((point) => point === null) ||
    nextOffsetPoints.some((point) => point === null)
  ) {
    return null
  }

  const offsetBoundary = [
    ...(previousOffsetPoints as Vec2[]),
    ...(nextOffsetPoints as Vec2[]).slice(1)
  ]
  const polygon = cleanPolygon([...sourcePoints, ...offsetBoundary.reverse()])
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

const isAuthoredSmoothSourceJoin = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegment: PathSegment,
  nextSegment: PathSegment,
  previousSegmentIndex: number,
  previousDirection: Vec2,
  nextDirection: Vec2
) => {
  if (
    previousSegment.endAnchorType !== 'smooth' ||
    nextSegment.startAnchorType !== 'smooth'
  ) {
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
  sweepSign: number,
  maxAngleStep = Math.PI / 12
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

  const segmentCount = Math.max(2, Math.ceil(Math.abs(sweep) / maxAngleStep))
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

const hasAuthoredSharpSourceJoinBoundary = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed'>,
  selectedSideGuardPoints: SelectedSideGuardPoint[] | undefined
) => {
  if (!sourcePath.closed || sourcePath.segments.length < 2) {
    return false
  }

  return sourcePath.segments.some((previousSegment, previousIndex) => {
    const nextSegment =
      sourcePath.segments[(previousIndex + 1) % sourcePath.segments.length]
    if (
      !nextSegment ||
      distanceBetween(previousSegment.end, nextSegment.start) > 0.5
    ) {
      return false
    }

    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return false
    }

    if (
      isAuthoredSmoothSourceJoin(
        sourcePath,
        previousSegment,
        nextSegment,
        previousIndex,
        previousDirection,
        nextDirection
      )
    ) {
      return false
    }

    const guardPoint = getGuardPointForSourceSegmentJoin(
      selectedSideGuardPoints,
      previousIndex,
      sourcePath,
      previousSegment.end
    )

    return !shouldRespectSmoothGuardAtSourceJoin(
      guardPoint,
      sourcePath,
      previousIndex,
      previousDirection,
      nextDirection
    )
  })
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
      const supplementalCells = buildCellBodyCells().filter(
        (cell) =>
          !polygonListContainsPointIncludingBoundary(
            bodyPolygons,
            cell.sourceReferencePoint
          )
      )
      const compactedSupplementalPolygons =
        buildCompactedOneSidedSegmentBodyCellPolygons(supplementalCells)
      const compactedBodyPolygons = [
        ...bodyPolygons,
        ...clipBodyPolygons(compactedSupplementalPolygons)
      ]

      bodyPolygons = bodyPolygonsCoverSourceSegment(
        compactedBodyPolygons,
        rawSegmentPoints
      )
        ? compactedBodyPolygons
        : [
            ...bodyPolygons,
            ...clipBodyPolygons(supplementalCells.map((cell) => cell.polygon))
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
    'position' | 'width' | 'join' | 'miterAngle'
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
    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return []
    }
    const guardPoint = getGuardPointForSourceSegmentJoin(
      options.selectedSideGuardPoints,
      previousIndex,
      sourcePath,
      vertex
    )
    if (
      isAuthoredSmoothSourceJoin(
        sourcePath,
        previousSegment,
        nextSegment,
        previousIndex,
        previousDirection,
        nextDirection
      )
    ) {
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
    const previousTangentPoint = addPoint(
      vertex,
      scalePoint(previousDirection, -1)
    )
    const nextTangentPoint = addPoint(vertex, nextDirection)
    const joinFootprint = buildSourceVertexJoinFootprint({
      vertex,
      previousPoint: previousTangentPoint,
      nextPoint: nextTangentPoint,
      strokeWidth: stroke.width,
      offsetDistance: Math.max(Math.abs(previousOffset), Math.abs(nextOffset)),
      side: previousOffset >= 0 ? 'left' : 'right',
      authoredJoin: stroke.join,
      miterAngle: stroke.miterAngle,
      ownerId: `constrained-solid:source-vertex:${previousIndex}`,
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
    })
    const polygon = joinFootprint.polygon

    const cleaned = cleanPolygon(polygon)
    const joinPolygon =
      cleaned.length >= 3 &&
      Math.abs(polygonArea(cleaned)) > EPSILON &&
      isSimpleClosedPolygon(cleaned)
        ? cleaned
        : null

    return joinPolygon
      ? [
          {
            polygon: joinPolygon,
            sourceVertexIndex: previousIndex,
            joinFootprint
          }
        ]
      : []
  })
}

const buildSourcePathVertexJoinCandidateRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'position' | 'width' | 'join' | 'miterAngle'
  >,
  options: {
    oneSidedOffsetDistance?: number
    oneSidedOffsetDistanceBySegment?: readonly number[]
    selectedSideGuardPoints?: SelectedSideGuardPoint[]
  } = {}
): ExactSolidCandidatePolygon[] =>
  buildSourcePathVertexJoinCandidatePolygons(sourcePath, stroke, options).map(
    ({ joinFootprint, polygon, sourceVertexIndex, sourceSpanIds }) => ({
      polygon,
      role: 'vertex-join' as const,
      sourceVertexIndex,
      sourceSpanIds: sourceSpanIds ?? [`vertex:${sourceVertexIndex}`],
      joinFootprint
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
    const previousDirection = getSegmentEndDirection(previousSegment)
    const nextDirection = getSegmentStartDirection(nextSegment)
    if (!previousDirection || !nextDirection) {
      return []
    }
    const hasAuthoredSmoothJoin = isAuthoredSmoothSourceJoin(
      sourcePath,
      previousSegment,
      nextSegment,
      previousIndex,
      previousDirection,
      nextDirection
    )
    if (guardPoint?.sharp === true) {
      return []
    }
    if (!hasAuthoredSmoothJoin && guardPoint?.sharp !== false) {
      return []
    }
    if (
      !hasAuthoredSmoothJoin &&
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
    const reach = Math.min(
      stroke.width * 1.5,
      previousSegment.length * 0.1,
      nextSegment.length * 0.1
    )
    if (reach <= EPSILON) {
      return []
    }

    const polygon = buildOneSidedSmoothJoinBodyPolygonWithOffsets(
      getBoundaryTail(buildSourceSegmentBoundary(previousSegment), reach),
      getBoundaryHead(buildSourceSegmentBoundary(nextSegment), reach),
      previousOffset,
      nextOffset
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
  fillRule: PathTopologyFillRule = 'nonzero'
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

interface ExactSolidCandidateOwnerPartition {
  candidateRecord: ExactSolidCandidatePolygon
  candidateIndex: number
  polygons: Vec2[][]
}

const buildExactArrangementCandidateOwnerPartitions = ({
  candidateRecords,
  backend,
  excludeRegions = []
}: {
  candidateRecords: ExactSolidCandidatePolygon[]
  backend: NonNullable<ConstrainedSolidStrokePacketOptions['exactBackend']>
  excludeRegions?: PolygonRegion[]
}): ExactSolidCandidateOwnerPartition[] => {
  const materializedCandidates = candidateRecords.flatMap(
    (candidateRecord, candidateIndex) => {
      const candidateRegions = [{ polygons: [candidateRecord.polygon] }]
      const legalRegions =
        excludeRegions.length > 0
          ? backend.difference(candidateRegions, excludeRegions, 'nonzero')
          : candidateRegions
      const normalizedRegions =
        legalRegions.length > 0
          ? backend.union(legalRegions, 'nonzero')
          : legalRegions

      return normalizedRegions.some(hasRegionGeometry)
        ? [
            {
              candidateRecord,
              candidateIndex,
              regions: normalizedRegions
            }
          ]
        : []
    }
  )

  const prioritizedCandidates = [
    ...materializedCandidates.filter(
      ({ candidateRecord }) => candidateRecord.role === 'vertex-join'
    ),
    ...materializedCandidates.filter(
      ({ candidateRecord }) => candidateRecord.role !== 'vertex-join'
    )
  ]
  let claimedRegions: PolygonRegion[] = []

  return prioritizedCandidates.flatMap(
    ({ candidateRecord, candidateIndex, regions }) => {
      const ownerRegions =
        claimedRegions.length > 0
          ? backend.difference(regions, claimedRegions, 'nonzero')
          : regions
      const normalizedOwnerRegions =
        ownerRegions.length > 0
          ? backend.union(ownerRegions, 'nonzero')
          : ownerRegions
      const polygons = flattenRegionPolygons(normalizedOwnerRegions)

      if (polygons.length > 0) {
        claimedRegions = backend
          .union([...claimedRegions, ...normalizedOwnerRegions], 'nonzero')
          .filter(hasRegionGeometry)
      }

      return polygons.length > 0
        ? [
            {
              candidateRecord,
              candidateIndex,
              polygons
            }
          ]
        : []
    }
  )
}

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

const SOURCE_CENTER_STROKE_SEGMENT_TOLERANCE = 0.25

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

const _buildCenterStrokeSourceVertexMaskJoinPolygons = (
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
    return [-halfWidth, halfWidth].flatMap((offsetDistance) => {
      const polygon = buildCenterStrokeSourceVertexJoinPolygon(
        vertex,
        previousDirection,
        nextDirection,
        offsetDistance,
        offsetDistance < 0 ? 1 : -1,
        stroke
      )
      return polygon ? [polygon] : []
    })
  })
}

const buildCenterStrokeSourceVertexCoverageMaskPolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  strokeWidth: number,
  radiusScale = 1.25,
  sides = 16
) => {
  const path = normalizeClosedSourcePathWithImplicitClosingSegment(sourcePath)
  if (!path.closed || path.segments.length < 2) {
    return []
  }

  const vertices = new Map<string, Vec2>()
  path.segments.forEach((segment) => {
    const vertex = normalizePoint(segment.start)
    vertices.set(`${vertex.x.toFixed(3)}:${vertex.y.toFixed(3)}`, vertex)
  })

  const radius = Math.max(strokeWidth * radiusScale, strokeWidth + 1)
  return [...vertices.values()].map((vertex) =>
    Array.from({ length: sides }, (_unused, index) => {
      const angle = (Math.PI * 2 * index) / sides
      return {
        x: vertex.x + Math.cos(angle) * radius,
        y: vertex.y + Math.sin(angle) * radius
      }
    })
  )
}

const buildSolidMaskModelSourceCenterStrokePolygons = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'width' | 'join' | 'miterAngle' | 'miterLimit'
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

  return [...segmentPolygons, ...joinPolygons].map((polygon) =>
    polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon
  )
}

const buildExactOffsetSourceCenterStrokeRegions = (
  backend: Pick<GeometryBackend, 'offset' | 'union'>,
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>,
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'width' | 'join' | 'cap' | 'miterLimit'
  >,
  fillRule: PathTopologyFillRule = 'evenodd'
) => {
  const offsetRegions = backend.offset(sourcePath.sampledPoints, stroke.width, {
    width: stroke.width * 2,
    join: stroke.join,
    cap: stroke.cap,
    closed: sourcePath.closed,
    miterLimit: stroke.miterLimit,
    fillRule
  })

  return offsetRegions.length > 0 ? backend.union(offsetRegions, fillRule) : []
}

const buildOutsideSmoothJoinRenderClipPolygons = (
  sourcePath: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >,
  topologyPoints: Vec2[],
  stroke: ReturnType<typeof getRenderableStrokes>[number],
  selectedSideGuardPoints: SelectedSideGuardPoint[] | undefined,
  fillRule: PathTopologyFillRule
) =>
  (() => {
    const candidateSourcePath =
      normalizeClosedSourcePathWithImplicitClosingSegment(sourcePath)
    if (
      !candidateSourcePath.closed ||
      candidateSourcePath.segments.length < 2
    ) {
      return []
    }

    const authoredStroke = getSolidStrokeForExactCandidate({
      ...stroke,
      style: 'solid' as const
    })
    const oneSidedOffsetDistanceBySegment =
      buildOneSidedOffsetDistanceBySourceSegment(
        candidateSourcePath,
        topologyPoints,
        authoredStroke,
        fillRule
      )
    const oneSidedOffsetDistance =
      oneSidedOffsetDistanceBySegment[0] ??
      getClosedContourSideOffsetDistance(topologyPoints, authoredStroke)

    return buildSourcePathSmoothJoinCandidateRecords(
      candidateSourcePath,
      authoredStroke,
      selectedSideGuardPoints,
      {
        oneSidedOffsetDistance,
        oneSidedOffsetDistanceBySegment
      }
    ).map((candidate) =>
      polygonArea(candidate.polygon) < 0
        ? [...candidate.polygon].reverse()
        : candidate.polygon
    )
  })()

const _buildJoinReactiveInsideFaceCornerNeighborhoodPolygons = (
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  strokeWidth: number
) => {
  const faceNodeJoinTolerance = Math.max(1e-4, strokeWidth * 0.12)
  const radius = Math.max(strokeWidth * 3.5, strokeWidth + 1)
  const sides = 48
  const centers: Vec2[] = []
  const seen = new Set<string>()
  const getHighDegreeVertexKey = (point: Vec2) =>
    `${point.x.toFixed(2)}:${point.y.toFixed(2)}`
  const isJoinReactiveInsideFace = (face: EvenOddLegalFaceBoundary) => {
    const sharedEdgeCount = face.edges.filter(
      (edge) => edge.oppositeFaceLegal
    ).length
    const highDegreeVertices = new Set<string>()
    face.edges.forEach((edge) => {
      ;[
        { point: edge.start, degree: edge.startNodeDegree },
        { point: edge.end, degree: edge.endNodeDegree }
      ].forEach(({ point, degree }) => {
        if (degree > 2) {
          highDegreeVertices.add(getHighDegreeVertexKey(point))
        }
      })
    })

    return (
      sharedEdgeCount >= 5 &&
      sharedEdgeCount / Math.max(1, face.edges.length) >= 0.8 &&
      highDegreeVertices.size >= 5
    )
  }

  legalFaceBoundaries.forEach((face) => {
    if (!isJoinReactiveInsideFace(face)) {
      return
    }

    face.edges.forEach((previousEdge, edgeIndex) => {
      const nextEdge = face.edges[(edgeIndex + 1) % face.edges.length]
      if (
        !nextEdge ||
        !previousEdge.oppositeFaceLegal ||
        !nextEdge.oppositeFaceLegal ||
        Math.hypot(
          previousEdge.end.x - nextEdge.start.x,
          previousEdge.end.y - nextEdge.start.y
        ) > faceNodeJoinTolerance ||
        (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
      ) {
        return
      }

      const center = {
        x: (previousEdge.end.x + nextEdge.start.x) / 2,
        y: (previousEdge.end.y + nextEdge.start.y) / 2
      }
      const key = getHighDegreeVertexKey(center)
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      centers.push(center)
    })
  })

  return centers.map((center) =>
    Array.from({ length: sides }, (_unused, index) => {
      const angle = (Math.PI * 2 * index) / sides
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      }
    })
  )
}

interface SolidMaskModelPolygonResult {
  polygons: Vec2[][]
  maskApplication: 'render-fill-mask' | 'exact-boolean'
  visibleRender?: 'masked-source-stroke'
  coverageOracle?: 'exact-boolean' | 'render-mask'
  maskSide?: 'inside-fill' | 'outside-exterior'
  insideMaskMode?: 'face-occupancy-inside-fill'
  visibleMaskMode?: 'inside-fill-source-stroke-clip'
  joinGeometrySource?: 'authored-doubled-source-stroke'
  internalCornerJoinMode?: 'stroke-join-aware-face-corner'
  joinEligibilityMode?: 'internal-face-only'
  adjacencyProbe?: string[]
  faceOwnershipTrace?: {
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
  renderClipPolygons?: Vec2[][]
  renderFillClipPolygons?: Vec2[][]
  renderStrokeMaskPolygons?: Vec2[][]
  renderStrokePaths?: Vec2[][]
  renderStrokePathGroups?: {
    clipPolygons: Vec2[][]
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
  renderStrokePathStyle?: {
    width: number
    cap: 'butt' | 'square' | 'round'
    join: 'miter' | 'bevel' | 'round'
    miterAngle: number
    miterLimit: number
    closed?: boolean
  }
}

const closeSourcePathForStrokeRender = (
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>
): Vec2[][] => {
  const sampledPoints = sourcePath.sampledPoints
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .reduce<Vec2[]>((points, point) => {
      const previous = points[points.length - 1]
      if (previous && distanceBetween(previous, point) <= EPSILON) {
        return points
      }
      points.push({ ...point })
      return points
    }, [])
  if (sampledPoints.length < 2) {
    return []
  }

  if (!sourcePath.closed) {
    return [sampledPoints]
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

const isVisibleInsideStrokeFaceBoundary = (face: EvenOddLegalFaceBoundary) =>
  face.edges.some(
    (edge) =>
      edge.oppositeFaceLegal ||
      edge.startNodeDegree > 2 ||
      edge.endNodeDegree > 2
  )

const getNormalizedInsideFacePolygon = (
  face: EvenOddLegalFaceBoundary
): Vec2[] | null => {
  const facePolygon = cleanPolygon(face.points.map(normalizePoint))
  if (facePolygon.length < 3 || Math.abs(polygonArea(facePolygon)) <= EPSILON) {
    return null
  }
  return polygonArea(facePolygon) < 0 ? [...facePolygon].reverse() : facePolygon
}

const closePathPointsForStrokeRender = (points: Vec2[]): Vec2[][] => {
  const cleaned = cleanPolylinePoints(points.map(normalizePoint))
  if (cleaned.length < 2) {
    return []
  }
  const first = cleaned[0]
  const last = cleaned[cleaned.length - 1]
  return distanceBetween(first, last) <= EPSILON
    ? [cleaned]
    : [[...cleaned, { ...first }]]
}

const buildInsideAdjacencyStrokePathGroups = (
  legalBoundaryContours: EvenOddBoundaryContour[],
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'width' | 'join' | 'miterAngle' | 'miterLimit'
  >
): {
  clipPolygons: Vec2[][]
  strokePaths: Vec2[][]
  strokePathStyle: {
    width: number
    cap: 'butt'
    join: 'miter' | 'bevel' | 'round'
    miterAngle: number
    miterLimit: number
    closed: true
  }
}[] => {
  const boundaryGroups = legalBoundaryContours.flatMap((contour) =>
    closePathPointsForStrokeRender(contour.points).map((strokePath) => ({
      clipPolygons: [strokePath],
      strokePaths: [strokePath],
      strokePathStyle: {
        width: stroke.width * 2,
        cap: 'butt' as const,
        join: stroke.join,
        miterAngle: stroke.miterAngle,
        miterLimit: stroke.miterLimit,
        closed: true as const
      }
    }))
  )

  const faceStrokeGroups = legalFaceBoundaries.flatMap((face) => {
    if (!isVisibleInsideStrokeFaceBoundary(face)) {
      return []
    }
    const normalizedFacePolygon = getNormalizedInsideFacePolygon(face)
    if (!normalizedFacePolygon) {
      return []
    }
    return closePathPointsForStrokeRender(normalizedFacePolygon).map(
      (strokePath) => ({
        clipPolygons: [normalizedFacePolygon],
        strokePaths: [strokePath],
        strokePathStyle: {
          width: stroke.width,
          cap: 'butt' as const,
          join: stroke.join,
          miterAngle: stroke.miterAngle,
          miterLimit: stroke.miterLimit,
          closed: true as const
        }
      })
    )
  })

  return [...boundaryGroups, ...faceStrokeGroups]
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
  const filledFaceCutouts = fillMaskPolygons.map((polygon) => {
    const clippedPolygon = cleanPolylinePoints(polygon)
    return polygonArea(clippedPolygon) < 0
      ? clippedPolygon
      : [...clippedPolygon].reverse()
  })

  return [outer, ...filledFaceCutouts]
}

const INSIDE_SOLID_ADJACENCY_PROBES = [
  'internal-pentagon-shared-edge-half-width',
  'normal-width-comparison-edge',
  'internal-pentagon-endpoint-protrusion',
  'shared-boundary-width-transition',
  'all-internal-shared-edges-half-width',
  'top-triangle-mask-integrity',
  'all-internal-pentagon-corner-protrusions',
  'inside-solid-lower-left-high-curvature-no-gap',
  'inside-solid-lower-right-high-curvature-no-gap',
  'inside-solid-outer-source-vertices-no-gap',
  'all-internal-pentagon-corner-join-shapes',
  'internal-pentagon-corner-join-shapes-only',
  'outer-triangle-corners-join-invariant',
  'non-pentagon-mask-corners-no-miter-spikes',
  'internal-pentagon-bevel-corners-no-overreach-crack',
  'internal-pentagon-round-corners-smooth',
  'internal-pentagon-round-corners-source-envelope'
]

const INSIDE_SOLID_RENDER_MASK_PROBES = [
  'top-triangle-mask-integrity',
  'inside-solid-outer-source-vertices-no-gap'
]

const INSIDE_SOLID_FACE_OWNERSHIP_PROBES = INSIDE_SOLID_ADJACENCY_PROBES.filter(
  (probe) =>
    !INSIDE_SOLID_RENDER_MASK_PROBES.includes(probe) &&
    ![
      'all-internal-pentagon-corner-join-shapes',
      'internal-pentagon-corner-join-shapes-only',
      'outer-triangle-corners-join-invariant',
      'non-pentagon-mask-corners-no-miter-spikes',
      'internal-pentagon-bevel-corners-no-overreach-crack',
      'internal-pentagon-round-corners-smooth',
      'internal-pentagon-round-corners-source-envelope'
    ].includes(probe)
)

const INSIDE_SOLID_INTERNAL_CORNER_JOIN_PROBES = [
  'all-internal-pentagon-corner-join-shapes',
  'internal-pentagon-corner-join-shapes-only',
  'outer-triangle-corners-join-invariant',
  'non-pentagon-mask-corners-no-miter-spikes',
  'internal-pentagon-bevel-corners-no-overreach-crack',
  'internal-pentagon-round-corners-smooth',
  'internal-pentagon-round-corners-source-envelope'
]

const buildInsideSolidAdjacencyProbeNames = (
  faceOwnershipTrace: NonNullable<
    SolidMaskModelPolygonResult['faceOwnershipTrace']
  >,
  internalCornerJoinPolygonCount: number
) => [
  ...INSIDE_SOLID_RENDER_MASK_PROBES,
  ...(faceOwnershipTrace.length > 0 ? INSIDE_SOLID_FACE_OWNERSHIP_PROBES : []),
  ...(internalCornerJoinPolygonCount > 0
    ? INSIDE_SOLID_INTERNAL_CORNER_JOIN_PROBES
    : [])
]

const getJoinReactiveCornerEnvelopeRadius = (ownedWidth: number) => ownedWidth

const getJoinReactiveCornerTrimRadius = (ownedWidth: number) =>
  getJoinReactiveCornerEnvelopeRadius(ownedWidth)

const getJoinReactiveCornerRenderTrimRadius = (ownedWidth: number) =>
  getJoinReactiveCornerEnvelopeRadius(ownedWidth)

const buildFaceOwnedInsideMaskPolygons = (
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  stroke: Pick<
    ReturnType<typeof getRenderableStrokes>[number],
    'width' | 'join' | 'miterLimit'
  >,
  sourcePath?: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >
): {
  polygons: Vec2[][]
  faceOwnershipTrace: NonNullable<
    SolidMaskModelPolygonResult['faceOwnershipTrace']
  >
  internalCornerJoinPolygonCount: number
  internalCornerJoinPolygons: Vec2[][]
  internalCornerClipPolygons: Vec2[][]
  internalCornerVertices: Vec2[]
  renderClipPolygons: Vec2[][]
  renderClipVertexSanitizers: {
    vertex: Vec2
    direction: Vec2
    sideDirection: Vec2
  }[]
  postFillJoinRenderClipPolygons: Vec2[][]
  sourceMaskPolygons: Vec2[][]
} | null => {
  const strokeWidth = stroke.width
  const polygons: Vec2[][] = []
  const internalCornerJoinPolygons: Vec2[][] = []
  const internalCornerClipPolygons: Vec2[][] = []
  const internalCornerVertices: Vec2[] = []
  const renderClipPolygons: Vec2[][] = []
  const renderClipVertexSanitizers: {
    vertex: Vec2
    direction: Vec2
    sideDirection: Vec2
  }[] = []
  const postFillJoinRenderClipPolygons: Vec2[][] = []
  const sourceMaskPolygons: Vec2[][] = []
  let internalCornerJoinPolygonCount = 0
  const faceOwnershipTrace: NonNullable<
    SolidMaskModelPolygonResult['faceOwnershipTrace']
  > = []
  const minMaskEdgeLength = Math.min(0.75, Math.max(0.25, strokeWidth * 0.075))
  const faceNodeJoinTolerance = Math.max(1e-4, strokeWidth * 0.12)
  const pushValidPolygon = (target: Vec2[][], polygon: Vec2[]) => {
    if (polygon.length < 3) {
      return
    }
    const area = polygonArea(polygon)
    if (Math.abs(area) <= EPSILON) {
      return
    }
    const normalizedPolygon = area < 0 ? [...polygon].reverse() : polygon
    target.push(normalizedPolygon)
  }

  const appendMaskPolygon = (
    polygon: Vec2[],
    options?: { clipOnly?: boolean }
  ) => {
    if (polygon.length < 3) {
      return
    }
    const area = polygonArea(polygon)
    if (Math.abs(area) <= EPSILON) {
      return
    }
    const normalizedPolygon = area < 0 ? [...polygon].reverse() : polygon
    polygons.push(normalizedPolygon)
    if (!options?.clipOnly) {
      sourceMaskPolygons.push(normalizedPolygon)
    }
  }

  const appendRenderClipPolygon = (polygon: Vec2[]) => {
    pushValidPolygon(renderClipPolygons, polygon)
  }

  const _trimPolylineStart = (points: Vec2[], trimDistance: number) => {
    if (points.length < 2 || trimDistance <= EPSILON) {
      return points
    }

    const trimmed: Vec2[] = []
    let remaining = trimDistance
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      const length = distanceBetween(start, end)
      if (length <= EPSILON) {
        continue
      }
      if (remaining > length) {
        remaining -= length
        continue
      }
      const ratio = remaining / length
      trimmed.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      })
      trimmed.push(...points.slice(index + 1).map((point) => ({ ...point })))
      break
    }

    return trimmed.length >= 2 ? trimmed : []
  }

  const getEdgeMaskGeometry = (edge: EvenOddLegalFaceBoundaryEdge) => {
    const dx = edge.end.x - edge.start.x
    const dy = edge.end.y - edge.start.y
    const length = Math.hypot(dx, dy)
    if (length <= EPSILON) {
      return null
    }

    const tangent = { x: dx / length, y: dy / length }
    const legalNormal =
      edge.legalSide === 'left'
        ? { x: -tangent.y, y: tangent.x }
        : { x: tangent.y, y: -tangent.x }
    const ownedWidth = edge.oppositeFaceLegal ? strokeWidth * 0.5 : strokeWidth
    const offsetStart = {
      x: edge.start.x + legalNormal.x * ownedWidth,
      y: edge.start.y + legalNormal.y * ownedWidth
    }
    const offsetEnd = {
      x: edge.end.x + legalNormal.x * ownedWidth,
      y: edge.end.y + legalNormal.y * ownedWidth
    }

    return {
      edge,
      length,
      tangent,
      legalNormal,
      ownedWidth,
      offsetStart,
      offsetEnd
    }
  }

  const getStableJoinReactiveFaceDirection = (
    face: EvenOddLegalFaceBoundary,
    previousEdgeIndex: number,
    direction: 'previous' | 'next',
    defaultDirection: Vec2
  ) => {
    const edgeCount = face.edges.length
    if (edgeCount === 0) {
      return normalizeVector(defaultDirection)
    }

    const nextEdgeIndex = (previousEdgeIndex + 1) % edgeCount
    const baseIndex =
      direction === 'previous' ? previousEdgeIndex : nextEdgeIndex
    const baseEdge = face.edges[baseIndex]
    if (!baseEdge) {
      return normalizeVector(defaultDirection)
    }

    const anchor = direction === 'previous' ? baseEdge.end : baseEdge.start
    let totalLength = 0
    let farPoint = direction === 'previous' ? baseEdge.start : baseEdge.end
    const minimumStableLength = Math.max(strokeWidth * 1.35, 8)

    for (let step = 0; step < edgeCount; step += 1) {
      const cursorIndex =
        direction === 'previous'
          ? (baseIndex - step + edgeCount) % edgeCount
          : (baseIndex + step) % edgeCount
      const edge = face.edges[cursorIndex]
      if (!edge) {
        break
      }
      if (
        edge.oppositeFaceLegal !== baseEdge.oppositeFaceLegal ||
        edge.legalSide !== baseEdge.legalSide ||
        edge.sourceSegmentIndex !== baseEdge.sourceSegmentIndex
      ) {
        break
      }

      const length = distanceBetween(edge.start, edge.end)
      if (length <= EPSILON) {
        continue
      }

      totalLength += length
      farPoint = direction === 'previous' ? edge.start : edge.end
      if (totalLength >= minimumStableLength) {
        break
      }
    }

    const stableDirection = normalizeVector({
      x:
        direction === 'previous'
          ? anchor.x - farPoint.x
          : farPoint.x - anchor.x,
      y:
        direction === 'previous' ? anchor.y - farPoint.y : farPoint.y - anchor.y
    })
    return stableDirection ?? normalizeVector(defaultDirection)
  }

  const getHighDegreeVertexKey = (point: Vec2) =>
    `${point.x.toFixed(2)}:${point.y.toFixed(2)}`

  const isJoinReactiveInsideFace = (face: EvenOddLegalFaceBoundary) => {
    const sharedEdgeCount = face.edges.filter(
      (edge) => edge.oppositeFaceLegal
    ).length
    const highDegreeVertices = new Set<string>()
    face.edges.forEach((edge) => {
      ;[
        { point: edge.start, degree: edge.startNodeDegree },
        { point: edge.end, degree: edge.endNodeDegree }
      ].forEach(({ point, degree }) => {
        if (degree > 2) {
          highDegreeVertices.add(getHighDegreeVertexKey(point))
        }
      })
    })

    return (
      sharedEdgeCount >= 5 &&
      sharedEdgeCount / Math.max(1, face.edges.length) >= 0.8 &&
      highDegreeVertices.size >= 5
    )
  }

  const joinReactiveFaceIds = new Set(
    legalFaceBoundaries
      .filter((face) => isJoinReactiveInsideFace(face))
      .map((face) => face.faceId)
  )

  const isSharedWithJoinReactiveInsideFace = (
    edge: EvenOddLegalFaceBoundaryEdge
  ) =>
    edge.oppositeFaceLegal &&
    edge.oppositeFaceId !== null &&
    joinReactiveFaceIds.has(edge.oppositeFaceId)

  const appendTrace = (
    edge: EvenOddLegalFaceBoundaryEdge,
    faceId: string,
    faceJoinEligibility: 'join-reactive' | 'mask-only'
  ) => {
    faceOwnershipTrace.push({
      sourceSegmentIndex: edge.sourceSegmentIndex,
      sourceStartDistance: edge.sourceStartDistance,
      sourceEndDistance: edge.sourceEndDistance,
      start: { ...edge.start },
      end: { ...edge.end },
      startNodeDegree: edge.startNodeDegree,
      endNodeDegree: edge.endNodeDegree,
      faceId,
      oppositeFaceId: edge.oppositeFaceId,
      adjacencySide: edge.legalSide,
      oppositeFaceLegal: edge.oppositeFaceLegal,
      faceJoinEligibility,
      maskMode: 'face-occupancy-inside-fill'
    })
  }

  const getJoinReactiveCornerVertices = () => {
    const vertices: {
      vertex: Vec2
      sourceSegmentIndices: Set<number>
      trimRadius: number
    }[] = []
    const seen = new Set<string>()

    legalFaceBoundaries.forEach((face) => {
      if (!isJoinReactiveInsideFace(face)) {
        return
      }

      face.edges.forEach((previousEdge, edgeIndex) => {
        const nextEdge = face.edges[(edgeIndex + 1) % face.edges.length]
        if (
          !nextEdge ||
          !previousEdge.oppositeFaceLegal ||
          !nextEdge.oppositeFaceLegal ||
          Math.hypot(
            previousEdge.end.x - nextEdge.start.x,
            previousEdge.end.y - nextEdge.start.y
          ) > faceNodeJoinTolerance ||
          (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
        ) {
          return
        }

        const vertex = {
          x: (previousEdge.end.x + nextEdge.start.x) / 2,
          y: (previousEdge.end.y + nextEdge.start.y) / 2
        }
        const key = getHighDegreeVertexKey(vertex)
        if (seen.has(key)) {
          return
        }
        seen.add(key)
        vertices.push({
          vertex,
          sourceSegmentIndices: new Set(
            [
              previousEdge.sourceSegmentIndex,
              nextEdge.sourceSegmentIndex
            ].filter((index): index is number => index !== undefined)
          ),
          trimRadius: getJoinReactiveCornerTrimRadius(strokeWidth)
        })
      })
    })

    return vertices
  }

  const joinReactiveCornerVertices = getJoinReactiveCornerVertices()

  const getSegmentCircleExitDistance = (
    start: Vec2,
    end: Vec2,
    center: Vec2,
    radius: number,
    fromEnd = false
  ) => {
    const segmentLength = distanceBetween(start, end)
    if (segmentLength <= EPSILON) {
      return 0
    }

    const directedStart = fromEnd ? end : start
    const directedEnd = fromEnd ? start : end
    const dx = directedEnd.x - directedStart.x
    const dy = directedEnd.y - directedStart.y
    const fx = directedStart.x - center.x
    const fy = directedStart.y - center.y
    const a = dx * dx + dy * dy
    const b = 2 * (fx * dx + fy * dy)
    const c = fx * fx + fy * fy - radius * radius
    const discriminant = b * b - 4 * a * c
    if (a <= EPSILON || discriminant < 0) {
      return 0
    }

    const sqrtDiscriminant = Math.sqrt(discriminant)
    const roots = [
      (-b - sqrtDiscriminant) / (2 * a),
      (-b + sqrtDiscriminant) / (2 * a)
    ].filter((root) => root >= -EPSILON && root <= 1 + EPSILON)
    const exitRoot = roots
      .filter((root) => root >= -EPSILON)
      .sort((first, second) => first - second)[0]
    return exitRoot === undefined
      ? 0
      : Math.max(0, Math.min(segmentLength, exitRoot * segmentLength))
  }

  const getJoinReactiveCornerNeighborhoodTrim = (
    geometry: NonNullable<ReturnType<typeof getEdgeMaskGeometry>>
  ) => {
    if (joinReactiveCornerVertices.length === 0) {
      return { trimStart: 0, trimEnd: 0, collapsed: false }
    }

    let trimStart = 0
    let trimEnd = 0
    let collapsed = false
    joinReactiveCornerVertices.forEach((corner) => {
      const startDistance = distanceBetween(geometry.edge.start, corner.vertex)
      const endDistance = distanceBetween(geometry.edge.end, corner.vertex)
      const segmentDistance = getPointSegmentDistance(
        corner.vertex,
        geometry.edge.start,
        geometry.edge.end
      )
      if (
        startDistance > corner.trimRadius &&
        endDistance > corner.trimRadius &&
        segmentDistance > corner.trimRadius
      ) {
        return
      }

      if (
        startDistance <= corner.trimRadius &&
        endDistance <= corner.trimRadius
      ) {
        collapsed = true
        return
      }

      if (
        segmentDistance <= corner.trimRadius &&
        geometry.length <= corner.trimRadius * 2.5
      ) {
        collapsed = true
        return
      }

      if (startDistance <= corner.trimRadius) {
        trimStart = Math.max(
          trimStart,
          getSegmentCircleExitDistance(
            geometry.edge.start,
            geometry.edge.end,
            corner.vertex,
            corner.trimRadius
          )
        )
      }
      if (endDistance <= corner.trimRadius) {
        trimEnd = Math.max(
          trimEnd,
          getSegmentCircleExitDistance(
            geometry.edge.start,
            geometry.edge.end,
            corner.vertex,
            corner.trimRadius,
            true
          )
        )
      }
    })

    return { trimStart, trimEnd, collapsed }
  }

  const getJoinReactiveCornerInteriorCutIntervals = (
    geometry: NonNullable<ReturnType<typeof getEdgeMaskGeometry>>,
    radiusOverride?: number,
    includeEndpointCuts = false
  ) => {
    if (joinReactiveCornerVertices.length === 0) {
      return []
    }

    const intervals = joinReactiveCornerVertices.flatMap((corner) => {
      const relativeCorner = {
        x: corner.vertex.x - geometry.edge.start.x,
        y: corner.vertex.y - geometry.edge.start.y
      }
      const projectedDistance =
        relativeCorner.x * geometry.tangent.x +
        relativeCorner.y * geometry.tangent.y

      if (
        !includeEndpointCuts &&
        (projectedDistance <= EPSILON ||
          projectedDistance >= geometry.length - EPSILON)
      ) {
        return []
      }

      const clampedProjectedDistance = Math.max(
        0,
        Math.min(geometry.length, projectedDistance)
      )
      const radius = radiusOverride ?? corner.trimRadius

      const projectedPoint = {
        x:
          geometry.edge.start.x + geometry.tangent.x * clampedProjectedDistance,
        y: geometry.edge.start.y + geometry.tangent.y * clampedProjectedDistance
      }
      const perpendicularDistance = distanceBetween(
        projectedPoint,
        corner.vertex
      )
      if (perpendicularDistance > radius) {
        return []
      }

      const alongDistance = Math.sqrt(
        Math.max(
          0,
          radius * radius - perpendicularDistance * perpendicularDistance
        )
      )
      return [
        {
          start: Math.max(0, clampedProjectedDistance - alongDistance),
          end: Math.min(
            geometry.length,
            clampedProjectedDistance + alongDistance
          )
        }
      ]
    })

    return intervals
      .filter((interval) => interval.end - interval.start > EPSILON)
      .sort((first, second) => first.start - second.start)
      .reduce<{ start: number; end: number }[]>((merged, interval) => {
        const previous = merged[merged.length - 1]
        if (!previous || interval.start > previous.end + EPSILON) {
          merged.push({ ...interval })
          return merged
        }
        previous.end = Math.max(previous.end, interval.end)
        return merged
      }, [])
  }

  const buildSelfIntersectionFaceCornerPolygons = (
    previous: NonNullable<ReturnType<typeof getEdgeMaskGeometry>>,
    next: NonNullable<ReturnType<typeof getEdgeMaskGeometry>>,
    previousDirectionOverride?: Vec2 | null,
    nextDirectionOverride?: Vec2 | null
  ) => {
    if (
      distanceBetween(previous.edge.end, next.edge.start) >
        faceNodeJoinTolerance ||
      previous.edge.endNodeDegree <= 2 ||
      next.edge.startNodeDegree <= 2
    ) {
      return null
    }

    const vertex = {
      x: (previous.edge.end.x + next.edge.start.x) / 2,
      y: (previous.edge.end.y + next.edge.start.y) / 2
    }
    const previousDirection =
      normalizeVector(previousDirectionOverride ?? previous.tangent) ??
      normalizeVector(previous.tangent)
    const nextDirection =
      normalizeVector(nextDirectionOverride ?? next.tangent) ??
      normalizeVector(next.tangent)
    const getLegalNormalForDirection = (
      direction: Vec2,
      legalSide: EvenOddLegalFaceBoundaryEdge['legalSide']
    ) =>
      legalSide === 'left'
        ? { x: -direction.y, y: direction.x }
        : { x: direction.y, y: -direction.x }
    const previousLegalNormal = previousDirection
      ? getLegalNormalForDirection(previousDirection, previous.edge.legalSide)
      : previous.legalNormal
    const nextLegalNormal = nextDirection
      ? getLegalNormalForDirection(nextDirection, next.edge.legalSide)
      : next.legalNormal
    const interiorDirection = normalizeVector({
      x: previousLegalNormal.x + nextLegalNormal.x,
      y: previousLegalNormal.y + nextLegalNormal.y
    })
    const scoreJoinPolygon = (polygon: Vec2[]) => {
      if (!interiorDirection) {
        return 0
      }
      const centroid = getPolygonCentroid(polygon)
      const centroidDirection = normalizeVector({
        x: centroid.x - vertex.x,
        y: centroid.y - vertex.y
      })
      return centroidDirection
        ? centroidDirection.x * interiorDirection.x +
            centroidDirection.y * interiorDirection.y
        : -Infinity
    }
    if (!previousDirection || !nextDirection) {
      return null
    }

    const joinEnvelopeRadius = getJoinReactiveCornerEnvelopeRadius(strokeWidth)
    const joinConnectorRadius =
      getJoinReactiveCornerRenderTrimRadius(strokeWidth)
    const previousTrimBase = normalizePoint({
      x: vertex.x - previousDirection.x * joinConnectorRadius,
      y: vertex.y - previousDirection.y * joinConnectorRadius
    })
    const nextTrimBase = normalizePoint({
      x: vertex.x + nextDirection.x * joinConnectorRadius,
      y: vertex.y + nextDirection.y * joinConnectorRadius
    })
    const previousOffsetPoint = normalizePoint({
      x: previousTrimBase.x + previousLegalNormal.x * joinEnvelopeRadius,
      y: previousTrimBase.y + previousLegalNormal.y * joinEnvelopeRadius
    })
    const nextOffsetPoint = normalizePoint({
      x: nextTrimBase.x + nextLegalNormal.x * joinEnvelopeRadius,
      y: nextTrimBase.y + nextLegalNormal.y * joinEnvelopeRadius
    })

    const buildCornerEnvelope = (outerBoundaryPoints: Vec2[]) =>
      normalizeCornerPolygon([
        vertex,
        nextTrimBase,
        ...outerBoundaryPoints,
        previousOffsetPoint,
        previousTrimBase
      ])
    const validateCornerPolygon = (polygon: Vec2[]) => {
      const cleaned = cleanPolygon(polygon)
      return cleaned.length >= 3 &&
        Math.abs(polygonArea(cleaned)) > EPSILON &&
        isSimpleClosedPolygon(cleaned)
        ? cleaned
        : null
    }
    const normalizeCornerPolygon = (polygon: Vec2[]) => {
      const cleaned = validateCornerPolygon(polygon)
      if (!cleaned) {
        return null
      }
      return scoreJoinPolygon(cleaned) > -0.35 ? cleaned : null
    }

    const buildBevelCornerPolygon = () => {
      return buildCornerEnvelope([nextOffsetPoint])
    }

    const buildMiterCornerPolygon = () => {
      const buildMiterBaseCornerPolygon = () =>
        buildCornerEnvelope([nextOffsetPoint]) ?? buildBevelCornerPolygon()
      const previousLineEnd = addPoint(previousOffsetPoint, previousDirection)
      const nextLineEnd = addPoint(nextOffsetPoint, nextDirection)
      const miterPoint = lineIntersection(
        previousOffsetPoint,
        previousLineEnd,
        nextOffsetPoint,
        nextLineEnd
      )
      if (
        !miterPoint ||
        distanceBetween(vertex, miterPoint) >
          stroke.miterLimit * strokeWidth + EPSILON
      ) {
        return buildMiterBaseCornerPolygon()
      }

      return (
        buildCornerEnvelope([nextOffsetPoint, miterPoint]) ??
        buildMiterBaseCornerPolygon()
      )
    }

    const buildRoundCornerPolygon = () => {
      const candidates = [-1, 1]
        .map((sweepSign) => {
          const arcPoints = buildJoinArcPoints(
            vertex,
            nextOffsetPoint,
            previousOffsetPoint,
            sweepSign,
            Math.PI / 24
          )
          const polygon = buildCornerEnvelope(arcPoints)
          return polygon
            ? {
                polygon,
                score: scoreJoinPolygon(polygon),
                area: Math.abs(polygonArea(polygon))
              }
            : null
        })
        .filter(
          (
            candidate
          ): candidate is { polygon: Vec2[]; score: number; area: number } =>
            candidate !== null
        )
        .sort((first, second) => {
          const scoreDelta = second.score - first.score
          return Math.abs(scoreDelta) > 1e-6
            ? scoreDelta
            : first.area - second.area
        })

      return candidates[0]?.polygon ?? buildBevelCornerPolygon()
    }

    const acceptedJoinPolygon =
      stroke.join === 'round'
        ? buildRoundCornerPolygon()
        : stroke.join === 'miter'
          ? buildMiterCornerPolygon()
          : buildBevelCornerPolygon()
    const acceptedJoinPolygons = acceptedJoinPolygon
      ? [acceptedJoinPolygon]
      : []
    const renderClipVertexSanitizer = interiorDirection
      ? {
          vertex,
          direction: interiorDirection,
          sideDirection: {
            x: -interiorDirection.y,
            y: interiorDirection.x
          }
        }
      : null
    return {
      clipPolygons: acceptedJoinPolygons,
      joinPolygons: acceptedJoinPolygons,
      renderClipPolygons: acceptedJoinPolygons,
      renderClipVertexSanitizer,
      postFillRenderClipPolygons: []
    }
  }

  legalFaceBoundaries.forEach((face) => {
    const faceJoinEligibility = isJoinReactiveInsideFace(face)
      ? 'join-reactive'
      : 'mask-only'

    const maskGeometries = face.edges
      .map(getEdgeMaskGeometry)
      .filter(
        (
          geometry
        ): geometry is NonNullable<ReturnType<typeof getEdgeMaskGeometry>> =>
          geometry !== null && geometry.length >= minMaskEdgeLength
      )
    const geometriesForMask =
      maskGeometries.length >= 2
        ? maskGeometries
        : face.edges
            .map(getEdgeMaskGeometry)
            .filter(
              (
                geometry
              ): geometry is NonNullable<
                ReturnType<typeof getEdgeMaskGeometry>
              > => geometry !== null
            )
    const faceEdgeIndexById = new Map(
      face.edges.map((edge, index) => [edge.edgeId, index])
    )
    const maskPieces = geometriesForMask.flatMap((geometry) => {
      const edgeIndex = faceEdgeIndexById.get(geometry.edge.edgeId) ?? -1
      const previousFaceEdge =
        edgeIndex >= 0
          ? face.edges[(edgeIndex - 1 + face.edges.length) % face.edges.length]
          : undefined
      const nextFaceEdge =
        edgeIndex >= 0
          ? face.edges[(edgeIndex + 1) % face.edges.length]
          : undefined
      const startOwnershipTransition =
        geometry.edge.startNodeDegree > 2 &&
        previousFaceEdge !== undefined &&
        previousFaceEdge.oppositeFaceLegal !== geometry.edge.oppositeFaceLegal
      const endOwnershipTransition =
        geometry.edge.endNodeDegree > 2 &&
        nextFaceEdge !== undefined &&
        nextFaceEdge.oppositeFaceLegal !== geometry.edge.oppositeFaceLegal
      const transitionTrimDistance = 0
      const joinReactiveSharedTrimDistance =
        faceJoinEligibility === 'join-reactive' &&
        geometry.edge.oppositeFaceLegal
          ? Math.min(
              getJoinReactiveCornerEnvelopeRadius(strokeWidth),
              geometry.length * 0.45
            )
          : 0
      const sharedTrimDistance = joinReactiveSharedTrimDistance
      const joinReactiveCornerNeighborhoodTrim =
        faceJoinEligibility === 'join-reactive'
          ? getJoinReactiveCornerNeighborhoodTrim(geometry)
          : { trimStart: 0, trimEnd: 0, collapsed: false }
      const trimStart =
        joinReactiveCornerNeighborhoodTrim.trimStart > 0
          ? joinReactiveCornerNeighborhoodTrim.trimStart
          : startOwnershipTransition && !geometry.edge.oppositeFaceLegal
            ? transitionTrimDistance
            : sharedTrimDistance > 0 && geometry.edge.startNodeDegree > 2
              ? sharedTrimDistance
              : 0
      const trimEnd =
        joinReactiveCornerNeighborhoodTrim.trimEnd > 0
          ? joinReactiveCornerNeighborhoodTrim.trimEnd
          : endOwnershipTransition && !geometry.edge.oppositeFaceLegal
            ? transitionTrimDistance
            : sharedTrimDistance > 0 && geometry.edge.endNodeDegree > 2
              ? sharedTrimDistance
              : 0
      const highDegreeOverlap = 0
      const startOverlap =
        geometry.edge.startNodeDegree > 2
          ? Math.min(highDegreeOverlap, geometry.length * 0.2)
          : 0
      const endOverlap =
        geometry.edge.endNodeDegree > 2
          ? Math.min(highDegreeOverlap, geometry.length * 0.2)
          : 0
      const collapsed =
        joinReactiveCornerNeighborhoodTrim.collapsed ||
        trimStart + trimEnd >= geometry.length - EPSILON
      const baseStartDistance = trimStart - startOverlap
      const baseEndDistance = geometry.length - trimEnd + endOverlap
      const buildMaskPiece = (
        startDistance: number,
        endDistance: number,
        pieceCollapsed: boolean
      ) => {
        const start = {
          x: geometry.edge.start.x + geometry.tangent.x * startDistance,
          y: geometry.edge.start.y + geometry.tangent.y * startDistance
        }
        const end = {
          x: geometry.edge.start.x + geometry.tangent.x * endDistance,
          y: geometry.edge.start.y + geometry.tangent.y * endDistance
        }
        const ownedWidth = geometry.ownedWidth
        const offsetStart = {
          x: start.x + geometry.legalNormal.x * ownedWidth,
          y: start.y + geometry.legalNormal.y * ownedWidth
        }
        const offsetEnd = {
          x: end.x + geometry.legalNormal.x * ownedWidth,
          y: end.y + geometry.legalNormal.y * ownedWidth
        }
        return {
          geometry,
          collapsed: pieceCollapsed,
          trimStart,
          trimEnd,
          startDistance,
          endDistance,
          start,
          end,
          offsetStart,
          offsetEnd,
          rawOffsetStart: geometry.offsetStart,
          rawOffsetEnd: geometry.offsetEnd
        }
      }

      if (collapsed || baseEndDistance - baseStartDistance <= EPSILON) {
        return [buildMaskPiece(baseStartDistance, baseEndDistance, true)]
      }

      const cutIntervals =
        faceJoinEligibility === 'join-reactive'
          ? getJoinReactiveCornerInteriorCutIntervals(geometry).flatMap(
              (interval) => {
                const start = Math.max(baseStartDistance, interval.start)
                const end = Math.min(baseEndDistance, interval.end)
                return end - start > EPSILON ? [{ start, end }] : []
              }
            )
          : []

      if (cutIntervals.length === 0) {
        return [buildMaskPiece(baseStartDistance, baseEndDistance, false)]
      }

      const pieces: ReturnType<typeof buildMaskPiece>[] = []
      let cursor = baseStartDistance
      cutIntervals.forEach((interval) => {
        if (interval.start - cursor > minMaskEdgeLength) {
          pieces.push(buildMaskPiece(cursor, interval.start, false))
        }
        cursor = Math.max(cursor, interval.end)
      })
      if (baseEndDistance - cursor > minMaskEdgeLength) {
        pieces.push(buildMaskPiece(cursor, baseEndDistance, false))
      }

      return pieces.length > 0
        ? pieces
        : [buildMaskPiece(baseStartDistance, baseEndDistance, true)]
    })

    const appendMaskPieceChain = (chain: typeof maskPieces) => {
      const visiblePieces = chain.filter((piece) => !piece.collapsed)
      if (visiblePieces.length === 0) {
        return
      }
      const getRenderRanges = (piece: (typeof visiblePieces)[number]) => {
        const shouldApplyJoinReactiveRenderCut =
          faceJoinEligibility === 'join-reactive' ||
          (stroke.join !== 'miter' &&
            isSharedWithJoinReactiveInsideFace(piece.geometry.edge))
        const renderCutRadius = shouldApplyJoinReactiveRenderCut
          ? getJoinReactiveCornerRenderTrimRadius(strokeWidth) *
            (stroke.join === 'miter'
              ? 1.65
              : stroke.join === 'round'
                ? 3.8
                : 2.35)
          : getJoinReactiveCornerRenderTrimRadius(strokeWidth)
        const cutIntervals: { start: number; end: number }[] =
          getJoinReactiveCornerInteriorCutIntervals(
            piece.geometry,
            renderCutRadius,
            true
          ).flatMap((interval) => {
            const start = Math.max(piece.startDistance, interval.start)
            const end = Math.min(piece.endDistance, interval.end)
            return end - start > EPSILON ? [{ start, end }] : []
          })

        const ranges: { start: number; end: number }[] = []
        let cursor = piece.startDistance
        cutIntervals.forEach((interval) => {
          if (interval.start - cursor > minMaskEdgeLength) {
            ranges.push({ start: cursor, end: interval.start })
          }
          cursor = Math.max(cursor, interval.end)
        })
        if (piece.endDistance - cursor > minMaskEdgeLength) {
          ranges.push({ start: cursor, end: piece.endDistance })
        }

        return ranges
      }

      const buildPieceRangePolygon = (
        piece: (typeof visiblePieces)[number],
        range: { start: number; end: number }
      ) => {
        const renderStartDistance = range.start
        const renderEndDistance = range.end
        const start = {
          x:
            piece.geometry.edge.start.x +
            piece.geometry.tangent.x * renderStartDistance,
          y:
            piece.geometry.edge.start.y +
            piece.geometry.tangent.y * renderStartDistance
        }
        const end = {
          x:
            piece.geometry.edge.start.x +
            piece.geometry.tangent.x * renderEndDistance,
          y:
            piece.geometry.edge.start.y +
            piece.geometry.tangent.y * renderEndDistance
        }
        const offsetStart = {
          x: start.x + piece.geometry.legalNormal.x * piece.geometry.ownedWidth,
          y: start.y + piece.geometry.legalNormal.y * piece.geometry.ownedWidth
        }
        const offsetEnd = {
          x: end.x + piece.geometry.legalNormal.x * piece.geometry.ownedWidth,
          y: end.y + piece.geometry.legalNormal.y * piece.geometry.ownedWidth
        }
        return cleanPolygon([start, end, offsetEnd, offsetStart])
      }

      visiblePieces.forEach((piece) => {
        appendMaskPolygon(
          buildPieceRangePolygon(piece, {
            start: piece.startDistance,
            end: piece.endDistance
          })
        )
        getRenderRanges(piece).forEach((range) => {
          appendRenderClipPolygon(buildPieceRangePolygon(piece, range))
        })
      })
    }
    let activeChain: typeof maskPieces = []

    maskPieces.forEach((piece) => {
      if (piece.collapsed) {
        appendMaskPieceChain(activeChain)
        activeChain = []
        appendTrace(piece.geometry.edge, face.faceId, faceJoinEligibility)
        return
      }

      const previous = activeChain[activeChain.length - 1]
      const canJoinPrevious =
        previous &&
        previous.geometry.edge.endNodeDegree <= 2 &&
        piece.geometry.edge.startNodeDegree <= 2 &&
        distanceBetween(previous.end, piece.start) <= faceNodeJoinTolerance

      if (!previous || canJoinPrevious) {
        activeChain.push(piece)
      } else {
        appendMaskPieceChain(activeChain)
        activeChain = [piece]
      }
      appendTrace(piece.geometry.edge, face.faceId, faceJoinEligibility)
    })
    appendMaskPieceChain(activeChain)

    const includedEdgeIds = new Set(
      geometriesForMask.map((geometry) => geometry.edge.edgeId)
    )
    face.edges.forEach((previousEdge, edgeIndex) => {
      const nextEdge = face.edges[(edgeIndex + 1) % face.edges.length]
      if (
        faceJoinEligibility !== 'join-reactive' ||
        !nextEdge ||
        !previousEdge.oppositeFaceLegal ||
        !nextEdge.oppositeFaceLegal ||
        (!includedEdgeIds.has(previousEdge.edgeId) &&
          !includedEdgeIds.has(nextEdge.edgeId)) ||
        (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
      ) {
        return
      }

      const previousGeometry = getEdgeMaskGeometry(previousEdge)
      const nextGeometry = getEdgeMaskGeometry(nextEdge)
      if (!previousGeometry || !nextGeometry) {
        return
      }
      const previousStableDirection = getStableJoinReactiveFaceDirection(
        face,
        edgeIndex,
        'previous',
        previousGeometry.tangent
      )
      const nextStableDirection = getStableJoinReactiveFaceDirection(
        face,
        edgeIndex,
        'next',
        nextGeometry.tangent
      )
      const faceCorner = buildSelfIntersectionFaceCornerPolygons(
        previousGeometry,
        nextGeometry,
        previousStableDirection,
        nextStableDirection
      )
      if (faceCorner && faceCorner.clipPolygons.length > 0) {
        internalCornerJoinPolygonCount += 1
        internalCornerVertices.push(previousGeometry.edge.end)
        faceCorner.joinPolygons.forEach((joinPolygon) => {
          pushValidPolygon(internalCornerJoinPolygons, joinPolygon)
          appendMaskPolygon(joinPolygon)
        })
        faceCorner.clipPolygons.forEach((clipPolygon) => {
          pushValidPolygon(internalCornerClipPolygons, clipPolygon)
        })
        faceCorner.renderClipPolygons.forEach((clipPolygon) => {
          appendRenderClipPolygon(clipPolygon)
        })
        if (faceCorner.renderClipVertexSanitizer) {
          renderClipVertexSanitizers.push(faceCorner.renderClipVertexSanitizer)
        }
        faceCorner.postFillRenderClipPolygons.forEach((clipPolygon) => {
          pushValidPolygon(postFillJoinRenderClipPolygons, clipPolygon)
        })
      }
    })
  })

  if (sourcePath) {
    buildCenterStrokeSourceVertexCoverageMaskPolygons(
      sourcePath,
      strokeWidth,
      1.25,
      24
    ).forEach((polygon) => {
      appendMaskPolygon(polygon)
      appendRenderClipPolygon(polygon)
    })
  }

  return polygons.length > 0
    ? {
        polygons,
        faceOwnershipTrace,
        internalCornerJoinPolygonCount,
        internalCornerJoinPolygons,
        internalCornerClipPolygons,
        internalCornerVertices,
        renderClipPolygons,
        renderClipVertexSanitizers,
        postFillJoinRenderClipPolygons,
        sourceMaskPolygons
      }
    : null
}

const buildSolidMaskModelPolygons = ({
  topology,
  stroke,
  fillRegions,
  legalFaceBoundaries = [],
  unfilledFaceBoundaries = [],
  legalBoundaryContours = [],
  exactBackend,
  sourcePath,
  selectedSideGuardPoints,
  preferRenderMaskProductFinal = false
}: {
  topology: PathTopologyModel
  stroke: ReturnType<typeof getRenderableStrokes>[number]
  fillRegions: PolygonRegion[]
  legalFaceBoundaries?: EvenOddLegalFaceBoundary[]
  unfilledFaceBoundaries?: EvenOddLegalFaceBoundary[]
  legalBoundaryContours?: EvenOddBoundaryContour[]
  exactBackend?: ConstrainedSolidStrokePacketOptions['exactBackend']
  sourcePath?: Pick<
    PathGeometry,
    'segments' | 'closed' | 'totalLength' | 'sampledPoints'
  >
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  preferRenderMaskProductFinal?: boolean
}): SolidMaskModelPolygonResult | null => {
  if (topology.topologyFamily === 'self-intersecting' && !sourcePath) {
    return null
  }

  const fillMaskPolygons = measureConstrainedSolidPhase(
    'solid-mask-model-fill-mask-polygons',
    () => flattenRegionPolygons(fillRegions)
  )
  if (fillMaskPolygons.length === 0) {
    return null
  }

  if (
    stroke.position === 'inside' &&
    sourcePath &&
    preferRenderMaskProductFinal &&
    topology.topologyFamily === 'self-intersecting'
  ) {
    const renderClipPolygons = flattenRegionPolygons(
      fillRegions.filter(hasRegionGeometry)
    )
    const renderStrokePathGroups = buildInsideAdjacencyStrokePathGroups(
      legalBoundaryContours,
      legalFaceBoundaries,
      stroke
    )
    if (
      renderClipPolygons.length === 0 ||
      renderStrokePathGroups.length === 0
    ) {
      return null
    }

    return {
      polygons: renderClipPolygons,
      maskApplication: 'render-fill-mask',
      visibleRender: 'masked-source-stroke',
      coverageOracle: 'render-mask',
      maskSide: 'inside-fill',
      insideMaskMode: 'face-occupancy-inside-fill',
      visibleMaskMode: 'inside-fill-source-stroke-clip',
      joinGeometrySource: 'authored-doubled-source-stroke',
      adjacencyProbe: buildInsideSolidAdjacencyProbeNames([], 0),
      renderClipPolygons,
      renderStrokePathGroups,
      renderStrokePathStyle: {
        width: stroke.width * 2,
        cap: 'butt',
        join: stroke.join,
        miterAngle: stroke.miterAngle,
        miterLimit: stroke.miterLimit,
        closed: sourcePath.closed
      }
    }
  }

  const doubledCenterStroke = {
    ...stroke,
    style: 'solid' as const,
    position: 'center' as const,
    width: stroke.width * 2
  }
  const sourceCenterStrokePolygons = sourcePath
    ? measureConstrainedSolidPhase(
        'solid-mask-model-source-center-stroke-polygons',
        () => buildSolidMaskModelSourceCenterStrokePolygons(sourcePath, stroke)
      )
    : []
  const centerStrokePolygons =
    sourceCenterStrokePolygons.length > 0
      ? sourceCenterStrokePolygons
      : measureConstrainedSolidPhase(
          'solid-mask-model-topology-center-stroke-polygons',
          () =>
            buildSolidCenterStrokePolygons(
              topology.normalizedPoints,
              topology.closed,
              doubledCenterStroke
            )
        )
  if (centerStrokePolygons.length === 0) {
    return null
  }

  if (
    stroke.position === 'outside' &&
    sourcePath &&
    preferRenderMaskProductFinal
  ) {
    if (
      hasAuthoredSharpSourceJoinBoundary(sourcePath, selectedSideGuardPoints)
    ) {
      return null
    }

    const renderStrokePaths = measureConstrainedSolidPhase(
      'solid-mask-model-render-stroke-paths',
      () => closeSourcePathForStrokeRender(sourcePath)
    )
    if (renderStrokePaths.length === 0) {
      return null
    }
    const renderClipPolygons = measureConstrainedSolidPhase(
      'solid-mask-model-outside-render-mask-polygons',
      () =>
        buildOutsideExteriorRenderMaskPolygons(
          centerStrokePolygons,
          fillMaskPolygons,
          stroke.width
        )
    )
    const smoothJoinRenderClipPolygons = measureConstrainedSolidPhase(
      'solid-mask-model-outside-smooth-join-render-clip-polygons',
      () =>
        buildOutsideSmoothJoinRenderClipPolygons(
          sourcePath,
          topology.normalizedPoints,
          stroke,
          selectedSideGuardPoints,
          topology.fillRule
        )
    )
    const effectiveRenderClipPolygons =
      smoothJoinRenderClipPolygons.length > 0
        ? [...renderClipPolygons, ...smoothJoinRenderClipPolygons]
        : renderClipPolygons
    if (effectiveRenderClipPolygons.length === 0) {
      return null
    }

    return {
      polygons: effectiveRenderClipPolygons,
      maskApplication: 'render-fill-mask',
      visibleRender: 'masked-source-stroke',
      coverageOracle: 'render-mask',
      maskSide: 'outside-exterior',
      renderClipPolygons: effectiveRenderClipPolygons,
      renderStrokePaths,
      renderStrokePathStyle: {
        width: stroke.width * 2,
        cap: stroke.cap,
        join: stroke.join,
        miterAngle: stroke.miterAngle,
        miterLimit: stroke.miterLimit,
        closed: sourcePath.closed
      }
    }
  }

  if (
    stroke.position === 'inside' &&
    sourcePath &&
    preferRenderMaskProductFinal &&
    topology.topologyFamily !== 'self-intersecting'
  ) {
    const renderStrokePaths = closeSourcePathForStrokeRender(sourcePath)
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
      renderStrokePaths,
      renderStrokePathStyle: {
        width: stroke.width * 2,
        cap: stroke.cap,
        join: stroke.join,
        miterAngle: stroke.miterAngle,
        miterLimit: stroke.miterLimit,
        closed: sourcePath.closed
      }
    }
  }

  const backend = hasExactSolidMaskBackend(exactBackend)
    ? exactBackend
    : undefined
  if (
    topology.topologyFamily === 'self-intersecting' &&
    stroke.position === 'inside' &&
    (!backend || fillRegions.length === 0)
  ) {
    return null
  }
  if (stroke.position === 'inside' && (!backend || fillRegions.length === 0)) {
    if (!sourcePath) {
      return null
    }

    const renderStrokePaths = closeSourcePathForStrokeRender(sourcePath)
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
      renderStrokePaths,
      renderStrokePathStyle: {
        width: stroke.width * 2,
        cap: stroke.cap,
        join: stroke.join,
        miterAngle: stroke.miterAngle,
        miterLimit: stroke.miterLimit,
        closed: sourcePath.closed
      }
    }
  }
  if (!backend || fillRegions.length === 0) {
    return null
  }

  try {
    const strokeRegions = measureConstrainedSolidPhase(
      'solid-mask-model-stroke-region-union',
      () =>
        backend.union(
          centerStrokePolygons.map((polygon) => ({ polygons: [polygon] })),
          'nonzero'
        )
    )
    const fillMaskRegions = measureConstrainedSolidPhase(
      'solid-mask-model-fill-region-union',
      () => backend.union(fillRegions, 'nonzero')
    )
    if (
      strokeRegions.length === 0 ||
      fillMaskRegions.length === 0 ||
      !strokeRegions.some(hasRegionGeometry) ||
      !fillMaskRegions.some(hasRegionGeometry)
    ) {
      return null
    }

    if (stroke.position === 'inside') {
      const faceOwnedInsideMask = measureConstrainedSolidPhase(
        'solid-mask-model-inside-face-owned-mask',
        () =>
          buildFaceOwnedInsideMaskPolygons(
            legalFaceBoundaries,
            stroke,
            sourcePath
          )
      )
      const isFaceOwnedMask =
        faceOwnedInsideMask !== null && faceOwnedInsideMask.polygons.length > 0
      if (!isFaceOwnedMask) {
        return null
      }
      const faceOwnedAcceptedClipSourcePolygons = isFaceOwnedMask
        ? faceOwnedInsideMask.sourceMaskPolygons
        : []
      const exactSourceStrokeRegions =
        sourcePath && isFaceOwnedMask
          ? measureConstrainedSolidPhase(
              'solid-mask-model-inside-exact-source-stroke',
              () =>
                buildExactOffsetSourceCenterStrokeRegions(
                  backend,
                  sourcePath,
                  stroke
                )
            )
          : []
      const exactSourceStrokeWithInternalJoinRegions =
        exactSourceStrokeRegions.length > 0 &&
        isFaceOwnedMask &&
        faceOwnedInsideMask.internalCornerJoinPolygons.length > 0
          ? measureConstrainedSolidPhase(
              'solid-mask-model-inside-exact-source-stroke-internal-join-union',
              () =>
                backend.union(
                  [
                    ...exactSourceStrokeRegions,
                    ...faceOwnedInsideMask.internalCornerJoinPolygons.map(
                      (polygon) => ({ polygons: [polygon] })
                    )
                  ],
                  'nonzero'
                )
            )
          : exactSourceStrokeRegions
      const effectiveStrokeRegions =
        exactSourceStrokeWithInternalJoinRegions.length > 0
          ? exactSourceStrokeWithInternalJoinRegions
          : strokeRegions
      const faceOwnedVisibleMaskPolygons =
        faceOwnedAcceptedClipSourcePolygons.length > 0
          ? faceOwnedAcceptedClipSourcePolygons
          : []
      if (
        topology.topologyFamily === 'self-intersecting' &&
        faceOwnedVisibleMaskPolygons.length === 0
      ) {
        return null
      }
      const insideFillClipRegions = fillRegions.filter(hasRegionGeometry)
      const insideVisibleFillClipRegions = insideFillClipRegions
      const shouldClipSourcePieces = unfilledFaceBoundaries.length > 0
      const productRegions = shouldClipSourcePieces
        ? measureConstrainedSolidPhase(
            'solid-mask-model-inside-source-piece-fill-intersections',
            () =>
              centerStrokePolygons.flatMap((polygon) =>
                backend.intersection(
                  [{ polygons: [polygon] }],
                  insideVisibleFillClipRegions,
                  topology.fillRule
                )
              )
          )
        : measureConstrainedSolidPhase(
            'solid-mask-model-inside-stroke-mask-intersection',
            () =>
              backend.intersection(
                effectiveStrokeRegions,
                insideVisibleFillClipRegions,
                topology.fillRule
              )
          )
      const polygons = flattenRegionPolygons(productRegions)
      const renderStrokePathGroups = buildInsideAdjacencyStrokePathGroups(
        legalBoundaryContours,
        legalFaceBoundaries,
        stroke
      )
      const renderClipPolygons = flattenRegionPolygons(
        insideVisibleFillClipRegions
      )
      const renderFillClipPolygons = undefined
      const sourceRenderStrokePaths = sourcePath
        ? closeSourcePathForStrokeRender(sourcePath)
        : []
      const renderStrokePaths =
        renderStrokePathGroups.length > 0 ? [] : sourceRenderStrokePaths
      const isJoinAwareFaceOwnedMask =
        isFaceOwnedMask &&
        faceOwnedInsideMask.internalCornerJoinPolygonCount > 0
      const hasRenderMask = renderClipPolygons.length > 0
      return polygons.length > 0 && hasRenderMask
        ? {
            polygons,
            maskApplication: 'exact-boolean',
            visibleRender: 'masked-source-stroke',
            coverageOracle: 'exact-boolean',
            maskSide: 'inside-fill',
            insideMaskMode: 'face-occupancy-inside-fill',
            visibleMaskMode: 'inside-fill-source-stroke-clip',
            joinGeometrySource: 'authored-doubled-source-stroke',
            internalCornerJoinMode: isJoinAwareFaceOwnedMask
              ? 'stroke-join-aware-face-corner'
              : undefined,
            joinEligibilityMode: isJoinAwareFaceOwnedMask
              ? 'internal-face-only'
              : undefined,
            adjacencyProbe: buildInsideSolidAdjacencyProbeNames(
              faceOwnedInsideMask.faceOwnershipTrace,
              faceOwnedInsideMask.internalCornerJoinPolygonCount
            ),
            faceOwnershipTrace: faceOwnedInsideMask.faceOwnershipTrace,
            renderClipPolygons,
            renderFillClipPolygons,
            renderStrokePathGroups:
              renderStrokePathGroups.length > 0
                ? renderStrokePathGroups
                : undefined,
            renderStrokePaths:
              renderStrokePaths.length > 0 ? renderStrokePaths : undefined,
            renderStrokePathStyle:
              renderStrokePaths.length > 0 || renderStrokePathGroups.length > 0
                ? {
                    width: stroke.width * 2,
                    cap:
                      renderStrokePathGroups.length > 0 ? 'butt' : stroke.cap,
                    join: stroke.join,
                    miterAngle: stroke.miterAngle,
                    miterLimit: stroke.miterLimit,
                    closed:
                      renderStrokePathGroups.length > 0
                        ? true
                        : sourcePath?.closed
                  }
                : undefined
          }
        : null
    }

    const maskedRegions = measureConstrainedSolidPhase(
      'solid-mask-model-outside-stroke-fill-difference',
      () => backend.difference(strokeRegions, fillMaskRegions, 'nonzero')
    )
    const normalizedRegions =
      maskedRegions.length > 0
        ? measureConstrainedSolidPhase(
            'solid-mask-model-outside-result-union',
            () => backend.union(maskedRegions, 'nonzero')
          )
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
          renderStrokePaths:
            renderStrokePaths.length > 0 ? renderStrokePaths : undefined,
          renderStrokePathStyle:
            renderStrokePaths.length > 0
              ? {
                  width: stroke.width * 2,
                  cap: stroke.cap,
                  join: stroke.join,
                  miterAngle: stroke.miterAngle,
                  miterLimit: stroke.miterLimit,
                  closed: sourcePath?.closed
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
    strokeDomainPlan.domainMode === null ||
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

      const exactMaskBackend = hasExactSolidMaskBackend(options.exactBackend)
        ? options.exactBackend
        : undefined
      const implicitFillRegions = options.implicitFillRegions ?? []
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
      const shouldAttachFullDiagnostics = shouldEmitFullStrokeDiagnostics()
      if (
        stroke.position === 'outside' &&
        exactMaskBackend &&
        implicitFillRegions.length > 0
      ) {
        const fillMaskRegions = exactMaskBackend.union(
          implicitFillRegions,
          'nonzero'
        )
        if (
          fillMaskRegions.length > 0 &&
          fillMaskRegions.some(hasRegionGeometry)
        ) {
          const candidateRecords = buildExactArrangementCandidatePolygons(
            topology.normalizedPoints,
            topology.closed,
            stroke,
            sourcePath,
            options.selectedSideGuardPoints,
            topology.fillRule
          )
          const canonicalOwnerPartitions =
            buildExactArrangementCandidateOwnerPartitions({
              candidateRecords,
              backend: exactMaskBackend,
              excludeRegions: fillMaskRegions
            })
          const canonicalPackets = canonicalOwnerPartitions.map(
            ({
              candidateRecord,
              candidateIndex,
              polygons
            }): SolidCenterStrokeResolvedPacket => {
              const geometryId = `${cachePrefix}:${strokeIndex}:canonical:${candidateIndex}`
              const revisionSet = buildStrokeRuntimeRevisionSet({
                points: topology.normalizedPoints,
                closed: topology.closed,
                stroke,
                productMode: 'closed-constrained-domain',
                domainMode: 'closed-constrained-domain',
                strokeProductSignature: `constrained-solid:${stroke.position}:canonical-product`,
                strokeDomainSignature: [
                  strokeDomainPlan.domainMode,
                  stroke.position,
                  legalDomainIds.join(','),
                  contourIds.join(',')
                ].join(':'),
                endpointCapPolicySignature: [
                  'solid-constrained',
                  stroke.position,
                  stroke.cap,
                  stroke.width
                ].join(':'),
                joinOwnershipSignature: [
                  'solid-constrained',
                  stroke.position,
                  stroke.join,
                  stroke.miterLimit
                ].join(':'),
                smoothContinuitySignature: `solid-constrained:${stroke.position}`,
                productMaterializationSignature: `solid-canonical-product:${stroke.position}`,
                ownerCount: Math.max(
                  legalDomainIds.length,
                  contourIds.length,
                  1
                ),
                ownerKey,
                networkId: options.metadata?.networkId,
                strokeId,
                intervalSignature: `solid-canonical-product:${stroke.position}`
              })

              return {
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
                      legalDomainIds[0] ??
                      options.metadata?.legalDomainId ??
                      null,
                    intervalId: `solid-canonical-product:${stroke.position}:${candidateIndex}`,
                    sourceSpanIds: candidateRecord.sourceSpanIds,
                    sourceContourIds: contourIds,
                    legalDomainIds,
                    startDistance: 0,
                    endDistance: sourcePath.totalLength,
                    wrapsSeam: true,
                    domainPlanBoundaryPoints: shouldAttachFullDiagnostics
                      ? (evidenceDomain.boundaryPoints ?? []).map((point) => ({
                          ...point
                        }))
                      : undefined,
                    domainPlanBoundaryStartDistance:
                      evidenceDomain.boundaryStartDistance,
                    domainPlanBoundaryEndDistance:
                      evidenceDomain.boundaryEndDistance,
                    domainPlanBoundaryTotalLength:
                      evidenceDomain.boundaryTotalLength,
                    domainPlanSideAuthority: 'implicit-fill-hole-domain',
                    domainPlanSelectedSide: evidenceDomain.selectedSide,
                    domainPlanFilledSide: evidenceDomain.filledSide,
                    domainPlanUnfilledSide: evidenceDomain.unfilledSide,
                    domainPlanBoundaryRole: 'outer',
                    domainPlanSideResolutionStatus:
                      evidenceDomain.sideResolutionStatus,
                    productMode: 'closed-constrained-domain',
                    productSignature: `constrained-solid:${stroke.position}:canonical-product`,
                    routeId: candidateRecord.joinFootprint
                      ? 'constrained-solid-canonical-source-vertex-join-footprint'
                      : 'constrained-solid-doubled-center-mask',
                    domainMode: 'closed-constrained-domain',
                    topologyFamily: topology.topologyFamily,
                    strokePosition: stroke.position,
                    strokeWidth: stroke.width,
                    strokeJoin: stroke.join,
                    strokeCap: stroke.cap,
                    strokeMiterLimit: stroke.miterLimit,
                    visualOverlapCollapseStatus: 'exact-arrangement',
                    revisionSet,
                    ...(candidateRecord.joinFootprint
                      ? {
                          ownerStage: candidateRecord.joinFootprint.ownerStage,
                          authoredJoin:
                            candidateRecord.joinFootprint.authoredJoin,
                          resolvedJoin:
                            candidateRecord.joinFootprint.resolvedJoin,
                          vertexAngle:
                            candidateRecord.joinFootprint.vertexAngle,
                          miterAngle: candidateRecord.joinFootprint.miterAngle,
                          angleSource:
                            candidateRecord.joinFootprint.angleSource,
                          angleComparison:
                            candidateRecord.joinFootprint.angleComparison,
                          visibleContributor:
                            candidateRecord.joinFootprint.visibleContributor,
                          geometryBasis:
                            candidateRecord.joinFootprint.geometryBasis,
                          joinStyle: candidateRecord.joinFootprint.authoredJoin,
                          joinResolution:
                            candidateRecord.joinFootprint.resolvedJoin,
                          joinOwnershipSignature: [
                            'solid-constrained',
                            stroke.position,
                            candidateRecord.joinFootprint.ownerId,
                            candidateRecord.joinFootprint.resolvedJoin
                          ].join(':'),
                          joinOwnershipRecords: [
                            {
                              kind: 'source-vertex' as const,
                              materializationKind: 'join' as const,
                              area: Math.abs(
                                polygonArea(
                                  candidateRecord.joinFootprint.polygon
                                )
                              ),
                              bounds: getBounds([
                                candidateRecord.joinFootprint.polygon
                              ]),
                              vertex: candidateRecord.joinFootprint.polygon[0],
                              previousContourPoint:
                                candidateRecord.joinFootprint
                                  .previousOffsetEndpoint,
                              nextContourPoint:
                                candidateRecord.joinFootprint.nextOffsetEndpoint
                            }
                          ]
                        }
                      : {})
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
            }
          )
          if (
            canonicalPackets.some(
              (packet) =>
                packet.geometry.debugMeta?.visibleContributor ===
                'source-vertex-join'
            )
          ) {
            return canonicalPackets
          }
        }
      }

      const solidMaskModelPolygons = buildSolidMaskModelPolygons({
        topology,
        stroke,
        fillRegions: implicitFillRegions,
        legalFaceBoundaries: options.implicitLegalFaceBoundaries ?? [],
        unfilledFaceBoundaries: options.implicitUnfilledFaceBoundaries ?? [],
        legalBoundaryContours: options.implicitLegalBoundaryContours ?? [],
        exactBackend: options.exactBackend,
        sourcePath,
        selectedSideGuardPoints: options.selectedSideGuardPoints,
        preferRenderMaskProductFinal: options.preferRenderMaskProductFinal
      })
      if (!solidMaskModelPolygons) {
        return []
      }
      const { polygons } = solidMaskModelPolygons

      const geometryId = `${cachePrefix}:${strokeIndex}:solid-mask`
      const revisionSet = buildStrokeRuntimeRevisionSet({
        points: topology.normalizedPoints,
        closed: topology.closed,
        stroke,
        productMode: 'closed-constrained-domain',
        domainMode: 'closed-constrained-domain',
        strokeProductSignature: `constrained-solid:${stroke.position}`,
        strokeDomainSignature: [
          strokeDomainPlan.domainMode,
          stroke.position,
          legalDomainIds.join(','),
          contourIds.join(',')
        ].join(':'),
        endpointCapPolicySignature: [
          'solid-constrained',
          stroke.position,
          stroke.cap,
          stroke.width
        ].join(':'),
        joinOwnershipSignature: [
          'solid-constrained',
          stroke.position,
          stroke.join,
          stroke.miterLimit
        ].join(':'),
        smoothContinuitySignature: `solid-constrained:${stroke.position}`,
        productMaterializationSignature: `solid-mask:${stroke.position}`,
        ownerCount: Math.max(legalDomainIds.length, contourIds.length, 1),
        ownerKey,
        networkId: options.metadata?.networkId,
        strokeId,
        intervalSignature: `solid-mask:${stroke.position}`
      })

      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            renderDescriptor: {
              clipPolygons: solidMaskModelPolygons.renderClipPolygons,
              fillClipPolygons: solidMaskModelPolygons.renderFillClipPolygons,
              strokeMaskPolygons:
                solidMaskModelPolygons.renderStrokeMaskPolygons,
              strokePaths: solidMaskModelPolygons.renderStrokePaths,
              strokePathGroups: solidMaskModelPolygons.renderStrokePathGroups,
              strokePathStyle: solidMaskModelPolygons.renderStrokePathStyle
            },
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
              domainPlanBoundaryPoints: shouldAttachFullDiagnostics
                ? (evidenceDomain.boundaryPoints ?? []).map((point) => ({
                    ...point
                  }))
                : undefined,
              domainPlanBoundaryStartDistance:
                evidenceDomain.boundaryStartDistance,
              domainPlanBoundaryEndDistance: evidenceDomain.boundaryEndDistance,
              domainPlanBoundaryTotalLength: evidenceDomain.boundaryTotalLength,
              domainPlanSideAuthority: 'implicit-fill-hole-domain',
              domainPlanSelectedSide: evidenceDomain.selectedSide,
              domainPlanFilledSide: evidenceDomain.filledSide,
              domainPlanUnfilledSide: evidenceDomain.unfilledSide,
              domainPlanBoundaryRole:
                stroke.position === 'inside' ? 'filled-face' : 'outer',
              domainPlanSideResolutionStatus:
                evidenceDomain.sideResolutionStatus,
              productMode: 'closed-constrained-domain',
              productSignature: `constrained-solid:${stroke.position}:mask-model`,
              routeId:
                solidMaskModelPolygons.renderStrokePaths ||
                solidMaskModelPolygons.renderStrokePathGroups
                  ? 'constrained-solid-same-owner-smooth-span-descriptor'
                  : 'constrained-solid-doubled-center-mask',
              domainMode: 'closed-constrained-domain',
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
              solidMaskModelInsideMaskMode:
                solidMaskModelPolygons.insideMaskMode,
              solidMaskModelVisibleMaskMode:
                solidMaskModelPolygons.visibleMaskMode,
              solidMaskModelJoinGeometrySource:
                solidMaskModelPolygons.joinGeometrySource,
              solidMaskModelInternalCornerJoinMode:
                solidMaskModelPolygons.internalCornerJoinMode,
              solidMaskModelJoinEligibilityMode:
                solidMaskModelPolygons.joinEligibilityMode,
              solidMaskModelAdjacencyProbe: shouldAttachFullDiagnostics
                ? solidMaskModelPolygons.adjacencyProbe
                : undefined,
              solidMaskModelFaceOwnershipTrace: shouldAttachFullDiagnostics
                ? solidMaskModelPolygons.faceOwnershipTrace
                : undefined,
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

export const hasConstrainedSolidStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  getRenderableStrokes(strokes).some(
    (stroke) =>
      stroke.style === 'solid' &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      stroke.width > 0
  ) === true

export const buildConstrainedSolidDoubledCenterProductUnits = ({
  cachePrefix,
  points,
  closed,
  strokes,
  productFamilyId,
  legalSideId,
  metadata
}: BuildConstrainedSolidDoubledCenterProductUnitsInput): ConstrainedSolidDoubledCenterProductUnit[] => {
  if (productFamilyId !== 'constrained-solid' || !closed) {
    return []
  }

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsExactConstrainedSolidStroke(stroke)) {
      return []
    }
    if (stroke.position !== 'inside' && stroke.position !== 'outside') {
      return []
    }
    const strokePosition = stroke.position

    const doubledCenterStrokeWidth = stroke.width * 2
    const polygons = buildSolidCenterStrokePolygons(points, closed, {
      style: 'solid',
      position: 'center',
      width: doubledCenterStrokeWidth,
      join: stroke.join,
      miterAngle: stroke.miterAngle,
      miterLimit: stroke.miterLimit,
      cap: stroke.cap
    })
    if (polygons.length === 0) {
      return []
    }

    const productId = `${cachePrefix}:${strokeIndex}:pre-legality`
    return [
      {
        productId,
        productFamilyId: 'constrained-solid',
        productMode: 'pre-legality-constrained-solid-doubled-center',
        geometryBasis: 'doubled-authored-center-stroke',
        polygons,
        bounds: getBounds(polygons),
        legalSideId,
        strokePosition,
        sourceStrokeWidth: stroke.width,
        doubledCenterStrokeWidth,
        ownerStage: 'Stroke Geometry constrained solid product assembly',
        debugMeta: {
          sourcePathId: cachePrefix,
          ownerKey: metadata?.ownerKeyPrefix
            ? `${metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
            : undefined,
          networkId: metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          productFamilyId: 'constrained-solid',
          productMode: 'pre-legality-constrained-solid-doubled-center',
          geometryBasis: 'doubled-authored-center-stroke',
          legalSideId,
          strokePosition
        }
      }
    ]
  })
}

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
  if (!topology.closed) {
    return []
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
    if (topology.topologyFamily === 'self-intersecting') {
      return []
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

    const shouldEmitArrangementCandidates =
      options.candidateMode === 'exact-arrangement'
    const candidateOwnerPartitions =
      shouldEmitArrangementCandidates &&
      hasExactSolidMaskBackend(options.exactBackend)
        ? buildExactArrangementCandidateOwnerPartitions({
            candidateRecords: exactArrangementCandidatePolygons,
            backend: options.exactBackend
          })
        : undefined
    const candidateRecords = shouldEmitArrangementCandidates
      ? exactArrangementCandidatePolygons
      : []
    const candidatePolygons = candidateOwnerPartitions
      ? candidateOwnerPartitions.map((partition) => partition.polygons)
      : shouldEmitArrangementCandidates
        ? exactArrangementCandidatePolygons.map((candidate) => [
            candidate.polygon
          ])
        : [polygons]

    return candidatePolygons.map((candidatePolygonGroup, candidateIndex) => {
      const candidateOwnerPartition = candidateOwnerPartitions?.[candidateIndex]
      const candidateRecord =
        candidateOwnerPartition?.candidateRecord ??
        candidateRecords[candidateIndex]
      const sourceCandidateIndex =
        candidateOwnerPartition?.candidateIndex ?? candidateIndex
      const geometryId =
        candidatePolygons.length === 1
          ? `${cachePrefix}:${index}`
          : `${cachePrefix}:${index}:candidate:${sourceCandidateIndex}`

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
            productMode: 'closed-constrained-domain',
            productSignature: `constrained-solid:${stroke.position}`,
            routeId: candidateRecord?.joinFootprint
              ? 'constrained-solid-canonical-source-vertex-join-footprint'
              : 'constrained-solid-doubled-center-mask',
            domainMode: 'closed-constrained-domain',
            topologyFamily: topology.topologyFamily,
            strokeWidth: stroke.width,
            strokeJoin: stroke.join,
            strokeCap: stroke.cap,
            strokeMiterLimit: stroke.miterLimit,
            sourceSpanIds: candidateRecord?.sourceSpanIds,
            ...(candidateRecord?.joinFootprint
              ? {
                  ownerStage: candidateRecord.joinFootprint.ownerStage,
                  authoredJoin: candidateRecord.joinFootprint.authoredJoin,
                  resolvedJoin: candidateRecord.joinFootprint.resolvedJoin,
                  vertexAngle: candidateRecord.joinFootprint.vertexAngle,
                  miterAngle: candidateRecord.joinFootprint.miterAngle,
                  angleSource: candidateRecord.joinFootprint.angleSource,
                  angleComparison:
                    candidateRecord.joinFootprint.angleComparison,
                  visibleContributor:
                    candidateRecord.joinFootprint.visibleContributor,
                  geometryBasis: candidateRecord.joinFootprint.geometryBasis,
                  joinStyle: candidateRecord.joinFootprint.authoredJoin,
                  joinResolution: candidateRecord.joinFootprint.resolvedJoin,
                  joinOwnershipSignature: [
                    'solid-constrained',
                    stroke.position,
                    candidateRecord.joinFootprint.ownerId,
                    candidateRecord.joinFootprint.resolvedJoin
                  ].join(':'),
                  joinOwnershipRecords: [
                    {
                      kind: 'source-vertex' as const,
                      materializationKind: 'join' as const,
                      area: Math.abs(
                        polygonArea(candidateRecord.joinFootprint.polygon)
                      ),
                      bounds: getBounds([
                        candidateRecord.joinFootprint.polygon
                      ]),
                      vertex: candidateRecord.joinFootprint.polygon[0],
                      previousContourPoint:
                        candidateRecord.joinFootprint.previousOffsetEndpoint,
                      nextContourPoint:
                        candidateRecord.joinFootprint.nextOffsetEndpoint
                    }
                  ]
                }
              : {}),
            authoredVisibleIntervalIndex: candidateRecord?.sourceSegmentIndex,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              productMode: 'closed-constrained-domain',
              domainMode: 'closed-constrained-domain',
              strokeProductSignature: `constrained-solid:${stroke.position}`,
              strokeDomainSignature: [
                stroke.position,
                contourId ?? 'contour:none',
                legalDomainId ?? 'domain:none'
              ].join(':'),
              endpointCapPolicySignature: [
                'solid-constrained',
                stroke.position,
                stroke.cap,
                stroke.width
              ].join(':'),
              joinOwnershipSignature: [
                'solid-constrained',
                stroke.position,
                stroke.join,
                stroke.miterLimit
              ].join(':'),
              smoothContinuitySignature: `solid-constrained:${stroke.position}`,
              productMaterializationSignature: `solid-constrained:${stroke.position}`,
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
    })
  })
}
