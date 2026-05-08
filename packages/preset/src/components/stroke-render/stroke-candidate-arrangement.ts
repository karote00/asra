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
    Partial<Pick<GeometryBackend, 'buildArrangement'>>
  fillRule?: FillRule
}

const MAX_ARRANGEMENT_CACHE_ENTRIES = 64
const MAX_VISUAL_OVERLAP_COLLAPSE_CACHE_ENTRIES = 64

const arrangementResultCache = new WeakMap<
  object,
  Map<string, ArrangedStrokeFinalFace[]>
>()
const visualOverlapCollapseResultCache = new WeakMap<
  object,
  Map<string, ArrangedStrokeFinalFace[]>
>()

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

const getRegionCoveragePolygons = (region: PolygonRegion) =>
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

const shouldAttemptVisualOverlapCollapse = (
  faces: ArrangedStrokeFinalFace[]
) =>
  faces.length >= 2
    ? hasAnyBoundsOverlap(faces)
    : Boolean(faces[0] && hasOverlappingPolygonsInFace(faces[0]))

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

const pushUniqueOwner = (owners: StrokeOwnerKey[], owner: StrokeOwnerKey) => {
  const signature = stableStringify(owner)
  if (!owners.some((candidate) => stableStringify(candidate) === signature)) {
    owners.push(owner)
  }
}

const collectMergedFaceMetadata = (faces: ArrangedStrokeFinalFace[]) => {
  const sourceGeometryIds: string[] = []
  const ownerSet: StrokeOwnerKey[] = []
  const intervalIds: string[] = []
  const sourceSpanIds: string[] = []
  const sourceContourIds: string[] = []
  const legalDomainIds: string[] = []

  faces.forEach((face) => {
    face.sourceGeometryIds.forEach((id) => pushUnique(sourceGeometryIds, id))
    face.ownerSet.forEach((owner) => pushUniqueOwner(ownerSet, owner))
    face.intervalIds.forEach((id) => pushUnique(intervalIds, id))
    face.sourceSpanIds.forEach((id) => pushUnique(sourceSpanIds, id))
    face.sourceContourIds.forEach((id) => pushUnique(sourceContourIds, id))
    face.legalDomainIds.forEach((id) => pushUnique(legalDomainIds, id))
  })

  return {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds
  }
}

const getCandidatePosition = (
  face: ArrangedStrokeFinalFace,
  fallback?: StrokeArrangementPosition
): StrokeArrangementPosition => {
  const position = face.debugMeta?.strokePosition ?? fallback
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

  candidates.forEach((candidate) => {
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
  })

  return [...groups.values()]
}

const canClipLegalDomains = (
  backend: StrokeCandidateArrangementOptions['backend']
): backend is Pick<
  GeometryBackend,
  'buildArrangement' | 'difference' | 'intersection' | 'union'
> =>
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

const serializeFinalFaceForCache = (face: ArrangedStrokeFinalFace) => ({
  faceId: face.faceId,
  sourceGeometryIds: face.sourceGeometryIds,
  polygons: serializeRegion({ polygons: face.polygons }),
  visualPacketKey: face.visualPacketKey,
  paintKey: face.paintKey,
  strokeSpecKey: face.strokeSpecKey,
  ownerSet: face.ownerSet,
  intervalIds: face.intervalIds,
  sourceSpanIds: face.sourceSpanIds,
  sourceContourIds: face.sourceContourIds,
  legalDomainIds: face.legalDomainIds,
  geometryFamily: face.geometryFamily,
  resolutionStatus: face.resolutionStatus,
  runtimeStatus: face.runtimeStatus,
  sourceTopology: face.sourceTopology,
  paint: face.paint,
  debugMeta: face.debugMeta
})

const buildVisualOverlapCollapseCacheKey = (
  faces: ArrangedStrokeFinalFace[],
  options: StrokeVisualOverlapCollapseOptions
) =>
  hashStableString(
    'visual-overlap-collapse-cache',
    stableStringify({
      backend: getBackendSignature(options.backend as object),
      fillRule: options.fillRule ?? 'nonzero',
      faces: faces.map(serializeFinalFaceForCache)
    })
  )

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
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds
  } = collectMergedFaceMetadata(group.faces)

  const candidateIds = group.candidates.map(
    (candidate) => candidate.candidateId
  )
  const polygons = arrangementFace.geometry.polygons
  const faceId = hashStableString(
    'arranged-face',
    `${arrangementFace.faceId}|${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
    visualPacketKey: primaryFace.visualPacketKey,
    paintKey: primaryFace.paintKey,
    strokeSpecKey: primaryFace.strokeSpecKey,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds,
    geometryFamily: primaryFace.geometryFamily,
    resolutionStatus: 'exact-constrained',
    runtimeStatus: 'accepted',
    sourceTopology: primaryFace.sourceTopology,
    debugMeta: {
      ...primaryFace.debugMeta,
      arrangementStatus: 'exact',
      arrangementFaceId: arrangementFace.faceId,
      arrangementCandidateIds: candidateIds,
      arrangementLegalState: arrangementFace.legalState,
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted'
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
    const groupKey =
      face.geometryFamily === 'dashed-center'
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

const isLocalSideConstrainedSolidFace = (face: ArrangedStrokeFinalFace) =>
  face.geometryFamily === 'constrained-solid' &&
  face.resolutionStatus !== 'exact-constrained'

const hasDashedCenterFace = (faces: ArrangedStrokeFinalFace[]) =>
  faces.some((face) => face.geometryFamily === 'dashed-center')

const isSelfIntersectingConstrainedSolidFace = (
  face: ArrangedStrokeFinalFace
) =>
  face.geometryFamily === 'constrained-solid' &&
  face.sourceTopology === 'self-intersecting'

const canCollapseVisualOverlapExactly = (faces: ArrangedStrokeFinalFace[]) =>
  faces.every(
    (face) =>
      !isLocalSideConstrainedSolidFace(face) &&
      !(
        isSelfIntersectingConstrainedSolidFace(face) &&
        face.debugMeta?.arrangementStatus !== 'exact' &&
        face.resolutionStatus !== 'exact-constrained'
      )
  )

const canCollapseLocalSideConstrainedSolidVisualOverlapByUnion = (
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
        isLocalSideConstrainedSolidFace(face) &&
        isSelfIntersectingConstrainedSolidFace(face) &&
        face.debugMeta?.visualOverlapCollapseStatus !== 'local-side-arrangement'
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
    if (
      face.resolutionStatus !== 'exact-constrained' ||
      face.debugMeta?.arrangementStatus !== 'exact'
    ) {
      return false
    }

    const networkId = face.debugMeta.networkId
    if (networkId) {
      networkIds.add(networkId)
    }

    return networkIds.size <= 1
  })
}

const isNativeCenterSelfIntersectingSingleFaceCollapse = (
  faces: ArrangedStrokeFinalFace[]
) => {
  const [face] = faces
  return (
    faces.length === 1 &&
    face?.geometryFamily === 'solid-center' &&
    face.resolutionStatus === 'native-center' &&
    face.sourceTopology === 'self-intersecting'
  )
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
    sourceContourIds,
    legalDomainIds
  } = collectMergedFaceMetadata(faces)
  const polygons = unionRegions.flatMap(getRegionCoveragePolygons)
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
      sourceContourIds,
      legalDomainIds,
      visualOverlapCollapseStatus: 'exact-union',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds
    }
  }
}

const mergeNativeCenterVisualOverlapFaceGroup = (
  faces: ArrangedStrokeFinalFace[],
  unionRegions: PolygonRegion[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error(
      'Cannot collapse native center visual overlap for an empty face group'
    )
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds
  } = collectMergedFaceMetadata(faces)
  const polygons = unionRegions.flatMap(getRegionCoveragePolygons)
  const faceId = hashStableString(
    'native-center-visual-overlap-face',
    `${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
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
      sourceContourIds,
      legalDomainIds,
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
    sourceContourIds,
    legalDomainIds
  } = collectMergedFaceMetadata(faces)
  const polygons = arrangementFace.geometry.polygons
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
      sourceContourIds,
      legalDomainIds,
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

const mergeLocalSideVisualOverlapArrangementFaceGroup = (
  arrangementFace: ArrangementFace,
  faces: ArrangedStrokeFinalFace[]
): ArrangedStrokeFinalFace => {
  const [primaryFace] = faces
  if (!primaryFace) {
    throw new Error(
      'Cannot collapse local-side visual overlap arrangement face for an empty face group'
    )
  }

  const {
    sourceGeometryIds,
    ownerSet,
    intervalIds,
    sourceSpanIds,
    sourceContourIds,
    legalDomainIds
  } = collectMergedFaceMetadata(faces)
  const polygons = arrangementFace.geometry.polygons
  const faceId = hashStableString(
    'local-side-visual-overlap-arranged-face',
    `${arrangementFace.faceId}|${primaryFace.visualPacketKey}|${sourceGeometryIds.join('|')}`
  )

  return {
    ...primaryFace,
    faceId,
    sourceGeometryIds,
    polygons,
    bounds: getBounds(polygons),
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
      sourceContourIds,
      legalDomainIds,
      visualOverlapCollapseStatus: 'local-side-arrangement',
      visualOverlapSourceFaceIds: faces.map((face) => face.faceId),
      visualOverlapSourceGeometryIds: sourceGeometryIds,
      arrangementFaceId: arrangementFace.faceId,
      arrangementCandidateIds: arrangementFace.claimedBy.map(
        (candidate) => candidate.candidateId
      )
    }
  }
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
  const arrangementFaces = backend
    .buildArrangement(candidates)
    .filter((face) => hasRegionGeometry(face.geometry))

  const collapsedFaces = arrangementFaces.flatMap((arrangementFace) => {
    const claimedFaces: ArrangedStrokeFinalFace[] = []
    arrangementFace.claimedBy.forEach((candidate) => {
      const sourceFace = faceByCandidateId.get(candidate.candidateId)
      if (sourceFace) {
        claimedFaces.push(sourceFace)
      }
    })

    if (claimedFaces.length === 0) {
      return []
    }

    return mergeVisualOverlapArrangementFaceGroup(arrangementFace, claimedFaces)
  })

  return collapseExactDuplicateFinalFaces(collapsedFaces)
}

const collapseLocalSideVisualOverlapFaceGroupByArrangement = (
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
  return backend
    .buildArrangement(candidates)
    .filter((face) => hasRegionGeometry(face.geometry))
    .flatMap((arrangementFace) => {
      const claimedFaces: ArrangedStrokeFinalFace[] = []
      arrangementFace.claimedBy.forEach((candidate) => {
        const sourceFace = faceByCandidateId.get(candidate.candidateId)
        if (sourceFace) {
          claimedFaces.push(sourceFace)
        }
      })

      if (claimedFaces.length === 0) {
        return []
      }

      return mergeLocalSideVisualOverlapArrangementFaceGroup(
        arrangementFace,
        claimedFaces
      )
    })
}

export const collapseStrokeFinalFaceVisualOverlaps = (
  faces: ArrangedStrokeFinalFace[],
  options: StrokeVisualOverlapCollapseOptions
): ArrangedStrokeFinalFace[] => {
  if (faces.length === 0) {
    return faces
  }

  const groups = groupFinalFacesByVisualPacket(faces)
  const hasCollapsibleGroup = groups.some((group) => {
    if (hasDashedCenterFace(group)) {
      return false
    }

    const shouldUseUnionOnlyCollapse =
      canCollapseLocalSideConstrainedSolidVisualOverlapByUnion(group)
    if (
      !shouldUseUnionOnlyCollapse &&
      !canCollapseVisualOverlapExactly(group)
    ) {
      return false
    }

    return (
      !canTrustExactArrangementPartition(group) &&
      shouldAttemptVisualOverlapCollapse(group)
    )
  })
  if (!hasCollapsibleGroup) {
    return faces
  }

  const cacheKey = buildVisualOverlapCollapseCacheKey(faces, options)
  const cache = getBackendCacheGroup(
    visualOverlapCollapseResultCache,
    options.backend as object
  )
  const cachedFaces = cache.get(cacheKey)
  if (cachedFaces) {
    return cachedFaces
  }

  const collapsedFaces = groups.flatMap((group) => {
    if (hasDashedCenterFace(group)) {
      return group
    }

    const shouldUseUnionOnlyCollapse =
      canCollapseLocalSideConstrainedSolidVisualOverlapByUnion(group)
    if (
      !shouldUseUnionOnlyCollapse &&
      !canCollapseVisualOverlapExactly(group)
    ) {
      return group
    }

    if (canTrustExactArrangementPartition(group)) {
      return group
    }

    if (!shouldAttemptVisualOverlapCollapse(group)) {
      return group
    }

    if (isNativeCenterSelfIntersectingSingleFaceCollapse(group)) {
      const unionRegions = options.backend
        .union(getVisualCollapseRegions(group), options.fillRule ?? 'nonzero')
        .filter(hasRegionGeometry)

      if (unionRegions.length === 0) {
        return group
      }

      return [mergeNativeCenterVisualOverlapFaceGroup(group, unionRegions)]
    }

    const buildArrangement = options.backend.buildArrangement
    if (shouldUseUnionOnlyCollapse && typeof buildArrangement === 'function') {
      const localSideArrangedCollapse =
        collapseLocalSideVisualOverlapFaceGroupByArrangement(group, {
          buildArrangement
        })
      if (
        localSideArrangedCollapse.length > 0 &&
        !shouldAttemptVisualOverlapCollapse(localSideArrangedCollapse)
      ) {
        return localSideArrangedCollapse
      }
    }

    if (
      !shouldUseUnionOnlyCollapse &&
      group.length >= 2 &&
      typeof buildArrangement === 'function'
    ) {
      const arrangedCollapse = collapseVisualOverlapFaceGroupByArrangement(
        group,
        { buildArrangement }
      )
      if (
        arrangedCollapse.length > 0 &&
        !shouldAttemptVisualOverlapCollapse(arrangedCollapse)
      ) {
        return arrangedCollapse
      }
    }

    const unionRegions = options.backend
      .union(getVisualCollapseRegions(group), options.fillRule ?? 'nonzero')
      .filter(hasRegionGeometry)

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
