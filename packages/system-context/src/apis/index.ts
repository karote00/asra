import { HandlerDeps } from '../types'
import { createPrimaryToolAPIs } from './primary-tool'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createPrimaryToolAPIs(deps.primaryToolState)
})
