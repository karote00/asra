import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import { allocateStrokeIntervalsForDomainPlan } from './dashed-center-stroke-intervals'
import {
  ROUND_STROKE_CAP_ARC_SAMPLING,
  buildRoundStrokeArcPointsBetween,
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from './dashed-center-stroke-packets'
import {
  buildStrokeRuntimeRevisionSet,
  updateStrokeRuntimeRevisionSetFromMetadata
} from './stroke-dirty-keys'
import {
  getGeometryBackend,
  getGeometryBackendCacheSignature,
  type GeometryBackend,
  type PolygonRegion
} from './geometry-backend'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
  isPointInsideTopologyPolygon,
  type PathTopologyModel,
  type PathTopologyFamily
} from './path-topology-model'
import {
  buildPolylineGeometryModelPath,
  samplePathSegmentFramesByLengthStep,
  slicePathSegmentPoints,
  slicePathGeometryPoints,
  type PathSegment,
  type PathGeometry,
  type PathSampleFrame,
  type PathSliceSamplingOptions
} from './path-geometry'
import { resolveSourceFamily } from './resolved-source-family'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval,
  resolveSourceSpanProvenanceAvailability
} from './source-span-graph'
import type { StrokeOwnerKey } from './stroke-final-face'
import {
  resolveStrokeDomains,
  type StrokeDomainMode,
  type StrokeDomainPlan
} from './stroke-domain-plan'
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from './resolved-vector-geometry-model'

interface Vec2 {
  x: number
  y: number
}

interface SelectedSideGuardPoint extends Vec2 {
  sharp?: boolean
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ConstrainedDashedStrokeOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
    sourceNetworkIds?: string[]
    contourId?: string
    sourceContourIds?: string[]
    legalDomainId?: string | null
    legalDomainIds?: string[]
    sourceSpanIds?: string[]
    ownerSet?: StrokeOwnerKey[]
  }
  topology?: PathTopologyModel
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
    Partial<
      Pick<
        PathGeometry,
        | 'sampledPoints'
        | 'segmentDistanceRanges'
        | 'sampledSegmentPoints'
        | 'sampledSegmentDistances'
        | 'traceSampleTolerance'
        | 'traceSampleOptions'
      >
    >
  implicitFillRegions?: PolygonRegion[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
  sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  selectedSideGuardPoints?: SelectedSideGuardPoint[]
  clipInsideToFillDomain?: boolean
  includeSourceSpanDebugIds?: boolean
}

const EPSILON = 1e-6
const SOURCE_PATH_DASH_SLICE_TOLERANCE = 0.25
const SOURCE_PATH_DASH_SLICE_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 24,
  maxCubicSamples: 384,
  useRangeLengthForSampleCount: true
}
const SOURCE_PATH_RIBBON_FRAME_TOLERANCE = 0.25
const SOURCE_PATH_RIBBON_FRAME_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 24,
  maxCubicSamples: 384,
  useRangeLengthForSampleCount: true
}
const SOURCE_PATH_DASH_SEGMENT_OVERLAP_FACTOR = 0.04
const SOURCE_PATH_DASH_SEGMENT_OVERLAP_MAX = 0.6
const SOURCE_PATH_FINAL_RANGE_POLYGON_CACHE_LIMIT = 16384
const SOURCE_PATH_INTERVAL_LEVEL_POLYGON_CACHE_LIMIT = 32768
const SOURCE_SPAN_GRAPH_CACHE_LIMIT = 128
const SOURCE_VERTEX_BOUNDARY_JOIN_RECORD_CACHE_LIMIT = 1024
const CENTER_STROKE_DESCRIPTOR_PRODUCT_POLYGON_CACHE_LIMIT = 1024
const CONSTRAINED_DASHED_PACKET_STAGE_CACHE_LIMIT = 128
const INSIDE_AGGREGATE_DESCRIPTOR_PRODUCT_CACHE_LIMIT = 128

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= EPSILON) {
    return null
  }
  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

type DashedTopologyInterval = ReturnType<
  typeof allocateDashedIntervalsForTopology
>[number]

export type VisibleDashedTopologyInterval = DashedTopologyInterval & {
  kind: 'visible'
  domainPlanBoundaryDomainId?: string
  domainPlanBoundaryPoints?: Vec2[]
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanBoundaryTotalLength?: number
  domainPlanSplitRangeId?: string
  domainPlanSplitRangeStartDistance?: number
  domainPlanSplitRangeEndDistance?: number
  domainPlanTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  domainPlanSplitRangeSourceSegmentIndex?: number
  domainPlanSideAuthority?: 'implicit-fill-hole-domain'
  domainPlanSelectedSide?: 1 | -1
  domainPlanFilledSide?: 1 | -1
  domainPlanUnfilledSide?: 1 | -1
  domainPlanBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  domainPlanDomainMode?: StrokeDomainMode
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanSideResolutionReason?: string
  materializationDistanceSpace?: 'source-domain' | 'boundary-domain'
}

const shouldSuppressOpenPathStartCap = (
  path: Pick<PathGeometry, 'closed'>,
  interval: Pick<VisibleDashedTopologyInterval, 'openPathTerminalRole'>
) =>
  !path.closed &&
  (interval.openPathTerminalRole === 'path-start' ||
    interval.openPathTerminalRole === 'start-end')

const shouldSuppressOpenPathEndCap = (
  path: Pick<PathGeometry, 'closed'>,
  interval: Pick<VisibleDashedTopologyInterval, 'openPathTerminalRole'>
) =>
  !path.closed &&
  (interval.openPathTerminalRole === 'path-end' ||
    interval.openPathTerminalRole === 'start-end')

const hasConstrainedTerminalStart = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanTerminalRole'
  >
) =>
  (interval.domainPlanSplitRangeId !== undefined ||
    interval.domainPlanBoundaryDomainId !== undefined) &&
  (interval.domainPlanTerminalRole === 'start' ||
    interval.domainPlanTerminalRole === 'start-end')

const hasConstrainedTerminalEnd = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanTerminalRole'
  >
) =>
  (interval.domainPlanSplitRangeId !== undefined ||
    interval.domainPlanBoundaryDomainId !== undefined) &&
  (interval.domainPlanTerminalRole === 'end' ||
    interval.domainPlanTerminalRole === 'start-end')
const shouldSuppressDashedIntervalStartCap = (
  path: Pick<PathGeometry, 'closed'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanTerminalRole'
    | 'openPathTerminalRole'
  >
) =>
  shouldSuppressOpenPathStartCap(path, interval) ||
  hasConstrainedTerminalStart(interval)

const shouldSuppressDashedIntervalEndCap = (
  path: Pick<PathGeometry, 'closed'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanTerminalRole'
    | 'openPathTerminalRole'
  >
) =>
  shouldSuppressOpenPathEndCap(path, interval) ||
  hasConstrainedTerminalEnd(interval)

const isBoundaryDomainVisibleInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'domainPlanBoundaryDomainId' | 'domainPlanBoundaryPoints'
  >
) =>
  interval.domainPlanBoundaryDomainId !== undefined &&
  interval.domainPlanBoundaryPoints !== undefined &&
  interval.domainPlanBoundaryPoints.length >= 2

const isClosedConstrainedSourceCoverageInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'domainPlanSplitRangeId' | 'domainPlanBoundaryDomainId'
  >
) =>
  interval.domainPlanSplitRangeId?.startsWith(
    'closed-constrained-source-coverage-domain:'
  ) === true ||
  interval.domainPlanBoundaryDomainId?.startsWith(
    'closed-constrained-source-coverage-boundary:'
  ) === true

const isOpenDanglingOutsideBothSidesVisibleInterval = (
  interval: Pick<VisibleDashedTopologyInterval, 'domainPlanDomainMode'>
) => interval.domainPlanDomainMode === 'open-dangling-outside-both-sides'

const isNoVisibleProductDomainMode = (
  domainMode: StrokeDomainMode | null | undefined
) => domainMode === 'inside-excluded-open-span'

const getFormalProductDomainModeForInterval = (
  strokeDomainPlan: Pick<StrokeDomainPlan, 'domainMode' | 'intervalDomainKind'>,
  interval: Pick<VisibleDashedTopologyInterval, 'domainPlanDomainMode'>
): StrokeDomainMode | null => {
  const intervalDomainMode = interval.domainPlanDomainMode
  if (isNoVisibleProductDomainMode(intervalDomainMode)) {
    return null
  }
  if (intervalDomainMode !== undefined) {
    return intervalDomainMode
  }
  if (strokeDomainPlan.intervalDomainKind === 'domain-plan-split-range') {
    return null
  }

  const planDomainMode = strokeDomainPlan.domainMode
  return isNoVisibleProductDomainMode(planDomainMode) ? null : planDomainMode
}

const getFormalProductDomainModeForIntervals = (
  strokeDomainPlan: Pick<StrokeDomainPlan, 'domainMode' | 'intervalDomainKind'>,
  intervals: Pick<VisibleDashedTopologyInterval, 'domainPlanDomainMode'>[]
): StrokeDomainMode | null => {
  for (const interval of intervals) {
    const domainMode = getFormalProductDomainModeForInterval(
      strokeDomainPlan,
      interval
    )
    if (domainMode) {
      return domainMode
    }
  }
  return null
}

const groupVisibleIntervalsByFormalProductDomainMode = (
  strokeDomainPlan: Pick<StrokeDomainPlan, 'domainMode' | 'intervalDomainKind'>,
  intervals: VisibleDashedTopologyInterval[]
): VisibleDashedTopologyInterval[][] => {
  const groups = new Map<StrokeDomainMode, VisibleDashedTopologyInterval[]>()
  for (const interval of intervals) {
    const domainMode = getFormalProductDomainModeForInterval(
      strokeDomainPlan,
      interval
    )
    if (!domainMode) {
      continue
    }
    const group = groups.get(domainMode) ?? []
    group.push(interval)
    groups.set(domainMode, group)
  }
  return Array.from(groups.values())
}

const isBoundaryDomainProductVisibleInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanSplitRangeId'
  >
) =>
  isBoundaryDomainVisibleInterval(interval) &&
  !isClosedConstrainedSourceCoverageInterval(interval)

const isConstrainedBoundaryDomainProductInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanSplitRangeId'
    | 'domainPlanDomainMode'
  >
) =>
  isBoundaryDomainProductVisibleInterval(interval) &&
  !isOpenDanglingOutsideBothSidesVisibleInterval(interval)

const buildBoundaryDomainPathForIntervalUncached = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'domainPlanBoundaryPoints' | 'domainPlanBoundaryTotalLength'
  >
): PathGeometry | null => {
  const points = interval.domainPlanBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  const path = buildPolylineGeometryModelPath(points, false)
  if (path.totalLength <= EPSILON) {
    return null
  }

  if (
    interval.domainPlanBoundaryTotalLength !== undefined &&
    Math.abs(path.totalLength - interval.domainPlanBoundaryTotalLength) >
      Math.max(1, interval.domainPlanBoundaryTotalLength * 0.05)
  ) {
    return null
  }

  return path
}

const boundaryDomainPathCache = new WeakMap<
  Vec2[],
  {
    expectedTotalLength: number | undefined
    path: PathGeometry | null
  }
>()
const BOUNDARY_DOMAIN_PATH_CONTENT_CACHE_LIMIT = 16384
const boundaryDomainPathContentCache = new Map<string, PathGeometry | null>()

const buildBoundaryDomainPathForInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanBoundaryTotalLength'
  >
): PathGeometry | null => {
  const points = interval.domainPlanBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  const cached = boundaryDomainPathCache.get(points)
  if (
    cached &&
    cached.expectedTotalLength === interval.domainPlanBoundaryTotalLength
  ) {
    return cached.path
  }

  const contentCacheKey = getBoundaryDomainPathCacheKey(interval)
  if (contentCacheKey && boundaryDomainPathContentCache.has(contentCacheKey)) {
    emitStrokePipelineCounter('boundary-domain-path-content-cache-hit')
    const cachedPath =
      boundaryDomainPathContentCache.get(contentCacheKey) ?? null
    boundaryDomainPathCache.set(points, {
      expectedTotalLength: interval.domainPlanBoundaryTotalLength,
      path: cachedPath
    })
    return cachedPath
  }

  const path = buildBoundaryDomainPathForIntervalUncached(interval)
  boundaryDomainPathCache.set(points, {
    expectedTotalLength: interval.domainPlanBoundaryTotalLength,
    path
  })
  if (contentCacheKey) {
    emitStrokePipelineCounter('boundary-domain-path-content-cache-miss')
    boundaryDomainPathContentCache.set(contentCacheKey, path)
    if (
      boundaryDomainPathContentCache.size >
      BOUNDARY_DOMAIN_PATH_CONTENT_CACHE_LIMIT
    ) {
      const [oldestKey] = boundaryDomainPathContentCache.keys()
      if (oldestKey) {
        boundaryDomainPathContentCache.delete(oldestKey)
      }
    }
  }
  return path
}

const getBoundaryDomainPathCacheKey = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanBoundaryTotalLength'
  >
) => {
  if (
    !interval.domainPlanBoundaryDomainId ||
    !interval.domainPlanBoundaryPoints ||
    interval.domainPlanBoundaryPoints.length < 2
  ) {
    return null
  }

  const pointSignature = interval.domainPlanBoundaryPoints
    .map(
      (point) =>
        `${Number.isFinite(point.x) ? point.x.toFixed(3) : 'nan'},${
          Number.isFinite(point.y) ? point.y.toFixed(3) : 'nan'
        }`
    )
    .join(';')

  return [
    interval.domainPlanBoundaryDomainId,
    interval.domainPlanBoundaryPoints.length,
    interval.domainPlanBoundaryTotalLength?.toFixed(6) ?? 'unknown',
    pointSignature
  ].join('|')
}

const formatBoundaryDomainFrameMetric = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? 'none' : value.toFixed(6)

const formatBoundaryDomainFramePoint = (point: Vec2 | undefined) =>
  point
    ? `${Number.isFinite(point.x) ? point.x.toFixed(3) : 'nan'},${
        Number.isFinite(point.y) ? point.y.toFixed(3) : 'nan'
      }`
    : 'none'

const buildBoundaryDomainPointsTranslationSignature = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'domainPlanBoundaryPoints' | 'domainPlanBoundaryTotalLength'
  >,
  origin: Vec2
) => {
  const points = interval.domainPlanBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  return [
    points.length,
    formatBoundaryDomainFrameMetric(interval.domainPlanBoundaryTotalLength),
    points
      .map(
        (point) =>
          `${formatTranslationInvariantCacheNumber(
            point.x - origin.x
          )},${formatTranslationInvariantCacheNumber(point.y - origin.y)}`
      )
      .join(';')
  ].join('|')
}

const getBoundaryDomainPathFrameCacheKey = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanBoundaryTotalLength'
    | 'domainPlanBoundaryRole'
    | 'domainPlanDomainMode'
  >
) => {
  const points = interval.domainPlanBoundaryPoints
  if (!interval.domainPlanBoundaryDomainId || !points || points.length < 2) {
    return null
  }

  const middlePoint = points[Math.floor(points.length / 2)]
  const lastPoint = points[points.length - 1]

  return [
    interval.domainPlanBoundaryDomainId,
    points.length,
    formatBoundaryDomainFrameMetric(interval.domainPlanBoundaryTotalLength),
    interval.domainPlanBoundaryRole ?? 'boundary-role',
    interval.domainPlanDomainMode ?? 'domain-mode',
    formatBoundaryDomainFramePoint(points[0]),
    formatBoundaryDomainFramePoint(middlePoint),
    formatBoundaryDomainFramePoint(lastPoint)
  ].join('|')
}

const hasBoundaryDomainDistanceMapping = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryStartDistance'
    | 'domainPlanBoundaryEndDistance'
    | 'domainPlanBoundaryTotalLength'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
  >
) =>
  interval.domainPlanBoundaryStartDistance !== undefined &&
  interval.domainPlanBoundaryEndDistance !== undefined &&
  interval.domainPlanBoundaryTotalLength !== undefined &&
  interval.domainPlanSplitRangeStartDistance !== undefined &&
  interval.domainPlanSplitRangeEndDistance !== undefined

const getVisibleIntervalLength = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) =>
  interval.wrapsSeam
    ? totalLength - interval.startDistance + interval.endDistance
    : interval.endDistance - interval.startDistance

type ConstrainedDashedPhysicalSpanRole = 'core'

interface ConstrainedDashedPhysicalSpan {
  spanId: string
  role: ConstrainedDashedPhysicalSpanRole
  startDistance: number
  endDistance: number
  wrapsSeam: boolean
  intervalLength: number
}

interface DashEndpointCapPolicy {
  terminalRole: 'middle' | 'start' | 'end' | 'start-end'
  suppressStartCap: boolean
  suppressEndCap: boolean
  startCap: boolean
  endCap: boolean
  signature: string
}
type DashEndpointCapPolicyInterval = Pick<
  VisibleDashedTopologyInterval,
  | 'domainPlanBoundaryDomainId'
  | 'domainPlanSplitRangeId'
  | 'domainPlanTerminalRole'
  | 'openPathTerminalRole'
>

const getDashEndpointCapPolicy = (
  path: Pick<PathGeometry, 'closed'>,
  interval: DashEndpointCapPolicyInterval
): DashEndpointCapPolicy => {
  const suppressStartCap = shouldSuppressDashedIntervalStartCap(path, interval)
  const suppressEndCap = shouldSuppressDashedIntervalEndCap(path, interval)
  const startCap = !suppressStartCap
  const endCap = !suppressEndCap
  const terminalRole =
    suppressStartCap && suppressEndCap
      ? 'start-end'
      : suppressStartCap
        ? 'start'
        : suppressEndCap
          ? 'end'
          : 'middle'
  return {
    terminalRole,
    suppressStartCap,
    suppressEndCap,
    startCap,
    endCap,
    signature: `${terminalRole}:${startCap ? 'start-cap' : 'start-flat'}:${
      endCap ? 'end-cap' : 'end-flat'
    }`
  }
}

const getEffectiveRangeEndpointCapPolicy = (
  path: Pick<PathGeometry, 'totalLength'>,
  range: SourceSegmentIntervalRange,
  span: ConstrainedDashedPhysicalSpan,
  endpointCapPolicy: DashEndpointCapPolicy
): DashEndpointCapPolicy => {
  const rangeOwnsStart = isSourcePathRangeAtPhysicalSpanStart(
    range,
    span,
    path.totalLength
  )
  const rangeOwnsEnd = isSourcePathRangeAtPhysicalSpanEnd(
    range,
    span,
    path.totalLength
  )
  const suppressStartCap = endpointCapPolicy.suppressStartCap && rangeOwnsStart
  const suppressEndCap = endpointCapPolicy.suppressEndCap && rangeOwnsEnd
  const startCap = endpointCapPolicy.startCap && rangeOwnsStart
  const endCap = endpointCapPolicy.endCap && rangeOwnsEnd
  const terminalRole =
    suppressStartCap && suppressEndCap
      ? 'start-end'
      : suppressStartCap
        ? 'start'
        : suppressEndCap
          ? 'end'
          : 'middle'

  return {
    terminalRole,
    suppressStartCap,
    suppressEndCap,
    startCap,
    endCap,
    signature: `${terminalRole}:${startCap ? 'start-cap' : 'start-flat'}:${
      endCap ? 'end-cap' : 'end-flat'
    }`
  }
}

const getIntervalPhysicalSpans = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'>,
  interval: VisibleDashedTopologyInterval
): ConstrainedDashedPhysicalSpan[] => {
  const intervalLength = getVisibleIntervalLength(
    interval,
    topology.totalLength
  )
  if (intervalLength <= EPSILON) {
    return []
  }

  return [
    {
      spanId: interval.intervalId,
      role: 'core',
      startDistance: interval.startDistance,
      endDistance: interval.endDistance,
      wrapsSeam: interval.wrapsSeam,
      intervalLength
    }
  ]
}

type BoundaryDomainMaterializationInterval = Pick<
  VisibleDashedTopologyInterval,
  | 'startDistance'
  | 'endDistance'
  | 'wrapsSeam'
  | 'domainPlanSplitRangeId'
  | 'domainPlanBoundaryDomainId'
  | 'domainPlanBoundaryPoints'
  | 'domainPlanBoundaryStartDistance'
  | 'domainPlanBoundaryEndDistance'
  | 'domainPlanBoundaryTotalLength'
  | 'domainPlanSplitRangeStartDistance'
  | 'domainPlanSplitRangeEndDistance'
  | 'domainPlanSelectedSide'
> & {
  materializationDistanceSpace?: 'source-domain' | 'boundary-domain'
}

const getBoundaryDomainMaterializedSelectedSide = <
  T extends BoundaryDomainMaterializationInterval
>(
  interval: T
): 1 | -1 | undefined => {
  if (
    interval.domainPlanSelectedSide !== 1 &&
    interval.domainPlanSelectedSide !== -1
  ) {
    return undefined
  }
  if (isClosedConstrainedSourceCoverageInterval(interval)) {
    return interval.domainPlanSelectedSide
  }
  if (
    interval.domainPlanBoundaryStartDistance === undefined ||
    interval.domainPlanBoundaryEndDistance === undefined ||
    interval.domainPlanSplitRangeStartDistance === undefined ||
    interval.domainPlanSplitRangeEndDistance === undefined
  ) {
    return interval.domainPlanSelectedSide
  }

  const sourceDirection =
    interval.domainPlanSplitRangeEndDistance -
    interval.domainPlanSplitRangeStartDistance
  const boundaryDirection =
    interval.domainPlanBoundaryEndDistance -
    interval.domainPlanBoundaryStartDistance
  if (
    Math.abs(sourceDirection) <= EPSILON ||
    Math.abs(boundaryDirection) <= EPSILON
  ) {
    return interval.domainPlanSelectedSide
  }

  return sourceDirection * boundaryDirection < 0
    ? (-interval.domainPlanSelectedSide as 1 | -1)
    : interval.domainPlanSelectedSide
}

const resolveBoundaryDomainIntervalForMaterialization = <
  T extends BoundaryDomainMaterializationInterval
>(
  interval: T
): T => {
  if (interval.materializationDistanceSpace === 'boundary-domain') {
    return interval
  }
  if (
    interval.domainPlanBoundaryStartDistance === undefined ||
    interval.domainPlanBoundaryEndDistance === undefined ||
    interval.domainPlanBoundaryTotalLength === undefined ||
    interval.domainPlanSplitRangeStartDistance === undefined ||
    interval.domainPlanSplitRangeEndDistance === undefined
  ) {
    return interval
  }

  const sourceStart = interval.domainPlanSplitRangeStartDistance
  const sourceEnd = interval.domainPlanSplitRangeEndDistance
  const sourceLength = sourceEnd - sourceStart
  const boundaryStart = interval.domainPlanBoundaryStartDistance
  const boundaryEnd = interval.domainPlanBoundaryEndDistance
  const boundaryLength = boundaryEnd - boundaryStart
  if (
    Math.abs(sourceLength) <= EPSILON ||
    Math.abs(boundaryLength) <= EPSILON ||
    interval.wrapsSeam
  ) {
    return interval
  }

  const mapDistance = (distance: number) => {
    const ratio = (distance - sourceStart) / sourceLength
    return boundaryStart + boundaryLength * ratio
  }
  const mappedStartDistance = mapDistance(interval.startDistance)
  const mappedEndDistance = mapDistance(interval.endDistance)
  const startDistance = Math.min(mappedStartDistance, mappedEndDistance)
  const endDistance = Math.max(mappedStartDistance, mappedEndDistance)
  const clampedStartDistance = Math.max(
    0,
    Math.min(interval.domainPlanBoundaryTotalLength, startDistance)
  )
  const clampedEndDistance = Math.max(
    0,
    Math.min(interval.domainPlanBoundaryTotalLength, endDistance)
  )
  if (clampedEndDistance <= clampedStartDistance + EPSILON) {
    return interval
  }

  return {
    ...interval,
    startDistance: clampedStartDistance,
    endDistance: clampedEndDistance,
    intervalLength: clampedEndDistance - clampedStartDistance,
    wrapsSeam: false,
    materializationDistanceSpace: 'boundary-domain'
  }
}

export const getConstrainedDashedVisibleIntervals = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'> &
    Partial<Pick<PathTopologyModel, 'topologyFamily'>>,
  stroke: Pick<
    RenderableStroke,
    'cap' | 'dashPattern' | 'dashOffset' | 'width'
  >,
  sourcePath?:
    | (Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
        Partial<
          Pick<
            PathGeometry,
            | 'sampledPoints'
            | 'segmentDistanceRanges'
            | 'sampledSegmentPoints'
            | 'sampledSegmentDistances'
            | 'traceSampleTolerance'
            | 'traceSampleOptions'
          >
        >)
    | undefined,
  strokeDomainPlan?: Pick<
    StrokeDomainPlan,
    | 'planId'
    | 'intervalDomainKind'
    | 'totalLength'
    | 'closed'
    | 'splitRangeDomains'
    | 'legalBoundaryDomains'
    | 'sideResolutionContext'
  >
): VisibleDashedTopologyInterval[] => {
  if (
    !topology.closed &&
    (strokeDomainPlan?.intervalDomainKind !== 'domain-plan-split-range' ||
      strokeDomainPlan.splitRangeDomains.length === 0)
  ) {
    return allocateDashedIntervalsForTopology(
      topology,
      stroke.dashPattern,
      stroke.dashOffset,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: stroke.width,
        cap: stroke.cap
      }
    ).filter(
      (interval): interval is VisibleDashedTopologyInterval =>
        interval.kind === 'visible'
    )
  }

  if (
    strokeDomainPlan?.intervalDomainKind === 'domain-plan-split-range' &&
    strokeDomainPlan.splitRangeDomains.length > 0
  ) {
    let visibleIntervalIndex = 0
    return allocateStrokeIntervalsForDomainPlan({
      domainPlan: strokeDomainPlan,
      dashPattern: stroke.dashPattern,
      dashOffset: stroke.dashOffset,
      visualGap:
        stroke.cap === 'butt'
          ? undefined
          : {
              capExtension: stroke.width
            }
    }).flatMap((allocation) => {
      const visibleIntervals = allocation.intervals.filter(
        (interval): interval is VisibleDashedTopologyInterval =>
          interval.kind === 'visible'
      )

      return visibleIntervals.map((interval) => {
        const intervalId = `interval:${visibleIntervalIndex}`
        visibleIntervalIndex += 1
        const resolvedInterval = {
          ...interval,
          intervalId,
          previousVisibleIntervalId: null,
          nextVisibleIntervalId: null
        }
        return resolvedInterval
      })
    })
  }

  const authoredIntervals = allocateDashedIntervalsForTopology(
    topology,
    stroke.dashPattern,
    stroke.dashOffset
  ).filter(
    (interval): interval is VisibleDashedTopologyInterval =>
      interval.kind === 'visible'
  )

  return authoredIntervals
}

const formatStableIntervalSignatureNumber = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? 'none' : value.toFixed(6)

const buildStableVisibleIntervalDecisionSignature = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'domainPlanBoundaryStartDistance'
    | 'domainPlanBoundaryEndDistance'
    | 'domainPlanBoundaryTotalLength'
    | 'domainPlanTerminalRole'
    | 'domainPlanSplitRangeSourceSegmentIndex'
    | 'domainPlanSideAuthority'
    | 'domainPlanSelectedSide'
    | 'domainPlanFilledSide'
    | 'domainPlanUnfilledSide'
    | 'domainPlanBoundaryRole'
    | 'domainPlanDomainMode'
    | 'domainPlanSideResolutionStatus'
    | 'domainPlanSideResolutionReason'
    | 'materializationDistanceSpace'
  >
) =>
  [
    interval.domainPlanDomainMode ?? 'no-domain-mode',
    interval.domainPlanTerminalRole ?? 'no-terminal-role',
    interval.domainPlanSideAuthority ?? 'no-side-authority',
    interval.domainPlanSelectedSide ?? 'no-selected-side',
    interval.domainPlanFilledSide ?? 'no-filled-side',
    interval.domainPlanUnfilledSide ?? 'no-unfilled-side',
    interval.domainPlanBoundaryRole ?? 'no-boundary-role',
    interval.domainPlanSideResolutionStatus ?? 'no-side-status',
    interval.domainPlanSideResolutionReason ?? 'no-side-reason',
    interval.domainPlanSplitRangeSourceSegmentIndex ?? 'no-source-segment',
    formatStableIntervalSignatureNumber(
      interval.domainPlanSplitRangeStartDistance
    ),
    formatStableIntervalSignatureNumber(
      interval.domainPlanSplitRangeEndDistance
    ),
    formatStableIntervalSignatureNumber(
      interval.domainPlanBoundaryStartDistance
    ),
    formatStableIntervalSignatureNumber(interval.domainPlanBoundaryEndDistance),
    formatStableIntervalSignatureNumber(interval.domainPlanBoundaryTotalLength),
    interval.materializationDistanceSpace ?? 'source-domain'
  ].join(':')

const buildVisibleIntervalSignature = (
  intervals: readonly VisibleDashedTopologyInterval[]
) =>
  intervals
    .map((interval, index) =>
      [
        interval.kind,
        index,
        interval.authoredIndex,
        interval.startDistance.toFixed(6),
        interval.endDistance.toFixed(6),
        interval.wrapsSeam ? 'wrap' : 'nowrap',
        interval.previousVisibleIntervalId !== null ? 'has-prev' : 'no-prev',
        interval.nextVisibleIntervalId !== null ? 'has-next' : 'no-next',
        buildStableVisibleIntervalDecisionSignature(interval)
      ].join(':')
    )
    .join('|')

const buildSourceSpanGraphCacheKey = (
  topology: PathTopologyModel,
  intervalSignature: string
) =>
  [
    topology.pathId,
    topology.sourceId,
    topology.networkId,
    topology.revision,
    topology.sourceRevision,
    topology.closed ? 'closed' : 'open',
    topology.topologyFamily,
    formatTranslationInvariantCacheNumber(topology.totalLength),
    intervalSignature
  ].join('|')

const getCachedSourceSpanGraph = (
  cacheKey: string
): ReturnType<typeof buildSourceSpanGraph> | null => {
  const cached = sourceSpanGraphStageCache.get(cacheKey)
  if (!cached) {
    return null
  }

  sourceSpanGraphStageCache.delete(cacheKey)
  sourceSpanGraphStageCache.set(cacheKey, cached)
  emitStrokePipelineCounter('source-span-graph-cache-hit')
  return cached
}

const setCachedSourceSpanGraph = (
  cacheKey: string,
  graph: ReturnType<typeof buildSourceSpanGraph>
) => {
  emitStrokePipelineCounter('source-span-graph-cache-miss')
  sourceSpanGraphStageCache.set(cacheKey, graph)
  if (sourceSpanGraphStageCache.size > SOURCE_SPAN_GRAPH_CACHE_LIMIT) {
    const [oldestKey] = sourceSpanGraphStageCache.keys()
    if (oldestKey) {
      sourceSpanGraphStageCache.delete(oldestKey)
    }
  }
}

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

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

  return { minX, minY, maxX, maxY }
}

const boundsOverlapWithArea = (a: Bounds, b: Bounds) =>
  a.minX < b.maxX - EPSILON &&
  a.maxX > b.minX + EPSILON &&
  a.minY < b.maxY - EPSILON &&
  a.maxY > b.minY + EPSILON

const boundsMayIntersect = (a: Bounds, b: Bounds, tolerance = EPSILON) =>
  a.minX <= b.maxX + tolerance &&
  a.maxX >= b.minX - tolerance &&
  a.minY <= b.maxY + tolerance &&
  a.maxY >= b.minY - tolerance

const polygonsHaveOverlappingBounds = (polygons: Vec2[][]) => {
  if (polygons.length <= 1) {
    return false
  }

  const bounds = polygons
    .map((polygon) => getBounds([polygon]))
    .sort((a, b) => a.minX - b.minX)
  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    const left = bounds[leftIndex]
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bounds.length;
      rightIndex += 1
    ) {
      const right = bounds[rightIndex]
      if (right.minX >= left.maxX - EPSILON) {
        break
      }
      if (boundsOverlapWithArea(left, right)) {
        return true
      }
    }
  }

  return false
}

export const supportsConstrainedDashedStroke = (
  stroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  _closed: boolean
) =>
  stroke.style === 'dashed' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  stroke.dashPattern.length > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

export const hasConstrainedDashedStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  getRenderableStrokes(strokes).some(
    (stroke) =>
      stroke.style === 'dashed' &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      stroke.width > 0 &&
      stroke.dashPattern.length > 0
  ) === true

const getClosedSegmentRanges = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return []
  }

  const segments = []
  let cursor = 0

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    const startDistance = cursor
    const endDistance = cursor + length
    cursor = endDistance
    segments.push({
      index,
      startDistance,
      endDistance
    })
  }

  return segments
}

const getCanonicalClosedLoopPoints = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) <= EPSILON &&
    Math.abs(first.y - last.y) <= EPSILON
  ) {
    return points.slice(0, -1)
  }

  return points
}

const getIntervalStrokeForSourceDirection = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke,
  topologyFamily?: PathTopologyFamily
): Pick<
  RenderableStroke,
  'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
> => {
  if (!closed || topologyFamily === 'self-intersecting') {
    return {
      ...stroke,
      style: 'solid'
    }
  }

  const loopArea = polygonArea(getCanonicalClosedLoopPoints(points, closed))
  const position =
    loopArea >= 0
      ? stroke.position
      : stroke.position === 'inside'
        ? 'outside'
        : 'inside'

  return {
    ...stroke,
    style: 'solid',
    position
  }
}

const getIntervalStrokeForProductDomainMode = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke,
  topologyFamily: PathTopologyFamily | undefined,
  domainMode: StrokeDomainMode
): Pick<
  RenderableStroke,
  'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
> => {
  const intervalStroke = getIntervalStrokeForSourceDirection(
    points,
    closed,
    stroke,
    topologyFamily
  )

  return domainMode === 'center-product'
    ? {
        ...intervalStroke,
        position: 'center'
      }
    : intervalStroke
}

const getRawStrokeForRenderableIndex = (
  strokes: StrokeAttrs[] | undefined,
  renderableIndex: number
): StrokeAttrs | null => {
  if (!Array.isArray(strokes)) {
    return null
  }

  let currentRenderableIndex = 0
  for (const stroke of strokes) {
    if (getRenderableStrokes([stroke]).length === 0) {
      continue
    }

    if (currentRenderableIndex === renderableIndex) {
      return stroke
    }

    currentRenderableIndex += 1
  }

  return null
}

const normalizePoint = (point: Vec2): Vec2 => ({
  x: Math.abs(point.x) <= EPSILON ? 0 : point.x,
  y: Math.abs(point.y) <= EPSILON ? 0 : point.y
})

interface ClipEdge {
  start: Vec2
  end: Vec2
  dx: number
  dy: number
}

interface ClosedIntervalLegalityContext {
  orientation: number
  clipEdges: ClipEdge[]
}

const buildClipEdges = (boundary: Vec2[]): ClipEdge[] =>
  boundary.map((start, index) => {
    const end = boundary[(index + 1) % boundary.length]
    return {
      start,
      end,
      dx: end.x - start.x,
      dy: end.y - start.y
    }
  })

const isInsideHalfPlane = (
  point: Vec2,
  edge: ClipEdge,
  orientation: number
) => {
  const cross =
    edge.dx * (point.y - edge.start.y) - edge.dy * (point.x - edge.start.x)
  return orientation > 0 ? cross >= -EPSILON : cross <= EPSILON
}

const lineIntersection = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2
): Vec2 => {
  const x1 = segmentStart.x
  const y1 = segmentStart.y
  const x2 = segmentEnd.x
  const y2 = segmentEnd.y
  const x3 = edgeStart.x
  const y3 = edgeStart.y
  const x4 = edgeEnd.x
  const y4 = edgeEnd.y

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denominator) <= EPSILON) {
    return normalizePoint(segmentEnd)
  }

  const determinant1 = x1 * y2 - y1 * x2
  const determinant2 = x3 * y4 - y3 * x4

  return normalizePoint({
    x: (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator,
    y: (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator
  })
}

const clipPolygonToClosedLegalDomain = (
  polygon: Vec2[],
  boundary: ClipEdge[],
  orientation: number
) => {
  let output = polygon.map(normalizePoint)

  for (const edge of boundary) {
    const input = output
    output = []
    if (input.length === 0) {
      break
    }

    input.forEach((current, currentIndex) => {
      const previous = input[(currentIndex - 1 + input.length) % input.length]
      const currentInside = isInsideHalfPlane(current, edge, orientation)
      const previousInside = isInsideHalfPlane(previous, edge, orientation)

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, edge.start, edge.end))
        }
        output.push(current)
        return
      }

      if (previousInside) {
        output.push(lineIntersection(previous, current, edge.start, edge.end))
      }
    })
  }

  return output
}

const applyClosedIntervalLegality = (
  polygons: Vec2[][],
  context: ClosedIntervalLegalityContext | null
) => {
  if (!context) {
    return polygons
  }
  if (context.clipEdges.length === 0) {
    return []
  }

  return polygons
    .map((polygon) =>
      clipPolygonToClosedLegalDomain(
        polygon,
        context.clipEdges,
        context.orientation
      )
    )
    .filter((polygon) => polygon.length >= 3)
}

const isConvexClosedBoundary = (points: Vec2[], closed: boolean) => {
  const boundary = getCanonicalClosedLoopPoints(points, closed)
  if (boundary.length < 3 || Math.abs(polygonArea(boundary)) <= EPSILON) {
    return false
  }

  let sign = 0
  for (let index = 0; index < boundary.length; index += 1) {
    const previous = boundary[index]
    const current = boundary[(index + 1) % boundary.length]
    const next = boundary[(index + 2) % boundary.length]
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x)
    if (Math.abs(cross) <= EPSILON) {
      continue
    }
    const currentSign = cross > 0 ? 1 : -1
    if (sign === 0) {
      sign = currentSign
      continue
    }
    if (sign !== currentSign) {
      return false
    }
  }

  return true
}

const buildClosedIntervalLegalityContext = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): ClosedIntervalLegalityContext | null => {
  if (!closed || stroke.position !== 'inside') {
    return null
  }

  const boundary = getCanonicalClosedLoopPoints(points, closed)
  const orientationArea = polygonArea(boundary)
  if (boundary.length < 3 || Math.abs(orientationArea) <= EPSILON) {
    return {
      orientation: 1,
      clipEdges: []
    }
  }

  return {
    orientation: orientationArea > 0 ? 1 : -1,
    clipEdges: buildClipEdges(boundary)
  }
}

const normalizeDistanceOnLoop = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

interface SourcePathSegmentRange {
  index: number
  startDistance: number
  endDistance: number
}

interface SourceSegmentIntervalRange {
  startDistance: number
  endDistance: number
  segmentIndex: number
}

interface DashedSourcePathIntervalSweepRange {
  range: SourceSegmentIntervalRange
  span: ConstrainedDashedPhysicalSpan
  renderRange: SourceSegmentIntervalRange
  endpointCapPolicy: DashEndpointCapPolicy
  rangeEndpointCapPolicy: DashEndpointCapPolicy
}

interface SmoothContinuityGroup {
  groupId: string
  intervalId: string
  startDistance: number
  endDistance: number
  wrapsSeam: boolean
}

interface DashedSourcePathIntervalSweep {
  ranges: DashedSourcePathIntervalSweepRange[]
  endpointCapPolicy: DashEndpointCapPolicy
  smoothContinuityGroup: SmoothContinuityGroup
}

interface SourcePathSegmentSample {
  points: Vec2[]
  cumulativeDistances: number[]
  polylineLength: number
}

interface ExactSourcePathRibbonSegmentFrame {
  segmentIndex: number
  segmentLength: number
  frames: PathSampleFrame[]
  distances: number[]
}

interface OffsetPathSampleFrame extends PathSampleFrame {
  offsetPoint: Vec2
}

interface ExactSourcePathOffsetRibbonSegmentFrame {
  segmentIndex: number
  segmentLength: number
  frames: OffsetPathSampleFrame[]
  distances: number[]
}

const sourcePathFinalRangePolygonCache = new Map<string, Vec2[][]>()
const sourcePathIntervalLevelPolygonCache = new Map<
  string,
  {
    origin: Vec2
    polygons: Vec2[][]
  }
>()
const constrainedDashedJoinIndependentIntervalProductCache = new Map<
  string,
  {
    origin: Vec2
    polygons: Vec2[][]
  }
>()
const constrainedDashedIntervalCoverageBodyCache = new Map<
  string,
  {
    origin: Vec2
    polygons: Vec2[][]
    intervalSweep: DashedSourcePathIntervalSweep
    intervalSweepSpanCount: number
    terminalCapCount: number
    intervalEndpointCapPolicy: DashedSourcePathIntervalSweep['endpointCapPolicy']
    intervalSmoothContinuityGroup: DashedSourcePathIntervalSweep['smoothContinuityGroup']
    intervalHasCurvedSourcePathSweepRange: boolean
    intervalHasSmoothContinuityAcrossSweepRanges: boolean
  }
>()
const centerStrokeDescriptorProductPolygonCache = new Map<
  string,
  {
    origin: Vec2
    polygons?: Vec2[][]
    absolutePolygons: Vec2[][]
  }
>()
const insideAggregateDescriptorProductCache = new Map<
  string,
  {
    origin: Vec2
    polygons?: Vec2[][]
    strokePaths?: Vec2[][]
    absolutePolygons: Vec2[][]
    absoluteStrokePaths: Vec2[][]
    bounds: Bounds
    productArea: number
    renderDescriptor: SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor']
  }
>()
const constrainedDashedJoinIndependentPacketStageCache = new Map<
  string,
  {
    origin: Vec2
    packets: SolidCenterStrokeResolvedPacket[]
  }
>()
const constrainedDashedPacketStageCache = new Map<
  string,
  {
    origin: Vec2
    packets: SolidCenterStrokeResolvedPacket[]
  }
>()
const sourceSpanGraphStageCache = new Map<
  string,
  ReturnType<typeof buildSourceSpanGraph>
>()

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

const emitStrokePipelineTrace = (
  eventName: string,
  payload: Record<string, unknown>
) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineTraceSink?: (
        eventName: string,
        payload: Record<string, unknown>
      ) => void
    }
  ).__asyraStrokePipelineTraceSink?.(eventName, payload)
}

const measureStrokePipelinePhase = <T>(phaseName: string, run: () => T): T => {
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
interface SourcePathSlicingContext {
  segmentRanges: SourcePathSegmentRange[]
  segmentSamples: Map<number, SourcePathSegmentSample>
  exactRibbonSegmentFrames: Map<number, ExactSourcePathRibbonSegmentFrame>
  offsetRibbonSegmentFrames: Map<
    string,
    ExactSourcePathOffsetRibbonSegmentFrame
  >
  splitRangeCache: Map<string, SourceSegmentIntervalRange[]>
  pointSliceCache: Map<string, Vec2[]>
  intervalStrokePathCache: Map<string, Vec2[]>
  exactLineRibbonRangeCache: Map<string, PathSampleFrame[]>
  exactOffsetLineRibbonRangeCache: Map<string, OffsetPathSampleFrame[]>
  exactLineRibbonRangeDirectCounterEmitted: boolean
  ribbonPolygonCache: Map<string, Vec2[][] | null>
  segmentBoundaryCache: Map<number, Vec2[]>
  segmentBoundaryClipCache: Map<string, SourceSegmentBoundaryClipData>
  isLineOnlyPath: boolean
  samplingTolerance: number
  samplingOptions: PathSliceSamplingOptions
  roundCapVisualMaxLength: number
}

interface SourceSegmentBoundaryClipData {
  boundary: Vec2[]
  head: Vec2[]
  tail: Vec2[]
  headReference: Vec2 | undefined
  tailReference: Vec2 | undefined
}

const getSourcePathSegmentRanges = (
  path: Pick<PathGeometry, 'segments'> &
    Partial<Pick<PathGeometry, 'segmentDistanceRanges'>>
) => {
  if (path.segmentDistanceRanges?.length === path.segments.length) {
    return path.segmentDistanceRanges
  }

  let cursor = 0
  return path.segments.map((segment, index) => {
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const formatSourcePathRangeKeyDistance = (distance: number) =>
  distance.toFixed(6)

const buildSourcePathSplitCacheKey = (
  startDistance: number,
  endDistance: number,
  wrapsSeam = false
) =>
  `${wrapsSeam ? 'wrap' : 'range'}:${formatSourcePathRangeKeyDistance(
    startDistance
  )}:${formatSourcePathRangeKeyDistance(endDistance)}`

const buildSourcePathSliceCacheKey = (
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole
) =>
  `${range.segmentIndex}:${role}:${formatSourcePathRangeKeyDistance(
    range.startDistance
  )}:${formatSourcePathRangeKeyDistance(range.endDistance)}`

const buildSourcePathSegmentSample = (
  path: Pick<
    PathGeometry,
    | 'segments'
    | 'closed'
    | 'totalLength'
    | 'sampledSegmentPoints'
    | 'sampledSegmentDistances'
    | 'traceSampleTolerance'
    | 'traceSampleOptions'
  >,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): SourcePathSegmentSample => {
  const segment = path.segments[range.index]
  const canUsePathSegmentSamples =
    path.traceSampleTolerance === samplingTolerance &&
    path.traceSampleOptions?.minCubicSamples ===
      samplingOptions.minCubicSamples &&
    path.traceSampleOptions?.maxCubicSamples ===
      samplingOptions.maxCubicSamples &&
    path.traceSampleOptions?.useRangeLengthForSampleCount ===
      samplingOptions.useRangeLengthForSampleCount
  const sampledSegmentPoints = canUsePathSegmentSamples
    ? path.sampledSegmentPoints?.[range.index]
    : undefined
  const sampledSegmentDistances = canUsePathSegmentSamples
    ? path.sampledSegmentDistances?.[range.index]
    : undefined
  const points =
    sampledSegmentPoints && sampledSegmentPoints.length > 0
      ? sampledSegmentPoints
      : segment
        ? slicePathGeometryPoints(
            {
              segments: [segment],
              closed: false,
              totalLength: segment.length
            },
            0,
            segment.length,
            false,
            samplingTolerance,
            samplingOptions
          )
        : []
  const normalizedPoints =
    points.length >= 2 ? points : segment ? [segment.start, segment.end] : []
  const cumulativeDistances =
    sampledSegmentDistances &&
    sampledSegmentDistances.length === normalizedPoints.length
      ? sampledSegmentDistances
      : (() => {
          const distances = [0]
          for (let index = 1; index < normalizedPoints.length; index += 1) {
            distances.push(
              distances[distances.length - 1] +
                distanceBetween(
                  normalizedPoints[index - 1],
                  normalizedPoints[index]
                )
            )
          }
          return distances
        })()

  return {
    points: normalizedPoints,
    cumulativeDistances,
    polylineLength: cumulativeDistances[cumulativeDistances.length - 1] ?? 0
  }
}

const formatRibbonFrameKeyPoint = (point: Vec2) =>
  `${point.x.toFixed(4)},${point.y.toFixed(4)}`

const ribbonFrameCacheKeysBySegment = new WeakMap<
  PathGeometry['segments'][number],
  Map<string, string>
>()

const buildExactSourcePathRibbonSegmentFrameCacheKey = (
  segment: PathGeometry['segments'][number],
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) => {
  const samplingKey = [
    samplingTolerance.toFixed(4),
    samplingOptions.minCubicSamples ?? 'default-min',
    samplingOptions.maxCubicSamples ?? 'default-max',
    samplingOptions.useRangeLengthForSampleCount === true ? 'range' : 'curve'
  ].join('|')
  const cachedBySampling = ribbonFrameCacheKeysBySegment.get(segment)
  const cached = cachedBySampling?.get(samplingKey)
  if (cached) {
    return cached
  }

  const segmentRevisionKey =
    segment.revisionKey ??
    (segment.type === 'line'
      ? [
          'line',
          formatRibbonFrameKeyPoint(segment.start),
          formatRibbonFrameKeyPoint(segment.end),
          segment.length.toFixed(4),
          segment.startAnchorType ?? 'none',
          segment.endAnchorType ?? 'none'
        ].join(':')
      : [
          'cubic',
          formatRibbonFrameKeyPoint(segment.start),
          formatRibbonFrameKeyPoint(segment.control1),
          formatRibbonFrameKeyPoint(segment.control2),
          formatRibbonFrameKeyPoint(segment.end),
          segment.length.toFixed(4),
          segment.startAnchorType ?? 'none',
          segment.endAnchorType ?? 'none'
        ].join(':'))

  const cacheKey = [samplingKey, segmentRevisionKey].join('|')
  if (cachedBySampling) {
    cachedBySampling.set(samplingKey, cacheKey)
  } else {
    ribbonFrameCacheKeysBySegment.set(
      segment,
      new Map([[samplingKey, cacheKey]])
    )
  }
  return cacheKey
}

const buildSourcePathFinalRangePolygonCacheKey = (
  path: Pick<PathGeometry, 'segments'>,
  renderRange: SourceSegmentIntervalRange,
  policyRange: SourceSegmentIntervalRange,
  segmentRange: SourcePathSegmentRange | undefined,
  spanRole: ConstrainedDashedPhysicalSpanRole,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  endpointCapPolicy: DashEndpointCapPolicy,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  squareCapStart: boolean | undefined,
  squareCapEnd: boolean | undefined,
  roundCapVisualMaxLength: number,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) => {
  const segment = path.segments[renderRange.segmentIndex]
  if (!segment) {
    return null
  }
  const localStartDistance =
    segmentRange?.index === renderRange.segmentIndex
      ? renderRange.startDistance - segmentRange.startDistance
      : renderRange.startDistance
  const localEndDistance =
    segmentRange?.index === renderRange.segmentIndex
      ? renderRange.endDistance - segmentRange.startDistance
      : renderRange.endDistance
  const localPolicyStartDistance =
    segmentRange?.index === policyRange.segmentIndex
      ? policyRange.startDistance - segmentRange.startDistance
      : policyRange.startDistance
  const localPolicyEndDistance =
    segmentRange?.index === policyRange.segmentIndex
      ? policyRange.endDistance - segmentRange.startDistance
      : policyRange.endDistance

  return [
    buildExactSourcePathRibbonSegmentFrameCacheKey(
      segment,
      samplingTolerance,
      samplingOptions
    ),
    spanRole,
    endpointCapPolicy.terminalRole,
    endpointCapPolicy.suppressStartCap === true ? 'no-start-cap' : 'start-cap',
    endpointCapPolicy.suppressEndCap === true ? 'no-end-cap' : 'end-cap',
    stroke.position,
    stroke.width.toFixed(4),
    stroke.cap,
    roundCapStart === true ? 'rs' : 'ns',
    roundCapEnd === true ? 're' : 'ne',
    squareCapStart === true ? 'ss' : 'ns',
    squareCapEnd === true ? 'se' : 'ne',
    roundCapVisualMaxLength.toFixed(4),
    renderRange.segmentIndex,
    formatSourcePathRangeKeyDistance(localStartDistance),
    formatSourcePathRangeKeyDistance(localEndDistance),
    policyRange.segmentIndex,
    formatSourcePathRangeKeyDistance(localPolicyStartDistance),
    formatSourcePathRangeKeyDistance(localPolicyEndDistance)
  ].join('|')
}

const getCachedSourcePathFinalRangePolygons = (cacheKey: string) => {
  const cached = sourcePathFinalRangePolygonCache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (cached.length === 0 || getPolygonsAbsoluteArea(cached) <= EPSILON) {
    sourcePathFinalRangePolygonCache.delete(cacheKey)
    emitStrokePipelineTrace(
      'source-path-final-range-polygon-empty-cache-discarded',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: cached.length,
        area: getPolygonsAbsoluteArea(cached)
      }
    )
    return null
  }

  sourcePathFinalRangePolygonCache.delete(cacheKey)
  sourcePathFinalRangePolygonCache.set(cacheKey, cached)
  emitStrokePipelineCounter('source-path-final-range-polygon-cache-hit')
  return cached
}

const setCachedSourcePathFinalRangePolygons = (
  cacheKey: string,
  polygons: Vec2[][]
) => {
  const area = getPolygonsAbsoluteArea(polygons)
  if (polygons.length === 0 || area <= EPSILON) {
    emitStrokePipelineTrace(
      'source-path-final-range-polygon-empty-cache-skipped',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: polygons.length,
        area
      }
    )
    return
  }

  emitStrokePipelineCounter('source-path-final-range-polygon-cache-miss')
  sourcePathFinalRangePolygonCache.set(cacheKey, polygons)
  if (
    sourcePathFinalRangePolygonCache.size >
    SOURCE_PATH_FINAL_RANGE_POLYGON_CACHE_LIMIT
  ) {
    const [oldestKey] = sourcePathFinalRangePolygonCache.keys()
    if (oldestKey) {
      sourcePathFinalRangePolygonCache.delete(oldestKey)
    }
  }
}

const formatTranslationInvariantCacheNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(6) : 'nan'

const subtractPointFromCacheOrigin = (point: Vec2, origin: Vec2): Vec2 => ({
  x: point.x - origin.x,
  y: point.y - origin.y
})

const addPointToCacheOrigin = (point: Vec2, origin: Vec2): Vec2 => ({
  x: point.x + origin.x,
  y: point.y + origin.y
})

const buildTranslationInvariantPointKey = (point: Vec2, origin: Vec2) => {
  return `${formatTranslationInvariantCacheNumber(
    point.x - origin.x
  )},${formatTranslationInvariantCacheNumber(point.y - origin.y)}`
}

const buildTranslationInvariantSegmentCacheKey = (
  segment: PathGeometry['segments'][number],
  index: number,
  origin: Vec2
) =>
  segment.type === 'line'
    ? [
        index,
        'line',
        buildTranslationInvariantPointKey(segment.start, origin),
        buildTranslationInvariantPointKey(segment.end, origin),
        formatTranslationInvariantCacheNumber(segment.length),
        segment.startAnchorType ?? 'none',
        segment.endAnchorType ?? 'none'
      ].join(':')
    : [
        index,
        'cubic',
        buildTranslationInvariantPointKey(segment.start, origin),
        buildTranslationInvariantPointKey(segment.control1, origin),
        buildTranslationInvariantPointKey(segment.control2, origin),
        buildTranslationInvariantPointKey(segment.end, origin),
        formatTranslationInvariantCacheNumber(segment.length),
        segment.startAnchorType ?? 'none',
        segment.endAnchorType ?? 'none'
      ].join(':')

const getPathTranslationCacheOrigin = (
  path: Pick<PathGeometry, 'segments'>
): Vec2 | null => {
  const firstSegment = path.segments[0]
  if (!firstSegment) {
    return null
  }
  return normalizePoint(firstSegment.start)
}

const buildTranslationInvariantPathCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2
) =>
  [
    path.closed ? 'closed' : 'open',
    formatTranslationInvariantCacheNumber(path.totalLength),
    ...path.segments.map((segment, index) =>
      buildTranslationInvariantSegmentCacheKey(segment, index, origin)
    )
  ].join('|')

const zeroOriginTranslationInvariantPathCacheKey = new WeakMap<object, string>()
const getZeroOriginTranslationInvariantPathCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
) => {
  const cached = zeroOriginTranslationInvariantPathCacheKey.get(path)
  if (cached) {
    return cached
  }
  const cacheKey = buildTranslationInvariantPathCacheKey(path, { x: 0, y: 0 })
  zeroOriginTranslationInvariantPathCacheKey.set(path, cacheKey)
  return cacheKey
}

const buildTranslationInvariantRangeCacheKey = (
  range: SourceSegmentIntervalRange
) =>
  [
    range.segmentIndex,
    formatTranslationInvariantCacheNumber(range.startDistance),
    formatTranslationInvariantCacheNumber(range.endDistance)
  ].join(':')

const getSourcePathRangeSegmentRanges = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext
) => {
  const baseRange = slicingContext.segmentRanges[range.segmentIndex]
  return baseRange &&
    range.startDistance >= baseRange.startDistance - EPSILON &&
    range.endDistance <= baseRange.endDistance + EPSILON
    ? [range]
    : splitSourcePathRangeBySegmentBoundaries(
        path,
        range.startDistance,
        range.endDistance,
        slicingContext
      )
}

const buildTranslationInvariantLocalRangeCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2,
  ranges: SourceSegmentIntervalRange[],
  slicingContext: SourcePathSlicingContext
) =>
  ranges
    .flatMap((sourceRange) =>
      getSourcePathRangeSegmentRanges(path, sourceRange, slicingContext)
    )
    .map((range) => {
      const segment = path.segments[range.segmentIndex]
      const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
      if (!segment || !segmentRange) {
        return [
          range.segmentIndex,
          'missing-segment',
          buildTranslationInvariantRangeCacheKey(range)
        ].join(':')
      }

      const localStartDistance =
        range.startDistance - segmentRange.startDistance
      const localEndDistance = range.endDistance - segmentRange.startDistance
      return [
        buildTranslationInvariantSegmentCacheKey(
          segment,
          range.segmentIndex,
          origin
        ),
        formatTranslationInvariantCacheNumber(localStartDistance),
        formatTranslationInvariantCacheNumber(localEndDistance)
      ].join(':')
    })
    .join(';')

const buildTranslationInvariantMaterializationPathCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2,
  ranges: SourceSegmentIntervalRange[],
  slicingContext: SourcePathSlicingContext
) =>
  ranges.length > 0
    ? [
        path.closed ? 'closed-range' : 'open-range',
        buildTranslationInvariantLocalRangeCacheKey(
          path,
          origin,
          ranges,
          slicingContext
        )
      ].join('|')
    : buildTranslationInvariantPathCacheKey(path, origin)

const getSourcePathIntervalLevelPolygonCacheOrigin = (
  path: Pick<PathGeometry, 'segments'>,
  ranges: SourceSegmentIntervalRange[]
): Vec2 | null => {
  const firstRange = ranges[0]
  if (!firstRange) {
    return getPathTranslationCacheOrigin(path)
  }

  const segment = path.segments[firstRange.segmentIndex]
  return segment
    ? normalizePoint(segment.start)
    : getPathTranslationCacheOrigin(path)
}

const buildSourcePathIntervalLevelPolygonCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2,
  position: Pick<RenderableStroke, 'position'>['position'],
  width: number,
  capMaterialization: SourcePathRangeCapMaterialization,
  ranges: SourceSegmentIntervalRange[],
  slicingContext: SourcePathSlicingContext
) =>
  [
    path.closed ? 'closed-range' : 'open-range',
    buildTranslationInvariantLocalRangeCacheKey(
      path,
      origin,
      ranges,
      slicingContext
    ),
    position,
    formatTranslationInvariantCacheNumber(width),
    capMaterialization.stroke.cap,
    capMaterialization.stroke.join,
    capMaterialization.roundCapStart === true ? 'round-start' : 'flat-start',
    capMaterialization.roundCapEnd === true ? 'round-end' : 'flat-end',
    capMaterialization.squareCapStart === true ? 'square-start' : 'flat-start',
    capMaterialization.squareCapEnd === true ? 'square-end' : 'flat-end',
    formatTranslationInvariantCacheNumber(
      slicingContext.roundCapVisualMaxLength
    ),
    formatTranslationInvariantCacheNumber(slicingContext.samplingTolerance),
    slicingContext.samplingOptions.minCubicSamples ?? 'default-min',
    slicingContext.samplingOptions.maxCubicSamples ?? 'default-max',
    slicingContext.samplingOptions.useRangeLengthForSampleCount === true
      ? 'range'
      : 'curve',
    ranges.map(buildTranslationInvariantRangeCacheKey).join(';')
  ].join('|')

const implicitFillRegionCacheSignatureByRegions = new WeakMap<
  PolygonRegion[],
  string
>()
const buildImplicitFillRegionCacheSignature = (regions: PolygonRegion[]) => {
  const cached = implicitFillRegionCacheSignatureByRegions.get(regions)
  if (cached !== undefined) {
    return cached
  }
  const signature = regions
    .map((region, index) => {
      const bounds = getBounds(region.polygons)
      return [
        index,
        region.polygons.length,
        formatTranslationInvariantCacheNumber(
          getPolygonsAbsoluteArea(region.polygons)
        ),
        formatTranslationInvariantCacheNumber(bounds.minX),
        formatTranslationInvariantCacheNumber(bounds.minY),
        formatTranslationInvariantCacheNumber(bounds.maxX),
        formatTranslationInvariantCacheNumber(bounds.maxY)
      ].join(':')
    })
    .join(';')
  implicitFillRegionCacheSignatureByRegions.set(regions, signature)
  return signature
}

const INSIDE_LEGAL_CLIP_RESULT_CACHE_LIMIT = 4096
const insideLegalClipResultCache = new Map<string, Vec2[][]>()
const OUTSIDE_LEGAL_CLIP_RESULT_CACHE_LIMIT = 4096
const outsideLegalClipResultCache = new Map<string, Vec2[][]>()
const SOURCE_VERTEX_JOIN_INSIDE_LEGAL_CLIP_CACHE_LIMIT = 4096
const sourceVertexJoinInsideLegalClipCache = new Map<string, Vec2[][]>()

const buildPolygonListCacheSignature = (polygons: Vec2[][]) =>
  polygons
    .map((polygon, polygonIndex) => {
      const bounds = getBounds([polygon])
      return [
        polygonIndex,
        polygon.length,
        formatTranslationInvariantCacheNumber(polygonArea(polygon)),
        formatTranslationInvariantCacheNumber(bounds.minX),
        formatTranslationInvariantCacheNumber(bounds.minY),
        formatTranslationInvariantCacheNumber(bounds.maxX),
        formatTranslationInvariantCacheNumber(bounds.maxY),
        polygon
          .map(
            (point) =>
              `${formatTranslationInvariantCacheNumber(
                point.x
              )},${formatTranslationInvariantCacheNumber(point.y)}`
          )
          .join(';')
      ].join(':')
    })
    .join('|')

const buildInsideLegalClipResultCacheKey = (
  path: SourcePathWithOptionalSamples,
  backendSignature: string,
  subjectPolygons: Vec2[][],
  legalClipRegions: PolygonRegion[],
  options: {
    fragmentStitchRadius?: number
    fragmentPruneArea?: number
    dropEmptyInsideClipResult?: boolean
  } & ClippedProductCleanupOptions
) =>
  [
    backendSignature,
    getZeroOriginTranslationInvariantPathCacheKey(path),
    sourcePathHasCurvedSegments(path) ? 'curved-source' : 'linear-source',
    buildPolygonListCacheSignature(subjectPolygons),
    buildImplicitFillRegionCacheSignature(legalClipRegions),
    options.dropEmptyInsideClipResult === true ? 'drop-empty' : 'keep-empty',
    formatTranslationInvariantCacheNumber(options.fragmentStitchRadius ?? 0),
    formatTranslationInvariantCacheNumber(options.fragmentPruneArea ?? 0),
    formatTranslationInvariantCacheNumber(
      options.cleanupMicroEdgeTolerance ?? 0
    ),
    formatTranslationInvariantCacheNumber(
      options.cleanupCollinearTolerance ?? 0
    ),
    buildPolygonListCacheSignature(
      options.restoreSubjectBoundaryPolygons ?? []
    ),
    (options.restoreSubjectBoundaryPaths ?? [])
      .map((path) =>
        path
          .map(
            (point) =>
              `${formatTranslationInvariantCacheNumber(
                point.x
              )},${formatTranslationInvariantCacheNumber(point.y)}`
          )
          .join(';')
      )
      .join('|')
  ].join('||')

const buildOutsideLegalClipResultCacheKey = (
  path: SourcePathWithOptionalSamples,
  backendSignature: string,
  subjectPolygons: Vec2[][],
  legalClipRegions: PolygonRegion[],
  outsideFillRule: 'evenodd' | 'nonzero',
  includePathSignature: boolean,
  options: {
    fragmentStitchRadius?: number
    fragmentPruneArea?: number
  } & ClippedProductCleanupOptions
) =>
  [
    backendSignature,
    includePathSignature
      ? getZeroOriginTranslationInvariantPathCacheKey(path)
      : '',
    buildPolygonListCacheSignature(subjectPolygons),
    buildImplicitFillRegionCacheSignature(legalClipRegions),
    outsideFillRule,
    formatTranslationInvariantCacheNumber(options.fragmentStitchRadius ?? 0),
    formatTranslationInvariantCacheNumber(options.fragmentPruneArea ?? 0),
    formatTranslationInvariantCacheNumber(
      options.cleanupMicroEdgeTolerance ?? 0
    ),
    formatTranslationInvariantCacheNumber(
      options.cleanupCollinearTolerance ?? 0
    ),
    buildPolygonListCacheSignature(
      options.restoreSubjectBoundaryPolygons ?? []
    ),
    (options.restoreSubjectBoundaryPaths ?? [])
      .map((path) =>
        path
          .map(
            (point) =>
              `${formatTranslationInvariantCacheNumber(
                point.x
              )},${formatTranslationInvariantCacheNumber(point.y)}`
          )
          .join(';')
      )
      .join('|')
  ].join('||')

const getInsideLegalClipResultFromCache = (cacheKey: string) => {
  const cachedResult = insideLegalClipResultCache.get(cacheKey)
  if (!cachedResult) {
    return undefined
  }
  emitStrokePipelineCounter('inside-legal-clip-result-cache-hit')
  return cachedResult
}

const setInsideLegalClipResultCache = (
  cacheKey: string,
  polygons: Vec2[][]
) => {
  insideLegalClipResultCache.set(cacheKey, polygons)
  if (insideLegalClipResultCache.size > INSIDE_LEGAL_CLIP_RESULT_CACHE_LIMIT) {
    const oldestKey = insideLegalClipResultCache.keys().next().value
    if (oldestKey) {
      insideLegalClipResultCache.delete(oldestKey)
    }
  }
  emitStrokePipelineCounter('inside-legal-clip-result-cache-store')
}

const getOutsideLegalClipResultFromCache = (cacheKey: string) => {
  const cachedResult = outsideLegalClipResultCache.get(cacheKey)
  if (!cachedResult) {
    return undefined
  }
  emitStrokePipelineCounter('outside-legal-clip-result-cache-hit')
  return cachedResult
}

const setOutsideLegalClipResultCache = (
  cacheKey: string,
  polygons: Vec2[][]
) => {
  outsideLegalClipResultCache.set(cacheKey, polygons)
  if (
    outsideLegalClipResultCache.size > OUTSIDE_LEGAL_CLIP_RESULT_CACHE_LIMIT
  ) {
    const oldestKey = outsideLegalClipResultCache.keys().next().value
    if (oldestKey) {
      outsideLegalClipResultCache.delete(oldestKey)
    }
  }
  emitStrokePipelineCounter('outside-legal-clip-result-cache-store')
}

const buildSourceVertexJoinInsideLegalClipCacheKey = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[]
) =>
  [
    buildPolygonListCacheSignature(polygons),
    buildImplicitFillRegionCacheSignature(legalRegions)
  ].join('||')

const getSourceVertexJoinInsideLegalClipFromCache = (cacheKey: string) => {
  const cachedResult = sourceVertexJoinInsideLegalClipCache.get(cacheKey)
  if (!cachedResult) {
    return undefined
  }
  emitStrokePipelineCounter('source-vertex-join-inside-legal-clip-cache-hit')
  return cachedResult
}

const setSourceVertexJoinInsideLegalClipCache = (
  cacheKey: string,
  polygons: Vec2[][]
) => {
  sourceVertexJoinInsideLegalClipCache.set(cacheKey, polygons)
  if (
    sourceVertexJoinInsideLegalClipCache.size >
    SOURCE_VERTEX_JOIN_INSIDE_LEGAL_CLIP_CACHE_LIMIT
  ) {
    const oldestKey = sourceVertexJoinInsideLegalClipCache.keys().next().value
    if (oldestKey) {
      sourceVertexJoinInsideLegalClipCache.delete(oldestKey)
    }
  }
  emitStrokePipelineCounter('source-vertex-join-inside-legal-clip-cache-store')
}

const buildEndpointPolicyCacheSignature = (policy: DashEndpointCapPolicy) =>
  [
    policy.signature,
    policy.terminalRole,
    policy.startCap ? 'start-cap' : 'no-start-cap',
    policy.endCap ? 'end-cap' : 'no-end-cap',
    policy.suppressStartCap ? 'suppress-start' : 'allow-start',
    policy.suppressEndCap ? 'suppress-end' : 'allow-end'
  ].join(':')

const buildIntervalSweepCacheSignature = (
  sweep: DashedSourcePathIntervalSweep
) =>
  [
    buildEndpointPolicyCacheSignature(sweep.endpointCapPolicy),
    [
      'smooth-continuity',
      formatTranslationInvariantCacheNumber(
        sweep.smoothContinuityGroup.startDistance
      ),
      formatTranslationInvariantCacheNumber(
        sweep.smoothContinuityGroup.endDistance
      ),
      sweep.smoothContinuityGroup.wrapsSeam ? 'wrap' : 'nowrap'
    ].join(':'),
    ...sweep.ranges.map(({ range, renderRange, rangeEndpointCapPolicy }) =>
      [
        buildTranslationInvariantRangeCacheKey(range),
        buildTranslationInvariantRangeCacheKey(renderRange),
        buildEndpointPolicyCacheSignature(rangeEndpointCapPolicy)
      ].join('/')
    )
  ].join('|')

const buildConstrainedDashedJoinIndependentIntervalProductCacheKey = (
  pathSignature: string,
  interval: VisibleDashedTopologyInterval,
  materializationInterval: VisibleDashedTopologyInterval,
  intervalSweep: DashedSourcePathIntervalSweep,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'cap' | 'dashPattern' | 'dashOffset'
  >,
  metadata: {
    cachePrefix: string
    ownerPrefix: string
    strokeIndex: number
    domainMode: string
    clipInsideToFillDomain: boolean
    implicitFillRegions: PolygonRegion[]
    sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
    canUseClosedHalfPlaneLegality: boolean
    shouldPreserveSmoothProduct: boolean
    productFinalClipsInsideImplicitDomain: boolean
    sourceVertexBoundaryJoinSignature: string
    includeImplicitFillRegionsSignature: boolean
    includeStrokeBoundaryDomainSignature: boolean
  }
) =>
  [
    metadata.cachePrefix,
    metadata.ownerPrefix,
    metadata.strokeIndex,
    pathSignature,
    metadata.domainMode,
    buildStableVisibleIntervalDecisionSignature(interval),
    formatTranslationInvariantCacheNumber(interval.startDistance),
    formatTranslationInvariantCacheNumber(interval.endDistance),
    interval.wrapsSeam ? 'wrap' : 'nowrap',
    formatTranslationInvariantCacheNumber(
      materializationInterval.startDistance
    ),
    formatTranslationInvariantCacheNumber(materializationInterval.endDistance),
    materializationInterval.wrapsSeam
      ? 'materialized-wrap'
      : 'materialized-nowrap',
    materializationInterval.materializationDistanceSpace ?? 'source',
    buildIntervalSweepCacheSignature(intervalSweep),
    physicalSpans
      .map((span) =>
        [
          span.role,
          formatTranslationInvariantCacheNumber(span.startDistance),
          formatTranslationInvariantCacheNumber(span.endDistance),
          span.wrapsSeam ? 'wrap' : 'nowrap',
          formatTranslationInvariantCacheNumber(span.intervalLength)
        ].join(':')
      )
      .join(';'),
    metadata.clipInsideToFillDomain ? 'clip' : 'no-clip',
    metadata.includeImplicitFillRegionsSignature
      ? buildImplicitFillRegionCacheSignature(metadata.implicitFillRegions)
      : 'implicit-fill-not-used',
    metadata.includeStrokeBoundaryDomainSignature
      ? metadata.sharedStrokeBoundaryDomains.length
      : 'stroke-boundary-not-used',
    metadata.canUseClosedHalfPlaneLegality ? 'half-plane' : 'no-half-plane',
    metadata.shouldPreserveSmoothProduct ? 'smooth' : 'non-smooth',
    metadata.sourceVertexBoundaryJoinSignature,
    metadata.productFinalClipsInsideImplicitDomain
      ? 'product-final-implicit'
      : 'post-implicit',
    stroke.position,
    formatTranslationInvariantCacheNumber(stroke.width),
    stroke.cap,
    stroke.dashPattern.map(formatTranslationInvariantCacheNumber).join(','),
    formatTranslationInvariantCacheNumber(stroke.dashOffset)
  ].join('|')

const buildConstrainedDashedIntervalCoverageBodyCacheKey = (
  pathSignature: string,
  interval: VisibleDashedTopologyInterval,
  materializationInterval: VisibleDashedTopologyInterval,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'cap' | 'dashPattern' | 'dashOffset'
  >,
  metadata: {
    cachePrefix: string
    ownerPrefix: string
    strokeIndex: number
    domainMode: string
    clipInsideToFillDomain: boolean
    implicitFillRegions: PolygonRegion[]
    sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
    includeImplicitFillRegionsSignature: boolean
    includeStrokeBoundaryDomainSignature: boolean
  }
) =>
  [
    metadata.cachePrefix,
    metadata.ownerPrefix,
    metadata.strokeIndex,
    pathSignature,
    metadata.domainMode,
    buildStableVisibleIntervalDecisionSignature(interval),
    formatTranslationInvariantCacheNumber(interval.startDistance),
    formatTranslationInvariantCacheNumber(interval.endDistance),
    interval.wrapsSeam ? 'wrap' : 'nowrap',
    formatTranslationInvariantCacheNumber(
      materializationInterval.startDistance
    ),
    formatTranslationInvariantCacheNumber(materializationInterval.endDistance),
    materializationInterval.wrapsSeam
      ? 'materialized-wrap'
      : 'materialized-nowrap',
    materializationInterval.materializationDistanceSpace ?? 'source',
    physicalSpans
      .map((span) =>
        [
          span.role,
          formatTranslationInvariantCacheNumber(span.startDistance),
          formatTranslationInvariantCacheNumber(span.endDistance),
          span.wrapsSeam ? 'wrap' : 'nowrap',
          formatTranslationInvariantCacheNumber(span.intervalLength)
        ].join(':')
      )
      .join(';'),
    metadata.clipInsideToFillDomain ? 'clip' : 'no-clip',
    metadata.includeImplicitFillRegionsSignature
      ? buildImplicitFillRegionCacheSignature(metadata.implicitFillRegions)
      : 'implicit-fill-not-used',
    metadata.includeStrokeBoundaryDomainSignature
      ? metadata.sharedStrokeBoundaryDomains.length
      : 'stroke-boundary-not-used',
    stroke.position,
    formatTranslationInvariantCacheNumber(stroke.width),
    stroke.cap,
    stroke.dashPattern.map(formatTranslationInvariantCacheNumber).join(','),
    formatTranslationInvariantCacheNumber(stroke.dashOffset)
  ].join('|')

const toRelativePolygons = (polygons: Vec2[][], origin: Vec2): Vec2[][] =>
  polygons.map((polygon) =>
    polygon.map((point) => subtractPointFromCacheOrigin(point, origin))
  )

const fromRelativePolygons = (polygons: Vec2[][], origin: Vec2): Vec2[][] =>
  polygons.map((polygon) =>
    polygon.map((point) => addPointToCacheOrigin(point, origin))
  )

const getCachedSourcePathIntervalLevelPolygons = (
  cacheKey: string,
  origin: Vec2
) => {
  const cached = sourcePathIntervalLevelPolygonCache.get(cacheKey)
  if (!cached) {
    return null
  }

  const cachedPolygons = fromRelativePolygons(cached.polygons, origin)
  const cachedArea = getPolygonsAbsoluteArea(cachedPolygons)
  if (cached.polygons.length === 0 || cachedArea <= EPSILON) {
    sourcePathIntervalLevelPolygonCache.delete(cacheKey)
    emitStrokePipelineTrace(
      'source-path-interval-level-polygon-empty-cache-discarded',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: cached.polygons.length,
        area: cachedArea
      }
    )
    return null
  }

  sourcePathIntervalLevelPolygonCache.delete(cacheKey)
  sourcePathIntervalLevelPolygonCache.set(cacheKey, cached)
  emitStrokePipelineCounter('source-path-interval-level-polygon-cache-hit')
  return cachedPolygons
}

const setCachedSourcePathIntervalLevelPolygons = (
  cacheKey: string,
  origin: Vec2,
  polygons: Vec2[][]
) => {
  const area = getPolygonsAbsoluteArea(polygons)
  if (polygons.length === 0 || area <= EPSILON) {
    emitStrokePipelineTrace(
      'source-path-interval-level-polygon-empty-cache-skipped',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: polygons.length,
        area
      }
    )
    return
  }

  emitStrokePipelineCounter('source-path-interval-level-polygon-cache-miss')
  sourcePathIntervalLevelPolygonCache.set(cacheKey, {
    origin,
    polygons: toRelativePolygons(polygons, origin)
  })
  if (
    sourcePathIntervalLevelPolygonCache.size >
    SOURCE_PATH_INTERVAL_LEVEL_POLYGON_CACHE_LIMIT
  ) {
    const [oldestKey] = sourcePathIntervalLevelPolygonCache.keys()
    if (oldestKey) {
      sourcePathIntervalLevelPolygonCache.delete(oldestKey)
    }
  }
}

const buildCenterStrokeDescriptorProductPolygonCacheKey = (
  strokePath: Vec2[],
  origin: Vec2,
  stroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>,
  strokeWidth: number
) => {
  if (strokePath.length === 2) {
    const end = strokePath[1]
    return [
      'two-point',
      `${formatTranslationInvariantCacheNumber(
        end.x - origin.x
      )},${formatTranslationInvariantCacheNumber(end.y - origin.y)}`,
      formatTranslationInvariantCacheNumber(strokeWidth),
      stroke.cap,
      stroke.join,
      formatTranslationInvariantCacheNumber(stroke.miterLimit)
    ].join('|')
  }

  let pathKey = '0.000000,0.000000'
  for (let index = 1; index < strokePath.length; index += 1) {
    if (index > 0) {
      pathKey += ';'
    }
    pathKey += buildTranslationInvariantPointKey(strokePath[index], origin)
  }

  return [
    pathKey,
    formatTranslationInvariantCacheNumber(strokeWidth),
    stroke.cap,
    stroke.join,
    formatTranslationInvariantCacheNumber(stroke.miterLimit)
  ].join('|')
}

const getCachedCenterStrokeDescriptorProductPolygons = (
  cacheKey: string,
  origin: Vec2
) => {
  const cached = centerStrokeDescriptorProductPolygonCache.get(cacheKey)
  if (!cached) {
    return null
  }

  centerStrokeDescriptorProductPolygonCache.delete(cacheKey)
  centerStrokeDescriptorProductPolygonCache.set(cacheKey, cached)
  emitStrokePipelineCounter(
    'center-stroke-descriptor-product-polygon-cache-hit'
  )
  if (cached.origin.x === origin.x && cached.origin.y === origin.y) {
    return cached.absolutePolygons
  }
  cached.polygons ??= toRelativePolygons(cached.absolutePolygons, cached.origin)
  return fromRelativePolygons(cached.polygons, origin)
}

const setCachedCenterStrokeDescriptorProductPolygons = (
  cacheKey: string,
  origin: Vec2,
  polygons: Vec2[][]
) => {
  emitStrokePipelineCounter(
    'center-stroke-descriptor-product-polygon-cache-miss'
  )
  centerStrokeDescriptorProductPolygonCache.set(cacheKey, {
    origin,
    absolutePolygons: polygons
  })
  if (
    centerStrokeDescriptorProductPolygonCache.size >
    CENTER_STROKE_DESCRIPTOR_PRODUCT_POLYGON_CACHE_LIMIT
  ) {
    const [oldestKey] = centerStrokeDescriptorProductPolygonCache.keys()
    if (oldestKey) {
      centerStrokeDescriptorProductPolygonCache.delete(oldestKey)
    }
  }
}

const getCachedConstrainedDashedJoinIndependentIntervalProduct = (
  cacheKey: string,
  origin: Vec2
) => {
  const cached =
    constrainedDashedJoinIndependentIntervalProductCache.get(cacheKey)
  if (!cached) {
    return null
  }

  const cachedPolygons = fromRelativePolygons(cached.polygons, origin)
  const cachedArea = getPolygonsAbsoluteArea(cachedPolygons)
  if (cached.polygons.length === 0 || cachedArea <= EPSILON) {
    constrainedDashedJoinIndependentIntervalProductCache.delete(cacheKey)
    emitStrokePipelineTrace(
      'constrained-dashed-join-independent-interval-empty-cache-discarded',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: cached.polygons.length,
        area: cachedArea
      }
    )
    return null
  }

  constrainedDashedJoinIndependentIntervalProductCache.delete(cacheKey)
  constrainedDashedJoinIndependentIntervalProductCache.set(cacheKey, cached)
  emitStrokePipelineCounter(
    'constrained-dashed-join-independent-interval-cache-hit'
  )
  return cachedPolygons
}

const setCachedConstrainedDashedJoinIndependentIntervalProduct = (
  cacheKey: string,
  origin: Vec2,
  polygons: Vec2[][]
) => {
  const area = getPolygonsAbsoluteArea(polygons)
  if (polygons.length === 0 || area <= EPSILON) {
    emitStrokePipelineTrace(
      'constrained-dashed-join-independent-interval-empty-cache-skipped',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: polygons.length,
        area
      }
    )
    return
  }

  emitStrokePipelineCounter(
    'constrained-dashed-join-independent-interval-cache-miss'
  )
  constrainedDashedJoinIndependentIntervalProductCache.set(cacheKey, {
    origin,
    polygons: toRelativePolygons(polygons, origin)
  })
  if (
    constrainedDashedJoinIndependentIntervalProductCache.size >
    SOURCE_PATH_INTERVAL_LEVEL_POLYGON_CACHE_LIMIT
  ) {
    const [oldestKey] =
      constrainedDashedJoinIndependentIntervalProductCache.keys()
    if (oldestKey) {
      constrainedDashedJoinIndependentIntervalProductCache.delete(oldestKey)
    }
  }
}

const getCachedConstrainedDashedIntervalCoverageBody = (
  cacheKey: string,
  origin: Vec2
) => {
  const cached = constrainedDashedIntervalCoverageBodyCache.get(cacheKey)
  if (!cached) {
    return null
  }

  const cachedPolygons = fromRelativePolygons(cached.polygons, origin)
  const cachedArea = getPolygonsAbsoluteArea(cachedPolygons)
  if (cached.polygons.length === 0 || cachedArea <= EPSILON) {
    constrainedDashedIntervalCoverageBodyCache.delete(cacheKey)
    emitStrokePipelineTrace(
      'constrained-dashed-interval-coverage-body-empty-cache-discarded',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: cached.polygons.length,
        area: cachedArea
      }
    )
    return null
  }

  constrainedDashedIntervalCoverageBodyCache.delete(cacheKey)
  constrainedDashedIntervalCoverageBodyCache.set(cacheKey, cached)
  emitStrokePipelineCounter(
    'constrained-dashed-interval-coverage-body-cache-hit'
  )
  return {
    ...cached,
    polygons: cachedPolygons
  }
}

const setCachedConstrainedDashedIntervalCoverageBody = (
  cacheKey: string,
  origin: Vec2,
  polygons: Vec2[][],
  metadata: {
    intervalSweep: DashedSourcePathIntervalSweep
    intervalSweepSpanCount: number
    terminalCapCount: number
    intervalEndpointCapPolicy: DashedSourcePathIntervalSweep['endpointCapPolicy']
    intervalSmoothContinuityGroup: DashedSourcePathIntervalSweep['smoothContinuityGroup']
    intervalHasCurvedSourcePathSweepRange: boolean
    intervalHasSmoothContinuityAcrossSweepRanges: boolean
  }
) => {
  const area = getPolygonsAbsoluteArea(polygons)
  if (polygons.length === 0 || area <= EPSILON) {
    emitStrokePipelineTrace(
      'constrained-dashed-interval-coverage-body-empty-cache-skipped',
      {
        cacheKeyLength: cacheKey.length,
        polygonCount: polygons.length,
        area
      }
    )
    return
  }

  emitStrokePipelineCounter(
    'constrained-dashed-interval-coverage-body-cache-miss'
  )
  constrainedDashedIntervalCoverageBodyCache.set(cacheKey, {
    origin,
    polygons: toRelativePolygons(polygons, origin),
    ...metadata
  })
  if (
    constrainedDashedIntervalCoverageBodyCache.size >
    SOURCE_PATH_INTERVAL_LEVEL_POLYGON_CACHE_LIMIT
  ) {
    const [oldestKey] = constrainedDashedIntervalCoverageBodyCache.keys()
    if (oldestKey) {
      constrainedDashedIntervalCoverageBodyCache.delete(oldestKey)
    }
  }
}

const translateBoundsByDelta = (
  bounds: Bounds | undefined,
  dx: number,
  dy: number
): Bounds | undefined =>
  bounds
    ? {
        minX: bounds.minX + dx,
        minY: bounds.minY + dy,
        maxX: bounds.maxX + dx,
        maxY: bounds.maxY + dy
      }
    : undefined

const translatePointsByDelta = (
  points: Vec2[] | undefined,
  dx: number,
  dy: number
) =>
  points?.map((point) => ({
    x: point.x + dx,
    y: point.y + dy
  }))

const translatePolygonsByDelta = (polygons: Vec2[][], dx: number, dy: number) =>
  polygons.map((polygon) =>
    polygon.map((point) => ({
      x: point.x + dx,
      y: point.y + dy
    }))
  )

const translateRenderDescriptorByDelta = (
  descriptor: SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor'],
  dx: number,
  dy: number
): SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor'] =>
  descriptor
    ? {
        ...descriptor,
        fillPolygons: descriptor.fillPolygons
          ? translatePolygonsByDelta(descriptor.fillPolygons, dx, dy)
          : undefined,
        descriptorProductPolygons: descriptor.descriptorProductPolygons
          ? translatePolygonsByDelta(
              descriptor.descriptorProductPolygons,
              dx,
              dy
            )
          : undefined,
        clipPolygons: descriptor.clipPolygons
          ? translatePolygonsByDelta(descriptor.clipPolygons, dx, dy)
          : undefined,
        fillClipPolygons: descriptor.fillClipPolygons
          ? translatePolygonsByDelta(descriptor.fillClipPolygons, dx, dy)
          : undefined,
        fillExcludePolygons: descriptor.fillExcludePolygons
          ? translatePolygonsByDelta(descriptor.fillExcludePolygons, dx, dy)
          : undefined,
        strokeMaskPolygons: descriptor.strokeMaskPolygons
          ? translatePolygonsByDelta(descriptor.strokeMaskPolygons, dx, dy)
          : undefined,
        strokePaths: descriptor.strokePaths
          ? translatePolygonsByDelta(descriptor.strokePaths, dx, dy)
          : undefined,
        strokePathGroups: descriptor.strokePathGroups?.map((group) => ({
          ...group,
          clipPolygons: group.clipPolygons
            ? translatePolygonsByDelta(group.clipPolygons, dx, dy)
            : undefined,
          strokePaths: translatePolygonsByDelta(group.strokePaths, dx, dy)
        }))
      }
    : undefined

const translateDebugMetaByDelta = (
  debugMeta: SolidCenterStrokeGeometryDebugMeta | undefined,
  dx: number,
  dy: number
): SolidCenterStrokeGeometryDebugMeta | undefined =>
  debugMeta
    ? {
        ...debugMeta,
        materializedOffsetFrameSpan: debugMeta.materializedOffsetFrameSpan
          ? {
              ...debugMeta.materializedOffsetFrameSpan,
              startX: debugMeta.materializedOffsetFrameSpan.startX + dx,
              startY: debugMeta.materializedOffsetFrameSpan.startY + dy,
              startOffsetX:
                debugMeta.materializedOffsetFrameSpan.startOffsetX + dx,
              startOffsetY:
                debugMeta.materializedOffsetFrameSpan.startOffsetY + dy,
              endX: debugMeta.materializedOffsetFrameSpan.endX + dx,
              endY: debugMeta.materializedOffsetFrameSpan.endY + dy,
              endOffsetX: debugMeta.materializedOffsetFrameSpan.endOffsetX + dx,
              endOffsetY: debugMeta.materializedOffsetFrameSpan.endOffsetY + dy
            }
          : undefined,
        domainPlanBoundaryPoints: translatePointsByDelta(
          debugMeta.domainPlanBoundaryPoints,
          dx,
          dy
        ),
        domainPlanSplitRangeTerminals:
          debugMeta.domainPlanSplitRangeTerminals?.map((terminal) => ({
            ...terminal,
            boundaryPoints: translatePointsByDelta(
              terminal.boundaryPoints,
              dx,
              dy
            )
          })),
        joinOwnershipRecords: debugMeta.joinOwnershipRecords?.map((record) => ({
          ...record,
          bounds: translateBoundsByDelta(record.bounds, dx, dy) ?? record.bounds
        })),
        paintBounds:
          translateBoundsByDelta(debugMeta.paintBounds, dx, dy) ??
          debugMeta.paintBounds,
        solidMaskModelFaceOwnershipTrace:
          debugMeta.solidMaskModelFaceOwnershipTrace?.map((trace) => ({
            ...trace,
            start: {
              x: trace.start.x + dx,
              y: trace.start.y + dy
            },
            end: {
              x: trace.end.x + dx,
              y: trace.end.y + dy
            }
          }))
      }
    : undefined

const translateResolvedPacketsByDelta = (
  packets: SolidCenterStrokeResolvedPacket[],
  dx: number,
  dy: number
): SolidCenterStrokeResolvedPacket[] =>
  packets.map((packet) => ({
    geometry: {
      ...packet.geometry,
      polygons: translatePolygonsByDelta(packet.geometry.polygons, dx, dy),
      bounds:
        translateBoundsByDelta(packet.geometry.bounds, dx, dy) ??
        packet.geometry.bounds,
      debugMeta: translateDebugMetaByDelta(packet.geometry.debugMeta, dx, dy),
      renderDescriptor: translateRenderDescriptorByDelta(
        packet.geometry.renderDescriptor,
        dx,
        dy
      )
    },
    paint: { ...packet.paint }
  }))

const restyleResolvedPacketsForStroke = (
  packets: SolidCenterStrokeResolvedPacket[],
  stroke: RenderableStroke
): SolidCenterStrokeResolvedPacket[] =>
  packets.map((packet) => ({
    ...packet,
    paint: {
      ...packet.paint,
      kind: stroke.kind,
      color: stroke.color,
      alpha: stroke.alpha,
      gradientStyle: stroke.gradientStyle,
      paintKey: stroke.paintKey
    }
  }))

const hashStableString = (prefix: string, value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${prefix}:${(hash >>> 0).toString(36)}`
}

const uniqueStrings = (values: (string | undefined)[]) => {
  const unique: string[] = []
  for (const value of values) {
    if (value !== undefined && !unique.includes(value)) {
      unique.push(value)
    }
  }
  return unique.sort()
}

const uniqueNumbers = (values: (number | undefined)[]) => {
  const unique: number[] = []
  for (const value of values) {
    if (value !== undefined && !unique.includes(value)) {
      unique.push(value)
    }
  }
  return unique.sort((left, right) => left - right)
}

const pushUniqueString = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value)
  }
}

const mergeDomainPlanSplitRangeTerminals = (
  packets: SolidCenterStrokeResolvedPacket[]
): NonNullable<
  SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
> => {
  const terminals: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
  > = []
  const seen = new Set<string>()
  packets.forEach((packet) => {
    packet.geometry.debugMeta?.domainPlanSplitRangeTerminals?.forEach(
      (terminal) => {
        const key = [
          terminal.intervalId,
          terminal.splitRangeId,
          terminal.terminalRole,
          terminal.startDistance,
          terminal.endDistance,
          terminal.boundaryDomainId ?? ''
        ].join('|')
        if (seen.has(key)) {
          return
        }
        seen.add(key)
        terminals.push({
          ...terminal,
          boundaryPoints: terminal.boundaryPoints
            ? terminal.boundaryPoints.map((point) => ({ ...point }))
            : undefined
        })
      }
    )
  })
  return terminals
}

const splitIntervalIdList = (intervalId: string | undefined): string[] =>
  intervalId
    ? intervalId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : []

const getPacketIntervalIds = (packet: SolidCenterStrokeResolvedPacket) =>
  uniqueStrings([
    ...(packet.geometry.debugMeta?.intervalIds ?? []),
    ...splitIntervalIdList(packet.geometry.debugMeta?.intervalId)
  ])

const getPacketDashProductIntervals = (
  packet: SolidCenterStrokeResolvedPacket
): NonNullable<SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']> => {
  const meta = packet.geometry.debugMeta
  if (!meta) {
    return []
  }
  if (meta.dashProductIntervals && meta.dashProductIntervals.length > 0) {
    return meta.dashProductIntervals.map((interval) => ({ ...interval }))
  }

  const terminalRecords = meta.domainPlanSplitRangeTerminals ?? []
  if (terminalRecords.length > 0) {
    return terminalRecords.map((terminal) => ({
      intervalId: terminal.intervalId,
      splitRangeId: terminal.splitRangeId,
      terminalRole: terminal.terminalRole,
      startDistance: terminal.startDistance,
      endDistance: terminal.endDistance,
      boundaryDomainId:
        terminal.boundaryDomainId ?? meta.domainPlanBoundaryDomainId,
      boundaryRole: terminal.boundaryRole ?? meta.domainPlanBoundaryRole,
      selectedSide: terminal.selectedSide ?? meta.domainPlanSelectedSide,
      filledSide: terminal.filledSide ?? meta.domainPlanFilledSide,
      unfilledSide: terminal.unfilledSide ?? meta.domainPlanUnfilledSide,
      sourceSegmentIndex:
        terminal.sourceSegmentIndex ??
        meta.domainPlanSplitRangeSourceSegmentIndex,
      endpointCapPolicySignature: meta.dashEndpointCapPolicySignature,
      joinOwnershipSignature: meta.joinOwnershipSignature,
      smoothContinuityGroupId: meta.smoothContinuityGroupId
    }))
  }

  return getPacketIntervalIds(packet).map((intervalId) => ({
    intervalId,
    splitRangeId: meta.domainPlanSplitRangeId,
    terminalRole: meta.domainPlanTerminalRole,
    startDistance: meta.startDistance,
    endDistance: meta.endDistance,
    boundaryDomainId: meta.domainPlanBoundaryDomainId,
    boundaryRole: meta.domainPlanBoundaryRole,
    selectedSide: meta.domainPlanSelectedSide,
    filledSide: meta.domainPlanFilledSide,
    unfilledSide: meta.domainPlanUnfilledSide,
    sourceSegmentIndex: meta.domainPlanSplitRangeSourceSegmentIndex,
    endpointCapPolicySignature: meta.dashEndpointCapPolicySignature,
    joinOwnershipSignature: meta.joinOwnershipSignature,
    smoothContinuityGroupId: meta.smoothContinuityGroupId
  }))
}

const getConstrainedDashedProductCanonicalGroupKey = (
  packet: SolidCenterStrokeResolvedPacket
) => {
  if (packet.geometry.renderDescriptor) {
    return null
  }
  const meta = packet.geometry.debugMeta
  if (!meta?.productSignature?.startsWith('constrained-dashed:')) {
    return null
  }
  return [
    packet.paint.kind ?? 'solid',
    packet.paint.paintKey ?? '',
    packet.paint.color,
    packet.paint.alpha,
    meta.networkId ?? '',
    meta.strokeId ?? '',
    meta.strokeIndex ?? '',
    meta.strokePosition ?? '',
    meta.strokeWidth ?? '',
    meta.strokeJoin ?? '',
    meta.strokeCap ?? '',
    meta.strokeMiterLimit ?? '',
    meta.domainPlanDomainMode ?? meta.domainMode ?? '',
    (meta.legalDomainIds ?? []).join(',')
  ].join('|')
}

const buildCanonicalConstrainedDashedDebugMeta = (
  packets: SolidCenterStrokeResolvedPacket[],
  polygons: Vec2[][],
  productSignature: string,
  revisionSet: SolidCenterStrokeGeometryDebugMeta['revisionSet'] | undefined
): SolidCenterStrokeGeometryDebugMeta | undefined => {
  const primary = packets[0]?.geometry.debugMeta
  if (!primary) {
    return undefined
  }
  const intervalIds = uniqueStrings(packets.flatMap(getPacketIntervalIds))
  const sourceSpanIds = uniqueStrings(
    packets.flatMap((packet) => packet.geometry.debugMeta?.sourceSpanIds ?? [])
  )
  const sourceNetworkIds = uniqueStrings(
    packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceNetworkIds ?? []
    )
  )
  const sourceContourIds = uniqueStrings(
    packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceContourIds ?? []
    )
  )
  const legalDomainIds = uniqueStrings(
    packets.flatMap((packet) => packet.geometry.debugMeta?.legalDomainIds ?? [])
  )
  const productSourceSegmentIndexes = uniqueNumbers(
    packets.flatMap(
      (packet) =>
        packet.geometry.debugMeta?.productSourceSegmentIndexes ?? [
          packet.geometry.debugMeta?.domainPlanSplitRangeSourceSegmentIndex
        ]
    )
  )
  const domainPlanSplitRangeTerminals =
    mergeDomainPlanSplitRangeTerminals(packets)
  const dashProductIntervals = packets.flatMap(getPacketDashProductIntervals)
  const dashEndpointCapPolicySignatures = uniqueStrings(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.dashEndpointCapPolicySignatures ?? []),
      packet.geometry.debugMeta?.dashEndpointCapPolicySignature
    ])
  )
  const dashEndpointCapPolicyTerminalRoles = Array.from(
    new Set(
      packets.flatMap((packet) => [
        ...(packet.geometry.debugMeta?.dashEndpointCapPolicyTerminalRoles ??
          []),
        packet.geometry.debugMeta?.dashEndpointCapPolicyTerminalRole
      ])
    )
  )
    .filter(
      (
        role
      ): role is NonNullable<
        SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRole']
      > => role !== undefined
    )
    .sort((left, right) => left.localeCompare(right))
  const joinOwnershipSignatures = uniqueStrings(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.joinOwnershipSignatures ?? []),
      packet.geometry.debugMeta?.joinOwnershipSignature
    ])
  )
  const smoothContinuityGroupIds = uniqueStrings(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.smoothContinuityGroupIds ?? []),
      packet.geometry.debugMeta?.smoothContinuityGroupId
    ])
  )
  const domainPlanBoundaryRoles = Array.from(
    new Set(
      packets.flatMap((packet) => [
        ...(packet.geometry.debugMeta?.domainPlanBoundaryRoles ?? []),
        packet.geometry.debugMeta?.domainPlanBoundaryRole,
        ...(packet.geometry.debugMeta?.domainPlanSplitRangeTerminals ?? []).map(
          (terminal) => terminal.boundaryRole
        )
      ])
    )
  )
    .filter(
      (
        role
      ): role is NonNullable<
        SolidCenterStrokeGeometryDebugMeta['domainPlanBoundaryRole']
      > => role !== undefined
    )
    .sort((left, right) => left.localeCompare(right))
  const domainPlanSplitRangeIds = uniqueStrings(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.domainPlanSplitRangeIds ?? []),
      packet.geometry.debugMeta?.domainPlanSplitRangeId,
      ...(packet.geometry.debugMeta?.domainPlanSplitRangeTerminals ?? []).map(
        (terminal) => terminal.splitRangeId
      )
    ])
  )
  const domainPlanSelectedSides = uniqueNumbers(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.domainPlanSelectedSides ?? []),
      packet.geometry.debugMeta?.domainPlanSelectedSide,
      ...(packet.geometry.debugMeta?.domainPlanSplitRangeTerminals ?? []).map(
        (terminal) => terminal.selectedSide
      )
    ])
  ).filter((side): side is 1 | -1 => side === 1 || side === -1)
  const domainPlanSourceSegmentIndexes = uniqueNumbers(
    packets.flatMap((packet) => [
      ...(packet.geometry.debugMeta?.domainPlanSourceSegmentIndexes ?? []),
      packet.geometry.debugMeta?.domainPlanSplitRangeSourceSegmentIndex,
      ...(packet.geometry.debugMeta?.productSourceSegmentIndexes ?? []),
      ...(packet.geometry.debugMeta?.domainPlanSplitRangeTerminals ?? []).map(
        (terminal) => terminal.sourceSegmentIndex
      )
    ])
  )
  const finalProductArea = getPolygonsAbsoluteArea(polygons)

  return {
    ...primary,
    intervalId: intervalIds[0] ?? primary.intervalId,
    intervalIds,
    sourceSpanIds,
    sourceNetworkIds:
      sourceNetworkIds.length > 0 ? sourceNetworkIds : primary.sourceNetworkIds,
    sourceContourIds:
      sourceContourIds.length > 0 ? sourceContourIds : primary.sourceContourIds,
    legalDomainIds:
      legalDomainIds.length > 0 ? legalDomainIds : primary.legalDomainIds,
    productSourceSegmentIndexes:
      productSourceSegmentIndexes.length > 0
        ? productSourceSegmentIndexes
        : primary.productSourceSegmentIndexes,
    domainPlanSplitRangeTerminals:
      domainPlanSplitRangeTerminals.length > 0
        ? domainPlanSplitRangeTerminals
        : primary.domainPlanSplitRangeTerminals,
    dashProductIntervals:
      dashProductIntervals.length > 0
        ? dashProductIntervals
        : primary.dashProductIntervals,
    dashEndpointCapPolicySignatures:
      dashEndpointCapPolicySignatures.length > 0
        ? dashEndpointCapPolicySignatures
        : primary.dashEndpointCapPolicySignatures,
    dashEndpointCapPolicyTerminalRoles:
      dashEndpointCapPolicyTerminalRoles.length > 0
        ? dashEndpointCapPolicyTerminalRoles
        : primary.dashEndpointCapPolicyTerminalRoles,
    joinOwnershipSignatures:
      joinOwnershipSignatures.length > 0
        ? joinOwnershipSignatures
        : primary.joinOwnershipSignatures,
    smoothContinuityGroupIds:
      smoothContinuityGroupIds.length > 0
        ? smoothContinuityGroupIds
        : primary.smoothContinuityGroupIds,
    domainPlanBoundaryRoles:
      domainPlanBoundaryRoles.length > 0
        ? domainPlanBoundaryRoles
        : primary.domainPlanBoundaryRoles,
    domainPlanSplitRangeIds:
      domainPlanSplitRangeIds.length > 0
        ? domainPlanSplitRangeIds
        : primary.domainPlanSplitRangeIds,
    domainPlanSelectedSides:
      domainPlanSelectedSides.length > 0
        ? domainPlanSelectedSides
        : primary.domainPlanSelectedSides,
    domainPlanSourceSegmentIndexes:
      domainPlanSourceSegmentIndexes.length > 0
        ? domainPlanSourceSegmentIndexes
        : primary.domainPlanSourceSegmentIndexes,
    materializedEndpointCaps: undefined,
    joinOwnershipRecords: packets.flatMap(
      (packet) => packet.geometry.debugMeta?.joinOwnershipRecords ?? []
    ),
    rawProductArea: packets.reduce(
      (total, packet) =>
        total + (packet.geometry.debugMeta?.rawProductArea ?? 0),
      0
    ),
    cleanedProductArea: packets.reduce(
      (total, packet) =>
        total + (packet.geometry.debugMeta?.cleanedProductArea ?? 0),
      0
    ),
    boundaryClippedProductArea: packets.reduce(
      (total, packet) =>
        total + (packet.geometry.debugMeta?.boundaryClippedProductArea ?? 0),
      0
    ),
    finalProductArea,
    productSignature,
    revisionSet
  }
}

const canonicalizeConstrainedDashedSamePaintProductPackets = (
  packets: SolidCenterStrokeResolvedPacket[],
  options: {
    getRevisionSet?: (
      productSignature: string,
      metadata?: {
        endpointCapPolicySignature?: string
        joinOwnershipSignature?: string
        smoothContinuitySignature?: string
        productMaterializationSignature?: string
        resolvedRegionSignature?: string
        renderOutputSignature?: string
        ownerCount?: number
        productDomainMode?: StrokeDomainMode
      }
    ) => SolidCenterStrokeGeometryDebugMeta['revisionSet'] | undefined
  } = {}
): SolidCenterStrokeResolvedPacket[] => {
  if (packets.length <= 1) {
    return packets
  }

  const backend = getGeometryBackend()
  if (!backend.capabilities.union) {
    return packets
  }

  const grouped = new Map<string, SolidCenterStrokeResolvedPacket[]>()
  const passthrough: SolidCenterStrokeResolvedPacket[] = []
  packets.forEach((packet) => {
    const groupKey = getConstrainedDashedProductCanonicalGroupKey(packet)
    if (!groupKey) {
      passthrough.push(packet)
      return
    }
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), packet])
  })

  const canonicalPackets = Array.from(grouped.entries()).flatMap(
    ([groupKey, groupPackets]) => {
      if (groupPackets.length === 1) {
        return groupPackets
      }
      const groupPolygons = groupPackets.flatMap(
        (packet) => packet.geometry.polygons
      )
      if (groupPolygons.length <= 1) {
        return groupPackets
      }

      const polygons = getCoveragePolygonsFromRegions(
        backend.union(toCoveragePolygonRegions(groupPolygons), 'nonzero')
      )
      if (polygons.length === 0) {
        return []
      }

      const primary = groupPackets[0]
      const intervalIds = uniqueStrings(
        groupPackets.flatMap(getPacketIntervalIds)
      )
      const sourceSpanIds = uniqueStrings(
        groupPackets.flatMap(
          (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
        )
      )
      const productSignature = hashStableString(
        'constrained-dashed',
        [
          'canonical-product',
          groupKey,
          intervalIds.join(','),
          sourceSpanIds.join(',')
        ].join('|')
      )
      const primaryMeta = primary.geometry.debugMeta
      const revisionSet = options.getRevisionSet?.(productSignature, {
        productDomainMode: primaryMeta?.domainPlanDomainMode as
          | StrokeDomainMode
          | undefined,
        endpointCapPolicySignature: [
          'canonical-terminal-policy',
          productSignature,
          uniqueStrings(
            groupPackets.map(
              (packet) =>
                packet.geometry.debugMeta?.dashEndpointCapPolicySignature
            )
          ).join(',')
        ].join(':'),
        joinOwnershipSignature: [
          'canonical-join-ownership',
          productSignature,
          uniqueStrings(
            groupPackets.map(
              (packet) => packet.geometry.debugMeta?.joinOwnershipSignature
            )
          ).join(',')
        ].join(':'),
        smoothContinuitySignature: [
          'canonical-smooth-continuity',
          productSignature,
          uniqueStrings(
            groupPackets.map(
              (packet) => packet.geometry.debugMeta?.smoothContinuityGroupId
            )
          ).join(',')
        ].join(':'),
        productMaterializationSignature: [
          'canonical-product-materialization',
          productSignature
        ].join(':'),
        resolvedRegionSignature: [
          'canonical-resolved-region',
          productSignature
        ].join(':'),
        renderOutputSignature: [
          'canonical-render-output',
          productSignature
        ].join(':'),
        ownerCount: Math.max(intervalIds.length, sourceSpanIds.length, 1)
      })
      const geometryId = hashStableString(
        'constrained-dashed-canonical-geometry',
        `${productSignature}|${primary.geometry.geometryId}`
      )
      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta: buildCanonicalConstrainedDashedDebugMeta(
              groupPackets,
              polygons,
              productSignature,
              revisionSet
            ),
            renderDescriptor: undefined
          },
          paint: {
            ...primary.paint,
            geometryId
          }
        }
      ]
    }
  )

  return [...passthrough, ...canonicalPackets]
}

const buildConstrainedDashedPacketStageCacheKey = (
  sourcePathSignature: string,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'cap' | 'dashPattern' | 'dashOffset'
  >,
  metadata: {
    cachePrefix: string
    ownerPrefix: string
    strokeIndex: number
    domainMode: string
    intervalSignature: string
    joinOwnershipSignature: string
    clipInsideToFillDomain: boolean
    implicitFillRegions: PolygonRegion[]
    sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
  }
) =>
  [
    metadata.cachePrefix,
    metadata.ownerPrefix,
    metadata.strokeIndex,
    sourcePathSignature,
    metadata.domainMode,
    metadata.intervalSignature,
    metadata.joinOwnershipSignature,
    metadata.clipInsideToFillDomain ? 'clip' : 'no-clip',
    metadata.clipInsideToFillDomain
      ? buildImplicitFillRegionCacheSignature(metadata.implicitFillRegions)
      : 'implicit-fill-not-used',
    metadata.clipInsideToFillDomain && stroke.position === 'outside'
      ? metadata.sharedStrokeBoundaryDomains.length
      : 'stroke-boundary-not-used',
    stroke.position,
    formatTranslationInvariantCacheNumber(stroke.width),
    stroke.join,
    stroke.cap,
    stroke.dashPattern.map(formatTranslationInvariantCacheNumber).join(','),
    formatTranslationInvariantCacheNumber(stroke.dashOffset)
  ].join('|')

const buildConstrainedDashedJoinIndependentPacketStageCacheKey = (
  sourcePathSignature: string,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'cap' | 'dashPattern' | 'dashOffset'
  >,
  metadata: {
    cachePrefix: string
    ownerPrefix: string
    strokeIndex: number
    domainMode: string
    intervalSignature: string
    clipInsideToFillDomain: boolean
    implicitFillRegions: PolygonRegion[]
    sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
  }
) =>
  [
    metadata.cachePrefix,
    metadata.ownerPrefix,
    metadata.strokeIndex,
    sourcePathSignature,
    metadata.domainMode,
    metadata.intervalSignature,
    metadata.clipInsideToFillDomain ? 'clip' : 'no-clip',
    metadata.clipInsideToFillDomain
      ? buildImplicitFillRegionCacheSignature(metadata.implicitFillRegions)
      : 'implicit-fill-not-used',
    metadata.clipInsideToFillDomain && stroke.position === 'outside'
      ? metadata.sharedStrokeBoundaryDomains.length
      : 'stroke-boundary-not-used',
    stroke.position,
    formatTranslationInvariantCacheNumber(stroke.width),
    stroke.cap,
    stroke.dashPattern.map(formatTranslationInvariantCacheNumber).join(','),
    formatTranslationInvariantCacheNumber(stroke.dashOffset)
  ].join('|')

const getCachedConstrainedDashedPacketStage = (
  cacheKey: string,
  origin: Vec2,
  stroke: RenderableStroke
) => {
  const cached = constrainedDashedPacketStageCache.get(cacheKey)
  if (!cached) {
    return null
  }

  constrainedDashedPacketStageCache.delete(cacheKey)
  constrainedDashedPacketStageCache.set(cacheKey, cached)
  emitStrokePipelineCounter('constrained-dashed-packet-stage-cache-hit')
  return restyleResolvedPacketsForStroke(
    translateResolvedPacketsByDelta(
      cached.packets,
      origin.x - cached.origin.x,
      origin.y - cached.origin.y
    ),
    stroke
  )
}

const getCachedConstrainedDashedJoinIndependentPacketStage = (
  cacheKey: string,
  origin: Vec2,
  stroke: RenderableStroke
) => {
  const cached = constrainedDashedJoinIndependentPacketStageCache.get(cacheKey)
  if (!cached) {
    return null
  }

  constrainedDashedJoinIndependentPacketStageCache.delete(cacheKey)
  constrainedDashedJoinIndependentPacketStageCache.set(cacheKey, cached)
  emitStrokePipelineCounter(
    'constrained-dashed-join-independent-packet-stage-cache-hit'
  )
  return restyleResolvedPacketsForStroke(
    translateResolvedPacketsByDelta(
      cached.packets,
      origin.x - cached.origin.x,
      origin.y - cached.origin.y
    ),
    stroke
  )
}

const setCachedConstrainedDashedPacketStage = (
  cacheKey: string,
  origin: Vec2,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  emitStrokePipelineCounter('constrained-dashed-packet-stage-cache-miss')
  constrainedDashedPacketStageCache.set(cacheKey, {
    origin,
    packets
  })
  if (
    constrainedDashedPacketStageCache.size >
    CONSTRAINED_DASHED_PACKET_STAGE_CACHE_LIMIT
  ) {
    const [oldestKey] = constrainedDashedPacketStageCache.keys()
    if (oldestKey) {
      constrainedDashedPacketStageCache.delete(oldestKey)
    }
  }
}

const setCachedConstrainedDashedJoinIndependentPacketStage = (
  cacheKey: string,
  origin: Vec2,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  emitStrokePipelineCounter(
    'constrained-dashed-join-independent-packet-stage-cache-miss'
  )
  constrainedDashedJoinIndependentPacketStageCache.set(cacheKey, {
    origin,
    packets
  })
  if (
    constrainedDashedJoinIndependentPacketStageCache.size >
    CONSTRAINED_DASHED_PACKET_STAGE_CACHE_LIMIT
  ) {
    const [oldestKey] = constrainedDashedJoinIndependentPacketStageCache.keys()
    if (oldestKey) {
      constrainedDashedJoinIndependentPacketStageCache.delete(oldestKey)
    }
  }
}

const isJoinIndependentConstrainedDashedPacket = (
  packet: SolidCenterStrokeResolvedPacket
) => packet.geometry.debugMeta?.joinOwnershipSignature === 'source-path'

const getLineSegmentTangent = (
  segment: Extract<PathSegment, { type: 'line' }>
) =>
  normalizeVector({
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y
  }) ?? { x: 1, y: 0 }

const interpolateLineSegmentPointAtDistance = (
  segment: Extract<PathSegment, { type: 'line' }>,
  distance: number
) => {
  if (segment.length <= EPSILON) {
    return normalizePoint(segment.start)
  }

  const amount = Math.max(0, Math.min(1, distance / segment.length))
  return normalizePoint({
    x: segment.start.x + (segment.end.x - segment.start.x) * amount,
    y: segment.start.y + (segment.end.y - segment.start.y) * amount
  })
}

const createSourcePathSlicingContext = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  samplingTolerance = SOURCE_PATH_DASH_SLICE_TOLERANCE,
  samplingOptions = SOURCE_PATH_DASH_SLICE_SAMPLING,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
): SourcePathSlicingContext => {
  const segmentRanges = getSourcePathSegmentRanges(path)
  return {
    segmentRanges,
    segmentSamples: new Map(),
    exactRibbonSegmentFrames: new Map(),
    offsetRibbonSegmentFrames: new Map(),
    splitRangeCache: new Map(),
    pointSliceCache: new Map(),
    intervalStrokePathCache: new Map(),
    exactLineRibbonRangeCache: new Map(),
    exactOffsetLineRibbonRangeCache: new Map(),
    exactLineRibbonRangeDirectCounterEmitted: false,
    ribbonPolygonCache: new Map(),
    segmentBoundaryCache: new Map(),
    segmentBoundaryClipCache: new Map(),
    isLineOnlyPath: isLineOnlyPathGeometry(path),
    samplingTolerance,
    samplingOptions,
    roundCapVisualMaxLength
  }
}

const getSourcePathSegmentSample = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
    Partial<
      Pick<
        PathGeometry,
        | 'sampledSegmentPoints'
        | 'sampledSegmentDistances'
        | 'traceSampleTolerance'
        | 'traceSampleOptions'
      >
    >,
  range: SourcePathSegmentRange,
  slicingContext: SourcePathSlicingContext
) => {
  const cached = slicingContext.segmentSamples.get(range.index)
  if (cached) {
    return cached
  }

  const sample = buildSourcePathSegmentSample(
    path,
    range,
    slicingContext.samplingTolerance,
    slicingContext.samplingOptions
  )
  slicingContext.segmentSamples.set(range.index, sample)
  return sample
}

const lowerBoundCumulativeDistance = (
  cumulativeDistances: readonly number[],
  distance: number
) => {
  let low = 0
  let high = cumulativeDistances.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((cumulativeDistances[middle] ?? 0) < distance) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

const upperBoundCumulativeDistance = (
  cumulativeDistances: readonly number[],
  distance: number
) => {
  let low = 0
  let high = cumulativeDistances.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((cumulativeDistances[middle] ?? 0) <= distance) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

const interpolateSourcePathSamplePoint = (
  sample: SourcePathSegmentSample,
  distance: number
): Vec2 | null => {
  if (sample.points.length === 0) {
    return null
  }
  if (sample.points.length === 1 || sample.polylineLength <= EPSILON) {
    return sample.points[0]
  }

  const clampedDistance = Math.max(0, Math.min(sample.polylineLength, distance))
  const nextIndex = Math.max(
    1,
    Math.min(
      sample.points.length - 1,
      lowerBoundCumulativeDistance(sample.cumulativeDistances, clampedDistance)
    )
  )
  const previousDistance = sample.cumulativeDistances[nextIndex - 1]
  const nextDistance = sample.cumulativeDistances[nextIndex]
  const segmentLength = nextDistance - previousDistance
  const t =
    segmentLength > EPSILON
      ? (clampedDistance - previousDistance) / segmentLength
      : 0
  const previous = sample.points[nextIndex - 1]
  const next = sample.points[nextIndex]
  if (previous && next) {
    return normalizePoint({
      x: previous.x + (next.x - previous.x) * t,
      y: previous.y + (next.y - previous.y) * t
    })
  }

  return sample.points[sample.points.length - 1]
}

const dedupeSourcePathSlicePoints = (points: Vec2[]) => {
  if (points.length <= 1) {
    return points
  }

  const result = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    if (distanceBetween(result[result.length - 1], points[index]) > EPSILON) {
      result.push(points[index])
    }
  }
  return result
}

const sliceSourcePathSegmentSamplePoints = (
  sample: SourcePathSegmentSample,
  segmentLength: number,
  localStartDistance: number,
  localEndDistance: number
) => {
  if (sample.points.length < 2 || sample.polylineLength <= EPSILON) {
    return []
  }

  const scale =
    segmentLength > EPSILON ? sample.polylineLength / segmentLength : 1
  const startDistance = Math.max(0, localStartDistance * scale)
  const endDistance = Math.min(sample.polylineLength, localEndDistance * scale)
  if (endDistance - startDistance <= EPSILON) {
    return []
  }

  const startPoint = interpolateSourcePathSamplePoint(sample, startDistance)
  const endPoint = interpolateSourcePathSamplePoint(sample, endDistance)
  if (!startPoint || !endPoint) {
    return []
  }

  const points = [startPoint]
  const firstInteriorIndex = Math.max(
    1,
    upperBoundCumulativeDistance(
      sample.cumulativeDistances,
      startDistance + EPSILON
    )
  )
  const lastInteriorExclusiveIndex = Math.min(
    sample.points.length - 1,
    lowerBoundCumulativeDistance(
      sample.cumulativeDistances,
      endDistance - EPSILON
    )
  )
  for (
    let index = firstInteriorIndex;
    index < lastInteriorExclusiveIndex;
    index += 1
  ) {
    const distance = sample.cumulativeDistances[index]
    if (
      distance > startDistance + EPSILON &&
      distance < endDistance - EPSILON
    ) {
      points.push(sample.points[index])
    }
  }
  points.push(endPoint)

  return dedupeSourcePathSlicePoints(points)
}

const sliceSourcePathSegmentRangePoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext
) => {
  const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
  const sample = segmentRange
    ? getSourcePathSegmentSample(path, segmentRange, slicingContext)
    : undefined
  if (segmentRange && sample) {
    const points = sliceSourcePathSegmentSamplePoints(
      sample,
      segmentRange.endDistance - segmentRange.startDistance,
      range.startDistance - segmentRange.startDistance,
      range.endDistance - segmentRange.startDistance
    )
    if (points.length >= 2) {
      return points
    }
  }

  return slicePathGeometryPoints(
    path,
    range.startDistance,
    range.endDistance,
    false,
    slicingContext.samplingTolerance,
    slicingContext.samplingOptions
  )
}

const lowerBoundSourcePathSegmentEnd = (
  segmentRanges: readonly SourcePathSegmentRange[],
  distance: number
) => {
  let low = 0
  let high = segmentRanges.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (segmentRanges[middle].endDistance <= distance) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

const splitSourcePathRangeBySegmentBoundaries = (
  path: Pick<PathGeometry, 'segments'>,
  startDistance: number,
  endDistance: number,
  slicingContext?: SourcePathSlicingContext
) => {
  if (endDistance - startDistance <= EPSILON) {
    return []
  }

  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const ranges: SourceSegmentIntervalRange[] = []
  for (
    let index = lowerBoundSourcePathSegmentEnd(
      segmentRanges,
      startDistance + EPSILON
    );
    index < segmentRanges.length;
    index += 1
  ) {
    const segment = segmentRanges[index]
    if (segment.startDistance >= endDistance - EPSILON) {
      break
    }
    const start = Math.max(startDistance, segment.startDistance)
    const end = Math.min(endDistance, segment.endDistance)
    if (end - start > EPSILON) {
      ranges.push({
        startDistance: start,
        endDistance: end,
        segmentIndex: segment.index
      })
    }
  }
  return ranges
}

const isLineOnlyPathGeometry = (
  path: Pick<PathGeometry, 'segments'>
): boolean => path.segments.every((segment) => segment.type === 'line')

const interpolateLineSegmentPoint = (
  segment: PathSegment,
  range: SourcePathSegmentRange,
  distance: number
): Vec2 | null => {
  if (segment.type !== 'line') {
    return null
  }
  const length = range.endDistance - range.startDistance
  const t = length > EPSILON ? (distance - range.startDistance) / length : 0
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * t,
    y: segment.start.y + (segment.end.y - segment.start.y) * t
  }
}

const sliceLineOnlyPathRangePoints = (
  path: Pick<PathGeometry, 'segments'>,
  startDistance: number,
  endDistance: number,
  slicingContext: SourcePathSlicingContext
): Vec2[] => {
  const ranges = splitSourcePathRangeBySegmentBoundaries(
    path,
    startDistance,
    endDistance,
    slicingContext
  )
  if (ranges.length === 0) {
    return []
  }

  const points: Vec2[] = []
  ranges.forEach((range) => {
    const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
    const segment = path.segments[range.segmentIndex]
    if (!segmentRange || !segment) {
      return
    }
    const startPoint = interpolateLineSegmentPoint(
      segment,
      segmentRange,
      range.startDistance
    )
    const endPoint = interpolateLineSegmentPoint(
      segment,
      segmentRange,
      range.endDistance
    )
    if (!startPoint || !endPoint) {
      return
    }
    appendPathPoints(points, [startPoint, endPoint])
  })
  return points
}

const splitVisibleIntervalBySourceSegments = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'domainPlanSelectedSide'
    | 'domainPlanSideResolutionStatus'
  >,
  slicingContext?: SourcePathSlicingContext
) => {
  if (path.segments.length === 0 || path.totalLength <= EPSILON) {
    return []
  }

  const cacheKey = slicingContext
    ? buildSourcePathSplitCacheKey(
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
    : null
  const cached = cacheKey
    ? slicingContext?.splitRangeCache.get(cacheKey)
    : undefined
  if (cached) {
    return cached
  }

  if (interval.wrapsSeam) {
    const ranges = [
      ...splitSourcePathRangeBySegmentBoundaries(
        path,
        interval.startDistance,
        path.totalLength,
        slicingContext
      ),
      ...splitSourcePathRangeBySegmentBoundaries(
        path,
        0,
        interval.endDistance,
        slicingContext
      )
    ]
    if (cacheKey) {
      slicingContext?.splitRangeCache.set(cacheKey, ranges)
    }
    return ranges
  }

  const ranges = splitSourcePathRangeBySegmentBoundaries(
    path,
    interval.startDistance,
    interval.endDistance,
    slicingContext
  )
  if (cacheKey) {
    slicingContext?.splitRangeCache.set(cacheKey, ranges)
  }
  return ranges
}

const sliceSourcePathRangePoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole,
  slicingContext?: SourcePathSlicingContext
) => {
  if (!slicingContext) {
    return slicePathGeometryPoints(
      path,
      range.startDistance,
      range.endDistance,
      false
    )
  }

  const cacheKey = buildSourcePathSliceCacheKey(range, role)
  const cached = slicingContext.pointSliceCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const points = sliceSourcePathSegmentRangePoints(path, range, slicingContext)
  slicingContext.pointSliceCache.set(cacheKey, points)
  return points
}
const appendPathPoints = (target: Vec2[], points: Vec2[]) => {
  points.forEach((point) => {
    const previous = target[target.length - 1]
    if (previous && distanceBetween(previous, point) <= EPSILON) {
      return
    }
    target.push(point)
  })
}

const sliceIntervalStrokePathPoints = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  slicingContext?: SourcePathSlicingContext
): Vec2[] => {
  const intervalStrokePathCacheKey = slicingContext
    ? [
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam === true ? 'wrap' : 'direct'
      ].join(':')
    : null
  if (slicingContext && intervalStrokePathCacheKey) {
    const cached = slicingContext.intervalStrokePathCache.get(
      intervalStrokePathCacheKey
    )
    if (cached) {
      return cached
    }
  }
  const cacheStrokePath = (points: Vec2[]) => {
    if (slicingContext && intervalStrokePathCacheKey && points.length >= 2) {
      slicingContext.intervalStrokePathCache.set(
        intervalStrokePathCacheKey,
        points
      )
    }
    return points
  }

  if (slicingContext) {
    if (slicingContext.isLineOnlyPath) {
      const points: Vec2[] = []
      if (interval.wrapsSeam && path.closed) {
        appendPathPoints(
          points,
          sliceLineOnlyPathRangePoints(
            path,
            interval.startDistance,
            path.totalLength,
            slicingContext
          )
        )
        appendPathPoints(
          points,
          sliceLineOnlyPathRangePoints(
            path,
            0,
            interval.endDistance,
            slicingContext
          )
        )
      } else {
        appendPathPoints(
          points,
          sliceLineOnlyPathRangePoints(
            path,
            interval.startDistance,
            interval.endDistance,
            slicingContext
          )
        )
      }
      if (points.length >= 2) {
        return cacheStrokePath(points)
      }
    }

    const ranges = splitVisibleIntervalBySourceSegments(
      path,
      {
        ...interval,
        domainPlanSelectedSide: undefined,
        domainPlanSideResolutionStatus: undefined
      },
      slicingContext
    )
    if (ranges.length > 0) {
      const points: Vec2[] = []
      ranges.forEach((range) => {
        appendPathPoints(
          points,
          sliceSourcePathRangePoints(path, range, 'core', slicingContext)
        )
      })
      if (points.length >= 2) {
        return cacheStrokePath(points)
      }
    }
  }

  const tolerance =
    slicingContext?.samplingTolerance ?? SOURCE_PATH_DASH_SLICE_TOLERANCE
  const samplingOptions =
    slicingContext?.samplingOptions ?? SOURCE_PATH_DASH_SLICE_SAMPLING
  const points: Vec2[] = []
  if (interval.wrapsSeam && path.closed) {
    appendPathPoints(
      points,
      slicePathGeometryPoints(
        path,
        interval.startDistance,
        path.totalLength,
        false,
        tolerance,
        samplingOptions
      )
    )
    appendPathPoints(
      points,
      slicePathGeometryPoints(
        path,
        0,
        interval.endDistance,
        false,
        tolerance,
        samplingOptions
      )
    )
    return cacheStrokePath(points)
  }

  return cacheStrokePath(
    slicePathGeometryPoints(
      path,
      interval.startDistance,
      interval.endDistance,
      false,
      tolerance,
      samplingOptions
    )
  )
}

const getStrokePathEndpointTangent = (path: Vec2[], atStart: boolean) => {
  if (path.length < 2) {
    return null
  }

  const endpointIndex = atStart ? 0 : path.length - 1
  const adjacentIndex = atStart ? 1 : path.length - 2
  return normalizeVector({
    x: path[endpointIndex].x - path[adjacentIndex].x,
    y: path[endpointIndex].y - path[adjacentIndex].y
  })
}

const buildCenterStrokeSquareCapPolygon = (
  endpoint: Vec2,
  tangentAwayFromBody: Vec2,
  strokeWidth: number
) => {
  const tangent = normalizeVector(tangentAwayFromBody)
  if (!tangent || strokeWidth <= EPSILON) {
    return []
  }
  const halfWidth = strokeWidth / 2
  const normal = { x: -tangent.y, y: tangent.x }
  const farPoint = {
    x: endpoint.x + tangent.x * halfWidth,
    y: endpoint.y + tangent.y * halfWidth
  }
  return cleanPolygon([
    {
      x: endpoint.x + normal.x * halfWidth,
      y: endpoint.y + normal.y * halfWidth
    },
    {
      x: endpoint.x - normal.x * halfWidth,
      y: endpoint.y - normal.y * halfWidth
    },
    {
      x: farPoint.x - normal.x * halfWidth,
      y: farPoint.y - normal.y * halfWidth
    },
    {
      x: farPoint.x + normal.x * halfWidth,
      y: farPoint.y + normal.y * halfWidth
    }
  ])
}

const buildCenterStrokeRoundCapPolygon = (
  endpoint: Vec2,
  tangentAwayFromBody: Vec2,
  strokeWidth: number
) => {
  const tangent = normalizeVector(tangentAwayFromBody)
  if (!tangent || strokeWidth <= EPSILON) {
    return []
  }
  const radius = strokeWidth / 2
  const normal = { x: -tangent.y, y: tangent.x }
  const segmentCount = Math.max(
    8,
    Math.ceil(
      Math.PI / Math.max(Math.PI / 24, ROUND_CAP_VISUAL_MAX_LENGTH / radius)
    )
  )
  const points = getRoundCapUnitSemicircle(segmentCount).map(({ cos, sin }) =>
    normalizePoint({
      x: endpoint.x + normal.x * radius * cos + tangent.x * radius * sin,
      y: endpoint.y + normal.y * radius * cos + tangent.y * radius * sin
    })
  )
  return cleanPolygon(points)
}

const buildCenterStrokeEndpointCapPolygon = (
  path: Vec2[],
  atStart: boolean,
  cap: RenderableStroke['cap'],
  strokeWidth: number
) => {
  if (cap !== 'round' && cap !== 'square') {
    return []
  }
  const endpoint = path[atStart ? 0 : path.length - 1]
  const tangentAwayFromBody = getStrokePathEndpointTangent(path, atStart)
  if (!endpoint || !tangentAwayFromBody) {
    return []
  }
  return cap === 'round'
    ? buildCenterStrokeRoundCapPolygon(
        endpoint,
        tangentAwayFromBody,
        strokeWidth
      )
    : buildCenterStrokeSquareCapPolygon(
        endpoint,
        tangentAwayFromBody,
        strokeWidth
      )
}

const buildConstrainedDashedTerminalCapPolygons = (
  strokePath: Vec2[],
  terminalRole: VisibleDashedTopologyInterval['domainPlanTerminalRole'],
  cap: RenderableStroke['cap'],
  strokeWidth: number
) => {
  if (terminalRole === 'middle' || terminalRole === undefined) {
    return []
  }

  const capPolygons: Vec2[][] = []
  if (terminalRole === 'end') {
    capPolygons.push(
      buildCenterStrokeEndpointCapPolygon(strokePath, true, cap, strokeWidth)
    )
  }
  if (terminalRole === 'start') {
    capPolygons.push(
      buildCenterStrokeEndpointCapPolygon(strokePath, false, cap, strokeWidth)
    )
  }

  return capPolygons.filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
}

const buildCollinearButtCenterStrokePolygon = (
  strokePath: Vec2[],
  strokeWidth: number
) => {
  if (strokePath.length < 2) {
    return null
  }
  const start = strokePath[0]
  const end = strokePath[strokePath.length - 1]
  if (!start || !end) {
    return null
  }
  const tangent = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y
  })
  if (!tangent) {
    return null
  }
  for (let index = 1; index < strokePath.length - 1; index += 1) {
    const point = strokePath[index]
    const relative = {
      x: point.x - start.x,
      y: point.y - start.y
    }
    const cross = Math.abs(relative.x * tangent.y - relative.y * tangent.x)
    if (cross > 1e-4) {
      return null
    }
  }
  const halfWidth = strokeWidth / 2
  const normal = {
    x: -tangent.y,
    y: tangent.x
  }
  return [
    {
      x: start.x + normal.x * halfWidth,
      y: start.y + normal.y * halfWidth
    },
    {
      x: end.x + normal.x * halfWidth,
      y: end.y + normal.y * halfWidth
    },
    {
      x: end.x - normal.x * halfWidth,
      y: end.y - normal.y * halfWidth
    },
    {
      x: start.x - normal.x * halfWidth,
      y: start.y - normal.y * halfWidth
    }
  ]
}

const buildTwoPointCenterStrokeDescriptorProductPolygons = (
  strokePath: Vec2[],
  stroke: Pick<RenderableStroke, 'cap'>,
  strokeWidth: number
) => {
  if (strokePath.length !== 2 || strokeWidth <= EPSILON) {
    return null
  }

  const start = strokePath[0]
  const end = strokePath[1]
  const tangent = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y
  })
  if (!tangent) {
    return null
  }

  const halfWidth = strokeWidth / 2
  const normal = {
    x: -tangent.y,
    y: tangent.x
  }
  const bodyStart =
    stroke.cap === 'square'
      ? {
          x: start.x - tangent.x * halfWidth,
          y: start.y - tangent.y * halfWidth
        }
      : start
  const bodyEnd =
    stroke.cap === 'square'
      ? {
          x: end.x + tangent.x * halfWidth,
          y: end.y + tangent.y * halfWidth
        }
      : end
  const bodyPolygon = [
    {
      x: bodyStart.x + normal.x * halfWidth,
      y: bodyStart.y + normal.y * halfWidth
    },
    {
      x: bodyEnd.x + normal.x * halfWidth,
      y: bodyEnd.y + normal.y * halfWidth
    },
    {
      x: bodyEnd.x - normal.x * halfWidth,
      y: bodyEnd.y - normal.y * halfWidth
    },
    {
      x: bodyStart.x - normal.x * halfWidth,
      y: bodyStart.y - normal.y * halfWidth
    }
  ]

  if (stroke.cap !== 'round') {
    return [bodyPolygon].filter(hasPolygonGeometry)
  }

  const startCap = cleanPolygon(
    buildRoundStrokeArcPointsBetween(
      start,
      {
        x: start.x + normal.x * halfWidth,
        y: start.y + normal.y * halfWidth
      },
      {
        x: start.x - normal.x * halfWidth,
        y: start.y - normal.y * halfWidth
      },
      1,
      2,
      ROUND_STROKE_CAP_ARC_SAMPLING
    )
  )
  const endCap = cleanPolygon(
    buildRoundStrokeArcPointsBetween(
      end,
      {
        x: end.x - normal.x * halfWidth,
        y: end.y - normal.y * halfWidth
      },
      {
        x: end.x + normal.x * halfWidth,
        y: end.y + normal.y * halfWidth
      },
      1,
      2,
      ROUND_STROKE_CAP_ARC_SAMPLING
    )
  )

  return [bodyPolygon, startCap, endCap].filter(hasPolygonGeometry)
}

const buildCenterStrokeDescriptorProductPolygons = (
  middleStrokePaths: Vec2[][],
  terminalBodyStrokePaths: Vec2[][],
  terminalCapPolygons: Vec2[][],
  stroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>,
  strokeWidth: number
) => {
  const buildPathPolygons = (
    strokePath: Vec2[],
    pathStroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>
  ) => {
    const origin = strokePath[0]
    if (!origin) {
      return []
    }
    const cacheKey = buildCenterStrokeDescriptorProductPolygonCacheKey(
      strokePath,
      origin,
      pathStroke,
      strokeWidth
    )
    const cached = getCachedCenterStrokeDescriptorProductPolygons(
      cacheKey,
      origin
    )
    if (cached) {
      return cached
    }
    const twoPointPolygons = buildTwoPointCenterStrokeDescriptorProductPolygons(
      strokePath,
      pathStroke,
      strokeWidth
    )
    const collinearButtPolygon =
      !twoPointPolygons && pathStroke.cap === 'butt'
        ? buildCollinearButtCenterStrokePolygon(strokePath, strokeWidth)
        : null
    const polygons =
      twoPointPolygons ??
      (collinearButtPolygon
        ? [cleanPolygon(collinearButtPolygon)].filter(hasPolygonGeometry)
        : buildSolidCenterStrokePolygons(strokePath, false, {
            style: 'solid',
            position: 'center',
            width: strokeWidth,
            cap: pathStroke.cap,
            join: pathStroke.join,
            miterLimit: pathStroke.miterLimit
          })
            .map(cleanPolygon)
            .filter(hasPolygonGeometry))
    setCachedCenterStrokeDescriptorProductPolygons(cacheKey, origin, polygons)
    return polygons
  }

  const productPolygons: Vec2[][] = []
  const appendPathPolygons = (
    strokePaths: Vec2[][],
    pathStroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>
  ) => {
    for (const strokePath of strokePaths) {
      for (const polygon of buildPathPolygons(strokePath, pathStroke)) {
        productPolygons.push(polygon)
      }
    }
  }

  appendPathPolygons(middleStrokePaths, stroke)
  appendPathPolygons(terminalBodyStrokePaths, { ...stroke, cap: 'butt' })
  for (const polygon of terminalCapPolygons) {
    productPolygons.push(polygon)
  }

  return productPolygons
}

const excludeDescriptorProductPolygons = (
  productPolygons: Vec2[][],
  excludePolygons: Vec2[][],
  excludeRegions?: PolygonRegion[]
) => {
  if (productPolygons.length === 0) {
    return []
  }
  if (excludePolygons.length === 0) {
    return productPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.difference) {
      return []
    }
    const clipRegions =
      excludeRegions && excludeRegions.length > 0
        ? excludeRegions
        : toCoveragePolygonRegions(excludePolygons)
    const subjectRegions = [
      {
        polygons: normalizeCoveragePolygonsWinding(productPolygons)
      }
    ]
    return cleanClippedProductPolygons(
      getCoveragePolygonsFromRegions(
        backend.difference(subjectRegions, clipRegions, 'nonzero')
      )
    )
  } catch {
    emitStrokePipelineCounter('outside-aggregate-descriptor-product-error')
    return []
  }
}

interface DashedAggregateDescriptorItem {
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
  interval: Pick<
    DashedTopologyInterval,
    'startDistance' | 'endDistance' | 'wrapsSeam'
  > & {
    domainPlanTerminalRole?: VisibleDashedTopologyInterval['domainPlanTerminalRole']
  }
  slicingContext?: SourcePathSlicingContext
  selectedSide?: 1 | -1
}

interface DashedAggregateDescriptorProduct {
  polygons: Vec2[][]
  strokePaths: Vec2[][]
  bounds: Bounds
  productArea: number
  renderDescriptor: SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor']
}

const getAggregateDescriptorProductOrigin = (
  items: DashedAggregateDescriptorItem[],
  clipPolygons: Vec2[][]
): Vec2 | null => {
  const firstPathOrigin = items[0]
    ? getPathTranslationCacheOrigin(items[0].path)
    : null
  if (firstPathOrigin) {
    return firstPathOrigin
  }

  return clipPolygons[0]?.[0] ?? null
}

const buildInsideAggregateDescriptorProductCacheKey = (
  stroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>,
  strokeWidth: number,
  precomputedProductSignature: string
): string => {
  return [
    'inside-aggregate-descriptor',
    precomputedProductSignature,
    formatTranslationInvariantCacheNumber(strokeWidth),
    stroke.cap,
    stroke.join,
    formatTranslationInvariantCacheNumber(stroke.miterLimit)
  ].join('|')
}

const getCachedInsideAggregateDescriptorProduct = (
  cacheKey: string,
  origin: Vec2
): DashedAggregateDescriptorProduct | null => {
  const cached = insideAggregateDescriptorProductCache.get(cacheKey)
  if (!cached) {
    emitStrokePipelineCounter('inside-aggregate-descriptor-product-cache-miss')
    return null
  }

  emitStrokePipelineCounter('inside-aggregate-descriptor-product-cache-hit')
  if (cached.origin.x === origin.x && cached.origin.y === origin.y) {
    return {
      polygons: cached.absolutePolygons,
      strokePaths: cached.absoluteStrokePaths,
      bounds: cached.bounds,
      productArea: cached.productArea,
      renderDescriptor: cached.renderDescriptor
    }
  }

  cached.polygons ??= toRelativePolygons(cached.absolutePolygons, cached.origin)
  cached.strokePaths ??= toRelativePolygons(
    cached.absoluteStrokePaths,
    cached.origin
  )
  const dx = origin.x - cached.origin.x
  const dy = origin.y - cached.origin.y
  return {
    polygons: fromRelativePolygons(cached.polygons, origin),
    strokePaths: fromRelativePolygons(cached.strokePaths, origin),
    bounds: translateBoundsByDelta(cached.bounds, dx, dy) ?? cached.bounds,
    productArea: cached.productArea,
    renderDescriptor: translateRenderDescriptorByDelta(
      cached.renderDescriptor,
      dx,
      dy
    )
  }
}

const setCachedInsideAggregateDescriptorProduct = (
  cacheKey: string,
  origin: Vec2,
  product: DashedAggregateDescriptorProduct
) => {
  insideAggregateDescriptorProductCache.set(cacheKey, {
    origin,
    absolutePolygons: product.polygons,
    absoluteStrokePaths: product.strokePaths,
    bounds: product.bounds,
    productArea: product.productArea,
    renderDescriptor: product.renderDescriptor
  })
  if (
    insideAggregateDescriptorProductCache.size >
    INSIDE_AGGREGATE_DESCRIPTOR_PRODUCT_CACHE_LIMIT
  ) {
    const [oldestKey] = insideAggregateDescriptorProductCache.keys()
    if (oldestKey) {
      insideAggregateDescriptorProductCache.delete(oldestKey)
    }
  }
}

const joinTouchingDescriptorStrokePaths = (
  strokePaths: Vec2[][],
  tolerance = SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE
) => {
  const paths = strokePaths
    .filter((path) => path.length >= 2)
    .map((path) => path.map((point) => ({ ...point })))
  if (paths.length <= 1) {
    return paths
  }

  const getBucketCoordinate = (value: number) =>
    Math.floor(value / Math.max(tolerance, EPSILON))
  const getBucketKey = (point: Vec2) =>
    `${getBucketCoordinate(point.x)}:${getBucketCoordinate(point.y)}`
  const getNearbyBucketKeys = (point: Vec2) => {
    const x = getBucketCoordinate(point.x)
    const y = getBucketCoordinate(point.y)
    const keys: string[] = []
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        keys.push(`${x + offsetX}:${y + offsetY}`)
      }
    }
    return keys
  }
  const startBuckets = new Map<string, number[]>()
  const endBuckets = new Map<string, number[]>()
  paths.forEach((path, index) => {
    const start = path[0]
    const end = path[path.length - 1]
    if (!start || !end) {
      return
    }
    const startKey = getBucketKey(start)
    const endKey = getBucketKey(end)
    startBuckets.set(startKey, [...(startBuckets.get(startKey) ?? []), index])
    endBuckets.set(endKey, [...(endBuckets.get(endKey) ?? []), index])
  })

  const consumed = new Set<number>()
  const joined: Vec2[][] = []
  const findCandidate = (
    point: Vec2,
    buckets: Map<string, number[]>
  ): number | null => {
    for (const key of getNearbyBucketKeys(point)) {
      const indexes = buckets.get(key) ?? []
      for (const index of indexes) {
        if (consumed.has(index)) {
          continue
        }
        const candidate = paths[index]
        const start = candidate?.[0]
        const end = candidate?.[candidate.length - 1]
        if (
          candidate &&
          ((buckets === startBuckets &&
            start &&
            distanceBetween(point, start) <= tolerance) ||
            (buckets === endBuckets &&
              end &&
              distanceBetween(point, end) <= tolerance))
        ) {
          return index
        }
      }
    }
    return null
  }

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    if (consumed.has(pathIndex)) {
      continue
    }
    const current = paths[pathIndex]
    if (!current) {
      continue
    }
    consumed.add(pathIndex)

    let changed = true
    while (changed) {
      changed = false
      const currentStart = () => current[0]
      const currentEnd = () => current[current.length - 1]
      const start = currentStart()
      const end = currentEnd()
      if (!start || !end) {
        break
      }

      const endStartCandidate = findCandidate(end, startBuckets)
      if (endStartCandidate !== null) {
        const candidate = paths[endStartCandidate]
        current.push(...candidate.slice(1))
        consumed.add(endStartCandidate)
        changed = true
        continue
      }

      const startEndCandidate = findCandidate(start, endBuckets)
      if (startEndCandidate !== null) {
        const candidate = paths[startEndCandidate]
        current.unshift(...candidate.slice(0, -1))
        consumed.add(startEndCandidate)
        changed = true
        continue
      }

      const startStartCandidate = findCandidate(start, startBuckets)
      if (startStartCandidate !== null) {
        const candidate = paths[startStartCandidate]
        current.unshift(...candidate.slice(1).reverse())
        consumed.add(startStartCandidate)
        changed = true
        continue
      }

      const endEndCandidate = findCandidate(end, endBuckets)
      if (endEndCandidate !== null) {
        const candidate = paths[endEndCandidate]
        current.push(...candidate.slice(0, -1).reverse())
        consumed.add(endEndCandidate)
        changed = true
      }
    }

    joined.push(current)
  }

  return joined
}

const buildInsideDashedAggregateDescriptorProduct = (
  items: DashedAggregateDescriptorItem[],
  stroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>,
  strokeWidth: number,
  clipPolygons: Vec2[][],
  precomputedProductSignature?: string
): DashedAggregateDescriptorProduct | null => {
  if (clipPolygons.length === 0 || items.length === 0) {
    return null
  }

  const cacheOrigin = precomputedProductSignature
    ? getAggregateDescriptorProductOrigin(items, clipPolygons)
    : null
  const cacheKey =
    cacheOrigin && precomputedProductSignature
      ? buildInsideAggregateDescriptorProductCacheKey(
          stroke,
          strokeWidth,
          precomputedProductSignature
        )
      : null
  if (cacheKey && cacheOrigin) {
    const cachedProduct = getCachedInsideAggregateDescriptorProduct(
      cacheKey,
      cacheOrigin
    )
    if (cachedProduct) {
      return cachedProduct
    }
  }

  const middleStrokePaths: Vec2[][] = []
  const terminalBodyStrokePaths: Vec2[][] = []
  const terminalCapPolygons: Vec2[][] = []

  items.forEach((item) => {
    const strokePath = sliceIntervalStrokePathPoints(
      item.path,
      item.interval,
      item.slicingContext
    )
    if (strokePath.length < 2) {
      return
    }

    const terminalRole = item.interval.domainPlanTerminalRole ?? 'middle'
    if (terminalRole === 'middle') {
      middleStrokePaths.push(strokePath)
      return
    }

    terminalBodyStrokePaths.push(strokePath)
    terminalCapPolygons.push(
      ...buildConstrainedDashedTerminalCapPolygons(
        strokePath,
        terminalRole,
        stroke.cap,
        strokeWidth
      )
    )
  })
  const joinedTerminalBodyStrokePaths = joinTouchingDescriptorStrokePaths(
    terminalBodyStrokePaths
  )
  const strokePaths = [...middleStrokePaths, ...joinedTerminalBodyStrokePaths]
  const strokeMaskPolygons = terminalCapPolygons
  if (strokePaths.length === 0) {
    return null
  }

  const productPolygons = buildCenterStrokeDescriptorProductPolygons(
    middleStrokePaths,
    joinedTerminalBodyStrokePaths,
    strokeMaskPolygons,
    stroke,
    strokeWidth
  )
  if (productPolygons.length === 0) {
    return null
  }
  const { bounds: productBounds, productArea } =
    getPolygonsBoundsAndAbsoluteArea(productPolygons)

  const product = {
    polygons: productPolygons,
    strokePaths,
    bounds: productBounds,
    productArea,
    renderDescriptor: {
      descriptorProductPolygons: productPolygons,
      fillClipPolygons: clipPolygons,
      strokeMaskPolygons,
      strokePathGroups: [
        ...(middleStrokePaths.length > 0
          ? [
              {
                strokePaths: middleStrokePaths,
                strokePathStyle: {
                  width: strokeWidth,
                  cap: stroke.cap,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  closed: false
                }
              }
            ]
          : []),
        ...(joinedTerminalBodyStrokePaths.length > 0
          ? [
              {
                strokePaths: joinedTerminalBodyStrokePaths,
                strokePathStyle: {
                  width: strokeWidth,
                  cap: 'butt' as const,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  closed: false
                }
              }
            ]
          : [])
      ]
    }
  }

  if (cacheKey && cacheOrigin) {
    setCachedInsideAggregateDescriptorProduct(cacheKey, cacheOrigin, product)
  }

  return product
}

const buildOutsideDashedAggregateDescriptorProduct = (
  items: DashedAggregateDescriptorItem[],
  stroke: Pick<RenderableStroke, 'cap' | 'join' | 'miterLimit'>,
  strokeWidth: number,
  excludePolygons: Vec2[][],
  excludeRegions?: PolygonRegion[]
): {
  polygons: Vec2[][]
  strokePaths: Vec2[][]
  renderDescriptor: SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor']
} | null => {
  if (excludePolygons.length === 0 || items.length === 0) {
    return null
  }

  const middleDescriptorItems = measureStrokePipelinePhase(
    'constrained dashed packets: outside aggregate descriptor slice paths',
    () => {
      const descriptorItems: {
        strokePath: Vec2[]
        selectedSide?: 1 | -1
      }[] = []
      items.forEach((item) => {
        const strokePath = sliceIntervalStrokePathPoints(
          item.path,
          item.interval,
          item.slicingContext
        )
        if (strokePath.length < 2) {
          return
        }

        descriptorItems.push({
          strokePath,
          selectedSide: item.selectedSide
        })
      })
      return descriptorItems
    }
  )
  const middleStrokePaths = middleDescriptorItems.map((item) => item.strokePath)
  const strokePaths = middleStrokePaths
  if (strokePaths.length === 0) {
    return null
  }

  const canBuildSelectedSideProduct = middleDescriptorItems.every(
    (item) => item.selectedSide === 1 || item.selectedSide === -1
  )
  const selectedSideProductPolygons = canBuildSelectedSideProduct
    ? measureStrokePipelinePhase(
        'constrained dashed packets: outside aggregate descriptor selected-side polygons',
        () => {
          const clippedPolygons = middleDescriptorItems.flatMap((item) => {
            const selectedSide = item.selectedSide
            if (selectedSide !== 1 && selectedSide !== -1) {
              return []
            }
            return buildCenterStrokeDescriptorProductPolygons(
              [item.strokePath],
              [],
              [],
              stroke,
              strokeWidth
            ).flatMap((polygon) => {
              const clipped = clipPolygonToSelectedSideBoundaryOrDropRejected(
                polygon,
                item.strokePath,
                selectedSide
              )
              return clipped.length >= 3 ? [clipped] : []
            })
          })
          return measureStrokePipelinePhase(
            'constrained dashed packets: outside aggregate descriptor selected-side normalize',
            () =>
              normalizeConstrainedDashedProductPolygons(clippedPolygons, {
                cleanClipResidue: true,
                mergeContinuousInterval: true
              })
          )
        }
      )
    : null
  const productPolygons = canBuildSelectedSideProduct
    ? (selectedSideProductPolygons ?? [])
    : measureStrokePipelinePhase(
        'constrained dashed packets: outside aggregate descriptor exclude polygons',
        () =>
          excludeDescriptorProductPolygons(
            measureStrokePipelinePhase(
              'constrained dashed packets: outside aggregate descriptor center polygons',
              () =>
                buildCenterStrokeDescriptorProductPolygons(
                  middleStrokePaths,
                  [],
                  [],
                  stroke,
                  strokeWidth
                )
            ),
            excludePolygons,
            excludeRegions
          )
      )
  if (productPolygons.length === 0) {
    return null
  }

  return {
    polygons: productPolygons,
    strokePaths,
    renderDescriptor: {
      fillExcludePolygons: excludePolygons,
      strokePathGroups: [
        ...(middleStrokePaths.length > 0
          ? [
              {
                strokePaths: middleStrokePaths,
                strokePathStyle: {
                  width: strokeWidth,
                  cap: stroke.cap,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  closed: false
                }
              }
            ]
          : [])
      ]
    }
  }
}

const SOURCE_PATH_SMOOTH_BOUNDARY_DOT_MIN = Math.cos(Math.PI / 36)

const getSourceSegmentStartTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  const derivative = segment.curve.derivative(0) as Vec2
  return (
    normalizeVector(derivative) ??
    normalizeVector({
      x: segment.control1.x - segment.start.x,
      y: segment.control1.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const getSourceSegmentEndTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  const derivative = segment.curve.derivative(1) as Vec2
  return (
    normalizeVector(derivative) ??
    normalizeVector({
      x: segment.end.x - segment.control2.x,
      y: segment.end.y - segment.control2.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const isSourceBoundarySmooth = (
  path: Pick<PathGeometry, 'segments'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  const previous = path.segments[previousSegmentIndex]
  const next = path.segments[nextSegmentIndex]
  if (!previous || !next) {
    return false
  }

  if (previous.endAnchorType === 'sharp' || next.startAnchorType === 'sharp') {
    return false
  }

  const previousTangent = getSourceSegmentEndTangent(previous)
  const nextTangent = getSourceSegmentStartTangent(next)
  if (!previousTangent || !nextTangent) {
    return false
  }

  return (
    previousTangent.x * nextTangent.x + previousTangent.y * nextTangent.y >=
    SOURCE_PATH_SMOOTH_BOUNDARY_DOT_MIN
  )
}

const isAuthoredSourceBoundarySmooth = (
  path: Pick<PathGeometry, 'segments'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  const previous = path.segments[previousSegmentIndex]
  const next = path.segments[nextSegmentIndex]
  return (
    previous?.endAnchorType === 'smooth' && next?.startAnchorType === 'smooth'
  )
}

const canOverlapAcrossSourceRangeStart = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  range: SourceSegmentIntervalRange,
  segmentRanges: SourcePathSegmentRange[]
) => {
  const segmentRange = segmentRanges[range.segmentIndex]
  if (
    !segmentRange ||
    Math.abs(range.startDistance - segmentRange.startDistance) > EPSILON
  ) {
    return true
  }

  const previousSegmentIndex =
    range.segmentIndex > 0
      ? range.segmentIndex - 1
      : path.closed
        ? path.segments.length - 1
        : null
  return previousSegmentIndex === null
    ? false
    : isSourceBoundarySmooth(path, previousSegmentIndex, range.segmentIndex)
}

const canOverlapAcrossSourceRangeEnd = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  range: SourceSegmentIntervalRange,
  segmentRanges: SourcePathSegmentRange[]
) => {
  const segmentRange = segmentRanges[range.segmentIndex]
  if (
    !segmentRange ||
    Math.abs(range.endDistance - segmentRange.endDistance) > EPSILON
  ) {
    return true
  }

  const nextSegmentIndex =
    range.segmentIndex < path.segments.length - 1
      ? range.segmentIndex + 1
      : path.closed
        ? 0
        : null
  return nextSegmentIndex === null
    ? false
    : isSourceBoundarySmooth(path, range.segmentIndex, nextSegmentIndex)
}

const buildOverlappedSourcePathRenderRange = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  span: ConstrainedDashedPhysicalSpan,
  stroke: Pick<RenderableStroke, 'width'>,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentIntervalRange => {
  const overlap = Math.min(
    SOURCE_PATH_DASH_SEGMENT_OVERLAP_MAX,
    Math.max(0, stroke.width * SOURCE_PATH_DASH_SEGMENT_OVERLAP_FACTOR)
  )
  if (overlap <= EPSILON) {
    return range
  }

  const startsAfterSpanStart =
    range.startDistance > span.startDistance + EPSILON
  const endsBeforeSpanEnd = range.endDistance < span.endDistance - EPSILON
  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const startDistance = startsAfterSpanStart
    ? canOverlapAcrossSourceRangeStart(path, range, segmentRanges)
      ? Math.max(0, range.startDistance - overlap)
      : range.startDistance
    : range.startDistance
  const endDistance = endsBeforeSpanEnd
    ? canOverlapAcrossSourceRangeEnd(path, range, segmentRanges)
      ? Math.min(path.totalLength, range.endDistance + overlap)
      : range.endDistance
    : range.endDistance

  return startDistance !== range.startDistance ||
    endDistance !== range.endDistance
    ? {
        ...range,
        startDistance,
        endDistance
      }
    : range
}

const isSourcePathRangeAtPhysicalSpanStart = (
  range: SourceSegmentIntervalRange,
  span: Pick<ConstrainedDashedPhysicalSpan, 'startDistance'>,
  totalLength: number
) => areLoopDistancesEqual(range.startDistance, span.startDistance, totalLength)

const isSourcePathRangeAtPhysicalSpanEnd = (
  range: SourceSegmentIntervalRange,
  span: Pick<ConstrainedDashedPhysicalSpan, 'endDistance'>,
  totalLength: number
) => areLoopDistancesEqual(range.endDistance, span.endDistance, totalLength)

interface SourcePathRangeCapMaterialization {
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
  roundCapStart: boolean | undefined
  roundCapEnd: boolean | undefined
  squareCapStart: boolean | undefined
  squareCapEnd: boolean | undefined
}

const getSourcePathRangeCapMaterialization = (
  rangeEndpointCapPolicy: DashEndpointCapPolicy,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
): SourcePathRangeCapMaterialization => {
  if (stroke.cap !== 'round' && stroke.cap !== 'square') {
    return {
      stroke,
      roundCapStart: undefined,
      roundCapEnd: undefined,
      squareCapStart: undefined,
      squareCapEnd: undefined
    }
  }

  const capStart = rangeEndpointCapPolicy.startCap
  const capEnd = rangeEndpointCapPolicy.endCap

  if (stroke.cap === 'square') {
    return {
      stroke: {
        ...stroke,
        cap: 'butt' as const
      },
      roundCapStart: false,
      roundCapEnd: false,
      squareCapStart: capStart,
      squareCapEnd: capEnd
    }
  }

  return {
    stroke:
      capStart || capEnd
        ? stroke
        : {
            ...stroke,
            cap: 'butt' as const
          },
    roundCapStart: capStart,
    roundCapEnd: capEnd,
    squareCapStart: false,
    squareCapEnd: false
  }
}

const buildDashedSourcePathIntervalSweep = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'domainPlanSplitRangeId'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'domainPlanTerminalRole'
    | 'domainPlanSelectedSide'
    | 'domainPlanBoundaryRole'
    | 'domainPlanDomainMode'
    | 'domainPlanSideResolutionStatus'
    | 'domainPlanSideResolutionReason'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanBoundaryStartDistance'
    | 'domainPlanBoundaryEndDistance'
    | 'domainPlanBoundaryTotalLength'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext?: SourcePathSlicingContext
): DashedSourcePathIntervalSweep => {
  emitStrokePipelineCounter('interval-sweep-count')
  const ranges: DashedSourcePathIntervalSweepRange[] = []
  const endpointCapPolicy = getDashEndpointCapPolicy(path, interval)

  physicalSpans.forEach((span) => {
    const sourceRanges = splitVisibleIntervalBySourceSegments(
      path,
      span,
      slicingContext
    )
    sourceRanges.forEach((range) => {
      const rangeEndpointCapPolicy = getEffectiveRangeEndpointCapPolicy(
        path,
        range,
        span,
        endpointCapPolicy
      )
      const renderRange = buildOverlappedSourcePathRenderRange(
        path,
        range,
        span,
        stroke,
        slicingContext
      )
      ranges.push({
        range,
        span,
        renderRange,
        endpointCapPolicy,
        rangeEndpointCapPolicy
      })
    })
  })

  return {
    ranges,
    endpointCapPolicy,
    smoothContinuityGroup: {
      groupId: [
        interval.intervalId,
        endpointCapPolicy.signature,
        interval.domainPlanSplitRangeId ?? 'source-range',
        interval.domainPlanBoundaryRole ?? 'source-boundary'
      ].join('|'),
      intervalId: interval.intervalId,
      startDistance: interval.startDistance,
      endDistance: interval.endDistance,
      wrapsSeam: interval.wrapsSeam
    }
  }
}

const countTerminalCapsInIntervalSweep = (
  intervalSweep: DashedSourcePathIntervalSweep
) =>
  intervalSweep.ranges.reduce(
    (count, { rangeEndpointCapPolicy }) =>
      count +
      (rangeEndpointCapPolicy.startCap === true ? 1 : 0) +
      (rangeEndpointCapPolicy.endCap === true ? 1 : 0),
    0
  )

const getTerminalRoleFromCapPolicy = (
  suppressStartCap: boolean,
  suppressEndCap: boolean
): DashEndpointCapPolicy['terminalRole'] =>
  suppressStartCap && suppressEndCap
    ? 'start-end'
    : suppressStartCap
      ? 'start'
      : suppressEndCap
        ? 'end'
        : 'middle'

const createDashEndpointCapPolicy = (
  suppressStartCap: boolean,
  suppressEndCap: boolean,
  startCap: boolean,
  endCap: boolean
): DashEndpointCapPolicy => {
  const terminalRole = getTerminalRoleFromCapPolicy(
    suppressStartCap,
    suppressEndCap
  )
  return {
    terminalRole,
    suppressStartCap,
    suppressEndCap,
    startCap,
    endCap,
    signature: `${terminalRole}:${startCap ? 'start-cap' : 'start-flat'}:${
      endCap ? 'end-cap' : 'end-flat'
    }`
  }
}

const getSweepRangeGroupEndpointCapPolicy = (
  ranges: DashedSourcePathIntervalSweepRange[]
): DashEndpointCapPolicy | null => {
  const firstRange = ranges[0]
  const lastRange = ranges[ranges.length - 1]
  if (!firstRange || !lastRange) {
    return null
  }

  return createDashEndpointCapPolicy(
    firstRange.rangeEndpointCapPolicy.suppressStartCap,
    lastRange.rangeEndpointCapPolicy.suppressEndCap,
    firstRange.rangeEndpointCapPolicy.startCap,
    lastRange.rangeEndpointCapPolicy.endCap
  )
}

const groupSweepRangesByPhysicalSpan = (
  ranges: DashedSourcePathIntervalSweepRange[]
) => {
  const groups: DashedSourcePathIntervalSweepRange[][] = []
  ranges.forEach((range) => {
    const currentGroup = groups[groups.length - 1]
    if (
      currentGroup &&
      currentGroup[currentGroup.length - 1]?.span.spanId === range.span.spanId
    ) {
      currentGroup.push(range)
      return
    }
    groups.push([range])
  })
  return groups
}

const getConstrainedRibbonOffsetDistance = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => (stroke.position === 'inside' ? stroke.width : -stroke.width)

const ROUND_CAP_VISUAL_MAX_LENGTH = 0.35
const roundCapUnitSemicircleCache = new Map<
  number,
  { cos: number; sin: number }[]
>()

const getRoundCapUnitSemicircle = (segmentCount: number) => {
  const cached = roundCapUnitSemicircleCache.get(segmentCount)
  if (cached) {
    return cached
  }

  const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const angle = (Math.PI * index) / segmentCount
    return {
      cos: Math.cos(angle),
      sin: Math.sin(angle)
    }
  })
  roundCapUnitSemicircleCache.set(segmentCount, points)
  return points
}

const buildOneSidedRibbonRoundCap = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  maxArcLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  const center = {
    x: (endpoint.x + offsetEndpoint.x) / 2,
    y: (endpoint.y + offsetEndpoint.y) / 2
  }
  const radius = distanceBetween(endpoint, offsetEndpoint) / 2
  if (radius <= EPSILON) {
    return []
  }

  const side = normalizeVector({
    x: endpoint.x - center.x,
    y: endpoint.y - center.y
  })
  const bulgeDirection = normalizeVector(
    isStart ? { x: -tangent.x, y: -tangent.y } : tangent
  )
  if (!side || !bulgeDirection) {
    return []
  }

  const segmentCount = Math.max(3, Math.ceil((Math.PI * radius) / maxArcLength))
  return getRoundCapUnitSemicircle(segmentCount).map(({ cos, sin }) =>
    normalizePoint({
      x: center.x + radius * (side.x * cos + bulgeDirection.x * sin),
      y: center.y + radius * (side.y * cos + bulgeDirection.y * sin)
    })
  )
}

const dedupeRibbonFrames = (frames: PathSampleFrame[]) => {
  if (frames.length <= 1) {
    return frames
  }

  const output = [frames[0]]
  for (let index = 1; index < frames.length; index += 1) {
    if (
      distanceBetween(output[output.length - 1].point, frames[index].point) >
      EPSILON
    ) {
      output.push(frames[index])
    }
  }
  return output
}

const dedupeOffsetRibbonFrames = (frames: OffsetPathSampleFrame[]) => {
  if (frames.length <= 1) {
    return frames
  }

  const output = [frames[0]]
  for (let index = 1; index < frames.length; index += 1) {
    if (
      distanceBetween(output[output.length - 1].point, frames[index].point) >
      EPSILON
    ) {
      output.push(frames[index])
    }
  }
  return output
}
const sliceExactLineRibbonSegmentFrames = (
  segment: Extract<PathSegment, { type: 'line' }>,
  localStartDistance: number,
  localEndDistance: number
): PathSampleFrame[] => {
  if (localEndDistance - localStartDistance <= EPSILON) {
    return []
  }

  const start = Math.max(0, Math.min(segment.length, localStartDistance))
  const end = Math.max(0, Math.min(segment.length, localEndDistance))
  if (end - start <= EPSILON) {
    return []
  }

  const tangent = getLineSegmentTangent(segment)
  return dedupeRibbonFrames([
    {
      point: interpolateLineSegmentPointAtDistance(segment, start),
      tangent
    },
    {
      point: interpolateLineSegmentPointAtDistance(segment, end),
      tangent
    }
  ])
}

const buildLineRibbonRangeCacheKey = (
  segmentIndex: number,
  localStartDistance: number,
  localEndDistance: number
) =>
  `${segmentIndex}:${formatSourcePathRangeKeyDistance(
    localStartDistance
  )}:${formatSourcePathRangeKeyDistance(localEndDistance)}`

const sliceExactLineRibbonSegmentFramesForContext = (
  segment: Extract<PathSegment, { type: 'line' }>,
  segmentIndex: number,
  localStartDistance: number,
  localEndDistance: number,
  slicingContext: SourcePathSlicingContext
): PathSampleFrame[] => {
  const cacheKey = buildLineRibbonRangeCacheKey(
    segmentIndex,
    localStartDistance,
    localEndDistance
  )
  const cached = slicingContext.exactLineRibbonRangeCache.get(cacheKey)
  if (cached) {
    emitStrokePipelineCounter('source-path-ribbon-line-segment-range-cache-hit')
    return cached
  }

  if (!slicingContext.exactLineRibbonRangeDirectCounterEmitted) {
    slicingContext.exactLineRibbonRangeDirectCounterEmitted = true
    emitStrokePipelineCounter('source-path-ribbon-line-segment-range-direct')
  }

  const frames = sliceExactLineRibbonSegmentFrames(
    segment,
    localStartDistance,
    localEndDistance
  )
  slicingContext.exactLineRibbonRangeCache.set(cacheKey, frames)
  return frames
}
const offsetLineRibbonFrame = (
  frame: PathSampleFrame,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): OffsetPathSampleFrame => {
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const point = normalizePoint(frame.point)
  const tangent = normalizeVector(frame.tangent) ?? frame.tangent
  return {
    point,
    tangent,
    offsetPoint: normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  }
}

const sliceExactOffsetLineRibbonSegmentFrames = (
  segment: Extract<PathSegment, { type: 'line' }>,
  segmentIndex: number,
  localStartDistance: number,
  localEndDistance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>,
  slicingContext: SourcePathSlicingContext
): OffsetPathSampleFrame[] => {
  const cacheKey = [
    buildLineRibbonRangeCacheKey(
      segmentIndex,
      localStartDistance,
      localEndDistance
    ),
    stroke.position,
    stroke.width.toFixed(4)
  ].join(':')
  const cached = slicingContext.exactOffsetLineRibbonRangeCache.get(cacheKey)
  if (cached) {
    emitStrokePipelineCounter(
      'source-path-ribbon-offset-line-segment-range-cache-hit'
    )
    return cached
  }

  const frames = dedupeOffsetRibbonFrames(
    sliceExactLineRibbonSegmentFramesForContext(
      segment,
      segmentIndex,
      localStartDistance,
      localEndDistance,
      slicingContext
    ).map((frame) => offsetLineRibbonFrame(frame, stroke))
  )
  slicingContext.exactOffsetLineRibbonRangeCache.set(cacheKey, frames)
  return frames
}

const sliceExactOffsetRibbonRangeFrames = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const segmentRanges = slicingContext.segmentRanges
  const baseRange = segmentRanges[range.segmentIndex]
  const ranges =
    baseRange &&
    range.startDistance >= baseRange.startDistance - EPSILON &&
    range.endDistance <= baseRange.endDistance + EPSILON
      ? [range]
      : splitSourcePathRangeBySegmentBoundaries(
          path,
          range.startDistance,
          range.endDistance,
          slicingContext
        )
  const frames: OffsetPathSampleFrame[] = []

  ranges.forEach((segmentRange) => {
    const currentBaseRange = segmentRanges[segmentRange.segmentIndex]
    const segment = path.segments[segmentRange.segmentIndex]
    if (!currentBaseRange || !segment) {
      return
    }
    const localStartDistance =
      segmentRange.startDistance - currentBaseRange.startDistance
    const localEndDistance =
      segmentRange.endDistance - currentBaseRange.startDistance
    const segmentFrames =
      segment.type === 'line'
        ? sliceExactOffsetLineRibbonSegmentFrames(
            segment,
            segmentRange.segmentIndex,
            localStartDistance,
            localEndDistance,
            stroke,
            slicingContext
          )
        : samplePathSegmentFramesByLengthStep(
            segment,
            localStartDistance,
            localEndDistance,
            SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
            SOURCE_PATH_RIBBON_FRAME_SAMPLING
          ).map((frame): OffsetPathSampleFrame => {
            const tangent = normalizeVector(frame.tangent) ?? frame.tangent
            const point = normalizePoint(frame.point)
            const offset = getConstrainedRibbonOffsetDistance(stroke)
            return {
              point,
              tangent,
              offsetPoint: normalizePoint({
                x: point.x - tangent.y * offset,
                y: point.y + tangent.x * offset
              })
            }
          })
    if (segmentFrames.length === 0) {
      return
    }
    const previous = frames[frames.length - 1]
    if (
      previous &&
      distanceBetween(previous.point, segmentFrames[0].point) <= EPSILON
    ) {
      frames.push(...segmentFrames.slice(1))
      return
    }
    frames.push(...segmentFrames)
  })

  return dedupeOffsetRibbonFrames(frames)
}
const cleanMergedRibbonPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 2) {
    return polygon
  }

  const deduped: Vec2[] = []
  for (const point of polygon) {
    const previous = deduped[deduped.length - 1]
    if (
      !previous ||
      (previous.x - point.x) * (previous.x - point.x) +
        (previous.y - point.y) * (previous.y - point.y) >
        EPSILON * EPSILON
    ) {
      deduped.push(point)
    }
  }

  if (
    deduped.length > 2 &&
    (deduped[0].x - deduped[deduped.length - 1].x) *
      (deduped[0].x - deduped[deduped.length - 1].x) +
      (deduped[0].y - deduped[deduped.length - 1].y) *
        (deduped[0].y - deduped[deduped.length - 1].y) <=
      EPSILON * EPSILON
  ) {
    deduped.pop()
  }

  return deduped
}
const buildExactSourcePathRibbonGeometryFromOffsetFrames = (
  frames: OffsetPathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  squareCapStart: boolean | undefined,
  squareCapEnd: boolean | undefined,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }

  const bodyPolygons = buildRibbonBodyPolygonsFromOffsetFrames(frames)

  const hasRoundCap =
    stroke.cap === 'round' && (roundCapStart === true || roundCapEnd === true)
  const hasSquareCap = squareCapStart === true || squareCapEnd === true

  if (!hasRoundCap && !hasSquareCap) {
    return {
      bodyPolygons,
      capPolygons: []
    }
  }

  const firstFrame = frames[0]
  const lastFrame = frames[frames.length - 1]
  const squareStartDirection =
    hasSquareCap && frames.length >= 2
      ? normalizeVector({
          x: frames[1].point.x - firstFrame.point.x,
          y: frames[1].point.y - firstFrame.point.y
        })
      : null
  const squareEndDirection =
    hasSquareCap && frames.length >= 2
      ? normalizeVector({
          x: lastFrame.point.x - frames[frames.length - 2].point.x,
          y: lastFrame.point.y - frames[frames.length - 2].point.y
        })
      : null
  const capPolygons = [
    ...(roundCapStart === true
      ? [
          cleanMergedRibbonPolygon(
            buildOneSidedRibbonRoundCap(
              normalizePoint(firstFrame.point),
              normalizePoint(firstFrame.offsetPoint),
              firstFrame.tangent,
              true,
              roundCapVisualMaxLength
            )
          )
        ]
      : []),
    ...(roundCapEnd === true
      ? [
          cleanMergedRibbonPolygon(
            buildOneSidedRibbonRoundCap(
              normalizePoint(lastFrame.point),
              normalizePoint(lastFrame.offsetPoint),
              lastFrame.tangent,
              false,
              roundCapVisualMaxLength
            )
          )
        ]
      : []),
    ...(squareCapStart === true
      ? [
          cleanMergedRibbonPolygon(
            buildSquareTerminalCapOverhangPolygon(
              normalizePoint(firstFrame.point),
              normalizePoint(firstFrame.offsetPoint),
              squareStartDirection ?? firstFrame.tangent,
              true,
              stroke.width
            )
          )
        ]
      : []),
    ...(squareCapEnd === true
      ? [
          cleanMergedRibbonPolygon(
            buildSquareTerminalCapOverhangPolygon(
              normalizePoint(lastFrame.point),
              normalizePoint(lastFrame.offsetPoint),
              squareEndDirection ?? lastFrame.tangent,
              false,
              stroke.width
            )
          )
        ]
      : [])
  ].filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )

  return {
    bodyPolygons,
    capPolygons
  }
}
const buildSquareTerminalCapOverhangPolygon = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  strokeWidth: number
) => {
  const direction = normalizeVector(tangent)
  const side = normalizeVector({
    x: offsetEndpoint.x - endpoint.x,
    y: offsetEndpoint.y - endpoint.y
  })
  if (!direction || !side || strokeWidth <= EPSILON) {
    return []
  }

  const capDistance = strokeWidth / 2
  const extension = isStart ? -capDistance : capDistance
  const translate = (point: Vec2) =>
    normalizePoint({
      x: point.x + direction.x * extension,
      y: point.y + direction.y * extension
    })

  return cleanMergedRibbonPolygon([
    endpoint,
    offsetEndpoint,
    translate(offsetEndpoint),
    translate(endpoint)
  ])
}

const toPositiveAreaRibbonPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 3) {
    return null
  }
  const area = polygonArea(polygon)
  if (Math.abs(area) <= EPSILON) {
    return null
  }
  return area < 0 ? [...polygon].reverse() : polygon
}

const buildSegmentedRibbonBodyPolygonsFromOffsetFrames = (
  frames: OffsetPathSampleFrame[]
) => {
  const polygons: Vec2[][] = []

  for (let index = 0; index < frames.length - 1; index += 1) {
    const current = frames[index]
    const next = frames[index + 1]
    if (!current || !next) {
      continue
    }

    const polygon = toPositiveAreaRibbonPolygon(
      cleanMergedRibbonPolygon([
        normalizePoint(current.point),
        normalizePoint(next.point),
        normalizePoint(next.offsetPoint),
        normalizePoint(current.offsetPoint)
      ])
    )
    if (polygon) {
      polygons.push(polygon)
    }
  }

  if (polygons.length === 0) {
    return []
  }

  emitStrokePipelineCounter('ribbon-body-segmented-materialization')
  return normalizeConstrainedDashedProductPolygons(polygons, {
    mergeContinuousInterval: true
  })
}

const buildRibbonBodyPolygonsFromOffsetFrames = (
  frames: OffsetPathSampleFrame[]
) => {
  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetPoints = frames.map((frame) => normalizePoint(frame.offsetPoint))
  const bodyPolygon = toPositiveAreaRibbonPolygon(
    cleanMergedRibbonPolygon([...source, ...offsetPoints.slice().reverse()])
  )
  if (bodyPolygon) {
    return [bodyPolygon]
  }

  return buildSegmentedRibbonBodyPolygonsFromOffsetFrames(frames)
}

const clipOutsidePolygonsToStrokeBoundaryDomains = (
  polygons: Vec2[][],
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[] = []
) => {
  if (polygons.length === 0 || sharedStrokeBoundaryDomains.length === 0) {
    return polygons
  }

  const boundaryDomains = sharedStrokeBoundaryDomains.filter(
    (domain) =>
      domain.outsideEligible &&
      domain.outsideSelectedSide !== null &&
      domain.boundaryPoints.length >= 2
  )
  if (boundaryDomains.length === 0) {
    return polygons
  }

  return polygons.flatMap((polygon) => {
    if (polygon.length < 3) {
      return []
    }

    const polygonBounds = getPolygonBounds(polygon)
    const overlappingDomains = boundaryDomains.filter((domain) =>
      boundsOverlapBounds(
        polygonBounds,
        getCachedPolylineBounds(domain.boundaryPoints)
      )
    )
    if (overlappingDomains.length === 0) {
      return [polygon]
    }

    const clippedPieces = overlappingDomains.flatMap((domain) => {
      const clipped = cleanClippedProductPolygon(
        clipPolygonToSelectedSideBoundaryOrDropRejected(
          polygon,
          domain.boundaryPoints,
          domain.outsideSelectedSide as 1 | -1
        )
      )
      return hasPolygonGeometry(clipped) ? [clipped] : []
    })

    return clippedPieces.length > 0 ? clippedPieces : []
  })
}

const clipBoundaryDomainIntervalPolygonsToOwnSelectedSide = (
  polygons: Vec2[][],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanBoundaryPoints'
    | 'domainPlanSelectedSide'
    | 'domainPlanBoundaryStartDistance'
    | 'domainPlanBoundaryEndDistance'
    | 'domainPlanBoundaryTotalLength'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
  >,
  endpointCapPolicy?: DashEndpointCapPolicy,
  stroke?: Pick<RenderableStroke, 'cap' | 'width'>
) => {
  const boundaryPoints = interval.domainPlanBoundaryPoints
  const selectedSide = getBoundaryDomainMaterializedSelectedSide(interval)
  if (
    polygons.length === 0 ||
    !boundaryPoints ||
    boundaryPoints.length < 2 ||
    (selectedSide !== 1 && selectedSide !== -1)
  ) {
    return polygons
  }
  const localBoundaryPath = buildBoundaryDomainPathForInterval(interval)
  const baseMaterializedInterval =
    localBoundaryPath !== null
      ? resolveBoundaryDomainIntervalForMaterialization(interval)
      : interval
  const terminalCapExtension =
    stroke && stroke.cap !== 'butt' ? Math.max(0, stroke.width * 0.5) : 0
  const startCapExtension =
    endpointCapPolicy?.startCap === true ? terminalCapExtension : 0
  const endCapExtension =
    endpointCapPolicy?.endCap === true ? terminalCapExtension : 0
  const localBoundaryTotalLength =
    localBoundaryPath?.totalLength ?? interval.domainPlanBoundaryTotalLength
  const materializedInterval =
    localBoundaryPath !== null &&
    localBoundaryTotalLength !== undefined &&
    (startCapExtension > 0 || endCapExtension > 0)
      ? {
          ...baseMaterializedInterval,
          startDistance: Math.max(
            0,
            baseMaterializedInterval.startDistance - startCapExtension
          ),
          endDistance: Math.min(
            localBoundaryTotalLength,
            baseMaterializedInterval.endDistance + endCapExtension
          ),
          wrapsSeam: false
        }
      : baseMaterializedInterval
  const localBoundaryPoints =
    localBoundaryPath !== null
      ? slicePathGeometryPoints(
          localBoundaryPath,
          materializedInterval.startDistance,
          materializedInterval.endDistance,
          false,
          0.5
        )
      : null
  const extendedBoundaryPoints =
    localBoundaryPoints === null &&
    boundaryPoints.length >= 2 &&
    (startCapExtension > 0 || endCapExtension > 0)
      ? (() => {
          const first = boundaryPoints[0]
          const second = boundaryPoints[1]
          const last = boundaryPoints[boundaryPoints.length - 1]
          const previous = boundaryPoints[boundaryPoints.length - 2]
          if (!first || !second || !last || !previous) {
            return boundaryPoints
          }
          const startDirection = normalizeVector({
            x: second.x - first.x,
            y: second.y - first.y
          })
          const endDirection = normalizeVector({
            x: last.x - previous.x,
            y: last.y - previous.y
          })
          return boundaryPoints.map((point, index) => {
            if (index === 0 && startDirection && startCapExtension > 0) {
              return {
                x: point.x - startDirection.x * startCapExtension,
                y: point.y - startDirection.y * startCapExtension
              }
            }
            if (
              index === boundaryPoints.length - 1 &&
              endDirection &&
              endCapExtension > 0
            ) {
              return {
                x: point.x + endDirection.x * endCapExtension,
                y: point.y + endDirection.y * endCapExtension
              }
            }
            return point
          })
        })()
      : null
  const clippingBoundary =
    localBoundaryPoints && localBoundaryPoints.length >= 2
      ? localBoundaryPoints
      : extendedBoundaryPoints && extendedBoundaryPoints.length >= 2
        ? extendedBoundaryPoints
        : boundaryPoints

  return polygons.flatMap((polygon) => {
    const strictClipped = cleanClippedProductPolygon(
      clipPolygonToSelectedSideBoundaryOrDropRejected(
        polygon,
        clippingBoundary,
        selectedSide
      )
    )
    if (hasPolygonGeometry(strictClipped)) {
      return [strictClipped]
    }

    const softClipped = cleanClippedProductPolygon(
      clipPolygonToSelectedSideBoundaryIfCrossing(
        polygon,
        clippingBoundary,
        selectedSide
      )
    )
    return hasPolygonGeometry(softClipped) ? [softClipped] : []
  })
}

const clipPolygonToEndpointPolicyHalfPlane = (
  polygon: Vec2[],
  endpoint: Vec2,
  tangent: Vec2,
  directionSign: 1 | -1
) => {
  if (polygon.length < 3) {
    return polygon
  }
  const signedDistance = (point: Vec2) =>
    ((point.x - endpoint.x) * tangent.x + (point.y - endpoint.y) * tangent.y) *
    directionSign
  const isInside = (point: Vec2) => signedDistance(point) >= -EPSILON
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous =
      polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside !== previousInside) {
      const previousDistance = signedDistance(previous)
      const currentDistance = signedDistance(current)
      const denominator = previousDistance - currentDistance
      if (Math.abs(denominator) > EPSILON) {
        const t = previousDistance / denominator
        output.push(
          normalizePoint({
            x: previous.x + (current.x - previous.x) * t,
            y: previous.y + (current.y - previous.y) * t
          })
        )
      }
    }

    if (currentInside) {
      output.push(current)
    }
  }

  return cleanClippedProductPolygon(output)
}

const clipBoundaryDomainIntervalPolygonsToEndpointCapPolicy = (
  polygons: Vec2[][],
  interval: Pick<VisibleDashedTopologyInterval, 'domainPlanBoundaryPoints'>,
  endpointCapPolicy?: DashEndpointCapPolicy
) => {
  const boundaryPoints = interval.domainPlanBoundaryPoints
  if (
    polygons.length === 0 ||
    !endpointCapPolicy ||
    !boundaryPoints ||
    boundaryPoints.length < 2
  ) {
    return polygons
  }

  const startEndpoint = boundaryPoints[0]
  const startAdjacent = boundaryPoints[1]
  const endEndpoint = boundaryPoints[boundaryPoints.length - 1]
  const endAdjacent = boundaryPoints[boundaryPoints.length - 2]
  const startTangent =
    endpointCapPolicy.suppressStartCap && startEndpoint && startAdjacent
      ? normalizeVector({
          x: startAdjacent.x - startEndpoint.x,
          y: startAdjacent.y - startEndpoint.y
        })
      : null
  const endTangent =
    endpointCapPolicy.suppressEndCap && endEndpoint && endAdjacent
      ? normalizeVector({
          x: endEndpoint.x - endAdjacent.x,
          y: endEndpoint.y - endAdjacent.y
        })
      : null

  return polygons.flatMap((polygon) => {
    let clipped = polygon
    if (startEndpoint && startTangent) {
      clipped = clipPolygonToEndpointPolicyHalfPlane(
        clipped,
        startEndpoint,
        startTangent,
        1
      )
    }
    if (endEndpoint && endTangent) {
      clipped = clipPolygonToEndpointPolicyHalfPlane(
        clipped,
        endEndpoint,
        endTangent,
        -1
      )
    }
    return hasPolygonGeometry(clipped) ? [clipped] : []
  })
}

const getPolygonsAbsoluteArea = (polygons: Vec2[][]) =>
  polygons.reduce((sum, polygon) => sum + Math.abs(polygonArea(polygon)), 0)

const getPolygonsBoundsAndAbsoluteArea = (polygons: Vec2[][]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let productArea = 0

  for (const polygon of polygons) {
    let signedArea = 0
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index]
      const next = polygon[(index + 1) % polygon.length]
      if (!point || !next) {
        continue
      }
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
      signedArea += point.x * next.y - next.x * point.y
    }
    productArea += Math.abs(signedArea / 2)
  }

  return {
    bounds: { minX, minY, maxX, maxY },
    productArea
  }
}

const _clipOutsideSourceVertexJoinPolygonsToAdjacentBoundarySides = (
  polygons: Vec2[][],
  intervals: readonly Pick<
    VisibleDashedTopologyInterval,
    'domainPlanSelectedSide' | 'domainPlanBoundaryPoints'
  >[]
) => {
  if (polygons.length === 0 || intervals.length === 0) {
    return polygons
  }

  const sideContexts = intervals
    .map((interval) => ({
      selectedSide: interval.domainPlanSelectedSide,
      boundaryPoints: interval.domainPlanBoundaryPoints
    }))
    .filter(
      (
        context
      ): context is {
        selectedSide: 1 | -1
        boundaryPoints: Vec2[]
      } =>
        (context.selectedSide === 1 || context.selectedSide === -1) &&
        Array.isArray(context.boundaryPoints) &&
        context.boundaryPoints.length >= 2
    )

  if (sideContexts.length === 0) {
    return polygons
  }

  const seenContextKeys = new Set<string>()
  const uniqueSideContexts = sideContexts.filter((context) => {
    const first = context.boundaryPoints[0]
    const last = context.boundaryPoints[context.boundaryPoints.length - 1]
    const key = [
      context.selectedSide,
      first ? `${first.x.toFixed(3)},${first.y.toFixed(3)}` : '',
      last ? `${last.x.toFixed(3)},${last.y.toFixed(3)}` : ''
    ].join('|')
    if (seenContextKeys.has(key)) {
      return false
    }
    seenContextKeys.add(key)
    return true
  })

  return uniqueSideContexts.reduce<Vec2[][]>(
    (currentPolygons, context) =>
      currentPolygons.flatMap((polygon) => {
        if (
          polygon.length < 3 ||
          !boundsOverlapBounds(
            getPolygonBounds(polygon),
            getCachedPolylineBounds(context.boundaryPoints)
          )
        ) {
          return [polygon]
        }

        const clipped = cleanClippedProductPolygon(
          clipPolygonToSelectedSideBoundaryOrDropRejected(
            polygon,
            context.boundaryPoints,
            context.selectedSide
          ),
          {
            cleanupMicroEdgeTolerance: 0.001,
            cleanupCollinearTolerance: 0.0001
          }
        )
        return hasPolygonGeometry(clipped) ? [clipped] : []
      }),
    polygons
  )
}
const addPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x + right.x,
  y: left.y + right.y
})

const subtractPoint = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const crossPoints = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const getSourceVertexJoinOffsetDistance = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => getConstrainedRibbonOffsetDistance(stroke)

const getOffsetPointOnLine = (
  point: Vec2,
  lineStart: Vec2,
  lineEnd: Vec2,
  offset: number
) => {
  const direction = normalizeVector({
    x: lineEnd.x - lineStart.x,
    y: lineEnd.y - lineStart.y
  })
  if (!direction) {
    return null
  }

  return addPoint(point, {
    x: -direction.y * offset,
    y: direction.x * offset
  })
}

const buildJoinArcPoints = (
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

  const radius = distanceBetween(center, start)
  const maxChordError = Math.max(0.02, Math.min(0.15, radius * 0.01))
  const maxAngleFromChordError =
    radius <= EPSILON
      ? Math.PI / 64
      : 2 *
        Math.acos(
          Math.max(-1, Math.min(1, 1 - maxChordError / Math.max(radius, 1)))
        )
  const maxAngleFromVisualLength =
    radius <= EPSILON ? Math.PI / 64 : ROUND_CAP_VISUAL_MAX_LENGTH / radius
  const maxAngleStep = Math.min(
    Math.PI / 64,
    maxAngleFromChordError,
    maxAngleFromVisualLength
  )
  const segmentCount = Math.max(24, Math.ceil(Math.abs(sweep) / maxAngleStep))
  const points: Vec2[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = startAngle + (sweep * index) / segmentCount
    points.push(
      normalizePoint({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
    )
  }

  return points
}
type SourceVertexJoinBoundaryCache = Map<number, Vec2[]>

const getSourceVertexJoinSegmentBoundary = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  segmentIndex: number,
  cache?: SourceVertexJoinBoundaryCache
) => {
  if (!cache) {
    return buildSourceSegmentBoundary(path.segments[segmentIndex])
  }

  const cached = cache.get(segmentIndex)
  if (cached) {
    return cached
  }

  const boundary = buildSourceSegmentBoundary(path.segments[segmentIndex])
  cache.set(segmentIndex, boundary)
  return boundary
}

const buildSourceVertexJoinPolygonForOffset = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>,
  offset: number,
  options: {
    boundaryCache?: SourceVertexJoinBoundaryCache
  } = {}
) => {
  const previousBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    previousSegmentIndex,
    options.boundaryCache
  )
  const nextBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    nextSegmentIndex,
    options.boundaryCache
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return []
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (distanceBetween(vertex, nextVertex) > 0.5) {
    return []
  }

  const previousStart = previousBoundary[previousBoundary.length - 2]
  const nextEnd = nextBoundary[1]
  const effectiveOffset = offset
  const previousOffsetStart = getOffsetPointOnLine(
    previousStart,
    previousStart,
    vertex,
    effectiveOffset
  )
  const previousOffsetEnd = getOffsetPointOnLine(
    vertex,
    previousStart,
    vertex,
    effectiveOffset
  )
  const nextOffsetStart = getOffsetPointOnLine(
    vertex,
    vertex,
    nextEnd,
    effectiveOffset
  )
  const nextOffsetEnd = getOffsetPointOnLine(
    nextEnd,
    vertex,
    nextEnd,
    effectiveOffset
  )
  if (
    !previousOffsetStart ||
    !previousOffsetEnd ||
    !nextOffsetStart ||
    !nextOffsetEnd
  ) {
    return []
  }

  let polygon =
    stroke.join === 'round'
      ? [
          vertex,
          ...buildJoinArcPoints(
            vertex,
            previousOffsetEnd,
            nextOffsetStart,
            crossPoints(
              subtractPoint(vertex, previousStart),
              subtractPoint(nextEnd, vertex)
            ) *
              offset >=
              0
              ? -1
              : 1
          )
        ]
      : [vertex, previousOffsetEnd, nextOffsetStart]

  if (stroke.join === 'miter') {
    let joinPoint = lineIntersection(
      previousOffsetStart,
      previousOffsetEnd,
      nextOffsetStart,
      nextOffsetEnd
    )
    const maxMiterDistance = stroke.miterLimit * Math.abs(offset)
    const degeneratedToOffsetEndpoint =
      distanceBetween(previousOffsetEnd, nextOffsetStart) > EPSILON &&
      (distanceBetween(joinPoint, previousOffsetEnd) <= EPSILON ||
        distanceBetween(joinPoint, nextOffsetStart) <= EPSILON)
    if (degeneratedToOffsetEndpoint) {
      const previousOffsetDirection = normalizeVector(
        subtractPoint(previousOffsetEnd, vertex)
      )
      const nextOffsetDirection = normalizeVector(
        subtractPoint(nextOffsetStart, vertex)
      )
      const bisector =
        previousOffsetDirection && nextOffsetDirection
          ? normalizeVector({
              x: previousOffsetDirection.x + nextOffsetDirection.x,
              y: previousOffsetDirection.y + nextOffsetDirection.y
            })
          : null
      const previousDirection = normalizeVector(
        subtractPoint(vertex, previousStart)
      )
      const nextDirection = normalizeVector(subtractPoint(nextEnd, vertex))
      const dot =
        previousDirection && nextDirection
          ? Math.max(
              -1,
              Math.min(
                1,
                previousDirection.x * nextDirection.x +
                  previousDirection.y * nextDirection.y
              )
            )
          : 1
      const halfAngle = Math.acos(dot) / 2
      const unclampedMiterDistance =
        Math.sin(halfAngle) <= EPSILON
          ? maxMiterDistance
          : Math.abs(offset) / Math.sin(halfAngle)
      const miterDistance = Math.min(
        maxMiterDistance,
        Math.max(Math.abs(offset), unclampedMiterDistance)
      )
      if (bisector) {
        joinPoint = normalizePoint({
          x: vertex.x + bisector.x * miterDistance,
          y: vertex.y + bisector.y * miterDistance
        })
      }
    }
    const joinDistance = distanceBetween(vertex, joinPoint)
    if (joinDistance > EPSILON) {
      const clampedJoinPoint =
        joinDistance <= maxMiterDistance + EPSILON
          ? joinPoint
          : normalizePoint({
              x:
                vertex.x +
                ((joinPoint.x - vertex.x) / joinDistance) * maxMiterDistance,
              y:
                vertex.y +
                ((joinPoint.y - vertex.y) / joinDistance) * maxMiterDistance
            })
      polygon = [vertex, previousOffsetEnd, clampedJoinPoint, nextOffsetStart]
    }
  }

  const cleaned = cleanPolygon(polygon)
  return cleaned.length >= 3 &&
    Math.abs(polygonArea(cleaned)) > EPSILON &&
    isSimpleClosedPolygon(cleaned)
    ? [cleaned]
    : []
}

const buildSourceVertexJoinContinuityPolygonsForOffset = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  offset: number,
  options: {
    continuityLength?: number
    boundaryCache?: SourceVertexJoinBoundaryCache
  } = {}
) => {
  const previousBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    previousSegmentIndex,
    options.boundaryCache
  )
  const nextBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    nextSegmentIndex,
    options.boundaryCache
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return []
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (distanceBetween(vertex, nextVertex) > 0.5) {
    return []
  }

  const previousStart = previousBoundary[previousBoundary.length - 2]
  const nextEnd = nextBoundary[1]
  const previousDirection = normalizeVector(
    subtractPoint(vertex, previousStart)
  )
  const nextDirection = normalizeVector(subtractPoint(nextEnd, vertex))
  const previousOffsetEnd = getOffsetPointOnLine(
    vertex,
    previousStart,
    vertex,
    offset
  )
  const nextOffsetStart = getOffsetPointOnLine(vertex, vertex, nextEnd, offset)
  if (
    !previousDirection ||
    !nextDirection ||
    !previousOffsetEnd ||
    !nextOffsetStart
  ) {
    return []
  }

  const continuityLength =
    options.continuityLength ?? Math.max(1, Math.abs(offset) * 1.4)
  const previousSourcePoint = normalizePoint({
    x: vertex.x - previousDirection.x * continuityLength,
    y: vertex.y - previousDirection.y * continuityLength
  })
  const previousOuterPoint = normalizePoint({
    x: previousOffsetEnd.x - previousDirection.x * continuityLength,
    y: previousOffsetEnd.y - previousDirection.y * continuityLength
  })
  const nextSourcePoint = normalizePoint({
    x: vertex.x + nextDirection.x * continuityLength,
    y: vertex.y + nextDirection.y * continuityLength
  })
  const nextOuterPoint = normalizePoint({
    x: nextOffsetStart.x + nextDirection.x * continuityLength,
    y: nextOffsetStart.y + nextDirection.y * continuityLength
  })

  return [
    [vertex, previousOffsetEnd, previousOuterPoint, previousSourcePoint],
    [vertex, nextOffsetStart, nextOuterPoint, nextSourcePoint]
  ]
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
}

const getPolygonsReferencePointDistance = (
  polygons: Vec2[][],
  referencePoints: Vec2[]
) => {
  if (polygons.length === 0 || referencePoints.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  const polygonPoints = polygons.flat()
  return referencePoints.reduce((totalDistance, referencePoint) => {
    const minimumDistance = polygonPoints.reduce(
      (currentMinimum, polygonPoint) =>
        Math.min(currentMinimum, distanceBetween(referencePoint, polygonPoint)),
      Number.POSITIVE_INFINITY
    )
    return totalDistance + minimumDistance
  }, 0)
}

const buildSourceVertexJoinPolygon = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    includeOppositePolygons?: boolean
    referencePoints?: Vec2[]
  } = {}
) => {
  const primaryOffset = getSourceVertexJoinOffsetDistance(stroke)
  const primaryPolygons = buildSourceVertexJoinPolygonForOffset(
    path,
    previousSegmentIndex,
    nextSegmentIndex,
    stroke,
    primaryOffset
  )
  const shouldBuildOpposite =
    options.includeOppositePolygons === true ||
    (options.referencePoints && options.referencePoints.length > 0)
  const oppositePolygons = shouldBuildOpposite
    ? buildSourceVertexJoinPolygonForOffset(
        path,
        previousSegmentIndex,
        nextSegmentIndex,
        stroke,
        -primaryOffset
      )
    : []
  if (options.includeOppositePolygons === true) {
    return [...primaryPolygons, ...oppositePolygons]
  }
  const referencePoints = options.referencePoints ?? []
  if (referencePoints.length === 0 || Math.abs(primaryOffset) <= EPSILON) {
    return primaryPolygons
  }

  return getPolygonsReferencePointDistance(oppositePolygons, referencePoints) <
    getPolygonsReferencePointDistance(primaryPolygons, referencePoints)
    ? oppositePolygons
    : primaryPolygons
}

const getSourceVertexJoinLegalOverlapArea = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[]
) => {
  if (polygons.length === 0 || legalRegions.length === 0) {
    return 0
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.intersection) {
      return 0
    }
    return getCoveragePolygonsFromRegions(
      backend.intersection(
        toCoveragePolygonRegions(polygons),
        legalRegions,
        'nonzero'
      )
    ).reduce((total, polygon) => total + Math.abs(polygonArea(polygon)), 0)
  } catch {
    return 0
  }
}

const clipSourceVertexJoinPolygonsToOutsideLegalDomain = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[]
) => {
  if (polygons.length === 0 || legalRegions.length === 0) {
    return polygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.difference) {
      return []
    }

    return getCoveragePolygonsFromRegions(
      backend.difference(
        toCoveragePolygonRegions(polygons),
        legalRegions,
        'nonzero'
      )
    )
      .map((polygon) =>
        cleanClippedProductPolygon(polygon, {
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001
        })
      )
      .filter(hasPolygonGeometry)
  } catch {
    return []
  }
}

const clipSourceVertexJoinPolygonsToInsideLegalDomain = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[],
  options: {
    legalModels?: LegalClipPolygonModel[]
    useResultCache?: boolean
  } = {}
) => {
  if (polygons.length === 0 || legalRegions.length === 0) {
    return polygons
  }
  const relevantLegalRegions = selectIntersectingLegalClipRegions(
    polygons,
    legalRegions
  )
  if (relevantLegalRegions.length === 0) {
    return []
  }
  const relevantLegalModels =
    relevantLegalRegions === legalRegions
      ? options.legalModels
      : getLegalClipPolygonModels(relevantLegalRegions)
  const useResultCache = options.useResultCache !== false
  const cacheKey = useResultCache
    ? measureStrokePipelinePhase(
        'constrained dashed join: inside legal clip cache key',
        () =>
          buildSourceVertexJoinInsideLegalClipCacheKey(
            polygons,
            relevantLegalRegions
          )
      )
    : null
  const cachedResult = cacheKey
    ? getSourceVertexJoinInsideLegalClipFromCache(cacheKey)
    : undefined
  if (cachedResult) {
    return cachedResult
  }
  const cacheResult = (clipPolygons: Vec2[][]) => {
    if (cacheKey) {
      setSourceVertexJoinInsideLegalClipCache(cacheKey, clipPolygons)
    }
    return clipPolygons
  }
  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.intersection) {
      return cacheResult([])
    }

    const { containedPolygons, polygonsNeedingClip } =
      measureStrokePipelinePhase(
        'constrained dashed join: inside legal clip partition',
        () =>
          partitionInsideLegalClipPolygons(
            polygons,
            relevantLegalRegions,
            relevantLegalModels
          )
      )
    if (polygonsNeedingClip.length === 0) {
      emitStrokePipelineCounter(
        'source-vertex-join-inside-legal-clip-partition-skip'
      )
      return cacheResult(containedPolygons)
    }

    const clippedPolygons = measureStrokePipelinePhase(
      'constrained dashed join: inside legal clip intersection',
      () =>
        getCoveragePolygonsFromRegions(
          backend.intersection(
            toCoveragePolygonRegions(polygonsNeedingClip),
            relevantLegalRegions,
            'nonzero'
          )
        )
    )
      .map((polygon) =>
        cleanClippedProductPolygon(polygon, {
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001
        })
      )
      .filter(hasPolygonGeometry)

    return cacheResult([...containedPolygons, ...clippedPolygons])
  } catch {
    return cacheResult([])
  }
}

const subtractSourceVertexJoinOppositeSidePolygons = (
  polygons: Vec2[][],
  oppositePolygons: Vec2[][]
) => {
  if (polygons.length === 0 || oppositePolygons.length === 0) {
    return polygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.difference) {
      return polygons
    }
    return getCoveragePolygonsFromRegions(
      backend.difference(
        toCoveragePolygonRegions(polygons),
        toCoveragePolygonRegions(oppositePolygons),
        'nonzero'
      )
    )
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)
  } catch {
    return polygons
  }
}

const buildOutsideLegalSideSourceVertexJoinPolygon = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    implicitFillRegions?: PolygonRegion[]
    legalModels?: LegalClipPolygonModel[]
    referencePoints?: Vec2[]
  } = {}
) => {
  if (
    (stroke.position !== 'inside' && stroke.position !== 'outside') ||
    !options.implicitFillRegions ||
    options.implicitFillRegions.length === 0
  ) {
    return {
      polygons: buildSourceVertexJoinPolygon(
        path,
        previousSegmentIndex,
        nextSegmentIndex,
        stroke,
        { referencePoints: options.referencePoints }
      ),
      oppositePolygons: []
    }
  }

  const primaryOffset = getSourceVertexJoinOffsetDistance(stroke)
  const boundaryCache: SourceVertexJoinBoundaryCache = new Map()
  const candidateSets = measureStrokePipelinePhase(
    'constrained dashed join: candidate polygons',
    () =>
      [primaryOffset, -primaryOffset]
        .map((offset) => ({
          offset,
          polygons: buildSourceVertexJoinPolygonForOffset(
            path,
            previousSegmentIndex,
            nextSegmentIndex,
            stroke,
            offset,
            { boundaryCache }
          )
        }))
        .filter((candidate) => candidate.polygons.length > 0)
  )

  if (candidateSets.length <= 1) {
    return {
      polygons: candidateSets[0]?.polygons ?? [],
      oppositePolygons: []
    }
  }

  const [selected, opposite] = measureStrokePipelinePhase(
    'constrained dashed join: legal side select',
    () => {
      const referencePoints = options.referencePoints ?? []
      if (referencePoints.length > 0) {
        const rankedByReferencePoints = [...candidateSets].sort(
          (left, right) =>
            getPolygonsReferencePointDistance(left.polygons, referencePoints) -
            getPolygonsReferencePointDistance(right.polygons, referencePoints)
        )
        const bestDistance = getPolygonsReferencePointDistance(
          rankedByReferencePoints[0]?.polygons ?? [],
          referencePoints
        )
        const nextDistance = getPolygonsReferencePointDistance(
          rankedByReferencePoints[1]?.polygons ?? [],
          referencePoints
        )
        if (
          Number.isFinite(bestDistance) &&
          nextDistance - bestDistance >
            Math.max(0.05, Math.abs(primaryOffset) * 0.02)
        ) {
          return rankedByReferencePoints
        }
      }

      return [...candidateSets].sort((left, right) => {
        const leftLegalOverlap = getSourceVertexJoinLegalOverlapArea(
          left.polygons,
          options.implicitFillRegions ?? []
        )
        const rightLegalOverlap = getSourceVertexJoinLegalOverlapArea(
          right.polygons,
          options.implicitFillRegions ?? []
        )
        const overlapDelta =
          stroke.position === 'inside'
            ? rightLegalOverlap - leftLegalOverlap
            : leftLegalOverlap - rightLegalOverlap
        if (Math.abs(overlapDelta) > EPSILON) {
          return overlapDelta
        }
        return (
          getPolygonsReferencePointDistance(
            left.polygons,
            options.referencePoints ?? []
          ) -
          getPolygonsReferencePointDistance(
            right.polygons,
            options.referencePoints ?? []
          )
        )
      })
    }
  )
  const { oppositeTrimPolygons, selectedContinuityPolygons } =
    measureStrokePipelinePhase(
      'constrained dashed join: continuity trim',
      () => {
        const oppositeTrim =
          stroke.join === 'miter' && opposite
            ? buildSourceVertexJoinPolygonForOffset(
                path,
                previousSegmentIndex,
                nextSegmentIndex,
                {
                  ...stroke,
                  join: 'miter',
                  miterLimit: Math.min(stroke.miterLimit, 2)
                },
                opposite.offset,
                { boundaryCache }
              )
            : (opposite?.polygons ?? [])
        const oppositeContinuityTrim =
          stroke.join === 'miter' && opposite
            ? buildSourceVertexJoinPolygonForOffset(
                path,
                previousSegmentIndex,
                nextSegmentIndex,
                {
                  ...stroke,
                  join: 'miter',
                  miterLimit: Math.min(stroke.miterLimit, 1.75)
                },
                opposite.offset,
                { boundaryCache }
              )
            : oppositeTrim
        const rawSelectedContinuity = selected
          ? buildSourceVertexJoinContinuityPolygonsForOffset(
              path,
              previousSegmentIndex,
              nextSegmentIndex,
              selected.offset,
              stroke.join === 'round'
                ? {
                    continuityLength: Math.max(
                      0.5,
                      Math.abs(selected.offset) * 0.12
                    ),
                    boundaryCache
                  }
                : { boundaryCache }
            )
          : []
        return {
          oppositeTrimPolygons: oppositeTrim,
          selectedContinuityPolygons:
            stroke.join === 'miter' && oppositeTrim.length > 0
              ? subtractSourceVertexJoinOppositeSidePolygons(
                  rawSelectedContinuity,
                  oppositeContinuityTrim
                )
              : rawSelectedContinuity
        }
      }
    )
  const continuityPolygons = selectedContinuityPolygons
  const productPolygons = [...(selected?.polygons ?? []), ...continuityPolygons]
  const legalProductPolygons = measureStrokePipelinePhase(
    'constrained dashed join: legal clip',
    () =>
      stroke.position === 'outside'
        ? clipSourceVertexJoinPolygonsToOutsideLegalDomain(
            productPolygons,
            options.implicitFillRegions ?? []
          )
        : stroke.position === 'inside'
          ? clipSourceVertexJoinPolygonsToInsideLegalDomain(
              productPolygons,
              options.implicitFillRegions ?? [],
              { legalModels: options.legalModels }
            )
          : productPolygons
  )

  return {
    polygons: legalProductPolygons,
    oppositePolygons: oppositeTrimPolygons
  }
}

const getBoundaryDomainTerminalPoint = (
  interval: VisibleDashedTopologyInterval,
  terminal: 'start' | 'end',
  sampleDistance = 0
) => {
  const boundaryPoints = interval.domainPlanBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
  }

  const materializedInterval =
    resolveBoundaryDomainIntervalForMaterialization(interval)
  const hasMaterializedBoundaryDistance =
    materializedInterval.materializationDistanceSpace === 'boundary-domain'
  const pointAtDistance = (targetDistance: number) => {
    const clampedDistance = Math.max(
      0,
      Math.min(
        interval.domainPlanBoundaryTotalLength ?? Number.POSITIVE_INFINITY,
        targetDistance
      )
    )
    let traversed = 0
    for (let index = 1; index < boundaryPoints.length; index += 1) {
      const previous = boundaryPoints[index - 1]
      const current = boundaryPoints[index]
      const segmentLength = distanceBetween(previous, current)
      if (traversed + segmentLength >= clampedDistance) {
        const ratio =
          segmentLength <= EPSILON
            ? 0
            : (clampedDistance - traversed) / segmentLength
        return normalizePoint({
          x: previous.x + (current.x - previous.x) * ratio,
          y: previous.y + (current.y - previous.y) * ratio
        })
      }
      traversed += segmentLength
    }

    return normalizePoint(boundaryPoints[boundaryPoints.length - 1])
  }

  if (hasMaterializedBoundaryDistance) {
    const startDistance = materializedInterval.startDistance
    const endDistance = materializedInterval.endDistance
    const intervalLength = Math.max(0, endDistance - startDistance)
    if (intervalLength > EPSILON) {
      const neighborDistance = Math.min(
        intervalLength,
        Math.max(sampleDistance, Math.min(0.5, intervalLength))
      )
      if (terminal === 'start') {
        return {
          endpoint: pointAtDistance(startDistance),
          neighbor: pointAtDistance(startDistance + neighborDistance)
        }
      }

      return {
        endpoint: pointAtDistance(endDistance),
        neighbor: pointAtDistance(endDistance - neighborDistance)
      }
    }
  }

  const getSampledNeighbor = () => {
    if (sampleDistance <= EPSILON) {
      return terminal === 'start'
        ? boundaryPoints[1]
        : boundaryPoints[boundaryPoints.length - 2]
    }

    let traversed = 0
    if (terminal === 'start') {
      for (let index = 1; index < boundaryPoints.length; index += 1) {
        const previous = boundaryPoints[index - 1]
        const current = boundaryPoints[index]
        const segmentLength = distanceBetween(previous, current)
        if (traversed + segmentLength >= sampleDistance) {
          const ratio =
            segmentLength <= EPSILON
              ? 0
              : (sampleDistance - traversed) / segmentLength
          return normalizePoint({
            x: previous.x + (current.x - previous.x) * ratio,
            y: previous.y + (current.y - previous.y) * ratio
          })
        }
        traversed += segmentLength
      }
      return boundaryPoints[boundaryPoints.length - 1]
    }

    for (let index = boundaryPoints.length - 2; index >= 0; index -= 1) {
      const previous = boundaryPoints[index + 1]
      const current = boundaryPoints[index]
      const segmentLength = distanceBetween(previous, current)
      if (traversed + segmentLength >= sampleDistance) {
        const ratio =
          segmentLength <= EPSILON
            ? 0
            : (sampleDistance - traversed) / segmentLength
        return normalizePoint({
          x: previous.x + (current.x - previous.x) * ratio,
          y: previous.y + (current.y - previous.y) * ratio
        })
      }
      traversed += segmentLength
    }
    return boundaryPoints[0]
  }

  if (terminal === 'start') {
    return {
      endpoint: boundaryPoints[0],
      neighbor: getSampledNeighbor()
    }
  }

  return {
    endpoint: boundaryPoints[boundaryPoints.length - 1],
    neighbor: getSampledNeighbor()
  }
}

const SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE = 0.75
const SOURCE_VERTEX_JOIN_MIN_TURN_ANGLE = Math.PI / 24

const getBoundaryDomainFaceKey = (boundaryDomainId: string | undefined) => {
  const explicitFaceKey = boundaryDomainId?.match(/^face:[^:]+/)?.[0]
  if (explicitFaceKey) {
    return explicitFaceKey
  }

  const contourFaceDomainKey = boundaryDomainId?.match(
    /^contour:face:[^:]+:[^:]+:domain:([^:]+)$/
  )?.[1]
  return contourFaceDomainKey ? `face:${contourFaceDomainKey}` : undefined
}

interface SourceVertexBoundaryTerminalRecord {
  interval: VisibleDashedTopologyInterval
  terminal: 'start' | 'end'
  endpoint: Vec2
  neighbor: Vec2
  sourceSegmentIndex: number
  domainKey: string | undefined
}

interface SourceVertexRecord {
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
}

interface SourceVertexBoundaryJoinPlan {
  kind: 'source-vertex' | 'boundary-terminal-pair'
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
  intervals: [VisibleDashedTopologyInterval, VisibleDashedTopologyInterval]
  referencePoints: Vec2[]
  joinPath?: Pick<PathGeometry, 'segments' | 'closed'>
}

interface SourceVertexBoundaryJoinRecord extends SourceVertexBoundaryJoinPlan {
  polygons: Vec2[][]
  oppositePolygons?: Vec2[][]
}

const sourceVertexBoundaryJoinRecordStageCache = new Map<
  string,
  Pick<SourceVertexBoundaryJoinRecord, 'polygons' | 'oppositePolygons'>
>()

const getCachedSourceVertexBoundaryJoinRecordStage = (cacheKey: string) => {
  const cached = sourceVertexBoundaryJoinRecordStageCache.get(cacheKey)
  if (!cached) {
    return null
  }

  sourceVertexBoundaryJoinRecordStageCache.delete(cacheKey)
  sourceVertexBoundaryJoinRecordStageCache.set(cacheKey, cached)
  emitStrokePipelineCounter('source-vertex-boundary-join-record-cache-hit')
  return {
    polygons: cached.polygons.map((polygon) =>
      polygon.map((point) => ({ ...point }))
    ),
    oppositePolygons: cached.oppositePolygons?.map((polygon) =>
      polygon.map((point) => ({ ...point }))
    )
  }
}

const setCachedSourceVertexBoundaryJoinRecordStage = (
  cacheKey: string,
  record: Pick<SourceVertexBoundaryJoinRecord, 'polygons' | 'oppositePolygons'>
) => {
  if (record.polygons.length === 0) {
    return
  }

  sourceVertexBoundaryJoinRecordStageCache.set(cacheKey, {
    polygons: record.polygons.map((polygon) =>
      polygon.map((point) => ({ ...point }))
    ),
    oppositePolygons: record.oppositePolygons?.map((polygon) =>
      polygon.map((point) => ({ ...point }))
    )
  })
  emitStrokePipelineCounter('source-vertex-boundary-join-record-cache-store')
  if (
    sourceVertexBoundaryJoinRecordStageCache.size >
    SOURCE_VERTEX_BOUNDARY_JOIN_RECORD_CACHE_LIMIT
  ) {
    const oldestKey = sourceVertexBoundaryJoinRecordStageCache
      .keys()
      .next().value
    if (oldestKey !== undefined) {
      sourceVertexBoundaryJoinRecordStageCache.delete(oldestKey)
    }
  }
}

const getSourceVertexTurnAngle = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  boundaryCache?: SourceVertexJoinBoundaryCache
) => {
  const previousBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    previousSegmentIndex,
    boundaryCache
  )
  const nextBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    nextSegmentIndex,
    boundaryCache
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return null
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (
    distanceBetween(vertex, nextVertex) > SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE
  ) {
    return null
  }

  const incoming = normalizeVector(
    subtractPoint(vertex, previousBoundary[previousBoundary.length - 2])
  )
  const outgoing = normalizeVector(subtractPoint(nextBoundary[1], nextVertex))
  if (!incoming || !outgoing) {
    return null
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  return Math.acos(dot)
}

const getSourceVertexRecords = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  boundaryCache?: SourceVertexJoinBoundaryCache
) => {
  if (path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex =
      previousSegmentIndex + 1 >= path.segments.length
        ? path.closed === true
          ? 0
          : -1
        : previousSegmentIndex + 1
    if (nextSegmentIndex < 0) {
      return []
    }
    const nextSegment = path.segments[nextSegmentIndex]
    if (!segment || !nextSegment) {
      return []
    }

    if (
      isAuthoredSourceBoundarySmooth(
        path,
        previousSegmentIndex,
        nextSegmentIndex
      )
    ) {
      return []
    }

    const turnAngle = getSourceVertexTurnAngle(
      path,
      previousSegmentIndex,
      nextSegmentIndex,
      boundaryCache
    )
    if (turnAngle === null || turnAngle < SOURCE_VERTEX_JOIN_MIN_TURN_ANGLE) {
      return []
    }

    return [
      {
        vertexIndex: nextSegmentIndex,
        previousSegmentIndex,
        nextSegmentIndex,
        vertex: normalizePoint(segment.end)
      }
    ]
  })
}

const getBoundaryDomainJoinDomainKey = (
  interval: VisibleDashedTopologyInterval
) =>
  getBoundaryDomainFaceKey(interval.domainPlanBoundaryDomainId) ??
  interval.domainPlanBoundaryDomainId

const collectConstrainedBoundarySourceVertexTerminalRecords = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  strokePosition: 'inside' | 'outside',
  terminalSampleDistance = 0
) => {
  const records: SourceVertexBoundaryTerminalRecord[] = []
  const pushTerminal = (
    interval: VisibleDashedTopologyInterval,
    terminal: 'start' | 'end'
  ) => {
    const expectedSelectedSide =
      strokePosition === 'inside'
        ? interval.domainPlanFilledSide
        : interval.domainPlanUnfilledSide
    const selectedSide = getBoundaryDomainMaterializedSelectedSide(interval)
    if (
      (expectedSelectedSide === 1 || expectedSelectedSide === -1
        ? selectedSide !== expectedSelectedSide
        : selectedSide === undefined) ||
      interval.domainPlanSideResolutionStatus === 'blocked' ||
      interval.domainPlanSplitRangeSourceSegmentIndex === undefined
    ) {
      return
    }

    const terminalPoint = getBoundaryDomainTerminalPoint(
      interval,
      terminal,
      terminalSampleDistance
    )
    if (!terminalPoint) {
      return
    }

    records.push({
      interval,
      terminal,
      endpoint: terminalPoint.endpoint,
      neighbor: terminalPoint.neighbor,
      sourceSegmentIndex: interval.domainPlanSplitRangeSourceSegmentIndex,
      domainKey: getBoundaryDomainJoinDomainKey(interval)
    })
  }

  visibleIntervals.forEach((interval) => {
    if (
      interval.domainPlanTerminalRole === 'start' ||
      interval.domainPlanTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'start')
    }
    if (
      interval.domainPlanTerminalRole === 'end' ||
      interval.domainPlanTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'end')
    }
  })

  return records
}

const buildConstrainedBoundarySourceVertexJoinPlans = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  options: {
    implicitFillRegions?: PolygonRegion[]
    sourceVertexRecords?: SourceVertexRecord[]
    terminalRecords?: SourceVertexBoundaryTerminalRecord[]
  } = {}
): SourceVertexBoundaryJoinPlan[] => {
  if (
    (stroke.position !== 'inside' && stroke.position !== 'outside') ||
    !sourcePath
  ) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const terminalRecords =
    options.terminalRecords ??
    collectConstrainedBoundarySourceVertexTerminalRecords(
      visibleIntervals,
      stroke.position
    )
  if (terminalRecords.length === 0) {
    return []
  }

  const sourceVertexRecords =
    options.sourceVertexRecords ?? getSourceVertexRecords(sourcePath, new Map())
  const terminalRecordsBySourceSegmentIndex = new Map<
    number,
    SourceVertexBoundaryTerminalRecord[]
  >()
  terminalRecords.forEach((record) => {
    const bucket =
      terminalRecordsBySourceSegmentIndex.get(record.sourceSegmentIndex) ?? []
    bucket.push(record)
    terminalRecordsBySourceSegmentIndex.set(record.sourceSegmentIndex, bucket)
  })

  return sourceVertexRecords.flatMap((sourceVertex) => {
    const previousTerminal = (
      terminalRecordsBySourceSegmentIndex.get(
        sourceVertex.previousSegmentIndex
      ) ?? []
    ).find(
      (record) =>
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
        endpointTolerance
    )
    const nextTerminal = (
      terminalRecordsBySourceSegmentIndex.get(sourceVertex.nextSegmentIndex) ??
      []
    ).find(
      (record) =>
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
        endpointTolerance
    )
    if (!previousTerminal || !nextTerminal) {
      return []
    }
    if (
      previousTerminal.domainKey !== undefined &&
      nextTerminal.domainKey !== undefined &&
      previousTerminal.domainKey !== nextTerminal.domainKey
    ) {
      return []
    }
    const previousInterval = previousTerminal.interval
    const nextInterval = nextTerminal.interval

    const referenceDistance = Math.max(
      SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
      stroke.width * 2.5
    )
    const referencePoints = [
      ...(previousTerminal.interval.domainPlanBoundaryPoints ?? []),
      ...(nextTerminal.interval.domainPlanBoundaryPoints ?? [])
    ].filter(
      (point) =>
        distanceBetween(point, sourceVertex.vertex) >
          SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE &&
        distanceBetween(point, sourceVertex.vertex) <= referenceDistance
    )

    return [
      {
        kind: 'source-vertex' as const,
        ...sourceVertex,
        intervals: [previousInterval, nextInterval],
        referencePoints
      }
    ]
  })
}

const buildBoundaryTerminalJoinPath = (
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord
): Pick<PathGeometry, 'segments' | 'closed'> | null => {
  const vertex = previousTerminal.endpoint
  if (distanceBetween(vertex, nextTerminal.endpoint) > 0.5) {
    return null
  }

  const previousLength = distanceBetween(previousTerminal.neighbor, vertex)
  const nextLength = distanceBetween(vertex, nextTerminal.neighbor)
  if (previousLength <= EPSILON || nextLength <= EPSILON) {
    return null
  }

  return {
    closed: false,
    segments: [
      {
        type: 'line',
        start: previousTerminal.neighbor,
        end: vertex,
        length: previousLength
      },
      {
        type: 'line',
        start: vertex,
        end: nextTerminal.neighbor,
        length: nextLength
      }
    ]
  }
}

const getTerminalRecordBucketCoordinate = (value: number, tolerance: number) =>
  Math.floor(value / Math.max(tolerance, EPSILON))

const getTerminalRecordBucketKey = (x: number, y: number) => `${x}:${y}`

const getNearbyTerminalRecordBucketKeys = (point: Vec2, tolerance: number) => {
  const x = getTerminalRecordBucketCoordinate(point.x, tolerance)
  const y = getTerminalRecordBucketCoordinate(point.y, tolerance)
  const keys: string[] = []
  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      keys.push(getTerminalRecordBucketKey(x + offsetX, y + offsetY))
    }
  }
  return keys
}

const buildConstrainedBoundaryTerminalPairJoinPlans = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  options: {
    implicitFillRegions?: PolygonRegion[]
    terminalRecords?: SourceVertexBoundaryTerminalRecord[]
  } = {}
): SourceVertexBoundaryJoinPlan[] => {
  if (stroke.position !== 'inside' && stroke.position !== 'outside') {
    return []
  }

  const terminalRecords =
    options.terminalRecords ??
    collectConstrainedBoundarySourceVertexTerminalRecords(
      visibleIntervals,
      stroke.position
    )
  if (terminalRecords.length < 2) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const referenceDistance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 2.5
  )
  const plans: SourceVertexBoundaryJoinPlan[] = []
  const seenPairs = new Set<string>()
  const startTerminalsByEndpointBucket = new Map<
    string,
    SourceVertexBoundaryTerminalRecord[]
  >()
  terminalRecords.forEach((terminalRecord) => {
    if (terminalRecord.terminal !== 'start') {
      return
    }
    const bucketX = getTerminalRecordBucketCoordinate(
      terminalRecord.endpoint.x,
      endpointTolerance
    )
    const bucketY = getTerminalRecordBucketCoordinate(
      terminalRecord.endpoint.y,
      endpointTolerance
    )
    const bucketKey = getTerminalRecordBucketKey(bucketX, bucketY)
    const bucket = startTerminalsByEndpointBucket.get(bucketKey) ?? []
    bucket.push(terminalRecord)
    startTerminalsByEndpointBucket.set(bucketKey, bucket)
  })

  terminalRecords.forEach((previousTerminal) => {
    if (previousTerminal.terminal !== 'end') {
      return
    }

    getNearbyTerminalRecordBucketKeys(
      previousTerminal.endpoint,
      endpointTolerance
    ).forEach((bucketKey) => {
      const candidateStartTerminals =
        startTerminalsByEndpointBucket.get(bucketKey) ?? []
      candidateStartTerminals.forEach((nextTerminal) => {
        if (
          previousTerminal.interval.intervalId ===
          nextTerminal.interval.intervalId
        ) {
          return
        }
        if (
          previousTerminal.domainKey !== undefined &&
          nextTerminal.domainKey !== undefined &&
          previousTerminal.domainKey !== nextTerminal.domainKey
        ) {
          return
        }
        if (
          distanceBetween(previousTerminal.endpoint, nextTerminal.endpoint) >
          endpointTolerance
        ) {
          return
        }

        const pairKey = [
          previousTerminal.interval.intervalId,
          nextTerminal.interval.intervalId,
          previousTerminal.endpoint.x.toFixed(3),
          previousTerminal.endpoint.y.toFixed(3)
        ].join('|')
        if (seenPairs.has(pairKey)) {
          return
        }

        const joinPath = buildBoundaryTerminalJoinPath(
          previousTerminal,
          nextTerminal
        )
        if (!joinPath) {
          return
        }

        const referencePoints = [
          ...(previousTerminal.interval.domainPlanBoundaryPoints ?? []),
          ...(nextTerminal.interval.domainPlanBoundaryPoints ?? [])
        ].filter(
          (point) =>
            distanceBetween(point, previousTerminal.endpoint) >
              SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE &&
            distanceBetween(point, previousTerminal.endpoint) <=
              referenceDistance
        )

        seenPairs.add(pairKey)
        plans.push({
          kind: 'boundary-terminal-pair',
          vertexIndex: -1,
          previousSegmentIndex: previousTerminal.sourceSegmentIndex,
          nextSegmentIndex: nextTerminal.sourceSegmentIndex,
          vertex: normalizePoint(previousTerminal.endpoint),
          intervals: [previousTerminal.interval, nextTerminal.interval],
          referencePoints,
          joinPath
        })
      })
    })
  })

  return plans
}

const materializeSourceVertexBoundaryJoinRecord = (
  plan: SourceVertexBoundaryJoinPlan,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  options: {
    implicitFillRegions?: PolygonRegion[]
    legalModels?: LegalClipPolygonModel[]
  } = {}
): SourceVertexBoundaryJoinRecord | null => {
  const joinPath = getSourceVertexBoundaryJoinPath(plan, sourcePath)
  if (!joinPath) {
    return null
  }

  const { previousSegmentIndex, nextSegmentIndex } =
    getSourceVertexBoundaryJoinSegmentIndices(plan)
  const join = buildOutsideLegalSideSourceVertexJoinPolygon(
    joinPath,
    previousSegmentIndex,
    nextSegmentIndex,
    stroke,
    {
      implicitFillRegions: options.implicitFillRegions,
      legalModels: options.legalModels,
      referencePoints: plan.referencePoints
    }
  )
  if (join.polygons.length === 0) {
    return null
  }

  return {
    ...plan,
    polygons: join.polygons,
    oppositePolygons: join.oppositePolygons
  }
}

const formatJoinPlanPointSignature = (point: Vec2) =>
  `${formatTranslationInvariantCacheNumber(
    point.x
  )},${formatTranslationInvariantCacheNumber(point.y)}`

const formatJoinPlanPathSignature = (
  path: Pick<PathGeometry, 'segments' | 'closed'> | null | undefined
) => {
  if (!path) {
    return 'source-path'
  }

  const origin = getPathTranslationCacheOrigin(path)
  if (origin) {
    return buildTranslationInvariantPathCacheKey(
      {
        ...path,
        totalLength: path.segments.reduce(
          (total, segment) => total + segment.length,
          0
        )
      },
      origin
    )
  }

  return path.closed === true ? 'closed|empty' : 'open|empty'
}

const getSourceVertexBoundaryJoinPath = (
  plan: SourceVertexBoundaryJoinPlan,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null
) => {
  if (plan.kind === 'boundary-terminal-pair') {
    return plan.joinPath
  }
  if (!sourcePath) {
    return null
  }

  const previousSegment = sourcePath.segments[plan.previousSegmentIndex]
  const nextSegment = sourcePath.segments[plan.nextSegmentIndex]
  if (!previousSegment || !nextSegment) {
    return null
  }

  return {
    closed: false,
    segments: [previousSegment, nextSegment]
  }
}

const getSourceVertexBoundaryJoinSegmentIndices = (
  _plan: SourceVertexBoundaryJoinPlan
) => ({
  previousSegmentIndex: 0,
  nextSegmentIndex: 1
})

const resolveSourceVertexJoinMiterRatioForOffset = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>,
  offset: number,
  boundaryCache?: SourceVertexJoinBoundaryCache
) => {
  if (stroke.join !== 'miter' || Math.abs(offset) <= EPSILON) {
    return stroke.join
  }

  const previousBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    previousSegmentIndex,
    boundaryCache
  )
  const nextBoundary = getSourceVertexJoinSegmentBoundary(
    path,
    nextSegmentIndex,
    boundaryCache
  )
  if (previousBoundary.length < 2 || nextBoundary.length < 2) {
    return 'miter:unavailable'
  }

  const vertex = previousBoundary[previousBoundary.length - 1]
  const nextVertex = nextBoundary[0]
  if (distanceBetween(vertex, nextVertex) > 0.5) {
    return 'miter:disconnected'
  }

  const previousStart = previousBoundary[previousBoundary.length - 2]
  const nextEnd = nextBoundary[1]
  const previousOffsetStart = getOffsetPointOnLine(
    previousStart,
    previousStart,
    vertex,
    offset
  )
  const previousOffsetEnd = getOffsetPointOnLine(
    vertex,
    previousStart,
    vertex,
    offset
  )
  const nextOffsetStart = getOffsetPointOnLine(vertex, vertex, nextEnd, offset)
  const nextOffsetEnd = getOffsetPointOnLine(nextEnd, vertex, nextEnd, offset)
  if (
    !previousOffsetStart ||
    !previousOffsetEnd ||
    !nextOffsetStart ||
    !nextOffsetEnd
  ) {
    return 'miter:unavailable'
  }

  const offsetMagnitude = Math.abs(offset)
  const maxMiterDistance = stroke.miterLimit * offsetMagnitude
  let joinPoint = lineIntersection(
    previousOffsetStart,
    previousOffsetEnd,
    nextOffsetStart,
    nextOffsetEnd
  )
  const degeneratedToOffsetEndpoint =
    distanceBetween(previousOffsetEnd, nextOffsetStart) > EPSILON &&
    (distanceBetween(joinPoint, previousOffsetEnd) <= EPSILON ||
      distanceBetween(joinPoint, nextOffsetStart) <= EPSILON)

  if (degeneratedToOffsetEndpoint) {
    const previousOffsetDirection = normalizeVector(
      subtractPoint(previousOffsetEnd, vertex)
    )
    const nextOffsetDirection = normalizeVector(
      subtractPoint(nextOffsetStart, vertex)
    )
    const bisector =
      previousOffsetDirection && nextOffsetDirection
        ? normalizeVector({
            x: previousOffsetDirection.x + nextOffsetDirection.x,
            y: previousOffsetDirection.y + nextOffsetDirection.y
          })
        : null
    const previousDirection = normalizeVector(
      subtractPoint(vertex, previousStart)
    )
    const nextDirection = normalizeVector(subtractPoint(nextEnd, vertex))
    const dot =
      previousDirection && nextDirection
        ? Math.max(
            -1,
            Math.min(
              1,
              previousDirection.x * nextDirection.x +
                previousDirection.y * nextDirection.y
            )
          )
        : 1
    const halfAngle = Math.acos(dot) / 2
    const unclampedMiterDistance =
      Math.sin(halfAngle) <= EPSILON
        ? maxMiterDistance
        : offsetMagnitude / Math.sin(halfAngle)
    const miterDistance = Math.min(
      maxMiterDistance,
      Math.max(offsetMagnitude, unclampedMiterDistance)
    )
    if (bisector) {
      joinPoint = normalizePoint({
        x: vertex.x + bisector.x * miterDistance,
        y: vertex.y + bisector.y * miterDistance
      })
    }
  }

  const joinDistance = distanceBetween(vertex, joinPoint)
  if (joinDistance <= EPSILON) {
    return 'miter:none'
  }

  const effectiveRatio = Math.min(
    stroke.miterLimit,
    joinDistance / offsetMagnitude
  )
  return `miter:${formatTranslationInvariantCacheNumber(effectiveRatio)}`
}

const getSourceVertexBoundaryJoinEffectiveSignature = (
  plan: SourceVertexBoundaryJoinPlan,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  boundaryCache?: SourceVertexJoinBoundaryCache
) => {
  if (stroke.join !== 'miter') {
    return stroke.join
  }

  const joinPath = getSourceVertexBoundaryJoinPath(plan, sourcePath)
  if (!joinPath) {
    return 'miter:no-path'
  }

  const { previousSegmentIndex, nextSegmentIndex } =
    getSourceVertexBoundaryJoinSegmentIndices(plan)
  const offset = getSourceVertexJoinOffsetDistance(stroke)
  return [
    resolveSourceVertexJoinMiterRatioForOffset(
      joinPath,
      previousSegmentIndex,
      nextSegmentIndex,
      stroke,
      offset,
      boundaryCache
    ),
    resolveSourceVertexJoinMiterRatioForOffset(
      joinPath,
      previousSegmentIndex,
      nextSegmentIndex,
      stroke,
      -offset,
      boundaryCache
    )
  ].join('/')
}

const getSourceVertexBoundaryJoinPlanMaterializationKey = (
  plan: SourceVertexBoundaryJoinPlan,
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  joinPathSignature?: string,
  joinEffectiveSignature?: string
) => {
  const joinPath = getSourceVertexBoundaryJoinPath(plan, sourcePath)
  return [
    plan.kind,
    plan.previousSegmentIndex,
    plan.nextSegmentIndex,
    formatJoinPlanPointSignature(plan.vertex),
    joinPathSignature ?? formatJoinPlanPathSignature(joinPath),
    plan.referencePoints.map(formatJoinPlanPointSignature).join(';'),
    stroke.position,
    formatTranslationInvariantCacheNumber(stroke.width),
    stroke.join,
    joinEffectiveSignature ??
      getSourceVertexBoundaryJoinEffectiveSignature(plan, sourcePath, stroke)
  ].join('|')
}

const materializeSourceVertexBoundaryJoinRecords = (
  plans: SourceVertexBoundaryJoinPlan[],
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  options: {
    implicitFillRegions?: PolygonRegion[]
    joinEffectiveSignatureByPlan?: WeakMap<SourceVertexBoundaryJoinPlan, string>
  } = {}
): SourceVertexBoundaryJoinRecord[] => {
  const recordCache = new Map<
    string,
    Pick<SourceVertexBoundaryJoinRecord, 'polygons' | 'oppositePolygons'>
  >()
  const implicitFillRegionSignature = buildImplicitFillRegionCacheSignature(
    options.implicitFillRegions ?? []
  )
  const legalModels =
    stroke.position === 'inside' &&
    (options.implicitFillRegions?.length ?? 0) > 0
      ? getLegalClipPolygonModels(options.implicitFillRegions ?? [])
      : undefined
  const joinPathSignatureCache = new WeakMap<object, string>()
  const getJoinPathSignature = (
    joinPath: Pick<PathGeometry, 'segments' | 'closed'> | null | undefined
  ) => {
    if (!joinPath) {
      return 'source-path'
    }

    const cached = joinPathSignatureCache.get(joinPath)
    if (cached) {
      return cached
    }

    const signature = formatJoinPlanPathSignature(joinPath)
    joinPathSignatureCache.set(joinPath, signature)
    return signature
  }

  const getStageCacheKey = (
    plan: SourceVertexBoundaryJoinPlan,
    cacheKey: string
  ) => {
    return [
      cacheKey,
      implicitFillRegionSignature,
      plan.referencePoints.map(formatJoinPlanPointSignature).join(';')
    ].join('||')
  }

  return plans.flatMap((plan) => {
    const joinPath = getSourceVertexBoundaryJoinPath(plan, sourcePath)
    const cacheKey = getSourceVertexBoundaryJoinPlanMaterializationKey(
      plan,
      sourcePath,
      stroke,
      getJoinPathSignature(joinPath),
      options.joinEffectiveSignatureByPlan?.get(plan)
    )
    const stageCacheKey = getStageCacheKey(plan, cacheKey)
    const cached = recordCache.get(cacheKey)
    if (cached) {
      return [
        {
          ...plan,
          polygons: cached.polygons,
          oppositePolygons: cached.oppositePolygons
        }
      ]
    }
    const cachedStageRecord =
      getCachedSourceVertexBoundaryJoinRecordStage(stageCacheKey)
    if (cachedStageRecord) {
      recordCache.set(cacheKey, cachedStageRecord)
      return [
        {
          ...plan,
          polygons: cachedStageRecord.polygons,
          oppositePolygons: cachedStageRecord.oppositePolygons
        }
      ]
    }

    const record = materializeSourceVertexBoundaryJoinRecord(
      plan,
      sourcePath,
      stroke,
      {
        ...options,
        legalModels
      }
    )
    if (record) {
      recordCache.set(cacheKey, {
        polygons: record.polygons,
        oppositePolygons: record.oppositePolygons
      })
      setCachedSourceVertexBoundaryJoinRecordStage(stageCacheKey, record)
    }
    return record ? [record] : []
  })
}

const clipSourceSegmentRangePolygonsToAdjacentBoundaries = (
  polygons: Vec2[][],
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'position' | 'dashPattern' | 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  physicalSpanRole: ConstrainedDashedPhysicalSpanRole = 'core',
  sharpGuardVertices: SharpGuardVertex[] = [],
  slicingContext?: SourcePathSlicingContext,
  options?: {
    assumeConstructedSimple?: boolean
    preserveSourceEdgeWhenBoundaryClipLosesCoverage?: boolean
    sourceEdge?: Vec2[]
  }
) => {
  if (
    polygons.length === 0 ||
    path.closed !== true ||
    path.segments.length < 2 ||
    authoredStroke.position !== 'inside'
  ) {
    return polygons
  }

  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  const segmentRange = segmentRanges[range.segmentIndex]
  if (!segmentRange) {
    return polygons
  }
  const endpointClipReach = Math.max(
    intervalStroke.width * (authoredStroke.cap === 'square' ? 1.5 : 0.55),
    EPSILON
  )
  const touchesSegmentStart =
    range.startDistance <=
    segmentRange.startDistance + endpointClipReach + EPSILON
  const touchesSegmentEnd =
    range.endDistance >= segmentRange.endDistance - endpointClipReach - EPSILON
  const assumeConstructedSimple = options?.assumeConstructedSimple === true
  const isValidPolygon = (polygon: Vec2[]) =>
    polygon.length >= 3 &&
    Math.abs(polygonArea(polygon)) > EPSILON &&
    (assumeConstructedSimple || isSimpleClosedPolygon(polygon))

  const areaValidPolygons = polygons.filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
  if (!touchesSegmentStart && !touchesSegmentEnd) {
    return areaValidPolygons.filter((polygon) => isValidPolygon(polygon))
  }
  const sourcePolygons = areaValidPolygons.filter((polygon) =>
    isValidPolygon(polygon)
  )

  const selectedSide = intervalStroke.position === 'inside' ? 1 : -1
  const segmentStartIsSharp = sharpGuardVertices.some((guard) =>
    areLoopDistancesEqual(
      segmentRange.startDistance,
      guard.distance,
      path.totalLength
    )
  )
  const segmentEndIsSharp = sharpGuardVertices.some((guard) =>
    areLoopDistancesEqual(
      segmentRange.endDistance,
      guard.distance,
      path.totalLength
    )
  )
  const boundaryReach = Math.max(
    intervalStroke.width * 2,
    authoredStroke.dashPattern[0] ?? intervalStroke.width
  )
  const isPathStartTerminalRange =
    !interval.wrapsSeam &&
    interval.startDistance <= EPSILON &&
    range.startDistance <= EPSILON
  const isPathEndTerminalRange =
    !interval.wrapsSeam &&
    interval.endDistance >= path.totalLength - EPSILON &&
    range.endDistance >= path.totalLength - EPSILON
  const squareCapReach =
    authoredStroke.cap === 'square'
      ? Math.max(intervalStroke.width / 2, EPSILON)
      : 0
  const roundCapReach =
    authoredStroke.cap === 'round'
      ? Math.max(intervalStroke.width / 2, EPSILON)
      : 0
  const isSquareCapWrappedEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    interval.wrapsSeam &&
    (range.startDistance >= interval.startDistance - squareCapReach - EPSILON ||
      range.endDistance <= interval.endDistance + squareCapReach + EPSILON)
  const isSquareCapIntervalEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    !interval.wrapsSeam &&
    (Math.abs(range.startDistance - interval.startDistance) <=
      squareCapReach + EPSILON ||
      Math.abs(range.endDistance - interval.endDistance) <=
        squareCapReach + EPSILON)
  const isSquareCapSegmentBoundaryEndpointRange =
    authoredStroke.cap === 'square' &&
    physicalSpanRole !== 'core' &&
    ((touchesSegmentStart &&
      (areLoopDistancesEqual(
        interval.startDistance,
        segmentRange.startDistance,
        path.totalLength
      ) ||
        areLoopDistancesEqual(
          interval.endDistance,
          segmentRange.startDistance,
          path.totalLength
        ))) ||
      (touchesSegmentEnd &&
        (areLoopDistancesEqual(
          interval.startDistance,
          segmentRange.endDistance,
          path.totalLength
        ) ||
          areLoopDistancesEqual(
            interval.endDistance,
            segmentRange.endDistance,
            path.totalLength
          ))))
  const isRoundCapWrappedEndpointRange =
    authoredStroke.cap === 'round' &&
    interval.wrapsSeam &&
    (areLoopDistancesEqual(
      range.startDistance,
      interval.startDistance,
      path.totalLength
    ) ||
      areLoopDistancesEqual(
        range.endDistance,
        interval.endDistance,
        path.totalLength
      ) ||
      range.startDistance >= interval.startDistance - roundCapReach - EPSILON ||
      range.endDistance <= interval.endDistance + roundCapReach + EPSILON)
  const isRoundCapIntervalEndpointRange =
    authoredStroke.cap === 'round' &&
    !interval.wrapsSeam &&
    (Math.abs(range.startDistance - interval.startDistance) <=
      roundCapReach + EPSILON ||
      Math.abs(range.endDistance - interval.endDistance) <=
        roundCapReach + EPSILON)
  const isRoundCapSegmentBoundaryEndpointRange =
    authoredStroke.cap === 'round' &&
    ((touchesSegmentStart &&
      (areLoopDistancesEqual(
        interval.startDistance,
        segmentRange.startDistance,
        path.totalLength
      ) ||
        areLoopDistancesEqual(
          interval.endDistance,
          segmentRange.startDistance,
          path.totalLength
        ))) ||
      (touchesSegmentEnd &&
        (areLoopDistancesEqual(
          interval.startDistance,
          segmentRange.endDistance,
          path.totalLength
        ) ||
          areLoopDistancesEqual(
            interval.endDistance,
            segmentRange.endDistance,
            path.totalLength
          ))))
  const shouldRequireClippedSquareCapEndpoint =
    isSquareCapWrappedEndpointRange ||
    isSquareCapIntervalEndpointRange ||
    isSquareCapSegmentBoundaryEndpointRange
  const shouldRequireClippedRoundCapEndpoint =
    isRoundCapWrappedEndpointRange ||
    isRoundCapIntervalEndpointRange ||
    isRoundCapSegmentBoundaryEndpointRange
  const shouldRequireClippedCapEndpoint =
    shouldRequireClippedSquareCapEndpoint ||
    shouldRequireClippedRoundCapEndpoint
  let previousBoundaryData: SourceSegmentBoundaryClipData | null = null
  let nextBoundaryData: SourceSegmentBoundaryClipData | null = null
  let currentBoundaryData: SourceSegmentBoundaryClipData | null = null
  let previousBoundarySelectedSide: 1 | -1 | null = null
  let nextBoundarySelectedSide: 1 | -1 | null = null
  const getPreviousBoundaryData = () => {
    previousBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      (range.segmentIndex - 1 + path.segments.length) % path.segments.length,
      boundaryReach,
      slicingContext
    )
    return previousBoundaryData
  }
  const getNextBoundaryData = () => {
    nextBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      (range.segmentIndex + 1) % path.segments.length,
      boundaryReach,
      slicingContext
    )
    return nextBoundaryData
  }
  const getCurrentBoundaryData = () => {
    currentBoundaryData ??= getSourceSegmentBoundaryClipData(
      path,
      range.segmentIndex,
      boundaryReach,
      slicingContext
    )
    return currentBoundaryData
  }
  const getPreviousBoundary = () => getPreviousBoundaryData().tail
  const getNextBoundary = () => getNextBoundaryData().head
  const getCurrentBoundary = () => getCurrentBoundaryData().boundary
  const getCurrentHeadBoundary = () => getCurrentBoundaryData().head
  const getCurrentTailBoundary = () => getCurrentBoundaryData().tail
  const getCurrentDominantClipBoundary = () => {
    if (touchesSegmentStart && !touchesSegmentEnd) {
      return getCurrentHeadBoundary()
    }
    if (touchesSegmentEnd && !touchesSegmentStart) {
      return getCurrentTailBoundary()
    }
    return getCurrentBoundary()
  }
  const getCurrentHeadReference = () => getCurrentBoundaryData().headReference
  const getCurrentTailReference = () => getCurrentBoundaryData().tailReference
  const getPreviousBoundarySelectedSide = () => {
    previousBoundarySelectedSide ??= getSelectedSideTowardPoint(
      getPreviousBoundary(),
      getCurrentHeadReference(),
      selectedSide
    )
    return previousBoundarySelectedSide
  }
  const getNextBoundarySelectedSide = () => {
    nextBoundarySelectedSide ??= getSelectedSideTowardPoint(
      getNextBoundary(),
      getCurrentTailReference(),
      selectedSide
    )
    return nextBoundarySelectedSide
  }
  const clippedPolygons = polygons.flatMap((polygon) => {
    let currentPolygon = polygon

    if (touchesSegmentStart) {
      currentPolygon = isPathStartTerminalRange
        ? clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            getPreviousBoundary(),
            getPreviousBoundarySelectedSide()
          )
        : segmentStartIsSharp
          ? clipPolygonToSelectedSideBoundary(
              currentPolygon,
              getPreviousBoundary(),
              getPreviousBoundarySelectedSide()
            )
          : clipPolygonToSelectedSideBoundaryIfCrossing(
              currentPolygon,
              getPreviousBoundary(),
              selectedSide
            )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    if (touchesSegmentEnd) {
      currentPolygon = segmentEndIsSharp
        ? clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getNextBoundary(),
            getNextBoundarySelectedSide()
          )
        : clipPolygonToSelectedSideBoundaryIfCrossing(
            currentPolygon,
            getNextBoundary(),
            selectedSide
          )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    if (
      (touchesSegmentStart &&
        !isPathStartTerminalRange &&
        !segmentStartIsSharp) ||
      (touchesSegmentEnd && !segmentEndIsSharp)
    ) {
      currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
        currentPolygon,
        getCurrentDominantClipBoundary()
      )
      if (currentPolygon.length < 3) {
        return []
      }
    }

    return isValidPolygon(currentPolygon) ? [currentPolygon] : []
  })

  if (
    isPathStartTerminalRange ||
    isPathEndTerminalRange ||
    shouldRequireClippedCapEndpoint
  ) {
    return clippedPolygons
  }

  if (clippedPolygons.length > 0) {
    if (options?.preserveSourceEdgeWhenBoundaryClipLosesCoverage === true) {
      return clippedPolygons
    }

    const sourceEdge =
      options?.sourceEdge ??
      sliceSourcePathRangePoints(path, range, physicalSpanRole, slicingContext)
    const sourcePolygonSourceEdgeCount = countSourceEdgeVertices(
      sourcePolygons,
      sourceEdge
    )
    const clippedSourceEdgeCount = countSourceEdgeVertices(
      clippedPolygons,
      sourceEdge
    )
    if (
      sourcePolygonSourceEdgeCount >= 3 &&
      clippedSourceEdgeCount < Math.min(3, sourcePolygonSourceEdgeCount)
    ) {
      return sourcePolygons
    }

    return clippedPolygons
  }

  return sourcePolygons
}

const shouldClipSourceSegmentRangeForInsideBoundary = (
  range: SourceSegmentIntervalRange,
  segmentRange: SourcePathSegmentRange | undefined,
  path: Pick<PathGeometry, 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'width'>,
  sharpGuardVertices: SharpGuardVertex[]
) => {
  if (!segmentRange) {
    return true
  }

  const endpointClipReach = Math.max(
    intervalStroke.width * (authoredStroke.cap === 'square' ? 1.5 : 0.55),
    EPSILON
  )
  return (
    (range.startDistance <=
      segmentRange.startDistance + endpointClipReach + EPSILON &&
      shouldClipSourceSegmentBoundaryForInsideRange(
        segmentRange.startDistance,
        path.totalLength,
        interval,
        authoredStroke,
        intervalStroke,
        sharpGuardVertices
      )) ||
    (range.endDistance >=
      segmentRange.endDistance - endpointClipReach - EPSILON &&
      shouldClipSourceSegmentBoundaryForInsideRange(
        segmentRange.endDistance,
        path.totalLength,
        interval,
        authoredStroke,
        intervalStroke,
        sharpGuardVertices
      ))
  )
}

const getLoopDistanceDelta = (
  left: number,
  right: number,
  totalLength: number
) => {
  if (totalLength <= EPSILON) {
    return Math.abs(left - right)
  }

  const delta = Math.abs(
    normalizeDistanceOnLoop(left, totalLength) -
      normalizeDistanceOnLoop(right, totalLength)
  )
  return Math.min(delta, totalLength - delta)
}

const shouldClipSourceSegmentBoundaryForInsideRange = (
  boundaryDistance: number,
  totalLength: number,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'cap'>,
  intervalStroke: Pick<RenderableStroke, 'width'>,
  sharpGuardVertices: SharpGuardVertex[]
) => {
  if (
    boundaryDistance <= EPSILON ||
    boundaryDistance >= totalLength - EPSILON ||
    sharpGuardVertices.some((guard) =>
      areLoopDistancesEqual(boundaryDistance, guard.distance, totalLength)
    ) ||
    areLoopDistancesEqual(
      boundaryDistance,
      interval.startDistance,
      totalLength
    ) ||
    areLoopDistancesEqual(boundaryDistance, interval.endDistance, totalLength)
  ) {
    return true
  }

  const capReach =
    authoredStroke.cap === 'butt'
      ? 0
      : Math.max(intervalStroke.width / 2, EPSILON)
  if (capReach <= EPSILON) {
    return false
  }

  return (
    getLoopDistanceDelta(
      boundaryDistance,
      interval.startDistance,
      totalLength
    ) <=
      capReach + EPSILON ||
    getLoopDistanceDelta(boundaryDistance, interval.endDistance, totalLength) <=
      capReach + EPSILON
  )
}
const appendDashedSourcePathFinalCoverageRangePolygons = (
  output: Vec2[][],
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topology: Pick<
    PathTopologyModel,
    'normalizedPoints' | 'fillRule' | 'topologyFamily'
  >,
  sweepRange: DashedSourcePathIntervalSweepRange,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'domainPlanSplitRangeId'
    | 'domainPlanTerminalRole'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'domainPlanSideAuthority'
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanSelectedSide'
    | 'domainPlanBoundaryRole'
    | 'domainPlanDomainMode'
    | 'domainPlanSideResolutionStatus'
    | 'domainPlanSideResolutionReason'
    | 'domainPlanBoundaryPoints'
  >,
  authoredStroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  sharpGuardVertices: SharpGuardVertex[],
  slicingContext: SourcePathSlicingContext,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined,
  clipInsideToFillDomain: boolean,
  implicitFillRegions: PolygonRegion[] = [],
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[] = []
) => {
  const { range, span, renderRange } = sweepRange
  const resolvedIntervalStrokes = resolveDashedSourcePathIntervalStrokes(
    interval,
    authoredStroke,
    intervalStroke,
    strokeDomainPlan
  )
  const authoredConstrainedPosition =
    authoredStroke.position === 'inside' ||
    authoredStroke.position === 'outside'
      ? authoredStroke.position
      : null
  const shouldResolveDomainPlanSide =
    intervalStroke.position !== 'center' &&
    authoredConstrainedPosition !== null &&
    (interval.domainPlanSplitRangeId !== undefined ||
      interval.domainPlanBoundaryDomainId !== undefined ||
      strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain')
  if (resolvedIntervalStrokes.length === 0) {
    return
  }

  const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
  const shouldClipInsideBoundary = (
    currentIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>
  ) =>
    topology.topologyFamily === 'self-intersecting'
      ? false
      : shouldClipSourceSegmentRangeForInsideBoundary(
          range,
          segmentRange,
          path,
          interval,
          authoredStroke,
          currentIntervalStroke,
          sharpGuardVertices
        )
  const appendRangeForOffsetRibbonFrame = (
    currentIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
    shouldApplySourceBoundaryClip: boolean
  ) => {
    const buildRangePolygons = (
      candidateIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
      candidateRenderRange: SourceSegmentIntervalRange
    ) => {
      const rangeEndpointCapPolicy = sweepRange.rangeEndpointCapPolicy
      const rangeCapMaterialization = getSourcePathRangeCapMaterialization(
        rangeEndpointCapPolicy,
        authoredStroke
      )
      const resolvedCapStroke = {
        ...rangeCapMaterialization.stroke,
        position: candidateIntervalStroke.position
      }
      const cacheKey = measureStrokePipelinePhase(
        'constrained dashed final coverage: cache key',
        () =>
          !shouldApplySourceBoundaryClip
            ? buildSourcePathFinalRangePolygonCacheKey(
                path,
                candidateRenderRange,
                range,
                slicingContext.segmentRanges[candidateRenderRange.segmentIndex],
                span.role,
                resolvedCapStroke,
                rangeEndpointCapPolicy,
                rangeCapMaterialization.roundCapStart,
                rangeCapMaterialization.roundCapEnd,
                rangeCapMaterialization.squareCapStart,
                rangeCapMaterialization.squareCapEnd,
                slicingContext.roundCapVisualMaxLength,
                slicingContext.samplingTolerance,
                slicingContext.samplingOptions
              )
            : null
      )
      const cachedPolygons = measureStrokePipelinePhase(
        'constrained dashed final coverage: cache lookup',
        () =>
          cacheKey ? getCachedSourcePathFinalRangePolygons(cacheKey) : null
      )
      if (cachedPolygons) {
        return cachedPolygons
      }

      const exactFrames = measureStrokePipelinePhase(
        'constrained dashed final coverage: range slice',
        () =>
          sliceExactOffsetRibbonRangeFrames(
            path,
            candidateRenderRange,
            slicingContext,
            candidateIntervalStroke
          )
      )
      if (exactFrames.length < 2) {
        emitStrokePipelineTrace('constrained-dashed-final-range-empty', {
          reason: 'insufficient-offset-frames',
          intervalId: interval.intervalId,
          domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
          domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
          domainPlanDomainMode: interval.domainPlanDomainMode,
          domainPlanTerminalRole: interval.domainPlanTerminalRole,
          domainPlanSelectedSide: interval.domainPlanSelectedSide,
          strokePosition: authoredStroke.position,
          resolvedPosition: candidateIntervalStroke.position,
          width: candidateIntervalStroke.width,
          segmentIndex: candidateRenderRange.segmentIndex,
          startDistance: candidateRenderRange.startDistance,
          endDistance: candidateRenderRange.endDistance,
          frameCount: exactFrames.length
        })
        return []
      }

      const rangePolygons = measureStrokePipelinePhase(
        'constrained dashed final coverage: polygon build',
        () => {
          const explicitRangeGeometry =
            buildExactSourcePathRibbonGeometryFromOffsetFrames(
              exactFrames,
              resolvedCapStroke,
              rangeCapMaterialization.roundCapStart,
              rangeCapMaterialization.roundCapEnd,
              rangeCapMaterialization.squareCapStart,
              rangeCapMaterialization.squareCapEnd,
              slicingContext.roundCapVisualMaxLength
            )
          return [
            ...explicitRangeGeometry.bodyPolygons,
            ...explicitRangeGeometry.capPolygons
          ]
        }
      )
      const rangePolygonsArea = getPolygonsAbsoluteArea(rangePolygons)
      if (rangePolygons.length === 0 || rangePolygonsArea <= EPSILON) {
        const firstFrame = exactFrames[0]
        const lastFrame = exactFrames[exactFrames.length - 1]
        emitStrokePipelineTrace('constrained-dashed-final-range-empty', {
          reason: 'zero-area-range-polygons',
          intervalId: interval.intervalId,
          domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
          domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
          domainPlanDomainMode: interval.domainPlanDomainMode,
          domainPlanTerminalRole: interval.domainPlanTerminalRole,
          domainPlanSelectedSide: interval.domainPlanSelectedSide,
          strokePosition: authoredStroke.position,
          resolvedPosition: candidateIntervalStroke.position,
          width: candidateIntervalStroke.width,
          segmentIndex: candidateRenderRange.segmentIndex,
          startDistance: candidateRenderRange.startDistance,
          endDistance: candidateRenderRange.endDistance,
          frameCount: exactFrames.length,
          polygonCount: rangePolygons.length,
          polygonArea: rangePolygonsArea,
          firstFrame: firstFrame
            ? {
                x: firstFrame.point.x,
                y: firstFrame.point.y,
                offsetX: firstFrame.offsetPoint.x,
                offsetY: firstFrame.offsetPoint.y
              }
            : undefined,
          lastFrame: lastFrame
            ? {
                x: lastFrame.point.x,
                y: lastFrame.point.y,
                offsetX: lastFrame.offsetPoint.x,
                offsetY: lastFrame.offsetPoint.y
              }
            : undefined
        })
      }
      if (!shouldApplySourceBoundaryClip) {
        if (cacheKey) {
          setCachedSourcePathFinalRangePolygons(cacheKey, rangePolygons)
        }
        return rangePolygons
      }

      const sourceBoundaryClippedPolygons = measureStrokePipelinePhase(
        'constrained dashed final coverage: inside clip',
        () =>
          clipSourceSegmentRangePolygonsToAdjacentBoundaries(
            rangePolygons,
            path,
            range,
            interval,
            authoredStroke,
            candidateIntervalStroke,
            span.role,
            sharpGuardVertices,
            slicingContext,
            {
              assumeConstructedSimple: true,
              preserveSourceEdgeWhenBoundaryClipLosesCoverage: true,
              sourceEdge: exactFrames.map((frame) => frame.point)
            }
          )
      )
      const sourceBoundaryClippedArea = getPolygonsAbsoluteArea(
        sourceBoundaryClippedPolygons
      )
      if (
        sourceBoundaryClippedPolygons.length === 0 ||
        sourceBoundaryClippedArea <= EPSILON
      ) {
        emitStrokePipelineTrace('constrained-dashed-final-range-empty', {
          reason: 'source-boundary-clip-empty',
          intervalId: interval.intervalId,
          domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
          domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
          domainPlanDomainMode: interval.domainPlanDomainMode,
          domainPlanTerminalRole: interval.domainPlanTerminalRole,
          domainPlanSelectedSide: interval.domainPlanSelectedSide,
          strokePosition: authoredStroke.position,
          resolvedPosition: candidateIntervalStroke.position,
          width: candidateIntervalStroke.width,
          segmentIndex: candidateRenderRange.segmentIndex,
          startDistance: candidateRenderRange.startDistance,
          endDistance: candidateRenderRange.endDistance,
          inputPolygonCount: rangePolygons.length,
          inputPolygonArea: rangePolygonsArea,
          clippedPolygonCount: sourceBoundaryClippedPolygons.length,
          clippedPolygonArea: sourceBoundaryClippedArea
        })
      }
      return sourceBoundaryClippedPolygons
    }

    const rangePolygons = buildRangePolygons(currentIntervalStroke, renderRange)
    let finalRangePolygons = rangePolygons
    if (
      shouldResolveDomainPlanSide &&
      !isConstrainedBoundaryDomainProductInterval(interval) &&
      !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
      authoredStroke.position === 'outside' &&
      clipInsideToFillDomain &&
      interval.domainPlanBoundaryRole !== 'hole' &&
      finalRangePolygons.length > 0 &&
      implicitFillRegions.length > 0 &&
      !isClosedConstrainedSourceCoverageInterval(interval)
    ) {
      finalRangePolygons = clipSourcePathPolygonsToEvenOddLegalDomain(
        finalRangePolygons,
        path,
        { position: authoredStroke.position },
        implicitFillRegions,
        {
          fragmentStitchRadius: 0,
          fragmentPruneArea:
            authoredStroke.position === 'outside'
              ? Math.max(
                  1,
                  currentIntervalStroke.width *
                    currentIntervalStroke.width *
                    0.1
                )
              : 0,
          restoreSubjectBoundaryPolygons: [],
          restoreSubjectBoundaryPaths: [],
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001,
          outsideFillRule: topology.fillRule
        }
      )
      finalRangePolygons = finalRangePolygons
        .map((polygon) => cleanClippedProductPolygon(polygon))
        .filter(hasPolygonGeometry)
    }
    output.push(...finalRangePolygons)
  }

  resolvedIntervalStrokes.forEach((resolvedIntervalStroke) => {
    const shouldApplySourceBoundaryClip = shouldResolveDomainPlanSide
      ? false
      : shouldClipInsideBoundary(resolvedIntervalStroke)
    appendRangeForOffsetRibbonFrame(
      resolvedIntervalStroke,
      shouldApplySourceBoundaryClip
    )
  })
}

const resolveDashedSourcePathIntervalStrokes = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'startDistance'
    | 'endDistance'
    | 'domainPlanSelectedSide'
    | 'domainPlanSideResolutionStatus'
    | 'domainPlanSideAuthority'
    | 'domainPlanBoundaryDomainId'
    | 'domainPlanSplitRangeId'
    | 'domainPlanBoundaryPoints'
    | 'domainPlanBoundaryStartDistance'
    | 'domainPlanBoundaryEndDistance'
    | 'domainPlanBoundaryTotalLength'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'domainPlanDomainMode'
    | 'wrapsSeam'
  >,
  authoredStroke: Pick<RenderableStroke, 'position'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined
): Pick<RenderableStroke, 'position' | 'width'>[] => {
  if (
    intervalStroke.position === 'center' ||
    interval.domainPlanDomainMode === 'center-product'
  ) {
    return [
      {
        position: 'inside',
        width: intervalStroke.width / 2
      },
      {
        position: 'outside',
        width: intervalStroke.width / 2
      }
    ]
  }

  const authoredConstrainedPosition =
    authoredStroke.position === 'inside' ||
    authoredStroke.position === 'outside'
      ? authoredStroke.position
      : null
  const shouldResolveDomainPlanSide =
    authoredConstrainedPosition !== null &&
    (interval.domainPlanBoundaryDomainId !== undefined ||
      interval.domainPlanSplitRangeId !== undefined ||
      strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain')

  if (!shouldResolveDomainPlanSide) {
    return [intervalStroke]
  }

  if (isOpenDanglingOutsideBothSidesVisibleInterval(interval)) {
    return [
      {
        position: 'inside',
        width: intervalStroke.width
      },
      {
        position: 'outside',
        width: intervalStroke.width
      }
    ]
  }

  const materializedSelectedSide =
    getBoundaryDomainMaterializedSelectedSide(interval)

  return materializedSelectedSide !== undefined
    ? [
        {
          position:
            materializedSelectedSide > 0
              ? ('inside' as const)
              : ('outside' as const),
          width: intervalStroke.width
        }
      ]
    : []
}

const buildDashedSourcePathIntervalLevelPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervalSweep: DashedSourcePathIntervalSweep,
  interval: VisibleDashedTopologyInterval,
  authoredStroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  slicingContext: SourcePathSlicingContext,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined
) => {
  const resolvedIntervalStrokes = resolveDashedSourcePathIntervalStrokes(
    interval,
    authoredStroke,
    intervalStroke,
    strokeDomainPlan
  )
  if (resolvedIntervalStrokes.length === 0) {
    return []
  }

  const buildPositionPolygons = (
    position: Pick<RenderableStroke, 'position'>['position'],
    materializationPath: Pick<
      PathGeometry,
      'segments' | 'closed' | 'totalLength'
    >,
    materializationSweepRanges: DashedSourcePathIntervalSweepRange[],
    materializationContext: SourcePathSlicingContext
  ) => {
    const positionStroke = {
      position,
      width: resolvedIntervalStrokes[0]?.width ?? intervalStroke.width
    }
    return groupSweepRangesByPhysicalSpan(materializationSweepRanges).flatMap(
      (sweepRangeGroup) => {
        const groupEndpointCapPolicy =
          getSweepRangeGroupEndpointCapPolicy(sweepRangeGroup)
        if (!groupEndpointCapPolicy) {
          return []
        }
        const capMaterialization = getSourcePathRangeCapMaterialization(
          groupEndpointCapPolicy,
          authoredStroke
        )
        const resolvedCapStroke = {
          ...capMaterialization.stroke,
          position
        }
        const materializationRanges = sweepRangeGroup.map(
          (sweepRange) => sweepRange.range
        )
        const cacheOrigin = getSourcePathIntervalLevelPolygonCacheOrigin(
          materializationPath,
          materializationRanges
        )
        const cacheKey =
          cacheOrigin !== null
            ? buildSourcePathIntervalLevelPolygonCacheKey(
                materializationPath,
                cacheOrigin,
                position,
                positionStroke.width,
                {
                  ...capMaterialization,
                  stroke: resolvedCapStroke
                },
                materializationRanges,
                materializationContext
              )
            : null
        const cachedPolygons =
          cacheKey !== null && cacheOrigin !== null
            ? getCachedSourcePathIntervalLevelPolygons(cacheKey, cacheOrigin)
            : null
        if (cachedPolygons) {
          return cachedPolygons
        }

        const exactFrames = dedupeOffsetRibbonFrames(
          materializationRanges.flatMap((range) =>
            sliceExactOffsetRibbonRangeFrames(
              materializationPath,
              range,
              materializationContext,
              positionStroke
            )
          )
        )
        if (exactFrames.length < 2) {
          emitStrokePipelineTrace('constrained-dashed-empty-range-product', {
            intervalId: interval.intervalId,
            domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
            domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
            domainPlanDomainMode: interval.domainPlanDomainMode,
            domainPlanTerminalRole: interval.domainPlanTerminalRole,
            position,
            width: positionStroke.width,
            exactFrameCount: exactFrames.length,
            materializationRanges: materializationRanges.map((range) => ({
              segmentIndex: range.segmentIndex,
              startDistance: range.startDistance,
              endDistance: range.endDistance
            })),
            capMaterialization: {
              cap: resolvedCapStroke.cap,
              roundCapStart: capMaterialization.roundCapStart,
              roundCapEnd: capMaterialization.roundCapEnd,
              squareCapStart: capMaterialization.squareCapStart,
              squareCapEnd: capMaterialization.squareCapEnd
            }
          })
          return []
        }

        const intervalGeometry =
          buildExactSourcePathRibbonGeometryFromOffsetFrames(
            exactFrames,
            resolvedCapStroke,
            capMaterialization.roundCapStart,
            capMaterialization.roundCapEnd,
            capMaterialization.squareCapStart,
            capMaterialization.squareCapEnd,
            materializationContext.roundCapVisualMaxLength
          )
        const intervalPolygons = [
          ...intervalGeometry.bodyPolygons,
          ...intervalGeometry.capPolygons
        ]
        if (intervalPolygons.length === 0) {
          emitStrokePipelineTrace('constrained-dashed-empty-range-product', {
            intervalId: interval.intervalId,
            domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
            domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
            domainPlanDomainMode: interval.domainPlanDomainMode,
            domainPlanTerminalRole: interval.domainPlanTerminalRole,
            position,
            width: positionStroke.width,
            exactFrameCount: exactFrames.length,
            materializationRanges: materializationRanges.map((range) => ({
              segmentIndex: range.segmentIndex,
              startDistance: range.startDistance,
              endDistance: range.endDistance
            })),
            capMaterialization: {
              cap: resolvedCapStroke.cap,
              roundCapStart: capMaterialization.roundCapStart,
              roundCapEnd: capMaterialization.roundCapEnd,
              squareCapStart: capMaterialization.squareCapStart,
              squareCapEnd: capMaterialization.squareCapEnd
            }
          })
        }
        if (cacheKey !== null && cacheOrigin !== null) {
          setCachedSourcePathIntervalLevelPolygons(
            cacheKey,
            cacheOrigin,
            intervalPolygons
          )
        }
        return intervalPolygons
      }
    )
  }

  if (isBoundaryDomainProductVisibleInterval(interval)) {
    const boundaryPath = buildBoundaryDomainPathForInterval(interval)
    const isAlreadyMaterializedBoundaryPath =
      boundaryPath !== null && boundaryPath === path
    const boundaryContext =
      boundaryPath !== null
        ? isAlreadyMaterializedBoundaryPath
          ? slicingContext
          : createSourcePathSlicingContext(
              boundaryPath,
              slicingContext.samplingTolerance,
              slicingContext.samplingOptions,
              slicingContext.roundCapVisualMaxLength
            )
        : null
    const buildSourceIntervalPolygons = (
      position: Pick<RenderableStroke, 'position'>['position']
    ) =>
      boundaryPath !== null &&
      boundaryContext &&
      intervalSweep.ranges.length > 0
        ? buildPositionPolygons(
            position,
            boundaryPath,
            intervalSweep.ranges,
            boundaryContext
          )
        : []
    const intervalPolygons = resolvedIntervalStrokes.flatMap((resolvedStroke) =>
      buildSourceIntervalPolygons(resolvedStroke.position)
    )
    return intervalPolygons
  }

  const primaryResolvedIntervalStroke = resolvedIntervalStrokes[0]
  if (!primaryResolvedIntervalStroke) {
    return []
  }

  return buildPositionPolygons(
    primaryResolvedIntervalStroke.position,
    path,
    intervalSweep.ranges,
    slicingContext
  )
}

const hasSmoothContinuityAcrossSweepRanges = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  ranges: DashedSourcePathIntervalSweepRange[]
) => {
  if (ranges.length < 2) {
    return false
  }

  const orderedRanges = [...ranges].sort(
    (left, right) => left.range.startDistance - right.range.startDistance
  )

  return orderedRanges.some((current, index) => {
    const next = orderedRanges[index + 1]
    if (!next) {
      return false
    }

    const currentSegment = current.range.segmentIndex
    const nextSegment = next.range.segmentIndex
    const expectedNextSegment =
      currentSegment < path.segments.length - 1
        ? currentSegment + 1
        : path.closed
          ? 0
          : null
    return (
      expectedNextSegment === nextSegment &&
      isSourceBoundarySmooth(path, currentSegment, nextSegment)
    )
  })
}

const hasCurvedSourcePathSweepRange = (
  path: Pick<PathGeometry, 'segments'>,
  ranges: DashedSourcePathIntervalSweepRange[]
) =>
  ranges.some(({ range }) => {
    const segment = path.segments[range.segmentIndex]
    return segment !== undefined && segment.type !== 'line'
  })

const canMaterializeSweepAsContinuousIntervalProduct = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  ranges: DashedSourcePathIntervalSweepRange[],
  slicingContext: Pick<SourcePathSlicingContext, 'segmentRanges'>
) => {
  if (ranges.length <= 1) {
    return true
  }

  const orderedRanges = [...ranges].sort((left, right) => {
    const distanceDelta = left.range.startDistance - right.range.startDistance
    return Math.abs(distanceDelta) > EPSILON
      ? distanceDelta
      : left.range.segmentIndex - right.range.segmentIndex
  })

  return orderedRanges.every((current, index) => {
    const next = orderedRanges[index + 1]
    if (!next) {
      return true
    }

    if (current.range.segmentIndex === next.range.segmentIndex) {
      return current.range.endDistance >= next.range.startDistance - EPSILON
    }

    const currentSegmentRange =
      slicingContext.segmentRanges[current.range.segmentIndex]
    const nextSegmentRange =
      slicingContext.segmentRanges[next.range.segmentIndex]
    if (!currentSegmentRange || !nextSegmentRange) {
      return false
    }

    const expectedNextSegmentIndex =
      current.range.segmentIndex < path.segments.length - 1
        ? current.range.segmentIndex + 1
        : path.closed
          ? 0
          : null
    if (expectedNextSegmentIndex !== next.range.segmentIndex) {
      return false
    }

    return (
      current.range.endDistance >= currentSegmentRange.endDistance - EPSILON &&
      next.range.startDistance <= nextSegmentRange.startDistance + EPSILON
    )
  })
}

const isIntervalAdjacentToAuthoredSmoothSourceBoundary = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed'>,
  slicingContext: Pick<SourcePathSlicingContext, 'segmentRanges'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'domainPlanSplitRangeSourceSegmentIndex'
    | 'domainPlanSplitRangeStartDistance'
    | 'domainPlanSplitRangeEndDistance'
    | 'domainPlanTerminalRole'
  >
) => {
  const sourceSegmentIndex = interval.domainPlanSplitRangeSourceSegmentIndex
  if (
    sourceSegmentIndex === undefined ||
    sourceSegmentIndex < 0 ||
    sourceSegmentIndex >= sourcePath.segments.length
  ) {
    return false
  }
  const segmentRange = slicingContext.segmentRanges[sourceSegmentIndex]
  if (!segmentRange) {
    return false
  }

  const previousSegmentIndex =
    sourceSegmentIndex > 0
      ? sourceSegmentIndex - 1
      : sourcePath.closed
        ? sourcePath.segments.length - 1
        : null
  const nextSegmentIndex =
    sourceSegmentIndex < sourcePath.segments.length - 1
      ? sourceSegmentIndex + 1
      : sourcePath.closed
        ? 0
        : null

  const terminalSourceDistances = [
    interval.domainPlanTerminalRole === 'start' ||
    interval.domainPlanTerminalRole === 'start-end'
      ? interval.domainPlanSplitRangeStartDistance
      : undefined,
    interval.domainPlanTerminalRole === 'end' ||
    interval.domainPlanTerminalRole === 'start-end'
      ? interval.domainPlanSplitRangeEndDistance
      : undefined
  ].filter((distance): distance is number => distance !== undefined)

  return (
    (previousSegmentIndex !== null &&
      terminalSourceDistances.some((distance) =>
        areLoopDistancesEqual(
          distance,
          segmentRange.startDistance,
          sourcePath.segments.reduce(
            (total, segment) => total + segment.length,
            0
          )
        )
      ) &&
      isAuthoredSourceBoundarySmooth(
        sourcePath,
        previousSegmentIndex,
        sourceSegmentIndex
      )) ||
    (nextSegmentIndex !== null &&
      terminalSourceDistances.some((distance) =>
        areLoopDistancesEqual(
          distance,
          segmentRange.endDistance,
          sourcePath.segments.reduce(
            (total, segment) => total + segment.length,
            0
          )
        )
      ) &&
      isAuthoredSourceBoundarySmooth(
        sourcePath,
        sourceSegmentIndex,
        nextSegmentIndex
      ))
  )
}

const buildDashedSourcePathFinalCoveragePolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  topology: Pick<
    PathTopologyModel,
    | 'totalLength'
    | 'closed'
    | 'topologyFamily'
    | 'normalizedPoints'
    | 'fillRule'
  >,
  intervalSweep: DashedSourcePathIntervalSweep,
  interval: VisibleDashedTopologyInterval,
  authoredStroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  sharpGuardVertices: SharpGuardVertex[],
  slicingContext: SourcePathSlicingContext,
  strokeDomainPlan: Pick<StrokeDomainPlan, 'sideAuthority'> | undefined,
  clipInsideToFillDomain: boolean,
  implicitFillRegions: PolygonRegion[] = [],
  normalizePerInterval = true,
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[] = []
) => {
  emitStrokePipelineCounter('final-coverage-builder-hit')
  const polygons: Vec2[][] = []
  const canUseContinuousIntervalProduct =
    canMaterializeSweepAsContinuousIntervalProduct(
      path,
      intervalSweep.ranges,
      slicingContext
    )
  const isClosedSourceCoverageProduct =
    isClosedConstrainedSourceCoverageInterval(interval)
  const shouldBuildIntervalLevelProduct =
    !isClosedSourceCoverageProduct &&
    (isBoundaryDomainProductVisibleInterval(interval) ||
      (canUseContinuousIntervalProduct &&
        (hasCurvedSourcePathSweepRange(path, intervalSweep.ranges) ||
          hasSmoothContinuityAcrossSweepRanges(path, intervalSweep.ranges))))

  measureStrokePipelinePhase(
    'constrained dashed final coverage: ranges',
    () => {
      if (shouldBuildIntervalLevelProduct) {
        polygons.push(
          ...buildDashedSourcePathIntervalLevelPolygons(
            path,
            intervalSweep,
            interval,
            authoredStroke,
            intervalStroke,
            slicingContext,
            strokeDomainPlan
          )
        )
        return
      }

      for (const sweepRange of intervalSweep.ranges) {
        appendDashedSourcePathFinalCoverageRangePolygons(
          polygons,
          path,
          topology,
          sweepRange,
          interval,
          authoredStroke,
          intervalStroke,
          sharpGuardVertices,
          slicingContext,
          strokeDomainPlan,
          clipInsideToFillDomain,
          implicitFillRegions,
          sharedStrokeBoundaryDomains
        )
      }
    }
  )

  const domainSideClippedPolygons = measureStrokePipelinePhase(
    'constrained dashed final coverage: boundary-domain side clip',
    () => {
      if (
        !clipInsideToFillDomain ||
        isOpenDanglingOutsideBothSidesVisibleInterval(interval)
      ) {
        return polygons
      }

      if (isBoundaryDomainProductVisibleInterval(interval)) {
        return polygons
      }

      if (authoredStroke.position !== 'outside') {
        return polygons
      }

      const boundaryClippedPolygons =
        clipOutsidePolygonsToStrokeBoundaryDomains(
          polygons,
          sharedStrokeBoundaryDomains
        )

      if (implicitFillRegions.length === 0) {
        return boundaryClippedPolygons
      }

      return clipSourcePathPolygonsToEvenOddLegalDomain(
        boundaryClippedPolygons,
        path,
        { position: authoredStroke.position },
        implicitFillRegions,
        {
          restoreSubjectBoundaryPolygons: [],
          restoreSubjectBoundaryPaths: [],
          fragmentStitchRadius: 0,
          fragmentPruneArea: Math.max(
            1,
            authoredStroke.width * authoredStroke.width * 0.1
          ),
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001,
          outsideFillRule: topology.fillRule
        }
      )
    }
  )
  const isBoundaryDomainProductInterval =
    isConstrainedBoundaryDomainProductInterval(interval)
  const shouldNormalizeIntervalProduct =
    normalizePerInterval && domainSideClippedPolygons.length > 1
  const normalizedPolygons = measureStrokePipelinePhase(
    'constrained dashed final coverage: normalize',
    () =>
      shouldNormalizeIntervalProduct
        ? normalizeConstrainedDashedProductPolygons(domainSideClippedPolygons, {
            cleanClipResidue: topology.topologyFamily === 'self-intersecting',
            mergeContinuousInterval: true
          })
        : domainSideClippedPolygons
  )
  const shouldClipToImplicitFillDomain =
    clipInsideToFillDomain &&
    implicitFillRegions.length > 0 &&
    !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
    !isBoundaryDomainProductInterval &&
    !isClosedSourceCoverageProduct &&
    (authoredStroke.position === 'inside' ||
      (!isBoundaryDomainProductVisibleInterval(interval) &&
        (topology.topologyFamily !== 'self-intersecting' ||
          (strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain' &&
            authoredStroke.position === 'outside'))))

  if (!shouldClipToImplicitFillDomain) {
    return normalizedPolygons
  }

  const clippedPolygons = measureStrokePipelinePhase(
    'constrained dashed final coverage: implicit clip',
    () =>
      clipSourcePathPolygonsToEvenOddLegalDomain(
        normalizedPolygons,
        path,
        authoredStroke,
        implicitFillRegions,
        {
          dropEmptyInsideClipResult: authoredStroke.position === 'inside',
          restoreSubjectBoundaryPolygons: [],
          restoreSubjectBoundaryPaths: []
        }
      )
  )

  const legalClippedPolygons =
    authoredStroke.position === 'inside'
      ? enforceInsideImplicitFillProductDomain(
          clippedPolygons,
          path,
          authoredStroke,
          implicitFillRegions
        )
      : clippedPolygons

  if (
    authoredStroke.position !== 'outside' ||
    legalClippedPolygons.length === 0 ||
    implicitFillRegions.length === 0
  ) {
    return legalClippedPolygons
  }

  return measureStrokePipelinePhase(
    'constrained dashed final coverage: outside cleanup clip',
    () =>
      clipSourcePathPolygonsToEvenOddLegalDomain(
        legalClippedPolygons,
        path,
        authoredStroke,
        [],
        {
          restoreSubjectBoundaryPolygons: [],
          restoreSubjectBoundaryPaths: [],
          fragmentStitchRadius: 0,
          fragmentPruneArea: Math.max(
            1,
            authoredStroke.width * authoredStroke.width * 0.1
          )
        }
      )
  )
}

const isDistanceInsideInterval = (
  distance: number,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => {
  const loopDistance = normalizeDistanceOnLoop(distance, totalLength)
  const start = normalizeDistanceOnLoop(interval.startDistance, totalLength)
  const end = normalizeDistanceOnLoop(interval.endDistance, totalLength)

  if (interval.wrapsSeam) {
    return loopDistance >= start - EPSILON || loopDistance <= end + EPSILON
  }

  return loopDistance >= start - EPSILON && loopDistance <= end + EPSILON
}

const areLoopDistancesEqual = (
  left: number,
  right: number,
  totalLength: number
) => {
  if (totalLength <= EPSILON) {
    return Math.abs(left - right) <= EPSILON
  }

  const delta = Math.abs(
    normalizeDistanceOnLoop(left, totalLength) -
      normalizeDistanceOnLoop(right, totalLength)
  )
  return Math.min(delta, totalLength - delta) <= EPSILON
}

const isIntervalStartAtGuard = (
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance'
  >,
  guard: Pick<SharpGuardVertex, 'distance'>,
  totalLength: number
) => areLoopDistancesEqual(interval.startDistance, guard.distance, totalLength)

const isIntervalEndAtGuard = (
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'endDistance'
  >,
  guard: Pick<SharpGuardVertex, 'distance'>,
  totalLength: number
) => areLoopDistancesEqual(interval.endDistance, guard.distance, totalLength)

const isSharpGuardVertex = (points: Vec2[], index: number) => {
  const candidate = points[index] as SelectedSideGuardPoint
  if (candidate.sharp === false) {
    return false
  }

  const previous = points[(index - 1 + points.length) % points.length]
  const point = points[index]
  const next = points[(index + 1) % points.length]
  const incoming = normalizeVector({
    x: point.x - previous.x,
    y: point.y - previous.y
  })
  const outgoing = normalizeVector({
    x: next.x - point.x,
    y: next.y - point.y
  })

  if (!incoming || !outgoing) {
    return false
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  return Math.acos(dot) >= Math.PI / 4
}

interface SharpGuardVertex {
  distance: number
  previousSegmentStart: Vec2
  previousSegmentEnd: Vec2
  nextSegmentStart: Vec2
  nextSegmentEnd: Vec2
  previousBoundary: Vec2[]
  nextBoundary: Vec2[]
}

const normalizeClosedGuardPoints = (points: Vec2[]) => {
  if (
    points.length > 1 &&
    distanceBetween(points[0], points[points.length - 1]) <= EPSILON
  ) {
    return points.slice(0, -1)
  }

  return points
}

const findNearestSegmentRange = (
  point: Vec2,
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
) => {
  let nearestIndex = -1
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  topologyPoints.forEach((candidate, index) => {
    const distanceSquared =
      (candidate.x - point.x) * (candidate.x - point.x) +
      (candidate.y - point.y) * (candidate.y - point.y)
    if (distanceSquared < nearestDistanceSquared) {
      nearestIndex = index
      nearestDistanceSquared = distanceSquared
    }
  })

  return nearestIndex >= 0 ? segmentRanges[nearestIndex] : undefined
}

const buildSourceSegmentBoundary = (segment: PathSegment | undefined) =>
  segment ? slicePathSegmentPoints(segment, 0, segment.length) : []

const getSourceSegmentBoundary = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  segmentIndex: number,
  slicingContext?: SourcePathSlicingContext
) => {
  const segment = path.segments[segmentIndex]
  if (!segment) {
    return []
  }

  if (!slicingContext) {
    return buildSourceSegmentBoundary(segment)
  }

  const cached = slicingContext.segmentBoundaryCache.get(segmentIndex)
  if (cached) {
    return cached
  }

  const range = slicingContext.segmentRanges[segmentIndex]
  const boundary = range
    ? sliceSourcePathSegmentRangePoints(
        path,
        {
          startDistance: range.startDistance,
          endDistance: range.endDistance,
          segmentIndex
        },
        slicingContext
      )
    : buildSourceSegmentBoundary(segment)
  slicingContext.segmentBoundaryCache.set(segmentIndex, boundary)
  return boundary
}

const buildSharpGuardVertices = (
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  guardPoints: SelectedSideGuardPoint[] = topologyPoints,
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>,
  includeSourcePathBoundaryGeometry = true
): SharpGuardVertex[] => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length < 3) {
    return []
  }

  const canUseSourcePathSegments =
    sourcePath?.closed === true &&
    sourcePath.segments.length === normalizedGuardPoints.length
  const canUseDirectGuardRange =
    normalizedGuardPoints.length === segmentRanges.length
  const sourcePathSegmentRanges = canUseSourcePathSegments
    ? getSourcePathSegmentRanges(sourcePath)
    : []

  const vertices: SharpGuardVertex[] = []

  for (let index = 0; index < normalizedGuardPoints.length; index += 1) {
    if (isSharpGuardVertex(normalizedGuardPoints, index)) {
      const point = normalizedGuardPoints[index]
      const segment = canUseSourcePathSegments
        ? sourcePathSegmentRanges[index]
        : canUseDirectGuardRange
          ? segmentRanges[index]
          : findNearestSegmentRange(point, topologyPoints, segmentRanges)
      if (!segment) {
        continue
      }
      const previous =
        normalizedGuardPoints[
          (index - 1 + normalizedGuardPoints.length) %
            normalizedGuardPoints.length
        ]
      const next =
        normalizedGuardPoints[(index + 1) % normalizedGuardPoints.length]
      const previousBoundary =
        canUseSourcePathSegments && includeSourcePathBoundaryGeometry
          ? buildSourceSegmentBoundary(
              sourcePath.segments[
                (index - 1 + sourcePath.segments.length) %
                  sourcePath.segments.length
              ]
            )
          : [previous, point]
      const nextBoundary =
        canUseSourcePathSegments && includeSourcePathBoundaryGeometry
          ? buildSourceSegmentBoundary(sourcePath.segments[index])
          : [point, next]
      vertices.push({
        distance: segment.startDistance,
        previousSegmentStart: previous,
        previousSegmentEnd: point,
        nextSegmentStart: point,
        nextSegmentEnd: next,
        previousBoundary,
        nextBoundary
      })
    }
  }

  return vertices
}

const getIntervalGuardVertices = (
  sharpGuardVertices: SharpGuardVertex[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => {
  if (
    sharpGuardVertices.length === 0 ||
    segmentRanges.length === 0 ||
    totalLength <= EPSILON
  ) {
    return []
  }

  const selectedVertices: SharpGuardVertex[] = []

  for (const vertex of sharpGuardVertices) {
    if (isDistanceInsideInterval(vertex.distance, interval, totalLength)) {
      selectedVertices.push(vertex)
    }
  }

  return selectedVertices
}

const clipPolygonToSelectedSideOfSegment = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1
) => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const isInside = (point: Vec2) => {
    const cross =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    return selectedSide > 0 ? cross >= -EPSILON : cross <= EPSILON
  }
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous =
      polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside) {
      if (!previousInside) {
        output.push(
          lineIntersection(previous, current, segmentStart, segmentEnd)
        )
      }
      output.push(current)
      continue
    }

    if (previousInside) {
      output.push(lineIntersection(previous, current, segmentStart, segmentEnd))
    }
  }

  return cleanPolygon(output)
}

const areSamePoint = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y) <= EPSILON

const isCollinearPoint = (previous: Vec2, point: Vec2, next: Vec2) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  return Math.abs(ax * by - ay * bx) <= EPSILON
}

const cleanPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 2) {
    return polygon
  }

  const deduped: Vec2[] = []
  for (const point of polygon) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push(point)
    }
  }

  if (
    deduped.length > 2 &&
    areSamePoint(deduped[0], deduped[deduped.length - 1])
  ) {
    deduped.pop()
  }

  if (deduped.length < 4) {
    return deduped
  }

  const cleaned: Vec2[] = []
  for (let index = 0; index < deduped.length; index += 1) {
    const previous = deduped[(index - 1 + deduped.length) % deduped.length]
    const point = deduped[index]
    const next = deduped[(index + 1) % deduped.length]
    if (!isCollinearPoint(previous, point, next)) {
      cleaned.push(point)
    }
  }

  return cleaned.length >= 3 ? cleaned : deduped
}

const cleanBoundaryPath = (points: Vec2[]) => {
  if (points.length < 2) {
    return points
  }

  const deduped: Vec2[] = []
  for (const point of points) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push(point)
    }
  }

  return deduped
}

const CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE = 0.03
const CLIPPED_PRODUCT_COLLINEAR_TOLERANCE = 0.0075

interface ClippedProductCleanupOptions {
  cleanupMicroEdgeTolerance?: number
  cleanupCollinearTolerance?: number
  restoreSubjectBoundaryMaxEdgeLength?: number
  restoreSubjectBoundarySnapTolerance?: number
  restoreSubjectBoundaryPolygons?: Vec2[][]
  restoreSubjectBoundaryPaths?: Vec2[][]
}

const isNearCollinearPoint = (
  previous: Vec2,
  point: Vec2,
  next: Vec2,
  tolerance: number
) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  const cross = Math.abs(ax * by - ay * bx)
  const scale = Math.max(Math.hypot(ax, ay) + Math.hypot(bx, by), 1)
  return cross / scale <= tolerance
}

const cleanClippedProductPolygon = (
  polygon: Vec2[],
  options: ClippedProductCleanupOptions = {}
) => {
  const microEdgeTolerance =
    options.cleanupMicroEdgeTolerance ?? CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE
  const collinearTolerance =
    options.cleanupCollinearTolerance ?? CLIPPED_PRODUCT_COLLINEAR_TOLERANCE
  let cleaned = cleanPolygon(polygon)
  if (cleaned.length < 4) {
    return cleaned
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const deduped: Vec2[] = []
    for (const point of cleaned) {
      const previous = deduped[deduped.length - 1]
      if (
        !previous ||
        Math.hypot(previous.x - point.x, previous.y - point.y) >
          microEdgeTolerance
      ) {
        deduped.push(point)
      }
    }

    if (
      deduped.length > 2 &&
      Math.hypot(
        deduped[0].x - deduped[deduped.length - 1].x,
        deduped[0].y - deduped[deduped.length - 1].y
      ) <= microEdgeTolerance
    ) {
      deduped.pop()
    }

    if (deduped.length < 4) {
      cleaned = deduped
      break
    }

    const simplified: Vec2[] = []
    for (let index = 0; index < deduped.length; index += 1) {
      const previous = deduped[(index - 1 + deduped.length) % deduped.length]
      const point = deduped[index]
      const next = deduped[(index + 1) % deduped.length]
      if (
        Math.hypot(previous.x - point.x, previous.y - point.y) <=
          microEdgeTolerance ||
        Math.hypot(point.x - next.x, point.y - next.y) <= microEdgeTolerance ||
        isNearCollinearPoint(previous, point, next, collinearTolerance)
      ) {
        continue
      }
      simplified.push(point)
    }

    if (
      simplified.length === cleaned.length ||
      simplified.length < 3 ||
      Math.abs(polygonArea(simplified)) <= EPSILON
    ) {
      cleaned = simplified.length >= 3 ? simplified : cleaned
      break
    }

    cleaned = simplified
  }

  for (let pass = 0; pass < 80 && cleaned.length >= 4; pass += 1) {
    let removeIndex = -1
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]
      const point = cleaned[index]
      const next = cleaned[(index + 1) % cleaned.length]
      if (
        Math.hypot(previous.x - point.x, previous.y - point.y) <=
          microEdgeTolerance ||
        Math.hypot(point.x - next.x, point.y - next.y) <= microEdgeTolerance ||
        isNearCollinearPoint(previous, point, next, collinearTolerance)
      ) {
        removeIndex = index
        continue
      }
    }
    if (removeIndex < 0) {
      break
    }
    const compacted = cleaned.filter((_, index) => index !== removeIndex)
    if (compacted.length < 3 || Math.abs(polygonArea(compacted)) <= EPSILON) {
      break
    }
    cleaned = compacted
  }

  return cleanPolygon(cleaned)
}

type SourcePathWithOptionalSamples = Pick<
  PathGeometry,
  'segments' | 'closed' | 'totalLength'
> &
  Partial<
    Pick<
      PathGeometry,
      | 'sampledPoints'
      | 'segmentDistanceRanges'
      | 'sampledSegmentPoints'
      | 'sampledSegmentDistances'
      | 'traceSampleTolerance'
      | 'traceSampleOptions'
    >
  >

const hasPolygonGeometry = (polygon: Vec2[]) =>
  polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON

const normalizeCoveragePolygonWinding = (polygon: Vec2[]) =>
  polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon

const normalizeCoveragePolygonsWinding = (polygons: Vec2[][]) =>
  polygons.map(normalizeCoveragePolygonWinding)

const toCoveragePolygonRegions = (polygons: Vec2[][]) =>
  normalizeCoveragePolygonsWinding(polygons).map((polygon) => ({
    polygons: [polygon]
  }))
const normalizedImplicitFillRegionCache = new WeakMap<
  PolygonRegion[],
  {
    backendSignature: string
    regions: PolygonRegion[]
  }
>()
const normalizedImplicitFillRegionSignatureCache = new Map<
  string,
  {
    backendSignature: string
    regions: PolygonRegion[]
  }
>()
const NORMALIZED_IMPLICIT_FILL_REGION_SIGNATURE_CACHE_LIMIT = 128

const getNormalizedImplicitFillRegions = (
  backend: Pick<GeometryBackend, 'capabilities' | 'union'>,
  backendSignature: string,
  implicitFillRegions: PolygonRegion[]
) => {
  const cached = normalizedImplicitFillRegionCache.get(implicitFillRegions)
  if (cached?.backendSignature === backendSignature) {
    emitStrokePipelineCounter('implicit-fill-region-normalize-cache-hit')
    return cached.regions
  }

  const implicitFillSignature =
    buildImplicitFillRegionCacheSignature(implicitFillRegions)
  const signatureCacheKey = `${backendSignature}|${implicitFillSignature}`
  const signatureCached =
    normalizedImplicitFillRegionSignatureCache.get(signatureCacheKey)
  if (signatureCached?.backendSignature === backendSignature) {
    normalizedImplicitFillRegionCache.set(implicitFillRegions, signatureCached)
    emitStrokePipelineCounter(
      'implicit-fill-region-normalize-signature-cache-hit'
    )
    return signatureCached.regions
  }

  emitStrokePipelineCounter('implicit-fill-region-normalize-cache-miss')
  const normalizedRegions = measureStrokePipelinePhase(
    'constrained dashed fill clip: legal union',
    () =>
      backend.capabilities.union
        ? backend.union(implicitFillRegions, 'nonzero')
        : implicitFillRegions
  )
  const regions =
    normalizedRegions.length > 0 ? normalizedRegions : implicitFillRegions
  normalizedImplicitFillRegionCache.set(implicitFillRegions, {
    backendSignature,
    regions
  })
  normalizedImplicitFillRegionSignatureCache.set(signatureCacheKey, {
    backendSignature,
    regions
  })
  if (
    normalizedImplicitFillRegionSignatureCache.size >
    NORMALIZED_IMPLICIT_FILL_REGION_SIGNATURE_CACHE_LIMIT
  ) {
    const firstKey = normalizedImplicitFillRegionSignatureCache
      .keys()
      .next().value
    if (firstKey !== undefined) {
      normalizedImplicitFillRegionSignatureCache.delete(firstKey)
    }
  }
  return regions
}

interface LegalClipPolygonModel {
  polygon: Vec2[]
  bounds: Bounds
}

const legalClipRegionBoundsCache = new WeakMap<PolygonRegion, Bounds>()
const legalClipPolygonModelCache = new WeakMap<
  PolygonRegion[],
  LegalClipPolygonModel[]
>()

const getLegalClipRegionBounds = (region: PolygonRegion) => {
  const cached = legalClipRegionBoundsCache.get(region)
  if (cached) {
    return cached
  }
  const bounds = getBounds(region.polygons)
  legalClipRegionBoundsCache.set(region, bounds)
  return bounds
}

const getLegalClipPolygonModels = (regions: PolygonRegion[]) => {
  const cached = legalClipPolygonModelCache.get(regions)
  if (cached) {
    return cached
  }

  const models = regions.flatMap((region) =>
    region.polygons.length === 1
      ? region.polygons
          .map(cleanPolygon)
          .filter(hasPolygonGeometry)
          .map((polygon) => ({
            polygon,
            bounds: getBounds([polygon])
          }))
      : []
  )
  legalClipPolygonModelCache.set(regions, models)
  return models
}

const selectIntersectingLegalClipRegions = (
  subjectPolygons: Vec2[][],
  legalClipRegions: PolygonRegion[]
) => {
  if (subjectPolygons.length === 0 || legalClipRegions.length <= 1) {
    return legalClipRegions
  }

  const subjectBounds = getBounds(subjectPolygons)
  const selectedRegions = legalClipRegions.filter((region) =>
    boundsMayIntersect(subjectBounds, getLegalClipRegionBounds(region), 0.01)
  )
  if (selectedRegions.length === legalClipRegions.length) {
    return legalClipRegions
  }

  emitStrokePipelineCounter(
    `source-vertex-join-inside-legal-clip-region-narrow-${selectedRegions.length}`
  )
  return selectedRegions
}

const isPointOnSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON * EPSILON) {
    return distanceBetween(point, start) <= EPSILON
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  if (t < -EPSILON || t > 1 + EPSILON) {
    return false
  }

  const projection = {
    x: start.x + dx * Math.max(0, Math.min(1, t)),
    y: start.y + dy * Math.max(0, Math.min(1, t))
  }
  return distanceBetween(point, projection) <= EPSILON
}

const isPointOnPolygonBoundary = (point: Vec2, polygon: Vec2[]) => {
  for (let index = 0; index < polygon.length; index += 1) {
    if (
      isPointOnSegment(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      )
    ) {
      return true
    }
  }
  return false
}

const isPointInsidePolygonEvenOdd = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

const isPointInsideOrOnPolygon = (point: Vec2, polygon: Vec2[]) =>
  isPointOnPolygonBoundary(point, polygon) ||
  isPointInsidePolygonEvenOdd(point, polygon)

const cross = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const segmentsIntersectWithArea = (
  aStart: Vec2,
  aEnd: Vec2,
  bStart: Vec2,
  bEnd: Vec2
) => {
  const a1 = cross(aStart, aEnd, bStart)
  const a2 = cross(aStart, aEnd, bEnd)
  const b1 = cross(bStart, bEnd, aStart)
  const b2 = cross(bStart, bEnd, aEnd)

  if (
    Math.abs(a1) <= EPSILON ||
    Math.abs(a2) <= EPSILON ||
    Math.abs(b1) <= EPSILON ||
    Math.abs(b2) <= EPSILON
  ) {
    return false
  }

  return a1 > 0 !== a2 > 0 && b1 > 0 !== b2 > 0
}

const polygonEdgesCrossBoundary = (polygon: Vec2[], boundary: Vec2[]) => {
  for (let leftIndex = 0; leftIndex < polygon.length; leftIndex += 1) {
    const leftStart = polygon[leftIndex]
    const leftEnd = polygon[(leftIndex + 1) % polygon.length]
    for (let rightIndex = 0; rightIndex < boundary.length; rightIndex += 1) {
      if (
        segmentsIntersectWithArea(
          leftStart,
          leftEnd,
          boundary[rightIndex],
          boundary[(rightIndex + 1) % boundary.length]
        )
      ) {
        return true
      }
    }
  }
  return false
}

const canSkipInsideLegalClipForPolygon = (
  polygon: Vec2[],
  legalModels: LegalClipPolygonModel[]
) => {
  const skipReason = getInsideLegalClipSkipFailureReason(polygon, legalModels)
  return skipReason === null
}

const getInsideLegalClipSkipFailureReason = (
  polygon: Vec2[],
  legalModels: LegalClipPolygonModel[]
) => {
  const polygonBounds = getBounds([polygon])
  let sawBoundsMiss = false
  let sawPointOutside = false
  let sawBoundaryCrossing = false
  let sawLegalVertexInsideSubject = false

  for (const model of legalModels) {
    if (
      polygonBounds.minX < model.bounds.minX - EPSILON ||
      polygonBounds.maxX > model.bounds.maxX + EPSILON ||
      polygonBounds.minY < model.bounds.minY - EPSILON ||
      polygonBounds.maxY > model.bounds.maxY + EPSILON
    ) {
      sawBoundsMiss = true
      continue
    }
    if (
      !polygon.every((point) => isPointInsideOrOnPolygon(point, model.polygon))
    ) {
      sawPointOutside = true
      continue
    }
    if (polygonEdgesCrossBoundary(polygon, model.polygon)) {
      sawBoundaryCrossing = true
      continue
    }
    if (
      model.polygon.some(
        (point) =>
          !isPointOnPolygonBoundary(point, polygon) &&
          isPointInsidePolygonEvenOdd(point, polygon)
      )
    ) {
      sawLegalVertexInsideSubject = true
      continue
    }

    return null
  }

  if (sawBoundaryCrossing) {
    return 'boundary-crossing'
  }
  if (sawPointOutside) {
    return 'point-outside'
  }
  if (sawLegalVertexInsideSubject) {
    return 'legal-vertex-inside-subject'
  }
  if (sawBoundsMiss) {
    return 'bounds-miss'
  }
  return 'no-legal-model'
}

const canSkipInsideLegalClip = (
  subjectPolygons: Vec2[][],
  legalClipRegions: PolygonRegion[]
) => {
  if (
    subjectPolygons.length === 0 ||
    legalClipRegions.length === 0 ||
    polygonsHaveOverlappingBounds(subjectPolygons)
  ) {
    return false
  }

  const legalModels = getLegalClipPolygonModels(legalClipRegions)
  return (
    legalModels.length > 0 &&
    subjectPolygons.every((polygon) =>
      canSkipInsideLegalClipForPolygon(polygon, legalModels)
    )
  )
}

const partitionInsideLegalClipPolygons = (
  subjectPolygons: Vec2[][],
  legalClipRegions: PolygonRegion[],
  legalModelsOverride?: LegalClipPolygonModel[]
) => {
  const legalModels =
    legalModelsOverride ?? getLegalClipPolygonModels(legalClipRegions)
  if (legalModels.length === 0) {
    return {
      containedPolygons: [],
      polygonsNeedingClip: subjectPolygons
    }
  }

  const containedPolygons: Vec2[][] = []
  const polygonsNeedingClip: Vec2[][] = []
  subjectPolygons.forEach((polygon) => {
    const skipFailureReason = getInsideLegalClipSkipFailureReason(
      polygon,
      legalModels
    )
    if (skipFailureReason === null) {
      containedPolygons.push(polygon)
    } else {
      emitStrokePipelineCounter(
        `source-vertex-join-inside-legal-clip-partition-${skipFailureReason}`
      )
      polygonsNeedingClip.push(polygon)
    }
  })

  return {
    containedPolygons,
    polygonsNeedingClip
  }
}

const sourcePathHasCurvedSegments = (path: SourcePathWithOptionalSamples) =>
  path.segments.some((segment) => segment.type !== 'line')

const cleanClippedProductPolygons = (
  polygons: Vec2[][],
  options: ClippedProductCleanupOptions = {}
) =>
  polygons
    .map((polygon) => cleanClippedProductPolygon(polygon, options))
    .filter(hasPolygonGeometry)

const pointPolylineDistance = (point: Vec2, polyline: readonly Vec2[]) => {
  if (polyline.length === 0) {
    return Infinity
  }
  if (polyline.length === 1) {
    return distanceBetween(point, polyline[0])
  }

  let minDistance = Infinity
  for (let index = 0; index < polyline.length - 1; index += 1) {
    minDistance = Math.min(
      minDistance,
      distanceBetween(
        point,
        projectPointToSegment(point, polyline[index], polyline[index + 1])
      )
    )
  }
  return minDistance
}

const insertSourceBoundaryPointsAlongEdge = (
  start: Vec2,
  end: Vec2,
  sourceBoundary: readonly Vec2[],
  tolerance: number
) => {
  if (sourceBoundary.length < 3) {
    return []
  }
  const startProjection = findNearestProductBoundaryPathProjection(
    start,
    sourceBoundary as Vec2[]
  )
  const endProjection = findNearestProductBoundaryPathProjection(
    end,
    sourceBoundary as Vec2[]
  )
  if (
    !startProjection ||
    !endProjection ||
    startProjection.distance > tolerance ||
    endProjection.distance > tolerance
  ) {
    return []
  }

  return buildProductBoundaryOpenPath(startProjection, endProjection).slice(
    1,
    -1
  )
}

const preserveSmoothSourceBoundaryEdges = (
  polygons: Vec2[][],
  sourceBoundary: readonly Vec2[],
  maxEdgeLength: number,
  tolerance: number
) => {
  if (sourceBoundary.length < 3) {
    return polygons
  }

  return polygons
    .map((polygon) => {
      if (polygon.length < 3) {
        return polygon
      }
      const preserved: Vec2[] = []
      for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index]
        const end = polygon[(index + 1) % polygon.length]
        pushDistinctBoundaryPoint(preserved, start)
        if (distanceBetween(start, end) <= maxEdgeLength) {
          continue
        }
        const midpoint = {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        }
        if (pointPolylineDistance(midpoint, sourceBoundary) > tolerance) {
          continue
        }
        insertSourceBoundaryPointsAlongEdge(
          start,
          end,
          sourceBoundary,
          tolerance
        ).forEach((point) => pushDistinctBoundaryPoint(preserved, point))
      }
      return preserved.length >= 3 ? preserved : polygon
    })
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
}

interface ProductBoundaryProjection {
  polygon: Vec2[]
  edgeIndex: number
  point: Vec2
  distance: number
  t: number
}

interface ProductBoundaryPathProjection {
  path: Vec2[]
  segmentIndex: number
  point: Vec2
  distance: number
  t: number
}

const findNearestProductBoundaryProjection = (
  point: Vec2,
  polygon: Vec2[]
): ProductBoundaryProjection | null => {
  if (polygon.length < 2) {
    return null
  }

  let nearest: ProductBoundaryProjection | null = null
  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const start = polygon[edgeIndex]
    const end = polygon[(edgeIndex + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t =
      lengthSquared > EPSILON
        ? Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared
            )
          )
        : 0
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    }
    const projectedDistance = distanceBetween(point, projected)
    if (!nearest || projectedDistance < nearest.distance) {
      nearest = {
        polygon,
        edgeIndex,
        point: normalizePoint(projected),
        distance: projectedDistance,
        t
      }
    }
  }

  return nearest
}

const findNearestProductBoundaryPathProjection = (
  point: Vec2,
  path: Vec2[]
): ProductBoundaryPathProjection | null => {
  if (path.length < 2) {
    return null
  }

  let nearest: ProductBoundaryPathProjection | null = null
  for (
    let segmentIndex = 0;
    segmentIndex < path.length - 1;
    segmentIndex += 1
  ) {
    const start = path[segmentIndex]
    const end = path[segmentIndex + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t =
      lengthSquared > EPSILON
        ? Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared
            )
          )
        : 0
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    }
    const projectedDistance = distanceBetween(point, projected)
    if (!nearest || projectedDistance < nearest.distance) {
      nearest = {
        path,
        segmentIndex,
        point: normalizePoint(projected),
        distance: projectedDistance,
        t
      }
    }
  }

  return nearest
}

const pushDistinctBoundaryPoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (!previous || distanceBetween(previous, point) > EPSILON) {
    points.push(point)
  }
}

const buildProductBoundaryPath = (
  start: ProductBoundaryProjection,
  end: ProductBoundaryProjection,
  direction: 1 | -1
) => {
  const polygon = start.polygon
  const pointCount = polygon.length
  if (pointCount < 2 || end.polygon !== polygon) {
    return []
  }

  const points: Vec2[] = []
  pushDistinctBoundaryPoint(points, start.point)

  if (direction === 1) {
    let edgeIndex = start.edgeIndex
    for (let step = 0; step <= pointCount; step += 1) {
      if (edgeIndex === end.edgeIndex) {
        pushDistinctBoundaryPoint(points, end.point)
        break
      }
      pushDistinctBoundaryPoint(points, polygon[(edgeIndex + 1) % pointCount])
      edgeIndex = (edgeIndex + 1) % pointCount
    }
  } else {
    let edgeIndex = start.edgeIndex
    for (let step = 0; step <= pointCount; step += 1) {
      if (edgeIndex === end.edgeIndex) {
        pushDistinctBoundaryPoint(points, end.point)
        break
      }
      pushDistinctBoundaryPoint(points, polygon[edgeIndex])
      edgeIndex = (edgeIndex - 1 + pointCount) % pointCount
    }
  }

  return points.length >= 2 ? points : []
}

const buildProductBoundaryOpenPath = (
  start: ProductBoundaryPathProjection,
  end: ProductBoundaryPathProjection
) => {
  const path = start.path
  if (path.length < 2 || end.path !== path) {
    return []
  }

  const points: Vec2[] = []
  if (start.segmentIndex <= end.segmentIndex) {
    pushDistinctBoundaryPoint(points, start.point)
    for (
      let index = start.segmentIndex + 1;
      index <= end.segmentIndex;
      index += 1
    ) {
      pushDistinctBoundaryPoint(points, path[index])
    }
    pushDistinctBoundaryPoint(points, end.point)
  } else {
    pushDistinctBoundaryPoint(points, start.point)
    for (let index = start.segmentIndex; index > end.segmentIndex; index -= 1) {
      pushDistinctBoundaryPoint(points, path[index])
    }
    pushDistinctBoundaryPoint(points, end.point)
  }

  return points.length >= 2 ? points : []
}

const getPolylineLength = (points: Vec2[]) =>
  points.reduce((total, point, index) => {
    if (index === 0) {
      return 0
    }
    return total + distanceBetween(points[index - 1], point)
  }, 0)

const getPolylineMaxEdgeLength = (points: Vec2[]) =>
  points.reduce((maxLength, point, index) => {
    if (index === 0) {
      return maxLength
    }
    return Math.max(maxLength, distanceBetween(points[index - 1], point))
  }, 0)

const chooseRestoredProductBoundaryPath = (
  start: Vec2,
  end: Vec2,
  subjectPolygons: Vec2[][],
  subjectPaths: Vec2[][],
  maxEdgeLength: number,
  snapTolerance: number
) => {
  const directLength = distanceBetween(start, end)
  const isUsableRestoredPath = (path: Vec2[]) => {
    if (path.length < 3) {
      return false
    }
    const length = getPolylineLength(path)
    const maxSegmentLength = getPolylineMaxEdgeLength(path)
    return (
      length > directLength + EPSILON &&
      length <= Math.max(directLength * 4, directLength + maxEdgeLength * 4) &&
      maxSegmentLength <= Math.max(maxEdgeLength, directLength * 0.75)
    )
  }
  const toCandidate = (path: Vec2[]) =>
    isUsableRestoredPath(path)
      ? [
          {
            path,
            length: getPolylineLength(path),
            maxSegmentLength: getPolylineMaxEdgeLength(path)
          }
        ]
      : []

  const polygonCandidates = subjectPolygons.flatMap((polygon) => {
    const startProjection = findNearestProductBoundaryProjection(start, polygon)
    const endProjection = findNearestProductBoundaryProjection(end, polygon)
    if (
      !startProjection ||
      !endProjection ||
      startProjection.distance > snapTolerance ||
      endProjection.distance > snapTolerance
    ) {
      return []
    }

    return ([1, -1] as const).flatMap((direction) => {
      const path = buildProductBoundaryPath(
        startProjection,
        endProjection,
        direction
      )
      if (path.length < 3) {
        return []
      }
      return toCandidate(path)
    })
  })
  const pathCandidates = subjectPaths.flatMap((path) => {
    const startProjection = findNearestProductBoundaryPathProjection(
      start,
      path
    )
    const endProjection = findNearestProductBoundaryPathProjection(end, path)
    if (
      !startProjection ||
      !endProjection ||
      startProjection.distance > snapTolerance ||
      endProjection.distance > snapTolerance
    ) {
      return []
    }

    return toCandidate(
      buildProductBoundaryOpenPath(startProjection, endProjection)
    )
  })
  const candidates = [...polygonCandidates, ...pathCandidates]

  return (
    candidates.sort(
      (left, right) =>
        left.length - right.length ||
        left.maxSegmentLength - right.maxSegmentLength
    )[0]?.path ?? null
  )
}

const restoreClippedProductLongBoundaryEdges = (
  polygons: Vec2[][],
  subjectPolygons: Vec2[][],
  options: ClippedProductCleanupOptions = {}
) => {
  const maxEdgeLength = options.restoreSubjectBoundaryMaxEdgeLength
  if (
    !maxEdgeLength ||
    maxEdgeLength <= EPSILON ||
    subjectPolygons.length === 0
  ) {
    return polygons
  }

  const snapTolerance = Math.max(
    options.restoreSubjectBoundarySnapTolerance ?? 0.75,
    0.1
  )

  return polygons.map((polygon) => {
    if (polygon.length < 3) {
      return polygon
    }
    const restored: Vec2[] = []
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      pushDistinctBoundaryPoint(restored, start)
      if (distanceBetween(start, end) <= maxEdgeLength) {
        continue
      }
      const restoredPath = chooseRestoredProductBoundaryPath(
        start,
        end,
        subjectPolygons,
        options.restoreSubjectBoundaryPaths ?? [],
        maxEdgeLength,
        snapTolerance
      )
      if (!restoredPath) {
        continue
      }
      restoredPath.slice(1, -1).forEach((point) => {
        pushDistinctBoundaryPoint(restored, point)
      })
    }

    return restored.length >= 3 ? restored : polygon
  })
}

const getClippedProductMicroEdgeCount = (polygons: Vec2[][]) =>
  polygons.reduce((total, polygon) => {
    let microEdgeCount = 0
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index]
      const next = polygon[(index + 1) % polygon.length]
      if (
        Math.hypot(point.x - next.x, point.y - next.y) <
        CLIPPED_PRODUCT_MICRO_EDGE_TOLERANCE
      ) {
        microEdgeCount += 1
      }
    }
    return total + microEdgeCount
  }, 0)

const getCoveragePolygonsFromRegions = (regions: { polygons: Vec2[][] }[]) =>
  regions
    .flatMap((region) => region.polygons)
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)

const projectPointToSegment = (point: Vec2, start: Vec2, end: Vec2): Vec2 => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) {
    return { ...start }
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return {
    x: start.x + dx * t,
    y: start.y + dy * t
  }
}

const projectPointToNearestPolygonBoundary = (
  point: Vec2,
  polygons: Vec2[][]
) => {
  let nearestPoint: Vec2 | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  polygons.forEach((polygon) => {
    for (let index = 0; index < polygon.length; index += 1) {
      const projected = projectPointToSegment(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      )
      const distanceSquared =
        (projected.x - point.x) * (projected.x - point.x) +
        (projected.y - point.y) * (projected.y - point.y)
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared
        nearestPoint = projected
      }
    }
  })
  return nearestPoint
}

const isPointInLegalPolygons = (point: Vec2, legalPolygons: Vec2[][]) =>
  legalPolygons.some(
    (legalPolygon) =>
      isPointInsideTopologyPolygon(point, legalPolygon) ||
      pointSegmentDistanceSquaredToPolygon(point, legalPolygon) <= EPSILON
  )

const clampInsideClipPointToLegalBoundary = (
  point: Vec2,
  legalPolygons: Vec2[][]
) =>
  isPointInLegalPolygons(point, legalPolygons)
    ? point
    : (projectPointToNearestPolygonBoundary(point, legalPolygons) ?? point)

const clampInsideClipPolygonToLegalBoundary = (
  polygon: Vec2[],
  legalPolygons: Vec2[][]
) =>
  polygon.map((point) =>
    clampInsideClipPointToLegalBoundary(point, legalPolygons)
  )

const densifyInsideClipPolygonEdgesToLegalBoundary = (
  polygon: Vec2[],
  legalPolygons: Vec2[][],
  maxStep = 0.25
) => {
  if (polygon.length < 2) {
    return polygon
  }

  const densified: Vec2[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    densified.push(start)
    const length = distanceBetween(start, end)
    const steps = Math.max(1, Math.ceil(length / maxStep))
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      densified.push(
        clampInsideClipPointToLegalBoundary(
          {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          },
          legalPolygons
        )
      )
    }
  }
  return densified
}

const getSourcePathEvenOddLegalPoints = (
  path: SourcePathWithOptionalSamples
) => {
  const slicedLegalBoundary = cleanPolygon(
    slicePathGeometryPoints(path, 0, path.totalLength, false, 0.1, {
      minCubicSamples: 64,
      maxCubicSamples: 512,
      useRangeLengthForSampleCount: false
    })
  )

  if (slicedLegalBoundary.length >= 3) {
    return slicedLegalBoundary
  }

  if (path.sampledPoints && path.sampledPoints.length >= 3) {
    return cleanPolygon(path.sampledPoints)
  }

  return slicedLegalBoundary
}

const clipSourcePathPolygonsToEvenOddLegalDomain = (
  polygons: Vec2[][],
  path: SourcePathWithOptionalSamples,
  stroke: Pick<RenderableStroke, 'position'>,
  implicitFillRegions: PolygonRegion[] = [],
  options: {
    fragmentStitchRadius?: number
    fragmentPruneArea?: number
    dropEmptyInsideClipResult?: boolean
    outsideFillRule?: 'evenodd' | 'nonzero'
  } & ClippedProductCleanupOptions = {}
) => {
  if (
    (stroke.position !== 'inside' && stroke.position !== 'outside') ||
    (!path.closed && implicitFillRegions.length === 0) ||
    polygons.length === 0
  ) {
    return polygons
  }

  const subjectPolygons = polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length === 0) {
    return []
  }
  const subjectBoundaryPolygons = (
    options.restoreSubjectBoundaryPolygons ?? subjectPolygons
  )
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
  const subjectBoundaryPaths = (options.restoreSubjectBoundaryPaths ?? [])
    .map(cleanBoundaryPath)
    .filter((path) => path.length >= 2)
  const shouldNormalizeClipResidue =
    (options.fragmentStitchRadius ?? 0) > EPSILON ||
    (options.fragmentPruneArea ?? 0) > EPSILON
  const restoreClipResultPolygons = (clipPolygons: Vec2[][]) =>
    restoreClippedProductLongBoundaryEdges(
      clipPolygons,
      subjectBoundaryPolygons,
      {
        ...options,
        restoreSubjectBoundaryPaths: subjectBoundaryPaths
      }
    )
  const normalizeClipResultPolygons = (clipPolygons: Vec2[][]) => {
    const restored = restoreClipResultPolygons(clipPolygons)
    return shouldNormalizeClipResidue
      ? cleanClippedProductPolygons(restored, options)
      : restored.map(cleanPolygon).filter(hasPolygonGeometry)
  }

  const legalPoints =
    implicitFillRegions.length === 0
      ? getSourcePathEvenOddLegalPoints(path)
      : []
  const legalRegions =
    implicitFillRegions.length > 0
      ? implicitFillRegions
      : legalPoints.length >= 3 && Math.abs(polygonArea(legalPoints)) > EPSILON
        ? [{ polygons: [normalizeCoveragePolygonWinding(legalPoints)] }]
        : []
  if (legalRegions.length === 0) {
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    const backendSignature = getGeometryBackendCacheSignature(backend)
    if (
      !backend.capabilities.intersection ||
      (stroke.position === 'outside' && !backend.capabilities.difference)
    ) {
      return implicitFillRegions.length > 0 ? [] : subjectPolygons
    }

    const normalizedLegalRegions =
      implicitFillRegions.length > 0
        ? getNormalizedImplicitFillRegions(
            backend,
            backendSignature,
            implicitFillRegions
          )
        : legalRegions
    const legalClipRegions =
      normalizedLegalRegions.length > 0 ? normalizedLegalRegions : legalRegions
    const normalizedSubjectPolygons = subjectPolygons
    if (normalizedSubjectPolygons.length === 0) {
      return []
    }

    if (stroke.position === 'inside') {
      const insideLegalClipRegions = legalClipRegions
      const insideFillRule: 'evenodd' | 'nonzero' = 'nonzero'
      const insideLegalClipResultCacheKey =
        insideLegalClipRegions.length > 0
          ? buildInsideLegalClipResultCacheKey(
              path,
              backendSignature,
              normalizedSubjectPolygons,
              insideLegalClipRegions,
              options
            )
          : null
      if (insideLegalClipResultCacheKey) {
        const cachedResult = getInsideLegalClipResultFromCache(
          insideLegalClipResultCacheKey
        )
        if (cachedResult) {
          return cachedResult
        }
      }
      const cacheInsideClipResult = (clipPolygons: Vec2[][]) => {
        if (insideLegalClipResultCacheKey) {
          setInsideLegalClipResultCache(
            insideLegalClipResultCacheKey,
            clipPolygons
          )
        }
        return clipPolygons
      }
      if (
        implicitFillRegions.length > 0 &&
        !sourcePathHasCurvedSegments(path) &&
        canSkipInsideLegalClip(
          normalizedSubjectPolygons,
          insideLegalClipRegions
        )
      ) {
        emitStrokePipelineCounter('inside-legal-clip-noop-skip')
        return cacheInsideClipResult(normalizedSubjectPolygons)
      }

      const finalizeInsideClipPolygons = (clipPolygons: Vec2[][]) => {
        const cleanedClipPolygons = clipPolygons
          .map(cleanPolygon)
          .filter(hasPolygonGeometry)

        if (cleanedClipPolygons.length === 0) {
          return []
        }

        const legalPolygons = getCoveragePolygonsFromRegions(
          insideLegalClipRegions
        )
        const shouldClampToCurvedLegalBoundary =
          legalPolygons.length > 0 && sourcePathHasCurvedSegments(path)

        const boundaryClampedPolygons = shouldClampToCurvedLegalBoundary
          ? cleanedClipPolygons.map((polygon) =>
              densifyInsideClipPolygonEdgesToLegalBoundary(
                clampInsideClipPolygonToLegalBoundary(polygon, legalPolygons),
                legalPolygons
              )
            )
          : cleanedClipPolygons

        const reclippedPolygons = getCoveragePolygonsFromRegions(
          backend.intersection(
            toCoveragePolygonRegions(
              boundaryClampedPolygons.filter(hasPolygonGeometry)
            ),
            insideLegalClipRegions,
            insideFillRule
          )
        )
          .map(cleanPolygon)
          .filter(hasPolygonGeometry)

        return subtractInsideLegalResidue(
          reclippedPolygons,
          insideLegalClipRegions,
          insideFillRule
        )
      }

      const directClippedPolygons = finalizeInsideClipPolygons(
        getCoveragePolygonsFromRegions(
          backend.intersection(
            toCoveragePolygonRegions(normalizedSubjectPolygons),
            insideLegalClipRegions,
            insideFillRule
          )
        )
      )

      if (directClippedPolygons.length <= 1) {
        if (directClippedPolygons.length > 0) {
          return cacheInsideClipResult(directClippedPolygons)
        }
        return cacheInsideClipResult([])
      }

      const unionedClippedPolygons = getCoveragePolygonsFromRegions(
        backend.union(
          toCoveragePolygonRegions(directClippedPolygons),
          'nonzero'
        )
      )

      const finalizedUnionedClippedPolygons = finalizeInsideClipPolygons(
        unionedClippedPolygons
      )

      return cacheInsideClipResult(finalizedUnionedClippedPolygons)
    }

    const clipOperation = backend.difference.bind(backend)
    const outsideFillRule = options.outsideFillRule ?? 'nonzero'
    const outsideLegalClipResultCacheKey = buildOutsideLegalClipResultCacheKey(
      path,
      backendSignature,
      normalizedSubjectPolygons,
      legalClipRegions,
      outsideFillRule,
      implicitFillRegions.length === 0,
      options
    )
    const cachedOutsideLegalClipResult = getOutsideLegalClipResultFromCache(
      outsideLegalClipResultCacheKey
    )
    if (cachedOutsideLegalClipResult) {
      return cachedOutsideLegalClipResult
    }
    const cacheOutsideClipResult = (clipPolygons: Vec2[][]) => {
      setOutsideLegalClipResultCache(
        outsideLegalClipResultCacheKey,
        clipPolygons
      )
      return clipPolygons
    }
    const finalizeClipResultPolygons = (
      clipPolygons: Vec2[][],
      fillRule: 'evenodd' | 'nonzero'
    ) => {
      const normalized = normalizeClipResultPolygons(clipPolygons)
      if (!shouldNormalizeClipResidue || normalized.length === 0) {
        return normalized
      }

      const legallyClipped = getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalized),
          legalClipRegions,
          fillRule
        )
      )

      if (stroke.position === 'inside') {
        const legalPolygons = getCoveragePolygonsFromRegions(legalClipRegions)
        const insideClamped =
          legalPolygons.length > 0
            ? legallyClipped.map((polygon) =>
                densifyInsideClipPolygonEdgesToLegalBoundary(
                  clampInsideClipPolygonToLegalBoundary(polygon, legalPolygons),
                  legalPolygons
                )
              )
            : legallyClipped
        const reclippedInside = getCoveragePolygonsFromRegions(
          backend.intersection(
            toCoveragePolygonRegions(insideClamped.filter(hasPolygonGeometry)),
            legalClipRegions,
            fillRule
          )
        )
        return reclippedInside.map(cleanPolygon).filter(hasPolygonGeometry)
      }

      const outsideCleaned = cleanClippedProductPolygons(
        restoreClipResultPolygons(legallyClipped),
        options
      )
      if (outsideCleaned.length === 0) {
        return []
      }
      return restoreClipResultPolygons(
        getCoveragePolygonsFromRegions(
          backend.difference(
            toCoveragePolygonRegions(outsideCleaned),
            legalClipRegions,
            fillRule
          )
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)
    }
    const directClippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          outsideFillRule
        )
      ),
      outsideFillRule
    )
    if (directClippedPolygons.length > 0) {
      if (!shouldNormalizeClipResidue) {
        return cacheOutsideClipResult(directClippedPolygons)
      }

      const prunedDirectPolygons = pruneSmallClippedProductFragments(
        directClippedPolygons,
        options.fragmentPruneArea ?? 0
      )

      const stitchedDirectPolygons = stitchClippedProductFragments(
        prunedDirectPolygons,
        options.fragmentStitchRadius ?? 0
      )
      if (
        stitchedDirectPolygons.length === 1 ||
        prunedDirectPolygons.length === 1
      ) {
        return cacheOutsideClipResult(
          finalizeClipResultPolygons(stitchedDirectPolygons, 'nonzero')
        )
      }

      if (directClippedPolygons.length <= 1) {
        return cacheOutsideClipResult(directClippedPolygons)
      }

      const unionedDirectPolygons = finalizeClipResultPolygons(
        getCoveragePolygonsFromRegions(
          backend.union(
            toCoveragePolygonRegions(prunedDirectPolygons),
            'nonzero'
          )
        ),
        'nonzero'
      )
      const prunedUnionedDirectPolygons = pruneSmallClippedProductFragments(
        unionedDirectPolygons,
        options.fragmentPruneArea ?? 0
      )
      if (prunedUnionedDirectPolygons.length === 1) {
        return cacheOutsideClipResult(
          finalizeClipResultPolygons(prunedUnionedDirectPolygons, 'nonzero')
        )
      }

      const stitchedUnionedDirectPolygons = stitchClippedProductFragments(
        prunedUnionedDirectPolygons,
        options.fragmentStitchRadius ?? 0
      )
      return cacheOutsideClipResult(
        finalizeClipResultPolygons(
          stitchedUnionedDirectPolygons.length > 0
            ? stitchedUnionedDirectPolygons
            : prunedUnionedDirectPolygons,
          'nonzero'
        )
      )
    }

    return cacheOutsideClipResult([])
  } catch {
    emitStrokePipelineCounter('source-path-legal-clip-error')
    return []
  }
}

const subtractInsideLegalResidue = (
  polygons: Vec2[][],
  legalRegions: PolygonRegion[],
  fillRule: 'evenodd' | 'nonzero'
) => {
  if (polygons.length === 0 || legalRegions.length === 0) {
    return polygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.difference) {
      return polygons
    }

    let productPolygons = polygons.map(cleanPolygon).filter(hasPolygonGeometry)
    if (productPolygons.length === 0) {
      return []
    }

    const getTotalAbsPolygonArea = (subjectPolygons: Vec2[][]) =>
      subjectPolygons.reduce(
        (total, polygon) => total + Math.abs(polygonArea(polygon)),
        0
      )

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const outsideResidue = getCoveragePolygonsFromRegions(
        backend.difference(
          toCoveragePolygonRegions(productPolygons),
          legalRegions,
          fillRule
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      if (outsideResidue.length === 0) {
        return productPolygons
      }

      const residueArea = getTotalAbsPolygonArea(outsideResidue)
      if (residueArea <= EPSILON) {
        return productPolygons
      }

      emitStrokePipelineCounter('inside-legal-residue-subtracted')
      const clippedPolygons = getCoveragePolygonsFromRegions(
        backend.difference(
          toCoveragePolygonRegions(productPolygons),
          toCoveragePolygonRegions(outsideResidue),
          'nonzero'
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      if (clippedPolygons.length === 0) {
        return []
      }
      productPolygons = clippedPolygons
    }

    return getCoveragePolygonsFromRegions(
      backend.intersection(
        toCoveragePolygonRegions(productPolygons),
        legalRegions,
        fillRule
      )
    )
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)
  } catch {
    emitStrokePipelineCounter('inside-legal-residue-subtract-error')
    return polygons
  }
}

const clipInsidePolygonsToImplicitFillRegionsStrict = (
  polygons: Vec2[][],
  implicitFillRegions: PolygonRegion[]
) => {
  if (polygons.length === 0 || implicitFillRegions.length === 0) {
    return polygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.intersection) {
      return []
    }

    const backendSignature = getGeometryBackendCacheSignature(backend)
    const legalRegions = getNormalizedImplicitFillRegions(
      backend,
      backendSignature,
      implicitFillRegions
    )
    if (legalRegions.length === 0) {
      return []
    }

    const subjectPolygons = polygons
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)
    if (subjectPolygons.length === 0) {
      return []
    }

    const clippedPolygons = getCoveragePolygonsFromRegions(
      backend.intersection(
        toCoveragePolygonRegions(subjectPolygons),
        legalRegions,
        'nonzero'
      )
    )
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)

    return subtractInsideLegalResidue(clippedPolygons, legalRegions, 'nonzero')
  } catch {
    emitStrokePipelineCounter('inside-strict-implicit-fill-clip-error')
    return []
  }
}

const enforceInsideImplicitFillProductDomain = (
  polygons: Vec2[][],
  path: SourcePathWithOptionalSamples | undefined,
  stroke: Pick<RenderableStroke, 'position'>,
  implicitFillRegions: PolygonRegion[] = []
) => {
  if (
    stroke.position !== 'inside' ||
    !path ||
    polygons.length === 0 ||
    implicitFillRegions.length === 0
  ) {
    return polygons
  }

  const clippedPolygons = clipSourcePathPolygonsToEvenOddLegalDomain(
    polygons,
    path,
    stroke,
    implicitFillRegions,
    {
      dropEmptyInsideClipResult: true,
      restoreSubjectBoundaryPolygons: [],
      restoreSubjectBoundaryPaths: [],
      fragmentStitchRadius: 0,
      fragmentPruneArea: 0,
      cleanupMicroEdgeTolerance: 0.001,
      cleanupCollinearTolerance: 0.0001
    }
  )
  return clipInsidePolygonsToImplicitFillRegionsStrict(
    clippedPolygons,
    implicitFillRegions
  )
}
const normalizeConstrainedDashedProductPolygons = (
  polygons: Vec2[][],
  options: {
    cleanClipResidue?: boolean
    mergeContinuousInterval?: boolean
  } = {}
) => {
  if (
    options.cleanClipResidue !== true &&
    options.mergeContinuousInterval !== true &&
    polygons.length > 0 &&
    polygons.every(hasPolygonGeometry) &&
    !polygonsHaveOverlappingBounds(polygons)
  ) {
    emitStrokePipelineCounter('product-normalize-clean-input-skipped')
    return polygons
  }

  const normalizePolygons = options.cleanClipResidue
    ? cleanClippedProductPolygons
    : (inputPolygons: Vec2[][]) =>
        inputPolygons.map(cleanPolygon).filter(hasPolygonGeometry)
  const subjectPolygons = normalizePolygons(polygons)
  if (subjectPolygons.length <= 1) {
    return subjectPolygons
  }
  if (
    options.mergeContinuousInterval !== true &&
    !polygonsHaveOverlappingBounds(subjectPolygons)
  ) {
    emitStrokePipelineCounter('product-normalize-union-skipped')
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.union) {
      return subjectPolygons
    }

    const normalizedPolygons = getCoveragePolygonsFromRegions(
      backend.union(toCoveragePolygonRegions(subjectPolygons), 'nonzero')
    )
    return normalizedPolygons.length > 0
      ? normalizePolygons(normalizedPolygons)
      : subjectPolygons
  } catch {
    return subjectPolygons
  }
}

const stitchClippedProductFragments = (polygons: Vec2[][], radius: number) => {
  const subjectPolygons =
    radius > EPSILON
      ? cleanClippedProductPolygons(polygons)
      : polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length <= 1 || radius <= EPSILON) {
    return subjectPolygons
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.offset || !backend.capabilities.union) {
      return subjectPolygons
    }

    const stitchOptions = {
      width: radius * 2,
      join: 'round' as const,
      cap: 'round' as const,
      closed: true,
      miterLimit: 2,
      fillRule: 'nonzero' as const
    }
    const expanded = backend.offset(subjectPolygons, radius, stitchOptions)
    const mergedExpanded = backend.union(expanded, 'nonzero')
    const contracted = backend.offset(
      getCoveragePolygonsFromRegions(mergedExpanded),
      -radius,
      stitchOptions
    )
    const stitched = cleanClippedProductPolygons(
      getCoveragePolygonsFromRegions(backend.union(contracted, 'nonzero'))
    )
    const subjectArea = subjectPolygons.reduce(
      (total, polygon) => total + Math.abs(polygonArea(polygon)),
      0
    )
    const stitchedArea = stitched.reduce(
      (total, polygon) => total + Math.abs(polygonArea(polygon)),
      0
    )
    const closesNarrowResidue =
      stitchedArea > subjectArea + EPSILON &&
      stitchedArea <= subjectArea + Math.PI * radius * radius * 4

    return stitched.length > 0 &&
      (stitched.length < subjectPolygons.length ||
        getClippedProductMicroEdgeCount(stitched) <
          getClippedProductMicroEdgeCount(subjectPolygons) ||
        closesNarrowResidue)
      ? stitched
      : subjectPolygons
  } catch {
    return subjectPolygons
  }
}

const pruneSmallClippedProductFragments = (
  polygons: Vec2[][],
  minArea: number
) => {
  const subjectPolygons =
    minArea > EPSILON
      ? cleanClippedProductPolygons(polygons)
      : polygons.map(cleanPolygon).filter(hasPolygonGeometry)
  if (subjectPolygons.length <= 1 || minArea <= EPSILON) {
    return subjectPolygons
  }

  const polygonAreas = subjectPolygons.map((polygon) =>
    Math.abs(polygonArea(polygon))
  )
  const maxArea = Math.max(...polygonAreas)
  if (maxArea <= EPSILON) {
    return subjectPolygons
  }

  const filtered = subjectPolygons.filter((_, index) => {
    const area = polygonAreas[index]
    return area >= minArea || area / maxArea >= 0.12
  })

  return filtered.length > 0 ? filtered : subjectPolygons
}

const getPolygonBounds = (polygon: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

const getPolylineBounds = (polyline: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of polyline) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

const polylineBoundsCache = new WeakMap<Vec2[], Bounds>()

const getCachedPolylineBounds = (polyline: Vec2[]) => {
  const cached = polylineBoundsCache.get(polyline)
  if (cached) {
    return cached
  }

  const bounds = getPolylineBounds(polyline)
  polylineBoundsCache.set(polyline, bounds)
  return bounds
}

const boundsOverlapBounds = (first: Bounds, second: Bounds) =>
  first.minX <= second.maxX + EPSILON &&
  first.maxX + EPSILON >= second.minX &&
  first.minY <= second.maxY + EPSILON &&
  first.maxY + EPSILON >= second.minY

const segmentBoundsOverlapPolygon = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  polygon: Vec2[]
) => {
  const bounds = getPolygonBounds(polygon)
  return boundsOverlapBounds(
    {
      minX: Math.min(segmentStart.x, segmentEnd.x),
      minY: Math.min(segmentStart.y, segmentEnd.y),
      maxX: Math.max(segmentStart.x, segmentEnd.x),
      maxY: Math.max(segmentStart.y, segmentEnd.y)
    },
    bounds
  )
}

const segmentBoundsOverlapBounds = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  bounds: Bounds
) =>
  Math.min(segmentStart.x, segmentEnd.x) <= bounds.maxX + EPSILON &&
  Math.max(segmentStart.x, segmentEnd.x) + EPSILON >= bounds.minX &&
  Math.min(segmentStart.y, segmentEnd.y) <= bounds.maxY + EPSILON &&
  Math.max(segmentStart.y, segmentEnd.y) + EPSILON >= bounds.minY

const segmentBoundsOverlapSegment = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
) =>
  Math.min(firstStart.x, firstEnd.x) <=
    Math.max(secondStart.x, secondEnd.x) + EPSILON &&
  Math.max(firstStart.x, firstEnd.x) + EPSILON >=
    Math.min(secondStart.x, secondEnd.x) &&
  Math.min(firstStart.y, firstEnd.y) <=
    Math.max(secondStart.y, secondEnd.y) + EPSILON &&
  Math.max(firstStart.y, firstEnd.y) + EPSILON >=
    Math.min(secondStart.y, secondEnd.y)

const pointSegmentDistanceSquared = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON * EPSILON) {
    const defaultDx = point.x - start.x
    const defaultDy = point.y - start.y
    return defaultDx * defaultDx + defaultDy * defaultDy
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )

  const projectedX = start.x + dx * t
  const projectedY = start.y + dy * t
  const projectedDx = point.x - projectedX
  const projectedDy = point.y - projectedY
  return projectedDx * projectedDx + projectedDy * projectedDy
}

const pointSegmentDistanceSquaredToPolygon = (point: Vec2, polygon: Vec2[]) =>
  polygon.reduce((minimumDistanceSquared, currentPoint, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length]
    return Math.min(
      minimumDistanceSquared,
      pointSegmentDistanceSquared(point, currentPoint, nextPoint)
    )
  }, Number.POSITIVE_INFINITY)

const isPointNearPolyline = (
  point: Vec2,
  polyline: Vec2[],
  maxDistance: number
) => {
  if (polyline.length === 0) {
    return false
  }

  const maxDistanceSquared = maxDistance * maxDistance
  if (polyline.length === 1) {
    const dx = point.x - polyline[0].x
    const dy = point.y - polyline[0].y
    return dx * dx + dy * dy <= maxDistanceSquared
  }

  for (let index = 0; index < polyline.length - 1; index += 1) {
    if (
      pointSegmentDistanceSquared(
        point,
        polyline[index],
        polyline[index + 1]
      ) <= maxDistanceSquared
    ) {
      return true
    }
  }
  return false
}

const countSourceEdgeVertices = (polygons: Vec2[][], source: Vec2[]) =>
  polygons.reduce(
    (count, polygon) =>
      count +
      polygon.filter((point) => isPointNearPolyline(point, source, 0.5)).length,
    0
  )

interface SegmentIntersectionHit {
  point: Vec2
  polygonEdgeIndex: number
  polygonT: number
  boundaryEdgeIndex: number
  boundaryT: number
  polygonPosition: number
  boundaryPosition: number
}

const segmentIntersectionWithParams = (
  polygonStart: Vec2,
  polygonEnd: Vec2,
  boundaryStart: Vec2,
  boundaryEnd: Vec2
) => {
  const rx = polygonEnd.x - polygonStart.x
  const ry = polygonEnd.y - polygonStart.y
  const sx = boundaryEnd.x - boundaryStart.x
  const sy = boundaryEnd.y - boundaryStart.y
  const denominator = rx * sy - ry * sx
  if (Math.abs(denominator) <= EPSILON) {
    return null
  }

  const qpx = boundaryStart.x - polygonStart.x
  const qpy = boundaryStart.y - polygonStart.y
  const t = (qpx * sy - qpy * sx) / denominator
  const u = (qpx * ry - qpy * rx) / denominator
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null
  }

  const clampedT = Math.max(0, Math.min(1, t))
  const clampedU = Math.max(0, Math.min(1, u))
  return {
    point: normalizePoint({
      x: polygonStart.x + rx * clampedT,
      y: polygonStart.y + ry * clampedT
    }),
    polygonT: clampedT,
    boundaryT: clampedU
  }
}

const getPolylineClipIntersections = (
  polygon: Vec2[],
  boundary: Vec2[]
): SegmentIntersectionHit[] => {
  const hits: SegmentIntersectionHit[] = []
  const polygonBounds = getPolygonBounds(polygon)
  for (
    let polygonEdgeIndex = 0;
    polygonEdgeIndex < polygon.length;
    polygonEdgeIndex += 1
  ) {
    const polygonStart = polygon[polygonEdgeIndex]
    const polygonEnd = polygon[(polygonEdgeIndex + 1) % polygon.length]
    for (
      let boundaryEdgeIndex = 0;
      boundaryEdgeIndex < boundary.length - 1;
      boundaryEdgeIndex += 1
    ) {
      const boundaryStart = boundary[boundaryEdgeIndex]
      const boundaryEnd = boundary[boundaryEdgeIndex + 1]
      if (
        !segmentBoundsOverlapBounds(boundaryStart, boundaryEnd, polygonBounds)
      ) {
        continue
      }
      if (
        !segmentBoundsOverlapSegment(
          polygonStart,
          polygonEnd,
          boundaryStart,
          boundaryEnd
        )
      ) {
        continue
      }
      const hit = segmentIntersectionWithParams(
        polygonStart,
        polygonEnd,
        boundaryStart,
        boundaryEnd
      )
      if (!hit) {
        continue
      }
      if (
        hits.some(
          (existing) => distanceBetween(existing.point, hit.point) <= EPSILON
        )
      ) {
        continue
      }
      hits.push({
        point: hit.point,
        polygonEdgeIndex,
        polygonT: hit.polygonT,
        boundaryEdgeIndex,
        boundaryT: hit.boundaryT,
        polygonPosition: polygonEdgeIndex + hit.polygonT,
        boundaryPosition: boundaryEdgeIndex + hit.boundaryT
      })
    }
  }

  return hits
}

const pushDedupePoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (!previous || distanceBetween(previous, point) > EPSILON) {
    points.push(point)
  }
}

const getPolygonPathBetweenHits = (
  polygon: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
) => {
  const result: Vec2[] = []
  pushDedupePoint(result, from.point)

  let vertexIndex = (from.polygonEdgeIndex + 1) % polygon.length
  while (vertexIndex !== (to.polygonEdgeIndex + 1) % polygon.length) {
    pushDedupePoint(result, polygon[vertexIndex])
    vertexIndex = (vertexIndex + 1) % polygon.length
  }

  pushDedupePoint(result, to.point)
  return result
}

const getBoundaryPathBetweenHits = (
  boundary: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
): Vec2[] => {
  if (from.boundaryPosition <= to.boundaryPosition) {
    const result: Vec2[] = []
    pushDedupePoint(result, from.point)
    for (
      let vertexIndex = from.boundaryEdgeIndex + 1;
      vertexIndex <= to.boundaryEdgeIndex;
      vertexIndex += 1
    ) {
      pushDedupePoint(result, boundary[vertexIndex])
    }
    pushDedupePoint(result, to.point)
    return result
  }

  return getBoundaryPathBetweenHits(boundary, to, from).reverse()
}

const getSelectedSideViolationScore = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  let score = 0
  for (const point of polygon) {
    let nearestCross = 0
    let nearestDistanceSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegmentSquared = pointSegmentDistanceSquared(
        point,
        start,
        end
      )
      if (distanceToSegmentSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceToSegmentSquared
        nearestCross = cross
      }
    }
    const violation = selectedSide > 0 ? -nearestCross : nearestCross
    if (violation > EPSILON) {
      score += violation
    }
  }
  return score
}

const isFullyOnSelectedSideOfBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return true
  }

  return polygon.every((point) => {
    let nearestCross = 0
    let nearestDistanceSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const cross = dx * (point.y - start.y) - dy * (point.x - start.x)
      const distanceToSegmentSquared = pointSegmentDistanceSquared(
        point,
        start,
        end
      )
      if (distanceToSegmentSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceToSegmentSquared
        nearestCross = cross
      }
    }
    return selectedSide > 0 ? nearestCross >= -EPSILON : nearestCross <= EPSILON
  })
}

const clipPolygonToSelectedSidePolylineIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return null
  }

  const hits = getPolylineClipIntersections(polygon, boundary).sort(
    (left, right) => left.boundaryPosition - right.boundaryPosition
  )
  if (hits.length < 2) {
    return null
  }

  const first = hits[0]
  const last = hits[hits.length - 1]
  const candidates = [
    cleanPolygon([
      ...getPolygonPathBetweenHits(polygon, first, last),
      ...getBoundaryPathBetweenHits(boundary, last, first).slice(1)
    ]),
    cleanPolygon([
      ...getPolygonPathBetweenHits(polygon, last, first),
      ...getBoundaryPathBetweenHits(boundary, first, last).slice(1)
    ])
  ].filter((candidate) => candidate.length >= 3)

  if (candidates.length === 0) {
    return null
  }

  return candidates.sort((left, right) => {
    const scoreDelta =
      getSelectedSideViolationScore(left, boundary, selectedSide) -
      getSelectedSideViolationScore(right, boundary, selectedSide)
    if (Math.abs(scoreDelta) > EPSILON) {
      return scoreDelta
    }
    return Math.abs(polygonArea(left)) - Math.abs(polygonArea(right))
  })[0]
}

const getBoundaryHead = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[0]]
  let length = 0
  for (let index = 1; index < boundary.length; index += 1) {
    const previous = boundary[index - 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPSILON) {
      break
    }
  }
  return result
}

const getBoundaryTail = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[boundary.length - 1]]
  let length = 0
  for (let index = boundary.length - 2; index >= 0; index -= 1) {
    const previous = boundary[index + 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPSILON) {
      break
    }
  }
  return result.reverse()
}

const getSourceSegmentBoundaryClipData = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  segmentIndex: number,
  reach: number,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentBoundaryClipData => {
  const boundary = getSourceSegmentBoundary(path, segmentIndex, slicingContext)
  if (!slicingContext) {
    const head = getBoundaryHead(boundary, reach)
    const tail = getBoundaryTail(boundary, reach)
    return {
      boundary,
      head,
      tail,
      headReference: head[head.length - 1] ?? boundary[0],
      tailReference: tail[0] ?? boundary[boundary.length - 1]
    }
  }

  const cacheKey = `${segmentIndex}:${reach.toFixed(6)}`
  const cached = slicingContext.segmentBoundaryClipCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const head = getBoundaryHead(boundary, reach)
  const tail = getBoundaryTail(boundary, reach)
  const data = {
    boundary,
    head,
    tail,
    headReference: head[head.length - 1] ?? boundary[0],
    tailReference: tail[0] ?? boundary[boundary.length - 1]
  }
  slicingContext.segmentBoundaryClipCache.set(cacheKey, data)
  return data
}

const getSelectedSideTowardPoint = (
  boundary: Vec2[],
  point: Vec2 | undefined,
  defaultSide: 1 | -1
): 1 | -1 => {
  if (!point || boundary.length < 2) {
    return defaultSide
  }

  let nearestCross = 0
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    const distanceToSegmentSquared = pointSegmentDistanceSquared(
      point,
      start,
      end
    )
    if (distanceToSegmentSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceToSegmentSquared
      nearestCross = cross
    }
  }

  if (Math.abs(nearestCross) <= EPSILON) {
    return defaultSide
  }
  return nearestCross > 0 ? 1 : -1
}

const clipPolygonToSelectedSideIfCrossing = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1,
  activationStart = segmentStart,
  activationEnd = segmentEnd
) => {
  if (
    polygon.length < 3 ||
    !segmentBoundsOverlapPolygon(activationStart, activationEnd, polygon)
  ) {
    return polygon
  }

  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  let hasInside = false
  let hasOutside = false

  for (const point of polygon) {
    const cross =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    const inside = selectedSide > 0 ? cross >= -EPSILON : cross <= EPSILON
    hasInside ||= inside
    hasOutside ||= !inside
    if (hasInside && hasOutside) {
      return clipPolygonToSelectedSideOfSegment(
        polygon,
        segmentStart,
        segmentEnd,
        selectedSide
      )
    }
  }

  return polygon
}

const clipPolygonToSelectedSideBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)) {
    return polygon
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }
  return currentPolygon
}

const clipPolygonToSelectedSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1,
  skipFullSideCheck = false
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (
    !boundsOverlapBounds(
      getPolygonBounds(polygon),
      getCachedPolylineBounds(boundary)
    )
  ) {
    return polygon
  }
  if (
    !skipFullSideCheck &&
    isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)
  ) {
    return polygon
  }

  const polylineClipped = clipPolygonToSelectedSidePolylineIfCrossing(
    polygon,
    boundary,
    selectedSide
  )
  if (polylineClipped) {
    return polylineClipped
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideIfCrossing(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }
  return currentPolygon
}

const clipPolygonToDominantSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[]
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (
    !boundsOverlapBounds(
      getPolygonBounds(polygon),
      getCachedPolylineBounds(boundary)
    )
  ) {
    return polygon
  }

  const positiveSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    1
  )
  const negativeSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    -1
  )
  const dominantSide: 1 | -1 =
    positiveSideViolationScore <= negativeSideViolationScore ? 1 : -1

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    dominantSide
  )
  if (clipped.length < 3 || isSimpleClosedPolygon(clipped)) {
    return clipped
  }

  const strictClipped = clipPolygonToSelectedSideBoundary(
    polygon,
    boundary,
    dominantSide
  )
  return strictClipped.length >= 3 &&
    (isSimpleClosedPolygon(strictClipped) ||
      Math.abs(polygonArea(strictClipped)) < Math.abs(polygonArea(clipped)))
    ? strictClipped
    : clipped
}

const clipPolygonToSelectedSideBoundaryOrDropRejected = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }
  if (isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)) {
    return polygon
  }

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    selectedSide,
    true
  )
  if (
    clipped.length >= 3 &&
    isFullyOnSelectedSideOfBoundary(clipped, boundary, selectedSide)
  ) {
    return clipped
  }

  const strictClipped = clipPolygonToSelectedSideBoundary(
    clipped,
    boundary,
    selectedSide
  )
  if (
    strictClipped.length >= 3 &&
    isFullyOnSelectedSideOfBoundary(strictClipped, boundary, selectedSide)
  ) {
    return strictClipped
  }

  return []
}

const applyClosedIntervalSelectedSideGuards = (
  polygons: Vec2[][],
  closed: boolean,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >,
  sharpGuardVertices: SharpGuardVertex[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  totalLength: number,
  authoredStroke: Pick<RenderableStroke, 'position' | 'dashPattern' | 'join'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  if (
    !closed ||
    polygons.length === 0 ||
    authoredStroke.position !== 'inside' ||
    sharpGuardVertices.length === 0
  ) {
    return polygons
  }

  const guardVertices = getIntervalGuardVertices(
    sharpGuardVertices,
    segmentRanges,
    interval,
    totalLength
  )

  const selectedSide = intervalStroke.position === 'inside' ? 1 : -1
  const crossingGuardReach = Math.max(
    intervalStroke.width * 2,
    authoredStroke.dashPattern[0] ?? intervalStroke.width
  )
  const clippedPolygons: Vec2[][] = []

  for (const polygon of polygons) {
    let currentPolygon = polygon

    if (guardVertices.length > 0) {
      for (const guard of guardVertices) {
        if (currentPolygon.length < 3) {
          break
        }

        const startsAtGuard = isIntervalStartAtGuard(
          interval,
          guard,
          totalLength
        )
        const endsAtGuard = isIntervalEndAtGuard(interval, guard, totalLength)
        const spansAcrossGuard = !startsAtGuard && !endsAtGuard

        if (startsAtGuard || spansAcrossGuard) {
          currentPolygon = clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getBoundaryTail(guard.previousBoundary, crossingGuardReach),
            selectedSide
          )
        }
        if (currentPolygon.length < 3) {
          break
        }
        if (endsAtGuard || spansAcrossGuard) {
          currentPolygon = clipPolygonToSelectedSideBoundary(
            currentPolygon,
            getBoundaryHead(guard.nextBoundary, crossingGuardReach),
            selectedSide
          )
        }
        if (currentPolygon.length < 3) {
          break
        }
      }
    }

    for (const guard of sharpGuardVertices) {
      if (currentPolygon.length < 3) {
        break
      }

      if (guardVertices.includes(guard)) {
        continue
      }

      const startsAtGuard = isIntervalStartAtGuard(interval, guard, totalLength)
      const endsAtGuard = isIntervalEndAtGuard(interval, guard, totalLength)

      if (!endsAtGuard) {
        currentPolygon = clipPolygonToSelectedSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryTail(guard.previousBoundary, crossingGuardReach),
          selectedSide
        )
      }
      if (currentPolygon.length < 3) {
        break
      }
      if (!startsAtGuard) {
        currentPolygon = clipPolygonToSelectedSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryHead(guard.nextBoundary, crossingGuardReach),
          selectedSide
        )
      }
    }

    if (currentPolygon.length >= 3) {
      clippedPolygons.push(currentPolygon)
    }
  }

  return clippedPolygons
}

export const buildConstrainedDashedStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedDashedStrokeOptions = {}
): SolidCenterStrokeResolvedPacket[] => {
  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const totalLength = topology.totalLength
  const ownerPrefix =
    options.metadata?.ownerKeyPrefix ?? 'anonymous-constrained-dashed-source'
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const legalDomainId =
    options.metadata?.legalDomainId ?? primaryContour?.legalDomainId
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  const sourcePaintBounds = getBounds([topologyPoints])
  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const sourcePath = options.sourcePath

    const sharpGuardVertices =
      topology.closed &&
      topology.topologyFamily !== 'degenerate' &&
      (sourcePath ||
        (options.selectedSideGuardPoints &&
          options.selectedSideGuardPoints.length !== topologyPoints.length))
        ? buildSharpGuardVertices(
            topologyPoints,
            segmentRanges,
            options.selectedSideGuardPoints,
            sourcePath,
            !sourcePath
          )
        : []
    const strokeDomainPlan = measureStrokePipelinePhase(
      'constrained dashed packets: domain plan',
      () =>
        resolveStrokeDomains({
          topology,
          sourceFamily: resolveSourceFamily({ topology, stroke }),
          stroke,
          sourcePath,
          implicitFillRegions: options.implicitFillRegions,
          sharedSourceSplitRanges: options.sharedSourceSplitRanges,
          sharedStrokeBoundaryDomains: options.sharedStrokeBoundaryDomains
        })
    )
    const allocatedVisibleIntervals = measureStrokePipelinePhase(
      'constrained dashed packets: interval allocation',
      () =>
        getConstrainedDashedVisibleIntervals(
          topology,
          stroke,
          sourcePath,
          strokeDomainPlan
        )
    )
    if (allocatedVisibleIntervals.length === 0) {
      return []
    }

    const visibleIntervals = allocatedVisibleIntervals.filter(
      (interval) =>
        getFormalProductDomainModeForInterval(strokeDomainPlan, interval) !==
        null
    )
    const sourceSpanProvenance = resolveSourceSpanProvenanceAvailability()
    const intervalSignature = measureStrokePipelinePhase(
      'constrained dashed packets: interval signature',
      () =>
        sourceSpanProvenance.available
          ? buildVisibleIntervalSignature(visibleIntervals)
          : ''
    )
    let sourceSpanGraphForDebug:
      | ReturnType<typeof buildSourceSpanGraph>
      | null
      | undefined
    const getSourceSpanGraphForDebug = () => {
      if (!sourceSpanProvenance.available) {
        return null
      }
      if (sourceSpanGraphForDebug !== undefined) {
        return sourceSpanGraphForDebug
      }
      sourceSpanGraphForDebug = measureStrokePipelinePhase(
        'constrained dashed packets: source span graph',
        () => {
          const sourceSpanGraphCacheKey = buildSourceSpanGraphCacheKey(
            topology,
            intervalSignature
          )
          const cached = getCachedSourceSpanGraph(sourceSpanGraphCacheKey)
          if (cached) {
            return cached
          }

          const graph = buildSourceSpanGraph(topology, visibleIntervals)
          setCachedSourceSpanGraph(sourceSpanGraphCacheKey, graph)
          return graph
        }
      )
      return sourceSpanGraphForDebug
    }
    const getSourceSpanIdsForDebug = (
      interval: VisibleDashedTopologyInterval
    ) => {
      if (options.metadata?.sourceSpanIds) {
        return options.metadata.sourceSpanIds
      }
      if (!options.includeSourceSpanDebugIds) {
        return []
      }
      const graph = getSourceSpanGraphForDebug()
      return graph ? getSourceSpanIdsForInterval(graph, interval) : []
    }

    if (visibleIntervals.length === 0) {
      return []
    }

    const baseDomainMode = getFormalProductDomainModeForIntervals(
      strokeDomainPlan,
      visibleIntervals
    )
    if (!baseDomainMode) {
      return []
    }

    if (baseDomainMode === 'center-product') {
      const rawStroke = getRawStrokeForRenderableIndex(strokes, strokeIndex)
      if (!rawStroke) {
        return []
      }

      return buildDashedCenterStrokeResolvedPackets(
        cachePrefix,
        points,
        closed,
        [
          {
            ...rawStroke,
            position: 'center'
          }
        ],
        {
          topology,
          sourcePath,
          metadata: options.metadata
        }
      )
    }

    const intervalStroke = getIntervalStrokeForProductDomainMode(
      topologyPoints,
      topology.closed,
      stroke,
      topology.topologyFamily,
      baseDomainMode
    )
    const baseProductSignature = [
      'constrained-dashed',
      baseDomainMode,
      stroke.position,
      stroke.cap,
      stroke.join,
      intervalSignature
    ].join(':')
    const baseRevisionSet = buildStrokeRuntimeRevisionSet({
      points: topologyPoints,
      closed: topology.closed,
      stroke,
      productMode: baseDomainMode,
      domainMode: baseDomainMode,
      ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
      networkId: options.metadata?.networkId,
      strokeId: `stroke:${strokeIndex}`,
      intervalSignature,
      strokeProductSignature: baseProductSignature,
      strokeDomainSignature: [
        baseDomainMode,
        stroke.position,
        contourId ?? '',
        legalDomainId ?? '',
        strokeDomainPlan.planId
      ].join(':'),
      endpointCapPolicySignature: [
        'terminal-policy',
        baseDomainMode,
        stroke.cap,
        intervalSignature
      ].join(':'),
      joinOwnershipSignature: [
        'join-ownership',
        baseDomainMode,
        stroke.join,
        stroke.miterLimit
      ].join(':'),
      smoothContinuitySignature: [
        'smooth-continuity',
        baseDomainMode,
        intervalSignature
      ].join(':'),
      productMaterializationSignature: [
        'product-materialization',
        baseDomainMode,
        intervalSignature
      ].join(':'),
      ownerCount: Math.max(
        strokeDomainPlan.splitRangeDomains.length,
        strokeDomainPlan.legalBoundaryDomains.length,
        1
      )
    })
    const revisionSetByProductSignature = new Map<
      string,
      SolidCenterStrokeGeometryDebugMeta['revisionSet']
    >()
    const getRevisionSet = (
      productSignature: string,
      metadata: {
        endpointCapPolicySignature?: string
        joinOwnershipSignature?: string
        smoothContinuitySignature?: string
        productMaterializationSignature?: string
        resolvedRegionSignature?: string
        renderOutputSignature?: string
        ownerCount?: number
        productDomainMode?: StrokeDomainMode
      } = {}
    ) => {
      if (!baseRevisionSet) {
        return undefined
      }
      const existing = revisionSetByProductSignature.get(productSignature)
      if (existing) {
        return existing
      }
      const revisionDomainMode = metadata.productDomainMode ?? baseDomainMode

      const revisionSet = updateStrokeRuntimeRevisionSetFromMetadata(
        baseRevisionSet,
        {
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          productMode: revisionDomainMode,
          domainMode: revisionDomainMode,
          strokeProductSignature: productSignature,
          strokeDomainSignature: [
            revisionDomainMode,
            stroke.position,
            contourId ?? '',
            legalDomainId ?? '',
            strokeDomainPlan.planId
          ].join(':'),
          endpointCapPolicySignature:
            metadata.endpointCapPolicySignature ??
            [
              'terminal-policy',
              revisionDomainMode,
              stroke.cap,
              productSignature
            ].join(':'),
          joinOwnershipSignature:
            metadata.joinOwnershipSignature ??
            [
              'join-ownership',
              revisionDomainMode,
              stroke.join,
              productSignature
            ].join(':'),
          smoothContinuitySignature:
            metadata.smoothContinuitySignature ??
            ['smooth-continuity', revisionDomainMode, productSignature].join(
              ':'
            ),
          productMaterializationSignature:
            metadata.productMaterializationSignature ??
            [
              'product-materialization',
              revisionDomainMode,
              productSignature
            ].join(':'),
          resolvedRegionSignature:
            metadata.resolvedRegionSignature ??
            ['resolved-region', revisionDomainMode, productSignature].join(':'),
          renderOutputSignature:
            metadata.renderOutputSignature ??
            ['render-output', revisionDomainMode, productSignature].join(':'),
          ownerCount: metadata.ownerCount
        }
      )
      revisionSetByProductSignature.set(productSignature, revisionSet)
      return revisionSet
    }

    const sourcePathSlicingContext = sourcePath
      ? createSourcePathSlicingContext(sourcePath)
      : undefined
    const topologySourcePath = sourcePath
      ? null
      : buildPolylineGeometryModelPath(topologyPoints, topology.closed)
    const topologySourcePathSlicingContext = topologySourcePath
      ? createSourcePathSlicingContext(topologySourcePath)
      : undefined
    const boundaryDomainPathByPlanEntryKey = new Map<
      string,
      PathGeometry | null
    >()
    const boundaryDomainFrameCacheKeyByPoints = new WeakMap<
      Vec2[],
      string | null
    >()
    const getFrameBoundaryDomainPathCacheKey = (
      interval: VisibleDashedTopologyInterval
    ) => {
      if (!interval.domainPlanBoundaryPoints) {
        return null
      }
      const cached = boundaryDomainFrameCacheKeyByPoints.get(
        interval.domainPlanBoundaryPoints
      )
      if (cached !== undefined) {
        return cached
      }
      const key = getBoundaryDomainPathFrameCacheKey(interval)
      boundaryDomainFrameCacheKeyByPoints.set(
        interval.domainPlanBoundaryPoints,
        key
      )
      return key
    }
    const getBoundaryDomainPathForVisibleInterval = (
      interval: VisibleDashedTopologyInterval
    ) => {
      if (
        !hasBoundaryDomainDistanceMapping(interval) ||
        isClosedConstrainedSourceCoverageInterval(interval)
      ) {
        return null
      }
      const frameCacheKey = getFrameBoundaryDomainPathCacheKey(interval)
      if (
        frameCacheKey &&
        boundaryDomainPathByPlanEntryKey.has(frameCacheKey)
      ) {
        return boundaryDomainPathByPlanEntryKey.get(frameCacheKey) ?? null
      }

      const path = buildBoundaryDomainPathForInterval(interval)
      if (frameCacheKey) {
        boundaryDomainPathByPlanEntryKey.set(frameCacheKey, path)
      }
      return path
    }
    const boundaryDomainSlicingContextCache = new WeakMap<
      PathGeometry,
      SourcePathSlicingContext
    >()
    const getBoundaryDomainSlicingContext = (
      boundaryDomainPath: PathGeometry
    ) => {
      const cached = boundaryDomainSlicingContextCache.get(boundaryDomainPath)
      if (cached) {
        return cached
      }

      const context = createSourcePathSlicingContext(
        boundaryDomainPath,
        SOURCE_PATH_DASH_SLICE_TOLERANCE,
        SOURCE_PATH_DASH_SLICE_SAMPLING,
        ROUND_CAP_VISUAL_MAX_LENGTH
      )
      boundaryDomainSlicingContextCache.set(boundaryDomainPath, context)
      return context
    }
    const boundaryDomainMaterializationIntervalCache = new WeakMap<
      VisibleDashedTopologyInterval,
      VisibleDashedTopologyInterval
    >()
    const getBoundaryDomainMaterializationInterval = (
      interval: VisibleDashedTopologyInterval
    ) => {
      const cached = boundaryDomainMaterializationIntervalCache.get(interval)
      if (cached) {
        return cached
      }

      const materialized =
        resolveBoundaryDomainIntervalForMaterialization(interval)
      boundaryDomainMaterializationIntervalCache.set(interval, materialized)
      return materialized
    }
    const closedIntervalLegalityContext = buildClosedIntervalLegalityContext(
      topologyPoints,
      topology.closed,
      stroke
    )
    const canUseClosedHalfPlaneLegality =
      topology.isSimpleClosed &&
      isConvexClosedBoundary(topologyPoints, topology.closed)
    const constrainedStrokePosition =
      stroke.position === 'inside' || stroke.position === 'outside'
        ? stroke.position
        : null
    const insideDescriptorClipPolygons =
      stroke.position === 'inside' && options.clipInsideToFillDomain === true
        ? getCoveragePolygonsFromRegions(options.implicitFillRegions ?? [])
        : []
    const outsideDescriptorExcludePolygons =
      stroke.position === 'outside' && options.clipInsideToFillDomain === true
        ? getCoveragePolygonsFromRegions(options.implicitFillRegions ?? [])
        : []
    const insideAggregateDescriptorCandidateIntervals =
      insideDescriptorClipPolygons.length > 0 ? visibleIntervals : []
    const insideAggregateDescriptorCandidateIntervalIds = new Set(
      insideAggregateDescriptorCandidateIntervals.map(
        (interval) => interval.intervalId
      )
    )
    const outsideAggregateDescriptorCandidateIntervals =
      outsideDescriptorExcludePolygons.length > 0
        ? visibleIntervals.filter(
            (interval) =>
              (interval.domainPlanTerminalRole ?? 'middle') === 'middle'
          )
        : []
    const outsideAggregateDescriptorCandidateIntervalIds = new Set(
      outsideAggregateDescriptorCandidateIntervals.map(
        (interval) => interval.intervalId
      )
    )
    const shouldBuildSourceVertexBoundaryJoinProducts =
      constrainedStrokePosition !== null && visibleIntervals.length > 0
    const sourceVertexBoundaryTerminalRecords =
      shouldBuildSourceVertexBoundaryJoinProducts
        ? measureStrokePipelinePhase(
            'constrained dashed packets: join terminal records',
            () =>
              collectConstrainedBoundarySourceVertexTerminalRecords(
                visibleIntervals,
                constrainedStrokePosition
              )
          )
        : []
    const sourceVertexRecords =
      sourcePath && shouldBuildSourceVertexBoundaryJoinProducts
        ? measureStrokePipelinePhase(
            'constrained dashed packets: source vertex records',
            () => getSourceVertexRecords(sourcePath, new Map())
          )
        : []
    const sourceVertexBoundaryJoinPlans =
      shouldBuildSourceVertexBoundaryJoinProducts
        ? measureStrokePipelinePhase(
            'constrained dashed packets: join ownership plans',
            () => [
              ...measureStrokePipelinePhase(
                'constrained dashed packets: terminal pair join plans',
                () =>
                  buildConstrainedBoundaryTerminalPairJoinPlans(
                    visibleIntervals,
                    stroke,
                    {
                      implicitFillRegions: options.implicitFillRegions,
                      terminalRecords: sourceVertexBoundaryTerminalRecords
                    }
                  )
              ),
              ...measureStrokePipelinePhase(
                'constrained dashed packets: source vertex join plans',
                () =>
                  buildConstrainedBoundarySourceVertexJoinPlans(
                    sourcePath ?? null,
                    visibleIntervals,
                    stroke,
                    {
                      implicitFillRegions: options.implicitFillRegions,
                      sourceVertexRecords,
                      terminalRecords: sourceVertexBoundaryTerminalRecords
                    }
                  )
              )
            ]
          )
        : []
    const joinEffectiveSignatureByPlan =
      sourceVertexBoundaryJoinPlans.length > 0
        ? new WeakMap<SourceVertexBoundaryJoinPlan, string>()
        : null
    const sourceVertexJoinSignatureBoundaryCache: SourceVertexJoinBoundaryCache =
      new Map()
    const getFrameJoinEffectiveSignature = (
      plan: SourceVertexBoundaryJoinPlan
    ) => {
      const cached = joinEffectiveSignatureByPlan?.get(plan)
      if (cached) {
        return cached
      }

      const signature = getSourceVertexBoundaryJoinEffectiveSignature(
        plan,
        sourcePath ?? null,
        stroke,
        sourceVertexJoinSignatureBoundaryCache
      )
      joinEffectiveSignatureByPlan?.set(plan, signature)
      return signature
    }
    const packetStageJoinOwnershipSignature =
      sourceVertexBoundaryJoinPlans.length > 0
        ? [
            'join-ownership',
            stroke.join,
            sourceVertexBoundaryJoinPlans
              .map((plan) => getFrameJoinEffectiveSignature(plan))
              .join(';')
          ].join(':')
        : 'source-path'
    const packetStageSourcePath = sourcePath ?? topologySourcePath
    const packetStageOrigin = packetStageSourcePath
      ? getPathTranslationCacheOrigin(packetStageSourcePath)
      : null
    const packetStageCacheKeys = measureStrokePipelinePhase(
      'constrained dashed packets: packet stage cache keys',
      () => {
        const sourcePathSignature =
          packetStageSourcePath && packetStageOrigin
            ? buildTranslationInvariantPathCacheKey(
                packetStageSourcePath,
                packetStageOrigin
              )
            : null
        const packetStageKey = sourcePathSignature
          ? buildConstrainedDashedPacketStageCacheKey(
              sourcePathSignature,
              stroke,
              {
                cachePrefix,
                ownerPrefix,
                strokeIndex,
                domainMode: baseDomainMode,
                intervalSignature,
                joinOwnershipSignature: packetStageJoinOwnershipSignature,
                clipInsideToFillDomain: options.clipInsideToFillDomain === true,
                implicitFillRegions: options.implicitFillRegions ?? [],
                sharedStrokeBoundaryDomains:
                  options.sharedStrokeBoundaryDomains ?? []
              }
            )
          : null
        const joinIndependentKey = sourcePathSignature
          ? buildConstrainedDashedJoinIndependentPacketStageCacheKey(
              sourcePathSignature,
              stroke,
              {
                cachePrefix,
                ownerPrefix,
                strokeIndex,
                domainMode: baseDomainMode,
                intervalSignature,
                clipInsideToFillDomain: options.clipInsideToFillDomain === true,
                implicitFillRegions: options.implicitFillRegions ?? [],
                sharedStrokeBoundaryDomains:
                  options.sharedStrokeBoundaryDomains ?? []
              }
            )
          : null
        return {
          packetStageKey,
          joinIndependentKey,
          sourcePathSignature
        }
      }
    )
    const packetStageCacheKey = packetStageCacheKeys.packetStageKey
    const joinIndependentPacketStageCacheKey =
      packetStageCacheKeys.joinIndependentKey
    const cachedPacketStage = measureStrokePipelinePhase(
      'constrained dashed packets: packet stage cache lookup',
      () =>
        packetStageCacheKey && packetStageOrigin
          ? getCachedConstrainedDashedPacketStage(
              packetStageCacheKey,
              packetStageOrigin,
              stroke
            )
          : null
    )
    if (cachedPacketStage) {
      return cachedPacketStage
    }
    const cachedJoinIndependentPacketStage = measureStrokePipelinePhase(
      'constrained dashed packets: join-independent packet stage cache lookup',
      () =>
        joinIndependentPacketStageCacheKey && packetStageOrigin
          ? getCachedConstrainedDashedJoinIndependentPacketStage(
              joinIndependentPacketStageCacheKey,
              packetStageOrigin,
              stroke
            )
          : null
    )
    if (
      cachedJoinIndependentPacketStage &&
      sourceVertexBoundaryJoinPlans.length === 0
    ) {
      return cachedJoinIndependentPacketStage
    }
    const intervalsToMaterialize = cachedJoinIndependentPacketStage
      ? []
      : visibleIntervals
    const sourceVertexBoundaryJoinPlansByIntervalId =
      measureStrokePipelinePhase(
        'constrained dashed packets: join ownership plan index',
        () => {
          const plansByIntervalId = new Map<
            string,
            SourceVertexBoundaryJoinPlan[]
          >()
          sourceVertexBoundaryJoinPlans.forEach((plan) => {
            plan.intervals.forEach((ownerInterval) => {
              const plans =
                plansByIntervalId.get(ownerInterval.intervalId) ?? []
              plans.push(plan)
              plansByIntervalId.set(ownerInterval.intervalId, plans)
            })
          })
          return plansByIntervalId
        }
      )
    const domainPlanSplitRangeTerminalRecordCache = new WeakMap<
      VisibleDashedTopologyInterval,
      | NonNullable<
          SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
        >
      | undefined
    >()
    const buildDomainPlanSplitRangeTerminalRecords = (
      interval: VisibleDashedTopologyInterval
    ) => {
      if (domainPlanSplitRangeTerminalRecordCache.has(interval)) {
        return domainPlanSplitRangeTerminalRecordCache.get(interval)
      }

      const terminals: NonNullable<
        SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
      > = []
      const seenTerminalKeys = new Set<string>()
      const pushTerminal = (terminal: VisibleDashedTopologyInterval) => {
        if (
          !terminal.domainPlanSplitRangeId ||
          terminal.domainPlanSplitRangeStartDistance === undefined ||
          terminal.domainPlanSplitRangeEndDistance === undefined ||
          !terminal.domainPlanTerminalRole ||
          terminal.domainPlanTerminalRole === 'middle'
        ) {
          return
        }
        const key = [
          terminal.intervalId,
          terminal.domainPlanSplitRangeId,
          terminal.domainPlanTerminalRole,
          terminal.startDistance,
          terminal.endDistance
        ].join('|')
        if (seenTerminalKeys.has(key)) {
          return
        }
        seenTerminalKeys.add(key)
        terminals.push({
          intervalId: terminal.intervalId,
          boundaryDomainId: terminal.domainPlanBoundaryDomainId,
          boundaryPoints: terminal.domainPlanBoundaryPoints
            ? terminal.domainPlanBoundaryPoints.map((point) => ({ ...point }))
            : undefined,
          boundaryStartDistance: terminal.domainPlanBoundaryStartDistance,
          boundaryEndDistance: terminal.domainPlanBoundaryEndDistance,
          boundaryTotalLength: terminal.domainPlanBoundaryTotalLength,
          splitRangeId: terminal.domainPlanSplitRangeId,
          splitRangeStartDistance: terminal.domainPlanSplitRangeStartDistance,
          splitRangeEndDistance: terminal.domainPlanSplitRangeEndDistance,
          terminalRole: terminal.domainPlanTerminalRole,
          startDistance: terminal.startDistance,
          endDistance: terminal.endDistance,
          sourceSegmentIndex: terminal.domainPlanSplitRangeSourceSegmentIndex,
          selectedSide: terminal.domainPlanSelectedSide,
          filledSide: terminal.domainPlanFilledSide,
          unfilledSide: terminal.domainPlanUnfilledSide,
          boundaryRole: terminal.domainPlanBoundaryRole,
          domainMode: terminal.domainPlanDomainMode
        })
      }

      pushTerminal(interval)

      const records = terminals.length > 0 ? terminals : undefined
      domainPlanSplitRangeTerminalRecordCache.set(interval, records)
      return records
    }

    const getDescriptorProductSourceSegmentIndexes = (
      intervals: VisibleDashedTopologyInterval[],
      descriptorItems: {
        path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
        interval: Pick<
          DashedTopologyInterval,
          'startDistance' | 'endDistance' | 'wrapsSeam'
        >
        slicingContext: SourcePathSlicingContext
      }[]
    ) => {
      if (
        intervals.length > 0 &&
        intervals.every(
          (interval) =>
            interval.domainPlanSplitRangeSourceSegmentIndex !== undefined
        )
      ) {
        return uniqueNumbers(
          intervals.flatMap((interval) =>
            interval.domainPlanSplitRangeSourceSegmentIndex === undefined
              ? []
              : [interval.domainPlanSplitRangeSourceSegmentIndex]
          )
        )
      }

      return uniqueNumbers(
        descriptorItems.flatMap((item) =>
          splitVisibleIntervalBySourceSegments(
            item.path,
            item.interval,
            item.slicingContext
          ).map((range) => range.segmentIndex)
        )
      )
    }

    const buildSourceVertexBoundaryJoinPackets = (
      plans: SourceVertexBoundaryJoinPlan[],
      coveredProductPolygons: Vec2[][] = []
    ) => {
      const sourceVertexBoundaryJoinRecords =
        plans.length > 0
          ? measureStrokePipelinePhase(
              'constrained dashed packets: join ownership records',
              () =>
                materializeSourceVertexBoundaryJoinRecords(
                  plans,
                  sourcePath ?? null,
                  stroke,
                  {
                    implicitFillRegions: options.implicitFillRegions,
                    joinEffectiveSignatureByPlan:
                      joinEffectiveSignatureByPlan ?? undefined
                  }
                )
            )
          : []

      return sourceVertexBoundaryJoinRecords.length > 0
        ? measureStrokePipelinePhase(
            'constrained dashed packets: join ownership packets',
            () =>
              sourceVertexBoundaryJoinRecords.flatMap((record, recordIndex) => {
                if (record.polygons.length === 0) {
                  return []
                }

                const joinedIntervalIds = record.intervals
                  .map((interval) => interval.intervalId)
                  .sort()
                const joinedSourceSegmentIndexes = Array.from(
                  new Set(
                    record.intervals.flatMap((interval) =>
                      interval.domainPlanSplitRangeSourceSegmentIndex ===
                      undefined
                        ? []
                        : [interval.domainPlanSplitRangeSourceSegmentIndex]
                    )
                  )
                ).sort((a, b) => a - b)
                const joinOwnershipSignature = [
                  'constrained-boundary-source-vertex',
                  stroke.join,
                  formatTranslationInvariantCacheNumber(stroke.miterLimit),
                  record.kind,
                  joinedIntervalIds.join(',')
                ].join(':')
                const intervalProductDomainMode =
                  getFormalProductDomainModeForIntervals(
                    strokeDomainPlan,
                    record.intervals
                  )
                if (!intervalProductDomainMode) {
                  return []
                }
                const productSignature = [
                  'constrained-dashed',
                  intervalProductDomainMode,
                  'join-owned',
                  record.kind,
                  joinedIntervalIds.join(','),
                  joinOwnershipSignature
                ].join(':')
                const domainPlanSplitRangeTerminals = record.intervals.flatMap(
                  (interval) =>
                    buildDomainPlanSplitRangeTerminalRecords(interval) ?? []
                )
                const dashProductIntervals: NonNullable<
                  SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
                > = record.intervals.map((interval) => {
                  const boundaryDomainPath =
                    getBoundaryDomainPathForVisibleInterval(interval)
                  const endpointCapPolicy = getDashEndpointCapPolicy(
                    boundaryDomainPath ??
                      sourcePath ??
                      topologySourcePath ?? {
                        closed: topology.closed
                      },
                    interval
                  )
                  const endpointCapPolicySignature = [
                    'join-owned',
                    stroke.cap,
                    endpointCapPolicy.signature
                  ].join(':')
                  const fullCapReachDistance =
                    stroke.cap === 'butt' ? 0 : intervalStroke.width
                  const startCapReachDistance = endpointCapPolicy.startCap
                    ? fullCapReachDistance
                    : 0
                  const endCapReachDistance = endpointCapPolicy.endCap
                    ? fullCapReachDistance
                    : 0
                  return {
                    intervalId: interval.intervalId,
                    splitRangeId: interval.domainPlanSplitRangeId,
                    terminalRole: interval.domainPlanTerminalRole,
                    startDistance: interval.startDistance,
                    endDistance: interval.endDistance,
                    effectiveStartDistance: Math.max(
                      0,
                      interval.startDistance - startCapReachDistance
                    ),
                    effectiveEndDistance:
                      interval.endDistance + endCapReachDistance,
                    capReachDistance: Math.max(
                      startCapReachDistance,
                      endCapReachDistance
                    ),
                    boundaryDomainId: interval.domainPlanBoundaryDomainId,
                    boundaryRole: interval.domainPlanBoundaryRole,
                    selectedSide: interval.domainPlanSelectedSide,
                    filledSide: interval.domainPlanFilledSide,
                    unfilledSide: interval.domainPlanUnfilledSide,
                    sourceSegmentIndex:
                      interval.domainPlanSplitRangeSourceSegmentIndex,
                    endpointCapPolicySignature,
                    joinOwnershipSignature,
                    smoothContinuityGroupId: [
                      'join-owned',
                      joinOwnershipSignature,
                      interval.intervalId
                    ].join(':')
                  }
                })
                const dashEndpointCapPolicySignatures = uniqueStrings(
                  dashProductIntervals.map(
                    (interval) => interval.endpointCapPolicySignature
                  )
                )
                const smoothContinuityGroupIds = uniqueStrings(
                  dashProductIntervals.map(
                    (interval) => interval.smoothContinuityGroupId
                  )
                )
                const joinSmoothContinuityGroupId = [
                  'join-owned',
                  joinOwnershipSignature,
                  joinedIntervalIds.join(',')
                ].join(':')
                const geometryId = [
                  cachePrefix,
                  strokeIndex,
                  'join',
                  record.kind,
                  recordIndex,
                  joinedIntervalIds.join(',')
                ].join(':')
                const joinDescriptorPolygons =
                  coveredProductPolygons.length > 0
                    ? excludeDescriptorProductPolygons(
                        record.polygons,
                        coveredProductPolygons
                      )
                    : record.polygons
                const canonicalJoinDescriptorPolygons =
                  joinDescriptorPolygons.length > 1
                    ? (() => {
                        try {
                          const backend = getGeometryBackend()
                          return backend.capabilities.union
                            ? cleanClippedProductPolygons(
                                getCoveragePolygonsFromRegions(
                                  backend.union(
                                    toCoveragePolygonRegions(
                                      joinDescriptorPolygons
                                    ),
                                    'nonzero'
                                  )
                                )
                              )
                            : joinDescriptorPolygons
                        } catch {
                          return joinDescriptorPolygons
                        }
                      })()
                    : joinDescriptorPolygons
                if (canonicalJoinDescriptorPolygons.length === 0) {
                  return []
                }

                const finalProductArea = getPolygonsAbsoluteArea(
                  canonicalJoinDescriptorPolygons
                )
                const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
                  sourcePathId: cachePrefix,
                  ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
                  networkId: options.metadata?.networkId,
                  sourceNetworkIds: options.metadata?.sourceNetworkIds,
                  strokeId: `stroke:${strokeIndex}`,
                  strokeIndex,
                  contourId,
                  legalDomainId,
                  intervalId: joinedIntervalIds.join(','),
                  intervalIds: joinedIntervalIds,
                  strokePosition: stroke.position,
                  strokeWidth: intervalStroke.width,
                  strokeJoin: stroke.join,
                  strokeCap: stroke.cap,
                  strokeMiterLimit: stroke.miterLimit,
                  dashProductIntervals,
                  dashEndpointCapPolicySignature:
                    dashEndpointCapPolicySignatures[0],
                  dashEndpointCapPolicySignatures,
                  joinOwnershipSignature,
                  joinOwnershipSignatures: [joinOwnershipSignature],
                  smoothContinuityGroupId: joinSmoothContinuityGroupId,
                  smoothContinuityGroupIds,
                  joinOwnershipRecords: [
                    {
                      kind: record.kind,
                      area: finalProductArea,
                      bounds: getBounds(record.polygons)
                    }
                  ],
                  ownerSet: options.metadata?.ownerSet,
                  productSourceSegmentIndexes: joinedSourceSegmentIndexes,
                  sourceContourIds: options.metadata?.sourceContourIds,
                  legalDomainIds: options.metadata?.legalDomainIds,
                  sourceSpanIds: record.intervals.flatMap((interval) =>
                    getSourceSpanIdsForDebug(interval)
                  ),
                  implicitFillRegionCount:
                    options.implicitFillRegions?.length ?? 0,
                  domainPlanSplitRangeTerminals:
                    domainPlanSplitRangeTerminals.length > 0
                      ? domainPlanSplitRangeTerminals
                      : undefined,
                  productMode: intervalProductDomainMode,
                  domainMode: intervalProductDomainMode,
                  productSignature,
                  topologyFamily: topology.topologyFamily,
                  paintBounds: sourcePaintBounds,
                  finalProductArea,
                  revisionSet: getRevisionSet(productSignature, {
                    productDomainMode: intervalProductDomainMode,
                    joinOwnershipSignature,
                    productMaterializationSignature: [
                      'product-materialization',
                      productSignature
                    ].join(':'),
                    renderOutputSignature: [
                      'render-output',
                      productSignature,
                      joinOwnershipSignature
                    ].join(':'),
                    resolvedRegionSignature: [
                      'resolved-region',
                      productSignature
                    ].join(':'),
                    ownerCount: Math.max(
                      joinedSourceSegmentIndexes.length,
                      joinedIntervalIds.length,
                      1
                    )
                  })
                }

                return [
                  {
                    geometry: {
                      geometryId,
                      polygons: canonicalJoinDescriptorPolygons,
                      bounds: getBounds(canonicalJoinDescriptorPolygons),
                      debugMeta
                    },
                    paint: {
                      geometryId,
                      kind: stroke.kind,
                      color: stroke.color,
                      alpha: stroke.alpha,
                      gradientStyle: stroke.gradientStyle,
                      paintKey: stroke.paintKey
                    }
                  }
                ]
              })
          )
        : []
    }

    const insideAggregateDescriptorIntervals =
      insideDescriptorClipPolygons.length > 0
        ? intervalsToMaterialize.filter((interval) =>
            insideAggregateDescriptorCandidateIntervalIds.has(
              interval.intervalId
            )
          )
        : []
    const insideAggregateDescriptorIntervalIds = new Set(
      insideAggregateDescriptorIntervals.map((interval) => interval.intervalId)
    )
    const outsideAggregateDescriptorIntervals =
      outsideDescriptorExcludePolygons.length > 0
        ? intervalsToMaterialize.filter(
            (interval) =>
              outsideAggregateDescriptorCandidateIntervalIds.has(
                interval.intervalId
              ) &&
              !insideAggregateDescriptorIntervalIds.has(interval.intervalId)
          )
        : []
    const outsideAggregateDescriptorIntervalIds = new Set(
      outsideAggregateDescriptorIntervals.map((interval) => interval.intervalId)
    )
    const remainingIntervalsToMaterialize =
      insideAggregateDescriptorIntervalIds.size === 0 &&
      outsideAggregateDescriptorIntervalIds.size === 0
        ? intervalsToMaterialize
        : intervalsToMaterialize.filter(
            (interval) =>
              !insideAggregateDescriptorIntervalIds.has(interval.intervalId) &&
              !outsideAggregateDescriptorIntervalIds.has(interval.intervalId)
          )

    const insideAggregateDescriptorPacket =
      insideAggregateDescriptorIntervals.length > 0
        ? measureStrokePipelinePhase(
            'constrained dashed packets: inside aggregate descriptor',
            () => {
              const descriptorItems: {
                path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
                interval: Pick<
                  DashedTopologyInterval,
                  'startDistance' | 'endDistance' | 'wrapsSeam'
                > & {
                  domainPlanTerminalRole?: VisibleDashedTopologyInterval['domainPlanTerminalRole']
                }
                slicingContext: SourcePathSlicingContext
              }[] = []
              const canUseAggregateProductCache =
                insideAggregateDescriptorIntervals.every(
                  (interval) =>
                    interval.domainPlanSplitRangeSourceSegmentIndex !==
                    undefined
                )
              const firstInsideAggregateInterval =
                insideAggregateDescriptorIntervals[0]
              const aggregateProductCacheOrigin = canUseAggregateProductCache
                ? (firstInsideAggregateInterval
                    ?.domainPlanBoundaryPoints?.[0] ??
                  packetStageOrigin ??
                  getPathTranslationCacheOrigin(
                    sourcePath ?? topologySourcePath ?? { segments: [] }
                  ) ??
                  insideDescriptorClipPolygons[0]?.[0] ??
                  null)
                : null
              const precomputedProductSignature = aggregateProductCacheOrigin
                ? [
                    'inside-aggregate-descriptor-intervals',
                    packetStageCacheKeys.sourcePathSignature ??
                      'no-source-path-signature',
                    insideAggregateDescriptorIntervals
                      .map((interval, index) =>
                        [
                          index,
                          buildBoundaryDomainPointsTranslationSignature(
                            interval,
                            aggregateProductCacheOrigin
                          ) ?? 'source-path',
                          formatTranslationInvariantCacheNumber(
                            interval.domainPlanBoundaryStartDistance ??
                              interval.startDistance
                          ),
                          formatTranslationInvariantCacheNumber(
                            interval.domainPlanBoundaryEndDistance ??
                              interval.endDistance
                          ),
                          interval.wrapsSeam === true ? 'wrap' : 'direct',
                          interval.domainPlanTerminalRole ?? 'middle',
                          interval.domainPlanBoundaryRole ?? 'boundary-role',
                          interval.domainPlanSelectedSide ?? 'selected-side'
                        ].join(':')
                      )
                      .join(';'),
                    buildPolygonListCacheSignature(
                      toRelativePolygons(
                        insideDescriptorClipPolygons,
                        aggregateProductCacheOrigin
                      )
                    )
                  ].join('|')
                : undefined
              const cachedAggregateDescriptorProduct =
                precomputedProductSignature && aggregateProductCacheOrigin
                  ? getCachedInsideAggregateDescriptorProduct(
                      buildInsideAggregateDescriptorProductCacheKey(
                        stroke,
                        intervalStroke.width,
                        precomputedProductSignature
                      ),
                      aggregateProductCacheOrigin
                    )
                  : null
              if (!cachedAggregateDescriptorProduct) {
                for (const interval of insideAggregateDescriptorIntervals) {
                  const boundaryDomainPath =
                    getBoundaryDomainPathForVisibleInterval(interval)
                  const effectiveSourcePath =
                    boundaryDomainPath ?? sourcePath ?? topologySourcePath
                  if (!effectiveSourcePath) {
                    return null
                  }
                  const effectiveSourcePathSlicingContext = boundaryDomainPath
                    ? getBoundaryDomainSlicingContext(boundaryDomainPath)
                    : (sourcePathSlicingContext ??
                      topologySourcePathSlicingContext)
                  if (!effectiveSourcePathSlicingContext) {
                    return null
                  }
                  descriptorItems.push({
                    path: effectiveSourcePath,
                    interval: {
                      ...(boundaryDomainPath
                        ? getBoundaryDomainMaterializationInterval(interval)
                        : interval),
                      domainPlanTerminalRole: interval.domainPlanTerminalRole
                    },
                    slicingContext: effectiveSourcePathSlicingContext
                  })
                }
                if (descriptorItems.length === 0) {
                  return null
                }
              }
              const aggregateDescriptorProduct =
                cachedAggregateDescriptorProduct ??
                buildInsideDashedAggregateDescriptorProduct(
                  descriptorItems,
                  stroke,
                  intervalStroke.width,
                  insideDescriptorClipPolygons,
                  precomputedProductSignature
                )
              if (!aggregateDescriptorProduct) {
                return null
              }

              const intervalIds: string[] = []
              const productSourceSegmentIndexes =
                getDescriptorProductSourceSegmentIndexes(
                  insideAggregateDescriptorIntervals,
                  descriptorItems
                )
              const domainPlanSplitRangeTerminals: NonNullable<
                SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
              > = []
              const aggregateCapReachDistance =
                stroke.cap === 'butt' ? 0 : intervalStroke.width
              const dashProductIntervals: NonNullable<
                SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
              > = []
              const dashEndpointCapPolicySignatures: string[] = []
              const dashEndpointCapPolicyTerminalRoles: NonNullable<
                SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
              > = []
              const smoothContinuityGroupIds: string[] = []
              const domainPlanBoundaryRoles: NonNullable<
                SolidCenterStrokeGeometryDebugMeta['domainPlanBoundaryRoles']
              > = []
              const domainPlanSplitRangeIds: string[] = []
              const domainPlanSelectedSides: number[] = []
              for (const interval of insideAggregateDescriptorIntervals) {
                intervalIds.push(interval.intervalId)
                const terminalRecords =
                  buildDomainPlanSplitRangeTerminalRecords(interval)
                if (terminalRecords) {
                  domainPlanSplitRangeTerminals.push(...terminalRecords)
                }
                const terminalRole = interval.domainPlanTerminalRole ?? 'middle'
                const endpointCapPolicySignature = [
                  'inside-descriptor',
                  stroke.cap,
                  terminalRole
                ].join(':')
                const smoothContinuityGroupId = [
                  'inside-descriptor',
                  interval.intervalId
                ].join(':')
                dashProductIntervals.push({
                  intervalId: interval.intervalId,
                  splitRangeId: interval.domainPlanSplitRangeId,
                  terminalRole: interval.domainPlanTerminalRole,
                  startDistance: interval.startDistance,
                  endDistance: interval.endDistance,
                  effectiveStartDistance: Math.max(
                    0,
                    interval.startDistance - aggregateCapReachDistance
                  ),
                  effectiveEndDistance:
                    interval.endDistance + aggregateCapReachDistance,
                  capReachDistance: aggregateCapReachDistance,
                  boundaryDomainId: interval.domainPlanBoundaryDomainId,
                  boundaryRole: interval.domainPlanBoundaryRole,
                  selectedSide: interval.domainPlanSelectedSide,
                  filledSide: interval.domainPlanFilledSide,
                  unfilledSide: interval.domainPlanUnfilledSide,
                  sourceSegmentIndex:
                    interval.domainPlanSplitRangeSourceSegmentIndex,
                  endpointCapPolicySignature,
                  joinOwnershipSignature: 'source-path',
                  smoothContinuityGroupId
                })
                if (
                  !dashEndpointCapPolicySignatures.includes(
                    endpointCapPolicySignature
                  )
                ) {
                  dashEndpointCapPolicySignatures.push(
                    endpointCapPolicySignature
                  )
                }
                if (
                  !dashEndpointCapPolicyTerminalRoles.includes(terminalRole)
                ) {
                  dashEndpointCapPolicyTerminalRoles.push(terminalRole)
                }
                smoothContinuityGroupIds.push(smoothContinuityGroupId)
                if (
                  interval.domainPlanBoundaryRole !== undefined &&
                  !domainPlanBoundaryRoles.includes(
                    interval.domainPlanBoundaryRole
                  )
                ) {
                  domainPlanBoundaryRoles.push(interval.domainPlanBoundaryRole)
                }
                if (interval.domainPlanSplitRangeId !== undefined) {
                  pushUniqueString(
                    domainPlanSplitRangeIds,
                    interval.domainPlanSplitRangeId
                  )
                }
                if (
                  interval.domainPlanSelectedSide !== undefined &&
                  !domainPlanSelectedSides.includes(
                    interval.domainPlanSelectedSide
                  )
                ) {
                  domainPlanSelectedSides.push(interval.domainPlanSelectedSide)
                }
              }
              dashEndpointCapPolicySignatures.sort()
              dashEndpointCapPolicyTerminalRoles.sort((left, right) =>
                left.localeCompare(right)
              )
              domainPlanBoundaryRoles.sort((left, right) =>
                left.localeCompare(right)
              )
              domainPlanSplitRangeIds.sort()
              domainPlanSelectedSides.sort((left, right) => left - right)
              const intervalProductDomainMode =
                getFormalProductDomainModeForIntervals(
                  strokeDomainPlan,
                  insideAggregateDescriptorIntervals
                )
              if (!intervalProductDomainMode) {
                return null
              }
              const insideDescriptorIntervalSignature = hashStableString(
                'inside-aggregate-intervals',
                intervalSignature
              )
              const productSignature = [
                'constrained-dashed',
                intervalProductDomainMode,
                'inside-aggregate-descriptor',
                stroke.cap,
                insideDescriptorIntervalSignature,
                strokeDomainPlan.planId
              ].join(':')
              const aggregateEndpointCapPolicySignature = [
                'inside-aggregate-descriptor',
                stroke.cap,
                insideDescriptorIntervalSignature
              ].join(':')
              const aggregateSmoothContinuityGroupId = [
                'inside-aggregate-descriptor',
                productSignature
              ].join(':')
              const finalProductArea = aggregateDescriptorProduct.productArea
              const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
                sourcePathId: cachePrefix,
                ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
                networkId: options.metadata?.networkId,
                sourceNetworkIds: options.metadata?.sourceNetworkIds,
                strokeId: `stroke:${strokeIndex}`,
                strokeIndex,
                contourId,
                legalDomainId,
                intervalId: intervalIds[0],
                intervalIds,
                strokePosition: stroke.position,
                strokeWidth: intervalStroke.width,
                strokeJoin: stroke.join,
                strokeCap: stroke.cap,
                strokeMiterLimit: stroke.miterLimit,
                dashEndpointCapPolicySignature:
                  aggregateEndpointCapPolicySignature,
                dashProductIntervals,
                dashEndpointCapPolicySignatures,
                dashEndpointCapPolicyTerminalRoles,
                joinOwnershipSignature: 'source-path',
                joinOwnershipSignatures: ['source-path'],
                smoothContinuityGroupId: aggregateSmoothContinuityGroupId,
                smoothContinuityGroupIds,
                ownerSet: options.metadata?.ownerSet,
                productSourceSegmentIndexes,
                sourceContourIds: options.metadata?.sourceContourIds,
                legalDomainIds: options.metadata?.legalDomainIds,
                sourceSpanIds: options.metadata?.sourceSpanIds ?? [],
                implicitFillRegionCount:
                  options.implicitFillRegions?.length ?? 0,
                domainPlanSplitRangeTerminals:
                  domainPlanSplitRangeTerminals.length > 0
                    ? domainPlanSplitRangeTerminals
                    : undefined,
                domainPlanBoundaryRoles,
                domainPlanSplitRangeIds,
                domainPlanSelectedSides: domainPlanSelectedSides.filter(
                  (side): side is 1 | -1 => side === 1 || side === -1
                ),
                domainPlanSourceSegmentIndexes: productSourceSegmentIndexes,
                rawProductArea: finalProductArea,
                cleanedProductArea: finalProductArea,
                boundaryClippedProductArea: finalProductArea,
                finalProductArea,
                productMode: intervalProductDomainMode,
                domainMode: intervalProductDomainMode,
                domainPlanDomainMode: intervalProductDomainMode,
                productSignature,
                topologyFamily: topology.topologyFamily,
                paintBounds: sourcePaintBounds,
                revisionSet: getRevisionSet(productSignature, {
                  productDomainMode: intervalProductDomainMode,
                  endpointCapPolicySignature:
                    aggregateEndpointCapPolicySignature,
                  joinOwnershipSignature: 'source-path',
                  smoothContinuitySignature: [
                    'smooth-continuity',
                    aggregateSmoothContinuityGroupId
                  ].join(':'),
                  productMaterializationSignature: [
                    'product-materialization',
                    productSignature
                  ].join(':'),
                  renderOutputSignature: [
                    'render-output',
                    productSignature
                  ].join(':'),
                  resolvedRegionSignature: [
                    'resolved-region',
                    productSignature
                  ].join(':'),
                  ownerCount: Math.max(intervalIds.length, 1)
                })
              }

              return {
                geometry: {
                  geometryId: `${cachePrefix}:${strokeIndex}:inside-aggregate`,
                  polygons: aggregateDescriptorProduct.polygons,
                  bounds: aggregateDescriptorProduct.bounds,
                  debugMeta,
                  renderDescriptor: aggregateDescriptorProduct.renderDescriptor
                },
                paint: {
                  geometryId: `${cachePrefix}:${strokeIndex}:inside-aggregate`,
                  kind: stroke.kind,
                  color: stroke.color,
                  alpha: stroke.alpha,
                  gradientStyle: stroke.gradientStyle,
                  paintKey: stroke.paintKey
                }
              } satisfies SolidCenterStrokeResolvedPacket
            }
          )
        : null

    const outsideAggregateDescriptorIntervalGroups =
      groupVisibleIntervalsByFormalProductDomainMode(
        strokeDomainPlan,
        outsideAggregateDescriptorIntervals
      )

    const outsideAggregateDescriptorPackets =
      outsideAggregateDescriptorIntervalGroups.length > 0
        ? measureStrokePipelinePhase(
            'constrained dashed packets: outside aggregate descriptor',
            () =>
              outsideAggregateDescriptorIntervalGroups.flatMap(
                (outsideDescriptorIntervals, groupIndex) => {
                  const descriptorItems = measureStrokePipelinePhase(
                    'constrained dashed packets: outside aggregate descriptor items',
                    () => {
                      const items: DashedAggregateDescriptorItem[] = []
                      for (const interval of outsideDescriptorIntervals) {
                        const boundaryDomainPath =
                          getBoundaryDomainPathForVisibleInterval(interval)
                        const effectiveSourcePath =
                          boundaryDomainPath ?? sourcePath ?? topologySourcePath
                        const effectiveSourcePathSlicingContext =
                          boundaryDomainPath
                            ? getBoundaryDomainSlicingContext(
                                boundaryDomainPath
                              )
                            : (sourcePathSlicingContext ??
                              topologySourcePathSlicingContext)
                        if (
                          !effectiveSourcePath ||
                          !effectiveSourcePathSlicingContext
                        ) {
                          return null
                        }
                        items.push({
                          path: effectiveSourcePath,
                          interval: {
                            ...(boundaryDomainPath
                              ? getBoundaryDomainMaterializationInterval(
                                  interval
                                )
                              : interval),
                            domainPlanTerminalRole:
                              interval.domainPlanTerminalRole
                          },
                          slicingContext: effectiveSourcePathSlicingContext,
                          selectedSide:
                            getBoundaryDomainMaterializedSelectedSide(interval)
                        })
                      }
                      return items
                    }
                  )
                  if (!descriptorItems || descriptorItems.length === 0) {
                    return []
                  }
                  const aggregateDescriptorProduct = measureStrokePipelinePhase(
                    'constrained dashed packets: outside aggregate descriptor product',
                    () =>
                      buildOutsideDashedAggregateDescriptorProduct(
                        descriptorItems,
                        stroke,
                        intervalStroke.width,
                        outsideDescriptorExcludePolygons,
                        options.implicitFillRegions
                      )
                  )
                  if (!aggregateDescriptorProduct) {
                    return []
                  }

                  const aggregateDescriptorMetadata =
                    measureStrokePipelinePhase(
                      'constrained dashed packets: outside aggregate descriptor metadata',
                      () => {
                        const intervalIds: string[] = []
                        const sourceSegmentIndexSet = new Set<number>()
                        const domainPlanSplitRangeTerminals: NonNullable<
                          SolidCenterStrokeGeometryDebugMeta['domainPlanSplitRangeTerminals']
                        > = []
                        const dashProductIntervals: NonNullable<
                          SolidCenterStrokeGeometryDebugMeta['dashProductIntervals']
                        > = []
                        const dashEndpointCapPolicySignatures: string[] = []
                        const dashEndpointCapPolicyTerminalRoles: NonNullable<
                          SolidCenterStrokeGeometryDebugMeta['dashEndpointCapPolicyTerminalRoles']
                        > = []

                        outsideDescriptorIntervals.forEach(
                          (interval, index) => {
                            intervalIds.push(interval.intervalId)
                            if (
                              interval.domainPlanSplitRangeSourceSegmentIndex !==
                              undefined
                            ) {
                              sourceSegmentIndexSet.add(
                                interval.domainPlanSplitRangeSourceSegmentIndex
                              )
                            }

                            domainPlanSplitRangeTerminals.push(
                              ...(buildDomainPlanSplitRangeTerminalRecords(
                                interval
                              ) ?? [])
                            )
                            const endpointCapPolicy = getDashEndpointCapPolicy(
                              descriptorItems[index]?.path ?? { closed: false },
                              interval
                            )
                            const fullCapReachDistance =
                              stroke.cap === 'butt' ? 0 : intervalStroke.width
                            const startCapReachDistance =
                              endpointCapPolicy.startCap
                                ? fullCapReachDistance
                                : 0
                            const endCapReachDistance = endpointCapPolicy.endCap
                              ? fullCapReachDistance
                              : 0
                            const endpointCapPolicySignature = [
                              'outside-descriptor',
                              stroke.cap,
                              endpointCapPolicy.signature
                            ].join(':')
                            pushUniqueString(
                              dashEndpointCapPolicySignatures,
                              endpointCapPolicySignature
                            )
                            if (
                              !dashEndpointCapPolicyTerminalRoles.includes(
                                endpointCapPolicy.terminalRole
                              )
                            ) {
                              dashEndpointCapPolicyTerminalRoles.push(
                                endpointCapPolicy.terminalRole
                              )
                            }
                            dashProductIntervals.push({
                              intervalId: interval.intervalId,
                              splitRangeId: interval.domainPlanSplitRangeId,
                              terminalRole: interval.domainPlanTerminalRole,
                              startDistance: interval.startDistance,
                              endDistance: interval.endDistance,
                              effectiveStartDistance: Math.max(
                                0,
                                interval.startDistance - startCapReachDistance
                              ),
                              effectiveEndDistance:
                                interval.endDistance + endCapReachDistance,
                              capReachDistance: Math.max(
                                startCapReachDistance,
                                endCapReachDistance
                              ),
                              boundaryDomainId:
                                interval.domainPlanBoundaryDomainId,
                              boundaryRole: interval.domainPlanBoundaryRole,
                              selectedSide: interval.domainPlanSelectedSide,
                              filledSide: interval.domainPlanFilledSide,
                              unfilledSide: interval.domainPlanUnfilledSide,
                              sourceSegmentIndex:
                                interval.domainPlanSplitRangeSourceSegmentIndex,
                              endpointCapPolicySignature,
                              joinOwnershipSignature: 'source-path',
                              smoothContinuityGroupId: [
                                'outside-descriptor',
                                interval.intervalId
                              ].join(':')
                            })
                          }
                        )
                        dashEndpointCapPolicySignatures.sort()
                        dashEndpointCapPolicyTerminalRoles.sort((left, right) =>
                          left.localeCompare(right)
                        )

                        const productSourceSegmentIndexes = Array.from(
                          sourceSegmentIndexSet
                        ).sort((left, right) => left - right)

                        return {
                          intervalIds,
                          productSourceSegmentIndexes,
                          domainPlanSplitRangeTerminals,
                          dashProductIntervals,
                          dashEndpointCapPolicySignatures,
                          dashEndpointCapPolicyTerminalRoles
                        }
                      }
                    )
                  const {
                    intervalIds,
                    productSourceSegmentIndexes,
                    domainPlanSplitRangeTerminals,
                    dashProductIntervals,
                    dashEndpointCapPolicySignatures,
                    dashEndpointCapPolicyTerminalRoles
                  } = aggregateDescriptorMetadata
                  const firstOutsideDescriptorInterval =
                    outsideDescriptorIntervals[0]
                  const intervalProductDomainMode =
                    firstOutsideDescriptorInterval
                      ? getFormalProductDomainModeForInterval(
                          strokeDomainPlan,
                          firstOutsideDescriptorInterval
                        )
                      : null
                  if (!intervalProductDomainMode) {
                    return []
                  }
                  const outsideDescriptorIntervalSignature = hashStableString(
                    'outside-aggregate-intervals',
                    intervalIds.join(',')
                  )
                  const productSignature = [
                    'constrained-dashed',
                    intervalProductDomainMode,
                    'outside-aggregate-descriptor',
                    stroke.cap,
                    outsideDescriptorIntervalSignature,
                    strokeDomainPlan.planId
                  ].join(':')
                  const aggregateEndpointCapPolicySignature =
                    dashEndpointCapPolicySignatures.length === 1
                      ? dashEndpointCapPolicySignatures[0]
                      : [
                          'outside-aggregate-descriptor',
                          stroke.cap,
                          outsideDescriptorIntervalSignature
                        ].join(':')
                  const aggregateEndpointCapPolicyTerminalRole =
                    dashEndpointCapPolicyTerminalRoles.length === 1
                      ? dashEndpointCapPolicyTerminalRoles[0]
                      : undefined
                  const aggregateSmoothContinuityGroupId = [
                    'outside-aggregate-descriptor',
                    productSignature
                  ].join(':')
                  const finalProductArea = measureStrokePipelinePhase(
                    'constrained dashed packets: outside aggregate descriptor area',
                    () =>
                      getPolygonsAbsoluteArea(
                        aggregateDescriptorProduct.polygons
                      )
                  )
                  const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
                    sourcePathId: cachePrefix,
                    ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
                    networkId: options.metadata?.networkId,
                    sourceNetworkIds: options.metadata?.sourceNetworkIds,
                    strokeId: `stroke:${strokeIndex}`,
                    strokeIndex,
                    contourId,
                    legalDomainId,
                    intervalId: intervalIds[0],
                    intervalIds,
                    strokePosition: stroke.position,
                    strokeWidth: intervalStroke.width,
                    strokeJoin: stroke.join,
                    strokeCap: stroke.cap,
                    strokeMiterLimit: stroke.miterLimit,
                    dashEndpointCapPolicySignature:
                      aggregateEndpointCapPolicySignature,
                    dashEndpointCapPolicyTerminalRole:
                      aggregateEndpointCapPolicyTerminalRole,
                    dashProductIntervals,
                    dashEndpointCapPolicySignatures,
                    dashEndpointCapPolicyTerminalRoles,
                    joinOwnershipSignature: 'source-path',
                    joinOwnershipSignatures: ['source-path'],
                    smoothContinuityGroupId: aggregateSmoothContinuityGroupId,
                    smoothContinuityGroupIds: dashProductIntervals
                      .filter(
                        (
                          interval
                        ): interval is typeof interval & {
                          smoothContinuityGroupId: string
                        } => interval.smoothContinuityGroupId !== undefined
                      )
                      .map((interval) => interval.smoothContinuityGroupId),
                    ownerSet: options.metadata?.ownerSet,
                    productSourceSegmentIndexes,
                    sourceContourIds: options.metadata?.sourceContourIds,
                    legalDomainIds: options.metadata?.legalDomainIds,
                    sourceSpanIds: options.metadata?.sourceSpanIds ?? [],
                    implicitFillRegionCount:
                      options.implicitFillRegions?.length ?? 0,
                    domainPlanBoundaryDomainId:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryDomainId,
                    domainPlanBoundaryPoints:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryPoints
                        ? firstOutsideDescriptorInterval.domainPlanBoundaryPoints.map(
                            (point) => ({ ...point })
                          )
                        : undefined,
                    domainPlanBoundaryStartDistance:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryStartDistance,
                    domainPlanBoundaryEndDistance:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryEndDistance,
                    domainPlanBoundaryTotalLength:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryTotalLength,
                    domainPlanSplitRangeId:
                      firstOutsideDescriptorInterval?.domainPlanSplitRangeId,
                    domainPlanSplitRangeStartDistance:
                      firstOutsideDescriptorInterval?.domainPlanSplitRangeStartDistance,
                    domainPlanSplitRangeEndDistance:
                      firstOutsideDescriptorInterval?.domainPlanSplitRangeEndDistance,
                    domainPlanTerminalRole:
                      firstOutsideDescriptorInterval?.domainPlanTerminalRole,
                    domainPlanSplitRangeSourceSegmentIndex:
                      firstOutsideDescriptorInterval?.domainPlanSplitRangeSourceSegmentIndex,
                    domainPlanSideAuthority:
                      firstOutsideDescriptorInterval?.domainPlanSideAuthority,
                    domainPlanSelectedSide:
                      firstOutsideDescriptorInterval?.domainPlanSelectedSide,
                    domainPlanFilledSide:
                      firstOutsideDescriptorInterval?.domainPlanFilledSide,
                    domainPlanUnfilledSide:
                      firstOutsideDescriptorInterval?.domainPlanUnfilledSide,
                    domainPlanBoundaryRole:
                      firstOutsideDescriptorInterval?.domainPlanBoundaryRole,
                    domainPlanSideResolutionStatus:
                      firstOutsideDescriptorInterval?.domainPlanSideResolutionStatus,
                    domainPlanSideResolutionReason:
                      firstOutsideDescriptorInterval?.domainPlanSideResolutionReason,
                    domainPlanSplitRangeTerminals:
                      domainPlanSplitRangeTerminals.length > 0
                        ? domainPlanSplitRangeTerminals
                        : undefined,
                    domainPlanBoundaryRoles: Array.from(
                      new Set(
                        outsideDescriptorIntervals
                          .map((interval) => interval.domainPlanBoundaryRole)
                          .filter(
                            (
                              role
                            ): role is NonNullable<
                              SolidCenterStrokeGeometryDebugMeta['domainPlanBoundaryRole']
                            > => role !== undefined
                          )
                      )
                    ).sort((left, right) => left.localeCompare(right)),
                    domainPlanSplitRangeIds: uniqueStrings(
                      outsideDescriptorIntervals.map(
                        (interval) => interval.domainPlanSplitRangeId
                      )
                    ),
                    domainPlanSelectedSides: uniqueNumbers(
                      outsideDescriptorIntervals.map(
                        (interval) => interval.domainPlanSelectedSide
                      )
                    ).filter(
                      (side): side is 1 | -1 => side === 1 || side === -1
                    ),
                    domainPlanSourceSegmentIndexes: productSourceSegmentIndexes,
                    rawProductArea: finalProductArea,
                    cleanedProductArea: finalProductArea,
                    boundaryClippedProductArea: finalProductArea,
                    finalProductArea,
                    productMode: intervalProductDomainMode,
                    domainMode: intervalProductDomainMode,
                    domainPlanDomainMode: intervalProductDomainMode,
                    productSignature,
                    topologyFamily: topology.topologyFamily,
                    paintBounds: sourcePaintBounds,
                    revisionSet: getRevisionSet(productSignature, {
                      productDomainMode: intervalProductDomainMode,
                      endpointCapPolicySignature:
                        aggregateEndpointCapPolicySignature,
                      joinOwnershipSignature: 'source-path',
                      smoothContinuitySignature: [
                        'smooth-continuity',
                        aggregateSmoothContinuityGroupId
                      ].join(':'),
                      productMaterializationSignature: [
                        'product-materialization',
                        productSignature
                      ].join(':'),
                      renderOutputSignature: [
                        'render-output',
                        productSignature
                      ].join(':'),
                      resolvedRegionSignature: [
                        'resolved-region',
                        productSignature
                      ].join(':'),
                      ownerCount: Math.max(intervalIds.length, 1)
                    })
                  }

                  return {
                    geometry: {
                      geometryId: `${cachePrefix}:${strokeIndex}:outside-aggregate:${groupIndex}`,
                      polygons: aggregateDescriptorProduct.polygons,
                      bounds: getBounds(aggregateDescriptorProduct.polygons),
                      debugMeta,
                      renderDescriptor:
                        aggregateDescriptorProduct.renderDescriptor
                    },
                    paint: {
                      geometryId: `${cachePrefix}:${strokeIndex}:outside-aggregate:${groupIndex}`,
                      kind: stroke.kind,
                      color: stroke.color,
                      alpha: stroke.alpha,
                      gradientStyle: stroke.gradientStyle,
                      paintKey: stroke.paintKey
                    }
                  } satisfies SolidCenterStrokeResolvedPacket
                }
              )
          )
        : []

    const materializedIntervalPackets = measureStrokePipelinePhase(
      'constrained dashed packets: interval packets',
      () =>
        remainingIntervalsToMaterialize.flatMap((interval) => {
          const {
            boundaryDomainPath,
            effectiveSourcePath,
            effectiveSourcePathSlicingContext,
            effectiveTopologyForInterval
          } = measureStrokePipelinePhase(
            'constrained dashed interval: setup',
            () => {
              const resolvedBoundaryDomainPath =
                getBoundaryDomainPathForVisibleInterval(interval)
              const resolvedEffectiveSourcePath =
                resolvedBoundaryDomainPath ?? sourcePath ?? topologySourcePath
              const resolvedEffectiveSourcePathSlicingContext =
                resolvedBoundaryDomainPath
                  ? getBoundaryDomainSlicingContext(resolvedBoundaryDomainPath)
                  : (sourcePathSlicingContext ??
                    topologySourcePathSlicingContext)
              const resolvedEffectiveTopologyForInterval =
                resolvedBoundaryDomainPath
                  ? {
                      ...topology,
                      totalLength: resolvedBoundaryDomainPath.totalLength,
                      closed: resolvedBoundaryDomainPath.closed
                    }
                  : topology
              return {
                boundaryDomainPath: resolvedBoundaryDomainPath,
                effectiveSourcePath: resolvedEffectiveSourcePath,
                effectiveSourcePathSlicingContext:
                  resolvedEffectiveSourcePathSlicingContext,
                effectiveTopologyForInterval:
                  resolvedEffectiveTopologyForInterval
              }
            }
          )

          const materializationInterval = boundaryDomainPath
            ? getBoundaryDomainMaterializationInterval(interval)
            : interval
          const physicalSpans = measureStrokePipelinePhase(
            'constrained dashed interval: physical spans',
            () =>
              getIntervalPhysicalSpans(
                effectiveTopologyForInterval,
                materializationInterval
              )
          )
          const intervalAuthoredStroke = stroke
          let intervalSweepSpanCount: number | undefined
          let terminalCapCount: number | undefined
          let intervalEndpointCapPolicy:
            | DashedSourcePathIntervalSweep['endpointCapPolicy']
            | undefined
          let intervalSmoothContinuityGroup:
            | DashedSourcePathIntervalSweep['smoothContinuityGroup']
            | undefined
          let intervalProductSweep: DashedSourcePathIntervalSweep | undefined
          let intervalRenderDescriptor:
            | SolidCenterStrokeResolvedPacket['geometry']['renderDescriptor']
            | undefined
          const intervalSourceVertexBoundaryJoinPlans =
            sourceVertexBoundaryJoinPlansByIntervalId.get(
              interval.intervalId
            ) ?? []
          const intervalHasSourceVertexBoundaryJoin =
            intervalSourceVertexBoundaryJoinPlans.length > 0
          const intervalSourceVertexBoundaryJoinSignature =
            intervalHasSourceVertexBoundaryJoin
              ? [
                  'source-vertex-boundary-join',
                  intervalSourceVertexBoundaryJoinPlans
                    .map((plan) => getFrameJoinEffectiveSignature(plan))
                    .join(';')
                ].join(':')
              : 'source-path'
          let intervalHasCurvedSourcePathSweepRange = false
          let intervalHasSmoothContinuityAcrossSweepRanges = false
          const intervalIsAdjacentToAuthoredSmoothSourceBoundary =
            sourcePath !== undefined &&
            sourcePathSlicingContext !== undefined &&
            isIntervalAdjacentToAuthoredSmoothSourceBoundary(
              sourcePath,
              sourcePathSlicingContext,
              interval
            )
          let rawProductArea: number | undefined
          let cleanedProductArea: number | undefined
          let boundaryClippedProductArea: number | undefined
          const intervalUsesBoundaryDomainProduct =
            isConstrainedBoundaryDomainProductInterval(interval)
          const intervalUsesDanglingOutsideProduct =
            isOpenDanglingOutsideBothSidesVisibleInterval(interval)
          const intervalPolygons = (() => {
            if (!effectiveSourcePath || !effectiveSourcePathSlicingContext) {
              return []
            }
            const resolvedEffectiveSourcePath = effectiveSourcePath
            const resolvedEffectiveSourcePathSlicingContext =
              effectiveSourcePathSlicingContext
            const intervalCoverageBodyRanges =
              splitVisibleIntervalBySourceSegments(
                resolvedEffectiveSourcePath,
                materializationInterval,
                resolvedEffectiveSourcePathSlicingContext
              )
            const intervalCoverageBodyCacheOrigin =
              getSourcePathIntervalLevelPolygonCacheOrigin(
                resolvedEffectiveSourcePath,
                intervalCoverageBodyRanges
              )
            const intervalCoverageBodyPathSignature =
              intervalCoverageBodyCacheOrigin
                ? buildTranslationInvariantMaterializationPathCacheKey(
                    resolvedEffectiveSourcePath,
                    intervalCoverageBodyCacheOrigin,
                    intervalCoverageBodyRanges,
                    resolvedEffectiveSourcePathSlicingContext
                  )
                : null
            const intervalCoverageBodyUsesLegalDomainSignature =
              !intervalUsesBoundaryDomainProduct &&
              !intervalUsesDanglingOutsideProduct &&
              options.clipInsideToFillDomain === true
            const intervalCoverageBodyCacheKey =
              intervalCoverageBodyPathSignature
                ? buildConstrainedDashedIntervalCoverageBodyCacheKey(
                    intervalCoverageBodyPathSignature,
                    interval,
                    materializationInterval,
                    physicalSpans,
                    stroke,
                    {
                      cachePrefix,
                      ownerPrefix,
                      strokeIndex,
                      domainMode: baseDomainMode,
                      clipInsideToFillDomain:
                        options.clipInsideToFillDomain === true,
                      implicitFillRegions: options.implicitFillRegions ?? [],
                      sharedStrokeBoundaryDomains:
                        options.sharedStrokeBoundaryDomains ?? [],
                      includeImplicitFillRegionsSignature:
                        intervalCoverageBodyUsesLegalDomainSignature,
                      includeStrokeBoundaryDomainSignature:
                        intervalCoverageBodyUsesLegalDomainSignature &&
                        stroke.position === 'outside'
                    }
                  )
                : null
            const cachedCoverageBody =
              intervalCoverageBodyCacheKey && intervalCoverageBodyCacheOrigin
                ? getCachedConstrainedDashedIntervalCoverageBody(
                    intervalCoverageBodyCacheKey,
                    intervalCoverageBodyCacheOrigin
                  )
                : null
            if (cachedCoverageBody) {
              intervalSweepSpanCount = cachedCoverageBody.intervalSweepSpanCount
              intervalProductSweep = cachedCoverageBody.intervalSweep
              terminalCapCount = cachedCoverageBody.terminalCapCount
              intervalEndpointCapPolicy =
                cachedCoverageBody.intervalEndpointCapPolicy
              intervalSmoothContinuityGroup =
                cachedCoverageBody.intervalSmoothContinuityGroup
              intervalHasCurvedSourcePathSweepRange =
                cachedCoverageBody.intervalHasCurvedSourcePathSweepRange
              intervalHasSmoothContinuityAcrossSweepRanges =
                cachedCoverageBody.intervalHasSmoothContinuityAcrossSweepRanges
              const productPolygons = cachedCoverageBody.polygons
              rawProductArea = getPolygonsAbsoluteArea(productPolygons)
              return productPolygons
            }
            const intervalSweep = measureStrokePipelinePhase(
              'constrained dashed interval: sweep',
              () =>
                buildDashedSourcePathIntervalSweep(
                  resolvedEffectiveSourcePath,
                  physicalSpans,
                  materializationInterval,
                  intervalAuthoredStroke,
                  resolvedEffectiveSourcePathSlicingContext
                )
            )
            intervalSweepSpanCount = intervalSweep.ranges.length
            intervalProductSweep = intervalSweep
            terminalCapCount = countTerminalCapsInIntervalSweep(intervalSweep)
            intervalEndpointCapPolicy = intervalSweep.endpointCapPolicy
            intervalSmoothContinuityGroup = intervalSweep.smoothContinuityGroup
            intervalHasCurvedSourcePathSweepRange =
              hasCurvedSourcePathSweepRange(
                resolvedEffectiveSourcePath,
                intervalSweep.ranges
              )
            intervalHasSmoothContinuityAcrossSweepRanges =
              hasSmoothContinuityAcrossSweepRanges(
                resolvedEffectiveSourcePath,
                intervalSweep.ranges
              )
            if (terminalCapCount !== undefined && terminalCapCount > 0) {
              emitStrokePipelineCounter(
                'terminal-cap-build-count',
                terminalCapCount
              )
            }
            return measureStrokePipelinePhase(
              'constrained dashed interval: product final',
              () => {
                const productFinalSourcePath = resolvedEffectiveSourcePath
                const productFinalSlicingContext =
                  resolvedEffectiveSourcePathSlicingContext
                if (!productFinalSlicingContext) {
                  return []
                }
                const productFinalInterval = materializationInterval
                const coveragePolygons =
                  buildDashedSourcePathFinalCoveragePolygons(
                    productFinalSourcePath,
                    effectiveTopologyForInterval,
                    intervalSweep,
                    productFinalInterval,
                    intervalAuthoredStroke,
                    intervalStroke,
                    sharpGuardVertices,
                    productFinalSlicingContext,
                    strokeDomainPlan,
                    options.clipInsideToFillDomain === true,
                    options.implicitFillRegions ?? [],
                    true,
                    options.sharedStrokeBoundaryDomains ?? []
                  )
                if (
                  intervalCoverageBodyCacheKey &&
                  intervalCoverageBodyCacheOrigin
                ) {
                  setCachedConstrainedDashedIntervalCoverageBody(
                    intervalCoverageBodyCacheKey,
                    intervalCoverageBodyCacheOrigin,
                    coveragePolygons,
                    {
                      intervalSweep,
                      intervalSweepSpanCount: intervalSweep.ranges.length,
                      terminalCapCount:
                        countTerminalCapsInIntervalSweep(intervalSweep),
                      intervalEndpointCapPolicy:
                        intervalSweep.endpointCapPolicy,
                      intervalSmoothContinuityGroup:
                        intervalSweep.smoothContinuityGroup,
                      intervalHasCurvedSourcePathSweepRange:
                        hasCurvedSourcePathSweepRange(
                          resolvedEffectiveSourcePath,
                          intervalSweep.ranges
                        ),
                      intervalHasSmoothContinuityAcrossSweepRanges:
                        hasSmoothContinuityAcrossSweepRanges(
                          resolvedEffectiveSourcePath,
                          intervalSweep.ranges
                        )
                    }
                  )
                }
                const productPolygons = coveragePolygons
                rawProductArea = getPolygonsAbsoluteArea(productPolygons)
                return productPolygons
              }
            )
          })()
          rawProductArea ??= getPolygonsAbsoluteArea(intervalPolygons)
          const boundarySideClippedIntervalPolygons =
            isConstrainedBoundaryDomainProductInterval(interval)
              ? clipBoundaryDomainIntervalPolygonsToEndpointCapPolicy(
                  stroke.cap === 'square'
                    ? intervalPolygons
                    : clipBoundaryDomainIntervalPolygonsToOwnSelectedSide(
                        intervalPolygons,
                        interval,
                        intervalEndpointCapPolicy,
                        stroke
                      ),
                  interval,
                  stroke.cap === 'square'
                    ? undefined
                    : intervalEndpointCapPolicy
                )
              : intervalPolygons
          const boundarySideClippedProductArea =
            boundarySideClippedIntervalPolygons === intervalPolygons
              ? undefined
              : getPolygonsAbsoluteArea(boundarySideClippedIntervalPolygons)
          const clipReferenceSourcePath = boundaryDomainPath ?? sourcePath
          const legalDomainClipSourcePath =
            sourcePath ?? (boundaryDomainPath ? undefined : sourcePath)
          const clipReferenceSlicingContext =
            boundaryDomainPath && effectiveSourcePathSlicingContext
              ? effectiveSourcePathSlicingContext
              : sourcePathSlicingContext
          const productFinalClipsInsideImplicitDomain =
            stroke.position === 'inside' &&
            options.clipInsideToFillDomain === true &&
            (options.implicitFillRegions?.length ?? 0) > 0
          const intervalHasExactRenderDescriptor =
            intervalRenderDescriptor !== undefined
          const shouldPreserveSmoothProduct =
            stroke.cap === 'round' ||
            intervalHasSourceVertexBoundaryJoin ||
            intervalHasCurvedSourcePathSweepRange ||
            intervalHasSmoothContinuityAcrossSweepRanges ||
            intervalIsAdjacentToAuthoredSmoothSourceBoundary
          const intervalProductCacheRanges =
            intervalProductSweep?.ranges.map((range) => range.range) ?? []
          const intervalProductCacheOrigin =
            effectiveSourcePath && intervalProductSweep
              ? getSourcePathIntervalLevelPolygonCacheOrigin(
                  effectiveSourcePath,
                  intervalProductCacheRanges
                )
              : null
          const intervalProductPathSignature =
            effectiveSourcePath &&
            effectiveSourcePathSlicingContext &&
            intervalProductCacheOrigin
              ? buildTranslationInvariantMaterializationPathCacheKey(
                  effectiveSourcePath,
                  intervalProductCacheOrigin,
                  intervalProductCacheRanges,
                  effectiveSourcePathSlicingContext
                )
              : null
          const intervalProductUsesLegalDomainSignature =
            !intervalUsesBoundaryDomainProduct &&
            !intervalUsesDanglingOutsideProduct &&
            options.clipInsideToFillDomain === true
          const intervalProductCacheKey =
            intervalProductPathSignature && intervalProductSweep
              ? buildConstrainedDashedJoinIndependentIntervalProductCacheKey(
                  intervalProductPathSignature,
                  interval,
                  materializationInterval,
                  intervalProductSweep,
                  physicalSpans,
                  stroke,
                  {
                    cachePrefix,
                    ownerPrefix,
                    strokeIndex,
                    domainMode: baseDomainMode,
                    clipInsideToFillDomain:
                      options.clipInsideToFillDomain === true,
                    implicitFillRegions: options.implicitFillRegions ?? [],
                    sharedStrokeBoundaryDomains:
                      options.sharedStrokeBoundaryDomains ?? [],
                    canUseClosedHalfPlaneLegality,
                    shouldPreserveSmoothProduct,
                    productFinalClipsInsideImplicitDomain,
                    sourceVertexBoundaryJoinSignature:
                      intervalSourceVertexBoundaryJoinSignature,
                    includeImplicitFillRegionsSignature:
                      productFinalClipsInsideImplicitDomain
                        ? true
                        : intervalProductUsesLegalDomainSignature,
                    includeStrokeBoundaryDomainSignature:
                      intervalProductUsesLegalDomainSignature &&
                      stroke.position === 'outside'
                  }
                )
              : null
          const cachedIntervalProduct =
            !intervalHasExactRenderDescriptor &&
            intervalProductCacheKey &&
            intervalProductCacheOrigin
              ? getCachedConstrainedDashedJoinIndependentIntervalProduct(
                  intervalProductCacheKey,
                  intervalProductCacheOrigin
                )
              : null
          const polygons = intervalHasExactRenderDescriptor
            ? intervalPolygons
            : (cachedIntervalProduct ??
              measureStrokePipelinePhase(
                'constrained dashed interval: post process',
                () => {
                  const isBoundaryDomainProductInterval =
                    isConstrainedBoundaryDomainProductInterval(interval)
                  const selectedSidePolygons = sourcePath
                    ? boundarySideClippedIntervalPolygons
                    : applyClosedIntervalSelectedSideGuards(
                        boundarySideClippedIntervalPolygons,
                        topology.closed,
                        interval,
                        sharpGuardVertices,
                        segmentRanges,
                        totalLength,
                        stroke,
                        intervalStroke
                      )
                  let processedPolygons = canUseClosedHalfPlaneLegality
                    ? applyClosedIntervalLegality(
                        selectedSidePolygons,
                        closedIntervalLegalityContext
                      )
                    : selectedSidePolygons
                  if (
                    legalDomainClipSourcePath &&
                    stroke.position === 'inside' &&
                    !productFinalClipsInsideImplicitDomain &&
                    !isClosedConstrainedSourceCoverageInterval(interval) &&
                    options.clipInsideToFillDomain === true &&
                    processedPolygons.length > 0
                  ) {
                    processedPolygons = measureStrokePipelinePhase(
                      'constrained dashed interval: fill clip',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          processedPolygons,
                          legalDomainClipSourcePath,
                          stroke,
                          options.implicitFillRegions ?? [],
                          {
                            restoreSubjectBoundaryPolygons: [],
                            restoreSubjectBoundaryPaths: [],
                            fragmentPruneArea: EPSILON * 10,
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001
                          }
                        )
                    )
                  }
                  if (
                    legalDomainClipSourcePath &&
                    stroke.position === 'outside' &&
                    !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
                    !isBoundaryDomainProductVisibleInterval(interval) &&
                    options.clipInsideToFillDomain === true &&
                    processedPolygons.length > 0 &&
                    (options.implicitFillRegions?.length ?? 0) > 0
                  ) {
                    emitStrokePipelineCounter(
                      'outside-legal-clip-source-product-call'
                    )
                    processedPolygons = measureStrokePipelinePhase(
                      'constrained dashed interval: outside legal clip: source product',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          processedPolygons,
                          legalDomainClipSourcePath,
                          { position: stroke.position },
                          options.implicitFillRegions ?? [],
                          {
                            fragmentStitchRadius: 0,
                            fragmentPruneArea: 0,
                            restoreSubjectBoundaryPolygons: [],
                            restoreSubjectBoundaryPaths: [],
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001,
                            outsideFillRule: topology.fillRule
                          }
                        )
                    )
                  }
                  const finalCleanupOptions =
                    (sourcePath &&
                      stroke.position === 'outside' &&
                      options.clipInsideToFillDomain === true) ||
                    shouldPreserveSmoothProduct
                      ? {
                          cleanupMicroEdgeTolerance: 0.001,
                          cleanupCollinearTolerance: 0.0001
                        }
                      : undefined
                  const cleanedPolygons = measureStrokePipelinePhase(
                    'constrained dashed interval post process: clean',
                    () =>
                      cleanClippedProductPolygons(
                        processedPolygons,
                        finalCleanupOptions
                      )
                  )
                  cleanedProductArea = getPolygonsAbsoluteArea(cleanedPolygons)
                  if (isBoundaryDomainProductInterval) {
                    boundaryClippedProductArea = cleanedProductArea
                  }
                  if (!shouldPreserveSmoothProduct) {
                    const boundaryClippedNonSmoothProduct = cleanedPolygons
                    boundaryClippedProductArea = getPolygonsAbsoluteArea(
                      boundaryClippedNonSmoothProduct
                    )

                    if (
                      stroke.position !== 'inside' &&
                      isBoundaryDomainProductInterval &&
                      isClosedConstrainedSourceCoverageInterval(interval)
                    ) {
                      return boundaryClippedNonSmoothProduct
                    }

                    if (stroke.position === 'inside') {
                      return isBoundaryDomainProductInterval ||
                        isClosedConstrainedSourceCoverageInterval(interval)
                        ? boundaryClippedNonSmoothProduct
                        : enforceInsideImplicitFillProductDomain(
                            boundaryClippedNonSmoothProduct,
                            legalDomainClipSourcePath ?? sourcePath,
                            stroke,
                            options.implicitFillRegions ?? []
                          )
                    }

                    if (
                      stroke.position === 'outside' &&
                      isBoundaryDomainProductInterval &&
                      boundaryClippedNonSmoothProduct.length > 0 &&
                      legalDomainClipSourcePath &&
                      (options.implicitFillRegions?.length ?? 0) > 0
                    ) {
                      emitStrokePipelineCounter(
                        'outside-legal-clip-boundary-non-smooth-call'
                      )
                      return measureStrokePipelinePhase(
                        'constrained dashed interval post process: outside legal clip: boundary non-smooth',
                        () =>
                          clipSourcePathPolygonsToEvenOddLegalDomain(
                            boundaryClippedNonSmoothProduct,
                            legalDomainClipSourcePath,
                            { position: stroke.position },
                            options.implicitFillRegions ?? [],
                            {
                              restoreSubjectBoundaryPolygons: [],
                              restoreSubjectBoundaryPaths: [],
                              fragmentStitchRadius: 0,
                              fragmentPruneArea: 0,
                              cleanupMicroEdgeTolerance: 0.001,
                              cleanupCollinearTolerance: 0.0001,
                              outsideFillRule: topology.fillRule
                            }
                          )
                      )
                    }

                    return boundaryClippedNonSmoothProduct
                  }

                  const isOpenDanglingOutsideBothSidesProductInterval =
                    isOpenDanglingOutsideBothSidesVisibleInterval(interval)
                  const shouldSkipPostClipFragmentStitch =
                    clipReferenceSourcePath &&
                    stroke.position === 'outside' &&
                    options.clipInsideToFillDomain === true &&
                    !isOpenDanglingOutsideBothSidesProductInterval
                  const shouldClipSmoothProductToImplicitDomain =
                    legalDomainClipSourcePath &&
                    !productFinalClipsInsideImplicitDomain &&
                    !isBoundaryDomainProductInterval &&
                    !isClosedConstrainedSourceCoverageInterval(interval) &&
                    (stroke.position === 'inside' ||
                      (stroke.position === 'outside' &&
                        !isOpenDanglingOutsideBothSidesProductInterval)) &&
                    options.clipInsideToFillDomain === true &&
                    (options.implicitFillRegions?.length ?? 0) > 0
                  const shouldStitchSmoothProductFragments =
                    stroke.cap !== 'round'
                  let stitchedSmoothProductPolygons =
                    shouldSkipPostClipFragmentStitch ||
                    !shouldStitchSmoothProductFragments
                      ? cleanedPolygons
                      : measureStrokePipelinePhase(
                          'constrained dashed interval post process: stitch',
                          () =>
                            stitchClippedProductFragments(
                              cleanedPolygons,
                              Math.max(
                                0.05,
                                Math.min(0.2, intervalStroke.width * 0.02)
                              )
                            )
                        )
                  if (
                    shouldSkipPostClipFragmentStitch &&
                    (options.implicitFillRegions?.length ?? 0) === 0
                  ) {
                    const smoothSourceBoundary =
                      intervalProductSweep?.ranges.flatMap(({ range }) =>
                        slicePathGeometryPoints(
                          clipReferenceSourcePath,
                          range.startDistance,
                          range.endDistance,
                          false,
                          Math.min(
                            0.5,
                            clipReferenceSlicingContext?.samplingTolerance ??
                              0.5
                          ),
                          clipReferenceSlicingContext?.samplingOptions
                        )
                      ) ?? []
                    const smoothOffsetBoundary = clipReferenceSlicingContext
                      ? (intervalProductSweep?.ranges.flatMap(({ range }) =>
                          sliceExactOffsetRibbonRangeFrames(
                            clipReferenceSourcePath,
                            range,
                            clipReferenceSlicingContext,
                            intervalStroke
                          ).map((frame) => frame.offsetPoint)
                        ) ?? [])
                      : []
                    const clippedSmoothProduct = measureStrokePipelinePhase(
                      'constrained dashed interval post process: smooth source clip',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          stitchedSmoothProductPolygons,
                          clipReferenceSourcePath,
                          { position: stroke.position },
                          [],
                          {
                            fragmentStitchRadius: 0,
                            fragmentPruneArea: 0,
                            restoreSubjectBoundaryMaxEdgeLength: Math.max(
                              ROUND_CAP_VISUAL_MAX_LENGTH,
                              Math.min(3.5, intervalStroke.width * 0.35)
                            ),
                            restoreSubjectBoundarySnapTolerance: Math.max(
                              0.75,
                              intervalStroke.width
                            ),
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001
                          }
                        )
                    )
                    const sourceBoundaryPreserved =
                      preserveSmoothSourceBoundaryEdges(
                        clippedSmoothProduct,
                        smoothSourceBoundary,
                        ROUND_CAP_VISUAL_MAX_LENGTH,
                        Math.max(0.75, intervalStroke.width)
                      )
                    return preserveSmoothSourceBoundaryEdges(
                      sourceBoundaryPreserved,
                      smoothOffsetBoundary,
                      ROUND_CAP_VISUAL_MAX_LENGTH,
                      Math.max(0.75, intervalStroke.width)
                    )
                  }
                  if (
                    shouldClipSmoothProductToImplicitDomain &&
                    stitchedSmoothProductPolygons.length > 0 &&
                    clipReferenceSourcePath
                  ) {
                    stitchedSmoothProductPolygons = measureStrokePipelinePhase(
                      'constrained dashed interval post process: smooth implicit clip',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          stitchedSmoothProductPolygons,
                          legalDomainClipSourcePath,
                          { position: stroke.position },
                          options.implicitFillRegions ?? [],
                          {
                            restoreSubjectBoundaryPolygons: [],
                            restoreSubjectBoundaryPaths: [],
                            fragmentStitchRadius: 0,
                            fragmentPruneArea: 0,
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001
                          }
                        )
                    )
                  }
                  const shouldDeferSmoothProductNormalizationToOutsideLegalClip =
                    stroke.position === 'outside' &&
                    isBoundaryDomainProductInterval &&
                    stitchedSmoothProductPolygons.length > 0 &&
                    legalDomainClipSourcePath !== undefined &&
                    (options.implicitFillRegions?.length ?? 0) > 0
                  let normalizedSmoothProduct =
                    shouldDeferSmoothProductNormalizationToOutsideLegalClip ||
                    (shouldClipSmoothProductToImplicitDomain &&
                      stroke.position === 'inside')
                      ? stitchedSmoothProductPolygons
                      : measureStrokePipelinePhase(
                          'constrained dashed interval post process: normalize smooth',
                          () =>
                            normalizeConstrainedDashedProductPolygons(
                              stitchedSmoothProductPolygons,
                              {
                                cleanClipResidue: true,
                                mergeContinuousInterval: true
                              }
                            )
                        )
                  if (
                    shouldClipSmoothProductToImplicitDomain &&
                    normalizedSmoothProduct.length > 0 &&
                    clipReferenceSourcePath
                  ) {
                    normalizedSmoothProduct = measureStrokePipelinePhase(
                      'constrained dashed interval post process: normalized implicit clip',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          normalizedSmoothProduct,
                          legalDomainClipSourcePath,
                          { position: stroke.position },
                          options.implicitFillRegions ?? [],
                          {
                            restoreSubjectBoundaryPolygons: [],
                            restoreSubjectBoundaryPaths: [],
                            fragmentStitchRadius: 0,
                            fragmentPruneArea: 0,
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001
                          }
                        )
                    )
                  }
                  const boundaryClippedSmoothProduct = normalizedSmoothProduct
                  boundaryClippedProductArea = getPolygonsAbsoluteArea(
                    boundaryClippedSmoothProduct
                  )

                  if (
                    stroke.position !== 'inside' &&
                    isBoundaryDomainProductInterval &&
                    isClosedConstrainedSourceCoverageInterval(interval)
                  ) {
                    return boundaryClippedSmoothProduct
                  }

                  if (stroke.position === 'inside') {
                    return isBoundaryDomainProductInterval ||
                      isClosedConstrainedSourceCoverageInterval(interval)
                      ? boundaryClippedSmoothProduct
                      : enforceInsideImplicitFillProductDomain(
                          boundaryClippedSmoothProduct,
                          legalDomainClipSourcePath ?? sourcePath,
                          stroke,
                          options.implicitFillRegions ?? []
                        )
                  }

                  if (isOpenDanglingOutsideBothSidesProductInterval) {
                    return boundaryClippedSmoothProduct
                  }

                  if (
                    stroke.position === 'outside' &&
                    isBoundaryDomainProductInterval &&
                    boundaryClippedSmoothProduct.length > 0 &&
                    legalDomainClipSourcePath &&
                    (options.implicitFillRegions?.length ?? 0) > 0
                  ) {
                    emitStrokePipelineCounter(
                      'outside-legal-clip-boundary-smooth-call'
                    )
                    const legalBoundaryProduct = measureStrokePipelinePhase(
                      'constrained dashed interval post process: outside legal clip: boundary smooth',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          boundaryClippedSmoothProduct,
                          legalDomainClipSourcePath,
                          { position: stroke.position },
                          options.implicitFillRegions ?? [],
                          {
                            restoreSubjectBoundaryPolygons: [],
                            restoreSubjectBoundaryPaths: [],
                            fragmentStitchRadius: 0,
                            fragmentPruneArea: 0,
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001,
                            outsideFillRule: topology.fillRule
                          }
                        )
                    )
                    return legalBoundaryProduct
                  }

                  return isBoundaryDomainProductVisibleInterval(interval) ||
                    (shouldClipSmoothProductToImplicitDomain &&
                      isBoundaryDomainProductVisibleInterval(interval))
                    ? boundaryClippedSmoothProduct
                    : enforceInsideImplicitFillProductDomain(
                        boundaryClippedSmoothProduct,
                        legalDomainClipSourcePath,
                        stroke,
                        options.implicitFillRegions ?? []
                      )
                }
              ))
          if (
            !intervalHasExactRenderDescriptor &&
            !cachedIntervalProduct &&
            intervalProductCacheKey &&
            intervalProductCacheOrigin
          ) {
            setCachedConstrainedDashedJoinIndependentIntervalProduct(
              intervalProductCacheKey,
              intervalProductCacheOrigin,
              polygons
            )
          }

          if (polygons.length === 0) {
            emitStrokePipelineTrace('constrained-dashed-empty-product', {
              intervalId: interval.intervalId,
              domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
              domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
              domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
              domainPlanDomainMode: interval.domainPlanDomainMode,
              domainPlanTerminalRole: interval.domainPlanTerminalRole,
              domainPlanSelectedSide: interval.domainPlanSelectedSide,
              domainPlanSideResolutionStatus:
                interval.domainPlanSideResolutionStatus,
              sourceStartDistance: interval.startDistance,
              sourceEndDistance: interval.endDistance,
              materializedStartDistance: materializationInterval.startDistance,
              materializedEndDistance: materializationInterval.endDistance,
              materializedWrapsSeam: materializationInterval.wrapsSeam,
              materializationDistanceSpace:
                materializationInterval.materializationDistanceSpace,
              effectiveSourcePathClosed: effectiveSourcePath?.closed,
              effectiveSourcePathTotalLength: effectiveSourcePath?.totalLength,
              physicalSpans: physicalSpans.map((span) => ({
                spanId: span.spanId,
                startDistance: span.startDistance,
                endDistance: span.endDistance,
                wrapsSeam: span.wrapsSeam,
                intervalLength: span.intervalLength
              })),
              intervalSweepSpanCount,
              terminalCapCount,
              dashEndpointCapPolicySignature:
                intervalEndpointCapPolicy?.signature,
              intervalSweepRanges: intervalProductSweep?.ranges.map(
                ({ range, renderRange, rangeEndpointCapPolicy }) => ({
                  segmentIndex: range.segmentIndex,
                  startDistance: range.startDistance,
                  endDistance: range.endDistance,
                  renderStartDistance: renderRange.startDistance,
                  renderEndDistance: renderRange.endDistance,
                  rangeEndpointCapPolicy: rangeEndpointCapPolicy.signature
                })
              ),
              rawProductArea,
              cleanedProductArea,
              boundaryClippedProductArea,
              boundarySideClippedProductArea,
              finalProductArea: undefined,
              materializedBoundaryRanges: undefined,
              materializedOffsetFrameSpan: undefined
            })
            return []
          }
          const finalProductArea = getPolygonsAbsoluteArea(polygons)

          const { geometryId, domainPlanSplitRangeTerminals } =
            measureStrokePipelinePhase(
              'constrained dashed interval: packet metadata',
              () => {
                const resolvedGeometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
                return {
                  geometryId: resolvedGeometryId,
                  domainPlanSplitRangeTerminals:
                    buildDomainPlanSplitRangeTerminalRecords(interval)
                }
              }
            )
          const joinOwnershipSignature = 'source-path'
          const joinOwnershipRecords = undefined
          const dashEndpointCapPolicySignature =
            intervalEndpointCapPolicy?.signature
          const dashEndpointCapPolicyTerminalRole =
            intervalEndpointCapPolicy?.terminalRole
          const smoothContinuityGroupId = intervalSmoothContinuityGroup?.groupId
          const productSourceSegmentIndexes = Array.from(
            new Set(
              intervalProductSweep?.ranges.map(
                ({ range }) => range.segmentIndex
              ) ?? []
            )
          ).sort((a, b) => a - b)
          const intervalProductDomainMode =
            getFormalProductDomainModeForInterval(strokeDomainPlan, interval)
          if (!intervalProductDomainMode) {
            return []
          }
          const productSignature = [
            'constrained-dashed',
            intervalProductDomainMode,
            interval.intervalId,
            interval.domainPlanDomainMode ?? '',
            interval.domainPlanBoundaryDomainId ?? '',
            interval.domainPlanSplitRangeId ?? '',
            interval.domainPlanTerminalRole ?? 'middle',
            dashEndpointCapPolicySignature ?? '',
            joinOwnershipSignature,
            smoothContinuityGroupId ?? '',
            productSourceSegmentIndexes.join(',')
          ].join(':')
          const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
            sourcePathId: cachePrefix,
            ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
            networkId: options.metadata?.networkId,
            sourceNetworkIds: options.metadata?.sourceNetworkIds,
            strokeId: `stroke:${strokeIndex}`,
            strokeIndex,
            contourId,
            legalDomainId,
            intervalId: interval.intervalId,
            strokePosition: stroke.position,
            strokeWidth: intervalStroke.width,
            strokeJoin: stroke.join,
            strokeCap: stroke.cap,
            strokeMiterLimit: stroke.miterLimit,
            dashEndpointCapPolicySignature,
            dashEndpointCapPolicyTerminalRole,
            materializedEndpointCaps: undefined,
            joinOwnershipSignature,
            joinOwnershipRecords,
            smoothContinuityGroupId,
            ownerSet: options.metadata?.ownerSet,
            productSourceSegmentIndexes,
            sourceContourIds: options.metadata?.sourceContourIds,
            legalDomainIds: options.metadata?.legalDomainIds,
            sourceSpanIds:
              options.metadata?.sourceSpanIds ??
              getSourceSpanIdsForDebug(interval),
            authoredVisibleIntervalIndex: interval.authoredIndex,
            materializedStartDistance: materializationInterval.startDistance,
            materializedEndDistance: materializationInterval.endDistance,
            materializedWrapsSeam: materializationInterval.wrapsSeam,
            rawProductArea,
            cleanedProductArea,
            boundaryClippedProductArea,
            finalProductArea,
            legalDomainClipSourcePathPresent:
              legalDomainClipSourcePath !== undefined,
            legalDomainClipSourcePathClosed: legalDomainClipSourcePath?.closed,
            implicitFillRegionCount: options.implicitFillRegions?.length ?? 0,
            boundarySideClippedProductArea,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            wrapsSeam: interval.wrapsSeam,
            physicalSpanRanges: physicalSpans.map((span) => ({
              spanId: span.spanId,
              role: span.role,
              startDistance: span.startDistance,
              endDistance: span.endDistance,
              wrapsSeam: span.wrapsSeam
            })),
            materializedBoundaryRanges: undefined,
            materializedOffsetFrameSpan: undefined,
            physicalVisibleLength: physicalSpans.reduce(
              (total, span) => total + span.intervalLength,
              0
            ),
            previousVisibleIntervalId: interval.previousVisibleIntervalId,
            nextVisibleIntervalId: interval.nextVisibleIntervalId,
            domainPlanBoundaryDomainId: interval.domainPlanBoundaryDomainId,
            domainPlanBoundaryPoints: interval.domainPlanBoundaryPoints
              ? interval.domainPlanBoundaryPoints.map((point) => ({
                  ...point
                }))
              : undefined,
            domainPlanBoundaryStartDistance:
              interval.domainPlanBoundaryStartDistance,
            domainPlanBoundaryEndDistance:
              interval.domainPlanBoundaryEndDistance,
            domainPlanBoundaryTotalLength:
              interval.domainPlanBoundaryTotalLength,
            domainPlanSplitRangeId: interval.domainPlanSplitRangeId,
            domainPlanSplitRangeStartDistance:
              interval.domainPlanSplitRangeStartDistance,
            domainPlanSplitRangeEndDistance:
              interval.domainPlanSplitRangeEndDistance,
            domainPlanTerminalRole: interval.domainPlanTerminalRole,
            domainPlanSplitRangeSourceSegmentIndex:
              interval.domainPlanSplitRangeSourceSegmentIndex,
            domainPlanSideAuthority: interval.domainPlanSideAuthority,
            domainPlanSelectedSide: interval.domainPlanSelectedSide,
            domainPlanFilledSide: interval.domainPlanFilledSide,
            domainPlanUnfilledSide: interval.domainPlanUnfilledSide,
            domainPlanBoundaryRole: interval.domainPlanBoundaryRole,
            domainPlanDomainMode: interval.domainPlanDomainMode,
            domainPlanSideResolutionStatus:
              interval.domainPlanSideResolutionStatus,
            domainPlanSideResolutionReason:
              interval.domainPlanSideResolutionReason,
            domainPlanSplitRangeTerminals,
            productMode: intervalProductDomainMode,
            domainMode: intervalProductDomainMode,
            productSignature,
            topologyFamily: topology.topologyFamily,
            intervalSweepSpanCount,
            terminalCapCount,
            paintBounds: sourcePaintBounds,
            revisionSet: getRevisionSet(productSignature, {
              productDomainMode: intervalProductDomainMode,
              endpointCapPolicySignature: dashEndpointCapPolicySignature,
              joinOwnershipSignature,
              smoothContinuitySignature:
                smoothContinuityGroupId !== undefined
                  ? `smooth-continuity:${smoothContinuityGroupId}`
                  : undefined,
              productMaterializationSignature: [
                'product-materialization',
                productSignature
              ].join(':'),
              renderOutputSignature: [
                'render-output',
                productSignature,
                dashEndpointCapPolicySignature ?? '',
                joinOwnershipSignature,
                smoothContinuityGroupId ?? ''
              ].join(':'),
              resolvedRegionSignature: [
                'resolved-region',
                productSignature
              ].join(':'),
              ownerCount: Math.max(
                getSourceSpanIdsForDebug(interval).length,
                productSourceSegmentIndexes.length,
                1
              )
            })
          }

          const packet = {
            geometry: {
              geometryId,
              polygons,
              bounds: getBounds(polygons),
              debugMeta,
              renderDescriptor: intervalRenderDescriptor
            },
            paint: {
              geometryId,
              kind: stroke.kind,
              color: stroke.color,
              alpha: stroke.alpha,
              gradientStyle: stroke.gradientStyle,
              paintKey: stroke.paintKey
            }
          } satisfies SolidCenterStrokeResolvedPacket
          return [packet]
        })
    )
    const packetAssembly = measureStrokePipelinePhase(
      'constrained dashed packets: product packet assembly',
      () => {
        const aggregateDescriptorPackets = [
          insideAggregateDescriptorPacket,
          ...outsideAggregateDescriptorPackets
        ].filter(
          (packet): packet is Exclude<typeof packet, null> => packet !== null
        )
        const aggregateDescriptorIntervalIds = new Set(
          aggregateDescriptorPackets.flatMap(getPacketIntervalIds)
        )
        const getSourcePathJoinOwnedIntervalIds = (
          packets: SolidCenterStrokeResolvedPacket[]
        ) =>
          packets.flatMap((packet) => {
            const debugMeta = packet.geometry.debugMeta
            const hasMaterializedJoin =
              (debugMeta?.joinOwnershipRecords?.length ?? 0) > 0
            const hasDescriptorProductJoin =
              packet.geometry.renderDescriptor !== undefined &&
              (debugMeta?.joinOwnershipSignature === 'source-path' ||
                (debugMeta?.joinOwnershipSignatures ?? []).includes(
                  'source-path'
                ))
            const ownsSourcePathJoin =
              (hasMaterializedJoin || hasDescriptorProductJoin) &&
              (debugMeta?.joinOwnershipSignature === 'source-path' ||
                (debugMeta?.joinOwnershipSignatures ?? []).includes(
                  'source-path'
                ))
            return ownsSourcePathJoin ? getPacketIntervalIds(packet) : []
          })
        const isCoveredByAggregateDescriptor = (
          packet: SolidCenterStrokeResolvedPacket
        ) => {
          const intervalIds = getPacketIntervalIds(packet)
          return (
            intervalIds.length > 0 &&
            intervalIds.every((intervalId) =>
              aggregateDescriptorIntervalIds.has(intervalId)
            )
          )
        }
        const materializedProductPackets = materializedIntervalPackets.filter(
          (packet) => !isCoveredByAggregateDescriptor(packet)
        )
        const sourcePathJoinIntervalIds = new Set(
          getSourcePathJoinOwnedIntervalIds([
            ...aggregateDescriptorPackets,
            ...materializedProductPackets
          ])
        )
        const uncoveredJoinPlans = sourceVertexBoundaryJoinPlans.filter(
          (plan) =>
            !plan.intervals.every((interval) =>
              sourcePathJoinIntervalIds.has(interval.intervalId)
            )
        )
        const coveredProductPolygons = [
          ...aggregateDescriptorPackets,
          ...materializedProductPackets
        ].flatMap((packet) => packet.geometry.polygons)
        const joinProductPackets = buildSourceVertexBoundaryJoinPackets(
          uncoveredJoinPlans,
          coveredProductPolygons
        )
        const joinIndependentPacketsForCache = [
          ...aggregateDescriptorPackets,
          ...materializedProductPackets.filter(
            isJoinIndependentConstrainedDashedPacket
          )
        ]
        const intervalPackets = cachedJoinIndependentPacketStage
          ? [...cachedJoinIndependentPacketStage, ...joinProductPackets]
          : [
              ...aggregateDescriptorPackets,
              ...materializedProductPackets,
              ...joinProductPackets
            ]
        return {
          joinIndependentPacketsForCache,
          intervalPackets
        }
      }
    )
    const { joinIndependentPacketsForCache, intervalPackets } = packetAssembly
    const productPackets = measureStrokePipelinePhase(
      'constrained dashed packets: canonical product packets',
      () =>
        canonicalizeConstrainedDashedSamePaintProductPackets(intervalPackets, {
          getRevisionSet
        })
    )
    if (
      !cachedJoinIndependentPacketStage &&
      joinIndependentPacketStageCacheKey &&
      packetStageOrigin &&
      joinIndependentPacketsForCache.length > 0
    ) {
      measureStrokePipelinePhase(
        'constrained dashed packets: join-independent packet stage cache store',
        () =>
          setCachedConstrainedDashedJoinIndependentPacketStage(
            joinIndependentPacketStageCacheKey,
            packetStageOrigin,
            joinIndependentPacketsForCache
          )
      )
    }
    if (packetStageCacheKey && packetStageOrigin) {
      measureStrokePipelinePhase(
        'constrained dashed packets: packet stage cache store',
        () =>
          setCachedConstrainedDashedPacketStage(
            packetStageCacheKey,
            packetStageOrigin,
            productPackets
          )
      )
    }
    return productPackets
  })
}
