import factory, { type Factory } from '@asyra/factory'

export type DataChannelObserverCleanup = () => void

interface DataChannelObserverRegistrationBase {
  name: string
  channel: string
}

export type DataChannelObserverRegistration<TChange = unknown> =
  DataChannelObserverRegistrationBase &
    (
      | {
          onBatch?: never
          onChange: (change: TChange) => void
        }
      | {
          onBatch: (changes: readonly TChange[]) => void
          onChange?: never
        }
    )

export const defineDataChannelObserver = <TChange>(
  registration: DataChannelObserverRegistration<TChange>
): DataChannelObserverRegistration<TChange> => {
  if (!registration.name.trim()) {
    throw new Error('[core] Data channel observer name is required')
  }
  if (!registration.channel.trim()) {
    throw new Error('[core] Data channel observer channel is required')
  }
  const hasChangeHandler = typeof registration.onChange === 'function'
  const hasBatchHandler = typeof registration.onBatch === 'function'
  if (hasChangeHandler === hasBatchHandler) {
    throw new Error(
      '[core] Data channel observer requires exactly one onChange or onBatch handler'
    )
  }

  return registration
}

type DataChannelObserverFactory = Pick<
  Factory,
  'observeSharedDataChannel' | 'observeSharedDataChannelBatch'
>

export class DataChannelObserverRegistry {
  private readonly observerRegistrations = new Map<
    string,
    DataChannelObserverRegistration<unknown>
  >()
  private readonly activeObserverCleanups = new Map<
    string,
    DataChannelObserverCleanup
  >()
  private initialized = false
  private runtimeGeneration = 0
  private acquiring = 0
  private resetting = false

  constructor(private readonly factory: DataChannelObserverFactory) {}

  register<TChange = unknown>(
    registration: DataChannelObserverRegistration<TChange>
  ): void {
    if (this.resetting) throw new Error('[core] Observer runtime is resetting')
    if (this.observerRegistrations.has(registration.name)) {
      throw new Error(
        `[core] Data channel observer "${registration.name}" is already registered`
      )
    }

    this.observerRegistrations.set(
      registration.name,
      registration as DataChannelObserverRegistration<unknown>
    )

    if (this.initialized) {
      this.activate(registration as DataChannelObserverRegistration<unknown>)
    }
  }

  unregister(name: string): boolean {
    if (!this.observerRegistrations.has(name)) {
      return false
    }

    this.observerRegistrations.delete(name)
    this.deactivate(name)
    return true
  }

  init(): void {
    if (this.resetting) throw new Error('[core] Observer runtime is resetting')
    if (this.initialized) return

    this.observerRegistrations.forEach((registration) => {
      this.activate(registration)
    })
    this.initialized = true
  }

  dispose(): void {
    if (!this.initialized) return
    ;[...this.activeObserverCleanups.keys()].forEach((name) => {
      this.deactivate(name)
    })
    this.initialized = false
  }

  resetRuntime(): void {
    if (this.acquiring > 0 || this.resetting) {
      throw new Error('[core] Observer runtime reset requires idle acquisition')
    }
    this.resetting = true
    this.runtimeGeneration++
    const cleanups = [...this.activeObserverCleanups.values()]
    this.activeObserverCleanups.clear()
    this.observerRegistrations.clear()
    this.initialized = false
    const failures: unknown[] = []
    for (const cleanup of cleanups) {
      try {
        cleanup()
      } catch (error) {
        failures.push(error)
      }
    }
    this.resetting = false
    if (failures.length > 0) throw failures[0]
  }

  private activate(
    registration: DataChannelObserverRegistration<unknown>
  ): void {
    const generation = this.runtimeGeneration
    const { onBatch, onChange } = registration
    this.acquiring++
    try {
      const cleanup = onBatch
        ? this.factory.observeSharedDataChannelBatch(
            registration.channel,
            (changes) => {
              if (generation === this.runtimeGeneration) onBatch(changes)
            }
          )
        : this.factory.observeSharedDataChannel(
            registration.channel,
            (change) => {
              if (generation === this.runtimeGeneration) onChange?.(change)
            }
          )
      this.activeObserverCleanups.set(registration.name, cleanup)
    } finally {
      this.acquiring--
    }
  }

  private deactivate(name: string): void {
    this.activeObserverCleanups.get(name)?.()
    this.activeObserverCleanups.delete(name)
  }
}

const defaultDataChannelObserverRegistry = new DataChannelObserverRegistry(
  factory
)

export const getDefaultDataChannelObserverRegistry =
  (): DataChannelObserverRegistry => defaultDataChannelObserverRegistry

export const registerDataChannelObserver = <TChange = unknown>(
  registration: DataChannelObserverRegistration<TChange>
): void => defaultDataChannelObserverRegistry.register(registration)

export const unregisterDataChannelObserver = (name: string): boolean =>
  defaultDataChannelObserverRegistry.unregister(name)

export const initRegisteredDataChannelObservers = (): void => {
  defaultDataChannelObserverRegistry.init()
}

export const disposeRegisteredDataChannelObservers = (): void => {
  defaultDataChannelObserverRegistry.dispose()
}
