import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fileLoadSubscribers: [] as (() => void)[],
  fileLoadUnsubscribe: vi.fn(),
  getFeature: vi.fn(),
  subscribeToFileLoadComplete: vi.fn((subscriber: () => void) => {
    mocks.fileLoadSubscribers.push(subscriber)
    return {
      unsubscribe: mocks.fileLoadUnsubscribe
    }
  }),
  zoomFit: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getFeature: mocks.getFeature,
  subscribeToFileLoadComplete: mocks.subscribeToFileLoadComplete
}))

import DataContexts from '../data-change'

describe('App data-change context', () => {
  beforeEach(() => {
    mocks.fileLoadSubscribers.length = 0
    mocks.fileLoadUnsubscribe.mockClear()
    mocks.getFeature.mockReset()
    mocks.subscribeToFileLoadComplete.mockClear()
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

    expect(mocks.subscribeToFileLoadComplete).toHaveBeenCalledOnce()
    expect(mocks.fileLoadSubscribers).toHaveLength(1)

    act(() => {
      mocks.fileLoadSubscribers[0]?.()
    })

    expect(mocks.getFeature).toHaveBeenCalledOnce()
    expect(mocks.zoomFit).toHaveBeenCalledOnce()

    await act(async () => root.unmount())

    expect(mocks.fileLoadUnsubscribe).toHaveBeenCalledOnce()
  })
})
