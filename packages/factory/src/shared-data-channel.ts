import { MapRegistry } from '@asyra/utils'
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

export class LocalSharedDataChannel implements SharedDataChannel {
  private readonly handlers = new Set<SharedDataChannelChangeHandler>()

  append(change: unknown): void {
    ;[...this.handlers].forEach((handler) => {
      try {
        handler(cloneValue(change))
      } catch {
        // Local projection observers cannot invalidate an applied change.
      }
    })
  }

  observe(handler: SharedDataChannelChangeHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }
}

export class SharedDataChannelRegistry {
  private readonly channels = new MapRegistry<
    SharedDataChannelName,
    SharedDataChannel
  >()

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
    channel.append(change)
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
