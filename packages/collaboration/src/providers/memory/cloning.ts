import { cloneSharedPublication, type SharedPublication } from '@asyra/factory'
import type { ProviderAwarenessMessage } from '../../provider'

export const clonePublication = (value: SharedPublication): SharedPublication =>
  cloneSharedPublication(value)

export const cloneAwareness = (
  value: ProviderAwarenessMessage
): ProviderAwarenessMessage => structuredClone(value)
