import {
  PropertyTypes,
  StrokeJoinTypes,
  createDefaultStroke,
  emitDiagnosticCounter,
  isRecord,
  setElementGeometryLocalBounds
} from '@asyra/utils'
import type { FillAttrs, PositionData, StrokeAttrs } from '@asyra/utils'
import core, {
  VECTOR_TOKENS,
  isVectorAnchorNode as isAnchorNode,
  isPointInsidePreparedEvenOddShape,
  prepareEvenOddShape,
  sortVectorItemsById,
  type EvenOddSegment,
  type EvenOddShape,
  type PreparedEvenOddShape
} from '@asyra/core'
import type {
  ComponentDefinition,
  EngineNeutralRenderStrategy,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import {
  DEFAULT_VECTOR_FILLS,
  applyRenderableFill,
  getRenderableFill,
  getRenderableFills
} from './fills'
import { PRESET_REGISTRATION } from '../registration'

const emitVectorRenderCounter = emitDiagnosticCounter

const normalizeRawPathTopologyFillRule = (
  value: unknown
): 'evenodd' | 'nonzero' => (value === 'evenodd' ? 'evenodd' : 'nonzero')

interface VectorComputedData {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  pointCoordinateSpace?: 'workspace'
  fillRule: 'evenodd' | 'nonzero'
  fills: FillAttrs[]
  strokes?: StrokeAttrs[]
}

interface NormalizedVectorRenderDataInput {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: unknown
  scaleX?: unknown
  scaleY?: unknown
  skewX?: unknown
  skewY?: unknown
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  pointCoordinateSpace?: unknown
  fillRule?: unknown
  fills?: unknown
  strokes?: unknown
}

const isNormalizedVectorRenderDataInput = (
  data: unknown
): data is NormalizedVectorRenderDataInput => {
  if (!isRecord(data)) {
    return false
  }
  if (
    typeof data.id !== 'string' ||
    typeof data.x !== 'number' ||
    !Number.isFinite(data.x) ||
    typeof data.y !== 'number' ||
    !Number.isFinite(data.y) ||
    typeof data.width !== 'number' ||
    !Number.isFinite(data.width) ||
    data.width < 0 ||
    typeof data.height !== 'number' ||
    !Number.isFinite(data.height) ||
    data.height < 0 ||
    typeof data.closed !== 'boolean'
  ) {
    return false
  }

  const points = data.points
  const segments = data.segments
  const networks = data.networks
  return (
    data.pointCoordinateSpace === 'workspace' &&
    isRecord(points) &&
    isRecord(segments) &&
    isRecord(networks)
  )
}

const normalizeVectorRenderData = (data: unknown): VectorComputedData => {
  if (isNormalizedVectorRenderDataInput(data)) {
    emitVectorRenderCounter('vector-render-normalize-fast-path-hit')
    const finiteOr = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return {
      ...data,
      rotation: finiteOr(data.rotation, 0),
      scaleX: finiteOr(data.scaleX, 1),
      scaleY: finiteOr(data.scaleY, 1),
      skewX: finiteOr(data.skewX, 0),
      skewY: finiteOr(data.skewY, 0),
      points: data.points,
      pointCoordinateSpace: 'workspace',
      fillRule: normalizeRawPathTopologyFillRule(data.fillRule),
      fills: Array.isArray(data.fills) ? data.fills : [],
      strokes: Array.isArray(data.strokes) ? data.strokes : []
    }
  }
  throw new Error('[Preset Vector] Render data must contain Vector geometry')
}

type Vec2 = PositionData

interface VectorRenderGeometryProjection {
  workspaceOrigin: PositionData
}

const vectorRenderGeometryProjectionCache = new WeakMap<
  object,
  VectorRenderGeometryProjection
>()

export const getVectorRenderLocalPoint = (
  renderElement: object,
  workspacePoint: PositionData
): PositionData | null => {
  const projection = vectorRenderGeometryProjectionCache.get(renderElement)
  return projection
    ? {
        x: workspacePoint.x - projection.workspaceOrigin.x,
        y: workspacePoint.y - projection.workspaceOrigin.y
      }
    : null
}

export const getVectorRenderWorkspacePoint = (
  renderElement: object,
  localPoint: PositionData
): PositionData | null => {
  const projection = vectorRenderGeometryProjectionCache.get(renderElement)
  return projection
    ? {
        x: localPoint.x + projection.workspaceOrigin.x,
        y: localPoint.y + projection.workspaceOrigin.y
      }
    : null
}

interface FillFaceCache {
  faces: Vec2[][]
  segmentKeyMap?: Record<string, string>
  segmentLinesMap?: Record<string, LineSegment[]>
}

interface EvenOddFillCache {
  fill: { style: unknown; dispose: () => void } | null
  width?: number
  height?: number
  fillId?: string
  fillPayload?: FillAttrs[]
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
  pointOffsetX?: number
  pointOffsetY?: number
}

const getAnchorNode = (
  points: Record<string, VectorPointNode>,
  pointId: string | undefined
): VectorPointNode | null => {
  if (!pointId) {
    return null
  }

  const point = points[pointId]
  if (!isAnchorNode(point)) {
    return null
  }

  return point
}

const getControlNode = (
  points: Record<string, VectorPointNode>,
  pointId?: string | null
): VectorPointNode | null => {
  if (!pointId) {
    return null
  }

  const point = points[pointId]
  if (!point || point.kind !== VECTOR_TOKENS.POINT.KIND.CONTROL) {
    return null
  }

  return point
}

const MIN_FLATTEN_STEPS = 12

const MAX_FLATTEN_STEPS = 64

const DEFAULT_FLATTEN_SEGMENT_LENGTH = 12

const INTERSECTION_EPS = 1e-6

const NODE_KEY_EPS = 1e-4

const MAX_OPEN_SEGMENTS = 1200

const MIN_VECTOR_RENDER_SIZE = 0.1

const cubicBezierPoint = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
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

const getCubicDerivativeRoots = (
  start: number,
  control1: number,
  control2: number,
  end: number
): readonly number[] => {
  const a = -start + 3 * control1 - 3 * control2 + end
  const b = 2 * (start - 2 * control1 + control2)
  const c = control1 - start
  if (Math.abs(a) <= Number.EPSILON) {
    if (Math.abs(b) <= Number.EPSILON) {
      return []
    }
    const root = -c / b
    return root > 0 && root < 1 ? [root] : []
  }

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    return []
  }
  const squareRoot = Math.sqrt(discriminant)
  return [(-b + squareRoot) / (2 * a), (-b - squareRoot) / (2 * a)].filter(
    (root) => root > 0 && root < 1
  )
}

const calculateVectorLocalBounds = (
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  networks: readonly VectorNetwork[]
) => {
  const anchorIds = new Set<string>()
  const segmentIds = new Set<string>()
  networks.forEach((network) => {
    network.pointIds.forEach((pointId) => anchorIds.add(pointId))
    network.segmentIds.forEach((segmentId) => segmentIds.add(segmentId))
  })
  const anchors = [...anchorIds]
    .map((pointId) => points[pointId])
    .filter(isAnchorNode)
  if (anchors.length === 0) {
    return {
      x: 0,
      y: 0,
      width: MIN_VECTOR_RENDER_SIZE,
      height: MIN_VECTOR_RENDER_SIZE
    }
  }

  const bounds = {
    minX: anchors[0].x,
    minY: anchors[0].y,
    maxX: anchors[0].x,
    maxY: anchors[0].y
  }
  const include = (point: Vec2) => {
    bounds.minX = Math.min(bounds.minX, point.x)
    bounds.minY = Math.min(bounds.minY, point.y)
    bounds.maxX = Math.max(bounds.maxX, point.x)
    bounds.maxY = Math.max(bounds.maxY, point.y)
  }
  anchors.forEach(include)

  segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }
    const start = getAnchorNode(points, segment.startId)
    const end = getAnchorNode(points, segment.endId)
    if (!start || !end) {
      return
    }
    const outControl = getControlNode(points, segment.outControlId) ?? start
    const inControl = getControlNode(points, segment.inControlId) ?? end
    const roots = new Set([
      ...getCubicDerivativeRoots(start.x, outControl.x, inControl.x, end.x),
      ...getCubicDerivativeRoots(start.y, outControl.y, inControl.y, end.y)
    ])
    roots.forEach((root) =>
      include(cubicBezierPoint(start, outControl, inControl, end, root))
    )
  })

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX || MIN_VECTOR_RENDER_SIZE,
    height: bounds.maxY - bounds.minY || MIN_VECTOR_RENDER_SIZE
  }
}

const estimateCurveLength = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) =>
  Math.hypot(p1.x - p0.x, p1.y - p0.y) +
  Math.hypot(p2.x - p1.x, p2.y - p1.y) +
  Math.hypot(p3.x - p2.x, p3.y - p2.y)

const getFlattenStepsForTarget = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  targetSegmentLength: number,
  minSteps: number,
  maxSteps: number
) => {
  const length = estimateCurveLength(p0, p1, p2, p3)
  const steps = Math.ceil(length / targetSegmentLength)
  return Math.max(minSteps, Math.min(maxSteps, steps))
}

const getFlattenSteps = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) =>
  getFlattenStepsForTarget(
    p0,
    p1,
    p2,
    p3,
    DEFAULT_FLATTEN_SEGMENT_LENGTH,
    MIN_FLATTEN_STEPS,
    MAX_FLATTEN_STEPS
  )

const toSegmentKeyCoord = (value: number | null | undefined) =>
  value === null || value === undefined ? 'n' : `${value}`

const buildSegmentKey = (
  start: Vec2,
  end: Vec2,
  outControl: Vec2 | null,
  inControl: Vec2 | null
) =>
  [
    toSegmentKeyCoord(start.x),
    toSegmentKeyCoord(start.y),
    toSegmentKeyCoord(end.x),
    toSegmentKeyCoord(end.y),
    toSegmentKeyCoord(outControl?.x),
    toSegmentKeyCoord(outControl?.y),
    toSegmentKeyCoord(inControl?.x),
    toSegmentKeyCoord(inControl?.y)
  ].join('|')

const polygonArea = (points: Vec2[]): number => {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length
    area += points[i].x * points[next].y - points[next].x * points[i].y
  }

  return area / 2
}

const flattenCubic = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  steps: number
) => {
  const points: Vec2[] = [p0]
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    points.push(cubicBezierPoint(p0, p1, p2, p3, t))
  }
  return points
}

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const segmentIntersection = (
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2
): { t: number; u: number; point: Vec2 } | null => {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const denom = cross(r, s)
  if (Math.abs(denom) <= INTERSECTION_EPS) {
    return null
  }

  const cma = { x: c.x - a.x, y: c.y - a.y }
  const t = cross(cma, s) / denom
  const u = cross(cma, r) / denom
  if (
    t <= INTERSECTION_EPS ||
    t >= 1 - INTERSECTION_EPS ||
    u <= INTERSECTION_EPS ||
    u >= 1 - INTERSECTION_EPS
  ) {
    return null
  }

  return {
    t,
    u,
    point: {
      x: a.x + r.x * t,
      y: a.y + r.y * t
    }
  }
}

const uniqueSorted = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const result: number[] = []
  sorted.forEach((value) => {
    const last = result[result.length - 1]
    if (last === undefined || Math.abs(value - last) > INTERSECTION_EPS) {
      result.push(value)
    }
  })
  return result
}

const toNodeKey = (point: Vec2) =>
  `${Math.round(point.x / NODE_KEY_EPS)},${Math.round(point.y / NODE_KEY_EPS)}`

interface LineSegment {
  start: Vec2
  end: Vec2
}

const splitSegmentsByIntersections = (
  segments: LineSegment[]
): LineSegment[] => {
  const splitParams = segments.map(() => [0, 1])
  if (segments.length < 2) {
    return segments
  }

  const bounds = segments.map((segment) => {
    const minX = Math.min(segment.start.x, segment.end.x)
    const maxX = Math.max(segment.start.x, segment.end.x)
    const minY = Math.min(segment.start.y, segment.end.y)
    const maxY = Math.max(segment.start.y, segment.end.y)
    return { minX, maxX, minY, maxY }
  })

  const avgLength =
    segments.reduce(
      (sum, segment) =>
        sum +
        Math.hypot(
          segment.end.x - segment.start.x,
          segment.end.y - segment.start.y
        ),
      0
    ) / segments.length
  const cellSize = Math.max(12, Math.min(64, avgLength || 12))
  const toCell = (value: number) => Math.floor(value / cellSize)
  const cellMap = new Map<string, number[]>()

  bounds.forEach((box, index) => {
    const startX = toCell(box.minX)
    const endX = toCell(box.maxX)
    const startY = toCell(box.minY)
    const endY = toCell(box.maxY)
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const key = `${x},${y}`
        const list = cellMap.get(key)
        if (list) {
          list.push(index)
        } else {
          cellMap.set(key, [index])
        }
      }
    }
  })

  const seen = new Int32Array(segments.length)
  let stamp = 0

  for (let i = 0; i < segments.length; i += 1) {
    stamp += 1
    const candidateIndices: number[] = []
    const box = bounds[i]
    const startX = toCell(box.minX)
    const endX = toCell(box.maxX)
    const startY = toCell(box.minY)
    const endY = toCell(box.maxY)
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const list = cellMap.get(`${x},${y}`)
        if (!list) {
          continue
        }
        for (const j of list) {
          if (j <= i) {
            continue
          }
          if (seen[j] === stamp) {
            continue
          }
          seen[j] = stamp
          candidateIndices.push(j)
        }
      }
    }

    for (const j of candidateIndices) {
      const other = bounds[j]
      if (
        box.maxX < other.minX - INTERSECTION_EPS ||
        box.minX > other.maxX + INTERSECTION_EPS ||
        box.maxY < other.minY - INTERSECTION_EPS ||
        box.minY > other.maxY + INTERSECTION_EPS
      ) {
        continue
      }
      const hit = segmentIntersection(
        segments[i].start,
        segments[i].end,
        segments[j].start,
        segments[j].end
      )
      if (!hit) {
        continue
      }
      splitParams[i].push(hit.t)
      splitParams[j].push(hit.u)
    }
  }

  const result: LineSegment[] = []
  segments.forEach((segment, index) => {
    const params = uniqueSorted(splitParams[index])
    for (let i = 0; i < params.length - 1; i += 1) {
      const t0 = params[i]
      const t1 = params[i + 1]
      if (t1 - t0 <= INTERSECTION_EPS) {
        continue
      }
      const start = {
        x: segment.start.x + (segment.end.x - segment.start.x) * t0,
        y: segment.start.y + (segment.end.y - segment.start.y) * t0
      }
      const end = {
        x: segment.start.x + (segment.end.x - segment.start.x) * t1,
        y: segment.start.y + (segment.end.y - segment.start.y) * t1
      }
      if (Math.hypot(end.x - start.x, end.y - start.y) <= INTERSECTION_EPS) {
        continue
      }
      result.push({ start, end })
    }
  })

  return result
}

interface DirectedEdge {
  from: number
  to: number
  angle: number
  rev: number
}

interface DirectedSegment {
  start: Vec2
  end: Vec2
}

const buildFlattenedSegmentsWithCache = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  cache: Pick<FillFaceCache, 'segmentKeyMap' | 'segmentLinesMap'> | undefined,
  pointOffset: PositionData
) => {
  const prevKeyMap = cache?.segmentKeyMap ?? {}
  const prevLinesMap = cache?.segmentLinesMap ?? {}
  const nextKeyMap: Record<string, string> = {}
  const nextLinesMap: Record<string, LineSegment[]> = {}
  const flattenedSegments: LineSegment[] = []

  orderedNetworks.forEach((network) => {
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
      const startPos = {
        x: start.x - pointOffset.x,
        y: start.y - pointOffset.y
      }
      const endPos = {
        x: end.x - pointOffset.x,
        y: end.y - pointOffset.y
      }
      const outControlPos = outControl
        ? {
            x: outControl.x - pointOffset.x,
            y: outControl.y - pointOffset.y
          }
        : null
      const inControlPos = inControl
        ? {
            x: inControl.x - pointOffset.x,
            y: inControl.y - pointOffset.y
          }
        : null
      const key = buildSegmentKey(startPos, endPos, outControlPos, inControlPos)

      let lines = prevLinesMap[segmentId]
      if (!lines || prevKeyMap[segmentId] !== key) {
        if (!outControlPos && !inControlPos) {
          lines = [{ start: startPos, end: endPos }]
        } else {
          const p0 = startPos
          const p1 = outControlPos ?? p0
          const p3 = endPos
          const p2 = inControlPos ?? p3
          const pointsOnCurve = flattenCubic(
            p0,
            p1,
            p2,
            p3,
            getFlattenSteps(p0, p1, p2, p3)
          )
          lines = []
          for (let i = 0; i < pointsOnCurve.length - 1; i += 1) {
            lines.push({
              start: pointsOnCurve[i],
              end: pointsOnCurve[i + 1]
            })
          }
        }
      }

      if (!lines) {
        return
      }

      nextKeyMap[segmentId] = key
      nextLinesMap[segmentId] = lines
      flattenedSegments.push(...lines)
    })
  })

  const directedSegments: DirectedSegment[] = flattenedSegments

  return {
    flattenedSegments,
    directedSegments,
    segmentKeyMap: nextKeyMap,
    segmentLinesMap: nextLinesMap
  }
}

const polygonCentroid = (points: Vec2[]) => {
  const area = polygonArea(points)
  if (Math.abs(area) <= INTERSECTION_EPS) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    )
    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    }
  }

  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length
    const crossValue =
      points[i].x * points[next].y - points[next].x * points[i].y
    cx += (points[i].x + points[next].x) * crossValue
    cy += (points[i].y + points[next].y) * crossValue
  }

  const factor = 1 / (6 * area)
  return { x: cx * factor, y: cy * factor }
}

const evenOddContains = (point: Vec2, segments: DirectedSegment[]) => {
  let inside = false
  const { x, y } = point

  segments.forEach((segment) => {
    const p1 = segment.start
    const p2 = segment.end

    if (p1.y > y === p2.y > y) {
      return
    }

    const t = (y - p1.y) / (p2.y - p1.y)
    if (t <= INTERSECTION_EPS || t >= 1 - INTERSECTION_EPS) {
      return
    }

    const intersectX = p1.x + (p2.x - p1.x) * t
    if (intersectX > x + INTERSECTION_EPS) {
      inside = !inside
    }
  })

  return inside
}

const buildFillFaces = (
  flattenedSegments: LineSegment[],
  directedSegments: DirectedSegment[]
): Vec2[][] => {
  if (flattenedSegments.length > MAX_OPEN_SEGMENTS) {
    return []
  }

  const splitSegments = splitSegmentsByIntersections(flattenedSegments)
  if (splitSegments.length === 0) {
    return []
  }

  const nodes = new Map<string, number>()
  const pointsList: Vec2[] = []
  const getNodeId = (point: Vec2) => {
    const key = toNodeKey(point)
    const existing = nodes.get(key)
    if (existing !== undefined) {
      return existing
    }
    const id = pointsList.length
    nodes.set(key, id)
    pointsList.push(point)
    return id
  }

  const edges: DirectedEdge[] = []
  const adjacency: number[][] = []

  const ensureAdj = (nodeId: number) => {
    if (!adjacency[nodeId]) {
      adjacency[nodeId] = []
    }
  }

  splitSegments.forEach((segment) => {
    const from = getNodeId(segment.start)
    const to = getNodeId(segment.end)
    if (from === to) {
      return
    }
    const angleForward = Math.atan2(
      segment.end.y - segment.start.y,
      segment.end.x - segment.start.x
    )
    const angleBackward = Math.atan2(
      segment.start.y - segment.end.y,
      segment.start.x - segment.end.x
    )
    const forwardIndex = edges.length
    const backwardIndex = edges.length + 1
    edges.push({
      from,
      to,
      angle: angleForward,
      rev: backwardIndex
    })
    edges.push({
      from: to,
      to: from,
      angle: angleBackward,
      rev: forwardIndex
    })
    ensureAdj(from)
    ensureAdj(to)
    adjacency[from].push(forwardIndex)
    adjacency[to].push(backwardIndex)
  })

  adjacency.forEach((edgeIds) => {
    edgeIds.sort((a, b) => edges[a].angle - edges[b].angle)
  })

  const visited = new Array(edges.length).fill(false)
  const faces: Vec2[][] = []

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex]) {
      continue
    }

    const face: Vec2[] = []
    let currentEdge = edgeIndex
    let guard = 0

    while (!visited[currentEdge] && guard < edges.length * 2) {
      guard += 1
      visited[currentEdge] = true
      const edge = edges[currentEdge]
      face.push(pointsList[edge.from])

      const outgoing = adjacency[edge.to] ?? []
      if (outgoing.length === 0) {
        break
      }
      const revIndex = outgoing.indexOf(edge.rev)
      if (revIndex === -1) {
        break
      }
      const nextIndex = (revIndex - 1 + outgoing.length) % outgoing.length
      currentEdge = outgoing[nextIndex]
      if (currentEdge === edgeIndex) {
        break
      }
    }

    if (face.length < 3) {
      continue
    }

    const area = polygonArea(face)
    if (Math.abs(area) <= INTERSECTION_EPS) {
      continue
    }

    faces.push(face)
  }

  if (faces.length === 0) {
    return []
  }

  if (directedSegments.length === 0) {
    return []
  }

  return faces.filter((face) => {
    const centroid = polygonCentroid(face)
    return evenOddContains(centroid, directedSegments)
  })
}

const buildEvenOddShape = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  pointOffset: PositionData
): EvenOddShape => {
  const shape: EvenOddShape = { paths: [] }
  orderedNetworks.forEach((network) => {
    const segmentsList: EvenOddSegment[] = []
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
        segmentsList.push({
          type: 'line',
          points: [
            start.x - pointOffset.x,
            start.y - pointOffset.y,
            end.x - pointOffset.x,
            end.y - pointOffset.y
          ]
        })
      } else {
        segmentsList.push({
          type: 'cubicBezier',
          points: [
            start.x - pointOffset.x,
            start.y - pointOffset.y,
            (outControl?.x ?? start.x) - pointOffset.x,
            (outControl?.y ?? start.y) - pointOffset.y,
            (inControl?.x ?? end.x) - pointOffset.x,
            (inControl?.y ?? end.y) - pointOffset.y,
            end.x - pointOffset.x,
            end.y - pointOffset.y
          ]
        })
      }
    })

    if (segmentsList.length > 0) {
      shape.paths.push({ segments: segmentsList })
    }
  })

  return shape
}

const drawVectorNetworkPath = (
  graphic: Parameters<EngineNeutralRenderStrategy>[0],
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  pointOffset: PositionData
) => {
  const first = getAnchorNode(points, network.pointIds[0])
  if (!first) {
    return
  }

  const linearPoints = [
    { x: first.x - pointOffset.x, y: first.y - pointOffset.y }
  ]
  let isLinear = true
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
    if (outControl || inControl) {
      isLinear = false
      return
    }
    linearPoints.push({
      x: end.x - pointOffset.x,
      y: end.y - pointOffset.y
    })
  })
  if (isLinear && linearPoints.length > 1) {
    graphic.poly(linearPoints, network.closed)
    return
  }

  graphic.moveTo(first.x - pointOffset.x, first.y - pointOffset.y)

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
      graphic.lineTo(end.x - pointOffset.x, end.y - pointOffset.y)
      return
    }

    graphic.bezierCurveTo(
      (outControl?.x ?? start.x) - pointOffset.x,
      (outControl?.y ?? start.y) - pointOffset.y,
      (inControl?.x ?? end.x) - pointOffset.x,
      (inControl?.y ?? end.y) - pointOffset.y,
      end.x - pointOffset.x,
      end.y - pointOffset.y
    )
  })

  if (network.closed) {
    graphic.closePath()
  }
}

const drawVectorPath = (
  graphic: Parameters<EngineNeutralRenderStrategy>[0],
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  pointOffset: PositionData
) => {
  orderedNetworks.forEach((network) =>
    drawVectorNetworkPath(graphic, network, points, segments, pointOffset)
  )
}

const drawFillFaces = (
  graphic: Parameters<EngineNeutralRenderStrategy>[0],
  faces: Vec2[][]
) => {
  faces.forEach((face) => {
    if (face.length < 3) {
      return
    }
    graphic.moveTo(face[0].x, face[0].y)
    for (let i = 1; i < face.length; i += 1) {
      graphic.lineTo(face[i].x, face[i].y)
    }
    graphic.closePath()
  })
}

const getFillPayload = (fills: FillAttrs[]): FillAttrs[] =>
  Array.isArray(fills) && fills.length > 0 ? fills : []

const applyBaseVectorStroke = (
  graphic: Parameters<EngineNeutralRenderStrategy>[0],
  strokes: StrokeAttrs[],
  replayPath: () => void
): void => {
  for (const stroke of strokes) {
    if (!isRecord(stroke)) {
      continue
    }

    const width = stroke.width
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
      continue
    }

    const fill = getRenderableFill([stroke.fill])
    if (!fill || fill.kind !== 'solid') {
      continue
    }

    replayPath()
    graphic.stroke({ color: fill.color, alpha: fill.alpha, width })
    return
  }
}

interface VectorFillHitCache {
  preparedFillShape: PreparedEvenOddShape
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  pointOffsetX: number
  pointOffsetY: number
  hasVisibleFill: boolean
  hitArea: { contains: (x: number, y: number) => boolean }
}

const renderVectorGraphic = (
  graphic: Parameters<EngineNeutralRenderStrategy>[0],
  data: unknown
): void => {
  const renderData = normalizeVectorRenderData(data)
  const cache = graphic as typeof graphic & {
    __asyraVectorFillCache?: FillFaceCache
    __asyraEvenOddFillCache?: EvenOddFillCache
    __asyraVectorFillHitCache?: VectorFillHitCache
  }

  graphic.clear()
  ;(graphic as { hitArea: unknown | null }).hitArea = null
  setElementGeometryLocalBounds(
    graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
    null
  )

  const renderStateGraphic = graphic as typeof graphic & {
    geometry?: { clear?: () => void }
    batched?: boolean
    _transform?: { updateLocalTransform?: () => void }
  }
  renderStateGraphic.geometry?.clear?.()
  renderStateGraphic.batched = false
  renderStateGraphic._transform?.updateLocalTransform?.()

  const {
    fills,
    x,
    y,
    points,
    segments,
    networks,
    rotation,
    scaleX,
    scaleY,
    skewX,
    skewY
  } = renderData
  const orderedNetworks = sortVectorItemsById(Object.values(networks))
  const workspaceGeometryBounds = calculateVectorLocalBounds(
    points,
    segments,
    orderedNetworks
  )
  const pointOffset = {
    x: workspaceGeometryBounds.x,
    y: workspaceGeometryBounds.y
  }
  vectorRenderGeometryProjectionCache.set(graphic, {
    workspaceOrigin: pointOffset
  })

  graphic.x = x
  graphic.y = y
  graphic.rotation = rotation
  setElementGeometryLocalBounds(
    graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
    {
      x: 0,
      y: 0,
      width: workspaceGeometryBounds.width,
      height: workspaceGeometryBounds.height
    }
  )
  graphic.width = renderData.width
  graphic.height = renderData.height
  graphic.scale.set(scaleX, scaleY)
  graphic.skew.set(skewX, skewY)

  if (orderedNetworks.length === 0) {
    return
  }

  const fillPayload = getFillPayload(fills)
  const hasRenderableFill = getRenderableFills(fillPayload).length > 0
  const hasClosedNetwork =
    renderData.closed === true ||
    orderedNetworks.some(
      (network) => network.closed && network.pointIds.length > 2
    )
  const shape = buildEvenOddShape(
    orderedNetworks,
    points,
    segments,
    pointOffset
  )

  if (hasRenderableFill) {
    const preparedFillShape = prepareEvenOddShape(shape)
    const hitCache = cache.__asyraVectorFillHitCache
    const reuseHitArea =
      hitCache?.points === points &&
      hitCache.segments === segments &&
      hitCache.networks === networks &&
      hitCache.pointOffsetX === pointOffset.x &&
      hitCache.pointOffsetY === pointOffset.y &&
      hitCache.hasVisibleFill === true
    const hitArea = reuseHitArea
      ? hitCache.hitArea
      : {
          contains: (hitX: number, hitY: number) =>
            isPointInsidePreparedEvenOddShape(
              { x: hitX, y: hitY },
              preparedFillShape
            )
        }
    cache.__asyraVectorFillHitCache = {
      preparedFillShape,
      points,
      segments,
      networks,
      pointOffsetX: pointOffset.x,
      pointOffsetY: pointOffset.y,
      hasVisibleFill: true,
      hitArea
    }
    ;(graphic as { hitArea: typeof hitArea }).hitArea = hitArea
  } else {
    cache.__asyraVectorFillHitCache = undefined
  }

  if (fillPayload.length === 0) {
    if (cache.__asyraEvenOddFillCache?.fill) {
      cache.__asyraEvenOddFillCache.fill.dispose()
      cache.__asyraEvenOddFillCache = undefined
    }
    applyBaseVectorStroke(graphic, renderData.strokes ?? [], () =>
      drawVectorPath(graphic, orderedNetworks, points, segments, pointOffset)
    )
    return
  }

  const hasGradient = fillPayload.some((fill) => fill.kind === 'gradient')
  let previewFill = false
  if (hasGradient) {
    const evenOddCache = cache.__asyraEvenOddFillCache ?? { fill: null }
    const reuseEvenOddFill =
      evenOddCache.fill &&
      evenOddCache.width === renderData.width &&
      evenOddCache.height === renderData.height &&
      evenOddCache.fillPayload === fillPayload &&
      evenOddCache.points === points &&
      evenOddCache.segments === segments &&
      evenOddCache.networks === networks &&
      evenOddCache.pointOffsetX === pointOffset.x &&
      evenOddCache.pointOffsetY === pointOffset.y

    if (!reuseEvenOddFill) {
      evenOddCache.fill?.dispose()
      evenOddCache.fill = core.createEvenOddFillStyle({
        width: renderData.width,
        height: renderData.height,
        offsetX: 0,
        offsetY: 0,
        shape,
        fills: fillPayload
      })
      evenOddCache.width = renderData.width
      evenOddCache.height = renderData.height
      evenOddCache.fillPayload = fillPayload
      evenOddCache.points = points
      evenOddCache.segments = segments
      evenOddCache.networks = networks
      evenOddCache.pointOffsetX = pointOffset.x
      evenOddCache.pointOffsetY = pointOffset.y
    }
    cache.__asyraEvenOddFillCache = evenOddCache

    if (evenOddCache.fill) {
      graphic.rect(0, 0, renderData.width, renderData.height)
      ;(graphic as { fill: (style: unknown) => void }).fill(
        evenOddCache.fill.style
      )
    } else if (hasClosedNetwork) {
      previewFill = true
    }
  } else {
    cache.__asyraEvenOddFillCache?.fill?.dispose()
    cache.__asyraEvenOddFillCache = undefined
    if (renderData.fillRule === 'nonzero' && hasClosedNetwork) {
      cache.__asyraVectorFillCache = undefined
      drawVectorPath(graphic, orderedNetworks, points, segments, pointOffset)
      applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
        replayPath: () =>
          drawVectorPath(
            graphic,
            orderedNetworks,
            points,
            segments,
            pointOffset
          )
      })
    } else {
      const fillCache = cache.__asyraVectorFillCache ?? { faces: [] }
      const {
        flattenedSegments,
        directedSegments,
        segmentKeyMap,
        segmentLinesMap
      } = buildFlattenedSegmentsWithCache(
        orderedNetworks,
        points,
        segments,
        fillCache,
        pointOffset
      )
      const fillFaces = buildFillFaces(flattenedSegments, directedSegments)
      fillCache.faces = fillFaces
      fillCache.segmentKeyMap = segmentKeyMap
      fillCache.segmentLinesMap = segmentLinesMap
      cache.__asyraVectorFillCache = fillCache

      if (fillFaces.length > 0) {
        drawFillFaces(graphic, fillFaces)
        applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
          replayPath: () => drawFillFaces(graphic, fillFaces)
        })
      } else if (hasClosedNetwork) {
        previewFill = true
      }
    }
  }

  if (previewFill) {
    applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
      replayPath: () =>
        drawVectorPath(graphic, orderedNetworks, points, segments, pointOffset)
    })
  }

  applyBaseVectorStroke(graphic, renderData.strokes ?? [], () =>
    drawVectorPath(graphic, orderedNetworks, points, segments, pointOffset)
  )
}

export const VECTOR_RENDER_STRATEGY: EngineNeutralRenderStrategy =
  Object.assign(
    (
      graphic: Parameters<EngineNeutralRenderStrategy>[0],
      data: Parameters<EngineNeutralRenderStrategy>[1]
    ) => {
      renderVectorGraphic(graphic, data)
    },
    {
      directPropertyKeys: Object.freeze([
        'x',
        'y',
        'width',
        'height',
        'rotation',
        'scaleX',
        'scaleY',
        'skewX',
        'skewY'
      ])
    }
  )

export const VECTOR_COMPONENT_DEFINITION: ComponentDefinition = {
  type: 'vector',
  idPrefix: 'vector',
  namePrefix: 'Vector',
  registration: PRESET_REGISTRATION,
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y', 'rotation']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'points',
      type: PropertyTypes.VECTOR_POINTS,
      defaultValue: {} as Record<string, VectorPointNode>
    },
    {
      name: 'segments',
      type: PropertyTypes.VECTOR_SEGMENTS,
      defaultValue: {} as Record<string, VectorSegment>
    },
    {
      name: 'networks',
      type: PropertyTypes.VECTOR_NETWORKS,
      defaultValue: {} as Record<string, VectorNetwork>
    },
    {
      name: 'closed',
      type: PropertyTypes.CUSTOM,
      defaultValue: false
    },
    {
      name: 'pointCoordinateSpace',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'workspace'
    },
    {
      name: 'fillRule',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'nonzero'
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_VECTOR_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: [
        createDefaultStroke({
          color: '#cccccc',
          visible: true,
          joinType: StrokeJoinTypes.ROUND
        })
      ]
    }
  ]
}
