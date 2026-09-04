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
  onmessageerror: ((event: MessageEvent) => void) | null = null
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
  it('rejects contradictory terminal evidence without erasing an earlier validated finding', async () => {
    const { worker, runner } = setup(),
      input = snapshot(0),
      pending = runner.run(input),
      evidence = runOfficialClearanceMethod(input)
    worker.emit({ type: 'progress', runId: 'run-1', pairs: evidence.pairs })
    const conflicting = {
      ...evidence,
      pairs: evidence.pairs.map((pair) => ({
        ...pair,
        evidence: {
          ...pair.evidence,
          lower: 0.5,
          upper: 1,
          leaves: pair.evidence.leaves.map((leaf) => ({
            ...leaf,
            lower: 0.5,
            upper: 1,
            penetration: false,
            state: 'clear'
          }))
        }
      }))
    }
    worker.emit({ type: 'complete', runId: 'run-1', evidence: conflicting })
    await expect(pending).resolves.toMatchObject({
      execution: 'failed',
      summary: 'issue-found',
      errors: [expect.stringContaining('progress')]
    })
  })
  it('exposes immutable validated progress without a verdict and clears it on disposal', async () => {
    vi.useFakeTimers()
    const { worker, runner } = setup(),
      input = snapshot(),
      pending = runner.run(input)
    expect(runner.getProgress()).toMatchObject({
      state: 'running',
      totalPairCount: 1,
      receivedPairCount: 0
    })
    const evidence = runOfficialClearanceMethod(input)
    worker.emit({ type: 'progress', runId: 'run-1', pairs: evidence.pairs })
    const progress = runner.getProgress()
    expect(progress).toMatchObject({
      runId: 'run-1',
      snapshotId: input.snapshotId,
      receivedPairCount: 1,
      evaluations: 1
    })
    expect(Object.isFrozen(progress)).toBe(true)
    expect(progress).not.toHaveProperty('verdict')
    worker.emit({ type: 'complete', runId: 'run-1', evidence })
    await pending
    expect(runner.getProgress()?.state).toBe('completed')
    await runner.dispose()
    expect(runner.getProgress()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains validated unsent findings carried by a terminal method error', async () => {
    const { worker, runner } = setup(),
      input = snapshot(0),
      pending = runner.run(input),
      evidence = runOfficialClearanceMethod(input)
    worker.emit({
      type: 'error',
      runId: 'run-1',
      error: 'Method stopped',
      pairs: evidence.pairs
    })
    await expect(pending).resolves.toMatchObject({
      execution: 'failed',
      summary: 'issue-found',
      coveredPairCount: 1
    })
  })
  it('uses the published 250 ms cooperative cancellation grace by default', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub(),
      controller = new AbortController(),
      runner = new AnalysisRunner(() => worker as unknown as Worker)
    const pending = runner.run(snapshot(), controller.signal)
    controller.abort()
    await vi.advanceTimersByTimeAsync(249)
    expect(worker.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(pending).resolves.toMatchObject({ execution: 'cancelled' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('charges worker startup time to the same deadline as computation', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub(),
      runner = new AnalysisRunner(
        () => {
          vi.setSystemTime(Date.now() + 900)
          return worker as unknown as Worker
        },
        Date.now,
        () => 'slow-start',
        25
      )
    const pending = runner.run(snapshot())
    await vi.advanceTimersByTimeAsync(125)
    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(pending).resolves.toMatchObject({ execution: 'timed-out' })
  })

  it('rejects a completion delivered after the deadline before the timer callback runs', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub(),
      runner = new AnalysisRunner(() => worker as unknown as Worker),
      input = snapshot(),
      pending = runner.run(input)
    const request = worker.postMessage.mock.calls[0]?.[0] as { runId: string }
    vi.setSystemTime(Date.now() + 1000)
    worker.emit({
      type: 'complete',
      runId: request.runId,
      evidence: runOfficialClearanceMethod(input)
    })
    await expect(pending).resolves.toMatchObject({
      execution: 'timed-out',
      verdict: 'cannot-determine'
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates explicitly when structured worker messages cannot be deserialized', async () => {
    const { worker, runner } = setup(),
      pending = runner.run(snapshot())
    expect(worker.onmessageerror).toBeTypeOf('function')
    worker.onmessageerror?.(new MessageEvent('messageerror'))
    await expect(pending).resolves.toMatchObject({
      execution: 'failed',
      errors: [expect.stringContaining('deserialize')]
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('validates a completed worker result and releases the worker', async () => {
    const { worker, runner } = setup(),
      input = snapshot(),
      pending = runner.run(input)
    const request = worker.postMessage.mock.calls[0]?.[0] as { runId: string }
    const evidence = runOfficialClearanceMethod(input)
    worker.emit({
      type: 'progress',
      runId: request.runId,
      pairs: [evidence.pairs[0]]
    })
    const reordered = JSON.parse(
      JSON.stringify(evidence, (_key, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value
      )
    )
    worker.emit({ type: 'complete', runId: request.runId, evidence: reordered })

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
    worker.emit({ type: 'progress', runId: request.runId, pairs: [pair] })
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
