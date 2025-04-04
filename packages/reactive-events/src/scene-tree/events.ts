import type { DataTypes, ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EventTypes } from '../types'

export interface SceneTreeLoadCompleteEvent {
  type: EventTypes
}

export interface AddElementEvent {
  type: EventTypes
  payload: {
    data: Partial<ElementRawData>
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

export interface UpdateElementDataEvent {
  type: EventTypes
  payload: {
    elementId: string
    key: string
    before: DataTypes
    after: DataTypes
  }
}

export interface ChangeElementDataEvent {
  type: EventTypes
  payload: {
    key: string
    data: DataTypes
  }
}

export type SceneTreeEvents =
  | SceneTreeLoadCompleteEvent
  | AddElementEvent
  | RemoveElementEvent
  | UpdateElementDataEvent
  | ChangeElementDataEvent
