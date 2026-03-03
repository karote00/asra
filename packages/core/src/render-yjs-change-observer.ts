import factory from '@asyra/factory'

export type RenderYjsObserverCleanup = () => void

export interface RenderYjsChangeObserverRegistration<TChange = unknown> {
  name: string
  channel: string
  onChange: (change: TChange) => void
}

export const defineRenderYjsChangeObserver = <TChange>(
  registration: RenderYjsChangeObserverRegistration<TChange>
): RenderYjsChangeObserverRegistration<TChange> => {
  if (!registration.name.trim()) {
    throw new Error('[core] Render YJS observer name is required')
  }
  if (!registration.channel.trim()) {
    throw new Error('[core] Render YJS observer channel is required')
  }
  if (typeof registration.onChange !== 'function') {
    throw new Error('[core] Render YJS observer onChange handler is required')
  }

  return registration
}

const observerRegistrations = new Map<
  string,
  RenderYjsChangeObserverRegistration<any>
>()
const activeObserverCleanups = new Map<string, RenderYjsObserverCleanup>()

let hasInit = false

const activateObserver = (
  registration: RenderYjsChangeObserverRegistration<any>
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

export const registerRenderYjsObserverRegistration = (
  registration: RenderYjsChangeObserverRegistration<any>
): void => {
  if (observerRegistrations.has(registration.name)) {
    throw new Error(
      `[core] Render YJS observer "${registration.name}" is already registered`
    )
  }

  observerRegistrations.set(registration.name, registration)

  if (hasInit) {
    activateObserver(registration)
  }
}

export const unregisterRenderYjsObserverRegistration = (
  name: string
): boolean => {
  const hasRegistration = observerRegistrations.has(name)
  if (!hasRegistration) {
    return false
  }

  observerRegistrations.delete(name)
  deactivateObserver(name)

  return true
}

export const initRegisteredRenderYjsChangeObservers = (): void => {
  if (hasInit) {
    return
  }

  observerRegistrations.forEach((registration) => {
    activateObserver(registration)
  })
  hasInit = true
}

export const disposeRegisteredRenderYjsChangeObservers = (): void => {
  if (!hasInit) {
    return
  }

  ;[...activeObserverCleanups.keys()].forEach((name) => {
    deactivateObserver(name)
  })
  hasInit = false
}
