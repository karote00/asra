import type {
  AddPropertyEvent,
  RemovePropertyEvent,
  UpdatePropertyEvent
} from './events.js'
import { createSubscribeEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const subscribeToAddProperty = createSubscribeEvent<AddPropertyEvent>(
  EventTypes.ADD_PROPERTY
)

export const subscribeToRemoveProperty =
  createSubscribeEvent<RemovePropertyEvent>(EventTypes.REMOVE_PROPERTY)

export const subscribeToUpdateProperty =
  createSubscribeEvent<UpdatePropertyEvent>(EventTypes.UPDATE_PROPERTY)
