import { describe, expect, it } from 'vitest'
import {
  attachStrokePacketDebugMeta,
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeFinalFaces,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
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
  buildVectorGeometryModelPath,
  slicePathGeometryPoints
} from '../components/stroke-render/path-geometry'
import { buildConstrainedDashedLocalSideStrokePolygons } from '../components/stroke-render/constrained-dashed-local-side-geometry'
import { buildDashedCenterRibbonGeometry } from '../components/stroke-render/dashed-center-ribbon-geometry'
import { isSimpleClosedPolygon } from '../components/stroke-render/solid-stroke-geometry-core'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  FillKinds,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'

const getOnlyRenderableStroke = (
  strokes: Parameters<typeof getRenderableStrokes>[0]
) => {
  const [stroke] = getRenderableStrokes(strokes)
  if (!stroke) {
    throw new Error('Expected one renderable stroke')
  }
  return stroke
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

const findSelectedSidePolylineViolations = (
  polygon: { x: number; y: number }[],
  boundary: { x: number; y: number }[],
  selectedSide: 1 | -1,
  crossTolerance = 0.1
) =>
  polygon.flatMap((point) =>
    boundary.slice(0, -1).flatMap((start, index) => {
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const violates =
        selectedSide > 0 ? cross < -crossTolerance : cross > crossTolerance
      return violates ? [{ point, segmentIndex: index, cross }] : []
    })
  )

const findSelectedSideNearestPolylineViolations = (
  polygon: { x: number; y: number }[],
  boundary: { x: number; y: number }[],
  selectedSide: 1 | -1,
  crossTolerance = 0.1
) =>
  polygon.flatMap((point) => {
    let nearestSegmentIndex = -1
    let nearestDistance = Number.POSITIVE_INFINITY
    let nearestCross = 0

    boundary.slice(0, -1).forEach((start, index) => {
      const end = boundary[index + 1]
      const distance = pointSegmentDistance(point, start, end)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestSegmentIndex = index
        nearestCross =
          (end.x - start.x) * (point.y - start.y) -
          (end.y - start.y) * (point.x - start.x)
      }
    })

    const violates =
      selectedSide > 0
        ? nearestCross < -crossTolerance
        : nearestCross > crossTolerance
    return violates
      ? [{ point, segmentIndex: nearestSegmentIndex, cross: nearestCross }]
      : []
  })

const findStartCapPlaneViolations = (
  polygons: { x: number; y: number }[][],
  origin: { x: number; y: number },
  tangent: { x: number; y: number },
  tolerance = 0.75
) =>
  polygons.flatMap((polygon) =>
    [...polygon, ...samplePolygonEdges(polygon, 0.75)].flatMap((point) => {
      const projection =
        (point.x - origin.x) * tangent.x + (point.y - origin.y) * tangent.y
      return projection < -tolerance
        ? [
            {
              projection: Math.round(projection * 100) / 100,
              point: {
                x: Math.round(point.x * 100) / 100,
                y: Math.round(point.y * 100) / 100
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

const signedPolygonArea = (points: { x: number; y: number }[]) => {
  let area = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    area += point.x * next.y - next.x * point.y
  })
  return area / 2
}

const getClosedSegmentDistanceRanges = (points: { x: number; y: number }[]) => {
  let cursor = 0
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    const length = pointDistance(point, next)
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + length
    }
    cursor += length
    return range
  })
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

const packetCrossesSourceSegmentBoundary = (
  packet: ReturnType<
    typeof buildConstrainedDashedStrokeResolvedPackets
  >[number],
  segmentRanges: ReturnType<typeof getPathSegmentDistanceRanges>,
  totalLength: number
) => {
  const startDistance = packet.geometry.debugMeta?.startDistance
  const endDistance = packet.geometry.debugMeta?.endDistance
  if (startDistance === undefined || endDistance === undefined) {
    return false
  }

  return segmentRanges.some(
    (range) =>
      range.endDistance > 0 &&
      range.endDistance < totalLength &&
      intervalContainsDistance(
        range.endDistance,
        startDistance,
        endDistance,
        packet.geometry.debugMeta?.wrapsSeam === true,
        totalLength
      ) &&
      Math.abs(range.endDistance - startDistance) > 1e-4 &&
      Math.abs(range.endDistance - endDistance) > 1e-4
  )
}

const normalizeClosedTestPoints = <T extends { x: number; y: number }>(
  points: T[]
) => {
  if (
    points.length > 1 &&
    pointDistance(points[0], points[points.length - 1]) <= 1e-6
  ) {
    return points.slice(0, -1)
  }

  return points
}

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

const isSharpGuardVertex = (
  points: { x: number; y: number; sharp?: boolean }[],
  index: number
) => {
  if (points[index].sharp === false) {
    return false
  }

  const previous = points[(index - 1 + points.length) % points.length]
  const point = points[index]
  const next = points[(index + 1) % points.length]
  const incoming = normalizeVector({
    x: point.x - previous.x,
    y: point.y - previous.y
  })
  const outgoing = normalizeVector({
    x: next.x - point.x,
    y: next.y - point.y
  })
  if (!incoming || !outgoing) {
    return false
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  return Math.acos(dot) >= Math.PI / 4
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

const findNearestTopologyDistance = (
  point: { x: number; y: number },
  topologyPoints: { x: number; y: number }[],
  topologyRanges: ReturnType<typeof getClosedSegmentDistanceRanges>
) => {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  topologyPoints.forEach((candidate, index) => {
    const distance = pointDistance(point, candidate)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  return topologyRanges[nearestIndex]?.startDistance ?? 0
}

const getGuardEdgesForInterval = (
  topologyPoints: { x: number; y: number }[],
  guardSourcePoints: { x: number; y: number; sharp?: boolean }[],
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  const guardPoints = normalizeClosedTestPoints(guardSourcePoints)
  const topologyRanges = getClosedSegmentDistanceRanges(
    normalizeClosedTestPoints(topologyPoints)
  )
  const totalLength =
    topologyRanges[topologyRanges.length - 1]?.endDistance ?? 0
  const edges: {
    start: { x: number; y: number }
    end: { x: number; y: number }
  }[] = []
  const addEdge = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    if (
      !edges.some(
        (edge) =>
          pointDistance(edge.start, start) <= 1e-6 &&
          pointDistance(edge.end, end) <= 1e-6
      )
    ) {
      edges.push({ start, end })
    }
  }

  guardPoints.forEach((point, index) => {
    const distance = findNearestTopologyDistance(
      point,
      topologyPoints,
      topologyRanges
    )
    if (
      isSharpGuardVertex(guardPoints, index) &&
      isDistanceInsideInterval(
        distance,
        startDistance,
        endDistance,
        wrapsSeam,
        totalLength
      )
    ) {
      const previous =
        guardPoints[(index - 1 + guardPoints.length) % guardPoints.length]
      const next = guardPoints[(index + 1) % guardPoints.length]
      addEdge(previous, point)
      addEdge(point, next)
    }
  })

  return edges
}

const getAllSharpGuardEdges = (
  guardSourcePoints: { x: number; y: number; sharp?: boolean }[]
) => {
  const guardPoints = normalizeClosedTestPoints(guardSourcePoints)
  const edges: {
    start: { x: number; y: number }
    end: { x: number; y: number }
  }[] = []
  const addEdge = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    if (
      !edges.some(
        (edge) =>
          pointDistance(edge.start, start) <= 1e-6 &&
          pointDistance(edge.end, end) <= 1e-6
      )
    ) {
      edges.push({ start, end })
    }
  }

  guardPoints.forEach((point, index) => {
    if (!isSharpGuardVertex(guardPoints, index)) {
      return
    }

    addEdge(
      guardPoints[(index - 1 + guardPoints.length) % guardPoints.length],
      point
    )
    addEdge(point, guardPoints[(index + 1) % guardPoints.length])
  })

  return edges
}

const polygonBoundsOverlapSegment = (
  polygon: { x: number; y: number }[],
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const bounds = getPointBounds(polygon)
  return (
    Math.min(start.x, end.x) <= bounds.maxX + 1e-6 &&
    Math.max(start.x, end.x) + 1e-6 >= bounds.minX &&
    Math.min(start.y, end.y) <= bounds.maxY + 1e-6 &&
    Math.max(start.y, end.y) + 1e-6 >= bounds.minY
  )
}

const findSelectedSideViolations = (
  points: { x: number; y: number }[],
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  authoredPosition: 'inside' | 'outside',
  guardPoints: { x: number; y: number; sharp?: boolean }[] = points
) => {
  const normalizedGuardPoints = normalizeClosedTestPoints(guardPoints)
  const area = signedPolygonArea(normalizedGuardPoints)
  const effectivePosition =
    area >= 0
      ? authoredPosition
      : authoredPosition === 'inside'
        ? 'outside'
        : 'inside'
  const selectedSide = effectivePosition === 'inside' ? 1 : -1

  return packets.flatMap((packet) => {
    const startDistance = packet.geometry.debugMeta?.startDistance
    const endDistance = packet.geometry.debugMeta?.endDistance
    if (typeof startDistance !== 'number' || typeof endDistance !== 'number') {
      return []
    }

    const guardEdges = getGuardEdgesForInterval(
      points,
      normalizedGuardPoints,
      startDistance,
      endDistance,
      packet.geometry.debugMeta?.wrapsSeam === true
    )

    return packet.geometry.polygons.flatMap((polygon) =>
      [...polygon, ...samplePolygonEdges(polygon)].flatMap((candidatePoint) =>
        guardEdges.flatMap((edge, segmentIndex) => {
          const { start, end } = edge
          const cross =
            (end.x - start.x) * (candidatePoint.y - start.y) -
            (end.y - start.y) * (candidatePoint.x - start.x)
          const violates = selectedSide > 0 ? cross < -1e-4 : cross > 1e-4
          return violates
            ? [
                {
                  geometryId: packet.geometry.geometryId,
                  segmentIndex,
                  cross
                }
              ]
            : []
        })
      )
    )
  })
}

const findSelectedSideCrossingViolations = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  authoredPosition: 'inside' | 'outside',
  guardPoints: { x: number; y: number; sharp?: boolean }[]
) => {
  const normalizedGuardPoints = normalizeClosedTestPoints(guardPoints)
  const area = signedPolygonArea(normalizedGuardPoints)
  const effectivePosition =
    area >= 0
      ? authoredPosition
      : authoredPosition === 'inside'
        ? 'outside'
        : 'inside'
  const selectedSide = effectivePosition === 'inside' ? 1 : -1
  const guardEdges = getAllSharpGuardEdges(normalizedGuardPoints)

  return packets.flatMap((packet) =>
    packet.geometry.polygons.flatMap((polygon) =>
      guardEdges.flatMap((edge, edgeIndex) => {
        if (!polygonBoundsOverlapSegment(polygon, edge.start, edge.end)) {
          return []
        }

        let hasInside = false
        let hasOutside = false
        for (const point of polygon) {
          const cross =
            (edge.end.x - edge.start.x) * (point.y - edge.start.y) -
            (edge.end.y - edge.start.y) * (point.x - edge.start.x)
          const inside = selectedSide > 0 ? cross >= -1e-4 : cross <= 1e-4
          hasInside ||= inside
          hasOutside ||= !inside
        }

        return hasInside && hasOutside
          ? [{ geometryId: packet.geometry.geometryId, edgeIndex }]
          : []
      })
    )
  )
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

  it('should run: emit local-side constrained dashed packets for self-intersecting paths without claiming exact arrangement', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-inside-dashed',
      [
        { x: 192.42083700791653, y: 0 },
        { x: 11.358174406717296, y: 364.1297089212308 },
        { x: 360.120941483566, y: 144.31562775593738 },
        { x: 0, y: 14.030686031827244 },
        { x: 270.59180204238254, y: 345.42212754546125 }
      ],
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
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)
  })

  it('should run: keep self-intersecting inside and outside dashed packets side-aware instead of center-derived', () => {
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
    const insidePackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-reference-inside',
      points,
      true,
      [
        createDefaultStroke({
          ...baseStroke,
          position: 'inside'
        })
      ]
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
      ]
    )

    expect(insidePackets.length).toBeGreaterThan(0)
    expect(outsidePackets.length).toBeGreaterThan(0)
    expect(
      [...insidePackets, ...outsidePackets].every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)

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

  it('should run: keep the reported vector-6 inside dashed intervals as bounded cell faces', () => {
    const tp12 = { x: 192.42083700791653, y: 0 }
    const tp13 = { x: 11.358174406717296, y: 364.1297089212308 }
    const tp14 = { x: 360.120941483566, y: 144.31562775593738 }
    const tp15 = { x: 0, y: 14.030686031827244 }
    const tp16 = { x: 270.59180204238254, y: 345.42212754546125 }
    const points = [
      ...sampleCubic(
        tp12,
        { x: 170.10536493824844, y: 119.07041481724248 },
        { x: -42.09205809548172, y: 343.2841182453731 },
        tp13,
        16
      ),
      ...sampleCubic(
        tp13,
        { x: 78.17096503446606, y: 390.18669726605293 },
        tp14,
        tp14,
        8,
        false
      ),
      tp15,
      ...sampleCubic(
        tp15,
        { x: 0, y: 14.030686031827244 },
        { x: 263.9105229796076, y: 362.79345310867603 },
        tp16,
        16,
        false
      ),
      ...sampleCubic(
        tp16,
        { x: 277.2730811051575, y: 328.05080198224647 },
        tp12,
        tp12,
        8,
        false
      )
    ]
    const guardPoints = [
      { ...tp12, sharp: true },
      { ...tp13, sharp: false },
      { ...tp14, sharp: true },
      { ...tp15, sharp: true },
      { ...tp16, sharp: false }
    ]
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:reported-inside-dashed',
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
      { selectedSideGuardPoints: guardPoints }
    )

    expect(packets.length).toBeGreaterThan(1)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting' &&
          packet.geometry.polygons.length >= 1 &&
          packet.geometry.polygons.every((polygon) =>
            isSimpleClosedPolygon(polygon)
          )
      )
    ).toBe(true)

    expect(
      findSelectedSideViolations(points, packets, 'inside', guardPoints)
    ).toEqual([])
    const seamAdjacentPackets = packets.filter(
      (packet) =>
        packet.geometry.bounds.minY < 40 &&
        packet.geometry.bounds.minX < tp12.x + 16 &&
        packet.geometry.bounds.maxX > tp12.x - 16
    )
    expect(seamAdjacentPackets.length).toBeGreaterThanOrEqual(2)
    expect(
      findSelectedSideCrossingViolations(
        seamAdjacentPackets,
        'inside',
        guardPoints
      )
    ).toEqual([])
  })

  it('should run: build reported vector-6 seam dashes from true source segments, not tangent caps', () => {
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
        x: 161.0183251984924,
        y: 122.56543010176405,
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
      pathId: 'vector-6',
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
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:reported-inside-dashed-source-path',
      topology.normalizedPoints,
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
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const firstInterval = packets.find(
      (packet) => packet.geometry.debugMeta?.intervalId === 'interval:0'
    )
    const acceptedPackets = attachStrokePacketDebugMeta(packets, {
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })
    const finalFaces = buildSolidCenterStrokeFinalFaces(acceptedPackets)
    const firstIntervalFinalFace = finalFaces.find((face) =>
      face.intervalIds.includes('interval:0')
    )
    const closingSegmentTail = slicePathGeometryPoints(
      sourcePath,
      sourcePath.totalLength - 35,
      sourcePath.totalLength,
      false
    )
    const firstSegmentHead = slicePathGeometryPoints(sourcePath, 0, 35, false)
    const selectedSide = signedPolygonArea(guardPoints) >= 0 ? 1 : -1
    expect(firstInterval).toBeDefined()
    expect(firstIntervalFinalFace).toBeDefined()
    if (firstInterval) {
      const firstPolygons = firstInterval.geometry.polygons
      expect(firstPolygons.length).toBeGreaterThanOrEqual(1)
      const firstSegmentStartTangent = {
        x: firstSegmentHead[1].x - firstSegmentHead[0].x,
        y: firstSegmentHead[1].y - firstSegmentHead[0].y
      }
      const firstSegmentStartTangentLength = Math.hypot(
        firstSegmentStartTangent.x,
        firstSegmentStartTangent.y
      )
      expect(
        findStartCapPlaneViolations(firstPolygons, firstSegmentHead[0], {
          x: firstSegmentStartTangent.x / firstSegmentStartTangentLength,
          y: firstSegmentStartTangent.y / firstSegmentStartTangentLength
        })
      ).toEqual([])
      expect(
        firstPolygons.reduce(
          (count, polygon) =>
            count +
            polygon.filter(
              (point) => pointPolylineDistance(point, firstSegmentHead) < 1e-4
            ).length,
          0
        )
      ).toBeGreaterThanOrEqual(8)
      const firstOutsideLegalDomain = firstPolygons.flatMap((polygon) =>
        polygon.filter(
          (point) =>
            !isPointInsideEvenOdd(point, topology.normalizedPoints) &&
            pointClosedPolylineDistance(point, topology.normalizedPoints) > 0.25
        )
      )
      expect(firstOutsideLegalDomain).toEqual([])
    }
    for (const packet of packets) {
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
        Math.max(2, Math.min(12, Math.floor(sourceInterval.length * 0.25)))
      )
      const singleResolvedStrip =
        packet.geometry.polygons.length === 1 &&
        (packet.geometry.polygons[0]?.length ?? 0) >= 4
      expect(
        sourceEdgePointCount >= expectedSourceEdgePoints || singleResolvedStrip
      ).toBe(true)
    }
    const legalBoundary = topology.normalizedPoints
    const endInterval = packets
      .filter(
        (packet) => packet.geometry.debugMeta?.startDistance !== undefined
      )
      .sort(
        (left, right) =>
          (right.geometry.debugMeta?.startDistance ?? 0) -
          (left.geometry.debugMeta?.startDistance ?? 0)
      )[0]
    expect(endInterval).toBeDefined()
    if (!endInterval) {
      throw new Error('Expected vector-6 final seam dash interval')
    }
    const endPolygons = endInterval.geometry.polygons
    expect(
      endPolygons.reduce(
        (count, polygon) =>
          count +
          polygon.filter(
            (point) => pointPolylineDistance(point, closingSegmentTail) < 1e-4
          ).length,
        0
      )
    ).toBeGreaterThan(2)
    endPolygons.forEach((polygon) => {
      expect(
        findSelectedSidePolylineViolations(
          polygon,
          closingSegmentTail,
          selectedSide
        )
      ).toEqual([])
    })
    endPolygons.forEach((polygon) => {
      expect(
        findSelectedSideNearestPolylineViolations(
          polygon,
          firstSegmentHead,
          selectedSide
        )
      ).toEqual([])
    })
    const endOutsideLegalDomain = endPolygons.flatMap((polygon) =>
      polygon.filter(
        (point) =>
          !isPointInsideEvenOdd(point, legalBoundary) &&
          pointClosedPolylineDistance(point, legalBoundary) > 0.25
      )
    )
    expect(endOutsideLegalDomain).toEqual([])
    const outsideStrokeBandEdgeSamples = packets.flatMap((packet) =>
      packet.geometry.polygons.flatMap((polygon) =>
        samplePolygonEdges(polygon).flatMap((point) =>
          pointClosedPolylineDistance(point, sourcePath.sampledPoints) > 10.25
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
    expect(outsideStrokeBandEdgeSamples).toEqual([])
    const squareCapPackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:reported-inside-dashed-square-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const firstSquareInterval = squareCapPackets.find(
      (packet) => packet.geometry.debugMeta?.intervalId === 'interval:0'
    )
    expect(firstSquareInterval).toBeDefined()
    firstSquareInterval?.geometry.polygons.forEach((polygon) => {
      expect(
        findSelectedSidePolylineViolations(
          polygon,
          closingSegmentTail,
          selectedSide
        )
      ).toEqual([])
      expect(
        findSelectedSideNearestPolylineViolations(
          polygon,
          firstSegmentHead,
          selectedSide
        )
      ).toEqual([])
    })
    const endSquareInterval = squareCapPackets
      .filter(
        (packet) => packet.geometry.debugMeta?.startDistance !== undefined
      )
      .sort(
        (left, right) =>
          (right.geometry.debugMeta?.startDistance ?? 0) -
          (left.geometry.debugMeta?.startDistance ?? 0)
      )[0]
    expect(endSquareInterval).toBeDefined()
    endSquareInterval?.geometry.polygons.forEach((polygon) => {
      expect(
        findSelectedSidePolylineViolations(
          polygon,
          closingSegmentTail,
          selectedSide
        )
      ).toEqual([])
      expect(
        findSelectedSideNearestPolylineViolations(
          polygon,
          firstSegmentHead,
          selectedSide
        )
      ).toEqual([])
    })
    const pathSegmentRangesForSquare = getPathSegmentDistanceRanges(
      sourcePath.segments
    )
    const leftSharpVertexDistance =
      pathSegmentRangesForSquare[3]?.startDistance ?? 0
    const leftSharpPreviousTail = slicePathGeometryPoints(
      sourcePath,
      leftSharpVertexDistance - 35,
      leftSharpVertexDistance,
      false
    )
    const leftSharpNextHead = slicePathGeometryPoints(
      sourcePath,
      leftSharpVertexDistance,
      leftSharpVertexDistance + 35,
      false
    )
    const leftSharpPoint = {
      x: points['tp-15'].x,
      y: points['tp-15'].y
    }
    const leftSharpSquarePackets = squareCapPackets.filter((packet) =>
      packet.geometry.polygons.some((polygon) =>
        polygon.some((point) => pointDistance(point, leftSharpPoint) <= 55)
      )
    )
    expect(leftSharpSquarePackets.length).toBeGreaterThan(0)
    leftSharpSquarePackets.forEach((packet) => {
      packet.geometry.polygons.forEach((polygon) => {
        expect(
          findSelectedSidePolylineViolations(
            polygon,
            leftSharpPreviousTail,
            selectedSide
          )
        ).toEqual([])
        expect(
          findSelectedSideNearestPolylineViolations(
            polygon,
            leftSharpNextHead,
            selectedSide,
            0.5
          )
        ).toEqual([])
      })
    })
    const squareOutsideLegalDomainEdgeSamples = squareCapPackets.flatMap(
      (packet) =>
        packet.geometry.polygons.flatMap((polygon) =>
          samplePolygonEdges(polygon).flatMap((point) =>
            (pointDistance(point, leftSharpPoint) <= 70 ||
              pointDistance(point, {
                x: points['tp-14'].x,
                y: points['tp-14'].y
              }) <= 70) &&
            !isPointInsideEvenOdd(point, legalBoundary) &&
            pointClosedPolylineDistance(point, legalBoundary) > 0.25
              ? [
                  {
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    startDistance:
                      Math.round(
                        (packet.geometry.debugMeta?.startDistance ?? 0) * 100
                      ) / 100,
                    endDistance:
                      Math.round(
                        (packet.geometry.debugMeta?.endDistance ?? 0) * 100
                      ) / 100,
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
    expect(squareOutsideLegalDomainEdgeSamples).toEqual([])
    const longSquareCapPackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:reported-inside-dashed-long-square-source-path',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'square',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints
      }
    )
    const longSquareLeftSharpPackets = longSquareCapPackets.filter((packet) =>
      packet.geometry.polygons.some((polygon) =>
        polygon.some((point) => pointDistance(point, leftSharpPoint) <= 55)
      )
    )
    expect(longSquareLeftSharpPackets.length).toBeGreaterThan(0)
    longSquareLeftSharpPackets.forEach((packet) => {
      packet.geometry.polygons.forEach((polygon) => {
        expect(
          findSelectedSidePolylineViolations(
            polygon,
            leftSharpPreviousTail,
            selectedSide
          )
        ).toEqual([])
        expect(
          findSelectedSideNearestPolylineViolations(
            polygon,
            leftSharpNextHead,
            selectedSide,
            0.5
          )
        ).toEqual([])
      })
    })
    const longSquareLeftSharpEdgeViolations = longSquareCapPackets.flatMap(
      (packet) =>
        packet.geometry.polygons.flatMap((polygon) =>
          samplePolygonEdges(polygon).flatMap((point) =>
            pointDistance(point, leftSharpPoint) <= 80 &&
            (findSelectedSidePolylineViolations(
              [point],
              leftSharpPreviousTail,
              selectedSide
            ).length > 0 ||
              findSelectedSideNearestPolylineViolations(
                [point],
                leftSharpNextHead,
                selectedSide,
                0.5
              ).length > 0)
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
    expect(longSquareLeftSharpEdgeViolations).toEqual([])
    const longSquareOutsideLegalDomainEdgeSamples =
      longSquareCapPackets.flatMap((packet) =>
        packet.geometry.polygons.flatMap((polygon) =>
          samplePolygonEdges(polygon).flatMap((point) =>
            (pointDistance(point, leftSharpPoint) <= 80 ||
              pointDistance(point, {
                x: points['tp-14'].x,
                y: points['tp-14'].y
              }) <= 80) &&
            !isPointInsideEvenOdd(point, legalBoundary) &&
            pointClosedPolylineDistance(point, legalBoundary) > 0.25
              ? [
                  {
                    intervalId: packet.geometry.debugMeta?.intervalId,
                    startDistance:
                      Math.round(
                        (packet.geometry.debugMeta?.startDistance ?? 0) * 100
                      ) / 100,
                    endDistance:
                      Math.round(
                        (packet.geometry.debugMeta?.endDistance ?? 0) * 100
                      ) / 100,
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
    expect(longSquareOutsideLegalDomainEdgeSamples).toEqual([])
    const invalidSimplePackets = packets.filter((packet) => {
      return packet.geometry.polygons.some(
        (polygon) => !isSimpleClosedPolygon(polygon)
      )
    })
    expect(
      invalidSimplePackets.map((packet) => ({
        intervalId: packet.geometry.debugMeta?.intervalId,
        bounds: packet.geometry.bounds
      }))
    ).toEqual([])
    const sourceSegmentRanges = getPathSegmentDistanceRanges(
      sourcePath.segments
    )
    const sourceSegmentCrossingPackets = packets.filter((packet) =>
      packetCrossesSourceSegmentBoundary(
        packet,
        sourceSegmentRanges,
        sourcePath.totalLength
      )
    )
    expect(sourceSegmentCrossingPackets.length).toBeGreaterThan(0)
    for (const packet of sourceSegmentCrossingPackets) {
      const startDistance = packet.geometry.debugMeta?.startDistance ?? 0
      const endDistance = packet.geometry.debugMeta?.endDistance ?? 0
      const intervalLength =
        packet.geometry.debugMeta?.wrapsSeam === true
          ? sourcePath.totalLength - startDistance + endDistance
          : endDistance - startDistance
      const polygonAreaSum = packet.geometry.polygons.reduce(
        (sum, polygon) => sum + Math.abs(signedPolygonArea(polygon)),
        0
      )

      expect(packet.geometry.polygons.length).toBeGreaterThan(1)
      expect(polygonAreaSum).toBeLessThanOrEqual(10 * (intervalLength + 40) * 3)
    }
    ;(['butt', 'square', 'round'] as const).forEach((capType) => {
      const capPackets =
        capType === 'butt'
          ? packets
          : buildConstrainedDashedStrokeResolvedPackets(
              `vector-6:reported-inside-dashed-${capType}-source-path-events`,
              topology.normalizedPoints,
              true,
              [
                createDefaultStroke({
                  width: 10,
                  style: 'dashed',
                  position: 'inside',
                  joinType: 'miter',
                  capType,
                  dashPattern: [27, 20],
                  dashOffset: 0
                })
              ],
              {
                topology,
                sourcePath,
                selectedSideGuardPoints: guardPoints
              }
            )
      const capCrossingPackets = capPackets.filter((packet) =>
        packetCrossesSourceSegmentBoundary(
          packet,
          sourceSegmentRanges,
          sourcePath.totalLength
        )
      )
      const endSegmentPackets = capPackets.filter(
        (packet) =>
          (packet.geometry.debugMeta?.startDistance ?? 0) >=
          sourceSegmentRanges[sourceSegmentRanges.length - 1].startDistance -
            1e-4
      )
      const secondSegmentFirstPackets = capPackets.filter((packet) => {
        const startDistance = packet.geometry.debugMeta?.startDistance ?? -1
        return (
          startDistance >= sourceSegmentRanges[1].startDistance - 1e-4 &&
          startDistance <= sourceSegmentRanges[1].startDistance + 60
        )
      })

      expect(capPackets.length).toBeGreaterThan(1)
      expect(capCrossingPackets.length).toBeGreaterThan(0)
      expect(endSegmentPackets.length).toBeGreaterThan(0)
      expect(secondSegmentFirstPackets.length).toBeGreaterThan(0)

      const areaSum = (targetPackets: typeof capPackets) =>
        targetPackets.reduce(
          (sum, packet) =>
            sum +
            packet.geometry.polygons.reduce(
              (polygonSum, polygon) =>
                polygonSum + Math.abs(signedPolygonArea(polygon)),
              0
            ),
          0
        )

      expect(areaSum(capCrossingPackets)).toBeGreaterThan(1)
      expect(areaSum(endSegmentPackets)).toBeGreaterThan(1)
      expect(areaSum(secondSegmentFirstPackets)).toBeGreaterThan(1)

      const seamPoint = {
        x: points['tp-12'].x,
        y: points['tp-12'].y
      }
      const eventSelectedSideViolations = [
        {
          name: 'closed-seam',
          center: seamPoint,
          radius: 70,
          previous: closingSegmentTail,
          next: firstSegmentHead
        },
        {
          name: 'left-sharp-boundary',
          center: leftSharpPoint,
          radius: 80,
          previous: leftSharpPreviousTail,
          next: leftSharpNextHead
        }
      ].flatMap((event) =>
        capPackets.flatMap((packet) =>
          packet.geometry.polygons.flatMap((polygon) =>
            samplePolygonEdges(polygon).flatMap((point) => {
              if (pointDistance(point, event.center) > event.radius) {
                return []
              }
              const previousViolations = findSelectedSidePolylineViolations(
                [point],
                event.previous,
                selectedSide
              )
              const nextViolations = findSelectedSideNearestPolylineViolations(
                [point],
                event.next,
                selectedSide,
                0.5
              )
              return previousViolations.length > 0 || nextViolations.length > 0
                ? [
                    {
                      capType,
                      event: event.name,
                      intervalId: packet.geometry.debugMeta?.intervalId,
                      point: {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                      }
                    }
                  ]
                : []
            })
          )
        )
      )
      expect(eventSelectedSideViolations).toEqual([])

      const nonSimplePackets = capPackets.filter((packet) =>
        packet.geometry.polygons.some(
          (polygon) => !isSimpleClosedPolygon(polygon)
        )
      )
      expect(
        nonSimplePackets.map((packet) => ({
          capType,
          intervalId: packet.geometry.debugMeta?.intervalId,
          bounds: packet.geometry.bounds
        }))
      ).toEqual([])
    })
    for (const packet of packets) {
      for (const polygon of packet.geometry.polygons) {
        for (const point of polygon) {
          expect(
            pointClosedPolylineDistance(point, sourcePath.sampledPoints)
          ).toBeLessThanOrEqual(10.25)
        }
      }
    }
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

  it('should run: keep repeated self-intersecting closed intervals visible as local-side constrained dashed geometry', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 50, y: 0 },
        { x: 79, y: 90 },
        { x: 2, y: 35 },
        { x: 98, y: 35 },
        { x: 21, y: 90 }
      ],
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
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'opaque-cache-key',
      ownerKey: 'typed-vector:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'rectangle-equivalent',
      intervalTopology: 'full-loop'
    })
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

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: ['rect:test:stroke:0', 'rect:test:stroke:1'],
      packetCount: 2
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

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: [
        'vector:test:network-a:stroke:0',
        'vector:test:network-b:stroke:0'
      ],
      packetCount: 2
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

    expect(packets).toHaveLength(1)

    const acceptedPackets = attachStrokePacketDebugMeta(packets, {
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })
    const [resolved] = acceptedPackets
    const [hit] = buildSolidCenterStrokeHitTestPackets(acceptedPackets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(acceptedPackets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toMatchObject({
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds.minX).toBe(-6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(86, 2)
    expect(packets[0]?.geometry.bounds.maxY).toBe(46)
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

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-dashed'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
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
          polygon.filter(
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
    expect(getInsideOutsideLegalSamples(insideRoundPacket)).toEqual([])
    expect(getCrossSegmentSourceCoverage(insideRoundPacket)).toBeGreaterThan(4)

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
