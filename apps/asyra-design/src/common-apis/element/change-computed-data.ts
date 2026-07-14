import { runTransaction } from '@asyra/core'
import type { DataTypes, EVENT_OPTIONS } from '@asyra/utils'
import core from '../../contexts'

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
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

export const changeComputedData = (
  elementIds: string[],
  data: Record<string, DataTypes>,
  options?: EVENT_OPTIONS
) => {
  const entries = Object.entries(data ?? {})
  if (entries.length === 0) {
    return
  }

  measureBrowserDragPhase('computed:changeComputedData', () => {
    runTransaction(() => core.changeComputedData(elementIds, data, options))
  })
}
