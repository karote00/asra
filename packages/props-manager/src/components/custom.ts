import {
  PropertyTypes,
  Unit,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData
} from '@asyra/utils'
import BaseComponent from './base'

const RESERVED_KEYS = ['id', 'type']

class CustomComponent extends BaseComponent<PropertyComponentInstanceDataTypes> {
  data: PropertyComponentInstanceDataTypes = {
    id: '',
    type: PropertyTypes.CUSTOM
  } as any

  constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
    super()
    // Initialize data with id/type
    this.data.id = data.id || ''
    this.data.type = PropertyTypes.CUSTOM

    // Load other data
    this._init(data)
  }

  // Allow any key except reserved ones to be valid for custom properties
  protected isValidKey(key: keyof PropertyComponentInstanceDataTypes): boolean {
    return !RESERVED_KEYS.includes(key as string)
  }

  // Override set to allow adding new keys dynamically
  set<K extends keyof PropertyComponentInstanceDataTypes>(
    key: K,
    value: PropertyComponentInstanceDataTypes[K]
  ) {
    if (this.isValidKey(key)) {
      this.data[key] = value
      super.set(key, value)
    }
  }

  save(): PropertyComponentRawData {
    const data = super.save()
    const customData = this.getValue()
    return {
      ...data,
      ...customData
    } as PropertyComponentRawData
  }

  load(data: PropertyComponentRawData): void {
    // Init reserved
    this.data.id = data.id
    // Load implementation
    Object.keys(data).forEach((key) => {
      if (this.isValidKey(key as keyof PropertyComponentInstanceDataTypes)) {
        (this.data as any)[key] = (data as any)[key]
      }
    })
  }

  getValue(): Record<string, number> {
    const result: Record<string, number> = {}
    Object.keys(this.data).forEach((key) => {
      if (this.isValidKey(key as any)) {
        result[key] = (this.data as any)[key]
      }
    })
    return result
  }

  getUnit(): Record<string, Unit> {
    // Custom properties currently don't support units explicitly, or map them if needed
    // If data keys end with 'Unit', we could return them.
    // For now return empty.
    return {}
  }
}

export default CustomComponent
