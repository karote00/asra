/* eslint-disable @typescript-eslint/no-unused-vars */
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
  slicePathGeometryFrames,
  slicePathGeometryPoints
} from '../components/stroke-render/path-geometry'
import { resolveSourcePathStrokeSide } from '../components/stroke-render/stroke-side-resolution'
import { buildConstrainedDashedLocalSideStrokePolygons } from '../components/stroke-render/constrained-dashed-local-side-geometry'
import { buildDashedCenterRibbonGeometry } from '../components/stroke-render/dashed-center-ribbon-geometry'
import { buildSolidCenterStrokePolygons } from '../components/stroke-render/solid-center-stroke-geometry'
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
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from '../components/stroke-render/resolved-vector-geometry-model'
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
    sharedStrokeBoundaryDomains:
      resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ??
      [],
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

const getPolygonEdgeLengths = (polygon: { x: number; y: number }[]) =>
  polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return pointDistance(point, next)
  })

const HIGH_CURVATURE_CONTOUR_EDGE_LIMIT = 3

const getPolygonQualityFailures = (
  polygonRecords: {
    polygons: { x: number; y: number }[][]
    intervalId?: string
    splitRangeId?: string
    terminalRole?: string
  }[]
) =>
  polygonRecords.flatMap((record) =>
    record.polygons.flatMap((polygon) => {
      if (polygon.length < 40) {
        return []
      }

      const edgeLengths = getPolygonEdgeLengths(polygon)
      const sortedEdgeLengths = [...edgeLengths].sort((a, b) => a - b)
      const fifthPercentileEdge =
        sortedEdgeLengths[Math.floor(sortedEdgeLengths.length * 0.05)] ??
        Infinity
      const microEdgeCount = edgeLengths.filter(
        (length) => length < 0.03
      ).length
      if (fifthPercentileEdge >= 0.03 && microEdgeCount < 5) {
        return []
      }

      return [
        {
          intervalId: record.intervalId,
          splitRangeId: record.splitRangeId,
          terminalRole: record.terminalRole,
          vertexCount: polygon.length,
          microEdgeCount,
          fifthPercentileEdge: Math.round(fifthPercentileEdge * 1000) / 1000,
          shortestEdge:
            Math.round((sortedEdgeLengths[0] ?? Infinity) * 1000) / 1000
        }
      ]
    })
  )

const getClippedPolygonQualityFailures = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  getPolygonQualityFailures(
    packets.map((packet) => ({
      polygons: packet.geometry.polygons,
      intervalId: packet.geometry.debugMeta?.intervalId,
      splitRangeId: packet.geometry.debugMeta?.figmaLikeSplitRangeId,
      terminalRole: packet.geometry.debugMeta?.figmaLikeTerminalRole
    }))
  )

const getHighCurvatureFanPolygonFailures = (
  polygonRecords: {
    polygons: { x: number; y: number }[][]
    intervalId?: string
    splitRangeId?: string
    terminalRole?: string
    boundaryRole?: string
    strokePosition?: string
  }[]
) =>
  polygonRecords.flatMap((record) =>
    record.polygons.flatMap((polygon) => {
      if (
        record.strokePosition !== 'outside' ||
        record.boundaryRole !== 'outer'
      ) {
        return []
      }

      const bounds = getPointBounds(polygon)
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      const maxDimension = Math.max(width, height)
      const bboxArea = Math.max(width * height, 1e-6)
      const area = Math.abs(
        polygon.reduce((total, point, index) => {
          const next = polygon[(index + 1) % polygon.length]
          return total + point.x * next.y - next.x * point.y
        }, 0) / 2
      )
      const fillRatio = area / bboxArea
      const edgeLengths = getPolygonEdgeLengths(polygon)
      const coarseContourEdgeCount = edgeLengths.filter(
        (length) => length > HIGH_CURVATURE_CONTOUR_EDGE_LIMIT
      ).length

      const compactCurvedTerminal =
        maxDimension <= 42 &&
        fillRatio >= 0.35 &&
        coarseContourEdgeCount <= Math.max(4, Math.ceil(polygon.length * 0.08))
      const broadSparseFan =
        maxDimension > 48 && (fillRatio < 0.18 || coarseContourEdgeCount >= 8)

      if (
        compactCurvedTerminal ||
        maxDimension <= 18 ||
        !broadSparseFan ||
        (polygon.length <= 120 && fillRatio >= 0.12)
      ) {
        return []
      }

      return [
        {
          intervalId: record.intervalId,
          splitRangeId: record.splitRangeId,
          terminalRole: record.terminalRole,
          vertexCount: polygon.length,
          coarseContourEdgeCount,
          fillRatio: Math.round(fillRatio * 1000) / 1000,
          bounds: {
            width: Math.round(width * 1000) / 1000,
            height: Math.round(height * 1000) / 1000
          }
        }
      ]
    })
  )

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

const getPointToPolygonBoundaryDistance = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  if (polygon.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      pointSegmentDistance(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      )
    )
  }

  return minDistance
}

const getPointToPolygonsBoundaryDistance = (
  point: { x: number; y: number },
  polygons: { x: number; y: number }[][]
) =>
  polygons.reduce(
    (minDistance, polygon) =>
      Math.min(minDistance, getPointToPolygonBoundaryDistance(point, polygon)),
    Number.POSITIVE_INFINITY
  )

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

const getHighResolutionClosedPathPoints = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
) =>
  sourcePath.closed
    ? slicePathGeometryPoints(
        sourcePath,
        0,
        sourcePath.totalLength,
        false,
        0.1,
        {
          minCubicSamples: 64,
          maxCubicSamples: 512,
          useRangeLengthForSampleCount: false
        }
      )
    : sourcePath.sampledPoints

const isPointInsideEvenOddLegalDomain = (
  point: { x: number; y: number },
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  tolerance = 0.75
) => {
  const implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
  if (implicitFillRegions.length > 0) {
    return implicitFillRegions.some((region) =>
      region.polygons.some(
        (polygon) =>
          isPointInsideEvenOdd(point, polygon) ||
          isPointOnPolygonBoundary(point, polygon, tolerance)
      )
    )
  }

  const legalBoundary = getHighResolutionClosedPathPoints(sourcePath)
  return (
    isPointInsideEvenOdd(point, legalBoundary) ||
    isPointOnPolygonBoundary(point, legalBoundary, tolerance)
  )
}

const isPointInsidePolygonRegionsForTest = (
  point: { x: number; y: number },
  regions: PolygonRegion[],
  tolerance = 0.75
) =>
  regions.some((region) =>
    region.polygons.some(
      (polygon) =>
        isPointInsideEvenOdd(point, polygon) ||
        isPointOnPolygonBoundary(point, polygon, tolerance)
    )
  )

const isPointInsideResolvedLegalDomainForTest = (
  point: { x: number; y: number },
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  tolerance = 0.75,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
) =>
  implicitFillRegions.length > 0
    ? isPointInsidePolygonRegionsForTest(point, implicitFillRegions, tolerance)
    : isPointInsideEvenOddLegalDomain(point, sourcePath, tolerance)

const getPointLegalBoundaryDistanceForTest = (
  point: { x: number; y: number },
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
) => {
  const implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
  const legalPolygons =
    implicitFillRegions.length > 0
      ? implicitFillRegions.flatMap((region) => region.polygons)
      : [getHighResolutionClosedPathPoints(sourcePath)]

  return legalPolygons.reduce((minDistance, polygon) => {
    if (polygon.length < 2) {
      return minDistance
    }

    let polygonMinDistance = minDistance
    for (let index = 0; index < polygon.length; index += 1) {
      polygonMinDistance = Math.min(
        polygonMinDistance,
        pointSegmentDistance(
          point,
          polygon[index],
          polygon[(index + 1) % polygon.length]
        )
      )
    }
    return polygonMinDistance
  }, Infinity)
}

const getSignedPolygonAreaForRegionWinding = (
  points: { x: number; y: number }[]
) => {
  let area = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    area += point.x * next.y - next.x * point.y
  })
  return area / 2
}

const normalizeTestCoveragePolygonWinding = (
  polygon: { x: number; y: number }[]
) =>
  getSignedPolygonAreaForRegionWinding(polygon) < 0
    ? [...polygon].reverse()
    : polygon

const toTestPolygonRegions = (polygons: { x: number; y: number }[][]) =>
  polygons.map((polygon) => ({
    polygons: [normalizeTestCoveragePolygonWinding(polygon)]
  }))

const getCoveragePolygonsForTest = (regions: PolygonRegion[]) =>
  regions.flatMap((region) => region.polygons)

const getRegionArea = (regions: PolygonRegion[]) =>
  regions.reduce(
    (sum, region) =>
      sum +
      region.polygons.reduce(
        (polygonSum, polygon) =>
          polygonSum + Math.abs(signedPolygonArea(polygon)),
        0
      ),
    0
  )

const normalizePolygonRegionsForTest = (regions: PolygonRegion[]) => {
  if (regions.length === 0) {
    return regions
  }
  const backend = getGeometryBackend()
  return backend.capabilities.union
    ? backend.union(regions, 'nonzero')
    : regions
}

const getEvenOddLegalRegionsForTest = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
): PolygonRegion[] => {
  const implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
  if (implicitFillRegions.length > 0) {
    return implicitFillRegions
  }

  const legalBoundary = getHighResolutionClosedPathPoints(sourcePath)
  return legalBoundary.length >= 3 ? [{ polygons: [legalBoundary] }] : []
}

const getInsideLegalResidueArea = (
  polygons: { x: number; y: number }[][],
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
) => {
  const legalRegions =
    implicitFillRegions.length > 0
      ? implicitFillRegions
      : getEvenOddLegalRegionsForTest(sourcePath)
  if (legalRegions.length === 0 || polygons.length === 0) {
    return 0
  }

  const backend = getGeometryBackend()
  const normalizedLegalRegions = backend.capabilities.union
    ? backend.union(legalRegions, 'nonzero')
    : legalRegions
  const legalMask =
    normalizedLegalRegions.length > 0 ? normalizedLegalRegions : legalRegions
  const outsideResidue = getCoveragePolygonsForTest(
    backend.difference(toTestPolygonRegions(polygons), legalMask, 'nonzero')
  )

  return outsideResidue.reduce(
    (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
    0
  )
}

const getNormalizedCoverageRegionsForTest = (
  polygons: { x: number; y: number }[][]
) => normalizePolygonRegionsForTest(toTestPolygonRegions(polygons))

const getSymmetricDifferenceAreaForTest = (
  actualPolygons: { x: number; y: number }[][],
  expectedPolygons: { x: number; y: number }[][]
) => {
  const backend = getGeometryBackend()
  const actualRegions = getNormalizedCoverageRegionsForTest(actualPolygons)
  const expectedRegions = getNormalizedCoverageRegionsForTest(expectedPolygons)
  return (
    getRegionArea(
      backend.difference(actualRegions, expectedRegions, 'nonzero')
    ) +
    getRegionArea(backend.difference(expectedRegions, actualRegions, 'nonzero'))
  )
}

const getSamePaintOverlapAreaForTest = (
  polygons: { x: number; y: number }[][]
) => {
  if (polygons.length <= 1) {
    return 0
  }

  const rawArea = getRegionArea(toTestPolygonRegions(polygons))
  const unionArea = getRegionArea(getNormalizedCoverageRegionsForTest(polygons))
  return Math.max(0, rawArea - unionArea)
}

const expectInsideDashedNoSamePaintOverdraw = ({
  label,
  stroke,
  actualPolygons
}: {
  label: string
  stroke: ReturnType<typeof createDefaultStroke>
  actualPolygons: { x: number; y: number }[][]
}) => {
  const rawArea = getRegionArea(toTestPolygonRegions(actualPolygons))
  const unionArea = getRegionArea(
    getNormalizedCoverageRegionsForTest(actualPolygons)
  )
  const overlapArea = getSamePaintOverlapAreaForTest(actualPolygons)
  const maxAllowedArea = Math.max(0.5, rawArea * 0.0005)

  expect(
    overlapArea,
    JSON.stringify(
      {
        label,
        reason:
          'inside dashed product geometry is a single same-paint stroke product; overlapping polygons would overdraw darker pixels in the app',
        rawArea,
        unionArea,
        overlapArea,
        maxAllowedArea,
        polygonCount: actualPolygons.length,
        strokeWidth: stroke.width
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(maxAllowedArea)
}

const buildInsideDashedDoubledCenterReferencePolygonsForTest = ({
  sourcePath,
  stroke,
  fillRegions,
  domainOptions
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
}) => {
  const backend = getGeometryBackend()
  const renderableStroke = getOnlyRenderableStroke([stroke])
  const intervals = buildStrokeEventMap(
    sourcePath,
    stroke,
    fillRegions,
    domainOptions
  ).dashIntervals.filter((interval) => interval.length > 1e-6)
  const doubledCenterStroke = {
    style: 'solid' as const,
    position: 'center' as const,
    width: renderableStroke.width * 2,
    join: renderableStroke.join,
    miterLimit: renderableStroke.miterLimit,
    cap: renderableStroke.cap
  }
  const productPolygons = intervals.flatMap((interval) => {
    const frames = slicePathGeometryFrames(
      sourcePath,
      interval.startDistance,
      interval.endDistance,
      interval.wrapsSeam,
      0.25,
      {
        minCubicSamples: 16,
        maxCubicSamples: 256,
        useRangeLengthForSampleCount: true
      }
    )
    if (frames.length < 2) {
      return []
    }
    const ribbonGeometry = buildDashedCenterRibbonGeometry(
      frames.map((frame) => ({
        point: frame.point,
        tangent: frame.tangent,
        sharpJoin: frame.sharpJoin
      })),
      doubledCenterStroke,
      { allowRoundCapBackendOffset: true }
    )
    return ribbonGeometry.polygons.length > 0
      ? ribbonGeometry.polygons
      : buildSolidCenterStrokePolygons(
          frames.map((frame) => frame.point),
          false,
          doubledCenterStroke
        )
  })
  if (productPolygons.length === 0 || fillRegions.length === 0) {
    return productPolygons
  }
  return backend
    .intersection(
      toTestPolygonRegions(productPolygons),
      normalizePolygonRegionsForTest(fillRegions),
      'nonzero'
    )
    .flatMap((region) => region.polygons)
}

const getPacketPolygonsForTest = (
  packets: { geometry: { polygons: { x: number; y: number }[][] } }[]
) => packets.flatMap((packet) => packet.geometry.polygons)

const expectInsideDashedProductFinalPacketOwnership = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) => {
  expect(
    packets.every(
      (packet) =>
        packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
          'product-final' &&
        packet.geometry.debugMeta?.strokePosition === 'inside'
    )
  ).toBe(true)
}

const expectInsideDashedPolygonsPreserveSplitRangeRule = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  actualPolygons,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  actualPolygons: { x: number; y: number }[][]
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
}) => {
  const outsideResidueArea = getInsideLegalResidueArea(
    actualPolygons,
    sourcePath,
    fillRegions
  )

  expect(
    {
      outsideResidueArea,
      polygonCount: actualPolygons.length
    },
    label
  ).toMatchObject({
    outsideResidueArea: expect.any(Number),
    polygonCount: expect.any(Number)
  })
  expect(
    outsideResidueArea,
    `${label}:inside-legal-residue`
  ).toBeLessThanOrEqual(stroke.width * stroke.width * 4.5)

  expectInsideDashedDoubledCenterReferenceParity({
    label,
    sourcePath,
    stroke,
    fillRegions,
    actualPolygons,
    domainOptions
  })
}

const expectInsideDashedDoubledCenterReferenceParity = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  actualPolygons,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  actualPolygons: { x: number; y: number }[][]
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
}) => {
  const expectedPolygons =
    buildInsideDashedDoubledCenterReferencePolygonsForTest({
      sourcePath,
      stroke,
      fillRegions,
      domainOptions
    })
  const expectedArea = getRegionArea(toTestPolygonRegions(expectedPolygons))
  const actualArea = getRegionArea(toTestPolygonRegions(actualPolygons))
  const symmetricDifferenceArea = getSymmetricDifferenceAreaForTest(
    actualPolygons,
    expectedPolygons
  )
  const maxAllowedArea = Math.max(0.75, expectedArea * 0.001)
  expect(
    symmetricDifferenceArea,
    JSON.stringify(
      {
        label,
        reason:
          'inside dashed visible geometry must equal center dashed stroke built at width * 2 and clipped to the inside legal fill domain',
        symmetricDifferenceArea,
        maxAllowedArea,
        actualArea,
        expectedArea,
        actualPolygonCount: actualPolygons.length,
        expectedPolygonCount: expectedPolygons.length
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(maxAllowedArea)
}

const expectInsideDashedSplitRangeIntervalAllocation = ({
  label,
  stroke,
  intervals
}: {
  label: string
  stroke: ReturnType<typeof createDefaultStroke>
  intervals: RuleDrivenDashInterval[]
}) => {
  const halfDashLength = stroke.dashPattern[0] / 2
  const intervalsBySplitRange = new Map<
    string,
    {
      startDistance: number
      endDistance: number
      splitRangeStartDistance: number
      splitRangeEndDistance: number
      terminalRole?: string
      boundaryTotalLength?: number
      intervalIndex: number
    }[]
  >()
  intervals.forEach((interval) => {
    if (
      !interval.figmaLikeSplitRangeId ||
      interval.figmaLikeSplitRangeStartDistance === undefined ||
      interval.figmaLikeSplitRangeEndDistance === undefined
    ) {
      return
    }

    intervalsBySplitRange.set(interval.figmaLikeSplitRangeId, [
      ...(intervalsBySplitRange.get(interval.figmaLikeSplitRangeId) ?? []),
      {
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        splitRangeStartDistance: interval.figmaLikeSplitRangeStartDistance,
        splitRangeEndDistance: interval.figmaLikeSplitRangeEndDistance,
        terminalRole: interval.figmaLikeTerminalRole,
        boundaryTotalLength: interval.figmaLikeBoundaryTotalLength,
        intervalIndex: interval.index
      }
    ])
  })

  const failures = [...intervalsBySplitRange.entries()].flatMap(
    ([splitRangeId, splitRangeIntervals]) => {
      const sorted = splitRangeIntervals
        .slice()
        .sort((left, right) => left.startDistance - right.startDistance)
      const splitRangeStartDistance =
        sorted[0]?.splitRangeStartDistance ?? sorted[0]?.startDistance ?? 0
      const splitRangeEndDistance =
        sorted[0]?.splitRangeEndDistance ??
        sorted[sorted.length - 1]?.endDistance ??
        0
      const splitRangeLength = splitRangeEndDistance - splitRangeStartDistance
      const dashLength = stroke.dashPattern[0]
      const targetGapLength = stroke.dashPattern[1] ?? dashLength
      const capExtension = stroke.capType === 'butt' ? 0 : stroke.width
      const minimumVisualGapLength =
        capExtension > 0 ? Math.max(0, targetGapLength * 0.6) : 0
      const minimumCenterlineGapLength =
        capExtension > 0 ? minimumVisualGapLength + capExtension * 2 : 0
      const allowsCollapsedCapAwareRange =
        capExtension > 0 &&
        sorted.length === 1 &&
        sorted[0]?.terminalRole === 'start-end' &&
        splitRangeLength <= dashLength + minimumCenterlineGapLength + 1e-3
      const hasStartTerminal = sorted.some(
        (interval) =>
          interval.terminalRole === 'start' ||
          interval.terminalRole === 'start-end'
      )
      const hasEndTerminal = sorted.some(
        (interval) =>
          interval.terminalRole === 'end' ||
          interval.terminalRole === 'start-end'
      )
      const startTerminal = sorted.find(
        (interval) =>
          interval.terminalRole === 'start' ||
          interval.terminalRole === 'start-end'
      )
      const endTerminal = [...sorted]
        .reverse()
        .find(
          (interval) =>
            interval.terminalRole === 'end' ||
            interval.terminalRole === 'start-end'
        )
      const ordinaryGapFailures = sorted
        .slice(0, -1)
        .flatMap((interval, index) =>
          (() => {
            const centerlineGap =
              sorted[index + 1].startDistance - interval.endDistance
            const visualGap = centerlineGap - capExtension * 2
            if (centerlineGap <= 1e-4) {
              return [
                {
                  reason: 'missing-positive-gap',
                  previousIntervalIndex: interval.intervalIndex,
                  nextIntervalIndex: sorted[index + 1].intervalIndex,
                  gapStart: interval.endDistance,
                  gapEnd: sorted[index + 1].startDistance
                }
              ]
            }
            if (capExtension > 0 && visualGap < minimumVisualGapLength - 1e-4) {
              return [
                {
                  reason: 'visual-gap-over-compressed-by-cap',
                  previousIntervalIndex: interval.intervalIndex,
                  nextIntervalIndex: sorted[index + 1].intervalIndex,
                  centerlineGap,
                  visualGap,
                  minimumVisualGapLength
                }
              ]
            }
            return []
          })()
        )
      const terminalFailures = [
        !allowsCollapsedCapAwareRange && !hasStartTerminal
          ? { reason: 'missing-start-half-dash-terminal' }
          : undefined,
        !allowsCollapsedCapAwareRange && !hasEndTerminal
          ? { reason: 'missing-end-half-dash-terminal' }
          : undefined,
        allowsCollapsedCapAwareRange
          ? undefined
          : startTerminal &&
              splitRangeLength >= halfDashLength * 2 &&
              Math.abs(startTerminal.startDistance - splitRangeStartDistance) >
                1e-3
            ? {
                reason: 'start-terminal-not-at-split-range-start',
                expectedStartDistance: splitRangeStartDistance,
                startDistance: startTerminal.startDistance
              }
            : undefined,
        allowsCollapsedCapAwareRange
          ? undefined
          : startTerminal &&
              splitRangeLength >= halfDashLength * 2 &&
              Math.abs(
                startTerminal.endDistance -
                  (splitRangeStartDistance + halfDashLength)
              ) > 1e-3
            ? {
                reason: 'start-terminal-not-half-dash',
                expectedEndDistance: splitRangeStartDistance + halfDashLength,
                endDistance: startTerminal.endDistance
              }
            : undefined,
        allowsCollapsedCapAwareRange
          ? undefined
          : endTerminal &&
              splitRangeLength >= halfDashLength * 2 &&
              Math.abs(endTerminal.endDistance - splitRangeEndDistance) > 1e-3
            ? {
                reason: 'end-terminal-not-at-split-range-end',
                expectedEndDistance: splitRangeEndDistance,
                endDistance: endTerminal.endDistance
              }
            : undefined,
        allowsCollapsedCapAwareRange
          ? undefined
          : endTerminal &&
              splitRangeLength >= halfDashLength * 2 &&
              Math.abs(
                endTerminal.endDistance -
                  endTerminal.startDistance -
                  halfDashLength
              ) > 1e-3
            ? {
                reason: 'end-terminal-not-half-dash',
                expectedLength: halfDashLength,
                length: endTerminal.endDistance - endTerminal.startDistance
              }
            : undefined
      ].filter(
        (failure): failure is { reason: string } => failure !== undefined
      )

      return [...terminalFailures, ...ordinaryGapFailures].map((failure) => ({
        splitRangeId,
        splitRangeStartDistance,
        splitRangeEndDistance,
        splitRangeLength,
        packetCount: sorted.length,
        ...failure
      }))
    }
  )

  expect(
    failures.slice(0, 30),
    JSON.stringify(
      {
        label,
        reason:
          'split-range dash allocation must keep half-dash terminals when visual gaps can remain legible, collapse short cap-aware ranges, and avoid cap-compressed gaps between dash groups',
        failureCount: failures.length,
        firstFailures: failures.slice(0, 30)
      },
      null,
      2
    )
  ).toEqual([])
}

const expectInsideDashedSplitRangeRuleParity = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  packets,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
}) => {
  const eventMap = buildStrokeEventMap(
    sourcePath,
    stroke,
    fillRegions,
    domainOptions
  )
  const visibleIntervalCount = eventMap.dashIntervals.filter(
    (interval) => interval.length > 1e-6
  ).length
  const packetIntervalIds = new Set(
    packets
      .map((packet) => packet.geometry.debugMeta?.intervalId)
      .filter((intervalId): intervalId is string => intervalId !== undefined)
  )
  expect(
    {
      packetCount: packets.length,
      packetIntervalIdCount: packetIntervalIds.size,
      visibleIntervalCount
    },
    `${label}:inside-doubled-center-packet-interval-coverage`
  ).toMatchObject({
    packetCount: visibleIntervalCount,
    packetIntervalIdCount: visibleIntervalCount,
    visibleIntervalCount
  })
  expectInsideDashedProductFinalPacketOwnership(packets)
  expectInsideDashedSplitRangeIntervalAllocation({
    label,
    stroke,
    intervals: eventMap.dashIntervals
  })
  expectInsideDashedPolygonsPreserveSplitRangeRule({
    label,
    sourcePath,
    stroke,
    fillRegions,
    actualPolygons: getPacketPolygonsForTest(packets),
    domainOptions
  })
}

const expectInsideDashedSplitRangeGapPreservedByStage = ({
  label,
  sourcePath,
  intervals,
  stroke,
  fillRegions,
  getPolygonsForSplitRange
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  intervals: RuleDrivenDashInterval[]
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  getPolygonsForSplitRange: (
    splitRangeId: string
  ) => { x: number; y: number }[][]
}) => {
  const failures = getRuleDrivenSplitRangeGapCoverageFailures({
    sourcePath,
    intervals,
    getPolygonsForSplitRange,
    stroke,
    implicitFillRegions: fillRegions,
    contextLabel: label,
    coverageTolerance: 0.35
  })
  expect(
    failures.slice(0, 30),
    JSON.stringify(
      {
        message:
          'split-range dash gaps are first-class product geometry; each split source range must keep half-dash terminals and empty gaps between visible intervals',
        failureCount: failures.length,
        firstFailures: failures.slice(0, 30)
      },
      null,
      2
    )
  ).toEqual([])
}

const expectInsideDashedSplitRangeGapPreserved = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  packets,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
}) => {
  const eventMap = buildStrokeEventMap(
    sourcePath,
    stroke,
    fillRegions,
    domainOptions
  )
  expectInsideDashedSplitRangeGapPreservedByStage({
    label,
    sourcePath,
    intervals: eventMap.dashIntervals,
    stroke,
    fillRegions,
    getPolygonsForSplitRange: (splitRangeId) =>
      packets.flatMap((packet) =>
        packet.geometry.debugMeta?.figmaLikeSplitRangeId === splitRangeId
          ? packet.geometry.polygons
          : []
      )
  })
}

const expectInsideDashedSplitRangeStagesPreserveRule = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  stages,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  domainOptions?: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  }
  stages: {
    label: string
    polygons: { x: number; y: number }[][]
  }[]
}) => {
  stages.forEach((stage) => {
    expectInsideDashedPolygonsPreserveSplitRangeRule({
      label: `${label}:${stage.label}`,
      sourcePath,
      stroke,
      fillRegions,
      actualPolygons: stage.polygons,
      domainOptions
    })
    if (
      stage.label === 'collapsed-faces' ||
      stage.label === 'export-packets' ||
      stage.label === 'render-entries'
    ) {
      expectInsideDashedNoSamePaintOverdraw({
        label: `${label}:${stage.label}`,
        stroke,
        actualPolygons: stage.polygons
      })
    }
  })
}

const signedPolygonArea = (points: { x: number; y: number }[]) => {
  let area = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    area += point.x * next.y - next.x * point.y
  })
  return area / 2
}

const getPolygonOverlapAreaForTest = (
  left: { x: number; y: number }[],
  right: { x: number; y: number }[]
) => {
  if (left.length < 3 || right.length < 3) {
    return 0
  }

  const leftBounds = getPointBounds(left)
  const rightBounds = getPointBounds(right)
  if (
    leftBounds.maxX <= rightBounds.minX ||
    rightBounds.maxX <= leftBounds.minX ||
    leftBounds.maxY <= rightBounds.minY ||
    rightBounds.maxY <= leftBounds.minY
  ) {
    return 0
  }

  return getCoveragePolygonsForTest(
    getGeometryBackend().intersection(
      [{ polygons: [left] }],
      [{ polygons: [right] }],
      'nonzero'
    )
  ).reduce((area, polygon) => area + Math.abs(signedPolygonArea(polygon)), 0)
}

const getRenderPolygonOverlapFailuresForTest = (
  polygons: { x: number; y: number }[][],
  minArea = 0.05
) => {
  const failures: {
    leftIndex: number
    rightIndex: number
    area: number
    leftBounds: ReturnType<typeof getPointBounds>
    rightBounds: ReturnType<typeof getPointBounds>
  }[] = []

  polygons.forEach((left, leftIndex) => {
    polygons.slice(leftIndex + 1).forEach((right, offsetIndex) => {
      const rightIndex = leftIndex + 1 + offsetIndex
      const area = getPolygonOverlapAreaForTest(left, right)
      if (area > minArea) {
        failures.push({
          leftIndex,
          rightIndex,
          area: Math.round(area * 1000) / 1000,
          leftBounds: getPointBounds(left),
          rightBounds: getPointBounds(right)
        })
      }
    })
  })

  return failures
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

type RuleDrivenDashInterval = StrokeEventMap['dashIntervals'][number] & {
  figmaLikeSplitRangeId?: string
  figmaLikeSelectedSide?: 1 | -1
  figmaLikeBoundaryRole?: string
  figmaLikeBoundaryPoints?: { x: number; y: number }[]
  figmaLikeBoundaryTotalLength?: number
  figmaLikeBoundaryStartDistance?: number
  figmaLikeBoundaryEndDistance?: number
  figmaLikeSplitRangeId?: string
  figmaLikeSplitRangeStartDistance?: number
  figmaLikeSplitRangeEndDistance?: number
  figmaLikeTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
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
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  domainOptions: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  } = {}
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
      implicitFillRegions,
      sharedSourceSplitRanges: domainOptions.sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains: domainOptions.sharedStrokeBoundaryDomains
    })
  ).map((interval) => ({
    index: Number(interval.intervalId.replace('interval:', '')),
    startDistance: interval.startDistance,
    endDistance: interval.endDistance,
    wrapsSeam: interval.wrapsSeam,
    length: interval.intervalLength,
    figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
    figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
    figmaLikeBoundaryPoints: interval.figmaLikeBoundaryPoints,
    figmaLikeBoundaryTotalLength: interval.figmaLikeBoundaryTotalLength,
    figmaLikeBoundaryStartDistance: interval.figmaLikeBoundaryStartDistance,
    figmaLikeBoundaryEndDistance: interval.figmaLikeBoundaryEndDistance,
    figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
    figmaLikeSplitRangeStartDistance: interval.figmaLikeSplitRangeStartDistance,
    figmaLikeSplitRangeEndDistance: interval.figmaLikeSplitRangeEndDistance,
    figmaLikeTerminalRole: interval.figmaLikeTerminalRole
  }))
}

const buildStrokeEventMap = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  stroke: ReturnType<typeof createDefaultStroke>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  domainOptions: {
    sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
    sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  } = {}
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
    implicitFillRegions,
    domainOptions
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

interface RuleDrivenIntervalGeometryRecord {
  intervalIds: string[]
  polygons: { x: number; y: number }[][]
}

const getRuleDrivenIntervalGeometryPolygons = (
  records: RuleDrivenIntervalGeometryRecord[] | undefined,
  intervalIndex: number
) => {
  if (!records) {
    return []
  }

  const intervalId = `interval:${intervalIndex}`
  return records.flatMap((record) =>
    record.intervalIds.includes(intervalId) ? record.polygons : []
  )
}

const toPacketIntervalGeometryRecords = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
): RuleDrivenIntervalGeometryRecord[] =>
  packets.map((packet) => ({
    intervalIds: packet.geometry.debugMeta?.intervalId
      ? [packet.geometry.debugMeta.intervalId]
      : [],
    polygons: packet.geometry.polygons
  }))

const toFinalFaceIntervalGeometryRecords = (
  faces: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>
): RuleDrivenIntervalGeometryRecord[] =>
  faces.map((face) => ({
    intervalIds:
      face.debugMeta?.intervalIds ??
      (face.debugMeta?.intervalId ? [face.debugMeta.intervalId] : []),
    polygons: face.polygons
  }))

const hasRuleDrivenIntervalMetadataGeometryCoverage = ({
  records,
  interval,
  sourcePath,
  stroke,
  implicitFillRegions
}: {
  records: RuleDrivenIntervalGeometryRecord[] | undefined
  interval: RuleDrivenDashInterval
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  implicitFillRegions: PolygonRegion[]
}) => {
  const intervalPolygons = getRuleDrivenIntervalGeometryPolygons(
    records,
    interval.index
  )
  const intervalArea = intervalPolygons.reduce(
    (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
    0
  )
  if (intervalArea <= Math.max(0.05, stroke.width * stroke.width * 0.0025)) {
    return false
  }

  const legalBoundaryTolerance = Math.max(1, stroke.width * 0.5)
  const illegalSamples = intervalPolygons.flatMap((polygon) =>
    [
      ...polygon,
      ...samplePolygonEdges(polygon, Math.max(1, stroke.width * 0.5))
    ].filter((point) =>
      stroke.position === 'inside'
        ? !isPointInsideResolvedLegalDomainForTest(
            point,
            sourcePath,
            legalBoundaryTolerance,
            implicitFillRegions
          )
        : isPointInsideResolvedLegalDomainForTest(
            point,
            sourcePath,
            legalBoundaryTolerance,
            implicitFillRegions
          )
    )
  )
  return illegalSamples.length === 0
}

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
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  selectedSide?: 1 | -1
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
    Math.max(0.05, stroke.width * 0.01),
    Math.max(0.1, stroke.width * 0.025),
    Math.max(0.5, stroke.width * 0.1),
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
  const resolvedSide =
    selectedSide === undefined && segmentRange
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
    selectedSide ??
    (resolvedSide?.status === 'resolved' ? resolvedSide.selectedSide : 1)
  return offsets
    .map((offset) => ({
      distance,
      point: {
        x: sourcePoint.x - tangent.y * offset * side,
        y: sourcePoint.y + tangent.x * offset * side
      },
      localInsideSide: side
    }))
    .filter((probe) => {
      if (implicitFillRegions.length === 0) {
        return true
      }

      const insideLegalDomain = isPointInsidePolygonRegionsForTest(
        probe.point,
        implicitFillRegions,
        1
      )
      return stroke.position === 'inside'
        ? insideLegalDomain
        : !insideLegalDomain
    })
}

const getRuleDrivenIntervalProbeDistances = (
  interval: RuleDrivenDashInterval,
  totalLength: number
) => {
  const startDistance =
    interval.figmaLikeSplitRangeStartDistance ?? interval.startDistance
  const endDistance =
    interval.figmaLikeSplitRangeEndDistance ?? interval.endDistance
  const intervalLength = Math.max(0, endDistance - startDistance)
  return [0.15, 0.35, 0.5, 0.65, 0.85].map((factor) =>
    normalizeLoopDistanceForTest(
      startDistance + intervalLength * factor,
      totalLength
    )
  )
}

const getRuleDrivenIntervalLocalStartDistance = (
  interval: RuleDrivenDashInterval
) => interval.figmaLikeSplitRangeStartDistance ?? interval.startDistance

const getRuleDrivenIntervalLocalEndDistance = (
  interval: RuleDrivenDashInterval
) => interval.figmaLikeSplitRangeEndDistance ?? interval.endDistance

const getRuleDrivenIntervalSelectedSide = (interval: {
  figmaLikeSelectedSide?: number
}) =>
  interval.figmaLikeSelectedSide === 1 || interval.figmaLikeSelectedSide === -1
    ? interval.figmaLikeSelectedSide
    : undefined

const getRuleDrivenPathForInterval = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  interval: RuleDrivenDashInterval
) =>
  interval.figmaLikeBoundaryPoints &&
  interval.figmaLikeBoundaryPoints.length > 1
    ? buildPolylineGeometryModelPath(interval.figmaLikeBoundaryPoints, false)
    : sourcePath

const requiresRuleDrivenIntervalProductCoverage = (
  _stroke: ReturnType<typeof createDefaultStroke>,
  _interval: { figmaLikeBoundaryRole?: string }
) => true

const hasRuleDrivenIntervalSpatialCoverage = ({
  sourcePath,
  interval,
  polygons,
  tolerance,
  stroke,
  implicitFillRegions
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: RuleDrivenDashInterval
  polygons: { x: number; y: number }[][]
  tolerance: number
  stroke?: ReturnType<typeof createDefaultStroke>
  implicitFillRegions?: PolygonRegion[]
}) => {
  const probePath = getRuleDrivenPathForInterval(sourcePath, interval)
  const coverage = getRuleDrivenIntervalSpatialCoverageDetails({
    sourcePath: probePath,
    interval,
    polygons,
    tolerance,
    stroke,
    implicitFillRegions
  })
  if (coverage.probePoints.length === 0) {
    return true
  }

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
  interval: RuleDrivenDashInterval
  polygons: { x: number; y: number }[][]
  tolerance: number
  stroke?: ReturnType<typeof createDefaultStroke>
  implicitFillRegions?: PolygonRegion[]
}) => {
  const probePath = getRuleDrivenPathForInterval(sourcePath, interval)
  const probeGroups = getRuleDrivenIntervalProbeDistances(
    interval,
    probePath.totalLength
  )
    .map((distance) =>
      getRuleDrivenCoverageProbeCandidatesAtDistance(
        probePath,
        distance,
        stroke,
        implicitFillRegions,
        getRuleDrivenIntervalSelectedSide(interval)
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

const getRuleDrivenSplitRangeGapCoverageFailures = ({
  sourcePath,
  intervals,
  getPolygonsForSplitRange,
  stroke,
  implicitFillRegions,
  contextLabel,
  coverageTolerance = 0.75
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  intervals: RuleDrivenDashInterval[]
  getPolygonsForSplitRange: (
    splitRangeId: string
  ) => { x: number; y: number }[][]
  stroke: ReturnType<typeof createDefaultStroke>
  implicitFillRegions: PolygonRegion[]
  contextLabel: string
  coverageTolerance?: number
}) => {
  const intervalsBySplitRange = new Map<string, RuleDrivenDashInterval[]>()
  intervals.forEach((interval) => {
    if (
      !interval.figmaLikeSplitRangeId ||
      interval.figmaLikeBoundaryPoints === undefined ||
      interval.figmaLikeBoundaryPoints.length < 2 ||
      interval.figmaLikeBoundaryStartDistance === undefined ||
      interval.figmaLikeBoundaryEndDistance === undefined
    ) {
      return
    }

    intervalsBySplitRange.set(interval.figmaLikeSplitRangeId, [
      ...(intervalsBySplitRange.get(interval.figmaLikeSplitRangeId) ?? []),
      interval
    ])
  })

  return [...intervalsBySplitRange.entries()].flatMap(
    ([splitRangeId, splitRangeIntervals]) => {
      const sortedIntervals = splitRangeIntervals
        .slice()
        .sort(
          (left, right) =>
            getRuleDrivenIntervalLocalStartDistance(left) -
            getRuleDrivenIntervalLocalStartDistance(right)
        )

      return sortedIntervals.slice(0, -1).flatMap((interval, index) => {
        const nextInterval = sortedIntervals[index + 1]
        const gapStart = getRuleDrivenIntervalLocalEndDistance(interval)
        const gapEnd = getRuleDrivenIntervalLocalStartDistance(nextInterval)
        const gapLength = gapEnd - gapStart
        if (gapLength < Math.max(2, stroke.width * 1.75)) {
          return []
        }

        const boundaryPoints = interval.figmaLikeBoundaryPoints ?? []
        const boundaryPath = buildPolylineGeometryModelPath(
          boundaryPoints,
          false
        )
        const selectedSide = getRuleDrivenIntervalSelectedSide(interval)
        const splitRangePolygons = getPolygonsForSplitRange(splitRangeId)
        const probeDistances = [0.35, 0.5, 0.65].map(
          (factor) => gapStart + gapLength * factor
        )
        const coveredProbes = probeDistances.flatMap((distance) =>
          getRuleDrivenCoverageProbeCandidatesAtDistance(
            boundaryPath,
            distance,
            stroke,
            implicitFillRegions,
            selectedSide
          ).flatMap((probe) =>
            isPointCoveredByPolygons(
              probe.point,
              splitRangePolygons,
              coverageTolerance
            )
              ? [
                  {
                    distance,
                    point: probe.point,
                    side: probe.localInsideSide
                  }
                ]
              : []
          )
        )

        return coveredProbes.length === 0
          ? []
          : [
              {
                contextLabel,
                splitRangeId,
                previousIntervalIndex: interval.index,
                nextIntervalIndex: nextInterval.index,
                gapStart: Math.round(gapStart * 100) / 100,
                gapEnd: Math.round(gapEnd * 100) / 100,
                gapLength: Math.round(gapLength * 100) / 100,
                selectedSide,
                boundaryRole: interval.figmaLikeBoundaryRole,
                coveredProbeCount: coveredProbes.length,
                firstCoveredProbe: {
                  distance: Math.round(coveredProbes[0].distance * 100) / 100,
                  point: {
                    x: Math.round(coveredProbes[0].point.x * 100) / 100,
                    y: Math.round(coveredProbes[0].point.y * 100) / 100
                  },
                  side: coveredProbes[0].side
                }
              }
            ]
      })
    }
  )
}

const getRuleDrivenBoundaryHugFailures = ({
  sourcePath,
  intervals,
  polygons,
  stroke,
  contextLabel,
  boundaryTolerance = 1.25
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  intervals: RuleDrivenDashInterval[]
  polygons: { x: number; y: number }[][]
  stroke: ReturnType<typeof createDefaultStroke>
  contextLabel: string
  boundaryTolerance?: number
}) =>
  intervals.flatMap((interval) => {
    if (
      !interval.figmaLikeSplitRangeId ||
      !interval.figmaLikeBoundaryPoints ||
      interval.figmaLikeBoundaryPoints.length < 2 ||
      interval.figmaLikeBoundaryStartDistance === undefined ||
      interval.figmaLikeBoundaryEndDistance === undefined
    ) {
      return []
    }

    const localStartDistance = getRuleDrivenIntervalLocalStartDistance(interval)
    const localEndDistance = getRuleDrivenIntervalLocalEndDistance(interval)
    const visibleLength = localEndDistance - localStartDistance
    if (visibleLength <= stroke.width * 2.5) {
      return []
    }

    const trim = Math.min(stroke.width, visibleLength * 0.25)
    const sampleDistances = [0.28, 0.5, 0.72]
      .map((factor) => localStartDistance + visibleLength * factor)
      .filter(
        (distance) =>
          distance >= localStartDistance + trim &&
          distance <= localEndDistance - trim
      )
    if (sampleDistances.length === 0) {
      return []
    }

    const boundaryPath = buildPolylineGeometryModelPath(
      interval.figmaLikeBoundaryPoints,
      false
    )
    return sampleDistances.flatMap((distance) => {
      const point = getRuleDrivenSourcePointAtDistance(boundaryPath, distance)
      if (!point) {
        return []
      }

      const boundaryDistance = getPointToPolygonsBoundaryDistance(
        point,
        polygons
      )
      return boundaryDistance <= boundaryTolerance
        ? []
        : [
            {
              contextLabel,
              intervalIndex: interval.index,
              splitRangeId: interval.figmaLikeSplitRangeId,
              boundaryRole: interval.figmaLikeBoundaryRole,
              selectedSide: interval.figmaLikeSelectedSide,
              distance: Math.round(distance * 100) / 100,
              boundaryDistance: Math.round(boundaryDistance * 100) / 100,
              point: {
                x: Math.round(point.x * 100) / 100,
                y: Math.round(point.y * 100) / 100
              }
            }
          ]
    })
  })

const getCoveredProbeSidesAtInterval = ({
  sourcePath,
  interval,
  polygons,
  stroke,
  tolerance
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: RuleDrivenDashInterval
  polygons: { x: number; y: number }[][]
  stroke: ReturnType<typeof createDefaultStroke>
  tolerance: number
}) => {
  const probePath = getRuleDrivenPathForInterval(sourcePath, interval)
  const distances = getRuleDrivenIntervalProbeDistances(
    interval,
    probePath.totalLength
  )
  const offsets = [
    Math.max(1, stroke.width * 0.25),
    Math.max(1, stroke.width * 0.5),
    Math.max(1, stroke.width * 0.75)
  ]

  return distances.flatMap((distance) => {
    const sourcePoint = getRuleDrivenSourcePointAtDistance(probePath, distance)
    const tangent = getRuleDrivenTangentAtDistance(probePath, distance)
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
  intervalGeometryRecords,
  contextLabel,
  coverageTolerance = 1,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  polygons: { x: number; y: number }[][]
  intervalGeometryRecords?: RuleDrivenIntervalGeometryRecord[]
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
          const sharedStrokeBoundaryDomains =
            resolvedGeometry.networks[0]?.selfIntersecting
              ?.strokeBoundaryDomains ?? []
          const strokeDomainPlan = resolveStrokeDomains({
            topology,
            sourceFamily: resolveSourceFamily({
              topology,
              stroke: renderableStroke
            }),
            stroke: renderableStroke,
            sourcePath,
            implicitFillRegions,
            sharedSourceSplitRanges,
            sharedStrokeBoundaryDomains
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
            length: interval.intervalLength,
            wrapsSeam: interval.wrapsSeam,
            crossingBoundaryCount: interval.crossingBoundaryCount,
            squareEffectiveCrossingBoundaryCount:
              interval.squareEffectiveCrossingBoundaryCount,
            figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
            figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
            figmaLikeBoundaryPoints: interval.figmaLikeBoundaryPoints,
            figmaLikeBoundaryTotalLength: interval.figmaLikeBoundaryTotalLength,
            figmaLikeBoundaryStartDistance:
              interval.figmaLikeBoundaryStartDistance,
            figmaLikeBoundaryEndDistance: interval.figmaLikeBoundaryEndDistance,
            figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
            figmaLikeSplitRangeStartDistance:
              interval.figmaLikeSplitRangeStartDistance,
            figmaLikeSplitRangeEndDistance:
              interval.figmaLikeSplitRangeEndDistance,
            figmaLikeTerminalRole: interval.figmaLikeTerminalRole
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
  ).filter(
    (interval) =>
      interval.length >= Math.max(4, stroke.width * 0.75) &&
      requiresRuleDrivenIntervalProductCoverage(stroke, interval)
  )

  return visibleIntervals.flatMap((interval) =>
    hasRuleDrivenIntervalSpatialCoverage({
      sourcePath,
      interval,
      polygons,
      tolerance: coverageTolerance,
      stroke,
      implicitFillRegions
    }) ||
    hasRuleDrivenIntervalMetadataGeometryCoverage({
      records: intervalGeometryRecords,
      interval,
      sourcePath,
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
              figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
              figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
              figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
              metadataGeometryArea:
                Math.round(
                  getRuleDrivenIntervalGeometryPolygons(
                    intervalGeometryRecords,
                    interval.index
                  ).reduce(
                    (sum, polygon) =>
                      sum + Math.abs(signedPolygonArea(polygon)),
                    0
                  ) * 100
                ) / 100,
              coveredProbeCount: coverage.coveredProbeCount,
              coverageProbes: coverage.probePoints.map((probe) => ({
                distance: Math.round(probe.distance * 100) / 100,
                point: {
                  x: Math.round(probe.point.x * 100) / 100,
                  y: Math.round(probe.point.y * 100) / 100
                },
                localInsideSide: probe.localInsideSide,
                covered: isPointCoveredByPolygons(
                  probe.point,
                  polygons,
                  coverageTolerance
                )
              })),
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
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  edgeSampleStep = 0.75,
  exhaustiveInsideLegalSamples = true,
  highRiskBoundaryLegalSamples = true,
  contextLabel
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  position: 'inside' | 'outside'
  topologyPoints?: { x: number; y: number }[]
  guardPoints?: { x: number; y: number; sharp?: boolean }[]
  implicitFillRegions?: PolygonRegion[]
  edgeSampleStep?: number
  exhaustiveInsideLegalSamples?: boolean
  highRiskBoundaryLegalSamples?: boolean
  contextLabel?: string
}) => {
  const eventMap = buildStrokeEventMap(sourcePath, stroke)
  expect(
    packets.length,
    `${position}:${stroke.capType}:${stroke.dashPattern.join('/')}`
  ).toBeGreaterThan(0)
  expect(getPacketAreaSum(packets)).toBeGreaterThan(1)
  const legalBoundaryTolerance = Math.max(2, stroke.width * 0.75)

  if (position === 'inside') {
    const packetPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const outsideResidueArea = getInsideLegalResidueArea(
      packetPolygons,
      sourcePath,
      implicitFillRegions
    )
    expect(
      outsideResidueArea,
      JSON.stringify(
        {
          message:
            'inside stroke packets must not retain measurable geometry outside the legal fill domain',
          contextLabel,
          position,
          capType: stroke.capType,
          outsideResidueArea: Math.round(outsideResidueArea * 1000) / 1000,
          packetCount: packets.length,
          polygonCount: packetPolygons.length,
          pointCount: packetPolygons.reduce(
            (count, polygon) => count + polygon.length,
            0
          ),
          firstPackets: packets.slice(0, 3).map((packet) => ({
            intervalId: packet.geometry.debugMeta?.intervalId,
            finalCoverageBuilderStatus:
              packet.geometry.debugMeta?.finalCoverageBuilderStatus,
            polygonCount: packet.geometry.polygons.length,
            pointCount: packet.geometry.polygons.reduce(
              (count, polygon) => count + polygon.length,
              0
            )
          }))
        },
        null,
        2
      )
    ).toBeLessThanOrEqual(stroke.width * stroke.width * 4.5)

    if (exhaustiveInsideLegalSamples) {
      const illegalSamples = packets.flatMap((packet) =>
        packet.geometry.polygons.flatMap((polygon) =>
          [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
            (point) =>
              !isPointInsideResolvedLegalDomainForTest(
                point,
                sourcePath,
                legalBoundaryTolerance,
                implicitFillRegions
              )
                ? [
                    {
                      intervalId: packet.geometry.debugMeta?.intervalId,
                      contextLabel,
                      position,
                      capType: stroke.capType,
                      point: {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                      },
                      distanceToLegalBoundary:
                        Math.round(
                          getPointLegalBoundaryDistanceForTest(
                            point,
                            sourcePath
                          ) * 100
                        ) / 100
                    }
                  ]
                : []
          )
        )
      )
      expect(illegalSamples).toEqual([])
    }

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
    if (position === 'inside' && highRiskBoundaryLegalSamples) {
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
              !isPointInsideResolvedLegalDomainForTest(
                point,
                sourcePath,
                legalBoundaryTolerance,
                implicitFillRegions
              )
                ? [
                    {
                      intervalId: packet.geometry.debugMeta?.intervalId,
                      contextLabel,
                      position,
                      capType: stroke.capType,
                      point: {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                      },
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
              !isPointInsideResolvedLegalDomainForTest(
                point,
                sourcePath,
                legalBoundaryTolerance,
                implicitFillRegions
              )
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
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  edgeSampleStep = 0.75,
  exhaustiveInsideLegalSamples = true,
  contextLabel
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  faces: {
    intervalIds: string[]
    polygons: { x: number; y: number }[][]
  }[]
  position: 'inside' | 'outside'
  implicitFillRegions?: PolygonRegion[]
  edgeSampleStep?: number
  exhaustiveInsideLegalSamples?: boolean
  contextLabel?: string
}) => {
  const eventMap = buildStrokeEventMap(sourcePath, stroke)
  expect(
    faces.length,
    `final-face:${position}:${stroke.capType}:${stroke.dashPattern.join('/')}:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)
  expect(getFinalFaceAreaSum(faces)).toBeGreaterThan(1)

  if (position === 'inside' && exhaustiveInsideLegalSamples) {
    const legalBoundaryTolerance = Math.max(2, stroke.width * 0.75)
    const illegalSamples = faces.flatMap((face) =>
      face.polygons.flatMap((polygon) =>
        [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
          (point) =>
            !isPointInsideResolvedLegalDomainForTest(
              point,
              sourcePath,
              legalBoundaryTolerance,
              implicitFillRegions
            )
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
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath),
  edgeSampleStep = 0.75,
  exhaustiveInsideLegalSamples = true
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  polygons: { x: number; y: number }[][]
  contextLabel?: string
  implicitFillRegions?: PolygonRegion[]
  edgeSampleStep?: number
  exhaustiveInsideLegalSamples?: boolean
}) => {
  expect(
    polygons.length,
    `product-polygons:${stroke.position}:${stroke.capType}:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)

  if (exhaustiveInsideLegalSamples) {
    const illegalSamples = polygons.flatMap((polygon) =>
      [...polygon, ...samplePolygonEdges(polygon, edgeSampleStep)].flatMap(
        (point) => {
          const maxExpectedDistanceFromSource = stroke.width * 2 + 0.5
          const tooFarFromSource =
            pointClosedPolylineDistance(point, sourcePath.sampledPoints) >
            maxExpectedDistanceFromSource
          const outsideInsideLegalDomain =
            stroke.position === 'inside' &&
            !isPointInsideResolvedLegalDomainForTest(
              point,
              sourcePath,
              Math.max(2, stroke.width * 0.75),
              implicitFillRegions
            )
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
  }

  const missingIntervals = getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
    sourcePath,
    stroke,
    polygons,
    contextLabel,
    coverageTolerance: 1,
    implicitFillRegions
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
      polygons: productEntries.flatMap((entry) => entry.polygons),
      intervalGeometryRecords: productEntries.map((entry) => ({
        intervalIds: entry.debugMeta?.intervalId
          ? [entry.debugMeta.intervalId]
          : [],
        polygons: entry.polygons
      }))
    }
  }

  const packets = buildConstrainedDashedStrokeResolvedPackets(
    `${cachePrefix}:final-product`,
    points,
    closed,
    [stroke],
    {
      ...options,
      constrainedDashedVisualMode: 'product-final'
    }
  )
  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  return {
    source: 'final-faces' as const,
    polygons: finalFaces.flatMap((face) => face.polygons),
    intervalGeometryRecords: toFinalFaceIntervalGeometryRecords(finalFaces)
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
  const sharedStrokeBoundaryDomains =
    resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ?? []
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
    sharedStrokeBoundaryDomains,
    guardPoints
  }
}

const buildSelfIntersectingMixedSegmentStarFixture = () => {
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
  const sharedStrokeBoundaryDomains =
    resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ?? []
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
    sharedStrokeBoundaryDomains,
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

describe('constrained dashed stroke packets: source-path split ranges', () => {
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
          (packet.geometry.debugMeta?.strokePosition === 'inside' ||
            packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
              true) &&
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
          (packet.geometry.debugMeta?.strokePosition === 'inside' ||
            packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
              true) &&
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

  it('should run: preserve inside dashed split-range allocation for square caps on self-intersecting source paths', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const stroke = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'square',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-inside-square-cap-expansion',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )

    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
            'product-final' &&
          packet.geometry.debugMeta?.strokePosition === 'inside'
      )
    ).toBe(true)
    expectInsideDashedSplitRangeRuleParity({
      label: 'self-intersecting-mixed-star:inside:square:split-range-rule',
      sourcePath,
      stroke,
      fillRegions,
      packets,
      domainOptions: {
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains
      }
    })
    void sharedSourceSplitRanges
    void sharedStrokeBoundaryDomains
    void guardPoints
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

    expect(packets.length).toBeGreaterThan(0)
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
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
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
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({
        topology,
        stroke
      }),
      stroke,
      sourcePath,
      implicitFillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      strokeDomainPlan
    )

    const firstSplitEnd =
      strokeDomainPlan.splitRangeDomains[0]?.boundaryTotalLength ?? 0
    const visibleOnFirstSplitRange = intervals.filter(
      (interval) =>
        interval.figmaLikeSplitRangeId ===
          strokeDomainPlan.splitRangeDomains[0]?.domainId &&
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
          interval.figmaLikeSplitRangeId ===
            strokeDomainPlan.splitRangeDomains[0]?.domainId &&
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

  it('should run: preserve inside dashed split-range allocation on self-intersecting bowtie paths', () => {
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
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
            'product-final' &&
          packet.geometry.debugMeta?.strokePosition === 'inside'
      )
    ).toBe(true)
    expectInsideDashedSplitRangeRuleParity({
      label: 'self-intersecting-bowtie:inside:butt:split-range-rule',
      sourcePath,
      stroke,
      fillRegions: implicitFillRegions,
      packets,
      domainOptions: {
        sharedSourceSplitRanges
      }
    })
    void sharedSourceSplitRanges
  })

  it('should run: preserve inside dashed split-range allocation through product stages on terminal split ranges', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildTerminalSplitRangeFixture()
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
      'terminal-split-range:inside-split-range-rule',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    const exportPackets = withStrokeDiagnosticsMode('full', () =>
      buildSolidCenterStrokeExportPacketsFromFinalFaces(collapsedFaces)
    )
    const renderEntries = withStrokeDiagnosticsMode('full', () =>
      toSolidCenterStrokeRenderEntriesFromFinalFaces(collapsedFaces, {
        exactBackend: getGeometryBackend()
      })
    )
    const stages = [
      {
        label: 'packets',
        polygons: packets.flatMap((packet) => packet.geometry.polygons)
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'export-packets',
        polygons: exportPackets.flatMap((packet) => packet.polygons)
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap((entry) => entry.polygons)
      }
    ]

    expectInsideDashedSplitRangeStagesPreserveRule({
      label: 'terminal-split-range:inside:butt',
      sourcePath,
      stroke,
      fillRegions,
      stages,
      domainOptions: {
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains
      }
    })
    stages.forEach((stage) =>
      expectInsideDashedPolygonsPreserveSplitRangeRule({
        label: `terminal-split-range:inside:butt:${stage.label}:split-range-rule`,
        sourcePath,
        stroke,
        fillRegions,
        actualPolygons: stage.polygons,
        domainOptions: {
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains
        }
      })
    )
  })

  it('should run: preserve inside dashed split-range allocation through product stages on mixed segment self-intersections', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()

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
    expect(packets.length).toBeGreaterThan(0)
    expectInsideDashedProductFinalPacketOwnership(packets)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
            'product-final' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.polygons.length >= 1 &&
          packet.geometry.polygons.every(
            (polygon) => Math.abs(signedPolygonArea(polygon)) > 1e-6
          )
      )
    ).toBe(true)

    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    ;[
      {
        label: 'packets',
        polygons: packets.flatMap((packet) => packet.geometry.polygons)
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap((entry) => entry.polygons)
      }
    ].forEach((stage) =>
      expectInsideDashedPolygonsPreserveSplitRangeRule({
        label: `self-intersecting-mixed-star:inside:butt:${stage.label}:split-range-rule`,
        sourcePath,
        stroke,
        fillRegions,
        actualPolygons: stage.polygons,
        domainOptions: {
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains
        }
      })
    )

    void guardPoints
    void sharedSourceSplitRanges
    void sharedStrokeBoundaryDomains
  })

  it('should run: preserve empty split-range gaps through packets, final faces, and render entries', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
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
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      sourcePath,
      strokeDomainPlan
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:inside:butt:gap-preservation',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    const stages = [
      {
        label: 'packets',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          packets.flatMap((packet) =>
            packet.geometry.debugMeta?.figmaLikeSplitRangeId === splitRangeId
              ? packet.geometry.polygons
              : []
          )
      },
      {
        label: 'final-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          finalFaces.flatMap((face) =>
            face.debugMeta?.figmaLikeSplitRangeId === splitRangeId
              ? face.polygons
              : []
          )
      },
      {
        label: 'collapsed-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          collapsedFaces.flatMap((face) =>
            face.debugMeta?.figmaLikeSplitRangeId === splitRangeId
              ? face.polygons
              : []
          )
      },
      {
        label: 'render-entries',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          renderEntries.flatMap((entry) =>
            entry.debugMeta?.figmaLikeSplitRangeId === splitRangeId
              ? entry.polygons
              : []
          )
      }
    ]

    const failures = stages.flatMap((stage) =>
      getRuleDrivenSplitRangeGapCoverageFailures({
        sourcePath,
        intervals,
        getPolygonsForSplitRange: stage.getPolygonsForSplitRange,
        stroke,
        implicitFillRegions: fillRegions,
        contextLabel: stage.label,
        coverageTolerance: 0.35
      })
    )

    expect(
      failures.slice(0, 30),
      JSON.stringify(
        {
          message:
            'split-range dash gaps are first-class product geometry; packets, FinalFace collapse, and render entries must not overpaint ordinary gaps between visible intervals',
          failureCount: failures.length,
          firstFailures: failures.slice(0, 30)
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('should run: preserve inside dashed split-range allocation through render projection on filled-face domains', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
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
      'self-intersecting-mixed-star:inside:round:boundary-hug',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    expectInsideDashedProductFinalPacketOwnership(packets)
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend()
    })
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    const stages = [
      {
        label: 'packets',
        polygons: packets.flatMap((packet) => packet.geometry.polygons)
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap((face) => face.polygons)
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap((entry) => entry.polygons)
      }
    ]

    stages.forEach((stage) =>
      expectInsideDashedPolygonsPreserveSplitRangeRule({
        label: `self-intersecting-mixed-star:inside:round:${stage.label}:split-range-rule`,
        sourcePath,
        stroke,
        fillRegions,
        actualPolygons: stage.polygons,
        domainOptions: {
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains
        }
      })
    )

    void sharedSourceSplitRanges
    void sharedStrokeBoundaryDomains
    void guardPoints
  })

  it('should run: enforce rule-driven self-intersecting source-path invariants across all cap types', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(
      sharedStrokeBoundaryDomains.some(
        (domain) => domain.boundaryRole === 'filled-face'
      )
    ).toBe(true)
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
        `self-intersecting-mixed-star:rule-driven:inside:${capType}`,
        topology.normalizedPoints,
        true,
        [stroke],
        {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains,
          selectedSideGuardPoints: guardPoints,
          clipInsideToFillDomain: true,
          constrainedDashedVisualMode: 'product-final'
        }
      )

      expect(
        packets.every(
          (packet) =>
            packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
        )
      ).toBe(true)

      expectInsideDashedProductFinalPacketOwnership(packets)
      expectInsideDashedSplitRangeIntervalAllocation({
        label: `self-intersecting-mixed-star:inside:${capType}:split-range-rule`,
        stroke,
        intervals: buildStrokeEventMap(sourcePath, stroke, fillRegions)
          .dashIntervals
      })
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
        backend: getGeometryBackend()
      })
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(collapsedFaces)
      const productVisual = getRuleDrivenProductVisualPolygons({
        cachePrefix: `self-intersecting-mixed-star:rule-driven:inside:${capType}:product`,
        points: topology.normalizedPoints,
        closed: true,
        stroke,
        options: {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains,
          selectedSideGuardPoints: guardPoints,
          clipInsideToFillDomain: true
        }
      })

      ;[
        {
          label: 'packets',
          polygons: packets.flatMap((packet) => packet.geometry.polygons)
        },
        {
          label: 'final-faces',
          polygons: finalFaces.flatMap((face) => face.polygons)
        },
        {
          label: 'collapsed-faces',
          polygons: collapsedFaces.flatMap((face) => face.polygons)
        },
        {
          label: 'render-entries',
          polygons: renderEntries.flatMap((entry) => entry.polygons)
        },
        {
          label: `product:${productVisual.source}`,
          polygons: productVisual.polygons
        }
      ].forEach((stage) =>
        expectInsideDashedPolygonsPreserveSplitRangeRule({
          label: `self-intersecting-mixed-star:inside:${capType}:${stage.label}:split-range-rule`,
          sourcePath,
          stroke,
          fillRegions,
          actualPolygons: stage.polygons,
          domainOptions: {
            sharedSourceSplitRanges,
            sharedStrokeBoundaryDomains
          }
        })
      )
    })
  })

  it('should run: use the first non-degenerate cubic tangent for outside dash geometry at a split-range start', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
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
          sharedStrokeBoundaryDomains,
          selectedSideGuardPoints: guardPoints,
          clipInsideToFillDomain: true,
          constrainedDashedVisualMode: 'product-final'
        }
      )
      const firstOutsidePacket = packets.find(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex ===
            3 &&
          (packet.geometry.debugMeta?.figmaLikeTerminalRole === 'start' ||
            packet.geometry.debugMeta?.figmaLikeTerminalRole === 'start-end') &&
          packet.geometry.debugMeta?.figmaLikeBoundaryRole === 'outer'
      )
      const sourceSegmentPackets = packets.filter(
        (packet) =>
          packet.geometry.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex ===
            3 && packet.geometry.debugMeta?.figmaLikeBoundaryRole === 'outer'
      )

      if (capType === 'square') {
        expect(
          sourceSegmentPackets.length,
          JSON.stringify(
            {
              capType,
              packets: packets.map((packet) => ({
                geometryId: packet.geometry.geometryId,
                intervalId: packet.geometry.debugMeta?.intervalId,
                terminalRole: packet.geometry.debugMeta?.figmaLikeTerminalRole,
                boundaryRole: packet.geometry.debugMeta?.figmaLikeBoundaryRole,
                splitRangeId: packet.geometry.debugMeta?.figmaLikeSplitRangeId,
                splitRangeSourceSegmentIndex:
                  packet.geometry.debugMeta
                    ?.figmaLikeSplitRangeSourceSegmentIndex,
                polygonCount: packet.geometry.polygons.length,
                finalCoverageBuilderStatus:
                  packet.geometry.debugMeta?.finalCoverageBuilderStatus
              }))
            },
            null,
            2
          )
        ).toBeGreaterThan(0)
      } else {
        expect(
          firstOutsidePacket,
          JSON.stringify(
            {
              capType,
              packets: packets.map((packet) => ({
                geometryId: packet.geometry.geometryId,
                intervalId: packet.geometry.debugMeta?.intervalId,
                terminalRole: packet.geometry.debugMeta?.figmaLikeTerminalRole,
                boundaryRole: packet.geometry.debugMeta?.figmaLikeBoundaryRole,
                splitRangeId: packet.geometry.debugMeta?.figmaLikeSplitRangeId,
                splitRangeSourceSegmentIndex:
                  packet.geometry.debugMeta
                    ?.figmaLikeSplitRangeSourceSegmentIndex,
                polygonCount: packet.geometry.polygons.length,
                finalCoverageBuilderStatus:
                  packet.geometry.debugMeta?.finalCoverageBuilderStatus
              }))
            },
            null,
            2
          )
        ).toBeDefined()
      }
      expect(
        (firstOutsidePacket ? [firstOutsidePacket] : sourceSegmentPackets).some(
          (packet) =>
            packet.geometry.polygons.some((polygon) =>
              polygon.some(
                (point) =>
                  Math.abs(point.x) <= 1e-4 &&
                  Math.abs(point.y - 25.668954151283657) <= 1e-4
              )
            )
        )
      ).toBe(false)
    })
  })
})
