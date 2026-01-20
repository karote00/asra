import { SelectionManager } from '@asra/selection'

/**
 * Request API for Selection data
 * Provides synchronous access to selection state
 */

export interface SelectionRequests {
  elementSelection: () => string[]
}

export interface SelectionRequestDeps {
  selection: SelectionManager
}
