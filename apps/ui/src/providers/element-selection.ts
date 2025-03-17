import { createStore } from './utils'
import { selectionStore } from '@asra/ui-context'

export const useElementSelection = (): Set<string> => {
  const subject = selectionStore.elements
  if (!subject) return new Set()
  return createStore(subject)
}
