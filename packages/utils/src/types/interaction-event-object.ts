import type {
  EVENT_OPTIONS,
  InteractionEvent as InteractionEventType
} from '../constants'

/**
 * Interaction Event Object
 * Represents a full event object with type, payload, and options
 * The type field can be any known interaction action or custom string
 */
export interface InteractionEventObject<
  TPayload = unknown,
  TType = InteractionEventType
> {
  type: TType
  payload?: TPayload
  options?: EVENT_OPTIONS
}

/**
 * Default Interaction Event Object for common use
 */
export type DefaultInteractionEvent = InteractionEventObject<
  unknown,
  InteractionEventType
>
