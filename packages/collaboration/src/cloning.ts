import type { SharedPublication } from '@asyra/factory'

import type { ProviderAwarenessMessage } from './provider'

const measureClone = <T>(phaseName: string, clone: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return clone()
  }
  const startedAt = performance.now()
  try {
    return clone()
  } finally {
    sink(phaseName, performance.now() - startedAt)
  }
}

export const clonePublication = (
  publication: SharedPublication
): SharedPublication =>
  measureClone('collaboration:clone-publication', () =>
    structuredClone(publication)
  )

export const cloneAwareness = (
  value: ProviderAwarenessMessage
): ProviderAwarenessMessage =>
  measureClone('collaboration:clone-awareness', () => structuredClone(value))
