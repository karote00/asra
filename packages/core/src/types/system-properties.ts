import type { BehaviorSubject } from 'rxjs'

export interface SystemManagedPropertyAPIs {
  defineSystemProperty: <T>(
    key: string,
    defaultValue: T,
    options?: {
      runtime?: boolean
      silent?: boolean
      validate?: (value: unknown) => value is T
    }
  ) => BehaviorSubject<T>
  registerSystemProperty: <T>(
    key: string,
    defaultValue: T,
    options?: {
      runtime?: boolean
      silent?: boolean
      validate?: (value: unknown) => value is T
    }
  ) => BehaviorSubject<T>
  getSystemProperty: <T>(key: string) => T | undefined
  setSystemProperty: <T>(key: string, value: T) => void
  getSystemPropertyObservable: <T>(
    key: string
  ) => BehaviorSubject<T> | undefined
  hasSystemProperty: (key: string) => boolean
  unregisterSystemProperty: (key: string) => boolean
}
