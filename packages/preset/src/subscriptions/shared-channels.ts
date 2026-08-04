import { SharedDataChannelNames } from '@asyra/utils'
import type { PresetCoreAPIs } from '../types.js'
import { createCleanupReporter } from '../cleanup-reporter.js'

type SharedDataChannelName = string

interface SharedChannelLifetime {
  count: number
  ownedByPreset: boolean
}

type SharedChannelCore = Pick<
  PresetCoreAPIs,
  | 'createLocalSharedDataChannel'
  | 'hasSharedDataChannel'
  | 'registerSharedDataChannel'
  | 'unregisterSharedDataChannel'
>

const channelLifetimesByCore = new WeakMap<
  SharedChannelCore,
  Map<SharedDataChannelName, SharedChannelLifetime>
>()

export const DEFAULT_CHANNEL_NAMES = [
  SharedDataChannelNames.SCENE_TREE,
  SharedDataChannelNames.SELECTION,
  SharedDataChannelNames.PROPS
] as const

export const registerDefaultSharedDataChannels = (
  core: SharedChannelCore,
  onCleanupReady?: (dispose: () => void) => void,
  channelNames: readonly SharedDataChannelName[] = DEFAULT_CHANNEL_NAMES
): (() => void) => {
  const channelLifetimes =
    channelLifetimesByCore.get(core) ??
    new Map<SharedDataChannelName, SharedChannelLifetime>()
  channelLifetimesByCore.set(core, channelLifetimes)
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
        core.unregisterSharedDataChannel(name)
      }
      channelLifetimes.delete(name)
      acquiredChannels.splice(index, 1)
    }
    if (channelLifetimes.size === 0) {
      channelLifetimesByCore.delete(core)
    }
    disposed = true
  }
  const cleanupReporter = createCleanupReporter(onCleanupReady, dispose)

  try {
    channelNames.forEach((name) => {
      const lifetime = channelLifetimes.get(name)
      if (lifetime) {
        lifetime.count += 1
        acquiredChannels.push(name)
        cleanupReporter.report()
        return
      }

      const ownedByPreset = !core.hasSharedDataChannel(name)
      if (ownedByPreset) {
        core.registerSharedDataChannel(
          name,
          core.createLocalSharedDataChannel()
        )
      }

      channelLifetimes.set(name, { count: 1, ownedByPreset })
      acquiredChannels.push(name)
      cleanupReporter.report()
    })
  } catch (error) {
    if (!cleanupReporter.hasReported()) dispose()
    throw error
  }

  return dispose
}
