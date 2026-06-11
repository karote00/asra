import type { StrokeAttrs } from '@asyra/utils'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import {
  allocateStrokeIntervalsForDomainPlan,
  type allocateDashedCenterStrokeIntervals
} from './dashed-center-stroke-intervals'
import { createStrokeIntervalPointSlicer } from './stroke-interval-frames'
import { buildConstrainedDashedLocalSideStrokePolygons } from './constrained-dashed-local-side-geometry'
import { buildExactArrangementCandidatePolygons } from './constrained-solid-stroke-packets'
import {
  isSimpleClosedPolygon,
  polygonArea
} from './solid-stroke-geometry-core'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import type { SolidCenterStrokeRenderEntry } from './solid-center-stroke-render'
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
  samplePathSegmentFrameAtLength,
  samplePathSegmentFramesByLengthStep,
  slicePathGeometryFrames,
  slicePathSegmentPoints,
  slicePathGeometryPoints,
  type PathSegment,
  type PathGeometry,
  type PathSampleFrame,
  type PathSliceSamplingOptions
} from './path-geometry'
import { buildDashedCenterRibbonGeometry } from './dashed-center-ribbon-geometry'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
import { resolveSourceFamily } from './resolved-source-family'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval,
  resolveSourceSpanProvenanceAvailability
} from './source-span-graph'
import type { StrokeOwnerKey } from './stroke-final-face'
import {
  resolveStrokeDomains,
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
  omitDiagnosticMetadata?: boolean
  visualOnly?: boolean
  enableProductVisualCompiler?: boolean
  clipInsideToFillDomain?: boolean
  constrainedDashedVisualMode?: 'product-final' | 'debug-raw'
  preferRenderMaskProductFinal?: boolean
}

export type ConstrainedDashedSourceTopology =
  | 'rectangle-equivalent'
  | 'broader-simple-closed'
  | 'sampled-simple-closed'
  | 'self-intersecting'
  | 'degenerate'
  | 'open'

export type ConstrainedDashedIntervalTopology =
  | 'full-loop'
  | 'single-edge'
  | 'corner-spanning'
  | 'seam-wrapping'
  | 'multi-corner'
  | 'other'

export interface ConstrainedDashedIntervalDescriptor {
  startDistance: number
  endDistance: number
  totalLength: number
  wrapsSeam: boolean
}

export interface ConstrainedDashedIntervalClassification {
  sourceTopology: ConstrainedDashedSourceTopology
  intervalTopology: ConstrainedDashedIntervalTopology
  acceptsFullLoopRoundJoin: boolean
  acceptsSingleEdgeRoundCap: boolean
  acceptsCornerSpanningJoin: boolean
}

export type ConstrainedDashedOwnershipStatus = 'accepted' | 'blocked'

export type ConstrainedDashedOwnershipReason =
  | 'single-owner'
  | 'typed-owners'
  | 'missing-owner-metadata'
  | 'no-packets'

export interface ConstrainedDashedOwnershipClassification {
  status: ConstrainedDashedOwnershipStatus
  reason: ConstrainedDashedOwnershipReason
  ownerKeys: string[]
  packetCount: number
}

export type ConstrainedDashedRuntimeStatus = 'accepted' | 'blocked'

export type ConstrainedDashedRuntimeReason =
  | 'single-owner'
  | 'typed-owners'
  | 'no-candidate-packets'
  | 'unsupported-open-topology'
  | 'unsupported-overlap-ownership'
  | 'unsupported-topology'
  | ConstrainedDashedOwnershipReason

export interface ConstrainedDashedRuntimeStatusInput {
  points: Vec2[]
  closed: boolean
  topology?: PathTopologyModel
  candidatePackets: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>[]
  blockedReason?: Exclude<ConstrainedDashedRuntimeReason, 'single-owner'>
}

export interface ConstrainedDashedRuntimeStatusClassification {
  status: ConstrainedDashedRuntimeStatus
  reason: ConstrainedDashedRuntimeReason
  sourceTopology: ConstrainedDashedSourceTopology
  ownership: ConstrainedDashedOwnershipClassification
}

const EPSILON = 1e-6
const SOURCE_PATH_DASH_SLICE_TOLERANCE = 0.25
const SOURCE_PATH_DASH_SLICE_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 16,
  maxCubicSamples: 256,
  useRangeLengthForSampleCount: true
}
const DRAG_SOURCE_PATH_DASH_SLICE_TOLERANCE = 1
const DRAG_SOURCE_PATH_DASH_SLICE_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 6,
  maxCubicSamples: 96,
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
const SOURCE_PATH_RIBBON_FRAME_CACHE_LIMIT = 32
const SOURCE_PATH_FINAL_RANGE_POLYGON_CACHE_LIMIT = 4096
const SOURCE_PATH_INTERVAL_STROKE_PATH_CACHE_LIMIT = 4096

type DashedTopologyInterval = ReturnType<
  typeof allocateDashedIntervalsForTopology
>[number]

export type VisibleDashedTopologyInterval = DashedTopologyInterval & {
  kind: 'visible'
  figmaLikeBoundaryDomainId?: string
  figmaLikeBoundaryPoints?: Vec2[]
  figmaLikeBoundaryStartDistance?: number
  figmaLikeBoundaryEndDistance?: number
  figmaLikeBoundaryTotalLength?: number
  figmaLikeSplitRangeId?: string
  figmaLikeSplitRangeStartDistance?: number
  figmaLikeSplitRangeEndDistance?: number
  figmaLikeTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  figmaLikeSplitRangeSourceSegmentIndex?: number
  figmaLikeSideAuthority?: 'implicit-fill-hole-domain'
  figmaLikeSelectedSide?: 1 | -1
  figmaLikeFilledSide?: 1 | -1
  figmaLikeUnfilledSide?: 1 | -1
  figmaLikeBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  figmaLikeDomainMode?: string
  figmaLikeSideResolutionStatus?: 'resolved' | 'blocked'
  figmaLikeSideResolutionReason?: string
}

interface ConstrainedDashedVisibleIntervalsOptions {
  preferOpenPathNetworkIntervals?: boolean
}

const isSourceSpanProductDomainVisibleInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSideResolutionReason'
    | 'figmaLikeDomainMode'
  >
) =>
  interval.figmaLikeSideResolutionReason === 'source-span-product-domain' ||
  interval.figmaLikeSplitRangeId?.startsWith('source-span-product-domain:') ===
    true

const isOpenDanglingOutsideBothSidesVisibleInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeSideResolutionReason' | 'figmaLikeDomainMode'
  >
) =>
  interval.figmaLikeDomainMode === 'open-dangling-outside-both-sides' ||
  interval.figmaLikeSideResolutionReason === 'open-dangling-outside-both-sides'

const isSquareSplitTerminalHalfDashInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeSplitRangeId' | 'figmaLikeTerminalRole'
  >,
  stroke: Pick<RenderableStroke, 'cap'>
) =>
  stroke.cap === 'square' &&
  interval.figmaLikeSplitRangeId !== undefined &&
  (interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end')

const buildBoundaryDomainPathForIntervalUncached = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeBoundaryPoints' | 'figmaLikeBoundaryTotalLength'
  >
): PathGeometry | null => {
  const points = interval.figmaLikeBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  const path = buildPolylineGeometryModelPath(points, false)
  if (path.totalLength <= EPSILON) {
    return null
  }

  if (
    interval.figmaLikeBoundaryTotalLength !== undefined &&
    Math.abs(path.totalLength - interval.figmaLikeBoundaryTotalLength) >
      Math.max(1, interval.figmaLikeBoundaryTotalLength * 0.05)
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
const boundaryDomainSlicingContextCache = new WeakMap<
  PathGeometry,
  SourcePathSlicingContext
>()

const buildBoundaryDomainPathForInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeBoundaryPoints' | 'figmaLikeBoundaryTotalLength'
  >
): PathGeometry | null => {
  const points = interval.figmaLikeBoundaryPoints
  if (!points || points.length < 2) {
    return null
  }

  const cached = boundaryDomainPathCache.get(points)
  if (
    cached &&
    cached.expectedTotalLength === interval.figmaLikeBoundaryTotalLength
  ) {
    return cached.path
  }

  const path = buildBoundaryDomainPathForIntervalUncached(interval)
  boundaryDomainPathCache.set(points, {
    expectedTotalLength: interval.figmaLikeBoundaryTotalLength,
    path
  })
  return path
}

const getBoundaryDomainPathCacheKey = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeBoundaryDomainId'
    | 'figmaLikeBoundaryPoints'
    | 'figmaLikeBoundaryTotalLength'
  >
) => {
  if (
    !interval.figmaLikeBoundaryDomainId ||
    !interval.figmaLikeBoundaryPoints ||
    interval.figmaLikeBoundaryPoints.length < 2
  ) {
    return null
  }

  return [
    interval.figmaLikeBoundaryDomainId,
    interval.figmaLikeBoundaryPoints.length,
    interval.figmaLikeBoundaryTotalLength?.toFixed(6) ?? 'unknown'
  ].join('|')
}

const normalizeLoopDistance = (distance: number, totalLength: number) =>
  totalLength > 0 ? ((distance % totalLength) + totalLength) % totalLength : 0

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

type ConstrainedDashedPhysicalSpanRole = 'core' | 'start-cap' | 'end-cap'

interface ConstrainedDashedPhysicalSpan {
  spanId: string
  role: ConstrainedDashedPhysicalSpanRole
  startDistance: number
  endDistance: number
  wrapsSeam: boolean
  intervalLength: number
}

const splitLoopRangeIntoPhysicalSpans = (
  spanIdPrefix: string,
  role: ConstrainedDashedPhysicalSpanRole,
  rawStartDistance: number,
  rawEndDistance: number,
  totalLength: number
): ConstrainedDashedPhysicalSpan[] => {
  const intervalLength = rawEndDistance - rawStartDistance
  if (intervalLength <= EPSILON || totalLength <= EPSILON) {
    return []
  }

  if (intervalLength >= totalLength - EPSILON) {
    return [
      {
        spanId: `${spanIdPrefix}:${role}:0`,
        role,
        startDistance: 0,
        endDistance: totalLength,
        wrapsSeam: false,
        intervalLength: totalLength
      }
    ]
  }

  const startDistance = normalizeLoopDistance(rawStartDistance, totalLength)
  const endDistance = startDistance + intervalLength

  if (endDistance <= totalLength + EPSILON) {
    return [
      {
        spanId: `${spanIdPrefix}:${role}:0`,
        role,
        startDistance,
        endDistance: Math.min(endDistance, totalLength),
        wrapsSeam: false,
        intervalLength: Math.min(endDistance, totalLength) - startDistance
      }
    ].filter((span) => span.intervalLength > EPSILON)
  }

  return [
    {
      spanId: `${spanIdPrefix}:${role}:0`,
      role,
      startDistance,
      endDistance: totalLength,
      wrapsSeam: false,
      intervalLength: totalLength - startDistance
    },
    {
      spanId: `${spanIdPrefix}:${role}:1`,
      role,
      startDistance: 0,
      endDistance: endDistance - totalLength,
      wrapsSeam: false,
      intervalLength: endDistance - totalLength
    }
  ].filter((span) => span.intervalLength > EPSILON)
}

const splitIntervalCoreIntoPhysicalSpans = (
  spanIdPrefix: string,
  interval: VisibleDashedTopologyInterval,
  totalLength: number
): ConstrainedDashedPhysicalSpan[] =>
  interval.wrapsSeam
    ? [
        ...splitLoopRangeIntoPhysicalSpans(
          spanIdPrefix,
          'core',
          interval.startDistance,
          totalLength,
          totalLength
        ),
        ...splitLoopRangeIntoPhysicalSpans(
          spanIdPrefix,
          'core',
          0,
          interval.endDistance,
          totalLength
        )
      ]
    : splitLoopRangeIntoPhysicalSpans(
        spanIdPrefix,
        'core',
        interval.startDistance,
        interval.endDistance,
        totalLength
      )

const buildClosedSquareCapPhysicalSpans = (
  interval: VisibleDashedTopologyInterval,
  totalLength: number,
  capLength: number
): ConstrainedDashedPhysicalSpan[] => {
  const visibleLength = getVisibleIntervalLength(interval, totalLength)
  const effectiveLength = visibleLength + capLength * 2
  if (effectiveLength >= totalLength - EPSILON) {
    return splitLoopRangeIntoPhysicalSpans(
      interval.intervalId,
      'core',
      0,
      totalLength,
      totalLength
    )
  }

  if (capLength <= EPSILON) {
    return splitIntervalCoreIntoPhysicalSpans(
      interval.intervalId,
      interval,
      totalLength
    )
  }

  return splitLoopRangeIntoPhysicalSpans(
    interval.intervalId,
    'core',
    interval.startDistance - capLength,
    interval.startDistance - capLength + effectiveLength,
    totalLength
  )
}

const buildOpenSquareCapPhysicalSpans = (
  interval: VisibleDashedTopologyInterval,
  totalLength: number,
  capLength: number
): ConstrainedDashedPhysicalSpan[] => {
  if (capLength <= EPSILON || totalLength <= EPSILON) {
    return splitIntervalCoreIntoPhysicalSpans(
      interval.intervalId,
      interval,
      totalLength
    )
  }

  const constrainedTerminalRole =
    interval.figmaLikeSplitRangeId !== undefined ||
    interval.figmaLikeBoundaryDomainId !== undefined
      ? interval.figmaLikeTerminalRole
      : undefined
  const startCapLength =
    constrainedTerminalRole === 'start' ||
    constrainedTerminalRole === 'start-end'
      ? 0
      : capLength
  const endCapLength =
    constrainedTerminalRole === 'end' || constrainedTerminalRole === 'start-end'
      ? 0
      : capLength
  const startDistance = Math.max(0, interval.startDistance - startCapLength)
  const endDistance = Math.min(totalLength, interval.endDistance + endCapLength)
  if (endDistance <= startDistance + EPSILON) {
    return []
  }

  return [
    {
      spanId: `${interval.intervalId}:core:0`,
      role: 'core',
      startDistance,
      endDistance,
      wrapsSeam: false,
      intervalLength: endDistance - startDistance
    }
  ]
}

const getIntervalPhysicalSpans = (
  topology: Pick<PathTopologyModel, 'totalLength' | 'closed'>,
  stroke: Pick<RenderableStroke, 'cap' | 'width'>,
  interval: VisibleDashedTopologyInterval
): ConstrainedDashedPhysicalSpan[] => {
  if (stroke.cap === 'square' && topology.closed && stroke.width > EPSILON) {
    return buildClosedSquareCapPhysicalSpans(
      interval,
      topology.totalLength,
      stroke.width / 2
    )
  }

  if (
    stroke.cap === 'square' &&
    !topology.closed &&
    stroke.width > EPSILON &&
    (interval.figmaLikeSplitRangeId !== undefined ||
      interval.figmaLikeBoundaryDomainId !== undefined)
  ) {
    return buildOpenSquareCapPhysicalSpans(
      interval,
      topology.totalLength,
      stroke.width / 2
    )
  }

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
  >,
  options: ConstrainedDashedVisibleIntervalsOptions = {}
): VisibleDashedTopologyInterval[] => {
  if (!topology.closed && options.preferOpenPathNetworkIntervals === true) {
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
    strokeDomainPlan?.intervalDomainKind === 'figma-like-split-range' &&
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

  if (stroke.cap === 'square' && !topology.closed && stroke.width > EPSILON) {
    const squareCapGrowth = stroke.width
    const intervalAllocationDashPattern = stroke.dashPattern.map(
      (entry, index) =>
        index % 2 === 0
          ? Math.max(EPSILON, entry + squareCapGrowth)
          : Math.max(EPSILON, entry - squareCapGrowth)
    )
    return allocateDashedIntervalsForTopology(
      topology,
      intervalAllocationDashPattern,
      stroke.dashOffset + stroke.width / 2
    ).filter(
      (interval): interval is VisibleDashedTopologyInterval =>
        interval.kind === 'visible'
    )
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

const buildVisibleIntervalSignature = (
  intervals: ReturnType<typeof allocateDashedCenterStrokeIntervals>
) =>
  intervals
    .map((interval) =>
      [
        interval.kind,
        interval.intervalId,
        interval.authoredIndex,
        interval.startDistance.toFixed(6),
        interval.endDistance.toFixed(6),
        interval.wrapsSeam ? 'wrap' : 'nowrap',
        interval.previousVisibleIntervalId ?? 'none',
        interval.nextVisibleIntervalId ?? 'none'
      ].join(':')
    )
    .join('|')

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

const clampPolygonPointsToBounds = (
  polygons: Vec2[][],
  bounds: Bounds
): Vec2[][] =>
  polygons.map((polygon) =>
    polygon.map((point) => ({
      x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y))
    }))
  )

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

const isFullLoopVisibleInterval = (
  startDistance: number,
  endDistance: number,
  totalLength: number,
  wrapsSeam: boolean
) =>
  !wrapsSeam &&
  Math.abs(startDistance) <= EPSILON &&
  Math.abs(endDistance - totalLength) <= EPSILON

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

const findClosedSegmentIndexForDistance = (
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  distance: number
) =>
  segmentRanges.findIndex(
    (segment) =>
      distance > segment.startDistance + EPSILON &&
      distance < segment.endDistance - EPSILON
  )

const isDistanceWithinClosedSegmentRange = (
  segment: ReturnType<typeof getClosedSegmentRanges>[number],
  distance: number
) =>
  distance >= segment.startDistance - EPSILON &&
  distance <= segment.endDistance + EPSILON

const _isSingleEdgeVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  return segmentRanges.some(
    (segment) =>
      isDistanceWithinClosedSegmentRange(segment, startDistance) &&
      isDistanceWithinClosedSegmentRange(segment, endDistance)
  )
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

const isOrthogonalRectLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    return (
      closed &&
      loopPoints.length === 4 &&
      loopPoints.every((point, index) => {
        const next = loopPoints[(index + 1) % loopPoints.length]
        return (
          Math.abs(point.x - next.x) <= EPSILON ||
          Math.abs(point.y - next.y) <= EPSILON
        )
      })
    )
  })()

const isSingleObliqueQuadrilateralLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    if (!closed || loopPoints.length !== 4) {
      return false
    }

    let horizontalEdges = 0
    let verticalEdges = 0
    let obliqueEdges = 0

    loopPoints.forEach((point, index) => {
      const next = loopPoints[(index + 1) % loopPoints.length]
      const dx = Math.abs(point.x - next.x)
      const dy = Math.abs(point.y - next.y)

      if (dx <= EPSILON && dy <= EPSILON) {
        return
      }

      if (dy <= EPSILON) {
        horizontalEdges += 1
        return
      }

      if (dx <= EPSILON) {
        verticalEdges += 1
        return
      }

      obliqueEdges += 1
    })

    return horizontalEdges === 2 && verticalEdges === 1 && obliqueEdges === 1
  })()

const _isSingleCornerSpanningVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  if (wrapsSeam) {
    return false
  }

  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    endDistance
  )

  return (
    startSegmentIndex >= 0 &&
    endSegmentIndex >= 0 &&
    endSegmentIndex === startSegmentIndex + 1
  )
}

const isSmoothSampledClosedLoop = (points: Vec2[], closed: boolean) => {
  const loopPoints = getCanonicalClosedLoopPoints(points, closed)
  if (!closed || loopPoints.length < 12) {
    return false
  }

  return loopPoints.every((point, index) => {
    const previous =
      loopPoints[(index - 1 + loopPoints.length) % loopPoints.length]
    const next = loopPoints[(index + 1) % loopPoints.length]
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
    return Math.acos(dot) <= Math.PI / 4
  })
}

export const classifyConstrainedDashedSource = (
  points: Vec2[],
  closed: boolean,
  topology?: PathTopologyModel
): ConstrainedDashedSourceTopology => {
  if (topology) {
    if (!topology.closed && !topology.isSimpleOpen) {
      return 'self-intersecting'
    }
    return mapPathTopologyFamilyToConstrainedDashedSource(
      topology.topologyFamily
    )
  }

  if (!closed) {
    return 'open'
  }

  if (isOrthogonalRectLoop(points, closed)) {
    return 'rectangle-equivalent'
  }

  if (isSingleObliqueQuadrilateralLoop(points, closed)) {
    return 'broader-simple-closed'
  }

  return 'sampled-simple-closed'
}

const mapPathTopologyFamilyToConstrainedDashedSource = (
  topologyFamily: PathTopologyFamily
): ConstrainedDashedSourceTopology => {
  return topologyFamily
}

const classifyConstrainedDashedIntervalTopology = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor
): ConstrainedDashedIntervalTopology =>
  classifyConstrainedDashedIntervalTopologyFromRanges(
    points,
    closed,
    interval,
    getClosedSegmentRanges(points, closed)
  )

const classifyConstrainedDashedIntervalTopologyFromRanges = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
): ConstrainedDashedIntervalTopology => {
  if (
    isFullLoopVisibleInterval(
      interval.startDistance,
      interval.endDistance,
      interval.totalLength,
      interval.wrapsSeam
    )
  ) {
    return 'full-loop'
  }

  if (interval.wrapsSeam) {
    return 'seam-wrapping'
  }

  if (
    segmentRanges.length > 0 &&
    segmentRanges.some(
      (segment) =>
        isDistanceWithinClosedSegmentRange(segment, interval.startDistance) &&
        isDistanceWithinClosedSegmentRange(segment, interval.endDistance)
    )
  ) {
    return 'single-edge'
  }

  if (
    !interval.wrapsSeam &&
    (() => {
      const startSegmentIndex = findClosedSegmentIndexForDistance(
        segmentRanges,
        interval.startDistance
      )
      const endSegmentIndex = findClosedSegmentIndexForDistance(
        segmentRanges,
        interval.endDistance
      )

      return (
        startSegmentIndex >= 0 &&
        endSegmentIndex >= 0 &&
        endSegmentIndex === startSegmentIndex + 1
      )
    })()
  ) {
    return 'corner-spanning'
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    interval.startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    interval.endDistance
  )

  if (
    startSegmentIndex >= 0 &&
    endSegmentIndex >= 0 &&
    endSegmentIndex > startSegmentIndex + 1
  ) {
    return 'multi-corner'
  }

  return 'other'
}

const acceptsFullLoopRoundJoin = (
  sourceTopology: ConstrainedDashedSourceTopology,
  points: Vec2[],
  closed: boolean,
  stroke: Pick<RenderableStroke, 'join'>
) => {
  if (stroke.join !== 'round') {
    return false
  }

  if (
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed' ||
    sourceTopology === 'self-intersecting'
  ) {
    return true
  }

  if (sourceTopology === 'sampled-simple-closed') {
    return isSmoothSampledClosedLoop(points, closed)
  }

  return false
}

const acceptsSingleEdgeRoundCap = (
  sourceTopology: ConstrainedDashedSourceTopology,
  stroke: Pick<RenderableStroke, 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return false
  }

  return (
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed'
  )
}

const acceptsCornerSpanningJoin = (
  sourceTopology: ConstrainedDashedSourceTopology,
  stroke: Pick<RenderableStroke, 'join'>
) => {
  const acceptsBevelFamily = stroke.join === 'bevel' || stroke.join === 'round'
  const acceptsMiterFamily = stroke.join === 'miter'
  const supportedSource =
    sourceTopology === 'rectangle-equivalent' ||
    sourceTopology === 'broader-simple-closed'

  return supportedSource && (acceptsBevelFamily || acceptsMiterFamily)
}

export const classifyConstrainedDashedInterval = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  stroke: Pick<RenderableStroke, 'position' | 'join' | 'cap'>,
  options: ConstrainedDashedStrokeOptions = {}
): ConstrainedDashedIntervalClassification => {
  const sourceTopology = classifyConstrainedDashedSource(
    points,
    closed,
    options.topology
  )
  const intervalTopology = classifyConstrainedDashedIntervalTopology(
    points,
    closed,
    interval
  )

  return {
    sourceTopology,
    intervalTopology,
    acceptsFullLoopRoundJoin:
      intervalTopology === 'full-loop' &&
      acceptsFullLoopRoundJoin(sourceTopology, points, closed, stroke),
    acceptsSingleEdgeRoundCap:
      intervalTopology === 'single-edge' &&
      acceptsSingleEdgeRoundCap(sourceTopology, stroke),
    acceptsCornerSpanningJoin:
      intervalTopology === 'corner-spanning' &&
      acceptsCornerSpanningJoin(sourceTopology, stroke)
  }
}

const classifyConstrainedDashedIntervalWithContext = (
  points: Vec2[],
  closed: boolean,
  interval: ConstrainedDashedIntervalDescriptor,
  stroke: Pick<RenderableStroke, 'position' | 'join' | 'cap'>,
  sourceTopology: ConstrainedDashedSourceTopology,
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
): ConstrainedDashedIntervalClassification => {
  const intervalTopology =
    sourceTopology === 'open'
      ? 'other'
      : classifyConstrainedDashedIntervalTopologyFromRanges(
          points,
          closed,
          interval,
          segmentRanges
        )

  return {
    sourceTopology,
    intervalTopology,
    acceptsFullLoopRoundJoin:
      intervalTopology === 'full-loop' &&
      acceptsFullLoopRoundJoin(sourceTopology, points, closed, stroke),
    acceptsSingleEdgeRoundCap:
      intervalTopology === 'single-edge' &&
      acceptsSingleEdgeRoundCap(sourceTopology, stroke),
    acceptsCornerSpanningJoin:
      intervalTopology === 'corner-spanning' &&
      acceptsCornerSpanningJoin(sourceTopology, stroke)
  }
}

const classifySourcePathSampledSimpleDashedInterval = (
  sourceTopology: ConstrainedDashedSourceTopology
): ConstrainedDashedIntervalClassification => ({
  sourceTopology,
  intervalTopology: 'other',
  acceptsFullLoopRoundJoin: false,
  acceptsSingleEdgeRoundCap: false,
  acceptsCornerSpanningJoin: false
})

const getConstrainedDashedPacketOwnerKey = (
  packet: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>
) => packet.geometry.debugMeta?.ownerKey ?? null

export const classifyConstrainedDashedOwnership = (
  packets: Pick<SolidCenterStrokeResolvedPacket, 'geometry'>[]
): ConstrainedDashedOwnershipClassification => {
  if (packets.length === 0) {
    return {
      status: 'blocked',
      reason: 'no-packets',
      ownerKeys: [],
      packetCount: 0
    }
  }

  const parsedOwnerKeys = packets.map(getConstrainedDashedPacketOwnerKey)
  const ownerKeys = parsedOwnerKeys.filter(
    (ownerKey): ownerKey is string => ownerKey !== null
  )

  if (ownerKeys.length !== packets.length) {
    return {
      status: 'blocked',
      reason: 'missing-owner-metadata',
      ownerKeys,
      packetCount: packets.length
    }
  }

  const uniqueOwnerKeys = [...new Set(ownerKeys)]

  return {
    status: 'accepted',
    reason: uniqueOwnerKeys.length === 1 ? 'single-owner' : 'typed-owners',
    ownerKeys: uniqueOwnerKeys,
    packetCount: packets.length
  }
}

export const classifyConstrainedDashedRuntimeStatus = ({
  points,
  closed,
  topology,
  candidatePackets,
  blockedReason
}: ConstrainedDashedRuntimeStatusInput): ConstrainedDashedRuntimeStatusClassification => {
  const sourceTopology = classifyConstrainedDashedSource(
    points,
    closed,
    topology
  )
  const ownership = classifyConstrainedDashedOwnership(candidatePackets)

  if (ownership.status === 'accepted') {
    return {
      status: 'accepted',
      reason: ownership.reason,
      sourceTopology,
      ownership
    }
  }

  if (sourceTopology === 'open') {
    return {
      status: 'blocked',
      reason: blockedReason ?? 'no-candidate-packets',
      sourceTopology,
      ownership
    }
  }

  if (
    sourceTopology === 'self-intersecting' ||
    sourceTopology === 'degenerate'
  ) {
    return {
      status: 'blocked',
      reason: blockedReason ?? 'unsupported-topology',
      sourceTopology,
      ownership
    }
  }

  return {
    status: 'blocked',
    reason: blockedReason ?? ownership.reason,
    sourceTopology,
    ownership
  }
}

const normalizeVector = (point: Vec2) => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPSILON) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

const isSupportedConstrainedDashedInterval = (
  classification: ConstrainedDashedIntervalClassification,
  stroke: RenderableStroke
) => {
  if (classification.sourceTopology === 'open') {
    return true
  }

  if (classification.sourceTopology === 'degenerate') {
    return false
  }

  if (classification.sourceTopology === 'self-intersecting') {
    return true
  }

  if (classification.sourceTopology === 'sampled-simple-closed') {
    return classification.intervalTopology !== 'full-loop'
  }

  if (classification.intervalTopology === 'single-edge') {
    return stroke.cap === 'round'
      ? classification.acceptsSingleEdgeRoundCap
      : classification.sourceTopology === 'rectangle-equivalent' ||
          classification.sourceTopology === 'broader-simple-closed'
  }

  if (classification.intervalTopology === 'corner-spanning') {
    return classification.acceptsCornerSpanningJoin
  }

  return (
    classification.sourceTopology === 'rectangle-equivalent' ||
    classification.sourceTopology === 'broader-simple-closed' ||
    classification.sourceTopology === 'self-intersecting'
  )
}

const getConstrainedDashedResolutionStatus = (
  sourceTopology: ConstrainedDashedSourceTopology,
  intervalTopology?: ConstrainedDashedIntervalTopology,
  forceLocalSideApproximation = false
): Exclude<
  SolidCenterStrokeGeometryDebugMeta['resolutionStatus'],
  undefined
> =>
  forceLocalSideApproximation ||
  (sourceTopology === 'sampled-simple-closed' &&
    intervalTopology !== 'full-loop')
    ? 'local-side-approximation'
    : 'exact-constrained'

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
  capOwnership: ReturnType<typeof getSourcePathRangeRoundCapOwnership>
}

interface DashedSourcePathIntervalSweep {
  ranges: DashedSourcePathIntervalSweepRange[]
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
const sourcePathIntervalStrokePathCache = new Map<string, Vec2[][]>()
const exactSourcePathRibbonSegmentFrameCache = new Map<
  string,
  ExactSourcePathRibbonSegmentFrame
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
  ribbonPolygonCache: Map<string, Vec2[][] | null>
  segmentBoundaryCache: Map<number, Vec2[]>
  segmentBoundaryClipCache: Map<string, SourceSegmentBoundaryClipData>
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
  segmentRange: SourcePathSegmentRange | undefined,
  spanRole: ConstrainedDashedPhysicalSpanRole,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
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

  return [
    buildExactSourcePathRibbonSegmentFrameCacheKey(
      segment,
      samplingTolerance,
      samplingOptions
    ),
    spanRole,
    stroke.position,
    stroke.width.toFixed(4),
    stroke.cap,
    roundCapStart === true ? 'rs' : 'ns',
    roundCapEnd === true ? 're' : 'ne',
    roundCapVisualMaxLength.toFixed(4),
    renderRange.segmentIndex,
    formatSourcePathRangeKeyDistance(localStartDistance),
    formatSourcePathRangeKeyDistance(localEndDistance)
  ].join('|')
}

const buildSourcePathIntervalStrokePathCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  interval: VisibleDashedTopologyInterval,
  intervalRanges: { startDistance: number; endDistance: number }[],
  slicingContext: SourcePathSlicingContext
) => {
  const rangeKeys = intervalRanges.map((range) => {
    const splitRanges = splitSourcePathRangeBySegmentBoundaries(
      path,
      range.startDistance,
      range.endDistance,
      slicingContext
    )
    const segmentsKey = splitRanges
      .map((splitRange) => {
        const segmentRange =
          slicingContext.segmentRanges[splitRange.segmentIndex]
        const segment = path.segments[splitRange.segmentIndex]
        if (!segmentRange || !segment) {
          return null
        }
        const localStartDistance =
          splitRange.startDistance - segmentRange.startDistance
        const localEndDistance =
          splitRange.endDistance - segmentRange.startDistance
        return [
          splitRange.segmentIndex,
          buildExactSourcePathRibbonSegmentFrameCacheKey(
            segment,
            slicingContext.samplingTolerance,
            slicingContext.samplingOptions
          ),
          formatSourcePathRangeKeyDistance(localStartDistance),
          formatSourcePathRangeKeyDistance(localEndDistance)
        ].join(':')
      })
      .filter((entry): entry is string => !!entry)
      .join(',')
    return [
      formatSourcePathRangeKeyDistance(range.startDistance),
      formatSourcePathRangeKeyDistance(range.endDistance),
      segmentsKey
    ].join('@')
  })

  return [
    'interval-stroke-path:v1',
    path.closed ? 'closed' : 'open',
    interval.wrapsSeam ? 'wrap' : 'range',
    slicingContext.samplingTolerance.toFixed(4),
    slicingContext.samplingOptions.minCubicSamples ?? 'default-min',
    slicingContext.samplingOptions.maxCubicSamples ?? 'default-max',
    slicingContext.samplingOptions.useRangeLengthForSampleCount === true
      ? 'range'
      : 'curve',
    formatSourcePathRangeKeyDistance(interval.startDistance),
    formatSourcePathRangeKeyDistance(interval.endDistance),
    rangeKeys.join('|')
  ].join('|')
}

const getCachedSourcePathFinalRangePolygons = (cacheKey: string) => {
  const cached = sourcePathFinalRangePolygonCache.get(cacheKey)
  if (!cached) {
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

const getCachedSourcePathIntervalStrokePaths = (cacheKey: string) => {
  const cached = sourcePathIntervalStrokePathCache.get(cacheKey)
  if (!cached) {
    return null
  }

  sourcePathIntervalStrokePathCache.delete(cacheKey)
  sourcePathIntervalStrokePathCache.set(cacheKey, cached)
  emitStrokePipelineCounter('source-path-interval-stroke-path-cache-hit')
  return cached
}

const setCachedSourcePathIntervalStrokePaths = (
  cacheKey: string,
  strokePaths: Vec2[][]
) => {
  emitStrokePipelineCounter('source-path-interval-stroke-path-cache-miss')
  sourcePathIntervalStrokePathCache.set(cacheKey, strokePaths)
  if (
    sourcePathIntervalStrokePathCache.size >
    SOURCE_PATH_INTERVAL_STROKE_PATH_CACHE_LIMIT
  ) {
    const [oldestKey] = sourcePathIntervalStrokePathCache.keys()
    if (oldestKey) {
      sourcePathIntervalStrokePathCache.delete(oldestKey)
    }
  }
}

const buildExactSourcePathRibbonSegmentFrame = (
  path: Pick<PathGeometry, 'segments'>,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
): ExactSourcePathRibbonSegmentFrame => {
  const segment = path.segments[range.index]
  const frames = segment
    ? samplePathSegmentFramesByLengthStep(
        segment,
        0,
        segment.length,
        samplingTolerance,
        samplingOptions
      )
    : []
  const cumulativeDistances = [0]
  for (let index = 1; index < frames.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[cumulativeDistances.length - 1] +
        distanceBetween(frames[index - 1].point, frames[index].point)
    )
  }
  const polylineLength =
    cumulativeDistances[cumulativeDistances.length - 1] ?? 0
  const scale =
    segment && polylineLength > EPSILON ? segment.length / polylineLength : 1
  const lastIndex = Math.max(1, frames.length - 1)
  return {
    segmentIndex: range.index,
    segmentLength: segment?.length ?? 0,
    frames,
    distances:
      polylineLength > EPSILON
        ? cumulativeDistances.map((distance) => distance * scale)
        : frames.map((_, index) =>
            segment ? (segment.length * index) / lastIndex : 0
          )
  }
}

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

const buildExactLineSourcePathRibbonSegmentFrame = (
  segment: Extract<PathSegment, { type: 'line' }>,
  segmentIndex: number
): ExactSourcePathRibbonSegmentFrame => {
  const tangent = getLineSegmentTangent(segment)
  const start = normalizePoint(segment.start)
  const end = normalizePoint(segment.end)
  const frames =
    segment.length <= EPSILON || distanceBetween(start, end) <= EPSILON
      ? [{ point: start, tangent }]
      : [
          { point: start, tangent },
          { point: end, tangent }
        ]

  return {
    segmentIndex,
    segmentLength: segment.length,
    frames,
    distances: frames.length > 1 ? [0, segment.length] : [0]
  }
}

const getExactSourcePathRibbonSegmentFrame = (
  path: Pick<PathGeometry, 'segments'>,
  range: SourcePathSegmentRange,
  samplingTolerance: number,
  samplingOptions: PathSliceSamplingOptions
) => {
  const segment = path.segments[range.index]
  if (!segment) {
    return buildExactSourcePathRibbonSegmentFrame(
      path,
      range,
      samplingTolerance,
      samplingOptions
    )
  }

  if (segment.type === 'line') {
    emitStrokePipelineCounter('source-path-ribbon-line-segment-frame-direct')
    return buildExactLineSourcePathRibbonSegmentFrame(segment, range.index)
  }

  const cacheKey = buildExactSourcePathRibbonSegmentFrameCacheKey(
    segment,
    samplingTolerance,
    samplingOptions
  )
  const cached = exactSourcePathRibbonSegmentFrameCache.get(cacheKey)
  if (cached) {
    emitStrokePipelineCounter('source-path-ribbon-segment-frame-cache-hit')
    exactSourcePathRibbonSegmentFrameCache.delete(cacheKey)
    exactSourcePathRibbonSegmentFrameCache.set(cacheKey, cached)
    return {
      ...cached,
      segmentIndex: range.index
    }
  }

  emitStrokePipelineCounter('source-path-ribbon-segment-frame-cache-miss')
  const frame = buildExactSourcePathRibbonSegmentFrame(
    path,
    range,
    samplingTolerance,
    samplingOptions
  )
  exactSourcePathRibbonSegmentFrameCache.set(cacheKey, frame)
  if (
    exactSourcePathRibbonSegmentFrameCache.size >
    SOURCE_PATH_RIBBON_FRAME_CACHE_LIMIT * 8
  ) {
    const [oldestKey] = exactSourcePathRibbonSegmentFrameCache.keys()
    if (oldestKey) {
      exactSourcePathRibbonSegmentFrameCache.delete(oldestKey)
    }
  }
  return frame
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
    ribbonPolygonCache: new Map(),
    segmentBoundaryCache: new Map(),
    segmentBoundaryClipCache: new Map(),
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

const splitVisibleIntervalBySourceSegments = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeSideResolutionStatus'
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

const buildContinuousSourcePathIntervalRange = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  span: Pick<ConstrainedDashedPhysicalSpan, 'startDistance' | 'endDistance'>,
  slicingContext?: SourcePathSlicingContext
): SourceSegmentIntervalRange[] => {
  const segmentRanges =
    slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
  if (
    segmentRanges.length === 0 ||
    span.endDistance - span.startDistance <= EPSILON
  ) {
    return []
  }

  const segmentIndex = Math.min(
    segmentRanges.length - 1,
    Math.max(
      0,
      lowerBoundSourcePathSegmentEnd(
        segmentRanges,
        span.startDistance + EPSILON
      )
    )
  )

  return [
    {
      startDistance: Math.max(0, span.startDistance),
      endDistance: Math.min(path.totalLength, span.endDistance),
      segmentIndex
    }
  ].filter((range) => range.endDistance - range.startDistance > EPSILON)
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

const isSourcePathRangeAtVisibleIntervalStart = (
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'startDistance' | 'wrapsSeam'
  >,
  totalLength: number
) =>
  areLoopDistancesEqual(
    range.startDistance,
    interval.startDistance,
    totalLength
  )

const isSourcePathRangeAtVisibleIntervalEnd = (
  range: SourceSegmentIntervalRange,
  interval: Pick<
    ReturnType<typeof allocateDashedIntervalsForTopology>[number],
    'endDistance' | 'wrapsSeam'
  >,
  totalLength: number
) => areLoopDistancesEqual(range.endDistance, interval.endDistance, totalLength)

interface SourcePathRangeCapOwnership {
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
  roundCapStart: boolean | undefined
  roundCapEnd: boolean | undefined
  openPathTerminalCapStart: boolean | undefined
  openPathTerminalCapEnd: boolean | undefined
  openPathTerminalCapStyle: RenderableStroke['cap'] | undefined
}

const getSourcePathRangeRoundCapOwnership = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeSideResolutionReason'
    | 'figmaLikeBoundaryPoints'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  terminalCapStyle: RenderableStroke['cap'],
  segmentRanges: SourcePathSegmentRange[]
): SourcePathRangeCapOwnership => {
  if (stroke.cap !== 'round') {
    return {
      stroke,
      roundCapStart: undefined,
      roundCapEnd: undefined,
      openPathTerminalCapStart: undefined,
      openPathTerminalCapEnd: undefined,
      openPathTerminalCapStyle: undefined
    }
  }

  const rangeOwnsStartCap = isSourcePathRangeAtVisibleIntervalStart(
    range,
    interval,
    path.totalLength
  )
  const rangeOwnsEndCap = isSourcePathRangeAtVisibleIntervalEnd(
    range,
    interval,
    path.totalLength
  )
  const ownsOpenPathStartTerminalCap =
    !path.closed &&
    rangeOwnsStartCap &&
    interval.startDistance <= EPSILON &&
    (terminalCapStyle === 'square' || terminalCapStyle === 'round')
  const ownsOpenPathEndTerminalCap =
    !path.closed &&
    rangeOwnsEndCap &&
    interval.endDistance >= path.totalLength - EPSILON &&
    (terminalCapStyle === 'square' || terminalCapStyle === 'round')
  const roundCapStart = rangeOwnsStartCap
  const roundCapEnd = rangeOwnsEndCap

  return {
    stroke:
      roundCapStart || roundCapEnd
        ? stroke
        : {
            ...stroke,
            cap: 'butt' as const
          },
    roundCapStart,
    roundCapEnd,
    openPathTerminalCapStart: ownsOpenPathStartTerminalCap,
    openPathTerminalCapEnd: ownsOpenPathEndTerminalCap,
    openPathTerminalCapStyle: terminalCapStyle
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
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeSideResolutionReason'
    | 'figmaLikeBoundaryPoints'
  >,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  squareCapPhysicalStroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext?: SourcePathSlicingContext,
  options: { preserveDomainContinuity?: boolean } = {}
): DashedSourcePathIntervalSweep => {
  emitStrokePipelineCounter('interval-sweep-count')
  const ranges: DashedSourcePathIntervalSweepRange[] = []

  physicalSpans.forEach((span) => {
    const sourceRanges =
      options.preserveDomainContinuity === true
        ? buildContinuousSourcePathIntervalRange(path, span, slicingContext)
        : splitVisibleIntervalBySourceSegments(path, span, slicingContext)
    sourceRanges.forEach((range) => {
      const segmentRanges =
        slicingContext?.segmentRanges ?? getSourcePathSegmentRanges(path)
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
        capOwnership: getSourcePathRangeRoundCapOwnership(
          path,
          range,
          interval,
          squareCapPhysicalStroke,
          stroke.cap,
          segmentRanges
        )
      })
    })
  })

  return { ranges }
}

const countTerminalCapsInIntervalSweep = (
  intervalSweep: DashedSourcePathIntervalSweep
) =>
  intervalSweep.ranges.reduce(
    (count, { capOwnership }) =>
      count +
      (capOwnership.roundCapStart === true ? 1 : 0) +
      (capOwnership.roundCapEnd === true ? 1 : 0),
    0
  )

const EMPTY_STROKE_PACKET_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0
}

const getSourcePathRibbonCacheKey = (
  range: SourceSegmentIntervalRange,
  role: ConstrainedDashedPhysicalSpanRole,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined
) =>
  [
    range.segmentIndex,
    role,
    formatSourcePathRangeKeyDistance(range.startDistance),
    formatSourcePathRangeKeyDistance(range.endDistance),
    stroke.position,
    stroke.width.toFixed(6),
    stroke.join,
    stroke.miterLimit.toFixed(6),
    stroke.cap,
    roundCapStart === true ? 'rs' : 'ns',
    roundCapEnd === true ? 're' : 'ne'
  ].join(':')

const getConstrainedRibbonOffsetDistance = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => (stroke.position === 'inside' ? stroke.width : -stroke.width)

const getOffsetVectorForSegment = (
  from: Vec2,
  to: Vec2,
  offset: number
): Vec2 | null => {
  const direction = normalizeVector({
    x: to.x - from.x,
    y: to.y - from.y
  })
  if (!direction) {
    return null
  }

  return {
    x: -direction.y * offset,
    y: direction.x * offset
  }
}

const buildSourcePathRibbonOffsetBoundary = (
  source: Vec2[],
  offset: number
) => {
  if (source.length < 2) {
    return []
  }

  const offsetBoundary: Vec2[] = []

  for (let index = 0; index < source.length; index += 1) {
    const point = source[index]
    const previous = index > 0 ? source[index - 1] : null
    const next = index < source.length - 1 ? source[index + 1] : null
    const previousOffset = previous
      ? getOffsetVectorForSegment(previous, point, offset)
      : null
    const nextOffset = next
      ? getOffsetVectorForSegment(point, next, offset)
      : null
    const offsetVector =
      previousOffset && nextOffset
        ? normalizeVector({
            x: previousOffset.x + nextOffset.x,
            y: previousOffset.y + nextOffset.y
          })
        : previousOffset
          ? normalizeVector(previousOffset)
          : nextOffset
            ? normalizeVector(nextOffset)
            : null

    if (!offsetVector) {
      return []
    }

    offsetBoundary.push(
      normalizePoint({
        x: point.x + offsetVector.x * Math.abs(offset),
        y: point.y + offsetVector.y * Math.abs(offset)
      })
    )
  }

  return offsetBoundary
}

const ROUND_CAP_VISUAL_MAX_LENGTH = 0.35
const DRAG_ROUND_CAP_VISUAL_MAX_LENGTH = 2
const DRAG_PRODUCT_VISUAL_MICRO_EDGE_TOLERANCE = 0.03
const DRAG_PRODUCT_VISUAL_COLLINEAR_TOLERANCE = 0.0075
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

const getOneSidedRibbonRoundCapFrame = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  maxArcLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  const sideX = endpoint.x - offsetEndpoint.x
  const sideY = endpoint.y - offsetEndpoint.y
  const diameter = Math.hypot(sideX, sideY)
  const radius = diameter / 2
  if (diameter <= EPSILON || radius <= EPSILON) {
    return null
  }

  const tangentLengthSquared = tangent.x * tangent.x + tangent.y * tangent.y
  if (tangentLengthSquared <= EPSILON * EPSILON) {
    return null
  }
  const tangentScale =
    Math.abs(tangentLengthSquared - 1) <= EPSILON
      ? 1
      : 1 / Math.sqrt(tangentLengthSquared)
  const bulgeSign = isStart ? -1 : 1
  const bulgeDirection = {
    x: tangent.x * tangentScale * bulgeSign,
    y: tangent.y * tangentScale * bulgeSign
  }

  const segmentCount = Math.max(3, Math.ceil((Math.PI * radius) / maxArcLength))

  return {
    center: {
      x: (endpoint.x + offsetEndpoint.x) / 2,
      y: (endpoint.y + offsetEndpoint.y) / 2
    },
    radius,
    side: {
      x: sideX / diameter,
      y: sideY / diameter
    },
    bulgeDirection,
    unitSemicircle: getRoundCapUnitSemicircle(segmentCount)
  }
}

const appendOneSidedRibbonRoundCap = (
  output: Vec2[],
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  options?: {
    reverse?: boolean
    skipFirst?: boolean
    maxArcLength?: number
  }
) => {
  const frame = getOneSidedRibbonRoundCapFrame(
    endpoint,
    offsetEndpoint,
    tangent,
    isStart,
    options?.maxArcLength
  )
  if (!frame) {
    return
  }

  const appendAt = (index: number) => {
    const { cos, sin } = frame.unitSemicircle[index]
    const x =
      frame.center.x +
      frame.radius * (frame.side.x * cos + frame.bulgeDirection.x * sin)
    const y =
      frame.center.y +
      frame.radius * (frame.side.y * cos + frame.bulgeDirection.y * sin)
    output.push(
      normalizePoint({
        x,
        y
      })
    )
  }

  if (options?.reverse === true) {
    const endIndex = options.skipFirst === true ? 0 : -1
    for (
      let index = frame.unitSemicircle.length - 1;
      index > endIndex;
      index -= 1
    ) {
      appendAt(index)
    }
    return
  }

  const startIndex = options?.skipFirst === true ? 1 : 0
  for (
    let index = startIndex;
    index < frame.unitSemicircle.length;
    index += 1
  ) {
    appendAt(index)
  }
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

const lowerBoundDistance = (distances: number[], target: number) => {
  let low = 0
  let high = distances.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (distances[mid] < target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

const getOffsetRibbonFrameCacheKey = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => [stroke.position, stroke.width.toFixed(6)].join(':')

const buildOffsetRibbonSegmentFrame = (
  segmentFrame: ExactSourcePathRibbonSegmentFrame,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): ExactSourcePathOffsetRibbonSegmentFrame => {
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const maxOffsetChordLength = Math.max(1.5, stroke.width * 0.3)
  const toOffsetFrame = (frame: PathSampleFrame): OffsetPathSampleFrame => {
    const tangent = normalizeVector(frame.tangent) ?? frame.tangent
    const point = normalizePoint(frame.point)
    return {
      point,
      tangent,
      offsetPoint: normalizePoint({
        x: point.x - tangent.y * offset,
        y: point.y + tangent.x * offset
      })
    }
  }

  const interpolateFrame = (
    start: PathSampleFrame,
    end: PathSampleFrame,
    amount: number
  ): PathSampleFrame => {
    const tangent =
      normalizeVector({
        x: start.tangent.x + (end.tangent.x - start.tangent.x) * amount,
        y: start.tangent.y + (end.tangent.y - start.tangent.y) * amount
      }) ?? start.tangent
    return {
      point: normalizePoint({
        x: start.point.x + (end.point.x - start.point.x) * amount,
        y: start.point.y + (end.point.y - start.point.y) * amount
      }),
      tangent
    }
  }

  const frames: OffsetPathSampleFrame[] = []
  const distances: number[] = []
  segmentFrame.frames.forEach((frame, index) => {
    if (index === 0) {
      frames.push(toOffsetFrame(frame))
      distances.push(segmentFrame.distances[index] ?? 0)
      return
    }

    const previousFrame = segmentFrame.frames[index - 1]
    const previousDistance = segmentFrame.distances[index - 1] ?? 0
    const currentDistance = segmentFrame.distances[index] ?? previousDistance
    const previousOffsetFrame = frames[frames.length - 1]
    const currentOffsetFrame = toOffsetFrame(frame)
    const offsetChordLength = previousOffsetFrame
      ? distanceBetween(
          previousOffsetFrame.offsetPoint,
          currentOffsetFrame.offsetPoint
        )
      : 0
    const subdivisionCount =
      maxOffsetChordLength > EPSILON
        ? Math.max(1, Math.ceil(offsetChordLength / maxOffsetChordLength))
        : 1

    for (let step = 1; step < subdivisionCount; step += 1) {
      const amount = step / subdivisionCount
      frames.push(toOffsetFrame(interpolateFrame(previousFrame, frame, amount)))
      distances.push(
        previousDistance + (currentDistance - previousDistance) * amount
      )
    }
    frames.push(currentOffsetFrame)
    distances.push(currentDistance)
  })

  return {
    segmentIndex: segmentFrame.segmentIndex,
    segmentLength: segmentFrame.segmentLength,
    distances,
    frames
  }
}

const getExactRibbonSegmentFrameForContext = (
  path: Pick<PathGeometry, 'segments'>,
  segmentIndex: number,
  slicingContext: SourcePathSlicingContext
) => {
  const cached = slicingContext.exactRibbonSegmentFrames.get(segmentIndex)
  if (cached) {
    return cached
  }

  const segmentRange = slicingContext.segmentRanges[segmentIndex]
  if (!segmentRange) {
    return null
  }

  const segmentFrame = getExactSourcePathRibbonSegmentFrame(
    path,
    segmentRange,
    SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
    SOURCE_PATH_RIBBON_FRAME_SAMPLING
  )
  slicingContext.exactRibbonSegmentFrames.set(segmentIndex, segmentFrame)
  return segmentFrame
}

const getOffsetRibbonSegmentFrameForContext = (
  path: Pick<PathGeometry, 'segments'>,
  segmentIndex: number,
  slicingContext: SourcePathSlicingContext,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const cacheKey = `${segmentIndex}:${getOffsetRibbonFrameCacheKey(stroke)}`
  const cached = slicingContext.offsetRibbonSegmentFrames.get(cacheKey)
  if (cached) {
    return cached
  }

  const exactSegmentFrame = getExactRibbonSegmentFrameForContext(
    path,
    segmentIndex,
    slicingContext
  )
  if (!exactSegmentFrame) {
    return null
  }

  const offsetSegmentFrame = buildOffsetRibbonSegmentFrame(
    exactSegmentFrame,
    stroke
  )
  slicingContext.offsetRibbonSegmentFrames.set(cacheKey, offsetSegmentFrame)
  return offsetSegmentFrame
}

const interpolateRibbonSegmentFrameAtDistance = (
  segmentFrame: ExactSourcePathRibbonSegmentFrame,
  distance: number
): PathSampleFrame | null => {
  if (segmentFrame.frames.length === 0) {
    return null
  }
  if (
    segmentFrame.frames.length === 1 ||
    segmentFrame.segmentLength <= EPSILON
  ) {
    return segmentFrame.frames[0]
  }

  const clampedDistance = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, distance)
  )
  const index = Math.max(
    1,
    Math.min(
      segmentFrame.frames.length - 1,
      lowerBoundDistance(segmentFrame.distances, clampedDistance)
    )
  )
  const previousDistance = segmentFrame.distances[index - 1]
  const nextDistance = segmentFrame.distances[index]
  const amount =
    nextDistance - previousDistance > EPSILON
      ? (clampedDistance - previousDistance) / (nextDistance - previousDistance)
      : 0
  const previous = segmentFrame.frames[index - 1]
  const next = segmentFrame.frames[index]
  const tangent =
    normalizeVector({
      x: previous.tangent.x + (next.tangent.x - previous.tangent.x) * amount,
      y: previous.tangent.y + (next.tangent.y - previous.tangent.y) * amount
    }) ?? previous.tangent
  return {
    point: normalizePoint({
      x: previous.point.x + (next.point.x - previous.point.x) * amount,
      y: previous.point.y + (next.point.y - previous.point.y) * amount
    }),
    tangent
  }
}

const interpolateOffsetRibbonSegmentFrameAtDistance = (
  segmentFrame: ExactSourcePathOffsetRibbonSegmentFrame,
  distance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): OffsetPathSampleFrame | null => {
  if (segmentFrame.frames.length === 0) {
    return null
  }
  if (
    segmentFrame.frames.length === 1 ||
    segmentFrame.segmentLength <= EPSILON
  ) {
    return segmentFrame.frames[0]
  }

  const clampedDistance = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, distance)
  )
  const index = Math.max(
    1,
    Math.min(
      segmentFrame.frames.length - 1,
      lowerBoundDistance(segmentFrame.distances, clampedDistance)
    )
  )
  const previousDistance = segmentFrame.distances[index - 1]
  const nextDistance = segmentFrame.distances[index]
  const amount =
    nextDistance - previousDistance > EPSILON
      ? (clampedDistance - previousDistance) / (nextDistance - previousDistance)
      : 0
  const previous = segmentFrame.frames[index - 1]
  const next = segmentFrame.frames[index]
  const tangent =
    normalizeVector({
      x: previous.tangent.x + (next.tangent.x - previous.tangent.x) * amount,
      y: previous.tangent.y + (next.tangent.y - previous.tangent.y) * amount
    }) ?? previous.tangent
  const point = normalizePoint({
    x: previous.point.x + (next.point.x - previous.point.x) * amount,
    y: previous.point.y + (next.point.y - previous.point.y) * amount
  })
  const offset = getConstrainedRibbonOffsetDistance(stroke)

  return {
    point,
    tangent,
    offsetPoint: normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  }
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

const sliceExactRibbonSegmentFrames = (
  segmentFrame: ExactSourcePathRibbonSegmentFrame,
  localStartDistance: number,
  localEndDistance: number
) => {
  if (localEndDistance - localStartDistance <= EPSILON) {
    return []
  }

  const start = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localStartDistance)
  )
  const end = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localEndDistance)
  )
  if (end - start <= EPSILON) {
    return []
  }

  const startFrame = interpolateRibbonSegmentFrameAtDistance(
    segmentFrame,
    start
  )
  const endFrame = interpolateRibbonSegmentFrameAtDistance(segmentFrame, end)
  if (!startFrame || !endFrame) {
    return []
  }

  const frames = [startFrame]
  const firstInteriorIndex = Math.max(
    1,
    lowerBoundDistance(segmentFrame.distances, start + EPSILON)
  )
  const lastInteriorIndex = Math.min(
    segmentFrame.frames.length - 1,
    lowerBoundDistance(segmentFrame.distances, end - EPSILON)
  )
  for (let index = firstInteriorIndex; index < lastInteriorIndex; index += 1) {
    const distance = segmentFrame.distances[index]
    if (distance > start + EPSILON && distance < end - EPSILON) {
      frames.push(segmentFrame.frames[index])
    }
  }
  frames.push(endFrame)
  return dedupeRibbonFrames(frames)
}

const sliceExactLineRibbonSegmentFrames = (
  segment: Extract<PathSegment, { type: 'line' }>,
  localStartDistance: number,
  localEndDistance: number
): PathSampleFrame[] => {
  emitStrokePipelineCounter('source-path-ribbon-line-segment-range-direct')
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

const sliceExactOffsetRibbonSegmentFrames = (
  segmentFrame: ExactSourcePathOffsetRibbonSegmentFrame,
  localStartDistance: number,
  localEndDistance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  if (localEndDistance - localStartDistance <= EPSILON) {
    return []
  }

  const start = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localStartDistance)
  )
  const end = Math.max(
    0,
    Math.min(segmentFrame.segmentLength, localEndDistance)
  )
  if (end - start <= EPSILON) {
    return []
  }

  const startFrame = interpolateOffsetRibbonSegmentFrameAtDistance(
    segmentFrame,
    start,
    stroke
  )
  const endFrame = interpolateOffsetRibbonSegmentFrameAtDistance(
    segmentFrame,
    end,
    stroke
  )
  if (!startFrame || !endFrame) {
    return []
  }

  const frames = [startFrame]
  const firstInteriorIndex = Math.max(
    1,
    lowerBoundDistance(segmentFrame.distances, start + EPSILON)
  )
  const lastInteriorIndex = Math.min(
    segmentFrame.frames.length - 1,
    lowerBoundDistance(segmentFrame.distances, end - EPSILON)
  )
  for (let index = firstInteriorIndex; index < lastInteriorIndex; index += 1) {
    const distance = segmentFrame.distances[index]
    if (distance > start + EPSILON && distance < end - EPSILON) {
      frames.push(segmentFrame.frames[index])
    }
  }
  frames.push(endFrame)
  return dedupeOffsetRibbonFrames(frames)
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
  localStartDistance: number,
  localEndDistance: number,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): OffsetPathSampleFrame[] =>
  dedupeOffsetRibbonFrames(
    sliceExactLineRibbonSegmentFrames(
      segment,
      localStartDistance,
      localEndDistance
    ).map((frame) => offsetLineRibbonFrame(frame, stroke))
  )

const sliceExactRibbonRangeFrames = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext
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
  const frames: PathSampleFrame[] = []

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
        ? sliceExactLineRibbonSegmentFrames(
            segment,
            localStartDistance,
            localEndDistance
          )
        : (() => {
            const segmentFrame = getExactRibbonSegmentFrameForContext(
              path,
              segmentRange.segmentIndex,
              slicingContext
            )
            return segmentFrame
              ? sliceExactRibbonSegmentFrames(
                  segmentFrame,
                  localStartDistance,
                  localEndDistance
                )
              : []
          })()
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

  return dedupeRibbonFrames(frames)
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
            localStartDistance,
            localEndDistance,
            stroke
          )
        : (() => {
            const segmentFrame = getOffsetRibbonSegmentFrameForContext(
              path,
              segmentRange.segmentIndex,
              slicingContext,
              stroke
            )
            return segmentFrame
              ? sliceExactOffsetRibbonSegmentFrames(
                  segmentFrame,
                  localStartDistance,
                  localEndDistance,
                  stroke
                )
              : []
          })()
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

const sampleLineOnlyPathPointAtDistance = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  segmentRanges: readonly SourcePathSegmentRange[],
  distance: number
): Vec2 | null => {
  if (path.totalLength <= EPSILON || segmentRanges.length === 0) {
    return null
  }

  const clampedDistance = Math.max(0, Math.min(path.totalLength, distance))
  const segmentIndex = Math.min(
    segmentRanges.length - 1,
    Math.max(0, lowerBoundSourcePathSegmentEnd(segmentRanges, clampedDistance))
  )
  const segmentRange = segmentRanges[segmentIndex]
  const segment = path.segments[segmentIndex]
  if (!segmentRange || !segment || segment.type !== 'line') {
    return null
  }

  return interpolateLineSegmentPointAtDistance(
    segment,
    clampedDistance - segmentRange.startDistance
  )
}

const sliceSmoothedLineOnlyOffsetRibbonRangeFrames = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  slicingContext: SourcePathSlicingContext,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): OffsetPathSampleFrame[] => {
  if (
    path.totalLength <= EPSILON ||
    range.endDistance - range.startDistance <= EPSILON ||
    path.segments.some((segment) => segment.type !== 'line')
  ) {
    return []
  }

  const segmentRanges = slicingContext.segmentRanges
  const distances = [
    range.startDistance,
    ...segmentRanges
      .map((segmentRange) => segmentRange.startDistance)
      .filter(
        (distance) =>
          distance > range.startDistance + EPSILON &&
          distance < range.endDistance - EPSILON
      ),
    range.endDistance
  ]
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const tangentProbeDistance = Math.max(
    0.1,
    Math.min(1, path.totalLength * 0.002)
  )

  return dedupeOffsetRibbonFrames(
    distances.flatMap((distance) => {
      const point = sampleLineOnlyPathPointAtDistance(
        path,
        segmentRanges,
        distance
      )
      const before = sampleLineOnlyPathPointAtDistance(
        path,
        segmentRanges,
        Math.max(0, distance - tangentProbeDistance)
      )
      const after = sampleLineOnlyPathPointAtDistance(
        path,
        segmentRanges,
        Math.min(path.totalLength, distance + tangentProbeDistance)
      )
      if (!point || !before || !after) {
        return []
      }
      const tangent = normalizeVector({
        x: after.x - before.x,
        y: after.y - before.y
      })
      if (!tangent) {
        return []
      }
      const normalizedPoint = normalizePoint(point)
      return [
        {
          point: normalizedPoint,
          tangent,
          offsetPoint: normalizePoint({
            x: normalizedPoint.x - tangent.y * offset,
            y: normalizedPoint.y + tangent.x * offset
          })
        }
      ]
    })
  )
}

const buildExactSourcePathRibbonGeometryFromFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = frames.map((frame, index) => {
    const tangent = normalizeVector(frame.tangent)
    if (!tangent) {
      return null
    }
    const point = source[index]
    return normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  })
  if (
    offsetBoundary.length !== source.length ||
    offsetBoundary.some((point) => point === null)
  ) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }
  const offsetPoints = offsetBoundary as Vec2[]

  const rawPolygon: Vec2[] = [...source, ...offsetPoints.slice().reverse()]
  const bodyPolygon = cleanPolygon(rawPolygon)
  const bodyPolygons =
    bodyPolygon.length >= 3 && Math.abs(polygonArea(bodyPolygon)) > EPSILON
      ? [bodyPolygon]
      : []

  if (
    stroke.cap !== 'round' ||
    (roundCapStart !== true && roundCapEnd !== true)
  ) {
    return {
      bodyPolygons,
      capPolygons: []
    }
  }

  const capPolygons = [
    ...(roundCapStart === true
      ? [
          cleanPolygon(
            buildOneSidedRibbonRoundCap(
              source[0],
              offsetPoints[0],
              frames[0].tangent,
              true,
              roundCapVisualMaxLength
            )
          )
        ]
      : []),
    ...(roundCapEnd === true
      ? [
          cleanPolygon(
            buildOneSidedRibbonRoundCap(
              source[source.length - 1],
              offsetPoints[offsetPoints.length - 1],
              frames[frames.length - 1].tangent,
              false,
              roundCapVisualMaxLength
            )
          )
        ]
      : [])
  ].filter(
    (capPolygon) =>
      capPolygon.length >= 3 && Math.abs(polygonArea(capPolygon)) > EPSILON
  )

  return {
    bodyPolygons,
    capPolygons
  }
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

const buildMergedExactSourcePathRibbonPolygonsFromFrames = (
  frames: PathSampleFrame[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = frames.map((frame, index) => {
    const tangent = normalizeVector(frame.tangent)
    if (!tangent) {
      return null
    }
    const point = source[index]
    return normalizePoint({
      x: point.x - tangent.y * offset,
      y: point.y + tangent.x * offset
    })
  })
  if (
    offsetBoundary.length !== source.length ||
    offsetBoundary.some((point) => point === null)
  ) {
    return []
  }

  const offsetPoints = offsetBoundary as Vec2[]
  const rawPolygon: Vec2[] = [...source]
  const hasRoundCap =
    stroke.cap === 'round' && (roundCapStart === true || roundCapEnd === true)

  if (hasRoundCap) {
    if (roundCapEnd === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[source.length - 1],
        offsetPoints[offsetPoints.length - 1],
        frames[frames.length - 1].tangent,
        false,
        { skipFirst: true, maxArcLength: roundCapVisualMaxLength }
      )
    } else {
      rawPolygon.push(offsetPoints[offsetPoints.length - 1])
    }

    rawPolygon.push(...offsetPoints.slice(0, -1).reverse())

    if (roundCapStart === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[0],
        offsetPoints[0],
        frames[0].tangent,
        true,
        {
          reverse: true,
          skipFirst: true,
          maxArcLength: roundCapVisualMaxLength
        }
      )
    }
  } else {
    rawPolygon.push(...offsetPoints.slice().reverse())
  }

  const polygon = cleanMergedRibbonPolygon(rawPolygon)
  return polygon.length >= 3 ? [polygon] : []
}

const buildExactSourcePathRibbonGeometryFromOffsetFrames = (
  frames: OffsetPathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return {
      bodyPolygons: [],
      capPolygons: []
    }
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetPoints = frames.map((frame) => normalizePoint(frame.offsetPoint))
  const bodyPolygon = cleanMergedRibbonPolygon([
    ...source,
    ...offsetPoints.slice().reverse()
  ])
  const bodyPolygons =
    bodyPolygon.length >= 3 && Math.abs(polygonArea(bodyPolygon)) > EPSILON
      ? [bodyPolygon]
      : []

  if (
    stroke.cap !== 'round' ||
    (roundCapStart !== true && roundCapEnd !== true)
  ) {
    return {
      bodyPolygons,
      capPolygons: []
    }
  }

  const firstFrame = frames[0]
  const lastFrame = frames[frames.length - 1]
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
      : [])
  ].filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )

  return {
    bodyPolygons,
    capPolygons
  }
}

const buildMergedExactSourcePathRibbonPolygonsFromOffsetFrames = (
  frames: OffsetPathSampleFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  roundCapVisualMaxLength = ROUND_CAP_VISUAL_MAX_LENGTH
) => {
  if (frames.length < 2 || stroke.width <= EPSILON) {
    return []
  }

  const source = frames.map((frame) => normalizePoint(frame.point))
  const offsetPoints = frames.map((frame) => normalizePoint(frame.offsetPoint))
  const rawPolygon: Vec2[] = [...source]
  const hasRoundCap =
    stroke.cap === 'round' && (roundCapStart === true || roundCapEnd === true)

  if (hasRoundCap) {
    if (roundCapEnd === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[source.length - 1],
        offsetPoints[offsetPoints.length - 1],
        frames[frames.length - 1].tangent,
        false,
        { skipFirst: true, maxArcLength: roundCapVisualMaxLength }
      )
    } else {
      rawPolygon.push(offsetPoints[offsetPoints.length - 1])
    }

    rawPolygon.push(...offsetPoints.slice(0, -1).reverse())

    if (roundCapStart === true) {
      appendOneSidedRibbonRoundCap(
        rawPolygon,
        source[0],
        offsetPoints[0],
        frames[0].tangent,
        true,
        {
          reverse: true,
          skipFirst: true,
          maxArcLength: roundCapVisualMaxLength
        }
      )
    }
  } else {
    rawPolygon.push(...offsetPoints.slice().reverse())
  }

  const polygon = cleanMergedRibbonPolygon(rawPolygon)
  return polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
    ? [polygon]
    : []
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
  const oppositeEndpoint = normalizePoint({
    x: endpoint.x - side.x * strokeWidth,
    y: endpoint.y - side.y * strokeWidth
  })
  const translate = (point: Vec2) =>
    normalizePoint({
      x: point.x + direction.x * extension,
      y: point.y + direction.y * extension
    })

  return cleanMergedRibbonPolygon([
    offsetEndpoint,
    translate(offsetEndpoint),
    translate(oppositeEndpoint),
    oppositeEndpoint
  ])
}

const buildRoundTerminalCapSourceLipPolygon = (
  endpoint: Vec2,
  tangent: Vec2,
  isStart: boolean,
  strokeWidth: number
) => {
  const direction = normalizeVector(tangent)
  if (!direction || strokeWidth <= EPSILON) {
    return []
  }

  const extension = (isStart ? -1 : 1) * (strokeWidth / 2)
  const lipHalfThickness = Math.min(0.25, Math.max(0.02, strokeWidth * 0.02))
  const normal = {
    x: -direction.y,
    y: direction.x
  }
  const extendedCenter = normalizePoint({
    x: endpoint.x + direction.x * extension,
    y: endpoint.y + direction.y * extension
  })
  const offsetNormal = (point: Vec2, amount: number) =>
    normalizePoint({
      x: point.x + normal.x * amount,
      y: point.y + normal.y * amount
    })

  return cleanMergedRibbonPolygon([
    offsetNormal(endpoint, lipHalfThickness),
    offsetNormal(extendedCenter, lipHalfThickness),
    offsetNormal(extendedCenter, -lipHalfThickness),
    offsetNormal(endpoint, -lipHalfThickness)
  ])
}

const buildOpenPathTerminalCapOverhangPolygons = (
  frames: OffsetPathSampleFrame[],
  capOwnership: ReturnType<typeof getSourcePathRangeRoundCapOwnership>
) => {
  const style = capOwnership.openPathTerminalCapStyle
  if (
    frames.length < 2 ||
    (style !== 'square' && style !== 'round') ||
    (capOwnership.openPathTerminalCapStart !== true &&
      capOwnership.openPathTerminalCapEnd !== true)
  ) {
    return []
  }

  const build = (frame: OffsetPathSampleFrame, isStart: boolean) =>
    style === 'square'
      ? buildSquareTerminalCapOverhangPolygon(
          normalizePoint(frame.point),
          normalizePoint(frame.offsetPoint),
          frame.tangent,
          isStart,
          capOwnership.stroke.width
        )
      : buildRoundTerminalCapSourceLipPolygon(
          normalizePoint(frame.point),
          frame.tangent,
          isStart,
          capOwnership.stroke.width
        )

  return [
    ...(capOwnership.openPathTerminalCapStart === true
      ? [build(frames[0], true)]
      : []),
    ...(capOwnership.openPathTerminalCapEnd === true
      ? [build(frames[frames.length - 1], false)]
      : [])
  ].filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
}

const getSourcePathFrameAtDistance = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  distance: number,
  edge: 'start' | 'end',
  slicingContext: SourcePathSlicingContext
): PathSampleFrame | null => {
  if (path.segments.length === 0 || path.totalLength <= EPSILON) {
    return null
  }

  const segmentRanges = slicingContext.segmentRanges
  if (segmentRanges.length === 0) {
    return null
  }

  const clampedDistance = Math.max(0, Math.min(path.totalLength, distance))
  const lookupDistance =
    edge === 'end'
      ? Math.max(0, clampedDistance - EPSILON)
      : Math.min(path.totalLength, clampedDistance + EPSILON)
  const segmentIndex = Math.min(
    segmentRanges.length - 1,
    Math.max(0, lowerBoundSourcePathSegmentEnd(segmentRanges, lookupDistance))
  )
  const segmentRange = segmentRanges[segmentIndex]
  const segment = path.segments[segmentIndex]
  if (!segmentRange || !segment) {
    return null
  }

  return samplePathSegmentFrameAtLength(
    segment,
    Math.max(
      0,
      Math.min(segment.length, clampedDistance - segmentRange.startDistance)
    )
  )
}

const rangeContainsDistance = (
  range: SourceSegmentIntervalRange,
  distance: number
) =>
  distance >= range.startDistance - EPSILON &&
  distance <= range.endDistance + EPSILON

const getBoundaryDomainTerminalFrame = (
  interval: Pick<VisibleDashedTopologyInterval, 'figmaLikeBoundaryPoints'>,
  edge: 'start' | 'end'
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
  }

  const endpoint =
    edge === 'start'
      ? boundaryPoints[0]
      : boundaryPoints[boundaryPoints.length - 1]
  const adjacent =
    edge === 'start'
      ? boundaryPoints[1]
      : boundaryPoints[boundaryPoints.length - 2]
  if (!endpoint || !adjacent) {
    return null
  }

  const tangent = normalizeVector(
    edge === 'start'
      ? {
          x: adjacent.x - endpoint.x,
          y: adjacent.y - endpoint.y
        }
      : {
          x: endpoint.x - adjacent.x,
          y: endpoint.y - adjacent.y
        }
  )
  return tangent
    ? {
        point: normalizePoint(endpoint),
        tangent
      }
    : null
}

const buildOneSidedSquareTerminalFootprintPolygon = (
  frame: Pick<PathSampleFrame, 'point' | 'tangent'>,
  isStart: boolean,
  stroke: Pick<RenderableStroke, 'position' | 'width'>,
  selectedSide: 1 | -1,
  bodyCollarLength: number,
  awayCapExtensionLength = stroke.width / 2
) => {
  const direction = normalizeVector(frame.tangent)
  if (!direction || stroke.width <= EPSILON) {
    return []
  }

  const endpoint = normalizePoint(frame.point)
  const normal = {
    x: -direction.y * selectedSide,
    y: direction.x * selectedSide
  }
  const offsetEndpoint = normalizePoint({
    x: endpoint.x + normal.x * stroke.width,
    y: endpoint.y + normal.y * stroke.width
  })
  const capExtension = Math.max(0, awayCapExtensionLength)
  const collarExtension = Math.max(0, bodyCollarLength)
  const startExtension = isStart ? -capExtension : -collarExtension
  const endExtension = isStart ? collarExtension : capExtension
  const translate = (point: Vec2) => (extension: number) =>
    normalizePoint({
      x: point.x + direction.x * extension,
      y: point.y + direction.y * extension
    })

  return cleanMergedRibbonPolygon([
    translate(endpoint)(startExtension),
    translate(endpoint)(endExtension),
    translate(offsetEndpoint)(endExtension),
    translate(offsetEndpoint)(startExtension)
  ])
}

const buildOutsideSquareSplitTerminalFootprintPolygons = (
  path: Pick<PathGeometry, 'segments' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSideAuthority'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryPoints'
  >,
  authoredStroke: Pick<RenderableStroke, 'position' | 'cap' | 'width'>,
  intervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
  slicingContext: SourcePathSlicingContext
) => {
  const selectedSide = interval.figmaLikeSelectedSide
  if (
    authoredStroke.position !== 'outside' ||
    authoredStroke.cap !== 'square' ||
    authoredStroke.width <= EPSILON ||
    interval.figmaLikeSplitRangeId === undefined ||
    interval.figmaLikeSideAuthority !== 'implicit-fill-hole-domain' ||
    selectedSide === undefined ||
    !interval.figmaLikeBoundaryPoints ||
    interval.figmaLikeBoundaryPoints.length < 2
  ) {
    return []
  }

  const intervalLength = getVisibleIntervalLength(interval, path.totalLength)
  const bodyCollarLength = Math.max(0, intervalLength)

  const build = (edge: 'start' | 'end') => {
    const terminalDistance =
      edge === 'start' ? interval.startDistance : interval.endDistance
    if (!rangeContainsDistance(range, terminalDistance)) {
      return []
    }
    const frame =
      getBoundaryDomainTerminalFrame(interval, edge) ??
      getSourcePathFrameAtDistance(path, terminalDistance, edge, slicingContext)
    if (!frame) {
      return []
    }
    return buildOneSidedSquareTerminalFootprintPolygon(
      frame,
      edge === 'start',
      intervalStroke,
      selectedSide,
      bodyCollarLength,
      authoredStroke.width / 2
    )
  }

  const sourceVertexTerminalEdges = (['start', 'end'] as const).filter((edge) =>
    isTerminalEdgeEndpointAtAuthoredSourceVertex(
      path,
      interval,
      edge,
      Math.max(
        1.5,
        SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
        authoredStroke.width * 0.35
      )
    )
  )
  const terminalBodyEdges =
    sourceVertexTerminalEdges.length === 1
      ? sourceVertexTerminalEdges[0] === 'start'
        ? (['end'] as const)
        : (['start'] as const)
      : sourceVertexTerminalEdges.length > 1
        ? []
        : interval.figmaLikeTerminalRole === 'start'
          ? (['end'] as const)
          : interval.figmaLikeTerminalRole === 'end'
            ? (['start'] as const)
            : []

  return terminalBodyEdges
    .map(build)
    .filter(
      (polygon) =>
        polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
    )
}

const clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide = (
  polygons: Vec2[][],
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeSelectedSide' | 'figmaLikeBoundaryPoints'
  >
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  const selectedSide = interval.figmaLikeSelectedSide
  if (
    polygons.length === 0 ||
    selectedSide === undefined ||
    !boundaryPoints ||
    boundaryPoints.length < 2
  ) {
    return polygons
  }

  return polygons
    .map((polygon) =>
      clipPolygonToSelectedSideBoundaryOrDropRejected(
        polygon,
        boundaryPoints,
        selectedSide
      )
    )
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
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
    let currentPolygons = [polygon]
    for (const domain of boundaryDomains) {
      currentPolygons = currentPolygons.flatMap((currentPolygon) => {
        if (
          currentPolygon.length < 3 ||
          !boundsOverlapBounds(
            getPolygonBounds(currentPolygon),
            getCachedPolylineBounds(domain.boundaryPoints)
          )
        ) {
          return [currentPolygon]
        }

        const clipped = cleanClippedProductPolygon(
          clipPolygonToSelectedSideBoundaryOrDropRejected(
            currentPolygon,
            domain.boundaryPoints,
            domain.outsideSelectedSide as 1 | -1
          )
        )
        return hasPolygonGeometry(clipped) ? [clipped] : []
      })
      if (currentPolygons.length === 0) {
        break
      }
    }
    return currentPolygons
  })
}

const _clipOutsideSourceVertexJoinPolygonsToAdjacentBoundarySides = (
  polygons: Vec2[][],
  intervals: readonly Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeSelectedSide' | 'figmaLikeBoundaryPoints'
  >[]
) => {
  if (polygons.length === 0 || intervals.length === 0) {
    return polygons
  }

  const sideContexts = intervals
    .map((interval) => ({
      selectedSide: interval.figmaLikeSelectedSide,
      boundaryPoints: interval.figmaLikeBoundaryPoints
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

const clipOutsideSquareSplitTerminalFootprintPolygonsToStrokeBoundaryDomains = (
  polygons: Vec2[][],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeBoundaryDomainId'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryPoints'
  >,
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[] = []
) =>
  clipOutsidePolygonsToStrokeBoundaryDomains(
    clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide(
      polygons,
      interval
    ),
    sharedStrokeBoundaryDomains
  )

const clipOutsideSquareSplitTerminalFootprintPolygonsToLegalDomain = (
  polygons: Vec2[][],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeBoundaryDomainId'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryPoints'
  >,
  sourcePath: SourcePathWithOptionalSamples,
  implicitFillRegions: PolygonRegion[],
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[] = [],
  options: { skipBoundarySideClip?: boolean } = {}
) => {
  const boundaryDomainPolygons =
    options.skipBoundarySideClip === true
      ? polygons
      : clipOutsideSquareSplitTerminalFootprintPolygonsToStrokeBoundaryDomains(
          polygons,
          interval,
          sharedStrokeBoundaryDomains
        )
  return clipSourcePathPolygonsToEvenOddLegalDomain(
    boundaryDomainPolygons,
    sourcePath,
    { position: 'outside' },
    implicitFillRegions,
    {
      fragmentStitchRadius: 0,
      fragmentPruneArea: 0,
      cleanupMicroEdgeTolerance: 0.001,
      cleanupCollinearTolerance: 0.0001
    }
  )
}

const clipPolygonToDirectionalHalfPlane = (
  polygon: Vec2[],
  origin: Vec2,
  direction: Vec2,
  keepSign: 1 | -1
) => {
  const normalizedDirection = normalizeVector(direction)
  if (!normalizedDirection || polygon.length < 3) {
    return polygon
  }

  const signedDistance = (point: Vec2) =>
    ((point.x - origin.x) * normalizedDirection.x +
      (point.y - origin.y) * normalizedDirection.y) *
    keepSign
  const intersect = (start: Vec2, end: Vec2, startDistance: number) => {
    const endDistance = signedDistance(end)
    const denominator = startDistance - endDistance
    if (Math.abs(denominator) <= EPSILON) {
      return normalizePoint(end)
    }
    const t = Math.max(0, Math.min(1, startDistance / denominator))
    return normalizePoint({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    })
  }

  const output: Vec2[] = []
  polygon.forEach((current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length]
    const currentDistance = signedDistance(current)
    const previousDistance = signedDistance(previous)
    const currentInside = currentDistance >= -0.001
    const previousInside = previousDistance >= -0.001

    if (currentInside) {
      if (!previousInside) {
        output.push(intersect(previous, current, previousDistance))
      }
      output.push(normalizePoint(current))
      return
    }

    if (previousInside) {
      output.push(intersect(previous, current, previousDistance))
    }
  })

  return output
}

const _clipOutsideSquareSplitTerminalPolygonsToTerminalBodySide = (
  polygons: Vec2[][],
  path: Pick<PathGeometry, 'segments'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeBoundaryPoints'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSelectedSide'
  >,
  authoredStroke: Pick<RenderableStroke, 'position' | 'cap' | 'width'>
) => {
  if (
    polygons.length === 0 ||
    authoredStroke.position !== 'outside' ||
    authoredStroke.cap !== 'square' ||
    authoredStroke.width <= EPSILON ||
    interval.figmaLikeSplitRangeId === undefined
  ) {
    return polygons
  }

  const terminalEdges: ('start' | 'end')[] = [
    ...(interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['start'] as const)
      : []),
    ...(interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['end'] as const)
      : [])
  ]
  if (terminalEdges.length === 0) {
    return polygons
  }

  let clippedPolygons = polygons
  for (const edge of terminalEdges) {
    if (
      isTerminalEdgeEndpointAtAuthoredSourceVertex(
        path,
        interval,
        edge,
        Math.max(
          1.5,
          SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
          authoredStroke.width * 1.5
        )
      )
    ) {
      continue
    }

    const frame = getBoundaryDomainTerminalFrame(interval, edge)
    const tangent = frame ? normalizeVector(frame.tangent) : null
    if (!frame || !tangent) {
      continue
    }

    const keepSign = edge === 'start' ? 1 : -1
    clippedPolygons = clippedPolygons
      .map((polygon) =>
        clipPolygonToDirectionalHalfPlane(
          polygon,
          frame.point,
          tangent,
          keepSign
        )
      )
      .map((polygon) =>
        cleanClippedProductPolygon(polygon, {
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001
        })
      )
      .filter(hasPolygonGeometry)
    if (clippedPolygons.length === 0) {
      break
    }
  }

  return clippedPolygons
}

type OutsideSquareTerminalClipInterval = Pick<
  VisibleDashedTopologyInterval,
  | 'figmaLikeBoundaryPoints'
  | 'figmaLikeBoundaryRole'
  | 'figmaLikeSplitRangeId'
  | 'figmaLikeTerminalRole'
>

const getOutsideSquareTerminalClipEdges = (
  interval: OutsideSquareTerminalClipInterval
) => {
  if (
    interval.figmaLikeBoundaryRole === 'hole' ||
    interval.figmaLikeSplitRangeId === undefined
  ) {
    return []
  }

  return [
    ...(interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['start'] as const)
      : []),
    ...(interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['end'] as const)
      : [])
  ]
}

const getOutsideSquareTerminalEndpointClipEdges = (
  interval: OutsideSquareTerminalClipInterval
) => {
  if (interval.figmaLikeSplitRangeId === undefined) {
    return []
  }

  return [
    ...(interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['start'] as const)
      : []),
    ...(interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['end'] as const)
      : [])
  ]
}

const getOutsideSquareTerminalClipFrame = (
  interval: OutsideSquareTerminalClipInterval,
  edge: 'start' | 'end'
) => {
  const frame = getBoundaryDomainTerminalFrame(interval, edge)
  const tangent = frame ? normalizeVector(frame.tangent) : null
  return frame && tangent ? { point: frame.point, tangent } : null
}

const clipPolygonsToTerminalBodySide = (
  polygons: Vec2[][],
  frame: { point: Vec2; tangent: Vec2 },
  edge: 'start' | 'end'
) =>
  polygons
    .map((polygon) =>
      clipPolygonToDirectionalHalfPlane(
        polygon,
        frame.point,
        frame.tangent,
        edge === 'start' ? 1 : -1
      )
    )
    .map((polygon) =>
      cleanClippedProductPolygon(polygon, {
        cleanupMicroEdgeTolerance: 0.001,
        cleanupCollinearTolerance: 0.0001
      })
    )
    .filter(hasPolygonGeometry)

const clipOutsideSquareSplitTerminalEndpointOverhang = (
  polygons: Vec2[][],
  interval: OutsideSquareTerminalClipInterval,
  stroke: Pick<RenderableStroke, 'position' | 'cap'>
) => {
  if (
    polygons.length === 0 ||
    stroke.position !== 'outside' ||
    stroke.cap !== 'square' ||
    interval.figmaLikeSplitRangeId === undefined
  ) {
    return polygons
  }

  let clippedPolygons = polygons
  for (const edge of getOutsideSquareTerminalEndpointClipEdges(interval)) {
    const frame = getOutsideSquareTerminalClipFrame(interval, edge)
    if (!frame) {
      continue
    }
    clippedPolygons = clipPolygonsToTerminalBodySide(
      clippedPolygons,
      frame,
      edge
    )
    if (clippedPolygons.length === 0) {
      return []
    }
  }

  return clippedPolygons
}

const _clipOutsideSquarePolygonsToPeerCrossingTerminalBodySides = (
  polygons: Vec2[][],
  path: Pick<PathGeometry, 'segments'>,
  interval: OutsideSquareTerminalClipInterval,
  peerIntervals: readonly OutsideSquareTerminalClipInterval[],
  authoredStroke: Pick<RenderableStroke, 'position' | 'cap' | 'width'>
) => {
  if (
    polygons.length === 0 ||
    authoredStroke.position !== 'outside' ||
    authoredStroke.cap !== 'square' ||
    authoredStroke.width <= EPSILON ||
    interval.figmaLikeSplitRangeId === undefined
  ) {
    return polygons
  }

  const currentTerminalFrames = getOutsideSquareTerminalClipEdges(
    interval
  ).flatMap((edge) => {
    if (
      isTerminalEdgeEndpointAtAuthoredSourceVertex(
        path,
        interval,
        edge,
        Math.max(
          1.5,
          SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
          authoredStroke.width * 0.35
        )
      )
    ) {
      return []
    }
    const frame = getOutsideSquareTerminalClipFrame(interval, edge)
    return frame ? [{ edge, frame }] : []
  })
  if (currentTerminalFrames.length === 0) {
    return polygons
  }

  const endpointTolerance = Math.max(
    1.5,
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    authoredStroke.width * 0.08
  )
  let clippedPolygons = polygons

  for (const peerInterval of peerIntervals) {
    if (
      peerInterval === interval ||
      peerInterval.figmaLikeSplitRangeId === interval.figmaLikeSplitRangeId
    ) {
      continue
    }

    for (const peerEdge of getOutsideSquareTerminalClipEdges(peerInterval)) {
      if (
        isTerminalEdgeEndpointAtAuthoredSourceVertex(
          path,
          peerInterval,
          peerEdge,
          Math.max(
            1.5,
            SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
            authoredStroke.width * 0.35
          )
        )
      ) {
        continue
      }
      const peerFrame = getOutsideSquareTerminalClipFrame(
        peerInterval,
        peerEdge
      )
      if (!peerFrame) {
        continue
      }

      const sharesCrossing = currentTerminalFrames.some(
        ({ frame }) =>
          distanceBetween(frame.point, peerFrame.point) <= endpointTolerance
      )
      if (!sharesCrossing) {
        continue
      }

      clippedPolygons = clipPolygonsToTerminalBodySide(
        clippedPolygons,
        peerFrame,
        peerEdge
      )
      if (clippedPolygons.length === 0) {
        return []
      }
    }
  }

  return clippedPolygons
}

const getLocalPointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) {
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

const isOutsideSquareTerminalAtSourceSelfIntersection = (
  path: Pick<PathGeometry, 'segments' | 'sampledSegmentPoints'>,
  interval: Pick<VisibleDashedTopologyInterval, 'figmaLikeBoundaryPoints'>,
  edge: 'start' | 'end',
  tolerance: number
) => {
  if (
    isTerminalEdgeEndpointAtAuthoredSourceVertex(
      path,
      interval,
      edge,
      tolerance
    )
  ) {
    return false
  }
  const frame = getBoundaryDomainTerminalFrame(interval, edge)
  if (!frame) {
    return false
  }
  const crossingSegmentIndexes = path.segments.flatMap((segment, index) => {
    const sampledPoints = path.sampledSegmentPoints?.[index]
    const points =
      sampledPoints && sampledPoints.length >= 2
        ? sampledPoints
        : [segment.start, segment.end]
    const isNearSegment = points.some((point, pointIndex) => {
      const next = points[pointIndex + 1]
      return (
        next !== undefined &&
        getLocalPointSegmentDistance(frame.point, point, next) <= tolerance
      )
    })
    return isNearSegment ? [index] : []
  })
  return new Set(crossingSegmentIndexes).size >= 2
}

const _filterOutsideSquareSplitTerminalFragmentsByTangentSpan = (
  polygons: Vec2[][],
  path: Pick<PathGeometry, 'totalLength' | 'segments' | 'sampledSegmentPoints'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'startDistance'
    | 'endDistance'
    | 'wrapsSeam'
    | 'figmaLikeBoundaryPoints'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeSelectedSide'
  >,
  authoredStroke: Pick<
    RenderableStroke,
    'position' | 'cap' | 'width' | 'dashPattern'
  >
) => {
  if (
    polygons.length === 0 ||
    authoredStroke.position !== 'outside' ||
    authoredStroke.cap !== 'square' ||
    authoredStroke.width <= EPSILON ||
    interval.figmaLikeSplitRangeId === undefined
  ) {
    return polygons
  }

  const terminalEdges: ('start' | 'end')[] = [
    ...(interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['start'] as const)
      : []),
    ...(interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? (['end'] as const)
      : [])
  ]
  if (terminalEdges.length === 0) {
    return polygons
  }

  const endpointTolerance = Math.max(0.75, authoredStroke.width * 0.12)
  const fragmentAreaLimit = authoredStroke.width * authoredStroke.width * 0.75
  const activeTerminalFrames = terminalEdges
    .map((edge) => {
      const atSourceSelfIntersection =
        isOutsideSquareTerminalAtSourceSelfIntersection(
          path,
          interval,
          edge,
          Math.max(
            1.5,
            SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
            authoredStroke.width * 0.35
          )
        )
      const frame = getBoundaryDomainTerminalFrame(interval, edge)
      const tangent = frame ? normalizeVector(frame.tangent) : null
      const selectedSide =
        interval.figmaLikeSelectedSide === 1 ||
        interval.figmaLikeSelectedSide === -1
          ? interval.figmaLikeSelectedSide
          : undefined
      return frame && tangent && selectedSide !== undefined
        ? {
            edge,
            point: frame.point,
            tangent,
            selectedSide,
            atSourceSelfIntersection
          }
        : null
    })
    .filter(
      (
        frame
      ): frame is {
        edge: 'start' | 'end'
        point: Vec2
        tangent: Vec2
        selectedSide: 1 | -1
        atSourceSelfIntersection: boolean
      } => frame !== null
    )
  if (activeTerminalFrames.length === 0) {
    return polygons
  }

  const polygonAreas = polygons.map((polygon) => Math.abs(polygonArea(polygon)))
  const touchesTerminal = (polygon: Vec2[], point: Vec2) =>
    polygon.some(
      (polygonPoint) =>
        distanceBetween(polygonPoint, point) <= endpointTolerance
    )
  const terminalMaxArea = new Map<'start' | 'end', number>()
  activeTerminalFrames.forEach(({ edge, point }) => {
    const maxArea = polygons.reduce(
      (currentMax, polygon, polygonIndex) =>
        touchesTerminal(polygon, point)
          ? Math.max(currentMax, polygonAreas[polygonIndex] ?? 0)
          : currentMax,
      0
    )
    terminalMaxArea.set(edge, maxArea)
  })

  const isOnlySelfIntersectionTerminalCollar = (
    polygon: Vec2[],
    frame: (typeof activeTerminalFrames)[number]
  ) => {
    if (!frame.atSourceSelfIntersection) {
      return false
    }

    const normal = {
      x: -frame.tangent.y * frame.selectedSide,
      y: frame.tangent.x * frame.selectedSide
    }
    let minAlong = Number.POSITIVE_INFINITY
    let maxAlong = Number.NEGATIVE_INFINITY
    let minNormal = Number.POSITIVE_INFINITY
    let maxNormal = Number.NEGATIVE_INFINITY
    polygon.forEach((point) => {
      const dx = point.x - frame.point.x
      const dy = point.y - frame.point.y
      const along = dx * frame.tangent.x + dy * frame.tangent.y
      const normalDistance = dx * normal.x + dy * normal.y
      minAlong = Math.min(minAlong, along)
      maxAlong = Math.max(maxAlong, along)
      minNormal = Math.min(minNormal, normalDistance)
      maxNormal = Math.max(maxNormal, normalDistance)
    })

    const tangentBodySpan =
      frame.edge === 'start' ? Math.max(0, maxAlong) : Math.max(0, -minAlong)
    const selectedNormalSpan = Math.max(0, maxNormal - minNormal)
    const expectedTerminalLength = Math.min(
      getVisibleIntervalLength(interval, path.totalLength),
      Math.max(authoredStroke.width, authoredStroke.dashPattern[0] ?? 0) / 2
    )
    const minimumTerminalArea =
      authoredStroke.width * expectedTerminalLength * 0.75
    const projectedArea = Math.abs(polygonArea(polygon))
    return (
      selectedNormalSpan >= authoredStroke.width * 0.75 &&
      (tangentBodySpan <= authoredStroke.width * 0.65 ||
        projectedArea < minimumTerminalArea)
    )
  }

  return polygons.filter((polygon, polygonIndex) => {
    const area = polygonAreas[polygonIndex] ?? 0
    if (
      activeTerminalFrames.some((frame) =>
        isOnlySelfIntersectionTerminalCollar(polygon, frame)
      )
    ) {
      return false
    }

    if (area > fragmentAreaLimit) {
      return true
    }

    return !activeTerminalFrames.some(
      ({ edge, point }) =>
        touchesTerminal(polygon, point) &&
        area < (terminalMaxArea.get(edge) ?? 0) * 0.65
    )
  })
}

const filterOutsideSquareBoundaryDomainWrongSideFragments = (
  polygons: Vec2[][],
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryPoints'
    | 'figmaLikeSplitRangeId'
  >,
  authoredStroke: Pick<RenderableStroke, 'position' | 'cap' | 'width'>
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  const selectedSide = interval.figmaLikeSelectedSide
  if (
    polygons.length === 0 ||
    authoredStroke.position !== 'outside' ||
    authoredStroke.cap !== 'square' ||
    authoredStroke.width <= EPSILON ||
    interval.figmaLikeSplitRangeId === undefined ||
    selectedSide === undefined ||
    !boundaryPoints ||
    boundaryPoints.length < 2
  ) {
    return polygons
  }

  const maxAllowedWrongSideDistance = Math.max(0.5, authoredStroke.width * 0.06)
  const minimumFragmentArea = Math.max(
    1,
    authoredStroke.width * authoredStroke.width * 0.08
  )
  return polygons.filter((polygon) => {
    const maxViolation = getSelectedSideMaxViolationDistance(
      polygon,
      boundaryPoints,
      selectedSide
    )
    if (maxViolation <= maxAllowedWrongSideDistance) {
      return true
    }

    const area = Math.abs(polygonArea(polygon))
    if (area >= minimumFragmentArea) {
      return true
    }

    const centroid = polygon.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x / polygon.length,
        y: accumulator.y + point.y / polygon.length
      }),
      { x: 0, y: 0 }
    )
    return (
      getSelectedSideMaxViolationDistance(
        [centroid],
        boundaryPoints,
        selectedSide
      ) <= maxAllowedWrongSideDistance
    )
  })
}

const buildOpenPointTerminalCapOverhangPolygons = (
  source: Vec2[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'cap'>,
  ownsStart: boolean,
  ownsEnd: boolean
) => {
  if (
    source.length < 2 ||
    (stroke.cap !== 'square' && stroke.cap !== 'round') ||
    (ownsStart !== true && ownsEnd !== true)
  ) {
    return []
  }

  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const buildFrame = (
    index: number,
    neighborIndex: number,
    isStart: boolean
  ) => {
    const point = normalizePoint(source[index])
    const neighbor = source[neighborIndex]
    const tangent = normalizeVector({
      x: isStart ? neighbor.x - point.x : point.x - neighbor.x,
      y: isStart ? neighbor.y - point.y : point.y - neighbor.y
    })
    if (!tangent) {
      return null
    }
    return {
      point,
      tangent,
      offsetPoint: normalizePoint({
        x: point.x - tangent.y * offset,
        y: point.y + tangent.x * offset
      })
    }
  }

  const build = (frame: OffsetPathSampleFrame, isStart: boolean) =>
    stroke.cap === 'square'
      ? buildSquareTerminalCapOverhangPolygon(
          frame.point,
          frame.offsetPoint,
          frame.tangent,
          isStart,
          stroke.width
        )
      : buildRoundTerminalCapSourceLipPolygon(
          frame.point,
          frame.tangent,
          isStart,
          stroke.width
        )

  const startFrame = ownsStart ? buildFrame(0, 1, true) : null
  const endFrame = ownsEnd
    ? buildFrame(source.length - 1, source.length - 2, false)
    : null

  return [
    ...(startFrame ? [build(startFrame, true)] : []),
    ...(endFrame ? [build(endFrame, false)] : [])
  ].filter(
    (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
  )
}

const buildSourcePathRibbonPolygonFast = (
  source: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    roundCapStart?: boolean
    roundCapEnd?: boolean
  }
) => {
  if (source.length < 2 || stroke.width <= EPSILON) {
    return null
  }

  const offset = getConstrainedRibbonOffsetDistance(stroke)
  const offsetBoundary = buildSourcePathRibbonOffsetBoundary(source, offset)
  if (offsetBoundary.length !== source.length) {
    return null
  }

  const rawPolygon: Vec2[] = [...source.map(normalizePoint)]
  const hasRoundCap =
    stroke.cap === 'round' &&
    (options.roundCapStart === true || options.roundCapEnd === true)

  if (hasRoundCap) {
    const startDirection = normalizeVector({
      x: source[1].x - source[0].x,
      y: source[1].y - source[0].y
    })
    const endDirection = normalizeVector({
      x: source[source.length - 1].x - source[source.length - 2].x,
      y: source[source.length - 1].y - source[source.length - 2].y
    })
    if (!startDirection || !endDirection) {
      return null
    }

    if (options.roundCapEnd === true) {
      rawPolygon.push(
        ...buildOneSidedRibbonRoundCap(
          source[source.length - 1],
          offsetBoundary[offsetBoundary.length - 1],
          endDirection,
          false
        ).slice(1)
      )
    } else {
      rawPolygon.push(offsetBoundary[offsetBoundary.length - 1])
    }
    rawPolygon.push(...offsetBoundary.slice(0, -1).reverse())
    if (options.roundCapStart === true) {
      rawPolygon.push(
        ...buildOneSidedRibbonRoundCap(
          source[0],
          offsetBoundary[0],
          startDirection,
          true
        )
          .reverse()
          .slice(1)
      )
    }
  } else {
    rawPolygon.push(...offsetBoundary.reverse())
  }

  const polygon = cleanPolygon(rawPolygon)
  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= EPSILON) {
    return null
  }

  return [polygon]
}

const buildSourcePathRibbonPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  renderRange: SourceSegmentIntervalRange,
  span: ConstrainedDashedPhysicalSpan,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  roundCapStart: boolean | undefined,
  roundCapEnd: boolean | undefined,
  slicingContext?: SourcePathSlicingContext
) => {
  const cacheKey = slicingContext
    ? getSourcePathRibbonCacheKey(
        renderRange,
        span.role,
        stroke,
        roundCapStart,
        roundCapEnd
      )
    : null
  const cached = cacheKey
    ? slicingContext?.ribbonPolygonCache.get(cacheKey)
    : undefined
  if (cached !== undefined) {
    return cached
  }

  const source = sliceSourcePathRangePoints(
    path,
    renderRange,
    span.role,
    slicingContext
  )
  const fastPolygons = buildSourcePathRibbonPolygonFast(source, stroke, {
    roundCapStart,
    roundCapEnd
  })
  if (cacheKey) {
    slicingContext?.ribbonPolygonCache.set(cacheKey, fastPolygons)
  }
  return fastPolygons
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
  const maxAngleStep = Math.min(Math.PI / 64, maxAngleFromChordError)
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

const densifyRoundSourceVertexJoinPolygon = (
  polygon: Vec2[],
  vertex: Vec2,
  strokeWidth: number
) => {
  if (polygon.length < 3 || strokeWidth <= EPSILON) {
    return polygon
  }

  const minimumArcRadius = strokeWidth * 0.7
  const maximumArcRadius = strokeWidth * 1.35
  const maxAngleStep = Math.PI / 96
  const densified: Vec2[] = []
  const isNearRoundArc = (point: Vec2) => {
    const radius = distanceBetween(point, vertex)
    return radius >= minimumArcRadius && radius <= maximumArcRadius
  }
  const getShortestSweep = (startAngle: number, endAngle: number) => {
    let sweep = endAngle - startAngle
    while (sweep <= -Math.PI) {
      sweep += Math.PI * 2
    }
    while (sweep > Math.PI) {
      sweep -= Math.PI * 2
    }
    return sweep
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    if (!start || !end) {
      continue
    }
    densified.push(start)

    if (!isNearRoundArc(start) || !isNearRoundArc(end)) {
      continue
    }

    const startAngle = Math.atan2(start.y - vertex.y, start.x - vertex.x)
    const endAngle = Math.atan2(end.y - vertex.y, end.x - vertex.x)
    const sweep = getShortestSweep(startAngle, endAngle)
    const subdivisionCount = Math.max(
      1,
      Math.ceil(Math.abs(sweep) / maxAngleStep)
    )
    const radius =
      (distanceBetween(start, vertex) + distanceBetween(end, vertex)) / 2
    for (let step = 1; step < subdivisionCount; step += 1) {
      const amount = step / subdivisionCount
      const angle = startAngle + sweep * amount
      densified.push(
        normalizePoint({
          x: vertex.x + Math.cos(angle) * radius,
          y: vertex.y + Math.sin(angle) * radius
        })
      )
    }
  }

  return densified
}

const densifyRoundSourceVertexJoinPolygons = (
  polygons: Vec2[][],
  vertices: Vec2[],
  strokeWidth: number
) => {
  if (polygons.length === 0 || vertices.length === 0) {
    return polygons
  }

  return polygons.map((polygon) =>
    vertices.reduce(
      (currentPolygon, vertex) =>
        densifyRoundSourceVertexJoinPolygon(
          currentPolygon,
          vertex,
          strokeWidth
        ),
      polygon
    )
  )
}

const buildSourceVertexJoinPolygonForOffset = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit'>,
  offset: number
) => {
  const previousBoundary = buildSourceSegmentBoundary(
    path.segments[previousSegmentIndex]
  )
  const nextBoundary = buildSourceSegmentBoundary(
    path.segments[nextSegmentIndex]
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
  } = {}
) => {
  const previousBoundary = buildSourceSegmentBoundary(
    path.segments[previousSegmentIndex]
  )
  const nextBoundary = buildSourceSegmentBoundary(
    path.segments[nextSegmentIndex]
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

const keepOutsideMiterSourceVertexJoinApexFragments = (
  clippedPolygons: Vec2[][],
  sourcePolygons: Vec2[][],
  vertex: Vec2,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join'>
) => {
  if (
    stroke.position !== 'outside' ||
    stroke.join !== 'miter' ||
    clippedPolygons.length <= 1 ||
    sourcePolygons.length === 0
  ) {
    return clippedPolygons
  }

  const sourcePoints = sourcePolygons.flat()
  const maxSourceDistance = sourcePoints.reduce(
    (currentMax, point) => Math.max(currentMax, distanceBetween(point, vertex)),
    0
  )
  if (maxSourceDistance <= EPSILON) {
    return clippedPolygons
  }

  const apexTolerance = Math.max(0.5, stroke.width * 0.06)
  const apexPoints = sourcePoints.filter(
    (point) =>
      Math.abs(distanceBetween(point, vertex) - maxSourceDistance) <=
      apexTolerance
  )
  const apexFragments = clippedPolygons.filter((polygon) =>
    polygon.some((point) =>
      apexPoints.some(
        (apexPoint) => distanceBetween(point, apexPoint) <= apexTolerance
      )
    )
  )
  if (apexFragments.length > 0) {
    return apexFragments
  }

  const fragmentDistances = clippedPolygons.map((polygon) =>
    polygon.reduce(
      (currentMax, point) =>
        Math.max(currentMax, distanceBetween(point, vertex)),
      0
    )
  )
  const maxFragmentDistance = Math.max(...fragmentDistances)
  return clippedPolygons.filter(
    (_polygon, index) =>
      maxFragmentDistance - (fragmentDistances[index] ?? 0) <= apexTolerance
  )
}

const buildOutsideLegalSideSourceVertexJoinPolygon = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number,
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    implicitFillRegions?: PolygonRegion[]
    referencePoints?: Vec2[]
  } = {}
) => {
  if (
    stroke.position !== 'outside' ||
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
  const candidateSets = [primaryOffset, -primaryOffset]
    .map((offset) => ({
      offset,
      polygons: buildSourceVertexJoinPolygonForOffset(
        path,
        previousSegmentIndex,
        nextSegmentIndex,
        stroke,
        offset
      )
    }))
    .filter((candidate) => candidate.polygons.length > 0)

  if (candidateSets.length <= 1) {
    return {
      polygons: candidateSets[0]?.polygons ?? [],
      oppositePolygons: []
    }
  }

  const [selected, opposite] = [...candidateSets].sort((left, right) => {
    const overlapDelta =
      getSourceVertexJoinLegalOverlapArea(
        left.polygons,
        options.implicitFillRegions ?? []
      ) -
      getSourceVertexJoinLegalOverlapArea(
        right.polygons,
        options.implicitFillRegions ?? []
      )
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
  const oppositeTrimPolygons =
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
          opposite.offset
        )
      : (opposite?.polygons ?? [])
  const oppositeContinuityTrimPolygons =
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
          opposite.offset
        )
      : oppositeTrimPolygons
  const rawSelectedContinuityPolygons = selected
    ? buildSourceVertexJoinContinuityPolygonsForOffset(
        path,
        previousSegmentIndex,
        nextSegmentIndex,
        selected.offset,
        stroke.join === 'round'
          ? {
              continuityLength: Math.max(0.5, Math.abs(selected.offset) * 0.12)
            }
          : undefined
      )
    : []
  const selectedContinuityPolygons =
    stroke.join === 'miter' && oppositeTrimPolygons.length > 0
      ? subtractSourceVertexJoinOppositeSidePolygons(
          rawSelectedContinuityPolygons,
          oppositeContinuityTrimPolygons
        )
      : rawSelectedContinuityPolygons
  const continuityPolygons =
    stroke.join === 'miter' ? [] : selectedContinuityPolygons
  return {
    polygons: [...(selected?.polygons ?? []), ...continuityPolygons],
    oppositePolygons: oppositeTrimPolygons
  }
}

const doPhysicalSpansCrossSourceVertex = (
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  sourceVertexDistance: number,
  totalLength: number
) => {
  const crossesInterior = physicalSpans.some(
    (span) =>
      isDistanceInsideInterval(sourceVertexDistance, span, totalLength) &&
      getLoopDistanceDelta(
        sourceVertexDistance,
        span.startDistance,
        totalLength
      ) > EPSILON &&
      getLoopDistanceDelta(
        sourceVertexDistance,
        span.endDistance,
        totalLength
      ) > EPSILON
  )
  if (crossesInterior) {
    return true
  }

  if (!areLoopDistancesEqual(sourceVertexDistance, 0, totalLength)) {
    return false
  }

  const hasTailSpan = physicalSpans.some((span) =>
    areLoopDistancesEqual(span.endDistance, totalLength, totalLength)
  )
  const hasHeadSpan = physicalSpans.some((span) =>
    areLoopDistancesEqual(span.startDistance, 0, totalLength)
  )
  return hasTailSpan && hasHeadSpan
}

const buildSourcePathIntervalJoinPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  physicalSpans: ConstrainedDashedPhysicalSpan[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'join' | 'miterLimit'>,
  options: {
    excludedVertexIndexes?: Set<number>
  } = {}
) => {
  if (
    (stroke.position !== 'outside' && stroke.position !== 'inside') ||
    path.closed !== true ||
    path.segments.length < 2 ||
    physicalSpans.length === 0
  ) {
    return []
  }

  const segmentRanges = getSourcePathSegmentRanges(path)
  return path.segments.flatMap((_segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    if (options.excludedVertexIndexes?.has(nextSegmentIndex)) {
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

    const sourceVertexDistance =
      segmentRanges[nextSegmentIndex]?.startDistance ?? 0
    if (
      !doPhysicalSpansCrossSourceVertex(
        physicalSpans,
        sourceVertexDistance,
        path.totalLength
      )
    ) {
      return []
    }

    const polygons = buildSourceVertexJoinPolygon(
      path,
      previousSegmentIndex,
      nextSegmentIndex,
      stroke
    )
    if (stroke.join !== 'round') {
      return polygons
    }

    const previousBoundary = buildSourceSegmentBoundary(
      path.segments[previousSegmentIndex]
    )
    const vertex = previousBoundary[previousBoundary.length - 1]
    return vertex
      ? polygons.map((polygon) =>
          densifyRoundSourceVertexJoinPolygon(polygon, vertex, stroke.width)
        )
      : polygons
  })
}

const getBoundaryDomainTerminalPoint = (
  interval: VisibleDashedTopologyInterval,
  terminal: 'start' | 'end',
  sampleDistance = 0
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
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

const getBoundaryDomainTerminalKey = (point: Vec2) =>
  `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`

const SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE = 0.75
const SOURCE_VERTEX_JOIN_MIN_TURN_ANGLE = Math.PI / 24

const getBoundaryDomainFaceKey = (boundaryDomainId: string | undefined) =>
  boundaryDomainId?.match(/^face:[^:]+/)?.[0]

interface SourceVertexBoundaryTerminalRecord {
  interval: VisibleDashedTopologyInterval
  terminal: 'start' | 'end'
  endpoint: Vec2
  neighbor: Vec2
  sourceSegmentIndex: number
  domainKey: string | undefined
}

interface SourceVertexBoundaryJoinRecord {
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
  intervals: [VisibleDashedTopologyInterval, VisibleDashedTopologyInterval]
  polygons: Vec2[][]
  oppositePolygons?: Vec2[][]
}

interface SmoothSourceVertexContinuityRecord {
  vertexIndex: number
  previousSegmentIndex: number
  nextSegmentIndex: number
  vertex: Vec2
}

interface SmoothSourceVertexContinuityIntervalReplacement {
  insertIndex: number
  replacedIntervalIds: Set<string>
  interval: VisibleDashedTopologyInterval
}

const getSourceVertexTurnAngle = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  previousSegmentIndex: number,
  nextSegmentIndex: number
) => {
  const previousBoundary = buildSourceSegmentBoundary(
    path.segments[previousSegmentIndex]
  )
  const nextBoundary = buildSourceSegmentBoundary(
    path.segments[nextSegmentIndex]
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
  path: Pick<PathGeometry, 'segments' | 'closed'>
) => {
  if (path.closed !== true || path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
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
      nextSegmentIndex
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

const getTerminalBoundaryEndpoints = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeBoundaryPoints' | 'figmaLikeTerminalRole'
  >
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return []
  }

  return [
    ...(interval.figmaLikeTerminalRole === 'start' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? [boundaryPoints[0]]
      : []),
    ...(interval.figmaLikeTerminalRole === 'end' ||
    interval.figmaLikeTerminalRole === 'start-end'
      ? [boundaryPoints[boundaryPoints.length - 1]]
      : [])
  ]
}

const getTerminalBoundaryEndpoint = (
  interval: Pick<VisibleDashedTopologyInterval, 'figmaLikeBoundaryPoints'>,
  edge: 'start' | 'end'
) => {
  const boundaryPoints = interval.figmaLikeBoundaryPoints
  if (!boundaryPoints || boundaryPoints.length < 2) {
    return null
  }
  return edge === 'start'
    ? boundaryPoints[0]
    : boundaryPoints[boundaryPoints.length - 1]
}

const isTerminalEdgeEndpointAtAuthoredSourceVertex = (
  path: Pick<PathGeometry, 'segments'>,
  interval: Pick<VisibleDashedTopologyInterval, 'figmaLikeBoundaryPoints'>,
  edge: 'start' | 'end',
  tolerance: number
) => {
  const endpoint = getTerminalBoundaryEndpoint(interval, edge)
  if (!endpoint) {
    return false
  }

  const sourceVertices = path.segments.map((segment) =>
    normalizePoint(segment.end)
  )
  if (sourceVertices.length === 0) {
    return false
  }

  return sourceVertices.some(
    (sourceVertex) => distanceBetween(endpoint, sourceVertex) <= tolerance
  )
}

const hasTerminalEndpointAtAuthoredSourceVertex = (
  path: Pick<PathGeometry, 'segments' | 'closed'>,
  interval: Pick<
    VisibleDashedTopologyInterval,
    'figmaLikeBoundaryPoints' | 'figmaLikeTerminalRole'
  >,
  tolerance: number
) => {
  const endpoints = getTerminalBoundaryEndpoints(interval)
  if (endpoints.length === 0) {
    return false
  }

  const sourceVertices = path.segments.map((segment) =>
    normalizePoint(segment.end)
  )
  if (sourceVertices.length === 0) {
    return false
  }

  return endpoints.some((endpoint) =>
    sourceVertices.some(
      (sourceVertex) => distanceBetween(endpoint, sourceVertex) <= tolerance
    )
  )
}

const getSmoothSourceVertexContinuityRecords = (
  path: Pick<PathGeometry, 'segments' | 'closed'>
): SmoothSourceVertexContinuityRecord[] => {
  if (path.closed !== true || path.segments.length < 2) {
    return []
  }

  return path.segments.flatMap((segment, previousSegmentIndex) => {
    const nextSegmentIndex = (previousSegmentIndex + 1) % path.segments.length
    const nextSegment = path.segments[nextSegmentIndex]
    if (!segment || !nextSegment) {
      return []
    }

    if (
      !isSourceBoundarySmooth(path, previousSegmentIndex, nextSegmentIndex) ||
      distanceBetween(segment.end, nextSegment.start) >
        SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE
    ) {
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
  getBoundaryDomainFaceKey(interval.figmaLikeBoundaryDomainId) ??
  interval.figmaLikeBoundaryDomainId

const collectSourceVertexBoundaryTerminalRecords = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  terminalSampleDistance = 0
) => {
  const records: SourceVertexBoundaryTerminalRecord[] = []
  const pushTerminal = (
    interval: VisibleDashedTopologyInterval,
    terminal: 'start' | 'end'
  ) => {
    if (
      interval.figmaLikeBoundaryRole !== 'outer' ||
      interval.figmaLikeSelectedSide !== -1 ||
      interval.figmaLikeSideResolutionStatus === 'blocked' ||
      interval.figmaLikeSplitRangeSourceSegmentIndex === undefined
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
      sourceSegmentIndex: interval.figmaLikeSplitRangeSourceSegmentIndex,
      domainKey: getBoundaryDomainJoinDomainKey(interval)
    })
  }

  visibleIntervals.forEach((interval) => {
    if (
      interval.figmaLikeTerminalRole === 'start' ||
      interval.figmaLikeTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'start')
    }
    if (
      interval.figmaLikeTerminalRole === 'end' ||
      interval.figmaLikeTerminalRole === 'start-end'
    ) {
      pushTerminal(interval, 'end')
    }
  })

  return records
}

const getSmoothContinuityContourRestoreMaxEdgeLength = (strokeWidth: number) =>
  Math.max(1.5, strokeWidth * 0.3)

const sliceIntervalBoundaryVisiblePath = (
  interval: VisibleDashedTopologyInterval
) => {
  const boundaryDomainPath = buildBoundaryDomainPathForInterval(interval)
  if (!boundaryDomainPath) {
    return []
  }

  return cleanBoundaryPath(
    slicePathGeometryPoints(
      boundaryDomainPath,
      interval.startDistance,
      interval.endDistance,
      interval.wrapsSeam,
      SOURCE_PATH_RIBBON_FRAME_TOLERANCE,
      SOURCE_PATH_RIBBON_FRAME_SAMPLING
    )
  )
}

const getBoundaryPathLength = (points: Vec2[]) =>
  points.reduce(
    (total, point, index) =>
      index === 0 ? 0 : total + distanceBetween(points[index - 1], point),
    0
  )

const densifyBoundaryPathByMaxChordLength = (
  points: Vec2[],
  maxChordLength: number
) => {
  if (points.length < 2 || maxChordLength <= EPSILON) {
    return points
  }

  const output: Vec2[] = [normalizePoint(points[0])]
  for (let index = 1; index < points.length; index += 1) {
    const previous = output[output.length - 1]
    const current = normalizePoint(points[index])
    const length = distanceBetween(previous, current)
    const subdivisionCount = Math.max(1, Math.ceil(length / maxChordLength))
    for (let step = 1; step < subdivisionCount; step += 1) {
      const amount = step / subdivisionCount
      output.push(
        normalizePoint({
          x: previous.x + (current.x - previous.x) * amount,
          y: previous.y + (current.y - previous.y) * amount
        })
      )
    }
    output.push(current)
  }

  return cleanBoundaryPath(output)
}

const isSameOutsideSmoothContinuityCoverage = (
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord
) => {
  const previousInterval = previousTerminal.interval
  const nextInterval = nextTerminal.interval
  return (
    previousInterval.intervalId !== nextInterval.intervalId &&
    previousTerminal.domainKey !== undefined &&
    previousTerminal.domainKey === nextTerminal.domainKey &&
    previousInterval.figmaLikeBoundaryRole === 'outer' &&
    nextInterval.figmaLikeBoundaryRole === 'outer' &&
    previousInterval.figmaLikeSelectedSide === -1 &&
    nextInterval.figmaLikeSelectedSide === -1 &&
    previousInterval.figmaLikeFilledSide === nextInterval.figmaLikeFilledSide &&
    previousInterval.figmaLikeUnfilledSide ===
      nextInterval.figmaLikeUnfilledSide &&
    previousInterval.figmaLikeSideResolutionStatus !== 'blocked' &&
    nextInterval.figmaLikeSideResolutionStatus !== 'blocked'
  )
}

const buildOutsideSmoothSourceVertexContinuityInterval = (
  sourceVertex: SmoothSourceVertexContinuityRecord,
  previousTerminal: SourceVertexBoundaryTerminalRecord,
  nextTerminal: SourceVertexBoundaryTerminalRecord,
  insertIndex: number,
  endpointTolerance: number,
  maxChordLength: number
): SmoothSourceVertexContinuityIntervalReplacement | null => {
  if (!isSameOutsideSmoothContinuityCoverage(previousTerminal, nextTerminal)) {
    return null
  }

  const previousPath = sliceIntervalBoundaryVisiblePath(
    previousTerminal.interval
  )
  const nextPath = sliceIntervalBoundaryVisiblePath(nextTerminal.interval)
  if (previousPath.length < 2 || nextPath.length < 2) {
    return null
  }

  const buildContinuousPathCandidate = (
    leftPath: Vec2[],
    rightPath: Vec2[]
  ) => {
    const leftStartsAtVertex =
      distanceBetween(leftPath[0], sourceVertex.vertex) <=
      distanceBetween(leftPath[leftPath.length - 1], sourceVertex.vertex)
    const rightStartsAtVertex =
      distanceBetween(rightPath[0], sourceVertex.vertex) <=
      distanceBetween(rightPath[rightPath.length - 1], sourceVertex.vertex)
    const left = leftStartsAtVertex ? [...leftPath].reverse() : leftPath
    const right = rightStartsAtVertex ? rightPath : [...rightPath].reverse()
    const endpointError = Math.max(
      distanceBetween(left[left.length - 1], sourceVertex.vertex),
      distanceBetween(right[0], sourceVertex.vertex)
    )

    return {
      points: cleanBoundaryPath([...left, ...right.slice(1)]),
      flippedSegmentCount:
        (leftStartsAtVertex ? 1 : 0) + (rightStartsAtVertex ? 0 : 1),
      endpointError
    }
  }
  const continuityCandidate = [
    buildContinuousPathCandidate(previousPath, nextPath),
    buildContinuousPathCandidate(nextPath, previousPath)
  ]
    .filter((candidate) => candidate.endpointError <= endpointTolerance)
    .sort(
      (left, right) =>
        left.flippedSegmentCount - right.flippedSegmentCount ||
        right.points.length - left.points.length
    )[0]

  if (!continuityCandidate) {
    return null
  }

  const boundaryPoints = densifyBoundaryPathByMaxChordLength(
    continuityCandidate.points,
    maxChordLength
  )
  if (boundaryPoints.length < 3) {
    return null
  }

  const boundaryTotalLength = getBoundaryPathLength(boundaryPoints)
  if (boundaryTotalLength <= EPSILON) {
    return null
  }

  const previousInterval = previousTerminal.interval
  const nextInterval = nextTerminal.interval
  const intervalId = [
    'interval',
    'smooth-source-continuity',
    sourceVertex.vertexIndex,
    previousInterval.intervalId.replace(/[^a-zA-Z0-9_-]/g, '-'),
    nextInterval.intervalId.replace(/[^a-zA-Z0-9_-]/g, '-')
  ].join(':')

  return {
    insertIndex,
    replacedIntervalIds: new Set([
      previousInterval.intervalId,
      nextInterval.intervalId
    ]),
    interval: {
      ...previousInterval,
      intervalId,
      authoredIndex: Math.min(
        previousInterval.authoredIndex,
        nextInterval.authoredIndex
      ),
      startDistance: 0,
      endDistance: boundaryTotalLength,
      intervalLength: boundaryTotalLength,
      wrapsSeam: false,
      previousVisibleIntervalId: null,
      nextVisibleIntervalId: null,
      figmaLikeBoundaryPoints: boundaryPoints,
      figmaLikeBoundaryStartDistance: 0,
      figmaLikeBoundaryEndDistance: boundaryTotalLength,
      figmaLikeBoundaryTotalLength: boundaryTotalLength,
      figmaLikeSplitRangeId: undefined,
      figmaLikeSplitRangeStartDistance: undefined,
      figmaLikeSplitRangeEndDistance: undefined,
      figmaLikeTerminalRole: undefined,
      figmaLikeSplitRangeSourceSegmentIndex: undefined,
      figmaLikeBoundaryRole: 'outer',
      figmaLikeSelectedSide: -1,
      figmaLikeSideResolutionStatus:
        previousInterval.figmaLikeSideResolutionStatus ??
        nextInterval.figmaLikeSideResolutionStatus,
      figmaLikeSideResolutionReason:
        previousInterval.figmaLikeSideResolutionReason ??
        nextInterval.figmaLikeSideResolutionReason
    }
  }
}

const buildOutsideSmoothSourceVertexContinuityIntervalReplacements = (
  sourcePath:
    | Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
    | null
    | undefined,
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<RenderableStroke, 'position' | 'width'>
): SmoothSourceVertexContinuityIntervalReplacement[] => {
  if (stroke.position !== 'outside' || !sourcePath) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const terminalRecords = collectSourceVertexBoundaryTerminalRecords(
    visibleIntervals,
    Math.max(stroke.width, SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE)
  )
  if (terminalRecords.length === 0) {
    return []
  }

  const intervalIndexById = new Map(
    visibleIntervals.map((interval, index) => [interval.intervalId, index])
  )
  const usedIntervalIds = new Set<string>()
  const replacements: SmoothSourceVertexContinuityIntervalReplacement[] = []

  getSmoothSourceVertexContinuityRecords(sourcePath).forEach((sourceVertex) => {
    const previousTerminals = terminalRecords.filter(
      (record) =>
        !usedIntervalIds.has(record.interval.intervalId) &&
        record.sourceSegmentIndex === sourceVertex.previousSegmentIndex &&
        record.domainKey !== undefined &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    const nextTerminals = terminalRecords.filter(
      (record) =>
        !usedIntervalIds.has(record.interval.intervalId) &&
        record.sourceSegmentIndex === sourceVertex.nextSegmentIndex &&
        record.domainKey !== undefined &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )

    for (const previousTerminal of previousTerminals) {
      const previousIndex =
        intervalIndexById.get(previousTerminal.interval.intervalId) ??
        Number.MAX_SAFE_INTEGER
      for (const nextTerminal of nextTerminals) {
        const nextIndex =
          intervalIndexById.get(nextTerminal.interval.intervalId) ??
          Number.MAX_SAFE_INTEGER
        const replacement = buildOutsideSmoothSourceVertexContinuityInterval(
          sourceVertex,
          previousTerminal,
          nextTerminal,
          Math.min(previousIndex, nextIndex),
          endpointTolerance,
          Math.max(1.25, stroke.width * 0.25)
        )
        if (!replacement) {
          continue
        }

        replacement.replacedIntervalIds.forEach((intervalId) => {
          usedIntervalIds.add(intervalId)
        })
        replacements.push(replacement)
        return
      }
    }
  })

  return replacements
}

const replaceOutsideSmoothSourceVertexContinuityIntervals = (
  visibleIntervals: VisibleDashedTopologyInterval[],
  sourcePath:
    | Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
    | null
    | undefined,
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => {
  const replacements =
    buildOutsideSmoothSourceVertexContinuityIntervalReplacements(
      sourcePath,
      visibleIntervals,
      stroke
    )
  if (replacements.length === 0) {
    return visibleIntervals
  }

  const removedIntervalIds = new Set(
    replacements.flatMap((replacement) => [...replacement.replacedIntervalIds])
  )
  const replacementsByInsertIndex = new Map<
    number,
    SmoothSourceVertexContinuityIntervalReplacement[]
  >()
  replacements.forEach((replacement) => {
    const indexReplacements =
      replacementsByInsertIndex.get(replacement.insertIndex) ?? []
    indexReplacements.push(replacement)
    replacementsByInsertIndex.set(replacement.insertIndex, indexReplacements)
  })

  const rewritten: VisibleDashedTopologyInterval[] = []
  visibleIntervals.forEach((interval, index) => {
    replacementsByInsertIndex.get(index)?.forEach((replacement) => {
      rewritten.push(replacement.interval)
    })
    if (!removedIntervalIds.has(interval.intervalId)) {
      rewritten.push(interval)
    }
  })

  return rewritten
}

const isOutsideJoinNeutralBoundaryInterval = (
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'figmaLikeSideAuthority'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSelectedSide'
  >
) => interval.intervalId.includes(':smooth-source-continuity:')

const resolveOutsideBoundaryIntervalJoinStroke = <
  TStroke extends Pick<RenderableStroke, 'join'>
>(
  interval: Pick<
    VisibleDashedTopologyInterval,
    | 'intervalId'
    | 'figmaLikeSideAuthority'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSelectedSide'
  >,
  stroke: TStroke
): TStroke =>
  isOutsideJoinNeutralBoundaryInterval(interval)
    ? ({ ...stroke, join: 'bevel' as const } as TStroke)
    : stroke

const buildOutsideSourceVertexBoundaryJoinRecords = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> | null,
  visibleIntervals: VisibleDashedTopologyInterval[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'dashPattern' | 'dashOffset'
  >,
  options: {
    includeOppositeSourceSideCandidates?: boolean
    implicitFillRegions?: PolygonRegion[]
    physicalSpansByIntervalId?: Map<string, ConstrainedDashedPhysicalSpan[]>
  } = {}
): SourceVertexBoundaryJoinRecord[] => {
  if (stroke.position !== 'outside' || !sourcePath) {
    return []
  }

  const endpointTolerance = Math.max(
    SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
    stroke.width * 0.75
  )
  const terminalRecords =
    collectSourceVertexBoundaryTerminalRecords(visibleIntervals)
  if (terminalRecords.length === 0) {
    const segmentRanges = getSourcePathSegmentRanges(sourcePath)
    return getSourceVertexRecords(sourcePath).flatMap((sourceVertex) => {
      const sourceVertexDistance =
        segmentRanges[sourceVertex.vertexIndex]?.startDistance ?? 0
      const crossingInterval = visibleIntervals.find((interval) => {
        const spans =
          options.physicalSpansByIntervalId?.get(interval.intervalId) ??
          splitIntervalCoreIntoPhysicalSpans(
            interval.intervalId,
            interval,
            sourcePath.totalLength
          )
        return doPhysicalSpansCrossSourceVertex(
          spans,
          sourceVertexDistance,
          sourcePath.totalLength
        )
      })
      if (!crossingInterval) {
        return []
      }

      const sourcePathJoin = buildOutsideLegalSideSourceVertexJoinPolygon(
        sourcePath,
        sourceVertex.previousSegmentIndex,
        sourceVertex.nextSegmentIndex,
        stroke,
        { implicitFillRegions: options.implicitFillRegions }
      )
      return sourcePathJoin.polygons.length > 0
        ? [
            {
              ...sourceVertex,
              intervals: [crossingInterval, crossingInterval],
              polygons: sourcePathJoin.polygons,
              oppositePolygons: sourcePathJoin.oppositePolygons
            }
          ]
        : []
    })
  }

  const segmentRanges = getSourcePathSegmentRanges(sourcePath)
  return getSourceVertexRecords(sourcePath).flatMap((sourceVertex) => {
    const previousTerminal = terminalRecords.find(
      (record) =>
        record.sourceSegmentIndex === sourceVertex.previousSegmentIndex &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    const nextTerminal = terminalRecords.find(
      (record) =>
        record.sourceSegmentIndex === sourceVertex.nextSegmentIndex &&
        distanceBetween(record.endpoint, sourceVertex.vertex) <=
          endpointTolerance
    )
    const sourceVertexDistance =
      segmentRanges[sourceVertex.vertexIndex]?.startDistance ?? 0
    const crossingInterval = visibleIntervals.find((interval) => {
      const spans =
        options.physicalSpansByIntervalId?.get(interval.intervalId) ??
        splitIntervalCoreIntoPhysicalSpans(
          interval.intervalId,
          interval,
          sourcePath.totalLength
        )
      return doPhysicalSpansCrossSourceVertex(
        spans,
        sourceVertexDistance,
        sourcePath.totalLength
      )
    })
    if (!crossingInterval && (!previousTerminal || !nextTerminal)) {
      return []
    }
    const previousInterval = previousTerminal?.interval ?? crossingInterval
    const nextInterval = nextTerminal?.interval ?? crossingInterval
    if (!previousInterval || !nextInterval) {
      return []
    }

    const referenceDistance = Math.max(
      SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE,
      stroke.width * 2.5
    )
    const referencePoints = [
      ...(previousTerminal?.interval.figmaLikeBoundaryPoints ?? []),
      ...(nextTerminal?.interval.figmaLikeBoundaryPoints ?? []),
      ...(crossingInterval?.figmaLikeBoundaryPoints ?? [])
    ].filter(
      (point) =>
        distanceBetween(point, sourceVertex.vertex) >
          SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE &&
        distanceBetween(point, sourceVertex.vertex) <= referenceDistance
    )

    const sourcePathJoin = buildOutsideLegalSideSourceVertexJoinPolygon(
      sourcePath,
      sourceVertex.previousSegmentIndex,
      sourceVertex.nextSegmentIndex,
      stroke,
      {
        implicitFillRegions: options.implicitFillRegions,
        referencePoints
      }
    )
    const sourcePathPolygons = sourcePathJoin.polygons
    const polygons = sourcePathPolygons
    if (polygons.length === 0) {
      return []
    }

    return [
      {
        ...sourceVertex,
        intervals: [previousInterval, nextInterval],
        polygons,
        oppositePolygons: sourcePathJoin.oppositePolygons
      }
    ]
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
    skipSourceEdgeFallback?: boolean
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
  const fallbackPolygons = areaValidPolygons.filter((polygon) =>
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
    if (options?.skipSourceEdgeFallback === true) {
      return clippedPolygons
    }

    const sourceEdge =
      options?.sourceEdge ??
      sliceSourcePathRangePoints(path, range, physicalSpanRole, slicingContext)
    const fallbackSourceEdgeCount = countSourceEdgeVertices(
      fallbackPolygons,
      sourceEdge
    )
    const clippedSourceEdgeCount = countSourceEdgeVertices(
      clippedPolygons,
      sourceEdge
    )
    if (
      fallbackSourceEdgeCount >= 3 &&
      clippedSourceEdgeCount < Math.min(3, fallbackSourceEdgeCount)
    ) {
      return fallbackPolygons
    }

    return clippedPolygons
  }

  return fallbackPolygons
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

const buildOpenSourceSpanBothSidesPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  range: SourceSegmentIntervalRange,
  authoredStroke: Pick<
    RenderableStroke,
    'style' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext: SourcePathSlicingContext
) => {
  const points = sliceSourcePathRangePoints(path, range, 'core', slicingContext)
  if (points.length < 2 || authoredStroke.width <= EPSILON) {
    return []
  }

  const baseStroke = {
    style: 'solid' as const,
    width: authoredStroke.width,
    join: authoredStroke.join,
    miterLimit: authoredStroke.miterLimit,
    cap: authoredStroke.cap
  }

  return (['inside', 'outside'] as const)
    .flatMap((position) =>
      buildConstrainedDashedLocalSideStrokePolygons(
        points,
        false,
        {
          ...baseStroke,
          position
        },
        {
          assumeSimpleOpen: true,
          assumeSimpleClosed: undefined,
          assumeNormalizedOpen: true
        }
      )
    )
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
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
    | 'figmaLikeSplitRangeId'
    | 'figmaLikeTerminalRole'
    | 'figmaLikeSplitRangeStartDistance'
    | 'figmaLikeSplitRangeEndDistance'
    | 'figmaLikeSideAuthority'
    | 'figmaLikeBoundaryDomainId'
    | 'figmaLikeSelectedSide'
    | 'figmaLikeBoundaryRole'
    | 'figmaLikeSideResolutionStatus'
    | 'figmaLikeSideResolutionReason'
    | 'figmaLikeBoundaryPoints'
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
  const { range, span, renderRange, capOwnership } = sweepRange
  const authoredConstrainedPosition =
    authoredStroke.position === 'inside' ||
    authoredStroke.position === 'outside'
      ? authoredStroke.position
      : null
  const shouldResolveSelfIntersectingLegalSide =
    strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain' &&
    authoredConstrainedPosition !== null
  const shouldRenderOpenSourceSpanAsBothSides =
    isOpenDanglingOutsideBothSidesVisibleInterval(interval)
  if (shouldRenderOpenSourceSpanAsBothSides) {
    output.push(
      ...buildOpenSourceSpanBothSidesPolygons(
        path,
        renderRange,
        authoredStroke,
        slicingContext
      )
    )
    return
  }
  const resolvedIntervalStroke = shouldResolveSelfIntersectingLegalSide
    ? shouldRenderOpenSourceSpanAsBothSides
      ? {
          position: 'center' as const,
          width: intervalStroke.width
        }
      : interval.figmaLikeSideResolutionStatus === 'resolved' &&
          interval.figmaLikeSelectedSide !== undefined
        ? {
            position:
              interval.figmaLikeSelectedSide > 0
                ? ('inside' as const)
                : ('outside' as const),
            width: intervalStroke.width
          }
        : null
    : intervalStroke
  if (!resolvedIntervalStroke) {
    return
  }

  const segmentRange = slicingContext.segmentRanges[range.segmentIndex]
  const shouldClipInsideBoundary =
    topology.topologyFamily === 'self-intersecting'
      ? false
      : authoredStroke.position === 'inside' && path.closed === true
        ? false
        : shouldClipSourceSegmentRangeForInsideBoundary(
            range,
            segmentRange,
            path,
            interval,
            authoredStroke,
            resolvedIntervalStroke,
            sharpGuardVertices
          )
  const isOutsideSquareSplitTerminalHalfDash =
    shouldResolveSelfIntersectingLegalSide &&
    authoredStroke.position === 'outside' &&
    authoredStroke.cap === 'square' &&
    interval.figmaLikeSplitRangeId !== undefined &&
    (interval.figmaLikeTerminalRole === 'start' ||
      interval.figmaLikeTerminalRole === 'end' ||
      interval.figmaLikeTerminalRole === 'start-end')
  const shouldClipOutsideSquareSplitTerminalFootprints =
    isOutsideSquareSplitTerminalHalfDash &&
    clipInsideToFillDomain &&
    interval.figmaLikeBoundaryRole !== 'hole'
  const hasOutsideSquareSplitTerminalAuthoredSourceVertex =
    shouldClipOutsideSquareSplitTerminalFootprints
      ? hasTerminalEndpointAtAuthoredSourceVertex(
          path,
          interval,
          Math.max(1.5, SOURCE_VERTEX_JOIN_ENDPOINT_TOLERANCE)
        )
      : false
  const shouldClipOutsideSquareSplitTerminalPolygonsToBoundaryDomains =
    shouldClipOutsideSquareSplitTerminalFootprints &&
    !hasOutsideSquareSplitTerminalAuthoredSourceVertex &&
    interval.figmaLikeSplitRangeId !== undefined
  const appendRangeForOffsetRibbonFrame = (
    currentIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
    shouldApplySourceBoundaryClip: boolean
  ) => {
    const buildRangePolygons = (
      candidateIntervalStroke: Pick<RenderableStroke, 'position' | 'width'>,
      candidateRenderRange: SourceSegmentIntervalRange
    ) => {
      const rangeCapOwnership = isOutsideSquareSplitTerminalHalfDash
        ? {
            ...capOwnership,
            stroke: {
              ...capOwnership.stroke,
              cap: 'butt' as const
            },
            roundCapStart: false,
            roundCapEnd: false
          }
        : capOwnership
      const resolvedCapStroke = {
        ...rangeCapOwnership.stroke,
        position: candidateIntervalStroke.position
      }
      const cacheKey = !shouldApplySourceBoundaryClip
        ? buildSourcePathFinalRangePolygonCacheKey(
            path,
            candidateRenderRange,
            slicingContext.segmentRanges[candidateRenderRange.segmentIndex],
            span.role,
            resolvedCapStroke,
            rangeCapOwnership.roundCapStart,
            rangeCapOwnership.roundCapEnd,
            slicingContext.roundCapVisualMaxLength,
            slicingContext.samplingTolerance,
            slicingContext.samplingOptions
          )
        : null
      const cachedPolygons = cacheKey
        ? getCachedSourcePathFinalRangePolygons(cacheKey)
        : null
      if (cachedPolygons) {
        return cachedPolygons
      }

      const exactFrames = measureStrokePipelinePhase(
        'constrained dashed final coverage: range slice',
        () =>
          interval.intervalId.includes(':smooth-source-continuity:')
            ? sliceSmoothedLineOnlyOffsetRibbonRangeFrames(
                path,
                candidateRenderRange,
                slicingContext,
                candidateIntervalStroke
              )
            : sliceExactOffsetRibbonRangeFrames(
                path,
                candidateRenderRange,
                slicingContext,
                candidateIntervalStroke
              )
      )
      if (exactFrames.length < 2) {
        return []
      }

      const rangePolygons = measureStrokePipelinePhase(
        'constrained dashed final coverage: polygon build',
        () => {
          const terminalCapOverhangPolygons =
            buildOpenPathTerminalCapOverhangPolygons(
              exactFrames,
              rangeCapOwnership
            )
          const squareSplitTerminalFootprintPolygons =
            shouldClipOutsideSquareSplitTerminalFootprints
              ? []
              : buildOutsideSquareSplitTerminalFootprintPolygons(
                  path,
                  range,
                  interval,
                  authoredStroke,
                  candidateIntervalStroke,
                  slicingContext
                )
          if (
            resolvedCapStroke.cap === 'round' &&
            (rangeCapOwnership.roundCapStart === true ||
              rangeCapOwnership.roundCapEnd === true)
          ) {
            return [
              ...buildMergedExactSourcePathRibbonPolygonsFromOffsetFrames(
                exactFrames,
                resolvedCapStroke,
                rangeCapOwnership.roundCapStart,
                rangeCapOwnership.roundCapEnd,
                slicingContext.roundCapVisualMaxLength
              ),
              ...terminalCapOverhangPolygons,
              ...squareSplitTerminalFootprintPolygons
            ]
          }
          const { bodyPolygons, capPolygons } =
            buildExactSourcePathRibbonGeometryFromOffsetFrames(
              exactFrames,
              resolvedCapStroke,
              rangeCapOwnership.roundCapStart,
              rangeCapOwnership.roundCapEnd,
              slicingContext.roundCapVisualMaxLength
            )
          return [
            ...bodyPolygons,
            ...capPolygons,
            ...terminalCapOverhangPolygons,
            ...squareSplitTerminalFootprintPolygons
          ]
        }
      )
      if (!shouldApplySourceBoundaryClip) {
        if (cacheKey) {
          setCachedSourcePathFinalRangePolygons(cacheKey, rangePolygons)
        }
        return rangePolygons
      }

      return measureStrokePipelinePhase(
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
              skipSourceEdgeFallback: true,
              sourceEdge: exactFrames.map((frame) => frame.point)
            }
          )
      )
    }

    const rangePolygons = buildRangePolygons(currentIntervalStroke, renderRange)
    const squareSplitTerminalFootprintPolygons =
      buildOutsideSquareSplitTerminalFootprintPolygons(
        path,
        range,
        interval,
        authoredStroke,
        currentIntervalStroke,
        slicingContext
      )
    let finalRangePolygons = rangePolygons
    const shouldRestoreOutsideSubjectBoundary = !(
      authoredStroke.position === 'outside' &&
      authoredStroke.cap === 'square' &&
      interval.figmaLikeSplitRangeId !== undefined
    )
    let appendedSquareSplitTerminalFootprints = false
    if (
      shouldResolveSelfIntersectingLegalSide &&
      !shouldRenderOpenSourceSpanAsBothSides &&
      authoredStroke.position === 'outside' &&
      clipInsideToFillDomain &&
      interval.figmaLikeBoundaryRole !== 'hole' &&
      !interval.intervalId.includes(':smooth-source-continuity:') &&
      finalRangePolygons.length > 0 &&
      (implicitFillRegions.length > 0 ||
        shouldClipOutsideSquareSplitTerminalPolygonsToBoundaryDomains)
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
          cleanupMicroEdgeTolerance: 0.001,
          cleanupCollinearTolerance: 0.0001,
          ...(shouldRestoreOutsideSubjectBoundary
            ? {
                restoreSubjectBoundaryPolygons: rangePolygons,
                restoreSubjectBoundaryMaxEdgeLength:
                  currentIntervalStroke.position === 'outside'
                    ? getSmoothContinuityContourRestoreMaxEdgeLength(
                        currentIntervalStroke.width
                      )
                    : Math.max(8, currentIntervalStroke.width * 1.2),
                restoreSubjectBoundarySnapTolerance: Math.max(
                  1,
                  currentIntervalStroke.width * 0.2
                )
              }
            : {})
        }
      )
      let clippedSquareSplitTerminalFootprintPolygons =
        clipOutsideSquareSplitTerminalFootprintPolygonsToLegalDomain(
          squareSplitTerminalFootprintPolygons,
          interval,
          path,
          implicitFillRegions,
          shouldClipOutsideSquareSplitTerminalPolygonsToBoundaryDomains
            ? sharedStrokeBoundaryDomains
            : [],
          { skipBoundarySideClip: false }
        )
      if (shouldClipOutsideSquareSplitTerminalPolygonsToBoundaryDomains) {
        clippedSquareSplitTerminalFootprintPolygons =
          clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide(
            clippedSquareSplitTerminalFootprintPolygons,
            interval
          )
      }
      if (clippedSquareSplitTerminalFootprintPolygons.length > 0) {
        finalRangePolygons = [
          ...finalRangePolygons,
          ...clippedSquareSplitTerminalFootprintPolygons
        ]
        appendedSquareSplitTerminalFootprints = true
      }
      finalRangePolygons = finalRangePolygons
        .map((polygon) => cleanClippedProductPolygon(polygon))
        .filter(hasPolygonGeometry)
    }
    if (
      shouldResolveSelfIntersectingLegalSide &&
      !shouldRenderOpenSourceSpanAsBothSides &&
      authoredStroke.position === 'outside' &&
      authoredStroke.cap === 'square' &&
      interval.figmaLikeBoundaryRole !== 'hole' &&
      (interval.figmaLikeTerminalRole === 'start' ||
        interval.figmaLikeTerminalRole === 'end' ||
        interval.figmaLikeTerminalRole === 'start-end')
    ) {
      const terminalFootprints = appendedSquareSplitTerminalFootprints
        ? []
        : clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide(
            squareSplitTerminalFootprintPolygons,
            interval
          )
      if (terminalFootprints.length > 0) {
        finalRangePolygons = [...finalRangePolygons, ...terminalFootprints]
      }
    }
    if (
      shouldResolveSelfIntersectingLegalSide &&
      !shouldRenderOpenSourceSpanAsBothSides &&
      authoredStroke.position === 'outside' &&
      authoredStroke.cap === 'square' &&
      interval.figmaLikeSplitRangeId !== undefined
    ) {
      finalRangePolygons = filterOutsideSquareBoundaryDomainWrongSideFragments(
        finalRangePolygons,
        interval,
        authoredStroke
      )
    }
    finalRangePolygons = isOutsideSquareSplitTerminalHalfDash
      ? clipOutsideSquareSplitTerminalEndpointOverhang(
          finalRangePolygons,
          interval,
          authoredStroke
        )
      : finalRangePolygons

    output.push(...finalRangePolygons)
  }

  if (shouldResolveSelfIntersectingLegalSide) {
    appendRangeForOffsetRibbonFrame(resolvedIntervalStroke, false)
    return
  }

  appendRangeForOffsetRibbonFrame(
    resolvedIntervalStroke,
    shouldClipInsideBoundary
  )
}

const buildInsideDoubledCenterDashedIntervalProductPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
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
  slicingContext: SourcePathSlicingContext,
  implicitFillRegions: PolygonRegion[]
) => {
  if (
    authoredStroke.position !== 'inside' ||
    authoredStroke.width <= EPSILON ||
    path.segments.length === 0
  ) {
    return []
  }

  const frames = slicePathGeometryFrames(
    path,
    interval.startDistance,
    interval.endDistance,
    interval.wrapsSeam,
    slicingContext.samplingTolerance,
    slicingContext.samplingOptions
  )
  if (frames.length < 2) {
    return []
  }

  const doubledCenterStroke = {
    style: 'solid' as const,
    position: 'center' as const,
    width: authoredStroke.width * 2,
    join: authoredStroke.join,
    miterLimit: authoredStroke.miterLimit,
    cap: authoredStroke.cap
  }
  const ribbonGeometry = buildDashedCenterRibbonGeometry(
    frames.map((frame) => ({
      point: frame.point,
      tangent: frame.tangent,
      sharpJoin: frame.sharpJoin
    })),
    doubledCenterStroke,
    {
      allowRoundCapBackendOffset: true
    }
  )
  const doubledCenterPolygons =
    ribbonGeometry.polygons.length > 0
      ? ribbonGeometry.polygons
      : buildSolidCenterStrokePolygons(
          frames.map((frame) => frame.point),
          false,
          doubledCenterStroke
        )

  if (doubledCenterPolygons.length === 0) {
    return []
  }

  const subjectPolygons = doubledCenterPolygons
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
  if (subjectPolygons.length === 0 || implicitFillRegions.length === 0) {
    return []
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.intersection) {
      return []
    }
    const normalizedFillRegions = backend.capabilities.union
      ? backend.union(implicitFillRegions, 'nonzero')
      : implicitFillRegions
    const fillRegions =
      normalizedFillRegions.length > 0
        ? normalizedFillRegions
        : implicitFillRegions
    return getCoveragePolygonsFromRegions(
      backend.intersection(
        toCoveragePolygonRegions(subjectPolygons),
        fillRegions,
        'nonzero'
      )
    )
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)
  } catch {
    return []
  }
}

const buildInsideDoubledCenterDashedIntervalSubjectPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
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
  slicingContext: SourcePathSlicingContext
) => {
  if (
    authoredStroke.position !== 'inside' ||
    authoredStroke.width <= EPSILON ||
    path.segments.length === 0
  ) {
    return []
  }

  const intervalRanges =
    interval.wrapsSeam && path.closed
      ? [
          {
            startDistance: interval.startDistance,
            endDistance: path.totalLength
          },
          { startDistance: 0, endDistance: interval.endDistance }
        ]
      : [
          {
            startDistance: interval.startDistance,
            endDistance: interval.endDistance
          }
        ]
  const frames = intervalRanges.flatMap((range) => {
    if (range.endDistance - range.startDistance <= EPSILON) {
      return []
    }
    const segmentIndex = Math.min(
      slicingContext.segmentRanges.length - 1,
      Math.max(
        0,
        lowerBoundSourcePathSegmentEnd(
          slicingContext.segmentRanges,
          range.startDistance + EPSILON
        )
      )
    )
    return sliceExactRibbonRangeFrames(
      path,
      {
        startDistance: range.startDistance,
        endDistance: range.endDistance,
        segmentIndex
      },
      slicingContext
    )
  })
  const dedupedFrames = dedupeRibbonFrames(frames)
  if (dedupedFrames.length < 2) {
    return []
  }

  const doubledCenterStroke = {
    style: 'solid' as const,
    position: 'center' as const,
    width: authoredStroke.width * 2,
    join: authoredStroke.join,
    miterLimit: authoredStroke.miterLimit,
    cap: authoredStroke.cap
  }
  const ribbonGeometry = buildDashedCenterRibbonGeometry(
    dedupedFrames.map((frame) => ({
      point: frame.point,
      tangent: frame.tangent,
      sharpJoin: frame.sharpJoin
    })),
    doubledCenterStroke,
    {
      allowRoundCapBackendOffset: true
    }
  )
  const doubledCenterPolygons =
    ribbonGeometry.polygons.length > 0
      ? ribbonGeometry.polygons
      : buildSolidCenterStrokePolygons(
          dedupedFrames.map((frame) => frame.point),
          false,
          doubledCenterStroke
        )

  if (doubledCenterPolygons.length === 0) {
    return []
  }

  const subjectPolygons = doubledCenterPolygons
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)

  return subjectPolygons
}

const buildInsideDoubledCenterDashedIntervalStrokePath = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  interval: VisibleDashedTopologyInterval,
  slicingContext: SourcePathSlicingContext
) => {
  const intervalRanges =
    interval.wrapsSeam && path.closed
      ? [
          {
            startDistance: interval.startDistance,
            endDistance: path.totalLength
          },
          { startDistance: 0, endDistance: interval.endDistance }
        ]
      : [
          {
            startDistance: interval.startDistance,
            endDistance: interval.endDistance
          }
        ]

  const cacheKey = buildSourcePathIntervalStrokePathCacheKey(
    path,
    interval,
    intervalRanges,
    slicingContext
  )
  const cached = getCachedSourcePathIntervalStrokePaths(cacheKey)
  if (cached) {
    return cached
  }

  const strokePaths = intervalRanges.flatMap((range) => {
    if (range.endDistance - range.startDistance <= EPSILON) {
      return []
    }
    const segmentIndex = Math.min(
      slicingContext.segmentRanges.length - 1,
      Math.max(
        0,
        lowerBoundSourcePathSegmentEnd(
          slicingContext.segmentRanges,
          range.startDistance + EPSILON
        )
      )
    )
    const frames = sliceExactRibbonRangeFrames(
      path,
      {
        startDistance: range.startDistance,
        endDistance: range.endDistance,
        segmentIndex
      },
      slicingContext
    )
    const points = dedupeRibbonFrames(frames).map((frame) => frame.point)
    return points.length >= 2 ? [points] : []
  })
  setCachedSourcePathIntervalStrokePaths(cacheKey, strokePaths)
  return strokePaths
}

const buildInsideDoubledCenterDashedRenderMaskDescriptor = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervals: VisibleDashedTopologyInterval[],
  authoredStroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext: SourcePathSlicingContext,
  implicitFillRegions: PolygonRegion[],
  preferBoundaryDomainPath = false
) => {
  if (
    authoredStroke.position !== 'inside' ||
    authoredStroke.width <= EPSILON ||
    implicitFillRegions.length === 0 ||
    intervals.length === 0 ||
    intervals.some(isSourceSpanProductDomainVisibleInterval)
  ) {
    return null
  }

  const strokePaths = measureStrokePipelinePhase(
    'constrained dashed product visual entries: inside mask stroke paths',
    () =>
      buildConstrainedDashedIntervalStrokePaths(
        path,
        intervals,
        slicingContext,
        preferBoundaryDomainPath
      )
  )
  if (strokePaths.length === 0) {
    return null
  }

  const fillClipPolygons = measureStrokePipelinePhase(
    'constrained dashed product visual entries: inside mask clip polygons',
    () =>
      getCoveragePolygonsFromRegions(implicitFillRegions)
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)
  )
  if (fillClipPolygons.length === 0) {
    return null
  }

  return {
    polygons: fillClipPolygons,
    renderDescriptor: {
      fillClipPolygons,
      strokePaths,
      strokePathStyle: {
        width: authoredStroke.width * 2,
        cap: authoredStroke.cap,
        join: authoredStroke.join,
        miterLimit: authoredStroke.miterLimit,
        closed: false
      }
    }
  }
}

const orientPolygonAsOuter = (polygon: Vec2[]) =>
  polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon

const orientPolygonAsHole = (polygon: Vec2[]) =>
  polygonArea(polygon) < 0 ? polygon : [...polygon].reverse()

const getPolygonsBounds = (polygons: Vec2[][]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) => {
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })

  return { minX, minY, maxX, maxY }
}

const buildBoundsPolygonFromPoints = (points: Vec2[], padding: number) => {
  const bounds = getPolygonsBounds([points])
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return null
  }

  return [
    { x: bounds.minX - padding, y: bounds.minY - padding },
    { x: bounds.maxX + padding, y: bounds.minY - padding },
    { x: bounds.maxX + padding, y: bounds.maxY + padding },
    { x: bounds.minX - padding, y: bounds.maxY + padding }
  ]
}

const buildConstrainedDashedIntervalStrokePaths = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervals: VisibleDashedTopologyInterval[],
  sourcePathSlicingContext: SourcePathSlicingContext,
  preferBoundaryDomainPath: boolean
) =>
  intervals.flatMap((interval) => {
    const boundaryPath = preferBoundaryDomainPath
      ? buildBoundaryDomainPathForInterval(interval)
      : null
    const effectivePath = boundaryPath ?? sourcePath
    let effectiveSlicingContext = sourcePathSlicingContext
    if (boundaryPath) {
      const cachedSlicingContext =
        boundaryDomainSlicingContextCache.get(boundaryPath)
      effectiveSlicingContext =
        cachedSlicingContext ??
        createSourcePathSlicingContext(
          boundaryPath,
          DRAG_SOURCE_PATH_DASH_SLICE_TOLERANCE,
          DRAG_SOURCE_PATH_DASH_SLICE_SAMPLING,
          DRAG_ROUND_CAP_VISUAL_MAX_LENGTH
        )
      if (!cachedSlicingContext) {
        boundaryDomainSlicingContextCache.set(
          boundaryPath,
          effectiveSlicingContext
        )
      }
    }

    return buildInsideDoubledCenterDashedIntervalStrokePath(
      effectivePath,
      interval,
      effectiveSlicingContext
    )
  })

const buildConstrainedDashedPhysicalIntervalStrokePaths = (
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervals: VisibleDashedTopologyInterval[],
  authoredStroke: Pick<RenderableStroke, 'cap' | 'width'>,
  sourcePathSlicingContext: SourcePathSlicingContext,
  preferBoundaryDomainPath: boolean
) =>
  intervals.flatMap((interval) => {
    const boundaryPath = preferBoundaryDomainPath
      ? buildBoundaryDomainPathForInterval(interval)
      : null
    const effectivePath = boundaryPath ?? sourcePath
    let effectiveSlicingContext = sourcePathSlicingContext
    if (boundaryPath) {
      const cachedSlicingContext =
        boundaryDomainSlicingContextCache.get(boundaryPath)
      effectiveSlicingContext =
        cachedSlicingContext ??
        createSourcePathSlicingContext(
          boundaryPath,
          DRAG_SOURCE_PATH_DASH_SLICE_TOLERANCE,
          DRAG_SOURCE_PATH_DASH_SLICE_SAMPLING,
          DRAG_ROUND_CAP_VISUAL_MAX_LENGTH
        )
      if (!cachedSlicingContext) {
        boundaryDomainSlicingContextCache.set(
          boundaryPath,
          effectiveSlicingContext
        )
      }
    }

    return getIntervalPhysicalSpans(
      {
        totalLength: effectivePath.totalLength,
        closed: effectivePath.closed
      },
      authoredStroke,
      interval
    ).flatMap((span) =>
      buildInsideDoubledCenterDashedIntervalStrokePath(
        effectivePath,
        {
          ...interval,
          intervalId: span.spanId,
          startDistance: span.startDistance,
          endDistance: span.endDistance,
          wrapsSeam: span.wrapsSeam,
          intervalLength: span.intervalLength
        },
        effectiveSlicingContext
      )
    )
  })

const buildFigmaLikeSplitRangeTerminalDebugRecords = (
  intervals: VisibleDashedTopologyInterval[]
): SolidCenterStrokeGeometryDebugMeta['figmaLikeSplitRangeTerminals'] => {
  const records = intervals.flatMap((interval) => {
    if (
      !interval.figmaLikeSplitRangeId ||
      interval.figmaLikeSplitRangeStartDistance === undefined ||
      interval.figmaLikeSplitRangeEndDistance === undefined ||
      !interval.figmaLikeTerminalRole
    ) {
      return []
    }

    return [
      {
        intervalId: interval.intervalId,
        boundaryDomainId: interval.figmaLikeBoundaryDomainId,
        boundaryPoints: interval.figmaLikeBoundaryPoints
          ? interval.figmaLikeBoundaryPoints.map((point) => ({ ...point }))
          : undefined,
        boundaryStartDistance: interval.figmaLikeBoundaryStartDistance,
        boundaryEndDistance: interval.figmaLikeBoundaryEndDistance,
        boundaryTotalLength: interval.figmaLikeBoundaryTotalLength,
        splitRangeId: interval.figmaLikeSplitRangeId,
        splitRangeStartDistance: interval.figmaLikeSplitRangeStartDistance,
        splitRangeEndDistance: interval.figmaLikeSplitRangeEndDistance,
        terminalRole: interval.figmaLikeTerminalRole,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        sourceSegmentIndex: interval.figmaLikeSplitRangeSourceSegmentIndex,
        selectedSide: interval.figmaLikeSelectedSide,
        filledSide: interval.figmaLikeFilledSide,
        unfilledSide: interval.figmaLikeUnfilledSide,
        boundaryRole: interval.figmaLikeBoundaryRole
      }
    ]
  })

  return records.length > 0 ? records : undefined
}

const buildOutsideDoubledCenterDashedRenderMaskDescriptor = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervals: VisibleDashedTopologyInterval[],
  authoredStroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  slicingContext: SourcePathSlicingContext,
  implicitFillRegions: PolygonRegion[],
  fallbackFillPolygons: Vec2[][],
  preferBoundaryDomainPath = true
) => {
  if (
    authoredStroke.position !== 'outside' ||
    authoredStroke.width <= EPSILON ||
    intervals.length === 0
  ) {
    return null
  }

  const strokePaths =
    authoredStroke.cap === 'square'
      ? buildConstrainedDashedPhysicalIntervalStrokePaths(
          path,
          intervals,
          authoredStroke,
          slicingContext,
          preferBoundaryDomainPath
        )
      : buildConstrainedDashedIntervalStrokePaths(
          path,
          intervals,
          slicingContext,
          preferBoundaryDomainPath
        )
  if (strokePaths.length === 0) {
    return null
  }

  const fillPolygons = (
    implicitFillRegions.length > 0
      ? getCoveragePolygonsFromRegions(implicitFillRegions)
      : fallbackFillPolygons
  )
    .map(cleanPolygon)
    .filter(hasPolygonGeometry)
  if (fillPolygons.length === 0) {
    return null
  }

  const allClipPoints = [...strokePaths.flat(), ...fillPolygons.flat()]
  const padding = Math.max(
    4,
    authoredStroke.width * Math.max(4, authoredStroke.miterLimit * 2)
  )
  const boundsPolygon = buildBoundsPolygonFromPoints(allClipPoints, padding)
  if (!boundsPolygon) {
    return null
  }

  const clipPolygons = [
    orientPolygonAsOuter(boundsPolygon),
    ...fillPolygons.map(orientPolygonAsHole)
  ]

  return {
    polygons: clipPolygons,
    renderDescriptor: {
      clipPolygons,
      strokePaths,
      strokePathStyle: {
        width: authoredStroke.width * 2,
        cap: authoredStroke.cap === 'square' ? 'butt' : authoredStroke.cap,
        join: authoredStroke.join,
        miterLimit: authoredStroke.miterLimit,
        closed: false
      }
    }
  }
}

const buildInsideDoubledCenterDashedStrokeProductPolygons = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  intervals: VisibleDashedTopologyInterval[],
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
  slicingContext: SourcePathSlicingContext,
  implicitFillRegions: PolygonRegion[]
) => {
  if (
    authoredStroke.position !== 'inside' ||
    implicitFillRegions.length === 0 ||
    intervals.length === 0 ||
    intervals.some(isSourceSpanProductDomainVisibleInterval)
  ) {
    return []
  }

  const subjectPolygons = intervals.flatMap((interval) =>
    buildInsideDoubledCenterDashedIntervalSubjectPolygons(
      path,
      interval,
      authoredStroke,
      slicingContext
    )
  )
  if (subjectPolygons.length === 0) {
    return []
  }

  try {
    const backend = getGeometryBackend()
    if (!backend.capabilities.intersection) {
      return []
    }
    const subjectRegions = toCoveragePolygonRegions(subjectPolygons)
    const fillRegions = implicitFillRegions
    const clippedSubjectRegions = backend.intersection(
      subjectRegions,
      fillRegions,
      'nonzero'
    )
    const normalizedClippedSubjectRegions = backend.capabilities.union
      ? backend.union(clippedSubjectRegions, 'nonzero')
      : clippedSubjectRegions
    return getCoveragePolygonsFromRegions(
      normalizedClippedSubjectRegions.length > 0
        ? normalizedClippedSubjectRegions
        : clippedSubjectRegions
    )
      .map(cleanPolygon)
      .filter(hasPolygonGeometry)
  } catch {
    return []
  }
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
  if (
    authoredStroke.position === 'inside' &&
    path.closed &&
    clipInsideToFillDomain &&
    implicitFillRegions.length > 0 &&
    !isSourceSpanProductDomainVisibleInterval(interval)
  ) {
    return measureStrokePipelinePhase(
      'constrained dashed final coverage: doubled center inside clip',
      () =>
        buildInsideDoubledCenterDashedIntervalProductPolygons(
          path,
          interval,
          authoredStroke,
          slicingContext,
          implicitFillRegions
        )
    )
  }

  const polygons: Vec2[][] = []

  measureStrokePipelinePhase(
    'constrained dashed final coverage: ranges',
    () => {
      for (const {
        range,
        span,
        renderRange,
        capOwnership
      } of intervalSweep.ranges) {
        appendDashedSourcePathFinalCoverageRangePolygons(
          polygons,
          path,
          topology,
          {
            range,
            span,
            renderRange,
            capOwnership
          },
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

  const normalizedPolygons = measureStrokePipelinePhase(
    'constrained dashed final coverage: normalize',
    () =>
      normalizePerInterval && topology.topologyFamily === 'self-intersecting'
        ? normalizeConstrainedDashedProductVisualPolygons(polygons)
        : polygons
  )
  const shouldClipToImplicitFillDomain =
    clipInsideToFillDomain &&
    !isSourceSpanProductDomainVisibleInterval(interval) &&
    !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
    !(
      authoredStroke.position === 'outside' &&
      interval.intervalId.includes(':smooth-source-continuity:')
    ) &&
    (authoredStroke.position === 'inside' ||
      topology.topologyFamily !== 'self-intersecting' ||
      (strokeDomainPlan?.sideAuthority === 'implicit-fill-hole-domain' &&
        authoredStroke.position === 'outside'))

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
          dropEmptyInsideClipResult: authoredStroke.position === 'inside'
        }
      )
  )

  if (
    authoredStroke.position !== 'outside' ||
    clippedPolygons.length === 0 ||
    implicitFillRegions.length === 0
  ) {
    return clippedPolygons
  }

  return measureStrokePipelinePhase(
    'constrained dashed final coverage: outside cleanup clip',
    () =>
      clipSourcePathPolygonsToEvenOddLegalDomain(
        clippedPolygons,
        path,
        authoredStroke,
        [],
        {
          fragmentStitchRadius: 0,
          fragmentPruneArea: Math.max(
            1,
            authoredStroke.width * authoredStroke.width * 0.1
          )
        }
      )
  )
}

const isConstrainedDashedProductVisualCompilerEnabled = (
  options: ConstrainedDashedStrokeOptions
) => options.enableProductVisualCompiler === true

export const buildConstrainedDashedStrokeProductVisualEntries = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedDashedStrokeOptions = {}
): SolidCenterStrokeRenderEntry[] | null => {
  if (!isConstrainedDashedProductVisualCompilerEnabled(options)) {
    return null
  }

  const sourcePath = options.sourcePath
  const hasImplicitFillDomain = (options.implicitFillRegions?.length ?? 0) > 0
  if (
    !sourcePath ||
    ((!sourcePath.closed || !closed) && !hasImplicitFillDomain)
  ) {
    return null
  }

  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const sourceTopology =
    !topology.closed &&
    (hasImplicitFillDomain ||
      (options.sharedSourceSplitRanges?.length ?? 0) > 0 ||
      (options.sharedStrokeBoundaryDomains?.length ?? 0) > 0)
      ? 'self-intersecting'
      : classifyConstrainedDashedSource(
          topologyPoints,
          topology.closed,
          topology
        )
  const usesOpenSelfIntersectingImplicitDomain =
    !topology.closed && !topology.isSimpleOpen && hasImplicitFillDomain
  const _usesOpenImplicitFillDomain = !topology.closed && hasImplicitFillDomain
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  let sharpGuardVerticesCache: SharpGuardVertex[] | null = null
  const getSharpGuardVertices = () => {
    if (!sharpGuardVerticesCache) {
      sharpGuardVerticesCache =
        topology.closed && sourceTopology !== 'degenerate'
          ? buildSharpGuardVertices(
              topologyPoints,
              segmentRanges,
              options.selectedSideGuardPoints,
              sourcePath,
              false
            )
          : []
    }
    return sharpGuardVerticesCache
  }
  let slicingContextCache: SourcePathSlicingContext | null = null
  const getSlicingContext = () => {
    if (!slicingContextCache) {
      slicingContextCache = createSourcePathSlicingContext(
        sourcePath,
        options.visualOnly === true
          ? DRAG_SOURCE_PATH_DASH_SLICE_TOLERANCE
          : SOURCE_PATH_DASH_SLICE_TOLERANCE,
        options.visualOnly === true
          ? DRAG_SOURCE_PATH_DASH_SLICE_SAMPLING
          : SOURCE_PATH_DASH_SLICE_SAMPLING,
        options.visualOnly === true
          ? DRAG_ROUND_CAP_VISUAL_MAX_LENGTH
          : ROUND_CAP_VISUAL_MAX_LENGTH
      )
    }
    return slicingContextCache
  }
  const ownerPrefix =
    options.metadata?.ownerKeyPrefix ?? 'anonymous-constrained-dashed-source'
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const renderableStrokes = getRenderableStrokes(strokes)
  const entries: SolidCenterStrokeRenderEntry[] = []

  for (
    let strokeIndex = 0;
    strokeIndex < renderableStrokes.length;
    strokeIndex += 1
  ) {
    const stroke = renderableStrokes[strokeIndex]
    if (
      !supportsConstrainedDashedStroke(stroke, topology.closed) ||
      (stroke.position !== 'inside' && stroke.position !== 'outside')
    ) {
      return null
    }
    const strokeDomainPlan = measureStrokePipelinePhase(
      'constrained dashed product visual entries: resolve domains',
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
      'constrained dashed product visual entries: visible intervals',
      () =>
        getConstrainedDashedVisibleIntervals(
          topology,
          stroke,
          sourcePath,
          strokeDomainPlan,
          {}
        )
    )
    const visibleIntervals = measureStrokePipelinePhase(
      'constrained dashed product visual entries: interval continuity',
      () =>
        replaceOutsideSmoothSourceVertexContinuityIntervals(
          allocatedVisibleIntervals,
          sourcePath,
          {
            position: stroke.position,
            width: stroke.width
          }
        )
    )
    if (visibleIntervals.length === 0) {
      continue
    }

    const hasSourceSpanProductDomains =
      stroke.position === 'inside' &&
      strokeDomainPlan.diagnostics.includes('source-span-product-domains-added')
    if (options.visualOnly === true && hasSourceSpanProductDomains) {
      continue
    }

    if (options.visualOnly === true) {
      const hasSourceSpanProductIntervals =
        stroke.position === 'inside' &&
        visibleIntervals.some(isSourceSpanProductDomainVisibleInterval)
      const canUseOutsideProductMaskDescriptor = stroke.position === 'outside'
      const visualSlicingContext = hasSourceSpanProductIntervals
        ? null
        : getSlicingContext()
      const descriptor =
        visualSlicingContext === null
          ? null
          : stroke.position === 'inside'
            ? buildInsideDoubledCenterDashedRenderMaskDescriptor(
                sourcePath,
                visibleIntervals,
                stroke,
                visualSlicingContext,
                options.implicitFillRegions ?? [],
                usesOpenSelfIntersectingImplicitDomain
              )
            : canUseOutsideProductMaskDescriptor
              ? buildOutsideDoubledCenterDashedRenderMaskDescriptor(
                  sourcePath,
                  visibleIntervals,
                  stroke,
                  visualSlicingContext,
                  options.implicitFillRegions ?? [],
                  getCoveragePolygonsFromRegions(
                    options.implicitFillRegions ?? []
                  ),
                  true
                )
              : null

      if (descriptor) {
        const geometryId = `${cachePrefix}:${strokeIndex}:product-visual-mask`
        const classification = {
          sourceTopology,
          intervalTopology: 'other',
          acceptsFullLoopRoundJoin: true,
          acceptsSingleEdgeRoundCap: true,
          acceptsCornerSpanningJoin: true
        } satisfies ConstrainedDashedIntervalClassification
        const revisionSet = buildStrokeRuntimeRevisionSet({
          points: topologyPoints,
          closed: topology.closed,
          stroke,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'accepted',
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          intervalSignature: buildVisibleIntervalSignature(visibleIntervals),
          sourceTopology: classification.sourceTopology,
          intervalTopology: classification.intervalTopology,
          previewMode: 'drag-visual'
        })
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          contourId,
          intervalId: 'product-visual-mask',
          strokePosition: stroke.position,
          ownerSet: options.metadata?.ownerSet,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'accepted',
          sourceTopology: classification.sourceTopology,
          topologyFamily: topology.topologyFamily,
          intervalTopology: classification.intervalTopology,
          finalCoverageBuilderStatus: 'product-final',
          intervalSweepSpanCount: visibleIntervals.length,
          figmaLikeSplitRangeTerminals:
            buildFigmaLikeSplitRangeTerminalDebugRecords(visibleIntervals),
          terminalCapCount:
            stroke.cap === 'round' ? visibleIntervals.length * 2 : undefined,
          revisionSet
        }

        entries.push({
          cacheKey: geometryId,
          stroke: {
            kind: stroke.kind,
            color: stroke.color,
            alpha: stroke.alpha,
            gradientStyle: stroke.gradientStyle,
            paintKey: stroke.paintKey
          },
          polygons: descriptor.polygons,
          fillClipPolygons:
            'fillClipPolygons' in descriptor.renderDescriptor
              ? descriptor.renderDescriptor.fillClipPolygons
              : undefined,
          clipPolygons:
            'clipPolygons' in descriptor.renderDescriptor
              ? descriptor.renderDescriptor.clipPolygons
              : undefined,
          strokePaths: descriptor.renderDescriptor.strokePaths,
          strokePathStyle: descriptor.renderDescriptor.strokePathStyle,
          debugMeta,
          revisionSet
        })
        emitStrokePipelineCounter(
          `constrained-dashed-${stroke.position}-mask-visual-entry`
        )
        continue
      }
    }

    const intervalStroke = getIntervalStrokeForSourceDirection(
      topologyPoints,
      topology.closed,
      stroke,
      topology.topologyFamily
    )
    const slicingContext = getSlicingContext()
    const squareCapPhysicalStroke =
      stroke.cap === 'square'
        ? {
            ...stroke,
            ...intervalStroke,
            cap: 'butt' as const
          }
        : {
            ...stroke,
            ...intervalStroke,
            cap: stroke.cap
          }
    const sourceVertexBoundaryJoinRecords =
      buildOutsideSourceVertexBoundaryJoinRecords(
        sourcePath,
        allocatedVisibleIntervals,
        {
          position: intervalStroke.position,
          width: intervalStroke.width,
          join: stroke.join,
          miterLimit: stroke.miterLimit,
          dashPattern: stroke.dashPattern,
          dashOffset: stroke.dashOffset
        },
        {
          includeOppositeSourceSideCandidates:
            options.clipInsideToFillDomain === true &&
            (options.implicitFillRegions?.length ?? 0) > 0,
          implicitFillRegions: options.implicitFillRegions,
          physicalSpansByIntervalId: new Map(
            allocatedVisibleIntervals.map((interval) => [
              interval.intervalId,
              getIntervalPhysicalSpans(topology, stroke, interval)
            ])
          )
        }
      )
    const hasSourceVertexBoundaryJoinRecords =
      sourceVertexBoundaryJoinRecords.length > 0
    const intervalProductPolygons = visibleIntervals.flatMap((interval) => {
      const physicalSpans = getIntervalPhysicalSpans(topology, stroke, interval)
      const intervalAuthoredStroke = resolveOutsideBoundaryIntervalJoinStroke(
        interval,
        stroke
      )
      const intervalPhysicalStroke = resolveOutsideBoundaryIntervalJoinStroke(
        interval,
        squareCapPhysicalStroke
      )
      const intervalSweep = buildDashedSourcePathIntervalSweep(
        sourcePath,
        physicalSpans,
        interval,
        intervalAuthoredStroke,
        intervalPhysicalStroke,
        slicingContext
      )
      const finalCoveragePolygons = buildDashedSourcePathFinalCoveragePolygons(
        sourcePath,
        topology,
        intervalSweep,
        interval,
        intervalAuthoredStroke,
        intervalStroke,
        getSharpGuardVertices(),
        slicingContext,
        strokeDomainPlan,
        options.clipInsideToFillDomain === true,
        options.implicitFillRegions ?? [],
        options.visualOnly !== true,
        options.sharedStrokeBoundaryDomains ?? []
      )
      const sourceVertexJoinPolygons =
        hasSourceVertexBoundaryJoinRecords ||
        interval.intervalId.includes(':smooth-source-continuity:')
          ? []
          : buildSourcePathIntervalJoinPolygons(sourcePath, physicalSpans, {
              position: intervalStroke.position,
              width: intervalStroke.width,
              join: intervalAuthoredStroke.join,
              miterLimit: stroke.miterLimit
            })
      const constrainedSourceVertexJoinPolygons =
        stroke.position === 'inside' &&
        options.clipInsideToFillDomain === true &&
        sourceVertexJoinPolygons.length > 0
          ? clipSourcePathPolygonsToEvenOddLegalDomain(
              sourceVertexJoinPolygons,
              sourcePath,
              stroke,
              options.implicitFillRegions ?? [],
              {
                fragmentPruneArea: EPSILON * 10,
                cleanupMicroEdgeTolerance: 0.001,
                cleanupCollinearTolerance: 0.0001
              }
            )
          : sourceVertexJoinPolygons

      return [...finalCoveragePolygons, ...constrainedSourceVertexJoinPolygons]
    })
    const constrainedIntervalProductPolygons = intervalProductPolygons
    const sourceVertexBoundaryJoinPolygons =
      sourceVertexBoundaryJoinRecords.flatMap((joinRecord) =>
        keepOutsideMiterSourceVertexJoinApexFragments(
          options.clipInsideToFillDomain === true &&
            options.implicitFillRegions &&
            options.implicitFillRegions.length > 0
            ? clipSourcePathPolygonsToEvenOddLegalDomain(
                joinRecord.polygons,
                sourcePath,
                { position: stroke.position },
                options.implicitFillRegions,
                {
                  fragmentStitchRadius:
                    stroke.position === 'outside' && stroke.join === 'round'
                      ? Math.max(0.5, intervalStroke.width * 0.05)
                      : 0,
                  fragmentPruneArea:
                    stroke.position === 'outside'
                      ? stroke.join === 'round'
                        ? 0
                        : EPSILON * 10
                      : Math.max(
                          1,
                          intervalStroke.width * intervalStroke.width * 0.1
                        ),
                  cleanupMicroEdgeTolerance: 0.001,
                  cleanupCollinearTolerance: 0.0001
                }
              )
            : joinRecord.polygons,
          joinRecord.polygons,
          joinRecord.vertex,
          {
            position: stroke.position,
            width: intervalStroke.width,
            join: stroke.join
          }
        ).map((polygon) =>
          stroke.join === 'round'
            ? densifyRoundSourceVertexJoinPolygon(
                polygon,
                joinRecord.vertex,
                intervalStroke.width
              )
            : polygon
        )
      )
    const combinedPolygons = [
      ...constrainedIntervalProductPolygons,
      ...sourceVertexBoundaryJoinPolygons
    ]
    const hasOpenDanglingOutsideBothSidesIntervals = visibleIntervals.some(
      isOpenDanglingOutsideBothSidesVisibleInterval
    )
    const outsideLegalCombinedPolygons =
      stroke.position === 'outside' &&
      options.clipInsideToFillDomain === true &&
      options.implicitFillRegions &&
      options.implicitFillRegions.length > 0 &&
      !hasOpenDanglingOutsideBothSidesIntervals &&
      combinedPolygons.length > 0
        ? clipSourcePathPolygonsToEvenOddLegalDomain(
            combinedPolygons,
            sourcePath,
            { position: stroke.position },
            options.implicitFillRegions,
            {
              fragmentStitchRadius:
                stroke.join === 'round'
                  ? Math.max(0.5, intervalStroke.width * 0.05)
                  : 0,
              fragmentPruneArea: 0,
              cleanupMicroEdgeTolerance: 0.001,
              cleanupCollinearTolerance: 0.0001
            }
          )
        : combinedPolygons
    const visualPolygons =
      options.visualOnly === true
        ? outsideLegalCombinedPolygons
            .map((polygon) =>
              cleanClippedProductPolygon(polygon, {
                cleanupMicroEdgeTolerance:
                  DRAG_PRODUCT_VISUAL_MICRO_EDGE_TOLERANCE,
                cleanupCollinearTolerance:
                  DRAG_PRODUCT_VISUAL_COLLINEAR_TOLERANCE
              })
            )
            .filter(
              (polygon) =>
                polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPSILON
            )
        : outsideLegalCombinedPolygons
    const sourceVertexRoundDensifiedVisualPolygons =
      stroke.position === 'outside' && stroke.join === 'round'
        ? densifyRoundSourceVertexJoinPolygons(
            visualPolygons,
            getSourceVertexRecords(sourcePath).map((record) => record.vertex),
            intervalStroke.width
          )
        : visualPolygons
    const polygons = normalizeConstrainedDashedProductVisualPolygons(
      sourceVertexRoundDensifiedVisualPolygons
    )
    const clipPolygons = getInsideSourcePathEvenOddLegalClipPolygons(
      sourcePath,
      stroke,
      options.implicitFillRegions ?? []
    )
    const fillPolygons = polygons
    if (polygons.length === 0) {
      continue
    }

    const geometryId = `${cachePrefix}:${strokeIndex}:product-visual`
    const classification = {
      sourceTopology,
      intervalTopology: 'other',
      acceptsFullLoopRoundJoin: true,
      acceptsSingleEdgeRoundCap: true,
      acceptsCornerSpanningJoin: true
    } satisfies ConstrainedDashedIntervalClassification
    const revisionSet = buildStrokeRuntimeRevisionSet({
      points: topologyPoints,
      closed: topology.closed,
      stroke,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: getConstrainedDashedResolutionStatus(
        classification.sourceTopology,
        classification.intervalTopology,
        !topology.closed && !topology.isSimpleOpen
      ),
      runtimeStatus: 'accepted',
      ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
      networkId: options.metadata?.networkId,
      strokeId: `stroke:${strokeIndex}`,
      intervalSignature: '',
      sourceTopology: classification.sourceTopology,
      intervalTopology: classification.intervalTopology,
      previewMode: options.visualOnly === true ? 'drag-visual' : 'exact'
    })
    const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
      sourcePathId: cachePrefix,
      ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
      networkId: options.metadata?.networkId,
      strokeId: `stroke:${strokeIndex}`,
      strokeIndex,
      contourId,
      intervalId: 'product-visual',
      strokePosition: stroke.position,
      ownerSet: options.metadata?.ownerSet,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: getConstrainedDashedResolutionStatus(
        classification.sourceTopology,
        classification.intervalTopology,
        !topology.closed && !topology.isSimpleOpen
      ),
      runtimeStatus: 'accepted',
      sourceTopology: classification.sourceTopology,
      topologyFamily: topology.topologyFamily,
      intervalTopology: classification.intervalTopology,
      finalCoverageBuilderStatus: 'product-final',
      intervalSweepSpanCount: visibleIntervals.length,
      figmaLikeSplitRangeTerminals:
        buildFigmaLikeSplitRangeTerminalDebugRecords(visibleIntervals),
      terminalCapCount:
        stroke.cap === 'round' ? visibleIntervals.length * 2 : undefined,
      revisionSet
    }

    entries.push({
      cacheKey: geometryId,
      stroke: {
        kind: stroke.kind,
        color: stroke.color,
        alpha: stroke.alpha,
        gradientStyle: stroke.gradientStyle,
        paintKey: stroke.paintKey
      },
      polygons,
      fillPolygons: fillPolygons.length > 0 ? fillPolygons : undefined,
      clipPolygons,
      debugMeta,
      revisionSet
    })
  }

  return entries
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
  return regions
}

interface LegalClipPolygonModel {
  polygon: Vec2[]
  bounds: Bounds
}

const legalClipPolygonModelCache = new WeakMap<
  PolygonRegion[],
  LegalClipPolygonModel[]
>()

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
  const polygonBounds = getBounds([polygon])
  return legalModels.some((model) => {
    if (
      polygonBounds.minX < model.bounds.minX - EPSILON ||
      polygonBounds.maxX > model.bounds.maxX + EPSILON ||
      polygonBounds.minY < model.bounds.minY - EPSILON ||
      polygonBounds.maxY > model.bounds.maxY + EPSILON
    ) {
      return false
    }
    if (
      !polygon.every((point) => isPointInsideOrOnPolygon(point, model.polygon))
    ) {
      return false
    }
    if (polygonEdgesCrossBoundary(polygon, model.polygon)) {
      return false
    }
    if (
      model.polygon.some(
        (point) =>
          !isPointOnPolygonBoundary(point, polygon) &&
          isPointInsidePolygonEvenOdd(point, polygon)
      )
    ) {
      return false
    }
    return true
  })
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

const cleanClippedProductPolygons = (
  polygons: Vec2[][],
  options: ClippedProductCleanupOptions = {}
) =>
  polygons
    .map((polygon) => cleanClippedProductPolygon(polygon, options))
    .filter(hasPolygonGeometry)

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
      pointSegmentDistanceSquaredToPolygon(point, legalPolygon) <= 0.25
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
      if (
        implicitFillRegions.length > 0 &&
        canSkipInsideLegalClip(normalizedSubjectPolygons, legalClipRegions)
      ) {
        emitStrokePipelineCounter('inside-legal-clip-noop-skip')
        return normalizedSubjectPolygons
      }

      const directClippedPolygons = getCoveragePolygonsFromRegions(
        backend.intersection(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          'nonzero'
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      if (directClippedPolygons.length <= 1) {
        if (directClippedPolygons.length > 0) {
          return directClippedPolygons
        }
        return options.dropEmptyInsideClipResult ? [] : subjectPolygons
      }

      const unionedClippedPolygons = getCoveragePolygonsFromRegions(
        backend.union(
          toCoveragePolygonRegions(directClippedPolygons),
          'nonzero'
        )
      )
        .map(cleanPolygon)
        .filter(hasPolygonGeometry)

      return unionedClippedPolygons.length > 0
        ? unionedClippedPolygons
        : directClippedPolygons
    }

    const clipOperation = backend.difference.bind(backend)
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
          'nonzero'
        )
      ),
      'nonzero'
    )
    if (directClippedPolygons.length > 0) {
      if (!shouldNormalizeClipResidue) {
        return directClippedPolygons
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
        return finalizeClipResultPolygons(stitchedDirectPolygons, 'nonzero')
      }

      if (directClippedPolygons.length <= 1) {
        return directClippedPolygons
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
        return finalizeClipResultPolygons(
          prunedUnionedDirectPolygons,
          'nonzero'
        )
      }

      const stitchedUnionedDirectPolygons = stitchClippedProductFragments(
        prunedUnionedDirectPolygons,
        options.fragmentStitchRadius ?? 0
      )
      return finalizeClipResultPolygons(
        stitchedUnionedDirectPolygons.length > 0
          ? stitchedUnionedDirectPolygons
          : prunedUnionedDirectPolygons,
        'nonzero'
      )
    }

    const clippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        clipOperation(
          toCoveragePolygonRegions(normalizedSubjectPolygons),
          legalClipRegions,
          'nonzero'
        )
      ),
      'nonzero'
    )
    if (clippedPolygons.length <= 1) {
      return clippedPolygons
    }
    if (!shouldNormalizeClipResidue) {
      return clippedPolygons
    }

    const prunedClippedPolygons = pruneSmallClippedProductFragments(
      clippedPolygons,
      options.fragmentPruneArea ?? 0
    )

    const stitchedClippedPolygons = stitchClippedProductFragments(
      prunedClippedPolygons,
      options.fragmentStitchRadius ?? 0
    )
    if (
      stitchedClippedPolygons.length === 1 ||
      prunedClippedPolygons.length === 1
    ) {
      return finalizeClipResultPolygons(stitchedClippedPolygons, 'nonzero')
    }

    const unionedClippedPolygons = finalizeClipResultPolygons(
      getCoveragePolygonsFromRegions(
        backend.union(
          toCoveragePolygonRegions(prunedClippedPolygons),
          'nonzero'
        )
      ),
      'nonzero'
    )
    const prunedUnionedClippedPolygons = pruneSmallClippedProductFragments(
      unionedClippedPolygons,
      options.fragmentPruneArea ?? 0
    )
    if (prunedUnionedClippedPolygons.length === 1) {
      return finalizeClipResultPolygons(prunedUnionedClippedPolygons, 'nonzero')
    }

    const stitchedUnionedClippedPolygons = stitchClippedProductFragments(
      prunedUnionedClippedPolygons,
      options.fragmentStitchRadius ?? 0
    )
    return finalizeClipResultPolygons(
      stitchedUnionedClippedPolygons.length > 0
        ? stitchedUnionedClippedPolygons
        : prunedUnionedClippedPolygons,
      'nonzero'
    )
  } catch {
    emitStrokePipelineCounter('source-path-legal-clip-error')
    return []
  }
}

const getInsideSourcePathEvenOddLegalClipPolygons = (
  path: SourcePathWithOptionalSamples,
  stroke: Pick<RenderableStroke, 'position'>,
  implicitFillRegions: PolygonRegion[] = []
) => {
  if (stroke.position !== 'inside' || !path.closed) {
    return undefined
  }

  if (implicitFillRegions.length > 0) {
    try {
      const backend = getGeometryBackend()
      const clipPolygons = getCoveragePolygonsFromRegions(
        backend.capabilities.union
          ? backend.union(implicitFillRegions, 'nonzero')
          : implicitFillRegions
      )
      return clipPolygons.length > 0 ? clipPolygons : undefined
    } catch {
      return undefined
    }
  }

  const legalPoints = getSourcePathEvenOddLegalPoints(path)
  if (legalPoints.length < 3 || Math.abs(polygonArea(legalPoints)) <= EPSILON) {
    return undefined
  }

  const clipPolygons = getCoveragePolygonsFromRegions([
    { polygons: [legalPoints] }
  ])

  return clipPolygons.length > 0 ? clipPolygons : undefined
}

const normalizeConstrainedDashedProductVisualPolygons = (
  polygons: Vec2[][],
  options: { cleanClipResidue?: boolean } = {}
) => {
  if (
    options.cleanClipResidue !== true &&
    polygons.length > 0 &&
    polygons.every(hasPolygonGeometry) &&
    !polygonsHaveOverlappingBounds(polygons)
  ) {
    emitStrokePipelineCounter('product-visual-normalize-clean-input-skipped')
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
  if (!polygonsHaveOverlappingBounds(subjectPolygons)) {
    emitStrokePipelineCounter('product-visual-normalize-union-skipped')
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
  if (subjectPolygons.length === 0 || radius <= EPSILON) {
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
    const fallbackDx = point.x - start.x
    const fallbackDy = point.y - start.y
    return fallbackDx * fallbackDx + fallbackDy * fallbackDy
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

const getSelectedSideMaxViolationDistance = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  let maxViolation = 0
  for (const point of polygon) {
    let nearestSignedDistance = 0
    let nearestDistanceSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)
      if (length <= EPSILON) {
        continue
      }
      const distanceToSegmentSquared = pointSegmentDistanceSquared(
        point,
        start,
        end
      )
      if (distanceToSegmentSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceToSegmentSquared
        nearestSignedDistance =
          (dx * (point.y - start.y) - dy * (point.x - start.x)) / length
      }
    }
    const violation =
      selectedSide > 0 ? -nearestSignedDistance : nearestSignedDistance
    maxViolation = Math.max(maxViolation, violation)
  }
  return maxViolation
}

const isFullyOnRejectedSideOfBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return false
  }

  return polygon.every((point) => {
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

    return selectedSide > 0 ? nearestCross < -EPSILON : nearestCross > EPSILON
  })
}

const isFullyOnSelectedSideOfBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return true
  }

  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y

    for (const point of polygon) {
      const cross = dx * (point.y - start.y) - dy * (point.x - start.x)
      if (selectedSide > 0 ? cross < -EPSILON : cross > EPSILON) {
        return false
      }
    }
  }

  return true
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
  fallback: 1 | -1
): 1 | -1 => {
  if (!point || boundary.length < 2) {
    return fallback
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
    return fallback
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
  selectedSide: 1 | -1
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
  if (isFullyOnSelectedSideOfBoundary(polygon, boundary, selectedSide)) {
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

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    selectedSide
  )
  if (
    clipped.length >= 3 &&
    getSelectedSideViolationScore(clipped, boundary, selectedSide) <= EPSILON
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
    getSelectedSideViolationScore(strictClipped, boundary, selectedSide) <=
      EPSILON
  ) {
    return strictClipped
  }

  return isFullyOnRejectedSideOfBoundary(clipped, boundary, selectedSide)
    ? []
    : clipped
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
  const hasImplicitFillDomain = (options.implicitFillRegions?.length ?? 0) > 0
  const sourceTopology =
    !topology.closed &&
    (hasImplicitFillDomain ||
      (options.sharedSourceSplitRanges?.length ?? 0) > 0 ||
      (options.sharedStrokeBoundaryDomains?.length ?? 0) > 0)
      ? 'self-intersecting'
      : classifyConstrainedDashedSource(
          topologyPoints,
          topology.closed,
          topology
        )
  const usesOpenSelfIntersectingImplicitDomain =
    !topology.closed && !topology.isSimpleOpen && hasImplicitFillDomain
  const usesOpenImplicitFillDomain = !topology.closed && hasImplicitFillDomain
  const constrainedDashedVisualMode =
    options.constrainedDashedVisualMode ??
    (options.visualOnly ? 'product-final' : 'debug-raw')
  const segmentRanges = getClosedSegmentRanges(topologyPoints, topology.closed)
  const sourcePaintBounds = getBounds([topologyPoints])
  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, topology.closed)) {
      return []
    }

    const sourcePath = options.sourcePath

    const sharpGuardVertices =
      topology.closed &&
      sourceTopology !== 'degenerate' &&
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
      'constrained dashed candidates: domain plan',
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
      'constrained dashed candidates: interval allocation',
      () =>
        getConstrainedDashedVisibleIntervals(
          topology,
          stroke,
          sourcePath,
          strokeDomainPlan,
          {}
        )
    )
    const visibleIntervals = measureStrokePipelinePhase(
      'constrained dashed candidates: source-vertex continuity',
      () =>
        replaceOutsideSmoothSourceVertexContinuityIntervals(
          allocatedVisibleIntervals,
          sourcePath,
          {
            position: stroke.position,
            width: stroke.width
          }
        )
    )
    const sourceSpanProvenance =
      resolveSourceSpanProvenanceAvailability(options)
    const sourceSpanGraph = sourceSpanProvenance.available
      ? measureStrokePipelinePhase(
          'constrained dashed candidates: source span graph',
          () => buildSourceSpanGraph(topology, visibleIntervals)
        )
      : null
    const intervalSignature = sourceSpanProvenance.available
      ? buildVisibleIntervalSignature(visibleIntervals)
      : ''

    if (visibleIntervals.length === 0) {
      return []
    }

    const intervalStroke = getIntervalStrokeForSourceDirection(
      topologyPoints,
      topology.closed,
      stroke,
      topology.topologyFamily
    )
    const baseRevisionSet = options.visualOnly
      ? undefined
      : buildStrokeRuntimeRevisionSet({
          points: topologyPoints,
          closed: topology.closed,
          stroke,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: 'candidate',
          runtimeStatus: 'candidate',
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          intervalSignature,
          sourceTopology,
          intervalTopology: 'base'
        })
    const revisionSetByClassification = new Map<
      string,
      SolidCenterStrokeGeometryDebugMeta['revisionSet']
    >()
    const getRevisionSet = (
      classification: Pick<
        ConstrainedDashedIntervalClassification,
        'sourceTopology' | 'intervalTopology'
      >
    ) => {
      if (!baseRevisionSet) {
        return undefined
      }
      const revisionKey = [
        classification.sourceTopology,
        classification.intervalTopology
      ].join(':')
      const existing = revisionSetByClassification.get(revisionKey)
      if (existing) {
        return existing
      }

      const revisionSet = updateStrokeRuntimeRevisionSetFromMetadata(
        baseRevisionSet,
        {
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'candidate',
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          sourceTopology: classification.sourceTopology,
          intervalTopology: classification.intervalTopology,
          closed: topology.closed
        }
      )
      revisionSetByClassification.set(revisionKey, revisionSet)
      return revisionSet
    }

    const [fullLoopInterval] =
      visibleIntervals.length === 1 ? visibleIntervals : []

    if (
      topology.closed &&
      fullLoopInterval &&
      isFullLoopVisibleInterval(
        fullLoopInterval.startDistance,
        fullLoopInterval.endDistance,
        totalLength,
        fullLoopInterval.wrapsSeam
      )
    ) {
      const classification = classifyConstrainedDashedIntervalWithContext(
        topologyPoints,
        topology.closed,
        {
          startDistance: fullLoopInterval.startDistance,
          endDistance: fullLoopInterval.endDistance,
          totalLength,
          wrapsSeam: fullLoopInterval.wrapsSeam
        },
        stroke,
        sourceTopology,
        segmentRanges
      )

      const solidStroke = {
        ...stroke,
        style: 'solid' as const,
        cap: 'butt' as const
      }
      const candidatePolygons = buildExactArrangementCandidatePolygons(
        topologyPoints,
        true,
        solidStroke,
        sourcePath,
        options.selectedSideGuardPoints,
        topology.fillRule
      )
      const candidateFacePolygons = candidatePolygons.map(
        (candidate) => candidate.polygon
      )
      const polygons =
        stroke.position === 'inside'
          ? clampPolygonPointsToBounds(
              candidateFacePolygons,
              getBounds([topologyPoints])
            )
          : candidateFacePolygons

      if (polygons.length === 0) {
        return []
      }

      const intervalSourceSpanIds =
        options.metadata?.sourceSpanIds ??
        (sourceSpanGraph
          ? getSourceSpanIdsForInterval(sourceSpanGraph, fullLoopInterval)
          : [])

      return polygons.map((polygon, candidateIndex) => {
        const candidateRecord = candidatePolygons[candidateIndex]
        const geometryId = `${cachePrefix}:${strokeIndex}:${fullLoopInterval.intervalId}:candidate:${candidateIndex}`
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          contourId,
          legalDomainId,
          intervalId: fullLoopInterval.intervalId,
          strokePosition: stroke.position,
          ownerSet: options.metadata?.ownerSet,
          sourceContourIds: options.metadata?.sourceContourIds,
          legalDomainIds: options.metadata?.legalDomainIds,
          sourceSpanIds:
            candidateRecord?.sourceSpanIds ?? intervalSourceSpanIds,
          authoredVisibleIntervalIndex:
            candidateRecord?.sourceSegmentIndex ??
            candidateRecord?.sourceVertexIndex ??
            fullLoopInterval.authoredIndex,
          startDistance: fullLoopInterval.startDistance,
          endDistance: fullLoopInterval.endDistance,
          wrapsSeam: fullLoopInterval.wrapsSeam,
          previousVisibleIntervalId: fullLoopInterval.previousVisibleIntervalId,
          nextVisibleIntervalId: fullLoopInterval.nextVisibleIntervalId,
          geometryFamily: 'constrained-dashed',
          resolutionStatus: getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          ),
          runtimeStatus: 'candidate',
          sourceTopology: classification.sourceTopology,
          topologyFamily: topology.topologyFamily,
          intervalTopology: classification.intervalTopology,
          paintBounds: sourcePaintBounds,
          revisionSet: getRevisionSet(classification)
        }

        return {
          geometry: {
            geometryId,
            polygons: [polygon],
            bounds: getBounds([polygon]),
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
      })
    }

    const sourcePathSlicingContext = sourcePath
      ? createSourcePathSlicingContext(sourcePath)
      : undefined
    const boundaryDomainPathCacheByKey = new Map<string, PathGeometry | null>()
    const getBoundaryDomainPathForVisibleInterval = (
      interval: VisibleDashedTopologyInterval
    ) => {
      const cacheKey = getBoundaryDomainPathCacheKey(interval)
      if (!cacheKey) {
        return buildBoundaryDomainPathForInterval(interval)
      }

      if (boundaryDomainPathCacheByKey.has(cacheKey)) {
        return boundaryDomainPathCacheByKey.get(cacheKey) ?? null
      }

      const path = buildBoundaryDomainPathForInterval(interval)
      boundaryDomainPathCacheByKey.set(cacheKey, path)
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

      const context = createSourcePathSlicingContext(boundaryDomainPath)
      boundaryDomainSlicingContextCache.set(boundaryDomainPath, context)
      return context
    }
    const sourcePathSampledSimpleClassification =
      !options.visualOnly &&
      sourcePath &&
      sourceTopology === 'sampled-simple-closed'
        ? classifySourcePathSampledSimpleDashedInterval(sourceTopology)
        : null
    const usesExactInsideSourcePathStroke =
      sourcePath && stroke.position === 'inside' && sourcePath.closed === true
    const closedIntervalLegalityContext = usesExactInsideSourcePathStroke
      ? null
      : buildClosedIntervalLegalityContext(
          topologyPoints,
          topology.closed,
          stroke
        )
    const intervalPointSlicer = sourcePath
      ? null
      : createStrokeIntervalPointSlicer(topologyPoints, topology.closed)
    const canSkipInteriorSourcePathBoundaryClipping =
      options.visualOnly === true
    const canUseProductFinalIntervalClassification =
      constrainedDashedVisualMode === 'product-final' &&
      sourcePath &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      sourcePath.closed === true &&
      sourceTopology === 'self-intersecting'
    const productFinalIntervalClassification: ConstrainedDashedIntervalClassification | null =
      canUseProductFinalIntervalClassification
        ? {
            sourceTopology,
            intervalTopology: 'other',
            acceptsFullLoopRoundJoin: true,
            acceptsSingleEdgeRoundCap: true,
            acceptsCornerSpanningJoin: true
          }
        : null
    const sourceVertexBoundaryJoinRecords =
      productFinalIntervalClassification !== null &&
      sourcePath &&
      options.visualOnly !== true
        ? buildOutsideSourceVertexBoundaryJoinRecords(
            sourcePath,
            allocatedVisibleIntervals,
            {
              position: intervalStroke.position,
              width: intervalStroke.width,
              join: stroke.join,
              miterLimit: stroke.miterLimit,
              dashPattern: stroke.dashPattern,
              dashOffset: stroke.dashOffset
            },
            {
              includeOppositeSourceSideCandidates:
                options.clipInsideToFillDomain === true &&
                (options.implicitFillRegions?.length ?? 0) > 0,
              implicitFillRegions: options.implicitFillRegions,
              physicalSpansByIntervalId: new Map(
                allocatedVisibleIntervals.map((interval) => [
                  interval.intervalId,
                  getIntervalPhysicalSpans(topology, stroke, interval)
                ])
              )
            }
          )
        : []
    const hasSourceVertexBoundaryJoinRecords =
      sourceVertexBoundaryJoinRecords.length > 0

    // Open implicit fill domains must keep per-interval product output:
    // a single inside mask descriptor can collapse visible dash gaps and hide
    // separate contour ownership.
    const visibleIntervalById = new Map(
      visibleIntervals.map((interval) => [interval.intervalId, interval])
    )
    const visibleIntervalIndexById = new Map(
      visibleIntervals.map((interval, index) => [interval.intervalId, index])
    )
    const intervalHasStartTerminal = (
      interval: VisibleDashedTopologyInterval
    ) =>
      interval.figmaLikeTerminalRole === 'start' ||
      interval.figmaLikeTerminalRole === 'start-end'
    const intervalHasEndTerminal = (interval: VisibleDashedTopologyInterval) =>
      interval.figmaLikeTerminalRole === 'end' ||
      interval.figmaLikeTerminalRole === 'start-end'

    const getBoundaryTerminalGroupKey = (
      interval: VisibleDashedTopologyInterval,
      terminal: 'start' | 'end'
    ) => {
      const terminalPoint = getBoundaryDomainTerminalPoint(interval, terminal)
      if (!terminalPoint || interval.figmaLikeSelectedSide === undefined) {
        return null
      }

      return [
        interval.figmaLikeSelectedSide,
        interval.figmaLikeBoundaryRole ?? 'unknown',
        getBoundaryDomainTerminalKey(terminalPoint.endpoint)
      ].join('|')
    }

    const coincidentBoundaryTerminalIntervals = new Map<
      string,
      VisibleDashedTopologyInterval[]
    >()
    const pushCoincidentBoundaryTerminalInterval = (
      interval: VisibleDashedTopologyInterval,
      terminal: 'start' | 'end'
    ) => {
      const key = getBoundaryTerminalGroupKey(interval, terminal)
      if (!key) {
        return
      }
      const group = coincidentBoundaryTerminalIntervals.get(key) ?? []
      group.push(interval)
      coincidentBoundaryTerminalIntervals.set(key, group)
    }

    visibleIntervals.forEach((interval) => {
      if (intervalHasStartTerminal(interval)) {
        pushCoincidentBoundaryTerminalInterval(interval, 'start')
      }
      if (intervalHasEndTerminal(interval)) {
        pushCoincidentBoundaryTerminalInterval(interval, 'end')
      }
    })

    const buildFigmaLikeSplitRangeTerminalRecords = (
      interval: VisibleDashedTopologyInterval
    ) => {
      const terminals: NonNullable<
        SolidCenterStrokeGeometryDebugMeta['figmaLikeSplitRangeTerminals']
      > = []
      const seenTerminalKeys = new Set<string>()
      const pushTerminal = (terminal: VisibleDashedTopologyInterval) => {
        if (
          !terminal.figmaLikeSplitRangeId ||
          terminal.figmaLikeSplitRangeStartDistance === undefined ||
          terminal.figmaLikeSplitRangeEndDistance === undefined ||
          !terminal.figmaLikeTerminalRole
        ) {
          return
        }
        const key = [
          terminal.intervalId,
          terminal.figmaLikeSplitRangeId,
          terminal.figmaLikeTerminalRole,
          terminal.startDistance,
          terminal.endDistance
        ].join('|')
        if (seenTerminalKeys.has(key)) {
          return
        }
        seenTerminalKeys.add(key)
        terminals.push({
          intervalId: terminal.intervalId,
          boundaryDomainId: terminal.figmaLikeBoundaryDomainId,
          boundaryPoints: terminal.figmaLikeBoundaryPoints
            ? terminal.figmaLikeBoundaryPoints.map((point) => ({ ...point }))
            : undefined,
          boundaryStartDistance: terminal.figmaLikeBoundaryStartDistance,
          boundaryEndDistance: terminal.figmaLikeBoundaryEndDistance,
          boundaryTotalLength: terminal.figmaLikeBoundaryTotalLength,
          splitRangeId: terminal.figmaLikeSplitRangeId,
          splitRangeStartDistance: terminal.figmaLikeSplitRangeStartDistance,
          splitRangeEndDistance: terminal.figmaLikeSplitRangeEndDistance,
          terminalRole: terminal.figmaLikeTerminalRole,
          startDistance: terminal.startDistance,
          endDistance: terminal.endDistance,
          sourceSegmentIndex: terminal.figmaLikeSplitRangeSourceSegmentIndex,
          selectedSide: terminal.figmaLikeSelectedSide,
          filledSide: terminal.figmaLikeFilledSide,
          unfilledSide: terminal.figmaLikeUnfilledSide,
          boundaryRole: terminal.figmaLikeBoundaryRole
        })
      }

      pushTerminal(interval)

      if (intervalHasStartTerminal(interval)) {
        const key = getBoundaryTerminalGroupKey(interval, 'start')
        if (key) {
          coincidentBoundaryTerminalIntervals
            .get(key)
            ?.forEach((terminal) => pushTerminal(terminal))
        }
      }

      if (intervalHasEndTerminal(interval)) {
        const key = getBoundaryTerminalGroupKey(interval, 'end')
        if (key) {
          coincidentBoundaryTerminalIntervals
            .get(key)
            ?.forEach((terminal) => pushTerminal(terminal))
        }
      }

      const intervalIndex = visibleIntervalIndexById.get(interval.intervalId)
      const previousInterval =
        interval.previousVisibleIntervalId &&
        visibleIntervalById.get(interval.previousVisibleIntervalId)
          ? visibleIntervalById.get(interval.previousVisibleIntervalId)
          : intervalIndex !== undefined && intervalIndex > 0
            ? visibleIntervals[intervalIndex - 1]
            : undefined
      if (
        previousInterval &&
        intervalHasStartTerminal(interval) &&
        intervalHasEndTerminal(previousInterval) &&
        areLoopDistancesEqual(
          previousInterval.endDistance,
          interval.startDistance,
          totalLength
        )
      ) {
        pushTerminal(previousInterval)
      }

      const nextInterval =
        interval.nextVisibleIntervalId &&
        visibleIntervalById.get(interval.nextVisibleIntervalId)
          ? visibleIntervalById.get(interval.nextVisibleIntervalId)
          : intervalIndex !== undefined &&
              intervalIndex < visibleIntervals.length - 1
            ? visibleIntervals[intervalIndex + 1]
            : undefined
      if (
        nextInterval &&
        intervalHasEndTerminal(interval) &&
        intervalHasStartTerminal(nextInterval) &&
        areLoopDistancesEqual(
          nextInterval.startDistance,
          interval.endDistance,
          totalLength
        )
      ) {
        pushTerminal(nextInterval)
      }

      return terminals.length > 0 ? terminals : undefined
    }

    if (
      options.preferRenderMaskProductFinal === true &&
      options.omitDiagnosticMetadata === true &&
      constrainedDashedVisualMode === 'product-final' &&
      productFinalIntervalClassification !== null &&
      sourcePath &&
      sourcePathSlicingContext &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      !usesOpenImplicitFillDomain &&
      options.clipInsideToFillDomain === true &&
      (options.implicitFillRegions?.length ?? 0) > 0
    ) {
      const productMaskDescriptor =
        stroke.position === 'inside'
          ? buildInsideDoubledCenterDashedRenderMaskDescriptor(
              sourcePath,
              visibleIntervals,
              stroke,
              sourcePathSlicingContext,
              options.implicitFillRegions ?? []
            )
          : topology.closed && stroke.cap !== 'square'
            ? buildOutsideDoubledCenterDashedRenderMaskDescriptor(
                sourcePath,
                visibleIntervals,
                stroke,
                sourcePathSlicingContext,
                options.implicitFillRegions ?? [],
                getCoveragePolygonsFromRegions(
                  options.implicitFillRegions ?? []
                ),
                true
              )
            : null
      if (productMaskDescriptor) {
        const geometryId = `${cachePrefix}:${strokeIndex}:product-final`
        const resolutionStatus = getConstrainedDashedResolutionStatus(
          productFinalIntervalClassification.sourceTopology,
          productFinalIntervalClassification.intervalTopology
        )
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          contourId,
          intervalId: 'product-final',
          strokePosition: stroke.position,
          ownerSet: options.metadata?.ownerSet,
          geometryFamily: 'constrained-dashed',
          resolutionStatus,
          runtimeStatus: 'candidate',
          sourceTopology: productFinalIntervalClassification.sourceTopology,
          topologyFamily: topology.topologyFamily,
          intervalTopology: productFinalIntervalClassification.intervalTopology,
          finalCoverageBuilderStatus: 'product-final',
          intervalSweepSpanCount: visibleIntervals.length,
          terminalCapCount: 0,
          paintBounds: sourcePaintBounds,
          revisionSet: getRevisionSet(productFinalIntervalClassification)
        }

        return [
          {
            geometry: {
              geometryId,
              polygons: productMaskDescriptor.polygons,
              bounds: getBounds(productMaskDescriptor.polygons),
              debugMeta,
              renderDescriptor: productMaskDescriptor.renderDescriptor
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
      }

      const productPolygons = measureStrokePipelinePhase(
        'constrained dashed candidates: stroke-level product final',
        () =>
          buildInsideDoubledCenterDashedStrokeProductPolygons(
            sourcePath,
            visibleIntervals,
            stroke,
            sourcePathSlicingContext,
            options.implicitFillRegions ?? []
          )
      )
      if (productPolygons.length > 0) {
        const geometryId = `${cachePrefix}:${strokeIndex}:product-final`
        const resolutionStatus = getConstrainedDashedResolutionStatus(
          productFinalIntervalClassification.sourceTopology,
          productFinalIntervalClassification.intervalTopology
        )
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          contourId,
          intervalId: 'product-final',
          strokePosition: stroke.position,
          ownerSet: options.metadata?.ownerSet,
          geometryFamily: 'constrained-dashed',
          resolutionStatus,
          runtimeStatus: 'candidate',
          sourceTopology: productFinalIntervalClassification.sourceTopology,
          topologyFamily: topology.topologyFamily,
          intervalTopology: productFinalIntervalClassification.intervalTopology,
          finalCoverageBuilderStatus: 'product-final',
          intervalSweepSpanCount: visibleIntervals.length,
          terminalCapCount: 0,
          paintBounds: sourcePaintBounds,
          revisionSet: getRevisionSet(productFinalIntervalClassification)
        }

        return [
          {
            geometry: {
              geometryId,
              polygons: productPolygons,
              bounds: getBounds(productPolygons),
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
      }
    }

    const intervalPackets = measureStrokePipelinePhase(
      'constrained dashed candidates: interval packets',
      () =>
        visibleIntervals.flatMap((interval) => {
          const {
            boundaryDomainPath,
            classification,
            effectiveSourcePath,
            effectiveSourcePathSlicingContext,
            effectiveTopologyForInterval
          } = measureStrokePipelinePhase(
            'constrained dashed interval: setup',
            () => {
              const resolvedBoundaryDomainPath =
                !isOpenDanglingOutsideBothSidesVisibleInterval(interval)
                  ? getBoundaryDomainPathForVisibleInterval(interval)
                  : null
              const boundaryDomainClassification: ConstrainedDashedIntervalClassification | null =
                resolvedBoundaryDomainPath
                  ? {
                      sourceTopology: 'self-intersecting',
                      intervalTopology: 'other',
                      acceptsFullLoopRoundJoin: false,
                      acceptsSingleEdgeRoundCap: false,
                      acceptsCornerSpanningJoin: false
                    }
                  : null
              const resolvedClassification = options.visualOnly
                ? null
                : (boundaryDomainClassification ??
                  productFinalIntervalClassification ??
                  sourcePathSampledSimpleClassification ??
                  (sourcePath && sourceTopology === 'sampled-simple-closed'
                    ? classifySourcePathSampledSimpleDashedInterval(
                        sourceTopology
                      )
                    : classifyConstrainedDashedIntervalWithContext(
                        topologyPoints,
                        topology.closed,
                        {
                          startDistance: interval.startDistance,
                          endDistance: interval.endDistance,
                          totalLength,
                          wrapsSeam: interval.wrapsSeam
                        },
                        stroke,
                        sourceTopology,
                        segmentRanges
                      )))
              const resolvedEffectiveSourcePath =
                resolvedBoundaryDomainPath ?? sourcePath
              const resolvedEffectiveSourcePathSlicingContext =
                resolvedBoundaryDomainPath
                  ? getBoundaryDomainSlicingContext(resolvedBoundaryDomainPath)
                  : sourcePathSlicingContext
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
                classification: resolvedClassification,
                effectiveSourcePath: resolvedEffectiveSourcePath,
                effectiveSourcePathSlicingContext:
                  resolvedEffectiveSourcePathSlicingContext,
                effectiveTopologyForInterval:
                  resolvedEffectiveTopologyForInterval
              }
            }
          )

          if (
            classification &&
            !isSupportedConstrainedDashedInterval(classification, stroke)
          ) {
            return []
          }

          const physicalSpans = measureStrokePipelinePhase(
            'constrained dashed interval: physical spans',
            () =>
              getIntervalPhysicalSpans(
                effectiveTopologyForInterval,
                stroke,
                interval
              )
          )
          const squareCapPhysicalStroke =
            stroke.cap === 'square'
              ? {
                  ...intervalStroke,
                  cap: 'butt' as const
                }
              : intervalStroke
          const intervalAuthoredStroke =
            resolveOutsideBoundaryIntervalJoinStroke(interval, stroke)
          const intervalPhysicalStroke =
            resolveOutsideBoundaryIntervalJoinStroke(
              interval,
              squareCapPhysicalStroke
            )
          let finalCoverageBuilderStatus:
            | SolidCenterStrokeGeometryDebugMeta['finalCoverageBuilderStatus']
            | undefined
          let intervalSweepSpanCount: number | undefined
          let terminalCapCount: number | undefined
          let outsideSquareTerminalFootprintPolygons: Vec2[][] = []
          const shouldCollectIntervalSweepMetadata =
            options.omitDiagnosticMetadata !== true
          const intervalPolygons = sourcePath
            ? (() => {
                if (
                  !effectiveSourcePath ||
                  !effectiveSourcePathSlicingContext
                ) {
                  return []
                }
                const resolvedEffectiveSourcePath = effectiveSourcePath
                const resolvedEffectiveSourcePathSlicingContext =
                  effectiveSourcePathSlicingContext
                const useProductFinalSourcePath =
                  constrainedDashedVisualMode === 'product-final' &&
                  (stroke.position === 'inside' ||
                    stroke.position === 'outside') &&
                  resolvedEffectiveSourcePathSlicingContext
                const intervalSweep = measureStrokePipelinePhase(
                  'constrained dashed interval: sweep',
                  () =>
                    buildDashedSourcePathIntervalSweep(
                      resolvedEffectiveSourcePath,
                      physicalSpans,
                      interval,
                      intervalAuthoredStroke,
                      intervalPhysicalStroke,
                      resolvedEffectiveSourcePathSlicingContext,
                      { preserveDomainContinuity: boundaryDomainPath !== null }
                    )
                )
                intervalSweepSpanCount = shouldCollectIntervalSweepMetadata
                  ? intervalSweep.ranges.length
                  : undefined
                terminalCapCount =
                  intervalPhysicalStroke.cap === 'round'
                    ? 2
                    : shouldCollectIntervalSweepMetadata
                      ? countTerminalCapsInIntervalSweep(intervalSweep)
                      : undefined
                if (terminalCapCount !== undefined && terminalCapCount > 0) {
                  emitStrokePipelineCounter(
                    'terminal-cap-build-count',
                    terminalCapCount
                  )
                }
                outsideSquareTerminalFootprintPolygons =
                  stroke.position === 'outside'
                    ? intervalSweep.ranges.flatMap(({ range }) =>
                        buildOutsideSquareSplitTerminalFootprintPolygons(
                          resolvedEffectiveSourcePath,
                          range,
                          interval,
                          intervalAuthoredStroke,
                          intervalStroke,
                          resolvedEffectiveSourcePathSlicingContext
                        )
                      )
                    : []
                if (useProductFinalSourcePath) {
                  finalCoverageBuilderStatus = 'product-final'
                  const productFinalPolygons = measureStrokePipelinePhase(
                    'constrained dashed interval: product final',
                    () => {
                      const shouldUseAuthoredInsideSourcePath =
                        stroke.position === 'inside' &&
                        sourcePath.closed === true
                      const productFinalSourcePath =
                        shouldUseAuthoredInsideSourcePath
                          ? sourcePath
                          : resolvedEffectiveSourcePath
                      const productFinalTopology =
                        shouldUseAuthoredInsideSourcePath
                          ? topology
                          : effectiveTopologyForInterval
                      const productFinalSlicingContext =
                        shouldUseAuthoredInsideSourcePath
                          ? sourcePathSlicingContext
                          : resolvedEffectiveSourcePathSlicingContext
                      if (!productFinalSlicingContext) {
                        return []
                      }
                      return buildDashedSourcePathFinalCoveragePolygons(
                        productFinalSourcePath,
                        productFinalTopology,
                        intervalSweep,
                        interval,
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
                    }
                  )
                  if (
                    productFinalPolygons.length > 0 ||
                    stroke.position === 'inside' ||
                    !boundaryDomainPath ||
                    interval.figmaLikeSideResolutionStatus !== 'resolved' ||
                    interval.figmaLikeSelectedSide === undefined
                  ) {
                    return productFinalPolygons
                  }

                  const resolvedBoundaryIntervalStroke = {
                    position:
                      interval.figmaLikeSelectedSide > 0
                        ? ('inside' as const)
                        : ('outside' as const),
                    width: intervalStroke.width
                  }
                  return measureStrokePipelinePhase(
                    'constrained dashed interval: local fallback',
                    () =>
                      intervalSweep.ranges.flatMap(
                        ({ renderRange, span, capOwnership }) =>
                          buildConstrainedDashedLocalSideStrokePolygons(
                            sliceSourcePathRangePoints(
                              resolvedEffectiveSourcePath,
                              renderRange,
                              span.role,
                              resolvedEffectiveSourcePathSlicingContext
                            ),
                            false,
                            {
                              ...capOwnership.stroke,
                              position: resolvedBoundaryIntervalStroke.position,
                              width: resolvedBoundaryIntervalStroke.width
                            },
                            {
                              assumeSimpleOpen: true,
                              assumeSimpleClosed: undefined,
                              assumeNormalizedOpen: true,
                              roundCapStart: capOwnership.roundCapStart,
                              roundCapEnd: capOwnership.roundCapEnd
                            }
                          )
                      )
                  )
                }
                finalCoverageBuilderStatus = 'debug-raw'

                const useExactInsideSourcePath =
                  stroke.position === 'inside' && sourcePath.closed === true
                const rangePolygons = intervalSweep.ranges.flatMap(
                  ({ range, span, renderRange, capOwnership }) => {
                    if (useExactInsideSourcePath) {
                      const exactSourcePathSlicingContext =
                        sourcePathSlicingContext
                      if (!exactSourcePathSlicingContext) {
                        return []
                      }
                      const exactFrames = sliceExactRibbonRangeFrames(
                        sourcePath,
                        renderRange,
                        exactSourcePathSlicingContext
                      )
                      const sourceEdge = exactFrames.map((frame) => frame.point)
                      const exactIntervalStrokes = [intervalStroke]

                      const exactPolygons = exactIntervalStrokes.flatMap(
                        (currentIntervalStroke) => {
                          const currentCapStroke = {
                            ...capOwnership.stroke,
                            position: currentIntervalStroke.position
                          }
                          const shouldClipInsideBoundary =
                            shouldClipSourceSegmentRangeForInsideBoundary(
                              range,
                              exactSourcePathSlicingContext.segmentRanges[
                                range.segmentIndex
                              ],
                              sourcePath,
                              interval,
                              stroke,
                              currentIntervalStroke,
                              sharpGuardVertices
                            )
                          if (
                            canSkipInteriorSourcePathBoundaryClipping &&
                            !shouldClipInsideBoundary
                          ) {
                            return buildMergedExactSourcePathRibbonPolygonsFromFrames(
                              exactFrames,
                              currentCapStroke,
                              capOwnership.roundCapStart,
                              capOwnership.roundCapEnd
                            )
                          }
                          if (
                            currentCapStroke.cap === 'round' &&
                            (capOwnership.roundCapStart === true ||
                              capOwnership.roundCapEnd === true)
                          ) {
                            const mergedPolygons =
                              buildMergedExactSourcePathRibbonPolygonsFromFrames(
                                exactFrames,
                                currentCapStroke,
                                capOwnership.roundCapStart,
                                capOwnership.roundCapEnd
                              )
                            return clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                              mergedPolygons,
                              sourcePath,
                              range,
                              interval,
                              stroke,
                              currentIntervalStroke,
                              span.role,
                              sharpGuardVertices,
                              exactSourcePathSlicingContext,
                              {
                                assumeConstructedSimple: true,
                                skipSourceEdgeFallback: false,
                                sourceEdge
                              }
                            )
                          }
                          const { bodyPolygons, capPolygons } =
                            buildExactSourcePathRibbonGeometryFromFrames(
                              exactFrames,
                              currentCapStroke,
                              capOwnership.roundCapStart,
                              capOwnership.roundCapEnd
                            )
                          return [
                            ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                              bodyPolygons,
                              sourcePath,
                              range,
                              interval,
                              currentCapStroke.cap === 'round'
                                ? {
                                    ...stroke,
                                    cap: 'butt' as const
                                  }
                                : stroke,
                              currentIntervalStroke,
                              span.role,
                              sharpGuardVertices,
                              exactSourcePathSlicingContext,
                              {
                                assumeConstructedSimple: true,
                                skipSourceEdgeFallback: false,
                                sourceEdge
                              }
                            ),
                            ...clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                              capPolygons,
                              sourcePath,
                              range,
                              interval,
                              stroke,
                              currentIntervalStroke,
                              span.role,
                              sharpGuardVertices,
                              exactSourcePathSlicingContext,
                              {
                                assumeConstructedSimple: true,
                                skipSourceEdgeFallback: false,
                                sourceEdge
                              }
                            )
                          ]
                        }
                      )

                      return exactPolygons
                    }
                    if (!sourcePathSlicingContext) {
                      return []
                    }
                    const rangeImplicitDomainStroke =
                      usesOpenSelfIntersectingImplicitDomain &&
                      isOpenDanglingOutsideBothSidesVisibleInterval(interval)
                        ? {
                            ...capOwnership.stroke,
                            position: 'center' as const
                          }
                        : usesOpenSelfIntersectingImplicitDomain &&
                            isSourceSpanProductDomainVisibleInterval(interval)
                          ? {
                              ...capOwnership.stroke,
                              position:
                                interval.figmaLikeSelectedSide === 1
                                  ? ('inside' as const)
                                  : interval.figmaLikeSelectedSide === -1
                                    ? ('outside' as const)
                                    : capOwnership.stroke.position
                            }
                          : capOwnership.stroke
                    const sourcePathRibbonPolygons =
                      buildSourcePathRibbonPolygons(
                        sourcePath,
                        renderRange,
                        span,
                        rangeImplicitDomainStroke,
                        capOwnership.roundCapStart,
                        capOwnership.roundCapEnd,
                        sourcePathSlicingContext
                      )
                    const rangePolygons =
                      sourcePathRibbonPolygons ??
                      (() => {
                        emitStrokePipelineCounter(
                          'generic-local-side-builder-fallback-count'
                        )
                        return buildConstrainedDashedLocalSideStrokePolygons(
                          sliceSourcePathRangePoints(
                            sourcePath,
                            renderRange,
                            span.role,
                            sourcePathSlicingContext
                          ),
                          false,
                          rangeImplicitDomainStroke,
                          {
                            assumeSimpleOpen: true,
                            assumeSimpleClosed: undefined,
                            assumeNormalizedOpen: true,
                            roundCapStart: capOwnership.roundCapStart,
                            roundCapEnd: capOwnership.roundCapEnd
                          }
                        )
                      })()
                    return clipSourceSegmentRangePolygonsToAdjacentBoundaries(
                      rangePolygons,
                      sourcePath,
                      range,
                      interval,
                      stroke,
                      intervalStroke,
                      span.role,
                      sharpGuardVertices,
                      sourcePathSlicingContext
                    )
                  }
                )
                return rangePolygons
              })()
            : (() => {
                const slicer =
                  intervalPointSlicer ??
                  createStrokeIntervalPointSlicer(
                    topologyPoints,
                    topology.closed
                  )
                const spanPolygons = physicalSpans.flatMap((span) => {
                  const spanPoints = slicer.slice(
                    span.startDistance,
                    span.endDistance,
                    span.wrapsSeam
                  )
                  const ownsOpenPathStartTerminalCap =
                    !topology.closed &&
                    interval.startDistance <= EPSILON &&
                    span.startDistance <= EPSILON
                  const ownsOpenPathEndTerminalCap =
                    !topology.closed &&
                    interval.endDistance >= totalLength - EPSILON &&
                    span.endDistance >= totalLength - EPSILON
                  return [
                    ...buildConstrainedDashedLocalSideStrokePolygons(
                      spanPoints,
                      false,
                      squareCapPhysicalStroke,
                      {
                        assumeSimpleOpen:
                          !topology.closed ||
                          topology.isSimpleClosed ||
                          topology.topologyFamily === 'self-intersecting'
                            ? true
                            : undefined,
                        assumeSimpleClosed: topology.closed
                          ? topology.isSimpleClosed
                          : undefined,
                        assumeNormalizedOpen: true,
                        roundCapStart:
                          stroke.cap === 'round' && ownsOpenPathStartTerminalCap
                            ? false
                            : undefined,
                        roundCapEnd:
                          stroke.cap === 'round' && ownsOpenPathEndTerminalCap
                            ? false
                            : undefined
                      }
                    ),
                    ...buildOpenPointTerminalCapOverhangPolygons(
                      spanPoints,
                      intervalStroke,
                      ownsOpenPathStartTerminalCap,
                      ownsOpenPathEndTerminalCap
                    )
                  ]
                })
                if (
                  stroke.cap !== 'square' ||
                  !topology.closed ||
                  stroke.width <= EPSILON
                ) {
                  return spanPolygons
                }

                if (stroke.position !== 'outside') {
                  return spanPolygons
                }

                const fallbackSourcePath = buildPolylineGeometryModelPath(
                  topologyPoints,
                  topology.closed
                )
                return [
                  ...spanPolygons,
                  ...buildSourcePathIntervalJoinPolygons(
                    fallbackSourcePath,
                    physicalSpans,
                    {
                      position: intervalStroke.position,
                      width: intervalStroke.width,
                      join: stroke.join,
                      miterLimit: stroke.miterLimit
                    }
                  )
                ]
              })()
          const polygons = measureStrokePipelinePhase(
            'constrained dashed interval: post process',
            () => {
              const selectedSidePolygons = sourcePath
                ? intervalPolygons
                : applyClosedIntervalSelectedSideGuards(
                    intervalPolygons,
                    topology.closed,
                    interval,
                    sharpGuardVertices,
                    segmentRanges,
                    totalLength,
                    stroke,
                    intervalStroke
                  )
              const usesExactInsideSourcePath =
                sourcePath &&
                stroke.position === 'inside' &&
                sourcePath.closed === true
              let processedPolygons =
                topology.isSimpleClosed && !usesExactInsideSourcePath
                  ? applyClosedIntervalLegality(
                      selectedSidePolygons,
                      closedIntervalLegalityContext
                    )
                  : selectedSidePolygons
              let appendedSquareSplitTerminalFootprints = false
              if (
                sourcePath &&
                stroke.position === 'inside' &&
                finalCoverageBuilderStatus !== 'product-final'
              ) {
                const sourceJoinPolygons = measureStrokePipelinePhase(
                  'constrained dashed interval: source joins',
                  () =>
                    buildSourcePathIntervalJoinPolygons(
                      sourcePath,
                      physicalSpans,
                      {
                        position: intervalStroke.position,
                        width: intervalStroke.width,
                        join: stroke.join,
                        miterLimit: stroke.miterLimit
                      }
                    )
                )
                const canClipInsideJoinsOnly = false
                const clippedSourceJoinPolygons = canClipInsideJoinsOnly
                  ? measureStrokePipelinePhase(
                      'constrained dashed interval: fill clip',
                      () =>
                        clipSourcePathPolygonsToEvenOddLegalDomain(
                          sourceJoinPolygons,
                          sourcePath,
                          stroke,
                          options.implicitFillRegions ?? [],
                          {
                            fragmentPruneArea: EPSILON * 10,
                            cleanupMicroEdgeTolerance: 0.001,
                            cleanupCollinearTolerance: 0.0001
                          }
                        )
                    )
                  : sourceJoinPolygons
                processedPolygons = [
                  ...processedPolygons,
                  ...clippedSourceJoinPolygons
                ]
              }
              if (
                sourcePath &&
                stroke.position === 'inside' &&
                options.clipInsideToFillDomain === true &&
                finalCoverageBuilderStatus !== 'product-final' &&
                processedPolygons.length > 0
              ) {
                processedPolygons = measureStrokePipelinePhase(
                  'constrained dashed interval: fill clip',
                  () =>
                    clipSourcePathPolygonsToEvenOddLegalDomain(
                      processedPolygons,
                      sourcePath,
                      stroke,
                      options.implicitFillRegions ?? [],
                      {
                        fragmentPruneArea: EPSILON * 10,
                        cleanupMicroEdgeTolerance: 0.001,
                        cleanupCollinearTolerance: 0.0001
                      }
                    )
                )
              }
              if (sourcePath && stroke.position === 'outside') {
                const sourceVertexJoinPath = boundaryDomainPath ?? sourcePath
                const intervalSourceVertexJoinPolygons =
                  hasSourceVertexBoundaryJoinRecords ||
                  interval.intervalId.includes(':smooth-source-continuity:') ||
                  isOpenDanglingOutsideBothSidesVisibleInterval(interval) ||
                  isSquareSplitTerminalHalfDashInterval(interval, stroke)
                    ? []
                    : measureStrokePipelinePhase(
                        'constrained dashed interval: source joins',
                        () =>
                          buildSourcePathIntervalJoinPolygons(
                            sourceVertexJoinPath,
                            physicalSpans,
                            {
                              position: intervalStroke.position,
                              width: intervalStroke.width,
                              join: intervalAuthoredStroke.join,
                              miterLimit: stroke.miterLimit
                            }
                          )
                      )
                processedPolygons = [
                  ...processedPolygons,
                  ...intervalSourceVertexJoinPolygons
                ]
              }
              if (
                sourcePath &&
                stroke.position === 'outside' &&
                !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
                options.clipInsideToFillDomain === true &&
                processedPolygons.length > 0 &&
                ((options.implicitFillRegions?.length ?? 0) > 0 ||
                  outsideSquareTerminalFootprintPolygons.length > 0)
              ) {
                processedPolygons = measureStrokePipelinePhase(
                  'constrained dashed interval: outside legal clip',
                  () => {
                    const clippedPolygons =
                      clipSourcePathPolygonsToEvenOddLegalDomain(
                        processedPolygons,
                        sourcePath,
                        { position: stroke.position },
                        options.implicitFillRegions ?? [],
                        {
                          fragmentStitchRadius:
                            intervalAuthoredStroke.join === 'round'
                              ? Math.max(0.5, intervalStroke.width * 0.05)
                              : 0,
                          fragmentPruneArea: 0,
                          cleanupMicroEdgeTolerance: 0.001,
                          cleanupCollinearTolerance: 0.0001
                        }
                      )
                    const clippedSquareTerminalFootprintPolygons =
                      clipOutsideSquareSplitTerminalFootprintPolygonsToLegalDomain(
                        outsideSquareTerminalFootprintPolygons,
                        interval,
                        sourcePath,
                        options.implicitFillRegions ?? [],
                        options.sharedStrokeBoundaryDomains ?? [],
                        { skipBoundarySideClip: false }
                      )
                    const shouldClipOutsideSquareBoundarySide =
                      stroke.cap === 'square' &&
                      interval.figmaLikeSplitRangeId !== undefined &&
                      interval.figmaLikeBoundaryRole !== 'hole' &&
                      (interval.figmaLikeTerminalRole === 'start' ||
                        interval.figmaLikeTerminalRole === 'end' ||
                        interval.figmaLikeTerminalRole === 'start-end')
                    const clippedBodyPolygons = clippedPolygons
                    const terminalOutput = shouldClipOutsideSquareBoundarySide
                      ? clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide(
                          clippedSquareTerminalFootprintPolygons,
                          interval
                        )
                      : clippedSquareTerminalFootprintPolygons
                    appendedSquareSplitTerminalFootprints =
                      terminalOutput.length > 0
                    return appendedSquareSplitTerminalFootprints
                      ? [...clippedBodyPolygons, ...terminalOutput]
                      : clippedBodyPolygons
                  }
                )
              }
              if (
                sourcePath &&
                stroke.position === 'outside' &&
                !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
                stroke.cap === 'square' &&
                interval.figmaLikeSplitRangeId !== undefined &&
                interval.figmaLikeBoundaryRole !== 'hole' &&
                (interval.figmaLikeTerminalRole === 'start' ||
                  interval.figmaLikeTerminalRole === 'end' ||
                  interval.figmaLikeTerminalRole === 'start-end')
              ) {
                const terminalOutput = appendedSquareSplitTerminalFootprints
                  ? []
                  : clipOutsideSquareSplitTerminalFootprintPolygonsToBoundarySide(
                      outsideSquareTerminalFootprintPolygons,
                      interval
                    )
                if (terminalOutput.length > 0) {
                  processedPolygons = [...processedPolygons, ...terminalOutput]
                  appendedSquareSplitTerminalFootprints = true
                }
              }
              if (
                sourcePath &&
                stroke.position === 'outside' &&
                !isOpenDanglingOutsideBothSidesVisibleInterval(interval) &&
                stroke.cap === 'square' &&
                interval.figmaLikeSplitRangeId !== undefined
              ) {
                processedPolygons =
                  filterOutsideSquareBoundaryDomainWrongSideFragments(
                    processedPolygons,
                    interval,
                    stroke
                  )
              }
              processedPolygons =
                clipOutsideSquareSplitTerminalEndpointOverhang(
                  processedPolygons,
                  interval,
                  stroke
                )
              return processedPolygons
            }
          )

          if (polygons.length === 0) {
            return []
          }

          const { geometryId, figmaLikeSplitRangeTerminals } =
            measureStrokePipelinePhase(
              'constrained dashed interval: packet metadata',
              () => {
                const resolvedGeometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
                const shouldAttachPacketDiagnosticDetails =
                  options.omitDiagnosticMetadata !== true
                return {
                  geometryId: resolvedGeometryId,
                  figmaLikeSplitRangeTerminals:
                    shouldAttachPacketDiagnosticDetails
                      ? buildFigmaLikeSplitRangeTerminalRecords(interval)
                      : undefined
                }
              }
            )
          if (options.visualOnly) {
            return [
              {
                geometry: {
                  geometryId,
                  polygons,
                  bounds: EMPTY_STROKE_PACKET_BOUNDS
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
          }

          if (!classification) {
            return []
          }

          const resolutionStatus = getConstrainedDashedResolutionStatus(
            classification.sourceTopology,
            classification.intervalTopology,
            !topology.closed && !topology.isSimpleOpen
          )
          const debugMeta: SolidCenterStrokeGeometryDebugMeta =
            options.omitDiagnosticMetadata
              ? {
                  sourcePathId: cachePrefix,
                  ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
                  networkId: options.metadata?.networkId,
                  strokeId: `stroke:${strokeIndex}`,
                  strokeIndex,
                  contourId,
                  intervalId: interval.intervalId,
                  strokePosition: stroke.position,
                  strokeWidth: intervalStroke.width,
                  strokeJoin: stroke.join,
                  strokeCap: stroke.cap,
                  strokeMiterLimit: stroke.miterLimit,
                  ownerSet: options.metadata?.ownerSet,
                  geometryFamily: 'constrained-dashed',
                  resolutionStatus,
                  runtimeStatus: 'candidate',
                  sourceTopology: classification.sourceTopology,
                  topologyFamily: topology.topologyFamily,
                  intervalTopology: classification.intervalTopology,
                  finalCoverageBuilderStatus,
                  intervalSweepSpanCount,
                  terminalCapCount,
                  figmaLikeBoundaryDomainId: interval.figmaLikeBoundaryDomainId,
                  figmaLikeBoundaryStartDistance:
                    interval.figmaLikeBoundaryStartDistance,
                  figmaLikeBoundaryEndDistance:
                    interval.figmaLikeBoundaryEndDistance,
                  figmaLikeBoundaryTotalLength:
                    interval.figmaLikeBoundaryTotalLength,
                  figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
                  figmaLikeSplitRangeStartDistance:
                    interval.figmaLikeSplitRangeStartDistance,
                  figmaLikeSplitRangeEndDistance:
                    interval.figmaLikeSplitRangeEndDistance,
                  figmaLikeTerminalRole: interval.figmaLikeTerminalRole,
                  figmaLikeSplitRangeSourceSegmentIndex:
                    interval.figmaLikeSplitRangeSourceSegmentIndex,
                  figmaLikeSideAuthority: interval.figmaLikeSideAuthority,
                  figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
                  figmaLikeFilledSide: interval.figmaLikeFilledSide,
                  figmaLikeUnfilledSide: interval.figmaLikeUnfilledSide,
                  figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
                  figmaLikeDomainMode: interval.figmaLikeDomainMode,
                  figmaLikeSideResolutionStatus:
                    interval.figmaLikeSideResolutionStatus,
                  figmaLikeSideResolutionReason:
                    interval.figmaLikeSideResolutionReason,
                  figmaLikeSplitRangeTerminals,
                  paintBounds: sourcePaintBounds,
                  revisionSet: getRevisionSet(classification)
                }
              : {
                  sourcePathId: cachePrefix,
                  ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
                  networkId: options.metadata?.networkId,
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
                  ownerSet: options.metadata?.ownerSet,
                  sourceContourIds: options.metadata?.sourceContourIds,
                  legalDomainIds: options.metadata?.legalDomainIds,
                  sourceSpanIds:
                    options.metadata?.sourceSpanIds ??
                    (sourceSpanGraph
                      ? getSourceSpanIdsForInterval(sourceSpanGraph, interval)
                      : []),
                  authoredVisibleIntervalIndex: interval.authoredIndex,
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
                  physicalVisibleLength: physicalSpans.reduce(
                    (total, span) => total + span.intervalLength,
                    0
                  ),
                  previousVisibleIntervalId: interval.previousVisibleIntervalId,
                  nextVisibleIntervalId: interval.nextVisibleIntervalId,
                  figmaLikeBoundaryDomainId: interval.figmaLikeBoundaryDomainId,
                  figmaLikeBoundaryPoints: interval.figmaLikeBoundaryPoints
                    ? interval.figmaLikeBoundaryPoints.map((point) => ({
                        ...point
                      }))
                    : undefined,
                  figmaLikeBoundaryStartDistance:
                    interval.figmaLikeBoundaryStartDistance,
                  figmaLikeBoundaryEndDistance:
                    interval.figmaLikeBoundaryEndDistance,
                  figmaLikeBoundaryTotalLength:
                    interval.figmaLikeBoundaryTotalLength,
                  figmaLikeSplitRangeId: interval.figmaLikeSplitRangeId,
                  figmaLikeSplitRangeStartDistance:
                    interval.figmaLikeSplitRangeStartDistance,
                  figmaLikeSplitRangeEndDistance:
                    interval.figmaLikeSplitRangeEndDistance,
                  figmaLikeTerminalRole: interval.figmaLikeTerminalRole,
                  figmaLikeSplitRangeSourceSegmentIndex:
                    interval.figmaLikeSplitRangeSourceSegmentIndex,
                  figmaLikeSideAuthority: interval.figmaLikeSideAuthority,
                  figmaLikeSelectedSide: interval.figmaLikeSelectedSide,
                  figmaLikeFilledSide: interval.figmaLikeFilledSide,
                  figmaLikeUnfilledSide: interval.figmaLikeUnfilledSide,
                  figmaLikeBoundaryRole: interval.figmaLikeBoundaryRole,
                  figmaLikeDomainMode: interval.figmaLikeDomainMode,
                  figmaLikeSideResolutionStatus:
                    interval.figmaLikeSideResolutionStatus,
                  figmaLikeSideResolutionReason:
                    interval.figmaLikeSideResolutionReason,
                  figmaLikeSplitRangeTerminals,
                  geometryFamily: 'constrained-dashed',
                  resolutionStatus,
                  runtimeStatus: 'candidate',
                  sourceTopology: classification.sourceTopology,
                  topologyFamily: topology.topologyFamily,
                  intervalTopology: classification.intervalTopology,
                  finalCoverageBuilderStatus,
                  intervalSweepSpanCount,
                  terminalCapCount,
                  paintBounds: sourcePaintBounds,
                  revisionSet: getRevisionSet(classification)
                }

          return [
            {
              geometry: {
                geometryId,
                polygons,
                bounds: getBounds(polygons),
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
    const sourceVertexJoinPackets =
      constrainedDashedVisualMode === 'product-final' &&
      options.visualOnly !== true &&
      productFinalIntervalClassification !== null &&
      sourcePath &&
      !(stroke.position === 'outside' && stroke.cap === 'square')
        ? sourceVertexBoundaryJoinRecords.flatMap((joinRecord, joinIndex) => {
            const [previousInterval, nextInterval] = joinRecord.intervals
            const clippedPolygons =
              options.clipInsideToFillDomain === true &&
              options.implicitFillRegions &&
              options.implicitFillRegions.length > 0
                ? clipSourcePathPolygonsToEvenOddLegalDomain(
                    joinRecord.polygons,
                    sourcePath,
                    { position: stroke.position },
                    options.implicitFillRegions,
                    {
                      fragmentStitchRadius: 0,
                      fragmentPruneArea:
                        stroke.position === 'outside'
                          ? stroke.join === 'round'
                            ? 0
                            : EPSILON * 10
                          : Math.max(
                              1,
                              intervalStroke.width * intervalStroke.width * 0.1
                            ),
                      cleanupMicroEdgeTolerance: 0.001,
                      cleanupCollinearTolerance: 0.0001
                    }
                  )
                : joinRecord.polygons
            const polygons = normalizeConstrainedDashedProductVisualPolygons(
              densifyRoundSourceVertexJoinPolygons(
                keepOutsideMiterSourceVertexJoinApexFragments(
                  clippedPolygons,
                  joinRecord.polygons,
                  joinRecord.vertex,
                  {
                    position: stroke.position,
                    width: intervalStroke.width,
                    join: stroke.join
                  }
                ),
                stroke.join === 'round' ? [joinRecord.vertex] : [],
                intervalStroke.width
              )
            )
            if (polygons.length === 0) {
              return []
            }

            const intervalIds = joinRecord.intervals.map(
              (interval) => interval.intervalId
            )
            const sourceSpanIds = [
              ...new Set(
                joinRecord.intervals.flatMap((interval) =>
                  sourceSpanGraph
                    ? getSourceSpanIdsForInterval(sourceSpanGraph, interval)
                    : []
                )
              )
            ]
            const geometryId = `${cachePrefix}:${strokeIndex}:source-vertex-join:${joinRecord.vertexIndex}:${joinIndex}`
            const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
              sourcePathId: cachePrefix,
              ownerKey: `${ownerPrefix}:stroke:${strokeIndex}`,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${strokeIndex}`,
              strokeIndex,
              contourId,
              legalDomainId,
              intervalId: previousInterval.intervalId,
              intervalIds,
              strokePosition: stroke.position,
              strokeWidth: intervalStroke.width,
              strokeJoin: stroke.join,
              strokeCap: stroke.cap,
              strokeMiterLimit: stroke.miterLimit,
              ownerSet: options.metadata?.ownerSet,
              sourceContourIds: options.metadata?.sourceContourIds,
              legalDomainIds: options.metadata?.legalDomainIds,
              sourceSpanIds,
              authoredVisibleIntervalIndex: previousInterval.authoredIndex,
              startDistance: previousInterval.startDistance,
              endDistance: nextInterval.endDistance,
              wrapsSeam: previousInterval.wrapsSeam || nextInterval.wrapsSeam,
              previousVisibleIntervalId:
                previousInterval.previousVisibleIntervalId,
              nextVisibleIntervalId: nextInterval.nextVisibleIntervalId,
              figmaLikeBoundaryDomainId:
                previousInterval.figmaLikeBoundaryDomainId,
              figmaLikeBoundaryPoints:
                previousInterval.figmaLikeBoundaryPoints?.map((point) => ({
                  ...point
                })),
              figmaLikeBoundaryStartDistance:
                previousInterval.figmaLikeBoundaryStartDistance,
              figmaLikeBoundaryEndDistance:
                nextInterval.figmaLikeBoundaryEndDistance,
              figmaLikeBoundaryTotalLength:
                previousInterval.figmaLikeBoundaryTotalLength,
              figmaLikeSplitRangeId: previousInterval.figmaLikeSplitRangeId,
              figmaLikeSplitRangeStartDistance:
                previousInterval.figmaLikeSplitRangeStartDistance,
              figmaLikeSplitRangeEndDistance:
                nextInterval.figmaLikeSplitRangeEndDistance,
              figmaLikeTerminalRole: 'middle',
              figmaLikeSplitRangeSourceSegmentIndex:
                previousInterval.figmaLikeSplitRangeSourceSegmentIndex,
              figmaLikeSideAuthority: previousInterval.figmaLikeSideAuthority,
              figmaLikeSelectedSide: previousInterval.figmaLikeSelectedSide,
              figmaLikeFilledSide: previousInterval.figmaLikeFilledSide,
              figmaLikeUnfilledSide: previousInterval.figmaLikeUnfilledSide,
              figmaLikeBoundaryRole: previousInterval.figmaLikeBoundaryRole,
              figmaLikeSideResolutionStatus:
                previousInterval.figmaLikeSideResolutionStatus,
              figmaLikeSideResolutionReason:
                previousInterval.figmaLikeSideResolutionReason,
              figmaLikeSplitRangeTerminals: [
                ...(buildFigmaLikeSplitRangeTerminalRecords(previousInterval) ??
                  []),
                ...(buildFigmaLikeSplitRangeTerminalRecords(nextInterval) ?? [])
              ],
              geometryFamily: 'constrained-dashed',
              resolutionStatus: getConstrainedDashedResolutionStatus(
                productFinalIntervalClassification.sourceTopology,
                productFinalIntervalClassification.intervalTopology
              ),
              runtimeStatus: 'candidate',
              sourceTopology: productFinalIntervalClassification.sourceTopology,
              topologyFamily: topology.topologyFamily,
              intervalTopology:
                productFinalIntervalClassification.intervalTopology,
              finalCoverageBuilderStatus: 'product-final',
              intervalSweepSpanCount: 0,
              terminalCapCount: 0,
              paintBounds: sourcePaintBounds,
              revisionSet: getRevisionSet(productFinalIntervalClassification)
            }

            return {
              geometry: {
                geometryId,
                polygons,
                bounds: getBounds(polygons),
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
          })
        : []

    return [...intervalPackets, ...sourceVertexJoinPackets]
  })
}
