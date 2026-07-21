import type { ProviderAwarenessMessage } from '../../provider'

export const cloneBytes = (value: Uint8Array): Uint8Array => value.slice()

export const cloneAwareness = (
  value: ProviderAwarenessMessage
): ProviderAwarenessMessage => structuredClone(value)
