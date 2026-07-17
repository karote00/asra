import type { RenderEngineProvider } from '@asyra/render-engine'
import type { IRenderer } from '@asyra/render'
import { describe, expect, it, vi } from 'vitest'
import { Core } from '../core'

const createCoreForTest = () => {
  const renderCleanup = vi.fn()
  const setEngineProvider = vi.fn(() => renderCleanup)
  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn()
    } as never,
    props: {} as never,
    render: {
      setEngineProvider,
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
  return { core, renderCleanup, setEngineProvider }
}

const createRenderer = (): IRenderer => ({
  name: 'provider-test-renderer',
  init: vi.fn(async () => ({ canvas: null, instance: null })),
  destroy: vi.fn(),
  getViewportPosition: () => ({ x: 0, y: 0 }),
  getViewportScale: () => 1,
  setViewportPosition: vi.fn(),
  setViewportScale: vi.fn(),
  resize: vi.fn(),
  getCanvas: () => null,
  getInstance: () => null
})

describe('Core render-engine provider facade', () => {
  it('reports open composition before startup', () => {
    const { core } = createCoreForTest()

    expect(core.isCompositionOpen()).toBe(true)
  })

  it('stores one provider without invoking it and reports presence', () => {
    const { core, setEngineProvider } = createCoreForTest()
    const provider: RenderEngineProvider = vi.fn(() => ({}) as never)

    core.setRenderEngineProvider(provider)

    expect(provider).not.toHaveBeenCalled()
    expect(setEngineProvider).toHaveBeenCalledOnce()
    expect(setEngineProvider).toHaveBeenCalledWith(provider)
    expect(core.hasRenderEngineProvider()).toBe(true)
  })

  it('rejects a duplicate provider before replacing the accepted provider', () => {
    const { core, setEngineProvider } = createCoreForTest()
    const first: RenderEngineProvider = () => ({}) as never
    const second: RenderEngineProvider = () => ({}) as never
    core.setRenderEngineProvider(first)

    expect(() => core.setRenderEngineProvider(second)).toThrow(
      'Core render engine provider is already configured'
    )
    expect(setEngineProvider).toHaveBeenCalledTimes(1)
    expect(core.hasRenderEngineProvider()).toBe(true)
  })

  it('returns idempotent cleanup that restores provider absence', () => {
    const { core, renderCleanup } = createCoreForTest()
    const cleanup = core.setRenderEngineProvider(() => ({}) as never)

    cleanup()
    cleanup()

    expect(renderCleanup).toHaveBeenCalledOnce()
    expect(core.hasRenderEngineProvider()).toBe(false)
  })

  it('does not let a stale cleanup erase a later provider', () => {
    const { core } = createCoreForTest()
    const cleanupFirst = core.setRenderEngineProvider(() => ({}) as never)
    cleanupFirst()
    core.setRenderEngineProvider(() => ({}) as never)

    cleanupFirst()

    expect(core.hasRenderEngineProvider()).toBe(true)
  })

  it('does not retain presence when Render rejects the provider', () => {
    const { core, setEngineProvider } = createCoreForTest()
    const failure = new Error('render rejected provider')
    setEngineProvider.mockImplementationOnce(() => {
      throw failure
    })

    expect(() => core.setRenderEngineProvider(() => ({}) as never)).toThrow(
      failure
    )
    expect(core.hasRenderEngineProvider()).toBe(false)
  })

  it('rejects provider mutation after the first start closes composition', async () => {
    const { core, setEngineProvider } = createCoreForTest()
    core.setRenderer(createRenderer())
    await core.start(document.createElement('div'), { width: 1, height: 1 })

    expect(() => core.setRenderEngineProvider(() => ({}) as never)).toThrow(
      'Registration composition is permanently closed'
    )
    expect(setEngineProvider).not.toHaveBeenCalled()
    expect(core.isCompositionOpen()).toBe(false)
  })

  it('reports permanently closed composition after failed startup entry', async () => {
    const { core } = createCoreForTest()
    const failure = new Error('startup failed')
    core.setRenderer({
      ...createRenderer(),
      init: vi.fn(async () => Promise.reject(failure))
    })

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)
    expect(core.isCompositionOpen()).toBe(false)
  })
})
