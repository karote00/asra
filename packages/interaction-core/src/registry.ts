import { SystemContextSnapshot, DetailType, EVENT_OPTIONS } from '@asyra/utils'

/**
 * Decision Handler Function
 * Maps input events to decision results
 */
export type DecisionHandler<TPayload = unknown> = (
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => DecisionResult<TPayload> | null

/**
 * Decision Result Interface
 * Result from decide() - simple object with type, payload, options, and handler
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

export class InteractionRegistry {
  private handlers = new Map<string, DecisionHandler>()

  register(eventName: string, handler: DecisionHandler) {
    this.handlers.set(eventName, handler)
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
    return Array.from(this.handlers.keys())
  }
}
