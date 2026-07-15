import { BehaviorSubject, Subscription } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import type { RenderEngine, RenderEngineFactory } from '@asyra/render-engine'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import { Render, RenderAdapter } from '@asyra/render'
import { applyPreset } from '../preset'
import type { PresetCoreAPIs, PresetDependencies } from '../types'

const createComposition = (renderOverride?: PresetDependencies['render']) => {
  const systemProperties = new Map<string, BehaviorSubject<unknown>>()
  const setEngineFactory = renderOverride
    ? vi.spyOn(renderOverride, 'setEngineFactory')
    : vi.fn()
  const dependencies = {
    sceneTree: {
      getElementById: () => undefined,
      getAllElements: () => new Map(),
      currentWorkspace: undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render:
      renderOverride ??
      ({
        setEngineFactory,
        getViewportPosition: () => ({ x: 0, y: 0 }),
        getViewportScale: () => 1,
        getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
        zoomTo: () => undefined,
        panTo: () => undefined
      } as unknown as PresetDependencies['render'])
  } as unknown as PresetDependencies
  const core = {
    registerEvent: vi.fn((event: string | { eventName: string }) => ({
      eventName: typeof event === 'string' ? event : event.eventName,
      publish: vi.fn(),
      subscribe: () => new Subscription()
    })),
    registerDataChannelObserver: vi.fn(),
    getPresetDependencies: () => dependencies,
    registerRenderLayer: vi.fn(),
    registerPropertySchema: vi.fn(),
    defineSelection: vi.fn(),
    getSelection: () => undefined,
    defineUIProperty: vi.fn(),
    defineSystemProperty: <T>(key: string, defaultValue: T) => {
      const existing = systemProperties.get(key)
      if (existing) {
        return existing as BehaviorSubject<T>
      }
      const state = new BehaviorSubject(defaultValue)
      systemProperties.set(key, state as BehaviorSubject<unknown>)
      return state
    },
    getSystemPropertyObservable: <T>(key: string) =>
      systemProperties.get(key) as BehaviorSubject<T> | undefined,
    createRenderGradientFillStyle: vi.fn()
  } as unknown as PresetCoreAPIs

  return { core, setEngineFactory }
}

describe('Preset render engine selection', () => {
  it('injects the fresh Pixi engine factory for the compatibility path', () => {
    const { core, setEngineFactory } = createComposition()

    applyPreset(core)

    expect(setEngineFactory).toHaveBeenCalledOnce()
    const selectedFactory = setEngineFactory.mock
      .calls[0][0] as RenderEngineFactory
    expect(selectedFactory).toBe(createPixiRenderEngine)
    expect(selectedFactory()).not.toBe(selectedFactory())
  })

  it('injects an explicit custom factory without selecting a Pixi singleton', () => {
    const { core, setEngineFactory } = createComposition()
    const customFactory: RenderEngineFactory = vi.fn(() => ({}) as RenderEngine)

    applyPreset(core, { renderEngineFactory: customFactory })

    expect(setEngineFactory).toHaveBeenCalledOnce()
    expect(setEngineFactory).toHaveBeenCalledWith(customFactory)
  })

  it('composes a custom factory through Render and RenderAdapter lifecycle', async () => {
    const runtime = new Render()
    const { core, setEngineFactory } = createComposition(runtime)
    const engine = new RecordingRenderEngine({ name: 'custom-composed' })
    const customFactory: RenderEngineFactory = vi.fn(() => engine)

    applyPreset(core, { renderEngineFactory: customFactory })

    expect(setEngineFactory).toHaveBeenCalledOnce()
    expect(setEngineFactory).toHaveBeenCalledWith(customFactory)
    expect(customFactory).not.toHaveBeenCalled()

    const adapter = new RenderAdapter(runtime)
    const result = await adapter.init(document.createElement('div'), {
      width: 640,
      height: 480,
      backgroundColor: 0x101010
    })

    expect(customFactory).toHaveBeenCalledOnce()
    expect(runtime.getEngine()).toBe(engine)
    expect(result.instance).toBe(engine)
    expect(engine.getOperations().map(({ type }) => type)).toContain(
      'initialize'
    )
    expect(engine.getOperations().map(({ type }) => type)).toContain('flush')

    adapter.destroy()

    expect(engine.getOperations().at(-1)?.type).toBe('destroy')
    expect(engine.getOwnedObjectCount()).toBe(0)
    expect(engine.getOwnedResourceCount()).toBe(0)
  })
})
