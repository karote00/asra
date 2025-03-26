import { filter, firstValueFrom } from 'rxjs'
import type {
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData
} from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import { getEventBus, publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { FinishRequestSceneTreeDataEvent } from './events'

export const sceneTreeLoadComplete = () => {
  publishEvent({
    type: EventTypes.SCENE_TREE_LOAD_COMPLETE
  })
}

export const requestSceneTreeData = async () => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is FinishRequestSceneTreeDataEvent =>
        event.type === EventTypes.FINISH_REQUEST_SCENE_TREE_DATA &&
        'payload' in event
    )
  )

  publishEvent({
    type: EventTypes.REQUEST_SCENE_TREE_DATA
  })

  const response = await firstValueFrom(response$)
  return response.payload.data
}

export const finishRequestSceneTreeData = (data: SceneTreeRawData) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_SCENE_TREE_DATA,
    payload: {
      data
    }
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
