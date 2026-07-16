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
  private activeFeatureCounts = new Map<string, number>()

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
          if (!this.executionHandlers.get(eventName)?.includes(participant)) {
            continue
          }

          this.markFeatureActive(participant.featureName)
          let result: Awaited<ReturnType<ExecutionHandler>>
          try {
            result = await participant.handler(snapshot)
          } finally {
            this.markFeatureInactive(participant.featureName)
          }
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

  unregisterFeature(featureName: string): string[] {
    const affectedEvents: string[] = []

    for (const [eventName, handlers] of this.executionHandlers) {
      const nextHandlers = handlers.filter(
        (participant) => participant.featureName !== featureName
      )
      if (nextHandlers.length === handlers.length) {
        continue
      }

      affectedEvents.push(eventName)
      if (nextHandlers.length === 0) {
        this.executionHandlers.delete(eventName)
      } else {
        this.executionHandlers.set(eventName, nextHandlers)
      }
    }

    return affectedEvents
  }

  hasHandlers(eventName: string): boolean {
    return (this.executionHandlers.get(eventName)?.length ?? 0) > 0
  }

  isFeatureActive(featureName: string): boolean {
    return (this.activeFeatureCounts.get(featureName) ?? 0) > 0
  }

  private markFeatureActive(featureName: string): void {
    this.activeFeatureCounts.set(
      featureName,
      (this.activeFeatureCounts.get(featureName) ?? 0) + 1
    )
  }

  private markFeatureInactive(featureName: string): void {
    const count = this.activeFeatureCounts.get(featureName) ?? 0
    if (count <= 1) {
      this.activeFeatureCounts.delete(featureName)
      return
    }
    this.activeFeatureCounts.set(featureName, count - 1)
  }
}

const executionRegistry = new ExecutionRegistryClass()

export default executionRegistry
