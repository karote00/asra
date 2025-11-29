import { EventTypes } from '../../types'

export interface UpdateHoveredElementIdEvent {
  type: EventTypes
  payload: {
    elementId: string | null
  }
}

export type TargetStateEvents = UpdateHoveredElementIdEvent
