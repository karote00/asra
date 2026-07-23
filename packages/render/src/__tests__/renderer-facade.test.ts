import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderRuntime = {
  app: null as { canvas: HTMLCanvasElement; instance: unknown } | null,
  init: vi.fn(),
  start: vi.fn(),
  getViewportPosition: vi.fn(() => ({ x: 12, y: 24 })),
  getViewportScale: vi.fn(() => 2),
  panTo: vi.fn(),
  zoomToCenter: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn()
}

import { PixiJSRenderer, RenderAdapter } from '../index'
import type { Render } from '../render'
import PixiJSRendererDefault from '../pixi-renderer'

describe('Framework renderer facade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderRuntime.app = null
  })

  it('exposes an engine-neutral adapter with the existing renderer lifecycle', async () => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const app = { canvas, instance: { name: 'engine-runtime' } }
    renderRuntime.init.mockImplementation(async () => {
      renderRuntime.app = app
      return app
    })
    const adapter = new RenderAdapter(renderRuntime as unknown as Render)

    const result = await adapter.init(container, {
      width: 640,
      height: 480,
      backgroundColor: 0x112233
    })

    expect(adapter.name).toBe('RenderAdapter')
    expect(renderRuntime.init).toHaveBeenCalledWith(
      640,
      480,
      0x112233,
      container
    )
    expect(renderRuntime.start).toHaveBeenCalledOnce()
    expect(result).toEqual({ canvas, instance: app.instance })
    expect(adapter.getViewportPosition()).toEqual({ x: 12, y: 24 })
    expect(adapter.getViewportScale()).toBe(2)
    expect(adapter.getCanvas()).toBe(canvas)
    expect(adapter.getInstance()).toEqual({ name: 'engine-runtime' })
  })

  it('binds every facade operation to an explicitly selected Render instance', async () => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const app = { canvas, instance: { name: 'selected-runtime' } }
    const selectedRuntime = {
      ...renderRuntime,
      app: null as typeof renderRuntime.app,
      init: vi.fn(async () => {
        selectedRuntime.app = app
        return app
      }),
      start: vi.fn(),
      getViewportPosition: vi.fn(() => ({ x: 30, y: 40 })),
      getViewportScale: vi.fn(() => 3),
      dispose: vi.fn()
    }
    const adapter = new RenderAdapter(selectedRuntime as unknown as Render)

    const result = await adapter.init(container, {
      width: 320,
      height: 240,
      backgroundColor: 0x445566
    })

    expect(selectedRuntime.init).toHaveBeenCalledWith(
      320,
      240,
      0x445566,
      container
    )
    expect(selectedRuntime.start).toHaveBeenCalledOnce()
    expect(adapter.getViewportPosition()).toEqual({ x: 30, y: 40 })
    expect(adapter.getViewportScale()).toBe(3)
    expect(adapter.getCanvas()).toBe(canvas)
    expect(adapter.getInstance()).toEqual({ name: 'selected-runtime' })
    expect(result.instance).toBe(adapter.getInstance())
    adapter.destroy()
    expect(selectedRuntime.dispose).toHaveBeenCalledOnce()
  })

  it('keeps PixiJSRenderer as a warn-once compatibility alias', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const first = new PixiJSRenderer()
    const second = new PixiJSRendererDefault()

    expect(first).toBeInstanceOf(RenderAdapter)
    expect(second).toBeInstanceOf(RenderAdapter)
    expect(first.name).toBe('PixiJSRenderer')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      'PixiJSRenderer is deprecated. Use RenderAdapter from @asyra/render.'
    )
  })

  it('routes adapter teardown through the active render runtime exactly once', async () => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const app = { canvas, instance: { name: 'engine-runtime' } }
    renderRuntime.init.mockImplementation(async () => {
      renderRuntime.app = app
      return app
    })
    const adapter = new RenderAdapter(renderRuntime as unknown as Render)
    await adapter.init(container, {
      width: 640,
      height: 480,
      backgroundColor: 0x112233
    })
    container.appendChild(canvas)

    adapter.destroy()
    adapter.destroy()

    expect(renderRuntime.dispose).toHaveBeenCalledOnce()
    expect(container.childElementCount).toBe(0)
  })

  it('finishes pending initialization as cleanup without starting the runtime', async () => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const app = { canvas, instance: { name: 'pending-runtime' } }
    let resolveInitialization: ((value: typeof app) => void) | undefined
    renderRuntime.init.mockImplementation(
      () =>
        new Promise<typeof app>((resolve) => {
          resolveInitialization = resolve
        })
    )
    const adapter = new RenderAdapter(renderRuntime as unknown as Render)

    const initialization = adapter.init(container, {
      width: 640,
      height: 480,
      backgroundColor: 0x112233
    })
    adapter.destroy()
    resolveInitialization?.(app)

    await expect(initialization).rejects.toThrow(
      'Render adapter was destroyed during initialization'
    )
    expect(renderRuntime.start).not.toHaveBeenCalled()
    expect(renderRuntime.dispose).toHaveBeenCalledOnce()
    expect(container.childElementCount).toBe(0)
  })

  it('documents the public replacement on the deprecated class', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/renderer.ts'),
      'utf8'
    )

    expect(source).toMatch(
      /@deprecated Use `RenderAdapter` from `@asyra\/render`/
    )
  })
})
