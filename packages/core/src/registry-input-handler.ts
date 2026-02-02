import type { RawInputEvent } from '@asyra/utils'
import type { SystemContextAPIs, InteractionCoreActionAPIs } from './types'
import type { WorkflowRegistryClass } from './registries/workflow-registry'
import type { InputSystem } from '@asyra/input-system'

interface RegistrySubscribeDeps {
  inputSystem: InputSystem
}

/**
 * Single subscribe point for all input-system events
 * Handles all input events by looking up workflows and executing them
 * This preserves the Core Invariant by ensuring all paths go through
 * the workflow execution pattern: updateContext → callCoreAPI
 */
export const initRegistryInputHandler = (
  deps: RegistrySubscribeDeps,
  workflowRegistry: WorkflowRegistryClass,
  core: SystemContextAPIs & InteractionCoreActionAPIs
) => {
  const allInputEvents = deps.inputSystem.registry.getEventNames()

  allInputEvents.forEach((eventName: string) => {
    deps.inputSystem.on(eventName, (raw: RawInputEvent) => {
      const workflow = workflowRegistry.get(eventName)
      if (!workflow) {
        return
      }

      workflow.contextUpdate(core, raw)

      const apiFunction = core[workflow.coreAPI] as (...args: unknown[]) => void
      const args = workflow.APIArgs(core, raw)
      apiFunction(...args)
    })
  })
}
