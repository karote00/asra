import uiContext from '@asyra/ui-context'
import { createStore } from '../utils'

export const usePrimaryTool = (): string =>
  createStore(uiContext.primaryTool)
