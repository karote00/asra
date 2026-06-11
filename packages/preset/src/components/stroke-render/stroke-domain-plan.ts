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

export type StrokeDomainMode =
  | 'center-product'
  | 'simple-open-center-product'
  | 'closed-constrained-domain'
  | 'open-contour-constrained-domain'
  | 'open-dangling-outside-both-sides'
  | 'inside-excluded-open-span'
  | 'unsupported'

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
  domainMode: StrokeDomainMode
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
  stroke.style === 'dashed' &&
  isConstrainedPosition(stroke.position)

const isSelfIntersectingConstrained = ({
  topology,
  stroke
}: Pick<ResolveStrokeDomainsInput, 'topology' | 'stroke'>) =>
  topology.topologyFamily === 'self-intersecting' &&
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
    const isOpenContourOwnedOutsideDomain =
      stroke.position === 'outside' &&
      sourceFamily.legalDomainHints.closed === false &&
      range.boundaryRole !== 'ambiguous' &&
      ((range.contourIds?.length ?? 0) > 0 ||
        (range.legalFaceIds?.length ?? 0) > 0)
    if (stroke.position === 'inside' && !range.insideEligible) {
      return []
    }
    if (
      stroke.position === 'outside' &&
      !range.outsideEligible &&
      !isOpenContourOwnedOutsideDomain
    ) {
      return []
    }
    const selectedSide =
      stroke.position === 'inside'
        ? range.insideSelectedSide
        : (range.outsideSelectedSide ??
          (isOpenContourOwnedOutsideDomain ? range.unfilledSide : null))
    if (selectedSide === null) {
      return []
    }

    const dashDomainStartDistance =
      sourceFamily.legalDomainHints.closed === false
        ? range.boundaryStartDistance
        : stroke.position === 'inside'
          ? range.sourceStartDistance
          : range.boundaryStartDistance
    const dashDomainEndDistance =
      sourceFamily.legalDomainHints.closed === false
        ? range.boundaryEndDistance
        : stroke.position === 'inside'
          ? range.sourceEndDistance
          : range.boundaryEndDistance

    return [
      {
        domainId: range.rangeId,
        boundaryDomainId: range.boundaryDomainId,
        boundaryPoints: range.boundaryPoints,
        boundaryStartDistance: range.boundaryStartDistance,
        boundaryEndDistance: range.boundaryEndDistance,
        boundaryTotalLength: range.boundaryTotalLength,
        startDistance: dashDomainStartDistance,
        endDistance: dashDomainEndDistance,
        sourceStartDistance: Math.min(
          range.sourceStartDistance,
          range.sourceEndDistance
        ),
        sourceEndDistance: Math.max(
          range.sourceStartDistance,
          range.sourceEndDistance
        ),
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

const SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH = SOURCE_PATH_DASH_SLICE_TOLERANCE

const getDomainRange = (domain: FigmaLikeSplitRangeDashDomain) => ({
  startDistance: Math.min(domain.startDistance, domain.endDistance),
  endDistance: Math.max(domain.startDistance, domain.endDistance)
})

const getSourceRange = (
  domain: Pick<
    FigmaLikeSplitRangeDashDomain,
    | 'startDistance'
    | 'endDistance'
    | 'sourceStartDistance'
    | 'sourceEndDistance'
  >
) => {
  const startDistance = domain.sourceStartDistance ?? domain.startDistance
  const endDistance = domain.sourceEndDistance ?? domain.endDistance
  return {
    startDistance: Math.min(startDistance, endDistance),
    endDistance: Math.max(startDistance, endDistance)
  }
}

const getSourcePathTotalLength = (sourcePath: Pick<PathGeometry, 'segments'>) =>
  sourcePath.segments.reduce((sum, segment) => sum + segment.length, 0)

const isOpenEndpointTerminalSourceRange = ({
  sourcePath,
  sourceSegmentIndex,
  startDistance,
  endDistance
}: {
  sourcePath: Pick<PathGeometry, 'segments'>
  sourceSegmentIndex: number
  startDistance: number
  endDistance: number
}) => {
  if (sourcePath.segments.length === 0) {
    return false
  }
  const totalLength = getSourcePathTotalLength(sourcePath)
  return (
    (sourceSegmentIndex === 0 &&
      startDistance <= SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH) ||
    (sourceSegmentIndex === sourcePath.segments.length - 1 &&
      endDistance >= totalLength - SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH)
  )
}

const toSourceCoverageDomain = (
  domain: FigmaLikeSplitRangeDashDomain
): FigmaLikeSplitRangeDashDomain => {
  const sourceRange = getSourceRange(domain)
  return {
    ...domain,
    startDistance: sourceRange.startDistance,
    endDistance: sourceRange.endDistance
  }
}

const buildSourcePathSegmentSpanDomains = (
  sourcePath: Pick<PathGeometry, 'segments'>
) => {
  let cursor = 0
  return sourcePath.segments.flatMap((segment, sourceSegmentIndex) => {
    const startDistance = cursor
    cursor += segment.length
    return cursor - startDistance > EPSILON
      ? [
          {
            domainId: `source-segment-span:${sourceSegmentIndex}`,
            startDistance,
            endDistance: cursor,
            sourceSegmentIndex
          }
        ]
      : []
  })
}

const subtractCoveredSourceRanges = ({
  sourceDomain,
  coveredDomains
}: {
  sourceDomain: FigmaLikeSplitRangeDashDomain
  coveredDomains: FigmaLikeSplitRangeDashDomain[]
}) => {
  const sourceRange = getDomainRange(sourceDomain)
  const coveredRanges = coveredDomains
    .filter(
      (domain) => domain.sourceSegmentIndex === sourceDomain.sourceSegmentIndex
    )
    .map(getDomainRange)
    .map((range) => ({
      startDistance: Math.max(sourceRange.startDistance, range.startDistance),
      endDistance: Math.min(sourceRange.endDistance, range.endDistance)
    }))
    .filter(
      (range) =>
        range.endDistance - range.startDistance >
        SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH
    )
    .sort((left, right) => left.startDistance - right.startDistance)

  const uncoveredRanges: { startDistance: number; endDistance: number }[] = []
  let cursor = sourceRange.startDistance
  coveredRanges.forEach((range) => {
    if (range.startDistance - cursor > SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH) {
      uncoveredRanges.push({
        startDistance: cursor,
        endDistance: range.startDistance
      })
    }
    cursor = Math.max(cursor, range.endDistance)
  })

  if (
    sourceRange.endDistance - cursor >
    SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH
  ) {
    uncoveredRanges.push({
      startDistance: cursor,
      endDistance: sourceRange.endDistance
    })
  }

  return uncoveredRanges
}

const isContourOwnedSourceRange = ({
  sourcePath,
  sourceSegmentIndex,
  startDistance,
  endDistance,
  boundaryRole,
  contourIds,
  legalFaceIds
}: {
  sourcePath: Pick<PathGeometry, 'segments'>
  sourceSegmentIndex: number
  startDistance: number
  endDistance: number
  boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  contourIds?: string[]
  legalFaceIds?: string[]
}) =>
  boundaryRole !== 'ambiguous' &&
  ((contourIds?.length ?? 0) > 0 || (legalFaceIds?.length ?? 0) > 0) &&
  !isOpenEndpointTerminalSourceRange({
    sourcePath,
    sourceSegmentIndex,
    startDistance,
    endDistance
  })

const buildContourOwnedSourceCoverages = (
  sourcePath: Pick<PathGeometry, 'segments'>,
  sharedSourceSplitRanges: ResolvedVectorSourceSplitRange[] | undefined
) =>
  (sharedSourceSplitRanges ?? [])
    .filter((range) => {
      const sourceRange = {
        startDistance: Math.min(
          range.sourceStartDistance,
          range.sourceEndDistance
        ),
        endDistance: Math.max(
          range.sourceStartDistance,
          range.sourceEndDistance
        )
      }
      return isContourOwnedSourceRange({
        sourcePath,
        sourceSegmentIndex: range.sourceSegmentIndex,
        startDistance: sourceRange.startDistance,
        endDistance: sourceRange.endDistance,
        boundaryRole: range.boundaryRole,
        contourIds: range.contourIds,
        legalFaceIds: range.legalFaceIds
      })
    })
    .map((range) => ({
      domainId: `contour-owned-source-range:${range.rangeId}`,
      sourceSegmentIndex: range.sourceSegmentIndex,
      startDistance: Math.min(
        range.sourceStartDistance,
        range.sourceEndDistance
      ),
      endDistance: Math.max(range.sourceStartDistance, range.sourceEndDistance)
    }))
    .filter(
      (range) =>
        range.endDistance - range.startDistance >
        SOURCE_SPAN_PRODUCT_DOMAIN_MIN_LENGTH
    )

const subtractContourOwnedSourceRanges = ({
  sourceDomain,
  candidateRange,
  contourOwnedRanges
}: {
  sourceDomain: FigmaLikeSplitRangeDashDomain
  candidateRange: { startDistance: number; endDistance: number }
  contourOwnedRanges: FigmaLikeSplitRangeDashDomain[]
}) =>
  subtractCoveredSourceRanges({
    sourceDomain: {
      ...sourceDomain,
      startDistance: candidateRange.startDistance,
      endDistance: candidateRange.endDistance
    },
    coveredDomains: contourOwnedRanges
  })

const supplementInsideDashedSourceSpanDomains = ({
  sourcePath,
  splitRangeDomains
}: {
  sourcePath: Pick<PathGeometry, 'segments'> &
    Partial<Pick<PathGeometry, 'closed'>>
  splitRangeDomains: FigmaLikeSplitRangeDashDomain[]
}): FigmaLikeSplitRangeDashDomain[] => {
  const sourceDomains = buildSourcePathSegmentSpanDomains(sourcePath)
  let productDomainIndex = 0
  const productDomains = sourceDomains.flatMap((sourceDomain) =>
    subtractCoveredSourceRanges({
      sourceDomain,
      coveredDomains: splitRangeDomains
    }).map((range) => {
      const domain: FigmaLikeSplitRangeDashDomain = {
        domainId: `source-span-product-domain:${sourceDomain.domainId}:${productDomainIndex}`,
        domainMode: 'closed-constrained-domain',
        startDistance: range.startDistance,
        endDistance: range.endDistance,
        sourceSegmentIndex: sourceDomain.sourceSegmentIndex,
        selectedSide: 1,
        filledSide: 1,
        unfilledSide: -1,
        boundaryRole: 'ambiguous',
        sideResolutionStatus: 'resolved',
        sideResolutionReason: 'source-span-product-domain'
      }
      productDomainIndex += 1
      return domain
    })
  )

  return productDomains.length > 0
    ? [...splitRangeDomains, ...productDomains]
    : splitRangeDomains
}

const supplementOutsideDashedOpenSourceSpanDomains = ({
  sourcePath,
  splitRangeDomains,
  sharedSourceSplitRanges
}: {
  sourcePath: Pick<PathGeometry, 'segments'> &
    Partial<Pick<PathGeometry, 'closed'>>
  splitRangeDomains: FigmaLikeSplitRangeDashDomain[]
  sharedSourceSplitRanges?: ResolvedVectorSourceSplitRange[]
}): FigmaLikeSplitRangeDashDomain[] => {
  const sourceDomains = buildSourcePathSegmentSpanDomains(sourcePath)
  const contourSplitRangeDomains = splitRangeDomains.filter((domain) => {
    return (
      domain.sideResolutionStatus === 'resolved' &&
      domain.boundaryRole !== 'ambiguous'
    )
  })
  const contourSplitRangeSourceCoverages = contourSplitRangeDomains.map(
    toSourceCoverageDomain
  )
  const contourOwnedRanges = buildContourOwnedSourceCoverages(
    sourcePath,
    sharedSourceSplitRanges
  )
  let danglingDomainIndex = 0
  const danglingDomains = sourceDomains.flatMap((sourceDomain) =>
    subtractCoveredSourceRanges({
      sourceDomain,
      coveredDomains: contourSplitRangeSourceCoverages
    })
      .flatMap((range) =>
        subtractContourOwnedSourceRanges({
          sourceDomain,
          candidateRange: range,
          contourOwnedRanges
        })
      )
      .map((range) => {
        const domain: FigmaLikeSplitRangeDashDomain = {
          domainId: `dangling-source-span-domain:${sourceDomain.domainId}:${danglingDomainIndex}`,
          domainMode: 'open-dangling-outside-both-sides',
          startDistance: range.startDistance,
          endDistance: range.endDistance,
          sourceStartDistance: range.startDistance,
          sourceEndDistance: range.endDistance,
          sourceSegmentIndex: sourceDomain.sourceSegmentIndex,
          boundaryRole: 'ambiguous',
          sideResolutionStatus: 'resolved',
          sideResolutionReason: 'open-dangling-outside-both-sides'
        }
        danglingDomainIndex += 1
        return domain
      })
  )

  return danglingDomains.length > 0
    ? [...contourSplitRangeDomains, ...danglingDomains]
    : contourSplitRangeDomains
}

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
      domainMode: 'unsupported',
      intervalDomainKind: 'none',
      sideAuthority: 'none',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: [],
      legalBoundaryDomains: [],
      diagnostics: ['source-family-blocked']
    }
  }

  const hasOpenSelfIntersectingImplicitSplitRanges =
    !topology.closed &&
    isConstrainedPosition(stroke.position) &&
    (implicitFillRegions?.length ?? 0) > 0 &&
    ((sharedStrokeBoundaryDomains?.length ?? 0) > 0 ||
      (sharedSourceSplitRanges?.length ?? 0) > 0)

  if (
    sourceFamily.supportState === 'center-equivalent' &&
    !hasOpenSelfIntersectingImplicitSplitRanges
  ) {
    return {
      ...basePlan,
      blockedReason: sourceFamily.blockedReason,
      domainMode: 'simple-open-center-product',
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'center-equivalent',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: [],
      legalBoundaryDomains: [],
      diagnostics: ['simple-open-stroke-is-center-equivalent']
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
        domainMode: 'unsupported',
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
      domainMode: topology.closed
        ? 'closed-constrained-domain'
        : 'open-contour-constrained-domain',
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
        domainMode: 'unsupported',
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
        domainMode: 'unsupported',
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
        domainMode: 'unsupported',
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
    const supplementedSplitRangeDomains =
      stroke.position === 'inside' && topology.closed
        ? supplementInsideDashedSourceSpanDomains({
            sourcePath,
            splitRangeDomains
          })
        : stroke.position === 'outside' && !topology.closed
          ? supplementOutsideDashedOpenSourceSpanDomains({
              sourcePath,
              splitRangeDomains,
              sharedSourceSplitRanges
            })
          : splitRangeDomains
    const sideResolutionContext: StrokeDomainSideResolutionContext = {
      sourcePath,
      topologyPoints: topology.normalizedPoints,
      fillRule: sourceFamily.legalDomainHints.fillRule,
      strokePosition: stroke.position as 'inside' | 'outside',
      strokeWidth: stroke.width,
      implicitFillRegions
    }
    const blockedSideDomain = supplementedSplitRangeDomains.find(
      (domain) => domain.sideResolutionStatus !== 'resolved'
    )
    if (blockedSideDomain) {
      return {
        ...basePlan,
        supportState: 'blocked',
        blockedReason: 'ambiguous-side-resolution',
        domainMode: 'unsupported',
        intervalDomainKind: 'none',
        sideAuthority: 'implicit-fill-hole-domain',
        requiresImplicitFillHoleSideResolution: true,
        splitRangeDomains: supplementedSplitRangeDomains,
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
      domainMode: topology.closed
        ? 'closed-constrained-domain'
        : stroke.position === 'inside'
          ? 'open-contour-constrained-domain'
          : supplementedSplitRangeDomains.some(
                (domain) =>
                  domain.domainMode === 'open-dangling-outside-both-sides'
              )
            ? 'open-dangling-outside-both-sides'
            : 'open-contour-constrained-domain',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true,
      splitRangeDomains: supplementedSplitRangeDomains,
      legalBoundaryDomains: [],
      sideResolutionContext,
      diagnostics: [
        'dash-domains-follow-boundary-domains',
        'side-authority-is-implicit-fill-hole-domain',
        ...(supplementedSplitRangeDomains.length > splitRangeDomains.length
          ? [
              topology.closed
                ? 'source-span-product-domains-added'
                : 'dangling-source-span-domains-added'
            ]
          : [])
      ]
    }
  }

  if (isConstrainedPosition(stroke.position) && topology.closed) {
    return {
      ...basePlan,
      intervalDomainKind: 'source-path',
      domainMode: 'closed-constrained-domain',
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
    domainMode:
      stroke.position === 'center' ? 'center-product' : 'center-product',
    sideAuthority: 'none',
    requiresImplicitFillHoleSideResolution: false,
    splitRangeDomains: [],
    legalBoundaryDomains: [],
    diagnostics: ['center-or-unconstrained-stroke-uses-topology-arc-length']
  }
}
