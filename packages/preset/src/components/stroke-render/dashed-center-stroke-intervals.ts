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
  domainPlanBoundaryDomainId?: string
  domainPlanBoundaryPoints?: { x: number; y: number }[]
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
  domainPlanDomainMode?: string
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanSideResolutionReason?: string
  openPathTerminalRole?: 'path-start' | 'path-end' | 'start-end' | 'middle'
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
    | 'domain-plan-split-range'
    | 'legal-boundary-span'
    | 'none'
  totalLength: number
  closed: boolean
  splitRangeDomains: DomainPlanSplitRangeDashDomain[]
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

export interface DomainPlanSplitRangeVisualGapOptions {
  capExtension: number
  minimumGapRatio?: number
  tolerance?: number
}

export interface DomainPlanSplitRangeDashDomain {
  domainId: string
  domainMode?: string
  boundaryDomainId?: string
  boundaryPoints?: { x: number; y: number }[]
  boundaryStartDistance?: number
  boundaryEndDistance?: number
  boundaryTotalLength?: number
  startDistance: number
  endDistance: number
  sourceStartDistance?: number
  sourceEndDistance?: number
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

const DEFAULT_SPLIT_RANGE_MIN_VISUAL_GAP_RATIO = 0.6
const DEFAULT_SPLIT_RANGE_VISUAL_GAP_TOLERANCE = 0
const DEFAULT_OPEN_PATH_MIN_VISUAL_GAP_RATIO = 0.6

export interface DashedCenterStrokeIntervalAllocationOptions {
  openPathPolicy?: 'network-balanced-terminals'
  strokeWidth?: number
  cap?: 'butt' | 'round' | 'square' | 'none'
  minimumVisualGapRatio?: number
}

const getDomainPlanSplitRangeMinimumVisualGapRatio = (
  options?: DomainPlanSplitRangeVisualGapOptions
) => {
  if (
    typeof options?.minimumGapRatio === 'number' &&
    Number.isFinite(options.minimumGapRatio) &&
    options.minimumGapRatio >= 0
  ) {
    return options.minimumGapRatio
  }

  return DEFAULT_SPLIT_RANGE_MIN_VISUAL_GAP_RATIO
}

const getOpenPathMinimumVisualGapRatio = (
  options?: DashedCenterStrokeIntervalAllocationOptions
) => {
  if (
    typeof options?.minimumVisualGapRatio === 'number' &&
    Number.isFinite(options.minimumVisualGapRatio) &&
    options.minimumVisualGapRatio >= 0
  ) {
    return options.minimumVisualGapRatio
  }

  return DEFAULT_OPEN_PATH_MIN_VISUAL_GAP_RATIO
}

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

const getNormalizedDashOffset = (offset: number, cycleLength: number) => {
  if (!Number.isFinite(offset) || cycleLength <= 0) {
    return 0
  }

  const nextOffset = offset % cycleLength
  return nextOffset >= 0 ? nextOffset : nextOffset + cycleLength
}

const getOpenPathCapExtension = (
  options?: DashedCenterStrokeIntervalAllocationOptions
) =>
  options?.cap === 'round' || options?.cap === 'square'
    ? Math.max(0, (options.strokeWidth ?? 0) / 2)
    : 0

const getBestOpenPathMiddleDashCandidate = ({
  capExtension,
  dashLength,
  gapLength,
  minimumVisualGapRatio,
  totalLength
}: {
  capExtension: number
  dashLength: number
  gapLength: number
  minimumVisualGapRatio: number
  totalLength: number
}) => {
  const minimumVisualGapLength = gapLength * minimumVisualGapRatio
  const remainingLengthAfterTerminals = totalLength - dashLength
  const maxMiddleDashCount = Math.max(
    0,
    Math.floor(remainingLengthAfterTerminals / dashLength)
  )
  let bestCandidate:
    | {
        middleDashCount: number
        centerlineGapLength: number
        visualGapLength: number
      }
    | undefined

  for (
    let middleDashCount = 0;
    middleDashCount <= maxMiddleDashCount;
    middleDashCount += 1
  ) {
    const gapCount = middleDashCount + 1
    const remainingGapLength =
      totalLength - dashLength - middleDashCount * dashLength
    if (remainingGapLength < 0) {
      continue
    }

    const centerlineGapLength = remainingGapLength / gapCount
    const visualGapLength = centerlineGapLength - capExtension * 2
    if (visualGapLength + 1e-6 < minimumVisualGapLength) {
      continue
    }

    const candidate = {
      middleDashCount,
      centerlineGapLength,
      visualGapLength
    }
    if (!bestCandidate) {
      bestCandidate = candidate
      continue
    }

    const candidateGapDelta = Math.abs(visualGapLength - gapLength)
    const bestGapDelta = Math.abs(bestCandidate.visualGapLength - gapLength)
    if (
      candidateGapDelta < bestGapDelta - 1e-6 ||
      (Math.abs(candidateGapDelta - bestGapDelta) <= 1e-6 &&
        middleDashCount > bestCandidate.middleDashCount)
    ) {
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

const getOpenPathMiddleDashPhaseShift = ({
  candidate,
  capExtension,
  cycleLength,
  gapLength,
  minimumVisualGapRatio,
  offset
}: {
  candidate: {
    centerlineGapLength: number
    middleDashCount: number
  }
  capExtension: number
  cycleLength: number
  gapLength: number
  minimumVisualGapRatio: number
  offset: number
}) => {
  if (candidate.middleDashCount <= 0 || cycleLength <= 0) {
    return 0
  }

  const minimumCenterlineGapLength =
    gapLength * minimumVisualGapRatio + capExtension * 2
  const maxShift = Math.max(
    0,
    candidate.centerlineGapLength - minimumCenterlineGapLength
  )
  if (maxShift <= 0) {
    return 0
  }

  const normalizedOffset = getNormalizedDashOffset(offset, cycleLength)
  const signedOffset =
    normalizedOffset > cycleLength / 2
      ? cycleLength - normalizedOffset
      : -normalizedOffset
  return Math.max(-maxShift, Math.min(maxShift, signedOffset))
}

const allocateOpenPathBalancedTerminalRawIntervals = (
  totalLength: number,
  pattern: number[],
  offset: number,
  options?: DashedCenterStrokeIntervalAllocationOptions
): RawDashedCenterStrokeInterval[] => {
  const dashLength = pattern[0] ?? 0
  const gapLength = pattern[1] ?? dashLength
  if (dashLength <= 0 || gapLength <= 0) {
    return []
  }

  if (totalLength <= dashLength + 1e-6) {
    return [
      {
        kind: 'visible',
        authoredIndex: 0,
        startDistance: 0,
        endDistance: totalLength,
        intervalLength: totalLength,
        wrapsSeam: false,
        openPathTerminalRole: 'start-end'
      }
    ]
  }

  const capExtension = getOpenPathCapExtension(options)
  const minimumVisualGapRatio = getOpenPathMinimumVisualGapRatio(options)
  const candidate = getBestOpenPathMiddleDashCandidate({
    capExtension,
    dashLength,
    gapLength,
    minimumVisualGapRatio,
    totalLength
  })
  if (!candidate) {
    return [
      {
        kind: 'visible',
        authoredIndex: 0,
        startDistance: 0,
        endDistance: totalLength,
        intervalLength: totalLength,
        wrapsSeam: false,
        openPathTerminalRole: 'start-end'
      }
    ]
  }

  const halfDashLength = dashLength / 2
  const phaseShift = getOpenPathMiddleDashPhaseShift({
    candidate,
    capExtension,
    cycleLength: pattern.reduce((sum, entry) => sum + entry, 0),
    gapLength,
    minimumVisualGapRatio,
    offset
  })
  const visibleRanges: {
    startDistance: number
    endDistance: number
    role: NonNullable<DashedCenterStrokeIntervalRecord['openPathTerminalRole']>
  }[] = [
    {
      startDistance: 0,
      endDistance: halfDashLength,
      role: 'path-start'
    }
  ]

  let cursor = halfDashLength + candidate.centerlineGapLength + phaseShift
  for (
    let middleIndex = 0;
    middleIndex < candidate.middleDashCount;
    middleIndex += 1
  ) {
    visibleRanges.push({
      startDistance: cursor,
      endDistance: cursor + dashLength,
      role: 'middle'
    })
    cursor += dashLength + candidate.centerlineGapLength
  }

  visibleRanges.push({
    startDistance: totalLength - halfDashLength,
    endDistance: totalLength,
    role: 'path-end'
  })

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
      wrapsSeam: false,
      openPathTerminalRole: visibleRange.role
    })
  })

  return rawIntervals
}

export const allocateDashedCenterStrokeIntervals = (
  totalLength: number,
  pattern: number[],
  offset: number,
  closed: boolean,
  options: DashedCenterStrokeIntervalAllocationOptions = {}
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

  if (!closed && options.openPathPolicy === 'network-balanced-terminals') {
    return withVisibleIntervalLinks(
      allocateOpenPathBalancedTerminalRawIntervals(
        totalLength,
        pattern,
        offset,
        options
      )
    )
  }

  const normalizedOffset = getNormalizedDashOffset(offset, cycleLength)

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

const getBestDomainPlanSplitRangeDashUnitCount = (
  rangeLength: number,
  dashLength: number,
  referenceGapLength: number,
  minimumCenterlineGapLength = 0
) => {
  const epsilon = 1e-6
  if (rangeLength <= dashLength) {
    return 1
  }

  const maxDashUnitCountByDash = Math.max(
    1,
    Math.floor(rangeLength / dashLength)
  )
  const maxDashUnitCountByGap =
    minimumCenterlineGapLength > 0
      ? Math.max(
          1,
          Math.floor(
            rangeLength / (dashLength + minimumCenterlineGapLength) + epsilon
          )
        )
      : maxDashUnitCountByDash
  const maxDashUnitCount = Math.min(
    maxDashUnitCountByDash,
    maxDashUnitCountByGap
  )
  if (!Number.isFinite(referenceGapLength) || referenceGapLength <= 0) {
    return maxDashUnitCount
  }

  const idealCount = rangeLength / (dashLength + referenceGapLength)
  return Math.max(
    1,
    Math.min(maxDashUnitCount, Math.floor(idealCount + 0.5 - epsilon))
  )
}

const getDomainPlanSplitRangeGapLength = (
  rangeLength: number,
  dashLength: number,
  dashUnitCount: number
) => {
  if (dashUnitCount <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return (rangeLength - dashUnitCount * dashLength) / dashUnitCount
}

const getDomainPlanSplitRangeReferenceGapLength = (
  domains: DomainPlanSplitRangeDashDomain[],
  dashLength: number,
  targetGapLength: number
) => {
  const productDomains = domains.filter(
    (domain) => domain.domainMode !== 'inside-excluded-open-span'
  )
  const normalRangeMinLength = 2 * (dashLength + targetGapLength)
  const referenceGaps = productDomains
    .map((domain) => Math.abs(domain.endDistance - domain.startDistance))
    .filter((rangeLength) => rangeLength >= normalRangeMinLength)
    .map((rangeLength) => {
      const dashUnitCount = getBestDomainPlanSplitRangeDashUnitCount(
        rangeLength,
        dashLength,
        targetGapLength
      )
      return getDomainPlanSplitRangeGapLength(
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

const allocateDomainPlanSplitRangeRawIntervals = (
  rangeLength: number,
  dashPattern: number[],
  referenceGapLength?: number,
  minimumCenterlineGapLength = 0
): RawDashedCenterStrokeInterval[] => {
  if (!Number.isFinite(rangeLength) || rangeLength <= 0) {
    return []
  }

  if (!isValidPattern(dashPattern)) {
    return []
  }

  const dashLength = dashPattern[0]
  const targetGapLength = dashPattern[1] ?? dashLength
  if (
    rangeLength <= dashLength ||
    (minimumCenterlineGapLength > 0 &&
      rangeLength <= dashLength + minimumCenterlineGapLength)
  ) {
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
  const dashUnitCount = getBestDomainPlanSplitRangeDashUnitCount(
    rangeLength,
    dashLength,
    referenceGapLength ?? targetGapLength,
    minimumCenterlineGapLength
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

export const allocateDomainPlanSplitRangeDashedIntervals = ({
  domains,
  dashPattern,
  visualGap
}: {
  domains: DomainPlanSplitRangeDashDomain[]
  dashPattern: number[]
  visualGap?: DomainPlanSplitRangeVisualGapOptions
}): StrokeIntervalAllocation[] => {
  const dashLength = dashPattern[0] ?? 0
  const targetGapLength = dashPattern[1] ?? dashLength
  const capExtension =
    visualGap && Number.isFinite(visualGap.capExtension)
      ? Math.max(0, visualGap.capExtension)
      : 0
  const minimumVisualGapLength =
    capExtension > 0
      ? Math.max(
          0,
          targetGapLength *
            getDomainPlanSplitRangeMinimumVisualGapRatio(visualGap) -
            (visualGap?.tolerance ?? DEFAULT_SPLIT_RANGE_VISUAL_GAP_TOLERANCE)
        )
      : 0
  const minimumCenterlineGapLength =
    capExtension > 0 ? minimumVisualGapLength + capExtension * 2 : 0
  const referenceGapLength =
    isValidPattern(dashPattern) && dashLength > 0
      ? getDomainPlanSplitRangeReferenceGapLength(
          domains,
          dashLength,
          targetGapLength
        )
      : targetGapLength

  return domains.map((domain) => {
    if (domain.domainMode === 'inside-excluded-open-span') {
      return {
        domainId: domain.domainId,
        intervals: []
      }
    }

    const startDistance = Math.min(domain.startDistance, domain.endDistance)
    const endDistance = Math.max(domain.startDistance, domain.endDistance)
    const rangeLength = endDistance - startDistance
    const halfDashLength = dashLength / 2
    const getTerminalRole = (
      interval: Pick<
        DashedCenterStrokeIntervalRecord,
        'kind' | 'startDistance' | 'endDistance'
      >
    ): DashedCenterStrokeIntervalRecord['domainPlanTerminalRole'] => {
      if (interval.kind !== 'visible') {
        return undefined
      }
      if (
        interval.startDistance <= startDistance + 1e-6 &&
        interval.endDistance >= endDistance - 1e-6
      ) {
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
    const rawIntervals = allocateDomainPlanSplitRangeRawIntervals(
      rangeLength,
      dashPattern,
      referenceGapLength,
      minimumCenterlineGapLength
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
        domainPlanBoundaryDomainId: domain.boundaryDomainId,
        domainPlanBoundaryPoints: domain.boundaryPoints
          ? domain.boundaryPoints.map((point) => ({ ...point }))
          : undefined,
        domainPlanBoundaryStartDistance: domain.boundaryStartDistance,
        domainPlanBoundaryEndDistance: domain.boundaryEndDistance,
        domainPlanBoundaryTotalLength: domain.boundaryTotalLength,
        domainPlanSplitRangeId: domain.domainId,
        domainPlanSplitRangeStartDistance: startDistance,
        domainPlanSplitRangeEndDistance: endDistance,
        domainPlanTerminalRole: getTerminalRole(interval),
        domainPlanSplitRangeSourceSegmentIndex: domain.sourceSegmentIndex,
        domainPlanSideAuthority: domain.sideAuthority,
        domainPlanSelectedSide: domain.selectedSide,
        domainPlanFilledSide: domain.filledSide,
        domainPlanUnfilledSide: domain.unfilledSide,
        domainPlanBoundaryRole: domain.boundaryRole,
        domainPlanDomainMode: domain.domainMode,
        domainPlanSideResolutionStatus: domain.sideResolutionStatus,
        domainPlanSideResolutionReason: domain.sideResolutionReason
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
  dashOffset,
  visualGap
}: {
  domainPlan: StrokeIntervalDomainPlanInput
  dashPattern: number[]
  dashOffset: number
  visualGap?: DomainPlanSplitRangeVisualGapOptions
}): StrokeIntervalAllocation[] => {
  if (domainPlan.intervalDomainKind === 'none') {
    return []
  }

  if (domainPlan.intervalDomainKind === 'domain-plan-split-range') {
    return allocateDomainPlanSplitRangeDashedIntervals({
      domains: domainPlan.splitRangeDomains,
      dashPattern,
      visualGap
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
