import { describe, expect, it, vi } from 'vitest'
import type { SimRuntime } from '../bootstrap'
import { RuntimeController } from '../runtime-controller'

const snapshot = () => ({
  document: {
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [] as string[], elements: {} },
    props: {}
  },
  loadIssues: [] as { path: string; message: string }[]
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
function runtime() {
  const resume = vi.fn()
  const value: SimRuntime = {
    features: {
      edit: {
        captureDocument: vi.fn(),
        applyDocument: vi.fn(),
        createCandidate: vi.fn(),
        replace: vi.fn(),
        upsert: vi.fn(),
        remove: vi.fn()
      },
      history: { undo: vi.fn(), redo: vi.fn() }
    },
    pauseEditing: vi.fn(() => resume),
    captureSnapshot: vi.fn(async () => snapshot()),
    preflight: vi.fn(() => []),
    getCandidates: vi.fn(() => []),
    getWorkcell: vi.fn(),
    getLoadIssues: vi.fn(() => []),
    getHistoryDepth: vi.fn(() => 0),
    setFrame: vi.fn(),
    pick: vi.fn(() => null),
    save: vi.fn(),
    load: vi.fn(() => []),
    subscribe: vi.fn(() => vi.fn()),
    dispose: vi.fn(async () => undefined)
  }
  return { value, resume }
}
async function setup() {
  const a = runtime(),
    b = runtime()
  const factory = vi.fn(async () => a.value)
  const controller = new RuntimeController(factory)
  await controller.start()
  factory.mockResolvedValue(b.value)
  return { a, b, factory, controller }
}

describe('App document replacement controller', () => {
  it('preflights, freezes, captures and retires A before publishing B', async () => {
    const { a, b, factory, controller } = await setup(),
      order: string[] = []
    const wait = deferred<undefined>(),
      entered = deferred<undefined>()
    a.value.preflight = vi.fn(() => {
      order.push('preflight')
      return []
    })
    a.value.pauseEditing = vi.fn(() => {
      order.push('pause')
      return a.resume
    })
    a.value.captureSnapshot = vi.fn(async () => {
      order.push('capture')
      return snapshot()
    })
    a.value.dispose = vi.fn(async () => {
      order.push('dispose')
      entered.resolve(undefined)
      await wait.promise
    })
    factory.mockImplementation(async () => {
      order.push('bootstrap')
      return b.value
    })
    const target = snapshot(),
      assertCurrent = vi.fn(() => {
        order.push('guard')
      })
    const replacing = controller.replace(target, assertCurrent)
    await entered.promise
    expect(controller.getState().runtime).toBeNull()
    expect(controller.getState().status).toBe('replacing')
    expect(factory).toHaveBeenCalledTimes(1)
    target.document.sceneTree.workspace = 'caller-mutation'
    wait.resolve(undefined)
    await replacing
    expect(order).toEqual([
      'guard',
      'preflight',
      'pause',
      'capture',
      'guard',
      'dispose',
      'guard',
      'bootstrap',
      'guard'
    ])
    expect(factory).toHaveBeenLastCalledWith(snapshot())
    expect(controller.getState()).toMatchObject({
      runtime: b.value,
      status: 'ready',
      generation: 2,
      recoveryAvailable: false
    })
    expect(a.resume).not.toHaveBeenCalled()
    await controller.dispose()
  })

  it('preserves A on preflight failure without pausing or capturing', async () => {
    const { a, controller } = await setup()
    a.value.preflight = vi.fn(() => {
      throw new Error('invalid target')
    })
    await expect(
      controller.replace(snapshot(), () => undefined)
    ).rejects.toThrow('invalid target')
    expect(a.value.pauseEditing).not.toHaveBeenCalled()
    expect(a.value.dispose).not.toHaveBeenCalled()
    expect(controller.getState().runtime).toBe(a.value)
    await controller.dispose()
  })

  it.each(['capture', 'stale'])(
    'resumes A after a %s rejection before retirement',
    async (failure) => {
      const { a, controller } = await setup()
      if (failure === 'capture')
        a.value.captureSnapshot = vi.fn(async () => {
          throw new Error('capture failed')
        })
      let calls = 0
      const guard = () => {
        if (failure === 'stale' && ++calls > 1)
          throw new Error('stale acceptance')
      }
      await expect(controller.replace(snapshot(), guard)).rejects.toThrow(
        failure
      )
      expect(a.resume).toHaveBeenCalledOnce()
      expect(a.value.dispose).not.toHaveBeenCalled()
      expect(controller.getState()).toMatchObject({
        runtime: a.value,
        status: 'ready',
        recoveryAvailable: false
      })
      await controller.dispose()
    }
  )

  it.each(['cleanup', 'startup'])(
    'keeps detached recovery without an editable runtime after %s failure',
    async (failure) => {
      const { a, factory, controller } = await setup(),
        source = snapshot()
      source.loadIssues.push({ path: 'A', message: 'Retained diagnostic' })
      a.value.captureSnapshot = vi.fn(async () => source)
      const cause = new Error(`${failure} failed`)
      if (failure === 'cleanup')
        a.value.dispose = vi.fn(async () => {
          throw cause
        })
      else factory.mockRejectedValue(cause)
      await expect(
        controller.replace(snapshot(), () => undefined)
      ).rejects.toBe(cause)
      expect(controller.getState()).toMatchObject({
        status: 'failed',
        runtime: null,
        recoveryAvailable: true
      })
      const recovery = controller.getRecovery()
      expect(recovery).toEqual(source)
      source.loadIssues.length = 0
      if (!recovery) throw new Error('Missing recovery snapshot')
      recovery.loadIssues[0].message = 'changed by caller'
      expect(controller.getRecovery()?.loadIssues[0].message).toBe(
        'Retained diagnostic'
      )
      if (failure === 'cleanup') expect(factory).toHaveBeenCalledTimes(1)
      await controller.dispose().catch(() => undefined)
    }
  )

  it('rejects concurrent replacement and drains close before any successor starts', async () => {
    const { a, factory, controller } = await setup(),
      wait = deferred<undefined>(),
      entered = deferred<undefined>()
    a.value.dispose = vi.fn(async () => {
      entered.resolve(undefined)
      await wait.promise
    })
    const replacing = controller.replace(snapshot(), () => undefined)
    const rejected = expect(replacing).rejects.toThrow('closed')
    await entered.promise
    await expect(
      controller.replace(snapshot(), () => undefined)
    ).rejects.toThrow('running')
    const closing = controller.dispose()
    expect(controller.dispose()).toBe(closing)
    expect(controller.getState().status).toBe('closed')
    wait.resolve(undefined)
    await closing
    await rejected
    expect(factory).toHaveBeenCalledTimes(1)
    expect(a.value.dispose).toHaveBeenCalledOnce()
  })

  it('closes a runtime acquired by a late initial startup without publishing it', async () => {
    const a = runtime(),
      wait = deferred<SimRuntime>(),
      entered = deferred<undefined>()
    const controller = new RuntimeController(async () => {
      entered.resolve(undefined)
      return wait.promise
    })
    const start = controller.start(),
      rejected = expect(start).rejects.toThrow('closed')
    await entered.promise
    const closing = controller.dispose()
    wait.resolve(a.value)
    await rejected
    await closing
    expect(a.value.dispose).toHaveBeenCalledOnce()
    expect(controller.getState()).toMatchObject({
      status: 'closed',
      runtime: null,
      generation: 0
    })
  })

  it('does not leak a successor acquired after close during bootstrap', async () => {
    const { b, factory, controller } = await setup(),
      wait = deferred<SimRuntime>(),
      entered = deferred<undefined>()
    factory.mockImplementation(async () => {
      entered.resolve(undefined)
      return wait.promise
    })
    const replacing = controller.replace(snapshot(), () => undefined),
      rejected = expect(replacing).rejects.toThrow('closed')
    await entered.promise
    const closing = controller.dispose()
    wait.resolve(b.value)
    await rejected
    await closing
    expect(b.value.dispose).toHaveBeenCalledOnce()
    expect(controller.getState()).toMatchObject({
      status: 'closed',
      runtime: null
    })
  })

  it('closes A without resuming editing when close arrives during recovery capture', async () => {
    const { a, factory, controller } = await setup(),
      wait = deferred<ReturnType<typeof snapshot>>(),
      entered = deferred<undefined>()
    a.value.captureSnapshot = vi.fn(async () => {
      entered.resolve(undefined)
      return wait.promise
    })
    const replacing = controller.replace(snapshot(), () => undefined),
      rejected = expect(replacing).rejects.toThrow('closed')
    await entered.promise
    const closing = controller.dispose()
    expect(a.value.dispose).not.toHaveBeenCalled()
    wait.resolve(snapshot())
    await rejected
    await closing
    expect(a.resume).not.toHaveBeenCalled()
    expect(a.value.dispose).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('disposes unpublished B if storage acceptance expires during its startup', async () => {
    const { b, controller } = await setup()
    let checks = 0
    await expect(
      controller.replace(snapshot(), () => {
        if (++checks === 4) throw new Error('Storage session closed')
      })
    ).rejects.toThrow('Storage session closed')
    expect(b.value.dispose).toHaveBeenCalledOnce()
    expect(controller.getState()).toMatchObject({
      status: 'failed',
      runtime: null,
      recoveryAvailable: true
    })
    await controller.dispose()
    expect(b.value.dispose).toHaveBeenCalledOnce()
  })

  it('retains terminal close failure and never reopens admission', async () => {
    const { a, controller } = await setup(),
      cause = new Error('teardown failed')
    a.value.dispose = vi.fn(async () => {
      throw cause
    })
    const closing = controller.dispose()
    await expect(closing).rejects.toBe(cause)
    expect(controller.dispose()).toBe(closing)
    await expect(controller.start()).rejects.toThrow('closed')
    await expect(controller.capture()).rejects.toThrow('closed')
    expect(a.value.dispose).toHaveBeenCalledOnce()
  })
})
