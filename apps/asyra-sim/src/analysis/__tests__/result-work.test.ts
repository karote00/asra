import { expect, it, vi } from 'vitest'
import { liveFixture } from '../live/__tests__/fixtures'
import { sampleSnapshot } from '../live/sample'
import { runOfficialClearanceMethod } from '../methods/official-method'
import { completeAnalysisResult } from '../result'

it('admits each pair once before deriving a formal report, without a second validation clone', () => {
  const snapshot = sampleSnapshot(liveFixture(), 4)
  const evidence = runOfficialClearanceMethod(snapshot)
  const clone = vi.spyOn(globalThis, 'structuredClone')

  try {
    const result = completeAnalysisResult(snapshot, evidence, {
      runId: 'profile',
      startedAt: 0,
      endedAt: 1
    })

    expect(result.pairEvidence).toEqual(evidence.pairs)
    expect(clone).toHaveBeenCalledTimes(evidence.pairs.length + 3)
    expect(Object.isFrozen(result.pairEvidence[0].evidence.leaves)).toBe(true)
  } finally {
    clone.mockRestore()
  }
})
