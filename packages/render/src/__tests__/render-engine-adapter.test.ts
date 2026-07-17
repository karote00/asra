import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RenderEngineCapabilities,
  UnsupportedRenderEngineCapabilityError,
  type RenderEngine
} from '@asyra/render-engine'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import {
  InvalidRenderEngineProviderResultError,
  MissingRenderEngineProviderError,
  RenderAdapter,
  RenderErrorCodes
} from '../index'
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
    expect(initialized.instance).toBe(engine)
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

  it('creates one isolated engine per Render instance from a provider', async () => {
    const engines: RecordingRenderEngine[] = []
    const engineProvider = vi.fn(() => {
      const engine = new RecordingRenderEngine({
        name: `provider-${engines.length + 1}`
      })
      engines.push(engine)
      return engine
    })
    const first = new Render({ engineProvider })
    const second = new Render({ engineProvider })

    await first.init(100, 100, 0, {})
    await second.init(200, 200, 0, {})

    expect(engineProvider).toHaveBeenCalledTimes(2)
    expect(first.getEngine()).toBe(engines[0])
    expect(second.getEngine()).toBe(engines[1])
    expect(first.getEngine()).not.toBe(second.getEngine())

    first.dispose()
    expect(engines[0].getOperations().at(-1)?.type).toBe('destroy')
    expect(engines[1].getOperations().at(-1)?.type).not.toBe('destroy')
    second.dispose()
  })

  it('returns a cleanup that restores the exact prior provider without constructing either engine early', async () => {
    const originalEngine = new RecordingRenderEngine({ name: 'original' })
    const replacementEngine = new RecordingRenderEngine({ name: 'replacement' })
    const originalProvider = vi.fn(() => originalEngine)
    const replacementProvider = vi.fn(() => replacementEngine)
    const render = new Render({ engineProvider: originalProvider })

    const cleanup = render.setEngineProvider(replacementProvider)
    expect(originalProvider).not.toHaveBeenCalled()
    expect(replacementProvider).not.toHaveBeenCalled()

    cleanup()
    await render.init(100, 100, 0, {})

    expect(originalProvider).toHaveBeenCalledOnce()
    expect(replacementProvider).not.toHaveBeenCalled()
    expect(render.getEngine()).toBe(originalEngine)
    render.dispose()
  })

  it('clears the selected provider when cleanup restores an empty prior state', async () => {
    const selectedProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'selected' })
    )
    const render = new Render()

    const cleanup = render.setEngineProvider(selectedProvider)
    cleanup()

    await expect(render.init(100, 100, 0, {})).rejects.toThrow(
      'Render engine provider is not configured'
    )
    expect(selectedProvider).not.toHaveBeenCalled()
  })

  it('prevents a stale provider cleanup from erasing a later selection', async () => {
    const originalProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'original' })
    )
    const firstProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'first' })
    )
    const secondEngine = new RecordingRenderEngine({ name: 'second' })
    const secondProvider = vi.fn(() => secondEngine)
    const render = new Render({ engineProvider: originalProvider })

    const cleanupFirst = render.setEngineProvider(firstProvider)
    render.setEngineProvider(secondProvider)
    cleanupFirst()
    await render.init(100, 100, 0, {})

    expect(originalProvider).not.toHaveBeenCalled()
    expect(firstProvider).not.toHaveBeenCalled()
    expect(secondProvider).toHaveBeenCalledOnce()
    expect(render.getEngine()).toBe(secondEngine)
    render.dispose()
  })

  it('restores nested provider selections in reverse cleanup order', async () => {
    const originalEngine = new RecordingRenderEngine({ name: 'original' })
    const originalProvider = vi.fn(() => originalEngine)
    const firstProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'first' })
    )
    const secondProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'second' })
    )
    const render = new Render({ engineProvider: originalProvider })

    const cleanupFirst = render.setEngineProvider(firstProvider)
    const cleanupSecond = render.setEngineProvider(secondProvider)
    cleanupSecond()
    cleanupFirst()
    await render.init(100, 100, 0, {})

    expect(originalProvider).toHaveBeenCalledOnce()
    expect(firstProvider).not.toHaveBeenCalled()
    expect(secondProvider).not.toHaveBeenCalled()
    expect(render.getEngine()).toBe(originalEngine)
    render.dispose()
  })

  it('keeps provider cleanup state isolated between Render instances', async () => {
    const firstOriginalEngine = new RecordingRenderEngine({
      name: 'first-original'
    })
    const secondReplacementEngine = new RecordingRenderEngine({
      name: 'second-replacement'
    })
    const firstOriginalProvider = vi.fn(() => firstOriginalEngine)
    const secondOriginalProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'second-original' })
    )
    const firstReplacementProvider = vi.fn(
      () => new RecordingRenderEngine({ name: 'first-replacement' })
    )
    const secondReplacementProvider = vi.fn(() => secondReplacementEngine)
    const first = new Render({ engineProvider: firstOriginalProvider })
    const second = new Render({ engineProvider: secondOriginalProvider })

    const cleanupFirst = first.setEngineProvider(firstReplacementProvider)
    second.setEngineProvider(secondReplacementProvider)
    cleanupFirst()
    await first.init(100, 100, 0, {})
    await second.init(100, 100, 0, {})

    expect(first.getEngine()).toBe(firstOriginalEngine)
    expect(second.getEngine()).toBe(secondReplacementEngine)
    expect(firstReplacementProvider).not.toHaveBeenCalled()
    expect(secondOriginalProvider).not.toHaveBeenCalled()
    first.dispose()
    second.dispose()
  })

  it('replays existing graphics when a disposed Render initializes a fresh engine', async () => {
    const engines: RecordingRenderEngine[] = []
    const render = new Render({
      engineProvider: () => {
        const engine = new RecordingRenderEngine({
          name: `reinit-${engines.length + 1}`
        })
        engines.push(engine)
        return engine
      }
    })

    await render.init(100, 100, 0, {})
    render.switchWorkspace({ label: 'workspace', x: 0, y: 0 })
    render.addElement({
      id: 'rect-reinit',
      type: 'rectangle',
      name: 'Reinitialized rectangle',
      visible: true,
      lock: false,
      x: 5,
      y: 10,
      width: 20,
      height: 30
    } as unknown as RenderElementData)
    render.flushFrame()
    expect(
      engines[0].getOperations().some((operation) => operation.type === 'draw')
    ).toBe(true)

    render.dispose()
    await render.init(100, 100, 0, {})
    render.flushFrame()

    expect(engines).toHaveLength(2)
    expect(
      engines[1].getOperations().some((operation) => operation.type === 'draw')
    ).toBe(true)
    render.dispose()
  })

  it('fails initialization when no provider is configured', async () => {
    const render = new Render()

    await expect(render.init(100, 100, 0, {})).rejects.toMatchObject({
      name: 'MissingRenderEngineProviderError',
      code: RenderErrorCodes.MISSING_ENGINE_PROVIDER,
      message: 'Render engine provider is not configured'
    })
    await expect(render.init(100, 100, 0, {})).rejects.toThrowError(
      MissingRenderEngineProviderError
    )
  })

  it('keeps direct RenderAdapter initialization strict without a provider', async () => {
    const adapter = new RenderAdapter(new Render())

    await expect(
      adapter.init(document.createElement('div'), {
        width: 100,
        height: 100,
        backgroundColor: 0
      })
    ).rejects.toThrowError(MissingRenderEngineProviderError)
  })

  it('does not classify an invalid provider result as a missing provider', async () => {
    const provider = vi.fn(() => undefined as unknown as RenderEngine)
    const render = new Render({ engineProvider: provider })

    await expect(render.init(100, 100, 0, {})).rejects.toMatchObject({
      name: 'InvalidRenderEngineProviderResultError',
      code: RenderErrorCodes.INVALID_ENGINE_PROVIDER_RESULT
    })
    await expect(render.init(100, 100, 0, {})).rejects.toThrowError(
      InvalidRenderEngineProviderResultError
    )
    expect(provider).toHaveBeenCalledTimes(2)
  })

  it('preserves a provider callback failure as the original cause', async () => {
    const cause = new Error('custom provider failed')
    const render = new Render({
      engineProvider: () => {
        throw cause
      }
    })

    let received: unknown
    try {
      await render.init(100, 100, 0, {})
    } catch (error) {
      received = error
    }

    expect(received).toBe(cause)
    expect(received).not.toBeInstanceOf(MissingRenderEngineProviderError)
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

  it('rejects conflicting instance and callback providers', () => {
    const engine = new RecordingRenderEngine({ name: 'direct' })
    const engineProvider = (): RenderEngine =>
      new RecordingRenderEngine({ name: 'provider' })

    expect(() => new Render({ engine, engineProvider })).toThrow(
      'Configure either a render engine instance or provider, not both'
    )
  })
})
