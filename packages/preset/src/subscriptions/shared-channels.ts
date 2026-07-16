import {
  getYjsDataChannel,
  hasSharedDataChannel,
  registerSharedDataChannel,
  unregisterSharedDataChannel
} from '@asyra/core'
import { SharedDataChannelNames } from '@asyra/utils'

type SharedDataChannelName = string

interface SharedChannelLifetime {
  count: number
  ownedByPreset: boolean
}

const channelLifetimes = new Map<SharedDataChannelName, SharedChannelLifetime>()

const DEFAULT_CHANNEL_NAMES = [
  SharedDataChannelNames.SCENE_TREE,
  SharedDataChannelNames.SELECTION,
  SharedDataChannelNames.PROPS
] as const

export const registerDefaultSharedDataChannels = (): (() => void) => {
  const acquiredChannels: SharedDataChannelName[] = []
  let disposed = false

  const dispose = (): void => {
    if (disposed) return

    for (let index = acquiredChannels.length - 1; index >= 0; index--) {
      const name = acquiredChannels[index]
      const lifetime = channelLifetimes.get(name)
      if (!lifetime) {
        acquiredChannels.splice(index, 1)
        continue
      }

      if (lifetime.count > 1) {
        lifetime.count -= 1
        acquiredChannels.splice(index, 1)
        continue
      }

      if (lifetime.ownedByPreset) {
        unregisterSharedDataChannel(name)
      }
      channelLifetimes.delete(name)
      acquiredChannels.splice(index, 1)
    }
    disposed = true
  }

  try {
    DEFAULT_CHANNEL_NAMES.forEach((name) => {
      const lifetime = channelLifetimes.get(name)
      if (lifetime) {
        lifetime.count += 1
        acquiredChannels.push(name)
        return
      }

      const ownedByPreset = !hasSharedDataChannel(name)
      if (ownedByPreset) {
        registerSharedDataChannel(name, getYjsDataChannel(name))
      }

      channelLifetimes.set(name, { count: 1, ownedByPreset })
      acquiredChannels.push(name)
    })
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
