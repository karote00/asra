export type BrowserDragPhaseSink = (
  phaseName: string,
  durationMs: number
) => void

const browserDragPhaseSinks = new Set<BrowserDragPhaseSink>()

export const subscribeToBrowserDragPhases = (
  sink: BrowserDragPhaseSink
): (() => void) => {
  browserDragPhaseSinks.add(sink)
  return () => browserDragPhaseSinks.delete(sink)
}

export const emitBrowserDragPhase = (
  phaseName: string,
  durationMs: number
): void => {
  for (const sink of browserDragPhaseSinks) {
    try {
      sink(phaseName, durationMs)
    } catch {
      // Diagnostic observers cannot alter the product flow they measure.
    }
  }
}

export const beginBrowserDragPhase = (phaseName: string): (() => void) => {
  if (browserDragPhaseSinks.size === 0) {
    return () => undefined
  }
  const startedAt = performance.now()
  return () => emitBrowserDragPhase(phaseName, performance.now() - startedAt)
}

export const measureBrowserDragPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  if (browserDragPhaseSinks.size === 0) {
    return run()
  }

  const finish = beginBrowserDragPhase(phaseName)
  try {
    return run()
  } finally {
    finish()
  }
}

export const measureBrowserDragAsyncPhase = async <T>(
  phaseName: string,
  run: () => Promise<T>
): Promise<T> => {
  if (browserDragPhaseSinks.size === 0) {
    return run()
  }

  const finish = beginBrowserDragPhase(phaseName)
  try {
    return await run()
  } finally {
    finish()
  }
}
