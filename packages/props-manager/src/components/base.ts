import type { PropertyComponentInstanceDataTypes } from '@asra/utils'
import { Setter, Unit, isNil } from '@asra/utils'

abstract class BaseComponent<
  T extends PropertyComponentInstanceDataTypes
> extends Setter<T> {
  constructor() {
    super(() => {})
  }

  init(data: Partial<T>) {
    Object.keys(data).forEach((dataKey) => {
      const key = dataKey as keyof T
      if (this.isValidKey(key) && isNil(data[key])) {
        this.set(key, data[key] as T[Extract<keyof T, string>], {
          undoable: false
        })
      }
    })
  }

  update(data: Partial<T>) {
    Object.keys(data).forEach((dataKey) => {
      const key = dataKey as keyof T
      if (this.isValidKey(key) && isNil(data[key])) {
        this.set(key, data[key] as T[Extract<keyof T, string>])
      }
    })
  }

  abstract getValue(): Record<string, number>
  abstract getUnit(): Record<string, Unit>

  protected isValidKey(key: keyof T) {
    return key in this.data
  }
}

export default BaseComponent
