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
import '../../components/vector'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../../components/stroke-render/clipper2-geometry-backend'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  getConstrainedDashedVisibleIntervals
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import {
  getGeometryBackend,
  registerGeometryBackend,
  selectGeometryBackend
} from '../../components/stroke-render/geometry-backend'
import {
  buildVectorGeometryModelPath,
  samplePathSegmentFrameAtLength
} from '../../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../../components/stroke-render/resolved-vector-geometry-model'
import { resolveSourceFamily } from '../../components/stroke-render/resolved-source-family'
import {
  buildSolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeHitTestPacketsFromFinalFaces,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import {
  buildRoundStrokeArcPointsBetween,
  type Vec2
} from '../../components/stroke-render/solid-stroke-geometry-core'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import { resolveStrokeDomains } from '../../components/stroke-render/stroke-domain-plan'

type ReportedJoinType = 'miter' | 'bevel' | 'round'
type ReportedRenderEntry = ReturnType<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[number]
interface ReportedGeometryProduct {
  polygons: Vec2[][]
  bounds?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  debugMeta?: ReportedRenderEntry['debugMeta']
}
type ReportedPacket = ReturnType<
  typeof buildConstrainedDashedStrokeResolvedPackets
>[number]
type RuntimeProductEvidenceEnvelope = NonNullable<
  NonNullable<
    ReportedPacket['geometry']['debugMeta']
  >['productEvidenceEnvelope']
>
interface ReportedPipelineTrace {
  eventName: string
  payload: Record<string, unknown>
}
type ReportedJoinOwnershipRecord = NonNullable<
  NonNullable<ReportedRenderEntry['debugMeta']>['joinOwnershipRecords']
>[number]
interface RuntimeJoinSeamEvidence {
  seamTolerance?: number
  protectedContinuityOverlapDistance?: number
  seamCoveragePolicy: 'shared-seam-boundary-artifact-endpoint-identity'
  incidentSeamBoundaries: {
    seamBoundaryId: string
    intervalId: string
    splitRangeId?: string
    splitRangeAliasIds?: string[]
    side: 'previous' | 'next'
    point: Vec2
    pointId?: string
    outerBodyBoundaryEndpoint: Vec2
    outerBodyBoundaryEndpointId?: string
    outerBodyBoundaryVertices: Vec2[]
    bodySideOutlineSegment: [Vec2, Vec2]
    bodySideOutlineSegmentId?: string
    bodySideTangent: Vec2
    selectedSide?: 'left' | 'right'
    terminalRole?: 'middle' | 'start' | 'end' | 'start-end'
    endpointCapPolicySignature?: string
    capSuppressed?: boolean
    sourceSegmentIndex?: number
  }[]
}
type RuntimeDashBodySeamBoundary = NonNullable<
  NonNullable<ReportedRenderEntry['debugMeta']>['dashBodySeamBoundaries']
>[number]

const SOURCE_SPACE_FLOATING_EPSILON = 0.001

const getUniqueTestStrings = (values: (string | undefined)[]) =>
  Array.from(
    new Set(values.filter((value): value is string => value !== undefined))
  )

const getUniqueSmoothContinuityOwnershipOverlays = (
  envelopes: readonly RuntimeProductEvidenceEnvelope[]
) =>
  Array.from(
    new Map(
      envelopes
        .flatMap((envelope) => envelope.smoothContinuityOwnershipOverlays)
        .map((overlay) => [overlay.overlayId, overlay] as const)
    ).values()
  ).sort((left, right) => left.overlayId.localeCompare(right.overlayId))

const getUniqueTerminalOwnershipOverlays = (
  envelopes: readonly RuntimeProductEvidenceEnvelope[]
) =>
  Array.from(
    new Map(
      envelopes
        .flatMap((envelope) => envelope.terminalOwnershipOverlays)
        .map((overlay) => [overlay.overlayId, overlay] as const)
    ).values()
  ).sort((left, right) => left.overlayId.localeCompare(right.overlayId))

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const EXACT_BACKEND_ID = 'clipper2-new-stroke-oracle-vector-34'

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ?? (() => null)

  const backend = createClipper2GeometryBackend(
    (await (
      Clipper2ZFactory as (options: {
        wasmBinary: Uint8Array
      }) => Promise<Clipper2Module>
    )({
      wasmBinary: readFileSync(clipperWasmPath)
    })) as Clipper2Module,
    {
      backendId: EXACT_BACKEND_ID,
      backendVersion: `${EXACT_BACKEND_ID}@test`
    }
  )
  registerGeometryBackend({
    backendId: EXACT_BACKEND_ID,
    load: () => backend
  })
  selectGeometryBackend(EXACT_BACKEND_ID)
})

const createReportedVector34Fixture = () => {
  const points: Record<string, VectorPointNode> = {
    'tp-113': {
      id: 'tp-113',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 1736.9285752346282,
      y: 1637.0696495055142,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-114': {
      id: 'tp-114',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 1524.996880430307,
      y: 2084.8608111081926,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-113:out': {
      id: 'tp-113:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1695.827499455158,
      y: 1783.4973593495902,
      controlForId: 'tp-113',
      controlRole: 'out'
    },
    'tp-114:in': {
      id: 'tp-114:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1426.5511899405578,
      y: 2087.5954136217965,
      controlForId: 'tp-114',
      controlRole: 'in'
    },
    'tp-114:out': {
      id: 'tp-114:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1648.0539935424936,
      y: 2081.4425579661875,
      controlForId: 'tp-114',
      controlRole: 'out'
    },
    'tp-115': {
      id: 'tp-115',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 1878.7860806278431,
      y: 1801.1458003217629,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-116': {
      id: 'tp-116',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 1472.0139567292267,
      y: 1708.852965487623,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-117': {
      id: 'tp-117',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 1808.711891216737,
      y: 2055.8056594011487,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-116:out': {
      id: 'tp-116:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1472.0139567292267,
      y: 1708.852965487623,
      controlForId: 'tp-116',
      controlRole: 'out'
    },
    'tp-117:in': {
      id: 'tp-117:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1772.8202332256828,
      y: 2115.6250893862393,
      controlForId: 'tp-117',
      controlRole: 'in'
    },
    'tp-117:out': {
      id: 'tp-117:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 1844.6035492077913,
      y: 1995.986229416058,
      controlForId: 'tp-117',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'ts-131': {
      id: 'ts-131',
      startId: 'tp-113',
      endId: 'tp-114',
      outControlId: 'tp-113:out',
      inControlId: 'tp-114:in'
    },
    'ts-132': {
      id: 'ts-132',
      startId: 'tp-114',
      endId: 'tp-115',
      outControlId: 'tp-114:out',
      inControlId: null
    },
    'ts-133': {
      id: 'ts-133',
      startId: 'tp-115',
      endId: 'tp-116',
      outControlId: null,
      inControlId: null
    },
    'ts-134': {
      id: 'ts-134',
      startId: 'tp-116',
      endId: 'tp-117',
      outControlId: 'tp-116:out',
      inControlId: 'tp-117:in'
    },
    'ts-135': {
      id: 'ts-135',
      startId: 'tp-117',
      endId: 'tp-113',
      outControlId: 'tp-117:out',
      inControlId: null
    }
  }
  const network: VectorNetwork = {
    id: 'tn-28',
    pointIds: ['tp-113', 'tp-114', 'tp-115', 'tp-116', 'tp-117'],
    segmentIds: ['ts-131', 'ts-132', 'ts-133', 'ts-134', 'ts-135'],
    closed: true
  }

  return { network, points, segments }
}

const createSmoothCurvatureFixture = () => {
  const points: Record<string, VectorPointNode> = {
    'sp-1': {
      id: 'sp-1',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 390,
      y: 155,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'sp-2': {
      id: 'sp-2',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 700,
      y: 430,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'sp-3': {
      id: 'sp-3',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 390,
      y: 735,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'sp-4': {
      id: 'sp-4',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 80,
      y: 430,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'sp-1:in': {
      id: 'sp-1:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 210,
      y: 155,
      controlForId: 'sp-1',
      controlRole: 'in'
    },
    'sp-1:out': {
      id: 'sp-1:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 570,
      y: 155,
      controlForId: 'sp-1',
      controlRole: 'out'
    },
    'sp-2:in': {
      id: 'sp-2:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 700,
      y: 250,
      controlForId: 'sp-2',
      controlRole: 'in'
    },
    'sp-2:out': {
      id: 'sp-2:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 700,
      y: 610,
      controlForId: 'sp-2',
      controlRole: 'out'
    },
    'sp-3:in': {
      id: 'sp-3:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 570,
      y: 735,
      controlForId: 'sp-3',
      controlRole: 'in'
    },
    'sp-3:out': {
      id: 'sp-3:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 210,
      y: 735,
      controlForId: 'sp-3',
      controlRole: 'out'
    },
    'sp-4:in': {
      id: 'sp-4:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 80,
      y: 610,
      controlForId: 'sp-4',
      controlRole: 'in'
    },
    'sp-4:out': {
      id: 'sp-4:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 80,
      y: 250,
      controlForId: 'sp-4',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'ss-1': {
      id: 'ss-1',
      startId: 'sp-1',
      endId: 'sp-2',
      outControlId: 'sp-1:out',
      inControlId: 'sp-2:in'
    },
    'ss-2': {
      id: 'ss-2',
      startId: 'sp-2',
      endId: 'sp-3',
      outControlId: 'sp-2:out',
      inControlId: 'sp-3:in'
    },
    'ss-3': {
      id: 'ss-3',
      startId: 'sp-3',
      endId: 'sp-4',
      outControlId: 'sp-3:out',
      inControlId: 'sp-4:in'
    },
    'ss-4': {
      id: 'ss-4',
      startId: 'sp-4',
      endId: 'sp-1',
      outControlId: 'sp-4:out',
      inControlId: 'sp-1:in'
    }
  }
  const network: VectorNetwork = {
    id: 'sn-1',
    pointIds: ['sp-1', 'sp-2', 'sp-3', 'sp-4'],
    segmentIds: ['ss-1', 'ss-2', 'ss-3', 'ss-4'],
    closed: true
  }

  return { network, points, segments }
}

const createReferenceAcuteFixture = () => {
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

const buildReportedStrokeWithJoin = (joinType: ReportedJoinType) =>
  createDefaultStroke({
    id: 'pp-711',
    style: StrokeStyles.DASHED,
    position: StrokePositions.OUTSIDE,
    width: 10,
    dash: 20,
    gap: 20,
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

const buildReferenceAcuteConstrainedStroke = (position: 'inside' | 'outside') =>
  createDefaultStroke({
    id: `reference-acute-${position}-stroke`,
    style: StrokeStyles.DASHED,
    position:
      position === 'inside' ? StrokePositions.INSIDE : StrokePositions.OUTSIDE,
    width: 10,
    dash: 45,
    gap: 20,
    color: '#ff0000',
    opacity: 0.5,
    visible: true,
    joinType: StrokeJoinTypes.MITER,
    capType: StrokeCapTypes.BUTT,
    miterAngle: 28.96
  })

const buildSmoothCurvatureStroke = () =>
  createDefaultStroke({
    id: 'smooth-stroke',
    style: StrokeStyles.DASHED,
    position: StrokePositions.OUTSIDE,
    width: 10,
    dash: 36,
    gap: 24,
    color: '#cccccc',
    opacity: 0.5,
    visible: true,
    joinType: StrokeJoinTypes.ROUND,
    capType: StrokeCapTypes.BUTT,
    miterAngle: 28.96
  })

const isNearPoint = (point: Vec2, target: Vec2, tolerance: number) =>
  Math.hypot(point.x - target.x, point.y - target.y) <= tolerance

const distance = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const subtract = (first: Vec2, second: Vec2): Vec2 => ({
  x: first.x - second.x,
  y: first.y - second.y
})

const dot = (first: Vec2, second: Vec2) =>
  first.x * second.x + first.y * second.y

const normalize = (vector: Vec2) => {
  const length = Math.hypot(vector.x, vector.y)
  return length > 1e-9 ? { x: vector.x / length, y: vector.y / length } : null
}

const minDistanceToPoints = (point: Vec2, targets: Vec2[]) =>
  Math.min(
    ...targets.map((target) =>
      Math.hypot(point.x - target.x, point.y - target.y)
    )
  )

const minDistanceToPolygonPoints = (point: Vec2, polygon: Vec2[]) =>
  minDistanceToPoints(point, polygon)

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
  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const vertex = polygon[index]
    if (!vertex) {
      continue
    }
    minDistance = Math.min(
      minDistance,
      distanceToSegment(
        point,
        vertex,
        polygon[(index + 1) % polygon.length] ?? vertex
      )
    )
  }
  return minDistance
}

const distanceToPolygons = (point: Vec2, polygons: Vec2[][]) => {
  let minDistance = Number.POSITIVE_INFINITY
  for (const polygon of polygons) {
    minDistance = Math.min(minDistance, distanceToPolygon(point, polygon))
  }
  return minDistance
}

const distanceToPolyline = (
  point: Vec2,
  polyline: readonly Vec2[],
  closed = false
) => {
  if (polyline.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (polyline.length === 1) {
    return distance(point, polyline[0])
  }
  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]
    const end = polyline[index + 1]
    if (!start || !end) {
      continue
    }
    minDistance = Math.min(minDistance, distanceToSegment(point, start, end))
  }
  const first = polyline[0]
  const last = polyline[polyline.length - 1]
  if (closed && first && last) {
    minDistance = Math.min(minDistance, distanceToSegment(point, last, first))
  }
  return minDistance
}

const distanceToReportedSourcePath = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  point: Vec2
) => {
  const samplingStep = Math.max(0.05, result.stroke.width * 0.01)
  const densePoints: Vec2[] = []
  for (const segment of result.sourcePath.segments) {
    const sampleCount = Math.max(1, Math.ceil(segment.length / samplingStep))
    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const frame = samplePathSegmentFrameAtLength(
        segment,
        (segment.length * sampleIndex) / sampleCount
      )
      const previous = densePoints[densePoints.length - 1]
      if (
        !previous ||
        distance(previous, frame.point) > SOURCE_SPACE_FLOATING_EPSILON
      ) {
        densePoints.push(frame.point)
      }
    }
  }
  return distanceToPolyline(point, densePoints, true)
}

const distanceToPolygonBoundary = (point: Vec2, polygon: Vec2[]) => {
  if (polygon.length === 0) {
    return Number.POSITIVE_INFINITY
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

const distanceToPolygonBoundaries = (point: Vec2, polygons: Vec2[][]) =>
  Math.min(
    ...polygons.map((polygon) => distanceToPolygonBoundary(point, polygon))
  )

const getPolygonsBounds = (polygons: Vec2[][]) => {
  const points = polygons.flat()
  if (points.length === 0) {
    return null
  }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.round(Math.min(...xs) * 1000) / 1000,
    minY: Math.round(Math.min(...ys) * 1000) / 1000,
    maxX: Math.round(Math.max(...xs) * 1000) / 1000,
    maxY: Math.round(Math.max(...ys) * 1000) / 1000
  }
}

const add = (first: Vec2, second: Vec2): Vec2 => ({
  x: first.x + second.x,
  y: first.y + second.y
})

const scale = (vector: Vec2, scalar: number): Vec2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar
})

const sourceSpaceWidthTolerance = (strokeWidth: number) =>
  Math.max(0.5, strokeWidth * 0.05)

const sourceSpaceSeamContinuityTolerance = SOURCE_SPACE_FLOATING_EPSILON

const getRuntimeJoinSeamEvidence = (
  meta: ReportedGeometryProduct['debugMeta']
) =>
  (
    meta as
      | {
          seamEvidence?: RuntimeJoinSeamEvidence
        }
      | undefined
  )?.seamEvidence

const getPacketIntervalIds = (
  meta: ReportedGeometryProduct['debugMeta'] | undefined
) =>
  new Set([
    ...(meta?.intervalIds ?? []),
    ...(meta?.intervalId ? [meta.intervalId] : []),
    ...(meta?.dashProductIntervals?.map((interval) => interval.intervalId) ??
      [])
  ])

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

const getSeamBoundaryIntervalCandidates = (
  seamBoundary: RuntimeJoinSeamEvidence['incidentSeamBoundaries'][number]
) =>
  new Set([
    seamBoundary.intervalId,
    ...Array.from(
      seamBoundary.splitRangeId?.matchAll(/interval:\d+/g) ?? [],
      (match) => match[0]
    )
  ])

const getDashBodyPacketsForSeamBoundary = (
  packets: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>,
  seamBoundary: RuntimeJoinSeamEvidence['incidentSeamBoundaries'][number]
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
  seamBoundary: RuntimeJoinSeamEvidence['incidentSeamBoundaries'][number],
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

const assertSeamEvidenceUsesStep27OuterEndpoints = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  product: ReportedGeometryProduct,
  sourceVertex: Vec2,
  label: string,
  options: {
    allowRenderProjectionMerge?: boolean
    allowStageVisibleCoverage?: boolean
    stageProducts?: readonly ReportedGeometryProduct[]
  } = {}
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  for (const seamBoundary of seamEvidence.incidentSeamBoundaries) {
    const { dashBodyPackets } = getExpectedOuterEndpointFromDashBodyPackets(
      result.packets,
      seamBoundary,
      sourceVertex
    )
    const matchingStep27Artifacts = dashBodyPackets
      .flatMap(
        (packet) => packet.geometry.debugMeta?.dashBodySeamBoundaries ?? []
      )
      .concat(
        (
          product.debugMeta as
            | {
                dashBodySeamBoundaries?: RuntimeDashBodySeamBoundary[]
              }
            | undefined
        )?.dashBodySeamBoundaries ?? []
      )
      .filter(
        (artifact): artifact is RuntimeDashBodySeamBoundary =>
          artifact.intervalId === seamBoundary.intervalId &&
          artifact.side === seamBoundary.side
      )
    expect(
      matchingStep27Artifacts.length,
      `${label} must expose a Step 28 dash body seam-boundary artifact for Step 29 to consume: ${JSON.stringify(
        {
          seamBoundaryId: seamBoundary.seamBoundaryId,
          intervalId: seamBoundary.intervalId,
          side: seamBoundary.side,
          dashBodyPacketCount: dashBodyPackets.length,
          matchingIntervalPackets: result.packets
            .filter((packet) =>
              getPacketIntervalIds(packet.geometry.debugMeta).has(
                seamBoundary.intervalId
              )
            )
            .map((packet) => ({
              routeId: packet.geometry.debugMeta?.routeId ?? null,
              visibleContributor:
                packet.geometry.debugMeta?.visibleContributor ?? null,
              geometryBasis: packet.geometry.debugMeta?.geometryBasis ?? null,
              productSignature:
                packet.geometry.debugMeta?.productSignature ?? null,
              polygonCount: packet.geometry.polygons.length,
              dashBodySeamBoundaryCount:
                packet.geometry.debugMeta?.dashBodySeamBoundaries?.length ?? 0
            })),
          packetArtifacts: dashBodyPackets.map(
            (packet) => packet.geometry.debugMeta?.dashBodySeamBoundaries ?? []
          ),
          relatedTrace: result.pipelineTrace
            .filter((trace) => {
              const payload = trace.payload
              const tracedIntervalId =
                typeof payload.intervalId === 'string'
                  ? payload.intervalId
                  : undefined
              const tracedIntervalIds = Array.isArray(payload.intervalIds)
                ? payload.intervalIds.filter(
                    (value): value is string => typeof value === 'string'
                  )
                : tracedIntervalId
                  ? [tracedIntervalId]
                  : []
              return tracedIntervalIds.includes(seamBoundary.intervalId)
            })
            .map((trace) => ({
              eventName: trace.eventName,
              payload: trace.payload
            }))
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)
    const matchingStep27Artifact = matchingStep27Artifacts.find(
      (artifact) =>
        artifact.seamBoundaryId === seamBoundary.seamBoundaryId ||
        artifact.outerBodyBoundaryEndpointId ===
          seamBoundary.outerBodyBoundaryEndpointId
    )
    expect(
      matchingStep27Artifact,
      `${label} Step 28 seam-boundary artifact must preserve the emitted dash body endpoint identity: ${JSON.stringify(
        {
          seamBoundaryId: seamBoundary.seamBoundaryId,
          step28OuterEndpointId: seamBoundary.outerBodyBoundaryEndpointId,
          step27Artifacts: matchingStep27Artifacts.map((artifact) => ({
            seamBoundaryId: artifact.seamBoundaryId,
            outerBodyBoundaryEndpointId: artifact.outerBodyBoundaryEndpointId,
            outerBodyBoundaryEndpoint: roundedRelativePoint(
              artifact.outerBodyBoundaryEndpoint,
              sourceVertex
            )
          }))
        },
        null,
        2
      )}`
    ).toBeDefined()
    if (matchingStep27Artifact) {
      expect(
        seamBoundary.outerBodyBoundaryEndpointId,
        `${label} Step 28 seam-boundary artifact must carry the emitted dash body outer endpoint id`
      ).toBeTruthy()
      expect(
        matchingStep27Artifact.outerBodyBoundaryEndpointId,
        `${label} Step 28 seam-boundary artifact must carry an outer endpoint id`
      ).toBeTruthy()
      expect(seamBoundary.outerBodyBoundaryEndpointId).toBe(
        matchingStep27Artifact.outerBodyBoundaryEndpointId
      )
      expect(
        distance(seamBoundary.point, sourceVertex),
        `${label} Step 28 seam-boundary artifact source point must be the canonical source vertex; zero visible seam gap does not allow terminal-derived near-vertex points: ${JSON.stringify(
          {
            seamBoundaryId: seamBoundary.seamBoundaryId,
            actual: roundedRelativePoint(seamBoundary.point, sourceVertex),
            expected: roundedRelativePoint(sourceVertex, sourceVertex)
          },
          null,
          2
        )}`
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
      expect(
        distance(matchingStep27Artifact.point, sourceVertex),
        `${label} Step 28 dash body seam-boundary artifact source point must be the canonical source vertex: ${JSON.stringify(
          {
            seamBoundaryId: matchingStep27Artifact.seamBoundaryId,
            actual: roundedRelativePoint(
              matchingStep27Artifact.point,
              sourceVertex
            ),
            expected: roundedRelativePoint(sourceVertex, sourceVertex)
          },
          null,
          2
        )}`
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
      expect(
        distance(seamBoundary.point, matchingStep27Artifact.point)
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
    }
    if (matchingStep27Artifact) {
      const dashBodyPolygons = dashBodyPackets.flatMap(
        (packet) => packet.geometry.polygons
      )
      const step27ArtifactSeamEdgeIsOnDashBodyBoundary = dashBodyPolygons.some(
        (polygon) =>
          edgeConnects(
            polygon,
            matchingStep27Artifact.point,
            matchingStep27Artifact.outerBodyBoundaryEndpoint,
            sourceSpaceSeamContinuityTolerance
          )
      )
      expect(
        step27ArtifactSeamEdgeIsOnDashBodyBoundary,
        `${label} Step 28 seam-boundary artifact must be the emitted dash body product boundary edge, not a planned or projected seam edge: ${JSON.stringify(
          {
            seamBoundaryId: matchingStep27Artifact.seamBoundaryId,
            intervalId: matchingStep27Artifact.intervalId,
            side: matchingStep27Artifact.side,
            terminalPoint: roundedRelativePoint(
              matchingStep27Artifact.point,
              sourceVertex
            ),
            outerBodyBoundaryEndpoint: roundedRelativePoint(
              matchingStep27Artifact.outerBodyBoundaryEndpoint,
              sourceVertex
            ),
            terminalPointBoundaryDistance:
              Math.round(
                distanceToPolygonBoundaries(
                  matchingStep27Artifact.point,
                  dashBodyPolygons
                ) * 1000
              ) / 1000,
            outerEndpointBoundaryDistance:
              Math.round(
                distanceToPolygonBoundaries(
                  matchingStep27Artifact.outerBodyBoundaryEndpoint,
                  dashBodyPolygons
                ) * 1000
              ) / 1000,
            dashBodyPacketCount: dashBodyPackets.length,
            dashBodyPolygons: dashBodyPolygons.map((polygon) =>
              polygon.map((point) => roundedRelativePoint(point, sourceVertex))
            )
          },
          null,
          2
        )}`
      ).toBe(true)

      expect(
        distance(
          seamBoundary.outerBodyBoundaryEndpoint,
          matchingStep27Artifact.outerBodyBoundaryEndpoint
        ),
        `${label} Step 28 seam-boundary artifact must reuse the emitted dash body outer endpoint coordinates with the same endpoint id: ${JSON.stringify(
          {
            seamBoundaryId: seamBoundary.seamBoundaryId,
            actual: roundedRelativePoint(
              seamBoundary.outerBodyBoundaryEndpoint,
              sourceVertex
            ),
            expected: roundedRelativePoint(
              matchingStep27Artifact.outerBodyBoundaryEndpoint,
              sourceVertex
            ),
            step27Artifact: {
              seamBoundaryId: matchingStep27Artifact.seamBoundaryId,
              outerBodyBoundaryEndpointId:
                matchingStep27Artifact.outerBodyBoundaryEndpointId,
              outerBodyBoundaryEndpoint: roundedRelativePoint(
                matchingStep27Artifact.outerBodyBoundaryEndpoint,
                sourceVertex
              )
            },
            dashBodyPacketDebug: dashBodyPackets.map((packet) => ({
              routeId: packet.geometry.debugMeta?.routeId ?? null,
              visibleContributor:
                packet.geometry.debugMeta?.visibleContributor ?? null,
              geometryBasis: packet.geometry.debugMeta?.geometryBasis ?? null,
              productSignature:
                packet.geometry.debugMeta?.productSignature ?? null,
              intervalId: packet.geometry.debugMeta?.intervalId ?? null,
              intervalIds: packet.geometry.debugMeta?.intervalIds ?? null,
              dashBodySeamBoundaryCount:
                packet.geometry.debugMeta?.dashBodySeamBoundaries?.length ?? 0
            })),
            productSignature: product.debugMeta?.productSignature ?? null
          },
          null,
          2
        )}`
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
    }

    const seamEdgeLength = distance(
      seamBoundary.point,
      seamBoundary.outerBodyBoundaryEndpoint
    )
    const diagnosticDashBodyPolygons = dashBodyPackets.flatMap(
      (packet) => packet.geometry.polygons
    )
    expect(
      Math.abs(seamEdgeLength - result.stroke.width),
      `${label} Step 28 incident terminal seam-boundary edge must preserve full stroke width before source-vertex join consumption: ${JSON.stringify(
        {
          seamBoundaryId: seamBoundary.seamBoundaryId,
          intervalId: seamBoundary.intervalId,
          side: seamBoundary.side,
          expectedStrokeWidth: result.stroke.width,
          seamEdgeLength: Math.round(seamEdgeLength * 1000) / 1000,
          terminalPoint: roundedRelativePoint(seamBoundary.point, sourceVertex),
          outerBodyBoundaryEndpoint: roundedRelativePoint(
            seamBoundary.outerBodyBoundaryEndpoint,
            sourceVertex
          ),
          bodySideOutlineSegment: seamBoundary.bodySideOutlineSegment.map(
            (point) => roundedRelativePoint(point, sourceVertex)
          ),
          step27Artifacts: matchingStep27Artifacts.map((artifact) => ({
            seamBoundaryId: artifact.seamBoundaryId,
            point: roundedRelativePoint(artifact.point, sourceVertex),
            outerBodyBoundaryEndpoint: roundedRelativePoint(
              artifact.outerBodyBoundaryEndpoint,
              sourceVertex
            ),
            seamEdgeLength:
              Math.round(
                distance(artifact.point, artifact.outerBodyBoundaryEndpoint) *
                  1000
              ) / 1000,
            visibleContributor:
              dashBodyPackets.find((packet) =>
                packet.geometry.debugMeta?.dashBodySeamBoundaries?.some(
                  (candidate) =>
                    candidate.seamBoundaryId === artifact.seamBoundaryId
                )
              )?.geometry.debugMeta?.visibleContributor ?? null
          })),
          dashBodyPolygons: diagnosticDashBodyPolygons.map((polygon) =>
            polygon.map((point) => roundedRelativePoint(point, sourceVertex))
          ),
          dashBodyPacketDebug: dashBodyPackets.map((packet) => ({
            geometryId: packet.geometry.geometryId,
            routeId: packet.geometry.debugMeta?.routeId ?? null,
            visibleContributor:
              packet.geometry.debugMeta?.visibleContributor ?? null,
            geometryBasis: packet.geometry.debugMeta?.geometryBasis ?? null,
            productSignature:
              packet.geometry.debugMeta?.productSignature ?? null,
            intervalId: packet.geometry.debugMeta?.intervalId ?? null,
            intervalIds: packet.geometry.debugMeta?.intervalIds ?? null,
            joinOwnershipSignature:
              packet.geometry.debugMeta?.joinOwnershipSignature ?? null,
            joinOwnershipSignatures:
              packet.geometry.debugMeta?.joinOwnershipSignatures ?? null,
            dashEndpointCapPolicySignature:
              packet.geometry.debugMeta?.dashEndpointCapPolicySignature ?? null
          })),
          productSignature: product.debugMeta?.productSignature ?? null,
          routeId: product.debugMeta?.routeId ?? null,
          ownerStage: product.debugMeta?.ownerStage ?? null
        },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(sourceSpaceSeamContinuityTolerance)

    const seamEdgeTolerance = sourceSpaceSeamContinuityTolerance
    const joinsShareStep27SeamEdge = product.polygons.some((polygon) =>
      edgeConnects(
        polygon,
        seamBoundary.point,
        seamBoundary.outerBodyBoundaryEndpoint,
        seamEdgeTolerance
      )
    )
    const visualOverlapCollapseStatus =
      (
        product as ReportedGeometryProduct & {
          runtimeMeta?: { visualOverlapCollapseStatus?: string }
        }
      ).runtimeMeta?.visualOverlapCollapseStatus ??
      product.debugMeta?.visualOverlapCollapseStatus
    const visualOverlapSourceFaceIds =
      product.debugMeta?.visualOverlapSourceFaceIds ?? []
    const seamMidpoint = {
      x: (seamBoundary.point.x + seamBoundary.outerBodyBoundaryEndpoint.x) / 2,
      y: (seamBoundary.point.y + seamBoundary.outerBodyBoundaryEndpoint.y) / 2
    }
    const mergedRenderProjectionPreservesSeamCoverage =
      options.allowRenderProjectionMerge === true &&
      visualOverlapCollapseStatus === 'render-projection-merged' &&
      visualOverlapSourceFaceIds.length > 0 &&
      distanceToPolygons(seamBoundary.point, product.polygons) <=
        seamEdgeTolerance &&
      distanceToPolygons(
        seamBoundary.outerBodyBoundaryEndpoint,
        product.polygons
      ) <= seamEdgeTolerance &&
      distanceToPolygons(seamMidpoint, product.polygons) <= seamEdgeTolerance
    const stageVisiblePolygons =
      options.allowStageVisibleCoverage === true && options.stageProducts
        ? getVisibleProductPolygons(options.stageProducts)
        : []
    const stageVisibleProductsPreserveSeamCoverage =
      stageVisiblePolygons.length > 0 &&
      distanceToPolygons(seamBoundary.point, stageVisiblePolygons) <=
        seamEdgeTolerance &&
      distanceToPolygons(
        seamBoundary.outerBodyBoundaryEndpoint,
        stageVisiblePolygons
      ) <= seamEdgeTolerance &&
      distanceToPolygons(seamMidpoint, stageVisiblePolygons) <=
        seamEdgeTolerance
    expect(
      joinsShareStep27SeamEdge ||
        mergedRenderProjectionPreservesSeamCoverage ||
        stageVisibleProductsPreserveSeamCoverage,
      `${label} source-vertex join polygon must share the full Step 28 seam-boundary artifact edge before render projection, or Step 39 must keep a single-paint merged projection with seam coverage provenance: ${JSON.stringify(
        {
          seamBoundaryId: seamBoundary.seamBoundaryId,
          intervalId: seamBoundary.intervalId,
          side: seamBoundary.side,
          terminalPoint: roundedRelativePoint(seamBoundary.point, sourceVertex),
          outerBodyBoundaryEndpoint: roundedRelativePoint(
            seamBoundary.outerBodyBoundaryEndpoint,
            sourceVertex
          ),
          seamEdgeTolerance,
          polygonCount: product.polygons.length,
          productSignature: product.debugMeta?.productSignature ?? null,
          routeId: product.debugMeta?.routeId ?? null,
          resolvedJoin: product.debugMeta?.resolvedJoin ?? null,
          visualOverlapCollapseStatus,
          visualOverlapSourceFaceIds,
          stageVisibleProductsPreserveSeamCoverage,
          seamPointDistanceToVisibleProduct: distanceToPolygons(
            seamBoundary.point,
            product.polygons
          ),
          seamOuterEndpointDistanceToVisibleProduct: distanceToPolygons(
            seamBoundary.outerBodyBoundaryEndpoint,
            product.polygons
          ),
          seamMidpointDistanceToVisibleProduct: distanceToPolygons(
            seamMidpoint,
            product.polygons
          ),
          polygons: product.polygons.map((polygon) =>
            polygon.map((point) => roundedRelativePoint(point, sourceVertex))
          )
        },
        null,
        2
      )}`
    ).toBe(true)
  }
}

const assertIncidentSeamDashSideCoverage = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  products: readonly ReportedGeometryProduct[],
  product: ReportedGeometryProduct,
  strokeWidth: number,
  sourceVertex: Vec2,
  label: string
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  const failures: {
    seamBoundaryId: string
    intervalId: string
    side: string
    tangentDistance: number
    widthRatio: number
    sample: Vec2
    distanceToIncidentDashBody: number
    distanceToVisibleProducts: number
    incidentPolygonCount: number
    productSignature: string | null
    preLegalityEvidenceSource?: unknown
    seamPoint?: Vec2
    outerBodyBoundaryEndpoint?: Vec2
    seamEdgeVector?: Vec2
    bodySideTangent: Vec2
    incidentProducts?: {
      visibleContributor: string | null
      routeId: string | null
      productSignature: string | null
      polygonCount: number
      bounds: ReturnType<typeof getPolygonsBounds>
      firstPolygon: Vec2[]
      polygons?: Vec2[][]
      distanceToSample: number
      seamBoundaryCount: number
      seamBoundaries?: {
        side: string
        point: Vec2
        outerBodyBoundaryEndpoint: Vec2
        bodySideTangent: Vec2
      }[]
    }[]
    nearestVisibleProducts?: {
      visibleContributor: string | null
      routeId: string | null
      productSignature: string | null
      intervalIds: string[]
      polygonCount: number
      bounds: ReturnType<typeof getPolygonsBounds>
      distanceToSample: number
    }[]
    nearestFinalFaceProducts?: {
      visibleContributor: string | null
      routeId: string | null
      productSignature: string | null
      intervalIds: string[]
      polygonCount: number
      bounds: ReturnType<typeof getPolygonsBounds>
      distanceToSample: number
    }[]
  }[] = []
  for (const seamBoundary of seamEvidence.incidentSeamBoundaries) {
    const bodyTangent = normalize(seamBoundary.bodySideTangent)
    if (!bodyTangent) {
      failures.push({
        seamBoundaryId: seamBoundary.seamBoundaryId,
        intervalId: seamBoundary.intervalId,
        side: seamBoundary.side,
        tangentDistance: 0,
        widthRatio: 0,
        sample: roundedRelativePoint(seamBoundary.point, sourceVertex),
        distanceToIncidentDashBody: Number.POSITIVE_INFINITY,
        distanceToVisibleProducts: Number.POSITIVE_INFINITY,
        incidentPolygonCount: 0,
        productSignature: product.debugMeta?.productSignature ?? null,
        preLegalityEvidenceSource: product.debugMeta?.preLegalityEvidenceSource,
        seamPoint: roundedRelativePoint(seamBoundary.point, sourceVertex),
        outerBodyBoundaryEndpoint: roundedRelativePoint(
          seamBoundary.outerBodyBoundaryEndpoint,
          sourceVertex
        ),
        seamEdgeVector: roundedForDiagnostic(
          subtract(seamBoundary.outerBodyBoundaryEndpoint, seamBoundary.point)
        ),
        bodySideTangent: seamBoundary.bodySideTangent
      })
      continue
    }
    const seamEdgeVector = subtract(
      seamBoundary.outerBodyBoundaryEndpoint,
      seamBoundary.point
    )
    const incidentPolygons = getVisibleIntervalPolygons(
      products,
      seamBoundary.intervalId
    )
    const visiblePolygons = getVisibleProductPolygons(products)
    for (const tangentDistance of [
      Math.max(0.05, strokeWidth * 0.005),
      Math.max(0.15, strokeWidth * 0.015),
      Math.max(0.5, strokeWidth * 0.1),
      Math.max(1, strokeWidth * 0.25),
      Math.max(2, strokeWidth * 0.45)
    ]) {
      for (const widthRatio of [0.02, 0.05, 0.1, 0.2, 0.45, 0.7, 0.9, 0.98]) {
        const seamPoint = add(
          seamBoundary.point,
          scale(seamEdgeVector, widthRatio)
        )
        const sample = add(seamPoint, scale(bodyTangent, tangentDistance))
        const sampleInsideFill = isPointInsideImplicitFillRegions(
          result,
          sample
        )
        if (
          result.stroke.position === StrokePositions.OUTSIDE &&
          sampleInsideFill
        ) {
          continue
        }
        const distanceToIncidentDashBody = distanceToPolygons(
          sample,
          incidentPolygons
        )
        const distanceToVisibleProducts = distanceToPolygons(
          sample,
          visiblePolygons
        )
        if (distanceToIncidentDashBody > sourceSpaceSeamContinuityTolerance) {
          const nearestVisibleProducts = products
            .filter(
              (candidate) =>
                candidate.polygons.length > 0 &&
                candidate.debugMeta?.visibleContributor !== undefined
            )
            .map((candidate) => ({
              visibleContributor:
                candidate.debugMeta?.visibleContributor ?? null,
              routeId: candidate.debugMeta?.routeId ?? null,
              productSignature: candidate.debugMeta?.productSignature ?? null,
              intervalIds: [...getPacketIntervalIds(candidate.debugMeta)],
              polygonCount: candidate.polygons.length,
              bounds: getPolygonsBounds(candidate.polygons),
              distanceToSample:
                Math.round(
                  distanceToPolygons(sample, candidate.polygons) * 1000
                ) / 1000
            }))
            .sort(
              (left, right) => left.distanceToSample - right.distanceToSample
            )
            .slice(0, 6)
          const nearestFinalFaceProducts = result.finalFaces
            .filter(
              (candidate) =>
                candidate.polygons.length > 0 &&
                candidate.debugMeta?.visibleContributor !== undefined
            )
            .map((candidate) => ({
              visibleContributor:
                candidate.debugMeta?.visibleContributor ?? null,
              routeId: candidate.debugMeta?.routeId ?? null,
              productSignature: candidate.debugMeta?.productSignature ?? null,
              intervalIds: [...getPacketIntervalIds(candidate.debugMeta)],
              polygonCount: candidate.polygons.length,
              bounds: getPolygonsBounds(candidate.polygons),
              distanceToSample:
                Math.round(
                  distanceToPolygons(sample, candidate.polygons) * 1000
                ) / 1000
            }))
            .sort(
              (left, right) => left.distanceToSample - right.distanceToSample
            )
            .slice(0, 6)
          const incidentProducts = products
            .filter(
              (candidate) =>
                candidate.polygons.length > 0 &&
                candidate.debugMeta?.visibleContributor !== undefined &&
                getPacketIntervalIds(candidate.debugMeta).has(
                  seamBoundary.intervalId
                )
            )
            .map((candidate) => ({
              visibleContributor:
                candidate.debugMeta?.visibleContributor ?? null,
              routeId: candidate.debugMeta?.routeId ?? null,
              productSignature: candidate.debugMeta?.productSignature ?? null,
              polygonCount: candidate.polygons.length,
              bounds: getPolygonsBounds(candidate.polygons),
              firstPolygon:
                candidate.polygons[0]?.map((point) =>
                  roundedRelativePoint(point, sourceVertex)
                ) ?? [],
              polygons: candidate.polygons
                .slice(0, 4)
                .map((polygon) =>
                  polygon.map((point) =>
                    roundedRelativePoint(point, sourceVertex)
                  )
                ),
              distanceToSample:
                Math.round(
                  distanceToPolygons(sample, candidate.polygons) * 1000
                ) / 1000,
              stageAreas: candidate.debugMeta?.stageAreas ?? null,
              stageBounds: candidate.debugMeta?.stageBounds ?? null,
              joinOwnershipRecords:
                candidate.debugMeta?.joinOwnershipRecords?.map((record) => ({
                  kind: record.kind,
                  area: record.area,
                  bounds: record.bounds,
                  stageBounds: record.stageBounds
                })) ?? null,
              seamBoundaryCount:
                (
                  candidate.debugMeta as
                    | {
                        dashBodySeamBoundaries?: RuntimeDashBodySeamBoundary[]
                      }
                    | undefined
                )?.dashBodySeamBoundaries?.length ?? 0,
              seamBoundaries: (
                candidate.debugMeta as
                  | {
                      dashBodySeamBoundaries?: RuntimeDashBodySeamBoundary[]
                    }
                  | undefined
              )?.dashBodySeamBoundaries?.map((boundary) => ({
                side: boundary.side,
                point: roundedRelativePoint(boundary.point, sourceVertex),
                outerBodyBoundaryEndpoint: roundedRelativePoint(
                  boundary.outerBodyBoundaryEndpoint,
                  sourceVertex
                ),
                bodySideTangent: roundedForDiagnostic(boundary.bodySideTangent)
              }))
            }))
          failures.push({
            seamBoundaryId: seamBoundary.seamBoundaryId,
            intervalId: seamBoundary.intervalId,
            side: seamBoundary.side,
            tangentDistance,
            widthRatio,
            sample: roundedRelativePoint(sample, sourceVertex),
            distanceToIncidentDashBody:
              Math.round(distanceToIncidentDashBody * 1000) / 1000,
            distanceToVisibleProducts:
              Math.round(distanceToVisibleProducts * 1000) / 1000,
            incidentPolygonCount: incidentPolygons.length,
            productSignature: product.debugMeta?.productSignature ?? null,
            preLegalityEvidenceSource:
              product.debugMeta?.preLegalityEvidenceSource,
            seamPoint: roundedRelativePoint(seamBoundary.point, sourceVertex),
            outerBodyBoundaryEndpoint: roundedRelativePoint(
              seamBoundary.outerBodyBoundaryEndpoint,
              sourceVertex
            ),
            seamEdgeVector: roundedForDiagnostic(seamEdgeVector),
            bodySideTangent: seamBoundary.bodySideTangent,
            incidentProducts,
            nearestVisibleProducts,
            nearestFinalFaceProducts
          })
        }
      }
    }
  }

  expect(
    {
      count: failures.length,
      examples: failures.slice(0, 12)
    },
    `${label} incident terminal interval must stay visibly covered behind each full-width source-vertex seam edge; seam-edge identity alone is not enough to prevent visible join/dash cracks`
  ).toEqual({ count: 0, examples: [] })
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

const isSourcePathReplay = (strokePath: Vec2[], sourceSamples: Vec2[]) => {
  if (strokePath.length < 8 || sourceSamples.length === 0) {
    return false
  }
  const nearSourceCount = strokePath.filter(
    (point) => minDistanceToPoints(point, sourceSamples) <= 0.1
  ).length
  return nearSourceCount / strokePath.length >= 0.8
}

const polygonSignedArea = (polygon: Vec2[]) =>
  polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return area + (point.x * next.y - next.x * point.y)
  }, 0) / 2

const polygonListArea = (polygons: Vec2[][]) =>
  polygons.reduce(
    (total, polygon) => total + Math.abs(polygonSignedArea(polygon)),
    0
  )

const roundedRelativePoint = (point: Vec2, anchor: Vec2) => ({
  x: Math.round((point.x - anchor.x) * 100) / 100,
  y: Math.round((point.y - anchor.y) * 100) / 100
})

const roundedForDiagnostic = (point: Vec2) => ({
  x: Math.round(point.x * 1000) / 1000,
  y: Math.round(point.y * 1000) / 1000
})

const getRenderEntryPaintSignature = (entry: ReportedRenderEntry) =>
  [
    entry.stroke.kind,
    entry.stroke.color,
    entry.stroke.alpha,
    entry.stroke.paintKey ?? ''
  ].join('|')

const assertNoSamePaintRenderEntryOverdraw = (
  renderEntries: ReportedRenderEntry[],
  label: string
) => {
  const sharedBoundaryTolerance = 0.05
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
      const boundaryDistance = getPolygonListBoundaryDistance(
        left.polygons,
        right.polygons
      )
      expect(
        overlapArea,
        `${label} Step 39 same-paint render entries must not create repeated-alpha overdraw: ${JSON.stringify(
          {
            leftIndex,
            rightIndex,
            overlapArea,
            left: {
              cacheKey: left.cacheKey,
              visibleContributor: left.debugMeta?.visibleContributor ?? null,
              routeId: left.debugMeta?.routeId ?? null,
              productSignature: left.debugMeta?.productSignature ?? null,
              intervalIds: left.runtimeMeta.intervalIds ?? [],
              visualOverlapCollapseStatus:
                left.runtimeMeta.visualOverlapCollapseStatus ?? null,
              polygons: left.polygons.map((polygon) =>
                polygon.map(roundedForDiagnostic)
              )
            },
            right: {
              cacheKey: right.cacheKey,
              visibleContributor: right.debugMeta?.visibleContributor ?? null,
              routeId: right.debugMeta?.routeId ?? null,
              productSignature: right.debugMeta?.productSignature ?? null,
              intervalIds: right.runtimeMeta.intervalIds ?? [],
              visualOverlapCollapseStatus:
                right.runtimeMeta.visualOverlapCollapseStatus ?? null,
              polygons: right.polygons.map((polygon) =>
                polygon.map(roundedForDiagnostic)
              )
            }
          },
          null,
          2
        )}`
      ).toBeLessThanOrEqual(SOURCE_SPACE_FLOATING_EPSILON)
      expect(
        boundaryDistance,
        `${label} Step 39 same-paint render entries with shared or near-shared boundaries must be merged before renderer projection to prevent high-zoom antialias seams: ${JSON.stringify(
          {
            leftIndex,
            rightIndex,
            boundaryDistance: Math.round(boundaryDistance * 1000) / 1000,
            sharedBoundaryTolerance,
            left: {
              cacheKey: left.cacheKey,
              visibleContributor: left.debugMeta?.visibleContributor ?? null,
              routeId: left.debugMeta?.routeId ?? null,
              productSignature: left.debugMeta?.productSignature ?? null,
              intervalIds: left.runtimeMeta.intervalIds ?? [],
              visualOverlapCollapseStatus:
                left.runtimeMeta.visualOverlapCollapseStatus ?? null
            },
            right: {
              cacheKey: right.cacheKey,
              visibleContributor: right.debugMeta?.visibleContributor ?? null,
              routeId: right.debugMeta?.routeId ?? null,
              productSignature: right.debugMeta?.productSignature ?? null,
              intervalIds: right.runtimeMeta.intervalIds ?? [],
              visualOverlapCollapseStatus:
                right.runtimeMeta.visualOverlapCollapseStatus ?? null
            }
          },
          null,
          2
        )}`
      ).toBeGreaterThan(sharedBoundaryTolerance)
    }
  }
}

const getPolygonBoundaryDistance = (left: Vec2[], right: Vec2[]) => {
  let minDistance = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftPoint = left[leftIndex]
    const leftNext = left[(leftIndex + 1) % left.length] ?? leftPoint
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightPoint = right[rightIndex]
      const rightNext = right[(rightIndex + 1) % right.length] ?? rightPoint
      minDistance = Math.min(
        minDistance,
        distanceToSegment(leftPoint, rightPoint, rightNext),
        distanceToSegment(leftNext, rightPoint, rightNext),
        distanceToSegment(rightPoint, leftPoint, leftNext),
        distanceToSegment(rightNext, leftPoint, leftNext)
      )
    }
  }
  return minDistance
}

const getCollinearSegmentOverlapLength = (
  leftStart: Vec2,
  leftEnd: Vec2,
  rightStart: Vec2,
  rightEnd: Vec2,
  tolerance: number
) => {
  const axis = subtract(leftEnd, leftStart)
  const axisLength = Math.hypot(axis.x, axis.y)
  const rightAxis = subtract(rightEnd, rightStart)
  const rightAxisLength = Math.hypot(rightAxis.x, rightAxis.y)
  if (
    axisLength <= SOURCE_SPACE_FLOATING_EPSILON ||
    rightAxisLength <= SOURCE_SPACE_FLOATING_EPSILON
  ) {
    return 0
  }

  const normalizedAxis = { x: axis.x / axisLength, y: axis.y / axisLength }
  const parallelDistance =
    Math.abs(axis.x * rightAxis.y - axis.y * rightAxis.x) /
    Math.max(axisLength, rightAxisLength)
  if (parallelDistance > tolerance) {
    return 0
  }

  const rightStartLineDistance =
    Math.abs(
      axis.x * (rightStart.y - leftStart.y) -
        axis.y * (rightStart.x - leftStart.x)
    ) / axisLength
  const rightEndLineDistance =
    Math.abs(
      axis.x * (rightEnd.y - leftStart.y) - axis.y * (rightEnd.x - leftStart.x)
    ) / axisLength
  if (rightStartLineDistance > tolerance || rightEndLineDistance > tolerance) {
    return 0
  }

  const leftRange: [number, number] = [0, axisLength]
  const rightRange = [rightStart, rightEnd]
    .map((point) => dot(subtract(point, leftStart), normalizedAxis))
    .sort((left, right) => left - right) as [number, number]
  return Math.max(
    0,
    Math.min(leftRange[1], rightRange[1]) -
      Math.max(leftRange[0], rightRange[0])
  )
}

const getPolygonSharedBoundaryLength = (
  left: Vec2[],
  right: Vec2[],
  tolerance: number
) => {
  let sharedLength = 0
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftPoint = left[leftIndex]
    const leftNext = left[(leftIndex + 1) % left.length] ?? leftPoint
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightPoint = right[rightIndex]
      const rightNext = right[(rightIndex + 1) % right.length] ?? rightPoint
      sharedLength += getCollinearSegmentOverlapLength(
        leftPoint,
        leftNext,
        rightPoint,
        rightNext,
        tolerance
      )
    }
  }
  return sharedLength
}

const assertNoInternalSharedBoundaryRenderPolygons = (
  renderEntries: ReportedRenderEntry[],
  label: string
) => {
  const sharedBoundaryTolerance = 0.05
  const failures: {
    entryIndex: number
    pair: [number, number]
    boundaryDistance: number
    sharedBoundaryLength: number
    overlapArea: number
    cacheKey: string
    visibleContributor: string | null
    routeId: string | null
    productSignature: string | null
    visualOverlapCollapseStatus: string | null
    intervalIds: string[]
    polygonCount: number
  }[] = []

  for (let entryIndex = 0; entryIndex < renderEntries.length; entryIndex += 1) {
    const entry = renderEntries[entryIndex]
    if (!entry || entry.polygons.length < 2) {
      continue
    }

    for (let leftIndex = 0; leftIndex < entry.polygons.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < entry.polygons.length;
        rightIndex += 1
      ) {
        const leftPolygon = entry.polygons[leftIndex]
        const rightPolygon = entry.polygons[rightIndex]
        const intersections = getGeometryBackend().intersection(
          [{ polygons: [leftPolygon] }],
          [{ polygons: [rightPolygon] }],
          'nonzero'
        )
        const overlapArea = polygonListArea(
          intersections.flatMap((region) => region.polygons)
        )
        const boundaryDistance = getPolygonBoundaryDistance(
          leftPolygon,
          rightPolygon
        )
        const sharedBoundaryLength = getPolygonSharedBoundaryLength(
          leftPolygon,
          rightPolygon,
          sharedBoundaryTolerance
        )
        if (
          overlapArea <= SOURCE_SPACE_FLOATING_EPSILON &&
          sharedBoundaryLength <= sharedBoundaryTolerance
        ) {
          continue
        }

        failures.push({
          entryIndex,
          pair: [leftIndex, rightIndex],
          boundaryDistance: Math.round(boundaryDistance * 1000) / 1000,
          sharedBoundaryLength: Math.round(sharedBoundaryLength * 1000) / 1000,
          overlapArea: Math.round(overlapArea * 1000) / 1000,
          cacheKey: entry.cacheKey,
          visibleContributor: entry.debugMeta?.visibleContributor ?? null,
          routeId: entry.debugMeta?.routeId ?? null,
          productSignature: entry.debugMeta?.productSignature ?? null,
          visualOverlapCollapseStatus:
            entry.runtimeMeta.visualOverlapCollapseStatus ?? null,
          intervalIds: entry.runtimeMeta.intervalIds ?? [],
          polygonCount: entry.polygons.length,
          polygons: [leftPolygon, rightPolygon].map((polygon) =>
            polygon.map(roundedForDiagnostic)
          )
        })
      }
    }
  }

  expect(
    {
      count: failures.length,
      examples: failures.slice(0, 12)
    },
    `${label} Step 39 render entries must not carry internally overlapping or shared-boundary same-paint polygons into renderer projection; disjoint dash products may remain separate, but touching products must be canonically merged before high-zoom rendering`
  ).toEqual({ count: 0, examples: [] })
}

const assertOutsideVisibleProductsDoNotEnterImplicitFillRegions = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  products: readonly ReportedGeometryProduct[],
  label: string
) => {
  const fillRegions = result.implicitFillRegions
  if (fillRegions.length === 0) {
    return
  }

  const failures = products
    .filter(
      (product) =>
        product.polygons.length > 0 &&
        product.debugMeta?.visibleContributor !== undefined
    )
    .map((product, productIndex) => {
      const intersectionRegions = getGeometryBackend().intersection(
        [{ polygons: product.polygons }],
        fillRegions,
        'nonzero'
      )
      const intersectionPolygons = intersectionRegions.flatMap(
        (region) => region.polygons
      )
      const intersectionArea = polygonListArea(intersectionPolygons)
      return {
        productIndex,
        intersectionArea,
        intersectionPolygons,
        product
      }
    })
    .filter(
      ({ intersectionArea }) => intersectionArea > SOURCE_SPACE_FLOATING_EPSILON
    )
    .map(
      ({ productIndex, intersectionArea, intersectionPolygons, product }) => ({
        productIndex,
        intersectionArea: Math.round(intersectionArea * 1000) / 1000,
        ownerStage: product.debugMeta?.ownerStage ?? null,
        routeId: product.debugMeta?.routeId ?? null,
        visibleContributor: product.debugMeta?.visibleContributor ?? null,
        geometryBasis: product.debugMeta?.geometryBasis ?? null,
        productSignature: product.debugMeta?.productSignature ?? null,
        intervalIds: [...getPacketIntervalIds(product.debugMeta)],
        resolvedJoin: product.debugMeta?.resolvedJoin ?? null,
        joinOwnershipRecords:
          product.debugMeta?.joinOwnershipRecords?.map((record) => ({
            kind: record.kind,
            vertex: record.vertex ? roundedForDiagnostic(record.vertex) : null,
            materializationKind: record.materializationKind,
            selectedSide: record.selectedSide,
            domainKey: record.domainKey
          })) ?? [],
        bounds: getPolygonsBounds(product.polygons),
        intersectionPolygons: intersectionPolygons
          .slice(0, 4)
          .map((polygon) => polygon.map(roundedForDiagnostic)),
        polygonCount: product.polygons.length,
        polygons: product.polygons
          .slice(0, 4)
          .map((polygon) => polygon.map(roundedForDiagnostic))
      })
    )

  expect(
    {
      count: failures.length,
      examples: failures.slice(0, 12)
    },
    `${label} outside visible stroke products must not paint inside implicit fill regions; stroke position legality must be proven before Step 40 renderer projection`
  ).toEqual({ count: 0, examples: [] })
}

const getPolygonListBoundaryDistance = (
  leftPolygons: Vec2[][],
  rightPolygons: Vec2[][]
) => {
  const distances = [
    ...leftPolygons.flatMap((polygon) =>
      polygon.map((point) => distanceToPolygons(point, rightPolygons))
    ),
    ...rightPolygons.flatMap((polygon) =>
      polygon.map((point) => distanceToPolygons(point, leftPolygons))
    )
  ]
  return distances.length > 0
    ? Math.min(...distances)
    : Number.POSITIVE_INFINITY
}

const authoredMiterAngleToRendererMiterLimit = (miterAngle: number) =>
  1 / Math.sin((miterAngle * Math.PI) / 180 / 2)

const getSourceVertexJoinEntriesForAnchor = (
  renderEntries: ReportedGeometryProduct[],
  anchor: Vec2,
  tolerance: number
) =>
  renderEntries.filter(
    (entry) =>
      entry.debugMeta?.visibleContributor === 'source-vertex-join' &&
      entry.debugMeta.joinOwnershipRecords?.some(
        (record) =>
          record.kind === 'source-vertex' &&
          record.vertex !== undefined &&
          isNearPoint(record.vertex, anchor, tolerance)
      )
  )

const getPreLegalitySourceVertexJoinProducts = (
  packets: readonly ReportedPacket[],
  pipelineTrace: readonly ReportedPipelineTrace[] = []
): ReportedGeometryProduct[] => [
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
              seamEvidence: unit.seamEvidence ?? meta?.seamEvidence,
              dashBodySeamBoundaries:
                unit.dashBodySeamBoundaries ?? meta?.dashBodySeamBoundaries,
              preLegalityEvidenceSource: 'packet-unit',
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
    const payload = trace.payload as ReportedRenderEntry['debugMeta'] & {
      polygons?: Vec2[][]
    }
    return payload?.polygons && payload.polygons.length > 0
      ? [
          {
            polygons: payload.polygons,
            debugMeta: {
              ...payload,
              preLegalityEvidenceSource: 'pipeline-trace'
            }
          }
        ]
      : []
  })
]

const getIncidentDashBodyDeficit = (
  points: Vec2[],
  record: ReportedJoinOwnershipRecord
) => {
  if (!record.vertex) {
    return 0
  }

  return Math.max(
    0,
    ...[
      {
        contourPoint: record.previousContourPoint,
        dashBodyPoint: record.previousDashBodyPoint
      },
      {
        contourPoint: record.nextContourPoint,
        dashBodyPoint: record.nextDashBodyPoint
      }
    ].map(({ contourPoint, dashBodyPoint }) => {
      if (!contourPoint || !dashBodyPoint || !record.vertex) {
        return 0
      }
      const tangent = normalize(subtract(contourPoint, record.vertex))
      if (!tangent) {
        return 0
      }
      const incidentBodyExtent = distance(record.vertex, dashBodyPoint)
      const maxJoinReach = Math.max(
        0,
        ...points.map((point) => dot(subtract(point, record.vertex), tangent))
      )
      return incidentBodyExtent - maxJoinReach
    })
  )
}

const getMaxIncidentDashBodyDeficit = (
  entry: ReportedGeometryProduct,
  anchor: Vec2
) => {
  const seamEvidence = (
    entry.debugMeta as
      | {
          seamEvidence?: {
            incidentSeamBoundaries?: {
              point: Vec2
              outerBodyBoundaryEndpoint?: Vec2
            }[]
          }
        }
      | undefined
  )?.seamEvidence
  const seamBoundaries = seamEvidence?.incidentSeamBoundaries ?? []
  if (seamBoundaries.length > 0) {
    return Math.max(
      0,
      ...seamBoundaries.map((boundary) =>
        distanceToPolygons(
          boundary.outerBodyBoundaryEndpoint ?? boundary.point,
          entry.polygons
        )
      )
    )
  }

  const records =
    entry.debugMeta?.joinOwnershipRecords?.filter(
      (record) =>
        record.kind === 'source-vertex' &&
        record.vertex !== undefined &&
        isNearPoint(record.vertex, anchor, 5)
    ) ?? []
  const points = entry.polygons.flat()
  return Math.max(
    0,
    ...records.map((record) => getIncidentDashBodyDeficit(points, record))
  )
}

const roundPointForSeamDiagnostic = (point: Vec2) => ({
  x: Math.round(point.x * 1000) / 1000,
  y: Math.round(point.y * 1000) / 1000
})

const getIncidentDashBodyDeficitDiagnostics = (
  entry: ReportedGeometryProduct
) => {
  const seamEvidence = (
    entry.debugMeta as
      | {
          seamEvidence?: {
            incidentSeamBoundaries?: {
              seamBoundaryId?: string
              intervalId?: string
              side?: string
              point: Vec2
              outerBodyBoundaryEndpoint?: Vec2
            }[]
          }
        }
      | undefined
  )?.seamEvidence
  return {
    productMode: entry.debugMeta?.productMode,
    productSignature: entry.debugMeta?.productSignature,
    routeId: entry.debugMeta?.routeId,
    resolvedJoin: entry.debugMeta?.resolvedJoin,
    polygonCount: entry.polygons.length,
    polygons: entry.polygons.map((polygon) =>
      polygon.map(roundPointForSeamDiagnostic)
    ),
    seamDistances: (seamEvidence?.incidentSeamBoundaries ?? []).map(
      (boundary) => {
        const point = boundary.outerBodyBoundaryEndpoint ?? boundary.point
        const nearestVertex = entry.polygons
          .flat()
          .map((vertex) => ({
            vertex,
            distance: distance(point, vertex)
          }))
          .sort((left, right) => left.distance - right.distance)[0]
        return {
          seamBoundaryId: boundary.seamBoundaryId,
          intervalId: boundary.intervalId,
          side: boundary.side,
          terminalPoint: roundPointForSeamDiagnostic(boundary.point),
          outerBodyBoundaryEndpoint: boundary.outerBodyBoundaryEndpoint
            ? roundPointForSeamDiagnostic(boundary.outerBodyBoundaryEndpoint)
            : undefined,
          bodySideOutlineSegment: boundary.bodySideOutlineSegment?.map(
            roundPointForSeamDiagnostic
          ),
          point: roundPointForSeamDiagnostic(point),
          distanceToPolygons:
            Math.round(distanceToPolygons(point, entry.polygons) * 1000) / 1000,
          nearestVertex: nearestVertex
            ? roundPointForSeamDiagnostic(nearestVertex.vertex)
            : undefined,
          nearestVertexDistance: nearestVertex
            ? Math.round(nearestVertex.distance * 1000) / 1000
            : undefined
        }
      }
    )
  }
}

const getMaxSourceNearDistance = (
  entries: ReportedRenderEntry[],
  anchor: Vec2
) =>
  Math.max(
    0,
    ...entries.flatMap((entry) =>
      entry.polygons.flat().map((point) => distance(point, anchor))
    )
  )

const sourceNearWindowForStrokeWidth = (strokeWidth: number) =>
  strokeWidth * 2 + 0.5

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

const assertResolvedMiterUsesTheoreticalBounds = (
  entries: ReportedGeometryProduct[],
  anchorId: string
) => {
  expect(entries.length, `${anchorId} resolved miter entries`).toBeGreaterThan(
    0
  )
  entries.forEach((entry) => {
    expect(entry.debugMeta?.resolvedJoin, `${anchorId} resolved join`).toBe(
      'miter'
    )
    const stageBounds = entry.debugMeta?.joinOwnershipRecords?.find(
      (record) =>
        record.kind === 'source-vertex' &&
        record.materializationKind === 'join' &&
        record.stageBounds !== undefined
    )?.stageBounds
    expect(stageBounds, `${anchorId} miter stage bounds`).toBeDefined()
    expect(
      stageBounds?.canonicalTheoreticalMiterFootprint,
      `${anchorId} theoretical miter footprint`
    ).toBeDefined()
    expect(
      stageBounds?.canonicalLegalMiterFootprint,
      `${anchorId} legal miter footprint`
    ).toBeDefined()
    expect(
      stageBounds?.sourceNearLimitedMiterFootprint,
      `${anchorId} resolved miter must not be capped by source-near window`
    ).toBeUndefined()
    const theoretical = stageBounds?.canonicalTheoreticalMiterFootprint
    const legal = stageBounds?.canonicalLegalMiterFootprint
    if (theoretical && legal) {
      expect(
        boundsDelta(legal, theoretical),
        `${anchorId} legal miter bounds must preserve theoretical miter apex`
      ).toBeLessThanOrEqual(0.001)
    }
  })
}

const assertBevelChordUsesIncidentDashOuterEndpoints = (
  product: ReportedGeometryProduct,
  label: string
) => {
  expect(product.debugMeta?.authoredJoin, `${label} authored join`).toBe(
    'bevel'
  )
  expect(product.debugMeta?.resolvedJoin, `${label} resolved join`).toBe(
    'bevel'
  )
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  const endpoints = uniqueOuterBodyBoundaryEndpoints(seamEvidence)
  expect(
    endpoints.length,
    `${label} must expose both incident dash outer body boundary endpoints: ${JSON.stringify(
      {
        endpoints,
        incidentSeamBoundaries: seamEvidence.incidentSeamBoundaries
      },
      null,
      2
    )}`
  ).toBeGreaterThanOrEqual(2)

  const endpointTolerance = SOURCE_SPACE_FLOATING_EPSILON
  const hasOuterEndpointChord = endpoints.some((firstEndpoint, firstIndex) =>
    endpoints
      .slice(firstIndex + 1)
      .some((secondEndpoint) =>
        product.polygons.some((polygon) =>
          edgeConnects(
            polygon,
            firstEndpoint,
            secondEndpoint,
            endpointTolerance
          )
        )
      )
  )

  expect(
    hasOuterEndpointChord,
    `${label} bevel chord must directly connect incident dash outer body boundary endpoints, not selected-side or inward points: ${JSON.stringify(
      {
        endpoints: endpoints.map((endpoint) => ({
          x: Math.round(endpoint.x * 1000) / 1000,
          y: Math.round(endpoint.y * 1000) / 1000
        })),
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

const assertRoundUsesLocalSourceVertexArc = (
  product: ReportedGeometryProduct,
  anchor: Vec2,
  label: string
) => {
  expect(product.debugMeta?.authoredJoin, `${label} authored join`).toBe(
    'round'
  )
  expect(product.debugMeta?.resolvedJoin, `${label} resolved join`).toBe(
    'round'
  )
  const seamEvidence = getRuntimeJoinSeamEvidence(product.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  const hasSourceVertexJoinRecord =
    product.debugMeta?.joinOwnershipRecords?.some(
      (record) =>
        record.kind === 'source-vertex' && record.materializationKind === 'join'
    ) === true
  expect(
    hasSourceVertexJoinRecord,
    `${label} must preserve source-vertex join ownership metadata`
  ).toBe(true)

  const endpoints = uniqueOuterBodyBoundaryEndpoints(seamEvidence)
  expect(
    endpoints.length,
    `${label} must expose both incident dash outer body boundary endpoints`
  ).toBeGreaterThanOrEqual(2)

  const endpointTolerance = SOURCE_SPACE_FLOATING_EPSILON
  const arcDeviationThreshold = 0.5
  const hasArcPointAwayFromBevelChord = endpoints.some(
    (firstEndpoint, firstIndex) =>
      endpoints.slice(firstIndex + 1).some((secondEndpoint) =>
        product.polygons.some((polygon) =>
          polygon.some((point) => {
            const isSourceVertex = distance(point, anchor) <= endpointTolerance
            const isIncidentEndpoint =
              distance(point, firstEndpoint) <= endpointTolerance ||
              distance(point, secondEndpoint) <= endpointTolerance
            return (
              !isSourceVertex &&
              !isIncidentEndpoint &&
              distanceToSegment(point, firstEndpoint, secondEndpoint) >
                arcDeviationThreshold
            )
          })
        )
      )
  )

  expect(
    hasArcPointAwayFromBevelChord,
    `${label} round join must contain local arc boundary points instead of collapsing to the bevel chord: ${JSON.stringify(
      {
        endpoints: endpoints.map((endpoint) => ({
          x: Math.round(endpoint.x * 1000) / 1000,
          y: Math.round(endpoint.y * 1000) / 1000
        })),
        polygons: product.polygons.map((polygon) =>
          polygon.map((point) => ({
            x: Math.round(point.x * 1000) / 1000,
            y: Math.round(point.y * 1000) / 1000
          }))
        ),
        productSignature: product.debugMeta?.productSignature ?? null
      },
      null,
      2
    )}`
  ).toBe(true)

  const boundariesBySide = new Map<
    RuntimeJoinSeamEvidence['incidentSeamBoundaries'][number]['side'],
    RuntimeJoinSeamEvidence['incidentSeamBoundaries'][number][]
  >()
  for (const boundary of seamEvidence.incidentSeamBoundaries) {
    const boundaries = boundariesBySide.get(boundary.side) ?? []
    boundaries.push(boundary)
    boundariesBySide.set(boundary.side, boundaries)
  }
  const previousBoundaries = boundariesBySide.get('previous') ?? []
  const nextBoundaries = boundariesBySide.get('next') ?? []
  expect(
    previousBoundaries.length,
    `${label} round join must expose previous Step 28 seam-boundary evidence`
  ).toBeGreaterThan(0)
  expect(
    nextBoundaries.length,
    `${label} round join must expose next Step 28 seam-boundary evidence`
  ).toBeGreaterThan(0)

  const failures: {
    previousSeamBoundaryId: string
    nextSeamBoundaryId: string
    radiusRatio: number
    arcIndex: number
    sample: Vec2
    distanceToProduct: number
    previousOuterEndpoint: Vec2
    nextOuterEndpoint: Vec2
    visualOverlapCollapseStatus: string | null
    visualOverlapSourceFaceIds: string[]
    productSignature: string | null
    polygonCount: number
  }[] = []
  const sectorCoverageTolerance = sourceSpaceWidthTolerance(1)

  for (const previousBoundary of previousBoundaries) {
    for (const nextBoundary of nextBoundaries) {
      const selectedArcDirection = normalize(
        add(
          subtract(previousBoundary.outerBodyBoundaryEndpoint, anchor),
          subtract(nextBoundary.outerBodyBoundaryEndpoint, anchor)
        )
      )
      if (!selectedArcDirection) {
        continue
      }
      const selectedArc = ([1, -1] as const)
        .map((sweepSign) => {
          const arcPoints = buildRoundStrokeArcPointsBetween(
            anchor,
            previousBoundary.outerBodyBoundaryEndpoint,
            nextBoundary.outerBodyBoundaryEndpoint,
            sweepSign,
            6
          )
          const midpoint = arcPoints[Math.floor(arcPoints.length / 2)]
          const midpointDirection = midpoint
            ? normalize(subtract(midpoint, anchor))
            : null
          return {
            arcPoints,
            score:
              midpointDirection !== null
                ? dot(selectedArcDirection, midpointDirection)
                : Number.NEGATIVE_INFINITY
          }
        })
        .sort((left, right) => right.score - left.score)[0]
      const arcPoints =
        selectedArc?.arcPoints.filter(
          (_, index, points) => index !== 0 && index !== points.length - 1
        ) ?? []

      for (const [arcIndex, arcPoint] of arcPoints.entries()) {
        for (const radiusRatio of [0.45, 0.65, 0.85, 0.97]) {
          const sample = add(
            anchor,
            scale(subtract(arcPoint, anchor), radiusRatio)
          )
          const distanceToProduct = distanceToPolygons(sample, product.polygons)
          if (distanceToProduct > sectorCoverageTolerance) {
            failures.push({
              previousSeamBoundaryId: previousBoundary.seamBoundaryId,
              nextSeamBoundaryId: nextBoundary.seamBoundaryId,
              radiusRatio,
              arcIndex,
              sample: roundedRelativePoint(sample, anchor),
              distanceToProduct: Math.round(distanceToProduct * 1000) / 1000,
              previousOuterEndpoint: roundedRelativePoint(
                previousBoundary.outerBodyBoundaryEndpoint,
                anchor
              ),
              nextOuterEndpoint: roundedRelativePoint(
                nextBoundary.outerBodyBoundaryEndpoint,
                anchor
              ),
              visualOverlapCollapseStatus:
                product.debugMeta?.visualOverlapCollapseStatus ?? null,
              visualOverlapSourceFaceIds:
                product.debugMeta?.visualOverlapSourceFaceIds ?? [],
              productSignature: product.debugMeta?.productSignature ?? null,
              polygonCount: product.polygons.length
            })
          }
        }
      }
    }
  }

  expect(
    {
      count: failures.length,
      examples: failures.slice(0, 12)
    },
    `${label} round source-vertex join must continuously fill the sector between incident terminal seam boundaries; cracks between join and dash are Step 29/39 product failures: ${JSON.stringify(
      {
        productSignature: product.debugMeta?.productSignature ?? null,
        routeId: product.debugMeta?.routeId ?? null,
        visualOverlapCollapseStatus:
          product.debugMeta?.visualOverlapCollapseStatus ?? null,
        visualOverlapSourceFaceIds:
          product.debugMeta?.visualOverlapSourceFaceIds ?? [],
        polygons: product.polygons.map((polygon) =>
          polygon.map((point) => roundedRelativePoint(point, anchor))
        )
      },
      null,
      2
    )}`
  ).toEqual({ count: 0, examples: [] })
}

const allowedNearSourceVisibleContributors = new Set([
  'source-vertex-join',
  'dash-interval-body',
  'terminal-interval-body',
  'same-owner-smooth-span-descriptor'
])

const getNearSourceEntriesWithoutExplicitOwner = (
  renderEntries: ReportedRenderEntry[],
  anchor: Vec2,
  sourceNearWindow: number
) =>
  renderEntries
    .filter((entry) =>
      entry.polygons.some(
        (polygon) =>
          minDistanceToPolygonPoints(anchor, polygon) <= sourceNearWindow
      )
    )
    .filter((entry) => {
      const visibleContributor = entry.debugMeta?.visibleContributor
      return (
        typeof visibleContributor !== 'string' ||
        !allowedNearSourceVisibleContributors.has(visibleContributor)
      )
    })
    .map((entry) => ({
      geometryId: entry.geometryId,
      cacheKey: entry.cacheKey,
      productSignature: entry.debugMeta?.productSignature,
      visibleContributor: entry.debugMeta?.visibleContributor,
      geometryBasis: entry.debugMeta?.geometryBasis,
      polygonCount: entry.polygons.length
    }))

const getSourceVertexTerminalBodyResidueEntries = (
  renderEntries: ReportedRenderEntry[],
  anchor: Vec2,
  sourceNearWindow: number
) =>
  renderEntries
    .filter(
      (entry) =>
        entry.debugMeta?.visibleContributor === 'terminal-interval-body' &&
        entry.polygons.some(
          (polygon) =>
            minDistanceToPolygonPoints(anchor, polygon) <= sourceNearWindow
        )
    )
    .filter((entry) => {
      const geometryBasis = entry.debugMeta?.geometryBasis
      const dashBodySeamBoundaryCount =
        entry.debugMeta?.dashBodySeamBoundaries?.length ?? 0
      const joinOwnershipRecords = entry.debugMeta?.joinOwnershipRecords ?? []
      const hasSourceVertexOwnershipRecord = joinOwnershipRecords.some(
        (record) => record.kind === 'source-vertex'
      )
      const materializationKinds = joinOwnershipRecords.map(
        (record) => record.materializationKind
      )
      if (!hasSourceVertexOwnershipRecord) {
        return false
      }
      return (
        geometryBasis !== 'terminal-dash-interval-body' ||
        dashBodySeamBoundaryCount === 0 ||
        materializationKinds.includes('join-owned-terminal-body-bridge')
      )
    })
    .map((entry) => ({
      geometryId: entry.geometryId,
      cacheKey: entry.cacheKey,
      routeId: entry.debugMeta?.routeId ?? null,
      ownerStage: entry.debugMeta?.ownerStage ?? null,
      visibleContributor: entry.debugMeta?.visibleContributor ?? null,
      geometryBasis: entry.debugMeta?.geometryBasis ?? null,
      productSignature: entry.debugMeta?.productSignature ?? null,
      intervalIds: entry.debugMeta?.intervalIds ?? [],
      dashProductIntervals:
        entry.debugMeta?.dashProductIntervals?.map((interval) => ({
          intervalId: interval.intervalId,
          terminalRole: interval.terminalRole,
          sourceSegmentIndex: interval.sourceSegmentIndex,
          endpointCapPolicySignature: interval.endpointCapPolicySignature
        })) ?? [],
      joinOwnershipRecords:
        entry.debugMeta?.joinOwnershipRecords?.map((record) => ({
          kind: record.kind,
          materializationKind: record.materializationKind,
          intervalIds: record.intervalIds,
          vertex: record.vertex
        })) ?? [],
      polygonCount: entry.polygons.length,
      bounds: entry.debugMeta?.finalProductArea
    }))

type TerminalHalfDashRole = 'start' | 'end' | 'start-end'

interface TerminalHalfDashSurvivalRecord {
  key: string
  intervalId: string
  terminalRole: TerminalHalfDashRole
  sourceSegmentIndex: number | null
  splitRangeId: string | null
  routeId: unknown
  ownerStage: unknown
  visibleContributor: unknown
  geometryBasis: unknown
  productSignature: unknown
  polygonCount: number
  polygonArea: number
  polygons: Vec2[][]
}

const isTerminalHalfDashRole = (
  value: unknown
): value is TerminalHalfDashRole =>
  value === 'start' || value === 'end' || value === 'start-end'

const terminalHalfDashKey = ({
  intervalId,
  terminalRole,
  splitRangeId,
  sourceSegmentIndex
}: {
  intervalId: string
  terminalRole: TerminalHalfDashRole
  splitRangeId: string | null
  sourceSegmentIndex: number | null
}) =>
  [
    intervalId,
    terminalRole,
    splitRangeId ?? 'no-split-range',
    sourceSegmentIndex === null ? 'no-source-segment' : sourceSegmentIndex
  ].join('|')

const collectTerminalHalfDashSurvivalRecords = (
  products: ReportedGeometryProduct[]
): TerminalHalfDashSurvivalRecord[] =>
  products.flatMap((product) => {
    const meta = product.debugMeta
    const intervalRecords = meta?.dashProductIntervals ?? []
    const polygonArea = polygonListArea(product.polygons)

    if (intervalRecords.length > 0) {
      return intervalRecords
        .filter((interval) => isTerminalHalfDashRole(interval.terminalRole))
        .map((interval) => {
          const intervalId =
            interval.intervalId ??
            meta?.intervalId ??
            meta?.intervalIds?.[0] ??
            'missing-interval-id'
          const terminalRole = interval.terminalRole as TerminalHalfDashRole
          const sourceSegmentIndex =
            interval.sourceSegmentIndex ??
            meta?.domainPlanSplitRangeSourceSegmentIndex ??
            null
          const splitRangeId =
            interval.splitRangeId ?? meta?.domainPlanSplitRangeId ?? null

          return {
            key: terminalHalfDashKey({
              intervalId,
              terminalRole,
              splitRangeId,
              sourceSegmentIndex
            }),
            intervalId,
            terminalRole,
            sourceSegmentIndex,
            splitRangeId,
            routeId: meta?.routeId ?? null,
            ownerStage: meta?.ownerStage ?? null,
            visibleContributor: meta?.visibleContributor ?? null,
            geometryBasis: meta?.geometryBasis ?? null,
            productSignature: meta?.productSignature ?? null,
            polygonCount: product.polygons.length,
            polygonArea,
            polygons: product.polygons
          }
        })
    }

    if (!isTerminalHalfDashRole(meta?.domainPlanTerminalRole)) {
      return []
    }

    const intervalIds = [...getPacketIntervalIds(meta)]
    const intervalId = intervalIds[0] ?? 'missing-interval-id'
    const terminalRole = meta.domainPlanTerminalRole
    const sourceSegmentIndex =
      meta.domainPlanSplitRangeSourceSegmentIndex ?? null
    const splitRangeId = meta.domainPlanSplitRangeId ?? null

    return [
      {
        key: terminalHalfDashKey({
          intervalId,
          terminalRole,
          splitRangeId,
          sourceSegmentIndex
        }),
        intervalId,
        terminalRole,
        sourceSegmentIndex,
        splitRangeId,
        routeId: meta.routeId ?? null,
        ownerStage: meta.ownerStage ?? null,
        visibleContributor: meta.visibleContributor ?? null,
        geometryBasis: meta.geometryBasis ?? null,
        productSignature: meta.productSignature ?? null,
        polygonCount: product.polygons.length,
        polygonArea,
        polygons: product.polygons
      }
    ]
  })

const summarizeTerminalSurvivalRecords = (
  records: TerminalHalfDashSurvivalRecord[]
) =>
  records.map((record) => ({
    intervalId: record.intervalId,
    terminalRole: record.terminalRole,
    sourceSegmentIndex: record.sourceSegmentIndex,
    splitRangeId: record.splitRangeId,
    routeId: record.routeId,
    ownerStage: record.ownerStage,
    visibleContributor: record.visibleContributor,
    geometryBasis: record.geometryBasis,
    productSignature: record.productSignature,
    polygonCount: record.polygonCount,
    polygonArea: Math.round(record.polygonArea * 1000) / 1000
  }))

const getJoinFootprintMetrics = (
  renderEntries: ReportedGeometryProduct[],
  anchor: Vec2,
  tolerance: number
) => {
  const entries = getSourceVertexJoinEntriesForAnchor(
    renderEntries,
    anchor,
    tolerance
  )
  const polygons = entries.flatMap((entry) => entry.polygons)
  return {
    entries,
    maxPolygonPointCount: Math.max(
      0,
      ...polygons.map((polygon) => polygon.length)
    ),
    absoluteArea: polygons.reduce(
      (total, polygon) => total + Math.abs(polygonSignedArea(polygon)),
      0
    ),
    maxSourceNearDistance: getMaxSourceNearDistance(entries, anchor),
    shapeSignature: JSON.stringify(
      polygons
        .map((polygon) =>
          polygon.map((point) => roundedRelativePoint(point, anchor))
        )
        .sort((left, right) => left.length - right.length)
    )
  }
}

const buildPipelineResult = ({
  fixture,
  stroke,
  pathId,
  sourceId,
  ownerKeyPrefix,
  hasRenderableFill = true
}: {
  fixture: ReturnType<typeof createReportedVector34Fixture>
  stroke: ReturnType<typeof createDefaultStroke>
  pathId: string
  sourceId: string
  ownerKeyPrefix: string
  hasRenderableFill?: boolean
}) => {
  const { network, points, segments } = fixture
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId,
    sourceId,
    networkId: network.id,
    sourceRevision: `source-revision:${sourceId}`,
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `${pathId}:resolved`,
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
  const arrangementLegalRegions =
    (selfIntersecting?.fillRegions.length ?? 0) > 0
      ? (selfIntersecting?.fillRegions ?? [])
      : [{ polygons: [topology.normalizedPoints] }]
  const implicitFillRegions =
    (selfIntersecting?.fillRegions.length ?? 0) > 0 || hasRenderableFill
      ? arrangementLegalRegions
      : []
  const pipelineTrace: {
    eventName: string
    payload: Record<string, unknown>
  }[] = []
  const traceTarget = globalThis as typeof globalThis & {
    __asyraStrokePipelineTraceSink?: (
      eventName: string,
      payload: Record<string, unknown>
    ) => void
  }
  const previousTraceSink = traceTarget.__asyraStrokePipelineTraceSink
  const counterTarget = globalThis as typeof globalThis & {
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
  }
  const previousCounterSink = counterTarget.__asyraStrokePipelineCounterSink
  counterTarget.__asyraStrokePipelineCounterSink = (counterName, value) => {
    if (
      counterName.startsWith('final-coverage-route:') ||
      counterName === 'ribbon-body-segmented-materialization' ||
      counterName === 'outside-final-coverage-explicit-owner-caller' ||
      counterName === 'final-coverage-doubled-center-outside-legal-noop-skip'
    ) {
      pipelineTrace.push({
        eventName: 'counter',
        payload: { counterName, value }
      })
    }
    previousCounterSink?.(counterName, value)
  }
  traceTarget.__asyraStrokePipelineTraceSink = (eventName, payload) => {
    if (
      eventName === 'constrained-dashed-join-diagnostics' ||
      eventName === 'constrained-dashed-join-materialization' ||
      eventName === 'constrained-dashed-join-materialization-empty' ||
      eventName === 'constrained-dashed-pre-legality-source-vertex-products' ||
      eventName === 'constrained-dashed-empty-product' ||
      eventName === 'constrained-dashed-terminal-body-empty' ||
      eventName ===
        'constrained-dashed-exact-source-domain-selected-side-body' ||
      eventName ===
        'constrained-dashed-exact-source-domain-selected-side-body-bypassed' ||
      eventName === 'smooth-continuity-fragmented-product'
    ) {
      pipelineTrace.push({ eventName, payload })
    }
    previousTraceSink?.(eventName, payload)
  }
  const packets = (() => {
    try {
      return buildConstrainedDashedStrokeResolvedPackets(
        `${pathId}:packet`,
        topology.normalizedPoints,
        topology.closed,
        [stroke],
        {
          metadata: {
            ownerKeyPrefix,
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
      counterTarget.__asyraStrokePipelineCounterSink = previousCounterSink
    }
  })()
  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  const legalDomains = [
    {
      legalDomainId: topology.legalDomains[0]?.legalDomainId,
      fillRule: topology.fillRule,
      regions: arrangementLegalRegions
    }
  ]
  const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
    finalFaces,
    {
      exactBackend: getGeometryBackend(),
      legalDomains
    }
  )

  return {
    network,
    points,
    sourcePath,
    segments,
    topology,
    selfIntersecting,
    implicitFillRegions,
    arrangementLegalRegions,
    stroke,
    packets,
    finalFaces,
    renderEntries,
    hitPackets: buildSolidCenterStrokeHitTestPacketsFromFinalFaces(finalFaces),
    exportPackets:
      buildSolidCenterStrokeExportPacketsFromFinalFaces(finalFaces),
    pipelineTrace
  }
}

const buildReportedPipelineResult = (joinType: ReportedJoinType) =>
  buildPipelineResult({
    fixture: createReportedVector34Fixture(),
    stroke: buildReportedStrokeWithJoin(joinType),
    pathId: 'new-oracle-reported-vector-34',
    sourceId: 'vector-34',
    ownerKeyPrefix: 'vector:vector-34:tn-28'
  })

const buildSmoothCurvaturePipelineResult = () =>
  buildPipelineResult({
    fixture: createSmoothCurvatureFixture(),
    stroke: buildSmoothCurvatureStroke(),
    pathId: 'new-oracle-smooth-curvature',
    sourceId: 'smooth-high-curvature-outside-dashed',
    ownerKeyPrefix: 'vector:smooth-high-curvature-outside-dashed:sn-1'
  })

const buildReferenceAcutePipelineResult = (position: 'inside' | 'outside') =>
  buildPipelineResult({
    fixture: createReferenceAcuteFixture(),
    stroke: buildReferenceAcuteConstrainedStroke(position),
    pathId: `new-oracle-reference-acute-${position}-dashed`,
    sourceId: `reference-acute-${position}-dashed`,
    ownerKeyPrefix: `vector:reference-acute-${position}-dashed:an-1`
  })

const buildReferenceAcuteBoundaryProof = (position: 'inside' | 'outside') => {
  const fixture = createReferenceAcuteFixture()
  const stroke = buildReferenceAcuteConstrainedStroke(position)
  const { network, points, segments } = fixture
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: `new-oracle-reference-acute-${position}-dashed`,
    sourceId: `reference-acute-${position}-dashed`,
    networkId: network.id,
    sourceRevision: `source-revision:reference-acute-${position}-dashed`,
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: sourcePath.closed
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: `new-oracle-reference-acute-${position}-dashed:resolved`,
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
  const strokeDomainPlan = resolveStrokeDomains({
    topology,
    sourceFamily: resolveSourceFamily({ topology, stroke }),
    stroke,
    sourcePath,
    implicitFillRegions,
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
  })
  const visibleIntervals = getConstrainedDashedVisibleIntervals(
    topology,
    stroke,
    sourcePath,
    strokeDomainPlan
  )

  return {
    fixture,
    stroke,
    sourcePath,
    topology,
    strokeDomainPlan,
    visibleIntervals
  }
}

const getSourceSegmentEndpointProbes = (
  result: ReturnType<typeof buildReferenceAcutePipelineResult>
) =>
  result.network.segmentIds.flatMap((segmentId, sourceSegmentIndex) => {
    const segment = result.segments[segmentId]
    const start = segment ? result.points[segment.startId] : undefined
    const end = segment ? result.points[segment.endId] : undefined
    if (!start || !end) {
      return []
    }
    const direction = normalize(subtract(end, start))
    if (!direction) {
      return []
    }
    const endpointProbeDistance = result.stroke.dash * 0.25
    return [
      {
        sourceSegmentIndex,
        terminalRole: 'start' as const,
        point: {
          x: start.x + direction.x * endpointProbeDistance,
          y: start.y + direction.y * endpointProbeDistance
        }
      },
      {
        sourceSegmentIndex,
        terminalRole: 'end' as const,
        point: {
          x: end.x - direction.x * endpointProbeDistance,
          y: end.y - direction.y * endpointProbeDistance
        }
      }
    ]
  })

const getSourceSegmentGapProbes = (
  result: ReturnType<typeof buildReferenceAcutePipelineResult>
) =>
  result.network.segmentIds.flatMap((segmentId, sourceSegmentIndex) => {
    const segment = result.segments[segmentId]
    const start = segment ? result.points[segment.startId] : undefined
    const end = segment ? result.points[segment.endId] : undefined
    if (!start || !end) {
      return []
    }
    const direction = normalize(subtract(end, start))
    if (!direction) {
      return []
    }
    const length = distance(start, end)
    const gapProbeDistance = result.stroke.dash * 0.5 + result.stroke.gap * 0.3
    return [
      {
        sourceSegmentIndex,
        gapRole: 'start-gap' as const,
        point: {
          x: start.x + direction.x * gapProbeDistance,
          y: start.y + direction.y * gapProbeDistance
        }
      },
      {
        sourceSegmentIndex,
        gapRole: 'end-gap' as const,
        point: {
          x: end.x - direction.x * gapProbeDistance,
          y: end.y - direction.y * gapProbeDistance
        }
      }
    ].filter(() => length > result.stroke.dash + result.stroke.gap)
  })

const collectProductPolygons = (
  products: readonly {
    polygons?: Vec2[][]
    geometry?: {
      polygons: Vec2[][]
    }
  }[]
) =>
  products.flatMap((product) =>
    'geometry' in product && product.geometry
      ? product.geometry.polygons
      : (product.polygons ?? [])
  )

const getReportedSourceSegmentStartDistance = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  sourceSegmentIndex: number
) =>
  result.sourcePath.segmentDistanceRanges?.find(
    (range) => range.index === sourceSegmentIndex
  )?.startDistance ??
  result.sourcePath.segments
    .slice(0, sourceSegmentIndex)
    .reduce((total, segment) => total + segment.length, 0)

const toReportedSegmentLocalDistance = ({
  result,
  sourceSegmentIndex,
  sourceDistance,
  segmentLength
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  sourceSegmentIndex: number
  sourceDistance: number
  segmentLength: number
}) => {
  if (sourceDistance >= 0 && sourceDistance <= segmentLength) {
    return sourceDistance
  }
  const absolutePathLocalDistance =
    sourceDistance -
    getReportedSourceSegmentStartDistance(result, sourceSegmentIndex)
  if (
    absolutePathLocalDistance >= 0 &&
    absolutePathLocalDistance <= segmentLength
  ) {
    return absolutePathLocalDistance
  }
  return Number.NaN
}

const isPointInsideImplicitFillRegions = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  point: Vec2
) =>
  result.implicitFillRegions.some((region) =>
    region.polygons.some((polygon) => isPointInsidePolygon(point, polygon))
  )

const getReportedOutsideNormal = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  sourcePoint: Vec2,
  tangent: Vec2
) => {
  const normalizedTangent = normalize(tangent)
  if (!normalizedTangent) {
    return null
  }
  const left = { x: -normalizedTangent.y, y: normalizedTangent.x }
  const right = { x: normalizedTangent.y, y: -normalizedTangent.x }
  const probeDistances = [
    Math.max(2, result.stroke.width * 0.25),
    result.stroke.width * 0.5,
    result.stroke.width,
    result.stroke.width * 2
  ]
  for (const probeDistance of probeDistances) {
    const leftProbe = add(sourcePoint, scale(left, probeDistance))
    const rightProbe = add(sourcePoint, scale(right, probeDistance))
    const leftInside = isPointInsideImplicitFillRegions(result, leftProbe)
    const rightInside = isPointInsideImplicitFillRegions(result, rightProbe)

    if (leftInside !== rightInside) {
      return leftInside ? right : left
    }
  }

  return polygonSignedArea(result.topology.normalizedPoints) >= 0 ? right : left
}

const getReportedNormalDiagnostics = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  sourcePoint: Vec2,
  tangent: Vec2,
  polygons: Vec2[][],
  strokeWidth: number
) => {
  const normalizedTangent = normalize(tangent)
  if (!normalizedTangent) {
    return []
  }
  const normals = [
    {
      side: 'left',
      normal: { x: -normalizedTangent.y, y: normalizedTangent.x }
    },
    {
      side: 'right',
      normal: { x: normalizedTangent.y, y: -normalizedTangent.x }
    }
  ] as const

  return normals.map(({ side, normal }) => {
    const sample = add(sourcePoint, scale(normal, strokeWidth * 0.95))
    return {
      side,
      sample: roundedForDiagnostic(sample),
      insideFillAtHalfWidth: isPointInsideImplicitFillRegions(
        result,
        add(sourcePoint, scale(normal, strokeWidth * 0.5))
      ),
      insideFillAtFullWidth: isPointInsideImplicitFillRegions(
        result,
        add(sourcePoint, scale(normal, strokeWidth))
      ),
      distanceToVisibleProduct:
        Math.round(distanceToPolygons(sample, polygons) * 1000) / 1000
    }
  })
}

const getReportedSelectedSideNormal = (
  tangent: Vec2,
  selectedSide: 1 | -1 | undefined
) => {
  const normalizedTangent = normalize(tangent)
  if (!normalizedTangent || (selectedSide !== 1 && selectedSide !== -1)) {
    return null
  }
  return {
    x: -normalizedTangent.y * selectedSide,
    y: normalizedTangent.x * selectedSide
  }
}

const getReportedSourceFrame = ({
  result,
  sourceSegmentIndex,
  sourceDistance
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  sourceSegmentIndex: number
  sourceDistance: number
}) => {
  const segment = result.sourcePath.segments[sourceSegmentIndex]
  if (!segment) {
    return null
  }
  const localDistance = toReportedSegmentLocalDistance({
    result,
    sourceSegmentIndex,
    sourceDistance,
    segmentLength: segment.length
  })
  if (!Number.isFinite(localDistance)) {
    return null
  }
  return samplePathSegmentFrameAtLength(
    segment,
    Math.max(0, Math.min(segment.length, localDistance))
  )
}

const getReportedDashIntervalRecordsForProduct = (
  meta: ReportedGeometryProduct['debugMeta'] | undefined
) => {
  const records = meta?.dashProductIntervals ?? []
  if (records.length > 0) {
    return records
  }
  if (
    meta?.intervalId &&
    meta.domainPlanSplitRangeSourceSegmentIndex !== undefined &&
    meta.domainPlanSplitRangeSourceStartDistance !== undefined &&
    meta.domainPlanSplitRangeSourceEndDistance !== undefined
  ) {
    return [
      {
        intervalId: meta.intervalId,
        terminalRole: meta.domainPlanTerminalRole,
        sourceSegmentIndex: meta.domainPlanSplitRangeSourceSegmentIndex,
        sourceStartDistance: meta.domainPlanSplitRangeSourceStartDistance,
        sourceEndDistance: meta.domainPlanSplitRangeSourceEndDistance,
        splitRangeId: meta.domainPlanSplitRangeId,
        materializationDistanceSpace: meta.materializationDistanceSpace
      }
    ]
  }
  return []
}

const getVisibleDashIntervalSourceRange = (
  product: ReportedGeometryProduct,
  interval: ReturnType<typeof getReportedDashIntervalRecordsForProduct>[number],
  declaredStartDistance: number,
  declaredEndDistance: number
) => {
  const matchingPhysicalSpan = product.debugMeta?.physicalSpanRanges?.find(
    (span) => span.spanId === interval.intervalId
  )
  if (
    matchingPhysicalSpan &&
    Number.isFinite(matchingPhysicalSpan.startDistance) &&
    Number.isFinite(matchingPhysicalSpan.endDistance) &&
    Math.abs(
      matchingPhysicalSpan.endDistance - matchingPhysicalSpan.startDistance
    ) > SOURCE_SPACE_FLOATING_EPSILON
  ) {
    return {
      startDistance: matchingPhysicalSpan.startDistance,
      endDistance: matchingPhysicalSpan.endDistance,
      basis: 'physical'
    } as const
  }

  const effectiveStartDistance = interval.effectiveStartDistance
  const effectiveEndDistance = interval.effectiveEndDistance
  if (
    effectiveStartDistance !== undefined &&
    effectiveEndDistance !== undefined &&
    Number.isFinite(effectiveStartDistance) &&
    Number.isFinite(effectiveEndDistance) &&
    Math.abs(effectiveEndDistance - effectiveStartDistance) >
      SOURCE_SPACE_FLOATING_EPSILON
  ) {
    return {
      startDistance: effectiveStartDistance,
      endDistance: effectiveEndDistance,
      basis: 'effective'
    } as const
  }

  return {
    startDistance: declaredStartDistance,
    endDistance: declaredEndDistance,
    basis: 'declared'
  } as const
}

const isReportedVisibleDashBodyContributor = (
  meta: ReportedGeometryProduct['debugMeta'] | undefined
) =>
  meta?.visibleContributor === 'dash-interval-body' ||
  meta?.visibleContributor === 'terminal-interval-body' ||
  meta?.visibleContributor === 'smooth-continuity-dash-body' ||
  meta?.visibleContributor === 'same-owner-smooth-span-descriptor'

const isClosedConstrainedSourceCoverageId = (value: string | undefined) =>
  value?.startsWith('closed-constrained-source-coverage') === true ||
  value?.includes(':closed-constrained-source-coverage') === true

const isReportedClosedConstrainedSourceCoverageInterval = (
  interval: ReturnType<typeof getReportedDashIntervalRecordsForProduct>[number],
  meta: ReportedGeometryProduct['debugMeta'] | undefined
) =>
  isClosedConstrainedSourceCoverageId(interval.splitRangeId) ||
  isClosedConstrainedSourceCoverageId(interval.boundaryDomainId) ||
  isClosedConstrainedSourceCoverageId(meta?.domainPlanSplitRangeId) ||
  isClosedConstrainedSourceCoverageId(meta?.domainPlanBoundaryDomainId) ||
  isClosedConstrainedSourceCoverageId(meta?.productSignature)

const getIntervalPolygons = (
  products: readonly ReportedGeometryProduct[],
  intervalId: string
) =>
  products
    .filter((product) => {
      if (!isReportedVisibleDashBodyContributor(product.debugMeta)) {
        return false
      }
      return getPacketIntervalIds(product.debugMeta).has(intervalId)
    })
    .flatMap((product) => product.polygons)

const getIntervalProductDiagnostics = (
  products: readonly ReportedGeometryProduct[],
  intervalId: string
) =>
  products
    .filter(
      (product) =>
        isReportedVisibleDashBodyContributor(product.debugMeta) &&
        getPacketIntervalIds(product.debugMeta).has(intervalId)
    )
    .map((product) => ({
      signature: product.debugMeta?.productSignature ?? null,
      ownerStage: product.debugMeta?.ownerStage ?? null,
      routeId: product.debugMeta?.routeId ?? null,
      area:
        product.debugMeta?.finalProductArea !== undefined
          ? Math.round(product.debugMeta.finalProductArea * 1000) / 1000
          : Math.round(polygonListArea(product.polygons) * 1000) / 1000,
      polygonCount: product.polygons.length,
      vertexCount: product.polygons.reduce(
        (total, polygon) => total + polygon.length,
        0
      )
    }))

const getVisibleProductPolygons = (
  products: readonly ReportedGeometryProduct[]
) =>
  products
    .filter(
      (product) =>
        product.polygons.length > 0 &&
        product.debugMeta?.visibleContributor !== undefined
    )
    .flatMap((product) => product.polygons)

const assertVisibleProductsBoundsCoverActualPolygons = ({
  products,
  label
}: {
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const failures = products.flatMap((product, productIndex) => {
    if (
      product.polygons.length === 0 ||
      product.debugMeta?.visibleContributor === undefined
    ) {
      return []
    }
    if (!product.bounds) {
      return []
    }
    const actualBounds = getPolygonsBounds(product.polygons)
    return actualBounds.minX <
      product.bounds.minX - sourceSpaceWidthTolerance(1) ||
      actualBounds.minY < product.bounds.minY - sourceSpaceWidthTolerance(1) ||
      actualBounds.maxX > product.bounds.maxX + sourceSpaceWidthTolerance(1) ||
      actualBounds.maxY > product.bounds.maxY + sourceSpaceWidthTolerance(1)
      ? [
          {
            productIndex,
            boundsLabel: 'product.bounds',
            visibleContributor: product.debugMeta?.visibleContributor ?? null,
            ownerStage: product.debugMeta?.ownerStage ?? null,
            routeId: product.debugMeta?.routeId ?? null,
            productSignature: product.debugMeta?.productSignature ?? null,
            actualBounds,
            reportedBounds: product.bounds,
            polygons: product.polygons.map((polygon) =>
              polygon.map(roundedForDiagnostic)
            )
          }
        ]
      : []
  })

  expect(
    failures,
    `${label} visible product debug bounds must cover the exact polygons carried by that same product; stale bounds hide geometry overrun before Step 40`
  ).toEqual([])
}

const getVisibleProductDiagnostic = (
  point: Vec2,
  product: ReportedGeometryProduct
) => {
  const distance = distanceToPolygons(point, product.polygons)
  const dashBodySeamBoundaryPreview =
    product.debugMeta?.dashBodySeamBoundaries?.slice(0, 2).map((boundary) => ({
      seamBoundaryId: boundary.seamBoundaryId,
      intervalId: boundary.intervalId,
      splitRangeId: boundary.splitRangeId,
      terminalRole: boundary.terminalRole,
      selectedSide: boundary.selectedSide,
      sourceSegmentIndex: boundary.sourceSegmentIndex,
      point: roundedForDiagnostic(boundary.point),
      outerBodyBoundaryEndpoint: roundedForDiagnostic(
        boundary.outerBodyBoundaryEndpoint
      ),
      bodySideOutlineSegment:
        boundary.bodySideOutlineSegment.map(roundedForDiagnostic)
    })) ?? null
  return {
    distance,
    visibleContributor: product.debugMeta?.visibleContributor ?? null,
    ownerStage: product.debugMeta?.ownerStage ?? null,
    routeId: product.debugMeta?.routeId ?? null,
    productMode: product.debugMeta?.productMode ?? null,
    geometryBasis: product.debugMeta?.geometryBasis ?? null,
    productSignature: product.debugMeta?.productSignature ?? null,
    intervalIds: product.debugMeta
      ? (product.debugMeta.intervalIds ?? [product.debugMeta.intervalId])
      : [],
    resolvedJoin: product.debugMeta?.resolvedJoin ?? null,
    stageBounds:
      product.debugMeta?.joinOwnershipRecords?.[0]?.stageBounds ?? null,
    domainPlanSelectedSide: product.debugMeta?.domainPlanSelectedSide ?? null,
    domainPlanMaterializedSelectedSide:
      product.debugMeta?.domainPlanMaterializedSelectedSide ?? null,
    materializationDistanceSpace:
      product.debugMeta?.materializationDistanceSpace ?? null,
    sourceDomainExplicitSideProduct:
      product.debugMeta?.sourceDomainExplicitSideProduct ?? null,
    selectedSideProductOwnsOutsideDomain:
      product.debugMeta?.selectedSideProductOwnsOutsideDomain ?? null,
    vertexCount: product.polygons.reduce(
      (total, polygon) => total + polygon.length,
      0
    ),
    implicitFillRegionCount: product.debugMeta?.implicitFillRegionCount ?? null,
    rawProductArea: product.debugMeta?.rawProductArea ?? null,
    processedProductArea: product.debugMeta?.processedProductArea ?? null,
    cleanedProductArea: product.debugMeta?.cleanedProductArea ?? null,
    boundaryClippedProductArea:
      product.debugMeta?.boundaryClippedProductArea ?? null,
    finalProductArea: product.debugMeta?.finalProductArea ?? null,
    polygonPreview: product.polygons
      .slice(0, 2)
      .map((polygon) => polygon.slice(0, 8).map(roundedForDiagnostic)),
    dashBodySeamBoundaryCount:
      product.debugMeta?.dashBodySeamBoundaries?.length ?? 0,
    dashBodySeamBoundaryPreview
  }
}

const getNearestVisibleProductDiagnostics = (
  point: Vec2,
  products: readonly ReportedGeometryProduct[],
  count = 4
) =>
  products
    .filter(
      (product) =>
        product.polygons.length > 0 &&
        product.debugMeta?.visibleContributor !== undefined
    )
    .map((product) => getVisibleProductDiagnostic(point, product))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, count)
    .map((entry) => ({
      ...entry,
      distance: Math.round(entry.distance * 1000) / 1000
    }))

const getNearestSourceVertexJoinDiagnostics = (
  point: Vec2,
  products: readonly ReportedGeometryProduct[],
  count = 4
) =>
  getNearestVisibleProductDiagnostics(
    point,
    products.filter(
      (product) =>
        product.debugMeta?.visibleContributor === 'source-vertex-join'
    ),
    count
  )

const getNearestVisibleProductDiagnostic = (
  point: Vec2,
  products: readonly ReportedGeometryProduct[]
) => {
  const [best] = getNearestVisibleProductDiagnostics(point, products, 1)

  return best ?? null
}

const getVisibleIntervalPolygons = (
  products: readonly ReportedGeometryProduct[],
  intervalId: string
) =>
  products
    .filter(
      (product) =>
        product.polygons.length > 0 &&
        product.debugMeta?.visibleContributor !== undefined &&
        getPacketIntervalIds(product.debugMeta).has(intervalId)
    )
    .flatMap((product) => product.polygons)

const assertOutsideDashedTerminalFootprintsAreNotStripFragmented = ({
  products,
  label
}: {
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const failures = products
    .filter((product) => {
      const meta = product.debugMeta
      return (
        meta?.strokePosition === StrokePositions.OUTSIDE &&
        meta.visibleContributor === 'terminal-interval-body' &&
        (meta.routeId === 'constrained-dashed-terminal-body-product' ||
          meta.routeId ===
            'constrained-dashed-join-owned-terminal-body-product')
      )
    })
    .flatMap((product) => {
      const intervalCount = Math.max(
        1,
        getPacketIntervalIds(product.debugMeta).size
      )
      const allowedPolygonCount = intervalCount * 2
      if (product.polygons.length <= allowedPolygonCount) {
        return []
      }

      return [
        {
          routeId: product.debugMeta?.routeId ?? null,
          ownerStage: product.debugMeta?.ownerStage ?? null,
          visibleContributor: product.debugMeta?.visibleContributor ?? null,
          geometryBasis: product.debugMeta?.geometryBasis ?? null,
          materializationDistanceSpace:
            product.debugMeta?.materializationDistanceSpace ?? null,
          domainPlanSideAuthority:
            product.debugMeta?.domainPlanSideAuthority ?? null,
          domainPlanSelectedSide:
            product.debugMeta?.domainPlanSelectedSide ?? null,
          domainPlanMaterializedSelectedSide:
            product.debugMeta?.domainPlanMaterializedSelectedSide ?? null,
          selectedSideProductOwnsOutsideDomain:
            product.debugMeta?.selectedSideProductOwnsOutsideDomain ?? null,
          productSignature: product.debugMeta?.productSignature ?? null,
          intervalIds: [...getPacketIntervalIds(product.debugMeta)].sort(),
          polygonCount: product.polygons.length,
          allowedPolygonCount,
          dashProductIntervalCount:
            product.debugMeta?.dashProductIntervalCount ?? null,
          area:
            product.debugMeta?.finalProductArea !== undefined
              ? Math.round(product.debugMeta.finalProductArea * 1000) / 1000
              : Math.round(polygonListArea(product.polygons) * 1000) / 1000,
          bounds: getPolygonsBounds(product.polygons)
        }
      ]
    })

  expect(
    failures,
    `${label} outside dashed terminal and join-owned terminal footprints must not be materialized as many visible strip fragments`
  ).toEqual([])
}

const assertOutsideDashedSourceSpanMicroscopeCoverage = ({
  result,
  products,
  label
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const dashProducts = products.filter((product) =>
    isReportedVisibleDashBodyContributor(product.debugMeta)
  )
  interface SourceSpanMicroscopeFailure {
    intervalId: string
    sourceSegmentIndex: number | null
    sourceSegmentType: string | null
    terminalRole: string | null
    sourceDistance: number
    normalOffset: number
    sample: Vec2
    distanceToVisibleProduct: number
    distanceToAnyVisibleProduct: number
    oppositeDistanceToVisibleProduct: number
    normalDiagnostics: ReturnType<typeof getReportedNormalDiagnostics>
    selectedSide: 1 | -1 | null
    sourceStartDistance: number
    sourceEndDistance: number
    visibleSourceRangeBasis: string
    visibleSourceStartDistance: number
    visibleSourceEndDistance: number
    physicalSpanRanges:
      | {
          spanId: string
          role: string
          startDistance: number
          endDistance: number
        }[]
      | null
    productSignature: string | null
    ownerStage: string | null
    routeId: string | null
    domainPlanSideAuthority: string | null
    materializationDistanceSpace: string | null
    sourceDomainExplicitSideProduct: unknown
    selectedSideProductOwnsOutsideDomain: unknown
    polygonCount: number
    polygons: Vec2[][]
    vertexCount: number
    rawProductArea: number | null
    selectedSideProductArea: number | null
    processedProductArea: number | null
    cleanedProductArea: number | null
    boundaryClippedProductArea: number | null
    finalProductArea: number | null
    strokeWidth: number | null
    strokeCap: string | null
    dashEndpointCapPolicySignature: string | null
    dashBodySeamBoundaryCount: number
    joinOwnershipRecordCount: number
    smoothContinuityGroupId: string | null
    pipelineCounters: string[]
    pipelineTrace: {
      eventName: string
      payload: unknown
    }[]
    domainPlanTerminalRole: string | null
    domainPlanMaterializedSelectedSide: 1 | -1 | null
    matchingProducts: ReturnType<typeof getIntervalProductDiagnostics>
  }
  const failures: SourceSpanMicroscopeFailure[] = []
  const visitedIntervals = new Set<string>()

  for (const product of dashProducts) {
    for (const interval of getReportedDashIntervalRecordsForProduct(
      product.debugMeta
    )) {
      if (
        isReportedClosedConstrainedSourceCoverageInterval(
          interval,
          product.debugMeta
        )
      ) {
        continue
      }
      const sourceSegmentIndex =
        interval.sourceSegmentIndex ??
        product.debugMeta?.domainPlanSplitRangeSourceSegmentIndex
      const sourceStartDistance =
        interval.sourceStartDistance ??
        product.debugMeta?.domainPlanSplitRangeSourceStartDistance
      const sourceEndDistance =
        interval.sourceEndDistance ??
        product.debugMeta?.domainPlanSplitRangeSourceEndDistance
      if (
        sourceSegmentIndex === undefined ||
        sourceStartDistance === undefined ||
        sourceEndDistance === undefined
      ) {
        continue
      }
      const visibleSourceRange = getVisibleDashIntervalSourceRange(
        product,
        interval,
        sourceStartDistance,
        sourceEndDistance
      )
      const intervalKey = [
        interval.intervalId,
        sourceSegmentIndex,
        visibleSourceRange.basis,
        Math.round(visibleSourceRange.startDistance * 1000) / 1000,
        Math.round(visibleSourceRange.endDistance * 1000) / 1000
      ].join(':')
      if (visitedIntervals.has(intervalKey)) {
        continue
      }
      visitedIntervals.add(intervalKey)

      const intervalLength = Math.abs(
        visibleSourceRange.endDistance - visibleSourceRange.startDistance
      )
      if (intervalLength <= SOURCE_SPACE_FLOATING_EPSILON) {
        continue
      }

      const ratios =
        intervalLength <= result.stroke.width
          ? [0.5]
          : [0.15, 0.35, 0.5, 0.65, 0.85]
      const intervalPolygons = getIntervalPolygons(
        products,
        interval.intervalId
      )
      const polygons =
        intervalPolygons.length > 0 ? intervalPolygons : product.polygons
      const visiblePolygons = getVisibleProductPolygons(products)

      ratios.forEach((ratio) => {
        const sourceDistance =
          visibleSourceRange.startDistance +
          (visibleSourceRange.endDistance - visibleSourceRange.startDistance) *
            ratio
        const frame = getReportedSourceFrame({
          result,
          sourceSegmentIndex,
          sourceDistance
        })
        if (!frame) {
          return
        }
        const selectedSide =
          interval.materializedSelectedSide ??
          interval.selectedSide ??
          product.debugMeta?.domainPlanMaterializedSelectedSide ??
          product.debugMeta?.domainPlanSelectedSide
        const outsideNormal =
          getReportedOutsideNormal(result, frame.point, frame.tangent) ??
          getReportedSelectedSideNormal(frame.tangent, selectedSide)
        if (!outsideNormal) {
          return
        }
        ;[0.2, 0.4, 0.6, 0.8, 0.95].forEach((normalOffset) => {
          const sample = add(
            frame.point,
            scale(outsideNormal, result.stroke.width * normalOffset)
          )
          if (isPointInsideImplicitFillRegions(result, sample)) {
            return
          }
          const oppositeSample = add(
            frame.point,
            scale(outsideNormal, -result.stroke.width * normalOffset)
          )
          const distanceToVisibleProduct = distanceToPolygons(sample, polygons)
          const distanceToAnyVisibleProduct = distanceToPolygons(
            sample,
            visiblePolygons
          )
          const oppositeDistanceToVisibleProduct = distanceToPolygons(
            oppositeSample,
            polygons
          )
          if (
            distanceToAnyVisibleProduct >
            sourceSpaceWidthTolerance(result.stroke.width)
          ) {
            failures.push({
              intervalId: interval.intervalId,
              sourceSegmentIndex,
              sourceSegmentType:
                result.sourcePath.segments[sourceSegmentIndex]?.type ?? null,
              terminalRole: interval.terminalRole ?? null,
              sourceDistance: Math.round(sourceDistance * 1000) / 1000,
              normalOffset,
              sample: roundedForDiagnostic(sample),
              distanceToVisibleProduct:
                Math.round(distanceToVisibleProduct * 1000) / 1000,
              distanceToAnyVisibleProduct:
                Math.round(distanceToAnyVisibleProduct * 1000) / 1000,
              oppositeDistanceToVisibleProduct:
                Math.round(oppositeDistanceToVisibleProduct * 1000) / 1000,
              normalDiagnostics: getReportedNormalDiagnostics(
                result,
                frame.point,
                frame.tangent,
                polygons,
                result.stroke.width
              ),
              selectedSide:
                selectedSide === 1 || selectedSide === -1 ? selectedSide : null,
              sourceStartDistance:
                Math.round(sourceStartDistance * 1000) / 1000,
              sourceEndDistance: Math.round(sourceEndDistance * 1000) / 1000,
              visibleSourceRangeBasis: visibleSourceRange.basis,
              visibleSourceStartDistance:
                Math.round(visibleSourceRange.startDistance * 1000) / 1000,
              visibleSourceEndDistance:
                Math.round(visibleSourceRange.endDistance * 1000) / 1000,
              physicalSpanRanges:
                product.debugMeta?.physicalSpanRanges?.map((span) => ({
                  spanId: span.spanId,
                  role: span.role,
                  startDistance: Math.round(span.startDistance * 1000) / 1000,
                  endDistance: Math.round(span.endDistance * 1000) / 1000
                })) ?? null,
              productSignature: product.debugMeta?.productSignature ?? null,
              ownerStage: product.debugMeta?.ownerStage ?? null,
              routeId: product.debugMeta?.routeId ?? null,
              domainPlanSideAuthority:
                product.debugMeta?.domainPlanSideAuthority ?? null,
              materializationDistanceSpace:
                product.debugMeta?.materializationDistanceSpace ?? null,
              sourceDomainExplicitSideProduct:
                product.debugMeta?.sourceDomainExplicitSideProduct ?? null,
              selectedSideProductOwnsOutsideDomain:
                product.debugMeta?.selectedSideProductOwnsOutsideDomain ?? null,
              polygonCount: polygons.length,
              polygons: polygons.map((polygon) =>
                polygon.map(roundedForDiagnostic)
              ),
              vertexCount: polygons.reduce(
                (count, polygon) => count + polygon.length,
                0
              ),
              rawProductArea:
                product.debugMeta?.rawProductArea !== undefined
                  ? Math.round(product.debugMeta.rawProductArea * 1000) / 1000
                  : null,
              selectedSideProductArea:
                product.debugMeta?.selectedSideProductArea !== undefined
                  ? Math.round(
                      product.debugMeta.selectedSideProductArea * 1000
                    ) / 1000
                  : null,
              processedProductArea:
                product.debugMeta?.processedProductArea !== undefined
                  ? Math.round(product.debugMeta.processedProductArea * 1000) /
                    1000
                  : null,
              cleanedProductArea:
                product.debugMeta?.cleanedProductArea !== undefined
                  ? Math.round(product.debugMeta.cleanedProductArea * 1000) /
                    1000
                  : null,
              boundaryClippedProductArea:
                product.debugMeta?.boundaryClippedProductArea !== undefined
                  ? Math.round(
                      product.debugMeta.boundaryClippedProductArea * 1000
                    ) / 1000
                  : null,
              finalProductArea:
                product.debugMeta?.finalProductArea !== undefined
                  ? Math.round(product.debugMeta.finalProductArea * 1000) / 1000
                  : null,
              strokeWidth:
                product.debugMeta?.strokeWidth !== undefined
                  ? Math.round(product.debugMeta.strokeWidth * 1000) / 1000
                  : null,
              strokeCap: product.debugMeta?.strokeCap ?? null,
              dashEndpointCapPolicySignature:
                product.debugMeta?.dashEndpointCapPolicySignature ?? null,
              dashBodySeamBoundaryCount:
                product.debugMeta?.dashBodySeamBoundaries?.length ?? 0,
              joinOwnershipRecordCount:
                product.debugMeta?.joinOwnershipRecords?.length ?? 0,
              smoothContinuityGroupId:
                product.debugMeta?.smoothContinuityGroupId ?? null,
              pipelineCounters: result.pipelineTrace
                .filter((trace) => trace.eventName === 'counter')
                .map((trace) => trace.payload.counterName)
                .filter(
                  (counterName) =>
                    typeof counterName === 'string' &&
                    counterName.includes('smooth-continuity')
                ),
              pipelineTrace: result.pipelineTrace
                .filter((trace) => {
                  const payload = trace.payload as { intervalId?: string }
                  return payload.intervalId === interval.intervalId
                })
                .map((trace) => ({
                  eventName: trace.eventName,
                  payload: trace.payload
                })),
              domainPlanTerminalRole:
                product.debugMeta?.domainPlanTerminalRole ?? null,
              domainPlanMaterializedSelectedSide:
                product.debugMeta?.domainPlanMaterializedSelectedSide ?? null,
              matchingProducts: getIntervalProductDiagnostics(
                products,
                interval.intervalId
              )
            })
          }
        })
      })
    }
  }

  const failureSummary = {
    count: failures.length,
    examples: failures.slice(0, 12).map((failure) => ({
      intervalId: failure.intervalId,
      sourceSegmentIndex: failure.sourceSegmentIndex,
      sourceSegmentType: failure.sourceSegmentType,
      terminalRole: failure.terminalRole,
      sourceDistance: failure.sourceDistance,
      normalOffset: failure.normalOffset,
      sample: failure.sample,
      distanceToVisibleProduct: failure.distanceToVisibleProduct,
      distanceToAnyVisibleProduct: failure.distanceToAnyVisibleProduct,
      oppositeDistanceToVisibleProduct:
        failure.oppositeDistanceToVisibleProduct,
      selectedSide: failure.selectedSide,
      ownerStage: failure.ownerStage,
      routeId: failure.routeId,
      visibleSourceRangeBasis: failure.visibleSourceRangeBasis,
      visibleSourceStartDistance: failure.visibleSourceStartDistance,
      visibleSourceEndDistance: failure.visibleSourceEndDistance,
      productSignature: failure.productSignature,
      polygonCount: failure.polygonCount,
      vertexCount: failure.vertexCount,
      rawProductArea: failure.rawProductArea,
      selectedSideProductArea: failure.selectedSideProductArea,
      processedProductArea: failure.processedProductArea,
      finalProductArea: failure.finalProductArea,
      strokeWidth: failure.strokeWidth,
      strokeCap: failure.strokeCap,
      dashEndpointCapPolicySignature: failure.dashEndpointCapPolicySignature,
      dashBodySeamBoundaryCount: failure.dashBodySeamBoundaryCount,
      joinOwnershipRecordCount: failure.joinOwnershipRecordCount,
      smoothContinuityGroupId: failure.smoothContinuityGroupId,
      materializationDistanceSpace: failure.materializationDistanceSpace,
      sourceDomainExplicitSideProduct: failure.sourceDomainExplicitSideProduct,
      selectedSideProductOwnsOutsideDomain:
        failure.selectedSideProductOwnsOutsideDomain,
      normalDiagnostics: failure.normalDiagnostics,
      pipelineCounters: failure.pipelineCounters,
      pipelineTrace: failure.pipelineTrace?.map((trace) => ({
        eventName: trace.eventName,
        reason:
          typeof trace.payload === 'object' &&
          trace.payload !== null &&
          'reason' in trace.payload
            ? trace.payload.reason
            : undefined,
        payload:
          trace.eventName ===
            'constrained-dashed-exact-source-domain-selected-side-body' ||
          trace.eventName ===
            'constrained-dashed-exact-source-domain-selected-side-body-bypassed'
            ? trace.payload
            : undefined
      })),
      matchingProducts: failure.matchingProducts.map((product) => ({
        ownerStage: product.ownerStage,
        routeId: product.routeId,
        signature: product.signature,
        polygonCount: product.polygonCount,
        vertexCount: product.vertexCount,
        area: product.area
      }))
    }))
  }

  expect(
    failureSummary,
    `${label} outside dashed dash bodies must be continuous across source-span cross sections; comb-like strip gaps and curved dash cracks are product failures`
  ).toEqual({ count: 0, examples: [] })
}

const getIncidentSourceSegmentEndpointProbes = (
  result: ReturnType<typeof buildReportedPipelineResult>
) =>
  result.network.segmentIds.flatMap((segmentId, sourceSegmentIndex) => {
    const segment = result.segments[segmentId]
    const start = segment ? result.points[segment.startId] : undefined
    const end = segment ? result.points[segment.endId] : undefined
    const sourceSegment = result.sourcePath.segments[sourceSegmentIndex]
    if (!start || !end || !sourceSegment) {
      return []
    }
    const maxEndpointInset = Math.min(
      result.stroke.width * 0.6,
      sourceSegment.length * 0.2
    )
    const endpointInsets = Array.from(
      new Set(
        [0, 0.05, 0.1, 0.2, 0.3, 0.6]
          .map((ratio) =>
            Math.min(result.stroke.width * ratio, maxEndpointInset)
          )
          .map((distance) => Math.round(distance * 1000) / 1000)
      )
    )

    return endpointInsets.flatMap((insetDistance) => [
      {
        anchorId: start.id,
        sourceSegmentIndex,
        sourceDistance: insetDistance,
        terminalRole: 'start' as const,
        endpointInsetDistance: insetDistance
      },
      {
        anchorId: end.id,
        sourceSegmentIndex,
        sourceDistance: Math.max(0, sourceSegment.length - insetDistance),
        terminalRole: 'end' as const,
        endpointInsetDistance: insetDistance
      }
    ])
  })

const assertOutsideDashedAnchorNeighborhoodMicroscopeCoverage = ({
  result,
  products,
  label
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const visiblePolygons = getVisibleProductPolygons(products)
  const failures: {
    anchorId: string
    sourceSegmentIndex: number
    terminalRole: 'start' | 'end'
    endpointInsetDistance: number
    normalOffset: number
    sample: Vec2
    distanceToVisibleProduct: number
    nearestVisibleProduct: ReturnType<typeof getNearestVisibleProductDiagnostic>
    nearestVisibleProducts: ReturnType<
      typeof getNearestVisibleProductDiagnostics
    >
    nearestSourceVertexJoinProducts: ReturnType<
      typeof getNearestSourceVertexJoinDiagnostics
    >
    joinMaterializationTrace?: unknown[]
    insideFill?: boolean
  }[] = []

  for (const probe of getIncidentSourceSegmentEndpointProbes(result)) {
    const frame = getReportedSourceFrame({
      result,
      sourceSegmentIndex: probe.sourceSegmentIndex,
      sourceDistance: probe.sourceDistance
    })
    if (!frame) {
      continue
    }
    const outsideNormal = getReportedOutsideNormal(
      result,
      frame.point,
      frame.tangent
    )
    if (!outsideNormal) {
      continue
    }
    ;[0.02, 0.05, 0.1, 0.15, 0.25, 0.5, 0.75, 0.95].forEach((normalOffset) => {
      const sample = add(
        frame.point,
        scale(outsideNormal, result.stroke.width * normalOffset)
      )
      const distanceToVisibleProduct = distanceToPolygons(
        sample,
        visiblePolygons
      )
      if (distanceToVisibleProduct > sourceSpaceSeamContinuityTolerance) {
        const sourceVertexIndex = result.network.pointIds.indexOf(
          probe.anchorId
        )
        failures.push({
          anchorId: probe.anchorId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          terminalRole: probe.terminalRole,
          endpointInsetDistance:
            Math.round(probe.endpointInsetDistance * 1000) / 1000,
          normalOffset,
          sample: roundedForDiagnostic(sample),
          distanceToVisibleProduct:
            Math.round(distanceToVisibleProduct * 1000) / 1000,
          insideFill: isPointInsideImplicitFillRegions(result, sample),
          nearestVisibleProduct: getNearestVisibleProductDiagnostic(
            sample,
            products
          ),
          nearestVisibleProducts: getNearestVisibleProductDiagnostics(
            sample,
            products
          ),
          nearestSourceVertexJoinProducts:
            getNearestSourceVertexJoinDiagnostics(sample, products),
          joinMaterializationTrace: result.pipelineTrace
            .filter(
              (entry) =>
                entry.eventName === 'constrained-dashed-join-materialization'
            )
            .flatMap((entry) => {
              const payload = entry.payload as {
                records?: {
                  vertexIndex?: number
                  area?: number
                  bounds?: unknown
                  polygonCount?: number
                  intervalIds?: string[]
                  selectedSide?: number
                  domainKey?: string
                }[]
              }
              return (
                payload.records?.filter(
                  (record) => record.vertexIndex === sourceVertexIndex
                ) ?? []
              )
            })
        })
      }
    })
  }

  const failureSummary = failures.map((failure) => ({
    anchorId: failure.anchorId,
    sourceSegmentIndex: failure.sourceSegmentIndex,
    terminalRole: failure.terminalRole,
    endpointInsetDistance: failure.endpointInsetDistance,
    normalOffset: failure.normalOffset,
    sample: failure.sample,
    distanceToVisibleProduct: failure.distanceToVisibleProduct,
    insideFill: failure.insideFill,
    nearestVisibleProduct: {
      distance: failure.nearestVisibleProduct?.distance,
      ownerStage: failure.nearestVisibleProduct?.ownerStage,
      routeId: failure.nearestVisibleProduct?.routeId,
      visibleContributor: failure.nearestVisibleProduct?.visibleContributor
    },
    nearestSourceVertexJoinProducts: failure.nearestSourceVertexJoinProducts
      .slice(0, 3)
      .map((product) => ({
        distance: product.distance,
        ownerStage: product.ownerStage,
        routeId: product.routeId,
        resolvedJoin: product.resolvedJoin,
        visibleContributor: product.visibleContributor
      }))
  }))

  expect(
    failureSummary,
    `${label} every anchor endpoint neighborhood must have continuous outside dashed coverage at source-space microscope probes`
  ).toEqual([])
}

const assertOutsideDashedAnchorNeighborhoodRejectsInsideLeak = ({
  result,
  products,
  label
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const visiblePolygons = getVisibleProductPolygons(products)
  const failures: {
    anchorId: string
    sourceSegmentIndex: number
    terminalRole: 'start' | 'end'
    normalOffset: number
    sample: Vec2
    distanceToVisibleProduct: number
    nearestVisibleProduct: ReturnType<typeof getNearestVisibleProductDiagnostic>
  }[] = []

  for (const probe of getIncidentSourceSegmentEndpointProbes(result)) {
    const frame = getReportedSourceFrame({
      result,
      sourceSegmentIndex: probe.sourceSegmentIndex,
      sourceDistance: probe.sourceDistance
    })
    if (!frame) {
      continue
    }
    const outsideNormal = getReportedOutsideNormal(
      result,
      frame.point,
      frame.tangent
    )
    if (!outsideNormal) {
      continue
    }

    ;[0.08, 0.15, 0.25, 0.4, 0.65].forEach((normalOffset) => {
      const sample = add(
        frame.point,
        scale(outsideNormal, -result.stroke.width * normalOffset)
      )
      if (!isPointInsideImplicitFillRegions(result, sample)) {
        return
      }
      const distanceToVisibleProduct = distanceToPolygons(
        sample,
        visiblePolygons
      )
      if (distanceToVisibleProduct <= sourceSpaceSeamContinuityTolerance) {
        failures.push({
          anchorId: probe.anchorId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          terminalRole: probe.terminalRole,
          normalOffset,
          sample: roundedForDiagnostic(sample),
          distanceToVisibleProduct:
            Math.round(distanceToVisibleProduct * 1000) / 1000,
          nearestVisibleProduct: getNearestVisibleProductDiagnostic(
            sample,
            products
          )
        })
      }
    })
  }

  expect(
    failures,
    `${label} outside dashed products must not leak across the authored source path into the fill-domain side at sharp-anchor terminal probes`
  ).toEqual([])
}

const assertOutsideDashedEndpointStrokePositionProfile = ({
  result,
  products,
  label
}: {
  result: ReturnType<typeof buildReportedPipelineResult>
  products: readonly ReportedGeometryProduct[]
  label: string
}) => {
  const visiblePolygons = getVisibleProductPolygons(products)
  const failures: {
    kind: 'missing-outside-band' | 'inside-side-paint' | 'outside-width-overrun'
    anchorId: string
    sourceSegmentIndex: number
    terminalRole: 'start' | 'end'
    endpointInsetDistance: number
    normalOffset: number
    sample: Vec2
    distanceToVisibleProduct: number
    distanceToSourcePath?: number
    nearestVisibleProduct: ReturnType<typeof getNearestVisibleProductDiagnostic>
  }[] = []

  for (const probe of getIncidentSourceSegmentEndpointProbes(result)) {
    const frame = getReportedSourceFrame({
      result,
      sourceSegmentIndex: probe.sourceSegmentIndex,
      sourceDistance: probe.sourceDistance
    })
    if (!frame) {
      continue
    }
    const outsideNormal = getReportedOutsideNormal(
      result,
      frame.point,
      frame.tangent
    )
    if (!outsideNormal) {
      continue
    }

    ;[0.08, 0.2, 0.45, 0.7, 0.92].forEach((normalOffset) => {
      const sample = add(
        frame.point,
        scale(outsideNormal, result.stroke.width * normalOffset)
      )
      const distanceToVisibleProduct = distanceToPolygons(
        sample,
        visiblePolygons
      )
      if (distanceToVisibleProduct > sourceSpaceSeamContinuityTolerance) {
        failures.push({
          kind: 'missing-outside-band',
          anchorId: probe.anchorId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          terminalRole: probe.terminalRole,
          endpointInsetDistance: probe.endpointInsetDistance,
          normalOffset,
          sample: roundedForDiagnostic(sample),
          distanceToVisibleProduct:
            Math.round(distanceToVisibleProduct * 1000) / 1000,
          nearestVisibleProduct: getNearestVisibleProductDiagnostic(
            sample,
            products
          )
        })
      }
    })
    ;[0.05, 0.12, 0.25, 0.45].forEach((normalOffset) => {
      const sample = add(
        frame.point,
        scale(outsideNormal, -result.stroke.width * normalOffset)
      )
      const distanceToVisibleProduct = distanceToPolygons(
        sample,
        visiblePolygons
      )
      const insideFill = isPointInsideImplicitFillRegions(result, sample)
      if (
        insideFill &&
        distanceToVisibleProduct <= sourceSpaceSeamContinuityTolerance
      ) {
        failures.push({
          kind: 'inside-side-paint',
          anchorId: probe.anchorId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          terminalRole: probe.terminalRole,
          endpointInsetDistance: probe.endpointInsetDistance,
          normalOffset: -normalOffset,
          sample: roundedForDiagnostic(sample),
          insideFill,
          distanceToVisibleProduct:
            Math.round(distanceToVisibleProduct * 1000) / 1000,
          nearestVisibleProduct: getNearestVisibleProductDiagnostic(
            sample,
            products
          )
        })
      }
    })

    if (probe.endpointInsetDistance < result.stroke.width * 0.5) {
      continue
    }

    ;[1.08, 1.18, 1.32].forEach((normalOffset) => {
      const sample = add(
        frame.point,
        scale(outsideNormal, result.stroke.width * normalOffset)
      )
      const distanceToVisibleProduct = distanceToPolygons(
        sample,
        visiblePolygons
      )
      const distanceToSourcePath = distanceToReportedSourcePath(result, sample)
      const nearestVisibleProduct = getNearestVisibleProductDiagnostic(
        sample,
        products
      )
      const nearestRouteId = nearestVisibleProduct?.routeId
      const nearestProductIsJoinLocalCoverage =
        nearestRouteId ===
          'constrained-dashed-join-owned-terminal-body-product' ||
        nearestRouteId === 'constrained-dashed-source-vertex-join-product'
      if (
        distanceToVisibleProduct <= sourceSpaceSeamContinuityTolerance &&
        distanceToSourcePath >
          result.stroke.width +
            sourceSpaceWidthTolerance(result.stroke.width) &&
        !nearestProductIsJoinLocalCoverage
      ) {
        failures.push({
          kind: 'outside-width-overrun',
          anchorId: probe.anchorId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          terminalRole: probe.terminalRole,
          endpointInsetDistance: probe.endpointInsetDistance,
          normalOffset,
          sample: roundedForDiagnostic(sample),
          distanceToVisibleProduct:
            Math.round(distanceToVisibleProduct * 1000) / 1000,
          distanceToSourcePath: Math.round(distanceToSourcePath * 1000) / 1000,
          nearestVisibleProduct
        })
      }
    })
  }

  const failureSummary = {
    count: failures.length,
    examples: failures.slice(0, 16).map((failure) => ({
      kind: failure.kind,
      anchorId: failure.anchorId,
      sourceSegmentIndex: failure.sourceSegmentIndex,
      terminalRole: failure.terminalRole,
      endpointInsetDistance: failure.endpointInsetDistance,
      normalOffset: failure.normalOffset,
      sample: failure.sample,
      distanceToVisibleProduct: failure.distanceToVisibleProduct,
      distanceToSourcePath: failure.distanceToSourcePath,
      nearestVisibleProduct: {
        distance: failure.nearestVisibleProduct?.distance,
        ownerStage: failure.nearestVisibleProduct?.ownerStage,
        routeId: failure.nearestVisibleProduct?.routeId,
        visibleContributor: failure.nearestVisibleProduct?.visibleContributor
      }
    }))
  }

  expect(
    failureSummary,
    `${label} outside dashed endpoint profile must stay on the authored outside side with a full-width local band; source-path inside leaks, missing local coverage, and post-join width overruns must be caught before Step 40`
  ).toEqual({ count: 0, examples: [] })
}

const assertSourceVertexJoinCoversLegalCornerFromSeamBoundaries = (
  result: ReturnType<typeof buildReportedPipelineResult>,
  entry: ReportedGeometryProduct,
  anchor: Vec2,
  label: string
) => {
  const seamEvidence = getRuntimeJoinSeamEvidence(entry.debugMeta)
  expect(seamEvidence, `${label} seam evidence`).toBeDefined()
  if (!seamEvidence) {
    return
  }

  const previousBoundaries = seamEvidence.incidentSeamBoundaries.filter(
    (boundary) => boundary.side === 'previous'
  )
  const nextBoundaries = seamEvidence.incidentSeamBoundaries.filter(
    (boundary) => boundary.side === 'next'
  )
  const failures: {
    previousSeamBoundaryId: string
    nextSeamBoundaryId: string
    ratio: number
    sample: Vec2
    distanceToProduct: number
    insideFillDomain: boolean
    resolvedJoin: string | null
    routeId: string | null
    productSignature: string | null
    visualOverlapCollapseStatus?: string
    visualOverlapSourceFaceIds?: string[]
    polygons: Vec2[][]
    nearestVisibleProducts: ReturnType<
      typeof getNearestVisibleProductDiagnostic
    >[]
  }[] = []

  for (const previousBoundary of previousBoundaries) {
    for (const nextBoundary of nextBoundaries) {
      const seamMidpoint = scale(
        add(
          previousBoundary.outerBodyBoundaryEndpoint,
          nextBoundary.outerBodyBoundaryEndpoint
        ),
        0.5
      )
      for (const ratio of [0.18, 0.35, 0.55, 0.75, 0.92]) {
        const sample = add(anchor, scale(subtract(seamMidpoint, anchor), ratio))
        const insideFillDomain = isPointInsideImplicitFillRegions(
          result,
          sample
        )
        const distanceToProduct = distanceToPolygons(sample, entry.polygons)
        if (
          !insideFillDomain &&
          distanceToProduct > sourceSpaceSeamContinuityTolerance
        ) {
          failures.push({
            previousSeamBoundaryId: previousBoundary.seamBoundaryId,
            nextSeamBoundaryId: nextBoundary.seamBoundaryId,
            ratio,
            sample: roundedRelativePoint(sample, anchor),
            distanceToProduct: Math.round(distanceToProduct * 1000) / 1000,
            insideFillDomain,
            resolvedJoin: entry.debugMeta?.resolvedJoin ?? null,
            routeId: entry.debugMeta?.routeId ?? null,
            productSignature: entry.debugMeta?.productSignature ?? null,
            visualOverlapCollapseStatus:
              (
                entry as ReportedGeometryProduct & {
                  runtimeMeta?: { visualOverlapCollapseStatus?: string }
                }
              ).runtimeMeta?.visualOverlapCollapseStatus ??
              entry.debugMeta?.visualOverlapCollapseStatus,
            visualOverlapSourceFaceIds:
              entry.debugMeta?.visualOverlapSourceFaceIds,
            polygons: entry.polygons.map((polygon) =>
              polygon.map((point) => roundedRelativePoint(point, anchor))
            ),
            nearestVisibleProducts: [
              getNearestVisibleProductDiagnostic(sample, result.renderEntries)
            ]
          })
        }
      }
    }
  }

  expect(
    failures,
    `${label} source-vertex join must cover the legal outside corner between the two Step 28 seam-boundary artifacts; missing bevel/round/miter corner coverage is a product failure`
  ).toEqual([])
}

const outsideDashedMicroscopeScenarios = [
  {
    name: 'reported vector-34 closed curved/sharp outside dashed fixture',
    buildResult: buildReportedPipelineResult
  }
]

const assertExactReportedVector34OutsideDashedSeamContinuity = (
  joinType: ReportedJoinType
) => {
  const result = buildReportedPipelineResult(joinType)

  expect(result.stroke.width).toBe(10)
  expect(result.stroke.dash).toBe(20)
  expect(result.stroke.gap).toBe(20)
  expect(result.stroke.position).toBe(StrokePositions.OUTSIDE)
  expect(result.stroke.capType).toBe(StrokeCapTypes.BUTT)

  for (const anchorId of ['tp-113', 'tp-115', 'tp-116'] as const) {
    const anchor = result.points[anchorId]
    const packetEntries = getSourceVertexJoinEntriesForAnchor(
      getPreLegalitySourceVertexJoinProducts(
        result.packets,
        result.pipelineTrace
      ),
      anchor,
      result.stroke.width * 0.5
    )
    const preLegalityTraceSummaries = result.pipelineTrace
      .filter(
        (entry) =>
          entry.eventName ===
          'constrained-dashed-pre-legality-source-vertex-products'
      )
      .map((entry) => {
        const payload = entry.payload as ReportedRenderEntry['debugMeta'] & {
          polygons?: Vec2[][]
        }
        return {
          vertex: payload.vertex ? roundedForDiagnostic(payload.vertex) : null,
          selectedSide: payload.selectedSide,
          intervalIds: payload.intervalIds,
          bounds: payload.polygons
            ? getPolygonsBounds(payload.polygons)
            : undefined,
          joinOwnershipRecords:
            payload.joinOwnershipRecords?.map((record) => ({
              kind: record.kind,
              vertex: record.vertex
                ? roundedForDiagnostic(record.vertex)
                : null,
              selectedSide: record.selectedSide,
              intervalIds: record.intervalIds
            })) ?? []
        }
      })

    expect(
      packetEntries.length,
      `${joinType} exact reported vector-34 Step 29 source-vertex product for ${anchorId}: ${JSON.stringify(
        {
          joinTrace: result.pipelineTrace.filter(
            (entry) =>
              entry.eventName === 'constrained-dashed-join-diagnostics' ||
              entry.eventName === 'constrained-dashed-join-materialization' ||
              entry.eventName ===
                'constrained-dashed-join-materialization-empty'
          ),
          preLegalityTraceSummaries
        }
      )}`
    ).toBeGreaterThan(0)

    for (const entry of packetEntries) {
      assertSeamEvidenceUsesStep27OuterEndpoints(
        result,
        entry,
        anchor,
        `${anchorId} exact reported vector-34 Step 29 ${joinType}`
      )

      expect(
        getMaxIncidentDashBodyDeficit(entry, anchor),
        `${joinType} exact reported vector-34 Step 29 source-vertex product at ${anchorId} must reach incident dash body endpoints: ${JSON.stringify(
          getIncidentDashBodyDeficitDiagnostics(entry)
        )}`
      ).toBeLessThanOrEqual(0.5)

      if (joinType === 'bevel') {
        assertBevelChordUsesIncidentDashOuterEndpoints(
          entry,
          `${anchorId} exact reported vector-34 Step 29 bevel`
        )
      }

      if (joinType === 'round') {
        assertRoundUsesLocalSourceVertexArc(
          entry,
          anchor,
          `${anchorId} exact reported vector-34 Step 29 round`
        )
      }
    }

    if (joinType === 'miter') {
      assertResolvedMiterUsesTheoreticalBounds(packetEntries, anchorId)
    }
  }
}

const assertOutsideDashedSourceSpanAndAnchorCoverageUnderMicroscope = (
  joinType: ReportedJoinType
) => {
  for (const scenario of outsideDashedMicroscopeScenarios) {
    const result = scenario.buildResult(joinType)
    const stages = [
      {
        label: `${scenario.name} ${joinType} Step 27/30/31 packets`,
        products: result.packets.map((packet) => ({
          polygons: packet.geometry.polygons,
          bounds: packet.geometry.bounds,
          debugMeta: packet.geometry.debugMeta
        }))
      },
      {
        label: `${scenario.name} ${joinType} Step 36 final faces`,
        products: result.finalFaces
      },
      {
        label: `${scenario.name} ${joinType} Step 39 render entries`,
        products: result.renderEntries
      }
    ]

    for (const stage of stages) {
      assertVisibleProductsBoundsCoverActualPolygons({
        products: stage.products,
        label: stage.label
      })
      assertOutsideDashedSourceSpanMicroscopeCoverage({
        result,
        products: stage.products,
        label: stage.label
      })
      assertOutsideDashedAnchorNeighborhoodMicroscopeCoverage({
        result,
        products: stage.products,
        label: stage.label
      })
      if (!stage.label.includes('Step 27/30/31')) {
        assertOutsideDashedAnchorNeighborhoodRejectsInsideLeak({
          result,
          products: stage.products,
          label: stage.label
        })
      }
      assertOutsideDashedEndpointStrokePositionProfile({
        result,
        products: stage.products,
        label: stage.label
      })
      assertOutsideDashedTerminalFootprintsAreNotStripFragmented({
        products: stage.products,
        label: stage.label
      })
    }
  }
}

export type ReportedVector34SeamOracleGroup =
  | 'continuity'
  | 'microscope'
  | 'footprint-classes'
  | 'terminal-residue'
  | 'join-connectivity'

export interface ReportedVector34SeamOracleOptions {
  groups?: readonly ReportedVector34SeamOracleGroup[]
  joinTypes?: readonly ReportedJoinType[]
}

const allReportedVector34SeamOracleGroups: readonly ReportedVector34SeamOracleGroup[] =
  [
    'continuity',
    'microscope',
    'footprint-classes',
    'terminal-residue',
    'join-connectivity'
  ]

export const registerReportedVector34SeamOracleTests = (
  options: ReportedVector34SeamOracleOptions = {}
) => {
  const groups = new Set(options.groups ?? allReportedVector34SeamOracleGroups)
  const joinTypes = options.joinTypes ?? (['miter', 'bevel', 'round'] as const)

  if (groups.has('continuity')) {
    for (const joinType of joinTypes) {
      it(`keeps exact reported vector-34 ${joinType} outside dashed seam continuity for dash 20 gap 20`, () => {
        assertExactReportedVector34OutsideDashedSeamContinuity(joinType)
      })
    }
  }

  if (groups.has('microscope')) {
    for (const joinType of joinTypes) {
      it(`keeps ${joinType} outside dashed source-span and anchor coverage under microscope probes`, () => {
        assertOutsideDashedSourceSpanAndAnchorCoverageUnderMicroscope(joinType)
      })
    }
  }

  if (groups.has('footprint-classes')) {
    it('keeps constrained outside dashed miter, bevel, and round source-vertex footprints distinct in runtime product artifacts', () => {
      const results = {
        miter: buildReportedPipelineResult('miter'),
        bevel: buildReportedPipelineResult('bevel'),
        round: buildReportedPipelineResult('round')
      }

      for (const anchorId of ['tp-113', 'tp-115', 'tp-116'] as const) {
        const anchor = results.miter.points[anchorId]
        const packetMiter = getJoinFootprintMetrics(
          getPreLegalitySourceVertexJoinProducts(
            results.miter.packets,
            results.miter.pipelineTrace
          ),
          anchor,
          results.miter.stroke.width * 0.5
        )
        const packetBevel = getJoinFootprintMetrics(
          getPreLegalitySourceVertexJoinProducts(
            results.bevel.packets,
            results.bevel.pipelineTrace
          ),
          anchor,
          results.bevel.stroke.width * 0.5
        )
        const packetRound = getJoinFootprintMetrics(
          getPreLegalitySourceVertexJoinProducts(
            results.round.packets,
            results.round.pipelineTrace
          ),
          anchor,
          results.round.stroke.width * 0.5
        )
        expect(
          packetMiter.entries.length,
          `Step 29 miter join product for ${anchorId}`
        ).toBeGreaterThan(0)
        expect(
          packetBevel.entries.length,
          `Step 29 bevel join product for ${anchorId}`
        ).toBeGreaterThan(0)
        expect(
          packetRound.entries.length,
          `Step 29 round join product for ${anchorId}`
        ).toBeGreaterThan(0)
        expect(packetMiter.shapeSignature).not.toBe(packetBevel.shapeSignature)
        expect(packetRound.shapeSignature).not.toBe(packetBevel.shapeSignature)
        packetMiter.entries.forEach((entry) =>
          assertSeamEvidenceUsesStep27OuterEndpoints(
            results.miter,
            entry,
            anchor,
            `${anchorId} Step 29 miter`
          )
        )
        packetBevel.entries.forEach((entry) =>
          assertSeamEvidenceUsesStep27OuterEndpoints(
            results.bevel,
            entry,
            anchor,
            `${anchorId} Step 29 bevel`
          )
        )
        packetBevel.entries.forEach((entry) =>
          assertBevelChordUsesIncidentDashOuterEndpoints(
            entry,
            `${anchorId} Step 29 bevel`
          )
        )
        packetRound.entries.forEach((entry) =>
          assertSeamEvidenceUsesStep27OuterEndpoints(
            results.round,
            entry,
            anchor,
            `${anchorId} Step 29 round`
          )
        )
        packetRound.entries.forEach((entry) =>
          assertRoundUsesLocalSourceVertexArc(
            entry,
            anchor,
            `${anchorId} Step 29 round`
          )
        )
        expect(packetMiter.absoluteArea).toBeGreaterThan(0)
        expect(packetBevel.absoluteArea).toBeGreaterThan(0)
        expect(packetRound.absoluteArea).toBeGreaterThan(0)

        const sourceProbeWindow = sourceNearWindowForStrokeWidth(
          results.round.stroke.width
        )
        assertResolvedMiterUsesTheoreticalBounds(packetMiter.entries, anchorId)
        expect(
          getNearSourceEntriesWithoutExplicitOwner(
            results.round.renderEntries,
            anchor,
            sourceProbeWindow
          ),
          `${anchorId} visible source-near geometry must preserve explicit owner metadata`
        ).toEqual([])
      }
    })
  }

  if (groups.has('terminal-residue')) {
    for (const joinType of joinTypes) {
      it(`does not emit ${joinType} source-vertex terminal-body residue without seam-boundary provenance`, () => {
        const result = buildReportedPipelineResult(joinType)
        const sourceProbeWindow = sourceNearWindowForStrokeWidth(
          result.stroke.width
        )

        for (const anchorId of ['tp-113', 'tp-115', 'tp-116'] as const) {
          const anchor = result.points[anchorId]
          const terminalBodyResidueEntries =
            getSourceVertexTerminalBodyResidueEntries(
              result.renderEntries,
              anchor,
              sourceProbeWindow
            )

          expect(
            terminalBodyResidueEntries,
            `${joinType} ${anchorId} must not expose source-vertex terminal-body residue without seam-boundary artifact provenance`
          ).toEqual([])
        }
      })
    }
  }

  if (groups.has('join-connectivity')) {
    for (const joinType of joinTypes) {
      it(`connects reported ${joinType} sharp source-vertex joins to incident dash bodies without seam gaps`, () => {
        const result = buildReportedPipelineResult(joinType)

        for (const anchorId of ['tp-113', 'tp-115', 'tp-116'] as const) {
          const anchor = result.points[anchorId]
          const packetEntries = getSourceVertexJoinEntriesForAnchor(
            getPreLegalitySourceVertexJoinProducts(
              result.packets,
              result.pipelineTrace
            ),
            anchor,
            result.stroke.width * 0.5
          )
          const finalFaceEntries = getSourceVertexJoinEntriesForAnchor(
            result.finalFaces,
            anchor,
            result.stroke.width * 0.5
          )
          const joinEntries = getSourceVertexJoinEntriesForAnchor(
            result.renderEntries,
            anchor,
            result.stroke.width * 0.5
          )
          const maxPacketIncidentDashBodyDeficit = Math.max(
            0,
            ...packetEntries.map((entry) =>
              getMaxIncidentDashBodyDeficit(entry, anchor)
            )
          )
          expect(
            maxPacketIncidentDashBodyDeficit,
            `${joinType} Step 29 source-vertex product at ${anchorId} must reach incident dash body endpoints: ${JSON.stringify(
              packetEntries.map(getIncidentDashBodyDeficitDiagnostics),
              null,
              2
            )}`
          ).toBeLessThanOrEqual(0.5)
          expect(
            finalFaceEntries.length,
            `${joinType} Step 36 final faces must preserve a visible source-vertex join product at ${anchorId}`
          ).toBeGreaterThan(0)
          expect(
            joinEntries.length,
            `${joinType} Step 39 render entries must preserve a visible source-vertex join product at ${anchorId}`
          ).toBeGreaterThan(0)

          for (const entry of packetEntries) {
            assertIncidentSeamDashSideCoverage(
              result,
              result.packets.map((packet) => ({
                polygons: packet.geometry.polygons,
                debugMeta: packet.geometry.debugMeta
              })),
              entry,
              result.stroke.width,
              anchor,
              `${joinType} Step 29 source-vertex product at ${anchorId}`
            )
          }

          for (const entry of finalFaceEntries) {
            assertSeamEvidenceUsesStep27OuterEndpoints(
              result,
              entry,
              anchor,
              `${joinType} Step 36 source-vertex final face at ${anchorId}`,
              {
                allowStageVisibleCoverage: true,
                stageProducts: result.finalFaces
              }
            )
            assertIncidentSeamDashSideCoverage(
              result,
              result.finalFaces,
              entry,
              result.stroke.width,
              anchor,
              `${joinType} Step 36 source-vertex final face at ${anchorId}`
            )
            if (joinType === 'round') {
              assertRoundUsesLocalSourceVertexArc(
                entry,
                anchor,
                `${joinType} Step 36 source-vertex final face at ${anchorId}`
              )
            }
          }

          for (const entry of joinEntries) {
            assertSeamEvidenceUsesStep27OuterEndpoints(
              result,
              entry,
              anchor,
              `${joinType} Step 39 source-vertex render entry at ${anchorId}`,
              {
                allowRenderProjectionMerge: true,
                allowStageVisibleCoverage: true,
                stageProducts: result.renderEntries
              }
            )
            assertIncidentSeamDashSideCoverage(
              result,
              result.renderEntries,
              entry,
              result.stroke.width,
              anchor,
              `${joinType} Step 39 source-vertex render entry at ${anchorId}`
            )
            assertSourceVertexJoinCoversLegalCornerFromSeamBoundaries(
              result,
              entry,
              anchor,
              `${joinType} Step 39 source-vertex render entry at ${anchorId}`
            )
            if (joinType === 'round') {
              assertRoundUsesLocalSourceVertexArc(
                entry,
                anchor,
                `${joinType} Step 39 source-vertex render entry at ${anchorId}`
              )
            }
          }

          expect(
            finalFaceEntries.every(
              (entry) =>
                entry.debugMeta?.productMode !==
                'pre-legality-source-vertex-join'
            ),
            `${joinType} Step 36 final face at ${anchorId} must not consume Step 29 pre-legality evidence as visible output`
          ).toBe(true)

          expect(
            joinEntries.every(
              (entry) =>
                entry.debugMeta?.productMode !==
                'pre-legality-source-vertex-join'
            ),
            `${joinType} render entry at ${anchorId} must not consume Step 29 pre-legality evidence as visible output: ${JSON.stringify(
              joinEntries.map((entry) => ({
                productSignature: entry.debugMeta?.productSignature,
                seamEvidence:
                  (
                    entry.debugMeta as
                      | {
                          seamEvidence?: {
                            incidentSeamBoundaries?: unknown[]
                          }
                        }
                      | undefined
                  )?.seamEvidence ?? null,
                joinOwnershipRecords:
                  entry.debugMeta?.joinOwnershipRecords?.map((record) => ({
                    kind: record.kind,
                    materializationKind: record.materializationKind,
                    previousDashBodyPoint: record.previousDashBodyPoint,
                    nextDashBodyPoint: record.nextDashBodyPoint
                  })) ?? []
              })),
              null,
              2
            )}`
          ).toBe(true)
        }
      })
    }
  }
}

export type ReportedVector34TerminalOracleGroup =
  | 'ownership-evidence'
  | 'half-dash-survival'
  | 'reference-endpoints'

export interface ReportedVector34TerminalOracleOptions {
  groups?: readonly ReportedVector34TerminalOracleGroup[]
}

const allReportedVector34TerminalOracleGroups: readonly ReportedVector34TerminalOracleGroup[] =
  ['ownership-evidence', 'half-dash-survival', 'reference-endpoints']

export const registerReportedVector34TerminalOracleTests = (
  options: ReportedVector34TerminalOracleOptions = {}
) => {
  const groups = new Set(
    options.groups ?? allReportedVector34TerminalOracleGroups
  )

  if (groups.has('ownership-evidence')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`preserves ${joinType} terminal ownership as non-visible Step 30 evidence over Step 27 bodies`, () => {
        const result = buildReportedPipelineResult(joinType)
        const illegalVisibleTerminalEntries = result.renderEntries.filter(
          (entry) => {
            const debugMeta = entry.debugMeta
            return (
              debugMeta?.ownerStepId === 'build-terminal-body-products' ||
              debugMeta?.ownerStage ===
                'Stroke Geometry terminal body assembly' ||
              debugMeta?.ownerStage ===
                'Stroke Geometry terminal body ownership binding' ||
              debugMeta?.visibleContributor === 'terminal-interval-body' ||
              debugMeta?.visibleContributor ===
                'none-non-visible-ownership-overlay' ||
              debugMeta?.routeId === 'constrained-dashed-terminal-body-product'
            )
          }
        )
        const packetEnvelopes = result.packets.flatMap((packet) => {
          const envelope = packet.geometry.debugMeta?.productEvidenceEnvelope
          return envelope ? [envelope] : []
        })
        const finalFaceEnvelopes = result.finalFaces.flatMap((face) =>
          face.productEvidenceEnvelope ? [face.productEvidenceEnvelope] : []
        )
        const renderEntryEnvelopes = result.renderEntries.flatMap((entry) => {
          const envelope = entry.debugMeta?.productEvidenceEnvelope
          return envelope ? [envelope] : []
        })
        const hitEnvelopes = result.hitPackets.flatMap((packet) =>
          packet.productEvidenceEnvelope ? [packet.productEvidenceEnvelope] : []
        )
        const exportEnvelopes = result.exportPackets.flatMap((packet) =>
          packet.productEvidenceEnvelope ? [packet.productEvidenceEnvelope] : []
        )
        const packetOverlays =
          getUniqueTerminalOwnershipOverlays(packetEnvelopes)
        const overlayIds = packetOverlays.map((overlay) => overlay.overlayId)
        const preservedOverlayIds = {
          finalFaces: getUniqueTerminalOwnershipOverlays(
            finalFaceEnvelopes
          ).map((overlay) => overlay.overlayId),
          renderEntries: getUniqueTerminalOwnershipOverlays(
            renderEntryEnvelopes
          ).map((overlay) => overlay.overlayId),
          hit: getUniqueTerminalOwnershipOverlays(hitEnvelopes).map(
            (overlay) => overlay.overlayId
          ),
          export: getUniqueTerminalOwnershipOverlays(exportEnvelopes).map(
            (overlay) => overlay.overlayId
          )
        }

        expect(
          illegalVisibleTerminalEntries.map((entry) => ({
            ownerStepId: entry.debugMeta?.ownerStepId,
            ownerStage: entry.debugMeta?.ownerStage,
            routeId: entry.debugMeta?.routeId,
            visibleContributor: entry.debugMeta?.visibleContributor
          }))
        ).toEqual([])
        expect(
          overlayIds.length,
          `${joinType} packet terminal ownership evidence`
        ).toBeGreaterThan(0)
        for (const [stage, stageOverlayIds] of Object.entries(
          preservedOverlayIds
        )) {
          expect(
            stageOverlayIds,
            `${joinType} ${stage} terminal evidence`
          ).toEqual(overlayIds)
        }
        for (const overlay of packetOverlays) {
          expect(overlay).toMatchObject({
            ownerStepId: 'build-terminal-body-products',
            zeroVisibleContribution: true
          })
          expect(
            packetEnvelopes.some(
              (envelope) =>
                envelope.bodyProductIds.includes(overlay.bodyProductId) &&
                envelope.terminalOwnershipOverlays.some(
                  (candidate) => candidate.overlayId === overlay.overlayId
                )
            ),
            `${joinType} ${overlay.overlayId}: referenced Step 27 body identity`
          ).toBe(true)
          expect(
            result.renderEntries.some(
              (entry) =>
                entry.polygons.length > 0 &&
                (
                  entry.productIdentity.productEvidenceEnvelope ??
                  entry.debugMeta?.productEvidenceEnvelope
                )?.bodyProductIds.includes(overlay.bodyProductId) === true
            ),
            `${joinType} ${overlay.overlayId}: visible composite preserves the referenced Step 27 body identity`
          ).toBe(true)
        }
        expect(JSON.stringify(packetOverlays)).not.toMatch(
          /"polygons"|"strokePaths"|"paint"|"capContributors"/
        )
      })
    }
  }

  if (groups.has('half-dash-survival')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`preserves every independent ${joinType} terminal half dash from Step 27/30 products through final faces and render entries`, () => {
        const result = buildReportedPipelineResult(joinType)
        const packetRecords = collectTerminalHalfDashSurvivalRecords(
          result.packets.map((packet) => ({
            polygons: packet.geometry.polygons,
            debugMeta: packet.geometry.debugMeta
          }))
        )
        const finalFaceRecords = collectTerminalHalfDashSurvivalRecords(
          result.finalFaces
        )
        const renderEntryRecords = collectTerminalHalfDashSurvivalRecords(
          result.renderEntries
        )

        const packetRecordsBySourceSegment = new Map<
          number,
          Set<TerminalHalfDashRole>
        >()
        packetRecords.forEach((record) => {
          if (record.sourceSegmentIndex === null) {
            return
          }
          const roles =
            packetRecordsBySourceSegment.get(record.sourceSegmentIndex) ??
            new Set<TerminalHalfDashRole>()
          roles.add(record.terminalRole)
          packetRecordsBySourceSegment.set(record.sourceSegmentIndex, roles)
        })

        expect(
          packetRecordsBySourceSegment.size,
          `${joinType} Step 27/30 products must expose source-segment terminal provenance`
        ).toBeGreaterThan(0)

        for (const [
          sourceSegmentIndex,
          roles
        ] of packetRecordsBySourceSegment) {
          expect(
            roles.has('start') || roles.has('start-end'),
            `${joinType} source segment ${sourceSegmentIndex} must keep a start half-terminal dash in Step 27/30 records`
          ).toBe(true)
          expect(
            roles.has('end') || roles.has('start-end'),
            `${joinType} source segment ${sourceSegmentIndex} must keep an end half-terminal dash in Step 27/30 records`
          ).toBe(true)
        }

        const finalFaceKeys = new Set(
          finalFaceRecords.map((record) => record.key)
        )
        const renderEntryKeys = new Set(
          renderEntryRecords.map((record) => record.key)
        )
        const packetTerminalKeys = new Set(
          packetRecords.map((record) => record.key)
        )
        const missingFinalFaceTerminalRecords = packetRecords.filter(
          (record) => !finalFaceKeys.has(record.key)
        )
        const missingRenderEntryTerminalRecords = packetRecords.filter(
          (record) => !renderEntryKeys.has(record.key)
        )
        const synthesizedRenderEntryTerminalRecords = renderEntryRecords.filter(
          (record) => !packetTerminalKeys.has(record.key)
        )

        expect(
          finalFaceRecords.filter((record) => record.polygonArea <= 0),
          `${joinType} Step 36 final faces must keep visible terminal half-dash product area`
        ).toEqual([])
        expect(
          renderEntryRecords.filter((record) => record.polygonArea <= 0),
          `${joinType} Step 39 render entries must keep visible terminal half-dash product area`
        ).toEqual([])

        expect(
          missingFinalFaceTerminalRecords.map((record) => ({
            key: record.key,
            intervalId: record.intervalId,
            terminalRole: record.terminalRole,
            sourceSegmentIndex: record.sourceSegmentIndex,
            splitRangeId: record.splitRangeId,
            routeId: record.routeId,
            visibleContributor: record.visibleContributor
          })),
          `${joinType} Step 36 must preserve every Step 27/30 terminal half-dash identity: ${JSON.stringify(
            {
              missingFinalFaceTerminalRecords:
                missingFinalFaceTerminalRecords.length,
              packetKeys: [...packetTerminalKeys].sort(),
              finalFaceKeys: [...finalFaceKeys].sort()
            },
            null,
            2
          )}`
        ).toEqual([])
        expect(
          missingRenderEntryTerminalRecords.map((record) => ({
            key: record.key,
            intervalId: record.intervalId,
            terminalRole: record.terminalRole,
            sourceSegmentIndex: record.sourceSegmentIndex,
            splitRangeId: record.splitRangeId,
            routeId: record.routeId,
            visibleContributor: record.visibleContributor
          })),
          `${joinType} Step 39/40 must preserve every Step 27/30 terminal half-dash identity as render-visible input: ${JSON.stringify(
            {
              missingRenderEntryTerminalRecords:
                missingRenderEntryTerminalRecords.length,
              renderEntryPipelineCounters: result.pipelineTrace
                .filter((trace) => trace.eventName === 'counter')
                .map((trace) => trace.payload.counterName)
                .filter(
                  (counterName): counterName is string =>
                    typeof counterName === 'string' &&
                    counterName.includes('render-entry')
                ),
              packetKeys: [...packetTerminalKeys].sort(),
              renderEntryKeys: [...renderEntryKeys].sort(),
              relatedRenderEntries: result.renderEntries
                .filter((entry) => {
                  const intervalIds = getPacketIntervalIds(entry.debugMeta)
                  return missingRenderEntryTerminalRecords.some((record) =>
                    intervalIds.has(record.intervalId)
                  )
                })
                .map((entry) => ({
                  cacheKey: entry.cacheKey,
                  routeId: entry.debugMeta?.routeId ?? null,
                  visibleContributor:
                    entry.debugMeta?.visibleContributor ?? null,
                  intervalIds: [
                    ...getPacketIntervalIds(entry.debugMeta)
                  ].sort(),
                  domainPlanTerminalRole:
                    entry.debugMeta?.domainPlanTerminalRole ?? null,
                  domainPlanSplitRangeId:
                    entry.debugMeta?.domainPlanSplitRangeId ?? null,
                  domainPlanSplitRangeSourceSegmentIndex:
                    entry.debugMeta?.domainPlanSplitRangeSourceSegmentIndex ??
                    null,
                  dashProductIntervals:
                    entry.debugMeta?.dashProductIntervals?.map((interval) => ({
                      intervalId: interval.intervalId,
                      terminalRole: interval.terminalRole ?? null,
                      splitRangeId: interval.splitRangeId ?? null,
                      sourceSegmentIndex: interval.sourceSegmentIndex ?? null
                    })) ?? []
                })),
              relatedBySourceGeometryRenderEntries: result.renderEntries
                .filter((entry) =>
                  missingRenderEntryTerminalRecords.some(
                    (record) =>
                      entry.cacheKey.includes(record.intervalId) ||
                      (entry.debugMeta?.visualOverlapSourceFaceIds ?? []).some(
                        (id) => id.includes(record.intervalId)
                      ) ||
                      (
                        entry.debugMeta?.visualOverlapSourceGeometryIds ?? []
                      ).some((id) => id.includes(record.intervalId))
                  )
                )
                .map((entry) => ({
                  routeId: entry.debugMeta?.routeId ?? null,
                  visibleContributor:
                    entry.debugMeta?.visibleContributor ?? null,
                  intervalIds: [
                    ...getPacketIntervalIds(entry.debugMeta)
                  ].sort(),
                  visualOverlapCollapseStatus:
                    entry.debugMeta?.visualOverlapCollapseStatus ?? null,
                  missingIntervalsInCacheKey: missingRenderEntryTerminalRecords
                    .filter((record) =>
                      entry.cacheKey.includes(record.intervalId)
                    )
                    .map((record) => record.intervalId),
                  missingIntervalsInSourceFaceIds:
                    missingRenderEntryTerminalRecords
                      .filter((record) =>
                        (
                          entry.debugMeta?.visualOverlapSourceFaceIds ?? []
                        ).some((id) => id.includes(record.intervalId))
                      )
                      .map((record) => record.intervalId),
                  missingIntervalsInSourceGeometryIds:
                    missingRenderEntryTerminalRecords
                      .filter((record) =>
                        (
                          entry.debugMeta?.visualOverlapSourceGeometryIds ?? []
                        ).some((id) => id.includes(record.intervalId))
                      )
                      .map((record) => record.intervalId),
                  polygonCount: entry.polygons.length
                })),
              relatedFinalFaces: result.finalFaces
                .filter((face) => {
                  const intervalIds = getPacketIntervalIds(face.debugMeta)
                  return missingRenderEntryTerminalRecords.some((record) =>
                    intervalIds.has(record.intervalId)
                  )
                })
                .map((face) => ({
                  faceId: face.faceId,
                  geometryId: face.geometryId,
                  routeId: face.debugMeta?.routeId ?? null,
                  visibleContributor:
                    face.debugMeta?.visibleContributor ?? null,
                  productSignature: face.debugMeta?.productSignature ?? null,
                  intervalIds: [...getPacketIntervalIds(face.debugMeta)].sort(),
                  visualOverlapGroupId:
                    face.debugMeta?.visualOverlapGroupId ?? null,
                  visualOverlapSourceGeometryIds:
                    face.debugMeta?.visualOverlapSourceGeometryIds ?? [],
                  polygonCount: face.polygons.length
                })),
              smoothContinuityFinalFaces: result.finalFaces
                .filter(
                  (face) =>
                    face.debugMeta?.visibleContributor ===
                      'smooth-continuity-dash-body' ||
                    face.debugMeta?.ownerStage ===
                      'Stroke Geometry smooth-continuity product assembly' ||
                    face.debugMeta?.routeId ===
                      'constrained-dashed-smooth-continuity-product'
                )
                .map((face) => ({
                  faceId: face.faceId,
                  geometryId: face.geometryId,
                  routeId: face.debugMeta?.routeId ?? null,
                  visibleContributor:
                    face.debugMeta?.visibleContributor ?? null,
                  productSignature: face.debugMeta?.productSignature ?? null,
                  intervalIds: [...getPacketIntervalIds(face.debugMeta)].sort(),
                  domainPlanTerminalRole:
                    face.debugMeta?.domainPlanTerminalRole ?? null,
                  domainPlanSplitRangeId:
                    face.debugMeta?.domainPlanSplitRangeId ?? null,
                  domainPlanSplitRangeSourceSegmentIndex:
                    face.debugMeta?.domainPlanSplitRangeSourceSegmentIndex ??
                    null,
                  dashProductIntervals:
                    face.debugMeta?.dashProductIntervals?.map((interval) => ({
                      intervalId: interval.intervalId,
                      terminalRole: interval.terminalRole ?? null,
                      splitRangeId: interval.splitRangeId ?? null,
                      sourceSegmentIndex: interval.sourceSegmentIndex ?? null
                    })) ?? []
                })),
              smoothContinuityRenderEntries: result.renderEntries
                .filter(
                  (entry) =>
                    entry.debugMeta?.visibleContributor ===
                      'smooth-continuity-dash-body' ||
                    entry.debugMeta?.ownerStage ===
                      'Stroke Geometry smooth-continuity product assembly' ||
                    entry.debugMeta?.routeId ===
                      'constrained-dashed-smooth-continuity-product'
                )
                .map((entry) => ({
                  cacheKey: entry.cacheKey,
                  routeId: entry.debugMeta?.routeId ?? null,
                  visibleContributor:
                    entry.debugMeta?.visibleContributor ?? null,
                  productSignature: entry.debugMeta?.productSignature ?? null,
                  intervalIds: [
                    ...getPacketIntervalIds(entry.debugMeta)
                  ].sort(),
                  domainPlanTerminalRole:
                    entry.debugMeta?.domainPlanTerminalRole ?? null,
                  domainPlanSplitRangeId:
                    entry.debugMeta?.domainPlanSplitRangeId ?? null,
                  domainPlanSplitRangeSourceSegmentIndex:
                    entry.debugMeta?.domainPlanSplitRangeSourceSegmentIndex ??
                    null,
                  dashProductIntervals:
                    entry.debugMeta?.dashProductIntervals?.map((interval) => ({
                      intervalId: interval.intervalId,
                      terminalRole: interval.terminalRole ?? null,
                      splitRangeId: interval.splitRangeId ?? null,
                      sourceSegmentIndex: interval.sourceSegmentIndex ?? null
                    })) ?? []
                }))
            },
            null,
            2
          )}`
        ).toEqual([])
        expect(
          synthesizedRenderEntryTerminalRecords.map((record) => ({
            key: record.key,
            intervalId: record.intervalId,
            terminalRole: record.terminalRole,
            sourceSegmentIndex: record.sourceSegmentIndex,
            splitRangeId: record.splitRangeId,
            routeId: record.routeId,
            visibleContributor: record.visibleContributor
          })),
          `${joinType} render entries must not synthesize terminal half-dashes after Step 27/30`
        ).toEqual([])
      })
    }
  }

  if (groups.has('reference-endpoints')) {
    it('proves Step 22 and Step 23 declare the failing inside source segment endpoint as an independent end terminal interval', () => {
      const proof = buildReferenceAcuteBoundaryProof('inside')
      const sourceSegmentIndex = 1
      const splitRangeDomains = proof.strokeDomainPlan.splitRangeDomains.filter(
        (domain) => domain.sourceSegmentIndex === sourceSegmentIndex
      )
      const targetTerminalIntervals = proof.visibleIntervals.filter(
        (interval) =>
          interval.domainPlanSplitRangeSourceSegmentIndex ===
            sourceSegmentIndex &&
          (interval.domainPlanTerminalRole === 'end' ||
            interval.domainPlanTerminalRole === 'start-end')
      )

      expect(proof.strokeDomainPlan).toMatchObject({
        intervalDomainKind: 'domain-plan-split-range',
        domainMode: 'closed-constrained-domain'
      })
      expect(
        splitRangeDomains.length,
        'Step 22 must declare source segment 1 as an independent constrained split range'
      ).toBeGreaterThan(0)
      expect(
        targetTerminalIntervals.map((interval) => ({
          intervalId: interval.intervalId,
          splitRangeId: interval.domainPlanSplitRangeId,
          terminalRole: interval.domainPlanTerminalRole,
          sourceSegmentIndex: interval.domainPlanSplitRangeSourceSegmentIndex,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance,
          sourceStartDistance: interval.domainPlanSplitRangeSourceStartDistance,
          sourceEndDistance: interval.domainPlanSplitRangeSourceEndDistance
        })),
        'Step 23 must allocate the failing endpoint as a visible terminal interval with source provenance'
      ).toEqual([
        expect.objectContaining({
          intervalId: expect.any(String),
          splitRangeId: expect.any(String),
          terminalRole: 'end',
          sourceSegmentIndex
        })
      ])
    })

    for (const position of ['inside', 'outside'] as const) {
      it(`keeps constrained ${position} terminal half-dash products painted near every independent segment endpoint`, () => {
        const result = buildReferenceAcutePipelineResult(position)
        const survivalStages = [
          {
            label: 'Step 27/30 resolved packets',
            records: collectTerminalHalfDashSurvivalRecords(
              result.packets.map((packet) => ({
                polygons: packet.geometry.polygons,
                debugMeta: packet.geometry.debugMeta
              }))
            ),
            polygons: collectProductPolygons(result.packets)
          },
          {
            label: 'Step 36 final faces',
            records: collectTerminalHalfDashSurvivalRecords(result.finalFaces),
            polygons: collectProductPolygons(result.finalFaces)
          },
          {
            label: 'Step 39 render entries',
            records: collectTerminalHalfDashSurvivalRecords(
              result.renderEntries
            ),
            polygons: collectProductPolygons(result.renderEntries)
          }
        ]
        const probes = getSourceSegmentEndpointProbes(result)
        const gapProbes = getSourceSegmentGapProbes(result)

        expect(
          probes.length,
          `${position} reference fixture must expose endpoint probes for every source segment`
        ).toBe(result.network.segmentIds.length * 2)
        expect(
          gapProbes.length,
          `${position} reference fixture must expose gap probes for every source segment`
        ).toBe(result.network.segmentIds.length * 2)

        for (const probe of probes) {
          for (const stage of survivalStages) {
            const matchingTerminalProducts = stage.records.filter(
              (record) =>
                record.sourceSegmentIndex === probe.sourceSegmentIndex &&
                (record.terminalRole === probe.terminalRole ||
                  record.terminalRole === 'start-end')
            )
            const matchingPolygons = matchingTerminalProducts.flatMap(
              (record) => record.polygons
            )
            const distanceToTerminal = distanceToPolygons(
              probe.point,
              matchingPolygons
            )
            const sameSegmentStageRecords = stage.records.filter(
              (record) => record.sourceSegmentIndex === probe.sourceSegmentIndex
            )

            expect(
              matchingTerminalProducts.length,
              `${position} ${stage.label} source segment ${probe.sourceSegmentIndex} ${probe.terminalRole} endpoint must retain a terminal half-dash product: ${JSON.stringify(
                {
                  probe,
                  sameSegmentStageRecords: summarizeTerminalSurvivalRecords(
                    sameSegmentStageRecords
                  ),
                  allStageRecords: summarizeTerminalSurvivalRecords(
                    stage.records
                  ),
                  renderEntryDiagnostics:
                    stage.label === 'Step 39 render entries'
                      ? result.renderEntries.map((entry) => ({
                          cacheKey: entry.cacheKey,
                          routeId: entry.debugMeta?.routeId ?? null,
                          visibleContributor:
                            entry.debugMeta?.visibleContributor ?? null,
                          intervalId: entry.debugMeta?.intervalId ?? null,
                          intervalIds: entry.debugMeta?.intervalIds ?? [],
                          domainPlanTerminalRole:
                            entry.debugMeta?.domainPlanTerminalRole ?? null,
                          terminalDashProductIntervals:
                            entry.debugMeta?.dashProductIntervals
                              ?.map((interval) => ({
                                intervalId: interval.intervalId,
                                terminalRole: interval.terminalRole ?? null,
                                sourceSegmentIndex:
                                  interval.sourceSegmentIndex ?? null,
                                splitRangeId: interval.splitRangeId ?? null
                              }))
                              .filter((interval) =>
                                isTerminalHalfDashRole(interval.terminalRole)
                              ) ?? [],
                          middleDashProductIntervalCount:
                            entry.debugMeta?.dashProductIntervals?.filter(
                              (interval) => interval.terminalRole === 'middle'
                            ).length ?? 0,
                          polygonCount: entry.polygons.length
                        }))
                      : undefined,
                  finalFaceDiagnostics:
                    stage.label === 'Step 39 render entries'
                      ? {
                          faceCount: result.finalFaces.length,
                          terminalRecords: summarizeTerminalSurvivalRecords(
                            collectTerminalHalfDashSurvivalRecords(
                              result.finalFaces
                            )
                          ),
                          terminalDashIntervalFaceCount:
                            result.finalFaces.filter((face) =>
                              face.debugMeta?.dashProductIntervals?.some(
                                (interval) =>
                                  isTerminalHalfDashRole(interval.terminalRole)
                              )
                            ).length,
                          middleDashIntervalFaceCount: result.finalFaces.filter(
                            (face) =>
                              face.debugMeta?.dashProductIntervals?.some(
                                (interval) => interval.terminalRole === 'middle'
                              )
                          ).length
                        }
                      : undefined
                },
                null,
                2
              )}`
            ).toBeGreaterThan(0)
            expect(
              distanceToTerminal,
              `${position} ${stage.label} source segment ${probe.sourceSegmentIndex} ${probe.terminalRole} endpoint half-dash must remain painted near the source endpoint: ${JSON.stringify(
                {
                  probe,
                  distanceToTerminal,
                  terminalProducts: summarizeTerminalSurvivalRecords(
                    matchingTerminalProducts
                  )
                },
                null,
                2
              )}`
            ).toBeLessThanOrEqual(result.stroke.width * 1.5)
          }
        }

        for (const probe of gapProbes) {
          for (const stage of survivalStages) {
            const distanceToVisibleProduct = distanceToPolygons(
              probe.point,
              stage.polygons
            )
            expect(
              distanceToVisibleProduct,
              `${position} ${stage.label} source segment ${probe.sourceSegmentIndex} ${probe.gapRole} probe must stay inside the configured gap and outside all visible products: ${JSON.stringify(
                {
                  probe,
                  distanceToVisibleProduct
                },
                null,
                2
              )}`
            ).toBeGreaterThan(result.stroke.width * 0.05)
          }
        }

        const visibleStrokePathDescriptorEntries = result.renderEntries.filter(
          (entry) =>
            (entry.strokePathGroups?.length ?? 0) > 0 ||
            (entry.strokePaths?.length ?? 0) > 0
        )
        const packetTerminalOverlayIds = getUniqueTerminalOwnershipOverlays(
          result.packets.flatMap((packet) => {
            const envelope = packet.geometry.debugMeta?.productEvidenceEnvelope
            return envelope ? [envelope] : []
          })
        ).map((overlay) => overlay.overlayId)
        const renderTerminalOverlayIds = getUniqueTerminalOwnershipOverlays(
          result.renderEntries.flatMap((entry) => {
            const envelope =
              entry.productIdentity.productEvidenceEnvelope ??
              entry.debugMeta?.productEvidenceEnvelope
            return envelope ? [envelope] : []
          })
        ).map((overlay) => overlay.overlayId)
        const terminalIntervalIds = Array.from(
          new Set(
            collectTerminalHalfDashSurvivalRecords(
              result.packets.map((packet) => ({
                polygons: packet.geometry.polygons,
                debugMeta: packet.geometry.debugMeta
              }))
            ).map((record) => record.intervalId)
          )
        )

        expect(renderTerminalOverlayIds).toEqual(packetTerminalOverlayIds)
        for (const entry of visibleStrokePathDescriptorEntries) {
          expect(entry.fillPolygons).toBeUndefined()
          expect(
            terminalIntervalIds.every((intervalId) =>
              entry.productIdentity.intervalIds.includes(intervalId)
            ),
            `${position} visible descriptor product identity must preserve every terminal interval`
          ).toBe(true)
          expect(
            entry.productIdentity.productEvidenceEnvelope,
            `${position} visible descriptor must preserve the constrained dashed evidence envelope`
          ).toBeDefined()
        }
      })
    }
  }
}

export type ReportedVector34OutputOracleGroup =
  | 'alpha-overdraw'
  | 'outside-legality'
  | 'shared-boundary'
  | 'sequential-update'
  | 'full-diagnostics'
  | 'metadata-ownership'

export interface ReportedVector34OutputOracleOptions {
  groups?: readonly ReportedVector34OutputOracleGroup[]
}

const allReportedVector34OutputOracleGroups: readonly ReportedVector34OutputOracleGroup[] =
  [
    'alpha-overdraw',
    'outside-legality',
    'shared-boundary',
    'sequential-update',
    'full-diagnostics',
    'metadata-ownership'
  ]

export const registerReportedVector34OutputOracleTests = (
  options: ReportedVector34OutputOracleOptions = {}
) => {
  const groups = new Set(
    options.groups ?? allReportedVector34OutputOracleGroups
  )

  if (groups.has('alpha-overdraw')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`rejects repeated-alpha same-paint overdraw on reported ${joinType} outside dashed render entries`, () => {
        const result = buildReportedPipelineResult(joinType)

        assertNoSamePaintRenderEntryOverdraw(
          result.renderEntries,
          `${joinType} reported vector-34 outside dashed`
        )
      })
    }
  }

  if (groups.has('outside-legality')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`keeps reported ${joinType} outside dashed render products on the authored outside stroke position`, () => {
        const result = buildReportedPipelineResult(joinType)
        const packetProducts = result.packets.map((packet) => ({
          polygons: packet.geometry.polygons,
          bounds: packet.geometry.bounds,
          debugMeta: packet.geometry.debugMeta
        }))

        for (const stage of [
          {
            label: `${joinType} reported vector-34 Step 27/30/31 packets`,
            products: packetProducts
          },
          {
            label: `${joinType} reported vector-34 Step 36 final faces`,
            products: result.finalFaces
          },
          {
            label: `${joinType} reported vector-34 Step 39 render entries`,
            products: result.renderEntries
          }
        ]) {
          assertOutsideVisibleProductsDoNotEnterImplicitFillRegions(
            result,
            stage.products,
            stage.label
          )
        }
      })
    }
  }

  if (groups.has('shared-boundary')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`rejects internal shared-boundary render polygons on reported ${joinType} outside dashed render entries`, () => {
        const result = buildReportedPipelineResult(joinType)

        assertNoInternalSharedBoundaryRenderPolygons(
          result.renderEntries,
          `${joinType} reported vector-34 outside dashed`
        )
      })
    }
  }

  if (groups.has('sequential-update')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`rejects internal shared-boundary render polygons after sequential reported ${joinType} outside dashed join changes`, () => {
        const result = buildPipelineResult({
          fixture: createReportedVector34Fixture(),
          stroke: buildReportedStrokeWithJoin(joinType),
          pathId: 'vector:vector-1:tn-28:constrained-dashed',
          sourceId: 'vector-1',
          ownerKeyPrefix: 'vector:vector-1:tn-28:stroke:0:stroke:0:outside'
        })

        assertNoInternalSharedBoundaryRenderPolygons(
          result.renderEntries,
          `${joinType} reported vector-34 outside dashed sequential app route`
        )
      })
    }
  }

  if (groups.has('full-diagnostics')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`rejects internal shared-boundary render polygons in full diagnostics ${joinType} app-runtime mode`, () => {
        const diagnosticsGlobal = globalThis as {
          __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off' | 'summary' | 'full'
        }
        const previousDiagnosticsMode =
          diagnosticsGlobal.__ASYRA_STROKE_DIAGNOSTICS_MODE__
        diagnosticsGlobal.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
        try {
          const result = buildPipelineResult({
            fixture: createReportedVector34Fixture(),
            stroke: buildReportedStrokeWithJoin(joinType),
            pathId: 'vector:vector-1:tn-28:constrained-dashed',
            sourceId: 'vector-1',
            ownerKeyPrefix: 'vector:vector-1:tn-28:stroke:0:stroke:0:outside'
          })

          assertNoInternalSharedBoundaryRenderPolygons(
            result.renderEntries,
            `${joinType} reported vector-34 outside dashed full diagnostics app-runtime route`
          )
        } finally {
          diagnosticsGlobal.__ASYRA_STROKE_DIAGNOSTICS_MODE__ =
            previousDiagnosticsMode
        }
      })
    }
  }

  if (groups.has('metadata-ownership')) {
    for (const joinType of ['miter', 'bevel', 'round'] as const) {
      it(`preserves ${joinType} runtime metadata and prevents renderer descriptor replay from owning sharp join shape`, () => {
        const result = buildReportedPipelineResult(joinType)
        const expectedResolvedJoin = joinType
        const metas = [
          ...result.packets.map((packet) => packet.geometry.debugMeta),
          ...result.finalFaces.map((face) => face.debugMeta),
          ...result.renderEntries.map((entry) => entry.debugMeta)
        ].filter((meta): meta is NonNullable<typeof meta> => meta !== undefined)

        expect(result.sourcePath.closed).toBe(true)
        expect(result.topology.topologyFamily).toBe('self-intersecting')
        expect(
          result.selfIntersecting?.fillRegions.length ?? 0
        ).toBeGreaterThan(0)
        expect(result.packets.length).toBeGreaterThan(0)
        expect(result.finalFaces.length).toBeGreaterThan(0)
        expect(result.renderEntries.length).toBeGreaterThan(0)
        expect(result.hitPackets.length).toBe(result.finalFaces.length)
        expect(result.exportPackets.length).toBe(result.finalFaces.length)
        expect(
          metas.some(
            (meta) =>
              meta.visibleContributor === 'source-vertex-join' &&
              meta.authoredJoin === joinType &&
              meta.resolvedJoin === expectedResolvedJoin &&
              meta.miterAngle === result.stroke.miterAngle &&
              meta.geometryBasis === 'canonical-join-footprint'
          )
        ).toBe(true)

        const descriptorGroups = result.renderEntries.flatMap((entry) =>
          (entry.strokePathGroups ?? []).map((group) => ({ entry, group }))
        )
        const sourceReplayGroups = descriptorGroups.filter(({ group }) =>
          group.strokePaths.some((strokePath) =>
            isSourcePathReplay(strokePath, result.sourcePath.sampledPoints)
          )
        )
        expect(sourceReplayGroups).toEqual([])

        for (const { entry, group } of descriptorGroups) {
          expect(entry.strokeMaskPolygons ?? []).toEqual([])
          expect(entry.fillPolygons ?? []).toEqual([])
          expect(group.strokePathStyle?.cap).toBe('butt')
          expect(group.strokePathStyle?.join).toBe(joinType)
          expect(group.strokePathStyle?.miterLimit).toBeCloseTo(
            authoredMiterAngleToRendererMiterLimit(result.stroke.miterAngle),
            3
          )
        }
      })
    }
  }
}

export const registerReportedVector34SmoothOracleTests = () => {
  for (const joinType of ['miter', 'bevel', 'round'] as const) {
    it(`keeps ${joinType} smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output`, () => {
      const result = buildReportedPipelineResult(joinType)

      const illegalSmoothJoinEntries = ['tp-114', 'tp-117'].flatMap(
        (anchorId) => {
          const anchor = result.points[anchorId]
          return getSourceVertexJoinEntriesForAnchor(
            result.renderEntries,
            anchor,
            result.stroke.width * 0.5
          ).map((entry) => ({
            anchorId,
            geometryId: entry.geometryId,
            productSignature: entry.debugMeta?.productSignature,
            visibleContributor: entry.debugMeta?.visibleContributor
          }))
        }
      )
      const fragmentedSmoothEntries = result.renderEntries
        .filter(
          (entry) =>
            String(entry.debugMeta?.productSignature ?? '').includes(
              'smooth-continuity'
            ) || entry.debugMeta?.smoothContinuityGroupId !== undefined
        )
        .filter((entry) => {
          const intervalIds = getUniqueTestStrings([
            ...(entry.runtimeMeta.intervalIds ?? []),
            ...(entry.debugMeta?.intervalIds ?? []),
            entry.debugMeta?.intervalId,
            ...(entry.debugMeta?.dashProductIntervals?.map(
              (interval) => interval.intervalId
            ) ?? [])
          ])
          return entry.polygons.length > Math.max(1, intervalIds.length)
        })
        .map((entry) => ({
          cacheKey: entry.cacheKey,
          ownerStage: entry.debugMeta?.ownerStage,
          visibleContributor: entry.debugMeta?.visibleContributor,
          geometryBasis: entry.debugMeta?.geometryBasis,
          domainPlanTerminalRole: entry.debugMeta?.domainPlanTerminalRole,
          materializationDistanceSpace:
            entry.debugMeta?.materializationDistanceSpace,
          strokePathGroupCount: entry.strokePathGroups?.length ?? 0,
          strokeMaskPolygonCount: entry.strokeMaskPolygons?.length ?? 0,
          rawProductArea: entry.debugMeta?.rawProductArea,
          selectedSideProductArea: entry.debugMeta?.selectedSideProductArea,
          processedProductArea: entry.debugMeta?.processedProductArea,
          cleanedProductArea: entry.debugMeta?.cleanedProductArea,
          boundaryClippedProductArea:
            entry.debugMeta?.boundaryClippedProductArea,
          boundarySideClippedProductArea:
            entry.debugMeta?.boundarySideClippedProductArea,
          finalProductArea: entry.debugMeta?.finalProductArea,
          sourceDomainExplicitSideProduct:
            entry.debugMeta?.sourceDomainExplicitSideProduct,
          selectedSideProductOwnsOutsideDomain:
            entry.debugMeta?.selectedSideProductOwnsOutsideDomain,
          implicitFillRegionCount: entry.debugMeta?.implicitFillRegionCount,
          legalDomainClipSourcePathPresent:
            entry.debugMeta?.legalDomainClipSourcePathPresent,
          legalDomainClipSourcePathClosed:
            entry.debugMeta?.legalDomainClipSourcePathClosed,
          smoothContinuityGroupId: entry.debugMeta?.smoothContinuityGroupId,
          intervalIds: getUniqueTestStrings([
            ...(entry.runtimeMeta.intervalIds ?? []),
            ...(entry.debugMeta?.intervalIds ?? []),
            entry.debugMeta?.intervalId,
            ...(entry.debugMeta?.dashProductIntervals?.map(
              (interval) => interval.intervalId
            ) ?? [])
          ]),
          productSignature: entry.debugMeta?.productSignature,
          polygonCount: entry.polygons.length
        }))
      const fragmentedSmoothPackets = result.packets
        .filter(
          (packet) =>
            String(packet.geometry.debugMeta?.productSignature ?? '').includes(
              'smooth-continuity'
            ) ||
            packet.geometry.debugMeta?.smoothContinuityGroupId !== undefined
        )
        .filter((packet) => packet.geometry.polygons.length > 1)
        .map((packet) => ({
          geometryId: packet.geometry.geometryId,
          ownerStage: packet.geometry.debugMeta?.ownerStage,
          visibleContributor: packet.geometry.debugMeta?.visibleContributor,
          geometryBasis: packet.geometry.debugMeta?.geometryBasis,
          intervalId: packet.geometry.debugMeta?.intervalId,
          domainPlanTerminalRole:
            packet.geometry.debugMeta?.domainPlanTerminalRole,
          rawProductArea: packet.geometry.debugMeta?.rawProductArea,
          selectedSideProductArea:
            packet.geometry.debugMeta?.selectedSideProductArea,
          processedProductArea: packet.geometry.debugMeta?.processedProductArea,
          cleanedProductArea: packet.geometry.debugMeta?.cleanedProductArea,
          boundaryClippedProductArea:
            packet.geometry.debugMeta?.boundaryClippedProductArea,
          boundarySideClippedProductArea:
            packet.geometry.debugMeta?.boundarySideClippedProductArea,
          finalProductArea: packet.geometry.debugMeta?.finalProductArea,
          sourceDomainExplicitSideProduct:
            packet.geometry.debugMeta?.sourceDomainExplicitSideProduct,
          selectedSideProductOwnsOutsideDomain:
            packet.geometry.debugMeta?.selectedSideProductOwnsOutsideDomain,
          implicitFillRegionCount:
            packet.geometry.debugMeta?.implicitFillRegionCount,
          legalDomainClipSourcePathPresent:
            packet.geometry.debugMeta?.legalDomainClipSourcePathPresent,
          legalDomainClipSourcePathClosed:
            packet.geometry.debugMeta?.legalDomainClipSourcePathClosed,
          smoothContinuityGroupId:
            packet.geometry.debugMeta?.smoothContinuityGroupId,
          productSignature: packet.geometry.debugMeta?.productSignature,
          polygonCount: packet.geometry.polygons.length
        }))

      expect(illegalSmoothJoinEntries).toEqual([])
      expect({
        count: fragmentedSmoothEntries.length,
        examples: fragmentedSmoothEntries.slice(0, 6),
        packetCount: fragmentedSmoothPackets.length,
        packetExamples: fragmentedSmoothPackets.slice(0, 6),
        routeTrace: result.pipelineTrace
          .filter(
            (entry) =>
              entry.eventName === 'smooth-continuity-fragmented-product'
          )
          .slice(0, 12)
      }).toEqual({
        count: 0,
        examples: [],
        packetCount: 0,
        packetExamples: [],
        routeTrace: []
      })
    })
  }

  it('preserves high-curvature smooth ownership as non-visible Step 31 evidence over Step 27 bodies', () => {
    const result = buildSmoothCurvaturePipelineResult()
    const sourceVertexJoinEntries = ['sp-1', 'sp-2', 'sp-3', 'sp-4'].flatMap(
      (anchorId) => {
        const anchor = result.points[anchorId]
        return getSourceVertexJoinEntriesForAnchor(
          result.renderEntries,
          anchor,
          result.stroke.width * 0.5
        )
      }
    )
    const illegalVisibleSmoothEntries = result.renderEntries.filter((entry) => {
      const debugMeta = entry.debugMeta
      return (
        debugMeta?.ownerStepId === 'build-smooth-continuity-products' ||
        debugMeta?.ownerStage ===
          'Stroke Geometry smooth-continuity product assembly' ||
        debugMeta?.ownerStage ===
          'Stroke Geometry smooth-continuity ownership binding' ||
        debugMeta?.visibleContributor === 'smooth-continuity-dash-body' ||
        debugMeta?.visibleContributor === 'same-owner-smooth-span-descriptor' ||
        debugMeta?.visibleContributor === 'none-non-visible-ownership-overlay'
      )
    })
    const packetEnvelopes = result.packets.flatMap((packet) => {
      const envelope = packet.geometry.debugMeta?.productEvidenceEnvelope
      return envelope ? [envelope] : []
    })
    const finalFaceEnvelopes = result.finalFaces.flatMap((face) =>
      face.productEvidenceEnvelope ? [face.productEvidenceEnvelope] : []
    )
    const renderEntryEnvelopes = result.renderEntries.flatMap((entry) => {
      const envelope = entry.debugMeta?.productEvidenceEnvelope
      return envelope ? [envelope] : []
    })
    const hitEnvelopes = result.hitPackets.flatMap((packet) =>
      packet.productEvidenceEnvelope ? [packet.productEvidenceEnvelope] : []
    )
    const exportEnvelopes = result.exportPackets.flatMap((packet) =>
      packet.productEvidenceEnvelope ? [packet.productEvidenceEnvelope] : []
    )
    const packetOverlays =
      getUniqueSmoothContinuityOwnershipOverlays(packetEnvelopes)
    const overlayIds = packetOverlays.map((overlay) => overlay.overlayId)
    const preservedOverlayIds = {
      finalFaces: getUniqueSmoothContinuityOwnershipOverlays(
        finalFaceEnvelopes
      ).map((overlay) => overlay.overlayId),
      renderEntries: getUniqueSmoothContinuityOwnershipOverlays(
        renderEntryEnvelopes
      ).map((overlay) => overlay.overlayId),
      hit: getUniqueSmoothContinuityOwnershipOverlays(hitEnvelopes).map(
        (overlay) => overlay.overlayId
      ),
      export: getUniqueSmoothContinuityOwnershipOverlays(exportEnvelopes).map(
        (overlay) => overlay.overlayId
      )
    }

    expect(sourceVertexJoinEntries).toEqual([])
    expect(
      illegalVisibleSmoothEntries.map((entry) => ({
        ownerStepId: entry.debugMeta?.ownerStepId,
        ownerStage: entry.debugMeta?.ownerStage,
        visibleContributor: entry.debugMeta?.visibleContributor
      }))
    ).toEqual([])
    expect(
      overlayIds.length,
      'packet smooth ownership evidence'
    ).toBeGreaterThan(0)
    for (const [stage, stageOverlayIds] of Object.entries(
      preservedOverlayIds
    )) {
      expect(stageOverlayIds, `${stage} smooth ownership evidence`).toEqual(
        overlayIds
      )
    }
    for (const overlay of packetOverlays) {
      expect(overlay).toMatchObject({
        ownerStepId: 'build-smooth-continuity-products',
        singleContinuousFootprintProof: true,
        noSourceVertexJoinOwnershipProof: true,
        zeroVisibleContribution: true
      })
      expect(overlay.bodyProductIds.length).toBeGreaterThan(0)
      expect(
        overlay.bodyProductIds.every((bodyProductId) =>
          packetEnvelopes.some(
            (envelope) =>
              envelope.bodyProductIds.includes(bodyProductId) &&
              envelope.smoothContinuityOwnershipOverlays.some(
                (candidate) => candidate.overlayId === overlay.overlayId
              )
          )
        ),
        `${overlay.overlayId}: referenced Step 27 body identities`
      ).toBe(true)
    }
    expect(JSON.stringify(packetOverlays)).not.toMatch(
      /"polygons"|"strokePaths"|"paint"/
    )
  })
}
