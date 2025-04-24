import type {
  CreateRectangleData,
  DataTypes,
  ElementRawData,
  GroupInstanceTypes
} from '@asra/utils'
import { EventTypes } from '../types'

export interface SceneTreeLoadCompleteEvent {
  type: EventTypes
}

export interface AddElementEvent {
  type: EventTypes
  payload: {
    data: CreateRectangleData
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
}

export type SceneTreeEvents =
  | SceneTreeLoadCompleteEvent
  | AddElementEvent
  | RemoveElementEvent
  | UpdateComputedDataEvent
  | ChangeComputedDataEvent
