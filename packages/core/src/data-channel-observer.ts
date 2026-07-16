import factory, { type Factory } from '@asyra/factory'

export type DataChannelObserverCleanup = () => void

export interface DataChannelObserverRegistration<TChange = unknown> {
  name: string
  channel: string
  onChange: (change: TChange) => void
}

export const defineDataChannelObserver = <TChange>(
  registration: DataChannelObserverRegistration<TChange>
): DataChannelObserverRegistration<TChange> => {
  if (!registration.name.trim()) {
    throw new Error('[core] Data channel observer name is required')
  }
  if (!registration.channel.trim()) {
    throw new Error('[core] Data channel observer channel is required')
  }
  if (typeof registration.onChange !== 'function') {
    throw new Error('[core] Data channel observer onChange handler is required')
  }

  return registration
}

type DataChannelObserverFactory = Pick<Factory, 'observeSharedDataChannel'>

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

  constructor(private readonly factory: DataChannelObserverFactory) {}

  register<TChange = unknown>(
    registration: DataChannelObserverRegistration<TChange>
  ): void {
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

  private activate(
    registration: DataChannelObserverRegistration<unknown>
  ): void {
    const cleanup = this.factory.observeSharedDataChannel(
      registration.channel,
      registration.onChange
    )
    this.activeObserverCleanups.set(registration.name, cleanup)
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
