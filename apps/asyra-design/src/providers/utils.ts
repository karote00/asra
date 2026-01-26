import { useEffect, useState } from 'react'
import type { BehaviorSubject } from 'rxjs'

/**
 * createStore - Subscribes to a BehaviorSubject using useSyncExternalStore
 * and returns its current snapshot (value).
 *
 * @param subject - An RxJS BehaviorSubject, which must have a getValue() method.
 * @returns The current value of the BehaviorSubject.
 */
export function createStore<T>(subject: BehaviorSubject<T>): T {
  const [state, setState] = useState(subject.getValue())

  useEffect(() => {
    const subscription = subject.subscribe(setState)

    return () => {
      subscription.unsubscribe()
    }
  }, [subject])

  return state
}
