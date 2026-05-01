import type {
  ArrangementFace,
  CandidateRegion,
  FillRule,
  GeometryBackend,
  StrokeArrangementPosition
} from './geometry-backend'
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

const pushUniqueOwner = (owners: StrokeOwnerKey[], owner: StrokeOwnerKey) => {
  const signature = stableStringify(owner)
  if (!owners.some((candidate) => stableStringify(candidate) === signature)) {
    owners.push(owner)
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
): backend is Pick<GeometryBackend, 'buildArrangement' | 'difference' | 'intersection' | 'union'> =>
  typeof backend.difference === 'function' &&
  typeof backend.intersection === 'function' &&
  typeof backend.union === 'function'

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

  const sourceGeometryIds: string[] = []
  const ownerSet: StrokeOwnerKey[] = []
  const intervalIds: string[] = []
  const sourceSpanIds: string[] = []
  const sourceContourIds: string[] = []
  const legalDomainIds: string[] = []

  group.faces.forEach((face) => {
    face.sourceGeometryIds.forEach((id) => pushUnique(sourceGeometryIds, id))
    face.ownerSet.forEach((owner) => pushUniqueOwner(ownerSet, owner))
    face.intervalIds.forEach((id) => pushUnique(intervalIds, id))
    face.sourceSpanIds.forEach((id) => pushUnique(sourceSpanIds, id))
    face.sourceContourIds.forEach((id) => pushUnique(sourceContourIds, id))
    face.legalDomainIds.forEach((id) => pushUnique(legalDomainIds, id))
  })

  const candidateIds = group.candidates.map((candidate) => candidate.candidateId)
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

  return collapseExactDuplicateFinalFaces(arrangedFaces)
}
