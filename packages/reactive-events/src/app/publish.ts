import { EVENT_OPTIONS, UNDO } from '@asyra/utils'
import type {
  RenderPointerPayload,
  RenderPointerCapturePayload
} from '@asyra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import type { UserActionCompletedPayload } from './events'

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

let transactionDepth = 0

export const startTransaction = () => {
  if (transactionDepth === 0) {
    publishEvent({
      type: EventTypes.START_TRANSACTION
    })
  }
  transactionDepth += 1
}

export const updateTransaction = (
  eventName: string,
  payload: unknown,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.UPDATE_TRANSACTION,
    eventName: eventName,
    payload: payload,
    options
  })
}

export const endTransaction = () => {
  if (transactionDepth <= 0) {
    publishEvent({
      type: EventTypes.END_TRANSACTION
    })
    return
  }

  transactionDepth -= 1
  if (transactionDepth === 0) {
    publishEvent({
      type: EventTypes.END_TRANSACTION
    })
  }
}

export const userActionCompleted = (payload: UserActionCompletedPayload) => {
  publishEvent({
    type: EventTypes.USER_ACTION_COMPLETED,
    payload
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

// Renderer events - published by render engine adapter
export const renderPointerHover = (payload: string | RenderPointerPayload) => {
  const resolved: RenderPointerPayload =
    typeof payload === 'string'
      ? {
          targetId: payload,
          targetType: 'element',
          targetKind: 'element',
          elementId: payload
        }
      : payload
  publishEvent({
    type: EventTypes.POINTER_HOVER,
    payload: resolved
  })
}

export const renderPointerLeave = (payload: string | RenderPointerPayload) => {
  const resolved: RenderPointerPayload =
    typeof payload === 'string'
      ? {
          targetId: payload,
          targetType: 'element',
          targetKind: 'element',
          elementId: payload
        }
      : payload
  publishEvent({
    type: EventTypes.POINTER_LEAVE,
    payload: resolved
  })
}

export const renderPointerDown = (payload: RenderPointerPayload) => {
  publishEvent({
    type: EventTypes.POINTER_DOWN,
    payload
  })
}

export const renderPointerMove = (payload: RenderPointerPayload) => {
  publishEvent({
    type: EventTypes.POINTER_MOVE,
    payload
  })
}

export const renderPointerUp = (payload: RenderPointerPayload) => {
  publishEvent({
    type: EventTypes.POINTER_UP,
    payload
  })
}

export const renderPointerCaptureStart = (
  payload: RenderPointerCapturePayload
) => {
  publishEvent({
    type: EventTypes.POINTER_CAPTURE_START,
    payload
  })
}

export const renderPointerCaptureEnd = (
  payload: RenderPointerCapturePayload
) => {
  publishEvent({
    type: EventTypes.POINTER_CAPTURE_END,
    payload
  })
}
