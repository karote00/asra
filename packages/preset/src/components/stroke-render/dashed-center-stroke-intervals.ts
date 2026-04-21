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

export const allocateDashedCenterStrokeIntervals = (
  totalLength: number,
  pattern: number[],
  offset: number,
  closed: boolean
): DashedCenterStrokeIntervalRecord[] => {
  if (!Number.isFinite(totalLength) || totalLength <= 0 || !isValidPattern(pattern)) {
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

  const rawIntervals: Omit<
    DashedCenterStrokeIntervalRecord,
    'intervalId' | 'previousVisibleIntervalId' | 'nextVisibleIntervalId'
  >[] = []

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

  const visibleIntervals = mergedIntervals.filter(
    (interval) => interval.kind === 'visible'
  )

  return mergedIntervals.map((interval, index) => {
    const visibleIndex = visibleIntervals.findIndex(
      (candidate) =>
        candidate.authoredIndex === interval.authoredIndex &&
        candidate.startDistance === interval.startDistance &&
        candidate.endDistance === interval.endDistance
    )

    return {
      ...interval,
      intervalId: `interval:${index}`,
      previousVisibleIntervalId:
        interval.kind === 'visible' && visibleIndex > 0
          ? `interval:${mergedIntervals.findIndex(
              (candidate) =>
                candidate.kind === 'visible' &&
                candidate.authoredIndex === visibleIntervals[visibleIndex - 1]?.authoredIndex &&
                candidate.startDistance ===
                  visibleIntervals[visibleIndex - 1]?.startDistance &&
                candidate.endDistance === visibleIntervals[visibleIndex - 1]?.endDistance
            )}`
          : null,
      nextVisibleIntervalId:
        interval.kind === 'visible' && visibleIndex >= 0 && visibleIndex < visibleIntervals.length - 1
          ? `interval:${mergedIntervals.findIndex(
              (candidate) =>
                candidate.kind === 'visible' &&
                candidate.authoredIndex === visibleIntervals[visibleIndex + 1]?.authoredIndex &&
                candidate.startDistance ===
                  visibleIntervals[visibleIndex + 1]?.startDistance &&
                candidate.endDistance === visibleIntervals[visibleIndex + 1]?.endDistance
            )}`
          : null
    }
  })
}
