import { createRootAPIs } from './root.js'
import { createManagedPropertyStateAPIs } from './managed-property-state.js'
import { HandlerDeps } from '../types/index.js'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createRootAPIs(deps),
  ...createManagedPropertyStateAPIs(deps.managedPropertyState)
})
