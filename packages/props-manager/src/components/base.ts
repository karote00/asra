import type {
  DataTypes,
  EvnetOptions,
  IProperty,
  PositionAttrs,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData,
  PropertyFieldSchema,
  PropertyUnitKind,
  PropertyValueKind
} from '@asyra/utils'
import { Setter, Unit, isNil } from '@asyra/utils'
import { getPropertySchema } from '../schema-registry'
import PropsChangeHandler from './props-change-handler'

const propsChangeHandler = new PropsChangeHandler()

abstract class BaseComponent<
    T extends PropertyComponentInstanceDataTypes = PositionAttrs
  >
  extends Setter<T>
  implements IProperty
{
  propNames!: string[]

  constructor() {
    super(propsChangeHandler.addChange)
  }

  private getFieldSchema(key: keyof T): PropertyFieldSchema | undefined {
    const schema = getPropertySchema(this.data.type)
    if (!schema) {
      return undefined
    }

    return schema.fields.find((field) => field.key === key)
  }

  private matchKind(kind: PropertyValueKind, value: unknown): boolean {
    switch (kind) {
      case 'number':
        return typeof value === 'number' && Number.isFinite(value)
      case 'string':
        return typeof value === 'string'
      case 'boolean':
        return typeof value === 'boolean'
      case 'object':
        return value === null || (!!value && typeof value === 'object')
      case 'array':
        return Array.isArray(value)
      case 'custom':
      default:
        return true
    }
  }

  private tryFallback(field: PropertyFieldSchema, shouldFallback: boolean) {
    if (shouldFallback && field.defaultValue !== undefined) {
      return { valid: true, value: field.defaultValue as unknown }
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

    if (!this.matchKind(field.kind, nextValue)) {
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

    if (field.validate && !field.validate(nextValue as never)) {
      return this.tryFallback(field, shouldFallback)
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
