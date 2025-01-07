type EventCallback = (...args: unknown[]) => void

class EventEmitter {
  private events: Record<string, EventCallback[]> = {}

  on(event: string, listener: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  emit(event: string, ...args: unknown[]): void {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args))
    }
  }

  off(event: string, listener: EventCallback): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((l) => l !== listener)
    }
  }
}

export default EventEmitter
