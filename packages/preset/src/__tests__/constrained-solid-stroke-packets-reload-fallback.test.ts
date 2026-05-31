/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { collapseStrokeFinalFaceVisualOverlaps } from '../components/stroke-render/stroke-candidate-arrangement'
import { buildSolidCenterStrokePolygons } from '../components/stroke-render/solid-center-stroke-geometry'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import type { EvenOddLegalFaceBoundaryEdge } from '../components/stroke-render/self-intersecting-legal-domain'

interface Vec2 {
  x: number
  y: number
}

type StrokeDiagnosticsMode = 'off' | 'summary' | 'full'

const withStrokeDiagnosticsMode = <T>(
  mode: StrokeDiagnosticsMode,
  run: () => T
): T => {
  const target = globalThis as typeof globalThis & {
    __ASYRA_STROKE_DIAGNOSTICS_MODE__?: StrokeDiagnosticsMode
  }
  const previous = target.__ASYRA_STROKE_DIAGNOSTICS_MODE__
  target.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = mode
  try {
    return run()
  } finally {
    target.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = previous
  }
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

const flattenTestRegionPolygons = (regions: { polygons: Vec2[][] }[]) =>
  regions.flatMap((region) =>
    region.polygons.map((polygon) => polygon.map((point) => ({ ...point })))
  )

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

const dotPoints = (first: Vec2, second: Vec2) =>
  first.x * second.x + first.y * second.y

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
    legalFaceBoundaries: selfIntersecting?.legalFaceBoundaries ?? [],
    unfilledFaceBoundaries: selfIntersecting?.unfilledFaceBoundaries ?? [],
    legalBoundaryContours: selfIntersecting?.legalBoundaryContours ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
  }
}

const buildSelfCheckStarSolidDomainFixture = (
  options: { seamStartSegmentId?: string } = {}
) => {
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
  const orderedPointIds = ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16']
  const orderedSegmentIds = ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27']
  const seamSegmentIndex = options.seamStartSegmentId
    ? orderedSegmentIds.indexOf(options.seamStartSegmentId)
    : -1
  const rotate = <T>(items: T[], startIndex: number) =>
    startIndex > 0
      ? [...items.slice(startIndex), ...items.slice(0, startIndex)]
      : items
  const network = {
    id: 'tn-4',
    pointIds: rotate(orderedPointIds, seamSegmentIndex),
    segmentIds: rotate(orderedSegmentIds, seamSegmentIndex),
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
    legalFaceBoundaries: selfIntersecting?.legalFaceBoundaries ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
  }
}

const getSelfCheckRightBottomSourceSegmentEndpointsForTest = () => ({
  start: { x: 0, y: 15.668954151283657 },
  end: { x: 270.59180204238254, y: 347.0603956649177 }
})

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

const sumPolygonPointCount = (polygons: Vec2[][]) =>
  polygons.reduce((sum, polygon) => sum + polygon.length, 0)

const addPhaseDuration = (
  durations: Map<string, number>,
  phaseName: string,
  durationMs: number
) => {
  durations.set(phaseName, (durations.get(phaseName) ?? 0) + durationMs)
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

const countClipPolygonCoverageDifferencesForTest = ({
  firstClipPolygons,
  secondClipPolygons,
  centers,
  radius,
  step
}: {
  firstClipPolygons: Vec2[][]
  secondClipPolygons: Vec2[][]
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
        const firstCovered = polygonListContainsPointWithWinding(
          firstClipPolygons,
          point
        )
        const secondCovered = polygonListContainsPointWithWinding(
          secondClipPolygons,
          point
        )
        compared += 1
        if (firstCovered !== secondCovered) {
          changed += 1
        }
      }
    }
  })

  return { changed, compared }
}

const countClipPolygonCoverageDifferencesAtPointsForTest = ({
  firstClipPolygons,
  secondClipPolygons,
  points
}: {
  firstClipPolygons: Vec2[][]
  secondClipPolygons: Vec2[][]
  points: Vec2[]
}) => {
  let changed = 0

  points.forEach((point) => {
    const firstCovered = polygonListContainsPointWithWinding(
      firstClipPolygons,
      point
    )
    const secondCovered = polygonListContainsPointWithWinding(
      secondClipPolygons,
      point
    )
    if (firstCovered !== secondCovered) {
      changed += 1
    }
  })

  return { changed, compared: points.length }
}

const getFaceCentroidForTest = (face: {
  edges: EvenOddLegalFaceBoundaryEdge[]
}) => {
  const points = face.edges.map((edge) => edge.start)
  return {
    x:
      points.reduce((sum, point) => sum + point.x, 0) /
      Math.max(1, points.length),
    y:
      points.reduce((sum, point) => sum + point.y, 0) /
      Math.max(1, points.length)
  }
}

const _polygonListRegionCoverage = (
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

const getNearestSourceRangeForProbePointForTest = (
  sourcePath: PathGeometry,
  probePoint: Vec2
) => {
  const sourceRanges = getSourcePathSegmentRangesForTest(sourcePath)
  let best: {
    range: (typeof sourceRanges)[number]
    ratio: number
    distance: number
  } | null = null

  sourceRanges.forEach((range) => {
    for (let step = 0; step <= 100; step += 1) {
      const ratio = step / 100
      const frame = getSegmentProbeFrameForTest(sourcePath, range, ratio)
      if (!frame) {
        continue
      }
      const distance = Math.hypot(
        frame.point.x - probePoint.x,
        frame.point.y - probePoint.y
      )
      if (!best || distance < best.distance) {
        best = { range, ratio, distance }
      }
    }
  })

  return best
}

const getSourceRangeForSegmentEndpointsForTest = (
  sourcePath: PathGeometry,
  endpoints: { start: Vec2; end: Vec2 }
) => {
  const sourceRanges = getSourcePathSegmentRangesForTest(sourcePath)
  return sourceRanges.find((range) => {
    const segment = sourcePath.segments[range.segmentIndex]
    return (
      segment &&
      Math.hypot(
        segment.start.x - endpoints.start.x,
        segment.start.y - endpoints.start.y
      ) <= 0.25 &&
      Math.hypot(
        segment.end.x - endpoints.end.x,
        segment.end.y - endpoints.end.y
      ) <= 0.25
    )
  })
}

const getNearestRatioOnSourceRangeForProbePointForTest = (
  sourcePath: PathGeometry,
  range: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  },
  probePoint: Vec2
) => {
  let best: { ratio: number; distance: number } | null = null
  for (let step = 0; step <= 100; step += 1) {
    const ratio = step / 100
    const frame = getSegmentProbeFrameForTest(sourcePath, range, ratio)
    if (!frame) {
      continue
    }
    const distance = Math.hypot(
      frame.point.x - probePoint.x,
      frame.point.y - probePoint.y
    )
    if (!best || distance < best.distance) {
      best = { ratio, distance }
    }
  }
  return best
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

const _getSmoothJoinCorridorProbePoints = (
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

const _getSegmentInsideAndOppositeProbePoints = (
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

const _getDenseSegmentCenterlineProbePoints = (
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

const _getSegmentOwnedPolygonsForTest = (
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

const median = (values: number[]) => {
  const sorted = [...values].sort((first, second) => first - second)
  if (sorted.length === 0) {
    return 0
  }
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const getEdgeLengthForTest = (
  edge: Pick<EvenOddLegalFaceBoundaryEdge, 'start' | 'end'>
) => Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y)

const getEdgeMidpointForTest = (
  edge: Pick<EvenOddLegalFaceBoundaryEdge, 'start' | 'end'>
) => ({
  x: (edge.start.x + edge.end.x) / 2,
  y: (edge.start.y + edge.end.y) / 2
})

const chooseInsideSolidAdjacencyProbeEdgesForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
) => {
  const edges = legalFaceBoundaries.flatMap((face) => face.edges)
  const measurableEdges = edges.filter(
    (edge) =>
      edge.sourceSegmentIndex !== undefined &&
      edge.sourceStartDistance !== undefined &&
      edge.sourceEndDistance !== undefined &&
      getEdgeLengthForTest(edge) > 24
  )
  const sharedEdges = measurableEdges.filter((edge) => edge.oppositeFaceLegal)
  const normalEdges = measurableEdges.filter((edge) => !edge.oppositeFaceLegal)
  const center = {
    x:
      measurableEdges.reduce(
        (sum, edge) => sum + getEdgeMidpointForTest(edge).x,
        0
      ) / Math.max(1, measurableEdges.length),
    y:
      measurableEdges.reduce(
        (sum, edge) => sum + getEdgeMidpointForTest(edge).y,
        0
      ) / Math.max(1, measurableEdges.length)
  }
  const upperLeftScore = (edge: EvenOddLegalFaceBoundaryEdge) => {
    const midpoint = getEdgeMidpointForTest(edge)
    return midpoint.x - center.x + (midpoint.y - center.y) * 0.75
  }
  const sharedEdge = [...sharedEdges].sort(
    (first, second) => upperLeftScore(first) - upperLeftScore(second)
  )[0]
  const normalEdge =
    [...normalEdges]
      .filter(
        (edge) =>
          sharedEdge?.sourceSegmentIndex === undefined ||
          edge.sourceSegmentIndex === sharedEdge.sourceSegmentIndex
      )
      .sort(
        (first, second) =>
          getEdgeLengthForTest(second) - getEdgeLengthForTest(first)
      )[0] ??
    [...normalEdges].sort(
      (first, second) =>
        getEdgeLengthForTest(second) - getEdgeLengthForTest(first)
    )[0]

  return {
    sharedEdge,
    normalEdge
  }
}

const getInsideSolidAdjacencyProbePairsForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
) => {
  const edges = legalFaceBoundaries.flatMap((face) => face.edges)
  const measurableEdges = edges.filter(
    (edge) =>
      edge.sourceSegmentIndex !== undefined &&
      edge.sourceStartDistance !== undefined &&
      edge.sourceEndDistance !== undefined &&
      getEdgeLengthForTest(edge) > 24
  )
  const normalEdges = measurableEdges.filter((edge) => !edge.oppositeFaceLegal)
  const longestNormalEdge = [...normalEdges].sort(
    (first, second) =>
      getEdgeLengthForTest(second) - getEdgeLengthForTest(first)
  )[0]

  return measurableEdges
    .filter((edge) => edge.oppositeFaceLegal)
    .map((sharedEdge) => {
      const normalEdge =
        [...normalEdges]
          .filter(
            (edge) => edge.sourceSegmentIndex === sharedEdge.sourceSegmentIndex
          )
          .sort(
            (first, second) =>
              getEdgeLengthForTest(second) - getEdgeLengthForTest(first)
          )[0] ?? longestNormalEdge
      return normalEdge ? { sharedEdge, normalEdge } : null
    })
    .filter(
      (
        pair
      ): pair is {
        sharedEdge: EvenOddLegalFaceBoundaryEdge
        normalEdge: EvenOddLegalFaceBoundaryEdge
      } => pair !== null
    )
}

const sharedEdgeGeometryKeyForTest = (edge: EvenOddLegalFaceBoundaryEdge) =>
  [
    `${edge.start.x.toFixed(3)}:${edge.start.y.toFixed(3)}`,
    `${edge.end.x.toFixed(3)}:${edge.end.y.toFixed(3)}`
  ]
    .sort()
    .join('|')

const measureCoverageWidthAcrossEdgeForTest = ({
  polygons,
  edge,
  sampleRatio,
  strokeWidth,
  step = 0.5
}: {
  polygons: Vec2[][]
  edge: EvenOddLegalFaceBoundaryEdge
  sampleRatio: number
  strokeWidth: number
  step?: number
}) => {
  const dx = edge.end.x - edge.start.x
  const dy = edge.end.y - edge.start.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-6) {
    return 0
  }
  const normal = {
    x: edge.legalSide === 'left' ? -dy / length : dy / length,
    y: edge.legalSide === 'left' ? dx / length : -dx / length
  }
  const center = {
    x: edge.start.x + dx * sampleRatio,
    y: edge.start.y + dy * sampleRatio
  }
  const samples: { offset: number; covered: boolean }[] = []
  for (let offset = step; offset <= strokeWidth * 1.6 + 1e-6; offset += step) {
    samples.push({
      offset,
      covered: polygonListContainsPointWithWinding(polygons, {
        x: center.x + normal.x * offset,
        y: center.y + normal.y * offset
      })
    })
  }

  let currentStart: number | null = null
  let bestWidth = 0
  samples.forEach((sample, index) => {
    if (sample.covered && currentStart === null) {
      currentStart = sample.offset
    }
    const next = samples[index + 1]
    if (currentStart !== null && (!sample.covered || !next)) {
      const end = sample.covered ? sample.offset : sample.offset - step
      bestWidth = Math.max(bestWidth, Math.max(0, end - currentStart + step))
      currentStart = null
    }
  })

  return bestWidth
}

const lineIntersectionForTest = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
) => {
  const firstDx = firstEnd.x - firstStart.x
  const firstDy = firstEnd.y - firstStart.y
  const secondDx = secondEnd.x - secondStart.x
  const secondDy = secondEnd.y - secondStart.y
  const denominator = firstDx * secondDy - firstDy * secondDx
  if (Math.abs(denominator) <= 1e-9) {
    return null
  }

  const t =
    ((secondStart.x - firstStart.x) * secondDy -
      (secondStart.y - firstStart.y) * secondDx) /
    denominator
  return {
    x: firstStart.x + firstDx * t,
    y: firstStart.y + firstDy * t
  }
}

const getLegalEdgeFrameForTest = (
  edge: EvenOddLegalFaceBoundaryEdge,
  strokeWidth: number
) => {
  const dx = edge.end.x - edge.start.x
  const dy = edge.end.y - edge.start.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-6) {
    return null
  }
  const tangent = { x: dx / length, y: dy / length }
  const normal =
    edge.legalSide === 'left'
      ? { x: -tangent.y, y: tangent.x }
      : { x: tangent.y, y: -tangent.x }

  return {
    length,
    tangent,
    normal,
    width: edge.oppositeFaceLegal ? strokeWidth * 0.5 : strokeWidth
  }
}

const buildExpectedInsideEndpointJoinPolygonForTest = (
  previousEdge: EvenOddLegalFaceBoundaryEdge,
  nextEdge: EvenOddLegalFaceBoundaryEdge,
  strokeWidth: number
) => {
  const previousFrame = getLegalEdgeFrameForTest(previousEdge, strokeWidth)
  const nextFrame = getLegalEdgeFrameForTest(nextEdge, strokeWidth)
  if (!previousFrame || !nextFrame) {
    return null
  }

  const vertex = {
    x: (previousEdge.end.x + nextEdge.start.x) / 2,
    y: (previousEdge.end.y + nextEdge.start.y) / 2
  }
  const previousOffsetVertex = {
    x: vertex.x + previousFrame.normal.x * previousFrame.width,
    y: vertex.y + previousFrame.normal.y * previousFrame.width
  }
  const nextOffsetVertex = {
    x: vertex.x + nextFrame.normal.x * nextFrame.width,
    y: vertex.y + nextFrame.normal.y * nextFrame.width
  }
  if (previousEdge.oppositeFaceLegal !== nextEdge.oppositeFaceLegal) {
    const previousBackDistance = Math.min(
      strokeWidth * 0.65,
      previousFrame.length * 0.24
    )
    const nextForwardDistance = Math.min(
      strokeWidth * 0.35,
      nextFrame.length * 0.5
    )
    const previousBack = {
      x: vertex.x - previousFrame.tangent.x * previousBackDistance,
      y: vertex.y - previousFrame.tangent.y * previousBackDistance
    }
    const previousBackOffset = {
      x: previousBack.x + previousFrame.normal.x * previousFrame.width,
      y: previousBack.y + previousFrame.normal.y * previousFrame.width
    }
    const nextForward = {
      x: vertex.x + nextFrame.tangent.x * nextForwardDistance,
      y: vertex.y + nextFrame.tangent.y * nextForwardDistance
    }
    const nextForwardOffset = {
      x: nextForward.x + nextFrame.normal.x * nextFrame.width,
      y: nextForward.y + nextFrame.normal.y * nextFrame.width
    }

    return [
      previousBack,
      vertex,
      nextForward,
      nextForwardOffset,
      nextOffsetVertex,
      previousBackOffset
    ]
  }
  const previousOffsetStart = {
    x: previousEdge.start.x + previousFrame.normal.x * previousFrame.width,
    y: previousEdge.start.y + previousFrame.normal.y * previousFrame.width
  }
  const nextOffsetEnd = {
    x: nextEdge.end.x + nextFrame.normal.x * nextFrame.width,
    y: nextEdge.end.y + nextFrame.normal.y * nextFrame.width
  }
  const joinPoint = lineIntersectionForTest(
    previousOffsetStart,
    previousOffsetVertex,
    nextOffsetVertex,
    nextOffsetEnd
  )
  const boundedJoinPoint =
    joinPoint &&
    Math.hypot(joinPoint.x - vertex.x, joinPoint.y - vertex.y) <=
      strokeWidth * 4
      ? joinPoint
      : null

  return boundedJoinPoint
    ? [vertex, previousOffsetVertex, boundedJoinPoint, nextOffsetVertex]
    : [vertex, previousOffsetVertex, nextOffsetVertex]
}

const findInsideEndpointJoinProbeForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[],
  sharedEdge: EvenOddLegalFaceBoundaryEdge,
  strokeWidth: number
) => {
  for (const face of legalFaceBoundaries) {
    const index = face.edges.findIndex(
      (edge) => edge.edgeId === sharedEdge.edgeId
    )
    if (index < 0) {
      continue
    }
    const nextEdge = face.edges[(index + 1) % face.edges.length]
    if (
      !nextEdge ||
      Math.hypot(
        nextEdge.start.x - sharedEdge.end.x,
        nextEdge.start.y - sharedEdge.end.y
      ) > 0.75
    ) {
      continue
    }
    const expectedJoinPolygon = buildExpectedInsideEndpointJoinPolygonForTest(
      sharedEdge,
      nextEdge,
      strokeWidth
    )
    const frame = getLegalEdgeFrameForTest(sharedEdge, strokeWidth)
    if (!expectedJoinPolygon || !frame) {
      continue
    }

    return {
      sharedEdge,
      nextEdge,
      frame,
      expectedJoinPolygon,
      vertex: { ...sharedEdge.end }
    }
  }

  return null
}

const analyzeInsideSolidEndpointJoinShapeForTest = ({
  polygons,
  legalFaceBoundaries,
  sharedEdge,
  strokeWidth
}: {
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  sharedEdge: EvenOddLegalFaceBoundaryEdge
  strokeWidth: number
}) => {
  const probe = findInsideEndpointJoinProbeForTest(
    legalFaceBoundaries,
    sharedEdge,
    strokeWidth
  )
  if (!probe) {
    return {
      probeFound: false,
      outsideExpectedJoinCoverage: [],
      missingExpectedJoinCoverage: [],
      sampleCount: 0
    }
  }

  const outsideExpectedJoinCoverage: Vec2[] = []
  const missingExpectedJoinCoverage: Vec2[] = []
  let sampleCount = 0
  for (const tangentOffset of [0.2, 0.32, 0.44, 0.56]) {
    for (const normalOffset of [0.2, 0.35, 0.5]) {
      const point = {
        x:
          probe.vertex.x +
          probe.frame.tangent.x * strokeWidth * tangentOffset +
          probe.frame.normal.x * strokeWidth * normalOffset,
        y:
          probe.vertex.y +
          probe.frame.tangent.y * strokeWidth * tangentOffset +
          probe.frame.normal.y * strokeWidth * normalOffset
      }
      sampleCount += 1
      const expectedJoinContainsPoint = polygonListContainsPointWithWinding(
        [probe.expectedJoinPolygon],
        point
      )
      if (
        !expectedJoinContainsPoint &&
        polygonListContainsPointWithWinding(polygons, point)
      ) {
        outsideExpectedJoinCoverage.push(point)
      }
    }
  }
  const joinBounds = probe.expectedJoinPolygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }
  )
  const joinSampleStep = Math.max(0.75, strokeWidth / 5)
  for (let y = joinBounds.minY; y <= joinBounds.maxY; y += joinSampleStep) {
    for (let x = joinBounds.minX; x <= joinBounds.maxX; x += joinSampleStep) {
      const point = { x, y }
      const awayFromBoundary = probe.expectedJoinPolygon.every(
        (current, index) =>
          pointSegmentDistance(
            point,
            current,
            probe.expectedJoinPolygon[
              (index + 1) % probe.expectedJoinPolygon.length
            ]
          ) > 0.75
      )
      if (
        awayFromBoundary &&
        polygonListContainsPointWithWinding(
          [probe.expectedJoinPolygon],
          point
        ) &&
        !polygonListContainsPointWithWinding(polygons, point)
      ) {
        missingExpectedJoinCoverage.push(point)
      }
    }
  }

  return {
    probeFound: true,
    outsideExpectedJoinCoverage,
    missingExpectedJoinCoverage,
    sampleCount,
    probe
  }
}

const getInsideSolidCornerTransitionProbesForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[],
  strokeWidth: number
) => {
  const probes: {
    faceIndex: number
    vertex: Vec2
    previousEdge: EvenOddLegalFaceBoundaryEdge
    nextEdge: EvenOddLegalFaceBoundaryEdge
    sharedEdge: EvenOddLegalFaceBoundaryEdge
    probeDirection: Vec2
    sideDirection: Vec2
    samplePoints: Vec2[]
  }[] = []
  const centralFaceProbes: typeof probes = []
  const seen = new Set<string>()
  const centralSeen = new Set<string>()

  legalFaceBoundaries.forEach((face, faceIndex) => {
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
          highDegreeVertices.add(`${point.x.toFixed(2)}:${point.y.toFixed(2)}`)
        }
      })
    })
    const isInternalPentagonLikeFace =
      sharedEdgeCount >= 5 &&
      sharedEdgeCount / Math.max(1, face.edges.length) >= 0.8 &&
      highDegreeVertices.size >= 5
    if (!isInternalPentagonLikeFace) {
      return
    }

    const facePoints = face.edges.map((edge) => edge.start)
    const centroid = {
      x:
        facePoints.reduce((sum, point) => sum + point.x, 0) /
        Math.max(1, facePoints.length),
      y:
        facePoints.reduce((sum, point) => sum + point.y, 0) /
        Math.max(1, facePoints.length)
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
        ) > 0.75 ||
        (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
      ) {
        return
      }

      const previousFrame = getLegalEdgeFrameForTest(previousEdge, strokeWidth)
      const nextFrame = getLegalEdgeFrameForTest(nextEdge, strokeWidth)
      if (!previousFrame || !nextFrame) {
        return
      }
      const vertex = {
        x: (previousEdge.end.x + nextEdge.start.x) / 2,
        y: (previousEdge.end.y + nextEdge.start.y) / 2
      }
      const centroidDirection = normalizeVector({
        x: centroid.x - vertex.x,
        y: centroid.y - vertex.y
      })
      const rawProbeDirection =
        normalizeVector({
          x: previousFrame.normal.x + nextFrame.normal.x,
          y: previousFrame.normal.y + nextFrame.normal.y
        }) ?? centroidDirection
      if (!rawProbeDirection || !centroidDirection) {
        return
      }
      const probeDirection =
        rawProbeDirection.x * centroidDirection.x +
          rawProbeDirection.y * centroidDirection.y >=
        0
          ? rawProbeDirection
          : { x: -rawProbeDirection.x, y: -rawProbeDirection.y }
      const tangentDelta = normalizeVector({
        x: nextFrame.tangent.x - previousFrame.tangent.x,
        y: nextFrame.tangent.y - previousFrame.tangent.y
      })
      const perpendicularSideDirection = {
        x: -probeDirection.y,
        y: probeDirection.x
      }
      const sideDirection =
        tangentDelta && dotPoints(perpendicularSideDirection, tangentDelta) < 0
          ? {
              x: -perpendicularSideDirection.x,
              y: -perpendicularSideDirection.y
            }
          : perpendicularSideDirection
      const samplePoints = [0.38, 0.56, 0.74].flatMap((normalOffset) =>
        [-0.18, 0, 0.18].map((sideOffset) => ({
          x:
            vertex.x +
            probeDirection.x * strokeWidth * normalOffset +
            sideDirection.x * strokeWidth * sideOffset,
          y:
            vertex.y +
            probeDirection.y * strokeWidth * normalOffset +
            sideDirection.y * strokeWidth * sideOffset
        }))
      )
      const key = `${vertex.x.toFixed(2)}:${vertex.y.toFixed(2)}`
      if (!centralSeen.has(key)) {
        centralSeen.add(key)
        centralFaceProbes.push({
          faceIndex,
          vertex,
          previousEdge,
          nextEdge,
          sharedEdge: previousEdge,
          probeDirection,
          sideDirection,
          samplePoints
        })
      }
    })
  })

  if (centralFaceProbes.length >= 5) {
    return centralFaceProbes
  }

  legalFaceBoundaries.forEach((face, faceIndex) => {
    face.edges.forEach((previousEdge, edgeIndex) => {
      const nextEdge = face.edges[(edgeIndex + 1) % face.edges.length]
      if (!nextEdge) {
        return
      }
      const vertexDistance = Math.hypot(
        previousEdge.end.x - nextEdge.start.x,
        previousEdge.end.y - nextEdge.start.y
      )
      if (
        vertexDistance > 0.75 ||
        previousEdge.oppositeFaceLegal === nextEdge.oppositeFaceLegal ||
        (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
      ) {
        return
      }

      const sharedEdge = previousEdge.oppositeFaceLegal
        ? previousEdge
        : nextEdge
      const sharedFrame = getLegalEdgeFrameForTest(sharedEdge, strokeWidth)
      if (!sharedFrame) {
        return
      }
      const vertex = {
        x: (previousEdge.end.x + nextEdge.start.x) / 2,
        y: (previousEdge.end.y + nextEdge.start.y) / 2
      }
      const tangentAwayFromVertex =
        sharedEdge.edgeId === previousEdge.edgeId
          ? { x: -sharedFrame.tangent.x, y: -sharedFrame.tangent.y }
          : sharedFrame.tangent
      const samplePoints = [0.18, 0.28, 0.38].flatMap((tangentOffset) =>
        [0.68, 0.82, 0.96].map((normalOffset) => ({
          x:
            vertex.x +
            tangentAwayFromVertex.x * strokeWidth * tangentOffset +
            sharedFrame.normal.x * strokeWidth * normalOffset,
          y:
            vertex.y +
            tangentAwayFromVertex.y * strokeWidth * tangentOffset +
            sharedFrame.normal.y * strokeWidth * normalOffset
        }))
      )
      const key = [
        faceIndex,
        vertex.x.toFixed(2),
        vertex.y.toFixed(2),
        sharedEdge.edgeId
      ].join(':')
      if (!seen.has(key)) {
        seen.add(key)
        probes.push({
          faceIndex,
          vertex,
          previousEdge,
          nextEdge,
          sharedEdge,
          probeDirection: sharedFrame.normal,
          sideDirection: tangentAwayFromVertex,
          samplePoints
        })
      }
    })
  })

  return probes
}

const getRightUpperInsidePentagonCornerProbeForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[],
  strokeWidth: number
) => {
  const probes = getInsideSolidCornerTransitionProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  const center = {
    x:
      probes.reduce((sum, probe) => sum + probe.vertex.x, 0) /
      Math.max(1, probes.length),
    y:
      probes.reduce((sum, probe) => sum + probe.vertex.y, 0) /
      Math.max(1, probes.length)
  }
  return [...probes]
    .filter((probe) => probe.vertex.y <= center.y)
    .sort((first, second) => second.vertex.x - first.vertex.x)[0]
}

const nearestPolygonVertexForTest = (polygons: Vec2[][], point: Vec2) => {
  let nearest: {
    point: Vec2
    distance: number
  } | null = null
  polygons.forEach((polygon) => {
    polygon.forEach((vertex) => {
      const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y)
      if (!nearest || distance < nearest.distance) {
        nearest = {
          point: vertex,
          distance
        }
      }
    })
  })

  return nearest
}

const nearestPolygonSegmentsForTest = (
  polygons: Vec2[][],
  point: Vec2,
  limit = 4
) =>
  polygons
    .flatMap((polygon, polygonIndex) =>
      polygon.map((start, segmentIndex) => {
        const end = polygon[(segmentIndex + 1) % polygon.length]
        return {
          polygonIndex,
          segmentIndex,
          start: {
            x: Number(start.x.toFixed(6)),
            y: Number(start.y.toFixed(6))
          },
          end: {
            x: Number(end.x.toFixed(6)),
            y: Number(end.y.toFixed(6))
          },
          length: Number(
            Math.hypot(end.x - start.x, end.y - start.y).toFixed(6)
          ),
          distance: Number(pointSegmentDistance(point, start, end).toFixed(6))
        }
      })
    )
    .sort((first, second) => first.distance - second.distance)
    .slice(0, limit)

const getPolygonCentroidForTest = (polygon: Vec2[]) => {
  const area = getSignedPolygonArea(polygon)
  if (Math.abs(area) <= 1e-9) {
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

const getContainingPolygonDiagnosticsForTest = (
  polygons: Vec2[][],
  point: Vec2
) =>
  polygons.flatMap((polygon, polygonIndex) => {
    if (!polygonListContainsPointWithWinding([polygon], point)) {
      return []
    }
    const nearest = nearestPolygonVertexForTest([polygon], point)
    return [
      {
        polygonIndex,
        vertexCount: polygon.length,
        area: getSignedPolygonArea(polygon),
        vertices:
          polygon.length <= 8
            ? polygon.map((vertex) => ({
                x: Number(vertex.x.toFixed(6)),
                y: Number(vertex.y.toFixed(6))
              }))
            : undefined,
        bounds: {
          minX: Math.min(...polygon.map((vertex) => vertex.x)),
          minY: Math.min(...polygon.map((vertex) => vertex.y)),
          maxX: Math.max(...polygon.map((vertex) => vertex.x)),
          maxY: Math.max(...polygon.map((vertex) => vertex.y))
        },
        nearestVertex: nearest
      }
    ]
  })

const getDetachedPositiveIslandsInsideCutoutsForTest = ({
  polygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  if (!probe) {
    return []
  }

  const cutouts = polygons
    .map((polygon, polygonIndex) => ({
      polygon,
      polygonIndex,
      area: getSignedPolygonArea(polygon)
    }))
    .filter((entry) => entry.area < -1e-6)
  const maxArtifactArea = strokeWidth * strokeWidth * 1.05

  return polygons.flatMap((polygon, polygonIndex) => {
    const area = getSignedPolygonArea(polygon)
    if (area <= 1e-6 || area > maxArtifactArea) {
      return []
    }
    const centroid = getPolygonCentroidForTest(polygon)
    const containingCutout = cutouts.find((cutout) =>
      isPointInPolygon(centroid, cutout.polygon)
    )
    if (!containingCutout) {
      return []
    }
    const distanceToJoinVertex = Math.hypot(
      centroid.x - probe.vertex.x,
      centroid.y - probe.vertex.y
    )
    if (distanceToJoinVertex > strokeWidth * 3) {
      return []
    }

    return [
      {
        polygonIndex,
        area,
        vertexCount: polygon.length,
        centroid,
        distanceToJoinVertex,
        containingCutout: {
          polygonIndex: containingCutout.polygonIndex,
          area: containingCutout.area
        },
        nearestJoinVertex: nearestPolygonVertexForTest([polygon], probe.vertex)
      }
    ]
  })
}

const samplePathSegmentForTest = (segment: PathSegment) => {
  if (segment.type === 'line') {
    return [{ ...segment.start }, { ...segment.end }]
  }

  return segment.curve.getLUT(32).map((point) => ({
    x: point.x,
    y: point.y
  }))
}

const getSourceSegmentStrokeContributorsForTest = ({
  backend,
  sourcePath,
  join,
  strokeWidth,
  point
}: {
  backend: ReturnType<typeof createClipper2GeometryBackend>
  sourcePath: Pick<PathGeometry, 'segments'>
  join: 'miter' | 'bevel' | 'round'
  strokeWidth: number
  point: Vec2
}) =>
  sourcePath.segments.flatMap((segment, sourceSegmentIndex) => {
    const sampledPoints = samplePathSegmentForTest(segment)
    const regions = backend.union(
      backend.offset(sampledPoints, strokeWidth, {
        width: strokeWidth * 2,
        join,
        cap: 'butt',
        closed: false,
        miterLimit: 4,
        fillRule: 'nonzero'
      }),
      'nonzero'
    )
    const polygons = flattenTestRegionPolygons(regions)
    if (!polygonListContainsPointWithWinding(polygons, point)) {
      return []
    }

    return [
      {
        sourceSegmentIndex,
        segmentType: segment.type,
        start: segment.start,
        end: segment.end,
        nearestVertex: nearestPolygonVertexForTest(polygons, point)
      }
    ]
  })

const getFaceOwnershipEdgeContributorsForTest = ({
  faceOwnershipTrace,
  point
}: {
  faceOwnershipTrace:
    | {
        sourceSegmentIndex?: number
        sourceStartDistance?: number
        sourceEndDistance?: number
        start: Vec2
        end: Vec2
        startNodeDegree: number
        endNodeDegree: number
        faceId: string
        oppositeFaceId?: string | null
        oppositeFaceLegal: boolean
        faceJoinEligibility: 'join-reactive' | 'mask-only'
      }[]
    | undefined
  point: Vec2
}) =>
  [...(faceOwnershipTrace ?? [])]
    .map((trace, traceIndex) => ({
      traceIndex,
      distance: pointSegmentDistance(point, trace.start, trace.end),
      trace
    }))
    .sort((first, second) => first.distance - second.distance)
    .slice(0, 8)

const getInsidePentagonCornerArtifactCandidatesForTest = (
  probe: NonNullable<
    ReturnType<typeof getRightUpperInsidePentagonCornerProbeForTest>
  >,
  strokeWidth: number
) => {
  const previousFrame = getLegalEdgeFrameForTest(
    probe.previousEdge,
    strokeWidth
  )
  const nextFrame = getLegalEdgeFrameForTest(probe.nextEdge, strokeWidth)
  if (!previousFrame || !nextFrame) {
    return []
  }
  const cornerAttachOverlap = Math.min(
    1.5,
    Math.max(
      0.5,
      strokeWidth * 0.12,
      Math.min(previousFrame.length, nextFrame.length) * 0.02
    )
  )
  const highDegreeOverlap = Math.min(
    0.5,
    Math.max(
      0.15,
      strokeWidth * 0.04,
      Math.min(previousFrame.length, nextFrame.length) * 0.01
    )
  )

  return [
    {
      id: 'previous-tangent-attach',
      point: {
        x:
          probe.vertex.x -
          previousFrame.tangent.x * cornerAttachOverlap +
          previousFrame.normal.x * previousFrame.width,
        y:
          probe.vertex.y -
          previousFrame.tangent.y * cornerAttachOverlap +
          previousFrame.normal.y * previousFrame.width
      }
    },
    {
      id: 'next-tangent-attach',
      point: {
        x:
          probe.vertex.x +
          nextFrame.tangent.x * cornerAttachOverlap +
          nextFrame.normal.x * nextFrame.width,
        y:
          probe.vertex.y +
          nextFrame.tangent.y * cornerAttachOverlap +
          nextFrame.normal.y * nextFrame.width
      }
    },
    {
      id: 'previous-high-degree-overlap-offset',
      point: {
        x:
          probe.vertex.x +
          previousFrame.tangent.x * highDegreeOverlap +
          previousFrame.normal.x * previousFrame.width,
        y:
          probe.vertex.y +
          previousFrame.tangent.y * highDegreeOverlap +
          previousFrame.normal.y * previousFrame.width
      }
    },
    {
      id: 'next-high-degree-overlap-offset',
      point: {
        x:
          probe.vertex.x -
          nextFrame.tangent.x * highDegreeOverlap +
          nextFrame.normal.x * nextFrame.width,
        y:
          probe.vertex.y -
          nextFrame.tangent.y * highDegreeOverlap +
          nextFrame.normal.y * nextFrame.width
      }
    }
  ]
}

const expectNoInsidePentagonCornerArtifactVerticesForTest = ({
  name,
  polygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  expect(probe, JSON.stringify({ name }, null, 2)).toBeDefined()
  if (!probe) {
    return
  }

  const candidates = getInsidePentagonCornerArtifactCandidatesForTest(
    probe,
    strokeWidth
  )
  const exposedCandidates = candidates.flatMap((candidate) => {
    const nearest = nearestPolygonVertexForTest(polygons, candidate.point)
    return nearest && nearest.distance <= 0.35
      ? [
          {
            ...candidate,
            nearest
          }
        ]
      : []
  })

  expect(
    exposedCandidates,
    JSON.stringify(
      {
        name,
        probe,
        candidates,
        exposedCandidates
      },
      null,
      2
    )
  ).toEqual([])
}

const getCoverageIntervalsForTest = (
  samples: boolean[]
): { start: number; end: number }[] => {
  const intervals: { start: number; end: number }[] = []
  let start: number | null = null

  samples.forEach((covered, index) => {
    if (covered && start === null) {
      start = index
    }
    if ((!covered || index === samples.length - 1) && start !== null) {
      intervals.push({
        start,
        end: covered && index === samples.length - 1 ? index : index - 1
      })
      start = null
    }
  })

  return intervals
}

const getInsidePentagonCornerCoverageLineAnalysesForTest = ({
  polygons,
  legalFaceBoundaries,
  strokeWidth,
  containsPoint
}: {
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  containsPoint?: (point: Vec2) => boolean
}) => {
  const isCovered =
    containsPoint ??
    ((point: Vec2) => polygonListContainsPointWithWinding(polygons, point))
  return getInsideSolidCornerTransitionProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  ).map((probe, probeIndex) => {
    const lines = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map(
      (normalOffset) => {
        const samples: boolean[] = []
        for (
          let sideOffset = -1.4;
          sideOffset <= 1.4 + 1e-6;
          sideOffset += 0.05
        ) {
          samples.push(
            isCovered({
              x:
                probe.vertex.x +
                probe.probeDirection.x * strokeWidth * normalOffset +
                probe.sideDirection.x * strokeWidth * sideOffset,
              y:
                probe.vertex.y +
                probe.probeDirection.y * strokeWidth * normalOffset +
                probe.sideDirection.y * strokeWidth * sideOffset
            })
          )
        }
        const intervals = getCoverageIntervalsForTest(samples)
        return {
          normalOffset,
          intervalCount: intervals.length,
          coveredCount: samples.filter(Boolean).length,
          intervals
        }
      }
    )

    return {
      probeIndex,
      vertex: probe.vertex,
      lines
    }
  })
}

const getInsidePentagonCornerSplitIntervalDiagnosticsForTest = ({
  visiblePolygons,
  clipPolygons,
  sourceStrokePolygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  visiblePolygons: Vec2[][]
  clipPolygons: Vec2[][]
  sourceStrokePolygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const visibleAnalyses = getInsidePentagonCornerCoverageLineAnalysesForTest({
    polygons: visiblePolygons,
    legalFaceBoundaries,
    strokeWidth
  })
  const clipAnalyses = getInsidePentagonCornerCoverageLineAnalysesForTest({
    polygons: clipPolygons,
    legalFaceBoundaries,
    strokeWidth
  })
  const sourceAnalyses = getInsidePentagonCornerCoverageLineAnalysesForTest({
    polygons: sourceStrokePolygons,
    legalFaceBoundaries,
    strokeWidth
  })
  const splitVisible = visibleAnalyses.flatMap((analysis, probeIndex) => {
    const clipAnalysis = clipAnalyses[probeIndex]
    const sourceAnalysis = sourceAnalyses[probeIndex]
    return analysis.lines.flatMap((line, lineIndex) => {
      if (line.intervalCount <= 1 || line.coveredCount < 3) {
        return []
      }
      return [
        {
          probeIndex: analysis.probeIndex,
          vertex: analysis.vertex,
          normalOffset: line.normalOffset,
          visible: line,
          clip: clipAnalysis?.lines[lineIndex],
          source: sourceAnalysis?.lines[lineIndex]
        }
      ]
    })
  })

  return {
    visibleAnalyses,
    splitVisible
  }
}

const expectNoInsidePentagonCornerSplitIntervalsForTest = ({
  name,
  visiblePolygons,
  clipPolygons,
  sourceStrokePolygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  visiblePolygons: Vec2[][]
  clipPolygons: Vec2[][]
  sourceStrokePolygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const { visibleAnalyses, splitVisible } =
    getInsidePentagonCornerSplitIntervalDiagnosticsForTest({
      visiblePolygons,
      clipPolygons,
      sourceStrokePolygons,
      legalFaceBoundaries,
      strokeWidth
    })

  expect(
    visibleAnalyses.length,
    JSON.stringify({ name, visibleAnalyses }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(
    splitVisible,
    JSON.stringify(
      {
        name,
        reason:
          'visible geometry split into multiple intervals near an internal pentagon corner',
        splitVisible
      },
      null,
      2
    )
  ).toEqual([])
}

const expectRightUpperInsidePentagonClipContainsSourceJoinForTest = ({
  name,
  sourceStrokePolygons,
  clipPolygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  sourceStrokePolygons: Vec2[][]
  clipPolygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  expect(probe, JSON.stringify({ name }, null, 2)).toBeDefined()
  if (!probe) {
    return
  }

  const missingSamples: {
    normalOffset: number
    sideOffset: number
    point: Vec2
  }[] = []

  for (
    let normalOffset = 0.3;
    normalOffset <= 1.02 + 1e-6;
    normalOffset += 0.04
  ) {
    for (
      let sideOffset = -0.62;
      sideOffset <= 0.62 + 1e-6;
      sideOffset += 0.04
    ) {
      const point = {
        x:
          probe.vertex.x +
          probe.probeDirection.x * strokeWidth * normalOffset +
          probe.sideDirection.x * strokeWidth * sideOffset,
        y:
          probe.vertex.y +
          probe.probeDirection.y * strokeWidth * normalOffset +
          probe.sideDirection.y * strokeWidth * sideOffset
      }
      const sourceContainsPoint = polygonListContainsPointWithWinding(
        sourceStrokePolygons,
        point
      )
      if (
        sourceContainsPoint &&
        !polygonListContainsPointWithWinding(clipPolygons, point)
      ) {
        missingSamples.push({
          normalOffset: Number(normalOffset.toFixed(2)),
          sideOffset: Number(sideOffset.toFixed(2)),
          point
        })
      }
    }
  }

  expect(
    missingSamples,
    JSON.stringify(
      {
        name,
        reason:
          'render clip under-admits the authored doubled source-stroke join envelope near the right-upper internal pentagon corner',
        probe,
        missingSamples: missingSamples.slice(0, 40),
        missingCount: missingSamples.length
      },
      null,
      2
    )
  ).toEqual([])
}

const buildOffsetSourceStrokePolygonsForTest = (
  backend: ReturnType<typeof createClipper2GeometryBackend>,
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>,
  join: 'miter' | 'bevel' | 'round',
  strokeWidth: number
) =>
  flattenTestRegionPolygons(
    backend.union(
      backend.offset(sourcePath.sampledPoints, strokeWidth, {
        width: strokeWidth * 2,
        join,
        cap: 'butt',
        closed: sourcePath.closed,
        miterLimit: 4,
        fillRule: 'nonzero'
      }),
      'nonzero'
    )
  )

const buildMaskedVisiblePolygonsForTest = (
  backend: ReturnType<typeof createClipper2GeometryBackend>,
  sourceStrokePolygons: Vec2[][],
  clipPolygons: Vec2[][]
) => {
  if (sourceStrokePolygons.length === 0 || clipPolygons.length === 0) {
    return []
  }

  const sourceStrokeRegions = backend.union(
    sourceStrokePolygons.map((polygon) => ({ polygons: [polygon] })),
    'nonzero'
  )
  const clipRegions = backend.union(
    clipPolygons.map((polygon) => ({ polygons: [polygon] })),
    'nonzero'
  )

  return flattenTestRegionPolygons(
    backend.intersection(sourceStrokeRegions, clipRegions, 'nonzero')
  )
}

const buildUnionPolygonsForTest = (
  backend: ReturnType<typeof createClipper2GeometryBackend>,
  polygons: Vec2[][]
) =>
  flattenTestRegionPolygons(
    backend.union(
      polygons.map((polygon) => ({ polygons: [polygon] })),
      'nonzero'
    )
  )

const getRenderEntrySourceStrokePolygonsForTest = ({
  backend,
  entry,
  sourcePath,
  join,
  strokeWidth
}: {
  backend: ReturnType<typeof createClipper2GeometryBackend>
  entry:
    | {
        strokeMaskPolygons?: Vec2[][]
        strokePaths?: Vec2[][]
      }
    | undefined
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>
  join: 'miter' | 'bevel' | 'round'
  strokeWidth: number
}) => {
  const strokeMaskPolygons = entry?.strokeMaskPolygons ?? []
  const strokePathPolygons =
    entry?.strokePaths && entry.strokePaths.length > 0
      ? buildOffsetSourceStrokePolygonsForTest(
          backend,
          sourcePath,
          join,
          strokeWidth
        )
      : []

  if (strokeMaskPolygons.length > 0 || strokePathPolygons.length > 0) {
    return [...strokePathPolygons, ...strokeMaskPolygons]
  }
  return []
}

const expectRenderEntryHasSourceStrokeMaskForTest = (
  entry:
    | {
        strokeMaskPolygons?: Vec2[][]
        strokePaths?: Vec2[][]
        strokePathStyle?: unknown
      }
    | undefined
) => {
  const strokeMaskPolygonCount = entry?.strokeMaskPolygons?.length ?? 0
  const strokePathCount = entry?.strokePaths?.length ?? 0

  expect(strokeMaskPolygonCount + strokePathCount).toBeGreaterThan(0)
  if (strokePathCount > 0) {
    expect(entry?.strokePathStyle).toBeDefined()
  }
}

const getRenderEntryVisiblePolygonsForTest = ({
  backend,
  entry,
  sourcePath,
  join,
  strokeWidth
}: {
  backend: ReturnType<typeof createClipper2GeometryBackend>
  entry:
    | {
        clipPolygons?: Vec2[][]
        strokeMaskPolygons?: Vec2[][]
        strokePaths?: Vec2[][]
      }
    | undefined
  sourcePath: Pick<PathGeometry, 'sampledPoints' | 'closed'>
  join: 'miter' | 'bevel' | 'round'
  strokeWidth: number
}) => {
  const sourceStrokePolygons = getRenderEntrySourceStrokePolygonsForTest({
    backend,
    entry,
    sourcePath,
    join,
    strokeWidth
  })
  return buildMaskedVisiblePolygonsForTest(
    backend,
    sourceStrokePolygons,
    entry?.clipPolygons ?? []
  )
}

const isInternalPentagonLikeFaceForTest = (face: {
  edges: EvenOddLegalFaceBoundaryEdge[]
}) => {
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
        highDegreeVertices.add(`${point.x.toFixed(2)}:${point.y.toFixed(2)}`)
      }
    })
  })

  return (
    sharedEdgeCount >= 5 &&
    sharedEdgeCount / Math.max(1, face.edges.length) >= 0.8 &&
    highDegreeVertices.size >= 5
  )
}

const getInsideSolidMaskOnlyCornerProbesForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[],
  strokeWidth: number
) => {
  const probes: { vertex: Vec2; samplePoints: Vec2[] }[] = []
  const seen = new Set<string>()

  legalFaceBoundaries.forEach((face) => {
    if (isInternalPentagonLikeFaceForTest(face)) {
      return
    }

    const faceCentroid = getFaceCentroidForTest(face)
    face.edges.forEach((previousEdge, edgeIndex) => {
      const nextEdge = face.edges[(edgeIndex + 1) % face.edges.length]
      if (!nextEdge) {
        return
      }
      const vertexDistance = Math.hypot(
        previousEdge.end.x - nextEdge.start.x,
        previousEdge.end.y - nextEdge.start.y
      )
      if (
        vertexDistance > 0.75 ||
        (previousEdge.endNodeDegree <= 2 && nextEdge.startNodeDegree <= 2)
      ) {
        return
      }

      const vertex = {
        x: (previousEdge.end.x + nextEdge.start.x) / 2,
        y: (previousEdge.end.y + nextEdge.start.y) / 2
      }
      const faceDirection = normalizeVector({
        x: faceCentroid.x - vertex.x,
        y: faceCentroid.y - vertex.y
      })
      if (!faceDirection) {
        return
      }
      const samplePoints = [0.35, 0.55, 0.75, 0.95].map((offset) => ({
        x: vertex.x + faceDirection.x * strokeWidth * offset,
        y: vertex.y + faceDirection.y * strokeWidth * offset
      }))
      const key = `${vertex.x.toFixed(2)}:${vertex.y.toFixed(2)}`
      if (!seen.has(key)) {
        seen.add(key)
        probes.push({ vertex, samplePoints })
      }
    })
  })

  return probes
}

const expectAllInsideSolidCornerProtrusionsForTest = ({
  name,
  polygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probes = getInsideSolidCornerTransitionProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  const missing = probes.filter(
    (probe) =>
      !probe.samplePoints.some((point) =>
        polygonListContainsPointWithWinding(polygons, point)
      )
  )

  expect(
    probes.length,
    JSON.stringify({ name, probes }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(missing, JSON.stringify({ name, missing, probes }, null, 2)).toEqual(
    []
  )
}

const expectInsideSolidRoundCornerSmoothnessForTest = ({
  name,
  polygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probes = getInsideSolidCornerTransitionProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  const analyses = probes.map((probe) => {
    const coveredAngleBuckets: number[] = []
    for (let angleIndex = -11; angleIndex <= 11; angleIndex += 1) {
      const angle = angleIndex * 0.05
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const direction = {
        x: probe.probeDirection.x * cos + probe.sideDirection.x * sin,
        y: probe.probeDirection.y * cos + probe.sideDirection.y * sin
      }
      let covered = false
      for (let radius = 0.55; radius <= 1.65 + 1e-6; radius += 0.075) {
        const point = {
          x: probe.vertex.x + direction.x * strokeWidth * radius,
          y: probe.vertex.y + direction.y * strokeWidth * radius
        }
        if (polygonListContainsPointWithWinding(polygons, point)) {
          covered = true
          break
        }
      }
      if (covered) {
        coveredAngleBuckets.push(angleIndex)
      }
    }
    const gapRuns: number[] = []
    let currentGap = 0
    for (let angleIndex = -11; angleIndex <= 11; angleIndex += 1) {
      if (coveredAngleBuckets.includes(angleIndex)) {
        if (currentGap > 0) {
          gapRuns.push(currentGap)
          currentGap = 0
        }
        continue
      }
      currentGap += 1
    }
    if (currentGap > 0) {
      gapRuns.push(currentGap)
    }

    return {
      vertex: probe.vertex,
      angleBucketCount: coveredAngleBuckets.length,
      maximumGapRun: Math.max(0, ...gapRuns)
    }
  })
  const faceted = analyses.filter(
    (analysis) => analysis.angleBucketCount < 16 || analysis.maximumGapRun > 2
  )

  expect(
    probes.length,
    JSON.stringify({ name, analyses }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(faceted, JSON.stringify({ name, faceted, analyses }, null, 2)).toEqual(
    []
  )
}

const getInsideSolidCornerSingleLobeAnalysisForTest = ({
  probe,
  strokeWidth,
  containsPoint
}: {
  probe: ReturnType<typeof getInsideSolidCornerTransitionProbesForTest>[number]
  strokeWidth: number
  containsPoint: (point: Vec2) => boolean
}) => {
  const splitLobeLines = [0.38, 0.5, 0.62, 0.74].flatMap((normalOffset) => {
    const samples: boolean[] = []
    for (
      let sideOffset = -1.05;
      sideOffset <= 1.05 + 1e-6;
      sideOffset += 0.075
    ) {
      samples.push(
        containsPoint({
          x:
            probe.vertex.x +
            probe.probeDirection.x * strokeWidth * normalOffset +
            probe.sideDirection.x * strokeWidth * sideOffset,
          y:
            probe.vertex.y +
            probe.probeDirection.y * strokeWidth * normalOffset +
            probe.sideDirection.y * strokeWidth * sideOffset
        })
      )
    }

    let intervalCount = 0
    let previousCovered = false
    samples.forEach((covered) => {
      if (covered && !previousCovered) {
        intervalCount += 1
      }
      previousCovered = covered
    })
    const coveredCount = samples.filter(Boolean).length

    return intervalCount > 1 && coveredCount >= 3
      ? [
          {
            normalOffset,
            intervalCount,
            coveredCount
          }
        ]
      : []
  })
  const radialFrontier = Array.from({ length: 17 }, (_unused, index) => {
    const angle = -0.8 + index * 0.1
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const direction = {
      x: probe.probeDirection.x * cos + probe.sideDirection.x * sin,
      y: probe.probeDirection.y * cos + probe.sideDirection.y * sin
    }
    let intervalCount = 0
    let previousCovered = false
    let coveredCount = 0
    let farthestCoveredRadius = 0

    for (
      let radius = strokeWidth * 0.08;
      radius <= strokeWidth * 1.65 + 1e-6;
      radius += 0.25
    ) {
      const covered = containsPoint({
        x: probe.vertex.x + direction.x * radius,
        y: probe.vertex.y + direction.y * radius
      })
      if (covered && !previousCovered) {
        intervalCount += 1
      }
      if (covered) {
        coveredCount += 1
        farthestCoveredRadius = radius
      }
      previousCovered = covered
    }

    return {
      angle,
      intervalCount,
      coveredCount,
      farthestCoveredRadius
    }
  })
  const lobeValleys = radialFrontier.flatMap((entry, index) => {
    if (index < 3 || index > radialFrontier.length - 4) {
      return []
    }
    const leftPeak = Math.max(
      ...radialFrontier
        .slice(Math.max(0, index - 4), index)
        .map((item) => item.farthestCoveredRadius)
    )
    const rightPeak = Math.max(
      ...radialFrontier
        .slice(index + 1, Math.min(radialFrontier.length, index + 5))
        .map((item) => item.farthestCoveredRadius)
    )
    const peakFloor = strokeWidth * 0.72
    return Math.min(leftPeak, rightPeak) >= peakFloor &&
      entry.farthestCoveredRadius + strokeWidth * 0.18 <
        Math.min(leftPeak, rightPeak)
      ? [
          {
            angle: entry.angle,
            farthestCoveredRadius: entry.farthestCoveredRadius,
            leftPeak,
            rightPeak
          }
        ]
      : []
  })
  const splitRays = radialFrontier.filter(
    (entry) => entry.intervalCount > 1 && entry.coveredCount >= 3
  )

  return {
    vertex: probe.vertex,
    splitLobeLines,
    splitRays,
    lobeValleys,
    radialFrontier
  }
}

const getInsideSolidCornerMicroProfileAnalysisForTest = ({
  probe,
  strokeWidth,
  containsPoint
}: {
  probe: ReturnType<typeof getInsideSolidCornerTransitionProbesForTest>[number]
  strokeWidth: number
  containsPoint: (point: Vec2) => boolean
}) => {
  const angleStep = 0.025
  const radiusStep = strokeWidth * 0.0125
  const angles = Array.from({ length: 77 }, (_unused, index) =>
    Number((-0.95 + index * angleStep).toFixed(3))
  )
  const radialFrontier = angles.map((angle) => {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const direction = {
      x: probe.probeDirection.x * cos + probe.sideDirection.x * sin,
      y: probe.probeDirection.y * cos + probe.sideDirection.y * sin
    }
    let intervalCount = 0
    let previousCovered = false
    let coveredCount = 0
    let firstCoveredRadius = 0
    let farthestCoveredRadius = 0

    for (
      let radius = strokeWidth * 0.03;
      radius <= strokeWidth * 1.75 + 1e-6;
      radius += radiusStep
    ) {
      const covered = containsPoint({
        x: probe.vertex.x + direction.x * radius,
        y: probe.vertex.y + direction.y * radius
      })
      if (covered && !previousCovered) {
        intervalCount += 1
        if (firstCoveredRadius === 0) {
          firstCoveredRadius = radius
        }
      }
      if (covered) {
        coveredCount += 1
        farthestCoveredRadius = radius
      }
      previousCovered = covered
    }

    return {
      angle,
      intervalCount,
      coveredCount,
      firstCoveredRadius,
      farthestCoveredRadius
    }
  })

  const meaningfulFrontier = radialFrontier.filter(
    (entry) => entry.farthestCoveredRadius >= strokeWidth * 0.35
  )
  const leftPeak = Math.max(
    0,
    ...meaningfulFrontier
      .filter((entry) => entry.angle <= -0.16)
      .map((entry) => entry.farthestCoveredRadius)
  )
  const centerPeak = Math.max(
    0,
    ...meaningfulFrontier
      .filter((entry) => Math.abs(entry.angle) <= 0.1)
      .map((entry) => entry.farthestCoveredRadius)
  )
  const rightPeak = Math.max(
    0,
    ...meaningfulFrontier
      .filter((entry) => entry.angle >= 0.16)
      .map((entry) => entry.farthestCoveredRadius)
  )
  const sidePeaksExceedCenter =
    leftPeak >= strokeWidth * 0.55 &&
    rightPeak >= strokeWidth * 0.55 &&
    Math.min(leftPeak, rightPeak) > centerPeak + strokeWidth * 0.075
  const transitionValleys = [
    {
      side: 'left' as const,
      sector: meaningfulFrontier.filter(
        (entry) => entry.angle >= -0.62 && entry.angle <= -0.38
      ),
      sidePeak: leftPeak
    },
    {
      side: 'right' as const,
      sector: meaningfulFrontier.filter(
        (entry) => entry.angle >= 0.38 && entry.angle <= 0.62
      ),
      sidePeak: rightPeak
    }
  ].flatMap(({ side, sector, sidePeak }) => {
    if (sector.length === 0) {
      return []
    }
    const valley = sector.reduce((lowest, entry) =>
      entry.farthestCoveredRadius < lowest.farthestCoveredRadius
        ? entry
        : lowest
    )
    const expectedFloor = Math.min(centerPeak, sidePeak)
    return expectedFloor >= strokeWidth * 0.85 &&
      valley.farthestCoveredRadius + strokeWidth * 0.08 < expectedFloor
      ? [
          {
            side,
            angle: valley.angle,
            farthestCoveredRadius: valley.farthestCoveredRadius,
            expectedFloor,
            depth: expectedFloor - valley.farthestCoveredRadius
          }
        ]
      : []
  })

  const splitRays = radialFrontier.filter(
    (entry) => entry.intervalCount > 1 && entry.coveredCount >= 4
  )
  const localPeaks = meaningfulFrontier.flatMap((entry, index) => {
    if (index < 3 || index > meaningfulFrontier.length - 4) {
      return []
    }
    const before = meaningfulFrontier
      .slice(Math.max(0, index - 3), index)
      .map((item) => item.farthestCoveredRadius)
    const after = meaningfulFrontier
      .slice(index + 1, Math.min(meaningfulFrontier.length, index + 4))
      .map((item) => item.farthestCoveredRadius)
    const localFloor = Math.max(...before, ...after)
    return entry.farthestCoveredRadius > localFloor + strokeWidth * 0.06
      ? [
          {
            angle: entry.angle,
            farthestCoveredRadius: entry.farthestCoveredRadius,
            neighborFloor: localFloor
          }
        ]
      : []
  })
  const separatedPeakCount = localPeaks.reduce((count, peak, index) => {
    if (
      index === 0 ||
      Math.abs(peak.angle - localPeaks[index - 1].angle) >= 0.18
    ) {
      return count + 1
    }
    return count
  }, 0)

  const scanlineSplits = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].flatMap(
    (normalOffset) => {
      const samples: boolean[] = []
      for (
        let sideOffset = -1.15;
        sideOffset <= 1.15 + 1e-6;
        sideOffset += 0.025
      ) {
        samples.push(
          containsPoint({
            x:
              probe.vertex.x +
              probe.probeDirection.x * strokeWidth * normalOffset +
              probe.sideDirection.x * strokeWidth * sideOffset,
            y:
              probe.vertex.y +
              probe.probeDirection.y * strokeWidth * normalOffset +
              probe.sideDirection.y * strokeWidth * sideOffset
          })
        )
      }
      const intervals = getCoverageIntervalsForTest(samples)
      return intervals.length > 1 && samples.filter(Boolean).length >= 5
        ? [
            {
              normalOffset,
              intervalCount: intervals.length,
              intervals
            }
          ]
        : []
    }
  )

  return {
    vertex: probe.vertex,
    leftPeak,
    centerPeak,
    rightPeak,
    sidePeaksExceedCenter,
    transitionValleys,
    separatedPeakCount,
    localPeaks,
    splitRays,
    scanlineSplits,
    radialFrontier
  }
}

const expectRightUpperInsidePentagonMicroProfileForTest = ({
  name,
  legalFaceBoundaries,
  strokeWidth,
  layers
}: {
  name: string
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  layers: {
    name: string
    polygons: Vec2[][]
  }[]
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  expect(probe, JSON.stringify({ name }, null, 2)).toBeDefined()
  if (!probe) {
    return
  }

  const analyses = layers.map((layer) => ({
    layer: layer.name,
    analysis: getInsideSolidCornerMicroProfileAnalysisForTest({
      probe,
      strokeWidth,
      containsPoint: (point) =>
        polygonListContainsPointWithWinding(layer.polygons, point)
    })
  }))
  if (process.env.ASYRA_DEBUG_RIGHT_UPPER_INTERNAL_CORNER === '1') {
    const localVertices = layers.map((layer) => ({
      layer: layer.name,
      vertices: layer.polygons.flatMap((polygon, polygonIndex) =>
        polygon.flatMap((point, pointIndex) => {
          const relative = {
            x: point.x - probe.vertex.x,
            y: point.y - probe.vertex.y
          }
          const radius = Math.hypot(relative.x, relative.y)
          if (radius > strokeWidth * 2.2) {
            return []
          }
          return [
            {
              polygonIndex,
              pointIndex,
              point,
              radius,
              angle: Math.atan2(
                dotPoints(relative, probe.sideDirection),
                dotPoints(relative, probe.probeDirection)
              )
            }
          ]
        })
      )
    }))
    console.info(
      JSON.stringify({ name, probe, analyses, localVertices }, null, 2)
    )
  }
  const visibleFailure = analyses
    .filter((item) => item.layer === 'visible')
    .filter(
      ({ analysis }) =>
        analysis.transitionValleys.length > 0 ||
        analysis.separatedPeakCount > 1 ||
        analysis.splitRays.length > 0 ||
        analysis.scanlineSplits.length > 0
    )
  const compactAnalyses = analyses.map(({ layer, analysis }) => ({
    layer,
    vertex: analysis.vertex,
    leftPeak: Number(analysis.leftPeak.toFixed(3)),
    centerPeak: Number(analysis.centerPeak.toFixed(3)),
    rightPeak: Number(analysis.rightPeak.toFixed(3)),
    sidePeaksExceedCenter: analysis.sidePeaksExceedCenter,
    transitionValleys: analysis.transitionValleys.map((valley) => ({
      side: valley.side,
      angle: valley.angle,
      farthestCoveredRadius: Number(valley.farthestCoveredRadius.toFixed(3)),
      expectedFloor: Number(valley.expectedFloor.toFixed(3)),
      depth: Number(valley.depth.toFixed(3))
    })),
    separatedPeakCount: analysis.separatedPeakCount,
    localPeaks: analysis.localPeaks.map((peak) => ({
      angle: peak.angle,
      farthestCoveredRadius: Number(peak.farthestCoveredRadius.toFixed(3)),
      neighborFloor: Number(peak.neighborFloor.toFixed(3))
    })),
    splitRayCount: analysis.splitRays.length,
    scanlineSplitCount: analysis.scanlineSplits.length
  }))

  expect(
    visibleFailure,
    JSON.stringify(
      {
        name,
        reason:
          'right-upper internal pentagon corner exposes multiple micro protrusions after the full visible pipeline',
        compactAnalyses
      },
      null,
      2
    )
  ).toEqual([])
}

const getRightUpperInsidePentagonWideSectorTipContributorsForTest = ({
  legalFaceBoundaries,
  strokeWidth,
  layers,
  faceOwnershipTrace
}: {
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  layers: {
    name: string
    polygons: Vec2[][]
  }[]
  faceOwnershipTrace:
    | {
        sourceSegmentIndex?: number
        sourceStartDistance?: number
        sourceEndDistance?: number
        start: Vec2
        end: Vec2
        startNodeDegree: number
        endNodeDegree: number
        faceId: string
        oppositeFaceId?: string | null
        oppositeFaceLegal: boolean
        faceJoinEligibility: 'join-reactive' | 'mask-only'
      }[]
    | undefined
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  if (!probe) {
    return []
  }

  const minimumArtifactRadius = strokeWidth * 1.08
  const maximumArtifactRadius = strokeWidth * 2.45
  const sideTipAngleRange = {
    min: -2.25,
    max: -0.95
  }

  return layers.flatMap((layer) =>
    layer.polygons.flatMap((polygon, polygonIndex) =>
      polygon.flatMap((point, pointIndex) => {
        const relative = {
          x: point.x - probe.vertex.x,
          y: point.y - probe.vertex.y
        }
        const radius = Math.hypot(relative.x, relative.y)
        if (radius < minimumArtifactRadius || radius > maximumArtifactRadius) {
          return []
        }

        const angle = Math.atan2(
          dotPoints(relative, probe.sideDirection),
          dotPoints(relative, probe.probeDirection)
        )
        if (angle < sideTipAngleRange.min || angle > sideTipAngleRange.max) {
          return []
        }

        const previous =
          polygon[(pointIndex - 1 + polygon.length) % polygon.length]
        const next = polygon[(pointIndex + 1) % polygon.length]
        const previousVector = previous
          ? normalizeVector({
              x: point.x - previous.x,
              y: point.y - previous.y
            })
          : null
        const nextVector = next
          ? normalizeVector({
              x: next.x - point.x,
              y: next.y - point.y
            })
          : null
        const turnAngle =
          previousVector && nextVector
            ? Math.acos(
                Math.max(-1, Math.min(1, dotPoints(previousVector, nextVector)))
              )
            : 0

        return [
          {
            layer: layer.name,
            polygonIndex,
            pointIndex,
            point: {
              x: Number(point.x.toFixed(6)),
              y: Number(point.y.toFixed(6))
            },
            radius: Number(radius.toFixed(6)),
            angle: Number(angle.toFixed(6)),
            previous: previous
              ? {
                  x: Number(previous.x.toFixed(6)),
                  y: Number(previous.y.toFixed(6))
                }
              : null,
            next: next
              ? {
                  x: Number(next.x.toFixed(6)),
                  y: Number(next.y.toFixed(6))
                }
              : null,
            previousSegmentLength: previous
              ? Number(
                  Math.hypot(
                    point.x - previous.x,
                    point.y - previous.y
                  ).toFixed(6)
                )
              : null,
            nextSegmentLength: next
              ? Number(
                  Math.hypot(next.x - point.x, next.y - point.y).toFixed(6)
                )
              : null,
            turnAngle: Number(turnAngle.toFixed(6)),
            nearestInputSegments: layers
              .filter((inputLayer) => inputLayer.name !== layer.name)
              .map((inputLayer) => ({
                layer: inputLayer.name,
                segments: nearestPolygonSegmentsForTest(
                  inputLayer.polygons,
                  point,
                  3
                )
              })),
            nearestFaceOwnershipEdges: getFaceOwnershipEdgeContributorsForTest({
              faceOwnershipTrace,
              point
            }).map((entry) => ({
              distance: Number(entry.distance.toFixed(6)),
              traceIndex: entry.traceIndex,
              faceId: entry.trace.faceId,
              oppositeFaceId: entry.trace.oppositeFaceId,
              oppositeFaceLegal: entry.trace.oppositeFaceLegal,
              faceJoinEligibility: entry.trace.faceJoinEligibility,
              sourceSegmentIndex: entry.trace.sourceSegmentIndex,
              startNodeDegree: entry.trace.startNodeDegree,
              endNodeDegree: entry.trace.endNodeDegree
            }))
          }
        ]
      })
    )
  )
}

const getRightUpperInsidePentagonNearSideTipVerticesForTest = ({
  legalFaceBoundaries,
  strokeWidth,
  layers,
  faceOwnershipTrace
}: {
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  layers: {
    name: string
    polygons: Vec2[][]
  }[]
  faceOwnershipTrace:
    | {
        sourceSegmentIndex?: number
        sourceStartDistance?: number
        sourceEndDistance?: number
        start: Vec2
        end: Vec2
        startNodeDegree: number
        endNodeDegree: number
        faceId: string
        oppositeFaceId?: string | null
        oppositeFaceLegal: boolean
        faceJoinEligibility: 'join-reactive' | 'mask-only'
      }[]
    | undefined
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  if (!probe) {
    return []
  }

  const minimumTipRadius = strokeWidth * 0.55
  const maximumTipRadius = strokeWidth * 1.05
  const minimumSideAngle = 1.15
  const maximumSideAngle = 1.95

  return layers.flatMap((layer) => {
    const vertices = layer.polygons.flatMap((polygon, polygonIndex) =>
      polygon.flatMap((point, pointIndex) => {
        const relative = {
          x: point.x - probe.vertex.x,
          y: point.y - probe.vertex.y
        }
        const radius = Math.hypot(relative.x, relative.y)
        if (radius < minimumTipRadius || radius > maximumTipRadius) {
          return []
        }

        const angle = Math.atan2(
          dotPoints(relative, probe.sideDirection),
          dotPoints(relative, probe.probeDirection)
        )
        if (
          Math.abs(angle) < minimumSideAngle ||
          Math.abs(angle) > maximumSideAngle
        ) {
          return []
        }

        const previous =
          polygon[(pointIndex - 1 + polygon.length) % polygon.length]
        const next = polygon[(pointIndex + 1) % polygon.length]
        const neighborDistances = [previous, next]
          .filter((neighbor): neighbor is Vec2 => neighbor !== undefined)
          .map((neighbor) =>
            Math.hypot(point.x - neighbor.x, point.y - neighbor.y)
          )

        return [
          {
            layer: layer.name,
            polygonIndex,
            pointIndex,
            point: {
              x: Number(point.x.toFixed(6)),
              y: Number(point.y.toFixed(6))
            },
            radius: Number(radius.toFixed(6)),
            angle: Number(angle.toFixed(6)),
            neighborDistances: neighborDistances.map((distance) =>
              Number(distance.toFixed(6))
            ),
            nearestFaceOwnershipEdges: getFaceOwnershipEdgeContributorsForTest({
              faceOwnershipTrace,
              point
            }).map((entry) => ({
              distance: Number(entry.distance.toFixed(6)),
              traceIndex: entry.traceIndex,
              faceId: entry.trace.faceId,
              oppositeFaceId: entry.trace.oppositeFaceId,
              oppositeFaceLegal: entry.trace.oppositeFaceLegal,
              faceJoinEligibility: entry.trace.faceJoinEligibility,
              sourceSegmentIndex: entry.trace.sourceSegmentIndex,
              startNodeDegree: entry.trace.startNodeDegree,
              endNodeDegree: entry.trace.endNodeDegree
            }))
          }
        ]
      })
    )

    return vertices.length > 0 && vertices.length < 4
      ? [
          {
            layer: layer.name,
            vertices
          }
        ]
      : []
  })
}

const getRightUpperInsidePentagonMicroPeakContributorsForTest = ({
  legalFaceBoundaries,
  strokeWidth,
  layers,
  faceOwnershipTrace
}: {
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  layers: {
    name: string
    polygons: Vec2[][]
  }[]
  faceOwnershipTrace:
    | {
        sourceSegmentIndex?: number
        sourceStartDistance?: number
        sourceEndDistance?: number
        start: Vec2
        end: Vec2
        startNodeDegree: number
        endNodeDegree: number
        faceId: string
        oppositeFaceId?: string | null
        oppositeFaceLegal: boolean
        faceJoinEligibility: 'join-reactive' | 'mask-only'
      }[]
    | undefined
}) => {
  const probe = getRightUpperInsidePentagonCornerProbeForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  if (!probe) {
    return []
  }

  return layers.flatMap((layer) => {
    const analysis = getInsideSolidCornerMicroProfileAnalysisForTest({
      probe,
      strokeWidth,
      containsPoint: (point) =>
        polygonListContainsPointWithWinding(layer.polygons, point)
    })
    const sidePeakEntries = analysis.radialFrontier.filter(
      (entry) =>
        Math.abs(entry.angle) >= 0.35 &&
        Math.abs(entry.angle) <= 0.62 &&
        entry.farthestCoveredRadius >= strokeWidth * 0.75 &&
        entry.farthestCoveredRadius > analysis.centerPeak + strokeWidth * 0.075
    )

    return sidePeakEntries.map((entry) => {
      const cos = Math.cos(entry.angle)
      const sin = Math.sin(entry.angle)
      const direction = {
        x: probe.probeDirection.x * cos + probe.sideDirection.x * sin,
        y: probe.probeDirection.y * cos + probe.sideDirection.y * sin
      }
      const point = {
        x: probe.vertex.x + direction.x * entry.farthestCoveredRadius,
        y: probe.vertex.y + direction.y * entry.farthestCoveredRadius
      }

      return {
        layer: layer.name,
        angle: entry.angle,
        farthestCoveredRadius: Number(entry.farthestCoveredRadius.toFixed(3)),
        centerPeak: Number(analysis.centerPeak.toFixed(3)),
        point: {
          x: Number(point.x.toFixed(6)),
          y: Number(point.y.toFixed(6))
        },
        clipContributors: getContainingPolygonDiagnosticsForTest(
          layer.polygons,
          point
        ).map((contributor) => ({
          polygonIndex: contributor.polygonIndex,
          vertexCount: contributor.vertexCount,
          area: Number(contributor.area.toFixed(6)),
          bounds: {
            minX: Number(contributor.bounds.minX.toFixed(6)),
            minY: Number(contributor.bounds.minY.toFixed(6)),
            maxX: Number(contributor.bounds.maxX.toFixed(6)),
            maxY: Number(contributor.bounds.maxY.toFixed(6))
          },
          nearestVertex: contributor.nearestVertex
            ? {
                point: {
                  x: Number(contributor.nearestVertex.point.x.toFixed(6)),
                  y: Number(contributor.nearestVertex.point.y.toFixed(6))
                },
                distance: Number(contributor.nearestVertex.distance.toFixed(6))
              }
            : null
        })),
        nearestFaceOwnershipEdges: getFaceOwnershipEdgeContributorsForTest({
          faceOwnershipTrace,
          point
        }).map((entry) => ({
          distance: Number(entry.distance.toFixed(6)),
          traceIndex: entry.traceIndex,
          faceId: entry.trace.faceId,
          oppositeFaceId: entry.trace.oppositeFaceId,
          oppositeFaceLegal: entry.trace.oppositeFaceLegal,
          faceJoinEligibility: entry.trace.faceJoinEligibility,
          sourceSegmentIndex: entry.trace.sourceSegmentIndex,
          startNodeDegree: entry.trace.startNodeDegree,
          endNodeDegree: entry.trace.endNodeDegree
        }))
      }
    })
  })
}

const expectInsideSolidRoundCornerSingleLobesForTest = ({
  name,
  polygons,
  legalFaceBoundaries,
  strokeWidth,
  containsPoint
}: {
  name: string
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
  containsPoint?: (point: Vec2) => boolean
}) => {
  const probes = getInsideSolidCornerTransitionProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  const isCovered =
    containsPoint ??
    ((point: Vec2) => polygonListContainsPointWithWinding(polygons, point))
  const analyses = probes.map((probe) =>
    getInsideSolidCornerSingleLobeAnalysisForTest({
      probe,
      strokeWidth,
      containsPoint: isCovered
    })
  )
  const splitLobes = analyses.filter(
    (analysis) =>
      analysis.splitLobeLines.length > 0 ||
      analysis.splitRays.length > 0 ||
      analysis.lobeValleys.length > 0
  )

  expect(
    probes.length,
    JSON.stringify({ name, analyses }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(
    splitLobes,
    JSON.stringify({ name, splitLobes, analyses }, null, 2)
  ).toEqual([])
}

const getLowerHighCurvatureProbesForTest = (
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[],
  strokeWidth: number
) => {
  const allEdges = legalFaceBoundaries.flatMap((face) => face.edges)
  const allPoints = allEdges.flatMap((edge) => [edge.start, edge.end])
  const center = {
    x:
      allPoints.reduce((sum, point) => sum + point.x, 0) /
      Math.max(1, allPoints.length),
    y:
      allPoints.reduce((sum, point) => sum + point.y, 0) /
      Math.max(1, allPoints.length)
  }
  const byVertex = new Map<
    string,
    {
      vertex: Vec2
      incident: {
        edge: EvenOddLegalFaceBoundaryEdge
        at: 'start' | 'end'
      }[]
    }
  >()
  allEdges.forEach((edge) => {
    ;[
      { at: 'start' as const, point: edge.start, degree: edge.startNodeDegree },
      { at: 'end' as const, point: edge.end, degree: edge.endNodeDegree }
    ].forEach(({ at, point, degree }) => {
      if (degree <= 2 || point.y <= center.y) {
        return
      }
      const key = `${point.x.toFixed(2)}:${point.y.toFixed(2)}`
      const record = byVertex.get(key) ?? {
        vertex: { ...point },
        incident: []
      }
      record.incident.push({ edge, at })
      byVertex.set(key, record)
    })
  })
  const lowerVertices = [...byVertex.values()].sort(
    (first, second) => second.vertex.y - first.vertex.y
  )
  const lowerBand = lowerVertices.slice(0, Math.min(4, lowerVertices.length))
  const left = [...lowerBand].sort(
    (first, second) => first.vertex.x - second.vertex.x
  )[0]
  const right = [...lowerBand].sort(
    (first, second) => second.vertex.x - first.vertex.x
  )[0]

  return [
    { id: 'inside-solid-lower-left-high-curvature-no-gap', entry: left },
    { id: 'inside-solid-lower-right-high-curvature-no-gap', entry: right }
  ].flatMap(({ id, entry }) => {
    if (!entry) {
      return []
    }
    const samplePoints = entry.incident.flatMap(({ edge, at }) => {
      const frame = getLegalEdgeFrameForTest(edge, strokeWidth)
      if (!frame) {
        return []
      }
      const tangentAway =
        at === 'start'
          ? frame.tangent
          : { x: -frame.tangent.x, y: -frame.tangent.y }
      return [0.2, 0.42, 0.64].flatMap((tangentOffset) =>
        [0.3, 0.55, 0.8].map((normalOffset) => ({
          x:
            entry.vertex.x +
            tangentAway.x * strokeWidth * tangentOffset +
            frame.normal.x * strokeWidth * normalOffset,
          y:
            entry.vertex.y +
            tangentAway.y * strokeWidth * tangentOffset +
            frame.normal.y * strokeWidth * normalOffset
        }))
      )
    })
    return [{ id, vertex: entry.vertex, samplePoints }]
  })
}

const expectInsideSolidLowerHighCurvatureCoverageForTest = ({
  name,
  polygons,
  legalFaceBoundaries,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  legalFaceBoundaries: { edges: EvenOddLegalFaceBoundaryEdge[] }[]
  strokeWidth: number
}) => {
  const probes = getLowerHighCurvatureProbesForTest(
    legalFaceBoundaries,
    strokeWidth
  )
  const missing = probes.filter((probe) => {
    const coveredCount = probe.samplePoints.filter((point) =>
      polygonListContainsPointWithWinding(polygons, point)
    ).length
    return (
      coveredCount < Math.max(2, Math.floor(probe.samplePoints.length * 0.2))
    )
  })

  expect(
    probes.map((probe) => probe.id).sort(),
    JSON.stringify({ name, probes }, null, 2)
  ).toEqual([
    'inside-solid-lower-left-high-curvature-no-gap',
    'inside-solid-lower-right-high-curvature-no-gap'
  ])
  expect(missing, JSON.stringify({ name, missing, probes }, null, 2)).toEqual(
    []
  )
}

const analyzeInsideSolidRightBottomSourceSegmentAdherenceForTest = ({
  polygons,
  sourcePath,
  strokeWidth,
  targetPoint,
  targetSegmentEndpoints
}: {
  polygons: Vec2[][]
  sourcePath: PathGeometry
  strokeWidth: number
  targetPoint?: Vec2
  targetSegmentEndpoints?: { start: Vec2; end: Vec2 }
}) => {
  const sourceRanges = getSourcePathSegmentRangesForTest(sourcePath)
  const internalPentagonRightBottomT = 0.676
  const defaultTargetPoint =
    targetPoint ??
    getSegmentProbeFrameForTest(
      sourcePath,
      sourceRanges[3],
      internalPentagonRightBottomT
    )?.point
  const endpointRange = targetSegmentEndpoints
    ? getSourceRangeForSegmentEndpointsForTest(
        sourcePath,
        targetSegmentEndpoints
      )
    : undefined
  const target = defaultTargetPoint
    ? endpointRange
      ? {
          range: endpointRange,
          ...(getNearestRatioOnSourceRangeForProbePointForTest(
            sourcePath,
            endpointRange,
            defaultTargetPoint
          ) ?? {
            ratio: internalPentagonRightBottomT,
            distance: Number.POSITIVE_INFINITY
          })
        }
      : getNearestSourceRangeForProbePointForTest(
          sourcePath,
          defaultTargetPoint
        )
    : null
  const targetSegmentRange = endpointRange ?? target?.range
  const targetRatio = target?.ratio ?? internalPentagonRightBottomT
  const sampleAnalyses = [-0.02, -0.01, 0, 0.01, 0.02].flatMap((delta) => {
    if (!targetSegmentRange) {
      return []
    }
    const frame = getSegmentProbeFrameForTest(
      sourcePath,
      targetSegmentRange,
      targetRatio + delta
    )
    if (!frame) {
      return []
    }
    const normal = { x: -frame.tangent.y, y: frame.tangent.x }
    const sideCounts = [-1, 1].map(
      (side) =>
        [0.12, 0.24, 0.36, 0.48].filter((offset) =>
          polygonListContainsPointWithWinding(polygons, {
            x: frame.point.x + normal.x * side * strokeWidth * offset,
            y: frame.point.y + normal.y * side * strokeWidth * offset
          })
        ).length
    )

    return [
      {
        point: frame.point,
        sideCounts,
        // Source-segment adherence is one-sided contact/no-wedge, not adjacency width.
        covered: Math.max(...sideCounts) >= 2
      }
    ]
  })
  const coveredCount = sampleAnalyses.filter((entry) => entry.covered).length
  const sampleCount = sampleAnalyses.length

  return {
    targetSegmentRange,
    targetRatio,
    targetDistance: target?.distance,
    sampleAnalyses,
    coveredCount,
    sampleCount,
    coverageRatio: coveredCount / Math.max(1, sampleCount)
  }
}

const expectInsideSolidRightBottomSourceSegmentAdherenceForTest = ({
  name,
  polygons,
  sourcePath,
  strokeWidth,
  targetPoint,
  targetSegmentEndpoints
}: {
  name: string
  polygons: Vec2[][]
  sourcePath: PathGeometry
  strokeWidth: number
  targetPoint?: Vec2
  targetSegmentEndpoints?: { start: Vec2; end: Vec2 }
}) => {
  const {
    targetSegmentRange,
    targetRatio,
    targetDistance,
    sampleAnalyses,
    coveredCount,
    sampleCount,
    coverageRatio
  } = analyzeInsideSolidRightBottomSourceSegmentAdherenceForTest({
    polygons,
    sourcePath,
    strokeWidth,
    targetPoint,
    targetSegmentEndpoints
  })
  expect(
    targetSegmentRange,
    JSON.stringify(
      { name, sourceRanges: getSourcePathSegmentRangesForTest(sourcePath) },
      null,
      2
    )
  ).toBeTruthy()
  expect(
    targetDistance ?? Number.POSITIVE_INFINITY,
    JSON.stringify(
      { name, targetPoint, targetSegmentRange, targetRatio, targetDistance },
      null,
      2
    )
  ).toBeLessThanOrEqual(strokeWidth * 0.25)
  expect(
    sampleCount,
    JSON.stringify({ name, sampleAnalyses }, null, 2)
  ).toBeGreaterThan(0)
  expect(
    coverageRatio,
    JSON.stringify({ name, sampleAnalyses, coveredCount, sampleCount }, null, 2)
  ).toBeGreaterThanOrEqual(0.8)
}

const analyzeInsideSolidRightBottomSourceSegmentLayerCoverageForTest = ({
  backend,
  entry,
  sourcePath,
  join,
  strokeWidth,
  targetPoint,
  targetSegmentEndpoints
}: {
  backend: ReturnType<typeof createClipper2GeometryBackend>
  entry:
    | {
        clipPolygons?: Vec2[][]
        strokeMaskPolygons?: Vec2[][]
        strokePaths?: Vec2[][]
      }
    | undefined
  sourcePath: PathGeometry
  join: 'miter' | 'bevel' | 'round'
  strokeWidth: number
  targetPoint?: Vec2
  targetSegmentEndpoints?: { start: Vec2; end: Vec2 }
}) => {
  const sourceRanges = getSourcePathSegmentRangesForTest(sourcePath)
  const internalPentagonRightBottomT = 0.676
  const defaultTargetPoint =
    targetPoint ??
    getSegmentProbeFrameForTest(
      sourcePath,
      sourceRanges[3],
      internalPentagonRightBottomT
    )?.point
  const endpointRange = targetSegmentEndpoints
    ? getSourceRangeForSegmentEndpointsForTest(
        sourcePath,
        targetSegmentEndpoints
      )
    : undefined
  const target = defaultTargetPoint
    ? endpointRange
      ? {
          range: endpointRange,
          ...(getNearestRatioOnSourceRangeForProbePointForTest(
            sourcePath,
            endpointRange,
            defaultTargetPoint
          ) ?? {
            ratio: internalPentagonRightBottomT,
            distance: Number.POSITIVE_INFINITY
          })
        }
      : getNearestSourceRangeForProbePointForTest(
          sourcePath,
          defaultTargetPoint
        )
    : null
  const targetSegmentRange = endpointRange ?? target?.range
  const targetRatio = target?.ratio ?? internalPentagonRightBottomT
  const sourcePolygons = getRenderEntrySourceStrokePolygonsForTest({
    backend,
    entry,
    sourcePath,
    join,
    strokeWidth
  })
  const clipPolygons = entry?.clipPolygons ?? []
  const visiblePolygons = getRenderEntryVisiblePolygonsForTest({
    backend,
    entry,
    sourcePath,
    join,
    strokeWidth
  })
  const sourceUnionPolygons = buildUnionPolygonsForTest(backend, sourcePolygons)
  const clipUnionPolygons = buildUnionPolygonsForTest(backend, clipPolygons)
  const visibleUnionPolygons = buildUnionPolygonsForTest(
    backend,
    visiblePolygons
  )

  const samples = [-0.02, -0.01, 0, 0.01, 0.02].flatMap((delta) => {
    if (!targetSegmentRange) {
      return []
    }
    const frame = getSegmentProbeFrameForTest(
      sourcePath,
      targetSegmentRange,
      targetRatio + delta
    )
    if (!frame) {
      return []
    }
    const normal = { x: -frame.tangent.y, y: frame.tangent.x }

    return [-1, 1].flatMap((side) =>
      [0.12, 0.24, 0.36, 0.48].map((offset) => {
        const point = {
          x: frame.point.x + normal.x * side * strokeWidth * offset,
          y: frame.point.y + normal.y * side * strokeWidth * offset
        }
        const source = polygonListContainsPointWithWinding(
          sourceUnionPolygons,
          point
        )
        const clip = polygonListContainsPointWithWinding(
          clipUnionPolygons,
          point
        )
        const visible = polygonListContainsPointWithWinding(
          visibleUnionPolygons,
          point
        )

        return {
          t: targetRatio + delta,
          side,
          offset,
          point,
          source,
          clip,
          visible,
          nearestSourceVertex: nearestPolygonVertexForTest(
            sourcePolygons,
            point
          ),
          nearestClipVertex: nearestPolygonVertexForTest(clipPolygons, point)
        }
      })
    )
  })

  return {
    targetSegmentRange,
    targetRatio,
    targetDistance: target?.distance,
    sourcePolygonCount: sourcePolygons.length,
    clipPolygonCount: clipPolygons.length,
    visiblePolygonCount: visiblePolygons.length,
    samples,
    sourceUnderAdmits: samples.filter(
      (sample) => !sample.source && sample.clip && !sample.visible
    ),
    clipUnderAdmits: samples.filter(
      (sample) => sample.source && !sample.clip && !sample.visible
    ),
    intersectionUnderAdmits: samples.filter(
      (sample) => sample.source && sample.clip && !sample.visible
    ),
    visibleSamples: samples.filter((sample) => sample.visible)
  }
}

const getClosedSourceAnchorPointsForTest = (sourcePath: PathGeometry) => {
  const anchors = new Map<string, Vec2>()

  sourcePath.segments.forEach((segment) => {
    const key = `${segment.start.x.toFixed(3)}:${segment.start.y.toFixed(3)}`
    anchors.set(key, { ...segment.start })
  })

  if (!sourcePath.closed && sourcePath.segments.length > 0) {
    const last = sourcePath.segments[sourcePath.segments.length - 1]
    const key = `${last.end.x.toFixed(3)}:${last.end.y.toFixed(3)}`
    anchors.set(key, { ...last.end })
  }

  return [...anchors.values()]
}

const expectInsideSolidOuterSourceVertexCoverageForTest = ({
  name,
  polygons,
  sourcePath,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  sourcePath: PathGeometry
  strokeWidth: number
}) => {
  const anchors = getClosedSourceAnchorPointsForTest(sourcePath)
  const center = {
    x:
      anchors.reduce((sum, point) => sum + point.x, 0) /
      Math.max(1, anchors.length),
    y:
      anchors.reduce((sum, point) => sum + point.y, 0) /
      Math.max(1, anchors.length)
  }
  const anchorAnalyses = anchors.map((anchor, anchorIndex) => {
    const direction = normalizeVector({
      x: center.x - anchor.x,
      y: center.y - anchor.y
    })
    const samplePoints = direction
      ? [0.25, 0.42, 0.6, 0.78, 0.96].map((offset) => ({
          x: anchor.x + direction.x * strokeWidth * offset,
          y: anchor.y + direction.y * strokeWidth * offset
        }))
      : []
    const coveredCount = samplePoints.filter((point) =>
      polygonListContainsPointWithWinding(polygons, point)
    ).length

    return {
      anchorIndex,
      anchor,
      coveredCount,
      sampleCount: samplePoints.length,
      samplePoints
    }
  })
  const missing = anchorAnalyses.filter(
    (analysis) => analysis.coveredCount < Math.max(2, analysis.sampleCount - 2)
  )

  expect(
    anchors.length,
    JSON.stringify({ name, anchorAnalyses }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(
    missing,
    JSON.stringify({ name, missing, anchorAnalyses }, null, 2)
  ).toEqual([])
}

const analyzeInsideSolidAdjacencyCoverageForTest = ({
  polygons,
  sharedEdge,
  normalEdge,
  strokeWidth
}: {
  polygons: Vec2[][]
  sharedEdge: EvenOddLegalFaceBoundaryEdge
  normalEdge: EvenOddLegalFaceBoundaryEdge
  strokeWidth: number
}) => {
  const ratios = [0.35, 0.5, 0.65]
  const sharedWidths = ratios.map((ratio) =>
    measureCoverageWidthAcrossEdgeForTest({
      polygons,
      edge: sharedEdge,
      sampleRatio: ratio,
      strokeWidth
    })
  )
  const normalWidths = ratios.map((ratio) =>
    measureCoverageWidthAcrossEdgeForTest({
      polygons,
      edge: normalEdge,
      sampleRatio: ratio,
      strokeWidth
    })
  )
  const sharedMedian = median(sharedWidths)
  const normalMedian = median(normalWidths)

  return {
    sharedWidths,
    normalWidths,
    sharedMedian,
    normalMedian,
    ratio: normalMedian > 0 ? sharedMedian / normalMedian : Infinity
  }
}

const expectInsideSolidAdjacencyCoverageForTest = ({
  name,
  polygons,
  sharedEdge,
  normalEdge,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  sharedEdge: EvenOddLegalFaceBoundaryEdge
  normalEdge: EvenOddLegalFaceBoundaryEdge
  strokeWidth: number
}) => {
  const analysis = analyzeInsideSolidAdjacencyCoverageForTest({
    polygons,
    sharedEdge,
    normalEdge,
    strokeWidth
  })

  expect(
    analysis.normalMedian,
    JSON.stringify({ name, analysis, sharedEdge, normalEdge }, null, 2)
  ).toBeGreaterThan(0)
  expect(
    analysis.ratio,
    JSON.stringify({ name, analysis, sharedEdge, normalEdge }, null, 2)
  ).toBeGreaterThanOrEqual(0.85)
  expect(
    analysis.ratio,
    JSON.stringify({ name, analysis, sharedEdge, normalEdge }, null, 2)
  ).toBeLessThanOrEqual(1.25)
}

const expectAllInsideSolidSharedEdgesForTest = ({
  name,
  polygons,
  probePairs,
  strokeWidth
}: {
  name: string
  polygons: Vec2[][]
  probePairs: {
    sharedEdge: EvenOddLegalFaceBoundaryEdge
    normalEdge: EvenOddLegalFaceBoundaryEdge
  }[]
  strokeWidth: number
}) => {
  expect(probePairs.length, JSON.stringify({ name }, null, 2)).toBeGreaterThan(
    0
  )

  const analyses = probePairs.map((pair) => ({
    key: sharedEdgeGeometryKeyForTest(pair.sharedEdge),
    sharedEdge: pair.sharedEdge,
    normalEdge: pair.normalEdge,
    analysis: analyzeInsideSolidAdjacencyCoverageForTest({
      polygons,
      sharedEdge: pair.sharedEdge,
      normalEdge: pair.normalEdge,
      strokeWidth
    })
  }))

  analyses.forEach((entry) => {
    expect(
      entry.analysis.normalMedian,
      JSON.stringify({ name, entry }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      entry.analysis.ratio,
      JSON.stringify({ name, entry }, null, 2)
    ).toBeGreaterThanOrEqual(0.85)
    expect(
      entry.analysis.ratio,
      JSON.stringify({ name, entry }, null, 2)
    ).toBeLessThanOrEqual(1.25)
  })

  const groupedBySharedEdge = analyses.reduce((groups, entry) => {
    const group = groups.get(entry.key) ?? []
    group.push(entry)
    groups.set(entry.key, group)
    return groups
  }, new Map<string, typeof analyses>())

  groupedBySharedEdge.forEach((group, key) => {
    if (group.length < 2) {
      return
    }
    const combinedSharedMedian = group
      .slice(0, 2)
      .reduce((sum, entry) => sum + entry.analysis.sharedMedian, 0)
    const normalMedian = median(
      group
        .map((entry) => entry.analysis.normalMedian)
        .filter((value) => value > 0)
    )
    const combinedRatio =
      normalMedian > 0 ? combinedSharedMedian / normalMedian : Infinity

    expect(
      combinedRatio,
      JSON.stringify({ name, key, group, combinedRatio }, null, 2)
    ).toBeGreaterThanOrEqual(0.85)
    expect(
      combinedRatio,
      JSON.stringify({ name, key, group, combinedRatio }, null, 2)
    ).toBeLessThanOrEqual(2.25)
  })
}

describe('constrained solid stroke packets: reload and fallback guards', () => {
  it('should run: keep all internal pentagon corner join envelopes single-source', async () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      legalFaceBoundaries,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfCheckStarSolidDomainFixture()
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const cases = ['miter', 'bevel', 'round'] as const

    cases.forEach((joinType) => {
      const packets = buildConstrainedSolidStrokeResolvedPackets(
        `self-check-star-solid-domain:inside:${joinType}:all-corner-envelope`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'solid',
            position: 'inside',
            joinType,
            capType: 'round'
          })
        ],
        {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          implicitLegalFaceBoundaries: legalFaceBoundaries,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains,
          candidateMode: 'exact-arrangement',
          exactBackend: backend
        }
      )
      const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        buildStrokeFinalFacesFromResolvedPackets(packets)
      )
      const sourceStrokePolygons = getRenderEntrySourceStrokePolygonsForTest({
        backend,
        entry,
        sourcePath,
        join: joinType,
        strokeWidth: 10
      })
      const visiblePolygons = getRenderEntryVisiblePolygonsForTest({
        backend,
        entry,
        sourcePath,
        join: joinType,
        strokeWidth: 10
      })

      expect(packets.length).toBeGreaterThan(0)
      expectRenderEntryHasSourceStrokeMaskForTest(entry)
      if (joinType === 'round') {
        expectInsideSolidRoundCornerSingleLobesForTest({
          name: `inside solid ${joinType} all internal pentagon corner envelopes`,
          polygons: visiblePolygons,
          legalFaceBoundaries,
          strokeWidth: 10
        })
        expectInsideSolidRoundCornerSmoothnessForTest({
          name: 'inside solid round all internal pentagon corner envelopes',
          polygons: visiblePolygons,
          legalFaceBoundaries,
          strokeWidth: 10
        })
      } else {
        expectNoInsidePentagonCornerSplitIntervalsForTest({
          name: `inside solid ${joinType} all internal pentagon corner envelopes`,
          visiblePolygons,
          clipPolygons: entry?.clipPolygons ?? [],
          sourceStrokePolygons,
          legalFaceBoundaries,
          strokeWidth: 10
        })
      }
    })
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

  it('should run: reject self-intersecting solid local-side fallback without face-owned mask evidence', async () => {
    const { sourcePath, topology } = buildSelfCheckStarSolidDomainFixture()
    const backend = createClipper2GeometryBackend(await loadClipperModule())

    const insidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'self-check-star-solid-domain:inside:missing-face-owned-mask',
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
        candidateMode: 'exact-arrangement',
        exactBackend: backend
      }
    )
    const outsidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'self-check-star-solid-domain:outside:missing-face-owned-mask',
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
        candidateMode: 'exact-arrangement',
        exactBackend: backend
      }
    )

    expect(insidePackets).toEqual([])
    expect(outsidePackets).toEqual([])
  })
})
