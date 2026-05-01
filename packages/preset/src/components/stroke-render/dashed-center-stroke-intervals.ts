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
}

const isValidPattern = (pattern: number[]) =>
  pattern.length > 0 &&
  pattern.every((entry) => Number.isFinite(entry) && entry > 0)

type RawDashedCenterStrokeInterval = Omit<
  DashedCenterStrokeIntervalRecord,
  'intervalId' | 'previousVisibleIntervalId' | 'nextVisibleIntervalId'
>

const pushRawInterval = (
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

  const visibleMergedIndices = mergedIntervals.flatMap((interval, index) =>
    interval.kind === 'visible' ? [index] : []
  )
  const visibleOrderByMergedIndex = new Map(
    visibleMergedIndices.map((mergedIndex, visibleIndex) => [
      mergedIndex,
      visibleIndex
    ])
  )

  return mergedIntervals.map((interval, index) => {
    const visibleIndex = visibleOrderByMergedIndex.get(index) ?? -1
    const previousVisibleIndex =
      visibleIndex > 0 ? visibleMergedIndices[visibleIndex - 1] : undefined
    const nextVisibleIndex =
      visibleIndex >= 0 && visibleIndex < visibleMergedIndices.length - 1
        ? visibleMergedIndices[visibleIndex + 1]
        : undefined

    return {
      ...interval,
      intervalId: `interval:${index}`,
      previousVisibleIntervalId:
        previousVisibleIndex === undefined
          ? null
          : `interval:${previousVisibleIndex}`,
      nextVisibleIntervalId:
        nextVisibleIndex === undefined ? null : `interval:${nextVisibleIndex}`
    }
  })
}
