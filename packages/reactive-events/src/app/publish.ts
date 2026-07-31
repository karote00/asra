import { UNDO } from '@asyra/utils'
import type {
  RenderPointerPayload,
  RenderPointerCapturePayload,
  EndTransactionOptions,
  RunTransactionOptions,
  TransactionFailure,
  TransactionFailureKind,
  TransactionStatusPayload
} from '@asyra/utils'
import { publishEvent, publishEventsToObservers } from '../event-bus'
import { EventTypes } from '../types'
import {
  getTransactionOwner,
  type TransactionOwner
} from '../transaction-owner'
import type {
  UpdateTransactionEvent,
  UserActionCompletedPayload
} from './events'

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

interface TransactionBoundaryState {
  depth: number
  rollbackOnly: boolean
  rollbackOnlyFailure?: TransactionFailure
  pendingObserverEvents: UpdateTransactionEvent[]
}

const createTransactionBoundaryState = (): TransactionBoundaryState => ({
  depth: 0,
  rollbackOnly: false,
  pendingObserverEvents: []
})

const ownerBoundaryStates = new WeakMap<
  TransactionOwner,
  TransactionBoundaryState
>()
const unownedBoundaryState = createTransactionBoundaryState()

const getTransactionBoundaryState = (
  owner: TransactionOwner | null
): TransactionBoundaryState => {
  if (!owner) {
    return unownedBoundaryState
  }

  let state = ownerBoundaryStates.get(owner)
  if (!state) {
    state = createTransactionBoundaryState()
    ownerBoundaryStates.set(owner, state)
  }
  return state
}

export const startTransaction = () => {
  const owner = getTransactionOwner()
  const state = getTransactionBoundaryState(owner)
  if (state.depth === 0) {
    state.rollbackOnly = false
    state.rollbackOnlyFailure = undefined
    state.pendingObserverEvents = []
    owner?.startTransaction()
    publishEvent({
      type: EventTypes.START_TRANSACTION
    })
  }
  state.depth += 1
}

const cloneTransactionValue = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const source = value as object
  const existing = seen.get(source)
  if (existing) {
    return existing as T
  }

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  seen.set(source, clone)
  Reflect.ownKeys(source).forEach((key) => {
    if (Array.isArray(source) && key === 'length') {
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) {
      return
    }
    const snapshot =
      'value' in descriptor ? descriptor.value : Reflect.get(source, key)
    Object.defineProperty(clone, key, {
      value: cloneTransactionValue(snapshot, seen),
      enumerable: descriptor.enumerable,
      configurable: true,
      writable: true
    })
  })
  if (Array.isArray(source) && Array.isArray(clone)) {
    clone.length = source.length
  }

  return clone as T
}

const detachedTransactionValues = new WeakSet<object>()

export const isDetachedTransactionValue = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  detachedTransactionValues.has(value)

const assertFrozenTransactionOwnerValue = (
  value: unknown,
  label: string
): void => {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    !Object.isFrozen(value)
  ) {
    throw new Error(`Detached transaction owner batch requires frozen ${label}`)
  }
}

export const issueDetachedTransactionOwnerBatch = <
  TEvents extends readonly UpdateTransactionEvent[]
>(
  events: TEvents
): TEvents => {
  if (!Array.isArray(events) || !Object.isFrozen(events)) {
    throw new Error(
      'Detached transaction owner batch requires a frozen event array'
    )
  }

  events.forEach((event, eventIndex) => {
    assertFrozenTransactionOwnerValue(event, `event ${eventIndex}`)
    assertFrozenTransactionOwnerValue(
      event.payload,
      `event ${eventIndex} payload`
    )
    assertFrozenTransactionOwnerValue(
      event.options,
      `event ${eventIndex} options`
    )
    const evidence = event.canonicalEvidence
    if (!evidence) {
      return
    }
    assertFrozenTransactionOwnerValue(
      evidence,
      `event ${eventIndex} canonical evidence`
    )
    assertFrozenTransactionOwnerValue(
      evidence.orderedIds,
      `event ${eventIndex} canonical ordered ids`
    )
    if (!evidence.sharedRecords) {
      return
    }
    assertFrozenTransactionOwnerValue(
      evidence.sharedRecords,
      `event ${eventIndex} shared records`
    )
    evidence.sharedRecords.forEach((record, recordIndex) => {
      assertFrozenTransactionOwnerValue(
        record,
        `event ${eventIndex} shared record ${recordIndex}`
      )
      assertFrozenTransactionOwnerValue(
        record.orderedIds,
        `event ${eventIndex} shared record ${recordIndex} ordered ids`
      )
      assertFrozenTransactionOwnerValue(
        record.payload,
        `event ${eventIndex} shared record ${recordIndex} payload`
      )
    })
  })

  detachedTransactionValues.add(events)
  return events
}

const deepFreezeTransactionValue = <T>(
  value: T,
  seen = new WeakSet<object>()
): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const object = value as object
  if (seen.has(object)) {
    return value
  }
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) => {
    deepFreezeTransactionValue(Reflect.get(object, key), seen)
  })
  Object.freeze(value)
  detachedTransactionValues.add(object)
  return value
}

const detachTransactionEvents = (
  events: readonly UpdateTransactionEvent[]
): readonly UpdateTransactionEvent[] =>
  isDetachedTransactionValue(events)
    ? events
    : deepFreezeTransactionValue(cloneTransactionValue([...events]))

export const updateTransactionBatch = (
  events: readonly UpdateTransactionEvent[]
) => {
  if (events.length === 0) {
    return
  }

  const detachedEvents = detachTransactionEvents(events)
  const owner = getTransactionOwner()
  owner?.updateTransactionBatch(detachedEvents)
  const state = getTransactionBoundaryState(owner)
  if (state.depth > 0) {
    state.pendingObserverEvents.push(...detachedEvents)
    return
  }
  publishEventsToObservers(detachedEvents)
}

export const updateTransaction = (event: UpdateTransactionEvent) => {
  updateTransactionBatch([event])
}

export const endTransaction = (options: EndTransactionOptions = {}) => {
  const owner = getTransactionOwner()
  const state = getTransactionBoundaryState(owner)
  if (state.depth <= 0) {
    return
  }

  if (options.outcome === 'rollback') {
    state.rollbackOnly = true
    state.rollbackOnlyFailure ??= options.failure
  }

  state.depth -= 1
  if (state.depth === 0) {
    const outcome = state.rollbackOnly
      ? 'rollback'
      : (options.outcome ?? 'commit')
    const failure = state.rollbackOnlyFailure ?? options.failure
    const payload = failure ? { outcome, failure } : { outcome }
    const pendingObserverEvents = Object.freeze([
      ...state.pendingObserverEvents
    ])
    state.rollbackOnly = false
    state.rollbackOnlyFailure = undefined
    state.pendingObserverEvents = []

    let ownerFailed = false
    let ownerError: unknown
    try {
      owner?.endTransaction(payload)
    } catch (error) {
      ownerFailed = true
      ownerError = error
    } finally {
      if (
        !ownerFailed &&
        outcome === 'commit' &&
        pendingObserverEvents.length > 0
      ) {
        publishEventsToObservers(pendingObserverEvents)
      }
      publishEvent({
        type: EventTypes.END_TRANSACTION,
        payload
      })
    }
    if (ownerFailed) {
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
