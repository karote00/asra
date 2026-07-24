import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import RenderApp, { type CanvasContextMenuInvocation } from '../index'

const setReactActEnvironment = (active: boolean) => {
  ;(
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean
    }
  ).IS_REACT_ACT_ENVIRONMENT = active
}

describe('Render canvas context-menu intake', () => {
  beforeEach(() => {
    vi.spyOn(core, 'setPersistence').mockImplementation(() => undefined)
    vi.spyOn(core, 'start').mockResolvedValue(undefined)
    vi.spyOn(core, 'destroyRenderer').mockImplementation(() => undefined)
    localStorage.clear()
    document.body.replaceChildren()
    setReactActEnvironment(true)
  })

  afterEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
    setReactActEnvironment(false)
    vi.restoreAllMocks()
  })

  it('accepts a canvas context event once with exact client coordinates', async () => {
    const invocations: CanvasContextMenuInvocation[] = []
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(
        <RenderApp
          onContextMenuRequest={(invocation) => invocations.push(invocation)}
        />
      )
      await Promise.resolve()
    })

    const canvasHost = rootHost.querySelector(
      '[data-testid="asyra-canvas-host"]'
    )
    expect(canvasHost).toBeInstanceOf(HTMLDivElement)
    const canvas = document.createElement('canvas')
    canvasHost?.append(canvas)
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 312,
      clientY: 184
    })

    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(invocations).toEqual([
      {
        clientX: 312,
        clientY: 184,
        invoker: canvasHost
      }
    ])

    await act(async () => root.unmount())
  })

  it('bypasses non-canvas targets and an unhandled canvas invocation', async () => {
    const onContextMenuRequest = vi.fn()
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(<RenderApp onContextMenuRequest={onContextMenuRequest} />)
      await Promise.resolve()
    })

    const canvasHost = rootHost.querySelector(
      '[data-testid="asyra-canvas-host"]'
    )
    const editable = document.createElement('input')
    canvasHost?.append(editable)
    const editableEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    editable.dispatchEvent(editableEvent)

    expect(editableEvent.defaultPrevented).toBe(false)
    expect(onContextMenuRequest).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
    })
    const canvas = document.createElement('canvas')
    canvasHost?.append(canvas)
    const unhandledEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    canvas.dispatchEvent(unhandledEvent)

    expect(unhandledEvent.defaultPrevented).toBe(false)
    expect(onContextMenuRequest).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('announces canvas-host teardown exactly once on unmount', async () => {
    const onCanvasHostTeardown = vi.fn()
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(<RenderApp onCanvasHostTeardown={onCanvasHostTeardown} />)
      await Promise.resolve()
    })
    expect(onCanvasHostTeardown).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<RenderApp onCanvasHostTeardown={onCanvasHostTeardown} />)
      await Promise.resolve()
    })
    expect(onCanvasHostTeardown).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    expect(onCanvasHostTeardown).toHaveBeenCalledTimes(1)
  })
})
