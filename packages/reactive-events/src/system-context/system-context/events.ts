import { SystemSnapshot } from '@asra/utils'
import { EventTypes } from '../../types'

export interface RequestSystemSnapshotEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestSystemSnapshotEvent {
  type: EventTypes
  payload: {
    requestId: string
    systemSnapshot: SystemSnapshot
  }
}

export type SystemContextSubEvents =
  | RequestSystemSnapshotEvent
  | FinishRequestSystemSnapshotEvent
