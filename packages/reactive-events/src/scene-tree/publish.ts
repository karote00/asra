import type {
  CreateRectangleData,
  DataTypes,
  ElementRawData,
  GroupInstanceTypes
} from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const sceneTreeLoadComplete = () => {
  publishEvent({
    type: EventTypes.SCENE_TREE_LOAD_COMPLETE
  })
}

export const addRectangle = (elementData: CreateRectangleData) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      data: {
        ...elementData,
        type: EntityTypes.RECTANGLE
      }
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

export const updateComputedData = (
  id: string,
  key: string,
  before: DataTypes,
  after: DataTypes
) => {
  publishEvent({
    type: EventTypes.UPDATE_COMPUTED_DATA,
    payload: {
      id,
      key,
      before,
      after
    }
  })
}

export const changeComputedData = (
  elementIds: string[],
  key: string,
  data: DataTypes
) => {
  publishEvent({
    type: EventTypes.CHANGE_COMPUTED_DATA,
    payload: {
      key,
      data,
      elementIds
    }
  })
}
