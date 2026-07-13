import factory from '@asyra/factory'

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

const observerRegistrations = new Map<
  string,
  DataChannelObserverRegistration<unknown>
>()
const activeObserverCleanups = new Map<string, DataChannelObserverCleanup>()

let hasInit = false

const activateObserver = (
  registration: DataChannelObserverRegistration<unknown>
): void => {
  const cleanup = factory.observeSharedDataChannel(
    registration.channel,
    registration.onChange
  )
  activeObserverCleanups.set(registration.name, cleanup)
}

const deactivateObserver = (name: string): void => {
  const cleanup = activeObserverCleanups.get(name)
  cleanup?.()
  activeObserverCleanups.delete(name)
}

export const registerDataChannelObserver = <TChange = unknown>(
  registration: DataChannelObserverRegistration<TChange>
): void => {
  if (observerRegistrations.has(registration.name)) {
    throw new Error(
      `[core] Data channel observer "${registration.name}" is already registered`
    )
  }

  observerRegistrations.set(
    registration.name,
    registration as DataChannelObserverRegistration<unknown>
  )

  if (hasInit) {
    activateObserver(registration as DataChannelObserverRegistration<unknown>)
  }
}

export const unregisterDataChannelObserver = (name: string): boolean => {
  const hasRegistration = observerRegistrations.has(name)
  if (!hasRegistration) {
    return false
  }

  observerRegistrations.delete(name)
  deactivateObserver(name)

  return true
}

export const initRegisteredDataChannelObservers = (): void => {
  if (hasInit) {
    return
  }

  observerRegistrations.forEach((registration) => {
    activateObserver(registration)
  })
  hasInit = true
}

export const disposeRegisteredDataChannelObservers = (): void => {
  if (!hasInit) {
    return
  }

  ;[...activeObserverCleanups.keys()].forEach((name) => {
    deactivateObserver(name)
  })
  hasInit = false
}
