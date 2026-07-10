import { earcut } from 'pixi.js'
import type {
  ArrangementFace,
  CandidateRegion,
  FillRule,
  GeometryBackend,
  PolygonRegion,
  StrokeArrangementPosition
} from './geometry-backend'
import { getGeometryBackendCacheSignature } from './geometry-backend'
import {
  classifyArrangementFacesByLegalDomain,
  type ArrangementLegalDomain
} from './arrangement-face-classifier'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokePaintPacket,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import {
  buildStrokeFinalFacesFromResolvedPackets,
  collapseExactDuplicateFinalFaces,
  type StrokeFinalFace,
  type StrokeOwnerKey
} from './stroke-final-face'
import { pushUniqueStrokeOwner } from './stroke-ownership'
import type { ConstrainedDashedProductEvidenceEnvelope } from './stroke-product-evidence'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ArrangedStrokeFinalFace = StrokeFinalFace<
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokePaintPacket
>

export interface StrokeCandidateArrangementOptions {
  backend: Pick<GeometryBackend, 'buildArrangement'> &
    Partial<Pick<GeometryBackend, 'difference' | 'intersection' | 'union'>>
  legalDomains?: ArrangementLegalDomain[]
  strokePosition?: StrokeArrangementPosition
}

export interface StrokeVisualOverlapCollapseOptions {
  backend: Pick<GeometryBackend, 'union'> &
    Partial<
      Pick<
        GeometryBackend,
        'buildArrangement' | 'capabilities' | 'difference' | 'intersection'
      >
    >
  fillRule?: FillRule
  legalDomains?: ArrangementLegalDomain[]
}

const MAX_ARRANGEMENT_CACHE_ENTRIES = 64
const MAX_VISUAL_OVERLAP_COLLAPSE_CACHE_ENTRIES = 64
const VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE = 0.03
const VISUAL_OVERLAP_COLLINEAR_TOLERANCE = 0.0075
const VISUAL_OVERLAP_AREA_DELTA_TOLERANCE = 0.001

const arrangementResultCache = new WeakMap<
  object,
  Map<string, ArrangedStrokeFinalFace[]>
>()
const visualOverlapCollapseResultCache = new WeakMap<
  object,
  Map<string, ArrangedStrokeFinalFace[]>
>()

const canUseVisualOverlapUnion = (
  backend: StrokeVisualOverlapCollapseOptions['backend']
) => backend.capabilities?.union !== false

const canUseVisualOverlapArrangement = (
  backend: StrokeVisualOverlapCollapseOptions['backend']
) =>
  typeof backend.buildArrangement === 'function' &&
  backend.capabilities?.buildArrangement !== false

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const measureVectorRenderPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraVectorRenderDetailPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderDetailPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const getBounds = (polygons: Vec2[][]): Bounds => {
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

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  return { minX, minY, maxX, maxY }
}

const hasRegionGeometry = (region: { polygons: Vec2[][] }) =>
  region.polygons.some((polygon) => polygon.length >= 3)

const getSignedArea = (polygon: Vec2[]) => {
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    area += current.x * next.y - next.x * current.y
  }

  return area / 2
}

const getPointDistance = (left: Vec2, right: Vec2) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const isNearVisualOverlapCollinearPoint = (
  previous: Vec2,
  point: Vec2,
  next: Vec2
) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  const scale = Math.max(Math.hypot(ax, ay) + Math.hypot(bx, by), 1)
  return (
    Math.abs(ax * by - ay * bx) / scale <= VISUAL_OVERLAP_COLLINEAR_TOLERANCE
  )
}

const shouldCleanVisualOverlapPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 40) {
    return false
  }

  return polygon.some(
    (point, index) =>
      getPointDistance(point, polygon[(index + 1) % polygon.length]) <
      VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE
  )
}

const cleanVisualOverlapPolygon = (polygon: Vec2[]) => {
  if (!shouldCleanVisualOverlapPolygon(polygon)) {
    return polygon
  }

  const originalArea = Math.abs(getSignedArea(polygon))
  if (originalArea <= 1e-6) {
    return polygon
  }

  let cleaned = polygon
  for (let pass = 0; pass < 6; pass += 1) {
    const compacted: Vec2[] = []
    for (const point of cleaned) {
      const previous = compacted[compacted.length - 1]
      if (
        !previous ||
        getPointDistance(previous, point) > VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE
      ) {
        compacted.push(point)
      }
    }

    if (
      compacted.length > 2 &&
      getPointDistance(compacted[0], compacted[compacted.length - 1]) <=
        VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE
    ) {
      compacted.pop()
    }
    if (compacted.length < 3) {
      break
    }

    const simplified = compacted.filter((point, index) => {
      const previous =
        compacted[(index - 1 + compacted.length) % compacted.length]
      const next = compacted[(index + 1) % compacted.length]
      return (
        getPointDistance(previous, point) >
          VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE &&
        getPointDistance(point, next) > VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE &&
        !isNearVisualOverlapCollinearPoint(previous, point, next)
      )
    })
    if (simplified.length < 3) {
      break
    }
    cleaned = simplified
    if (simplified.length === compacted.length) {
      break
    }
  }

  const cleanedArea = Math.abs(getSignedArea(cleaned))
  if (
    cleaned.length < 3 ||
    Math.abs(cleanedArea - originalArea) / originalArea >
      VISUAL_OVERLAP_AREA_DELTA_TOLERANCE
  ) {
    return polygon
  }

  return cleaned
}

const pruneVisualOverlapMicroEdges = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return polygon
  }

  let cleaned = polygon
  for (let pass = 0; pass < 160 && cleaned.length >= 4; pass += 1) {
    const removeIndex = cleaned.findIndex((point, index) => {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]
      const next = cleaned[(index + 1) % cleaned.length]
      return (
        getPointDistance(previous, point) <=
          VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE ||
        getPointDistance(point, next) <= VISUAL_OVERLAP_MICRO_EDGE_TOLERANCE
      )
    })
    if (removeIndex < 0) {
      break
    }

    const compacted = cleaned.filter((_, index) => index !== removeIndex)
    if (compacted.length < 3 || Math.abs(getSignedArea(compacted)) <= 1e-6) {
      break
    }
    cleaned = compacted
  }

  return cleaned
}

const cleanVisualOverlapPolygons = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) =>
      pruneVisualOverlapMicroEdges(cleanVisualOverlapPolygon(polygon))
    )
    .filter((polygon) => polygon.length >= 3)

// Same-visual overlap collapse treats every input polygon as coverage, not as a
// shell/hole contour role. Normalize winding before nonzero union so equivalent
// coverage cannot cancel itself into a zero-layer result.
const normalizeCoveragePolygonWinding = (polygon: Vec2[]) =>
  getSignedArea(polygon) < 0 ? [...polygon].reverse() : polygon

const normalizeCoverageRegionWinding = (face: ArrangedStrokeFinalFace) => ({
  polygons: face.polygons.map(normalizeCoveragePolygonWinding)
})

const boundsOverlap = (left: Bounds, right: Bounds) =>
  left.minX < right.maxX &&
  left.maxX > right.minX &&
  left.minY < right.maxY &&
  left.maxY > right.minY

const hasAnyBoundsOverlap = (faces: ArrangedStrokeFinalFace[]) => {
  const sortedFaces = [...faces].sort(
    (left, right) => left.bounds.minX - right.bounds.minX
  )

  for (let leftIndex = 0; leftIndex < sortedFaces.length; leftIndex += 1) {
    const left = sortedFaces[leftIndex]
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedFaces.length &&
      sortedFaces[rightIndex].bounds.minX < left.bounds.maxX;
      rightIndex += 1
    ) {
      if (boundsOverlap(left.bounds, sortedFaces[rightIndex].bounds)) {
        return true
      }
    }
  }

  return false
}

const partitionFinalFacesByBoundsConnectivity = (
  faces: ArrangedStrokeFinalFace[]
) => {
  if (faces.length < 2) {
    return [faces]
  }

  const visited = new Set<number>()
  const groups: ArrangedStrokeFinalFace[][] = []

  for (let startIndex = 0; startIndex < faces.length; startIndex += 1) {
    if (visited.has(startIndex)) {
      continue
    }

    const group: ArrangedStrokeFinalFace[] = []
    const queue = [startIndex]
    visited.add(startIndex)

    while (queue.length > 0) {
      const currentIndex = queue.shift()
      if (currentIndex === undefined) {
        continue
      }

      const current = faces[currentIndex]
      group.push(current)

      for (let nextIndex = 0; nextIndex < faces.length; nextIndex += 1) {
        if (visited.has(nextIndex)) {
          continue
        }

        if (boundsOverlap(current.bounds, faces[nextIndex].bounds)) {
          visited.add(nextIndex)
          queue.push(nextIndex)
        }
      }
    }

    groups.push(group)
  }

  return groups
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
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

const hasContainedContour = (polygons: Vec2[][]) =>
  polygons.some((candidate, candidateIndex) => {
    const sample = candidate[0]
    if (!sample) {
      return false
    }

    return polygons.some(
      (container, containerIndex) =>
        containerIndex !== candidateIndex && pointInPolygon(sample, container)
    )
  })

const decomposeNestedContoursToCoverageCells = (
  polygons: Vec2[][]
): Vec2[][] => {
  if (!hasContainedContour(polygons)) {
    return polygons
  }

  const contourInfo = polygons.map((polygon, index) => {
    const sample = polygon[0]
    const containers = sample
      ? polygons
          .map((container, containerIndex) => ({
            containerIndex,
            area: Math.abs(getSignedArea(container)),
            contains:
              containerIndex !== index && pointInPolygon(sample, container)
          }))
          .filter((container) => container.contains)
          .sort((left, right) => left.area - right.area)
      : []

    return {
      index,
      polygon,
      depth: containers.length,
      parentIndex: containers[0]?.containerIndex
    }
  })
  const triangles: Vec2[][] = []

  contourInfo
    .filter((contour) => contour.depth % 2 === 0)
    .forEach((outer) => {
      const holes = contourInfo.filter(
        (contour) =>
          contour.depth % 2 === 1 && contour.parentIndex === outer.index
      )
      const vertices: number[] = []
      const sourcePoints: Vec2[] = []
      const holeIndices: number[] = []
      const appendPolygon = (polygon: Vec2[]) => {
        polygon.forEach((point) => {
          vertices.push(point.x, point.y)
          sourcePoints.push(point)
        })
      }

      appendPolygon(outer.polygon)
      holes.forEach((hole) => {
        holeIndices.push(sourcePoints.length)
        appendPolygon(hole.polygon)
      })

      const indices = earcut(vertices, holeIndices)
      for (let index = 0; index < indices.length; index += 3) {
        const triangle = [
          sourcePoints[indices[index]],
          sourcePoints[indices[index + 1]],
          sourcePoints[indices[index + 2]]
        ].filter((point): point is Vec2 => Boolean(point))
        if (triangle.length === 3 && Math.abs(getSignedArea(triangle)) > 0) {
          triangles.push(triangle)
        }
      }
    })

  return triangles.length > 0 ? triangles : polygons
}

export const getRegionCoveragePolygons = (region: PolygonRegion) =>
  decomposeNestedContoursToCoverageCells(region.polygons)

const getVisualCollapseRegions = (faces: ArrangedStrokeFinalFace[]) =>
  faces.flatMap((face) =>
    face.polygons.map((polygon) => ({
      polygons: [normalizeCoveragePolygonWinding(polygon)]
    }))
  )

const hasOverlappingPolygonsInFace = (face: ArrangedStrokeFinalFace) => {
  if (face.polygons.length < 2) {
    return false
  }

  const polygonBounds = face.polygons.map((polygon) => getBounds([polygon]))
  for (let leftIndex = 0; leftIndex < polygonBounds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < polygonBounds.length;
      rightIndex += 1
    ) {
      if (boundsOverlap(polygonBounds[leftIndex], polygonBounds[rightIndex])) {
        return true
      }
    }
  }

  return false
}

const getPolygonRegionArea = (regions: PolygonRegion[]) =>
  regions.reduce(
    (total, region) =>
      total +
      region.polygons.reduce(
        (regionTotal, polygon) =>
          regionTotal + Math.abs(getSignedArea(polygon)),
        0
      ),
    0
  )

const polygonsHaveIntersectionArea = (
  left: Vec2[],
  right: Vec2[],
  backend: Pick<GeometryBackend, 'intersection'>,
  fillRule: FillRule = 'nonzero'
) => {
  if (!boundsOverlap(getBounds([left]), getBounds([right]))) {
    return false
  }

  try {
    const intersections = backend.intersection(
      [{ polygons: [normalizeCoveragePolygonWinding(left)] }],
      [{ polygons: [normalizeCoveragePolygonWinding(right)] }],
      fillRule
    )
    return (
      getPolygonRegionArea(intersections) > VISUAL_OVERLAP_AREA_DELTA_TOLERANCE
    )
  } catch {
    return true
  }
}

const hasAnyPolygonIntersection = (
  faces: ArrangedStrokeFinalFace[],
  options: Pick<StrokeVisualOverlapCollapseOptions, 'backend' | 'fillRule'>
) => {
  const intersection = options.backend.intersection
  if (typeof intersection !== 'function') {
    return hasAnyBoundsOverlap(faces)
  }

  const sortedFaces = [...faces].sort(
    (left, right) => left.bounds.minX - right.bounds.minX
  )
  const backend = { intersection }
  for (let leftIndex = 0; leftIndex < sortedFaces.length; leftIndex += 1) {
    const left = sortedFaces[leftIndex]
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedFaces.length &&
      sortedFaces[rightIndex].bounds.minX < left.bounds.maxX;
      rightIndex += 1
    ) {
      const right = sortedFaces[rightIndex]
      if (!boundsOverlap(left.bounds, right.bounds)) {
        continue
      }
      if (
        left.polygons.some((leftPolygon) =>
          right.polygons.some((rightPolygon) =>
            polygonsHaveIntersectionArea(
              leftPolygon,
              rightPolygon,
              backend,
              options.fillRule
            )
          )
        )
      ) {
        return true
      }
    }
  }

  return false
}

const hasPolygonIntersectionWithinFace = (
  face: ArrangedStrokeFinalFace,
  options: Pick<StrokeVisualOverlapCollapseOptions, 'backend' | 'fillRule'>
) => {
  const intersection = options.backend.intersection
  if (typeof intersection !== 'function') {
    return hasOverlappingPolygonsInFace(face)
  }

  const backend = { intersection }
  for (let leftIndex = 0; leftIndex < face.polygons.length; leftIndex += 1) {
    const left = face.polygons[leftIndex]
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < face.polygons.length;
      rightIndex += 1
    ) {
      if (
        polygonsHaveIntersectionArea(
          left,
          face.polygons[rightIndex],
          backend,
          options.fillRule
        )
      ) {
        return true
      }
    }
  }

  return false
}

const shouldAttemptVisualOverlapCollapse = (
  faces: ArrangedStrokeFinalFace[],
  options: Pick<StrokeVisualOverlapCollapseOptions, 'backend' | 'fillRule'>
) =>
  faces.length >= 2
    ? hasAnyPolygonIntersection(faces, options)
    : Boolean(faces[0] && hasPolygonIntersectionWithinFace(faces[0], options))

const hashStableString = (prefix: string, value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${prefix}:${(hash >>> 0).toString(36)}`
}

const pushUnique = <T>(items: T[], value: T) => {
  if (!items.includes(value)) {
    items.push(value)
  }
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

const setBoundedCacheEntry = <T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries: number
) => {
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, value)
}

const getBackendCacheGroup = <T>(
  rootCache: WeakMap<object, Map<string, T>>,
  backend: object
) => {
  let cache = rootCache.get(backend)
  if (!cache) {
    cache = new Map()
    rootCache.set(backend, cache)
  }

  return cache
}

const collectMergedFaceMetadata = (faces: ArrangedStrokeFinalFace[]) => {
  const sourceGeometryIds: string[] = []
  const ownerSet: StrokeOwnerKey[] = []
  const ownerStepIds: string[] = []
  const intervalIds: string[] = []
  const terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[] = []
  const seamBoundaryIds: string[] = []
  const sourceSpanIds: string[] = []
  const sourceNetworkIds: string[] = []
  const sourceContourIds: string[] = []
  const legalDomainIds: string[] = []
  const domainPlanSplitRangeTerminals: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
  > = []
  const dashProductIntervals: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
  > = []
  const joinOwnershipRecords: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['joinOwnershipRecords']
  > = []
  const dashEndpointCapPolicySignatures: string[] = []
  const joinOwnershipSignatures: string[] = []
  const smoothContinuityGroupIds: string[] = []
  const terminalKeys = new Set<string>()
  const dashIntervalKeys = new Set<string>()
  const joinOwnershipRecordKeys = new Set<string>()

  faces.forEach((face) => {
    face.sourceGeometryIds.forEach((id) => pushUnique(sourceGeometryIds, id))
    face.ownerSet.forEach((owner) => pushUniqueStrokeOwner(ownerSet, owner))
    face.ownerStepIds.forEach((id) => pushUnique(ownerStepIds, id))
    face.intervalIds.forEach((id) => pushUnique(intervalIds, id))
    face.terminalRoles.forEach((role) => pushUnique(terminalRoles, role))
    face.seamBoundaryIds.forEach((id) => pushUnique(seamBoundaryIds, id))
    face.sourceSpanIds.forEach((id) => pushUnique(sourceSpanIds, id))
    ;(face.sourceNetworkIds ?? []).forEach((id) =>
      pushUnique(sourceNetworkIds, id)
    )
    face.sourceContourIds.forEach((id) => pushUnique(sourceContourIds, id))
    face.legalDomainIds.forEach((id) => pushUnique(legalDomainIds, id))
    face.debugMeta?.domainPlanSplitRangeTerminals?.forEach((terminal) => {
      const key = [
        terminal.intervalId,
        terminal.splitRangeId,
        terminal.terminalRole,
        terminal.startDistance,
        terminal.endDistance
      ].join('|')
      if (terminalKeys.has(key)) {
        return
      }
      terminalKeys.add(key)
      domainPlanSplitRangeTerminals.push({ ...terminal })
    })
    face.debugMeta?.dashProductIntervals?.forEach((interval) => {
      const key = [
        interval.intervalId,
        interval.splitRangeId,
        interval.terminalRole,
        interval.startDistance,
        interval.endDistance
      ].join('|')
      if (dashIntervalKeys.has(key)) {
        return
      }
      dashIntervalKeys.add(key)
      dashProductIntervals.push({ ...interval })
    })
    face.debugMeta?.joinOwnershipRecords?.forEach((record) => {
      const key = stableStringify(record)
      if (joinOwnershipRecordKeys.has(key)) {
        return
      }
      joinOwnershipRecordKeys.add(key)
      joinOwnershipRecords.push({ ...record })
    })
    ;[
      ...(face.debugMeta?.dashEndpointCapPolicySignatures ?? []),
      face.debugMeta?.dashEndpointCapPolicySignature
    ].forEach((signature) => {
      if (signature) {
        pushUnique(dashEndpointCapPolicySignatures, signature)
      }
    })
    ;[
      ...(face.debugMeta?.joinOwnershipSignatures ?? []),
      face.debugMeta?.joinOwnershipSignature
    ].forEach((signature) => {
      if (signature) {
        pushUnique(joinOwnershipSignatures, signature)
      }
    })
    ;[
      ...(face.debugMeta?.smoothContinuityGroupIds ?? []),
      face.debugMeta?.smoothContinuityGroupId
    ].forEach((groupId) => {
      if (groupId) {
        pushUnique(smoothContinuityGroupIds, groupId)
      }
    })
  })

  return {
    sourceGeometryIds,
    ownerSet,
    ownerStepIds,
    intervalIds,
    terminalRoles,
    seamBoundaryIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals,
    dashProductIntervals,
    joinOwnershipRecords,
    dashEndpointCapPolicySignatures,
    joinOwnershipSignatures,
    smoothContinuityGroupIds
  }
}

const getFaceProductMode = (face: ArrangedStrokeFinalFace) =>
  face.debugMeta?.productMode

const getFaceProductSignature = (face: ArrangedStrokeFinalFace) =>
  face.debugMeta?.productSignature

const isCenterProductFace = (face: ArrangedStrokeFinalFace) =>
  getFaceProductMode(face) === 'center-product'

const isDashedCenterProductFace = (face: ArrangedStrokeFinalFace) =>
  isCenterProductFace(face) &&
  getFaceProductSignature(face) === 'center-product:dashed'

const isSolidCenterProductFace = (face: ArrangedStrokeFinalFace) =>
  isCenterProductFace(face) &&
  getFaceProductSignature(face) === 'center-product:solid'

const isConstrainedSolidProductFace = (face: ArrangedStrokeFinalFace) =>
  getFaceProductSignature(face)?.startsWith('constrained-solid:') === true

const isConstrainedDashedProductFace = (face: ArrangedStrokeFinalFace) =>
  getFaceProductSignature(face)?.startsWith('constrained-dashed:') === true

const isSelfIntersectingProductFace = (face: ArrangedStrokeFinalFace) =>
  face.debugMeta?.topologyFamily === 'self-intersecting'

const isExactArrangementFace = (face: ArrangedStrokeFinalFace) =>
  face.debugMeta?.arrangementStatus === 'exact'

const getCandidatePosition = (
  face: ArrangedStrokeFinalFace,
  defaultPosition?: StrokeArrangementPosition
): StrokeArrangementPosition => {
  const position = face.debugMeta?.strokePosition ?? defaultPosition
  if (!position) {
    throw new Error(
      `Cannot build arrangement candidate "${face.faceId}" without typed strokePosition`
    )
  }

  return position
}

export const buildStrokeArrangementCandidates = (
  faces: ArrangedStrokeFinalFace[],
  options: { strokePosition?: StrokeArrangementPosition } = {}
): CandidateRegion[] =>
  faces.map((face) => {
    const owner = face.ownerSet[0]

    return {
      candidateId: face.faceId,
      geometry: {
        polygons: face.polygons
      },
      visualPacketKey: face.visualPacketKey,
      strokePosition: getCandidatePosition(face, options.strokePosition),
      sourcePathId: owner?.sourcePathId,
      networkId: owner?.networkId,
      strokeId: owner?.strokeId,
      strokeIndex: owner?.strokeIndex,
      ownerKey: owner?.ownerKey,
      intervalId: face.intervalIds[0],
      contourId: face.sourceContourIds[0],
      legalDomainId: face.legalDomainIds[0] ?? null,
      paintKey: face.paintKey,
      strokeSpecKey: face.strokeSpecKey,
      sourceSpanIds: face.sourceSpanIds,
      sourceNetworkIds: face.sourceNetworkIds,
      sourceContourIds: face.sourceContourIds
    }
  })

const isLegalForPosition = (
  position: StrokeArrangementPosition,
  legalState: ArrangementFace['legalState']
) => {
  switch (position) {
    case 'inside':
      return legalState.insideFillDomain
    case 'outside':
      return legalState.outsideFillDomain
    case 'center':
      return true
  }
}

const selectOwnedArrangementCandidates = (
  candidates: CandidateRegion[],
  faceByCandidateId: Map<string, ArrangedStrokeFinalFace>
) => {
  if (candidates.length < 2) {
    return candidates
  }

  const faces = candidates.map((candidate) =>
    faceByCandidateId.get(candidate.candidateId)
  )
  if (
    !faces.every((face): face is ArrangedStrokeFinalFace =>
      Boolean(face && isConstrainedSolidProductFace(face))
    )
  ) {
    return candidates
  }

  const strokeIndices = candidates
    .map((candidate) => candidate.strokeIndex)
    .filter((index): index is number => typeof index === 'number')
  if (strokeIndices.length !== candidates.length) {
    return candidates
  }

  const ownerStrokeIndex = Math.min(...strokeIndices)
  return candidates.filter(
    (candidate) => candidate.strokeIndex === ownerStrokeIndex
  )
}

const groupByVisualPacket = (
  candidates: CandidateRegion[],
  faceByCandidateId: Map<string, ArrangedStrokeFinalFace>,
  legalState: ArrangementFace['legalState']
) => {
  const groups = new Map<
    string,
    {
      candidates: CandidateRegion[]
      faces: ArrangedStrokeFinalFace[]
    }
  >()

  selectOwnedArrangementCandidates(candidates, faceByCandidateId).forEach(
    (candidate) => {
      const sourceFace = faceByCandidateId.get(candidate.candidateId)
      if (!sourceFace) {
        throw new Error(
          `Arrangement face references unknown candidate "${candidate.candidateId}"`
        )
      }
      const position = candidate.strokePosition
      if (!position) {
        throw new Error(
          `Arrangement candidate "${candidate.candidateId}" is missing typed strokePosition`
        )
      }

      if (!isLegalForPosition(position, legalState)) {
        return
      }

      const existing = groups.get(candidate.visualPacketKey) ?? {
        candidates: [],
        faces: []
      }
      existing.candidates.push(candidate)
      existing.faces.push(sourceFace)
      groups.set(candidate.visualPacketKey, existing)
    }
  )

  return [...groups.values()]
}

const canClipLegalDomains = (
  backend: Partial<
    Pick<
      GeometryBackend,
      'buildArrangement' | 'difference' | 'intersection' | 'union'
    >
  >
): backend is Pick<
  GeometryBackend,
  'buildArrangement' | 'difference' | 'intersection' | 'union'
> =>
  typeof backend.buildArrangement === 'function' &&
  typeof backend.difference === 'function' &&
  typeof backend.intersection === 'function' &&
  typeof backend.union === 'function'
const getBackendSignature = (backend: object) =>
  'backendId' in backend &&
  'backendVersion' in backend &&
  'coordinatePolicy' in backend
    ? getGeometryBackendCacheSignature(backend as GeometryBackend)
    : 'custom-backend'

const serializePolygon = (polygon: Vec2[]) =>
  polygon.map((point) => [point.x, point.y])

const serializeRegion = (region: PolygonRegion) =>
  region.polygons.map(serializePolygon)

const buildArrangementResultCacheKey = (
  candidates: CandidateRegion[],
  options: StrokeCandidateArrangementOptions
) =>
  hashStableString(
    'arrangement-cache',
    stableStringify({
      backend: getBackendSignature(options.backend as object),
      strokePosition: options.strokePosition ?? null,
      clipLegalDomains:
        (options.legalDomains?.length ?? 0) > 0 &&
        canClipLegalDomains(options.backend),
      legalDomains:
        options.legalDomains?.map((domain) => ({
          legalDomainId: domain.legalDomainId ?? null,
          fillRule: domain.fillRule,
          regions: domain.regions.map(serializeRegion)
        })) ?? [],
      candidates: candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        visualPacketKey: candidate.visualPacketKey,
        strokePosition: candidate.strokePosition,
        sourcePathId: candidate.sourcePathId ?? null,
        networkId: candidate.networkId ?? null,
        strokeId: candidate.strokeId ?? null,
        strokeIndex: candidate.strokeIndex ?? null,
        ownerKey: candidate.ownerKey ?? null,
        intervalId: candidate.intervalId ?? null,
        contourId: candidate.contourId ?? null,
        legalDomainId: candidate.legalDomainId ?? null,
        paintKey: candidate.paintKey ?? null,
        strokeSpecKey: candidate.strokeSpecKey ?? null,
        sourceSpanIds: candidate.sourceSpanIds,
        sourceContourIds: candidate.sourceContourIds ?? [],
        geometry: serializeRegion(candidate.geometry)
      }))
    })
  )

const getFacePointCount = (face: ArrangedStrokeFinalFace) =>
  face.polygons.reduce((sum, polygon) => sum + polygon.length, 0)

const serializeRevisionSetForVisualOverlapCache = (
  face: ArrangedStrokeFinalFace
) => {
  const revisionSet = face.debugMeta?.revisionSet
  if (!revisionSet) {
    return undefined
  }

  if (!isConstrainedDashedProductFace(face)) {
    return revisionSet
  }

  return {
    sourcePathRevision: revisionSet.sourcePathRevision,
    domainPlanRevision: revisionSet.domainPlanRevision,
    sharedGeometryRevision: revisionSet.sharedGeometryRevision,
    strokeProductRevision: revisionSet.strokeProductRevision,
    strokeDomainRevision: revisionSet.strokeDomainRevision,
    intervalAllocationRevision: revisionSet.intervalAllocationRevision,
    ownershipRevision: revisionSet.ownershipRevision,
    legalityRevision: revisionSet.legalityRevision,
    paintRevision: revisionSet.paintRevision,
    strokeFamilyRevision: revisionSet.strokeFamilyRevision,
    dashAndGapRevision: revisionSet.dashAndGapRevision,
    terminalCapRevision: revisionSet.terminalCapRevision,
    joinShapeRevision: revisionSet.joinShapeRevision,
    smoothContinuityRevision: revisionSet.smoothContinuityRevision,
    productMaterializationRevision: revisionSet.productMaterializationRevision,
    resolvedRegionRevision: revisionSet.resolvedRegionRevision,
    renderOutputRevision: revisionSet.renderOutputRevision
  }
}

const serializeFinalFaceForCache = (face: ArrangedStrokeFinalFace) => {
  const revisionSet = serializeRevisionSetForVisualOverlapCache(face)
  if (revisionSet) {
    return {
      faceId: face.faceId,
      sourceGeometryIds: face.sourceGeometryIds,
      visualPacketKey: face.visualPacketKey,
      paintKey: face.paintKey,
      strokeSpecKey: face.strokeSpecKey,
      bounds: face.bounds,
      ownerSet: face.ownerSet,
      intervalIds: face.intervalIds,
      sourceSpanIds: face.sourceSpanIds,
      sourceNetworkIds: face.sourceNetworkIds,
      sourceContourIds: face.sourceContourIds,
      legalDomainIds: face.legalDomainIds,
      productMode: face.debugMeta?.productMode,
      productSignature: face.debugMeta?.productSignature,
      domainMode: face.debugMeta?.domainMode,
      revisionSet
    }
  }

  emitStrokePipelineCounter('visual-overlap-collapse-polygon-cache-key-rebuilt')
  return {
    faceId: face.faceId,
    sourceGeometryIds: face.sourceGeometryIds,
    polygons: serializeRegion({ polygons: face.polygons }),
    visualPacketKey: face.visualPacketKey,
    paintKey: face.paintKey,
    strokeSpecKey: face.strokeSpecKey,
    ownerSet: face.ownerSet,
    intervalIds: face.intervalIds,
    sourceSpanIds: face.sourceSpanIds,
    sourceNetworkIds: face.sourceNetworkIds,
    sourceContourIds: face.sourceContourIds,
    legalDomainIds: face.legalDomainIds,
    productMode: face.debugMeta?.productMode,
    productSignature: face.debugMeta?.productSignature,
    domainMode: face.debugMeta?.domainMode,
    paint: face.paint,
    debugMeta: face.debugMeta
  }
}

const buildVisualOverlapCollapseCacheKey = (
  faces: ArrangedStrokeFinalFace[],
  options: StrokeVisualOverlapCollapseOptions
) => {
  emitStrokePipelineCounter('visual-overlap-collapse-cache-key')
  emitStrokePipelineCounter(
    'visual-overlap-collapse-input-face-count',
    faces.length
  )
  emitStrokePipelineCounter(
    'visual-overlap-collapse-input-point-count',
    faces.reduce((sum, face) => sum + getFacePointCount(face), 0)
  )
  return hashStableString(
    'visual-overlap-collapse-cache',
    stableStringify({
      backend: getBackendSignature(options.backend as object),
      fillRule: options.fillRule ?? 'nonzero',
      legalDomains:
        options.legalDomains?.map((domain) => ({
          legalDomainId: domain.legalDomainId ?? null,
          fillRule: domain.fillRule,
          regions: domain.regions.map(serializeRegion)
        })) ?? [],
      faces: faces.map(serializeFinalFaceForCache)
    })
  )
}

const getLegalDomainFillRule = (
  legalDomains: ArrangementLegalDomain[]
): FillRule => legalDomains[0]?.fillRule ?? 'evenodd'

const getLegalDomainRegions = (
  legalDomains: ArrangementLegalDomain[],
  backend: Pick<GeometryBackend, 'union'>,
  fillRule: FillRule
) => {
  const regions = legalDomains.flatMap((domain) => domain.regions)
  return regions.length > 0 ? backend.union(regions, fillRule) : []
}

const clipArrangementFacesByLegalDomain = (
  faces: ArrangementFace[],
  legalDomains: ArrangementLegalDomain[],
  backend: Pick<GeometryBackend, 'difference' | 'intersection' | 'union'>
): ArrangementFace[] => {
  if (legalDomains.length === 0) {
    return faces
  }

  const fillRule = getLegalDomainFillRule(legalDomains)
  const legalRegions = getLegalDomainRegions(legalDomains, backend, fillRule)
  if (legalRegions.length === 0) {
    return faces.map((face) => ({
      ...face,
      legalState: {
        insideFillDomain: false,
        outsideFillDomain: true
      }
    }))
  }

  return faces.flatMap((face) => {
    const insideRegions = backend.intersection(
      [face.geometry],
      legalRegions,
      fillRule
    )
    const outsideRegions = backend.difference(
      [face.geometry],
      legalRegions,
      fillRule
    )
    const clippedFaces: ArrangementFace[] = []

    insideRegions.filter(hasRegionGeometry).forEach((geometry, index) => {
      clippedFaces.push({
        ...face,
        faceId: `${face.faceId}:inside-legal:${index}`,
        geometry,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      })
    })

    outsideRegions.filter(hasRegionGeometry).forEach((geometry, index) => {
      clippedFaces.push({
        ...face,
        faceId: `${face.faceId}:outside-legal:${index}`,
        geometry,
        legalState: {
          insideFillDomain: false,
          outsideFillDomain: true
        }
      })
    })

    return clippedFaces
  })
}

const mergeArrangedFaceGroup = (
  arrangementFace: ArrangementFace,
  group: {
    candidates: CandidateRegion[]
    faces: ArrangedStrokeFinalFace[]
  }
): ArrangedStrokeFinalFace => {
  const [primaryFace] = group.faces
  if (!primaryFace) {
    throw new Error('Cannot build arranged final face from an empty group')
  }

  const {
    sourceGeometryIds,
    ownerSet,
    ownerStepIds,
    intervalIds,
    terminalRoles,
    seamBoundaryIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals
  } = collectMergedFaceMetadata(group.faces)

  const candidateIds = group.candidates.map(
    (candidate) => candidate.candidateId
  )
  const polygons = getRegionCoveragePolygons(arrangementFace.geometry)
  const faceId = hashStableString(
    'arranged-face',
    `${arrangementFace.faceId}|${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )
  const renderDescriptor = group.faces.every(
    (face) => face.renderDescriptor === primaryFace.renderDescriptor
  )
    ? primaryFace.renderDescriptor
    : undefined

  return {
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    visualPacketKey: primaryFace.visualPacketKey,
    paintKey: primaryFace.paintKey,
    strokeSpecKey: primaryFace.strokeSpecKey,
    ownerSet,
    ownerStepIds,
    intervalIds,
    terminalRoles,
    seamBoundaryIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    renderDescriptor,
    debugMeta: {
      ...primaryFace.debugMeta,
      productMode: primaryFace.debugMeta?.productMode,
      productSignature: primaryFace.debugMeta?.productSignature,
      domainMode: primaryFace.debugMeta?.domainMode,
      arrangementStatus: 'exact',
      arrangementFaceId: arrangementFace.faceId,
      arrangementCandidateIds: candidateIds,
      arrangementLegalState: arrangementFace.legalState,
      ownerStepIds,
      terminalRoles,
      seamBoundaryIds,
      domainPlanSplitRangeTerminals
    },
    paint: primaryFace.paint
  }
}

export const buildArrangedStrokeFinalFacesFromResolvedPackets = (
  packets: SolidCenterStrokeResolvedPacket[],
  options: StrokeCandidateArrangementOptions
): ArrangedStrokeFinalFace[] => {
  const sourceFaces = buildStrokeFinalFacesFromResolvedPackets<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket,
    SolidCenterStrokeResolvedPacket
  >(packets)
  if (sourceFaces.length === 0) {
    return []
  }

  const candidates = buildStrokeArrangementCandidates(sourceFaces, {
    strokePosition: options.strokePosition
  })
  const cacheKey = buildArrangementResultCacheKey(candidates, options)
  const cache = getBackendCacheGroup(
    arrangementResultCache,
    options.backend as object
  )
  const cachedFaces = cache.get(cacheKey)
  if (cachedFaces) {
    return cachedFaces
  }

  const faceByCandidateId = new Map(
    sourceFaces.map((face) => [face.faceId, face])
  )

  const arrangementFaces =
    options.legalDomains && canClipLegalDomains(options.backend)
      ? clipArrangementFacesByLegalDomain(
          options.backend.buildArrangement(candidates),
          options.legalDomains,
          options.backend
        )
      : classifyArrangementFacesByLegalDomain(
          options.backend.buildArrangement(candidates),
          options.legalDomains ?? []
        )

  const arrangedFaces = arrangementFaces.flatMap((arrangementFace) =>
    groupByVisualPacket(
      arrangementFace.claimedBy,
      faceByCandidateId,
      arrangementFace.legalState
    ).map((group) => mergeArrangedFaceGroup(arrangementFace, group))
  )

  const finalFaces = collapseExactDuplicateFinalFaces(arrangedFaces)
  setBoundedCacheEntry(
    cache,
    cacheKey,
    finalFaces,
    MAX_ARRANGEMENT_CACHE_ENTRIES
  )

  return finalFaces
}

const groupFinalFacesByVisualPacket = (faces: ArrangedStrokeFinalFace[]) => {
  const groups = new Map<string, ArrangedStrokeFinalFace[]>()

  faces.forEach((face) => {
    const constrainedDashVisualCoverageKey =
      getConstrainedDashedVisualCoverageKey(face)
    const groupKey = constrainedDashVisualCoverageKey
      ? constrainedDashVisualCoverageKey
      : isDashedCenterProductFace(face)
        ? [
            face.visualPacketKey,
            'dashed-center-interval',
            stableStringify({
              intervalIds: face.intervalIds,
              ownerSet: face.ownerSet
            })
          ].join('|')
        : face.visualPacketKey
    const existing = groups.get(groupKey) ?? []
    existing.push(face)
    groups.set(groupKey, existing)
  })

  return [...groups.values()]
}

const _isJoinOwnedConstrainedDashedFace = (face: ArrangedStrokeFinalFace) => {
  if (!isConstrainedDashedProductFace(face)) {
    return false
  }
  const meta = face.debugMeta
  const signatures = [
    meta?.joinOwnershipSignature,
    ...(meta?.joinOwnershipSignatures ?? [])
  ].filter((signature): signature is string => Boolean(signature))
  return (
    (meta?.joinOwnershipRecords?.length ?? 0) > 0 ||
    signatures.some(
      (signature) =>
        signature.includes('join-owned') ||
        signature.startsWith('constrained-boundary-') ||
        signature.startsWith('smooth-continuity-bridge')
    ) ||
    meta?.productSignature?.includes(':join-owned:') === true ||
    meta?.productSignature?.includes(':join-owned-terminal-body:') === true ||
    meta?.productSignature?.includes(':smooth-continuity-bridge:') === true
  )
}

const isDomainPlanConstrainedSolidFace = (face: ArrangedStrokeFinalFace) =>
  isConstrainedSolidProductFace(face) && !isExactArrangementFace(face)

const isConstrainedDashedDescriptorFace = (face: ArrangedStrokeFinalFace) =>
  isConstrainedDashedProductFace(face) && face.renderDescriptor !== undefined

const isOutsideJoinOwnedTerminalBodyConstrainedDashedFace = (
  face: ArrangedStrokeFinalFace
) => {
  if (
    !isConstrainedDashedProductFace(face) ||
    face.debugMeta?.strokePosition !== 'outside'
  ) {
    return false
  }

  const joinOwnershipSignatures = [
    face.debugMeta?.joinOwnershipSignature,
    ...(face.debugMeta?.joinOwnershipSignatures ?? [])
  ].filter((signature): signature is string => Boolean(signature))
  return (
    joinOwnershipSignatures.includes('join-owned-terminal-body') ||
    face.debugMeta?.productSignature?.includes(':join-owned-terminal-body:') ===
      true
  )
}

const getConstrainedDashedVisualCoverageKey = (
  face: ArrangedStrokeFinalFace
) => {
  if (!isConstrainedDashedProductFace(face)) {
    return null
  }

  const debugMeta = face.debugMeta
  const baseKey = [
    'constrained-dashed-visual-coverage',
    face.paintKey,
    debugMeta?.networkId ?? 'unknown-network',
    debugMeta?.strokeId ?? 'unknown-stroke',
    debugMeta?.strokeIndex ?? 'unknown-stroke-index',
    debugMeta?.strokePosition ?? 'unknown-stroke-position',
    debugMeta?.strokeWidth ?? 'unknown-stroke-width',
    debugMeta?.strokeCap ?? 'unknown-stroke-cap',
    debugMeta?.strokeJoin ?? 'unknown-stroke-join'
  ]
  const joinOwnershipSignatures = [
    debugMeta?.joinOwnershipSignature,
    ...(debugMeta?.joinOwnershipSignatures ?? [])
  ].filter((signature): signature is string => Boolean(signature))
  const isJoinOwnedTerminalBody =
    joinOwnershipSignatures.includes('join-owned-terminal-body') ||
    debugMeta?.productSignature?.includes(':join-owned-terminal-body:') === true
  if (!isJoinOwnedTerminalBody) {
    return baseKey.join('|')
  }

  if (debugMeta?.strokePosition === 'inside') {
    const joinRecord = debugMeta.joinOwnershipRecords?.[0]
    const vertex = joinRecord?.vertex
    return [
      ...baseKey,
      'join-owned-terminal-body',
      'inside-terminal',
      vertex
        ? `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)}`
        : (debugMeta.productSignature?.match(
            /boundary-terminal-pair:([^:]+,[^:]+)/
          )?.[1] ?? 'unknown-vertex'),
      joinRecord?.selectedSide ?? debugMeta.domainPlanSelectedSide ?? 'side'
    ].join('|')
  }

  return [
    ...baseKey,
    'join-owned-terminal-body',
    debugMeta?.intervalId ?? face.intervalIds.join(','),
    debugMeta?.domainPlanSplitRangeId ?? 'no-split-range',
    debugMeta?.domainPlanTerminalRole ?? 'no-terminal-role',
    debugMeta?.dashEndpointCapPolicySignature ?? 'no-endpoint-cap-policy'
  ].join('|')
}

const hasDashedCenterFace = (faces: ArrangedStrokeFinalFace[]) =>
  faces.some(isDashedCenterProductFace)

const hasConstrainedDashedFace = (faces: ArrangedStrokeFinalFace[]) =>
  faces.some(isConstrainedDashedProductFace)

const hasGradientPaintFace = (faces: ArrangedStrokeFinalFace[]) =>
  faces.some(
    (face) =>
      face.paint.kind === 'gradient' || Boolean(face.paint.gradientStyle)
  )

const isSelfIntersectingConstrainedSolidFace = (
  face: ArrangedStrokeFinalFace
) => isConstrainedSolidProductFace(face) && isSelfIntersectingProductFace(face)

const isSelfIntersectingConstrainedSolidMaskModelFace = (
  face: ArrangedStrokeFinalFace
) =>
  isSelfIntersectingConstrainedSolidFace(face) &&
  isExactArrangementFace(face) &&
  face.debugMeta?.solidMaskModelMaskApplication !== undefined

const hasSelfIntersectingConstrainedSolidMaskModelFace = (
  faces: ArrangedStrokeFinalFace[]
) => faces.some(isSelfIntersectingConstrainedSolidMaskModelFace)

const canCollapseVisualOverlapExactly = (faces: ArrangedStrokeFinalFace[]) =>
  faces.every(
    (face) =>
      !isDomainPlanConstrainedSolidFace(face) &&
      !isConstrainedDashedDescriptorFace(face) &&
      !(
        isSelfIntersectingConstrainedSolidFace(face) &&
        !isExactArrangementFace(face)
      )
  )

const canCollapseDomainPlanConstrainedSolidVisualOverlapByUnion = (
  faces: ArrangedStrokeFinalFace[]
) => {
  if (faces.length < 2) {
    return false
  }

  const strokeIds = new Set(
    faces.map((face) => face.debugMeta?.strokeId).filter(Boolean)
  )
  return (
    strokeIds.size <= 1 &&
    faces.every(
      (face) =>
        isDomainPlanConstrainedSolidFace(face) &&
        isSelfIntersectingConstrainedSolidFace(face) &&
        face.debugMeta?.visualOverlapCollapseStatus !== 'exact-arrangement'
    )
  )
}

const canCollapseConstrainedDashedVisualOverlapByLegalDomain = (
  faces: ArrangedStrokeFinalFace[],
  options: {
    hasLegalDomains: boolean
  }
) => {
  if (!options.hasLegalDomains || faces.length < 2) {
    return false
  }

  const strokeIds = new Set(
    faces.map((face) => face.debugMeta?.strokeId).filter(Boolean)
  )
  return (
    strokeIds.size <= 1 &&
    faces.every(
      (face) =>
        isConstrainedDashedProductFace(face) &&
        !isConstrainedDashedDescriptorFace(face) &&
        face.debugMeta?.strokePosition === 'inside' &&
        face.debugMeta?.visualOverlapCollapseStatus === undefined
    )
  )
}

const canCollapseConstrainedDashedVisualOverlapByUnion = (
  faces: ArrangedStrokeFinalFace[]
) => {
  if (faces.length < 2) {
    return false
  }

  const strokeIds = new Set(
    faces.map((face) => face.debugMeta?.strokeId).filter(Boolean)
  )
  return (
    strokeIds.size <= 1 &&
    faces.every(
      (face) =>
        isConstrainedDashedProductFace(face) &&
        face.debugMeta?.strokePosition === 'outside' &&
        face.debugMeta?.visualOverlapCollapseStatus === undefined
    )
  )
}

const canTrustExactArrangementPartition = (
  faces: ArrangedStrokeFinalFace[]
) => {
  if (faces.length === 0) {
    return false
  }

  const networkIds = new Set<string>()
  return faces.every((face) => {
    if (!isExactArrangementFace(face)) {
      return false
    }

    const networkId = face.debugMeta?.networkId
    if (networkId) {
      networkIds.add(networkId)
    }

    return networkIds.size <= 1
  })
}

const isCenterPathSelfIntersectingSingleFaceCollapse = (
  faces: ArrangedStrokeFinalFace[]
) => {
  const [face] = faces
  return (
    faces.length === 1 &&
    Boolean(face && isSolidCenterProductFace(face)) &&
    Boolean(face && isSelfIntersectingProductFace(face))
  )
}

const shouldMergeOutsideJoinOwnedTerminalBodyByUnion = (
  faces: ArrangedStrokeFinalFace[]
) =>
  faces.length >= 2 &&
  faces.every(isOutsideJoinOwnedTerminalBodyConstrainedDashedFace)

const getVisualOverlapPolygonKey = (polygon: Vec2[]) =>
  polygon
    .map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`)
    .join('|')

const mergeOutsideJoinOwnedTerminalBodyFaceGroup = (
  faces: ArrangedStrokeFinalFace[]
): ArrangedStrokeFinalFace[] => {
  const [primaryFace] = faces
  if (!primaryFace) {
    return []
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals,
    dashProductIntervals,
    joinOwnershipRecords,
    dashEndpointCapPolicySignatures,
    joinOwnershipSignatures,
    smoothContinuityGroupIds
  } = collectMergedFaceMetadata(faces)
  const polygonKeys = new Set<string>()
  const polygons = cleanVisualOverlapPolygons(
    faces.flatMap((face) =>
      face.polygons.filter((polygon) => {
        const key = getVisualOverlapPolygonKey(polygon)
        if (polygonKeys.has(key)) {
          return false
        }
        polygonKeys.add(key)
        return true
      })
    )
  )
  if (polygons.length === 0) {
    return faces
  }

  const faceId = hashStableString(
    'outside-terminal-body-visual-overlap-face',
    `${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return [
    {
      ...primaryFace,
      faceId,
      sourceGeometryIds,
      polygons,
      bounds: getBounds(polygons),
      renderDescriptor: undefined,
      ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      debugMeta: {
        ...primaryFace.debugMeta,
        ownerSet,
        intervalIds,
        sourceSpanIds,
        sourceNetworkIds,
        sourceContourIds,
        legalDomainIds,
        domainPlanSplitRangeTerminals:
          domainPlanSplitRangeTerminals.length > 0
            ? domainPlanSplitRangeTerminals
            : undefined,
        dashProductIntervals:
          dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
        joinOwnershipRecords:
          joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
        dashEndpointCapPolicySignatures:
          dashEndpointCapPolicySignatures.length > 0
            ? dashEndpointCapPolicySignatures
            : undefined,
        joinOwnershipSignatures:
          joinOwnershipSignatures.length > 0
            ? joinOwnershipSignatures
            : undefined,
        smoothContinuityGroupIds:
          smoothContinuityGroupIds.length > 0
            ? smoothContinuityGroupIds
            : undefined,
        visualOverlapCollapseStatus: 'exact-union',
        visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
        visualOverlapSourceGeometryIds: sourceGeometryIds
      }
    }
  ]
}

const mergeVisualOverlapFaceGroup = (
  faces: ArrangedStrokeFinalFace[],
  unionRegions: PolygonRegion[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error('Cannot collapse visual overlap for an empty face group')
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals,
    dashProductIntervals,
    joinOwnershipRecords,
    dashEndpointCapPolicySignatures,
    joinOwnershipSignatures,
    smoothContinuityGroupIds
  } = collectMergedFaceMetadata(faces)
  const polygons = cleanVisualOverlapPolygons(
    unionRegions.flatMap(getRegionCoveragePolygons)
  )
  const faceId = hashStableString(
    'visual-overlap-face',
    `${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    renderDescriptor: undefined,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds,
    debugMeta: {
      ...primaryFace.debugMeta,
      ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      domainPlanSplitRangeTerminals:
        domainPlanSplitRangeTerminals.length > 0
          ? domainPlanSplitRangeTerminals
          : undefined,
      dashProductIntervals:
        dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
      joinOwnershipRecords:
        joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
      dashEndpointCapPolicySignatures:
        dashEndpointCapPolicySignatures.length > 0
          ? dashEndpointCapPolicySignatures
          : undefined,
      joinOwnershipSignatures:
        joinOwnershipSignatures.length > 0
          ? joinOwnershipSignatures
          : undefined,
      smoothContinuityGroupIds:
        smoothContinuityGroupIds.length > 0
          ? smoothContinuityGroupIds
          : undefined,
      visualOverlapCollapseStatus: 'exact-union',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds
    }
  }
}

const mergeCenterPathVisualOverlapFaceGroup = (
  faces: ArrangedStrokeFinalFace[],
  unionRegions: PolygonRegion[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error(
      'Cannot collapse center path visual overlap for an empty face group'
    )
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals
  } = collectMergedFaceMetadata(faces)
  const polygons = cleanVisualOverlapPolygons(
    unionRegions.flatMap(getRegionCoveragePolygons)
  )
  const faceId = hashStableString(
    'center-product-visual-overlap-face',
    `${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    renderDescriptor: undefined,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    debugMeta: {
      ...primaryFace.debugMeta,
      ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      domainPlanSplitRangeTerminals,
      visualOverlapCollapseStatus: 'exact-union',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds
    }
  }
}

const mergeVisualOverlapArrangementFaceGroup = (
  arrangementFace: ArrangementFace,
  faces: ArrangedStrokeFinalFace[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error(
      'Cannot collapse visual overlap arrangement face for an empty face group'
    )
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals,
    dashProductIntervals,
    joinOwnershipRecords,
    dashEndpointCapPolicySignatures,
    joinOwnershipSignatures,
    smoothContinuityGroupIds
  } = collectMergedFaceMetadata(faces)
  const polygons = cleanVisualOverlapPolygons(
    getRegionCoveragePolygons(arrangementFace.geometry)
  )
  const faceId = hashStableString(
    'visual-overlap-arranged-face',
    `${arrangementFace.faceId}|${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    renderDescriptor: undefined,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    debugMeta: {
      ...primaryFace.debugMeta,
      ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      domainPlanSplitRangeTerminals,
      dashProductIntervals:
        dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
      joinOwnershipRecords:
        joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
      dashEndpointCapPolicySignatures:
        dashEndpointCapPolicySignatures.length > 0
          ? dashEndpointCapPolicySignatures
          : undefined,
      joinOwnershipSignatures:
        joinOwnershipSignatures.length > 0
          ? joinOwnershipSignatures
          : undefined,
      smoothContinuityGroupIds:
        smoothContinuityGroupIds.length > 0
          ? smoothContinuityGroupIds
          : undefined,
      visualOverlapCollapseStatus: 'exact-arrangement',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds,
      arrangementStatus: 'exact',
      arrangementFaceId: arrangementFace.faceId,
      arrangementCandidateIds: arrangementFace.claimedBy.map(
        (candidate) => candidate.candidateId
      )
    }
  }
}

const mergeDomainPlanVisualOverlapArrangementFaceGroup = (
  arrangementFace: ArrangementFace,
  faces: ArrangedStrokeFinalFace[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error(
      'Cannot collapse domain-plan visual overlap arrangement face for an empty face group'
    )
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    domainPlanSplitRangeTerminals,
    dashProductIntervals,
    joinOwnershipRecords,
    dashEndpointCapPolicySignatures,
    joinOwnershipSignatures,
    smoothContinuityGroupIds
  } = collectMergedFaceMetadata(faces)
  const polygons = cleanVisualOverlapPolygons(
    getRegionCoveragePolygons(arrangementFace.geometry)
  )
  const faceId = hashStableString(
    'domain-plan-visual-overlap-arranged-face',
    `${arrangementFace.faceId}|${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    renderDescriptor: undefined,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds,
    sourceContourIds,
    legalDomainIds,
    debugMeta: {
      ...primaryFace.debugMeta,
      ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      domainPlanSplitRangeTerminals,
      dashProductIntervals:
        dashProductIntervals.length > 0 ? dashProductIntervals : undefined,
      joinOwnershipRecords:
        joinOwnershipRecords.length > 0 ? joinOwnershipRecords : undefined,
      dashEndpointCapPolicySignatures:
        dashEndpointCapPolicySignatures.length > 0
          ? dashEndpointCapPolicySignatures
          : undefined,
      joinOwnershipSignatures:
        joinOwnershipSignatures.length > 0
          ? joinOwnershipSignatures
          : undefined,
      smoothContinuityGroupIds:
        smoothContinuityGroupIds.length > 0
          ? smoothContinuityGroupIds
          : undefined,
      visualOverlapCollapseStatus: 'exact-arrangement',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds,
      arrangementFaceId: arrangementFace.faceId,
      arrangementCandidateIds: arrangementFace.claimedBy.map(
        (candidate) => candidate.candidateId
      )
    }
  }
}

const collapseConstrainedDashedLegalDomainVisualOverlapFaceGroupByUnion = (
  faces: ArrangedStrokeFinalFace[],
  options: Pick<
    StrokeVisualOverlapCollapseOptions,
    'backend' | 'fillRule' | 'legalDomains'
  >
): ArrangedStrokeFinalFace[] => {
  const legalDomains = options.legalDomains ?? []
  const intersection = options.backend.intersection
  if (
    faces.length < 2 ||
    legalDomains.length === 0 ||
    typeof intersection !== 'function'
  ) {
    return []
  }

  const fillRule = getLegalDomainFillRule(legalDomains)
  const legalRegions = measureVectorRenderPhase(
    'visual overlap collapse: legal-domain regions',
    () => getLegalDomainRegions(legalDomains, options.backend, fillRule)
  ).filter(hasRegionGeometry)
  if (legalRegions.length === 0) {
    return []
  }

  const unionRegions = measureVectorRenderPhase(
    'visual overlap collapse: legal union',
    () =>
      options.backend
        .union(getVisualCollapseRegions(faces), options.fillRule ?? 'nonzero')
        .filter(hasRegionGeometry)
  )
  if (unionRegions.length === 0) {
    return []
  }

  const clippedRegions = measureVectorRenderPhase(
    'visual overlap collapse: legal intersection',
    () =>
      intersection(unionRegions, legalRegions, fillRule).filter(
        hasRegionGeometry
      )
  )
  if (clippedRegions.length === 0) {
    return []
  }

  const mergedFace = mergeVisualOverlapFaceGroup(faces, clippedRegions)
  const mergedDebugMeta = mergedFace.debugMeta
  const mergedJoinOwnershipSignatures = [
    mergedDebugMeta?.joinOwnershipSignature,
    ...(mergedDebugMeta?.joinOwnershipSignatures ?? []),
    ...(mergedDebugMeta?.dashProductIntervals ?? []).map(
      (interval) => interval.joinOwnershipSignature
    )
  ].filter((signature): signature is string => Boolean(signature))
  const hasJoinOwnedTerminalBody =
    mergedJoinOwnershipSignatures.includes('join-owned-terminal-body') ||
    faces.some(
      (face) =>
        face.debugMeta?.productSignature?.includes(
          ':join-owned-terminal-body:'
        ) === true
    )

  return [
    hasJoinOwnedTerminalBody && mergedDebugMeta?.strokePosition === 'inside'
      ? {
          ...mergedFace,
          debugMeta: {
            ...mergedDebugMeta,
            productSignature: [
              'constrained-dashed',
              'inside',
              'legal-domain-union',
              'join-owned-terminal-body',
              hashStableString(
                'legal-union-intervals',
                mergedFace.intervalIds.join('|')
              )
            ].join(':')
          }
        }
      : mergedFace
  ]
}

const collapseVisualOverlapFaceGroupByArrangement = (
  faces: ArrangedStrokeFinalFace[],
  backend: Pick<GeometryBackend, 'buildArrangement'>
): ArrangedStrokeFinalFace[] => {
  const normalizedFaces = faces.map((face) => ({
    ...face,
    polygons: normalizeCoverageRegionWinding(face).polygons
  }))
  const candidates = buildStrokeArrangementCandidates(normalizedFaces)
  const faceByCandidateId = new Map(
    normalizedFaces.map((face) => [face.faceId, face])
  )
  const arrangementFaces = measureVectorRenderPhase(
    'visual overlap collapse: arrangement',
    () =>
      backend
        .buildArrangement(candidates)
        .filter((face) => hasRegionGeometry(face.geometry))
  )

  const claimedFaceIds = new Set<string>()
  const collapsedFaces = arrangementFaces.flatMap((arrangementFace) => {
    const claimedFaces: ArrangedStrokeFinalFace[] = []
    arrangementFace.claimedBy.forEach((candidate) => {
      const sourceFace = faceByCandidateId.get(candidate.candidateId)
      if (sourceFace) {
        claimedFaces.push(sourceFace)
        claimedFaceIds.add(sourceFace.faceId)
      }
    })

    if (claimedFaces.length === 0) {
      return []
    }

    return mergeVisualOverlapArrangementFaceGroup(arrangementFace, claimedFaces)
  })

  const unclaimedFaces = normalizedFaces.filter(
    (face) => !claimedFaceIds.has(face.faceId)
  )

  return collapseExactDuplicateFinalFaces([
    ...collapsedFaces,
    ...unclaimedFaces
  ])
}

const collapseDomainPlanVisualOverlapFaceGroupByArrangement = (
  faces: ArrangedStrokeFinalFace[],
  options: Pick<StrokeVisualOverlapCollapseOptions, 'backend' | 'legalDomains'>
): ArrangedStrokeFinalFace[] => {
  const normalizedFaces = faces.map((face) => ({
    ...face,
    polygons: normalizeCoverageRegionWinding(face).polygons
  }))
  const candidates = buildStrokeArrangementCandidates(normalizedFaces)
  const faceByCandidateId = new Map(
    normalizedFaces.map((face) => [face.faceId, face])
  )
  const claimedFaceIds = new Set<string>()
  const arrangementFaces = measureVectorRenderPhase(
    'visual overlap collapse: arrangement',
    () => {
      const rawFaces = options.backend.buildArrangement?.(candidates) ?? []
      return options.legalDomains &&
        canClipLegalDomains(options.backend) &&
        options.legalDomains.length > 0
        ? clipArrangementFacesByLegalDomain(
            rawFaces,
            options.legalDomains,
            options.backend
          )
        : rawFaces
    }
  )
  const collapsedFaces = measureVectorRenderPhase(
    'visual overlap collapse: domain-plan merge',
    () =>
      arrangementFaces.filter(
        (face) =>
          hasRegionGeometry(face.geometry) &&
          face.claimedBy.some((candidate) =>
            isLegalForPosition(candidate.strokePosition, face.legalState)
          )
      )
  ).flatMap((arrangementFace) => {
    const claimedFaces: ArrangedStrokeFinalFace[] = []
    arrangementFace.claimedBy.forEach((candidate) => {
      if (
        !isLegalForPosition(
          candidate.strokePosition,
          arrangementFace.legalState
        )
      ) {
        return
      }
      const sourceFace = faceByCandidateId.get(candidate.candidateId)
      if (sourceFace) {
        claimedFaces.push(sourceFace)
        claimedFaceIds.add(sourceFace.faceId)
      }
    })

    if (claimedFaces.length === 0) {
      return []
    }

    return mergeDomainPlanVisualOverlapArrangementFaceGroup(
      arrangementFace,
      claimedFaces
    )
  })

  const unclaimedFaces = normalizedFaces.filter(
    (face) => !claimedFaceIds.has(face.faceId)
  )

  return collapseExactDuplicateFinalFaces([
    ...collapsedFaces,
    ...unclaimedFaces
  ])
}

export const collapseStrokeFinalFaceVisualOverlaps = (
  faces: ArrangedStrokeFinalFace[],
  options: StrokeVisualOverlapCollapseOptions
): ArrangedStrokeFinalFace[] => {
  if (faces.length === 0) {
    return faces
  }

  const canUseUnion = canUseVisualOverlapUnion(options.backend)
  const canUseArrangement = canUseVisualOverlapArrangement(options.backend)
  const groups = groupFinalFacesByVisualPacket(faces)
  const partitionedGroups = groups.map((group) => [group])
  if (partitionedGroups.some((group) => group.length > 1)) {
    emitStrokePipelineCounter(
      'visual-overlap-collapse-bounds-partitioned',
      partitionedGroups.reduce((total, group) => total + group.length, 0)
    )
    return groups.flatMap((group, index) => {
      const partitions = partitionedGroups[index] ?? [group]
      return partitions.length > 1
        ? partitions.flatMap((partition) =>
            collapseStrokeFinalFaceVisualOverlaps(partition, options)
          )
        : collapseStrokeFinalFaceVisualOverlaps(group, options)
    })
  }
  const hasCollapsibleGroup = groups.some((group) => {
    if (!canUseUnion && !canUseArrangement) {
      return false
    }

    if (hasDashedCenterFace(group)) {
      return false
    }

    if (hasConstrainedDashedFace(group)) {
      return false
    }

    if (hasGradientPaintFace(group)) {
      return false
    }

    if (hasSelfIntersectingConstrainedSolidMaskModelFace(group)) {
      return false
    }

    const shouldUseUnionOnlyCollapse =
      canCollapseDomainPlanConstrainedSolidVisualOverlapByUnion(group)
    const shouldUseConstrainedDashedUnionCollapse =
      canCollapseConstrainedDashedVisualOverlapByUnion(group)
    const shouldUseConstrainedDashedLegalDomainCollapse =
      canCollapseConstrainedDashedVisualOverlapByLegalDomain(group, {
        hasLegalDomains: (options.legalDomains?.length ?? 0) > 0
      })
    const shouldUseLegalDomainArrangementCollapse =
      shouldUseUnionOnlyCollapse ||
      shouldUseConstrainedDashedLegalDomainCollapse
    if (
      shouldUseConstrainedDashedLegalDomainCollapse &&
      (!canUseArrangement || !options.backend.buildArrangement)
    ) {
      return false
    }
    if (shouldUseUnionOnlyCollapse && !canUseUnion && !canUseArrangement) {
      return false
    }
    if (
      !shouldUseLegalDomainArrangementCollapse &&
      !shouldUseConstrainedDashedUnionCollapse &&
      !canCollapseVisualOverlapExactly(group)
    ) {
      return false
    }

    return (
      (!canTrustExactArrangementPartition(group) ||
        shouldUseConstrainedDashedLegalDomainCollapse ||
        shouldUseConstrainedDashedUnionCollapse) &&
      shouldAttemptVisualOverlapCollapse(group, options)
    )
  })
  if (!hasCollapsibleGroup) {
    emitStrokePipelineCounter('visual-overlap-collapse-not-needed')
    return faces
  }

  const cacheKey = measureVectorRenderPhase(
    'visual overlap collapse: cache key',
    () => buildVisualOverlapCollapseCacheKey(faces, options)
  )
  const cache = getBackendCacheGroup(
    visualOverlapCollapseResultCache,
    options.backend as object
  )
  const cachedFaces = cache.get(cacheKey)
  if (cachedFaces) {
    emitStrokePipelineCounter('visual-overlap-collapse-cache-hit')
    return cachedFaces
  }
  emitStrokePipelineCounter('visual-overlap-collapse-cache-miss')

  const collapsedFaces = groups.flatMap((group) => {
    if (hasDashedCenterFace(group)) {
      return group
    }

    if (hasConstrainedDashedFace(group)) {
      return group
    }

    if (hasGradientPaintFace(group)) {
      return group
    }

    if (hasSelfIntersectingConstrainedSolidMaskModelFace(group)) {
      return group
    }

    const shouldUseUnionOnlyCollapse =
      canCollapseDomainPlanConstrainedSolidVisualOverlapByUnion(group)
    const shouldUseConstrainedDashedUnionCollapse =
      canCollapseConstrainedDashedVisualOverlapByUnion(group)
    const shouldUseConstrainedDashedLegalDomainCollapse =
      canCollapseConstrainedDashedVisualOverlapByLegalDomain(group, {
        hasLegalDomains: (options.legalDomains?.length ?? 0) > 0
      })
    const shouldUseLegalDomainArrangementCollapse =
      shouldUseUnionOnlyCollapse ||
      shouldUseConstrainedDashedLegalDomainCollapse
    if (
      shouldUseConstrainedDashedLegalDomainCollapse &&
      (!canUseArrangement || !options.backend.buildArrangement)
    ) {
      return group
    }
    if (shouldUseUnionOnlyCollapse && !canUseUnion && !canUseArrangement) {
      return group
    }
    if (
      !shouldUseLegalDomainArrangementCollapse &&
      !shouldUseConstrainedDashedUnionCollapse &&
      !canCollapseVisualOverlapExactly(group)
    ) {
      return group
    }

    if (
      canTrustExactArrangementPartition(group) &&
      !shouldUseConstrainedDashedLegalDomainCollapse &&
      !shouldUseConstrainedDashedUnionCollapse
    ) {
      return group
    }

    if (!shouldAttemptVisualOverlapCollapse(group, options)) {
      return group
    }

    const boundsConnectedGroups = partitionFinalFacesByBoundsConnectivity(group)
    if (boundsConnectedGroups.length > 1) {
      emitStrokePipelineCounter(
        'visual-overlap-collapse-bounds-partitioned',
        boundsConnectedGroups.length
      )
      return boundsConnectedGroups.flatMap((connectedGroup) =>
        collapseStrokeFinalFaceVisualOverlaps(connectedGroup, options)
      )
    }

    if (isCenterPathSelfIntersectingSingleFaceCollapse(group)) {
      if (!canUseUnion) {
        return group
      }

      const unionRegions = measureVectorRenderPhase(
        'visual overlap collapse: union',
        () =>
          options.backend
            .union(
              getVisualCollapseRegions(group),
              options.fillRule ?? 'nonzero'
            )
            .filter(hasRegionGeometry)
      )

      if (unionRegions.length === 0) {
        return group
      }

      return [mergeCenterPathVisualOverlapFaceGroup(group, unionRegions)]
    }

    if (shouldMergeOutsideJoinOwnedTerminalBodyByUnion(group)) {
      return mergeOutsideJoinOwnedTerminalBodyFaceGroup(group)
    }

    if (shouldUseConstrainedDashedLegalDomainCollapse && canUseUnion) {
      const clippedUnionCollapse =
        collapseConstrainedDashedLegalDomainVisualOverlapFaceGroupByUnion(
          group,
          options
        )
      if (clippedUnionCollapse.length > 0) {
        return clippedUnionCollapse
      }
    }

    const buildArrangement = options.backend.buildArrangement
    if (
      shouldUseLegalDomainArrangementCollapse &&
      canUseArrangement &&
      buildArrangement
    ) {
      const domainPlanArrangedCollapse =
        collapseDomainPlanVisualOverlapFaceGroupByArrangement(group, {
          backend: { ...options.backend, buildArrangement },
          legalDomains: options.legalDomains
        })
      if (domainPlanArrangedCollapse.length > 0) {
        return domainPlanArrangedCollapse
      }
    }

    if (
      !shouldUseUnionOnlyCollapse &&
      !shouldUseConstrainedDashedUnionCollapse &&
      group.length >= 2 &&
      canUseArrangement &&
      buildArrangement
    ) {
      const arrangedCollapse = collapseVisualOverlapFaceGroupByArrangement(
        group,
        { buildArrangement }
      )
      if (
        arrangedCollapse.length > 0 &&
        !shouldAttemptVisualOverlapCollapse(arrangedCollapse, options)
      ) {
        return arrangedCollapse
      }
    }

    if (!canUseUnion) {
      return group
    }

    const unionRegions = measureVectorRenderPhase(
      'visual overlap collapse: union',
      () =>
        options.backend
          .union(getVisualCollapseRegions(group), options.fillRule ?? 'nonzero')
          .filter(hasRegionGeometry)
    )

    if (unionRegions.length === 0) {
      return group
    }

    return [mergeVisualOverlapFaceGroup(group, unionRegions)]
  })

  setBoundedCacheEntry(
    cache,
    cacheKey,
    collapsedFaces,
    MAX_VISUAL_OVERLAP_COLLAPSE_CACHE_ENTRIES
  )

  return collapsedFaces
}

export type StrokeLegalityRoute =
  | 'center-bypass'
  | 'inside-fill-clip'
  | 'outside-exterior-clip'
  | 'missing-legal-domain'

export type StrokeProductOwnerStepId =
  | 'build-center-stroke-products'
  | 'build-constrained-solid-products'
  | 'build-dash-interval-body-products'
  | 'build-source-vertex-join-products'
  | 'build-terminal-body-products'
  | 'build-smooth-continuity-products'
  | 'select-stroke-descriptor-strategy'

export interface StrokeLegalityProductPacket {
  productId: string
  productMode: string
  ownerStepId: StrokeProductOwnerStepId
  ownerStage: string
  polygons: Vec2[][]
  productEvidenceEnvelope?: ConstrainedDashedProductEvidenceEnvelope
}

export interface StrokeLegalityDiagnostic {
  severity: 'warning' | 'error'
  reason: string
}

export interface ApplyStrokeProductLegalityInput {
  productPackets: StrokeLegalityProductPacket[]
  legalityRoute: StrokeLegalityRoute
  legalDomainIds: string[]
  contourIds: string[]
  productResults?: StrokePerProductLegalityResult[]
}

type StrokeLegalityEvidenceChannelName =
  | 'clipPolygons'
  | 'fillClipPolygons'
  | 'fillExcludePolygons'
  | 'descriptorEvidencePolygons'

type StrokeLegalityEvidenceChannels = Partial<
  Record<StrokeLegalityEvidenceChannelName, Vec2[][]>
>

export interface StrokePerProductLegalityResult {
  sourceProductId: string
  visiblePolygons: Vec2[][]
  deleteReason?: string
  evidenceChannels?: StrokeLegalityEvidenceChannels
}

export interface StrokeLegalityAppliedProduct {
  productId: string
  sourceProductId: string
  productMode: 'post-legality-product'
  sourceProductMode: string
  ownerStepId: 'apply-legality'
  ownerStage: 'Stroke Geometry legality clipping'
  sourceOwnerStepId: StrokeProductOwnerStepId
  sourceOwnerStage: string
  legalityRoute: StrokeLegalityRoute
  legalDomainIds: string[]
  contourIds: string[]
  visiblePolygons: Vec2[][]
  evidenceChannels: StrokeLegalityEvidenceChannels
  channelSeparation: {
    visible: 'legality-clipped-product-polygons'
    evidence: string[]
  }
  diagnostics: StrokeLegalityDiagnostic[]
  productEvidenceEnvelope?: ConstrainedDashedProductEvidenceEnvelope
}

export interface StrokeLegalityDeleteRecord {
  sourceProductId: string
  sourceOwnerStepId: StrokeProductOwnerStepId
  ownerStepId: 'apply-legality'
  ownerStage: 'Stroke Geometry legality clipping'
  legalityRoute: StrokeLegalityRoute
  legalDomainIds: string[]
  deleteReason: string
  bodyProductIds?: readonly string[]
  affectedOverlayIds?: readonly string[]
}

export interface ApplyStrokeProductLegalityOutput {
  products: StrokeLegalityAppliedProduct[]
  deletions: StrokeLegalityDeleteRecord[]
}

const getStrokeLegalityDiagnostics = (
  route: StrokeLegalityRoute
): StrokeLegalityDiagnostic[] =>
  route === 'missing-legal-domain'
    ? [
        {
          severity: 'warning',
          reason: 'missing-legal-domain'
        }
      ]
    : []

const shouldPreserveProductWithoutResult = (route: StrokeLegalityRoute) =>
  route === 'center-bypass' || route === 'missing-legal-domain'

const getPerProductLegalityResult = (
  input: ApplyStrokeProductLegalityInput,
  sourceProductId: string
) => {
  const matches = (input.productResults ?? []).filter(
    (result) => result.sourceProductId === sourceProductId
  )
  return matches.length === 1 ? matches[0] : null
}

export const applyStrokeProductLegality = (
  input: ApplyStrokeProductLegalityInput
): ApplyStrokeProductLegalityOutput => {
  const products: StrokeLegalityAppliedProduct[] = []
  const deletions: StrokeLegalityDeleteRecord[] = []

  input.productPackets.forEach((packet) => {
    const productResult = getPerProductLegalityResult(input, packet.productId)
    const preserveWithoutResult = shouldPreserveProductWithoutResult(
      input.legalityRoute
    )
    const visiblePolygons = preserveWithoutResult
      ? (productResult?.visiblePolygons ?? packet.polygons)
      : (productResult?.visiblePolygons ?? [])
    const deleteReason =
      productResult?.deleteReason ??
      (visiblePolygons.length === 0
        ? productResult
          ? 'empty-after-legal-clip'
          : 'missing-per-product-legality-result'
        : null)

    if (deleteReason) {
      const productEvidenceEnvelope = packet.productEvidenceEnvelope
      deletions.push({
        sourceProductId: packet.productId,
        sourceOwnerStepId: packet.ownerStepId,
        ownerStepId: 'apply-legality',
        ownerStage: 'Stroke Geometry legality clipping',
        legalityRoute: input.legalityRoute,
        legalDomainIds: input.legalDomainIds,
        deleteReason,
        ...(productEvidenceEnvelope
          ? {
              bodyProductIds: productEvidenceEnvelope.bodyProductIds,
              affectedOverlayIds: [
                ...productEvidenceEnvelope.terminalOwnershipOverlays.map(
                  (overlay) => overlay.overlayId
                ),
                ...productEvidenceEnvelope.smoothContinuityOwnershipOverlays.map(
                  (overlay) => overlay.overlayId
                )
              ]
            }
          : {})
      })
      return
    }

    const evidenceChannels = productResult?.evidenceChannels ?? {}
    products.push({
      productId: `${packet.productId}:post-legality`,
      sourceProductId: packet.productId,
      productMode: 'post-legality-product',
      sourceProductMode: packet.productMode,
      ownerStepId: 'apply-legality',
      ownerStage: 'Stroke Geometry legality clipping',
      sourceOwnerStepId: packet.ownerStepId,
      sourceOwnerStage: packet.ownerStage,
      legalityRoute: input.legalityRoute,
      legalDomainIds: input.legalDomainIds,
      contourIds: input.contourIds,
      visiblePolygons,
      evidenceChannels,
      channelSeparation: {
        visible: 'legality-clipped-product-polygons',
        evidence: Object.keys(evidenceChannels)
      },
      diagnostics: getStrokeLegalityDiagnostics(input.legalityRoute),
      ...(packet.productEvidenceEnvelope
        ? { productEvidenceEnvelope: packet.productEvidenceEnvelope }
        : {})
    })
  })

  return { products, deletions }
}
