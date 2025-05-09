import { initAllHandlers } from './handlers'
import { CoreAPIs, HandlerDeps } from '../types/core-apis'

export const initShortcuts = (deps: HandlerDeps, apis: CoreAPIs) => {
  initAllHandlers(deps, apis)
}
