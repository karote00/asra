import type {
  EVENT_OPTIONS,
  InteractionEvent,
  KnownInteractionAction
} from '../constants'

/**
 * Decision Event Interface
 * Represents an interaction decision with customizable type
 * TType defaults to any known interaction action or custom string
 */
export interface DecisionEvent<
  TPayload = unknown,
  TType = KnownInteractionAction | string
> {
  type: TType
  payload?: TPayload
  options?: EVENT_OPTIONS
}

/**
 * Re-export for backward compatibility
 */
export type InteractionEventInterface = DecisionEvent
