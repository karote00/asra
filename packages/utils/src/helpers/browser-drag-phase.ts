export type BrowserDragPhaseSink = (
  phaseName: string,
  durationMs: number
) => void

const getBrowserDragPhaseSink = (): BrowserDragPhaseSink | undefined =>
  (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: BrowserDragPhaseSink
    }
  ).__asyraBrowserDragPhaseSink

export const measureBrowserDragPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = getBrowserDragPhaseSink()
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

export const measureBrowserDragAsyncPhase = async <T>(
  phaseName: string,
  run: () => Promise<T>
): Promise<T> => {
  const sink = getBrowserDragPhaseSink()
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return await run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}
