import { afterEach, expect, it, vi } from 'vitest'
import { performance as realPerformance } from 'node:perf_hooks'
import { runOfficialClearanceMethod } from '../../methods/official-method'
import { LivePlaybackRunner } from '../runner'
import { LIVE_LIMITS, LiveMessages } from '../protocol'
import { sampleSnapshot } from '../sample'
import { liveFixture } from './fixtures'

class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

afterEach(() => vi.useRealTimers())

it('admits the latest pending pose within 50 ms when the previous check has completed', async () => {
  vi.useFakeTimers()
  const input = liveFixture()
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(
    () => worker as unknown as Worker,
    undefined,
    Date.now
  )
  const abort = new AbortController()
  const task = runner.open(input, 0, abort.signal)
  worker.emit({ type: LiveMessages.READY })
  runner.sample(0.05)
  worker.emit({
    type: LiveMessages.RESULT,
    id: 1,
    time: 0,
    evidence: runOfficialClearanceMethod(sampleSnapshot(input, 0))
  })

  try {
    await vi.advanceTimersByTimeAsync(49)
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: LiveMessages.SAMPLE,
      id: 2,
      time: 0.05
    })
  } finally {
    abort.abort()
    await task
  }
})

it.each(['duplicate', 'wrong time', 'contradiction', 'deadline'])(
  'rejects %s after provisional feedback without retaining it as a completed sample',
  async (failure) => {
    vi.useFakeTimers()
    const input = liveFixture(true)
    const worker = new WorkerStub()
    const runner = new LivePlaybackRunner(
      () => worker as unknown as Worker,
      undefined,
      Date.now
    )
    const task = runner.open(input, 4, new AbortController().signal)
    const rejected = expect(task).rejects.toThrow('Live check failed')
    worker.emit({ type: LiveMessages.READY })
    const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))
    const progress = {
      type: LiveMessages.PROGRESS,
      id: 1,
      time: 4,
      pairs: [evidence.pairs[0]]
    }
    worker.emit(progress)

    if (failure === 'duplicate') worker.emit(progress)
    if (failure === 'wrong time') worker.emit({ ...progress, time: 3 })
    if (failure === 'contradiction') {
      const changed = structuredClone(evidence)
      changed.pairs[0].evidence.leaves[0].reason =
        'Different retained observation'
      worker.emit({
        type: LiveMessages.RESULT,
        id: 1,
        time: 4,
        evidence: changed
      })
    }
    if (failure === 'deadline') await vi.advanceTimersByTimeAsync(1000)

    await rejected
    expect(runner.getRecords()).toHaveLength(0)
    expect(runner.getState().sample).toBeNull()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  }
)

it('fences provisional output after a seek while retaining the original in-flight deadline', async () => {
  const input = liveFixture(true)
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(() => worker as unknown as Worker)
  const abort = new AbortController()
  const task = runner.open(input, 4, abort.signal)
  worker.emit({ type: LiveMessages.READY })
  runner.sample(1, true)
  const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))
  worker.emit({
    type: LiveMessages.PROGRESS,
    id: 1,
    time: 4,
    pairs: [evidence.pairs[0]]
  })

  expect(runner.getState().sample).toBeNull()
  expect(runner.getRecords()).toHaveLength(0)
  worker.emit({ type: LiveMessages.RESULT, id: 1, time: 4, evidence })
  expect(runner.getRecords()).toHaveLength(0)
  abort.abort()
  await task
})

it('publishes progress before completion without recording or freeing the in-flight check', async () => {
  const input = liveFixture(true)
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(() => worker as unknown as Worker)
  const abort = new AbortController()
  const task = runner.open(input, 4, abort.signal)
  // Observe rejection even when the old protocol rejects progress in this red test.
  const settled = task.catch(() => undefined)
  worker.emit({ type: LiveMessages.READY })
  const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))
  const pair = evidence.pairs.find((pair) =>
    pair.evidence.leaves.some((leaf) => leaf.state === 'finding')
  )
  if (!pair) throw new Error('Missing collision fixture')

  try {
    worker.emit({ type: 'progress', id: 1, time: 4, pairs: [pair] })
    expect(runner.getState()).toMatchObject({
      status: 'checking',
      sample: { time: 4, complete: false, pairs: [pair] }
    })
    expect(runner.getRecords()).toHaveLength(0)
    runner.sample(5)
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    worker.emit({ type: LiveMessages.RESULT, id: 1, time: 4, evidence })
    expect(runner.getRecords()).toHaveLength(1)
  } finally {
    abort.abort()
    await settled
  }
})

it('does not repeat a geometry query for a checked sample in the same input lifetime', async () => {
  vi.useFakeTimers()

  const input = liveFixture()
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(
    () => worker as unknown as Worker,
    undefined,
    Date.now
  )
  const abort = new AbortController()
  const task = runner.open(input, 4, abort.signal)

  worker.emit({ type: LiveMessages.READY })

  const start = realPerformance.now()
  const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))

  // eslint-disable-next-line no-console -- bounded permanent live work profile
  console.info(
    JSON.stringify({
      profile: 'live-sample-baseline',
      pairs: input.pairs.length,
      evaluations: evidence.evaluations,
      durationMs: realPerformance.now() - start
    })
  )

  worker.emit({ type: LiveMessages.RESULT, id: 1, time: 4, evidence })
  runner.sample(4)
  await vi.advanceTimersByTimeAsync(LIVE_LIMITS.samplePeriodMs)

  const calls = worker.postMessage.mock.calls.filter(
    ([message]) => message.type === LiveMessages.SAMPLE
  ).length

  abort.abort()
  await task

  expect(calls).toBe(1)
})

it('reuses owner-admitted samples across Play lifetimes with zero new Workers, then invalidates on replacement', async () => {
  const worker = new WorkerStub()
  const factory = vi.fn(() => worker as unknown as Worker)
  const runner = new LivePlaybackRunner(factory)
  const input = runner.prepare('revision-1', liveFixture)
  const abort = new AbortController()
  const first = runner.open(input, 4, abort.signal)

  worker.emit({ type: LiveMessages.READY })
  worker.emit({
    type: LiveMessages.RESULT,
    id: 1,
    time: 4,
    evidence: runOfficialClearanceMethod(sampleSnapshot(input, 4))
  })

  abort.abort()
  await first

  const create = vi.fn(liveFixture)
  const retained = runner.prepare('revision-1', create)
  const nextAbort = new AbortController()
  const next = runner.open(retained, 4, nextAbort.signal)

  expect(create).not.toHaveBeenCalled()
  expect(factory).toHaveBeenCalledOnce()
  expect(runner.getState().sample?.time).toBe(4)
  expect(runner.getRecords('revision-1')).toHaveLength(1)
  expect(runner.getRecords('revision-2')).toHaveLength(0)

  nextAbort.abort()
  await next

  runner.invalidate()
  expect(runner.getRecords()).toHaveLength(0)

  const replacement = runner.prepare('revision-2', create)
  expect(replacement).not.toBe(input)
  expect(create).toHaveBeenCalledOnce()

  runner.dispose()
})

it('does not reuse cached evidence for a detached input with the same snapshot ID', async () => {
  const worker = new WorkerStub()
  const factory = vi.fn(() => worker as unknown as Worker)
  const runner = new LivePlaybackRunner(factory)
  const input = runner.prepare('revision-1', liveFixture)
  const abort = new AbortController()
  const first = runner.open(input, 4, abort.signal)

  worker.emit({ type: LiveMessages.READY })
  worker.emit({
    type: LiveMessages.RESULT,
    id: 1,
    time: 4,
    evidence: runOfficialClearanceMethod(sampleSnapshot(input, 4))
  })
  abort.abort()
  await first

  const changed = structuredClone(input)
  const nextAbort = new AbortController()
  const next = runner.open(changed, 4, nextAbort.signal)

  expect(factory).toHaveBeenCalledTimes(2)
  expect(runner.getRecords()).toHaveLength(0)

  nextAbort.abort()
  await next
})

it('sends geometry once, retains only the latest time and discards pre-seek/retired output', async () => {
  vi.useFakeTimers()

  const input = liveFixture()
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(
    () => worker as unknown as Worker,
    undefined,
    Date.now
  )
  const abort = new AbortController()
  const task = runner.open(input, 0, abort.signal)

  worker.emit({ type: LiveMessages.READY })

  for (let i = 1; i <= 100; i++) runner.sample(i / 100)

  expect(worker.postMessage).toHaveBeenCalledTimes(2)

  runner.sample(4, true)

  worker.emit({
    type: LiveMessages.RESULT,
    id: 1,
    time: 0,
    evidence: runOfficialClearanceMethod(sampleSnapshot(input, 0))
  })

  expect(runner.getState().sample).toBeNull()

  await vi.advanceTimersByTimeAsync(LIVE_LIMITS.samplePeriodMs)

  expect(worker.postMessage).toHaveBeenLastCalledWith({
    type: LiveMessages.SAMPLE,
    id: 2,
    time: 4
  })

  worker.emit({
    type: LiveMessages.RESULT,
    id: 2,
    time: 4,
    evidence: runOfficialClearanceMethod(sampleSnapshot(input, 4))
  })

  expect(runner.getState().sample?.time).toBe(4)

  const late = worker.onmessage

  abort.abort()
  await task
  late?.(new MessageEvent('message', { data: { type: LiveMessages.READY } }))

  expect(runner.getState().status).toBe('idle')
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it.each([
  'timeout',
  'wrong time',
  'wrong source',
  'invalid evidence',
  'message error'
])('fails closed on %s and terminates the owned worker', async (failure) => {
  vi.useFakeTimers()

  const input = liveFixture()
  const worker = new WorkerStub()
  const runner = new LivePlaybackRunner(() => worker as unknown as Worker)
  const task = runner.open(input, 0, new AbortController().signal)
  const rejected = expect(task).rejects.toThrow('Live check failed')

  worker.emit({ type: LiveMessages.READY })

  if (failure === 'timeout') await vi.advanceTimersByTimeAsync(1000)
  else if (failure === 'message error') worker.onmessageerror?.()
  else {
    const evidence = structuredClone(
      runOfficialClearanceMethod(sampleSnapshot(input, 0))
    )

    if (failure === 'wrong source') evidence.snapshotId = 'foreign'

    worker.emit({
      type: LiveMessages.RESULT,
      id: 1,
      time: failure === 'wrong time' ? 1 : 0,
      evidence: failure === 'invalid evidence' ? {} : evidence
    })
  }

  await rejected

  expect(runner.getState().status).toBe('error')
  expect(runner.getState().sample).toBeNull()
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
