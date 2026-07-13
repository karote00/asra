import { BehaviorSubject } from 'rxjs'
import type {
  ManagedPropertyLoadDiagnostic,
  ManagedPropertyRegistrationOptions
} from '../states/managed-property-state'

export interface ManagedPropertyStateAPIs {
  registerProperty: <T>(
    key: string,
    defaultValue: T,
    options?: ManagedPropertyRegistrationOptions<T>
  ) => BehaviorSubject<T>
  getManagedProperty: <T>(key: string) => T | undefined
  setManagedProperty: <T>(key: string, value: T) => void
  getManagedPropertyObservable: <T>(
    key: string
  ) => BehaviorSubject<T> | undefined
  loadManagedProperties: (data: unknown) => ManagedPropertyLoadDiagnostic[]
  saveManagedProperties: () => Record<string, unknown>
}
