import type {
  IProperty,
  PositionAttrs,
  DataTypes,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData
} from '@asyra/utils'
import { Setter, Unit, isNil } from '@asyra/utils'
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

  _init(data: Partial<T>) {
    Object.keys(data).forEach((dataKey) => {
      const key = dataKey as keyof T
      if (this.isValidKey(key) && !isNil(data[key])) {
        this.data[key] = data[key] as T[Extract<keyof T, string>]
      }
    })
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
