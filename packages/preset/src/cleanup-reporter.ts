export interface CleanupReporter {
  report(): void
  hasReported(): boolean
}

export const createCleanupReporter = (
  onCleanupReady: ((dispose: () => void) => void) | undefined,
  dispose: () => void
): CleanupReporter => {
  let reported = false

  return {
    report: () => {
      if (reported || !onCleanupReady) {
        return
      }

      onCleanupReady(dispose)
      reported = true
    },
    hasReported: () => reported
  }
}
