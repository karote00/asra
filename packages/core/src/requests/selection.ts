import { SelectionRequestDeps, SelectionRequests } from '../types'

/**
 * Request API for Selection data
 * Provides synchronous access to selection state with dependency injection
 */

export const createSelectionRequests = (
  deps: SelectionRequestDeps
): SelectionRequests => ({
  elementSelection: (): string[] => {
    return deps.selection.getElementSelectionIds()
  }
})
