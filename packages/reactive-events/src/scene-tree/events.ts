import type {
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asra/utils'
import { EventTypes } from '../types'

export interface SceneTreeLoadCompleteEvent {
  type: EventTypes
}

export interface RequestSceneTreeDataEvent {
  type: EventTypes
}

export interface FinishRequestSceneTreeDataEvent {
  type: EventTypes
  payload: {
    data: SceneTreeRawData
  }
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

export interface UpdateElementEvent {
  type: EventTypes
  payload: {
    elementId: string
    key: string
    before: string[]
    after: string[]
  }
}

export type SceneTreeEvents =
  | SceneTreeLoadCompleteEvent
  | AddElementEvent
  | RemoveElementEvent
  | UpdateElementEvent
