import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRenderer, RenderOptions } from '@asyra/render'
import { Core } from '../core'

const createCoreForTest = (factoryOverrides: Record<string, unknown> = {}) => {
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
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      registerLayer: vi.fn(),
      unregisterLayer: vi.fn(() => true)
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
})
