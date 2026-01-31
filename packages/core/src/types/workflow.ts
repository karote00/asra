import type { RawInputEvent } from '@asyra/utils'
import type { SystemContextAPIs, InteractionCoreActionAPIs } from './index'

/**
 * Workflow definition for handling input events
 * Defines how an input event should be processed through the Core Invariant
 */
export interface Workflow {
  /** Update SystemContext based on raw input (e.g., mousePosition, keyState) */
  contextUpdate: (core: SystemContextAPIs, raw: RawInputEvent) => void

  /** Which InteractionCore API to call */
  coreAPI: keyof InteractionCoreActionAPIs

  /** Calculate arguments to pass to the coreAPI */
  APIArgs: (core: SystemContextAPIs, raw: RawInputEvent) => unknown[]
}

/**
 * Registry type for workflow definitions
 * Maps workflow names to workflow definitions
 */
export type WorkflowRegistry = Record<string, Workflow>
