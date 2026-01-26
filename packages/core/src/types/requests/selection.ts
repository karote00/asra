import { SelectionManager } from '@asyra/selection'

/**
 * Request API for Selection data
 * Provides synchronous access to selection state
 */

export interface SelectionRequests {
  getElementSelectionIds: () => string[]
}

export interface SelectionRequestDeps {
  selection: SelectionManager
}
