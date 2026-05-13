import type {
  CreateElementData,
  DataTypes,
  EVENT_OPTIONS,
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asyra/utils'
import { EventTypes } from '../types'

export interface SceneTreeInitEvent {
  type: EventTypes
}

export interface SceneTreeLoadDataEvent {
  type: EventTypes
  payload: {
    data: SceneTreeRawData
  }
}

export interface SceneTreeLoadCompleteEvent {
  type: EventTypes
}

export interface AddElementEvent {
  type: EventTypes
  payload: {
    data: CreateElementData
    parent?: GroupInstanceTypes
    index?: number
  }
  options?: EVENT_OPTIONS
}

export interface RemoveElementEvent {
  type: EventTypes
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
  }
  options?: EVENT_OPTIONS
}

export interface UpdateComputedDataEvent {
  type: EventTypes
  payload: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
  }
}

export interface ChangeComputedDataEvent {
  type: EventTypes
  payload: {
    elementIds: string[]
    key: string
    data: DataTypes
  }
  options: EVENT_OPTIONS
}

export interface ChangeComputedDataBatchEvent {
  type: EventTypes
  payload: {
    elementIds: string[]
    data: Record<string, DataTypes>
  }
  options: EVENT_OPTIONS
}

export type SceneTreeEvents =
  | SceneTreeInitEvent
  | SceneTreeLoadDataEvent
  | SceneTreeLoadCompleteEvent
  | AddElementEvent
  | RemoveElementEvent
  | UpdateComputedDataEvent
  | ChangeComputedDataEvent
  | ChangeComputedDataBatchEvent
