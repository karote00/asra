// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { bootstrap, type SimRuntime } from '../bootstrap'
import { ThreeEngine, type GraphicsDriver } from '../../engine/three-engine'
import { terminalAnalysisResult } from '../../analysis/result'
import { encodeProject, decodeProject } from '../../storage/project-format'

const runtimes: SimRuntime[] = []
const callbacks: ResizeObserverCallback[] = []
const disconnects: ReturnType<typeof vi.fn>[] = []
beforeEach(() => {
  callbacks.length = 0
  disconnects.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback)
        disconnects.push(this.disconnect)
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
})
afterEach(async () => {
  for (const runtime of runtimes.splice(0))
    await runtime.dispose().catch(() => undefined)
  if (core.getRuntimeState() === 'active') await core.resetRuntime()
  vi.unstubAllGlobals()
})

const environment = () => {
  const host = document.createElement('div'),
    drivers: GraphicsDriver[] = []
  host.getBoundingClientRect = () => new DOMRect(0, 0, 640, 480)
  const provider = () =>
    new ThreeEngine({
      createDriver: () => {
        const driver: GraphicsDriver = {
          domElement: document.createElement('canvas'),
          autoClear: true,
          setSize: vi.fn(),
          setPixelRatio: vi.fn(),
          setClearColor: vi.fn(),
          clear: vi.fn(),
          clearDepth: vi.fn(),
          render: vi.fn(),
          dispose: vi.fn()
        }
        drivers.push(driver)
        return driver
      },
      requestFrame: () => 1,
      cancelFrame: () => undefined
    })
  const start = async (snapshot?: Parameters<typeof bootstrap>[2]) => {
    const runtime = await bootstrap(host, provider, snapshot)
    runtimes.push(runtime)
    return runtime
  }
  return { host, drivers, provider, start }
}

describe('App composition lifetime', () => {
  it('exposes analysis progress while paused but rejects the retired reader', async () => {
    const { start } = environment(),
      first = await start()
    expect(first.features.analysis.getProgress()).toBeNull()
    const resume = first.pauseEditing()
    expect(first.features.analysis.getProgress()).toBeNull()
    resume()
    await first.dispose()
    const second = await start()
    expect(second.features.analysis.getProgress()).toBeNull()
    expect(() => first.features.analysis.getProgress()).toThrow('closed')
  })
  it('exposes detached candidate lineage across replacement and rejects retired readers', async () => {
    const { start } = environment(),
      first = await start()
    const a = first.getCandidates()[0].id,
      b = await first.features.edit.duplicateCandidate(a, 'B')
    expect(first.getCandidateLineage(a)).toBeUndefined()
    const lineage = first.getCandidateLineage(b)
    expect(lineage?.copiedFromCandidateId).toBe(a)
    if (!lineage) throw new Error('Missing lineage')
    const source = first.getCandidateLineage(b)
    Object.values(lineage.bodyOrigins)[0].bodyId = 'external-change'
    expect(first.getCandidateLineage(b)).toEqual(source)
    const saved = await first.captureSnapshot()
    await first.dispose()
    const second = await start(saved)
    expect(second.getCandidateLineage(b)).toEqual(source)
    expect(second.getHistoryDepth()).toBe(0)
    expect(() => first.getCandidateLineage(b)).toThrow('closed')
  })

  it('retains immutable runs with canonical references across capture, Undo/Redo, and a new lifetime', async () => {
    const { start } = environment(),
      first = await start()
    const candidate = first.getCandidates()[0],
      experiment = first.getExperiments(candidate.id)[0]
    const snapshot = first.createExperimentSnapshot(experiment.id, [])
    const record = {
      version: 1 as const,
      name: 'Retained cancellation',
      retainedAt: '2026-09-05T00:00:00.000Z',
      environment: {
        appVersion: '0.1.0-alpha.0',
        userAgent: 'Test',
        hardwareConcurrency: 8
      },
      snapshot,
      result: terminalAnalysisResult(snapshot, [], {
        runId: 'retained-run',
        startedAt: 0,
        endedAt: 1,
        execution: 'cancelled',
        error: 'Cancelled'
      })
    }
    await first.features.storage.retain(record)
    expect(first.getRuns()).toEqual([record])
    await first.features.history.undo()
    expect(first.getRuns()).toEqual([])
    expect((await first.captureSnapshot()).runs).toBeUndefined()
    await first.features.history.redo()
    const saved = decodeProject(encodeProject(await first.captureSnapshot()))
    expect(saved.runs).toEqual([record])
    const missing = { ...saved, runs: [] }
    expect(() => encodeProject(missing)).toThrow('Missing or mismatched')
    await first.dispose()
    const second = await start(saved)
    expect(second.getRuns()).toEqual([record])
    expect(second.getHistoryDepth()).toBe(0)
    expect(() => first.features.storage.retain(record)).toThrow('closed')
  })
  it('reconstructs saved A/B/A with fresh engines and empty history, retaining load issues', async () => {
    const { host, drivers, start } = environment()
    const first = await start(),
      candidate = first.getCandidates()[0]
    const original = first.getWorkcell(candidate.id).bodies[0]
    const a = await first.captureSnapshot()
    await first.features.edit.upsert(candidate.id, {
      ...original,
      name: 'Saved B'
    })
    const b = await first.captureSnapshot()
    const oldResize = callbacks[0]
    const disposal = first.dispose()
    expect(first.dispose()).toBe(disposal)
    await disposal
    const second = await start({
      ...b,
      loadIssues: [{ path: 'source', message: 'Retained review requirement' }]
    })
    expect(second.getCandidates()).toHaveLength(1)
    expect(second.getWorkcell(candidate.id).bodies[0].name).toBe('Saved B')
    expect(second.getHistoryDepth()).toBe(0)
    expect(second.getLoadIssues()).toEqual([
      { path: 'source', message: 'Retained review requirement' }
    ])
    expect(() => first.getCandidates()).toThrow()
    oldResize(
      [{ contentRect: { width: 900, height: 700 } }] as ResizeObserverEntry[],
      {} as ResizeObserver
    )
    expect(drivers[1].setSize).toHaveBeenLastCalledWith(640, 480)
    await second.dispose()
    const third = await start(a)
    expect(third.getWorkcell(candidate.id).bodies[0]).toEqual(original)
    expect(third.getHistoryDepth()).toBe(0)
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    await third.dispose()
    expect(host.childElementCount).toBe(0)
    drivers.forEach((driver) => expect(driver.dispose).toHaveBeenCalledOnce())
    disconnects.forEach((disconnect) =>
      expect(disconnect).toHaveBeenCalledOnce()
    )
  })

  it('pauses new editing commands but permits a queued recovery capture', async () => {
    const { start } = environment(),
      runtime = await start()
    const releaseFirst = runtime.pauseEditing(),
      releaseSecond = runtime.pauseEditing()
    expect(() => runtime.features.history.undo()).toThrow('paused')
    const captured = await runtime.captureSnapshot()
    expect(captured.document.sceneTree.workspaceList).not.toEqual([])
    releaseFirst()
    expect(() => runtime.features.history.undo()).toThrow('paused')
    releaseSecond()
    await runtime.features.history.undo()
    await runtime.dispose()
    releaseFirst()
    releaseSecond()
    expect(() => runtime.features.history.redo()).toThrow('closed')
  })

  it('rejects invalid target hierarchy before changing the live runtime', async () => {
    const { start } = environment(),
      runtime = await start()
    const candidate = runtime.getCandidates()[0],
      original = runtime.getWorkcell(candidate.id)
    const target = await runtime.save(),
      depth = runtime.getHistoryDepth()
    target.sceneTree.elements[original.bodies[0].id].parentId = 'missing-parent'
    expect(() => runtime.preflight(target)).toThrow('invalid hierarchy')
    expect(runtime.getHistoryDepth()).toBe(depth)
    expect(runtime.getWorkcell(candidate.id)).toEqual(original)
  })

  it('cleans failed startup before another bootstrap can compose', async () => {
    const { host, start } = environment()
    await expect(
      bootstrap(host, () => {
        throw new Error('engine unavailable')
      })
    ).rejects.toThrow('engine unavailable')
    expect(core.isCompositionOpen()).toBe(true)
    expect(core.getRegistrations()).toEqual([])
    const runtime = await start()
    expect(runtime.getCandidates()).toHaveLength(1)
  })

  it('does not take ownership of an already-started runtime', async () => {
    const { host, provider, start, drivers } = environment(),
      runtime = await start()
    await expect(bootstrap(host, provider)).rejects.toThrow('already started')
    expect(runtime.getCandidates()).toHaveLength(1)
    expect(drivers[0].dispose).not.toHaveBeenCalled()
  })

  it('attempts Framework teardown after an App observer cleanup fails and preserves failure', async () => {
    const { start, drivers } = environment(),
      runtime = await start(),
      cause = new Error('observer cleanup failed')
    disconnects[0].mockImplementation(() => {
      throw cause
    })
    const disposal = runtime.dispose()
    await expect(disposal).rejects.toBe(cause)
    expect(runtime.dispose()).toBe(disposal)
    expect(drivers[0].dispose).toHaveBeenCalledOnce()
    expect(() => runtime.getCandidates()).toThrow('closed')
  })
})
