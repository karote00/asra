import { BehaviorSubject } from 'rxjs'

export interface ManagedPropertyStateAPIs {
  registerProperty: <T>(
    key: string,
    defaultValue: T,
    options?: { silent?: boolean }
  ) => BehaviorSubject<T>
  getManagedProperty: <T>(key: string) => T | undefined
  setManagedProperty: <T>(key: string, value: T) => void
  getManagedPropertyObservable: <T>(
    key: string
  ) => BehaviorSubject<T> | undefined
}
