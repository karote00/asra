import { MapRegistry, measureBrowserDragPhase } from '@asyra/utils'
import {
  cloneAndDeepFreezeValue,
  cloneValue,
  deepFreezeValue
} from './value-clone'

export type SharedDataChannelName = string

export type SharedDataChannelChangeHandler<TChange = unknown> = (
  change: TChange
) => void

export type SharedDataChannelBatchChangeHandler<TChange = unknown> = (
  changes: readonly TChange[]
) => void

export interface SharedDataChannel {
  readonly batchAppendIsAtomic?: true
  append(change: unknown): void
  observe(handler: SharedDataChannelChangeHandler): () => void
  appendBatch?(changes: readonly unknown[]): void
  observeBatch?(handler: SharedDataChannelBatchChangeHandler): () => void
}

const noop = (): void => undefined

const builtInLocalSharedDataChannels = new WeakSet<object>()
const appendFactoryOwnedLocalBatch = Symbol(
  'factory.appendFactoryOwnedLocalBatch'
)

export class LocalSharedDataChannel implements SharedDataChannel {
  readonly batchAppendIsAtomic = true
  private readonly batchHandlers =
    new Set<SharedDataChannelBatchChangeHandler>()

  constructor() {
    if (new.target === LocalSharedDataChannel) {
      builtInLocalSharedDataChannels.add(this)
    }
  }

  append(change: unknown): void {
    this.appendBatch([change])
  }

  appendBatch(changes: readonly unknown[]): void {
    const detachedBatch = measureBrowserDragPhase(
      'factory:shared-channel-clone',
      () => cloneAndDeepFreezeValue([...changes])
    )
    this[appendFactoryOwnedLocalBatch](detachedBatch)
  }

  private [appendFactoryOwnedLocalBatch](changes: readonly unknown[]): void {
    measureBrowserDragPhase('factory:shared-channel-append', () => {
      const handlers = [...this.batchHandlers]
      handlers.forEach((handler) => {
        try {
          measureBrowserDragPhase('factory:shared-channel-observer', () =>
            handler(changes)
          )
        } catch {
          // Local projection observers cannot invalidate an applied change.
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

const builtInLocalSharedDataChannelAppend =
  LocalSharedDataChannel.prototype.append
const builtInLocalSharedDataChannelAppendBatch =
  LocalSharedDataChannel.prototype.appendBatch
const builtInLocalSharedDataChannelObserveBatch =
  LocalSharedDataChannel.prototype.observeBatch

const canAppendFactoryOwnedBatch = (channel: SharedDataChannel): boolean => {
  const append = channel.append
  const appendBatch = channel.appendBatch
  return (
    (builtInLocalSharedDataChannels.has(channel) &&
      append === builtInLocalSharedDataChannelAppend &&
      appendBatch === builtInLocalSharedDataChannelAppendBatch) ||
    (channel.batchAppendIsAtomic === true &&
      typeof appendBatch === 'function' &&
      appendBatch !== builtInLocalSharedDataChannelAppendBatch)
  )
}

const appendFactoryOwnedBatch = (
  channel: SharedDataChannel,
  changes: readonly unknown[]
): void => {
  const append = channel.append
  const appendBatch = channel.appendBatch
  if (
    builtInLocalSharedDataChannels.has(channel) &&
    append === builtInLocalSharedDataChannelAppend &&
    appendBatch === builtInLocalSharedDataChannelAppendBatch
  ) {
    Reflect.apply(
      (
        channel as LocalSharedDataChannel & {
          [appendFactoryOwnedLocalBatch]: (batch: readonly unknown[]) => void
        }
      )[appendFactoryOwnedLocalBatch],
      channel,
      [changes]
    )
    return
  }

  const channelBatch = measureBrowserDragPhase(
    'factory:shared-channel-boundary-clone',
    () => cloneValue([...changes])
  )
  if (
    channel.batchAppendIsAtomic === true &&
    typeof appendBatch === 'function' &&
    appendBatch !== builtInLocalSharedDataChannelAppendBatch
  ) {
    Reflect.apply(appendBatch, channel, [channelBatch])
    return
  }
  channelBatch.forEach((change) => {
    Reflect.apply(append, channel, [change])
  })
}

const builtInSharedDataChannelRegistries = new WeakSet<object>()
const pushFactoryOwnedRegistryBatch = Symbol(
  'factory.pushFactoryOwnedRegistryBatch'
)

interface BatchObserverState {
  channel: SharedDataChannel
  handlers: Set<SharedDataChannelBatchChangeHandler>
  dispose: () => void
}

export class SharedDataChannelRegistry {
  private readonly channels = new MapRegistry<
    SharedDataChannelName,
    SharedDataChannel
  >()
  private readonly batchObserverStates = new Map<
    SharedDataChannelName,
    BatchObserverState
  >()

  constructor() {
    if (new.target === SharedDataChannelRegistry) {
      builtInSharedDataChannelRegistries.add(this)
    }
  }

  register(name: SharedDataChannelName, channel: SharedDataChannel): void {
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
    return this[pushFactoryOwnedRegistryBatch](
      name,
      cloneAndDeepFreezeValue([...changes])
    )
  }

  canPushBatchToSharedChannel(name: SharedDataChannelName): boolean {
    const channel = this.channels.get(name)
    return channel ? canAppendFactoryOwnedBatch(channel) : false
  }

  private [pushFactoryOwnedRegistryBatch](
    name: SharedDataChannelName,
    changes: readonly unknown[]
  ): boolean {
    const channel = this.channels.get(name)
    if (!channel) {
      return false
    }
    appendFactoryOwnedBatch(channel, changes)
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
      const fanOut = (changes: readonly unknown[], factoryOwned: boolean) => {
        const batch = factoryOwned
          ? deepFreezeValue(changes)
          : measureBrowserDragPhase(
              'factory:shared-channel-observe-boundary-clone',
              () => cloneAndDeepFreezeValue([...changes])
            )
        ;[...handlers].forEach((batchHandler) => {
          try {
            batchHandler(batch)
          } catch {
            // Projection observers cannot invalidate a received change.
          }
        })
      }
      this.batchObserverStates.set(name, nextState)
      try {
        const observeBatch = channel.observeBatch
        if (observeBatch) {
          const factoryOwned =
            builtInLocalSharedDataChannels.has(channel) &&
            observeBatch === builtInLocalSharedDataChannelObserveBatch
          nextState.dispose = Reflect.apply(observeBatch, channel, [
            (changes: readonly unknown[]) => fanOut(changes, factoryOwned)
          ])
        } else {
          nextState.dispose = channel.observe((change) =>
            fanOut([change], false)
          )
        }
      } catch (error) {
        this.batchObserverStates.delete(name)
        throw error
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

const builtInSharedDataChannelRegistryPush =
  SharedDataChannelRegistry.prototype.pushToSharedChannel
const builtInSharedDataChannelRegistryPushBatch =
  SharedDataChannelRegistry.prototype.pushBatchToSharedChannel
const builtInSharedDataChannelRegistryCanPushBatch =
  SharedDataChannelRegistry.prototype.canPushBatchToSharedChannel

export const canPushFactoryOwnedBatchToSharedChannel = (
  sink: Pick<SharedDataChannelRegistry, 'pushToSharedChannel'> &
    Partial<
      Pick<
        SharedDataChannelRegistry,
        'pushBatchToSharedChannel' | 'canPushBatchToSharedChannel'
      >
    >,
  name: SharedDataChannelName
): boolean => {
  const push = sink.pushToSharedChannel
  const pushBatch = sink.pushBatchToSharedChannel
  const canPushBatch = sink.canPushBatchToSharedChannel
  if (
    builtInSharedDataChannelRegistries.has(sink) &&
    push === builtInSharedDataChannelRegistryPush &&
    pushBatch === builtInSharedDataChannelRegistryPushBatch &&
    canPushBatch === builtInSharedDataChannelRegistryCanPushBatch
  ) {
    return Reflect.apply(canPushBatch, sink, [name])
  }
  if (
    typeof canPushBatch === 'function' &&
    canPushBatch !== builtInSharedDataChannelRegistryCanPushBatch &&
    typeof pushBatch === 'function' &&
    pushBatch !== builtInSharedDataChannelRegistryPushBatch
  ) {
    return Reflect.apply(canPushBatch, sink, [name])
  }
  return false
}

export const pushFactoryOwnedChangeToSharedChannel = (
  sink: Pick<SharedDataChannelRegistry, 'pushToSharedChannel'>,
  name: SharedDataChannelName,
  change: unknown
): boolean =>
  pushFactoryOwnedBatchToSharedChannel(sink, name, deepFreezeValue([change]))

export const pushFactoryOwnedBatchToSharedChannel = (
  sink: Pick<SharedDataChannelRegistry, 'pushToSharedChannel'> &
    Partial<
      Pick<
        SharedDataChannelRegistry,
        'pushBatchToSharedChannel' | 'canPushBatchToSharedChannel'
      >
    >,
  name: SharedDataChannelName,
  changes: readonly unknown[]
): boolean => {
  const push = sink.pushToSharedChannel
  const pushBatch = sink.pushBatchToSharedChannel
  if (
    builtInSharedDataChannelRegistries.has(sink) &&
    push === builtInSharedDataChannelRegistryPush &&
    pushBatch === builtInSharedDataChannelRegistryPushBatch
  ) {
    return Reflect.apply(
      (
        sink as SharedDataChannelRegistry & {
          [pushFactoryOwnedRegistryBatch]: (
            channelName: SharedDataChannelName,
            batch: readonly unknown[]
          ) => boolean
        }
      )[pushFactoryOwnedRegistryBatch],
      sink,
      [name, changes]
    )
  }

  const sinkBatch = measureBrowserDragPhase(
    'factory:shared-sink-boundary-clone',
    () => cloneValue([...changes])
  )
  if (
    typeof pushBatch === 'function' &&
    pushBatch !== builtInSharedDataChannelRegistryPushBatch &&
    canPushFactoryOwnedBatchToSharedChannel(sink, name)
  ) {
    return Reflect.apply(pushBatch, sink, [name, sinkBatch])
  }
  let delivered = true
  sinkBatch.forEach((change) => {
    delivered = Reflect.apply(push, sink, [name, change]) && delivered
  })
  return delivered
}
