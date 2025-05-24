import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType
} from '@asra/utils'
import type { EventTypes } from '../types'

export interface DecideActionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export type InteractionCoreEvents = DecideActionEvent
