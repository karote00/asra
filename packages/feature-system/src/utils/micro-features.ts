import type { SystemContextSnapshot } from '@asyra/utils'

/** Minimal package deps for micro-features - optional chaining used */
interface MicroFeaturePackages {
  factory?: { startTransaction?: () => void; endTransaction?: () => void }
  selection?: {
    getElementSelectionIds?: () => string[]
    selectElements?: (ids: string[]) => void
  }
  systemContext?: { getSystemContextSnapshot?: () => SystemContextSnapshot }
}

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
      return callback()
    } finally {
      packages.factory?.endTransaction?.()
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
