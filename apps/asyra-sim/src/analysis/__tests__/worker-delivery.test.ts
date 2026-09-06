import { expect, it } from 'vitest'
import type { OfficialPairEvidence } from '../methods/official-method'
import type { AnalysisWorkerResponse } from '../worker-protocol'
import { WorkerEvidenceDelivery } from '../worker-delivery'

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

function setup(fail = false) {
  let now = 0
  const messages: { time: number; data: AnalysisWorkerResponse }[] = []
  const delivery = new WorkerEvidenceDelivery(
    'run',
    (data) => messages.push({ time: now, data }),
    () => now
  )
  const pairs = [pair(0), pair(1), pair(2), pair(3)]
  for (const [index, time] of [0, 10, 100, 110].entries()) {
    now = time
    delivery.flush()
    delivery.record(pairs[index])
  }
  if (fail) delivery.fail('Method stopped')
  else
    delivery.complete({
      version: 1,
      snapshotId: 'snapshot',
      method: { id: 'transport-fixture', version: '1' },
      coverage: 'complete',
      evaluations: 4,
      pairs
    })
  return { messages }
}

it('batches progress to ten updates per second and delivers all terminal evidence immediately', () => {
  const { messages } = setup()
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
})

it('includes unsent partial evidence in an unthrottled terminal error', () => {
  const { messages } = setup(true)
  expect(messages.at(-1)).toMatchObject({
    time: 110,
    data: { type: 'error', error: 'Method stopped', pairs: [pair(2), pair(3)] }
  })
})
