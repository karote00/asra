import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  adapters: [] as { destroy: ReturnType<typeof vi.fn> }[],
  core: {
    deps: {
      render: {},
      systemContext: {},
      sceneTree: {},
      factory: {},
      selection: {},
      inputSystem: {}
    },
    setRenderer: vi.fn(),
    setPersistence: vi.fn(),
    start: vi.fn()
  },
  localStorageProvider: {}
}))

vi.mock('@asyra/render', () => ({
  RenderAdapter: class {
    readonly destroy = vi.fn()

    constructor() {
      harness.adapters.push(this)
    }
  }
}))

vi.mock('@asyra/core', () => ({
  default: harness.core,
  VECTOR_HANDLE_MODES: {
    NONE: 'none',
    MIRROR_ANGLE: 'mirror-angle',
    MIRROR_ANGLE_LENGTH: 'mirror-angle-length'
  }
}))

vi.mock('@asyra/preset', () => ({
  InputSystemEvents: {}
}))

vi.mock('@asyra/reactive-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asyra/reactive-events')>()

  return {
    ...actual,
    providers: {
      ...actual.providers,
      localStorage: harness.localStorageProvider
    }
  }
})

import RenderApp from '../index'

describe('RenderApp StrictMode lifecycle', () => {
  beforeEach(() => {
    harness.adapters.length = 0
    harness.core.setRenderer.mockReset()
    harness.core.setPersistence.mockReset()
    harness.core.start.mockReset().mockResolvedValue(undefined)
    document.body.replaceChildren()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    document.body.replaceChildren()
    globalThis.IS_REACT_ACT_ENVIRONMENT = false
  })

  it('starts only the live adapter and destroys each StrictMode instance', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <StrictMode>
          <RenderApp />
        </StrictMode>
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(harness.adapters).toHaveLength(2)
    const [discardedAdapter, liveAdapter] = harness.adapters
    expect(discardedAdapter.destroy).toHaveBeenCalledTimes(1)
    expect(liveAdapter.destroy).not.toHaveBeenCalled()
    expect(harness.core.setRenderer).toHaveBeenCalledTimes(1)
    expect(harness.core.setRenderer).toHaveBeenCalledWith(liveAdapter)
    expect(harness.core.setPersistence).toHaveBeenCalledWith(
      harness.localStorageProvider
    )
    expect(harness.core.start).toHaveBeenCalledTimes(1)
    expect(harness.core.start).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: window.innerWidth,
        height: window.innerHeight
      })
    )

    await act(async () => {
      root.unmount()
    })

    expect(discardedAdapter.destroy).toHaveBeenCalledTimes(1)
    expect(liveAdapter.destroy).toHaveBeenCalledTimes(1)
  })
})
