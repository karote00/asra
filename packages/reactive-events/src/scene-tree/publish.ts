import type {
  AddElementsChange,
  CreateElementData,
  ComputedDataPatchChange,
  DataTypes,
  ElementDataFieldChange,
  EVENT_OPTIONS,
  ElementRawData,
  GroupInstanceTypes,
  MoveHierarchyRequest,
  RemoveElementsChange,
  SceneTreeRawData
} from '@asyra/utils'
import { publishEvent, publishEventsToObservers } from '../event-bus.js'
import { EventTypes } from '../types.js'
import type {
  UpdateComputedDataBatchEvent,
  UpdateComputedDataEvent,
  UpdateComputedDataPatchEvent
} from './events.js'

export const publishLocalComputedDataEvents = (
  events: readonly (
    | UpdateComputedDataEvent
    | UpdateComputedDataBatchEvent
    | UpdateComputedDataPatchEvent
  )[]
): void => {
  publishEventsToObservers(events)
}

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

export const addElementByParentId = (
  elementData: CreateElementData,
  parentId: string,
  index?: number,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      data: elementData,
      parentId,
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

export const addElements = (
  change: AddElementsChange,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENTS,
    payload: change,
    options
  })
}

export const removeElements = (
  change: RemoveElementsChange,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.REMOVE_ELEMENTS,
    payload: change,
    options
  })
}

export const moveElements = (
  request: MoveHierarchyRequest,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.MOVE_ELEMENTS,
    payload: {
      request
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
  publishLocalComputedDataEvents([
    {
      type: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id,
        key,
        before,
        after,
        owner: 'computed'
      }
    }
  ])
}

export const updateElementData = (
  id: string,
  changes: readonly ElementDataFieldChange[]
) => {
  publishEvent({
    type: EventTypes.UPDATE_ELEMENT_DATA,
    payload: {
      id,
      changes
    }
  })
}

export const updateComputedDataPatch = (
  id: string,
  patch: ComputedDataPatchChange
) => {
  publishLocalComputedDataEvents([
    {
      type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      payload: {
        id,
        patch
      }
    }
  ])
}
