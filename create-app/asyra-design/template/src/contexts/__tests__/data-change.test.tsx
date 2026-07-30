import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fileLoadComplete: vi.fn(),
  fileLoadSubscribers: [] as (() => void)[],
  fileLoadUnsubscribe: vi.fn(),
  getFeature: vi.fn(),
  renderReadySubscribers: [] as (() => void)[],
  renderReadyUnsubscribe: vi.fn(),
  zoomFit: vi.fn()
}))

vi.mock('@asyra/reactive-events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/reactive-events')>()),
  fileLoadComplete: mocks.fileLoadComplete,
  subscribeToFileLoadComplete: vi.fn((subscriber: () => void) => {
    mocks.fileLoadSubscribers.push(subscriber)
    return {
      unsubscribe: mocks.fileLoadUnsubscribe
    }
  }),
  subscribeToRenderIsReady: vi.fn((subscriber: () => void) => {
    mocks.renderReadySubscribers.push(subscriber)
    return {
      unsubscribe: mocks.renderReadyUnsubscribe
    }
  })
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getFeature: mocks.getFeature
}))

import {
  subscribeToFileLoadComplete,
  subscribeToRenderIsReady
} from '@asyra/reactive-events'
import DataContexts from '../data-change'

describe('App data-change context', () => {
  beforeEach(() => {
    mocks.fileLoadComplete.mockClear()
    mocks.fileLoadSubscribers.length = 0
    mocks.fileLoadUnsubscribe.mockClear()
    mocks.getFeature.mockReset()
    mocks.renderReadySubscribers.length = 0
    mocks.renderReadyUnsubscribe.mockClear()
    mocks.zoomFit.mockClear()
    mocks.getFeature.mockReturnValue({
      zoomFit: mocks.zoomFit
    })
    document.body.replaceChildren()
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    document.body.replaceChildren()
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = false
    vi.clearAllMocks()
  })

  it('observes canonical file completion without synthesizing it from Render readiness', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<DataContexts />)
    })

    expect(subscribeToRenderIsReady).not.toHaveBeenCalled()
    expect(mocks.fileLoadComplete).not.toHaveBeenCalled()
    expect(subscribeToFileLoadComplete).toHaveBeenCalledOnce()
    expect(mocks.fileLoadSubscribers).toHaveLength(1)

    act(() => {
      mocks.fileLoadSubscribers[0]?.()
    })

    expect(mocks.getFeature).toHaveBeenCalledOnce()
    expect(mocks.zoomFit).toHaveBeenCalledOnce()

    await act(async () => root.unmount())

    expect(mocks.fileLoadUnsubscribe).toHaveBeenCalledOnce()
    expect(mocks.renderReadyUnsubscribe).not.toHaveBeenCalled()
  })
})
