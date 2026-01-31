import { initInteractionCoreHandlers } from './interaction-core'
import { CoreAPIs, HandlerDeps } from '../types'

export const initAllHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
  initInteractionCoreHandlers(deps, apis)
}
