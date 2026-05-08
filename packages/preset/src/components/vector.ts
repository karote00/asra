import {
  PropertyTypes,
  StrokeJoinTypes,
  createDefaultStroke,
  setElementGeometryLocalBounds
} from '@asyra/utils'
import type { FillAttrs, StrokeAttrs } from '@asyra/utils'
import core, { VECTOR_TOKENS, defineComponent } from '@asyra/core'
import type { RenderStrategy } from '@asyra/core'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import {
  DEFAULT_VECTOR_FILLS,
  applyRenderableFill,
  getRenderableFills
} from './fills'
import { applyCenterDashedOverlapDiagnostics } from './stroke-render/center-dashed-overlap-diagnostics'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import { setConstrainedSolidLegalityDiagnostics } from './stroke-render/constrained-solid-legality-diagnostics'
import {
  buildConstrainedSolidOwnershipCandidateDiagnostics,
  buildConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics,
  setConstrainedSolidOwnershipDiagnostics,
  type ConstrainedSolidOwnershipDiagnostics
} from './stroke-render/constrained-solid-ownership-diagnostics'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  classifyConstrainedDashedRuntimeStatus,
  hasConstrainedDashedStrokeIntent
} from './stroke-render/constrained-dashed-stroke-packets'
import {
  buildArrangedStrokeFinalFacesFromResolvedPackets,
  collapseStrokeFinalFaceVisualOverlaps
} from './stroke-render/stroke-candidate-arrangement'
import { getGeometryBackend } from './stroke-render/geometry-backend'
import type { ArrangementLegalDomain } from './stroke-render/arrangement-face-classifier'
import {
  clearConstrainedDashedRuntimeDiagnostics,
  setConstrainedDashedRuntimeDiagnostics,
  type ConstrainedDashedRuntimeDiagnosticEntry
} from './stroke-render/constrained-dashed-runtime-diagnostics'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from './stroke-render/constrained-solid-stroke-packets'
import {
  clearConstrainedSolidRuntimeDiagnostics,
  setConstrainedSolidRuntimeDiagnostics,
  type ConstrainedSolidRuntimeDiagnosticEntry,
  type ConstrainedSolidRuntimeReason
} from './stroke-render/constrained-solid-runtime-diagnostics'
import {
  buildDashedCenterStrokeResolvedPackets,
  hasDashedCenterStrokeIntent
} from './stroke-render/dashed-center-stroke-packets'
import { buildVectorGeometryModelPath } from './stroke-render/path-geometry'
import {
  buildCompoundLegalDomainNormalization,
  type NormalizedLegalDomain
} from './stroke-render/legal-domain-normalization'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import {
  attachStrokePacketDebugMeta,
  applySolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeFinalFaces,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitAreaFromFinalFaces,
  hasSolidCenterStrokeIntent,
  type SolidCenterStrokeResolvedPacket
} from './stroke-render/solid-center-stroke-packets'
import { toSolidCenterStrokeRenderEntriesFromFinalFaces } from './stroke-render/solid-center-stroke-packets'
import {
  buildPathTopologyModel,
  normalizePathTopologyFillRule,
  type PathTopologyFillRule,
  type PathTopologyModel
} from './stroke-render/path-topology-model'
import { buildSelfIntersectingPolylineLegalDomainRegions } from './stroke-render/self-intersecting-legal-domain'

interface VectorComputedData {
  id: string
  x: number
  y: number
  width: number
  height: number
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  fillRule: PathTopologyFillRule
  fills: FillAttrs[]
  strokes?: StrokeAttrs[]
  strokeDebugOptions: VectorStrokeDebugOptions
}

interface VectorStrokeDebugOptions {
  disableVisualOverlapCollapse?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const toFiniteNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const normalizeVectorPointNodeMap = (
  value: unknown
): Record<string, VectorPointNode> => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, VectorPointNode>>(
    (result, [fallbackId, rawPoint]) => {
      if (!isRecord(rawPoint)) {
        return result
      }

      const id = typeof rawPoint.id === 'string' ? rawPoint.id : fallbackId
      const kind =
        rawPoint.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? VECTOR_TOKENS.POINT.KIND.CONTROL
          : VECTOR_TOKENS.POINT.KIND.ANCHOR
      const x = toFiniteNumber(rawPoint.x, Number.NaN)
      const y = toFiniteNumber(rawPoint.y, Number.NaN)
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return result
      }

      if (kind === VECTOR_TOKENS.POINT.KIND.CONTROL) {
        result[id] = {
          id,
          kind,
          x,
          y,
          controlForId:
            typeof rawPoint.controlForId === 'string'
              ? rawPoint.controlForId
              : '',
          controlRole: rawPoint.controlRole === 'in' ? 'in' : 'out'
        } as VectorPointNode
        return result
      }

      result[id] = {
        id,
        kind,
        x,
        y,
        anchorType: rawPoint.anchorType === 'smooth' ? 'smooth' : 'sharp'
      } as VectorPointNode
      return result
    },
    {}
  )
}

const normalizeVectorSegmentMap = (
  value: unknown
): Record<string, VectorSegment> => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, VectorSegment>>(
    (result, [fallbackId, rawSegment]) => {
      if (!isRecord(rawSegment)) {
        return result
      }

      const startId = rawSegment.startId
      const endId = rawSegment.endId
      if (typeof startId !== 'string' || typeof endId !== 'string') {
        return result
      }

      const id = typeof rawSegment.id === 'string' ? rawSegment.id : fallbackId
      result[id] = {
        id,
        startId,
        endId,
        outControlId:
          typeof rawSegment.outControlId === 'string'
            ? rawSegment.outControlId
            : null,
        inControlId:
          typeof rawSegment.inControlId === 'string'
            ? rawSegment.inControlId
            : null
      }
      return result
    },
    {}
  )
}

const normalizeVectorNetworkMap = (
  value: unknown,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): Record<string, VectorNetwork> => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, VectorNetwork>>(
    (result, [fallbackId, rawNetwork]) => {
      if (!isRecord(rawNetwork)) {
        return result
      }

      const id = typeof rawNetwork.id === 'string' ? rawNetwork.id : fallbackId
      const pointIds = toStringArray(rawNetwork.pointIds).filter(
        (pointId) => points[pointId]?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
      )
      const segmentIds = toStringArray(rawNetwork.segmentIds).filter(
        (segmentId) => {
          const segment = segments[segmentId]
          return (
            !!segment && !!points[segment.startId] && !!points[segment.endId]
          )
        }
      )

      if (pointIds.length === 0 && segmentIds.length === 0) {
        return result
      }

      result[id] = {
        id,
        pointIds,
        segmentIds,
        closed: rawNetwork.closed === true
      }
      return result
    },
    {}
  )
}

const getNetworkAnchorGuardPoints = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>
) =>
  network.pointIds.flatMap((pointId) => {
    const point = points[pointId]
    return point?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
      ? [{ x: point.x, y: point.y, sharp: point.anchorType !== 'smooth' }]
      : []
  })

const normalizeVectorRenderData = (data: unknown): VectorComputedData => {
  const rawData = isRecord(data) ? data : {}
  const points = normalizeVectorPointNodeMap(rawData.points)
  const segments = normalizeVectorSegmentMap(rawData.segments)
  const rawStrokeDebugOptions = isRecord(rawData.strokeDebugOptions)
    ? rawData.strokeDebugOptions
    : {}

  return {
    id: typeof rawData.id === 'string' ? rawData.id : 'vector:invalid',
    x: toFiniteNumber(rawData.x),
    y: toFiniteNumber(rawData.y),
    width: Math.max(0, toFiniteNumber(rawData.width)),
    height: Math.max(0, toFiniteNumber(rawData.height)),
    points,
    segments,
    networks: normalizeVectorNetworkMap(rawData.networks, points, segments),
    closed: rawData.closed === true,
    fillRule: normalizePathTopologyFillRule(
      rawData.fillRule === 'nonzero' ? 'nonzero' : null
    ),
    fills: Array.isArray(rawData.fills) ? rawData.fills : [],
    strokes: Array.isArray(rawData.strokes) ? rawData.strokes : [],
    strokeDebugOptions: {
      disableVisualOverlapCollapse:
        rawStrokeDebugOptions.disableVisualOverlapCollapse === true
    }
  }
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

type SolidStrokeFinalFaceList = ReturnType<
  typeof buildSolidCenterStrokeFinalFaces
>

interface ConstrainedDashedPromotionResult {
  packets: SolidCenterStrokeResolvedPacket[]
  exactFaces: SolidStrokeFinalFaceList
}

interface ConstrainedSolidPromotionResult {
  packets: SolidCenterStrokeResolvedPacket[]
  exactFaces: SolidStrokeFinalFaceList
}

const isExactConstrainedSolidCandidatePacket = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  const debugMeta = packet.geometry.debugMeta

  return (
    debugMeta?.geometryFamily === 'constrained-solid' &&
    debugMeta.resolutionStatus === 'exact-constrained' &&
    (debugMeta.sourceSpanIds?.length ?? 0) > 0
  )
}

const isSelfIntersectingExactConstrainedSolidCandidatePacket = (
  packet: SolidCenterStrokeResolvedPacket
) =>
  isExactConstrainedSolidCandidatePacket(packet) &&
  packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'

const isGatedSelfIntersectingLocalSideConstrainedSolidCandidatePacket = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  const debugMeta = packet.geometry.debugMeta

  return (
    debugMeta?.geometryFamily === 'constrained-solid' &&
    debugMeta.resolutionStatus === 'local-side-approximation' &&
    debugMeta.sourceTopology === 'self-intersecting' &&
    (debugMeta.sourceSpanIds?.length ?? 0) > 0
  )
}

const canPreserveSingleOwnerLocalSideConstrainedSolidPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  if (packets.length === 0) {
    return false
  }

  const strokeIds = new Set(
    packets.map((packet) => packet.geometry.debugMeta?.strokeId ?? null)
  )

  return (
    strokeIds.size <= 1 &&
    packets.every(
      isGatedSelfIntersectingLocalSideConstrainedSolidCandidatePacket
    )
  )
}

const markArrangedFacesAsLocalSideCandidates = (
  faces: SolidStrokeFinalFaceList
): SolidStrokeFinalFaceList =>
  faces.map((face) => ({
    ...face,
    resolutionStatus: 'local-side-approximation',
    runtimeStatus: 'candidate',
    debugMeta: face.debugMeta
      ? {
          ...face.debugMeta,
          resolutionStatus: 'local-side-approximation',
          runtimeStatus: 'candidate',
          runtimeReason: 'local-side-constrained-solid',
          arrangementStatus: undefined,
          visualOverlapCollapseStatus: 'local-side-arrangement'
        }
      : face.debugMeta
  }))

const canUseExactSingleNetworkConstrainedSolidFacesDirectly = (
  faces: SolidStrokeFinalFaceList
) => {
  if (faces.length === 0) {
    return false
  }

  const networkIds = new Set<string>()
  return faces.every((face) => {
    if (
      face.geometryFamily !== 'constrained-solid' ||
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

const promoteConstrainedSolidPacketsToExactArrangement = (
  packets: SolidCenterStrokeResolvedPacket[],
  legalDomains: ArrangementLegalDomain[] = []
): ConstrainedSolidPromotionResult => {
  if (packets.length === 0) {
    return { packets, exactFaces: [] }
  }
  const hasExactConstrainedCandidates = packets.some(
    isExactConstrainedSolidCandidatePacket
  )
  if (!hasExactConstrainedCandidates && legalDomains.length === 0) {
    return { packets, exactFaces: [] }
  }

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.buildArrangement !== true) {
      return { packets, exactFaces: [] }
    }

    const gatedSelfIntersectingPackets = packets.filter(
      isSelfIntersectingExactConstrainedSolidCandidatePacket
    )
    const promotablePackets =
      gatedSelfIntersectingPackets.length === 0
        ? packets
        : packets.filter(
            (packet) =>
              !isSelfIntersectingExactConstrainedSolidCandidatePacket(packet)
          )
    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      promotablePackets,
      {
        backend,
        legalDomains
      }
    )
    if (arrangedFaces.length === 0) {
      return { packets, exactFaces: [] }
    }

    return { packets: gatedSelfIntersectingPackets, exactFaces: arrangedFaces }
  } catch {
    return { packets, exactFaces: [] }
  }
}

const promoteGatedSelfIntersectingSolidPacketsToLocalSideVisualArrangement = (
  packets: SolidCenterStrokeResolvedPacket[]
): ConstrainedSolidPromotionResult => {
  if (packets.length === 0) {
    return { packets, exactFaces: [] }
  }

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.buildArrangement !== true) {
      return { packets, exactFaces: [] }
    }

    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      packets,
      {
        backend,
        legalDomains: []
      }
    )
    if (arrangedFaces.length === 0) {
      return { packets, exactFaces: [] }
    }

    return {
      packets: [],
      exactFaces: markArrangedFacesAsLocalSideCandidates(arrangedFaces)
    }
  } catch {
    return { packets, exactFaces: [] }
  }
}

const shouldKeepConstrainedDashedPacketLocal = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  const debugMeta = packet.geometry.debugMeta

  if (debugMeta?.sourceTopology === 'self-intersecting') {
    return true
  }

  return (
    debugMeta?.sourceTopology === 'sampled-simple-closed' &&
    debugMeta.resolutionStatus === 'local-side-approximation'
  )
}

const promoteConstrainedDashedPacketsToExactArrangement = (
  packets: SolidCenterStrokeResolvedPacket[],
  legalDomains: ArrangementLegalDomain[] = []
): ConstrainedDashedPromotionResult => {
  if (packets.length === 0) {
    return { packets, exactFaces: [] }
  }

  if (packets.some(shouldKeepConstrainedDashedPacketLocal)) {
    return { packets, exactFaces: [] }
  }

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.buildArrangement !== true) {
      return { packets, exactFaces: [] }
    }

    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      packets,
      { backend, legalDomains }
    )
    if (arrangedFaces.length === 0) {
      return { packets, exactFaces: [] }
    }

    return { packets: [], exactFaces: arrangedFaces }
  } catch {
    return { packets, exactFaces: [] }
  }
}

const buildNormalizedCompoundConstrainedDashedPackets = (
  vectorId: string,
  legalDomain: NormalizedLegalDomain,
  strokes: StrokeAttrs[] | undefined
): SolidCenterStrokeResolvedPacket[] =>
  legalDomain.boundarySpans.flatMap((span, spanIndex) => {
    if (span.geometry.length < 3) {
      return []
    }

    const boundaryRole = span.role === 'hole-boundary' ? 'hole' : 'shell'
    const pathId = `vector:${vectorId}:compound-normalized:${spanIndex}`
    const topology = buildPathTopologyModel({
      pathId,
      sourceId: `vector:${vectorId}`,
      networkId: span.boundarySpanId,
      sourceFamily: 'vector',
      fillRule: legalDomain.fillRule,
      points: span.geometry,
      closed: true
    })

    return buildConstrainedDashedStrokeResolvedPackets(
      `${pathId}:constrained-dashed`,
      span.geometry,
      true,
      invertConstrainedStrokePositionForHole(strokes, boundaryRole),
      {
        metadata: {
          ownerKeyPrefix: `vector:${vectorId}:compound-normalized:${span.boundarySpanId}`,
          networkId: span.boundarySpanId,
          contourId: span.boundarySpanId,
          sourceContourIds: span.sourceContourIds,
          legalDomainId: legalDomain.legalDomainId,
          legalDomainIds: [legalDomain.legalDomainId],
          sourceSpanIds: span.sourceSpanIds,
          ownerSet: span.sourceContourIds.map((contourId) => ({
            ownerKey: `vector:${vectorId}:compound:${contourId}`,
            sourcePathId: `vector:${vectorId}`,
            contourId
          }))
        },
        topology
      }
    )
  })

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

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

const hasOverlappingNetworkSourceBounds = (
  networkPaths: { topology: PathTopologyModel }[]
) => {
  if (networkPaths.length < 2) {
    return false
  }

  const bounds = networkPaths.map(({ topology }) =>
    getPointBounds(topology.normalizedPoints)
  )

  for (let leftIndex = 0; leftIndex < bounds.length - 1; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bounds.length;
      rightIndex += 1
    ) {
      if (boundsOverlapOrTouch(bounds[leftIndex], bounds[rightIndex])) {
        return true
      }
    }
  }

  return false
}

const buildStrokeFinalFaceSignature = (
  face: SolidStrokeFinalFaceList[number]
) => {
  const { bounds, debugMeta, faceId, polygons, sourceGeometryIds } = face
  const revisionSet = debugMeta?.revisionSet
  const identity =
    sourceGeometryIds.length === 1 ? sourceGeometryIds[0] : faceId

  if (revisionSet) {
    return [
      identity,
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      revisionSet.sourcePathRevision,
      revisionSet.strokeSpecRevision,
      revisionSet.intervalAllocationRevision,
      revisionSet.topologyClassificationRevision,
      revisionSet.ownershipRevision,
      revisionSet.legalityRevision,
      revisionSet.previewModeRevision
    ].join(',')
  }

  const polygonSignature = polygons
    .map((polygon) => polygon.map((point) => `${point.x}:${point.y}`).join(';'))
    .join('/')

  return [
    identity,
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
    polygonSignature
  ].join(',')
}

const invertConstrainedStrokePositionForHole = (
  strokes: StrokeAttrs[] | undefined,
  role: 'shell' | 'hole' | undefined
): StrokeAttrs[] | undefined => {
  if (role !== 'hole') {
    return strokes
  }

  return strokes?.map((stroke) => {
    if (stroke.position === 'inside') {
      return { ...stroke, position: 'outside' }
    }
    if (stroke.position === 'outside') {
      return { ...stroke, position: 'inside' }
    }
    return stroke
  })
}

const mapOpenPathStrokePositionToCenter = (
  strokes: StrokeAttrs[] | undefined
): StrokeAttrs[] | undefined =>
  strokes?.map((stroke) =>
    stroke.position === 'inside' || stroke.position === 'outside'
      ? { ...stroke, position: 'center' }
      : stroke
  )

const getConstrainedSolidBlockedReason = (
  topology: PathTopologyModel
): ConstrainedSolidRuntimeReason => {
  if (topology.topologyFamily === 'degenerate') {
    return 'degenerate-topology'
  }

  return 'no-candidate-packets'
}

const mergeConstrainedSolidOwnershipDiagnostics = (
  entries: {
    networkId: string
    ownershipDiagnostics: ConstrainedSolidOwnershipDiagnostics
  }[]
): ConstrainedSolidOwnershipDiagnostics => {
  const emptyDiagnostics = createEmptyConstrainedSolidOwnershipDiagnostics()
  const candidates: ConstrainedSolidOwnershipDiagnostics['candidates'] = []
  const edges: ConstrainedSolidOwnershipDiagnostics['edges'] = []
  const components: ConstrainedSolidOwnershipDiagnostics['components'] = []
  const arrangementFaces: ConstrainedSolidOwnershipDiagnostics['arrangementFaces'] =
    []
  const ownedRegions: ConstrainedSolidOwnershipDiagnostics['ownedRegions'] = []

  entries.forEach(({ networkId, ownershipDiagnostics }) => {
    const scope = `network:${networkId}`
    const candidateIdMap = new Map<string, string>()

    ownershipDiagnostics.candidates.forEach((candidate) => {
      const candidateId = `${scope}:${candidate.candidateId}`
      candidateIdMap.set(candidate.candidateId, candidateId)
      candidates.push({
        ...candidate,
        candidateId
      })
    })

    ownershipDiagnostics.edges.forEach(([left, right]) => {
      const remappedLeft = candidateIdMap.get(left)
      const remappedRight = candidateIdMap.get(right)
      if (!remappedLeft || !remappedRight) {
        return
      }
      edges.push([remappedLeft, remappedRight])
    })

    ownershipDiagnostics.components.forEach((component) => {
      components.push({
        ...component,
        componentId: `${scope}:${component.componentId}`,
        candidateIds: component.candidateIds.map(
          (candidateId) => candidateIdMap.get(candidateId) ?? candidateId
        )
      })
    })

    ownershipDiagnostics.arrangementFaces.forEach((face) => {
      arrangementFaces.push({
        ...face,
        faceId: `${scope}:${face.faceId}`,
        candidateIds: face.candidateIds.map(
          (candidateId) => candidateIdMap.get(candidateId) ?? candidateId
        )
      })
    })

    ownershipDiagnostics.ownedRegions.forEach((region) => {
      ownedRegions.push({
        ...region,
        regionId: `${scope}:${region.regionId}`,
        candidateIds: region.candidateIds.map(
          (candidateId) => candidateIdMap.get(candidateId) ?? candidateId
        )
      })
    })
  })

  return {
    arrangementPolicy:
      entries[0]?.ownershipDiagnostics.arrangementPolicy ??
      emptyDiagnostics.arrangementPolicy,
    candidates,
    edges,
    components,
    arrangementFaces,
    ownedRegions
  }
}

interface Vec2 {
  x: number
  y: number
}

interface FillFaceCache {
  faces: Vec2[][]
  lastRebuildAt: number
  lastRenderAt: number
  revision: number
  pendingTimerId?: ReturnType<typeof setTimeout>
  dragSuppressed?: boolean
  segmentKeyMap?: Record<string, string>
  segmentLinesMap?: Record<string, LineSegment[]>
}

interface EvenOddFillCache {
  fill: { style: unknown; dispose: () => void } | null
  dragSuppressed?: boolean
  width?: number
  height?: number
  fillId?: string
  fillPayload?: FillAttrs[]
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
}

interface VectorHitCache {
  segmentKeyMap?: Record<string, string>
  segmentLinesMap?: Record<string, LineSegment[]>
  preparedFillSegments?: PreparedEvenOddHitSegment[]
  hitArea?: { contains: (x: number, y: number) => boolean }
  strokeHitSignature?: string
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
  hasVisibleFill?: boolean
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
const DEFAULT_FLATTEN_SEGMENT_LENGTH = 12
const INTERSECTION_EPS = 1e-6
const NODE_KEY_EPS = 1e-4
const MAX_OPEN_SEGMENTS = 1200
const FILL_REBUILD_MIN_INTERVAL_MS = 120
const FILL_HEAVY_REBUILD_MIN_INTERVAL_MS = 260
const FILL_RAPID_RENDER_THRESHOLD_MS = 40
const FILL_DEFERRED_REBUILD_MS = 140
const FILL_HEAVY_COMPLEXITY_THRESHOLD = 320
const EVEN_ODD_DRAG_MAX_RASTER_PIXELS = 160_000

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

interface PreparedEvenOddHitSegment {
  type: 'line' | 'cubicBezier'
  points: number[]
  minY: number
  maxY: number
}

const buildFlattenedSegmentsWithCache = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  cache?: Pick<FillFaceCache, 'segmentKeyMap' | 'segmentLinesMap'>
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
      const startPos = { x: start.x, y: start.y }
      const endPos = { x: end.x, y: end.y }
      const outControlPos = outControl
        ? { x: outControl.x, y: outControl.y }
        : null
      const inControlPos = inControl ? { x: inControl.x, y: inControl.y } : null
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

  const directedSegments: DirectedSegment[] = flattenedSegments.map(
    (segment) => ({
      start: segment.start,
      end: segment.end
    })
  )

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

const prepareEvenOddHitSegments = (
  shape: EvenOddShape
): PreparedEvenOddHitSegment[] => {
  const prepared: PreparedEvenOddHitSegment[] = []

  shape.paths.forEach((path) => {
    path.segments.forEach((segment) => {
      const pointList = segment.points
      if (segment.type === 'line' && pointList.length === 4) {
        prepared.push({
          type: 'line',
          points: pointList,
          minY: Math.min(pointList[1], pointList[3]),
          maxY: Math.max(pointList[1], pointList[3])
        })
        return
      }

      if (segment.type === 'cubicBezier' && pointList.length === 8) {
        prepared.push({
          type: 'cubicBezier',
          points: pointList,
          minY: Math.min(
            pointList[1],
            pointList[3],
            pointList[5],
            pointList[7]
          ),
          maxY: Math.max(pointList[1], pointList[3], pointList[5], pointList[7])
        })
      }
    })
  })

  return prepared
}

const collectLineIntersectionsAtY = (
  y: number,
  p1: Vec2,
  p2: Vec2,
  intersections: number[]
) => {
  if (Math.abs(p1.y - p2.y) <= INTERSECTION_EPS) {
    return
  }

  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  if (y < minY || y >= maxY) {
    return
  }

  const t = (y - p1.y) / (p2.y - p1.y)
  const x = p1.x + (p2.x - p1.x) * t
  intersections.push(x)
}

const distanceToLine = (point: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = Math.hypot(dx, dy)
  if (denom <= INTERSECTION_EPS) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }

  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / denom
}

const subdivideCubic = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) => {
  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 }

  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 }
  const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 }

  const p0123 = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 }

  return {
    left: [p0, p01, p012, p0123] as const,
    right: [p0123, p123, p23, p3] as const
  }
}

const collectCubicIntersectionsAtY = (
  y: number,
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  intersections: number[],
  depth = 0
) => {
  const minY = Math.min(p0.y, p1.y, p2.y, p3.y)
  const maxY = Math.max(p0.y, p1.y, p2.y, p3.y)
  if (y < minY || y >= maxY) {
    return
  }

  const flatness =
    Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3)) || 0
  if (depth >= 12 || flatness <= 0.2) {
    collectLineIntersectionsAtY(y, p0, p3, intersections)
    return
  }

  const { left, right } = subdivideCubic(p0, p1, p2, p3)
  collectCubicIntersectionsAtY(
    y,
    left[0],
    left[1],
    left[2],
    left[3],
    intersections,
    depth + 1
  )
  collectCubicIntersectionsAtY(
    y,
    right[0],
    right[1],
    right[2],
    right[3],
    intersections,
    depth + 1
  )
}

const isPointInsidePreparedEvenOddShape = (
  point: Vec2,
  preparedSegments: PreparedEvenOddHitSegment[]
) => {
  if (preparedSegments.length === 0) {
    return false
  }

  const intersections: number[] = []
  preparedSegments.forEach((segment) => {
    if (point.y < segment.minY || point.y >= segment.maxY) {
      return
    }

    if (segment.type === 'line') {
      const [x1, y1, x2, y2] = segment.points
      collectLineIntersectionsAtY(
        point.y,
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        intersections
      )
      return
    }

    const [x1, y1, cx1, cy1, cx2, cy2, x2, y2] = segment.points
    collectCubicIntersectionsAtY(
      point.y,
      { x: x1, y: y1 },
      { x: cx1, y: cy1 },
      { x: cx2, y: cy2 },
      { x: x2, y: y2 },
      intersections
    )
  })

  if (intersections.length === 0) {
    return false
  }

  intersections.sort((a, b) => a - b)

  for (let i = 0; i + 1 < intersections.length; i += 2) {
    const startX = intersections[i]
    const endX = intersections[i + 1]
    if (
      point.x >= startX - INTERSECTION_EPS &&
      point.x <= endX + INTERSECTION_EPS
    ) {
      return true
    }
  }

  return false
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

import { type EvenOddShape, type EvenOddSegment } from '@asyra/core'

const buildEvenOddShape = (
  orderedNetworks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
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
          points: [start.x, start.y, end.x, end.y]
        })
      } else {
        segmentsList.push({
          type: 'cubicBezier',
          points: [
            start.x,
            start.y,
            outControl?.x ?? start.x,
            outControl?.y ?? start.y,
            inControl?.x ?? end.x,
            inControl?.y ?? end.y,
            end.x,
            end.y
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

const getFillPayload = (fills: FillAttrs[]): FillAttrs[] =>
  Array.isArray(fills) && fills.length > 0 ? fills : []

const isVectorEditingDrag = (vectorId: string): boolean => {
  const pathEditingVectorId =
    core.getSystemProperty<string | null>('pathEditingVectorId') ?? null
  if (!pathEditingVectorId || pathEditingVectorId !== vectorId) {
    return false
  }

  const pathEditingMode =
    core.getSystemProperty<boolean>('pathEditingMode') ?? false
  if (!pathEditingMode) {
    return false
  }

  const mouseDragging =
    core.getSystemProperty<boolean>('mouseDragging') ?? false
  const mouseDown = core.getSystemProperty<boolean>('mouseDown') ?? false
  return mouseDragging || mouseDown
}

const isSelectToolDrag = (): boolean => {
  const primaryTool = core.getSystemProperty<string>('primaryTool') ?? ''
  if (primaryTool !== 'select') {
    return false
  }

  const pathEditingMode =
    core.getSystemProperty<boolean>('pathEditingMode') ?? false
  if (pathEditingMode) {
    return false
  }

  return core.getSystemProperty<boolean>('mouseDragging') ?? false
}

const renderVectorGraphic = (
  graphic: Parameters<RenderStrategy>[0],
  data: unknown,
  options: { forceFillRebuild?: boolean; allowDeferredFill?: boolean } = {}
) => {
  const renderData = normalizeVectorRenderData(data)
  const graphicCache = graphic as typeof graphic & {
    __asyraVectorFillCache?: FillFaceCache
    __asyraEvenOddFillCache?: EvenOddFillCache
    __asyraVectorHitCache?: VectorHitCache
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

  // Force PixiJS to refresh rendering state
  renderStateGraphic.geometry?.clear?.()
  renderStateGraphic.batched = false
  renderStateGraphic._transform?.updateLocalTransform?.()

  const { fills, x, y, points, segments, networks } = renderData

  const orderedNetworks = sortByStableId(Object.values(networks))
  if (orderedNetworks.length === 0) {
    ;(
      graphic as typeof graphic & {
        __asyraVectorPathGeometryModelCount?: number
        __asyraVectorPathTopologyModelCount?: number
      }
    ).__asyraVectorPathGeometryModelCount = 0
    ;(
      graphic as typeof graphic & {
        __asyraVectorPathTopologyModelCount?: number
      }
    ).__asyraVectorPathTopologyModelCount = 0
    applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, [])
    renderSolidCenterStrokeEntries(graphic, [])
    return
  }

  graphic.x = x
  graphic.y = y
  setElementGeometryLocalBounds(
    graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
    { x: 0, y: 0, width: renderData.width, height: renderData.height }
  )

  const fillPayload = getFillPayload(fills)
  let previewFill = false

  const hasClosedNetwork =
    renderData.closed === true ||
    orderedNetworks.some(
      (network) => network.closed && network.pointIds.length > 2
    )

  const hasGradient = fillPayload.some((f) => f.kind === 'gradient')
  const dragSuppressed =
    isVectorEditingDrag(renderData.id) || isSelectToolDrag()
  let evenOddShapeCache: EvenOddShape | null = null
  const getEvenOddShape = () => {
    if (!evenOddShapeCache) {
      evenOddShapeCache = buildEvenOddShape(orderedNetworks, points, segments)
    }
    return evenOddShapeCache
  }

  const networkPaths = orderedNetworks.map((network) => {
    const path = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: `vector:${renderData.id}:${network.id}`,
      sourceId: `vector:${renderData.id}`,
      networkId: network.id,
      sourceFamily: 'vector',
      fillRule: renderData.fillRule,
      points: path.sampledPoints,
      closed: path.closed
    })

    return {
      network,
      path,
      topology
    }
  })
  ;(
    graphic as typeof graphic & {
      __asyraVectorPathGeometryModelCount?: number
      __asyraVectorPathTopologyModelCount?: number
    }
  ).__asyraVectorPathGeometryModelCount = networkPaths.length
  ;(
    graphic as typeof graphic & {
      __asyraVectorPathTopologyModelCount?: number
    }
  ).__asyraVectorPathTopologyModelCount = networkPaths.length
  const selfIntersectingNetworkCount = networkPaths.filter(
    ({ topology }) => topology.topologyFamily === 'self-intersecting'
  ).length
  const closedNetworkPaths = networkPaths.filter(
    ({ topology }) => topology.closed
  )
  const legalDomainBackend = (() => {
    try {
      const backend = getGeometryBackend()
      return backend.capabilities.union === true &&
        backend.capabilities.difference === true
        ? backend
        : null
    } catch {
      return null
    }
  })()
  const constrainedSolidExactBackend = (() => {
    try {
      const backend = getGeometryBackend()
      return backend.capabilities.union === true &&
        backend.capabilities.difference === true &&
        backend.capabilities.offset === true
        ? backend
        : null
    } catch {
      return null
    }
  })()
  const compoundLegalDomainNormalization =
    buildCompoundLegalDomainNormalization(
      closedNetworkPaths.map(({ topology }) => topology),
      {
        legalDomainId: `vector:${renderData.id}:compound-legal-domain:0`,
        backend: legalDomainBackend ?? undefined,
        allowBackendNormalization: !!legalDomainBackend
      }
    )
  const compoundLegalDomainClassifications =
    compoundLegalDomainNormalization.status === 'normalized'
      ? compoundLegalDomainNormalization.legalDomain.classifications
      : []
  const hasCompoundLegalDomain =
    compoundLegalDomainNormalization.status === 'normalized' &&
    closedNetworkPaths.length >= 2 &&
    compoundLegalDomainClassifications.length === closedNetworkPaths.length &&
    compoundLegalDomainClassifications.some(
      (classification) => classification.role === 'shell'
    ) &&
    compoundLegalDomainClassifications.some(
      (classification) => classification.role === 'hole'
    )
  const compoundRoleByNetworkId = new Map(
    compoundLegalDomainClassifications.map((classification) => [
      classification.networkId,
      classification
    ])
  )
  const compoundLegalDomainId = hasCompoundLegalDomain
    ? compoundLegalDomainNormalization.legalDomain.legalDomainId
    : null
  const arrangementLegalDomains: ArrangementLegalDomain[] =
    compoundLegalDomainNormalization.status === 'normalized'
      ? [
          {
            legalDomainId:
              compoundLegalDomainNormalization.legalDomain.legalDomainId,
            fillRule: compoundLegalDomainNormalization.legalDomain.fillRule,
            regions: compoundLegalDomainNormalization.legalDomain.regions
          }
        ]
      : closedNetworkPaths.map(({ network, topology }) => {
          const selfIntersectingRegions =
            topology.topologyFamily === 'self-intersecting'
              ? buildSelfIntersectingPolylineLegalDomainRegions(
                  topology.normalizedPoints
                )
              : []

          return {
            legalDomainId: topology.legalDomains[0]?.legalDomainId,
            fillRule: topology.fillRule,
            regions:
              selfIntersectingRegions.length > 0
                ? selfIntersectingRegions
                : [
                    {
                      polygons: [topology.normalizedPoints]
                    }
                  ]
          }
        })
  const hasSourceBoundsOverlap =
    hasOverlappingNetworkSourceBounds(closedNetworkPaths)
  const shouldBuildGlobalOverlapConstrainedSolid =
    hasSourceBoundsOverlap && !hasCompoundLegalDomain
  const systemDebugDisableVisualOverlapCollapse =
    core.getSystemProperty<boolean>(
      'strokeDebugDisableVisualOverlapCollapse'
    ) ?? false
  const shouldDisableVisualOverlapCollapse =
    renderData.strokeDebugOptions.disableVisualOverlapCollapse === true ||
    systemDebugDisableVisualOverlapCollapse

  const shouldEmitConstrainedDashedRuntimeDiagnostics = networkPaths.some(
    ({ topology }) =>
      topology.closed && hasConstrainedDashedStrokeIntent(renderData.strokes)
  )
  const shouldUseNormalizedCompoundDashedBoundaries =
    shouldEmitConstrainedDashedRuntimeDiagnostics &&
    compoundLegalDomainNormalization.status === 'normalized' &&
    compoundLegalDomainNormalization.legalDomain.mode === 'backend-boolean'
  const constrainedDashedCandidatePackets =
    shouldEmitConstrainedDashedRuntimeDiagnostics
      ? shouldUseNormalizedCompoundDashedBoundaries &&
        compoundLegalDomainNormalization.status === 'normalized'
        ? buildNormalizedCompoundConstrainedDashedPackets(
            renderData.id,
            compoundLegalDomainNormalization.legalDomain,
            renderData.strokes
          )
        : networkPaths.flatMap(({ network, path, topology }) => {
            if (!topology.closed) {
              return []
            }
            const compoundRole = compoundRoleByNetworkId.get(network.id)
            const strokesForNetwork = invertConstrainedStrokePositionForHole(
              renderData.strokes,
              compoundRole?.role
            )
            return buildConstrainedDashedStrokeResolvedPackets(
              `vector:${renderData.id}:${network.id}:constrained-dashed`,
              topology.normalizedPoints,
              topology.closed,
              strokesForNetwork,
              {
                metadata: {
                  ownerKeyPrefix: compoundLegalDomainId
                    ? `vector:${renderData.id}:compound`
                    : `vector:${renderData.id}:${network.id}`,
                  networkId: network.id,
                  contourId: compoundRole?.contourId,
                  legalDomainId:
                    compoundLegalDomainId ?? compoundRole?.legalDomainId
                },
                topology,
                sourcePath: path.segments.some(
                  (segment) => segment.type === 'cubic'
                )
                  ? path
                  : undefined,
                selectedSideGuardPoints: getNetworkAnchorGuardPoints(
                  network,
                  points
                )
              }
            )
          })
      : []
  const hasConstrainedSolidIntent = networkPaths.some(
    ({ topology }) =>
      topology.closed && hasConstrainedSolidStrokeIntent(renderData.strokes)
  )
  const constrainedSolidDiagnostics = (() => {
    if (!hasConstrainedSolidIntent) {
      return networkPaths.map(({ network, topology }) => ({
        networkId: network.id,
        points: topology.normalizedPoints,
        closed: topology.closed,
        fillRule: topology.fillRule,
        packets: [],
        legalityDiagnostics: { domains: [], acceptedGeometryIds: [] },
        ownershipDiagnostics: createEmptyConstrainedSolidOwnershipDiagnostics()
      }))
    }

    if (shouldBuildGlobalOverlapConstrainedSolid) {
      const candidatePackets = networkPaths.flatMap(
        ({ network, path, topology }) =>
          topology.closed
            ? buildConstrainedSolidStrokeResolvedPackets(
                `vector:${renderData.id}:${network.id}:constrained`,
                topology.normalizedPoints,
                topology.closed,
                renderData.strokes,
                {
                  metadata: {
                    ownerKeyPrefix: `vector:${renderData.id}:overlap`,
                    networkId: network.id
                  },
                  topology,
                  sourcePath: path,
                  selectedSideGuardPoints: getNetworkAnchorGuardPoints(
                    network,
                    points
                  ),
                  exactBackend: constrainedSolidExactBackend ?? undefined,
                  fillRule: topology.fillRule,
                  candidateMode: 'exact-arrangement'
                }
              )
            : []
      )
      const result = buildConstrainedSolidLegalityClippingResult(
        closedNetworkPaths.map(({ topology }) => ({
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule
        })),
        renderData.strokes,
        candidatePackets,
        {
          disableVisualOverlapCollapse: shouldDisableVisualOverlapCollapse
        }
      )

      return networkPaths.map(({ network, topology }, index) => ({
        networkId: network.id,
        points: topology.normalizedPoints,
        closed: topology.closed,
        fillRule: topology.fillRule,
        packets: result.packets.filter(
          (packet) => packet.geometry.debugMeta?.networkId === network.id
        ),
        legalityDiagnostics:
          index === 0
            ? result.legalityDiagnostics
            : { domains: [], acceptedGeometryIds: [] },
        ownershipDiagnostics:
          index === 0
            ? result.ownershipDiagnostics
            : createEmptyConstrainedSolidOwnershipDiagnostics()
      }))
    }

    return networkPaths.flatMap(({ network, path, topology }) => {
      if (!topology.closed) {
        return {
          networkId: network.id,
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule,
          packets: [],
          legalityDiagnostics: { domains: [], acceptedGeometryIds: [] },
          ownershipDiagnostics:
            createEmptyConstrainedSolidOwnershipDiagnostics()
        }
      }
      const compoundRole = compoundRoleByNetworkId.get(network.id)
      const strokesForNetwork = invertConstrainedStrokePositionForHole(
        renderData.strokes,
        compoundRole?.role
      )
      const candidatePackets = buildConstrainedSolidStrokeResolvedPackets(
        `vector:${renderData.id}:${network.id}:constrained`,
        topology.normalizedPoints,
        topology.closed,
        strokesForNetwork,
        {
          metadata: {
            ownerKeyPrefix: compoundLegalDomainId
              ? `vector:${renderData.id}:compound`
              : `vector:${renderData.id}:${network.id}`,
            networkId: network.id,
            contourId: compoundRole?.contourId,
            legalDomainId: compoundLegalDomainId ?? compoundRole?.legalDomainId
          },
          topology,
          sourcePath: path,
          selectedSideGuardPoints: getNetworkAnchorGuardPoints(network, points),
          exactBackend: constrainedSolidExactBackend ?? undefined,
          fillRule: topology.fillRule,
          candidateMode: 'exact-arrangement'
        }
      )

      if (candidatePackets.some(isExactConstrainedSolidCandidatePacket)) {
        return {
          networkId: network.id,
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule,
          packets: candidatePackets,
          legalityDiagnostics: {
            domains: [],
            acceptedGeometryIds: candidatePackets.map(
              (packet) => packet.geometry.geometryId
            )
          },
          ownershipDiagnostics:
            buildConstrainedSolidOwnershipDiagnostics(candidatePackets)
        }
      }

      if (
        canPreserveSingleOwnerLocalSideConstrainedSolidPackets(candidatePackets)
      ) {
        return {
          networkId: network.id,
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule,
          packets: candidatePackets,
          legalityDiagnostics: {
            domains: [],
            acceptedGeometryIds: candidatePackets.map(
              (packet) => packet.geometry.geometryId
            )
          },
          ownershipDiagnostics:
            buildConstrainedSolidOwnershipCandidateDiagnostics(candidatePackets)
        }
      }

      const result = buildConstrainedSolidLegalityClippingResult(
        [
          {
            points: topology.normalizedPoints,
            closed: topology.closed,
            fillRule: topology.fillRule
          }
        ],
        strokesForNetwork,
        candidatePackets,
        {
          disableVisualOverlapCollapse: shouldDisableVisualOverlapCollapse
        }
      )

      return {
        networkId: network.id,
        points: topology.normalizedPoints,
        closed: topology.closed,
        fillRule: topology.fillRule,
        packets: result.packets,
        legalityDiagnostics: result.legalityDiagnostics,
        ownershipDiagnostics: result.ownershipDiagnostics
      }
    })
  })()

  const constrainedSolidExactCandidatePackets =
    constrainedSolidDiagnostics.flatMap((entry) =>
      entry.packets.filter(isExactConstrainedSolidCandidatePacket)
    )
  const constrainedSolidLocalSideVisualCandidatePackets =
    constrainedSolidDiagnostics.flatMap((entry) =>
      entry.packets.filter(
        isGatedSelfIntersectingLocalSideConstrainedSolidCandidatePacket
      )
    )
  const constrainedSolidPromotion =
    promoteConstrainedSolidPacketsToExactArrangement(
      constrainedSolidExactCandidatePackets,
      arrangementLegalDomains
    )
  const constrainedSolidLocalSidePromotion =
    promoteGatedSelfIntersectingSolidPacketsToLocalSideVisualArrangement(
      constrainedSolidLocalSideVisualCandidatePackets
    )
  const constrainedSolidPromotedCandidateGeometryIds = new Set(
    [
      ...constrainedSolidExactCandidatePackets,
      ...constrainedSolidLocalSideVisualCandidatePackets
    ].map((packet) => packet.geometry.geometryId)
  )

  const constrainedDashedRuntimeDiagnostics: ConstrainedDashedRuntimeDiagnosticEntry[] =
    []
  const constrainedSolidRuntimeDiagnostics: ConstrainedSolidRuntimeDiagnosticEntry[] =
    []
  const constrainedDashedAcceptedCandidatePackets =
    shouldEmitConstrainedDashedRuntimeDiagnostics
      ? shouldUseNormalizedCompoundDashedBoundaries
        ? (() => {
            const ownerKeys = [
              ...new Set(
                constrainedDashedCandidatePackets.flatMap((packet) =>
                  (packet.geometry.debugMeta?.ownerSet ?? []).flatMap(
                    (owner) => (owner.ownerKey ? [owner.ownerKey] : [])
                  )
                )
              )
            ]
            constrainedDashedRuntimeDiagnostics.push({
              sourceId: compoundLegalDomainId ?? `vector:${renderData.id}`,
              status:
                constrainedDashedCandidatePackets.length > 0
                  ? 'accepted'
                  : 'blocked',
              reason:
                constrainedDashedCandidatePackets.length > 0
                  ? ownerKeys.length > 1
                    ? 'typed-owners'
                    : 'single-owner'
                  : 'no-candidate-packets',
              sourceTopology: 'sampled-simple-closed',
              candidatePacketCount: constrainedDashedCandidatePackets.length,
              ownership: {
                status:
                  constrainedDashedCandidatePackets.length > 0
                    ? 'accepted'
                    : 'blocked',
                reason:
                  constrainedDashedCandidatePackets.length > 0
                    ? ownerKeys.length > 1
                      ? 'typed-owners'
                      : 'single-owner'
                    : 'no-packets',
                ownerKeys,
                packetCount: constrainedDashedCandidatePackets.length
              }
            })

            return constrainedDashedCandidatePackets.length > 0
              ? attachStrokePacketDebugMeta(constrainedDashedCandidatePackets, {
                  runtimeStatus: 'accepted',
                  runtimeReason:
                    ownerKeys.length > 1 ? 'typed-owners' : 'single-owner',
                  ownershipStatus: 'accepted',
                  ownerCount: ownerKeys.length
                })
              : []
          })()
        : networkPaths.flatMap(({ network, topology }) => {
            const networkConstrainedDashedCandidatePackets =
              constrainedDashedCandidatePackets.filter(
                (packet) => packet.geometry.debugMeta?.networkId === network.id
              )
            const constrainedDashedRuntimeStatus = topology.closed
              ? classifyConstrainedDashedRuntimeStatus({
                  points: topology.normalizedPoints,
                  closed: topology.closed,
                  topology,
                  candidatePackets: networkConstrainedDashedCandidatePackets
                })
              : null

            if (constrainedDashedRuntimeStatus) {
              constrainedDashedRuntimeDiagnostics.push({
                sourceId: `vector:${renderData.id}:${network.id}`,
                networkId: network.id,
                candidatePacketCount:
                  networkConstrainedDashedCandidatePackets.length,
                ...constrainedDashedRuntimeStatus
              })
            }

            return constrainedDashedRuntimeStatus?.status === 'accepted'
              ? attachStrokePacketDebugMeta(
                  networkConstrainedDashedCandidatePackets,
                  {
                    runtimeStatus: constrainedDashedRuntimeStatus.status,
                    runtimeReason: constrainedDashedRuntimeStatus.reason,
                    sourceTopology:
                      constrainedDashedRuntimeStatus.sourceTopology,
                    ownershipStatus:
                      constrainedDashedRuntimeStatus.ownership.status,
                    ownerCount:
                      constrainedDashedRuntimeStatus.ownership.ownerKeys.length
                  }
                )
              : []
          })
      : []
  const constrainedDashedPromotion =
    promoteConstrainedDashedPacketsToExactArrangement(
      constrainedDashedAcceptedCandidatePackets,
      shouldUseNormalizedCompoundDashedBoundaries ? [] : arrangementLegalDomains
    )
  const renderedDashedCenterPackets: ReturnType<
    typeof buildDashedCenterStrokeResolvedPackets
  > = []
  const strokePackets = [
    ...networkPaths.flatMap(({ network, path, topology }) => {
      const renderStrokesForNetwork = topology.closed
        ? renderData.strokes
        : mapOpenPathStrokePositionToCenter(renderData.strokes)
      const hasNetworkCenterDashedIntent = hasDashedCenterStrokeIntent(
        renderStrokesForNetwork
      )
      const hasNetworkCenterSolidIntent = hasSolidCenterStrokeIntent(
        renderStrokesForNetwork
      )
      const constrainedNetworkDiagnostics = constrainedSolidDiagnostics.find(
        (entry) => entry.networkId === network.id
      )
      if (topology.closed && hasConstrainedSolidIntent) {
        const constrainedPacketCount =
          constrainedNetworkDiagnostics?.packets.length ?? 0
        constrainedSolidRuntimeDiagnostics.push({
          sourceId: `vector:${renderData.id}:${network.id}`,
          networkId: network.id,
          status: constrainedPacketCount > 0 ? 'accepted' : 'blocked',
          reason:
            constrainedPacketCount > 0
              ? 'accepted'
              : getConstrainedSolidBlockedReason(topology),
          candidatePacketCount: constrainedPacketCount,
          topologyFamily: topology.topologyFamily,
          closed: topology.closed
        })
      }
      const networkDashedCenterPackets = hasNetworkCenterDashedIntent
        ? attachStrokePacketDebugMeta(
            buildDashedCenterStrokeResolvedPackets(
              `vector:${renderData.id}:${network.id}:dashed-center`,
              topology.normalizedPoints,
              topology.closed,
              renderStrokesForNetwork,
              {
                metadata: {
                  ownerKeyPrefix: `vector:${renderData.id}:${network.id}`,
                  networkId: network.id
                },
                topology,
                sourcePath: path
              }
            ),
            {}
          )
        : []
      renderedDashedCenterPackets.push(...networkDashedCenterPackets)
      return [
        ...(hasNetworkCenterSolidIntent
          ? buildSolidCenterStrokeResolvedPackets(
              `vector:${renderData.id}:${network.id}:center`,
              topology.normalizedPoints,
              topology.closed,
              renderStrokesForNetwork,
              {
                metadata: {
                  ownerKeyPrefix: `vector:${renderData.id}:${network.id}`,
                  networkId: network.id
                },
                topology
              }
            )
          : []),
        ...networkDashedCenterPackets,
        ...(topology.closed
          ? (constrainedNetworkDiagnostics?.packets.filter(
              (packet) =>
                !constrainedSolidPromotedCandidateGeometryIds.has(
                  packet.geometry.geometryId
                )
            ) ??
            buildConstrainedSolidStrokeResolvedPackets(
              `vector:${renderData.id}:${network.id}:constrained`,
              topology.normalizedPoints,
              topology.closed,
              renderData.strokes,
              {
                metadata: {
                  ownerKeyPrefix: `vector:${renderData.id}:${network.id}`,
                  networkId: network.id
                },
                topology,
                sourcePath: path,
                selectedSideGuardPoints: getNetworkAnchorGuardPoints(
                  network,
                  points
                ),
                exactBackend: constrainedSolidExactBackend ?? undefined,
                fillRule: topology.fillRule,
                candidateMode: 'exact-arrangement'
              }
            ))
          : [])
      ]
    }),
    ...constrainedSolidPromotion.packets,
    ...constrainedSolidLocalSidePromotion.packets,
    ...constrainedDashedPromotion.packets
  ]
  const rawStrokeFinalFaces = [
    ...buildSolidCenterStrokeFinalFaces(strokePackets),
    ...constrainedSolidPromotion.exactFaces,
    ...constrainedSolidLocalSidePromotion.exactFaces,
    ...constrainedDashedPromotion.exactFaces
  ]
  const strokeFinalFaces = (() => {
    if (shouldDisableVisualOverlapCollapse) {
      return rawStrokeFinalFaces
    }

    if (
      canUseExactSingleNetworkConstrainedSolidFacesDirectly(rawStrokeFinalFaces)
    ) {
      return rawStrokeFinalFaces
    }

    try {
      const backend = getGeometryBackend()
      return backend.capabilities.union === true
        ? collapseStrokeFinalFaceVisualOverlaps(rawStrokeFinalFaces, {
            backend
          })
        : rawStrokeFinalFaces
    } catch {
      return rawStrokeFinalFaces
    }
  })()

  const applyVectorHoverHitArea = () => {
    const hitCache: VectorHitCache = graphicCache.__asyraVectorHitCache ?? {}
    const hasVisibleFill =
      hasClosedNetwork && getRenderableFills(fillPayload).length > 0
    const strokeHitSignature = strokeFinalFaces
      .map(buildStrokeFinalFaceSignature)
      .join('|')

    const reuseHitArea =
      hitCache.hitArea &&
      hitCache.points === points &&
      hitCache.segments === segments &&
      hitCache.networks === networks &&
      hitCache.strokeHitSignature === strokeHitSignature &&
      hitCache.hasVisibleFill === hasVisibleFill

    if (reuseHitArea) {
      ;(graphic as { hitArea: typeof hitCache.hitArea | null }).hitArea =
        hitCache.hitArea
      return
    }

    hitCache.points = points
    hitCache.segments = segments
    hitCache.networks = networks
    hitCache.strokeHitSignature = strokeHitSignature
    hitCache.hasVisibleFill = hasVisibleFill
    hitCache.preparedFillSegments = hasVisibleFill
      ? prepareEvenOddHitSegments(getEvenOddShape())
      : []
    const strokeHitArea =
      createSolidCenterStrokeHitAreaFromFinalFaces(strokeFinalFaces)

    if (hasVisibleFill) {
      const fillContains = (x: number, y: number) =>
        isPointInsidePreparedEvenOddShape(
          { x, y },
          hitCache.preparedFillSegments ?? []
        )

      const hitArea = {
        contains: (x: number, y: number) =>
          fillContains(x, y) || strokeHitArea?.contains(x, y) === true
      }

      hitCache.hitArea = hitArea
      ;(graphic as { hitArea: typeof hitArea | null }).hitArea = hitArea
    } else {
      hitCache.hitArea = strokeHitArea ?? undefined
      ;(graphic as { hitArea: typeof hitCache.hitArea | null }).hitArea =
        strokeHitArea ?? null
    }

    graphicCache.__asyraVectorHitCache = hitCache
  }

  if (fillPayload.length > 0) {
    if (hasGradient) {
      const evenOddCache = graphicCache.__asyraEvenOddFillCache ?? {
        fill: null
      }
      const reuseEvenOddFill =
        evenOddCache.fill &&
        evenOddCache.dragSuppressed === dragSuppressed &&
        evenOddCache.width === renderData.width &&
        evenOddCache.height === renderData.height &&
        evenOddCache.fillPayload === fillPayload &&
        evenOddCache.points === points &&
        evenOddCache.segments === segments &&
        evenOddCache.networks === networks

      if (!reuseEvenOddFill) {
        if (evenOddCache.fill) {
          evenOddCache.fill.dispose()
          evenOddCache.fill = null
        }

        const shape = getEvenOddShape()
        const evenOddFill = core.createEvenOddFillStyle({
          width: renderData.width,
          height: renderData.height,
          offsetX: 0,
          offsetY: 0,
          shape,
          fills: fillPayload,
          ...(dragSuppressed
            ? { maxRasterPixels: EVEN_ODD_DRAG_MAX_RASTER_PIXELS }
            : {})
        })

        if (evenOddFill) {
          evenOddCache.fill = evenOddFill
        }

        evenOddCache.dragSuppressed = dragSuppressed
        evenOddCache.width = renderData.width
        evenOddCache.height = renderData.height
        evenOddCache.fillPayload = fillPayload
        evenOddCache.points = points
        evenOddCache.segments = segments
        evenOddCache.networks = networks
        graphicCache.__asyraEvenOddFillCache = evenOddCache
      } else {
        evenOddCache.dragSuppressed = dragSuppressed
        graphicCache.__asyraEvenOddFillCache = evenOddCache
      }

      if (evenOddCache.fill) {
        graphic.rect(0, 0, renderData.width, renderData.height)
        ;(graphic as { fill: (style: unknown) => void }).fill(
          evenOddCache.fill.style
        )
      } else if (hasClosedNetwork) {
        previewFill = true
      }
    } else {
      if (graphicCache.__asyraEvenOddFillCache?.fill) {
        graphicCache.__asyraEvenOddFillCache.fill.dispose()
        graphicCache.__asyraEvenOddFillCache = undefined
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
      const hasSelfIntersectingTopology = selfIntersectingNetworkCount > 0
      const shouldYieldInitialExactFill =
        options.allowDeferredFill !== false &&
        !options.forceFillRebuild &&
        !dragSuppressed &&
        cache.faces.length === 0 &&
        (heavy || hasSelfIntersectingTopology)
      const shouldSuppressInitialDeferredExactFill =
        shouldYieldInitialExactFill && hasSelfIntersectingTopology
      const dragReleased = cache.dragSuppressed === true && !dragSuppressed
      const rebuildInterval = heavy
        ? FILL_HEAVY_REBUILD_MIN_INTERVAL_MS
        : FILL_REBUILD_MIN_INTERVAL_MS
      const rapidRender = now - lastRenderAt < FILL_RAPID_RENDER_THRESHOLD_MS
      const shouldRebuild =
        !shouldYieldInitialExactFill &&
        (options.forceFillRebuild ||
          dragReleased ||
          (dragSuppressed
            ? true
            : !rapidRender && now - cache.lastRebuildAt >= rebuildInterval))

      if (cache.pendingTimerId) {
        clearTimeout(cache.pendingTimerId)
        cache.pendingTimerId = undefined
      }

      let fillFaces = cache.faces
      if (shouldRebuild) {
        const {
          flattenedSegments,
          directedSegments,
          segmentKeyMap,
          segmentLinesMap
        } = buildFlattenedSegmentsWithCache(
          orderedNetworks,
          points,
          segments,
          cache
        )
        fillFaces = buildFillFaces(flattenedSegments, directedSegments)
        cache.faces = fillFaces
        cache.lastRebuildAt = now
        cache.segmentKeyMap = segmentKeyMap
        cache.segmentLinesMap = segmentLinesMap
      }

      cache.lastRenderAt = now
      cache.revision += 1
      cache.dragSuppressed = dragSuppressed
      graphicCache.__asyraVectorFillCache = cache

      if (
        !dragSuppressed &&
        !shouldRebuild &&
        !shouldSuppressInitialDeferredExactFill &&
        options.allowDeferredFill !== false
      ) {
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
          const {
            flattenedSegments,
            directedSegments,
            segmentKeyMap,
            segmentLinesMap
          } = buildFlattenedSegmentsWithCache(
            orderedNetworks,
            points,
            segments,
            activeCache
          )
          const deferredFaces = buildFillFaces(
            flattenedSegments,
            directedSegments
          )
          activeCache.faces = deferredFaces
          activeCache.lastRebuildAt = getNow()
          activeCache.pendingTimerId = undefined
          activeCache.segmentKeyMap = segmentKeyMap
          activeCache.segmentLinesMap = segmentLinesMap
          renderVectorGraphic(graphic, renderData, { allowDeferredFill: false })
        }, deferredDelay)
      }

      if (fillFaces.length > 0) {
        drawFillFaces(graphic, fillFaces)
        applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
          replayPath: () => drawFillFaces(graphic, fillFaces)
        })
      } else if (hasClosedNetwork) {
        previewFill = true
      }
    }
  } else {
    if (graphicCache.__asyraEvenOddFillCache?.fill) {
      graphicCache.__asyraEvenOddFillCache.fill.dispose()
      graphicCache.__asyraEvenOddFillCache = undefined
    }
    if (graphicCache.__asyraVectorFillCache?.pendingTimerId) {
      clearTimeout(graphicCache.__asyraVectorFillCache.pendingTimerId)
      graphicCache.__asyraVectorFillCache.pendingTimerId = undefined
    }
  }

  applyVectorHoverHitArea()
  applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, strokeFinalFaces)
  applyCenterDashedOverlapDiagnostics(graphic, renderedDashedCenterPackets)
  if (shouldEmitConstrainedDashedRuntimeDiagnostics) {
    setConstrainedDashedRuntimeDiagnostics(
      graphic,
      constrainedDashedRuntimeDiagnostics,
      () =>
        buildConstrainedSolidOwnershipDiagnostics(
          constrainedDashedCandidatePackets
        )
    )
  } else {
    clearConstrainedDashedRuntimeDiagnostics(graphic)
  }
  if (hasConstrainedSolidIntent) {
    setConstrainedSolidRuntimeDiagnostics(
      graphic,
      constrainedSolidRuntimeDiagnostics
    )
  } else {
    clearConstrainedSolidRuntimeDiagnostics(graphic)
  }
  setConstrainedSolidLegalityDiagnostics(graphic, {
    domains: constrainedSolidDiagnostics.flatMap(
      ({ legalityDiagnostics }) => legalityDiagnostics.domains
    ),
    acceptedGeometryIds: constrainedSolidDiagnostics.flatMap(
      ({ legalityDiagnostics }) => legalityDiagnostics.acceptedGeometryIds
    )
  })
  setConstrainedSolidOwnershipDiagnostics(
    graphic,
    shouldBuildGlobalOverlapConstrainedSolid && hasConstrainedSolidIntent
      ? (constrainedSolidDiagnostics.find(
          ({ ownershipDiagnostics }) =>
            ownershipDiagnostics.candidates.length > 0
        )?.ownershipDiagnostics ??
          createEmptyConstrainedSolidOwnershipDiagnostics())
      : mergeConstrainedSolidOwnershipDiagnostics(
          constrainedSolidDiagnostics.map(
            ({ networkId, ownershipDiagnostics }) => ({
              networkId,
              ownershipDiagnostics
            })
          )
        )
  )
  drawVectorPath(graphic, orderedNetworks, points, segments)
  if (previewFill) {
    applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
      replayPath: () =>
        drawVectorPath(graphic, orderedNetworks, points, segments)
    })
  }
  renderSolidCenterStrokeEntries(
    graphic,
    toSolidCenterStrokeRenderEntriesFromFinalFaces(strokeFinalFaces, {
      collapseDashedCenterVisualOverlaps: !shouldDisableVisualOverlapCollapse
    })
  )
}

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  renderVectorGraphic(graphic, data as unknown as VectorComputedData)
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
      name: 'fillRule',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'evenodd'
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
    },
    {
      name: 'strokeDebugOptions',
      type: PropertyTypes.CUSTOM,
      defaultValue: {} as VectorStrokeDebugOptions
    }
  ],
  renderStrategy: vectorRenderStrategy
})
