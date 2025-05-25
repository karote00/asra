import type {
  FinishRequestSystemContextSnapshotEvent,
  RequestSystemContextSnapshotEvent
} from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToRequestSystemContextSnapshot =
  createSubscribeEvent<RequestSystemContextSnapshotEvent>(
    EventTypes.REQUEST_SYSTEM_CONTEXT_SNAPSHOT
  )

export const subscribeToFinishRequestSystemContextSnapshot =
  createSubscribeEvent<FinishRequestSystemContextSnapshotEvent>(
    EventTypes.FINISH_REQUEST_SYSTEM_CONTEXT_SNAPSHOT
  )
