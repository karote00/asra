import { type GeometryBackend, type PolygonRegion } from './geometry-backend'
import {
  type CompoundLegalDomainClassification,
  type PathTopologyFillRule,
  type PathTopologyModel,
  isPointInsideTopologyPolygon
} from './path-topology-model'
import { buildSourceSpanGraph } from './source-span-graph'
import { EPS, distance, type Vec2 } from './solid-stroke-geometry-core'

export type LegalDomainNormalizationMode =
  | 'containment-depth'
  | 'backend-boolean'

export type LegalDomainNormalizationBlockedReason =
  | 'source-topology-not-normalized'
  | 'requires-exact-backend'
  | 'missing-shell-or-hole'

export interface NormalizedBoundarySpan {
  boundarySpanId: string
  role: 'fill-exterior-edge' | 'fill-interior-edge'
  geometry: Vec2[]
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  sourceSpanIds: string[]
  seamPoint: Vec2 | null
}

export interface NormalizedLegalDomain {
  legalDomainId: string
  fillRule: PathTopologyFillRule
  mode: LegalDomainNormalizationMode
  regions: PolygonRegion[]
  boundarySpans: NormalizedBoundarySpan[]
  classifications: CompoundLegalDomainClassification[]
}

export interface LegalDomainNormalizationOptions {
  legalDomainId: string
  backend?: GeometryBackend
  allowBackendNormalization?: boolean
}

export type LegalDomainNormalizationResult =
  | {
      status: 'normalized'
      legalDomain: NormalizedLegalDomain
    }
  | {
      status: 'blocked'
      reason: LegalDomainNormalizationBlockedReason
      classifications: CompoundLegalDomainClassification[]
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

const allPointsInsideTopology = (
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

      const leftInsideRight = allPointsInsideTopology(
        left.normalizedPoints,
        right
      )
      const rightInsideLeft = allPointsInsideTopology(
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

const classifyByContainmentDepth = (
  topologies: PathTopologyModel[]
): CompoundLegalDomainClassification[] =>
  topologies.flatMap((topology) => {
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
        allPointsInsideTopology(topology.normalizedPoints, candidate)
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

const chooseTopmostLeftmostIndex = (points: Vec2[]) => {
  let selectedIndex = 0
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    const selected = points[selectedIndex]
    if (
      point.y < selected.y - EPS ||
      (Math.abs(point.y - selected.y) <= EPS && point.x < selected.x)
    ) {
      selectedIndex = index
    }
  }

  return selectedIndex
}

const rotateRingToDeterministicSeam = (points: Vec2[]) => {
  if (points.length <= 1) {
    return points
  }

  const seamIndex = chooseTopmostLeftmostIndex(points)
  return [...points.slice(seamIndex), ...points.slice(0, seamIndex)]
}

const getSourceSpanIds = (topology: PathTopologyModel) =>
  buildSourceSpanGraph(topology).spans.map((span) => span.sourceSpanId)

const getClassificationTopology = (
  topologies: PathTopologyModel[],
  classification: CompoundLegalDomainClassification
) => topologies.find((topology) => topology.pathId === classification.pathId)

const toPolygonRegion = (
  topology: PathTopologyModel,
  role: CompoundLegalDomainClassification['role'] = 'shell'
): PolygonRegion => ({
  polygons: [
    role === 'hole'
      ? [...topology.normalizedPoints].reverse()
      : topology.normalizedPoints
  ]
})

const buildContainmentBoundarySpans = (
  topologies: PathTopologyModel[],
  classifications: CompoundLegalDomainClassification[]
): NormalizedBoundarySpan[] =>
  classifications.flatMap((classification) => {
    const topology = getClassificationTopology(topologies, classification)
    if (!topology) {
      return []
    }

    const geometry = rotateRingToDeterministicSeam(topology.normalizedPoints)
    return [
      {
        boundarySpanId: `${classification.legalDomainId}:boundary:${classification.networkId}`,
        role:
          classification.role === 'shell'
            ? 'fill-exterior-edge'
            : 'fill-interior-edge',
        geometry,
        sourceNetworkIds: [classification.networkId],
        sourceContourIds: [classification.contourId],
        sourceSpanIds: getSourceSpanIds(topology),
        seamPoint: geometry[0] ?? null
      }
    ]
  })

const buildBackendBoundarySpans = (
  legalDomainId: string,
  regions: PolygonRegion[],
  sourceContourIds: string[],
  sourceNetworkIds: string[],
  sourceSpanIds: string[]
): NormalizedBoundarySpan[] =>
  regions.flatMap((region, regionIndex) =>
    region.polygons.map((polygon, polygonIndex) => {
      const geometry = rotateRingToDeterministicSeam(polygon)
      const isNestedBoundary = region.polygons.some(
        (candidate, candidateIndex) =>
          candidateIndex !== polygonIndex &&
          polygon.every((point) => isPointInsidePolygon(point, candidate))
      )
      return {
        boundarySpanId: `${legalDomainId}:normalized-boundary:${regionIndex}:${polygonIndex}`,
        role: isNestedBoundary ? 'fill-interior-edge' : 'fill-exterior-edge',
        geometry,
        sourceNetworkIds,
        sourceContourIds,
        sourceSpanIds,
        seamPoint: geometry[0] ?? null
      }
    })
  )

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]
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

const hasShellAndHole = (
  classifications: CompoundLegalDomainClassification[]
) =>
  classifications.some((classification) => classification.role === 'shell') &&
  classifications.some((classification) => classification.role === 'hole')

const getArcLength = (points: Vec2[]) => {
  if (points.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index])
  }
  length += distance(points[points.length - 1], points[0])
  return length
}

const byBoundaryLengthThenId = (
  left: NormalizedBoundarySpan,
  right: NormalizedBoundarySpan
) => {
  const lengthDelta = getArcLength(right.geometry) - getArcLength(left.geometry)
  if (Math.abs(lengthDelta) > EPS) {
    return lengthDelta
  }
  return left.boundarySpanId.localeCompare(right.boundarySpanId)
}

export const buildCompoundLegalDomainNormalization = (
  topologies: PathTopologyModel[],
  options: LegalDomainNormalizationOptions
): LegalDomainNormalizationResult => {
  const eligibleTopologies = topologies.filter(
    (topology) => topology.closed && topology.isSimpleClosed
  )
  if (eligibleTopologies.length !== topologies.length) {
    return {
      status: 'blocked',
      reason: 'source-topology-not-normalized',
      classifications: []
    }
  }

  const classifications = classifyByContainmentDepth(eligibleTopologies)
  if (!hasShellAndHole(classifications)) {
    return {
      status: 'blocked',
      reason: 'missing-shell-or-hole',
      classifications
    }
  }

  const fillRule = eligibleTopologies[0]?.fillRule ?? 'evenodd'
  const shellClassifications = classifications.filter(
    (classification) => classification.role === 'shell'
  )
  const holeClassifications = classifications.filter(
    (classification) => classification.role === 'hole'
  )

  if (!hasNonContainmentOverlap(eligibleTopologies)) {
    const regions = classifications.flatMap((classification) => {
      const topology = getClassificationTopology(
        eligibleTopologies,
        classification
      )
      return topology ? [toPolygonRegion(topology, classification.role)] : []
    })
    const boundarySpans = buildContainmentBoundarySpans(
      eligibleTopologies,
      classifications
    ).sort(byBoundaryLengthThenId)

    return {
      status: 'normalized',
      legalDomain: {
        legalDomainId: options.legalDomainId,
        fillRule,
        mode: 'containment-depth',
        regions,
        boundarySpans,
        classifications: classifications.map((classification) => ({
          ...classification,
          legalDomainId: options.legalDomainId
        }))
      }
    }
  }

  if (!options.allowBackendNormalization || !options.backend) {
    return {
      status: 'blocked',
      reason: 'requires-exact-backend',
      classifications
    }
  }

  const shellRegions = shellClassifications.flatMap((classification) => {
    const topology = getClassificationTopology(
      eligibleTopologies,
      classification
    )
    return topology ? [toPolygonRegion(topology)] : []
  })
  const holeRegions = holeClassifications.flatMap((classification) => {
    const topology = getClassificationTopology(
      eligibleTopologies,
      classification
    )
    return topology ? [toPolygonRegion(topology)] : []
  })
  const normalizedShells = options.backend.union(shellRegions, 'nonzero')
  const normalizedHoles = options.backend.union(holeRegions, 'nonzero')
  const normalizedRegions = options.backend.difference(
    normalizedShells,
    normalizedHoles,
    'nonzero'
  )
  const sourceContourIds = classifications.map(
    (classification) => classification.contourId
  )
  const sourceNetworkIds = classifications.map(
    (classification) => classification.networkId
  )
  const sourceSpanIds = eligibleTopologies.flatMap(getSourceSpanIds)

  return {
    status: 'normalized',
    legalDomain: {
      legalDomainId: options.legalDomainId,
      fillRule,
      mode: 'backend-boolean',
      regions: normalizedRegions,
      boundarySpans: buildBackendBoundarySpans(
        options.legalDomainId,
        normalizedRegions,
        sourceContourIds,
        sourceNetworkIds,
        sourceSpanIds
      ).sort(byBoundaryLengthThenId),
      classifications: classifications.map((classification) => ({
        ...classification,
        legalDomainId: options.legalDomainId
      }))
    }
  }
}
