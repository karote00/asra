import uiContext from '@asyra/ui-context'
import { createStore } from '../utils'

export const useZoom = (): number => createStore(uiContext.zoom)
