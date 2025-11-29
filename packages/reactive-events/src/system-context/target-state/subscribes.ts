import type { UpdateHoveredElementIdEvent } from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToUpdateHoveredElementId = 
  createSubscribeEvent<UpdateHoveredElementIdEvent>(EventTypes.UPDATE_HOVERED_ELEMENT_ID)