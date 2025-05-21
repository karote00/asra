import { SystemSnapshot } from '@asra/utils'
import type { EventTypes } from '../types'

export interface DecideActionEvent {
  type: EventTypes
  payload: {
    systemSnapshot: SystemSnapshot
  }
}

export type InteractionCoreEvents = DecideActionEvent
