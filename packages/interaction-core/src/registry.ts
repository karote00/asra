import {
  InteractionEvent,
  SystemContextSnapshot,
  DetailType
} from '@asyra/utils'

export type DecisionHandler = (
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => InteractionEvent | null

export class InteractionRegistry {
  private handlers = new Map<string, DecisionHandler>()

  register(eventName: string, handler: DecisionHandler) {
    this.handlers.set(eventName, handler)
  }

  decide(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ): InteractionEvent | null {
    const handler = this.handlers.get(eventName)
    return handler ? handler(systemContextSnapshot, detail) : null
  }

  // Helper to bulk check current registry state (useful for debugging)
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys())
  }
}
