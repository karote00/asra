import { Bezier } from 'bezier-js'
import type { GeometryPoint } from '@asyra/core'
import type {
  VectorAnchorType,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'

export interface Vec2 extends GeometryPoint {}

export type PathSegment =
  | {
      type: 'line'
      start: Vec2
      end: Vec2
      length: number
      startAnchorType?: VectorAnchorType
      endAnchorType?: VectorAnchorType
      revisionKey?: string
    }
  | {
      type: 'cubic'
      start: Vec2
      control1: Vec2
      control2: Vec2
      end: Vec2
      curve: Bezier
      length: number
      startAnchorType?: VectorAnchorType
      endAnchorType?: VectorAnchorType
      revisionKey?: string
    }

export interface PathGeometry {
  segments: PathSegment[]
  closed: boolean
  totalLength: number
  sampledPoints: Vec2[]
  segmentDistanceRanges?: PathSegmentDistanceRange[]
  sampledSegmentPoints?: Vec2[][]
  sampledSegmentDistances?: number[][]
  traceSampleTolerance?: number
  traceSampleOptions?: PathSliceSamplingOptions
}

export interface PathSegmentDistanceRange {
  index: number
  startDistance: number
  endDistance: number
}

export interface VectorSegmentGeometryFrameCacheEntry {
  key: string
  segment: PathSegment
  sampledPoints: Vec2[]
  sampledDistances: number[]
}

export interface VectorSegmentGeometryFrameCache {
  entries: Map<string, VectorSegmentGeometryFrameCacheEntry>
}

export interface PathSampleFrame {
  point: Vec2
  tangent: Vec2
  sharpJoin?: boolean
}

export interface PathSliceSamplingOptions {
  minCubicSamples?: number
  maxCubicSamples?: number
  useRangeLengthForSampleCount?: boolean
}

export interface PathGeometryBuildOptions {
  sampleTolerance?: number
  sampleOptions?: PathSliceSamplingOptions
  cacheKey?: string
}

const EPS = 1e-6
const CURVE_TESSELLATION_TOLERANCE = 0.25

const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const samePoint = (a: Vec2, b: Vec2, tolerance = EPS) =>
  distance(a, b) <= tolerance

const dedupeAdjacentPoints = (points: Vec2[]) => {
  if (points.length <= 1) {
    return [...points]
  }

  const result = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    if (distance(result[result.length - 1], points[i]) > EPS) {
      result.push(points[i])
    }
  }
  return result
}

const dedupeClosedPolygonPoints = (points: Vec2[]) => {
  const deduped = dedupeAdjacentPoints(points)
  if (
    deduped.length > 2 &&
    distance(deduped[0], deduped[deduped.length - 1]) <= EPS
  ) {
    deduped.pop()
  }
  return deduped
}

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= EPS) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const getSegmentStartTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalizeVector({
      x: segment.control1.x - segment.start.x,
      y: segment.control1.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.control2.x - segment.start.x,
      y: segment.control2.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const mergePointLists = (head: Vec2[], tail: Vec2[]) => {
  if (head.length === 0) {
    return [...tail]
  }
  if (tail.length === 0) {
    return [...head]
  }

  if (samePoint(head[head.length - 1], tail[0])) {
    return [...head, ...tail.slice(1)]
  }

  return [...head, ...tail]
}

const toBezier = (segment: Extract<PathSegment, { type: 'cubic' }>) =>
  segment.curve

const getCurveLengthAtT = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= EPS) {
    return 0
  }
  if (t >= 1 - EPS) {
    return segment.length
  }

  return toBezier(segment).split(0, t).length()
}

const curveLengthTCache = new WeakMap<
  Extract<PathSegment, { type: 'cubic' }>,
  Map<number, number>
>()

const getCurveTAtLength = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= EPS) {
    return 0
  }
  if (targetLength >= segment.length - EPS) {
    return 1
  }

  const cachedByLength = curveLengthTCache.get(segment)
  const cached = cachedByLength?.get(targetLength)
  if (cached !== undefined) {
    return cached
  }

  let low = 0
  let high = 1
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2
    if (getCurveLengthAtT(segment, mid) < targetLength) {
      low = mid
    } else {
      high = mid
    }
  }
  const t = (low + high) / 2
  if (cachedByLength) {
    cachedByLength.set(targetLength, t)
  } else {
    curveLengthTCache.set(segment, new Map([[targetLength, t]]))
  }
  return t
}

const sampleLineSegmentFrames = (
  segment: Extract<PathSegment, { type: 'line' }>,
  startLength: number,
  endLength: number
): PathSampleFrame[] => {
  const total = Math.max(EPS, segment.length)
  const t0 = Math.max(0, Math.min(1, startLength / total))
  const t1 = Math.max(0, Math.min(1, endLength / total))
  const tangent = normalizeVector({
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y
  }) ?? { x: 1, y: 0 }

  return dedupeAdjacentPoints([
    {
      x: segment.start.x + (segment.end.x - segment.start.x) * t0,
      y: segment.start.y + (segment.end.y - segment.start.y) * t0
    },
    {
      x: segment.start.x + (segment.end.x - segment.start.x) * t1,
      y: segment.start.y + (segment.end.y - segment.start.y) * t1
    }
  ]).map((point) => ({
    point,
    tangent
  }))
}

const sampleCubicSegmentFrames = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  startLength: number,
  endLength: number,
  tolerance: number,
  samplingOptions: PathSliceSamplingOptions = {}
): PathSampleFrame[] => {
  const t0 = getCurveTAtLength(segment, startLength)
  const t1 = getCurveTAtLength(segment, endLength)
  const isFullSegmentRange = t0 <= EPS && t1 >= 1 - EPS
  const splitCurve = isFullSegmentRange
    ? toBezier(segment)
    : toBezier(segment).split(t0, t1)
  const minSamples = samplingOptions.minCubicSamples ?? 8
  const maxSamples = samplingOptions.maxCubicSamples ?? 256
  const sampleLength =
    samplingOptions.useRangeLengthForSampleCount === true
      ? endLength - startLength
      : isFullSegmentRange
        ? segment.length
        : splitCurve.length()
  const sampleCount = Math.max(
    minSamples,
    Math.min(maxSamples, Math.ceil(sampleLength / Math.max(0.2, tolerance)))
  )
  const sampledFrames: {
    point: Vec2
    tangent: Vec2 | null
  }[] = []

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount
    const point = splitCurve.get(t) as { x: number; y: number }
    const derivative = splitCurve.derivative(t) as { x: number; y: number }
    const tangent = normalizeVector({
      x: derivative.x,
      y: derivative.y
    })

    sampledFrames.push({
      point: { x: point.x, y: point.y },
      tangent
    })
  }

  const defaultStartTangent = sampledFrames.find((frame) => frame.tangent)
    ?.tangent ??
    getSegmentStartTangent(segment) ?? { x: 1, y: 0 }
  const nextTangents: (Vec2 | null)[] = new Array(sampledFrames.length).fill(
    null
  )
  let nextTangent: Vec2 | null = null
  for (let index = sampledFrames.length - 1; index >= 0; index -= 1) {
    nextTangents[index] = nextTangent
    if (sampledFrames[index].tangent) {
      nextTangent = sampledFrames[index].tangent
    }
  }
  const frames: PathSampleFrame[] = []

  for (let index = 0; index < sampledFrames.length; index += 1) {
    const tangent =
      sampledFrames[index].tangent ??
      (index > 0 ? (frames[index - 1]?.tangent ?? null) : null) ??
      nextTangents[index] ??
      defaultStartTangent
    frames.push({
      point: sampledFrames[index].point,
      tangent
    })
  }

  return frames
}

const slicePathSegmentFrames = (
  segment: PathSegment,
  startLength: number,
  endLength: number,
  tolerance: number,
  samplingOptions?: PathSliceSamplingOptions
): PathSampleFrame[] => {
  if (endLength - startLength <= EPS) {
    return []
  }

  return segment.type === 'line'
    ? sampleLineSegmentFrames(segment, startLength, endLength)
    : sampleCubicSegmentFrames(
        segment,
        startLength,
        endLength,
        tolerance,
        samplingOptions
      )
}

export const samplePathSegmentFrameAtLength = (
  segment: PathSegment,
  length: number
): PathSampleFrame => {
  if (segment.type === 'line') {
    return (
      sampleLineSegmentFrames(segment, length, length)[0] ?? {
        point: segment.start,
        tangent: getSegmentStartTangent(segment) ?? { x: 1, y: 0 }
      }
    )
  }

  const t = getCurveTAtLength(segment, length)
  const point = segment.curve.get(t) as { x: number; y: number }
  const derivative = segment.curve.derivative(t) as { x: number; y: number }
  return {
    point: { x: point.x, y: point.y },
    tangent: normalizeVector({
      x: derivative.x,
      y: derivative.y
    }) ??
      getSegmentStartTangent(segment) ?? { x: 1, y: 0 }
  }
}

export const samplePathSegmentFramesByLengthStep = (
  segment: PathSegment,
  startLength: number,
  endLength: number,
  tolerance = CURVE_TESSELLATION_TOLERANCE,
  samplingOptions: PathSliceSamplingOptions = {}
): PathSampleFrame[] =>
  slicePathSegmentFrames(
    segment,
    startLength,
    endLength,
    tolerance,
    samplingOptions
  )

export const slicePathSegmentPoints = (
  segment: PathSegment,
  startLength: number,
  endLength: number,
  tolerance = CURVE_TESSELLATION_TOLERANCE,
  samplingOptions?: PathSliceSamplingOptions
): Vec2[] =>
  slicePathSegmentFrames(
    segment,
    startLength,
    endLength,
    tolerance,
    samplingOptions
  ).map((frame) => frame.point)

const samplePathSegment = (
  segment: PathSegment,
  tolerance: number,
  samplingOptions?: PathSliceSamplingOptions
): Vec2[] =>
  slicePathSegmentPoints(segment, 0, segment.length, tolerance, samplingOptions)

const buildCumulativePointDistances = (points: Vec2[]) => {
  const distances = [0]
  for (let index = 1; index < points.length; index += 1) {
    distances.push(
      distances[distances.length - 1] +
        distance(points[index - 1], points[index])
    )
  }
  return distances
}

const slicePathGeometryPointRange = (
  path: Pick<PathGeometry, 'segments'>,
  startLength: number,
  endLength: number,
  tolerance: number,
  samplingOptions?: PathSliceSamplingOptions
) => {
  if (endLength <= startLength || path.segments.length === 0) {
    return []
  }

  let cursor = 0
  const points: Vec2[] = []

  for (const segment of path.segments) {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.length
    cursor = segmentEnd

    if (
      segment.length <= EPS ||
      segmentEnd <= startLength ||
      segmentStart >= endLength
    ) {
      continue
    }

    const overlapStart = Math.max(startLength, segmentStart)
    const overlapEnd = Math.min(endLength, segmentEnd)
    const segmentPoints = slicePathSegmentFrames(
      segment,
      overlapStart - segmentStart,
      overlapEnd - segmentStart,
      tolerance,
      samplingOptions
    ).map((frame) => frame.point)

    if (segmentPoints.length === 0) {
      continue
    }

    const previous = points[points.length - 1]
    if (previous && samePoint(previous, segmentPoints[0])) {
      points.push(...segmentPoints.slice(1))
    } else {
      points.push(...segmentPoints)
    }
  }

  return dedupeAdjacentPoints(points)
}

const slicePathGeometryFrameRange = (
  path: Pick<PathGeometry, 'segments'>,
  startLength: number,
  endLength: number,
  tolerance: number,
  samplingOptions?: PathSliceSamplingOptions
) => {
  if (endLength <= startLength || path.segments.length === 0) {
    return []
  }

  let cursor = 0
  const frames: PathSampleFrame[] = []

  for (const segment of path.segments) {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.length
    cursor = segmentEnd

    if (
      segment.length <= EPS ||
      segmentEnd <= startLength ||
      segmentStart >= endLength
    ) {
      continue
    }

    const overlapStart = Math.max(startLength, segmentStart)
    const overlapEnd = Math.min(endLength, segmentEnd)
    const segmentFrames = slicePathSegmentFrames(
      segment,
      overlapStart - segmentStart,
      overlapEnd - segmentStart,
      tolerance,
      samplingOptions
    )

    if (segmentFrames.length === 0) {
      continue
    }

    const previous = frames[frames.length - 1]
    if (previous && samePoint(previous.point, segmentFrames[0].point)) {
      previous.sharpJoin =
        previous.sharpJoin === true || segment.startAnchorType === 'sharp'
      frames.push(...segmentFrames.slice(1))
    } else {
      frames.push(...segmentFrames)
    }
  }

  return frames
}

export const slicePathGeometryPoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  startLength: number,
  endLength: number,
  wrapsSeam: boolean,
  tolerance = CURVE_TESSELLATION_TOLERANCE,
  samplingOptions?: PathSliceSamplingOptions
) => {
  if (!wrapsSeam) {
    return slicePathGeometryPointRange(
      path,
      startLength,
      endLength,
      tolerance,
      samplingOptions
    )
  }

  const tail = slicePathGeometryPointRange(
    path,
    startLength,
    path.totalLength,
    tolerance,
    samplingOptions
  )
  const head = slicePathGeometryPointRange(
    path,
    0,
    endLength,
    tolerance,
    samplingOptions
  )
  return dedupeAdjacentPoints(mergePointLists(tail, head))
}

export const slicePathGeometryFrames = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  startLength: number,
  endLength: number,
  wrapsSeam: boolean,
  tolerance = CURVE_TESSELLATION_TOLERANCE,
  samplingOptions?: PathSliceSamplingOptions
) => {
  if (!wrapsSeam) {
    return slicePathGeometryFrameRange(
      path,
      startLength,
      endLength,
      tolerance,
      samplingOptions
    )
  }

  const tail = slicePathGeometryFrameRange(
    path,
    startLength,
    path.totalLength,
    tolerance,
    samplingOptions
  )
  const head = slicePathGeometryFrameRange(
    path,
    0,
    endLength,
    tolerance,
    samplingOptions
  )
  if (tail.length === 0) {
    return head
  }
  if (head.length === 0) {
    return tail
  }

  if (samePoint(tail[tail.length - 1].point, head[0].point)) {
    return [
      ...tail.slice(0, -1),
      {
        ...tail[tail.length - 1],
        sharpJoin: tail[tail.length - 1].sharpJoin === true
      },
      ...head.slice(1)
    ]
  }

  return [...tail, ...head]
}

const getAnchorNode = (
  points: Record<string, VectorPointNode>,
  pointId: string | undefined
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'anchor') {
    return null
  }
  return point
}

const getControlNode = (
  points: Record<string, VectorPointNode>,
  pointId?: string | null
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'control') {
    return null
  }
  return point
}

const buildSegmentGeometryRevisionKey = (
  segment: VectorSegment,
  points: Record<string, VectorPointNode>
) => {
  const pointIds = [
    segment.startId,
    segment.outControlId,
    segment.inControlId,
    segment.endId
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)

  return [
    segment.id,
    segment.startId,
    segment.outControlId ?? '',
    segment.inControlId ?? '',
    segment.endId,
    ...pointIds.map((pointId) => {
      const point = points[pointId]
      return point
        ? [
            point.id,
            point.kind,
            point.x,
            point.y,
            point.kind === 'anchor' ? (point.anchorType ?? '') : '',
            point.kind === 'control' ? (point.controlRole ?? '') : ''
          ].join(':')
        : `${pointId}:missing`
    })
  ].join('|')
}

const buildPathSegmentGeometry = (
  segment: VectorSegment,
  points: Record<string, VectorPointNode>
): PathSegment | null => {
  const start = getAnchorNode(points, segment.startId)
  const end = getAnchorNode(points, segment.endId)
  if (!start || !end) {
    return null
  }

  const outControl = getControlNode(points, segment.outControlId)
  const inControl = getControlNode(points, segment.inControlId)
  if (!outControl && !inControl) {
    return {
      type: 'line',
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      length: Math.hypot(end.x - start.x, end.y - start.y),
      startAnchorType: start.anchorType ?? 'sharp',
      endAnchorType: end.anchorType ?? 'sharp'
    }
  }

  const cubicSegment: Extract<PathSegment, { type: 'cubic' }> = {
    type: 'cubic',
    start: { x: start.x, y: start.y },
    control1: outControl
      ? { x: outControl.x, y: outControl.y }
      : { x: start.x, y: start.y },
    control2: inControl
      ? { x: inControl.x, y: inControl.y }
      : { x: end.x, y: end.y },
    end: { x: end.x, y: end.y },
    curve: new Bezier(
      { x: start.x, y: start.y },
      outControl
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y },
      inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
      { x: end.x, y: end.y }
    ),
    length: 0,
    startAnchorType: start.anchorType ?? 'sharp',
    endAnchorType: end.anchorType ?? 'sharp'
  }
  cubicSegment.length = cubicSegment.curve.length()
  return cubicSegment
}

const buildPathGeometry = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  cache?: VectorSegmentGeometryFrameCache,
  options?: PathGeometryBuildOptions
): PathGeometry => {
  const pathSegments: PathSegment[] = []
  const segmentDistanceRanges: PathSegmentDistanceRange[] = []
  const sampledSegments: Vec2[][] = []
  const sampledSegmentDistances: number[][] = []
  let totalLength = 0
  const usedSegmentIds = new Set<string>()
  const sampleTolerance =
    options?.sampleTolerance ?? CURVE_TESSELLATION_TOLERANCE
  const samplingCacheKey =
    options?.cacheKey ??
    `sample:${sampleTolerance}:${options?.sampleOptions?.minCubicSamples ?? ''}:${options?.sampleOptions?.maxCubicSamples ?? ''}:${options?.sampleOptions?.useRangeLengthForSampleCount ?? ''}`

  network.segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }
    usedSegmentIds.add(segmentId)

    const revisionKey = [
      samplingCacheKey,
      buildSegmentGeometryRevisionKey(segment, points)
    ].join('|')
    const cached = cache?.entries.get(segmentId)
    if (cached?.key === revisionKey) {
      const startDistance = totalLength
      totalLength += cached.segment.length
      pathSegments.push(cached.segment)
      segmentDistanceRanges.push({
        index: pathSegments.length - 1,
        startDistance,
        endDistance: totalLength
      })
      sampledSegments.push(cached.sampledPoints)
      sampledSegmentDistances.push(cached.sampledDistances)
      return
    }

    const pathSegment = buildPathSegmentGeometry(segment, points)
    if (!pathSegment) {
      return
    }
    pathSegment.revisionKey = revisionKey
    const sampledPoints = samplePathSegment(
      pathSegment,
      sampleTolerance,
      options?.sampleOptions
    )
    const sampledDistances = buildCumulativePointDistances(sampledPoints)
    const startDistance = totalLength
    totalLength += pathSegment.length
    pathSegments.push(pathSegment)
    segmentDistanceRanges.push({
      index: pathSegments.length - 1,
      startDistance,
      endDistance: totalLength
    })
    sampledSegments.push(sampledPoints)
    sampledSegmentDistances.push(sampledDistances)
    cache?.entries.set(segmentId, {
      key: revisionKey,
      segment: pathSegment,
      sampledPoints,
      sampledDistances
    })
  })
  cache?.entries.forEach((_entry, segmentId) => {
    if (!usedSegmentIds.has(segmentId)) {
      cache.entries.delete(segmentId)
    }
  })

  const mergedSampledPoints: Vec2[] = []
  sampledSegments.forEach((sampled) => {
    if (sampled.length === 0) {
      return
    }
    if (mergedSampledPoints.length === 0) {
      mergedSampledPoints.push(...sampled)
      return
    }
    const startIndex = samePoint(
      mergedSampledPoints[mergedSampledPoints.length - 1],
      sampled[0]
    )
      ? 1
      : 0
    for (let index = startIndex; index < sampled.length; index += 1) {
      mergedSampledPoints.push(sampled[index])
    }
  })
  const sampledPoints = dedupeAdjacentPoints(mergedSampledPoints)

  return {
    segments: pathSegments,
    closed: network.closed,
    totalLength,
    sampledPoints,
    segmentDistanceRanges,
    sampledSegmentPoints: sampledSegments,
    sampledSegmentDistances,
    traceSampleTolerance: sampleTolerance,
    traceSampleOptions: options?.sampleOptions
  }
}

export const buildVectorGeometryModelPath = buildPathGeometry

export const buildPolylineGeometryModelPath = (
  points: Vec2[],
  closed: boolean
): PathGeometry => {
  const sampledPoints = closed ? dedupeClosedPolygonPoints(points) : [...points]
  if (sampledPoints.length < 2) {
    return {
      segments: [],
      closed,
      totalLength: 0,
      sampledPoints,
      segmentDistanceRanges: [],
      sampledSegmentPoints: [],
      sampledSegmentDistances: []
    }
  }

  const segments: PathSegment[] = []
  const segmentDistanceRanges: PathSegmentDistanceRange[] = []
  let totalLength = 0

  for (let i = 0; i < sampledPoints.length - 1; i += 1) {
    const start = sampledPoints[i]
    const end = sampledPoints[i + 1]
    const length = distance(start, end)
    const startDistance = totalLength
    totalLength += length
    segments.push({
      type: 'line',
      start,
      end,
      length,
      startAnchorType: 'sharp',
      endAnchorType: 'sharp'
    })
    segmentDistanceRanges.push({
      index: segments.length - 1,
      startDistance,
      endDistance: totalLength
    })
  }

  if (closed && sampledPoints.length > 2) {
    const start = sampledPoints[sampledPoints.length - 1]
    const end = sampledPoints[0]
    const length = distance(start, end)
    const startDistance = totalLength
    totalLength += length
    segments.push({
      type: 'line',
      start,
      end,
      length,
      startAnchorType: 'sharp',
      endAnchorType: 'sharp'
    })
    segmentDistanceRanges.push({
      index: segments.length - 1,
      startDistance,
      endDistance: totalLength
    })
  }

  return {
    segments,
    closed,
    totalLength,
    sampledPoints,
    segmentDistanceRanges,
    sampledSegmentPoints: segments.map((segment) => [
      segment.start,
      segment.end
    ]),
    sampledSegmentDistances: segments.map((segment) => [0, segment.length])
  }
}
