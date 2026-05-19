import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import {
  attachStrokePacketDebugMeta,
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import {
  buildConstrainedDashedStrokeProductVisualEntries,
  buildConstrainedDashedStrokeResolvedPackets,
  getConstrainedDashedVisibleIntervals
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import {
  classifyConstrainedDashedInterval,
  classifyConstrainedDashedOwnership,
  classifyConstrainedDashedRuntimeStatus,
  classifyConstrainedDashedSource,
  hasConstrainedDashedStrokeIntent
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import { getRenderableStrokes } from '../components/stroke-render/renderable-stroke'
import { buildEllipseLoop } from '../components/stroke-render/ellipse-path'
import {
  buildPolylineGeometryModelPath,
  buildVectorGeometryModelPath,
  samplePathSegmentFramesByLengthStep,
  slicePathGeometryPoints
} from '../components/stroke-render/path-geometry'
import { resolveSourcePathStrokeSide } from '../components/stroke-render/stroke-side-resolution'
import { buildConstrainedDashedLocalSideStrokePolygons } from '../components/stroke-render/constrained-dashed-local-side-geometry'
import { buildDashedCenterRibbonGeometry } from '../components/stroke-render/dashed-center-ribbon-geometry'
import { isSimpleClosedPolygon } from '../components/stroke-render/solid-stroke-geometry-core'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { resolveSourceFamily } from '../components/stroke-render/resolved-source-family'
import { resolveStrokeDomains } from '../components/stroke-render/stroke-domain-plan'
import {
  getGeometryBackend,
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import type { PolygonRegion } from '../components/stroke-render/geometry-backend'
import {
  collapseStrokeFinalFaceVisualOverlaps,
  type ArrangedStrokeFinalFace
} from '../components/stroke-render/stroke-candidate-arrangement'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import {
  FillKinds,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

beforeAll(async () => {
  const backendId = 'clipper2-constrained-dashed-packets-test'
  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId,
    backendVersion: `${backendId}@test`
  })
  registerGeometryBackend({
    backendId,
    load: () => backend
  })
  selectGeometryBackend(backendId)
})

const getOnlyRenderableStroke = (
  strokes: Parameters<typeof getRenderableStrokes>[0]
) => {
  const [stroke] = getRenderableStrokes(strokes)
  if (!stroke) {
    throw new Error('Expected one renderable stroke')
  }
  return stroke
}

const buildSelfIntersectingSourcePathTestOptions = (
  points: { x: number; y: number }[]
) => {
  const sourcePath = buildPolylineGeometryModelPath(points, true)
  const topology = buildPathTopologyModel({
    pathId: 'self-intersecting-source-path-test',
    networkId: 'self-intersecting-source-path-test',
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'self-intersecting-source-path-test:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  return {
    topology,
    sourcePath,
    implicitFillRegions:
      resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? [],
    sharedSourceSplitRanges:
      resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? [],
    clipInsideToFillDomain: true,
    constrainedDashedVisualMode: 'product-final' as const
  }
}

const getImplicitFillRegionsForTest = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
): PolygonRegion[] => {
  const topology = buildPathTopologyModel({
    pathId: 'rule-driven-implicit-fill-regions',
    networkId: 'rule-driven-implicit-fill-regions',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  if (topology.topologyFamily !== 'self-intersecting') {
    return []
  }

  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'rule-driven-implicit-fill-regions:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })

  return resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? []
}

const cubicPoint = (
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) => {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  return {
    x:
      mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  }
}

const sampleCubic = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number,
  includeStart = true
) => {
  const points: { x: number; y: number }[] = []
  for (let index = includeStart ? 0 : 1; index <= steps; index += 1) {
    points.push(cubicPoint(index / steps, p0, p1, p2, p3))
  }
  return points
}

const getPointBounds = (points: { x: number; y: number }[]) => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y))
})

const getPacketAggregateBounds = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  getPointBounds(packets.flatMap((packet) => packet.geometry.polygons).flat())

const pointDistance = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => Math.hypot(to.x - from.x, to.y - from.y)

const countSharedVertices = (
  first: { x: number; y: number }[],
  second: { x: number; y: number }[]
) =>
  first.filter((firstPoint) =>
    second.some((secondPoint) => pointDistance(firstPoint, secondPoint) <= 1e-4)
  ).length

const pointSegmentDistance = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return pointDistance(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return pointDistance(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const pointPolylineDistance = (
  point: { x: number; y: number },
  polyline: { x: number; y: number }[]
) => {
  if (polyline.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (polyline.length === 1) {
    return pointDistance(point, polyline[0])
  }

  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polyline.length - 1; index += 1) {
    minDistance = Math.min(
      minDistance,
      pointSegmentDistance(point, polyline[index], polyline[index + 1])
    )
  }
  return minDistance
}

const pointClosedPolylineDistance = (
  point: { x: number; y: number },
  polyline: { x: number; y: number }[]
) => {
  if (polyline.length < 2) {
    return pointPolylineDistance(point, polyline)
  }

  return Math.min(
    pointPolylineDistance(point, polyline),
    pointSegmentDistance(point, polyline[polyline.length - 1], polyline[0])
  )
}

const samplePolygonEdges = (
  polygon: { x: number; y: number }[],
  maxStep = 1
) => {
  const samples: { x: number; y: number }[] = []
  if (polygon.length < 2) {
    return samples
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const length = pointDistance(start, end)
    const steps = Math.max(1, Math.ceil(length / maxStep))
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      samples.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      })
    }
  }

  return samples
}

const getPolygonEdges = (polygon: { x: number; y: number }[]) =>
  polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    return {
      start,
      end,
      length: pointDistance(start, end),
      midpoint: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      }
    }
  })

const getMaxRoundCapEdgeLength = (
  polygons: { x: number; y: number }[][],
  centers: { x: number; y: number }[],
  radius: number
) => {
  const capEdges = polygons
    .flatMap((polygon) => getPolygonEdges(polygon))
    .filter(
      (edge) =>
        edge.length > 1e-6 &&
        edge.length < radius &&
        centers.some(
          (center) => pointDistance(edge.midpoint, center) <= radius + 0.5
        )
    )

  return Math.max(...capEdges.map((edge) => edge.length))
}

const findRoundCapArcEdgesNearBoundary = (
  polygons: { x: number; y: number }[][],
  boundaryPoint: { x: number; y: number },
  sourceEdge: { x: number; y: number }[],
  options: {
    radius: number
    maxEdgeLength?: number
    maxSourceDistance?: number
    sourceDistance?: number
  } = {
    radius: 12
  }
) =>
  polygons.flatMap((polygon) =>
    getPolygonEdges(polygon).flatMap((edge) => {
      const sourceDistance = pointPolylineDistance(edge.midpoint, sourceEdge)
      return edge.length <= (options.maxEdgeLength ?? 0.75) &&
        pointDistance(edge.midpoint, boundaryPoint) <= options.radius &&
        sourceDistance >= (options.sourceDistance ?? 1.25) &&
        sourceDistance <= (options.maxSourceDistance ?? options.radius - 1)
        ? [
            {
              length: Math.round(edge.length * 100) / 100,
              sourceDistance: Math.round(sourceDistance * 100) / 100,
              midpoint: {
                x: Math.round(edge.midpoint.x * 100) / 100,
                y: Math.round(edge.midpoint.y * 100) / 100
              }
            }
          ]
        : []
    })
  )

const isPointInsideEvenOdd = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (crosses) {
      inside = !inside
    }
  }

  return inside
}

const isPointOnPolygonBoundary = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[],
  tolerance = 0.75
) => {
  if (polygon.length === 0) {
    return false
  }

  for (let index = 0; index < polygon.length; index += 1) {
    if (
      pointSegmentDistance(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      ) <= tolerance
    ) {
      return true
    }
  }

  return false
}

const isPointCoveredByPolygons = (
  point: { x: number; y: number },
  polygons: { x: number; y: number }[][],
  tolerance = 0.75
) =>
  polygons.some(
    (polygon) =>
      isPointInsideEvenOdd(point, polygon) ||
      isPointOnPolygonBoundary(point, polygon, tolerance)
  )

const getPointPolygonCoverageCount = (
  point: { x: number; y: number },
  polygons: { x: number; y: number }[][],
  tolerance = 0.75
) =>
  polygons.filter(
    (polygon) =>
      isPointInsideEvenOdd(point, polygon) ||
      isPointOnPolygonBoundary(point, polygon, tolerance)
  ).length

const isPointInsideEvenOddLegalDomain = (
  point: { x: number; y: number },
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  tolerance = 0.75
) =>
  isPointInsideEvenOdd(point, sourcePath.sampledPoints) ||
  isPointOnPolygonBoundary(point, sourcePath.sampledPoints, tolerance)

const signedPolygonArea = (points: { x: number; y: number }[]) => {
  let area = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    area += point.x * next.y - next.x * point.y
  })
  return area / 2
}

const getPathSegmentDistanceRanges = (segments: { length: number }[]) => {
  let cursor = 0
  return segments.map((segment, index) => {
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const getSourcePathSegmentRangesForTest = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
) =>
  getPathSegmentDistanceRanges(sourcePath.segments).map((range) => ({
    segmentIndex: range.index,
    startDistance: range.startDistance,
    endDistance: range.endDistance
  }))

const intervalContainsDistance = (
  distance: number,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean,
  totalLength: number
) =>
  isDistanceInsideInterval(
    distance,
    startDistance,
    endDistance,
    wrapsSeam,
    totalLength
  )

const normalizeVector = (point: { x: number; y: number }) => {
  const length = Math.hypot(point.x, point.y)
  if (length <= 1e-6) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

const isDistanceInsideInterval = (
  distance: number,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean,
  totalLength: number
) => {
  const normalizeDistance = (value: number) =>
    totalLength > 0 ? ((value % totalLength) + totalLength) % totalLength : 0
  const cursor = normalizeDistance(distance)
  const start = normalizeDistance(startDistance)
  const end = normalizeDistance(endDistance)

  if (wrapsSeam) {
    return cursor >= start - 1e-6 || cursor <= end + 1e-6
  }

  return cursor >= start - 1e-6 && cursor <= end + 1e-6
}

interface StrokeEventMap {
  sourceBoundaries: {
    distance: number
    segmentIndex: number
    kind: 'seam' | 'sharp' | 'smooth' | 'high-curvature'
  }[]
  dashIntervals: {
    index: number
    startDistance: number
    endDistance: number
    wrapsSeam: boolean
    length: number
    crossingBoundaryCount: number
    squareEffectiveCrossingBoundaryCount: number
  }[]
}

const normalizeLoopDistanceForTest = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

const getSourcePathTangentAroundDistance = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  distance: number,
  direction: 'before' | 'after'
) => {
  const sampleLength = Math.min(6, Math.max(1, sourcePath.totalLength * 0.01))
  const start =
    direction === 'before'
      ? Math.max(0, distance - sampleLength)
      : Math.min(sourcePath.totalLength, distance + sampleLength)
  const end =
    direction === 'before'
      ? Math.max(0, distance)
      : Math.min(sourcePath.totalLength, distance + sampleLength * 2)
  const points =
    direction === 'before'
      ? slicePathGeometryPoints(sourcePath, start, end, false)
      : slicePathGeometryPoints(sourcePath, distance, end, false)
  if (points.length < 2) {
    return null
  }
  const first = points[0]
  const last = points[points.length - 1]
  return normalizeVector({
    x: last.x - first.x,
    y: last.y - first.y
  })
}

const getBoundaryKindForTest = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  segmentIndex: number,
  distance: number
): StrokeEventMap['sourceBoundaries'][number]['kind'] => {
  if (segmentIndex === 0) {
    return 'seam'
  }

  const previous = sourcePath.segments[segmentIndex - 1]
  const next = sourcePath.segments[segmentIndex]
  if (
    previous?.endAnchorType === 'sharp' ||
    next?.startAnchorType === 'sharp'
  ) {
    return 'sharp'
  }

  const before = getSourcePathTangentAroundDistance(
    sourcePath,
    distance,
    'before'
  )
  const after = getSourcePathTangentAroundDistance(
    sourcePath,
    distance,
    'after'
  )
  if (!before || !after) {
    return 'sharp'
  }

  const dot = Math.max(-1, Math.min(1, before.x * after.x + before.y * after.y))
  const angle = Math.acos(dot)
  return angle >= Math.PI / 5 ? 'high-curvature' : 'smooth'
}

const buildVisibleDashIntervalsForTest = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  stroke: ReturnType<typeof createDefaultStroke>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
) => {
  const topology = buildPathTopologyModel({
    pathId: 'stroke-event-map',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const [renderableStroke] = getRenderableStrokes([stroke])
  if (!renderableStroke) {
    return []
  }

  return getConstrainedDashedVisibleIntervals(
    topology,
    renderableStroke,
    sourcePath,
    resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({
        topology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions
    })
  ).map((interval) => ({
    index: Number(interval.intervalId.replace('interval:', '')),
    startDistance: interval.startDistance,
    endDistance: interval.endDistance,
    wrapsSeam: interval.wrapsSeam,
    length: interval.intervalLength
  }))
}

const buildStrokeEventMap = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  stroke: ReturnType<typeof createDefaultStroke>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
): StrokeEventMap => {
  const sourceRanges = getPathSegmentDistanceRanges(sourcePath.segments)
  const sourceBoundaries = sourceRanges.map((range) => ({
    distance: range.startDistance,
    segmentIndex: range.index,
    kind: getBoundaryKindForTest(sourcePath, range.index, range.startDistance)
  }))
  const dashIntervals = buildVisibleDashIntervalsForTest(
    sourcePath,
    stroke,
    implicitFillRegions
  ).map((interval) => {
    const capExtension = stroke.capType === 'square' ? stroke.width / 2 : 0
    const effectiveStart = normalizeLoopDistanceForTest(
      interval.startDistance - capExtension,
      sourcePath.totalLength
    )
    const effectiveEnd = normalizeLoopDistanceForTest(
      interval.endDistance + capExtension,
      sourcePath.totalLength
    )
    const effectiveWraps =
      interval.startDistance - capExtension < 0 ||
      interval.endDistance + capExtension > sourcePath.totalLength ||
      effectiveEnd < effectiveStart

    return {
      ...interval,
      crossingBoundaryCount: sourceBoundaries.filter(
        (boundary) =>
          boundary.kind !== 'seam' &&
          intervalContainsDistance(
            boundary.distance,
            interval.startDistance,
            interval.endDistance,
            interval.wrapsSeam,
            sourcePath.totalLength
          ) &&
          Math.abs(boundary.distance - interval.startDistance) > 1e-4 &&
          Math.abs(boundary.distance - interval.endDistance) > 1e-4
      ).length,
      squareEffectiveCrossingBoundaryCount: sourceBoundaries.filter(
        (boundary) =>
          boundary.kind !== 'seam' &&
          intervalContainsDistance(
            boundary.distance,
            effectiveStart,
            effectiveEnd,
            effectiveWraps,
            sourcePath.totalLength
          ) &&
          Math.abs(boundary.distance - effectiveStart) > 1e-4 &&
          Math.abs(boundary.distance - effectiveEnd) > 1e-4
      ).length
    }
  })

  return {
    sourceBoundaries,
    dashIntervals
  }
}

const getPacketAreaSum = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  packets.reduce(
    (sum, packet) =>
      sum +
      packet.geometry.polygons.reduce(
        (polygonSum, polygon) =>
          polygonSum + Math.abs(signedPolygonArea(polygon)),
        0
      ),
    0
  )

const getFinalFaceAreaSum = (
  faces: {
    polygons: { x: number; y: number }[][]
  }[]
) =>
  faces.reduce(
    (sum, face) =>
      sum +
      face.polygons.reduce(
        (polygonSum, polygon) =>
          polygonSum + Math.abs(signedPolygonArea(polygon)),
        0
      ),
    0
  )

const getIntervalPackets = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  intervalIndex: number
) =>
  packets.filter(
    (packet) =>
      packet.geometry.debugMeta?.intervalId === `interval:${intervalIndex}`
  )

const getRuleDrivenSourcePointAtDistance = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  distance: number
) => {
  const normalizedDistance = normalizeLoopDistanceForTest(
    distance,
    sourcePath.totalLength
  )
  const sampleWindow = Math.min(
    0.5,
    Math.max(0.02, sourcePath.totalLength * 0.0001)
  )
  const endDistance = Math.min(
    sourcePath.totalLength,
    normalizedDistance + sampleWindow
  )
  const forwardSamples =
    endDistance > normalizedDistance
      ? slicePathGeometryPoints(
          sourcePath,
          normalizedDistance,
          endDistance,
          false
        )
      : []
  if (forwardSamples[0]) {
    return forwardSamples[0]
  }

  const startDistance = Math.max(0, normalizedDistance - sampleWindow)
  const backwardSamples =
    normalizedDistance > startDistance
      ? slicePathGeometryPoints(
          sourcePath,
          startDistance,
          normalizedDistance,
          false
        )
      : []
  return backwardSamples[backwardSamples.length - 1]
}

const getRuleDrivenTangentAtDistance = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  distance: number
) => {
  const totalLength = sourcePath.totalLength
  if (totalLength <= 1e-6) {
    return null
  }

  const normalizedDistance = normalizeLoopDistanceForTest(distance, totalLength)
  const tangentReach = Math.max(0.5, Math.min(2, totalLength * 0.002))
  const before = getRuleDrivenSourcePointAtDistance(
    sourcePath,
    normalizedDistance - tangentReach
  )
  const after = getRuleDrivenSourcePointAtDistance(
    sourcePath,
    normalizedDistance + tangentReach
  )
  if (!before || !after) {
    return null
  }

  const dx = after.x - before.x
  const dy = after.y - before.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-6) {
    return null
  }

  return { x: dx / length, y: dy / length }
}

const getRuleDrivenCoverageProbeCandidatesAtDistance = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  distance: number,
  stroke?: ReturnType<typeof createDefaultStroke>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
) => {
  const sourcePoint = getRuleDrivenSourcePointAtDistance(sourcePath, distance)
  if (
    !sourcePoint ||
    (stroke?.position !== 'inside' && stroke?.position !== 'outside')
  ) {
    return sourcePoint
      ? [
          {
            distance,
            point: sourcePoint,
            localInsideSide: null
          }
        ]
      : []
  }

  const tangent = getRuleDrivenTangentAtDistance(sourcePath, distance)
  if (!tangent) {
    return [
      {
        distance,
        point: sourcePoint,
        localInsideSide: null
      }
    ]
  }

  const offsets = [
    Math.max(1, stroke.width * 0.25),
    Math.max(1, stroke.width * 0.5),
    Math.max(1, stroke.width * 0.75)
  ]
  const segmentRanges = getSourcePathSegmentRangesForTest(sourcePath)
  const segmentRange = segmentRanges.find(
    (range) =>
      distance >= range.startDistance - 1e-6 &&
      distance <= range.endDistance + 1e-6
  )
  const resolvedSide = segmentRange
    ? resolveSourcePathStrokeSide({
        sourcePath,
        topologyPoints: sourcePath.sampledPoints,
        fillRule: 'evenodd',
        position: stroke.position,
        width: stroke.width,
        range: {
          segmentIndex: segmentRange.segmentIndex,
          startDistance: Math.max(
            segmentRange.startDistance,
            distance - stroke.width
          ),
          endDistance: Math.min(
            segmentRange.endDistance,
            distance + stroke.width
          )
        },
        fillRegions: implicitFillRegions
      })
    : null
  const side =
    resolvedSide?.status === 'resolved' ? resolvedSide.selectedSide : 1
  return offsets.map((offset) => ({
    distance,
    point: {
      x: sourcePoint.x - tangent.y * offset * side,
      y: sourcePoint.y + tangent.x * offset * side
    },
    localInsideSide: side
  }))
}

const getRuleDrivenIntervalProbeDistances = (
  interval: StrokeEventMap['dashIntervals'][number],
  totalLength: number
) =>
  [0.15, 0.35, 0.5, 0.65, 0.85].map((factor) =>
    normalizeLoopDistanceForTest(
      interval.startDistance + interval.length * factor,
      totalLength
    )
  )

const hasRuleDrivenIntervalSpatialCoverage = ({
  sourcePath,
  interval,
  polygons,
  tolerance,
  stroke,
  implicitFillRegions
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: StrokeEventMap['dashIntervals'][number]
  polygons: { x: number; y: number }[][]
  tolerance: number
  stroke?: ReturnType<typeof createDefaultStroke>
  implicitFillRegions?: PolygonRegion[]
}) => {
  const coverage = getRuleDrivenIntervalSpatialCoverageDetails({
    sourcePath,
    interval,
    polygons,
    tolerance,
    stroke,
    implicitFillRegions
  })

  const requiredCoveredProbeCount =
    stroke && interval.length <= stroke.width * 1.5
      ? 1
      : Math.min(2, coverage.probePoints.length)
  return coverage.coveredProbeCount >= requiredCoveredProbeCount
}

const getRuleDrivenIntervalSpatialCoverageDetails = ({
  sourcePath,
  interval,
  polygons,
  tolerance,
  stroke,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: StrokeEventMap['dashIntervals'][number]
  polygons: { x: number; y: number }[][]
  tolerance: number
  stroke?: ReturnType<typeof createDefaultStroke>
  implicitFillRegions?: PolygonRegion[]
}) => {
  const probeGroups = getRuleDrivenIntervalProbeDistances(
    interval,
    sourcePath.totalLength
  )
    .map((distance) =>
      getRuleDrivenCoverageProbeCandidatesAtDistance(
        sourcePath,
        distance,
        stroke,
        implicitFillRegions
      )
    )
    .filter((group) => group.length > 0)
  const coveredProbeCount = probeGroups.filter((group) =>
    group.some((probe) =>
      isPointCoveredByPolygons(probe.point, polygons, tolerance)
    )
  ).length

  return {
    probePoints: probeGroups.flat(),
    coveredProbeCount
  }
}

const getCoveredProbeSidesAtInterval = ({
  sourcePath,
  interval,
  polygons,
  stroke,
  tolerance
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: StrokeEventMap['dashIntervals'][number]
  polygons: { x: number; y: number }[][]
  stroke: ReturnType<typeof createDefaultStroke>
  tolerance: number
}) => {
  const distances = getRuleDrivenIntervalProbeDistances(
    interval,
    sourcePath.totalLength
  )
  const offsets = [
    Math.max(1, stroke.width * 0.25),
    Math.max(1, stroke.width * 0.5),
    Math.max(1, stroke.width * 0.75)
  ]

  return distances.flatMap((distance) => {
    const sourcePoint = getRuleDrivenSourcePointAtDistance(sourcePath, distance)
    const tangent = getRuleDrivenTangentAtDistance(sourcePath, distance)
    if (!sourcePoint || !tangent) {
      return []
    }

    return ([1, -1] as const).flatMap((side) =>
      offsets.some((offset) =>
        isPointCoveredByPolygons(
          {
            x: sourcePoint.x - tangent.y * offset * side,
            y: sourcePoint.y + tangent.x * offset * side
          },
          polygons,
          tolerance
        )
      )
        ? [side]
        : []
    )
  })
}

const getVisibleIntervalsWithoutRuleDrivenSpatialCoverage = ({
  sourcePath,
  stroke,
  polygons,
  contextLabel,
  coverageTolerance = 1,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  polygons: { x: number; y: number }[][]
  contextLabel?: string
  coverageTolerance?: number
  implicitFillRegions?: PolygonRegion[]
}) => {
  const topology = buildPathTopologyModel({
    pathId: `${contextLabel ?? 'rule-driven'}:oracle`,
    networkId: `${contextLabel ?? 'rule-driven'}:oracle`,
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const renderableStroke = getOnlyRenderableStroke([stroke])
  const sharedVisibleIntervals =
    topology.topologyFamily === 'self-intersecting'
      ? (() => {
          const resolvedGeometry = buildResolvedVectorGeometryModel({
            modelId: `${contextLabel ?? 'rule-driven'}:oracle:resolved-geometry`,
            fillRule: topology.fillRule,
            networks: [
              {
                networkId: topology.networkId,
                path: sourcePath,
                topology
              }
            ]
          })
          const sharedSourceSplitRanges =
            resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ??
            []
          const strokeDomainPlan = resolveStrokeDomains({
            topology,
            sourceFamily: resolveSourceFamily({
              topology,
              stroke: renderableStroke
            }),
            stroke: renderableStroke,
            sourcePath,
            implicitFillRegions,
            sharedSourceSplitRanges
          })
          return getConstrainedDashedVisibleIntervals(
            topology,
            renderableStroke,
            sourcePath,
            strokeDomainPlan
          ).map((interval, index) => ({
            index,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            length: interval.intervalLength
          }))
        })()
      : null
  const eventMap =
    sharedVisibleIntervals === null
      ? buildStrokeEventMap(sourcePath, stroke, implicitFillRegions)
      : null
  const visibleIntervals = (
    sharedVisibleIntervals ??
    eventMap?.dashIntervals ??
    []
  ).filter((interval) => interval.length >= Math.max(4, stroke.width * 0.75))

  return visibleIntervals.flatMap((interval) =>
    hasRuleDrivenIntervalSpatialCoverage({
      sourcePath,
      interval,
      polygons,
      tolerance: coverageTolerance,
      stroke,
      implicitFillRegions
    })
      ? []
      : (() => {
          const coverage = getRuleDrivenIntervalSpatialCoverageDetails({
            sourcePath,
            interval,
            polygons,
            tolerance: coverageTolerance,
            stroke,
            implicitFillRegions
          })
          return [
            {
              intervalIndex: interval.index,
              contextLabel,
              startDistance: Math.round(interval.startDistance * 100) / 100,
              endDistance: Math.round(interval.endDistance * 100) / 100,
              crossingBoundaryCount: interval.crossingBoundaryCount,
              squareEffectiveCrossingBoundaryCount:
                interval.squareEffectiveCrossingBoundaryCount,
              coveredProbeCount: coverage.coveredProbeCount,
              probeSides: [
                ...new Set(
                  coverage.probePoints.map((probe) => probe.localInsideSide)
                )
              ],
              coveredSides: [
                ...new Set(
                  getCoveredProbeSidesAtInterval({
                    sourcePath,
                    interval,
                    polygons,
                    stroke,
                    tolerance: coverageTolerance
                  })
                )
              ]
            }
          ]
        })()
  )
}

const findPacketsNearDistance = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  distance: number,
  radius: number
) => {
  const [sourcePoint] = slicePathGeometryPoints(
    sourcePath,
    Math.max(0, distance - 0.5),
    Math.min(sourcePath.totalLength, distance + 0.5),
    false
  )
  if (!sourcePoint) {
    return []
  }

  return packets.filter((packet) =>
    packet.geometry.polygons.some((polygon) =>
      polygon.some((point) => pointDistance(point, sourcePoint) <= radius)
    )
  )
}

const assertStrokeEventInvariants = ({
  sourcePath,
  stroke,
  packets,
  position,
  topologyPoints,
  guardPoints,
  edgeSampleStep = 0.75,
  contextLabel
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  position: 'inside' | 'outside'
  topologyPoints?: { x: number; y: number }[]
  guardPoints?: { x: number; y: number; sharp?: boolean }[]
  edgeSampleStep?: number
  contextLabel?: string
}) => {
  const eventMap = buildStrokeEventMap(sourcePath, stroke)
  expect(
    packets.length,
    `${position}:${stroke.capType}:${stroke.dashPattern.join('/')}`
  ).toBeGreaterThan(0)
  expect(getPacketAreaSum(packets)).toBeGreaterThan(1)

  if (position === 'inside') {
    const illegalSamples = packets.flatMap((packet) =>
      packet.geometry.polygons.flatMap((polygon) =>
        [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
          (point) =>
            !isPointInsideEvenOddLegalDomain(point, sourcePath, 1)
              ? [
                  {
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    point: {
                      x: Math.round(point.x * 100) / 100,
                      y: Math.round(point.y * 100) / 100
                    }
                  }
                ]
              : []
        )
      )
    )
    expect(illegalSamples).toEqual([])

    void topologyPoints
  }

  const visibleIntervals = eventMap.dashIntervals.filter(
    (interval) => interval.length >= Math.max(4, stroke.width * 0.75)
  )
  expect(visibleIntervals.length).toBeGreaterThan(0)
  const visibleIntervalsWithoutCoverage = visibleIntervals.flatMap(
    (interval) => {
      const intervalPackets = getIntervalPackets(packets, interval.index)
      if (
        hasRuleDrivenIntervalSpatialCoverage({
          sourcePath,
          interval,
          polygons: packets.flatMap((packet) => packet.geometry.polygons),
          tolerance: 1,
          stroke
        })
      ) {
        return []
      }

      return [
        {
          intervalIndex: interval.index,
          contextLabel,
          intervalArea:
            Math.round(getPacketAreaSum(intervalPackets) * 100) / 100,
          startDistance: Math.round(interval.startDistance * 100) / 100,
          endDistance: Math.round(interval.endDistance * 100) / 100,
          crossingBoundaryCount: interval.crossingBoundaryCount,
          squareEffectiveCrossingBoundaryCount:
            interval.squareEffectiveCrossingBoundaryCount,
          packetSummaries: intervalPackets.map((packet) => ({
            startDistance:
              Math.round(
                (packet.geometry.debugMeta?.startDistance ?? -1) * 100
              ) / 100,
            endDistance:
              Math.round((packet.geometry.debugMeta?.endDistance ?? -1) * 100) /
              100,
            bounds: {
              minX: Math.round(packet.geometry.bounds.minX * 100) / 100,
              minY: Math.round(packet.geometry.bounds.minY * 100) / 100,
              maxX: Math.round(packet.geometry.bounds.maxX * 100) / 100,
              maxY: Math.round(packet.geometry.bounds.maxY * 100) / 100
            },
            polygonCount: packet.geometry.polygons.length,
            pointCount: packet.geometry.polygons.reduce(
              (count, polygon) => count + polygon.length,
              0
            )
          })),
          coverageProbes: getRuleDrivenIntervalSpatialCoverageDetails({
            sourcePath,
            interval,
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            tolerance: 1,
            stroke
          }).probePoints.map((probe) => ({
            distance: Math.round(probe.distance * 100) / 100,
            point: {
              x: Math.round(probe.point.x * 100) / 100,
              y: Math.round(probe.point.y * 100) / 100
            },
            localInsideSide: probe.localInsideSide,
            covered: isPointCoveredByPolygons(
              probe.point,
              packets.flatMap((packet) => packet.geometry.polygons),
              1
            )
          }))
        }
      ]
    }
  )
  expect(
    visibleIntervalsWithoutCoverage,
    JSON.stringify(
      {
        message: 'every visible dash interval should preserve body coverage',
        missing: visibleIntervalsWithoutCoverage,
        presentIntervalIds: Array.from(
          new Set(
            packets.flatMap((packet) =>
              packet.geometry.debugMeta?.intervalId
                ? [packet.geometry.debugMeta.intervalId]
                : []
            )
          )
        ).slice(0, 20)
      },
      null,
      2
    )
  ).toEqual([])

  const sourceCrossingIntervals = eventMap.dashIntervals.filter(
    (interval) => interval.crossingBoundaryCount > 0
  )
  if (sourceCrossingIntervals.length > 0) {
    const crossingIntervalsWithoutCoverage = sourceCrossingIntervals.flatMap(
      (interval) => {
        if (
          hasRuleDrivenIntervalSpatialCoverage({
            sourcePath,
            interval,
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            tolerance: 1,
            stroke
          })
        ) {
          return []
        }

        return [
          {
            intervalIndex: interval.index,
            contextLabel,
            startDistance: Math.round(interval.startDistance * 100) / 100,
            endDistance: Math.round(interval.endDistance * 100) / 100,
            crossingBoundaryCount: interval.crossingBoundaryCount
          }
        ]
      }
    )
    expect(crossingIntervalsWithoutCoverage).toEqual([])
  }

  const highRiskBoundaries = eventMap.sourceBoundaries.filter(
    (boundary) =>
      boundary.kind === 'seam' ||
      boundary.kind === 'sharp' ||
      boundary.kind === 'high-curvature'
  )
  for (const boundary of highRiskBoundaries) {
    const nearbyPackets = findPacketsNearDistance(
      packets,
      sourcePath,
      boundary.distance,
      stroke.width * 6
    )
    if (nearbyPackets.length === 0) {
      continue
    }
    if (position === 'inside') {
      const boundaryPoint = getRuleDrivenSourcePointAtDistance(
        sourcePath,
        boundary.distance
      )
      const boundaryViolations = nearbyPackets.flatMap((packet) =>
        packet.geometry.polygons.flatMap((polygon) =>
          [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
            (point) =>
              boundaryPoint &&
              pointDistance(point, boundaryPoint) <= stroke.width * 7 &&
              !isPointInsideEvenOddLegalDomain(point, sourcePath, 1)
                ? [
                    {
                      intervalId: packet.geometry.debugMeta?.intervalId,
                      point: {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                      },
                      contextLabel,
                      capType: stroke.capType,
                      boundaryKind: boundary.kind
                    }
                  ]
                : []
          )
        )
      )
      expect(
        boundaryViolations,
        JSON.stringify(
          {
            message:
              'high-risk boundary polygons should stay inside the even-odd legal domain',
            boundary,
            contextLabel,
            capType: stroke.capType,
            nearbyPackets: nearbyPackets.map((packet) => ({
              intervalId: packet.geometry.debugMeta?.intervalId,
              startDistance:
                Math.round(
                  (packet.geometry.debugMeta?.startDistance ?? -1) * 100
                ) / 100,
              endDistance:
                Math.round(
                  (packet.geometry.debugMeta?.endDistance ?? -1) * 100
                ) / 100,
              wrapsSeam: packet.geometry.debugMeta?.wrapsSeam,
              bounds: {
                minX: Math.round(packet.geometry.bounds.minX * 100) / 100,
                minY: Math.round(packet.geometry.bounds.minY * 100) / 100,
                maxX: Math.round(packet.geometry.bounds.maxX * 100) / 100,
                maxY: Math.round(packet.geometry.bounds.maxY * 100) / 100
              },
              polygonCount: packet.geometry.polygons.length,
              pointCount: packet.geometry.polygons.reduce(
                (count, polygon) => count + polygon.length,
                0
              )
            })),
            boundaryViolations
          },
          null,
          2
        )
      ).toEqual([])
      nearbyPackets.forEach((packet) => {
        packet.geometry.polygons.forEach((polygon) => {
          const samples = [
            ...polygon,
            ...samplePolygonEdges(polygon, edgeSampleStep)
          ]
          expect(
            samples.flatMap((point) =>
              !isPointInsideEvenOddLegalDomain(point, sourcePath, 1)
                ? [
                    {
                      boundary,
                      intervalId: packet.geometry.debugMeta?.intervalId
                    }
                  ]
                : []
            )
          ).toEqual([])
        })
      })
    } else {
      expect(getPacketAreaSum(nearbyPackets)).toBeGreaterThan(0.5)
    }
  }
}

const assertStrokeFinalFaceEventInvariants = ({
  sourcePath,
  stroke,
  faces,
  position,
  edgeSampleStep = 0.75,
  contextLabel
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  faces: {
    intervalIds: string[]
    polygons: { x: number; y: number }[][]
  }[]
  position: 'inside' | 'outside'
  edgeSampleStep?: number
  contextLabel?: string
}) => {
  const eventMap = buildStrokeEventMap(sourcePath, stroke)
  expect(
    faces.length,
    `final-face:${position}:${stroke.capType}:${stroke.dashPattern.join('/')}:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)
  expect(getFinalFaceAreaSum(faces)).toBeGreaterThan(1)

  if (position === 'inside') {
    const illegalSamples = faces.flatMap((face) =>
      face.polygons.flatMap((polygon) =>
        [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
          (point) =>
            !isPointInsideEvenOddLegalDomain(point, sourcePath, 1)
              ? [
                  {
                    intervalIds: face.intervalIds,
                    contextLabel,
                    point: {
                      x: Math.round(point.x * 100) / 100,
                      y: Math.round(point.y * 100) / 100
                    }
                  }
                ]
              : []
        )
      )
    )
    expect(illegalSamples).toEqual([])
  }

  const visibleIntervals = eventMap.dashIntervals.filter(
    (interval) => interval.length >= Math.max(4, stroke.width * 0.75)
  )
  const missingIntervals = visibleIntervals.flatMap((interval) => {
    if (
      hasRuleDrivenIntervalSpatialCoverage({
        sourcePath,
        interval,
        polygons: faces.flatMap((face) => face.polygons),
        tolerance: 1,
        stroke
      })
    ) {
      return []
    }

    return [
      {
        intervalIndex: interval.index,
        contextLabel,
        startDistance: Math.round(interval.startDistance * 100) / 100,
        endDistance: Math.round(interval.endDistance * 100) / 100,
        crossingBoundaryCount: interval.crossingBoundaryCount,
        squareEffectiveCrossingBoundaryCount:
          interval.squareEffectiveCrossingBoundaryCount
      }
    ]
  })
  expect(
    missingIntervals,
    JSON.stringify(
      {
        message:
          'every visible dash interval should preserve final product face coverage',
        missing: missingIntervals,
        presentIntervalIds: Array.from(
          new Set(faces.flatMap((face) => face.intervalIds))
        ).sort()
      },
      null,
      2
    )
  ).toEqual([])

  expect(
    new Set(faces.flatMap((face) => face.intervalIds)).size,
    `final-face interval provenance should remain inspectable after split-range rendering:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)
}

const assertRuleDrivenProductPolygonsInvariants = ({
  sourcePath,
  stroke,
  polygons,
  contextLabel,
  edgeSampleStep = 0.75
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  polygons: { x: number; y: number }[][]
  contextLabel?: string
  edgeSampleStep?: number
}) => {
  expect(
    polygons.length,
    `product-polygons:${stroke.position}:${stroke.capType}:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)

  const illegalSamples = polygons.flatMap((polygon) =>
    [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
      (point) => {
        const tooFarFromSource =
          pointClosedPolylineDistance(point, sourcePath.sampledPoints) >
          stroke.width + 0.5
        const outsideInsideLegalDomain =
          stroke.position === 'inside' &&
          !isPointInsideEvenOddLegalDomain(point, sourcePath, 1)
        if (!tooFarFromSource && !outsideInsideLegalDomain) {
          return []
        }

        return [
          {
            contextLabel,
            reason: outsideInsideLegalDomain
              ? 'outside-evenodd-legal-domain'
              : 'too-far-from-source',
            point: {
              x: Math.round(point.x * 100) / 100,
              y: Math.round(point.y * 100) / 100
            }
          }
        ]
      }
    )
  )
  expect(illegalSamples).toEqual([])

  const missingIntervals = getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
    sourcePath,
    stroke,
    polygons,
    contextLabel,
    coverageTolerance: 1
  })
  expect(
    missingIntervals,
    JSON.stringify(
      {
        message:
          'product visual polygons should preserve spatial coverage for every visible dash interval',
        missing: missingIntervals
      },
      null,
      2
    )
  ).toEqual([])

  expect(
    polygons.length,
    `product visual polygons should remain inspectable after split-range rendering:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)
}

const getRuleDrivenProductVisualPolygons = ({
  cachePrefix,
  points,
  closed,
  stroke,
  options
}: {
  cachePrefix: string
  points: { x: number; y: number }[]
  closed: boolean
  stroke: ReturnType<typeof createDefaultStroke>
  options: Parameters<typeof buildConstrainedDashedStrokeResolvedPackets>[4]
}) => {
  const productEntries = buildConstrainedDashedStrokeProductVisualEntries(
    `${cachePrefix}:direct-product`,
    points,
    closed,
    [stroke],
    {
      ...options,
      constrainedDashedVisualMode: 'product-final',
      omitDiagnosticMetadata: true
    }
  )

  if (productEntries) {
    return {
      source: 'direct-product' as const,
      polygons: productEntries.flatMap((entry) => entry.polygons)
    }
  }

  const packets = buildConstrainedDashedStrokeResolvedPackets(
    `${cachePrefix}:final-product`,
    points,
    closed,
    [stroke],
    {
      ...options,
      constrainedDashedVisualMode: 'product-final',
      omitDiagnosticMetadata: true
    }
  )
  return {
    source: 'final-faces' as const,
    polygons: buildStrokeFinalFacesFromResolvedPackets(packets).flatMap(
      (face) => face.polygons
    )
  }
}

const buildMutationFrameFixture = (
  mutation: Partial<
    Record<
      | 'firstAnchorY'
      | 'firstInControlX'
      | 'firstOutControlX'
      | 'turnInControlY',
      number
    >
  > = {}
) => {
  const points = {
    'tp-56': {
      id: 'tp-56',
      kind: 'anchor',
      x: 246.91886685202462,
      y: mutation.firstAnchorY ?? 0,
      anchorType: 'sharp'
    },
    'tp-57': {
      id: 'tp-57',
      kind: 'anchor',
      x: 75.04396933738008,
      y: 457.5261356375752,
      anchorType: 'smooth'
    },
    'tp-56:out': {
      id: 'tp-56:out',
      kind: 'control',
      x: mutation.firstOutControlX ?? 195.9809570843745,
      y: 149.61104635348715,
      controlForId: 'tp-56',
      controlRole: 'out'
    },
    'tp-56:in': {
      id: 'tp-56:in',
      kind: 'control',
      x: mutation.firstInControlX ?? 246.91886685202462,
      y: mutation.firstAnchorY ?? 0,
      controlForId: 'tp-56',
      controlRole: 'in'
    },
    'tp-57:in': {
      id: 'tp-57:in',
      kind: 'control',
      x: -46.963000165973426,
      y: 476.8923212730281,
      controlForId: 'tp-57',
      controlRole: 'in'
    },
    'tp-57:out': {
      id: 'tp-57:out',
      kind: 'control',
      x: 227.55268121657173,
      y: 433.3184035932593,
      controlForId: 'tp-57',
      controlRole: 'out'
    },
    'tp-58': {
      id: 'tp-58',
      kind: 'anchor',
      x: 423.6353107755326,
      y: 198.5034027633924,
      anchorType: 'sharp'
    },
    'tp-59': {
      id: 'tp-59',
      kind: 'anchor',
      x: 0,
      y: 91.98938176840147,
      anchorType: 'sharp'
    },
    'tp-60': {
      id: 'tp-60',
      kind: 'anchor',
      x: 307.43819696281525,
      y: 428.4768571843963,
      anchorType: 'smooth'
    },
    'tp-59:out': {
      id: 'tp-59:out',
      kind: 'control',
      x: 0,
      y: 91.98938176840147,
      controlForId: 'tp-59',
      controlRole: 'out'
    },
    'tp-60:in': {
      id: 'tp-60:in',
      kind: 'control',
      x: 275.9681453052044,
      y: mutation.turnInControlY ?? 498.6792801129134,
      controlForId: 'tp-60',
      controlRole: 'in'
    },
    'tp-60:out': {
      id: 'tp-60:out',
      kind: 'control',
      x: 338.9082486204261,
      y: 358.2744342558792,
      controlForId: 'tp-60',
      controlRole: 'out'
    }
  } as const
  const segments = {
    'seg-56-57': {
      id: 'seg-56-57',
      startId: 'tp-56',
      endId: 'tp-57',
      outControlId: 'tp-56:out',
      inControlId: 'tp-57:in'
    },
    'seg-57-58': {
      id: 'seg-57-58',
      startId: 'tp-57',
      endId: 'tp-58',
      outControlId: 'tp-57:out',
      inControlId: null
    },
    'seg-58-59': {
      id: 'seg-58-59',
      startId: 'tp-58',
      endId: 'tp-59',
      outControlId: null,
      inControlId: null
    },
    'seg-59-60': {
      id: 'seg-59-60',
      startId: 'tp-59',
      endId: 'tp-60',
      outControlId: 'tp-59:out',
      inControlId: 'tp-60:in'
    },
    'seg-60-56': {
      id: 'seg-60-56',
      startId: 'tp-60',
      endId: 'tp-56',
      outControlId: 'tp-60:out',
      inControlId: 'tp-56:in'
    }
  } as const
  const network = {
    id: 'mutation-loop',
    pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
    segmentIds: [
      'seg-56-57',
      'seg-57-58',
      'seg-58-59',
      'seg-59-60',
      'seg-60-56'
    ],
    closed: true
  }
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: 'mutation-loop',
    networkId: 'mutation-loop',
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'mutation-loop:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const boundaryContours =
    resolvedGeometry.networks[0]?.selfIntersecting?.legalBoundaryContours ?? []
  const fillRegions =
    resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? []
  const sharedSourceSplitRanges =
    resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
  const guardPoints = network.pointIds.map((pointId) => {
    const point = points[pointId as keyof typeof points]
    return {
      x: point.x,
      y: point.y,
      sharp: point.kind === 'anchor' && point.anchorType === 'sharp'
    }
  })

  return {
    sourcePath,
    topology,
    boundaryContours,
    fillRegions,
    sharedSourceSplitRanges,
    guardPoints
  }
}

const buildSelfIntersectingMixedSegmentStarFixture = () => {
  const points = {
    'tp-12': {
      id: 'tp-12',
      kind: 'anchor',
      x: 188.1928217922337,
      y: 0,
      anchorType: 'smooth'
    },
    'tp-13': {
      id: 'tp-13',
      kind: 'anchor',
      x: 11.358174406717296,
      y: 365.76797704068724,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: 'control',
      x: 164.3673966581619,
      y: 140.91988215887423,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: 'control',
      x: -42.09205809548172,
      y: 344.92238636482955,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: 'control',
      x: 78.17096503446606,
      y: 391.8249653855095,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: 'anchor',
      x: 360.12094148356584,
      y: 145.95389587539378,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: 'anchor',
      x: 0,
      y: 15.668954151283657,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: 'anchor',
      x: 270.59180204238254,
      y: 347.0603956649177,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: 'control',
      x: 0,
      y: 15.668954151283657,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: 'control',
      x: 263.9105229796075,
      y: 364.43172122813246,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: 'control',
      x: 277.27308110515736,
      y: 329.6890701017029,
      controlForId: 'tp-16',
      controlRole: 'out'
    }
  } as const
  const segments = {
    'ts-23': {
      id: 'ts-23',
      startId: 'tp-12',
      endId: 'tp-13',
      outControlId: 'tp-12:out',
      inControlId: 'tp-13:in'
    },
    'ts-24': {
      id: 'ts-24',
      startId: 'tp-13',
      endId: 'tp-14',
      outControlId: 'tp-13:out',
      inControlId: null
    },
    'ts-25': {
      id: 'ts-25',
      startId: 'tp-14',
      endId: 'tp-15',
      outControlId: null,
      inControlId: null
    },
    'ts-26': {
      id: 'ts-26',
      startId: 'tp-15',
      endId: 'tp-16',
      outControlId: 'tp-15:out',
      inControlId: 'tp-16:in'
    },
    'ts-27': {
      id: 'ts-27',
      startId: 'tp-16',
      endId: 'tp-12',
      outControlId: 'tp-16:out',
      inControlId: null
    }
  } as const
  const pointIds = ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'] as const
  const segmentIds = ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'] as const
  const network = {
    id: 'tn-4',
    pointIds: [...pointIds],
    segmentIds: [...segmentIds],
    closed: true
  }
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: 'tn-4',
    networkId: 'tn-4',
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'tn-4:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const boundaryContours =
    resolvedGeometry.networks[0]?.selfIntersecting?.legalBoundaryContours ?? []
  const fillRegions =
    resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? []
  const sharedSourceSplitRanges =
    resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
  const guardPoints = pointIds.map((pointId) => {
    const point = points[pointId]
    return {
      x: point.x,
      y: point.y,
      sharp: point.kind === 'anchor' && point.anchorType === 'sharp'
    }
  })

  return {
    sourcePath,
    topology,
    boundaryContours,
    fillRegions,
    sharedSourceSplitRanges,
    guardPoints
  }
}

const buildShortSegmentLoopFixture = (segmentCount: number) => {
  const points: Record<
    string,
    {
      id: string
      kind: 'anchor' | 'control'
      x: number
      y: number
      anchorType?: 'sharp' | 'smooth'
      controlForId?: string
      controlRole?: 'in' | 'out'
    }
  > = {}
  const segments: Record<
    string,
    {
      id: string
      startId: string
      endId: string
      outControlId: string | null
      inControlId: string | null
    }
  > = {}
  const pointIds: string[] = []
  const segmentIds: string[] = []
  const center = { x: 260, y: 240 }

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (Math.PI * 2 * index) / segmentCount
    const radiusX = 185 + (index % 5 === 0 ? 18 : index % 4 === 0 ? -12 : 0)
    const radiusY = 145 + (index % 6 === 0 ? -14 : index % 3 === 0 ? 10 : 0)
    const id = `sp-${index}`
    pointIds.push(id)
    points[id] = {
      id,
      kind: 'anchor',
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
      anchorType: index % 4 === 0 || index % 7 === 0 ? 'sharp' : 'smooth'
    }
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const startId = pointIds[index]
    const endId = pointIds[(index + 1) % segmentCount]
    const segmentId = `ss-${index}`
    const useCubic = index % 2 === 0 || index % 5 === 0
    let outControlId: string | null = null
    let inControlId: string | null = null
    if (useCubic) {
      const start = points[startId]
      const end = points[endId]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const bend = index % 5 === 0 ? 0.12 : 0.07
      outControlId = `${startId}:out:${index}`
      inControlId = `${endId}:in:${index}`
      points[outControlId] = {
        id: outControlId,
        kind: 'control',
        x: start.x + dx * 0.35 - dy * bend,
        y: start.y + dy * 0.35 + dx * bend,
        controlForId: startId,
        controlRole: 'out'
      }
      points[inControlId] = {
        id: inControlId,
        kind: 'control',
        x: end.x - dx * 0.35 - dy * bend,
        y: end.y - dy * 0.35 + dx * bend,
        controlForId: endId,
        controlRole: 'in'
      }
    }
    segmentIds.push(segmentId)
    segments[segmentId] = {
      id: segmentId,
      startId,
      endId,
      outControlId,
      inControlId
    }
  }

  const network = {
    id: `short-loop-${segmentCount}`,
    pointIds,
    segmentIds,
    closed: true
  }
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: network.id,
    networkId: network.id,
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `${network.id}:resolved-geometry`,
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const fillRegions =
    resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? []
  const guardPoints = pointIds.map((pointId) => {
    const point = points[pointId]
    return {
      x: point.x,
      y: point.y,
      sharp: point.anchorType === 'sharp'
    }
  })

  return {
    sourcePath,
    topology,
    fillRegions,
    guardPoints
  }
}

const buildTerminalSplitRangeFixture = () => {
  const points = {
    a: { id: 'a', kind: 'anchor', x: 200, y: 200, anchorType: 'sharp' },
    b: { id: 'b', kind: 'anchor', x: 800, y: 200, anchorType: 'sharp' },
    c: { id: 'c', kind: 'anchor', x: 800, y: 20, anchorType: 'sharp' },
    d: { id: 'd', kind: 'anchor', x: 200, y: 380, anchorType: 'sharp' },
    e: { id: 'e', kind: 'anchor', x: 800, y: 380, anchorType: 'sharp' },
    f: { id: 'f', kind: 'anchor', x: 0, y: 20, anchorType: 'sharp' }
  } as const
  const segments = {
    ab: {
      id: 'ab',
      startId: 'a',
      endId: 'b',
      outControlId: null,
      inControlId: null
    },
    bc: {
      id: 'bc',
      startId: 'b',
      endId: 'c',
      outControlId: null,
      inControlId: null
    },
    cd: {
      id: 'cd',
      startId: 'c',
      endId: 'd',
      outControlId: null,
      inControlId: null
    },
    de: {
      id: 'de',
      startId: 'd',
      endId: 'e',
      outControlId: null,
      inControlId: null
    },
    ef: {
      id: 'ef',
      startId: 'e',
      endId: 'f',
      outControlId: null,
      inControlId: null
    },
    fa: {
      id: 'fa',
      startId: 'f',
      endId: 'a',
      outControlId: null,
      inControlId: null
    }
  } as const
  const network = {
    id: 'terminal-split-range-network',
    pointIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    segmentIds: ['ab', 'bc', 'cd', 'de', 'ef', 'fa'],
    closed: true
  } as const
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: network.id,
    networkId: network.id,
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `${network.id}:resolved-geometry`,
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })

  return {
    sourcePath,
    topology,
    fillRegions:
      resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? [],
    sharedSourceSplitRanges:
      resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? [],
    guardPoints: network.pointIds.map((pointId) => {
      const point = points[pointId]
      return {
        x: point.x,
        y: point.y,
        sharp: point.anchorType === 'sharp'
      }
    })
  }
}

describe('constrained dashed stroke packets', () => {
  it('should detect constrained dashed intent only for positive-width inside/outside dashed strokes', () => {
    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(true)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'center',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 0,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [0, -1]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          visible: false,
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    const missingDashPatternStroke = createDefaultStroke({
      width: 4,
      style: 'dashed',
      position: 'inside',
      dashPattern: [20, 20]
    })
    delete (
      missingDashPatternStroke as Partial<typeof missingDashPatternStroke>
    ).dashPattern

    expect(hasConstrainedDashedStrokeIntent([missingDashPatternStroke])).toBe(
      false
    )
  })

  it('should run: ignore legacy dash and gap fields when dashPattern is missing', () => {
    const legacyOnlyStroke = {
      ...createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'inside'
      }),
      dash: 20,
      gap: 10
    }
    delete (legacyOnlyStroke as Partial<typeof legacyOnlyStroke>).dashPattern

    expect(hasConstrainedDashedStrokeIntent([legacyOnlyStroke])).toBe(false)
    expect(getRenderableStrokes([legacyOnlyStroke])[0]?.dashPattern).toEqual([])
    expect(
      buildConstrainedDashedStrokeResolvedPackets(
        'legacy-dash-gap:test',
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        [legacyOnlyStroke]
      )
    ).toEqual([])
  })

  it('should run: emit self-intersecting constrained dashed packets from authored source-path intervals', () => {
    const points = [
      { x: 192.42083700791653, y: 0 },
      { x: 11.358174406717296, y: 364.1297089212308 },
      { x: 360.120941483566, y: 144.31562775593738 },
      { x: 0, y: 14.030686031827244 },
      { x: 270.59180204238254, y: 345.42212754546125 }
    ]
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-inside-dashed',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ],
      buildSelfIntersectingSourcePathTestOptions(points)
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
            true &&
          (packet.geometry.debugMeta?.strokePosition !== 'inside' ||
            packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
              'product-final')
      )
    ).toBe(true)
  })

  it('should run: keep self-intersecting inside and outside dashed packets side-aware from authored source-path intervals', () => {
    const points = [
      { x: 192.42083700791653, y: 0 },
      { x: 11.358174406717296, y: 364.1297089212308 },
      { x: 360.120941483566, y: 144.31562775593738 },
      { x: 0, y: 14.030686031827244 },
      { x: 270.59180204238254, y: 345.42212754546125 }
    ]
    const baseStroke = {
      width: 10,
      style: 'dashed' as const,
      joinType: 'miter' as const,
      capType: 'butt' as const,
      dashPattern: [27, 20],
      dashOffset: 0
    }
    const options = buildSelfIntersectingSourcePathTestOptions(points)
    const insidePackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-reference-inside',
      points,
      true,
      [
        createDefaultStroke({
          ...baseStroke,
          position: 'inside'
        })
      ],
      options
    )
    const outsidePackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-reference-outside',
      points,
      true,
      [
        createDefaultStroke({
          ...baseStroke,
          position: 'outside'
        })
      ],
      options
    )

    expect(insidePackets.length).toBeGreaterThan(0)
    expect(outsidePackets.length).toBeGreaterThan(0)
    expect(
      [...insidePackets, ...outsidePackets].every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
            true &&
          ((packet.geometry.debugMeta?.strokePosition !== 'inside' &&
            packet.geometry.debugMeta?.strokePosition !== 'outside') ||
            packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
              'product-final')
      )
    ).toBe(true)

    const outsideFillSideSamples = outsidePackets.flatMap((packet) =>
      packet.geometry.polygons.flatMap((polygon) =>
        [...polygon, ...samplePolygonEdges(polygon, 1)].flatMap((point) =>
          isPointInsideEvenOdd(point, options.sourcePath.sampledPoints) &&
          !isPointOnPolygonBoundary(point, options.sourcePath.sampledPoints, 1)
            ? [
                {
                  intervalId: packet.geometry.debugMeta?.intervalId,
                  point: {
                    x: Math.round(point.x * 100) / 100,
                    y: Math.round(point.y * 100) / 100
                  }
                }
              ]
            : []
        )
      )
    )
    expect(outsideFillSideSamples).toEqual([])

    const signature = (
      packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
    ) =>
      packets
        .map((packet) =>
          [
            packet.geometry.bounds.minX.toFixed(3),
            packet.geometry.bounds.minY.toFixed(3),
            packet.geometry.bounds.maxX.toFixed(3),
            packet.geometry.bounds.maxY.toFixed(3)
          ].join(',')
        )
        .join('|')

    expect(signature(insidePackets)).not.toBe(signature(outsidePackets))
  })

  it('should run: emit bounded cell polygons for high-curvature dash intervals instead of fan ribbons', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:high-curvature-inside-dashed',
      buildEllipseLoop(72, 48),
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.polygons.length >= 1 &&
          packet.geometry.polygons.every((polygon) =>
            isSimpleClosedPolygon(polygon)
          )
      )
    ).toBe(true)

    const multiCellPackets = packets.filter(
      (packet) => packet.geometry.polygons.length > 1
    )
    for (const packet of multiCellPackets) {
      for (
        let index = 0;
        index < packet.geometry.polygons.length - 1;
        index += 1
      ) {
        expect(
          countSharedVertices(
            packet.geometry.polygons[index],
            packet.geometry.polygons[index + 1]
          )
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('should run: allocate self-intersecting inside dashed intervals per split source range with half-dash terminals', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 100, y: 0 }
    ]
    const {
      topology,
      sourcePath,
      implicitFillRegions,
      sharedSourceSplitRanges
    } = buildSelfIntersectingSourcePathTestOptions(points)
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 10,
        style: 'dashed',
        position: 'inside',
        joinType: 'miter',
        capType: 'butt',
        dashPattern: [20, 10],
        dashOffset: 0
      })
    ])
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      resolveStrokeDomains({
        topology,
        sourceFamily: resolveSourceFamily({
          topology,
          stroke
        }),
        stroke,
        sourcePath,
        implicitFillRegions,
        sharedSourceSplitRanges
      })
    )

    const firstSplitEnd = sourcePath.segments[0].length / 2
    const visibleOnFirstSplitRange = intervals.filter(
      (interval) =>
        interval.startDistance >= -1e-4 &&
        interval.endDistance <= firstSplitEnd + 1e-4
    )

    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(visibleOnFirstSplitRange.length).toBeGreaterThanOrEqual(2)
    expect(visibleOnFirstSplitRange[0]?.startDistance).toBeCloseTo(0, 4)
    expect(visibleOnFirstSplitRange[0]?.endDistance).toBeCloseTo(10, 4)
    expect(visibleOnFirstSplitRange[0]).toMatchObject({
      figmaLikeSplitRangeId: 'split-range:0',
      figmaLikeSplitRangeStartDistance: 0,
      figmaLikeTerminalRole: 'start'
    })
    expect(
      visibleOnFirstSplitRange[visibleOnFirstSplitRange.length - 1]
        ?.startDistance
    ).toBeCloseTo(firstSplitEnd - 10, 4)
    expect(
      visibleOnFirstSplitRange[visibleOnFirstSplitRange.length - 1]?.endDistance
    ).toBeCloseTo(firstSplitEnd, 4)
    expect(
      visibleOnFirstSplitRange[visibleOnFirstSplitRange.length - 1]
    ).toMatchObject({
      figmaLikeSplitRangeId: 'split-range:0',
      figmaLikeTerminalRole: 'end'
    })
    expect(
      visibleOnFirstSplitRange[visibleOnFirstSplitRange.length - 1]
        ?.figmaLikeSplitRangeEndDistance
    ).toBeCloseTo(firstSplitEnd, 4)
    expect(
      intervals.some(
        (interval) =>
          interval.startDistance < firstSplitEnd - 1e-4 &&
          interval.endDistance > firstSplitEnd + 1e-4
      )
    ).toBe(false)
    expect(
      intervals.every(
        (interval) =>
          interval.figmaLikeSplitRangeId !== undefined &&
          interval.figmaLikeSplitRangeStartDistance !== undefined &&
          interval.figmaLikeSplitRangeEndDistance !== undefined &&
          interval.figmaLikeTerminalRole !== undefined
      )
    ).toBe(true)
    const selectedSidesBySplitRange = new Map<string, Set<1 | -1>>()
    intervals.forEach((interval) => {
      if (
        interval.figmaLikeSplitRangeId &&
        (interval.figmaLikeSelectedSide === 1 ||
          interval.figmaLikeSelectedSide === -1)
      ) {
        selectedSidesBySplitRange.set(
          interval.figmaLikeSplitRangeId,
          new Set([
            ...(selectedSidesBySplitRange.get(interval.figmaLikeSplitRangeId) ??
              []),
            interval.figmaLikeSelectedSide
          ])
        )
      }
    })
    expect(
      [...selectedSidesBySplitRange.entries()].flatMap(
        ([splitRangeId, sides]) =>
          sides.size === 1 ? [] : [{ splitRangeId, sides: [...sides] }]
      )
    ).toEqual([])
  })

  it('should run: preserve split-boundary terminal half-dashes and adjacent gaps through product packets', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 100, y: 0 }
    ]
    const {
      topology,
      sourcePath,
      implicitFillRegions,
      sharedSourceSplitRanges
    } = buildSelfIntersectingSourcePathTestOptions(points)
    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'butt',
      dashPattern: [20, 10],
      dashOffset: 0
    })
    const renderableStroke = getOnlyRenderableStroke([stroke])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({
        topology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions,
      sharedSourceSplitRanges
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      sourcePath,
      strokeDomainPlan
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-bowtie:terminal-half-dash',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions,
        sharedSourceSplitRanges,
        clipInsideToFillDomain: false,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const polygons = packets.flatMap((packet) => packet.geometry.polygons)
    const intervalsByDomain = new Map<string, typeof intervals>()
    for (const interval of intervals) {
      expect(interval.figmaLikeSplitRangeId).toBeDefined()
      const domainId = interval.figmaLikeSplitRangeId ?? 'missing'
      intervalsByDomain.set(domainId, [
        ...(intervalsByDomain.get(domainId) ?? []),
        interval
      ])
    }
    const firstDomainIntervals = [...intervalsByDomain.values()]
      .find((domainIntervals) => domainIntervals.length >= 2)
      ?.slice()
      .sort((a, b) => a.startDistance - b.startDistance)
    expect(firstDomainIntervals).toBeDefined()
    const startTerminal = firstDomainIntervals?.[0]
    const endTerminal = firstDomainIntervals?.[firstDomainIntervals.length - 1]
    const firstGapStart = startTerminal?.endDistance
    const firstGapEnd = firstDomainIntervals?.[1]?.startDistance
    const lastGapStart =
      firstDomainIntervals?.[firstDomainIntervals.length - 2]?.endDistance
    const lastGapEnd = endTerminal?.startDistance
    expect(startTerminal?.figmaLikeTerminalRole).toBe('start')
    expect(endTerminal?.figmaLikeTerminalRole).toBe('end')

    const expectCoverageAtDistance = (
      distance: number,
      expectedCovered: boolean,
      label: string
    ) => {
      const coverageCounts = getRuleDrivenCoverageProbeCandidatesAtDistance(
        sourcePath,
        distance,
        stroke
      ).map((probe) => getPointPolygonCoverageCount(probe.point, polygons, 1))
      const covered = coverageCounts.some((count) => count > 0)
      expect({ label, distance, coverageCounts, covered }).toMatchObject({
        covered: expectedCovered
      })
    }

    expectCoverageAtDistance(
      ((startTerminal?.startDistance ?? 0) +
        (startTerminal?.endDistance ?? 0)) /
        2,
      true,
      'start terminal midpoint'
    )
    expectCoverageAtDistance(
      ((endTerminal?.startDistance ?? 0) + (endTerminal?.endDistance ?? 0)) / 2,
      true,
      'end terminal midpoint'
    )
    expectCoverageAtDistance(
      ((firstGapStart ?? 0) + (firstGapEnd ?? 0)) / 2,
      false,
      'gap after start terminal'
    )
    expectCoverageAtDistance(
      ((lastGapStart ?? 0) + (lastGapEnd ?? 0)) / 2,
      false,
      'gap before end terminal'
    )
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeSplitRangeId !== undefined &&
          packet.geometry.debugMeta?.figmaLikeTerminalRole !== undefined
      )
    ).toBe(true)
  })

  it('should run: preserve every split-range terminal half-dash through product polygons', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildTerminalSplitRangeFixture()
    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'round',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const renderableStroke = getOnlyRenderableStroke([stroke])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({
        topology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      sourcePath,
      strokeDomainPlan
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'terminal-split-range:inside-round',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const terminalIntervals = intervals.filter(
      (interval) =>
        interval.figmaLikeTerminalRole === 'start' ||
        interval.figmaLikeTerminalRole === 'end' ||
        interval.figmaLikeTerminalRole === 'start-end'
    )

    const getMissingTerminalCoverage = (
      polygons: { x: number; y: number }[][],
      stage: string
    ) =>
      terminalIntervals.flatMap((interval) => {
        const distance = (interval.startDistance + interval.endDistance) / 2
        const coverageCounts = getRuleDrivenCoverageProbeCandidatesAtDistance(
          sourcePath,
          distance,
          stroke,
          fillRegions
        ).map((probe) => getPointPolygonCoverageCount(probe.point, polygons, 1))
        return coverageCounts.some((count) => count > 0)
          ? []
          : [
              {
                stage,
                intervalId: interval.intervalId,
                splitRangeId: interval.figmaLikeSplitRangeId,
                terminalRole: interval.figmaLikeTerminalRole,
                startDistance: Math.round(interval.startDistance * 100) / 100,
                endDistance: Math.round(interval.endDistance * 100) / 100,
                coverageCounts
              }
            ]
      })
    const splitBoundaryTerminalPairs = terminalIntervals.flatMap(
      (leftInterval) =>
        leftInterval.figmaLikeTerminalRole === 'end' ||
        leftInterval.figmaLikeTerminalRole === 'start-end'
          ? terminalIntervals.flatMap((rightInterval) => {
              const sameSourceSegment =
                leftInterval.figmaLikeSplitRangeSourceSegmentIndex ===
                rightInterval.figmaLikeSplitRangeSourceSegmentIndex
              const touchesBoundary =
                Math.abs(
                  leftInterval.endDistance - rightInterval.startDistance
                ) <= 0.25
              const isRightStart =
                rightInterval.figmaLikeTerminalRole === 'start' ||
                rightInterval.figmaLikeTerminalRole === 'start-end'
              const differentRange =
                leftInterval.figmaLikeSplitRangeId !==
                rightInterval.figmaLikeSplitRangeId
              return sameSourceSegment &&
                touchesBoundary &&
                isRightStart &&
                differentRange
                ? [
                    {
                      boundaryDistance: leftInterval.endDistance,
                      leftIntervalId: leftInterval.intervalId,
                      rightIntervalId: rightInterval.intervalId,
                      leftSplitRangeId: leftInterval.figmaLikeSplitRangeId,
                      rightSplitRangeId: rightInterval.figmaLikeSplitRangeId
                    }
                  ]
                : []
            })
          : []
    )
    expect(splitBoundaryTerminalPairs.length).toBeGreaterThan(0)

    const getSplitBoundaryDomainFailures = (
      stageRecords: {
        stage: string
        intervalIds: string[]
      }[]
    ) =>
      splitBoundaryTerminalPairs.flatMap((pair) =>
        stageRecords.flatMap((record) => {
          const ownsBothAdjacentTerminals =
            record.intervalIds.includes(pair.leftIntervalId) &&
            record.intervalIds.includes(pair.rightIntervalId)
          if (!ownsBothAdjacentTerminals) {
            return []
          }
          return [
            {
              stage: record.stage,
              boundaryDistance: Math.round(pair.boundaryDistance * 100) / 100,
              leftSplitRangeId: pair.leftSplitRangeId,
              rightSplitRangeId: pair.rightSplitRangeId,
              leftIntervalId: pair.leftIntervalId,
              rightIntervalId: pair.rightIntervalId,
              intervalIds: record.intervalIds
            }
          ]
        })
      )

    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    const exportPackets =
      buildSolidCenterStrokeExportPacketsFromFinalFaces(collapsedFaces)
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    const renderProjectionUnionEntries = renderEntries.filter(
      (entry) =>
        entry.debugMeta?.visualOverlapCollapseStatus ===
        'render-projection-union'
    )
    const renderProjectionUnionIntervalIds = new Set(
      renderProjectionUnionEntries.flatMap(
        (entry) => entry.debugMeta?.intervalIds ?? []
      )
    )
    const renderProjectionUnionTerminalIds = new Set(
      renderProjectionUnionEntries.flatMap((entry) =>
        (entry.debugMeta?.figmaLikeSplitRangeTerminals ?? []).map(
          (terminal) => terminal.intervalId
        )
      )
    )

    expect([
      ...getMissingTerminalCoverage(
        packets.flatMap((packet) => packet.geometry.polygons),
        'packets'
      ),
      ...getMissingTerminalCoverage(
        finalFaces.flatMap((face) => face.polygons),
        'final-faces'
      ),
      ...getMissingTerminalCoverage(
        collapsedFaces.flatMap((face) => face.polygons),
        'collapsed-faces'
      ),
      ...getMissingTerminalCoverage(
        exportPackets.flatMap((packet) => packet.polygons),
        'export-packets'
      ),
      ...getMissingTerminalCoverage(
        renderEntries.flatMap((entry) => entry.polygons),
        'render-entries'
      )
    ]).toEqual([])
    expect(renderProjectionUnionEntries.length).toBeGreaterThan(0)
    expect(
      terminalIntervals.every((interval) =>
        renderProjectionUnionIntervalIds.has(interval.intervalId)
      )
    ).toBe(true)
    expect(
      terminalIntervals.every((interval) =>
        renderProjectionUnionTerminalIds.has(interval.intervalId)
      )
    ).toBe(true)
    expect(
      getSplitBoundaryDomainFailures([
        ...packets.map((packet) => ({
          stage: 'packets',
          intervalIds: packet.geometry.debugMeta?.intervalId
            ? [packet.geometry.debugMeta.intervalId]
            : []
        })),
        ...finalFaces.map((face) => ({
          stage: 'final-faces',
          intervalIds: face.intervalIds
        })),
        ...collapsedFaces.map((face) => ({
          stage: 'collapsed-faces',
          intervalIds: face.intervalIds
        })),
        ...exportPackets.map((packet) => ({
          stage: 'export-packets',
          intervalIds: packet.debugMeta?.intervalIds ?? []
        }))
      ])
    ).toEqual([])
  })

  it('should run: keep self-intersecting inside dashed product geometry on split-range intervals', () => {
    const {
      sourcePath,
      topology,
      boundaryContours,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    expect(boundaryContours.length).toBeGreaterThan(1)

    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'butt',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-star:inside-dashed-split-range',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    expect(packets.length).toBeGreaterThan(1)
    const renderableStroke = getOnlyRenderableStroke([stroke])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({
        topology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges
    })
    const visibleIntervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      sourcePath,
      strokeDomainPlan
    )
    const expectedSourceIntervalIds = new Set(
      visibleIntervals.map((interval) => interval.intervalId)
    )
    const packetIntervalIds = new Set(
      packets.flatMap((packet) =>
        packet.geometry.debugMeta?.intervalId
          ? [packet.geometry.debugMeta.intervalId]
          : []
      )
    )

    expect(expectedSourceIntervalIds.size).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
            'product-final' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
            true &&
          packet.geometry.debugMeta?.figmaLikeSplitRangeId?.startsWith(
            'split-range:'
          ) === true &&
          typeof packet.geometry.debugMeta?.figmaLikeSplitRangeStartDistance ===
            'number' &&
          typeof packet.geometry.debugMeta?.figmaLikeSplitRangeEndDistance ===
            'number' &&
          packet.geometry.debugMeta?.figmaLikeTerminalRole !== undefined &&
          expectedSourceIntervalIds.has(packet.geometry.debugMeta.intervalId) &&
          packet.geometry.polygons.length >= 1 &&
          packet.geometry.polygons.every(
            (polygon) => Math.abs(signedPolygonArea(polygon)) > 1e-6
          )
      )
    ).toBe(true)

    expect(
      [...packetIntervalIds].filter(
        (intervalId) => !expectedSourceIntervalIds.has(intervalId)
      )
    ).toEqual([])

    const packetStartDistances = packets.map(
      (packet) => packet.geometry.debugMeta?.startDistance ?? -1
    )
    const packetEndDistances = packets.map(
      (packet) => packet.geometry.debugMeta?.endDistance ?? -1
    )
    expect(Math.min(...packetStartDistances)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...packetEndDistances)).toBeLessThanOrEqual(
      sourcePath.totalLength
    )

    const getSplitRangeIntervalsWithoutCoverage = (
      polygons: { x: number; y: number }[],
      contextLabel: string
    ) =>
      visibleIntervals
        .filter(
          (interval) =>
            interval.intervalLength >=
            Math.max(4, renderableStroke.width * 0.75)
        )
        .flatMap((interval, intervalIndex) =>
          hasRuleDrivenIntervalSpatialCoverage({
            sourcePath,
            interval: {
              index: intervalIndex,
              startDistance: interval.startDistance,
              endDistance: interval.endDistance,
              length: interval.intervalLength
            },
            polygons: packetPolygons,
            tolerance: 1,
            stroke,
            implicitFillRegions: fillRegions
          })
            ? []
            : [
                {
                  intervalIndex,
                  contextLabel,
                  startDistance: Math.round(interval.startDistance * 100) / 100,
                  endDistance: Math.round(interval.endDistance * 100) / 100
                }
              ]
        )
    const packetPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const sourceIntervalsWithoutCoverage =
      getSplitRangeIntervalsWithoutCoverage(
        packetPolygons,
        'self-intersecting-star:inside-dashed-split-range:packets'
      )
    expect(
      sourceIntervalsWithoutCoverage.map((missingInterval) => ({
        ...missingInterval,
        packets: getIntervalPackets(packets, missingInterval.intervalIndex).map(
          (packet) => ({
            splitRangeId: packet.geometry.debugMeta?.figmaLikeSplitRangeId,
            terminalRole: packet.geometry.debugMeta?.figmaLikeTerminalRole,
            side: packet.geometry.debugMeta?.figmaLikeSelectedSide,
            startDistance: packet.geometry.debugMeta?.startDistance,
            endDistance: packet.geometry.debugMeta?.endDistance,
            polygonCount: packet.geometry.polygons.length,
            vertexCount: packet.geometry.polygons.reduce(
              (sum, polygon) => sum + polygon.length,
              0
            )
          })
        )
      }))
    ).toEqual([])

    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    expect(
      finalFaces.every(
        (face) =>
          face.sourceTopology === 'self-intersecting' &&
          face.geometryFamily === 'constrained-dashed' &&
          face.debugMeta?.figmaLikeSplitRangeId?.startsWith('split-range:') ===
            true &&
          face.debugMeta?.figmaLikeTerminalRole !== undefined &&
          face.intervalIds.every((intervalId) =>
            expectedSourceIntervalIds.has(intervalId)
          )
      )
    ).toBe(true)

    const finalFacesWithoutCoverage = getSplitRangeIntervalsWithoutCoverage(
      finalFaces.flatMap((face) => face.polygons),
      'self-intersecting-star:inside-dashed-split-range:final-faces'
    )
    expect(finalFacesWithoutCoverage).toEqual([])

    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    expect(
      collapsedFaces.every((face) =>
        face.intervalIds.every((intervalId) =>
          expectedSourceIntervalIds.has(intervalId)
        )
      )
    ).toBe(true)

    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    expect(
      renderEntries.every(
        (entry) =>
          entry.debugMeta?.sourceTopology !== 'self-intersecting' ||
          (entry.debugMeta.intervalId?.startsWith('interval:') === true &&
            entry.debugMeta.figmaLikeSplitRangeId?.startsWith(
              'split-range:'
            ) === true &&
            entry.debugMeta.figmaLikeTerminalRole !== undefined)
      )
    ).toBe(true)
    const renderEntriesWithoutCoverage = getSplitRangeIntervalsWithoutCoverage(
      renderEntries.flatMap((entry) => entry.polygons),
      'self-intersecting-star:inside-dashed-split-range:render-entries'
    )
    expect(renderEntriesWithoutCoverage).toEqual([])

    void boundaryContours
    void guardPoints
  })
  it('should run: enforce rule-driven self-intersecting source-path invariants across all cap types', () => {
    const {
      sourcePath,
      topology,
      boundaryContours,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(boundaryContours.length).toBeGreaterThan(1)
    ;(['inside', 'outside'] as const).forEach((position) => {
      ;(['butt', 'square', 'round'] as const).forEach((capType) => {
        const stroke = createDefaultStroke({
          width: 10,
          style: 'dashed',
          position,
          joinType: 'miter',
          capType,
          dashPattern: [27, 20],
          dashOffset: 0
        })
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `self-intersecting-mixed-star:rule-driven:${position}:${capType}`,
          topology.normalizedPoints,
          true,
          [stroke],
          {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: true,
            constrainedDashedVisualMode: 'product-final'
          }
        )

        expect(
          packets.every(
            (packet) =>
              packet.geometry.debugMeta?.sourceTopology ===
                'self-intersecting' &&
              packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
                true
          )
        ).toBe(true)
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            contextLabel: `self-intersecting-mixed-star:${position}:${capType}:packets:source-path`,
            coverageTolerance: 1,
            implicitFillRegions: fillRegions
          })
        ).toEqual([])
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: buildStrokeFinalFacesFromResolvedPackets(packets).flatMap(
              (face) => face.polygons
            ),
            contextLabel: `self-intersecting-mixed-star:${position}:${capType}:final-faces:source-path`,
            coverageTolerance: 1,
            implicitFillRegions: fillRegions
          })
        ).toEqual([])
        const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
          buildStrokeFinalFacesFromResolvedPackets(packets),
          {
            backend: getGeometryBackend()
          }
        )
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: collapsedFaces.flatMap((face) => face.polygons),
            contextLabel: `self-intersecting-mixed-star:${position}:${capType}:collapsed-faces:source-path`,
            coverageTolerance: 1,
            implicitFillRegions: fillRegions
          })
        ).toEqual([])
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: toSolidCenterStrokeRenderEntriesFromFinalFaces(
              collapsedFaces
            ).flatMap((entry) => entry.polygons),
            contextLabel: `self-intersecting-mixed-star:${position}:${capType}:render-entries:source-path`,
            coverageTolerance: 1,
            implicitFillRegions: fillRegions
          })
        ).toEqual([])

        const productVisual = getRuleDrivenProductVisualPolygons({
          cachePrefix: `self-intersecting-mixed-star:rule-driven:${position}:${capType}:product`,
          points: topology.normalizedPoints,
          closed: true,
          stroke,
          options: {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: true
          }
        })
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: productVisual.polygons,
            contextLabel: `self-intersecting-mixed-star:${position}:${capType}:product:${productVisual.source}:source-path`,
            coverageTolerance: 1,
            implicitFillRegions: fillRegions
          })
        ).toEqual([])
      })
    })
  })

  it('should run: use the first non-degenerate cubic tangent for outside dash geometry at a split-range start', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const degenerateStartSegment = sourcePath.segments[3]
    expect(degenerateStartSegment?.type).toBe('cubic')
    const frames = degenerateStartSegment
      ? samplePathSegmentFramesByLengthStep(
          degenerateStartSegment,
          0,
          degenerateStartSegment.length,
          0.2,
          {
            minCubicSamples: 12,
            maxCubicSamples: 256,
            useRangeLengthForSampleCount: true
          }
        )
      : []
    const firstFrame = frames[0]

    expect(firstFrame).toBeDefined()
    expect(firstFrame?.tangent.x).toBeGreaterThan(0.55)
    expect(firstFrame?.tangent.y).toBeGreaterThan(0.55)

    const capTypes = ['butt', 'square', 'round'] as const

    capTypes.forEach((capType) => {
      const stroke = createDefaultStroke({
        width: 10,
        style: 'dashed',
        position: 'outside',
        joinType: 'miter',
        capType,
        dashPattern: [27, 20],
        dashOffset: 0
      })
      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside:${capType}:degenerate-start-tangent`,
        topology.normalizedPoints,
        true,
        [stroke],
        {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          selectedSideGuardPoints: guardPoints,
          clipInsideToFillDomain: true,
          constrainedDashedVisualMode: 'product-final'
        }
      )
      const firstOutsidePacket = packets.find(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex ===
            3 &&
          packet.geometry.debugMeta?.figmaLikeTerminalRole === 'start' &&
          packet.geometry.debugMeta?.figmaLikeSplitRangeId === 'split-range:9'
      )

      expect(firstOutsidePacket).toBeDefined()
      expect(
        firstOutsidePacket?.geometry.polygons.some((polygon) =>
          polygon.some(
            (point) =>
              Math.abs(point.x) <= 1e-4 &&
              Math.abs(point.y - 25.668954151283657) <= 1e-4
          )
        )
      ).toBe(false)
    })
  })

  it('should run: resolve split ranges from source intersections even when topology family is not preclassified', () => {
    const point = (id: string, x: number, y: number) => ({
      id,
      kind: 'anchor' as const,
      x,
      y,
      anchorType: 'sharp' as const
    })
    const points = {
      a: point('a', 20, 100),
      b: point('b', 340, 100),
      c: point('c', 120, 20),
      d: point('d', 120, 180),
      e: point('e', 240, 20),
      f: point('f', 240, 180)
    }
    const segments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: null,
        inControlId: null
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: null,
        inControlId: null
      },
      cd: {
        id: 'cd',
        startId: 'c',
        endId: 'd',
        outControlId: null,
        inControlId: null
      },
      de: {
        id: 'de',
        startId: 'd',
        endId: 'e',
        outControlId: null,
        inControlId: null
      },
      ef: {
        id: 'ef',
        startId: 'e',
        endId: 'f',
        outControlId: null,
        inControlId: null
      },
      fa: {
        id: 'fa',
        startId: 'f',
        endId: 'a',
        outControlId: null,
        inControlId: null
      }
    }
    const network = {
      id: 'terminal-split-range-network',
      pointIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      segmentIds: ['ab', 'bc', 'cd', 'de', 'ef', 'fa'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'terminal-split-range-network',
      networkId: 'terminal-split-range-network',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'terminal-split-range-network:resolved-geometry',
      fillRule: topology.fillRule,
      networks: [{ networkId: network.id, path: sourcePath, topology }]
    })
    const sharedSourceSplitRanges =
      resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'butt',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'terminal-split-range-network:constrained-dashed',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions:
          resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? [],
        sharedSourceSplitRanges,
        selectedSideGuardPoints: network.pointIds.map((pointId) => ({
          x: points[pointId as keyof typeof points].x,
          y: points[pointId as keyof typeof points].y,
          sharp: true
        })),
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const renderableStroke = getOnlyRenderableStroke([stroke])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke: renderableStroke }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions:
        resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? [],
      sharedSourceSplitRanges
    })
    const visibleIntervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      sourcePath,
      strokeDomainPlan
    )

    expect(
      classifyConstrainedDashedSource(
        topology.normalizedPoints,
        topology.closed,
        topology
      )
    ).toBe('self-intersecting')
    expect(sharedSourceSplitRanges.length).toBeGreaterThan(6)
    expect(strokeDomainPlan).toMatchObject({
      intervalDomainKind: 'figma-like-split-range',
      supportState: 'supported'
    })
    expect(visibleIntervals.length).toBeGreaterThan(0)
    expect(packets.length).toBeGreaterThan(0)
  })

  it('should run: build self-intersecting inside dashed source-path products without shared contour domains', () => {
    const {
      sourcePath,
      topology,
      boundaryContours,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(boundaryContours.length).toBeGreaterThan(1)

    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'round',
      dashPattern: [27, 20],
      dashOffset: 0
    })

    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:source-path-direct',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
          true
      )
    ).toBe(true)
    expect(
      getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
        sourcePath,
        stroke,
        polygons: packets.flatMap((packet) => packet.geometry.polygons),
        contextLabel: 'self-intersecting-mixed-star:source-path-direct',
        coverageTolerance: 1
      })
    ).toEqual([])
  })

  it('should run: resolve self-intersecting no-fill inside dashed side from implicit fill domains', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    expect(topology.topologyFamily).toBe('self-intersecting')

    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'butt',
      dashPattern: [27, 20],
      dashOffset: 0
    })

    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:no-fill-implicit-domain-side',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: false,
        constrainedDashedVisualMode: 'product-final'
      }
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
            true &&
          packet.geometry.debugMeta?.figmaLikeSideAuthority ===
            'implicit-fill-hole-domain' &&
          packet.geometry.debugMeta?.figmaLikeSideResolutionStatus ===
            'resolved' &&
          (packet.geometry.debugMeta?.figmaLikeSelectedSide === 1 ||
            packet.geometry.debugMeta?.figmaLikeSelectedSide === -1)
      )
    ).toBe(true)
    expect(
      getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
        sourcePath,
        stroke,
        polygons: packets.flatMap((packet) => packet.geometry.polygons),
        contextLabel:
          'self-intersecting-mixed-star:no-fill-implicit-domain-side',
        coverageTolerance: 1
      })
    ).toEqual([])
  })

  it('should run: build generic source-path dash bodies from authored intervals, not endpoint tangents', () => {
    const points = {
      a: {
        id: 'a',
        kind: 'anchor',
        x: 0,
        y: 0,
        anchorType: 'sharp'
      },
      b: {
        id: 'b',
        kind: 'anchor',
        x: 120,
        y: 170,
        anchorType: 'smooth'
      },
      'a:out': {
        id: 'a:out',
        kind: 'control',
        x: 28,
        y: 88,
        controlForId: 'a',
        controlRole: 'out'
      },
      'b:in': {
        id: 'b:in',
        kind: 'control',
        x: 18,
        y: 180,
        controlForId: 'b',
        controlRole: 'in'
      },
      c: {
        id: 'c',
        kind: 'anchor',
        x: 210,
        y: 20,
        anchorType: 'sharp'
      }
    } as const
    const segments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: 'a:out',
        inControlId: 'b:in'
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: null,
        inControlId: null
      },
      ca: {
        id: 'ca',
        startId: 'c',
        endId: 'a',
        outControlId: null,
        inControlId: null
      }
    } as const
    const network = {
      id: 'generic-loop',
      pointIds: ['a', 'b', 'c'],
      segmentIds: ['ab', 'bc', 'ca'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'generic-loop',
      networkId: 'generic-loop',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'generic-loop:inside-dashed-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 8,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [30, 18],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: [
          { x: points.a.x, y: points.a.y, sharp: true },
          { x: points.b.x, y: points.b.y, sharp: false },
          { x: points.c.x, y: points.c.y, sharp: true }
        ]
      }
    )

    const curvedPackets = packets.filter((packet) => {
      const startDistance = packet.geometry.debugMeta?.startDistance
      const endDistance = packet.geometry.debugMeta?.endDistance
      return (
        startDistance !== undefined &&
        endDistance !== undefined &&
        startDistance < sourcePath.segments[0].length &&
        endDistance <= sourcePath.segments[0].length
      )
    })

    expect(curvedPackets.length).toBeGreaterThan(0)
    for (const packet of curvedPackets) {
      const startDistance = packet.geometry.debugMeta?.startDistance
      const endDistance = packet.geometry.debugMeta?.endDistance
      if (startDistance === undefined || endDistance === undefined) {
        continue
      }
      const sourceInterval = slicePathGeometryPoints(
        sourcePath,
        startDistance,
        endDistance,
        packet.geometry.debugMeta?.wrapsSeam === true
      )
      const sourceEdgePointCount = packet.geometry.polygons.reduce(
        (count, polygon) =>
          count +
          polygon.filter(
            (point) => pointPolylineDistance(point, sourceInterval) < 0.5
          ).length,
        0
      )

      const expectedSourceEdgePoints = Math.min(
        sourceInterval.length,
        Math.max(3, Math.floor(sourceInterval.length * 0.25))
      )
      const singleResolvedStrip =
        packet.geometry.polygons.length === 1 &&
        (packet.geometry.polygons[0]?.length ?? 0) >= 4
      expect(
        sourceEdgePointCount >= expectedSourceEdgePoints || singleResolvedStrip
      ).toBe(true)
    }
  })

  it('should run: enforce rule-driven source-path invariants across drag mutation frames', () => {
    const mutationFrames = [
      {
        label: 'base',
        mutation: {}
      },
      {
        label: 'first-anchor-drag',
        mutation: { firstAnchorY: 24 }
      },
      {
        label: 'first-anchor-in-control-drag',
        mutation: { firstInControlX: 218, firstAnchorY: 10 }
      },
      {
        label: 'first-anchor-out-control-drag',
        mutation: { firstOutControlX: 226 }
      },
      {
        label: 'high-curvature-handler-drag',
        mutation: { turnInControlY: 540 }
      }
    ] satisfies {
      label: string
      mutation: Parameters<typeof buildMutationFrameFixture>[0]
    }[]

    for (const frame of mutationFrames) {
      const {
        sourcePath,
        topology,
        fillRegions,
        sharedSourceSplitRanges,
        guardPoints
      } = buildMutationFrameFixture(frame.mutation)

      ;(['butt', 'square', 'round'] as const).forEach((capType) => {
        const stroke = createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType,
          dashPattern: [27, 20],
          dashOffset: 0
        })
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `rule-mutation:${frame.label}:inside:${capType}`,
          topology.normalizedPoints,
          true,
          [stroke],
          {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: true,
            constrainedDashedVisualMode: 'product-final'
          }
        )

        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            contextLabel: `${frame.label}:${capType}:packets:source-path`,
            coverageTolerance: 1
          })
        ).toEqual([])
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: buildStrokeFinalFacesFromResolvedPackets(packets).flatMap(
              (face) => face.polygons
            ),
            contextLabel: `${frame.label}:${capType}:final-faces:source-path`,
            coverageTolerance: 1
          })
        ).toEqual([])
        if (capType === 'round') {
          const dragProductPackets =
            buildConstrainedDashedStrokeResolvedPackets(
              `rule-mutation:${frame.label}:inside:${capType}:drag-product`,
              topology.normalizedPoints,
              true,
              [stroke],
              {
                topology,
                sourcePath,
                implicitFillRegions: fillRegions,
                sharedSourceSplitRanges,
                selectedSideGuardPoints: guardPoints,
                clipInsideToFillDomain: true,
                constrainedDashedVisualMode: 'product-final',
                omitDiagnosticMetadata: true
              }
            )
          expect(
            getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
              sourcePath,
              stroke,
              polygons: dragProductPackets.flatMap(
                (packet) => packet.geometry.polygons
              ),
              contextLabel: `${frame.label}:${capType}:drag-product:packets:source-path`,
              coverageTolerance: 1
            })
          ).toEqual([])
          expect(
            getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
              sourcePath,
              stroke,
              polygons: buildStrokeFinalFacesFromResolvedPackets(
                dragProductPackets
              ).flatMap((face) => face.polygons),
              contextLabel: `${frame.label}:${capType}:drag-product:final-faces:source-path`,
              coverageTolerance: 1
            })
          ).toEqual([])
        }
        const productVisual = getRuleDrivenProductVisualPolygons({
          cachePrefix: `rule-mutation:${frame.label}:product:${capType}`,
          points: topology.normalizedPoints,
          closed: true,
          stroke,
          options: {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: true
          }
        })
        expect(
          getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
            sourcePath,
            stroke,
            polygons: productVisual.polygons,
            contextLabel: `${frame.label}:${capType}:product:${productVisual.source}:source-path`,
            coverageTolerance: 1
          })
        ).toEqual([])
      })
    }
  })

  it('should run: enforce inside round dashed invariants on a self-intersecting mixed-segment star', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'round',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:inside:round',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const visualOnlyPackets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:inside:round:visual-only',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final',
        visualOnly: true
      }
    )
    const dragProductPackets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:inside:round:drag-product',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final',
        omitDiagnosticMetadata: true
      }
    )

    ;[
      { label: 'full', packets },
      { label: 'visual-only', packets: visualOnlyPackets },
      { label: 'drag-product', packets: dragProductPackets }
    ].forEach((entry) => {
      const packetPolygons = entry.packets.flatMap(
        (packet) => packet.geometry.polygons
      )
      expect(
        entry.packets.every(
          (packet) =>
            entry.label !== 'full' ||
            packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
              true
        )
      ).toBe(true)
      expect(
        getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
          sourcePath,
          stroke,
          polygons: packetPolygons,
          contextLabel: `self-intersecting-mixed-star:round:${entry.label}:packets:source-path`,
          coverageTolerance: 1
        })
      ).toEqual([])
      expect(
        getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
          sourcePath,
          stroke,
          polygons: buildStrokeFinalFacesFromResolvedPackets(
            entry.packets
          ).flatMap((face) => face.polygons),
          contextLabel: `self-intersecting-mixed-star:round:${entry.label}:final-faces:source-path`,
          coverageTolerance: 1
        })
      ).toEqual([])

      expect(packetPolygons.length).toBeGreaterThan(0)
    })
  })

  it('should run: keep long dashed split-range products inspectable across many short mixed source segments', () => {
    const dashCases = [
      { label: 'cross-5-segments', dashPattern: [90, 18] },
      { label: 'cross-12-segments', dashPattern: [360, 18] },
      { label: 'cross-30-segments', dashPattern: [820, 24] }
    ] as const
    const fixture = buildShortSegmentLoopFixture(36)

    for (const dashCase of dashCases) {
      ;(['inside', 'outside'] as const).forEach((position) => {
        ;(['butt', 'square', 'round'] as const).forEach((capType) => {
          const stroke = createDefaultStroke({
            width: 16,
            style: 'dashed',
            position,
            joinType: 'miter',
            capType,
            dashPattern: [...dashCase.dashPattern],
            dashOffset: 0
          })
          const packets = buildConstrainedDashedStrokeResolvedPackets(
            `long-short:${dashCase.label}:${position}:${capType}`,
            fixture.topology.normalizedPoints,
            true,
            [stroke],
            {
              topology: fixture.topology,
              sourcePath: fixture.sourcePath,
              implicitFillRegions: fixture.fillRegions,
              selectedSideGuardPoints: fixture.guardPoints,
              clipInsideToFillDomain: position === 'inside',
              constrainedDashedVisualMode: 'product-final'
            }
          )
          const eventMap = buildStrokeEventMap(fixture.sourcePath, stroke)
          const maxBoundaryCount = Math.max(
            ...eventMap.dashIntervals.map((interval) =>
              capType === 'square'
                ? interval.squareEffectiveCrossingBoundaryCount
                : interval.crossingBoundaryCount
            )
          )

          expect(
            maxBoundaryCount,
            `${dashCase.label}:${position}:${capType} should exercise multi-boundary dash coverage`
          ).toBeGreaterThanOrEqual(
            dashCase.label === 'cross-30-segments'
              ? 20
              : dashCase.label === 'cross-12-segments'
                ? 8
                : 3
          )

          assertStrokeEventInvariants({
            sourcePath: fixture.sourcePath,
            stroke,
            packets,
            position,
            topologyPoints: fixture.topology.normalizedPoints,
            guardPoints: fixture.guardPoints,
            edgeSampleStep: 2.5,
            contextLabel: `long-short:${dashCase.label}:${position}:${capType}:packets`
          })
          assertStrokeFinalFaceEventInvariants({
            sourcePath: fixture.sourcePath,
            stroke,
            faces: buildStrokeFinalFacesFromResolvedPackets(packets),
            position,
            edgeSampleStep: 2.5,
            contextLabel: `long-short:${dashCase.label}:${position}:${capType}`
          })

          if (position === 'inside') {
            const productVisual = getRuleDrivenProductVisualPolygons({
              cachePrefix: `long-short:${dashCase.label}:${position}:${capType}:product`,
              points: fixture.topology.normalizedPoints,
              closed: true,
              stroke,
              options: {
                topology: fixture.topology,
                sourcePath: fixture.sourcePath,
                selectedSideGuardPoints: fixture.guardPoints,
                clipInsideToFillDomain: true
              }
            })
            assertRuleDrivenProductPolygonsInvariants({
              sourcePath: fixture.sourcePath,
              stroke,
              polygons: productVisual.polygons,
              contextLabel: `long-short:${dashCase.label}:${position}:${capType}:product:${productVisual.source}`,
              edgeSampleStep: 2.5
            })
          }
        })
      })
    }
  })

  it('should classify constrained dashed source topology without relying on shape-specific runtime branches', () => {
    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true
      )
    ).toBe('rectangle-equivalent')

    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 60, y: 40 },
          { x: 0, y: 40 }
        ],
        true
      )
    ).toBe('broader-simple-closed')

    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 }
        ],
        false
      )
    ).toBe('open')
  })

  it('should classify full-loop round-join support through the constrained dashed interval classifier', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'outside',
        joinType: 'round',
        dashPattern: [400, 20],
        dashOffset: 0
      })
    ])

    const classification = classifyConstrainedDashedInterval(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      {
        startDistance: 0,
        endDistance: 209.4427190999916,
        totalLength: 209.4427190999916,
        wrapsSeam: false
      },
      stroke
    )

    expect(classification.sourceTopology).toBe('broader-simple-closed')
    expect(classification.intervalTopology).toBe('full-loop')
    expect(classification.acceptsFullLoopRoundJoin).toBe(true)
    expect(classification.acceptsSingleEdgeRoundCap).toBe(false)
  })

  it('should classify sampled smooth closed full-loop round joins as accepted without widening sharp vector gates', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'inside',
        joinType: 'round',
        dashPattern: [400, 20],
        dashOffset: 0
      })
    ])

    const ellipsePoints = buildEllipseLoop(72, 48)
    const totalLength = ellipsePoints.reduce((sum, point, index) => {
      const next = ellipsePoints[(index + 1) % ellipsePoints.length]
      return sum + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)

    const ellipseClassification = classifyConstrainedDashedInterval(
      ellipsePoints,
      true,
      {
        startDistance: 0,
        endDistance: totalLength,
        totalLength,
        wrapsSeam: false
      },
      stroke
    )

    expect(ellipseClassification.sourceTopology).toBe('sampled-simple-closed')
    expect(ellipseClassification.intervalTopology).toBe('full-loop')
    expect(ellipseClassification.acceptsFullLoopRoundJoin).toBe(true)

    const sharpPolygon = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 50, y: 20 },
      { x: 30, y: 40 },
      { x: 0, y: 30 }
    ]
    const sharpLength = sharpPolygon.reduce((sum, point, index) => {
      const next = sharpPolygon[(index + 1) % sharpPolygon.length]
      return sum + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)

    expect(
      classifyConstrainedDashedInterval(
        sharpPolygon,
        true,
        {
          startDistance: 0,
          endDistance: sharpLength,
          totalLength: sharpLength,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      sourceTopology: 'sampled-simple-closed',
      intervalTopology: 'full-loop',
      acceptsFullLoopRoundJoin: false
    })
  })

  it('should run: keep sharp sampled full-loop round joins visible on the constrained dashed path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 50, y: 20 },
        { x: 30, y: 40 },
        { x: 0, y: 30 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.debugMeta?.intervalTopology === 'full-loop'
      )
    ).toBe(true)
  })

  it('should run: keep seam-wrapping constrained dashed intervals visible instead of dropping the authored dash', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed-seam-wrap',
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [20, 20],
          dashOffset: 10
        })
      ]
    )

    expect(
      packets.some((packet) => packet.geometry.debugMeta?.wrapsSeam === true)
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
  })

  it('should run: keep repeated self-intersecting closed source-path intervals visible', () => {
    const points = [
      { x: 50, y: 0 },
      { x: 79, y: 90 },
      { x: 2, y: 35 },
      { x: 98, y: 35 },
      { x: 21, y: 90 }
    ]
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      points,
      true,
      [
        createDefaultStroke({
          width: 12,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ],
      buildSelfIntersectingSourcePathTestOptions(points)
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
            'product-final'
      )
    ).toBe(true)
  })

  it('should classify single-edge round-cap support through the constrained dashed interval classifier', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'inside',
        capType: 'round',
        dashPattern: [20, 220],
        dashOffset: 220
      })
    ])

    const classification = classifyConstrainedDashedInterval(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      {
        startDistance: 20,
        endDistance: 40,
        totalLength: 240,
        wrapsSeam: false
      },
      stroke
    )

    expect(classification.sourceTopology).toBe('rectangle-equivalent')
    expect(classification.intervalTopology).toBe('single-edge')
    expect(classification.acceptsSingleEdgeRoundCap).toBe(true)
    expect(classification.acceptsCornerSpanningJoin).toBe(false)
  })

  it('should classify corner-spanning join support without accepting unrelated multi-corner intervals', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'outside',
        joinType: 'miter',
        dashPattern: [40, 200],
        dashOffset: 180
      })
    ])

    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]

    expect(
      classifyConstrainedDashedInterval(
        points,
        true,
        {
          startDistance: 60,
          endDistance: 100,
          totalLength: 240,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      intervalTopology: 'corner-spanning',
      acceptsCornerSpanningJoin: true
    })

    expect(
      classifyConstrainedDashedInterval(
        points,
        true,
        {
          startDistance: 20,
          endDistance: 140,
          totalLength: 240,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      intervalTopology: 'multi-corner',
      acceptsCornerSpanningJoin: false
    })
  })

  it('should classify multiple constrained dashed packets from one stroke as one accepted owner', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'rect:test'
        }
      }
    )

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'single-owner',
      ownerKeys: ['rect:test:stroke:0'],
      packetCount: 2
    })
  })

  it('should classify constrained dashed ownership from typed metadata, not geometry id parsing', () => {
    expect(
      classifyConstrainedDashedOwnership([
        {
          geometry: {
            geometryId: 'opaque-id-a',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              ownerKey: 'typed-owner:stroke:0'
            }
          }
        },
        {
          geometry: {
            geometryId: 'opaque-id-b',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              ownerKey: 'typed-owner:stroke:0'
            }
          }
        }
      ])
    ).toEqual({
      status: 'accepted',
      reason: 'single-owner',
      ownerKeys: ['typed-owner:stroke:0'],
      packetCount: 2
    })
  })

  it('should not run: classify missing constrained dashed owner metadata as an explicit blocked state', () => {
    expect(
      classifyConstrainedDashedOwnership([
        {
          geometry: {
            geometryId: 'opaque-id-without-owner',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              strokeId: 'stroke:0'
            }
          }
        }
      ])
    ).toEqual({
      status: 'blocked',
      reason: 'missing-owner-metadata',
      ownerKeys: [],
      packetCount: 1
    })
  })

  it('should run: attach typed owner and network metadata to constrained dashed packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'opaque-cache-key',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'typed-vector:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every((packet) =>
        [
          packet.geometry.debugMeta?.sourcePathId === 'opaque-cache-key',
          packet.geometry.debugMeta?.ownerKey ===
            'typed-vector:network-a:stroke:0',
          packet.geometry.debugMeta?.networkId === 'network-a',
          packet.geometry.debugMeta?.strokeId === 'stroke:0',
          packet.geometry.debugMeta?.strokeIndex === 0,
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed',
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained',
          packet.geometry.debugMeta?.runtimeStatus === 'candidate',
          packet.geometry.debugMeta?.sourceTopology === 'rectangle-equivalent',
          packet.geometry.debugMeta?.intervalTopology === 'full-loop'
        ].every(Boolean)
      )
    ).toBe(true)
  })

  it('should classify multiple constrained dashed strokes as accepted typed ownership', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        }),
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'rect:test'
        }
      }
    )

    expect(packets.length).toBeGreaterThan(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: ['rect:test:stroke:0', 'rect:test:stroke:1'],
      packetCount: packets.length
    })
  })

  it('should classify multi-network constrained dashed packets as accepted typed ownership', () => {
    const strokes = [
      createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'outside',
        dashPattern: [200, 20],
        dashOffset: 0
      })
    ]

    const packets = [
      ...buildConstrainedDashedStrokeResolvedPackets(
        'vector:test:network-a:constrained-dashed',
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        strokes,
        {
          metadata: {
            ownerKeyPrefix: 'vector:test:network-a',
            networkId: 'network-a'
          }
        }
      ),
      ...buildConstrainedDashedStrokeResolvedPackets(
        'vector:test:network-b:constrained-dashed',
        [
          { x: 60, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 40 },
          { x: 60, y: 40 }
        ],
        true,
        strokes,
        {
          metadata: {
            ownerKeyPrefix: 'vector:test:network-b',
            networkId: 'network-b'
          }
        }
      )
    ]

    expect(packets.length).toBeGreaterThan(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: [
        'vector:test:network-a:stroke:0',
        'vector:test:network-b:stroke:0'
      ],
      packetCount: packets.length
    })
  })

  it('should classify constrained dashed runtime status as accepted for one owner', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ],
        closed: true,
        candidatePackets: packets
      })
    ).toMatchObject({
      status: 'accepted',
      reason: 'single-owner',
      sourceTopology: 'rectangle-equivalent'
    })
  })

  it('should run: build open constrained dashed packets through interval-local one-sided geometry', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:network-0:constrained-dashed',
      [
        { x: 0, y: 10 },
        { x: 40, y: 10 }
      ],
      false,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-0',
          networkId: 'network-0'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 10,
      maxX: 40,
      maxY: 14
    })
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'vector:test:network-0:constrained-dashed',
      ownerKey: 'vector:test:network-0:stroke:0',
      networkId: 'network-0',
      strokeIndex: 0,
      intervalId: 'interval:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'open'
    })

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 10 },
          { x: 40, y: 10 }
        ],
        closed: false,
        candidatePackets: packets
      })
    ).toMatchObject({
      status: 'accepted',
      reason: 'single-owner',
      sourceTopology: 'open',
      ownership: {
        status: 'accepted',
        reason: 'single-owner'
      }
    })
  })

  it('should keep open constrained dashed runtime status blocked when candidate geometry cannot be built', () => {
    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 }
        ],
        closed: false,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-candidate-packets',
      sourceTopology: 'open',
      ownership: {
        status: 'blocked',
        reason: 'no-packets'
      }
    })
  })

  it('should classify unsupported closed constrained dashed runtime status as blocked without substitute geometry', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points,
        closed: true,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-packets',
      sourceTopology: 'rectangle-equivalent'
    })

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points,
        closed: true,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-packets',
      sourceTopology: 'rectangle-equivalent'
    })
  })

  it('should run: derive render, hit, and export packets from the same constrained dashed full-loop geometry source', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)

    const acceptedPackets = attachStrokePacketDebugMeta(packets, {
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })
    const hitPackets = buildSolidCenterStrokeHitTestPackets(acceptedPackets)
    const exportPackets = buildSolidCenterStrokeExportPackets(acceptedPackets)

    expect(hitPackets).toHaveLength(acceptedPackets.length)
    expect(exportPackets).toHaveLength(acceptedPackets.length)
    acceptedPackets.forEach((resolved, index) => {
      const hit = hitPackets[index]
      const exportPacket = exportPackets[index]
      expect(hit?.geometryId).toBe(resolved.geometry.geometryId)
      expect(exportPacket?.geometryId).toBe(resolved.geometry.geometryId)
      expect(hit?.polygons).toBe(resolved.geometry.polygons)
      expect(exportPacket?.polygons).toBe(resolved.geometry.polygons)
      expect(hit?.bounds).toEqual(resolved.geometry.bounds)
      expect(exportPacket?.bounds).toEqual(resolved.geometry.bounds)
      expect(hit?.debugMeta).toBe(resolved.geometry.debugMeta)
      expect(exportPacket?.debugMeta).toBe(resolved.geometry.debugMeta)
    })
    expect(exportPackets[0]?.debugMeta).toMatchObject({
      ownerKey: 'anonymous-constrained-dashed-source:stroke:0',
      strokeId: 'stroke:0',
      contourId: 'rect:test:constrained-dashed:contour:0',
      legalDomainId: 'rect:test:constrained-dashed:legal-domain:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1,
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent',
      intervalTopology: 'full-loop'
    })

    const hitArea = createSolidCenterStrokeHitArea(acceptedPackets)
    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: materialize constrained dashed accepted packets as final faces without bridge collapse', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-final-face',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [10, 10],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a',
          contourId: 'contour-a',
          legalDomainId: 'legal-domain-a'
        }
      }
    )
    const acceptedPackets = attachStrokePacketDebugMeta(packets, {
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })

    const faces = buildStrokeFinalFacesFromResolvedPackets(acceptedPackets)

    expect(faces).toHaveLength(acceptedPackets.length)
    expect(faces[0]).toMatchObject({
      faceId: acceptedPackets[0]?.geometry.geometryId,
      sourceGeometryIds: [acceptedPackets[0]?.geometry.geometryId],
      geometryFamily: 'constrained-dashed',
      runtimeStatus: 'accepted',
      sourceTopology: 'rectangle-equivalent',
      sourceContourIds: ['contour-a'],
      legalDomainIds: ['legal-domain-a']
    })
    expect(faces[0]?.intervalIds).toEqual(['interval:0'])
    expect(faces[0]?.ownerSet).toEqual([
      {
        ownerKey: 'vector:test:network-a:stroke:0',
        sourcePathId: 'rect:test:constrained-dashed-final-face',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0,
        contourId: 'contour-a',
        intervalId: 'interval:0'
      }
    ])
  })

  it('should run: attach topology and legal-domain metadata to interval-local constrained dashed packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:interval-local',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [10, 100],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      ownerKey: 'anonymous-constrained-dashed-source:stroke:0',
      strokeId: 'stroke:0',
      contourId: 'rect:test:interval-local:contour:0',
      legalDomainId: 'rect:test:interval-local:legal-domain:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent',
      intervalTopology: 'single-edge'
    })
    expect(packets[0]?.geometry.debugMeta?.sourceSpanIds).toEqual([
      'rect:test:interval-local:contour:0:source-span:0'
    ])
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 4
    })
  })

  it('should keep geometry bounds when diagnostic metadata is omitted for drag visual collapse', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:drag-metadata-omitted',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [10, 100],
          dashOffset: 0
        })
      ],
      {
        omitDiagnosticMetadata: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 4
    })
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate'
    })
    expect(packets[0]?.geometry.debugMeta?.sourceSpanIds).toBeUndefined()
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getPacketAggregateBounds(packets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getPacketAggregateBounds(packets)).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getPacketAggregateBounds(packets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getPacketAggregateBounds(packets)).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    const aggregateBounds = getPacketAggregateBounds(packets)
    expect(aggregateBounds.minX).toBe(-6)
    expect(aggregateBounds.minY).toBe(-6)
    expect(aggregateBounds.maxX).toBeCloseTo(86, 1)
    expect(aggregateBounds.maxY).toBeCloseTo(46, 6)
  })

  it('should run: keep the same constrained dashed full-loop geometry when the first supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets.length).toBeGreaterThan(1)
    expect(gradientPackets).toHaveLength(solidPackets.length)
    expect(
      gradientPackets.every((packet) => packet.paint.kind === 'gradient')
    ).toBe(true)
    expect(gradientPackets.every((packet) => packet.paint.gradientStyle)).toBe(
      true
    )
    expect(getPacketAggregateBounds(gradientPackets)).toEqual(
      getPacketAggregateBounds(solidPackets)
    )
    expect(gradientPackets.map((packet) => packet.geometry.polygons)).toEqual(
      solidPackets.map((packet) => packet.geometry.polygons)
    )
  })

  it('should run: keep the same constrained dashed full-loop outside geometry when the next supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-outside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-outside-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets.length).toBeGreaterThan(1)
    expect(gradientPackets).toHaveLength(solidPackets.length)
    expect(
      gradientPackets.every((packet) => packet.paint.kind === 'gradient')
    ).toBe(true)
    expect(gradientPackets.every((packet) => packet.paint.gradientStyle)).toBe(
      true
    )
    expect(getPacketAggregateBounds(gradientPackets)).toEqual(
      getPacketAggregateBounds(solidPackets)
    )
    expect(gradientPackets.map((packet) => packet.geometry.polygons)).toEqual(
      solidPackets.map((packet) => packet.geometry.polygons)
    )
  })

  it('should run: derive constrained dashed packets on simple open paths', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'line:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 4
    })
  })

  it('should run: derive constrained dashed packets for repeated non-full-loop intervals on a closed path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(2)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.bounds.minY < 0 || packet.geometry.bounds.maxY > 20
      )
    ).toBe(true)
  })

  it('should run: derive one inside single-edge constrained dashed packet when the visible interval stays within one edge', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: 0,
      maxX: 40,
      maxY: 6
    })
  })

  it('should run: expand closed square-cap endpoint dashes as body spans without clipping away the first dash', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const squarePackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:closed-square-cap-seam',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          capType: 'square',
          dashPattern: [20, 60],
          dashOffset: 0
        })
      ]
    )
    const firstSquareInterval = squarePackets.find(
      (packet) =>
        packet.geometry.debugMeta?.startDistance === 0 &&
        packet.geometry.debugMeta?.endDistance === 20
    )
    const physicalSpans =
      firstSquareInterval?.geometry.debugMeta?.physicalSpanRanges ?? []

    expect(firstSquareInterval?.geometry.debugMeta).toMatchObject({
      startDistance: 0,
      endDistance: 20,
      wrapsSeam: false,
      physicalVisibleLength: 30
    })
    expect(physicalSpans).toEqual([
      {
        spanId: 'interval:0:core:0',
        role: 'core',
        startDistance: 235,
        endDistance: 240,
        wrapsSeam: false
      },
      {
        spanId: 'interval:0:core:1',
        role: 'core',
        startDistance: 0,
        endDistance: 25,
        wrapsSeam: false
      }
    ])
    expect(
      firstSquareInterval?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 10, y: 5 }, polygon)
      )
    ).toBe(true)
    const squareFaces = buildStrokeFinalFacesFromResolvedPackets(squarePackets)
    expect(
      squareFaces.some(
        (face) =>
          face.intervalIds.includes('interval:0') &&
          face.polygons.some((polygon) =>
            isPointInsideEvenOdd({ x: 10, y: 5 }, polygon)
          )
      )
    ).toBe(true)

    const buttPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:closed-butt-cap-seam',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          capType: 'butt',
          dashPattern: [20, 60],
          dashOffset: 0
        })
      ]
    )
    const firstButtInterval = buttPackets.find(
      (packet) => packet.geometry.debugMeta?.startDistance === 0
    )

    expect(firstButtInterval?.geometry.debugMeta).toMatchObject({
      startDistance: 0,
      endDistance: 20,
      wrapsSeam: false
    })
  })

  it('should run: keep inside square-cap endpoint ranges clipped to the legal side on source-path geometry', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:inside-square-source-path',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:inside-square-source-path',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [20, 50],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )
    const outsideLegalDomainSamples = packets.flatMap((packet) =>
      packet.geometry.polygons.flatMap((polygon) =>
        samplePolygonEdges(polygon).flatMap((point) =>
          !isPointInsideEvenOdd(point, points) &&
          pointClosedPolylineDistance(point, points) > 0.25
            ? [
                {
                  intervalId: packet.geometry.debugMeta?.intervalId,
                  point: {
                    x: Math.round(point.x * 100) / 100,
                    y: Math.round(point.y * 100) / 100
                  }
                }
              ]
            : []
        )
      )
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.some((packet) =>
        packet.geometry.polygons.some((polygon) =>
          isPointInsideEvenOdd({ x: 10, y: 5 }, polygon)
        )
      )
    ).toBe(true)
    expect(outsideLegalDomainSamples).toEqual([])
  })

  it('should run: keep outside square-cap first dash bodies visible on both sides of a source-path seam', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-first-dash-source-path',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-first-dash-source-path',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [20, 60],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )
    const firstDash = packets.find(
      (packet) => packet.geometry.debugMeta?.intervalId === 'interval:0'
    )

    expect(firstDash?.geometry.debugMeta?.physicalVisibleLength).toBeCloseTo(
      30,
      6
    )
    expect(
      firstDash?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 10, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      firstDash?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: -5, y: 2 }, polygon)
      )
    ).toBe(true)
    expect(
      firstDash?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: -4, y: -4 }, polygon)
      )
    ).toBe(true)
  })

  it('should run: keep outside square-cap first dash body visible on the first source segment', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 90, y: 180 },
      { x: -80, y: 190 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: pointDistance(points[0], points[1])
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: pointDistance(points[1], points[2])
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[0],
          length: pointDistance(points[2], points[0])
        }
      ],
      closed: true,
      totalLength:
        pointDistance(points[0], points[1]) +
        pointDistance(points[1], points[2]) +
        pointDistance(points[2], points[0])
    }
    const topology = buildPathTopologyModel({
      pathId: 'vector:test:outside-square-first-segment-first-dash',
      networkId: 'tn-first-segment-square',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:outside-square-first-segment-first-dash',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [55, 120],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )
    const firstDash = packets.find(
      (packet) => packet.geometry.debugMeta?.intervalId === 'interval:0'
    )
    const firstSegment = sourcePath.segments[0]
    const tangent = {
      x: (firstSegment.end.x - firstSegment.start.x) / firstSegment.length,
      y: (firstSegment.end.y - firstSegment.start.y) / firstSegment.length
    }
    const outsideNormal = {
      x: tangent.y,
      y: -tangent.x
    }
    const firstSegmentBodyProbe = {
      x: firstSegment.start.x + tangent.x * 34 + outsideNormal.x * 5,
      y: firstSegment.start.y + tangent.y * 34 + outsideNormal.y * 5
    }

    expect(firstDash).toBeDefined()
    expect(
      firstDash?.geometry.debugMeta?.physicalSpanRanges?.some(
        (range) => range.role === 'core'
      )
    ).toBe(true)
    expect(
      firstDash?.geometry.debugMeta?.physicalSpanRanges?.some(
        (range) => range.role === 'start-cap' || range.role === 'end-cap'
      )
    ).toBe(false)
    expect(
      firstDash?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd(firstSegmentBodyProbe, polygon)
      )
    ).toBe(true)
  })

  it('should run: keep the same constrained dashed single-edge geometry when the next supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-single-edge',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-single-edge-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(17, 1)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(43, 1)
    expect(packets[0]?.geometry.bounds.maxY).toBe(6)
  })

  it.each(['inside', 'outside'] as const)(
    'should run: keep %s constrained dashed round caps smooth on large strokes',
    (position) => {
      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `rect:test:constrained-dashed-round-cap-smooth-${position}`,
        [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 80 },
          { x: 0, y: 80 }
        ],
        true,
        [
          createDefaultStroke({
            width: 40,
            style: 'dashed',
            position,
            capType: 'round',
            dashPattern: [80, 600],
            dashOffset: 600
          })
        ]
      )

      expect(packets).toHaveLength(1)
      const bounds = packets[0].geometry.bounds
      const capCenterY = (bounds.minY + bounds.maxY) / 2
      expect(
        getMaxRoundCapEdgeLength(
          packets[0].geometry.polygons,
          [
            { x: bounds.minX + 20, y: capCenterY },
            { x: bounds.maxX - 20, y: capCenterY }
          ],
          20
        )
      ).toBeLessThanOrEqual(0.35)
    }
  )

  it('should run: keep source-path split range round caps only on owned dash terminals', () => {
    const source = [
      { x: 0, y: 0 },
      { x: 80, y: 0 }
    ]
    const stroke = {
      style: 'solid' as const,
      position: 'outside' as const,
      width: 20,
      join: 'miter' as const,
      miterLimit: 4,
      cap: 'round' as const
    }
    const startOwnedPolygons = buildConstrainedDashedLocalSideStrokePolygons(
      source,
      false,
      stroke,
      {
        assumeSimpleOpen: true,
        assumeNormalizedOpen: true,
        roundCapStart: true,
        roundCapEnd: false
      }
    )
    const startOwnedBounds = getPointBounds(startOwnedPolygons.flat())
    expect(startOwnedBounds.minX).toBeLessThan(-8)
    expect(startOwnedBounds.maxX).toBeLessThanOrEqual(80 + 1e-4)

    const endOwnedPolygons = buildConstrainedDashedLocalSideStrokePolygons(
      source,
      false,
      stroke,
      {
        assumeSimpleOpen: true,
        assumeNormalizedOpen: true,
        roundCapStart: false,
        roundCapEnd: true
      }
    )
    const endOwnedBounds = getPointBounds(endOwnedPolygons.flat())
    expect(endOwnedBounds.minX).toBeGreaterThanOrEqual(-1e-4)
    expect(endOwnedBounds.maxX).toBeGreaterThan(88)
  })

  it('should run: keep center dashed round caps smooth on large strokes', () => {
    const geometry = buildDashedCenterRibbonGeometry(
      [
        {
          point: { x: 0, y: 0 },
          tangent: { x: 1, y: 0 }
        },
        {
          point: { x: 120, y: 0 },
          tangent: { x: 1, y: 0 }
        }
      ],
      {
        width: 40,
        join: 'miter',
        miterLimit: 4,
        cap: 'round'
      }
    )

    expect(geometry.polygons.length).toBeGreaterThan(0)
    expect(
      getMaxRoundCapEdgeLength(
        geometry.polygons,
        [
          { x: 0, y: 0 },
          { x: 120, y: 0 }
        ],
        20
      )
    ).toBeLessThanOrEqual(0.35)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(17, 1)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(43, 1)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(42)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-4)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(42, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(42)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(-3.5)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(42, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(-0.5)
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getPacketAggregateBounds(packets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside single-edge constrained dashed packet when the visible interval stays within one edge', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: -6,
      maxX: 40,
      maxY: 0
    })
  })

  it('should run: derive one outside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed outside bevel corner-spanning geometry when the next supported paint corner-spanning outside-gradient slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-outside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-outside-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one outside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: keep outside source-path dashed intervals visually joined across a segment boundary', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-source-path',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-source-path',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: -5 }, polygon)
      )
    ).toBe(true)
  })

  it('should run: keep high-curvature outside source-path dashes smooth across a cubic segment boundary', () => {
    const points = {
      a: {
        id: 'a',
        kind: 'anchor',
        x: 0,
        y: 0,
        anchorType: 'smooth'
      },
      b: {
        id: 'b',
        kind: 'anchor',
        x: 72,
        y: 138,
        anchorType: 'smooth'
      },
      c: {
        id: 'c',
        kind: 'anchor',
        x: 150,
        y: 0,
        anchorType: 'sharp'
      },
      'a:out': {
        id: 'a:out',
        kind: 'control',
        x: -18,
        y: 92,
        controlForId: 'a',
        controlRole: 'out'
      },
      'b:in': {
        id: 'b:in',
        kind: 'control',
        x: 20,
        y: 168,
        controlForId: 'b',
        controlRole: 'in'
      },
      'b:out': {
        id: 'b:out',
        kind: 'control',
        x: 126,
        y: 108,
        controlForId: 'b',
        controlRole: 'out'
      },
      'c:in': {
        id: 'c:in',
        kind: 'control',
        x: 158,
        y: 70,
        controlForId: 'c',
        controlRole: 'in'
      }
    } as const
    const segments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: 'a:out',
        inControlId: 'b:in'
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: 'b:out',
        inControlId: 'c:in'
      },
      ca: {
        id: 'ca',
        startId: 'c',
        endId: 'a',
        outControlId: null,
        inControlId: null
      }
    } as const
    const network = {
      id: 'tn-high-curvature-outside',
      pointIds: ['a', 'b', 'c'],
      segmentIds: ['ab', 'bc', 'ca'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'vector:test:high-curvature-outside-source-path',
      networkId: network.id,
      points: sourcePath.sampledPoints,
      closed: true
    })
    const guardPoints = [
      { x: points.a.x, y: points.a.y, sharp: false },
      { x: points.b.x, y: points.b.y, sharp: false },
      { x: points.c.x, y: points.c.y, sharp: true }
    ]
    const firstSegmentLength = sourcePath.segments[0].length
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:high-curvature-outside-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [firstSegmentLength + 42, 1000],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const [packet] = packets
    const segmentTail = slicePathGeometryPoints(
      sourcePath,
      firstSegmentLength - 40,
      firstSegmentLength,
      false
    )
    const nextSegmentHead = slicePathGeometryPoints(
      sourcePath,
      firstSegmentLength,
      firstSegmentLength + 40,
      false
    )
    const crossSegmentSourceEdge = [...segmentTail, ...nextSegmentHead]

    expect(packet).toBeDefined()
    expect(packet?.geometry.polygons.length).toBeGreaterThan(0)
    expect(
      packet?.geometry.polygons.reduce(
        (count, polygon) =>
          count +
          polygon.filter(
            (point) =>
              pointPolylineDistance(point, crossSegmentSourceEdge) < 0.35
          ).length,
        0
      )
    ).toBeGreaterThanOrEqual(40)

    const crossSegmentCurvedEdges =
      packet?.geometry.polygons.flatMap((polygon) =>
        getPolygonEdges(polygon).filter((edge) => {
          const distanceToSource = pointPolylineDistance(
            edge.midpoint,
            crossSegmentSourceEdge
          )
          const startDistanceToSource = pointPolylineDistance(
            edge.start,
            crossSegmentSourceEdge
          )
          const endDistanceToSource = pointPolylineDistance(
            edge.end,
            crossSegmentSourceEdge
          )
          return (
            distanceToSource <= 12 &&
            Math.abs(startDistanceToSource - endDistanceToSource) <= 2
          )
        })
      ) ?? []
    expect(crossSegmentCurvedEdges.length).toBeGreaterThan(0)
    expect(
      Math.max(...crossSegmentCurvedEdges.map((edge) => edge.length))
    ).toBeLessThanOrEqual(3.5)
    const crossBoundaryOverlapPolygons =
      packet?.geometry.polygons.filter((polygon) => {
        const hasTailCoverage = polygon.some(
          (point) =>
            pointDistance(point, points.b) <= 12 &&
            pointPolylineDistance(point, segmentTail) < 0.35
        )
        const hasHeadCoverage = polygon.some(
          (point) =>
            pointDistance(point, points.b) <= 12 &&
            pointPolylineDistance(point, nextSegmentHead) < 0.35
        )
        return hasTailCoverage && hasHeadCoverage
      }) ?? []
    expect(crossBoundaryOverlapPolygons.length).toBeGreaterThanOrEqual(2)

    const insideLeakPoints =
      packet?.geometry.polygons.flatMap((polygon) =>
        polygon.filter(
          (point) =>
            isPointInsideEvenOdd(point, topology.normalizedPoints) &&
            pointClosedPolylineDistance(point, topology.normalizedPoints) > 0.5
        )
      ) ?? []
    expect(insideLeakPoints).toEqual([])

    const getInsideOutsideLegalSamples = (
      checkedPacket: NonNullable<typeof packet>
    ) =>
      checkedPacket.geometry.polygons.flatMap((polygon) =>
        [...polygon, ...samplePolygonEdges(polygon, 0.5)].filter(
          (point) =>
            !isPointInsideEvenOdd(point, topology.normalizedPoints) &&
            pointClosedPolylineDistance(point, topology.normalizedPoints) > 0.5
        )
      )
    const getCrossSegmentSourceCoverage = (
      checkedPacket: NonNullable<typeof packet>
    ) =>
      checkedPacket.geometry.polygons.reduce(
        (count, polygon) =>
          count +
          [...polygon, ...samplePolygonEdges(polygon, 0.5)].filter(
            (point) =>
              pointPolylineDistance(point, crossSegmentSourceEdge) < 0.35
          ).length,
        0
      )
    const insideRoundPackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:high-curvature-inside-round-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'round',
          dashPattern: [firstSegmentLength + 42, 1000],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const [insideRoundPacket] = insideRoundPackets
    expect(insideRoundPacket).toBeDefined()
    expect(
      insideRoundPacket.geometry.debugMeta?.intervalSweepSpanCount
    ).toBeGreaterThan(1)
    expect(insideRoundPacket.geometry.debugMeta?.terminalCapCount).toBe(2)
    expect(getInsideOutsideLegalSamples(insideRoundPacket)).toEqual([])
    expect(getCrossSegmentSourceCoverage(insideRoundPacket)).toBeGreaterThan(4)
    expect(
      findRoundCapArcEdgesNearBoundary(
        insideRoundPacket.geometry.polygons,
        points.b,
        crossSegmentSourceEdge,
        {
          radius: 14,
          maxEdgeLength: 0.75,
          maxSourceDistance: 8.75,
          sourceDistance: 1.25
        }
      )
    ).toEqual([])

    const insideButtPackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:high-curvature-inside-butt-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [firstSegmentLength + 42, 1000],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const [insideButtPacket] = insideButtPackets
    expect(insideButtPacket).toBeDefined()
    expect(getInsideOutsideLegalSamples(insideButtPacket)).toEqual([])
    expect(getCrossSegmentSourceCoverage(insideButtPacket)).toBeGreaterThan(4)

    const squarePackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:high-curvature-outside-square-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [firstSegmentLength + 42, 1000],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const [squarePacket] = squarePackets

    expect(squarePacket).toBeDefined()
    expect(squarePacket?.geometry.debugMeta?.physicalVisibleLength).toBeCloseTo(
      firstSegmentLength + 52,
      6
    )
    expect(
      squarePacket?.geometry.debugMeta?.physicalSpanRanges?.every(
        (range) => range.role === 'core'
      )
    ).toBe(true)
  })

  it('should run: keep outside square-cap source-path dashed bodies visible around a miter corner', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-source-path',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-source-path',
      points,
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: -3 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 10 }, polygon)
      )
    ).toBe(true)
  })

  it('should run: turn outside square-cap source-path effective intervals across a corner when cap extension crosses it', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-source-path-effective-cap-crossing',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-source-path-effective-cap-crossing',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [77, 300],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )
    const previousSegmentTail = [
      { x: 70, y: -5 },
      { x: 80, y: -5 }
    ]
    const nextSegmentHead = [
      { x: 85, y: 0 },
      { x: 85, y: 10 }
    ]
    const crossBoundaryBodyPolygons =
      packets[0]?.geometry.polygons.filter((polygon) => {
        const hasPreviousSegmentInterior = polygon.some(
          (point) =>
            point.x < 79.5 &&
            pointPolylineDistance(point, previousSegmentTail) < 0.35
        )
        const hasNextSegmentInterior = polygon.some(
          (point) =>
            point.y > 0.5 &&
            pointPolylineDistance(point, nextSegmentHead) < 0.35
        )
        return hasPreviousSegmentInterior && hasNextSegmentInterior
      }) ?? []

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 81, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 1 }, polygon)
      )
    ).toBe(true)
    expect(crossBoundaryBodyPolygons).toHaveLength(0)
  })

  it('should run: keep source-path overlap across smooth square-cap split boundaries', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 160, y: 0 },
      { x: 160, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80,
          startAnchorType: 'smooth' as const,
          endAnchorType: 'smooth' as const
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 80,
          startAnchorType: 'smooth' as const,
          endAnchorType: 'smooth' as const
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[4],
          length: 160
        },
        {
          type: 'line' as const,
          start: points[4],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 400
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-source-path-smooth-split-overlap',
      networkId: 'tn-smooth-split',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-source-path-smooth-split-overlap',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [77, 300],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )
    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 81, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 80, y: -5 }, polygon)
      )
    ).toBe(true)
  })

  it('should run: avoid outside square-cap source-path corner joins when the effective interval does not cross the corner', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const sourcePath = {
      segments: [
        {
          type: 'line' as const,
          start: points[0],
          end: points[1],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[1],
          end: points[2],
          length: 40
        },
        {
          type: 'line' as const,
          start: points[2],
          end: points[3],
          length: 80
        },
        {
          type: 'line' as const,
          start: points[3],
          end: points[0],
          length: 40
        }
      ],
      closed: true,
      totalLength: 240
    }
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-source-path-effective-cap-contained',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-source-path-effective-cap-contained',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [74, 300],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: points
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 10 }, polygon)
      )
    ).toBe(false)
  })

  it('should run: keep outside square-cap topology-sliced dashed bodies visible around a miter corner', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-topology-sliced',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-topology-sliced',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ],
      {
        topology
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: -3 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -3 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 10 }, polygon)
      )
    ).toBe(true)

    const faces = buildStrokeFinalFacesFromResolvedPackets(packets)
    expect(
      faces.some((face) =>
        face.polygons.some((polygon) =>
          isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
        )
      )
    ).toBe(true)
  })

  it('should run: turn outside square-cap topology-sliced effective intervals across a corner when cap extension crosses it', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-topology-effective-cap-crossing',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-topology-effective-cap-crossing',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [77, 300],
          dashOffset: 0
        })
      ],
      {
        topology
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 81, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 1 }, polygon)
      )
    ).toBe(true)
  })

  it('should run: avoid outside square-cap topology-sliced corner joins when the effective interval does not cross the corner', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const topology = buildPathTopologyModel({
      pathId: 'rect:test:outside-square-topology-effective-cap-contained',
      networkId: 'tn-rect',
      points,
      closed: true
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:outside-square-topology-effective-cap-contained',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [74, 300],
          dashOffset: 0
        })
      ],
      {
        topology
      }
    )

    expect(packets).toHaveLength(1)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 70, y: -5 }, polygon)
      )
    ).toBe(true)
    expect(
      packets[0]?.geometry.polygons.some((polygon) =>
        isPointInsideEvenOdd({ x: 83, y: 1 }, polygon)
      )
    ).toBe(false)
  })

  it('should run: derive one outside round corner-spanning constrained dashed packet on the uniform-width corner-spanning topology family product path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: derive one inside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside round corner-spanning constrained dashed packet on the uniform-width corner-spanning topology family product path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed inside bevel corner-spanning geometry when the first supported paint corner-spanning gradient slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one broader non-rectangle-equivalent inside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent inside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent outside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })

  it('should run: derive one broader non-rectangle-equivalent outside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })

  it('should run: sampled simple closed inside dashed paths emit interval-local one-sided packets instead of disappearing', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:sampled-simple-closed-inside',
      [
        { x: 0, y: 20 },
        { x: 12, y: 4 },
        { x: 32, y: 0 },
        { x: 54, y: 8 },
        { x: 66, y: 26 },
        { x: 58, y: 44 },
        { x: 36, y: 54 },
        { x: 14, y: 48 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [14, 8],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation'
      )
    ).toBe(true)
    expect(
      packets.every((packet) => packet.geometry.bounds.minX >= -0.001)
    ).toBe(true)
  })

  it('should run: high-curvature inside dashed packets stay visible as local-side approximation until arrangement clipping is exact', () => {
    const start = { x: 45.2802, y: 0 }
    const bottom = { x: 45.2802, y: 370.5 }
    const points = [
      ...sampleCubic(
        start,
        { x: 11.1135, y: 123 },
        { x: -36.7286, y: 370.5 },
        bottom,
        48
      ),
      ...sampleCubic(
        bottom,
        { x: 128.28, y: 370.5 },
        { x: 79.4469, y: 124 },
        start,
        48,
        false
      )
    ]
    const sourceBounds = getPointBounds(points)
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'figma-ref:high-curvature-cubic-loop-inside-dashed',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation'
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.bounds.minX >= sourceBounds.minX - 0.001 &&
          packet.geometry.bounds.minY >= sourceBounds.minY - 0.001 &&
          packet.geometry.bounds.maxX <= sourceBounds.maxX + 0.001 &&
          packet.geometry.bounds.maxY <= sourceBounds.maxY + 0.001
      )
    ).toBe(true)
    for (const packet of packets) {
      const polygon = packet.geometry.polygons[0] ?? []
      expect(isSimpleClosedPolygon(polygon)).toBe(true)
      for (const point of polygon) {
        expect(pointClosedPolylineDistance(point, points)).toBeLessThanOrEqual(
          10.25
        )
      }
    }
  })

  it('should run: sampled simple closed outside dashed paths emit visible selected-side packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:sampled-simple-closed-outside',
      [
        { x: 0, y: 20 },
        { x: 12, y: 4 },
        { x: 32, y: 0 },
        { x: 54, y: 8 },
        { x: 66, y: 26 },
        { x: 58, y: 44 },
        { x: 36, y: 54 },
        { x: 14, y: 48 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [14, 8],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.bounds.minX < 0 || packet.geometry.bounds.minY < 0
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.sourceTopology === 'sampled-simple-closed'
      )
    ).toBe(true)
  })
})
