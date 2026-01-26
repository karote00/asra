import { uiContext } from '@asyra/ui-context'
import { MIXED_STRING } from '@asyra/utils'
import { createStore } from './utils'

export const useX = (): number | typeof MIXED_STRING => createStore(uiContext.x)
export const useY = (): number | typeof MIXED_STRING => createStore(uiContext.y)
export const useWidth = (): number | typeof MIXED_STRING =>
  createStore(uiContext.width)
export const useHeight = (): number | typeof MIXED_STRING =>
  createStore(uiContext.height)
