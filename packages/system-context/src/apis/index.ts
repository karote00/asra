import { HandlerDeps } from '../types'
import { createMouseStateAPIs } from './mouse-state'
import { createPrimaryToolAPIs } from './primary-tool'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createPrimaryToolAPIs(deps.primaryToolState),
  ...createMouseStateAPIs(deps.mouseState)
})
