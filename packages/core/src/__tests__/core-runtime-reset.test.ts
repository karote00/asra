import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventRegistry } from '@asyra/reactive-events'
import { Core } from '../core.js'
import { DataChannelObserverRegistry } from '../data-channel-observer.js'

const lifecycle = vi.hoisted(() => ({
  disposeFeature: vi.fn(),
  beginFeature: vi.fn(),
  resetSharedRender: vi.fn(),
  beginSharedRender: vi.fn()
}))
vi.mock('@asyra/feature-system', async (original) => ({
  ...(await original<object>()),
  disposeFeatureSystem: lifecycle.disposeFeature,
  beginFeatureSystemRuntime: lifecycle.beginFeature
}))
vi.mock('@asyra/render', async (original) => ({
  ...(await original<object>()),
  resetSharedRenderRuntime: lifecycle.resetSharedRender,
  beginSharedRenderRuntime: lifecycle.beginSharedRender
}))

const deferred = () => {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const createFixture = () => {
  const calls: string[] = []
  const reset = (name: string) =>
    vi.fn(() => {
      calls.push(name)
    })
  const factory = {
    resetRuntime: reset('factory'),
    registerTransactionReplayHandler: vi.fn(() => () => undefined),
    subscribeToCommitCapture: vi.fn(() => () => undefined),
    subscribeToTransactionStatus: vi.fn(() => () => undefined),
    reportPersistenceStatus: vi.fn(),
    observeSharedDataChannel: vi.fn(() => reset('observer-binding')),
    observeSharedDataChannelBatch: vi.fn(),
    getUndoHistoryDepth: vi.fn(() => 0)
  }
  const observers = new DataChannelObserverRegistry(factory as never)
  const input = {
    resetRuntime: reset('input'),
    registry: {
      registerKeyCombinations: vi.fn(),
      unregister: vi.fn()
    }
  }
  const render = {
    resetRuntime: reset('render'),
    start: vi.fn(),
    init: vi.fn(async () => ({ canvas: null, instance: null })),
    getViewportPosition: () => ({ x: 0, y: 0 }),
    getViewportScale: () => 1,
    getCanvas: () => null,
    registerLayer: vi.fn(),
    unregisterLayer: vi.fn(),
    dispose: reset('ordinary-render-dispose')
  }
  const core = new Core({
    inputSystem: input as never,
    factory: factory as never,
    render: render as never,
    dataChannelObservers: observers,
    props: { resetRuntime: reset('props') } as never,
    sceneTree: { resetRuntime: reset('scene') } as never,
    selection: { resetRuntime: reset('selection') } as never,
    systemContext: {
      resetRuntime: reset('system-context'),
      getSystemContextSnapshot: () => ({})
    } as never
  })
  core.setupInputSystem = vi.fn()
  core.initFeatureSystem = vi.fn()
  core.renderIsReady = vi.fn()
  lifecycle.disposeFeature.mockImplementation(async () => {
    calls.push('feature')
  })
  lifecycle.beginFeature.mockImplementation(() => {
    calls.push('begin-feature')
  })
  lifecycle.resetSharedRender.mockImplementation(reset('shared-render'))
  lifecycle.beginSharedRender.mockImplementation(reset('begin-shared-render'))
  return { core, calls, factory, input, render, observers }
}

describe('Core complete runtime handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns one fresh unstarted Core after ordered cleanup without unlocking the old one', async () => {
    const { core, calls } = createFixture()
    await core.start(document.createElement('div'), { width: 100, height: 100 })
    core.registerRuntimeCleanup('retained-composition', () => {
      calls.push('composition')
    })
    const first = core.resetRuntime(),
      second = core.resetRuntime()
    expect(first).toBe(second)
    const next = await first
    expect(next).not.toBe(core)
    expect(next.isCompositionOpen()).toBe(true)
    expect(core.getRuntimeState()).toBe('retired')
    expect(() => core.isCompositionOpen()).toThrow('retired')
    expect(calls).toEqual([
      'feature',
      'input',
      'render',
      'shared-render',
      'factory',
      'scene',
      'props',
      'selection',
      'system-context',
      'composition',
      'begin-feature',
      'begin-shared-render'
    ])
    expect(await core.resetRuntime()).toBe(next)
  })

  it('waits for actual quiescence and collaboration disposal before clearing owners', async () => {
    const { core, input } = createFixture(),
      feature = deferred(),
      collaboration = deferred()
    lifecycle.disposeFeature.mockReturnValue(feature.promise)
    core.registerCollaborationSession({
      prepare: async () => undefined,
      activate: async () => undefined,
      dispose: () => collaboration.promise
    })
    const reset = core.resetRuntime()
    expect(core.getRuntimeState()).toBe('quiescing')
    expect(input.resetRuntime).not.toHaveBeenCalled()
    feature.resolve()
    await Promise.resolve()
    expect(input.resetRuntime).not.toHaveBeenCalled()
    collaboration.resolve()
    await reset
    expect(input.resetRuntime).toHaveBeenCalledOnce()
  })

  it('rejects reset during startup before closing admission and allows it after startup settles', async () => {
    const { core, render, input } = createFixture(),
      initialization = deferred()
    render.init = vi.fn(async () => {
      await initialization.promise
      return { canvas: null, instance: null }
    })
    const start = core.start(document.createElement('div'), {
      width: 100,
      height: 100
    })
    await expect(core.resetRuntime()).rejects.toThrow('startup')
    expect(lifecycle.disposeFeature).not.toHaveBeenCalled()
    expect(input.resetRuntime).not.toHaveBeenCalled()
    initialization.resolve()
    await start
    await core.resetRuntime()
  })

  it('preserves a failed owner phase and never begins a successor', async () => {
    const { core, input, factory } = createFixture(),
      cause = new Error('input cleanup failed')
    input.resetRuntime = vi.fn(() => {
      throw cause
    })
    const reset = core.resetRuntime()
    await expect(reset).rejects.toMatchObject({ phase: 'input', cause })
    expect(core.getRuntimeState()).toBe('failed')
    expect(core.resetRuntime()).toBe(reset)
    expect(factory.resetRuntime).not.toHaveBeenCalled()
    expect(lifecycle.beginFeature).not.toHaveBeenCalled()
    expect(() => core.getUndoHistoryDepth()).toThrow('failed')
  })

  it('retires observer definitions and invalidates retained facade and input cleanup handles', async () => {
    const { core, observers, input } = createFixture(),
      handler = vi.fn()
    core.registerDataChannelObserver({
      name: 'observer',
      channel: 'channel',
      onChange: handler
    })
    observers.init()
    const readOldHistory = core.getUndoHistoryDepth
    const oldCleanup = core.registerInputKeyCombinations({ test: [] })
    const next = await core.resetRuntime()
    expect(observers.unregister('observer')).toBe(false)
    next.registerInputKeyCombinations({ test: [] })
    oldCleanup()
    expect(input.registry.unregister).not.toHaveBeenCalled()
    expect(() => readOldHistory()).toThrow('retired')
  })

  it('retires only Core-owned events and subscriptions, fencing an old publisher', async () => {
    const { core } = createFixture(),
      handler = vi.fn()
    const external = eventRegistry.register('reset.external')
    const oldEvent = core.registerEvent('reset.owned')
    const subscription = oldEvent.subscribe(handler)
    const next = await core.resetRuntime()
    expect(subscription.closed).toBe(true)
    expect(eventRegistry.get('reset.external')).toBe(external)
    const replacement = next.registerEvent('reset.owned')
    expect(() => oldEvent.publish()).toThrow('retired')
    replacement.publish()
    expect(handler).not.toHaveBeenCalled()
    await next.resetRuntime()
    eventRegistry.unregister('reset.external')
  })

  it('attempts all composition cleanup and rejects canonical access during termination', async () => {
    const { core } = createFixture(),
      cause = new Error('composition cleanup failed'),
      calls: string[] = []
    core.registerRuntimeCleanup('first', () => {
      calls.push('first')
      expect(core.getRegistrations()).toEqual([])
      expect(() => core.getUndoHistoryDepth()).toThrow('retiring')
    })
    core.registerRuntimeCleanup('second', async () => {
      calls.push('second')
      throw cause
    })
    await expect(core.resetRuntime()).rejects.toMatchObject({
      phase: 'composition',
      cause
    })
    expect(calls).toEqual(['second', 'first'])
    expect(lifecycle.beginFeature).not.toHaveBeenCalled()
  })

  it('waits for a retained Feature API operation and fences old APIs and disposers', async () => {
    const { core, input } = createFixture(),
      work = deferred(),
      call = vi.fn()
    const definition = { api: Object.freeze({ run: () => work.promise, call }) }
    const old = core.defineFeature('reset-feature', undefined, definition)
    expect(core.getFeature('reset-feature')).toBe(old.api)
    const operation = old.api.run()
    const reset = core.resetRuntime()
    await Promise.resolve()
    await Promise.resolve()
    expect(input.resetRuntime).not.toHaveBeenCalled()
    work.resolve()
    await operation
    const next = await reset
    expect(() => old.api.call()).toThrow('retired')
    const replacement = next.defineFeature(
      'reset-feature',
      undefined,
      definition
    )
    expect(old.dispose()).toBe(false)
    replacement.api.call()
    expect(call).toHaveBeenCalledOnce()
    await next.resetRuntime()
  })

  it('awaits an in-progress save before clearing canonical owners', async () => {
    const { core, input } = createFixture(),
      save = deferred()
    core.save = async () => {
      await save.promise
      return {
        version: '1.0.0',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      }
    }
    // This test isolates the asynchronous serialization boundary from document shape.
    const operation = core.save()
    const reset = core.resetRuntime()
    await Promise.resolve()
    await Promise.resolve()
    expect(input.resetRuntime).not.toHaveBeenCalled()
    save.resolve()
    await operation
    await reset
    expect(input.resetRuntime).toHaveBeenCalledOnce()
  })

  it('preserves live Feature API properties while fencing method execution', async () => {
    const { core } = createFixture()
    const api = {
      count: 0,
      increment() {
        this.count++
      }
    }
    const registration = core.defineFeature('live-api', undefined, { api })
    registration.api.increment()
    expect(registration.api.count).toBe(1)
    registration.api.count = 4
    expect(api.count).toBe(4)
    await core.resetRuntime()
    expect(() => registration.api.increment()).toThrow('retired')
  })

  it('keeps failed ordinary subscription cleanup retryable before retirement', async () => {
    const { core, factory } = createFixture()
    const cleanup = vi.fn().mockImplementationOnce(() => {
      throw new Error('retry cleanup')
    })
    factory.subscribeToTransactionStatus.mockReturnValue(cleanup)
    const dispose = core.subscribeToTransactionStatus(vi.fn())
    expect(dispose).toThrow('retry cleanup')
    dispose()
    expect(cleanup).toHaveBeenCalledTimes(2)
    await core.resetRuntime()
  })

  it('does not remove a newer same-key cleanup registration with an old handle', async () => {
    const { core } = createFixture(),
      cleanup = vi.fn()
    const first = core.registerRuntimeCleanup('same-key', cleanup)
    first()
    core.registerRuntimeCleanup('same-key', cleanup)
    first()
    await core.resetRuntime()
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
