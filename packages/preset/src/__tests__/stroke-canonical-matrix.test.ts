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
  toSolidCenterStrokeRenderEntriesFromFinalFaces
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
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: RenderEntryStrokePathGroupForTest[]
  strokePathStyle?: RenderEntryStrokePathStyleForTest
}

const STROKE_POSITIONS = ['inside', 'center', 'outside'] as const
const SOLID_JOINS = ['miter', 'bevel', 'round'] as const
const DASHED_SOURCE_JOINS = ['miter', 'bevel', 'round'] as const
const DASHED_CAPS = ['butt', 'square', 'round'] as const
const SOURCE_JOIN_SHAPE_TURN_ANGLE_FOR_TEST = Math.PI / 24
const SOURCE_JOIN_ROUND_MIN_VISIBLE_ARC_POINTS_FOR_TEST = 8
const SOURCE_JOIN_MIN_SIGNATURE_DIFFERENCES_FOR_TEST = 5
const SELF_CHECK_DASH_PATTERN_FOR_TEST = [27, 20] as const

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

const DASHED_OUTSIDE_SOURCE_JOIN_CASES =
  CANONICAL_SELF_CHECK_SOURCE_FIXTURES.flatMap((sourceFixture) =>
    DASHED_SOURCE_JOINS.map((joinType) => ({
      key: `dashed:outside:butt:${joinType}`,
      position: 'outside' as const,
      capType: 'butt' as const,
      joinType,
      sourceFixture
    }))
  )

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
    clipInsideToFillDomain: true,
    constrainedDashedVisualMode: 'product-final' as const
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
  const entryPolygons = renderEntries.map((entry) => entry.polygons)
  const bounds = getPolygonBoundsForTest(entryPolygons.flat())
  const failures: { point: Vec2; count: number }[] = []
  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const point = { x, y }
      const count = entryPolygons.filter((polygons) =>
        polygonListContainsPoint(polygons, point)
      ).length
      if (count > 1) {
        failures.push({ point, count })
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
    expect(packet.geometry.geometryId, key).not.toContain(
      'boundary-terminal-join'
    )
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
) => [
  ...buildRenderStrokePathPolygons(
    renderEntry.strokePaths ?? [],
    renderEntry.strokePathStyle
  ),
  ...(renderEntry.strokePathGroups?.flatMap((group) =>
    buildRenderStrokePathPolygons(
      group.strokePaths ?? [],
      group.strokePathStyle ?? renderEntry.strokePathStyle
    )
  ) ?? []),
  ...(renderEntry.strokeMaskPolygons ?? [])
]

const getVisibleStrokePolygonsForRenderEntry = (
  entry: ReturnType<
    typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
  >[number]
) => {
  const renderEntry = entry as RenderEntrySourceMaskForTest
  let visiblePolygons = getStrokeMaskPolygonsForRenderEntry(renderEntry)
  if (visiblePolygons.length === 0) {
    visiblePolygons = entry.polygons
  }
  const clipPolygons = renderEntry.clipPolygons ?? entry.polygons
  visiblePolygons = getExactIntersectionPolygonsForTest(
    visiblePolygons,
    clipPolygons
  )
  if (
    renderEntry.fillClipPolygons &&
    renderEntry.fillClipPolygons.length > 0
  ) {
    visiblePolygons = getExactIntersectionPolygonsForTest(
      visiblePolygons,
      renderEntry.fillClipPolygons
    )
  }
  return visiblePolygons
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
  joinType
}: {
  position: StrokePosition
  joinType: StrokeJoin
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
      SELF_CHECK_STAR_POINTS,
      true,
      [stroke]
    )
  }
  return buildConstrainedSolidStrokeResolvedPackets(
    `canonical:solid:${position}:${joinType}`,
    SELF_CHECK_STAR_POINTS,
    true,
    [stroke],
    getSelfIntersectingOptions(SELF_CHECK_STAR_POINTS)
  )
}

const buildDashedPackets = ({
  position,
  capType,
  joinType = 'round',
  points = SELF_CHECK_STAR_POINTS,
  closed = true,
  useCurvedSelfCheckSource = false
}: {
  position: StrokePosition
  capType: StrokeCap
  joinType?: StrokeJoin
  points?: Vec2[]
  closed?: boolean
  useCurvedSelfCheckSource?: boolean
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
      ? useCurvedSelfCheckSource
        ? getCanonicalSelfCheckOptions()
        : getSelfIntersectingOptions(points)
      : { constrainedDashedVisualMode: 'product-final' }
  )
}

const buildDashedPacketsForSelfCheckSourceFixture = ({
  position,
  capType,
  joinType = 'round',
  sourceFixture
}: {
  position: StrokePosition
  capType: StrokeCap
  joinType?: StrokeJoin
  sourceFixture: (typeof CANONICAL_SELF_CHECK_SOURCE_FIXTURES)[number]
}) =>
  buildDashedPackets({
    position,
    capType,
    joinType,
    useCurvedSelfCheckSource: sourceFixture.useCurvedSourcePath
  })

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
        closed
          ? getSelfIntersectingOptions(points)
          : { constrainedDashedVisualMode: 'product-final' }
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

const getExactDifferenceAreaForTest = (
  subjectPolygons: Vec2[][],
  clipPolygons: Vec2[][]
) => {
  if (!exactBackend || subjectPolygons.length === 0) {
    return 0
  }
  if (clipPolygons.length === 0) {
    return getTotalAbsArea(subjectPolygons)
  }
  return getTotalAbsArea(
    flattenRegionPolygonsForTest(
      exactBackend.difference(
        toPolygonRegionsForTest(subjectPolygons),
        toPolygonRegionsForTest(clipPolygons),
        'nonzero'
      )
    )
  )
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

const getPacketIntersectionContributorsForTest = (
  packets: Array<{
    geometry: { geometryId: string; polygons: Vec2[][] }
  }>,
  clipPolygons: Vec2[][]
) =>
  packets
    .map((packet) => ({
      geometryId: packet.geometry.geometryId,
      area: getExactIntersectionAreaForTest(
        packet.geometry.polygons,
        clipPolygons
      )
    }))
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

const getRoundJoinContinuityProbesForTest = (candidate: {
  previousDirection: Vec2
  nextDirection: Vec2
  previousOffsetEnd: Vec2
  nextOffsetStart: Vec2
}) => [
  addPointsForTest(
    candidate.previousOffsetEnd,
    scalePointForTest(candidate.previousDirection, -1.5)
  ),
  addPointsForTest(
    candidate.previousOffsetEnd,
    scalePointForTest(candidate.previousDirection, -3)
  ),
  addPointsForTest(
    candidate.nextOffsetStart,
    scalePointForTest(candidate.nextDirection, 1.5)
  ),
  addPointsForTest(
    candidate.nextOffsetStart,
    scalePointForTest(candidate.nextDirection, 3)
  )
]

const buildSourceJoinAdjacentBodyPolygonsForTest = (candidate: {
  nextDirection: Vec2
  nextOffsetStart: Vec2
  previousDirection: Vec2
  previousOffsetEnd: Vec2
  vertex: Vec2
}, options: { continuityLength?: number } = {}) => {
  const continuityLength = options.continuityLength ?? 14
  const previousSourcePoint = addPointsForTest(
    candidate.vertex,
    scalePointForTest(candidate.previousDirection, -continuityLength)
  )
  const previousOuterPoint = addPointsForTest(
    candidate.previousOffsetEnd,
    scalePointForTest(candidate.previousDirection, -continuityLength)
  )
  const nextSourcePoint = addPointsForTest(
    candidate.vertex,
    scalePointForTest(candidate.nextDirection, continuityLength)
  )
  const nextOuterPoint = addPointsForTest(
    candidate.nextOffsetStart,
    scalePointForTest(candidate.nextDirection, continuityLength)
  )
  return [
    [
      candidate.vertex,
      candidate.previousOffsetEnd,
      previousOuterPoint,
      previousSourcePoint
    ],
    [
      candidate.vertex,
      candidate.nextOffsetStart,
      nextOuterPoint,
      nextSourcePoint
    ]
  ]
}

const buildSourceJoinLocalExpectedCoverageForTest = (
  candidate: {
    miterPolygon: Vec2[]
    roundPolygon: Vec2[]
  } & Parameters<typeof buildSourceJoinAdjacentBodyPolygonsForTest>[0],
  joinType: StrokeJoin,
  legalRegions: { polygons: Vec2[][] }[]
) => {
  const joinPolygon =
    joinType === 'round' ? candidate.roundPolygon : candidate.miterPolygon
  return getOutsideLegalResidueForTest(
    [joinPolygon, ...buildSourceJoinAdjacentBodyPolygonsForTest(candidate)],
    legalRegions
  )
}

const getLocalJoinSeamProbesForTest = (candidate: {
  miterPolygon: Vec2[]
  nextDirection: Vec2
  nextOffsetStart: Vec2
  previousDirection: Vec2
  previousOffsetEnd: Vec2
  roundPolygon: Vec2[]
  vertex: Vec2
}) => {
  const bodyProbes = getRoundJoinContinuityProbesForTest(candidate)
  const arcProbes = candidate.roundPolygon
    .slice(1)
    .filter((_point, index, points) => {
      if (points.length <= 4) {
        return true
      }
      return index > 0 && index < points.length - 1 && index % 3 === 0
    })
    .map((point) =>
      addPointsForTest(
        candidate.vertex,
        scalePointForTest(subtractPointsForTest(point, candidate.vertex), 0.92)
      )
    )
  return [...bodyProbes, ...arcProbes]
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

const getOutsideSourceJoinExpectations = (
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
    const turnDot = dotPointsForTest(incoming, outgoing)
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

const getLocalJoinCoverageSignature = ({
  polygons,
  vertex
}: {
  polygons: Vec2[][]
  vertex: Vec2
}) =>
  getCoverageSignature({
    polygons,
    centers: [vertex],
    radius: 42,
    step: 2
  })

const countRoundArcBoundaryPointsForTest = ({
  polygons,
  vertex
}: {
  polygons: Vec2[][]
  vertex: Vec2
}) =>
  polygons.flat().filter((point) => {
    const radius = distanceBetweenPointsForTest(point, vertex)
    return radius >= 8 && radius <= 13
  }).length

const getSourceVertexJoinIndexesFromGeometryIds = (geometryIds: string[]) =>
  new Set(
    geometryIds.flatMap((geometryId) => {
      const match = geometryId.match(/source-vertex-join:(\d+)/)
      return match ? [Number(match[1])] : []
    })
  )

const getNearestPolygonPointDistanceForTest = (
  polygons: Vec2[][],
  point: Vec2
) =>
  polygons
    .flat()
    .reduce(
      (minimum, polygonPoint) =>
        Math.min(minimum, distanceBetweenPointsForTest(point, polygonPoint)),
      Number.POSITIVE_INFINITY
    )

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
              packet.geometry.debugMeta?.geometryFamily ===
                'constrained-solid' &&
              packet.geometry.debugMeta?.resolutionStatus ===
                'exact-constrained'
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
              packet.geometry.debugMeta?.geometryFamily ===
                'constrained-dashed' &&
              packet.geometry.debugMeta?.resolutionStatus ===
                'exact-constrained' &&
              packet.geometry.debugMeta?.finalCoverageBuilderStatus ===
                'product-final'
          ),
          key
        ).toBe(true)
      }
    }
  )

  it.each(DASHED_OUTSIDE_SOURCE_JOIN_CASES)(
    'should run: dashed outside source join $joinType preserves authored source-vertex geometry on $sourceFixture.key',
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
      const packetPolygons = packets.flatMap(
        (packet) => packet.geometry.polygons
      )
      const finalFacePolygons = finalFaces.flatMap((face) => face.polygons)
      const packetGeometryIds = packets.map(
        (packet) => packet.geometry.geometryId
      )
      const sourceVertexJoinIndexes =
        getSourceVertexJoinIndexesFromGeometryIds(packetGeometryIds)
      expect(
        packetGeometryIds.some((id) => id.includes('source-vertex-join'))
      ).toBe(true)
      expect(
        packetGeometryIds.some((id) => id.includes('boundary-terminal-join'))
      ).toBe(false)

      const expectations = getOutsideSourceJoinExpectations(sourceFixture)
      expect(
        expectations.length,
        `${key}:${sourceFixture.key}:source-join-expectation-count`
      ).toBe(SELF_CHECK_SOURCE_VERTEX_ID_LIST.length)

      const sourceJoinShapeExpectations = expectations.filter(
        (expectation) =>
          expectation.hasVisibleDashCoverage &&
          expectation.outside.turnAngle >= SOURCE_JOIN_SHAPE_TURN_ANGLE_FOR_TEST
      )
      const missingSourceVertexJoins = sourceJoinShapeExpectations.filter(
        (expectation) => !sourceVertexJoinIndexes.has(expectation.vertexIndex)
      )
      missingSourceVertexJoins.forEach((expectation) => {
        recordFailureArtifact({
          errorCode: 'JOIN_SOURCE_VERTEX_PACKET_MISSING',
          caseKey: key,
          summary: `${key} is missing source-vertex join packet coverage for an authored source anchor.`,
          fixtureKind: 'self-check-star',
          sourceSegmentId: `${SELF_CHECK_STAR_VECTOR_NETWORK.pointIds[expectation.previousSegmentIndex]}->${SELF_CHECK_STAR_VECTOR_NETWORK.pointIds[expectation.nextSegmentIndex]}`,
          sourcePointId: expectation.vertexId,
          nearestAnchorId: expectation.vertexId,
          localPoint: expectation.outside.vertex,
          side: 'join',
          expected: {
            sourceVertexJoinPacket: true
          },
          actual: {
            sourceVertexJoinPacket: false,
            availableSourceVertexJoinIndexes: Array.from(
              sourceVertexJoinIndexes
            )
          },
          recommendedViewport: {
            zoom: 10,
            center: expectation.outside.vertex
          }
        })
      })
      expect(
        missingSourceVertexJoins,
        `${key}:${sourceFixture.key}:source-vertex-packet-coverage`
      ).toEqual([])

      expectations.forEach((expectation) => {
        const sourceSegmentId = `${SELF_CHECK_STAR_VECTOR_NETWORK.pointIds[expectation.previousSegmentIndex]}->${SELF_CHECK_STAR_VECTOR_NETWORK.pointIds[expectation.nextSegmentIndex]}`
        const legalRegions =
          getSelfCheckLegalRegionsForSourceFixture(sourceFixture)
        const outsideMiterStageCoverage = {
          packet: polygonListContainsPoint(
            packetPolygons,
            expectation.outside.miterProbe
          ),
          finalFace: polygonListContainsPoint(
            finalFacePolygons,
            expectation.outside.miterProbe
          ),
          renderEntry: isPointInRenderedStroke(
            renderEntries,
            expectation.outside.miterProbe
          )
        }
        const bevelStageCoverage = {
          packet: polygonListContainsPoint(
            packetPolygons,
            expectation.outside.bevelMidpoint
          ),
          finalFace: polygonListContainsPoint(
            finalFacePolygons,
            expectation.outside.bevelMidpoint
          ),
          renderEntry: isPointInRenderedStroke(
            renderEntries,
            expectation.outside.bevelMidpoint
          )
        }
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
          recordFailureArtifact({
            errorCode: 'STROKE_OUTSIDE_LEAK',
            caseKey: key,
            summary: `${key} ${insideLeakFailure.stage} outside source join leaves coverage inside the legal fill domain.`,
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
        }
        expect(
          insideLeakFailure,
          `${key}:${sourceFixture.key}:${expectation.vertexId}:outside-legal-domain`
        ).toBeUndefined()
        if (
          !expectation.hasVisibleDashCoverage ||
          expectation.outside.turnAngle < SOURCE_JOIN_SHAPE_TURN_ANGLE_FOR_TEST
        ) {
          return
        }
        const outsideMiterCovered = isPointInRenderedStroke(
          renderEntries,
          expectation.outside.miterProbe
        )
        const insideMiterCovered = isPointInRenderedStroke(
          renderEntries,
          expectation.inside.miterProbe
        )
        if (joinType === 'miter') {
          const insideMiterForbiddenArea = getExactIntersectionAreaForTest(
            renderPolygons,
            [expectation.inside.miterPolygon]
          )
          const insideMiterPacketContributors =
            getPacketIntersectionContributorsForTest(packets, [
              expectation.inside.miterPolygon
            ])
          const maxInsideMiterForbiddenArea = Math.max(
            0.25,
            Math.abs(polygonArea(expectation.inside.miterPolygon)) * 0.05
          )
          const expectedMiterLocalCoverage =
            buildSourceJoinLocalExpectedCoverageForTest(
              expectation.outside,
              'miter',
              legalRegions
            )
          const miterLocalMissingPolygons = getExactDifferencePolygonsForTest(
            expectedMiterLocalCoverage,
            renderPolygons
          )
          const miterLocalMissingArea = getTotalAbsArea(
            miterLocalMissingPolygons
          )
          const expectedMiterLocalArea = getTotalAbsArea(
            expectedMiterLocalCoverage
          )
          const maxMiterLocalMissingArea = Math.max(
            0.5,
            expectedMiterLocalArea * 0.08
          )
          const outsideMiterNearestPacketPointDistance =
            getNearestPolygonPointDistanceForTest(
              packetPolygons,
              expectation.outside.miterProbe
            )
          if (
            !outsideMiterCovered ||
            insideMiterCovered
          ) {
            recordFailureArtifact({
              errorCode: 'JOIN_MITER_DIRECTION',
              caseKey: key,
              summary: `${key} miter join does not extend along the outside source-vertex direction.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint: expectation.outside.miterProbe,
              side: 'join',
              expected: {
                outsideMiterCovered: true,
                insideMiterCovered: false
              },
              actual: {
                outsideMiterCovered,
                insideMiterCovered,
                insideMiterForbiddenArea,
                maxInsideMiterForbiddenArea,
                miterLocalMissingArea,
                maxMiterLocalMissingArea,
                outsideMiterStageCoverage,
                outsideMiterNearestPacketPointDistance,
                insideMiterPacketContributors
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          if (miterLocalMissingArea > maxMiterLocalMissingArea) {
            recordFailureArtifact({
              errorCode: 'JOIN_MITER_OVERTRIM_GAP',
              caseKey: key,
              summary: `${key} miter join trims too much adjacent dash body near an authored source vertex.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint: getPolygonAveragePointForTest(
                getLargestAreaPolygonForTest(miterLocalMissingPolygons)
              ),
              side: 'join',
              expected: {
                maxMiterLocalMissingArea
              },
              actual: {
                miterLocalMissingArea,
                expectedMiterLocalArea
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          expect(
            {
              outsideMiterCovered,
              insideMiterCovered,
              miterLocalMissingAreaWithinTolerance:
                miterLocalMissingArea <= maxMiterLocalMissingArea
            },
            `${key}:${sourceFixture.key}:${expectation.vertexId}:miter-direction:${JSON.stringify(
              {
                outsideMiterStageCoverage,
                insideMiterForbiddenArea,
                maxInsideMiterForbiddenArea,
                miterLocalMissingArea,
                maxMiterLocalMissingArea
              }
            )}`
          ).toEqual({
            outsideMiterCovered: true,
            insideMiterCovered: false,
            miterLocalMissingAreaWithinTolerance: true
          })
        }

        if (joinType === 'bevel') {
          const bevelCovered = isPointInRenderedStroke(
            renderEntries,
            expectation.outside.bevelMidpoint
          )
          const bevelNearestPacketPointDistance =
            getNearestPolygonPointDistanceForTest(
              packetPolygons,
              expectation.outside.bevelMidpoint
            )
          if (!bevelCovered || outsideMiterCovered) {
            recordFailureArtifact({
              errorCode: 'JOIN_BEVEL_MISSING',
              caseKey: key,
              summary: `${key} bevel join is missing its outside chord footprint or still behaves like miter.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint: expectation.outside.bevelMidpoint,
              side: 'join',
              expected: {
                bevelCovered: true,
                outsideMiterCovered: false
              },
              actual: {
                bevelCovered,
                outsideMiterCovered,
                bevelStageCoverage,
                outsideMiterStageCoverage,
                bevelNearestPacketPointDistance
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          expect(
            { bevelCovered, outsideMiterCovered },
            `${key}:${sourceFixture.key}:${expectation.vertexId}:bevel-footprint:${JSON.stringify(
              {
                bevelStageCoverage,
                outsideMiterStageCoverage
              }
            )}`
          ).toEqual({
            bevelCovered: true,
            outsideMiterCovered: false
          })
        }

        if (joinType === 'round') {
          const expectedRoundSectorPolygons =
            getOutsideLegalResidueForTest(
              [expectation.outside.roundPolygon],
              legalRegions
            )
          const expectedRoundSectorArea = getTotalAbsArea(
            expectedRoundSectorPolygons
          )
          const roundSectorMissingPolygons = getExactDifferencePolygonsForTest(
            expectedRoundSectorPolygons,
            renderPolygons
          )
          const roundSectorMissingArea = getTotalAbsArea(
            roundSectorMissingPolygons
          )
          const maxRoundSectorMissingArea = Math.max(
            0.35,
            expectedRoundSectorArea * 0.01
          )
          const arcPointCount = countRoundArcBoundaryPointsForTest({
            polygons: renderPolygons,
            vertex: expectation.outside.vertex
          })
          const continuityProbes = getRoundJoinContinuityProbesForTest(
            expectation.outside
          )
          const uncoveredContinuityProbes = continuityProbes.filter(
            (point) => !isPointInRenderedStroke(renderEntries, point)
          )
          const expectedRoundLocalCoverage =
            buildSourceJoinLocalExpectedCoverageForTest(
              expectation.outside,
              'round',
              legalRegions
            )
          const roundLocalMissingPolygons = getExactDifferencePolygonsForTest(
            expectedRoundLocalCoverage,
            renderPolygons
          )
          const roundLocalMissingArea = getTotalAbsArea(
            roundLocalMissingPolygons
          )
          const expectedRoundLocalArea = getTotalAbsArea(
            expectedRoundLocalCoverage
          )
          const maxRoundLocalMissingArea = Math.max(
            1,
            expectedRoundLocalArea * 0.025
          )
          const seamProbes = getLocalJoinSeamProbesForTest(
            expectation.outside
          ).filter(
            (point) => !isPointInsideExactLegalRegionForTest(point, legalRegions)
          )
          const uncoveredSeamProbes = seamProbes.filter(
            (point) => !isPointInRenderedStroke(renderEntries, point)
          )
          const wrongSideRoundProbes = [
            expectation.inside.bevelMidpoint,
            expectation.inside.miterProbe
          ].filter(
            (point) => !isPointInsideExactLegalRegionForTest(point, legalRegions)
          )
          const coveredWrongSideRoundProbes = wrongSideRoundProbes.filter(
            (point) => isPointInRenderedStroke(renderEntries, point)
          )
          if (
            arcPointCount < SOURCE_JOIN_ROUND_MIN_VISIBLE_ARC_POINTS_FOR_TEST
          ) {
            recordFailureArtifact({
              errorCode: 'JOIN_ROUND_NOT_SMOOTH',
              caseKey: key,
              summary: `${key} round join does not keep enough local arc boundary samples.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint: expectation.outside.vertex,
              side: 'join',
              expected: {
                minArcPointCount:
                  SOURCE_JOIN_ROUND_MIN_VISIBLE_ARC_POINTS_FOR_TEST
              },
              actual: { arcPointCount },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          if (
            uncoveredContinuityProbes.length > 0 ||
            roundSectorMissingArea > maxRoundSectorMissingArea
          ) {
            recordFailureArtifact({
              errorCode: 'JOIN_ROUND_CONTINUITY_GAP',
              caseKey: key,
              summary: `${key} round join does not connect cleanly to the adjacent dash body.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint:
                uncoveredContinuityProbes[0] ??
                getPolygonAveragePointForTest(
                  getLargestAreaPolygonForTest(roundSectorMissingPolygons)
                ),
              side: 'join',
              expected: { uncoveredContinuityProbeCount: 0 },
              actual: {
                uncoveredContinuityProbeCount:
                  uncoveredContinuityProbes.length,
                roundSectorMissingArea,
                maxRoundSectorMissingArea,
                expectedRoundSectorArea
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          if (uncoveredSeamProbes.length > 0) {
            recordFailureArtifact({
              errorCode: 'JOIN_ROUND_ARC_SEAM_GAP',
              caseKey: key,
              summary: `${key} round join leaves a local seam gap between arc and adjacent dash body.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint:
                uncoveredSeamProbes[0] ??
                getPolygonAveragePointForTest(
                  getLargestAreaPolygonForTest(roundLocalMissingPolygons)
                ),
              side: 'join',
              expected: {
                uncoveredSeamProbeCount: 0,
                maxRoundLocalMissingArea
              },
              actual: {
                uncoveredSeamProbeCount: uncoveredSeamProbes.length,
                roundLocalMissingArea,
                expectedRoundLocalArea
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          if (coveredWrongSideRoundProbes.length > 0) {
            recordFailureArtifact({
              errorCode: 'JOIN_ROUND_BEVEL_PROTRUSION',
              caseKey: key,
              summary: `${key} round join has bevel-like protruding coverage on the wrong source side.`,
              fixtureKind: 'self-check-star',
              sourceSegmentId,
              sourcePointId: expectation.vertexId,
              nearestAnchorId: expectation.vertexId,
              localPoint: coveredWrongSideRoundProbes[0],
              side: 'join',
              expected: {
                coveredWrongSideProbeCount: 0
              },
              actual: {
                coveredWrongSideProbeCount: coveredWrongSideRoundProbes.length,
                coveredWrongSideRoundProbes
              },
              recommendedViewport: {
                zoom: 10,
                center: expectation.outside.vertex
              }
            })
          }
          expect(
            arcPointCount,
            `${key}:${sourceFixture.key}:${expectation.vertexId}:round-smoothness`
          ).toBeGreaterThanOrEqual(
            SOURCE_JOIN_ROUND_MIN_VISIBLE_ARC_POINTS_FOR_TEST
          )
          expect(
            {
              uncoveredContinuityProbes,
              roundSectorMissingAreaWithinTolerance:
                roundSectorMissingArea <= maxRoundSectorMissingArea,
              uncoveredSeamProbes,
              coveredWrongSideRoundProbes
            },
            `${key}:${sourceFixture.key}:${expectation.vertexId}:round-continuity:${JSON.stringify(
              {
                roundSectorMissingArea,
                maxRoundSectorMissingArea,
                expectedRoundSectorArea,
                roundLocalMissingArea,
                maxRoundLocalMissingArea,
                expectedRoundLocalArea,
                coveredWrongSideProbeCount:
                  coveredWrongSideRoundProbes.length
              }
            )}`
          ).toEqual({
            uncoveredContinuityProbes: [],
            roundSectorMissingAreaWithinTolerance: true,
            uncoveredSeamProbes: [],
            coveredWrongSideRoundProbes: []
          })
        }
      })
    }
  )

  it.each(CANONICAL_SELF_CHECK_SOURCE_FIXTURES)(
    'should run: dashed outside source joins keep distinct local signatures on $key',
    (sourceFixture) => {
      const signaturesByJoin = new Map<StrokeJoin, string>()
      const expectations = getOutsideSourceJoinExpectations(sourceFixture)
      expect(
        expectations.length,
        `dashed:outside:butt:${sourceFixture.key}:signature-source-vertex-count`
      ).toBe(SELF_CHECK_SOURCE_VERTEX_ID_LIST.length)
      const sourceJoinShapeExpectations = expectations.filter(
        (expectation) =>
          expectation.hasVisibleDashCoverage &&
          expectation.outside.turnAngle >= SOURCE_JOIN_SHAPE_TURN_ANGLE_FOR_TEST
      )
      if (sourceJoinShapeExpectations.length === 0) {
        return
      }
      DASHED_SOURCE_JOINS.forEach((joinType) => {
        const packets = buildDashedPacketsForSelfCheckSourceFixture({
          position: 'outside',
          capType: 'butt',
          joinType,
          sourceFixture
        })
        assertPipelineCompleteness({
          key: `dashed:outside:butt:${joinType}:${sourceFixture.key}`,
          packets
        })
        const renderPolygons = toSolidCenterStrokeRenderEntriesFromFinalFaces(
          buildStrokeFinalFacesFromResolvedPackets(packets)
        ).flatMap((entry) => entry.polygons)
        signaturesByJoin.set(
          joinType,
          sourceJoinShapeExpectations
            .map((expectation) =>
              getLocalJoinCoverageSignature({
                polygons: renderPolygons,
                vertex: expectation.outside.vertex
              })
            )
            .join('|')
        )
      })

      const pairs: [StrokeJoin, StrokeJoin][] = [
        ['miter', 'bevel'],
        ['miter', 'round'],
        ['bevel', 'round']
      ]
      pairs.forEach(([first, second]) => {
        const differences = countSignatureDifferences(
          signaturesByJoin.get(first) ?? '',
          signaturesByJoin.get(second) ?? ''
        )
        if (differences < SOURCE_JOIN_MIN_SIGNATURE_DIFFERENCES_FOR_TEST) {
          const expectation = expectations[0]
          recordFailureArtifact({
            errorCode: 'JOIN_SIGNATURE_MISSING',
            caseKey: `dashed:outside:butt:${first}:${second}:${sourceFixture.key}`,
            summary: `dashed outside ${first}/${second} source joins are not geometrically distinct.`,
            fixtureKind: 'self-check-star',
            sourceSegmentId: expectation
              ? `tp-${12 + expectation.previousSegmentIndex}->tp-${12 + expectation.nextSegmentIndex}`
              : undefined,
            sourcePointId: expectation?.vertexId,
            nearestAnchorId: expectation?.vertexId,
            localPoint:
              expectation?.outside.vertex ?? SELF_CHECK_STAR_POINTS[2],
            side: 'join',
            expected: {
              minSignatureDifferences:
                SOURCE_JOIN_MIN_SIGNATURE_DIFFERENCES_FOR_TEST
            },
            actual: { differences },
            recommendedViewport: {
              zoom: 10,
              center: expectation?.outside.vertex ?? SELF_CHECK_STAR_POINTS[2]
            }
          })
        }
        expect(
          differences,
          `dashed:outside:butt:${first}:${second}:${sourceFixture.key}:join-signature`
        ).toBeGreaterThanOrEqual(
          SOURCE_JOIN_MIN_SIGNATURE_DIFFERENCES_FOR_TEST
        )
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
      const packets = buildDashedPacketsForSelfCheckSourceFixture({
        position,
        capType,
        sourceFixture
      })
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
      const legalRegions =
        getSelfCheckLegalRegionsForSourceFixture(sourceFixture)
      const stages = [
        {
          stage: 'packet',
          polygons: packets.flatMap((packet) => packet.geometry.polygons)
        },
        {
          stage: 'final-face',
          polygons: finalFaces.flatMap((face) => face.polygons)
        },
        {
          stage: 'render-entry',
          polygons: renderEntries.flatMap((entry) => entry.polygons)
        }
      ]
      const failures = stages
        .map(({ stage, polygons }) => {
          const outsideResidue = getOutsideLegalResidueForTest(
            polygons,
            legalRegions
          )
          const totalArea = getTotalAbsArea(polygons)
          const outsideResidueArea = getTotalAbsArea(outsideResidue)
          const maxAllowedArea = getGeometryAreaToleranceForTest(totalArea)
          return {
            stage,
            polygons,
            outsideResidue,
            totalArea,
            outsideResidueArea,
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
            totalArea: failure.totalArea
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
            outsideResidue
          }) => ({
            stage,
            outsideResidueArea,
            maxAllowedArea,
            totalArea,
            residuePolygonCount: outsideResidue.length
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
      const polygons = renderEntries.flatMap((entry) => entry.polygons)
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
            polygonCount: polygons.length
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
            entry.runtimeMeta?.sourceTopology !== 'self-intersecting' ||
            entry.runtimeMeta?.visualOverlapCollapseStatus === 'exact-union'
        ),
        `${key}:${sourceFixture.key}:solid-center-exact-union-render-contract`
      ).toBe(true)
      const stagePolygons = [
        {
          stage: 'packet',
          polygons: packets.flatMap((packet) => packet.geometry.polygons)
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
    'should run: dashed canonical matrix case $position $capType preserves open-line terminal cap footprint',
    ({ key, position, capType }) => {
      const packets = buildDashedPacketsForPoints({
        points: OPEN_LINE_POINTS,
        closed: false,
        position,
        capType
      })
      assertPipelineCompleteness({ key: `${key}:open-line-cap`, packets })
      const polygons = packets.flatMap((packet) => packet.geometry.polygons)
      const behindStartCovered = polygonListContainsPoint(polygons, {
        x: -4,
        y: 0
      })
      const squareCornerCovered = polygonListContainsPoint(polygons, {
        x: -4,
        y: 5
      })
      if (capType === 'butt') {
        if (behindStartCovered) {
          recordFailureArtifact({
            errorCode: 'CAP_SHAPE_MISMATCH',
            caseKey: key,
            summary: `${key} butt cap extends behind the open-line terminal.`,
            fixtureKind: 'open-line',
            sourceSegmentId: 'open-line:start->end',
            sourcePointId: 'open-line:start',
            nearestAnchorId: 'open-line:start',
            localPoint: { x: 0, y: 0 },
            t: 0,
            side: 'terminal',
            expected: { backwardExtension: false },
            actual: { backwardExtension: behindStartCovered },
            recommendedViewport: {
              zoom: 10,
              center: { x: 0, y: 0 }
            }
          })
        }
        expect(behindStartCovered, `${key}:butt-start-extension`).toBe(false)
        return
      }
      if (!behindStartCovered) {
        recordFailureArtifact({
          errorCode: 'CAP_EXTENSION_MISSING',
          caseKey: key,
          summary: `${key} ${capType} cap is missing backward terminal extension.`,
          fixtureKind: 'open-line',
          sourceSegmentId: 'open-line:start->end',
          sourcePointId: 'open-line:start',
          nearestAnchorId: 'open-line:start',
          localPoint: { x: 0, y: 0 },
          t: 0,
          side: 'terminal',
          expected: { backwardExtension: true },
          actual: { backwardExtension: behindStartCovered },
          recommendedViewport: {
            zoom: 10,
            center: { x: 0, y: 0 }
          }
        })
      }
      expect(behindStartCovered, `${key}:cap-start-extension`).toBe(true)
      if (capType === 'square') {
        if (!squareCornerCovered) {
          recordFailureArtifact({
            errorCode: 'CAP_SHAPE_MISMATCH',
            caseKey: key,
            summary: `${key} square cap is missing terminal corner footprint.`,
            fixtureKind: 'open-line',
            sourceSegmentId: 'open-line:start->end',
            sourcePointId: 'open-line:start',
            nearestAnchorId: 'open-line:start',
            localPoint: { x: 0, y: 0 },
            t: 0,
            side: 'terminal',
            expected: { squareCorner: true },
            actual: { squareCorner: squareCornerCovered },
            recommendedViewport: {
              zoom: 10,
              center: { x: 0, y: 0 }
            }
          })
        }
        expect(squareCornerCovered, `${key}:square-corner`).toBe(true)
      } else {
        if (squareCornerCovered) {
          recordFailureArtifact({
            errorCode: 'CAP_SHAPE_MISMATCH',
            caseKey: key,
            summary: `${key} round cap has square-like terminal corner footprint.`,
            fixtureKind: 'open-line',
            sourceSegmentId: 'open-line:start->end',
            sourcePointId: 'open-line:start',
            nearestAnchorId: 'open-line:start',
            localPoint: { x: 0, y: 0 },
            t: 0,
            side: 'terminal',
            expected: { squareCorner: false },
            actual: { squareCorner: squareCornerCovered },
            recommendedViewport: {
              zoom: 10,
              center: { x: 0, y: 0 }
            }
          })
        }
        expect(squareCornerCovered, `${key}:round-corner`).toBe(false)
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
            step: 2
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
        const packets = buildDashedPackets({ position, capType })
        assertPipelineCompleteness({
          key: `dashed:${position}:${capType}:cap-signature`,
          packets
        })
        signatures.set(
          capType,
          getCoverageSignature({
            polygons: packets.flatMap((packet) => packet.geometry.polygons),
            centers: [
              ...SELF_CHECK_STAR_POINTS,
              { x: 96, y: 190 },
              { x: 210, y: 190 }
            ],
            radius: 30,
            step: 2
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
