import { useSyncExternalStore } from 'react'
import type { ReadonlyView } from './view-source'

export function useViewValue<T, Value>(
  source: ReadonlyView<T>,
  read: (snapshot: T) => Value
): Value {
  return useSyncExternalStore(
    (listener) => source.subscribe(read, listener),
    () => read(source.getSnapshot())
  )
}
