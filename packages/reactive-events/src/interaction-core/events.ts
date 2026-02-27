import {
  SystemContextSnapshot,
  DetailType
} from '@asyra/utils'
import type { EventTypes } from '../types'

export interface ExecuteActionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface StartSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface UpdateSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface EndSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export type InteractionCoreEvents =
  | ExecuteActionEvent
  | StartSessionEvent
  | UpdateSessionEvent
  | EndSessionEvent
