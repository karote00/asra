import type {
  FeatureTaskHandler,
  FeatureTaskRegistration,
  InvokeFeatureTaskOptions
} from '../types/task'

export class FeatureTaskNotFoundError extends Error {
  readonly code = 'FEATURE_TASK_NOT_FOUND'
  readonly featureName: string

  constructor(featureName: string) {
    super(`Feature "${featureName}" does not define a programmatic task`)
    this.name = 'FeatureTaskNotFoundError'
    this.featureName = featureName
  }
}

export class FeatureTaskActiveError extends Error {
  readonly code = 'FEATURE_TASK_ACTIVE'
  readonly featureName: string

  constructor(featureName: string) {
    super(`Feature "${featureName}" already has an active task`)
    this.name = 'FeatureTaskActiveError'
    this.featureName = featureName
  }
}

interface ActiveFeatureTask {
  readonly abortController: AbortController
  readonly invocation: Promise<unknown>
}

export class FeatureTaskRegistry {
  private readonly registrations = new Map<string, FeatureTaskRegistration>()
  private readonly activeTasks = new Map<string, ActiveFeatureTask>()

  register(featureName: string, registration: FeatureTaskRegistration): void {
    if (this.registrations.has(featureName)) {
      throw new Error(`Feature task "${featureName}" is already registered`)
    }
    this.registrations.set(featureName, registration)
  }

  invoke<Input, Result>(
    featureName: string,
    input: Input,
    options: InvokeFeatureTaskOptions = {}
  ): Promise<Result> {
    const registration = this.registrations.get(featureName)
    if (!registration) {
      return Promise.reject(new FeatureTaskNotFoundError(featureName))
    }
    if (this.activeTasks.has(featureName)) {
      return Promise.reject(new FeatureTaskActiveError(featureName))
    }

    const abortController = new AbortController()
    const externalSignal = options.signal
    const forwardAbort = (): void => {
      abortController.abort(externalSignal?.reason)
    }

    if (externalSignal?.aborted) {
      forwardAbort()
    } else {
      externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    }

    const invocation: Promise<unknown> = Promise.resolve()
      .then(() =>
        (registration.handler as FeatureTaskHandler<Input, Result>)(input, {
          signal: abortController.signal
        })
      )
      .finally(() => {
        externalSignal?.removeEventListener('abort', forwardAbort)
        if (this.activeTasks.get(featureName)?.invocation === invocation) {
          this.activeTasks.delete(featureName)
        }
      })

    this.activeTasks.set(featureName, {
      abortController,
      invocation
    })

    return invocation as Promise<Result>
  }

  cancel(featureName: string, reason?: unknown): boolean {
    const activeTask = this.activeTasks.get(featureName)
    if (!activeTask) {
      return false
    }
    activeTask.abortController.abort(reason)
    return true
  }

  isActive(featureName: string): boolean {
    return this.activeTasks.has(featureName)
  }

  unregister(featureName: string): boolean {
    if (this.activeTasks.has(featureName)) {
      throw new FeatureTaskActiveError(featureName)
    }
    return this.registrations.delete(featureName)
  }
}

export const featureTaskRegistry = new FeatureTaskRegistry()
