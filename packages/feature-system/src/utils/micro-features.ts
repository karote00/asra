import type {
  EndTransactionOptions,
  SystemContextSnapshot,
  TransactionFailure
} from '@asyra/utils'

/** Minimal package deps for micro-features - optional chaining used */
interface MicroFeaturePackages {
  factory?: {
    startTransaction?: () => void
    endTransaction?: (options?: EndTransactionOptions) => void
  }
  selection?: {
    getElementSelectionIds?: () => string[]
    selectElements?: (ids: string[]) => void
  }
  systemContext?: { getSystemContextSnapshot?: () => SystemContextSnapshot }
}

const toTransactionFailure = (cause: unknown): TransactionFailure => ({
  kind: 'explicit',
  ...(cause instanceof Error && cause.message
    ? { message: cause.message }
    : {}),
  cause
})

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as PromiseLike<unknown>).then === 'function'

/**
 * Micro-feature utilities for common patterns
 * Composable utilities that wrap common operations
 */

/**
 * Create a transaction-wrapped function
 * Usage in feature: withTransaction(packages)(() => { ... })
 */
export const withTransaction = (packages: MicroFeaturePackages) => {
  return <T>(callback: () => T): T => {
    packages.factory?.startTransaction?.()
    try {
      const result = callback()
      if (isPromiseLike(result)) {
        return Promise.resolve(result).then(
          (value) => {
            packages.factory?.endTransaction?.()
            return value
          },
          (error: unknown) => {
            packages.factory?.endTransaction?.({
              outcome: 'rollback',
              failure: toTransactionFailure(error)
            })
            throw error
          }
        ) as T
      }

      packages.factory?.endTransaction?.()
      return result
    } catch (error) {
      packages.factory?.endTransaction?.({
        outcome: 'rollback',
        failure: toTransactionFailure(error)
      })
      throw error
    }
  }
}

/**
 * Wrap callback with selection context
 */
export const withSelection = (packages: MicroFeaturePackages) => {
  return <T>(selectionIds: string[], callback: (ids: string[]) => T): T => {
    const previous = packages.selection?.getElementSelectionIds?.() || []
    packages.selection?.selectElements?.(selectionIds)
    try {
      return callback(selectionIds)
    } finally {
      packages.selection?.selectElements?.(previous)
    }
  }
}

/**
 * Execute with undo/redo tracking
 * Note: Already wrapped in transaction by default
 */
export const withUndoRedo = (packages: MicroFeaturePackages) => {
  return <T>(actionName: string, callback: () => T): T => {
    // Transactions already handle undo/redo
    return callback()
  }
}

/**
 * Wrap with context snapshot access
 */
export const withContextSnapshot = (packages: MicroFeaturePackages) => {
  return <T>(callback: (snapshot: SystemContextSnapshot) => T): T => {
    const snapshot = packages.systemContext?.getSystemContextSnapshot?.()
    if (!snapshot) {
      console.warn('SystemContext not available')
      return callback({} as SystemContextSnapshot)
    }
    return callback(snapshot)
  }
}
