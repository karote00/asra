import { publishEvent, subscribeToEvents } from './event-bus'

/**
 * Registry for custom decision events
 * Allows users to register custom interaction events and subscribe to them
 * Note: Using 'any' for event publishing is necessary because custom user-defined events
 * cannot be statically typed in the AllEvent union type
 */
export class DecisionEventRegistry {
  private eventTypes = new Set<string>()

  register<T = unknown>(eventName: string) {
    this.eventTypes.add(eventName)

    return {
      subscribe: (handler: (event: { type: string; payload?: T }) => void) => {
        return subscribeToEvents((event) => {
          if (event.type === eventName) {
            handler(event as { type: string; payload?: T })
          }
        })
      },
      emit: (payload?: T) => {
        publishEvent({
          type: eventName,
          payload
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }
    }
  }

  has(eventName: string): boolean {
    return this.eventTypes.has(eventName)
  }

  getAll(): string[] {
    return Array.from(this.eventTypes)
  }
}

export const decisionEventRegistry = new DecisionEventRegistry()
