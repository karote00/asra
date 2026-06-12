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
  slicePathGeometryPoints
} from '../components/stroke-render/path-geometry'
import { resolveSourcePathStrokeSide } from '../components/stroke-render/stroke-side-resolution'
import { buildConstrainedDashedDomainStrokePolygons } from '../components/stroke-render/constrained-dashed-domain-geometry'
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
      splitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
      terminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole
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

const toTestPolygonRegions = (polygons: { x: number; y: number }[][]) =>
  polygons.map((polygon) => ({ polygons: [polygon] }))

const getCoveragePolygonsForTest = (regions: PolygonRegion[]) =>
  regions.flatMap((region) => region.polygons)

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
  domainPlanSplitRangeId?: string
  domainPlanSelectedSide?: 1 | -1
  domainPlanBoundaryRole?: string
  domainPlanBoundaryPoints?: { x: number; y: number }[]
  domainPlanBoundaryTotalLength?: number
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
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
) =>
  [0.15, 0.35, 0.5, 0.65, 0.85].map((factor) =>
    normalizeLoopDistanceForTest(
      interval.startDistance + interval.length * factor,
      totalLength
    )
  )

const getRuleDrivenIntervalSelectedSide = (interval: {
  domainPlanSelectedSide?: number
}) =>
  interval.domainPlanSelectedSide === 1 ||
  interval.domainPlanSelectedSide === -1
    ? interval.domainPlanSelectedSide
    : undefined

const getRuleDrivenPathForInterval = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  interval: RuleDrivenDashInterval
) =>
  interval.domainPlanBoundaryPoints &&
  interval.domainPlanBoundaryPoints.length > 1
    ? buildPolylineGeometryModelPath(interval.domainPlanBoundaryPoints, false)
    : sourcePath

const requiresRuleDrivenIntervalProductCoverage = (
  stroke: ReturnType<typeof createDefaultStroke>,
  interval: { domainPlanBoundaryRole?: string }
) => {
  if (
    stroke.position === 'inside' &&
    interval.domainPlanBoundaryRole === 'outer'
  ) {
    return false
  }
  if (
    stroke.position === 'outside' &&
    interval.domainPlanBoundaryRole === 'filled-face'
  ) {
    return false
  }
  return true
}

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
      !interval.domainPlanSplitRangeId ||
      interval.domainPlanBoundaryPoints === undefined ||
      interval.domainPlanBoundaryPoints.length < 2 ||
      interval.domainPlanBoundaryStartDistance === undefined ||
      interval.domainPlanBoundaryEndDistance === undefined
    ) {
      return
    }

    intervalsBySplitRange.set(interval.domainPlanSplitRangeId, [
      ...(intervalsBySplitRange.get(interval.domainPlanSplitRangeId) ?? []),
      interval
    ])
  })

  return [...intervalsBySplitRange.entries()].flatMap(
    ([splitRangeId, splitRangeIntervals]) => {
      const sortedIntervals = splitRangeIntervals
        .slice()
        .sort((left, right) => left.startDistance - right.startDistance)

      return sortedIntervals.slice(0, -1).flatMap((interval, index) => {
        const nextInterval = sortedIntervals[index + 1]
        const gapStart = interval.endDistance
        const gapEnd = nextInterval.startDistance
        const gapLength = gapEnd - gapStart
        if (gapLength < Math.max(2, stroke.width * 1.75)) {
          return []
        }

        const boundaryPoints = interval.domainPlanBoundaryPoints ?? []
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
                boundaryRole: interval.domainPlanBoundaryRole,
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

const getTerminalFrameFromBoundaryPointsForTest = (
  boundaryPoints: readonly { x: number; y: number }[],
  edge: 'start' | 'end'
) => {
  if (boundaryPoints.length < 2) {
    return null
  }
  const point =
    edge === 'start'
      ? boundaryPoints[0]
      : boundaryPoints[boundaryPoints.length - 1]
  const neighbor =
    edge === 'start'
      ? boundaryPoints[1]
      : boundaryPoints[boundaryPoints.length - 2]
  const tangent =
    edge === 'start'
      ? normalizeVector({
          x: neighbor.x - point.x,
          y: neighbor.y - point.y
        })
      : normalizeVector({
          x: point.x - neighbor.x,
          y: point.y - neighbor.y
        })
  return tangent ? { point, tangent } : null
}

const getOutsideSquareTerminalEndpointOverhangFailures = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  tolerance = 0.5
) =>
  packets.flatMap((packet) => {
    const meta = packet.geometry.debugMeta
    if (
      meta?.strokePosition !== 'outside' ||
      meta.strokeCap !== 'square' ||
      meta.domainPlanSplitRangeId === undefined ||
      !meta.domainPlanBoundaryPoints ||
      meta.domainPlanBoundaryPoints.length < 2 ||
      (meta.domainPlanTerminalRole !== 'start' &&
        meta.domainPlanTerminalRole !== 'end' &&
        meta.domainPlanTerminalRole !== 'start-end')
    ) {
      return []
    }

    const terminalEdges: ('start' | 'end')[] = [
      ...(meta.domainPlanTerminalRole === 'start' ||
      meta.domainPlanTerminalRole === 'start-end'
        ? (['start'] as const)
        : []),
      ...(meta.domainPlanTerminalRole === 'end' ||
      meta.domainPlanTerminalRole === 'start-end'
        ? (['end'] as const)
        : [])
    ]

    return terminalEdges.flatMap((edge) => {
      const frame = getTerminalFrameFromBoundaryPointsForTest(
        meta.domainPlanBoundaryPoints ?? [],
        edge
      )
      if (!frame) {
        return []
      }

      const overhangingPoints = packet.geometry.polygons
        .flat()
        .flatMap((point) => {
          const projection =
            (point.x - frame.point.x) * frame.tangent.x +
            (point.y - frame.point.y) * frame.tangent.y
          const isOverhanging =
            edge === 'start' ? projection < -tolerance : projection > tolerance
          return isOverhanging
            ? [
                {
                  x: Math.round(point.x * 100) / 100,
                  y: Math.round(point.y * 100) / 100,
                  projection: Math.round(projection * 100) / 100
                }
              ]
            : []
        })

      return overhangingPoints.length === 0
        ? []
        : [
            {
              geometryId: packet.geometry.geometryId,
              intervalId: meta.intervalId,
              splitRangeId: meta.domainPlanSplitRangeId,
              terminalRole: meta.domainPlanTerminalRole,
              edge,
              overhangingPoints: overhangingPoints.slice(0, 4)
            }
          ]
    })
  })

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
      !interval.domainPlanSplitRangeId ||
      !interval.domainPlanBoundaryPoints ||
      interval.domainPlanBoundaryPoints.length < 2 ||
      interval.domainPlanBoundaryStartDistance === undefined ||
      interval.domainPlanBoundaryEndDistance === undefined
    ) {
      return []
    }

    const visibleLength = interval.endDistance - interval.startDistance
    if (visibleLength <= stroke.width * 2.5) {
      return []
    }

    const trim = Math.min(stroke.width, visibleLength * 0.25)
    const sampleDistances = [0.28, 0.5, 0.72]
      .map((factor) => interval.startDistance + visibleLength * factor)
      .filter(
        (distance) =>
          distance >= interval.startDistance + trim &&
          distance <= interval.endDistance - trim
      )
    if (sampleDistances.length === 0) {
      return []
    }

    const boundaryPath = buildPolylineGeometryModelPath(
      interval.domainPlanBoundaryPoints,
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
              splitRangeId: interval.domainPlanSplitRangeId,
              boundaryRole: interval.domainPlanBoundaryRole,
              selectedSide: interval.domainPlanSelectedSide,
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
            domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
            domainPlanSelectedSide: interval.domainPlanSelectedSide,
            domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
            domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints,
            domainPlanBoundaryStartDistance:
              interval.domainPlanBoundaryStartDistance,
            domainPlanBoundaryEndDistance:
              interval.domainPlanBoundaryEndDistance,
            domainPlanBoundaryTotalLength:
              interval.domainPlanBoundaryTotalLength
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
              domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
              domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
              domainPlanSelectedSide: interval.domainPlanSelectedSide,
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

const buildOpenSelfIntersectingPentagramFixture = () => {
  const points = [
    { x: 30, y: 80 },
    { x: 420, y: 190 },
    { x: 80, y: 340 },
    { x: 250, y: 0 },
    { x: 360, y: 370 }
  ]
  const sourcePath = buildPolylineGeometryModelPath(points, false)
  const topology = buildPathTopologyModel({
    pathId: 'open-self-intersecting-pentagram',
    networkId: 'open-self-intersecting-pentagram',
    points: sourcePath.sampledPoints,
    closed: false
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'open-self-intersecting-pentagram:resolved-geometry',
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
    sharedStrokeBoundaryDomains:
      resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ??
      [],
    guardPoints: points.map((point) => ({ ...point, sharp: true }))
  }
}

const buildOpenSelfIntersectingCurvedPentagramFixture = () => {
  const points = {
    'tp-36': {
      id: 'tp-36',
      kind: 'anchor',
      x: 672.1796903067977,
      y: -25.577192537243718,
      anchorType: 'sharp'
    },
    'tp-39': {
      id: 'tp-39',
      kind: 'anchor',
      x: 494.0219478943302,
      y: 383.5816904608811,
      anchorType: 'smooth'
    },
    'tp-36:in': {
      id: 'tp-36:in',
      kind: 'control',
      x: 672.1796903067977,
      y: -25.577192537243718,
      controlForId: 'tp-36',
      controlRole: 'in'
    },
    'tp-39:out': {
      id: 'tp-39:out',
      kind: 'control',
      x: 420.04119045186485,
      y: 382.0718790845042,
      controlForId: 'tp-39',
      controlRole: 'out'
    },
    'tp-39:in': {
      id: 'tp-39:in',
      kind: 'control',
      x: 568.0027053367955,
      y: 385.09150183725797,
      controlForId: 'tp-39',
      controlRole: 'in'
    },
    'tp-40': {
      id: 'tp-40',
      kind: 'anchor',
      x: 847.3178099665117,
      y: 155.6001726279776,
      anchorType: 'sharp'
    },
    'tp-41': {
      id: 'tp-41',
      kind: 'anchor',
      x: 486.47289101244587,
      y: 158.61979538073132,
      anchorType: 'sharp'
    },
    'tp-42': {
      id: 'tp-42',
      kind: 'anchor',
      x: 823.1608279444822,
      y: 344.32659467508313,
      anchorType: 'sharp'
    }
  } as const
  const segments = {
    'ts-55': {
      id: 'ts-55',
      startId: 'tp-39',
      endId: 'tp-36',
      outControlId: 'tp-39:out',
      inControlId: 'tp-36:in'
    },
    'ts-56': {
      id: 'ts-56',
      startId: 'tp-40',
      endId: 'tp-39',
      outControlId: null,
      inControlId: 'tp-39:in'
    },
    'ts-57': {
      id: 'ts-57',
      startId: 'tp-41',
      endId: 'tp-40',
      outControlId: null,
      inControlId: null
    },
    'ts-58': {
      id: 'ts-58',
      startId: 'tp-42',
      endId: 'tp-41',
      outControlId: null,
      inControlId: null
    }
  } as const
  const network = {
    id: 'open-self-intersecting-curved-pentagram',
    pointIds: ['tp-42', 'tp-41', 'tp-40', 'tp-39', 'tp-36'],
    segmentIds: ['ts-58', 'ts-57', 'ts-56', 'ts-55'],
    closed: false
  } as const
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: network.id,
    networkId: network.id,
    points: sourcePath.sampledPoints,
    closed: false
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
    sharedStrokeBoundaryDomains:
      resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ??
      [],
    guardPoints: network.pointIds.map((pointId) => {
      const point = points[pointId]
      return { x: point.x, y: point.y, sharp: point.anchorType === 'sharp' }
    })
  }
}

const expectOpenSelfIntersectingContourDashIntervals = (
  topology: ReturnType<typeof buildPathTopologyModel>,
  sourcePath: ReturnType<typeof buildPolylineGeometryModelPath>,
  stroke: ReturnType<typeof createDefaultStroke>,
  options: {
    fillRegions: PolygonRegion[]
    sharedSourceSplitRanges: ReturnType<
      typeof buildOpenSelfIntersectingPentagramFixture
    >['sharedSourceSplitRanges']
    sharedStrokeBoundaryDomains: ReturnType<
      typeof buildOpenSelfIntersectingPentagramFixture
    >['sharedStrokeBoundaryDomains']
  }
) => {
  const renderableStroke = getOnlyRenderableStroke([stroke])
  const strokeDomainPlan = resolveStrokeDomains({
    topology,
    sourceFamily: resolveSourceFamily({ topology, stroke: renderableStroke }),
    stroke: renderableStroke,
    sourcePath,
    implicitFillRegions: options.fillRegions,
    sharedSourceSplitRanges: options.sharedSourceSplitRanges,
    sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
  })
  const intervals = getConstrainedDashedVisibleIntervals(
    topology,
    renderableStroke,
    sourcePath,
    strokeDomainPlan
  )

  expect(intervals.length).toBeGreaterThan(2)
  expect(strokeDomainPlan.intervalDomainKind).toBe('domain-plan-split-range')
  expect(
    intervals.every((interval) => interval.domainPlanSplitRangeId !== undefined)
  ).toBe(true)
  expect(
    intervals.every((interval) => interval.openPathTerminalRole === undefined)
  ).toBe(true)
  const visibleRolesBySplitRange = intervals.reduce<Map<string, Set<string>>>(
    (rolesByRange, interval) => {
      if (!interval.domainPlanSplitRangeId) {
        return rolesByRange
      }
      const roles =
        rolesByRange.get(interval.domainPlanSplitRangeId) ?? new Set()
      if (interval.domainPlanTerminalRole) {
        roles.add(interval.domainPlanTerminalRole)
      }
      rolesByRange.set(interval.domainPlanSplitRangeId, roles)
      return rolesByRange
    },
    new Map()
  )
  const rangesWithTerminals = [...visibleRolesBySplitRange.values()].filter(
    (roles) =>
      roles.has('start-end') || (roles.has('start') && roles.has('end'))
  )
  expect(rangesWithTerminals.length).toBeGreaterThan(0)

  if (stroke.position === 'inside') {
    expect(
      strokeDomainPlan.diagnostics.includes('source-span-product-domains-added')
    ).toBe(false)
    expect(
      intervals.some((interval) =>
        interval.domainPlanSplitRangeId?.startsWith(
          'source-span-product-domain:'
        )
      )
    ).toBe(false)
    expect(
      intervals.every(
        (interval) =>
          interval.domainPlanSelectedSide === interval.domainPlanFilledSide &&
          interval.domainPlanSelectedSide !== interval.domainPlanUnfilledSide
      )
    ).toBe(true)
    return
  }

  const danglingSourceSpanIntervals = intervals.filter((interval) =>
    interval.domainPlanSplitRangeId?.startsWith('dangling-source-span-domain:')
  )
  expect(danglingSourceSpanIntervals.length).toBeGreaterThan(0)
  const danglingSourceSegmentIndexes = new Set(
    danglingSourceSpanIntervals.map(
      (interval) => interval.domainPlanSplitRangeSourceSegmentIndex
    )
  )
  expect(danglingSourceSegmentIndexes.has(0)).toBe(true)
  expect(danglingSourceSegmentIndexes.has(sourcePath.segments.length - 1)).toBe(
    true
  )
  expect(
    danglingSourceSpanIntervals.every(
      (interval) =>
        interval.domainPlanDomainMode === 'open-dangling-outside-both-sides' &&
        interval.domainPlanBoundaryRole === 'ambiguous' &&
        interval.domainPlanSelectedSide === undefined &&
        interval.domainPlanSideResolutionReason ===
          'open-dangling-outside-both-sides'
    )
  ).toBe(true)
  expect(
    intervals.some(
      (interval) =>
        interval.domainPlanBoundaryRole === 'outer' &&
        interval.domainPlanSelectedSide === interval.domainPlanUnfilledSide &&
        interval.domainPlanSelectedSide !== interval.domainPlanFilledSide
    )
  ).toBe(true)
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

describe('constrained dashed stroke packets: self-intersecting bounded source domains', () => {
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
    const sharedStrokeBoundaryDomains =
      resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ??
      []
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
        sharedStrokeBoundaryDomains,
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
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
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
      intervalDomainKind: 'domain-plan-split-range',
      supportState: 'supported'
    })
    expect(visibleIntervals.length).toBeGreaterThan(0)
    expect(
      sharedSourceSplitRanges.every(
        (range) =>
          range.sideResolutionStatus === 'resolved' &&
          range.filledSide !== range.unfilledSide
      )
    ).toBe(true)
    expect(
      visibleIntervals.some(
        (interval) =>
          interval.domainPlanTerminalRole === 'start' &&
          interval.domainPlanSplitRangeId !== undefined &&
          interval.domainPlanSelectedSide === interval.domainPlanFilledSide
      )
    ).toBe(true)
    expect(
      visibleIntervals.some(
        (interval) =>
          interval.domainPlanTerminalRole === 'end' &&
          interval.domainPlanSplitRangeId !== undefined &&
          interval.domainPlanSelectedSide === interval.domainPlanFilledSide
      )
    ).toBe(true)
    expect(packets.length).toBeGreaterThan(0)
    const invalidImplicitSidePackets = packets.filter((packet) => {
      const meta = packet.geometry.debugMeta
      if (meta?.domainPlanSideAuthority !== 'implicit-fill-hole-domain') {
        return false
      }
      return !(
        meta.domainPlanSelectedSide === meta.domainPlanFilledSide &&
        meta.domainPlanSelectedSide !== meta.domainPlanUnfilledSide &&
        (meta.domainPlanBoundaryRole === 'outer' ||
          meta.domainPlanBoundaryRole === 'hole' ||
          meta.domainPlanBoundaryRole === 'filled-face')
      )
    })
    expect(
      invalidImplicitSidePackets.map((packet) => packet.geometry.debugMeta)
    ).toEqual([])
    const packetPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const missingCoverageIntervals = visibleIntervals
      .filter((interval) =>
        requiresRuleDrivenIntervalProductCoverage(stroke, interval)
      )
      .flatMap((interval, intervalIndex) =>
        hasRuleDrivenIntervalSpatialCoverage({
          sourcePath,
          interval: {
            index: intervalIndex,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            length: interval.intervalLength,
            wrapsSeam: interval.wrapsSeam,
            domainPlanSelectedSide: interval.domainPlanSelectedSide,
            domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
            domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints,
            domainPlanBoundaryTotalLength:
              interval.domainPlanBoundaryTotalLength
          },
          polygons: packetPolygons,
          tolerance: 1,
          stroke,
          implicitFillRegions:
            resolvedGeometry.networks[0]?.selfIntersecting?.fillRegions ?? []
        })
          ? []
          : [
              {
                intervalId: interval.intervalId,
                intervalIndex,
                startDistance: Math.round(interval.startDistance * 100) / 100,
                endDistance: Math.round(interval.endDistance * 100) / 100,
                selectedSide: interval.domainPlanSelectedSide,
                boundaryRole: interval.domainPlanBoundaryRole,
                boundaryPointCount:
                  interval.domainPlanBoundaryPoints?.length ?? 0,
                boundaryTotalLength:
                  interval.domainPlanBoundaryTotalLength === undefined
                    ? undefined
                    : Math.round(interval.domainPlanBoundaryTotalLength * 100) /
                      100,
                packets: packets
                  .filter(
                    (packet) =>
                      packet.geometry.debugMeta?.intervalId ===
                      interval.intervalId
                  )
                  .map((packet) => ({
                    splitRangeId:
                      packet.geometry.debugMeta?.domainPlanSplitRangeId,
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    side: packet.geometry.debugMeta?.domainPlanSelectedSide,
                    polygonCount: packet.geometry.polygons.length,
                    vertexCount: packet.geometry.polygons.reduce(
                      (sum, polygon) => sum + polygon.length,
                      0
                    )
                  }))
              }
            ]
      )
    expect(
      missingCoverageIntervals.every(
        (interval) => interval.boundaryRole !== 'outer'
      )
    ).toBe(true)
    expect(missingCoverageIntervals).toHaveLength(4)
  })

  it('should run: build self-intersecting inside dashed products from shared filled-face boundary domains', () => {
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
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final'
      }
    )
    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.debugMeta?.domainPlanBoundaryRole === 'filled-face'
      )
    ).toBe(true)
    expect(
      packets.every((packet) => {
        const meta = packet.geometry.debugMeta
        if (meta?.domainPlanSideAuthority !== 'implicit-fill-hole-domain') {
          return true
        }
        return (
          meta.domainPlanFilledSide !== undefined &&
          meta.domainPlanUnfilledSide !== undefined &&
          meta.domainPlanFilledSide !== meta.domainPlanUnfilledSide &&
          (meta.domainPlanBoundaryRole === 'outer' ||
            meta.domainPlanBoundaryRole === 'filled-face')
        )
      })
    ).toBe(true)
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
    expect(
      finalFaces.some(
        (face) => face.debugMeta?.domainPlanBoundaryRole === 'filled-face'
      )
    ).toBe(true)
    expect(
      finalFaces.every((face) => {
        const meta = face.debugMeta
        if (meta?.domainPlanSideAuthority !== 'implicit-fill-hole-domain') {
          return true
        }
        return (
          meta.domainPlanFilledSide !== undefined &&
          meta.domainPlanUnfilledSide !== undefined &&
          meta.domainPlanBoundaryRole !== undefined
        )
      })
    ).toBe(true)
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

  it('should run: resolve self-intersecting no-fill inside dashed side from bounded fill domains', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
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
        sharedStrokeBoundaryDomains,
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
          packet.geometry.debugMeta?.domainPlanSideAuthority ===
            'implicit-fill-hole-domain' &&
          packet.geometry.debugMeta?.domainPlanSideResolutionStatus ===
            'resolved' &&
          (packet.geometry.debugMeta?.domainPlanSelectedSide === 1 ||
            packet.geometry.debugMeta?.domainPlanSelectedSide === -1)
      )
    ).toBe(true)
    const noFillMissingCoverageIntervals =
      getVisibleIntervalsWithoutRuleDrivenSpatialCoverage({
        sourcePath,
        stroke,
        polygons: packets.flatMap((packet) => packet.geometry.polygons),
        contextLabel:
          'self-intersecting-mixed-star:no-fill-implicit-domain-side',
        coverageTolerance: 1
      })
    expect(
      noFillMissingCoverageIntervals.every(
        (interval) => interval.domainPlanBoundaryRole !== 'outer'
      )
    ).toBe(true)
    expect(noFillMissingCoverageIntervals).toHaveLength(28)
  })

  it('should run: keep self-intersecting outside dashed on exterior boundary domains only', () => {
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
      position: 'outside',
      joinType: 'miter',
      capType: 'round',
      dashPattern: [27, 20],
      dashOffset: 0
    })

    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:outside-filled-face-side',
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
    const implicitSidePackets = packets.filter(
      (packet) =>
        packet.geometry.debugMeta?.domainPlanSideAuthority ===
        'implicit-fill-hole-domain'
    )
    const filledFacePackets = implicitSidePackets.filter(
      (packet) =>
        packet.geometry.debugMeta?.domainPlanBoundaryRole === 'filled-face'
    )

    expect(implicitSidePackets.length).toBeGreaterThan(0)
    expect(
      filledFacePackets,
      JSON.stringify(
        {
          message:
            'outside dashed implicit-fill-domain packets must stay on exterior outer boundary domains; filled-face packets would draw inside the legal fill face',
          filledFacePackets: filledFacePackets.map((packet) => ({
            geometryId: packet.geometry.geometryId,
            intervalId: packet.geometry.debugMeta?.intervalId,
            boundaryRole: packet.geometry.debugMeta?.domainPlanBoundaryRole,
            selectedSide: packet.geometry.debugMeta?.domainPlanSelectedSide,
            filledSide: packet.geometry.debugMeta?.domainPlanFilledSide,
            unfilledSide: packet.geometry.debugMeta?.domainPlanUnfilledSide,
            sideResolutionStatus:
              packet.geometry.debugMeta?.domainPlanSideResolutionStatus,
            finalCoverageBuilderStatus:
              packet.geometry.debugMeta?.finalCoverageBuilderStatus
          }))
        },
        null,
        2
      )
    ).toEqual([])
    expect(
      implicitSidePackets.every((packet) => {
        const meta = packet.geometry.debugMeta
        return (
          meta?.domainPlanSelectedSide === meta?.domainPlanUnfilledSide &&
          meta?.domainPlanSelectedSide !== meta?.domainPlanFilledSide &&
          meta?.domainPlanBoundaryRole === 'outer'
        )
      })
    ).toBe(true)
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
    const renderEntries =
      toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
    const exportPackets =
      buildSolidCenterStrokeExportPacketsFromFinalFaces(finalFaces)
    const hitPackets = buildSolidCenterStrokeHitTestPackets(packets)

    expect(
      finalFaces.filter(
        (face) => face.debugMeta?.domainPlanBoundaryRole === 'filled-face'
      )
    ).toEqual([])
    expect(getClippedPolygonQualityFailures(packets)).toEqual([])
    expect(
      getPolygonQualityFailures(
        renderEntries.map((entry) => ({
          polygons: entry.polygons,
          intervalId: entry.debugMeta?.intervalId,
          splitRangeId: entry.debugMeta?.domainPlanSplitRangeId,
          terminalRole: entry.debugMeta?.domainPlanTerminalRole
        }))
      )
    ).toEqual([])
    expect(
      getHighCurvatureFanPolygonFailures(
        renderEntries.map((entry) => ({
          polygons: entry.polygons,
          intervalId: entry.debugMeta?.intervalId,
          splitRangeId: entry.debugMeta?.domainPlanSplitRangeId,
          terminalRole: entry.debugMeta?.domainPlanTerminalRole,
          boundaryRole: entry.debugMeta?.domainPlanBoundaryRole,
          strokePosition: entry.debugMeta?.strokePosition
        }))
      )
    ).toEqual([])
    expect(
      getHighCurvatureFanPolygonFailures(
        exportPackets.map((packet) => ({
          polygons: packet.polygons,
          intervalId: packet.debugMeta?.intervalId,
          splitRangeId: packet.debugMeta?.domainPlanSplitRangeId,
          terminalRole: packet.debugMeta?.domainPlanTerminalRole,
          boundaryRole: packet.debugMeta?.domainPlanBoundaryRole,
          strokePosition: packet.debugMeta?.strokePosition
        }))
      )
    ).toEqual([])
    expect(
      getHighCurvatureFanPolygonFailures(
        hitPackets.map((packet) => ({
          polygons: packet.polygons,
          intervalId: packet.debugMeta?.intervalId,
          splitRangeId: packet.debugMeta?.domainPlanSplitRangeId,
          terminalRole: packet.debugMeta?.domainPlanTerminalRole,
          boundaryRole: packet.debugMeta?.domainPlanBoundaryRole,
          strokePosition: packet.debugMeta?.strokePosition
        }))
      )
    ).toEqual([])
  })

  it('should run: render open self-intersecting inside dashed through bounded source filled-region domain', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildOpenSelfIntersectingPentagramFixture()

    expect(topology.closed).toBe(false)
    expect(topology.isSimpleOpen).toBe(false)
    expect(fillRegions.length).toBeGreaterThanOrEqual(3)
    expect(
      new Set(sharedSourceSplitRanges.flatMap((range) => range.contourIds)).size
    ).toBeGreaterThanOrEqual(3)

    const stroke = createDefaultStroke({
      width: 12,
      style: 'dashed',
      position: 'inside',
      joinType: 'miter',
      capType: 'square',
      dashPattern: [28, 20],
      dashOffset: 0
    })
    const options = {
      topology,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      selectedSideGuardPoints: guardPoints,
      clipInsideToFillDomain: true,
      constrainedDashedVisualMode: 'product-final' as const
    }
    expectOpenSelfIntersectingContourDashIntervals(
      topology,
      sourcePath,
      stroke,
      {
        fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains
      }
    )
    const visualEntries = buildConstrainedDashedStrokeProductVisualEntries(
      'open-self-intersecting-pentagram:inside:visual',
      topology.normalizedPoints,
      false,
      [stroke],
      {
        ...options,
        enableProductVisualCompiler: true,
        visualOnly: true
      }
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'open-self-intersecting-pentagram:inside',
      topology.normalizedPoints,
      false,
      [stroke],
      options
    )

    expect(visualEntries?.length ?? 0).toBe(1)
    const [visualEntry] = visualEntries ?? []
    expect(visualEntry?.debugMeta?.strokePosition).toBe('inside')
    expect(visualEntry?.debugMeta?.sourceTopology).toBe('self-intersecting')
    expect(visualEntry?.debugMeta?.finalCoverageBuilderStatus).toBe(
      'product-final'
    )
    expect(visualEntry?.fillClipPolygons?.length ?? 0).toBeGreaterThan(0)
    expect(visualEntry?.strokePaths?.length ?? 0).toBeGreaterThan(0)
    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) => packet.geometry.debugMeta?.strokePosition === 'inside'
      )
    ).toBe(true)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
          'product-final'
      )
    ).toBe(true)
  })

  it('should run: render open self-intersecting outside dashed through bounded source exterior domain', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildOpenSelfIntersectingPentagramFixture()

    expect(topology.closed).toBe(false)
    expect(topology.isSimpleOpen).toBe(false)
    expect(fillRegions.length).toBeGreaterThanOrEqual(3)
    expect(
      new Set(sharedSourceSplitRanges.flatMap((range) => range.contourIds)).size
    ).toBeGreaterThanOrEqual(3)

    const stroke = createDefaultStroke({
      width: 12,
      style: 'dashed',
      position: 'outside',
      joinType: 'miter',
      capType: 'square',
      dashPattern: [28, 20],
      dashOffset: 0
    })
    const options = {
      topology,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      selectedSideGuardPoints: guardPoints,
      clipInsideToFillDomain: true,
      constrainedDashedVisualMode: 'product-final' as const
    }
    expectOpenSelfIntersectingContourDashIntervals(
      topology,
      sourcePath,
      stroke,
      {
        fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains
      }
    )
    const visualEntries = buildConstrainedDashedStrokeProductVisualEntries(
      'open-self-intersecting-pentagram:outside:visual',
      topology.normalizedPoints,
      false,
      [stroke],
      {
        ...options,
        enableProductVisualCompiler: true,
        visualOnly: true
      }
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'open-self-intersecting-pentagram:outside',
      topology.normalizedPoints,
      false,
      [stroke],
      options
    )

    expect(visualEntries).not.toBeNull()
    expect(visualEntries?.length).toBe(1)
    const visualEntry = visualEntries?.[0]
    expect(visualEntry?.debugMeta?.geometryFamily).toBe('constrained-dashed')
    expect(visualEntry?.debugMeta?.strokePosition).toBe('outside')
    expect(visualEntry?.debugMeta?.intervalId).toBe('product-visual-mask')
    expect(visualEntry?.debugMeta?.finalCoverageBuilderStatus).toBe(
      'product-final'
    )
    expect(visualEntry?.polygons?.length ?? 0).toBeGreaterThan(0)
    expect(visualEntry?.strokePaths?.length ?? 0).toBeGreaterThan(0)
    expect(visualEntry?.strokePathStyle?.cap).toBe('butt')
    expect(visualEntry?.strokePathStyle?.width).toBe(stroke.width * 2)
    expect(
      visualEntry?.debugMeta?.domainPlanSplitRangeTerminals?.some((record) =>
        record.splitRangeId.startsWith('dangling-source-span-domain:')
      )
    ).toBe(true)
    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) => packet.geometry.debugMeta?.strokePosition === 'outside'
      )
    ).toBe(true)
    expect(
      packets.some((packet) =>
        packet.geometry.geometryId.includes('source-vertex-join')
      )
    ).toBe(false)
    const endpointOverhangFailures =
      getOutsideSquareTerminalEndpointOverhangFailures(packets)
    expect(
      endpointOverhangFailures,
      JSON.stringify(endpointOverhangFailures, null, 2)
    ).toEqual([])
    expect(
      packets.some(
        (packet) =>
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
          'product-final'
      )
    ).toBe(true)
    expect(
      packets.some((packet) =>
        packet.geometry.debugMeta?.domainPlanSplitRangeTerminals?.some(
          (record) =>
            record.splitRangeId.startsWith('dangling-source-span-domain:')
        )
      )
    ).toBe(true)
  })
  ;(['inside', 'outside'] as const).forEach((position) => {
    it(`should run: render curved open self-intersecting ${position} dashed through bounded source domain`, () => {
      const {
        sourcePath,
        topology,
        fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        guardPoints
      } = buildOpenSelfIntersectingCurvedPentagramFixture()

      expect(topology.closed).toBe(false)
      expect(topology.isSimpleOpen).toBe(false)
      expect(fillRegions.length).toBeGreaterThanOrEqual(3)

      const stroke = createDefaultStroke({
        width: 10,
        style: 'dashed',
        position,
        joinType: 'miter',
        capType: 'square',
        dashPattern: [27, 20],
        dashOffset: 0
      })
      const options = {
        topology,
        sourcePath,
        implicitFillRegions: fillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        selectedSideGuardPoints: guardPoints,
        clipInsideToFillDomain: true,
        constrainedDashedVisualMode: 'product-final' as const
      }

      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `open-self-intersecting-curved-pentagram:${position}`,
        topology.normalizedPoints,
        false,
        [stroke],
        options
      )

      expect(packets.length).toBeGreaterThan(0)
      expect(
        packets.every(
          (packet) =>
            packet.geometry.debugMeta?.strokePosition === position &&
            packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
            packet.geometry.debugMeta?.topologyFamily === 'open' &&
            packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
              'product-final'
        )
      ).toBe(true)
      if (position === 'inside') {
        expect(
          packets.some(
            (packet) =>
              packet.geometry.debugMeta?.domainPlanSplitRangeId?.startsWith(
                'source-span-product-domain:'
              ) === true
          )
        ).toBe(false)
      } else {
        const danglingPackets = packets.filter(
          (packet) =>
            packet.geometry.debugMeta?.domainPlanDomainMode ===
              'open-dangling-outside-both-sides' &&
            packet.geometry.debugMeta?.domainPlanSideResolutionReason ===
              'open-dangling-outside-both-sides'
        )
        expect(danglingPackets.length).toBeGreaterThan(0)
        const danglingSourceSegmentIndexes = new Set(
          danglingPackets.map(
            (packet) =>
              packet.geometry.debugMeta?.domainPlanSplitRangeSourceSegmentIndex
          )
        )
        expect(danglingSourceSegmentIndexes.has(0)).toBe(true)
        expect(
          danglingSourceSegmentIndexes.has(sourcePath.segments.length - 1)
        ).toBe(true)
        const contourOverlapFailures = danglingPackets.flatMap((packet) => {
          const meta = packet.geometry.debugMeta
          if (
            meta?.domainPlanSplitRangeSourceSegmentIndex === undefined ||
            meta.domainPlanSplitRangeStartDistance === undefined ||
            meta.domainPlanSplitRangeEndDistance === undefined
          ) {
            return [`${packet.id}:missing-source-range-metadata`]
          }
          const danglingStart = Math.min(
            meta.domainPlanSplitRangeStartDistance,
            meta.domainPlanSplitRangeEndDistance
          )
          const danglingEnd = Math.max(
            meta.domainPlanSplitRangeStartDistance,
            meta.domainPlanSplitRangeEndDistance
          )
          return sharedSourceSplitRanges
            .filter((range) => {
              const start = Math.min(
                range.sourceStartDistance,
                range.sourceEndDistance
              )
              const end = Math.max(
                range.sourceStartDistance,
                range.sourceEndDistance
              )
              const isStartTail =
                range.sourceSegmentIndex === 0 && start <= 0.25
              const isEndTail =
                range.sourceSegmentIndex === sourcePath.segments.length - 1 &&
                end >= sourcePath.totalLength - 0.25
              return !isStartTail && !isEndTail
            })
            .filter(
              (range) =>
                range.sourceSegmentIndex ===
                meta.domainPlanSplitRangeSourceSegmentIndex
            )
            .filter((range) => {
              const contourStart = Math.min(
                range.sourceStartDistance,
                range.sourceEndDistance
              )
              const contourEnd = Math.max(
                range.sourceStartDistance,
                range.sourceEndDistance
              )
              const overlap =
                Math.min(danglingEnd, contourEnd) -
                Math.max(danglingStart, contourStart)
              return overlap > 0.25
            })
            .map(
              (range) =>
                `${packet.id}:${meta.domainPlanSplitRangeSourceSegmentIndex}:${danglingStart.toFixed(
                  2
                )}-${danglingEnd.toFixed(2)} overlaps ${range.rangeId}`
            )
        })

        expect(contourOverlapFailures).toEqual([])

        const sourceSegmentNormalSpan = (packet: (typeof packets)[number]) => {
          const meta = packet.geometry.debugMeta
          const segmentIndex = meta?.domainPlanSplitRangeSourceSegmentIndex
          const segment =
            segmentIndex === undefined
              ? undefined
              : sourcePath.segments[segmentIndex]
          if (!segment) {
            return 0
          }
          const tangent = {
            x: segment.end.x - segment.start.x,
            y: segment.end.y - segment.start.y
          }
          const length = Math.hypot(tangent.x, tangent.y)
          if (length <= 0.000001) {
            return 0
          }
          const normal = {
            x: -tangent.y / length,
            y: tangent.x / length
          }
          const projections = packet.geometry.polygons
            .flat()
            .map((point) => point.x * normal.x + point.y * normal.y)
          return Math.max(...projections) - Math.min(...projections)
        }
        const maxFallbackNormalSpan = Math.max(
          ...danglingPackets.map(sourceSegmentNormalSpan)
        )
        expect(maxFallbackNormalSpan).toBeGreaterThan(stroke.width * 1.45)
      }
    })
  })
})
