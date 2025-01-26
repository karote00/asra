import type { ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EventTypes } from '../types'

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

export type SceneTreeEvents = AddElementEvent | RemoveElementEvent
