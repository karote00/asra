/**
 * Micro-feature utilities for common patterns
 * Composable utilities that wrap common operations
 */

/**
 * Create a transaction-wrapped function
 * Usage in feature: withTransaction(packages)(() => { ... })
 */
export const withTransaction = (packages: any) => {
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
export const withSelection = (packages: any) => {
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
export const withUndoRedo = (packages: any) => {
  return <T>(actionName: string, callback: () => T): T => {
    // Transactions already handle undo/redo
    return callback()
  }
}

/**
 * Wrap with context snapshot access
 */
export const withContextSnapshot = (packages: any) => {
  return <T>(callback: (snapshot: any) => T): T => {
    const snapshot = packages.systemContext?.getSystemContextSnapshot?.()
    if (!snapshot) {
      console.warn('SystemContext not available')
      return callback({} as any)
    }
    return callback(snapshot)
  }
}
