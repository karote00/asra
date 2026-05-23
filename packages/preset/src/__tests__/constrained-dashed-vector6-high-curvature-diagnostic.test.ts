import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  getConstrainedDashedVisibleIntervals
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import {
  buildVectorGeometryModelPath,
  type Vec2
} from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import { resolveSourceFamily } from '../components/stroke-render/resolved-source-family'
import { resolveStrokeDomains } from '../components/stroke-render/stroke-domain-plan'
import {
  getGeometryBackend,
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import { collapseStrokeFinalFaceVisualOverlaps } from '../components/stroke-render/stroke-candidate-arrangement'
import { toSolidCenterStrokeRenderEntriesFromFinalFaces } from '../components/stroke-render/solid-center-stroke-packets'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import { getRenderableStrokes } from '../components/stroke-render/renderable-stroke'
import { createDefaultStroke } from '@asyra/utils'

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
  const backendId = 'clipper2-vector6-high-curvature-diagnostic-test'
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

const ADJ_TP12 = { x: 192.42083700791653, y: 0 }
const ADJ_TP13 = { x: 11.358174406717296, y: 364.1297089212308 }
const ADJ_TP14 = { x: 360.120941483566, y: 144.31562775593738 }
const ADJ_TP15 = { x: 0, y: 14.030686031827244 }
const ADJ_TP16 = { x: 270.59180204238254, y: 345.42212754546125 }
const ADJ_TP12_OUT = { x: 170.10536493824844, y: 119.07041481724248 }
const ADJ_TP13_IN = { x: -42.09205809548172, y: 343.2841182453731 }
const ADJ_TP13_OUT = { x: 78.17096503446606, y: 390.18669726605293 }
const ADJ_TP15_OUT = { x: 0, y: 14.030686031827244 }
const ADJ_TP16_IN = { x: 263.9105229796076, y: 362.79345310867603 }
const ADJ_TP16_OUT = { x: 277.2730811051575, y: 328.05080198224647 }

const buildAdjustedVector6Fixture = (
  strokeOverrides: {
    position?: 'inside' | 'outside' | 'center'
    joinType?: 'miter' | 'bevel' | 'round'
    capType?: 'butt' | 'round' | 'square'
  } = {}
) => {
  const points = {
    'tp-12': {
      id: 'tp-12',
      kind: 'anchor',
      ...ADJ_TP12,
      anchorType: 'sharp'
    },
    'tp-13': {
      id: 'tp-13',
      kind: 'anchor',
      ...ADJ_TP13,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: 'control',
      ...ADJ_TP12_OUT,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: 'control',
      ...ADJ_TP13_IN,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: 'control',
      ...ADJ_TP13_OUT,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: 'anchor',
      ...ADJ_TP14,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: 'anchor',
      ...ADJ_TP15,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: 'anchor',
      ...ADJ_TP16,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: 'control',
      ...ADJ_TP15_OUT,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: 'control',
      ...ADJ_TP16_IN,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: 'control',
      ...ADJ_TP16_OUT,
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
    pathId: 'vector-6:adjusted',
    networkId: network.id,
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'vector-6:adjusted:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: network.id,
        path: sourcePath,
        topology
      }
    ]
  })
  const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
  const stroke = createDefaultStroke({
    width: 10,
    style: 'dashed',
    position: strokeOverrides.position ?? 'inside',
    joinType: strokeOverrides.joinType ?? 'miter',
    capType: strokeOverrides.capType ?? 'round',
    dashPattern: [27, 20],
    dashOffset: 0
  })
  const [renderableStroke] = getRenderableStrokes([stroke])
  if (!renderableStroke) {
    throw new Error('Expected renderable stroke')
  }
  const options = {
    topology,
    sourcePath,
    implicitFillRegions: selfIntersecting?.fillRegions ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? [],
    selectedSideGuardPoints: network.pointIds.map((pointId) => {
      const point = points[pointId as keyof typeof points]
      return {
        x: point.x,
        y: point.y,
        sharp: point.anchorType === 'sharp'
      }
    }),
    clipInsideToFillDomain: true,
    constrainedDashedVisualMode: 'product-final' as const
  }
  const strokeDomainPlan = resolveStrokeDomains({
    topology,
    sourceFamily: resolveSourceFamily({
      topology,
      stroke: renderableStroke
    }),
    stroke: renderableStroke,
    sourcePath,
    implicitFillRegions: options.implicitFillRegions,
    sharedSourceSplitRanges: options.sharedSourceSplitRanges,
    sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
  })

  return {
    topology,
    sourcePath,
    stroke,
    renderableStroke,
    options,
    strokeDomainPlan
  }
}

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

const pointOnSegmentDistance = (point: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) {
    return distance(point, a)
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  )
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t })
}

const isPointOnPolygonBoundary = (
  point: Vec2,
  polygon: Vec2[],
  tolerance: number
) =>
  polygon.some((vertex, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return pointOnSegmentDistance(point, vertex, next) <= tolerance
  })

const isPointInsideEvenOdd = (point: Vec2, polygon: Vec2[]) => {
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

const isPointCoveredByPolygons = (
  point: Vec2,
  polygons: Vec2[][],
  tolerance = 0.75
) =>
  polygons.some(
    (polygon) =>
      isPointInsideEvenOdd(point, polygon) ||
      isPointOnPolygonBoundary(point, polygon, tolerance)
  )

const getPolygonBounds = (polygons: Vec2[][]) => {
  const points = polygons.flat()
  if (points.length === 0) {
    return null
  }
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  )
}

const roundBounds = (bounds: ReturnType<typeof getPolygonBounds>) =>
  bounds
    ? {
        minX: Math.round(bounds.minX * 1000) / 1000,
        minY: Math.round(bounds.minY * 1000) / 1000,
        maxX: Math.round(bounds.maxX * 1000) / 1000,
        maxY: Math.round(bounds.maxY * 1000) / 1000
      }
    : null

const getPolylineSample = (points: Vec2[], distanceAlongPath: number) => {
  let cursor = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const length = distance(start, end)
    if (length <= 1e-9) {
      continue
    }
    if (cursor + length >= distanceAlongPath) {
      const amount = (distanceAlongPath - cursor) / length
      return {
        point: {
          x: start.x + (end.x - start.x) * amount,
          y: start.y + (end.y - start.y) * amount
        },
        tangent: {
          x: (end.x - start.x) / length,
          y: (end.y - start.y) / length
        }
      }
    }
    cursor += length
  }
  const end = points[points.length - 1]
  const beforeEnd = points[points.length - 2]
  const length = beforeEnd ? distance(beforeEnd, end) : 0
  return {
    point: end,
    tangent:
      beforeEnd && length > 1e-9
        ? {
            x: (end.x - beforeEnd.x) / length,
            y: (end.y - beforeEnd.y) / length
          }
        : { x: 1, y: 0 }
  }
}

const offsetFromSide = (
  point: Vec2,
  tangent: Vec2,
  side: 1 | -1,
  offset: number
) => ({
  x: point.x - tangent.y * offset * side,
  y: point.y + tangent.x * offset * side
})

const getWindowedTurnAngleNearPoint = (
  points: Vec2[],
  target: Vec2,
  windowSize = 12
) => {
  const closestIndex = points.reduce(
    (closest, point, index) => {
      const pointDistance = distance(point, target)
      return pointDistance < closest.distance
        ? {
            index,
            distance: pointDistance
          }
        : closest
    },
    {
      index: 0,
      distance: Number.POSITIVE_INFINITY
    }
  ).index
  const before = points[Math.max(0, closestIndex - windowSize)]
  const current = points[closestIndex]
  const after = points[Math.min(points.length - 1, closestIndex + windowSize)]
  if (!before || !current || !after) {
    return 0
  }
  const incoming = {
    x: current.x - before.x,
    y: current.y - before.y
  }
  const outgoing = {
    x: after.x - current.x,
    y: after.y - current.y
  }
  const incomingLength = Math.hypot(incoming.x, incoming.y)
  const outgoingLength = Math.hypot(outgoing.x, outgoing.y)
  if (incomingLength <= 1e-9 || outgoingLength <= 1e-9) {
    return 0
  }
  const dot =
    (incoming.x * outgoing.x + incoming.y * outgoing.y) /
    (incomingLength * outgoingLength)
  return Math.acos(Math.max(-1, Math.min(1, dot)))
}

const getMaxWindowedTurnAngleNearPoint = (
  points: Vec2[],
  target: Vec2,
  radius: number,
  windowSize = 12
) => {
  let maxAngle = 0
  for (let index = windowSize; index < points.length - windowSize; index += 1) {
    const current = points[index]
    if (!current || distance(current, target) > radius) {
      continue
    }
    const before = points[index - windowSize]
    const after = points[index + windowSize]
    if (!before || !after) {
      continue
    }
    const incoming = {
      x: current.x - before.x,
      y: current.y - before.y
    }
    const outgoing = {
      x: after.x - current.x,
      y: after.y - current.y
    }
    maxAngle = Math.max(
      maxAngle,
      getTurnAngleBetweenVectors(incoming, outgoing)
    )
  }
  return maxAngle
}

const getTurnAngleBetweenVectors = (incoming: Vec2, outgoing: Vec2) => {
  const incomingLength = Math.hypot(incoming.x, incoming.y)
  const outgoingLength = Math.hypot(outgoing.x, outgoing.y)
  if (incomingLength <= 1e-9 || outgoingLength <= 1e-9) {
    return 0
  }
  const dot =
    (incoming.x * outgoing.x + incoming.y * outgoing.y) /
    (incomingLength * outgoingLength)
  return Math.acos(Math.max(-1, Math.min(1, dot)))
}

const getStrokeProjectionPolygons = (
  fixture: ReturnType<typeof buildAdjustedVector6Fixture>,
  phase: 'packet' | 'final-face' | 'collapsed-final-face' | 'render'
) => {
  const packets = buildConstrainedDashedStrokeResolvedPackets(
    `vector-6:adjusted:${fixture.renderableStroke.position}:${fixture.renderableStroke.join}:render-projection`,
    fixture.topology.normalizedPoints,
    true,
    [fixture.stroke],
    fixture.options
  )
  if (phase === 'packet') {
    return packets.flatMap((packet) => packet.geometry.polygons)
  }
  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  if (phase === 'final-face') {
    return finalFaces.flatMap((face) => face.polygons)
  }
  const collapsedFinalFaces = collapseStrokeFinalFaceVisualOverlaps(
    finalFaces,
    {
      backend: getGeometryBackend()
    }
  )
  if (phase === 'collapsed-final-face') {
    return collapsedFinalFaces.flatMap((face) => face.polygons)
  }
  return toSolidCenterStrokeRenderEntriesFromFinalFaces(collapsedFinalFaces, {
    exactBackend: getGeometryBackend()
  }).flatMap((entry) => entry.polygons)
}

const getLocalPacketDebug = (
  fixture: ReturnType<typeof buildAdjustedVector6Fixture>,
  center: Vec2,
  radius: number
) => {
  const packets = buildConstrainedDashedStrokeResolvedPackets(
    `vector-6:adjusted:${fixture.renderableStroke.position}:${fixture.renderableStroke.join}:packet-debug`,
    fixture.topology.normalizedPoints,
    true,
    [fixture.stroke],
    fixture.options
  )
  return packets
    .filter((packet) =>
      packet.geometry.polygons.some((polygon) =>
        polygon.some((point) => distance(point, center) <= radius)
      )
    )
    .map((packet) => ({
      geometryId: packet.geometry.geometryId,
      polygonCount: packet.geometry.polygons.length,
      bounds: packet.geometry.bounds,
      localPolygonSamples: packet.geometry.polygons
        .filter((polygon) =>
          polygon.some((point) => distance(point, center) <= radius)
        )
        .slice(0, 2)
        .map((polygon) =>
          polygon
            .filter((point) => distance(point, center) <= radius + 16)
            .slice(0, 12)
            .map((point) => ({
              x: Math.round(point.x * 100) / 100,
              y: Math.round(point.y * 100) / 100,
              d: Math.round(distance(point, center) * 100) / 100
            }))
        ),
      localCoverageCount: getLocalCoverageSignature(
        packet.geometry.polygons,
        center,
        radius,
        1.5
      ).size,
      sourceBoundaryJoinCount:
        packet.geometry.debugMeta?.sourceBoundaryJoinCount,
      terminalCapCount: packet.geometry.debugMeta?.terminalCapCount,
      intervalSweepSpanCount: packet.geometry.debugMeta?.intervalSweepSpanCount,
      startDistance: packet.geometry.debugMeta?.startDistance,
      endDistance: packet.geometry.debugMeta?.endDistance,
      figmaLikeSplitRangeStartDistance:
        packet.geometry.debugMeta?.figmaLikeSplitRangeStartDistance,
      figmaLikeSplitRangeEndDistance:
        packet.geometry.debugMeta?.figmaLikeSplitRangeEndDistance,
      figmaLikeSplitRangeSourceSegmentIndex:
        packet.geometry.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex,
      figmaLikeTerminalRole: packet.geometry.debugMeta?.figmaLikeTerminalRole,
      figmaLikeBoundaryRole: packet.geometry.debugMeta?.figmaLikeBoundaryRole,
      figmaLikeSelectedSide: packet.geometry.debugMeta?.figmaLikeSelectedSide,
      finalCoverageBuilderStatus:
        packet.geometry.debugMeta?.finalCoverageBuilderStatus
    }))
}

const getLocalCoverageSignature = (
  polygons: Vec2[][],
  center: Vec2,
  radius: number,
  step: number
) => {
  const covered = new Set<string>()
  for (let y = center.y - radius; y <= center.y + radius; y += step) {
    for (let x = center.x - radius; x <= center.x + radius; x += step) {
      const probe = { x, y }
      if (isPointCoveredByPolygons(probe, polygons, 0.75)) {
        covered.add(
          `${Math.round((x - center.x) / step)},${Math.round(
            (y - center.y) / step
          )}`
        )
      }
    }
  }
  return covered
}

const getCoverageDeltaCount = (first: Set<string>, second: Set<string>) => {
  let delta = 0
  first.forEach((key) => {
    if (!second.has(key)) {
      delta += 1
    }
  })
  second.forEach((key) => {
    if (!first.has(key)) {
      delta += 1
    }
  })
  return delta
}

describe('constrained dashed Vector-6 high-curvature pipeline diagnostics', () => {
  it('keeps the tp16 high-curvature outside endpoint join-specific through render projection', () => {
    const baseFixture = buildAdjustedVector6Fixture({
      position: 'outside',
      joinType: 'miter',
      capType: 'butt'
    })
    const highCurvatureDomains =
      baseFixture.strokeDomainPlan.splitRangeDomains.filter(
        (domain) =>
          (domain.sourceSegmentIndex === 3 ||
            domain.sourceSegmentIndex === 4) &&
          domain.boundaryPoints.some((point) => distance(point, ADJ_TP16) <= 1)
      )
    const authoredTp16TurnAngle = getTurnAngleBetweenVectors(
      {
        x: ADJ_TP16.x - ADJ_TP16_IN.x,
        y: ADJ_TP16.y - ADJ_TP16_IN.y
      },
      {
        x: ADJ_TP16_OUT.x - ADJ_TP16.x,
        y: ADJ_TP16_OUT.y - ADJ_TP16.y
      }
    )
    const localCurveTurnAngle = Math.max(
      ...highCurvatureDomains.map((domain) =>
        getMaxWindowedTurnAngleNearPoint(domain.boundaryPoints, ADJ_TP16, 64, 8)
      )
    )
    const maxTurnAngle = Math.max(
      authoredTp16TurnAngle,
      localCurveTurnAngle,
      ...highCurvatureDomains.map((domain) =>
        getWindowedTurnAngleNearPoint(domain.boundaryPoints, ADJ_TP16)
      )
    )

    expect(
      maxTurnAngle,
      JSON.stringify(
        {
          message:
            'tp16 must stay a formal high-curvature benchmark before asserting join-specific coverage',
          maxTurnAngle,
          authoredTp16TurnAngle,
          localCurveTurnAngle,
          threshold: Math.PI / 5,
          highCurvatureDomains: highCurvatureDomains.map((domain) => ({
            domainId: domain.domainId,
            sourceSegmentIndex: domain.sourceSegmentIndex,
            boundaryRole: domain.boundaryRole,
            selectedSide: domain.selectedSide,
            pointCount: domain.boundaryPoints.length
          }))
        },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(Math.PI / 5)

    const coverageFor = (
      joinType: 'miter' | 'bevel' | 'round',
      phase: 'packet' | 'final-face' | 'collapsed-final-face' | 'render'
    ) =>
      getLocalCoverageSignature(
        getStrokeProjectionPolygons(
          buildAdjustedVector6Fixture({
            position: 'outside',
            joinType,
            capType: 'butt'
          }),
          phase
        ),
        ADJ_TP16,
        42,
        1.5
      )

    const coverageCounts = {
      packetMiter: coverageFor('miter', 'packet').size,
      packetBevel: coverageFor('bevel', 'packet').size,
      packetRound: coverageFor('round', 'packet').size,
      finalMiter: coverageFor('miter', 'final-face').size,
      finalBevel: coverageFor('bevel', 'final-face').size,
      finalRound: coverageFor('round', 'final-face').size,
      collapsedFinalMiter: coverageFor('miter', 'collapsed-final-face').size,
      collapsedFinalBevel: coverageFor('bevel', 'collapsed-final-face').size,
      collapsedFinalRound: coverageFor('round', 'collapsed-final-face').size,
      renderMiter: coverageFor('miter', 'render').size,
      renderBevel: coverageFor('bevel', 'render').size,
      renderRound: coverageFor('round', 'render').size
    }

    expect(
      Object.values(coverageCounts).every((count) => count >= 80),
      JSON.stringify(
        {
          message:
            'tp16 is a smooth high-curvature endpoint; coverage must survive packet, FinalFace, and render projection without a forced round-join fallback oracle',
          coverageCounts,
          localPackets: {
            miter: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'miter',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            bevel: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'bevel',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            round: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'round',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            )
          }
        },
        null,
        2
      )
    ).toBe(true)

    const localSignatureFor = (
      joinType: 'miter' | 'bevel' | 'round',
      phase: 'packet' | 'final-face' | 'collapsed-final-face' | 'render'
    ) =>
      getStrokeProjectionPolygons(
        buildAdjustedVector6Fixture({
          position: 'outside',
          joinType,
          capType: 'butt'
        }),
        phase
      )
        .filter((polygon) =>
          polygon.some((point) => distance(point, ADJ_TP16) <= 42)
        )
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

    const packetSignatures = {
      miter: localSignatureFor('miter', 'packet'),
      bevel: localSignatureFor('bevel', 'packet'),
      round: localSignatureFor('round', 'packet')
    }
    const finalFaceSignatures = {
      miter: localSignatureFor('miter', 'final-face'),
      bevel: localSignatureFor('bevel', 'final-face'),
      round: localSignatureFor('round', 'final-face')
    }
    const collapsedFinalFaceSignatures = {
      miter: localSignatureFor('miter', 'collapsed-final-face'),
      bevel: localSignatureFor('bevel', 'collapsed-final-face'),
      round: localSignatureFor('round', 'collapsed-final-face')
    }
    const renderSignatures = {
      miter: localSignatureFor('miter', 'render'),
      bevel: localSignatureFor('bevel', 'render'),
      round: localSignatureFor('round', 'render')
    }

    expect(
      new Set(Object.values(packetSignatures)).size,
      JSON.stringify(
        {
          message:
            'tp16 is a closed-path endpoint; packet geometry must not collapse miter/bevel/round to the same shape',
          packetSignatures,
          localPackets: {
            miter: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'miter',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            bevel: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'bevel',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            round: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'round',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            )
          }
        },
        null,
        2
      )
    ).toBeGreaterThan(1)

    expect(
      new Set(Object.values(finalFaceSignatures)).size,
      JSON.stringify(
        {
          message:
            'tp16 join-specific packet geometry must survive FinalFace projection',
          finalFaceSignatures
        },
        null,
        2
      )
    ).toBeGreaterThan(1)

    expect(
      new Set(Object.values(collapsedFinalFaceSignatures)).size,
      JSON.stringify(
        {
          message:
            'tp16 join-specific FinalFace geometry must survive overlap collapse before render projection',
          collapsedFinalFaceSignatures
        },
        null,
        2
      )
    ).toBeGreaterThan(1)

    expect(
      new Set(Object.values(renderSignatures)).size,
      JSON.stringify(
        {
          message: 'tp16 join-specific geometry must survive render projection',
          renderSignatures
        },
        null,
        2
      )
    ).toBeGreaterThan(1)

    const visibleCoverage = {
      miter: getLocalCoverageSignature(
        getStrokeProjectionPolygons(
          buildAdjustedVector6Fixture({
            position: 'outside',
            joinType: 'miter',
            capType: 'butt'
          }),
          'render'
        ),
        ADJ_TP16,
        42,
        0.75
      ),
      bevel: getLocalCoverageSignature(
        getStrokeProjectionPolygons(
          buildAdjustedVector6Fixture({
            position: 'outside',
            joinType: 'bevel',
            capType: 'butt'
          }),
          'render'
        ),
        ADJ_TP16,
        42,
        0.75
      ),
      round: getLocalCoverageSignature(
        getStrokeProjectionPolygons(
          buildAdjustedVector6Fixture({
            position: 'outside',
            joinType: 'round',
            capType: 'butt'
          }),
          'render'
        ),
        ADJ_TP16,
        42,
        0.75
      )
    }
    const visibleDeltas = {
      miterVsBevel: getCoverageDeltaCount(
        visibleCoverage.miter,
        visibleCoverage.bevel
      ),
      miterVsRound: getCoverageDeltaCount(
        visibleCoverage.miter,
        visibleCoverage.round
      ),
      bevelVsRound: getCoverageDeltaCount(
        visibleCoverage.bevel,
        visibleCoverage.round
      )
    }
    const phaseVisibleDeltas = (
      phase: 'packet' | 'final-face' | 'collapsed-final-face' | 'render'
    ) => {
      const phaseCoverage = {
        miter: getLocalCoverageSignature(
          getStrokeProjectionPolygons(
            buildAdjustedVector6Fixture({
              position: 'outside',
              joinType: 'miter',
              capType: 'butt'
            }),
            phase
          ),
          ADJ_TP16,
          42,
          0.75
        ),
        bevel: getLocalCoverageSignature(
          getStrokeProjectionPolygons(
            buildAdjustedVector6Fixture({
              position: 'outside',
              joinType: 'bevel',
              capType: 'butt'
            }),
            phase
          ),
          ADJ_TP16,
          42,
          0.75
        ),
        round: getLocalCoverageSignature(
          getStrokeProjectionPolygons(
            buildAdjustedVector6Fixture({
              position: 'outside',
              joinType: 'round',
              capType: 'butt'
            }),
            phase
          ),
          ADJ_TP16,
          42,
          0.75
        )
      }
      return {
        miterVsBevel: getCoverageDeltaCount(
          phaseCoverage.miter,
          phaseCoverage.bevel
        ),
        miterVsRound: getCoverageDeltaCount(
          phaseCoverage.miter,
          phaseCoverage.round
        ),
        bevelVsRound: getCoverageDeltaCount(
          phaseCoverage.bevel,
          phaseCoverage.round
        ),
        counts: {
          miter: phaseCoverage.miter.size,
          bevel: phaseCoverage.bevel.size,
          round: phaseCoverage.round.size
        }
      }
    }

    expect(
      Math.min(...Object.values(visibleDeltas)),
      JSON.stringify(
        {
          message:
            'tp16 join type must change the visible local silhouette, not just append a tiny hidden diagnostic patch',
          visibleDeltas,
          visibleCoverageCounts: {
            miter: visibleCoverage.miter.size,
            bevel: visibleCoverage.bevel.size,
            round: visibleCoverage.round.size
          },
          phaseVisibleDeltas: {
            packet: phaseVisibleDeltas('packet'),
            finalFace: phaseVisibleDeltas('final-face'),
            collapsedFinalFace: phaseVisibleDeltas('collapsed-final-face'),
            render: phaseVisibleDeltas('render')
          },
          localPackets: {
            miter: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'miter',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            bevel: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'bevel',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            ),
            round: getLocalPacketDebug(
              buildAdjustedVector6Fixture({
                position: 'outside',
                joinType: 'round',
                capType: 'butt'
              }),
              ADJ_TP16,
              42
            )
          }
        },
        null,
        2
      )
    ).toBeGreaterThan(24)

    const wrongSideFailures = (['miter', 'bevel', 'round'] as const).flatMap(
      (joinType) => {
        const fixture = buildAdjustedVector6Fixture({
          position: 'outside',
          joinType,
          capType: 'butt'
        })
        const packetPolygons = getStrokeProjectionPolygons(fixture, 'packet')
        const finalFacePolygons = getStrokeProjectionPolygons(
          fixture,
          'final-face'
        )
        const renderPolygons = getStrokeProjectionPolygons(fixture, 'render')
        const legalFillPolygons = fixture.options.implicitFillRegions.flatMap(
          (region) => region.polygons
        )

        return highCurvatureDomains.flatMap((domain) =>
          domain.boundaryPoints.flatMap((point, index, points) => {
            if (index % 8 !== 0 || distance(point, ADJ_TP16) > 42) {
              return []
            }
            const previous = points[Math.max(0, index - 1)]
            const next = points[Math.min(points.length - 1, index + 1)]
            const tangentLength = distance(previous, next)
            if (tangentLength <= 1e-9) {
              return []
            }
            const tangent = {
              x: (next.x - previous.x) / tangentLength,
              y: (next.y - previous.y) / tangentLength
            }
            const wrongSide = domain.selectedSide === -1 ? 1 : -1
            return [1.5, 3, 5].flatMap((offset) => {
              const probe = offsetFromSide(point, tangent, wrongSide, offset)
              const legalFillCovered = isPointCoveredByPolygons(
                probe,
                legalFillPolygons,
                0.5
              )
              if (!legalFillCovered) {
                return []
              }
              const packetCovered = isPointCoveredByPolygons(
                probe,
                packetPolygons,
                0.5
              )
              const finalFaceCovered = isPointCoveredByPolygons(
                probe,
                finalFacePolygons,
                0.5
              )
              const renderCovered = isPointCoveredByPolygons(
                probe,
                renderPolygons,
                0.5
              )
              return packetCovered || finalFaceCovered || renderCovered
                ? [
                    {
                      joinType,
                      domainId: domain.domainId,
                      offset,
                      point: {
                        x: Math.round(point.x * 1000) / 1000,
                        y: Math.round(point.y * 1000) / 1000
                      },
                      probe: {
                        x: Math.round(probe.x * 1000) / 1000,
                        y: Math.round(probe.y * 1000) / 1000
                      },
                      packetCovered,
                      finalFaceCovered,
                      renderCovered
                    }
                  ]
                : []
            })
          })
        )
      }
    )

    expect(
      wrongSideFailures,
      JSON.stringify(
        {
          message:
            'outside high-curvature terminal join must stay on the exterior side through packet, FinalFace, and render projection',
          wrongSideFailures
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('keeps the tp16 high-curvature split-range intervals covered through packets and final faces', () => {
    const { topology, stroke, renderableStroke, options, strokeDomainPlan } =
      buildAdjustedVector6Fixture()
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      renderableStroke,
      options.sourcePath,
      strokeDomainPlan
    )
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:adjusted:diagnostic:packets',
      topology.normalizedPoints,
      true,
      [stroke],
      options
    )
    const noClipPackets = buildConstrainedDashedStrokeResolvedPackets(
      'vector-6:adjusted:diagnostic:no-clip-packets',
      topology.normalizedPoints,
      true,
      [stroke],
      {
        ...options,
        clipInsideToFillDomain: false
      }
    )
    const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
    const packetPolygons = packets.flatMap((packet) => packet.geometry.polygons)
    const noClipPacketPolygons = noClipPackets.flatMap(
      (packet) => packet.geometry.polygons
    )
    const finalPolygons = finalFaces.flatMap((face) => face.polygons)
    const legalFillPolygons = options.implicitFillRegions.flatMap(
      (region) => region.polygons
    )

    const highCurvatureDomains = strokeDomainPlan.splitRangeDomains.filter(
      (domain) =>
        (domain.sourceSegmentIndex === 3 || domain.sourceSegmentIndex === 4) &&
        domain.boundaryPoints.some((point) => distance(point, ADJ_TP16) <= 1)
    )
    const highCurvatureDomainIds = new Set(
      highCurvatureDomains.map((domain) => domain.domainId)
    )
    const targetIntervals = intervals.filter(
      (interval) =>
        interval.figmaLikeSplitRangeId !== undefined &&
        highCurvatureDomainIds.has(interval.figmaLikeSplitRangeId) &&
        interval.intervalLength >= Math.max(6, stroke.width * 0.75)
    )

    const failures = targetIntervals.flatMap((interval) => {
      const boundaryPoints = interval.figmaLikeBoundaryPoints ?? []
      const selectedSide = interval.figmaLikeSelectedSide
      if (boundaryPoints.length < 2 || !selectedSide) {
        return [
          {
            intervalId: interval.intervalId,
            splitRangeId: interval.figmaLikeSplitRangeId,
            reason: 'missing-boundary-or-side'
          }
        ]
      }

      const sampleRatios =
        interval.figmaLikeTerminalRole === 'start'
          ? [0.03, 0.1, 0.25, 0.5, 0.75]
          : interval.figmaLikeTerminalRole === 'end'
            ? [0.25, 0.5, 0.75, 0.9, 0.97]
            : [0.25, 0.5, 0.75]
      const sampleDistances = sampleRatios.map(
        (ratio) => interval.startDistance + interval.intervalLength * ratio
      )
      return sampleDistances.flatMap((sampleDistance) => {
        const { point, tangent } = getPolylineSample(
          boundaryPoints,
          sampleDistance
        )
        return [0.5, 1.5, 2.5, 4.5, 6.5].flatMap((offset) => {
          const probe = offsetFromSide(point, tangent, selectedSide, offset)
          const packetCovered = isPointCoveredByPolygons(
            probe,
            packetPolygons,
            1
          )
          const noClipPacketCovered = isPointCoveredByPolygons(
            probe,
            noClipPacketPolygons,
            1
          )
          const legalFillCovered = isPointCoveredByPolygons(
            probe,
            legalFillPolygons,
            1
          )
          const clippedIntervalPolygons = packets
            .filter(
              (packet) =>
                packet.geometry.debugMeta?.intervalId === interval.intervalId
            )
            .flatMap((packet) => packet.geometry.polygons)
          const noClipIntervalPolygons = noClipPackets
            .filter(
              (packet) =>
                packet.geometry.debugMeta?.intervalId === interval.intervalId
            )
            .flatMap((packet) => packet.geometry.polygons)
          const clippedIntervalCovered = isPointCoveredByPolygons(
            probe,
            clippedIntervalPolygons,
            1
          )
          const noClipIntervalCovered = isPointCoveredByPolygons(
            probe,
            noClipIntervalPolygons,
            1
          )
          const finalCovered = isPointCoveredByPolygons(probe, finalPolygons, 1)
          return packetCovered && finalCovered
            ? []
            : [
                {
                  intervalId: interval.intervalId,
                  splitRangeId: interval.figmaLikeSplitRangeId,
                  terminalRole: interval.figmaLikeTerminalRole,
                  boundaryRole: interval.figmaLikeBoundaryRole,
                  sourceSegmentIndex:
                    interval.figmaLikeSplitRangeSourceSegmentIndex,
                  startDistance:
                    Math.round(interval.startDistance * 1000) / 1000,
                  endDistance: Math.round(interval.endDistance * 1000) / 1000,
                  selectedSide,
                  sampleDistance: Math.round(sampleDistance * 1000) / 1000,
                  offset,
                  probe: {
                    x: Math.round(probe.x * 1000) / 1000,
                    y: Math.round(probe.y * 1000) / 1000
                  },
                  legalFillCovered,
                  noClipPacketCovered,
                  noClipIntervalCovered,
                  packetCovered,
                  clippedIntervalCovered,
                  finalCovered
                }
              ]
        })
      })
    })

    expect(
      failures,
      JSON.stringify(
        {
          topologyFamily: topology.topologyFamily,
          domainDiagnostics: strokeDomainPlan.diagnostics,
          domainCount: strokeDomainPlan.splitRangeDomains.length,
          highCurvatureDomains: highCurvatureDomains.map((domain) => ({
            domainId: domain.domainId,
            sourceSegmentIndex: domain.sourceSegmentIndex,
            boundaryRole: domain.boundaryRole,
            selectedSide: domain.selectedSide,
            totalLength: Math.round(domain.boundaryTotalLength * 1000) / 1000,
            pointCount: domain.boundaryPoints.length
          })),
          targetIntervals: targetIntervals.map((interval) => ({
            intervalId: interval.intervalId,
            splitRangeId: interval.figmaLikeSplitRangeId,
            sourceSegmentIndex: interval.figmaLikeSplitRangeSourceSegmentIndex,
            terminalRole: interval.figmaLikeTerminalRole,
            startDistance: Math.round(interval.startDistance * 1000) / 1000,
            endDistance: Math.round(interval.endDistance * 1000) / 1000,
            length: Math.round(interval.intervalLength * 1000) / 1000,
            boundaryPointCount: interval.figmaLikeBoundaryPoints?.length ?? 0
          })),
          packetPolygonCount: packetPolygons.length,
          noClipPacketPolygonCount: noClipPacketPolygons.length,
          finalPolygonCount: finalPolygons.length,
          packetBoundsByTargetInterval: targetIntervals.map((interval) => {
            const clippedPolygons = packets
              .filter(
                (packet) =>
                  packet.geometry.debugMeta?.intervalId === interval.intervalId
              )
              .flatMap((packet) => packet.geometry.polygons)
            const noClipPolygons = noClipPackets
              .filter(
                (packet) =>
                  packet.geometry.debugMeta?.intervalId === interval.intervalId
              )
              .flatMap((packet) => packet.geometry.polygons)
            return {
              intervalId: interval.intervalId,
              clippedPolygonCount: clippedPolygons.length,
              noClipPolygonCount: noClipPolygons.length,
              clippedBounds: roundBounds(getPolygonBounds(clippedPolygons)),
              noClipBounds: roundBounds(getPolygonBounds(noClipPolygons))
            }
          }),
          failures
        },
        null,
        2
      )
    ).toEqual([])
  })
})
