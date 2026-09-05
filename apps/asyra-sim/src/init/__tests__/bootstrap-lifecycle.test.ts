// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { bootstrap, type SimRuntime } from '../bootstrap'
import { ThreeEngine, type GraphicsDriver } from '../../engine/three-engine'
import { terminalAnalysisResult } from '../../analysis/result'
import { encodeProject, decodeProject } from '../../storage/project-format'
import { VisualAssetArchive } from '../../storage/visual-archive'
import { prepareProjectVisuals } from '../../storage/project-visuals'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import { IDENTITY_POSE } from '../../domain/math'
import { ObservationAttachmentArchive } from '../../storage/observation-archive'

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
  const start = async (
    snapshot?: Parameters<typeof bootstrap>[2],
    prepared?: VisualAssetArchive
  ) => {
    const runtime = await bootstrap(host, provider, snapshot, prepared)
    runtimes.push(runtime)
    return runtime
  }
  return { host, drivers, provider, start }
}

describe('App composition lifetime', () => {
  it('owns run-linked notes and opaque sources across Undo, native capture and fresh lifetimes without changing evidence', async () => {
    const { start } = environment(),
      first = await start()
    const candidate = first.getCandidates()[0],
      experiment = first.getExperiments(candidate.id)[0]
    const snapshot = first.createExperimentSnapshot(experiment.id, [])
    const record = {
      version: 1 as const,
      name: 'Field validation',
      retainedAt: '2026-09-05T00:00:00.000Z',
      environment: {
        appVersion: 'test',
        userAgent: 'Unit test',
        hardwareConcurrency: 1
      },
      snapshot,
      result: terminalAnalysisResult(snapshot, [], {
        runId: 'field-run',
        startedAt: 0,
        endedAt: 1,
        execution: 'cancelled',
        error: 'Cancelled'
      })
    }
    await first.features.storage.retain(record)
    const input = new TextEncoder().encode('Observed gap: 25 mm')
    const receipt = await first.features.observations.prepare([
      { filename: 'field.txt', bytes: input }
    ])
    const depth = first.getHistoryDepth()
    const id = await first.features.observations.retain(receipt, {
      runId: 'field-run',
      draft: {
        title: 'Field check',
        text: 'Reported gap: 25 mm.',
        attachments: receipt.attachments
      }
    })
    expect(first.getHistoryDepth()).toBe(depth + 1)
    expect(first.getRuns()).toEqual([record])
    const note = first.getObservations('field-run')[0]
    expect(note.id).toBe(id)
    expect(
      Array.from(first.getObservationAttachment(note.attachments[0]))
    ).toEqual(Array.from(input))
    note.text = 'External mutation'
    expect(first.getObservations('field-run')[0].text).toBe(
      'Reported gap: 25 mm.'
    )
    await first.features.edit.removeObservation('field-run', id, 1)
    expect((await first.captureSnapshot()).observationSources).toBeUndefined()
    await first.features.history.undo()
    const saved = decodeProject(encodeProject(await first.captureSnapshot()))
    expect(saved.observationSources).toHaveLength(1)
    const exported = first.exportObservations('field-run')
    expect(JSON.parse(exported).sources).toEqual(saved.observationSources)
    const release = first.pauseEditing()
    expect(() =>
      first.features.observations.prepare([
        { filename: 'late.txt', bytes: input }
      ])
    ).toThrow('paused')
    expect(first.getObservations('field-run')).toHaveLength(1)
    release()
    await first.dispose()
    expect(() => first.getObservations('field-run')).toThrow('closed')
    expect(() => first.getObservationAttachment(note.attachments[0])).toThrow(
      'closed'
    )
    expect(() => first.exportObservations('field-run')).toThrow('closed')
    expect(() => first.features.observations.discard(receipt)).toThrow('closed')
    const sources = saved.observationSources
    if (!sources) throw new Error('Missing saved sources')
    const corrupt = {
      ...saved,
      observationSources: sources.map((source) => ({
        ...source,
        base64: `${source.base64.startsWith('A') ? 'B' : 'A'}${source.base64.slice(1)}`
      }))
    }
    await expect(start(corrupt)).rejects.toThrow('digest')
    expect(core.isCompositionOpen()).toBe(true)
    const second = await start(saved)
    expect(second.getHistoryDepth()).toBe(0)
    expect(second.getRuns()).toEqual([record])
    expect(second.exportObservations('field-run')).toBe(exported)
    expect(
      Array.from(second.getObservationAttachment(note.attachments[0]))
    ).toEqual(Array.from(input))
    expect(() =>
      first.features.edit.removeObservation('field-run', id, 1)
    ).toThrow('closed')
    expect(second.getObservations('field-run')).toHaveLength(1)
  })

  it('releases observation resources when startup fails before Feature installation', async () => {
    const { host } = environment(),
      original = ObservationAttachmentArchive.prototype.dispose
    const owner = core,
      defineComponent = owner.defineComponent
    const released: ObservationAttachmentArchive[] = []
    owner.defineComponent = vi.fn(() => {
      throw new Error('component registration unavailable')
    })
    ObservationAttachmentArchive.prototype.dispose = function () {
      released.push(this)
      original.call(this)
    }
    try {
      await expect(bootstrap(host)).rejects.toThrow(
        'component registration unavailable'
      )
      expect(released).toHaveLength(1)
      expect(() => released[0].capture([])).toThrow('closed')
      expect(core.isCompositionOpen()).toBe(true)
    } finally {
      ObservationAttachmentArchive.prototype.dispose = original
      owner.defineComponent = defineComponent
    }
  })

  it('owns visual import, binding history, portable sources, and historical-only replay across lifetimes', async () => {
    const { start } = environment(),
      decoder = { decode: vi.fn(decodeRestrictedGlb), dispose: vi.fn() }
    const resources = new VisualAssetArchive(decoder),
      first = await start(undefined, resources)
    const candidate = first.getCandidates()[0],
      body = first.getWorkcell(candidate.id).bodies[0]
    const { json, binary } = triangleFixture(),
      depth = first.getHistoryDepth()
    const prepared = await first.features.visuals.prepare(
      encodeGlb(json, binary),
      'reference.glb'
    )
    expect(first.getHistoryDepth()).toBe(depth)
    const assetId = await first.features.visuals.retain(
      prepared,
      candidate.id,
      body.id,
      {
        version: 1,
        id: 'reference',
        pose: IDENTITY_POSE,
        scale: [1, 1, 1]
      }
    )
    expect(first.getHistoryDepth()).toBe(depth + 1)
    expect(
      first.getVisualAssets(first.getWorkcell(candidate.id)).get(assetId)
        ?.meshes[0].positions
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect((await first.captureSnapshot()).visualSources).toHaveLength(1)
    await first.features.history.undo()
    expect((await first.captureSnapshot()).visualSources).toBeUndefined()
    await first.features.history.redo()
    const experiment = first.getExperiments(candidate.id)[0],
      frozen = first.createExperimentSnapshot(experiment.id, [])
    await first.features.storage.retain({
      version: 1,
      name: 'Visual provenance',
      retainedAt: '2026-09-05T00:00:00.000Z',
      environment: {
        appVersion: '0.1.0-alpha.0',
        userAgent: 'Test',
        hardwareConcurrency: 8
      },
      snapshot: frozen,
      result: terminalAnalysisResult(frozen, [], {
        runId: 'visual-run',
        startedAt: 0,
        endedAt: 1,
        execution: 'cancelled',
        error: 'Cancelled'
      })
    })
    await first.features.edit.setVisuals(candidate.id, body.id, [])
    const saved = decodeProject(encodeProject(await first.captureSnapshot()))
    expect(saved.visualSources).toEqual([prepared.source])
    expect(first.getVisualAssets(first.getWorkcell(candidate.id)).size).toBe(0)
    expect(first.getVisualAssets(frozen.workcell).size).toBe(1)
    await first.dispose()
    expect(decoder.dispose).toHaveBeenCalledOnce()
    expect(() => first.getVisualAssets(frozen.workcell)).toThrow('closed')
    expect(() =>
      first.features.visuals.prepare(encodeGlb(json, binary), 'late.glb')
    ).toThrow('closed')
    const rehydration = { decode: vi.fn(decodeRestrictedGlb), dispose: vi.fn() }
    const second = await start(
      saved,
      await prepareProjectVisuals(saved, rehydration)
    )
    expect(rehydration.decode).toHaveBeenCalledOnce()
    expect(second.getHistoryDepth()).toBe(0)
    expect(
      second.getVisualAssets(second.getRuns()[0].snapshot.workcell).size
    ).toBe(1)
    expect((await second.captureSnapshot()).visualSources).toEqual(
      saved.visualSources
    )
  })

  it('releases prepared visual resources when startup fails before Feature installation', async () => {
    const { host } = environment(),
      decoder = { decode: decodeRestrictedGlb, dispose: vi.fn() }
    const resources = new VisualAssetArchive(decoder)
    await expect(
      bootstrap(
        host,
        () => {
          throw new Error('engine unavailable')
        },
        undefined,
        resources
      )
    ).rejects.toThrow('engine unavailable')
    expect(decoder.dispose).toHaveBeenCalledOnce()
    expect(() => resources.capture([])).toThrow('closed')
  })

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
    const methods = first.getMethodDescriptors()
    expect(methods).toHaveLength(2)
    expect(snapshot.methodDescriptor).toEqual(methods[0])
    if (!methods[0].manifest)
      throw new Error('Missing installed method manifest')
    methods[0].manifest.name = 'Caller mutation'
    expect(first.getMethodDescriptors()[0].manifest?.name).not.toBe(
      'Caller mutation'
    )
    expect(first.preflightExperiment(experiment.id).blockers).toEqual([])
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
