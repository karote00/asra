import type {
  ExecutionConfig,
  ExecutionHandler,
  ExecutionParticipant,
  ExecutionRegistry
} from '../types/execution'
import type { SystemContextSnapshot } from '@asyra/utils'
import { runTransaction } from '@asyra/reactive-events'

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

    const handlers = this.executionHandlers.get(eventName)
    if (handlers) {
      handlers.push(participant)
      // Sort by priority (descending) - higher priority runs first
      handlers.sort((a, b) => b.priority - a.priority)
    }
  }

  async execute(
    eventName: string,
    snapshot: SystemContextSnapshot
  ): Promise<boolean> {
    const handlers = this.executionHandlers.get(eventName)
    if (!handlers || handlers.length === 0) return false

    return runTransaction(
      async () => {
        let ranAny = false
        let exclusiveFound = false

        for (const participant of handlers) {
          if (exclusiveFound) {
            break
          }

          const result = await participant.handler(snapshot)
          if (result !== null && result !== undefined) {
            participant.result = result
            ranAny = true
            if (participant.exclusive) {
              exclusiveFound = true
            }
          }
        }

        return ranAny
      },
      { failureKind: 'handler-error' }
    )
  }

  getHandlers(eventName: string): ExecutionParticipant[] {
    return this.executionHandlers.get(eventName) || []
  }
}

const executionRegistry = new ExecutionRegistryClass()

export default executionRegistry
