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
import { createDefaultStroke } from '@asyra/utils'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildPolylineGeometryModelPath } from '../components/stroke-render/path-geometry'
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
    | 'CAP_EXTENSION_MISSING'
    | 'CAP_SHAPE_MISMATCH'
    | 'SEGMENT_ENVELOPE_MISMATCH'
    | 'JOIN_SIGNATURE_MISSING'
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
const DASHED_CAPS = ['butt', 'square', 'round'] as const

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

const SELF_CHECK_STAR_POINTS: Vec2[] = [
  { x: 188.1928217922337, y: 0 },
  { x: 11.358174406717296, y: 365.76797704068724 },
  { x: 360.12094148356584, y: 145.95389587539378 },
  { x: 0, y: 15.668954151283657 },
  { x: 270.59180204238254, y: 347.0603956649177 }
]

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

const getSelfIntersectingOptions = (points: Vec2[]) => {
  const sourcePath = buildPolylineGeometryModelPath(points, true)
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
  points = SELF_CHECK_STAR_POINTS,
  closed = true
}: {
  position: StrokePosition
  capType: StrokeCap
  points?: Vec2[]
  closed?: boolean
}) => {
  const stroke = createDefaultStroke({
    style: 'dashed',
    position,
    width: 10,
    joinType: 'round',
    capType,
    dashPattern: [27, 20],
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
    `canonical:dashed:${position}:${capType}`,
    points,
    closed,
    [stroke],
    closed
      ? getSelfIntersectingOptions(points)
      : { constrainedDashedVisualMode: 'product-final' }
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
