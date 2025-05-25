import { initInputSystemHandlers } from './input-system'
import { initInteractionCoreHandlers } from './interaction-core'
import { CoreAPIs, HandlerDeps } from '../types'

export const initAllHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
  initInputSystemHandlers(deps, apis)
  initInteractionCoreHandlers(deps, apis)
}
