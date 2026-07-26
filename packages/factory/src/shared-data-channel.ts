import { MapRegistry, measureBrowserDragPhase } from '@asyra/utils'
import { cloneValue } from './value-clone'

export type SharedDataChannelName = string

export type SharedDataChannelChangeHandler<TChange = unknown> = (
  change: TChange
) => void

export interface SharedDataChannel {
  append(change: unknown): void
  observe(handler: SharedDataChannelChangeHandler): () => void
}

const noop = (): void => undefined

const builtInLocalSharedDataChannels = new WeakSet<object>()

export class LocalSharedDataChannel implements SharedDataChannel {
  private readonly handlers = new Set<SharedDataChannelChangeHandler>()

  constructor() {
    if (new.target === LocalSharedDataChannel) {
      builtInLocalSharedDataChannels.add(this)
    }
  }

  append(change: unknown): void {
    measureBrowserDragPhase('factory:shared-channel-append', () => {
      ;[...this.handlers].forEach((handler) => {
        try {
          const clonedChange = measureBrowserDragPhase(
            'factory:shared-channel-clone',
            () => cloneValue(change)
          )
          measureBrowserDragPhase('factory:shared-channel-observer', () =>
            handler(clonedChange)
          )
        } catch {
          // Local projection observers cannot invalidate an applied change.
        }
      })
    })
  }

  observe(handler: SharedDataChannelChangeHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }
}

const builtInLocalSharedDataChannelAppend =
  LocalSharedDataChannel.prototype.append

const appendFactoryOwnedChange = (
  channel: SharedDataChannel,
  change: unknown
): void => {
  const append = channel.append
  if (
    builtInLocalSharedDataChannels.has(channel) &&
    append === builtInLocalSharedDataChannelAppend
  ) {
    Reflect.apply(builtInLocalSharedDataChannelAppend, channel, [change])
    return
  }

  const channelChange = measureBrowserDragPhase(
    'factory:shared-channel-boundary-clone',
    () => cloneValue(change)
  )
  Reflect.apply(append, channel, [channelChange])
}

const builtInSharedDataChannelRegistries = new WeakSet<object>()

export class SharedDataChannelRegistry {
  private readonly channels = new MapRegistry<
    SharedDataChannelName,
    SharedDataChannel
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
    const channel = this.channels.get(name)
    if (!channel) {
      return false
    }
    appendFactoryOwnedChange(channel, change)
    return true
  }

  observe<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelChangeHandler<TChange>
  ): () => void {
    const channel = this.channels.get(name)
    if (!channel) {
      return noop
    }

    return channel.observe(handler as SharedDataChannelChangeHandler)
  }
}

const builtInSharedDataChannelRegistryPush =
  SharedDataChannelRegistry.prototype.pushToSharedChannel

export const pushFactoryOwnedChangeToSharedChannel = (
  sink: Pick<SharedDataChannelRegistry, 'pushToSharedChannel'>,
  name: SharedDataChannelName,
  change: unknown
): boolean => {
  const push = sink.pushToSharedChannel
  if (
    builtInSharedDataChannelRegistries.has(sink) &&
    push === builtInSharedDataChannelRegistryPush
  ) {
    return Reflect.apply(builtInSharedDataChannelRegistryPush, sink, [
      name,
      change
    ])
  }

  const sinkChange = measureBrowserDragPhase(
    'factory:shared-sink-boundary-clone',
    () => cloneValue(change)
  )
  return Reflect.apply(push, sink, [name, sinkChange])
}
