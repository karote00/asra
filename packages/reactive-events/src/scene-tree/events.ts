import type {
  DataTypes,
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
    data: ElementRawData
    parent?: GroupInstanceTypes
    index?: number
  }
}

export interface RemoveElementEvent {
  type: EventTypes
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index: number
  }
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
  options: {
    undoable: boolean
  }
}

export type SceneTreeEvents =
  | SceneTreeInitEvent
  | SceneTreeLoadDataEvent
  | SceneTreeLoadCompleteEvent
  | AddElementEvent
  | RemoveElementEvent
  | UpdateComputedDataEvent
  | ChangeComputedDataEvent
