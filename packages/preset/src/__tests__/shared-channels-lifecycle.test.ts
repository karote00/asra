import { afterEach, describe, expect, it } from 'vitest'
import core, * as coreFacade from '@asyra/core'
import { SharedDataChannelNames } from '@asyra/utils'
import { registerDefaultSharedDataChannels } from '../subscriptions'

const channelNames = [
  SharedDataChannelNames.SCENE_TREE,
  SharedDataChannelNames.SELECTION,
  SharedDataChannelNames.PROPS
] as const

const unregisterChannel = (name: (typeof channelNames)[number]): boolean =>
  (
    coreFacade as typeof coreFacade & {
      unregisterSharedDataChannel?: (channel: typeof name) => boolean
    }
  ).unregisterSharedDataChannel?.(name) ?? false

afterEach(() => {
  channelNames.forEach(unregisterChannel)
})

describe('preset shared data channel lifecycle', () => {
  it('keeps channels alive until the last preset lifetime is disposed', () => {
    channelNames.forEach(unregisterChannel)

    const disposeFirst = registerDefaultSharedDataChannels(
      core
    ) as unknown as () => void
    const disposeSecond = registerDefaultSharedDataChannels(
      core
    ) as unknown as () => void

    expect(channelNames.every(coreFacade.hasSharedDataChannel)).toBe(true)

    disposeFirst()
    expect(channelNames.every(coreFacade.hasSharedDataChannel)).toBe(true)

    disposeSecond()
    expect(channelNames.every(coreFacade.hasSharedDataChannel)).toBe(false)
  })

  it('does not unregister a channel supplied by the app', () => {
    channelNames.forEach(unregisterChannel)
    coreFacade.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      coreFacade.createLocalSharedDataChannel()
    )

    const dispose = registerDefaultSharedDataChannels(
      core
    ) as unknown as () => void
    dispose()

    expect(
      coreFacade.hasSharedDataChannel(SharedDataChannelNames.SCENE_TREE)
    ).toBe(true)
    expect(
      coreFacade.hasSharedDataChannel(SharedDataChannelNames.SELECTION)
    ).toBe(false)
    expect(coreFacade.hasSharedDataChannel(SharedDataChannelNames.PROPS)).toBe(
      false
    )
  })
})
