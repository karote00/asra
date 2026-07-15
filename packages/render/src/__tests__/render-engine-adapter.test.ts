import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RenderEngineCapabilities,
  UnsupportedRenderEngineCapabilityError,
  type RenderEngine
} from '@asyra/render-engine'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { Render } from '../render'
import type { RenderElementData } from '../types'

describe('Render engine adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('injects one engine instance and emits semantic scene operations', async () => {
    const engine = new RecordingRenderEngine({ name: 'custom-recording' })
    const render = new Render({ engine })

    const initialized = await render.init(640, 480, 0x112233, {})
    render.switchWorkspace({ label: 'workspace', x: 0, y: 0 })
    render.addElement({
      id: 'rect-1',
      type: 'rectangle',
      name: 'Rectangle',
      visible: true,
      lock: false,
      x: 12,
      y: 24,
      width: 80,
      height: 40
    } as unknown as RenderElementData)
    render.requestRender()
    render.flushFrame()
    render.dispose()

    expect(render.getEngine()).toBe(engine)
    expect(initialized.canvas).toBeTruthy()
    expect(engine.getOperations().map((operation) => operation.type)).toEqual(
      expect.arrayContaining([
        'initialize',
        'create-object',
        'append-child',
        'draw',
        'flush',
        'destroy'
      ])
    )
    expect(engine.getOwnedObjectCount()).toBe(0)
  })

  it('creates one isolated engine per Render instance from a factory', async () => {
    const engines: RecordingRenderEngine[] = []
    const engineFactory = vi.fn(() => {
      const engine = new RecordingRenderEngine({
        name: `factory-${engines.length + 1}`
      })
      engines.push(engine)
      return engine
    })
    const first = new Render({ engineFactory })
    const second = new Render({ engineFactory })

    await first.init(100, 100, 0, {})
    await second.init(200, 200, 0, {})

    expect(engineFactory).toHaveBeenCalledTimes(2)
    expect(first.getEngine()).toBe(engines[0])
    expect(second.getEngine()).toBe(engines[1])
    expect(first.getEngine()).not.toBe(second.getEngine())

    first.dispose()
    expect(engines[0].getOperations().at(-1)?.type).toBe('destroy')
    expect(engines[1].getOperations().at(-1)?.type).not.toBe('destroy')
    second.dispose()
  })

  it('fails initialization when no provider is configured', async () => {
    const render = new Render()

    await expect(render.init(100, 100, 0, {})).rejects.toThrow(
      'Render engine provider is not configured'
    )
  })

  it('fails missing capabilities without concrete-engine introspection', async () => {
    const engine = new RecordingRenderEngine({
      name: 'objects-only',
      capabilities: [RenderEngineCapabilities.OBJECTS]
    })
    const render = new Render({ engine })

    await expect(render.init(100, 100, 0, {})).rejects.toThrowError(
      UnsupportedRenderEngineCapabilityError
    )
    expect(engine.getOperations().map((operation) => operation.type)).toEqual([
      'destroy'
    ])
  })

  it('destroys the selected engine when initialization fails', async () => {
    const engine = new RecordingRenderEngine({ name: 'initialization-failure' })
    engine.initialize = vi.fn(() => {
      throw new Error('surface unavailable')
    })
    const render = new Render({ engine })

    await expect(render.init(100, 100, 0, {})).rejects.toThrow(
      'surface unavailable'
    )
    expect(engine.getOperations().map((operation) => operation.type)).toEqual([
      'destroy'
    ])
  })

  it('dispatches attached render property changes to the engine', async () => {
    const engine = new RecordingRenderEngine({ name: 'property-updates' })
    const render = new Render({ engine })
    await render.init(100, 100, 0, {})
    render.addElement({
      id: 'rotated-element',
      type: 'rectangle',
      name: 'Rotated element',
      visible: true,
      lock: false,
      width: 10,
      height: 10
    } as unknown as RenderElementData)

    render.updateElement('rotated-element', 'rotation', 0, Math.PI / 2)

    const update = engine
      .getOperations()
      .findLast((operation) => operation.type === 'update-object')
    expect(update).toMatchObject({
      type: 'update-object',
      command: {
        properties: { rotation: Math.PI / 2 }
      }
    })
  })

  it('rejects conflicting instance and factory providers', () => {
    const engine = new RecordingRenderEngine({ name: 'direct' })
    const engineFactory = (): RenderEngine =>
      new RecordingRenderEngine({ name: 'factory' })

    expect(() => new Render({ engine, engineFactory })).toThrow(
      'Configure either a render engine instance or factory, not both'
    )
  })
})
