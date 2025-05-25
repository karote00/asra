import type {
  FinishRequestElementSelectionEvent,
  RequestElementSelectionEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToRequestElementSelection =
  createSubscribeEvent<RequestElementSelectionEvent>(
    EventTypes.REQUEST_ELEMENT_SELECTION
  )

export const subscribeToFinishRequestElementSelection =
  createSubscribeEvent<FinishRequestElementSelectionEvent>(
    EventTypes.FINISH_REQUEST_ELEMENT_SELECTION
  )
