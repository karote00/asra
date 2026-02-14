import { publishEvent, subscribeToEvents } from './event-bus'
import type { Subscription } from 'rxjs'
import type { AllEvent } from './constants'

interface EventRegistration {
  eventName: string
  publish: (payload?: unknown, options?: unknown) => void
  subscribe: (
    handler: (payload?: unknown, options?: unknown) => void
  ) => Subscription
}

/** Custom event shape - extends base for dynamic user events */
interface CustomEventShape {
  type: string
  payload?: unknown
  options?: unknown
}

/**
 * Event Registry for user-defined events
 * Simple API: pass eventName, get publish/subscribe functions
 *
 * Events are published with structure: { type: string, payload?, options? }
 *
 * Custom events use type assertion to AllEvent since they cannot be in the static union.
 *
 * Example:
 * ```typescript
 * const myEvent = eventRegistry.register('MY_CUSTOM_EVENT')
 * myEvent.publish({ data: 'hello' })
 * myEvent.subscribe((payload, options) => console.log(payload, options))
 * myEvent.subscribe().unsubscribe()  // Cleanup
 * ```
 */

export const eventRegistry = {
  register(eventName: string): EventRegistration {
    return {
      eventName,

      publish(payload?: unknown, options?: unknown) {
        const event: Record<string, unknown> = { type: eventName }
        if (payload !== undefined) {
          event.payload = payload
        }
        if (options !== undefined) {
          event.options = options
        }
        publishEvent(event as unknown as AllEvent)
      },

      subscribe(
        handler: (payload?: unknown, options?: unknown) => void
      ): Subscription {
        return subscribeToEvents((e: AllEvent) => {
          if (e.type === eventName) {
            const custom = e as CustomEventShape
            handler(custom.payload, custom.options)
          }
        })
      }
    }
  }
}
