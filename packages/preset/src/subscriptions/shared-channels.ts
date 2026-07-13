import {
  getYjsDataChannel,
  hasSharedDataChannel,
  registerSharedDataChannel
} from '@asyra/core'
import { SharedDataChannelNames } from '@asyra/utils'

let hasRegistered = false

export const registerDefaultSharedDataChannels = (): void => {
  if (hasRegistered) {
    return
  }

  if (!hasSharedDataChannel(SharedDataChannelNames.SCENE_TREE)) {
    registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      getYjsDataChannel(SharedDataChannelNames.SCENE_TREE)
    )
  }

  if (!hasSharedDataChannel(SharedDataChannelNames.SELECTION)) {
    registerSharedDataChannel(
      SharedDataChannelNames.SELECTION,
      getYjsDataChannel(SharedDataChannelNames.SELECTION)
    )
  }

  if (!hasSharedDataChannel(SharedDataChannelNames.PROPS)) {
    registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      getYjsDataChannel(SharedDataChannelNames.PROPS)
    )
  }

  hasRegistered = true
}
