import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { Bezier } from 'bezier-js'
import Clipper2ZFactory from 'clipper2-wasm'
import { createDefaultStroke } from '@asyra/utils'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from '../components/stroke-render/constrained-solid-stroke-packets'
import {
  buildPolylineGeometryModelPath,
  buildVectorGeometryModelPath,
  type PathGeometry,
  type PathSegment
} from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import {
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../components/stroke-render/solid-center-stroke-packets'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import {
  buildArrangedStrokeFinalFacesFromResolvedPackets,
  collapseStrokeFinalFaceVisualOverlaps
} from '../components/stroke-render/stroke-candidate-arrangement'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'

interface Vec2 {
  x: number
  y: number
}

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(wasmPath)
  })) as Clipper2Module

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  if (
    polygon.some(
      (current, index) =>
        pointSegmentDistance(
          point,
          current,
          polygon[(index + 1) % polygon.length]
        ) <= 0.25
    )
  ) {
    return true
  }

  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
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

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  return length <= 1e-6
    ? null
    : {
        x: vector.x / length,
        y: vector.y / length
      }
}

const buildSelfIntersectingSolidDomainFixture = () => {
  const points = [
    { x: 0, y: 0 },
    { x: 120, y: 220 },
    { x: 240, y: 0 },
    { x: 0, y: 140 },
    { x: 240, y: 140 }
  ]
  const sourcePath = buildPolylineGeometryModelPath(points, true)
  const topology = buildPathTopologyModel({
    pathId: 'self-intersecting-solid-domain-star',
    sourceId: 'self-intersecting-solid-domain-star',
    networkId: 'network-0',
    sourceRevision: 'source-revision:self-intersecting-solid-domain-star',
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'self-intersecting-solid-domain-star:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
  return {
    sourcePath,
    topology,
    fillRegions: selfIntersecting?.fillRegions ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
  }
}

const buildSelfCheckStarSolidDomainFixture = () => {
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
  const network = {
    id: 'tn-4',
    pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
    segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
    closed: true
  }
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: 'self-check-star-solid-domain',
    sourceId: 'self-check-star-solid-domain',
    networkId: 'tn-4',
    sourceRevision: 'source-revision:self-check-star-solid-domain',
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'self-check-star-solid-domain:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting

  return {
    sourcePath,
    topology,
    fillRegions: selfIntersecting?.fillRegions ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
  }
}

const getSolidPacketMeta = (
  packet: ReturnType<typeof buildConstrainedSolidStrokeResolvedPackets>[number]
) => packet.geometry.debugMeta

const solidPacketHasDashedTerminalMetadata = (
  packet: ReturnType<typeof buildConstrainedSolidStrokeResolvedPackets>[number]
) => {
  const meta = getSolidPacketMeta(packet)
  return (
    meta?.figmaLikeTerminalRole !== undefined ||
    (meta?.figmaLikeSplitRangeTerminals?.length ?? 0) > 0
  )
}

const solidPacketUsesBoundaryDomainProductGeometry = (
  packet: ReturnType<typeof buildConstrainedSolidStrokeResolvedPackets>[number]
) =>
  packet.geometry.geometryId.includes(':boundary-domain:') ||
  packet.geometry.debugMeta?.sourceSpanIds?.some((sourceSpanId) =>
    sourceSpanId.startsWith('boundary-domain:')
  ) === true

const solidPacketCarriesSourceVertexProvenance = (
  packet: ReturnType<typeof buildConstrainedSolidStrokeResolvedPackets>[number]
) =>
  packet.geometry.debugMeta?.sourceSpanIds?.some((sourceSpanId) =>
    sourceSpanId.startsWith('vertex:')
  ) === true

const withVectorRenderPhaseSink = <T>(
  sink: (phaseName: string, durationMs: number) => void,
  run: () => T
): T => {
  const globalWithSink = globalThis as typeof globalThis & {
    __asyraVectorRenderPhaseSink?: (
      phaseName: string,
      durationMs: number
    ) => void
  }
  const previousSink = globalWithSink.__asyraVectorRenderPhaseSink
  globalWithSink.__asyraVectorRenderPhaseSink = sink
  try {
    return run()
  } finally {
    globalWithSink.__asyraVectorRenderPhaseSink = previousSink
  }
}

const polygonListContainsPoint = (polygons: Vec2[][], point: Vec2) =>
  polygons.some(
    (polygon) =>
      polygon.some(
        (current, index) =>
          pointSegmentDistance(
            point,
            current,
            polygon[(index + 1) % polygon.length]
          ) <= 0.25
      ) || isPointInPolygon(point, polygon)
  )

const getSignedPolygonArea = (polygon: Vec2[]) =>
  polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2

const polygonListContainsPointWithWinding = (
  polygons: Vec2[][],
  point: Vec2
) => {
  const winding = polygons.reduce((sum, polygon) => {
    if (!isPointInPolygon(point, polygon)) {
      return sum
    }
    return sum + (getSignedPolygonArea(polygon) >= 0 ? 1 : -1)
  }, 0)
  return winding !== 0
}

const countVisibleMaskCoverageDifferences = ({
  firstClipPolygons,
  firstStrokeMaskPolygons,
  secondClipPolygons,
  secondStrokeMaskPolygons,
  centers,
  radius,
  step
}: {
  firstClipPolygons: Vec2[][]
  firstStrokeMaskPolygons: Vec2[][]
  secondClipPolygons: Vec2[][]
  secondStrokeMaskPolygons: Vec2[][]
  centers: Vec2[]
  radius: number
  step: number
}) => {
  let changed = 0
  let compared = 0

  centers.forEach((center) => {
    for (let y = center.y - radius; y <= center.y + radius; y += step) {
      for (let x = center.x - radius; x <= center.x + radius; x += step) {
        if (Math.hypot(x - center.x, y - center.y) > radius) {
          continue
        }
        const point = { x, y }
        const firstCovered =
          polygonListContainsPointWithWinding(firstStrokeMaskPolygons, point) &&
          polygonListContainsPointWithWinding(firstClipPolygons, point)
        const secondCovered =
          polygonListContainsPointWithWinding(
            secondStrokeMaskPolygons,
            point
          ) && polygonListContainsPointWithWinding(secondClipPolygons, point)
        compared += 1
        if (firstCovered !== secondCovered) {
          changed += 1
        }
      }
    }
  })

  return { changed, compared }
}

const polygonListRegionCoverage = (
  polygons: Vec2[][],
  region: { x: number; y: number; width: number; height: number },
  step = 1
) => {
  let covered = 0
  let total = 0

  for (let y = region.y + step / 2; y < region.y + region.height; y += step) {
    for (let x = region.x + step / 2; x < region.x + region.width; x += step) {
      total += 1
      if (polygonListContainsPoint(polygons, { x, y })) {
        covered += 1
      }
    }
  }

  return total === 0 ? 0 : covered / total
}

const distanceToPolyline = (point: Vec2, points: Vec2[]) => {
  let minimumDistance = Infinity
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    minimumDistance = Math.min(
      minimumDistance,
      pointSegmentDistance(point, start, end)
    )
  }
  return minimumDistance
}

const getFarSourceCoverageFailures = ({
  polygons,
  sourcePath,
  maxDistance,
  step = 8
}: {
  polygons: Vec2[][]
  sourcePath: PathGeometry
  maxDistance: number
  step?: number
}) => {
  const bounds = {
    minX: Math.min(...sourcePath.sampledPoints.map((point) => point.x)) - 20,
    minY: Math.min(...sourcePath.sampledPoints.map((point) => point.y)) - 20,
    maxX: Math.max(...sourcePath.sampledPoints.map((point) => point.x)) + 20,
    maxY: Math.max(...sourcePath.sampledPoints.map((point) => point.y)) + 20
  }
  const failures: { x: number; y: number; distance: number }[] = []

  for (let y = bounds.minY + step / 2; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX + step / 2; x <= bounds.maxX; x += step) {
      const point = { x, y }
      if (!polygonListContainsPointWithWinding(polygons, point)) {
        continue
      }

      const distance = distanceToPolyline(point, sourcePath.sampledPoints)
      if (distance > maxDistance) {
        failures.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          distance: Math.round(distance * 100) / 100
        })
      }
    }
  }

  return failures.slice(0, 20)
}

const getPolygonBoundaryDistance = (point: Vec2, polygon: Vec2[]) =>
  polygon.reduce((minimumDistance, current, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return Math.min(minimumDistance, pointSegmentDistance(point, current, next))
  }, Infinity)

const getFillRegionDeepCoverageFailures = ({
  strokePolygons,
  fillRegions,
  minBoundaryDistance,
  step = 8
}: {
  strokePolygons: Vec2[][]
  fillRegions: { polygons: Vec2[][] }[]
  minBoundaryDistance: number
  step?: number
}) => {
  const failures: { x: number; y: number; distance: number }[] = []

  fillRegions.forEach((region) => {
    const regionPolygons = region.polygons.filter(
      (polygon) => polygon.length >= 3
    )
    if (regionPolygons.length === 0) {
      return
    }
    const bounds = {
      minX: Math.min(
        ...regionPolygons.flatMap((polygon) => polygon.map((point) => point.x))
      ),
      minY: Math.min(
        ...regionPolygons.flatMap((polygon) => polygon.map((point) => point.y))
      ),
      maxX: Math.max(
        ...regionPolygons.flatMap((polygon) => polygon.map((point) => point.x))
      ),
      maxY: Math.max(
        ...regionPolygons.flatMap((polygon) => polygon.map((point) => point.y))
      )
    }

    for (let y = bounds.minY + step / 2; y <= bounds.maxY; y += step) {
      for (let x = bounds.minX + step / 2; x <= bounds.maxX; x += step) {
        const point = { x, y }
        if (!polygonListContainsPointWithWinding(regionPolygons, point)) {
          continue
        }
        const boundaryDistance = Math.min(
          ...regionPolygons.map((polygon) =>
            getPolygonBoundaryDistance(point, polygon)
          )
        )
        if (boundaryDistance < minBoundaryDistance) {
          continue
        }
        if (!polygonListContainsPointWithWinding(strokePolygons, point)) {
          continue
        }
        failures.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          distance: Math.round(boundaryDistance * 100) / 100
        })
      }
    }
  })

  return failures.slice(0, 20)
}

const getSourcePathSegmentRangesForTest = (sourcePath: {
  segments: readonly { length: number }[]
}) => {
  let cursor = 0
  return sourcePath.segments.map((segment, segmentIndex) => {
    const startDistance = cursor
    cursor += segment.length
    return {
      segmentIndex,
      startDistance,
      endDistance: cursor
    }
  })
}

interface SourceSegmentFrameForTest {
  point: Vec2
  tangent: Vec2
}

const getCubicLengthAtTForTest = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= 1e-6) {
    return 0
  }
  if (t >= 1 - 1e-6) {
    return segment.length
  }
  return segment.curve.split(0, t).length()
}

const getCubicTAtLengthForTest = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= 1e-6) {
    return 0
  }
  if (targetLength >= segment.length - 1e-6) {
    return 1
  }

  let low = 0
  let high = 1
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2
    if (getCubicLengthAtTForTest(segment, mid) < targetLength) {
      low = mid
    } else {
      high = mid
    }
  }
  return (low + high) / 2
}

const getSegmentFrameAtLocalLengthForTest = (
  segment: PathSegment | undefined,
  localLength: number
): SourceSegmentFrameForTest | null => {
  if (!segment || segment.length <= 1e-6) {
    return null
  }

  if (segment.type === 'line') {
    const t = Math.max(0, Math.min(1, localLength / segment.length))
    const tangent = normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
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

  const t = getCubicTAtLengthForTest(segment, localLength)
  const point = segment.curve.get(t) as Vec2
  const derivative = segment.curve.derivative(t) as Vec2
  const tangent =
    normalizeVector(derivative) ??
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

  return tangent
    ? {
        point: { x: point.x, y: point.y },
        tangent
      }
    : null
}

const getSegmentProbeFrameForTest = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  range: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  ratio: number
) => {
  const segment = sourcePath.segments[range.segmentIndex]
  if (!segment) {
    return null
  }

  if (segment.type === 'line') {
    return getSegmentFrameAtLocalLengthForTest(segment, segment.length * ratio)
  }

  const t = Math.max(0, Math.min(1, ratio))
  const point = segment.curve.get(t) as Vec2
  const derivative = segment.curve.derivative(t) as Vec2
  const tangent =
    normalizeVector(derivative) ??
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

  return tangent
    ? {
        point: { x: point.x, y: point.y },
        tangent
      }
    : null
}

const getSegmentFrameOffsetPointForTest = (
  frame: SourceSegmentFrameForTest | null,
  offsetDistance: number
) =>
  frame
    ? {
        x: frame.point.x - frame.tangent.y * offsetDistance,
        y: frame.point.y + frame.tangent.x * offsetDistance
      }
    : null

const getSegmentSideProbePoints = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  range: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  offsetDistance: number
) => {
  const probes: { id: string; x: number; y: number }[] = []
  for (const ratio of [0.35, 0.5, 0.65]) {
    const point = getSegmentFrameOffsetPointForTest(
      getSegmentProbeFrameForTest(sourcePath, range, ratio),
      offsetDistance
    )
    if (point) {
      probes.push({
        id: `segment-${range.segmentIndex}:${ratio}`,
        ...point
      })
    }
  }
  return probes
}

const interpolatePoint = (start: Vec2, end: Vec2, amount: number): Vec2 => ({
  x: start.x + (end.x - start.x) * amount,
  y: start.y + (end.y - start.y) * amount
})

const getSmoothJoinCorridorProbePoints = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  previousRange: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  nextRange: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  offsetDistance: number
) => {
  const vertex = sourcePath.segments[previousRange.segmentIndex]?.end
  const previousOffset = getSegmentFrameOffsetPointForTest(
    getSegmentProbeFrameForTest(sourcePath, previousRange, 0.985),
    offsetDistance
  )
  const nextOffset = getSegmentFrameOffsetPointForTest(
    getSegmentProbeFrameForTest(sourcePath, nextRange, 0.015),
    offsetDistance
  )
  if (!vertex || !previousOffset || !nextOffset) {
    return []
  }

  const outsideBridge = [
    interpolatePoint(previousOffset, nextOffset, 0.25),
    interpolatePoint(previousOffset, nextOffset, 0.5),
    interpolatePoint(previousOffset, nextOffset, 0.75)
  ]
  const centerOutside = interpolatePoint(previousOffset, nextOffset, 0.5)
  const radialBridge = [0.45, 0.65, 0.85].map((amount) =>
    interpolatePoint(vertex, centerOutside, amount)
  )

  return [...outsideBridge, ...radialBridge].map((point, index) => ({
    id: `smooth-join:${previousRange.segmentIndex}:${index}`,
    ...point
  }))
}

const getSignedPolygonAreaForTest = (points: Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const getClosedContourInsideOffsetForTest = (
  sourcePath: Pick<PathGeometry, 'sampledPoints'>,
  strokeWidth: number
) => {
  const area = getSignedPolygonAreaForTest(sourcePath.sampledPoints)
  return area >= 0 ? strokeWidth : -strokeWidth
}

const chooseSegmentSideOffsetForTest = (
  sourcePath: Pick<PathGeometry, 'segments' | 'sampledPoints'>,
  range: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  position: 'inside' | 'outside',
  strokeWidth: number
) => {
  const fallbackOffset = getClosedContourInsideOffsetForTest(
    sourcePath,
    strokeWidth
  )
  const fallback = position === 'inside' ? fallbackOffset : -fallbackOffset
  let leftVotes = 0
  let rightVotes = 0

  for (const ratio of [0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85]) {
    const frame = getSegmentProbeFrameForTest(sourcePath, range, ratio)
    for (const distance of [2, strokeWidth * 0.5, strokeWidth * 0.85]) {
      const leftProbe = getSegmentFrameOffsetPointForTest(frame, distance)
      const rightProbe = getSegmentFrameOffsetPointForTest(frame, -distance)
      if (!leftProbe || !rightProbe) {
        continue
      }

      const leftInside = isPointInPolygon(leftProbe, sourcePath.sampledPoints)
      const rightInside = isPointInPolygon(rightProbe, sourcePath.sampledPoints)
      if (leftInside === rightInside) {
        continue
      }

      if (position === 'inside') {
        if (leftInside) {
          leftVotes += 1
        } else {
          rightVotes += 1
        }
      } else {
        if (leftInside) {
          rightVotes += 1
        } else {
          leftVotes += 1
        }
      }
    }
  }

  if (leftVotes === rightVotes) {
    return fallback
  }

  return leftVotes > rightVotes ? strokeWidth : -strokeWidth
}

const getSegmentInsideAndOppositeProbePoints = (
  sourcePath: Pick<PathGeometry, 'segments' | 'sampledPoints'>,
  range: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  position: 'inside' | 'outside' = 'inside'
) => {
  const expectedInsideOffset = chooseSegmentSideOffsetForTest(
    sourcePath,
    range,
    position,
    5
  )
  const expectedInsideProbes = getSegmentSideProbePoints(
    sourcePath,
    range,
    expectedInsideOffset
  )
  const oppositeSideProbes = getSegmentSideProbePoints(
    sourcePath,
    range,
    -expectedInsideOffset
  )

  return {
    expectedInsideProbes,
    oppositeSideProbes,
    expectedInsideOffset
  }
}

const getDenseSegmentCenterlineProbePoints = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  segmentIds: readonly string[]
) => {
  const ratios = [
    0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
    0.75, 0.8, 0.85, 0.9, 0.95
  ]

  return sourcePath.segments.flatMap((segment, segmentIndex) =>
    ratios.flatMap((ratio) => {
      const frame = getSegmentProbeFrameForTest(
        sourcePath,
        {
          segmentIndex,
          startDistance: 0,
          endDistance: segment.length
        },
        ratio
      )

      return frame
        ? [
            {
              segmentId: segmentIds[segmentIndex] ?? `segment:${segmentIndex}`,
              segmentIndex,
              ratio,
              point: frame.point
            }
          ]
        : []
    })
  )
}

const getSegmentOwnedPolygonsForTest = (
  faces: {
    polygons: Vec2[][]
    sourceSpanIds: readonly string[]
  }[],
  segmentIndex: number
) =>
  faces
    .filter((face) =>
      face.sourceSpanIds.some(
        (sourceSpanId) =>
          sourceSpanId === `segment:${segmentIndex}` ||
          sourceSpanId.startsWith(`segment:${segmentIndex}:`)
      )
    )
    .flatMap((face) => face.polygons)

describe('constrained solid stroke packets', () => {
  it('should detect constrained solid intent only for positive-width inside/outside solid strokes', () => {
    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })
      ])
    ).toBe(true)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'center' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'dashed', position: 'inside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 0, style: 'solid', position: 'outside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({
          visible: false,
          width: 4,
          style: 'solid',
          position: 'inside'
        })
      ])
    ).toBe(false)
  })

  it('should run: emit direct local-side exact packets without exact arrangement metadata', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:direct',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      { candidateMode: 'direct-local-side-exact' }
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'constrained-solid',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            visualOverlapCollapseStatus: 'exact-union'
          })
          .asymmetricMatch(packet.geometry.debugMeta)
      )
    ).toBe(true)
    expect(
      packets.some(
        (packet) => packet.geometry.debugMeta?.arrangementStatus === 'exact'
      )
    ).toBe(false)
    expect(
      packets.flatMap(
        (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
      )
    ).toEqual(expect.arrayContaining(['segment:0', 'vertex:0']))
  })

  it('should run: derive render, hit, and export packets from the same constrained final geometry source', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
  })

  it('should run: materialize constrained solid packets as final faces with legal-domain metadata', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'vector:test:network-a:constrained-solid',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a',
          contourId: 'contour-a',
          legalDomainId: 'legal-domain-a'
        }
      }
    )

    const [face] = buildStrokeFinalFacesFromResolvedPackets(packets)

    expect(face).toMatchObject({
      faceId: packets[0]?.geometry.geometryId,
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      sourceTopology: 'rectangle-equivalent',
      sourceContourIds: ['contour-a'],
      legalDomainIds: ['legal-domain-a']
    })
    expect(face?.ownerSet).toEqual([
      {
        ownerKey: 'vector:test:network-a:stroke:0',
        sourcePathId: 'vector:test:network-a:constrained-solid',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0,
        contourId: 'contour-a'
      }
    ])
  })

  it('should run: resolve open constrained solid packet construction to center-equivalent geometry', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'solid-center',
      sourceTopology: 'open',
      topologyFamily: 'open',
      strokePosition: 'center',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      resolutionStatus: 'native-center'
    })
    expect(packets[0]?.geometry.bounds).toMatchObject({
      minX: 0,
      maxX: 20,
      minY: -2,
      maxY: 2
    })
  })

  it('should run: attach typed owner and network metadata to constrained solid packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'opaque-cache-key',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'typed-vector:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0].geometry.debugMeta).toMatchObject({
      sourcePathId: 'opaque-cache-key',
      ownerKey: 'typed-vector:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      contourId: 'opaque-cache-key:contour:0',
      legalDomainId: 'opaque-cache-key:legal-domain:0',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
  })

  it('should run: preserve constrained solid legal-domain metadata across render, hit, and export packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:legal-domain',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'rect:legal-domain',
          networkId: 'shape'
        }
      }
    )

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(resolved.geometry.debugMeta).toMatchObject({
      sourcePathId: 'rect:legal-domain',
      ownerKey: 'rect:legal-domain:stroke:0',
      strokeIndex: 0,
      contourId: 'rect:legal-domain:contour:0',
      legalDomainId: 'rect:legal-domain:legal-domain:0',
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
  })

  it('should run: keep non-overflow constrained hit inside the legal owner domain', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    const hitArea = createSolidCenterStrokeHitArea(packets)

    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: resolve open constrained solid hit packets to center-equivalent geometry', () => {
    const insidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:inside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )
    const outsidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:outside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'outside' })]
    )

    expect(insidePackets).toHaveLength(1)
    expect(outsidePackets).toHaveLength(1)
    expect(insidePackets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'solid-center',
      sourceTopology: 'open',
      strokePosition: 'center',
      runtimeStatus: 'not-applicable'
    })
    expect(outsidePackets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'solid-center',
      sourceTopology: 'open',
      strokePosition: 'center',
      runtimeStatus: 'not-applicable'
    })
    expect(createSolidCenterStrokeHitArea(insidePackets)?.contains(10, 0)).toBe(
      true
    )
    expect(
      createSolidCenterStrokeHitArea(outsidePackets)?.contains(10, 0)
    ).toBe(true)
    expect(createSolidCenterStrokeHitArea(insidePackets)?.contains(10, 5)).toBe(
      false
    )
    expect(
      createSolidCenterStrokeHitArea(outsidePackets)?.contains(10, 5)
    ).toBe(false)
  })

  it('should run: build a closed outside miter at a source-path seam without an explicit closing segment', () => {
    const points = [
      { x: 40, y: 0 },
      { x: 80, y: 100 },
      { x: 0, y: 100 }
    ]
    const openSegmentLength = Math.hypot(40, 100)
    const sourcePath: PathGeometry = {
      segments: [
        {
          type: 'line',
          start: points[0],
          end: points[1],
          length: openSegmentLength,
          startAnchorType: 'sharp',
          endAnchorType: 'sharp'
        },
        {
          type: 'line',
          start: points[1],
          end: points[2],
          length: 80,
          startAnchorType: 'sharp',
          endAnchorType: 'sharp'
        }
      ],
      closed: true,
      totalLength: openSegmentLength + 80,
      sampledPoints: points
    }
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'triangle:test:outside-implicit-close',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'outside',
          joinType: 'miter',
          miterAngle: 28.96
        })
      ],
      {
        sourcePath,
        selectedSideGuardPoints: points,
        candidateMode: 'exact-arrangement'
      }
    )
    const sourceSpanIds = packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
    )

    expect(sourceSpanIds).toContain('vertex:2')
    expect(
      packets.some((packet) =>
        polygonListContainsPoint(packet.geometry.polygons, { x: 40, y: -8 })
      )
    ).toBe(true)
  })

  it('should run: build a closed outside miter at a smooth-authored seam when source tangents form a corner', () => {
    const points = [
      { x: 40, y: 0 },
      { x: 80, y: 100 },
      { x: 0, y: 100 }
    ]
    const closingCurve = new Bezier(
      points[2],
      { x: 0, y: 80 },
      { x: 20, y: 0 },
      points[0]
    )
    const sourcePath: PathGeometry = {
      segments: [
        {
          type: 'line',
          start: points[0],
          end: points[1],
          length: Math.hypot(40, 100),
          startAnchorType: 'smooth',
          endAnchorType: 'sharp'
        },
        {
          type: 'line',
          start: points[1],
          end: points[2],
          length: 80,
          startAnchorType: 'sharp',
          endAnchorType: 'sharp'
        },
        {
          type: 'cubic',
          start: points[2],
          control1: { x: 0, y: 80 },
          control2: { x: 20, y: 0 },
          end: points[0],
          curve: closingCurve,
          length: closingCurve.length(),
          startAnchorType: 'sharp',
          endAnchorType: 'smooth'
        }
      ],
      closed: true,
      totalLength: Math.hypot(40, 100) + 80 + closingCurve.length(),
      sampledPoints: points
    }
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'triangle:test:outside-smooth-corner-seam',
      points,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'outside',
          joinType: 'miter',
          miterAngle: 28.96
        })
      ],
      {
        sourcePath,
        selectedSideGuardPoints: [
          { ...points[0], sharp: false },
          { ...points[1], sharp: true },
          { ...points[2], sharp: true }
        ],
        candidateMode: 'exact-arrangement'
      }
    )
    const sourceSpanIds = packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
    )

    expect(sourceSpanIds).toContain('vertex:2')
    expect(sourceSpanIds).not.toContain('smooth-join:2')
  })

  it('should run: keep self-intersecting open solid paths on center-equivalent geometry', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'open-self-intersecting:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'solid-center',
      sourceTopology: 'open',
      topologyFamily: 'open',
      strokePosition: 'center',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      resolutionStatus: 'native-center'
    })
  })

  it('should run: require self-intersecting inside solidMaskModel packets, not boundary-domain ribbon products', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfIntersectingSolidDomainFixture()

    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(
      sharedStrokeBoundaryDomains.some(
        (domain) => domain.boundaryRole === 'filled-face'
      )
    ).toBe(true)

    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'self-intersecting-solid-domain-star:inside',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'inside',
          joinType: 'miter',
          capType: 'round'
        })
      ],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        candidateMode: 'exact-arrangement'
      }
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-solid' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.geometry.debugMeta?.runtimeStatus === 'accepted' &&
          packet.geometry.debugMeta?.figmaLikeSideAuthority ===
            'implicit-fill-hole-domain'
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeSelectedSide ===
          packet.geometry.debugMeta?.figmaLikeFilledSide
      )
    ).toBe(true)
    expect(packets.some(solidPacketCarriesSourceVertexProvenance)).toBe(true)
    expect(packets.some(solidPacketHasDashedTerminalMetadata)).toBe(false)
    expect(packets.some(solidPacketUsesBoundaryDomainProductGeometry)).toBe(
      false
    )
    expect(
      packets.every((packet) =>
        packet.geometry.debugMeta?.strokePosition === 'outside'
          ? packet.geometry.debugMeta?.solidMaskModelVisibleRender ===
              'masked-source-stroke' &&
            packet.geometry.debugMeta?.solidMaskModelCoverageOracle ===
              'exact-boolean' &&
            packet.geometry.debugMeta?.solidMaskModelMaskSide ===
              'outside-exterior' &&
            ((packet.geometry.debugMeta?.solidMaskModelRenderStrokePaths
              ?.length ?? 0) > 0 ||
              (packet.geometry.debugMeta?.solidMaskModelRenderFillPolygons
                ?.length ?? 0) > 0) &&
            (packet.geometry.debugMeta?.solidMaskModelRenderClipPolygons
              ?.length ?? 0) > 0
          : true
      ),
      JSON.stringify(
        packets.map((packet) => packet.geometry.debugMeta),
        null,
        2
      )
    ).toBe(true)
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      buildStrokeFinalFacesFromResolvedPackets(packets)
    )
    expect(
      renderEntries.every(
        (entry) =>
          ((entry.strokePaths?.length ?? 0) > 0 ||
            (entry.fillPolygons?.length ?? 0) > 0) &&
          (entry.clipPolygons?.length ?? 0) > 0 &&
          entry.debugMeta?.solidMaskModelVisibleRender ===
            'masked-source-stroke'
      ),
      JSON.stringify(
        renderEntries.map((entry) => ({
          strokePaths: entry.strokePaths?.length ?? 0,
          fillPolygons: entry.fillPolygons?.length ?? 0,
          clipPolygons: entry.clipPolygons?.length ?? 0,
          debugMeta: entry.debugMeta
        })),
        null,
        2
      )
    ).toBe(true)
  })

  it('should run: require self-intersecting outside solidMaskModel packets without internal-adjacency or dashed terminal metadata', async () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfIntersectingSolidDomainFixture()
    const backend = createClipper2GeometryBackend(await loadClipperModule())

    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'self-intersecting-solid-domain-star:outside',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'outside',
          joinType: 'miter',
          capType: 'round'
        })
      ],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        exactBackend: backend,
        candidateMode: 'exact-arrangement'
      }
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeBoundaryRole === 'filled-face'
      )
    ).toBe(false)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeBoundaryRole === 'outer' &&
          packet.geometry.debugMeta?.figmaLikeSelectedSide ===
            packet.geometry.debugMeta?.figmaLikeUnfilledSide &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained'
      )
    ).toBe(true)
    expect(packets.some(solidPacketCarriesSourceVertexProvenance)).toBe(true)
    expect(packets.some(solidPacketHasDashedTerminalMetadata)).toBe(false)
    expect(packets.some(solidPacketUsesBoundaryDomainProductGeometry)).toBe(
      false
    )
  })

  it('should run: keep self-check self-intersecting solid join matrix near the authored source path', async () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfCheckStarSolidDomainFixture()
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const cases = [
      { position: 'outside' as const, joinType: 'miter' as const },
      { position: 'outside' as const, joinType: 'round' as const },
      { position: 'outside' as const, joinType: 'bevel' as const },
      { position: 'inside' as const, joinType: 'miter' as const },
      { position: 'inside' as const, joinType: 'bevel' as const },
      { position: 'inside' as const, joinType: 'round' as const }
    ]
    const outsideRenderMasks: Partial<
      Record<
        'miter' | 'round' | 'bevel',
        { clipPolygons: Vec2[][]; strokeMaskPolygons: Vec2[][] }
      >
    > = {}

    for (const { position, joinType } of cases) {
      const packets = buildConstrainedSolidStrokeResolvedPackets(
        `self-check-star-solid-domain:${position}:${joinType}`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'solid',
            position,
            joinType,
            capType: 'round'
          })
        ],
        {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains,
          candidateMode: 'exact-arrangement',
          exactBackend: backend
        }
      )
      const polygons = packets.flatMap((packet) => packet.geometry.polygons)
      const exportPolygons = buildSolidCenterStrokeExportPackets(
        packets
      ).flatMap((packet) => packet.polygons)
      const collapsedPolygons = collapseStrokeFinalFaceVisualOverlaps(
        buildStrokeFinalFacesFromResolvedPackets(packets),
        { backend }
      ).flatMap((face) => face.polygons)
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        buildStrokeFinalFacesFromResolvedPackets(packets)
      )
      if (position === 'outside') {
        const [entry] = renderEntries
        outsideRenderMasks[joinType] = {
          clipPolygons: entry?.clipPolygons ?? [],
          strokeMaskPolygons: entry?.strokeMaskPolygons ?? []
        }
      }
      const maxDistance = joinType === 'miter' ? 64 : 24
      const farSourceCoverageFailures = getFarSourceCoverageFailures({
        polygons,
        sourcePath,
        maxDistance
      })
      const deepFillCoverageFailures =
        position === 'outside'
          ? getFillRegionDeepCoverageFailures({
              strokePolygons: polygons,
              fillRegions,
              minBoundaryDistance: 12
            })
          : []
      const exportDeepFillCoverageFailures =
        position === 'outside'
          ? getFillRegionDeepCoverageFailures({
              strokePolygons: exportPolygons,
              fillRegions,
              minBoundaryDistance: 12
            })
          : []
      const collapsedDeepFillCoverageFailures =
        position === 'outside'
          ? getFillRegionDeepCoverageFailures({
              strokePolygons: collapsedPolygons,
              fillRegions,
              minBoundaryDistance: 12
            })
          : []
      const sourceSpanIds = packets.flatMap(
        (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
      )
      const sampledVertexSourceSpanIds = sourceSpanIds.filter(
        (sourceSpanId) => {
          const match = /^vertex:(\d+)$/.exec(sourceSpanId)
          return match ? Number(match[1]) >= sourcePath.segments.length : false
        }
      )

      expect(packets.length).toBeGreaterThan(0)
      expect(
        packets.every(
          (packet) =>
            packet.geometry.debugMeta?.geometryFamily === 'constrained-solid' &&
            packet.geometry.debugMeta?.resolutionStatus ===
              'exact-constrained' &&
            packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
        )
      ).toBe(true)
      expect(packets.some(solidPacketHasDashedTerminalMetadata)).toBe(false)
      expect(
        sampledVertexSourceSpanIds,
        JSON.stringify({ position, joinType, sourceSpanIds }, null, 2)
      ).toEqual([])
      expect(
        deepFillCoverageFailures,
        JSON.stringify(
          {
            position,
            joinType,
            deepFillCoverageFailures,
            polygonCount: polygons.length
          },
          null,
          2
        )
      ).toEqual([])
      expect(
        exportDeepFillCoverageFailures,
        JSON.stringify(
          {
            position,
            joinType,
            exportDeepFillCoverageFailures,
            exportPolygonCount: exportPolygons.length
          },
          null,
          2
        )
      ).toEqual([])
      expect(
        collapsedDeepFillCoverageFailures,
        JSON.stringify(
          {
            position,
            joinType,
            collapsedDeepFillCoverageFailures,
            collapsedPolygonCount: collapsedPolygons.length
          },
          null,
          2
        )
      ).toEqual([])
      expect(
        farSourceCoverageFailures,
        JSON.stringify(
          {
            position,
            joinType,
            maxDistance,
            farSourceCoverageFailures,
            polygonCount: polygons.length
          },
          null,
          2
        )
      ).toEqual([])
    }

    const roundMask = outsideRenderMasks.round
    const bevelMask = outsideRenderMasks.bevel
    expect(roundMask).toBeDefined()
    expect(bevelMask).toBeDefined()

    const roundVsBevel = countVisibleMaskCoverageDifferences({
      firstClipPolygons: roundMask?.clipPolygons ?? [],
      firstStrokeMaskPolygons: roundMask?.strokeMaskPolygons ?? [],
      secondClipPolygons: bevelMask?.clipPolygons ?? [],
      secondStrokeMaskPolygons: bevelMask?.strokeMaskPolygons ?? [],
      centers: [
        { x: 360.12094148356584, y: 145.95389587539378 },
        { x: 0, y: 15.668954151283657 }
      ],
      radius: 64,
      step: 2
    })

    expect(
      roundVsBevel.changed,
      JSON.stringify(
        {
          message:
            'outside solid visible mask must preserve source-vertex bevel/round differences before renderer projection',
          roundVsBevel,
          roundMask,
          bevelMask
        },
        null,
        2
      )
    ).toBeGreaterThan(0)
  })

  it('should run: keep self-intersecting solid reload path off boundary-domain packet generation', async () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfIntersectingSolidDomainFixture()
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const phaseNames: string[] = []

    const packets = withVectorRenderPhaseSink(
      (phaseName) => {
        phaseNames.push(phaseName)
      },
      () =>
        buildConstrainedSolidStrokeResolvedPackets(
          'self-intersecting-solid-domain-star:outside-performance',
          topology.normalizedPoints,
          true,
          [
            createDefaultStroke({
              width: 10,
              style: 'solid',
              position: 'outside',
              joinType: 'miter',
              capType: 'round'
            })
          ],
          {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            sharedStrokeBoundaryDomains,
            exactBackend: backend,
            candidateMode: 'exact-arrangement'
          }
        )
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(phaseNames).not.toContain(
      'constrained-solid:self-intersecting-boundary-domain-packets'
    )
  })

  it('should run: keep reported vector-6 outside solid gated local-side candidates covering authored segments', async () => {
    const points = {
      'tp-12': {
        id: 'tp-12',
        kind: 'anchor',
        x: 192.42083700791653,
        y: 0,
        anchorType: 'sharp'
      },
      'tp-13': {
        id: 'tp-13',
        kind: 'anchor',
        x: 11.358174406717296,
        y: 364.1297089212308,
        anchorType: 'sharp'
      },
      'tp-12:out': {
        id: 'tp-12:out',
        kind: 'control',
        x: 170.10536493824844,
        y: 119.07041481724248,
        controlForId: 'tp-12',
        controlRole: 'out'
      },
      'tp-13:in': {
        id: 'tp-13:in',
        kind: 'control',
        x: -42.09205809548172,
        y: 343.2841182453731,
        controlForId: 'tp-13',
        controlRole: 'in'
      },
      'tp-13:out': {
        id: 'tp-13:out',
        kind: 'control',
        x: 78.17096503446606,
        y: 390.18669726605293,
        controlForId: 'tp-13',
        controlRole: 'out'
      },
      'tp-14': {
        id: 'tp-14',
        kind: 'anchor',
        x: 360.120941483566,
        y: 144.31562775593738,
        anchorType: 'sharp'
      },
      'tp-15': {
        id: 'tp-15',
        kind: 'anchor',
        x: 0,
        y: 14.030686031827244,
        anchorType: 'sharp'
      },
      'tp-16': {
        id: 'tp-16',
        kind: 'anchor',
        x: 270.59180204238254,
        y: 345.42212754546125,
        anchorType: 'sharp'
      },
      'tp-15:out': {
        id: 'tp-15:out',
        kind: 'control',
        x: 0,
        y: 14.030686031827244,
        controlForId: 'tp-15',
        controlRole: 'out'
      },
      'tp-16:in': {
        id: 'tp-16:in',
        kind: 'control',
        x: 263.9105229796076,
        y: 362.79345310867603,
        controlForId: 'tp-16',
        controlRole: 'in'
      },
      'tp-16:out': {
        id: 'tp-16:out',
        kind: 'control',
        x: 277.2730811051575,
        y: 328.05080198224647,
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
    const network = {
      id: 'tn-4',
      pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
      segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'vector-6:reported-solid-outside',
      networkId: 'tn-4',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const guardPoints = [
      { x: points['tp-12'].x, y: points['tp-12'].y, sharp: true },
      { x: points['tp-13'].x, y: points['tp-13'].y, sharp: false },
      { x: points['tp-14'].x, y: points['tp-14'].y, sharp: true },
      { x: points['tp-15'].x, y: points['tp-15'].y, sharp: true },
      { x: points['tp-16'].x, y: points['tp-16'].y, sharp: false }
    ]
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const profileVector6Solid = process.env.ASYRA_STROKE_API_PROFILE === '1'
    const profileStart = performance.now()
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'vector-6:reported-solid-outside',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt'
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints,
        candidateMode: 'exact-arrangement',
        exactBackend: backend
      }
    )
    const packetsMs = performance.now() - profileStart

    expect(packets.length).toBeGreaterThan(0)
    // Solid constrained geometry is represented as full-coverage source-span
    // candidates plus vertex joins. It must not be split into hundreds of
    // per-sample cells; doing so turns exact arrangement into a multi-second
    // product render path for vector-6.
    expect(packets.length).toBeLessThanOrEqual(24)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.runtimeStatus === 'candidate'
      )
    ).toBe(true)
    const packetSourceSpanIds = packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
    )
    expect(packetSourceSpanIds).toContain('smooth-join:3')
    expect(packetSourceSpanIds).not.toContain('vertex:3')
    expect(
      packetSourceSpanIds.some((sourceSpanId) =>
        sourceSpanId.startsWith('segment-run:')
      )
    ).toBe(false)

    const forbiddenBridgeProbePoints = [
      { id: 'upper-left empty face', x: 120, y: 80 },
      { id: 'upper-right empty face', x: 292, y: 72 },
      { id: 'right interior empty face', x: 315, y: 150 },
      { id: 'center interior empty face', x: 168, y: 165 },
      { id: 'lower-right interior empty face', x: 244, y: 274 }
    ]
    // Self-intersection is not a product clipping boundary for solid strokes:
    // typed one-sided candidates own the side, while arrangement/collapse only
    // remove same-visual duplicate coverage. Applying fill-domain clipping here
    // deletes authored segments.
    const arrangementStart = performance.now()
    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      packets,
      { backend }
    )
    const arrangementMs = performance.now() - arrangementStart
    const collapseStart = performance.now()
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
      arrangedFaces,
      { backend }
    )
    expect(arrangedFaces.length).toBeLessThanOrEqual(48)
    expect(collapsedFaces.length).toBeLessThanOrEqual(48)
    const collapseMs = performance.now() - collapseStart
    if (profileVector6Solid) {
      // eslint-disable-next-line no-console
      console.info('[vector-6 outside solid profile]', {
        packets: packets.length,
        arrangedFaces: arrangedFaces.length,
        collapsedFaces: collapsedFaces.length,
        packetsMs: Number(packetsMs.toFixed(3)),
        arrangementMs: Number(arrangementMs.toFixed(3)),
        collapseMs: Number(collapseMs.toFixed(3)),
        totalMs: Number((packetsMs + arrangementMs + collapseMs).toFixed(3))
      })
    }
    const bridgeFinalFaceCoverage = forbiddenBridgeProbePoints.flatMap(
      (point) => {
        const coveringFaceIds = collapsedFaces.flatMap((face) =>
          face.polygons.some((polygon) => isPointInPolygon(point, polygon))
            ? [face.faceId]
            : []
        )

        return coveringFaceIds.length === 0
          ? []
          : [{ point: point.id, coveringFaceIds }]
      }
    )
    expect(bridgeFinalFaceCoverage).toEqual([])

    const collapsedPolygons = collapsedFaces.flatMap((face) => face.polygons)
    const arrangedPolygons = arrangedFaces.flatMap((face) => face.polygons)
    const rawPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const representedSourceSegments = new Set(
      collapsedFaces.flatMap((face) =>
        face.sourceSpanIds.flatMap((sourceSpanId) => {
          const match = /^segment:(\d+)/.exec(sourceSpanId)
          return match ? [Number(match[1])] : []
        })
      )
    )
    const missingSegmentBodyCoverage = getSourcePathSegmentRangesForTest(
      sourcePath
    ).flatMap((range) =>
      representedSourceSegments.has(range.segmentIndex)
        ? []
        : [`segment:${range.segmentIndex}`]
    )
    expect(
      missingSegmentBodyCoverage,
      JSON.stringify(
        {
          missingSegmentBodyCoverage,
          packets: packets.map((packet) => ({
            id: packet.geometry.geometryId,
            intervalIndex:
              packet.geometry.debugMeta?.authoredVisibleIntervalIndex,
            sourceSpanIds: packet.geometry.debugMeta?.sourceSpanIds ?? [],
            polygonCount: packet.geometry.polygons.length
          })),
          collapsedFaces: collapsedFaces.map((face) => ({
            faceId: face.faceId,
            sourceSpanIds: face.sourceSpanIds
          }))
        },
        null,
        2
      )
    ).toEqual([])
    const sourceRanges = getSourcePathSegmentRangesForTest(sourcePath)
    const smoothJoinCorridorCoverageFailures = getSmoothJoinCorridorProbePoints(
      sourcePath,
      sourceRanges[3],
      sourceRanges[4],
      10
    ).flatMap((probe) => {
      const rawCovered = polygonListContainsPoint(rawPolygons, probe)
      const arrangedCovered = polygonListContainsPoint(arrangedPolygons, probe)
      const collapsedCovered = polygonListContainsPoint(
        collapsedPolygons,
        probe
      )
      return rawCovered && arrangedCovered && collapsedCovered
        ? []
        : [{ ...probe, rawCovered, arrangedCovered, collapsedCovered }]
    })
    expect(
      smoothJoinCorridorCoverageFailures,
      JSON.stringify(smoothJoinCorridorCoverageFailures, null, 2)
    ).toEqual([])

    const sideProbeResults = sourceRanges.map((range) => {
      const segmentOwnedPolygons = getSegmentOwnedPolygonsForTest(
        collapsedFaces,
        range.segmentIndex
      )
      const { expectedInsideProbes, oppositeSideProbes, expectedInsideOffset } =
        getSegmentInsideAndOppositeProbePoints(sourcePath, range, 'outside')

      return {
        segmentIndex: range.segmentIndex,
        expectedInsideOffset,
        expectedOutsideHits: expectedInsideProbes.filter((point) =>
          polygonListContainsPoint(segmentOwnedPolygons, point)
        ).length,
        productExpectedOutsideHits: expectedInsideProbes.filter((point) =>
          polygonListContainsPoint(collapsedPolygons, point)
        ).length,
        expectedOutsideProbeCount: expectedInsideProbes.length,
        oppositeSideHits: oppositeSideProbes.filter((point) =>
          polygonListContainsPoint(segmentOwnedPolygons, point)
        ).length,
        productOppositeSideHits: oppositeSideProbes.filter((point) =>
          polygonListContainsPoint(collapsedPolygons, point)
        ).length,
        oppositeSideProbeCount: oppositeSideProbes.length
      }
    })
    const wrongSideSegments = sideProbeResults.filter(
      (result) =>
        result.expectedOutsideHits < 2 ||
        result.productExpectedOutsideHits < 2 ||
        result.oppositeSideHits > 1 ||
        result.productOppositeSideHits > 1
    )
    expect(
      wrongSideSegments,
      JSON.stringify(sideProbeResults, null, 2)
    ).toEqual([])

    // Gated self-intersecting solid packets stay local-side candidates until the
    // vector-6 product gates can promote them to exact support.
  })

  it('should run: keep reported vector-6 inside solid from creating bridge faces', async () => {
    const points = {
      'tp-12': {
        id: 'tp-12',
        kind: 'anchor',
        x: 192.42083700791653,
        y: 0,
        anchorType: 'sharp'
      },
      'tp-13': {
        id: 'tp-13',
        kind: 'anchor',
        x: 11.358174406717296,
        y: 364.1297089212308,
        anchorType: 'smooth'
      },
      'tp-12:out': {
        id: 'tp-12:out',
        kind: 'control',
        x: 170.10536493824844,
        y: 119.07041481724248,
        controlForId: 'tp-12',
        controlRole: 'out'
      },
      'tp-13:in': {
        id: 'tp-13:in',
        kind: 'control',
        x: -42.09205809548172,
        y: 343.2841182453731,
        controlForId: 'tp-13',
        controlRole: 'in'
      },
      'tp-13:out': {
        id: 'tp-13:out',
        kind: 'control',
        x: 78.17096503446606,
        y: 390.18669726605293,
        controlForId: 'tp-13',
        controlRole: 'out'
      },
      'tp-14': {
        id: 'tp-14',
        kind: 'anchor',
        x: 360.120941483566,
        y: 144.31562775593738,
        anchorType: 'sharp'
      },
      'tp-15': {
        id: 'tp-15',
        kind: 'anchor',
        x: 0,
        y: 14.030686031827244,
        anchorType: 'sharp'
      },
      'tp-16': {
        id: 'tp-16',
        kind: 'anchor',
        x: 270.59180204238254,
        y: 345.42212754546125,
        anchorType: 'smooth'
      },
      'tp-15:out': {
        id: 'tp-15:out',
        kind: 'control',
        x: 0,
        y: 14.030686031827244,
        controlForId: 'tp-15',
        controlRole: 'out'
      },
      'tp-16:in': {
        id: 'tp-16:in',
        kind: 'control',
        x: 263.9105229796076,
        y: 362.79345310867603,
        controlForId: 'tp-16',
        controlRole: 'in'
      },
      'tp-16:out': {
        id: 'tp-16:out',
        kind: 'control',
        x: 277.2730811051575,
        y: 328.05080198224647,
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
    const network = {
      id: 'tn-4',
      pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
      segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'vector-6:reported-solid-inside',
      networkId: 'tn-4',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const profileVector6Solid = process.env.ASYRA_STROKE_API_PROFILE === '1'
    const profileStart = performance.now()
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'vector-6:reported-solid-inside',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'inside',
          joinType: 'miter',
          capType: 'square'
        })
      ],
      {
        topology,
        sourcePath,
        candidateMode: 'exact-arrangement',
        exactBackend: backend
      }
    )
    const packetsMs = performance.now() - profileStart
    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.runtimeStatus === 'candidate'
      )
    ).toBe(true)
    const arrangementStart = performance.now()
    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      packets,
      { backend }
    )
    const arrangementMs = performance.now() - arrangementStart
    const collapseStart = performance.now()
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
      arrangedFaces,
      { backend }
    )
    const collapseMs = performance.now() - collapseStart
    const cachedArrangementStart = performance.now()
    const cachedArrangedFaces =
      buildArrangedStrokeFinalFacesFromResolvedPackets(packets, { backend })
    const cachedArrangementMs = performance.now() - cachedArrangementStart
    const cachedCollapseStart = performance.now()
    const cachedCollapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
      arrangedFaces,
      { backend }
    )
    const cachedCollapseMs = performance.now() - cachedCollapseStart
    expect(cachedArrangedFaces).toBe(arrangedFaces)
    expect(cachedCollapsedFaces).toBe(collapsedFaces)
    if (profileVector6Solid) {
      // eslint-disable-next-line no-console
      console.info('[vector-6 inside solid profile]', {
        packets: packets.length,
        packetsBySegment: packets.reduce<Record<string, number>>(
          (counts, packet) => {
            const segmentId =
              packet.geometry.debugMeta?.sourceSpanIds
                ?.find((id) => id.startsWith('segment:'))
                ?.split(':')
                .slice(0, 2)
                .join(':') ?? 'unknown'
            counts[segmentId] = (counts[segmentId] ?? 0) + 1
            return counts
          },
          {}
        ),
        arrangedFaces: arrangedFaces.length,
        collapsedFaces: collapsedFaces.length,
        packetsMs: Number(packetsMs.toFixed(3)),
        arrangementMs: Number(arrangementMs.toFixed(3)),
        collapseMs: Number(collapseMs.toFixed(3)),
        cachedArrangementMs: Number(cachedArrangementMs.toFixed(3)),
        cachedCollapseMs: Number(cachedCollapseMs.toFixed(3)),
        totalMs: Number((packetsMs + arrangementMs + collapseMs).toFixed(3))
      })
    }
    const denseCenterlineProbes = getDenseSegmentCenterlineProbePoints(
      sourcePath,
      network.segmentIds
    )
    const rawPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const arrangedPolygons = arrangedFaces.flatMap((face) => face.polygons)
    const collapsedPolygons = collapsedFaces.flatMap((face) => face.polygons)
    const denseCoverageFailures = denseCenterlineProbes.flatMap((probe) => {
      const rawCovered = polygonListContainsPoint(rawPolygons, probe.point)
      const arrangedCovered = polygonListContainsPoint(
        arrangedPolygons,
        probe.point
      )
      const collapsedCovered = polygonListContainsPoint(
        collapsedPolygons,
        probe.point
      )

      return rawCovered && arrangedCovered && collapsedCovered
        ? []
        : [{ ...probe, rawCovered, arrangedCovered, collapsedCovered }]
    })
    const sideProbeResults = getSourcePathSegmentRangesForTest(sourcePath).map(
      (range) => {
        const segmentOwnedPolygons = getSegmentOwnedPolygonsForTest(
          collapsedFaces,
          range.segmentIndex
        )
        const {
          expectedInsideProbes,
          oppositeSideProbes,
          expectedInsideOffset
        } = getSegmentInsideAndOppositeProbePoints(sourcePath, range)
        return {
          segmentIndex: range.segmentIndex,
          expectedInsideOffset,
          expectedInsideHits: expectedInsideProbes.filter((point) =>
            polygonListContainsPoint(segmentOwnedPolygons, point)
          ).length,
          productExpectedInsideHits: expectedInsideProbes.filter((point) =>
            polygonListContainsPoint(collapsedPolygons, point)
          ).length,
          expectedInsideProbeCount: expectedInsideProbes.length,
          oppositeSideHits: oppositeSideProbes.filter((point) =>
            polygonListContainsPoint(segmentOwnedPolygons, point)
          ).length,
          productOppositeSideHits: oppositeSideProbes.filter((point) =>
            polygonListContainsPoint(collapsedPolygons, point)
          ).length,
          oppositeSideProbeCount: oppositeSideProbes.length,
          oppositeSideCoveringFaces: oppositeSideProbes.flatMap(
            (point, probeIndex) => {
              const faces = collapsedFaces
                .map((face) => ({
                  faceId: face.faceId,
                  sourceSpanIds: face.sourceSpanIds,
                  sourceGeometryIds: face.sourceGeometryIds,
                  contains: polygonListContainsPoint(face.polygons, point)
                }))
                .filter((face) => face.contains)

              return faces.length === 0
                ? []
                : [
                    {
                      probeIndex,
                      point,
                      faces: faces.map(
                        ({ faceId, sourceSpanIds, sourceGeometryIds }) => ({
                          faceId,
                          sourceSpanIds,
                          sourceGeometryIds
                        })
                      )
                    }
                  ]
            }
          )
        }
      }
    )
    const wrongSideSegments = sideProbeResults.filter(
      (result) =>
        result.expectedInsideHits < 2 ||
        result.productExpectedInsideHits < 2 ||
        result.oppositeSideHits > 1 ||
        result.productOppositeSideHits > 1
    )
    expect(
      wrongSideSegments,
      JSON.stringify(sideProbeResults, null, 2)
    ).toEqual([])
    expect(
      denseCoverageFailures,
      JSON.stringify(denseCoverageFailures, null, 2)
    ).toEqual([])
    const broadEmptyFaceRegions = [
      { id: 'tp-12 top protrusion', x: 185, y: -10, width: 16, height: 8 },
      { id: 'tp-15 left protrusion', x: -11, y: 5, width: 8, height: 14 },
      { id: 'tp-14 right protrusion', x: 363, y: 138, width: 10, height: 14 },
      { id: 'tp-16 lower protrusion', x: 270, y: 350, width: 10, height: 10 },
      { id: 'center empty face', x: 156, y: 150, width: 24, height: 24 }
    ]
    const broadEmptyFaceFailures = broadEmptyFaceRegions
      .map((region) => ({
        id: region.id,
        coverage: polygonListRegionCoverage(collapsedPolygons, region)
      }))
      .filter((result) => result.coverage > 0.08)
    expect(
      broadEmptyFaceFailures,
      JSON.stringify(broadEmptyFaceFailures, null, 2)
    ).toEqual([])
  })
})
