import { HandlerDeps } from '../types'
import { createMouseStateAPIs } from './mouse-state'
import { createPrimaryToolStateAPIs } from './primary-tool-state'
import { createRootAPIs } from './root'
import { createSystemAPIs } from './system-state'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createRootAPIs(deps),
  ...createPrimaryToolStateAPIs(deps.primaryToolState),
  ...createMouseStateAPIs(deps.mouseState),
  ...createSystemAPIs(deps.systemState)
})
