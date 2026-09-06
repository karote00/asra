export interface ReadonlyView<T> {
  getSnapshot: () => T
  subscribe: <Value>(
    read: (snapshot: T) => Value,
    listener: () => void
  ) => () => void
}

/** A current UI projection; subscriptions consume values, never component props. */
export class ViewSource<T> implements ReadonlyView<T> {
  private snapshot: T

  private readonly subscriptions = new Set<{
    read: (snapshot: T) => unknown
    value: unknown
    listener: () => void
  }>()

  constructor(initial: T) {
    this.snapshot = initial
  }

  getSnapshot = (): T => this.snapshot

  subscribe = <Value>(read: (snapshot: T) => Value, listener: () => void) => {
    const subscription = { read, listener, value: read(this.snapshot) }

    this.subscriptions.add(subscription)

    return () => {
      this.subscriptions.delete(subscription)
    }
  }

  /** Stage related projections before notifying any of their consumers. */
  stage(next: T): () => void {
    this.snapshot = next

    const changed = [...this.subscriptions].filter((subscription) => {
      const value = subscription.read(next)

      if (Object.is(subscription.value, value)) return false

      subscription.value = value

      return true
    })

    return () => {
      for (const subscription of changed) {
        if (this.subscriptions.has(subscription)) subscription.listener()
      }
    }
  }

  publish(next: T): void {
    this.stage(next)()
  }
}
