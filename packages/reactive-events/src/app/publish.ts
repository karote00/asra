import { UNDO } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const renderIsReady = () => {
  publishEvent({
    type: EventTypes.RENDER_IS_READY
  })
}

export const fileLoadComplete = () => {
  publishEvent({
    type: EventTypes.FILE_LOAD_COMPLETE
  })
}

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
    type: EventTypes.UPDATE_UNDOREDO_STATUS,
    payload: {
      status
    }
  })
}

export const undo = () => {
  publishEvent({
    type: EventTypes.UNDO
  })
}

export const redo = () => {
  publishEvent({
    type: EventTypes.REDO
  })
}
