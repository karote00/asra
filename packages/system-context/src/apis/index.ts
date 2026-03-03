import { createRootAPIs } from './root'
import { createManagedPropertyStateAPIs } from './managed-property-state'
import { HandlerDeps } from '../types'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createRootAPIs(deps),
  ...createManagedPropertyStateAPIs(deps.managedPropertyState)
})
