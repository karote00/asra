import { ManagedPropertyState } from '../states/managed-property-state.js'
import type { ManagedPropertyRegistrationOptions } from '../states/managed-property-state.js'

export const createManagedPropertyStateAPIs = (
  managedPropertyState: ManagedPropertyState
) => ({
  /**
   * Register a new managed property in system context
   * Creates an internal observable for the property
   *
   * @param key - Property name
   * @param defaultValue - Default value
   * @returns The BehaviorSubject for the property
   */
  registerProperty: <T>(
    key: string,
    defaultValue: T,
    options?: ManagedPropertyRegistrationOptions<T>
  ) => {
    return managedPropertyState.register<T>(key, defaultValue, options)
  },

  /**
   * Get a managed property value
   */
  getManagedProperty: <T>(key: string) => {
    return managedPropertyState.get<T>(key)
  },

  /**
   * Set a managed property value
   */
  setManagedProperty: <T>(key: string, value: T) => {
    managedPropertyState.set(key, value)
  },

  /**
   * Get the observable for a managed property
   */
  getManagedPropertyObservable: <T>(key: string) => {
    return managedPropertyState.getObservable<T>(key)
  },

  hasManagedProperty: (key: string) => managedPropertyState.has(key),

  unregisterProperty: (key: string) => managedPropertyState.unregister(key),

  validateManagedProperties: (data: unknown) => {
    return managedPropertyState.validateLoadData(data)
  },

  /** Apply only an artifact returned by validateManagedProperties; validators do not rerun. */
  applyValidatedManagedProperties: (
    result: ReturnType<ManagedPropertyState['validateLoadData']>
  ) => {
    managedPropertyState.applyValidatedData(result)
  },

  /**
   * Load managed properties with registration/type guards.
   * Unknown keys and invalid values are ignored with diagnostics.
   */
  loadManagedProperties: (data: unknown) => {
    return managedPropertyState.load(data)
  },

  /**
   * Save currently registered managed properties as plain object data.
   */
  saveManagedProperties: () => {
    return managedPropertyState.save()
  }
})
