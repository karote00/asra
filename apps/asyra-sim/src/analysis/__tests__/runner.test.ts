import { afterEach, describe, expect, it, vi } from 'vitest'
import { MethodIds, MethodVersions } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import type { ExperimentSnapshot } from '../contracts'
import { runOfficialClearanceMethod } from '../methods/official-method'
import { AnalysisRunner } from '../runner'

class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

const body = (id: string, x: number): Body => ({
  id,
  parentId: null,
  name: id,
  role: id === 'primary' ? 'tool' : 'fixture',
  pose: { ...IDENTITY_POSE, position: [x, 0, 0] },
  joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
  colliders: [
    {
      id: 'shape',
      pose: IDENTITY_POSE,
      geometry: { kind: 'sphere', radius: 0.1 }
    }
  ],
  visible: true,
  color: 0
})

function snapshot(distance = 1): ExperimentSnapshot {
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: [body('primary', 0), body('obstacle', distance)]
  }
  return {
    version: 1,
    snapshotId: 'snapshot-1',
    source: {
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      experimentRevision: 1
    },
    workcell,
    trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 0],
    scope: {
      primaryBodyIds: ['primary'],
      influencingBodyIds: ['obstacle'],
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Complete scope.'
    },
    pairs: [
      {
        id: 'primary/shape::obstacle/shape',
        a: { bodyId: 'primary', colliderId: 'shape' },
        b: { bodyId: 'obstacle', colliderId: 'shape' }
      }
    ],
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.1 },
    budget: { maxIntervals: 64, maxDurationMs: 1000 },
    acknowledgedWarnings: []
  }
}

const setup = () => {
  const worker = new WorkerStub(),
    clock = vi.fn().mockReturnValueOnce(100).mockReturnValue(120),
    runner = new AnalysisRunner(
      () => worker as unknown as Worker,
      clock,
      () => 'run-1',
      25
    )
  return { worker, runner }
}

afterEach(() => vi.useRealTimers())

describe('M3 analysis worker lifecycle', () => {
  it('validates a completed worker result and releases the worker', async () => {
    const { worker, runner } = setup(),
      input = snapshot(),
      pending = runner.run(input)
    const request = worker.postMessage.mock.calls[0]?.[0] as { runId: string }
    const evidence = runOfficialClearanceMethod(input)
    worker.emit({
      type: 'progress',
      runId: request.runId,
      pair: evidence.pairs[0]
    })
    worker.emit({ type: 'complete', runId: request.runId, evidence })

    await expect(pending).resolves.toMatchObject({
      execution: 'completed',
      coverage: 'complete',
      summary: 'no-issue-within-scope'
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(runner.isRunning()).toBe(false)
  })

  it('propagates cancellation, terminates after grace, and retains valid progress', async () => {
    vi.useFakeTimers()
    const { worker, runner } = setup(),
      input = snapshot(0),
      controller = new AbortController(),
      pending = runner.run(input, controller.signal),
      request = worker.postMessage.mock.calls[0]?.[0] as { runId: string },
      pair = runOfficialClearanceMethod(input).pairs[0]
    worker.emit({ type: 'progress', runId: request.runId, pair })
    controller.abort()
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: 'cancel',
      runId: request.runId
    })
    await vi.advanceTimersByTimeAsync(25)

    await expect(pending).resolves.toMatchObject({
      execution: 'cancelled',
      coverage: 'partial',
      summary: 'issue-found',
      coveredPairCount: 1
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('distinguishes timeout from cancellation and never reports it as clear', async () => {
    vi.useFakeTimers()
    const { worker, runner } = setup(),
      pending = runner.run(snapshot())
    await vi.advanceTimersByTimeAsync(1025)
    await expect(pending).resolves.toMatchObject({
      execution: 'timed-out',
      coverage: 'partial',
      verdict: 'cannot-determine'
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('converts malformed evidence and worker crashes into failed results', async () => {
    const malformed = setup(),
      input = snapshot(),
      malformedPending = malformed.runner.run(input),
      request = malformed.worker.postMessage.mock.calls[0]?.[0] as {
        runId: string
      },
      evidence = { ...runOfficialClearanceMethod(input), snapshotId: 'wrong' }
    malformed.worker.emit({
      type: 'complete',
      runId: request.runId,
      evidence
    })
    await expect(malformedPending).resolves.toMatchObject({
      execution: 'failed',
      verdict: 'cannot-determine'
    })

    const crashed = setup(),
      crashedPending = crashed.runner.run(input)
    crashed.worker.onerror?.({ message: 'Worker crashed' } as ErrorEvent)
    await expect(crashedPending).resolves.toMatchObject({
      execution: 'failed',
      errors: ['Worker crashed']
    })
  })

  it('rejects overlapping local jobs and closes owned work on disposal', async () => {
    vi.useFakeTimers()
    const { worker, runner } = setup(),
      first = runner.run(snapshot())
    await expect(runner.run(snapshot())).rejects.toThrow('already running')
    const disposal = runner.dispose()
    await vi.advanceTimersByTimeAsync(25)
    await disposal
    await expect(first).resolves.toMatchObject({ execution: 'cancelled' })
    await expect(runner.run(snapshot())).rejects.toThrow('closed')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
