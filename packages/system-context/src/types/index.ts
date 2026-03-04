import { RootAPIs } from './root'
import { ManagedPropertyStateAPIs } from './managed-property-state'

export { RootAPIs, ManagedPropertyStateAPIs }

export type SystemContextAPIs = RootAPIs & ManagedPropertyStateAPIs

export * from './deps'
