import type {
  FinishRequestSystemSnapshotEvent,
  RequestSystemSnapshotEvent
} from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToRequestSystemSnapshot =
  createSubscribeEvent<RequestSystemSnapshotEvent>(
    EventTypes.REQUEST_SYSTEM_SNAPSHOT
  )

export const subscribeToFinishRequestSystemSnapsho =
  createSubscribeEvent<FinishRequestSystemSnapshotEvent>(
    EventTypes.FINISH_REQUEST_SYSTEM_SNAPSHOT
  )
