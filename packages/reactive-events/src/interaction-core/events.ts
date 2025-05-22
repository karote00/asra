import { SystemContextSnapshot } from '@asra/utils'
import type { EventTypes } from '../types'

export interface DecideActionEvent {
  type: EventTypes
  payload: {
    systemContextSnapshot: SystemContextSnapshot
  }
}

export type InteractionCoreEvents = DecideActionEvent
