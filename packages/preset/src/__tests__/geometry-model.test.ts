import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { earcut } from 'pixi.js'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildVectorGeometryModelPath,
  createDashedGeometryModel
} from '../components/geometry-model'
import { getRenderableStrokes } from '../components/strokes'

interface Vec2 {
  x: number
  y: number
}

interface PathSegmentForTest {
  type: 'line' | 'cubic'
  start: Vec2
  end: Vec2
  control1?: Vec2
  control2?: Vec2
}

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

const polylineLength = (points: Vec2[]) => {
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    total += distance(points[i], points[i + 1])
  }
  return total
}

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y

const normalize = (vector: Vec2) => {
  const length = Math.hypot(vector.x, vector.y)
  return length > 1e-9
    ? {
        x: vector.x / length,
        y: vector.y / length
      }
    : null
}

const getSegmentStartTangent = (segment: PathSegmentForTest) => {
  if (segment.type === 'line') {
    return normalize({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalize({
      x: (segment.control1 ?? segment.start).x - segment.start.x,
      y: (segment.control1 ?? segment.start).y - segment.start.y
    }) ??
    normalize({
      x: (segment.control2 ?? segment.end).x - segment.start.x,
      y: (segment.control2 ?? segment.end).y - segment.start.y
    }) ??
    normalize({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const getSegmentEndTangent = (segment: PathSegmentForTest) => {
  if (segment.type === 'line') {
    return normalize({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalize({
      x: segment.end.x - (segment.control2 ?? segment.end).x,
      y: segment.end.y - (segment.control2 ?? segment.end).y
    }) ??
    normalize({
      x: segment.end.x - (segment.control1 ?? segment.start).x,
      y: segment.end.y - (segment.control1 ?? segment.start).y
    }) ??
    normalize({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const assertPolygonInsideCornerWedge = (
  polygon: Vec2[],
  prev: Vec2,
  corner: Vec2,
  next: Vec2,
  orientation: 1 | -1,
  label: string
) => {
  const prevDirection = normalize({
    x: corner.x - prev.x,
    y: corner.y - prev.y
  })
  const nextDirection = normalize({
    x: next.x - corner.x,
    y: next.y - corner.y
  })
  expect(prevDirection).not.toBeNull()
  expect(nextDirection).not.toBeNull()
  if (!prevDirection || !nextDirection) {
    return
  }

  const firstNormal = {
    x: -prevDirection.y * orientation,
    y: prevDirection.x * orientation
  }
  const secondNormal = {
    x: -nextDirection.y * orientation,
    y: nextDirection.x * orientation
  }
  polygon.forEach((point) => {
    const firstDistance = dot(
      {
        x: point.x - corner.x,
        y: point.y - corner.y
      },
      firstNormal
    )
    const secondDistance = dot(
      {
        x: point.x - corner.x,
        y: point.y - corner.y
      },
      secondNormal
    )

    if (firstDistance < -1e-3) {
      throw new Error(
        `${label}:prev violated by point (${point.x}, ${point.y}) with signed distance ${firstDistance}`
      )
    }
    if (secondDistance < -1e-3) {
      throw new Error(
        `${label}:next violated by point (${point.x}, ${point.y}) with signed distance ${secondDistance}`
      )
    }
  })
}

const pointMatchesAny = (point: Vec2, candidates: Vec2[], tolerance = 1e-3) =>
  candidates.some((candidate) => distance(point, candidate) <= tolerance)

const assertNonSourcePolygonVerticesInsideCornerWedge = (
  polygon: Vec2[],
  sourcePoints: Vec2[],
  prev: Vec2,
  corner: Vec2,
  next: Vec2,
  orientation: 1 | -1,
  label: string
) => {
  assertPolygonInsideCornerWedge(
    polygon.filter((point) => !pointMatchesAny(point, sourcePoints)),
    prev,
    corner,
    next,
    orientation,
    label
  )
}

const partTouchesCorner = (part: Vec2[], corner: Vec2) => {
  if (part.length === 0) {
    return false
  }

  return (
    distance(part[0], corner) <= 1e-3 ||
    distance(part[part.length - 1], corner) <= 1e-3
  )
}

const polygonTouchesCornerZone = (
  polygon: Vec2[],
  corner: Vec2,
  tolerance: number
) => polygon.some((vertex) => distance(vertex, corner) <= tolerance)

const polygonArea = (points: Vec2[]) => {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]
    area += points[i].x * next.y - next.x * points[i].y
  }
  return area / 2
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const rasterizePolygons = (
  polygons: Vec2[][],
  width: number,
  height: number
) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  const boundsWidth = Math.max(1e-6, maxX - minX)
  const boundsHeight = Math.max(1e-6, maxY - minY)
  const pixels = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = {
        x: minX + ((x + 0.5) / width) * boundsWidth,
        y: minY + ((y + 0.5) / height) * boundsHeight
      }

      if (polygons.some((polygon) => pointInPolygon(sample, polygon))) {
        pixels[y * width + x] = 1
      }
    }
  }

  return {
    pixels,
    bounds: { minX, minY, maxX, maxY }
  }
}

const pointInTriangle = (point: Vec2, a: Vec2, b: Vec2, c: Vec2) => {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)

  if (Math.abs(denominator) <= 1e-12) {
    return false
  }

  const w1 =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
    denominator
  const w2 =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
    denominator
  const w3 = 1 - w1 - w2

  return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6
}

const rasterizeTriangulatedPolygons = (
  polygons: Vec2[][],
  width: number,
  height: number
) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  const boundsWidth = Math.max(1e-6, maxX - minX)
  const boundsHeight = Math.max(1e-6, maxY - minY)
  const pixels = new Uint8Array(width * height)
  const triangles = polygons.flatMap((polygon) => {
    const flatPolygon = polygon.flatMap((point) => [point.x, point.y])
    const indices = earcut(flatPolygon)
    const result: [Vec2, Vec2, Vec2][] = []

    for (let i = 0; i < indices.length; i += 3) {
      result.push([
        polygon[indices[i]],
        polygon[indices[i + 1]],
        polygon[indices[i + 2]]
      ])
    }

    return result
  })

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = {
        x: minX + ((x + 0.5) / width) * boundsWidth,
        y: minY + ((y + 0.5) / height) * boundsHeight
      }

      if (triangles.some(([a, b, c]) => pointInTriangle(sample, a, b, c))) {
        pixels[y * width + x] = 1
      }
    }
  }

  return {
    pixels,
    bounds: { minX, minY, maxX, maxY }
  }
}

const getOccupiedBounds = (
  pixels: Uint8Array,
  width: number,
  height: number
) => {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * width + x] === 0) {
        continue
      }
      count += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  return { minX, minY, maxX, maxY, count }
}

const getConnectedComponentSizes = (
  pixels: Uint8Array,
  width: number,
  height: number
) => {
  const visited = new Uint8Array(width * height)
  const sizes: number[] = []
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ] as const

  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index] === 0 || visited[index] === 1) {
      continue
    }

    visited[index] = 1
    const queue = [index]
    let size = 0

    while (queue.length > 0) {
      const current = queue.pop()
      if (current === undefined) {
        continue
      }

      size += 1
      const x = current % width
      const y = Math.floor(current / width)

      neighbors.forEach(([dx, dy]) => {
        const nextX = x + dx
        const nextY = y + dy
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
          return
        }

        const nextIndex = nextY * width + nextX
        if (pixels[nextIndex] === 0 || visited[nextIndex] === 1) {
          return
        }

        visited[nextIndex] = 1
        queue.push(nextIndex)
      })
    }

    sizes.push(size)
  }

  return sizes.sort((a, b) => b - a)
}

const pointToSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) {
    return distance(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  const closest = {
    x: start.x + dx * t,
    y: start.y + dy * t
  }

  return distance(point, closest)
}

const getMinDistanceToPolygonEdges = (point: Vec2, polygons: Vec2[][]) => {
  let best = Infinity
  polygons.forEach((polygon) => {
    for (let i = 0; i < polygon.length; i += 1) {
      best = Math.min(
        best,
        pointToSegmentDistance(
          point,
          polygon[i],
          polygon[(i + 1) % polygon.length]
        )
      )
    }
  })
  return best
}

describe('geometry model', () => {
  it('keeps inside dashed geometry within acute corners on a right triangle', () => {
    const points = {
      p0: { id: 'p0', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      p1: { id: 'p1', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' },
      p2: { id: 'p2', kind: 'anchor', x: 0, y: 90, anchorType: 'sharp' }
    } satisfies Record<string, VectorPointNode>
    const segments = {
      s0: {
        id: 's0',
        startId: 'p0',
        endId: 'p1',
        outControlId: null,
        inControlId: null
      },
      s1: {
        id: 's1',
        startId: 'p1',
        endId: 'p2',
        outControlId: null,
        inControlId: null
      },
      s2: {
        id: 's2',
        startId: 'p2',
        endId: 'p0',
        outControlId: null,
        inControlId: null
      }
    } satisfies Record<string, VectorSegment>
    const network = {
      id: 'tn-right-triangle',
      pointIds: ['p0', 'p1', 'p2'],
      segmentIds: ['s0', 's1', 's2'],
      closed: true
    } satisfies VectorNetwork

    const path = buildVectorGeometryModelPath(network, points, segments)
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 27,
        gap: 20,
        opacity: 0.5
      })
    ])
    const result = createDashedGeometryModel(path, stroke)
    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    const acuteA = points.p1
    const acuteB = points.p2
    const acuteAPolygons = result.model.polygons.filter((polygon) =>
      polygonTouchesCornerZone(polygon, acuteA, stroke.width * 1.5)
    )
    const acuteBPolygons = result.model.polygons.filter((polygon) =>
      polygonTouchesCornerZone(polygon, acuteB, stroke.width * 1.5)
    )

    acuteAPolygons.forEach((polygon, index) => {
      try {
        assertPolygonInsideCornerWedge(
          polygon,
          points.p0,
          acuteA,
          points.p2,
          1,
          `right-triangle-p1-${index}`
        )
      } catch (error) {
        throw new Error(
          JSON.stringify({
            message: error instanceof Error ? error.message : String(error),
            polygon
          })
        )
      }
    })

    acuteBPolygons.forEach((polygon, index) => {
      assertPolygonInsideCornerWedge(
        polygon,
        points.p1,
        acuteB,
        points.p0,
        1,
        `right-triangle-p2-${index}`
      )
    })

    result.debugParts.forEach((part, index) => {
      const raster = rasterizeTriangulatedPolygons(part.polygons, 96, 96)
      const componentSizes = getConnectedComponentSizes(raster.pixels, 96, 96)
      if (componentSizes.length > 1) {
        throw new Error(
          JSON.stringify({
            index,
            startDistance: part.startDistance,
            endDistance: part.endDistance,
            componentSizes,
            polygons: part.polygons
          })
        )
      }
      expect(componentSizes.length).toBeLessThanOrEqual(1)
    })
  })

  it('keeps dashed intervals monotonic and produces broad visible coverage for the reported sample', () => {
    const sample = {
      points: {
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
      } satisfies Record<string, VectorPointNode>,
      segments: {
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
      } satisfies Record<string, VectorSegment>,
      network: {
        id: 'tn-5',
        pointIds: ['tp-17', 'tp-18', 'tp-19', 'tp-20', 'tp-21'],
        segmentIds: ['ts-32', 'ts-33', 'ts-34', 'ts-35', 'ts-36'],
        closed: true
      } satisfies VectorNetwork
    }

    const path = buildVectorGeometryModelPath(
      sample.network,
      sample.points,
      sample.segments
    )
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 27,
        gap: 20,
        color: '#0fd123',
        opacity: 0.5,
        visible: true,
        joinType: 'miter',
        miterAngle: 28.96
      })
    ])

    const result = createDashedGeometryModel(path, stroke)
    expect(result).not.toBeNull()

    if (!result) {
      return
    }

    expect(result.debugParts.length).toBeGreaterThan(5)
    result.debugParts.forEach((part, index) => {
      expect(part.startDistance).toBeLessThan(part.endDistance)
      if (index > 0) {
        expect(part.startDistance).toBeGreaterThan(
          result.debugParts[index - 1].startDistance
        )
      }
      expect(part.polygons.length).toBeGreaterThan(0)

      const sourceLength = polylineLength(part.sourcePoints)
      const renderLength = polylineLength(part.renderPoints)
      expect(renderLength).toBeGreaterThan(0)
      expect(renderLength).toBeLessThan(sourceLength + 16)

      const raster = rasterizeTriangulatedPolygons(part.polygons, 96, 96)
      const componentSizes = getConnectedComponentSizes(raster.pixels, 96, 96)
      if (componentSizes.length > 1) {
        throw new Error(
          JSON.stringify({
            index,
            startDistance: part.startDistance,
            endDistance: part.endDistance,
            componentSizes,
            polygons: part.polygons
          })
        )
      }
      expect(componentSizes.length).toBeLessThanOrEqual(1)
    })

    const raster = rasterizePolygons(result.model.polygons, 160, 160)
    const occupied = getOccupiedBounds(raster.pixels, 160, 160)
    const triangulatedRaster = rasterizeTriangulatedPolygons(
      result.model.polygons,
      160,
      160
    )
    const triangulatedOccupied = getOccupiedBounds(
      triangulatedRaster.pixels,
      160,
      160
    )

    if (occupied.count <= 700) {
      throw new Error(
        JSON.stringify({
          occupied: occupied.count,
          triangulated: triangulatedOccupied.count,
          polygons: result.model.polygons.length,
          firstPolygon: result.model.polygons[0]
        })
      )
    }
    expect(occupied.maxX - occupied.minX).toBeGreaterThan(100)
    expect(occupied.maxY - occupied.minY).toBeGreaterThan(100)
    expect(triangulatedOccupied.count).toBeGreaterThan(700)
    expect(
      triangulatedOccupied.maxX - triangulatedOccupied.minX
    ).toBeGreaterThan(100)
    expect(
      triangulatedOccupied.maxY - triangulatedOccupied.minY
    ).toBeGreaterThan(100)

    const checkpointParts = [
      result.debugParts[0],
      result.debugParts[Math.floor(result.debugParts.length / 3)],
      result.debugParts[Math.floor((result.debugParts.length * 2) / 3)],
      result.debugParts[result.debugParts.length - 1]
    ]

    checkpointParts.forEach((part) => {
      const midpoint =
        part.renderPoints[Math.floor(part.renderPoints.length / 2)] ??
        part.sourcePoints[Math.floor(part.sourcePoints.length / 2)]

      const hit = result.model.polygons.some((polygon) =>
        polygon.some((point) => distance(point, midpoint) < 24)
      )

      expect(hit).toBe(true)
    })

    const orientation = (polygonArea(path.sampledPoints) >= 0 ? 1 : -1) as
      | 1
      | -1
    const tp17 = sample.points['tp-17']
    const tp19 = sample.points['tp-19']
    const topPrevTangent = getSegmentEndTangent(
      path.segments[path.segments.length - 1] as PathSegmentForTest
    )
    const topNextTangent = getSegmentStartTangent(
      path.segments[0] as PathSegmentForTest
    )
    const rightPrevTangent = getSegmentEndTangent(
      path.segments[1] as PathSegmentForTest
    )
    const rightNextTangent = getSegmentStartTangent(
      path.segments[2] as PathSegmentForTest
    )
    expect(topPrevTangent).not.toBeNull()
    expect(topNextTangent).not.toBeNull()
    expect(rightPrevTangent).not.toBeNull()
    expect(rightNextTangent).not.toBeNull()
    if (
      !topPrevTangent ||
      !topNextTangent ||
      !rightPrevTangent ||
      !rightNextTangent
    ) {
      throw new Error('Missing corner tangents for sample path')
    }
    const topPrev = {
      x: tp17.x - topPrevTangent.x,
      y: tp17.y - topPrevTangent.y
    }
    const topNext = {
      x: tp17.x + topNextTangent.x,
      y: tp17.y + topNextTangent.y
    }
    const rightPrev = {
      x: tp19.x - rightPrevTangent.x,
      y: tp19.y - rightPrevTangent.y
    }
    const rightNext = {
      x: tp19.x + rightNextTangent.x,
      y: tp19.y + rightNextTangent.y
    }

    const cornerTolerance = stroke.width * 1.5
    const partsNearTop = result.debugParts.filter(
      (part) =>
        partTouchesCorner(part.sourcePoints, tp17) ||
        part.polygons.some((polygon) =>
          polygonTouchesCornerZone(polygon, tp17, cornerTolerance)
        )
    )
    expect(partsNearTop.length).toBeGreaterThan(0)
    partsNearTop.forEach((part, index) => {
      part.polygons.forEach((polygon) => {
        try {
          assertNonSourcePolygonVerticesInsideCornerWedge(
            polygon,
            part.sourcePoints,
            topPrev,
            tp17,
            topNext,
            orientation,
            `tp17-corner-${index}-${part.startDistance.toFixed(2)}-${part.endDistance.toFixed(2)}`
          )
        } catch (error) {
          throw new Error(
            JSON.stringify({
              message: error instanceof Error ? error.message : String(error),
              sourcePoints: part.sourcePoints,
              clipPoints: part.clipPoints,
              renderPoints: part.renderPoints,
              polygon
            })
          )
        }
      })
    })

    const partsNearRight = result.debugParts.filter(
      (part) =>
        partTouchesCorner(part.sourcePoints, tp19) ||
        part.polygons.some((polygon) =>
          polygonTouchesCornerZone(polygon, tp19, cornerTolerance)
        )
    )
    partsNearRight.forEach((part, index) => {
      part.polygons.forEach((polygon) => {
        assertNonSourcePolygonVerticesInsideCornerWedge(
          polygon,
          part.sourcePoints,
          rightPrev,
          tp19,
          rightNext,
          orientation,
          `tp19-corner-${index}-${part.startDistance.toFixed(2)}-${part.endDistance.toFixed(2)}`
        )
      })

      const sourceBoundaryDistances = part.sourcePoints.map((point) =>
        getMinDistanceToPolygonEdges(point, part.polygons)
      )
      const maxBoundaryDistance = Math.max(...sourceBoundaryDistances)
      if (maxBoundaryDistance > 0.5) {
        const maxIndex = sourceBoundaryDistances.findIndex(
          (value) => value === maxBoundaryDistance
        )
        throw new Error(
          JSON.stringify({
            startDistance: part.startDistance,
            endDistance: part.endDistance,
            maxBoundaryDistance,
            sourcePoint: part.sourcePoints[maxIndex],
            sourcePoints: part.sourcePoints,
            polygons: part.polygons
          })
        )
      }
      expect(maxBoundaryDistance).toBeLessThanOrEqual(0.5)
    })
  })
})
