import type { SharedPublication } from '@asyra/factory'
import { measureBrowserDragPhase } from '@asyra/utils'

import type { ProviderAwarenessMessage } from './provider'

const measureClone = <T>(phaseName: string, clone: () => T): T =>
  measureBrowserDragPhase(phaseName, clone)

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
