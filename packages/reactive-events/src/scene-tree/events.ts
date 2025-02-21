import type { ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EventTypes } from '../types'

export interface SceneTreeLoadCompleteEvent {
  type: EventTypes.SCENE_TREE_LOAD_COMPLETE
}

export interface AddElementEvent {
  type: EventTypes.ADD_ELEMENT
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index?: number
  }
}

export interface RemoveElementEvent {
  type: EventTypes.REMOVE_ELEMENT
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index: number
  }
}

export interface UpdateElementEvent {
  type: EventTypes.UPDATE_ELEMENT
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
