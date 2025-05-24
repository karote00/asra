import { SystemContextSnapshot, InputSystemEvents } from '@asra/utils'
import type { EventTypes } from '../types'

export interface DecideActionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
  }
}

export type InteractionCoreEvents = DecideActionEvent
