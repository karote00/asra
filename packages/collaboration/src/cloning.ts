import type { SharedPublication } from '@asyra/factory'

import type { ProviderAwarenessMessage } from './provider'

export const clonePublication = (
  publication: SharedPublication
): SharedPublication => structuredClone(publication)

export const cloneAwareness = (
  value: ProviderAwarenessMessage
): ProviderAwarenessMessage => structuredClone(value)
