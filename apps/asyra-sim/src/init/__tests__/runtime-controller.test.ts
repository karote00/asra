import { describe, expect, it, vi } from 'vitest'
import type { SimRuntime } from '../bootstrap'
import { RuntimeController } from '../runtime-controller'
import { VisualAssetArchive } from '../../storage/visual-archive'
import { prepareProjectVisuals } from '../../storage/project-visuals'
import { decodeRestrictedGlb } from '../../engine/glb/decode'

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
      live: {
        getState: vi.fn(() => ({
          status: 'idle' as const,
          sample: null,
          error: null
        })),
        getRecords: vi.fn(() => []),
        prepare: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        cancel: vi.fn(() => false),
        open: vi.fn(),
        sample: vi.fn()
      },
      edit: {
        addObservation: vi.fn(),
        updateObservation: vi.fn(),
        removeObservation: vi.fn(),
        attachRun: vi.fn(),
        captureDocument: vi.fn(),
        applyDocument: vi.fn(),
        createCandidate: vi.fn(),
        duplicateCandidate: vi.fn(),
        replace: vi.fn(),
        upsert: vi.fn(),
        setVisuals: vi.fn(),
        upsertVisual: vi.fn(),
        remove: vi.fn(),
        createExperiment: vi.fn(),
        updateExperiment: vi.fn(),
        removeExperiment: vi.fn()
      },
      history: { undo: vi.fn(), redo: vi.fn() },
      storage: { retain: vi.fn() },
      observations: {
        prepare: vi.fn(),
        retain: vi.fn(),
        cancel: vi.fn(),
        discard: vi.fn()
      },
      visuals: {
        prepare: vi.fn(),
        retain: vi.fn(),
        cancel: vi.fn(),
        discard: vi.fn()
      },
      analysis: {
        run: vi.fn(),
        cancel: vi.fn(),
        isRunning: vi.fn(() => false),
        getProgress: vi.fn(() => null)
      }
    },
    pauseEditing: vi.fn(() => resume),
    captureSnapshot: vi.fn(async () => snapshot()),
    preflight: vi.fn(() => []),
    getCandidates: vi.fn(() => []),
    getRuns: vi.fn(() => []),
    getObservations: vi.fn(() => []),
    getObservationAttachment: vi.fn(),
    exportObservations: vi.fn(),
    getWorkcell: vi.fn(),
    getVisualAssets: vi.fn(),
    getCandidateLineage: vi.fn(),
    getExperiments: vi.fn(() => []),
    getExperiment: vi.fn(),
    getMethodDescriptors: vi.fn(() => []),
    preflightExperiment: vi.fn(),
    createExperimentSnapshot: vi.fn(),
    getLoadIssues: vi.fn(() => []),
    getHistoryDepth: vi.fn(() => 0),
    setFrame: vi.fn(),
    setCamera: vi.fn(),
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
  it('rejects corrupt observation bytes before preparing visuals, pausing A or starting B', async () => {
    const a = runtime(),
      factory = vi.fn(async () => a.value)
    const prepare = vi.fn(async () => new VisualAssetArchive())
    const controller = new RuntimeController(factory, prepare)
    await controller.start()
    try {
      await expect(
        controller.replace(
          {
            ...snapshot(),
            observationSources: [
              {
                version: 1,
                sourceId: `sha256:${'a'.repeat(64)}`,
                byteLength: 1,
                base64: 'YQ=='
              }
            ]
          },
          () => undefined
        )
      ).rejects.toThrow('digest')
      expect(prepare).not.toHaveBeenCalled()
      expect(a.value.pauseEditing).not.toHaveBeenCalled()
      expect(a.value.captureSnapshot).not.toHaveBeenCalled()
      expect(a.value.dispose).not.toHaveBeenCalled()
      expect(factory).toHaveBeenCalledOnce()
      expect(controller.getState()).toMatchObject({
        status: 'ready',
        runtime: a.value,
        generation: 1,
        recoveryAvailable: false
      })
    } finally {
      await controller.dispose()
    }
  })

  it('fences late observation verification after close without pausing A or allocating target visuals', async () => {
    const bytes = new Uint8Array([97]),
      subtle = crypto.subtle
    const original = subtle.digest
    const actual = await original.call(subtle, 'SHA-256', bytes)
    const sourceId = `sha256:${Array.from(new Uint8Array(actual), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    const wait = deferred<ArrayBuffer>()
    const digest = vi.fn(() => wait.promise)
    const a = runtime(),
      factory = vi.fn(async () => a.value)
    const prepare = vi.fn(async () => new VisualAssetArchive())
    const controller = new RuntimeController(factory, prepare)
    await controller.start()
    subtle.digest = digest
    try {
      const replacing = controller
        .replace(
          {
            ...snapshot(),
            observationSources: [
              { version: 1, sourceId, byteLength: 1, base64: 'YQ==' }
            ]
          },
          () => undefined
        )
        .then(
          () => null,
          (error: unknown) => error
        )
      await vi.waitFor(() => expect(digest).toHaveBeenCalledOnce())
      expect(a.value.pauseEditing).not.toHaveBeenCalled()
      const closing = controller.dispose()
      wait.resolve(actual)
      expect(await replacing).toMatchObject({ name: 'AbortError' })
      await closing
      expect(prepare).not.toHaveBeenCalled()
      expect(factory).toHaveBeenCalledOnce()
      expect(a.value.dispose).toHaveBeenCalledOnce()
    } finally {
      wait.resolve(actual)
      subtle.digest = original
      await controller.dispose()
    }
  })

  it('rejects damaged source content before pausing or retiring the current document', async () => {
    const a = runtime(),
      b = runtime(),
      factory = vi.fn(async () => a.value)
    const prepare = vi.fn(
      (target: Parameters<typeof prepareProjectVisuals>[0]) =>
        prepareProjectVisuals(target, {
          decode: decodeRestrictedGlb,
          dispose: vi.fn()
        })
    )
    const controller = new RuntimeController(factory, prepare)
    await controller.start()
    factory.mockResolvedValue(b.value)
    await expect(
      controller.replace(
        {
          ...snapshot(),
          visualSources: [
            {
              version: 1,
              assetId: 'a'.repeat(64),
              filename: 'damaged.glb',
              byteLength: 3,
              base64: 'AAAA'
            }
          ]
        },
        () => undefined
      )
    ).rejects.toThrow()
    expect(prepare).toHaveBeenCalledOnce()
    expect(a.value.pauseEditing).not.toHaveBeenCalled()
    expect(a.value.captureSnapshot).not.toHaveBeenCalled()
    expect(a.value.dispose).not.toHaveBeenCalled()
    expect(controller.getState().runtime).toBe(a.value)
    await controller.dispose()
  })

  it('transfers prepared sources exactly once and leaves successful resource disposal to the successor', async () => {
    const a = runtime(),
      b = runtime()
    const resources = new VisualAssetArchive({
      decode: decodeRestrictedGlb,
      dispose: vi.fn()
    })
    const prepare = vi.fn(async () => resources),
      factory = vi.fn(
        async (_snapshot?: unknown, _resources?: VisualAssetArchive) => a.value
      )
    const controller = new RuntimeController(factory, prepare)
    await controller.start()
    factory.mockResolvedValue(b.value)
    await controller.replace(snapshot(), () => undefined)
    expect(factory).toHaveBeenLastCalledWith(snapshot(), resources)
    expect(prepare).toHaveBeenCalledOnce()
    expect(() => resources.capture([])).not.toThrow()
    await controller.dispose()
    resources.dispose()
  })

  it('aborts pending preparation and disposes a late resource without pausing A or starting B', async () => {
    const a = runtime(),
      factory = vi.fn(async () => a.value)
    const wait = deferred<VisualAssetArchive>()
    let signal: AbortSignal | undefined
    const prepare = vi.fn(
      async (_target: unknown, ownedSignal: AbortSignal) => {
        signal = ownedSignal
        return wait.promise
      }
    )
    const controller = new RuntimeController(factory, prepare)
    await controller.start()
    const replacing = controller.replace(snapshot(), () => undefined)
    const rejected = expect(replacing).rejects.toThrow('closed')
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce())
    expect(controller.getState().runtime).toBe(a.value)
    expect(a.value.pauseEditing).not.toHaveBeenCalled()
    const closing = controller.dispose()
    expect(signal?.aborted).toBe(true)
    const resources = new VisualAssetArchive({
      decode: decodeRestrictedGlb,
      dispose: vi.fn()
    })
    wait.resolve(resources)
    await rejected
    await closing
    expect(() => resources.capture([])).toThrow('closed')
    expect(factory).toHaveBeenCalledOnce()
    expect(a.value.dispose).toHaveBeenCalledOnce()
  })

  it.each(['stale preparation', 'startup failure'])(
    'disposes untransferred sources after %s',
    async (failure) => {
      const a = runtime(),
        decoder = { decode: decodeRestrictedGlb, dispose: vi.fn() }
      const resources = new VisualAssetArchive(decoder),
        factory = vi.fn(async () => a.value)
      const controller = new RuntimeController(factory, async () => resources)
      await controller.start()
      factory.mockRejectedValue(new Error('startup failure'))
      let checks = 0
      await expect(
        controller.replace(snapshot(), () => {
          if (++checks === 2 && failure === 'stale preparation')
            throw new Error(failure)
        })
      ).rejects.toThrow(failure)
      expect(decoder.dispose).toHaveBeenCalledOnce()
      expect(() => resources.capture([])).toThrow('closed')
      if (failure === 'stale preparation') {
        expect(a.value.pauseEditing).not.toHaveBeenCalled()
        expect(controller.getState().runtime).toBe(a.value)
      }
      await controller.dispose()
    }
  )

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
      'guard',
      'pause',
      'capture',
      'guard',
      'dispose',
      'guard',
      'bootstrap',
      'guard'
    ])
    expect(factory).toHaveBeenLastCalledWith(
      snapshot(),
      expect.any(VisualAssetArchive)
    )
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

  it.each(['run evidence', 'nonfinite data'])(
    'rejects invalid target %s before pausing or retiring A',
    async (failure) => {
      const { a, factory, controller } = await setup(),
        target = snapshot()
      if (failure === 'run evidence')
        Object.assign(target, { runs: [{ version: 999 }] })
      else
        Object.assign(target.document.props, {
          invalidNumber: Number.POSITIVE_INFINITY
        })
      await expect(
        controller.replace(target, () => undefined)
      ).rejects.toThrow()
      expect(a.value.preflight).not.toHaveBeenCalled()
      expect(a.value.pauseEditing).not.toHaveBeenCalled()
      expect(a.value.captureSnapshot).not.toHaveBeenCalled()
      expect(a.value.dispose).not.toHaveBeenCalled()
      expect(factory).toHaveBeenCalledTimes(1)
      expect(controller.getState()).toMatchObject({
        status: 'ready',
        runtime: a.value,
        generation: 1,
        recoveryAvailable: false
      })
      await controller.dispose()
    }
  )

  it('preserves A if its recovery capture cannot be exported under the native format contract', async () => {
    const { a, factory, controller } = await setup(),
      source = snapshot()
    Object.assign(source.document.props, {
      invalidRecovery: Number.POSITIVE_INFINITY
    })
    a.value.captureSnapshot = vi.fn(async () => source)
    await expect(
      controller.replace(snapshot(), () => undefined)
    ).rejects.toThrow('Nonfinite project number')
    expect(a.value.dispose).not.toHaveBeenCalled()
    expect(a.resume).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({
      runtime: a.value,
      status: 'ready',
      recoveryAvailable: false
    })
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
        if (failure === 'stale' && ++calls > 2)
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
        if (++checks === 5) throw new Error('Storage session closed')
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
