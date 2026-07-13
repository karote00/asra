import type { EVENT_OPTIONS } from './constants'

/**
 * Simple interaction event interface
 * Users can define their own event types and payloads
 * The framework only provides the structure
 */
export interface InteractionEvent<
  TPayload = unknown,
  TOptions = EVENT_OPTIONS
> {
  payload?: TPayload
  options?: TOptions
}
