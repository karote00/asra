import { Subscription } from 'rxjs'
import type {
  AddPropertyEvent,
  PropChangeCompleteEvent,
  RemovePropertyEvent,
  UpdatePropertyEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToPropChangeComplete =
  createSubscribeEvent<PropChangeCompleteEvent>(EventTypes.PROP_CHANGE_COMPLETE)

export const subscribeToAddProperty = createSubscribeEvent<AddPropertyEvent>(
  EventTypes.ADD_PROPERTY
)

export const subscribeToRemoveProperty =
  createSubscribeEvent<RemovePropertyEvent>(EventTypes.REMOVE_PROPERTY)

export const subscribeToUpdateProperty =
  createSubscribeEvent<UpdatePropertyEvent>(EventTypes.UPDATE_PROPERTY)
