import { beforeEach, describe, expect, it, vi } from 'vitest'
import factory from '@asyra/factory'
import {
  MissingRenderEngineProviderError,
  type IRenderer,
  type RenderOptions
} from '@asyra/render'
import defaultCore, { Core } from '../core'
import {
  registerDataChannelObserver,
  unregisterDataChannelObserver
} from '../data-channel-observer'

const createCoreForTest = (
  factoryOverrides: Record<string, unknown> = {},
  renderOverrides: Record<string, unknown> = {}
) => {
  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn(),
      ...factoryOverrides
    } as never,
    props: {} as never,
    render: {
      init: vi.fn(async () => ({ canvas: null, instance: null })),
      start: vi.fn(),
      dispose: vi.fn(),
      setEngineProvider: vi.fn(() => vi.fn()),
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      registerLayer: vi.fn(),
      unregisterLayer: vi.fn(() => true),
      ...renderOverrides
    } as never,
    sceneTree: {} as never,
    selection: {} as never,
    systemContext: {} as never
  })
  core.setupInputSystem = vi.fn()
  core.initFeatureSystem = vi.fn()
  core.renderIsReady = vi.fn()
  return core
}

const createRenderer = (init: IRenderer['init']): IRenderer => ({
  name: 'test-renderer',
  init,
  destroy: vi.fn(),
  getViewportPosition: () => ({ x: 0, y: 0 }),
  getViewportScale: () => 1,
  setViewportPosition: vi.fn(),
  setViewportScale: vi.fn(),
  resize: vi.fn(),
  getCanvas: () => null,
  getInstance: () => null
})

describe('Core render startup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes the configured engine-neutral renderer once before ready', async () => {
    const initObservers = vi.fn(() => vi.fn())
    const core = createCoreForTest({
      observeSharedDataChannel: initObservers
    })
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const options: RenderOptions = {
      width: 800,
      height: 600,
      backgroundColor: 0x101010
    }
    const init = vi.fn(async () => ({ canvas, instance: {} }))
    core.registerDataChannelObserver({
      name: 'startup-order-observer',
      channel: 'startup-order-channel',
      onChange: vi.fn()
    })
    core.setRenderer(createRenderer(init))

    await core.start(container, options)

    expect(init).toHaveBeenCalledOnce()
    expect(init).toHaveBeenCalledWith(container, options)
    expect(container.firstElementChild).toBe(canvas)
    expect(core.setupInputSystem).toHaveBeenCalledWith(canvas)
    expect(init.mock.invocationCallOrder[0]).toBeLessThan(
      initObservers.mock.invocationCallOrder[0]
    )
    expect(initObservers.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(core.initFeatureSystem).mock.invocationCallOrder[0]
    )
    expect(
      vi.mocked(core.initFeatureSystem).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.renderIsReady).mock.invocationCallOrder[0])
  })

  it('owns a default RenderAdapter without requiring setRenderer', async () => {
    const canvas = document.createElement('canvas')
    const init = vi.fn(async () => ({ canvas, instance: { name: 'engine' } }))
    const start = vi.fn()
    const core = createCoreForTest({}, { init, start })
    const container = document.createElement('div')
    const options: RenderOptions = {
      width: 320,
      height: 240,
      backgroundColor: 0x112233
    }

    await core.start(container, options)

    expect(init).toHaveBeenCalledOnce()
    expect(init).toHaveBeenCalledWith(320, 240, 0x112233, container)
    expect(start).toHaveBeenCalledOnce()
    expect(container.firstElementChild).toBe(canvas)
    expect(core.setupInputSystem).toHaveBeenCalledWith(canvas)
    expect(core.renderIsReady).toHaveBeenCalledOnce()
  })

  it('normalizes only missing provider from the Core-owned adapter to headless startup', async () => {
    const initObservers = vi.fn(() => vi.fn())
    const load = vi.fn(async () => null)
    const runtimeStart = vi.fn()
    const core = createCoreForTest(
      { observeSharedDataChannel: initObservers },
      {
        init: vi.fn(async () =>
          Promise.reject(new MissingRenderEngineProviderError())
        ),
        start: runtimeStart
      }
    )
    core.registerDataChannelObserver({
      name: 'headless-observer',
      channel: 'headless-channel',
      onChange: vi.fn()
    })
    core.setPersistence({ name: 'headless-persistence', load } as never)
    const container = document.createElement('div')

    await core.start(container, { width: 100, height: 100 })

    expect(container.childElementCount).toBe(0)
    expect(core.setupInputSystem).not.toHaveBeenCalled()
    expect(runtimeStart).not.toHaveBeenCalled()
    expect(initObservers).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
    expect(core.initFeatureSystem).toHaveBeenCalledOnce()
    expect(core.renderIsReady).toHaveBeenCalledOnce()
  })

  it('does not reinterpret a configured provider failure as headless', async () => {
    const initObservers = vi.fn(() => vi.fn())
    const failure = new MissingRenderEngineProviderError()
    const core = createCoreForTest(
      { observeSharedDataChannel: initObservers },
      { init: vi.fn(async () => Promise.reject(failure)) }
    )
    core.registerDataChannelObserver({
      name: 'configured-provider-failure-observer',
      channel: 'configured-provider-failure-channel',
      onChange: vi.fn()
    })
    core.setRenderEngineProvider(() => ({}) as never)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)

    expect(initObservers).not.toHaveBeenCalled()
    expect(core.initFeatureSystem).not.toHaveBeenCalled()
    expect(core.renderIsReady).not.toHaveBeenCalled()
  })

  it.each([
    ['provider callback', new Error('provider callback failed')],
    ['engine initialization', new Error('engine initialization failed')],
    ['engine capability', new Error('engine capability failed')]
  ])(
    'does not swallow %s failure from the Core-owned adapter',
    async (_label, failure) => {
      const core = createCoreForTest(
        {},
        { init: vi.fn(async () => Promise.reject(failure)) }
      )

      await expect(
        core.start(document.createElement('div'), { width: 1, height: 1 })
      ).rejects.toBe(failure)
      expect(core.initFeatureSystem).not.toHaveBeenCalled()
      expect(core.renderIsReady).not.toHaveBeenCalled()
    }
  )

  it('keeps an advanced renderer missing-provider failure strict', async () => {
    const core = createCoreForTest()
    const failure = new MissingRenderEngineProviderError()
    core.setRenderer(createRenderer(vi.fn(async () => Promise.reject(failure))))

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)
    expect(core.renderIsReady).not.toHaveBeenCalled()
  })

  it('rejects renderer replacement after start closes composition', async () => {
    const core = createCoreForTest()
    core.setRenderer(
      createRenderer(vi.fn(async () => ({ canvas: null, instance: null })))
    )
    await core.start(document.createElement('div'), { width: 1, height: 1 })

    expect(() => core.setRenderer(createRenderer(vi.fn()))).toThrow(
      'Registration composition is permanently closed'
    )
  })

  it('destroys the Core-owned renderer without reopening composition', async () => {
    const canvas = document.createElement('canvas')
    const dispose = vi.fn()
    const core = createCoreForTest(
      {},
      {
        init: vi.fn(async () => ({ canvas, instance: {} })),
        dispose
      }
    )
    const container = document.createElement('div')
    await core.start(container, { width: 1, height: 1 })

    core.destroyRenderer()

    expect(dispose).toHaveBeenCalledOnce()
    expect(container.childElementCount).toBe(0)
    expect(() => core.setRenderer(createRenderer(vi.fn()))).toThrow(
      'Registration composition is permanently closed'
    )
  })

  it('rejects renderer initialization failure without observers, features, or ready', async () => {
    const initObservers = vi.fn(() => vi.fn())
    const core = createCoreForTest({
      observeSharedDataChannel: initObservers
    })
    core.registerDataChannelObserver({
      name: 'failed-start-observer',
      channel: 'failed-start-channel',
      onChange: vi.fn()
    })
    const failure = new Error('engine initialization failed')
    core.setRenderer(createRenderer(vi.fn(async () => Promise.reject(failure))))

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)
    expect(initObservers).not.toHaveBeenCalled()
    expect(core.initFeatureSystem).not.toHaveBeenCalled()
    expect(core.renderIsReady).not.toHaveBeenCalled()
  })

  it('isolates observer identity and activation through each injected Factory', async () => {
    const observeFirst = vi.fn(() => vi.fn())
    const observeSecond = vi.fn(() => vi.fn())
    const first = createCoreForTest({
      observeSharedDataChannel: observeFirst
    })
    const second = createCoreForTest({
      observeSharedDataChannel: observeSecond
    })
    const registration = {
      name: 'shared-observer-name',
      channel: 'shared-channel-name',
      onChange: vi.fn()
    }

    first.registerDataChannelObserver(registration)
    expect(() => second.registerDataChannelObserver(registration)).not.toThrow()
    first.setRenderer(
      createRenderer(
        vi.fn(async () => ({
          canvas: document.createElement('canvas'),
          instance: {}
        }))
      )
    )
    second.setRenderer(
      createRenderer(
        vi.fn(async () => ({
          canvas: document.createElement('canvas'),
          instance: {}
        }))
      )
    )

    await first.start(document.createElement('div'), { width: 1, height: 1 })
    await second.start(document.createElement('div'), { width: 1, height: 1 })

    expect(observeFirst).toHaveBeenCalledWith(
      'shared-channel-name',
      registration.onChange
    )
    expect(observeSecond).toHaveBeenCalledWith(
      'shared-channel-name',
      registration.onChange
    )
  })

  it('keeps standalone observer helpers compatible with the default Core', async () => {
    const observerName = 'default-core-standalone-observer'
    const cleanup = vi.fn()
    const observe = vi.fn(() => cleanup)
    const originalObserve = factory.observeSharedDataChannel
    factory.observeSharedDataChannel = observe
    defaultCore.setupInputSystem = vi.fn()
    defaultCore.initFeatureSystem = vi.fn()
    defaultCore.renderIsReady = vi.fn()
    defaultCore.setRenderer(
      createRenderer(
        vi.fn(async () => ({
          canvas: document.createElement('canvas'),
          instance: {}
        }))
      )
    )
    let unregistered = false

    try {
      registerDataChannelObserver({
        name: observerName,
        channel: 'default-core-standalone-channel',
        onChange: vi.fn()
      })

      await defaultCore.start(document.createElement('div'), {
        width: 1,
        height: 1
      })

      expect(observe).toHaveBeenCalledWith(
        'default-core-standalone-channel',
        expect.any(Function)
      )
      unregistered = unregisterDataChannelObserver(observerName)
      expect(unregistered).toBe(true)
      expect(cleanup).toHaveBeenCalledOnce()
    } finally {
      if (!unregistered) unregisterDataChannelObserver(observerName)
      factory.observeSharedDataChannel = originalObserve
    }
  })
})
