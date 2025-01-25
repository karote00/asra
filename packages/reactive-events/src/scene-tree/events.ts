import type { ElementRawData, GroupInstanceTypes, UNDO } from '@asra/utils'
import { EventTypes } from '../types'

export interface AddRectangleEvent {
  type: EventTypes.ADD_ELEMENT
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index?: number
    undoredo: UNDO
  }
}

export interface RemoveElementEvent {
  type: EventTypes.REMOVE_ELEMENT
  payload: {
    data: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index: number
    undoredo: UNDO
  }
}

export type SceneTreeEvents = AddRectangleEvent | RemoveElementEvent
