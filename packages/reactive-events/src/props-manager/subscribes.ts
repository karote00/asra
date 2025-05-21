import {
  FinishPropsSaveDataEvent,
  PropsLoadDataEvent,
  PropsSaveDataEvent,
  type AddPropertyEvent,
  type RemovePropertyEvent,
  type UpdatePropertyEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToPropsLoadData =
  createSubscribeEvent<PropsLoadDataEvent>(EventTypes.PROPS_LOAD_DATA)

export const subscribeToPropsSaveData =
  createSubscribeEvent<PropsSaveDataEvent>(EventTypes.PROPS_SAVE_DATA)

export const subscribeToFinishPropsSaveData =
  createSubscribeEvent<FinishPropsSaveDataEvent>(
    EventTypes.FINISH_PROPS_SAVE_DATA
  )

export const subscribeToAddProperty = createSubscribeEvent<AddPropertyEvent>(
  EventTypes.ADD_PROPERTY
)

export const subscribeToRemoveProperty =
  createSubscribeEvent<RemovePropertyEvent>(EventTypes.REMOVE_PROPERTY)

export const subscribeToUpdateProperty =
  createSubscribeEvent<UpdatePropertyEvent>(EventTypes.UPDATE_PROPERTY)
