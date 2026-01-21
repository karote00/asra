import { FactoryRequestDeps, FactoryRequests } from '../types'

/**
 * Request API for Factory data
 * Provides synchronous access to factory state with dependency injection
 */

export const createFactoryRequests = (
  deps: FactoryRequestDeps
): FactoryRequests => ({
  isInUndoRedo: (): boolean => {
    return deps.factory.isInUndoRedo()
  }
})
