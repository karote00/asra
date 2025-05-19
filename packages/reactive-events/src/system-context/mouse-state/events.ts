import { ModifierKeys, MouseButton, PositionData } from '@asra/utils'
import { EventTypes } from '../../types'

export interface UpdateMouseStateEvent {
  type: EventTypes
  payload: {
    position: PositionData
    button: MouseButton
    down: boolean
    dragging: boolean
    modifiers: ModifierKeys
  }
}

export type MouseStateEvents = UpdateMouseStateEvent
