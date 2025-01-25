import type { ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EntityTypes, UNDO } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const addRectangle = (elementData?: ElementRawData) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      undoredo: UNDO.REDO,
      data: elementData ?? { type: EntityTypes.RECTANGLE }
    }
  })
}

export const removeElement = (
  elementData: ElementRawData,
  index: number,
  parent?: GroupInstanceTypes
) => {
  publishEvent({
    type: EventTypes.REMOVE_ELEMENT,
    payload: {
      undoredo: UNDO.REDO,
      data: elementData,
      parent,
      index
    }
  })
}
