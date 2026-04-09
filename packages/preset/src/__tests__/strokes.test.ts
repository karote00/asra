import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { Container, Mesh } from 'pixi.js'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildResolvedStrokeGeometryFromSources,
  buildStrokeHitSegments,
  getRenderableStrokes,
  renderPolylineStrokes
} from '../components/strokes'
import { buildVectorGeometryModelPath } from '../components/geometry-model'
import {
  REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
  createReportedRoundInsideDashedStarVectorData
} from './inside-dashed-fixtures'

type Instruction =
  | { action: 'moveTo' | 'lineTo'; x: number; y: number }
  | { action: 'closePath' }

interface Vec2 {
  x: number
  y: number
}

class MeshTestHost extends Container {
  instructions: Instruction[] = []

  moveTo(x: number, y: number) {
    this.instructions.push({ action: 'moveTo', x, y })
    return this
  }

  lineTo(x: number, y: number) {
    this.instructions.push({ action: 'lineTo', x, y })
    return this
  }

  closePath() {
    this.instructions.push({ action: 'closePath' })
    return this
  }
}

const getProjectionMeshes = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Mesh => grandchild instanceof Mesh
    )
  })

const getSingleProjectionMesh = (host: Container) => {
  const meshes = getProjectionMeshes(host)
  expect(meshes).toHaveLength(1)
  return meshes[0]
}

const getMeshBounds = (mesh: Mesh) => {
  const positions = Array.from(mesh.geometry.getBuffer('aPosition').data)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let index = 0; index < positions.length; index += 2) {
    minX = Math.min(minX, positions[index])
    minY = Math.min(minY, positions[index + 1])
    maxX = Math.max(maxX, positions[index])
    maxY = Math.max(maxY, positions[index + 1])
  }

  return { minX, minY, maxX, maxY }
}

const cubicBezierPoint = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  }
}

const estimateCurveLength = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) =>
  Math.hypot(p1.x - p0.x, p1.y - p0.y) +
  Math.hypot(p2.x - p1.x, p2.y - p1.y) +
  Math.hypot(p3.x - p2.x, p3.y - p2.y)

const getFlattenStepsForTarget = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  targetSegmentLength: number,
  minSteps: number,
  maxSteps: number
) => {
  const length = estimateCurveLength(p0, p1, p2, p3)
  return Math.max(
    minSteps,
    Math.min(maxSteps, Math.ceil(length / targetSegmentLength))
  )
}

const getStrokeFlattenSteps = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) => getFlattenStepsForTarget(p0, p1, p2, p3, 4, 24, 256)

const flattenCubic = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number
) => {
  const points = [p0]
  for (let i = 1; i <= steps; i += 1) {
    points.push(cubicBezierPoint(p0, p1, p2, p3, i / steps))
  }
  return points
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

const buildVectorNetworkPolyline = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  const first = getAnchorNode(points, network.pointIds[0])
  if (!first) {
    return []
  }

  const polyline = [{ x: first.x, y: first.y }]

  network.segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }

    const start = getAnchorNode(points, segment.startId)
    const end = getAnchorNode(points, segment.endId)
    if (!start || !end) {
      return
    }

    const outControl = getControlNode(points, segment.outControlId)
    const inControl = getControlNode(points, segment.inControlId)
    if (!outControl && !inControl) {
      polyline.push({ x: end.x, y: end.y })
      return
    }

    const flattenedCurve = flattenCubic(
      { x: start.x, y: start.y },
      outControl
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y },
      inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
      { x: end.x, y: end.y },
      getStrokeFlattenSteps(
        { x: start.x, y: start.y },
        outControl
          ? { x: outControl.x, y: outControl.y }
          : { x: start.x, y: start.y },
        inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
        { x: end.x, y: end.y }
      )
    )

    flattenedCurve.slice(1).forEach((point) => {
      polyline.push(point)
    })
  })

  return polyline
}

const polygonSignedArea = (points: { x: number; y: number }[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const cross = (
  origin: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)

const segmentsProperlyIntersect = (
  a0: { x: number; y: number },
  a1: { x: number; y: number },
  b0: { x: number; y: number },
  b1: { x: number; y: number }
) => {
  const c1 = cross(a0, a1, b0)
  const c2 = cross(a0, a1, b1)
  const c3 = cross(b0, b1, a0)
  const c4 = cross(b0, b1, a1)

  return c1 * c2 < 0 && c3 * c4 < 0
}

const validateNoSelfIntersection = (polygon: { x: number; y: number }[]) => {
  for (let index = 0; index < polygon.length; index += 1) {
    const a0 = polygon[index]
    const a1 = polygon[(index + 1) % polygon.length]

    for (let other = index + 1; other < polygon.length; other += 1) {
      const b0 = polygon[other]
      const b1 = polygon[(other + 1) % polygon.length]
      const sharesEndpoint = a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1
      const sameSegment = index === other
      const adjacent =
        Math.abs(index - other) === 1 ||
        Math.abs(index - other) === polygon.length - 1

      if (sameSegment || adjacent || sharesEndpoint) {
        continue
      }

      if (segmentsProperlyIntersect(a0, a1, b0, b1)) {
        return false
      }
    }
  }

  return true
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]
    const prev = polygon[previous]
    const intersects =
      current.y > point.y !== prev.y > point.y &&
      point.x <
        ((prev.x - current.x) * (point.y - current.y)) /
          (prev.y - current.y || Number.EPSILON) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const distancePointToSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const segment = {
    x: end.x - start.x,
    y: end.y - start.y
  }
  const lengthSquared = segment.x * segment.x + segment.y * segment.y
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) /
        lengthSquared
    )
  )

  const closest = {
    x: start.x + segment.x * projection,
    y: start.y + segment.y * projection
  }

  return Math.hypot(point.x - closest.x, point.y - closest.y)
}

const pointNearPolygonBoundary = (
  point: Vec2,
  polygon: Vec2[],
  tolerance: number
) =>
  polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    return distancePointToSegment(point, start, end) <= tolerance
  })

const createInsideSolidHighCurvatureSample = () => {
  const network = {
    id: 'tn-solid-curve',
    pointIds: ['p0', 'p1', 'p2'],
    segmentIds: ['s0', 's1'],
    closed: true
  } satisfies VectorNetwork
  const points = {
    p0: { id: 'p0', kind: 'anchor', x: 30, y: 0, anchorType: 'smooth' },
    p1: { id: 'p1', kind: 'anchor', x: 0, y: 120, anchorType: 'sharp' },
    p2: { id: 'p2', kind: 'anchor', x: 120, y: 120, anchorType: 'smooth' },
    'p0:out': {
      id: 'p0:out',
      kind: 'control',
      x: 120,
      y: 10,
      controlForId: 'p0',
      controlRole: 'out'
    },
    'p2:in': {
      id: 'p2:in',
      kind: 'control',
      x: 10,
      y: 180,
      controlForId: 'p2',
      controlRole: 'in'
    }
  } satisfies Record<string, VectorPointNode>
  const segments = {
    s0: {
      id: 's0',
      startId: 'p0',
      endId: 'p1',
      outControlId: 'p0:out',
      inControlId: null
    },
    s1: {
      id: 's1',
      startId: 'p1',
      endId: 'p2',
      outControlId: null,
      inControlId: 'p2:in'
    }
  } satisfies Record<string, VectorSegment>

  return {
    polyline: buildVectorNetworkPolyline(network, points, segments),
    stroke: createDefaultStroke({
      style: StrokeStyles.SOLID,
      position: StrokePositions.INSIDE,
      width: 10,
      color: '#0fd123'
    })
  }
}

const createReferenceInsideDashedSample = () => {
  const network = {
    id: 'tn-ref-dashed',
    pointIds: ['tp-17', 'tp-18', 'tp-19', 'tp-20', 'tp-21'],
    segmentIds: ['ts-32', 'ts-33', 'ts-34', 'ts-35', 'ts-36'],
    closed: true
  } satisfies VectorNetwork

  const points = {
    'tp-17': {
      id: 'tp-17',
      kind: 'anchor',
      x: 274.2719180151795,
      y: 0,
      anchorType: 'smooth'
    },
    'tp-18': {
      id: 'tp-18',
      kind: 'anchor',
      x: 82.52429391607177,
      y: 338.18779271488194,
      anchorType: 'smooth'
    },
    'tp-17:out': {
      id: 'tp-17:out',
      kind: 'control',
      x: 271.4660920220331,
      y: 111.39323367600485,
      controlForId: 'tp-17',
      controlRole: 'out'
    },
    'tp-18:in': {
      id: 'tp-18:in',
      kind: 'control',
      x: -48.2200776215476,
      y: 322.0065586136914,
      controlForId: 'tp-18',
      controlRole: 'in'
    },
    'tp-18:out': {
      id: 'tp-18:out',
      kind: 'control',
      x: 245.95475833809598,
      y: 358.4143353413701,
      controlForId: 'tp-18',
      controlRole: 'out'
    },
    'tp-19': {
      id: 'tp-19',
      kind: 'anchor',
      x: 394.8221120690488,
      y: 194.98387091934586,
      anchorType: 'smooth'
    },
    'tp-19:in': {
      id: 'tp-19:in',
      kind: 'control',
      x: 279.12628824553656,
      y: 217.63759866101265,
      controlForId: 'tp-19',
      controlRole: 'in'
    },
    'tp-19:out': {
      id: 'tp-19:out',
      kind: 'control',
      x: 338.99685441994154,
      y: 194.98387091934586,
      controlForId: 'tp-19',
      controlRole: 'out'
    },
    'tp-20': {
      id: 'tp-20',
      kind: 'anchor',
      x: 0,
      y: 123.78644087410754,
      anchorType: 'sharp'
    },
    'tp-21': {
      id: 'tp-21',
      kind: 'anchor',
      x: 379.4499396729178,
      y: 377.8318162627988,
      anchorType: 'smooth'
    },
    'tp-20:out': {
      id: 'tp-20:out',
      kind: 'control',
      x: 0,
      y: 123.78644087410754,
      controlForId: 'tp-20',
      controlRole: 'out'
    },
    'tp-21:in': {
      id: 'tp-21:in',
      kind: 'control',
      x: 362.45964386666776,
      y: 451.45643142321575,
      controlForId: 'tp-21',
      controlRole: 'in'
    },
    'tp-21:out': {
      id: 'tp-21:out',
      kind: 'control',
      x: 396.4402354791679,
      y: 304.2072011023818,
      controlForId: 'tp-21',
      controlRole: 'out'
    }
  } satisfies Record<string, VectorPointNode>

  const segments = {
    'ts-32': {
      id: 'ts-32',
      startId: 'tp-17',
      endId: 'tp-18',
      outControlId: 'tp-17:out',
      inControlId: 'tp-18:in'
    },
    'ts-33': {
      id: 'ts-33',
      startId: 'tp-18',
      endId: 'tp-19',
      outControlId: 'tp-18:out',
      inControlId: 'tp-19:in'
    },
    'ts-34': {
      id: 'ts-34',
      startId: 'tp-19',
      endId: 'tp-20',
      outControlId: 'tp-19:out',
      inControlId: null
    },
    'ts-35': {
      id: 'ts-35',
      startId: 'tp-20',
      endId: 'tp-21',
      outControlId: 'tp-20:out',
      inControlId: 'tp-21:in'
    },
    'ts-36': {
      id: 'ts-36',
      startId: 'tp-21',
      endId: 'tp-17',
      outControlId: 'tp-21:out',
      inControlId: null
    }
  } satisfies Record<string, VectorSegment>

  return {
    polyline: buildVectorNetworkPolyline(network, points, segments),
    stroke: createDefaultStroke({
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 27,
      gap: 20,
      color: '#0fd123',
      opacity: 0.5,
      joinType: 'miter',
      miterAngle: 28.96
    })
  }
}

const createReportedRoundInsideDashedStarSample = () => {
  const vector = createReportedRoundInsideDashedStarVectorData()
  return {
    polyline: buildVectorNetworkPolyline(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    ),
    stroke: vector.strokes[0],
    width: vector.width,
    height: vector.height
  }
}

describe('stroke renderer', () => {
  it('renders one filled geometry for a straight dashed part', () => {
    const graphic = new MeshTestHost()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 20,
          gap: 100
        })
      ]
    )

    const mesh = getSingleProjectionMesh(graphic)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBeGreaterThan(0)
    expect(mesh.geometry.getIndex().data.length).toBeGreaterThan(0)
  })

  it('renders one filled geometry for a dashed part spanning a corner', () => {
    const graphic = new MeshTestHost()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    const mesh = getSingleProjectionMesh(graphic)
    const bounds = getMeshBounds(mesh)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBeGreaterThan(0)
    expect(bounds.maxX).toBeGreaterThanOrEqual(10)
    expect(bounds.maxY).toBeGreaterThanOrEqual(2)
  })

  it('passes dashed stroke paint color and opacity into the mesh projection', () => {
    const graphic = new MeshTestHost()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 10,
          dash: 20,
          gap: 12,
          color: '#d90909',
          opacity: 0.5
        })
      ]
    )

    const mesh = getSingleProjectionMesh(graphic)
    expect(mesh.tint).toBe(0xd90909)
    expect(mesh.alpha).toBe(0.5)
  })

  it('keeps the reported inside dashed reference mesh finite and locally bounded', () => {
    const graphic = new MeshTestHost()
    const { polyline, stroke } = createReferenceInsideDashedSample()

    renderPolylineStrokes(
      graphic,
      [{ points: polyline, closed: true }],
      [stroke]
    )

    const mesh = getSingleProjectionMesh(graphic)
    const bounds = getMeshBounds(mesh)
    Array.from(mesh.geometry.getBuffer('aPosition').data).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true)
    })
    expect(bounds.minX).toBeGreaterThanOrEqual(-80)
    expect(bounds.minY).toBeGreaterThanOrEqual(-80)
    expect(bounds.maxX).toBeLessThanOrEqual(480)
    expect(bounds.maxY).toBeLessThanOrEqual(480)
  })

  it('keeps short dashed parts on bezier curves sampled with intermediate points', () => {
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: StrokeStyles.DASHED,
        width: 8,
        dash: 4,
        gap: 40
      })
    ])

    expect(stroke.style).toBe(StrokeStyles.DASHED)
  })

  it('keeps the reported round-join inside dashed star mesh finite and locally bounded', () => {
    const graphic = new MeshTestHost()
    const { polyline, stroke, width, height } =
      createReportedRoundInsideDashedStarSample()

    renderPolylineStrokes(
      graphic,
      [{ points: polyline, closed: true }],
      [stroke]
    )

    const mesh = getSingleProjectionMesh(graphic)
    const bounds = getMeshBounds(mesh)
    Array.from(mesh.geometry.getBuffer('aPosition').data).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true)
    })
    expect(bounds.minX).toBeGreaterThanOrEqual(-100)
    expect(bounds.minY).toBeGreaterThanOrEqual(-100)
    expect(bounds.maxX).toBeLessThanOrEqual(width + 100)
    expect(bounds.maxY).toBeLessThanOrEqual(height + 100)
  })

  it('inside solid high-curvature characterization: runtime emits finite non-empty polygons on a closed cubic sample', () => {
    const graphic = new MeshTestHost()
    const { polyline, stroke } = createInsideSolidHighCurvatureSample()

    renderPolylineStrokes(
      graphic,
      [{ points: polyline, closed: true }],
      [stroke]
    )

    const mesh = getSingleProjectionMesh(graphic)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBeGreaterThan(0)
    Array.from(mesh.geometry.getBuffer('aPosition').data).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true)
    })
  })

  it('inside solid high-curvature characterization: runtime emits simple non-degenerate polygons on a closed cubic sample', () => {
    const { polyline, stroke } = createInsideSolidHighCurvatureSample()

    const hitSegments = buildStrokeHitSegments(
      [{ points: polyline, closed: true }],
      [stroke]
    )

    expect(hitSegments.length).toBeGreaterThan(0)
    hitSegments.forEach((segment) => {
      const polygon = segment.points
      expect(Math.abs(polygonSignedArea(polygon))).toBeGreaterThan(1e-3)
      expect(validateNoSelfIntersection(polygon)).toBe(true)
    })
  })
  it('inside solid high-curvature baseline: runtime still escapes the authored closed shape on a closed cubic sample', () => {
    const { polyline, stroke } = createInsideSolidHighCurvatureSample()

    const hitSegments = buildStrokeHitSegments(
      [{ points: polyline, closed: true }],
      [stroke]
    )
    expect(hitSegments.length).toBeGreaterThan(0)
    const escapedPoints = hitSegments
      .map((segment) => segment.points)
      .flatMap((polygon, polygonIndex) =>
        polygon
          .map((point, pointIndex) => ({
            polygonIndex,
            pointIndex,
            point
          }))
          .filter(
            ({ point }) =>
              !pointInPolygon(point, polyline) &&
              !pointNearPolygonBoundary(point, polyline, 1e-3)
          )
      )
      .slice(0, 8)

    expect(escapedPoints).toEqual([])
  })

  it('offsets closed stroke centerlines for inside and outside positions', () => {
    const graphic = new MeshTestHost()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.INSIDE,
          width: 10
        }),
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    const meshes = getProjectionMeshes(graphic)
    expect(meshes).toHaveLength(2)
    const insideBounds = getMeshBounds(meshes[0])
    const outsideBounds = getMeshBounds(meshes[1])
    expect(insideBounds.minX).toBeGreaterThanOrEqual(0)
    expect(insideBounds.minY).toBeGreaterThanOrEqual(0)
    expect(insideBounds.maxX).toBeLessThanOrEqual(20)
    expect(insideBounds.maxY).toBeLessThanOrEqual(20)
    expect(outsideBounds.minX).toBeLessThan(0)
    expect(outsideBounds.minY).toBeLessThan(0)
    expect(outsideBounds.maxX).toBeGreaterThan(20)
    expect(outsideBounds.maxY).toBeGreaterThan(20)
  })

  it('renders centered closed strokes as a single mesh projection', () => {
    const graphic = new MeshTestHost()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.CENTER,
          width: 10
        })
      ]
    )

    const mesh = getSingleProjectionMesh(graphic)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBeGreaterThan(0)
  })

  it('reuses mesh projections when the rendered stroke geometry and paint are unchanged', () => {
    const graphic = new MeshTestHost()
    const strokes = [
      createDefaultStroke({
        position: StrokePositions.CENTER,
        width: 10
      })
    ]
    const polylines = [
      {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ],
        closed: true
      }
    ]

    renderPolylineStrokes(graphic, polylines, strokes)
    const firstRoot = graphic.children[0]
    const firstMesh = getSingleProjectionMesh(graphic)
    renderPolylineStrokes(graphic, polylines, strokes)

    expect(graphic.children).toHaveLength(1)
    expect(graphic.children[0]).toBe(firstRoot)
    expect(getSingleProjectionMesh(graphic)).toBe(firstMesh)
  })

  it('updates an existing mesh projection when only the paint changes', () => {
    const graphic = new MeshTestHost()
    const polylines = [
      {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ],
        closed: true
      }
    ]

    renderPolylineStrokes(graphic, polylines, [
      createDefaultStroke({
        position: StrokePositions.CENTER,
        width: 10,
        color: '#000000'
      })
    ])
    const firstRoot = graphic.children[0]
    const firstMesh = getSingleProjectionMesh(graphic)
    renderPolylineStrokes(graphic, polylines, [
      createDefaultStroke({
        position: StrokePositions.CENTER,
        width: 10,
        color: '#ff0000'
      })
    ])

    expect(graphic.children).toHaveLength(1)
    expect(graphic.children[0]).toBe(firstRoot)
    const updatedMesh = getSingleProjectionMesh(graphic)
    expect(updatedMesh).toBe(firstMesh)
    expect(updatedMesh.tint).toBe(0xff0000)
  })

  it('builds hit segments from the rendered outside stroke geometry', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    expect(hitSegments).toHaveLength(1)
    expect(hitSegments[0].kind).toBe('polygon')
    expect(hitSegments[0].points.some((point) => point.x < 0)).toBe(true)
    expect(hitSegments[0].points.some((point) => point.y < 0)).toBe(true)
    expect(hitSegments[0].points.some((point) => point.x > 20)).toBe(true)
    expect(hitSegments[0].points.some((point) => point.y > 20)).toBe(true)
  })

  it('builds polygon hit geometry for dashed parts', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 0 }
          ],
          closed: false
        },
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    expect(hitSegments.length).toBeGreaterThanOrEqual(2)
    hitSegments.forEach((segment) => {
      expect(segment.kind).toBe('polygon')
      expect(segment.points.length).toBeGreaterThanOrEqual(3)
    })
    expect(
      hitSegments.some((segment) => segment.points.some((point) => point.y > 0))
    ).toBe(true)
  })

  it('builds resolved dashed stroke geometry from sources using the final selection contract', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const geometry = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const source = {
      geometry,
      sampledPoints: geometry.sampledPoints,
      closed: true
    }
    const entries = buildResolvedStrokeGeometryFromSources(
      [source],
      vector.strokes
    )

    expect(entries).toHaveLength(1)
    expect(entries[0].cacheKey).toBe('dashed_0_0')
    expect(entries[0].polygons.length).toBeGreaterThan(0)
  })
})
