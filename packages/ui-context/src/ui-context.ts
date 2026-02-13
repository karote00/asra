import { BehaviorSubject } from 'rxjs'
import { ComputedAttrs, MIXED_STRING } from '@asyra/utils'
import { isEqual } from 'lodash'
import {
  propertyRegistry,
  PropertyValue,
  PropertyComputeContext,
  PropertyRegistration
} from './property-registry'

class UIContext {
  registerProperty<T extends PropertyValue>(
    key: string,
    config: PropertyRegistration<T>
  ): void {
    propertyRegistry.register<T>(key, config)
  }

  get<T extends PropertyValue>(key: string): T | undefined {
    return propertyRegistry.get<T>(key)
  }

  set<T extends PropertyValue>(key: string, value: T): void {
    propertyRegistry.set<T>(key, value)
  }

  getSubject<T extends PropertyValue>(
    key: string
  ): BehaviorSubject<T> | undefined {
    return propertyRegistry.getSubject(key) as BehaviorSubject<T> | undefined
  }

  onChange<T extends PropertyValue>(
    key: string,
    callback: (value: T) => void
  ): () => void {
    return propertyRegistry.onChange(key, callback)
  }

  recomputeSelectionProperties(context: PropertyComputeContext): void {
    const keys = propertyRegistry.getSelectionTriggeredKeys()
    if (keys.length === 0) {
      return
    }
    this.recomputeProperties(keys, context)
  }

  recomputeProperties(
    keys: string[],
    context: PropertyComputeContext
  ): void {
    keys.forEach((key) => {
      const nextValue = this.computePropertyValue(key, context)
      if (nextValue !== SKIP_UPDATE) {
        propertyRegistry.set(key, nextValue as PropertyValue)
      }
    })
  }

  private computePropertyValue(
    key: string,
    context: PropertyComputeContext
  ): PropertyValue | typeof SKIP_UPDATE {
    const registration = propertyRegistry.getRegistration(key)
    if (!registration) {
      return SKIP_UPDATE
    }

    if (registration.source$) {
      return SKIP_UPDATE
    }

    const emptyValue = registration.emptyValue ?? registration.defaultValue
    if (context.selectedIds.size === 0) {
      return emptyValue
    }

    if (registration.compute) {
      return registration.compute(context)
    }

    if (registration.aggregate) {
      const aggregateKey =
        registration.aggregateKey ?? (key as keyof ComputedAttrs)
      const values = context.elements
        .map((element) => element[aggregateKey])
        .filter((value) => value !== undefined)
      if (values.length === 0) {
        return emptyValue
      }
      return compareAggregateValues(values)
    }

    return SKIP_UPDATE
  }
}

const uiContext = new UIContext()

export default uiContext
export { UIContext }

const compareAggregateValues = (values: unknown[]) => {
  const firstValue = values[0]
  for (let i = 1; i < values.length; i++) {
    if (!isEqual(values[i], firstValue)) {
      return MIXED_STRING
    }
  }
  return firstValue
}

const SKIP_UPDATE = Symbol('skip-ui-property-update')
