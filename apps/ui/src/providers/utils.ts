import { useSyncExternalStore } from 'react'
import type { BehaviorSubject, Observable } from 'rxjs'

/**
 * createStore - Subscribes to a BehaviorSubject using useSyncExternalStore
 * and returns its current snapshot (value).
 *
 * @param subject - An RxJS BehaviorSubject, which must have a getValue() method.
 * @param trigger$ - (Optional) An RxJS Observable that forces updates when emitted.
 * @returns The current value of the BehaviorSubject.
 */
export function createStore<T>(
  subject: BehaviorSubject<T>,
  trigger$?: Observable<unknown>
): T {
  // Define the subscription function: Calls the callback when the subject emits updates.
  const subscribe = (callback: () => void) => {
    const subscription = subject.subscribe(callback)
    const triggerSubscription = trigger$ ? trigger$.subscribe(callback) : null

    return () => {
      subscription.unsubscribe()
      triggerSubscription?.unsubscribe()
    }
  }

  // Define the snapshot retrieval function: Directly returns the current value of the subject.
  const getSnapshot = () => subject.getValue()

  // Use useSyncExternalStore to connect the subscribe function with getSnapshot.
  return useSyncExternalStore(subscribe, getSnapshot)
}
