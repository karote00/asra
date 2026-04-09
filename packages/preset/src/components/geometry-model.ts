import { Bezier } from 'bezier-js'
import type { GeometryModel, GeometryPoint } from '@asyra/core'
import type {
  VectorAnchorType,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import { StrokeStyles } from '@asyra/utils'
import type { RenderableStroke } from './strokes'

interface Vec2 extends GeometryPoint {}

type PathSegment =
  | {
      type: 'line'
      start: Vec2
      end: Vec2
      length: number
      startAnchorType?: VectorAnchorType
      endAnchorType?: VectorAnchorType
    }
  | {
      type: 'cubic'
      start: Vec2
      control1: Vec2
      control2: Vec2
      end: Vec2
      curve: Bezier
      length: number
      startAnchorType?: VectorAnchorType
      endAnchorType?: VectorAnchorType
    }

export interface PathGeometry {
  segments: PathSegment[]
  closed: boolean
  totalLength: number
  sampledPoints: Vec2[]
}

interface DashedStrokeGeometryContext {
  dash: number
  gap: number
}

interface PathSampleFrame {
  point: Vec2
  tangent: Vec2
  segmentIndex?: number
  joinAnchorType?: VectorAnchorType
  joinSourcePoint?: Vec2
  joinIncomingTangent?: Vec2
  joinOutgoingTangent?: Vec2
}

export interface DashIntervalRecord {
  dashIndex: number
  startDistance: number
  endDistance: number
  intervalLength: number
  touchedSegmentIndices: number[]
  previousDashIndex: number | null
  nextDashIndex: number | null
  previousGapIndex: number | null
  nextGapIndex: number | null
  wrapsSeam: boolean
}

export interface GapIntervalRecord {
  gapIndex: number
  startDistance: number
  endDistance: number
  intervalLength: number
  leadingDashIndex: number | null
  trailingDashIndex: number | null
  wrapsSeam: boolean
}

export interface DashIntervalAllocation {
  totalLength: number
  closed: boolean
  dashLength: number
  gapLength: number
  dashIntervals: DashIntervalRecord[]
  gapIntervals: GapIntervalRecord[]
}

export interface DashedGeometryPhase2Result {
  model: GeometryModel | null
  dashIntervalAllocation: DashIntervalAllocation
  dashCandidates: DashCandidateRecord[]
}

export interface DashedGeometryModelResult extends DashedGeometryPhase2Result {
  model: GeometryModel
}

export interface DashedGeometryConflictAnalysis {
  overlapGraph: OverlapGraph
  conflictComponents: ConflictComponent[]
  atomicRegions: AtomicRegion[]
}

export interface DashedGeometryPhase1Result {
  path: PathGeometry
  stroke: RenderableStroke
  dashContext: {
    dash: number
    gap: number
  }
}

export interface DashedGeometryPhase3Result {
  overlapGraph: OverlapGraph
  conflictComponents: ConflictComponent[]
}

export interface DashedGeometryPhase4Result {
  atomicRegions: AtomicRegion[]
}

export interface AtomicRegionOwnershipRecord {
  regionKey: string
  componentId: number
  zoneId: string
  coverageSet: number[]
  ownerDashIndex: number
  regionPolygon: Vec2[]
  edgeKeys?: string[]
  mergeStable?: boolean
}

export interface AtomicRegionOwnershipDecision {
  regionKey: string
  componentId: number
  zoneId: string
  coverageSet: number[]
  candidateDashIndices: number[]
  ownerDashIndex: number | null
  regionPolygon: Vec2[]
  edgeKeys?: string[]
  status: 'pending' | 'resolved'
}

export interface AtomicRegionOwnershipResolution {
  regionKey: string
  componentId: number
  coverageSet: number[]
  ownerDashIndex: number
}

export interface AtomicRegionOwnerCandidateContext {
  dashIndex: number
  interval: DashIntervalRecord
  centerlinePoints: Vec2[]
  bounds: PolygonBounds | null
}

type AtomicRegionOwnerCandidateContextMap = Map<
  number,
  AtomicRegionOwnerCandidateContext
>

export interface AtomicRegionOwnershipRuleInput {
  regionKey: string
  componentId: number
  zoneId: string
  coverageSet: number[]
  candidateDashIndices: number[]
  ownerDashIndex: number | null
  status: 'pending' | 'resolved'
  regionPolygon: Vec2[]
  candidates: AtomicRegionOwnerCandidateContext[]
}

export interface AtomicRegionOwnershipRuleEvaluation {
  regionKey: string
  componentId: number
  zoneId: string
  coverageSet: number[]
  status: 'resolved' | 'deferred' | 'conflict'
  ownerDashIndex: number | null
  reason: string | null
}

export interface DashedGeometryPhase5RuleEvaluationResult {
  evaluations: AtomicRegionOwnershipRuleEvaluation[]
  resolutions: AtomicRegionOwnershipResolution[]
  resolvedCount: number
  deferredCount: number
  conflictCount: number
}

export interface DashedGeometryPhase5Result {
  decisions: AtomicRegionOwnershipDecision[]
  ownership: AtomicRegionOwnershipRecord[]
  resolvedDecisionCount: number
  pendingDecisionCount: number
}

export interface DashedGeometryPhase6AssemblyInput {
  assemblyMode: 'passthrough-only' | 'resolved-conflict' | 'incomplete-conflict'
  passthroughCandidates: {
    dashIndex: number
    cacheKey: string | null
    polygons: Vec2[][]
  }[]
  passthroughDashIndices: number[]
  passthroughPolygons: Vec2[][]
  ownedRegions: AtomicRegionOwnershipRecord[]
  unresolvedDecisions: AtomicRegionOwnershipDecision[]
  status: 'pending' | 'ready'
}

interface PreparedDashedGeometryPhase6PassthroughCandidates {
  records: {
    dashIndex: number
    cacheKey: string
    polygons: Vec2[][]
  }[]
  dashIndices: number[]
  polygons: Vec2[][]
  preMaterializedCount: number
  baselineStateCount: number
  sourceModelCount: number
}

interface DashedGeometryPhase6AssemblyIdentity {
  assemblyMode: 'passthrough-only' | 'resolved-conflict' | 'incomplete-conflict'
  passthroughCandidates: {
    dashIndex: number
    cacheKey: string | null
  }[]
  ownedRegions: AtomicRegionOwnershipRecord[]
  unresolvedDecisionCount: number
  status: 'pending' | 'ready'
}

export interface DashedGeometryPhase6Result {
  assemblyMode: 'passthrough-only' | 'resolved-conflict'
  finalPolygons: Vec2[][]
  sourcePolygonCount: number
}

export interface DashedGeometryPipelineToPhase4Result {
  phase1: DashedGeometryPhase1Result
  phase2: DashedGeometryPhase2Result
  phase3: DashedGeometryPhase3Result
  phase4: DashedGeometryPhase4Result
}

export interface DashedGeometryPipelineState {
  phase1: DashedGeometryPhase1Result
  phase2: DashedGeometryPhase2Result
  phase3: DashedGeometryPhase3Result
  phase4: DashedGeometryPhase4Result
  phase5: DashedGeometryPhase5Result | null
  phase6: DashedGeometryPhase6Result | null
  completionPhase: 'phase2' | 'phase6' | null
  nextPhase: 'phase5' | 'phase6' | 'complete'
}

export interface ResolvedDashedGeometryForRenderResult {
  status: 'pending' | 'resolved'
  completionPhase: 'phase2' | 'phase6' | null
  pendingPhase: 'phase5' | 'phase6' | null
  model: GeometryModel | null
  pipeline: DashedGeometryPipelineState
}

export interface SelectedDashedGeometryModelForRenderResult {
  status: 'pending' | 'resolved'
  completionPhase: 'phase2' | 'phase6' | null
  pendingPhase: 'phase5' | 'phase6' | null
  model: GeometryModel | null
  pipeline: DashedGeometryPipelineState
}

interface PolygonBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type DashPrimitiveKind = 'body' | 'join' | 'cap'

interface DashPrimitiveRecord {
  id: string
  dashIndex: number
  kind: DashPrimitiveKind
  touchedSegmentIndices: number[]
  polygon: Vec2[]
  bounds: PolygonBounds
  polygonKey: string
}

interface TriangleRecord {
  id: string
  dashIndex: number
  polygon: Vec2[]
  bounds: PolygonBounds
  primitiveId: string
  clipEdges: { start: Vec2; normal: Vec2 }[]
}

interface AtomicCellRecord {
  polygon: Vec2[]
  bounds: PolygonBounds
  polygonKey?: string
}

interface AtomicCoverageFragment extends AtomicCellRecord {
  coverageSet: number[]
}

interface ClipSolveShape {
  dashIndex: number
  polygon: Vec2[]
  bounds: PolygonBounds
  clipEdges: { start: Vec2; normal: Vec2 }[]
  shapeKey?: string
}

interface PreparedClipShapeGroup {
  shapes: ClipSolveShape[]
  bounds: PolygonBounds
}

interface PreparedSourceShapeSolveRecord {
  sourceShape: ClipSolveShape
  clipShapeGroups: PreparedClipShapeGroup[]
}

interface PreparedGeneralZoneSolveRecord
  extends PreparedSourceShapeSolveRecord {
  sourceDashIndex: number
}

interface ClipShapeSpatialIndex {
  bounds: PolygonBounds
  columnCount: number
  rowCount: number
  cellWidth: number
  cellHeight: number
  bucketShapeIndices: Map<string, number[]>
  shapes: ClipSolveShape[]
}

interface PreparedSourceModelResolveContext {
  baselinePolygons: Vec2[][]
  preparedBaselinePolygons: PreparedPointCoveragePolygonRecord[]
  baselineShapes: ClipSolveShape[]
  baselineSpatialIndex: ClipShapeSpatialIndex | null
  outlineAdditionRecords: RenderSourcePolygonRecord[]
  supplementShapeGroups: ClipSolveShape[][]
  relevantBaselineShapeGroups: ClipSolveShape[][][]
  exactResolveMode:
    | 'none'
    | 'supplement-overlap'
    | 'baseline-overlap'
    | 'baseline-and-supplement-overlap'
}

interface PreparedPairwisePrimitiveOverlapZone {
  mode: 'pairwise'
  zoneId: string
  sourceTriangles: TriangleRecord[]
  sourceTrianglesByDashIndex: Map<number, TriangleRecord[]>
  pairwiseSourceShapesByDashIndex: Map<number, ClipSolveShape[]>
  pairwiseClipShapesByDashIndex: Map<number, ClipSolveShape[]>
  zoneBounds: PolygonBounds
}

interface PreparedGeneralPrimitiveOverlapZone {
  mode: 'general'
  zoneId: string
  sourceTriangles: TriangleRecord[]
  sourceTrianglesByDashIndex: Map<number, TriangleRecord[]>
  sourceShapesByDashIndex: Map<number, ClipSolveShape[]>
  solveRecords: PreparedGeneralZoneSolveRecord[]
  zoneBounds: PolygonBounds
}

type PreparedPrimitiveOverlapZone =
  | PreparedPairwisePrimitiveOverlapZone
  | PreparedGeneralPrimitiveOverlapZone

interface PreparedAtomicConflictComponent {
  componentCandidates: DashCandidateRecord[]
  primitiveCount: number
  overlapZones: PreparedPrimitiveOverlapZone[]
  exclusivePrimitives: DashPrimitiveRecord[]
}

interface CachedPreparedAtomicConflictComponent {
  primitiveCount: number
  overlapZones: PreparedPrimitiveOverlapZone[]
  exclusivePrimitives: DashPrimitiveRecord[]
}

interface CachedDashCandidateRenderGeometry {
  polygons: Vec2[][]
  bounds: PolygonBounds | null
}

interface CachedDashCandidateRenderSourceModel {
  baselinePolygons: Vec2[][]
  supplementPolygons: Vec2[][]
  polygons: Vec2[][]
  polygonsMaterialized: boolean
}

interface RenderSourcePolygonRecord {
  polygon: Vec2[]
  bounds: PolygonBounds
  polygonKey: string
  representativePoints: Vec2[]
}

type DashCandidateSourceModelReason = 'primitive-overlap' | 'combined-overlap'

interface PreparedPointCoveragePolygonRecord {
  polygon: Vec2[]
  bounds: PolygonBounds
}

interface PreparedDistinctPrimitivePolygonRecord
  extends PreparedPointCoveragePolygonRecord {
  polygonKey: string
}

interface PreparedDashCandidateSourceGeometry {
  primitives: DashPrimitiveRecord[]
  distinctPrimitivePolygonRecords: PreparedDistinctPrimitivePolygonRecord[]
  renderSourcePolygonRecords: RenderSourcePolygonRecord[]
  normalizedOutlinePolygons: Vec2[][]
}

interface AtomicRegionPreparationDiagnostics {
  componentId: number
  dashCount: number
  primitiveCount: number
  contestedPrimitiveCount: number
  triangleCount: number
  overlapZoneCount: number
  zonedTriangleCount: number
  exclusivePrimitiveCount: number
  maxZoneTriangleCount: number
  maxZoneClipTriangleCount: number
}

export interface DashCandidateRecord {
  dashIndex: number
  interval: DashIntervalRecord
  centerlinePoints: Vec2[]
  primitives: DashPrimitiveRecord[]
  assemblyCacheKey?: string
  renderGeometryCacheKey?: string
  renderSourcePolygons?: Vec2[][]
  renderSourcePolygonRecords?: RenderSourcePolygonRecord[]
  solvePrimitivePolygonRecords?: PreparedDistinctPrimitivePolygonRecord[]
  passthroughRenderPolygons?: Vec2[][]
  passthroughRenderPolygonsSafe?: boolean
  renderBaselinePolygons?: Vec2[][]
  renderSupplementPolygons?: Vec2[][]
  polygonsMaterialized?: boolean
  sourceModelReason?: DashCandidateSourceModelReason
  polygons: Vec2[][]
  bounds: PolygonBounds | null
}

export interface OverlapGraphEdge {
  dashIndexA: number
  dashIndexB: number
}

export interface OverlapGraph {
  candidateCount: number
  edges: OverlapGraphEdge[]
}

export interface ConflictComponent {
  dashIndices: number[]
}

export interface AtomicRegion {
  regionKey: string
  componentId: number
  zoneId: string
  regionPolygon: Vec2[]
  bounds: PolygonBounds
  coverageSet: number[]
  edgeKeys?: string[]
  mergeStable?: boolean
}

interface DashInterval {
  startDistance: number
  endDistance: number
}

interface DashSubpathGeometry {
  sourceFrames: PathSampleFrame[]
  sourcePoints: Vec2[]
  centerlineFrames: PathSampleFrame[]
  centerlinePoints: Vec2[]
  fallbackCenterlinePoints: Vec2[] | null
  centerlineOffset: number
  startTangent: Vec2
  endTangent: Vec2
}

interface StrokePrimitivePolygon {
  kind: DashPrimitiveKind
  touchedSegmentIndices: number[]
  polygon: Vec2[]
}

interface StrokeOutlineSimplifyOptions {
  profile?: 'primary' | 'fallback'
}

interface StrokeCapBoundarySource {
  centerlinePoints: Vec2[]
  outerBoundary: Vec2[]
  innerBoundary: Vec2[]
}

interface StrokePieceCapOptions {
  start: boolean
  end: boolean
}

const subpathHasSharpJoin = (frames: PathSampleFrame[]) =>
  frames.some(
    (frame, index) =>
      index > 0 && index < frames.length - 1 && frame.joinAnchorType === 'sharp'
  )

const MAX_TRIANGULATION_CACHE_ENTRIES = 2048
const MAX_PREPARED_CONFLICT_COMPONENT_CACHE_ENTRIES = 128
const MAX_DASH_CANDIDATE_RENDER_GEOMETRY_CACHE_ENTRIES = 512
const MAX_PHASE6_RESULT_CACHE_ENTRIES = 128
const MAX_DASHED_GEOMETRY_PIPELINE_STATE_CACHE_ENTRIES = 128

const createDashedGeometryPhase2ScopeKey = (
  path: PathGeometry,
  stroke: RenderableStroke
) =>
  [
    path.closed ? 'closed' : 'open',
    path.totalLength.toFixed(4),
    path.sampledPoints.length,
    path.segments.length,
    stroke.style,
    stroke.position,
    stroke.width.toFixed(4),
    stroke.dash?.toFixed(4) ?? 'n',
    stroke.gap?.toFixed(4) ?? 'n',
    stroke.join ?? 'n',
    stroke.cap ?? 'n',
    stroke.join === 'miter' ? (stroke.miterLimit?.toFixed(4) ?? 'n') : 'na'
  ].join('|')

const triangulatedPolygonCache = new Map<string, Vec2[][]>()
const preparedAtomicConflictComponentCache = new Map<
  string,
  CachedPreparedAtomicConflictComponent
>()
const dashCandidateRenderGeometryCache = new Map<
  string,
  CachedDashCandidateRenderGeometry
>()
const dashCandidateRenderSourceModelCache = new Map<
  string,
  CachedDashCandidateRenderSourceModel
>()
const dashedGeometryPhase6ResultCache = new Map<
  string,
  DashedGeometryPhase6Result
>()
const dashedGeometryPipelineStateCache = new Map<
  string,
  DashedGeometryPipelineState
>()

const setCachedValueWithLimit = <T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries: number
) => {
  if (cache.has(key)) {
    cache.delete(key)
  }
  cache.set(key, value)

  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (typeof oldestKey !== 'string') {
      break
    }
    cache.delete(oldestKey)
  }

  return value
}

const EPS = 1e-6
const DASH_LENGTH_FACTOR = 4
const DASH_GAP_FACTOR = 2
const MIN_DASH_LENGTH = 0.1
const CURVE_TESSELLATION_TOLERANCE = 0.5
const MAX_DASH_CANDIDATE_RENDER_SOURCE_MODEL_CACHE_ENTRIES = 512

const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const samePoint = (a: Vec2, b: Vec2, tolerance = EPS) =>
  distance(a, b) <= tolerance

const dedupeAdjacentPoints = (points: Vec2[]) => {
  if (points.length <= 1) {
    return [...points]
  }

  const result = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    if (distance(result[result.length - 1], points[i]) > EPS) {
      result.push(points[i])
    }
  }
  return result
}

const dedupeClosedPolygonPoints = (points: Vec2[]) => {
  const deduped = dedupeAdjacentPoints(points)
  if (
    deduped.length > 2 &&
    distance(deduped[0], deduped[deduped.length - 1]) <= EPS
  ) {
    deduped.pop()
  }
  return deduped
}

const polygonArea = (points: Vec2[]): number => {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length]
    area += points[index].x * next.y - next.x * points[index].y
  }

  return area / 2
}

const getPolygonBounds = (polygon: Vec2[]): PolygonBounds | null => {
  if (polygon.length === 0) {
    return null
  }

  let minX = polygon[0].x
  let minY = polygon[0].y
  let maxX = polygon[0].x
  let maxY = polygon[0].y

  polygon.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  return { minX, minY, maxX, maxY }
}

const mergeBounds = (
  left: PolygonBounds | null,
  right: PolygonBounds | null
): PolygonBounds | null => {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }

  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY)
  }
}

const boundsOverlap = (left: PolygonBounds, right: PolygonBounds) =>
  left.maxX > right.minX + EPS &&
  right.maxX > left.minX + EPS &&
  left.maxY > right.minY + EPS &&
  right.maxY > left.minY + EPS

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= EPS) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const getSegmentStartTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalizeVector({
      x: segment.control1.x - segment.start.x,
      y: segment.control1.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.control2.x - segment.start.x,
      y: segment.control2.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const getSegmentEndTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalizeVector({
      x: segment.end.x - segment.control2.x,
      y: segment.end.y - segment.control2.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.control1.x,
      y: segment.end.y - segment.control1.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const mergePointLists = (head: Vec2[], tail: Vec2[]) => {
  if (head.length === 0) {
    return [...tail]
  }
  if (tail.length === 0) {
    return [...head]
  }

  if (samePoint(head[head.length - 1], tail[0])) {
    return [...head, ...tail.slice(1)]
  }

  return [...head, ...tail]
}

const dedupeAdjacentFrames = (frames: PathSampleFrame[]) => {
  if (frames.length <= 1) {
    return [...frames]
  }

  const result: PathSampleFrame[] = [{ ...frames[0] }]
  for (let index = 1; index < frames.length; index += 1) {
    if (distance(result[result.length - 1].point, frames[index].point) > EPS) {
      result.push({ ...frames[index] })
      continue
    }

    result[result.length - 1] = {
      ...result[result.length - 1],
      point: result[result.length - 1].point,
      tangent: frames[index].tangent,
      segmentIndex:
        result[result.length - 1].segmentIndex ?? frames[index].segmentIndex,
      joinAnchorType:
        result[result.length - 1].joinAnchorType ??
        frames[index].joinAnchorType,
      joinSourcePoint:
        result[result.length - 1].joinSourcePoint ??
        frames[index].joinSourcePoint,
      joinIncomingTangent:
        result[result.length - 1].joinIncomingTangent ??
        frames[index].joinIncomingTangent,
      joinOutgoingTangent:
        result[result.length - 1].joinOutgoingTangent ??
        frames[index].joinOutgoingTangent
    }
  }

  return result
}

const mergeFrameLists = (head: PathSampleFrame[], tail: PathSampleFrame[]) => {
  if (head.length === 0) {
    return dedupeAdjacentFrames(tail)
  }
  if (tail.length === 0) {
    return dedupeAdjacentFrames(head)
  }

  const merged = samePoint(head[head.length - 1].point, tail[0].point)
    ? [...head, ...tail.slice(1)]
    : [...head, ...tail]

  return dedupeAdjacentFrames(merged)
}

const simplifyFramesForStrokeOutline = (
  frames: PathSampleFrame[],
  strokeWidth: number,
  options: StrokeOutlineSimplifyOptions = {}
) => {
  if (frames.length <= 2) {
    return [...frames]
  }

  const profile = options.profile ?? 'fallback'
  const minSpacing =
    profile === 'primary'
      ? Math.max(0.5, strokeWidth * 0.2)
      : Math.max(1, strokeWidth * 0.55)
  const maxDirectionDot =
    profile === 'primary' ? Math.cos(Math.PI / 18) : Math.cos(Math.PI / 9)
  const protectedDistance =
    profile === 'primary'
      ? Math.max(6, strokeWidth * 1.25)
      : Math.max(4, strokeWidth * 0.75)
  const deviationThreshold =
    profile === 'primary'
      ? Math.max(0.25, strokeWidth * 0.03)
      : Math.max(0.5, strokeWidth * 0.08)
  const cumulativeDistances = [0]

  for (let index = 1; index < frames.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        distance(frames[index - 1].point, frames[index].point)
    )
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1]
  const simplified: PathSampleFrame[] = [{ ...frames[0] }]
  const protectedIndices = new Set<number>([0, frames.length - 1])
  const sharpNeighborhoodDistance =
    profile === 'primary'
      ? Math.max(strokeWidth * 1.25, 8)
      : Math.max(strokeWidth * 0.75, 4)

  frames.forEach((frame, index) => {
    if (frame.joinAnchorType !== 'sharp') {
      return
    }

    const sharpDistance = cumulativeDistances[index]
    for (let candidate = 0; candidate < frames.length; candidate += 1) {
      if (
        Math.abs(cumulativeDistances[candidate] - sharpDistance) <=
        sharpNeighborhoodDistance
      ) {
        protectedIndices.add(candidate)
      }
    }
  })

  for (let index = 1; index < frames.length - 1; index += 1) {
    const lastKept = simplified[simplified.length - 1]
    const current = frames[index]
    const next = frames[index + 1]

    if (protectedIndices.has(index)) {
      simplified.push({ ...current })
      continue
    }

    const distanceFromLastKept = distance(lastKept.point, current.point)
    const tangentDot = dotVec2(lastKept.tangent, current.tangent)
    const nextTangentDot = dotVec2(current.tangent, next.tangent)
    const distanceFromStart = cumulativeDistances[index]
    const distanceToEnd = totalLength - cumulativeDistances[index]
    const chord = subtractVec2(next.point, lastKept.point)
    const chordLength = Math.hypot(chord.x, chord.y)
    const deviation =
      chordLength <= EPS
        ? 0
        : Math.abs(
            orientation(lastKept.point, next.point, current.point) / chordLength
          )

    if (
      distanceFromStart > protectedDistance &&
      distanceToEnd > protectedDistance &&
      distanceFromLastKept < minSpacing &&
      tangentDot >= maxDirectionDot &&
      nextTangentDot >= maxDirectionDot &&
      deviation <= deviationThreshold
    ) {
      continue
    }

    simplified.push({ ...current })
  }

  simplified.push({ ...frames[frames.length - 1] })
  return dedupeAdjacentFrames(simplified)
}

const collapseSharpNeighborhoodFramesForOutline = (
  frames: PathSampleFrame[],
  strokeWidth: number
) => {
  if (frames.length <= 2 || !subpathHasSharpJoin(frames)) {
    return frames.map((frame) => ({ ...frame }))
  }

  const cumulativeDistances = [0]
  for (let index = 1; index < frames.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        distance(frames[index - 1].point, frames[index].point)
    )
  }

  const lastIndex = frames.length - 1
  const neighborhoodDistance = Math.max(strokeWidth * 0.9, 4)
  const keepIndices = new Set<number>([0, lastIndex])
  const removedIndices = new Set<number>()

  frames.forEach((frame, index) => {
    if (frame.joinAnchorType !== 'sharp') {
      return
    }

    keepIndices.add(index)

    let previousRepresentative = Math.max(0, index - 1)
    while (
      previousRepresentative > 0 &&
      cumulativeDistances[index] - cumulativeDistances[previousRepresentative] <
        neighborhoodDistance
    ) {
      previousRepresentative -= 1
    }

    let nextRepresentative = Math.min(lastIndex, index + 1)
    while (
      nextRepresentative < lastIndex &&
      cumulativeDistances[nextRepresentative] - cumulativeDistances[index] <
        neighborhoodDistance
    ) {
      nextRepresentative += 1
    }

    keepIndices.add(previousRepresentative)
    keepIndices.add(nextRepresentative)

    for (
      let candidate = previousRepresentative + 1;
      candidate < index;
      candidate += 1
    ) {
      removedIndices.add(candidate)
    }
    for (
      let candidate = index + 1;
      candidate < nextRepresentative;
      candidate += 1
    ) {
      removedIndices.add(candidate)
    }
  })

  return frames
    .filter((_, index) => keepIndices.has(index) || !removedIndices.has(index))
    .map((frame) => ({ ...frame }))
}

const toBezier = (segment: Extract<PathSegment, { type: 'cubic' }>) =>
  segment.curve

const getCurveLengthAtT = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= EPS) {
    return 0
  }
  if (t >= 1 - EPS) {
    return segment.length
  }

  return toBezier(segment).split(0, t).length()
}

const getCurveTAtLength = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= EPS) {
    return 0
  }
  if (targetLength >= segment.length - EPS) {
    return 1
  }

  let low = 0
  let high = 1
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2
    if (getCurveLengthAtT(segment, mid) < targetLength) {
      low = mid
    } else {
      high = mid
    }
  }
  return (low + high) / 2
}

const getAnchorNode = (
  points: Record<string, VectorPointNode>,
  pointId: string | undefined
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'anchor') {
    return null
  }
  return point
}

const getControlNode = (
  points: Record<string, VectorPointNode>,
  pointId?: string | null
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'control') {
    return null
  }
  return point
}

const getDashPattern = (
  stroke: Pick<RenderableStroke, 'width' | 'dash' | 'gap'>
) => {
  const base = Math.max(1, stroke.width)
  return {
    dash: Math.max(
      MIN_DASH_LENGTH,
      Number.isFinite(stroke.dash) ? stroke.dash : base * DASH_LENGTH_FACTOR
    ),
    gap: Math.max(
      MIN_DASH_LENGTH,
      Number.isFinite(stroke.gap) ? stroke.gap : base * DASH_GAP_FACTOR
    )
  }
}

const createDashedStrokeGeometryContext = (
  stroke: RenderableStroke
): DashedStrokeGeometryContext => {
  const { dash, gap } = getDashPattern(stroke)

  return {
    dash,
    gap
  }
}

const buildDashedStrokeIntervals = (
  path: PathGeometry,
  context: Pick<DashedStrokeGeometryContext, 'dash' | 'gap'>
) =>
  buildDashIntervals(
    path.totalLength,
    context.dash,
    context.gap,
    path.closed,
    0
  )

const sampleLineSegmentFrames = (
  segment: Extract<PathSegment, { type: 'line' }>,
  startLength: number,
  endLength: number
): PathSampleFrame[] => {
  const total = Math.max(EPS, segment.length)
  const t0 = Math.max(0, Math.min(1, startLength / total))
  const t1 = Math.max(0, Math.min(1, endLength / total))
  const tangent = normalizeVector({
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y
  }) ?? { x: 1, y: 0 }

  return dedupeAdjacentPoints([
    {
      x: segment.start.x + (segment.end.x - segment.start.x) * t0,
      y: segment.start.y + (segment.end.y - segment.start.y) * t0
    },
    {
      x: segment.start.x + (segment.end.x - segment.start.x) * t1,
      y: segment.start.y + (segment.end.y - segment.start.y) * t1
    }
  ]).map((point) => ({
    point,
    tangent
  }))
}

const sampleCubicSegmentFrames = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  startLength: number,
  endLength: number,
  tolerance: number
): PathSampleFrame[] => {
  const t0 = getCurveTAtLength(segment, startLength)
  const t1 = getCurveTAtLength(segment, endLength)
  const splitCurve = toBezier(segment).split(t0, t1)
  const sampleCount = Math.max(
    8,
    Math.min(256, Math.ceil(splitCurve.length() / Math.max(0.2, tolerance)))
  )
  const frames: PathSampleFrame[] = []

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount
    const point = splitCurve.get(t) as { x: number; y: number }
    const derivative = splitCurve.derivative(t) as { x: number; y: number }
    const tangent = normalizeVector({
      x: derivative.x,
      y: derivative.y
    }) ??
      (index > 0 ? (frames[index - 1]?.tangent ?? null) : null) ?? {
        x: 1,
        y: 0
      }

    frames.push({
      point: { x: point.x, y: point.y },
      tangent
    })
  }

  const fallbackStartTangent = frames.find((frame) => frame.tangent)?.tangent ??
    getSegmentStartTangent(segment) ?? { x: 1, y: 0 }

  for (let index = 0; index < frames.length; index += 1) {
    if (!frames[index].tangent) {
      frames[index] = {
        point: frames[index].point,
        tangent:
          (index > 0 ? (frames[index - 1]?.tangent ?? null) : null) ??
          fallbackStartTangent
      }
    }
  }

  return frames
}

const slicePathSegmentFrames = (
  segment: PathSegment,
  startLength: number,
  endLength: number,
  tolerance: number
): PathSampleFrame[] => {
  if (endLength - startLength <= EPS) {
    return []
  }

  return segment.type === 'line'
    ? sampleLineSegmentFrames(segment, startLength, endLength)
    : sampleCubicSegmentFrames(segment, startLength, endLength, tolerance)
}

const samplePathSegment = (segment: PathSegment, tolerance: number): Vec2[] =>
  slicePathSegmentFrames(segment, 0, segment.length, tolerance).map(
    (frame) => frame.point
  )

const samplePathIntervalFramesNoWrap = (
  path: PathGeometry,
  startDistance: number,
  endDistance: number,
  tolerance: number
): PathSampleFrame[] => {
  let cursor = 0
  let frames: PathSampleFrame[] = []

  for (const [segmentIndex, segment] of path.segments.entries()) {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.length
    cursor = segmentEnd

    if (
      segmentEnd <= startDistance + EPS ||
      segmentStart >= endDistance - EPS
    ) {
      continue
    }

    const localStart = Math.max(0, startDistance - segmentStart)
    const localEnd = Math.min(segment.length, endDistance - segmentStart)
    const segmentFrames = slicePathSegmentFrames(
      segment,
      localStart,
      localEnd,
      tolerance
    ).map((frame) => ({
      ...frame,
      segmentIndex
    }))
    if (
      segmentFrames.length > 0 &&
      Math.abs(localEnd - segment.length) <= EPS &&
      segment.endAnchorType
    ) {
      const nextSegment =
        segmentIndex + 1 < path.segments.length
          ? path.segments[segmentIndex + 1]
          : path.closed
            ? path.segments[0]
            : null
      segmentFrames[segmentFrames.length - 1] = {
        ...segmentFrames[segmentFrames.length - 1],
        joinAnchorType: segment.endAnchorType,
        joinSourcePoint: { ...segment.end },
        joinIncomingTangent:
          getSegmentEndTangent(segment) ??
          segmentFrames[segmentFrames.length - 1].tangent,
        joinOutgoingTangent:
          (nextSegment ? getSegmentStartTangent(nextSegment) : null) ??
          segmentFrames[segmentFrames.length - 1].tangent
      }
    }

    frames = mergeFrameLists(frames, segmentFrames)
  }

  return dedupeAdjacentFrames(frames)
}

const samplePathIntervalFrames = (
  path: PathGeometry,
  startDistance: number,
  endDistance: number,
  tolerance: number
): PathSampleFrame[] => {
  if (endDistance - startDistance <= EPS || path.totalLength <= EPS) {
    return []
  }

  if (!path.closed) {
    return samplePathIntervalFramesNoWrap(
      path,
      Math.max(0, startDistance),
      Math.min(path.totalLength, endDistance),
      tolerance
    )
  }

  const normalizedStart =
    ((startDistance % path.totalLength) + path.totalLength) % path.totalLength
  const normalizedEnd = normalizedStart + (endDistance - startDistance)

  if (normalizedEnd <= path.totalLength + EPS) {
    return samplePathIntervalFramesNoWrap(
      path,
      normalizedStart,
      Math.min(path.totalLength, normalizedEnd),
      tolerance
    )
  }

  return mergeFrameLists(
    samplePathIntervalFramesNoWrap(
      path,
      normalizedStart,
      path.totalLength,
      tolerance
    ),
    samplePathIntervalFramesNoWrap(
      path,
      0,
      normalizedEnd - path.totalLength,
      tolerance
    )
  )
}

const dotVec2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

const addVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y
})

const subtractVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y
})

const scaleVec2 = (point: Vec2, scalar: number): Vec2 => ({
  x: point.x * scalar,
  y: point.y * scalar
})

const createUnitLeftNormal = (from: Vec2, to: Vec2): Vec2 | null => {
  const delta = subtractVec2(to, from)
  const length = Math.hypot(delta.x, delta.y)
  if (length <= EPS) {
    return null
  }

  return {
    x: -delta.y / length,
    y: delta.x / length
  }
}

const createLeftNormalFromTangent = (tangent: Vec2): Vec2 | null =>
  normalizeVector({
    x: -tangent.y,
    y: tangent.x
  })

const intersectLines = (
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2
): Vec2 | null => {
  const ax = a2.x - a1.x
  const ay = a2.y - a1.y
  const bx = b2.x - b1.x
  const by = b2.y - b1.y
  const denominator = ax * by - ay * bx
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const cx = b1.x - a1.x
  const cy = b1.y - a1.y
  const t = (cx * by - cy * bx) / denominator

  return {
    x: a1.x + ax * t,
    y: a1.y + ay * t
  }
}

interface ShiftedSegment {
  start: Vec2
  end: Vec2
  direction: Vec2
  leftNormal: Vec2
}

const createShiftedSegment = (
  from: Vec2,
  to: Vec2,
  signedDistance: number
): ShiftedSegment | null => {
  const normal = createUnitLeftNormal(from, to)
  if (!normal) {
    return null
  }

  const shift = scaleVec2(normal, signedDistance)
  const delta = subtractVec2(to, from)
  const length = Math.hypot(delta.x, delta.y)
  if (length <= EPS) {
    return null
  }

  return {
    start: addVec2(from, shift),
    end: addVec2(to, shift),
    direction: {
      x: delta.x / length,
      y: delta.y / length
    },
    leftNormal: normal
  }
}

const getJoinedOffsetPoint = (
  previous: ShiftedSegment | null,
  next: ShiftedSegment | null,
  originalPoint: Vec2
) => {
  if (!previous && !next) {
    return originalPoint
  }
  if (!previous) {
    return next?.start ?? originalPoint
  }
  if (!next) {
    return previous.end
  }

  const intersection = intersectLines(
    previous.start,
    previous.end,
    next.start,
    next.end
  )
  if (!intersection) {
    return scaleVec2(addVec2(previous.end, next.start), 0.5)
  }

  const cosine = dotVec2(previous.direction, next.direction)
  if (cosine > 0.87) {
    return intersection
  }

  const previousBackward = dotVec2(
    subtractVec2(previous.end, intersection),
    previous.direction
  )
  const nextForward = dotVec2(
    subtractVec2(intersection, next.start),
    next.direction
  )

  if (previousBackward >= -EPS && nextForward >= -EPS) {
    return intersection
  }

  return scaleVec2(addVec2(previous.end, next.start), 0.5)
}

const offsetPolyline = (
  points: Vec2[],
  signedDistance: number,
  closed: boolean
): Vec2[] => {
  if (points.length < 2 || Math.abs(signedDistance) <= EPS) {
    return closed ? dedupeClosedPolygonPoints(points) : [...points]
  }

  const normalized = closed ? dedupeClosedPolygonPoints(points) : [...points]
  if (normalized.length < 2) {
    return normalized
  }

  const segments = normalized.map((point, index) => {
    const nextIndex = index + 1
    if (nextIndex >= normalized.length) {
      if (!closed) {
        return null
      }

      return createShiftedSegment(
        normalized[index],
        normalized[(index + 1) % normalized.length],
        signedDistance
      )
    }

    return createShiftedSegment(point, normalized[nextIndex], signedDistance)
  })

  if (closed) {
    return normalized.map((point, index) =>
      getJoinedOffsetPoint(
        segments[(index - 1 + normalized.length) % normalized.length],
        segments[index],
        point
      )
    )
  }

  const offsetPoints: Vec2[] = []
  offsetPoints.push(segments[0]?.start ?? normalized[0])

  for (let index = 1; index < normalized.length - 1; index += 1) {
    offsetPoints.push(
      getJoinedOffsetPoint(
        segments[index - 1],
        segments[index],
        normalized[index]
      )
    )
  }

  offsetPoints.push(
    segments[normalized.length - 2]?.end ?? normalized[normalized.length - 1]
  )
  return dedupeAdjacentPoints(offsetPoints)
}

const offsetFrames = (
  frames: PathSampleFrame[],
  signedDistance: number
): PathSampleFrame[] => {
  if (frames.length === 0 || Math.abs(signedDistance) <= EPS) {
    return frames.map((frame) => ({
      ...frame,
      point: { ...frame.point },
      tangent: { ...frame.tangent }
    }))
  }

  return dedupeAdjacentFrames(
    frames.map((frame) => {
      if (
        frame.joinAnchorType === 'sharp' &&
        frame.joinIncomingTangent &&
        frame.joinOutgoingTangent
      ) {
        const referenceLength = Math.max(Math.abs(signedDistance) * 2, 1)
        const previousSourceStart = subtractVec2(
          frame.point,
          scaleVec2(frame.joinIncomingTangent, referenceLength)
        )
        const nextSourceEnd = addVec2(
          frame.point,
          scaleVec2(frame.joinOutgoingTangent, referenceLength)
        )
        const previous = createShiftedSegment(
          previousSourceStart,
          frame.point,
          signedDistance
        )
        const next = createShiftedSegment(
          frame.point,
          nextSourceEnd,
          signedDistance
        )

        if (previous && next) {
          const intersection = intersectLines(
            previous.start,
            previous.end,
            next.start,
            next.end
          )
          return {
            ...frame,
            point:
              intersection ?? scaleVec2(addVec2(previous.end, next.start), 0.5),
            tangent: frame.tangent
          }
        }
      }

      const normal = createLeftNormalFromTangent(frame.tangent) ?? {
        x: 0,
        y: 0
      }
      return {
        ...frame,
        point: addVec2(frame.point, scaleVec2(normal, signedDistance)),
        tangent: frame.tangent
      }
    })
  )
}

const getArcPointTangent = (angle: number, clockwise: boolean): Vec2 =>
  clockwise
    ? {
        x: Math.sin(angle),
        y: -Math.cos(angle)
      }
    : {
        x: -Math.sin(angle),
        y: Math.cos(angle)
      }

const buildSharpOffsetCenterlineFrames = (
  frame: PathSampleFrame,
  previousFrame: PathSampleFrame,
  nextFrame: PathSampleFrame,
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>
): PathSampleFrame[] | null => {
  if (
    frame.joinAnchorType !== 'sharp' ||
    !frame.joinIncomingTangent ||
    !frame.joinOutgoingTangent
  ) {
    return null
  }

  const previousReferenceLength = Math.max(
    distance(previousFrame.point, frame.point),
    Math.abs(signedDistance) * 2,
    1
  )
  const nextReferenceLength = Math.max(
    distance(frame.point, nextFrame.point),
    Math.abs(signedDistance) * 2,
    1
  )
  const previousSourceStart = subtractVec2(
    frame.point,
    scaleVec2(frame.joinIncomingTangent, previousReferenceLength)
  )
  const nextSourceEnd = addVec2(
    frame.point,
    scaleVec2(frame.joinOutgoingTangent, nextReferenceLength)
  )
  const previous = createShiftedSegment(
    previousSourceStart,
    frame.point,
    signedDistance
  )
  const next = createShiftedSegment(frame.point, nextSourceEnd, signedDistance)
  if (!previous || !next) {
    return null
  }

  const turn =
    previous.direction.x * next.direction.y -
    previous.direction.y * next.direction.x
  const outerTurn = turn * signedDistance > EPS
  const intersection = intersectLines(
    previous.start,
    previous.end,
    next.start,
    next.end
  )
  const previousBackward = intersection
    ? dotVec2(subtractVec2(previous.end, intersection), previous.direction)
    : -Infinity
  const nextForward = intersection
    ? dotVec2(subtractVec2(intersection, next.start), next.direction)
    : -Infinity
  const validIntersection =
    intersection !== null && previousBackward >= -EPS && nextForward >= -EPS

  if (outerTurn && stroke.join === 'round') {
    const clockwise = signedDistance < 0
    const startAngle = Math.atan2(
      previous.end.y - frame.point.y,
      previous.end.x - frame.point.x
    )
    const endAngle = Math.atan2(
      next.start.y - frame.point.y,
      next.start.x - frame.point.x
    )
    const arcPoints = [previous.end].concat(
      buildArcPoints(
        frame.point,
        startAngle,
        endAngle,
        Math.abs(signedDistance),
        clockwise
      )
    )
    const metadataIndex = Math.floor(arcPoints.length / 2)

    return arcPoints.map((point, index) => {
      const angle = Math.atan2(point.y - frame.point.y, point.x - frame.point.x)
      return {
        point,
        tangent:
          index === 0
            ? previous.direction
            : index === arcPoints.length - 1
              ? next.direction
              : getArcPointTangent(angle, clockwise),
        segmentIndex:
          frame.segmentIndex ??
          (index < metadataIndex
            ? previousFrame.segmentIndex
            : nextFrame.segmentIndex),
        ...(index === metadataIndex
          ? {
              joinAnchorType: frame.joinAnchorType,
              joinSourcePoint: frame.joinSourcePoint,
              joinIncomingTangent: frame.joinIncomingTangent,
              joinOutgoingTangent: frame.joinOutgoingTangent
            }
          : {})
      }
    })
  }

  if (outerTurn && stroke.join === 'bevel') {
    return [
      {
        ...frame,
        point: previous.end,
        tangent: previous.direction
      },
      {
        ...frame,
        point: next.start,
        tangent: next.direction
      }
    ]
  }

  if (outerTurn && stroke.join === 'miter' && validIntersection) {
    const miterLength = distance(intersection, frame.point)
    const miterLimitDistance = Math.abs(signedDistance) * stroke.miterLimit
    if (miterLength <= miterLimitDistance + EPS) {
      return [
        {
          ...frame,
          point: intersection,
          tangent:
            normalizeVector(addVec2(previous.direction, next.direction)) ??
            frame.tangent
        }
      ]
    }
  }

  if (validIntersection) {
    return [
      {
        ...frame,
        point: intersection,
        tangent:
          normalizeVector(addVec2(previous.direction, next.direction)) ??
          frame.tangent
      }
    ]
  }

  return null
}

const offsetFramesForStrokeCenterline = (
  frames: PathSampleFrame[],
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>
): PathSampleFrame[] => {
  if (frames.length === 0 || Math.abs(signedDistance) <= EPS) {
    return offsetFrames(frames, signedDistance)
  }

  return dedupeAdjacentFrames(
    frames.flatMap((frame, index) => {
      if (index > 0 && index < frames.length - 1) {
        const sharpFrames = buildSharpOffsetCenterlineFrames(
          frame,
          frames[index - 1],
          frames[index + 1],
          signedDistance,
          stroke
        )
        if (sharpFrames) {
          return sharpFrames
        }
      }

      return offsetFrames([frame], signedDistance)
    })
  )
}

const getStrokeCenterlineOffset = (
  path: PathGeometry,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  if (!path.closed) {
    return 0
  }

  if (stroke.position === 'center') {
    return 0
  }

  const normalized = dedupeClosedPolygonPoints(path.sampledPoints)
  if (normalized.length < 3) {
    return 0
  }

  const orientation = polygonArea(normalized) >= 0 ? 1 : -1
  const halfWidth = stroke.width / 2

  return stroke.position === 'inside'
    ? halfWidth * orientation
    : -halfWidth * orientation
}

const pointOnSegment = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
  tolerance = EPS
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= tolerance * tolerance) {
    return distance(point, start) <= tolerance
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  if (t < -tolerance || t > 1 + tolerance) {
    return false
  }

  const projected = {
    x: start.x + dx * Math.max(0, Math.min(1, t)),
    y: start.y + dy * Math.max(0, Math.min(1, t))
  }
  return distance(point, projected) <= tolerance
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const current = polygon[index]
    const prior = polygon[previous]

    if (pointOnSegment(point, prior, current)) {
      return true
    }

    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const orientation = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const segmentsTouchOrIntersect = (a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) => {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (
    ((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
    ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))
  ) {
    return true
  }

  return (
    (Math.abs(o1) <= EPS && pointOnSegment(b1, a1, a2)) ||
    (Math.abs(o2) <= EPS && pointOnSegment(b2, a1, a2)) ||
    (Math.abs(o3) <= EPS && pointOnSegment(a1, b1, b2)) ||
    (Math.abs(o4) <= EPS && pointOnSegment(a2, b1, b2))
  )
}

const isSimplePolygon = (polygon: Vec2[]) => {
  if (polygon.length < 3) {
    return false
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const aStart = polygon[index]
    const aEnd = polygon[(index + 1) % polygon.length]
    for (let other = index + 1; other < polygon.length; other += 1) {
      const bStart = polygon[other]
      const bEnd = polygon[(other + 1) % polygon.length]
      const areAdjacent =
        other === index ||
        (other + 1) % polygon.length === index ||
        (index + 1) % polygon.length === other
      if (areAdjacent) {
        continue
      }

      if (segmentsTouchOrIntersect(aStart, aEnd, bStart, bEnd)) {
        return false
      }
    }
  }

  return true
}

const polygonsOverlapAssumingBoundsOverlap = (left: Vec2[], right: Vec2[]) => {
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex]
    const leftEnd = left[(leftIndex + 1) % left.length]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex]
      const rightEnd = right[(rightIndex + 1) % right.length]
      if (segmentsTouchOrIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true
      }
    }
  }

  return pointInPolygon(left[0], right) || pointInPolygon(right[0], left)
}

const polygonsOverlap = (left: Vec2[], right: Vec2[]) => {
  const leftBounds = getPolygonBounds(left)
  const rightBounds = getPolygonBounds(right)
  if (!leftBounds || !rightBounds || !boundsOverlap(leftBounds, rightBounds)) {
    return false
  }

  return polygonsOverlapAssumingBoundsOverlap(left, right)
}

const dashCandidatesOverlap = (
  left: DashCandidateRecord,
  right: DashCandidateRecord
) => {
  if (
    !left.bounds ||
    !right.bounds ||
    !boundsOverlap(left.bounds, right.bounds)
  ) {
    return false
  }

  return left.primitives.some((leftPrimitive) =>
    right.primitives.some(
      (rightPrimitive) =>
        boundsOverlap(leftPrimitive.bounds, rightPrimitive.bounds) &&
        polygonsOverlapAssumingBoundsOverlap(
          leftPrimitive.polygon,
          rightPrimitive.polygon
        )
    )
  )
}

const buildOverlapGraph = (
  dashCandidates: DashCandidateRecord[]
): OverlapGraph => {
  const edges: OverlapGraphEdge[] = []

  for (let leftIndex = 0; leftIndex < dashCandidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < dashCandidates.length;
      rightIndex += 1
    ) {
      if (
        dashCandidatesOverlap(
          dashCandidates[leftIndex],
          dashCandidates[rightIndex]
        )
      ) {
        edges.push({
          dashIndexA: dashCandidates[leftIndex].dashIndex,
          dashIndexB: dashCandidates[rightIndex].dashIndex
        })
      }
    }
  }

  return {
    candidateCount: dashCandidates.length,
    edges
  }
}

const buildConflictComponents = (
  dashCandidates: DashCandidateRecord[],
  overlapGraph: OverlapGraph
): ConflictComponent[] => {
  if (overlapGraph.edges.length === 0) {
    return []
  }

  const adjacency = new Map<number, Set<number>>()
  dashCandidates.forEach((candidate) => {
    adjacency.set(candidate.dashIndex, new Set())
  })

  overlapGraph.edges.forEach((edge) => {
    adjacency.get(edge.dashIndexA)?.add(edge.dashIndexB)
    adjacency.get(edge.dashIndexB)?.add(edge.dashIndexA)
  })

  const visited = new Set<number>()
  const components: ConflictComponent[] = []

  dashCandidates.forEach((candidate) => {
    if (
      visited.has(candidate.dashIndex) ||
      (adjacency.get(candidate.dashIndex)?.size ?? 0) === 0
    ) {
      return
    }

    const stack = [candidate.dashIndex]
    const component = new Set<number>()

    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited.has(current)) {
        continue
      }

      visited.add(current)
      component.add(current)
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      })
    }

    if (component.size > 1) {
      components.push({
        dashIndices: [...component].sort(
          (leftIndex, rightIndex) => leftIndex - rightIndex
        )
      })
    }
  })

  return components
}

const ensureCounterClockwisePolygon = (polygon: Vec2[]) =>
  polygonArea(polygon) >= 0 ? polygon : [...polygon].reverse()

const pointInTriangle = (point: Vec2, a: Vec2, b: Vec2, c: Vec2) => {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)

  if (Math.abs(denominator) <= EPS) {
    return false
  }

  const w1 =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
    denominator
  const w2 =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
    denominator
  const w3 = 1 - w1 - w2

  return w1 >= -EPS && w2 >= -EPS && w3 >= -EPS
}

const triangulateSimplePolygon = (polygon: Vec2[]) => {
  const normalized = ensureCounterClockwisePolygon(
    dedupeClosedPolygonPoints(polygon)
  )

  if (normalized.length < 3) {
    return [] as Vec2[][]
  }

  if (normalized.length === 3) {
    return [normalized]
  }

  const indices = normalized.map((_, index) => index)
  const triangles: Vec2[][] = []
  let guard = 0

  while (indices.length > 3 && guard < normalized.length * normalized.length) {
    let earFound = false

    for (let index = 0; index < indices.length; index += 1) {
      const previousIndex =
        indices[(index - 1 + indices.length) % indices.length]
      const currentIndex = indices[index]
      const nextIndex = indices[(index + 1) % indices.length]
      const a = normalized[previousIndex]
      const b = normalized[currentIndex]
      const c = normalized[nextIndex]

      if (orientation(a, b, c) <= EPS) {
        continue
      }

      const containsOtherPoint = indices.some((candidateIndex) => {
        if (
          candidateIndex === previousIndex ||
          candidateIndex === currentIndex ||
          candidateIndex === nextIndex
        ) {
          return false
        }

        return pointInTriangle(normalized[candidateIndex], a, b, c)
      })
      if (containsOtherPoint) {
        continue
      }

      triangles.push([a, b, c])
      indices.splice(index, 1)
      earFound = true
      break
    }

    if (!earFound) {
      return [normalized]
    }

    guard += 1
  }

  if (indices.length === 3) {
    triangles.push([
      normalized[indices[0]],
      normalized[indices[1]],
      normalized[indices[2]]
    ])
  }

  return triangles
}

const isConvexPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 3) {
    return false
  }

  let expectedSign = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const turn = orientation(previous, current, next)

    if (Math.abs(turn) <= EPS) {
      continue
    }

    const sign = turn > 0 ? 1 : -1
    if (expectedSign === 0) {
      expectedSign = sign
      continue
    }

    if (sign !== expectedSign) {
      return false
    }
  }

  return true
}

const triangulateSimplePolygonCached = (polygon: Vec2[]) => {
  const polygonKey = createPolygonKey(polygon)
  const cachedTriangles = triangulatedPolygonCache.get(polygonKey)
  if (cachedTriangles) {
    return cachedTriangles
  }

  return setCachedValueWithLimit(
    triangulatedPolygonCache,
    polygonKey,
    triangulateSimplePolygon(polygon),
    MAX_TRIANGULATION_CACHE_ENTRIES
  )
}

const createPolygonKey = (polygon: Vec2[]) => {
  const normalized = ensureCounterClockwisePolygon(
    dedupeClosedPolygonPoints(polygon)
  )

  if (normalized.length === 0) {
    return ''
  }

  let startIndex = 0
  for (let index = 1; index < normalized.length; index += 1) {
    const current = normalized[index]
    const candidate = normalized[startIndex]
    if (
      current.x < candidate.x - EPS ||
      (Math.abs(current.x - candidate.x) <= EPS &&
        current.y < candidate.y - EPS)
    ) {
      startIndex = index
    }
  }

  const rotated = normalized.map(
    (_, index) => normalized[(startIndex + index) % normalized.length]
  )

  return rotated
    .map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`)
    .join('|')
}

const isDashCandidateRecord = (
  candidate: DashCandidateRecord | undefined
): candidate is DashCandidateRecord => candidate !== undefined

const createAtomicCellRecord = (polygon: Vec2[]): AtomicCellRecord | null => {
  const normalized = ensureCounterClockwisePolygon(
    dedupeClosedPolygonPoints(polygon)
  )
  const bounds = getPolygonBounds(normalized)

  return normalized.length >= 3 &&
    bounds &&
    Math.abs(polygonArea(normalized)) > EPS
    ? { polygon: normalized, bounds }
    : null
}

const createAtomicCellRecordNormalized = (
  polygon: Vec2[]
): AtomicCellRecord | null => {
  const bounds = getPolygonBounds(polygon)

  return polygon.length >= 3 && bounds && Math.abs(polygonArea(polygon)) > EPS
    ? { polygon, bounds }
    : null
}

const createDashPairKey = (leftDashIndex: number, rightDashIndex: number) =>
  leftDashIndex < rightDashIndex
    ? `${leftDashIndex}:${rightDashIndex}`
    : `${rightDashIndex}:${leftDashIndex}`

const buildPolygonClipEdges = (polygon: Vec2[]) =>
  polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const edge = subtractVec2(next, point)
    const unitLeftNormal = createUnitLeftNormal(point, next)
    return {
      start: point,
      normal: unitLeftNormal ?? {
        x: edge.y,
        y: -edge.x
      }
    }
  })

const tryMergeAdjacentConvexPolygons = (left: Vec2[], right: Vec2[]) => {
  const merged = tryMergeAdjacentPolygons(left, right)
  return merged && isConvexPolygon(merged) ? merged : null
}

const buildConvexPolygonFragmentsFromTriangles = (triangles: Vec2[][]) => {
  let fragments = triangles
    .map((triangle) =>
      ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(triangle))
    )
    .filter(
      (triangle) =>
        triangle.length >= 3 && Math.abs(polygonArea(triangle)) > EPS
    )

  if (fragments.length <= 2) {
    return fragments
  }

  let mergedInPass = true

  while (mergedInPass) {
    mergedInPass = false
    const nextFragments: Vec2[][] = []
    const consumed = new Set<number>()
    const fragmentBounds = fragments.map((fragment) =>
      getPolygonBounds(fragment)
    )

    for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
      if (consumed.has(leftIndex)) {
        continue
      }

      let mergedFragment: Vec2[] | null = null
      let mergedRightIndex = -1

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < fragments.length;
        rightIndex += 1
      ) {
        const leftBounds = fragmentBounds[leftIndex]
        const rightBounds = fragmentBounds[rightIndex]
        if (
          consumed.has(rightIndex) ||
          !leftBounds ||
          !rightBounds ||
          !boundsOverlap(leftBounds, rightBounds)
        ) {
          continue
        }

        const candidate = tryMergeAdjacentConvexPolygons(
          fragments[leftIndex],
          fragments[rightIndex]
        )

        if (!candidate) {
          continue
        }

        mergedFragment = candidate
        mergedRightIndex = rightIndex
        break
      }

      if (mergedFragment && mergedRightIndex >= 0) {
        consumed.add(leftIndex)
        consumed.add(mergedRightIndex)
        nextFragments.push(mergedFragment)
        mergedInPass = true
      } else {
        consumed.add(leftIndex)
        nextFragments.push(fragments[leftIndex])
      }
    }

    fragments = nextFragments
  }

  return fragments
}

const buildGreedyConvexMergedPolygonSet = (polygons: Vec2[][]) => {
  let fragments = polygons
    .map((polygon) =>
      ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(polygon))
    )
    .filter(
      (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS
    )

  if (fragments.length <= 1) {
    return fragments
  }

  let mergedInPass = true

  while (mergedInPass) {
    mergedInPass = false
    const nextFragments: Vec2[][] = []
    const consumed = new Set<number>()
    const fragmentBounds = fragments.map((fragment) =>
      getPolygonBounds(fragment)
    )

    for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
      if (consumed.has(leftIndex)) {
        continue
      }

      let mergedFragment: Vec2[] | null = null
      let mergedRightIndex = -1

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < fragments.length;
        rightIndex += 1
      ) {
        const leftBounds = fragmentBounds[leftIndex]
        const rightBounds = fragmentBounds[rightIndex]
        if (
          consumed.has(rightIndex) ||
          !leftBounds ||
          !rightBounds ||
          !boundsOverlap(leftBounds, rightBounds)
        ) {
          continue
        }

        const candidate = tryMergeAdjacentConvexPolygons(
          fragments[leftIndex],
          fragments[rightIndex]
        )
        if (!candidate) {
          continue
        }

        mergedFragment = candidate
        mergedRightIndex = rightIndex
        break
      }

      if (mergedFragment && mergedRightIndex >= 0) {
        consumed.add(leftIndex)
        consumed.add(mergedRightIndex)
        nextFragments.push(mergedFragment)
        mergedInPass = true
      } else {
        consumed.add(leftIndex)
        nextFragments.push(fragments[leftIndex])
      }
    }

    fragments = nextFragments
  }

  return fragments
}

const buildPrimitiveTriangleRecords = (
  primitivePolygons: DashPrimitiveRecord[]
) => {
  let triangleIndex = 0

  return primitivePolygons.flatMap((primitivePolygon) => {
    const normalizedPrimitivePolygon = ensureCounterClockwisePolygon(
      dedupeClosedPolygonPoints(primitivePolygon.polygon)
    )
    const polygonRecords = isConvexPolygon(normalizedPrimitivePolygon)
      ? [normalizedPrimitivePolygon]
      : buildConvexPolygonFragmentsFromTriangles(
          triangulateSimplePolygonCached(primitivePolygon.polygon)
        )

    return polygonRecords.flatMap((triangle) => {
      const normalized = ensureCounterClockwisePolygon(
        dedupeClosedPolygonPoints(triangle)
      )
      const bounds = getPolygonBounds(normalized)

      return normalized.length >= 3 && bounds
        ? [
            {
              id: `triangle:${triangleIndex++}`,
              dashIndex: primitivePolygon.dashIndex,
              polygon: normalized,
              bounds,
              primitiveId: primitivePolygon.id,
              clipEdges: buildPolygonClipEdges(normalized)
            }
          ]
        : []
    })
  })
}

const buildDisjointZonePrimitives = (
  zoneId: string,
  primitivePolygons: DashPrimitiveRecord[]
) => {
  const primitivesByDashIndex = new Map<number, DashPrimitiveRecord[]>()

  primitivePolygons.forEach((primitivePolygon) => {
    const dashPrimitives =
      primitivesByDashIndex.get(primitivePolygon.dashIndex) ?? []
    dashPrimitives.push(primitivePolygon)
    primitivesByDashIndex.set(primitivePolygon.dashIndex, dashPrimitives)
  })

  return [...primitivesByDashIndex.entries()].flatMap(
    ([dashIndex, dashPrimitives]) => {
      const touchedSegmentIndices = [
        ...new Set(
          dashPrimitives.flatMap((primitive) => primitive.touchedSegmentIndices)
        )
      ].sort((left, right) => left - right)
      const mergedKind =
        dashPrimitives.length === 1 ? dashPrimitives[0].kind : 'body'
      const sourcePolygons = dashPrimitives.map(
        (primitive) => primitive.polygon
      )
      const disjointPolygons = polygonsHavePositiveAreaOverlapInSet(
        sourcePolygons
      )
        ? buildCanonicalDisjointPolygonUnion(sourcePolygons)
        : sourcePolygons
      const mergedDisjointPolygons =
        disjointPolygons.length > 1
          ? buildGreedyConvexMergedPolygonSet(disjointPolygons)
          : disjointPolygons

      return mergedDisjointPolygons.flatMap((polygon, polygonIndex) => {
        const normalized = ensureCounterClockwisePolygon(
          dedupeClosedPolygonPoints(polygon)
        )
        const bounds = getPolygonBounds(normalized)

        return normalized.length >= 3 && bounds
          ? [
              {
                id: `${zoneId}:dash:${dashIndex}:fragment:${polygonIndex}`,
                dashIndex,
                kind: mergedKind,
                touchedSegmentIndices,
                polygon: normalized,
                bounds,
                polygonKey: createPolygonKey(normalized),
                clipEdges: buildPolygonClipEdges(normalized)
              }
            ]
          : []
      })
    }
  )
}

const polygonsHavePositiveAreaOverlapInSet = (polygons: Vec2[][]) => {
  for (let leftIndex = 0; leftIndex < polygons.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < polygons.length;
      rightIndex += 1
    ) {
      if (polygonsOverlap(polygons[leftIndex], polygons[rightIndex])) {
        return true
      }
    }
  }

  return false
}

const buildPrimitiveOverlapIndex = (
  primitivePolygons: DashPrimitiveRecord[],
  componentPairKeys: Set<string>
) => {
  const overlappingPrimitiveIdsByPrimitiveId = new Map<string, Set<string>>()
  const orderedIndices = primitivePolygons
    .map((_, index) => index)
    .sort(
      (leftIndex, rightIndex) =>
        primitivePolygons[leftIndex].bounds.minX -
        primitivePolygons[rightIndex].bounds.minX
    )
  const activeIndices: number[] = []

  primitivePolygons.forEach((primitivePolygon) => {
    overlappingPrimitiveIdsByPrimitiveId.set(primitivePolygon.id, new Set())
  })

  orderedIndices.forEach((index) => {
    const primitivePolygon = primitivePolygons[index]

    while (
      activeIndices.length > 0 &&
      primitivePolygons[activeIndices[0]].bounds.maxX <
        primitivePolygon.bounds.minX - EPS
    ) {
      activeIndices.shift()
    }

    activeIndices.forEach((activeIndex) => {
      const activePrimitivePolygon = primitivePolygons[activeIndex]
      if (activePrimitivePolygon.dashIndex === primitivePolygon.dashIndex) {
        return
      }

      if (
        !componentPairKeys.has(
          createDashPairKey(
            activePrimitivePolygon.dashIndex,
            primitivePolygon.dashIndex
          )
        ) ||
        !boundsOverlap(
          activePrimitivePolygon.bounds,
          primitivePolygon.bounds
        ) ||
        !polygonsOverlapAssumingBoundsOverlap(
          activePrimitivePolygon.polygon,
          primitivePolygon.polygon
        )
      ) {
        return
      }

      overlappingPrimitiveIdsByPrimitiveId
        .get(activePrimitivePolygon.id)
        ?.add(primitivePolygon.id)
      overlappingPrimitiveIdsByPrimitiveId
        .get(primitivePolygon.id)
        ?.add(activePrimitivePolygon.id)
    })

    let insertionIndex = activeIndices.length
    while (insertionIndex > 0) {
      const previousIndex = activeIndices[insertionIndex - 1]
      if (
        primitivePolygons[previousIndex].bounds.maxX <=
        primitivePolygon.bounds.maxX
      ) {
        break
      }
      insertionIndex -= 1
    }
    activeIndices.splice(insertionIndex, 0, index)
  })

  const contestedPrimitiveIds = new Set<string>()
  overlappingPrimitiveIdsByPrimitiveId.forEach(
    (overlappingPrimitiveIds, primitiveId) => {
      if (overlappingPrimitiveIds.size > 0) {
        contestedPrimitiveIds.add(primitiveId)
      }
    }
  )

  return {
    overlappingPrimitiveIdsByPrimitiveId,
    contestedPrimitiveIds
  }
}

const createAtomicCoverageFragment = (
  polygon: Vec2[],
  coverageSet: number[]
): AtomicCoverageFragment | null => {
  const cell = createAtomicCellRecord(polygon)
  if (!cell) {
    return null
  }

  return {
    ...cell,
    coverageSet: [...coverageSet].sort((left, right) => left - right)
  }
}

const createAtomicCoverageFragmentNormalized = (
  polygon: Vec2[],
  coverageSet: number[]
): AtomicCoverageFragment | null => {
  const cell = createAtomicCellRecordNormalized(polygon)
  if (!cell) {
    return null
  }

  return {
    ...cell,
    coverageSet: [...coverageSet].sort((left, right) => left - right)
  }
}

const splitConvexPolygonByClipEdges = (
  subjectPolygon: Vec2[],
  clipEdges: { start: Vec2; normal: Vec2 }[]
) => {
  let remainingPieces = [subjectPolygon]
  const keptPieces: AtomicCellRecord[] = []

  if (clipEdges.length < 3) {
    const cell = createAtomicCellRecordNormalized(subjectPolygon)
    return {
      outside: cell ? [cell] : [],
      shared: null as AtomicCellRecord | null
    }
  }

  for (const { start, normal: insideNormal } of clipEdges) {
    const outsideNormal = scaleVec2(insideNormal, -1)
    const nextRemaining: Vec2[][] = []

    remainingPieces.forEach((piece) => {
      const insidePiece = clipPolygonToHalfPlane(piece, start, insideNormal)
      const outsidePiece = clipPolygonToHalfPlane(piece, start, outsideNormal)
      const outsideCell = createAtomicCellRecordNormalized(outsidePiece)
      if (outsideCell) {
        keptPieces.push(outsideCell)
      }

      const insideCell = createAtomicCellRecordNormalized(insidePiece)
      if (insideCell) {
        nextRemaining.push(insideCell.polygon)
      }
    })

    remainingPieces = nextRemaining
    if (remainingPieces.length === 0) {
      break
    }
  }

  return {
    outside: keptPieces,
    shared:
      remainingPieces.length > 0
        ? createAtomicCellRecordNormalized(remainingPieces[0])
        : null
  }
}

const polygonFullyInsideClipEdges = (
  subjectPolygon: Vec2[],
  clipEdges: { start: Vec2; normal: Vec2 }[]
) =>
  subjectPolygon.every((point) =>
    clipEdges.every(
      ({ start, normal }) => dotVec2(subtractVec2(point, start), normal) >= -EPS
    )
  )

const mergeAtomicCoverageSets = (left: number[], rightDashIndex: number) =>
  left.includes(rightDashIndex)
    ? [...left]
    : [...left, rightDashIndex].sort((a, b) => a - b)

const splitAtomicCoverageFragmentByClipShape = (
  fragment: AtomicCoverageFragment,
  clipShape: ClipSolveShape
): AtomicCoverageFragment[] => {
  if (
    fragment.coverageSet.includes(clipShape.dashIndex) ||
    !boundsOverlap(fragment.bounds, clipShape.bounds)
  ) {
    return [fragment]
  }

  if (polygonFullyInsideClipEdges(fragment.polygon, clipShape.clipEdges)) {
    const sharedFragment = createAtomicCoverageFragmentNormalized(
      fragment.polygon,
      mergeAtomicCoverageSets(fragment.coverageSet, clipShape.dashIndex)
    )
    return sharedFragment ? [sharedFragment] : []
  }

  const splitResult = splitConvexPolygonByClipEdges(
    fragment.polygon,
    clipShape.clipEdges
  )
  if (!splitResult.shared) {
    return [fragment]
  }

  const outsideFragments = splitResult.outside.flatMap((piece) => {
    const outsideFragment = createAtomicCoverageFragmentNormalized(
      piece.polygon,
      fragment.coverageSet
    )
    return outsideFragment ? [outsideFragment] : []
  })
  const sharedFragment = createAtomicCoverageFragmentNormalized(
    splitResult.shared.polygon,
    mergeAtomicCoverageSets(fragment.coverageSet, clipShape.dashIndex)
  )

  return sharedFragment
    ? outsideFragments.concat(sharedFragment)
    : outsideFragments
}

const dedupeAtomicCoverageFragments = (
  fragments: AtomicCoverageFragment[]
): AtomicCoverageFragment[] => {
  const fragmentBuckets = new Map<
    string,
    AtomicCoverageFragment | AtomicCoverageFragment[]
  >()

  fragments.forEach((fragment) => {
    const boundsKey = createBoundsKey(fragment.bounds)
    const key = `${fragment.coverageSet.join(',')}::${boundsKey}`
    const existing = fragmentBuckets.get(key)

    if (!existing) {
      fragmentBuckets.set(key, fragment)
      return
    }

    if (Array.isArray(existing)) {
      existing.push(fragment)
      return
    }

    fragmentBuckets.set(key, [existing, fragment])
  })

  const dedupedFragments: AtomicCoverageFragment[] = []

  fragmentBuckets.forEach((bucket) => {
    if (!Array.isArray(bucket)) {
      dedupedFragments.push(bucket)
      return
    }

    const fragmentMap = new Map<string, AtomicCoverageFragment>()

    bucket.forEach((fragment) => {
      fragment.polygonKey ??= createPolygonKey(fragment.polygon)
      const key = `${fragment.polygonKey}::${fragment.coverageSet.join(',')}`
      if (!fragmentMap.has(key)) {
        fragmentMap.set(key, fragment)
      }
    })

    dedupedFragments.push(...fragmentMap.values())
  })

  return dedupedFragments
}

const subtractAtomicCellByClipShape = (
  cell: AtomicCellRecord,
  clipShape: ClipSolveShape
): AtomicCellRecord[] => {
  if (!boundsOverlap(cell.bounds, clipShape.bounds)) {
    return [cell]
  }

  if (polygonFullyInsideClipEdges(cell.polygon, clipShape.clipEdges)) {
    return []
  }

  const splitResult = splitConvexPolygonByClipEdges(
    cell.polygon,
    clipShape.clipEdges
  )
  if (!splitResult.shared) {
    return [cell]
  }

  return splitResult.outside
}

const buildTriangleGroupsByDashIndex = (triangles: TriangleRecord[]) => {
  const trianglesByDashIndex = new Map<number, TriangleRecord[]>()

  triangles.forEach((triangle) => {
    const dashTriangles = trianglesByDashIndex.get(triangle.dashIndex) ?? []
    dashTriangles.push(triangle)
    trianglesByDashIndex.set(triangle.dashIndex, dashTriangles)
  })

  return trianglesByDashIndex
}

const buildClipSolveShapesByDashIndex = (
  primitivePolygons: DashPrimitiveRecord[],
  primitiveTriangles: TriangleRecord[]
) => {
  const trianglesByPrimitiveId = new Map<string, TriangleRecord[]>()

  primitiveTriangles.forEach((triangle) => {
    const triangles = trianglesByPrimitiveId.get(triangle.primitiveId) ?? []
    triangles.push(triangle)
    trianglesByPrimitiveId.set(triangle.primitiveId, triangles)
  })

  const clipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

  primitivePolygons.forEach((primitivePolygon) => {
    const dashShapes =
      clipShapesByDashIndex.get(primitivePolygon.dashIndex) ?? []

    if (isConvexPolygon(primitivePolygon.polygon)) {
      dashShapes.push({
        dashIndex: primitivePolygon.dashIndex,
        polygon: primitivePolygon.polygon,
        bounds: primitivePolygon.bounds,
        clipEdges: buildPolygonClipEdges(primitivePolygon.polygon)
      })
    } else {
      ;(trianglesByPrimitiveId.get(primitivePolygon.id) ?? []).forEach(
        (triangle) => {
          dashShapes.push({
            dashIndex: triangle.dashIndex,
            polygon: triangle.polygon,
            bounds: triangle.bounds,
            clipEdges: triangle.clipEdges
          })
        }
      )
    }

    clipShapesByDashIndex.set(primitivePolygon.dashIndex, dashShapes)
  })

  return clipShapesByDashIndex
}

const CLIP_SHAPE_SPATIAL_INDEX_MIN_SHAPE_COUNT = 8
const CLIP_SHAPE_SPATIAL_INDEX_TARGET_BUCKET_SHAPES = 6

const createClipShapeSpatialIndex = (shapes: ClipSolveShape[]) => {
  if (shapes.length < CLIP_SHAPE_SPATIAL_INDEX_MIN_SHAPE_COUNT) {
    return null
  }

  const bounds = shapes.reduce<PolygonBounds>(
    (mergedBounds, shape) =>
      mergeBounds(mergedBounds, shape.bounds) ?? mergedBounds,
    shapes[0].bounds
  )
  const width = Math.max(EPS, bounds.maxX - bounds.minX)
  const height = Math.max(EPS, bounds.maxY - bounds.minY)
  const desiredBucketCount = Math.max(
    1,
    Math.ceil(shapes.length / CLIP_SHAPE_SPATIAL_INDEX_TARGET_BUCKET_SHAPES)
  )
  const estimatedColumns = Math.max(
    1,
    Math.round(Math.sqrt((desiredBucketCount * width) / height))
  )
  const columnCount = Math.max(
    1,
    Math.min(desiredBucketCount, estimatedColumns)
  )
  const rowCount = Math.max(1, Math.ceil(desiredBucketCount / columnCount))
  const cellWidth = width / columnCount
  const cellHeight = height / rowCount
  const bucketShapeIndices = new Map<string, number[]>()

  shapes.forEach((shape, shapeIndex) => {
    const minColumnIndex = Math.max(
      0,
      Math.min(
        columnCount - 1,
        Math.floor((shape.bounds.minX - bounds.minX) / cellWidth)
      )
    )
    const maxColumnIndex = Math.max(
      0,
      Math.min(
        columnCount - 1,
        Math.floor((shape.bounds.maxX - bounds.minX) / cellWidth)
      )
    )
    const minRowIndex = Math.max(
      0,
      Math.min(
        rowCount - 1,
        Math.floor((shape.bounds.minY - bounds.minY) / cellHeight)
      )
    )
    const maxRowIndex = Math.max(
      0,
      Math.min(
        rowCount - 1,
        Math.floor((shape.bounds.maxY - bounds.minY) / cellHeight)
      )
    )

    for (
      let columnIndex = minColumnIndex;
      columnIndex <= maxColumnIndex;
      columnIndex += 1
    ) {
      for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex += 1) {
        const bucketKey = `${columnIndex}:${rowIndex}`
        const bucketShapeIndicesForKey = bucketShapeIndices.get(bucketKey) ?? []
        bucketShapeIndicesForKey.push(shapeIndex)
        bucketShapeIndices.set(bucketKey, bucketShapeIndicesForKey)
      }
    }
  })

  return {
    bounds,
    columnCount,
    rowCount,
    cellWidth,
    cellHeight,
    bucketShapeIndices,
    shapes
  } satisfies ClipShapeSpatialIndex
}

const queryClipShapeSpatialIndex = (
  spatialIndex: ClipShapeSpatialIndex,
  queryBounds: PolygonBounds
) => {
  if (!boundsOverlap(spatialIndex.bounds, queryBounds)) {
    return [] as ClipSolveShape[]
  }

  const minColumnIndex = Math.max(
    0,
    Math.min(
      spatialIndex.columnCount - 1,
      Math.floor(
        (queryBounds.minX - spatialIndex.bounds.minX) / spatialIndex.cellWidth
      )
    )
  )
  const maxColumnIndex = Math.max(
    0,
    Math.min(
      spatialIndex.columnCount - 1,
      Math.floor(
        (queryBounds.maxX - spatialIndex.bounds.minX) / spatialIndex.cellWidth
      )
    )
  )
  const minRowIndex = Math.max(
    0,
    Math.min(
      spatialIndex.rowCount - 1,
      Math.floor(
        (queryBounds.minY - spatialIndex.bounds.minY) / spatialIndex.cellHeight
      )
    )
  )
  const maxRowIndex = Math.max(
    0,
    Math.min(
      spatialIndex.rowCount - 1,
      Math.floor(
        (queryBounds.maxY - spatialIndex.bounds.minY) / spatialIndex.cellHeight
      )
    )
  )
  const shapeIndices = new Set<number>()

  for (
    let columnIndex = minColumnIndex;
    columnIndex <= maxColumnIndex;
    columnIndex += 1
  ) {
    for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex += 1) {
      const bucketShapeIndices =
        spatialIndex.bucketShapeIndices.get(`${columnIndex}:${rowIndex}`) ?? []
      bucketShapeIndices.forEach((shapeIndex) => {
        shapeIndices.add(shapeIndex)
      })
    }
  }

  return [...shapeIndices].map((shapeIndex) => spatialIndex.shapes[shapeIndex])
}

const buildSourceShapeSolveRecordsByDashIndex = (
  sourceShapesByDashIndex: Map<number, ClipSolveShape[]>,
  clipShapesByDashIndex: Map<number, ClipSolveShape[]>
) => {
  const solveRecordsBySourceDashIndex = new Map<
    number,
    PreparedSourceShapeSolveRecord[]
  >()
  const sourceDashIndices = [...sourceShapesByDashIndex.keys()].sort(
    (left, right) => left - right
  )
  const clipDashIndices = [...clipShapesByDashIndex.keys()].sort(
    (left, right) => left - right
  )
  const boundsByClipDashIndex = new Map<number, PolygonBounds>()
  const spatialIndexByClipDashIndex = new Map<number, ClipShapeSpatialIndex>()

  clipDashIndices.forEach((dashIndex) => {
    const dashShapes = clipShapesByDashIndex.get(dashIndex)
    if (!dashShapes || dashShapes.length === 0) {
      return
    }

    boundsByClipDashIndex.set(
      dashIndex,
      dashShapes.reduce<PolygonBounds>(
        (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
        dashShapes[0].bounds
      )
    )
    const spatialIndex = createClipShapeSpatialIndex(dashShapes)
    if (spatialIndex) {
      spatialIndexByClipDashIndex.set(dashIndex, spatialIndex)
    }
  })

  sourceDashIndices.forEach((sourceDashIndex) => {
    const sourceShapes = sourceShapesByDashIndex.get(sourceDashIndex)
    if (!sourceShapes || sourceShapes.length === 0) {
      return
    }

    const sourceBounds = sourceShapes.reduce<PolygonBounds>(
      (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
      sourceShapes[0].bounds
    )
    const relevantClipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

    clipDashIndices.forEach((clipDashIndex) => {
      if (clipDashIndex === sourceDashIndex) {
        return
      }

      const clipBounds = boundsByClipDashIndex.get(clipDashIndex)
      const dashShapes = clipShapesByDashIndex.get(clipDashIndex)
      if (
        !clipBounds ||
        !dashShapes ||
        dashShapes.length === 0 ||
        !boundsOverlap(sourceBounds, clipBounds)
      ) {
        return
      }

      const relevantClipShapes = dashShapes.filter((shape) =>
        boundsOverlap(sourceBounds, shape.bounds)
      )

      if (relevantClipShapes.length > 0) {
        relevantClipShapesByDashIndex.set(clipDashIndex, relevantClipShapes)
      }
    })

    solveRecordsBySourceDashIndex.set(
      sourceDashIndex,
      sourceShapes.map((sourceShape) => ({
        sourceShape,
        clipShapeGroups: clipDashIndices
          .flatMap((clipDashIndex) => {
            const candidateClipShapes =
              relevantClipShapesByDashIndex.get(clipDashIndex) ?? []
            const clipShapeSpatialIndex =
              spatialIndexByClipDashIndex.get(clipDashIndex)
            const indexedCandidateClipShapes = clipShapeSpatialIndex
              ? queryClipShapeSpatialIndex(
                  clipShapeSpatialIndex,
                  sourceShape.bounds
                )
              : candidateClipShapes
            const relevantClipShapes = indexedCandidateClipShapes.filter(
              (clipShape) =>
                boundsOverlap(sourceShape.bounds, clipShape.bounds) &&
                polygonsOverlapAssumingBoundsOverlap(
                  sourceShape.polygon,
                  clipShape.polygon
                )
            )

            if (relevantClipShapes.length === 0) {
              return []
            }

            const fullyCoveringShape = relevantClipShapes.find((clipShape) =>
              polygonFullyInsideClipEdges(
                sourceShape.polygon,
                clipShape.clipEdges
              )
            )

            if (fullyCoveringShape) {
              return [[fullyCoveringShape]]
            }

            return [relevantClipShapes]
          })
          .map((group) => {
            const groupBounds = group.reduce<PolygonBounds>(
              (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
              group[0].bounds
            )
            const boundsArea =
              (groupBounds.maxX - groupBounds.minX) *
              (groupBounds.maxY - groupBounds.minY)

            return {
              shapes: group,
              shapeCount: group.length,
              bounds: groupBounds,
              boundsArea
            }
          })
          .sort((leftGroup, rightGroup) => {
            if (leftGroup.shapeCount !== rightGroup.shapeCount) {
              return leftGroup.shapeCount - rightGroup.shapeCount
            }

            return leftGroup.boundsArea - rightGroup.boundsArea
          })
          .map((group) => ({
            shapes: group.shapes,
            bounds: group.bounds
          }))
      }))
    )
  })

  return solveRecordsBySourceDashIndex
}

const buildGeneralZoneSolveRecords = (
  sourceShapesByDashIndex: Map<number, ClipSolveShape[]>,
  clipShapesByDashIndex: Map<number, ClipSolveShape[]>
) =>
  [
    ...buildSourceShapeSolveRecordsByDashIndex(
      sourceShapesByDashIndex,
      clipShapesByDashIndex
    ).entries()
  ]
    .flatMap(([sourceDashIndex, solveRecords]) =>
      solveRecords.map(
        (solveRecord) =>
          ({
            sourceDashIndex,
            sourceShape: solveRecord.sourceShape,
            clipShapeGroups: solveRecord.clipShapeGroups
          }) satisfies PreparedGeneralZoneSolveRecord
      )
    )
    .sort((left, right) => {
      if (left.clipShapeGroups.length !== right.clipShapeGroups.length) {
        return left.clipShapeGroups.length - right.clipShapeGroups.length
      }

      return left.sourceDashIndex - right.sourceDashIndex
    })

interface PairwiseZoneSolveStats {
  solveRecordCount: number
  clipGroupCount: number
  initialFragmentCount: number
  maxActiveFragmentCount: number
  dedupeBeforeCount: number
  dedupeAfterCount: number
  dedupeEventCount: number
  clipTime: number
  dedupeTime: number
  emitTime: number
}

interface PairwiseZoneRegionConstruction {
  sharedRegions: AtomicCellRecord[]
  exclusiveRegionsByDashIndex: Map<number, AtomicCellRecord[]>
}

interface GeneralZoneSolveStats {
  solveRecordCount: number
  clipGroupCount: number
  initialFragmentCount: number
  maxActiveFragmentCount: number
  dedupeBeforeCount: number
  dedupeAfterCount: number
  dedupeEventCount: number
  clipTime: number
  dedupeTime: number
  emitTime: number
}

const buildPairwiseZoneSourceShapesByDashIndex = (
  sourceTrianglesByDashIndex: Map<number, TriangleRecord[]>
) => {
  const sourceShapesByDashIndex = new Map<number, ClipSolveShape[]>()

  sourceTrianglesByDashIndex.forEach((triangles, dashIndex) => {
    const convexShapes = buildConvexPolygonFragmentsFromTriangles(
      triangles.map((triangle) => triangle.polygon)
    )
      .map((polygon) =>
        ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(polygon))
      )
      .flatMap((polygon) => {
        const bounds = getPolygonBounds(polygon)

        return polygon.length >= 3 && bounds
          ? [
              {
                dashIndex,
                polygon,
                bounds,
                clipEdges: buildPolygonClipEdges(polygon)
              } satisfies ClipSolveShape
            ]
          : []
      })

    if (convexShapes.length > 0) {
      sourceShapesByDashIndex.set(dashIndex, convexShapes)
    }
  })

  return sourceShapesByDashIndex
}

const intersectAtomicCellWithClipShape = (
  cell: AtomicCellRecord,
  clipShape: ClipSolveShape
): AtomicCellRecord | null => {
  if (!boundsOverlap(cell.bounds, clipShape.bounds)) {
    return null
  }

  if (polygonFullyInsideClipEdges(cell.polygon, clipShape.clipEdges)) {
    return cell
  }

  const sharedPolygon = clipShape.clipEdges.reduce<Vec2[]>(
    (polygon, { start, normal }) =>
      polygon.length === 0
        ? polygon
        : clipPolygonToHalfPlane(polygon, start, normal),
    cell.polygon
  )

  return createAtomicCellRecordNormalized(sharedPolygon)
}

const dedupeAtomicCells = (cells: AtomicCellRecord[]) => {
  const dedupedCellMap = new Map<string, AtomicCellRecord>()

  cells.forEach((cell) => {
    cell.polygonKey ??= createPolygonKey(cell.polygon)
    if (!dedupedCellMap.has(cell.polygonKey)) {
      dedupedCellMap.set(cell.polygonKey, cell)
    }
  })

  return [...dedupedCellMap.values()]
}

const buildClipSolveShapesFromAtomicCells = (
  cells: AtomicCellRecord[],
  dashIndex: number
) =>
  cells.map(
    (cell) =>
      ({
        dashIndex,
        polygon: cell.polygon,
        bounds: cell.bounds,
        clipEdges: buildPolygonClipEdges(cell.polygon),
        shapeKey: cell.polygonKey
      }) satisfies ClipSolveShape
  )

const collectRelevantClipShapesForSourceShape = (
  sourceShape: Pick<ClipSolveShape, 'polygon' | 'bounds'>,
  clipShapes: ClipSolveShape[],
  clipSpatialIndex: ClipShapeSpatialIndex | null
) => {
  const candidateClipShapes = clipSpatialIndex
    ? queryClipShapeSpatialIndex(clipSpatialIndex, sourceShape.bounds)
    : clipShapes

  return candidateClipShapes.filter(
    (clipShape) =>
      boundsOverlap(sourceShape.bounds, clipShape.bounds) &&
      polygonsOverlapAssumingBoundsOverlap(
        sourceShape.polygon,
        clipShape.polygon
      )
  )
}

const buildPairwiseZoneRegionConstruction = (
  overlapZone: PreparedPairwisePrimitiveOverlapZone,
  stats: PairwiseZoneSolveStats
): PairwiseZoneRegionConstruction => {
  const pairwiseDashIndices = [
    ...new Set([
      ...overlapZone.pairwiseSourceShapesByDashIndex.keys(),
      ...overlapZone.pairwiseClipShapesByDashIndex.keys()
    ])
  ].sort((left, right) => left - right)
  const emptyResult: PairwiseZoneRegionConstruction = {
    sharedRegions: [],
    exclusiveRegionsByDashIndex: new Map<number, AtomicCellRecord[]>()
  }

  if (pairwiseDashIndices.length !== 2) {
    return emptyResult
  }

  const [leftDashIndex, rightDashIndex] = pairwiseDashIndices
  const leftSourceShapes =
    overlapZone.pairwiseSourceShapesByDashIndex.get(leftDashIndex) ?? []
  const rightSourceShapes =
    overlapZone.pairwiseSourceShapesByDashIndex.get(rightDashIndex) ?? []
  const leftClipShapes =
    overlapZone.pairwiseClipShapesByDashIndex.get(leftDashIndex) ??
    leftSourceShapes
  const rightClipShapes =
    overlapZone.pairwiseClipShapesByDashIndex.get(rightDashIndex) ??
    rightSourceShapes

  if (
    leftSourceShapes.length === 0 ||
    rightSourceShapes.length === 0 ||
    leftClipShapes.length === 0 ||
    rightClipShapes.length === 0
  ) {
    if (leftSourceShapes.length > 0) {
      emptyResult.exclusiveRegionsByDashIndex.set(
        leftDashIndex,
        leftSourceShapes.map((shape) => ({
          polygon: shape.polygon,
          bounds: shape.bounds,
          polygonKey: shape.shapeKey
        }))
      )
    }
    if (rightSourceShapes.length > 0) {
      emptyResult.exclusiveRegionsByDashIndex.set(
        rightDashIndex,
        rightSourceShapes.map((shape) => ({
          polygon: shape.polygon,
          bounds: shape.bounds,
          polygonKey: shape.shapeKey
        }))
      )
    }
    return emptyResult
  }

  const primaryDashIndex =
    leftSourceShapes.length <= rightSourceShapes.length
      ? leftDashIndex
      : rightDashIndex
  const secondaryDashIndex =
    primaryDashIndex === leftDashIndex ? rightDashIndex : leftDashIndex
  const primarySourceShapes =
    primaryDashIndex === leftDashIndex ? leftSourceShapes : rightSourceShapes
  const secondaryClipShapes =
    primaryDashIndex === leftDashIndex ? rightClipShapes : leftClipShapes
  const secondaryClipBounds = secondaryClipShapes.reduce<PolygonBounds>(
    (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
    secondaryClipShapes[0].bounds
  )
  const secondaryClipSpatialIndex =
    createClipShapeSpatialIndex(secondaryClipShapes)

  const sharedConstructionStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now()
    : 0
  const rawSharedRegions: AtomicCellRecord[] = []

  primarySourceShapes.forEach((sourceShape) => {
    if (!boundsOverlap(sourceShape.bounds, secondaryClipBounds)) {
      return
    }

    const relevantClipShapes = collectRelevantClipShapesForSourceShape(
      sourceShape,
      secondaryClipShapes,
      secondaryClipSpatialIndex
    )

    stats.clipGroupCount += relevantClipShapes.length

    relevantClipShapes.forEach((clipShape) => {
      const sharedRegion = intersectAtomicCellWithClipShape(
        {
          polygon: sourceShape.polygon,
          bounds: sourceShape.bounds,
          polygonKey: sourceShape.shapeKey
        },
        clipShape
      )
      if (sharedRegion) {
        rawSharedRegions.push(sharedRegion)
      }
    })
  })

  let sharedRegions = dedupeAtomicCells(rawSharedRegions)
  if (sharedRegions.length > 1) {
    sharedRegions = buildGreedyConvexMergedPolygonSet(
      sharedRegions.map((region) => region.polygon)
    ).flatMap((polygon) => {
      const region = createAtomicCellRecord(polygon)
      return region ? [region] : []
    })
    sharedRegions = dedupeAtomicCells(sharedRegions)
  }
  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    stats.clipTime += performance.now() - sharedConstructionStartedAt
  }

  const sharedClipShapes = buildClipSolveShapesFromAtomicCells(
    sharedRegions,
    secondaryDashIndex
  )
  const sharedSpatialIndex = createClipShapeSpatialIndex(sharedClipShapes)
  const sharedBounds =
    sharedClipShapes.length > 0
      ? sharedClipShapes.reduce<PolygonBounds>(
          (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
          sharedClipShapes[0].bounds
        )
      : null
  const exclusiveRegionsByDashIndex = new Map<number, AtomicCellRecord[]>()

  pairwiseDashIndices.forEach((sourceDashIndex) => {
    const sourceShapes =
      overlapZone.pairwiseSourceShapesByDashIndex.get(sourceDashIndex) ?? []
    const exclusiveRegions: AtomicCellRecord[] = []

    sourceShapes.forEach((sourceShape) => {
      stats.solveRecordCount += 1

      if (
        !sharedBounds ||
        sharedClipShapes.length === 0 ||
        !boundsOverlap(sourceShape.bounds, sharedBounds)
      ) {
        exclusiveRegions.push({
          polygon: sourceShape.polygon,
          bounds: sourceShape.bounds,
          polygonKey: sourceShape.shapeKey
        })
        return
      }

      const relevantSharedShapes = collectRelevantClipShapesForSourceShape(
        sourceShape,
        sharedClipShapes,
        sharedSpatialIndex
      )

      if (relevantSharedShapes.length === 0) {
        exclusiveRegions.push({
          polygon: sourceShape.polygon,
          bounds: sourceShape.bounds,
          polygonKey: sourceShape.shapeKey
        })
        return
      }

      const initialFragment = createAtomicCellRecordNormalized(
        sourceShape.polygon
      )
      if (!initialFragment) {
        return
      }

      let activeFragments = [initialFragment]
      stats.initialFragmentCount += 1
      stats.clipGroupCount += relevantSharedShapes.length
      stats.maxActiveFragmentCount = Math.max(
        stats.maxActiveFragmentCount,
        activeFragments.length
      )

      const clipStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
        ? performance.now()
        : 0
      relevantSharedShapes.forEach((sharedShape) => {
        activeFragments = activeFragments.flatMap((fragment) =>
          subtractAtomicCellByClipShape(fragment, sharedShape)
        )
        stats.maxActiveFragmentCount = Math.max(
          stats.maxActiveFragmentCount,
          activeFragments.length
        )
      })
      if (DASHED_GEOMETRY_PROFILE_ENABLED) {
        stats.clipTime += performance.now() - clipStartedAt
      }

      exclusiveRegions.push(...activeFragments)
    })

    exclusiveRegionsByDashIndex.set(
      sourceDashIndex,
      dedupeAtomicCells(exclusiveRegions)
    )
  })

  return {
    sharedRegions,
    exclusiveRegionsByDashIndex
  }
}

const buildPairwiseZoneSourceShapesByDashIndexFromPrimitives = (
  primitivePolygons: DashPrimitiveRecord[]
) => {
  const primitivePolygonsByDashIndex = new Map<number, Vec2[][]>()

  primitivePolygons.forEach((primitivePolygon) => {
    const solvePolygons = isConvexPolygon(primitivePolygon.polygon)
      ? [primitivePolygon.polygon]
      : buildConvexPolygonFragmentsFromTriangles(
          triangulateSimplePolygonCached(primitivePolygon.polygon)
        )
    const dashPolygons =
      primitivePolygonsByDashIndex.get(primitivePolygon.dashIndex) ?? []
    dashPolygons.push(...solvePolygons)
    primitivePolygonsByDashIndex.set(primitivePolygon.dashIndex, dashPolygons)
  })

  const sourceShapesByDashIndex = new Map<number, ClipSolveShape[]>()

  primitivePolygonsByDashIndex.forEach((dashPolygons, dashIndex) => {
    const mergedPolygons =
      dashPolygons.length > 1
        ? buildGreedyConvexMergedPolygonSet(dashPolygons)
        : dashPolygons

    const sourceShapes = mergedPolygons.flatMap((polygon) => {
      const normalizedPolygon = ensureCounterClockwisePolygon(
        dedupeClosedPolygonPoints(polygon)
      )
      const bounds = getPolygonBounds(normalizedPolygon)

      return normalizedPolygon.length >= 3 && bounds
        ? [
            {
              dashIndex,
              polygon: normalizedPolygon,
              bounds,
              clipEdges: buildPolygonClipEdges(normalizedPolygon)
            } satisfies ClipSolveShape
          ]
        : []
    })

    if (sourceShapes.length > 0) {
      sourceShapesByDashIndex.set(dashIndex, sourceShapes)
    }
  })

  return sourceShapesByDashIndex
}

const isPairwisePreparedOverlapZone = ({
  sourceTrianglesByDashIndex,
  clipShapesByDashIndex
}: {
  sourceTrianglesByDashIndex: Map<number, TriangleRecord[]>
  clipShapesByDashIndex: Map<number, ClipSolveShape[]>
}) => {
  const sourceDashIndices = [...sourceTrianglesByDashIndex.keys()]

  if (sourceDashIndices.length === 0 || sourceDashIndices.length > 2) {
    return false
  }

  const pairwiseDashIndices = new Set<number>(sourceDashIndices)
  clipShapesByDashIndex.forEach((clipShapes, dashIndex) => {
    if (clipShapes.length > 0) {
      pairwiseDashIndices.add(dashIndex)
    }
  })

  return pairwiseDashIndices.size === 2
}

const solvePairwiseAtomicRegionsForZone = ({
  overlapZone,
  emitAtomicRegion
}: {
  overlapZone: PreparedPairwisePrimitiveOverlapZone
  emitAtomicRegion: (
    regionPolygon: Vec2[],
    regionBounds: PolygonBounds,
    coverageSet: number[],
    zoneId: string,
    mergeStable: boolean,
    polygonKey?: string
  ) => void
}): PairwiseZoneSolveStats => {
  const sourceDashIndices = [
    ...overlapZone.pairwiseSourceShapesByDashIndex.keys()
  ].sort((left, right) => left - right)
  const clipShapesByDashIndex = overlapZone.pairwiseClipShapesByDashIndex
  const pairwiseDashIndices = [
    ...new Set([...sourceDashIndices, ...clipShapesByDashIndex.keys()])
  ].sort((left, right) => left - right)

  const stats: PairwiseZoneSolveStats = {
    solveRecordCount: 0,
    clipGroupCount: 0,
    initialFragmentCount: 0,
    maxActiveFragmentCount: 0,
    dedupeBeforeCount: 0,
    dedupeAfterCount: 0,
    dedupeEventCount: 0,
    clipTime: 0,
    dedupeTime: 0,
    emitTime: 0
  }

  if (pairwiseDashIndices.length !== 2) {
    return stats
  }

  const pairwiseRegionConstruction = buildPairwiseZoneRegionConstruction(
    overlapZone,
    stats
  )
  const [leftDashIndex, rightDashIndex] = pairwiseDashIndices

  const emitStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED ? performance.now() : 0
  pairwiseRegionConstruction.sharedRegions.forEach((region) => {
    emitAtomicRegion(
      region.polygon,
      region.bounds,
      [leftDashIndex, rightDashIndex],
      overlapZone.zoneId,
      false,
      region.polygonKey
    )
  })

  sourceDashIndices.forEach((sourceDashIndex) => {
    const exclusiveRegions =
      pairwiseRegionConstruction.exclusiveRegionsByDashIndex.get(
        sourceDashIndex
      ) ?? []
    exclusiveRegions.forEach((region) => {
      emitAtomicRegion(
        region.polygon,
        region.bounds,
        [sourceDashIndex],
        overlapZone.zoneId,
        false,
        region.polygonKey
      )
    })
  })
  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    stats.emitTime += performance.now() - emitStartedAt
  }

  return stats
}

const solveGeneralAtomicRegionsForZone = ({
  overlapZone,
  emitAtomicRegion
}: {
  overlapZone: PreparedGeneralPrimitiveOverlapZone
  emitAtomicRegion: (
    regionPolygon: Vec2[],
    regionBounds: PolygonBounds,
    coverageSet: number[],
    zoneId: string,
    mergeStable: boolean,
    polygonKey?: string
  ) => void
}): GeneralZoneSolveStats => {
  const stats: GeneralZoneSolveStats = {
    solveRecordCount: 0,
    clipGroupCount: 0,
    initialFragmentCount: 0,
    maxActiveFragmentCount: 0,
    dedupeBeforeCount: 0,
    dedupeAfterCount: 0,
    dedupeEventCount: 0,
    clipTime: 0,
    dedupeTime: 0,
    emitTime: 0
  }

  for (const solveRecord of overlapZone.solveRecords) {
    stats.solveRecordCount += 1
    const { sourceDashIndex, sourceShape, clipShapeGroups } = solveRecord

    if (clipShapeGroups.length === 0) {
      emitAtomicRegion(
        sourceShape.polygon,
        sourceShape.bounds,
        [sourceDashIndex],
        overlapZone.zoneId,
        false
      )
      continue
    }

    const fragment = createAtomicCoverageFragment(sourceShape.polygon, [
      sourceDashIndex
    ])
    if (!fragment) {
      continue
    }

    let activeFragments = [fragment]
    stats.initialFragmentCount += 1
    stats.maxActiveFragmentCount = Math.max(
      stats.maxActiveFragmentCount,
      activeFragments.length
    )

    for (const clipShapeGroup of clipShapeGroups) {
      stats.clipGroupCount += 1
      const clipDashIndex = clipShapeGroup.shapes[0]?.dashIndex ?? null
      const passthroughFragments: AtomicCoverageFragment[] = []
      const relevantFragments: AtomicCoverageFragment[] = []

      activeFragments.forEach((fragment) => {
        if (
          clipDashIndex === null ||
          fragment.coverageSet.includes(clipDashIndex) ||
          !boundsOverlap(fragment.bounds, clipShapeGroup.bounds)
        ) {
          passthroughFragments.push(fragment)
        } else {
          relevantFragments.push(fragment)
        }
      })

      if (relevantFragments.length === 0) {
        continue
      }

      const clipStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
        ? performance.now()
        : 0
      const completedFragments = [...passthroughFragments]
      let pendingFragments = relevantFragments
      let groupNeedsDedupe = false

      for (const clipShape of clipShapeGroup.shapes) {
        if (pendingFragments.length === 0) {
          break
        }

        const nextPendingFragments: AtomicCoverageFragment[] = []

        pendingFragments.forEach((fragment) => {
          const nextFragments = splitAtomicCoverageFragmentByClipShape(
            fragment,
            clipShape
          )

          if (nextFragments.length > 1) {
            groupNeedsDedupe = true
          }

          nextFragments.forEach((nextFragment) => {
            if (
              clipDashIndex !== null &&
              nextFragment.coverageSet.includes(clipDashIndex)
            ) {
              completedFragments.push(nextFragment)
            } else {
              nextPendingFragments.push(nextFragment)
            }
          })
        })

        pendingFragments = nextPendingFragments
      }

      activeFragments = completedFragments.concat(pendingFragments)
      stats.maxActiveFragmentCount = Math.max(
        stats.maxActiveFragmentCount,
        activeFragments.length
      )
      if (DASHED_GEOMETRY_PROFILE_ENABLED) {
        stats.clipTime += performance.now() - clipStartedAt
      }

      if (
        groupNeedsDedupe &&
        clipShapeGroup.shapes.length > 1 &&
        activeFragments.length > 1
      ) {
        const dedupeStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
          ? performance.now()
          : 0
        const beforeDedupeCount = activeFragments.length
        activeFragments = dedupeAtomicCoverageFragments(activeFragments)
        stats.dedupeBeforeCount += beforeDedupeCount
        stats.dedupeAfterCount += activeFragments.length
        stats.dedupeEventCount += 1
        if (DASHED_GEOMETRY_PROFILE_ENABLED) {
          stats.dedupeTime += performance.now() - dedupeStartedAt
        }
      }
    }

    const emitStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
      ? performance.now()
      : 0
    for (const fragment of activeFragments) {
      if (fragment.coverageSet[0] !== sourceDashIndex) {
        continue
      }

      if (
        fragment.coverageSet.length > 1 &&
        sourceDashIndex !== fragment.coverageSet[0]
      ) {
        continue
      }

      emitAtomicRegion(
        fragment.polygon,
        fragment.bounds,
        fragment.coverageSet,
        overlapZone.zoneId,
        false,
        fragment.polygonKey
      )
    }
    if (DASHED_GEOMETRY_PROFILE_ENABLED) {
      stats.emitTime += performance.now() - emitStartedAt
    }
  }

  return stats
}

const OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT = 16
const OVERLAP_ZONE_TILE_MIN_TRIANGLE_COUNT = 24
const OVERLAP_ZONE_GRID_MIN_TILE_COUNT = 4
const OVERLAP_ZONE_GRID_MAX_ASPECT_RATIO = 1.75

const getTriangleCentroid = (triangle: TriangleRecord) => {
  const [pointA, pointB, pointC] = triangle.polygon

  return {
    x: (pointA.x + pointB.x + pointC.x) / 3,
    y: (pointA.y + pointB.y + pointC.y) / 3
  }
}

const getShapeCentroid = (shape: ClipSolveShape) =>
  getPolygonCentroid(shape.polygon) ?? {
    x: (shape.bounds.minX + shape.bounds.maxX) / 2,
    y: (shape.bounds.minY + shape.bounds.maxY) / 2
  }

const buildPreparedPairwisePrimitiveOverlapZones = (
  zoneId: string,
  sourceShapesByDashIndex: Map<number, ClipSolveShape[]>,
  zoneBounds: PolygonBounds
) => {
  const allSourceShapes = [...sourceShapesByDashIndex.values()].flat()

  if (allSourceShapes.length === 0) {
    return [] as PreparedPrimitiveOverlapZone[]
  }

  if (allSourceShapes.length < OVERLAP_ZONE_TILE_MIN_TRIANGLE_COUNT) {
    return [
      {
        mode: 'pairwise',
        zoneId,
        sourceTriangles: [],
        sourceTrianglesByDashIndex: new Map(),
        pairwiseSourceShapesByDashIndex: sourceShapesByDashIndex,
        pairwiseClipShapesByDashIndex: sourceShapesByDashIndex,
        zoneBounds
      }
    ]
  }

  const zoneWidth = Math.max(EPS, zoneBounds.maxX - zoneBounds.minX)
  const zoneHeight = Math.max(EPS, zoneBounds.maxY - zoneBounds.minY)
  const aspectRatio = Math.max(zoneWidth / zoneHeight, zoneHeight / zoneWidth)
  const desiredTileCount = Math.max(
    2,
    Math.ceil(allSourceShapes.length / OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT)
  )
  const useGridTiling =
    desiredTileCount >= OVERLAP_ZONE_GRID_MIN_TILE_COUNT &&
    aspectRatio <= OVERLAP_ZONE_GRID_MAX_ASPECT_RATIO

  if (!useGridTiling) {
    const horizontalDominant = zoneWidth >= zoneHeight
    const sortedSourceShapes = [...allSourceShapes].sort((left, right) => {
      const leftCenter = horizontalDominant
        ? (left.bounds.minX + left.bounds.maxX) / 2
        : (left.bounds.minY + left.bounds.maxY) / 2
      const rightCenter = horizontalDominant
        ? (right.bounds.minX + right.bounds.maxX) / 2
        : (right.bounds.minY + right.bounds.maxY) / 2

      return leftCenter - rightCenter
    })
    const preparedZones: PreparedPrimitiveOverlapZone[] = []

    for (
      let startIndex = 0;
      startIndex < sortedSourceShapes.length;
      startIndex += OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT
    ) {
      const tileSourceShapes = sortedSourceShapes.slice(
        startIndex,
        startIndex + OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT
      )
      const tileBounds = tileSourceShapes.reduce<PolygonBounds>(
        (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
        tileSourceShapes[0].bounds
      )
      const tileSourceShapesByDashIndex = new Map<number, ClipSolveShape[]>()
      const tileClipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

      tileSourceShapes.forEach((shape) => {
        const dashShapes =
          tileSourceShapesByDashIndex.get(shape.dashIndex) ?? []
        dashShapes.push(shape)
        tileSourceShapesByDashIndex.set(shape.dashIndex, dashShapes)
      })

      sourceShapesByDashIndex.forEach((shapes, dashIndex) => {
        const relevantShapes = shapes.filter((shape) =>
          boundsOverlap(tileBounds, shape.bounds)
        )
        if (relevantShapes.length > 0) {
          tileClipShapesByDashIndex.set(dashIndex, relevantShapes)
        }
      })

      preparedZones.push({
        mode: 'pairwise',
        zoneId: `${zoneId}:tile:${preparedZones.length}`,
        sourceTriangles: [],
        sourceTrianglesByDashIndex: new Map(),
        pairwiseSourceShapesByDashIndex: tileSourceShapesByDashIndex,
        pairwiseClipShapesByDashIndex: tileClipShapesByDashIndex,
        zoneBounds: tileBounds
      })
    }

    return preparedZones
  }

  const estimatedColumns = Math.max(
    1,
    Math.round(Math.sqrt((desiredTileCount * zoneWidth) / zoneHeight))
  )
  const tileColumns = Math.min(desiredTileCount, estimatedColumns)
  const tileRows = Math.max(1, Math.ceil(desiredTileCount / tileColumns))
  const tileWidth = zoneWidth / tileColumns
  const tileHeight = zoneHeight / tileRows
  const sourceShapesByTileKey = new Map<string, ClipSolveShape[]>()

  allSourceShapes.forEach((shape) => {
    const centroid = getShapeCentroid(shape)
    const columnIndex = Math.max(
      0,
      Math.min(
        tileColumns - 1,
        Math.floor((centroid.x - zoneBounds.minX) / tileWidth)
      )
    )
    const rowIndex = Math.max(
      0,
      Math.min(
        tileRows - 1,
        Math.floor((centroid.y - zoneBounds.minY) / tileHeight)
      )
    )
    const tileKey = `${columnIndex}:${rowIndex}`
    const tileShapes = sourceShapesByTileKey.get(tileKey) ?? []
    tileShapes.push(shape)
    sourceShapesByTileKey.set(tileKey, tileShapes)
  })

  const preparedZones: PreparedPrimitiveOverlapZone[] = []

  for (const [tileKey, tileSourceShapes] of sourceShapesByTileKey) {
    const tileBounds = tileSourceShapes.reduce<PolygonBounds>(
      (bounds, shape) => mergeBounds(bounds, shape.bounds) ?? bounds,
      tileSourceShapes[0].bounds
    )
    const tileSourceShapesByDashIndex = new Map<number, ClipSolveShape[]>()
    const tileClipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

    tileSourceShapes.forEach((shape) => {
      const dashShapes = tileSourceShapesByDashIndex.get(shape.dashIndex) ?? []
      dashShapes.push(shape)
      tileSourceShapesByDashIndex.set(shape.dashIndex, dashShapes)
    })

    sourceShapesByDashIndex.forEach((shapes, dashIndex) => {
      const relevantShapes = shapes.filter((shape) =>
        boundsOverlap(tileBounds, shape.bounds)
      )
      if (relevantShapes.length > 0) {
        tileClipShapesByDashIndex.set(dashIndex, relevantShapes)
      }
    })

    preparedZones.push({
      mode: 'pairwise',
      zoneId: `${zoneId}:tile:${tileKey}`,
      sourceTriangles: [],
      sourceTrianglesByDashIndex: new Map(),
      pairwiseSourceShapesByDashIndex: tileSourceShapesByDashIndex,
      pairwiseClipShapesByDashIndex: tileClipShapesByDashIndex,
      zoneBounds: tileBounds
    })
  }

  return preparedZones
}

const buildPreparedPrimitiveOverlapZones = (
  zoneId: string,
  zonePrimitives: DashPrimitiveRecord[],
  zoneTriangles: TriangleRecord[],
  zoneBounds: PolygonBounds
) => {
  if (zoneTriangles.length === 0) {
    return [] as PreparedPrimitiveOverlapZone[]
  }

  const allTrianglesByDashIndex = buildTriangleGroupsByDashIndex(zoneTriangles)
  const allSourceShapesByDashIndex = buildPairwiseZoneSourceShapesByDashIndex(
    allTrianglesByDashIndex
  )
  const allClipShapesByDashIndex = buildClipSolveShapesByDashIndex(
    zonePrimitives,
    zoneTriangles
  )

  if (zoneTriangles.length < OVERLAP_ZONE_TILE_MIN_TRIANGLE_COUNT) {
    if (
      isPairwisePreparedOverlapZone({
        sourceTrianglesByDashIndex: allTrianglesByDashIndex,
        clipShapesByDashIndex: allClipShapesByDashIndex
      })
    ) {
      return [
        {
          mode: 'pairwise',
          zoneId,
          sourceTriangles: zoneTriangles,
          sourceTrianglesByDashIndex: allTrianglesByDashIndex,
          pairwiseSourceShapesByDashIndex: allSourceShapesByDashIndex,
          pairwiseClipShapesByDashIndex: allClipShapesByDashIndex,
          zoneBounds
        }
      ]
    }

    return [
      {
        mode: 'general',
        zoneId,
        sourceTriangles: zoneTriangles,
        sourceTrianglesByDashIndex: allTrianglesByDashIndex,
        sourceShapesByDashIndex: allSourceShapesByDashIndex,
        solveRecords: buildGeneralZoneSolveRecords(
          allSourceShapesByDashIndex,
          allClipShapesByDashIndex
        ),
        zoneBounds
      }
    ]
  }

  const zoneWidth = Math.max(EPS, zoneBounds.maxX - zoneBounds.minX)
  const zoneHeight = Math.max(EPS, zoneBounds.maxY - zoneBounds.minY)
  const aspectRatio = Math.max(zoneWidth / zoneHeight, zoneHeight / zoneWidth)
  const baseDesiredTileCount = Math.max(
    2,
    Math.ceil(zoneTriangles.length / OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT)
  )
  const useGridTiling =
    baseDesiredTileCount >= OVERLAP_ZONE_GRID_MIN_TILE_COUNT &&
    aspectRatio <= OVERLAP_ZONE_GRID_MAX_ASPECT_RATIO
  const desiredTileCount = Math.max(
    2,
    Math.ceil(zoneTriangles.length / OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT)
  )
  if (!useGridTiling) {
    const horizontalDominant = zoneWidth >= zoneHeight
    const sortedSourceTriangles = [...zoneTriangles].sort((left, right) => {
      const leftCenter = horizontalDominant
        ? (left.bounds.minX + left.bounds.maxX) / 2
        : (left.bounds.minY + left.bounds.maxY) / 2
      const rightCenter = horizontalDominant
        ? (right.bounds.minX + right.bounds.maxX) / 2
        : (right.bounds.minY + right.bounds.maxY) / 2

      return leftCenter - rightCenter
    })
    const preparedZones: PreparedPrimitiveOverlapZone[] = []

    for (
      let startIndex = 0;
      startIndex < sortedSourceTriangles.length;
      startIndex += OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT
    ) {
      const tileSourceTriangles = sortedSourceTriangles.slice(
        startIndex,
        startIndex + OVERLAP_ZONE_TILE_TARGET_TRIANGLE_COUNT
      )
      const tileBounds = tileSourceTriangles.reduce<PolygonBounds>(
        (bounds, triangle) => mergeBounds(bounds, triangle.bounds) ?? bounds,
        tileSourceTriangles[0].bounds
      )
      const tileSourceTrianglesByDashIndex =
        buildTriangleGroupsByDashIndex(tileSourceTriangles)
      const tileSourceShapesByDashIndex =
        buildPairwiseZoneSourceShapesByDashIndex(tileSourceTrianglesByDashIndex)
      const tileClipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

      allClipShapesByDashIndex.forEach((shapes, dashIndex) => {
        const relevantShapes = shapes.filter((shape) =>
          boundsOverlap(tileBounds, shape.bounds)
        )
        if (relevantShapes.length > 0) {
          tileClipShapesByDashIndex.set(dashIndex, relevantShapes)
        }
      })

      if (
        isPairwisePreparedOverlapZone({
          sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
          clipShapesByDashIndex: tileClipShapesByDashIndex
        })
      ) {
        preparedZones.push({
          mode: 'pairwise',
          zoneId: `${zoneId}:tile:${preparedZones.length}`,
          sourceTriangles: tileSourceTriangles,
          sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
          pairwiseSourceShapesByDashIndex: tileSourceShapesByDashIndex,
          pairwiseClipShapesByDashIndex: tileClipShapesByDashIndex,
          zoneBounds: tileBounds
        })
        continue
      }

      preparedZones.push({
        mode: 'general',
        zoneId: `${zoneId}:tile:${preparedZones.length}`,
        sourceTriangles: tileSourceTriangles,
        sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
        sourceShapesByDashIndex: tileSourceShapesByDashIndex,
        solveRecords: buildGeneralZoneSolveRecords(
          tileSourceShapesByDashIndex,
          tileClipShapesByDashIndex
        ),
        zoneBounds: tileBounds
      })
    }

    return preparedZones
  }

  const estimatedColumns = Math.max(
    1,
    Math.round(Math.sqrt((desiredTileCount * zoneWidth) / zoneHeight))
  )
  const tileColumns = Math.min(desiredTileCount, estimatedColumns)
  const tileRows = Math.max(1, Math.ceil(desiredTileCount / tileColumns))
  const tileWidth = zoneWidth / tileColumns
  const tileHeight = zoneHeight / tileRows
  const sourceTrianglesByTileKey = new Map<string, TriangleRecord[]>()

  zoneTriangles.forEach((triangle) => {
    const centroid = getTriangleCentroid(triangle)
    const columnIndex = Math.max(
      0,
      Math.min(
        tileColumns - 1,
        Math.floor((centroid.x - zoneBounds.minX) / tileWidth)
      )
    )
    const rowIndex = Math.max(
      0,
      Math.min(
        tileRows - 1,
        Math.floor((centroid.y - zoneBounds.minY) / tileHeight)
      )
    )
    const tileKey = `${columnIndex}:${rowIndex}`
    const tileTriangles = sourceTrianglesByTileKey.get(tileKey) ?? []
    tileTriangles.push(triangle)
    sourceTrianglesByTileKey.set(tileKey, tileTriangles)
  })
  const preparedZones: PreparedPrimitiveOverlapZone[] = []

  for (const [tileKey, tileSourceTriangles] of sourceTrianglesByTileKey) {
    const tileBounds = tileSourceTriangles.reduce<PolygonBounds>(
      (bounds, triangle) => mergeBounds(bounds, triangle.bounds) ?? bounds,
      tileSourceTriangles[0].bounds
    )
    const tileSourceTrianglesByDashIndex =
      buildTriangleGroupsByDashIndex(tileSourceTriangles)
    const tileSourceShapesByDashIndex =
      buildPairwiseZoneSourceShapesByDashIndex(tileSourceTrianglesByDashIndex)
    const tileClipShapesByDashIndex = new Map<number, ClipSolveShape[]>()

    allClipShapesByDashIndex.forEach((shapes, dashIndex) => {
      const relevantShapes = shapes.filter((shape) =>
        boundsOverlap(tileBounds, shape.bounds)
      )
      if (relevantShapes.length > 0) {
        tileClipShapesByDashIndex.set(dashIndex, relevantShapes)
      }
    })

    if (
      isPairwisePreparedOverlapZone({
        sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
        clipShapesByDashIndex: tileClipShapesByDashIndex
      })
    ) {
      preparedZones.push({
        mode: 'pairwise',
        zoneId: `${zoneId}:tile:${tileKey}`,
        sourceTriangles: tileSourceTriangles,
        sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
        pairwiseSourceShapesByDashIndex: tileSourceShapesByDashIndex,
        pairwiseClipShapesByDashIndex: tileClipShapesByDashIndex,
        zoneBounds: tileBounds
      })
      continue
    }

    preparedZones.push({
      mode: 'general',
      zoneId: `${zoneId}:tile:${tileKey}`,
      sourceTriangles: tileSourceTriangles,
      sourceTrianglesByDashIndex: tileSourceTrianglesByDashIndex,
      sourceShapesByDashIndex: tileSourceShapesByDashIndex,
      solveRecords: buildGeneralZoneSolveRecords(
        tileSourceShapesByDashIndex,
        tileClipShapesByDashIndex
      ),
      zoneBounds: tileBounds
    })
  }

  return preparedZones
}

const buildPreparedAtomicConflictComponent = (
  component: ConflictComponent,
  candidateMap: Map<number, DashCandidateRecord>,
  confirmedOverlapPairs: Set<string>
): PreparedAtomicConflictComponent | null => {
  const componentCandidates = component.dashIndices
    .map((dashIndex) => candidateMap.get(dashIndex))
    .filter(isDashCandidateRecord)
  const componentPairKeys = new Set<string>()

  component.dashIndices.forEach((leftDashIndex, leftIndex) => {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < component.dashIndices.length;
      rightIndex += 1
    ) {
      const rightDashIndex = component.dashIndices[rightIndex]
      const pairKey = createDashPairKey(leftDashIndex, rightDashIndex)

      if (confirmedOverlapPairs.has(pairKey)) {
        componentPairKeys.add(pairKey)
      }
    }
  })

  if (componentPairKeys.size === 0) {
    return null
  }

  const rawPrimitivePolygons = componentCandidates.flatMap((candidate) =>
    candidate.primitives.map((primitive) => ({
      ...primitive,
      touchedSegmentIndices: [...primitive.touchedSegmentIndices]
    }))
  )
  const preparedComponentCacheKey = `${[...componentPairKeys].join('|')}::${rawPrimitivePolygons
    .map(
      (primitivePolygon) =>
        `${primitivePolygon.id}::${createPolygonKey(primitivePolygon.polygon)}`
    )
    .join('||')}`
  const cachedPreparedComponent = preparedAtomicConflictComponentCache.get(
    preparedComponentCacheKey
  )

  if (cachedPreparedComponent) {
    return {
      componentCandidates,
      primitiveCount: cachedPreparedComponent.primitiveCount,
      overlapZones: cachedPreparedComponent.overlapZones,
      exclusivePrimitives: cachedPreparedComponent.exclusivePrimitives
    }
  }

  const rawOverlapIndex = buildPrimitiveOverlapIndex(
    rawPrimitivePolygons,
    componentPairKeys
  )
  const exclusivePrimitives = rawPrimitivePolygons.filter(
    (primitivePolygon) =>
      !rawOverlapIndex.contestedPrimitiveIds.has(primitivePolygon.id)
  )
  const finalContestedPrimitives = rawPrimitivePolygons.filter(
    (primitivePolygon) =>
      rawOverlapIndex.contestedPrimitiveIds.has(primitivePolygon.id)
  )
  const primitivePolygonById = new Map(
    finalContestedPrimitives.map((primitivePolygon) => [
      primitivePolygon.id,
      primitivePolygon
    ])
  )

  const overlapZones: PreparedPrimitiveOverlapZone[] = []
  const visitedPrimitiveIds = new Set<string>()

  finalContestedPrimitives.forEach((primitivePolygon) => {
    if (visitedPrimitiveIds.has(primitivePolygon.id)) {
      return
    }

    const stack = [primitivePolygon.id]
    const zonePrimitiveIds: string[] = []

    while (stack.length > 0) {
      const primitiveId = stack.pop()
      if (!primitiveId || visitedPrimitiveIds.has(primitiveId)) {
        continue
      }

      visitedPrimitiveIds.add(primitiveId)
      zonePrimitiveIds.push(primitiveId)
      rawOverlapIndex.overlappingPrimitiveIdsByPrimitiveId
        .get(primitiveId)
        ?.forEach((overlappingPrimitiveId) => {
          if (!visitedPrimitiveIds.has(overlappingPrimitiveId)) {
            stack.push(overlappingPrimitiveId)
          }
        })
    }

    if (zonePrimitiveIds.length <= 1) {
      return
    }

    const rawZonePrimitives = zonePrimitiveIds
      .map((primitiveId) => primitivePolygonById.get(primitiveId))
      .filter(
        (
          candidatePrimitivePolygon
        ): candidatePrimitivePolygon is DashPrimitiveRecord =>
          candidatePrimitivePolygon !== undefined
      )
    const zonePrimitives = buildDisjointZonePrimitives(
      zonePrimitiveIds.sort().join('|'),
      rawZonePrimitives
    )
    const zoneBounds = zonePrimitives.reduce<PolygonBounds>(
      (bounds, zonePrimitive) =>
        mergeBounds(bounds, zonePrimitive.bounds) ?? bounds,
      zonePrimitives[0].bounds
    )

    const zoneDashIndices = new Set(
      zonePrimitives.map((zonePrimitive) => zonePrimitive.dashIndex)
    )

    if (zoneDashIndices.size <= 2) {
      const pairwiseSourceShapesByDashIndex =
        buildPairwiseZoneSourceShapesByDashIndexFromPrimitives(zonePrimitives)
      overlapZones.push(
        ...buildPreparedPairwisePrimitiveOverlapZones(
          zonePrimitiveIds.sort().join('|'),
          pairwiseSourceShapesByDashIndex,
          zoneBounds
        )
      )
      return
    }

    const disjointZoneTriangles = buildPrimitiveTriangleRecords(zonePrimitives)

    if (disjointZoneTriangles.length === 0) {
      return
    }

    overlapZones.push(
      ...buildPreparedPrimitiveOverlapZones(
        zonePrimitiveIds.sort().join('|'),
        zonePrimitives,
        disjointZoneTriangles,
        zoneBounds
      )
    )
  })

  const cachedPreparedComponentValue = setCachedValueWithLimit(
    preparedAtomicConflictComponentCache,
    preparedComponentCacheKey,
    {
      primitiveCount:
        exclusivePrimitives.length + finalContestedPrimitives.length,
      overlapZones,
      exclusivePrimitives
    },
    MAX_PREPARED_CONFLICT_COMPONENT_CACHE_ENTRIES
  )

  return {
    componentCandidates,
    primitiveCount: cachedPreparedComponentValue.primitiveCount,
    overlapZones: cachedPreparedComponentValue.overlapZones,
    exclusivePrimitives: cachedPreparedComponentValue.exclusivePrimitives
  }
}

const buildAtomicRegionPreparationDiagnostics = (
  dashCandidates: DashCandidateRecord[],
  conflictComponents: ConflictComponent[],
  overlapGraph: OverlapGraph
): AtomicRegionPreparationDiagnostics[] => {
  const candidateMap = new Map(
    dashCandidates.map((candidate) => [candidate.dashIndex, candidate] as const)
  )
  const confirmedOverlapPairs = new Set(
    overlapGraph.edges.map((edge) =>
      edge.dashIndexA < edge.dashIndexB
        ? `${edge.dashIndexA}:${edge.dashIndexB}`
        : `${edge.dashIndexB}:${edge.dashIndexA}`
    )
  )

  return conflictComponents.flatMap((component, componentId) => {
    const preparedComponent = buildPreparedAtomicConflictComponent(
      component,
      candidateMap,
      confirmedOverlapPairs
    )
    if (!preparedComponent) {
      return []
    }

    const zonedTriangleCount = preparedComponent.overlapZones.reduce(
      (count, zone) =>
        count +
        (zone.mode === 'pairwise'
          ? [...zone.pairwiseSourceShapesByDashIndex.values()].reduce(
              (shapeCount, shapes) => shapeCount + shapes.length,
              0
            )
          : [...zone.sourceShapesByDashIndex.values()].reduce(
              (shapeCount, shapes) => shapeCount + shapes.length,
              0
            )),
      0
    )

    return [
      {
        componentId,
        dashCount: preparedComponent.componentCandidates.length,
        primitiveCount: preparedComponent.primitiveCount,
        contestedPrimitiveCount:
          preparedComponent.primitiveCount -
          preparedComponent.exclusivePrimitives.length,
        triangleCount: zonedTriangleCount,
        overlapZoneCount: preparedComponent.overlapZones.length,
        zonedTriangleCount,
        exclusivePrimitiveCount: preparedComponent.exclusivePrimitives.length,
        maxZoneTriangleCount: preparedComponent.overlapZones.reduce(
          (maxCount, zone) =>
            Math.max(
              maxCount,
              zone.mode === 'pairwise'
                ? [...zone.pairwiseSourceShapesByDashIndex.values()].reduce(
                    (shapeCount, shapes) => shapeCount + shapes.length,
                    0
                  )
                : [...zone.sourceShapesByDashIndex.values()].reduce(
                    (shapeCount, shapes) => shapeCount + shapes.length,
                    0
                  )
            ),
          0
        ),
        maxZoneClipTriangleCount: preparedComponent.overlapZones.reduce(
          (maxCount, zone) =>
            Math.max(
              maxCount,
              zone.mode === 'pairwise'
                ? [...zone.pairwiseClipShapesByDashIndex.values()].reduce(
                    (shapeCount, shapes) => Math.max(shapeCount, shapes.length),
                    0
                  )
                : zone.solveRecords.reduce(
                    (groupMax, solveRecord) =>
                      Math.max(
                        groupMax,
                        solveRecord.clipShapeGroups.reduce(
                          (triangleCount, clipShapeGroup) =>
                            triangleCount + clipShapeGroup.shapes.length,
                          0
                        )
                      ),
                    0
                  )
            ),
          0
        )
      }
    ]
  })
}

const buildAtomicRegions = (
  dashCandidates: DashCandidateRecord[],
  conflictComponents: ConflictComponent[],
  overlapGraph: OverlapGraph
): AtomicRegion[] => {
  const candidateMap = new Map(
    dashCandidates.map((candidate) => [candidate.dashIndex, candidate] as const)
  )
  const atomicRegions: AtomicRegion[] = []
  const atomicRegionKeys = new Set<string>()
  const confirmedOverlapPairs = new Set(
    overlapGraph.edges.map((edge) =>
      edge.dashIndexA < edge.dashIndexB
        ? `${edge.dashIndexA}:${edge.dashIndexB}`
        : `${edge.dashIndexB}:${edge.dashIndexA}`
    )
  )

  for (const [componentId, component] of conflictComponents.entries()) {
    const preparedComponent = measureDashedGeometryPhase(
      `phase4:component-${componentId}:prep`,
      () =>
        buildPreparedAtomicConflictComponent(
          component,
          candidateMap,
          confirmedOverlapPairs
        )
    )

    if (!preparedComponent) {
      continue
    }

    const emitAtomicRegion = (
      regionPolygon: Vec2[],
      regionBounds: PolygonBounds,
      coverageSet: number[],
      zoneId: string,
      mergeStable: boolean,
      polygonKey?: string
    ) => {
      const regionKey = `${polygonKey ?? createPolygonKey(regionPolygon)}::${coverageSet.join(',')}`
      if (atomicRegionKeys.has(regionKey)) {
        return
      }

      atomicRegionKeys.add(regionKey)
      atomicRegions.push({
        regionKey,
        componentId,
        zoneId,
        regionPolygon,
        bounds: regionBounds,
        coverageSet,
        edgeKeys: undefined,
        mergeStable
      })
    }

    measureDashedGeometryPhase(`phase4:component-${componentId}:zones`, () => {
      let componentClipTime = 0
      let componentDedupeTime = 0
      let componentEmitTime = 0
      let componentSolveRecordCount = 0
      let componentClipGroupCount = 0
      let componentInitialFragmentCount = 0
      let componentMaxActiveFragmentCount = 0
      let componentDedupeBeforeCount = 0
      let componentDedupeAfterCount = 0
      let componentDedupeEventCount = 0

      for (const overlapZone of preparedComponent.overlapZones) {
        if (overlapZone.mode === 'pairwise') {
          const pairwiseZoneStats = solvePairwiseAtomicRegionsForZone({
            overlapZone,
            emitAtomicRegion
          })
          componentClipTime += pairwiseZoneStats.clipTime
          componentDedupeTime += pairwiseZoneStats.dedupeTime
          componentEmitTime += pairwiseZoneStats.emitTime
          componentSolveRecordCount += pairwiseZoneStats.solveRecordCount
          componentClipGroupCount += pairwiseZoneStats.clipGroupCount
          componentInitialFragmentCount +=
            pairwiseZoneStats.initialFragmentCount
          componentMaxActiveFragmentCount = Math.max(
            componentMaxActiveFragmentCount,
            pairwiseZoneStats.maxActiveFragmentCount
          )
          componentDedupeBeforeCount += pairwiseZoneStats.dedupeBeforeCount
          componentDedupeAfterCount += pairwiseZoneStats.dedupeAfterCount
          componentDedupeEventCount += pairwiseZoneStats.dedupeEventCount

          if (DASHED_GEOMETRY_PROFILE_ENABLED) {
            process.stdout.write(
              `[dashed-geometry-profile] phase4:component-${componentId}:zone:${overlapZone.zoneId}:solve-records=${pairwiseZoneStats.solveRecordCount} clip-groups=${pairwiseZoneStats.clipGroupCount} initial-fragments=${pairwiseZoneStats.initialFragmentCount} max-active-fragments=${pairwiseZoneStats.maxActiveFragmentCount} dedupe-events=${pairwiseZoneStats.dedupeEventCount} dedupe-before=${pairwiseZoneStats.dedupeBeforeCount} dedupe-after=${pairwiseZoneStats.dedupeAfterCount} mode=pairwise\n`
            )
          }

          continue
        }

        const generalOverlapZone = overlapZone
        const generalZoneStats = solveGeneralAtomicRegionsForZone({
          overlapZone: generalOverlapZone,
          emitAtomicRegion
        })

        componentClipTime += generalZoneStats.clipTime
        componentDedupeTime += generalZoneStats.dedupeTime
        componentEmitTime += generalZoneStats.emitTime
        componentSolveRecordCount += generalZoneStats.solveRecordCount
        componentClipGroupCount += generalZoneStats.clipGroupCount
        componentInitialFragmentCount += generalZoneStats.initialFragmentCount
        componentMaxActiveFragmentCount = Math.max(
          componentMaxActiveFragmentCount,
          generalZoneStats.maxActiveFragmentCount
        )
        componentDedupeBeforeCount += generalZoneStats.dedupeBeforeCount
        componentDedupeAfterCount += generalZoneStats.dedupeAfterCount
        componentDedupeEventCount += generalZoneStats.dedupeEventCount

        if (DASHED_GEOMETRY_PROFILE_ENABLED) {
          process.stdout.write(
            `[dashed-geometry-profile] phase4:component-${componentId}:zone:${generalOverlapZone.zoneId}:solve-records=${generalZoneStats.solveRecordCount} clip-groups=${generalZoneStats.clipGroupCount} initial-fragments=${generalZoneStats.initialFragmentCount} max-active-fragments=${generalZoneStats.maxActiveFragmentCount} dedupe-events=${generalZoneStats.dedupeEventCount} dedupe-before=${generalZoneStats.dedupeBeforeCount} dedupe-after=${generalZoneStats.dedupeAfterCount} mode=general\n`
          )
        }
      }

      if (DASHED_GEOMETRY_PROFILE_ENABLED) {
        process.stdout.write(
          `[dashed-geometry-profile] phase4:component-${componentId}:zones:clip: ${componentClipTime.toFixed(2)}ms\n`
        )
        process.stdout.write(
          `[dashed-geometry-profile] phase4:component-${componentId}:zones:dedupe: ${componentDedupeTime.toFixed(2)}ms\n`
        )
        process.stdout.write(
          `[dashed-geometry-profile] phase4:component-${componentId}:zones:emit: ${componentEmitTime.toFixed(2)}ms\n`
        )
        process.stdout.write(
          `[dashed-geometry-profile] phase4:component-${componentId}:zones:summary: solve-records=${componentSolveRecordCount} clip-groups=${componentClipGroupCount} initial-fragments=${componentInitialFragmentCount} max-active-fragments=${componentMaxActiveFragmentCount} dedupe-events=${componentDedupeEventCount} dedupe-before=${componentDedupeBeforeCount} dedupe-after=${componentDedupeAfterCount}\n`
        )
      }
    })

    for (const primitive of preparedComponent.exclusivePrimitives) {
      const cell = createAtomicCellRecord(primitive.polygon)
      if (!cell) {
        continue
      }

      emitAtomicRegion(
        cell.polygon,
        cell.bounds,
        [primitive.dashIndex],
        `exclusive:${primitive.id}`,
        true
      )
    }
  }

  return measureDashedGeometryPhase('phase4:merge-atomic-regions', () =>
    mergeAtomicRegionsByCoverageSet(atomicRegions)
  )
}

const ROUND_CAP_MAX_SAGITTA = 0.05
const MIN_ROUND_CAP_STEP_ANGLE = Math.PI / 32

const getArcStepAngle = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= EPS || radius <= 0.5) {
    return MIN_ROUND_CAP_STEP_ANGLE
  }

  const cosine = 1 - ROUND_CAP_MAX_SAGITTA / radius
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, cosine)))
  if (!Number.isFinite(step) || step <= EPS) {
    return MIN_ROUND_CAP_STEP_ANGLE
  }

  return Math.min(step, MIN_ROUND_CAP_STEP_ANGLE)
}

const buildArcPoints = (
  center: Vec2,
  fromAngle: number,
  toAngle: number,
  radius: number,
  clockwise: boolean
): Vec2[] => {
  let endAngle = toAngle
  if (clockwise) {
    while (endAngle >= fromAngle - EPS) {
      endAngle -= Math.PI * 2
    }
  } else {
    while (endAngle <= fromAngle + EPS) {
      endAngle += Math.PI * 2
    }
  }

  const sweep = endAngle - fromAngle
  const stepAngle = getArcStepAngle(radius)
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / stepAngle))
  const points: Vec2[] = []

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps
    const angle = fromAngle + sweep * t
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }

  return points
}

const getArcSweep = (
  fromAngle: number,
  toAngle: number,
  clockwise: boolean
) => {
  let endAngle = toAngle
  if (clockwise) {
    while (endAngle >= fromAngle - EPS) {
      endAngle -= Math.PI * 2
    }
  } else {
    while (endAngle <= fromAngle + EPS) {
      endAngle += Math.PI * 2
    }
  }

  return endAngle - fromAngle
}

const chooseStrokeCapArcClockwise = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  capDirection: Vec2
) => {
  const startAngle = Math.atan2(
    startPoint.y - center.y,
    startPoint.x - center.x
  )
  const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x)
  const targetDirection = normalizeVector(capDirection)
  if (!targetDirection) {
    return false
  }

  const ccwSweep = getArcSweep(startAngle, endAngle, false)
  const cwSweep = getArcSweep(startAngle, endAngle, true)
  const ccwMidAngle = startAngle + ccwSweep / 2
  const cwMidAngle = startAngle + cwSweep / 2
  const ccwDot =
    Math.cos(ccwMidAngle) * targetDirection.x +
    Math.sin(ccwMidAngle) * targetDirection.y
  const cwDot =
    Math.cos(cwMidAngle) * targetDirection.x +
    Math.sin(cwMidAngle) * targetDirection.y

  return cwDot > ccwDot
}

const getBoundaryCapDirection = (
  boundary: Vec2[],
  fallback: Vec2,
  atStart: boolean
) => {
  if (boundary.length < 2) {
    return fallback
  }

  return atStart
    ? subtractVec2(boundary[0], boundary[1])
    : subtractVec2(boundary[boundary.length - 1], boundary[boundary.length - 2])
}

const buildStrokeCapArcPoints = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  radius: number,
  clockwise: boolean
) =>
  buildArcPoints(
    center,
    Math.atan2(startPoint.y - center.y, startPoint.x - center.x),
    Math.atan2(endPoint.y - center.y, endPoint.x - center.x),
    radius,
    clockwise
  )

const buildStrokeStripPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[]
) => {
  const stripPolygon = dedupeClosedPolygonPoints([
    ...outerBoundary,
    ...[...innerBoundary].reverse()
  ])

  return stripPolygon.length >= 3 ? stripPolygon : null
}

const buildStrokeStripQuadPolygons = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[]
) => {
  const polygonCount = Math.min(outerBoundary.length, innerBoundary.length) - 1
  if (polygonCount <= 0) {
    return []
  }

  const polygons: Vec2[][] = []
  for (let index = 0; index < polygonCount; index += 1) {
    const quad = dedupeClosedPolygonPoints([
      outerBoundary[index],
      outerBoundary[index + 1],
      innerBoundary[index + 1],
      innerBoundary[index]
    ])

    if (quad.length < 3 || Math.abs(polygonArea(quad)) <= EPS) {
      continue
    }

    if (isSimplePolygon(quad)) {
      polygons.push(quad)
    }
  }

  return polygons
}

const buildStrokeStripSpanPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  startIndex: number,
  endIndex: number
) => {
  const polygon = dedupeClosedPolygonPoints([
    ...outerBoundary.slice(startIndex, endIndex + 1),
    ...innerBoundary.slice(startIndex, endIndex + 1).reverse()
  ])

  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= EPS) {
    return null
  }

  return isSimplePolygon(polygon) ? polygon : null
}

const buildStrokeStripSpanPolygons = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[]
) => {
  const lastIndex = Math.min(outerBoundary.length, innerBoundary.length) - 1
  if (lastIndex <= 0) {
    return []
  }

  const polygons: Vec2[][] = []
  let startIndex = 0

  while (startIndex < lastIndex) {
    let bestPolygon: Vec2[] | null = null
    let bestEndIndex = startIndex + 1

    for (let endIndex = startIndex + 1; endIndex <= lastIndex; endIndex += 1) {
      const candidate = buildStrokeStripSpanPolygon(
        outerBoundary,
        innerBoundary,
        startIndex,
        endIndex
      )
      if (!candidate) {
        continue
      }

      bestPolygon = candidate
      bestEndIndex = endIndex
    }

    if (bestPolygon) {
      polygons.push(bestPolygon)
      startIndex = bestEndIndex
      continue
    }

    polygons.push(
      ...buildStrokeStripQuadPolygons(
        outerBoundary.slice(startIndex, startIndex + 2),
        innerBoundary.slice(startIndex, startIndex + 2)
      )
    )
    startIndex += 1
  }

  return polygons
}

interface StrokeJoinSideResolution {
  prevEnd: Vec2
  nextStart: Vec2
  joinPolygon: Vec2[] | null
}

const resolveStrokeJoinSide = (
  previous: ShiftedSegment,
  next: ShiftedSegment,
  vertex: Vec2,
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>
): StrokeJoinSideResolution => {
  const turn =
    previous.direction.x * next.direction.y -
    previous.direction.y * next.direction.x
  const outerTurn = turn * signedDistance > EPS
  const intersection = intersectLines(
    previous.start,
    previous.end,
    next.start,
    next.end
  )
  const previousBackward = intersection
    ? dotVec2(subtractVec2(previous.end, intersection), previous.direction)
    : -Infinity
  const nextForward = intersection
    ? dotVec2(subtractVec2(intersection, next.start), next.direction)
    : -Infinity
  const validIntersection =
    intersection !== null && previousBackward >= -EPS && nextForward >= -EPS

  if (outerTurn && stroke.join === 'round') {
    const joinPolygon = dedupeClosedPolygonPoints([
      previous.end,
      ...buildStrokeCapArcPoints(
        vertex,
        previous.end,
        next.start,
        Math.abs(signedDistance),
        signedDistance < 0
      ),
      next.start
    ])

    return {
      prevEnd: previous.end,
      nextStart: next.start,
      joinPolygon:
        joinPolygon.length >= 3 &&
        Math.abs(polygonArea(joinPolygon)) > EPS &&
        isSimplePolygon(joinPolygon)
          ? joinPolygon
          : null
    }
  }

  if (outerTurn && stroke.join === 'bevel') {
    return {
      prevEnd: previous.end,
      nextStart: next.start,
      joinPolygon: null
    }
  }

  if (outerTurn && stroke.join === 'miter' && validIntersection) {
    const miterLength = distance(intersection, vertex)
    const miterLimitDistance = Math.abs(signedDistance) * stroke.miterLimit
    if (miterLength <= miterLimitDistance + EPS) {
      return {
        prevEnd: intersection,
        nextStart: intersection,
        joinPolygon: null
      }
    }

    return {
      prevEnd: previous.end,
      nextStart: next.start,
      joinPolygon: null
    }
  }

  if (validIntersection) {
    return {
      prevEnd: intersection,
      nextStart: intersection,
      joinPolygon: null
    }
  }

  const midpoint = scaleVec2(addVec2(previous.end, next.start), 0.5)
  return {
    prevEnd: midpoint,
    nextStart: midpoint,
    joinPolygon: null
  }
}

const buildDecomposedStrokeOutlinePrimitivePolygons = (
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
): StrokePrimitivePolygon[] => {
  if (centerlinePoints.length < 2 || stroke.width <= EPS) {
    return []
  }

  const halfWidth = stroke.width / 2
  const positiveSegments = centerlinePoints
    .slice(0, -1)
    .map((point, index) =>
      createShiftedSegment(point, centerlinePoints[index + 1], halfWidth)
    )
  const negativeSegments = centerlinePoints
    .slice(0, -1)
    .map((point, index) =>
      createShiftedSegment(point, centerlinePoints[index + 1], -halfWidth)
    )

  if (
    positiveSegments.some((segment) => !segment) ||
    negativeSegments.some((segment) => !segment)
  ) {
    return []
  }

  const outerSegments = positiveSegments as ShiftedSegment[]
  const innerSegments = negativeSegments as ShiftedSegment[]
  const outerStarts = outerSegments.map((segment) => segment.start)
  const outerEnds = outerSegments.map((segment) => segment.end)
  const innerStarts = innerSegments.map((segment) => segment.start)
  const innerEnds = innerSegments.map((segment) => segment.end)
  const joinPolygons: Vec2[][] = []

  for (let index = 1; index < centerlinePoints.length - 1; index += 1) {
    const vertex = centerlinePoints[index]
    const outerResolution = resolveStrokeJoinSide(
      outerSegments[index - 1],
      outerSegments[index],
      vertex,
      halfWidth,
      stroke
    )
    const innerResolution = resolveStrokeJoinSide(
      innerSegments[index - 1],
      innerSegments[index],
      vertex,
      -halfWidth,
      stroke
    )

    outerEnds[index - 1] = outerResolution.prevEnd
    outerStarts[index] = outerResolution.nextStart
    innerEnds[index - 1] = innerResolution.prevEnd
    innerStarts[index] = innerResolution.nextStart

    if (outerResolution.joinPolygon) {
      joinPolygons.push(outerResolution.joinPolygon)
    }
    if (innerResolution.joinPolygon) {
      joinPolygons.push(innerResolution.joinPolygon)
    }
  }

  const primitives: StrokePrimitivePolygon[] = outerSegments.flatMap(
    (_, index) => {
      const quad = dedupeClosedPolygonPoints([
        outerStarts[index],
        outerEnds[index],
        innerEnds[index],
        innerStarts[index]
      ])

      return quad.length >= 3 &&
        Math.abs(polygonArea(quad)) > EPS &&
        isSimplePolygon(quad)
        ? [
            {
              kind: 'body' as const,
              touchedSegmentIndices: [index],
              polygon: quad
            }
          ]
        : []
    }
  )

  const startCap = capOptions.start
    ? buildStrokeStartCapPolygon(
        [outerStarts[0], outerEnds[0]],
        [innerStarts[0], innerEnds[0]],
        [centerlinePoints[0], centerlinePoints[1]],
        stroke
      )
    : null
  const endCap = capOptions.end
    ? buildStrokeEndCapPolygon(
        [outerStarts[outerStarts.length - 1], outerEnds[outerEnds.length - 1]],
        [innerStarts[innerStarts.length - 1], innerEnds[innerEnds.length - 1]],
        [
          centerlinePoints[centerlinePoints.length - 2],
          centerlinePoints[centerlinePoints.length - 1]
        ],
        stroke
      )
    : null

  if (startCap) {
    primitives.push({
      kind: 'cap',
      touchedSegmentIndices: [0],
      polygon: startCap
    })
  }
  if (endCap) {
    primitives.push({
      kind: 'cap',
      touchedSegmentIndices: [centerlinePoints.length - 2],
      polygon: endCap
    })
  }

  joinPolygons.forEach((polygon, index) => {
    primitives.push({
      kind: 'join',
      touchedSegmentIndices: [index, index + 1],
      polygon
    })
  })

  return primitives
}

const buildDecomposedStrokeOutlinePolygons = (
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>
) =>
  buildDecomposedStrokeOutlinePrimitivePolygons(centerlinePoints, stroke).map(
    (primitive) => primitive.polygon
  )

const filterTinyBodyShardPolygons = (
  polygons: Vec2[][],
  strokeWidth: number
): Vec2[][] => {
  if (polygons.length <= 1) {
    return polygons
  }

  const absoluteAreas = polygons.map((polygon) =>
    Math.abs(polygonArea(polygon))
  )
  const largestArea = Math.max(...absoluteAreas)
  const shardAreaThreshold = Math.max(strokeWidth * strokeWidth * 0.25, 1)

  const filtered = polygons.filter((polygon, index) => {
    const area = absoluteAreas[index]
    return area >= shardAreaThreshold || area >= largestArea * 0.3
  })

  return filtered.length > 0 ? filtered : polygons
}

const clipPolygonToHalfPlane = (
  polygon: Vec2[],
  planePoint: Vec2,
  planeNormal: Vec2
) => {
  if (polygon.length < 3) {
    return []
  }

  const result: Vec2[] = []
  const signedDistance = (point: Vec2) =>
    dotVec2(subtractVec2(point, planePoint), planeNormal)

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const currentDistance = signedDistance(current)
    const nextDistance = signedDistance(next)
    const currentInside = currentDistance >= -EPS
    const nextInside = nextDistance >= -EPS

    if (currentInside) {
      result.push(current)
    }

    if (currentInside === nextInside) {
      continue
    }

    const edge = subtractVec2(next, current)
    const denominator = dotVec2(edge, planeNormal)
    if (Math.abs(denominator) <= EPS) {
      continue
    }

    const t = Math.max(0, Math.min(1, -currentDistance / denominator))
    result.push(addVec2(current, scaleVec2(edge, t)))
  }

  const clipped = dedupeClosedPolygonPoints(result)
  return clipped.length >= 3 && Math.abs(polygonArea(clipped)) > EPS
    ? clipped
    : []
}

const splitFramesAtSegmentSeams = (frames: PathSampleFrame[]) => {
  if (frames.length === 0) {
    return []
  }

  if (frames.length === 1) {
    return [[{ ...frames[0] }]]
  }

  const pieces: PathSampleFrame[][] = []
  let currentPiece: PathSampleFrame[] = [{ ...frames[0] }]

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const frame = frames[index]
    const segmentChanged =
      previous.segmentIndex !== undefined &&
      frame.segmentIndex !== undefined &&
      previous.segmentIndex !== frame.segmentIndex
    const seamIsSharp =
      (previous.joinAnchorType ?? frame.joinAnchorType) === 'sharp'

    if (!segmentChanged || !seamIsSharp) {
      currentPiece.push({ ...frame })
      continue
    }

    currentPiece[currentPiece.length - 1] = {
      ...previous,
      joinAnchorType: undefined,
      joinSourcePoint: undefined,
      joinIncomingTangent: undefined,
      joinOutgoingTangent: undefined
    }
    pieces.push(currentPiece)
    currentPiece = [
      {
        ...previous,
        tangent: previous.joinOutgoingTangent ?? frame.tangent,
        segmentIndex: frame.segmentIndex,
        joinAnchorType: undefined,
        joinSourcePoint: undefined,
        joinIncomingTangent: undefined,
        joinOutgoingTangent: undefined
      },
      { ...frame }
    ]
  }

  pieces.push(currentPiece)
  return pieces.filter((piece) => piece.length >= 2)
}

const buildOffsetBoundary = (
  points: Vec2[],
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>
) => {
  if (points.length < 2 || Math.abs(signedDistance) <= EPS) {
    return [...points]
  }

  const segments = points
    .slice(0, -1)
    .map((point, index) =>
      createShiftedSegment(point, points[index + 1], signedDistance)
    )
  if (segments.some((segment) => !segment)) {
    return []
  }

  const validSegments = segments as ShiftedSegment[]
  const boundary: Vec2[] = [validSegments[0].start]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = validSegments[index - 1]
    const next = validSegments[index]
    const originalPoint = points[index]
    const previousEnd = previous.end
    const nextStart = next.start
    const turn =
      previous.direction.x * next.direction.y -
      previous.direction.y * next.direction.x
    const outerTurn = turn * signedDistance > EPS
    const significantTurn =
      dotVec2(previous.direction, next.direction) <= Math.cos(Math.PI / 10)
    const intersection = intersectLines(
      previous.start,
      previous.end,
      next.start,
      next.end
    )
    const previousBackward = intersection
      ? dotVec2(subtractVec2(previous.end, intersection), previous.direction)
      : -Infinity
    const nextForward = intersection
      ? dotVec2(subtractVec2(intersection, next.start), next.direction)
      : -Infinity
    const validIntersection =
      intersection !== null && previousBackward >= -EPS && nextForward >= -EPS

    if (outerTurn && significantTurn && stroke.join === 'round') {
      boundary.push(previousEnd)
      boundary.push(
        ...buildStrokeCapArcPoints(
          originalPoint,
          previousEnd,
          nextStart,
          Math.abs(signedDistance),
          signedDistance < 0
        )
      )
      continue
    }

    if (outerTurn && significantTurn && stroke.join === 'bevel') {
      boundary.push(previousEnd, nextStart)
      continue
    }

    if (
      outerTurn &&
      significantTurn &&
      stroke.join === 'miter' &&
      validIntersection
    ) {
      const miterLength = distance(intersection, originalPoint)
      const miterLimitDistance = Math.abs(signedDistance) * stroke.miterLimit
      if (miterLength <= miterLimitDistance + EPS) {
        boundary.push(intersection)
        continue
      }

      boundary.push(previousEnd, nextStart)
      continue
    }

    if (validIntersection) {
      boundary.push(intersection)
      continue
    }

    boundary.push(scaleVec2(addVec2(previousEnd, nextStart), 0.5))
  }

  boundary.push(validSegments[validSegments.length - 1].end)
  return dedupeAdjacentPoints(boundary)
}

const buildStrokeStartCapPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return null
  }

  const radius = stroke.width / 2
  const firstCenter = centerlinePoints[0]
  const firstOuter = outerBoundary[0]
  const firstInner = innerBoundary[0]
  const capDirection = getBoundaryCapDirection(
    outerBoundary,
    subtractVec2(firstCenter, centerlinePoints[1] ?? firstCenter),
    true
  )
  const startCap = dedupeClosedPolygonPoints([
    firstInner,
    ...buildStrokeCapArcPoints(
      firstCenter,
      firstInner,
      firstOuter,
      radius,
      chooseStrokeCapArcClockwise(
        firstCenter,
        firstInner,
        firstOuter,
        capDirection
      )
    ),
    firstOuter
  ])

  return startCap.length >= 3 ? startCap : null
}

const buildStrokeEndCapPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return null
  }

  const radius = stroke.width / 2
  const lastIndex = centerlinePoints.length - 1
  const lastCenter = centerlinePoints[lastIndex]
  const lastOuter = outerBoundary[outerBoundary.length - 1]
  const lastInner = innerBoundary[innerBoundary.length - 1]
  const capDirection = getBoundaryCapDirection(
    outerBoundary,
    subtractVec2(lastCenter, centerlinePoints[lastIndex - 1] ?? lastCenter),
    false
  )
  const endCap = dedupeClosedPolygonPoints([
    lastOuter,
    ...buildStrokeCapArcPoints(
      lastCenter,
      lastOuter,
      lastInner,
      radius,
      chooseStrokeCapArcClockwise(
        lastCenter,
        lastOuter,
        lastInner,
        capDirection
      )
    ),
    lastInner
  ])

  return endCap.length >= 3 ? endCap : null
}

const applySquareCapsToCenterline = (
  centerlinePoints: Vec2[],
  startTangent: Vec2,
  endTangent: Vec2,
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'square' || centerlinePoints.length < 2) {
    return [...centerlinePoints]
  }

  const radius = stroke.width / 2
  const adjusted = [...centerlinePoints]
  adjusted[0] = subtractVec2(adjusted[0], scaleVec2(startTangent, radius))
  adjusted[adjusted.length - 1] = addVec2(
    adjusted[adjusted.length - 1],
    scaleVec2(endTangent, radius)
  )
  return adjusted
}

const applySquareCapsToFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'square' || frames.length < 2) {
    return frames.map((frame) => ({
      ...frame,
      point: { ...frame.point },
      tangent: { ...frame.tangent }
    }))
  }

  const radius = stroke.width / 2
  return frames.map((frame, index) => {
    if (index === 0) {
      return {
        ...frame,
        point: subtractVec2(frame.point, scaleVec2(frame.tangent, radius)),
        tangent: frame.tangent
      }
    }

    if (index === frames.length - 1) {
      return {
        ...frame,
        point: addVec2(frame.point, scaleVec2(frame.tangent, radius)),
        tangent: frame.tangent
      }
    }

    return {
      ...frame,
      point: { ...frame.point },
      tangent: { ...frame.tangent }
    }
  })
}

const buildSmoothOffsetBoundaryFromFrames = (
  frames: PathSampleFrame[],
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>
) =>
  dedupeAdjacentPoints(
    frames.flatMap((frame, index) => {
      const normal = createLeftNormalFromTangent(frame.tangent)
      const defaultPoint = normal
        ? addVec2(frame.point, scaleVec2(normal, signedDistance))
        : frame.point

      if (
        index === 0 ||
        index === frames.length - 1 ||
        frame.joinAnchorType !== 'sharp'
      ) {
        return [defaultPoint]
      }

      const previousReferenceLength = Math.max(
        distance(frames[index - 1].point, frame.point),
        Math.abs(signedDistance) * 2,
        1
      )
      const nextReferenceLength = Math.max(
        distance(frame.point, frames[index + 1].point),
        Math.abs(signedDistance) * 2,
        1
      )
      const previousSourceStart = frame.joinIncomingTangent
        ? subtractVec2(
            frame.point,
            scaleVec2(frame.joinIncomingTangent, previousReferenceLength)
          )
        : frames[index - 1].point
      const nextSourceEnd = frame.joinOutgoingTangent
        ? addVec2(
            frame.point,
            scaleVec2(frame.joinOutgoingTangent, nextReferenceLength)
          )
        : frames[index + 1].point

      const previous = createShiftedSegment(
        previousSourceStart,
        frame.point,
        signedDistance
      )
      const next = createShiftedSegment(
        frame.point,
        nextSourceEnd,
        signedDistance
      )
      if (!previous || !next) {
        return [defaultPoint]
      }

      const turn =
        previous.direction.x * next.direction.y -
        previous.direction.y * next.direction.x
      const outerTurn = turn * signedDistance > EPS
      const intersection = intersectLines(
        previous.start,
        previous.end,
        next.start,
        next.end
      )
      const previousBackward = intersection
        ? dotVec2(subtractVec2(previous.end, intersection), previous.direction)
        : -Infinity
      const nextForward = intersection
        ? dotVec2(subtractVec2(intersection, next.start), next.direction)
        : -Infinity
      const validIntersection =
        intersection !== null && previousBackward >= -EPS && nextForward >= -EPS

      if (outerTurn && stroke.join === 'round') {
        return [
          previous.end,
          ...buildStrokeCapArcPoints(
            frame.point,
            previous.end,
            next.start,
            Math.abs(signedDistance),
            signedDistance < 0
          )
        ]
      }

      if (outerTurn && stroke.join === 'bevel') {
        return [previous.end, next.start]
      }

      if (outerTurn && stroke.join === 'miter' && validIntersection) {
        const miterLength = distance(intersection, frame.point)
        const miterLimitDistance = Math.abs(signedDistance) * stroke.miterLimit
        if (miterLength <= miterLimitDistance + EPS) {
          return [intersection]
        }

        return [previous.end, next.start]
      }

      if (validIntersection) {
        return [intersection]
      }

      return [defaultPoint]
    })
  )

const buildOpenStrokeOutlinePolygonsFromFrames = (
  centerlineFrames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
) => {
  if (centerlineFrames.length < 2 || stroke.width <= EPS) {
    return []
  }

  const adjustedFrames = applySquareCapsToFrames(centerlineFrames, stroke)
  const usesSharpPolylineBoundary = subpathHasSharpJoin(adjustedFrames)
  const outlineFrames = usesSharpPolylineBoundary
    ? collapseSharpNeighborhoodFramesForOutline(adjustedFrames, stroke.width)
    : adjustedFrames
  const adjustedCenterlinePoints = outlineFrames.map((frame) => frame.point)
  if (usesSharpPolylineBoundary) {
    const decomposedPolygons = buildDecomposedStrokeOutlinePolygons(
      adjustedCenterlinePoints,
      stroke
    )
    if (decomposedPolygons.length > 0) {
      return decomposedPolygons
    }
  }

  const outerBoundary = usesSharpPolylineBoundary
    ? buildOffsetBoundary(adjustedCenterlinePoints, stroke.width / 2, stroke)
    : buildSmoothOffsetBoundaryFromFrames(
        outlineFrames,
        stroke.width / 2,
        stroke
      )
  const innerBoundary = usesSharpPolylineBoundary
    ? buildOffsetBoundary(adjustedCenterlinePoints, -stroke.width / 2, stroke)
    : buildSmoothOffsetBoundaryFromFrames(
        outlineFrames,
        -stroke.width / 2,
        stroke
      )

  if (
    outerBoundary.length < 2 ||
    innerBoundary.length < 2 ||
    adjustedCenterlinePoints.length < 2
  ) {
    return []
  }

  return buildOpenStrokeOutlinePolygonsFromBoundarySource(
    {
      centerlinePoints: adjustedCenterlinePoints,
      outerBoundary,
      innerBoundary
    },
    stroke,
    usesSharpPolylineBoundary,
    capOptions
  )
}

const buildSmoothStrokeCapBoundarySource = (
  centerlineFrames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>
): StrokeCapBoundarySource | null => {
  if (centerlineFrames.length < 2 || stroke.width <= EPS) {
    return null
  }

  const adjustedFrames = applySquareCapsToFrames(centerlineFrames, stroke)
  const centerlinePoints = adjustedFrames.map((frame) => frame.point)
  const outerBoundary = buildSmoothOffsetBoundaryFromFrames(
    adjustedFrames,
    stroke.width / 2,
    stroke
  )
  const innerBoundary = buildSmoothOffsetBoundaryFromFrames(
    adjustedFrames,
    -stroke.width / 2,
    stroke
  )

  if (
    centerlinePoints.length < 2 ||
    outerBoundary.length < 2 ||
    innerBoundary.length < 2
  ) {
    return null
  }

  return {
    centerlinePoints,
    outerBoundary,
    innerBoundary
  }
}

const buildOpenStrokeOutlinePolygonsFromBoundarySource = (
  boundarySource: StrokeCapBoundarySource,
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  usesSharpPolylineBoundary: boolean,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
) => {
  const { centerlinePoints, outerBoundary, innerBoundary } = boundarySource

  if (
    outerBoundary.length < 2 ||
    innerBoundary.length < 2 ||
    centerlinePoints.length < 2
  ) {
    return [] as Vec2[][]
  }

  const mergedRing: Vec2[] = []
  const startCap = capOptions.start
    ? buildStrokeStartCapPolygon(
        outerBoundary,
        innerBoundary,
        centerlinePoints,
        stroke
      )
    : null
  if (startCap) {
    mergedRing.push(...startCap.slice(0, -1))
    mergedRing.push(...outerBoundary.slice(1))
  } else {
    mergedRing.push(...outerBoundary)
  }

  const endCap = capOptions.end
    ? buildStrokeEndCapPolygon(
        outerBoundary,
        innerBoundary,
        centerlinePoints,
        stroke
      )
    : null
  if (endCap) {
    mergedRing.push(...endCap.slice(1))
    mergedRing.push(...[...innerBoundary.slice(0, -1)].reverse())
  } else {
    mergedRing.push(...[...innerBoundary].reverse())
  }

  const mergedPolygon = dedupeClosedPolygonPoints(mergedRing)
  if (
    mergedPolygon.length >= 3 &&
    Math.abs(polygonArea(mergedPolygon)) > EPS &&
    isSimplePolygon(mergedPolygon)
  ) {
    return [mergedPolygon]
  }

  const fallbackPolygons: Vec2[][] = []
  if (!usesSharpPolylineBoundary) {
    fallbackPolygons.push(
      ...buildStrokeStripQuadPolygons(outerBoundary, innerBoundary)
    )
  } else {
    const stripPolygon = buildStrokeStripPolygon(outerBoundary, innerBoundary)
    if (stripPolygon && isSimplePolygon(stripPolygon)) {
      fallbackPolygons.push(stripPolygon)
    } else {
      fallbackPolygons.push(
        ...buildStrokeStripSpanPolygons(outerBoundary, innerBoundary)
      )
    }
  }

  const finalPolygons = [
    ...filterTinyBodyShardPolygons(fallbackPolygons, stroke.width)
  ]
  if (startCap) {
    finalPolygons.push(startCap)
  }
  if (endCap) {
    finalPolygons.push(endCap)
  }

  return finalPolygons.filter(
    (polygon) =>
      polygon.length >= 3 &&
      Math.abs(polygonArea(polygon)) > EPS &&
      isSimplePolygon(polygon)
  )
}

const buildOpenStrokeOutlinePolygonsFromCenterline = (
  centerlinePoints: Vec2[],
  subpath: Pick<DashSubpathGeometry, 'startTangent' | 'endTangent'>,
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  allowFallback: boolean,
  capBoundarySource?: StrokeCapBoundarySource | null
) => {
  if (centerlinePoints.length < 2 || stroke.width <= EPS) {
    return []
  }

  const adjustedCenterlinePoints = applySquareCapsToCenterline(
    centerlinePoints,
    subpath.startTangent,
    subpath.endTangent,
    stroke
  )
  const effectiveCapBoundarySource = capBoundarySource ?? null
  const effectiveCenterlinePoints =
    effectiveCapBoundarySource?.centerlinePoints ?? adjustedCenterlinePoints
  const outerBoundary =
    effectiveCapBoundarySource?.outerBoundary ??
    buildOffsetBoundary(adjustedCenterlinePoints, stroke.width / 2, stroke)
  const innerBoundary =
    effectiveCapBoundarySource?.innerBoundary ??
    buildOffsetBoundary(adjustedCenterlinePoints, -stroke.width / 2, stroke)
  if (
    outerBoundary.length < 2 ||
    innerBoundary.length < 2 ||
    effectiveCenterlinePoints.length < 2
  ) {
    return []
  }

  const resolvedCapBoundarySource = effectiveCapBoundarySource ?? {
    centerlinePoints: adjustedCenterlinePoints,
    outerBoundary,
    innerBoundary
  }
  const startCap = buildStrokeStartCapPolygon(
    resolvedCapBoundarySource.outerBoundary,
    resolvedCapBoundarySource.innerBoundary,
    resolvedCapBoundarySource.centerlinePoints,
    stroke
  )
  const endCap = buildStrokeEndCapPolygon(
    resolvedCapBoundarySource.outerBoundary,
    resolvedCapBoundarySource.innerBoundary,
    resolvedCapBoundarySource.centerlinePoints,
    stroke
  )
  const mergedRing: Vec2[] = []
  if (startCap) {
    mergedRing.push(...startCap.slice(0, -1))
    mergedRing.push(...resolvedCapBoundarySource.outerBoundary.slice(1))
  } else {
    mergedRing.push(...resolvedCapBoundarySource.outerBoundary)
  }

  if (endCap) {
    mergedRing.push(...endCap.slice(1))
    mergedRing.push(
      ...[...resolvedCapBoundarySource.innerBoundary.slice(0, -1)].reverse()
    )
  } else {
    mergedRing.push(...[...resolvedCapBoundarySource.innerBoundary].reverse())
  }

  const mergedPolygon = dedupeClosedPolygonPoints(mergedRing)
  if (
    mergedPolygon.length >= 3 &&
    Math.abs(polygonArea(mergedPolygon)) > EPS &&
    isSimplePolygon(mergedPolygon)
  ) {
    return [mergedPolygon]
  }

  if (!allowFallback) {
    return []
  }

  const polygons: Vec2[][] = []
  const stripPolygon = buildStrokeStripPolygon(
    resolvedCapBoundarySource.outerBoundary,
    resolvedCapBoundarySource.innerBoundary
  )
  if (stripPolygon && isSimplePolygon(stripPolygon)) {
    polygons.push(stripPolygon)
  } else {
    polygons.push(
      ...buildStrokeStripSpanPolygons(
        resolvedCapBoundarySource.outerBoundary,
        resolvedCapBoundarySource.innerBoundary
      )
    )
  }

  if (startCap) {
    polygons.push(startCap)
  }
  if (endCap) {
    polygons.push(endCap)
  }

  return polygons
}

const buildStrokePrimitivePolygonsFromBoundaries = (
  centerlinePoints: Vec2[],
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
): StrokePrimitivePolygon[] => {
  const bodyPolygons = buildStrokeStripQuadPolygons(
    outerBoundary,
    innerBoundary
  )
  const fallbackBodyPolygons =
    bodyPolygons.length > 0
      ? bodyPolygons
      : (() => {
          const stripPolygon = buildStrokeStripPolygon(
            outerBoundary,
            innerBoundary
          )
          if (stripPolygon && isSimplePolygon(stripPolygon)) {
            return [stripPolygon]
          }

          return buildStrokeStripSpanPolygons(outerBoundary, innerBoundary)
        })()

  const primitives: StrokePrimitivePolygon[] = fallbackBodyPolygons.map(
    (polygon, index) => ({
      kind: 'body',
      touchedSegmentIndices: [Math.min(index, centerlinePoints.length - 2)],
      polygon
    })
  )

  const startCap = capOptions.start
    ? buildStrokeStartCapPolygon(
        outerBoundary,
        innerBoundary,
        centerlinePoints,
        stroke
      )
    : null
  if (startCap) {
    primitives.push({
      kind: 'cap',
      touchedSegmentIndices: [0],
      polygon: startCap
    })
  }

  const endCap = capOptions.end
    ? buildStrokeEndCapPolygon(
        outerBoundary,
        innerBoundary,
        centerlinePoints,
        stroke
      )
    : null
  if (endCap) {
    primitives.push({
      kind: 'cap',
      touchedSegmentIndices: [centerlinePoints.length - 2],
      polygon: endCap
    })
  }

  return primitives
}

const buildStrokePrimitivePolygonsFromBoundarySource = (
  boundarySource: StrokeCapBoundarySource,
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
) =>
  buildStrokePrimitivePolygonsFromBoundaries(
    boundarySource.centerlinePoints,
    boundarySource.outerBoundary,
    boundarySource.innerBoundary,
    stroke,
    capOptions
  )

const buildOpenStrokeOutlinePrimitivesFromFrames = (
  centerlineFrames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  capOptions: StrokePieceCapOptions = { start: true, end: true }
): StrokePrimitivePolygon[] => {
  if (centerlineFrames.length < 2 || stroke.width <= EPS) {
    return []
  }

  const adjustedFrames = applySquareCapsToFrames(centerlineFrames, stroke)
  const usesSharpPolylineBoundary = subpathHasSharpJoin(adjustedFrames)
  const centerlinePoints = adjustedFrames.map((frame) => frame.point)

  if (usesSharpPolylineBoundary) {
    return buildDecomposedStrokeOutlinePrimitivePolygons(
      centerlinePoints,
      stroke,
      capOptions
    )
  }

  const capBoundarySource = buildSmoothStrokeCapBoundarySource(
    adjustedFrames,
    stroke
  )
  if (!capBoundarySource) {
    return []
  }

  return buildStrokePrimitivePolygonsFromBoundarySource(
    capBoundarySource,
    stroke,
    capOptions
  )
}

const buildOpenStrokeOutlinePolygons = (
  subpath: DashSubpathGeometry,
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>
) => {
  if (stroke.width <= EPS) {
    return []
  }

  const sourcePieces = splitFramesAtSegmentSeams(subpath.sourceFrames)
  if (sourcePieces.length > 1) {
    const piecewisePolygons = sourcePieces.flatMap((sourceFrames, index) => {
      const centerlineFrames = offsetFramesForStrokeCenterline(
        sourceFrames,
        subpath.centerlineOffset,
        stroke
      )

      return buildOpenStrokeOutlinePolygonsFromFrames(
        simplifyFramesForStrokeOutline(centerlineFrames, stroke.width, {
          profile: 'primary'
        }),
        stroke,
        {
          start: index === 0,
          end: index === sourcePieces.length - 1
        }
      )
    })

    if (piecewisePolygons.length > 0) {
      return piecewisePolygons
    }
  }

  const primaryFrames = simplifyFramesForStrokeOutline(
    subpath.centerlineFrames,
    stroke.width,
    { profile: 'primary' }
  )
  const hasSharpJoin = subpathHasSharpJoin(primaryFrames)
  const smoothCapBoundarySource = hasSharpJoin
    ? null
    : buildSmoothStrokeCapBoundarySource(primaryFrames, stroke)

  const primaryPolygons = buildOpenStrokeOutlinePolygonsFromCenterline(
    subpath.centerlinePoints,
    subpath,
    stroke,
    false,
    smoothCapBoundarySource
  )

  if (primaryPolygons.length > 0) {
    return primaryPolygons
  }

  const fullCenterlineFallbackPolygons =
    buildOpenStrokeOutlinePolygonsFromCenterline(
      subpath.centerlinePoints,
      subpath,
      stroke,
      true,
      smoothCapBoundarySource
    )
  if (fullCenterlineFallbackPolygons.length > 0) {
    return fullCenterlineFallbackPolygons
  }

  const framePrimaryPolygons = buildOpenStrokeOutlinePolygonsFromFrames(
    primaryFrames,
    stroke
  )
  if (framePrimaryPolygons.length > 0) {
    return framePrimaryPolygons
  }

  if (
    subpath.fallbackCenterlinePoints.length >= 2 &&
    subpath.fallbackCenterlinePoints !== subpath.centerlinePoints
  ) {
    const fallbackPolygons = buildOpenStrokeOutlinePolygonsFromCenterline(
      subpath.fallbackCenterlinePoints,
      subpath,
      stroke,
      true,
      smoothCapBoundarySource
    )
    return fallbackPolygons
  }

  return []
}

const buildOpenStrokeOutlineGeometry = (
  subpath: DashSubpathGeometry,
  stroke: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>
) => {
  if (stroke.width <= EPS) {
    return {
      primitives: [] as StrokePrimitivePolygon[],
      polygons: [] as Vec2[][]
    }
  }

  const sourcePieces = splitFramesAtSegmentSeams(subpath.sourceFrames)
  if (sourcePieces.length > 1) {
    const piecewiseGeometry = sourcePieces.map((sourceFrames, index) => {
      const centerlineFrames = offsetFramesForStrokeCenterline(
        sourceFrames,
        subpath.centerlineOffset,
        stroke
      )
      const simplifiedFrames = simplifyFramesForStrokeOutline(
        centerlineFrames,
        stroke.width,
        {
          profile: 'primary'
        }
      )
      const pieceCapOptions = {
        start: index === 0,
        end: index === sourcePieces.length - 1
      }
      const smoothCapBoundarySource = subpathHasSharpJoin(simplifiedFrames)
        ? null
        : buildSmoothStrokeCapBoundarySource(simplifiedFrames, stroke)

      return {
        primitives: smoothCapBoundarySource
          ? buildStrokePrimitivePolygonsFromBoundarySource(
              smoothCapBoundarySource,
              stroke,
              pieceCapOptions
            )
          : buildOpenStrokeOutlinePrimitivesFromFrames(
              simplifiedFrames,
              stroke,
              pieceCapOptions
            ),
        polygons: smoothCapBoundarySource
          ? buildOpenStrokeOutlinePolygonsFromBoundarySource(
              smoothCapBoundarySource,
              stroke,
              false,
              pieceCapOptions
            )
          : buildOpenStrokeOutlinePolygonsFromFrames(
              simplifiedFrames,
              stroke,
              pieceCapOptions
            )
      }
    })

    const piecewisePolygons = piecewiseGeometry.flatMap(
      (geometry) => geometry.polygons
    )
    if (piecewisePolygons.length > 0) {
      return {
        primitives: piecewiseGeometry.flatMap(
          (geometry) => geometry.primitives
        ),
        polygons: piecewisePolygons
      }
    }
  }

  const primaryFrames = simplifyFramesForStrokeOutline(
    subpath.centerlineFrames,
    stroke.width,
    { profile: 'primary' }
  )
  const hasSharpJoin = subpathHasSharpJoin(primaryFrames)
  const smoothCapBoundarySource = hasSharpJoin
    ? null
    : buildSmoothStrokeCapBoundarySource(primaryFrames, stroke)
  const primitives = smoothCapBoundarySource
    ? buildStrokePrimitivePolygonsFromBoundarySource(
        smoothCapBoundarySource,
        stroke
      )
    : buildOpenStrokeOutlinePrimitivesFromFrames(primaryFrames, stroke)

  const primaryPolygons = buildOpenStrokeOutlinePolygonsFromCenterline(
    subpath.centerlinePoints,
    subpath,
    stroke,
    false,
    smoothCapBoundarySource
  )

  if (primaryPolygons.length > 0) {
    return {
      primitives,
      polygons: primaryPolygons
    }
  }

  const fullCenterlineFallbackPolygons =
    buildOpenStrokeOutlinePolygonsFromCenterline(
      subpath.centerlinePoints,
      subpath,
      stroke,
      true,
      smoothCapBoundarySource
    )
  if (fullCenterlineFallbackPolygons.length > 0) {
    return {
      primitives,
      polygons: fullCenterlineFallbackPolygons
    }
  }

  const framePrimaryPolygons = buildOpenStrokeOutlinePolygonsFromFrames(
    primaryFrames,
    stroke
  )
  if (framePrimaryPolygons.length > 0) {
    return {
      primitives,
      polygons: framePrimaryPolygons
    }
  }

  if (
    subpath.fallbackCenterlinePoints.length >= 2 &&
    subpath.fallbackCenterlinePoints !== subpath.centerlinePoints
  ) {
    return {
      primitives,
      polygons: buildOpenStrokeOutlinePolygonsFromCenterline(
        subpath.fallbackCenterlinePoints,
        subpath,
        stroke,
        true,
        smoothCapBoundarySource
      )
    }
  }

  return {
    primitives,
    polygons: []
  }
}

const buildDashSubpathGeometry = (
  path: PathGeometry,
  interval: DashIntervalRecord,
  stroke: RenderableStroke
): DashSubpathGeometry | null => {
  const frames = samplePathIntervalFrames(
    path,
    interval.startDistance,
    interval.endDistance,
    CURVE_TESSELLATION_TOLERANCE
  )
  if (frames.length < 2) {
    return null
  }

  const normalizedFrames = dedupeAdjacentFrames(frames)
  const sourcePoints = normalizedFrames.map((frame) => frame.point)
  if (sourcePoints.length < 2) {
    return null
  }
  const centerlineOffset = getStrokeCenterlineOffset(path, stroke)
  const centerlineFrames = offsetFramesForStrokeCenterline(
    normalizedFrames,
    centerlineOffset,
    stroke
  )
  const centerlinePoints = centerlineFrames.map((frame) => frame.point)
  if (centerlinePoints.length < 2) {
    return null
  }

  const outlineFrames = simplifyFramesForStrokeOutline(
    normalizedFrames,
    stroke.width,
    { profile: 'fallback' }
  )
  const outlineSourcePoints = outlineFrames.map((frame) => frame.point)
  if (outlineSourcePoints.length < 2) {
    return null
  }
  const fallbackCenterlinePoints = offsetPolyline(
    outlineSourcePoints,
    centerlineOffset,
    false
  )
  if (fallbackCenterlinePoints.length < 2) {
    return null
  }

  return {
    sourceFrames: normalizedFrames,
    sourcePoints,
    centerlineFrames,
    centerlinePoints,
    fallbackCenterlinePoints,
    centerlineOffset,
    startTangent: normalizedFrames[0].tangent,
    endTangent: normalizedFrames[normalizedFrames.length - 1].tangent
  }
}

const buildPathGeometry = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): PathGeometry => {
  const pathSegments: PathSegment[] = []
  let totalLength = 0

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
      const lineSegment: PathSegment = {
        type: 'line',
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        length: Math.hypot(end.x - start.x, end.y - start.y),
        startAnchorType: start.anchorType ?? 'sharp',
        endAnchorType: end.anchorType ?? 'sharp'
      }
      totalLength += lineSegment.length
      pathSegments.push(lineSegment)
      return
    }

    const cubicSegment: Extract<PathSegment, { type: 'cubic' }> = {
      type: 'cubic',
      start: { x: start.x, y: start.y },
      control1: outControl
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y },
      control2: inControl
        ? { x: inControl.x, y: inControl.y }
        : { x: end.x, y: end.y },
      end: { x: end.x, y: end.y },
      curve: new Bezier(
        { x: start.x, y: start.y },
        outControl
          ? { x: outControl.x, y: outControl.y }
          : { x: start.x, y: start.y },
        inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
        { x: end.x, y: end.y }
      ),
      length: 0,
      startAnchorType: start.anchorType ?? 'sharp',
      endAnchorType: end.anchorType ?? 'sharp'
    }
    cubicSegment.length = cubicSegment.curve.length()
    totalLength += cubicSegment.length
    pathSegments.push(cubicSegment)
  })

  const sampledPoints = dedupeAdjacentPoints(
    pathSegments.reduce<Vec2[]>((result, segment, index) => {
      const sampled = samplePathSegment(segment, CURVE_TESSELLATION_TOLERANCE)
      if (index === 0) {
        return sampled
      }
      return mergePointLists(result, sampled)
    }, [])
  )

  return {
    segments: pathSegments,
    closed: network.closed,
    totalLength,
    sampledPoints
  }
}

export const buildVectorGeometryModelPath = buildPathGeometry

export const buildPolylineGeometryModelPath = (
  points: Vec2[],
  closed: boolean
): PathGeometry => {
  const sampledPoints = closed ? dedupeClosedPolygonPoints(points) : [...points]
  if (sampledPoints.length < 2) {
    return {
      segments: [],
      closed,
      totalLength: 0,
      sampledPoints
    }
  }

  const segments: PathSegment[] = []
  let totalLength = 0

  for (let i = 0; i < sampledPoints.length - 1; i += 1) {
    const start = sampledPoints[i]
    const end = sampledPoints[i + 1]
    const length = distance(start, end)
    totalLength += length
    segments.push({
      type: 'line',
      start,
      end,
      length,
      startAnchorType: 'sharp',
      endAnchorType: 'sharp'
    })
  }

  if (closed && sampledPoints.length > 2) {
    const start = sampledPoints[sampledPoints.length - 1]
    const end = sampledPoints[0]
    const length = distance(start, end)
    totalLength += length
    segments.push({
      type: 'line',
      start,
      end,
      length,
      startAnchorType: 'sharp',
      endAnchorType: 'sharp'
    })
  }

  return {
    segments,
    closed,
    totalLength,
    sampledPoints
  }
}

const buildDashIntervals = (
  totalLength: number,
  dashLength: number,
  gapLength: number,
  closed: boolean,
  phaseOffset = 0
): DashInterval[] => {
  if (totalLength <= EPS || dashLength <= EPS) {
    return []
  }

  const cycleLength = dashLength + gapLength
  if (cycleLength <= EPS) {
    return [{ startDistance: 0, endDistance: totalLength }]
  }

  const intervals: DashInterval[] = []
  for (
    let cursor = phaseOffset;
    cursor < totalLength - EPS;
    cursor += cycleLength
  ) {
    const endDistance = closed
      ? Math.min(cursor + dashLength, cursor + totalLength)
      : Math.min(totalLength, cursor + dashLength)
    if (endDistance - cursor > EPS) {
      intervals.push({
        startDistance: cursor,
        endDistance
      })
    }
  }

  return intervals
}

const usesStrokeDashGuidePath = (
  path: PathGeometry,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => Math.abs(getStrokeCenterlineOffset(path, stroke)) > EPS

const measureFramePathLength = (frames: PathSampleFrame[]) =>
  frames
    .slice(1)
    .reduce(
      (total, point, index) =>
        total + distance(frames[index].point, point.point),
      0
    )

const offsetFramePoint = (
  frame: PathSampleFrame,
  signedDistance: number
): PathSampleFrame => {
  const normal = createLeftNormalFromTangent(frame.tangent) ?? {
    x: 0,
    y: 0
  }

  return {
    ...frame,
    point: addVec2(frame.point, scaleVec2(normal, signedDistance)),
    tangent: frame.tangent
  }
}

const buildOffsetGuideJoinFrames = (
  previousSegment: PathSegment,
  nextSegment: PathSegment,
  previousFrames: PathSampleFrame[],
  nextFrames: PathSampleFrame[],
  signedDistance: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  if (
    previousSegment.endAnchorType !== 'sharp' ||
    Math.abs(signedDistance) <= EPS
  ) {
    return []
  }

  const seamPoint = { ...previousSegment.end }
  const joinIncomingTangent =
    getSegmentEndTangent(previousSegment) ??
    previousFrames[previousFrames.length - 1]?.tangent
  const joinOutgoingTangent =
    getSegmentStartTangent(nextSegment) ?? nextFrames[0]?.tangent

  if (!joinIncomingTangent || !joinOutgoingTangent) {
    return []
  }

  const previousReferenceLength = Math.max(
    distance(
      previousFrames[Math.max(0, previousFrames.length - 2)]?.point ??
        seamPoint,
      seamPoint
    ),
    Math.abs(signedDistance) * 2,
    1
  )
  const nextReferenceLength = Math.max(
    distance(seamPoint, nextFrames[1]?.point ?? seamPoint),
    Math.abs(signedDistance) * 2,
    1
  )
  const previousSourceStart = subtractVec2(
    seamPoint,
    scaleVec2(joinIncomingTangent, previousReferenceLength)
  )
  const nextSourceEnd = addVec2(
    seamPoint,
    scaleVec2(joinOutgoingTangent, nextReferenceLength)
  )
  const previous = createShiftedSegment(
    previousSourceStart,
    seamPoint,
    signedDistance
  )
  const next = createShiftedSegment(seamPoint, nextSourceEnd, signedDistance)

  if (!previous || !next) {
    return []
  }

  const seamFrameBase: PathSampleFrame = {
    point: seamPoint,
    tangent: joinIncomingTangent,
    joinAnchorType: 'sharp',
    joinSourcePoint: seamPoint,
    joinIncomingTangent,
    joinOutgoingTangent
  }
  const defaultPoint = offsetFramePoint(seamFrameBase, signedDistance)
  const turn =
    previous.direction.x * next.direction.y -
    previous.direction.y * next.direction.x
  const outerTurn = turn * signedDistance > EPS
  const intersection = intersectLines(
    previous.start,
    previous.end,
    next.start,
    next.end
  )
  const previousBackward = intersection
    ? dotVec2(subtractVec2(previous.end, intersection), previous.direction)
    : -Infinity
  const nextForward = intersection
    ? dotVec2(subtractVec2(intersection, next.start), next.direction)
    : -Infinity
  const validIntersection =
    intersection !== null && previousBackward >= -EPS && nextForward >= -EPS

  if (outerTurn && stroke.join === 'round') {
    const clockwise = signedDistance < 0
    const startAngle = Math.atan2(
      previous.end.y - seamPoint.y,
      previous.end.x - seamPoint.x
    )
    const endAngle = Math.atan2(
      next.start.y - seamPoint.y,
      next.start.x - seamPoint.x
    )
    const arcPoints = [previous.end].concat(
      buildArcPoints(
        seamPoint,
        startAngle,
        endAngle,
        Math.abs(signedDistance),
        clockwise
      )
    )
    const joinMetadataIndex = Math.floor(arcPoints.length / 2)

    return arcPoints.map((point, index) => {
      const angle = Math.atan2(point.y - seamPoint.y, point.x - seamPoint.x)
      return {
        point,
        tangent:
          index === 0
            ? previous.direction
            : index === arcPoints.length - 1
              ? next.direction
              : getArcPointTangent(angle, clockwise),
        segmentIndex:
          index === 0
            ? previousSegmentIndex
            : index === arcPoints.length - 1
              ? nextSegmentIndex
              : index <= joinMetadataIndex
                ? previousSegmentIndex
                : nextSegmentIndex,
        ...(index === joinMetadataIndex
          ? {
              joinAnchorType: seamFrameBase.joinAnchorType,
              joinSourcePoint: seamFrameBase.joinSourcePoint,
              joinIncomingTangent: seamFrameBase.joinIncomingTangent,
              joinOutgoingTangent: seamFrameBase.joinOutgoingTangent
            }
          : {})
      }
    })
  }

  if (outerTurn && stroke.join === 'bevel') {
    return [
      {
        ...seamFrameBase,
        point: previous.end,
        tangent: previous.direction,
        segmentIndex: previousSegmentIndex
      },
      {
        point: next.start,
        tangent: next.direction,
        segmentIndex: nextSegmentIndex
      }
    ]
  }

  if (outerTurn && stroke.join === 'miter' && validIntersection) {
    const miterLength = distance(intersection, seamPoint)
    const miterLimitDistance = Math.abs(signedDistance) * stroke.miterLimit
    if (miterLength <= miterLimitDistance + EPS) {
      return [
        {
          ...seamFrameBase,
          point: intersection,
          tangent:
            normalizeVector(addVec2(previous.direction, next.direction)) ??
            seamFrameBase.tangent,
          segmentIndex: nextSegmentIndex
        }
      ]
    }
  }

  if (validIntersection) {
    return [
      {
        ...seamFrameBase,
        point: intersection,
        tangent:
          normalizeVector(addVec2(previous.direction, next.direction)) ??
          seamFrameBase.tangent,
        segmentIndex: nextSegmentIndex
      }
    ]
  }

  return [
    {
      ...seamFrameBase,
      ...defaultPoint,
      segmentIndex: nextSegmentIndex
    }
  ]
}

const buildStrokeDashGuideFrames = (
  path: PathGeometry,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>
) => {
  const sampledSegments = path.segments.map((segment, segmentIndex) =>
    slicePathSegmentFrames(
      segment,
      0,
      segment.length,
      CURVE_TESSELLATION_TOLERANCE
    ).map((frame) => ({
      ...frame,
      segmentIndex
    }))
  )
  let frames: PathSampleFrame[] = []

  sampledSegments.forEach((segmentFrames) => {
    frames = mergeFrameLists(frames, segmentFrames)
  })

  const normalizedFrames = dedupeAdjacentFrames(frames)
  if (normalizedFrames.length === 0) {
    return []
  }

  if (path.closed && normalizedFrames.length > 0 && path.segments.length > 0) {
    const firstSegment = path.segments[0]
    const lastSegment = path.segments[path.segments.length - 1]
    normalizedFrames[0] = {
      ...normalizedFrames[0],
      joinAnchorType: firstSegment.startAnchorType,
      joinSourcePoint: { ...firstSegment.start },
      joinIncomingTangent:
        getSegmentEndTangent(lastSegment) ?? normalizedFrames[0].tangent,
      joinOutgoingTangent:
        getSegmentStartTangent(firstSegment) ?? normalizedFrames[0].tangent
    }
  }

  const centerlineOffset = getStrokeCenterlineOffset(path, stroke)
  if (centerlineOffset === 0) {
    return normalizedFrames.map((frame) => ({ ...frame }))
  }

  const offsetSegmentFrames = sampledSegments.map((segmentFrames) =>
    segmentFrames.map((frame) => offsetFramePoint(frame, centerlineOffset))
  )
  let guideFrames = [...(offsetSegmentFrames[0] ?? [])]

  for (
    let segmentIndex = 1;
    segmentIndex < path.segments.length;
    segmentIndex += 1
  ) {
    const joinFrames = buildOffsetGuideJoinFrames(
      path.segments[segmentIndex - 1],
      path.segments[segmentIndex],
      sampledSegments[segmentIndex - 1],
      sampledSegments[segmentIndex],
      centerlineOffset,
      stroke,
      segmentIndex - 1,
      segmentIndex
    )
    guideFrames = mergeFrameLists(guideFrames, joinFrames)
    guideFrames = mergeFrameLists(
      guideFrames,
      offsetSegmentFrames[segmentIndex]
    )
  }

  if (
    !path.closed ||
    guideFrames.length === 0 ||
    samePoint(guideFrames[0].point, guideFrames[guideFrames.length - 1].point)
  ) {
    return guideFrames
  }

  if (path.closed && path.segments.length > 1) {
    const seamJoinFrames = buildOffsetGuideJoinFrames(
      path.segments[path.segments.length - 1],
      path.segments[0],
      sampledSegments[path.segments.length - 1],
      sampledSegments[0],
      centerlineOffset,
      stroke,
      path.segments.length - 1,
      0
    )
    guideFrames = mergeFrameLists(guideFrames, seamJoinFrames)
  }

  return samePoint(
    guideFrames[0].point,
    guideFrames[guideFrames.length - 1].point
  )
    ? guideFrames
    : [
        ...guideFrames,
        {
          ...guideFrames[0],
          point: { ...guideFrames[0].point },
          tangent: { ...guideFrames[0].tangent },
          segmentIndex: path.segments.length - 1,
          joinAnchorType: undefined,
          joinSourcePoint: undefined,
          joinIncomingTangent: undefined,
          joinOutgoingTangent: undefined
        }
      ]
}

const interpolateFrameSegment = (
  startFrame: PathSampleFrame,
  endFrame: PathSampleFrame,
  t: number
): PathSampleFrame => {
  const clampedT = Math.max(0, Math.min(1, t))
  const tangent =
    normalizeVector(subtractVec2(endFrame.point, startFrame.point)) ??
    startFrame.tangent

  return {
    point: {
      x:
        startFrame.point.x + (endFrame.point.x - startFrame.point.x) * clampedT,
      y: startFrame.point.y + (endFrame.point.y - startFrame.point.y) * clampedT
    },
    tangent,
    segmentIndex: startFrame.segmentIndex
  }
}

const sliceGuideFramesNoWrap = (
  guideFrames: PathSampleFrame[],
  startDistance: number,
  endDistance: number
) => {
  if (guideFrames.length < 2 || endDistance - startDistance <= EPS) {
    return []
  }

  const cumulativeDistances = [0]
  for (let index = 1; index < guideFrames.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        distance(guideFrames[index - 1].point, guideFrames[index].point)
    )
  }

  let frames: PathSampleFrame[] = []
  for (let index = 0; index < guideFrames.length - 1; index += 1) {
    const segmentStartDistance = cumulativeDistances[index]
    const segmentEndDistance = cumulativeDistances[index + 1]
    const segmentLength = segmentEndDistance - segmentStartDistance

    if (
      segmentLength <= EPS ||
      segmentEndDistance <= startDistance + EPS ||
      segmentStartDistance >= endDistance - EPS
    ) {
      continue
    }

    const localStart = Math.max(
      0,
      Math.min(1, (startDistance - segmentStartDistance) / segmentLength)
    )
    const localEnd = Math.max(
      0,
      Math.min(1, (endDistance - segmentStartDistance) / segmentLength)
    )

    if (localEnd - localStart <= EPS) {
      continue
    }

    const segmentFrames: PathSampleFrame[] = []
    if (localStart <= EPS) {
      segmentFrames.push({ ...guideFrames[index] })
    } else {
      segmentFrames.push(
        interpolateFrameSegment(
          guideFrames[index],
          guideFrames[index + 1],
          localStart
        )
      )
    }

    if (localEnd >= 1 - EPS) {
      segmentFrames.push({ ...guideFrames[index + 1] })
    } else {
      segmentFrames.push(
        interpolateFrameSegment(
          guideFrames[index],
          guideFrames[index + 1],
          localEnd
        )
      )
    }

    frames = mergeFrameLists(frames, segmentFrames)
  }

  return dedupeAdjacentFrames(frames)
}

const sliceGuideFrames = (
  guideFrames: PathSampleFrame[],
  totalLength: number,
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  if (guideFrames.length < 2 || endDistance - startDistance <= EPS) {
    return []
  }

  if (!closed) {
    return sliceGuideFramesNoWrap(
      guideFrames,
      Math.max(0, startDistance),
      Math.min(totalLength, endDistance)
    )
  }

  const normalizedStart =
    ((startDistance % totalLength) + totalLength) % totalLength
  const normalizedEnd = normalizedStart + (endDistance - startDistance)

  if (normalizedEnd <= totalLength + EPS) {
    return sliceGuideFramesNoWrap(
      guideFrames,
      normalizedStart,
      Math.min(totalLength, normalizedEnd)
    )
  }

  const tailSlice = sliceGuideFramesNoWrap(
    guideFrames,
    normalizedStart,
    totalLength
  )
  const headSlice = sliceGuideFramesNoWrap(
    guideFrames,
    0,
    normalizedEnd - totalLength
  )

  if (
    tailSlice.length > 0 &&
    headSlice.length > 0 &&
    samePoint(tailSlice[tailSlice.length - 1].point, headSlice[0].point)
  ) {
    return dedupeAdjacentFrames([
      ...tailSlice.slice(0, -1),
      {
        ...tailSlice[tailSlice.length - 1],
        point: tailSlice[tailSlice.length - 1].point,
        tangent: tailSlice[tailSlice.length - 1].tangent,
        segmentIndex:
          tailSlice[tailSlice.length - 1].segmentIndex ??
          headSlice[0].segmentIndex,
        joinAnchorType:
          tailSlice[tailSlice.length - 1].joinAnchorType ??
          headSlice[0].joinAnchorType,
        joinSourcePoint:
          tailSlice[tailSlice.length - 1].joinSourcePoint ??
          headSlice[0].joinSourcePoint,
        joinIncomingTangent:
          tailSlice[tailSlice.length - 1].joinIncomingTangent ??
          headSlice[0].joinIncomingTangent,
        joinOutgoingTangent:
          tailSlice[tailSlice.length - 1].joinOutgoingTangent ??
          headSlice[0].joinOutgoingTangent
      },
      ...headSlice.slice(1)
    ])
  }

  return mergeFrameLists(tailSlice, headSlice)
}

const buildStrokeDashIntervalAllocation = (
  path: PathGeometry,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'dash' | 'gap'>
) =>
  buildDashIntervalAllocation(
    path,
    createDashedStrokeGeometryContext(stroke as RenderableStroke)
  )

const getTouchedSegmentIndices = (
  path: PathGeometry,
  startDistance: number,
  endDistance: number
) => {
  if (path.segments.length === 0 || endDistance - startDistance <= EPS) {
    return []
  }

  const touched: number[] = []
  let cursor = 0

  path.segments.forEach((segment, index) => {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.length
    cursor = segmentEnd

    const overlapCandidates = path.closed
      ? [
          { start: segmentStart, end: segmentEnd },
          {
            start: segmentStart - path.totalLength,
            end: segmentEnd - path.totalLength
          },
          {
            start: segmentStart + path.totalLength,
            end: segmentEnd + path.totalLength
          }
        ]
      : [{ start: segmentStart, end: segmentEnd }]
    const overlaps = overlapCandidates.some(
      (candidate) =>
        candidate.end > startDistance + EPS &&
        candidate.start < endDistance - EPS
    )
    if (overlaps) {
      touched.push(index)
    }
  })

  return touched
}

export const buildDashIntervalAllocation = (
  path: PathGeometry,
  context: Pick<DashedStrokeGeometryContext, 'dash' | 'gap'>
): DashIntervalAllocation => {
  const rawIntervals = buildDashedStrokeIntervals(path, context)
  const previousGapIndexByDash = Array<number | null>(rawIntervals.length).fill(
    null
  )
  const nextGapIndexByDash = Array<number | null>(rawIntervals.length).fill(
    null
  )
  const gapIntervals: GapIntervalRecord[] = []

  const addGapInterval = (
    startDistance: number,
    endDistance: number,
    leadingDashIndex: number | null,
    trailingDashIndex: number | null
  ) => {
    if (endDistance - startDistance <= EPS) {
      return
    }

    const gapIndex = gapIntervals.length
    gapIntervals.push({
      gapIndex,
      startDistance,
      endDistance,
      intervalLength: endDistance - startDistance,
      leadingDashIndex,
      trailingDashIndex,
      wrapsSeam: endDistance > path.totalLength + EPS
    })

    if (leadingDashIndex !== null) {
      nextGapIndexByDash[leadingDashIndex] = gapIndex
    }
    if (trailingDashIndex !== null) {
      previousGapIndexByDash[trailingDashIndex] = gapIndex
    }
  }

  if (path.closed) {
    for (let dashIndex = 0; dashIndex < rawIntervals.length; dashIndex += 1) {
      const current = rawIntervals[dashIndex]
      const next =
        dashIndex + 1 < rawIntervals.length
          ? rawIntervals[dashIndex + 1]
          : rawIntervals.length > 0
            ? {
                startDistance: rawIntervals[0].startDistance + path.totalLength,
                endDistance: rawIntervals[0].endDistance + path.totalLength
              }
            : null

      if (!next) {
        continue
      }

      addGapInterval(
        current.endDistance,
        next.startDistance,
        dashIndex,
        dashIndex + 1 < rawIntervals.length ? dashIndex + 1 : 0
      )
    }
  } else {
    let cursor = 0

    rawIntervals.forEach((interval, dashIndex) => {
      addGapInterval(
        cursor,
        interval.startDistance,
        dashIndex > 0 ? dashIndex - 1 : null,
        dashIndex
      )
      cursor = Math.max(cursor, interval.endDistance)
    })

    addGapInterval(
      cursor,
      path.totalLength,
      rawIntervals.length > 0 ? rawIntervals.length - 1 : null,
      null
    )
  }

  const dashIntervals: DashIntervalRecord[] = rawIntervals.map(
    (interval, dashIndex) => ({
      dashIndex,
      startDistance: interval.startDistance,
      endDistance: interval.endDistance,
      intervalLength: interval.endDistance - interval.startDistance,
      touchedSegmentIndices: getTouchedSegmentIndices(
        path,
        interval.startDistance,
        interval.endDistance
      ),
      previousDashIndex:
        path.closed && rawIntervals.length > 0
          ? (dashIndex - 1 + rawIntervals.length) % rawIntervals.length
          : dashIndex > 0
            ? dashIndex - 1
            : null,
      nextDashIndex:
        path.closed && rawIntervals.length > 0
          ? (dashIndex + 1) % rawIntervals.length
          : dashIndex + 1 < rawIntervals.length
            ? dashIndex + 1
            : null,
      previousGapIndex: previousGapIndexByDash[dashIndex],
      nextGapIndex: nextGapIndexByDash[dashIndex],
      wrapsSeam: interval.endDistance > path.totalLength + EPS
    })
  )

  return {
    totalLength: path.totalLength,
    closed: path.closed,
    dashLength: context.dash,
    gapLength: context.gap,
    dashIntervals,
    gapIntervals
  }
}

export const analyzeDashedGeometryCandidates = (
  dashCandidates: DashCandidateRecord[]
): DashedGeometryConflictAnalysis => {
  const overlapGraph = measureDashedGeometryPhase('phase3:overlap-graph', () =>
    buildOverlapGraph(dashCandidates)
  )
  const conflictComponents = measureDashedGeometryPhase(
    'phase3:conflict-components',
    () => buildConflictComponents(dashCandidates, overlapGraph)
  )
  const atomicRegions = measureDashedGeometryPhase(
    'phase4:atomic-regions',
    () => buildAtomicRegions(dashCandidates, conflictComponents, overlapGraph)
  )

  return {
    overlapGraph,
    conflictComponents,
    atomicRegions
  }
}

export const buildDashedGeometryPhase1 = (
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryPhase1Result | null => {
  if (
    stroke.style !== StrokeStyles.DASHED ||
    path.totalLength <= EPS ||
    path.sampledPoints.length < 2
  ) {
    return null
  }

  const context = createDashedStrokeGeometryContext(stroke)

  return {
    path,
    stroke,
    dashContext: {
      dash: context.dash,
      gap: context.gap
    }
  }
}

export const computeDashedGeometryPipelineToPhase4 = (
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryPipelineToPhase4Result | null => {
  const phase1 = buildDashedGeometryPhase1(path, stroke)
  if (!phase1) {
    return null
  }

  const phase2 = measureDashedGeometryPhase('phase2:source-build', () =>
    buildDashedGeometryPhase2ResultFromPhase1(phase1)
  )
  if (!phase2) {
    return null
  }

  const analysis = measureDashedGeometryPhase('phase3-4:analysis', () =>
    analyzeDashedGeometryCandidates(phase2.dashCandidates)
  )

  return {
    phase1,
    phase2,
    phase3: {
      overlapGraph: analysis.overlapGraph,
      conflictComponents: analysis.conflictComponents
    },
    phase4: {
      atomicRegions: analysis.atomicRegions
    }
  }
}

export const buildDashedGeometryPhase5DecisionContract = (
  phase4: DashedGeometryPhase4Result
): DashedGeometryPhase5Result => {
  const decisions: AtomicRegionOwnershipDecision[] = []
  const ownership: AtomicRegionOwnershipRecord[] = []

  phase4.atomicRegions.forEach((region) => {
    if (region.coverageSet.length === 1) {
      ownership.push({
        regionKey: region.regionKey,
        componentId: region.componentId,
        zoneId: region.zoneId,
        coverageSet: [...region.coverageSet],
        ownerDashIndex: region.coverageSet[0],
        regionPolygon: region.regionPolygon,
        edgeKeys: region.edgeKeys,
        mergeStable: region.mergeStable
      })
      return
    }

    decisions.push({
      regionKey: region.regionKey,
      componentId: region.componentId,
      zoneId: region.zoneId,
      coverageSet: [...region.coverageSet],
      candidateDashIndices: [...region.coverageSet],
      ownerDashIndex: null,
      regionPolygon: region.regionPolygon,
      edgeKeys: region.edgeKeys,
      status: 'pending'
    })
  })

  return {
    decisions,
    ownership,
    resolvedDecisionCount: 0,
    pendingDecisionCount: decisions.length
  }
}

const sameCoverageSet = (left: number[], right: number[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index])

export const applyDashedGeometryPhase5OwnershipResolutions = (
  phase5: DashedGeometryPhase5Result,
  resolutions: AtomicRegionOwnershipResolution[]
): DashedGeometryPhase5Result => {
  const resolutionMap = new Map(
    resolutions.map((resolution) => [resolution.regionKey, resolution])
  )

  const decisions: AtomicRegionOwnershipDecision[] = phase5.decisions.map(
    (decision) => {
      const resolution = resolutionMap.get(decision.regionKey)
      if (!resolution) {
        return decision
      }

      if (
        resolution.regionKey !== decision.regionKey ||
        resolution.componentId !== decision.componentId ||
        !sameCoverageSet(decision.coverageSet, resolution.coverageSet) ||
        !decision.candidateDashIndices.includes(resolution.ownerDashIndex)
      ) {
        throw new Error(
          `Invalid dashed geometry phase5 resolution for component ${decision.componentId}`
        )
      }

      return {
        ...decision,
        ownerDashIndex: resolution.ownerDashIndex,
        status: 'resolved' as const
      }
    }
  )

  const decisionRegionKeys = new Set(
    decisions.map((decision) => decision.regionKey)
  )
  const ownership = phase5.ownership.filter(
    (record) => !decisionRegionKeys.has(record.regionKey)
  )

  ownership.push(
    ...decisions.flatMap((decision) =>
      decision.ownerDashIndex === null
        ? []
        : [
            {
              regionKey: decision.regionKey,
              componentId: decision.componentId,
              zoneId: decision.zoneId,
              coverageSet: [...decision.coverageSet],
              ownerDashIndex: decision.ownerDashIndex,
              regionPolygon: decision.regionPolygon,
              edgeKeys: decision.edgeKeys,
              mergeStable: false
            }
          ]
    )
  )

  const resolvedDecisionCount = decisions.filter(
    (decision) => decision.status === 'resolved'
  ).length

  return {
    decisions,
    ownership,
    resolvedDecisionCount,
    pendingDecisionCount: decisions.length - resolvedDecisionCount
  }
}

export const applyDashedGeometryPhase5ToPipelineState = (
  pipeline: DashedGeometryPipelineState,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPipelineState => ({
  ...pipeline,
  phase5,
  nextPhase:
    phase5.pendingDecisionCount > 0
      ? 'phase5'
      : pipeline.phase6
        ? 'complete'
        : 'phase6'
})

export const buildDashedGeometryPhase5RuleInputs = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): AtomicRegionOwnershipRuleInput[] => {
  const candidateByDashIndex = buildAtomicRegionOwnerCandidateContextMap(phase2)

  return phase5.decisions.map((decision) => ({
    regionKey: decision.regionKey,
    componentId: decision.componentId,
    zoneId: decision.zoneId,
    coverageSet: [...decision.coverageSet],
    candidateDashIndices: [...decision.candidateDashIndices],
    ownerDashIndex: decision.ownerDashIndex,
    status: decision.status,
    regionPolygon: decision.regionPolygon,
    candidates: decision.candidateDashIndices.map((dashIndex) => {
      const candidate = candidateByDashIndex.get(dashIndex)
      if (!candidate) {
        throw new Error(
          `Missing dashed geometry phase5 candidate context for dash ${dashIndex}`
        )
      }

      return {
        dashIndex: candidate.dashIndex,
        interval: candidate.interval,
        centerlinePoints: candidate.centerlinePoints,
        bounds: candidate.bounds
      }
    })
  }))
}

const buildAtomicRegionOwnerCandidateContextMap = (
  phase2: DashedGeometryPhase2Result
): AtomicRegionOwnerCandidateContextMap =>
  new Map(
    phase2.dashCandidates.map((candidate) => [
      candidate.dashIndex,
      {
        dashIndex: candidate.dashIndex,
        interval: candidate.interval,
        centerlinePoints: candidate.centerlinePoints,
        bounds: candidate.bounds
      }
    ])
  )

export const buildDashedGeometryPhase5RuleEvaluationResult = (
  phase5: DashedGeometryPhase5Result,
  evaluations: AtomicRegionOwnershipRuleEvaluation[]
): DashedGeometryPhase5RuleEvaluationResult => {
  const decisionMap = new Map(
    phase5.decisions.map((decision) => [decision.regionKey, decision])
  )

  const resolutions: AtomicRegionOwnershipResolution[] = []
  let resolvedCount = 0
  let deferredCount = 0
  let conflictCount = 0

  evaluations.forEach((evaluation) => {
    const decision = decisionMap.get(evaluation.regionKey)
    if (
      !decision ||
      evaluation.regionKey !== decision.regionKey ||
      evaluation.componentId !== decision.componentId ||
      evaluation.zoneId !== decision.zoneId ||
      !sameCoverageSet(decision.coverageSet, evaluation.coverageSet)
    ) {
      throw new Error(
        `Invalid dashed geometry phase5 evaluation target for component ${evaluation.componentId}`
      )
    }

    if (evaluation.status === 'resolved') {
      if (
        evaluation.ownerDashIndex === null ||
        !decision.candidateDashIndices.includes(evaluation.ownerDashIndex)
      ) {
        throw new Error(
          `Invalid dashed geometry phase5 evaluation owner for component ${evaluation.componentId}`
        )
      }

      resolutions.push({
        regionKey: evaluation.regionKey,
        componentId: evaluation.componentId,
        coverageSet: [...evaluation.coverageSet],
        ownerDashIndex: evaluation.ownerDashIndex
      })
      resolvedCount += 1
      return
    }

    if (evaluation.ownerDashIndex !== null) {
      throw new Error(
        `Invalid dashed geometry phase5 non-resolved evaluation for component ${evaluation.componentId}`
      )
    }

    if (evaluation.status === 'deferred') {
      deferredCount += 1
      return
    }

    conflictCount += 1
  })

  return {
    evaluations,
    resolutions,
    resolvedCount,
    deferredCount,
    conflictCount
  }
}

const getContinuityStrength = (candidate: AtomicRegionOwnerCandidateContext) =>
  candidate.interval.touchedSegmentIndices.length

const getPolygonCentroid = (polygon: Vec2[]): Vec2 | null => {
  if (polygon.length === 0) {
    return null
  }

  let areaTwice = 0
  let centroidX = 0
  let centroidY = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const cross = current.x * next.y - next.x * current.y
    areaTwice += cross
    centroidX += (current.x + next.x) * cross
    centroidY += (current.y + next.y) * cross
  }

  if (Math.abs(areaTwice) <= EPS) {
    const summed = polygon.reduce(
      (accumulated, point) => ({
        x: accumulated.x + point.x,
        y: accumulated.y + point.y
      }),
      { x: 0, y: 0 }
    )
    return {
      x: summed.x / polygon.length,
      y: summed.y / polygon.length
    }
  }

  return {
    x: centroidX / (3 * areaTwice),
    y: centroidY / (3 * areaTwice)
  }
}

const getPointToSegmentDistanceSquared = (
  point: Vec2,
  start: Vec2,
  end: Vec2
): number => {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared <= EPS) {
    const dx = point.x - start.x
    const dy = point.y - start.y
    return dx * dx + dy * dy
  }

  const projection =
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
    lengthSquared
  const clamped = Math.max(0, Math.min(1, projection))
  const projectedX = start.x + deltaX * clamped
  const projectedY = start.y + deltaY * clamped
  const distanceX = point.x - projectedX
  const distanceY = point.y - projectedY

  return distanceX * distanceX + distanceY * distanceY
}

const getCenterlineProximityScore = (
  regionPolygon: Vec2[],
  candidate: AtomicRegionOwnerCandidateContext
): number => {
  const centroid = getPolygonCentroid(regionPolygon)
  if (!centroid || candidate.centerlinePoints.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  if (candidate.centerlinePoints.length === 1) {
    const dx = centroid.x - candidate.centerlinePoints[0].x
    const dy = centroid.y - candidate.centerlinePoints[0].y
    return dx * dx + dy * dy
  }

  let minDistanceSquared = Number.POSITIVE_INFINITY
  for (
    let pointIndex = 1;
    pointIndex < candidate.centerlinePoints.length;
    pointIndex += 1
  ) {
    minDistanceSquared = Math.min(
      minDistanceSquared,
      getPointToSegmentDistanceSquared(
        centroid,
        candidate.centerlinePoints[pointIndex - 1],
        candidate.centerlinePoints[pointIndex]
      )
    )
  }

  return minDistanceSquared
}

const getContinuityResolvedOwnerDashIndex = (
  candidates: AtomicRegionOwnerCandidateContext[]
) => {
  const rankedCandidates = [...candidates].sort((left, right) => {
    const strengthDelta =
      getContinuityStrength(right) - getContinuityStrength(left)
    if (strengthDelta !== 0) {
      return strengthDelta
    }

    return left.dashIndex - right.dashIndex
  })
  const strongestCandidate = rankedCandidates[0]
  const strongestStrength = strongestCandidate
    ? getContinuityStrength(strongestCandidate)
    : 0
  const strongestCandidates = rankedCandidates.filter(
    (candidate) => getContinuityStrength(candidate) === strongestStrength
  )

  if (
    strongestCandidate &&
    strongestStrength > 1 &&
    strongestCandidates.length === 1
  ) {
    return strongestCandidate.dashIndex
  }

  return null
}

const getCenterlineProximityResolvedOwnerDashIndex = (
  regionPolygon: Vec2[],
  candidates: AtomicRegionOwnerCandidateContext[]
) => {
  const rankedCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: getCenterlineProximityScore(regionPolygon, candidate)
    }))
    .sort((left, right) => {
      if (Math.abs(left.score - right.score) > EPS) {
        return left.score - right.score
      }

      return left.candidate.dashIndex - right.candidate.dashIndex
    })
  const strongestCandidate = rankedCandidates[0]
  const strongestScore = strongestCandidate?.score ?? Number.POSITIVE_INFINITY
  const strongestCandidates = rankedCandidates.filter(
    (candidate) => Math.abs(candidate.score - strongestScore) <= EPS
  )

  if (
    strongestCandidate &&
    Number.isFinite(strongestScore) &&
    strongestCandidates.length === 1
  ) {
    return strongestCandidate.candidate.dashIndex
  }

  return null
}

export const evaluateDashedGeometryPhase5ContinuityRule = (
  inputs: AtomicRegionOwnershipRuleInput[]
): AtomicRegionOwnershipRuleEvaluation[] =>
  inputs.map((input) => {
    const ownerDashIndex = getContinuityResolvedOwnerDashIndex(input.candidates)

    if (ownerDashIndex !== null) {
      return {
        regionKey: input.regionKey,
        componentId: input.componentId,
        zoneId: input.zoneId,
        coverageSet: [...input.coverageSet],
        status: 'resolved',
        ownerDashIndex,
        reason: 'continuity-unique-cross-segment-owner'
      }
    }

    return {
      regionKey: input.regionKey,
      componentId: input.componentId,
      zoneId: input.zoneId,
      coverageSet: [...input.coverageSet],
      status: 'deferred',
      ownerDashIndex: null,
      reason: 'continuity-owner-underdetermined'
    }
  })

export const resolveDashedGeometryPhase5ByContinuityRule = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): {
  inputs: AtomicRegionOwnershipRuleInput[]
  evaluation: DashedGeometryPhase5RuleEvaluationResult
  phase5: DashedGeometryPhase5Result
} => {
  const inputs = buildDashedGeometryPhase5RuleInputs(phase2, phase5)
  const evaluations = evaluateDashedGeometryPhase5ContinuityRule(inputs)
  const evaluation = buildDashedGeometryPhase5RuleEvaluationResult(
    phase5,
    evaluations
  )
  const nextPhase5 = applyDashedGeometryPhase5OwnershipResolutions(
    phase5,
    evaluation.resolutions
  )

  return {
    inputs,
    evaluation,
    phase5: nextPhase5
  }
}

export const evaluateDashedGeometryPhase5CenterlineProximityRule = (
  inputs: AtomicRegionOwnershipRuleInput[]
): AtomicRegionOwnershipRuleEvaluation[] =>
  inputs.map((input) => {
    const ownerDashIndex = getCenterlineProximityResolvedOwnerDashIndex(
      input.regionPolygon,
      input.candidates
    )

    if (ownerDashIndex !== null) {
      return {
        regionKey: input.regionKey,
        componentId: input.componentId,
        zoneId: input.zoneId,
        coverageSet: [...input.coverageSet],
        status: 'resolved',
        ownerDashIndex,
        reason: 'centerline-proximity-unique-owner'
      }
    }

    return {
      regionKey: input.regionKey,
      componentId: input.componentId,
      zoneId: input.zoneId,
      coverageSet: [...input.coverageSet],
      status: 'deferred',
      ownerDashIndex: null,
      reason: 'centerline-proximity-owner-underdetermined'
    }
  })

export const resolveDashedGeometryPhase5ByCenterlineProximityRule = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): {
  inputs: AtomicRegionOwnershipRuleInput[]
  evaluation: DashedGeometryPhase5RuleEvaluationResult
  phase5: DashedGeometryPhase5Result
} => {
  const inputs = buildDashedGeometryPhase5RuleInputs(phase2, phase5)
  const evaluations =
    evaluateDashedGeometryPhase5CenterlineProximityRule(inputs)
  const evaluation = buildDashedGeometryPhase5RuleEvaluationResult(
    phase5,
    evaluations
  )
  const nextPhase5 = applyDashedGeometryPhase5OwnershipResolutions(
    phase5,
    evaluation.resolutions
  )

  return {
    inputs,
    evaluation,
    phase5: nextPhase5
  }
}

export const applyInitialDashedGeometryPhase5Rules = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPhase5Result => {
  const candidateContextByDashIndex =
    buildAtomicRegionOwnerCandidateContextMap(phase2)
  const ownership = [...phase5.ownership]
  let resolvedDecisionCount = 0

  const decisions = phase5.decisions.map((decision) => {
    const candidates = decision.candidateDashIndices.map((dashIndex) => {
      const candidate = candidateContextByDashIndex.get(dashIndex)
      if (!candidate) {
        throw new Error(
          `Missing dashed geometry phase5 candidate context for dash ${dashIndex}`
        )
      }

      return candidate
    })

    const continuityOwnerDashIndex =
      getContinuityResolvedOwnerDashIndex(candidates)
    const ownerDashIndex =
      continuityOwnerDashIndex ??
      getCenterlineProximityResolvedOwnerDashIndex(
        decision.regionPolygon,
        candidates
      )

    if (ownerDashIndex === null) {
      return decision
    }

    resolvedDecisionCount += 1
    ownership.push({
      regionKey: decision.regionKey,
      componentId: decision.componentId,
      zoneId: decision.zoneId,
      coverageSet: [...decision.coverageSet],
      ownerDashIndex,
      regionPolygon: decision.regionPolygon,
      edgeKeys: decision.edgeKeys,
      mergeStable: false
    })

    return {
      ...decision,
      ownerDashIndex,
      status: 'resolved' as const
    }
  })

  return {
    decisions,
    ownership,
    resolvedDecisionCount,
    pendingDecisionCount: decisions.length - resolvedDecisionCount
  }
}

const prepareDashedGeometryPhase6PassthroughCandidates = (
  phase2: DashedGeometryPhase2Result,
  contestedDashIndices: Set<number>
): PreparedDashedGeometryPhase6PassthroughCandidates => {
  let preMaterializedCount = 0
  let baselineStateCount = 0
  let sourceModelCount = 0
  let sourceModelMaterializeTime = 0
  let baselineFetchTime = 0
  let flattenTime = 0
  let cacheKeyTime = 0
  const sourceModelDiagnostics: string[] = []
  const records: PreparedDashedGeometryPhase6PassthroughCandidates['records'] =
    []
  const polygons: Vec2[][] = []
  const dashIndices: number[] = []

  phase2.dashCandidates.forEach((candidate) => {
    if (contestedDashIndices.has(candidate.dashIndex)) {
      return
    }

    const candidatePolygons =
      candidate.passthroughRenderPolygons &&
      candidate.passthroughRenderPolygonsSafe
        ? candidate.passthroughRenderPolygons
        : materializeDashCandidateRenderPolygons(candidate)

    if (candidate.polygonsMaterialized) {
      preMaterializedCount += 1
    } else if (
      candidate.passthroughRenderPolygons &&
      candidate.passthroughRenderPolygonsSafe
    ) {
      baselineStateCount += 1
    } else if (
      candidate.renderBaselinePolygons &&
      candidate.renderSupplementPolygons
    ) {
      baselineStateCount += 1
    } else {
      sourceModelCount += 1
      if (DASHED_GEOMETRY_PROFILE_ENABLED) {
        sourceModelDiagnostics.push(
          `${candidate.dashIndex}:${candidate.sourceModelReason ?? 'unknown'}`
        )
      }
    }

    const candidatePolygonsStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
      ? performance.now()
      : 0
    if (DASHED_GEOMETRY_PROFILE_ENABLED) {
      const elapsed = performance.now() - candidatePolygonsStartedAt
      if (
        candidate.passthroughRenderPolygons &&
        candidate.passthroughRenderPolygonsSafe
      ) {
        baselineFetchTime += elapsed
      } else {
        sourceModelMaterializeTime += elapsed
      }
    }

    dashIndices.push(candidate.dashIndex)
    const flattenStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
      ? performance.now()
      : 0
    polygons.push(...candidatePolygons)
    if (DASHED_GEOMETRY_PROFILE_ENABLED) {
      flattenTime += performance.now() - flattenStartedAt
    }
    const cacheKeyStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
      ? performance.now()
      : 0
    records.push({
      dashIndex: candidate.dashIndex,
      cacheKey:
        (candidate.assemblyCacheKey
          ? `${candidate.assemblyCacheKey}::render-source`
          : null) ??
        getDashCandidateRenderGeometryCacheKey(candidate) ??
        `${candidate.dashIndex}:render-source:${candidatePolygons.length}:${
          candidate.bounds ? createBoundsKey(candidate.bounds) : 'none'
        }`,
      polygons: candidatePolygons
    })
    if (DASHED_GEOMETRY_PROFILE_ENABLED) {
      cacheKeyTime += performance.now() - cacheKeyStartedAt
    }
  })

  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    process.stdout.write(
      `[dashed-geometry-profile] phase6:assembly-input:passthrough-detail: baseline-fetch=${baselineFetchTime.toFixed(2)}ms source-model=${sourceModelMaterializeTime.toFixed(2)}ms flatten=${flattenTime.toFixed(2)}ms cache-key=${cacheKeyTime.toFixed(2)}ms\n`
    )
    if (sourceModelDiagnostics.length > 0) {
      process.stdout.write(
        `[dashed-geometry-profile] phase6:assembly-input:source-model-dashes: ${sourceModelDiagnostics.join('|')}\n`
      )
    }
  }

  return {
    records,
    dashIndices,
    polygons,
    preMaterializedCount,
    baselineStateCount,
    sourceModelCount
  }
}

const buildDashedGeometryPhase6AssemblyIdentity = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPhase6AssemblyIdentity => {
  const contestedDashIndices = phase5.decisions.reduce(
    (contested, decision) => {
      decision.candidateDashIndices.forEach((dashIndex) => {
        contested.add(dashIndex)
      })
      return contested
    },
    new Set<number>(phase5.ownership.map((record) => record.ownerDashIndex))
  )

  const unresolvedDecisionCount = phase5.decisions.reduce(
    (count, decision) => count + (decision.status !== 'resolved' ? 1 : 0),
    0
  )
  const assemblyMode =
    unresolvedDecisionCount > 0
      ? 'incomplete-conflict'
      : phase5.decisions.length > 0
        ? 'resolved-conflict'
        : 'passthrough-only'

  return {
    assemblyMode,
    passthroughCandidates: phase2.dashCandidates.flatMap((candidate) =>
      contestedDashIndices.has(candidate.dashIndex)
        ? []
        : [
            {
              dashIndex: candidate.dashIndex,
              cacheKey: candidate.assemblyCacheKey ?? null
            }
          ]
    ),
    ownedRegions: phase5.ownership,
    unresolvedDecisionCount,
    status: unresolvedDecisionCount > 0 ? 'pending' : 'ready'
  }
}

export const buildDashedGeometryPhase6AssemblyInput = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPhase6AssemblyInput => {
  const contestedDashIndices = measureDashedGeometryPhase(
    'phase6:assembly-input:contested-set',
    () => {
      const contested = new Set<number>()

      phase5.decisions.forEach((decision) => {
        decision.candidateDashIndices.forEach((dashIndex) => {
          contested.add(dashIndex)
        })
      })
      phase5.ownership.forEach((record) => {
        contested.add(record.ownerDashIndex)
      })

      return contested
    }
  )
  const unresolvedDecisions = measureDashedGeometryPhase(
    'phase6:assembly-input:unresolved-decisions',
    () => phase5.decisions.filter((decision) => decision.status !== 'resolved')
  )
  const preparedPassthroughCandidates = measureDashedGeometryPhase(
    'phase6:assembly-input:passthrough-candidates',
    () =>
      prepareDashedGeometryPhase6PassthroughCandidates(
        phase2,
        contestedDashIndices
      )
  )
  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    process.stdout.write(
      `[dashed-geometry-profile] phase6:assembly-input:passthrough-breakdown: pre-materialized=${preparedPassthroughCandidates.preMaterializedCount} baseline-state=${preparedPassthroughCandidates.baselineStateCount} source-model=${preparedPassthroughCandidates.sourceModelCount}\n`
    )
  }
  const assemblyMode =
    unresolvedDecisions.length > 0
      ? 'incomplete-conflict'
      : phase5.decisions.length > 0
        ? 'resolved-conflict'
        : 'passthrough-only'

  return {
    assemblyMode,
    passthroughCandidates: preparedPassthroughCandidates.records,
    passthroughDashIndices: preparedPassthroughCandidates.dashIndices,
    passthroughPolygons: preparedPassthroughCandidates.polygons,
    ownedRegions: phase5.ownership,
    unresolvedDecisions,
    status: unresolvedDecisions.length > 0 ? 'pending' : 'ready'
  }
}

export const buildDashedGeometryPhase6ResultContract = (
  assembly: DashedGeometryPhase6AssemblyInput,
  finalPolygons: Vec2[][]
): DashedGeometryPhase6Result => {
  if (assembly.status !== 'ready') {
    throw new Error(
      'Cannot build dashed geometry phase6 result from pending assembly input'
    )
  }

  if (assembly.assemblyMode === 'incomplete-conflict') {
    throw new Error(
      'Cannot finalize dashed geometry phase6 result from incomplete conflict assembly'
    )
  }

  return {
    assemblyMode: assembly.assemblyMode,
    finalPolygons,
    sourcePolygonCount: finalPolygons.length
  }
}

const dedupeCollinearPolygonPoints = (polygon: Vec2[]) => {
  const normalized = dedupeClosedPolygonPoints(polygon)
  if (normalized.length < 3) {
    return normalized
  }

  const result: Vec2[] = []

  for (let index = 0; index < normalized.length; index += 1) {
    const previous =
      normalized[(index - 1 + normalized.length) % normalized.length]
    const current = normalized[index]
    const next = normalized[(index + 1) % normalized.length]

    if (
      Math.abs(orientation(previous, current, next)) <= EPS &&
      pointOnSegment(current, previous, next)
    ) {
      continue
    }

    result.push(current)
  }

  return result.length >= 3 ? result : normalized
}

const collectPolygonLoop = (
  polygon: Vec2[],
  startIndex: number,
  endIndex: number
) => {
  if (polygon.length === 0) {
    return []
  }

  const result = [polygon[startIndex]]
  let index = startIndex
  let guard = 0

  while (index !== endIndex && guard <= polygon.length) {
    index = (index + 1) % polygon.length
    result.push(polygon[index])
    guard += 1
  }

  return result
}

const createPolygonEdgeKey = (start: Vec2, end: Vec2) => {
  const startKey = `${start.x.toFixed(6)},${start.y.toFixed(6)}`
  const endKey = `${end.x.toFixed(6)},${end.y.toFixed(6)}`

  return startKey < endKey ? `${startKey}->${endKey}` : `${endKey}->${startKey}`
}

const createBoundsKey = (bounds: PolygonBounds) =>
  `${bounds.minX.toFixed(6)},${bounds.minY.toFixed(6)},${bounds.maxX.toFixed(
    6
  )},${bounds.maxY.toFixed(6)}`

const tryMergeAdjacentPolygons = (left: Vec2[], right: Vec2[]) => {
  const expectedArea =
    Math.abs(polygonArea(left)) + Math.abs(polygonArea(right))

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex]
    const leftEnd = left[(leftIndex + 1) % left.length]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex]
      const rightEnd = right[(rightIndex + 1) % right.length]

      if (!samePoint(leftStart, rightEnd) || !samePoint(leftEnd, rightStart)) {
        continue
      }

      const merged = dedupeCollinearPolygonPoints(
        mergePointLists(
          collectPolygonLoop(left, (leftIndex + 1) % left.length, leftIndex),
          collectPolygonLoop(right, (rightIndex + 1) % right.length, rightIndex)
        )
      )

      if (
        merged.length >= 3 &&
        Math.abs(polygonArea(merged)) > EPS &&
        isSimplePolygon(merged) &&
        Math.abs(Math.abs(polygonArea(merged)) - expectedArea) <= 1e-3
      ) {
        return ensureCounterClockwisePolygon(merged)
      }
    }
  }

  return null
}

const buildPolygonEdgeKeys = (polygon: Vec2[]) =>
  polygon.map((point, index) =>
    createPolygonEdgeKey(point, polygon[(index + 1) % polygon.length])
  )

interface MergeablePolygonRecord {
  polygon: Vec2[]
  edgeKeys?: string[]
  regionKey?: string
}

type MergeablePolygonRecordWithEdges = MergeablePolygonRecord & {
  edgeKeys: string[]
}

const buildMergeablePolygonRecordComponents = (
  polygonRecords: MergeablePolygonRecordWithEdges[]
) => {
  const keyedPolygonRecords = polygonRecords.map((record, index) => ({
    ...record,
    regionKey: record.regionKey ?? `mergeable:${index}`
  }))
  const edgeMap = new Map<string, string[]>()

  keyedPolygonRecords.forEach((record) => {
    record.edgeKeys.forEach((edgeKey) => {
      const regionKeys = edgeMap.get(edgeKey) ?? []
      regionKeys.push(record.regionKey)
      edgeMap.set(edgeKey, regionKeys)
    })
  })

  const adjacency = new Map<string, Set<string>>()
  keyedPolygonRecords.forEach((record) => {
    adjacency.set(record.regionKey, new Set())
  })

  edgeMap.forEach((regionKeys) => {
    if (regionKeys.length !== 2 || regionKeys[0] === regionKeys[1]) {
      return
    }

    adjacency.get(regionKeys[0])?.add(regionKeys[1])
    adjacency.get(regionKeys[1])?.add(regionKeys[0])
  })

  const recordsByKey = new Map(
    keyedPolygonRecords.map((record) => [record.regionKey, record] as const)
  )
  const visited = new Set<string>()
  const components: MergeablePolygonRecordWithEdges[][] = []

  keyedPolygonRecords.forEach((record) => {
    if (visited.has(record.regionKey)) {
      return
    }

    const stack = [record.regionKey]
    const component: MergeablePolygonRecordWithEdges[] = []

    while (stack.length > 0) {
      const currentKey = stack.pop()
      if (!currentKey || visited.has(currentKey)) {
        continue
      }

      visited.add(currentKey)
      const current = recordsByKey.get(currentKey)
      if (!current) {
        continue
      }

      component.push(current)
      adjacency.get(currentKey)?.forEach((neighborKey) => {
        if (!visited.has(neighborKey)) {
          stack.push(neighborKey)
        }
      })
    }

    if (component.length > 0) {
      components.push(component)
    }
  })

  return components
}

const polygonRecordsContainMergeableSharedEdge = (
  polygonRecords: MergeablePolygonRecordWithEdges[]
) => {
  const seenEdgeKeys = new Set<string>()

  for (const record of polygonRecords) {
    for (const edgeKey of record.edgeKeys) {
      if (seenEdgeKeys.has(edgeKey)) {
        return true
      }
      seenEdgeKeys.add(edgeKey)
    }
  }

  return false
}

const mergeAdjacentPolygonRecordsWithEdges = (
  polygonRecords: MergeablePolygonRecord[]
) => {
  const normalizedPolygonRecords: MergeablePolygonRecordWithEdges[] =
    polygonRecords.map((record) => ({
      ...record,
      edgeKeys: record.edgeKeys ?? buildPolygonEdgeKeys(record.polygon)
    }))

  if (!polygonRecordsContainMergeableSharedEdge(normalizedPolygonRecords)) {
    return normalizedPolygonRecords.map((record) => record.polygon)
  }

  const polygonRecordComponents = buildMergeablePolygonRecordComponents(
    normalizedPolygonRecords
  )
  const mergedPolygons: Vec2[][] = []

  polygonRecordComponents.forEach((componentRecords) => {
    if (componentRecords.length === 1) {
      mergedPolygons.push(componentRecords[0].polygon)
      return
    }

    let mergedPolygonRecords = componentRecords
    let mergedInPass = true

    while (mergedInPass) {
      mergedInPass = false
      const edgeMap = new Map<string, number[]>()

      mergedPolygonRecords.forEach((record, polygonIndex) => {
        record.edgeKeys.forEach((edgeKey) => {
          const polygonIndices = edgeMap.get(edgeKey) ?? []
          polygonIndices.push(polygonIndex)
          edgeMap.set(edgeKey, polygonIndices)
        })
      })

      const consumed = new Set<number>()
      const nextPolygonRecords: MergeablePolygonRecordWithEdges[] = []
      const attemptedPairs = new Set<string>()

      edgeMap.forEach((polygonIndices, edgeKey) => {
        if (polygonIndices.length !== 2) {
          return
        }

        const [leftIndex, rightIndex] = polygonIndices
        if (
          consumed.has(leftIndex) ||
          consumed.has(rightIndex) ||
          leftIndex === rightIndex
        ) {
          return
        }

        const pairKey =
          leftIndex < rightIndex
            ? `${leftIndex}:${rightIndex}`
            : `${rightIndex}:${leftIndex}`
        if (attemptedPairs.has(pairKey)) {
          return
        }

        attemptedPairs.add(pairKey)
        const merged = tryMergeAdjacentPolygons(
          mergedPolygonRecords[leftIndex].polygon,
          mergedPolygonRecords[rightIndex].polygon
        )
        if (!merged) {
          return
        }

        consumed.add(leftIndex)
        consumed.add(rightIndex)
        nextPolygonRecords.push({
          polygon: merged,
          edgeKeys: buildPolygonEdgeKeys(merged)
        })
        mergedInPass = true
      })

      if (!mergedInPass) {
        break
      }

      mergedPolygonRecords.forEach((record, polygonIndex) => {
        if (!consumed.has(polygonIndex)) {
          nextPolygonRecords.push(record)
        }
      })

      mergedPolygonRecords = nextPolygonRecords
    }

    mergedPolygons.push(...mergedPolygonRecords.map((record) => record.polygon))
  })

  return mergedPolygons
}

const mergeAdjacentPolygonFragmentsInternal = (
  polygonRecords: MergeablePolygonRecord[],
  normalizePolygons: boolean,
  polygonsAlreadyNormalized = false
) => {
  const initialPolygonRecords: MergeablePolygonRecordWithEdges[] =
    polygonRecords.map(({ polygon, edgeKeys }) => {
      const normalized = polygonsAlreadyNormalized
        ? polygon
        : ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(polygon))
      return {
        polygon: normalized,
        edgeKeys:
          normalizePolygons || !edgeKeys
            ? buildPolygonEdgeKeys(normalized)
            : edgeKeys
      }
    })

  if (!polygonRecordsContainMergeableSharedEdge(initialPolygonRecords)) {
    return initialPolygonRecords.map((record) => record.polygon)
  }

  return mergeAdjacentPolygonRecordsWithEdges(initialPolygonRecords)
}

const mergeAdjacentNormalizedPolygonFragments = (polygons: Vec2[][]) =>
  mergeAdjacentPolygonFragmentsInternal(
    polygons.map((polygon) => ({
      polygon,
      edgeKeys: buildPolygonEdgeKeys(polygon)
    })),
    false,
    true
  )

const buildPolygonOverlapComponents = (polygons: Vec2[][]) => {
  const normalizedPolygons = polygons
    .map((polygon) =>
      ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(polygon))
    )
    .filter(
      (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS
    )
  const bounds = normalizedPolygons.map((polygon) => getPolygonBounds(polygon))
  const adjacency = new Map<number, Set<number>>()
  const orderedIndices = normalizedPolygons
    .map((_, index) => index)
    .sort((leftIndex, rightIndex) => {
      const leftBounds = bounds[leftIndex]
      const rightBounds = bounds[rightIndex]
      return (leftBounds?.minX ?? 0) - (rightBounds?.minX ?? 0)
    })
  const activeIndices: number[] = []

  normalizedPolygons.forEach((_, index) => {
    adjacency.set(index, new Set())
  })

  orderedIndices.forEach((index) => {
    const polygonBounds = bounds[index]
    if (!polygonBounds) {
      return
    }

    while (
      activeIndices.length > 0 &&
      (bounds[activeIndices[0]]?.maxX ?? -Infinity) < polygonBounds.minX - EPS
    ) {
      activeIndices.shift()
    }

    activeIndices.forEach((activeIndex) => {
      const activeBounds = bounds[activeIndex]
      if (
        !activeBounds ||
        !boundsOverlap(activeBounds, polygonBounds) ||
        !polygonsOverlapAssumingBoundsOverlap(
          normalizedPolygons[activeIndex],
          normalizedPolygons[index]
        )
      ) {
        return
      }

      adjacency.get(activeIndex)?.add(index)
      adjacency.get(index)?.add(activeIndex)
    })

    let insertionIndex = activeIndices.length
    while (insertionIndex > 0) {
      const previousIndex = activeIndices[insertionIndex - 1]
      if ((bounds[previousIndex]?.maxX ?? -Infinity) <= polygonBounds.maxX) {
        break
      }
      insertionIndex -= 1
    }
    activeIndices.splice(insertionIndex, 0, index)
  })

  const visited = new Set<number>()
  const components: Vec2[][][] = []

  normalizedPolygons.forEach((polygon, index) => {
    if (visited.has(index)) {
      return
    }

    const stack = [index]
    const component: Vec2[][] = []

    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited.has(current)) {
        continue
      }

      visited.add(current)
      component.push(normalizedPolygons[current])
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      })
    }

    if (component.length > 0) {
      components.push(component)
    }
  })

  return components
}

const buildCanonicalDisjointPolygonUnion = (polygons: Vec2[][]) => {
  return buildPolygonOverlapComponents(polygons).flatMap(
    (componentPolygons) => {
      if (componentPolygons.length === 1) {
        return componentPolygons
      }

      const polygonSolveShapes = componentPolygons.map(
        (polygon, polygonIndex) => {
          const normalizedPolygon = ensureCounterClockwisePolygon(
            dedupeClosedPolygonPoints(polygon)
          )
          const solvePolygons = isConvexPolygon(normalizedPolygon)
            ? [normalizedPolygon]
            : buildConvexPolygonFragmentsFromTriangles(
                triangulateSimplePolygonCached(normalizedPolygon)
              )

          return solvePolygons.flatMap((solvePolygon) => {
            const normalizedSolvePolygon = ensureCounterClockwisePolygon(
              dedupeClosedPolygonPoints(solvePolygon)
            )
            const bounds = getPolygonBounds(normalizedSolvePolygon)

            return normalizedSolvePolygon.length >= 3 && bounds
              ? [
                  {
                    dashIndex: polygonIndex,
                    polygon: normalizedSolvePolygon,
                    bounds,
                    clipEdges: buildPolygonClipEdges(normalizedSolvePolygon)
                  } satisfies ClipSolveShape
                ]
              : []
          })
        }
      )

      const allClipShapes = polygonSolveShapes.flat()
      const clipShapeSpatialIndex = createClipShapeSpatialIndex(allClipShapes)

      const disjointFragments = polygonSolveShapes.flatMap(
        (sourceShapes, polygonIndex) =>
          sourceShapes.flatMap((sourceShape) => {
            const initialFragment = createAtomicCellRecordNormalized(
              sourceShape.polygon
            )
            if (!initialFragment) {
              return []
            }

            const candidateClipShapes = clipShapeSpatialIndex
              ? queryClipShapeSpatialIndex(
                  clipShapeSpatialIndex,
                  sourceShape.bounds
                )
              : allClipShapes

            const relevantClipShapes = candidateClipShapes.filter(
              (clipShape) =>
                clipShape.dashIndex < polygonIndex &&
                boundsOverlap(sourceShape.bounds, clipShape.bounds) &&
                polygonsOverlapAssumingBoundsOverlap(
                  sourceShape.polygon,
                  clipShape.polygon
                )
            )

            return relevantClipShapes.reduce(
              (fragments, clipShape) =>
                fragments.flatMap((fragment) =>
                  subtractAtomicCellByClipShape(fragment, clipShape)
                ),
              [initialFragment]
            )
          })
      )

      return dedupeAtomicCoverageFragments(
        disjointFragments.map((fragment) => ({
          ...fragment,
          coverageSet: [0]
        }))
      ).map((fragment) => fragment.polygon)
    }
  )
}

const buildClipSolveShapesFromPolygons = (
  polygons: Vec2[][],
  startingDashIndex = 0
) => {
  let nextDashIndex = startingDashIndex

  return polygons.flatMap((polygon) => {
    const normalizedPolygon = ensureCounterClockwisePolygon(
      dedupeClosedPolygonPoints(polygon)
    )
    const solvePolygons = isConvexPolygon(normalizedPolygon)
      ? [normalizedPolygon]
      : buildConvexPolygonFragmentsFromTriangles(
          triangulateSimplePolygonCached(normalizedPolygon)
        )

    const dashIndex = nextDashIndex++

    return solvePolygons.flatMap((solvePolygon) => {
      const normalizedSolvePolygon = ensureCounterClockwisePolygon(
        dedupeClosedPolygonPoints(solvePolygon)
      )
      const bounds = getPolygonBounds(normalizedSolvePolygon)

      return normalizedSolvePolygon.length >= 3 && bounds
        ? [
            {
              dashIndex,
              polygon: normalizedSolvePolygon,
              bounds,
              clipEdges: buildPolygonClipEdges(normalizedSolvePolygon)
            } satisfies ClipSolveShape
          ]
        : []
    })
  })
}

const buildClipSolveShapesFromPreparedPolygonRecords = <
  T extends { polygon: Vec2[]; bounds: PolygonBounds; polygonKey?: string }
>(
  polygonRecords: T[],
  startingDashIndex = 0
) => {
  let nextDashIndex = startingDashIndex

  return polygonRecords.flatMap(({ polygon, bounds }) => {
    const solvePolygons = isConvexPolygon(polygon)
      ? [polygon]
      : buildConvexPolygonFragmentsFromTriangles(
          triangulateSimplePolygonCached(polygon)
        )

    const dashIndex = nextDashIndex++

    return solvePolygons.flatMap((solvePolygon) => {
      const normalizedSolvePolygon = ensureCounterClockwisePolygon(
        dedupeClosedPolygonPoints(solvePolygon)
      )
      const solveBounds =
        solvePolygon === polygon
          ? bounds
          : getPolygonBounds(normalizedSolvePolygon)

      return normalizedSolvePolygon.length >= 3 && solveBounds
        ? [
            {
              dashIndex,
              polygon: normalizedSolvePolygon,
              bounds: solveBounds,
              clipEdges: buildPolygonClipEdges(normalizedSolvePolygon)
            } satisfies ClipSolveShape
          ]
        : []
    })
  })
}

const mergeAtomicRegionsByCoverageSet = (atomicRegions: AtomicRegion[]) => {
  const groups = new Map<string, AtomicRegion[]>()

  atomicRegions.forEach((region) => {
    const groupKey = `${region.componentId}::${region.zoneId}::${region.coverageSet.join(',')}`
    const regions = groups.get(groupKey) ?? []
    regions.push(region)
    groups.set(groupKey, regions)
  })

  const mergedRegions: AtomicRegion[] = []

  groups.forEach((regions) => {
    if (regions.length === 1) {
      mergedRegions.push({
        ...regions[0],
        mergeStable:
          regions[0].coverageSet.length === 1 ? true : regions[0].mergeStable
      })
      return
    }

    const coverageSet = [...regions[0].coverageSet]
    if (coverageSet.length > 1) {
      mergedRegions.push(...regions)
      return
    }

    const componentId = regions[0].componentId
    const adjacentMergedPolygons = mergeAdjacentPolygonFragmentsInternal(
      regions.map((region) => ({
        polygon: region.regionPolygon,
        edgeKeys: region.edgeKeys,
        regionKey: region.regionKey
      })),
      false,
      true
    )

    adjacentMergedPolygons.forEach((polygon) => {
      const bounds = getPolygonBounds(polygon)
      if (!bounds) {
        return
      }
      mergedRegions.push({
        regionKey: `${createPolygonKey(polygon)}::${coverageSet.join(',')}`,
        componentId,
        zoneId: regions[0].zoneId,
        regionPolygon: polygon,
        bounds,
        coverageSet,
        edgeKeys: buildPolygonEdgeKeys(polygon),
        mergeStable: true
      })
    })
  })

  return mergedRegions
}

const buildOwnerMergedRegionPolygons = (
  ownedRegions: AtomicRegionOwnershipRecord[]
) => {
  const regionsByOwner = new Map<string, AtomicRegionOwnershipRecord[]>()

  ownedRegions.forEach((region) => {
    const canonicalZoneId = region.zoneId.replace(/:tile:.*$/, '')
    const groupKey = `${region.ownerDashIndex}::${canonicalZoneId}::${region.coverageSet.join(',')}`
    const ownerRegions = regionsByOwner.get(groupKey) ?? []
    ownerRegions.push(region)
    regionsByOwner.set(groupKey, ownerRegions)
  })

  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    let mergeGroupCount = 0
    let maxGroupSize = 0

    regionsByOwner.forEach((regions) => {
      if (regions.length > 1) {
        mergeGroupCount += 1
      }
      maxGroupSize = Math.max(maxGroupSize, regions.length)
    })

    process.stdout.write(
      `[dashed-geometry-profile] phase6:owner-groups: groups=${regionsByOwner.size} merge-groups=${mergeGroupCount} max-size=${maxGroupSize}\n`
    )
  }

  const mergedPolygonsByCanonicalZone = new Map<string, Vec2[][]>()

  regionsByOwner.forEach((regions) => {
    const canonicalZoneId = regions[0].zoneId.replace(/:tile:.*$/, '')
    const mergedPolygons =
      mergedPolygonsByCanonicalZone.get(canonicalZoneId) ?? []

    if (regions.length === 1) {
      mergedPolygons.push(regions[0].regionPolygon)
      mergedPolygonsByCanonicalZone.set(canonicalZoneId, mergedPolygons)
      return
    }

    if (regions.every((region) => region.mergeStable)) {
      mergedPolygons.push(...regions.map((region) => region.regionPolygon))
      mergedPolygonsByCanonicalZone.set(canonicalZoneId, mergedPolygons)
      return
    }

    mergedPolygons.push(
      ...mergeAdjacentPolygonFragmentsInternal(
        regions.map((region) => ({
          polygon: region.regionPolygon,
          edgeKeys: region.edgeKeys,
          regionKey: region.regionKey
        })),
        false,
        true
      )
    )
    mergedPolygonsByCanonicalZone.set(canonicalZoneId, mergedPolygons)
  })

  return [...mergedPolygonsByCanonicalZone.values()].flatMap((zonePolygons) =>
    zonePolygons.length <= 1 ||
    !polygonsHavePositiveAreaOverlapInSet(zonePolygons)
      ? zonePolygons
      : mergeAdjacentNormalizedPolygonFragments(
          buildCanonicalDisjointPolygonUnion(zonePolygons)
        )
  )
}

const pointCoveredByPreparedPolygonSet = (
  point: Vec2,
  polygons: PreparedPointCoveragePolygonRecord[]
) =>
  polygons.some(
    ({ polygon, bounds }) =>
      point.x >= bounds.minX - EPS &&
      point.x <= bounds.maxX + EPS &&
      point.y >= bounds.minY - EPS &&
      point.y <= bounds.maxY + EPS &&
      (pointInPolygon(point, polygon) ||
        polygon.some((vertex, index) =>
          pointOnSegment(
            point,
            vertex,
            polygon[(index + 1) % polygon.length],
            1e-3
          )
        ))
  )

const getPolygonRepresentativePoints = (polygon: Vec2[]) => {
  const points = [...polygon]

  for (let index = 0; index < polygon.length; index += 1) {
    const next = polygon[(index + 1) % polygon.length]
    points.push({
      x: (polygon[index].x + next.x) / 2,
      y: (polygon[index].y + next.y) / 2
    })
  }

  const centroid = getPolygonCentroid(polygon)
  if (centroid) {
    points.push(centroid)
  }

  return points
}

const buildRenderSourcePolygonRecords = (renderSourcePolygons: Vec2[][]) =>
  renderSourcePolygons
    .map((polygon) =>
      ensureCounterClockwisePolygon(dedupeClosedPolygonPoints(polygon))
    )
    .flatMap((polygon) => {
      const bounds = getPolygonBounds(polygon)
      return polygon.length >= 3 &&
        Math.abs(polygonArea(polygon)) > EPS &&
        bounds
        ? [
            {
              polygon,
              bounds,
              polygonKey: createPolygonKey(polygon),
              representativePoints: getPolygonRepresentativePoints(polygon)
            }
          ]
        : []
    })

const buildPreparedPointCoveragePolygonRecords = (polygons: Vec2[][]) =>
  polygons.flatMap((polygon) => {
    const bounds = getPolygonBounds(polygon)
    return bounds ? [{ polygon, bounds }] : []
  })

const collectOutlineAdditionRecords = (
  primitivePolygonKeys: Set<string>,
  renderSourcePolygonRecords: RenderSourcePolygonRecord[],
  preparedBaselinePolygons: PreparedPointCoveragePolygonRecord[]
) =>
  renderSourcePolygonRecords.filter(({ polygonKey, representativePoints }) => {
    if (primitivePolygonKeys.has(polygonKey)) {
      return false
    }

    return representativePoints.some(
      (point) =>
        !pointCoveredByPreparedPolygonSet(point, preparedBaselinePolygons)
    )
  })

const buildDisjointPreparedPolygonSet = (polygons: Vec2[][]) => {
  if (polygons.length === 0) {
    return []
  }

  const validPolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS
  )

  if (validPolygons.length <= 1) {
    return validPolygons
  }

  if (!polygonsHavePositiveAreaOverlapInSet(validPolygons)) {
    return validPolygons
  }

  const adjacentMergedPolygons =
    mergeAdjacentNormalizedPolygonFragments(validPolygons)

  return polygonsHavePositiveAreaOverlapInSet(adjacentMergedPolygons)
    ? buildCanonicalDisjointPolygonUnion(adjacentMergedPolygons)
    : adjacentMergedPolygons
}

const buildSupplementOnlyPolygonUnion = (
  resolveContext: PreparedSourceModelResolveContext
) => {
  const {
    baselinePolygons,
    baselineShapes,
    outlineAdditionRecords,
    supplementShapeGroups,
    relevantBaselineShapeGroups
  } = resolveContext

  if (outlineAdditionRecords.length === 0) {
    return baselinePolygons
  }

  const resolvedPolygons = [...baselinePolygons]
  const acceptedSupplementShapes: ClipSolveShape[] = []

  supplementShapeGroups.forEach((supplementShapes, supplementGroupIndex) => {
    if (supplementShapes.length === 0) {
      return
    }

    const groupHasOverlappingCoverage = supplementShapes.some(
      (supplementShape, supplementShapeIndex) => {
        if (
          (relevantBaselineShapeGroups[supplementGroupIndex]?.[
            supplementShapeIndex
          ]?.length ?? 0) > 0
        ) {
          return true
        }

        return acceptedSupplementShapes.some(
          (acceptedShape) =>
            boundsOverlap(supplementShape.bounds, acceptedShape.bounds) &&
            polygonsOverlapAssumingBoundsOverlap(
              supplementShape.polygon,
              acceptedShape.polygon
            )
        )
      }
    )

    if (!groupHasOverlappingCoverage) {
      resolvedPolygons.push(
        outlineAdditionRecords[supplementGroupIndex].polygon
      )
      acceptedSupplementShapes.push(...supplementShapes)
      return
    }

    supplementShapes.forEach((supplementShape, supplementShapeIndex) => {
      const initialFragment = createAtomicCellRecordNormalized(
        supplementShape.polygon
      )
      if (!initialFragment) {
        return
      }

      const supplementCandidateShapes = acceptedSupplementShapes.filter(
        (clipShape) => boundsOverlap(supplementShape.bounds, clipShape.bounds)
      )
      const baselineCandidateShapes =
        relevantBaselineShapeGroups[supplementGroupIndex]?.[
          supplementShapeIndex
        ] ?? []
      const relevantSupplementShapes = supplementCandidateShapes.filter(
        (clipShape) =>
          boundsOverlap(supplementShape.bounds, clipShape.bounds) &&
          polygonsOverlapAssumingBoundsOverlap(
            supplementShape.polygon,
            clipShape.polygon
          )
      )
      const relevantClipShapes = baselineCandidateShapes.concat(
        relevantSupplementShapes
      )

      const uncoveredFragments = relevantClipShapes.reduce(
        (fragments, clipShape) =>
          fragments.flatMap((fragment) =>
            subtractAtomicCellByClipShape(fragment, clipShape)
          ),
        [initialFragment]
      )

      uncoveredFragments.forEach((fragment) => {
        resolvedPolygons.push(fragment.polygon)
      })
      acceptedSupplementShapes.push(
        ...buildClipSolveShapesFromPolygons(
          uncoveredFragments.map((fragment) => fragment.polygon),
          baselineShapes.length + acceptedSupplementShapes.length
        )
      )
    })
  })

  return resolvedPolygons
}

const buildSupplementOverlapOnlyPolygons = (
  resolveContext: Pick<
    PreparedSourceModelResolveContext,
    'baselinePolygons' | 'outlineAdditionRecords'
  >
) => {
  const supplementPolygons = resolveContext.outlineAdditionRecords.map(
    (record) => record.polygon
  )

  if (supplementPolygons.length === 0) {
    return resolveContext.baselinePolygons
  }

  const disjointSupplementPolygons =
    buildDisjointPreparedPolygonSet(supplementPolygons)

  return resolveContext.baselinePolygons.concat(disjointSupplementPolygons)
}

const buildBaselineOverlapOnlyPolygons = (
  resolveContext: Pick<
    PreparedSourceModelResolveContext,
    | 'baselinePolygons'
    | 'baselineShapes'
    | 'baselineSpatialIndex'
    | 'outlineAdditionRecords'
    | 'supplementShapeGroups'
  >
) => {
  const resolvedPolygons = [...resolveContext.baselinePolygons]

  resolveContext.supplementShapeGroups.forEach(
    (supplementShapes, supplementGroupIndex) => {
      if (supplementShapes.length === 0) {
        return
      }

      const groupHasBaselineOverlap = supplementShapes.some(
        (_, supplementShapeIndex) =>
          (resolveContext.relevantBaselineShapeGroups[supplementGroupIndex]?.[
            supplementShapeIndex
          ]?.length ?? 0) > 0
      )

      if (!groupHasBaselineOverlap) {
        resolvedPolygons.push(
          resolveContext.outlineAdditionRecords[supplementGroupIndex].polygon
        )
        return
      }

      supplementShapes.forEach((supplementShape, supplementShapeIndex) => {
        const initialFragment = createAtomicCellRecordNormalized(
          supplementShape.polygon
        )
        if (!initialFragment) {
          return
        }

        const relevantBaselineShapes =
          resolveContext.relevantBaselineShapeGroups[supplementGroupIndex]?.[
            supplementShapeIndex
          ] ?? []

        const uncoveredFragments = relevantBaselineShapes.reduce(
          (fragments, baselineShape) =>
            fragments.flatMap((fragment) =>
              subtractAtomicCellByClipShape(fragment, baselineShape)
            ),
          [initialFragment]
        )

        uncoveredFragments.forEach((fragment) => {
          resolvedPolygons.push(fragment.polygon)
        })
      })
    }
  )

  return resolvedPolygons
}

const buildPreparedSourceModelResolveContext = (
  baselinePolygons: Vec2[][],
  preparedBaselinePolygons: PreparedPointCoveragePolygonRecord[],
  supplementPolygonRecords: RenderSourcePolygonRecord[]
) => {
  if (supplementPolygonRecords.length === 0) {
    return {
      baselinePolygons,
      preparedBaselinePolygons,
      baselineShapes: [] as ClipSolveShape[],
      baselineSpatialIndex: null,
      outlineAdditionRecords: [],
      supplementShapeGroups: [] as ClipSolveShape[][],
      relevantBaselineShapeGroups: [] as ClipSolveShape[][][],
      exactResolveMode: 'none' as const
    } satisfies PreparedSourceModelResolveContext
  }

  const baselineShapes = buildClipSolveShapesFromPreparedPolygonRecords(
    preparedBaselinePolygons
  )
  const baselineSpatialIndex = createClipShapeSpatialIndex(baselineShapes)
  const supplementShapeGroups = supplementPolygonRecords.map(
    (supplementPolygonRecord, supplementIndex) =>
      buildClipSolveShapesFromPreparedPolygonRecords(
        [supplementPolygonRecord],
        baselineShapes.length + supplementIndex
      )
  )
  const relevantBaselineShapeGroups = supplementShapeGroups.map(
    (supplementShapes) =>
      supplementShapes.map((supplementShape) => {
        const baselineCandidateShapes = baselineSpatialIndex
          ? queryClipShapeSpatialIndex(
              baselineSpatialIndex,
              supplementShape.bounds
            )
          : baselineShapes

        return baselineCandidateShapes.filter(
          (baselineShape) =>
            boundsOverlap(supplementShape.bounds, baselineShape.bounds) &&
            polygonsOverlapAssumingBoundsOverlap(
              supplementShape.polygon,
              baselineShape.polygon
            )
        )
      })
  )
  const acceptedSupplementShapes: ClipSolveShape[] = []
  let hasBaselineOverlap = false
  let hasSupplementOverlap = false

  for (const [
    supplementGroupIndex,
    supplementShapes
  ] of supplementShapeGroups.entries()) {
    for (const [
      supplementShapeIndex,
      supplementShape
    ] of supplementShapes.entries()) {
      if (
        (relevantBaselineShapeGroups[supplementGroupIndex]?.[
          supplementShapeIndex
        ]?.length ?? 0) > 0
      ) {
        hasBaselineOverlap = true
      }

      const overlappingSupplementShape = acceptedSupplementShapes.some(
        (acceptedShape) =>
          boundsOverlap(supplementShape.bounds, acceptedShape.bounds) &&
          polygonsOverlapAssumingBoundsOverlap(
            supplementShape.polygon,
            acceptedShape.polygon
          )
      )
      if (overlappingSupplementShape) {
        hasSupplementOverlap = true
      }

      if (hasBaselineOverlap && hasSupplementOverlap) {
        break
      }
    }

    if (hasBaselineOverlap && hasSupplementOverlap) {
      break
    }

    acceptedSupplementShapes.push(...supplementShapes)
  }

  const exactResolveMode = hasBaselineOverlap
    ? hasSupplementOverlap
      ? ('baseline-and-supplement-overlap' as const)
      : ('baseline-overlap' as const)
    : hasSupplementOverlap
      ? ('supplement-overlap' as const)
      : ('none' as const)

  return {
    baselinePolygons,
    preparedBaselinePolygons,
    baselineShapes,
    baselineSpatialIndex,
    outlineAdditionRecords: supplementPolygonRecords,
    supplementShapeGroups,
    relevantBaselineShapeGroups,
    exactResolveMode
  } satisfies PreparedSourceModelResolveContext
}

const buildResolvedSourceModelPolygons = (
  resolveContext: PreparedSourceModelResolveContext
) => {
  const { baselinePolygons, outlineAdditionRecords, exactResolveMode } =
    resolveContext

  if (outlineAdditionRecords.length === 0) {
    return baselinePolygons
  }

  if (exactResolveMode === 'none') {
    return baselinePolygons.concat(
      outlineAdditionRecords.map((record) => record.polygon)
    )
  }

  if (exactResolveMode === 'supplement-overlap') {
    return buildSupplementOverlapOnlyPolygons(resolveContext)
  }

  if (exactResolveMode === 'baseline-overlap') {
    return buildBaselineOverlapOnlyPolygons(resolveContext)
  }

  return buildSupplementOnlyPolygonUnion(resolveContext)
}

const buildDashCandidateSourceBounds = (
  primitives: DashPrimitiveRecord[],
  renderSourcePolygonRecords: RenderSourcePolygonRecord[]
): PolygonBounds | null =>
  renderSourcePolygonRecords.reduce<PolygonBounds | null>(
    (accumulatedBounds, polygonRecord) =>
      mergeBounds(accumulatedBounds, polygonRecord.bounds),
    primitives.reduce<PolygonBounds | null>(
      (accumulatedBounds, primitive) =>
        mergeBounds(accumulatedBounds, primitive.bounds),
      null
    )
  )

const buildDistinctPrimitivePolygonRecords = (
  primitives: DashPrimitiveRecord[]
) => {
  const polygonMap = new Map<string, PreparedDistinctPrimitivePolygonRecord>()

  primitives.forEach((primitive) => {
    const polygon = primitive.polygon

    if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= EPS) {
      return
    }

    polygonMap.set(primitive.polygonKey, {
      polygon,
      bounds: primitive.bounds,
      polygonKey: primitive.polygonKey
    })
  })

  return [...polygonMap.values()]
}

const buildPreparedDashCandidateSourceGeometry = (
  dashIndex: number,
  outlineGeometry: {
    primitives: StrokePrimitivePolygon[]
    polygons: Vec2[][]
  } | null
): PreparedDashCandidateSourceGeometry => {
  if (!outlineGeometry) {
    return {
      primitives: [],
      distinctPrimitivePolygonRecords: [],
      renderSourcePolygonRecords: [],
      normalizedOutlinePolygons: []
    }
  }

  const primitiveMap = new Map<string, DashPrimitiveRecord>()
  const distinctPrimitivePolygonMap = new Map<
    string,
    PreparedDistinctPrimitivePolygonRecord
  >()

  outlineGeometry.primitives.forEach((primitive, primitiveIndex) => {
    const normalizedPolygon = ensureCounterClockwisePolygon(
      dedupeClosedPolygonPoints(primitive.polygon)
    )
    const bounds = getPolygonBounds(normalizedPolygon)

    if (
      normalizedPolygon.length < 3 ||
      Math.abs(polygonArea(normalizedPolygon)) <= EPS ||
      !bounds
    ) {
      return
    }

    const polygonKey = createPolygonKey(normalizedPolygon)
    const primitiveRecord = {
      id: `${dashIndex}:${primitive.kind}:${primitiveIndex}`,
      dashIndex,
      kind: primitive.kind,
      touchedSegmentIndices: [...primitive.touchedSegmentIndices],
      polygon: normalizedPolygon,
      bounds,
      polygonKey
    } satisfies DashPrimitiveRecord

    primitiveMap.set(primitiveRecord.id, primitiveRecord)

    if (!distinctPrimitivePolygonMap.has(polygonKey)) {
      distinctPrimitivePolygonMap.set(polygonKey, {
        polygon: normalizedPolygon,
        bounds,
        polygonKey
      })
    }
  })

  const renderSourcePolygonRecords = buildRenderSourcePolygonRecords(
    outlineGeometry.polygons
  )

  return {
    primitives: [...primitiveMap.values()],
    distinctPrimitivePolygonRecords: [...distinctPrimitivePolygonMap.values()],
    renderSourcePolygonRecords,
    normalizedOutlinePolygons: renderSourcePolygonRecords.map(
      (record) => record.polygon
    )
  }
}

const buildDashCandidateRenderGeometryCacheKey = (
  primitives: DashPrimitiveRecord[],
  renderSourcePolygons: Vec2[][]
) =>
  `${primitives
    .map(
      (primitive) =>
        `${primitive.id}::${primitive.kind}::${primitive.touchedSegmentIndices.join(',')}::${primitive.polygonKey}`
    )
    .join('||')}::${renderSourcePolygons
    .map((polygon) => createPolygonKey(polygon))
    .join('||')}`

const getDashCandidateRenderGeometryCacheKey = (
  candidate: Pick<
    DashCandidateRecord,
    'renderGeometryCacheKey' | 'primitives' | 'renderSourcePolygons'
  >
) => {
  if (candidate.renderGeometryCacheKey) {
    return candidate.renderGeometryCacheKey
  }

  if (!candidate.renderSourcePolygons) {
    return undefined
  }

  candidate.renderGeometryCacheKey = buildDashCandidateRenderGeometryCacheKey(
    candidate.primitives,
    candidate.renderSourcePolygons
  )

  return candidate.renderGeometryCacheKey
}

const buildDashCandidateRenderSourceModelFromPolygons = (
  solvePrimitivePolygonRecords: PreparedDistinctPrimitivePolygonRecord[],
  renderSourcePolygonRecords: RenderSourcePolygonRecord[],
  cacheKey?: string,
  startedAt = DASHED_GEOMETRY_PROFILE_ENABLED ? performance.now() : 0,
  profileLabel?: string
) => {
  if (cacheKey) {
    const cachedModel = dashCandidateRenderSourceModelCache.get(cacheKey)
    if (cachedModel) {
      return cachedModel
    }
  }

  const solvePrimitivePolygons = solvePrimitivePolygonRecords.map(
    (record) => record.polygon
  )
  const mergedSolvePrimitivePolygons = polygonsHavePositiveAreaOverlapInSet(
    solvePrimitivePolygons
  )
    ? buildGreedyConvexMergedPolygonSet(solvePrimitivePolygons)
    : solvePrimitivePolygons
  const primitivePolygonKeys = new Set(
    mergedSolvePrimitivePolygons.map((polygon) => createPolygonKey(polygon))
  )

  if (mergedSolvePrimitivePolygons.length === 0) {
    if (DASHED_GEOMETRY_PROFILE_ENABLED) {
      process.stdout.write(
        `[dashed-geometry-profile] phase2:render-source-model: primitives=0 outlines=${renderSourcePolygonRecords.length} total=${(performance.now() - startedAt).toFixed(2)}ms\n`
      )
    }
    const emptyModel = {
      baselinePolygons: [] as Vec2[][],
      supplementPolygons: [] as Vec2[][]
    }
    return cacheKey
      ? setCachedValueWithLimit(
          dashCandidateRenderSourceModelCache,
          cacheKey,
          emptyModel,
          MAX_DASH_CANDIDATE_RENDER_SOURCE_MODEL_CACHE_ENTRIES
        )
      : emptyModel
  }

  const baselineStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now()
    : 0
  const primitiveBaseline = buildDisjointPreparedPolygonSet(
    mergedSolvePrimitivePolygons
  )
  const preparedPrimitiveBaseline =
    buildPreparedPointCoveragePolygonRecords(primitiveBaseline)
  const baselineElapsed = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now() - baselineStartedAt
    : 0
  const supplementStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now()
    : 0
  const outlineAdditionRecords = collectOutlineAdditionRecords(
    primitivePolygonKeys,
    renderSourcePolygonRecords,
    preparedPrimitiveBaseline
  )
  const supplementElapsed = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now() - supplementStartedAt
    : 0
  const exactResolveStartedAt = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now()
    : 0
  const resolveContext = buildPreparedSourceModelResolveContext(
    primitiveBaseline,
    preparedPrimitiveBaseline,
    outlineAdditionRecords
  )
  const polygons = buildResolvedSourceModelPolygons(resolveContext)
  const exactResolveElapsed = DASHED_GEOMETRY_PROFILE_ENABLED
    ? performance.now() - exactResolveStartedAt
    : 0

  if (DASHED_GEOMETRY_PROFILE_ENABLED) {
    process.stdout.write(
      `[dashed-geometry-profile] phase2:render-source-model${
        profileLabel ? `:${profileLabel}` : ''
      }: primitives=${mergedSolvePrimitivePolygons.length} outlines=${renderSourcePolygonRecords.length} mode=${resolveContext.exactResolveMode} baseline=${baselineElapsed.toFixed(2)}ms supplement=${supplementElapsed.toFixed(2)}ms exact=${exactResolveElapsed.toFixed(2)}ms total=${(performance.now() - startedAt).toFixed(2)}ms\n`
    )
  }

  const model = {
    baselinePolygons: primitiveBaseline,
    supplementPolygons: outlineAdditionRecords.map((record) => record.polygon),
    polygons,
    polygonsMaterialized: true
  }

  return cacheKey
    ? setCachedValueWithLimit(
        dashCandidateRenderSourceModelCache,
        cacheKey,
        model,
        MAX_DASH_CANDIDATE_RENDER_SOURCE_MODEL_CACHE_ENTRIES
      )
    : model
}

const buildDashCandidatePassthroughRenderPolygonsFromPolygons = (
  renderSourcePolygonRecords: RenderSourcePolygonRecord[]
) => {
  const polygonMap = new Map<string, Vec2[]>()

  renderSourcePolygonRecords.forEach(({ polygon, polygonKey }) => {
    polygonMap.set(polygonKey, polygon)
  })

  const polygons = [...polygonMap.values()]

  return {
    polygons,
    safe:
      polygons.length <= 1 || !polygonsHavePositiveAreaOverlapInSet(polygons)
  }
}

const buildDashCandidateFastRenderStateFromPolygons = (
  normalizedPrimitivePolygonRecords: PreparedDistinctPrimitivePolygonRecord[],
  renderSourcePolygonRecords: RenderSourcePolygonRecord[]
) => {
  if (normalizedPrimitivePolygonRecords.length === 0) {
    return {
      baselinePolygons: [] as Vec2[][],
      supplementPolygons: [] as Vec2[][],
      polygons: [] as Vec2[][],
      polygonsMaterialized: true
    }
  }

  const baselinePolygons = normalizedPrimitivePolygonRecords.map(
    (record) => record.polygon
  )
  const primitivePolygonKeys = new Set(
    normalizedPrimitivePolygonRecords.map((record) => record.polygonKey)
  )

  if (polygonsHavePositiveAreaOverlapInSet(baselinePolygons)) {
    return {
      baselinePolygons: undefined,
      supplementPolygons: undefined,
      polygons: [] as Vec2[][],
      polygonsMaterialized: false,
      sourceModelReason: 'primitive-overlap' as const
    }
  }

  const preparedBaselinePolygons = normalizedPrimitivePolygonRecords.map(
    ({ polygon, bounds }) => ({ polygon, bounds })
  )
  const outlineAdditionRecords = collectOutlineAdditionRecords(
    primitivePolygonKeys,
    renderSourcePolygonRecords,
    preparedBaselinePolygons
  )
  const outlineAdditions = outlineAdditionRecords.map(
    (record) => record.polygon
  )
  const combinedPolygons = baselinePolygons.concat(outlineAdditions)
  const polygonsMaterialized =
    outlineAdditions.length === 0 ||
    !polygonsHavePositiveAreaOverlapInSet(combinedPolygons)

  return {
    baselinePolygons,
    supplementPolygons: outlineAdditions,
    polygons: polygonsMaterialized ? combinedPolygons : ([] as Vec2[][]),
    polygonsMaterialized,
    sourceModelReason: polygonsMaterialized
      ? undefined
      : ('combined-overlap' as const)
  }
}

const buildDashCandidatePolygons = (
  baselinePolygons: Vec2[][],
  supplementPolygons: Vec2[][]
) => {
  if (baselinePolygons.length === 0) {
    return []
  }

  if (supplementPolygons.length === 0) {
    return baselinePolygons
  }

  return buildDisjointPreparedPolygonSet(
    baselinePolygons.concat(supplementPolygons)
  )
}

const materializeDashCandidateBounds = (candidate: DashCandidateRecord) =>
  candidate.polygons.reduce<PolygonBounds | null>(
    (accumulatedBounds, polygon) =>
      mergeBounds(accumulatedBounds, getPolygonBounds(polygon)),
    null
  )

export const materializeDashCandidateRenderPolygons = (
  candidate: DashCandidateRecord
): Vec2[][] => {
  if (candidate.polygonsMaterialized ?? !candidate.renderSourcePolygons) {
    return candidate.polygons
  }

  const renderGeometryCacheKey =
    getDashCandidateRenderGeometryCacheKey(candidate)

  if (renderGeometryCacheKey) {
    const cachedRenderGeometry = dashCandidateRenderGeometryCache.get(
      renderGeometryCacheKey
    )
    if (cachedRenderGeometry) {
      candidate.polygons = cachedRenderGeometry.polygons
      candidate.polygonsMaterialized = true
      candidate.bounds = cachedRenderGeometry.bounds
      return candidate.polygons
    }
  }

  if (candidate.renderBaselinePolygons && candidate.renderSupplementPolygons) {
    candidate.polygons = buildDashCandidatePolygons(
      candidate.renderBaselinePolygons,
      candidate.renderSupplementPolygons
    )
  } else {
    const {
      baselinePolygons,
      supplementPolygons,
      polygons,
      polygonsMaterialized
    } = buildDashCandidateRenderSourceModelFromPolygons(
      candidate.solvePrimitivePolygonRecords ??
        buildDistinctPrimitivePolygonRecords(candidate.primitives),
      candidate.renderSourcePolygonRecords ??
        buildRenderSourcePolygonRecords(candidate.renderSourcePolygons),
      candidate.assemblyCacheKey
        ? `${candidate.assemblyCacheKey}::source-model`
        : undefined,
      DASHED_GEOMETRY_PROFILE_ENABLED ? performance.now() : 0,
      `dash-${candidate.dashIndex}`
    )

    candidate.renderBaselinePolygons = baselinePolygons
    candidate.renderSupplementPolygons = supplementPolygons
    candidate.polygons = polygonsMaterialized
      ? polygons
      : buildDashCandidatePolygons(baselinePolygons, supplementPolygons)
  }
  candidate.polygonsMaterialized = true
  candidate.bounds = materializeDashCandidateBounds(candidate)

  if (renderGeometryCacheKey) {
    setCachedValueWithLimit(
      dashCandidateRenderGeometryCache,
      renderGeometryCacheKey,
      {
        polygons: candidate.polygons,
        bounds: candidate.bounds
      },
      MAX_DASH_CANDIDATE_RENDER_GEOMETRY_CACHE_ENTRIES
    )
  }

  return candidate.polygons
}

export const materializeDashedGeometryPhase2Model = (
  phase2: DashedGeometryPhase2Result
): GeometryModel => {
  if (phase2.model) {
    return phase2.model
  }

  phase2.model = {
    polygons: phase2.dashCandidates.flatMap((candidate) =>
      materializeDashCandidateRenderPolygons(candidate)
    )
  }

  return phase2.model
}

const createPathSegmentCacheKey = (segment: PathSegment) => {
  if (segment.type === 'line') {
    return [
      'l',
      segment.start.x.toFixed(4),
      segment.start.y.toFixed(4),
      segment.end.x.toFixed(4),
      segment.end.y.toFixed(4),
      segment.startAnchorType ?? 'n',
      segment.endAnchorType ?? 'n'
    ].join(':')
  }

  return [
    'c',
    segment.start.x.toFixed(4),
    segment.start.y.toFixed(4),
    segment.control1.x.toFixed(4),
    segment.control1.y.toFixed(4),
    segment.control2.x.toFixed(4),
    segment.control2.y.toFixed(4),
    segment.end.x.toFixed(4),
    segment.end.y.toFixed(4),
    segment.startAnchorType ?? 'n',
    segment.endAnchorType ?? 'n'
  ].join(':')
}

const createPathGeometryCacheKey = (path: PathGeometry) =>
  [
    path.closed ? 'closed' : 'open',
    path.totalLength.toFixed(4),
    path.sampledPoints.length,
    path.segments.length,
    ...path.segments.map(createPathSegmentCacheKey)
  ].join('|')

const createRenderableStrokeGeometryCacheKey = (stroke: RenderableStroke) =>
  [
    stroke.style,
    stroke.position,
    stroke.width.toFixed(4),
    stroke.dash?.toFixed(4) ?? 'n',
    stroke.gap?.toFixed(4) ?? 'n',
    stroke.join ?? 'n',
    stroke.cap ?? 'n',
    stroke.join === 'miter' ? (stroke.miterLimit?.toFixed(4) ?? 'n') : 'na'
  ].join('|')

const createDashedGeometryPipelineStateCacheKey = (
  path: PathGeometry,
  stroke: RenderableStroke
) =>
  `${createPathGeometryCacheKey(path)}::${createRenderableStrokeGeometryCacheKey(
    stroke
  )}`

const buildDashedGeometryPhase6FinalPolygons = (
  assembly: DashedGeometryPhase6AssemblyInput
): Vec2[][] => {
  const ownedPolygons = buildOwnerMergedRegionPolygons(assembly.ownedRegions)
  return assembly.passthroughPolygons.concat(ownedPolygons)
}

const createDashedGeometryPhase6ResultCacheKey = (
  assembly:
    | DashedGeometryPhase6AssemblyInput
    | DashedGeometryPhase6AssemblyIdentity
) => {
  const passthroughKey = assembly.passthroughCandidates
    .map(
      (candidate) =>
        `${candidate.dashIndex}:${candidate.cacheKey ?? ('polygons' in candidate ? candidate.polygons.length : 'none')}`
    )
    .join('|')
  const ownershipKey = [...assembly.ownedRegions]
    .sort((left, right) => {
      if (left.ownerDashIndex !== right.ownerDashIndex) {
        return left.ownerDashIndex - right.ownerDashIndex
      }

      return left.regionKey.localeCompare(right.regionKey)
    })
    .map(
      (region) =>
        `${region.ownerDashIndex}:${region.zoneId}:${region.coverageSet.join(
          ','
        )}:${region.regionKey}`
    )
    .join('|')

  return `${assembly.assemblyMode}::${passthroughKey}::${ownershipKey}`
}

const DASHED_GEOMETRY_PROFILE_ENABLED =
  typeof process !== 'undefined' &&
  typeof process.env === 'object' &&
  process.env.ASYRA_DASHED_GEOMETRY_PROFILE === '1'

const measureDashedGeometryPhase = <T>(label: string, run: () => T): T => {
  if (!DASHED_GEOMETRY_PROFILE_ENABLED) {
    return run()
  }

  const startedAt = performance.now()
  const result = run()
  const endedAt = performance.now()

  process.stdout.write(
    `[dashed-geometry-profile] ${label}: ${(endedAt - startedAt).toFixed(2)}ms\n`
  )

  return result
}

export const finalizeDashedGeometryPhase6 = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPhase6Result | null => {
  const assemblyIdentity = measureDashedGeometryPhase(
    'phase6:assembly-identity',
    () => buildDashedGeometryPhase6AssemblyIdentity(phase2, phase5)
  )
  if (assemblyIdentity.status !== 'ready') {
    return null
  }

  const phase6ResultCacheKey =
    createDashedGeometryPhase6ResultCacheKey(assemblyIdentity)
  const cachedPhase6Result =
    dashedGeometryPhase6ResultCache.get(phase6ResultCacheKey)

  if (cachedPhase6Result) {
    return cachedPhase6Result
  }

  const assembly = measureDashedGeometryPhase('phase6:assembly-input', () =>
    buildDashedGeometryPhase6AssemblyInput(phase2, phase5)
  )

  return measureDashedGeometryPhase('phase6:finalize', () => {
    const phase6Result = buildDashedGeometryPhase6ResultContract(
      assembly,
      assembly.assemblyMode === 'passthrough-only'
        ? materializeDashedGeometryPhase2Model(phase2).polygons
        : buildDashedGeometryPhase6FinalPolygons(assembly)
    )
    return setCachedValueWithLimit(
      dashedGeometryPhase6ResultCache,
      phase6ResultCacheKey,
      phase6Result,
      MAX_PHASE6_RESULT_CACHE_ENTRIES
    )
  })
}

export const applyDashedGeometryPhase6ToPipelineState = (
  pipeline: DashedGeometryPipelineState,
  phase6: DashedGeometryPhase6Result
): DashedGeometryPipelineState => ({
  ...pipeline,
  phase6,
  nextPhase: 'complete'
})

const buildReadyDashedGeometryPhase6Result = (
  phase2: DashedGeometryPhase2Result,
  phase5: DashedGeometryPhase5Result
): DashedGeometryPhase6Result | null =>
  finalizeDashedGeometryPhase6(phase2, phase5)

export const computeDashedGeometryPipelineState = (
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryPipelineState | null => {
  const pipelineStateCacheKey = createDashedGeometryPipelineStateCacheKey(
    path,
    stroke
  )
  const cachedPipeline =
    dashedGeometryPipelineStateCache.get(pipelineStateCacheKey) ?? null

  if (cachedPipeline) {
    return cachedPipeline
  }

  const pipeline = measureDashedGeometryPhase('phase1-4:pipeline', () =>
    computeDashedGeometryPipelineToPhase4(path, stroke)
  )
  if (!pipeline) {
    return null
  }

  const phase5Contract = measureDashedGeometryPhase('phase5:contract', () =>
    buildDashedGeometryPhase5DecisionContract(pipeline.phase4)
  )
  const phase5 = measureDashedGeometryPhase('phase5:rules', () =>
    applyInitialDashedGeometryPhase5Rules(pipeline.phase2, phase5Contract)
  )
  const completesAtPhase2 =
    pipeline.phase3.overlapGraph.edges.length === 0 &&
    phase5.decisions.length === 0
  const phase6 = completesAtPhase2
    ? null
    : measureDashedGeometryPhase('phase6:ready-result', () =>
        buildReadyDashedGeometryPhase6Result(pipeline.phase2, phase5)
      )

  if (completesAtPhase2) {
    materializeDashedGeometryPhase2Model(pipeline.phase2)
  }

  return setCachedValueWithLimit(
    dashedGeometryPipelineStateCache,
    pipelineStateCacheKey,
    {
      ...pipeline,
      phase5,
      phase6,
      completionPhase: completesAtPhase2 ? 'phase2' : phase6 ? 'phase6' : null,
      nextPhase:
        completesAtPhase2 || phase6
          ? 'complete'
          : phase5.pendingDecisionCount > 0
            ? 'phase5'
            : 'phase6'
    },
    MAX_DASHED_GEOMETRY_PIPELINE_STATE_CACHE_ENTRIES
  )
}

export const resolveDashedGeometryForRender = (
  path: PathGeometry,
  stroke: RenderableStroke
): ResolvedDashedGeometryForRenderResult | null => {
  const pipeline = computeDashedGeometryPipelineState(path, stroke)
  if (!pipeline) {
    return null
  }

  if (pipeline.phase6) {
    return {
      status: 'resolved',
      completionPhase: 'phase6',
      pendingPhase: null,
      model: {
        polygons: pipeline.phase6.finalPolygons
      },
      pipeline
    }
  }

  if (pipeline.completionPhase === 'phase2') {
    return {
      status: 'resolved',
      completionPhase: 'phase2',
      pendingPhase: null,
      model: materializeDashedGeometryPhase2Model(pipeline.phase2),
      pipeline
    }
  }

  return {
    status: 'pending',
    completionPhase: null,
    pendingPhase: pipeline.nextPhase === 'complete' ? null : pipeline.nextPhase,
    model: null,
    pipeline
  }
}

export const selectDashedGeometryModelFromPipelineState = (
  pipeline: DashedGeometryPipelineState
): SelectedDashedGeometryModelForRenderResult => {
  if (pipeline.phase6) {
    return {
      status: 'resolved',
      completionPhase: 'phase6',
      pendingPhase: null,
      model: {
        polygons: pipeline.phase6.finalPolygons
      },
      pipeline
    }
  }

  if (pipeline.completionPhase === 'phase2') {
    return {
      status: 'resolved',
      completionPhase: 'phase2',
      pendingPhase: null,
      model: materializeDashedGeometryPhase2Model(pipeline.phase2),
      pipeline
    }
  }

  return {
    status: 'pending',
    completionPhase: null,
    pendingPhase: pipeline.nextPhase === 'complete' ? null : pipeline.nextPhase,
    model: null,
    pipeline
  }
}

export const selectDashedGeometryModelForRender = (
  path: PathGeometry,
  stroke: RenderableStroke
): SelectedDashedGeometryModelForRenderResult | null => {
  const pipeline = computeDashedGeometryPipelineState(path, stroke)
  if (!pipeline) {
    return null
  }

  return selectDashedGeometryModelFromPipelineState(pipeline)
}

const buildDashedGeometryPhase2ResultFromPhase1 = (
  phase1: DashedGeometryPhase1Result
): DashedGeometryPhase2Result | null => {
  const phase2ScopeKey = createDashedGeometryPhase2ScopeKey(
    phase1.path,
    phase1.stroke
  )
  const dashIntervalAllocation = buildDashIntervalAllocation(
    phase1.path,
    phase1.dashContext
  )
  const dashCandidates = dashIntervalAllocation.dashIntervals.map(
    (interval) => {
      const subpath = buildDashSubpathGeometry(
        phase1.path,
        interval,
        phase1.stroke
      )
      const outlineGeometry = subpath
        ? buildOpenStrokeOutlineGeometry(subpath, phase1.stroke)
        : null
      const {
        primitives,
        distinctPrimitivePolygonRecords,
        renderSourcePolygonRecords,
        normalizedOutlinePolygons
      } = buildPreparedDashCandidateSourceGeometry(
        interval.dashIndex,
        outlineGeometry
      )
      const {
        baselinePolygons: fastBaselinePolygons,
        supplementPolygons: fastSupplementPolygons,
        polygons: fastPolygons,
        polygonsMaterialized: fastPolygonsMaterialized,
        sourceModelReason
      } = buildDashCandidateFastRenderStateFromPolygons(
        distinctPrimitivePolygonRecords,
        renderSourcePolygonRecords
      )
      const { polygons: passthroughRenderPolygons, safe: passthroughSafe } =
        buildDashCandidatePassthroughRenderPolygonsFromPolygons(
          renderSourcePolygonRecords
        )
      return {
        dashIndex: interval.dashIndex,
        interval,
        centerlinePoints: subpath ? subpath.centerlinePoints : [],
        primitives,
        assemblyCacheKey: `${phase2ScopeKey}::dash:${interval.dashIndex}`,
        renderGeometryCacheKey: undefined,
        renderSourcePolygons: normalizedOutlinePolygons,
        renderSourcePolygonRecords,
        solvePrimitivePolygonRecords: distinctPrimitivePolygonRecords,
        passthroughRenderPolygons,
        passthroughRenderPolygonsSafe: passthroughSafe,
        renderBaselinePolygons: fastBaselinePolygons,
        renderSupplementPolygons: fastSupplementPolygons,
        polygons: fastPolygons,
        polygonsMaterialized: fastPolygonsMaterialized,
        sourceModelReason,
        bounds: buildDashCandidateSourceBounds(
          primitives,
          renderSourcePolygonRecords
        )
      }
    }
  )

  return {
    model: null,
    dashIntervalAllocation,
    dashCandidates
  }
}

export const createDashedGeometryModel = (
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryModelResult | null => {
  const phase1 = buildDashedGeometryPhase1(path, stroke)
  if (!phase1) {
    return null
  }

  const phase2 = buildDashedGeometryPhase2ResultFromPhase1(phase1)
  if (!phase2) {
    return null
  }

  return {
    ...phase2,
    model: materializeDashedGeometryPhase2Model(phase2)
  }
}

export const __dashedGeometryModelTestUtils = {
  distance,
  samePoint,
  dedupeAdjacentPoints,
  dedupeClosedPolygonPoints,
  polygonArea,
  getPolygonBounds,
  normalizeVector,
  getSegmentStartTangent,
  mergePointLists,
  dedupeAdjacentFrames,
  mergeFrameLists,
  simplifyFramesForStrokeOutline,
  collapseSharpNeighborhoodFramesForOutline,
  getCurveLengthAtT,
  getCurveTAtLength,
  getDashPattern,
  createDashedStrokeGeometryContext,
  buildDashedStrokeIntervals,
  sampleLineSegmentFrames,
  sampleCubicSegmentFrames,
  slicePathSegmentFrames,
  samplePathSegment,
  samplePathIntervalFramesNoWrap,
  samplePathIntervalFrames,
  dotVec2,
  addVec2,
  subtractVec2,
  scaleVec2,
  createUnitLeftNormal,
  intersectLines,
  createShiftedSegment,
  getJoinedOffsetPoint,
  offsetPolyline,
  offsetFrames,
  offsetFramesForStrokeCenterline,
  getStrokeCenterlineOffset,
  pointOnSegment,
  orientation,
  segmentsTouchOrIntersect,
  isSimplePolygon,
  getArcStepAngle,
  buildArcPoints,
  getArcSweep,
  chooseStrokeCapArcClockwise,
  getBoundaryCapDirection,
  buildStrokeCapArcPoints,
  buildStrokeStripPolygon,
  buildStrokeStripQuadPolygons,
  buildStrokeStripSpanPolygon,
  buildStrokeStripSpanPolygons,
  buildDecomposedStrokeOutlinePolygons,
  clipPolygonToHalfPlane,
  splitFramesAtSegmentSeams,
  buildOffsetBoundary,
  buildStrokeStartCapPolygon,
  buildStrokeEndCapPolygon,
  applySquareCapsToCenterline,
  applySquareCapsToFrames,
  buildSmoothOffsetBoundaryFromFrames,
  buildSmoothStrokeCapBoundarySource,
  subpathHasSharpJoin,
  buildOpenStrokeOutlinePolygonsFromFrames,
  buildOpenStrokeOutlinePolygonsFromCenterline,
  buildOpenStrokeOutlinePolygons,
  materializeDashCandidateRenderPolygons,
  materializeDashedGeometryPhase2Model,
  buildOverlapGraph,
  buildConflictComponents,
  buildAtomicRegionPreparationDiagnostics,
  buildAtomicRegions,
  buildDashSubpathGeometry,
  buildDashIntervals,
  usesStrokeDashGuidePath,
  measureFramePathLength,
  buildStrokeDashGuideFrames,
  sliceGuideFrames,
  buildStrokeDashIntervalAllocation,
  getTouchedSegmentIndices
}
