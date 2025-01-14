import type { ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EventTypes } from '../types'

export interface AddRectangleEvent {
  type: EventTypes.ADD_ELEMENT
  payload: {
    elementData: Partial<ElementRawData>
    parent?: GroupInstanceTypes
    index?: number
  }
}

export type SceneTreeEvents = AddRectangleEvent
