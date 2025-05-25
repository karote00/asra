import { MouseSnapshot } from '@asra/utils'
import { EventTypes } from '../../types'

export interface UpdateMouseStateEvent {
  type: EventTypes
  payload: MouseSnapshot
}

export type MouseStateEvents = UpdateMouseStateEvent
