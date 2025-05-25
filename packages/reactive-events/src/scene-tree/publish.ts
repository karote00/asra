import { Subscription } from 'rxjs'
import type {
  CreateRectangleData,
  DataTypes,
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asra/utils'
import { EntityTypes, generateRequestId } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { FinishAddElementEvent, FinishSceneTreeSaveDataEvent } from './events'
import {
  subscribeToFinishAddElement,
  subscribeToFinishSceneTreeSaveData
} from './subscribes'

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

export const sceneTreeSaveData = () => {
  return new Promise<SceneTreeRawData>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishSceneTreeSaveDataEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.data)
    }

    subscription = subscribeToFinishSceneTreeSaveData(handler)

    publishEvent({
      type: EventTypes.SCENE_TREE_SAVE_DATA,
      payload: {
        requestId
      }
    })
  })
}

export const finishSceneTreeSaveData = (
  requestId: string,
  data: SceneTreeRawData
) => {
  publishEvent({
    type: EventTypes.FINISH_SCENE_TREE_SAVE_DATA,
    payload: {
      requestId,
      data
    }
  })
}

export const addRectangle = async (elementData: CreateRectangleData) => {
  return new Promise<string>((resolve) => {
    const requestId = generateRequestId()
    let newElementId = ''
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishAddElementEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      newElementId = payload.elementId
      subscription?.unsubscribe()
      resolve(newElementId)
    }

    subscription = subscribeToFinishAddElement(handler)

    publishEvent({
      type: EventTypes.ADD_ELEMENT,
      payload: {
        requestId,
        data: {
          ...elementData,
          type: EntityTypes.RECTANGLE
        }
      }
    })
  })
}

export const finishAddRectangle = (requestId: string, elementId: string) => {
  publishEvent({
    type: EventTypes.FINISH_ADD_ELEMENT,
    payload: {
      requestId,
      elementId
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
