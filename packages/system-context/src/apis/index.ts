import { createRootAPIs } from './root'
import { createMouseStateAPIs } from './mouse-state'
import { createPrimaryToolStateAPIs } from './primary-tool-state'
import { createSystemAPIs } from './system-state'
import { createKeyStateAPIs } from './key-state'
import { createTargetStateAPIs } from './target-state'
import { createManagedPropertyStateAPIs } from './managed-property-state'
import { HandlerDeps } from '../types'

export const createAllAPIs = (deps: HandlerDeps) => ({
  ...createRootAPIs(deps),
  ...createPrimaryToolStateAPIs(deps),
  ...createMouseStateAPIs(deps),
  ...createSystemAPIs(deps.systemState),
  ...createKeyStateAPIs(deps),
  ...createTargetStateAPIs(deps),
  ...createManagedPropertyStateAPIs(deps.managedPropertyState)
})
