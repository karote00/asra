import { EVENT_OPTIONS, UNDO } from '@asyra/utils'
import type {
  RenderPointerPayload,
  RenderPointerCapturePayload,
  EndTransactionOptions,
  RunTransactionOptions,
  TransactionFailure,
  TransactionFailureKind,
  TransactionStatusPayload
} from '@asyra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { getTransactionOwner } from '../transaction-owner'
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
let rollbackOnly = false
let rollbackOnlyFailure: TransactionFailure | undefined

export const startTransaction = () => {
  if (transactionDepth === 0) {
    rollbackOnly = false
    rollbackOnlyFailure = undefined
    getTransactionOwner()?.startTransaction()
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
  const event = {
    type: EventTypes.UPDATE_TRANSACTION,
    eventName: eventName,
    payload: payload,
    options
  } as const
  getTransactionOwner()?.updateTransaction(event)
  publishEvent(event)
}

export const endTransaction = (options: EndTransactionOptions = {}) => {
  if (transactionDepth <= 0) {
    return
  }

  if (options.outcome === 'rollback') {
    rollbackOnly = true
    rollbackOnlyFailure ??= options.failure
  }

  transactionDepth -= 1
  if (transactionDepth === 0) {
    const outcome = rollbackOnly ? 'rollback' : (options.outcome ?? 'commit')
    const failure = rollbackOnlyFailure ?? options.failure
    const payload = failure ? { outcome, failure } : { outcome }
    rollbackOnly = false
    rollbackOnlyFailure = undefined

    let ownerError: unknown
    try {
      getTransactionOwner()?.endTransaction(payload)
    } catch (error) {
      ownerError = error
    } finally {
      publishEvent({
        type: EventTypes.END_TRANSACTION,
        payload
      })
    }
    if (ownerError !== undefined) {
      throw ownerError
    }
  }
}

export const rollbackTransaction = (failure?: TransactionFailure) => {
  endTransaction({ outcome: 'rollback', failure })
}

const toTransactionFailure = (
  cause: unknown,
  kind: TransactionFailureKind = 'explicit'
): TransactionFailure => ({
  kind,
  ...(cause instanceof Error && cause.message
    ? { message: cause.message }
    : {}),
  cause
})

const isPromiseLike = <T>(value: T | Promise<T>): value is Promise<T> =>
  typeof (value as Promise<T> | undefined)?.then === 'function'

export function runTransaction<T>(
  callback: () => Promise<T>,
  options?: RunTransactionOptions
): Promise<T>
export function runTransaction<T>(
  callback: () => T,
  options?: RunTransactionOptions
): T
export function runTransaction<T>(
  callback: () => T | Promise<T>,
  options: RunTransactionOptions = {}
) {
  startTransaction()
  try {
    const result = callback()
    if (isPromiseLike(result)) {
      return result.then(
        (value) => {
          endTransaction()
          return value
        },
        (error: unknown) => {
          rollbackTransaction(toTransactionFailure(error, options.failureKind))
          throw error
        }
      )
    }
    endTransaction()
    return result
  } catch (error) {
    rollbackTransaction(toTransactionFailure(error, options.failureKind))
    throw error
  }
}

export const transactionStatusChanged = (payload: TransactionStatusPayload) => {
  publishEvent({
    type: EventTypes.TRANSACTION_STATUS_CHANGED,
    payload
  })
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
  getTransactionOwner()?.undo()
  publishEvent({
    type: EventTypes.UNDO
  })
}

export const redo = () => {
  getTransactionOwner()?.redo()
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
