import type { SelectElementsEvent } from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSelectElements =
  createSubscribeEvent<SelectElementsEvent>(EventTypes.SELECT_ELEMENTS)
