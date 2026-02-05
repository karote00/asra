import type {
  ExecutionConfig,
  ExecutionHandler,
  ExecutionParticipant,
  ExecutionRegistry
} from '../types/execution'
import type { SystemContextSnapshot } from '@asyra/utils'

/**
 * Execution Registry
 * Handles priority-based one-time execution for features
 * Used for one-time actions like selection (click), not for continuous actions like drag
 */
export class ExecutionRegistryClass implements ExecutionRegistry {
  private executionHandlers = new Map<string, ExecutionParticipant[]>()

  register(
    eventName: string,
    featureName: string,
    config: ExecutionConfig,
    handler: ExecutionHandler
  ): void {
    const participant: ExecutionParticipant = {
      featureName,
      priority: config.priority ?? 0,
      exclusive: config.exclusive ?? true,
      handler,
      result: null
    }

    if (!this.executionHandlers.has(eventName)) {
      this.executionHandlers.set(eventName, [])
    }

    const handlers = this.executionHandlers.get(eventName)!
    handlers.push(participant)

    // Sort by priority (descending) - higher priority runs first
    handlers.sort((a, b) => b.priority - a.priority)
  }

  execute(eventName: string, snapshot: SystemContextSnapshot): boolean {
    const handlers = this.executionHandlers.get(eventName)
    if (!handlers || handlers.length === 0) return false

    // Priority-ordered: check features from highest to lowest priority
    let ranAny = false
    let exclusiveFound = false

    for (const participant of handlers) {
      // Skip if previous exclusive feature stopped us
      if (exclusiveFound) break

      try {
        // Execute handler
        const result = participant.handler(snapshot)

        if (result !== null && result !== undefined) {
          // Feature ran successfully
          participant.result = result
          ranAny = true

          // If exclusive, stop checking lower priorities
          if (participant.exclusive) {
            exclusiveFound = true
          }
        }
      } catch (error) {
        console.error(
          `Feature "${participant.featureName}" error in execution:`,
          error
        )
        // Continue with next feature on error
      }
    }

    return ranAny
  }

  getHandlers(eventName: string): ExecutionParticipant[] {
    return this.executionHandlers.get(eventName) || []
  }
}

const executionRegistry = new ExecutionRegistryClass()

export default executionRegistry
