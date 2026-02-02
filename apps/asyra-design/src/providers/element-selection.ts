import { createStore } from './utils'
import uiContext from '@asyra/ui-context'

export const useElementSelection = (): Set<string> =>
  createStore(uiContext.elementSelection)
