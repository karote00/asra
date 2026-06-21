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
  buildConstrainedDashedStrokeResolvedPackets,
  getConstrainedDashedVisibleIntervals
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import { hasConstrainedDashedStrokeIntent } from '../components/stroke-render/constrained-dashed-stroke-packets'
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
import { buildConstrainedDashedDomainStrokePolygons } from '../components/stroke-render/constrained-dashed-domain-geometry'
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
  createDefaultFill,
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
    clipInsideToFillDomain: true
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
    backend.difference(toTestPolygonRegions(polygons), legalMask, 'evenodd')
  )

  return outsideResidue.reduce(
    (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
    0
  )
}

const getInsideLegalResidueDiagnostics = (
  polygons: { x: number; y: number }[][],
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  implicitFillRegions = getImplicitFillRegionsForTest(sourcePath)
) => {
  const legalRegions =
    implicitFillRegions.length > 0
      ? implicitFillRegions
      : getEvenOddLegalRegionsForTest(sourcePath)
  if (legalRegions.length === 0 || polygons.length === 0) {
    return []
  }

  const backend = getGeometryBackend()
  const normalizedLegalRegions = backend.capabilities.union
    ? backend.union(legalRegions, 'nonzero')
    : legalRegions
  const legalMask =
    normalizedLegalRegions.length > 0 ? normalizedLegalRegions : legalRegions
  const outsideResidue = getCoveragePolygonsForTest(
    backend.difference(toTestPolygonRegions(polygons), legalMask, 'evenodd')
  )

  return outsideResidue
    .map((polygon) => {
      const xs = polygon.map((point) => point.x)
      const ys = polygon.map((point) => point.y)
      return {
        area: Math.abs(signedPolygonArea(polygon)),
        pointCount: polygon.length,
        bounds: {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        }
      }
    })
    .sort((left, right) => right.area - left.area)
    .slice(0, 8)
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
  actualPolygons,
  context
}: {
  label: string
  stroke: ReturnType<typeof createDefaultStroke>
  actualPolygons: { x: number; y: number }[][]
  context?: unknown
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
        strokeWidth: stroke.width,
        context
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(maxAllowedArea)
}

interface RenderEntryStrokePathStyleForTest {
  width: number
  cap: 'butt' | 'square' | 'round' | 'none'
  join: 'miter' | 'bevel' | 'round'
  miterLimit: number
}

interface RenderEntryStrokePathGroupForTest {
  clipPolygons?: { x: number; y: number }[][]
  strokePaths?: { x: number; y: number }[][]
  strokePathStyle?: RenderEntryStrokePathStyleForTest
}

interface RenderEntrySourceMaskForTest {
  clipPolygons?: { x: number; y: number }[][]
  fillClipPolygons?: { x: number; y: number }[][]
  fillExcludePolygons?: { x: number; y: number }[][]
  strokeMaskPolygons?: { x: number; y: number }[][]
  strokePaths?: { x: number; y: number }[][]
  strokePathGroups?: RenderEntryStrokePathGroupForTest[]
  strokePathStyle?: RenderEntryStrokePathStyleForTest
}

const getExactIntersectionPolygonsForTest = (
  firstPolygons: { x: number; y: number }[][],
  secondPolygons: { x: number; y: number }[][]
) => {
  if (firstPolygons.length === 0 || secondPolygons.length === 0) {
    return []
  }
  const backend = getGeometryBackend()
  return getCoveragePolygonsForTest(
    backend.intersection(
      toTestPolygonRegions(firstPolygons),
      toTestPolygonRegions(secondPolygons),
      'nonzero'
    )
  )
}

const getExactDifferencePolygonsForDescriptorTest = (
  subjectPolygons: { x: number; y: number }[][],
  clipPolygons: { x: number; y: number }[][]
) => {
  if (subjectPolygons.length === 0) {
    return []
  }
  if (clipPolygons.length === 0) {
    return subjectPolygons
  }
  const backend = getGeometryBackend()
  return getCoveragePolygonsForTest(
    backend.difference(
      toTestPolygonRegions(subjectPolygons),
      toTestPolygonRegions(clipPolygons),
      'nonzero'
    )
  )
}

const buildRenderStrokePathPolygonsForTest = (
  strokePaths: { x: number; y: number }[][],
  style: RenderEntryStrokePathStyleForTest | undefined
) =>
  style
    ? strokePaths.flatMap((strokePath) =>
        buildSolidCenterStrokePolygons(strokePath, true, {
          style: 'solid',
          position: 'center',
          width: style.width,
          cap: style.cap === 'none' ? 'butt' : style.cap,
          join: style.join,
          miterLimit: style.miterLimit
        })
      )
    : []

const getStrokeMaskPolygonsForDescriptorTest = (
  descriptor: RenderEntrySourceMaskForTest
) => {
  const strokePathPolygons = buildRenderStrokePathPolygonsForTest(
    descriptor.strokePaths ?? [],
    descriptor.strokePathStyle
  )
  const strokePathGroupPolygons =
    descriptor.strokePathGroups?.flatMap((group) => {
      const groupPolygons = buildRenderStrokePathPolygonsForTest(
        group.strokePaths ?? [],
        group.strokePathStyle ?? descriptor.strokePathStyle
      )
      return group.clipPolygons && group.clipPolygons.length > 0
        ? getExactIntersectionPolygonsForTest(groupPolygons, group.clipPolygons)
        : groupPolygons
    }) ?? []

  return [
    ...(descriptor.strokeMaskPolygons ?? []),
    ...strokePathPolygons,
    ...strokePathGroupPolygons
  ]
}

const getVisibleStrokePolygonsFromDescriptorForTest = (
  descriptor: RenderEntrySourceMaskForTest,
  productPolygons: { x: number; y: number }[][]
) => {
  let visiblePolygons = getStrokeMaskPolygonsForDescriptorTest(descriptor)
  if (visiblePolygons.length === 0) {
    visiblePolygons = productPolygons
  }
  const clipPolygons = descriptor.clipPolygons ?? []
  if (clipPolygons.length > 0 && visiblePolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForTest(
      visiblePolygons,
      clipPolygons
    )
  }
  if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForTest(
      visiblePolygons,
      descriptor.fillClipPolygons
    )
  }
  if (
    descriptor.fillExcludePolygons &&
    descriptor.fillExcludePolygons.length > 0
  ) {
    visiblePolygons = getExactDifferencePolygonsForDescriptorTest(
      visiblePolygons,
      descriptor.fillExcludePolygons
    )
  }
  return visiblePolygons
}

const getVisiblePacketProductPolygonsForTest = (
  packet: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>[number]
) =>
  packet.geometry.renderDescriptor
    ? getVisibleStrokePolygonsFromDescriptorForTest(
        packet.geometry.renderDescriptor,
        packet.geometry.polygons
      )
    : packet.geometry.polygons

const getVisibleFinalFaceProductPolygonsForTest = (
  face: ArrangedStrokeFinalFace
) =>
  face.renderDescriptor
    ? getVisibleStrokePolygonsFromDescriptorForTest(
        face.renderDescriptor,
        face.polygons
      )
    : face.polygons

const getVisibleRenderEntryProductPolygonsForTest = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) =>
  getVisibleStrokePolygonsFromDescriptorForTest(
    entry as RenderEntrySourceMaskForTest,
    entry.polygons
  )

const getPacketPolygonsForTest = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) => packets.flatMap(getVisiblePacketProductPolygonsForTest)

const getInsideLegalDomainsForTest = (fillRegions: PolygonRegion[]) => [
  {
    legalDomainId: 'test-inside-filled-region',
    fillRule: 'nonzero' as const,
    regions: fillRegions
  }
]

const expectInsideDashedProductFinalPacketOwnership = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) => {
  expect(
    packets.every(
      (packet) =>
        packet.geometry.debugMeta?.productSignature?.startsWith(
          'constrained-dashed:'
        ) === true && packet.geometry.debugMeta?.strokePosition === 'inside'
    )
  ).toBe(true)
}

const expectInsideDashedPolygonsPreserveSplitRangeRule = ({
  label,
  sourcePath,
  stroke,
  fillRegions,
  actualPolygons,
  sourcePackets,
  domainOptions
}: {
  label: string
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  stroke: ReturnType<typeof createDefaultStroke>
  fillRegions: PolygonRegion[]
  actualPolygons: { x: number; y: number }[][]
  sourcePackets?: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
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
    JSON.stringify(
      {
        label,
        message:
          'inside dashed product polygons must remain inside the resolved legal fill domain',
        outsideResidueArea,
        packetResidueDiagnostics: sourcePackets
          ?.map((packet) => ({
            intervalId: packet.geometry.debugMeta?.intervalId,
            domainPlanSplitRangeId:
              packet.geometry.debugMeta?.domainPlanSplitRangeId,
            domainPlanTerminalRole:
              packet.geometry.debugMeta?.domainPlanTerminalRole,
            domainPlanSelectedSide:
              packet.geometry.debugMeta?.domainPlanSelectedSide,
            domainPlanBoundaryDomainId:
              packet.geometry.debugMeta?.domainPlanBoundaryDomainId,
            productSignature: packet.geometry.debugMeta?.productSignature,
            finalProductArea: packet.geometry.debugMeta?.finalProductArea,
            boundaryClippedProductArea:
              packet.geometry.debugMeta?.boundaryClippedProductArea,
            outsideResidueArea: getInsideLegalResidueArea(
              getVisiblePacketProductPolygonsForTest(packet),
              sourcePath,
              fillRegions
            ),
            residueDiagnostics: getInsideLegalResidueDiagnostics(
              getVisiblePacketProductPolygonsForTest(packet),
              sourcePath,
              fillRegions
            )
          }))
          .filter((diagnostic) => diagnostic.outsideResidueArea > 1e-6)
          .sort(
            (left, right) => right.outsideResidueArea - left.outsideResidueArea
          )
          .slice(0, 12),
        residueDiagnostics: getInsideLegalResidueDiagnostics(
          actualPolygons,
          sourcePath,
          fillRegions
        )
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(stroke.width * stroke.width * 4.5)
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
      !interval.domainPlanSplitRangeId ||
      interval.domainPlanSplitRangeStartDistance === undefined ||
      interval.domainPlanSplitRangeEndDistance === undefined
    ) {
      return
    }

    intervalsBySplitRange.set(interval.domainPlanSplitRangeId, [
      ...(intervalsBySplitRange.get(interval.domainPlanSplitRangeId) ?? []),
      {
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        splitRangeStartDistance: interval.domainPlanSplitRangeStartDistance,
        splitRangeEndDistance: interval.domainPlanSplitRangeEndDistance,
        terminalRole: interval.domainPlanTerminalRole,
        boundaryTotalLength: interval.domainPlanBoundaryTotalLength,
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
  const collectAtomicIntervalIds = (intervalId: string | undefined) =>
    intervalId
      ?.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0) ?? []
  const packetIntervalIds = new Set(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.intervalIds ?? []).flatMap(
        collectAtomicIntervalIds
      ),
      ...(packet.geometry.debugMeta?.dashProductIntervals ?? []).flatMap(
        (interval) => collectAtomicIntervalIds(interval.intervalId)
      ),
      ...collectAtomicIntervalIds(packet.geometry.debugMeta?.intervalId)
    ])
  )
  const visibleIntervals = eventMap.dashIntervals.filter(
    (interval) => interval.length > 1e-6
  )
  const missingIntervalIds = visibleIntervals
    .map((interval) => interval.intervalId)
    .filter((intervalId) => !packetIntervalIds.has(intervalId))
  const missingSplitRangeIds = new Set(
    visibleIntervals
      .filter((interval) => missingIntervalIds.includes(interval.intervalId))
      .map((interval) => interval.domainPlanSplitRangeId)
      .filter(
        (splitRangeId): splitRangeId is string => splitRangeId !== undefined
      )
  )
  const intervalsByMissingSplitRange = visibleIntervals
    .filter(
      (interval) =>
        interval.domainPlanSplitRangeId !== undefined &&
        missingSplitRangeIds.has(interval.domainPlanSplitRangeId)
    )
    .map((interval) => ({
      intervalId: interval.intervalId,
      hasPacket: packetIntervalIds.has(interval.intervalId),
      domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
      domainPlanTerminalRole: interval.domainPlanTerminalRole,
      domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
      domainPlanSelectedSide: interval.domainPlanSelectedSide,
      domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
      startDistance: interval.startDistance,
      endDistance: interval.endDistance,
      length: interval.length
    }))
  const packetsByMissingSplitRange = packets
    .filter((packet) =>
      packet.geometry.debugMeta?.domainPlanSplitRangeTerminals?.some(
        (terminal) =>
          terminal.splitRangeId !== undefined &&
          missingSplitRangeIds.has(terminal.splitRangeId)
      )
    )
    .map((packet) => ({
      intervalId: packet.geometry.debugMeta?.intervalId,
      polygonCount: packet.geometry.polygons.length,
      finalProductArea: packet.geometry.debugMeta?.finalProductArea,
      rawProductArea: packet.geometry.debugMeta?.rawProductArea,
      cleanedProductArea: packet.geometry.debugMeta?.cleanedProductArea,
      boundaryClippedProductArea:
        packet.geometry.debugMeta?.boundaryClippedProductArea,
      domainPlanSplitRangeTerminals:
        packet.geometry.debugMeta?.domainPlanSplitRangeTerminals
    }))
  expect(
    {
      packetCount: packets.length,
      packetIntervalIdCount: packetIntervalIds.size,
      visibleIntervalCount,
      missingIntervalIds,
      missingIntervals: visibleIntervals
        .filter((interval) => missingIntervalIds.includes(interval.intervalId))
        .map((interval) => ({
          intervalId: interval.intervalId,
          domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
          domainPlanTerminalRole: interval.domainPlanTerminalRole,
          domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
          domainPlanSelectedSide: interval.domainPlanSelectedSide,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance,
          length: interval.length
        })),
      intervalsByMissingSplitRange,
      packetsByMissingSplitRange
    },
    `${label}:inside-legal-domain-product-packet-interval-coverage`
  ).toMatchObject({
    packetIntervalIdCount: visibleIntervalCount,
    visibleIntervalCount,
    missingIntervalIds: [],
    missingIntervals: [],
    intervalsByMissingSplitRange: [],
    packetsByMissingSplitRange: []
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
    sourcePackets: packets,
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
        packet.geometry.debugMeta?.domainPlanSplitRangeId === splitRangeId
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
    records?: {
      id: string
      intervalId?: string
      splitRangeId?: string
      startDistance?: number
      endDistance?: number
      splitRangeStartDistance?: number
      splitRangeEndDistance?: number
      sourceSegmentIndex?: number
      terminalRole?: string
      polygons: { x: number; y: number }[][]
    }[]
  }[]
}) => {
  const getTopOverlapRecords = (
    records:
      | {
          id: string
          intervalId?: string
          splitRangeId?: string
          startDistance?: number
          endDistance?: number
          splitRangeStartDistance?: number
          splitRangeEndDistance?: number
          boundaryStartDistance?: number
          boundaryEndDistance?: number
          sourceSegmentIndex?: number
          boundaryDomainId?: string
          selectedSide?: 1 | -1
          materializedSourceSide?: 1 | -1
          terminalRole?: string
          polygons: { x: number; y: number }[][]
        }[]
      | undefined
  ) => {
    if (!records || records.length <= 1) {
      return []
    }

    const getRecordArea = (record: {
      polygons: { x: number; y: number }[][]
    }) =>
      record.polygons.reduce(
        (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
        0
      )

    const boundsRecords = records.map((record) => ({
      ...record,
      bounds: getPointBounds(record.polygons.flat()),
      area: getRecordArea(record)
    }))
    const overlaps: {
      area: number
      left: {
        id: string
        intervalId?: string
        splitRangeId?: string
        startDistance?: number
        endDistance?: number
        splitRangeStartDistance?: number
        splitRangeEndDistance?: number
        boundaryStartDistance?: number
        boundaryEndDistance?: number
        sourceSegmentIndex?: number
        boundaryDomainId?: string
        selectedSide?: 1 | -1
        materializedSourceSide?: 1 | -1
        terminalRole?: string
        bounds: ReturnType<typeof getPointBounds>
        area: number
      }
      right: {
        id: string
        intervalId?: string
        splitRangeId?: string
        startDistance?: number
        endDistance?: number
        splitRangeStartDistance?: number
        splitRangeEndDistance?: number
        boundaryStartDistance?: number
        boundaryEndDistance?: number
        sourceSegmentIndex?: number
        boundaryDomainId?: string
        selectedSide?: 1 | -1
        materializedSourceSide?: 1 | -1
        terminalRole?: string
        bounds: ReturnType<typeof getPointBounds>
        area: number
      }
    }[] = []

    boundsRecords.forEach((left, leftIndex) => {
      boundsRecords.slice(leftIndex + 1).forEach((right) => {
        if (
          left.bounds.maxX <= right.bounds.minX ||
          right.bounds.maxX <= left.bounds.minX ||
          left.bounds.maxY <= right.bounds.minY ||
          right.bounds.maxY <= left.bounds.minY
        ) {
          return
        }

        const area = getSamePaintOverlapAreaForTest([
          ...left.polygons,
          ...right.polygons
        ])
        if (area <= 1e-6) {
          return
        }
        overlaps.push({
          area,
          left: {
            id: left.id,
            intervalId: left.intervalId,
            splitRangeId: left.splitRangeId,
            startDistance: left.startDistance,
            endDistance: left.endDistance,
            splitRangeStartDistance: left.splitRangeStartDistance,
            splitRangeEndDistance: left.splitRangeEndDistance,
            boundaryStartDistance: left.boundaryStartDistance,
            boundaryEndDistance: left.boundaryEndDistance,
            sourceSegmentIndex: left.sourceSegmentIndex,
            boundaryDomainId: left.boundaryDomainId,
            selectedSide: left.selectedSide,
            materializedSourceSide: left.materializedSourceSide,
            terminalRole: left.terminalRole,
            bounds: left.bounds,
            area: left.area
          },
          right: {
            id: right.id,
            intervalId: right.intervalId,
            splitRangeId: right.splitRangeId,
            startDistance: right.startDistance,
            endDistance: right.endDistance,
            splitRangeStartDistance: right.splitRangeStartDistance,
            splitRangeEndDistance: right.splitRangeEndDistance,
            boundaryStartDistance: right.boundaryStartDistance,
            boundaryEndDistance: right.boundaryEndDistance,
            sourceSegmentIndex: right.sourceSegmentIndex,
            boundaryDomainId: right.boundaryDomainId,
            selectedSide: right.selectedSide,
            materializedSourceSide: right.materializedSourceSide,
            terminalRole: right.terminalRole,
            bounds: right.bounds,
            area: right.area
          }
        })
      })
    })

    return overlaps.sort((left, right) => right.area - left.area).slice(0, 8)
  }
  const stageResidueSummary = stages.map((stage) => ({
    stage: stage.label,
    polygonCount: stage.polygons.length,
    samePaintOverlapArea: getSamePaintOverlapAreaForTest(stage.polygons),
    outsideResidueArea: getInsideLegalResidueArea(
      stage.polygons,
      sourcePath,
      fillRegions
    ),
    topResidueDiagnostics: getInsideLegalResidueDiagnostics(
      stage.polygons,
      sourcePath,
      fillRegions
    ).slice(0, 3),
    topOverlapRecords: getTopOverlapRecords(stage.records)
  }))
  stages.forEach((stage) => {
    const outsideResidueArea = getInsideLegalResidueArea(
      stage.polygons,
      sourcePath,
      fillRegions
    )
    expect(
      outsideResidueArea,
      JSON.stringify(
        {
          label: `${label}:${stage.label}`,
          message:
            'inside dashed product polygons must remain inside the resolved legal fill domain at every product stage',
          stageResidueSummary
        },
        null,
        2
      )
    ).toBeLessThanOrEqual(stroke.width * stroke.width * 4.5)
    if (
      stage.label === 'collapsed-faces' ||
      stage.label === 'export-packets' ||
      stage.label === 'render-entries'
    ) {
      expectInsideDashedNoSamePaintOverdraw({
        label: `${label}:${stage.label}`,
        stroke,
        actualPolygons: stage.polygons,
        context: { stageResidueSummary }
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
    intervalId: string
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
  domainPlanFilledSide?: 1 | -1
  domainPlanUnfilledSide?: 1 | -1
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanBoundaryDomainId?: string
  domainPlanSplitRangeSourceSegmentIndex?: number
  domainPlanBoundaryRole?: string
  domainPlanBoundaryPoints?: { x: number; y: number }[]
  domainPlanBoundaryTotalLength?: number
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanSplitRangeId?: string
  domainPlanSplitRangeStartDistance?: number
  domainPlanSplitRangeEndDistance?: number
  domainPlanTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
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
    intervalId: interval.intervalId,
    index: Number(interval.intervalId.replace('interval:', '')),
    startDistance: interval.startDistance,
    endDistance: interval.endDistance,
    wrapsSeam: interval.wrapsSeam,
    length: interval.intervalLength,
    domainPlanSelectedSide: interval.domainPlanSelectedSide,
    domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
    domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints,
    domainPlanBoundaryTotalLength: interval.domainPlanBoundaryTotalLength,
    domainPlanBoundaryStartDistance: interval.domainPlanBoundaryStartDistance,
    domainPlanBoundaryEndDistance: interval.domainPlanBoundaryEndDistance,
    domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
    domainPlanSplitRangeStartDistance:
      interval.domainPlanSplitRangeStartDistance,
    domainPlanSplitRangeEndDistance: interval.domainPlanSplitRangeEndDistance,
    domainPlanTerminalRole: interval.domainPlanTerminalRole
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

const getPolygonAreaSum = (polygons: { x: number; y: number }[][]) =>
  polygons.reduce(
    (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
    0
  )

const getStageIntervalArea = (
  records: RuleDrivenIntervalGeometryRecord[],
  intervalIndex: number
) =>
  getPolygonAreaSum(
    getRuleDrivenIntervalGeometryPolygons(records, intervalIndex)
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
    intervalIds: Array.from(
      new Set([
        ...(packet.geometry.debugMeta?.intervalIds ?? []),
        ...(packet.geometry.debugMeta?.dashProductIntervals ?? []).map(
          (interval) => interval.intervalId
        ),
        ...(packet.geometry.debugMeta?.intervalId
          ? [packet.geometry.debugMeta.intervalId]
          : [])
      ])
    ),
    polygons: packet.geometry.polygons
  }))

const toFinalFaceIntervalGeometryRecords = (
  faces: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>
): RuleDrivenIntervalGeometryRecord[] =>
  faces.map((face) => ({
    intervalIds:
      face.intervalIds.length > 0
        ? face.intervalIds
        : (face.debugMeta?.intervalIds ??
          face.debugMeta?.dashProductIntervals?.map(
            (interval) => interval.intervalId
          ) ??
          (face.debugMeta?.intervalId ? [face.debugMeta.intervalId] : [])),
    polygons: face.polygons
  }))

const toRenderEntryIntervalGeometryRecords = (
  entries: ReturnType<typeof toSolidCenterStrokeRenderEntriesFromFinalFaces>
): RuleDrivenIntervalGeometryRecord[] =>
  entries.map((entry) => ({
    intervalIds:
      entry.intervalIds && entry.intervalIds.length > 0
        ? entry.intervalIds
        : (entry.debugMeta?.intervalIds ??
          entry.debugMeta?.dashProductIntervals?.map(
            (interval) => interval.intervalId
          ) ??
          (entry.debugMeta?.intervalId ? [entry.debugMeta.intervalId] : [])),
    polygons: entry.polygons
  }))

const getRuleDrivenSplitRangeIntervalIds = (
  intervals: RuleDrivenDashInterval[],
  splitRangeId: string
) =>
  new Set(
    intervals
      .filter((interval) => interval.domainPlanSplitRangeId === splitRangeId)
      .map((interval) => `interval:${interval.index}`)
  )

const getRuleDrivenSplitRangeGeometryPolygons = ({
  records,
  intervals,
  splitRangeId
}: {
  records: RuleDrivenIntervalGeometryRecord[]
  intervals: RuleDrivenDashInterval[]
  splitRangeId: string
}) => {
  const splitRangeIntervalIds = getRuleDrivenSplitRangeIntervalIds(
    intervals,
    splitRangeId
  )
  if (splitRangeIntervalIds.size === 0) {
    return []
  }

  return records.flatMap((record) =>
    record.intervalIds.some((intervalId) =>
      splitRangeIntervalIds.has(intervalId)
    )
      ? record.polygons
      : []
  )
}

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
    interval.domainPlanSplitRangeStartDistance ?? interval.startDistance
  const endDistance =
    interval.domainPlanSplitRangeEndDistance ?? interval.endDistance
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
) => interval.domainPlanSplitRangeStartDistance ?? interval.startDistance

const getRuleDrivenIntervalLocalEndDistance = (
  interval: RuleDrivenDashInterval
) => interval.domainPlanSplitRangeEndDistance ?? interval.endDistance

const getRuleDrivenIntervalSelectedSide = (interval: {
  domainPlanSelectedSide?: number
}) =>
  interval.domainPlanSelectedSide === 1 ||
  interval.domainPlanSelectedSide === -1
    ? interval.domainPlanSelectedSide
    : undefined

const getRuleDrivenTerminalProbeDistanceFactors = (
  terminalRole: RuleDrivenDashInterval['domainPlanTerminalRole']
) => {
  switch (terminalRole) {
    case 'start':
      return [0.08, 0.15, 0.25, 0.35]
    case 'end':
      return [0.92, 0.85, 0.75, 0.65]
    case 'start-end':
      return [0.2, 0.35, 0.5, 0.65, 0.8]
    case 'middle':
    default:
      return [0.35, 0.5, 0.65]
  }
}

const getRuleDrivenLegalTerminalFootprintProbe = ({
  sourcePath,
  interval,
  stroke,
  implicitFillRegions
}: {
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>
  interval: RuleDrivenDashInterval
  stroke: ReturnType<typeof createDefaultStroke>
  implicitFillRegions: PolygonRegion[]
}) => {
  const probePath = getRuleDrivenPathForInterval(sourcePath, interval)
  if (probePath.totalLength <= 1e-6) {
    return null
  }

  const selectedSide = getRuleDrivenIntervalSelectedSide(interval)
  const factors = getRuleDrivenTerminalProbeDistanceFactors(
    interval.domainPlanTerminalRole
  )
  for (const factor of factors) {
    const distance = probePath.totalLength * factor
    const candidates = getRuleDrivenCoverageProbeCandidatesAtDistance(
      probePath,
      distance,
      stroke,
      implicitFillRegions,
      selectedSide
    )
    const legalCandidate = candidates.find((candidate) =>
      isPointCoveredByPolygons(
        candidate.point,
        implicitFillRegions.flatMap((region) => region.polygons),
        0.75
      )
    )
    if (legalCandidate) {
      return legalCandidate.point
    }
  }

  return null
}

const getRuleDrivenPathForInterval = (
  sourcePath: ReturnType<typeof buildVectorGeometryModelPath>,
  interval: RuleDrivenDashInterval
) => {
  if (
    !interval.domainPlanBoundaryPoints ||
    interval.domainPlanBoundaryPoints.length <= 1
  ) {
    return sourcePath
  }

  const boundaryPath = buildPolylineGeometryModelPath(
    interval.domainPlanBoundaryPoints,
    false
  )
  if (
    interval.domainPlanSplitRangeStartDistance === undefined ||
    interval.domainPlanSplitRangeEndDistance === undefined
  ) {
    return boundaryPath
  }

  const localStart = Math.max(
    0,
    Math.min(
      boundaryPath.totalLength,
      interval.startDistance - interval.domainPlanSplitRangeStartDistance
    )
  )
  const localEnd = Math.max(
    localStart,
    Math.min(
      boundaryPath.totalLength,
      interval.endDistance - interval.domainPlanSplitRangeStartDistance
    )
  )
  if (localEnd - localStart <= 1e-6) {
    return boundaryPath
  }

  const intervalBoundaryPoints = slicePathGeometryPoints(
    boundaryPath,
    localStart,
    localEnd,
    false
  )
  return intervalBoundaryPoints.length > 1
    ? buildPolylineGeometryModelPath(intervalBoundaryPoints, false)
    : boundaryPath
}

const roundNumberForTerminalDebug = (value: number | undefined) =>
  value === undefined ? undefined : Math.round(value * 1000) / 1000

const roundPointForTerminalDebug = (
  point: { x: number; y: number } | undefined
) =>
  point
    ? {
        x: roundNumberForTerminalDebug(point.x),
        y: roundNumberForTerminalDebug(point.y)
      }
    : undefined

const getRuleDrivenBoundaryDomainFaceKeyForDebug = (
  boundaryDomainId: string | undefined
) => {
  const explicitFaceKey = boundaryDomainId?.match(/^face:[^:]+/)?.[0]
  if (explicitFaceKey) {
    return explicitFaceKey
  }

  const contourFaceDomainKey = boundaryDomainId?.match(
    /^contour:face:[^:]+:[^:]+:domain:([^:]+)$/
  )?.[1]
  return contourFaceDomainKey ? `face:${contourFaceDomainKey}` : undefined
}

const getRuleDrivenIntervalTerminalDebug = (
  interval: RuleDrivenDashInterval
) => {
  const boundaryPoints = interval.domainPlanBoundaryPoints
  const boundaryStart = boundaryPoints?.[0]
  const boundaryEnd = boundaryPoints?.[boundaryPoints.length - 1]
  return {
    intervalId: `interval:${interval.index}`,
    splitRangeId: interval.domainPlanSplitRangeId,
    terminalRole: interval.domainPlanTerminalRole,
    sourceSegmentIndex: interval.domainPlanSplitRangeSourceSegmentIndex,
    selectedSide: interval.domainPlanSelectedSide,
    filledSide: interval.domainPlanFilledSide,
    unfilledSide: interval.domainPlanUnfilledSide,
    sideResolutionStatus: interval.domainPlanSideResolutionStatus,
    boundaryDomainId: interval.domainPlanBoundaryDomainId,
    boundaryStart: roundPointForTerminalDebug(boundaryStart),
    boundaryEnd: roundPointForTerminalDebug(boundaryEnd),
    boundaryPointCount: boundaryPoints?.length,
    boundaryStartDistance: roundNumberForTerminalDebug(
      interval.domainPlanBoundaryStartDistance
    ),
    boundaryEndDistance: roundNumberForTerminalDebug(
      interval.domainPlanBoundaryEndDistance
    ),
    boundaryTotalLength: roundNumberForTerminalDebug(
      interval.domainPlanBoundaryTotalLength
    ),
    splitRangeStartDistance: roundNumberForTerminalDebug(
      interval.domainPlanSplitRangeStartDistance
    ),
    splitRangeEndDistance: roundNumberForTerminalDebug(
      interval.domainPlanSplitRangeEndDistance
    ),
    startDistance: roundNumberForTerminalDebug(interval.startDistance),
    endDistance: roundNumberForTerminalDebug(interval.endDistance)
  }
}

const requiresRuleDrivenIntervalProductCoverage = (
  _stroke: ReturnType<typeof createDefaultStroke>,
  _interval: { domainPlanBoundaryRole?: string }
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
            domainPlanSelectedSide: interval.domainPlanSelectedSide,
            domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
            domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints,
            domainPlanBoundaryTotalLength:
              interval.domainPlanBoundaryTotalLength,
            domainPlanBoundaryStartDistance:
              interval.domainPlanBoundaryStartDistance,
            domainPlanBoundaryEndDistance:
              interval.domainPlanBoundaryEndDistance,
            domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
            domainPlanSplitRangeStartDistance:
              interval.domainPlanSplitRangeStartDistance,
            domainPlanSplitRangeEndDistance:
              interval.domainPlanSplitRangeEndDistance,
            domainPlanTerminalRole: interval.domainPlanTerminalRole
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
          'product polygons polygons should preserve spatial coverage for every visible dash interval',
        missing: missingIntervals
      },
      null,
      2
    )
  ).toEqual([])

  expect(
    polygons.length,
    `product polygons polygons should remain inspectable after split-range rendering:${contextLabel ?? ''}`
  ).toBeGreaterThan(0)
}

const getRuleDrivenProductPolygons = ({
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
  const packets = buildConstrainedDashedStrokeResolvedPackets(
    `${cachePrefix}:final-product`,
    points,
    closed,
    [stroke],
    options
  )
  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  return {
    source: 'final-faces' as const,
    polygons: finalFaces.flatMap(getVisibleFinalFaceProductPolygonsForTest),
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

  it('should run: ignore removed dash and gap fields when dashPattern is missing', () => {
    const removedDashGapOnlyStroke = {
      ...createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'inside'
      }),
      dash: 20,
      gap: 10
    }
    delete (
      removedDashGapOnlyStroke as Partial<typeof removedDashGapOnlyStroke>
    ).dashPattern

    expect(hasConstrainedDashedStrokeIntent([removedDashGapOnlyStroke])).toBe(
      false
    )
    expect(
      getRenderableStrokes([removedDashGapOnlyStroke])[0]?.dashPattern
    ).toEqual([])
    expect(
      buildConstrainedDashedStrokeResolvedPackets(
        'removed-dash-gap:test',
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        [removedDashGapOnlyStroke]
      )
    ).toEqual([])
  })

  it('should run: retint cached constrained dashed packets from the current stroke fill', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]
    const cachePrefix = 'rect:test:constrained-dashed-current-fill'
    const baseStroke = {
      width: 10,
      style: 'dashed' as const,
      position: 'inside' as const,
      joinType: 'bevel' as const,
      capType: 'butt' as const,
      dashPattern: [20, 20],
      dashOffset: 0
    }

    const grayPackets = buildConstrainedDashedStrokeResolvedPackets(
      cachePrefix,
      points,
      true,
      [
        createDefaultStroke({
          ...baseStroke,
          fill: createDefaultFill({
            color: '#cccccc',
            opacity: 1,
            visible: true
          })
        })
      ]
    )
    expect(grayPackets.length).toBeGreaterThan(0)

    const redPackets = buildConstrainedDashedStrokeResolvedPackets(
      cachePrefix,
      points,
      true,
      [
        createDefaultStroke({
          ...baseStroke,
          fill: createDefaultFill({
            color: '#d90909',
            opacity: 0.5,
            visible: true
          })
        })
      ]
    )
    expect(redPackets.length).toBeGreaterThan(0)

    redPackets.forEach((packet) => {
      expect(packet.paint.color).toBe(0xd90909)
      expect(packet.paint.alpha).toBeCloseTo(0.5, 6)
      expect(packet.paint.paintKey).toBe('solid:14223625:0.5')
    })

    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      buildStrokeFinalFacesFromResolvedPackets(redPackets),
      {
        exactBackend: getGeometryBackend()
      }
    )
    expect(renderEntries.length).toBeGreaterThan(0)
    renderEntries.forEach((entry) => {
      expect(entry.stroke.color).toBe(0xd90909)
      expect(entry.stroke.alpha).toBeCloseTo(0.5, 6)
      expect(entry.stroke.paintKey).toBe('solid:14223625:0.5')
    })
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
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true &&
          packet.geometry.debugMeta?.productMode ===
            'closed-constrained-domain' &&
          packet.geometry.debugMeta?.domainMode ===
            'closed-constrained-domain' &&
          packet.geometry.debugMeta?.topologyFamily === 'self-intersecting' &&
          (packet.geometry.debugMeta?.strokePosition === 'inside' ||
            packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
              true) &&
          (packet.geometry.debugMeta?.strokePosition !== 'inside' ||
            packet.geometry.debugMeta?.productSignature?.startsWith(
              'constrained-dashed:'
            ) === true)
      )
    ).toBe(true)
  })

  it('should run: preserve join-sensitive output for inside dashed terminal intervals', () => {
    const {
      topology,
      sourcePath,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildTerminalSplitRangeFixture()
    const summaries = (['miter', 'bevel', 'round'] as const).map((joinType) => {
      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `terminal-split-range:inside-dashed-terminal-join:${joinType}`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'inside',
            joinType,
            capType: 'butt',
            dashPattern: [27, 20],
            dashOffset: 0
          })
        ],
        {
          topology,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains,
          selectedSideGuardPoints: guardPoints,
          clipInsideToFillDomain: true
        }
      )
      const terminalPackets = packets.filter((packet) => {
        const meta = packet.geometry.debugMeta
        return (
          (meta?.domainPlanSplitRangeTerminals?.length ?? 0) > 0 ||
          (meta?.dashEndpointCapPolicyTerminalRoles?.length ?? 0) > 0 ||
          meta?.domainPlanTerminalRole === 'start' ||
          meta?.domainPlanTerminalRole === 'end' ||
          meta?.domainPlanTerminalRole === 'start-end'
        )
      })
      const joinPackets = packets.filter(
        (packet) =>
          packet.geometry.debugMeta?.productSignature?.includes(
            ':join-owned:'
          ) === true &&
          (packet.geometry.debugMeta.joinOwnershipRecords?.length ?? 0) > 0
      )

      expect(
        terminalPackets.length,
        `${joinType} should keep terminal dash metadata for endpoint-cap and join ownership`
      ).toBeGreaterThan(0)
      expect(
        terminalPackets.every(
          (packet) => packet.geometry.debugMeta?.strokeJoin === joinType
        )
      ).toBe(true)

      return {
        joinType,
        area: getPacketAreaSum(packets),
        joinPacketCount: joinPackets.length,
        signature: packets
          .map((packet) =>
            [
              packet.geometry.debugMeta?.productSignature ?? '',
              packet.geometry.bounds.minX.toFixed(3),
              packet.geometry.bounds.minY.toFixed(3),
              packet.geometry.bounds.maxX.toFixed(3),
              packet.geometry.bounds.maxY.toFixed(3)
            ].join(':')
          )
          .sort()
          .join('|')
      }
    })

    expect(
      new Set(summaries.map((summary) => summary.area.toFixed(3))).size,
      JSON.stringify(summaries, null, 2)
    ).toBeGreaterThan(1)
    expect(new Set(summaries.map((summary) => summary.signature)).size).toBe(3)
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
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true &&
          packet.geometry.debugMeta?.productMode ===
            'closed-constrained-domain' &&
          packet.geometry.debugMeta?.domainMode ===
            'closed-constrained-domain' &&
          packet.geometry.debugMeta?.topologyFamily === 'self-intersecting' &&
          (packet.geometry.debugMeta?.strokePosition === 'inside' ||
            packet.geometry.debugMeta?.intervalId?.startsWith('interval:') ===
              true) &&
          ((packet.geometry.debugMeta?.strokePosition !== 'inside' &&
            packet.geometry.debugMeta?.strokePosition !== 'outside') ||
            packet.geometry.debugMeta?.productSignature?.startsWith(
              'constrained-dashed:'
            ) === true)
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
        clipInsideToFillDomain: true
      }
    )

    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true && packet.geometry.debugMeta?.strokePosition === 'inside'
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
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true &&
          packet.geometry.debugMeta?.topologyFamily ===
            'sampled-simple-closed' &&
          packet.geometry.polygons.length >= 1 &&
          packet.geometry.polygons.every((polygon) =>
            isSimpleClosedPolygon(polygon)
          )
      )
    ).toBe(true)

    expect(
      packets.flatMap((packet) =>
        packet.geometry.polygons.map((polygon) =>
          Math.abs(signedPolygonArea(polygon))
        )
      )
    ).not.toContain(0)
  })

  it('should run: allocate closed self-intersecting inside dashed intervals on the authored source path with implicit fill clipping', () => {
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

    expect(topology.topologyFamily).toBe('self-intersecting')
    expect(strokeDomainPlan).toMatchObject({
      domainMode: 'closed-constrained-domain',
      intervalDomainKind: 'domain-plan-split-range',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true
    })
    expect(strokeDomainPlan.splitRangeDomains.length).toBeGreaterThan(0)
    expect(
      strokeDomainPlan.splitRangeDomains.every(
        (domain) =>
          domain.sideResolutionStatus === 'resolved' &&
          (domain.selectedSide === 1 || domain.selectedSide === -1) &&
          domain.filledSide !== domain.unfilledSide
      )
    ).toBe(true)
    expect(strokeDomainPlan.legalBoundaryDomains).toEqual([])
    expect(intervals.length).toBeGreaterThan(0)
    expect(
      intervals.every(
        (interval) =>
          Number.isFinite(interval.startDistance) &&
          Number.isFinite(interval.endDistance) &&
          interval.intervalLength > 0 &&
          interval.intervalLength <=
            stroke.dashPattern[0] + stroke.dashPattern[1]
      ),
      JSON.stringify(
        {
          intervals: intervals.map((interval) => ({
            intervalId: interval.intervalId,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            intervalLength: interval.intervalLength,
            wrapsSeam: interval.wrapsSeam
          })),
          dashPattern: stroke.dashPattern,
          totalLength: sourcePath.totalLength
        },
        null,
        2
      )
    ).toBe(true)
    expect(
      intervals.every(
        (interval) =>
          interval.domainPlanSplitRangeId !== undefined &&
          Number.isFinite(interval.domainPlanSplitRangeStartDistance) &&
          Number.isFinite(interval.domainPlanSplitRangeEndDistance) &&
          (interval.domainPlanTerminalRole === undefined ||
            interval.domainPlanTerminalRole === 'start' ||
            interval.domainPlanTerminalRole === 'end' ||
            interval.domainPlanTerminalRole === 'start-end' ||
            interval.domainPlanTerminalRole === 'middle')
      )
    ).toBe(true)
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
        clipInsideToFillDomain: true
      }
    )
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true && packet.geometry.debugMeta?.strokePosition === 'inside'
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
        clipInsideToFillDomain: true
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend(),
      legalDomains: getInsideLegalDomainsForTest(fillRegions)
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
        polygons: packets.flatMap(getVisiblePacketProductPolygonsForTest),
        records: packets.map((packet) => {
          const debugMeta = packet.geometry.debugMeta
          const selectedSide = debugMeta?.domainPlanSelectedSide
          const sourceStart = debugMeta?.domainPlanSplitRangeStartDistance
          const sourceEnd = debugMeta?.domainPlanSplitRangeEndDistance
          const boundaryStart = debugMeta?.domainPlanBoundaryStartDistance
          const boundaryEnd = debugMeta?.domainPlanBoundaryEndDistance
          const materializedSourceSide =
            (selectedSide === 1 || selectedSide === -1) &&
            sourceStart !== undefined &&
            sourceEnd !== undefined &&
            boundaryStart !== undefined &&
            boundaryEnd !== undefined &&
            Math.abs(sourceEnd - sourceStart) > 1e-6 &&
            Math.abs(boundaryEnd - boundaryStart) > 1e-6
              ? (sourceEnd - sourceStart) * (boundaryEnd - boundaryStart) < 0
                ? (-selectedSide as 1 | -1)
                : selectedSide
              : selectedSide
          return {
            id: packet.geometry.id,
            intervalId: debugMeta?.intervalId,
            splitRangeId: debugMeta?.domainPlanSplitRangeId,
            startDistance: debugMeta?.startDistance,
            endDistance: debugMeta?.endDistance,
            splitRangeStartDistance:
              debugMeta?.domainPlanSplitRangeStartDistance,
            splitRangeEndDistance: debugMeta?.domainPlanSplitRangeEndDistance,
            boundaryStartDistance: debugMeta?.domainPlanBoundaryStartDistance,
            boundaryEndDistance: debugMeta?.domainPlanBoundaryEndDistance,
            sourceSegmentIndex:
              debugMeta?.domainPlanSplitRangeSourceSegmentIndex,
            boundaryDomainId: debugMeta?.domainPlanBoundaryDomainId,
            selectedSide,
            materializedSourceSide,
            terminalRole: debugMeta?.domainPlanTerminalRole,
            polygons: packet.geometry.polygons
          }
        })
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap(getVisibleFinalFaceProductPolygonsForTest)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap(
          getVisibleFinalFaceProductPolygonsForTest
        )
      },
      {
        label: 'export-packets',
        polygons: exportPackets.flatMap((packet) => packet.polygons)
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap(
          getVisibleRenderEntryProductPolygonsForTest
        )
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
        clipInsideToFillDomain: true
      }
    )
    expect(packets.length).toBeGreaterThan(0)
    expectInsideDashedProductFinalPacketOwnership(packets)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) === true &&
          packet.geometry.debugMeta?.topologyFamily === 'self-intersecting' &&
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
      backend: getGeometryBackend(),
      legalDomains: getInsideLegalDomainsForTest(fillRegions)
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
        polygons: packets.flatMap(getVisiblePacketProductPolygonsForTest)
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap(getVisibleFinalFaceProductPolygonsForTest)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap(
          getVisibleFinalFaceProductPolygonsForTest
        )
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap(
          getVisibleRenderEntryProductPolygonsForTest
        )
      }
    ].forEach((stage) =>
      expectInsideDashedPolygonsPreserveSplitRangeRule({
        label: `self-intersecting-mixed-star:inside:butt:${stage.label}:split-range-rule`,
        sourcePath,
        stroke,
        fillRegions,
        actualPolygons: stage.polygons,
        sourcePackets: stage.label === 'packets' ? packets : undefined,
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

  it('should run: keep inside dashed boundary terminal footprints visible through product stages on mixed segment self-intersections', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const cases = [
      {
        capType: 'butt' as const,
        splitRangeId: 'split-range:7',
        minimumArea: 5,
        referenceTerminalProbe: {
          x: 358.42320896550586,
          y: 147.14577604639922
        }
      },
      {
        capType: 'square' as const,
        splitRangeId: 'split-range:15',
        minimumArea: 5,
        referenceTerminalProbe: {
          x: 268.74578961066715,
          y: 346.50061475607663
        }
      }
    ].map((testCase) => ({ ...testCase }))

    cases.forEach(
      ({ capType, splitRangeId, minimumArea, referenceTerminalProbe }) => {
        const stroke = createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType,
          dashPattern: [27, 20],
          dashOffset: 0
        })
        const intervals = buildVisibleDashIntervalsForTest(
          sourcePath,
          stroke,
          fillRegions,
          {
            sharedSourceSplitRanges
          }
        )
        const isTargetStartTerminal = (
          terminalRole:
            | RuleDrivenDashInterval['domainPlanTerminalRole']
            | undefined
        ) => terminalRole === 'start' || terminalRole === 'start-end'
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `self-intersecting-star:inside-dashed-terminal-footprint:${capType}`,
          topology.normalizedPoints,
          true,
          [stroke],
          {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: true
          }
        )
        const unclippedPackets = buildConstrainedDashedStrokeResolvedPackets(
          `self-intersecting-star:inside-dashed-terminal-footprint-unclipped:${capType}`,
          topology.normalizedPoints,
          true,
          [stroke],
          {
            topology,
            sourcePath,
            implicitFillRegions: fillRegions,
            sharedSourceSplitRanges,
            selectedSideGuardPoints: guardPoints,
            clipInsideToFillDomain: false
          }
        )
        const packetPolygons = packets.flatMap(
          (packet) => packet.geometry.polygons
        )
        const strokeDomainPlan = resolveStrokeDomains({
          topology,
          sourceFamily: resolveSourceFamily({
            topology,
            stroke
          }),
          stroke,
          sourcePath,
          implicitFillRegions: fillRegions,
          sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains
        })
        if (
          strokeDomainPlan.intervalDomainKind === 'source-path' &&
          strokeDomainPlan.sideAuthority === 'implicit-fill-hole-domain'
        ) {
          expect(strokeDomainPlan).toMatchObject({
            domainMode: 'closed-constrained-domain',
            splitRangeDomains: [],
            legalBoundaryDomains: [],
            requiresImplicitFillHoleSideResolution: true
          })
          expect(intervals.length).toBeGreaterThan(0)
          expect(
            intervals.every(
              (interval) =>
                interval.domainPlanSplitRangeId === undefined &&
                interval.domainPlanTerminalRole === undefined
            )
          ).toBe(true)
          expect(
            packets.some(
              (packet) =>
                packet.geometry.renderDescriptor?.fillClipPolygons !==
                  undefined &&
                packet.geometry.renderDescriptor.fillClipPolygons.length > 0 &&
                packet.geometry.renderDescriptor.strokePathGroups !==
                  undefined &&
                packet.geometry.renderDescriptor.strokePathGroups.length > 0
            )
          ).toBe(true)

          const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
            packets
          ) as ArrangedStrokeFinalFace[]
          const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
            finalFaces,
            {
              backend: getGeometryBackend(),
              legalDomains: getInsideLegalDomainsForTest(fillRegions)
            }
          )
          const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
            collapsedFaces,
            {
              exactBackend: getGeometryBackend()
            }
          )
          ;[
            {
              label: 'packets',
              polygons: packets.flatMap(getVisiblePacketProductPolygonsForTest)
            },
            {
              label: 'final-faces',
              polygons: finalFaces.flatMap(
                getVisibleFinalFaceProductPolygonsForTest
              )
            },
            {
              label: 'collapsed-faces',
              polygons: collapsedFaces.flatMap(
                getVisibleFinalFaceProductPolygonsForTest
              )
            },
            {
              label: 'render-entries',
              polygons: renderEntries.flatMap(
                getVisibleRenderEntryProductPolygonsForTest
              )
            }
          ].forEach((stage) => {
            expect(
              stage.polygons.length,
              JSON.stringify({ capType, stage: stage.label }, null, 2)
            ).toBeGreaterThan(0)
            expectInsideDashedPolygonsPreserveSplitRangeRule({
              label: `self-intersecting-star:inside-dashed-source-path-descriptor:${capType}:${stage.label}`,
              sourcePath,
              stroke,
              fillRegions,
              actualPolygons: stage.polygons,
              domainOptions: {
                sharedSourceSplitRanges,
                sharedStrokeBoundaryDomains
              }
            })
            expect(
              getSamePaintOverlapAreaForTest(stage.polygons),
              JSON.stringify({ capType, stage: stage.label }, null, 2)
            ).toBeLessThanOrEqual(stroke.width * stroke.width * 0.08)
          })
          return
        }
        const targetIntervalFromId = intervals.find(
          (interval) =>
            interval.domainPlanSplitRangeId === splitRangeId &&
            isTargetStartTerminal(interval.domainPlanTerminalRole)
        )
        const targetInterval =
          targetIntervalFromId ??
          intervals
            .filter((interval) =>
              isTargetStartTerminal(interval.domainPlanTerminalRole)
            )
            .map((interval) => ({
              interval,
              probe: getRuleDrivenLegalTerminalFootprintProbe({
                sourcePath,
                interval,
                stroke,
                implicitFillRegions: fillRegions
              })
            }))
            .filter(
              (
                entry
              ): entry is {
                interval: RuleDrivenDashInterval
                probe: { x: number; y: number }
              } => entry.probe !== null
            )
            .filter((entry) =>
              isPointCoveredByPolygons(entry.probe, packetPolygons, 0.75)
            )
            .sort(
              (left, right) =>
                pointDistance(left.probe, referenceTerminalProbe) -
                pointDistance(right.probe, referenceTerminalProbe)
            )[0]?.interval
        const resolvedSplitRangeId =
          targetInterval?.domainPlanSplitRangeId ?? splitRangeId
        expect(
          targetInterval,
          JSON.stringify(
            {
              capType,
              splitRangeId,
              resolvedSplitRangeId,
              intervals: intervals
                .filter(
                  (interval) =>
                    interval.domainPlanSplitRangeId === resolvedSplitRangeId
                )
                .map((interval) => ({
                  index: interval.index,
                  terminalRole: interval.domainPlanTerminalRole,
                  selectedSide: interval.domainPlanSelectedSide,
                  boundaryRole: interval.domainPlanBoundaryRole,
                  boundaryPointCount: interval.domainPlanBoundaryPoints?.length,
                  boundaryLength: interval.domainPlanBoundaryTotalLength,
                  startDistance: interval.startDistance,
                  endDistance: interval.endDistance
                }))
            },
            null,
            2
          )
        ).toBeDefined()
        const expectedProbe = targetInterval
          ? getRuleDrivenLegalTerminalFootprintProbe({
              sourcePath,
              interval: targetInterval,
              stroke,
              implicitFillRegions: fillRegions
            })
          : null
        expect(
          expectedProbe,
          JSON.stringify(
            {
              capType,
              splitRangeId,
              resolvedSplitRangeId,
              referenceTerminalProbe,
              referenceTerminalProbeInFillRegion: isPointCoveredByPolygons(
                referenceTerminalProbe,
                fillRegions.flatMap((region) => region.polygons),
                0.75
              ),
              targetInterval
            },
            null,
            2
          )
        ).not.toBeNull()
        const terminalProbe = expectedProbe as { x: number; y: number }
        const targetBoundaryFaceKey =
          getRuleDrivenBoundaryDomainFaceKeyForDebug(
            targetInterval?.domainPlanBoundaryDomainId
          )
        const targetPackets = packets.filter((packet) =>
          [
            ...(packet.geometry.debugMeta?.dashProductIntervals ?? []),
            ...(packet.geometry.debugMeta?.domainPlanSplitRangeTerminals ?? []),
            {
              intervalId: packet.geometry.debugMeta?.intervalId,
              splitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
              terminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole
            }
          ].some(
            (interval) =>
              interval.splitRangeId === resolvedSplitRangeId &&
              isTargetStartTerminal(interval.terminalRole)
          )
        )
        expect(
          targetPackets.length,
          JSON.stringify(
            {
              capType,
              splitRangeId,
              resolvedSplitRangeId,
              packets: packets
                .filter((packet) => {
                  const meta = packet.geometry.debugMeta
                  return [
                    ...(meta?.domainPlanSplitRangeIds ?? []),
                    ...(meta?.dashProductIntervals ?? []).map(
                      (interval) => interval.splitRangeId
                    ),
                    ...(meta?.domainPlanSplitRangeTerminals ?? []).map(
                      (terminal) => terminal.splitRangeId
                    ),
                    meta?.domainPlanSplitRangeId
                  ].includes(resolvedSplitRangeId)
                })
                .map((packet) => ({
                  intervalId: packet.geometry.debugMeta?.intervalId,
                  terminalRole:
                    packet.geometry.debugMeta?.domainPlanTerminalRole,
                  area: Math.round(getPacketAreaSum([packet]) * 1000) / 1000,
                  rawProductArea:
                    packet.geometry.debugMeta?.rawProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.rawProductArea * 1000
                        ) / 1000,
                  cleanedProductArea:
                    packet.geometry.debugMeta?.cleanedProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.cleanedProductArea * 1000
                        ) / 1000,
                  boundaryClippedProductArea:
                    packet.geometry.debugMeta?.boundaryClippedProductArea ===
                    undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.boundaryClippedProductArea *
                            1000
                        ) / 1000,
                  finalProductArea:
                    packet.geometry.debugMeta?.finalProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.finalProductArea * 1000
                        ) / 1000,
                  polygonCount: packet.geometry.polygons.length
                }))
            },
            null,
            2
          )
        ).toBeGreaterThan(0)
        const targetIntervalId =
          targetInterval?.intervalId ??
          targetPackets[0]?.geometry.debugMeta?.intervalId
        const targetIntervalIndex = Number(
          targetIntervalId?.replace('interval:', '')
        )
        expect(Number.isFinite(targetIntervalIndex)).toBe(true)

        const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
          packets
        ) as ArrangedStrokeFinalFace[]
        const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
          finalFaces,
          {
            backend: getGeometryBackend(),
            legalDomains: getInsideLegalDomainsForTest(fillRegions)
          }
        )
        const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
          collapsedFaces,
          {
            exactBackend: getGeometryBackend()
          }
        )
        const stages = [
          {
            label: 'packets',
            area: getPacketAreaSum(targetPackets)
          },
          {
            label: 'final-faces',
            area: getStageIntervalArea(
              toFinalFaceIntervalGeometryRecords(finalFaces),
              targetIntervalIndex
            )
          },
          {
            label: 'collapsed-faces',
            area: getStageIntervalArea(
              toFinalFaceIntervalGeometryRecords(collapsedFaces),
              targetIntervalIndex
            )
          },
          {
            label: 'render-entries',
            area: getStageIntervalArea(
              toRenderEntryIntervalGeometryRecords(renderEntries),
              targetIntervalIndex
            )
          }
        ]

        stages.forEach((stage) => {
          expect(
            stage.area,
            JSON.stringify(
              {
                capType,
                splitRangeId,
                targetIntervalId,
                stage: stage.label,
                packetAreas: targetPackets.map((packet) => ({
                  area: Math.round(getPacketAreaSum([packet]) * 1000) / 1000,
                  rawProductArea:
                    packet.geometry.debugMeta?.rawProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.rawProductArea * 1000
                        ) / 1000,
                  cleanedProductArea:
                    packet.geometry.debugMeta?.cleanedProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.cleanedProductArea * 1000
                        ) / 1000,
                  boundaryClippedProductArea:
                    packet.geometry.debugMeta?.boundaryClippedProductArea ===
                    undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.boundaryClippedProductArea *
                            1000
                        ) / 1000,
                  finalProductArea:
                    packet.geometry.debugMeta?.finalProductArea === undefined
                      ? undefined
                      : Math.round(
                          packet.geometry.debugMeta.finalProductArea * 1000
                        ) / 1000
                }))
              },
              null,
              2
            )
          ).toBeGreaterThanOrEqual(minimumArea)
        })

        const stageGeometry = [
          {
            label: 'packets',
            polygons: targetPackets.flatMap(
              (packet) => packet.geometry.polygons
            )
          },
          {
            label: 'final-faces',
            polygons: getRuleDrivenIntervalGeometryPolygons(
              toFinalFaceIntervalGeometryRecords(finalFaces),
              targetIntervalIndex
            )
          },
          {
            label: 'collapsed-faces',
            polygons: getRuleDrivenIntervalGeometryPolygons(
              toFinalFaceIntervalGeometryRecords(collapsedFaces),
              targetIntervalIndex
            )
          },
          {
            label: 'render-entries',
            polygons: getRuleDrivenIntervalGeometryPolygons(
              toRenderEntryIntervalGeometryRecords(renderEntries),
              targetIntervalIndex
            )
          }
        ]
        stageGeometry.forEach((stage) => {
          expect(
            isPointCoveredByPolygons(terminalProbe, stage.polygons, 0.75),
            JSON.stringify(
              {
                capType,
                splitRangeId,
                targetIntervalId,
                stage: stage.label,
                expectedProbe,
                referenceTerminalProbe,
                referenceTerminalProbeInFillRegion: isPointCoveredByPolygons(
                  referenceTerminalProbe,
                  fillRegions.flatMap((region) => region.polygons),
                  0.75
                ),
                targetIntervalSummary: targetInterval
                  ? getRuleDrivenIntervalTerminalDebug(targetInterval)
                  : undefined,
                splitRangeIntervalSummaries: intervals
                  .filter(
                    (interval) =>
                      interval.domainPlanSplitRangeId === splitRangeId ||
                      (targetBoundaryFaceKey !== undefined &&
                        getRuleDrivenBoundaryDomainFaceKeyForDebug(
                          interval.domainPlanBoundaryDomainId
                        ) === targetBoundaryFaceKey)
                  )
                  .filter(
                    (interval) =>
                      interval.domainPlanTerminalRole === 'start' ||
                      interval.domainPlanTerminalRole === 'end' ||
                      interval.domainPlanTerminalRole === 'start-end'
                  )
                  .map(getRuleDrivenIntervalTerminalDebug),
                targetDebugMeta: targetPackets.map((packet) => ({
                  intervalId: packet.geometry.debugMeta?.intervalId,
                  terminalRole:
                    packet.geometry.debugMeta?.domainPlanTerminalRole,
                  splitRangeId:
                    packet.geometry.debugMeta?.domainPlanSplitRangeId,
                  selectedSide:
                    packet.geometry.debugMeta?.domainPlanSelectedSide,
                  filledSide: packet.geometry.debugMeta?.domainPlanFilledSide,
                  unfilledSide:
                    packet.geometry.debugMeta?.domainPlanUnfilledSide,
                  sideResolutionStatus:
                    packet.geometry.debugMeta?.domainPlanSideResolutionStatus,
                  sideResolutionReason:
                    packet.geometry.debugMeta?.domainPlanSideResolutionReason,
                  boundaryDomainId:
                    packet.geometry.debugMeta?.domainPlanBoundaryDomainId,
                  joinOwnershipSignature:
                    packet.geometry.debugMeta?.joinOwnershipSignature,
                  joinOwnershipRecords:
                    packet.geometry.debugMeta?.joinOwnershipRecords?.map(
                      (record) => ({
                        kind: record.kind,
                        area: Math.round(record.area * 1000) / 1000,
                        bounds: {
                          minX: Math.round(record.bounds.minX * 1000) / 1000,
                          minY: Math.round(record.bounds.minY * 1000) / 1000,
                          maxX: Math.round(record.bounds.maxX * 1000) / 1000,
                          maxY: Math.round(record.bounds.maxY * 1000) / 1000
                        }
                      })
                    )
                })),
                expectedProbeInFillRegion: isPointCoveredByPolygons(
                  terminalProbe,
                  fillRegions.flatMap((region) => region.polygons),
                  0.75
                ),
                splitRangePackets: packets
                  .filter(
                    (packet) =>
                      packet.geometry.debugMeta?.domainPlanSplitRangeId ===
                      splitRangeId
                  )
                  .map((packet) => ({
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    terminalRole:
                      packet.geometry.debugMeta?.domainPlanTerminalRole,
                    area: Math.round(getPacketAreaSum([packet]) * 1000) / 1000,
                    coversProbe: isPointCoveredByPolygons(
                      terminalProbe,
                      packet.geometry.polygons,
                      0.75
                    ),
                    joinOwnershipSignature:
                      packet.geometry.debugMeta?.joinOwnershipSignature,
                    bounds: packet.geometry.polygons.map((polygon) => ({
                      minX: Math.min(...polygon.map((point) => point.x)),
                      minY: Math.min(...polygon.map((point) => point.y)),
                      maxX: Math.max(...polygon.map((point) => point.x)),
                      maxY: Math.max(...polygon.map((point) => point.y))
                    }))
                  })),
                nearbyPackets: packets
                  .filter((packet) =>
                    packet.geometry.polygons.some((polygon) => {
                      const minX = Math.min(...polygon.map((point) => point.x))
                      const minY = Math.min(...polygon.map((point) => point.y))
                      const maxX = Math.max(...polygon.map((point) => point.x))
                      const maxY = Math.max(...polygon.map((point) => point.y))
                      return (
                        terminalProbe.x >= minX - 8 &&
                        terminalProbe.x <= maxX + 8 &&
                        terminalProbe.y >= minY - 8 &&
                        terminalProbe.y <= maxY + 8
                      )
                    })
                  )
                  .map((packet) => ({
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    terminalRole:
                      packet.geometry.debugMeta?.domainPlanTerminalRole,
                    splitRangeId:
                      packet.geometry.debugMeta?.domainPlanSplitRangeId,
                    boundaryDomainId:
                      packet.geometry.debugMeta?.domainPlanBoundaryDomainId,
                    area: Math.round(getPacketAreaSum([packet]) * 1000) / 1000,
                    coversProbe: isPointCoveredByPolygons(
                      terminalProbe,
                      packet.geometry.polygons,
                      0.75
                    ),
                    joinOwnershipSignature:
                      packet.geometry.debugMeta?.joinOwnershipSignature,
                    bounds: packet.geometry.polygons.map((polygon) => ({
                      minX: Math.min(...polygon.map((point) => point.x)),
                      minY: Math.min(...polygon.map((point) => point.y)),
                      maxX: Math.max(...polygon.map((point) => point.x)),
                      maxY: Math.max(...polygon.map((point) => point.y))
                    }))
                  })),
                unclippedNearbyPackets: unclippedPackets
                  .filter((packet) =>
                    packet.geometry.polygons.some((polygon) => {
                      const minX = Math.min(...polygon.map((point) => point.x))
                      const minY = Math.min(...polygon.map((point) => point.y))
                      const maxX = Math.max(...polygon.map((point) => point.x))
                      const maxY = Math.max(...polygon.map((point) => point.y))
                      return (
                        terminalProbe.x >= minX - 8 &&
                        terminalProbe.x <= maxX + 8 &&
                        terminalProbe.y >= minY - 8 &&
                        terminalProbe.y <= maxY + 8
                      )
                    })
                  )
                  .map((packet) => ({
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    terminalRole:
                      packet.geometry.debugMeta?.domainPlanTerminalRole,
                    splitRangeId:
                      packet.geometry.debugMeta?.domainPlanSplitRangeId,
                    area: Math.round(getPacketAreaSum([packet]) * 1000) / 1000,
                    coversProbe: isPointCoveredByPolygons(
                      terminalProbe,
                      packet.geometry.polygons,
                      0.75
                    ),
                    bounds: packet.geometry.polygons.map((polygon) => ({
                      minX: Math.min(...polygon.map((point) => point.x)),
                      minY: Math.min(...polygon.map((point) => point.y)),
                      maxX: Math.max(...polygon.map((point) => point.x)),
                      maxY: Math.max(...polygon.map((point) => point.y))
                    }))
                  })),
                bounds: stage.polygons.map((polygon) => ({
                  minX: Math.min(...polygon.map((point) => point.x)),
                  minY: Math.min(...polygon.map((point) => point.y)),
                  maxX: Math.max(...polygon.map((point) => point.x)),
                  maxY: Math.max(...polygon.map((point) => point.y))
                })),
                polygons: stage.polygons.map((polygon) =>
                  polygon.map((point) => ({
                    x: Math.round(point.x * 1000) / 1000,
                    y: Math.round(point.y * 1000) / 1000
                  }))
                )
              },
              null,
              2
            )
          ).toBe(true)
        })
      }
    )
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
        clipInsideToFillDomain: true
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend(),
      legalDomains: getInsideLegalDomainsForTest(fillRegions)
    })
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    const packetIntervalRecords = toPacketIntervalGeometryRecords(packets)
    const finalFaceIntervalRecords =
      toFinalFaceIntervalGeometryRecords(finalFaces)
    const collapsedFaceIntervalRecords =
      toFinalFaceIntervalGeometryRecords(collapsedFaces)
    const renderEntryIntervalRecords =
      toRenderEntryIntervalGeometryRecords(renderEntries)
    const stages = [
      {
        label: 'packets',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: packetIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'final-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: finalFaceIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'collapsed-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: collapsedFaceIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'render-entries',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: renderEntryIntervalRecords,
            intervals,
            splitRangeId
          })
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

  it('should run: preserve inside round-join split-range gaps through render projection', () => {
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
      joinType: 'round',
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
      'self-intersecting-mixed-star:inside:round-join:gap-preservation',
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
        clipInsideToFillDomain: true
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend(),
      legalDomains: getInsideLegalDomainsForTest(fillRegions)
    })
    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      collapsedFaces,
      {
        exactBackend: getGeometryBackend()
      }
    )
    const packetIntervalRecords = toPacketIntervalGeometryRecords(packets)
    const finalFaceIntervalRecords =
      toFinalFaceIntervalGeometryRecords(finalFaces)
    const collapsedFaceIntervalRecords =
      toFinalFaceIntervalGeometryRecords(collapsedFaces)
    const renderEntryIntervalRecords =
      toRenderEntryIntervalGeometryRecords(renderEntries)
    const stages = [
      {
        label: 'packets',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: packetIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'final-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: finalFaceIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'collapsed-faces',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: collapsedFaceIntervalRecords,
            intervals,
            splitRangeId
          })
      },
      {
        label: 'render-entries',
        getPolygonsForSplitRange: (splitRangeId: string) =>
          getRuleDrivenSplitRangeGeometryPolygons({
            records: renderEntryIntervalRecords,
            intervals,
            splitRangeId
          })
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
        coverageTolerance: 1
      })
    )

    expect(
      failures.slice(0, 30),
      JSON.stringify(
        {
          message:
            'inside round-join dashed products must preserve domain-plan gaps through packet, FinalFace, collapse, and render-entry projection',
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
        clipInsideToFillDomain: true
      }
    )
    expectInsideDashedProductFinalPacketOwnership(packets)
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
      packets
    ) as ArrangedStrokeFinalFace[]
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(finalFaces, {
      backend: getGeometryBackend(),
      legalDomains: getInsideLegalDomainsForTest(fillRegions)
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
        polygons: packets.flatMap(getVisiblePacketProductPolygonsForTest)
      },
      {
        label: 'final-faces',
        polygons: finalFaces.flatMap(getVisibleFinalFaceProductPolygonsForTest)
      },
      {
        label: 'collapsed-faces',
        polygons: collapsedFaces.flatMap(
          getVisibleFinalFaceProductPolygonsForTest
        )
      },
      {
        label: 'render-entries',
        polygons: renderEntries.flatMap(
          getVisibleRenderEntryProductPolygonsForTest
        )
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
          clipInsideToFillDomain: true
        }
      )

      expect(
        packets.every(
          (packet) =>
            packet.geometry.debugMeta?.topologyFamily === 'self-intersecting'
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
        backend: getGeometryBackend(),
        legalDomains: getInsideLegalDomainsForTest(fillRegions)
      })
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(collapsedFaces)
      const productPolygons = getRuleDrivenProductPolygons({
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
          polygons: packets.flatMap(getVisiblePacketProductPolygonsForTest)
        },
        {
          label: 'final-faces',
          polygons: finalFaces.flatMap(
            getVisibleFinalFaceProductPolygonsForTest
          )
        },
        {
          label: 'collapsed-faces',
          polygons: collapsedFaces.flatMap(
            getVisibleFinalFaceProductPolygonsForTest
          )
        },
        {
          label: 'render-entries',
          polygons: renderEntries.flatMap(
            getVisibleRenderEntryProductPolygonsForTest
          )
        },
        {
          label: `product:${productPolygons.source}`,
          polygons: productPolygons.polygons
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
          clipInsideToFillDomain: true
        }
      )
      const getPacketIntervalContracts = (packet: (typeof packets)[number]) => {
        const meta = packet.geometry.debugMeta
        return [
          ...(meta?.dashProductIntervals ?? []),
          ...(meta?.domainPlanSplitRangeTerminals ?? []),
          {
            sourceSegmentIndex: meta?.domainPlanSplitRangeSourceSegmentIndex,
            terminalRole: meta?.domainPlanTerminalRole,
            boundaryRole: meta?.domainPlanBoundaryRole
          }
        ]
      }
      const hasOutsideSegment3Contract = (packet: (typeof packets)[number]) =>
        getPacketIntervalContracts(packet).some(
          (contract) =>
            contract.sourceSegmentIndex === 3 &&
            contract.boundaryRole === 'outer'
        )
      const hasOutsideSegment3StartTerminal = (
        packet: (typeof packets)[number]
      ) =>
        getPacketIntervalContracts(packet).some(
          (contract) =>
            contract.sourceSegmentIndex === 3 &&
            contract.boundaryRole === 'outer' &&
            (contract.terminalRole === 'start' ||
              contract.terminalRole === 'start-end')
        )
      const firstOutsidePacket = packets.find(hasOutsideSegment3StartTerminal)
      const sourceSegmentPackets = packets.filter(hasOutsideSegment3Contract)

      if (capType === 'square') {
        expect(
          sourceSegmentPackets.length,
          JSON.stringify(
            {
              capType,
              packets: packets.map((packet) => ({
                geometryId: packet.geometry.geometryId,
                intervalId: packet.geometry.debugMeta?.intervalId,
                intervalIds: packet.geometry.debugMeta?.intervalIds,
                dashProductIntervals:
                  packet.geometry.debugMeta?.dashProductIntervals,
                terminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole,
                boundaryRole: packet.geometry.debugMeta?.domainPlanBoundaryRole,
                splitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
                splitRangeSourceSegmentIndex:
                  packet.geometry.debugMeta
                    ?.domainPlanSplitRangeSourceSegmentIndex,
                polygonCount: packet.geometry.polygons.length
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
                intervalIds: packet.geometry.debugMeta?.intervalIds,
                dashProductIntervals:
                  packet.geometry.debugMeta?.dashProductIntervals,
                terminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole,
                boundaryRole: packet.geometry.debugMeta?.domainPlanBoundaryRole,
                splitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
                splitRangeSourceSegmentIndex:
                  packet.geometry.debugMeta
                    ?.domainPlanSplitRangeSourceSegmentIndex,
                polygonCount: packet.geometry.polygons.length
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
