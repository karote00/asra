import {
  PropertyTypes,
  StrokeJoinTypes,
  createDefaultStroke,
  setElementGeometryLocalBounds
} from '@asyra/utils'
import type { FillAttrs, StrokeAttrs } from '@asyra/utils'
import core, {
  VECTOR_HANDLE_MODES,
  VECTOR_TOKENS,
  defineComponent
} from '@asyra/core'
import type { RenderStrategy } from '@asyra/core'
import type {
  VectorHandleMode,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import {
  DEFAULT_VECTOR_FILLS,
  applyRenderableFill,
  getRenderableFills
} from './fills'
import {
  applyCenterDashedOverlapDiagnostics,
  clearCenterDashedOverlapDiagnostics
} from './stroke-render/center-dashed-overlap-diagnostics'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import {
  clearConstrainedSolidLegalityDiagnostics,
  setConstrainedSolidLegalityDiagnostics
} from './stroke-render/constrained-solid-legality-diagnostics'
import {
  buildConstrainedSolidOwnershipCandidateDiagnostics,
  buildConstrainedSolidOwnershipDiagnostics,
  clearConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics,
  setConstrainedSolidOwnershipDiagnostics,
  type ConstrainedSolidOwnershipDiagnostics
} from './stroke-render/constrained-solid-ownership-diagnostics'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  hasConstrainedDashedStrokeIntent
} from './stroke-render/constrained-dashed-stroke-packets'
import {
  buildArrangedStrokeFinalFacesFromResolvedPackets,
  collapseStrokeFinalFaceVisualOverlaps
} from './stroke-render/stroke-candidate-arrangement'
import {
  getGeometryBackend,
  type PolygonRegion
} from './stroke-render/geometry-backend'
import type { ArrangementLegalDomain } from './stroke-render/arrangement-face-classifier'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from './stroke-render/constrained-solid-stroke-packets'
import {
  getRenderableStrokeDashAndGap,
  getRenderableStrokes,
  normalizeStrokeSpec,
  type RenderableStroke
} from './stroke-render/renderable-stroke'
import {
  buildDashedCenterStrokeResolvedPackets,
  hasDashedCenterStrokeIntent
} from './stroke-render/dashed-center-stroke-packets'
import {
  buildVectorGeometryModelPath,
  type PathGeometryBuildOptions,
  type VectorSegmentGeometryFrameCache
} from './stroke-render/path-geometry'
import { buildCompoundLegalDomainNormalization } from './stroke-render/legal-domain-normalization'
import {
  renderSolidCenterStrokeEntries,
  type SolidCenterStrokeRenderEntry
} from './stroke-render/solid-center-stroke-render'
import { shouldEmitFullStrokeDiagnostics } from './stroke-render/stroke-diagnostics-mode'
import { buildStrokeRuntimeRevisionSet } from './stroke-render/stroke-dirty-keys'
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
import {
  buildResolvedVectorGeometryModel,
  type ResolvedVectorGeometryFrameCache,
  type ResolvedVectorGeometryNetworkModel
} from './stroke-render/resolved-vector-geometry-model'

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
  pointCoordinateSpace?: 'workspace'
  fillRule: PathTopologyFillRule
  fills: FillAttrs[]
  strokes?: StrokeAttrs[]
}

interface CenterPathSolidVisualStrokeGroup {
  network: VectorNetwork
  strokes: RenderableStroke[]
}

interface CenterSolidPathMaskVisualStrokeGroup {
  network: VectorNetwork
  path: VectorPathGeometryModel
  topology: PathTopologyModel
  strokes: RenderableStroke[]
}

const measureVectorRenderPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const toFiniteNumber = (value: unknown, defaultValue = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : defaultValue

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const normalizeRawPathTopologyFillRule = (
  value: unknown
): PathTopologyFillRule =>
  normalizePathTopologyFillRule(
    value === 'evenodd' || value === 'nonzero' ? value : 'nonzero'
  )

const isVectorHandleMode = (value: unknown): value is VectorHandleMode =>
  value === VECTOR_HANDLE_MODES.NONE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE_LENGTH

const normalizeVectorPointNodeMap = (
  value: unknown
): Record<string, VectorPointNode> => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, VectorPointNode>>(
    (result, [defaultId, rawPoint]) => {
      if (!isRecord(rawPoint)) {
        return result
      }

      const id = typeof rawPoint.id === 'string' ? rawPoint.id : defaultId
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

      const anchorPoint: VectorPointNode = {
        id,
        kind,
        x,
        y,
        anchorType: rawPoint.anchorType === 'smooth' ? 'smooth' : 'sharp',
        handleMode: isVectorHandleMode(rawPoint.handleMode)
          ? rawPoint.handleMode
          : VECTOR_HANDLE_MODES.NONE
      }
      result[id] = anchorPoint
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
    (result, [defaultId, rawSegment]) => {
      if (!isRecord(rawSegment)) {
        return result
      }

      const startId = rawSegment.startId
      const endId = rawSegment.endId
      if (typeof startId !== 'string' || typeof endId !== 'string') {
        return result
      }

      const id = typeof rawSegment.id === 'string' ? rawSegment.id : defaultId
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
    (result, [defaultId, rawNetwork]) => {
      if (!isRecord(rawNetwork)) {
        return result
      }

      const id = typeof rawNetwork.id === 'string' ? rawNetwork.id : defaultId
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

const isNormalizedVectorPointNodeMap = (
  value: unknown
): value is Record<string, VectorPointNode> => {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(([defaultId, point]) => {
    if (!isRecord(point)) {
      return false
    }
    const id = typeof point.id === 'string' ? point.id : defaultId
    if (
      point.id !== id ||
      typeof point.x !== 'number' ||
      !Number.isFinite(point.x) ||
      typeof point.y !== 'number' ||
      !Number.isFinite(point.y)
    ) {
      return false
    }

    if (point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR) {
      return (
        (point.anchorType === 'smooth' || point.anchorType === 'sharp') &&
        isVectorHandleMode(point.handleMode)
      )
    }

    return (
      point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL &&
      typeof point.controlForId === 'string' &&
      (point.controlRole === 'in' || point.controlRole === 'out')
    )
  })
}

const isNormalizedVectorSegmentMap = (
  value: unknown,
  points: Record<string, VectorPointNode>
): value is Record<string, VectorSegment> => {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(([defaultId, segment]) => {
    if (!isRecord(segment)) {
      return false
    }
    const id = typeof segment.id === 'string' ? segment.id : defaultId
    return (
      segment.id === id &&
      typeof segment.startId === 'string' &&
      typeof segment.endId === 'string' &&
      !!points[segment.startId] &&
      !!points[segment.endId] &&
      (segment.outControlId === null ||
        (typeof segment.outControlId === 'string' &&
          !!points[segment.outControlId])) &&
      (segment.inControlId === null ||
        (typeof segment.inControlId === 'string' &&
          !!points[segment.inControlId]))
    )
  })
}

const isNormalizedVectorNetworkMap = (
  value: unknown,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): value is Record<string, VectorNetwork> => {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(([defaultId, network]) => {
    if (!isRecord(network)) {
      return false
    }
    const id = typeof network.id === 'string' ? network.id : defaultId
    return (
      network.id === id &&
      Array.isArray(network.pointIds) &&
      network.pointIds.every(
        (pointId) =>
          typeof pointId === 'string' &&
          points[pointId]?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
      ) &&
      Array.isArray(network.segmentIds) &&
      network.segmentIds.every(
        (segmentId) => typeof segmentId === 'string' && !!segments[segmentId]
      ) &&
      typeof network.closed === 'boolean'
    )
  })
}

const toLocalPointNodeMap = (
  points: Record<string, VectorPointNode>,
  offset: { x: number; y: number }
): Record<string, VectorPointNode> =>
  Object.fromEntries(
    Object.entries(points).map(([pointId, point]) => [
      pointId,
      {
        ...point,
        x: point.x - offset.x,
        y: point.y - offset.y
      }
    ])
  )

interface NormalizedVectorRenderDataInput {
  id: string
  x: number
  y: number
  width: number
  height: number
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
  if (!isNormalizedVectorPointNodeMap(points)) {
    return false
  }
  const segments = data.segments
  if (!isNormalizedVectorSegmentMap(segments, points)) {
    return false
  }
  return isNormalizedVectorNetworkMap(data.networks, points, segments)
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
  if (isNormalizedVectorRenderDataInput(data)) {
    emitStrokePipelineCounter('vector-render-normalize-fast-path-hit')
    return {
      ...data,
      points: data.points,
      pointCoordinateSpace: 'workspace',
      fillRule: normalizeRawPathTopologyFillRule(data.fillRule),
      fills: Array.isArray(data.fills) ? data.fills : [],
      strokes: Array.isArray(data.strokes) ? data.strokes : []
    }
  }
  emitStrokePipelineCounter('vector-render-normalize-full-path-count')

  const rawData = isRecord(data) ? data : {}
  const rawX = toFiniteNumber(rawData.x)
  const rawY = toFiniteNumber(rawData.y)
  const rawWidth = Math.max(0, toFiniteNumber(rawData.width))
  const rawHeight = Math.max(0, toFiniteNumber(rawData.height))
  const rawPoints = normalizeVectorPointNodeMap(rawData.points)
  const points = rawPoints
  const segments = normalizeVectorSegmentMap(rawData.segments)

  return {
    id: typeof rawData.id === 'string' ? rawData.id : 'vector:invalid',
    x: rawX,
    y: rawY,
    width: rawWidth,
    height: rawHeight,
    points,
    pointCoordinateSpace: 'workspace',
    segments,
    networks: normalizeVectorNetworkMap(rawData.networks, points, segments),
    closed: rawData.closed === true,
    fillRule: normalizeRawPathTopologyFillRule(rawData.fillRule),
    fills: Array.isArray(rawData.fills) ? rawData.fills : [],
    strokes: Array.isArray(rawData.strokes) ? rawData.strokes : []
  }
}

const getNumericSuffix = (value: string) => {
  const match = value.match(/[-_](\d+)$/)
  if (!match) {
    return Number.NaN
  }

  return Number.parseInt(match[1], 10)
}

type SolidStrokeFinalFaceList = ReturnType<
  typeof buildSolidCenterStrokeFinalFaces
>

interface ConstrainedSolidPromotionResult {
  packets: SolidCenterStrokeResolvedPacket[]
  exactFaces: SolidStrokeFinalFaceList
}

const isExactConstrainedSolidCandidatePacket = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  const debugMeta = packet.geometry.debugMeta

  return (
    debugMeta?.productSignature?.startsWith('constrained-solid:') === true &&
    debugMeta.productMode !== 'center-product' &&
    debugMeta.visualOverlapCollapseStatus !== 'exact-union' &&
    (debugMeta.sourceSpanIds?.length ?? 0) > 0
  )
}

const isSelfIntersectingExactConstrainedSolidCandidatePacket = (
  packet: SolidCenterStrokeResolvedPacket
) =>
  isExactConstrainedSolidCandidatePacket(packet) &&
  packet.geometry.debugMeta?.topologyFamily === 'self-intersecting'

const isAcceptedSelfIntersectingBoundaryDomainSolidPacket = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  const debugMeta = packet.geometry.debugMeta
  if (!debugMeta) {
    return false
  }

  return (
    isSelfIntersectingExactConstrainedSolidCandidatePacket(packet) &&
    debugMeta.domainPlanSideAuthority === 'implicit-fill-hole-domain' &&
    debugMeta.domainPlanBoundaryDomainId !== undefined &&
    (debugMeta.strokePosition === 'inside' ||
      debugMeta.strokePosition === 'outside')
  )
}

const canAcceptSelfIntersectingBoundaryDomainSolidPacketsWithoutLegality = (
  packets: SolidCenterStrokeResolvedPacket[]
) =>
  packets.length > 0 &&
  packets.every(isAcceptedSelfIntersectingBoundaryDomainSolidPacket)

const promoteConstrainedSolidPacketsToExactArrangement = (
  packets: SolidCenterStrokeResolvedPacket[],
  legalDomains: ArrangementLegalDomain[] = []
): ConstrainedSolidPromotionResult => {
  if (packets.length === 0) {
    return { packets: [], exactFaces: [] }
  }
  const hasExactConstrainedCandidates = packets.some(
    isExactConstrainedSolidCandidatePacket
  )
  if (!hasExactConstrainedCandidates && legalDomains.length === 0) {
    return { packets: [], exactFaces: [] }
  }

  const acceptedSelfIntersectingPackets = packets.filter(
    isAcceptedSelfIntersectingBoundaryDomainSolidPacket
  )
  const promotablePackets = packets.filter(
    (packet) => !isAcceptedSelfIntersectingBoundaryDomainSolidPacket(packet)
  )

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.buildArrangement !== true) {
      return { packets: acceptedSelfIntersectingPackets, exactFaces: [] }
    }

    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      promotablePackets,
      {
        backend,
        legalDomains
      }
    )
    if (arrangedFaces.length === 0) {
      return { packets: acceptedSelfIntersectingPackets, exactFaces: [] }
    }

    return {
      packets: acceptedSelfIntersectingPackets,
      exactFaces: arrangedFaces
    }
  } catch {
    return { packets: acceptedSelfIntersectingPackets, exactFaces: [] }
  }
}

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

const formatSourceModelCacheNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(4) : 'NaN'

const buildVectorSourceRevision = (
  vectorId: string,
  fillRule: PathTopologyFillRule,
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  geometryCacheKey: string
): VectorSourceRevision => {
  const counterSink = (
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink
  const start = counterSink ? performance.now() : 0
  const pointEntries = network.pointIds.map((pointId) => {
    const point = points[pointId]
    return point
      ? [
          point.id,
          point.kind,
          formatSourceModelCacheNumber(point.x),
          formatSourceModelCacheNumber(point.y),
          point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
            ? point.anchorType
            : `${point.controlForId}:${point.controlRole}`
        ].join(':')
      : `${pointId}:missing`
  })
  const segmentEntries = network.segmentIds.map((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return `${segmentId}:missing`
    }

    const relatedPointIds = [
      segment.startId,
      segment.endId,
      segment.outControlId,
      segment.inControlId
    ].filter((pointId): pointId is string => !!pointId)
    return [
      segment.id,
      segment.startId,
      segment.endId,
      segment.outControlId ?? 'none',
      segment.inControlId ?? 'none',
      ...relatedPointIds.map((pointId) => {
        const point = points[pointId]
        return point
          ? `${point.id}:${formatSourceModelCacheNumber(point.x)}:${formatSourceModelCacheNumber(point.y)}`
          : `${pointId}:missing`
      })
    ].join(':')
  })

  const key = [
    vectorId,
    fillRule,
    network.id,
    geometryCacheKey,
    network.closed ? 'closed' : 'open',
    pointEntries.join('|'),
    segmentEntries.join('|')
  ].join('||')

  if (counterSink) {
    counterSink('source-revision-key-build-count', 1)
    counterSink(
      'source-revision-key-build-duration-ms',
      performance.now() - start
    )
    counterSink('source-revision-key-point-count', network.pointIds.length)
    counterSink('source-revision-key-segment-count', network.segmentIds.length)
  }

  return {
    key,
    vectorId,
    networkId: network.id,
    fillRule,
    closed: network.closed
  }
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
      revisionSet.strokeFamilyRevision ?? '',
      revisionSet.strokeDomainRevision,
      revisionSet.intervalAllocationRevision,
      revisionSet.dashAndGapRevision ?? '',
      revisionSet.terminalCapRevision ?? '',
      revisionSet.joinShapeRevision ?? '',
      revisionSet.smoothContinuityRevision ?? '',
      revisionSet.productMaterializationRevision ?? '',
      revisionSet.ownershipRevision,
      revisionSet.legalityRevision,
      revisionSet.resolvedRegionRevision ?? '',
      revisionSet.renderOutputRevision ?? ''
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

const getSimpleOpenUnboundedCenterProductStrokes = (
  strokes: StrokeAttrs[] | undefined
): StrokeAttrs[] | undefined =>
  strokes?.map((stroke) =>
    stroke.position === 'inside' || stroke.position === 'outside'
      ? { ...stroke, position: 'center' }
      : stroke
  )

const doesStrokeDebugMetaIncludeNetwork = (
  debugMeta: { networkId?: string; sourceNetworkIds?: string[] } | undefined,
  networkId: string
) => {
  if (!debugMeta) {
    return false
  }
  if (debugMeta.sourceNetworkIds?.length) {
    return debugMeta.sourceNetworkIds.includes(networkId)
  }
  return debugMeta.networkId === networkId
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

type VectorPathGeometryModel = ReturnType<typeof buildVectorGeometryModelPath>

interface VectorNetworkPathModel {
  network: VectorNetwork
  path: VectorPathGeometryModel
  topology: PathTopologyModel
  sourceRevision: VectorSourceRevision
}

interface VectorSourceRevision {
  key: string
  vectorId: string
  networkId: string
  fillRule: PathTopologyFillRule
  closed: boolean
}

interface VectorPathModelCache {
  entries: Map<
    string,
    { revision: VectorSourceRevision; model: VectorNetworkPathModel }
  >
  segmentFrames: Map<string, VectorSegmentGeometryFrameCache>
}

interface StrokePipelineStageProductCache {
  geometrySignature: string | null
  finalFaces: SolidStrokeFinalFaceList
  renderEntries: SolidCenterStrokeRenderEntry[]
}

interface StrokePipelineStageCache {
  products: Map<string, StrokePipelineStageProductCache>
}

const countCenterSolidPathMaskRenderEntries = (
  entries: SolidCenterStrokeRenderEntry[]
) =>
  entries.filter(
    (entry) =>
      entry.debugMeta?.productMode === 'center-product' &&
      entry.debugMeta?.productSignature === 'center-product:solid-path-mask' &&
      entry.strokePaths !== undefined &&
      entry.strokePaths.length > 0
  ).length

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
const FINAL_PATH_GEOMETRY_OPTIONS: PathGeometryBuildOptions = {
  sampleOptions: {
    minCubicSamples: 12,
    maxCubicSamples: 160,
    useRangeLengthForSampleCount: true
  }
}
const FINAL_PATH_GEOMETRY_CACHE_KEY = 'final:v2:12:160:range'

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

const drawCenterPathSolidStrokePath = (
  graphic: Parameters<RenderStrategy>[0],
  networks: VectorNetwork[],
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>,
  stroke: RenderableStroke
) => {
  networks.forEach((network) =>
    drawVectorNetworkPath(graphic, network, points, segments)
  )
  ;(
    graphic as {
      stroke?: (style: {
        width: number
        color: number
        alpha: number
        join: RenderableStroke['join']
        cap: RenderableStroke['cap']
        miterLimit: number
      }) => unknown
    }
  ).stroke?.({
    width: stroke.width,
    color: stroke.color,
    alpha: stroke.alpha,
    join: stroke.join,
    cap: stroke.cap,
    miterLimit: stroke.miterLimit
  })
}

const isCenterSolidVisualStroke = (stroke: RenderableStroke) =>
  stroke.style === 'solid' &&
  stroke.position === 'center' &&
  stroke.kind === 'solid' &&
  stroke.width > 0

const isSelfIntersectingCenterSolidTopology = (topology: PathTopologyModel) =>
  topology.topologyFamily === 'self-intersecting'

const isAlphaSafeCenterPathSolidStroke = (
  stroke: RenderableStroke,
  topology: PathTopologyModel
) =>
  stroke.alpha >= 0.999 ||
  (topology.closed && topology.topologyFamily !== 'self-intersecting')

const isCenterPathSolidVisualStroke = (
  stroke: RenderableStroke,
  topology: PathTopologyModel
) =>
  isSelfIntersectingCenterSolidTopology(topology) &&
  isCenterSolidVisualStroke(stroke) &&
  isAlphaSafeCenterPathSolidStroke(stroke, topology)

const shouldRenderCenterSolidWithPathMask = (
  stroke: RenderableStroke,
  topology: PathTopologyModel
) =>
  isCenterSolidVisualStroke(stroke) &&
  !isAlphaSafeCenterPathSolidStroke(stroke, topology) &&
  (isSelfIntersectingCenterSolidTopology(topology) || !topology.closed)

const isCenterDashedProductStroke = (stroke: RenderableStroke) =>
  stroke.style === 'dashed' &&
  stroke.position === 'center' &&
  stroke.kind === 'solid' &&
  stroke.width > 0 &&
  getRenderableStrokeDashAndGap(stroke) !== null

const buildBoundsPolygon = (
  bounds: ReturnType<typeof getPointBounds>,
  padding: number
) => [
  { x: bounds.minX - padding, y: bounds.minY - padding },
  { x: bounds.maxX + padding, y: bounds.minY - padding },
  { x: bounds.maxX + padding, y: bounds.maxY + padding },
  { x: bounds.minX - padding, y: bounds.maxY + padding }
]

const buildCenterSolidPathMaskRenderEntry = (
  vectorId: string,
  group: CenterSolidPathMaskVisualStrokeGroup,
  stroke: RenderableStroke
): SolidCenterStrokeRenderEntry | null => {
  const strokePath = group.path.sampledPoints
  if (strokePath.length < 2) {
    return null
  }

  const bounds = getPointBounds(strokePath)
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return null
  }

  const padding = Math.max(1, stroke.width * Math.max(2, stroke.miterLimit))
  const productSignature = 'center-product:solid-path-mask'

  return {
    cacheKey: `vector:${vectorId}:${group.network.id}:center:path-mask:${stroke.paintKey ?? 'solid'}`,
    stroke: {
      kind: stroke.kind,
      color: stroke.color,
      alpha: stroke.alpha,
      gradientStyle: stroke.gradientStyle,
      paintKey: stroke.paintKey
    },
    polygons: [buildBoundsPolygon(bounds, padding)],
    strokePaths: [strokePath],
    strokePathStyle: {
      width: stroke.width,
      cap: stroke.cap,
      join: stroke.join,
      miterLimit: stroke.miterLimit,
      closed: group.network.closed
    },
    debugMeta: {
      productMode: 'center-product',
      productSignature,
      domainMode: 'center-product',
      topologyFamily: group.topology.topologyFamily,
      strokePosition: 'center',
      visualOverlapCollapseStatus: 'exact-union'
    },
    revisionSet: buildStrokeRuntimeRevisionSet({
      points: strokePath,
      closed: group.network.closed,
      stroke,
      productMode: 'center-product',
      domainMode: 'center-product',
      networkId: group.network.id,
      strokeProductSignature: productSignature
    })
  }
}

const getSingleSolidStyleRenderableStroke = (
  strokes: StrokeAttrs[] | undefined
) => {
  const renderableStrokes = getRenderableStrokes(strokes)
  if (renderableStrokes.length !== 1) {
    return null
  }

  const [stroke] = renderableStrokes
  return stroke.kind === 'solid' ? stroke : null
}

const buildStrokeProductGeometrySignature = (
  vectorId: string,
  networkPaths: VectorNetworkPathModel[],
  stroke: RenderableStroke | null
) => {
  if (!stroke) {
    return null
  }

  return [
    'stroke-product-geometry',
    vectorId,
    networkPaths
      .map(({ network, sourceRevision }) =>
        [network.id, sourceRevision.key].join('=')
      )
      .join('|'),
    stroke.kind,
    stroke.style,
    stroke.position,
    stroke.width.toFixed(4),
    stroke.cap,
    stroke.join,
    stroke.miterLimit.toFixed(4),
    [stroke.dash, stroke.gap].map((value) => value.toFixed(4)).join(',')
  ].join('||')
}

const getStrokePaintKey = (stroke: RenderableStroke) =>
  stroke.paintKey ?? `solid:${stroke.color}:${stroke.alpha}`

const restyleStrokePathStyle = (
  style:
    | (Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'> & {
        closed?: boolean
      })
    | undefined,
  stroke: RenderableStroke
) =>
  style
    ? {
        ...style,
        cap: stroke.cap,
        join: stroke.join,
        miterLimit: stroke.miterLimit
      }
    : style

const restyleStrokeRenderDescriptor = (
  descriptor: unknown,
  stroke: RenderableStroke
) => {
  if (!descriptor || typeof descriptor !== 'object') {
    return descriptor
  }

  const typedDescriptor = descriptor as {
    strokePathStyle?: Parameters<typeof restyleStrokePathStyle>[0]
    strokePathGroups?: {
      strokePaths: Vec2[][]
      strokePathStyle?: Parameters<typeof restyleStrokePathStyle>[0]
    }[]
  }

  return {
    ...typedDescriptor,
    strokePathStyle: restyleStrokePathStyle(
      typedDescriptor.strokePathStyle,
      stroke
    ),
    strokePathGroups: typedDescriptor.strokePathGroups?.map((group) => ({
      ...group,
      strokePathStyle: restyleStrokePathStyle(group.strokePathStyle, stroke)
    }))
  }
}

const retintStrokeFinalFaces = (
  faces: SolidStrokeFinalFaceList,
  stroke: RenderableStroke
): SolidStrokeFinalFaceList =>
  faces.map((face) => ({
    ...face,
    paintKey: getStrokePaintKey(stroke),
    renderDescriptor: restyleStrokeRenderDescriptor(
      face.renderDescriptor,
      stroke
    ),
    paint: {
      ...face.paint,
      kind: stroke.kind,
      color: stroke.color,
      alpha: stroke.alpha,
      gradientStyle: stroke.gradientStyle,
      paintKey: getStrokePaintKey(stroke)
    }
  }))

const retintStrokeRenderEntries = (
  entries: SolidCenterStrokeRenderEntry[],
  stroke: RenderableStroke
): SolidCenterStrokeRenderEntry[] =>
  entries.map((entry) => ({
    ...entry,
    stroke: {
      kind: stroke.kind,
      color: stroke.color,
      alpha: stroke.alpha,
      gradientStyle: stroke.gradientStyle,
      paintKey: getStrokePaintKey(stroke)
    },
    strokePathStyle: restyleStrokePathStyle(entry.strokePathStyle, stroke),
    strokePathGroups: entry.strokePathGroups?.map((group) => ({
      ...group,
      strokePathStyle: restyleStrokePathStyle(group.strokePathStyle, stroke)
    }))
  }))

const shouldRenderCenterSolidFaceWithNativeVisual = (
  face: SolidStrokeFinalFaceList[number]
) =>
  face.debugMeta?.productMode === 'center-product' &&
  face.debugMeta?.productSignature === 'center-product:solid' &&
  face.paint.kind === 'solid'

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

const renderVectorGraphic = (
  graphic: Parameters<RenderStrategy>[0],
  data: unknown
) => {
  emitStrokePipelineCounter('vector-render-normalize-data-count')
  const renderData = measureVectorRenderPhase('normalize render data', () =>
    normalizeVectorRenderData(data)
  )
  ;(
    graphic as typeof graphic & {
      __asyraVectorRenderRouteTrace?: {
        id: string
        type: string
        rawNetworkCount: number
        rawStrokeCount: number
        normalized: true
      }
    }
  ).__asyraVectorRenderRouteTrace = {
    id: renderData.id,
    type: 'vector',
    rawNetworkCount:
      renderData.networks && typeof renderData.networks === 'object'
        ? Object.keys(renderData.networks).length
        : 0,
    rawStrokeCount: Array.isArray(renderData.strokes)
      ? renderData.strokes.length
      : 0,
    normalized: true
  }
  const graphicCache = graphic as typeof graphic & {
    __asyraVectorFillCache?: FillFaceCache
    __asyraEvenOddFillCache?: EvenOddFillCache
    __asyraVectorHitCache?: VectorHitCache
    __asyraVectorPathModelCache?: VectorPathModelCache
    __asyraResolvedVectorGeometryCache?: ResolvedVectorGeometryFrameCache
    __asyraStrokePipelineStageCache?: StrokePipelineStageCache
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

  const {
    fills,
    x,
    y,
    points: workspacePoints,
    segments,
    networks
  } = renderData
  const points = toLocalPointNodeMap(workspacePoints, { x, y })

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
    ;(
      graphic as typeof graphic & {
        __asyraCenterPathSolidStrokeRenderCount?: number
      }
    ).__asyraCenterPathSolidStrokeRenderCount = 0
    ;(
      graphic as typeof graphic & {
        __asyraCenterSolidPathMaskRenderCount?: number
      }
    ).__asyraCenterSolidPathMaskRenderCount = 0
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
  const hasRenderableFill = getRenderableFills(fillPayload).length > 0
  const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)
  const renderableStrokesForVisibility = normalizedStrokeSpec.strokes
  ;(
    graphic as typeof graphic & {
      __asyraVectorRenderableStrokeSnapshot?: {
        rawStrokeCount: number
        renderableStrokeCount: number
        diagnosticReasons: string[]
        paintKey: string | null
        color: number | null
        alpha: number | null
      }
    }
  ).__asyraVectorRenderableStrokeSnapshot = {
    rawStrokeCount: Array.isArray(renderData.strokes)
      ? renderData.strokes.length
      : 0,
    renderableStrokeCount: normalizedStrokeSpec.strokes.length,
    diagnosticReasons: normalizedStrokeSpec.diagnostics.map(
      (diagnostic) => diagnostic.reason
    ),
    paintKey: null,
    color: null,
    alpha: null
  }
  const shouldAttachFullStrokeDiagnostics = shouldEmitFullStrokeDiagnostics()
  if (!hasRenderableFill && renderableStrokesForVisibility.length === 0) {
    emitStrokePipelineCounter('stroke-stage-cache:render-output-hidden')
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
    clearCenterDashedOverlapDiagnostics(graphic)
    clearConstrainedSolidLegalityDiagnostics(graphic)
    clearConstrainedSolidOwnershipDiagnostics(graphic)
    ;(
      graphic as typeof graphic & {
        __asyraCenterPathSolidStrokeRenderCount?: number
      }
    ).__asyraCenterPathSolidStrokeRenderCount = 0
    emitStrokePipelineCounter('center-product-solid-stroke-render-count', 0)
    ;(
      graphic as typeof graphic & {
        __asyraCenterSolidPathMaskRenderCount?: number
      }
    ).__asyraCenterSolidPathMaskRenderCount = 0
    emitStrokePipelineCounter('path-mask-center-solid-stroke-render-count', 0)
    applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, [])
    renderSolidCenterStrokeEntries(graphic, [])
    return
  }
  let previewFill = false

  const hasClosedNetwork =
    renderData.closed === true ||
    orderedNetworks.some(
      (network) => network.closed && network.pointIds.length > 2
    )

  const hasGradient = fillPayload.some((f) => f.kind === 'gradient')
  let evenOddShapeCache: EvenOddShape | null = null
  const getEvenOddShape = () => {
    if (!evenOddShapeCache) {
      evenOddShapeCache = buildEvenOddShape(orderedNetworks, points, segments)
    }
    return evenOddShapeCache
  }

  const pathModelCache = graphicCache.__asyraVectorPathModelCache ?? {
    entries: new Map<
      string,
      { revision: VectorSourceRevision; model: VectorNetworkPathModel }
    >(),
    segmentFrames: new Map<string, VectorSegmentGeometryFrameCache>()
  }
  pathModelCache.segmentFrames ??= new Map<
    string,
    VectorSegmentGeometryFrameCache
  >()
  const pathGeometryOptions = FINAL_PATH_GEOMETRY_OPTIONS
  const pathGeometryCacheKey = FINAL_PATH_GEOMETRY_CACHE_KEY
  const usedPathModelCacheKeys = new Set<string>()
  const networkPaths = measureVectorRenderPhase('path/topology', () =>
    orderedNetworks.map((network) => {
      const sourceRevision = buildVectorSourceRevision(
        renderData.id,
        renderData.fillRule,
        network,
        points,
        segments,
        pathGeometryCacheKey
      )
      const cached = pathModelCache.entries.get(network.id)
      if (cached?.revision.key === sourceRevision.key) {
        usedPathModelCacheKeys.add(network.id)
        return cached.model
      }

      const segmentFrameCache = pathModelCache.segmentFrames.get(
        network.id
      ) ?? { entries: new Map() }
      const path = measureVectorRenderPhase('path/topology: geometry', () =>
        buildVectorGeometryModelPath(
          network,
          points,
          segments,
          segmentFrameCache,
          pathGeometryOptions
        )
      )
      pathModelCache.segmentFrames.set(network.id, segmentFrameCache)
      const topology = measureVectorRenderPhase('path/topology: topology', () =>
        buildPathTopologyModel({
          pathId: `vector:${renderData.id}:${network.id}`,
          sourceId: `vector:${renderData.id}`,
          networkId: network.id,
          sourceRevision: sourceRevision.key,
          sourceFamily: 'vector',
          fillRule: renderData.fillRule,
          points: path.sampledPoints,
          closed: path.closed
        })
      )
      const model = {
        network,
        path,
        topology,
        sourceRevision
      }
      pathModelCache.entries.set(network.id, {
        revision: sourceRevision,
        model
      })
      usedPathModelCacheKeys.add(network.id)
      return model
    })
  )
  Array.from(pathModelCache.entries.keys()).forEach((networkId) => {
    if (!usedPathModelCacheKeys.has(networkId)) {
      pathModelCache.entries.delete(networkId)
      pathModelCache.segmentFrames.delete(networkId)
    }
  })
  graphicCache.__asyraVectorPathModelCache = pathModelCache
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
  const hasConstrainedDashedIntent =
    networkPaths.length > 0 &&
    hasConstrainedDashedStrokeIntent(renderData.strokes)
  const hasConstrainedSolidIntent = networkPaths.some(
    ({ topology }) =>
      topology.closed && hasConstrainedSolidStrokeIntent(renderData.strokes)
  )
  const hasOnlyCenterDashedProductStrokes = (() => {
    const strokes = getRenderableStrokes(renderData.strokes)
    return (
      networkPaths.length > 0 &&
      strokes.length > 0 &&
      strokes.every(isCenterDashedProductStroke)
    )
  })()
  const canUseFillOnlyResolvedGeometryForInsideDashedProduct = false
  const singleSolidRenderableStroke = getSingleSolidStyleRenderableStroke(
    renderData.strokes
  )
  ;(
    graphic as typeof graphic & {
      __asyraVectorRenderableStrokeSnapshot?: {
        rawStrokeCount: number
        renderableStrokeCount: number
        diagnosticReasons: string[]
        paintKey: string | null
        color: number | null
        alpha: number | null
      }
    }
  ).__asyraVectorRenderableStrokeSnapshot = {
    rawStrokeCount: Array.isArray(renderData.strokes)
      ? renderData.strokes.length
      : 0,
    renderableStrokeCount: normalizedStrokeSpec.strokes.length,
    diagnosticReasons: normalizedStrokeSpec.diagnostics.map(
      (diagnostic) => diagnostic.reason
    ),
    paintKey: singleSolidRenderableStroke
      ? getStrokePaintKey(singleSolidRenderableStroke)
      : null,
    color: singleSolidRenderableStroke?.color ?? null,
    alpha: singleSolidRenderableStroke?.alpha ?? null
  }
  const strokeProductGeometrySignature = buildStrokeProductGeometrySignature(
    renderData.id,
    networkPaths,
    singleSolidRenderableStroke
  )
  const canUseStrokeProductGeometryCache = true
  const stageCache = graphicCache.__asyraStrokePipelineStageCache ?? {
    products: new Map<string, StrokePipelineStageProductCache>()
  }
  const cachedProduct =
    canUseStrokeProductGeometryCache && strokeProductGeometrySignature !== null
      ? stageCache.products.get(strokeProductGeometrySignature)
      : undefined
  const hasCachedProduct =
    cachedProduct !== undefined && cachedProduct.renderEntries.length > 0

  if (
    !shouldAttachFullStrokeDiagnostics &&
    fillPayload.length === 0 &&
    singleSolidRenderableStroke &&
    cachedProduct &&
    hasCachedProduct
  ) {
    emitStrokePipelineCounter('stroke-stage-cache:product-geometry-hit')
    const cachedFaces = retintStrokeFinalFaces(
      cachedProduct.finalFaces,
      singleSolidRenderableStroke
    )
    const cachedRenderEntries = retintStrokeRenderEntries(
      cachedProduct.renderEntries,
      singleSolidRenderableStroke
    )
    measureVectorRenderPhase('hit area', () => {
      ;(
        graphic as {
          hitArea: { contains: (x: number, y: number) => boolean } | null
        }
      ).hitArea =
        createSolidCenterStrokeHitAreaFromFinalFaces(cachedFaces) ?? null
    })
    measureVectorRenderPhase('export packets', () =>
      applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, cachedFaces)
    )
    clearCenterDashedOverlapDiagnostics(graphic)
    clearConstrainedSolidLegalityDiagnostics(graphic)
    clearConstrainedSolidOwnershipDiagnostics(graphic)
    ;(
      graphic as typeof graphic & {
        __asyraConstrainedDashedProductNetworkIds?: string[]
      }
    ).__asyraConstrainedDashedProductNetworkIds = Array.from(
      new Set([
        ...cachedFaces.flatMap((face) => {
          if (
            face.debugMeta?.productSignature?.startsWith(
              'constrained-dashed:'
            ) !== true
          ) {
            return []
          }
          if (
            face.debugMeta.sourceNetworkIds &&
            face.debugMeta.sourceNetworkIds.length > 0
          ) {
            return face.debugMeta.sourceNetworkIds
          }
          const networkId = face.debugMeta.networkId
          return typeof networkId === 'string' ? [networkId] : []
        })
      ])
    )
    ;(
      graphic as typeof graphic & {
        __asyraStrokeRenderFaceDebugMetas?: SolidCenterStrokeRenderEntry['debugMeta'][]
      }
    ).__asyraStrokeRenderFaceDebugMetas = cachedFaces
      .map((face) => face.debugMeta)
      .filter((debugMeta) => debugMeta !== undefined)
    ;(
      graphic as typeof graphic & {
        __asyraStrokeRenderEntries?: SolidCenterStrokeRenderEntry[]
      }
    ).__asyraStrokeRenderEntries = cachedRenderEntries
    ;(
      graphic as typeof graphic & {
        __asyraCenterPathSolidStrokeRenderCount?: number
      }
    ).__asyraCenterPathSolidStrokeRenderCount = 0
    emitStrokePipelineCounter('center-product-solid-stroke-render-count', 0)
    const cachedCenterSolidPathMaskRenderCount =
      countCenterSolidPathMaskRenderEntries(cachedRenderEntries)
    ;(
      graphic as typeof graphic & {
        __asyraCenterSolidPathMaskRenderCount?: number
      }
    ).__asyraCenterSolidPathMaskRenderCount =
      cachedCenterSolidPathMaskRenderCount
    emitStrokePipelineCounter(
      'path-mask-center-solid-stroke-render-count',
      cachedCenterSolidPathMaskRenderCount
    )
    measureVectorRenderPhase('mesh render', () =>
      renderSolidCenterStrokeEntries(graphic, cachedRenderEntries)
    )
    graphicCache.__asyraStrokePipelineStageCache = stageCache
    return
  }
  emitStrokePipelineCounter(
    stageCache.products.size > 0
      ? 'stroke-stage-cache:product-geometry-miss'
      : 'stroke-stage-cache:product-geometry-primed'
  )
  const canSkipResolvedGeometryForCenterDashedProduct =
    hasOnlyCenterDashedProductStrokes &&
    !hasConstrainedDashedIntent &&
    !hasConstrainedSolidIntent
  if (canSkipResolvedGeometryForCenterDashedProduct) {
    emitStrokePipelineCounter('center-dashed-product-resolved-geometry-skip')
  }
  const needsResolvedGeometryModel =
    (hasRenderableFill && !canSkipResolvedGeometryForCenterDashedProduct) ||
    hasConstrainedDashedIntent ||
    hasConstrainedSolidIntent
  const resolvedGeometryModel = measureVectorRenderPhase(
    'resolved vector geometry model',
    () =>
      buildResolvedVectorGeometryModel({
        modelId: `vector:${renderData.id}:resolved-geometry`,
        fillRule: renderData.fillRule,
        networks: networkPaths.map(({ network, path, topology }) => ({
          networkId: network.id,
          path,
          topology
        })),
        resolveSelfIntersecting: needsResolvedGeometryModel,
        previousCache: graphicCache.__asyraResolvedVectorGeometryCache,
        detailMode: canUseFillOnlyResolvedGeometryForInsideDashedProduct
          ? 'fill-only'
          : 'full'
      })
  )
  graphicCache.__asyraResolvedVectorGeometryCache = resolvedGeometryModel.cache
  const resolvedGeometryByNetworkId = new Map<
    string,
    ResolvedVectorGeometryNetworkModel
  >(
    resolvedGeometryModel.networks.map((networkGeometry) => [
      networkGeometry.networkId,
      networkGeometry
    ])
  )
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
        backend.capabilities.intersection === true
        ? backend
        : null
    } catch {
      return null
    }
  })()
  const compoundLegalDomainNormalization =
    closedNetworkPaths.length >= 2
      ? buildCompoundLegalDomainNormalization(
          closedNetworkPaths.map(({ topology }) => topology),
          {
            legalDomainId: `vector:${renderData.id}:compound-legal-domain:0`,
            backend: legalDomainBackend ?? undefined,
            allowBackendNormalization: !!legalDomainBackend
          }
        )
      : null
  const compoundLegalDomainClassifications =
    compoundLegalDomainNormalization?.status === 'normalized'
      ? compoundLegalDomainNormalization.legalDomain.classifications
      : []
  const hasCompoundLegalDomain =
    compoundLegalDomainNormalization?.status === 'normalized' &&
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
  const getStrokesForNetwork = (network: VectorNetwork) => {
    const compoundRole = compoundRoleByNetworkId.get(network.id)
    return invertConstrainedStrokePositionForHole(
      renderData.strokes,
      compoundRole?.role
    )
  }
  const getImplicitFillRegionsForNetwork = (
    topology: PathTopologyModel,
    resolvedSelfIntersectingGeometry:
      | ResolvedVectorGeometryNetworkModel['selfIntersecting']
      | undefined
  ): PolygonRegion[] => {
    if ((resolvedSelfIntersectingGeometry?.fillRegions.length ?? 0) > 0) {
      return resolvedSelfIntersectingGeometry?.fillRegions ?? []
    }

    if (!hasRenderableFill || !topology.closed) {
      return []
    }

    return [
      {
        polygons: [topology.normalizedPoints]
      }
    ]
  }
  const hasOpenBoundedFilledRegionDomain = (network: VectorNetwork) =>
    (resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting?.fillRegions
      .length ?? 0) > 0
  const hasConstrainedDashedStrokeForNetwork = (network: VectorNetwork) =>
    getRenderableStrokes(getStrokesForNetwork(network)).some(
      (stroke) =>
        stroke.style === 'dashed' &&
        (stroke.position === 'inside' || stroke.position === 'outside') &&
        stroke.width > 0
    )
  let arrangementLegalDomainsCache: ArrangementLegalDomain[] | null = null
  const getArrangementLegalDomains = (): ArrangementLegalDomain[] => {
    if (arrangementLegalDomainsCache) {
      return arrangementLegalDomainsCache
    }

    arrangementLegalDomainsCache = measureVectorRenderPhase(
      'legal domains',
      () =>
        compoundLegalDomainNormalization?.status === 'normalized'
          ? [
              {
                legalDomainId:
                  compoundLegalDomainNormalization.legalDomain.legalDomainId,
                fillRule: compoundLegalDomainNormalization.legalDomain.fillRule,
                regions: compoundLegalDomainNormalization.legalDomain.regions
              }
            ]
          : closedNetworkPaths.map(({ network, path, topology }) => {
              const selfIntersectingRegions =
                resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting
                  ?.fillRegions ?? []

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
    )
    return arrangementLegalDomainsCache
  }
  const hasSourceBoundsOverlap =
    hasOverlappingNetworkSourceBounds(closedNetworkPaths)
  const shouldBuildGlobalOverlapConstrainedSolid =
    hasSourceBoundsOverlap && !hasCompoundLegalDomain
  const constrainedDashedPacketNetworkPaths = networkPaths.filter(
    ({ network }) => hasConstrainedDashedStrokeForNetwork(network)
  )
  const shouldBuildConstrainedDashedPacketRoute =
    constrainedDashedPacketNetworkPaths.length > 0
  const constrainedDashedCandidatePackets = measureVectorRenderPhase(
    'constrained dashed packets',
    () =>
      shouldBuildConstrainedDashedPacketRoute
        ? networkPaths.flatMap(({ network, path, topology }) => {
            if (!hasConstrainedDashedStrokeForNetwork(network)) {
              return []
            }
            const compoundRole = compoundRoleByNetworkId.get(network.id)
            const strokesForNetwork = getStrokesForNetwork(network)
            const resolvedSelfIntersectingGeometry =
              resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting
            const sourcePathForNetwork = path
            const hasOpenBoundedFillRegionDomain =
              hasOpenBoundedFilledRegionDomain(network)
            const implicitFillRegionsForNetwork =
              getImplicitFillRegionsForNetwork(
                topology,
                resolvedSelfIntersectingGeometry
              )
            const clipInsideToFillDomain =
              hasRenderableFill ||
              hasOpenBoundedFillRegionDomain ||
              implicitFillRegionsForNetwork.length > 0
            const dashedOptions: Parameters<
              typeof buildConstrainedDashedStrokeResolvedPackets
            >[4] = {
              metadata: {
                ownerKeyPrefix: compoundLegalDomainId
                  ? `vector:${renderData.id}:compound`
                  : `vector:${renderData.id}:${network.id}`,
                networkId: network.id,
                sourceNetworkIds: [network.id],
                contourId: compoundRole?.contourId,
                legalDomainId:
                  compoundLegalDomainId ?? compoundRole?.legalDomainId
              },
              topology,
              sourcePath: sourcePathForNetwork,
              implicitFillRegions: implicitFillRegionsForNetwork,
              sharedSourceSplitRanges:
                resolvedSelfIntersectingGeometry?.sourceSplitRanges ?? [],
              sharedStrokeBoundaryDomains:
                resolvedSelfIntersectingGeometry?.strokeBoundaryDomains ?? [],
              selectedSideGuardPoints: getNetworkAnchorGuardPoints(
                network,
                points
              ),
              clipInsideToFillDomain: clipInsideToFillDomain
            }
            return buildConstrainedDashedStrokeResolvedPackets(
              `vector:${renderData.id}:${network.id}:constrained-dashed`,
              topology.normalizedPoints,
              topology.closed,
              strokesForNetwork,
              dashedOptions
            )
          })
        : []
  )
  const shouldPreferConstrainedSolidRenderMaskProductFinal = true
  const getConstrainedSolidCandidateMode = (_topology: PathTopologyModel) =>
    'exact-arrangement' as const
  const constrainedSolidDiagnostics = measureVectorRenderPhase(
    'constrained solid diagnostics',
    () => {
      if (!hasConstrainedSolidIntent) {
        return networkPaths.map(({ network, topology }) => ({
          networkId: network.id,
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule,
          packets: [],
          legalityDiagnostics: { domains: [], acceptedGeometryIds: [] },
          ownershipDiagnostics:
            createEmptyConstrainedSolidOwnershipDiagnostics()
        }))
      }

      if (shouldBuildGlobalOverlapConstrainedSolid) {
        const candidatePackets = networkPaths.flatMap(
          ({ network, path, topology }) => {
            if (!topology.closed) {
              return []
            }
            const resolvedSelfIntersectingGeometry =
              resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting
            return buildConstrainedSolidStrokeResolvedPackets(
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
                implicitFillRegions:
                  resolvedSelfIntersectingGeometry?.fillRegions ?? [],
                implicitLegalFaceBoundaries:
                  resolvedSelfIntersectingGeometry?.legalFaceBoundaries ?? [],
                implicitUnfilledFaceBoundaries:
                  resolvedSelfIntersectingGeometry?.unfilledFaceBoundaries ??
                  [],
                implicitLegalBoundaryContours:
                  resolvedSelfIntersectingGeometry?.legalBoundaryContours ?? [],
                sharedSourceSplitRanges:
                  resolvedSelfIntersectingGeometry?.sourceSplitRanges ?? [],
                sharedStrokeBoundaryDomains:
                  resolvedSelfIntersectingGeometry?.strokeBoundaryDomains ?? [],
                selectedSideGuardPoints: getNetworkAnchorGuardPoints(
                  network,
                  points
                ),
                exactBackend: constrainedSolidExactBackend ?? undefined,
                fillRule: topology.fillRule,
                candidateMode: getConstrainedSolidCandidateMode(topology),
                preferRenderMaskProductFinal:
                  shouldPreferConstrainedSolidRenderMaskProductFinal
              }
            )
          }
        )
        const result = buildConstrainedSolidLegalityClippingResult(
          closedNetworkPaths.map(({ topology }) => ({
            points: topology.normalizedPoints,
            closed: topology.closed,
            fillRule: topology.fillRule
          })),
          renderData.strokes,
          candidatePackets
        )

        return networkPaths.map(({ network, topology }, index) => ({
          networkId: network.id,
          points: topology.normalizedPoints,
          closed: topology.closed,
          fillRule: topology.fillRule,
          packets: result.packets.filter((packet) =>
            doesStrokeDebugMetaIncludeNetwork(
              packet.geometry.debugMeta,
              network.id
            )
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
        const resolvedSelfIntersectingGeometry =
          resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting
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
              legalDomainId:
                compoundLegalDomainId ?? compoundRole?.legalDomainId
            },
            topology,
            sourcePath: path,
            implicitFillRegions:
              resolvedSelfIntersectingGeometry?.fillRegions ?? [],
            implicitLegalFaceBoundaries:
              resolvedSelfIntersectingGeometry?.legalFaceBoundaries ?? [],
            implicitUnfilledFaceBoundaries:
              resolvedSelfIntersectingGeometry?.unfilledFaceBoundaries ?? [],
            implicitLegalBoundaryContours:
              resolvedSelfIntersectingGeometry?.legalBoundaryContours ?? [],
            sharedSourceSplitRanges:
              resolvedSelfIntersectingGeometry?.sourceSplitRanges ?? [],
            sharedStrokeBoundaryDomains:
              resolvedSelfIntersectingGeometry?.strokeBoundaryDomains ?? [],
            selectedSideGuardPoints: getNetworkAnchorGuardPoints(
              network,
              points
            ),
            exactBackend: constrainedSolidExactBackend ?? undefined,
            fillRule: topology.fillRule,
            candidateMode: getConstrainedSolidCandidateMode(topology),
            preferRenderMaskProductFinal:
              shouldPreferConstrainedSolidRenderMaskProductFinal
          }
        )

        if (
          canAcceptSelfIntersectingBoundaryDomainSolidPacketsWithoutLegality(
            candidatePackets
          )
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
            ownershipDiagnostics: shouldAttachFullStrokeDiagnostics
              ? buildConstrainedSolidOwnershipCandidateDiagnostics(
                  candidatePackets
                )
              : createEmptyConstrainedSolidOwnershipDiagnostics()
          }
        }

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
            ownershipDiagnostics: shouldAttachFullStrokeDiagnostics
              ? buildConstrainedSolidOwnershipDiagnostics(candidatePackets)
              : createEmptyConstrainedSolidOwnershipDiagnostics()
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
          candidatePackets
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
    }
  )

  const constrainedSolidExactCandidatePackets =
    constrainedSolidDiagnostics.flatMap((entry) =>
      entry.packets.filter(isExactConstrainedSolidCandidatePacket)
    )
  const constrainedSolidPromotion =
    promoteConstrainedSolidPacketsToExactArrangement(
      constrainedSolidExactCandidatePackets,
      constrainedSolidExactCandidatePackets.length > 0
        ? getArrangementLegalDomains()
        : []
    )
  const constrainedSolidPromotedCandidateGeometryIds = new Set(
    constrainedSolidExactCandidatePackets.map(
      (packet) => packet.geometry.geometryId
    )
  )

  const getCenterFamilyStrokesForNetwork = (
    network: VectorNetwork,
    topology: PathTopologyModel
  ) =>
    !topology.closed && !hasConstrainedDashedStrokeForNetwork(network)
      ? getSimpleOpenUnboundedCenterProductStrokes(renderData.strokes)
      : renderData.strokes
  const centerPathSolidVisualStrokeGroups: CenterPathSolidVisualStrokeGroup[] =
    networkPaths.flatMap(({ network, topology }) => {
      const renderStrokesForNetwork = getCenterFamilyStrokesForNetwork(
        network,
        topology
      )
      const strokes = getRenderableStrokes(renderStrokesForNetwork).filter(
        (stroke) => isCenterPathSolidVisualStroke(stroke, topology)
      )
      return strokes.length > 0 ? [{ network, strokes }] : []
    })
  const centerSolidPathMaskVisualStrokeGroups: CenterSolidPathMaskVisualStrokeGroup[] =
    networkPaths.flatMap(({ network, path, topology }) => {
      const renderStrokesForNetwork = getCenterFamilyStrokesForNetwork(
        network,
        topology
      )
      const strokes = getRenderableStrokes(renderStrokesForNetwork).filter(
        (stroke) => shouldRenderCenterSolidWithPathMask(stroke, topology)
      )
      return strokes.length > 0 ? [{ network, path, topology, strokes }] : []
    })
  const directCenterSolidVisualNetworkIds = new Set([
    ...centerPathSolidVisualStrokeGroups.map((group) => group.network.id),
    ...centerSolidPathMaskVisualStrokeGroups.map((group) => group.network.id)
  ])
  const centerPathSolidVisualNetworkIds = new Set(
    centerPathSolidVisualStrokeGroups.map((group) => group.network.id)
  )
  const renderedDashedCenterPackets: ReturnType<
    typeof buildDashedCenterStrokeResolvedPackets
  > = []
  const strokePackets = measureVectorRenderPhase('stroke packets', () => [
    ...networkPaths.flatMap(({ network, path, topology }) => {
      const renderStrokesForNetwork = getCenterFamilyStrokesForNetwork(
        network,
        topology
      )
      const hasNetworkCenterDashedIntent = hasDashedCenterStrokeIntent(
        renderStrokesForNetwork
      )
      const hasNetworkCenterSolidIntent = hasSolidCenterStrokeIntent(
        renderStrokesForNetwork
      )
      const shouldUseCenterSolidDescriptorEvidence =
        !shouldAttachFullStrokeDiagnostics &&
        centerPathSolidVisualNetworkIds.has(network.id)
      const constrainedNetworkDiagnostics = constrainedSolidDiagnostics.find(
        (entry) => entry.networkId === network.id
      )
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
      const networkCenterSolidPackets = hasNetworkCenterSolidIntent
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
              topology,
              preferStrokePathRenderDescriptor:
                shouldUseCenterSolidDescriptorEvidence
            }
          )
        : []
      if (
        hasNetworkCenterSolidIntent &&
        shouldUseCenterSolidDescriptorEvidence
      ) {
        emitStrokePipelineCounter('center-product-solid-descriptor-evidence')
      }
      return [
        ...networkCenterSolidPackets,
        ...networkDashedCenterPackets,
        ...(topology.closed
          ? (constrainedNetworkDiagnostics?.packets.filter(
              (packet) =>
                !constrainedSolidPromotedCandidateGeometryIds.has(
                  packet.geometry.geometryId
                )
            ) ?? [])
          : [])
      ]
    }),
    ...constrainedSolidPromotion.packets,
    ...constrainedDashedCandidatePackets
  ])
  const promotedExactStrokeFinalFaces = [
    ...constrainedSolidPromotion.exactFaces
  ]
  const rawStrokeFinalFaces = measureVectorRenderPhase('final faces', () => [
    ...buildSolidCenterStrokeFinalFaces(strokePackets),
    ...promotedExactStrokeFinalFaces
  ])
  const collapseInputStrokeFinalFaces = rawStrokeFinalFaces
  const arrangementLegalDomains = collapseInputStrokeFinalFaces.some(
    (face) =>
      (face.debugMeta?.productSignature?.startsWith('constrained-dashed:') ===
        true ||
        face.debugMeta?.productSignature?.startsWith('constrained-solid:') ===
          true) &&
      (face.debugMeta?.strokePosition === 'inside' ||
        face.debugMeta?.strokePosition === 'outside')
  )
    ? getArrangementLegalDomains()
    : undefined
  const strokeFinalFaces = measureVectorRenderPhase(
    'visual overlap collapse',
    () => {
      const finishCollapse = (faces: typeof collapseInputStrokeFinalFaces) =>
        faces

      if (collapseInputStrokeFinalFaces.length === 0) {
        emitStrokePipelineCounter('visual-overlap-collapse-center-product-only')
        return finishCollapse([])
      }

      return finishCollapse(
        collapseStrokeFinalFaceVisualOverlaps(collapseInputStrokeFinalFaces, {
          backend: getGeometryBackend(),
          legalDomains: arrangementLegalDomains
        })
      )
    }
  )
  const semanticStrokeFinalFaces = strokeFinalFaces
  const strokeRenderFaces =
    directCenterSolidVisualNetworkIds.size > 0
      ? strokeFinalFaces.filter(
          (face) =>
            !(
              shouldRenderCenterSolidFaceWithNativeVisual(face) &&
              typeof face.debugMeta?.networkId === 'string' &&
              directCenterSolidVisualNetworkIds.has(face.debugMeta.networkId)
            )
        )
      : strokeFinalFaces
  const centerSolidPathMaskRenderEntries =
    centerSolidPathMaskVisualStrokeGroups.flatMap((group) =>
      group.strokes.flatMap((stroke) => {
        const entry = buildCenterSolidPathMaskRenderEntry(
          renderData.id,
          group,
          stroke
        )
        return entry ? [entry] : []
      })
    )
  const applyVectorHoverHitArea = () => {
    const hitCache: VectorHitCache = graphicCache.__asyraVectorHitCache ?? {}
    const hasVisibleFill =
      hasClosedNetwork && getRenderableFills(fillPayload).length > 0
    const strokeHitSignature = semanticStrokeFinalFaces
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
      emitStrokePipelineCounter('vector-hit-area-stable-cache-hit')
      ;(graphic as { hitArea: typeof hitCache.hitArea | null }).hitArea =
        hitCache.hitArea
      return
    }

    emitStrokePipelineCounter('vector-hit-area-rebuild')
    hitCache.points = points
    hitCache.segments = segments
    hitCache.networks = networks
    hitCache.strokeHitSignature = strokeHitSignature
    hitCache.hasVisibleFill = hasVisibleFill
    hitCache.preparedFillSegments = hasVisibleFill
      ? prepareEvenOddHitSegments(getEvenOddShape())
      : []
    const strokeHitArea = createSolidCenterStrokeHitAreaFromFinalFaces(
      semanticStrokeFinalFaces
    )

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
          fills: fillPayload
        })

        if (evenOddFill) {
          evenOddCache.fill = evenOddFill
        }

        evenOddCache.width = renderData.width
        evenOddCache.height = renderData.height
        evenOddCache.fillPayload = fillPayload
        evenOddCache.points = points
        evenOddCache.segments = segments
        evenOddCache.networks = networks
        graphicCache.__asyraEvenOddFillCache = evenOddCache
      } else {
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
      const resolvedSelfIntersectingFillFaces = orderedNetworks.flatMap(
        (network) => {
          const topology = networkPaths.find(
            (pathModel) => pathModel.network.id === network.id
          )?.topology
          if (topology?.topologyFamily !== 'self-intersecting') {
            return []
          }
          return (
            resolvedGeometryByNetworkId
              .get(network.id)
              ?.selfIntersecting?.fillRegions.flatMap(
                (region) => region.polygons
              ) ?? []
          )
        }
      )
      const cache = graphicCache.__asyraVectorFillCache ?? {
        faces: []
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
        cache
      )
      const fillFaces = buildFillFaces(flattenedSegments, directedSegments)
      const effectiveFillFaces =
        resolvedSelfIntersectingFillFaces.length > 0
          ? resolvedSelfIntersectingFillFaces
          : fillFaces
      cache.faces = effectiveFillFaces
      cache.segmentKeyMap = segmentKeyMap
      cache.segmentLinesMap = segmentLinesMap
      graphicCache.__asyraVectorFillCache = cache

      if (effectiveFillFaces.length > 0) {
        drawFillFaces(graphic, effectiveFillFaces)
        applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
          replayPath: () => drawFillFaces(graphic, effectiveFillFaces)
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
  }

  measureVectorRenderPhase('hit area', applyVectorHoverHitArea)
  measureVectorRenderPhase('export packets', () =>
    applySolidCenterStrokeExportPacketsFromFinalFaces(
      graphic,
      semanticStrokeFinalFaces
    )
  )
  if (shouldAttachFullStrokeDiagnostics) {
    applyCenterDashedOverlapDiagnostics(graphic, renderedDashedCenterPackets)
  } else {
    clearCenterDashedOverlapDiagnostics(graphic)
  }
  if (shouldAttachFullStrokeDiagnostics) {
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
  } else {
    clearConstrainedSolidLegalityDiagnostics(graphic)
    clearConstrainedSolidOwnershipDiagnostics(graphic)
  }
  if (previewFill) {
    applyRenderableFill(graphic as { fill: unknown }, fillPayload, {
      replayPath: () =>
        drawVectorPath(graphic, orderedNetworks, points, segments)
    })
  }
  if (centerPathSolidVisualStrokeGroups.length > 0) {
    centerPathSolidVisualStrokeGroups.forEach(({ network, strokes }) => {
      strokes.forEach((stroke) =>
        drawCenterPathSolidStrokePath(
          graphic,
          [network],
          points,
          segments,
          stroke
        )
      )
    })
  } else if (
    strokeRenderFaces.length === 0 &&
    centerSolidPathMaskRenderEntries.length === 0
  ) {
    drawVectorPath(graphic, orderedNetworks, points, segments)
  }
  ;(
    graphic as typeof graphic & {
      __asyraCenterPathSolidStrokeRenderCount?: number
    }
  ).__asyraCenterPathSolidStrokeRenderCount =
    centerPathSolidVisualStrokeGroups.reduce(
      (sum, group) => sum + group.strokes.length,
      0
    )
  emitStrokePipelineCounter(
    'center-product-solid-stroke-render-count',
    centerPathSolidVisualStrokeGroups.reduce(
      (sum, group) => sum + group.strokes.length,
      0
    )
  )
  ;(
    graphic as typeof graphic & {
      __asyraCenterSolidPathMaskRenderCount?: number
    }
  ).__asyraCenterSolidPathMaskRenderCount =
    centerSolidPathMaskRenderEntries.length
  emitStrokePipelineCounter(
    'path-mask-center-solid-stroke-render-count',
    centerSolidPathMaskRenderEntries.length
  )
  const strokeRenderEntries = measureVectorRenderPhase('render entries', () => {
    return [
      ...centerSolidPathMaskRenderEntries,
      ...toSolidCenterStrokeRenderEntriesFromFinalFaces(strokeRenderFaces, {
        exactBackend: getGeometryBackend(),
        legalDomains: arrangementLegalDomains
      })
    ]
  })
  ;(
    graphic as typeof graphic & {
      __asyraConstrainedDashedProductNetworkIds?: string[]
    }
  ).__asyraConstrainedDashedProductNetworkIds = Array.from(
    new Set([
      ...strokeRenderFaces.flatMap((face) => {
        if (
          face.debugMeta?.productSignature?.startsWith(
            'constrained-dashed:'
          ) !== true
        ) {
          return []
        }
        if (
          face.debugMeta.sourceNetworkIds &&
          face.debugMeta.sourceNetworkIds.length > 0
        ) {
          return face.debugMeta.sourceNetworkIds
        }
        const networkId = face.debugMeta.networkId
        return typeof networkId === 'string' ? [networkId] : []
      })
    ])
  )
  ;(
    graphic as typeof graphic & {
      __asyraStrokeRenderFaceDebugMetas?: SolidCenterStrokeRenderEntry['debugMeta'][]
    }
  ).__asyraStrokeRenderFaceDebugMetas = strokeRenderFaces
    .map((face) => face.debugMeta)
    .filter((debugMeta) => debugMeta !== undefined)
  ;(
    graphic as typeof graphic & {
      __asyraStrokeRenderEntries?: SolidCenterStrokeRenderEntry[]
    }
  ).__asyraStrokeRenderEntries = strokeRenderEntries

  if (
    !shouldAttachFullStrokeDiagnostics &&
    canUseStrokeProductGeometryCache &&
    fillPayload.length === 0 &&
    singleSolidRenderableStroke &&
    strokeProductGeometrySignature &&
    strokeRenderEntries.length > 0
  ) {
    const productCacheEntry: StrokePipelineStageProductCache = {
      geometrySignature: strokeProductGeometrySignature,
      finalFaces: semanticStrokeFinalFaces,
      renderEntries: strokeRenderEntries
    }
    stageCache.products.set(strokeProductGeometrySignature, productCacheEntry)
    graphicCache.__asyraStrokePipelineStageCache = stageCache
    emitStrokePipelineCounter('stroke-stage-cache:product-geometry-store')
  } else {
    graphicCache.__asyraStrokePipelineStageCache = stageCache
  }

  measureVectorRenderPhase('mesh render', () =>
    renderSolidCenterStrokeEntries(graphic, strokeRenderEntries)
  )
}

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  try {
    renderVectorGraphic(graphic, data as unknown as VectorComputedData)
  } catch (error) {
    renderSolidCenterStrokeEntries(graphic, [])
    throw error
  }
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
  ],
  renderStrategy: vectorRenderStrategy
})
