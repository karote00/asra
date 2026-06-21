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
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  type SolidCenterStrokeGeometryDebugMeta
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

const getSignedPolygonArea = (polygon: { x: number; y: number }[]) =>
  polygon.reduce((total, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return total + point.x * next.y - next.x * point.y
  }, 0) / 2

const getPacketGeometrySummary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) => {
  const polygons = packets.flatMap((packet) => packet.geometry.polygons)
  const bounds = getPointBounds(polygons.flat())
  return {
    packetCount: packets.length,
    polygonCount: polygons.length,
    totalArea:
      Math.round(
        polygons.reduce(
          (total, polygon) => total + Math.abs(getSignedPolygonArea(polygon)),
          0
        ) * 1000
      ) / 1000,
    bounds: {
      minX: Math.round(bounds.minX * 1000) / 1000,
      minY: Math.round(bounds.minY * 1000) / 1000,
      maxX: Math.round(bounds.maxX * 1000) / 1000,
      maxY: Math.round(bounds.maxY * 1000) / 1000
    }
  }
}

const getPacketProductContractSummary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  packets.map((packet) => ({
    intervalId: packet.geometry.debugMeta?.intervalId,
    domainPlanDomainMode: packet.geometry.debugMeta?.domainPlanDomainMode,
    domainPlanSplitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
    domainPlanTerminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole,
    dashEndpointCapPolicySignature:
      packet.geometry.debugMeta?.dashEndpointCapPolicySignature,
    joinOwnershipSignature: packet.geometry.debugMeta?.joinOwnershipSignature,
    smoothContinuityGroupId: packet.geometry.debugMeta?.smoothContinuityGroupId
  }))

const getPacketRenderDescriptorCompletenessSummary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  packets.map((packet) => ({
    intervalId: packet.geometry.debugMeta?.intervalId,
    hasRenderDescriptor: packet.geometry.renderDescriptor !== undefined,
    strokePathCount: getRuleDrivenDescriptorStrokePaths(
      packet.geometry.renderDescriptor
    ).length,
    maskPolygonCount:
      packet.geometry.renderDescriptor?.strokeMaskPolygons?.length ?? 0,
    clipPolygonCount:
      packet.geometry.renderDescriptor?.clipPolygons?.length ?? 0
  }))

const getPacketFormalProductGeometrySummary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  packets.map((packet) => {
    const polygons = getPacketProductPolygons(packet)
    const bounds = getPointBounds(polygons.flat())
    return {
      intervalId: packet.geometry.debugMeta?.intervalId,
      polygonCount: polygons.length,
      area:
        Math.round(
          polygons.reduce(
            (total, polygon) => total + Math.abs(getSignedPolygonArea(polygon)),
            0
          ) * 1000
        ) / 1000,
      bounds: {
        minX: Math.round(bounds.minX * 1000) / 1000,
        minY: Math.round(bounds.minY * 1000) / 1000,
        maxX: Math.round(bounds.maxX * 1000) / 1000,
        maxY: Math.round(bounds.maxY * 1000) / 1000
      },
      dashEndpointCapPolicySignature:
        packet.geometry.debugMeta?.dashEndpointCapPolicySignature,
      joinOwnershipSignature: packet.geometry.debugMeta?.joinOwnershipSignature,
      smoothContinuityGroupId:
        packet.geometry.debugMeta?.smoothContinuityGroupId
    }
  })

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

const isPointVisibleThroughClipPolygons = (
  point: { x: number; y: number },
  clipPolygons: { x: number; y: number }[][] | undefined
) => {
  if (!clipPolygons || clipPolygons.length === 0) {
    return true
  }

  const positiveClipPolygons = clipPolygons.filter(
    (polygon) => signedPolygonArea(polygon) >= 0
  )
  const negativeClipPolygons = clipPolygons.filter(
    (polygon) => signedPolygonArea(polygon) < 0
  )
  const insidePositive =
    positiveClipPolygons.length === 0 ||
    isPointCoveredByPolygons(point, positiveClipPolygons, 0.02)
  const insideNegative = isPointCoveredByPolygons(
    point,
    negativeClipPolygons,
    0.02
  )

  return insidePositive && !insideNegative
}

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

const getDebugMetaTerminalContracts = (
  meta?: SolidCenterStrokeGeometryDebugMeta | null
) => {
  const contracts: {
    splitRangeId?: string
    terminalRole?: 'start' | 'end' | 'start-end' | 'middle'
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  }[] = []

  ;(meta?.dashProductIntervals ?? []).forEach((interval) => {
    contracts.push({
      splitRangeId: interval.splitRangeId,
      terminalRole: interval.terminalRole,
      boundaryRole: interval.boundaryRole
    })
  })
  ;(meta?.domainPlanSplitRangeTerminals ?? []).forEach((terminal) => {
    contracts.push({
      splitRangeId: terminal.splitRangeId,
      terminalRole: terminal.terminalRole,
      boundaryRole: terminal.boundaryRole
    })
  })
  contracts.push({
    splitRangeId: meta?.domainPlanSplitRangeId,
    terminalRole: meta?.domainPlanTerminalRole,
    boundaryRole: meta?.domainPlanBoundaryRole
  })

  return contracts
}

const getDebugMetaIntervalIds = (
  meta?: SolidCenterStrokeGeometryDebugMeta | null
) => [
  ...(meta?.intervalIds ?? []),
  ...(meta?.dashProductIntervals?.map((interval) => interval.intervalId) ?? []),
  ...(meta?.intervalId ? [meta.intervalId] : [])
]

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
  strokePaths?: { x: number; y: number }[][]
}

type RuleDrivenRenderDescriptor = NonNullable<
  ReturnType<
    typeof buildConstrainedDashedStrokeResolvedPackets
  >[number]['geometry']['renderDescriptor']
>

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

const getExactIntersectionPolygonsForDescriptorTest = (
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

const buildRenderStrokePathPolygonsForDescriptorTest = (
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
  const strokePathPolygons = buildRenderStrokePathPolygonsForDescriptorTest(
    descriptor.strokePaths ?? [],
    descriptor.strokePathStyle
  )
  const strokePathGroupPolygons =
    descriptor.strokePathGroups?.flatMap((group) => {
      const groupPolygons = buildRenderStrokePathPolygonsForDescriptorTest(
        group.strokePaths ?? [],
        group.strokePathStyle ?? descriptor.strokePathStyle
      )
      return group.clipPolygons && group.clipPolygons.length > 0
        ? getExactIntersectionPolygonsForDescriptorTest(
            groupPolygons,
            group.clipPolygons
          )
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
  if (descriptor.clipPolygons && descriptor.clipPolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForDescriptorTest(
      visiblePolygons,
      descriptor.clipPolygons
    )
  }
  if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForDescriptorTest(
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

const getRuleDrivenDescriptorProductPolygons = (
  descriptor: RuleDrivenRenderDescriptor | undefined,
  productPolygons: { x: number; y: number }[][] = []
) => {
  if (!descriptor) {
    return []
  }

  return getVisibleStrokePolygonsFromDescriptorForTest(
    descriptor,
    productPolygons
  )
}

const getRuleDrivenDescriptorStrokePaths = (
  descriptor: RuleDrivenRenderDescriptor | undefined
) => [
  ...(descriptor?.strokePaths ?? []),
  ...(descriptor?.strokePathGroups?.flatMap((group) => group.strokePaths) ?? [])
]

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
    polygons: packet.geometry.renderDescriptor
      ? getRuleDrivenDescriptorProductPolygons(
          packet.geometry.renderDescriptor,
          packet.geometry.polygons
        )
      : packet.geometry.polygons,
    strokePaths: getRuleDrivenDescriptorStrokePaths(
      packet.geometry.renderDescriptor
    )
  }))

const toFinalFaceIntervalGeometryRecords = (
  faces: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>
): RuleDrivenIntervalGeometryRecord[] =>
  faces.map((face) => ({
    intervalIds:
      face.debugMeta?.intervalIds ??
      (face.debugMeta?.intervalId ? [face.debugMeta.intervalId] : []),
    polygons: face.renderDescriptor
      ? getRuleDrivenDescriptorProductPolygons(
          face.renderDescriptor,
          face.polygons
        )
      : face.polygons,
    strokePaths: getRuleDrivenDescriptorStrokePaths(face.renderDescriptor)
  }))

const getPacketProductPolygons = (
  packet: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>[number]
) =>
  packet.geometry.renderDescriptor
    ? getRuleDrivenDescriptorProductPolygons(
        packet.geometry.renderDescriptor,
        packet.geometry.polygons
      )
    : packet.geometry.polygons

const getPacketProductStrokePaths = (
  packet: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>[number]
) => getRuleDrivenDescriptorStrokePaths(packet.geometry.renderDescriptor)

const getFinalFaceProductPolygons = (
  face: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>[number]
) =>
  face.renderDescriptor
    ? getRuleDrivenDescriptorProductPolygons(
        face.renderDescriptor,
        face.polygons
      )
    : face.polygons

const getFinalFaceProductStrokePaths = (
  face: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>[number]
) => getRuleDrivenDescriptorStrokePaths(face.renderDescriptor)

const getRenderEntryProductPolygons = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) =>
  getVisibleStrokePolygonsFromDescriptorForTest(
    entry as RenderEntrySourceMaskForTest,
    entry.polygons
  )

const getRenderEntryProductStrokePaths = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) => [
  ...(entry.strokePaths ?? []),
  ...(entry.strokePathGroups?.flatMap((group) => group.strokePaths) ?? [])
]

const getRenderEntryProductClipPolygons = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) => [
  ...(entry.clipPolygons ?? []),
  ...(entry.strokePathGroups?.flatMap((group) => group.clipPolygons ?? []) ??
    [])
]

const hasLocalProductCoverage = (
  polygons: { x: number; y: number }[][],
  strokePaths: { x: number; y: number }[][],
  point: { x: number; y: number },
  radius: number
) =>
  polygons.some((polygon) =>
    polygon.some((polygonPoint) => pointDistance(polygonPoint, point) <= radius)
  ) ||
  strokePaths.some((path) =>
    path.some((pathPoint) => pointDistance(pathPoint, point) <= radius)
  )

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
  const intervalId = `interval:${interval.index}`
  const intervalStrokePaths =
    records
      ?.filter((record) => record.intervalIds.includes(intervalId))
      .flatMap((record) => record.strokePaths ?? []) ?? []
  if (intervalStrokePaths.some((path) => path.length >= 2)) {
    return true
  }
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
            domainPlanSelectedSide: interval.domainPlanSelectedSide,
            domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
            domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints,
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

const buildSelfCheckClosedStarFixture = () => {
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
    modelId: 'tn-4:self-check-resolved-geometry',
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

describe('constrained dashed stroke packets: outside high-curvature domains', () => {
  it('should run: keep outside self-intersecting boundary endpoints on one terminal cap policy with explicit join and smooth ownership', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()

    const buildPackets = (
      capType: 'butt' | 'square' | 'round',
      joinType: 'miter' | 'bevel' | 'round'
    ) =>
      buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${joinType}-${capType}-join`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'outside',
            joinType,
            capType,
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

    const getSquareTerminalFootprintFailures = (
      stage: string,
      polygons: { x: number; y: number }[][],
      terminalPackets: ReturnType<
        typeof buildConstrainedDashedStrokeResolvedPackets
      >
    ) =>
      terminalPackets.flatMap((packet) => {
        const debugMeta = packet.geometry.debugMeta
        const role = debugMeta?.domainPlanTerminalRole
        const boundaryPoints = debugMeta?.domainPlanBoundaryPoints
        const selectedSide = debugMeta?.domainPlanSelectedSide
        if (
          debugMeta?.strokePosition !== 'outside' ||
          (role !== 'start' && role !== 'end' && role !== 'start-end') ||
          !boundaryPoints ||
          boundaryPoints.length < 2 ||
          (selectedSide !== 1 && selectedSide !== -1)
        ) {
          return []
        }

        const buildEdgeProbe = (edge: 'start' | 'end') => {
          const endpoint =
            edge === 'start'
              ? boundaryPoints[0]
              : boundaryPoints[boundaryPoints.length - 1]
          const adjacent =
            edge === 'start'
              ? boundaryPoints[1]
              : boundaryPoints[boundaryPoints.length - 2]
          if (!endpoint || !adjacent) {
            return null
          }
          const tangent = normalizeVector(
            edge === 'start'
              ? {
                  x: adjacent.x - endpoint.x,
                  y: adjacent.y - endpoint.y
                }
              : {
                  x: endpoint.x - adjacent.x,
                  y: endpoint.y - adjacent.y
                }
          )
          if (!tangent) {
            return null
          }
          const normal = {
            x: -tangent.y * selectedSide,
            y: tangent.x * selectedSide
          }
          const alongOffsets =
            edge === 'start' ? [-4, -2, 1.5, 4] : [4, 2, -1.5, -4]
          const normalOffsets = [2, 5, 8]
          const probes = alongOffsets.flatMap((alongOffset) =>
            normalOffsets.map((normalOffset) => ({
              x: endpoint.x + tangent.x * alongOffset + normal.x * normalOffset,
              y: endpoint.y + tangent.y * alongOffset + normal.y * normalOffset,
              alongOffset,
              normalOffset
            }))
          )
          const covered = probes.filter((probe) =>
            isPointCoveredByPolygons(probe, polygons, 0.75)
          )
          const coveredNormalOffsets = new Set(
            covered.map((probe) => probe.normalOffset)
          )
          const coveredCapProbes = covered.filter((probe) =>
            edge === 'start' ? probe.alongOffset < 0 : probe.alongOffset > 0
          )
          const coveredBodyProbes = covered.filter((probe) =>
            edge === 'start' ? probe.alongOffset > 0 : probe.alongOffset < 0
          )
          const coveredBodyNormalOffsets = new Set(
            coveredBodyProbes.map((probe) => probe.normalOffset)
          )
          return {
            edge,
            endpoint,
            coveredCount: covered.length,
            probeCount: probes.length,
            coveredNormalOffsetCount: coveredNormalOffsets.size,
            coveredCapProbeCount: coveredCapProbes.length,
            coveredBodyProbeCount: coveredBodyProbes.length,
            coveredBodyNormalOffsetCount: coveredBodyNormalOffsets.size,
            probes: probes.map((probe) => ({
              alongOffset: probe.alongOffset,
              normalOffset: probe.normalOffset,
              covered: covered.includes(probe)
            }))
          }
        }

        return [
          ...(role === 'start' || role === 'start-end'
            ? [buildEdgeProbe('start')]
            : []),
          ...(role === 'end' || role === 'start-end'
            ? [buildEdgeProbe('end')]
            : [])
        ].flatMap((probe) =>
          probe &&
          (probe.coveredBodyProbeCount < 4 ||
            probe.coveredBodyNormalOffsetCount < 3)
            ? [
                {
                  stage,
                  geometryId: packet.geometry.geometryId,
                  intervalId: debugMeta?.intervalId,
                  splitRangeId: debugMeta?.domainPlanSplitRangeId,
                  startDistance: debugMeta?.startDistance,
                  endDistance: debugMeta?.endDistance,
                  boundaryTotalLength: debugMeta?.domainPlanBoundaryTotalLength,
                  selectedSide,
                  boundaryRole: debugMeta?.domainPlanBoundaryRole,
                  terminalRole: role,
                  ...probe
                }
              ]
            : []
        )
      })

    const getForbiddenEndpointCapFailures = (
      stage: string,
      terminalPackets: ReturnType<
        typeof buildConstrainedDashedStrokeResolvedPackets
      >
    ) =>
      terminalPackets.flatMap((packet) => {
        const debugMeta = packet.geometry.debugMeta
        const role = debugMeta?.domainPlanTerminalRole
        const boundaryPoints = debugMeta?.domainPlanBoundaryPoints
        const selectedSide = debugMeta?.domainPlanSelectedSide
        const endpointCapPolicy =
          debugMeta?.dashEndpointCapPolicySignature ?? ''
        const joinOwnership = debugMeta?.joinOwnershipSignature ?? ''
        const ownsContourJoin =
          joinOwnership.startsWith('constrained-boundary-source-vertex') ||
          (debugMeta?.joinOwnershipRecords?.length ?? 0) > 0
        if (
          debugMeta?.strokePosition !== 'outside' ||
          (role !== 'start' && role !== 'end' && role !== 'start-end') ||
          !boundaryPoints ||
          boundaryPoints.length < 2 ||
          (selectedSide !== 1 && selectedSide !== -1)
        ) {
          return []
        }
        if (ownsContourJoin) {
          return []
        }

        const packetPolygons = packet.geometry.polygons
        const buildForbiddenProbes = (edge: 'start' | 'end') => {
          const shouldBeFlat =
            edge === 'start'
              ? endpointCapPolicy.includes('start-flat')
              : endpointCapPolicy.includes('end-flat')
          if (!shouldBeFlat) {
            return []
          }

          const endpoint =
            edge === 'start'
              ? boundaryPoints[0]
              : boundaryPoints[boundaryPoints.length - 1]
          const adjacent =
            edge === 'start'
              ? boundaryPoints[1]
              : boundaryPoints[boundaryPoints.length - 2]
          if (!endpoint || !adjacent) {
            return []
          }

          const tangent = normalizeVector(
            edge === 'start'
              ? {
                  x: adjacent.x - endpoint.x,
                  y: adjacent.y - endpoint.y
                }
              : {
                  x: endpoint.x - adjacent.x,
                  y: endpoint.y - adjacent.y
                }
          )
          if (!tangent) {
            return []
          }
          const normal = {
            x: -tangent.y * selectedSide,
            y: tangent.x * selectedSide
          }
          const forbiddenAlongOffsets =
            edge === 'start' ? [-1.5, -3, -5] : [1.5, 3, 5]
          const normalOffsets = [2, 5, 8]
          return forbiddenAlongOffsets.flatMap((alongOffset) =>
            normalOffsets.flatMap((normalOffset) => {
              const probe = {
                x:
                  endpoint.x +
                  tangent.x * alongOffset +
                  normal.x * normalOffset,
                y:
                  endpoint.y + tangent.y * alongOffset + normal.y * normalOffset
              }
              return isPointCoveredByPolygons(probe, packetPolygons, 0.75)
                ? [
                    {
                      edge,
                      alongOffset,
                      normalOffset,
                      probe
                    }
                  ]
                : []
            })
          )
        }

        const forbiddenCoverage = [
          ...(role === 'start' || role === 'start-end'
            ? buildForbiddenProbes('start')
            : []),
          ...(role === 'end' || role === 'start-end'
            ? buildForbiddenProbes('end')
            : [])
        ]
        return forbiddenCoverage.length > 0
          ? [
              {
                stage,
                geometryId: packet.geometry.geometryId,
                intervalId: debugMeta?.intervalId,
                splitRangeId: debugMeta?.domainPlanSplitRangeId,
                terminalRole: role,
                endpointCapPolicy,
                joinOwnership,
                forbiddenCoverage
              }
            ]
          : []
      })

    ;(['butt', 'square', 'round'] as const).forEach((capType) => {
      ;(['miter', 'bevel', 'round'] as const).forEach((joinType) => {
        const packets = buildPackets(capType, joinType)
        const terminalPackets = packets.filter((packet) => {
          const role = packet.geometry.debugMeta?.domainPlanTerminalRole
          return (
            packet.geometry.debugMeta?.strokePosition === 'outside' &&
            (role === 'start' || role === 'end' || role === 'start-end')
          )
        })
        const dashBodyTerminalPackets = terminalPackets.filter(
          (packet) =>
            packet.geometry.debugMeta?.joinOwnershipSignature?.startsWith(
              'constrained-boundary-source-vertex'
            ) !== true
        )
        const missingButtTerminalEndpointCoverage =
          capType === 'butt'
            ? dashBodyTerminalPackets.flatMap((packet) => {
                const role = packet.geometry.debugMeta?.domainPlanTerminalRole
                const boundaryPoints =
                  packet.geometry.debugMeta?.domainPlanBoundaryPoints
                if (!boundaryPoints || boundaryPoints.length < 2) {
                  return []
                }
                const expectedEndpoints = [
                  ...(role === 'start' || role === 'start-end'
                    ? [
                        {
                          terminal: 'start' as const,
                          point: boundaryPoints[0],
                          neighbor: boundaryPoints[1]
                        }
                      ]
                    : []),
                  ...(role === 'end' || role === 'start-end'
                    ? [
                        {
                          terminal: 'end' as const,
                          point: boundaryPoints[boundaryPoints.length - 1],
                          neighbor: boundaryPoints[boundaryPoints.length - 2]
                        }
                      ]
                    : [])
                ]

                return expectedEndpoints.flatMap(
                  ({ terminal, point, neighbor }) => {
                    const direction =
                      terminal === 'start'
                        ? normalizeVector({
                            x: neighbor.x - point.x,
                            y: neighbor.y - point.y
                          })
                        : normalizeVector({
                            x: point.x - neighbor.x,
                            y: point.y - neighbor.y
                          })
                    const selectedSide =
                      packet.geometry.debugMeta?.domainPlanSelectedSide
                    const selectedNormal =
                      direction && (selectedSide === 1 || selectedSide === -1)
                        ? {
                            x: -direction.y * selectedSide,
                            y: direction.x * selectedSide
                          }
                        : null
                    const inwardSign = terminal === 'start' ? 1 : -1
                    const bodyProbe =
                      direction && selectedNormal
                        ? {
                            x:
                              point.x +
                              direction.x * inwardSign * 1.25 +
                              selectedNormal.x * 1.25,
                            y:
                              point.y +
                              direction.y * inwardSign * 1.25 +
                              selectedNormal.y * 1.25
                          }
                        : point
                    return isPointCoveredByPolygons(
                      bodyProbe,
                      getPacketProductPolygons(packet),
                      0.75
                    )
                      ? []
                      : [
                          {
                            geometryId: packet.geometry.geometryId,
                            intervalId: packet.geometry.debugMeta?.intervalId,
                            splitRangeId:
                              packet.geometry.debugMeta?.domainPlanSplitRangeId,
                            domainMode:
                              packet.geometry.debugMeta?.domainPlanDomainMode,
                            boundaryRole:
                              packet.geometry.debugMeta?.domainPlanBoundaryRole,
                            selectedSide:
                              packet.geometry.debugMeta?.domainPlanSelectedSide,
                            joinOwnershipSignature:
                              packet.geometry.debugMeta?.joinOwnershipSignature,
                            endpointCapPolicySignature:
                              packet.geometry.debugMeta
                                ?.dashEndpointCapPolicySignature,
                            startDistance:
                              packet.geometry.debugMeta?.startDistance,
                            endDistance: packet.geometry.debugMeta?.endDistance,
                            boundaryStartDistance:
                              packet.geometry.debugMeta
                                ?.domainPlanBoundaryStartDistance,
                            boundaryEndDistance:
                              packet.geometry.debugMeta
                                ?.domainPlanBoundaryEndDistance,
                            boundaryTotalLength:
                              packet.geometry.debugMeta
                                ?.domainPlanBoundaryTotalLength,
                            splitRangeStartDistance:
                              packet.geometry.debugMeta
                                ?.domainPlanSplitRangeStartDistance,
                            splitRangeEndDistance:
                              packet.geometry.debugMeta
                                ?.domainPlanSplitRangeEndDistance,
                            terminalRole: role,
                            terminal,
                            endpoint: point,
                            bodyProbe
                          }
                        ]
                  }
                )
              })
            : []
        const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
        const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
          finalFaces,
          {
            backend: getGeometryBackend()
          }
        )
        const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
          collapsedFinalFaces,
          {
            exactBackend: getGeometryBackend()
          }
        )
        const squareTerminalFootprintFailures =
          capType === 'square'
            ? [
                ...getSquareTerminalFootprintFailures(
                  'packet',
                  packets.flatMap((packet) => packet.geometry.polygons),
                  dashBodyTerminalPackets
                ),
                ...getSquareTerminalFootprintFailures(
                  'final-face',
                  finalFaces.flatMap((face) => face.polygons),
                  dashBodyTerminalPackets
                ),
                ...getSquareTerminalFootprintFailures(
                  'collapsed-final-face',
                  collapsedFinalFaces.flatMap((face) => face.polygons),
                  dashBodyTerminalPackets
                ),
                ...getSquareTerminalFootprintFailures(
                  'render-entry',
                  renderEntries.flatMap((entry) => entry.polygons),
                  dashBodyTerminalPackets
                )
              ]
            : []
        const forbiddenEndpointCapFailures = [
          ...getForbiddenEndpointCapFailures('packet', terminalPackets)
        ]
        expect(
          terminalPackets.length,
          JSON.stringify(
            {
              message:
                'outside boundary split endpoints must produce terminal/cap packets from domain-plan terminal policy',
              capType,
              joinType
            },
            null,
            2
          )
        ).toBeGreaterThan(0)
        const terminalContractFailures = terminalPackets.flatMap((packet) => {
          const debugMeta = packet.geometry.debugMeta
          const role = debugMeta?.domainPlanTerminalRole
          const signature = debugMeta?.dashEndpointCapPolicySignature
          const expectedStartFlat = role === 'start' || role === 'start-end'
          const expectedEndFlat = role === 'end' || role === 'start-end'
          const failures: string[] = []
          if (!signature) {
            failures.push('missing-endpoint-cap-policy')
          } else {
            if (expectedStartFlat && !signature.includes('start-flat')) {
              failures.push('terminal-start-must-be-flat')
            }
            if (!expectedStartFlat && !signature.includes('start-cap')) {
              failures.push('middle-start-must-own-cap')
            }
            if (expectedEndFlat && !signature.includes('end-flat')) {
              failures.push('terminal-end-must-be-flat')
            }
            if (!expectedEndFlat && !signature.includes('end-cap')) {
              failures.push('middle-end-must-own-cap')
            }
          }
          if (!debugMeta?.joinOwnershipSignature) {
            failures.push('missing-join-ownership')
          }
          if (!debugMeta?.smoothContinuityGroupId) {
            failures.push('missing-smooth-continuity-group')
          }
          return failures.length > 0
            ? [
                {
                  geometryId: packet.geometry.geometryId,
                  intervalId: debugMeta?.intervalId,
                  splitRangeId: debugMeta?.domainPlanSplitRangeId,
                  terminalRole: role,
                  signature,
                  joinOwnershipSignature: debugMeta?.joinOwnershipSignature,
                  smoothContinuityGroupId: debugMeta?.smoothContinuityGroupId,
                  failures
                }
              ]
            : []
        })
        const sourceVertexJoinFootprintFailures = terminalPackets.flatMap(
          (packet) => {
            const debugMeta = packet.geometry.debugMeta
            const joinOwnershipSignature =
              debugMeta?.joinOwnershipSignature ?? ''
            if (
              !joinOwnershipSignature.startsWith(
                'constrained-boundary-source-vertex'
              )
            ) {
              return []
            }
            const joinRecords = debugMeta?.joinOwnershipRecords ?? []
            const invalidJoinRecords = joinRecords.filter(
              (record) => record.area <= 0
            )
            return joinRecords.length > 0 && invalidJoinRecords.length === 0
              ? []
              : [
                  {
                    geometryId: packet.geometry.geometryId,
                    intervalId: debugMeta?.intervalId,
                    splitRangeId: debugMeta?.domainPlanSplitRangeId,
                    terminalRole: debugMeta?.domainPlanTerminalRole,
                    joinOwnershipSignature,
                    joinRecords,
                    invalidJoinRecords
                  }
                ]
          }
        )
        expect(
          terminalContractFailures,
          JSON.stringify(
            {
              message:
                'outside dashed terminal packets must carry the single product contract: endpoint cap policy, join ownership, and smooth continuity group',
              capType,
              joinType,
              terminalContractFailures
            },
            null,
            2
          )
        ).toEqual([])
        expect(
          sourceVertexJoinFootprintFailures,
          JSON.stringify(
            {
              message:
                'outside dashed contour/source-vertex terminals must preserve an explicit join footprint instead of being treated as forbidden endpoint-cap coverage',
              capType,
              joinType,
              sourceVertexJoinFootprintFailures
            },
            null,
            2
          )
        ).toEqual([])
        expect(
          missingButtTerminalEndpointCoverage,
          JSON.stringify(
            {
              message:
                'outside butt terminal packets are the base dash geometry and must start/end at their own boundary split endpoint before overlap handling',
              capType,
              joinType,
              missingButtTerminalEndpointCoverage
            },
            null,
            2
          )
        ).toEqual([])
        expect(
          squareTerminalFootprintFailures,
          JSON.stringify(
            {
              message:
                'outside square split terminals must preserve legal selected-side square body/collar width; illegal cap overhang may be clipped at self-intersection boundaries',
              capType,
              joinType,
              squareTerminalFootprintFailures
            },
            null,
            2
          )
        ).toEqual([])
        expect(
          forbiddenEndpointCapFailures,
          JSON.stringify(
            {
              message:
                'outside dashed terminal endpoint-flat side must not receive cap/overhang coverage; join ownership must preserve the same terminal policy',
              capType,
              joinType,
              forbiddenEndpointCapFailures
            },
            null,
            2
          )
        ).toEqual([])
      })
    })
  })

  it('should run: preserve every allocated outside boundary terminal through packet product output', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const strokeAttrs = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'outside',
      joinType: 'miter',
      capType: 'square',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const stroke = getOnlyRenderableStroke([strokeAttrs])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      strokeDomainPlan
    ).filter(
      (interval) =>
        interval.domainPlanBoundaryRole === 'outer' &&
        interval.domainPlanSplitRangeId !== undefined &&
        interval.domainPlanTerminalRole !== undefined
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-intersecting-mixed-star:outside-square-terminal-completeness',
      topology.normalizedPoints,
      true,
      [strokeAttrs],
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
    const requiredRolesBySplitRange = intervals.reduce<
      Map<string, Set<'start' | 'end' | 'start-end'>>
    >((rolesByRange, interval) => {
      const splitRangeId = interval.domainPlanSplitRangeId
      const role = interval.domainPlanTerminalRole
      if (
        splitRangeId === undefined ||
        (role !== 'start' && role !== 'end' && role !== 'start-end')
      ) {
        return rolesByRange
      }
      const roles = rolesByRange.get(splitRangeId) ?? new Set()
      roles.add(role)
      rolesByRange.set(splitRangeId, roles)
      return rolesByRange
    }, new Map())
    const packetRolesBySplitRange = packets.reduce<Map<string, Set<string>>>(
      (rolesByRange, packet) => {
        const meta = packet.geometry.debugMeta
        if (meta?.strokePosition !== 'outside') {
          return rolesByRange
        }
        getDebugMetaTerminalContracts(meta).forEach((contract) => {
          const { splitRangeId, terminalRole, boundaryRole } = contract
          if (
            boundaryRole !== 'outer' ||
            splitRangeId === undefined ||
            terminalRole === undefined
          ) {
            return
          }
          const roles = rolesByRange.get(splitRangeId) ?? new Set()
          roles.add(terminalRole)
          rolesByRange.set(splitRangeId, roles)
        })
        return rolesByRange
      },
      new Map()
    )

    const missingTerminals = [...requiredRolesBySplitRange.entries()].flatMap(
      ([splitRangeId, requiredRoles]) => {
        const packetRoles =
          packetRolesBySplitRange.get(splitRangeId) ?? new Set()
        const hasStart =
          packetRoles.has('start') || packetRoles.has('start-end')
        const hasEnd = packetRoles.has('end') || packetRoles.has('start-end')
        const missing = [
          requiredRoles.has('start') || requiredRoles.has('start-end')
            ? hasStart
              ? null
              : 'start'
            : null,
          requiredRoles.has('end') || requiredRoles.has('start-end')
            ? hasEnd
              ? null
              : 'end'
            : null
        ].filter((role): role is 'start' | 'end' => role !== null)
        return missing.length > 0
          ? [
              {
                splitRangeId,
                requiredIntervals: intervals
                  .filter(
                    (interval) =>
                      interval.domainPlanSplitRangeId === splitRangeId &&
                      (interval.domainPlanTerminalRole === 'start' ||
                        interval.domainPlanTerminalRole === 'end' ||
                        interval.domainPlanTerminalRole === 'start-end')
                  )
                  .map((interval) => ({
                    intervalId: interval.intervalId,
                    role: interval.domainPlanTerminalRole,
                    startDistance: interval.startDistance,
                    endDistance: interval.endDistance,
                    selectedSide: interval.domainPlanSelectedSide,
                    boundaryRole: interval.domainPlanBoundaryRole,
                    sourceSegmentIndex:
                      interval.domainPlanSplitRangeSourceSegmentIndex,
                    boundaryStartDistance:
                      interval.domainPlanBoundaryStartDistance,
                    boundaryEndDistance: interval.domainPlanBoundaryEndDistance,
                    boundaryTotalLength: interval.domainPlanBoundaryTotalLength,
                    boundaryFirstPoint:
                      interval.domainPlanBoundaryPoints?.[0] ?? null,
                    boundaryLastPoint:
                      interval.domainPlanBoundaryPoints?.[
                        interval.domainPlanBoundaryPoints.length - 1
                      ] ?? null
                  })),
                requiredRoles: [...requiredRoles].sort(),
                packetRoles: [...packetRoles].sort(),
                missing
              }
            ]
          : []
      }
    )

    expect(
      missingTerminals,
      JSON.stringify(
        {
          message:
            'outside boundary split range allocation terminals must survive into formal product packets',
          missingTerminals
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('should run: preserve every allocated self-check outside boundary terminal through packet product output', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfCheckClosedStarFixture()
    const strokeAttrs = createDefaultStroke({
      width: 10,
      style: 'dashed',
      position: 'outside',
      joinType: 'miter',
      capType: 'square',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const stroke = getOnlyRenderableStroke([strokeAttrs])
    const strokeDomainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath,
      implicitFillRegions: fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      strokeDomainPlan
    ).filter(
      (interval) =>
        interval.domainPlanBoundaryRole === 'outer' &&
        interval.domainPlanSplitRangeId !== undefined &&
        interval.domainPlanTerminalRole !== undefined
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'self-check-star:outside-square-terminal-completeness',
      topology.normalizedPoints,
      true,
      [strokeAttrs],
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
    const requiredRolesBySplitRange = intervals.reduce<
      Map<string, Set<'start' | 'end' | 'start-end'>>
    >((rolesByRange, interval) => {
      const splitRangeId = interval.domainPlanSplitRangeId
      const role = interval.domainPlanTerminalRole
      if (
        splitRangeId === undefined ||
        (role !== 'start' && role !== 'end' && role !== 'start-end')
      ) {
        return rolesByRange
      }
      const roles = rolesByRange.get(splitRangeId) ?? new Set()
      roles.add(role)
      rolesByRange.set(splitRangeId, roles)
      return rolesByRange
    }, new Map())
    const packetRolesBySplitRange = packets.reduce<Map<string, Set<string>>>(
      (rolesByRange, packet) => {
        const meta = packet.geometry.debugMeta
        if (meta?.strokePosition !== 'outside') {
          return rolesByRange
        }
        getDebugMetaTerminalContracts(meta).forEach((contract) => {
          const { splitRangeId, terminalRole, boundaryRole } = contract
          if (
            boundaryRole !== 'outer' ||
            splitRangeId === undefined ||
            terminalRole === undefined
          ) {
            return
          }
          const roles = rolesByRange.get(splitRangeId) ?? new Set()
          roles.add(terminalRole)
          rolesByRange.set(splitRangeId, roles)
        })
        return rolesByRange
      },
      new Map()
    )

    const missingTerminals = [...requiredRolesBySplitRange.entries()].flatMap(
      ([splitRangeId, requiredRoles]) => {
        const packetRoles =
          packetRolesBySplitRange.get(splitRangeId) ?? new Set()
        const hasStart =
          packetRoles.has('start') || packetRoles.has('start-end')
        const hasEnd = packetRoles.has('end') || packetRoles.has('start-end')
        const missing = [
          requiredRoles.has('start') || requiredRoles.has('start-end')
            ? hasStart
              ? null
              : 'start'
            : null,
          requiredRoles.has('end') || requiredRoles.has('start-end')
            ? hasEnd
              ? null
              : 'end'
            : null
        ].filter((role): role is 'start' | 'end' => role !== null)
        return missing.length > 0
          ? [
              {
                splitRangeId,
                requiredIntervals: intervals
                  .filter(
                    (interval) =>
                      interval.domainPlanSplitRangeId === splitRangeId &&
                      (interval.domainPlanTerminalRole === 'start' ||
                        interval.domainPlanTerminalRole === 'end' ||
                        interval.domainPlanTerminalRole === 'start-end')
                  )
                  .map((interval) => ({
                    intervalId: interval.intervalId,
                    role: interval.domainPlanTerminalRole,
                    startDistance: interval.startDistance,
                    endDistance: interval.endDistance,
                    selectedSide: interval.domainPlanSelectedSide,
                    boundaryRole: interval.domainPlanBoundaryRole,
                    sourceSegmentIndex:
                      interval.domainPlanSplitRangeSourceSegmentIndex,
                    boundaryStartDistance:
                      interval.domainPlanBoundaryStartDistance,
                    boundaryEndDistance: interval.domainPlanBoundaryEndDistance,
                    boundaryTotalLength: interval.domainPlanBoundaryTotalLength,
                    boundaryFirstPoint:
                      interval.domainPlanBoundaryPoints?.[0] ?? null,
                    boundaryLastPoint:
                      interval.domainPlanBoundaryPoints?.[
                        interval.domainPlanBoundaryPoints.length - 1
                      ] ?? null
                  })),
                requiredRoles: [...requiredRoles].sort(),
                packetRoles: [...packetRoles].sort(),
                missing
              }
            ]
          : []
      }
    )

    expect(
      missingTerminals,
      JSON.stringify(
        {
          message:
            'self-check outside boundary split range allocation terminals must survive into formal product packets',
          missingTerminals
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('should run: keep outside dashed product geometry identical across repeated unified product builds', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()

    const buildPackets = (
      capType: 'butt' | 'square' | 'round',
      joinType: 'miter' | 'bevel' | 'round'
    ) =>
      buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${joinType}-${capType}-diagnostic-equivalence`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'outside',
            joinType,
            capType,
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

    ;(['butt', 'square', 'round'] as const).forEach((capType) => {
      ;(['miter', 'bevel', 'round'] as const).forEach((joinType) => {
        const diagnosticPackets = buildPackets(capType, joinType)
        const productionPackets = buildPackets(capType, joinType)
        const diagnosticContractSummary =
          getPacketProductContractSummary(diagnosticPackets)
        const productionContractSummary =
          getPacketProductContractSummary(productionPackets)
        const diagnosticGeometrySummary =
          getPacketFormalProductGeometrySummary(diagnosticPackets)
        const productionGeometrySummary =
          getPacketFormalProductGeometrySummary(productionPackets)

        expect(
          productionContractSummary,
          JSON.stringify(
            {
              message:
                'diagnostic metadata mode must not change outside dashed product contract; drag/static differences must be cache invalidation only',
              capType,
              joinType,
              diagnosticContractSummary,
              productionContractSummary
            },
            null,
            2
          )
        ).toEqual(diagnosticContractSummary)
        expect(
          productionGeometrySummary,
          JSON.stringify(
            {
              message:
                'production mode must keep the same formal product geometry as diagnostic mode; descriptors are an encoding detail, not a separate product route',
              capType,
              joinType,
              diagnosticGeometrySummary,
              productionGeometrySummary
            },
            null,
            2
          )
        ).toEqual(diagnosticGeometrySummary)
      })
    })
  })

  it('should run: keep the right-bottom high-curvature outside endpoint on domain-plan terminal policy', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const highCurvatureAnchor = sourcePath.segments[3]?.end
    expect(highCurvatureAnchor).toBeDefined()

    const buildPackets = (joinType: 'miter' | 'bevel' | 'round') =>
      buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${joinType}-right-bottom-terminal-cap`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'outside',
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
    const getLocalRenderSummary = (joinType: 'miter' | 'bevel' | 'round') => {
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(
        buildPackets(joinType)
      )
      const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
        finalFaces,
        {
          backend: getGeometryBackend()
        }
      )
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        collapsedFinalFaces,
        {
          exactBackend: getGeometryBackend()
        }
      )
      const localPolygons = renderEntries.flatMap((entry) =>
        entry.polygons.filter((polygon) =>
          polygon.some(
            (point) =>
              highCurvatureAnchor &&
              pointDistance(point, highCurvatureAnchor) <= 32
          )
        )
      )

      expect(
        localPolygons.length,
        JSON.stringify(
          {
            message:
              'right-bottom high-curvature outside endpoint must preserve terminal/cap geometry through FinalFace render projection',
            joinType,
            renderEntries: renderEntries.map((entry) => ({
              cacheKey: entry.cacheKey,
              status: entry.debugMeta?.visualOverlapCollapseStatus,
              sourceGeometryIds:
                entry.debugMeta?.visualOverlapSourceGeometryIds?.slice(0, 8)
            }))
          },
          null,
          2
        )
      ).toBeGreaterThan(0)

      const terminalPackets = buildPackets(joinType).filter((packet) => {
        const role = packet.geometry.debugMeta?.domainPlanTerminalRole
        return role === 'start' || role === 'end' || role === 'start-end'
      })

      return {
        joinType,
        localPolygonCount: localPolygons.length,
        terminalRoles: terminalPackets.map(
          (packet) => packet.geometry.debugMeta?.domainPlanTerminalRole
        ),
        terminalIntervalIds: terminalPackets.map(
          (packet) => packet.geometry.debugMeta?.intervalId
        )
      }
    }

    const localRenderSummaries = [
      getLocalRenderSummary('miter'),
      getLocalRenderSummary('bevel'),
      getLocalRenderSummary('round')
    ]

    expect(
      localRenderSummaries.every(
        (summary) =>
          summary.localPolygonCount > 0 && summary.terminalRoles.length > 0
      ),
      JSON.stringify(
        {
          message:
            'right-bottom high-curvature outside endpoint must be rendered from explicit domain-plan terminal packets for every join type',
          localRenderSummaries
        },
        null,
        2
      )
    ).toBe(true)
  })

  it('should run: keep high-curvature outside vertices on domain-plan interval product geometry', () => {
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
      capType: 'butt',
      dashPattern: [27, 20],
      dashOffset: 0
    })
    const smoothAnchors = [
      {
        id: 'tp-13',
        segmentEndIndex: 0,
        point: sourcePath.segments[0]?.end,
        distance: sourcePath.segments[0]?.length ?? 0
      },
      {
        id: 'tp-16',
        segmentEndIndex: 3,
        point: sourcePath.segments[3]?.end,
        distance: sourcePath.segments
          .slice(0, 4)
          .reduce((total, segment) => total + segment.length, 0)
      }
    ]

    const buildStagePolygons = (joinType: 'miter' | 'bevel' | 'round') => {
      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${joinType}-high-curvature-terminal-policy`,
        topology.normalizedPoints,
        true,
        [
          {
            ...stroke,
            joinType
          }
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
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
        finalFaces,
        {
          backend: getGeometryBackend()
        }
      )
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        collapsedFinalFaces,
        {
          exactBackend: getGeometryBackend()
        }
      )

      return {
        packets,
        packetRecords: packets.flatMap((packet) =>
          getPacketProductPolygons(packet).map(
            (polygon, packetPolygonIndex) => ({
              polygon,
              stageGeometryId: packet.geometry.geometryId,
              packetPolygonIndex,
              debugMeta: packet.geometry.debugMeta,
              hasRenderDescriptor:
                packet.geometry.renderDescriptor !== undefined,
              renderDescriptorMaskPolygonCount:
                packet.geometry.renderDescriptor?.strokeMaskPolygons?.length ??
                0
            })
          )
        ),
        packetPolygons: packets.flatMap(getPacketProductPolygons),
        packetStrokePaths: packets.flatMap(getPacketProductStrokePaths),
        finalFaceRecords: collapsedFinalFaces.flatMap((face) =>
          getFinalFaceProductPolygons(face).map(
            (polygon, facePolygonIndex) => ({
              polygon,
              stageGeometryId: face.faceId,
              facePolygonIndex,
              debugMeta: face.debugMeta,
              hasRenderDescriptor: face.renderDescriptor !== undefined,
              renderDescriptorMaskPolygonCount:
                (
                  face.renderDescriptor as
                    | { strokeMaskPolygons?: { x: number; y: number }[][] }
                    | undefined
                )?.strokeMaskPolygons?.length ?? 0
            })
          )
        ),
        finalFacePolygons: collapsedFinalFaces.flatMap(
          getFinalFaceProductPolygons
        ),
        finalFaceStrokePaths: collapsedFinalFaces.flatMap(
          getFinalFaceProductStrokePaths
        ),
        renderRecords: renderEntries.flatMap((entry) =>
          getRenderEntryProductPolygons(entry).map(
            (polygon, renderPolygonIndex) => ({
              polygon,
              stageGeometryId: entry.cacheKey,
              renderPolygonIndex,
              debugMeta: entry.debugMeta
            })
          )
        ),
        renderPolygons: renderEntries.flatMap(getRenderEntryProductPolygons),
        renderStrokePaths: renderEntries.flatMap(
          getRenderEntryProductStrokePaths
        )
      }
    }

    const getLocalProductCoverageCount = (
      polygons: { x: number; y: number }[][],
      strokePaths: { x: number; y: number }[][],
      anchor: (typeof smoothAnchors)[number]
    ) =>
      anchor.point
        ? Number(
            hasLocalProductCoverage(polygons, strokePaths, anchor.point, 28)
          )
        : 0

    const getLocalProductPolygonRecords = (
      records: {
        polygon: { x: number; y: number }[]
        stageGeometryId?: string
        packetPolygonIndex?: number
        facePolygonIndex?: number
        renderPolygonIndex?: number
        debugMeta?: {
          intervalId?: string
          domainPlanSplitRangeId?: string
          domainPlanTerminalRole?: string
          domainPlanBoundaryRole?: string
          domainPlanSelectedSide?: number
          dashEndpointCapPolicySignature?: string
          joinOwnershipSignature?: string
          smoothContinuityGroupId?: string
        }
        hasRenderDescriptor?: boolean
        renderDescriptorMaskPolygonCount?: number
      }[],
      anchor: (typeof smoothAnchors)[number]
    ) =>
      anchor.point
        ? records.filter((record) =>
            record.polygon.some(
              (point) =>
                anchor.point && pointDistance(point, anchor.point) <= 32
            )
          )
        : []

    const summarizeLocalProductContractRecords = (
      records: {
        polygon: { x: number; y: number }[]
        debugMeta?: {
          intervalId?: string
          domainPlanSplitRangeId?: string
          domainPlanTerminalRole?: string
          domainPlanBoundaryRole?: string
          domainPlanSelectedSide?: number
          dashEndpointCapPolicySignature?: string
          joinOwnershipSignature?: string
          smoothContinuityGroupId?: string
        }
        hasRenderDescriptor?: boolean
        renderDescriptorMaskPolygonCount?: number
      }[],
      anchor: (typeof smoothAnchors)[number]
    ) =>
      getLocalProductPolygonRecords(records, anchor).map((record) => ({
        stageGeometryId: record.stageGeometryId,
        packetPolygonIndex: record.packetPolygonIndex,
        facePolygonIndex: record.facePolygonIndex,
        renderPolygonIndex: record.renderPolygonIndex,
        intervalId: record.debugMeta?.intervalId ?? 'unknown',
        splitRangeId: record.debugMeta?.domainPlanSplitRangeId ?? 'unknown',
        terminalRole: record.debugMeta?.domainPlanTerminalRole ?? 'unknown',
        boundaryRole: record.debugMeta?.domainPlanBoundaryRole ?? 'unknown',
        selectedSide: record.debugMeta?.domainPlanSelectedSide ?? null,
        endpointCapPolicy:
          record.debugMeta?.dashEndpointCapPolicySignature ?? 'unknown',
        joinOwnership: record.debugMeta?.joinOwnershipSignature ?? 'unknown',
        smoothGroup: record.debugMeta?.smoothContinuityGroupId ?? 'none',
        hasRenderDescriptor: record.hasRenderDescriptor ?? false,
        renderDescriptorMaskPolygonCount:
          record.renderDescriptorMaskPolygonCount ?? 0
      }))

    ;(['miter', 'bevel', 'round'] as const).forEach((joinType) => {
      const {
        packets,
        packetRecords,
        packetPolygons,
        packetStrokePaths,
        finalFaceRecords,
        finalFacePolygons,
        finalFaceStrokePaths,
        renderRecords,
        renderPolygons,
        renderStrokePaths
      } = buildStagePolygons(joinType)
      const localCoverageSummaries = smoothAnchors.map((anchor) => ({
        anchorId: anchor.id,
        packetCount: getLocalProductCoverageCount(
          packetPolygons,
          packetStrokePaths,
          anchor
        ),
        finalFaceCount: getLocalProductCoverageCount(
          finalFacePolygons,
          finalFaceStrokePaths,
          anchor
        ),
        renderCount: getLocalProductCoverageCount(
          renderPolygons,
          renderStrokePaths,
          anchor
        )
      }))
      const localTerminalPackets = smoothAnchors.flatMap((anchor) =>
        packets.flatMap((packet) => {
          if (
            !anchor.point ||
            (packet.geometry.debugMeta?.domainPlanTerminalRole !== 'start' &&
              packet.geometry.debugMeta?.domainPlanTerminalRole !== 'end' &&
              packet.geometry.debugMeta?.domainPlanTerminalRole !== 'start-end')
          ) {
            return []
          }

          const isLocal = hasLocalProductCoverage(
            getPacketProductPolygons(packet),
            getPacketProductStrokePaths(packet),
            anchor.point,
            28
          )
          return isLocal
            ? [
                {
                  anchorId: anchor.id,
                  geometryId: packet.geometry.geometryId,
                  intervalId: packet.geometry.debugMeta.intervalId,
                  terminalRole:
                    packet.geometry.debugMeta.domainPlanTerminalRole,
                  splitRangeId:
                    packet.geometry.debugMeta.domainPlanSplitRangeId,
                  sourceSegmentIndex:
                    packet.geometry.debugMeta
                      .domainPlanSplitRangeSourceSegmentIndex,
                  boundaryDomainId:
                    packet.geometry.debugMeta.domainPlanBoundaryDomainId,
                  boundaryRole:
                    packet.geometry.debugMeta.domainPlanBoundaryRole,
                  selectedSide: packet.geometry.debugMeta.domainPlanSelectedSide
                }
              ]
            : []
        })
      )
      expect(
        localTerminalPackets.length,
        JSON.stringify(
          {
            message:
              'high-curvature split endpoints must remain explicit domain-plan terminal packets',
            joinType,
            localTerminalPackets
          },
          null,
          2
        )
      ).toBeGreaterThan(0)
      expect(
        localCoverageSummaries.every(
          (summary) =>
            summary.packetCount > 0 &&
            summary.finalFaceCount > 0 &&
            summary.renderCount > 0
        ),
        JSON.stringify(
          {
            message:
              'outside dashed high-curvature vertices must keep local product output through packet, FinalFace, and render projection stages without treating legal dash gaps as failures',
            joinType,
            localCoverageSummaries
          },
          null,
          2
        )
      ).toBe(true)

      const fanFailures = [
        ...getHighCurvatureFanPolygonFailures(
          packetRecords.map((record) => ({
            polygons: [record.polygon],
            intervalId: record.debugMeta?.intervalId,
            splitRangeId: record.debugMeta?.domainPlanSplitRangeId,
            terminalRole: record.debugMeta?.domainPlanTerminalRole,
            boundaryRole: record.debugMeta?.domainPlanBoundaryRole,
            strokePosition: record.debugMeta?.strokePosition
          }))
        ).map((failure) => ({ stage: 'packet', ...failure })),
        ...getHighCurvatureFanPolygonFailures(
          finalFaceRecords.map((record) => ({
            polygons: [record.polygon],
            intervalId:
              record.debugMeta?.intervalIds?.join(',') ??
              record.debugMeta?.intervalId,
            splitRangeId: record.debugMeta?.domainPlanSplitRangeId,
            terminalRole: record.debugMeta?.domainPlanTerminalRole,
            boundaryRole: record.debugMeta?.domainPlanBoundaryRole,
            strokePosition: record.debugMeta?.strokePosition
          }))
        ).map((failure) => ({ stage: 'final-face', ...failure })),
        ...getHighCurvatureFanPolygonFailures(
          renderRecords.map((record) => ({
            polygons: [record.polygon],
            intervalId: record.debugMeta?.intervalId,
            splitRangeId: record.debugMeta?.domainPlanSplitRangeId,
            terminalRole: record.debugMeta?.domainPlanTerminalRole,
            boundaryRole: record.debugMeta?.domainPlanBoundaryRole,
            strokePosition: record.debugMeta?.strokePosition
          }))
        ).map((failure) => ({ stage: 'render-entry', ...failure }))
      ]

      const localSmoothProductSummaries = smoothAnchors.map((anchor) => {
        const packetLocalRecords = getLocalProductPolygonRecords(
          packetRecords,
          anchor
        )
        const finalFaceLocalRecords = getLocalProductPolygonRecords(
          finalFaceRecords,
          anchor
        )
        const renderLocalRecords = getLocalProductPolygonRecords(
          renderRecords,
          anchor
        )

        return {
          anchorId: anchor.id,
          packetPolygonCount: packetLocalRecords.length,
          finalFacePolygonCount: finalFaceLocalRecords.length,
          renderPolygonCount: renderLocalRecords.length,
          packetIntervals: [
            ...new Set(
              packetLocalRecords.map(
                (record) => record.debugMeta?.intervalId ?? 'unknown'
              )
            )
          ],
          renderSmoothGroups: [
            ...new Set(
              renderLocalRecords.map(
                (record) => record.debugMeta?.smoothContinuityGroupId ?? 'none'
              )
            )
          ],
          packetContracts: summarizeLocalProductContractRecords(
            packetRecords,
            anchor
          ),
          finalFaceContracts: summarizeLocalProductContractRecords(
            finalFaceRecords,
            anchor
          ),
          renderContracts: summarizeLocalProductContractRecords(
            renderRecords,
            anchor
          )
        }
      })

      expect(
        localSmoothProductSummaries.every(
          (summary) =>
            summary.packetContracts.length > 0 &&
            summary.finalFaceContracts.length > 0 &&
            summary.renderContracts.length > 0 &&
            !summary.packetContracts.some(
              (contract) => contract.smoothGroup === 'none'
            ) &&
            !summary.finalFaceContracts.some(
              (contract) => contract.smoothGroup === 'none'
            ) &&
            !summary.renderContracts.some(
              (contract) => contract.smoothGroup === 'none'
            )
        ),
        JSON.stringify(
          {
            message:
              'outside dashed smooth/high-curvature endpoint contract must carry smooth continuity through packet, FinalFace, and render stages',
            joinType,
            localSmoothProductSummaries
          },
          null,
          2
        )
      ).toBe(true)

      expect(
        localSmoothProductSummaries.every(
          (summary) =>
            summary.packetPolygonCount <= 8 &&
            summary.finalFacePolygonCount <= 8 &&
            summary.renderPolygonCount <= 8
        ),
        JSON.stringify(
          {
            message:
              'outside dashed smooth/high-curvature endpoint must remain a small number of continuous product footprints, not many visible strip fragments',
            joinType,
            localSmoothProductSummaries
          },
          null,
          2
        )
      ).toBe(true)

      expect(
        fanFailures.slice(0, 20),
        JSON.stringify(
          {
            message:
              'outside dashed smooth/high-curvature interval output must not degrade into visible fan strips; body, cap, and join are one product footprint',
            joinType,
            fanFailureCount: fanFailures.length,
            firstFanFailures: fanFailures.slice(0, 20)
          },
          null,
          2
        )
      ).toEqual([])
    })
  })

  it('should run: keep outside source-vertex coverage inside interval product geometry', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const sourceJoinVertices = [
      {
        id: 'tp-12',
        point: sourcePath.segments[4]?.end
      },
      {
        id: 'tp-14',
        point: sourcePath.segments[1]?.end
      },
      {
        id: 'tp-15',
        point: sourcePath.segments[2]?.end
      }
    ]
    expect(sourceJoinVertices.every((vertex) => vertex.point)).toBe(true)

    const buildPackets = (joinType: 'miter' | 'bevel' | 'round') =>
      buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${joinType}-top-interval-product`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'outside',
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

    const getLocalProductPacketPolygons = (
      joinType: 'miter' | 'bevel' | 'round',
      sourceJoinVertex: (typeof sourceJoinVertices)[number]
    ) => {
      const packets = buildPackets(joinType)
      return packets.flatMap((packet) =>
        packet.geometry.polygons.filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      )
    }

    const getLocalRenderSignature = (
      joinType: 'miter' | 'bevel' | 'round',
      sourceJoinVertex: (typeof sourceJoinVertices)[number]
    ) => {
      const packets = buildPackets(joinType)
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
        finalFaces,
        {
          backend: getGeometryBackend()
        }
      )
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        collapsedFinalFaces,
        {
          exactBackend: getGeometryBackend()
        }
      )
      const packetLocalPolygons = packets
        .flatMap(getPacketProductPolygons)
        .filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      const finalFaceLocalPolygons = finalFaces
        .flatMap(getFinalFaceProductPolygons)
        .filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      const localPolygons = renderEntries.flatMap((entry) =>
        getRenderEntryProductPolygons(entry).filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      )

      expect(
        localPolygons.length,
        JSON.stringify(
          {
            message:
              'source-vertex join coverage must survive FinalFace render projection',
            joinType,
            sourceJoinVertex: sourceJoinVertex.id
          },
          null,
          2
        )
      ).toBeGreaterThan(0)

      return localPolygons
        .map((polygon) =>
          polygon
            .map((point) => [
              Math.round(point.x * 100) / 100,
              Math.round(point.y * 100) / 100
            ])
            .join('|')
        )
        .sort()
        .join('::')
    }

    sourceJoinVertices.forEach((sourceJoinVertex) => {
      const miterProductPolygons = getLocalProductPacketPolygons(
        'miter',
        sourceJoinVertex
      )
      const bevelProductPolygons = getLocalProductPacketPolygons(
        'bevel',
        sourceJoinVertex
      )
      const roundProductPolygons = getLocalProductPacketPolygons(
        'round',
        sourceJoinVertex
      )
      expect(
        [
          miterProductPolygons.length,
          bevelProductPolygons.length,
          roundProductPolygons.length
        ].every((count) => count > 0),
        JSON.stringify(
          {
            message:
              'a continuous visible dash across the authored source vertex must stay covered by interval product polygons',
            sourceJoinVertex: sourceJoinVertex.id,
            miterProductPolygonCount: miterProductPolygons.length,
            bevelProductPolygonCount: bevelProductPolygons.length,
            roundProductPolygonCount: roundProductPolygons.length
          },
          null,
          2
        )
      ).toBe(true)

      const miterRenderSignature = getLocalRenderSignature(
        'miter',
        sourceJoinVertex
      )
      const bevelRenderSignature = getLocalRenderSignature(
        'bevel',
        sourceJoinVertex
      )
      const roundRenderSignature = getLocalRenderSignature(
        'round',
        sourceJoinVertex
      )
      expect(
        [
          miterRenderSignature.length,
          bevelRenderSignature.length,
          roundRenderSignature.length
        ].every((signatureLength) => signatureLength > 0),
        JSON.stringify(
          {
            message:
              'true source-vertex join coverage must survive FinalFace render projection; visible output may be identical when the join packet is fully covered by dash bodies',
            sourceJoinVertex: sourceJoinVertex.id,
            miterRenderSignature,
            bevelRenderSignature,
            roundRenderSignature
          },
          null,
          2
        )
      ).toBe(true)
    })
  })

  it('should run: keep inside sharp source vertices out of boundary-terminal join source', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const sourceJoinVertices = [
      {
        id: 'tp-14',
        point: sourcePath.segments[1]?.end
      },
      {
        id: 'tp-15',
        point: sourcePath.segments[2]?.end
      }
    ]
    expect(sourceJoinVertices.every((vertex) => vertex.point)).toBe(true)

    const buildPackets = (joinType: 'miter' | 'bevel' | 'round') =>
      buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:inside-${joinType}-sharp-source-vertex-product`,
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

    const getLocalRenderSignature = (
      joinType: 'miter' | 'bevel' | 'round',
      sourceJoinVertex: (typeof sourceJoinVertices)[number]
    ) => {
      const packets = buildPackets(joinType)
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
        finalFaces,
        {
          backend: getGeometryBackend()
        }
      )
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        collapsedFinalFaces,
        {
          exactBackend: getGeometryBackend()
        }
      )
      const packetLocalPolygons = packets
        .flatMap(getPacketProductPolygons)
        .filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      const finalFaceLocalPolygons = finalFaces
        .flatMap(getFinalFaceProductPolygons)
        .filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      const localPolygons = renderEntries.flatMap((entry) =>
        getRenderEntryProductPolygons(entry).filter((polygon) =>
          polygon.some(
            (point) =>
              sourceJoinVertex.point &&
              pointDistance(point, sourceJoinVertex.point) <= 24
          )
        )
      )

      expect(
        localPolygons.length,
        JSON.stringify(
          {
            message:
              'inside source-vertex join coverage must survive FinalFace render projection',
            joinType,
            sourceJoinVertex: sourceJoinVertex.id,
            packetLocalPolygonCount: packetLocalPolygons.length,
            finalFaceLocalPolygonCount: finalFaceLocalPolygons.length,
            collapsedFinalFaceCount: collapsedFinalFaces.length,
            renderEntryCount: renderEntries.length
          },
          null,
          2
        )
      ).toBeGreaterThan(0)

      return localPolygons
        .map((polygon) =>
          polygon
            .map((point) => [
              Math.round(point.x * 100) / 100,
              Math.round(point.y * 100) / 100
            ])
            .join('|')
        )
        .sort()
        .join('::')
    }

    sourceJoinVertices.forEach((sourceJoinVertex) => {
      expect(getLocalRenderSignature('miter', sourceJoinVertex)).not.toEqual('')
      expect(getLocalRenderSignature('bevel', sourceJoinVertex)).not.toEqual('')
      expect(getLocalRenderSignature('round', sourceJoinVertex)).not.toEqual('')
    })
  })

  it('should run: keep outside butt and square terminal dash bodies visible near non-join authored probes', () => {
    const {
      sourcePath,
      topology,
      fillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains,
      guardPoints
    } = buildSelfIntersectingMixedSegmentStarFixture()
    const terminalBodyProbeGroups = [
      [
        { x: 184.49664345197667, y: 6.139900610694954 },
        { x: 182.0459094168437, y: 5.646035559247745 },
        { x: 179.59517538171076, y: 5.152170507800537 }
      ],
      [
        { x: 3.908652935183205, y: 363.63484710716176 },
        { x: 1.9963708027514198, y: 365.2451815587532 },
        { x: 0.08408867031963396, y: 366.85551601034456 }
      ],
      [
        { x: 17.563221289594726, y: 369.8620871848398 },
        { x: 17.231682944083875, y: 372.34000613538194 },
        { x: 16.900144598573025, y: 374.8179250859241 }
      ]
    ]

    const getStageCoverage = (capType: 'butt' | 'square') => {
      const packets = buildConstrainedDashedStrokeResolvedPackets(
        `self-intersecting-mixed-star:outside-${capType}-terminal-body`,
        topology.normalizedPoints,
        true,
        [
          createDefaultStroke({
            width: 10,
            style: 'dashed',
            position: 'outside',
            joinType: 'miter',
            capType,
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
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
        finalFaces,
        {
          backend: getGeometryBackend()
        }
      )
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        collapsedFinalFaces,
        {
          exactBackend: getGeometryBackend()
        }
      )
      const packetPolygons = packets.flatMap(
        (packet) => packet.geometry.polygons
      )
      const finalFacePolygons = finalFaces.flatMap((face) => face.polygons)
      const renderPolygons = renderEntries.flatMap((entry) => entry.polygons)

      return terminalBodyProbeGroups.map((probes, probeGroupIndex) => ({
        capType,
        probeGroupIndex,
        packetCovered: probes.some((probe) =>
          isPointCoveredByPolygons(probe, packetPolygons, 1)
        ),
        finalFaceCovered: probes.some((probe) =>
          isPointCoveredByPolygons(probe, finalFacePolygons, 1)
        ),
        renderCovered: probes.some((probe) =>
          isPointCoveredByPolygons(probe, renderPolygons, 1)
        )
      }))
    }

    const coverage = (['butt', 'square'] as const).flatMap((capType) =>
      getStageCoverage(capType)
    )

    expect(
      coverage,
      JSON.stringify(
        {
          message:
            'outside butt/square terminal dash bodies must survive packet, FinalFace, and render projection near authored vertices',
          coverage
        },
        null,
        2
      )
    ).toEqual(
      coverage.map((record) => ({
        ...record,
        packetCovered: true,
        finalFaceCovered: true,
        renderCovered: true
      }))
    )
  })

  it('should run: keep closed outside square-cap seam coverage inside domain-plan interval product geometry', () => {
    const points = [
      { x: 40, y: 0 },
      { x: 80, y: 100 },
      { x: 0, y: 30 },
      { x: 80, y: 30 },
      { x: 0, y: 100 }
    ]
    const {
      topology,
      sourcePath,
      implicitFillRegions,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    } = buildSelfIntersectingSourcePathTestOptions(points)
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:closed-square-cap-seam-source-anchor',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [24, 260],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        implicitFillRegions,
        sharedSourceSplitRanges,
        sharedStrokeBoundaryDomains,
        clipInsideToFillDomain: true
      }
    )
    const polygons = packets.flatMap(getPacketProductPolygons)
    const strokePaths = packets.flatMap(getPacketProductStrokePaths)
    const topVertex = points[0]
    const localPolygons = polygons.filter((polygon) =>
      polygon.some((point) => pointDistance(point, topVertex) <= 20)
    )
    const localStrokePaths = strokePaths.filter((path) =>
      path.some((point) => pointDistance(point, topVertex) <= 20)
    )

    expect(
      localPolygons.length + localStrokePaths.length,
      JSON.stringify(
        {
          message:
            'closed outside square-cap seam coverage must stay present near the authored vertex through interval product geometry',
          geometryIds: packets.map((packet) => packet.geometry.geometryId)
        },
        null,
        2
      )
    ).toBeGreaterThan(0)
  })

  it('should run: reject self-intersecting outside dashed geometry that crosses into filled faces at high curvature boundaries', () => {
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
      'self-intersecting-mixed-star:outside:high-curvature-fill-side-guard',
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
    expect(packets.length).toBeGreaterThan(0)

    const highCurvatureAnchor = sourcePath.segments[3]?.end
    expect(highCurvatureAnchor).toBeDefined()

    const collectOversizedHighCurvatureEdges = (
      polygonRecords: {
        polygons: { x: number; y: number }[][]
        clipPolygons?: { x: number; y: number }[][]
        intervalId?: string
        splitRangeId?: string
        terminalRole?: string
        boundaryRole?: string
        projectionStatus?: string
      }[]
    ) =>
      polygonRecords.flatMap((record) =>
        record.polygons.flatMap((polygon) =>
          getPolygonEdges(polygon).flatMap((edge) => {
            if (!highCurvatureAnchor) {
              return []
            }
            if (
              pointSegmentDistance(highCurvatureAnchor, edge.start, edge.end) >
              stroke.width * 9
            ) {
              return []
            }
            const length = pointDistance(edge.start, edge.end)
            return length > stroke.width * 5
              ? [
                  {
                    intervalId: record.intervalId,
                    splitRangeId: record.splitRangeId,
                    terminalRole: record.terminalRole,
                    boundaryRole: record.boundaryRole,
                    projectionStatus: record.projectionStatus,
                    length: Math.round(length * 100) / 100,
                    start: {
                      x: Math.round(edge.start.x * 100) / 100,
                      y: Math.round(edge.start.y * 100) / 100
                    },
                    end: {
                      x: Math.round(edge.end.x * 100) / 100,
                      y: Math.round(edge.end.y * 100) / 100
                    }
                  }
                ]
              : []
          })
        )
      )

    const collectFilledFaceIntrusions = (
      polygonRecords: {
        polygons: { x: number; y: number }[][]
        intervalId?: string
        splitRangeId?: string
        terminalRole?: string
        boundaryRole?: string
        projectionStatus?: string
      }[]
    ) => {
      const seenSamples = new Set<string>()
      return polygonRecords.flatMap((record) =>
        record.polygons.flatMap((polygon) => {
          if (!highCurvatureAnchor) {
            return []
          }
          const radius = stroke.width * 9
          const nearbyVertexSamples = polygon.filter(
            (point) => pointDistance(point, highCurvatureAnchor) <= radius
          )
          const nearbyEdgeSamples = getPolygonEdges(polygon).flatMap((edge) => {
            const minX = Math.min(edge.start.x, edge.end.x)
            const maxX = Math.max(edge.start.x, edge.end.x)
            const minY = Math.min(edge.start.y, edge.end.y)
            const maxY = Math.max(edge.start.y, edge.end.y)
            if (
              highCurvatureAnchor.x < minX - radius ||
              highCurvatureAnchor.x > maxX + radius ||
              highCurvatureAnchor.y < minY - radius ||
              highCurvatureAnchor.y > maxY + radius
            ) {
              return []
            }
            const midpoint = {
              x: (edge.start.x + edge.end.x) / 2,
              y: (edge.start.y + edge.end.y) / 2
            }
            return pointDistance(midpoint, highCurvatureAnchor) <= radius
              ? [midpoint]
              : []
          })

          return [...nearbyVertexSamples, ...nearbyEdgeSamples].flatMap(
            (point) => {
              if (
                !isPointVisibleThroughClipPolygons(point, record.clipPolygons)
              ) {
                return []
              }
              const sampleKey = `${Math.round(point.x * 20)}:${Math.round(
                point.y * 20
              )}`
              if (seenSamples.has(sampleKey)) {
                return []
              }
              seenSamples.add(sampleKey)
              if (
                !isPointInsideResolvedLegalDomainForTest(
                  point,
                  sourcePath,
                  0,
                  fillRegions
                )
              ) {
                return []
              }
              const distanceToFillBoundary =
                getPointLegalBoundaryDistanceForTest(point, sourcePath)
              return distanceToFillBoundary > 0.02
                ? [
                    {
                      intervalId: record.intervalId,
                      splitRangeId: record.splitRangeId,
                      terminalRole: record.terminalRole,
                      boundaryRole: record.boundaryRole,
                      projectionStatus: record.projectionStatus,
                      point: {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                      },
                      distanceToFillBoundary:
                        Math.round(distanceToFillBoundary * 100) / 100
                    }
                  ]
                : []
            }
          )
        })
      )
    }

    const packetRecords = packets.map((packet) => ({
      polygons: getPacketProductPolygons(packet),
      clipPolygons: packet.geometry.renderDescriptor?.clipPolygons,
      intervalId: packet.geometry.debugMeta?.intervalId,
      splitRangeId: packet.geometry.debugMeta?.domainPlanSplitRangeId,
      terminalRole: packet.geometry.debugMeta?.domainPlanTerminalRole,
      boundaryRole: packet.geometry.debugMeta?.domainPlanBoundaryRole
    }))
    const oversizedPacketEdges =
      collectOversizedHighCurvatureEdges(packetRecords)
    expect(
      oversizedPacketEdges.slice(0, 20),
      JSON.stringify(
        {
          message:
            'outside dashed product geometry must not emit oversized high-curvature edges before legality sampling; long edges are usually broken miter/sliver output',
          oversizedEdgeCount: oversizedPacketEdges.length,
          firstOversizedEdges: oversizedPacketEdges.slice(0, 20)
        },
        null,
        2
      )
    ).toEqual([])

    const filledFaceIntrusions = collectFilledFaceIntrusions(packetRecords)

    expect(
      filledFaceIntrusions.slice(0, 20),
      JSON.stringify(
        {
          message:
            'outside dashed product geometry must stay on exterior/non-filled side; filled-face samples mean the high-curvature mask clip is incomplete',
          intrusionCount: filledFaceIntrusions.length,
          firstIntrusions: filledFaceIntrusions.slice(0, 20),
          intrusionPacketContracts: packets
            .filter((packet) =>
              filledFaceIntrusions.some(
                (intrusion) =>
                  intrusion.intervalId === packet.geometry.debugMeta?.intervalId
              )
            )
            .map((packet) => packet.geometry.debugMeta)
        },
        null,
        2
      )
    ).toEqual([])

    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
    const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
      finalFaces,
      {
        backend: getGeometryBackend()
      }
    )
    const renderEntries = withStrokeDiagnosticsMode('full', () =>
      toSolidCenterStrokeRenderEntriesFromFinalFaces(collapsedFinalFaces, {
        exactBackend: getGeometryBackend()
      })
    )
    const renderRecords = renderEntries.map((entry) => ({
      polygons: getRenderEntryProductPolygons(entry),
      clipPolygons: entry.clipPolygons,
      intervalId: entry.debugMeta?.intervalId,
      splitRangeId: entry.debugMeta?.domainPlanSplitRangeId,
      terminalRole: entry.debugMeta?.domainPlanTerminalRole,
      boundaryRole: entry.debugMeta?.domainPlanBoundaryRole,
      projectionStatus: entry.debugMeta?.visualOverlapCollapseStatus
    }))
    const oversizedRenderEdges =
      collectOversizedHighCurvatureEdges(renderRecords)
    expect(
      oversizedRenderEdges.slice(0, 20),
      JSON.stringify(
        {
          message:
            'outside dashed render projection must not create oversized high-curvature edges before legality sampling',
          oversizedEdgeCount: oversizedRenderEdges.length,
          firstOversizedEdges: oversizedRenderEdges.slice(0, 20)
        },
        null,
        2
      )
    ).toEqual([])

    const projectedIntrusions = collectFilledFaceIntrusions(renderRecords)

    expect(
      projectedIntrusions.slice(0, 20),
      JSON.stringify(
        {
          message:
            'outside dashed render projection must preserve the same exterior-only legality as packet geometry',
          intrusionCount: projectedIntrusions.length,
          firstIntrusions: projectedIntrusions.slice(0, 20)
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('should run: keep self-intersecting outside dashed overlap scoped to visible coverage units', () => {
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
      'self-intersecting-mixed-star:outside-render-alpha-overdraw',
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
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
    const renderEntries = withStrokeDiagnosticsMode('full', () =>
      toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces, {
        exactBackend: getGeometryBackend()
      })
    )
    const productRenderEntries = renderEntries.filter(
      (entry) =>
        entry.debugMeta?.productSignature?.startsWith('constrained-dashed:') ===
          true && entry.debugMeta?.strokePosition === 'outside'
    )
    const finalFaceIntervalIds = new Set(
      finalFaces
        .flatMap((face) => getDebugMetaIntervalIds(face.debugMeta))
        .filter((intervalId): intervalId is string => intervalId !== undefined)
    )
    const renderEntryIntervalIds = new Set(
      productRenderEntries
        .flatMap((entry) => getDebugMetaIntervalIds(entry.debugMeta))
        .filter((intervalId): intervalId is string => intervalId !== undefined)
    )

    expect(finalFaces.length).toBeGreaterThan(0)
    expect(finalFaceIntervalIds.size).toBeGreaterThan(1)
    const renderCompletenessSummary = {
      finalFaceIntervalCount: finalFaceIntervalIds.size,
      renderEntryCount: productRenderEntries.length,
      renderEntryIntervalCount: renderEntryIntervalIds.size,
      missingIntervalIds: [...finalFaceIntervalIds].filter(
        (intervalId) => !renderEntryIntervalIds.has(intervalId)
      )
    }

    expect(
      renderCompletenessSummary,
      JSON.stringify(
        {
          renderCompletenessSummary,
          renderEntries: renderEntries.map((entry) => ({
            cacheKey: entry.cacheKey,
            intervalId: entry.debugMeta?.intervalId,
            intervalIds: entry.debugMeta?.intervalIds,
            productMode: entry.debugMeta?.productMode,
            productSignature: entry.debugMeta?.productSignature,
            domainMode: entry.debugMeta?.domainMode,
            strokePosition: entry.debugMeta?.strokePosition,
            collapseStatus: entry.debugMeta?.visualOverlapCollapseStatus,
            polygonCount: entry.polygons.length,
            clipPolygonCount: entry.clipPolygons?.length ?? 0
          }))
        },
        null,
        2
      )
    ).toMatchObject({
      finalFaceIntervalCount: finalFaceIntervalIds.size,
      renderEntryIntervalCount: finalFaceIntervalIds.size,
      missingIntervalIds: []
    })
    expect(
      productRenderEntries.every(
        (entry) =>
          getDebugMetaIntervalIds(entry.debugMeta).length > 0 &&
          ((entry.debugMeta?.dashEndpointCapPolicySignature !== undefined &&
            entry.debugMeta?.dashEndpointCapPolicyTerminalRole !== undefined) ||
            (entry.debugMeta?.dashEndpointCapPolicySignatures?.length ?? 0) >
              0) &&
          (entry.debugMeta?.smoothContinuityGroupId !== undefined ||
            (entry.debugMeta?.smoothContinuityGroupIds?.length ?? 0) > 0) &&
          getRenderEntryProductPolygons(entry).length > 0 &&
          (entry.strokeMaskPolygons?.length ?? 0) === 0 &&
          getRenderEntryProductStrokePaths(entry).length === 0 &&
          getRenderEntryProductClipPolygons(entry).length === 0 &&
          entry.fillPolygons === undefined
      )
    ).toBe(true)
    expect(
      productRenderEntries.map((entry) => ({
        cacheKey: entry.cacheKey,
        intervalId: entry.debugMeta?.intervalId,
        strokePathCount: getRenderEntryProductStrokePaths(entry).length,
        strokeMaskPolygonCount: entry.strokeMaskPolygons?.length ?? 0,
        clipPolygonCount: getRenderEntryProductClipPolygons(entry).length,
        polygonCount: entry.polygons.length,
        productPolygonRoute:
          (entry.strokeMaskPolygons?.length ?? 0) === 0 &&
          getRenderEntryProductStrokePaths(entry).length === 0 &&
          getRenderEntryProductClipPolygons(entry).length === 0
      })),
      JSON.stringify(
        {
          message:
            'outside dashed render projection must expose every formal DashProductInterval through product polygon entries; masks, path groups, or clips would create a separate visible product route'
        },
        null,
        2
      )
    ).toEqual(
      productRenderEntries.map((entry) => ({
        cacheKey: entry.cacheKey,
        intervalId: entry.debugMeta?.intervalId,
        strokePathCount: getRenderEntryProductStrokePaths(entry).length,
        strokeMaskPolygonCount: entry.strokeMaskPolygons?.length ?? 0,
        clipPolygonCount: getRenderEntryProductClipPolygons(entry).length,
        polygonCount: entry.polygons.length,
        productPolygonRoute: true
      }))
    )
  })
})
