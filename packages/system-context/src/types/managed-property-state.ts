import { BehaviorSubject } from 'rxjs'
import type {
  ManagedPropertyLoadDiagnostic,
  ManagedPropertyLoadValidationResult,
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
  hasManagedProperty: (key: string) => boolean
  unregisterProperty: (key: string) => boolean
  validateManagedProperties: (
    data: unknown
  ) => ManagedPropertyLoadValidationResult
  /** Apply only an owner-issued validation result; this does not rerun validators. */
  applyValidatedManagedProperties: (
    result: ManagedPropertyLoadValidationResult
  ) => void
  loadManagedProperties: (data: unknown) => ManagedPropertyLoadDiagnostic[]
  saveManagedProperties: () => Record<string, unknown>
}
