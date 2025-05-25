import { Subscription } from 'rxjs'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import {
  generateRequestId,
  PropertyComponentRawData,
  PropsComponentRawData
} from '@asra/utils'
import { FinishPropsSaveDataEvent } from './events'
import { subscribeToFinishPropsSaveData } from './subscribes'

export const propsLoadData = (data: PropsComponentRawData) => {
  publishEvent({
    type: EventTypes.PROPS_LOAD_DATA,
    payload: {
      data
    }
  })
}

export const propsSaveData = () => {
  return new Promise<PropsComponentRawData>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishPropsSaveDataEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.data)
    }

    subscription = subscribeToFinishPropsSaveData(handler)

    publishEvent({
      type: EventTypes.PROPS_SAVE_DATA,
      payload: {
        requestId
      }
    })
  })
}

export const finishPropsSaveData = (
  requestId: string,
  data: PropsComponentRawData
) => {
  publishEvent({
    type: EventTypes.FINISH_PROPS_SAVE_DATA,
    payload: {
      requestId,
      data
    }
  })
}

export const addProperty = (data: Partial<PropertyComponentRawData>[]) => {
  publishEvent({
    type: EventTypes.ADD_PROPERTY,
    payload: {
      data
    }
  })
}

export const removeProperty = (data: Partial<PropertyComponentRawData>[]) => {
  publishEvent({
    type: EventTypes.REMOVE_PROPERTY,
    payload: {
      data
    }
  })
}

export const updateProperty = (data: Partial<PropertyComponentRawData>) => {
  publishEvent({
    type: EventTypes.UPDATE_PROPERTY,
    payload: {
      data
    }
  })
}
