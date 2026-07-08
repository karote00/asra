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
import { buildSolidCenterStrokePolygons } from '../../components/stroke-render/solid-center-stroke-geometry'
import {
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  type SolidCenterStrokeRenderDescriptor
} from '../../components/stroke-render/solid-center-stroke-packets'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'

type LegalPosition = 'inside' | 'outside'

interface LegalityScenario {
  id: string
  points: Vec2[]
  position: LegalPosition
  selfIntersecting: boolean
}

interface WrongSideSample {
  point: Vec2
  reason: string
  artifactId?: string
  ownerStage?: unknown
  routeId?: unknown
  visibleContributor?: unknown
  geometryBasis?: unknown
  legalDomainIds?: unknown
  contourIds?: unknown
  channelSummary?: string
}

type LegalityRenderEntry = ReturnType<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[number]
type LegalityPacket = ReturnType<
  typeof buildConstrainedDashedStrokeResolvedPackets
>[number]
type LegalityFinalFace = ReturnType<
  typeof buildStrokeFinalFacesFromResolvedPackets
>[number]
interface LegalityPipelineTrace {
  eventName: string
  payload: Record<string, unknown>
}

interface StageArtifact {
  artifactId: string
  productId: string
  polygons: Vec2[][]
  ownerStage?: unknown
  routeId?: unknown
  visibleContributor?: unknown
  geometryBasis?: unknown
  legalDomainIds?: unknown
  contourIds?: unknown
  channelSummary?: string
}

interface StageBoundarySummary {
  stageId: string
  polygonCount: number
  wrongSideSamples: WrongSideSample[]
}

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const LEGALITY_COORDINATE_EPSILON = 1e-6
const SEAM_IDENTITY_TOLERANCE = 1e-6

beforeAll(async () => {
  const backendId = 'clipper2-new-stroke-oracle-legality-clipping'
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

const convexSource: Vec2[] = [
  { x: 0, y: 0 },
  { x: 170, y: 0 },
  { x: 170, y: 120 },
  { x: 0, y: 120 }
]

const concaveSource: Vec2[] = [
  { x: 0, y: 0 },
  { x: 185, y: 0 },
  { x: 185, y: 125 },
  { x: 92, y: 72 },
  { x: 0, y: 125 }
]

const selfIntersectingSource: Vec2[] = [
  { x: 0, y: 0 },
  { x: 140, y: 140 },
  { x: 0, y: 140 },
  { x: 140, y: 0 }
]

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

const distanceToPathBoundary = (point: Vec2, sourcePoints: readonly Vec2[]) =>
  Math.min(
    ...sourcePoints.map((sourcePoint, index) =>
      distanceToSegment(
        point,
        sourcePoint,
        sourcePoints[(index + 1) % sourcePoints.length] ?? sourcePoint
      )
    )
  )

const distanceToPolygon = (point: Vec2, polygon: readonly Vec2[]) =>
  Math.min(
    ...polygon.map((vertex, index) =>
      distanceToSegment(
        point,
        vertex,
        polygon[(index + 1) % polygon.length] ?? vertex
      )
    )
  )

const distanceToPolygons = (point: Vec2, polygons: readonly Vec2[][]) =>
  Math.min(...polygons.map((polygon) => distanceToPolygon(point, polygon)))

const isPointInsideEvenOddPolygon = (point: Vec2, polygon: readonly Vec2[]) => {
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
    const crossesRay =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (crossesRay) {
      inside = !inside
    }
  }
  return inside
}

const polygonCentroid = (polygon: readonly Vec2[]) => {
  const total = polygon.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y
    }),
    { x: 0, y: 0 }
  )
  return {
    x: total.x / polygon.length,
    y: total.y / polygon.length
  }
}

const polygonBounds = (polygon: readonly Vec2[]) => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  minY: Math.min(...polygon.map((point) => point.y)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  maxY: Math.max(...polygon.map((point) => point.y))
})

const buildPolygonSamplePoints = (polygon: readonly Vec2[]) => {
  const samples: Vec2[] = [polygonCentroid(polygon)]
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? point
    samples.push(point, {
      x: (point.x + next.x) / 2,
      y: (point.y + next.y) / 2
    })
  })

  const bounds = polygonBounds(polygon)
  for (let xIndex = 1; xIndex <= 4; xIndex += 1) {
    for (let yIndex = 1; yIndex <= 4; yIndex += 1) {
      const sample = {
        x: bounds.minX + ((bounds.maxX - bounds.minX) * xIndex) / 5,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * yIndex) / 5
      }
      if (isPointInsideEvenOddPolygon(sample, polygon)) {
        samples.push(sample)
      }
    }
  }

  return samples
}

const flattenBackendRegions = (regions: { polygons: Vec2[][] }[]) =>
  regions.flatMap((region) => region.polygons)

const intersectPolygons = (
  subjectPolygons: Vec2[][],
  clipPolygons: Vec2[][]
) =>
  subjectPolygons.length === 0 || clipPolygons.length === 0
    ? subjectPolygons
    : flattenBackendRegions(
        getGeometryBackend().intersection(
          [{ polygons: subjectPolygons }],
          [{ polygons: clipPolygons }],
          'nonzero'
        )
      )

const subtractPolygons = (
  subjectPolygons: Vec2[][],
  excludePolygons: Vec2[][]
) =>
  subjectPolygons.length === 0 || excludePolygons.length === 0
    ? subjectPolygons
    : flattenBackendRegions(
        getGeometryBackend().difference(
          [{ polygons: subjectPolygons }],
          [{ polygons: excludePolygons }],
          'nonzero'
        )
      )

const buildStrokePathDescriptorPolygonsForOracle = (
  strokePaths: Vec2[][] | undefined,
  strokePathStyle:
    | SolidCenterStrokeRenderDescriptor['strokePathStyle']
    | undefined
) =>
  strokePathStyle
    ? (strokePaths ?? []).flatMap((strokePath) =>
        buildSolidCenterStrokePolygons(
          strokePath,
          strokePathStyle.closed ?? false,
          {
            style: 'solid',
            position: 'center',
            width: strokePathStyle.width,
            cap: strokePathStyle.cap,
            join: strokePathStyle.join,
            miterAngle: strokePathStyle.miterAngle,
            miterLimit: strokePathStyle.miterLimit
          }
        )
      )
    : []

const buildStrokePathGroupPolygonsForOracle = (
  descriptor: Pick<
    SolidCenterStrokeRenderDescriptor,
    'strokePathGroups' | 'strokePaths' | 'strokePathStyle'
  >
) => {
  const groupPolygons =
    descriptor.strokePathGroups?.flatMap((group) => {
      const polygons = buildStrokePathDescriptorPolygonsForOracle(
        group.strokePaths,
        group.strokePathStyle ?? descriptor.strokePathStyle
      )
      return group.clipPolygons && group.clipPolygons.length > 0
        ? intersectPolygons(polygons, group.clipPolygons)
        : polygons
    }) ?? []
  const rootPolygons = buildStrokePathDescriptorPolygonsForOracle(
    descriptor.strokePaths,
    descriptor.strokePathStyle
  )
  return [...rootPolygons, ...groupPolygons]
}

const materializeVisibleEntryPolygonsForOracle = (
  entry: LegalityRenderEntry
) => {
  const strokePathPolygons = buildStrokePathGroupPolygonsForOracle(entry)
  let visiblePolygons =
    strokePathPolygons.length > 0
      ? strokePathPolygons
      : entry.polygons.length > 0
        ? entry.polygons
        : (entry.strokeMaskPolygons ?? entry.fillPolygons ?? [])
  if (entry.strokeMaskPolygons && entry.strokeMaskPolygons.length > 0) {
    visiblePolygons = intersectPolygons(
      visiblePolygons,
      entry.strokeMaskPolygons
    )
  }
  if (entry.clipPolygons && entry.clipPolygons.length > 0) {
    visiblePolygons = intersectPolygons(visiblePolygons, entry.clipPolygons)
  }
  if (entry.fillClipPolygons && entry.fillClipPolygons.length > 0) {
    visiblePolygons = intersectPolygons(visiblePolygons, entry.fillClipPolygons)
  }
  if (entry.fillExcludePolygons && entry.fillExcludePolygons.length > 0) {
    visiblePolygons = subtractPolygons(
      visiblePolygons,
      entry.fillExcludePolygons
    )
  }
  return visiblePolygons
}

const materializeDescriptorPolygonsForOracle = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined,
  carrierPolygons: Vec2[][]
) => {
  if (!descriptor) {
    return carrierPolygons
  }
  const strokePathPolygons = buildStrokePathGroupPolygonsForOracle(descriptor)
  let visiblePolygons =
    strokePathPolygons.length > 0
      ? strokePathPolygons
      : descriptor.descriptorProductPolygons &&
          descriptor.descriptorProductPolygons.length > 0
        ? descriptor.descriptorProductPolygons
        : descriptor.strokeMaskPolygons &&
            descriptor.strokeMaskPolygons.length > 0
          ? descriptor.strokeMaskPolygons
          : carrierPolygons
  if (descriptor.clipPolygons && descriptor.clipPolygons.length > 0) {
    visiblePolygons = intersectPolygons(
      visiblePolygons,
      descriptor.clipPolygons
    )
  }
  if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
    visiblePolygons = intersectPolygons(
      visiblePolygons,
      descriptor.fillClipPolygons
    )
  }
  if (
    descriptor.fillExcludePolygons &&
    descriptor.fillExcludePolygons.length > 0
  ) {
    visiblePolygons = subtractPolygons(
      visiblePolygons,
      descriptor.fillExcludePolygons
    )
  }
  return visiblePolygons
}

const collectWrongSideSamples = ({
  productPolygons,
  sourcePoints,
  position,
  boundaryTolerance = LEGALITY_COORDINATE_EPSILON
}: {
  productPolygons: readonly (readonly Vec2[])[]
  sourcePoints: readonly Vec2[]
  position: LegalPosition
  boundaryTolerance?: number
}): WrongSideSample[] =>
  productPolygons.flatMap((polygon, polygonIndex) =>
    buildPolygonSamplePoints(polygon).flatMap((sample) => {
      const insideFill = isPointInsideEvenOddPolygon(sample, sourcePoints)
      const boundaryDistance = distanceToPathBoundary(sample, sourcePoints)
      const onBoundary = boundaryDistance <= boundaryTolerance
      const legal =
        position === 'inside'
          ? insideFill || onBoundary
          : !insideFill || onBoundary
      return legal
        ? []
        : [
            {
              point: sample,
              reason: `${position}:polygon-${polygonIndex}:boundary-distance:${boundaryDistance.toFixed(3)}`
            }
          ]
    })
  )

const collectStageWrongSideSamples = ({
  artifacts,
  sourcePoints,
  position,
  boundaryTolerance = LEGALITY_COORDINATE_EPSILON
}: {
  artifacts: readonly StageArtifact[]
  sourcePoints: readonly Vec2[]
  position: LegalPosition
  boundaryTolerance?: number
}): WrongSideSample[] =>
  artifacts.flatMap((artifact) =>
    collectWrongSideSamples({
      productPolygons: artifact.polygons,
      sourcePoints,
      position,
      boundaryTolerance
    }).map((sample) => ({
      ...sample,
      artifactId: artifact.artifactId,
      ownerStage: artifact.ownerStage,
      routeId: artifact.routeId,
      visibleContributor: artifact.visibleContributor,
      geometryBasis: artifact.geometryBasis,
      legalDomainIds: artifact.legalDomainIds,
      contourIds: artifact.contourIds,
      channelSummary: artifact.channelSummary
    }))
  )

const summarizeStageBoundary = ({
  stageId,
  artifacts,
  sourcePoints,
  position
}: {
  stageId: string
  artifacts: readonly StageArtifact[]
  sourcePoints: readonly Vec2[]
  position: LegalPosition
}): StageBoundarySummary => ({
  stageId,
  polygonCount: artifacts.reduce(
    (sum, artifact) => sum + artifact.polygons.length,
    0
  ),
  wrongSideSamples: collectStageWrongSideSamples({
    artifacts,
    sourcePoints,
    position
  })
})

const compactStageBoundarySummary = (
  summaries: readonly StageBoundarySummary[]
) =>
  summaries.map((summary) => ({
    stageId: summary.stageId,
    polygonCount: summary.polygonCount,
    wrongSideCount: summary.wrongSideSamples.length,
    firstWrongSideSamples: summary.wrongSideSamples
      .slice(0, 6)
      .map((sample) => ({
        point: {
          x: Number(sample.point.x.toFixed(3)),
          y: Number(sample.point.y.toFixed(3))
        },
        reason: sample.reason,
        artifactId: sample.artifactId,
        ownerStage: sample.ownerStage,
        routeId: sample.routeId,
        visibleContributor: sample.visibleContributor,
        geometryBasis: sample.geometryBasis,
        legalDomainIds: sample.legalDomainIds,
        contourIds: sample.contourIds,
        channelSummary: sample.channelSummary
      })),
    firstWrongSideSampleByArtifact: Array.from(
      summary.wrongSideSamples
        .reduce((samplesByArtifact, sample) => {
          if (!samplesByArtifact.has(sample.artifactId)) {
            samplesByArtifact.set(sample.artifactId, sample)
          }
          return samplesByArtifact
        }, new Map<string | undefined, WrongSideSample>())
        .values()
    )
      .slice(0, 12)
      .map((sample) => ({
        point: {
          x: Number(sample.point.x.toFixed(3)),
          y: Number(sample.point.y.toFixed(3))
        },
        reason: sample.reason,
        artifactId: sample.artifactId,
        ownerStage: sample.ownerStage,
        routeId: sample.routeId,
        visibleContributor: sample.visibleContributor,
        geometryBasis: sample.geometryBasis,
        legalDomainIds: sample.legalDomainIds,
        contourIds: sample.contourIds,
        channelSummary: sample.channelSummary
      }))
  }))

const summarizeDescriptorChannels = (
  descriptor: SolidCenterStrokeRenderDescriptor | undefined
) =>
  descriptor
    ? [
        `descriptorProductPolygons:${descriptor.descriptorProductPolygons?.length ?? 0}`,
        `strokeMaskPolygons:${descriptor.strokeMaskPolygons?.length ?? 0}`,
        `strokePathGroups:${descriptor.strokePathGroups?.length ?? 0}`,
        `strokePaths:${descriptor.strokePaths?.length ?? 0}`,
        `clipPolygons:${descriptor.clipPolygons?.length ?? 0}`,
        `fillClipPolygons:${descriptor.fillClipPolygons?.length ?? 0}`,
        `fillExcludePolygons:${descriptor.fillExcludePolygons?.length ?? 0}`
      ].join(',')
    : 'descriptor:none'

const buildPacketStageArtifacts = (
  packets: readonly LegalityPacket[]
): StageArtifact[] =>
  packets.map((packet) => {
    const meta = packet.geometry.debugMeta
    return {
      artifactId: packet.geometry.geometryId,
      productId: packet.geometry.geometryId,
      polygons: packet.geometry.polygons,
      ownerStage: meta?.ownerStage,
      routeId: meta?.routeId,
      visibleContributor: meta?.visibleContributor,
      geometryBasis: meta?.geometryBasis,
      legalDomainIds: meta?.legalDomainIds,
      contourIds: meta?.sourceContourIds,
      channelSummary: summarizeDescriptorChannels(
        packet.geometry.renderDescriptor
      )
    }
  })

const buildPacketPreLegalitySourceVertexArtifacts = (
  packets: readonly LegalityPacket[],
  pipelineTrace: readonly LegalityPipelineTrace[] = []
): StageArtifact[] => [
  ...packets.flatMap((packet) => {
    const meta = packet.geometry.debugMeta
    return (meta?.joinOwnershipRecords ?? []).flatMap((record) =>
      record.kind === 'source-vertex'
        ? (record.preLegalityProductUnits ?? []).map((unit) => ({
            artifactId: unit.artifactId,
            productId: unit.productId,
            polygons: unit.polygons,
            ownerStage: unit.ownerStage,
            routeId: unit.routeId,
            visibleContributor: unit.visibleContributor,
            geometryBasis: unit.geometryBasis,
            legalDomainIds: unit.legalDomainIds,
            contourIds: unit.contourIds,
            channelSummary: unit.productMode
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
    const payload = trace.payload as StageArtifact & {
      polygons?: Vec2[][]
      productMode?: string
    }
    return payload.polygons && payload.polygons.length > 0
      ? [
          {
            artifactId: String(payload.artifactId),
            productId: String(payload.productId),
            polygons: payload.polygons,
            ownerStage: payload.ownerStage,
            routeId: payload.routeId,
            visibleContributor: payload.visibleContributor,
            geometryBasis: payload.geometryBasis,
            legalDomainIds: payload.legalDomainIds,
            contourIds: payload.contourIds,
            channelSummary: payload.productMode
          }
        ]
      : []
  })
]

const buildPacketDescriptorProductArtifacts = (
  packets: readonly LegalityPacket[]
): StageArtifact[] =>
  packets.flatMap((packet) => {
    const descriptor = packet.geometry.renderDescriptor
    const descriptorProductPolygons =
      descriptor?.descriptorProductPolygons ?? []
    if (descriptorProductPolygons.length === 0) {
      return []
    }
    const meta = packet.geometry.debugMeta
    return [
      {
        artifactId: `${packet.geometry.geometryId}:descriptorProductPolygons`,
        productId: packet.geometry.geometryId,
        polygons: descriptorProductPolygons,
        ownerStage: meta?.ownerStage,
        routeId: meta?.routeId,
        visibleContributor: meta?.visibleContributor,
        geometryBasis: meta?.geometryBasis,
        legalDomainIds: meta?.legalDomainIds,
        contourIds: meta?.sourceContourIds,
        channelSummary: summarizeDescriptorChannels(descriptor)
      }
    ]
  })

const buildPacketDescriptorVisibleArtifacts = (
  packets: readonly LegalityPacket[]
): StageArtifact[] =>
  packets.flatMap((packet) => {
    const descriptor = packet.geometry.renderDescriptor
    if (!descriptor) {
      return []
    }
    const polygons = materializeDescriptorPolygonsForOracle(
      descriptor,
      packet.geometry.polygons
    )
    if (polygons.length === 0) {
      return []
    }
    const meta = packet.geometry.debugMeta
    return [
      {
        artifactId: `${packet.geometry.geometryId}:materializedDescriptor`,
        productId: packet.geometry.geometryId,
        polygons,
        ownerStage: meta?.ownerStage,
        routeId: meta?.routeId,
        visibleContributor: meta?.visibleContributor,
        geometryBasis: meta?.geometryBasis,
        legalDomainIds: meta?.legalDomainIds,
        contourIds: meta?.sourceContourIds,
        channelSummary: summarizeDescriptorChannels(descriptor)
      }
    ]
  })

const buildFinalFaceStageArtifacts = (
  finalFaces: readonly LegalityFinalFace[]
): StageArtifact[] =>
  finalFaces.map((face) => ({
    artifactId: face.faceId,
    productId: face.faceId,
    polygons: face.polygons,
    ownerStage: face.debugMeta?.ownerStage,
    routeId: face.debugMeta?.routeId,
    visibleContributor: face.debugMeta?.visibleContributor,
    geometryBasis: face.debugMeta?.geometryBasis,
    legalDomainIds: face.legalDomainIds,
    contourIds: face.sourceContourIds,
    channelSummary: summarizeDescriptorChannels(
      face.renderDescriptor as SolidCenterStrokeRenderDescriptor | undefined
    )
  }))

const buildFinalFaceDescriptorVisibleArtifacts = (
  finalFaces: readonly LegalityFinalFace[]
): StageArtifact[] =>
  finalFaces.flatMap((face) => {
    const descriptor = face.renderDescriptor as
      | SolidCenterStrokeRenderDescriptor
      | undefined
    if (!descriptor) {
      return []
    }
    const polygons = materializeDescriptorPolygonsForOracle(
      descriptor,
      face.polygons
    )
    if (polygons.length === 0) {
      return []
    }
    return [
      {
        artifactId: `${face.faceId}:materializedDescriptor`,
        productId: face.faceId,
        polygons,
        ownerStage: face.debugMeta?.ownerStage,
        routeId: face.debugMeta?.routeId,
        visibleContributor: face.debugMeta?.visibleContributor,
        geometryBasis: face.debugMeta?.geometryBasis,
        legalDomainIds: face.legalDomainIds,
        contourIds: face.sourceContourIds,
        channelSummary: summarizeDescriptorChannels(descriptor)
      }
    ]
  })

const buildRenderEntryDeclaredArtifacts = (
  entries: readonly LegalityRenderEntry[]
): StageArtifact[] =>
  entries.map((entry, index) => ({
    artifactId: `render-entry:${index}:declared-polygons`,
    productId: String(entry.cacheKey),
    polygons: entry.polygons,
    ownerStage: entry.debugMeta?.ownerStage,
    routeId: entry.debugMeta?.routeId,
    visibleContributor: entry.debugMeta?.visibleContributor,
    geometryBasis: entry.debugMeta?.geometryBasis,
    legalDomainIds: entry.runtimeMeta?.legalDomainIds,
    contourIds: entry.runtimeMeta?.sourceContourIds,
    channelSummary: summarizeDescriptorChannels(entry)
  }))

const buildRenderEntryVisibleArtifacts = (
  entries: readonly LegalityRenderEntry[]
): StageArtifact[] =>
  entries.map((entry, index) => ({
    artifactId: `render-entry:${index}:visible-projection`,
    productId: String(entry.cacheKey),
    polygons: materializeVisibleEntryPolygonsForOracle(entry),
    ownerStage: entry.debugMeta?.ownerStage,
    routeId: entry.debugMeta?.routeId,
    visibleContributor: entry.debugMeta?.visibleContributor,
    geometryBasis: entry.debugMeta?.geometryBasis,
    legalDomainIds: entry.runtimeMeta?.legalDomainIds,
    contourIds: entry.runtimeMeta?.sourceContourIds,
    channelSummary: summarizeDescriptorChannels(entry)
  }))

const buildLegalityBoundarySummaries = ({
  packets,
  finalFaces,
  renderEntries,
  pipelineTrace = [],
  sourcePoints,
  position
}: {
  packets: readonly LegalityPacket[]
  finalFaces: readonly LegalityFinalFace[]
  renderEntries: readonly LegalityRenderEntry[]
  pipelineTrace?: readonly LegalityPipelineTrace[]
  sourcePoints: readonly Vec2[]
  position: StrokePosition
}) => [
  summarizeStageBoundary({
    stageId: 'step28-pre-legality-source-vertex-products',
    artifacts: buildPacketPreLegalitySourceVertexArtifacts(
      packets,
      pipelineTrace
    ),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'resolved-packet-declared-polygons',
    artifacts: buildPacketStageArtifacts(packets),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'step32-descriptor-product-polygons',
    artifacts: buildPacketDescriptorProductArtifacts(packets),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'step36-materialized-descriptor-from-packets',
    artifacts: buildPacketDescriptorVisibleArtifacts(packets),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'step35-final-face-declared-polygons',
    artifacts: buildFinalFaceStageArtifacts(finalFaces),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'step36-materialized-descriptor-from-final-faces',
    artifacts: buildFinalFaceDescriptorVisibleArtifacts(finalFaces),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'step38-render-entry-declared-polygons',
    artifacts: buildRenderEntryDeclaredArtifacts(renderEntries),
    sourcePoints,
    position
  }),
  summarizeStageBoundary({
    stageId: 'renderer-projection-input-visible-polygons',
    artifacts: buildRenderEntryVisibleArtifacts(renderEntries),
    sourcePoints,
    position
  })
]

const buildVectorFixture = (scenario: LegalityScenario) => {
  const points: Record<string, VectorPointNode> = Object.fromEntries(
    scenario.points.map((point, index) => [
      `lp-${index}`,
      {
        id: `lp-${index}`,
        kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
        x: point.x,
        y: point.y,
        anchorType: 'sharp',
        handleMode: 'none'
      } satisfies VectorPointNode
    ])
  )
  const segments: Record<string, VectorSegment> = Object.fromEntries(
    scenario.points.map((_, index) => [
      `ls-${index}`,
      {
        id: `ls-${index}`,
        startId: `lp-${index}`,
        endId: `lp-${(index + 1) % scenario.points.length}`,
        outControlId: null,
        inControlId: null
      } satisfies VectorSegment
    ])
  )
  const network: VectorNetwork = {
    id: `ln-${scenario.id}`,
    pointIds: scenario.points.map((_, index) => `lp-${index}`),
    segmentIds: scenario.points.map((_, index) => `ls-${index}`),
    closed: true
  }

  return { network, points, segments }
}

const buildLegalityPipeline = (scenario: LegalityScenario) => {
  const { network, points, segments } = buildVectorFixture(scenario)
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: `legality-oracle-${scenario.id}`,
    sourceId: `legality-oracle-${scenario.id}:${scenario.position}`,
    networkId: network.id,
    sourceRevision: `source-revision:${scenario.id}`,
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `legality-oracle-${scenario.id}:resolved`,
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
  const pipelineTrace: LegalityPipelineTrace[] = []
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
        `legality-oracle-${scenario.id}:${scenario.position}:packet`,
        topology.normalizedPoints,
        topology.closed,
        [
          createDefaultStroke({
            id: `stroke:${scenario.id}:${scenario.position}`,
            style: StrokeStyles.DASHED,
            position:
              scenario.position === 'inside'
                ? StrokePositions.INSIDE
                : StrokePositions.OUTSIDE,
            width: 12,
            dash: 42,
            gap: 22,
            color: '#cccccc',
            opacity: 1,
            visible: true,
            joinType: StrokeJoinTypes.MITER,
            capType: StrokeCapTypes.BUTT,
            miterAngle: 28.96
          })
        ],
        {
          metadata: {
            ownerKeyPrefix: `legality-oracle:${scenario.id}:${scenario.position}`,
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
              ? [{ x: point.x, y: point.y, sharp: true }]
              : []
          }),
          clipInsideToFillDomain: true
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
    sourcePoints: topology.normalizedPoints,
    packets,
    finalFaces,
    renderEntries,
    pipelineTrace
  }
}

const legalityScenarios: readonly LegalityScenario[] = [
  {
    id: 'inside-convex',
    points: convexSource,
    position: 'inside',
    selfIntersecting: false
  },
  {
    id: 'outside-convex',
    points: convexSource,
    position: 'outside',
    selfIntersecting: false
  },
  {
    id: 'inside-concave',
    points: concaveSource,
    position: 'inside',
    selfIntersecting: false
  },
  {
    id: 'outside-concave',
    points: concaveSource,
    position: 'outside',
    selfIntersecting: false
  },
  {
    id: 'inside-self-intersecting',
    points: selfIntersectingSource,
    position: 'inside',
    selfIntersecting: true
  },
  {
    id: 'outside-self-intersecting',
    points: selfIntersectingSource,
    position: 'outside',
    selfIntersecting: true
  }
]

describe('formal stroke geometry oracle: independent legality clipping', () => {
  it('rejects synthetic inside, outside, and self-intersection wrong-side leak polygons with an independent source-domain sampler', () => {
    const insideLeak = collectWrongSideSamples({
      productPolygons: [
        [
          { x: 200, y: 30 },
          { x: 220, y: 30 },
          { x: 220, y: 50 },
          { x: 200, y: 50 }
        ]
      ],
      sourcePoints: convexSource,
      position: 'inside'
    })
    const outsideLeak = collectWrongSideSamples({
      productPolygons: [
        [
          { x: 55, y: 35 },
          { x: 78, y: 35 },
          { x: 78, y: 58 },
          { x: 55, y: 58 }
        ]
      ],
      sourcePoints: convexSource,
      position: 'outside'
    })
    const selfIntersectingLeak = collectWrongSideSamples({
      productPolygons: [
        [
          { x: 154, y: 62 },
          { x: 172, y: 62 },
          { x: 172, y: 80 },
          { x: 154, y: 80 }
        ]
      ],
      sourcePoints: selfIntersectingSource,
      position: 'inside'
    })

    expect(insideLeak.length).toBeGreaterThan(0)
    expect(outsideLeak.length).toBeGreaterThan(0)
    expect(selfIntersectingLeak.length).toBeGreaterThan(0)
  })

  it('clips constrained inside/outside dashed products against legal domains without wrong-side product samples', () => {
    for (const scenario of legalityScenarios) {
      const {
        packets,
        finalFaces,
        renderEntries,
        pipelineTrace,
        sourcePoints
      } = buildLegalityPipeline(scenario)
      const productPolygons = renderEntries.flatMap(
        materializeVisibleEntryPolygonsForOracle
      )

      expect(finalFaces.length, `${scenario.id}:final-faces`).toBeGreaterThan(0)
      expect(productPolygons.length, scenario.id).toBeGreaterThan(0)
      expect(
        renderEntries.some(
          (entry) =>
            entry.debugMeta?.ownerStage ===
              'Stroke Geometry legality clipping' ||
            entry.debugMeta?.routeId === 'legality-product-unit-clipping' ||
            entry.debugMeta?.productMode?.includes('constrained')
        ),
        `${scenario.id}:legality-owner-metadata`
      ).toBe(true)
      expect(
        JSON.stringify(renderEntries),
        `${scenario.id}:diagnostics-not-visible`
      ).not.toContain('diagnostic/helper visible')

      const wrongSideSamples = collectWrongSideSamples({
        productPolygons,
        sourcePoints,
        position: scenario.position
      })

      expect(
        wrongSideSamples.map((sample) => ({
          reason: sample.reason,
          point: {
            x: Number(sample.point.x.toFixed(3)),
            y: Number(sample.point.y.toFixed(3))
          }
        })),
        wrongSideSamples.length > 0
          ? JSON.stringify(
              compactStageBoundarySummary(
                buildLegalityBoundarySummaries({
                  packets,
                  finalFaces,
                  renderEntries,
                  pipelineTrace,
                  sourcePoints,
                  position: scenario.position
                })
              ),
              null,
              2
            )
          : `${scenario.id}:wrong-side-samples`
      ).toEqual([])
    }
  })

  it('proves outside-convex legality boundaries stay clean from Step 32 through renderer projection input', () => {
    const scenario = legalityScenarios.find(
      (candidate) => candidate.id === 'outside-convex'
    )
    expect(scenario).toBeDefined()
    if (!scenario) {
      return
    }

    const { packets, finalFaces, renderEntries, pipelineTrace, sourcePoints } =
      buildLegalityPipeline(scenario)
    const summaries = buildLegalityBoundarySummaries({
      packets,
      finalFaces,
      renderEntries,
      pipelineTrace,
      sourcePoints,
      position: 'outside'
    })
    const compactSummaries = compactStageBoundarySummary(summaries)

    const postLegalityStages = summaries.filter((summary) =>
      [
        'step32-descriptor-product-polygons',
        'step36-materialized-descriptor-from-packets',
        'step35-final-face-declared-polygons',
        'step36-materialized-descriptor-from-final-faces',
        'renderer-projection-input-visible-polygons'
      ].includes(summary.stageId)
    )

    for (const summary of postLegalityStages) {
      expect(
        summary.wrongSideSamples.map((sample) => ({
          reason: sample.reason,
          artifactId: sample.artifactId,
          ownerStage: sample.ownerStage,
          routeId: sample.routeId,
          visibleContributor: sample.visibleContributor,
          geometryBasis: sample.geometryBasis,
          legalDomainIds: sample.legalDomainIds,
          contourIds: sample.contourIds,
          channelSummary: sample.channelSummary,
          point: {
            x: Number(sample.point.x.toFixed(3)),
            y: Number(sample.point.y.toFixed(3))
          }
        })),
        JSON.stringify(compactSummaries, null, 2)
      ).toEqual([])
    }
  })

  it('keeps Step 28 source-vertex join evidence separate from post-legality visible products', () => {
    const pipelines = legalityScenarios.map((scenario) => {
      const pipeline = buildLegalityPipeline(scenario)
      const preLegalityProducts = [
        ...pipeline.packets.flatMap((packet) => {
          const meta = packet.geometry.debugMeta
          return (meta?.joinOwnershipRecords ?? []).flatMap((record) =>
            record.kind === 'source-vertex'
              ? (record.preLegalityProductUnits ?? []).map((unit) => ({
                  unit,
                  meta
                }))
              : []
          )
        }),
        ...pipeline.pipelineTrace.flatMap((trace) => {
          if (
            trace.eventName !==
            'constrained-dashed-pre-legality-source-vertex-products'
          ) {
            return []
          }
          const payload = trace.payload as NonNullable<
            LegalityPacket['geometry']['debugMeta']
          > & {
            artifactId?: string
            productId?: string
            productMode?: 'pre-legality-source-vertex-join'
            polygons?: Vec2[][]
          }
          return payload.polygons && payload.polygons.length > 0
            ? [
                {
                  unit: {
                    artifactId: String(payload.artifactId),
                    productId: String(payload.productId),
                    productMode:
                      payload.productMode ?? 'pre-legality-source-vertex-join',
                    ownerStage:
                      'Stroke Geometry source-vertex join assembly' as const,
                    routeId:
                      'constrained-dashed-source-vertex-join-product' as const,
                    visibleContributor: 'source-vertex-join' as const,
                    geometryBasis: 'canonical-join-footprint' as const,
                    polygons: payload.polygons
                  },
                  meta: payload
                }
              ]
            : []
        })
      ]
      return {
        scenario,
        ...pipeline,
        preLegalityProducts
      }
    })
    const selectedPipeline = pipelines.find(
      (pipeline) =>
        pipeline.scenario.position === 'outside' &&
        pipeline.preLegalityProducts.length > 0
    )
    expect(
      selectedPipeline?.preLegalityProducts.length ?? 0,
      'at least one legality scenario must exercise Step 28 source-vertex pre-legality products'
    ).toBeGreaterThan(0)
    if (!selectedPipeline) {
      return
    }
    const {
      scenario,
      packets,
      finalFaces,
      renderEntries,
      pipelineTrace,
      sourcePoints,
      preLegalityProducts
    } = selectedPipeline

    expect(
      preLegalityProducts.length,
      'Step 28 must expose source-vertex pre-legality product units for owner-boundary oracles'
    ).toBeGreaterThan(0)

    for (const { unit, meta } of preLegalityProducts) {
      expect(unit.ownerStage).toBe(
        'Stroke Geometry source-vertex join assembly'
      )
      expect(unit.routeId).toBe('constrained-dashed-source-vertex-join-product')
      expect(unit.productMode).toBe('pre-legality-source-vertex-join')
      expect(unit.polygons.length, unit.artifactId).toBeGreaterThan(0)

      const seamBoundaries = meta?.seamEvidence?.incidentSeamBoundaries ?? []
      expect(
        seamBoundaries.length,
        `${unit.artifactId}: Step 28 evidence must carry Step 27 seam endpoint identity`
      ).toBeGreaterThanOrEqual(2)
      for (const seamBoundary of seamBoundaries) {
        expect(
          distanceToPolygons(
            seamBoundary.outerBodyBoundaryEndpoint,
            unit.polygons
          ),
          `${unit.artifactId}:${seamBoundary.seamBoundaryId} must preserve the Step 27 outer endpoint on the pre-legality join product`
        ).toBeLessThanOrEqual(SEAM_IDENTITY_TOLERANCE)
      }
    }

    const summaries = buildLegalityBoundarySummaries({
      packets,
      finalFaces,
      renderEntries,
      pipelineTrace,
      sourcePoints,
      position: scenario.position
    })
    const postLegalityStageIds = new Set([
      'step32-descriptor-product-polygons',
      'step36-materialized-descriptor-from-packets',
      'step35-final-face-declared-polygons',
      'step36-materialized-descriptor-from-final-faces',
      'step38-render-entry-declared-polygons',
      'renderer-projection-input-visible-polygons'
    ])
    for (const summary of summaries.filter((candidate) =>
      postLegalityStageIds.has(candidate.stageId)
    )) {
      expect(
        summary.wrongSideSamples.map((sample) => ({
          reason: sample.reason,
          artifactId: sample.artifactId,
          ownerStage: sample.ownerStage,
          routeId: sample.routeId,
          visibleContributor: sample.visibleContributor,
          geometryBasis: sample.geometryBasis,
          channelSummary: sample.channelSummary,
          point: {
            x: Number(sample.point.x.toFixed(3)),
            y: Number(sample.point.y.toFixed(3))
          }
        })),
        `${summary.stageId} must consume post-legality visible products, not Step 28 pre-legality evidence`
      ).toEqual([])
    }

    const preLegalityArtifactIds = new Set(
      preLegalityProducts.map(({ unit }) => unit.artifactId)
    )
    const visibleArtifacts = [
      ...buildFinalFaceStageArtifacts(finalFaces),
      ...buildRenderEntryDeclaredArtifacts(renderEntries),
      ...buildRenderEntryVisibleArtifacts(renderEntries)
    ]
    expect(
      visibleArtifacts.filter(
        (artifact) =>
          preLegalityArtifactIds.has(artifact.artifactId) ||
          artifact.channelSummary === 'pre-legality-source-vertex-join'
      ),
      'Step 35/38 visible artifacts must not reuse Step 28 pre-legality artifact ids or channels'
    ).toEqual([])
  })
})
