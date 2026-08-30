import type {
  DataTypes,
  EvnetOptions,
  IProperty,
  PositionAttrs,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData,
  PropertyFieldSchema,
  PropertyUnitKind
} from '@asyra/utils'
import { acknowledgeTransactionReplayApplied } from '@asyra/reactive-events'
import { Setter, Unit, isNil } from '@asyra/utils'
import { getPropertySchema } from '../registries/property-schema.js'
import { matchesPropertyValueKind } from '../registries/property-value-kind.js'
import {
  getPropertyComponentAccessor,
  type PropertyComponentAccessor
} from '../manager/component-accessor.js'

const cloneFallbackValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneFallbackValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (cloned, [key, item]) => {
        cloned[key] = cloneFallbackValue(item)
        return cloned
      },
      {}
    )
  }

  return value
}

abstract class BaseComponent<
  T extends PropertyComponentInstanceDataTypes = PositionAttrs
>
  extends Setter<T>
  implements IProperty
{
  propNames!: string[]
  protected readonly propertyComponentAccessor: PropertyComponentAccessor

  constructor() {
    const propertyComponentAccessor = getPropertyComponentAccessor()
    super(
      (change) => propertyComponentAccessor.addChange(change),
      acknowledgeTransactionReplayApplied
    )
    this.propertyComponentAccessor = propertyComponentAccessor
  }

  private getFieldSchema(key: keyof T): PropertyFieldSchema | undefined {
    const schema = getPropertySchema(this.data.type)
    if (!schema) {
      return
    }

    return schema.fields.find((field) => field.key === key)
  }

  private tryFallback(field: PropertyFieldSchema, shouldFallback: boolean) {
    if (shouldFallback && field.defaultValue !== undefined) {
      return { valid: true, value: cloneFallbackValue(field.defaultValue) }
    }

    return { valid: false, value: undefined as unknown }
  }

  protected validateBySchema(
    key: keyof T,
    value: unknown,
    shouldFallback = false
  ) {
    const field = this.getFieldSchema(key)
    if (!field) {
      return { valid: true, value }
    }

    const nextValue = value

    if (!matchesPropertyValueKind(field.kind, nextValue)) {
      return this.tryFallback(field, shouldFallback)
    }

    if (
      field.allowedUnits &&
      field.allowedUnits.length > 0 &&
      typeof nextValue === 'string' &&
      !field.allowedUnits.includes(nextValue as PropertyUnitKind)
    ) {
      return this.tryFallback(field, shouldFallback)
    }

    if (field.validate) {
      try {
        if (!field.validate(nextValue as never)) {
          return this.tryFallback(field, shouldFallback)
        }
      } catch {
        return this.tryFallback(field, shouldFallback)
      }
    }

    return { valid: true, value: nextValue }
  }

  protected assignLoadedValue(key: keyof T, value: unknown) {
    const sanitized = this.validateBySchema(key, value, true)
    if (!sanitized.valid || !this.isValidKey(key)) {
      return false
    }

    this.data[key] = sanitized.value as T[Extract<keyof T, string>]
    return true
  }

  _init(data: Partial<T>) {
    Object.keys(data).forEach((dataKey) => {
      const key = dataKey as keyof T
      if (this.isValidKey(key) && !isNil(data[key])) {
        this.assignLoadedValue(key, data[key])
      }
    })
  }

  set<K extends keyof T>(key: K, value: T[K], options?: EvnetOptions): void {
    if (!this.isValidKey(key)) {
      return
    }

    const sanitized = this.validateBySchema(key, value, false)
    if (!sanitized.valid) {
      return
    }

    super.set(key, sanitized.value as T[K], options)
  }

  update(data: Partial<T>) {
    Object.keys(data).forEach((dataKey) => {
      const key = dataKey as keyof T
      if (this.isValidKey(key) && !isNil(data[key])) {
        this.set(key, data[key] as T[Extract<keyof T, string>])
      }
    })
  }

  abstract getValue(): Record<string, DataTypes>
  abstract getUnit(): Record<string, Unit>

  protected isValidKey(key: keyof T) {
    return key in this.data
  }

  abstract load(data: PropertyComponentRawData): void

  save(): PropertyComponentRawData {
    return {
      id: this.get('id'),
      type: this.get('type')
    } as PropertyComponentRawData
  }
}

export default BaseComponent
