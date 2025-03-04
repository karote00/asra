import type { DataTypes } from './types'
import { ElementAttrs } from './sceneTree'
import { PropComponentDataType } from './propsManager'

type InstanceDataType = ElementAttrs | PropComponentDataType

export class Setter<T extends InstanceDataType> {
  data!: T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addChangeCallback: (data: any) => void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(addChangeCallback: (data: any) => void) {
    this.addChangeCallback = addChangeCallback
  }

  get<K extends keyof T>(key: K): T[K] {
    if (key in this.data) {
      return this.data[key]
    }
    throw new Error('Not allow to get value which is not in entity data.')
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    if (key in this.data) {
      const before = this._cloneData(this.data[key])
      this.data[key] = value
      const after = this._cloneData(value)

      this.addChangeCallback({
        elementId: this.get('id'),
        key: key as string,
        before: before as DataTypes,
        after: after as DataTypes
      })
    }
  }

  private _cloneData<T>(data: T): T {
    if (typeof data === 'number' || typeof data === 'string') {
      return data
    } else if (Array.isArray(data)) {
      return [...data] as T
    } else if (typeof data === 'object' && data !== null) {
      return Object.keys(data).reduce((acc, key) => {
        ;(acc as Record<string, unknown>)[key] = this._cloneData(
          (data as Record<string, unknown>)[key]
        )
        return acc
      }, {} as T)
    }
    return data
  }
}
