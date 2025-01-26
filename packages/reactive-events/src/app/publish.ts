import { UNDO } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const startTransaction = () => {
  publishEvent({
    type: EventTypes.START_TRANSACTION
  })
}

export const updateTransaction = (eventName: string, payload: unknown) => {
  publishEvent({
    type: EventTypes.UPDATE_TRANSACTION,
    eventName: eventName,
    payload: payload
  })
}

export const endTransaction = () => {
  publishEvent({
    type: EventTypes.END_TRANSACTION
  })
}

export const updateUndoRedoStatus = (status: UNDO) => {
  publishEvent({
    type: EventTypes.UNDOREDO_STATUS,
    status
  })
}
