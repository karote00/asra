import { signal, type Signal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'
import uiContext, { type PropertyValue } from '@asyra/ui-context'

/**
 * React hook to subscribe to a property value.
 * Automatically updates when the property changes.
 *
 * @template T - The property value type
 * @param key - The property key
 * @returns The current property value
 *
 * @example
 * const zoom = useProperty<number>('zoom')
 * const tool = useProperty<string>('primaryTool')
 */
const propertySignals = new Map<string, Signal<PropertyValue>>()

const getPropertySignal = <T extends PropertyValue>(key: string): Signal<T> => {
  const existing = propertySignals.get(key) as Signal<T> | undefined
  if (existing) {
    return existing
  }

  const initialValue = uiContext.get<T>(key) as T
  const propertySignal = signal<T>(initialValue)

  uiContext.onChange<T>(key, (newValue) => {
    propertySignal.value = newValue
  })

  propertySignals.set(key, propertySignal as Signal<PropertyValue>)
  return propertySignal
}

export function useProperty<T extends PropertyValue>(key: string): T {
  useSignals()

  return getPropertySignal<T>(key).value
}
