import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderRuntime = vi.hoisted(() => ({
  app: null as { canvas: HTMLCanvasElement; instance: unknown } | null,
  init: vi.fn(),
  start: vi.fn(),
  getViewportPosition: vi.fn(() => ({ x: 12, y: 24 })),
  getViewportScale: vi.fn(() => 2),
  panTo: vi.fn(),
  zoomToCenter: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn()
}))

vi.mock('../render', () => ({
  default: renderRuntime,
  Render: class MockRender {
    readonly name = 'mock-render'
  }
}))

import { PixiJSRenderer, RenderAdapter } from '../index'
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
    const adapter = new RenderAdapter()

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
    expect(result).toEqual({ canvas, instance: app })
    expect(adapter.getViewportPosition()).toEqual({ x: 12, y: 24 })
    expect(adapter.getViewportScale()).toBe(2)
    expect(adapter.getCanvas()).toBe(canvas)
    expect(adapter.getInstance()).toEqual({ name: 'engine-runtime' })
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
    const adapter = new RenderAdapter()
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
