import * as Y from 'yjs'
import { MapRegistry } from '@asyra/utils'

export type SharedDataChannelName = string

export type SharedDataChannelChangeHandler<TChange = unknown> = (
  change: TChange
) => void

// Y.Array is invariant in T, so we store channels as Y.Array<any> in registry.
// Actual payload typing is handled by observer registration sites.
type SharedDataChannel = Y.Array<any>

const noop = () => {}

const processObservedItems = (
  items: Iterable<unknown>,
  handler: SharedDataChannelChangeHandler
): void => {
  for (const item of items) {
    // YJS internals expose inserted/deleted content through item.content.getContent().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (item as any).content?.getContent?.()
    if (!Array.isArray(contents)) {
      continue
    }

    contents.forEach((change) => {
      handler(change)
    })
  }
}

export class SharedDataChannelRegistry {
  private readonly channels = new MapRegistry<SharedDataChannelName, SharedDataChannel>()

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

    channel.push([change])
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

    const observer = (event: Y.YArrayEvent<unknown>) => {
      processObservedItems(event.changes.added, handler as SharedDataChannelChangeHandler)
      processObservedItems(
        event.changes.deleted,
        handler as SharedDataChannelChangeHandler
      )
    }

    channel.observe(observer)
    return () => {
      channel.unobserve(observer)
    }
  }
}
