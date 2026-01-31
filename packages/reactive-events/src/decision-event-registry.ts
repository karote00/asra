import { publishEvent, subscribeToEvents } from './event-bus'
import type { InteractionEvent } from '@asyra/utils'

/**
 * Registry for custom decision events
 * Allows users to register custom interaction events and subscribe to them
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
          type: eventName as any,
          payload: payload as any
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
