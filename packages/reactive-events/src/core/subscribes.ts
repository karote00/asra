import type { CoreAddElementEvent } from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToCoreAddElement =
  createSubscribeEvent<CoreAddElementEvent>(EventTypes.CORE_ADD_ELEMENT)
