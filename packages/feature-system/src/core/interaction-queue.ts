export class InteractionQueue {
  private tail: Promise<void> = Promise.resolve()

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export const interactionQueue = new InteractionQueue()
