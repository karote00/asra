import { describe, expect, it, vi } from 'vitest'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import type {
  RenderEngine,
  RenderEngineInteractionEvent
} from '@asyra/render-engine'
import * as reactiveEvents from '@asyra/reactive-events'
import { Render } from '../render.js'
import RenderInteractionBridge from '../interaction/interaction-bridge.js'
import {
  RenderGraphics,
  RenderContainer,
  RenderObjectRuntime,
  type RenderResourceStyle
} from '../types/render-object.js'

describe('Render instance runtime reset', () => {
  it('retires provider, viewport, layer and frame state before fresh composition', async () => {
    const engine = new RecordingRenderEngine({ name: 'runtime-reset' }),
      render = new Render({ engine })
    const oldViewport = render.viewport,
      oldLayer = vi.fn(() => true),
      oldFrame = vi.fn()
    render.registerLayer({ name: 'custom', layer: {}, update: oldLayer })
    render.subscribeToFrameComplete(oldFrame)
    await render.init(10, 10, 0)
    render.start()
    render.panTo(5, 6)
    render.zoomTo(2)
    render.resetRuntime()
    expect(engine.getOwnedObjectCount()).toBe(0)
    expect(render.getEngine()).toBeNull()
    expect(render.app).toBeNull()
    expect(render.viewport).not.toBe(oldViewport)
    expect(render.viewport.getScale()).toBe(1)
    expect(render.getProjectedElementCount()).toBe(0)
    render.resetRuntime()
    oldLayer.mockClear()
    oldFrame.mockClear()
    render.setEngineProvider(
      () => new RecordingRenderEngine({ name: 'runtime-reset' })
    )
    render.registerLayer({ name: 'custom', layer: {} })
    await render.init(10, 10, 0)
    render.start()
    expect(oldLayer).not.toHaveBeenCalled()
    expect(oldFrame).not.toHaveBeenCalled()
    render.resetRuntime()
  })

  it('old provider and teardown handles cannot remove new registrations', async () => {
    const render = new Render(),
      cleanup = vi.fn()
    const releaseProvider = render.setEngineProvider(
      () => new RecordingRenderEngine({ name: 'runtime-reset' })
    )
    const releaseCleanup = render.registerTeardownCleanup(cleanup)
    render.resetRuntime()
    render.setEngineProvider(
      () => new RecordingRenderEngine({ name: 'runtime-reset' })
    )
    render.registerTeardownCleanup(cleanup)
    releaseProvider()
    releaseCleanup()
    await render.init(10, 10, 0)
    render.resetRuntime()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('a retained old frame callback cannot consume the successor frame', async () => {
    const engine = new RecordingRenderEngine({ name: 'runtime-reset' }),
      render = new Render({ engine })
    engine.requestFrame = vi.fn()
    await render.init(10, 10, 0)
    render.start()
    render.requestRender()
    const oldFrame = vi.mocked(engine.requestFrame).mock.calls[0]?.[0]
    if (!oldFrame) throw new Error('Missing scheduled frame')
    render.resetRuntime()
    const next = new RecordingRenderEngine({ name: 'runtime-reset' }),
      frame = vi.fn()
    render.setEngine(next)
    await render.init(10, 10, 0)
    render.start()
    render.subscribeToFrameComplete(frame)
    render.requestRender()
    oldFrame(1)
    expect(frame).not.toHaveBeenCalled()
    next.emitFrame(2)
    expect(frame).toHaveBeenCalledOnce()
    render.resetRuntime()
  })

  it('attempts all cleanup and destroys engine resources before reporting failure', async () => {
    const engine = new RecordingRenderEngine({ name: 'runtime-reset' }),
      render = new Render({ engine }),
      later = vi.fn()
    render.registerTeardownCleanup(() => {
      throw new Error('render cleanup failed')
    })
    render.registerTeardownCleanup(later)
    await render.init(10, 10, 0)
    render.start()
    render.requestRender()
    expect(() => render.resetRuntime()).toThrow('render cleanup failed')
    expect(later).toHaveBeenCalledOnce()
    expect(engine.getOwnedObjectCount()).toBe(0)
    expect(render.app).toBeNull()
  })

  it('rejects reset during engine initialization before changing the owner', async () => {
    const engine: RenderEngine = new RecordingRenderEngine({
      name: 'runtime-reset'
    })
    const render = new Render({ engine })
    const initialize = engine.initialize.bind(engine)
    let finish: (() => void) | undefined
    const barrier = new Promise<void>((resolve) => {
      finish = resolve
    })
    engine.initialize = async (options) => {
      await barrier
      return initialize(options)
    }
    const pending = render.init(10, 10, 0)
    expect(() => render.resetRuntime()).toThrow('idle')
    finish?.()
    await pending
    expect(render.getEngine()).toBe(engine)
    render.resetRuntime()
  })

  it('rejects reset during frame evaluation without destroying the current frame', async () => {
    const render = new Render({
      engine: new RecordingRenderEngine({ name: 'runtime-reset' })
    })
    const failures: unknown[] = []
    render.registerLayer({
      name: 'busy',
      layer: {},
      update: () => {
        try {
          render.resetRuntime()
        } catch (error) {
          failures.push(error)
        }
        return true
      }
    })
    const app = await render.init(10, 10, 0)
    render.start()
    expect(failures).toEqual([
      expect.objectContaining({ message: expect.stringContaining('idle') })
    ])
    expect(render.app).toBe(app)
    render.resetRuntime()
  })

  it('leaves an independent Render instance intact', async () => {
    const first = new Render(),
      second = new Render({
        engine: new RecordingRenderEngine({ name: 'runtime-reset' })
      })
    const app = await second.init(10, 10, 0)
    first.resetRuntime()
    expect(second.app).toBe(app)
    second.resetRuntime()
  })

  it('does not deliver remaining old frame subscribers after one retires the runtime', async () => {
    const render = new Render({
        engine: new RecordingRenderEngine({ name: 'frame-reset' })
      }),
      later = vi.fn()
    await render.init(10, 10, 0)
    render.subscribeToFrameComplete(() => render.resetRuntime())
    render.subscribeToFrameComplete(later)
    render.start()
    expect(later).not.toHaveBeenCalled()
  })

  it('old engine interaction callbacks cannot resolve successor handles', async () => {
    const first = new RecordingRenderEngine({ name: 'interaction-old' }),
      render = new Render({ engine: first })
    const subscribe = first.subscribeToInteraction.bind(first)
    first.subscribeToInteraction = vi.fn(subscribe)
    await render.init(10, 10, 0)
    const old = vi.mocked(first.subscribeToInteraction).mock.calls[0]?.[0]
    if (!old) throw new Error('Missing interaction subscription')
    render.resetRuntime()
    const next = new RecordingRenderEngine({ name: 'interaction-next' }),
      layer = new RenderContainer(),
      shape = new RenderGraphics()
    shape.label = 'next-shape'
    layer.addChild(shape)
    render.setEngine(next)
    render.registerLayer({ name: 'custom', layer })
    await render.init(10, 10, 0)
    const event: RenderEngineInteractionEvent = {
      type: 'pointerover',
      target: shape.getEngineHandle(),
      pointerId: 1,
      button: 0,
      buttons: 0,
      position: { x: 0, y: 0 },
      modifiers: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      },
      timestamp: 1
    }
    const hover = vi
      .spyOn(reactiveEvents, 'renderPointerHover')
      .mockImplementation(() => undefined)
    try {
      old(event)
      expect(hover).not.toHaveBeenCalled()
      next.emitInteraction(event)
      expect(hover).toHaveBeenCalledWith('next-shape')
    } finally {
      hover.mockRestore()
      render.resetRuntime()
    }
  })

  it('attempts every pointer listener removal even when one fails', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const bridge = new RenderInteractionBridge(() => null)
    bridge.attach(target as unknown as HTMLCanvasElement)
    target.removeEventListener.mockImplementationOnce(() => {
      throw new Error('pointer detach failed')
    })
    expect(() => bridge.resetRuntime()).toThrow('pointer detach failed')
    expect(target.removeEventListener).toHaveBeenCalledTimes(5)
    bridge.resetRuntime()
    expect(target.removeEventListener).toHaveBeenCalledTimes(5)
  })

  it('attempts every resource subscription cleanup even when one fails', () => {
    const engine = new RecordingRenderEngine({ name: 'runtime-reset' }),
      initialized = engine.initialize({ host: {}, width: 10, height: 10 })
    const runtime = new RenderObjectRuntime(engine, initialized.root),
      later = vi.fn()
    const style = (cleanup: () => void): RenderResourceStyle => ({
      __renderResourceDescriptor: {
        kind: 'gradient',
        data: { type: 'linear', colorStops: [] }
      },
      __subscribeRenderResourceRelease: () => cleanup
    })
    const first = new RenderGraphics(),
      second = new RenderGraphics()
    first.rect(0, 0, 1, 1).fill(
      style(() => {
        throw new Error('resource detach failed')
      })
    )
    second.rect(0, 0, 1, 1).fill(style(later))
    runtime.attachRoot(first)
    runtime.attachRoot(second)
    runtime.flushDraws()
    expect(() => runtime.resetResourceLifecycles()).toThrow(
      'resource detach failed'
    )
    expect(later).toHaveBeenCalledOnce()
    engine.destroy()
  })
})
