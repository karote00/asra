import type {
  AddPropertyEvent,
  RemovePropertyEvent,
  UpdatePropertyEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToAddProperty = createSubscribeEvent<AddPropertyEvent>(
  EventTypes.ADD_PROPERTY
)

export const subscribeToRemoveProperty =
  createSubscribeEvent<RemovePropertyEvent>(EventTypes.REMOVE_PROPERTY)

export const subscribeToUpdateProperty =
  createSubscribeEvent<UpdatePropertyEvent>(EventTypes.UPDATE_PROPERTY)
