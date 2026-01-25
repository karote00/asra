import { createStore } from './utils'
import { uiContext } from '@asra/ui-context'

export const useElementSelection = (): Set<string> =>
  createStore(uiContext.elementSelection)
