import { uiContext } from '@asra/ui-context'
import { PrimaryToolType } from '@asra/utils'
import { createStore } from '../utils'

export const usePrimaryTool = (): PrimaryToolType =>
  createStore(uiContext.primaryTool)
