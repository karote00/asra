import type {
  CreateElementData,
  DataTypes,
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asyra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const sceneTreeInit = () => {
  publishEvent({
    type: EventTypes.SCENE_TREE_INIT
  })
}

export const sceneTreeLoadData = (data: SceneTreeRawData) => {
  publishEvent({
    type: EventTypes.SCENE_TREE_LOAD_DATA,
    payload: {
      data
    }
  })
}

export const sceneTreeLoadComplete = () => {
  publishEvent({
    type: EventTypes.SCENE_TREE_LOAD_COMPLETE
  })
}

export const addElement = (
  elementData: CreateElementData,
  index?: number,
  parent?: GroupInstanceTypes
) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      data: elementData,
      parent,
      index
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
  data: DataTypes,
  options = { undoable: true }
) => {
  publishEvent({
    type: EventTypes.CHANGE_COMPUTED_DATA,
    payload: {
      key,
      data,
      elementIds
    },
    options
  })
}
