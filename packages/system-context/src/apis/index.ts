import { createRootAPIs } from './root'
import { createMouseStateAPIs } from './mouse-state'
import { createPrimaryToolStateAPIs } from './primary-tool-state'
import { createSystemAPIs } from './system-state'
import { createKeyStateAPIs } from './key-state'
import { HandlerDeps } from '../types'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createRootAPIs(deps),
  ...createPrimaryToolStateAPIs(deps.primaryToolState),
  ...createMouseStateAPIs(deps.mouseState),
  ...createSystemAPIs(deps.systemState),
  ...createKeyStateAPIs(deps.keyState)
})
