import { SelectionRequestDeps, SelectionRequests } from '../types'

/**
 * Request API for Selection data
 * Provides synchronous access to selection state with dependency injection
 */

export const createSelectionRequests = (
  deps: SelectionRequestDeps
): SelectionRequests => ({
  getElementSelectionIds: (): string[] => {
    return deps.selection.getElementSelectionIds()
  }
})
