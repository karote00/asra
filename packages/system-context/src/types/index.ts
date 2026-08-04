import { RootAPIs } from './root.js'
import { ManagedPropertyStateAPIs } from './managed-property-state.js'

export { RootAPIs, ManagedPropertyStateAPIs }

export type SystemContextAPIs = RootAPIs & ManagedPropertyStateAPIs

export * from './deps.js'
