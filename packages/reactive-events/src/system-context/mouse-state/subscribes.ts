import type { UpdateMouseStateEvent } from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToUpdateMouseState =
  createSubscribeEvent<UpdateMouseStateEvent>(EventTypes.UPDATE_MOUSE_STATE)
