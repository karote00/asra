import { subscribeToEvents } from '@asyra/reactive-events'

/**
 * Registry for custom decision handlers
 * Allows users to register custom handlers for interaction events
 */
export class HandlerRegistry {
  private handlers = new Map<string, (detail: unknown) => void>()
  private subscriptions: unknown[] = []

  register(eventName: string, handler: (detail: unknown) => void): void {
    this.handlers.set(eventName, handler)
  }

  init(): void {
    for (const [eventName, handler] of this.handlers) {
      const subscription = subscribeToEvents((event) => {
        if (event.type === eventName) {
          const payload = (event as unknown as Record<string, unknown>).payload
          handler(payload)
        }
      })
      this.subscriptions.push(subscription)
    }
  }

  has(eventName: string): boolean {
    return this.handlers.has(eventName)
  }

  getAll(): string[] {
    return Array.from(this.handlers.keys())
  }

  clear(): void {
    this.handlers.clear()
    this.subscriptions.forEach((sub) => {
      if (
        sub &&
        typeof (sub as { unsubscribe: () => void }).unsubscribe === 'function'
      ) {
        ;(sub as { unsubscribe: () => void }).unsubscribe()
      }
    })
    this.subscriptions = []
  }
}

export const handlerRegistry = new HandlerRegistry()
