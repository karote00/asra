import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  VECTOR_TOKENS,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import Clipper2ZFactory from 'clipper2-wasm'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../../components/stroke-render/clipper2-geometry-backend'
import { buildConstrainedDashedStrokeResolvedPackets } from '../../components/stroke-render/constrained-dashed-stroke-packets'
import {
  getGeometryBackend,
  registerGeometryBackend,
  selectGeometryBackend
} from '../../components/stroke-render/geometry-backend'
import { buildVectorGeometryModelPath } from '../../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../../components/stroke-render/resolved-vector-geometry-model'
import {
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  type SolidCenterStrokeGeometryDebugMeta
} from '../../components/stroke-render/solid-center-stroke-packets'
import {
  normalize,
  polygonArea,
  subtract,
  type Vec2
} from '../../components/stroke-render/solid-stroke-geometry-core'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'

type OrdinaryJoinType = 'miter' | 'bevel' | 'round'
type OrdinaryPipelineMeta = SolidCenterStrokeGeometryDebugMeta | undefined
interface OrdinaryPipelineTrace {
  eventName: string
  payload: Record<string, unknown>
}
interface OrdinaryGeometryProduct {
  polygons: Vec2[][]
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}
interface RuntimeJoinSeamEvidence {
  seamCoveragePolicy: 'shared-step-27-endpoint-identity'
  incidentSeamBoundaries: {
    seamBoundaryId: string
    intervalId: string
    splitRangeId?: string
    point: Vec2
    outerBodyBoundaryEndpoint: Vec2
    outerBodyBoundaryVertices: Vec2[]
    bodySideOutlineSegment: [Vec2, Vec2]
    bodySideTangent: Vec2
  }[]
}

const SOURCE_SPACE_FLOATING_EPSILON = 0.001

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

beforeAll(async () => {
  const backendId = 'clipper2-new-stroke-oracle-ordinary-sharp'
  const backend = createClipper2GeometryBackend(
    (await (
      Clipper2ZFactory as (options: {
        wasmBinary: Uint8Array
      }) => Promise<Clipper2Module>
    )({
      wasmBinary: readFileSync(clipperWasmPath)
    })) as Clipper2Module,
    {
      backendId,
      backendVersion: `${backendId}@test`
    }
  )
  registerGeometryBackend({
    backendId,
    load: () => backend
  })
  selectGeometryBackend(backendId)
})

const createOrdinarySharpFixture = () => {
  const points: Record<string, VectorPointNode> = {
    'op-1': {
      id: 'op-1',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 430,
      y: 185,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'op-2': {
      id: 'op-2',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 700,
      y: 540,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'op-3': {
      id: 'op-3',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 180,
      y: 480,
      anchorType: 'sharp',
      handleMode: 'none'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'os-1': {
      id: 'os-1',
      startId: 'op-1',
      endId: 'op-2',
      outControlId: null,
      inControlId: null
    },
    'os-2': {
      id: 'os-2',
      startId: 'op-2',
      endId: 'op-3',
      outControlId: null,
      inControlId: null
    },
    'os-3': {
      id: 'os-3',
      startId: 'op-3',
      endId: 'op-1',
      outControlId: null,
      inControlId: null
    }
  }
  const network: VectorNetwork = {
    id: 'on-1',
    pointIds: ['op-1', 'op-2', 'op-3'],
    segmentIds: ['os-1', 'os-2', 'os-3'],
    closed: true
  }

  return { network, points, segments }
}

const createReferenceAcuteMiterFixture = () => {
  const points: Record<string, VectorPointNode> = {
    'ap-1': {
      id: 'ap-1',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 430,
      y: 185,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'ap-2': {
      id: 'ap-2',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 530,
      y: 540,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'ap-3': {
      id: 'ap-3',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 330,
      y: 540,
      anchorType: 'sharp',
      handleMode: 'none'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'as-1': {
      id: 'as-1',
      startId: 'ap-1',
      endId: 'ap-2',
      outControlId: null,
      inControlId: null
    },
    'as-2': {
      id: 'as-2',
      startId: 'ap-2',
      endId: 'ap-3',
      outControlId: null,
      inControlId: null
    },
    'as-3': {
      id: 'as-3',
      startId: 'ap-3',
      endId: 'ap-1',
      outControlId: null,
      inControlId: null
    }
  }
  const network: VectorNetwork = {
    id: 'an-1',
    pointIds: ['ap-1', 'ap-2', 'ap-3'],
    segmentIds: ['as-1', 'as-2', 'as-3'],
    closed: true
  }

  return { network, points, segments }
}

const buildOrdinarySharpStrokeWithJoin = (
  joinType: OrdinaryJoinType,
  options: {
    dash?: number
    gap?: number
  } = {}
) =>
  createDefaultStroke({
    id: 'ordinary-stroke',
    style: StrokeStyles.DASHED,
    position: StrokePositions.OUTSIDE,
    width: 10,
    dash: options.dash ?? 27,
    gap: options.gap ?? 20,
    color: '#cccccc',
    opacity: 0.5,
    visible: true,
    joinType:
      joinType === 'miter'
        ? StrokeJoinTypes.MITER
        : joinType === 'bevel'
          ? StrokeJoinTypes.BEVEL
          : StrokeJoinTypes.ROUND,
    capType: StrokeCapTypes.BUTT,
    miterAngle: 28.96
  })

const expectedResolvedJoin = (joinType: OrdinaryJoinType) => joinType

const distance = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const distanceToSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 0) {
    return distance(point, start)
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return distance(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index++
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) {
      continue
    }
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

const distanceToPolygon = (point: Vec2, polygon: Vec2[]) => {
  if (polygon.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (isPointInsidePolygon(point, polygon)) {
    return 0
  }
  return Math.min(
    ...polygon.map((vertex, index) =>
      distanceToSegment(
        point,
        vertex,
        polygon[(index + 1) % polygon.length] ?? vertex
      )
    )
  )
}

const distanceToPolygons = (point: Vec2, polygons: Vec2[][]) =>
  Math.min(...polygons.map((polygon) => distanceToPolygon(point, polygon)))

const polygonListArea = (polygons: Vec2[][]) =>
  polygons.reduce((sum, polygon) => sum + Math.abs(polygonArea(polygon)), 0)

const roundedForDiagnostic = (point: Vec2) => ({
  x: Math.round(point.x * 1000) / 1000,
  y: Math.round(point.y * 1000) / 1000
})

const getRuntimeJoinSeamEvidence = (
  meta: OrdinaryPipelineMeta
): RuntimeJoinSeamEvidence | undefined =>
  (meta as { seamEvidence?: RuntimeJoinSeamEvidence } | undefined)?.seamEvidence

const roundedPoint = (point: Vec2, anchor: Vec2) => ({
  x: Math.round((point.x - anchor.x) * 100) / 100,
  y: Math.round((point.y - anchor.y) * 100) / 100
})

const getJoinMetadataMatches = (
  metas: OrdinaryPipelineMeta[],
  joinType: OrdinaryJoinType
) =>
  metas.filter((meta): meta is SolidCenterStrokeGeometryDebugMeta => {
    const seamEvidence = getRuntimeJoinSeamEvidence(meta)
    return (
      meta?.ownerStage === 'Stroke Geometry source-vertex join assembly' &&
      meta.routeId === 'constrained-dashed-source-vertex-join-product' &&
      meta.visibleContributor === 'source-vertex-join' &&
      meta.geometryBasis === 'canonical-join-footprint' &&
      meta.authoredJoin === joinType &&
      meta.resolvedJoin === expectedResolvedJoin(joinType) &&
      meta.vertexAngle !== undefined &&
      meta.miterAngle === 28.96 &&
      meta.angleSource !== undefined &&
      meta.angleComparison !== undefined &&
      seamEvidence?.seamCoveragePolicy === 'shared-step-27-endpoint-identity' &&
      seamEvidence.incidentSeamBoundaries.length >= 2
    )
  })

const getPreLegalitySourceVertexJoinProducts = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  pipelineTrace: readonly OrdinaryPipelineTrace[] = []
): OrdinaryGeometryProduct[] => [
  ...packets.flatMap((packet) => {
    const meta = packet.geometry.debugMeta
    return (meta?.joinOwnershipRecords ?? []).flatMap((record) =>
      record.kind === 'source-vertex'
        ? (record.preLegalityProductUnits ?? []).map((unit) => ({
            polygons: unit.polygons,
            debugMeta: {
              ...meta,
              ownerStage: unit.ownerStage,
              routeId: unit.routeId,
              visibleContributor: unit.visibleContributor,
              geometryBasis: unit.geometryBasis,
              productMode: unit.productMode,
              legalDomainIds: unit.legalDomainIds ?? meta?.legalDomainIds,
              sourceContourIds: unit.contourIds ?? meta?.sourceContourIds
            }
          }))
        : []
    )
  }),
  ...pipelineTrace.flatMap((trace) => {
    if (
      trace.eventName !==
      'constrained-dashed-pre-legality-source-vertex-products'
    ) {
      return []
    }
    const payload = trace.payload as SolidCenterStrokeGeometryDebugMeta & {
      polygons?: Vec2[][]
    }
    return payload.polygons && payload.polygons.length > 0
      ? [
          {
            polygons: payload.polygons,
            debugMeta: payload
          }
        ]
      : []
  })
]

const getPreLegalityJoinProductsForType = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  joinType: OrdinaryJoinType,
  pipelineTrace: readonly OrdinaryPipelineTrace[] = []
): (OrdinaryGeometryProduct & {
  debugMeta: SolidCenterStrokeGeometryDebugMeta
})[] =>
  getPreLegalitySourceVertexJoinProducts(packets, pipelineTrace).filter(
    (
      product
    ): product is OrdinaryGeometryProduct & {
      debugMeta: SolidCenterStrokeGeometryDebugMeta
    } => getJoinMetadataMatches([product.debugMeta], joinType).length > 0
  )

const isSourceVertexIndexMeta = (
  meta: OrdinaryPipelineMeta,
  sourceVertexIndex: number
) =>
  meta?.productSignature?.includes(`:source-vertex:${sourceVertexIndex}:`) ===
  true

const getSourceVertexJoinEntries = (
  entries: ReturnType<typeof toSolidCenterStrokeRenderEntriesFromFinalFaces>,
  joinType: OrdinaryJoinType
) =>
  entries.filter(
    (entry) =>
      getJoinMetadataMatches([entry.debugMeta], joinType).length > 0 &&
      entry.debugMeta?.joinOwnershipRecords?.some(
        (record) =>
          record.kind === 'source-vertex' &&
          record.materializationKind === 'join'
      ) === true
  )

const summarizeMetas = (metas: OrdinaryPipelineMeta[]) =>
  metas.map((meta) => ({
    productMode: meta?.productMode ?? null,
    productSignature: meta?.productSignature ?? null,
    routeId: meta?.routeId ?? null,
    ownerStage: meta?.ownerStage ?? null,
    visibleContributor: meta?.visibleContributor ?? null,
    geometryBasis: meta?.geometryBasis ?? null,
    authoredJoin: meta?.authoredJoin ?? null,
    resolvedJoin: meta?.resolvedJoin ?? null,
    joinOwnershipSignature: meta?.joinOwnershipSignature ?? null,
    joinOwnershipRecordCount: meta?.joinOwnershipRecords?.length ?? 0,
    dashProductIntervals:
      meta?.dashProductIntervals?.map((interval) => ({
        intervalId: interval.intervalId,
        terminalRole: interval.terminalRole,
        sourceSegmentIndex: interval.sourceSegmentIndex,
        sourceStartDistance: interval.sourceStartDistance,
        sourceEndDistance: interval.sourceEndDistance,
        materializationDistanceSpace: interval.materializationDistanceSpace
      })) ?? null,
    constrainedDashedJoinDiagnostics:
      meta?.constrainedDashedJoinDiagnostics ?? null
  }))

const buildShapeSignature = (
  entries: ReturnType<typeof toSolidCenterStrokeRenderEntriesFromFinalFaces>,
  anchor: Vec2
) =>
  JSON.stringify(
    entries
      .flatMap((entry) => entry.polygons)
      .map((polygon) => polygon.map((point) => roundedPoint(point, anchor)))
      .sort((left, right) => left.length - right.length)
  )

const assertJoinTouchesIncidentSeams = (
  product: {
    polygons: Vec2[][]
    debugMeta?: SolidCenterStrokeGeometryDebugMeta
  },
  joinType: OrdinaryJoinType
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${joinType} seam evidence`).toBeDefined()
  for (const seamBoundary of seamEvidence?.incidentSeamBoundaries ?? []) {
    expect(
      seamBoundary.outerBodyBoundaryVertices.length,
      `${joinType} ${seamBoundary.seamBoundaryId} must carry incident outer body boundary vertices`
    ).toBeGreaterThanOrEqual(2)
    expect(
      distanceToSegment(
        seamBoundary.outerBodyBoundaryEndpoint,
        seamBoundary.bodySideOutlineSegment[0],
        seamBoundary.bodySideOutlineSegment[1]
      ),
      `${joinType} ${seamBoundary.seamBoundaryId} outer endpoint must belong to body-side outline segment`
    ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
    const seamDistance = distanceToPolygons(
      seamBoundary.outerBodyBoundaryEndpoint,
      product.polygons
    )
    expect(
      seamDistance,
      `${joinType} ${seamBoundary.seamBoundaryId} dash/join seam distance ${JSON.stringify(
        {
          outerBodyBoundaryEndpoint: {
            x:
              Math.round(seamBoundary.outerBodyBoundaryEndpoint.x * 1000) /
              1000,
            y:
              Math.round(seamBoundary.outerBodyBoundaryEndpoint.y * 1000) / 1000
          },
          point: roundedForDiagnostic(seamBoundary.point),
          bodySideOutlineSegment:
            seamBoundary.bodySideOutlineSegment.map(roundedForDiagnostic),
          outerBodyBoundaryVertices:
            seamBoundary.outerBodyBoundaryVertices.map(roundedForDiagnostic),
          polygonCount: product.polygons.length,
          polygons: product.polygons.map((polygon) =>
            polygon.map(roundedForDiagnostic)
          ),
          stageBounds:
            product.debugMeta?.joinOwnershipRecords?.[0]?.stageBounds ?? null,
          productSignature: product.debugMeta?.productSignature ?? null
        },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
  }
}

const getPacketIntervalIds = (
  meta: SolidCenterStrokeGeometryDebugMeta | undefined
) =>
  new Set([
    ...(meta?.intervalIds ?? []),
    ...(meta?.intervalId ? [meta.intervalId] : []),
    ...(meta?.dashProductIntervals?.map((interval) => interval.intervalId) ??
      [])
  ])

const getSortedPacketIntervalIds = (
  meta: SolidCenterStrokeGeometryDebugMeta | undefined
) => Array.from(getPacketIntervalIds(meta)).sort()

const getDashBodyPacketsForInterval = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  intervalIds: Iterable<string>
) =>
  packets.filter((packet) => {
    const meta = packet.geometry.debugMeta
    const candidateIds = getPacketIntervalIds(meta)
    const visibleContributor = meta?.visibleContributor
    return (
      (visibleContributor === 'dash-interval-body' ||
        visibleContributor === 'terminal-interval-body') &&
      Array.from(intervalIds).some((intervalId) => candidateIds.has(intervalId))
    )
  })

const getVisibleDashBodyPackets = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
) =>
  packets.filter(
    (packet) =>
      packet.geometry.debugMeta?.visibleContributor === 'dash-interval-body'
  )

const assertCanonicalDashBodyPacketIdentity = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  label: string
) => {
  const dashBodyPackets = getVisibleDashBodyPackets(packets)
  expect(
    dashBodyPackets.length,
    `${label} must emit visible dash interval body products before join assembly`
  ).toBeGreaterThan(0)

  const packetIdsByIntervalId = new Map<string, string[]>()
  dashBodyPackets.forEach((packet) => {
    const intervalIds = getSortedPacketIntervalIds(packet.geometry.debugMeta)
    expect(
      intervalIds.length,
      `${label} dash body packet must preserve at least one interval identity: ${JSON.stringify(
        {
          intervalIds,
          productSignature: packet.geometry.debugMeta?.productSignature ?? null,
          visibleContributor:
            packet.geometry.debugMeta?.visibleContributor ?? null,
          bounds: packet.geometry.bounds
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)

    intervalIds.forEach((intervalId) => {
      const packetIds = packetIdsByIntervalId.get(intervalId) ?? []
      packetIds.push(packet.geometry.geometryId)
      packetIdsByIntervalId.set(intervalId, packetIds)
    })
  })

  for (const [intervalId, packetIds] of packetIdsByIntervalId) {
    expect(
      packetIds.length,
      `${label} interval ${intervalId} must not be emitted as fragmented duplicate visible dash body packets: ${JSON.stringify(
        {
          intervalId,
          packetIds
        },
        null,
        2
      )}`
    ).toBe(1)
  }
}

const assertOutsideDashBodyPacketsExcludeFilledDomain = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  fillPolygon: Vec2[],
  label: string
) => {
  const dashBodyPackets = getVisibleDashBodyPackets(packets)
  dashBodyPackets.forEach((packet) => {
    const dashBodyArea = polygonListArea(packet.geometry.polygons)
    expect(dashBodyArea, `${label} dash body packet area`).toBeGreaterThan(0)
    const insideFillRegions = getGeometryBackend().intersection(
      [{ polygons: packet.geometry.polygons }],
      [{ polygons: [fillPolygon] }],
      'nonzero'
    )
    const insideFillArea = polygonListArea(
      insideFillRegions.flatMap((region) => region.polygons)
    )
    expect(
      insideFillArea,
      `${label} outside dash body packet must not leave visible filled-domain residue: ${JSON.stringify(
        {
          intervalIds: getSortedPacketIntervalIds(packet.geometry.debugMeta),
          dashBodyArea,
          insideFillArea,
          bounds: packet.geometry.bounds,
          productSignature: packet.geometry.debugMeta?.productSignature ?? null,
          polygons: packet.geometry.polygons.map((polygon) =>
            polygon.map(roundedForDiagnostic)
          )
        },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(
      Math.max(1, dashBodyArea * 0.01) + SOURCE_SPACE_FLOATING_EPSILON
    )
  })
}

const assertDashBodyRenderEntriesPreserveFinalFaceProduct = (
  result: ReturnType<typeof buildOrdinarySharpPipelineResult>,
  label: string
) => {
  const finalFacesByIntervalId = new Map<
    string,
    (typeof result.finalFaces)[number][]
  >()
  result.finalFaces.forEach((face) => {
    if (face.debugMeta?.visibleContributor !== 'dash-interval-body') {
      return
    }
    const intervalIds = getSortedPacketIntervalIds(face.debugMeta)
    intervalIds.forEach((intervalId) => {
      const faces = finalFacesByIntervalId.get(intervalId) ?? []
      faces.push(face)
      finalFacesByIntervalId.set(intervalId, faces)
    })
  })

  const renderEntriesByIntervalId = new Map<
    string,
    (typeof result.renderEntries)[number][]
  >()
  result.renderEntries.forEach((entry) => {
    if (entry.debugMeta?.visibleContributor !== 'dash-interval-body') {
      return
    }
    const intervalIds = getSortedPacketIntervalIds(entry.debugMeta)
    expect(
      intervalIds.length,
      `${label} Step 38 dash body render entry must preserve at least one interval identity: ${JSON.stringify(
        {
          intervalIds,
          polygonCount: entry.polygons.length,
          cacheKey: entry.cacheKey,
          productSignature: entry.debugMeta?.productSignature ?? null,
          visualOverlapCollapseStatus:
            entry.debugMeta?.visualOverlapCollapseStatus ?? null
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)
    intervalIds.forEach((intervalId) => {
      const entries = renderEntriesByIntervalId.get(intervalId) ?? []
      entries.push(entry)
      renderEntriesByIntervalId.set(intervalId, entries)
    })
  })

  expect(
    renderEntriesByIntervalId.size,
    `${label} Step 38 must expose dash body render entries`
  ).toBeGreaterThan(0)

  for (const [intervalId, entries] of renderEntriesByIntervalId) {
    expect(
      entries.length,
      `${label} Step 38 interval ${intervalId} must not be emitted as duplicate dash body render entries: ${JSON.stringify(
        entries.map((entry) => ({
          cacheKey: entry.cacheKey,
          polygonCount: entry.polygons.length,
          visualOverlapCollapseStatus:
            entry.debugMeta?.visualOverlapCollapseStatus ?? null,
          productSignature: entry.debugMeta?.productSignature ?? null
        })),
        null,
        2
      )}`
    ).toBe(1)

    const [entry] = entries
    const finalFaces = finalFacesByIntervalId.get(intervalId) ?? []
    expect(
      finalFaces.length,
      `${label} Step 35 final face must exist for Step 38 dash body interval ${intervalId}`
    ).toBeGreaterThan(0)
    if (!entry || finalFaces.length === 0) {
      continue
    }

    const matchingFinalFace =
      finalFaces.find((face) => {
        const faceIntervalIds = getSortedPacketIntervalIds(face.debugMeta)
        const entryIntervalIds = getSortedPacketIntervalIds(entry.debugMeta)
        return (
          faceIntervalIds.length === entryIntervalIds.length &&
          faceIntervalIds.every((id, index) => id === entryIntervalIds[index])
        )
      }) ?? (finalFaces.length === 1 ? finalFaces[0] : undefined)
    if (!matchingFinalFace) {
      continue
    }

    const finalFaceArea = polygonListArea(matchingFinalFace.polygons)
    const renderEntryArea = polygonListArea(entry.polygons)
    const areaTolerance = Math.max(
      SOURCE_SPACE_FLOATING_EPSILON,
      Math.min(0.05, finalFaceArea * 0.0001)
    )

    expect(
      entry.polygons.length,
      `${label} Step 38 dash body interval ${intervalId} must expose visible body polygons: ${JSON.stringify(
        {
          cacheKey: entry.cacheKey,
          polygonCount: entry.polygons.length,
          finalFaceArea,
          renderEntryArea,
          visualOverlapCollapseStatus:
            entry.debugMeta?.visualOverlapCollapseStatus ?? null,
          visualOverlapSourceFaceIds:
            entry.debugMeta?.visualOverlapSourceFaceIds ?? null,
          visualOverlapSourceGeometryIds:
            entry.debugMeta?.visualOverlapSourceGeometryIds ?? null,
          productSignature: entry.debugMeta?.productSignature ?? null,
          polygons: entry.polygons.map((polygon) =>
            polygon.map(roundedForDiagnostic)
          )
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)
    expect(
      Math.abs(finalFaceArea - renderEntryArea),
      `${label} Step 38 dash body interval ${intervalId} must preserve Step 35 product area: ${JSON.stringify(
        {
          finalFaceArea,
          renderEntryArea,
          areaDelta: finalFaceArea - renderEntryArea,
          cacheKey: entry.cacheKey,
          visualOverlapCollapseStatus:
            entry.debugMeta?.visualOverlapCollapseStatus ?? null,
          productSignature: entry.debugMeta?.productSignature ?? null
        },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(areaTolerance)
  }
}

const getRenderEntryPaintSignature = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) =>
  [
    entry.stroke.kind,
    entry.stroke.color,
    entry.stroke.alpha,
    entry.stroke.paintKey ?? ''
  ].join('|')

const assertNoSamePaintRenderEntryOverdraw = (
  renderEntries: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >,
  label: string
) => {
  for (let leftIndex = 0; leftIndex < renderEntries.length; leftIndex += 1) {
    const left = renderEntries[leftIndex]
    if (!left || left.polygons.length === 0) {
      continue
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < renderEntries.length;
      rightIndex += 1
    ) {
      const right = renderEntries[rightIndex]
      if (
        !right ||
        right.polygons.length === 0 ||
        getRenderEntryPaintSignature(left) !==
          getRenderEntryPaintSignature(right)
      ) {
        continue
      }
      const intersections = getGeometryBackend().intersection(
        [{ polygons: left.polygons }],
        [{ polygons: right.polygons }],
        'nonzero'
      )
      const overlapArea = polygonListArea(
        intersections.flatMap((region) => region.polygons)
      )
      expect(
        overlapArea,
        `${label} Step 38 render entries must be single-composite for same-paint overlap, not repeated-alpha draws: ${JSON.stringify(
          {
            leftIndex,
            rightIndex,
            overlapArea,
            left: {
              cacheKey: left.cacheKey,
              visibleContributor: left.debugMeta?.visibleContributor ?? null,
              routeId: left.debugMeta?.routeId ?? null,
              productSignature: left.debugMeta?.productSignature ?? null,
              intervalIds: getSortedPacketIntervalIds(left.debugMeta),
              visualOverlapSourceFaceIds:
                left.debugMeta?.visualOverlapSourceFaceIds ?? null,
              polygons: left.polygons.map((polygon) =>
                polygon.map(roundedForDiagnostic)
              )
            },
            right: {
              cacheKey: right.cacheKey,
              visibleContributor: right.debugMeta?.visibleContributor ?? null,
              routeId: right.debugMeta?.routeId ?? null,
              productSignature: right.debugMeta?.productSignature ?? null,
              intervalIds: getSortedPacketIntervalIds(right.debugMeta),
              visualOverlapSourceFaceIds:
                right.debugMeta?.visualOverlapSourceFaceIds ?? null,
              polygons: right.polygons.map((polygon) =>
                polygon.map(roundedForDiagnostic)
              )
            }
          },
          null,
          2
        )}`
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
    }
  }
}

const getDashBodyPacketsForSeamBoundary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  seamBoundary: NonNullable<
    ReturnType<typeof getRuntimeJoinSeamEvidence>
  >['incidentSeamBoundaries'][number]
) => {
  const exactIntervalPackets = getDashBodyPacketsForInterval(packets, [
    seamBoundary.intervalId
  ])
  return exactIntervalPackets.length > 0
    ? exactIntervalPackets
    : getDashBodyPacketsForInterval(
        packets,
        getSeamBoundaryIntervalCandidates(seamBoundary)
      )
}

const getSeamBoundaryIntervalCandidates = (
  seamBoundary: NonNullable<
    ReturnType<typeof getRuntimeJoinSeamEvidence>
  >['incidentSeamBoundaries'][number]
) =>
  new Set([
    seamBoundary.intervalId,
    ...Array.from(
      seamBoundary.splitRangeId.matchAll(/interval:\d+/g),
      (match) => match[0]
    )
  ])

const getSourceNearOuterTerminalEdge = (
  polygons: Vec2[][],
  sourceVertex: Vec2
) => {
  let best:
    | {
        edge: [Vec2, Vec2]
        score: number
      }
    | undefined

  for (const polygon of polygons) {
    if (polygon.length < 3) {
      continue
    }
    let sourceNearIndex = 0
    let sourceNearDistance = Number.POSITIVE_INFINITY
    polygon.forEach((point, index) => {
      const candidateDistance = distance(sourceVertex, point)
      if (candidateDistance < sourceNearDistance) {
        sourceNearIndex = index
        sourceNearDistance = candidateDistance
      }
    })
    const sourceNearVertex = polygon[sourceNearIndex]
    if (!sourceNearVertex) {
      continue
    }
    const adjacentVertices = [
      polygon[(sourceNearIndex - 1 + polygon.length) % polygon.length],
      polygon[(sourceNearIndex + 1) % polygon.length]
    ].filter((point): point is Vec2 => point !== undefined)

    adjacentVertices.forEach((endpoint) => {
      if (
        distance(sourceNearVertex, endpoint) <= SOURCE_SPACE_FLOATING_EPSILON
      ) {
        return
      }
      const endpointSourceDistance = distance(sourceVertex, endpoint)
      const score = sourceNearDistance * 1_000_000 - endpointSourceDistance
      if (!best || score < best.score) {
        best = {
          edge: [sourceNearVertex, endpoint],
          score
        }
      }
    })
  }

  return best?.edge
}

const getExpectedOuterEndpointFromDashBodyPackets = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  seamBoundary: NonNullable<
    ReturnType<typeof getRuntimeJoinSeamEvidence>
  >['incidentSeamBoundaries'][number],
  sourceVertex: Vec2
) => {
  const dashBodyPackets = getDashBodyPacketsForSeamBoundary(
    packets,
    seamBoundary
  )
  const allPolygons = dashBodyPackets.flatMap(
    (packet) => packet.geometry.polygons
  )
  const boundaryDirection = normalize(
    subtract(seamBoundary.outerBodyBoundaryEndpoint, sourceVertex)
  )
  const polygons =
    boundaryDirection && allPolygons.length > 1
      ? [
          allPolygons.reduce((bestPolygon, polygon) => {
            const polygonCenter = polygon.reduce(
              (sum, point) => ({
                x: sum.x + point.x / polygon.length,
                y: sum.y + point.y / polygon.length
              }),
              { x: 0, y: 0 }
            )
            const bestCenter = bestPolygon.reduce(
              (sum, point) => ({
                x: sum.x + point.x / bestPolygon.length,
                y: sum.y + point.y / bestPolygon.length
              }),
              { x: 0, y: 0 }
            )
            const polygonDirection = normalize(
              subtract(polygonCenter, sourceVertex)
            )
            const bestDirection = normalize(subtract(bestCenter, sourceVertex))
            const polygonScore = polygonDirection
              ? polygonDirection.x * boundaryDirection.x +
                polygonDirection.y * boundaryDirection.y
              : Number.NEGATIVE_INFINITY
            const bestScore = bestDirection
              ? bestDirection.x * boundaryDirection.x +
                bestDirection.y * boundaryDirection.y
              : Number.NEGATIVE_INFINITY
            return polygonScore > bestScore ? polygon : bestPolygon
          })
        ]
      : allPolygons
  const terminalEdge = getSourceNearOuterTerminalEdge(polygons, sourceVertex)
  if (!terminalEdge) {
    return {
      expectedOuterEndpoint: undefined,
      dashBodyPackets,
      terminalEdge: undefined
    }
  }
  const expectedOuterEndpoint =
    distance(sourceVertex, terminalEdge[0]) >=
    distance(sourceVertex, terminalEdge[1])
      ? terminalEdge[0]
      : terminalEdge[1]
  return {
    expectedOuterEndpoint,
    dashBodyPackets,
    terminalEdge
  }
}

const assertSeamEvidenceUsesDashBodyOuterEndpoints = (
  result: {
    packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  },
  product: {
    polygons: Vec2[][]
    debugMeta?: SolidCenterStrokeGeometryDebugMeta
  },
  sourceVertex: Vec2,
  label: string
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }
  const expectedEndpoints: Vec2[] = []

  for (const seamBoundary of seamEvidence?.incidentSeamBoundaries ?? []) {
    const { expectedOuterEndpoint, dashBodyPackets, terminalEdge } =
      getExpectedOuterEndpointFromDashBodyPackets(
        result.packets,
        seamBoundary,
        sourceVertex
      )
    expect(
      expectedOuterEndpoint,
      `${label} must derive an expected outer endpoint from the emitted Step 27 dash body product polygon: ${JSON.stringify(
        {
          seamBoundary,
          dashBodyPacketCount: dashBodyPackets.length,
          dashBodyPacketBounds: dashBodyPackets.map(
            (packet) => packet.geometry.bounds
          )
        },
        null,
        2
      )}`
    ).toBeDefined()
    if (!expectedOuterEndpoint) {
      continue
    }
    expectedEndpoints.push(expectedOuterEndpoint)
    expect(
      distance(seamBoundary.outerBodyBoundaryEndpoint, expectedOuterEndpoint),
      `${label} seamEvidence.outerBodyBoundaryEndpoint must be the dash body outer terminal endpoint, not an inward selected-side endpoint: ${JSON.stringify(
        {
          seamBoundaryId: seamBoundary.seamBoundaryId,
          actual: roundedForDiagnostic(seamBoundary.outerBodyBoundaryEndpoint),
          expected: roundedForDiagnostic(expectedOuterEndpoint),
          terminalEdge: terminalEdge?.map(roundedForDiagnostic),
          dashBodyPolygons: dashBodyPackets.flatMap((packet) =>
            packet.geometry.polygons.map((polygon) =>
              polygon.map(roundedForDiagnostic)
            )
          ),
          sourceVertex: roundedForDiagnostic(sourceVertex),
          productSignature: product.debugMeta?.productSignature ?? null
        },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
  }

  const uniqueEndpoints = uniqueOuterBodyBoundaryEndpoints({
    seamCoveragePolicy: 'shared-step-27-endpoint-identity',
    incidentSeamBoundaries: expectedEndpoints.map((endpoint, index) => ({
      seamBoundaryId: `expected:${index}`,
      intervalId: `expected:${index}`,
      point: endpoint,
      outerBodyBoundaryEndpoint: endpoint,
      outerBodyBoundaryVertices: [endpoint],
      bodySideOutlineSegment: [endpoint, endpoint],
      bodySideTangent: { x: 0, y: 0 }
    }))
  })
  if (uniqueEndpoints.length >= 2 && seamEvidence) {
    expect(
      uniqueEndpoints.some((firstEndpoint, firstIndex) =>
        uniqueEndpoints
          .slice(firstIndex + 1)
          .some((secondEndpoint) =>
            product.polygons.some((polygon) =>
              edgeConnects(
                polygon,
                firstEndpoint,
                secondEndpoint,
                SOURCE_SPACE_FLOATING_EPSILON
              )
            )
          )
      ),
      `${label} bevel chord must connect independently derived Step 27 dash outer endpoints: ${JSON.stringify(
        {
          expectedEndpoints: uniqueEndpoints.map(roundedForDiagnostic),
          polygons: product.polygons.map((polygon) =>
            polygon.map(roundedForDiagnostic)
          )
        },
        null,
        2
      )}`
    ).toBe(true)
  }
}

const assertJoinAndDashBodyShareIncidentSeamEndpoints = (
  result: {
    packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>
  },
  product: {
    polygons: Vec2[][]
    debugMeta?: SolidCenterStrokeGeometryDebugMeta
  },
  joinType: OrdinaryJoinType
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${joinType} seam evidence`).toBeDefined()

  for (const seamBoundary of seamEvidence?.incidentSeamBoundaries ?? []) {
    const dashBodyPackets = getDashBodyPacketsForInterval(
      result.packets,
      getSeamBoundaryIntervalCandidates(seamBoundary)
    )
    const availableDashBodyIntervalIds = Array.from(
      new Set(
        result.packets
          .filter(
            (packet) =>
              packet.geometry.debugMeta?.visibleContributor ===
              'dash-interval-body'
          )
          .flatMap((packet) =>
            Array.from(getPacketIntervalIds(packet.geometry.debugMeta))
          )
      )
    ).sort()
    expect(
      dashBodyPackets.length,
      `${joinType} incident dash body products for ${seamBoundary.intervalId}: ${JSON.stringify(
        {
          seamBoundary,
          availableDashBodyIntervalIds
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)

    const dashBodyPolygons = dashBodyPackets.flatMap(
      (packet) => packet.geometry.polygons
    )
    const diagnostic = {
      seamBoundaryId: seamBoundary.seamBoundaryId,
      intervalId: seamBoundary.intervalId,
      splitRangeId: seamBoundary.splitRangeId,
      outerBodyBoundaryEndpoint: roundedForDiagnostic(
        seamBoundary.outerBodyBoundaryEndpoint
      ),
      bodySideOutlineSegment:
        seamBoundary.bodySideOutlineSegment.map(roundedForDiagnostic),
      dashBodyPacketIntervals: dashBodyPackets.map((packet) =>
        Array.from(getPacketIntervalIds(packet.geometry.debugMeta)).sort()
      ),
      dashBodyPacketBounds: dashBodyPackets.map(
        (packet) => packet.geometry.bounds
      )
    }
    expect(
      distanceToPolygons(
        seamBoundary.outerBodyBoundaryEndpoint,
        product.polygons
      ),
      `${joinType} join product must share Step 27 seam endpoint for ${seamBoundary.seamBoundaryId}: ${JSON.stringify(
        diagnostic,
        null,
        2
      )}`
    ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
    expect(
      distanceToPolygons(
        seamBoundary.outerBodyBoundaryEndpoint,
        dashBodyPolygons
      ),
      `${joinType} dash body product must share Step 27 seam endpoint for ${seamBoundary.seamBoundaryId}: ${JSON.stringify(
        diagnostic,
        null,
        2
      )}`
    ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
  }
}

const edgeConnects = (
  polygon: Vec2[],
  firstEndpoint: Vec2,
  secondEndpoint: Vec2,
  tolerance: number
) =>
  polygon.some((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length]
    if (!nextPoint) {
      return false
    }
    const forward =
      distance(point, firstEndpoint) <= tolerance &&
      distance(nextPoint, secondEndpoint) <= tolerance
    const reverse =
      distance(point, secondEndpoint) <= tolerance &&
      distance(nextPoint, firstEndpoint) <= tolerance
    return forward || reverse
  })

const uniqueOuterBodyBoundaryEndpoints = (
  seamEvidence: RuntimeJoinSeamEvidence
) => {
  const endpointByKey = new Map<string, Vec2>()
  for (const seamBoundary of seamEvidence.incidentSeamBoundaries) {
    const endpoint = seamBoundary.outerBodyBoundaryEndpoint
    const key = `${Math.round(endpoint.x * 1000) / 1000}:${
      Math.round(endpoint.y * 1000) / 1000
    }`
    endpointByKey.set(key, endpoint)
  }
  return [...endpointByKey.values()]
}

const assertBevelChordUsesIncidentDashOuterEndpoints = (
  product: {
    polygons: Vec2[][]
    debugMeta?: SolidCenterStrokeGeometryDebugMeta
  },
  label: string
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  const endpoints = uniqueOuterBodyBoundaryEndpoints(seamEvidence)
  expect(
    endpoints.length,
    `${label} must expose the two incident dash outer boundary endpoints: ${JSON.stringify(
      {
        endpoints,
        incidentSeamBoundaries: seamEvidence.incidentSeamBoundaries
      },
      null,
      2
    )}`
  ).toBeGreaterThanOrEqual(2)

  const tolerance = SOURCE_SPACE_FLOATING_EPSILON
  const hasOuterEndpointChord = endpoints.some((firstEndpoint, firstIndex) =>
    endpoints
      .slice(firstIndex + 1)
      .some((secondEndpoint) =>
        product.polygons.some((polygon) =>
          edgeConnects(polygon, firstEndpoint, secondEndpoint, tolerance)
        )
      )
  )

  expect(
    hasOuterEndpointChord,
    `${label} bevel chord must directly connect incident dash outer boundary endpoints: ${JSON.stringify(
      {
        endpoints: endpoints.map((endpoint) => ({
          x: Math.round(endpoint.x * 1000) / 1000,
          y: Math.round(endpoint.y * 1000) / 1000
        })),
        polygonCount: product.polygons.length,
        polygons: product.polygons.map((polygon) =>
          polygon.map((point) => ({
            x: Math.round(point.x * 1000) / 1000,
            y: Math.round(point.y * 1000) / 1000
          }))
        ),
        productSignature: product.debugMeta?.productSignature ?? null,
        stageBounds:
          product.debugMeta?.joinOwnershipRecords?.[0]?.stageBounds ?? null
      },
      null,
      2
    )}`
  ).toBe(true)
}

const assertOutsideJoinProductPreservesLegalSurvivorOwnership = (
  product: {
    polygons: Vec2[][]
    debugMeta?: SolidCenterStrokeGeometryDebugMeta
  },
  label: string
) => {
  const productArea = polygonListArea(product.polygons)
  expect(productArea, `${label} product area`).toBeGreaterThan(0)

  expect(
    product.debugMeta?.visibleContributor,
    `${label} outside join product must preserve source-vertex join ownership: ${JSON.stringify(
      {
        productArea,
        productSignature: product.debugMeta?.productSignature ?? null,
        seamEvidence: getRuntimeJoinSeamEvidence(product.debugMeta) ?? null,
        stageBounds:
          product.debugMeta?.joinOwnershipRecords?.[0]?.stageBounds ?? null
      },
      null,
      2
    )}`
  ).toBe('source-vertex-join')
  expect(product.debugMeta?.geometryBasis).toBe('canonical-join-footprint')
  if (
    product.debugMeta?.resolvedJoin === 'bevel' ||
    product.debugMeta?.resolvedJoin === 'bevel-by-miter-angle'
  ) {
    assertBevelChordUsesIncidentDashOuterEndpoints(product, label)
  }
}

interface BoundsLike {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const boundsDelta = (first: BoundsLike, second: BoundsLike) =>
  Math.max(
    Math.abs(first.minX - second.minX),
    Math.abs(first.minY - second.minY),
    Math.abs(first.maxX - second.maxX),
    Math.abs(first.maxY - second.maxY)
  )

const getJoinStageBounds = (meta: SolidCenterStrokeGeometryDebugMeta) =>
  meta.joinOwnershipRecords?.find(
    (record) =>
      record.kind === 'source-vertex' &&
      record.materializationKind === 'join' &&
      record.stageBounds !== undefined
  )?.stageBounds

const assertResolvedMiterUsesTheoreticalApex = (
  meta: SolidCenterStrokeGeometryDebugMeta,
  label: string
) => {
  const stageBounds = getJoinStageBounds(meta)
  expect(stageBounds, `${label} source-vertex join stage bounds`).toBeDefined()
  expect(
    stageBounds?.canonicalTheoreticalMiterFootprint,
    `${label} theoretical miter footprint`
  ).toBeDefined()
  expect(
    stageBounds?.canonicalLegalMiterFootprint,
    `${label} legal miter footprint`
  ).toBeDefined()
  expect(
    stageBounds?.sourceNearLimitedMiterFootprint,
    `${label} must not cap a resolved miter apex with a source-near window`
  ).toBeUndefined()

  const theoretical = stageBounds?.canonicalTheoreticalMiterFootprint
  const legal = stageBounds?.canonicalLegalMiterFootprint
  if (theoretical && legal) {
    expect(
      boundsDelta(legal, theoretical),
      `${label} legal miter bounds must preserve theoretical miter apex`
    ).toBeLessThanOrEqual(0.001)
  }
}

const buildOrdinarySharpPipelineResult = (
  joinType: OrdinaryJoinType,
  fixture = createOrdinarySharpFixture(),
  fixtureId = 'ordinary-sharp',
  options: {
    dash?: number
    gap?: number
  } = {}
) => {
  const { network, points, segments } = fixture
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: `new-oracle-${fixtureId}`,
    sourceId: `${fixtureId}-outside-dashed`,
    networkId: network.id,
    sourceRevision: `source-revision:${fixtureId}`,
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `new-oracle-${fixtureId}:resolved`,
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: network.id,
        path: sourcePath,
        topology
      }
    ]
  })
  const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
  const implicitFillRegions =
    (selfIntersecting?.fillRegions.length ?? 0) > 0
      ? (selfIntersecting?.fillRegions ?? [])
      : [{ polygons: [topology.normalizedPoints] }]
  const stroke = buildOrdinarySharpStrokeWithJoin(joinType, options)
  const pipelineTrace: OrdinaryPipelineTrace[] = []
  const traceTarget = globalThis as typeof globalThis & {
    __asyraStrokePipelineTraceSink?: (
      eventName: string,
      payload: Record<string, unknown>
    ) => void
  }
  const previousTraceSink = traceTarget.__asyraStrokePipelineTraceSink
  traceTarget.__asyraStrokePipelineTraceSink = (eventName, payload) => {
    if (
      eventName === 'constrained-dashed-pre-legality-source-vertex-products'
    ) {
      pipelineTrace.push({ eventName, payload })
    }
    previousTraceSink?.(eventName, payload)
  }
  const packets = (() => {
    try {
      return buildConstrainedDashedStrokeResolvedPackets(
        `new-oracle-${fixtureId}:packet`,
        topology.normalizedPoints,
        topology.closed,
        [stroke],
        {
          metadata: {
            ownerKeyPrefix: `vector:${fixtureId}-outside-dashed:${network.id}`,
            networkId: network.id,
            sourceNetworkIds: [network.id],
            legalDomainId: topology.legalDomains[0]?.legalDomainId
          },
          topology,
          sourcePath,
          implicitFillRegions,
          sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
          sharedStrokeBoundaryDomains:
            selfIntersecting?.strokeBoundaryDomains ?? [],
          selectedSideGuardPoints: network.pointIds.flatMap((pointId) => {
            const point = points[pointId]
            return point?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
              ? [
                  {
                    x: point.x,
                    y: point.y,
                    sharp: point.anchorType !== 'smooth'
                  }
                ]
              : []
          }),
          clipInsideToFillDomain: implicitFillRegions.length > 0
        }
      )
    } finally {
      traceTarget.__asyraStrokePipelineTraceSink = previousTraceSink
    }
  })()
  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
    finalFaces,
    {
      exactBackend: getGeometryBackend(),
      legalDomains: [
        {
          legalDomainId: topology.legalDomains[0]?.legalDomainId,
          fillRule: topology.fillRule,
          regions: implicitFillRegions
        }
      ]
    }
  )

  return {
    points,
    fillPolygon: topology.normalizedPoints,
    stroke,
    packets,
    finalFaces,
    renderEntries,
    pipelineTrace
  }
}

describe('formal stroke geometry oracle: ordinary sharp runtime path', () => {
  it('preserves source-vertex join resolution metadata from product packets through render entries', () => {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      const result = buildOrdinarySharpPipelineResult(joinType)
      const packetMatches = getPreLegalityJoinProductsForType(
        result.packets,
        joinType,
        result.pipelineTrace
      )
      const finalFaceMatches = getJoinMetadataMatches(
        result.finalFaces.map((face) => face.debugMeta),
        joinType
      )
      const renderEntryMatches = getJoinMetadataMatches(
        result.renderEntries.map((entry) => entry.debugMeta),
        joinType
      )

      expect(
        packetMatches.length,
        `Step 28 must emit ${joinType} source-vertex join product metadata: ${JSON.stringify(
          summarizeMetas(
            result.packets.map((packet) => packet.geometry.debugMeta)
          ),
          null,
          2
        )}`
      ).toBeGreaterThan(0)
      expect(
        finalFaceMatches.every(
          (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
        ),
        `Step 35 must not promote ${joinType} Step 28 pre-legality source-vertex evidence to visible final faces: ${JSON.stringify(
          summarizeMetas(result.finalFaces.map((face) => face.debugMeta)),
          null,
          2
        )}`
      ).toBe(true)
      expect(
        renderEntryMatches.every(
          (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
        ),
        `Step 38 must not promote ${joinType} Step 28 pre-legality source-vertex evidence to visible render entries: ${JSON.stringify(
          summarizeMetas(result.renderEntries.map((entry) => entry.debugMeta)),
          null,
          2
        )}`
      ).toBe(true)

      packetMatches.forEach((packetProduct) => {
        assertJoinTouchesIncidentSeams(packetProduct, joinType)
        assertOutsideJoinProductPreservesLegalSurvivorOwnership(
          packetProduct,
          `${joinType} Step 28 pre-legality product`
        )
        assertJoinAndDashBodyShareIncidentSeamEndpoints(
          result,
          packetProduct,
          joinType
        )
      })
      finalFaceMatches.forEach((finalFaceMeta) => {
        const finalFace = result.finalFaces.find(
          (candidate) => candidate.debugMeta === finalFaceMeta
        )
        expect(
          finalFace,
          `${joinType} Step 35 final face with join metadata`
        ).toBeDefined()
        if (finalFace) {
          assertJoinTouchesIncidentSeams(finalFace, joinType)
          assertOutsideJoinProductPreservesLegalSurvivorOwnership(
            finalFace,
            `${joinType} Step 35 final face`
          )
        }
      })
      renderEntryMatches.forEach((renderEntryMeta) => {
        const renderEntry = result.renderEntries.find(
          (candidate) => candidate.debugMeta === renderEntryMeta
        )
        expect(
          renderEntry,
          `${joinType} Step 38 render entry with join metadata`
        ).toBeDefined()
        if (renderEntry) {
          assertJoinTouchesIncidentSeams(renderEntry, joinType)
          assertOutsideJoinProductPreservesLegalSurvivorOwnership(
            renderEntry,
            `${joinType} Step 38 render entry`
          )
        }
      })
    }
  })

  it('keeps ordinary sharp miter, bevel, and round render-entry source-vertex footprints distinguishable', () => {
    const results = {
      miter: buildOrdinarySharpPipelineResult('miter'),
      bevel: buildOrdinarySharpPipelineResult('bevel'),
      round: buildOrdinarySharpPipelineResult('round')
    }
    const anchor = results.miter.points['op-1']
    const signatures = Object.fromEntries(
      (['miter', 'bevel', 'round'] as const).map((joinType) => {
        const visibleEntries = getSourceVertexJoinEntries(
          results[joinType].renderEntries,
          joinType
        )
        const entries = getPreLegalityJoinProductsForType(
          results[joinType].packets,
          joinType,
          results[joinType].pipelineTrace
        )
        if (entries.length === 0) {
          return [joinType, `${joinType}:no-step28-source-vertex-product`]
        }
        entries.forEach((entry) =>
          assertJoinTouchesIncidentSeams(entry, joinType)
        )
        visibleEntries.forEach((entry) =>
          assertOutsideJoinProductPreservesLegalSurvivorOwnership(
            entry,
            `${joinType} Step 38 visible survivor`
          )
        )
        return [joinType, buildShapeSignature(entries, anchor)]
      })
    ) as Record<OrdinaryJoinType, string>

    expect(signatures.miter).not.toBe(signatures.bevel)
    expect(signatures.round).not.toBe(signatures.bevel)
    expect(new Set(Object.values(signatures)).size).toBe(3)
  })

  it('keeps ordinary sharp outside dashed render entries on canonical survivor ownership', () => {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      const result = buildOrdinarySharpPipelineResult(joinType)
      assertCanonicalDashBodyPacketIdentity(
        result.packets,
        `${joinType} Step 27 packets`
      )
      assertOutsideDashBodyPacketsExcludeFilledDomain(
        result.packets,
        result.fillPolygon,
        `${joinType} Step 27 packets`
      )
      assertDashBodyRenderEntriesPreserveFinalFaceProduct(
        result,
        `${joinType} ordinary sharp outside dashed`
      )
      assertNoSamePaintRenderEntryOverdraw(
        result.renderEntries,
        `${joinType} ordinary sharp outside dashed`
      )
      getSourceVertexJoinEntries(result.renderEntries, joinType).forEach(
        (renderEntry, index) => {
          assertOutsideJoinProductPreservesLegalSurvivorOwnership(
            renderEntry,
            `${joinType} Step 38 source-vertex join render entry ${index}`
          )
        }
      )
    }
  })

  it('keeps a resolved outside dashed miter apex at the theoretical source-domain offset intersection', () => {
    const result = buildOrdinarySharpPipelineResult(
      'miter',
      createReferenceAcuteMiterFixture(),
      'reference-acute-miter',
      { dash: 45, gap: 20 }
    )
    const packetMatches = getPreLegalityJoinProductsForType(
      result.packets,
      'miter',
      result.pipelineTrace
    )
    const finalFaceMatches = getJoinMetadataMatches(
      result.finalFaces.map((face) => face.debugMeta),
      'miter'
    )
    const renderEntryMatches = getJoinMetadataMatches(
      result.renderEntries.map((entry) => entry.debugMeta),
      'miter'
    )

    expect(
      packetMatches.length,
      `Step 28 must emit resolved miter source-vertex products for reference acute outside dashed joins: ${JSON.stringify(
        summarizeMetas(
          result.packets.map((packet) => packet.geometry.debugMeta)
        ),
        null,
        2
      )}`
    ).toBeGreaterThan(0)
    expect(
      finalFaceMatches.every(
        (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
      )
    ).toBe(true)
    expect(
      renderEntryMatches.every(
        (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
      )
    ).toBe(true)

    packetMatches.forEach((product) =>
      assertResolvedMiterUsesTheoreticalApex(
        product.debugMeta,
        'Step 28 pre-legality product'
      )
    )
    finalFaceMatches.forEach((meta) =>
      assertResolvedMiterUsesTheoreticalApex(meta, 'Step 35 final face')
    )
    renderEntryMatches.forEach((meta) =>
      assertResolvedMiterUsesTheoreticalApex(meta, 'Step 38 render entry')
    )
  })

  it('keeps a reference outside dashed bevel chord on the incident dash outer endpoints', () => {
    const sourceVertex = { x: 430, y: 185 }
    const result = buildOrdinarySharpPipelineResult(
      'bevel',
      createReferenceAcuteMiterFixture(),
      'reference-acute-bevel',
      { dash: 45, gap: 20 }
    )
    const packetMatches = getPreLegalityJoinProductsForType(
      result.packets,
      'bevel',
      result.pipelineTrace
    ).filter((product) => isSourceVertexIndexMeta(product.debugMeta, 0))
    const finalFaceMatches = getJoinMetadataMatches(
      result.finalFaces.map((face) => face.debugMeta),
      'bevel'
    ).filter((meta) => isSourceVertexIndexMeta(meta, 0))
    const renderEntryMatches = getJoinMetadataMatches(
      result.renderEntries.map((entry) => entry.debugMeta),
      'bevel'
    ).filter((meta) => isSourceVertexIndexMeta(meta, 0))

    expect(
      packetMatches.length,
      `Step 28 must emit reference acute bevel source-vertex:0 product: ${JSON.stringify(
        summarizeMetas(
          result.packets.map((packet) => packet.geometry.debugMeta)
        ),
        null,
        2
      )}`
    ).toBeGreaterThan(0)
    expect(
      finalFaceMatches.every(
        (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
      )
    ).toBe(true)
    expect(
      renderEntryMatches.every(
        (meta) => meta.productMode !== 'pre-legality-source-vertex-join'
      )
    ).toBe(true)

    packetMatches.forEach((product) => {
      assertSeamEvidenceUsesDashBodyOuterEndpoints(
        result,
        product,
        sourceVertex,
        'Step 28 pre-legality product'
      )
      assertBevelChordUsesIncidentDashOuterEndpoints(
        product,
        'Step 28 pre-legality product'
      )
    })
    finalFaceMatches.forEach((finalFaceMeta) => {
      const finalFace = result.finalFaces.find(
        (candidate) => candidate.debugMeta === finalFaceMeta
      )
      expect(
        finalFace,
        'Step 35 final face with bevel join metadata'
      ).toBeDefined()
      if (finalFace) {
        assertSeamEvidenceUsesDashBodyOuterEndpoints(
          result,
          finalFace,
          sourceVertex,
          'Step 35 final face'
        )
        assertBevelChordUsesIncidentDashOuterEndpoints(
          finalFace,
          'Step 35 final face'
        )
      }
    })
    renderEntryMatches.forEach((renderEntryMeta) => {
      const renderEntry = result.renderEntries.find(
        (candidate) => candidate.debugMeta === renderEntryMeta
      )
      expect(
        renderEntry,
        'Step 38 render entry with bevel join metadata'
      ).toBeDefined()
      if (renderEntry) {
        assertSeamEvidenceUsesDashBodyOuterEndpoints(
          result,
          renderEntry,
          sourceVertex,
          'Step 38 render entry'
        )
        assertBevelChordUsesIncidentDashOuterEndpoints(
          renderEntry,
          'Step 38 render entry'
        )
      }
    })
  })
})
