import type { FigmaLikeSplitRangeDashDomain } from './dashed-center-stroke-intervals'
import type { PolygonRegion } from './geometry-backend'
import type {
  NormalizedBoundarySpan,
  NormalizedLegalDomain
} from './legal-domain-normalization'
import type { PathTopologyModel } from './path-topology-model'
import {
  samplePathSegmentFramesByLengthStep,
  type PathGeometry,
  type PathSliceSamplingOptions
} from './path-geometry'
import type { RenderableStroke } from './renderable-stroke'
import type {
  ResolvedVectorSourceSplitRange,
  ResolvedVectorStrokeBoundaryDomain
} from './resolved-vector-geometry-model'
import type { ResolvedSourceFamily } from './resolved-source-family'

const EPSILON = 1e-6
const SOURCE_PATH_DASH_SLICE_TOLERANCE = 0.25
const SOURCE_PATH_DASH_SLICE_SAMPLING: PathSliceSamplingOptions = {
  minCubicSamples: 48,
  maxCubicSamples: 512,
  useRangeLengthForSampleCount: true
}

export type StrokeIntervalDomainKind =
  | 'topology-arc-length'
  | 'source-path'
  | 'figma-like-split-range'
  | 'legal-boundary-span'
  | 'none'

export type StrokeSideAuthority =
  | 'none'
  | 'source-path-orientation'
  | 'implicit-fill-hole-domain'
  | 'center-equivalent'

export type StrokeDomainBlockedReason =
  | ResolvedSourceFamily['blockedReason']
  | 'missing-source-path'
  | 'missing-source-segments'
  | 'missing-shared-source-split-ranges'
  | 'missing-normalized-legal-domain'
  | 'ambiguous-side-resolution'

export interface StrokeLegalBoundaryDomain {
  domainId: string
  boundarySpanId: string
  role: NormalizedBoundarySpan['role']
  totalLength: number
  closed: true
  sourceContourIds: string[]
  sourceSpanIds: string[]
  legalDomainIds: string[]
  sideAuthority: 'implicit-fill-hole-domain'
  selectedStrokePosition: 'inside' | 'outside'
}

export interface StrokeDomainPlan {
  planId: string
  sourceId: string
  networkId: string
  supportState: ResolvedSourceFamily['supportState']
  blockedReason?: StrokeDomainBlockedReason
  topologyFamily: PathTopologyModel['topologyFamily']
  fillRule: PathTopologyModel['fillRule']
  closed: boolean
  totalLength: number
  strokeStyle: RenderableStroke['style']
  strokePosition: RenderableStroke['position']
  intervalDomainKind: StrokeIntervalDomainKind
  sideAuthority: StrokeSideAuthority
  requiresImplicitFillHoleSideResolution: boolean
  splitRangeDomains: FigmaLikeSplitRangeDashDomain[]
  legalBoundaryDomains: StrokeLegalBoundaryDomain[]
  sideResolutionContext?: StrokeDomainSideResolutionContext
  contourIds: string[]
  legalDomainIds: string[]
  diagnostics: string[]
}

export interface StrokeDomainSideResolutionContext {
  sourcePath: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
  topologyPoints: { x: number; y: number }[]
  fillRule: PathTopologyModel['fillRule']
  strokePosition: 'inside' | 'outside'
  strokeWidth: number
  implicitFillRegions?: PolygonRegion[]
}

export interface ResolveStrokeDomainsInput {
  topology: Pick<
    PathTopologyModel,
    | 'sourceId'
    | 'networkId'
    | 'topologyFamily'
    | 'fillRule'
    | 'closed'
    | 'totalLength'
    | 'normalizedPoints'
  >
  sourceFamily: ResolvedSourceFamily
  stroke: Pick<RenderableStroke, 'style' | 'position' | 'width'>
  sourcePath?:
    | (Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'> &
        Partial<Pick<PathGeometry, 'sampledPoints'>>)
    | undefined
  implicitFillRegions?: PolygonRegion[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
  sharedStrokeBoundaryDomains?: ResolvedVectorStrokeBoundaryDomain[]
  normalizedLegalDomain?: Pick<
    NormalizedLegalDomain,
    'legalDomainId' | 'boundarySpans'
  >
}

const isConstrainedPosition = (position: RenderableStroke['position']) =>
  position === 'inside' || position === 'outside'

const isSelfIntersectingConstrainedDashed = ({
  topology,
  stroke
}: Pick<ResolveStrokeDomainsInput, 'topology' | 'stroke'>) =>
  topology.topologyFamily === 'self-intersecting' &&
  topology.closed &&
  stroke.style === 'dashed' &&
  isConstrainedPosition(stroke.position)

const isSelfIntersectingConstrained = ({
  topology,
  stroke
}: Pick<ResolveStrokeDomainsInput, 'topology' | 'stroke'>) =>
  topology.topologyFamily === 'self-intersecting' &&
  topology.closed &&
  isConstrainedPosition(stroke.position)

const invertConstrainedStrokePosition = (
  position: RenderableStroke['position']
): 'inside' | 'outside' => (position === 'inside' ? 'outside' : 'inside')

const getClosedPolylineLength = (points: { x: number; y: number }[]) =>
  points.reduce((sum, point, index) => {
    const nextPoint = points[(index + 1) % points.length]
    if (!nextPoint) {
      return sum
    }
    return sum + Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y)
  }, 0)

const buildLegalBoundaryDomains = ({
  normalizedLegalDomain,
  strokePosition
}: {
  normalizedLegalDomain: Pick<
    NormalizedLegalDomain,
    'legalDomainId' | 'boundarySpans'
  >
  strokePosition: RenderableStroke['position']
}): StrokeLegalBoundaryDomain[] =>
  normalizedLegalDomain.boundarySpans.map((span, spanIndex) => ({
    domainId: `${normalizedLegalDomain.legalDomainId}:boundary-domain:${spanIndex}`,
    boundarySpanId: span.boundarySpanId,
    role: span.role,
    totalLength: getClosedPolylineLength(span.geometry),
    closed: true,
    sourceContourIds: span.sourceContourIds,
    sourceSpanIds: span.sourceSpanIds,
    legalDomainIds: [normalizedLegalDomain.legalDomainId],
    sideAuthority: 'implicit-fill-hole-domain',
    selectedStrokePosition:
      span.role === 'fill-interior-edge'
        ? invertConstrainedStrokePosition(strokePosition)
        : (strokePosition as 'inside' | 'outside')
  }))

const cross2 = (
  left: { x: number; y: number },
  right: { x: number; y: number }
) => left.x * right.y - left.y * right.x

const getInclusiveLineIntersection = (
  leftStart: { x: number; y: number },
  leftEnd: { x: number; y: number },
  rightStart: { x: number; y: number },
  rightEnd: { x: number; y: number }
) => {
  const leftVector = {
    x: leftEnd.x - leftStart.x,
    y: leftEnd.y - leftStart.y
  }
  const rightVector = {
    x: rightEnd.x - rightStart.x,
    y: rightEnd.y - rightStart.y
  }
  const denominator = cross2(leftVector, rightVector)
  if (Math.abs(denominator) <= 1e-8) {
    return null
  }

  const delta = {
    x: rightStart.x - leftStart.x,
    y: rightStart.y - leftStart.y
  }
  const leftRatio = cross2(delta, rightVector) / denominator
  const rightRatio = cross2(delta, leftVector) / denominator
  if (
    leftRatio < -1e-6 ||
    leftRatio > 1 + 1e-6 ||
    rightRatio < -1e-6 ||
    rightRatio > 1 + 1e-6
  ) {
    return null
  }

  return {
    leftRatio: Math.max(0, Math.min(1, leftRatio)),
    rightRatio: Math.max(0, Math.min(1, rightRatio))
  }
}

const isAdjacentSourceTopologySegment = (
  leftIndex: number,
  rightIndex: number,
  segmentCount: number,
  closed: boolean | undefined
) => {
  if (Math.abs(leftIndex - rightIndex) <= 1) {
    return true
  }
  return closed === true && leftIndex === 0 && rightIndex === segmentCount - 1
}

export const buildFigmaLikeSplitRangeDashDomains = (
  sourcePath: Pick<PathGeometry, 'segments'> &
    Partial<Pick<PathGeometry, 'closed'>>
): FigmaLikeSplitRangeDashDomain[] => {
  let sourceCursor = 0
  const sourceSegmentRanges: {
    segmentIndex: number
    startDistance: number
    endDistance: number
  }[] = []
  const pieces: {
    segmentIndex: number
    start: { x: number; y: number }
    end: { x: number; y: number }
    startDistance: number
    endDistance: number
    sourceTopologyStartDistance: number
    sourceTopologyEndDistance: number
  }[] = []

  sourcePath.segments.forEach((segment, segmentIndex) => {
    const segmentSourceStart = sourceCursor
    const segmentSourceEnd = sourceCursor + segment.length
    sourceCursor = segmentSourceEnd
    sourceSegmentRanges.push({
      segmentIndex,
      startDistance: segmentSourceStart,
      endDistance: segmentSourceEnd
    })

    if (segment.length <= EPSILON) {
      return
    }

    const frames =
      segment.type === 'line'
        ? [{ point: segment.start }, { point: segment.end }]
        : samplePathSegmentFramesByLengthStep(
            segment,
            0,
            segment.length,
            SOURCE_PATH_DASH_SLICE_TOLERANCE,
            SOURCE_PATH_DASH_SLICE_SAMPLING
          )
    const frameSpanCount = Math.max(1, frames.length - 1)
    for (let frameIndex = 0; frameIndex < frames.length - 1; frameIndex += 1) {
      const start = frames[frameIndex]
      const end = frames[frameIndex + 1]
      if (!start || !end) {
        continue
      }
      const sourceStartDistance =
        segmentSourceStart + (segment.length * frameIndex) / frameSpanCount
      const sourceEndDistance =
        segmentSourceStart +
        (segment.length * (frameIndex + 1)) / frameSpanCount
      pieces.push({
        start: start.point,
        end: end.point,
        segmentIndex,
        startDistance: sourceStartDistance,
        endDistance: sourceEndDistance,
        sourceTopologyStartDistance: segmentSourceStart,
        sourceTopologyEndDistance: segmentSourceEnd
      })
    }
  })

  const breakpointsBySegment = new Map<number, number[]>()
  sourceSegmentRanges.forEach((range) => {
    breakpointsBySegment.set(range.segmentIndex, [
      range.startDistance,
      range.endDistance
    ])
  })

  for (let leftIndex = 0; leftIndex < pieces.length - 1; leftIndex += 1) {
    const left = pieces[leftIndex]
    if (!left) {
      continue
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < pieces.length;
      rightIndex += 1
    ) {
      const right = pieces[rightIndex]
      if (!right || left.segmentIndex === right.segmentIndex) {
        continue
      }
      const intersection = getInclusiveLineIntersection(
        left.start,
        left.end,
        right.start,
        right.end
      )
      if (!intersection) {
        continue
      }
      const leftDistance =
        left.startDistance +
        (left.endDistance - left.startDistance) * intersection.leftRatio
      const rightDistance =
        right.startDistance +
        (right.endDistance - right.startDistance) * intersection.rightRatio
      const adjacentSourceTopologySegments = isAdjacentSourceTopologySegment(
        left.segmentIndex,
        right.segmentIndex,
        sourcePath.segments.length,
        sourcePath.closed
      )
      const onlySharedSourceTopologyEndpoint =
        adjacentSourceTopologySegments &&
        (leftDistance <= left.sourceTopologyStartDistance + EPSILON ||
          leftDistance >= left.sourceTopologyEndDistance - EPSILON) &&
        (rightDistance <= right.sourceTopologyStartDistance + EPSILON ||
          rightDistance >= right.sourceTopologyEndDistance - EPSILON)
      if (onlySharedSourceTopologyEndpoint) {
        continue
      }

      ;[
        {
          segmentIndex: left.segmentIndex,
          distance: leftDistance,
          startDistance: left.sourceTopologyStartDistance,
          endDistance: left.sourceTopologyEndDistance
        },
        {
          segmentIndex: right.segmentIndex,
          distance: rightDistance,
          startDistance: right.sourceTopologyStartDistance,
          endDistance: right.sourceTopologyEndDistance
        }
      ].forEach((cut) => {
        if (
          cut.distance <=
            cut.startDistance + SOURCE_PATH_DASH_SLICE_TOLERANCE ||
          cut.distance >= cut.endDistance - SOURCE_PATH_DASH_SLICE_TOLERANCE
        ) {
          return
        }
        breakpointsBySegment.get(cut.segmentIndex)?.push(cut.distance)
      })
    }
  }

  let domainIndex = 0
  return sourceSegmentRanges
    .flatMap((range) => {
      const sortedBreakpoints = Array.from(
        new Set(
          (breakpointsBySegment.get(range.segmentIndex) ?? []).map((distance) =>
            Number(distance.toFixed(6))
          )
        )
      ).sort((left, right) => left - right)

      return sortedBreakpoints.flatMap((startDistance, index) => {
        const endDistance = sortedBreakpoints[index + 1]
        if (
          endDistance === undefined ||
          endDistance - startDistance <= EPSILON
        ) {
          return []
        }

        const domain = {
          domainId: `split-range:${domainIndex}`,
          startDistance,
          endDistance,
          sourceSegmentIndex: range.segmentIndex
        }
        domainIndex += 1
        return [domain]
      })
    })
    .filter((domain) => domain.endDistance - domain.startDistance > EPSILON)
    .sort((left, right) => {
      if (Math.abs(left.startDistance - right.startDistance) > EPSILON) {
        return left.startDistance - right.startDistance
      }
      return left.endDistance - right.endDistance
    })
}

const buildSharedSplitRangeDashDomains = ({
  sharedStrokeBoundaryDomains,
  sourceFamily,
  stroke
}: {
  sharedStrokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
  sourceFamily: ResolvedSourceFamily
  stroke: Pick<RenderableStroke, 'position' | 'width'>
}): FigmaLikeSplitRangeDashDomain[] =>
  sharedStrokeBoundaryDomains.flatMap((range) => {
    if (stroke.position === 'inside' && !range.insideEligible) {
      return []
    }
    if (stroke.position === 'outside' && !range.outsideEligible) {
      return []
    }
    const selectedSide =
      stroke.position === 'inside'
        ? range.insideSelectedSide
        : range.outsideSelectedSide
    if (selectedSide === null) {
      return []
    }

    return [
      {
        domainId: range.rangeId,
        boundaryDomainId: range.boundaryDomainId,
        boundaryPoints: range.boundaryPoints,
        boundaryStartDistance: range.boundaryStartDistance,
        boundaryEndDistance: range.boundaryEndDistance,
        boundaryTotalLength: range.boundaryTotalLength,
        startDistance: range.boundaryStartDistance,
        endDistance: range.boundaryEndDistance,
        sourceSegmentIndex: range.sourceSegmentIndex,
        sideAuthority: 'implicit-fill-hole-domain',
        selectedSide,
        filledSide: range.filledSide,
        unfilledSide: range.unfilledSide,
        boundaryRole: range.boundaryRole,
        offsetDistance: stroke.width / 2,
        sideResolutionStatus:
          range.sideResolutionStatus === 'resolved' ? 'resolved' : 'blocked',
        sideResolutionReason:
          range.sideResolutionStatus === 'resolved'
            ? undefined
            : 'shared-source-split-range-side-conflict',
        contourIds:
          range.contourIds.length > 0
            ? range.contourIds
            : sourceFamily.legalDomainHints.contourIds,
        legalDomainIds:
          range.legalFaceIds.length > 0
            ? range.legalFaceIds
            : sourceFamily.legalDomainHints.legalDomainIds
      }
    ]
  })

export const resolveStrokeDomains = ({
  topology,
  sourceFamily,
  stroke,
  sourcePath,
  implicitFillRegions,
  sharedSourceSplitRanges,
  sharedStrokeBoundaryDomains,
  normalizedLegalDomain
}: ResolveStrokeDomainsInput): StrokeDomainPlan => {
  const basePlan = {
    planId: `${sourceFamily.sourceId}:stroke-domain:${stroke.style}:${stroke.position}`,
    sourceId: sourceFamily.sourceId,
    networkId: sourceFamily.networkId,
    supportState: sourceFamily.supportState,
    topologyFamily: sourceFamily.topologyFamily,
    fillRule: sourceFamily.legalDomainHints.fillRule,
    closed: sourceFamily.legalDomainHints.closed,
    totalLength: topology.totalLength,
    strokeStyle: stroke.style,
    strokePosition: stroke.position,
    contourIds: sourceFamily.legalDomainHints.contourIds,
    legalDomainIds: sourceFamily.legalDomainHints.legalDomainIds
  }

  if (sourceFamily.supportState === 'blocked') {
    return {
      ...basePlan,
      blockedReason: sourceFamily.blockedReason,
      intervalDomainKind: 'none',
      sideAuthority: 'none',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: [],
      legalBoundaryDomains: [],
      diagnostics: ['source-family-blocked']
    }
  }

  if (sourceFamily.supportState === 'center-equivalent') {
    return {
      ...basePlan,
      blockedReason: sourceFamily.blockedReason,
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'center-equivalent',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: [],
      legalBoundaryDomains: [],
      diagnostics: ['constrained-open-stroke-is-center-equivalent']
    }
  }

  if (
    sourceFamily.legalDomainHints.compound &&
    isConstrainedPosition(stroke.position)
  ) {
    if (!normalizedLegalDomain) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'missing-normalized-legal-domain',
        intervalDomainKind: 'none',
        sideAuthority: 'implicit-fill-hole-domain',
        requiresImplicitFillHoleSideResolution: true,
        splitRangeDomains: [],
        legalBoundaryDomains: [],
        diagnostics: ['compound-constrained-legal-boundary-domain-missing']
      }
    }

    return {
      ...basePlan,
      intervalDomainKind: 'legal-boundary-span',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true,
      splitRangeDomains: [],
      legalBoundaryDomains: buildLegalBoundaryDomains({
        normalizedLegalDomain,
        strokePosition: stroke.position
      }),
      diagnostics: [
        'compound-constrained-uses-normalized-legal-boundary-domains',
        'side-authority-is-implicit-fill-hole-domain'
      ]
    }
  }

  const hasSharedSelfIntersectingSplitRanges =
    topology.closed &&
    isConstrainedPosition(stroke.position) &&
    ((sharedStrokeBoundaryDomains?.length ?? 0) > 0 ||
      (sharedSourceSplitRanges?.length ?? 0) > 0)
  if (
    isSelfIntersectingConstrained({ topology, stroke }) ||
    hasSharedSelfIntersectingSplitRanges
  ) {
    if (!sourcePath) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'missing-source-path',
        intervalDomainKind: 'none',
        sideAuthority: 'none',
        requiresImplicitFillHoleSideResolution: false,
        splitRangeDomains: [],
        legalBoundaryDomains: [],
        diagnostics: ['self-intersecting-split-range-source-path-missing']
      }
    }
    if (sourcePath.segments.length === 0) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'missing-source-segments',
        intervalDomainKind: 'none',
        sideAuthority: 'none',
        requiresImplicitFillHoleSideResolution: false,
        splitRangeDomains: [],
        legalBoundaryDomains: [],
        diagnostics: ['self-intersecting-split-range-source-segments-missing']
      }
    }

    const resolvedStrokeBoundaryDomains =
      sharedStrokeBoundaryDomains ??
      sharedSourceSplitRanges?.map((range) => ({
        ...range,
        boundaryDomainId: range.boundaryDomainSourceId,
        insideEligible: true,
        outsideEligible: range.boundaryRole === 'outer',
        insideSelectedSide: range.filledSide,
        outsideSelectedSide:
          range.boundaryRole === 'outer' ? range.unfilledSide : null,
        adjacentFilledFaceIds: range.legalFaceIds,
        adjacentUnfilledFaceIds: range.oppositeFaceIds
      }))

    if (
      !resolvedStrokeBoundaryDomains ||
      resolvedStrokeBoundaryDomains.length === 0
    ) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'missing-shared-source-split-ranges',
        intervalDomainKind: 'none',
        sideAuthority: 'implicit-fill-hole-domain',
        requiresImplicitFillHoleSideResolution: true,
        splitRangeDomains: [],
        legalBoundaryDomains: [],
        diagnostics: [
          'self-intersecting-side-resolution-must-come-from-shared-model'
        ]
      }
    }

    const splitRangeDomains = buildSharedSplitRangeDashDomains({
      sharedStrokeBoundaryDomains: resolvedStrokeBoundaryDomains,
      sourceFamily,
      stroke
    })
    const sideResolutionContext: StrokeDomainSideResolutionContext = {
      sourcePath,
      topologyPoints: topology.normalizedPoints,
      fillRule: sourceFamily.legalDomainHints.fillRule,
      strokePosition: stroke.position as 'inside' | 'outside',
      strokeWidth: stroke.width,
      implicitFillRegions
    }
    const blockedSideDomain = splitRangeDomains.find(
      (domain) => domain.sideResolutionStatus !== 'resolved'
    )
    if (blockedSideDomain) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'ambiguous-side-resolution',
        intervalDomainKind: 'none',
        sideAuthority: 'implicit-fill-hole-domain',
        requiresImplicitFillHoleSideResolution: true,
        splitRangeDomains,
        legalBoundaryDomains: [],
        sideResolutionContext,
        diagnostics: [
          'dash-domains-follow-boundary-domains',
          'side-authority-is-implicit-fill-hole-domain',
          `split-range-side-resolution-blocked:${blockedSideDomain.domainId}`
        ]
      }
    }

    return {
      ...basePlan,
      intervalDomainKind:
        isSelfIntersectingConstrainedDashed({
          topology,
          stroke
        }) || hasSharedSelfIntersectingSplitRanges
          ? 'figma-like-split-range'
          : 'source-path',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true,
      splitRangeDomains,
      legalBoundaryDomains: [],
      sideResolutionContext,
      diagnostics: [
        'dash-domains-follow-boundary-domains',
        'side-authority-is-implicit-fill-hole-domain'
      ]
    }
  }

  if (isConstrainedPosition(stroke.position) && topology.closed) {
    return {
      ...basePlan,
      intervalDomainKind: 'source-path',
      sideAuthority: 'source-path-orientation',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: [],
      legalBoundaryDomains: [],
      diagnostics: ['simple-closed-constrained-side-uses-source-orientation']
    }
  }

  return {
    ...basePlan,
    intervalDomainKind: 'topology-arc-length',
    sideAuthority: 'none',
    requiresImplicitFillHoleSideResolution: false,
    splitRangeDomains: [],
    legalBoundaryDomains: [],
    diagnostics: ['center-or-unconstrained-stroke-uses-topology-arc-length']
  }
}
