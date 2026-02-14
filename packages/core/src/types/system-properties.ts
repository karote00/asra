import type { BehaviorSubject } from 'rxjs'

export interface SystemManagedPropertyAPIs {
  registerSystemProperty: <T>(
    key: string,
    defaultValue: T
  ) => BehaviorSubject<T>
  getSystemProperty: <T>(key: string) => T | undefined
  setSystemProperty: <T>(key: string, value: T) => void
  getSystemPropertyObservable: <T>(
    key: string
  ) => BehaviorSubject<T> | undefined
}
