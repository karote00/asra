import { PropertyTypes, createDefaultFill } from '@asyra/utils'
import type { FillAttrs } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/core'
import { VECTOR_TOKENS, defineComponent } from '@asyra/core'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { DEFAULT_VECTOR_FILLS, applyRenderableFill } from './fills'

interface VectorComputedData {
  x: number
  y: number
  width: number
  height: number
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  fills: FillAttrs[]
  fill?: string
  stroke: string
  strokeWidth: number
}

const parseHexColor = (color: string, fallback: number) => {
  const parsed = Number.parseInt(color.replace('#', ''), 16)
  return Number.isNaN(parsed) ? fallback : parsed
}

const getNumericSuffix = (value: string) => {
  const match = value.match(/[-_](\d+)$/)
  if (!match) {
    return Number.NaN
  }

  return Number.parseInt(match[1], 10)
}

const getNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

type Vec2 = { x: number; y: number }

type FillFaceCache = {
  faces: Vec2[][]
  lastRebuildAt: number
  lastRenderAt: number
  revision: number
  pendingTimerId?: ReturnType<typeof setTimeout>
}

const isAnchorNode = (
  node: VectorPointNode | undefined
): node is VectorPointNode & { kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR } =>
  !!node && node.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

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
const INTERSECTION_EPS = 1e-6
const NODE_KEY_EPS = 1e-4
const MAX_OPEN_SEGMENTS = 1200
const FILL_REBUILD_MIN_INTERVAL_MS = 120
const FILL_HEAVY_REBUILD_MIN_INTERVAL_MS = 260
const FILL_RAPID_RENDER_THRESHOLD_MS = 40
const FILL_DEFERRED_REBUILD_MS = 140
const FILL_HEAVY_COMPLEXITY_THRESHOLD = 320

const cubicBezierPoint = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number) => {
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

const estimateCurveLength = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) =>
  Math.hypot(p1.x - p0.x, p1.y - p0.y) +
  Math.hypot(p2.x - p1.x, p2.y - p1.y) +
  Math.hypot(p3.x - p2.x, p3.y - p2.y)

const getFlattenSteps = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) => {
  const length = estimateCurveLength(p0, p1, p2, p3)
  const steps = Math.ceil(length / 12)
  return Math.max(MIN_FLATTEN_STEPS, Math.min(MAX_FLATTEN_STEPS, steps))
}

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

type LineSegment = { start: Vec2; end: Vec2 }

const splitSegmentsByIntersections = (segments: LineSegment[]): LineSegment[] => {
  const splitParams = segments.map(() => [0, 1])

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
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
      if (
        Math.hypot(end.x - start.x, end.y - start.y) <= INTERSECTION_EPS
      ) {
        continue
      }
      result.push({ start, end })
    }
  })

  return result
}

type DirectedEdge = {
  from: number
  to: number
  angle: number
  rev: number
}

type DirectedSegment = {
  start: Vec2
  end: Vec2
}

const buildDirectedSegments = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): DirectedSegment[] => {
  const directedSegments: DirectedSegment[] = []

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

      if (!outControl && !inControl) {
        directedSegments.push({
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y }
        })
        return
      }

      const p0 = { x: start.x, y: start.y }
      const p1 = outControl ? { x: outControl.x, y: outControl.y } : p0
      const p3 = { x: end.x, y: end.y }
      const p2 = inControl ? { x: inControl.x, y: inControl.y } : p3
      const pointsOnCurve = flattenCubic(
        p0,
        p1,
        p2,
        p3,
        getFlattenSteps(p0, p1, p2, p3)
      )

      for (let i = 0; i < pointsOnCurve.length - 1; i += 1) {
        directedSegments.push({
          start: pointsOnCurve[i],
          end: pointsOnCurve[i + 1]
        })
      }
    })
  })

  return directedSegments
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
    const crossValue = points[i].x * points[next].y - points[next].x * points[i].y
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

    if ((p1.y > y) === (p2.y > y)) {
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
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): Vec2[][] => {
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

      if (!outControl && !inControl) {
        flattenedSegments.push({
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y }
        })
        return
      }

      const p0 = { x: start.x, y: start.y }
      const p1 = outControl ? { x: outControl.x, y: outControl.y } : p0
      const p3 = { x: end.x, y: end.y }
      const p2 = inControl ? { x: inControl.x, y: inControl.y } : p3
      const pointsOnCurve = flattenCubic(
        p0,
        p1,
        p2,
        p3,
        getFlattenSteps(p0, p1, p2, p3)
      )

      for (let i = 0; i < pointsOnCurve.length - 1; i += 1) {
        flattenedSegments.push({
          start: pointsOnCurve[i],
          end: pointsOnCurve[i + 1]
        })
      }
    })
  })

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

  const directedSegments = buildDirectedSegments(
    orderedNetworks,
    points,
    segments
  )
  if (directedSegments.length === 0) {
    return []
  }

  return faces.filter((face) => {
    const centroid = polygonCentroid(face)
    return evenOddContains(centroid, directedSegments)
  })
}

const estimateFlattenedSegmentComplexity = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  let count = 0
  orderedNetworks.forEach((network) => {
    network.segmentIds.forEach((segmentId) => {
      const segment = segments[segmentId]
      if (!segment) {
        return
      }
      const outControl = getControlNode(points, segment.outControlId)
      const inControl = getControlNode(points, segment.inControlId)
      count += outControl || inControl ? MIN_FLATTEN_STEPS : 1
    })
  })
  return count
}

const drawVectorNetworkPath = (
  graphic: Parameters<RenderStrategy>[0],
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  const first = getAnchorNode(points, network.pointIds[0])
  if (!first) {
    return
  }

  graphic.moveTo(first.x, first.y)

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
      graphic.lineTo(end.x, end.y)
      return
    }

    graphic.bezierCurveTo(
      outControl?.x ?? start.x,
      outControl?.y ?? start.y,
      inControl?.x ?? end.x,
      inControl?.y ?? end.y,
      end.x,
      end.y
    )
  })

  if (network.closed) {
    graphic.closePath()
  }
}

const drawVectorPath = (
  graphic: Parameters<RenderStrategy>[0],
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  orderedNetworks.forEach((network) =>
    drawVectorNetworkPath(graphic, network, points, segments)
  )
}

const drawFillFaces = (
  graphic: Parameters<RenderStrategy>[0],
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

const getFillPayload = (fills: FillAttrs[], fill?: string): FillAttrs[] => {
  if (Array.isArray(fills) && fills.length > 0) {
    return fills
  }

  if (typeof fill === 'string' && fill !== 'none') {
    return [createDefaultFill({ color: fill, visible: true })]
  }

  return []
}

const renderVectorGraphic = (
  graphic: Parameters<RenderStrategy>[0],
  data: VectorComputedData,
  options: { forceFillRebuild?: boolean; allowDeferredFill?: boolean } = {}
) => {
  graphic.clear()

  const {
    fills,
    fill,
    stroke,
    strokeWidth,
    x,
    y,
    points,
    segments,
    networks
  } = data

  const orderedNetworks = sortByStableId(Object.values(networks))
  if (orderedNetworks.length === 0) {
    return
  }

  graphic.x = x
  graphic.y = y

  const strokeColor = parseHexColor(stroke, 0xcccccc)
  const fillPayload = getFillPayload(fills, fill)

  if (fillPayload.length > 0) {
    const graphicCache = graphic as typeof graphic & {
      __asyraVectorFillCache?: FillFaceCache
    }
    const now = getNow()
    const cache = graphicCache.__asyraVectorFillCache ?? {
      faces: [],
      lastRebuildAt: 0,
      lastRenderAt: 0,
      revision: 0
    }
    const lastRenderAt = cache.lastRenderAt
    const complexity = estimateFlattenedSegmentComplexity(
      orderedNetworks,
      points,
      segments
    )
    const heavy = complexity >= FILL_HEAVY_COMPLEXITY_THRESHOLD
    const rebuildInterval = heavy
      ? FILL_HEAVY_REBUILD_MIN_INTERVAL_MS
      : FILL_REBUILD_MIN_INTERVAL_MS
    const rapidRender = now - lastRenderAt < FILL_RAPID_RENDER_THRESHOLD_MS
    const shouldRebuild =
      options.forceFillRebuild ||
      (!rapidRender && now - cache.lastRebuildAt >= rebuildInterval)

    if (cache.pendingTimerId) {
      clearTimeout(cache.pendingTimerId)
      cache.pendingTimerId = undefined
    }

    let fillFaces = cache.faces
    if (shouldRebuild) {
      fillFaces = buildFillFaces(orderedNetworks, points, segments)
      cache.faces = fillFaces
      cache.lastRebuildAt = now
    }

    cache.lastRenderAt = now
    cache.revision += 1
    graphicCache.__asyraVectorFillCache = cache

    if (!shouldRebuild && options.allowDeferredFill !== false) {
      const scheduledRevision = cache.revision
      const deferredDelay = heavy
        ? FILL_DEFERRED_REBUILD_MS * 2
        : FILL_DEFERRED_REBUILD_MS
      cache.pendingTimerId = setTimeout(() => {
        const activeCache = graphicCache.__asyraVectorFillCache
        if (!activeCache || activeCache.revision !== scheduledRevision) {
          return
        }
        if ('destroyed' in graphic && graphic.destroyed) {
          return
        }
        const deferredFaces = buildFillFaces(orderedNetworks, points, segments)
        activeCache.faces = deferredFaces
        activeCache.lastRebuildAt = getNow()
        activeCache.pendingTimerId = undefined
        renderVectorGraphic(graphic, data, { allowDeferredFill: false })
      }, deferredDelay)
    }

    if (fillFaces.length > 0) {
      drawFillFaces(graphic, fillFaces)
      applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
        replayPath: () => drawFillFaces(graphic, fillFaces)
      })
    }
  } else {
    const graphicCache = graphic as typeof graphic & {
      __asyraVectorFillCache?: FillFaceCache
    }
    if (graphicCache.__asyraVectorFillCache?.pendingTimerId) {
      clearTimeout(graphicCache.__asyraVectorFillCache.pendingTimerId)
      graphicCache.__asyraVectorFillCache.pendingTimerId = undefined
    }
  }

  drawVectorPath(graphic, orderedNetworks, points, segments)

  if ('stroke' in graphic && typeof graphic.stroke === 'function') {
    graphic.stroke({
      width: strokeWidth,
      color: strokeColor,
      cap: 'round',
      join: 'round'
    })
  }
}

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  renderVectorGraphic(graphic, data as VectorComputedData)
}

defineComponent({
  type: 'vector',
  idPrefix: 'vector',
  namePrefix: 'Vector',
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
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
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_VECTOR_FILLS
    },
    {
      name: 'fill',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'none'
    },
    {
      name: 'strokeStyle',
      type: PropertyTypes.CUSTOM,
      alias: ['stroke', 'strokeWidth'],
      defaultValue: {
        stroke: '#cccccc',
        strokeWidth: 1
      }
    }
  ],
  renderStrategy: vectorRenderStrategy
})
