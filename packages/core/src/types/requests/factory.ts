import { Factory } from '@asra/factory'

/**
 * Request API for Factory data
 * Provides synchronous access to factory state
 */

export interface FactoryRequests {
  isInUndoRedo: () => boolean
}

export interface FactoryRequestDeps {
  factory: Factory
}
