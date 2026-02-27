import {
  SystemContextSnapshot,
  DetailType,
  EVENT_OPTIONS,
  MapRegistry
} from '@asyra/utils'

/**
 * Decision Handler Function
 * Maps input events to decision results
 * @deprecated Use feature handlers in `@asyra/feature-system`.
 */
export type DecisionHandler<TPayload = unknown> = (
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => DecisionResult<TPayload> | null

/**
 * Decision Result Interface
 * Result from decide() - simple object with type, payload, options, and handler
 * @deprecated Use feature-system handler contracts.
 */
export interface DecisionResult<TPayload = unknown> {
  type: string
  payload?: TPayload
  options?: EVENT_OPTIONS
  handler?: (
    payload: TPayload | undefined,
    options: EVENT_OPTIONS | undefined
  ) => void
}

/**
 * @deprecated Use `@asyra/feature-system` registration/runtime flow.
 */
export class InteractionRegistry {
  private handlers = new MapRegistry<string, DecisionHandler>()

  register(eventName: string, handler: DecisionHandler) {
    this.handlers.register(eventName, handler, {
      duplicateErrorMessage: `Interaction "${eventName}" is already registered`
    })
  }

  decide(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ): DecisionResult | null {
    const handler = this.handlers.get(eventName)
    return handler ? handler(systemContextSnapshot, detail) : null
  }

  getRegisteredEvents(): string[] {
    return this.handlers.keys()
  }
}
