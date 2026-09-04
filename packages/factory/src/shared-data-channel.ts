import { MapRegistry, measureBrowserDragPhase } from '@asyra/utils'
import { cloneAndDeepFreezeValue, isDeeplyFrozenValue } from './value-clone.js'

export type SharedDataChannelName = string

export type SharedDataChannelChangeHandler<TChange = unknown> = (
  change: TChange
) => void

export type SharedDataChannelBatchChangeHandler<TChange = unknown> = (
  changes: readonly TChange[]
) => void

export interface SharedDataChannel {
  appendBatch(changes: readonly unknown[]): void
  observeBatch(handler: SharedDataChannelBatchChangeHandler): () => void
}

const noop = (): void => undefined

export class LocalSharedDataChannel implements SharedDataChannel {
  private readonly batchHandlers =
    new Set<SharedDataChannelBatchChangeHandler>()

  append(change: unknown): void {
    this.appendBatch([change])
  }

  appendBatch(changes: readonly unknown[]): void {
    const detachedBatch = measureBrowserDragPhase(
      'factory:shared-channel-clone',
      () =>
        isDeeplyFrozenValue(changes)
          ? changes
          : cloneAndDeepFreezeValue([...changes])
    )
    measureBrowserDragPhase('factory:shared-channel-append', () => {
      const handlers = [...this.batchHandlers]
      handlers.forEach((handler) => {
        try {
          measureBrowserDragPhase('factory:shared-channel-observer', () =>
            handler(detachedBatch)
          )
        } catch {
          // Local projection observers cannot invalidate an applied batch.
        }
      })
    })
  }

  observe(handler: SharedDataChannelChangeHandler): () => void {
    return this.observeBatch((changes) => {
      changes.forEach(handler)
    })
  }

  observeBatch(handler: SharedDataChannelBatchChangeHandler): () => void {
    this.batchHandlers.add(handler)
    return () => {
      this.batchHandlers.delete(handler)
    }
  }
}

interface BatchObserverState {
  channel: SharedDataChannel
  handlers: Set<SharedDataChannelBatchChangeHandler>
  dispose: () => void
}

const assertSharedDataChannel = (
  name: SharedDataChannelName,
  channel: SharedDataChannel
): void => {
  if (typeof channel.appendBatch !== 'function') {
    throw new Error(
      `[factory] Shared data channel "${name}" requires appendBatch`
    )
  }
  if (typeof channel.observeBatch !== 'function') {
    throw new Error(
      `[factory] Shared data channel "${name}" requires observeBatch`
    )
  }
}

export class SharedDataChannelRegistry {
  private activeOperations = 0
  private readonly channels = new MapRegistry<
    SharedDataChannelName,
    SharedDataChannel
  >()
  private readonly batchObserverStates = new Map<
    SharedDataChannelName,
    BatchObserverState
  >()

  register(name: SharedDataChannelName, channel: SharedDataChannel): void {
    assertSharedDataChannel(name, channel)
    this.channels.register(name, channel, {
      duplicateErrorMessage: `[factory] Shared data channel "${name}" is already registered`
    })
  }

  unregister(name: SharedDataChannelName): boolean {
    const observerState = this.batchObserverStates.get(name)
    observerState?.dispose()
    this.batchObserverStates.delete(name)
    return this.channels.delete(name)
  }

  /** Release only observations acquired here, not creator-owned channel resources. */
  clear(): void {
    this.assertRuntimeResetAllowed()
    const states = [...this.batchObserverStates.values()]
    this.batchObserverStates.clear()
    this.channels.clear()
    states.forEach((state) => {
      state.handlers.clear()
    })
    let failed = false
    let firstError: unknown
    states.forEach((state) => {
      try {
        state.dispose()
      } catch (error) {
        if (!failed) {
          failed = true
          firstError = error
        }
      }
    })
    if (failed) throw firstError
  }

  assertRuntimeResetAllowed(): void {
    if (this.activeOperations > 0) {
      throw new Error(
        'Factory runtime cannot reset during active shared-channel observation or delivery'
      )
    }
  }

  has(name: SharedDataChannelName): boolean {
    return this.channels.has(name)
  }

  get(name: SharedDataChannelName): SharedDataChannel | undefined {
    return this.channels.get(name)
  }

  import(name: SharedDataChannelName): SharedDataChannel {
    const channel = this.get(name)
    if (!channel) {
      throw new Error(`[factory] Shared data channel "${name}" not found`)
    }

    return channel
  }

  pushToSharedChannel(name: SharedDataChannelName, change: unknown): boolean {
    return this.pushBatchToSharedChannel(name, [change])
  }

  pushBatchToSharedChannel(
    name: SharedDataChannelName,
    changes: readonly unknown[]
  ): boolean {
    const channel = this.channels.get(name)
    if (!channel) {
      return false
    }
    Reflect.apply(channel.appendBatch, channel, [changes])
    return true
  }

  observe<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelChangeHandler<TChange>
  ): () => void {
    return this.observeBatch(name, (changes) => {
      changes.forEach((change) => handler(change as TChange))
    })
  }

  observeBatch<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelBatchChangeHandler<TChange>
  ): () => void {
    const channel = this.channels.get(name)
    if (!channel) {
      return noop
    }

    const batchHandler = handler as SharedDataChannelBatchChangeHandler
    let state = this.batchObserverStates.get(name)
    if (!state || state.channel !== channel) {
      state?.dispose()
      const handlers = new Set<SharedDataChannelBatchChangeHandler>([
        batchHandler
      ])
      const nextState: BatchObserverState = {
        channel,
        handlers,
        dispose: noop
      }
      this.batchObserverStates.set(name, nextState)
      this.activeOperations += 1
      try {
        nextState.dispose = Reflect.apply(channel.observeBatch, channel, [
          (changes: readonly unknown[]) => {
            this.activeOperations += 1
            try {
              ;[...handlers].forEach((registeredHandler) => {
                try {
                  registeredHandler(changes)
                } catch {
                  // Projection observers cannot invalidate a received batch.
                }
              })
            } finally {
              this.activeOperations -= 1
            }
          }
        ])
      } catch (error) {
        this.batchObserverStates.delete(name)
        throw error
      } finally {
        this.activeOperations -= 1
      }
      state = nextState
    } else {
      state.handlers.add(batchHandler)
    }

    const observerState = state
    return () => {
      observerState.handlers.delete(batchHandler)
      if (
        observerState.handlers.size === 0 &&
        this.batchObserverStates.get(name) === observerState
      ) {
        observerState.dispose()
        this.batchObserverStates.delete(name)
      }
    }
  }
}

export const pushFactoryOwnedBatchToSharedChannel = (
  sink: Pick<SharedDataChannelRegistry, 'pushBatchToSharedChannel'>,
  name: SharedDataChannelName,
  changes: readonly unknown[]
): boolean => sink.pushBatchToSharedChannel(name, changes)
