import type { PathGeometry, PathSegment } from './path-geometry'
import type { PolygonRegion } from './geometry-backend'
import type { PathTopologyFillRule } from './path-topology-model'
import { EPS, type Vec2 } from './solid-stroke-geometry-core'

export interface SourcePathSideRange {
  startDistance: number
  endDistance: number
  segmentIndex: number
}

export type StrokeSideResolutionResult =
  | {
      status: 'resolved'
      selectedSide: 1 | -1
      offsetDistance: number
      leftVotes: number
      rightVotes: number
    }
  | {
      status: 'blocked'
      reason:
        | 'unsupported-input'
        | 'ambiguous-fill-side'
        | 'missing-probe-frame'
      leftVotes: number
      rightVotes: number
    }

export type StrokeOrientationSideResolutionResult =
  | {
      status: 'resolved'
      selectedSide: 1 | -1
      offsetDistance: number
      signedArea: number
    }
  | {
      status: 'blocked'
      reason: 'unsupported-input' | 'degenerate-orientation'
      signedArea: number
    }

interface SourceSegmentFrame {
  point: Vec2
  tangent: Vec2
}

const normalizeVector = (point: Vec2): Vec2 | null => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPS) {
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

const crossPoints = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const getSignedArea = (points: Vec2[]) => {
  if (points.length < 3) {
    return 0
  }

  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    total += crossPoints(current, next)
  }

  return total / 2
}

export const resolveSourcePathOrientationStrokeSide = ({
  sourcePath,
  topologyPoints,
  position,
  width
}: {
  sourcePath: Pick<PathGeometry, 'closed'>
  topologyPoints: Vec2[]
  position: 'inside' | 'outside'
  width: number
}): StrokeOrientationSideResolutionResult => {
  if (
    sourcePath.closed !== true ||
    topologyPoints.length < 3 ||
    width <= EPS ||
    (position !== 'inside' && position !== 'outside')
  ) {
    return {
      status: 'blocked',
      reason: 'unsupported-input',
      signedArea: 0
    }
  }

  const signedArea = getSignedArea(topologyPoints)
  if (Math.abs(signedArea) <= EPS) {
    return {
      status: 'blocked',
      reason: 'degenerate-orientation',
      signedArea
    }
  }

  const inwardSide: 1 | -1 = signedArea >= 0 ? 1 : -1
  const selectedSide: 1 | -1 =
    position === 'inside' ? inwardSide : inwardSide === 1 ? -1 : 1

  return {
    status: 'resolved',
    selectedSide,
    offsetDistance: selectedSide * width,
    signedArea
  }
}

const getCubicLengthAtT = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= EPS) {
    return 0
  }
  if (t >= 1 - EPS) {
    return segment.length
  }
  return segment.curve.split(0, t).length()
}

const getCubicTAtLength = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= EPS) {
    return 0
  }
  if (targetLength >= segment.length - EPS) {
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

const getSourcePathSegmentRanges = (
  sourcePath: Pick<PathGeometry, 'segments'>
) => {
  let cursor = 0
  return sourcePath.segments.map((segment, index) => {
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const getSegmentFrameAtLocalLength = (
  segment: PathSegment | undefined,
  localLength: number
): SourceSegmentFrame | null => {
  if (!segment || segment.length <= EPS) {
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

const getSourceRangeProbeFrame = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  range: SourcePathSideRange,
  ratio: number
) => {
  const segment = sourcePath.segments[range.segmentIndex]
  const segmentRange =
    getSourcePathSegmentRanges(sourcePath)[range.segmentIndex]
  if (!segment || !segmentRange) {
    return null
  }

  const rangeStart = Math.max(range.startDistance, segmentRange.startDistance)
  const rangeEnd = Math.min(range.endDistance, segmentRange.endDistance)
  const rangeLength = Math.max(0, rangeEnd - rangeStart)
  const localLength =
    rangeStart - segmentRange.startDistance + rangeLength * ratio
  return getSegmentFrameAtLocalLength(segment, localLength)
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
        ) > EPS
      ) {
        winding += 1
      }
      continue
    }

    if (
      next.y <= point.y &&
      crossPoints(subtractPoint(next, current), subtractPoint(point, current)) <
        -EPS
    ) {
      winding -= 1
    }
  }

  return winding
}

export const isPointInStrokeFillDomain = (
  point: Vec2,
  polygon: Vec2[],
  fillRule: PathTopologyFillRule
) =>
  fillRule === 'nonzero'
    ? getWindingContribution(point, polygon) !== 0
    : isPointInPolygonEvenOdd(point, polygon)

const isPointInStrokeFillRegion = (point: Vec2, region: PolygonRegion) =>
  region.polygons.some((polygon) => isPointInPolygonEvenOdd(point, polygon))

const isPointInStrokeFillEvidence = ({
  point,
  topologyPoints,
  fillRule,
  fillRegions
}: {
  point: Vec2
  topologyPoints: Vec2[]
  fillRule: PathTopologyFillRule
  fillRegions?: PolygonRegion[]
}) =>
  fillRegions && fillRegions.length > 0
    ? fillRegions.some((region) => isPointInStrokeFillRegion(point, region))
    : isPointInStrokeFillDomain(point, topologyPoints, fillRule)

export const resolveSourcePathStrokeSide = ({
  sourcePath,
  topologyPoints,
  fillRule,
  position,
  width,
  range,
  fillRegions
}: {
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
  topologyPoints: Vec2[]
  fillRule: PathTopologyFillRule
  position: 'inside' | 'outside'
  width: number
  range: SourcePathSideRange
  fillRegions?: PolygonRegion[]
}): StrokeSideResolutionResult => {
  if (
    sourcePath.closed !== true ||
    topologyPoints.length < 3 ||
    width <= EPS ||
    (position !== 'inside' && position !== 'outside')
  ) {
    return {
      status: 'blocked',
      reason: 'unsupported-input',
      leftVotes: 0,
      rightVotes: 0
    }
  }

  const probeDistances = [
    Math.min(0.35, Math.max(0.1, width * 0.03)),
    Math.min(1, Math.max(0.25, width * 0.08)),
    Math.min(2, Math.max(0.5, width * 0.2)),
    Math.max(1, width * 0.5),
    Math.max(1.5, width * 0.85),
    Math.max(2, width)
  ]
  const probeRatios = [
    0.05, 0.1, 0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85, 0.9, 0.95
  ]
  let leftVotes = 0
  let rightVotes = 0
  let frameCount = 0

  for (const ratio of probeRatios) {
    const frame = getSourceRangeProbeFrame(sourcePath, range, ratio)
    if (!frame) {
      continue
    }
    frameCount += 1

    for (const probeDistance of probeDistances) {
      const leftProbe = getSegmentFrameOffsetPoint(frame, probeDistance)
      const rightProbe = getSegmentFrameOffsetPoint(frame, -probeDistance)
      if (!leftProbe || !rightProbe) {
        continue
      }

      const leftInside = isPointInStrokeFillEvidence({
        point: leftProbe,
        topologyPoints,
        fillRule,
        fillRegions
      })
      const rightInside = isPointInStrokeFillEvidence({
        point: rightProbe,
        topologyPoints,
        fillRule,
        fillRegions
      })

      if (leftInside === rightInside) {
        continue
      }

      if (position === 'inside') {
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

  if (frameCount === 0) {
    return {
      status: 'blocked',
      reason: 'missing-probe-frame',
      leftVotes,
      rightVotes
    }
  }

  if (leftVotes === rightVotes) {
    return {
      status: 'blocked',
      reason: 'ambiguous-fill-side',
      leftVotes,
      rightVotes
    }
  }

  const selectedSide = leftVotes > rightVotes ? 1 : -1
  return {
    status: 'resolved',
    selectedSide,
    offsetDistance: selectedSide * width,
    leftVotes,
    rightVotes
  }
}
