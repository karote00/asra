export type TransactionReplayMode = 'rollback' | 'undo' | 'redo'

interface TransactionReplayContext {
  mode: TransactionReplayMode
  applied: boolean
  token: symbol
}

let activeReplayContext: TransactionReplayContext | null = null
const appliedReplayFailures = new WeakMap<
  object,
  { token: symbol; applied: boolean }
>()
let lastPrimitiveReplayFailure:
  { failure: unknown; token: symbol; applied: boolean } | undefined

const isObjectFailure = (failure: unknown): failure is object =>
  (typeof failure === 'object' && failure !== null) ||
  typeof failure === 'function'

export const getTransactionReplayMode = (): TransactionReplayMode | null =>
  activeReplayContext?.mode ?? null

export const acknowledgeTransactionReplayApplied = (): void => {
  if (activeReplayContext) {
    activeReplayContext.applied = true
  }
}

export const isTransactionReplayApplied = (): boolean =>
  activeReplayContext?.applied === true

export const wasTransactionReplayApplied = (failure: unknown): boolean => {
  if (isObjectFailure(failure)) {
    return appliedReplayFailures.get(failure)?.applied === true
  }

  return (
    lastPrimitiveReplayFailure?.applied === true &&
    Object.is(lastPrimitiveReplayFailure.failure, failure)
  )
}

export const runInTransactionReplayMode = <T>(
  mode: TransactionReplayMode,
  callback: () => T
): T => {
  const previousContext = activeReplayContext
  const context: TransactionReplayContext = {
    mode,
    applied: false,
    token: previousContext?.token ?? Symbol('transaction-replay')
  }
  activeReplayContext = context
  try {
    return callback()
  } catch (failure) {
    if (isObjectFailure(failure)) {
      const nestedFailure = appliedReplayFailures.get(failure)
      appliedReplayFailures.set(failure, {
        token: context.token,
        applied:
          context.applied ||
          (nestedFailure?.token === context.token && nestedFailure.applied)
      })
    } else {
      const nestedFailure = lastPrimitiveReplayFailure
      lastPrimitiveReplayFailure = {
        failure,
        token: context.token,
        applied:
          context.applied ||
          (nestedFailure?.token === context.token &&
            Object.is(nestedFailure.failure, failure) &&
            nestedFailure.applied)
      }
    }
    throw failure
  } finally {
    activeReplayContext = previousContext
  }
}
