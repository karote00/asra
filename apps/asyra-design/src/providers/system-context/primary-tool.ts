import { uiContext } from '@asyra/ui-context'
import { PrimaryToolType } from '@asyra/utils'
import { createStore } from '../utils'

export const usePrimaryTool = (): PrimaryToolType =>
  createStore(uiContext.primaryTool)
