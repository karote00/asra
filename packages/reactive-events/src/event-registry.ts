import { publishEvent, subscribeToEvents } from './event-bus'
import type { Subscription } from 'rxjs'

interface EventRegistration {
  eventName: string
  publish: (payload?: unknown, options?: unknown) => void
  subscribe: (
    handler: (payload?: unknown, options?: unknown) => void
  ) => Subscription
}

/**
 * Event Registry for user-defined events
 * Simple API: pass eventName, get publish/subscribe functions
 *
 * Events are published with structure: { type: string, payload?, options? }
 *
 * Note: Using 'any' for event publishing/subscribing is necessary because custom user-defined events
 * cannot be statically typed in the AllEvent union type
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publishEvent(event as any)
      },

      subscribe(
        handler: (payload?: unknown, options?: unknown) => void
      ): Subscription {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return subscribeToEvents((e: any) => {
          if (e.type === eventName) {
            handler(e.payload, e.options)
          }
        })
      }
    }
  }
}
