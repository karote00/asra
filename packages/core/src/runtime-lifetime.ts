export type CoreRuntimeState =
  'active' | 'quiescing' | 'retiring' | 'retired' | 'failed'

export class CoreRuntimeClosedError extends Error {
  readonly code = 'CORE_RUNTIME_CLOSED'
  constructor(readonly state: CoreRuntimeState) {
    super(`Core runtime is ${state}; use the successor Core`)
    this.name = 'CoreRuntimeClosedError'
  }
}

export class CoreRuntimeResetError extends Error {
  readonly code = 'CORE_RUNTIME_RESET_FAILED'
  constructor(
    readonly phase: string,
    readonly cause: unknown
  ) {
    super(`Core runtime reset failed during ${phase}`)
    this.name = 'CoreRuntimeResetError'
  }
}

const cleanupReadAndReleaseMethods = new Set<PropertyKey>([
  'getRegistration',
  'getRegistrations',
  'getRegistrationRelations',
  'hasSystemProperty',
  'getSelection',
  'unregisterSelection',
  'unregisterRenderLayer',
  'unregisterDataChannelObserver',
  'unregisterSharedDataChannel',
  'hasSharedDataChannel',
  'unregisterEvent',
  'hasRenderEngineProvider',
  'isCompositionOpen'
])
const ownedAsyncMethods = new Set<PropertyKey>([
  'start',
  'save',
  'destroy',
  'applyRemoteCanonicalChangeSlices'
])

/** Tracks the exclusive Core lifetime, not document state or Undo history. */
export class CoreRuntimeLifetime {
  state: CoreRuntimeState = 'active'
  cleanupActive = false
  private starting = 0
  private readonly pending = new Set<Promise<void>>()
  private readonly featureFacades = new WeakMap<object, object>()

  isUsable(): boolean {
    return this.state === 'active' || this.state === 'quiescing'
  }

  assertActive(): void {
    if (this.state !== 'active') throw new CoreRuntimeClosedError(this.state)
  }

  assertResetReady(): void {
    if (this.starting > 0) {
      throw new Error('Core runtime reset requires startup to settle first')
    }
    this.assertActive()
  }

  private assertMethod(method: PropertyKey): void {
    if (method === 'resetRuntime' || method === 'getRuntimeState') return
    if (method === 'start' || method === 'registerRuntimeCleanup') {
      this.assertActive()
      return
    }
    if (this.isUsable()) return
    if (this.cleanupActive && cleanupReadAndReleaseMethods.has(method)) return
    throw new CoreRuntimeClosedError(this.state)
  }

  private track(value: unknown, onSettled = () => undefined): void {
    const settled = () => {
      this.pending.delete(operation)
      onSettled()
    }
    const operation = Promise.resolve(value).then(settled, settled)
    this.pending.add(operation)
  }

  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending])
  }

  facade<T extends object>(owner: T): T {
    const methods = new Map<PropertyKey, { source: object; facade: object }>()
    return new Proxy(owner, {
      get: (target, key, receiver) => {
        const value = Reflect.get(target, key, receiver)
        if (typeof value !== 'function' || key === 'constructor') return value
        const previous = methods.get(key)
        if (previous?.source === value) return previous.facade
        const facade = new Proxy(value, {
          apply: (method, _receiver, args) => {
            this.assertMethod(key)
            if (key === 'start') this.starting++
            try {
              const result = Reflect.apply(method, target, args)
              if (ownedAsyncMethods.has(key)) {
                this.track(result, () => {
                  if (key === 'start') this.starting--
                })
              }
              return result
            } catch (error) {
              if (key === 'start') this.starting--
              throw error
            }
          }
        })
        methods.set(key, { source: value, facade })
        return facade
      }
    })
  }

  featureAPI<T extends object>(api: T): T {
    const previous = this.featureFacades.get(api)
    if (previous) return previous as T
    // A separate facade supports frozen caller-owned API objects without
    // violating Proxy invariants or changing the original definition.
    const methods = new Map<PropertyKey, { source: object; facade: object }>()
    const result = new Proxy({} as T, {
      get: (_target, key) => {
        const method = Reflect.get(api, key)
        if (typeof method !== 'function') return method
        const previousMethod = methods.get(key)
        if (previousMethod?.source === method) return previousMethod.facade
        const facade = new Proxy(method, {
          apply: (source, receiver, args) => {
            this.assertActive()
            const value = Reflect.apply(
              source,
              receiver === result ? api : receiver,
              args
            )
            if (value && typeof value.then === 'function') this.track(value)
            return value
          },
          construct: (source, args, newTarget) => {
            this.assertActive()
            return Reflect.construct(source, args, newTarget)
          }
        })
        methods.set(key, { source: method, facade })
        return facade
      },
      set: (_target, key, value) => {
        this.assertActive()
        return Reflect.set(api, key, value)
      },
      has: (_target, key) => Reflect.has(api, key),
      ownKeys: () => Reflect.ownKeys(api),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(api, key)
        return descriptor ? { ...descriptor, configurable: true } : undefined
      },
      getPrototypeOf: () => Reflect.getPrototypeOf(api)
    })
    this.featureFacades.set(api, result)
    return result
  }

  cleanup(dispose: () => void): () => void {
    let disposed = false
    let disposing = false
    return () => {
      if (disposed || disposing || !this.isUsable()) return
      disposing = true
      try {
        dispose()
        disposed = true
      } finally {
        disposing = false
      }
    }
  }
}
