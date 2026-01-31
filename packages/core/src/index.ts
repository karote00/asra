import core, { Core } from './core'
import { workflowRegistry, handlerRegistry } from './core'
export { WorkflowRegistryClass } from './registries/workflow-registry'
export { HandlerRegistry } from './registries/handler-registry'
export type { Workflow, WorkflowRegistry } from './types/workflow'
export type { SystemContextAPIs, InteractionCoreActionAPIs } from './types'
export { decisionEventRegistry } from '@asyra/reactive-events'

export { Core, workflowRegistry, handlerRegistry }
export default core
