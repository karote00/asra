import type {
  CreateElementData,
  ComputedDataPatch,
  ComputedDataPatchChange,
  DataTypes,
  EVENT_OPTIONS,
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
  parent?: GroupInstanceTypes,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      data: elementData,
      parent,
      index
    },
    options
  })
}

export const removeElement = (
  elementData: Partial<ElementRawData>,
  parent?: GroupInstanceTypes,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.REMOVE_ELEMENT,
    payload: {
      data: elementData,
      parent
    },
    options
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
      after,
      owner: 'computed'
    }
  })
}

export const updateComputedDataPatch = (
  id: string,
  patch: ComputedDataPatchChange
) => {
  publishEvent({
    type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
    payload: {
      id,
      patch
    }
  })
}

export const changeComputedData = (
  elementIds: string[],
  key: string,
  data: DataTypes,
  options: EVENT_OPTIONS = { undoable: true }
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

export const changeComputedDataPatch = (
  elementIds: string[],
  patch: ComputedDataPatch,
  options: EVENT_OPTIONS = { undoable: true }
) => {
  publishEvent({
    type: EventTypes.CHANGE_COMPUTED_DATA_PATCH,
    payload: {
      patch,
      elementIds
    },
    options
  })
}

export const changeComputedDataBatch = (
  elementIds: string[],
  data: Record<string, DataTypes>,
  options: EVENT_OPTIONS = { undoable: true }
) => {
  publishEvent({
    type: EventTypes.CHANGE_COMPUTED_DATA_BATCH,
    payload: {
      data,
      elementIds
    },
    options
  })
}
