import { BehaviorSubject } from 'rxjs'
import type {
  SceneTreeYjsChange,
  ComputedAttrs,
  RegistrationDefinitionMetadata
} from '@asyra/utils'
import { isEqual } from 'lodash'

export type PropertyValue =
  | string
  | number
  | boolean
  | null
  | Set<string>
  | string[]
  | Record<string, unknown>[]
  | Record<string, unknown>
  | undefined

export interface TriggerConfig {
  /** YJS change action to watch for */
  action?: string
  /** Specific key within the action (for element properties) */
  key?: string
  /** Whether selection changes should trigger recompute */
  onSelectionChange?: boolean
}

export interface PropertyComputeContext {
  selectedIds: Set<string>
  elements: ComputedAttrs[]
}

export interface PropertyRegistration<T extends PropertyValue> {
  defaultValue: T
  /** Optional registration-graph metadata owned by the defining package. */
  registration?: RegistrationDefinitionMetadata
  /**
   * If true, this is an aggregate property computed from selected elements.
   * The system will automatically compute shared values (MIXED if different).
   */
  aggregate?: boolean
  /**
   * Optional computed key for aggregate properties.
   * Defaults to the property key when omitted.
   */
  aggregateKey?: keyof ComputedAttrs
  /**
   * Custom compute function for derived properties.
   * When provided, it takes priority over aggregate computation.
   */
  compute?: (context: PropertyComputeContext) => T
  /**
   * Value to use when selection is empty. Defaults to defaultValue.
   */
  emptyValue?: T
  /**
   * Source observable for the property.
   * The property value will sync from this observable.
   * Used for system properties from systemContext observables.
   */
  source$?: BehaviorSubject<T>
  /**
   * Triggers that cause this property to recompute.
   * Only used for aggregate properties.
   */
  triggers?: TriggerConfig
}

export class PropertyRegistry {
  private properties = new Map<string, BehaviorSubject<PropertyValue>>()
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous property types */
  private registrations = new Map<string, PropertyRegistration<any>>()
  private subscriptions = new Map<string, import('rxjs').Subscription>()
  private yjsFilters = new Map<
    string,
    (change: SceneTreeYjsChange['payload']) => boolean
  >()

  register<T extends PropertyValue>(
    key: string,
    config: PropertyRegistration<T>
  ): void {
    if (this.properties.has(key)) {
      console.warn(
        `[PropertyRegistry] Property "${key}" already registered, skipping`
      )
      return
    }

    const subject = new BehaviorSubject<PropertyValue>(config.defaultValue)
    this.properties.set(key, subject)
    this.registrations.set(key, config)

    // Setup YJS filter for aggregate properties with triggers
    if (config.aggregate && config.triggers) {
      this.setupYJSFilter(key, config.triggers)
    }

    // Setup subscription for properties with source$
    if (config.source$) {
      const subscription = config.source$.subscribe((value) => {
        subject.next(value)
      })
      this.subscriptions.set(key, subscription)
    }
  }

  private setupYJSFilter(key: string, trigger: TriggerConfig): void {
    this.yjsFilters.set(key, (change) => {
      if (trigger.action && change.action !== trigger.action) return false
      if (trigger.key && 'key' in change && change.key !== trigger.key)
        return false
      return true
    })
  }

  getMatchingProperties(change: SceneTreeYjsChange['payload']): string[] {
    const matching: string[] = []
    this.yjsFilters.forEach((filter, key) => {
      if (filter(change)) {
        matching.push(key)
      }
    })
    return matching
  }

  getSelectionTriggeredKeys(): string[] {
    return Array.from(this.registrations.entries())
      .filter(([, config]) => config.triggers?.onSelectionChange)
      .map(([key]) => key)
  }

  isAggregateProperty(key: string): boolean {
    return this.registrations.get(key)?.aggregate ?? false
  }

  shouldRecomputeOnSelectionChange(key: string): boolean {
    return this.registrations.get(key)?.triggers?.onSelectionChange ?? false
  }

  get<T extends PropertyValue>(key: string): T | undefined {
    return this.properties.get(key)?.getValue() as T | undefined
  }

  set<T extends PropertyValue>(key: string, value: T): void {
    const subject = this.properties.get(key)
    if (!subject) {
      console.warn(`[PropertyRegistry] Property "${key}" not found`)
      return
    }

    const currentValue = subject.getValue()
    if (!isEqual(currentValue, value)) {
      subject.next(value)
    }
  }

  onChange<T extends PropertyValue>(
    key: string,
    callback: (value: T) => void
  ): () => void {
    const subject = this.properties.get(key)
    if (!subject) {
      console.warn(
        `[PropertyRegistry] Cannot subscribe to "${key}", property not found`
      )
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {}
    }

    const subscription = subject.subscribe((value) => {
      callback(value as T)
    })
    return () => subscription.unsubscribe()
  }

  getSubject(key: string): BehaviorSubject<PropertyValue> | undefined {
    return this.properties.get(key)
  }

  getAllPropertyKeys(): string[] {
    return Array.from(this.properties.keys())
  }

  getAggregatePropertyKeys(): string[] {
    return Array.from(this.registrations.entries())
      .filter(([, config]) => config.aggregate)
      .map(([key]) => key)
  }

  getRegistration<T extends PropertyValue>(
    key: string
  ): PropertyRegistration<T> | undefined {
    return this.registrations.get(key) as PropertyRegistration<T> | undefined
  }

  unregister(key: string): void {
    const subscription = this.subscriptions.get(key)
    subscription?.unsubscribe()
    this.subscriptions.delete(key)
    this.properties.delete(key)
    this.registrations.delete(key)
    this.yjsFilters.delete(key)
  }

  clear(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    this.subscriptions.clear()
    this.properties.clear()
    this.registrations.clear()
    this.yjsFilters.clear()
  }
}

export const propertyRegistry = new PropertyRegistry()
