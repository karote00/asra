import { MapRegistry } from '@asyra/utils'
import { publishEvent, subscribeToEvents } from './event-bus'
import type { Subscription } from 'rxjs'
import type { AllEvent } from './constants'

export interface EventDefinition<
  TPayload = unknown,
  TOptions = unknown
> {
  eventName: string
}

export interface EventRegistration<
  TPayload = unknown,
  TOptions = unknown
> {
  eventName: string
  publish: (payload?: TPayload, options?: TOptions) => void
  subscribe: (
    handler: (payload?: TPayload, options?: TOptions) => void
  ) => Subscription
}

type EventDefinitionsMap = Record<string, EventDefinition<unknown, unknown>>

type ExtractPayload<TDefinition> = TDefinition extends EventDefinition<
  infer TPayload,
  unknown
>
  ? TPayload
  : unknown

type ExtractOptions<TDefinition> = TDefinition extends EventDefinition<
  unknown,
  infer TOptions
>
  ? TOptions
  : unknown

export type EventRegistrations<TDefinitions extends EventDefinitionsMap> = {
  [K in keyof TDefinitions]: EventRegistration<
    ExtractPayload<TDefinitions[K]>,
    ExtractOptions<TDefinitions[K]>
  >
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
  register<TPayload = unknown, TOptions = unknown>(
    event: string | EventDefinition<TPayload, TOptions>
  ): EventRegistration<TPayload, TOptions> {
    const eventName = getEventName(event)
    const registration: EventRegistration<TPayload, TOptions> = {
      eventName,

      publish(payload?: TPayload, options?: TOptions) {
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
        handler: (payload?: TPayload, options?: TOptions) => void
      ): Subscription {
        return subscribeToEvents((e: AllEvent) => {
          if (e.type === eventName) {
            const custom = e as CustomEventShape
            handler(
              custom.payload as TPayload | undefined,
              custom.options as TOptions | undefined
            )
          }
        })
      }
    }

    return registerInRegistry(eventName, registration)
  },

  get<TPayload = unknown, TOptions = unknown>(
    event: string | EventDefinition<TPayload, TOptions>
  ): EventRegistration<TPayload, TOptions> | undefined {
    const eventName = getEventName(event)
    return registry.get(eventName) as EventRegistration<TPayload, TOptions>
  },

  has(event: string | EventDefinition): boolean {
    const eventName = getEventName(event)
    return registry.has(eventName)
  },

  unregister(event: string | EventDefinition): boolean {
    const eventName = getEventName(event)
    return registry.delete(eventName)
  },

  getRegisteredEvents(): string[] {
    return registry.keys()
  },

  clear(): void {
    registry.clear()
  }
}

export const defineEvent = <TPayload = unknown, TOptions = unknown>(
  eventName: string
): EventDefinition<TPayload, TOptions> => ({ eventName })

export const registerEventDefinitions = <
  TDefinitions extends EventDefinitionsMap
>(
  definitions: TDefinitions,
  register: (
    definition: EventDefinition<unknown, unknown>
  ) => EventRegistration<unknown, unknown> = (definition) =>
    eventRegistry.register(definition)
): EventRegistrations<TDefinitions> => {
  const entries = Object.entries(definitions).map(([key, definition]) => [
    key,
    register(definition)
  ])

  return Object.fromEntries(entries) as EventRegistrations<TDefinitions>
}

const getEventName = (event: string | EventDefinition): string => {
  return typeof event === 'string' ? event : event.eventName
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous event payload/options */
const registry = new MapRegistry<string, EventRegistration<any, any>>()

const registerInRegistry = <TPayload, TOptions>(
  eventName: string,
  registration: EventRegistration<TPayload, TOptions>
): EventRegistration<TPayload, TOptions> => {
  return registry.register(eventName, registration, {
    duplicateErrorMessage: `Event "${eventName}" is already registered`
  }) as EventRegistration<TPayload, TOptions>
}
