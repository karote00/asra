import type { DataTypes, ElementRawData, GroupInstanceTypes } from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const sceneTreeLoadComplete = () => {
  publishEvent({
    type: EventTypes.SCENE_TREE_LOAD_COMPLETE
  })
}

export const addRectangle = (elementData?: ElementRawData) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
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
      data: elementData,
      parent,
      index
    }
  })
}

export const updateElement = (
  elementId: string,
  key: string,
  before: string[],
  after: string[]
) => {
  publishEvent({
    type: EventTypes.UPDATE_ELEMENT,
    payload: {
      elementId,
      key,
      before,
      after
    }
  })
}
