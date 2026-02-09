import type { DataTypes, EvnetOptions } from './types'
import { isEqual, cloneDeep } from 'lodash'
import { ElementInstanceDataTypes } from './sceneTree'
import { PropertyComponentInstanceDataTypes } from './propsManager'

type InstanceDataType =
  | ElementInstanceDataTypes
  | PropertyComponentInstanceDataTypes

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

  set<K extends keyof T>(key: K, value: T[K], options?: EvnetOptions): void {
    if (key in this.data) {
      const before = cloneDeep(this.data[key])
      this.data[key] = value
      const after = cloneDeep(value)

      console.log('[Setter.set]', {
        id: this.get('id'),
        key,
        before,
        after,
        isEqual: isEqual(before, after)
      })

      if (!isEqual(before, after)) {
        this.addChangeCallback({
          id: this.get('id'),
          key: key as string,
          before: before as DataTypes,
          after: after as DataTypes
        })
      } else {
        console.warn('[Setter.set] Values are equal, skipping change')
      }
    }
  }
}

export interface ISetter<T> {
  get<K extends keyof T>(key: K): T[K]
  set<K extends keyof T>(key: K, value: T[K]): void
}
