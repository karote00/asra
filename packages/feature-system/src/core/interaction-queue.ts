export class FeatureRuntimeClosedError extends Error {
  readonly code = 'FEATURE_RUNTIME_CLOSED'

  constructor() {
    super('The Feature runtime is closed or belongs to a retired generation')
    this.name = 'FeatureRuntimeClosedError'
  }
}

export class InteractionQueue {
  private tail: Promise<void> = Promise.resolve()
  private accepting = true
  private generation = 0
  private drained = false

  /** Capture admission identity so a retained caller cannot enter a successor. */
  createRunner(): <T>(operation: () => T | Promise<T>) => Promise<T> {
    const generation = this.generation
    return (operation) => this.runInGeneration(operation, generation)
  }

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    return this.runInGeneration(operation, this.generation)
  }

  private runInGeneration<T>(
    operation: () => T | Promise<T>,
    generation: number
  ): Promise<T> {
    if (!this.accepting || generation !== this.generation) {
      return Promise.reject(new FeatureRuntimeClosedError())
    }
    const result = this.tail.then(() => {
      if (!this.accepting || generation !== this.generation) {
        throw new FeatureRuntimeClosedError()
      }
      return operation()
    })
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  /** Close synchronously; the returned promise also drains rejected queued work. */
  close(): Promise<void> {
    this.accepting = false
    return this.tail.then(() => {
      this.drained = true
    })
  }

  beginRuntime(): void {
    if (this.accepting || !this.drained) throw new FeatureRuntimeClosedError()
    this.generation += 1
    this.drained = false
    this.accepting = true
  }
}

export const interactionQueue = new InteractionQueue()
