import { initAllHandlers } from './handlers'
import { CoreAPIs, HandlerDeps } from '../types'

export const initShortcuts = (deps: HandlerDeps, apis: CoreAPIs) => {
  initAllHandlers(deps, apis)
}
