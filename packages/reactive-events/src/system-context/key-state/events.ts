import { KeySnapshot } from '@asyra/utils'
import { EventTypes } from '../../types'

export interface UpdateKeyStateEvent {
  type: EventTypes
  payload: KeySnapshot
}

export type KeyStateEvents = UpdateKeyStateEvent
