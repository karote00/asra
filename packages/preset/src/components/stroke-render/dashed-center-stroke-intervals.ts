export type DashedCenterStrokeIntervalKind = 'visible' | 'gap'

export interface DashedCenterStrokeIntervalRecord {
  intervalId: string
  kind: DashedCenterStrokeIntervalKind
  authoredIndex: number
  startDistance: number
  endDistance: number
  intervalLength: number
  wrapsSeam: boolean
  previousVisibleIntervalId: string | null
  nextVisibleIntervalId: string | null
  figmaLikeBoundaryDomainId?: string
  figmaLikeBoundaryPoints?: { x: number; y: number }[]
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
  figmaLikeSideResolutionStatus?: 'resolved' | 'blocked'
  figmaLikeSideResolutionReason?: string
}

export interface StrokeIntervalAllocationDomain {
  domainId: string
  totalLength: number
  closed: boolean
}

export interface StrokeIntervalDomainPlanInput {
  planId: string
  intervalDomainKind:
    | 'topology-arc-length'
    | 'source-path'
    | 'figma-like-split-range'
    | 'legal-boundary-span'
    | 'none'
  totalLength: number
  closed: boolean
  splitRangeDomains: FigmaLikeSplitRangeDashDomain[]
  legalBoundaryDomains: {
    domainId: string
    totalLength: number
    closed: boolean
    sourceSpanIds?: string[]
  }[]
}

export interface StrokeIntervalAllocation {
  domainId: string
  intervals: DashedCenterStrokeIntervalRecord[]
}

export interface FigmaLikeSplitRangeDashDomain {
  domainId: string
  boundaryDomainId?: string
  boundaryPoints?: { x: number; y: number }[]
  boundaryStartDistance?: number
  boundaryEndDistance?: number
  boundaryTotalLength?: number
  startDistance: number
  endDistance: number
  sourceSegmentIndex: number
  sideAuthority?: 'implicit-fill-hole-domain'
  selectedSide?: 1 | -1
  filledSide?: 1 | -1
  unfilledSide?: 1 | -1
  boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  offsetDistance?: number
  sideResolutionStatus?: 'resolved' | 'blocked'
  sideResolutionReason?: string
  sideResolutionVotes?: {
    left: number
    right: number
  }
  contourIds?: string[]
  legalDomainIds?: string[]
}

const isValidPattern = (pattern: number[]) =>
  pattern.length > 0 &&
  pattern.every((entry) => Number.isFinite(entry) && entry > 0)

type RawDashedCenterStrokeInterval = Omit<
  DashedCenterStrokeIntervalRecord,
  'intervalId' | 'previousVisibleIntervalId' | 'nextVisibleIntervalId'
>

const withVisibleIntervalLinks = (
  rawIntervals: RawDashedCenterStrokeInterval[],
  intervalIdPrefix = 'interval'
): DashedCenterStrokeIntervalRecord[] => {
  const visibleRawIndices = rawIntervals.flatMap((interval, index) =>
    interval.kind === 'visible' ? [index] : []
  )
  const visibleOrderByRawIndex = new Map(
    visibleRawIndices.map((rawIndex, visibleIndex) => [rawIndex, visibleIndex])
  )

  return rawIntervals.map((interval, index) => {
    const intervalId = `${intervalIdPrefix}:${index}`
    const visibleIndex = visibleOrderByRawIndex.get(index) ?? -1
    const previousVisibleIndex =
      visibleIndex > 0 ? visibleRawIndices[visibleIndex - 1] : undefined
    const nextVisibleIndex =
      visibleIndex >= 0 && visibleIndex < visibleRawIndices.length - 1
        ? visibleRawIndices[visibleIndex + 1]
        : undefined

    return {
      ...interval,
      intervalId,
      previousVisibleIntervalId:
        previousVisibleIndex === undefined
          ? null
          : `${intervalIdPrefix}:${previousVisibleIndex}`,
      nextVisibleIntervalId:
        nextVisibleIndex === undefined
          ? null
          : `${intervalIdPrefix}:${nextVisibleIndex}`
    }
  })
}

const _pushRawInterval = (
  intervals: RawDashedCenterStrokeInterval[],
  interval: RawDashedCenterStrokeInterval
) => {
  if (interval.endDistance <= interval.startDistance) {
    return
  }

  const previous = intervals[intervals.length - 1]
  if (
    previous &&
    previous.kind === interval.kind &&
    Math.abs(previous.endDistance - interval.startDistance) <= 1e-6 &&
    previous.wrapsSeam === interval.wrapsSeam
  ) {
    previous.endDistance = interval.endDistance
    previous.intervalLength = previous.endDistance - previous.startDistance
    return
  }

  intervals.push(interval)
}

export const allocateDashedCenterStrokeIntervals = (
  totalLength: number,
  pattern: number[],
  offset: number,
  closed: boolean
): DashedCenterStrokeIntervalRecord[] => {
  if (
    !Number.isFinite(totalLength) ||
    totalLength <= 0 ||
    !isValidPattern(pattern)
  ) {
    return []
  }

  const cycleLength = pattern.reduce((sum, entry) => sum + entry, 0)
  if (cycleLength <= 0) {
    return []
  }

  const normalizedOffset = (() => {
    if (!Number.isFinite(offset)) {
      return 0
    }

    const nextOffset = offset % cycleLength
    return nextOffset >= 0 ? nextOffset : nextOffset + cycleLength
  })()

  const rawIntervals: RawDashedCenterStrokeInterval[] = []

  let cursor = -normalizedOffset
  let authoredIndex = 0

  while (cursor < totalLength) {
    const elementLength = pattern[authoredIndex % pattern.length]
    const nextCursor = cursor + elementLength
    const startDistance = Math.max(0, cursor)
    const endDistance = Math.min(totalLength, nextCursor)

    if (endDistance > startDistance) {
      rawIntervals.push({
        kind: authoredIndex % 2 === 0 ? 'visible' : 'gap',
        authoredIndex,
        startDistance,
        endDistance,
        intervalLength: endDistance - startDistance,
        wrapsSeam: false
      })
    }

    cursor = nextCursor
    authoredIndex += 1
  }

  const mergedIntervals = [...rawIntervals]
  if (
    closed &&
    mergedIntervals.length >= 2 &&
    mergedIntervals[0]?.kind === 'visible' &&
    mergedIntervals[0]?.startDistance === 0 &&
    mergedIntervals[mergedIntervals.length - 1]?.kind === 'visible' &&
    mergedIntervals[mergedIntervals.length - 1]?.endDistance === totalLength
  ) {
    const first = mergedIntervals.shift()
    const last = mergedIntervals.pop()
    if (first && last) {
      mergedIntervals.unshift({
        kind: 'visible',
        authoredIndex: last.authoredIndex,
        startDistance: last.startDistance,
        endDistance: first.endDistance,
        intervalLength: last.intervalLength + first.intervalLength,
        wrapsSeam: true
      })
    }
  }

  return withVisibleIntervalLinks(mergedIntervals)
}

const getBestFigmaLikeSplitRangeDashUnitCount = (
  rangeLength: number,
  dashLength: number,
  referenceGapLength: number
) => {
  const epsilon = 1e-6
  if (rangeLength <= dashLength) {
    return 1
  }

  const maxDashUnitCount = Math.max(1, Math.floor(rangeLength / dashLength))
  if (!Number.isFinite(referenceGapLength) || referenceGapLength <= 0) {
    return maxDashUnitCount
  }

  const idealCount = rangeLength / (dashLength + referenceGapLength)
  return Math.max(
    1,
    Math.min(maxDashUnitCount, Math.floor(idealCount + 0.5 - epsilon))
  )
}

const getFigmaLikeSplitRangeGapLength = (
  rangeLength: number,
  dashLength: number,
  dashUnitCount: number
) => {
  if (dashUnitCount <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return (rangeLength - dashUnitCount * dashLength) / dashUnitCount
}

const getFigmaLikeSplitRangeReferenceGapLength = (
  domains: FigmaLikeSplitRangeDashDomain[],
  dashLength: number,
  targetGapLength: number
) => {
  const normalRangeMinLength = 2 * (dashLength + targetGapLength)
  const referenceGaps = domains
    .map((domain) => Math.abs(domain.endDistance - domain.startDistance))
    .filter((rangeLength) => rangeLength >= normalRangeMinLength)
    .map((rangeLength) => {
      const dashUnitCount = getBestFigmaLikeSplitRangeDashUnitCount(
        rangeLength,
        dashLength,
        targetGapLength
      )
      return getFigmaLikeSplitRangeGapLength(
        rangeLength,
        dashLength,
        dashUnitCount
      )
    })
    .filter((gapLength) => Number.isFinite(gapLength) && gapLength > 0)
    .sort((left, right) => left - right)

  if (referenceGaps.length === 0) {
    return targetGapLength
  }

  return referenceGaps[Math.floor(referenceGaps.length / 2)] ?? targetGapLength
}

const allocateFigmaLikeSplitRangeRawIntervals = (
  rangeLength: number,
  dashPattern: number[],
  referenceGapLength?: number
): RawDashedCenterStrokeInterval[] => {
  if (!Number.isFinite(rangeLength) || rangeLength <= 0) {
    return []
  }

  if (!isValidPattern(dashPattern)) {
    return []
  }

  const dashLength = dashPattern[0]
  const targetGapLength = dashPattern[1] ?? dashLength
  if (rangeLength <= dashLength) {
    return [
      {
        kind: 'visible',
        authoredIndex: 0,
        startDistance: 0,
        endDistance: rangeLength,
        intervalLength: rangeLength,
        wrapsSeam: false
      }
    ]
  }

  const halfDashLength = dashLength / 2
  const dashUnitCount = getBestFigmaLikeSplitRangeDashUnitCount(
    rangeLength,
    dashLength,
    referenceGapLength ?? targetGapLength
  )
  const middleDashCount = Math.max(0, dashUnitCount - 1)
  const averageGapLength =
    (rangeLength - dashLength - middleDashCount * dashLength) /
    (middleDashCount + 1)

  const visibleRanges = [
    {
      startDistance: 0,
      endDistance: halfDashLength
    },
    ...Array.from({ length: middleDashCount }, (_, middleIndex) => {
      const startDistance =
        halfDashLength +
        averageGapLength * (middleIndex + 1) +
        dashLength * middleIndex
      return {
        startDistance,
        endDistance: startDistance + dashLength
      }
    }),
    {
      startDistance: rangeLength - halfDashLength,
      endDistance: rangeLength
    }
  ]

  const rawIntervals: RawDashedCenterStrokeInterval[] = []
  visibleRanges.forEach((visibleRange, visibleIndex) => {
    if (visibleIndex > 0) {
      const previousVisibleRange = visibleRanges[visibleIndex - 1]
      _pushRawInterval(rawIntervals, {
        kind: 'gap',
        authoredIndex: visibleIndex * 2 - 1,
        startDistance: previousVisibleRange?.endDistance ?? 0,
        endDistance: visibleRange.startDistance,
        intervalLength:
          visibleRange.startDistance - (previousVisibleRange?.endDistance ?? 0),
        wrapsSeam: false
      })
    }

    _pushRawInterval(rawIntervals, {
      kind: 'visible',
      authoredIndex: visibleIndex * 2,
      startDistance: visibleRange.startDistance,
      endDistance: visibleRange.endDistance,
      intervalLength: visibleRange.endDistance - visibleRange.startDistance,
      wrapsSeam: false
    })
  })

  return rawIntervals
}

export const allocateFigmaLikeSplitRangeDashedIntervals = ({
  domains,
  dashPattern
}: {
  domains: FigmaLikeSplitRangeDashDomain[]
  dashPattern: number[]
}): StrokeIntervalAllocation[] => {
  const dashLength = dashPattern[0] ?? 0
  const targetGapLength = dashPattern[1] ?? dashLength
  const referenceGapLength =
    isValidPattern(dashPattern) && dashLength > 0
      ? getFigmaLikeSplitRangeReferenceGapLength(
          domains,
          dashLength,
          targetGapLength
        )
      : targetGapLength

  return domains.map((domain) => {
    const startDistance = Math.min(domain.startDistance, domain.endDistance)
    const endDistance = Math.max(domain.startDistance, domain.endDistance)
    const rangeLength = endDistance - startDistance
    const halfDashLength = dashLength / 2
    const getTerminalRole = (
      interval: Pick<
        DashedCenterStrokeIntervalRecord,
        'kind' | 'startDistance' | 'endDistance'
      >
    ): DashedCenterStrokeIntervalRecord['figmaLikeTerminalRole'] => {
      if (interval.kind !== 'visible') {
        return undefined
      }
      if (rangeLength <= dashLength) {
        return 'start-end'
      }
      const isStartTerminal =
        Math.abs(interval.startDistance - startDistance) <= 1e-6 &&
        Math.abs(interval.endDistance - (startDistance + halfDashLength)) <=
          1e-6
      const isEndTerminal =
        Math.abs(interval.endDistance - endDistance) <= 1e-6 &&
        Math.abs(interval.startDistance - (endDistance - halfDashLength)) <=
          1e-6
      if (isStartTerminal && isEndTerminal) {
        return 'start-end'
      }
      if (isStartTerminal) {
        return 'start'
      }
      if (isEndTerminal) {
        return 'end'
      }
      return 'middle'
    }
    const rawIntervals = allocateFigmaLikeSplitRangeRawIntervals(
      rangeLength,
      dashPattern,
      referenceGapLength
    ).map((interval) => ({
      ...interval,
      startDistance: interval.startDistance + startDistance,
      endDistance: interval.endDistance + startDistance
    }))

    return {
      domainId: domain.domainId,
      intervals: withVisibleIntervalLinks(
        rawIntervals,
        `${domain.domainId}:interval`
      ).map((interval) => ({
        ...interval,
        figmaLikeBoundaryDomainId: domain.boundaryDomainId,
        figmaLikeBoundaryPoints: domain.boundaryPoints
          ? domain.boundaryPoints.map((point) => ({ ...point }))
          : undefined,
        figmaLikeBoundaryStartDistance: domain.boundaryStartDistance,
        figmaLikeBoundaryEndDistance: domain.boundaryEndDistance,
        figmaLikeBoundaryTotalLength: domain.boundaryTotalLength,
        figmaLikeSplitRangeId: domain.domainId,
        figmaLikeSplitRangeStartDistance: startDistance,
        figmaLikeSplitRangeEndDistance: endDistance,
        figmaLikeTerminalRole: getTerminalRole(interval),
        figmaLikeSplitRangeSourceSegmentIndex: domain.sourceSegmentIndex,
        figmaLikeSideAuthority: domain.sideAuthority,
        figmaLikeSelectedSide: domain.selectedSide,
        figmaLikeFilledSide: domain.filledSide,
        figmaLikeUnfilledSide: domain.unfilledSide,
        figmaLikeBoundaryRole: domain.boundaryRole,
        figmaLikeSideResolutionStatus: domain.sideResolutionStatus,
        figmaLikeSideResolutionReason: domain.sideResolutionReason
      }))
    }
  })
}

export const allocateStrokeIntervals = ({
  domains,
  dashPattern,
  dashOffset
}: {
  domains: StrokeIntervalAllocationDomain[]
  dashPattern: number[]
  dashOffset: number
}): StrokeIntervalAllocation[] =>
  domains.map((domain) => {
    const intervals =
      dashPattern.length > 0
        ? allocateDashedCenterStrokeIntervals(
            domain.totalLength,
            dashPattern,
            dashOffset,
            domain.closed
          )
        : [
            {
              intervalId: 'interval:0',
              kind: 'visible' as const,
              authoredIndex: 0,
              startDistance: 0,
              endDistance: Math.max(0, domain.totalLength),
              intervalLength: Math.max(0, domain.totalLength),
              wrapsSeam: false,
              previousVisibleIntervalId: null,
              nextVisibleIntervalId: null
            }
          ].filter((interval) => interval.intervalLength > 0)

    return {
      domainId: domain.domainId,
      intervals: intervals.map((interval) => ({
        ...interval,
        intervalId: `${domain.domainId}:${interval.intervalId}`,
        previousVisibleIntervalId: interval.previousVisibleIntervalId
          ? `${domain.domainId}:${interval.previousVisibleIntervalId}`
          : null,
        nextVisibleIntervalId: interval.nextVisibleIntervalId
          ? `${domain.domainId}:${interval.nextVisibleIntervalId}`
          : null
      }))
    }
  })

export const allocateStrokeIntervalsForDomainPlan = ({
  domainPlan,
  dashPattern,
  dashOffset
}: {
  domainPlan: StrokeIntervalDomainPlanInput
  dashPattern: number[]
  dashOffset: number
}): StrokeIntervalAllocation[] => {
  if (domainPlan.intervalDomainKind === 'none') {
    return []
  }

  if (domainPlan.intervalDomainKind === 'figma-like-split-range') {
    return allocateFigmaLikeSplitRangeDashedIntervals({
      domains: domainPlan.splitRangeDomains,
      dashPattern
    })
  }

  if (domainPlan.intervalDomainKind === 'legal-boundary-span') {
    return allocateStrokeIntervals({
      domains: domainPlan.legalBoundaryDomains,
      dashPattern,
      dashOffset
    })
  }

  return allocateStrokeIntervals({
    domains: [
      {
        domainId: domainPlan.planId,
        totalLength: domainPlan.totalLength,
        closed: domainPlan.closed
      }
    ],
    dashPattern,
    dashOffset
  })
}
