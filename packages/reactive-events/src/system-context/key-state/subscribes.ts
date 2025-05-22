import type { UpdateKeyStateEvent } from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToUpdateKeyState =
  createSubscribeEvent<UpdateKeyStateEvent>(EventTypes.UPDATE_KEY_STATE)
