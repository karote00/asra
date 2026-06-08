import {
  allocateDashedCenterStrokeIntervals,
  type DashedCenterStrokeIntervalAllocationOptions
} from './dashed-center-stroke-intervals'
import {
  EPS,
  dedupeAdjacent,
  distance,
  isSimpleClosedPolygon,
  isSimpleOpenPath,
  normalizeClosed,
  polygonArea,
  type Vec2
} from './solid-stroke-geometry-core'

export type PathTopologySourceFamily = 'shape' | 'vector' | 'unknown'
export type PathTopologyFillRule = 'evenodd' | 'nonzero'

export type PathTopologyFamily =
  | 'open'
  | 'rectangle-equivalent'
  | 'broader-simple-closed'
  | 'sampled-simple-closed'
  | 'self-intersecting'
  | 'degenerate'

export interface PathTopologySegmentDescriptor {
  segmentId: string
  startIndex: number
  endIndex: number
  length: number
}

export interface PathTopologyLegalDomainDescriptor {
  legalDomainId: string
  role: 'open' | 'shell' | 'hole' | 'blocked'
  fillRule: PathTopologyFillRule
  fillRuleBasis: PathTopologyFillRule
  contourIds: string[]
}

export interface PathTopologyContour {
  contourId: string
  role: 'shell' | 'hole' | 'open'
  networkId: string
  orientation: 'cw' | 'ccw' | 'none-for-open'
  isClosed: boolean
  nestingDepth: number
  legalDomainId: string | null
  arcLength: number
  vertices: Vec2[]
  segments: PathTopologySegmentDescriptor[]
  samples: Vec2[]
}

export interface PathTopologyModel {
  pathId: string
  sourceId: string
  networkId: string
  revision: string
  sourceRevision: string
  sourceFamily: PathTopologySourceFamily
  topologyFamily: PathTopologyFamily
  fillRule: PathTopologyFillRule
  fillRuleBasis: PathTopologyFillRule
  canonicalLengthBasis: 'arc-length-on-topology'
  closed: boolean
  normalizedPoints: Vec2[]
  totalLength: number
  isSimpleClosed: boolean
  isSimpleOpen: boolean
  contours: PathTopologyContour[]
  intersectionDescriptors: { kind: 'self-intersection' }[]
  legalDomains: PathTopologyLegalDomainDescriptor[]
  legalDomainDescriptors: PathTopologyLegalDomainDescriptor[]
  metadata: {
    pointCount: number
    segmentCount: number
    contourCount: number
    legalDomainCount: number
  }
}

export interface CompoundLegalDomainClassification {
  pathId: string
  networkId: string
  contourId: string
  legalDomainId: string
  fillRule: PathTopologyFillRule
  role: 'shell' | 'hole'
  nestingDepth: number
}

export interface BuildPathTopologyModelInput {
  pathId: string
  sourceId?: string
  networkId?: string
  sourceRevision?: string
  sourceFamily?: PathTopologySourceFamily
  fillRule?: PathTopologyFillRule | null
  points: Vec2[]
  closed: boolean
}

export const normalizePathTopologyFillRule = (
  fillRule: PathTopologyFillRule | null | undefined
): PathTopologyFillRule => (fillRule === 'evenodd' ? 'evenodd' : 'nonzero')

const normalizeTopologyPoints = (points: Vec2[], closed: boolean) =>
  closed ? normalizeClosed(dedupeAdjacent(points)) : dedupeAdjacent(points)

const getTopologyLength = (points: Vec2[], closed: boolean) => {
  if (points.length < 2) {
    return 0
  }

  let totalLength = 0
  for (let index = 1; index < points.length; index += 1) {
    totalLength += distance(points[index - 1], points[index])
  }

  if (closed && points.length > 2) {
    totalLength += distance(points[points.length - 1], points[0])
  }

  return totalLength
}

const getTopologyRevision = (
  points: Vec2[],
  closed: boolean,
  fillRule: PathTopologyFillRule
) =>
  [
    closed ? 'closed' : 'open',
    `fillRule:${fillRule}`,
    points
      .map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`)
      .join(';')
  ].join('|')

const isRectangleEquivalent = (points: Vec2[]) => {
  if (points.length !== 4) {
    return false
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  if (maxX - minX <= EPS || maxY - minY <= EPS) {
    return false
  }

  return points.every(
    (point) =>
      (Math.abs(point.x - minX) <= EPS || Math.abs(point.x - maxX) <= EPS) &&
      (Math.abs(point.y - minY) <= EPS || Math.abs(point.y - maxY) <= EPS)
  )
}

export const classifyPathTopologyModel = (
  topology: Pick<
    PathTopologyModel,
    'closed' | 'normalizedPoints' | 'isSimpleClosed'
  >
): PathTopologyFamily => {
  if (topology.normalizedPoints.length < 2) {
    return 'degenerate'
  }

  if (!topology.closed) {
    return 'open'
  }

  if (!topology.isSimpleClosed) {
    return 'self-intersecting'
  }

  if (isRectangleEquivalent(topology.normalizedPoints)) {
    return 'rectangle-equivalent'
  }

  return topology.normalizedPoints.length === 4
    ? 'broader-simple-closed'
    : 'sampled-simple-closed'
}

export const buildPathTopologyModel = ({
  pathId,
  sourceId = pathId,
  networkId = 'default',
  sourceRevision,
  sourceFamily = 'unknown',
  fillRule,
  points,
  closed
}: BuildPathTopologyModelInput): PathTopologyModel => {
  const normalizedFillRule = normalizePathTopologyFillRule(fillRule)
  const normalizedPoints = normalizeTopologyPoints(points, closed)
  const topologyRevision = getTopologyRevision(
    normalizedPoints,
    closed,
    normalizedFillRule
  )
  const totalLength = getTopologyLength(normalizedPoints, closed)
  const simpleClosed =
    closed && normalizedPoints.length >= 3
      ? isSimpleClosedPolygon(normalizedPoints)
      : false
  const simpleOpen =
    !closed && normalizedPoints.length >= 2
      ? isSimpleOpenPath(normalizedPoints)
      : false
  const area = closed ? polygonArea(normalizedPoints) : 0
  const topologyFamily = classifyPathTopologyModel({
    closed,
    normalizedPoints,
    isSimpleClosed: simpleClosed
  })
  const legalDomainId =
    topologyFamily === 'open' || topologyFamily === 'degenerate'
      ? null
      : `${pathId}:legal-domain:0`
  const segments: PathTopologySegmentDescriptor[] = normalizedPoints.flatMap(
    (_point, index) => {
      const nextIndex = index + 1
      if (nextIndex >= normalizedPoints.length) {
        if (!closed || normalizedPoints.length < 3) {
          return []
        }
        return [
          {
            segmentId: `segment:${index}`,
            startIndex: index,
            endIndex: 0,
            length: distance(normalizedPoints[index], normalizedPoints[0])
          }
        ]
      }

      return [
        {
          segmentId: `segment:${index}`,
          startIndex: index,
          endIndex: nextIndex,
          length: distance(normalizedPoints[index], normalizedPoints[nextIndex])
        }
      ]
    }
  )
  const contours: PathTopologyContour[] = [
    {
      contourId: `${pathId}:contour:0`,
      role: closed ? 'shell' : 'open',
      networkId,
      orientation: closed ? (area >= 0 ? 'ccw' : 'cw') : 'none-for-open',
      isClosed: closed,
      nestingDepth: 0,
      legalDomainId,
      arcLength: totalLength,
      vertices: normalizedPoints,
      segments,
      samples: normalizedPoints
    }
  ]
  const legalDomains: PathTopologyLegalDomainDescriptor[] = legalDomainId
    ? [
        {
          legalDomainId,
          role: 'shell',
          fillRule: normalizedFillRule,
          fillRuleBasis: normalizedFillRule,
          contourIds: [`${pathId}:contour:0`]
        }
      ]
    : []

  return {
    pathId,
    sourceId,
    networkId,
    revision: topologyRevision,
    sourceRevision: sourceRevision ?? topologyRevision,
    sourceFamily,
    topologyFamily,
    fillRule: normalizedFillRule,
    fillRuleBasis: normalizedFillRule,
    canonicalLengthBasis: 'arc-length-on-topology',
    closed,
    normalizedPoints,
    totalLength,
    isSimpleClosed: simpleClosed,
    isSimpleOpen: simpleOpen,
    contours,
    intersectionDescriptors:
      topologyFamily === 'self-intersecting' || (!closed && !simpleOpen)
        ? [{ kind: 'self-intersection' }]
        : [],
    legalDomains,
    legalDomainDescriptors: legalDomains,
    metadata: {
      pointCount: normalizedPoints.length,
      segmentCount: segments.length,
      contourCount: contours.length,
      legalDomainCount: legalDomains.length
    }
  }
}

export const allocateDashedIntervalsForTopology = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'>,
  pattern: number[],
  offset: number,
  options?: DashedCenterStrokeIntervalAllocationOptions
) =>
  allocateDashedCenterStrokeIntervals(
    topology.totalLength,
    pattern,
    offset,
    topology.closed,
    options
  )

export const isPointInsideTopologyPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, prev = polygon.length - 1;
    index < polygon.length;
    prev = index, index += 1
  ) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[prev]
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const getPointBounds = (points: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  return { minX, minY, maxX, maxY }
}

const boundsOverlapOrTouch = (
  left: ReturnType<typeof getPointBounds>,
  right: ReturnType<typeof getPointBounds>
) =>
  left.maxX >= right.minX &&
  right.maxX >= left.minX &&
  left.maxY >= right.minY &&
  right.maxY >= left.minY

const areAllPointsInsideTopology = (
  points: Vec2[],
  container: PathTopologyModel
) =>
  points.every((point) =>
    isPointInsideTopologyPolygon(point, container.normalizedPoints)
  )

const hasNonContainmentOverlap = (topologies: PathTopologyModel[]) => {
  for (let leftIndex = 0; leftIndex < topologies.length - 1; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < topologies.length;
      rightIndex += 1
    ) {
      const left = topologies[leftIndex]
      const right = topologies[rightIndex]
      if (
        !boundsOverlapOrTouch(
          getPointBounds(left.normalizedPoints),
          getPointBounds(right.normalizedPoints)
        )
      ) {
        continue
      }

      const leftInsideRight = areAllPointsInsideTopology(
        left.normalizedPoints,
        right
      )
      const rightInsideLeft = areAllPointsInsideTopology(
        right.normalizedPoints,
        left
      )
      if (!leftInsideRight && !rightInsideLeft) {
        return true
      }
    }
  }

  return false
}

export const classifyCompoundClosedLegalDomains = (
  topologies: PathTopologyModel[]
): CompoundLegalDomainClassification[] => {
  const eligibleTopologies = topologies.filter(
    (topology) => topology.closed && topology.isSimpleClosed
  )
  if (
    eligibleTopologies.length !== topologies.length ||
    hasNonContainmentOverlap(eligibleTopologies)
  ) {
    return []
  }

  return eligibleTopologies.flatMap((topology) => {
    if (!topology.closed || !topology.isSimpleClosed) {
      return []
    }

    const probe = topology.normalizedPoints[0]
    if (!probe) {
      return []
    }

    const nestingDepth = topologies.filter(
      (candidate) =>
        candidate.pathId !== topology.pathId &&
        candidate.closed &&
        candidate.isSimpleClosed &&
        candidate.normalizedPoints.length >= 3 &&
        areAllPointsInsideTopology(topology.normalizedPoints, candidate)
    ).length
    const role = nestingDepth % 2 === 0 ? 'shell' : 'hole'

    return [
      {
        pathId: topology.pathId,
        networkId: topology.networkId,
        contourId: `${topology.pathId}:contour:0`,
        legalDomainId: `${topology.pathId}:legal-domain:0`,
        fillRule: topology.fillRule,
        role,
        nestingDepth
      }
    ]
  })
}
