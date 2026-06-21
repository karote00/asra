import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { createDefaultStroke } from '@asyra/utils'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  buildPolylineGeometryModelPath,
  buildVectorGeometryModelPath
} from '../components/stroke-render/path-geometry'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import {
  buildSolidCenterStrokeExportPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  type SolidCenterStrokeGeometryDebugMeta
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildSolidCenterStrokePolygons } from '../components/stroke-render/solid-center-stroke-geometry'
import { buildSolidCenterStrokeResolvedPackets } from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import { polygonArea } from '../components/stroke-render/solid-stroke-geometry-core'
import {
  registerGeometryBackend,
  selectGeometryBackend,
  type GeometryBackend
} from '../components/stroke-render/geometry-backend'

interface Vec2 {
  x: number
  y: number
}

type CanonicalFailureArtifactKind =
  | 'self-check-star'
  | 'open-line'
  | 'right-angle'

interface CanonicalStrokeFailureArtifact {
  markerId: string
  errorCode:
    | 'STROKE_OVERLAP'
    | 'STROKE_INSIDE_LEAK'
    | 'STROKE_OUTSIDE_LEAK'
    | 'CAP_EXTENSION_MISSING'
    | 'CAP_SHAPE_MISMATCH'
    | 'SEGMENT_ENVELOPE_MISMATCH'
    | 'JOIN_MITER_DIRECTION'
    | 'JOIN_MITER_OVERTRIM_GAP'
    | 'JOIN_BEVEL_MISSING'
    | 'JOIN_ROUND_NOT_SMOOTH'
    | 'JOIN_ROUND_CONTINUITY_GAP'
    | 'JOIN_ROUND_ARC_SEAM_GAP'
    | 'JOIN_ROUND_BEVEL_PROTRUSION'
    | 'JOIN_SIGNATURE_MISSING'
    | 'JOIN_SOURCE_VERTEX_PACKET_MISSING'
    | 'PIPELINE_INCOMPLETE'
  caseKey: string
  summary: string
  fixtureKind: CanonicalFailureArtifactKind
  sourceSegmentId?: string
  sourcePointId?: string
  nearestAnchorId?: string
  localPoint: Vec2
  t?: number
  side?: 'inside' | 'outside' | 'center' | 'terminal' | 'join' | 'overlap'
  expected?: unknown
  actual?: unknown
  recommendedViewport: {
    zoom: number
    center: Vec2
  }
}

type StrokePosition = 'inside' | 'center' | 'outside'
type StrokeJoin = 'miter' | 'bevel' | 'round'
type StrokeCap = 'butt' | 'square' | 'round'

interface RenderEntryStrokePathStyleForTest {
  width: number
  cap: 'butt' | 'square' | 'round' | 'none'
  join: StrokeJoin
  miterLimit: number
}

interface RenderEntryStrokePathGroupForTest {
  clipPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathStyle?: RenderEntryStrokePathStyleForTest
}

interface RenderEntrySourceMaskForTest {
  clipPolygons?: Vec2[][]
  fillClipPolygons?: Vec2[][]
  fillExcludePolygons?: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: RenderEntryStrokePathGroupForTest[]
  strokePathStyle?: RenderEntryStrokePathStyleForTest
  cacheKey?: string
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
  runtimeMeta?: {
    productMode?: string
    productSignature?: string
    domainMode?: string
    strokePosition?: StrokePosition
    visualOverlapCollapseStatus?: string
  }
}

const STROKE_POSITIONS = ['inside', 'center', 'outside'] as const
const SOLID_JOINS = ['miter', 'bevel', 'round'] as const
const DASHED_TERMINAL_POLICY_JOINS = ['miter', 'bevel', 'round'] as const
const DASHED_CAPS = ['butt', 'square', 'round'] as const
const SELF_CHECK_DASH_PATTERN_FOR_TEST = [27, 20] as const
const CANONICAL_PERFORMANCE_SAMPLE_COUNT = Number(
  process.env.ASYRA_STROKE_CANONICAL_PERFORMANCE_SAMPLE_COUNT ?? 4
)
const CANONICAL_STATIC_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_CANONICAL_STATIC_P95_BUDGET_MS ?? 75
)
const CANONICAL_DRAG_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_CANONICAL_DRAG_P95_BUDGET_MS ?? 75
)
const CANONICAL_SOLID_STATIC_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_CANONICAL_SOLID_STATIC_P95_BUDGET_MS ?? 16.7
)
const CANONICAL_SOLID_DRAG_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_CANONICAL_SOLID_DRAG_P95_BUDGET_MS ?? 8.33
)
const ENABLE_CANONICAL_PHASE_PROFILE =
  process.env.ASYRA_STROKE_CANONICAL_PHASE_PROFILE === '1'

const SOLID_MATRIX_CASES = STROKE_POSITIONS.flatMap((position) =>
  SOLID_JOINS.map((joinType) => ({
    key: `solid:${position}:${joinType}`,
    position,
    joinType
  }))
)

const DASHED_MATRIX_CASES = STROKE_POSITIONS.flatMap((position) =>
  DASHED_CAPS.map((capType) => ({
    key: `dashed:${position}:${capType}`,
    position,
    capType
  }))
)

const CANONICAL_SELF_CHECK_SOURCE_FIXTURES = [
  {
    key: 'polyline-self-check-star',
    useCurvedSourcePath: false
  },
  {
    key: 'curved-self-check-star',
    useCurvedSourcePath: true
  }
] as const

const DASHED_INSIDE_LEGAL_DOMAIN_CASES =
  CANONICAL_SELF_CHECK_SOURCE_FIXTURES.flatMap((sourceFixture) =>
    DASHED_MATRIX_CASES.filter(({ position }) => position === 'inside').map(
      (caseDef) => ({
        ...caseDef,
        sourceFixture
      })
    )
  )

const DASHED_EXACT_OVERLAP_CASES = CANONICAL_SELF_CHECK_SOURCE_FIXTURES.flatMap(
  (sourceFixture) =>
    DASHED_MATRIX_CASES.map((caseDef) => ({
      ...caseDef,
      sourceFixture
    }))
)

const SOLID_CENTER_EXACT_OVERLAP_CASES =
  CANONICAL_SELF_CHECK_SOURCE_FIXTURES.flatMap((sourceFixture) =>
    SOLID_JOINS.map((joinType) => ({
      key: `solid:center:${joinType}`,
      position: 'center' as const,
      joinType,
      sourceFixture
    }))
  )

const DASHED_OUTSIDE_TERMINAL_POLICY_CASES =
  CANONICAL_SELF_CHECK_SOURCE_FIXTURES.flatMap((sourceFixture) =>
    DASHED_TERMINAL_POLICY_JOINS.map((joinType) => ({
      key: `dashed:outside:butt:${joinType}`,
      position: 'outside' as const,
      capType: 'butt' as const,
      joinType,
      sourceFixture
    }))
  )

type CanonicalGeometryOracleKind =
  | 'pipeline-completeness'
  | 'solid-segment-adherence'
  | 'solid-center-exact-overlap'
  | 'dashed-inside-legal-domain-product-parity'
  | 'dashed-inside-legal-domain'
  | 'dashed-source-join'
  | 'dashed-cap-footprint'
  | 'dashed-exact-overlap'
  | 'sampled-final-overlap'

const CANONICAL_GEOMETRY_ORACLE_REGISTRY: {
  key: string
  oracle: CanonicalGeometryOracleKind
}[] = [
  ...SOLID_MATRIX_CASES.flatMap(({ key }) => [
    { key, oracle: 'pipeline-completeness' as const },
    { key, oracle: 'solid-segment-adherence' as const },
    { key, oracle: 'sampled-final-overlap' as const }
  ]),
  ...SOLID_MATRIX_CASES.filter(({ position }) => position === 'center').map(
    ({ key }) => ({
      key,
      oracle: 'solid-center-exact-overlap' as const
    })
  ),
  ...DASHED_MATRIX_CASES.flatMap(({ key }) => [
    { key, oracle: 'pipeline-completeness' as const },
    { key, oracle: 'dashed-cap-footprint' as const },
    { key, oracle: 'dashed-exact-overlap' as const },
    { key, oracle: 'sampled-final-overlap' as const }
  ]),
  ...DASHED_MATRIX_CASES.filter(
    ({ position }) => position === 'inside'
  ).flatMap(({ key }) => [
    {
      key,
      oracle: 'dashed-inside-legal-domain-product-parity' as const
    },
    { key, oracle: 'dashed-inside-legal-domain' as const }
  ]),
  ...DASHED_MATRIX_CASES.filter(
    ({ position, capType }) => position === 'outside' && capType === 'butt'
  ).map(({ key }) => ({
    key,
    oracle: 'dashed-source-join' as const
  }))
]

const SELF_CHECK_STAR_POINTS: Vec2[] = [
  { x: 188.1928217922337, y: 0 },
  { x: 11.358174406717296, y: 365.76797704068724 },
  { x: 360.12094148356584, y: 145.95389587539378 },
  { x: 0, y: 15.668954151283657 },
  { x: 270.59180204238254, y: 347.0603956649177 }
]

const SELF_CHECK_STAR_VECTOR_POINTS: Record<string, VectorPointNode> = {
  'tp-12': {
    id: 'tp-12',
    kind: 'anchor',
    x: 188.1928217922337,
    y: 0,
    anchorType: 'smooth'
  },
  'tp-13': {
    id: 'tp-13',
    kind: 'anchor',
    x: 11.358174406717296,
    y: 365.76797704068724,
    anchorType: 'smooth'
  },
  'tp-12:out': {
    id: 'tp-12:out',
    kind: 'control',
    x: 164.3673966581619,
    y: 140.91988215887423,
    controlForId: 'tp-12',
    controlRole: 'out'
  },
  'tp-13:in': {
    id: 'tp-13:in',
    kind: 'control',
    x: -42.09205809548172,
    y: 344.92238636482955,
    controlForId: 'tp-13',
    controlRole: 'in'
  },
  'tp-13:out': {
    id: 'tp-13:out',
    kind: 'control',
    x: 78.17096503446606,
    y: 391.8249653855095,
    controlForId: 'tp-13',
    controlRole: 'out'
  },
  'tp-14': {
    id: 'tp-14',
    kind: 'anchor',
    x: 360.12094148356584,
    y: 145.95389587539378,
    anchorType: 'sharp'
  },
  'tp-15': {
    id: 'tp-15',
    kind: 'anchor',
    x: 0,
    y: 15.668954151283657,
    anchorType: 'sharp'
  },
  'tp-16': {
    id: 'tp-16',
    kind: 'anchor',
    x: 270.59180204238254,
    y: 347.0603956649177,
    anchorType: 'smooth'
  },
  'tp-15:out': {
    id: 'tp-15:out',
    kind: 'control',
    x: 0,
    y: 15.668954151283657,
    controlForId: 'tp-15',
    controlRole: 'out'
  },
  'tp-16:in': {
    id: 'tp-16:in',
    kind: 'control',
    x: 263.9105229796075,
    y: 364.43172122813246,
    controlForId: 'tp-16',
    controlRole: 'in'
  },
  'tp-16:out': {
    id: 'tp-16:out',
    kind: 'control',
    x: 277.27308110515736,
    y: 329.6890701017029,
    controlForId: 'tp-16',
    controlRole: 'out'
  }
}

const SELF_CHECK_STAR_VECTOR_SEGMENTS: Record<string, VectorSegment> = {
  'ts-23': {
    id: 'ts-23',
    startId: 'tp-12',
    endId: 'tp-13',
    outControlId: 'tp-12:out',
    inControlId: 'tp-13:in'
  },
  'ts-24': {
    id: 'ts-24',
    startId: 'tp-13',
    endId: 'tp-14',
    outControlId: 'tp-13:out',
    inControlId: null
  },
  'ts-25': {
    id: 'ts-25',
    startId: 'tp-14',
    endId: 'tp-15',
    outControlId: null,
    inControlId: null
  },
  'ts-26': {
    id: 'ts-26',
    startId: 'tp-15',
    endId: 'tp-16',
    outControlId: 'tp-15:out',
    inControlId: 'tp-16:in'
  },
  'ts-27': {
    id: 'ts-27',
    startId: 'tp-16',
    endId: 'tp-12',
    outControlId: 'tp-16:out',
    inControlId: null
  }
}

const SELF_CHECK_STAR_VECTOR_NETWORK: VectorNetwork = {
  id: 'tn-4',
  pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
  segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
  closed: true
}

const SELF_CHECK_SOURCE_VERTEX_ID_LIST =
  SELF_CHECK_STAR_VECTOR_NETWORK.pointIds.filter(
    (pointId) => SELF_CHECK_STAR_VECTOR_POINTS[pointId]?.kind === 'anchor'
  )

const SELF_CHECK_SOURCE_VERTEX_IDS = new Set(SELF_CHECK_SOURCE_VERTEX_ID_LIST)

const SELF_CHECK_STAR_SEGMENTS = SELF_CHECK_STAR_POINTS.map((point, index) => ({
  start: point,
  end: SELF_CHECK_STAR_POINTS[(index + 1) % SELF_CHECK_STAR_POINTS.length],
  segmentIndex: index
}))

const RIGHT_ANGLE_POINTS: Vec2[] = [
  { x: 0, y: 0 },
  { x: 120, y: 0 },
  { x: 120, y: 90 },
  { x: 0, y: 90 }
]

const OPEN_CURVE_POINTS: Vec2[] = [
  { x: 0, y: 80 },
  { x: 32, y: 8 },
  { x: 72, y: 8 },
  { x: 110, y: 80 },
  { x: 148, y: 152 },
  { x: 188, y: 152 },
  { x: 220, y: 80 }
]

const OPEN_LINE_POINTS: Vec2[] = [
  { x: 0, y: 0 },
  { x: 160, y: 0 }
]

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
let exactBackend: GeometryBackend | null = null
const REPO_ROOT = path.resolve(process.cwd(), '../..')
const FAILURE_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts/canonical-stroke-matrix/failures'
)
const FAILURE_MANIFEST_PATH = path.join(
  FAILURE_ARTIFACT_DIR,
  'failure-manifest.json'
)
const failureArtifacts: CanonicalStrokeFailureArtifact[] = []

const recordFailureArtifact = (
  artifact: Omit<CanonicalStrokeFailureArtifact, 'markerId'>
) => {
  const markerId = `F${String(failureArtifacts.length + 1).padStart(3, '0')}`
  failureArtifacts.push({
    markerId,
    ...artifact
  })
}

const writeFailureManifest = () => {
  mkdirSync(FAILURE_ARTIFACT_DIR, { recursive: true })
  if (failureArtifacts.length === 0) {
    if (existsSync(FAILURE_MANIFEST_PATH)) {
      rmSync(FAILURE_MANIFEST_PATH)
    }
    return
  }
  writeFileSync(
    FAILURE_MANIFEST_PATH,
    `${JSON.stringify(
      {
        protocolVersion: 1,
        generatedBy: 'stroke-canonical-matrix.test.ts',
        failureCount: failureArtifacts.length,
        failures: failureArtifacts
      },
      null,
      2
    )}\n`
  )
}

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

beforeAll(async () => {
  failureArtifacts.length = 0
  const backendId = 'clipper2-stroke-canonical-matrix-test'
  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId,
    backendVersion: `${backendId}@test`
  })
  exactBackend = backend
  registerGeometryBackend({
    backendId,
    load: () => backend
  })
  selectGeometryBackend(backendId)
})

afterAll(() => {
  writeFailureManifest()
})

const buildSelfCheckVectorSourcePath = () =>
  buildVectorGeometryModelPath(
    SELF_CHECK_STAR_VECTOR_NETWORK,
    SELF_CHECK_STAR_VECTOR_POINTS,
    SELF_CHECK_STAR_VECTOR_SEGMENTS
  )

const getSelfIntersectingOptions = (
  points: Vec2[],
  sourcePath = buildPolylineGeometryModelPath(points, true)
) => {
  const topology = buildPathTopologyModel({
    pathId: 'canonical-self-check-star',
    sourceId: 'canonical-self-check-star',
    networkId: 'canonical-self-check-star',
    sourceRevision: 'source-revision:canonical-self-check-star',
    sourceFamily: 'vector',
    points: sourcePath.sampledPoints,
    closed: true
  })
  const resolvedGeometry = buildResolvedVectorGeometryModel({
    modelId: 'canonical-self-check-star:resolved-geometry',
    fillRule: topology.fillRule,
    networks: [
      {
        networkId: topology.networkId,
        path: sourcePath,
        topology
      }
    ]
  })
  const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
  return {
    topology,
    sourcePath,
    implicitFillRegions: selfIntersecting?.fillRegions ?? [],
    implicitLegalFaceBoundaries: selfIntersecting?.legalFaceBoundaries ?? [],
    implicitUnfilledFaceBoundaries:
      selfIntersecting?.unfilledFaceBoundaries ?? [],
    implicitLegalBoundaryContours:
      selfIntersecting?.legalBoundaryContours ?? [],
    sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
    sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? [],
    ...(exactBackend ? { exactBackend } : {}),
    clipInsideToFillDomain: true
  }
}

const getCanonicalSelfCheckOptions = () =>
  getSelfIntersectingOptions(
    SELF_CHECK_STAR_POINTS,
    buildSelfCheckVectorSourcePath()
  )

const getFinitePolygonFailures = (polygons: Vec2[][]) =>
  polygons
    .map((polygon, polygonIndex) => ({
      polygonIndex,
      pointCount: polygon.length,
      nonFinite: polygon.filter(
        (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
      )
    }))
    .filter((entry) => entry.pointCount < 3 || entry.nonFinite.length > 0)

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const buildCanonicalDragPoints = (frame: number) => {
  const deltaX = Math.sin(frame / 3) * 18
  const deltaY = Math.cos(frame / 4) * 14
  return SELF_CHECK_STAR_POINTS.map((point, index) =>
    index === 0
      ? {
          x: point.x + deltaX,
          y: point.y + deltaY
        }
      : point
  )
}

const getBoundsArea = (bounds: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}) =>
  Math.max(0, bounds.maxX - bounds.minX) *
  Math.max(0, bounds.maxY - bounds.minY)

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  if (
    polygon.some(
      (current, index) =>
        pointSegmentDistance(
          point,
          current,
          polygon[(index + 1) % polygon.length]
        ) <= 0.2
    )
  ) {
    return true
  }

  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
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

const polygonListContainsPoint = (polygons: Vec2[][], point: Vec2) =>
  polygons.some((polygon) => isPointInPolygon(point, polygon))

const normalizeVector = (vector: Vec2) => {
  const length = Math.hypot(vector.x, vector.y)
  return length <= 1e-9
    ? null
    : {
        x: vector.x / length,
        y: vector.y / length
      }
}

const getSegmentSampleFrame = (start: Vec2, end: Vec2, t: number) => {
  const tangent = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y
  })
  if (!tangent) {
    return null
  }
  return {
    base: {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    },
    normal: {
      x: -tangent.y,
      y: tangent.x
    }
  }
}

const offsetPoint = (point: Vec2, unit: Vec2, distanceValue: number) => ({
  x: point.x + unit.x * distanceValue,
  y: point.y + unit.y * distanceValue
})

const getNearestSelfCheckSourceLocation = (point: Vec2) => {
  const anchors = SELF_CHECK_STAR_POINTS.map((anchor, index) => ({
    id: `tp-${12 + index}`,
    point: anchor,
    distance: Math.hypot(anchor.x - point.x, anchor.y - point.y)
  })).sort((first, second) => first.distance - second.distance)

  const segments = SELF_CHECK_STAR_SEGMENTS.map(({ start, end }, index) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t =
      lengthSquared <= 1e-9
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared
            )
          )
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    }
    return {
      id: `tp-${12 + index}->tp-${12 + ((index + 1) % SELF_CHECK_STAR_POINTS.length)}`,
      t,
      projected,
      distance: Math.hypot(point.x - projected.x, point.y - projected.y)
    }
  }).sort((first, second) => first.distance - second.distance)

  return {
    nearestAnchorId: anchors[0]?.id,
    sourceSegmentId: segments[0]?.id,
    t: segments[0]?.t,
    projectedPoint: segments[0]?.projected ?? point
  }
}

const getPolygonBoundsForTest = (polygons: Vec2[][]) => {
  const points = polygons.flat()
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  )
}

const getSampledRenderEntryOverlapFailures = (
  renderEntries: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >,
  step = 4
) => {
  const entryPolygons = renderEntries.map((entry) => ({
    entry: entry as RenderEntrySourceMaskForTest,
    polygons: getVisibleStrokePolygonsForRenderEntry(entry)
  }))
  const bounds = getPolygonBoundsForTest(
    entryPolygons.flatMap(({ polygons }) => polygons)
  )
  const failures: {
    point: Vec2
    count: number
    contributors: {
      cacheKey?: string
      productMode?: string
      productSignature?: string
      domainMode?: string
      intervalId?: string
      intervalIds?: string[]
      joinOwnershipSignature?: string
      dashEndpointCapPolicySignature?: string
      smoothContinuityGroupId?: string
    }[]
  }[] = []
  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const point = { x, y }
      const containingEntries = entryPolygons.filter(({ polygons }) =>
        polygonListContainsPoint(polygons, point)
      )
      const count = containingEntries.length
      if (count > 1) {
        failures.push({
          point,
          count,
          contributors: containingEntries.map(({ entry }) => ({
            cacheKey: entry.cacheKey,
            productMode:
              entry.runtimeMeta?.productMode ?? entry.debugMeta?.productMode,
            productSignature:
              entry.runtimeMeta?.productSignature ??
              entry.debugMeta?.productSignature,
            domainMode:
              entry.runtimeMeta?.domainMode ?? entry.debugMeta?.domainMode,
            intervalId: entry.debugMeta?.intervalId,
            intervalIds: entry.debugMeta?.intervalIds,
            joinOwnershipSignature: entry.debugMeta?.joinOwnershipSignature,
            dashEndpointCapPolicySignature:
              entry.debugMeta?.dashEndpointCapPolicySignature,
            smoothContinuityGroupId: entry.debugMeta?.smoothContinuityGroupId
          }))
        })
      }
    }
  }
  return failures
}

const getCoverageSignature = ({
  polygons,
  centers,
  radius,
  step
}: {
  polygons: Vec2[][]
  centers: Vec2[]
  radius: number
  step: number
}) =>
  centers
    .map((center) => {
      const bits: string[] = []
      for (let y = center.y - radius; y <= center.y + radius; y += step) {
        for (let x = center.x - radius; x <= center.x + radius; x += step) {
          bits.push(polygonListContainsPoint(polygons, { x, y }) ? '1' : '0')
        }
      }
      return bits.join('')
    })
    .join('|')

const countSignatureDifferences = (first: string, second: string) => {
  const length = Math.min(first.length, second.length)
  let changed = 0
  for (let index = 0; index < length; index += 1) {
    if (first[index] !== second[index]) {
      changed += 1
    }
  }
  return changed + Math.abs(first.length - second.length)
}

const assertPipelineCompleteness = ({
  key,
  packets
}: {
  key: string
  packets: ReturnType<typeof buildSolidCenterStrokeResolvedPackets>
}) => {
  expect(packets.length, key).toBeGreaterThan(0)
  packets.forEach((packet) => {
    expect(
      getFinitePolygonFailures(packet.geometry.polygons),
      `${key}:${packet.geometry.geometryId}`
    ).toEqual([])
    expect(getBoundsArea(packet.geometry.bounds), key).toBeGreaterThan(0)
  })

  const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
  const renderEntries =
    toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
  const exportPackets = buildSolidCenterStrokeExportPackets(packets)
  const hitArea = createSolidCenterStrokeHitArea(packets)

  expect(finalFaces.length, key).toBeGreaterThan(0)
  expect(renderEntries.length, key).toBeGreaterThan(0)
  expect(exportPackets.length, key).toBeGreaterThan(0)
  expect(hitArea, key).not.toBeNull()
  expect(
    finalFaces.some((face) => face.polygons.length > 0),
    key
  ).toBe(true)
}

const buildRenderStrokePathPolygons = (
  strokePaths: Vec2[][],
  style: RenderEntryStrokePathStyleForTest | undefined
) =>
  style
    ? strokePaths.flatMap((strokePath) =>
        buildSolidCenterStrokePolygons(strokePath, true, {
          style: 'solid',
          position: 'center',
          width: style.width,
          cap: style.cap === 'none' ? 'butt' : style.cap,
          join: style.join,
          miterLimit: style.miterLimit
        })
      )
    : []

const getRenderStrokePathPolygonsFromPackets = (
  packets: ReturnType<typeof buildSolidCenterStrokeResolvedPackets>
) =>
  toSolidCenterStrokeRenderEntriesFromFinalFaces(
    buildStrokeFinalFacesFromResolvedPackets(packets)
  ).flatMap((entry) => {
    const renderEntry = entry as RenderEntrySourceMaskForTest
    return [
      ...buildRenderStrokePathPolygons(
        renderEntry.strokePaths ?? [],
        renderEntry.strokePathStyle
      ),
      ...(renderEntry.strokePathGroups?.flatMap((group) =>
        buildRenderStrokePathPolygons(
          group.strokePaths ?? [],
          group.strokePathStyle
        )
      ) ?? [])
    ]
  })

const getStrokeMaskPolygonsForRenderEntry = (
  renderEntry: RenderEntrySourceMaskForTest
) => {
  const strokePathPolygons = buildRenderStrokePathPolygons(
    renderEntry.strokePaths ?? [],
    renderEntry.strokePathStyle
  )
  const strokePathGroupPolygons =
    renderEntry.strokePathGroups?.flatMap((group) => {
      const groupPolygons = buildRenderStrokePathPolygons(
        group.strokePaths ?? [],
        group.strokePathStyle ?? renderEntry.strokePathStyle
      )
      return group.clipPolygons && group.clipPolygons.length > 0
        ? getExactIntersectionPolygonsForTest(groupPolygons, group.clipPolygons)
        : groupPolygons
    }) ?? []

  if (
    renderEntry.strokeMaskPolygons !== undefined &&
    renderEntry.strokeMaskPolygons.length > 0
  ) {
    return [
      ...renderEntry.strokeMaskPolygons,
      ...strokePathPolygons,
      ...strokePathGroupPolygons
    ]
  }

  return [...strokePathPolygons, ...strokePathGroupPolygons]
}

const getVisibleStrokePolygonsFromDescriptor = (
  descriptor: RenderEntrySourceMaskForTest,
  productPolygons: Vec2[][]
) => {
  let visiblePolygons = getStrokeMaskPolygonsForRenderEntry(descriptor)
  if (visiblePolygons.length === 0) {
    visiblePolygons = productPolygons
  }
  const clipPolygons = descriptor.clipPolygons ?? productPolygons
  if (clipPolygons.length > 0 && visiblePolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForTest(
      visiblePolygons,
      clipPolygons
    )
  }
  if (descriptor.fillClipPolygons && descriptor.fillClipPolygons.length > 0) {
    visiblePolygons = getExactIntersectionPolygonsForTest(
      visiblePolygons,
      descriptor.fillClipPolygons
    )
  }
  if (
    descriptor.fillExcludePolygons &&
    descriptor.fillExcludePolygons.length > 0
  ) {
    visiblePolygons = getExactDifferencePolygonsForTest(
      visiblePolygons,
      descriptor.fillExcludePolygons
    )
  }
  return visiblePolygons
}

const getPacketProductPolygons = (
  packet: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>[number]
) => {
  const descriptor = packet.geometry.renderDescriptor as
    | RenderEntrySourceMaskForTest
    | undefined

  if (!descriptor) {
    return packet.geometry.polygons
  }

  const descriptorPolygons = getVisibleStrokePolygonsFromDescriptor(
    descriptor,
    packet.geometry.polygons
  )
  return descriptorPolygons.length > 0
    ? descriptorPolygons
    : packet.geometry.polygons
}

const getPacketDescriptorPolygons = (
  packet: ReturnType<typeof buildConstrainedDashedStrokeResolvedPackets>[number]
) => {
  const descriptor = packet.geometry.renderDescriptor as
    | RenderEntrySourceMaskForTest
    | undefined

  return descriptor
    ? getVisibleStrokePolygonsFromDescriptor(
        descriptor,
        packet.geometry.polygons
      )
    : []
}

const getFinalFaceVisibleProductPolygons = (
  face: ReturnType<typeof buildStrokeFinalFacesFromResolvedPackets>[number]
) => {
  const descriptor = face.renderDescriptor as
    | RenderEntrySourceMaskForTest
    | undefined

  return descriptor
    ? getVisibleStrokePolygonsFromDescriptor(descriptor, face.polygons)
    : face.polygons
}

const getVisibleStrokePolygonsForRenderEntry = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) => {
  const renderEntry = entry as RenderEntrySourceMaskForTest
  return getVisibleStrokePolygonsFromDescriptor(renderEntry, entry.polygons)
}

const isPointInRenderEntryVisibleStroke = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number],
  point: Vec2
) => {
  const renderEntry = entry as RenderEntrySourceMaskForTest
  const clipPolygons = renderEntry.clipPolygons ?? entry.polygons
  if (!polygonListContainsPoint(clipPolygons, point)) {
    return false
  }
  if (
    renderEntry.fillClipPolygons &&
    renderEntry.fillClipPolygons.length > 0 &&
    !polygonListContainsPoint(renderEntry.fillClipPolygons, point)
  ) {
    return false
  }
  if (
    renderEntry.fillExcludePolygons &&
    renderEntry.fillExcludePolygons.length > 0 &&
    polygonListContainsPoint(renderEntry.fillExcludePolygons, point)
  ) {
    return false
  }

  const strokeMaskPolygons = getStrokeMaskPolygonsForRenderEntry(renderEntry)
  if (strokeMaskPolygons.length > 0) {
    return polygonListContainsPoint(strokeMaskPolygons, point)
  }
  return polygonListContainsPoint(entry.polygons, point)
}

const isPointInRenderedStroke = (
  renderEntries: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >,
  point: Vec2
) =>
  renderEntries.some((entry) => isPointInRenderEntryVisibleStroke(entry, point))

const getFillRegionPolygonsForTest = (
  fillRegions: { polygons: Vec2[][] }[] | Vec2[][]
) =>
  fillRegions.flatMap((region) =>
    Array.isArray(region) ? [region] : (region.polygons ?? [])
  )

const getRenderStrokeJoinStylesFromPackets = (
  packets: ReturnType<typeof buildSolidCenterStrokeResolvedPackets>
) =>
  toSolidCenterStrokeRenderEntriesFromFinalFaces(
    buildStrokeFinalFacesFromResolvedPackets(packets)
  ).flatMap((entry) => {
    const renderEntry = entry as RenderEntrySourceMaskForTest
    return [
      ...(renderEntry.strokePaths &&
      renderEntry.strokePaths.length > 0 &&
      renderEntry.strokePathStyle
        ? [renderEntry.strokePathStyle.join]
        : []),
      ...(renderEntry.strokePathGroups?.flatMap((group) =>
        group.strokePaths &&
        group.strokePaths.length > 0 &&
        group.strokePathStyle
          ? [group.strokePathStyle.join]
          : []
      ) ?? [])
    ]
  })

const buildSolidPackets = ({
  position,
  joinType,
  points = SELF_CHECK_STAR_POINTS
}: {
  position: StrokePosition
  joinType: StrokeJoin
  points?: Vec2[]
}) => {
  const stroke = createDefaultStroke({
    style: 'solid',
    position,
    width: 10,
    joinType,
    capType: 'round',
    miterAngle: 28.96
  })
  if (position === 'center') {
    return buildSolidCenterStrokeResolvedPackets(
      `canonical:solid:${position}:${joinType}`,
      points,
      true,
      [stroke]
    )
  }
  return buildConstrainedSolidStrokeResolvedPackets(
    `canonical:solid:${position}:${joinType}`,
    points,
    true,
    [stroke],
    getSelfIntersectingOptions(points)
  )
}

const buildDashedPackets = ({
  position,
  capType,
  joinType = 'round',
  points = SELF_CHECK_STAR_POINTS,
  closed = true,
  useCurvedSelfCheckSource = false,
  sourceOptions
}: {
  position: StrokePosition
  capType: StrokeCap
  joinType?: StrokeJoin
  points?: Vec2[]
  closed?: boolean
  useCurvedSelfCheckSource?: boolean
  sourceOptions?: ReturnType<typeof getSelfIntersectingOptions>
}) => {
  const stroke = createDefaultStroke({
    style: 'dashed',
    position,
    width: 10,
    joinType,
    capType,
    dashPattern: [...SELF_CHECK_DASH_PATTERN_FOR_TEST],
    dashOffset: 0,
    miterAngle: 28.96
  })
  if (position === 'center') {
    return buildDashedCenterStrokeResolvedPackets(
      `canonical:dashed:${position}:${capType}`,
      points,
      closed,
      [stroke]
    )
  }
  return buildConstrainedDashedStrokeResolvedPackets(
    `canonical:dashed:${position}:${capType}:${joinType}`,
    points,
    closed,
    [stroke],
    closed
      ? (sourceOptions ??
          (useCurvedSelfCheckSource
            ? getCanonicalSelfCheckOptions()
            : getSelfIntersectingOptions(points)))
      : {}
  )
}

const buildDashedPacketsForSelfCheckSourceFixture = ({
  position,
  capType,
  joinType = 'round',
  sourceFixture,
  sourceOptions
}: {
  position: StrokePosition
  capType: StrokeCap
  joinType?: StrokeJoin
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
  sourceOptions?: ReturnType<typeof getSelfIntersectingOptions>
}) =>
  buildDashedPackets({
    position,
    capType,
    joinType,
    useCurvedSelfCheckSource: sourceFixture.useCurvedSourcePath,
    sourceOptions
  })

const buildCanonicalPerformancePackets = ({
  caseDef,
  frame,
  mode
}: {
  caseDef:
    | (typeof SOLID_MATRIX_CASES)[number]
    | (typeof DASHED_MATRIX_CASES)[number]
  frame: number
  mode: 'static' | 'drag'
}) => {
  const points =
    mode === 'drag' ? buildCanonicalDragPoints(frame) : SELF_CHECK_STAR_POINTS

  return 'joinType' in caseDef
    ? buildSolidPackets({
        position: caseDef.position,
        joinType: caseDef.joinType,
        points
      })
    : buildDashedPackets({
        position: caseDef.position,
        capType: caseDef.capType,
        points
      })
}

const measureCanonicalPerformanceCase = ({
  caseDef,
  mode
}: {
  caseDef:
    | (typeof SOLID_MATRIX_CASES)[number]
    | (typeof DASHED_MATRIX_CASES)[number]
  mode: 'static' | 'drag'
}) => {
  const samples: number[] = []
  const phaseTotals = new Map<string, number>()
  const phaseSink = (phaseName: string, durationMs: number) => {
    phaseTotals.set(phaseName, (phaseTotals.get(phaseName) ?? 0) + durationMs)
  }

  for (let frame = 0; frame < CANONICAL_PERFORMANCE_SAMPLE_COUNT; frame += 1) {
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = ENABLE_CANONICAL_PHASE_PROFILE
      ? phaseSink
      : undefined
    const start = performance.now()
    const packets = buildCanonicalPerformancePackets({ caseDef, frame, mode })
    samples.push(performance.now() - start)
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = undefined
    assertPipelineCompleteness({
      key: `${caseDef.key}:${mode}:performance`,
      packets
    })
  }

  return {
    key: caseDef.key,
    p95Ms: getPercentile(samples, 0.95),
    maxMs: Math.max(...samples),
    averageMs:
      samples.reduce((total, sample) => total + sample, 0) / samples.length,
    phases: Object.fromEntries(
      [...phaseTotals.entries()]
        .map(([phaseName, totalMs]) => [
          phaseName,
          totalMs / Math.max(1, CANONICAL_PERFORMANCE_SAMPLE_COUNT)
        ])
        .sort(([, left], [, right]) => right - left)
    )
  }
}

const getCanonicalPerformanceBudgetMs = ({
  caseDef,
  mode
}: {
  caseDef:
    | (typeof SOLID_MATRIX_CASES)[number]
    | (typeof DASHED_MATRIX_CASES)[number]
  mode: 'static' | 'drag'
}) =>
  'joinType' in caseDef
    ? mode === 'static'
      ? CANONICAL_SOLID_STATIC_P95_BUDGET_MS
      : CANONICAL_SOLID_DRAG_P95_BUDGET_MS
    : mode === 'static'
      ? CANONICAL_STATIC_P95_BUDGET_MS
      : CANONICAL_DRAG_P95_BUDGET_MS

const getSelfCheckLegalRegionsForSourceFixture = (
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
) =>
  (sourceFixture.useCurvedSourcePath
    ? getCanonicalSelfCheckOptions()
    : getSelfIntersectingOptions(SELF_CHECK_STAR_POINTS)
  ).implicitFillRegions

const getSelfCheckSourcePointsForFixture = (
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
) =>
  sourceFixture.useCurvedSourcePath
    ? buildSelfCheckVectorSourcePath().sampledPoints
    : SELF_CHECK_STAR_POINTS

const buildSolidCenterPacketsForSelfCheckSourceFixture = ({
  joinType,
  sourceFixture
}: {
  joinType: StrokeJoin
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
}) => {
  const stroke = createDefaultStroke({
    style: 'solid',
    position: 'center',
    width: 10,
    joinType,
    capType: 'round',
    miterAngle: 28.96
  })
  return buildSolidCenterStrokeResolvedPackets(
    `canonical:solid:center:${joinType}:${sourceFixture.key}`,
    getSelfCheckSourcePointsForFixture(sourceFixture),
    true,
    [stroke]
  )
}

const buildSolidPacketsForPoints = ({
  points,
  position,
  joinType
}: {
  points: Vec2[]
  position: StrokePosition
  joinType: StrokeJoin
}) => {
  const stroke = createDefaultStroke({
    style: 'solid',
    position,
    width: 12,
    joinType,
    capType: 'round',
    miterAngle: 28.96
  })
  return position === 'center'
    ? buildSolidCenterStrokeResolvedPackets(
        `canonical:solid-envelope:${position}:${joinType}`,
        points,
        true,
        [stroke]
      )
    : buildConstrainedSolidStrokeResolvedPackets(
        `canonical:solid-envelope:${position}:${joinType}`,
        points,
        true,
        [stroke]
      )
}

const buildDashedPacketsForPoints = ({
  points,
  closed,
  position,
  capType,
  dashPattern = [40, 40]
}: {
  points: Vec2[]
  closed: boolean
  position: StrokePosition
  capType: StrokeCap
  dashPattern?: number[]
}) => {
  const stroke = createDefaultStroke({
    style: 'dashed',
    position,
    width: 12,
    joinType: 'round',
    capType,
    dashPattern,
    dashOffset: 0,
    miterAngle: 28.96
  })
  return position === 'center'
    ? buildDashedCenterStrokeResolvedPackets(
        `canonical:dashed-envelope:${position}:${capType}`,
        points,
        closed,
        [stroke]
      )
    : buildConstrainedDashedStrokeResolvedPackets(
        `canonical:dashed-envelope:${position}:${capType}`,
        points,
        closed,
        [stroke],
        closed ? getSelfIntersectingOptions(points) : {}
      )
}

const assertRightAngleSolidEnvelope = ({
  key,
  polygons,
  position
}: {
  key: string
  polygons: Vec2[][]
  position: StrokePosition
}) => {
  const width = 12
  const samples = RIGHT_ANGLE_POINTS.map((point, index) => ({
    start: point,
    end: RIGHT_ANGLE_POINTS[(index + 1) % RIGHT_ANGLE_POINTS.length]
  })).flatMap(({ start, end }) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    const inward = { x: -dy / length, y: dx / length }
    const outward = { x: -inward.x, y: -inward.y }
    return [0.35, 0.65].map((t) => {
      const base = {
        x: start.x + dx * t,
        y: start.y + dy * t
      }
      return { base, inward, outward, t }
    })
  })

  samples.forEach(({ base, inward, outward, t }) => {
    const insidePoint = {
      x: base.x + inward.x * (width * 0.45),
      y: base.y + inward.y * (width * 0.45)
    }
    const outsidePoint = {
      x: base.x + outward.x * (width * 0.45),
      y: base.y + outward.y * (width * 0.45)
    }
    const insideCovered = polygonListContainsPoint(polygons, insidePoint)
    const outsideCovered = polygonListContainsPoint(polygons, outsidePoint)
    if (position === 'inside') {
      expect({ insideCovered, outsideCovered }, `${key}:${t}`).toEqual({
        insideCovered: true,
        outsideCovered: false
      })
      return
    }
    if (position === 'outside') {
      expect({ insideCovered, outsideCovered }, `${key}:${t}`).toEqual({
        insideCovered: false,
        outsideCovered: true
      })
      return
    }
    expect({ insideCovered, outsideCovered }, `${key}:${t}`).toEqual({
      insideCovered: true,
      outsideCovered: true
    })
  })
}

const assertSelfCheckSolidRenderedSegmentAdherence = ({
  key,
  packets,
  position
}: {
  key: string
  packets: ReturnType<typeof buildSolidPackets>
  position: StrokePosition
}) => {
  const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
    buildStrokeFinalFacesFromResolvedPackets(packets)
  )
  const fillPolygons = getFillRegionPolygonsForTest(
    getSelfIntersectingOptions(SELF_CHECK_STAR_POINTS).implicitFillRegions
  )
  const failures: {
    segmentIndex: number
    t: number
    side: 'fill' | 'exterior'
    offset: number
    point: Vec2
  }[] = []
  let checkedSamples = 0

  SELF_CHECK_STAR_SEGMENTS.forEach(({ start, end, segmentIndex }) => {
    ;[0.22, 0.38, 0.54, 0.7].forEach((t) => {
      const frame = getSegmentSampleFrame(start, end, t)
      if (!frame) {
        return
      }
      const plusFill = polygonListContainsPoint(
        fillPolygons,
        offsetPoint(frame.base, frame.normal, 3)
      )
      const minusFill = polygonListContainsPoint(
        fillPolygons,
        offsetPoint(frame.base, frame.normal, -3)
      )
      if (plusFill === minusFill) {
        return
      }

      const fillUnit = plusFill
        ? frame.normal
        : { x: -frame.normal.x, y: -frame.normal.y }
      const exteriorUnit = plusFill
        ? { x: -frame.normal.x, y: -frame.normal.y }
        : frame.normal
      const requiredSides =
        position === 'inside'
          ? [{ side: 'fill' as const, unit: fillUnit }]
          : position === 'outside'
            ? [{ side: 'exterior' as const, unit: exteriorUnit }]
            : [
                { side: 'fill' as const, unit: fillUnit },
                { side: 'exterior' as const, unit: exteriorUnit }
              ]

      requiredSides.forEach(({ side, unit }) => {
        ;[1.25, 3, 5].forEach((offset) => {
          checkedSamples += 1
          const point = offsetPoint(frame.base, unit, offset)
          if (!isPointInRenderedStroke(renderEntries, point)) {
            failures.push({
              segmentIndex,
              t,
              side,
              offset,
              point
            })
          }
        })
      })
    })
  })

  expect(
    checkedSamples,
    `${key}:rendered-segment-adherence:sample-count`
  ).toBeGreaterThanOrEqual(position === 'center' ? 48 : 24)
  expect(
    failures.slice(0, 16),
    JSON.stringify(
      {
        key,
        checkedSamples,
        failureCount: failures.length
      },
      null,
      2
    )
  ).toEqual([])
}

const getTotalAbsArea = (polygons: Vec2[][]) =>
  polygons.reduce((sum, polygon) => sum + Math.abs(polygonArea(polygon)), 0)

const toPolygonRegionsForTest = (polygons: Vec2[][]) =>
  polygons.map((polygon) => ({ polygons: [polygon] }))

const flattenRegionPolygonsForTest = (regions: { polygons: Vec2[][] }[]) =>
  regions.flatMap((region) => region.polygons)

const getLargestAreaPolygonForTest = (polygons: Vec2[][]) =>
  [...polygons].sort(
    (first, second) =>
      Math.abs(polygonArea(second)) - Math.abs(polygonArea(first))
  )[0]

const getPolygonAveragePointForTest = (polygon: Vec2[] | undefined): Vec2 =>
  polygon && polygon.length > 0
    ? polygon.reduce(
        (sum, point) => ({
          x: sum.x + point.x / polygon.length,
          y: sum.y + point.y / polygon.length
        }),
        { x: 0, y: 0 }
      )
    : { x: 0, y: 0 }

const getExactUnionAreaForTest = (polygons: Vec2[][]) => {
  if (!exactBackend || polygons.length === 0) {
    return 0
  }
  return getTotalAbsArea(
    flattenRegionPolygonsForTest(
      exactBackend.union(toPolygonRegionsForTest(polygons), 'nonzero')
    )
  )
}

const getExactOverlapAreaForTest = (polygons: Vec2[][]) =>
  Math.max(0, getTotalAbsArea(polygons) - getExactUnionAreaForTest(polygons))

const getExactUnionPolygonsForTest = (polygons: Vec2[][]) => {
  if (!exactBackend || polygons.length === 0) {
    return polygons
  }
  return flattenRegionPolygonsForTest(
    exactBackend.union(toPolygonRegionsForTest(polygons), 'nonzero')
  )
}

const getEffectiveRenderEntryCoveragePolygonsForExactOverlapTest = (
  entry: RenderEntrySourceMaskForTest & { polygons: Vec2[][] }
) => {
  const coveragePolygons = getVisibleStrokePolygonsFromDescriptor(
    entry,
    entry.polygons
  )

  return getExactUnionPolygonsForTest(coveragePolygons)
}

const getExactDifferencePolygonsForTest = (
  subjectPolygons: Vec2[][],
  clipPolygons: Vec2[][]
) => {
  if (!exactBackend || subjectPolygons.length === 0) {
    return []
  }
  if (clipPolygons.length === 0) {
    return subjectPolygons
  }
  return flattenRegionPolygonsForTest(
    exactBackend.difference(
      toPolygonRegionsForTest(subjectPolygons),
      toPolygonRegionsForTest(clipPolygons),
      'nonzero'
    )
  )
}

const getExactIntersectionPolygonsForTest = (
  firstPolygons: Vec2[][],
  secondPolygons: Vec2[][]
) => {
  if (
    !exactBackend ||
    firstPolygons.length === 0 ||
    secondPolygons.length === 0
  ) {
    return []
  }
  return flattenRegionPolygonsForTest(
    exactBackend.intersection(
      toPolygonRegionsForTest(firstPolygons),
      toPolygonRegionsForTest(secondPolygons),
      'nonzero'
    )
  )
}

const getExactIntersectionAreaForTest = (
  firstPolygons: Vec2[][],
  secondPolygons: Vec2[][]
) => {
  if (
    !exactBackend ||
    firstPolygons.length === 0 ||
    secondPolygons.length === 0
  ) {
    return 0
  }
  return getTotalAbsArea(
    flattenRegionPolygonsForTest(
      exactBackend.intersection(
        toPolygonRegionsForTest(firstPolygons),
        toPolygonRegionsForTest(secondPolygons),
        'nonzero'
      )
    )
  )
}

const summarizePolygonWindingForTest = (polygons: Vec2[][]) => ({
  polygonCount: polygons.length,
  positiveCount: polygons.filter((polygon) => polygonArea(polygon) > 1e-9)
    .length,
  negativeCount: polygons.filter((polygon) => polygonArea(polygon) < -1e-9)
    .length,
  zeroCount: polygons.filter(
    (polygon) => Math.abs(polygonArea(polygon)) <= 1e-9
  ).length
})

const summarizeStrokeDebugMetaForTest = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined
) =>
  debugMeta
    ? {
        intervalId: debugMeta.intervalId,
        strokePosition: debugMeta.strokePosition,
        strokeCap: debugMeta.strokeCap,
        strokeJoin: debugMeta.strokeJoin,
        materializedStartDistance: debugMeta.materializedStartDistance,
        materializedEndDistance: debugMeta.materializedEndDistance,
        materializedWrapsSeam: debugMeta.materializedWrapsSeam,
        rawProductArea: debugMeta.rawProductArea,
        cleanedProductArea: debugMeta.cleanedProductArea,
        boundaryClippedProductArea: debugMeta.boundaryClippedProductArea,
        finalProductArea: debugMeta.finalProductArea,
        startDistance: debugMeta.startDistance,
        endDistance: debugMeta.endDistance,
        domainPlanSplitRangeId: debugMeta.domainPlanSplitRangeId,
        domainPlanTerminalRole: debugMeta.domainPlanTerminalRole,
        domainPlanSelectedSide: debugMeta.domainPlanSelectedSide,
        domainPlanFilledSide: debugMeta.domainPlanFilledSide,
        domainPlanUnfilledSide: debugMeta.domainPlanUnfilledSide,
        domainPlanBoundaryRole: debugMeta.domainPlanBoundaryRole,
        dashEndpointCapPolicySignature:
          debugMeta.dashEndpointCapPolicySignature,
        dashEndpointCapPolicyTerminalRole:
          debugMeta.dashEndpointCapPolicyTerminalRole,
        joinOwnershipSignature: debugMeta.joinOwnershipSignature,
        smoothContinuityGroupId: debugMeta.smoothContinuityGroupId,
        materializedEndpointCaps:
          debugMeta.materializedEndpointCaps === undefined
            ? undefined
            : {
                count: debugMeta.materializedEndpointCaps.length,
                first: debugMeta.materializedEndpointCaps[0]
                  ? {
                      policySignature:
                        debugMeta.materializedEndpointCaps[0].policySignature,
                      startCap: debugMeta.materializedEndpointCaps[0].startCap,
                      endCap: debugMeta.materializedEndpointCaps[0].endCap,
                      suppressStartCap:
                        debugMeta.materializedEndpointCaps[0].suppressStartCap,
                      suppressEndCap:
                        debugMeta.materializedEndpointCaps[0].suppressEndCap
                    }
                  : undefined,
                last: debugMeta.materializedEndpointCaps[
                  debugMeta.materializedEndpointCaps.length - 1
                ]
                  ? {
                      policySignature:
                        debugMeta.materializedEndpointCaps[
                          debugMeta.materializedEndpointCaps.length - 1
                        ].policySignature,
                      startCap:
                        debugMeta.materializedEndpointCaps[
                          debugMeta.materializedEndpointCaps.length - 1
                        ].startCap,
                      endCap:
                        debugMeta.materializedEndpointCaps[
                          debugMeta.materializedEndpointCaps.length - 1
                        ].endCap,
                      suppressStartCap:
                        debugMeta.materializedEndpointCaps[
                          debugMeta.materializedEndpointCaps.length - 1
                        ].suppressStartCap,
                      suppressEndCap:
                        debugMeta.materializedEndpointCaps[
                          debugMeta.materializedEndpointCaps.length - 1
                        ].suppressEndCap
                    }
                  : undefined
              },
        domainPlanSplitRangeTerminals:
          debugMeta.domainPlanSplitRangeTerminals?.map((terminal) => ({
            terminalRole: terminal.terminalRole,
            distance: terminal.distance,
            sourceDistance: terminal.sourceDistance,
            selectedSide: terminal.selectedSide,
            filledSide: terminal.filledSide,
            unfilledSide: terminal.unfilledSide,
            boundaryRole: terminal.boundaryRole
          }))
      }
    : undefined

const getPacketIntersectionContributorsForTest = (
  packets: {
    geometry: {
      geometryId: string
      polygons: Vec2[][]
      debugMeta?: SolidCenterStrokeGeometryDebugMeta
    }
  }[],
  clipPolygons: Vec2[][]
) =>
  packets
    .map((packet) => {
      const geometryPolygons = packet.geometry.polygons
      const descriptorPolygons = getPacketDescriptorPolygons(
        packet as ReturnType<
          typeof buildConstrainedDashedStrokeResolvedPackets
        >[number]
      )
      const productPolygons = getPacketProductPolygons(
        packet as ReturnType<
          typeof buildConstrainedDashedStrokeResolvedPackets
        >[number]
      )
      const geometryArea = getExactIntersectionAreaForTest(
        geometryPolygons,
        clipPolygons
      )
      const descriptorArea =
        descriptorPolygons.length > 0
          ? getExactIntersectionAreaForTest(descriptorPolygons, clipPolygons)
          : 0
      return {
        geometryId: packet.geometry.geometryId,
        area: getExactIntersectionAreaForTest(productPolygons, clipPolygons),
        geometryArea,
        descriptorArea,
        winding: summarizePolygonWindingForTest(productPolygons),
        debugMeta: summarizeStrokeDebugMetaForTest(packet.geometry.debugMeta)
      }
    })
    .filter((contributor) => contributor.area > 1e-6)
    .sort((left, right) => right.area - left.area)
    .slice(0, 5)

const getOutsideLegalResidueForTest = (
  polygons: Vec2[][],
  legalRegions: { polygons: Vec2[][] }[]
) => {
  if (!exactBackend || polygons.length === 0 || legalRegions.length === 0) {
    return []
  }
  return flattenRegionPolygonsForTest(
    exactBackend.difference(
      toPolygonRegionsForTest(polygons),
      legalRegions,
      'nonzero'
    )
  )
}

const getInsideLegalResidueForOutsideStrokeTest = (
  polygons: Vec2[][],
  legalRegions: { polygons: Vec2[][] }[]
) => {
  if (!exactBackend || polygons.length === 0 || legalRegions.length === 0) {
    return []
  }
  return flattenRegionPolygonsForTest(
    exactBackend.intersection(
      toPolygonRegionsForTest(polygons),
      legalRegions,
      'nonzero'
    )
  )
}

const buildPointProbePolygonForTest = (point: Vec2, radius = 0.05) => [
  { x: point.x - radius, y: point.y - radius },
  { x: point.x + radius, y: point.y - radius },
  { x: point.x + radius, y: point.y + radius },
  { x: point.x - radius, y: point.y + radius }
]

const isPointInsideExactLegalRegionForTest = (
  point: Vec2,
  legalRegions: { polygons: Vec2[][] }[]
) => {
  if (!exactBackend || legalRegions.length === 0) {
    return polygonListContainsPoint(
      getFillRegionPolygonsForTest(legalRegions),
      point
    )
  }
  const probe = buildPointProbePolygonForTest(point)
  const intersectionArea = getTotalAbsArea(
    flattenRegionPolygonsForTest(
      exactBackend.intersection(
        toPolygonRegionsForTest([probe]),
        legalRegions,
        'nonzero'
      )
    )
  )
  return intersectionArea > Math.abs(polygonArea(probe)) * 0.5
}

const getGeometryAreaToleranceForTest = (totalArea: number) =>
  Math.max(0.5, totalArea * 0.0005)

const subtractPointsForTest = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const addPointsForTest = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x + right.x,
  y: left.y + right.y
})

const scalePointForTest = (point: Vec2, scale: number): Vec2 => ({
  x: point.x * scale,
  y: point.y * scale
})

const dotPointsForTest = (left: Vec2, right: Vec2) =>
  left.x * right.x + left.y * right.y

const distanceBetweenPointsForTest = (left: Vec2, right: Vec2) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const lineIntersectionForTest = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
): Vec2 | null => {
  const firstDelta = subtractPointsForTest(firstEnd, firstStart)
  const secondDelta = subtractPointsForTest(secondEnd, secondStart)
  const denominator =
    firstDelta.x * secondDelta.y - firstDelta.y * secondDelta.x
  if (Math.abs(denominator) <= 1e-9) {
    return null
  }
  const startDelta = subtractPointsForTest(secondStart, firstStart)
  const amount =
    (startDelta.x * secondDelta.y - startDelta.y * secondDelta.x) / denominator
  return addPointsForTest(firstStart, scalePointForTest(firstDelta, amount))
}

const crossPointsForTest = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const buildJoinArcPointsForTest = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) => {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle

  if (sweepSign >= 0) {
    while (sweep < 0) {
      sweep += Math.PI * 2
    }
  } else {
    while (sweep > 0) {
      sweep -= Math.PI * 2
    }
  }

  const radius = distanceBetweenPointsForTest(center, start)
  const maxChordError = Math.max(0.05, Math.min(0.35, radius * 0.025))
  const maxAngleFromChordError =
    radius <= 1e-9
      ? Math.PI / 24
      : 2 *
        Math.acos(
          Math.max(-1, Math.min(1, 1 - maxChordError / Math.max(radius, 1)))
        )
  const maxAngleStep = Math.min(Math.PI / 24, maxAngleFromChordError)
  const segmentCount = Math.max(4, Math.ceil(Math.abs(sweep) / maxAngleStep))
  return Array.from({ length: segmentCount + 1 }, (_unused, index) => {
    const angle = startAngle + (sweep * index) / segmentCount
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })
}

const getSegmentEndDirectionForTest = (
  segment: ReturnType<typeof buildSelfCheckVectorSourcePath>['segments'][number]
) => {
  const candidates =
    segment.type === 'cubic'
      ? [segment.control2, segment.control1, segment.start]
      : [segment.start]
  for (const candidate of candidates) {
    const direction = normalizeVector(
      subtractPointsForTest(segment.end, candidate)
    )
    if (direction) {
      return direction
    }
  }
  return null
}

const getSegmentStartDirectionForTest = (
  segment: ReturnType<typeof buildSelfCheckVectorSourcePath>['segments'][number]
) => {
  const candidates =
    segment.type === 'cubic'
      ? [segment.control1, segment.control2, segment.end]
      : [segment.end]
  for (const candidate of candidates) {
    const direction = normalizeVector(
      subtractPointsForTest(candidate, segment.start)
    )
    if (direction) {
      return direction
    }
  }
  return null
}

const getSampledSegmentEndDirectionForTest = (
  path: ReturnType<typeof buildSelfCheckVectorSourcePath>,
  segmentIndex: number
) => {
  const sampledPoints = path.sampledSegmentPoints[segmentIndex] ?? []
  const end = sampledPoints[sampledPoints.length - 1]
  if (!end) {
    return null
  }
  for (let index = sampledPoints.length - 2; index >= 0; index -= 1) {
    const direction = normalizeVector(
      subtractPointsForTest(end, sampledPoints[index])
    )
    if (direction) {
      return direction
    }
  }
  return null
}

const getSampledSegmentStartDirectionForTest = (
  path: ReturnType<typeof buildSelfCheckVectorSourcePath>,
  segmentIndex: number
) => {
  const sampledPoints = path.sampledSegmentPoints[segmentIndex] ?? []
  const start = sampledPoints[0]
  if (!start) {
    return null
  }
  for (let index = 1; index < sampledPoints.length; index += 1) {
    const direction = normalizeVector(
      subtractPointsForTest(sampledPoints[index], start)
    )
    if (direction) {
      return direction
    }
  }
  return null
}

const offsetLinePointForTest = (
  point: Vec2,
  direction: Vec2,
  offset: number
) => ({
  x: point.x - direction.y * offset,
  y: point.y + direction.x * offset
})

const buildJoinCandidateForTest = ({
  nextSegmentIndex,
  offset,
  path,
  previousSegmentIndex,
  strokeWidth
}: {
  nextSegmentIndex: number
  offset: number
  path: ReturnType<typeof buildSelfCheckVectorSourcePath>
  previousSegmentIndex: number
  strokeWidth: number
}) => {
  const previousSegment = path.segments[previousSegmentIndex]
  const nextSegment = path.segments[nextSegmentIndex]
  if (!previousSegment || !nextSegment) {
    return null
  }
  const vertex = previousSegment.end
  if (distanceBetweenPointsForTest(vertex, nextSegment.start) > 0.5) {
    return null
  }
  const previousDirection =
    getSampledSegmentEndDirectionForTest(path, previousSegmentIndex) ??
    getSegmentEndDirectionForTest(previousSegment)
  const nextDirection =
    getSampledSegmentStartDirectionForTest(path, nextSegmentIndex) ??
    getSegmentStartDirectionForTest(nextSegment)
  if (!previousDirection || !nextDirection) {
    return null
  }
  const previousOffsetEnd = offsetLinePointForTest(
    vertex,
    previousDirection,
    offset
  )
  const nextOffsetStart = offsetLinePointForTest(vertex, nextDirection, offset)
  const previousOffsetStart = offsetLinePointForTest(
    addPointsForTest(
      vertex,
      scalePointForTest(previousDirection, -strokeWidth)
    ),
    previousDirection,
    offset
  )
  const nextOffsetEnd = offsetLinePointForTest(
    addPointsForTest(vertex, scalePointForTest(nextDirection, strokeWidth)),
    nextDirection,
    offset
  )
  const bevelMidpoint = scalePointForTest(
    addPointsForTest(previousOffsetEnd, nextOffsetStart),
    0.5
  )
  const miterPoint =
    lineIntersectionForTest(
      previousOffsetStart,
      previousOffsetEnd,
      nextOffsetStart,
      nextOffsetEnd
    ) ?? bevelMidpoint
  const miterDirection = normalizeVector(
    subtractPointsForTest(miterPoint, vertex)
  )
  const roundSweepSign =
    crossPointsForTest(previousDirection, nextDirection) * offset >= 0 ? -1 : 1
  const angleDot = Math.max(
    -1,
    Math.min(1, dotPointsForTest(previousDirection, nextDirection))
  )
  return {
    vertex,
    previousOffsetEnd,
    nextOffsetStart,
    previousDirection,
    nextDirection,
    offset,
    miterPoint,
    miterPolygon: [vertex, previousOffsetEnd, miterPoint, nextOffsetStart],
    bevelPolygon: [vertex, previousOffsetEnd, nextOffsetStart],
    roundPolygon: [
      vertex,
      ...buildJoinArcPointsForTest(
        vertex,
        previousOffsetEnd,
        nextOffsetStart,
        roundSweepSign
      )
    ],
    miterProbe: addPointsForTest(
      vertex,
      scalePointForTest(
        subtractPointsForTest(miterPoint, vertex),
        distanceBetweenPointsForTest(vertex, miterPoint) <= strokeWidth * 1.2
          ? 0.7
          : 0.9
      )
    ),
    bevelMidpoint,
    miterDirection,
    turnAngle: Math.acos(angleDot)
  }
}

const getSelfCheckSourcePathForFixture = (
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
) =>
  sourceFixture.useCurvedSourcePath
    ? buildSelfCheckVectorSourcePath()
    : buildPolylineGeometryModelPath(SELF_CHECK_STAR_POINTS, true)

const isDistanceInsideSelfCheckVisibleDashForTest = (
  distance: number,
  totalLength: number
) => {
  const [dashLength, gapLength] = SELF_CHECK_DASH_PATTERN_FOR_TEST
  const cycleLength = dashLength + gapLength
  if (cycleLength <= 0 || totalLength <= 0) {
    return false
  }
  const normalizedDistance =
    ((distance % totalLength) + totalLength) % totalLength
  const phase = normalizedDistance % cycleLength
  return phase <= dashLength + 1e-6
}

const doesSelfCheckVisibleDashCrossVertexForTest = (
  distance: number,
  totalLength: number
) => {
  const probeDistance = 0.5
  return (
    isDistanceInsideSelfCheckVisibleDashForTest(
      distance - probeDistance,
      totalLength
    ) &&
    isDistanceInsideSelfCheckVisibleDashForTest(
      distance + probeDistance,
      totalLength
    )
  )
}

const getOutsideSourceVertexExpectations = (
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
) => {
  const path = getSelfCheckSourcePathForFixture(sourceFixture)
  const legalRegions = getSelfCheckLegalRegionsForSourceFixture(sourceFixture)
  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    const nextSegment = path.segments[nextSegmentIndex]
    if (!nextSegment) {
      return []
    }
    const incoming = getSegmentEndDirectionForTest(segment)
    const outgoing = getSegmentStartDirectionForTest(nextSegment)
    if (!incoming || !outgoing) {
      return []
    }
    const candidates = [10, -10]
      .map((offset) =>
        buildJoinCandidateForTest({
          nextSegmentIndex,
          offset,
          path,
          previousSegmentIndex,
          strokeWidth: 10
        })
      )
      .filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== null
      )
    const candidateOutsideScore = (candidate: (typeof candidates)[number]) =>
      [
        candidate.previousOffsetEnd,
        candidate.nextOffsetStart,
        candidate.bevelMidpoint,
        candidate.miterProbe
      ].filter(
        (point) => !isPointInsideExactLegalRegionForTest(point, legalRegions)
      ).length
    const outsideCandidate = [...candidates].sort(
      (first, second) =>
        candidateOutsideScore(second) - candidateOutsideScore(first)
    )[0]
    const insideCandidate = candidates.find(
      (candidate) => candidate !== outsideCandidate
    )
    const vertexId = `tp-${12 + nextSegmentIndex}`
    const sourceVertexDistance =
      path.segmentDistanceRanges[nextSegmentIndex]?.startDistance ?? 0
    if (
      !SELF_CHECK_SOURCE_VERTEX_IDS.has(vertexId) ||
      !outsideCandidate ||
      !insideCandidate ||
      !outsideCandidate.miterDirection
    ) {
      return []
    }
    return [
      {
        sourceFixture,
        path,
        previousSegmentIndex,
        nextSegmentIndex,
        sourceVertexDistance,
        hasVisibleDashCoverage: doesSelfCheckVisibleDashCrossVertexForTest(
          sourceVertexDistance,
          path.totalLength
        ),
        vertexIndex: nextSegmentIndex,
        vertexId,
        outside: outsideCandidate,
        inside: insideCandidate
      }
    ]
  })
}

describe('canonical stroke 18-combination matrix', () => {
  it('should run: define exactly 9 solid and 9 dashed canonical matrix cases', () => {
    expect(SOLID_MATRIX_CASES).toHaveLength(9)
    expect(new Set(SOLID_MATRIX_CASES.map((caseDef) => caseDef.key)).size).toBe(
      9
    )
    expect(DASHED_MATRIX_CASES).toHaveLength(9)
    expect(
      new Set(DASHED_MATRIX_CASES.map((caseDef) => caseDef.key)).size
    ).toBe(9)
  })

  it('should run: every canonical matrix case has explicit hard geometry oracles', () => {
    const oraclesByCaseKey = new Map<string, Set<CanonicalGeometryOracleKind>>()
    CANONICAL_GEOMETRY_ORACLE_REGISTRY.forEach(({ key, oracle }) => {
      oraclesByCaseKey.set(key, new Set(oraclesByCaseKey.get(key) ?? []))
      oraclesByCaseKey.get(key)?.add(oracle)
    })

    const missingCases = [...SOLID_MATRIX_CASES, ...DASHED_MATRIX_CASES]
      .map(({ key }) => ({
        key,
        oracles: Array.from(oraclesByCaseKey.get(key) ?? [])
      }))
      .filter(({ oracles }) => oracles.length === 0)
    const underSpecifiedCases = [...SOLID_MATRIX_CASES, ...DASHED_MATRIX_CASES]
      .map(({ key }) => ({
        key,
        oracles: Array.from(oraclesByCaseKey.get(key) ?? [])
      }))
      .filter(
        ({ oracles }) =>
          !oracles.includes('pipeline-completeness') ||
          !oracles.includes('sampled-final-overlap') ||
          oracles.filter((oracle) => oracle !== 'pipeline-completeness')
            .length < 2
      )

    expect(missingCases).toEqual([])
    expect(
      underSpecifiedCases,
      JSON.stringify(
        {
          required:
            'Each matrix case needs pipeline completeness, sampled final overlap, and at least two non-pipeline geometry oracles.',
          matrixCaseCount:
            SOLID_MATRIX_CASES.length + DASHED_MATRIX_CASES.length
        },
        null,
        2
      )
    ).toEqual([])
  })

  it.each(SOLID_MATRIX_CASES)(
    'should run: solid canonical matrix case $position $joinType emits full packets',
    ({ key, position, joinType }) => {
      const packets = buildSolidPackets({ position, joinType })
      assertPipelineCompleteness({ key, packets })
      expect(
        packets.every(
          (packet) => packet.geometry.debugMeta?.strokePosition === position
        ),
        key
      ).toBe(true)
      if (position !== 'center') {
        expect(
          packets.every(
            (packet) =>
              packet.geometry.debugMeta?.productMode ===
                'closed-constrained-domain' &&
              packet.geometry.debugMeta?.productSignature?.startsWith(
                'constrained-solid:'
              ) === true
          ),
          key
        ).toBe(true)
      }
    }
  )

  it.each(DASHED_MATRIX_CASES)(
    'should run: dashed canonical matrix case $position $capType emits full packets',
    ({ key, position, capType }) => {
      const packets = buildDashedPackets({ position, capType })
      assertPipelineCompleteness({ key, packets })
      expect(
        packets.every(
          (packet) => packet.geometry.debugMeta?.strokePosition === position
        ),
        key
      ).toBe(true)
      if (position !== 'center') {
        expect(
          packets.every(
            (packet) =>
              packet.geometry.debugMeta?.productMode ===
                'closed-constrained-domain' &&
              packet.geometry.debugMeta?.productSignature?.startsWith(
                'constrained-dashed:'
              ) === true
          ),
          key
        ).toBe(true)
      }
    }
  )

  it('should run: static canonical matrix performance covers all 18 stroke combinations', () => {
    const metrics = [...SOLID_MATRIX_CASES, ...DASHED_MATRIX_CASES].map(
      (caseDef) => ({
        ...measureCanonicalPerformanceCase({
          caseDef,
          mode: 'static'
        }),
        budgetMs: getCanonicalPerformanceBudgetMs({
          caseDef,
          mode: 'static'
        })
      })
    )
    const failures = metrics.filter((metric) => metric.p95Ms > metric.budgetMs)

    expect(metrics).toHaveLength(18)
    expect(
      failures,
      JSON.stringify(
        {
          defaultBudgetMs: CANONICAL_STATIC_P95_BUDGET_MS,
          solidBudgetMs: CANONICAL_SOLID_STATIC_P95_BUDGET_MS,
          failures,
          metrics
        },
        null,
        2
      )
    ).toEqual([])
  })

  it('should run: drag canonical matrix performance covers all 18 stroke combinations', () => {
    const metrics = [...SOLID_MATRIX_CASES, ...DASHED_MATRIX_CASES].map(
      (caseDef) => ({
        ...measureCanonicalPerformanceCase({
          caseDef,
          mode: 'drag'
        }),
        budgetMs: getCanonicalPerformanceBudgetMs({
          caseDef,
          mode: 'drag'
        })
      })
    )
    const failures = metrics.filter((metric) => metric.p95Ms > metric.budgetMs)

    expect(metrics).toHaveLength(18)
    expect(
      failures,
      JSON.stringify(
        {
          defaultBudgetMs: CANONICAL_DRAG_P95_BUDGET_MS,
          solidBudgetMs: CANONICAL_SOLID_DRAG_P95_BUDGET_MS,
          failures,
          metrics
        },
        null,
        2
      )
    ).toEqual([])
  })

  it.each(DASHED_OUTSIDE_TERMINAL_POLICY_CASES)(
    'should run: dashed outside $joinType terminal policy stays in the outside legal domain on $sourceFixture.key',
    ({ key, position, capType, joinType, sourceFixture }) => {
      const packets = buildDashedPacketsForSelfCheckSourceFixture({
        position,
        capType,
        joinType,
        sourceFixture
      })
      assertPipelineCompleteness({ key, packets })
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
      const renderPolygons = renderEntries.flatMap((entry) =>
        getVisibleStrokePolygonsForRenderEntry(entry)
      )
      const packetPolygons = packets.flatMap(getPacketProductPolygons)
      const finalFacePolygons = finalFaces.flatMap(
        getFinalFaceVisibleProductPolygons
      )
      const expectations = getOutsideSourceVertexExpectations(sourceFixture)
      expect(
        expectations.length,
        `${key}:${sourceFixture.key}:terminal-policy-source-vertex-count`
      ).toBe(SELF_CHECK_SOURCE_VERTEX_ID_LIST.length)

      expectations.forEach((expectation) => {
        const legalRegions =
          getSelfCheckLegalRegionsForSourceFixture(sourceFixture)
        const insideLegalResidueByStage = [
          {
            stage: 'packet',
            polygons: packetPolygons
          },
          {
            stage: 'final-face',
            polygons: finalFacePolygons
          },
          {
            stage: 'render-entry',
            polygons: renderPolygons
          }
        ].map(({ stage, polygons }) => {
          const insideResidue = getInsideLegalResidueForOutsideStrokeTest(
            polygons,
            legalRegions
          )
          const totalArea = getTotalAbsArea(polygons)
          const insideResidueArea = getTotalAbsArea(insideResidue)
          return {
            stage,
            insideResidue,
            insideResidueArea,
            maxAllowedArea: getGeometryAreaToleranceForTest(totalArea),
            totalArea
          }
        })
        const insideLeakFailure = insideLegalResidueByStage.find(
          ({ insideResidueArea, maxAllowedArea }) =>
            insideResidueArea > maxAllowedArea
        )
        if (insideLeakFailure) {
          const localPoint = getPolygonAveragePointForTest(
            getLargestAreaPolygonForTest(insideLeakFailure.insideResidue)
          )
          const sourceLocation = getNearestSelfCheckSourceLocation(localPoint)
          const contributors =
            insideLeakFailure.stage === 'packet'
              ? getPacketIntersectionContributorsForTest(
                  packets,
                  insideLeakFailure.insideResidue
                )
              : []
          recordFailureArtifact({
            errorCode: 'STROKE_OUTSIDE_LEAK',
            caseKey: key,
            summary: `${key} ${insideLeakFailure.stage} outside terminal-policy product leaves coverage inside the legal fill domain.`,
            fixtureKind: 'self-check-star',
            sourceSegmentId: sourceLocation.sourceSegmentId,
            sourcePointId: expectation.vertexId,
            nearestAnchorId: sourceLocation.nearestAnchorId,
            localPoint,
            t: sourceLocation.t,
            side: 'inside',
            expected: {
              maxInsideResidueArea: insideLeakFailure.maxAllowedArea
            },
            actual: {
              insideResidueArea: insideLeakFailure.insideResidueArea,
              totalArea: insideLeakFailure.totalArea
            },
            recommendedViewport: {
              zoom: 10,
              center: sourceLocation.projectedPoint
            }
          })
          Object.assign(insideLeakFailure, { contributors })
        }
        expect(
          insideLeakFailure,
          `${key}:${sourceFixture.key}:${expectation.vertexId}:outside-legal-domain`
        ).toBeUndefined()
      })
    }
  )

  it.each(SOLID_MATRIX_CASES)(
    'should run: solid canonical matrix case $position $joinType preserves segment envelope side semantics',
    ({ key, position, joinType }) => {
      const packets = buildSolidPacketsForPoints({
        points: RIGHT_ANGLE_POINTS,
        position,
        joinType
      })
      assertPipelineCompleteness({ key: `${key}:envelope`, packets })
      assertRightAngleSolidEnvelope({
        key,
        position,
        polygons: packets.flatMap((packet) => packet.geometry.polygons)
      })
    }
  )

  it.each(SOLID_MATRIX_CASES)(
    'should run: solid canonical matrix case $position $joinType has no rendered segment seam against fill',
    ({ key, position, joinType }) => {
      const packets = buildSolidPackets({ position, joinType })
      assertSelfCheckSolidRenderedSegmentAdherence({
        key,
        packets,
        position
      })
    }
  )

  it.each(DASHED_INSIDE_LEGAL_DOMAIN_CASES)(
    'should run: dashed canonical matrix case $position $capType stays inside the $sourceFixture.key legal fill domain through render projection',
    ({ key, position, capType, sourceFixture }) => {
      const caseKey = `${key}:${sourceFixture.key}`
      const sourceOptions = sourceFixture.useCurvedSourcePath
        ? getCanonicalSelfCheckOptions()
        : getSelfIntersectingOptions(SELF_CHECK_STAR_POINTS)
      const packets = buildDashedPacketsForSelfCheckSourceFixture({
        position,
        capType,
        sourceFixture,
        sourceOptions
      })
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
      const legalRegions = sourceOptions.implicitFillRegions
      const normalizedLegalRegions =
        exactBackend && legalRegions.length > 0
          ? exactBackend.union(legalRegions, 'nonzero')
          : legalRegions
      const stages = [
        {
          stage: 'packet-effective-product',
          polygons: packets.flatMap(getPacketProductPolygons),
          contributorsForResidue: (outsideResidue: Vec2[][]) =>
            getPacketIntersectionContributorsForTest(packets, outsideResidue)
        },
        {
          stage: 'packet-descriptor',
          polygons: packets.flatMap(getPacketDescriptorPolygons),
          contributorsForResidue: (outsideResidue: Vec2[][]) =>
            getPacketIntersectionContributorsForTest(packets, outsideResidue)
        },
        {
          stage: 'packet-product',
          polygons: packets.flatMap(getPacketProductPolygons),
          contributorsForResidue: (outsideResidue: Vec2[][]) =>
            getPacketIntersectionContributorsForTest(packets, outsideResidue)
        },
        {
          stage: 'final-face',
          polygons: finalFaces.flatMap(getFinalFaceVisibleProductPolygons),
          contributorsForResidue: () => []
        },
        {
          stage: 'render-entry',
          polygons: renderEntries.flatMap(
            getVisibleStrokePolygonsForRenderEntry
          ),
          contributorsForResidue: () => []
        }
      ]
      const failures = stages
        .map(({ stage, polygons, contributorsForResidue }) => {
          const outsideResidue = getOutsideLegalResidueForTest(
            polygons,
            legalRegions
          )
          const normalizedOutsideResidue = getOutsideLegalResidueForTest(
            polygons,
            normalizedLegalRegions
          )
          const totalArea = getTotalAbsArea(polygons)
          const outsideResidueArea = getTotalAbsArea(outsideResidue)
          const normalizedOutsideResidueArea = getTotalAbsArea(
            normalizedOutsideResidue
          )
          const maxAllowedArea = getGeometryAreaToleranceForTest(totalArea)
          const contributors = contributorsForResidue(outsideResidue)
          return {
            stage,
            polygons,
            outsideResidue,
            normalizedOutsideResidue,
            contributors,
            totalArea,
            outsideResidueArea,
            normalizedOutsideResidueArea,
            maxAllowedArea
          }
        })
        .filter(
          ({ outsideResidueArea, maxAllowedArea }) =>
            outsideResidueArea > maxAllowedArea
        )

      failures.slice(0, 6).forEach((failure) => {
        const localPoint = getPolygonAveragePointForTest(
          getLargestAreaPolygonForTest(failure.outsideResidue)
        )
        const sourceLocation = getNearestSelfCheckSourceLocation(localPoint)
        recordFailureArtifact({
          errorCode: 'STROKE_INSIDE_LEAK',
          caseKey,
          summary: `${caseKey} ${failure.stage} coverage leaks outside the legal fill domain.`,
          fixtureKind: 'self-check-star',
          localPoint,
          sourceSegmentId: sourceLocation.sourceSegmentId,
          nearestAnchorId: sourceLocation.nearestAnchorId,
          t: sourceLocation.t,
          side: 'outside',
          expected: {
            maxOutsideResidueArea: failure.maxAllowedArea
          },
          actual: {
            outsideResidueArea: failure.outsideResidueArea,
            totalArea: failure.totalArea,
            contributors: failure.contributors
          },
          recommendedViewport: {
            zoom: 8,
            center: sourceLocation.projectedPoint
          }
        })
      })

      expect(
        failures.map(
          ({
            stage,
            outsideResidueArea,
            maxAllowedArea,
            totalArea,
            outsideResidue,
            normalizedOutsideResidue,
            normalizedOutsideResidueArea,
            contributors
          }) => ({
            stage,
            outsideResidueArea,
            normalizedOutsideResidueArea,
            maxAllowedArea,
            totalArea,
            residuePolygonCount: outsideResidue.length,
            normalizedResiduePolygonCount: normalizedOutsideResidue.length,
            contributors
          })
        ),
        JSON.stringify(
          {
            caseKey,
            stageCount: stages.length
          },
          null,
          2
        )
      ).toEqual([])
    }
  )

  it.each(DASHED_EXACT_OVERLAP_CASES)(
    'should run: dashed canonical matrix case $position $capType has no same-paint final render overlap on $sourceFixture.key',
    ({ key, position, capType, sourceFixture }) => {
      const caseKey = `${key}:${sourceFixture.key}`
      const packets = buildDashedPacketsForSelfCheckSourceFixture({
        position,
        capType,
        sourceFixture
      })
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        buildStrokeFinalFacesFromResolvedPackets(packets)
      )
      const polygons = renderEntries.flatMap((entry) =>
        getEffectiveRenderEntryCoveragePolygonsForExactOverlapTest(entry)
      )
      const totalArea = getTotalAbsArea(polygons)
      const overlapArea = getExactOverlapAreaForTest(polygons)
      const maxAllowedArea = getGeometryAreaToleranceForTest(totalArea)

      if (overlapArea > maxAllowedArea) {
        const sampledFailure =
          getSampledRenderEntryOverlapFailures(renderEntries, 2)[0] ?? null
        const localPoint =
          sampledFailure?.point ??
          getPolygonAveragePointForTest(getLargestAreaPolygonForTest(polygons))
        const sourceLocation = getNearestSelfCheckSourceLocation(localPoint)
        recordFailureArtifact({
          errorCode: 'STROKE_OVERLAP',
          caseKey,
          summary: `${caseKey} has same-paint overlap after render projection.`,
          fixtureKind: 'self-check-star',
          localPoint,
          sourceSegmentId: sourceLocation.sourceSegmentId,
          nearestAnchorId: sourceLocation.nearestAnchorId,
          t: sourceLocation.t,
          side: 'overlap',
          expected: {
            maxOverlapArea: maxAllowedArea
          },
          actual: {
            overlapArea,
            totalArea
          },
          recommendedViewport: {
            zoom: 8,
            center: sourceLocation.projectedPoint
          }
        })
      }

      expect(
        {
          caseKey,
          overlapArea,
          maxAllowedArea,
          totalArea
        },
        JSON.stringify(
          {
            caseKey,
            renderEntryCount: renderEntries.length,
            rawPolygonCount: renderEntries.flatMap((entry) => entry.polygons)
              .length,
            effectivePolygonCount: polygons.length
          },
          null,
          2
        )
      ).toEqual({
        caseKey,
        overlapArea: expect.any(Number),
        maxAllowedArea: expect.any(Number),
        totalArea: expect.any(Number)
      })
      expect(overlapArea).toBeLessThanOrEqual(maxAllowedArea)
    }
  )

  it.each(SOLID_CENTER_EXACT_OVERLAP_CASES)(
    'should run: solid center $joinType has no exact same-paint overlap on $sourceFixture.key',
    ({ key, joinType, sourceFixture }) => {
      const packets = buildSolidCenterPacketsForSelfCheckSourceFixture({
        joinType,
        sourceFixture
      })
      assertPipelineCompleteness({
        key: `${key}:${sourceFixture.key}:exact-overlap`,
        packets
      })
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        buildStrokeFinalFacesFromResolvedPackets(packets)
      )
      expect(
        renderEntries.every(
          (entry) =>
            entry.runtimeMeta?.topologyFamily !== 'self-intersecting' ||
            entry.runtimeMeta?.visualOverlapCollapseStatus === 'exact-union'
        ),
        `${key}:${sourceFixture.key}:solid-center-exact-union-render-contract`
      ).toBe(true)
      const stagePolygons = [
        {
          stage: 'packet',
          polygons: packets.flatMap(getPacketProductPolygons)
        },
        {
          stage: 'render-entry',
          polygons: renderEntries.flatMap((entry) =>
            getVisibleStrokePolygonsForRenderEntry(entry)
          )
        }
      ]
      const failures = stagePolygons
        .map(({ stage, polygons }) => {
          const totalArea = getTotalAbsArea(polygons)
          const overlapArea = getExactOverlapAreaForTest(polygons)
          return {
            stage,
            polygons,
            totalArea,
            overlapArea,
            maxAllowedArea: getGeometryAreaToleranceForTest(totalArea)
          }
        })
        .filter(
          ({ overlapArea, maxAllowedArea }) => overlapArea > maxAllowedArea
        )

      failures.forEach((failure) => {
        const localPoint = getPolygonAveragePointForTest(
          getLargestAreaPolygonForTest(failure.polygons)
        )
        const sourceLocation = getNearestSelfCheckSourceLocation(localPoint)
        recordFailureArtifact({
          errorCode: 'STROKE_OVERLAP',
          caseKey: `${key}:${sourceFixture.key}`,
          summary: `${key}:${sourceFixture.key} ${failure.stage} has exact same-paint overlap.`,
          fixtureKind: 'self-check-star',
          localPoint,
          sourceSegmentId: sourceLocation.sourceSegmentId,
          nearestAnchorId: sourceLocation.nearestAnchorId,
          t: sourceLocation.t,
          side: 'overlap',
          expected: {
            maxOverlapArea: failure.maxAllowedArea
          },
          actual: {
            overlapArea: failure.overlapArea,
            totalArea: failure.totalArea
          },
          recommendedViewport: {
            zoom: 8,
            center: sourceLocation.projectedPoint
          }
        })
      })

      expect(
        failures.map(({ stage, overlapArea, maxAllowedArea, totalArea }) => ({
          stage,
          overlapArea,
          maxAllowedArea,
          totalArea
        })),
        `${key}:${sourceFixture.key}:exact-overlap`
      ).toEqual([])
    }
  )

  it.each([...SOLID_MATRIX_CASES, ...DASHED_MATRIX_CASES])(
    'should run: canonical matrix case $key has no sampled final coverage overlap',
    (caseDef) => {
      const packets =
        'joinType' in caseDef
          ? buildSolidPackets({
              position: caseDef.position,
              joinType: caseDef.joinType
            })
          : buildDashedPackets({
              position: caseDef.position,
              capType: caseDef.capType
            })
      const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
        buildStrokeFinalFacesFromResolvedPackets(packets)
      )
      const polygons = renderEntries.flatMap((entry) => entry.polygons)
      const failures = getSampledRenderEntryOverlapFailures(renderEntries, 6)
      failures.slice(0, 8).forEach((failure) => {
        const sourceLocation = getNearestSelfCheckSourceLocation(failure.point)
        recordFailureArtifact({
          errorCode: 'STROKE_OVERLAP',
          caseKey: caseDef.key,
          summary: `${caseDef.key} has overlapping final render-entry coverage.`,
          fixtureKind: 'self-check-star',
          localPoint: failure.point,
          sourceSegmentId: sourceLocation.sourceSegmentId,
          nearestAnchorId: sourceLocation.nearestAnchorId,
          t: sourceLocation.t,
          side: 'overlap',
          expected: { maxContainingRenderEntries: 1 },
          actual: { containingRenderEntries: failure.count },
          recommendedViewport: {
            zoom: 8,
            center: sourceLocation.projectedPoint
          }
        })
      })
      expect(
        failures.slice(0, 12),
        JSON.stringify(
          {
            key: caseDef.key,
            failureCount: failures.length,
            totalArea: getTotalAbsArea(polygons)
          },
          null,
          2
        )
      ).toEqual([])
    }
  )

  it.each(DASHED_MATRIX_CASES)(
    'should run: dashed canonical matrix case $position $capType keeps open-line endpoint caps one-sided',
    ({ key, position, capType }) => {
      const packets = buildDashedPacketsForPoints({
        points: OPEN_LINE_POINTS,
        closed: false,
        position,
        capType
      })
      assertPipelineCompleteness({ key: `${key}:open-line-cap`, packets })
      const polygons = packets.flatMap((packet) =>
        getPacketProductPolygons(packet)
      )
      const terminalPacket = packets.find((packet) => {
        const meta = packet.geometry.debugMeta as
          | {
              intervalTerminalRole?: string
              openPathTerminalRole?: string
              startDistance?: number
              endDistance?: number
            }
          | undefined
        return (
          typeof meta.startDistance === 'number' &&
          Math.abs(meta.startDistance) <= 1e-6 &&
          typeof meta.endDistance === 'number' &&
          meta.endDistance > meta.startDistance
        )
      })
      const terminalMeta = terminalPacket?.geometry.debugMeta as
        | {
            startDistance?: number
            endDistance?: number
            productMode?: string
          }
        | undefined
      expect(
        terminalMeta?.startDistance,
        `${key}:terminal-start-distance`
      ).toBe(0)
      expect(
        terminalMeta?.endDistance,
        `${key}:terminal-end-distance`
      ).toBeGreaterThan(0)
      const terminalEndDistance = terminalMeta?.endDistance ?? 0
      const capLength = 6
      const bodySideProbeYs = Array.from({ length: 17 }, (_, index) => {
        const ratio = index / 16
        return -capLength + ratio * capLength * 2
      })
      const usesCenterProduct = terminalMeta?.productMode === 'center-product'
      const squareCornerProbeY =
        usesCenterProduct || position === 'center'
          ? capLength * 0.92
          : position === 'inside'
            ? capLength * 0.08
            : -capLength * 0.08
      const squareCornerProbeX = terminalEndDistance + capLength * 0.92
      const endpointSideProbes = [-capLength * 0.95, 0, capLength * 0.95].map(
        (y) => ({
          y,
          covered: polygonListContainsPoint(polygons, {
            x: -capLength * 0.65,
            y
          })
        })
      )
      const behindStartCovered = endpointSideProbes.some(
        (probe) => probe.covered
      )
      const bodySideCapProbes = bodySideProbeYs.map((y) => ({
        y,
        covered: polygonListContainsPoint(polygons, {
          x: terminalEndDistance + capLength * 0.65,
          y
        })
      }))
      const bodySideCapCenterCovered = bodySideCapProbes.some(
        (probe) => probe.covered
      )
      const bodySideSquareCornerCovered = polygonListContainsPoint(polygons, {
        x: squareCornerProbeX,
        y: squareCornerProbeY
      })
      if (behindStartCovered) {
        recordFailureArtifact({
          errorCode: 'CAP_SHAPE_MISMATCH',
          caseKey: key,
          summary: `${key} ${capType} cap extends behind the open-line terminal endpoint.`,
          fixtureKind: 'open-line',
          sourceSegmentId: 'open-line:start->end',
          sourcePointId: 'open-line:start',
          nearestAnchorId: 'open-line:start',
          localPoint: { x: 0, y: 0 },
          t: 0,
          side: 'terminal',
          expected: { endpointSideCap: false },
          actual: {
            endpointSideCoverage: endpointSideProbes
          },
          recommendedViewport: {
            zoom: 10,
            center: { x: 0, y: 0 }
          }
        })
      }
      expect(behindStartCovered, `${key}:endpoint-side-cap`).toBe(false)
      if (capType === 'butt') {
        expect(bodySideCapCenterCovered, `${key}:butt-body-side-cap`).toBe(
          false
        )
        return
      }
      if (!bodySideCapCenterCovered) {
        recordFailureArtifact({
          errorCode: 'CAP_EXTENSION_MISSING',
          caseKey: key,
          summary: `${key} ${capType} cap is missing body-side terminal extension.`,
          fixtureKind: 'open-line',
          sourceSegmentId: 'open-line:start->end',
          sourcePointId: 'open-line:start',
          nearestAnchorId: 'open-line:start',
          localPoint: { x: 20, y: 0 },
          t: 0.125,
          side: 'terminal',
          expected: { bodySideCap: true },
          actual: {
            bodySideCap: bodySideCapCenterCovered,
            bodySideCapProbes,
            productBounds: getPolygonBoundsForTest(polygons),
            terminalMeta,
            terminalDebugMeta: terminalPacket?.geometry.debugMeta
          },
          recommendedViewport: {
            zoom: 10,
            center: { x: 20, y: 0 }
          }
        })
      }
      expect(bodySideCapCenterCovered, `${key}:body-side-cap`).toBe(true)
      if (capType === 'square') {
        if (!bodySideSquareCornerCovered) {
          recordFailureArtifact({
            errorCode: 'CAP_SHAPE_MISMATCH',
            caseKey: key,
            summary: `${key} square cap is missing body-side corner footprint.`,
            fixtureKind: 'open-line',
            sourceSegmentId: 'open-line:start->end',
            sourcePointId: 'open-line:start',
            nearestAnchorId: 'open-line:start',
            localPoint: { x: 20, y: 0 },
            t: 0.125,
            side: 'terminal',
            expected: { squareCorner: true },
            actual: { squareCorner: bodySideSquareCornerCovered },
            recommendedViewport: {
              zoom: 10,
              center: { x: 20, y: 0 }
            }
          })
        }
        expect(
          bodySideSquareCornerCovered,
          `${key}:body-side-square-corner`
        ).toBe(true)
      } else {
        if (bodySideSquareCornerCovered) {
          recordFailureArtifact({
            errorCode: 'CAP_SHAPE_MISMATCH',
            caseKey: key,
            summary: `${key} round cap has square-like body-side corner footprint.`,
            fixtureKind: 'open-line',
            sourceSegmentId: 'open-line:start->end',
            sourcePointId: 'open-line:start',
            nearestAnchorId: 'open-line:start',
            localPoint: { x: 20, y: 0 },
            t: 0.125,
            side: 'terminal',
            expected: { squareCorner: false },
            actual: { squareCorner: bodySideSquareCornerCovered },
            recommendedViewport: {
              zoom: 10,
              center: { x: 20, y: 0 }
            }
          })
        }
        expect(
          bodySideSquareCornerCovered,
          `${key}:body-side-round-corner`
        ).toBe(false)
      }
    }
  )

  it.each(STROKE_POSITIONS)(
    'should run: solid %s joins keep distinct source-vertex geometry signatures',
    (position) => {
      const signatures = new Map<StrokeJoin, string>()
      SOLID_JOINS.forEach((joinType) => {
        const packets = buildSolidPackets({ position, joinType })
        const renderStrokePathPolygons =
          getRenderStrokePathPolygonsFromPackets(packets)
        const signaturePolygons =
          renderStrokePathPolygons.length > 0
            ? renderStrokePathPolygons
            : packets.flatMap((packet) => packet.geometry.polygons)
        if (position !== 'center') {
          expect(
            getRenderStrokeJoinStylesFromPackets(packets),
            `${position}:${joinType}:render-join-style`
          ).toEqual(expect.arrayContaining([joinType]))
        }
        signatures.set(
          joinType,
          getCoverageSignature({
            polygons: signaturePolygons,
            centers: [SELF_CHECK_STAR_POINTS[2], SELF_CHECK_STAR_POINTS[3]],
            radius: 34,
            step: 1
          })
        )
      })

      const pairs: [StrokeJoin, StrokeJoin][] = [
        ['miter', 'bevel'],
        ['miter', 'round'],
        ['bevel', 'round']
      ]
      pairs.forEach(([first, second]) => {
        expect(
          countSignatureDifferences(
            signatures.get(first) ?? '',
            signatures.get(second) ?? ''
          ),
          `${position}:${first}:${second}`
        ).toBeGreaterThan(4)
      })
    }
  )

  it.each(STROKE_POSITIONS)(
    'should run: dashed %s caps keep distinct terminal footprints on open curved paths',
    (position) => {
      const signatures = new Map<StrokeCap, string>()
      DASHED_CAPS.forEach((capType) => {
        const packets = buildDashedPackets({
          position,
          capType,
          points: OPEN_CURVE_POINTS,
          closed: false
        })
        assertPipelineCompleteness({
          key: `dashed:${position}:${capType}:cap-signature`,
          packets
        })
        signatures.set(
          capType,
          getCoverageSignature({
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            centers: [
              OPEN_CURVE_POINTS[0],
              OPEN_CURVE_POINTS[OPEN_CURVE_POINTS.length - 1],
              { x: -18, y: 94 },
              { x: 238, y: 94 }
            ],
            radius: 48,
            step: 1
          })
        )
      })

      const pairs: [StrokeCap, StrokeCap][] = [
        ['butt', 'square'],
        ['butt', 'round'],
        ['square', 'round']
      ]
      pairs.forEach(([first, second]) => {
        expect(
          countSignatureDifferences(
            signatures.get(first) ?? '',
            signatures.get(second) ?? ''
          ),
          `${position}:${first}:${second}`
        ).toBeGreaterThan(4)
      })
    }
  )

  it.each(STROKE_POSITIONS)(
    'should run: dashed %s open curved path keeps complete terminal-cap pipeline',
    (position) => {
      DASHED_CAPS.forEach((capType) => {
        const packets = buildDashedPackets({
          position,
          capType,
          points: OPEN_CURVE_POINTS,
          closed: false
        })
        assertPipelineCompleteness({
          key: `dashed:${position}:${capType}:open-curve`,
          packets
        })
        expect(
          packets.flatMap((packet) => packet.geometry.polygons).flat().length,
          `dashed:${position}:${capType}:open-curve:smooth-samples`
        ).toBeGreaterThan(20)
      })
    }
  )

  it('should run: right-angle primitive keeps solid join signatures on segment-aligned geometry', () => {
    const signatures = new Map<string, string>()
    STROKE_POSITIONS.forEach((position) => {
      SOLID_JOINS.forEach((joinType) => {
        const stroke = createDefaultStroke({
          style: 'solid',
          position,
          width: 12,
          joinType,
          capType: 'round',
          miterAngle: 28.96
        })
        const packets =
          position === 'center'
            ? buildSolidCenterStrokeResolvedPackets(
                `canonical:right-angle:${position}:${joinType}`,
                RIGHT_ANGLE_POINTS,
                true,
                [stroke]
              )
            : buildConstrainedSolidStrokeResolvedPackets(
                `canonical:right-angle:${position}:${joinType}`,
                RIGHT_ANGLE_POINTS,
                true,
                [stroke]
              )
        assertPipelineCompleteness({
          key: `right-angle:${position}:${joinType}`,
          packets
        })
        const renderStrokePathPolygons =
          getRenderStrokePathPolygonsFromPackets(packets)
        const signaturePolygons =
          renderStrokePathPolygons.length > 0
            ? renderStrokePathPolygons
            : packets.flatMap((packet) => packet.geometry.polygons)
        signatures.set(
          `${position}:${joinType}`,
          getCoverageSignature({
            polygons: signaturePolygons,
            centers:
              position === 'inside'
                ? [{ x: 114, y: 6 }]
                : position === 'outside'
                  ? [
                      { x: 126, y: -6 },
                      { x: 114, y: -6 },
                      { x: 126, y: 6 }
                    ]
                  : [RIGHT_ANGLE_POINTS[1]],
            radius: 18,
            step: 1.5
          })
        )
      })
    })

    STROKE_POSITIONS.forEach((position) => {
      if (position !== 'inside') {
        expect(
          countSignatureDifferences(
            signatures.get(`${position}:miter`) ?? '',
            signatures.get(`${position}:bevel`) ?? ''
          ),
          `right-angle:${position}:miter:bevel`
        ).toBeGreaterThan(4)
        expect(
          countSignatureDifferences(
            signatures.get(`${position}:bevel`) ?? '',
            signatures.get(`${position}:round`) ?? ''
          ),
          `right-angle:${position}:bevel:round`
        ).toBeGreaterThanOrEqual(4)
      }
    })
  })
})
