import type {
  CreateRectangleData,
  DataTypes,
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asra/utils'
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

export interface SceneTreeSaveDataEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishSceneTreeSaveDataEvent {
  type: EventTypes
  payload: {
    requestId: string
    data: SceneTreeRawData
  }
}

export interface AddElementEvent {
  type: EventTypes
  payload: {
    requestId: string
    data: CreateRectangleData
    parent?: GroupInstanceTypes
    index?: number
  }
}

export interface FinishAddElementEvent {
  type: EventTypes
  payload: {
    requestId: string
    elementId: string
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
  | SceneTreeSaveDataEvent
  | FinishSceneTreeSaveDataEvent
  | AddElementEvent
  | FinishAddElementEvent
  | RemoveElementEvent
  | UpdateComputedDataEvent
  | ChangeComputedDataEvent
