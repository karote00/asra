import type { DataTypes, EvnetOptions } from './types'

/** Change record passed to Setter callback */
interface ChangeRecord {
  id: string
  key: string
  before: DataTypes
  after: DataTypes
  options?: EvnetOptions
}
import { isEqual, cloneDeep } from 'lodash'
import { ElementInstanceDataTypes } from './sceneTree'
import { PropertyComponentInstanceDataTypes } from './propsManager'

type InstanceDataType =
  | ElementInstanceDataTypes
  | PropertyComponentInstanceDataTypes

export class Setter<T extends InstanceDataType> {
  data!: T
  private addChangeCallback: (data: ChangeRecord) => void

  constructor(addChangeCallback: (data: ChangeRecord) => void) {
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

      if (!isEqual(before, after)) {
        this.addChangeCallback({
          id: this.get('id'),
          key: key as string,
          before: before as DataTypes,
          after: after as DataTypes,
          options
        })
      }
    }
  }
}

export interface ISetter<T> {
  get<K extends keyof T>(key: K): T[K]
  set<K extends keyof T>(key: K, value: T[K], options?: EvnetOptions): void
}
