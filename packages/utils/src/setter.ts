import type { DataTypes, EvnetOptions } from './types/index.js'

/** Change record passed to Setter callback */
export interface SetterChangeRecord {
  id: string
  key: string
  before: DataTypes
  after: DataTypes
  options?: EvnetOptions
}
import lodash from 'lodash'
import { ElementInstanceDataTypes } from './sceneTree/index.js'
import { PropertyComponentInstanceDataTypes } from './propsManager/index.js'

const { cloneDeep, isEqual } = lodash

type InstanceDataType =
  | ElementInstanceDataTypes
  | PropertyComponentInstanceDataTypes

export class Setter<T extends InstanceDataType> {
  data!: T
  private addChangeCallback: (data: SetterChangeRecord) => void
  private onCanonicalWrite?: () => void
  private listeners = new Set<(data: SetterChangeRecord) => void>()

  constructor(
    addChangeCallback: (data: SetterChangeRecord) => void,
    onCanonicalWrite?: () => void
  ) {
    this.addChangeCallback = addChangeCallback
    this.onCanonicalWrite = onCanonicalWrite
  }

  on(listener: (data: SetterChangeRecord) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emitChange(change: SetterChangeRecord): void {
    this.listeners.forEach((listener) => listener(change))
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
        this.onCanonicalWrite?.()
        const change: SetterChangeRecord = {
          id: this.get('id' as keyof T) as string,
          key: key as string,
          before: before as DataTypes,
          after: after as DataTypes,
          options
        }
        this.addChangeCallback(change)
        this.listeners.forEach((listener) => listener(change))
      }
    }
  }
}

export interface ISetter<T> {
  get<K extends keyof T>(key: K): T[K]
  set<K extends keyof T>(key: K, value: T[K], options?: EvnetOptions): void
  on(listener: (data: SetterChangeRecord) => void): () => void
  emitChange(change: SetterChangeRecord): void
}
