import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  core: {
    deps: {
      render: {},
      systemContext: {},
      sceneTree: {},
      factory: {},
      selection: {},
      inputSystem: {}
    },
    setPersistence: vi.fn(),
    start: vi.fn(),
    destroyRenderer: vi.fn()
  },
  localStorageProvider: {}
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
    harness.core.setPersistence.mockReset()
    harness.core.start.mockReset().mockResolvedValue(undefined)
    harness.core.destroyRenderer.mockReset()
    document.body.replaceChildren()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    document.body.replaceChildren()
    globalThis.IS_REACT_ACT_ENVIRONMENT = false
  })

  it('starts only the live Core lifetime and delegates StrictMode teardown', async () => {
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

    expect(harness.core.destroyRenderer).toHaveBeenCalledTimes(1)
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

    expect(harness.core.destroyRenderer).toHaveBeenCalledTimes(2)
  })
})
