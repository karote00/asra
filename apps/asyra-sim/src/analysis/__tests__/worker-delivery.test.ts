import { afterEach, expect, it, vi } from 'vitest'
import type { OfficialPairEvidence } from '../methods/official-method'
import type { AnalysisWorkerRequest } from '../worker-protocol'

const method = vi.hoisted(() => vi.fn())
vi.mock('../methods/official-method', () => ({
  runOfficialClearanceMethod: method
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

const pair = (index: number): OfficialPairEvidence => ({
  pairId: `pair-${index}`,
  evidence: {
    lower: 1,
    upper: 1,
    coverage: 'complete',
    evaluations: 1,
    leaves: [
      {
        start: 0,
        end: 0,
        lower: 1,
        upper: 1,
        witnessTime: 0,
        penetration: false,
        state: 'clear',
        reason: 'Transport fixture.'
      }
    ]
  }
})

async function setup(fail = false) {
  let receive: (event: MessageEvent<AnalysisWorkerRequest>) => void = () =>
    undefined
  let now = 0
  const messages: { time: number; data: Record<string, unknown> }[] = []
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const close = vi.fn()
  vi.stubGlobal('self', {
    addEventListener: (_name: string, listener: typeof receive) => {
      receive = listener
    },
    postMessage: (data: Record<string, unknown>) =>
      messages.push({ time: now, data }),
    close
  })
  method.mockImplementation(
    (
      _snapshot,
      checkpoint: () => void,
      onPair: (value: OfficialPairEvidence) => void
    ) => {
      const pairs = [pair(0), pair(1), pair(2), pair(3)]
      for (const [index, time] of [0, 10, 100, 110].entries()) {
        now = time
        checkpoint()
        onPair(pairs[index])
      }
      if (fail) throw new Error('Method stopped')
      return {
        version: 1,
        snapshotId: 'snapshot',
        method: { id: 'transport-fixture', version: '1' },
        coverage: 'complete',
        evaluations: 4,
        pairs
      }
    }
  )
  await import('../analysis.worker')
  receive(
    new MessageEvent('message', {
      data: {
        type: 'run',
        runId: 'run',
        snapshot: { budget: { maxDurationMs: 1000 } }
      } as AnalysisWorkerRequest
    })
  )
  return { messages, close }
}

it('batches progress to ten updates per second and delivers all terminal evidence immediately', async () => {
  const { messages, close } = await setup()
  const progress = messages.filter(
    (message) => message.data.type === 'progress'
  )
  expect(progress.map((message) => message.time)).toEqual([0, 100])
  expect(progress[1].data).toMatchObject({ pairs: [pair(1)] })
  expect(messages.at(-1)).toMatchObject({
    time: 110,
    data: {
      type: 'complete',
      evidence: { pairs: [pair(0), pair(1), pair(2), pair(3)] }
    }
  })
  expect(close).toHaveBeenCalledOnce()
})

it('includes unsent partial evidence in an unthrottled terminal error', async () => {
  const { messages, close } = await setup(true)
  expect(messages.at(-1)).toMatchObject({
    time: 110,
    data: { type: 'error', error: 'Method stopped', pairs: [pair(2), pair(3)] }
  })
  expect(close).toHaveBeenCalledOnce()
})
